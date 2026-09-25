/* Intercurrent events: an exact teaching world for ICH E9(R1) strategies.
 * No sampling and no DOM. Everything here is a known potential outcome.
 *
 * World. A randomized device trial: device plus medical therapy (arm 1) versus
 * medical therapy alone (arm 0). Endpoint: a symptom score at 12 months
 * (0 to 100, higher is better), measured at visits in months 3, 6, 9 and 12.
 * Six prognostic "pairs" A to F. Each pair contributes one patient to each arm
 * with identical prognosis (a perfectly balanced randomization), so for any rule
 * that uses only what was observed, the difference in arm means equals the
 * population contrast exactly. Any gap between an analysis and the truth is then
 * caused by the strategy or by an assumption, never by chance.
 *
 * For every pair and arm we record what actually happens under that arm
 * (visit scores, intercurrent events) and the 12-month score that would have
 * been seen if the non-fatal intercurrent events (crossover, explant, rescue)
 * had been prevented (`hyp`). Death is not prevented in that hypothetical world.
 *
 * Survival part: two risk groups, exponential hazards, crossover from control to
 * device at a group-specific rate. Censoring at crossover estimates a
 * hypothetical "no crossover" survival curve only when crossover is unrelated to
 * risk; the Kaplan-Meier limit is computed by numerical integration.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalIntercurrent = api;
})(globalThis, function () {
  const VISITS = [3, 6, 9, 12];
  const KINDS = ["death", "crossover", "explant", "rescue"];
  const STRATEGIES = ["treatment", "hypothetical", "composite", "whileOn", "principal"];
  const NAMES = {
    treatment: "Treatment policy",
    hypothetical: "Hypothetical",
    composite: "Composite",
    whileOn: "While on treatment",
    principal: "Principal stratum",
  };
  const WORST = 0;
  // visits: scores at months 3, 6, 9, 12 (null once the patient has died).
  // events: intercurrent events after randomization, with the month they occur.
  // hyp: 12-month score had crossover, explant and rescue not happened (null if dead).
  const PAIRS = Object.freeze([
    { id: "A", note: "Does well on either arm", arms: {
      1: { visits: [62, 68, 72, 74], events: [], hyp: 74 },
      0: { visits: [50, 51, 52, 52], events: [], hyp: 52 } } },
    { id: "B", note: "Small benefit, no events", arms: {
      1: { visits: [56, 60, 61, 62], events: [], hyp: 62 },
      0: { visits: [54, 55, 56, 56], events: [], hyp: 56 } } },
    { id: "C", note: "Worsens on medical therapy and crosses over", arms: {
      1: { visits: [46, 48, 50, 50], events: [], hyp: 50 },
      0: { visits: [36, 38, 44, 48], events: [{ kind: "crossover", month: 5 }], hyp: 24 } } },
    { id: "D", note: "Needs rescue medication on medical therapy", arms: {
      1: { visits: [44, 46, 47, 48], events: [], hyp: 48 },
      0: { visits: [42, 38, 43, 46], events: [{ kind: "rescue", month: 7 }], hyp: 30 } } },
    { id: "E", note: "Device infection, device removed", arms: {
      1: { visits: [60, 40, 42, 44], events: [{ kind: "explant", month: 4 }], hyp: 64 },
      0: { visits: [45, 46, 46, 46], events: [], hyp: 46 } } },
    { id: "F", note: "Frail: survives on the device, dies on medical therapy", arms: {
      1: { visits: [34, 36, 37, 38], events: [], hyp: 38 },
      0: { visits: [32, 30, null, null], events: [{ kind: "death", month: 8 }], hyp: null } } },
  ]);

  const lanes = () =>
    [1, 0].flatMap((arm) => PAIRS.map((p) => ({ pair: p.id, arm, note: p.note, ...p.arms[arm] })));
  const first = (rec) => rec.events.slice().sort((a, b) => a.month - b.month)[0] || null;
  const died = (rec) => rec.events.some((e) => e.kind === "death");
  const nonfatal = (rec) => rec.events.filter((e) => e.kind !== "death");
  // Last visit strictly before month m (the score measured while still on assigned treatment).
  function lastBefore(rec, m) {
    let out = null;
    VISITS.forEach((v, i) => { if (v < m && rec.visits[i] != null) out = { month: v, value: rec.visits[i] }; });
    return out;
  }
  const eventFree = (pair) => [0, 1].every((a) => pair.arms[a].events.length === 0);
  const pairOf = (id) => PAIRS.find((p) => p.id === id);

  /* The value a strategy assigns to one patient.
   * handling = {nonfatal, death}; each is a strategy name. Death under
   * "treatment" or "hypothetical" has no defined score here: returns value NaN.
   * `observable` says whether the value can be read from the trial data.
   * `member` (principal stratum) is true/false in the teaching world;
   * `memberKnown` says whether the trial data alone reveal membership. */
  function valueFor(rec, pair, handling) {
    const h = typeof handling === "string" ? preset(handling) : handling;
    const out = { value: rec.visits[3], basis: "observed at 12 months", observable: true, month: 12, member: true, memberKnown: true, counted: 12 };
    if (h.nonfatal === "principal" || h.death === "principal") {
      const bad = (r) => (h.death === "principal" && died(r)) || (h.nonfatal === "principal" && nonfatal(r).length > 0);
      const other = pair.arms[1 - rec.arm];
      out.member = !bad(rec) && !bad(other);
      // An event on your own arm rules you out; being event-free here does not rule you in.
      out.memberKnown = bad(rec);
      // Non-members keep their observed score for display; the stratum contrast never uses it.
      if (!out.member) return { ...out, value: rec.visits[3] ?? NaN, basis: "outside the stratum", counted: 0 };
      return { ...out, basis: "in the stratum" };
    }
    const events = rec.events.slice().sort((a, b) => a.month - b.month);
    let hypothetical = null;
    for (const e of events) {
      const rule = e.kind === "death" ? h.death : h.nonfatal;
      if (rule === "treatment" && e.kind !== "death") continue; // ignore it, keep following the patient
      if (rule === "hypothetical" && e.kind !== "death") { hypothetical ||= e; continue; }
      if (rule === "composite")
        return { ...out, value: WORST, basis: e.kind === "death" ? "death = worst score" : "event = worst score", counted: e.month, event: e };
      if (rule === "whileOn") {
        const lb = lastBefore(rec, e.month);
        return { ...out, value: lb ? lb.value : NaN, month: lb ? lb.month : 0, basis: e.kind === "death" ? "last score alive" : "last score on treatment", counted: e.month, event: e };
      }
      // Death under a treatment-policy or hypothetical rule: no 12-month score exists.
      return { ...out, value: NaN, basis: "no score exists after death", observable: false, counted: e.month, event: e };
    }
    if (hypothetical)
      return { ...out, value: rec.hyp, basis: "needs a model", observable: false, counted: hypothetical.month, event: hypothetical };
    return out; // the observed 12-month score, whatever else happened
  }
  // Each strategy tab: its own rule for crossover, explant and rescue; death as stated.
  function preset(s) {
    if (!STRATEGIES.includes(s)) throw new Error("Unknown strategy " + s);
    return { nonfatal: s, death: s === "whileOn" || s === "principal" || s === "composite" ? s : "composite" };
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

  /* The true population contrast (device minus medical therapy) for a handling rule,
   * from both potential outcomes of every pair. */
  function truth(handling) {
    const rows = PAIRS.map((p) => {
      const v1 = valueFor({ ...p.arms[1], arm: 1 }, p, handling), v0 = valueFor({ ...p.arms[0], arm: 0 }, p, handling);
      return { pair: p.id, v1, v0, member: v1.member && v0.member };
    });
    const used = rows.filter((r) => r.member);
    const m1 = mean(used.map((r) => r.v1.value)), m0 = mean(used.map((r) => r.v0.value));
    return { rows, m1, m0, effect: m1 - m0, n: used.length, members: used.map((r) => r.pair) };
  }

  /* What an analysis of the observed trial alone produces for each strategy.
   * Identified strategies (treatment policy, composite, while on treatment) use
   * exactly the strategy's rule. Hypothetical: the naive analysis drops patients
   * after a non-fatal event (complete cases). Principal stratum: the naive analysis
   * compares patients who were event-free in their own arm. */
  function analysis(strategy) {
    const h = preset(strategy), L = lanes();
    const keep = (rec) => {
      if (strategy === "hypothetical") return nonfatal(rec).length === 0;
      if (strategy === "principal") return rec.events.length === 0;
      return true;
    };
    const val = (rec) => {
      if (strategy === "hypothetical" || strategy === "principal") return died(rec) ? WORST : rec.visits[3];
      return valueFor(rec, pairOf(rec.pair), h).value;
    };
    const arm = (a) => L.filter((r) => r.arm === a && keep(r)).map(val);
    const x1 = arm(1), x0 = arm(0);
    return {
      m1: mean(x1), m0: mean(x0), n1: x1.length, n0: x0.length,
      effect: mean(x1) - mean(x0),
      identified: strategy !== "hypothetical" && strategy !== "principal",
    };
  }
  const summary = () =>
    STRATEGIES.map((s) => ({ strategy: s, name: NAMES[s], truth: truth(s), analysis: analysis(s) }));

  /* ---- Survival: censoring at crossover ---- */
  const SURV = Object.freeze({ wHigh: 0.3, hLow: 0.1, hHigh: 0.6, deviceRatio: 0.7, crossover: 0.5 });
  // Crossover rate per year in each risk group, given the high/low ratio,
  // holding the cohort-average rate w_L c_L + w_H c_H fixed.
  function crossRates(ratio, c = {}) {
    const p = { ...SURV, ...c }, wL = 1 - p.wHigh;
    const cL = p.crossover / (wL + p.wHigh * ratio);
    return [cL, cL * ratio];
  }
  function censoring(ratio = 1, c = {}) {
    if (!(ratio > 0)) throw new Error("ratio must be positive");
    const p = { ...SURV, ...c }, w = [1 - p.wHigh, p.wHigh], h = [p.hLow, p.hHigh], cr = crossRates(ratio, p), r = p.deviceRatio;
    // Hypothetical world: nobody crosses over. Time t in years.
    const hyp = (t) => w[0] * Math.exp(-h[0] * t) + w[1] * Math.exp(-h[1] * t);
    // Treatment policy: crossover at rate c, event hazard h before and h*r after.
    const tpGroup = (s, t) => {
      const k = h[s] * (1 - r) + cr[s];
      const tail = k === 0 ? t : -Math.expm1(-k * t) / k;
      return Math.exp(-(h[s] + cr[s]) * t) + cr[s] * Math.exp(-h[s] * r * t) * tail;
    };
    const tp = (t) => w[0] * tpGroup(0, t) + w[1] * tpGroup(1, t);
    // Kaplan-Meier limit when crossover is treated as censoring: exp(-integral of the
    // hazard among those still uncensored and event-free). Simpson's rule, 2000 panels per year.
    const hazStar = (u) => {
      const a = w.map((wi, s) => wi * Math.exp(-(h[s] + cr[s]) * u));
      return (a[0] * h[0] + a[1] * h[1]) / (a[0] + a[1]);
    };
    const km = (t) => {
      if (t <= 0) return 1;
      const n = Math.max(2, 2 * Math.ceil(t * 1000)), dx = t / n;
      let s = hazStar(0) + hazStar(t);
      for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * hazStar(i * dx);
      return Math.exp(-(s * dx) / 3);
    };
    return { hyp, tp, km, rates: cr, weights: w, hazards: h };
  }

  return { VISITS, KINDS, STRATEGIES, NAMES, WORST, PAIRS, SURV, lanes, first, died, nonfatal, lastBefore, eventFree, valueFor, preset, truth, analysis, summary, crossRates, censoring };
});
