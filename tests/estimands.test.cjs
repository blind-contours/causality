const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../science/estimands.js");
const S = require("../science/core.js");
const close = (a, b, tol = 1e-10) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("population selection gives the worked ATE 1.8, ATT 3.4, and ATC 1.4", () => {
  const c = { p: .2, gLow: .1, gHigh: .6, effectLow: 1, effectHigh: 5 };
  const m = E.means(c);
  close(m.effects.ate, 1.8); close(m.effects.att, 3.4); close(m.effects.atc, 1.4);
  close(m.treated[1], .6); close(m.untreated[1], .1);
  for (const target of ["ate", "att", "atc"]) {
    const selected = E.means({ ...c, target });
    close(selected.target, m.effects[target]);
    assert.deepEqual(selected.effect, m.effect, "choosing a target does not change potential-outcome contrasts");
  }
});
test("ATE decomposes over actual treatment membership, including reversed selection", () => {
  for (const p of [.1, .35, .8]) for (const gLow of [.1, .5, .9]) for (const gHigh of [0, .4, 1]) {
    const m = E.means({ p, gLow, gHigh, effectLow: -2, effectHigh: 5 });
    close(m.effects.ate, m.treatedShare * m.effects.att + (1 - m.treatedShare) * m.effects.atc);
    for (const w of [m.all, m.treated, m.untreated]) close(w[0] + w[1], 1);
  }
});
test("constant effects make ATE, ATT, and ATC coincide; randomized membership also does", () => {
  const same = E.means({ effectLow: 2, effectHigh: 2 });
  Object.values(same.effects).forEach(v => close(v, 2));
  const random = E.means({ gLow: .3, gHigh: .3, effectLow: 1, effectHigh: 5 });
  close(random.effects.ate, random.effects.att); close(random.effects.ate, random.effects.atc);
});
test("the reference mean world agrees with the existing course generator", () => {
  const m = E.means();
  [0, 1].forEach(x => { close(m.control[x], S.trueM(x, 0)); close(m.treatment[x], S.trueM(x, 1)); });
  close(m.target, 2);
});
test("empty target populations are undefined, not silently replaced by the whole cohort", () => {
  assert.equal(E.population({ gLow: 0, gHigh: 0, target: "att" }).weights, null);
  assert.ok(Number.isNaN(E.means({ gLow: 0, gHigh: 0, target: "att" }).target));
  assert.equal(E.population({ gLow: 1, gHigh: 1, target: "atc" }).weights, null);
});
test("identification support is specific to ATE, ATT, or ATC", () => {
  const c = { exchange: true, consistent: true };
  assert.equal(S.identification({ ...c, target: "ate", gHigh: 0 }).computable, false);
  assert.equal(S.identification({ ...c, target: "att", gHigh: 0 }).computable, true);
  assert.equal(S.identification({ ...c, target: "atc", gHigh: 0 }).computable, false);
  assert.equal(S.identification({ ...c, target: "ate", gHigh: 1 }).computable, false);
  assert.equal(S.identification({ ...c, target: "att", gHigh: 1 }).computable, false);
  assert.equal(S.identification({ ...c, target: "atc", gHigh: 1 }).computable, true);
  assert.equal(S.identification({ ...c, target: "att", gLow: 0, gHigh: 0 }).computable, false);
  assert.equal(S.identification({ ...c, target: "atc", gLow: 1, gHigh: 1 }).computable, false);
  const removed = S.identification({ ...c, target: "atc", gHigh: 1, exchange: false });
  assert.equal(removed.computable, true); assert.equal(removed.identified, false);
});
test("halving common and rare events preserves RR while changing RD tenfold", () => {
  const common = E.risks({ riskLow: .2, riskHigh: .2, riskMultiplier: .5 }),
    rare = E.risks({ riskLow: .02, riskHigh: .02, riskMultiplier: .5 });
  close(common.rr, .5); close(rare.rr, .5); close(common.rd, -.1); close(rare.rd, -.01);
  const zero = E.risks({ riskLow: 0, riskHigh: 0 });
  close(zero.rd, 0); assert.ok(Number.isNaN(zero.rr));
  assert.throws(() => E.risks({ riskHigh: .8, riskMultiplier: 2 }), /between zero and one/);
});
test("both intervention risks use the same selected population", () => {
  const r = E.risks({ p: .2, gLow: .1, gHigh: .6, target: "att", riskLow: .1, riskHigh: .4, riskMultiplier: .5 });
  close(r.r0, .4 * .1 + .6 * .4); close(r.r1, .4 * .05 + .6 * .2);
});
test("analytic RMST agrees with numerical integration of each displayed curve", () => {
  for (const target of ["ate", "att", "atc"]) for (const delay of [0, 2]) {
    const c = { target, delay, tau: 5, hazardRatio: .65 }, r = E.survival(c), n = 10000, dt = c.tau / n;
    for (const arm of [0, 1]) {
      let integral = 0;
      for (let i = 0; i < n; i++) integral += .5 * (r.at(i * dt, arm) + r.at((i + 1) * dt, arm)) * dt;
      close(integral, arm ? r.rmst1 : r.rmst0, 1e-7);
    }
    const h = 1e-5;
    close((E.survival({ ...c, tau: c.tau + h }).rmstDifference - E.survival({ ...c, tau: c.tau - h }).rmstDifference) / (2 * h), r.difference, 1e-8);
  }
});
test("survival handles zero time, no effect, a delayed effect, and harm", () => {
  const zero = E.survival({ tau: 0 });
  close(zero.s0, 1); close(zero.s1, 1); close(zero.rmstDifference, 0);
  const same = E.survival({ hazardRatio: 1 });
  close(same.difference, 0); close(same.rmstDifference, 0);
  const waiting = E.survival({ delay: 3, tau: 2 });
  close(waiting.difference, 0); close(waiting.rmstDifference, 0);
  const harm = E.survival({ hazardRatio: 1.5 });
  assert.ok(harm.difference < 0); assert.ok(harm.rmstDifference < 0);
  close(E.restrictedMean(0, .5, 2, 5), 5);
});
