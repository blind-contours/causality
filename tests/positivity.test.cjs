const { test } = require("node:test");
const assert = require("node:assert/strict");
const P = require("../science/positivity.js");
const close = (a, b, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b} (tol ${tol})`);

test("normal CDF matches numerical integration of the density", () => {
  for (const x of [-3, -1.2, 0, 0.5, 2.7])
    close(P.Phi(x), P.integrate(P.phi, -12, x, 8000), 2e-7);
  close(P.integrate(P.phi), 1, 1e-10);
});

test("the ATE is exactly 2 and every target is an average of tau(x) = 2 + x", () => {
  close(P.integrate((x) => P.tau(x) * P.phi(x)), P.ATE, 1e-10);
  close(P.m(1, 0.3) - P.m(0, 0.3), P.tau(0.3), 1e-12);
  for (const beta of [0.5, 2, 4]) {
    const t = P.trimmedTarget(beta, 0.1),
      direct =
        P.integrate((x) => P.tau(x) * P.phi(x), t.lo, t.hi) /
        P.integrate(P.phi, t.lo, t.hi);
    close(t.value, direct, 1e-6);
    close(t.share, P.integrate(P.phi, t.lo, t.hi), 3e-7);
    // Trimmed interval is exactly where 0.1 <= g <= 0.9.
    close(P.g(t.lo, beta), 0.1, 1e-12);
    close(P.g(t.hi, beta), 0.9, 1e-12);
  }
});

test("boundary: with no separation, trimming keeps everyone and ATO = ATE", () => {
  const t = P.trimmedTarget(0, 0.1);
  assert.equal(t.share, 1);
  close(t.value, 2, 1e-7);
  close(P.atoTarget(0).value, 2, 1e-9);
  const r = P.analyze(P.sample(0));
  // g-hat is nearly constant, so every weight is close to n / n_arm and ESS is nearly n_arm.
  assert.ok(r.ess1 > 0.999 * r.n1 && r.ess0 > 0.999 * r.n0);
  // Trimming at a = 0 keeps everyone and reproduces AIPW.
  const none = P.analyze(P.sample(2), { trim: 0 });
  assert.equal(none.kept, P.N);
  close(none.trimmedAIPW, none.aipw, 1e-12);
});

test("targets move toward the 50/50 severity 0.5 as separation grows", () => {
  let prev = 2;
  for (const beta of [0.5, 1, 2, 3, 4]) {
    const ato = P.atoTarget(beta).value;
    assert.ok(ato > prev && ato < 2.5, `ATO ${ato} at beta ${beta}`);
    prev = ato;
  }
  // Values the lesson displays at beta = 3.
  close(P.atoTarget(3).value, 2.378, 5e-4);
  close(P.trimmedTarget(3, 0.1).value, 2.417, 5e-4);
  close(P.trimmedTarget(3, 0.1).share, 0.483, 5e-4);
});

test("Kish effective sample size: equal weights give n, one dominant weight gives about 1", () => {
  close(P.kish([3, 3, 3, 3]), 4, 1e-12);
  close(P.kish([1, 1, 1, 1, 1e6]), 1, 1e-5);
  close(P.kish([1, 2]), 9 / 5, 1e-12);
});

test("fitted logistic score equations hold, so overlap weights balance X exactly", () => {
  const rows = P.sample(3),
    r = P.analyze(rows),
    [b0, b1] = r.coef;
  let s0 = 0,
    s1 = 0;
  for (const v of rows) {
    const p = P.expit(b0 + b1 * v.x);
    s0 += v.a - p;
    s1 += (v.a - p) * v.x;
  }
  close(s0, 0, 1e-3);
  close(s1, 0, 1e-3);
  // Li, Morgan & Zaslavsky: overlap-weighted means of X agree across arms.
  const ow = rows.map((v, i) => (v.a ? 1 - r.gh[i] : r.gh[i])),
    wm = (k) =>
      rows.reduce((s, v, i) => s + (v.a === k ? ow[i] * v.x : 0), 0) /
      rows.reduce((s, v, i) => s + (v.a === k ? ow[i] : 0), 0);
  close(wm(1), wm(0), 1e-4);
});

test("single-sample numbers shown in the lesson (seed 20260925, n = 500)", () => {
  const r = P.analyze(P.sample(4), { cap: 0.99, trim: 0.1 });
  assert.equal(r.n1, 163);
  close(r.ess1, 47.4, 0.05);
  const r3 = P.analyze(P.sample(3));
  close(r3.ess1, 52.4, 0.05);
  assert.equal(r3.n1, 171);
});

test("capping keeps weights at or below the cap and never changes an unweighted cap of 1", () => {
  const rows = P.sample(3),
    r = P.analyze(rows, { cap: 0.95 });
  assert.ok(r.nCapped > 0 && r.nCapped <= Math.ceil(0.05 * rows.length) + 1);
  close(P.analyze(rows, { cap: 1 }).capped, r.ipw, 1e-12);
});

test("structural variant: nobody above the cut is treated", () => {
  const rows = P.sample(2, 2000, 5, { structural: true, cut: 1.5 });
  assert.ok(rows.some((v) => v.x > 1.5));
  assert.ok(rows.every((v) => !(v.x > 1.5 && v.a === 1)));
});

test("embedded repeated-sample grid equals a fresh recomputation", () => {
  assert.deepEqual(P.GRID, P.buildGrid());
  const s = P.GRID.sweep;
  // IPW spread grows with separation far faster than AIPW's.
  assert.ok(s.at(-1).ipw.sd > 5 * s[0].ipw.sd);
  assert.ok(s.at(-1).aipw.sd < s.at(-1).ipw.sd);
  // Capping at the 99th percentile trades variance for bias.
  const b3 = s.find((v) => v.beta === 3);
  assert.ok(b3.capped.sd < b3.ipw.sd && b3.capped.bias > 3 * b3.capped.mcse);
  // A structural violation does not shrink with n; a practical one does.
  const sup = (n, st) =>
    P.GRID.support.find((v) => v.n === n && v.structural === st);
  assert.ok(sup(5000, true).ipw.bias > 0.4);
  assert.ok(Math.abs(sup(5000, false).ipw.bias) < 3 * sup(5000, false).ipw.mcse);
});
