const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../science/cohort.js");
const { pick, numbers, labels } = require("../figures/two-paths.js");

const N = numbers(C.cohort);
const L = labels(N);
const close = (a, b, tol = 1e-12) => Math.abs(a - b) < tol;

test("Rosa is chosen by rule: the first patient in presentation order, and she was treated", () => {
  const p = pick(C.cohort);
  assert.strictEqual(p.slot, 0);
  assert.strictEqual(C.cohort.patients.filter((q) => q.slot === 0).length, 1);
  assert.strictEqual(p.id, 24);
  assert.strictEqual(p.a, 1, "the solid (observed) path must be the treated one");
  assert.strictEqual(p.x, 1);
});

test("Rosa's displayed numbers are her potential outcomes in CausalCohort", () => {
  const p = C.cohort.patients[N.id];
  assert.ok(close(N.y1, p.y1) && close(N.y0, p.y0));
  // Consistency: what we see is the potential outcome under the treatment she got.
  assert.ok(close(N.seen, p.y) && close(N.unseen, p.a ? p.y0 : p.y1));
  assert.ok(close(N.effect, p.y1 - p.y0));
  // Her individual effect is the high-severity benefit of the teaching world.
  assert.ok(close(N.effect, C.PARAMS.benefit[p.x], 1e-9));
  assert.strictEqual(L.patient, "Patient #24");
  assert.strictEqual(L.seen, "5.04");
  assert.strictEqual(L.unseen, "2.78");
  assert.strictEqual(L.y1, p.y1.toFixed(2));
  assert.strictEqual(L.y0, p.y0.toFixed(2));
  assert.strictEqual(L.effect, "+2.26");
  // The printed effect equals the printed difference (no rounding surprise).
  assert.strictEqual((+L.seen - +L.unseen).toFixed(2), "2.26");
});

test("the cohort average gap shown at the end is the sample ATE", () => {
  const s = C.summary(C.cohort);
  assert.ok(close(N.sampleATE, s.sampleATE));
  assert.strictEqual(L.ate, "2.00");
  assert.strictEqual(N.n, 100);
  assert.strictEqual(N.nTreated, s.nTreated);
  assert.ok(close(N.naive, s.naive));
});

test("boundary: an untreated first patient would swap which path is seen", () => {
  // Rebuild a cohort where everyone is untreated (g = 0): Rosa's seen path becomes Y(0).
  const c0 = C.build({ g: [0, 0] });
  const M = numbers(c0);
  assert.strictEqual(M.a, 0);
  assert.ok(close(M.seen, M.y0) && close(M.unseen, M.y1));
  assert.strictEqual(M.nTreated, 0);
  assert.ok(Number.isNaN(M.naive));
});

test("the figure prints only computed numbers (no typed-in values in its source)", () => {
  const src = fs.readFileSync(path.join(__dirname, "../figures/two-paths.js"), "utf8");
  for (const v of ["5.04", "2.78", "2.26", "2.00"]) assert.ok(!src.includes(v), `literal ${v} in source`);
  assert.ok(!src.includes("\u2014"), "no em dashes");
});
