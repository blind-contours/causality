/* Clone, censor, weight: a monthly discrete-time registry with known potential outcomes.
 *
 * World (all times in months from eligibility, t = 0):
 *   Frailty X ~ N(0, 1), measured at eligibility.
 *   Month k (the interval from k to k + 1): a patient alive at k dies during month k with probability
 *     expit(a0 + aX·X + log(OR)), where OR = 1 before the procedure, opOR in the month right after
 *     it (operative risk), and postOR in every later month. A death in month k is recorded at time k + 1.
 *   Decision at time t = 1, 2, ..., K − 1 (end of month t − 1): a patient alive and still waiting
 *     receives the procedure with probability expit(g0 + gX·X + gT·(t − 1)). Frail patients wait longer.
 *   Follow-up ends at K months (administrative end).
 *
 * Strategies (grace period G, in months):
 *   "grace": receive the procedure by month G. Inside the window the usual timing applies; anyone
 *            still alive and waiting at t = G is operated then.
 *   "never": never receive the procedure during follow-up.
 *
 * Common random numbers: each patient carries one uniform per month for death (U_k) and one per
 * decision (V_t). The observed course and both strategies reuse them, so every patient has a
 * well-defined potential survival time under each strategy and the observed data are consistent
 * with the strategy the patient actually followed.
 *
 * No DOM. Browser: window.CausalCCW. Node: module.exports. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalCCW = api;
})(globalThis, function () {
  const DEFAULTS = Object.freeze({
    n: 3000,
    seed: 20260925,
    K: 24,
    grace: 3,
    a0: -3.4,
    aX: 0.9,
    opOR: 2.5,
    postOR: 0.4,
    g0: -1.5,
    gX: -0.7,
    gT: -0.15,
  });
  const expit = (z) => 1 / (1 + Math.exp(-z)),
    logit = (p) => Math.log(p / (1 - p));

  // Same generator as science/core.js (mulberry32), duplicated so this file stands alone.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randn = (r) =>
    Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, r()))) *
    Math.cos(2 * Math.PI * r());

  const cfg = (c = {}) => ({ ...DEFAULTS, ...c });
  // Monthly death probability. since = months since the procedure at the start of the month (null = waiting).
  const pDeath = (c, x, since) =>
    expit(
      c.a0 +
        c.aX * x +
        (since === null ? 0 : Math.log(since === 0 ? c.opOR : c.postOR)),
    );
  const pSurg = (c, x, t) => expit(c.g0 + c.gX * x + c.gT * (t - 1));

  /* Run one patient forward under a policy. policy(t) returns "natural", "force" or "block".
   * Returns {death: time of death or null (alive at K), surgery: time or null}. */
  function run(c, x, U, V, policy) {
    const base = c.a0 + c.aX * x,
      pWait = expit(base),
      pOp = expit(base + Math.log(c.opOR)),
      pPost = expit(base + Math.log(c.postOR));
    let s = null;
    for (let k = 0; k < c.K; k++) {
      if (k > 0 && s === null) {
        const rule = policy(k);
        if (rule === "force" || (rule === "natural" && V[k] < pSurg(c, x, k)))
          s = k;
      }
      const p = s === null ? pWait : s === k ? pOp : pPost;
      if (U[k] < p) return { death: k + 1, surgery: s };
    }
    return { death: null, surgery: s };
  }
  const policies = {
    observed: () => () => "natural",
    grace: (G) => (t) => (t < G ? "natural" : t === G ? "force" : "natural"),
    never: () => () => "block",
  };

  /* Simulate the registry. Each patient: x, observed {death, surgery}, and potential outcomes
   * po.grace and po.never, both computed from the same uniforms. */
  function simulate(input = {}) {
    const c = cfg(input),
      r = rng(c.seed),
      patients = [];
    for (let i = 0; i < c.n; i++) {
      const x = randn(r),
        U = Array.from({ length: c.K }, r),
        V = Array.from({ length: c.K }, r);
      patients.push({
        id: i,
        x,
        obs: run(c, x, U, V, policies.observed()),
        po: {
          grace: run(c, x, U, V, policies.grace(c.grace)),
          never: run(c, x, U, V, policies.never()),
        },
      });
    }
    return { config: c, patients };
  }

  /* Clone every patient into both arms and censor each clone when the real patient deviates.
   * A clone: {id, x, arm, exit, status: "death" | "censored" | "end", surgery}.
   * exit is the time the clone leaves the risk set; at risk during month k iff exit > k. */
  function cloneOne(p, G, K) {
    const { death, surgery } = p.obs,
      end = death ?? K,
      status = death ? "death" : "end";
    // Arm "grace": consistent if operated by G, or if dead before any deviation (death ≤ G while waiting).
    let grace;
    if (surgery !== null && surgery <= G)
      grace = { exit: end, status, surgery };
    else if (death !== null && death <= G)
      grace = { exit: death, status: "death", surgery: null };
    else if (G >= K) grace = { exit: end, status, surgery };
    else grace = { exit: G, status: "censored", surgery };
    // Arm "never": censored at the procedure, otherwise follows the observed course.
    const never =
      surgery !== null
        ? { exit: surgery, status: "censored", surgery }
        : { exit: end, status, surgery: null };
    return [
      { id: p.id, x: p.x, arm: "grace", ...grace },
      { id: p.id, x: p.x, arm: "never", ...never },
    ];
  }
  const clone = (patients, G, K) =>
    patients.flatMap((p) => cloneOne(p, G, K));

  /* Pooled logistic regression of the procedure decision on (1, X, t − 1), or (1, t − 1) when
   * useX is false, over every decision time at which a patient was alive and waiting. Newton–Raphson. */
  function fitDecision(patients, K, useX = true) {
    const xs = [],
      ts = [],
      ys = [];
    for (const p of patients) {
      const { death, surgery } = p.obs,
        last = Math.min(surgery ?? K - 1, death === null ? K - 1 : death - 1);
      for (let t = 1; t <= last; t++) {
        xs.push(useX ? p.x : 0);
        ts.push(t - 1);
        ys.push(surgery === t ? 1 : 0);
      }
    }
    const d = useX ? 3 : 2,
      n = ys.length,
      z = (i, j) => (j === 0 ? 1 : useX && j === 1 ? xs[i] : ts[i]);
    let b = new Array(d).fill(0);
    for (let it = 0; it < 50; it++) {
      const g = new Array(d).fill(0),
        H = Array.from({ length: d }, () => new Array(d).fill(0));
      for (let i = 0; i < n; i++) {
        let eta = b[0];
        for (let j = 1; j < d; j++) eta += b[j] * z(i, j);
        const m = expit(eta),
          w = m * (1 - m);
        for (let j = 0; j < d; j++) {
          const zj = z(i, j);
          g[j] += (ys[i] - m) * zj;
          for (let l = j; l < d; l++) H[j][l] += w * zj * z(i, l);
        }
      }
      for (let j = 0; j < d; j++) for (let l = 0; l < j; l++) H[j][l] = H[l][j];
      const step = solve(H, g);
      b = b.map((v, j) => v + step[j]);
      if (Math.max(...step.map(Math.abs)) < 1e-10) break;
    }
    const coef = useX
      ? { g0: b[0], gX: b[1], gT: b[2] }
      : { g0: b[0], gX: 0, gT: b[1] };
    return { ...coef, rows: n, events: ys.reduce((a, v) => a + v, 0) };
  }
  function solve(A, y) {
    const n = y.length,
      M = A.map((row, i) => [...row, y[i]]);
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++)
        if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      [M[i], M[p]] = [M[p], M[i]];
      for (let r = 0; r < n; r++) {
        if (r === i) continue;
        const f = M[r][i] / M[i][i];
        for (let k = i; k <= n; k++) M[r][k] -= f * M[i][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /* Inverse probability of (artificial) censoring weight for a clone during month k.
   * "never": the clone passed decisions t = 1..k without the procedure: ∏ 1/(1 − p̂_t).
   * "grace": from month G on, a clone operated exactly at G stands in for everyone who was still
   * waiting at G: 1/p̂_G. Clones operated earlier were never at risk of this censoring: weight 1. */
  function weight(clone, k, fit, G) {
    const p = (t) => expit(fit.g0 + fit.gX * clone.x + fit.gT * (t - 1));
    if (clone.arm === "never") {
      let w = 1;
      for (let t = 1; t <= k; t++) w /= 1 - p(t);
      return w;
    }
    if (k >= G && clone.surgery === G) return 1 / p(G);
    return 1;
  }

  /* Discrete-time (weighted) Kaplan–Meier for one arm. weightAt(clone, k) → weight during month k.
   * Returns S at times 0..K. Deaths at k + 1 are compared with the weighted risk set of month k. */
  function km(clones, K, weightAt = () => 1) {
    const S = [1];
    for (let k = 0; k < K; k++) {
      let risk = 0,
        dead = 0;
      for (const c of clones)
        if (c.exit > k) {
          const w = weightAt(c, k);
          risk += w;
          if (c.status === "death" && c.exit === k + 1) dead += w;
        }
      S.push(S[k] * (risk > 0 ? 1 - dead / risk : 1));
    }
    return S;
  }
  // RMST through K for a curve on the monthly grid: survival time is recorded at the month's end.
  const rmst = (S, K = S.length - 1) =>
    S.slice(0, K).reduce((a, b) => a + b, 0);

  // Truth in the simulated patients: the empirical curve of their potential survival times.
  function sampleTruth(patients, arm, K) {
    const S = [];
    for (let k = 0; k <= K; k++)
      S.push(
        patients.filter((p) => p.po[arm].death === null || p.po[arm].death > k)
          .length / patients.length,
      );
    return S;
  }

  /* Exact population truth: forward recursion over (waiting, first post-op month, later) for
   * each frailty value, integrated over X ~ N(0,1) on a fine grid. Also returns the mean frailty
   * among those alive at each month under the strategy. */
  function populationTruth(input = {}, arm = "grace") {
    const c = cfg(input),
      h = 0.01,
      S = new Array(c.K + 1).fill(0),
      XS = new Array(c.K + 1).fill(0);
    let mass = 0;
    for (let x = -8; x <= 8 + 1e-9; x += h) {
      const f = Math.exp(-0.5 * x * x);
      mass += f;
      let wait = 1,
        op1 = 0,
        post = 0;
      S[0] += f;
      XS[0] += f * x;
      for (let k = 0; k < c.K; k++) {
        if (k > 0 && wait > 0) {
          const q =
            arm === "never"
              ? 0
              : k === c.grace
                ? 1
                : pSurg(c, x, k);
          const moved = wait * q;
          wait -= moved;
          post += op1;
          op1 = moved;
        } else if (k > 0) {
          post += op1;
          op1 = 0;
        }
        wait *= 1 - pDeath(c, x, null);
        op1 *= 1 - pDeath(c, x, 0);
        post *= 1 - pDeath(c, x, 1);
        const alive = wait + op1 + post;
        S[k + 1] += f * alive;
        XS[k + 1] += f * x * alive;
      }
    }
    return {
      S: S.map((v) => v / mass),
      meanX: XS.map((v, i) => v / S[i]),
    };
  }

  // Mean frailty of clones at risk during month k, with and without weights.
  function atRiskFrailty(clones, k, weightAt = () => 1) {
    let w = 0,
      wx = 0;
    for (const c of clones)
      if (c.exit > k) {
        const v = weightAt(c, k);
        w += v;
        wx += v * c.x;
      }
    return wx / w;
  }

  /* Full analysis of one registry: clones, fitted decision model, unweighted and weighted curves,
   * sample and population truth, and summaries at the horizon K. u in [0,1] blends the weights
   * from 1 (u = 0) to the full IPCW weights (u = 1); it drives the animation. */
  function analyse(input = {}, opts = {}) {
    const sim = opts.sim || simulate(input),
      c = sim.config,
      G = c.grace,
      K = c.K,
      clones = clone(sim.patients, G, K),
      arms = {
        grace: clones.filter((v) => v.arm === "grace"),
        never: clones.filter((v) => v.arm === "never"),
      },
      fit = fitDecision(sim.patients, K, opts.useX !== false);
    // Cache each clone's monthly weights (the "never" product is cumulative).
    for (const cl of clones) {
      cl.w = new Float64Array(K);
      if (cl.arm === "never") {
        let w = 1;
        for (let k = 0; k < K; k++) {
          if (k > 0)
            w /= 1 - expit(fit.g0 + fit.gX * cl.x + fit.gT * (k - 1));
          cl.w[k] = w;
        }
      } else for (let k = 0; k < K; k++) cl.w[k] = weight(cl, k, fit, G);
    }
    const wAt = (cl, k) => cl.w[k],
      out = { config: c, sim, clones, arms, fit, weightAt: wAt };
    for (const arm of ["grace", "never"]) {
      const unweighted = km(arms[arm], K),
        weighted = km(arms[arm], K, wAt),
        truth = sampleTruth(sim.patients, arm, K);
      out[arm] = {
        unweighted,
        weighted,
        truth,
        risk: {
          unweighted: 1 - unweighted[K],
          weighted: 1 - weighted[K],
          truth: 1 - truth[K],
        },
        rmst: {
          unweighted: rmst(unweighted),
          weighted: rmst(weighted),
          truth: rmst(truth),
        },
        censored: arms[arm].filter((v) => v.status === "censored").length,
        graceDeaths: arms[arm].filter(
          (v) => v.status === "death" && v.exit <= G && v.surgery === null,
        ).length,
      };
    }
    return out;
  }
  const blendedKM = (a, arm, u) =>
    km(a.arms[arm], a.config.K, (cl, k) => 1 + u * (a.weightAt(cl, k) - 1));

  /* Repeat the whole study R times with fresh seeds. Summaries for the risk difference and the
   * RMST difference (grace minus never) at K: mean, SD and Monte Carlo SE of the mean, for
   * unweighted and weighted estimators, against the exact population truth. */
  function replicate(input = {}, R = 200, useX = true) {
    const c = cfg(input),
      pg = populationTruth(c, "grace").S,
      pn = populationTruth(c, "never").S,
      truth = {
        rd: pn[c.K] - pg[c.K],
        dRMST: rmst(pg) - rmst(pn),
      },
      est = { unweighted: { rd: [], dRMST: [] }, weighted: { rd: [], dRMST: [] } };
    for (let r = 0; r < R; r++) {
      const a = analyse({ ...c, seed: (c.seed + 7919 * (r + 1)) >>> 0 }, { useX });
      for (const kind of ["unweighted", "weighted"]) {
        est[kind].rd.push(a.grace.risk[kind] - a.never.risk[kind]);
        est[kind].dRMST.push(a.grace.rmst[kind] - a.never.rmst[kind]);
      }
    }
    const summ = (v) => {
      const m = v.reduce((a, b) => a + b, 0) / v.length,
        sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
      return { mean: m, sd, mcse: sd / Math.sqrt(v.length) };
    };
    const out = { R, truth };
    for (const kind of ["unweighted", "weighted"])
      out[kind] = { rd: summ(est[kind].rd), dRMST: summ(est[kind].dRMST) };
    return out;
  }


  /* Pick a small, varied set of patients for the lane figures: operated inside the window
   * (alive; operated exactly at G and alive past month 12; later dead), died while waiting inside the window, operated after the window
   * (alive, dead), and never operated (alive, dead). Deterministic; sorted robust to frail. */
  function showcase(patients, G, K, m = 12) {
    const kind = (p) => {
      const { death, surgery } = p.obs;
      if (surgery === G && (death === null || death > 12)) return "atG";
      if (surgery !== null && surgery <= G) return death ? "inDead" : "in";
      if (surgery === null && death !== null && death <= G) return "waitDead";
      if (surgery !== null) return death ? "lateDead" : "late";
      return death ? "neverDead" : "never";
    };
    const quota = { in: 1, atG: 1, inDead: 1, waitDead: 2, late: 2, lateDead: 1, never: 2, neverDead: 2 },
      picked = [];
    for (const p of patients) {
      const k = kind(p);
      if (quota[k] > 0) {
        quota[k]--;
        picked.push(p);
      }
      if (picked.length >= m) break;
    }
    for (const p of patients) {
      if (picked.length >= m) break;
      if (!picked.includes(p)) picked.push(p);
    }
    return picked.sort((a, b) => a.x - b.x);
  }

  /* Precomputed repeated-study check (generated by replicate(), 200 registries per cell, for every grace period at
   * steer 0.7 and every steer at grace 3; keyed
   * "grace|steer" with gX = −steer). Columns: population truth RD, truth ΔRMST, unweighted RD mean,
   * SD, weighted RD mean, SD, unweighted ΔRMST mean, SD, weighted ΔRMST mean, SD. RD = risk under
   * Operate minus risk under No procedure at K; ΔRMST likewise, in months. */
  const MC_R = 200;
  const MC = /*MC-BEGIN*/ {
    "1|0.7": [-0.1773, 2.0479, -0.4006, 0.0231, -0.1789, 0.0315, 5.2276, 0.3339, 2.0563, 0.4662],
    "2|0.7": [-0.1676, 1.8185, -0.3885, 0.0204, -0.1682, 0.0327, 5.0164, 0.2706, 1.7973, 0.4622],
    "3|0.7": [-0.1596, 1.6403, -0.3684, 0.0191, -0.1616, 0.034, 4.6109, 0.2371, 1.6604, 0.4849],
    "4|0.7": [-0.1528, 1.4995, -0.3506, 0.0185, -0.1572, 0.0349, 4.2511, 0.2235, 1.5452, 0.459],
    "5|0.7": [-0.1469, 1.3867, -0.335, 0.018, -0.152, 0.0325, 3.9443, 0.2117, 1.4345, 0.396],
    "6|0.7": [-0.1418, 1.2953, -0.3218, 0.0178, -0.1457, 0.0316, 3.7001, 0.2047, 1.3495, 0.378],
    "3|0": [-0.16, 1.657, -0.1803, 0.0202, -0.1614, 0.0234, 2.1515, 0.2658, 1.6937, 0.3249],
    "3|0.35": [-0.1597, 1.6461, -0.2862, 0.0204, -0.1601, 0.0273, 3.519, 0.2609, 1.6678, 0.3969],
    "3|1.05": [-0.1596, 1.6383, -0.4214, 0.018, -0.1681, 0.0474, 5.3687, 0.2254, 1.6848, 0.6049],
    "3|1.4": [-0.1597, 1.6385, -0.453, 0.018, -0.1834, 0.0536, 5.8489, 0.2341, 1.8316, 0.7696],
  } /*MC-END*/;

  return {
    DEFAULTS,
    MC,
    MC_R,
    showcase,
    expit,
    logit,
    rng,
    pDeath,
    pSurg,
    run,
    simulate,
    cloneOne,
    clone,
    fitDecision,
    weight,
    km,
    rmst,
    sampleTruth,
    populationTruth,
    atRiskFrailty,
    analyse,
    blendedKM,
    replicate,
  };
});
