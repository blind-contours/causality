const { test } = require("node:test");
const assert = require("node:assert/strict");
const S = require("../science/core.js");
const close = (a, b, t = 1e-9) =>
  assert.ok(Math.abs(a - b) < t, `${a} != ${b}`);
test("probability paths conserve mass, scores center, finite differences match derivatives", () => {
  for (const p of [
    [0.2, 0.5, 0.3],
    [0.05, 0.8, 0.15],
    [0.7, 0.05, 0.25],
  ])
    for (const v of [
      [-1, 0, 1],
      [2, -3, 1],
    ]) {
      const h = S.score(p, v),
        d = S.geometry(p).d;
      close(S.inner(h, [1, 1, 1], p), 0);
      const bounds = S.pathBounds(p, h);
      for (const e of [bounds[0] * 0.99, 0, bounds[1] * 0.99]) {
        const q = S.path(p, h, e);
        close(S.sum(q), 1);
        assert.ok(q.every((x) => x >= 0));
      }
      const e = 1e-6;
      close(
        (S.dot(S.path(p, h, e), [-1, 0, 2]) - S.dot(p, [-1, 0, 2])) / e,
        S.inner(d, h, p),
        1e-8,
      );
    }
  assert.throws(() => S.path([0.2, 0.5, 0.3], [-5, 0, 10 / 3], 0.3));
});
test("canonical projection has the stated exact weighted geometry", () => {
  const g = S.geometry();
  close(g.mu, 0.4);
  g.canonical.forEach((x, i) => close(x, [-1.8, 0, 1.2][i]));
  close(g.fullVariance, 1.24);
  close(g.restrictedVariance, 1.08);
  close(S.inner(g.residual, g.h, g.p), 0);
  close(S.inner(g.residual, g.canonical, g.p), 0);
  close(
    g.fullVariance,
    g.restrictedVariance + S.inner(g.residual, g.residual, g.p),
  );
});
test("normalized quadrature uses one law for scores and derivatives", () => {
  const g = S.grid(),
    masses = g.p.map((x) => x * g.dx),
    h = S.centerGrid(
      g.z.map((x) => Math.sin(x)),
      g.p,
      g.dx,
    );
  close(S.sum(masses), 1);
  close(S.dot(h, masses), 0);
  const e = 0.01,
    q = S.path(masses, h, e);
  close(
    (S.dot(q, g.z) - g.mean) / e,
    S.inner(
      g.z.map((z) => z - g.mean),
      h,
      masses,
    ),
    1e-10,
  );
});
test("ATE remainder equals the exact population expansion including both arms", () => {
  const p = [0.65, 0.35],
    g0 = [0.3, 0.7],
    gh = [0.4, 0.6],
    m10 = [2, 4],
    m00 = [0, 1],
    mh1 = [1.7, 4.5],
    mh0 = [0.2, 0.6],
    psi0 = S.dot(
      p,
      m10.map((v, i) => v - m00[i]),
    ),
    psih = S.dot(
      p,
      mh1.map((v, i) => v - mh0[i]),
    );
  const PD = S.sum(
    p.map(
      (w, i) =>
        w *
        (mh1[i] -
          mh0[i] -
          psih +
          (g0[i] / gh[i]) * (m10[i] - mh1[i]) -
          ((1 - g0[i]) / (1 - gh[i])) * (m00[i] - mh0[i])),
    ),
  );
  close(psih - psi0, -PD + S.ateRemainder(g0, gh, m10, mh1, m00, mh0, p));
});
test("a Gaussian targeting score vanishes without equality to one-step in general", () => {
  const y = [1, -1, 0.5, -1],
    m = [0, 0, 0, 0],
    h = [1.25, 0, 4, 0],
    r = S.gaussianTarget(y, m, h);
  close(r.score, 0);
  const one = S.dot(h, y) / 4,
    sub = r.epsilon * S.mean([1.25, 1.25, 4, 4]);
  close(one, 0.8125);
  assert.ok(Math.abs(one - sub) > 0.3);
});
test("binary logistic targeting preserves probabilities and solves its score", () => {
  const y = [1, 1, 1, 0, 1, 0],
    m = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    h = [-2, 2, 3, -3, 1.2, -1.2],
    r = S.binaryTarget(y, m, h);
  assert.ok(r.updated.every((x) => x > 0 && x < 1));
  close(r.score, 0, 1e-8);
});
test("a locally least-favorable fit may need iteration for the updated EIF", () => {
  const first = S.landscapeTarget([-0.62, -0.28], [0.52, 0.22], 0.6, true),
    iterated = S.landscapeTarget([-0.62, -0.28], [0.52, 0.22], 0.6);
  assert.ok(Math.abs(first.score) > 0.01);
  close(iterated.score, 0, 1e-8);
  const linear = S.landscapeTarget([-0.62, -0.28], [0.52, 0.22], 0);
  close(linear.value, linear.oneStep);
});
test("histograms include point masses, extremes, and explicit overflow", () => {
  const a = [0, 0, 0, 2, 10, -9],
    h = S.histogram(a);
  assert.equal(h.total, a.length);
  assert.equal(S.sum(h.counts), a.length);
  assert.equal(S.histogram([0, 0, 0]).total, 3);
  const bounded = S.histogram(a, 5, [0, 3]);
  assert.equal(bounded.underflow, 1);
  assert.equal(bounded.overflow, 1);
  assert.equal(bounded.total, 6);
});
test("simulation is seeded and four oracle presets show the claimed consistency distinction", () => {
  const config = {
    n: 800,
    reps: 500,
    seed: 91,
    mode: "oracle",
    crossfit: false,
  };
  for (const preset of ["both", "outcome", "propensity", "neither"]) {
    const r = S.simulation({ ...config, preset });
    const b = r.summary.aipw.bias,
      se = r.summary.aipw.biasMCSE;
    if (preset === "neither") assert.ok(Math.abs(b) > 0.2);
    else assert.ok(Math.abs(b) < 5 * se, `${preset}: ${b}, MCSE ${se}`);
    if (preset === "both")
      assert.ok(Math.abs(r.summary.aipw.sd / r.summary.boundSE - 1) < 0.13);
    assert.ok(r.summary.coverage >= 0 && r.summary.coverage <= 1);
  }
  const a = S.simulation({ ...config, preset: "both", reps: 20 });
  assert.deepEqual(a, S.simulation({ ...config, preset: "both", reps: 20 }));
});
test("fitted cross-fold estimates are finite and correctly specified estimators have small bias", () => {
  const r = S.simulation({
    n: 600,
    reps: 250,
    seed: 829,
    mode: "fitted",
    crossfit: true,
    preset: "both",
  });
  assert.ok(r.results.every((x) => Number.isFinite(x.aipw) && x.se > 0));
  assert.ok(Math.abs(r.summary.aipw.bias) < 5 * r.summary.aipw.biasMCSE);
});
test("KM handles censoring ties and RMST is area under the step curve", () => {
  const r = S.km(
    [
      { time: 1, event: true },
      { time: 1, event: false },
      { time: 2, event: true },
      { time: 4, event: false },
    ],
    3,
  );
  close(r.s, 0.375);
  close(r.rmst, 1 + 0.75 + 0.375);
});
test("survival controls share reproducible data, finite values, and a causal contrast distinct from HR", () => {
  const c = { n: 2000, tau: 5, censor: 2, seed: 91 },
    a = S.survival(c),
    b = S.survival(c);
  assert.deepEqual(a.rows, b.rows);
  assert.ok(a.arms[1].trueRMST > a.arms[0].trueRMST);
  assert.equal(a.conditionalHR, 0.65);
  for (const arm of a.arms) {
    assert.ok(arm.trueRMST <= c.tau);
    assert.ok(arm.standardizedRMST <= c.tau);
    close(arm.truthS(0), 1);
    assert.ok(arm.truthS(5) < arm.truthS(1));
  }
});
test("Gaussian mixture tilts use the whole distribution at large shifts", () => {
  const c = [
    { weight: 0.55, mean: -0.4, sd: 0.7 },
    { weight: 0.45, mean: 1.6, sd: 0.8 },
  ];
  close(S.mixtureTilt(c, 0).mean, 0.5);
  for (const e of [-3, 0, 3, 8]) {
    const t = S.mixtureTilt(c, e),
      eps = 1e-5;
    close(
      (S.mixtureTilt(c, e + eps).logNorm - S.mixtureTilt(c, e - eps).logNorm) /
        (2 * eps),
      t.mean,
      1e-7,
    );
    close(S.sum(t.weights), 1);
  }
});

test("adjustment stays computable when exchangeability is removed; only identification fails", () => {
  const S = require("../science/core.js");
  const both = S.identification({
    target: "ate",
    gHigh: 0.6,
    exchange: true,
    consistent: true,
  });
  assert.deepEqual(both, { computable: true, identified: true });
  const noEx = S.identification({
    target: "ate",
    gHigh: 0.6,
    exchange: false,
    consistent: true,
  });
  assert.deepEqual(noEx, { computable: true, identified: false });
  const noSupport = S.identification({
    target: "ate",
    gHigh: 0,
    exchange: true,
    consistent: true,
  });
  assert.deepEqual(noSupport, { computable: false, identified: false });
  assert.equal(
    S.identification({
      target: "att",
      gHigh: 0,
      exchange: true,
      consistent: true,
    }).computable,
    true,
  );
});

test("intermediate projection frames satisfy kept + lost = total − 2t(1−t)‖D−D*‖²", () => {
  const S = require("../science/core.js");
  const g = S.geometry([0.2, 0.5, 0.3]);
  for (const t of [0, 0.25, 0.5, 0.8, 1]) {
    const r = S.projectionSplit(g.d, g.canonical, t, g.p);
    assert.ok(
      Math.abs(r.kept + r.lost + r.cross - r.total) < 1e-12,
      "identity at t=" + t,
    );
    assert.ok(r.kept + r.lost <= r.total + 1e-12, "never exceeds the total");
  }
  assert.ok(
    Math.abs(S.projectionSplit(g.d, g.canonical, 0.5, g.p).cross) > 1e-6,
    "cross term is real mid-way",
  );
});

test("product boundary is a hyperbola: a point can sit above a c/√n band yet inside the product region", () => {
  const S = require("../science/core.js");
  const n = 100000,
    band = 2.5 / Math.sqrt(n),
    err = n ** -0.25 * 0.5 * 100 ** 0.25; // the figure's path: 0.5 at n = 100
  assert.equal(S.productInside(err, err, band), true);
  assert.equal(err > band, true, "each error alone exceeds the band height");
  assert.equal(S.productInside(0.2, 0.2, band), false);
});

test("a nonvanishing error-product bound does not force a nonzero remainder: signed cancellation", () => {
  const S = require("../science/core.js");
  for (const n of [100, 10000, 1000000]) {
    const d = 0.5 * n ** -0.25,
      g0 = [0.5, 0.5],
      gh = [0.5 + d, 0.5 + d],
      m10 = [1, 1],
      mh1 = [1 + d, 1 - d],
      m00 = [0, 0],
      mh0 = [0, 0],
      p = [0.5, 0.5];
    const r = S.ateRemainder(g0, gh, m10, mh1, m00, mh0, p);
    assert.ok(Math.abs(r) < 1e-12, "exact remainder cancels at n=" + n);
    assert.ok(
      Math.abs(Math.sqrt(n) * d * d - 0.25) < 1e-9,
      "while √n × product stays 0.25",
    );
  }
});

test("own-fold predictions come from the fit on that fold, not the full-sample fit", () => {
  const S = require("../science/core.js");
  const rows = S.toyCurve(16, S.rng(872)),
    A = rows.filter((_, i) => i % 2 === 0),
    B = rows.filter((_, i) => i % 2 === 1),
    fitA = S.linearFit(A),
    fitAll = S.linearFit(rows),
    x = A[0].x;
  assert.notEqual(
    fitA.a + fitA.b * x,
    fitAll.a + fitAll.b * x,
    "the two model identities differ",
  );
});
