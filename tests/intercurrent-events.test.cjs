const { test } = require("node:test");
const assert = require("node:assert/strict");
const I = require("../science/intercurrent-events.js");
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("the world has 12 lanes, six per arm, and all four kinds of intercurrent event", () => {
  const L = I.lanes();
  assert.equal(L.length, 12);
  assert.equal(L.filter((r) => r.arm === 1).length, 6);
  const kinds = new Set(L.flatMap((r) => r.events.map((e) => e.kind)));
  I.KINDS.forEach((k) => assert.ok(kinds.has(k), k));
  // Crossover only happens in control, explant only on the device.
  L.forEach((r) => r.events.forEach((e) => {
    if (e.kind === "crossover") assert.equal(r.arm, 0);
    if (e.kind === "explant") assert.equal(r.arm, 1);
  }));
  // A patient without non-fatal events has hypothetical score = observed score.
  L.filter((r) => !I.died(r) && !I.nonfatal(r).length).forEach((r) => assert.equal(r.hyp, r.visits[3]));
});

test("displayed true values for the five strategies", () => {
  const t = Object.fromEntries(I.STRATEGIES.map((s) => [s, I.truth(s).effect]));
  close(t.treatment, 34 / 3); // 316/6 − 248/6
  close(t.hypothetical, 64 / 3); // 336/6 − 208/6
  close(t.composite, 59 / 3); // 272/6 − 154/6
  close(t.whileOn, 37 / 3); // 332/6 − 258/6
  close(t.principal, 14); // pairs A and B: (22 + 6) / 2
  assert.deepEqual(I.truth("principal").members, ["A", "B"]);
});

test("balanced pairs: rules using only observed data reproduce the truth exactly", () => {
  for (const s of ["treatment", "composite", "whileOn"]) {
    const a = I.analysis(s), t = I.truth(s);
    assert.ok(a.identified);
    close(a.effect, t.effect); close(a.m1, t.m1); close(a.m0, t.m0);
  }
});

test("naive analyses for hypothetical and principal strategies miss the truth by the displayed amounts", () => {
  const h = I.analysis("hypothetical"), p = I.analysis("principal");
  assert.equal(h.identified, false); assert.equal(p.identified, false);
  close(h.effect, 272 / 5 - 154 / 4); // 15.9
  close(p.effect, 272 / 5 - 154 / 3); // 3.067
  assert.equal(p.n1, 5); assert.equal(p.n0, 3);
  assert.ok(Math.abs(h.effect - I.truth("hypothetical").effect) > 5);
  assert.ok(Math.abs(p.effect - I.truth("principal").effect) > 10);
});

test("crossover under treatment policy shrinks the effect: pair C moves the control mean by 4 points", () => {
  const C = I.PAIRS.find((p) => p.id === "C");
  const tp = I.valueFor({ ...C.arms[0], arm: 0 }, C, "treatment").value,
    hy = I.valueFor({ ...C.arms[0], arm: 0 }, C, "hypothetical").value;
  assert.equal(tp - hy, 24);
  close((tp - hy) / 6, 4);
});

test("death: no score under treatment policy or hypothetical; worst under composite; last alive under while-on", () => {
  const F = I.PAIRS.find((p) => p.id === "F"), rec = { ...F.arms[0], arm: 0 };
  assert.ok(Number.isNaN(I.valueFor(rec, F, { nonfatal: "treatment", death: "treatment" }).value));
  assert.ok(Number.isNaN(I.valueFor(rec, F, { nonfatal: "hypothetical", death: "hypothetical" }).value));
  assert.equal(I.valueFor(rec, F, "composite").value, 0);
  const w = I.valueFor(rec, F, "whileOn");
  assert.equal(w.value, 30); assert.equal(w.month, 6);
  assert.ok(Number.isNaN(I.truth({ nonfatal: "treatment", death: "treatment" }).effect));
});

test("principal-stratum membership: an own-arm event reveals exclusion; being event-free never reveals inclusion", () => {
  for (const r of I.lanes()) {
    const v = I.valueFor(r, I.PAIRS.find((p) => p.id === r.pair), "principal");
    if (r.events.length) { assert.equal(v.member, false); assert.equal(v.memberKnown, true); }
    else assert.equal(v.memberKnown, false);
  }
});

test("censoring at crossover: KM limit equals the hypothetical curve when crossover ignores risk (boundary)", () => {
  const W = I.censoring(1);
  for (const t of [0, 0.25, 0.5, 1]) close(W.km(t), W.hyp(t), 1e-10);
  close(W.rates[0], 0.5); close(W.rates[1], 0.5);
});

test("informative crossover makes the censored curve too optimistic; the average crossover rate is held fixed", () => {
  for (const ratio of [2, 4, 9]) {
    const W = I.censoring(ratio);
    close(0.7 * W.rates[0] + 0.3 * W.rates[1], 0.5);
    assert.ok(W.km(1) > W.hyp(1) + 1e-3);
  }
});

test("treatment-policy curve: closed form matches direct integration, and no crossover gives the hypothetical curve", () => {
  const W = I.censoring(3), [cL, cH] = W.rates, h = W.hazards, r = I.SURV.deviceRatio, t = 1;
  const direct = (s, c) => {
    let acc = 0; const n = 20000, dx = t / n;
    for (let i = 0; i < n; i++) { const x = (i + 0.5) * dx; acc += c * Math.exp(-(h[s] + c) * x) * Math.exp(-h[s] * r * (t - x)) * dx; }
    return Math.exp(-(h[s] + c) * t) + acc;
  };
  close(W.tp(t), 0.7 * direct(0, cL) + 0.3 * direct(1, cH), 1e-8);
  const none = I.censoring(1, { crossover: 0 });
  close(none.tp(1), none.hyp(1)); close(none.km(1), none.hyp(1), 1e-10);
});

test("displayed 12-month survival values at the default dependence (ratio 4)", () => {
  const W = I.censoring(4);
  close(W.hyp(1), 0.7 * Math.exp(-0.1) + 0.3 * Math.exp(-0.6));
  assert.equal((W.hyp(1) * 100).toFixed(1), "79.8");
  assert.ok(W.tp(1) > W.hyp(1));
});
