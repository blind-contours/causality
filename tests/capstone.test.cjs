/* Capstone "An emulated trial, end to end": the Super Learner, the influence-function SE,
 * the E-value, the precomputed fits, and the numbers and prediction answers the lesson displays. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const C = require("../science/capstone.js");
const D = require("../science/capstone-data.json");
const S = require("../science/sensitivity.js");
const rows = C.simulate(C.N, C.SEED),
  preds = C.predsFromData(D),
  est = C.estimate(rows, preds),
  mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

test("world: the simulated registry and the precomputed file describe the same patients", () => {
  assert.equal(rows.length, C.N);
  assert.equal(D.n, C.N);
  assert.equal(D.seed, C.SEED);
  assert.equal(D.preds.length, C.N);
  assert.deepEqual(C.simulate(C.N, C.SEED), rows, "seeded");
  for (const p of preds) {
    assert.ok(p.m1 > 0 && p.m1 < 1 && p.m0 > 0 && p.m0 < 1 && p.g > 0 && p.g < 1);
    assert.ok(p.r1 >= 0 && p.r1 <= C.TAU && p.r0 >= 0 && p.r0 <= C.TAU);
  }
  // P(T ≤ 12) = p exactly and E[min(T, 12)] = p/h for the exponential time.
  const x = rows[0],
    p = C.TRUE.p(1, x),
    h = -Math.log(1 - p) / 12;
  assert.ok(Math.abs(1 - Math.exp(-12 * h) - p) < 1e-12);
  assert.ok(Math.abs(C.TRUE.rmst(1, x) - (1 - Math.exp(-12 * h)) / h) < 1e-12);
});

test("truth: a smaller Monte Carlo agrees with the stored one-million-patient truth", () => {
  const t = C.truth(100000, 4242);
  assert.ok(Math.abs(t.rd - D.truth.rd) < 0.002, `${t.rd} vs ${D.truth.rd}`);
  assert.ok(Math.abs(t.drmst - D.truth.drmst) < 0.02);
  assert.ok(D.truth.rd < 0 && D.truth.drmst > 0);
});

test("simplex least squares: exact, nonnegative, sums to 1, and handles its corners", () => {
  // Boundary: one column equals y, so all weight goes there and the risk is 0.
  const y = [0, 1, 1, 0, 1],
    P = y.map((v, i) => [v, 0.5, (i % 2) * 0.8]);
  const a = C.simplexLS(P, y);
  assert.ok(Math.abs(a.w[0] - 1) < 1e-9 && a.risk < 1e-12);
  // Two columns with errors of opposite sign: the mix beats both.
  const P2 = y.map((v) => [v + 0.3, v - 0.3]),
    b = C.simplexLS(P2, y);
  assert.ok(Math.abs(b.w[0] - 0.5) < 1e-9 && b.risk < 1e-12);
  // A brute-force grid never beats the exact solution.
  const P3 = y.map((v, i) => [0.2 + 0.5 * v, 0.6, (i * 0.37) % 1]),
    c = C.simplexLS(P3, y),
    risk = (w) => mean(y.map((v, i) => (v - w.reduce((s, wj, j) => s + wj * P3[i][j], 0)) ** 2));
  for (let i = 0; i <= 50; i++)
    for (let j = 0; i + j <= 50; j++) assert.ok(risk([i / 50, j / 50, 1 - (i + j) / 50]) >= c.risk - 1e-12);
});

test("Super Learner weights: nonnegative, sum to 1, CV risk no worse than the best learner", () => {
  for (const target of ["y", "g", "rmst"]) {
    const s = D.sl[target];
    assert.ok(s.weights.every((w) => w >= 0), target);
    assert.ok(Math.abs(s.weights.reduce((a, b) => a + b) - 1) < 1e-5, target);
    assert.ok(s.risk <= Math.min(...s.cvRisk) + 1e-9, `${target}: ensemble ${s.risk} vs best ${Math.min(...s.cvRisk)}`);
    assert.ok(s.risk < s.baseRisk, `${target}: beats predicting the mean`);
  }
  for (const f of D.perFold)
    for (const k of ["y", "g", "rmst"]) {
      assert.ok(f[k].every((w) => w >= 0));
      assert.ok(Math.abs(f[k].reduce((a, b) => a + b) - 1) < 1e-3);
    }
  // The library toggle re-solves on stored CV predictions: all four reproduce the stored weights;
  // any single learner gets weight 1 and its own CV risk.
  const y = rows.map((r) => r.y),
    all = C.reweigh(D.cvY, y, [0, 1, 2, 3]);
  all.weights.forEach((w, j) => assert.ok(Math.abs(w - D.sl.y.weights[j]) < 2e-3));
  for (let j = 0; j < 4; j++) {
    const one = C.reweigh(D.cvY, y, [j]);
    assert.equal(one.weights[j], 1);
    assert.ok(Math.abs(one.risk - D.sl.y.cvRisk[j]) < 1e-4);
    assert.ok(all.risk <= one.risk + 1e-12);
  }
});

test("precompute reproduces: whole-sample Super Learner and the first cross-fitting fold", () => {
  const s = C.superLearner(rows, "y");
  s.cvRisk.forEach((v, j) => assert.ok(Math.abs(v - D.sl.y.cvRisk[j]) < 1e-6));
  s.weights.forEach((v, j) => assert.ok(Math.abs(v - D.sl.y.weights[j]) < 1e-5));
  // Fold 0 of crossfit(): same fold split and inner seed as science/capstone.js.
  const seed = C.SEED + 2,
    fold = C.folds(rows.length, C.V, seed),
    train = rows.filter((_, i) => fold[i] !== 0),
    sy = C.superLearner(train, "y", { seed: seed + 10 });
  sy.weights.forEach((w, j) => assert.ok(Math.abs(w - D.perFold[0].y[j]) < 1e-3));
  rows.forEach((r, i) => {
    if (fold[i] !== 0) return;
    const m1 = Math.min(0.995, Math.max(0.005, sy.predict(r, 1)));
    assert.ok(Math.abs(m1 - preds[i].m1) < 2e-6, `patient ${i}`);
  });
});

test("AIPW: influence-function SE, arm identities, and a boundary bound", () => {
  const A = est.aipw,
    n = rows.length;
  assert.ok(Math.abs(mean(A.D)) < 1e-12, "IF values centred at the estimate");
  assert.ok(Math.abs(A.se - Math.sqrt(mean(A.D.map((d) => d * d)) / n)) < 1e-15);
  assert.ok(Math.abs(A.rd - (A.risk1 - A.risk0)) < 1e-15);
  assert.ok(Math.abs(A.ci[1] - A.ci[0] - 2 * 1.96 * A.se) < 1e-12);
  // Direct formula.
  const g = preds.map((p) => Math.min(1 - C.BOUND, Math.max(C.BOUND, p.g))),
    direct = mean(rows.map((r, i) => preds[i].m1 - preds[i].m0 + (r.a / g[i]) * (r.y - preds[i].m1) - ((1 - r.a) / (1 - g[i])) * (r.y - preds[i].m0)));
  assert.ok(Math.abs(direct - A.rd) < 1e-12);
  // Boundary: bound 0.5 forces g = 1/2 for everyone.
  const half = C.estimate(rows, preds, { bound: 0.5 }).aipw.rd,
    byHand = mean(rows.map((r, i) => preds[i].m1 - preds[i].m0 + 2 * r.a * (r.y - preds[i].m1) - 2 * (1 - r.a) * (r.y - preds[i].m0)));
  assert.ok(Math.abs(half - byHand) < 1e-12);
  // RR interval from the log-scale delta method.
  assert.ok(Math.abs(Math.log(A.rrCI[1] / A.rrCI[0]) - 2 * 1.96 * A.seLogRR) < 1e-12);
});

test("TMLE solves both arm score equations and lands next to AIPW", () => {
  const T = est.tmle;
  assert.ok(Math.abs(T.score[0]) < 1e-10 && Math.abs(T.score[1]) < 1e-10);
  assert.ok(Math.abs(T.rd - est.aipw.rd) < 0.1 * est.aipw.se);
  assert.ok(Math.abs(T.se - est.aipw.se) < 0.05 * est.aipw.se);
});

test("E-value: formula, inversion, the null and agreement with the sensitivity lesson", () => {
  assert.equal(C.eValue(1), 1);
  assert.ok(Math.abs(C.eValue(2) - (2 + Math.sqrt(2))) < 1e-12);
  assert.ok(Math.abs(C.eValue(0.5) - C.eValue(2)) < 1e-12);
  assert.equal(C.eValueCI(0.8, 1.2), 1);
  assert.ok(Math.abs(C.eValueCI(0.6, 0.9) - C.eValue(0.9)) < 1e-12);
  assert.ok(Math.abs(C.eValueCI(1.3, 2) - C.eValue(1.3)) < 1e-12);
  for (const rr of [1.2, 1.5, 3]) assert.ok(Math.abs(C.eValue(rr) - S.eValue(rr)) < 1e-12);
  // The E-value sits on the curve: a confounder of strength (E, E) has bias factor RR*.
  const rs = 1 / est.aipw.rr,
    E = C.eValue(est.aipw.rr);
  assert.ok(Math.abs(C.biasFactor(E, E) - rs) < 1e-12);
});

test("displayed numbers and the answers to the lesson's predictions", () => {
  const U = est.unadjusted,
    A = est.aipw,
    P = est.positivity,
    b = C.benchmark(rows);
  // Step 1: some crossovers exist.
  assert.ok(est.crossovers > 50 && est.crossovers < 150);
  // Step 3: the device arm loses the larger share to unequal weights; the pre-specified bound does not bind.
  assert.ok(P.ess1 / est.n1 < P.ess0 / est.n0);
  assert.equal(P.outside, 0);
  assert.ok(P.ess1 > est.n1 / 2 && P.ess0 > est.n0 / 2, "trigger not met");
  // Step 4: the ensemble mixes learners.
  assert.ok(D.sl.y.weights.filter((w) => w > 0.05).length >= 2);
  // Step 5: confounding reverses the sign; AIPW and TMLE intervals cover the truth.
  assert.ok(U.rd > 0 && A.rd < 0 && A.ci[1] < 0);
  assert.ok(A.ci[0] < D.truth.rd && D.truth.rd < A.ci[1]);
  assert.ok(est.tmle.ci[0] < D.truth.rd && D.truth.rd < est.tmle.ci[1]);
  assert.ok(est.rmst.ci[0] < D.truth.drmst && D.truth.drmst < est.rmst.ci[1]);
  // Step 6: a confounder as strong as STS-PROM could explain away the point estimate.
  assert.ok(b.bias > 1 / A.rr);
  assert.ok(Math.abs(b.bias - C.biasFactor(b.rrEU, b.rrUD)) < 1e-12);
  // The numbers the page prints, at the precision it prints them.
  const pts = (x) => (100 * x).toFixed(1);
  assert.equal(pts(U.rd), "4.1");
  assert.equal(pts(A.rd), "-5.4");
  assert.equal(pts(est.tmle.rd), "-5.4");
  assert.equal(pts(D.truth.rd), "-7.3");
  assert.equal((100 * A.se).toFixed(2), "2.33");
  assert.equal(A.rr.toFixed(2), "0.78");
  assert.equal(C.eValue(A.rr).toFixed(2), "1.87");
  assert.equal(C.eValueCI(A.rrCI[0], A.rrCI[1]).toFixed(2), "1.25");
});

test("lesson page, registration and prose", () => {
  const root = path.resolve(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "lessons/24-capstone-emulated-trial.html"), "utf8"),
    lab = fs.readFileSync(path.join(root, "labs/capstone.js"), "utf8");
  assert.match(html, /<body data-lesson="capstone">/);
  assert.match(html, /data-lab="capstone"/);
  assert.match(html, /science\/capstone\.js/);
  assert.match(lab, /data-r="capstone"/);
  assert.match(lab, /class="world-card"/);
  assert.ok((lab.match(/class="predict"/g) || []).length >= 2);
  for (const s of [html, lab, fs.readFileSync(path.join(root, "science/capstone.js"), "utf8")]) assert.ok(!s.includes("—"), "no em dashes");
  global.window = global.window || {};
  require(path.join(root, "shared/curriculum.js"));
  const units = window.CausalCurriculum.chapters.flatMap((c) => c.units),
    i = units.findIndex((u) => u.id === "capstone");
  assert.ok(i > 0 && units[i - 1].id === "targeted-survival");
  assert.equal(units[i].file, "24-capstone-emulated-trial.html");
  assert.equal(units[i].short, "Capstone");
  assert.equal(units[i].recap.length, 2);
});
