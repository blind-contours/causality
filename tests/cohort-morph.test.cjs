const test = require("node:test");
const assert = require("node:assert");
const C = require("../science/cohort.js");
const { numbers } = require("../figures/cohort-morph.js");

const N = numbers(C.cohort);
const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;

test("displayed counts and naive gap come from CausalCohort", () => {
  assert.strictEqual(N.n, 100);
  assert.strictEqual(N.nT + N.nC, 100);
  assert.strictEqual(N.strata[1].n, 35);
  assert.strictEqual(N.nT, 58);
  assert.strictEqual(N.highT + N.highC, 35);
  assert.ok(close(N.naive, C.summary(C.cohort).naive));
  assert.strictEqual(N.naive.toFixed(2), "2.59");
  assert.strictEqual(N.meanT.toFixed(2), "4.99");
  assert.strictEqual(N.meanC.toFixed(2), "2.40");
  // High-severity patients are treated more often: the source of confounding.
  assert.ok(N.strata[1].pTreat > N.strata[0].pTreat);
});

test("within-severity differences and standardization", () => {
  const [lo, hi] = N.strata;
  assert.strictEqual(lo.diff.toFixed(2), "2.34");
  assert.strictEqual(hi.diff.toFixed(2), "1.95");
  assert.ok(close(lo.weight, 0.65) && close(hi.weight, 0.35));
  assert.ok(close(N.standardized, 0.65 * lo.diff + 0.35 * hi.diff));
  // Observed-data standardization gives 2.20, not exactly 2: the residual is sampling noise.
  assert.strictEqual(N.standardized.toFixed(2), "2.20");
  assert.ok(Math.abs(N.standardized - 2) < Math.abs(N.naive - 2), "adjustment moves toward the truth");
});

test("truth: sample ATE and the weighted true stratum effects are exactly 2", () => {
  assert.ok(close(N.sampleATE, 2));
  assert.ok(close(N.strata[0].trueEffect, 1.86) && close(N.strata[1].trueEffect, 2.26));
  assert.ok(close(N.trueStandardized, 2), "0.65 x 1.86 + 0.35 x 2.26 = 2 with population weights");
  assert.ok(close(N.trueStandardized, N.sampleATE));
});

test("over repeated cohorts standardization is centred on 2, the naive contrast is not", () => {
  let s = 0,
    nv = 0,
    k = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const M = numbers(C.build({ seed }));
    if (!Number.isFinite(M.standardized)) continue;
    s += M.standardized;
    nv += M.naive;
    k++;
  }
  assert.ok(k > 390);
  assert.ok(Math.abs(s / k - 2) < 0.05, "mean standardized " + s / k);
  assert.ok(nv / k - 2 > 0.3, "mean naive " + nv / k);
});

test("boundary: an empty arm within a stratum makes the estimate undefined", () => {
  const ps = C.cohort.patients.map((p) => (p.x ? { ...p, a: 1, y: p.y1 } : p));
  const M = numbers({ patients: ps });
  assert.strictEqual(M.strata[1].nC, 0);
  assert.ok(Number.isNaN(M.standardized), "positivity failure: no control among high severity");
  // Without confounding (everyone's outcome equal in both arms) all contrasts are zero.
  const flat = C.cohort.patients.map((p) => ({ ...p, y: 1, y0: 1, y1: 1 }));
  const F = numbers({ patients: flat });
  assert.ok(close(F.naive, 0) && close(F.standardized, 0) && close(F.sampleATE, 0));
});
