/* Explicit learning state. Viewing, revealing, and demonstrating are different events. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalState = api;
})(globalThis, function () {
  const KEY = "causality.progress.v2";
  function contract(value = {}) {
    const c = { target: "ate", population: 0.35, horizon: 5, measure: "mean", ...value };
    if (!["ate", "att", "atc"].includes(c.target)) c.target = "ate";
    if (!["mean", "rd", "rr", "survival", "rmst"].includes(c.measure)) c.measure = "mean";
    c.population = Number.isFinite(+c.population) ? Math.max(0, Math.min(1, +c.population)) : .35;
    c.horizon = Number.isFinite(+c.horizon) ? Math.max(0, Math.min(10, +c.horizon)) : 5;
    return c;
  }
  function describeContract(value) {
    const c = contract(value), who = { ate: "everyone in the cohort", att: "people who actually received treatment", atc: "people who actually received control" }[c.target];
    const question = {
      mean: "the difference in the average numerical outcome at one year",
      rd: "the one-year adverse-event risk difference",
      rr: "the one-year adverse-event risk ratio",
      survival: `the difference in the chance of being alive at ${c.horizon} years`,
      rmst: `the difference in average time alive within ${c.horizon} years (RMST)`,
    }[c.measure];
    return `Among ${who}, compare ${question} under treatment versus control. ${Math.round(c.population * 100)}% of the whole cohort has high baseline severity. The selected people are held fixed across both intervention worlds.`;
  }
  function migrate(legacy = {}) {
    return {
      version: 2,
      units: Object.fromEntries(
        Object.keys(legacy).map((id) => [
          id,
          { status: "explored", legacy: true, exercises: {} },
        ]),
      ),
      settings: { mode: "guided" },
      contract: contract(),
      forms: {},
    };
  }
  function reduce(state, event) {
    const next = JSON.parse(JSON.stringify(state)),
      id = event.unit;
    if (event.type === "reset-unit") {
      delete next.units[id];
      delete next.forms[id];
      return next;
    }
    if (event.type === "settings") {
      Object.assign(next.settings, event.value);
      return next;
    }
    if (event.type === "contract") {
      next.contract = contract({ ...next.contract, ...event.value });
      return next;
    }
    if (event.type === "form") {
      next.forms[id] = event.value;
      return next;
    }
    const u = next.units[id] || { status: "new", exercises: {} };
    next.units[id] = u;
    u.updated = event.now || new Date().toISOString();
    if (event.type === "explore" && u.status === "new") u.status = "explored";
    if (event.type === "exercise") {
      const prior = u.exercises[event.id] || {};
      const assisted =
        event.assisted ||
        (prior.variant === event.variant && prior.assisted) ||
        false;
      u.exercises[event.id] = {
        variant: event.variant,
        answer: event.answer,
        assisted,
        correct: !!event.correct,
        attempts: (prior.attempts || 0) + 1,
      };
      if (event.transfer) {
        u.status =
          event.correct && !assisted
            ? "demonstrated"
            : assisted
              ? "assisted"
              : "attempted";
        if (u.status === "demonstrated")
          u.reviewAt = new Date(
            Date.parse(u.updated) + 3 * 86400000,
          ).toISOString();
      }
    }
    return next;
  }
  function load(storage) {
    try {
      const s = JSON.parse(storage.getItem(KEY));
      if (
        s &&
        s.version === 2 &&
        s.units &&
        s.forms &&
        s.settings &&
        s.contract
      ) {
        s.contract = contract(s.contract);
        return s;
      }
      return migrate(
        JSON.parse(storage.getItem("causality.progress.v1") || "{}"),
      );
    } catch {
      return migrate();
    }
  }
  return { KEY, migrate, reduce, load, contract, describeContract };
});
