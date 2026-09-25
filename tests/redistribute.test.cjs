const test = require("node:test");
const assert = require("node:assert");
const C = require("../science/cohort.js");
const RD = require("../figures/redistribute.js");

const close = (a, b, tol = 1e-12) => Math.abs(a - b) <= tol;
const treated = (cohort) => cohort.patients.filter((p) => p.a);

test("lesson 12: moving mass is Kaplan–Meier (Efron kernel and product limit)", () => {
  const rows = treated(C.cohort),
    H = C.PARAMS.horizon;
  assert.strictEqual(rows.length, 58);
  const sched = RD.schedule(rows, { horizon: H }),
    pts = RD.curve(sched),
    pl = C.km(rows),
    efron = C.kmRedistribute(rows).steps.filter((s) => s.event);
  assert.strictEqual(pts.length - 1, efron.length, "every event is a step");
  pts.slice(1).forEach((p, k) => {
    assert.ok(close(p.s, efron[k].s), "matches CausalCohort.kmRedistribute");
    assert.ok(close(p.s, RD.valueAt(pl, p.t)), "matches product-limit CausalCohort.km");
  });
  // Mass is conserved: fallen + on the line = 1 at every item.
  for (const it of sched.items) {
    const st = RD.stateAt(sched, it.t);
    assert.ok(close(st.s, st.onLine + sched.items.filter((q) => q.kind === "kept" && q.t <= it.t).reduce((a, q) => a + q.mass, 0)));
    assert.ok(close(1 - st.s + st.onLine, 1));
  }
  // Censorings never move the curve.
  sched.items.forEach((it, k) => {
    if (it.kind === "censor") assert.ok(close(it.s, k ? sched.items[k - 1].s : 1));
  });
  // Displayed end values.
  assert.strictEqual(sched.survivors.length, 14, "14 still followed at 10 years");
  assert.ok(close(sched.finalS, RD.valueAt(pl, H)));
});

test("a survivor stands for 1/Ĝ(t−) patients, with Ĝ the KM of remaining uncensored", () => {
  for (const [rows, H, stratum] of [
    [treated(C.cohort), C.PARAMS.horizon, null],
    [treated(C.build(RD.INFORMATIVE)), RD.INFORMATIVE.horizon, null],
    [treated(C.build(RD.INFORMATIVE)), RD.INFORMATIVE.horizon, RD.bySeverity],
  ]) {
    const sched = RD.schedule(rows, { horizon: H, stratum }),
      n = rows.length;
    for (const it of sched.items) {
      const st = RD.stateAt(sched, it.t);
      for (const i of st.atRisk) {
        const g = RD.censorKM(rows, it.t, { horizon: H, stratum, pool: stratum ? stratum(rows[i]) : null });
        assert.ok(close(st.mass[i] * n, 1 / g, 1e-9), `mass·n = 1/Ĝ at t = ${it.t}`);
      }
    }
    // Late survivors are larger: final weights exceed 1 whenever anyone was censored.
    const w = sched.survivors.map((i) => sched.finalMass[i] * n);
    assert.ok(Math.max(...w) > 1.3);
  }
});

test("within-severity redistribution is the severity-standardized KM", () => {
  const rows = treated(C.build(RD.INFORMATIVE)),
    H = RD.INFORMATIVE.horizon,
    pts = RD.curve(RD.schedule(rows, { horizon: H, stratum: RD.bySeverity }));
  for (const t of [1, 2.5, 4, 6, 7.99]) {
    let std = 0;
    for (const x of [0, 1]) {
      const r = rows.filter((p) => p.x === x);
      std += (r.length / rows.length) * RD.valueAt(C.km(r), t);
    }
    assert.ok(close(RD.valueAt(pts, t), std, 1e-12), `t = ${t}`);
  }
});

test("lesson 23 numbers: same patients, informative dropout, and the displayed gaps", () => {
  const base = treated(C.cohort),
    rows = treated(C.build(RD.INFORMATIVE)),
    H = RD.INFORMATIVE.horizon;
  // The variant changes only who drops out, not who the patients are.
  assert.deepStrictEqual(rows.map((p) => p.id), base.map((p) => p.id));
  assert.deepStrictEqual(rows.map((p) => p.t1), base.map((p) => p.t1));
  const truth = RD.valueAt(RD.truthCurve(rows), H),
    plain = RD.schedule(rows, { horizon: H }).finalS,
    strat = RD.schedule(rows, { horizon: H, stratum: RD.bySeverity }).finalS;
  assert.ok(close(truth, 31 / 58), "truth S(8) = 31/58");
  assert.ok(plain < truth - 0.05, `plain KM too low: ${plain}`);
  assert.ok(Math.abs(strat - truth) < Math.abs(plain - truth), "same-severity heirs move toward the truth");
  // Across simulated cohorts: plain KM is biased down, within-severity is nearly unbiased.
  const g = RD.gapsOverSeeds(C, RD.INFORMATIVE, 300);
  assert.ok(g.plain < -0.04, `plain bias ${g.plain}`);
  assert.ok(Math.abs(g.strat) < 0.01, `stratified bias ${g.strat}`);
});

test("boundary cases: no censoring, everyone censored, and an empty heirs pool", () => {
  const rows = treated(C.cohort).map((p) => ({ ...p, event: 1 }));
  const s = RD.schedule(rows);
  assert.ok(close(s.finalS, 0), "no censoring: all mass falls, Ŝ reaches 0");
  assert.ok(s.items.every((it) => close(it.mass, 1 / rows.length)), "every event drops exactly 1/n");
  const cens = treated(C.cohort).map((p) => ({ ...p, event: 0 }));
  const c = RD.schedule(cens);
  assert.ok(close(c.finalS, 1), "nobody has the event: the curve never moves");
  assert.ok(close(c.finalMass.reduce((a, v) => a + v, 0), 1), "mass is conserved");
  // Last low-severity patient censored with no low-severity patient to the right keeps their mass.
  const tiny = [
    { x: 0, time: 1, event: 0 },
    { x: 1, time: 2, event: 1 },
  ];
  const k = RD.schedule(tiny, { stratum: RD.bySeverity });
  assert.strictEqual(k.items[0].kind, "kept");
  assert.ok(close(k.finalS, 0.5));
  // Ties: an event and a censoring at the same time, the event goes first.
  const tie = [
    { time: 1, event: 0 },
    { time: 1, event: 1 },
    { time: 2, event: 1 },
  ];
  assert.ok(close(RD.curve(RD.schedule(tie))[1].s, RD.valueAt(C.km(tie), 1)));
  assert.ok(close(RD.schedule(tie).finalS, RD.valueAt(C.km(tie), 2)));
});
