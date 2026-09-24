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
