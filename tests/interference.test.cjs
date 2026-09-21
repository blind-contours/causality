const { test } = require("node:test");
const assert = require("node:assert/strict");
const I = require("../science/interference.js");
const close = (a, b, t = 1e-9) =>
  assert.ok(Math.abs(a - b) < t, `${a} vs ${b}`);

test("every design enumerates allowable assignments with probabilities summing to one", () => {
  for (const d of [
    { type: "bernoulli", p: 0.5 },
    { type: "bernoulli", p: 0.3 },
    { type: "complete", k: 4 },
    { type: "cluster", p: 0.5 },
  ]) {
    const e = I.enumerate(d);
    close(
      e.reduce((s, x) => s + x.prob, 0),
      1,
    );
    if (d.type === "bernoulli") assert.equal(e.length, 256);
    if (d.type === "complete")
      assert.ok(e.every((x) => x.a.reduce((s, v) => s + v, 0) === 4));
    if (d.type === "cluster")
      assert.ok(
        e.every((x) =>
          I.CLUSTERS.every((c) => new Set(c.map((i) => x.a[i])).size === 1),
        ),
      );
  }
});

test("zero spillover recovers the no-interference model: toggling one unit moves only that unit", () => {
  const a = [0, 1, 0, 1, 0, 0, 1, 0];
  assert.deepEqual(
    I.affected(a, 3, { gamma: 0 }).map(Number),
    [0, 0, 0, 1, 0, 0, 0, 0],
  );
  const hit = I.affected(a, 3, { gamma: 0.8 });
  assert.ok(hit[3] && I.NEIGHBOURS[3].every((j) => hit[j]));
  assert.ok(!hit[7], "a non-neighbour is untouched");
});

test("estimands are exact: direct tau, spillover gamma per unit exposure, policy tau + gamma", () => {
  const e = I.estimands({ tau: 1, gamma: 0.8 });
  close(e.direct, 1);
  close(e.spilloverPerUnitExposure, 0.8);
  close(e.policy, 1.8);
});

test("individual randomization's contrast is tau − gamma/(N−1), the same for Bernoulli and complete designs", () => {
  const P = { tau: 1, gamma: 0.8 };
  for (const d of [
    { type: "bernoulli", p: 0.5 },
    { type: "bernoulli", p: 0.3 },
    { type: "complete", k: 4 },
  ])
    close(I.designContrast(d, P).value, 1 - 0.8 / 7, 1e-9);
  const cluster = I.designContrast({ type: "cluster", p: 0.5 }, P);
  assert.ok(
    cluster.value > 1.6 && cluster.value < 1.7,
    "cluster contrast approaches the policy effect but bridge units dilute it",
  );
  close(cluster.massDefined, 0.5);
});

test("exposure support: cluster assignment removes the contrasts that separate own and neighbour effects", () => {
  const bern = I.exposureSupport({ type: "bernoulli", p: 0.5 })[0];
  assert.ok(bern.length > 4, "Bernoulli offers many (own, exposure) levels");
  assert.ok(
    I.contrastSupported(
      { type: "bernoulli", p: 0.5 },
      0,
      { own: 1, g: 0 },
      { own: 0, g: 0 },
    ),
  );
  assert.ok(
    !I.contrastSupported(
      { type: "cluster", p: 0.5 },
      0,
      { own: 1, g: 0 },
      { own: 0, g: 0 },
    ),
    "own treated with untreated neighbours never happens under cluster assignment",
  );
});

test("a shared shock moves every outcome without any unit's treatment reaching another", () => {
  const r = I.shockVersusSpillover([0, 0, 0, 0, 0, 0, 0, 0], { gamma: 0 });
  assert.ok(r.shockMoves.every((d) => Math.abs(d - 0.5) < 1e-12));
  assert.deepEqual(r.toggleAffects.map(Number), [1, 0, 0, 0, 0, 0, 0, 0]);
});
