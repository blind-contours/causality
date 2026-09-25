/* Scoring and snapping math for "draw your guess" (shared/guess.js). */
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../shared/guess.js");
const T = require("../science/target-trial.js");

const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("stepAt is right-continuous and flat before the first point", () => {
  const km = [[0, 1], [0.2, 0.9], [0.5, 0.7]];
  assert.equal(G.stepAt(km, 0), 1);
  assert.equal(G.stepAt(km, 0.1999), 1);
  assert.equal(G.stepAt(km, 0.2), 0.9);
  assert.equal(G.stepAt(km, 0.49), 0.9);
  assert.equal(G.stepAt(km, 1), 0.7);
  assert.equal(G.stepAt(km, -1), 1);
});

test("linAt interpolates and carries the ends flat", () => {
  const p = [[0, 0], [1, 2]];
  close(G.linAt(p, 0.25), 0.5);
  assert.equal(G.linAt(p, -3), 0);
  assert.equal(G.linAt(p, 5), 2);
});

test("a fast two-point stroke fills every grid x it spans, linearly", () => {
  const xs = G.grid(0, 1, 11),
    raw = G.applyStroke(new Array(11).fill(null), xs, [[0.1, 0.9], [0.7, 0.3]]);
  assert.equal(raw[0], null);
  for (let i = 1; i <= 7; i++) close(raw[i], 0.9 - (xs[i] - 0.1));
  assert.equal(raw[8], null);
});

test("a stroke drawn right to left, then corrected, keeps the latest pass", () => {
  const xs = G.grid(0, 1, 11);
  let raw = G.applyStroke(new Array(11).fill(null), xs, [[1, 0.2], [0, 0.8]]);
  close(raw[5], 0.5);
  raw = G.applyStroke(raw, xs, [[0.4, 0.1], [0.6, 0.1]]);
  close(raw[5], 0.1);
  close(raw[3], 0.8 - 0.6 * 0.3);
  assert.equal(G.drawnShare(raw), 1);
});

test("a single tap writes one grid point; nothing drawn projects to null", () => {
  const xs = G.grid(0, 1, 11),
    raw = G.applyStroke(new Array(11).fill(null), xs, [[0.52, 0.4]]);
  assert.equal(raw.filter((v) => v !== null).length, 1);
  close(raw[5], 0.4);
  assert.equal(G.project(new Array(5).fill(null), {}), null);
  assert.equal(G.drawnShare(new Array(5).fill(null)), 0);
});

test("PAVA gives the least-squares non-increasing fit", () => {
  assert.deepEqual(G.pavaDown([3, 1, 2]), [3, 1.5, 1.5]);
  assert.deepEqual(G.pavaDown([1, 2, 3]), [2, 2, 2]);
  assert.deepEqual(G.pavaDown([5, 4, 4, 1]), [5, 4, 4, 1]);
  // Optimality: no other non-increasing sequence on a small lattice beats it.
  const y = [0.2, 0.9, 0.4, 0.6, 0.1],
    fit = G.pavaDown(y),
    sse = (z) => z.reduce((a, v, i) => a + (v - y[i]) ** 2, 0);
  for (let i = 1; i < fit.length; i++) assert.ok(fit[i] <= fit[i - 1] + 1e-12);
  const lattice = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  let best = Infinity;
  const rec = (pre) => {
    if (pre.length === y.length) return (best = Math.min(best, sse(pre)));
    for (const v of lattice) if (!pre.length || v <= pre[pre.length - 1]) rec([...pre, v]);
  };
  rec([]);
  assert.ok(sse(fit) <= best + 1e-12);
});

test("survival projection: starts at the anchor, never rises, stays in range, fills gaps", () => {
  const raw = [null, 0.95, null, 0.97, 0.6, null, null, 0.3, 0.35, null, null];
  const v = G.project(raw, { monotone: true, lo: 0.4, hi: 1, anchor: 1 });
  assert.equal(v.length, raw.length);
  assert.equal(v[0], 1);
  for (let i = 1; i < v.length; i++) assert.ok(v[i] <= v[i - 1] + 1e-12, `rises at ${i}`);
  assert.ok(v.every((x) => x >= 0.4 && x <= 1));
  close(v[1], 0.96); // 0.95 and 0.97 pooled
  close(v[2], 0.96);
  close(v[10], 0.4); // carried flat from the clamped last point
  // The anchor overrides a drawn value at time zero.
  const w = G.project([0.5, 0.5, 0.5], { monotone: true, anchor: 1 });
  assert.deepEqual(w, [1, 0.5, 0.5]);
});

test("a stroke drawn above the anchor is clipped to it (boundary case)", () => {
  const v = G.project([null, 1.3, 1.2], { monotone: true, lo: 0, hi: 1, anchor: 1 });
  assert.deepEqual(v, [1, 1, 1]);
});

test("hat adjustment moves the handle fully and fades to zero one spacing away", () => {
  const xs = G.grid(0, 1, 11),
    v = G.hatAdjust(new Array(11).fill(0.5), xs, 0.5, 0.2, 0.1);
  close(v[5], 0.6);
  close(v[4], 0.55);
  close(v[3], 0.5);
  close(v[0], 0.5);
});

test("curve score: within-tolerance share and mean absolute gap", () => {
  const xs = G.grid(0, 1, 101),
    truth = xs.map(() => 0.5),
    guess = xs.map((x) => (x < 0.5 ? 0.52 : 0.6));
  const s = G.curveScore(guess, truth, xs, 0.05);
  close(s.within, 50 / 101);
  // Trapezoid of |gap|: 0.02 on [0, 0.49], a linear ramp on [0.49, 0.5], 0.1 on [0.5, 1].
  close(s.meanAbs, 0.02 * 0.49 + 0.06 * 0.01 + 0.1 * 0.5);
  close(s.maxAbs, 0.1);
  assert.equal(s.endGuess, 0.6);
  // A perfect guess scores 100% within and zero area.
  const p = G.curveScore(truth, truth, xs, 0);
  assert.equal(p.within, 1);
  assert.equal(p.meanAbs, 0);
});

test("point and band scores", () => {
  const p = G.pointScore(0.85, 0.617, 1);
  close(p.error, 0.233);
  close(p.relError, 0.233);
  const b = G.bandScore([10, 40], [15, 35]);
  assert.equal(b.widthGuess, 30);
  assert.equal(b.widthTruth, 20);
  close(b.widthError, 0.5);
  close(b.overlap, 20 / 30);
  assert.equal(b.centerError, 0);
  const d = G.bandScore([0, 1], [2, 3]);
  assert.equal(d.overlap, 0);
  // Ends given in either order; a zero-width truth is a boundary case.
  const r = G.bandScore([40, 10], [20, 20]);
  assert.deepEqual(r.guess, [10, 40]);
  assert.equal(r.widthError, Infinity);
  assert.equal(G.bandScore([5, 5], [5, 5]).overlap, 1);
});

test("lesson 18 guess truth: the misaligned Kaplan–Meier curves the lesson draws", () => {
  const s = T.study({ seed: T.DEFAULTS.seed, hr: 1 }),
    a = s.analyses.procedure,
    xs = G.grid(0, 1, 121),
    t1 = xs.map((x) => G.stepAt(a.treated.km.points, x)),
    t0 = xs.map((x) => G.stepAt(a.untreated.km.points, x));
  close(t1[120], 1 - a.treated.risk, 1e-12);
  close(t0[120], 1 - a.untreated.risk, 1e-12);
  // Immortal time: treated survival sits above untreated at one year by more than 10 points.
  assert.ok(t1[120] - t0[120] > 0.1);
  // A learner who draws both arms on the truth (no effect) is within 5 points of the treated curve
  // only early on, and misses most of the untreated curve's late follow-up.
  const truthS = xs.map((x) => Math.exp(-0.35 * x));
  const sT = G.curveScore(truthS, t1, xs, 0.05),
    sU = G.curveScore(truthS, t0, xs, 0.05);
  assert.ok(sU.within < sT.within);
});
