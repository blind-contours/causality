/* Standard errors for the AIPW estimator of the four nuisance cases in science/core.js
 * (generate / estimate, fitted nuisances, no cross-fitting).
 *
 * The study has a binary covariate X and binary treatment A, so every fitted nuisance and the
 * AIPW estimate depend on the data only through per-cell counts, sums and sums of squares of Y.
 * That makes a nonparametric bootstrap cheap: resample patients, recompute the cells, refit both
 * nuisance models, re-estimate. fromCells() reproduces CausalScience.estimate() (tested).
 *
 * Three standard errors:
 *   ifSE       sd of the estimated influence-function values / sqrt(n), nuisances treated as fixed
 *              (exactly what estimate().se returns)
 *   sandwich   stacked estimating equations (outcome OLS, propensity proportions, AIPW mean):
 *              the influence function gains D_beta · IF_beta + D_gamma · IF_gamma
 *   bootstrap  sd of re-estimates over resampled patients
 * and exact large-sample limits (asymptotic) computed from the known data-generating law. */
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.CausalScience;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalSE = api;
})(typeof self !== "undefined" ? self : globalThis, function (S) {
  "use strict";
  const PRESETS = ["both", "outcome", "propensity", "neither"];
  const SIGMA2 = 0.64; // residual variance in core.generate (0.8^2)
  const TRUTH = 2;
  const clip = (g) => Math.max(0.02, Math.min(0.98, g));
  const goodM = (preset) => preset === "both" || preset === "outcome";
  const goodG = (preset) => preset === "both" || preset === "propensity";

  /* Per-cell sufficient statistics: n[x][a], s[x][a] = ΣY, q[x][a] = ΣY². */
  function cells(rows, index = null) {
    const n = [
        [0, 0],
        [0, 0],
      ],
      s = [
        [0, 0],
        [0, 0],
      ],
      q = [
        [0, 0],
        [0, 0],
      ];
    const len = index ? index.length : rows.length;
    for (let k = 0; k < len; k++) {
      const r = rows[index ? index[k] : k];
      n[r.x][r.a]++;
      s[r.x][r.a] += r.y;
      q[r.x][r.a] += r.y * r.y;
    }
    return { n, s, q, N: len };
  }

  /* Fitted nuisances exactly as core.nuisance (fitted mode): the correct outcome model
   * [1,X,A,AX] is saturated, so OLS gives the four cell means; the wrong model [1,A] gives
   * the two arm means. Propensity: smoothed proportions within X, or one pooled proportion.
   * options.knownG / options.knownM replace a fitted nuisance by the true function. */
  function fit(c, preset, options = {}) {
    const { n, s, N } = c;
    let m;
    if (options.knownM) m = (x, a) => S.trueM(x, a);
    else if (goodM(preset)) {
      const cm = [0, 1].map((x) => [0, 1].map((a) => s[x][a] / n[x][a]));
      m = (x, a) => cm[x][a];
    } else {
      const am = [0, 1].map(
        (a) => (s[0][a] + s[1][a]) / (n[0][a] + n[1][a]),
      );
      m = (x, a) => am[a];
    }
    let g;
    if (options.knownG) g = (x) => clip(S.trueG(x));
    else if (goodG(preset)) {
      const gs = [0, 1].map(
        (x) => (n[x][1] + 0.5) / (n[x][0] + n[x][1] + 1),
      );
      g = (x) => clip(gs[x]);
    } else {
      const pooled = (n[0][1] + n[1][1] + 0.5) / (N + 1);
      g = () => clip(pooled);
    }
    return { m, g };
  }

  /* AIPW estimate, plug-in, and influence-function SE from cell statistics. */
  function fromCells(c, preset, options = {}) {
    const { n, s, q, N } = c,
      { m, g } = fit(c, preset, options);
    let sum1 = 0,
      sum2 = 0,
      plug = 0;
    for (const x of [0, 1]) {
      const cx = m(x, 1) - m(x, 0);
      for (const a of [0, 1]) {
        const w = a ? 1 / g(x) : -1 / (1 - g(x)),
          b = cx - w * m(x, a); // phi = b + w*y within the cell
        sum1 += n[x][a] * b + w * s[x][a];
        sum2 += n[x][a] * b * b + 2 * b * w * s[x][a] + w * w * q[x][a];
        plug += n[x][a] * cx;
      }
    }
    const aipw = sum1 / N,
      varPhi = (sum2 - N * aipw * aipw) / (N - 1);
    return {
      aipw,
      plugin: plug / N,
      se: Math.sqrt(Math.max(0, varPhi) / N),
    };
  }
  const estimate = (rows, preset, options) =>
    fromCells(cells(rows), preset, options);

  /* 4x4 (or smaller) matrix inverse by Gauss-Jordan. */
  function inverse(A) {
    const k = A.length,
      M = A.map((r, i) => [...r, ...r.map((_, j) => +(i === j))]);
    for (let c = 0; c < k; c++) {
      let p = c;
      for (let r = c + 1; r < k; r++)
        if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const v = M[c][c];
      if (Math.abs(v) < 1e-12) throw Error("Singular design");
      for (let j = 0; j < 2 * k; j++) M[c][j] /= v;
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((r) => r.slice(k));
  }

  /* Stacked estimating-equation (M-estimation) sandwich for the fitted-nuisance AIPW.
   * Returns the full SE and the SE after adding only the outcome-model term or only the
   * propensity-model term, so the source of any correction is visible. */
  function sandwich(rows, preset) {
    const c = cells(rows),
      N = rows.length,
      { m, g } = fit(c, preset),
      feat = goodM(preset)
        ? (x, a) => [1, x, a, a * x]
        : (x, a) => [1, a],
      k = goodM(preset) ? 4 : 2,
      est = fromCells(c, preset).aipw;
    // Outcome OLS: IF_beta,i = (F'F/N)^-1 f_i r_i
    const FtF = Array.from({ length: k }, () => Array(k).fill(0));
    const Dbeta = Array(k).fill(0);
    let Dg = [0, 0];
    const px = [0, 1].map((x) => (c.n[x][0] + c.n[x][1]) / N);
    const phi = new Float64Array(N),
      dphidg = new Float64Array(N);
    rows.forEach((r, i) => {
      const f = feat(r.x, r.a);
      for (let u = 0; u < k; u++)
        for (let v = 0; v < k; v++) FtF[u][v] += f[u] * f[v];
      const gx = g(r.x),
        m1 = m(r.x, 1),
        m0 = m(r.x, 0),
        f1 = feat(r.x, 1),
        f0 = feat(r.x, 0);
      phi[i] =
        m1 - m0 + (r.a / gx) * (r.y - m1) - ((1 - r.a) / (1 - gx)) * (r.y - m0);
      for (let u = 0; u < k; u++)
        Dbeta[u] +=
          (f1[u] * (1 - r.a / gx) - f0[u] * (1 - (1 - r.a) / (1 - gx))) / N;
      dphidg[i] =
        (-r.a * (r.y - m1)) / (gx * gx) -
        ((1 - r.a) * (r.y - m0)) / ((1 - gx) * (1 - gx));
      if (goodG(preset)) Dg[r.x] += dphidg[i] / N;
      else Dg[0] += dphidg[i] / N;
    });
    const Minv = inverse(FtF.map((row) => row.map((v) => v / N)));
    const w = Minv.map((row) => S.dot(row, Dbeta)); // D_beta · M^-1 (M symmetric)
    const base = [],
      withBeta = [],
      withGamma = [],
      full = [];
    rows.forEach((r, i) => {
      const res = r.y - m(r.x, r.a),
        tb = S.dot(w, feat(r.x, r.a)) * res,
        tg = goodG(preset)
          ? (Dg[r.x] * (r.a - g(r.x))) / px[r.x]
          : Dg[0] * (r.a - g(r.x)),
        d = phi[i] - est;
      base.push(d);
      withBeta.push(d + tb);
      withGamma.push(d + tg);
      full.push(d + tb + tg);
    });
    const se = (a) => Math.sqrt(S.variance(a) / N);
    return {
      aipw: est,
      ifSE: se(base),
      outcomeTermSE: se(withBeta),
      propensityTermSE: se(withGamma),
      se: se(full),
    };
  }

  /* Nonparametric bootstrap: resample patients with replacement, refit both nuisance
   * models, re-estimate. Returns the SE and the replicate estimates. */
  function bootstrap(rows, preset, B, random, options = {}) {
    const N = rows.length,
      idx = new Int32Array(N),
      reps = new Float64Array(B);
    for (let b = 0; b < B; b++) {
      for (let i = 0; i < N; i++) idx[i] = Math.floor(random() * N);
      const c = cells(rows, idx);
      // A resample with an empty cell cannot fit the saturated model; redraw.
      if (c.n.some((r) => r.some((v) => v === 0))) {
        b--;
        continue;
      }
      reps[b] = fromCells(c, preset, options).aipw;
    }
    const arr = Array.from(reps);
    return { se: Math.sqrt(S.variance(arr)), reps: arr };
  }

  function quantile(sorted, p) {
    const h = (sorted.length - 1) * p,
      lo = Math.floor(h);
    return sorted[lo] + (h - lo) * ((sorted[lo + 1] ?? sorted[lo]) - sorted[lo]);
  }

  /* Exact large-sample limits from the known law (per unit n: multiply by 1/sqrt(n)).
   * trueSD: sd of the estimator itself. ifSD: probability limit of the IF-SE formula
   * (variance of phi evaluated at the limits of the fitted nuisances).
   * With a binary X, AIPW with a saturated propensity or a saturated outcome model equals
   * the stratified (post-stratified) difference Σ_x p̂_x (Ȳ_x1 − Ȳ_x0) up to the
   * propensity smoothing, so the first three cases share the efficient variance; the
   * "neither" case is the difference in arm means. */
  function law() {
    const p = S.prevalence,
      px = [1 - p, p],
      cell = [0, 1].map((x) =>
        [0, 1].map((a) => px[x] * (a ? S.trueG(x) : 1 - S.trueG(x))),
      ),
      pa = [0, 1].map((a) => cell[0][a] + cell[1][a]),
      armMean = [0, 1].map(
        (a) =>
          (cell[0][a] * S.trueM(0, a) + cell[1][a] * S.trueM(1, a)) / pa[a],
      ),
      armVar = [0, 1].map(
        (a) =>
          SIGMA2 +
          (cell[0][a] * (S.trueM(0, a) - armMean[a]) ** 2 +
            cell[1][a] * (S.trueM(1, a) - armMean[a]) ** 2) /
            pa[a],
      );
    return { px, cell, pa, armMean, armVar };
  }
  function phiMoments(mbar, gbar) {
    const L = law();
    let e1 = 0,
      e2 = 0;
    for (const x of [0, 1])
      for (const a of [0, 1]) {
        const w = a ? 1 / gbar(x) : -1 / (1 - gbar(x)),
          c = mbar(x, 1) - mbar(x, 0),
          d = S.trueM(x, a) - mbar(x, a),
          pr = L.cell[x][a];
        e1 += pr * (c + w * d);
        e2 += pr * ((c + w * d) ** 2 + w * w * SIGMA2);
      }
    return { mean: e1, variance: e2 - e1 * e1 };
  }
  function limits(preset, options = {}) {
    const L = law(),
      mbar =
        options.knownM || goodM(preset)
          ? (x, a) => S.trueM(x, a)
          : (x, a) => L.armMean[a],
      gbar =
        options.knownG || goodG(preset)
          ? (x) => S.trueG(x)
          : () => L.pa[1];
    return { mbar, gbar };
  }
  function asymptotic(preset, options = {}) {
    const L = law(),
      { mbar, gbar } = limits(preset, options),
      ifm = phiMoments(mbar, gbar);
    let trueVar;
    if (options.knownG && !goodM(preset))
      trueVar = ifm.variance; // known g: estimating m adds nothing (D_beta = 0)
    else if (goodM(preset) || goodG(preset)) trueVar = S.efficiencyVariance();
    else trueVar = L.armVar[1] / L.pa[1] + L.armVar[0] / L.pa[0];
    return {
      limit: ifm.mean,
      bias: ifm.mean - TRUTH,
      trueSD: Math.sqrt(trueVar),
      ifSD: Math.sqrt(ifm.variance),
    };
  }

  /* One repeated-sampling experiment for a preset: IF, sandwich and bootstrap SEs per study.
   * All presets use the same simulated studies when given the same seed. */
  function experiment({ preset, n, reps, B, seed, bootSeed, options = {} }) {
    const random = S.rng(seed),
      out = [];
    for (let r = 0; r < reps; r++) {
      const rows = S.generate(n, random),
        e = fromCells(cells(rows), preset, options),
        row = { aipw: e.aipw, ifSE: e.se };
      if (!options.knownG && !options.knownM) {
        const sw = sandwich(rows, preset);
        Object.assign(row, {
          sandwichSE: sw.se,
          outcomeTermSE: sw.outcomeTermSE,
          propensityTermSE: sw.propensityTermSE,
        });
      }
      if (B) {
        const bs = bootstrap(rows, preset, B, S.rng((bootSeed + r * 7919) >>> 0), options),
          sorted = bs.reps.slice().sort((a, b) => a - b);
        row.bootSE = bs.se;
        row.pctLo = quantile(sorted, 0.025);
        row.pctHi = quantile(sorted, 0.975);
      }
      out.push(row);
    }
    return out;
  }
  function coverage(rows, key) {
    const hits = rows.map((r) => +(Math.abs(r.aipw - TRUTH) <= 1.96 * r[key])),
      c = S.mean(hits);
    return { rate: c, mcse: Math.sqrt((c * (1 - c)) / rows.length) };
  }
  function summarize(rows) {
    const est = rows.map((r) => r.aipw),
      sd = Math.sqrt(S.variance(est)),
      out = {
        mean: S.mean(est),
        bias: S.mean(est) - TRUTH,
        sd,
        // Normal-theory Monte Carlo SE of an SD: sd / sqrt(2(R-1))
        sdMCSE: sd / Math.sqrt(2 * (rows.length - 1)),
      };
    for (const key of ["ifSE", "sandwichSE", "bootSE", "outcomeTermSE", "propensityTermSE"])
      if (key in rows[0]) {
        out[key] = S.mean(rows.map((r) => r[key]));
        if (key === "ifSE" || key === "sandwichSE" || key === "bootSE")
          out[key.replace("SE", "Coverage")] = coverage(rows, key);
      }
    if ("pctLo" in rows[0]) {
      const c = S.mean(rows.map((r) => +(r.pctLo <= TRUTH && TRUTH <= r.pctHi)));
      out.percentileCoverage = { rate: c, mcse: Math.sqrt((c * (1 - c)) / rows.length) };
    }
    return out;
  }

  return {
    PRESETS,
    TRUTH,
    SIGMA2,
    cells,
    fit,
    fromCells,
    estimate,
    sandwich,
    bootstrap,
    quantile,
    asymptotic,
    phiMoments,
    law,
    experiment,
    coverage,
    summarize,
  };
});
