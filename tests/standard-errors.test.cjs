const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../science/core.js");
const E = require("../science/standard-errors.js");
const DATA = require("../science/standard-errors-data.json");
const close = (a, b, tol = 1e-9, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b} (tol ${tol})`);

test("cell-statistic AIPW reproduces core.estimate (estimate, plug-in, IF SE) in all four cases", () => {
  for (const seed of [1, 5, 77, 20260001])
    for (const preset of E.PRESETS) {
      const rows = S.generate(400, S.rng(seed)),
        a = S.estimate(rows, { preset, mode: "fitted", crossfit: false }),
        b = E.estimate(rows, preset);
      close(b.aipw, a.aipw, 1e-7, preset + " aipw");
      close(b.plugin, a.plugin, 1e-7, preset + " plugin");
      close(b.se, a.se, 1e-9, preset + " se");
    }
});

test("with a saturated nuisance fit AIPW collapses to the stratified difference", () => {
  const rows = S.generate(400, S.rng(9)),
    c = E.cells(rows),
    N = rows.length,
    strat = [0, 1].reduce(
      (s, x) => s + ((c.n[x][0] + c.n[x][1]) / N) * (c.s[x][1] / c.n[x][1] - c.s[x][0] / c.n[x][0]),
      0,
    );
  close(E.estimate(rows, "both").aipw, strat, 1e-10, "both");
  close(E.estimate(rows, "outcome").aipw, strat, 1e-10, "outcome");
  // Saturated propensity: equal up to the (a+0.5)/(n+1) smoothing, which is O(1/n).
  close(E.estimate(rows, "propensity").aipw, strat, 0.02, "propensity");
  // Both wrong: pooled g is constant and arm-mean residuals sum to zero, so AIPW = difference in means.
  const dim = (c.s[0][1] + c.s[1][1]) / (c.n[0][1] + c.n[1][1]) - (c.s[0][0] + c.s[1][0]) / (c.n[0][0] + c.n[1][0]);
  close(E.estimate(rows, "neither").aipw, dim, 1e-10, "neither");
});

test("exact limits: IF SE is right, too small, too large, right in the four cases", () => {
  const sqrtEff = Math.sqrt(S.efficiencyVariance());
  const both = E.asymptotic("both"),
    out = E.asymptotic("outcome"),
    ps = E.asymptotic("propensity"),
    nei = E.asymptotic("neither"),
    known = E.asymptotic("propensity", { knownG: true });
  close(both.ifSD, sqrtEff, 1e-12);
  close(both.trueSD, sqrtEff, 1e-12);
  assert.ok(out.ifSD < out.trueSD);
  assert.ok(ps.ifSD > ps.trueSD);
  close(nei.ifSD, nei.trueSD, 1e-12, "neither: IF variance equals the difference-in-means variance");
  close(nei.bias, 0.6385346903, 1e-8);
  // Outcome case closed form: Var tau(X) + sigma^2 (1/gbar + 1/(1-gbar)).
  const p = S.prevalence,
    gbar = (1 - p) * S.trueG(0) + p * S.trueG(1),
    tau = [0, 1].map((x) => S.trueM(x, 1) - S.trueM(x, 0)),
    vt = (1 - p) * (tau[0] - 2) ** 2 + p * (tau[1] - 2) ** 2;
  close(out.ifSD, Math.sqrt(vt + E.SIGMA2 * (1 / gbar + 1 / (1 - gbar))), 1e-12);
  // The IF SE with a fitted correct propensity estimates the known-propensity estimator's SD.
  close(ps.ifSD, known.trueSD, 1e-12);
  // Numbers quoted in the lesson (n = 400).
  close(ps.ifSD, 2.732, 5e-4);
  close(sqrtEff, 1.740, 5e-4);
  close(out.ifSD / 20, 0.081, 5e-4);
  close(ps.ifSD / 20, 0.137, 5e-4);
});

test("stacked sandwich matches the exact true SD at large n, and names the right correction", () => {
  const rows = S.generate(40000, S.rng(31)),
    rn = Math.sqrt(rows.length);
  for (const preset of E.PRESETS) {
    const sw = E.sandwich(rows, preset),
      a = E.asymptotic(preset);
    close(sw.se * rn, a.trueSD, 0.03 * a.trueSD, preset + " sandwich");
    close(sw.ifSE * rn, a.ifSD, 0.03 * a.ifSD, preset + " IF");
  }
  const o = E.sandwich(rows, "outcome"),
    p = E.sandwich(rows, "propensity");
  // Outcome right, propensity wrong: the outcome-model term does all the work.
  close(o.outcomeTermSE, o.se, 1e-3 * o.se);
  close(o.propensityTermSE, o.ifSE, 1e-3 * o.ifSE);
  // Propensity right, outcome wrong: the propensity-model term does all the work.
  close(p.propensityTermSE, p.se, 5e-3 * p.se);
  close(p.outcomeTermSE, p.ifSE, 5e-3 * p.ifSE);
});

test("bootstrap: deterministic, finite, and redraws resamples with an empty cell (boundary n)", () => {
  const rows = S.generate(400, S.rng(4)),
    a = E.bootstrap(rows, "propensity", 50, S.rng(8)),
    b = E.bootstrap(rows, "propensity", 50, S.rng(8));
  assert.deepEqual(a.reps, b.reps);
  // n = 12: many resamples miss a severity/treatment cell; every kept one is finite.
  let tiny = null;
  for (let s = 1; !tiny; s++) {
    const r = S.generate(12, S.rng(s)),
      c = E.cells(r);
    if (c.n.every((row) => row.every((v) => v > 0))) tiny = r;
  }
  for (const preset of E.PRESETS) {
    const bs = E.bootstrap(tiny, preset, 200, S.rng(3));
    assert.equal(bs.reps.length, 200);
    assert.ok(bs.reps.every(Number.isFinite), preset);
    assert.ok(Number.isFinite(bs.se) && bs.se > 0);
  }
  // Fitted propensities stay inside the [0.02, 0.98] clip even for a single-arm stratum.
  const one = [{ x: 0, a: 1, y: 1 }, { x: 0, a: 1, y: 2 }, { x: 1, a: 0, y: 0 }, { x: 1, a: 1, y: 3 }],
    f = E.fit(E.cells(one), "propensity");
  assert.ok(f.g(0) <= 0.98 && f.g(1) >= 0.02);
});

test("precomputed JSON is reproducible and matches the numbers the lesson prints", () => {
  const cfg = DATA.config;
  assert.equal(cfg.n, 400);
  assert.equal(cfg.reps, 2000);
  // First studies regenerate exactly (same seed, same streams).
  for (const preset of E.PRESETS) {
    const rows = E.experiment({ preset, n: cfg.n, reps: 12, B: 0, seed: cfg.seed, bootSeed: cfg.bootSeed });
    rows.forEach((r, i) => close(DATA.cases[preset].stream[i], Math.round(r.aipw * 1e4) / 1e4, 1e-9, preset));
    const a = E.asymptotic(preset);
    close(DATA.cases[preset].asymptotic.trueSD, Math.round((a.trueSD / 20) * 1e4) / 1e4, 1e-9);
    close(DATA.cases[preset].asymptotic.ifSD, Math.round((a.ifSD / 20) * 1e4) / 1e4, 1e-9);
    const h = DATA.cases[preset].hist;
    assert.equal(h.counts.reduce((s, v) => s + v, 0) + h.underflow + h.overflow, cfg.reps);
  }
  // Bootstrap replicate for study 0 regenerates too.
  const one = E.experiment({ preset: "propensity", n: cfg.n, reps: 1, B: cfg.B, seed: cfg.seed, bootSeed: cfg.bootSeed })[0];
  assert.ok(Math.abs(one.bootSE - one.sandwichSE) < 0.02);
  const c = DATA.cases;
  // Quoted numbers.
  assert.equal(c.propensity.summary.ifSE.toFixed(3), "0.138");
  assert.equal(c.propensity.summary.sd.toFixed(3), "0.086");
  assert.equal((c.propensity.summary.ifCoverage.rate * 100).toFixed(1), "99.8");
  assert.equal(c.outcome.summary.ifSE.toFixed(3), "0.081");
  assert.equal(c.outcome.summary.bootSE.toFixed(3), "0.087");
  assert.equal(DATA.knownPropensity.summary.sd.toFixed(3), "0.136");
  assert.equal(c.neither.summary.mean.toFixed(2), "2.64");
  // What the lesson claims qualitatively.
  for (const k of ["both", "outcome", "propensity"]) {
    for (const m of ["bootCoverage", "sandwichCoverage"])
      assert.ok(Math.abs(c[k].summary[m].rate - 0.95) < 0.015, k + " " + m);
    for (const m of ["bootSE", "sandwichSE"])
      assert.ok(Math.abs(c[k].summary[m] / c[k].summary.sd - 1) < 0.03, k + " " + m);
  }
  assert.ok(c.outcome.summary.ifCoverage.rate < 0.94);
  assert.ok(c.propensity.summary.ifCoverage.rate > 0.99);
  assert.equal(c.neither.summary.bootCoverage.rate, 0);
  // Both and outcome fits give identical estimates study by study.
  assert.deepEqual(c.both.stream, c.outcome.stream);
  // Walkthrough numbers (cross-fitting on) point the same way.
  assert.ok(DATA.crossfit.propensity.ifSE > 1.3 * DATA.crossfit.propensity.sd);
  assert.ok(DATA.crossfit.outcome.ifSE < DATA.crossfit.outcome.sd);
});
