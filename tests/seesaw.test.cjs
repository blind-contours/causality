const test = require("node:test");
const assert = require("node:assert");
const C = require("../science/cohort.js");
const M = require("../figures/seesaw.js");

const close = (a, b, tol = 1e-12, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} ${a} vs ${b}`);
const ys = C.cohort.patients.map((p) => p.y);
const S = M.cohortSummary(C);

test("the displayed cohort numbers", () => {
  close(S.psi, M.mean(ys), 0, "psi");
  close(S.psi, 3.8995278925654593, 1e-12, "cohort mean of Y");
  assert.strictEqual(S.nTreated, 58);
  close(S.W, 145.7142857142857, 1e-9, "total weight 1/g in the treated arm");
  close(S.psiW, 4.656237252141767, 1e-9, "weighted (Hajek IPW) treated mean");
  close(S.naive, 4.988071300068823, 1e-9, "unweighted treated mean");
  close(S.truth, 4.72072789256546, 1e-9, "mean of Y(1) over all 100");
  assert.ok(Math.abs(S.psiW - S.truth) < Math.abs(S.naive - S.truth), "weighting moves the balance toward the truth");
});

test("one extra patient with epsilon = 1/101 is exactly the mean of 101 patients", () => {
  const eps = M.epsCount(1, 100);
  close(eps, 1 / 101, 0);
  for (const z of [-2, -0.3, 0, S.psi, 3.2, 7.5, 10, ...ys.slice(0, 20)]) {
    close(M.contaminate(S.psi, eps, z), M.mean([...ys, z]), 1e-12, "z=" + z);
  }
  // m copies of the new patient: epsilon = m/(100+m)
  for (const m of [2, 7, 60]) {
    const z = 8.25;
    close(M.contaminate(S.psi, M.epsCount(m), z), M.mean([...ys, ...Array(m).fill(z)]), 1e-12, "m=" + m);
  }
});

test("shift per unit mass is the influence function z - psi (slope 1 through (psi, 0))", () => {
  for (const eps of [1 / 101, 0.05, 0.3, 0.9]) {
    for (const z of [-2, 0, 2.5, 7.5, 10]) close(M.perMass(S.psi, eps, z), z - S.psi, 1e-12);
  }
  const f = (z) => M.perMass(S.psi, 1 / 101, z);
  close(f(8) - f(7), 1, 1e-12, "slope");
  close(f(S.psi), 0, 1e-12, "zero at psi");
});

test("weights mode: the weighted balance point and a heavy patient far out", () => {
  const tr = C.cohort.patients.filter((p) => p.a);
  const ty = tr.map((p) => p.y),
    tw = tr.map((p) => 1 / p.g);
  for (const g of [0.02, 0.3, 0.9]) {
    const w = 1 / g,
      z = 9.5;
    const eps = M.epsWeight(w, S.W);
    close(M.contaminate(S.psiW, eps, z), M.wmean([...ty, z], [...tw, w]), 1e-12, "g=" + g);
    close(M.perMass(S.psiW, eps, z), z - S.psiW, 1e-12);
  }
  const heavy = M.epsWeight(1 / 0.02, S.W);
  close(heavy, 50 / 195.7142857142857, 1e-12);
  assert.ok(heavy > 0.25, "a patient with g = 0.02 carries over a quarter of the arm's weight");
  assert.ok(M.contaminate(S.psiW, heavy, 10) - S.psiW > 1.3, "and moves the weighted mean by more than 1.3");
});

test("torque, tilt and boundary cases", () => {
  close(M.torque(1 / 101, S.psi, S.psi), 0, 0, "no torque at the balance point");
  assert.strictEqual(M.tiltAngle(0, M.TAU_REF, 10), 0);
  assert.strictEqual(M.tiltAngle(M.TAU_REF / 2, M.TAU_REF, 10), 5, "proportional below the cap");
  assert.strictEqual(M.tiltAngle(100, M.TAU_REF, 10), 10, "capped");
  assert.strictEqual(M.tiltAngle(-100, M.TAU_REF, 10), -10, "capped on the other side");
  assert.ok(M.torque(1 / 101, 8, S.psi) > 0 && M.torque(1 / 101, 0, S.psi) < 0, "sign follows the side");
  close(M.tiltLimit(34, 34), 90, 1e-12, "height equal to arm");
  close(Math.sin((M.tiltLimit(340, 34) * Math.PI) / 180) * 340, 34, 1e-9, "beam end touches the ground");
  assert.strictEqual(M.epsWeight(0, S.W), 0, "a weightless patient changes nothing");
  close(M.contaminate(S.psi, 0, 7), S.psi, 0);
  close(M.contaminate(S.psi, 1, 7), 7, 1e-15, "all the mass at z");
});

test("stacked dots rest on the beam without overlapping", () => {
  const xs = ys.map((y) => 44 + y * 40);
  const r = ys.map(() => 3);
  const L = M.stack(xs, r, 0, 6.6);
  for (let i = 0; i < L.length; i++) {
    assert.ok(L[i].y + L[i].r <= 1e-9, "above the beam");
    for (let j = 0; j < i; j++) {
      if (L[i].x !== L[j].x) continue;
      assert.ok(Math.abs(L[i].y - L[j].y) >= 6 - 1e-9, "no overlap in a column");
    }
  }
});
