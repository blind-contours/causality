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
    const ice = c.intercurrent && typeof c.intercurrent.sentence === "string" ? ` Intercurrent events: ${c.intercurrent.sentence}` : "";
    return `Among ${who}, compare ${question} under treatment versus control. ${Math.round(c.population * 100)}% of the whole cohort has high baseline severity. The selected people are held fixed across both intervention worlds.${ice}`;
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
    // A skim (the placement quiz or the quick check marking earlier lessons) is not a visit: it
    // moves new to explored but leaves no timestamp, so it never becomes "Last opened".
    if (event.type === "explore" && event.skim) {
      if (u.status === "new") {
        u.status = "explored";
        u.skimmed = true;
      }
      return next;
    }
    u.updated = event.now || new Date().toISOString();
    if (event.type === "explore") {
      if (u.status === "new") u.status = "explored";
      delete u.skimmed;
    }
    if (event.type === "exercise") {
      delete u.skimmed;
      const prior = u.exercises[event.id] || {};
      // A fresh case (New case) starts an unassisted variant; it is not an attempt.
      if (event.fresh) {
        u.exercises[event.id] = {
          ...prior,
          variant: event.variant,
          answer: "",
          assisted: false,
          correct: false,
        };
        if (event.transfer && (u.status === "attempted" || u.status === "assisted"))
          u.status = "attempted";
        else if (u.status === "new") u.status = "explored";
        return next;
      }
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
        // Once a transfer check is demonstrated it stays demonstrated: a later hint, worked
        // solution or new case is practice, not a retraction.
        if (u.status === "demonstrated") return next;
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
  // Counts for progress displays. walked: lessons opened (status beyond new, not merely skimmed);
  // passed: lessons whose transfer check is demonstrated.
  function counts(units, ids) {
    let walked = 0,
      passed = 0;
    ids.forEach((id) => {
      const u = units[id];
      if (!u || u.status === "new") return;
      if (u.status === "demonstrated") passed++;
      if (!u.skimmed) walked++;
    });
    return { walked, passed, total: ids.length };
  }
  const opened = (u) => !!u && u.status !== "new" && !u.skimmed;
  return { KEY, migrate, reduce, load, contract, describeContract, counts, opened };
});
