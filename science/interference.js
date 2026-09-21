/* Exact interference laboratory: eight units on a fixed graph, deterministic potential outcomes,
 * full enumeration of assignment vectors under several designs. No DOM, no randomness.
 *
 * Y_i(a) = b_i + tau * a_i + gamma * g_i(a),  g_i(a) = fraction of i's neighbours assigned treatment.
 * This is a teaching model. The graph and the exposure summary g are assumed sufficient. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalInterference = api;
})(globalThis, function () {
  const N = 8;
  // Two tight groups {0,1,2,3} and {4,5,6,7} joined by the bridge 3–4. No isolated units.
  const EDGES = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 4],
    [4, 5],
    [4, 6],
    [5, 6],
    [5, 7],
    [6, 7],
  ];
  const NEIGHBOURS = Array.from({ length: N }, () => []);
  EDGES.forEach(([i, j]) => {
    NEIGHBOURS[i].push(j);
    NEIGHBOURS[j].push(i);
  });
  const CLUSTERS = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
  ];
  const BASELINE = [1.0, 1.4, 0.8, 1.2, 1.1, 0.9, 1.3, 1.0];
  const DEFAULTS = { tau: 1, gamma: 0.8, baseline: BASELINE, shock: 0 };

  const sum = (v) => v.reduce((a, b) => a + b, 0);
  const mean = (v) => (v.length ? sum(v) / v.length : NaN);

  /* Neighbour exposure g_i(a): fraction of i's neighbours treated (excluding i). */
  function exposure(a) {
    return NEIGHBOURS.map((nb) => mean(nb.map((j) => a[j])));
  }
  /* Potential outcomes for one assignment vector. `shock` is a common additive term shared by
   * everyone: it moves all outcomes together without any unit's treatment reaching another. */
  function outcomes(a, params = {}) {
    const { tau, gamma, baseline, shock } = { ...DEFAULTS, ...params };
    const g = exposure(a);
    return a.map((ai, i) => baseline[i] + tau * ai + gamma * g[i] + shock);
  }
  /* Which units' outcomes change when unit k's treatment is toggled in assignment a. */
  function affected(a, k, params = {}) {
    const b = a.slice();
    b[k] = 1 - b[k];
    const y0 = outcomes(a, params),
      y1 = outcomes(b, params);
    return y0.map((y, i) => Math.abs(y1[i] - y) > 1e-12);
  }

  const bits = (m) => Array.from({ length: N }, (_, i) => (m >> i) & 1);

  /* Enumerate every allowable assignment with its exact probability.
   * design: {type:"bernoulli", p} | {type:"complete", k} | {type:"cluster", p} */
  function enumerate(design = { type: "bernoulli", p: 0.5 }) {
    const out = [];
    if (design.type === "bernoulli") {
      const p = design.p ?? 0.5;
      for (let m = 0; m < 1 << N; m++) {
        const a = bits(m),
          k = sum(a);
        out.push({ a, prob: p ** k * (1 - p) ** (N - k) });
      }
    } else if (design.type === "complete") {
      const k = design.k ?? 4;
      const all = [];
      for (let m = 0; m < 1 << N; m++) {
        const a = bits(m);
        if (sum(a) === k) all.push(a);
      }
      all.forEach((a) => out.push({ a, prob: 1 / all.length }));
    } else if (design.type === "cluster") {
      const p = design.p ?? 0.5;
      for (let m = 0; m < 1 << CLUSTERS.length; m++) {
        const a = new Array(N).fill(0);
        let k = 0;
        CLUSTERS.forEach((c, ci) => {
          const z = (m >> ci) & 1;
          k += z;
          c.forEach((i) => (a[i] = z));
        });
        out.push({ a, prob: p ** k * (1 - p) ** (CLUSTERS.length - k) });
      }
    } else throw Error("Unknown design " + design.type);
    return out;
  }

  /* Exposure support: for each unit, the probability of each (own, neighbour-exposure) level. */
  function exposureSupport(design) {
    const table = Array.from({ length: N }, () => new Map());
    enumerate(design).forEach(({ a, prob }) => {
      const g = exposure(a);
      a.forEach((ai, i) => {
        const key = `${ai}|${g[i].toFixed(4)}`;
        table[i].set(key, (table[i].get(key) || 0) + prob);
      });
    });
    return table.map((m) =>
      [...m.entries()]
        .map(([key, prob]) => {
          const [own, g] = key.split("|").map(Number);
          return { own, g, prob };
        })
        .sort((x, y) => x.own - y.own || x.g - y.g),
    );
  }
  /* Is a contrast between two exposure levels supported for unit i under the design?
   * Both levels must have positive probability. */
  function contrastSupported(design, i, levelA, levelB) {
    const s = exposureSupport(design)[i];
    // Levels are stored at four decimals; compare at that resolution so 2/3 matches 0.6667.
    const has = (lv) =>
      s.some(
        (r) =>
          r.own === lv.own && Math.abs(r.g - lv.g) < 5e-5 && r.prob > 1e-12,
      );
    return has(levelA) && has(levelB);
  }

  /* Estimands in the toy model. Direct effect at fixed exposure is tau; spillover from
   * exposure g0 to g1 at fixed own assignment is gamma*(g1-g0); the full-policy effect
   * compares everyone treated with nobody treated. */
  function estimands(params = {}) {
    const P = { ...DEFAULTS, ...params };
    const all1 = outcomes(new Array(N).fill(1), P),
      all0 = outcomes(new Array(N).fill(0), P);
    return {
      direct: P.tau,
      spilloverPerUnitExposure: P.gamma,
      policy: mean(all1) - mean(all0),
      policyByUnit: all1.map((y, i) => y - all0[i]),
    };
  }

  /* What the design's own treated-versus-control contrast estimates, exactly:
   * E[ mean Y among treated − mean Y among control ], averaging over assignments in which
   * both groups are non-empty (the difference is undefined otherwise; that mass is reported). */
  function designContrast(design, params = {}) {
    let value = 0,
      massDefined = 0,
      exposureGapTreated = 0,
      exposureGapControl = 0;
    enumerate(design).forEach(({ a, prob }) => {
      const t = a.map((v, i) => i).filter((i) => a[i] === 1),
        c = a.map((v, i) => i).filter((i) => a[i] === 0);
      if (!t.length || !c.length) return;
      const y = outcomes(a, params),
        g = exposure(a);
      value += prob * (mean(t.map((i) => y[i])) - mean(c.map((i) => y[i])));
      exposureGapTreated += prob * mean(t.map((i) => g[i]));
      exposureGapControl += prob * mean(c.map((i) => g[i]));
      massDefined += prob;
    });
    return {
      value: value / massDefined,
      massDefined,
      meanExposureTreated: exposureGapTreated / massDefined,
      meanExposureControl: exposureGapControl / massDefined,
    };
  }

  /* Correlation without interference: under a shared shock every outcome moves together,
   * but toggling one unit's treatment changes nobody else's outcome when gamma = 0. */
  function shockVersusSpillover(a, params = {}) {
    const base = outcomes(a, params),
      shocked = outcomes(a, { ...params, shock: (params.shock || 0) + 0.5 });
    const k = 0,
      toggled = affected(a, k, params);
    return {
      shockMoves: base.map((y, i) => shocked[i] - y),
      toggleAffects: toggled,
    };
  }

  return {
    N,
    EDGES,
    NEIGHBOURS,
    CLUSTERS,
    DEFAULTS,
    exposure,
    outcomes,
    affected,
    enumerate,
    exposureSupport,
    contrastSupported,
    estimands,
    designContrast,
    shockVersusSpillover,
  };
});
