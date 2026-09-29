/* Capstone: an emulated trial, end to end. Pure computations, no DOM.
 *
 * World (simulated device registry, known truth):
 *   n patients eligible for a structural heart procedure; baseline covariates
 *   age (years), female (0/1), LVEF (%), eGFR (mL/min/1.73m²), STS-PROM (% predicted operative mortality).
 *   Strategy A = 1: transcatheter device at eligibility; A = 0: standard care (surgery or medical therapy).
 *   Treatment model:  logit g(x) = −0.35 + 0.10 zAge + 0.08 zAge² + 0.9 zSts − 0.25 zLvef + 0.25 female
 *                      (z-scores defined in Z below; zSts is on the log scale).
 *   One-year risk of death or heart-failure hospitalisation under strategy a (treatment policy: whatever
 *   happens after time zero, including crossover, is part of the strategy):
 *     logit p(a, x) = −1.25 + 0.30 zAge + 0.70 zSts − 0.30 zLvef − 0.20 zEgfr + 0.45 max(0, −zEgfr − 0.5)²
 *                     + a (−0.55 + 0.30 zSts − 0.20 zAge)
 *   Event time T ~ exponential with rate h = −log(1 − p)/12 per month, so P(T ≤ 12) = p exactly and
 *   E[min(T, 12)] = p / h. Follow-up is complete through 12 months (registry linked to vital status and
 *   hospital records), so Y = 1{T ≤ 12} and min(T, 12) are observed for everyone.
 *   About 10% of standard-care patients cross over to the device later; under the treatment-policy
 *   strategy that is part of "standard care" and changes nothing in the analysis.
 * Estimands: risk difference ψ_RD = E[p(1, X)] − E[p(0, X)] at 12 months; ΔRMST(12) = E[min(T¹,12)] − E[min(T⁰,12)].
 * Estimators: unadjusted, plug-in (g-computation), AIPW (one-step) and TMLE with cross-fitted Super Learner
 * nuisances; influence-function SEs. E-value for the risk ratio (VanderWeele and Ding 2017). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalCapstone = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  const N = 1600,
    SEED = 20260929,
    TAU = 12,
    BOUND = 0.025, // pre-specified propensity bound used inside the estimators
    V = 5, // folds for cross-validation and cross-fitting
    expit = (v) => 1 / (1 + Math.exp(-v)),
    logit = (p) => Math.log(p / (1 - p)),
    sum = (a) => a.reduce((s, v) => s + v, 0),
    mean = (a) => sum(a) / a.length;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randn = (u) => {
    let a = 0;
    while (a === 0) a = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * u());
  };
  const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- the world ---------- */
  function drawX(u) {
    const age = clip(78 + 7 * randn(u), 55, 95),
      female = +(u() < 0.45),
      lvef = clip(52 + 10 * randn(u), 20, 75),
      egfr = clip(60 + 18 * randn(u), 15, 110),
      sts = clip(Math.exp(Math.log(4) + 0.03 * (age - 78) + 0.45 * randn(u)), 0.5, 20);
    return { age, female, lvef, egfr, sts };
  }
  // Fixed standardisation (not estimated from the data, so no information leaks across folds).
  const Z = (x) => ({
    age: (x.age - 78) / 7,
    lvef: (x.lvef - 52) / 10,
    egfr: (x.egfr - 60) / 18,
    sts: (Math.log(x.sts) - Math.log(4)) / 0.5,
    female: x.female,
  });
  const TRUE = {
    g(x) {
      const z = Z(x);
      return expit(-0.35 + 0.1 * z.age + 0.08 * z.age * z.age + 0.9 * z.sts - 0.25 * z.lvef + 0.25 * z.female);
    },
    p(a, x) {
      const z = Z(x),
        kidney = Math.max(0, -z.egfr - 0.5);
      return expit(
        -1.25 + 0.3 * z.age + 0.7 * z.sts - 0.3 * z.lvef - 0.2 * z.egfr + 0.45 * kidney * kidney +
          a * (-0.55 + 0.3 * z.sts - 0.2 * z.age),
      );
    },
    // E[min(T, τ)] for an exponential time with P(T ≤ τ) = p.
    rmst(a, x) {
      const p = TRUE.p(a, x),
        h = -Math.log(1 - p) / TAU;
      return p / h;
    },
  };
  function simulate(n = N, seed = SEED) {
    const u = rng(seed),
      rows = [];
    for (let i = 0; i < n; i++) {
      const x = drawX(u),
        a = +(u() < TRUE.g(x)),
        p = TRUE.p(a, x),
        h = -Math.log(1 - p) / TAU,
        T = -Math.log(1 - u()) / h,
        cross = a === 0 && u() < 0.1 ? 1 : 0;
      rows.push({ id: i, ...x, a, y: +(T <= TAU), time: Math.min(T, TAU), cross });
    }
    return rows;
  }
  // Population truth by Monte Carlo over X (the conditional risks are exact).
  function truth(draws = 400000, seed = 777) {
    const u = rng(seed);
    let p1 = 0,
      p0 = 0,
      r1 = 0,
      r0 = 0;
    for (let i = 0; i < draws; i++) {
      const x = drawX(u);
      p1 += TRUE.p(1, x);
      p0 += TRUE.p(0, x);
      r1 += TRUE.rmst(1, x);
      r0 += TRUE.rmst(0, x);
    }
    return { risk1: p1 / draws, risk0: p0 / draws, rd: (p1 - p0) / draws, rr: p1 / p0, drmst: (r1 - r0) / draws, draws };
  }

  /* ---------- linear algebra and two regression engines ---------- */
  function solve(A, b) {
    const n = b.length,
      M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = M[r][n];
      for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
      x[r] = s / M[r][r];
    }
    return x;
  }
  // Logistic regression by Newton–Raphson with a small ridge on non-intercept terms.
  function logisticFit(Xs, y, ridge = 1e-3) {
    const p = Xs[0].length;
    let beta = new Array(p).fill(0);
    for (let it = 0; it < 50; it++) {
      const H = Array.from({ length: p }, () => new Array(p).fill(0)),
        g = beta.map((b, j) => (j ? -ridge * b : 0));
      for (let i = 0; i < Xs.length; i++) {
        const z = Xs[i];
        let eta = 0;
        for (let j = 0; j < p; j++) eta += z[j] * beta[j];
        const mu = expit(eta),
          w = mu * (1 - mu),
          r = y[i] - mu;
        for (let j = 0; j < p; j++) {
          g[j] += z[j] * r;
          const wz = w * z[j];
          for (let k = j; k < p; k++) H[j][k] += wz * z[k];
        }
      }
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < j; k++) H[j][k] = H[k][j];
        if (j) H[j][j] += ridge;
      }
      const step = solve(H, g);
      beta = beta.map((b, j) => b + step[j]);
      if (Math.max(...step.map(Math.abs)) < 1e-9) break;
    }
    return (z) => {
      let eta = 0;
      for (let j = 0; j < z.length; j++) eta += z[j] * beta[j];
      return expit(eta);
    };
  }
  function linearFit(Xs, y, ridge = 1e-3) {
    const p = Xs[0].length,
      A = Array.from({ length: p }, () => new Array(p).fill(0)),
      b = new Array(p).fill(0);
    for (let i = 0; i < Xs.length; i++) {
      const z = Xs[i];
      for (let j = 0; j < p; j++) {
        b[j] += z[j] * y[i];
        for (let k = j; k < p; k++) A[j][k] += z[j] * z[k];
      }
    }
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < j; k++) A[j][k] = A[k][j];
      if (j) A[j][j] += ridge;
    }
    const beta = solve(A, b);
    return (z) => {
      let s = 0;
      for (let j = 0; j < z.length; j++) s += z[j] * beta[j];
      return s;
    };
  }

  /* ---------- the library: four simple learners ---------- */
  const CONT = ["age", "lvef", "egfr", "sts"];
  const KNOTS = [-0.6, 0.6]; // on the z scale, about the 27th and 73rd percentiles of a normal
  const bases = {
    main: (z) => [1, ...CONT.map((k) => z[k]), z.female],
    inter: (z) => {
      const b = [1, ...CONT.map((k) => z[k]), z.female, ...CONT.map((k) => z[k] * z[k])];
      for (let i = 0; i < CONT.length; i++) for (let j = i + 1; j < CONT.length; j++) b.push(z[CONT[i]] * z[CONT[j]]);
      return b;
    },
    spline: (z) => [1, ...CONT.flatMap((k) => [z[k], ...KNOTS.map((t) => Math.max(0, z[k] - t))]), z.female],
  };
  // With treatment in the model: the outcome learners use A and A × (the same basis without intercept).
  const withA = (basis, full) => (z, a) => {
    const b = basis(z);
    return full ? [...b, ...b.map((v) => a * v)] : [...b, a];
  };
  const LEARNERS = [
    { id: "glm", label: "Logistic / linear, main terms", short: "Main terms" },
    { id: "glm-int", label: "With squares and interactions", short: "Interactions" },
    { id: "knn", label: "k-nearest neighbours (k = 40)", short: "k-NN" },
    { id: "spline", label: "Additive splines (GAM-like)", short: "Splines" },
  ];
  const KNN_K = 40;
  // target: "y" (binary 1-year event, uses A), "rmst" (min(T, 12), uses A), "g" (treatment, no A).
  function fitLearner(id, train, target) {
    const binary = target !== "rmst",
      useA = target !== "g",
      yOf = (r) => (target === "g" ? r.a : target === "y" ? r.y : r.time),
      zs = train.map((r) => Z(r)),
      ys = train.map(yOf);
    if (id === "knn") {
      const feat = (z) => [z.age, z.lvef, z.egfr, z.sts, z.female],
        pts = train.map((r, i) => ({ f: feat(zs[i]), y: ys[i], a: r.a })),
        pools = useA ? [0, 1].map((a) => pts.filter((p) => p.a === a)) : [pts, pts];
      return (row, a) => {
        const f = feat(Z(row)),
          pool = pools[useA ? a : 0],
          d = pool.map((p) => {
            let s = 0;
            for (let j = 0; j < 5; j++) s += (p.f[j] - f[j]) ** 2;
            return s;
          }),
          idx = d.map((_, i) => i).sort((i, j) => d[i] - d[j] || i - j),
          k = Math.min(KNN_K, pool.length);
        let s = 0;
        for (let i = 0; i < k; i++) s += pool[idx[i]].y;
        const m = s / k;
        return binary ? clip(m, 0.005, 0.995) : m;
      };
    }
    const basis = id === "glm" ? bases.main : id === "glm-int" ? bases.inter : bases.spline,
      design = useA ? withA(basis, id !== "glm") : (z) => basis(z),
      Xs = train.map((r, i) => design(zs[i], r.a)),
      f = (binary ? logisticFit : linearFit)(Xs, ys);
    return (row, a) => f(design(Z(row), a));
  }

  /* ---------- convex weights by exact minimisation of CV squared error over the simplex ---------- */
  // Enumerate supports; on each, minimise ||y − Pw||² subject to Σw = 1 (KKT), keep feasible w ≥ 0.
  function simplexLS(P, y) {
    const L = P[0].length,
      G = Array.from({ length: L }, (_, j) => Array.from({ length: L }, (_, k) => sum(P.map((r) => r[j] * r[k])))),
      c = Array.from({ length: L }, (_, j) => sum(P.map((r, i) => r[j] * y[i]))),
      yy = sum(y.map((v) => v * v)),
      risk = (w) => (yy - 2 * sum(w.map((v, j) => v * c[j])) + sum(w.map((v, j) => v * sum(w.map((u, k) => u * G[j][k]))))) / y.length;
    let best = null;
    for (let mask = 1; mask < 1 << L; mask++) {
      const S = [...Array(L).keys()].filter((j) => mask & (1 << j)),
        m = S.length,
        K = Array.from({ length: m + 1 }, (_, r) =>
          Array.from({ length: m + 1 }, (_, s) => (r < m && s < m ? 2 * G[S[r]][S[s]] : r === m && s === m ? 0 : 1)),
        ),
        rhs = [...S.map((j) => 2 * c[j]), 1];
      let sol;
      try {
        sol = solve(K, rhs);
      } catch (e) {
        continue;
      }
      if (sol.some((v) => !Number.isFinite(v))) continue;
      const w = new Array(L).fill(0);
      S.forEach((j, r) => (w[j] = sol[r]));
      if (w.some((v) => v < -1e-12)) continue;
      const wc = w.map((v) => Math.max(0, v)),
        tot = sum(wc),
        wn = wc.map((v) => v / tot),
        r = risk(wn);
      if (!best || r < best.risk - 1e-15) best = { w: wn, risk: r };
    }
    return best;
  }
  function folds(n, v, seed) {
    const u = rng(seed),
      idx = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(u() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const f = new Array(n);
    idx.forEach((id, k) => (f[id] = k % v));
    return f;
  }
  // Super Learner for one target on `rows`: V-fold CV predictions of each learner, CV risks
  // (mean squared error), convex weights minimising the CV risk, then every learner refitted on all rows.
  function superLearner(rows, target, { seed = SEED + 1, v = V, learners = LEARNERS.map((l) => l.id) } = {}) {
    const n = rows.length,
      fold = folds(n, v, seed),
      yOf = (r) => (target === "g" ? r.a : target === "y" ? r.y : r.time),
      y = rows.map(yOf),
      cv = rows.map(() => new Array(learners.length).fill(0)),
      base = new Array(n).fill(0); // CV prediction of the "no covariates" learner: the training mean
    for (let k = 0; k < v; k++) {
      const train = rows.filter((_, i) => fold[i] !== k),
        ybar = mean(train.map(yOf));
      rows.forEach((_, i) => {
        if (fold[i] === k) base[i] = ybar;
      });
      learners.forEach((id, j) => {
        const f = fitLearner(id, train, target);
        rows.forEach((r, i) => {
          if (fold[i] === k) cv[i][j] = f(r, r.a);
        });
      });
    }
    const cvRisk = learners.map((_, j) => mean(rows.map((_, i) => (y[i] - cv[i][j]) ** 2))),
      sl = simplexLS(cv, y),
      fits = learners.map((id) => fitLearner(id, rows, target)),
      predict = (row, a) => sum(fits.map((f, j) => (sl.w[j] ? sl.w[j] * f(row, a) : 0)));
    const baseRisk = mean(rows.map((_, i) => (y[i] - base[i]) ** 2));
    return { learners, cv, y, cvRisk, baseRisk, weights: sl.w, risk: sl.risk, predict };
  }
  // Re-solve the weights on stored CV predictions for a subset of learners (the library toggle).
  function reweigh(cv, y, keep) {
    const cols = keep.map((k) => k),
      P = cv.map((r) => cols.map((j) => r[j])),
      sl = simplexLS(P, y),
      w = new Array(cv[0].length).fill(0);
    cols.forEach((j, r) => (w[j] = sl.w[r]));
    return { weights: w, risk: sl.risk };
  }

  /* ---------- cross-fitting: every patient's nuisances come from a Super Learner that never saw them ---------- */
  function crossfit(rows, { seed = SEED + 2, v = V } = {}) {
    const n = rows.length,
      fold = folds(n, v, seed),
      out = rows.map(() => ({})),
      perFold = [];
    for (let k = 0; k < v; k++) {
      const train = rows.filter((_, i) => fold[i] !== k),
        sy = superLearner(train, "y", { seed: seed + 10 + k }),
        sr = superLearner(train, "rmst", { seed: seed + 20 + k }),
        sg = superLearner(train, "g", { seed: seed + 30 + k });
      perFold.push({ y: sy.weights, rmst: sr.weights, g: sg.weights });
      rows.forEach((r, i) => {
        if (fold[i] !== k) return;
        out[i] = {
          m1: clip(sy.predict(r, 1), 0.005, 0.995),
          m0: clip(sy.predict(r, 0), 0.005, 0.995),
          r1: clip(sr.predict(r, 1), 0, TAU),
          r0: clip(sr.predict(r, 0), 0, TAU),
          g: sg.predict(r, 0),
        };
      });
    }
    return { fold, preds: out, perFold };
  }

  /* ---------- estimators from the cross-fitted nuisances ---------- */
  const se = (D) => Math.sqrt(mean(D.map((d) => d * d)) / D.length);
  const ci = (e, s) => [e - 1.96 * s, e + 1.96 * s];
  function ess(w) {
    const s = sum(w);
    return (s * s) / sum(w.map((v) => v * v));
  }
  function estimate(rows, preds, { bound = BOUND } = {}) {
    const n = rows.length,
      A = rows.map((r) => r.a),
      Y = rows.map((r) => r.y),
      T = rows.map((r) => r.time),
      gRaw = preds.map((p) => p.g),
      g = gRaw.map((v) => clip(v, bound, 1 - bound)),
      m1 = preds.map((p) => p.m1),
      m0 = preds.map((p) => p.m0),
      r1 = preds.map((p) => p.r1),
      r0 = preds.map((p) => p.r0);
    // Unadjusted: difference in proportions (and in mean restricted time).
    const n1 = sum(A),
      n0 = n - n1,
      p1u = sum(rows.map((r) => r.a * r.y)) / n1,
      p0u = sum(rows.map((r) => (1 - r.a) * r.y)) / n0,
      Du = rows.map((r) => (r.a * (r.y - p1u)) / (n1 / n) - ((1 - r.a) * (r.y - p0u)) / (n0 / n)),
      t1u = sum(rows.map((r) => r.a * r.time)) / n1,
      t0u = sum(rows.map((r) => (1 - r.a) * r.time)) / n0;
    // AIPW / one-step: arm-specific influence functions.
    const arm = (m, sign) =>
      rows.map((r, i) => (sign ? (A[i] / g[i]) * (Y[i] - m[i]) : ((1 - A[i]) / (1 - g[i])) * (Y[i] - m[i]))),
      aug1 = arm(m1, 1),
      aug0 = arm(m0, 0),
      risk1 = mean(m1) + mean(aug1),
      risk0 = mean(m0) + mean(aug0),
      D1 = rows.map((_, i) => m1[i] + aug1[i] - risk1),
      D0 = rows.map((_, i) => m0[i] + aug0[i] - risk0),
      Drd = D1.map((d, i) => d - D0[i]),
      rd = risk1 - risk0,
      logRR = Math.log(risk1 / risk0),
      DlogRR = D1.map((d, i) => d / risk1 - D0[i] / risk0),
      seLogRR = se(DlogRR);
    // ΔRMST(12): AIPW on the restricted time min(T, 12).
    const a1 = rows.map((_, i) => (A[i] / g[i]) * (T[i] - r1[i])),
      a0 = rows.map((_, i) => ((1 - A[i]) / (1 - g[i])) * (T[i] - r0[i])),
      rm1 = mean(r1) + mean(a1),
      rm0 = mean(r0) + mean(a0),
      Drm = rows.map((_, i) => r1[i] + a1[i] - rm1 - (r0[i] + a0[i] - rm0));
    // TMLE: logistic fluctuation with two clever covariates H1 = A/g, H0 = (1 − A)/(1 − g), offset logit m_A.
    const H1 = rows.map((_, i) => A[i] / g[i]),
      H0 = rows.map((_, i) => (1 - A[i]) / (1 - g[i])),
      off = rows.map((_, i) => logit(A[i] ? m1[i] : m0[i]));
    let e1 = 0,
      e0 = 0;
    for (let it = 0; it < 50; it++) {
      let g1 = 0,
        g0 = 0,
        h11 = 0,
        h00 = 0,
        h10 = 0;
      for (let i = 0; i < n; i++) {
        const mu = expit(off[i] + e1 * H1[i] + e0 * H0[i]),
          w = mu * (1 - mu);
        g1 += H1[i] * (Y[i] - mu);
        g0 += H0[i] * (Y[i] - mu);
        h11 += w * H1[i] * H1[i];
        h00 += w * H0[i] * H0[i];
        h10 += w * H1[i] * H0[i];
      }
      const det = h11 * h00 - h10 * h10,
        s1 = (h00 * g1 - h10 * g0) / det,
        s0 = (h11 * g0 - h10 * g1) / det;
      e1 += s1;
      e0 += s0;
      if (Math.abs(s1) + Math.abs(s0) < 1e-12) break;
    }
    const m1s = m1.map((m, i) => expit(logit(m) + e1 / g[i])),
      m0s = m0.map((m, i) => expit(logit(m) + e0 / (1 - g[i]))),
      t1 = mean(m1s),
      t0 = mean(m0s),
      Dt = rows.map((_, i) => (A[i] / g[i]) * (Y[i] - m1s[i]) + m1s[i] - t1 - (((1 - A[i]) / (1 - g[i])) * (Y[i] - m0s[i]) + m0s[i] - t0)),
      Dt1 = rows.map((_, i) => (A[i] / g[i]) * (Y[i] - m1s[i]) + m1s[i] - t1),
      Dt0 = rows.map((_, i) => ((1 - A[i]) / (1 - g[i])) * (Y[i] - m0s[i]) + m0s[i] - t0);
    // Positivity diagnostics (on the unbounded fitted propensities).
    const w1 = rows.map((r, i) => (r.a ? 1 / gRaw[i] : 0)).filter((_, i) => A[i]),
      w0 = rows.map((r, i) => (r.a ? 0 : 1 / (1 - gRaw[i]))).filter((_, i) => !A[i]),
      outside = gRaw.filter((v) => v < bound || v > 1 - bound).length;
    return {
      n,
      n1,
      n0,
      crossovers: sum(rows.map((r) => r.cross)),
      unadjusted: { rd: p1u - p0u, se: se(Du), ci: ci(p1u - p0u, se(Du)), risk1: p1u, risk0: p0u, drmst: t1u - t0u },
      plugin: { rd: mean(m1) - mean(m0), risk1: mean(m1), risk0: mean(m0), drmst: mean(r1) - mean(r0) },
      aipw: {
        risk1,
        risk0,
        se1: se(D1),
        se0: se(D0),
        rd,
        se: se(Drd),
        ci: ci(rd, se(Drd)),
        rr: risk1 / risk0,
        seLogRR,
        rrCI: [Math.exp(logRR - 1.96 * seLogRR), Math.exp(logRR + 1.96 * seLogRR)],
        D: Drd,
        correction: mean(aug1) - mean(aug0),
      },
      tmle: { risk1: t1, risk0: t0, rd: t1 - t0, se: se(Dt), ci: ci(t1 - t0, se(Dt)), eps: [e1, e0], score: [mean(Dt1), mean(Dt0)] },
      rmst: { rm1, rm0, drmst: rm1 - rm0, se: se(Drm), ci: ci(rm1 - rm0, se(Drm)) },
      positivity: {
        gMin: Math.min(...gRaw),
        gMax: Math.max(...gRaw),
        outside,
        bound,
        ess1: ess(w1),
        ess0: ess(w0),
        maxW1: Math.max(...w1),
        maxW0: Math.max(...w0),
      },
    };
  }

  // Per-patient predictions stored by scripts/capstone-precompute.cjs as [m1, m0, r1, r0, g].
  const predsFromData = (d) => d.preds.map(([m1, m0, r1, r0, g]) => ({ m1, m0, r1, r0, g }));

  /* ---------- sensitivity: the E-value for a risk ratio ---------- */
  function eValue(rr) {
    const r = rr < 1 ? 1 / rr : rr;
    return r + Math.sqrt(r * (r - 1));
  }
  // E-value for the confidence limit closest to the null; 1 if the interval contains 1.
  function eValueCI(lo, hi) {
    if (lo <= 1 && hi >= 1) return 1;
    return eValue(hi < 1 ? hi : lo);
  }

  // A measured benchmark for the E-value, on the E-value's own two scales, for the strongest measured
  // confounder (STS-PROM, top third versus the rest; U = 1 in the top third):
  //   RR_EU = P(U = 1 | A = 1) / P(U = 1 | A = 0), the confounder's prevalence ratio across strategies;
  //   RR_UD = P(Y = 1 | U = 1, A = 0) / P(Y = 1 | U = 0, A = 0), its outcome risk ratio within standard care.
  function benchmark(rows) {
    const cut = [...rows.map((r) => r.sts)].sort((a, b) => a - b)[Math.floor((2 * rows.length) / 3)],
      U = (r) => +(r.sts >= cut),
      pr = (set, f) => mean(set.map(f)),
      t = rows.filter((r) => r.a),
      c = rows.filter((r) => !r.a),
      rrEU = pr(t, U) / pr(c, U),
      rrUD = pr(c.filter(U), (r) => r.y) / pr(c.filter((r) => !U(r)), (r) => r.y);
    return { cut, rrEU, rrUD, bias: (rrEU * rrUD) / (rrEU + rrUD - 1) };
  }
  // Ding and VanderWeele's joint bias factor: the largest factor by which a confounder with these
  // two associations can move a risk ratio.
  const biasFactor = (rrEU, rrUD) => (rrEU * rrUD) / (rrEU + rrUD - 1);

  return {
    N,
    SEED,
    benchmark,
    biasFactor,
    TAU,
    BOUND,
    V,
    TRUE,
    Z,
    LEARNERS,
    KNN_K,
    rng,
    randn,
    simulate,
    truth,
    logisticFit,
    linearFit,
    fitLearner,
    simplexLS,
    folds,
    superLearner,
    reweigh,
    crossfit,
    estimate,
    predsFromData,
    ess,
    eValue,
    eValueCI,
    expit,
    logit,
  };
});
