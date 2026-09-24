/* Exact two-stratum teaching worlds. No sampling, fitted models, or DOM.
 * Population selection is held fixed across the two interventions. The mean,
 * binary-event, and survival outcomes are separate outcomes in the same cohort. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalEstimands = api;
})(globalThis, function () {
  const DEFAULTS = Object.freeze({
    p: 0.35, target: "ate", gLow: 1 / (1 + Math.exp(0.8)),
    gHigh: 1 / (1 + Math.exp(-0.8)), effectLow: 1.86, effectHigh: 2.26,
    riskLow: 0.2, riskHigh: 0.4, riskMultiplier: 0.5, riskContrast: "rd",
    tau: 5, hazardRatio: 0.65, delay: 0, survivalContrast: "survival",
  });
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const blend = (w, values) => w ? dot(w, values) : NaN;
  const normalize = (w) => {
    const total = w.reduce((a, b) => a + b, 0);
    return total > 0 ? w.map(v => v / total) : null;
  };
  function population(input = {}) {
    const c = { ...DEFAULTS, ...input },
      all = [1 - c.p, c.p], g = [c.gLow, c.gHigh],
      treated = normalize(all.map((w, i) => w * g[i])),
      untreated = normalize(all.map((w, i) => w * (1 - g[i]))),
      weights = { ate: all, att: treated, atc: untreated }[c.target];
    if (!weights && !["ate", "att", "atc"].includes(c.target))
      throw new Error("Unknown target population");
    return { all, treated, untreated, weights, propensity: g, treatedShare: dot(all, g) };
  }
  function means(input = {}) {
    const c = { ...DEFAULTS, ...input }, pop = population(c),
      effect = [c.effectLow, c.effectHigh], control = [0.5, 2.1],
      treatment = control.map((m, i) => m + effect[i]);
    return {
      ...pop, effect, control, treatment,
      effects: { ate: blend(pop.all, effect), att: blend(pop.treated, effect), atc: blend(pop.untreated, effect) },
      target: blend(pop.weights, effect),
      naive: blend(pop.treated, treatment) - blend(pop.untreated, control),
    };
  }
  function risks(input = {}) {
    const c = { ...DEFAULTS, ...input }, pop = population(c),
      control = [c.riskLow, c.riskHigh], treatment = control.map(v => v * c.riskMultiplier);
    if ([...control, ...treatment].some(v => !Number.isFinite(v) || v < 0 || v > 1))
      throw new Error("Event risks must lie between zero and one");
    const r0 = blend(pop.weights, control), r1 = blend(pop.weights, treatment);
    return { ...pop, control, treatment, r0, r1, rd: r1 - r0, rr: r0 > 0 ? r1 / r0 : NaN };
  }
  // A treatment may start changing the event hazard after `delay` years.
  // The integral is analytic, including the zero-hazard limit.
  const area = (rate, time) => rate === 0 ? time : -Math.expm1(-rate * time) / rate;
  function survivalAt(rate, multiplier, delay, time) {
    const before = Math.min(time, delay), after = Math.max(0, time - delay);
    return Math.exp(-rate * before - rate * multiplier * after);
  }
  function restrictedMean(rate, multiplier, delay, time) {
    const before = Math.min(time, delay), after = Math.max(0, time - delay);
    return area(rate, before) + Math.exp(-rate * before) * area(rate * multiplier, after);
  }
  function survival(input = {}) {
    const c = { ...DEFAULTS, ...input }, pop = population(c), rates = [0.08, 0.32];
    const at = (t, arm) => blend(pop.weights, rates.map(rate => survivalAt(rate, arm ? c.hazardRatio : 1, c.delay, t)));
    const rmst = (arm) => blend(pop.weights, rates.map(rate => restrictedMean(rate, arm ? c.hazardRatio : 1, c.delay, c.tau)));
    const s0 = at(c.tau, 0), s1 = at(c.tau, 1), rmst0 = rmst(0), rmst1 = rmst(1);
    return { ...pop, at, s0, s1, rmst0, rmst1, difference: s1 - s0, rmstDifference: rmst1 - rmst0 };
  }
  return { DEFAULTS, population, means, risks, survival, survivalAt, restrictedMean };
});
