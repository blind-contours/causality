const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../shared/placement.js");
globalThis.window = globalThis.window || {};
require("../shared/curriculum.js");
const COURSE = globalThis.window.CausalCurriculum;
const allUnits = COURSE.chapters.flatMap((c) => c.units);
const core = P.coreUnits(COURSE.chapters).map((u) => u.id);
const right = P.QUESTIONS.map((q) => q.answer);
const wrong = (q) => (q.answer + 1) % q.options.length;
const U = P.UNSURE;

const ix = Object.fromEntries(P.QUESTIONS.map((q, i) => [q.id, i]));
const THEORY = ["influence", "dr", "tmle", "se"];
const FOUNDATION = ["estimand", "identification", "design", "gcomp"];
const withAns = (base, over) => {
  const a = base.slice();
  for (const [id, v] of Object.entries(over)) a[ix[id]] = v === "wrong" ? wrong(P.QUESTIONS[ix[id]]) : v;
  return a;
};

test("all correct starts at Trust the answer", () => {
  const r = P.score(right);
  assert.equal(r.placement, "inference");
  assert.equal(r.unit, "efficiency-theory-story");
  assert.equal(r.correct, P.QUESTIONS.length);
  assert.equal(r.unsure, 0);
  assert.equal(r.isolated, null);
  assert.equal(r.tour, false);
  assert.ok(r.review.length >= 1 && r.review.length <= 2);
});

test("all unsure starts at the beginning, suggests the Tour, and says so honestly", () => {
  const r = P.score(P.QUESTIONS.map(() => U));
  assert.equal(r.placement, "beginning");
  assert.equal(r.unit, "causal-roadmap");
  assert.equal(r.correct, 0);
  assert.equal(r.unsure, P.QUESTIONS.length);
  assert.deepEqual(r.review, []);
  assert.deepEqual(r.strengths, []);
  assert.equal(r.tour, true);
  assert.match(P.opener(r), /honest/);
});

test("empty or missing answers behave like unsure", () => {
  assert.equal(P.score([]).placement, "beginning");
  assert.equal(P.score(undefined).placement, "beginning");
  assert.equal(P.score({}).unsure, P.QUESTIONS.length);
});

test("walkthrough: foundations right, every estimation question unsure -> the payoff, not the geometry", () => {
  const a = withAns(right, { influence: U, dr: U, tmle: U, se: U });
  const r = P.score(a);
  assert.equal(r.placement, "payoff");
  assert.equal(r.unit, "rct-adjustment");
  assert.equal(r.tour, true, "the Tour is suggested");
  assert.equal(r.ahead, true);
  const o = P.opener(r);
  assert.doesNotMatch(o, /good deal|clearly know|already know/i, "no flattery");
  assert.match(o, /estimand, identification, study design and g-computation questions correctly/);
  assert.match(o, /influence function, double robustness, TMLE and standard error questions are still ahead/);
  assert.match(P.reason(r), /where estimation begins/);
});

test("walkthrough: a TMLE novice never lands at Trust the answer", () => {
  // Knows everything except TMLE (unsure), even the standard error.
  let r = P.score(withAns(right, { tmle: U }));
  assert.equal(r.placement, "estimation");
  assert.equal(r.unit, "one-step-estimator");
  // Also unsure on double robustness.
  r = P.score(withAns(right, { dr: U, tmle: U }));
  assert.equal(r.placement, "estimation");
  // Unsure on the influence function too: back to the payoff.
  r = P.score(withAns(right, { influence: U, dr: U, tmle: U }));
  assert.equal(r.placement, "geometry", "the standard error matched, so start at the geometry");
  r = P.score(withAns(right, { influence: U, dr: U, tmle: U, se: "wrong" }));
  assert.equal(r.placement, "payoff");
});

test("mixed: influence function unsure but double robustness known -> geometry", () => {
  const r = P.score(withAns(right, { influence: U, se: "wrong" }));
  assert.equal(r.placement, "geometry");
  assert.equal(r.unit, "scores-from-scratch");
  assert.deepEqual(r.review, ["rct-adjustment"]);
  assert.ok(r.strengths.includes("estimands") && r.strengths.includes("study design"));
  assert.equal(r.tour, false);
});

test("mixed: design missed and g-computation unsure -> Design", () => {
  const r = P.score(withAns(right, { design: "wrong", gcomp: U }));
  assert.equal(r.placement, "design");
  assert.equal(r.unit, "target-trial");
});

test("g-computation missed alone starts at the payoff, whatever the estimation answers", () => {
  assert.equal(P.score(withAns(right, { gcomp: U })).placement, "payoff");
  assert.equal(P.score(withAns(right, { gcomp: "wrong" })).ahead, false);
});

test("one isolated early gap becomes a review, not a restart", () => {
  const r = P.score(withAns(right, { design: "wrong" }));
  assert.equal(r.placement, "inference");
  assert.equal(r.isolated, "design");
  assert.equal(r.gapTopic, "study design");
  assert.equal(r.review[0], "target-trial");
  assert.ok(r.review.length <= 2);
  const b = withAns(right, { identification: U });
  assert.equal(P.score(b).review[0], "causal-roadmap");
  assert.equal(P.score(b).gapTopic, "identification");
  // Two foundation gaps restart at the first one.
  assert.equal(P.score(withAns(right, { estimand: U, design: U })).placement, "beginning");
});

test("estimation-track gaps are never forgiven", () => {
  assert.equal(P.score(withAns(right, { se: U })).placement, "inference");
  assert.equal(P.score(withAns(right, { dr: U })).placement, "estimation");
  assert.equal(P.score(withAns(right, { influence: "wrong" })).placement, "geometry");
});

test("the opening line reports only what matched and never overstates", () => {
  const r = P.score(withAns(P.QUESTIONS.map(() => U), { gcomp: right[ix.gcomp] }));
  assert.equal(r.placement, "beginning");
  assert.match(P.opener(r), /^You answered the g-computation question correctly\./);
  const none = P.score(P.QUESTIONS.map((q) => wrong(q)));
  assert.match(P.opener(none), /None of these matched yet/);
  assert.match(P.opener(P.score(right)), /Every answer matched/);
});

test("the hero on the home page does not give away a quiz answer", () => {
  const fs = require("node:fs"),
    path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const hero = fs.readFileSync(path.join(__dirname, "..", "shared", "hero.js"), "utf8");
  const text = (html + hero).toLowerCase();
  assert.ok(!/first-order|first order|second-order|second order|δ²/.test(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")), "no first/second-order claim in visible hero copy");
  for (const q of P.QUESTIONS) {
    const ans = q.options[q.answer].toLowerCase();
    assert.ok(!html.toLowerCase().includes(ans), "answer text of " + q.id + " appears on the home page");
  }
});

test("answers keyed by question id score the same as arrays", () => {
  const obj = Object.fromEntries(P.QUESTIONS.map((q) => [q.id, q.answer]));
  assert.deepEqual(P.score(obj), P.score(right));
  assert.equal(P.isCorrect(P.QUESTIONS[0], "1"), true);
  assert.equal(P.isCorrect(P.QUESTIONS[0], U), false);
});

test("every question has a valid answer index and a lesson that exists", () => {
  for (const q of P.QUESTIONS) {
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, q.id);
    assert.ok(allUnits.some((u) => u.id === q.unit), q.unit);
    assert.ok(!/\u2014/.test(q.q + q.options.join("") + q.why), "no em dashes in " + q.id);
  }
  assert.ok(P.QUESTIONS.length >= 6 && P.QUESTIONS.length <= 8);
  for (const id of [...FOUNDATION, ...THEORY]) assert.ok(id in ix, id);
});

test("every recommended and review unit id exists in the curriculum and sits before or at the start", () => {
  const ids = new Set(P.QUESTIONS.map((q) => q.id));
  let prev = -1;
  for (const p of P.PLACEMENTS) {
    const i = core.indexOf(p.unit);
    assert.ok(i >= 0, p.unit + " is a core unit");
    assert.ok(i > prev, "placements follow route order");
    prev = i;
    const chapter = COURSE.chapters.find((c) => c.units[0].id === p.unit);
    assert.ok(chapter, p.unit + " opens a chapter");
    p.probes.forEach((id) => assert.ok(ids.has(id), id));
    p.review.forEach((id) => {
      assert.ok(core.includes(id), id + " exists");
      assert.ok(core.indexOf(id) < i, id + " comes before " + p.unit);
    });
  }
  // Exhaustively score every answer pattern (4^n) and check it against the rules stated plainly.
  const n = P.QUESTIONS.length;
  const seen = new Set();
  const rank = (id) => P.PLACEMENTS.findIndex((p) => p.id === id);
  for (let code = 0; code < 4 ** n; code++) {
    const a = [];
    for (let k = 0, c = code; k < n; k++, c = Math.floor(c / 4)) a.push(c % 4 === 3 ? U : c % 4);
    const ok = (id) => P.isCorrect(P.QUESTIONS[ix[id]], a[ix[id]]);
    const r = P.score(a);
    seen.add(r.placement);
    assert.ok(core.includes(r.unit));
    assert.ok(r.review.length <= 2);
    r.review.forEach((id) => assert.ok(core.indexOf(id) < core.indexOf(r.unit), "review before start"));
    // Trust the answer needs the influence function, double robustness and TMLE.
    if (r.placement === "inference") assert.ok(ok("influence") && ok("dr") && ok("tmle"));
    // Estimation needs the influence function.
    if (rank(r.placement) >= rank("estimation")) assert.ok(ok("influence"));
    // No TMLE answer: never past Estimation.
    if (!ok("tmle")) assert.ok(rank(r.placement) <= rank("estimation"));
    // No estimation-track answer: at most the payoff, and the Tour is offered.
    if (!THEORY.some(ok)) {
      assert.ok(rank(r.placement) <= rank("payoff"), "code " + code);
      assert.equal(r.tour, true);
    } else assert.equal(r.tour, false);
    // Past the payoff needs g-computation and at most one other foundation gap.
    if (rank(r.placement) > rank("payoff"))
      assert.ok(ok("gcomp") && FOUNDATION.filter((id) => !ok(id)).length <= 1);
    // Two or more foundation gaps start at the first one.
    const fMiss = FOUNDATION.filter((id) => !ok(id));
    if (fMiss.length >= 2) assert.equal(r.placement, P.PLACEMENTS.find((p) => p.probes.includes(fMiss[0])).id);
    // The opening line never flatters, and lists exactly what matched.
    const o = P.opener(r);
    assert.doesNotMatch(o, /good deal|clearly|great|excellent|expert/i);
    if (r.correct && r.correct < n && r.unsure < n) assert.ok(o.startsWith("You answered the "));
    assert.ok(!/\u2014/.test(o + P.reason(r)));
  }
  assert.equal(seen.size, P.PLACEMENTS.length, "every placement is reachable");
});

test("earlier units are the core lessons before the start, never electives", () => {
  assert.deepEqual(P.earlierUnits(COURSE.chapters, "causal-roadmap"), []);
  assert.deepEqual(P.earlierUnits(COURSE.chapters, "target-trial"), ["causal-roadmap", "intercurrent-events"]);
  const e = P.earlierUnits(COURSE.chapters, "efficiency-theory-story");
  assert.equal(e.length, core.indexOf("efficiency-theory-story"));
  assert.ok(!e.includes("interference-lab"));
  assert.deepEqual(P.earlierUnits(COURSE.chapters, "no-such-unit"), []);
});
