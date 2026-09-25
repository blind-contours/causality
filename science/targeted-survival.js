/* Targeted survival curves and RMST in discrete time. Pure computations, no DOM.
 *
 * Teaching world (exact, known truth):
 *   months t = 1..K (K = 12); X = severity in {0 low, 1 mid, 2 high}, P(X) = PX;
 *   A ~ Bernoulli(g(1|X)), g(1|x) = expit(-1.1 + 1.1x) (sicker patients are treated more often);
 *   event hazard  λ(t|a,x) = P(T = t | T ≥ t, a, x) = expit(-3.7 + 0.04(t-1) + 0.75x - 0.6a + 0.15ax);
 *   censoring hazard h(t|a,x) = P(C = t | C ≥ t, a, x) = expit(-2.8 - 0.5x + 0.3a), t = 1..K-1
 *   (patients who feel well drop out more often; treated patients slightly more),
 *   and everyone still followed after month K is administratively censored at K.
 *   T and C are independent given (A, X). In month t the event is checked before censoring,
 *   so a person censored at t is known to have survived month t.
 *   Observed: O = (X, A, T~ = min(T, C), Δ = 1{T ≤ C}).
 * Target: ψ_a(w) = E_X[ Σ_s w_s S(s|a,X) ], S(s|a,x) = Π_{t≤s}(1 - λ(t|a,x)), S(0) = 1.
 *   S_a(τ): w = indicator of s = τ.  RMST_a(τ) in months: w_s = 1 for s = 0..τ-1,
 *   because E[min(T, τ)] = Σ_{s=0}^{τ-1} P(T > s) for integer-valued T.
 * Efficient influence function (nonparametric observed-data model, coarsening at random):
 *   D_a(O) = Σ_s w_s S(s|a,X) - ψ
 *            - 1{A=a}/g(a|X) Σ_{t=1}^{K} [ Σ_{s≥t} w_s S(s|a,X) / S(t|a,X) ] / G(t-|a,X)
 *                                     × ( 1{T~=t, Δ=1} - 1{T~≥t} λ(t|a,X) ),
 *   with G(t-|a,x) = Π_{k<t}(1 - h(k|a,x)) = P(C ≥ t | a, x).
 *   For w = 1{s=τ} this is the form of Moore & van der Laan (2009) and Benkeser, Carone & Gilbert (2018).
 *   The tests check it against a numerical Gateaux derivative of the identification functional. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalTargetedSurvival = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  const K = 12,
    PX = [0.4, 0.35, 0.25],
    XS = [0, 1, 2],
    expit = (v) => 1 / (1 + Math.exp(-v)),
    logit = (p) => Math.log(p / (1 - p)),
    sum = (a) => a.reduce((s, v) => s + v, 0),
    mean = (a) => sum(a) / a.length;

  /* ---------- the data-generating process ---------- */
  const TRUE = {
    g1: (x) => expit(-1.1 + 1.1 * x),
    lambda: (t, a, x) => expit(-3.7 + 0.04 * (t - 1) + 0.75 * x - 0.6 * a + 0.15 * a * x),
    censor: (t, a, x) => (t >= K ? 0 : expit(-2.8 - 0.5 * x + 0.3 * a)),
  };
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
  // Nuisance table in one shape: lam[a][x][t], hc[a][x][t] for t = 1..K (index 0 unused), g[a][x].
  function derive(nu) {
    const S = [0, 1].map((a) =>
        XS.map((x) => {
          const s = [1];
          for (let t = 1; t <= K; t++) s[t] = s[t - 1] * (1 - nu.lam[a][x][t]);
          return s;
        }),
      ),
      // G[a][x][t] = G(t-) = P(C ≥ t): probability of still being followed when month t starts.
      G = [0, 1].map((a) =>
        XS.map((x) => {
          const q = [1, 1];
          for (let t = 2; t <= K; t++) q[t] = q[t - 1] * (1 - nu.hc[a][x][t - 1]);
          return q;
        }),
      );
    return { ...nu, S, G };
  }
  const table = (f) => [0, 1].map((a) => XS.map((x) => [NaN, ...Array.from({ length: K }, (_, i) => f(i + 1, a, x))]));
  const TRUTH_NU = derive({
    lam: table(TRUE.lambda),
    hc: table(TRUE.censor),
    g: [0, 1].map((a) => XS.map((x) => (a ? TRUE.g1(x) : 1 - TRUE.g1(x)))),
    spec: { event: "true", nuis: "true" },
  });
  const weightsS = (tau) => Array.from({ length: K + 1 }, (_, s) => +(s === tau));
  const weightsRMST = (tau) => Array.from({ length: K + 1 }, (_, s) => +(s < tau));
  // Exact target: ψ_a(w) = Σ_x P(x) Σ_s w_s S(s|a,x).
  function truth(a, w) {
    return sum(XS.map((x) => PX[x] * sum(w.map((ws, s) => ws * TRUTH_NU.S[a][x][s]))));
  }
  const truthCurve = (a) => Array.from({ length: K + 1 }, (_, t) => truth(a, weightsS(t)));

  function simulate(n, seed) {
    const u = rng(seed),
      rows = [];
    for (let i = 0; i < n; i++) {
      const r = u(),
        x = r < PX[0] ? 0 : r < PX[0] + PX[1] ? 1 : 2,
        a = +(u() < TRUE.g1(x));
      let T = K + 1,
        C = K; // C = K means followed to the end of month K
      for (let t = 1; t <= K; t++)
        if (u() < TRUE.lambda(t, a, x)) {
          T = t;
          break;
        }
      for (let t = 1; t < K; t++)
        if (u() < TRUE.censor(t, a, x)) {
          C = t;
          break;
        }
      rows.push({ id: i, x, a, time: Math.min(T, C), event: +(T <= C), latentT: T });
    }
    return rows;
  }

  /* ---------- aggregated person-month counts ---------- */
  // atRisk[a][x][t]: T~ ≥ t. events[a][x][t]: T~ = t, Δ = 1.
  // cRisk[a][x][t]: at risk of censoring after month t (T~ > t or censored at t), cens[a][x][t]: T~ = t, Δ = 0, t < K.
  function counts(rows) {
    const z = () => [0, 1].map(() => XS.map(() => new Array(K + 1).fill(0))),
      c = { atRisk: z(), events: z(), cRisk: z(), cens: z(), nAX: [0, 1].map(() => XS.map(() => 0)), n: rows.length };
    for (const r of rows) {
      c.nAX[r.a][r.x]++;
      for (let t = 1; t <= r.time; t++) c.atRisk[r.a][r.x][t]++;
      if (r.event) c.events[r.a][r.x][r.time]++;
      for (let t = 1; t < K && t <= r.time; t++) if (t < r.time || !r.event) c.cRisk[r.a][r.x][t]++;
      if (!r.event && r.time < K) c.cens[r.a][r.x][r.time]++;
    }
    return c;
  }

  /* ---------- binomial logistic regression by Newton–Raphson on grouped data ---------- */
  function solve(A, b) {
    const n = b.length,
      M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) {
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
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
  // cells: [{z: covariate vector, y: successes, m: trials, off: offset}]
  function logistic(cells, p, ridge = 1e-6) {
    let beta = new Array(p).fill(0);
    for (let it = 0; it < 60; it++) {
      const H = Array.from({ length: p }, () => new Array(p).fill(0)),
        grad = beta.map((b) => -ridge * b);
      for (const c of cells) {
        if (!c.m) continue;
        const eta = (c.off || 0) + c.z.reduce((s, v, j) => s + v * beta[j], 0),
          mu = expit(eta),
          w = c.m * mu * (1 - mu);
        c.z.forEach((v, j) => {
          grad[j] += v * (c.y - c.m * mu);
          c.z.forEach((u, k) => (H[j][k] += v * u * w));
        });
      }
      for (let j = 0; j < p; j++) H[j][j] += ridge;
      const step = solve(H, grad);
      beta = beta.map((b, j) => b + step[j]);
      if (Math.max(...step.map(Math.abs)) < 1e-10) break;
    }
    return beta;
  }
  // Pooled discrete-time hazard. "right": month factor + a separate effect for each (a, x) cell
  // (contains the true model). "wrong": month factor + treatment only (severity left out).
  function fitHazard(c, kind, spec) {
    const Y = kind === "event" ? c.events : c.cens,
      R = kind === "event" ? c.atRisk : c.cRisk,
      last = kind === "event" ? K : K - 1,
      cellIndex = (a, x) => a * 3 + x, // 0 is the reference cell (a=0, x=0)
      p = spec === "right" ? last + 5 : last + 1,
      design = (t, a, x) => {
        const z = new Array(p).fill(0);
        z[t - 1] = 1;
        if (spec === "right") {
          const k = cellIndex(a, x);
          if (k) z[last + k - 1] = 1;
        } else z[last] = a;
        return z;
      },
      cells = [];
    for (const a of [0, 1])
      for (const x of XS)
        for (let t = 1; t <= last; t++) cells.push({ z: design(t, a, x), y: Y[a][x][t], m: R[a][x][t] });
    const beta = logistic(cells, p);
    return table((t, a, x) => (t > last ? 0 : expit(design(t, a, x).reduce((s, v, j) => s + v * beta[j], 0))));
  }
  function fitG(c, spec) {
    const n1 = XS.map((x) => c.nAX[1][x]),
      nx = XS.map((x) => c.nAX[0][x] + c.nAX[1][x]),
      marg = sum(n1) / c.n,
      g1 = XS.map((x) => (spec === "right" ? n1[x] / nx[x] : marg));
    return [0, 1].map((a) => XS.map((x) => (a ? g1[x] : 1 - g1[x])));
  }
  // spec = {event: "right"|"wrong", nuis: "right"|"wrong"}; nuis covers both censoring and treatment.
  function fit(rows, spec = { event: "right", nuis: "right" }, c = counts(rows)) {
    return derive({
      lam: fitHazard(c, "event", spec.event),
      hc: fitHazard(c, "censor", spec.nuis),
      g: fitG(c, spec.nuis),
      spec,
    });
  }

  /* ---------- estimators ---------- */
  // Unweighted Kaplan–Meier in arm a (monthly grid): S[0..K].
  function kmArm(c, a) {
    const s = [1];
    for (let t = 1; t <= K; t++) {
      const d = sum(XS.map((x) => c.events[a][x][t])),
        r = sum(XS.map((x) => c.atRisk[a][x][t]));
      s[t] = s[t - 1] * (r ? 1 - d / r : 1);
    }
    return s;
  }
  // IPTW + IPCW weighted KM: each person in arm a at risk at t carries 1/(g(a|X) G(t-|a,X)).
  function weightedKM(c, a, nu) {
    const s = [1];
    for (let t = 1; t <= K; t++) {
      let d = 0,
        r = 0;
      for (const x of XS) {
        const w = 1 / (nu.g[a][x] * nu.G[a][x][t]);
        d += w * c.events[a][x][t];
        r += w * c.atRisk[a][x][t];
      }
      s[t] = s[t - 1] * (r ? 1 - d / r : 1);
    }
    return s;
  }
  const targetOf = (nu, a, x, w) => sum(w.map((ws, s) => ws * nu.S[a][x][s]));
  const lastW = (w) => w.reduce((m, v, s) => (v ? s : m), 0);
  // Clever covariate H(t|a,x) = Σ_{s≥t} w_s S(s|a,x)/S(t|a,x) / G(t-|a,x) (without the 1/g factor).
  function clever(nu, a, x, t, w, kappa = 1) {
    let num = 0;
    for (let s = t; s < w.length; s++) num += w[s] * nu.S[a][x][s];
    const St = nu.S[a][x][t];
    const ratio = St > 0 ? num / St : 0;
    return ratio * (1 + kappa * (1 / nu.G[a][x][t] - 1));
  }
  // Per-person influence-function pieces at the fitted nuisances.
  // plug = Σ w S(·|a,X) − ψ; augG uses no censoring weight; augC = extra from 1/G; kappa scales the 1/G − 1 part.
  function eif(rows, a, nu, w, kappa = 1) {
    const tmax = lastW(w),
      m = rows.map((r) => targetOf(nu, a, r.x, w)),
      plugin = mean(m),
      augTot = [],
      augG = [];
    for (const r of rows) {
      let full = 0,
        noC = 0;
      if (r.a === a) {
        const ig = 1 / nu.g[a][r.x];
        for (let t = 1; t <= Math.min(r.time, tmax); t++) {
          const res = (r.event && r.time === t ? 1 : 0) - nu.lam[a][r.x][t];
          full -= ig * clever(nu, a, r.x, t, w, kappa) * res;
          noC -= ig * clever(nu, a, r.x, t, w, 0) * res;
        }
      }
      augTot.push(full);
      augG.push(noC);
    }
    const correction = mean(augTot),
      est = plugin + correction,
      D = rows.map((_, i) => m[i] - est + augTot[i]),
      se = Math.sqrt(mean(D.map((d) => d * d)) / rows.length);
    return {
      plugin,
      correction,
      est,
      se,
      D,
      parts: rows.map((_, i) => ({ plug: m[i] - plugin, augG: augG[i], augC: augTot[i] - augG[i] })),
    };
  }
  // TMLE: fluctuate logit λ(t|a,x) by ε·H(t|a,x)/g(a|x) for t ≤ tmax; refit H; iterate until the
  // augmentation mean is negligible relative to the standard error.
  function tmle(rows, a, nu, w, c = counts(rows), maxIter = 100) {
    const tmax = lastW(w);
    let cur = nu,
      iter = 0,
      e = eif(rows, a, cur, w);
    while (Math.abs(e.correction) > 1e-4 * e.se && iter < maxIter) {
      const cells = [];
      for (const x of XS)
        for (let t = 1; t <= tmax; t++)
          cells.push({
            z: [clever(cur, a, x, t, w) / cur.g[a][x]],
            y: c.events[a][x][t],
            m: c.atRisk[a][x][t],
            off: logit(Math.min(1 - 1e-12, Math.max(1e-12, cur.lam[a][x][t]))),
          });
      const eps = logistic(cells, 1, 0)[0],
        lam = cur.lam.map((arm, aa) =>
          arm.map((row, x) =>
            row.map((v, t) =>
              aa !== a || t < 1 || t > tmax ? v : expit(logit(Math.min(1 - 1e-12, Math.max(1e-12, v))) + (eps * clever(cur, a, x, t, w)) / cur.g[a][x]),
            ),
          ),
        );
      cur = derive({ ...cur, lam });
      e = eif(rows, a, cur, w);
      iter++;
    }
    return { est: e.plugin, se: e.se, D: e.D, iterations: iter, residual: e.correction, nu: cur };
  }
  const gformula = (rows, a, nu, w) => mean(rows.map((r) => targetOf(nu, a, r.x, w)));
  const rmstOf = (curve, tau) => sum(curve.slice(0, tau));

  /* ---------- Cox proportional hazards (Breslow ties) ---------- */
  function cox(rows, covs) {
    const p = covs(rows[0]).length,
      Z = rows.map(covs);
    let beta = new Array(p).fill(0),
      info = null;
    for (let it = 0; it < 50; it++) {
      const grad = new Array(p).fill(0),
        H = Array.from({ length: p }, () => new Array(p).fill(0));
      for (let t = 1; t <= K; t++) {
        const dead = rows.filter((r) => r.event && r.time === t);
        if (!dead.length) continue;
        let s0 = 0;
        const s1 = new Array(p).fill(0),
          s2 = Array.from({ length: p }, () => new Array(p).fill(0));
        rows.forEach((r, i) => {
          if (r.time < t) return;
          const e = Math.exp(Z[i].reduce((s, v, j) => s + v * beta[j], 0));
          s0 += e;
          Z[i].forEach((v, j) => {
            s1[j] += e * v;
            Z[i].forEach((u, k) => (s2[j][k] += e * v * u));
          });
        });
        const d = dead.length;
        dead.forEach((r) => covs(r).forEach((v, j) => (grad[j] += v)));
        for (let j = 0; j < p; j++) {
          grad[j] -= (d * s1[j]) / s0;
          for (let k = 0; k < p; k++) H[j][k] += d * (s2[j][k] / s0 - (s1[j] * s1[k]) / (s0 * s0));
        }
      }
      const step = solve(H, grad);
      beta = beta.map((b, j) => b + step[j]);
      info = H;
      if (Math.max(...step.map(Math.abs)) < 1e-10) break;
    }
    // Invert the information for the standard error of the first coefficient.
    const e0 = solve(info, [1, ...new Array(p - 1).fill(0)]);
    return { beta, se: Math.sqrt(e0[0]), hr: Math.exp(beta[0]) };
  }

  /* ---------- exact observed-data law (for identities and the efficiency bound) ---------- */
  function observedLaw(nu = TRUTH_NU) {
    const law = [];
    for (const x of XS)
      for (const a of [0, 1]) {
        const pax = PX[x] * nu.g[a][x];
        for (let t = 1; t <= K; t++) {
          const alive = nu.S[a][x][t - 1] * nu.G[a][x][t];
          law.push({ x, a, time: t, event: 1, p: pax * alive * nu.lam[a][x][t] });
          const survived = nu.S[a][x][t] * nu.G[a][x][t];
          law.push({ x, a, time: t, event: 0, p: pax * survived * (t < K ? nu.hc[a][x][t] : 1) });
        }
      }
    return law;
  }
  // Nuisances implied by any discrete observed-data law (observed hazards; no model).
  function lawNuisance(law) {
    const px = XS.map((x) => sum(law.filter((o) => o.x === x).map((o) => o.p))),
      pr = (f) => sum(law.filter(f).map((o) => o.p));
    const lam = table((t, a, x) => {
        const risk = pr((o) => o.a === a && o.x === x && o.time >= t);
        return risk > 0 ? pr((o) => o.a === a && o.x === x && o.time === t && o.event) / risk : 0;
      }),
      hc = table((t, a, x) => {
        if (t >= K) return 0;
        const risk = pr((o) => o.a === a && o.x === x && (o.time > t || (o.time === t && !o.event)));
        return risk > 0 ? pr((o) => o.a === a && o.x === x && o.time === t && !o.event) / risk : 0;
      }),
      g = [0, 1].map((a) => XS.map((x) => pr((o) => o.a === a && o.x === x) / px[x]));
    return { px, nu: derive({ lam, hc, g }) };
  }
  // Identification functional Ψ(P) = Σ_x P(x) Σ_s w_s Π_{t≤s}(1 − λ_obs(t|a,x)).
  function psiOfLaw(law, a, w) {
    const { px, nu } = lawNuisance(law);
    return sum(XS.map((x) => px[x] * targetOf(nu, a, x, w)));
  }
  // D evaluated at a single observation o under the nuisances nu and target value psi.
  function eifAt(o, a, nu, w, psi) {
    let aug = 0;
    if (o.a === a)
      for (let t = 1; t <= Math.min(o.time, lastW(w)); t++)
        aug -= (clever(nu, a, o.x, t, w) / nu.g[a][o.x]) * ((o.event && o.time === t ? 1 : 0) - nu.lam[a][o.x][t]);
    return targetOf(nu, a, o.x, w) - psi + aug;
  }
  // Efficiency bound E[D²] for a contrast Σ_a c_a ψ_a(w) under the truth.
  function efficiencyBound(w, contrast = { 1: 1, 0: 0 }) {
    const law = observedLaw(),
      psi = { 0: truth(0, w), 1: truth(1, w) };
    let m1 = 0,
      m2 = 0;
    for (const o of law) {
      const d = sum([0, 1].map((a) => (contrast[a] || 0) * eifAt(o, a, TRUTH_NU, w, psi[a])));
      m1 += o.p * d;
      m2 += o.p * d * d;
    }
    return { mean: m1, variance: m2 };
  }

  /* ---------- one study analysed end to end (used by the lesson) ---------- */
  function analyze({ n = 1000, seed = 20260925, tau = 12, spec = { event: "right", nuis: "right" } } = {}) {
    const rows = simulate(n, seed),
      c = counts(rows),
      nu = fit(rows, spec, c),
      arms = [0, 1].map((a) => {
        const oneStep = Array.from({ length: K + 1 }, (_, t) =>
          t ? eif(rows, a, nu, weightsS(t)) : { est: 1, se: 0, plugin: 1, correction: 0 },
        );
        return {
          truth: truthCurve(a),
          km: kmArm(c, a),
          wkm: weightedKM(c, a, nu),
          plugin: oneStep.map((e) => e.plugin),
          oneStep: oneStep.map((e) => e.est),
          se: oneStep.map((e) => e.se),
          sTau: eif(rows, a, nu, weightsS(tau)),
          sTauTmle: tmle(rows, a, nu, weightsS(tau), c),
          rmst: eif(rows, a, nu, weightsRMST(tau)),
          rmstTmle: tmle(rows, a, nu, weightsRMST(tau), c),
        };
      });
    return { rows, counts: c, nu, arms, tau, n, seed };
  }
  // Difference contrast from two per-arm results (the arms use different people, IFs add).
  function contrast(e1, e0) {
    const D = e1.D.map((d, i) => d - e0.D[i]);
    return { est: e1.est - e0.est, se: Math.sqrt(mean(D.map((d) => d * d)) / D.length) };
  }

  return {
    K,
    PX,
    TRUE,
    TRUTH_NU,
    rng,
    derive,
    weightsS,
    weightsRMST,
    truth,
    truthCurve,
    simulate,
    counts,
    logistic,
    fitHazard,
    fitG,
    fit,
    kmArm,
    weightedKM,
    clever,
    eif,
    tmle,
    gformula,
    rmstOf,
    cox,
    observedLaw,
    lawNuisance,
    psiOfLaw,
    eifAt,
    efficiencyBound,
    analyze,
    contrast,
  };
});
