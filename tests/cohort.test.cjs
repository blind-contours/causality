const test = require("node:test");
const assert = require("node:assert");
const C = require("../science/cohort.js");
test("cohort is deterministic and has the documented structure", () => {
  const a = C.build(), b = C.build();
  assert.deepStrictEqual(a.patients.map((p) => p.y), b.patients.map((p) => p.y));
  const s = C.summary(C.cohort);
  assert.strictEqual(s.n, 100);
  assert.strictEqual(s.nHigh, 35);
  assert.ok(Math.abs(s.sampleATE - 2) < 1e-9, "sample ATE is exactly 0.65·1.86 + 0.35·2.26 = 2");
  assert.ok(s.naive > 2.3, "confounding by severity inflates the naive contrast");
  const slots = new Set(C.cohort.patients.map((p) => p.slot));
  assert.strictEqual(slots.size, 100);
});
test("redistribute-to-the-right reproduces Kaplan–Meier", () => {
  const rows = C.cohort.patients.filter((p) => p.a);
  const km = C.km(rows), rd = C.kmRedistribute(rows).steps.filter((s) => s.event);
  for (const s of rd) {
    const k = km.filter((q) => q.t <= s.t).pop();
    assert.ok(Math.abs(k.s - s.s) < 1e-12);
  }
  const noCens = rows.map((r) => ({ ...r, event: 1 }));
  assert.ok(Math.abs(C.kmRedistribute(noCens).steps.at(-1).s) < 1e-12, "no censoring: all mass falls");
});
