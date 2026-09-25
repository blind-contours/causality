/* Target trial emulation teaching world: a registry of patients with severe valve disease.
 *
 * Generator (all times in years since the eligibility date, which is time zero of the target trial):
 *   - A share pScheduled of patients is scheduled for the device procedure after a waiting time
 *     W ~ Exponential(nu); the others are never scheduled (W = Infinity).
 *   - Death hazard is lambda before the procedure and lambda * hr after it. hr = 1 is the null:
 *     the procedure truly does nothing to mortality. Death time comes from one Exp(1) draw E by
 *     inverting the cumulative hazard, so the null and non-null worlds share every random number.
 *   - Loss to follow-up L ~ Exponential(loss); administrative end of data at `admin` years.
 *   - Waiting time is independent of prognosis. There is no confounding by design, so every gap
 *     between an analysis and the truth is self-inflicted by the choice of time zero.
 * The procedure is observed only if W < min(death, censoring).
 *
 * Truth (exact): if everyone had the procedure at eligibility, S1(t) = exp(-lambda*hr*t);
 * if nobody ever had it, S0(t) = exp(-lambda*t). Under hr = 1 every strategy has the same risk.
 */
(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.CausalScience,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalTargetTrial = api;
})(globalThis, function (core) {
  const DEFAULTS = Object.freeze({
    n: 2000,
    seed: 20251224,
    lambda: 0.35,
    pScheduled: 0.7,
    nu: 2,
    loss: 0.05,
    admin: 2,
    horizon: 1,
    grace: 0.5,
    hr: 1,
  });
  // The 20 swimlane patients: a separate fixed draw, chosen (see tests) to show
  // deaths while waiting, never-scheduled patients and censoring.
  const LANES = Object.freeze({ n: 20, seed: 159 });
  const ANALYSES = ["aligned", "procedure", "ever"];

  const expDraw = (random, rate) =>
    rate > 0 ? -Math.log(1 - random()) / rate : Infinity;

  function simulate(input = {}) {
    const c = { ...DEFAULTS, ...input },
      random = core.rng(c.seed),
      rows = [];
    for (let i = 0; i < c.n; i++) {
      // Fixed draw order per patient keeps worlds with different hr on common random numbers.
      const scheduled = random() < c.pScheduled,
        wDraw = expDraw(random, c.nu),
        E = expDraw(random, 1),
        L = expDraw(random, c.loss);
      const W = scheduled ? wDraw : Infinity;
      // Invert H(t) = lambda*min(t,W) + lambda*hr*(t-W)+.
      const T =
        E <= c.lambda * W ? E / c.lambda : W + (E - c.lambda * W) / (c.lambda * c.hr);
      const C = Math.min(L, c.admin),
        end = Math.min(T, C),
        died = T <= C,
        proc = W < end;
      rows.push({ id: i + 1, W, T, C, end, died, proc });
    }
    return rows;
  }

  /* Product-limit estimator with delayed entry. rows: {entry, time, event}.
   * A subject is at risk at time t when entry < t <= time. Deaths precede censoring at ties. */
  function kmEntry(rows, tau = Infinity) {
    const times = [...new Set(rows.filter((r) => r.event && r.time <= tau).map((r) => r.time))].sort((a, b) => a - b);
    let s = 1;
    const points = [[0, 1]];
    for (const t of times) {
      let risk = 0,
        d = 0;
      for (const r of rows)
        if (r.entry < t && r.time >= t) {
          risk++;
          if (r.event && r.time === t) d++;
        }
      if (risk > 0 && d > 0) {
        s *= 1 - d / risk;
        points.push([t, s]);
      }
    }
    if (Number.isFinite(tau)) points.push([tau, s]);
    return { s, points, n: rows.length, events: rows.filter((r) => r.event && r.time <= tau).length };
  }
  const at = (points, t) => {
    let s = 1;
    for (const p of points) if (p[0] <= t) s = p[1];
    return s;
  };

  /* Split each patient into analysis rows for one choice of time zero.
   *  aligned:   everyone's clock starts at eligibility; waiting time is untreated person-time
   *             (censored at the procedure), post-procedure time enters the treated curve at W.
   *  procedure: treated clock starts at the procedure, untreated clock at eligibility.
   *  ever:      everyone's clock at eligibility, grouped by whether a procedure ever happened.
   *  grace:     everyone's clock at eligibility, grouped by procedure within the grace period.
   */
  function arms(rows, kind, grace = DEFAULTS.grace) {
    const treated = [],
      untreated = [];
    for (const r of rows) {
      if (kind === "aligned") {
        untreated.push({ id: r.id, entry: 0, time: r.proc ? r.W : r.end, event: r.died && !r.proc });
        if (r.proc) treated.push({ id: r.id, entry: r.W, time: r.end, event: r.died });
      } else if (kind === "procedure") {
        if (r.proc) treated.push({ id: r.id, entry: 0, time: r.end - r.W, event: r.died });
        else untreated.push({ id: r.id, entry: 0, time: r.end, event: r.died });
      } else if (kind === "ever") {
        (r.proc ? treated : untreated).push({ id: r.id, entry: 0, time: r.end, event: r.died });
      } else if (kind === "grace") {
        // Untreated deaths and losses inside the grace period are sent to the no-procedure arm.
        (r.proc && r.W <= grace ? treated : untreated).push({ id: r.id, entry: 0, time: r.end, event: r.died });
      } else if (kind === "graceToProcedure") {
        // The same patients are sent to the procedure arm instead.
        const toProc = (r.proc && r.W <= grace) || (!(r.proc && r.W <= grace) && r.end <= grace);
        (toProc ? treated : untreated).push({ id: r.id, entry: 0, time: r.end, event: r.died });
      } else throw Error("Unknown analysis " + kind);
    }
    return { treated, untreated };
  }

  function truth(input = {}) {
    const c = { ...DEFAULTS, ...input };
    const S0 = (t) => Math.exp(-c.lambda * t),
      S1 = (t) => Math.exp(-c.lambda * c.hr * t);
    const r0 = 1 - S0(c.horizon),
      r1 = 1 - S1(c.horizon);
    return { S0, S1, r0, r1, rd: r1 - r0 };
  }

  function analyse(rows, kind, input = {}) {
    const c = { ...DEFAULTS, ...input },
      g = arms(rows, kind, c.grace),
      k1 = kmEntry(g.treated, c.horizon),
      k0 = kmEntry(g.untreated, c.horizon);
    const people = (list) => new Set(list.map((r) => r.id)).size;
    return {
      kind,
      treated: { km: k1, risk: 1 - k1.s, n: people(g.treated), deaths: k1.events },
      untreated: { km: k0, risk: 1 - k0.s, n: people(g.untreated), deaths: k0.events },
      rd: k0.s - k1.s, // treated risk minus untreated risk
    };
  }

  function study(input = {}) {
    const c = { ...DEFAULTS, ...input },
      rows = simulate(c),
      tr = truth(c),
      out = Object.fromEntries(ANALYSES.map((k) => [k, analyse(rows, k, c)]));
    const treated = rows.filter((r) => r.proc);
    return {
      config: c,
      rows,
      truth: tr,
      analyses: out,
      counts: {
        n: rows.length,
        treated: treated.length,
        diedWaiting: rows.filter((r) => r.W < Infinity && !r.proc && r.died).length,
        neverScheduled: rows.filter((r) => r.W === Infinity).length,
        // Person-years between eligibility and procedure among treated patients: nobody can die in them.
        immortalYears: treated.reduce((a, r) => a + r.W, 0),
      },
    };
  }

  /* Step 5: what is known at time zero about the protocol's two strategies
   * ("procedure within `grace` years" vs "no procedure"), classified by what then happens. */
  function graceCounts(rows, grace = DEFAULTS.grace, horizon = DEFAULTS.horizon) {
    const cells = {
      treatedInGrace: 0, // follows strategy A; deviated from B at the procedure
      diedInGraceUntreated: 0, // compatible with both strategies when they died
      censoredInGraceUntreated: 0, // compatible with both when lost
      untreatedPastGrace: 0, // alive and untreated at the end of grace: follows B, deviated from A
    };
    for (const r of rows) {
      if (r.proc && r.W <= grace) cells.treatedInGrace++;
      else if (r.end <= grace) r.died ? cells.diedInGraceUntreated++ : cells.censoredInGraceUntreated++;
      else cells.untreatedPastGrace++;
    }
    return { ...cells, total: rows.length, grace, horizon };
  }

  /* Eligibility decided with post-baseline information: treated patients are included only if
   * they survive `days` after the procedure (for example, a 30-day echo on file). Follow-up still
   * starts at the procedure. Exact under the constant-hazard null: the first `days` are immortal. */
  function postBaselineRisk(input = {}, days = 30) {
    const c = { ...DEFAULTS, ...input },
      d = Math.min(days / 365.25, c.horizon);
    return { honest: 1 - Math.exp(-c.lambda * c.horizon), selected: 1 - Math.exp(-c.lambda * (c.horizon - d)) };
  }

  /* Deaths and person-years accrued by analysis time tau, per arm, for one choice of time zero. */
  function tally(rows, kind, tau, grace = DEFAULTS.grace) {
    const g = arms(rows, kind, grace),
      sum = (list) => {
        let deaths = 0,
          years = 0;
        for (const r of list) {
          years += Math.max(0, Math.min(r.time, tau) - r.entry);
          if (r.event && r.time <= tau) deaths++;
        }
        return { deaths, years, rate: years > 0 ? deaths / years : NaN };
      };
    const t = sum(g.treated),
      u = sum(g.untreated);
    return { treated: t, untreated: u, ratio: t.rate / u.rate };
  }

  /* Which protocol strategies is each patient still compatible with at eligibility-time t?
   * A = procedure within `grace`; B = no procedure. Status freezes at death or censoring. */
  function status(r, t, grace = DEFAULTS.grace) {
    const s = Math.min(t, r.end),
      treatedBy = r.proc && r.W <= s;
    if (treatedBy) return r.W <= grace ? "A" : "neither";
    return s < grace ? "both" : "B";
  }
  function compatibility(rows, t, grace = DEFAULTS.grace) {
    const out = { both: 0, A: 0, B: 0, neither: 0, bothEnded: 0 };
    for (const r of rows) {
      const k = status(r, t, grace);
      out[k]++;
      if (k === "both" && r.end <= t) out.bothEnded++;
    }
    return out;
  }

  function lanes() {
    return simulate({ ...DEFAULTS, n: LANES.n, seed: LANES.seed });
  }

  return { DEFAULTS, LANES, ANALYSES, simulate, kmEntry, at, arms, truth, analyse, study, graceCounts, postBaselineRisk, tally, status, compatibility, lanes };
});
