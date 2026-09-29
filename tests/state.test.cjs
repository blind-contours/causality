const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../shared/state.js");
test("legacy completion migrates to explored, without claiming demonstrated understanding", () => {
  const s = S.migrate({ old: "2026-01-01" });
  assert.equal(s.units.old.status, "explored");
  assert.equal(s.units.old.legacy, true);
});
test("exploration cannot complete a lesson and reset is stable", () => {
  let s = S.migrate();
  s = S.reduce(s, { type: "explore", unit: "a" });
  assert.equal(s.units.a.status, "explored");
  s = S.reduce(s, { type: "reset-unit", unit: "a" });
  assert.equal(s.units.a, undefined);
});
test("wrong answer, assistance, new variant, correct answer, and retrieval transitions", () => {
  let s = S.migrate();
  const event = {
    type: "exercise",
    unit: "a",
    id: "transfer",
    variant: 0,
    transfer: true,
    now: "2026-09-19T00:00:00Z",
  };
  s = S.reduce(s, { ...event, correct: false });
  assert.equal(s.units.a.status, "attempted");
  s = S.reduce(s, { ...event, assisted: true });
  s = S.reduce(s, { ...event, correct: true });
  assert.equal(s.units.a.status, "assisted");
  s = S.reduce(s, { ...event, variant: 1, correct: true });
  assert.equal(s.units.a.status, "demonstrated");
  assert.equal(s.units.a.reviewAt, "2026-09-22T00:00:00.000Z");
});
test("immutable state updates preserve unrelated data and settings", () => {
  const s = S.migrate();
  const next = S.reduce(s, { type: "contract", value: { target: "att" } });
  assert.equal(s.contract.target, "ate");
  assert.equal(next.contract.target, "att");
  assert.equal(next.contract.population, 0.35);
});
test("older saved contracts gain a measure without losing their target or progress", () => {
  const old = S.migrate();
  delete old.contract.measure;
  old.contract.target = "att";
  const loaded = S.load({ getItem: () => JSON.stringify(old) });
  assert.equal(loaded.contract.measure, "mean");
  assert.equal(loaded.contract.target, "att");
  assert.deepEqual(loaded.units, old.units);
});
test("saved questions distinguish untreated populations, risk ratios, and survival time", () => {
  let state = S.reduce(S.migrate(), { type: "contract", value: { target: "atc", measure: "rr", scenario: { riskLow: .02 } } });
  assert.match(S.describeContract(state.contract), /actually received control/);
  assert.match(S.describeContract(state.contract), /risk ratio/);
  state = S.reduce(state, { type: "contract", value: { measure: "rmst", horizon: 7 } });
  assert.match(S.describeContract(state.contract), /time alive within 7 years/);
  assert.equal(state.contract.scenario.riskLow, .02);
});
const T = { type: "exercise", unit: "a", id: "transfer", transfer: true, now: "2026-09-19T00:00:00Z" };
test("a demonstrated transfer check is never downgraded by a later solution, hint or new case", () => {
  let s = S.migrate();
  s = S.reduce(s, { ...T, variant: 0, correct: true });
  assert.equal(s.units.a.status, "demonstrated");
  s = S.reduce(s, { ...T, variant: 0, correct: false, assisted: true }); // Worked solution
  assert.equal(s.units.a.status, "demonstrated");
  s = S.reduce(s, { ...T, variant: 1, correct: false, fresh: true }); // New case
  assert.equal(s.units.a.status, "demonstrated");
  s = S.reduce(s, { ...T, variant: 1, correct: false }); // a wrong answer on practice
  assert.equal(s.units.a.status, "demonstrated");
  assert.equal(s.units.a.reviewAt, "2026-09-22T00:00:00.000Z");
  s = S.reduce(s, { type: "reset-unit", unit: "a" });
  assert.equal(s.units.a, undefined, "only an explicit reset clears it");
});
test("revealing the solution before a correct answer makes that case assisted; a fresh case can still pass", () => {
  let s = S.migrate();
  s = S.reduce(s, { ...T, variant: 0, correct: false, assisted: true });
  assert.equal(s.units.a.status, "assisted");
  s = S.reduce(s, { ...T, variant: 0, correct: true });
  assert.equal(s.units.a.status, "assisted");
  assert.equal(s.units.a.exercises.transfer.assisted, true);
  s = S.reduce(s, { ...T, variant: 1, correct: false, fresh: true });
  assert.equal(s.units.a.status, "attempted");
  assert.equal(s.units.a.exercises.transfer.assisted, false);
  assert.equal(s.units.a.exercises.transfer.attempts, 2, "a new case is not an attempt");
  s = S.reduce(s, { ...T, variant: 1, correct: true });
  assert.equal(s.units.a.status, "demonstrated");
});
test("a new case on an untouched lesson does not record an attempt", () => {
  const s = S.reduce(S.migrate(), { ...T, variant: 1, correct: false, fresh: true });
  assert.equal(s.units.a.status, "explored");
});
test("non-transfer exercises (four-patients tables) record assistance without touching status", () => {
  let s = S.migrate();
  s = S.reduce(s, { type: "exercise", unit: "fp", id: "table-1", variant: 0, correct: false, assisted: true });
  s = S.reduce(s, { type: "exercise", unit: "fp", id: "table-1", variant: 0, correct: true });
  assert.equal(s.units.fp.exercises["table-1"].assisted, true);
  assert.notEqual(s.units.fp.status, "demonstrated");
});
test("skimmed lessons are explored but not visited: no timestamp, not counted as walked", () => {
  let s = S.migrate();
  s = S.reduce(s, { type: "explore", unit: "a", skim: true });
  assert.equal(s.units.a.status, "explored");
  assert.equal(s.units.a.skimmed, true);
  assert.equal(s.units.a.updated, undefined, "a skim never becomes Last opened");
  assert.equal(S.opened(s.units.a), false);
  s = S.reduce(s, { type: "explore", unit: "b", now: "2026-09-20T00:00:00Z" });
  s = S.reduce(s, { ...T, unit: "c", variant: 0, correct: true });
  s = S.reduce(s, { ...T, unit: "d", variant: 0, correct: true });
  assert.deepEqual(S.counts(s.units, ["a", "b", "c", "d", "e"]), { walked: 3, passed: 2, total: 5 });
  // Opening a skimmed lesson for real makes it a visit.
  s = S.reduce(s, { type: "explore", unit: "a", now: "2026-09-21T00:00:00Z" });
  assert.equal(S.opened(s.units.a), true);
  assert.equal(s.units.a.updated, "2026-09-21T00:00:00Z");
  // A skim never downgrades a lesson already opened or passed.
  s = S.reduce(s, { type: "explore", unit: "c", skim: true });
  assert.equal(s.units.c.status, "demonstrated");
  assert.equal(S.opened(s.units.c), true);
});
