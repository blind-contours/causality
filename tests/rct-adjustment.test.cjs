const { test } = require("node:test");
const assert = require("node:assert/strict");
const R = require("../science/rct-adjustment.js");
const S = require("../science/core.js");
const DATA = require("../science/rct-adjustment.json");
const close = (a, b, tol = 1e-10, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b} (tol ${tol})`);

test("OLS and logistic fits match closed forms", () => {
  const x = [0, 1, 2, 3, 4], y = [1, 3, 2, 5, 4];
  const f = R.ols(x.map((v) => [1, v]), y);
  const mx = 2, my = 3,
    b = x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / x.reduce((s, v) => s + (v - mx) ** 2, 0);
  close(f.beta[1], b); close(f.beta[0], my - b * mx);
  // Saturated logistic on a 2x2 table reproduces the cell log odds.
  const rows = [], yy = [];
  const cells = [[0, 30, 70], [1, 60, 40]];
  for (const [a, ev, non] of cells) {
    for (let i = 0; i < ev; i++) { rows.push([1, a]); yy.push(1); }
    for (let i = 0; i < non; i++) { rows.push([1, a]); yy.push(0); }
  }
  const L = R.logistic(rows, yy);
  assert.ok(L.converged);
  close(L.beta[0], Math.log(30 / 70), 1e-9); close(L.beta[1], Math.log((60 / 40) / (30 / 70)), 1e-9);
});

test("standardization with an intercept per arm equals AIPW with the known propensity", () => {
  const random = S.rng(99);
  for (const model of ["linear", "quadratic", "sign"])
    for (const pi of [0.25, 0.5, 0.75]) {
      const d = R.trial({ r2: 0.6, curve: 0.5, pi, het: 1 }, random),
        s = R.standardized(d, model);
      close(s.est, s.aipw, 1e-9, model);
      close(s.pi, Math.round(200 * pi) / 200, 1e-12, "complete randomization fixes n1");
    }
  // Binary: logistic MLE with intercept and arm has residuals summing to zero within each arm.
  const b = R.binaryAnalyses(R.binaryTrial({ n: 400, gap: 2, logOR: Math.log(3) }, S.rng(5)));
  assert.ok(b.converged);
  close(b.standardizedRD, b.aipwRD, 1e-8);
});

test("boundary: with no covariate, standardization is the difference in means and its SE is Welch's", () => {
  const d = R.trial({ r2: 0.5 }, S.rng(3)),
    u = R.unadjusted(d),
    s = R.standardized(d, "none"),
    k = R.ancova(d, "none");
  close(s.est, u.est, 1e-12);
  close(s.se, u.se, 1e-12, "df-corrected influence-function SE equals the Welch SE");
  close(k.est, u.est, 1e-12, "ANCOVA without covariates is the difference in means");
});

test("influence-function SE: cross terms vanish, so the df-free version equals sd(phi)/sqrt(n)", () => {
  const d = R.trial({ r2: 0.5, het: 1, pi: 0.25 }, S.rng(11)),
    s = R.standardized(d, "linear"),
    n = d.y.length;
  close(R.mean(s.phi), 0, 1e-10);
  close(s.seRaw, Math.sqrt(R.sum(s.phi.map((v) => v * v))) / n, 1e-12);
  assert.ok(s.se > s.seRaw, "degrees-of-freedom factor inflates the SE");
});

test("precision bookkeeping: n R²/(1 − R²), captured R² of each working model", () => {
  close(R.extraPatients(200, 0.5), 200);
  close(R.extraPatients(200, 0), 0);
  assert.equal(R.extraPatients(200, 1), Infinity);
  close(R.capturedR2("quadratic", 0.6, 0.5), 0.6);
  close(R.capturedR2("linear", 0.6, 1), 0);
  close(R.capturedR2("sign", 0.6, 0), (0.6 * 2) / Math.PI);
  // Check the sign model's 2/π and the linear share by fitting in one very large sample.
  const random = S.rng(1234), n = 200000, x = [], f = [];
  for (let i = 0; i < n; i++) { const v = S.randn(random); x.push(v); f.push(R.prognostic(v, 0.6, 0.5)); }
  close(R.variance(f), 0.6, 0.01, "Var f(X) = r2");
  for (const model of ["linear", "sign", "quadratic"]) {
    const fit = R.ols(R.featureRows(x, model), f),
      pred = R.featureRows(x, model).map(fit.predict);
    close(R.variance(pred), R.capturedR2(model, 0.6, 0.5), 0.01, model);
  }
});

test("non-collapsibility: exact odds ratios, with the collapsible boundary cases", () => {
  const W = R.binaryWorld({ base: 0.2, gap: 2.5, logOR: Math.log(3) });
  close(W.strata[0].or, 3, 1e-12); close(W.strata[1].or, 3, 1e-12);
  close(W.strata[0].risk1, 3 / 7, 1e-12, "odds 0.25 x 3 = 0.75");
  close(W.marginalOR, 2.1813, 1e-4); close(W.marginalRD, 0.18855, 1e-5);
  assert.ok(W.marginalOR < W.conditionalOR && W.marginalOR > 1);
  for (const or of [1.5, 2, 3, 5]) {
    close(R.binaryWorld({ gap: 0, logOR: Math.log(or) }).marginalOR, or, 1e-12, "gap 0 collapses");
    for (const gap of [0.5, 1.5, 3]) {
      const w = R.binaryWorld({ gap, logOR: Math.log(or) });
      assert.ok(w.marginalOR < or - 1e-6, "strictly attenuated toward 1");
    }
  }
  close(R.binaryWorld({ gap: 3, logOR: 0 }).marginalOR, 1, 1e-12, "null effect collapses");
});

test("precomputed JSON matches the kernels (spot regeneration)", () => {
  const G = R.GRID;
  assert.deepEqual(DATA.grid, JSON.parse(JSON.stringify(G)));
  assert.deepEqual(DATA.ladder, R.ladder());
  assert.deepEqual(DATA.adjust.find((e) => e.r2 === 0.5), R.precomputeAdjust(0.5));
  assert.deepEqual(DATA.se.find((e) => e.pi === 0.25 && e.het === 1.5), R.precomputeSE(0.25, 1.5));
  assert.deepEqual(DATA.binary.find((e) => e.gap === 2.5 && e.or === 3), R.precomputeBinary(2.5, 3));
  assert.deepEqual(DATA.procova.find((e) => e.nHist === 20), R.precomputeProcova(20));
  assert.equal(DATA.adjust.length, G.r2.length);
  assert.equal(DATA.curve.length, G.curve.length * G.models.length);
  assert.equal(DATA.se.length, G.pi.length * G.het.length);
  assert.equal(DATA.binary.length, G.binaryGap.length * G.binaryOR.length);
});

test("the single trial drawn live is the first trial of the precomputed repeats", () => {
  const first = R.repeatTrials({ r2: 0.5 }, 1, R.GRID.seed),
    live = R.standardized(R.trial({ r2: 0.5 }, S.rng(R.GRID.seed)), "linear");
  close(first.adj[0], live.est, 1e-12);
});

test("displayed claims hold in the precomputed grid", () => {
  const all = [
    ...DATA.adjust.flatMap((e) => [e.unadjusted, e.standardized]),
    ...DATA.curve.flatMap((e) => [e.unadjusted, e.standardized]),
    ...DATA.se.flatMap((e) => [e.unadjusted, e.standardized, e.ancova]),
  ];
  for (const s of all) assert.ok(Math.abs(s.bias) <= 2.5 * s.mcse, "centered within Monte Carlo error");
  // Step 1: the unadjusted SD is about sqrt(4/n) SD units (8.5 m).
  const a5 = DATA.adjust.find((e) => e.r2 === 0.5);
  close(a5.unadjusted.sd, Math.sqrt(4 / 200), 0.005);
  // Step 2: simulated variance ratio within 6% of the large-sample 1/(1 − R²).
  for (const e of DATA.adjust)
    assert.ok(Math.abs(e.varianceRatio * (1 - e.r2) - 1) < 0.06, `r2 ${e.r2}`);
  assert.equal(a5.theoryExtra, 200);
  // Step 3: the correct model keeps the full gain; a model capturing nothing gains nothing.
  for (const e of DATA.curve.filter((e) => e.model === "quadratic")) assert.ok(e.extraPatients > 270);
  for (const e of DATA.curve.filter((e) => e.curve === 1 && e.model !== "quadratic"))
    assert.ok(Math.abs(e.extraPatients) < 15);
  // Step 5: influence-function coverage near 95% everywhere; model-based ANCOVA fails off 1:1 with heterogeneity.
  for (const e of DATA.se) {
    assert.ok(e.standardized.coverage > 0.935 && e.standardized.coverage < 0.96, `IF ${e.pi} ${e.het}`);
    if (e.pi === 0.5) assert.ok(e.ancova.coverage > 0.935, "1:1 ANCOVA stays valid");
  }
  const bad = DATA.se.find((e) => e.pi === 0.25 && e.het === 1.5);
  assert.ok(bad.ancova.coverage < 0.9 && bad.ancova.sd > bad.ancova.meanSE * 1.2);
  // Step 4: logistic coefficient targets the conditional OR, standardization the marginal OR.
  for (const e of DATA.binary.filter((e) => e.gap >= 1.5)) {
    const W = R.binaryWorld({ gap: e.gap, logOR: Math.log(e.or) });
    assert.ok(Math.abs(Math.log(e.conditionalOR / e.or)) < 0.06, `conditional ${e.gap} ${e.or}`);
    assert.ok(Math.abs(Math.log(e.standardizedOR / W.marginalOR)) < 0.04, `marginal ${e.gap} ${e.or}`);
    assert.ok(e.standardizedRD.sd < e.unadjustedRD.sd);
  }
  // Step 6: the learned score improves with history, never biases, and beats raw covariates with enough history.
  const p = DATA.procova;
  for (let i = 1; i < p.length; i++) assert.ok(p[i].score.extraPatients > p[i - 1].score.extraPatients);
  assert.ok(p[0].score.extraPatients < p[0].all.extraPatients);
  assert.ok(p.at(-1).score.extraPatients > 2 * p.at(-1).all.extraPatients);
  for (const e of p) for (const k of ["unadj", "all", "score", "oracle"])
    assert.ok(Math.abs(e[k].bias) <= 2.5 * e[k].mcse && Math.abs(e[k].coverage - 0.95) < 0.02);
});
