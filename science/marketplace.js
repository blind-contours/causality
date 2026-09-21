/* Minimal two-zone shared-fleet simulator, assignment designs, estimators, and a validated
 * finite-history benchmark. Deterministic for fixed inputs. No DOM.
 *
 * SPEC (the Python reference in examples/marketplace implements the same rules; both are
 * checked against examples/marketplace/fixtures/hand_worked.json):
 *  - Time is integer minutes t = 0 … horizon−1. Two zones, 0 and 1, adjacent.
 *  - Vehicles: {id, zone, freeAt}. A vehicle is free at t if freeAt ≤ t.
 *  - Requests: {id, t, origin, dest, maxWait}. Eligible requests are those arriving in
 *    [0, horizon). Requests arriving after `horizon − followUp` are still followed for
 *    `followUp` minutes so every eligible request gets a terminal status.
 *  - Each minute: first, waiting requests (ordered by arrival then id) are matched, then the
 *    minute's new arrivals (ordered by id). A request keeps the policy assigned at its arrival.
 *  - Policy A: choose a free vehicle in the origin zone. Policy B: same; if none, choose a free
 *    vehicle in the other zone. Tie-break: smallest freeAt, then smallest id.
 *  - Pickup takes pickupLocal minutes from the same zone, pickupCross from the other zone.
 *    Trip takes tripLocal if origin = dest, else tripCross. The vehicle ends at dest and is
 *    free at pickup + trip. Served-within-deadline means pickup − arrival ≤ deadline.
 *  - A request expires unserved when t − arrival > maxWait and it is still unmatched.
 *  - Demand and travel inputs come from `demandRng`; assignments come from `assignRng`. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalMarketplace = api;
})(globalThis, function () {
  const VERSION = "1.0.0";
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s += 0x6d2b79f5;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const sum = (v) => v.reduce((a, b) => a + b, 0);
  const mean = (v) => (v.length ? sum(v) / v.length : NaN);
  const variance = (v) => {
    if (v.length < 2) return NaN;
    const m = mean(v);
    return sum(v.map((x) => (x - m) ** 2)) / (v.length - 1);
  };

  const DEFAULT_CONFIG = {
    horizon: 240,
    followUp: 30,
    fleet: 6,
    demandPerMinute: 0.35,
    zoneShare: 0.5,
    crossDestShare: 0.3,
    maxWait: 8,
    deadline: 6,
    pickupLocal: 2,
    pickupCross: 4,
    tripLocal: 8,
    tripCross: 14,
    blockLength: 30,
    washout: 0,
    demandSeed: 11,
    assignSeed: 7,
  };

  /* Exogenous demand: Poisson-ish arrivals per minute, origin by zone share, destination. */
  function generateRequests(cfg, random) {
    const reqs = [];
    let id = 0;
    for (let t = 0; t < cfg.horizon; t++) {
      // Poisson via inversion with a cap so the browser stays responsive.
      let k = 0,
        p = Math.exp(-cfg.demandPerMinute),
        u = random(),
        acc = p;
      while (u > acc && k < 8) {
        k++;
        p *= cfg.demandPerMinute / k;
        acc += p;
      }
      for (let j = 0; j < k; j++) {
        const origin = random() < cfg.zoneShare ? 0 : 1,
          dest = random() < cfg.crossDestShare ? 1 - origin : origin;
        reqs.push({ id: id++, t, origin, dest, maxWait: cfg.maxWait });
      }
    }
    return reqs;
  }
  function initialFleet(cfg, random) {
    // Vehicles start free, spread across zones; the initial-state distribution is part of the target.
    return Array.from({ length: cfg.fleet }, (_, id) => ({
      id,
      zone: random() < cfg.zoneShare ? 0 : 1,
      freeAt: 0,
    }));
  }

  /* Assignment designs. Each returns policyAt(request) ∈ {"A","B"} plus a schedule description. */
  function design(kind, cfg, random) {
    if (kind === "allA" || kind === "allB") {
      const z = kind === "allB" ? "B" : "A";
      return { kind, policyAt: () => z, schedule: [] };
    }
    if (kind === "request") {
      const draws = new Map();
      return {
        kind,
        policyAt: (r) => {
          if (!draws.has(r.id)) draws.set(r.id, random() < 0.5 ? "B" : "A");
          return draws.get(r.id);
        },
        schedule: [],
        probability: 0.5,
      };
    }
    if (kind === "fixed") {
      // An explicit schedule of half-open blocks, used by fixtures and by the Python reference.
      const schedule = cfg.schedule.map((b) => ({ ...b }));
      const L = schedule[0].end - schedule[0].start;
      return {
        kind,
        schedule,
        probability: null,
        blockOf: (t) => Math.floor(t / L),
        policyAt: (r) => {
          const b = schedule.find((x) => r.t >= x.start && r.t < x.end);
          if (!b) throw Error("No block covers arrival time " + r.t);
          return b.policy;
        },
      };
    }
    if (kind === "switchback") {
      const L = cfg.blockLength,
        blocks = Math.ceil((cfg.horizon + cfg.followUp) / L),
        schedule = Array.from({ length: blocks }, (_, b) => ({
          block: b,
          start: b * L,
          end: (b + 1) * L, // half-open [start, end)
          policy: random() < 0.5 ? "B" : "A",
        }));
      return {
        kind,
        schedule,
        probability: 0.5,
        blockOf: (t) => Math.floor(t / L),
        policyAt: (r) => schedule[Math.floor(r.t / L)].policy,
      };
    }
    throw Error("Unknown design " + kind);
  }

  /* Run the fleet through one experiment. Returns per-request outcomes and vehicle events. */
  function simulate(cfg, designKind, opts = {}) {
    const c = { ...DEFAULT_CONFIG, ...cfg };
    const demandRng = rng(c.demandSeed),
      assignRng = rng(c.assignSeed);
    const requests = opts.requests || generateRequests(c, demandRng),
      fleet = opts.fleet || initialFleet(c, demandRng),
      d = design(designKind, c, assignRng),
      end = c.horizon + c.followUp;
    // Policies B and A can be made identical for a sharp null.
    const searchOther = (policy) =>
      policy === "B" && !(opts.sharpNull === true);
    const outcomes = requests.map((r) => ({
      id: r.id,
      t: r.t,
      origin: r.origin,
      dest: r.dest,
      policy: d.policyAt(r),
      block: d.blockOf ? d.blockOf(r.t) : null,
      status: "waiting",
      vehicle: null,
      pickup: null,
      complete: null,
      wait: null,
      servedInTime: 0,
    }));
    const byArrival = new Map();
    outcomes.forEach((o) => {
      if (!byArrival.has(o.t)) byArrival.set(o.t, []);
      byArrival.get(o.t).push(o);
    });
    const events = [];
    const waiting = [];
    const match = (o, t) => {
      const free = fleet.filter((v) => v.freeAt <= t);
      const pick = (zone) =>
        free
          .filter((v) => v.zone === zone)
          .sort((x, y) => x.freeAt - y.freeAt || x.id - y.id)[0];
      let v = pick(o.origin),
        pickupTime = c.pickupLocal;
      if (!v && searchOther(o.policy)) {
        v = pick(1 - o.origin);
        pickupTime = c.pickupCross;
      }
      if (!v) return false;
      const pickup = t + pickupTime,
        trip = o.origin === o.dest ? c.tripLocal : c.tripCross;
      o.status = "served";
      o.vehicle = v.id;
      o.pickup = pickup;
      o.complete = pickup + trip;
      o.wait = pickup - o.t;
      o.servedInTime = o.wait <= c.deadline ? 1 : 0;
      events.push({
        t,
        vehicle: v.id,
        state: "assigned",
        zone: v.zone,
        request: o.id,
      });
      events.push({
        t: o.complete,
        vehicle: v.id,
        state: "free",
        zone: o.dest,
        request: o.id,
      });
      v.freeAt = o.complete;
      v.zone = o.dest;
      return true;
    };
    for (let t = 0; t < end; t++) {
      // Expire, then match waiting requests in arrival order, then new arrivals.
      for (const o of waiting.slice()) {
        if (t - o.t > c.maxWait) {
          o.status = "unserved";
          waiting.splice(waiting.indexOf(o), 1);
        }
      }
      for (const o of waiting.slice())
        if (match(o, t)) waiting.splice(waiting.indexOf(o), 1);
      for (const o of byArrival.get(t) || []) if (!match(o, t)) waiting.push(o);
    }
    waiting.forEach((o) => (o.status = "unserved"));
    return {
      version: VERSION,
      config: c,
      design: {
        kind: d.kind,
        schedule: d.schedule,
        probability: d.probability ?? null,
      },
      requests: outcomes,
      events,
      fleetCount: fleet.length,
    };
  }

  /* Primary metric: fraction of eligible requests served within the deadline.
   * Unserved requests stay in the denominator. */
  function fulfilment(rows) {
    return rows.length ? mean(rows.map((o) => o.servedInTime)) : NaN;
  }

  /* Estimators. Each states its target and assumptions in `about`. */
  function requestEstimate(run) {
    const A = run.requests.filter((o) => o.policy === "A"),
      B = run.requests.filter((o) => o.policy === "B");
    const yA = A.map((o) => o.servedInTime),
      yB = B.map((o) => o.servedInTime);
    const est = mean(yB) - mean(yA),
      se = Math.sqrt(variance(yA) / yA.length + variance(yB) / yB.length);
    return {
      estimate: est,
      se,
      units: A.length + B.length,
      nA: A.length,
      nB: B.length,
      about:
        "Difference in fulfilment between B-assigned and A-assigned requests sharing one fleet. Its target is the effect of switching a request's own policy while the fleet is shared; it is not the all-B versus all-A policy effect.",
    };
  }
  function switchbackEstimate(run, { washout = run.config.washout } = {}) {
    const L = run.config.blockLength;
    const kept = run.requests.filter(
      (o) => o.t < run.config.horizon && o.t - o.block * L >= washout,
    );
    const blocks = new Map();
    kept.forEach((o) => {
      if (!blocks.has(o.block))
        blocks.set(o.block, { policy: o.policy, rows: [] });
      blocks.get(o.block).rows.push(o);
    });
    const per = [...blocks.values()].map((b) => ({
      policy: b.policy,
      y: fulfilment(b.rows),
      n: b.rows.length,
    }));
    const A = per.filter((b) => b.policy === "A").map((b) => b.y),
      B = per.filter((b) => b.policy === "B").map((b) => b.y);
    const est = mean(B) - mean(A),
      se = Math.sqrt(variance(A) / A.length + variance(B) / B.length);
    return {
      estimate: est,
      se,
      units: per.length,
      blocksA: A.length,
      blocksB: B.length,
      excluded:
        run.requests.filter((o) => o.t < run.config.horizon).length -
        kept.length,
      perBlock: per,
      about:
        "Difference in block-level fulfilment between B blocks and A blocks, blocks weighted equally, with the first `washout` minutes of each block excluded. Valid as a two-sample interval when block outcomes are independent given assignment and carryover ends within the washout.",
    };
  }
  /* Sharp-null randomization test for a switchback: re-randomize the block sequence under the
   * actual design and recompute the statistic. Tests H0: policy has no effect on any block. */
  function switchbackRandomizationTest(run, reps = 400, seed = 3, opts = {}) {
    const random = rng(seed),
      observed = switchbackEstimate(run, opts).estimate,
      L = run.config.blockLength;
    let extreme = 0;
    for (let r = 0; r < reps; r++) {
      const relabel = run.design.schedule.map(() =>
        random() < 0.5 ? "B" : "A",
      );
      const fake = {
        ...run,
        requests: run.requests.map((o) => ({
          ...o,
          policy: relabel[Math.floor(o.t / L)],
        })),
      };
      const s = switchbackEstimate(fake, opts).estimate;
      if (Number.isFinite(s) && Math.abs(s) >= Math.abs(observed) - 1e-12)
        extreme++;
    }
    return { observed, pValue: (extreme + 1) / (reps + 1), reps };
  }

  /* Full-policy reference: repeated independent all-B and all-A worlds with matched demand
   * (same demandSeed per replication), reported with Monte Carlo uncertainty. */
  function policyReference(cfg, reps = 40, seed = 100) {
    const diffs = [];
    for (let r = 0; r < reps; r++) {
      const c = { ...cfg, demandSeed: seed + r, assignSeed: 1 };
      const b = simulate(c, "allB"),
        a = simulate(c, "allA");
      diffs.push(
        fulfilment(b.requests.filter((o) => o.t < b.config.horizon)) -
          fulfilment(a.requests.filter((o) => o.t < a.config.horizon)),
      );
    }
    return {
      estimate: mean(diffs),
      mcse: Math.sqrt(variance(diffs) / reps),
      reps,
    };
  }

  /* Repeated experiments for one design. Returns per-replication estimates and calibration
   * against a stated target, with Monte Carlo standard errors. */
  function experiment(
    cfg,
    designKind,
    { reps = 60, seed = 500, target = null, sharpNull = false, washout } = {},
  ) {
    const rows = [];
    for (let r = 0; r < reps; r++) {
      const c = { ...cfg, demandSeed: seed + r, assignSeed: seed + 1000 + r };
      const run = simulate(c, designKind, { sharpNull });
      const e =
        designKind === "switchback"
          ? switchbackEstimate(run, { washout: washout ?? c.washout })
          : requestEstimate(run);
      rows.push({ estimate: e.estimate, se: e.se, units: e.units });
    }
    const ests = rows.map((x) => x.estimate).filter(Number.isFinite);
    const summary = {
      mean: mean(ests),
      sd: Math.sqrt(variance(ests)),
      mcse: Math.sqrt(variance(ests) / ests.length),
      meanSE: mean(rows.map((x) => x.se).filter(Number.isFinite)),
      units: mean(rows.map((x) => x.units)),
      reps: ests.length,
    };
    const reject = rows.filter(
      (x) => Number.isFinite(x.se) && Math.abs(x.estimate) > 1.96 * x.se,
    ).length;
    summary.rejectRate = reject / rows.length;
    summary.rejectMCSE = Math.sqrt(
      (summary.rejectRate * (1 - summary.rejectRate)) / rows.length,
    );
    if (target !== null && Number.isFinite(target)) {
      summary.bias = summary.mean - target;
      const cover = rows.filter(
        (x) =>
          Number.isFinite(x.se) && Math.abs(x.estimate - target) <= 1.96 * x.se,
      ).length;
      summary.coverage = cover / rows.length;
      summary.coverageMCSE = Math.sqrt(
        (summary.coverage * (1 - summary.coverage)) / rows.length,
      );
    }
    return {
      rows,
      summary,
      design: designKind,
      config: { ...DEFAULT_CONFIG, ...cfg },
    };
  }

  /* ---------- Validated finite-history benchmark ----------
   * Periods t = 1..T, policy z_t ∈ {0,1} constant within blocks of length L, blocks assigned
   * independently with probability ½. Outcome y_t = mu + delta·z_t + rho·z_{t−1} + e_t, e iid.
   * Full-policy effect: delta + rho. Carryover lasts exactly one period, so dropping the first
   * period of every block makes the block-mean difference unbiased for delta + rho, and block
   * means are independent given assignment: the two-sample interval is valid. */
  function benchmark({
    blocks = 20,
    L = 6,
    mu = 0.5,
    delta = 0.1,
    rho = 0.05,
    sigma = 0.1,
    washout = 1,
    seed = 1,
  } = {}) {
    const random = rng(seed);
    const z = Array.from({ length: blocks }, () => (random() < 0.5 ? 1 : 0));
    const per = [];
    let prev = 0;
    for (let b = 0; b < blocks; b++) {
      const ys = [];
      for (let k = 0; k < L; k++) {
        const zPrev = k === 0 ? prev : z[b];
        // Box–Muller noise.
        const u1 = Math.max(1e-12, random()),
          u2 = random(),
          e = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const y = mu + delta * z[b] + rho * zPrev + e;
        if (k >= washout) ys.push(y);
      }
      per.push({ policy: z[b] ? "B" : "A", y: mean(ys), n: ys.length });
      prev = z[b];
    }
    const A = per.filter((p) => p.policy === "A").map((p) => p.y),
      B = per.filter((p) => p.policy === "B").map((p) => p.y);
    return {
      estimate: mean(B) - mean(A),
      se: Math.sqrt(variance(A) / A.length + variance(B) / B.length),
      target: delta + rho,
      // Without washout the first period of each block carries the previous block's policy
      // (mean ½), so the block-mean difference targets delta + rho(L−1)/L: bias ≈ −rho/L.
      naiveBias: washout === 0 ? -rho / L : 0,
      perBlock: per,
      z,
    };
  }
  function benchmarkCalibration(opts = {}, reps = 400, seed = 900) {
    const rows = [];
    for (let r = 0; r < reps; r++)
      rows.push(benchmark({ ...opts, seed: seed + r }));
    const ests = rows.map((x) => x.estimate),
      target = rows[0].target,
      cover = rows.filter(
        (x) => Math.abs(x.estimate - target) <= 1.96 * x.se,
      ).length;
    return {
      target,
      mean: mean(ests),
      bias: mean(ests) - target,
      mcse: Math.sqrt(variance(ests) / reps),
      coverage: cover / reps,
      coverageMCSE: Math.sqrt(((cover / reps) * (1 - cover / reps)) / reps),
      reps,
    };
  }

  return {
    VERSION,
    DEFAULT_CONFIG,
    rng,
    generateRequests,
    initialFleet,
    design,
    simulate,
    fulfilment,
    requestEstimate,
    switchbackEstimate,
    switchbackRandomizationTest,
    policyReference,
    experiment,
    benchmark,
    benchmarkCalibration,
    mean,
    variance,
  };
});
