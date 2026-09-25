const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../science/sensitivity.js");
const S = require("../science/core.js");
const close = (a, b, tol = 1e-10) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("bias factor is symmetric, equals 1 on the axes, and never exceeds either strength", () => {
  for (const x of [1, 1.2, 2, 3.5, 6])
    for (const y of [1, 1.4, 2, 5, 9]) {
      const B = E.biasFactor(x, y);
      close(B, E.biasFactor(y, x));
      assert.ok(B <= Math.min(x, y) + 1e-12);
      assert.ok(B >= 1 - 1e-12);
    }
  close(E.biasFactor(1, 7), 1);
  close(E.biasFactor(2, 2), 4 / 3);
  assert.throws(() => E.biasFactor(0.9, 2));
  assert.throws(() => E.biasFactor(2, NaN));
});

test("E-value inverts the bias factor on the diagonal", () => {
  for (const rr of [1, 1.01, 1.26, 1.5, 2, 3.9, 10]) {
    const e = E.eValue(rr);
    close(E.biasFactor(e, e), rr, 1e-9);
    assert.ok(e >= rr);
    // Any weaker confounder on the diagonal falls short of explaining rr away.
    if (rr > 1) assert.ok(E.biasFactor(e * 0.99, e * 0.99) < rr);
  }
  close(E.eValue(1), 1);
  close(E.eValue(2), 2 + Math.SQRT2);
});

test("published worked example: RR 3.9 (1.8 to 8.7) gives E-values 7.26 and 3.0", () => {
  // VanderWeele and Ding (2017), Ann Intern Med, breastfeeding example.
  close(E.eValue(3.9), 7.26, 0.005);
  close(E.eValueCI(1.8, 8.7), 3.0, 1e-9);
});

test("a risk ratio below 1 is handled through its reciprocal", () => {
  for (const rr of [0.25, 0.5, 0.8, 0.99]) close(E.eValue(rr), E.eValue(1 / rr));
  // Protective interval: use the upper limit, the one closest to 1.
  close(E.eValueCI(0.4, 0.8), E.eValue(1 / 0.8));
  // Adjusting a protective estimate moves it up toward 1.
  const a = E.adjust(0.5, 0.4, 0.8, 1.25);
  close(a.rr, 0.625);
  close(a.hi, 1);
  assert.equal(E.explainsCI(0.4, 0.8, 1.25), true);
  assert.equal(E.explainsPoint(0.5, 1.25), false);
  assert.throws(() => E.eValue(0));
});

test("an interval that crosses 1 has E-value 1", () => {
  assert.equal(E.eValueCI(0.8, 1.3), 1);
  assert.equal(E.eValueCI(1, 2), 1);
  assert.equal(E.eValueCI(0.5, 1), 1);
  assert.equal(E.explainsCI(0.8, 1.3, 1), true);
  // Boundary: a limit exactly at 1 is explained away by B = 1.
  assert.equal(E.explainsPoint(1, 1), true);
});

test("the contour B = target passes through the E-value and is symmetric", () => {
  for (const target of [1.26, 1.5, 2.5]) {
    const e = E.eValue(target);
    close(E.contourUD(e, target), e, 1e-9);
    for (const x of [target + 0.01, target + 0.5, 6]) {
      const y = E.contourUD(x, target);
      close(E.biasFactor(x, y), target, 1e-9);
      close(E.contourUD(y, target), x, 1e-7);
    }
    assert.equal(E.contourUD(target, target), Infinity);
  }
});

test("adjusting by B divides a harmful estimate and its limits by B", () => {
  const a = E.adjust(1.5, 1.2, 1.9, 1.5);
  close(a.rr, 1);
  close(a.lo, 0.8);
  close(a.hi, 1.9 / 1.5);
  assert.equal(E.explainsPoint(1.5, 1.5), true);
  assert.equal(E.explainsPoint(1.5, 1.49), false);
});

test("the bound holds in random binary-confounder worlds (Ding and VanderWeele 2016)", () => {
  const random = S.rng(7);
  for (let i = 0; i < 4000; i++) {
    const pu = [0.05 + 0.9 * random(), 0.05 + 0.9 * random()], // P(U=1 | A=a)
      pa = 0.1 + 0.8 * random(),
      r = [
        [0.02 + 0.4 * random(), 0.02 + 0.4 * random()],
        [0.02 + 0.4 * random(), 0.02 + 0.4 * random()],
      ], // r[a][u] = P(Y=1 | A=a, U=u)
      pU = pa * pu[1] + (1 - pa) * pu[0],
      obs =
        (pu[1] * r[1][1] + (1 - pu[1]) * r[1][0]) /
        (pu[0] * r[0][1] + (1 - pu[0]) * r[0][0]),
      truth =
        (pU * r[1][1] + (1 - pU) * r[1][0]) /
        (pU * r[0][1] + (1 - pU) * r[0][0]),
      rrEU = Math.max(pu[1] / pu[0], (1 - pu[1]) / (1 - pu[0])),
      rrUD = Math.max(
        ...r.map((ru) => Math.max(...ru) / Math.min(...ru)),
      ),
      B = E.biasFactor(rrEU, rrUD);
    assert.ok(obs / truth <= B + 1e-12, `world ${i}: ${obs / truth} > ${B}`);
  }
});

test("additive kappa: the band and the kappa needed to reach zero", () => {
  const b = E.kappaBand(0.047, 0.026, 0.068, 0.01);
  close(b.point[0], 0.037);
  close(b.interval[1], 0.078);
  close(E.kappaToNull(-0.03), 0.03);
  close(E.kappaToCI(0.026, 0.068), 0.026);
  close(E.kappaToCI(-0.068, -0.026), 0.026);
  assert.equal(E.kappaToCI(-0.01, 0.02), 0);
  assert.throws(() => E.kappaBand(0, 0, 0, -1));
});

test("teaching population: standardization recovers the generator's RR and each omitted-covariate bias respects its benchmark", () => {
  close(E.populationRR(), E.DESIGN.TRUE_RR, 1e-12);
  E.COVARIATES.forEach((v, j) => {
    const b = E.benchmark(j),
      omitted = E.populationRR(15 & ~(1 << j));
    assert.ok(omitted / E.DESIGN.TRUE_RR <= b.B + 1e-12, v.label);
    close(b.rrXY, Math.max(v.rr, 1 / v.rr), 1e-12);
  });
});

test("the numbers the lesson displays", () => {
  const s = E.study(),
    f = s.full,
    r2 = (x) => Math.round(x * 100) / 100;
  assert.equal(s.n, 4000);
  assert.equal(r2(f.rr), 1.5);
  assert.equal(r2(f.rrLo), 1.26);
  assert.equal(r2(f.rrHi), 1.79);
  assert.equal(r2(s.eValue), 2.37);
  assert.equal(r2(s.eValueCI), 1.82);
  assert.equal(r2(100 * f.rd), 4.72);
  assert.equal(Math.round(1000 * f.rdLo), 26);
  assert.equal(Math.round(1000 * f.rdHi), 68);
  assert.equal(r2(s.crude.rr), 2.14);
  const sev = s.covariates.find((c) => c.key === "severity");
  assert.equal(r2(sev.B), 1.47);
  assert.equal(r2(sev.rrAX), 2.2);
  assert.equal(r2(sev.rrXY), 2.4);
  assert.equal(r2(sev.omitted.rr), 2);
  // A confounder as strong as severity explains away the interval but not the point.
  assert.equal(E.explainsCI(f.rrLo, f.rrHi, sev.B), true);
  assert.equal(E.explainsPoint(f.rr, sev.B), false);
  // Severity is the strongest benchmark; the others explain away neither.
  for (const c of s.covariates)
    if (c.key !== "severity") {
      assert.ok(c.B < sev.B);
      assert.equal(E.explainsCI(f.rrLo, f.rrHi, c.B), false);
    }
  // Standardization over the full cells equals AIPW with saturated models; check the arm risks.
  const rows = E.simulate();
  assert.ok(f.p1 > 0 && f.p0 > 0 && f.p1 < 1);
  close(
    s.crude.p1,
    rows.filter((r) => r.a).reduce((t, r) => t + r.y, 0) / s.treated,
  );
});
