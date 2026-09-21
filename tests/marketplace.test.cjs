const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../science/marketplace.js");
const close = (a, b, t = 1e-9) =>
  assert.ok(Math.abs(a - b) < t, `${a} vs ${b}`);

test("the hand-worked fixture reproduces exactly: unserved request, block boundary, repeated vehicle events", () => {
  const f = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../examples/marketplace/fixtures/hand_worked.json"),
    ),
  );
  const run = M.simulate({ ...f.config, schedule: f.schedule }, "fixed", {
    requests: JSON.parse(JSON.stringify(f.requests)),
    fleet: JSON.parse(JSON.stringify(f.fleet)),
  });
  const got = run.requests.map((o) => ({
    id: o.id,
    policy: o.policy,
    block: o.block,
    status: o.status,
    vehicle: o.vehicle,
    pickup: o.pickup,
    complete: o.complete,
    wait: o.wait,
    servedInTime: o.servedInTime,
  }));
  assert.deepEqual(got, f.expected);
  assert.equal(f.expected.filter((o) => o.status === "unserved").length, 3);
  assert.ok(
    f.expected.filter((o) => o.vehicle === 0).length >= 2,
    "one vehicle serves repeated requests",
  );
  assert.ok(
    f.expected.some((o) => o.block === 0) &&
      f.expected.some((o) => o.block === 1),
    "a block boundary is crossed",
  );
  close(M.fulfilment(run.requests), f.metrics.fulfilment);
});

test("fleet is conserved and no vehicle serves overlapping requests; runs are deterministic", () => {
  const run = M.simulate({ horizon: 300 }, "switchback");
  assert.equal(run.fleetCount, M.DEFAULT_CONFIG.fleet);
  // From the event log: a vehicle's next assignment never precedes its previous completion.
  const byVehicle = {};
  run.events.forEach((e) => (byVehicle[e.vehicle] ??= []).push(e));
  for (const evs of Object.values(byVehicle)) {
    evs.sort((a, b) => a.t - b.t || (a.state === "free" ? -1 : 1));
    let busyUntil = -Infinity;
    for (const e of evs) {
      if (e.state === "assigned") {
        assert.ok(
          e.t >= busyUntil,
          `vehicle assigned at ${e.t} before free at ${busyUntil}`,
        );
        const done = run.requests.find((o) => o.id === e.request);
        busyUntil = done.complete;
      }
    }
  }
  assert.ok(
    run.requests.every((o) => o.status !== "waiting"),
    "every eligible request has a terminal status",
  );
  assert.deepEqual(
    M.simulate({ horizon: 300 }, "switchback").requests,
    run.requests,
  );
});

test("designs match their documentation: half-open blocks, request policy fixed at arrival, sharp null makes B behave as A", () => {
  const run = M.simulate({ horizon: 120, blockLength: 30 }, "switchback");
  run.design.schedule.forEach((b, i) => {
    assert.equal(b.start, i * 30);
    assert.equal(b.end, (i + 1) * 30);
  });
  run.requests.forEach((o) =>
    assert.equal(o.policy, run.design.schedule[Math.floor(o.t / 30)].policy),
  );
  const nul = M.simulate({ horizon: 200 }, "allB", { sharpNull: true }),
    a = M.simulate({ horizon: 200 }, "allA");
  assert.deepEqual(
    nul.requests.map((o) => o.status),
    a.requests.map((o) => o.status),
  );
});

test("switchback estimator: unserved requests stay in the denominator and washout excludes only early arrivals", () => {
  const run = M.simulate({ horizon: 240, blockLength: 30 }, "switchback");
  const e0 = M.switchbackEstimate(run, { washout: 0 }),
    e5 = M.switchbackEstimate(run, { washout: 5 });
  assert.equal(e0.excluded, 0);
  assert.ok(e5.excluded > 0 && e5.excluded < run.requests.length);
  const eligible = run.requests.filter((o) => o.t < run.config.horizon);
  assert.equal(
    e0.perBlock.reduce((s, b) => s + b.n, 0),
    eligible.length,
  );
});

test("validated benchmark: with washout the block-mean difference is unbiased for delta + rho and the interval covers at its nominal rate", () => {
  const c = M.benchmarkCalibration(
    { blocks: 20, L: 6, delta: 0.1, rho: 0.05, sigma: 0.1, washout: 1 },
    400,
  );
  assert.ok(
    Math.abs(c.bias) < 3 * c.mcse,
    `bias ${c.bias} within Monte Carlo error ${c.mcse}`,
  );
  assert.ok(
    Math.abs(c.coverage - 0.95) < 3 * c.coverageMCSE + 0.01,
    `coverage ${c.coverage} ± ${c.coverageMCSE}`,
  );
  const n = M.benchmarkCalibration(
    { blocks: 20, L: 6, delta: 0.1, rho: 0.05, sigma: 0.1, washout: 0 },
    400,
  );
  assert.ok(
    n.bias < -0.005,
    "without washout the estimator is biased toward delta + rho(L−1)/L",
  );
});

test("randomization test resamples the design and keeps its p-value in (0,1]", () => {
  const run = M.simulate({ horizon: 360 }, "switchback");
  const r = M.switchbackRandomizationTest(run, 100);
  assert.ok(r.pValue > 0 && r.pValue <= 1);
});
