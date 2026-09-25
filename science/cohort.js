/* The course cohort: the same 100 patients in every lesson that shows individuals.
 * Deterministic (seeded) so a patient keeps their identity, severity, treatment and
 * outcomes from the first lesson to the last.
 *
 * Teaching world (matches the roadmap and survival labs where they overlap):
 *   severity X ∈ {0 low, 1 high}, 35 of 100 high
 *   treatment A ~ Bernoulli(g(X)), g(0) = 0.3, g(1) = 0.7 (confounded by severity)
 *   numerical outcome Y = 2 + 1.5·X + A·(1.86 + 0.40·X) + N(0, 1)   (benefits 1.86 low, 2.26 high)
 *   event time T ~ Exponential(λ(X)·HR^A), λ = 0.08 (low), 0.32 (high) per year, HR = 0.65
 *   censoring C ~ Exponential(0.06 + 0.06·X) per year, administrative end at 10 years
 * Each patient also carries both potential outcomes (Y0, Y1, T0, T1) so lessons can show truth.
 * In this draw the sample ATE is exactly 2; the naive contrast is 2.59 and severity-standardization
 * gives 2.20 (the 0.20 is chance within strata, centred on 2 over repeated cohorts). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalCohort = api;
})(globalThis, function () {
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const PARAMS = {
    n: 100,
    nHigh: 35,
    g: [0.3, 0.7],
    base: 2,
    sevEffect: 1.5,
    benefit: [1.86, 2.26],
    hazard: [0.08, 0.32],
    hr: 0.65,
    censor: [0.06, 0.12],
    horizon: 10,
    seed: 20260925,
  };
  function build(params = {}) {
    const P = { ...PARAMS, ...params };
    const r = rng(P.seed);
    const normal = () =>
      Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());
    const expo = (rate) => -Math.log(Math.max(1e-12, r())) / rate;
    const patients = [];
    for (let i = 0; i < P.n; i++) {
      const x = i < P.nHigh ? 1 : 0;
      const u = r();
      const a = +(u < P.g[x]);
      const e = normal();
      const y0 = P.base + P.sevEffect * x + e;
      const y1 = y0 + P.benefit[x];
      const w = expo(1); // shared unit-rate draw: T_a = w / (λ HR^a), so potential times are coupled
      const t0 = w / P.hazard[x];
      const t1 = w / (P.hazard[x] * P.hr);
      const c = Math.min(expo(P.censor[x]), P.horizon);
      const t = a ? t1 : t0;
      patients.push({
        id: i,
        x,
        g: P.g[x],
        a,
        y0,
        y1,
        y: a ? y1 : y0,
        t0,
        t1,
        c,
        time: Math.min(t, c),
        event: +(t <= c),
      });
    }
    // Shuffle presentation order deterministically so severity is not in blocks, keeping ids.
    const order = patients.map((p) => p.id);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    order.forEach((id, k) => (patients[id].slot = k));
    return { params: P, patients };
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  function summary(cohort) {
    const ps = cohort.patients;
    const ate = mean(ps.map((p) => p.y1 - p.y0));
    const tr = ps.filter((p) => p.a),
      co = ps.filter((p) => !p.a);
    return {
      n: ps.length,
      nTreated: tr.length,
      nHigh: ps.filter((p) => p.x).length,
      sampleATE: ate,
      naive: mean(tr.map((p) => p.y)) - mean(co.map((p) => p.y)),
      events: ps.filter((p) => p.event).length,
    };
  }
  /* Kaplan–Meier with optional weights; returns steps [{t, s, atRisk, d}] and per-time mass
   * flows for "redistribute to the right" (Efron 1967): when a patient is censored their
   * mass is shared equally (or by weight) among everyone still at risk. */
  function kmRedistribute(rows, weights) {
    const w = weights || rows.map(() => 1);
    const idx = rows.map((_, i) => i).sort(
      (i, j) => rows[i].time - rows[j].time || rows[j].event - rows[i].event,
    );
    const total = w.reduce((s, v) => s + v, 0);
    const mass = w.map((v) => v / total);
    let s = 1;
    const steps = [{ t: 0, s: 1 }],
      flows = [];
    const alive = new Set(idx);
    for (const i of idx) {
      alive.delete(i);
      if (rows[i].event) {
        s -= mass[i];
        steps.push({ t: rows[i].time, s, id: i, event: 1 });
      } else {
        const heirs = [...alive];
        const hw = heirs.reduce((a, j) => a + w[j], 0);
        const gift = heirs.map((j) => ({ to: j, amount: hw ? (mass[i] * w[j]) / hw : 0 }));
        gift.forEach((g) => (mass[g.to] += g.amount));
        flows.push({ t: rows[i].time, from: i, gifts: gift, amount: mass[i] });
        mass[i] = heirs.length ? 0 : mass[i];
      }
    }
    return { steps, flows, finalMass: mass };
  }
  function km(rows) {
    // Product-limit, for checking the redistribution identity.
    const times = [...new Set(rows.filter((r) => r.event).map((r) => r.time))].sort((a, b) => a - b);
    let s = 1;
    const out = [{ t: 0, s: 1 }];
    for (const t of times) {
      const n = rows.filter((r) => r.time >= t).length,
        d = rows.filter((r) => r.time === t && r.event).length;
      s *= 1 - d / n;
      out.push({ t, s });
    }
    return out;
  }
  const cohort = build();
  return { PARAMS, build, summary, km, kmRedistribute, rng, cohort };
});
