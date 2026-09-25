#!/usr/bin/env node
/* Precompute the repeated-sampling results for lessons/20-standard-errors.html.
 * Deterministic: seeded RNG from science/core.js. Run from the repository root:
 *   node scripts/standard-errors-precompute.cjs
 * Writes science/standard-errors-data.json (about a minute of CPU). */
const fs = require("node:fs");
const path = require("node:path");
const S = require("../science/core.js");
const E = require("../science/standard-errors.js");

const CONFIG = {
  n: 400,
  reps: 2000,
  B: 500,
  seed: 20260919, // same studies as the inference lab's default run (core.simulation)
  bootSeed: 777001,
  bins: 40,
  halfWidth: 0.5, // every panel spans the same width, centred on its own mean
  stream: 300,
};
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const round = (o) =>
  JSON.parse(JSON.stringify(o, (k, v) => (typeof v === "number" ? r4(v) : v)));

function panel(est, center) {
  const lo = center - CONFIG.halfWidth,
    hi = center + CONFIG.halfWidth,
    h = S.histogram(est, CONFIG.bins, [lo, hi]);
  return { min: r4(lo), max: r4(hi), counts: h.counts, underflow: h.underflow, overflow: h.overflow };
}

const out = {
  generated: "node scripts/standard-errors-precompute.cjs",
  description:
    "AIPW in the four nuisance cases of science/core.js (fitted nuisances, no cross-fitting): IF, stacked-sandwich and nonparametric-bootstrap standard errors over repeated studies.",
  config: CONFIG,
  truth: E.TRUTH,
  cases: {},
};
const t0 = Date.now();
for (const preset of E.PRESETS) {
  const rows = E.experiment({ preset, ...CONFIG });
  const est = rows.map((r) => r.aipw),
    sum = E.summarize(rows),
    center = Math.round(sum.mean * 20) / 20;
  out.cases[preset] = {
    summary: round(sum),
    asymptotic: round(
      Object.fromEntries(
        Object.entries(E.asymptotic(preset)).map(([k, v]) => [
          k,
          k.endsWith("SD") ? v / Math.sqrt(CONFIG.n) : v,
        ]),
      ),
    ),
    hist: panel(est, center),
    stream: est.slice(0, CONFIG.stream).map(r4),
  };
  process.stderr.write(`${preset} done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}
// Same studies, propensity case, but plugging in the TRUE propensity instead of estimating it.
{
  const rows = E.experiment({ preset: "propensity", ...CONFIG, B: 0, options: { knownG: true } }),
    est = rows.map((r) => r.aipw),
    a = E.asymptotic("propensity", { knownG: true });
  out.knownPropensity = {
    summary: round(E.summarize(rows)),
    asymptotic: round({ trueSD: a.trueSD / Math.sqrt(CONFIG.n), ifSD: a.ifSD / Math.sqrt(CONFIG.n) }),
    hist: panel(est, out.cases.propensity.hist.min + CONFIG.halfWidth),
  };
}
// The walkthrough numbers came from the simulation lab with two-fold cross-fitting switched on.
out.crossfit = {};
for (const preset of E.PRESETS) {
  const r = S.simulation({ preset, mode: "fitted", crossfit: true, n: CONFIG.n, reps: CONFIG.reps, seed: CONFIG.seed });
  out.crossfit[preset] = round({
    sd: r.summary.aipw.sd,
    ifSE: r.summary.meanSE,
    coverage: r.summary.coverage,
    coverageMCSE: r.summary.coverageMCSE,
  });
}
const file = path.join(__dirname, "..", "science", "standard-errors-data.json");
fs.writeFileSync(file, JSON.stringify(out) + "\n");
process.stderr.write(`wrote ${file} (${fs.statSync(file).size} bytes)\n`);
