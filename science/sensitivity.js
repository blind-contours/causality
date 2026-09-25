/* Sensitivity to unmeasured confounding. Exact formulas plus one seeded teaching study.
 *
 * Bias factor (Ding & VanderWeele 2016, Epidemiology 27:368-377):
 *   B(RR_EU, RR_UD) = RR_EU * RR_UD / (RR_EU + RR_UD - 1),  both arguments >= 1.
 * For an observed risk ratio RR > 1 the true RR is at least RR / B; for RR < 1 relabel the
 * exposure, so the true RR is at most RR * B. "Explained away" means the bound reaches 1.
 * E-value (VanderWeele & Ding 2017, Ann Intern Med 167:268-274):
 *   E(RR) = RR + sqrt(RR (RR - 1)) for RR >= 1, and E(1/RR) for RR < 1.
 * It is the common value E with B(E, E) = RR (for RR >= 1), the diagonal point of the
 * curve B = RR. For an interval, use the limit closest to 1; an interval that
 * contains 1 has E-value 1.
 *
 * Teaching study (simulated, seeded): four binary baseline covariates generated
 * independently; treatment from a logistic model; one-year event risk log-linear in the
 * covariates with a constant conditional treatment risk ratio TRUE_RR. Standardization over
 * the 16 covariate cells estimates the marginal risks; its influence function gives the
 * delta-method interval for log RR and for the risk difference. */
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.CausalScience;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalSensitivity = api;
})(typeof self !== "undefined" ? self : globalThis, function (core) {
  "use strict";
  const Z = 1.959963984540054;
  const check = (x, name) => {
    if (!(Number.isFinite(x) && x >= 1))
      throw new RangeError(name + " must be a finite number >= 1");
  };
  function biasFactor(rrEU, rrUD) {
    check(rrEU, "RR_EU");
    check(rrUD, "RR_UD");
    return (rrEU * rrUD) / (rrEU + rrUD - 1);
  }
  // Put a ratio on the >= 1 side, so one formula serves harmful and protective estimates.
  function awayFromNull(rr) {
    if (!(Number.isFinite(rr) && rr > 0))
      throw new RangeError("A risk ratio must be positive");
    return rr >= 1 ? rr : 1 / rr;
  }
  function eValue(rr) {
    const r = awayFromNull(rr);
    return r + Math.sqrt(r * (r - 1));
  }
  // E-value for the confidence limit closest to 1; 1 when the interval already contains 1.
  function eValueCI(lo, hi) {
    if (!(lo > 0 && hi >= lo)) throw new RangeError("Need 0 < lower <= upper");
    if (lo <= 1 && hi >= 1) return 1;
    return eValue(lo > 1 ? lo : hi);
  }
  // The RR_UD on the curve B(RR_EU, RR_UD) = target, for a given RR_EU > target.
  function contourUD(rrEU, target) {
    check(target, "target");
    if (!(rrEU > target)) return Infinity;
    return (target * (rrEU - 1)) / (rrEU - target);
  }
  // Move an estimate and its interval toward the null by a bias factor B (the worst case).
  function adjust(rr, lo, hi, B) {
    check(B, "B");
    const f = rr >= 1 ? 1 / B : B;
    return { rr: rr * f, lo: lo * f, hi: hi * f };
  }
  const explainsPoint = (rr, B) => B >= awayFromNull(rr);
  const explainsCI = (lo, hi, B) =>
    (lo <= 1 && hi >= 1) || B >= awayFromNull(lo > 1 ? lo : hi);

  /* Additive bias kappa on a difference scale (the lesson-one parameter). */
  function kappaBand(est, lo, hi, kappa) {
    if (!(kappa >= 0)) throw new RangeError("kappa must be >= 0");
    return {
      point: [est - kappa, est + kappa],
      interval: [lo - kappa, hi + kappa],
    };
  }
  const kappaToNull = (est) => Math.abs(est);
  const kappaToCI = (lo, hi) =>
    lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi));

  /* ---------- teaching study ---------- */
  const COVARIATES = Object.freeze([
    // name, prevalence, log-odds effect on treatment, risk multiplier for the one-year event
    { key: "severity", label: "Severity", prev: 0.35, gA: 1.2, rr: 2.4 },
    { key: "age", label: "Age 75+", prev: 0.3, gA: 0.5, rr: 1.6 },
    { key: "diabetes", label: "Diabetes", prev: 0.25, gA: 0.3, rr: 1.5 },
    { key: "female", label: "Female", prev: 0.5, gA: -0.15, rr: 0.9 },
  ]);
  const DESIGN = Object.freeze({
    n: 4000,
    seed: 20260908,
    g0: -1.2, // treatment log-odds when every covariate is 0
    base: 0.05, // one-year risk under control when every covariate is 0
    TRUE_RR: 1.5, // constant conditional risk ratio of treatment
  });
  const K = COVARIATES.length,
    CELLS = 1 << K,
    bit = (c, j) => (c >> j) & 1;
  const propensity = (c) =>
    core.expit(
      DESIGN.g0 + COVARIATES.reduce((s, v, j) => s + v.gA * bit(c, j), 0),
    );
  const risk = (c, a) =>
    DESIGN.base *
    COVARIATES.reduce((s, v, j) => s * (bit(c, j) ? v.rr : 1), 1) *
    (a ? DESIGN.TRUE_RR : 1);
  function simulate(n = DESIGN.n, seed = DESIGN.seed) {
    const random = core.rng(seed),
      rows = [];
    for (let i = 0; i < n; i++) {
      let c = 0;
      COVARIATES.forEach((v, j) => {
        if (random() < v.prev) c |= 1 << j;
      });
      const a = +(random() < propensity(c)),
        y = +(random() < risk(c, a));
      rows.push({ c, a, y });
    }
    return rows;
  }
  // Standardized risks over the cells of the covariates in `mask` (bit j set = adjust for j).
  function standardize(rows, mask = CELLS - 1) {
    const n = rows.length,
      cell = (c) => c & mask,
      t = new Map();
    for (const r of rows) {
      const k = cell(r.c);
      if (!t.has(k)) t.set(k, { n: 0, n1: 0, y1: 0, y0: 0 });
      const s = t.get(k);
      s.n++;
      if (r.a) {
        s.n1++;
        s.y1 += r.y;
      } else s.y0 += r.y;
    }
    for (const s of t.values()) {
      if (s.n1 === 0 || s.n1 === s.n)
        throw new Error("A covariate cell has no treated or no control patient");
      s.g = s.n1 / s.n;
      s.m1 = s.y1 / s.n1;
      s.m0 = s.y0 / (s.n - s.n1);
    }
    let p1 = 0,
      p0 = 0;
    for (const s of t.values()) {
      p1 += (s.n / n) * s.m1;
      p0 += (s.n / n) * s.m0;
    }
    // Influence functions of the two standardized risks (saturated-model AIPW = standardization).
    let vRR = 0,
      vRD = 0;
    for (const r of rows) {
      const s = t.get(cell(r.c)),
        d1 = (r.a / s.g) * (r.y - s.m1) + s.m1 - p1,
        d0 = ((1 - r.a) / (1 - s.g)) * (r.y - s.m0) + s.m0 - p0;
      vRR += (d1 / p1 - d0 / p0) ** 2;
      vRD += (d1 - d0) ** 2;
    }
    const seLog = Math.sqrt(vRR / n) / Math.sqrt(n),
      seRD = Math.sqrt(vRD / n) / Math.sqrt(n),
      rr = p1 / p0,
      rd = p1 - p0;
    return {
      p1,
      p0,
      rr,
      rrLo: rr * Math.exp(-Z * seLog),
      rrHi: rr * Math.exp(Z * seLog),
      seLog,
      rd,
      rdLo: rd - Z * seRD,
      rdHi: rd + Z * seRD,
      seRD,
    };
  }
  const cellProb = (c) =>
    COVARIATES.reduce((s, v, j) => s * (bit(c, j) ? v.prev : 1 - v.prev), 1);
  /* Benchmark strength of measured covariate j on the Ding-VanderWeele scale, conditional on
   * the other measured covariates C and taken as the maximum over the strata of C, computed
   * exactly in the teaching population (not estimated from the sample):
   *   RR_AX = max_c max_k P(X=k | A=1, c) / P(X=k | A=0, c)
   *   RR_XY = max_c max_a max_k P(Y | a, X=k, c) / min_k P(Y | a, X=k, c)
   * With protective = true the treatment labels are swapped (for an observed RR < 1). */
  function benchmark(j, protective = false) {
    const p = COVARIATES[j].prev,
      one = 1 << j;
    let rrAX = 1,
      rrXY = 1;
    for (let c = 0; c < CELLS; c++) {
      if (c & one) continue;
      const g0 = propensity(c),
        g1 = propensity(c | one),
        // P(X=1 | A=a, c)
        x1 = [
          (p * (1 - g1)) / (p * (1 - g1) + (1 - p) * (1 - g0)),
          (p * g1) / (p * g1 + (1 - p) * g0),
        ],
        [e, u] = protective ? [0, 1] : [1, 0];
      rrAX = Math.max(rrAX, x1[e] / x1[u], (1 - x1[e]) / (1 - x1[u]));
      for (const a of [0, 1]) {
        const r0 = risk(c, a),
          r1 = risk(c | one, a);
        rrXY = Math.max(rrXY, Math.max(r0, r1) / Math.min(r0, r1));
      }
    }
    return { rrAX, rrXY, B: biasFactor(rrAX, rrXY) };
  }
  // Exact population standardized RR adjusting only for the covariates in mask.
  function populationRR(mask = CELLS - 1) {
    const num = [new Map(), new Map()],
      den = [new Map(), new Map()],
      pc = new Map();
    for (let c = 0; c < CELLS; c++) {
      const k = c & mask,
        w = cellProb(c);
      pc.set(k, (pc.get(k) || 0) + w);
      for (const a of [0, 1]) {
        const wa = w * (a ? propensity(c) : 1 - propensity(c));
        num[a].set(k, (num[a].get(k) || 0) + wa * risk(c, a));
        den[a].set(k, (den[a].get(k) || 0) + wa);
      }
    }
    const p = [0, 1].map((a) =>
      [...pc].reduce((s, [k, w]) => s + (w * num[a].get(k)) / den[a].get(k), 0),
    );
    return p[1] / p[0];
  }
  let cached = null;
  function study() {
    if (cached) return cached;
    const rows = simulate(),
      full = standardize(rows),
      crude = standardize(rows, 0),
      covariates = COVARIATES.map((v, j) => ({
        key: v.key,
        label: v.label,
        ...benchmark(j, full.rr < 1),
        // Estimate if this covariate had not been measured (adjusting for the other three).
        omitted: standardize(rows, (CELLS - 1) & ~(1 << j)),
      }));
    const treated = rows.reduce((s, r) => s + r.a, 0),
      events = rows.reduce((s, r) => s + r.y, 0);
    cached = {
      n: rows.length,
      treated,
      events,
      full,
      crude,
      covariates,
      eValue: eValue(full.rr),
      eValueCI: eValueCI(full.rrLo, full.rrHi),
    };
    return cached;
  }
  return {
    Z,
    biasFactor,
    awayFromNull,
    eValue,
    eValueCI,
    contourUD,
    adjust,
    explainsPoint,
    explainsCI,
    kappaBand,
    kappaToNull,
    kappaToCI,
    COVARIATES,
    DESIGN,
    propensity,
    risk,
    simulate,
    standardize,
    cellProb,
    benchmark,
    populationRR,
    study,
  };
});
