const test = require("node:test");
const assert = require("node:assert");
const C = require("../science/cohort.js");
const A = require("../figures/aipw-anatomy.js");

const ps = C.cohort.patients;
const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test("AIPW from the sticks equals the textbook formula, for both outcome models", () => {
  for (const model of ["strata", "wrong"]) {
    const R = A.compute(ps, { model });
    const m = model === "wrong" ? (a) => R.armMean[a] : (a, x) => R.cellMean[`${a},${x}`];
    const formula = A.aipwFormula(ps, m, (x) => R.g[x]);
    // Sticks: mean of plug-in sticks + mean of signed, weighted residual sticks.
    const sticks = R.rows.reduce((s, q) => s + q.plug + q.s * q.w * q.r, 0) / R.n;
    close(sticks, formula);
    close(R.aipw, formula);
  }
});

test("saturated fit: stratum-mean m̂ and stratum-fraction ĝ give a correction of exactly 0", () => {
  const R = A.compute(ps, { model: "strata" });
  close(R.correction, 0);
  close(R.plugin, R.stratified);
  close(R.g[0], 33 / 65);
  close(R.g[1], 25 / 35);
});

test("wrong outcome model: large plug-in error, repaired exactly by the correction", () => {
  const W = A.compute(ps, { model: "wrong" });
  const S = A.compute(ps, { model: "strata" });
  const naive = C.summary(C.cohort).naive;
  close(W.plugin, naive); // arm means ignoring severity: the plug-in is the naive contrast
  assert.ok(W.plugin - W.truth > 0.5, "plug-in misses the truth by more than 0.5");
  assert.ok(W.correction < -0.35, "correction pulls it back by more than 0.35");
  close(W.aipw, S.aipw);
  close(W.aipw, W.stratified);
  // Displayed numbers.
  assert.strictEqual(W.plugin.toFixed(3), "2.592");
  assert.strictEqual(W.correction.toFixed(3), "-0.388");
  assert.strictEqual(W.aipw.toFixed(3), "2.204");
  assert.strictEqual(S.truth.toFixed(3), "2.000");
});

test("why: with the saturated ĝ, AIPW equals the stratified estimator for ANY m̂(a, x)", () => {
  const r = C.rng(7);
  for (let k = 0; k < 20; k++) {
    const table = { "1,0": 10 * r() - 5, "0,0": 10 * r() - 5, "1,1": 10 * r() - 5, "0,1": 10 * r() - 5 };
    const R = A.compute(ps, { model: (a, x) => table[`${a},${x}`] });
    close(R.aipw, R.stratified, 1e-10);
  }
});

test("a smoothed (non-saturated) ĝ no longer repairs the wrong model exactly", () => {
  const W = A.compute(ps, { model: "wrong" });
  const m = (a) => W.armMean[a];
  const gTrue = (x) => C.cohort.params.g[x]; // 0.3, 0.7: correct in the population, not the sample fraction
  const est = A.aipwFormula(ps, m, gTrue);
  assert.ok(Math.abs(est - W.stratified) > 1e-3, "only first-order repair when ĝ is not the sample fraction");
  assert.ok(Math.abs(est - W.truth) < Math.abs(W.plugin - W.truth), "but it still moves toward the truth");
});

test("boundary: an empty arm in a stratum (ĝ = 0 or 1) is refused, not divided by zero", () => {
  const onlyTreatedHigh = ps.filter((p) => !(p.x === 1 && p.a === 0));
  assert.throws(() => A.compute(onlyTreatedHigh), /positivity/);
  // One patient per cell still works and is saturated.
  const tiny = [
    { id: 0, x: 0, a: 0, y: 1, y0: 1, y1: 2 },
    { id: 1, x: 0, a: 1, y: 3, y0: 2, y1: 3 },
    { id: 2, x: 1, a: 0, y: 2, y0: 2, y1: 5 },
    { id: 3, x: 1, a: 1, y: 6, y0: 4, y1: 6 },
  ];
  const T = A.compute(tiny, { model: "strata" });
  close(T.correction, 0);
  close(T.aipw, 0.5 * 2 + 0.5 * 4);
  const Tw = A.compute(tiny, { model: "wrong" });
  close(Tw.plugin, 4.5 - 1.5);
  close(Tw.aipw, 3);
});
