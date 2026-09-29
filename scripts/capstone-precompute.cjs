/* Precompute for the lesson "An emulated trial, end to end" (science/capstone.js).
 * The registry itself is simulated live on the page (cheap and seeded). What is slow is the
 * cross-fitted Super Learner: 5 outer folds × (5 inner CV fits + 1 refit) × 4 learners × 3 targets.
 * This script stores its per-patient held-out predictions, the per-fold ensemble weights, the
 * whole-sample Super Learner tables (CV risks, weights and, for the 1-year outcome, the CV
 * predictions used by the library toggle), and the Monte Carlo truth.
 * Writes science/capstone-data.json. Run: node scripts/capstone-precompute.cjs (about 10 s).
 * Deterministic: the same seeds give byte-identical output. */
const fs = require("fs"),
  path = require("path"),
  C = require("../science/capstone.js");
const r = (v, d) => +v.toFixed(d);
const t0 = Date.now();
const rows = C.simulate(C.N, C.SEED),
  truth = C.truth(1000000, 777),
  sl = {},
  cvY = {};
for (const target of ["y", "g", "rmst"]) {
  const s = C.superLearner(rows, target);
  sl[target] = { cvRisk: s.cvRisk.map((v) => r(v, 7)), baseRisk: r(s.baseRisk, 7), weights: s.weights.map((v) => r(v, 6)), risk: r(s.risk, 7) };
  if (target === "y") cvY.cv = s.cv.map((row) => row.map((v) => r(v, 5)));
}
const cf = C.crossfit(rows);
const out = {
  n: C.N,
  seed: C.SEED,
  tau: C.TAU,
  folds: C.V,
  learners: C.LEARNERS.map((l) => l.id),
  truth: Object.fromEntries(Object.entries(truth).map(([k, v]) => [k, k === "draws" ? v : r(v, 6)])),
  sl,
  cvY: cvY.cv,
  perFold: cf.perFold.map((f) => Object.fromEntries(Object.entries(f).map(([k, w]) => [k, w.map((v) => r(v, 4))]))),
  // Columns: m1, m0 (1-year risk under each strategy), r1, r0 (restricted mean months), g (propensity).
  preds: cf.preds.map((p) => [r(p.m1, 6), r(p.m0, 6), r(p.r1, 5), r(p.r0, 5), r(p.g, 6)]),
};
const file = process.env.CAP_OUT || path.join(__dirname, "../science/capstone-data.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} kB) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
