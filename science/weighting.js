/* Exact two-stratum teaching population for the weighting foundations page.
 * Cells are expected counts in a population of 100, not a simulated sample.
 * Outcomes are fixed within (X, A): Y(a) = base + sev·X + effect·a, so the
 * average treatment effect is `effect` and identification holds by construction.
 *
 * Two outcome scales share the same mechanics:
 *   LEGACY     numerical outcome, Y(0) = 2 + 3X, Y(1) = Y(0) + 2  (ATE 2)
 *   MORTALITY  risk of death, 20% / 50% untreated, 10% / 40% treated  (ATE −10 points)
 * With the default assignment (20% / 80% treated) the mortality world reverses:
 * the treated die more often (34% vs 26%) although treatment prevents deaths.
 * Arm-normalized (Hájek) IPW means are displayed, not Horvitz–Thompson means.
 */
(function (root) {
  "use strict";
  const DEFAULTS = { pHigh: 0.5, gLow: 0.2, gHigh: 0.8, scoreMode: "correct", weightMode: "unstabilized" };
  const LEGACY = Object.freeze({ base: 2, sev: 3, effect: 2 });
  const MORTALITY = Object.freeze({ base: 0.2, sev: 0.3, effect: -0.1 });
  function probability(x, name) {
    if (!Number.isFinite(x) || x < 0 || x > 1) throw new RangeError(name + " must be a probability");
  }
  function checkOutcome(o) {
    for (const k of ["base", "sev", "effect"])
      if (!Number.isFinite(o[k])) throw new RangeError("outcome." + k + " must be a finite number");
  }
  const ratio = (n, d) => d > 0 ? n / d : null;
  function population(options = {}) {
    const cfg = { ...DEFAULTS, ...options };
    const outcome = cfg.outcome || LEGACY;
    for (const k of ["pHigh", "gLow", "gHigh"]) probability(cfg[k], k);
    checkOutcome(outcome);
    if (!["correct", "constant"].includes(cfg.scoreMode)) throw new RangeError("Unknown score mode");
    if (!["unstabilized", "stabilized"].includes(cfg.weightMode)) throw new RangeError("Unknown weight mode");
    const y = (x, a) => outcome.base + outcome.sev * x + outcome.effect * a;
    const mass = [1 - cfg.pHigh, cfg.pHigh], g = [cfg.gLow, cfg.gHigh];
    const working = cfg.scoreMode === "correct" ? g : [0.5, 0.5];
    const treatedShare = mass.reduce((s, p, x) => s + p * g[x], 0);
    const supported = mass.every((p, x) => !p || (g[x] > 0 && g[x] < 1));
    const cells = mass.flatMap((p, x) => [0, 1].map((a) => {
      const count = 100 * p * (a ? g[x] : 1 - g[x]);
      const ownProbability = a ? working[x] : 1 - working[x];
      const numerator = cfg.weightMode === "stabilized" ? (a ? treatedShare : 1 - treatedShare) : 1;
      const weight = ownProbability > 0 ? numerator / ownProbability : null;
      return { x, a, count, outcome: y(x, a), ownProbability, weight,
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
        /* Direct standardization: stratum-specific means averaged over the target mix. */
        standardized: mass.reduce((s, p, x) => s + p * y(x, a), 0),
        totalWeight: supported ? totalWeight : null,
        weightedHighShare: supported ? ratio(rows[1].weightedCount, totalWeight) : null,
        weightedMean: supported ? ratio(rows.reduce((s, c) => s + c.weightedCount * c.outcome, 0), totalWeight) : null,
        ess: supported ? ratio(totalWeight ** 2, sumSquaredWeights) : null };
    });
    return { cfg, outcome, cells, arms, supported, truth: outcome.effect,
      naive: arms.every((a) => a.mean !== null) ? arms[1].mean - arms[0].mean : null,
      ipw: supported ? arms[1].weightedMean - arms[0].weightedMean : null,
      maxWeight: supported ? Math.max(...cells.filter((c) => c.count > 0).map((c) => c.weight)) : null };
  }
  /* Population AIPW with independently chosen working outcome and PS models.
   * The wrong outcome model omits severity: it predicts each arm's crude mean,
   * which is what a regression of Y on A alone would fit. This checks the
   * double-robustness promise without a Monte Carlo tolerance.
   */
  function aipw(options = {}, outcomeCorrect = true) {
    const pop = population({ ...options, weightMode: "unstabilized" });
    if (!pop.supported) return null;
    const o = pop.outcome, crude = [pop.arms[0].mean, pop.arms[1].mean];
    const prediction = (x, a) => outcomeCorrect ? o.base + o.sev * x + o.effect * a : crude[a];
    return pop.cells.reduce((s, c) => s + c.count / 100 * (
      prediction(c.x, 1) - prediction(c.x, 0) +
      (c.a ? 1 : -1) * c.weight * (c.outcome - prediction(c.x, c.a))
    ), 0);
  }
  const api = { DEFAULTS, LEGACY, MORTALITY, population, aipw };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalWeighting = api;
})(typeof window === "object" ? window : globalThis);
