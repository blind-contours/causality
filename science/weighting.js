/* Exact two-stratum teaching population for the propensity-weighting tutorial.
 * Cells are expected counts, not a simulated sample. Outcomes are fixed within
 * (X,A): Y(0)=2+3X, Y(1)=Y(0)+2. Identification holds by construction.
 * Arm-normalized (Hájek) IPW means are displayed, not Horvitz–Thompson means.
 */
(function (root) {
  "use strict";
  const DEFAULTS = { pHigh: 0.5, gLow: 0.2, gHigh: 0.8, scoreMode: "correct", weightMode: "unstabilized" };
  function probability(x, name) {
    if (!Number.isFinite(x) || x < 0 || x > 1) throw new RangeError(name + " must be a probability");
  }
  const ratio = (n, d) => d > 0 ? n / d : null;
  function population(options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    for (const k of ["pHigh", "gLow", "gHigh"]) probability(cfg[k], k);
    if (!["correct", "constant"].includes(cfg.scoreMode)) throw new RangeError("Unknown score mode");
    if (!["unstabilized", "stabilized"].includes(cfg.weightMode)) throw new RangeError("Unknown weight mode");
    const mass = [1 - cfg.pHigh, cfg.pHigh], g = [cfg.gLow, cfg.gHigh];
    const working = cfg.scoreMode === "correct" ? g : [0.5, 0.5];
    const treatedShare = mass.reduce((s, p, x) => s + p * g[x], 0);
    const supported = mass.every((p, x) => !p || (g[x] > 0 && g[x] < 1));
    const cells = mass.flatMap((p, x) => [0, 1].map((a) => {
      const count = 100 * p * (a ? g[x] : 1 - g[x]);
      const ownProbability = a ? working[x] : 1 - working[x];
      const numerator = cfg.weightMode === "stabilized" ? (a ? treatedShare : 1 - treatedShare) : 1;
      const weight = ownProbability > 0 ? numerator / ownProbability : null;
      return { x, a, count, outcome: 2 + 3 * x + 2 * a, ownProbability, weight,
        weightedCount: weight === null ? null : count * weight };
    }));
    const arms = [0, 1].map((a) => {
      const rows = cells.filter((c) => c.a === a);
      const n = rows.reduce((s, c) => s + c.count, 0);
      const totalWeight = rows.reduce((s, c) => s + (c.weightedCount || 0), 0);
      const sumSquaredWeights = rows.reduce((s, c) => s + c.count * (c.weight || 0) ** 2, 0);
      return { a, n,
        highShare: ratio(rows[1].count, n),
        mean: ratio(rows.reduce((s, c) => s + c.count * c.outcome, 0), n),
        totalWeight: supported ? totalWeight : null,
        weightedHighShare: supported ? ratio(rows[1].weightedCount, totalWeight) : null,
        weightedMean: supported ? ratio(rows.reduce((s, c) => s + c.weightedCount * c.outcome, 0), totalWeight) : null,
        ess: supported ? ratio(totalWeight ** 2, sumSquaredWeights) : null };
    });
    return { cfg, cells, arms, supported, truth: 2,
      naive: arms.every((a) => a.mean !== null) ? arms[1].mean - arms[0].mean : null,
      ipw: supported ? arms[1].weightedMean - arms[0].weightedMean : null,
      maxWeight: supported ? Math.max(...cells.filter((c) => c.count > 0).map((c) => c.weight)) : null };
  }
  /* Population AIPW with independently chosen working outcome and PS models.
   * This checks the double-robustness promise without a Monte Carlo tolerance.
   */
  function aipw(options = {}, outcomeCorrect = true) {
    const pop = population({ ...options, weightMode: "unstabilized" });
    if (!pop.supported) return null;
    const prediction = (x, a) => outcomeCorrect ? 2 + 3 * x + 2 * a : 3 + a;
    return pop.cells.reduce((s, c) => s + c.count / 100 * (
      prediction(c.x, 1) - prediction(c.x, 0) +
      (c.a ? 1 : -1) * c.weight * (c.outcome - prediction(c.x, c.a))
    ), 0);
  }
  const api = { DEFAULTS, population, aipw };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalWeighting = api;
})(typeof window === "object" ? window : globalThis);
