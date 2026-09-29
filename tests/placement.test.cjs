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

test("all correct starts at Trust the answer", () => {
  const r = P.score(right);
  assert.equal(r.placement, "inference");
  assert.equal(r.unit, "efficiency-theory-story");
  assert.equal(r.correct, P.QUESTIONS.length);
  assert.equal(r.unsure, 0);
  assert.equal(r.isolated, null);
  assert.ok(r.review.length >= 1 && r.review.length <= 2);
});

test("all unsure starts at the beginning, with nothing to review", () => {
  const r = P.score(P.QUESTIONS.map(() => U));
  assert.equal(r.placement, "beginning");
  assert.equal(r.unit, "causal-roadmap");
  assert.equal(r.correct, 0);
  assert.equal(r.unsure, P.QUESTIONS.length);
  assert.deepEqual(r.review, []);
  assert.deepEqual(r.strengths, []);
});

test("empty or missing answers behave like unsure", () => {
  assert.equal(P.score([]).placement, "beginning");
  assert.equal(P.score(undefined).placement, "beginning");
  assert.equal(P.score({}).unsure, P.QUESTIONS.length);
});

test("mixed: foundations right, influence functions unsure, later mixed -> geometry", () => {
  const a = right.slice();
  a[4] = U; // influence
  a[6] = wrong(P.QUESTIONS[6]); // standard error
  const r = P.score(a);
  assert.equal(r.placement, "geometry");
  assert.equal(r.unit, "scores-from-scratch");
  assert.deepEqual(r.review, ["rct-adjustment"]);
  assert.ok(r.strengths.includes("estimands") && r.strengths.includes("study design"));
});

test("mixed: design missed and g-computation unsure -> Design", () => {
  const a = right.slice();
  a[2] = wrong(P.QUESTIONS[2]);
  a[3] = U;
  const r = P.score(a);
  assert.equal(r.placement, "design");
  assert.equal(r.unit, "target-trial");
});

test("each single early miss followed by later misses starts at that miss", () => {
  // Miss question i and the last question: two gaps, so the first gap is the start.
  const order = ["beginning", "beginning", "design", "payoff", "geometry", "estimation"];
  order.forEach((place, i) => {
    const a = right.slice();
    a[i] = U;
    a[6] = U;
    assert.equal(P.score(a).placement, place, "question " + i);
  });
});

test("one isolated early gap becomes a review, not a restart", () => {
  const a = right.slice();
  a[2] = wrong(P.QUESTIONS[2]); // only immortal time missed
  const r = P.score(a);
  assert.equal(r.placement, "inference");
  assert.equal(r.isolated, "design");
  assert.equal(r.gapTopic, "study design");
  assert.equal(r.review[0], "target-trial");
  assert.ok(r.review.length <= 2);
  // Identification missed alone: review the roadmap lesson, still start late.
  const b = right.slice();
  b[1] = U;
  assert.equal(P.score(b).review[0], "causal-roadmap");
  assert.equal(P.score(b).gapTopic, "identification");
});

test("a late single gap is not forgiven: the start is that gap", () => {
  const a = right.slice();
  a[5] = U; // one-step, only the last step after it
  assert.equal(P.score(a).placement, "estimation");
  const b = right.slice();
  b[6] = U;
  assert.equal(P.score(b).placement, "inference");
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
  assert.ok(P.QUESTIONS.length >= 6 && P.QUESTIONS.length <= 7);
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
  // Exhaustively score every answer pattern (4^7) and check what it recommends.
  const n = P.QUESTIONS.length;
  const seen = new Set();
  for (let code = 0; code < 4 ** n; code++) {
    const a = [];
    for (let k = 0, c = code; k < n; k++, c = Math.floor(c / 4)) a.push(c % 4 === 3 ? U : c % 4);
    const r = P.score(a);
    seen.add(r.placement);
    assert.ok(core.includes(r.unit));
    assert.ok(r.review.length <= 2);
    r.review.forEach((id) => assert.ok(core.indexOf(id) < core.indexOf(r.unit), "review before start"));
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
