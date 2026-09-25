/* Covariate adjustment in a randomized trial. Pure kernels, no DOM.
 *
 * Continuous teaching trial ("device trial"): X ~ N(0,1) is a baseline covariate in SD units,
 *   Y(0) = f(X) + e,  e ~ N(0, 1 − r2),
 *   f(X) = √r2 · ( √(1−curve)·X − √curve·(X² − 1)/√2 ),   so Var f(X) = r2 and Var Y(0) = 1,
 *   Y(1) = Y(0) + tau + het·X.
 * The estimand is the marginal (unconditional) average effect E[Y(1) − Y(0)] = tau, because E[X] = 0.
 * Treatment is assigned by complete randomization: exactly round(n·pi) people get the device.
 *
 * Binary teaching world: X ∈ {0,1} with P(X=1) = 1/2 and logit P(Y=1 | A, X) = b0 + gap·X + logOR·A.
 * The conditional odds ratio exp(logOR) is the same in both strata; the marginal odds ratio is not
 * equal to it unless gap = 0 or logOR = 0 (non-collapsibility, with no confounding at all).
 *
 * Estimators:
 *  - unadjusted: difference in arm means, SE √(s1²/n1 + s0²/n0).
 *  - standardized: fit a working outcome model in each arm, predict everyone under both arms, average
 *    the difference. With an intercept in each arm the arm residuals average zero, so this equals AIPW
 *    with the known randomization probability. Influence-function SE:
 *      φ_i = A/π̂ (Y − m1) − (1−A)/(1−π̂) (Y − m0) + m1 − m0 − ψ̂,   SE = √(Σφ²/n) / √n.
 *  - ancova: one joint linear model Y ~ 1 + A + features, with its model-based (homoscedastic) SE.
 */
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.CausalScience;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalRCT = api;
})(typeof self !== "undefined" ? self : globalThis, function (core) {
  "use strict";
  const { rng, randn } = core;
  const sum = (a) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i];
    return s;
  };
  const mean = (a) => sum(a) / a.length;
  const variance = (a) => {
    const m = mean(a);
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - m) ** 2;
    return s / (a.length - 1);
  };
  const expit = (x) => 1 / (1 + Math.exp(-x));
  const logit = (p) => Math.log(p / (1 - p));
  const Z = 1.959963984540054;

  const DEFAULTS = Object.freeze({
    n: 200, pi: 0.5, r2: 0.5, curve: 0, tau: 0.25, het: 0,
  });

  /* Solve a small symmetric positive (semi)definite system by Gaussian elimination with pivoting.
   * Near-singular pivots are set to zero coefficients (dropped columns), never NaN. */
  function solve(A, b) {
    const k = b.length,
      M = A.map((r, i) => [...r, b[i]]);
    const scale = Math.max(1e-300, ...A.map((r, i) => Math.abs(r[i])));
    const dead = new Array(k).fill(false);
    for (let c = 0; c < k; c++) {
      let p = c;
      for (let r = c + 1; r < k; r++)
        if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-10 * scale) {
        dead[c] = true;
        continue;
      }
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        if (f) for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map((r, i) => (dead[i] ? 0 : r[k] / r[i]));
  }
  function invert(A) {
    const k = A.length;
    return A.map((_, j) => solve(A, A.map((__, i) => (i === j ? 1 : 0))))
      .reduce((cols, col, j) => {
        col.forEach((v, i) => (cols[i][j] = v));
        return cols;
      }, A.map(() => new Array(k).fill(0)));
  }
  /* Ordinary least squares on design rows (each row already includes the intercept). */
  function ols(rows, y) {
    const k = rows[0].length,
      XtX = Array.from({ length: k }, () => new Array(k).fill(0)),
      Xty = new Array(k).fill(0);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      for (let a = 0; a < k; a++) {
        Xty[a] += r[a] * y[i];
        for (let b = a; b < k; b++) XtX[a][b] += r[a] * r[b];
      }
    }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
    const beta = solve(XtX, Xty);
    return { beta, XtX, predict: (r) => r.reduce((s, v, j) => s + v * beta[j], 0) };
  }
  /* Logistic regression by Newton–Raphson (IRLS). Rows include the intercept. */
  function logistic(rows, y, iters = 30) {
    const k = rows[0].length;
    let beta = new Array(k).fill(0);
    const ybar = Math.min(1 - 1e-6, Math.max(1e-6, mean(y)));
    beta[0] = logit(ybar);
    let converged = false;
    for (let it = 0; it < iters; it++) {
      const H = Array.from({ length: k }, () => new Array(k).fill(0)),
        g = new Array(k).fill(0);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i],
          p = expit(r.reduce((s, v, j) => s + v * beta[j], 0)),
          w = p * (1 - p);
        for (let a = 0; a < k; a++) {
          g[a] += r[a] * (y[i] - p);
          for (let b = 0; b < k; b++) H[a][b] += w * r[a] * r[b];
        }
      }
      const step = solve(H, g);
      beta = beta.map((v, j) => v + Math.max(-5, Math.min(5, step[j])));
      if (Math.max(...step.map(Math.abs)) < 1e-10) {
        converged = true;
        break;
      }
    }
    return {
      beta,
      converged,
      predict: (r) => expit(r.reduce((s, v, j) => s + v * beta[j], 0)),
    };
  }

  /* Prognostic part of the outcome, in SD units of Y(0). */
  function prognostic(x, r2, curve) {
    return Math.sqrt(r2) * (Math.sqrt(1 - curve) * x - (Math.sqrt(curve) * (x * x - 1)) / Math.SQRT2);
  }
  /* Exactly round(n·pi) treated, positions permuted uniformly (complete randomization). */
  function assign(n, pi, random) {
    const n1 = Math.round(n * pi),
      a = Array.from({ length: n }, (_, i) => (i < n1 ? 1 : 0));
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function trial(cfg, random) {
    const c = { ...DEFAULTS, ...cfg },
      a = assign(c.n, c.pi, random),
      x = [], y = [];
    for (let i = 0; i < c.n; i++) {
      const xi = randn(random),
        e = Math.sqrt(1 - c.r2) * randn(random),
        y0 = prognostic(xi, c.r2, c.curve) + e;
      x.push(xi);
      y.push(y0 + a[i] * (c.tau + c.het * xi));
    }
    return { x, a, y };
  }

  const FEATURES = {
    none: () => [1],
    linear: (x) => [1, x],
    quadratic: (x) => [1, x, x * x],
    // A deliberately crude working model: only whether X is above its median value 0.
    sign: (x) => [1, x > 0 ? 1 : 0],
  };
  const featureRows = (x, model) =>
    x.map((v, i) =>
      typeof model === "function" ? model(v, i) : FEATURES[model](v),
    );

  function unadjusted({ a, y }) {
    const y1 = y.filter((_, i) => a[i]),
      y0 = y.filter((_, i) => !a[i]),
      est = mean(y1) - mean(y0),
      se = Math.sqrt(variance(y1) / y1.length + variance(y0) / y0.length);
    return { est, se };
  }
  /* Standardization (g-computation) with a working model fitted separately in each arm. */
  function standardized({ x, a, y }, model = "linear", rows = null) {
    const R = rows || featureRows(x, model),
      i1 = [], i0 = [];
    a.forEach((v, i) => (v ? i1 : i0).push(i));
    const f1 = ols(i1.map((i) => R[i]), i1.map((i) => y[i])),
      f0 = ols(i0.map((i) => R[i]), i0.map((i) => y[i])),
      m1 = R.map(f1.predict),
      m0 = R.map(f0.predict),
      n = y.length,
      pi = i1.length / n,
      est = mean(m1.map((v, i) => v - m0[i])),
      resid = y.map((v, i) =>
        a[i] ? (v - m1[i]) / pi : -(v - m0[i]) / (1 - pi),
      ),
      aipw = est + mean(resid),
      phi = y.map((_, i) => resid[i] + m1[i] - m0[i] - aipw),
      seRaw = Math.sqrt(sum(phi.map((v) => v * v)) / n) / Math.sqrt(n),
      // Small-sample version: each arm's residual part is inflated by n_a/(n_a − k), the usual
      // degrees-of-freedom factor for k fitted coefficients. The cross terms are exactly zero because
      // OLS residuals are orthogonal to the features within each arm.
      k = R[0].length,
      df = (i) => (a[i] ? i1.length / Math.max(1, i1.length - k) : i0.length / Math.max(1, i0.length - k)),
      se = Math.sqrt(
        sum(y.map((_, i) => resid[i] ** 2 * df(i) + (m1[i] - m0[i] - aipw) ** 2)) / n,
      ) / Math.sqrt(n);
    return { est, aipw, se, seRaw, phi, m1, m0, pi, fit1: f1, fit0: f0 };
  }
  /* ANCOVA: one linear model with a common slope; model-based SE of the treatment coefficient. */
  function ancova({ x, a, y }, model = "linear", rows = null) {
    const F = rows || featureRows(x, model),
      R = F.map((r, i) => [r[0], a[i], ...r.slice(1)]),
      fit = ols(R, y),
      n = y.length,
      k = R[0].length,
      rss = sum(y.map((v, i) => (v - fit.predict(R[i])) ** 2)),
      s2 = rss / (n - k),
      inv = invert(fit.XtX);
    return { est: fit.beta[1], se: Math.sqrt(s2 * inv[1][1]) };
  }

  const ci = (r) => [r.est - Z * r.se, r.est + Z * r.se];
  function summary(values, ses, truth) {
    const m = mean(values),
      sd = Math.sqrt(variance(values)),
      R = values.length,
      cover = ses
        ? mean(values.map((v, i) => (Math.abs(v - truth) <= Z * ses[i] ? 1 : 0)))
        : NaN;
    return {
      mean: m,
      sd,
      bias: m - truth,
      mcse: sd / Math.sqrt(R),
      meanSE: ses ? mean(ses) : NaN,
      coverage: cover,
      coverageMCSE: ses ? Math.sqrt((cover * (1 - cover)) / R) : NaN,
    };
  }
  /* Repeated trials. Returns per-trial estimates for the unadjusted, standardized and ANCOVA analyses. */
  function repeatTrials(cfg, reps, seed, model = "linear") {
    const c = { ...DEFAULTS, ...cfg },
      random = rng(seed),
      out = { unadj: [], unadjSE: [], adj: [], adjSE: [], anc: [], ancSE: [], lo: [], hi: [] };
    for (let r = 0; r < reps; r++) {
      const d = trial(c, random),
        u = unadjusted(d),
        s = standardized(d, model),
        k = ancova(d, model);
      out.unadj.push(u.est); out.unadjSE.push(u.se);
      out.adj.push(s.est); out.adjSE.push(s.se);
      out.anc.push(k.est); out.ancSE.push(k.se);
    }
    const truth = c.tau,
      su = summary(out.unadj, out.unadjSE, truth),
      sa = summary(out.adj, out.adjSE, truth),
      sk = summary(out.anc, out.ancSE, truth),
      ratio = (su.sd / sa.sd) ** 2;
    return {
      config: { ...c, reps, seed, model },
      truth,
      ...out,
      unadjusted: su,
      standardized: sa,
      ancova: sk,
      varianceRatio: ratio,
      extraPatients: c.n * (ratio - 1),
    };
  }
  /* Large-sample precision bookkeeping for linear adjustment of one covariate under any allocation,
   * constant effect: Var(unadjusted)/Var(adjusted) = 1/(1 − R²). Equivalent to n/(1−R²) unadjusted
   * patients, i.e. n·R²/(1−R²) extra. R² is the share of outcome variance the working model explains. */
  function extraPatients(n, r2) {
    if (r2 >= 1) return Infinity;
    return (n * r2) / (1 - r2);
  }
  /* Share of Var Y(0) that the best linear-in-X model captures in the teaching world. */
  const linearR2 = (r2, curve) => r2 * (1 - curve);

  /* Large-sample share of Var Y(0) that each arm-specific working model captures in the teaching world:
   * linear keeps the linear part; quadratic is correct; the sign model keeps corr²(X, 1{X>0}) = 2/π of
   * the linear part and none of the symmetric curved part. */
  function capturedR2(model, r2, curve) {
    if (model === "quadratic") return r2;
    if (model === "linear") return r2 * (1 - curve);
    if (model === "sign") return (r2 * (1 - curve) * 2) / Math.PI;
    return 0;
  }

  /* ---------- binary outcomes: exact non-collapsibility ---------- */
  function binaryWorld({ base = 0.2, gap = 2.5, logOR = Math.log(3), px = 0.5 } = {}) {
    const b0 = logit(base),
      risk = (a, x) => expit(b0 + gap * x + logOR * a),
      w = [1 - px, px],
      r1 = w[0] * risk(1, 0) + w[1] * risk(1, 1),
      r0 = w[0] * risk(0, 0) + w[1] * risk(0, 1),
      odds = (p) => p / (1 - p);
    return {
      strata: [0, 1].map((x) => ({
        x, weight: w[x], risk0: risk(0, x), risk1: risk(1, x),
        or: odds(risk(1, x)) / odds(risk(0, x)),
        rd: risk(1, x) - risk(0, x),
      })),
      risk1: r1,
      risk0: r0,
      conditionalOR: Math.exp(logOR),
      marginalOR: odds(r1) / odds(r0),
      marginalRD: r1 - r0,
      marginalRR: r1 / r0,
    };
  }
  function binaryTrial({ n = 400, base = 0.2, gap = 2.5, logOR = Math.log(3), px = 0.5 }, random) {
    const a = assign(n, 0.5, random),
      b0 = logit(base),
      x = [], y = [];
    for (let i = 0; i < n; i++) {
      const xi = random() < px ? 1 : 0;
      x.push(xi);
      y.push(random() < expit(b0 + gap * xi + logOR * a[i]) ? 1 : 0);
    }
    return { x, a, y };
  }
  /* Three analyses of one binary trial. Standardization uses the logistic working model Y ~ 1 + A + X
   * (canonical link with an intercept and A: residuals sum to zero in each arm). */
  function binaryAnalyses({ x, a, y }) {
    const n = y.length,
      odds = (p) => p / (1 - p),
      p1 = mean(y.filter((_, i) => a[i])),
      p0 = mean(y.filter((_, i) => !a[i])),
      fit = logistic(x.map((v, i) => [1, a[i], v]), y),
      m1 = x.map((v) => fit.predict([1, 1, v])),
      m0 = x.map((v) => fit.predict([1, 0, v])),
      s1 = mean(m1),
      s0 = mean(m0),
      pi = sum(a) / n,
      // AIPW correction terms with the known randomization probability (equal to zero at the MLE).
      c1 = mean(y.map((v, i) => (a[i] * (v - m1[i])) / pi)),
      c0 = mean(y.map((v, i) => ((1 - a[i]) * (v - m0[i])) / (1 - pi))),
      phi = y.map(
        (v, i) =>
          (a[i] * (v - m1[i])) / pi -
          ((1 - a[i]) * (v - m0[i])) / (1 - pi) +
          m1[i] - m0[i] - (s1 + c1 - s0 - c0),
      );
    return {
      unadjustedRD: p1 - p0,
      unadjustedOR: odds(p1) / odds(p0),
      conditionalOR: Math.exp(fit.beta[1]),
      standardizedRD: s1 - s0,
      standardizedOR: odds(s1) / odds(s0),
      aipwRD: s1 + c1 - (s0 + c0),
      rdSE: Math.sqrt(sum(phi.map((v) => v * v)) / n) / Math.sqrt(n),
      unadjustedRDSE: Math.sqrt(p1 * (1 - p1) / sum(a) + p0 * (1 - p0) / (n - sum(a))),
      converged: fit.converged,
    };
  }
  function repeatBinary(cfg, reps, seed) {
    const random = rng(seed),
      rows = [];
    for (let r = 0; r < reps; r++) rows.push(binaryAnalyses(binaryTrial(cfg, random)));
    const pick = (k) => rows.map((v) => v[k]).filter(Number.isFinite),
      gmean = (k) => Math.exp(mean(pick(k).map(Math.log)));
    return {
      reps,
      rows,
      unadjustedOR: gmean("unadjustedOR"),
      conditionalOR: gmean("conditionalOR"),
      standardizedOR: gmean("standardizedOR"),
      unadjustedRD: summary(pick("unadjustedRD"), pick("unadjustedRDSE"), binaryWorld(cfg).marginalRD),
      standardizedRD: summary(pick("standardizedRD"), pick("rdSE"), binaryWorld(cfg).marginalRD),
    };
  }

  /* ---------- a prognostic score learned from historical data (PROCOVA idea) ---------- */
  const P_COVS = 10;
  // Fixed coefficients of the historical/trial outcome in 10 baseline covariates (SD units).
  const LIN = [0.45, -0.35, 0.3, 0.2, -0.15, 0.1, 0.05, 0, 0, 0];
  const QUAD = 0.35; // concave curvature in covariate 1
  const INTER = 0.3; // interaction between covariates 2 and 3
  const pSignal = (z) =>
    LIN.reduce((s, b, j) => s + b * z[j], 0) -
    (QUAD * (z[0] * z[0] - 1)) / Math.SQRT2 +
    INTER * z[1] * z[2];
  const P_SIGNAL_VAR =
    LIN.reduce((s, b) => s + b * b, 0) + QUAD * QUAD + INTER * INTER;
  const P_NOISE = 1 - P_SIGNAL_VAR; // Var Y(0) = 1, so the oracle score explains R² = P_SIGNAL_VAR
  const pDraw = (random) => Array.from({ length: P_COVS }, () => randn(random));
  // The learner fitted to history: main effects, squares and pairwise products of the first 4 covariates.
  const pFeatures = (z) => {
    const f = [1, ...z];
    for (let j = 0; j < 4; j++) for (let k = j; k < 4; k++) f.push(z[j] * z[k]);
    return f;
  };
  function learnScore(nHist, seed) {
    const random = rng(seed),
      Zs = [], Y = [];
    for (let i = 0; i < nHist; i++) {
      const z = pDraw(random);
      Zs.push(pFeatures(z));
      Y.push(pSignal(z) + Math.sqrt(P_NOISE) * randn(random));
    }
    // Light ridge penalty keeps small historical samples stable (intercept unpenalized).
    const k = Zs[0].length,
      XtX = Array.from({ length: k }, () => new Array(k).fill(0)),
      Xty = new Array(k).fill(0);
    for (let i = 0; i < nHist; i++)
      for (let a = 0; a < k; a++) {
        Xty[a] += Zs[i][a] * Y[i];
        for (let b = 0; b < k; b++) XtX[a][b] += Zs[i][a] * Zs[i][b];
      }
    for (let a = 1; a < k; a++) XtX[a][a] += 2;
    const beta = solve(XtX, Xty);
    return (z) => pFeatures(z).reduce((s, v, j) => s + v * beta[j], 0);
  }
  function procovaTrials({ n = 200, nHist = 1000, tau = 0.25, reps = 400, seed = 7 } = {}) {
    const score = learnScore(nHist, seed + 1),
      random = rng(seed),
      est = { unadj: [], all: [], score: [], oracle: [] },
      ses = { unadj: [], all: [], score: [], oracle: [] };
    let r2num = 0, r2den = 0;
    for (let r = 0; r < reps; r++) {
      const a = assign(n, 0.5, random),
        Zs = [], y = [];
      for (let i = 0; i < n; i++) {
        const z = pDraw(random);
        Zs.push(z);
        y.push(pSignal(z) + Math.sqrt(P_NOISE) * randn(random) + a[i] * tau);
      }
      const d = { x: Zs, a, y },
        u = unadjusted(d),
        all = standardized(d, null, Zs.map((z) => [1, ...z])),
        sc = standardized(d, null, Zs.map((z) => [1, score(z)])),
        or = standardized(d, null, Zs.map((z) => [1, pSignal(z)]));
      [["unadj", u], ["all", all], ["score", sc], ["oracle", or]].forEach(([k, v]) => {
        est[k].push(v.est);
        ses[k].push(v.se);
      });
      if (r < 50)
        Zs.forEach((z) => {
          r2num += (score(z) - pSignal(z)) ** 2;
          r2den += 1;
        });
    }
    const out = { config: { n, nHist, tau, reps, seed }, truth: tau };
    for (const k of Object.keys(est)) out[k] = summary(est[k], ses[k], tau);
    const vu = out.unadj.sd ** 2;
    for (const k of ["all", "score", "oracle"])
      out[k].extraPatients = n * (vu / out[k].sd ** 2 - 1);
    // Share of outcome variance the learned score explains in new patients (Monte Carlo).
    const mse = r2num / r2den,
      total = P_SIGNAL_VAR + P_NOISE;
    out.scoreR2 = Math.max(0, 1 - (mse + P_NOISE) / total);
    out.oracleR2 = P_SIGNAL_VAR / total;
    return out;
  }

  /* ---------- precomputed repeated-trial grids used by the lesson (see rct-adjustment.json) ---------- */
  const HIST = { min: -0.35, max: 0.85, bins: 48 };
  function bin(values) {
    const counts = new Array(HIST.bins).fill(0),
      w = (HIST.max - HIST.min) / HIST.bins;
    let under = 0, over = 0;
    for (const v of values) {
      if (v < HIST.min) under++;
      else if (v >= HIST.max) over++;
      else counts[Math.floor((v - HIST.min) / w)]++;
    }
    return { counts, under, over };
  }
  const r4 = (x) => Math.round(x * 1e4) / 1e4;
  const pickSummary = (s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, r4(v)]));
  const GRID = Object.freeze({
    seed: 20260925,
    reps: 4000,
    r2: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    curve: [0, 0.25, 0.5, 0.75, 1],
    models: ["linear", "quadratic", "sign"],
    curveR2: 0.6,
    pi: [0.25, 0.5, 0.75],
    het: [0, 0.5, 1, 1.5, 2],
    seR2: 0.5,
    ladder: 400,
    binaryGap: [0, 0.5, 1, 1.5, 2, 2.5, 3],
    binaryOR: [1.5, 2, 3, 5],
    binaryReps: 1000,
    binaryN: 400,
    nHist: [20, 50, 200, 1000, 5000],
    procovaReps: 1000,
  });
  function precomputeAdjust(r2, seed = GRID.seed, reps = GRID.reps) {
    const o = repeatTrials({ r2 }, reps, seed, "linear");
    return {
      r2,
      unadjusted: pickSummary(o.unadjusted),
      standardized: pickSummary(o.standardized),
      histUnadj: bin(o.unadj),
      histAdj: bin(o.adj),
      varianceRatio: r4(o.varianceRatio),
      extraPatients: Math.round(o.extraPatients),
      theoryExtra: Math.round(extraPatients(DEFAULTS.n, r2)),
    };
  }
  function precomputeCurve(curve, model, seed = GRID.seed + 1, reps = GRID.reps) {
    const r2 = GRID.curveR2,
      o = repeatTrials({ r2, curve }, reps, seed, model);
    return {
      curve, model,
      unadjusted: pickSummary(o.unadjusted),
      standardized: pickSummary(o.standardized),
      histUnadj: bin(o.unadj),
      histAdj: bin(o.adj),
      extraPatients: Math.round(o.extraPatients),
      captured: r4(capturedR2(model, r2, curve)),
      theoryExtra: Math.round(extraPatients(DEFAULTS.n, capturedR2(model, r2, curve))),
    };
  }
  function precomputeSE(pi, het, seed = GRID.seed + 2, reps = GRID.reps) {
    const o = repeatTrials({ r2: GRID.seR2, pi, het }, reps, seed, "linear");
    return {
      pi, het,
      unadjusted: pickSummary(o.unadjusted),
      ancova: pickSummary(o.ancova),
      standardized: pickSummary(o.standardized),
    };
  }
  function precomputeBinary(gap, or, seed = GRID.seed + 3, reps = GRID.binaryReps) {
    const cfg = { n: GRID.binaryN, gap, logOR: Math.log(or) },
      o = repeatBinary(cfg, reps, seed);
    return {
      gap, or,
      unadjustedOR: r4(o.unadjustedOR),
      conditionalOR: r4(o.conditionalOR),
      standardizedOR: r4(o.standardizedOR),
      unadjustedRD: pickSummary(o.unadjustedRD),
      standardizedRD: pickSummary(o.standardizedRD),
    };
  }
  function precomputeProcova(nHist, seed = GRID.seed + 4, reps = GRID.procovaReps) {
    const o = procovaTrials({ nHist, reps, seed });
    const out = { nHist, scoreR2: r4(o.scoreR2), oracleR2: r4(o.oracleR2) };
    for (const k of ["unadj", "all", "score", "oracle"])
      out[k] = { ...pickSummary(o[k]), extraPatients: Math.round(o[k].extraPatients || 0) };
    return out;
  }
  function ladder(seed = GRID.seed, count = GRID.ladder) {
    const random = rng(seed),
      est = [], se = [];
    for (let r = 0; r < count; r++) {
      const u = unadjusted(trial({ r2: DEFAULTS.r2 }, random));
      est.push(r4(u.est));
      se.push(r4(u.se));
    }
    return { est, se };
  }
  function precompute() {
    return {
      about: "Generated by CausalRCT.precompute() in science/rct-adjustment.js. Seeded; regenerate with node -e \"require('fs').writeFileSync('science/rct-adjustment.json', JSON.stringify(require('./science/rct-adjustment.js').precompute()))\"",
      grid: GRID,
      hist: HIST,
      ladder: ladder(),
      adjust: GRID.r2.map((r2) => precomputeAdjust(r2)),
      curve: GRID.curve.flatMap((c) => GRID.models.map((m) => precomputeCurve(c, m))),
      se: GRID.pi.flatMap((p) => GRID.het.map((h) => precomputeSE(p, h))),
      binary: GRID.binaryGap.flatMap((g) => GRID.binaryOR.map((o) => precomputeBinary(g, o))),
      procova: GRID.nHist.map((h) => precomputeProcova(h)),
    };
  }

  return {
    DEFAULTS, Z, GRID, HIST, bin, capturedR2, precompute, precomputeAdjust, precomputeCurve,
    precomputeSE, precomputeBinary, precomputeProcova, ladder, sum, mean, variance, solve, invert, ols, logistic,
    prognostic, assign, trial, featureRows, unadjusted, standardized, ancova,
    ci, summary, repeatTrials, extraPatients, linearR2,
    binaryWorld, binaryTrial, binaryAnalyses, repeatBinary,
    learnScore, procovaTrials, P_SIGNAL_VAR, P_NOISE,
  };
});
