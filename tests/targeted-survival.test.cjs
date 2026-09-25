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

test("the influence function has mean zero at the truth", () => {
  const law = T.observedLaw();
  for (const a of [0, 1])
    for (const w of [T.weightsS(3), T.weightsS(12), T.weightsRMST(12)]) {
      const psi = T.truth(a, w);
      close(law.reduce((s, o) => s + o.p * T.eifAt(o, a, T.TRUTH_NU, w, psi), 0), 0, 1e-12);
    }
});

test("the implemented D equals the Gateaux derivative of the identification functional at every support point", () => {
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
    assert.ok(worst < 1e-6, `max |Gateaux − D| = ${worst}`);
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
  // κ scales only the censoring part: κ = 0 gives the treatment-weighted residual alone.
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

test("precomputed repeated samples show double robustness and the variance of the efficient influence function", () => {
  const [both, eventWrong, nuisWrong, neither] = DATA.configs;
  assert.deepEqual(both.spec, { event: "right", nuis: "right" });
  assert.deepEqual(neither.spec, { event: "wrong", nuis: "wrong" });
  close(DATA.truth.s1, T.truth(1, T.weightsS(12)), 1e-12);
  close(DATA.bound.s1, T.efficiencyBound(T.weightsS(12)).variance, 1e-12);
  for (const cfg of [both, eventWrong, nuisWrong])
    for (const target of ["s1", "drmst"]) {
      const o = cfg[target].onestep;
      assert.ok(Math.abs(o.bias) < 3 * o.mcse + 0.002 * (target === "drmst" ? 10 : 1), `${target} bias ${o.bias}`);
    }
  // Both working models wrong: the one-step is biased by many Monte Carlo SEs.
  assert.ok(Math.abs(neither.s1.onestep.bias) > 20 * neither.s1.onestep.mcse);
  assert.ok(Math.abs(neither.drmst.onestep.bias) > 20 * neither.drmst.onestep.mcse);
  // Plug-in fails when the event model is wrong; weighted KM fails when the weights are wrong.
  assert.ok(Math.abs(eventWrong.s1.plugin.bias) > 0.05);
  assert.ok(Math.abs(nuisWrong.s1.wkm.bias) > 0.05);
  // Repeated-sample variance of the one-step ≈ E[D²]/n when all models are right (within 15%).
  const ratio = both.s1.onestep.sd ** 2 / (DATA.bound.s1 / DATA.n);
  assert.ok(ratio > 0.85 && ratio < 1.15, `variance ratio ${ratio}`);
  // Histograms count every repeat.
  for (const cfg of DATA.configs)
    for (const target of ["s1", "drmst"])
      for (const e of ["km", "wkm", "plugin", "onestep", "tmle"])
        assert.equal(cfg[target][e].hist.reduce((s, v) => s + v, 0), DATA.reps);
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

test("with κ = 0 the blue piece telescopes to the treatment-weighted residual (1{T > τ} − S(τ|1,X))/g for uncensored patients", () => {
  const rows = T.simulate(600, 3),
    nu = T.fit(rows),
    e = T.eif(rows, 1, nu, T.weightsS(K), 0);
  rows.forEach((r, i) => {
    if (r.a !== 1 || !(r.event || r.time === K)) return;
    const expected = ((r.time === K && !r.event ? 1 : 0) - nu.S[1][r.x][K]) / nu.g[1][r.x];
    close(e.parts[i].augG, expected, 1e-12);
  });
});
