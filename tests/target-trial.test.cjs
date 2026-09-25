const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../science/target-trial.js");
const S = require("../science/core.js");
const close = (a, b, tol = 1e-10) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("simulation is seeded and internally consistent", () => {
  const a = T.simulate(), b = T.simulate();
  assert.deepEqual(a, b);
  for (const r of a) {
    close(r.end, Math.min(r.T, r.C));
    assert.equal(r.died, r.T <= r.C);
    assert.equal(r.proc, r.W < r.end);
    assert.ok(r.C <= T.DEFAULTS.admin);
  }
});

test("null and non-null worlds share random numbers; deaths before the procedure are identical", () => {
  const a = T.simulate({ hr: 1 }), b = T.simulate({ hr: 0.7 });
  a.forEach((r, i) => {
    assert.equal(r.W, b[i].W);
    close(r.C, b[i].C);
    if (r.T <= r.W) close(r.T, b[i].T);
    else assert.ok(b[i].T >= r.T - 1e-12, "a protective procedure can only postpone death");
  });
});

test("kmEntry matches core.km without delayed entry and handles entry correctly", () => {
  const rows = T.simulate({ n: 300, seed: 3 }).map((r) => ({ entry: 0, time: r.end, event: r.died }));
  const a = T.kmEntry(rows, 1), b = S.km(rows.map((r) => ({ time: r.time, event: r.event })), 1);
  close(a.s, b.s, 1e-12);
  // Hand example: deaths at 2 (risk set: the two still in follow-up) and 3 (the late entrant is at risk).
  const hand = T.kmEntry([
    { entry: 0, time: 0.5, event: false },
    { entry: 0, time: 2, event: true },
    { entry: 1, time: 3, event: true },
    { entry: 2.5, time: 3, event: false },
  ], 4);
  close(hand.s, (1 - 1 / 2) * (1 - 1 / 2));
  // Boundary: a subject entering exactly at a death time is not at risk for it.
  close(T.kmEntry([{ entry: 0, time: 1, event: true }, { entry: 1, time: 2, event: false }], 2).s, 0);
});

test("truth is exact and null under hr = 1", () => {
  const t = T.truth();
  close(t.r0, 1 - Math.exp(-0.35));
  close(t.rd, 0);
  close(T.truth({ hr: 0.7 }).r1, 1 - Math.exp(-0.245));
});

test("displayed default numbers: aligned is near truth, misaligned choices manufacture benefit", () => {
  const s = T.study();
  assert.equal(s.counts.n, 2000);
  assert.equal(s.counts.treated, 1135);
  assert.equal(s.counts.diedWaiting, 198);
  assert.equal(s.counts.neverScheduled, 628);
  const rd = Object.fromEntries(T.ANALYSES.map((k) => [k, s.analyses[k].rd]));
  close(rd.aligned, -0.0010, 5e-4);
  close(rd.procedure, -0.1431, 5e-4);
  close(rd.ever, -0.2509, 5e-4);
  close(s.analyses.ever.treated.risk, 0.1855, 5e-4);
  close(s.analyses.procedure.untreated.risk, 0.4364, 5e-4);
  // Group sizes partition the cohort for the fixed-group analyses; aligned uses everyone as untreated person-time.
  for (const k of ["procedure", "ever"]) assert.equal(s.analyses[k].treated.n + s.analyses[k].untreated.n, 2000);
  assert.equal(s.analyses.aligned.untreated.n, 2000);
});

test("the bias is systematic: averaged over seeds, aligned is unbiased and the others are not", () => {
  const acc = { aligned: 0, procedure: 0, ever: 0 }, reps = 20;
  for (let seed = 1; seed <= reps; seed++) {
    const rows = T.simulate({ seed });
    for (const k of Object.keys(acc)) acc[k] += T.analyse(rows, k).rd / reps;
  }
  assert.ok(Math.abs(acc.aligned) < 0.015, "aligned " + acc.aligned);
  assert.ok(acc.procedure < -0.1, "procedure " + acc.procedure);
  assert.ok(acc.ever < acc.procedure, "ever-treated is worse");
});

test("with a true benefit, aligned tracks the truth; misaligned exaggerates it", () => {
  const s = T.study({ hr: 0.7 });
  close(s.analyses.aligned.rd, s.truth.rd, 0.03);
  assert.ok(s.analyses.procedure.rd < s.truth.rd - 0.1);
});

test("swimlane patients and their tallies (displayed in step 2)", () => {
  const L = T.lanes();
  assert.equal(L.length, 20);
  assert.equal(L.filter((r) => r.proc).length, 11);
  assert.equal(L.filter((r) => r.W < Infinity && !r.proc && r.died).length, 5);
  close(T.tally(L, "aligned", 1).ratio, 0.956, 1e-3);
  close(T.tally(L, "procedure", 1).ratio, 0.238, 1e-3);
  close(T.tally(L, "ever", 1).ratio, 0.205, 1e-3);
  // Boundary: at analysis time 0 there is no person-time and no death.
  const z = T.tally(L, "aligned", 0);
  assert.equal(z.treated.years + z.untreated.years, 0);
  // Person-time identity: aligned splits each patient's first year exactly; ever re-labels waiting time as treated.
  const a = T.tally(L, "aligned", 1), e = T.tally(L, "ever", 1);
  close(a.treated.years + a.untreated.years, e.treated.years + e.untreated.years, 1e-9);
});

test("grace period: everyone compatible with both strategies at time zero; misassignment biases both ways", () => {
  const rows = T.simulate();
  const c0 = T.compatibility(rows, 0);
  assert.equal(c0.both, 2000);
  const g = T.graceCounts(rows);
  assert.equal(g.treatedInGrace + g.diedInGraceUntreated + g.censoredInGraceUntreated + g.untreatedPastGrace, 2000);
  assert.equal(g.diedInGraceUntreated, 233);
  const c6 = T.compatibility(rows, 0.5);
  assert.equal(c6.both, g.diedInGraceUntreated + g.censoredInGraceUntreated);
  assert.equal(c6.A, g.treatedInGrace);
  const toB = T.analyse(rows, "grace").rd, toA = T.analyse(rows, "graceToProcedure").rd;
  close(toB, -0.0738, 5e-4);
  close(toA, 0.2616, 5e-4);
});

test("post-baseline eligibility: exact selected risk, with zero days as the boundary", () => {
  const r0 = T.postBaselineRisk({}, 0);
  close(r0.selected, r0.honest);
  const r30 = T.postBaselineRisk({}, 30);
  close(r30.selected, 1 - Math.exp(-0.35 * (1 - 30 / 365.25)));
  close(r30.honest, 0.2953, 1e-4);
  close(r30.selected, 0.2748, 1e-4);
});

test("practice identity: counting n waiting months per treated patient gives rate ratio 10/(10+n)", () => {
  for (let n = 2; n <= 9; n++) {
    const treatedRate = 30 / (100 + (120 * n) / 12), untreatedRate = 30 / 100;
    close(treatedRate / untreatedRate, 10 / (10 + n));
  }
});
