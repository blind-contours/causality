const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../science/core.js");
const G = require("../figures/galton.js");

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test("exact limits: AIPW centre 2 with the efficiency bound; plug-in centre 2.64", () => {
  close(G.LIM.veff, S.efficiencyVariance(), 1e-12, "veff");
  close(G.LIM.veff, 3.0283, 1e-4, "veff value");
  close(G.LIM.psiNaive, 2.6385, 1e-4, "naive centre");
  close(G.LIM.vNaive, 5.5536, 1e-4, "naive variance");
  close(G.LIM.pi, 0.35 * S.trueG(1) + 0.65 * S.trueG(0), 1e-12, "P(A=1)");
  // √(Var ϕ / n) at the displayed sample sizes
  close(Math.sqrt(G.LIM.veff / 100), 0.174, 5e-4, "AIPW sd n=100");
  close(Math.sqrt(G.LIM.vNaive / 400), 0.118, 5e-4, "plug-in sd n=400");
});

test("true influence functions are mean zero with the stated variances", () => {
  const rows = S.generate(200000, S.rng(7));
  const a = rows.map(G.phiAIPW),
    p = rows.map(G.phiNaive);
  close(S.mean(a), 0, 0.02, "mean ϕ AIPW");
  close(S.mean(p), 0, 0.02, "mean ϕ plug-in");
  close(S.variance(a), G.LIM.veff, 0.06, "Var ϕ AIPW");
  close(S.variance(p), G.LIM.vNaive, 0.1, "Var ϕ plug-in");
});

test("plug-in with outcome model [1, A] is the treated-minus-control difference", () => {
  const rows = S.generate(300, S.rng(11));
  const arm = (a) => S.mean(rows.filter((r) => r.a === a).map((r) => r.y));
  const st = G.oneStudy(rows, 16, true);
  close(st.plugin, arm(1) - arm(0), 1e-6, "difference in means");
  assert.equal(st.phiA.length, 300);
  // checkpoints: start at 0, end at the mean of ϕ, so centre + last = linear term
  assert.equal(st.pathA[0], 0);
  assert.equal(st.pathA.length, 17);
  close(2 + st.pathA[16], st.linA, 1e-12, "AIPW path ends at the linear term");
  close(G.LIM.psiNaive + st.pathP[16], st.linP, 1e-12, "plug-in path ends at the linear term");
});

test("the arrows add up: error equals the average of ϕ plus a remainder that is o(n^-1/2)", () => {
  const scaled = [50, 100, 400].map((n) => {
    const sim = G.simulate({ n, reps: 200 });
    return Math.sqrt(n) * G.summary(sim, "A").remRMS;
  });
  // √n · RMS(remainder) shrinks as n grows (it is O(n^-1/2) itself)
  assert.ok(scaled[0] > scaled[1] && scaled[1] > scaled[2], "√n·remainder decreases: " + scaled);
  const sim = G.simulate({ n: 400, reps: 200 });
  assert.ok(G.summary(sim, "A").remRMS < 0.15 * sim.sdA, "remainder small next to the SD");
});

test("pile width tracks √(Var ϕ / n) and tightens like 1/√n", () => {
  const s100 = G.simulate({ n: 100 }),
    s400 = G.simulate({ n: 400 });
  const a100 = G.summary(s100, "A"),
    a400 = G.summary(s400, "A");
  close(a100.sd / s100.sdA, 1, 0.15, "n=100 SD ratio");
  close(a400.sd / s400.sdA, 1, 0.15, "n=400 SD ratio");
  close(a100.sd / a400.sd, 2, 0.35, "halving from n=100 to 400");
});

test("coverage: AIPW near 95%, plug-in collapses as n grows", () => {
  const displayed = {};
  for (const n of [50, 100, 200, 400, 800]) {
    const sim = G.simulate({ n });
    const a = G.summary(sim, "A"),
      p = G.summary(sim, "P");
    displayed[n] = [a.covered, p.covered];
    assert.ok(a.coverage >= 0.9 && a.coverage <= 0.99, `AIPW coverage n=${n}: ${a.coverage}`);
    close(p.mean, G.LIM.psiNaive, 0.05, `plug-in centre n=${n}`);
  }
  // numbers the figure displays after all 200 studies (seeded)
  assert.deepEqual(displayed[50], [190, 109]);
  assert.deepEqual(displayed[100], [190, 47]);
  assert.deepEqual(displayed[400], [191, 0]);
  assert.equal(displayed[800][1], 0);
});

test("boundary cases: interval exactly touching the truth covers; smallest n is finite", () => {
  assert.equal(G.covers(2 + G.Z * 0.1, 0.1), true);
  assert.equal(G.covers(2 + G.Z * 0.1 + 1e-6, 0.1), false);
  const sim = G.simulate({ n: 50 });
  sim.studies.forEach((s) =>
    [s.aipw, s.seA, s.plugin, s.seP].forEach((v) => assert.ok(Number.isFinite(v) && v !== 0)),
  );
  // deterministic: same seed, same studies
  assert.equal(G.simulate({ n: 50 }).studies[7].aipw, sim.studies[7].aipw);
});

test("pile layout and timeline", () => {
  const cells = G.stack([0.05, 0.15, 0.07, 0.09, -0.01], 0, 0.1);
  assert.deepEqual(cells, [
    { bin: 0, level: 0 },
    { bin: 1, level: 0 },
    { bin: 0, level: 1 },
    { bin: 0, level: 2 },
    { bin: -1, level: 0 },
  ]);
  const sc = G.schedule(200, 3, "normal");
  assert.equal(sc.arrows, 3);
  for (let j = 1; j < 200; j++) {
    assert.ok(sc.launch[j] > sc.launch[j - 1]);
    assert.ok(sc.land[j] > sc.land[j - 1], "landings in order");
  }
  assert.equal(G.landedBy(sc, 0), 0);
  assert.equal(G.landedBy(sc, sc.total), 200);
  assert.equal(G.landedBy(sc, sc.land[4]), 5);
  const none = G.schedule(10, 0, "fast");
  assert.equal(none.arrows, 0);
  assert.equal(none.launch[0], 0);
});
