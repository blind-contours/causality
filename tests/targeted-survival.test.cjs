const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../science/targeted-survival.js");
const DATA = require("../science/targeted-survival-data.json");
const close = (a, b, tol = 1e-10, msg = "") => assert.ok(Math.abs(a - b) < tol, `${msg} ${a} != ${b}`);
const K = T.K;

test("the exact observed-data law is a probability law and identifies S_a(τ) and RMST_a(τ)", () => {
  const law = T.observedLaw();
  close(law.reduce((s, o) => s + o.p, 0), 1, 1e-12);
  for (const a of [0, 1])
    for (const tau of [1, 6, 12]) {
      close(T.psiOfLaw(law, a, T.weightsS(tau)), T.truth(a, T.weightsS(tau)), 1e-12);
      close(T.psiOfLaw(law, a, T.weightsRMST(tau)), T.truth(a, T.weightsRMST(tau)), 1e-12);
    }
  // Displayed truths (months 12): S_1 = 0.617, S_0 = 0.492, ΔRMST = 0.834 months.
  close(T.truth(1, T.weightsS(12)), 0.6171, 1e-4);
  close(T.truth(0, T.weightsS(12)), 0.4922, 1e-4);
  close(T.truth(1, T.weightsRMST(12)) - T.truth(0, T.weightsRMST(12)), 0.8342, 1e-4);
});

test("RMST in discrete time is the sum of S(s) for s < τ and equals E[min(T, τ)]", () => {
  for (const a of [0, 1]) {
    const S = T.truthCurve(a);
    // E[min(T, τ)] = Σ_t min(t, τ) P(T = t) + τ P(T > K)
    for (const tau of [1, 5, 12]) {
      let e = 0;
      for (let t = 1; t <= K; t++) e += Math.min(t, tau) * (S[t - 1] - S[t]);
      e += Math.min(K + 1, tau) * S[K];
      close(T.truth(a, T.weightsRMST(tau)), e, 1e-12);
    }
  }
});

test("the influence function ϕ has mean zero at the truth", () => {
  const law = T.observedLaw();
  for (const a of [0, 1])
    for (const w of [T.weightsS(3), T.weightsS(12), T.weightsRMST(12)]) {
      const psi = T.truth(a, w);
      close(law.reduce((s, o) => s + o.p * T.eifAt(o, a, T.TRUTH_NU, w, psi), 0), 0, 1e-12);
    }
});

test("the implemented ϕ equals the Gateaux derivative of the identification functional at every support point", () => {
  const law = T.observedLaw(),
    eps = 1e-6;
  for (const [a, w] of [
    [1, T.weightsS(12)],
    [0, T.weightsS(7)],
    [1, T.weightsRMST(9)],
  ]) {
    const psi = T.truth(a, w);
    let worst = 0;
    for (const o of law) {
      const up = law.map((q) => ({ ...q, p: (1 - eps) * q.p + (q === o ? eps : 0) })),
        down = law.map((q) => ({ ...q, p: (1 + eps) * q.p - (q === o ? eps : 0) })),
        numeric = (T.psiOfLaw(up, a, w) - T.psiOfLaw(down, a, w)) / (2 * eps);
      worst = Math.max(worst, Math.abs(numeric - T.eifAt(o, a, T.TRUTH_NU, w, psi)));
    }
    assert.ok(worst < 1e-6, `max |Gateaux − ϕ| = ${worst}`);
  }
});

test("the RMST influence function is the sum of the S(s) influence functions", () => {
  const law = T.observedLaw(),
    tau = 10;
  for (const o of law.filter((_, i) => i % 7 === 0)) {
    const lhs = T.eifAt(o, 1, T.TRUTH_NU, T.weightsRMST(tau), T.truth(1, T.weightsRMST(tau)));
    let rhs = 0;
    for (let s = 1; s < tau; s++) rhs += T.eifAt(o, 1, T.TRUTH_NU, T.weightsS(s), T.truth(1, T.weightsS(s)));
    close(lhs, rhs, 1e-12);
  }
});

test("boundary cases: S(0) and RMST(1) are the constant 1 with a zero influence function", () => {
  const rows = T.simulate(300, 11),
    nu = T.fit(rows);
  for (const w of [T.weightsS(0), T.weightsRMST(1)]) {
    const e = T.eif(rows, 1, nu, w);
    close(e.est, 1, 1e-12);
    assert.ok(e.D.every((d) => Math.abs(d) < 1e-12));
  }
});

test("with no censoring weight (G = 1) the censoring part of the augmentation vanishes", () => {
  const rows = T.simulate(400, 5),
    nu = T.fit(rows),
    flat = T.derive({ ...nu, hc: nu.hc.map((arm) => arm.map((r) => r.map(() => 0))) }),
    e = T.eif(rows, 1, flat, T.weightsS(12));
  assert.ok(e.parts.every((p) => Math.abs(p.augC) < 1e-14));
  // cw scales only the censoring part: cw = 0 gives the treatment-weighted residual alone.
  const e0 = T.eif(rows, 1, nu, T.weightsS(12), 0);
  e0.parts.forEach((p) => close(p.augC, 0, 1e-12));
});

test("IPTW + IPCW weighted KM and the g-formula recover the truth from exact expected counts; plain KM does not", () => {
  const law = T.observedLaw(),
    n = 1e6,
    z = () => [0, 1].map(() => [0, 1, 2].map(() => new Array(K + 1).fill(0))),
    c = { atRisk: z(), events: z() };
  for (const o of law) {
    for (let t = 1; t <= o.time; t++) c.atRisk[o.a][o.x][t] += n * o.p;
    if (o.event) c.events[o.a][o.x][o.time] += n * o.p;
  }
  for (const a of [0, 1]) {
    const w = T.weightedKM(c, a, T.TRUTH_NU),
      km = T.kmArm(c, a),
      truth = T.truthCurve(a);
    for (let t = 0; t <= K; t++) close(w[t], truth[t], 1e-12);
    assert.ok(Math.abs(km[K] - truth[K]) > 0.05, "unadjusted KM is biased in this world");
  }
});

test("the displayed study (seed 20260925, n = 1000) gives the lesson's numbers; one-step, TMLE and R agree", () => {
  const r = T.analyze({ n: 1000, seed: 20260925, tau: 12 }),
    a1 = r.arms[1],
    a0 = r.arms[0];
  // Cross-checked with glm() and the one-step formula in R 4.3 on the same rows: 0.6223927, SE 0.02853714.
  close(a1.sTau.est, 0.6223927, 1e-6);
  close(a1.sTau.se, 0.02853714, 1e-7);
  close(a1.sTau.plugin, 0.6311694, 1e-6);
  close(a1.km[12], 0.519, 1e-3);
  close(a1.wkm[12], 0.622, 1e-3);
  // The step-1 note: one-step, TMLE and weighted KM agree because the right models are saturated in (A, X);
  // all sit next to the stratified (nonparametric) KM standardization.
  close(a1.sTauTmle.est, 0.6224, 1e-4);
  close(a1.wkm[12], 0.6225, 1e-4);
  close(T.stratifiedKM(r.counts, 1)[12], 0.6219, 1e-4);
  assert.ok(Math.abs(a1.sTauTmle.est - a1.sTau.est) < 1e-4);
  // With partly wrong weights (censoring coded high vs not, propensity mid+high merged) they separate.
  const nuP = T.fit(r.rows, { event: "right", cens: "high", prop: "merge" }, r.counts),
    osP = T.eif(r.rows, 1, nuP, T.weightsS(12)).est,
    tmP = T.tmle(r.rows, 1, nuP, T.weightsS(12), r.counts).est,
    wkP = T.weightedKM(r.counts, 1, nuP)[12];
  close(osP, 0.6236, 1e-4);
  close(tmP, 0.6231, 1e-4);
  close(wkP, 0.6009, 1e-4);
  assert.ok(Math.abs(tmP - osP) > 3e-4 && Math.abs(wkP - osP) > 0.02);
  // TMLE solves the efficient score equation and lands next to the one-step estimate.
  assert.ok(Math.abs(a1.sTauTmle.residual) <= 1e-4 * a1.sTauTmle.se);
  close(a1.sTauTmle.est, a1.sTau.est, 1e-3);
  const d = T.contrast(a1.rmst, a0.rmst);
  close(d.est, 1.074, 1e-3);
  close(d.se, 0.251, 1e-3);
  // Cox (Breslow ties) matches survival::coxph(ties = "breslow") in R.
  close(T.cox(r.rows, (o) => [o.a]).beta[0], 0.1251485, 1e-6);
  const adj = T.cox(r.rows, (o) => [o.a, +(o.x === 1), +(o.x === 2)]);
  close(adj.beta[0], -0.4421879, 1e-6);
  close(adj.se, 0.1167224, 1e-6);
});

test("pooled logistic fit on grouped counts reproduces the fitted hazards from R glm()", () => {
  const r = T.analyze({ n: 1000, seed: 20260925, tau: 12 });
  close(r.nu.lam[1][2][1], 0.08495573, 1e-7);
  close(r.nu.lam[1][2][2], 0.06048229, 1e-7);
  close(r.nu.lam[1][2][3], 0.05895237, 1e-7);
});

const cfg = (event, cens, prop) => DATA.configs.find((c) => c.spec.event === event && c.spec.cens === cens && c.spec.prop === prop);

test("precomputed repeated samples: 36 seeded configurations, double robustness and the variance of ϕ", () => {
  assert.equal(DATA.configs.length, 36);
  close(DATA.truth.s1, T.truth(1, T.weightsS(12)), 1e-12);
  close(DATA.bound.s1, T.efficiencyBound(T.weightsS(12)).variance, 1e-12);
  // Consistent whenever the event model is right, or the censoring and propensity models are both right.
  for (const c of DATA.configs) {
    const ok = c.spec.event === "right" || (c.spec.cens === "right" && c.spec.prop === "right");
    if (!ok) continue;
    for (const target of ["s1", "drmst"])
      for (const e of ["onestep", "tmle"]) {
        const o = c[target][e];
        assert.ok(Math.abs(o.bias) < 3.5 * o.mcse + 0.003 * (target === "drmst" ? 10 : 1), `${JSON.stringify(c.spec)} ${target} ${e} bias ${o.bias}`);
      }
  }
  // The extreme case: every model leaves severity out, and every estimator collapses to the unadjusted KM.
  const worst = cfg("drop", "drop", "drop");
  for (const e of ["wkm", "onestep", "tmle"]) close(worst.s1[e].mean, worst.s1.km.mean, 2e-3, e);
  assert.ok(Math.abs(worst.s1.onestep.bias) > 20 * worst.s1.onestep.mcse);
  assert.ok(Math.abs(worst.drmst.onestep.bias) > 20 * worst.drmst.onestep.mcse);
  // Partial misspecification is not the unadjusted KM: the biases are smaller and differ by estimator.
  const evPart = cfg("noint", "right", "right").s1, wPart = cfg("right", "high", "merge").s1;
  assert.ok(Math.abs(evPart.plugin.bias) > 5 * evPart.plugin.mcse && Math.abs(evPart.plugin.bias) < 0.03, `noint plug-in ${evPart.plugin.bias}`);
  assert.ok(Math.abs(wPart.wkm.bias) > 10 * wPart.wkm.mcse && Math.abs(wPart.wkm.bias) < 0.06, `partial weights wkm ${wPart.wkm.bias}`);
  assert.ok(Math.abs(cfg("notime", "right", "right").s1.plugin.bias) > 5 * cfg("notime", "right", "right").s1.plugin.mcse);
  assert.ok(Math.abs(cfg("right", "high", "right").s1.wkm.bias) > 4 * cfg("right", "high", "right").s1.wkm.mcse);
  assert.ok(Math.abs(cfg("right", "right", "merge").s1.wkm.bias) > 10 * cfg("right", "right", "merge").s1.wkm.mcse);
  // Both sides partly wrong: the one-step bias is a product of errors, smaller than either single-model estimator's (the lesson says so).
  const both = cfg("noint", "high", "merge").s1;
  assert.ok(Math.abs(both.onestep.bias) < Math.abs(both.plugin.bias) && Math.abs(both.onestep.bias) < Math.abs(both.wkm.bias));
  // Where the estimators separate: with every model right TMLE and the weighted KM sit on the one-step;
  // with partly wrong weights the weighted KM moves away and TMLE drifts a little.
  const right = cfg("right", "right", "right");
  assert.ok(right.s1.gap.tmle < 2e-4 && right.s1.gap.wkm < 3e-3, JSON.stringify(right.s1.gap));
  assert.ok(wPart.gap.wkm > 5 * right.s1.gap.wkm && wPart.gap.tmle > 2 * right.s1.gap.tmle, JSON.stringify(wPart.gap));
  // Repeated-sample variance of the one-step ≈ E[ϕ²]/n when all models are right (within 15%).
  const ratio = right.s1.onestep.sd ** 2 / (DATA.bound.s1 / DATA.n);
  assert.ok(ratio > 0.85 && ratio < 1.15, `variance ratio ${ratio}`);
  // Histograms count every repeat; coverages are proportions.
  for (const c of DATA.configs)
    for (const target of ["s1", "drmst"])
      for (const e of ["km", "wkm", "plugin", "onestep", "tmle"]) {
        assert.equal(c[target][e].hist.reduce((s, v) => s + v, 0), DATA.reps);
        assert.ok(c[target][e].oracleCoverage >= 0 && c[target][e].oracleCoverage <= 1);
      }
});

test("the precompute is deterministic: study r uses seed seed0 + r in every configuration", () => {
  // Re-create the first study of the all-right configuration and check its one-step lands in the stored histogram range.
  const rows = T.simulate(DATA.n, DATA.seed0),
    est = T.eif(rows, 1, T.fit(rows), T.weightsS(12)).est,
    [a, b] = DATA.domain.s1;
  assert.ok(est > a && est < b);
  // Unadjusted KM does not depend on any model, so it is identical across all 36 configurations.
  for (const c of DATA.configs) assert.deepEqual(c.s1.km, DATA.configs[0].s1.km);
});

test("a small fresh repeated-sample check: one-step SD ≈ √(E[D²]/n)", () => {
  const n = 500,
    w = T.weightsS(12),
    est = [];
  for (let r = 0; r < 150; r++) {
    const rows = T.simulate(n, 90000 + r);
    est.push(T.eif(rows, 1, T.fit(rows), w).est);
  }
  const m = est.reduce((s, v) => s + v, 0) / est.length,
    sd = Math.sqrt(est.reduce((s, v) => s + (v - m) ** 2, 0) / (est.length - 1)),
    target = Math.sqrt(T.efficiencyBound(w).variance / n);
  assert.ok(Math.abs(m - T.truth(1, w)) < 4 * (sd / Math.sqrt(est.length)), "unbiased within Monte Carlo error");
  assert.ok(sd / target > 0.8 && sd / target < 1.25, `sd ratio ${sd / target}`);
});

test("with no censoring weight applied (cw = 0) the blue piece telescopes to the treatment-weighted residual (1{T > τ} − S(τ|1,X))/g for uncensored patients", () => {
  const rows = T.simulate(600, 3),
    nu = T.fit(rows),
    e = T.eif(rows, 1, nu, T.weightsS(K), 0);
  rows.forEach((r, i) => {
    if (r.a !== 1 || !(r.event || r.time === K)) return;
    const expected = ((r.time === K && !r.event ? 1 : 0) - nu.S[1][r.x][K]) / nu.g[1][r.x];
    close(e.parts[i].augG, expected, 1e-12);
  });
});

/* Expected counts from the exact observed-data law (n = 1e6), including censoring risk sets and (A, X) sizes. */
function lawCounts(n = 1e6) {
  const z = () => [0, 1].map(() => [0, 1, 2].map(() => new Array(K + 1).fill(0))),
    c = { atRisk: z(), events: z(), cRisk: z(), cens: z(), nAX: [0, 1].map(() => [0, 0, 0]), n };
  for (const o of T.observedLaw()) {
    const m = n * o.p;
    c.nAX[o.a][o.x] += m;
    for (let t = 1; t <= o.time; t++) c.atRisk[o.a][o.x][t] += m;
    if (o.event) c.events[o.a][o.x][o.time] += m;
    for (let t = 1; t < K && t <= o.time; t++) if (t < o.time || !o.event) c.cRisk[o.a][o.x][t] += m;
    if (!o.event && o.time < K) c.cens[o.a][o.x][o.time] += m;
  }
  return c;
}

test("on the exact law, the 'right' models recover the true hazards and every partial model does not", () => {
  const c = lawCounts(),
    maxDiff = (fitted, f) => {
      let d = 0;
      for (const a of [0, 1]) for (const x of [0, 1, 2]) for (let t = 1; t < K; t++) d = Math.max(d, Math.abs(fitted[a][x][t] - f(t, a, x)));
      return d;
    };
  assert.ok(maxDiff(T.fitHazard(c, "event", "right"), T.TRUE.lambda) < 1e-6);
  assert.ok(maxDiff(T.fitHazard(c, "censor", "right"), T.TRUE.censor) < 1e-6);
  for (const spec of ["noint", "notime", "drop"]) assert.ok(maxDiff(T.fitHazard(c, "event", spec), T.TRUE.lambda) > 1e-3, spec);
  for (const spec of ["high", "drop"]) assert.ok(maxDiff(T.fitHazard(c, "censor", spec), T.TRUE.censor) > 1e-3, spec);
  const g = (spec) => T.fitG(c, spec)[1];
  [0, 1, 2].forEach((x) => close(g("right")[x], T.TRUE.g1(x), 1e-12));
  assert.ok(Math.abs(g("merge")[2] - T.TRUE.g1(2)) > 0.05 && Math.abs(g("merge")[0] - T.TRUE.g1(0)) < 1e-12);
  // Old spec names still work: "wrong" means "drop", and nuis sets both censoring and propensity.
  assert.deepEqual(T.normSpec({ event: "wrong", nuis: "wrong" }), { event: "drop", cens: "drop", prop: "drop" });
  assert.deepEqual(T.normSpec({}), { event: "right", cens: "right", prop: "right" });
});

test("stratified KM standardization equals the truth on the exact law (nonparametric identification)", () => {
  const c = lawCounts();
  for (const a of [0, 1]) {
    const s = T.stratifiedKM(c, a), truth = T.truthCurve(a);
    for (let t = 0; t <= K; t++) close(s[t], truth[t], 1e-12);
  }
});
