const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../science/clone-censor-weight.js");
const close = (a, b, tol = 1e-10, msg = "") =>
  assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b} (tol ${tol})`);

const A = C.analyse(); // default registry shown in the lesson
const K = A.config.K,
  G = A.config.grace;

test("cloning rules: grace-window deaths count in both arms; deviations are censored at the right month", () => {
  const P = (death, surgery) => ({ id: 0, x: 0, obs: { death, surgery } });
  const pair = (p, g = 3) => Object.fromEntries(C.cloneOne(p, g, 24).map((c) => [c.arm, c]));
  // Died in month 1 while waiting: a death in both arms at time 2.
  let c = pair(P(2, null));
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status, c.never.exit], ["death", 2, "death", 2]);
  // Died at time 3 (month 2) while waiting, G = 3: still inside the window, counts in both.
  c = pair(P(3, null));
  assert.equal(c.grace.status, "death");
  // Operated at exactly G: stays in Operate, censored from No procedure at G.
  c = pair(P(null, 3));
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status, c.never.exit], ["end", 24, "censored", 3]);
  // Operated at G + 1: censored from Operate at G, from No procedure at G + 1.
  c = pair(P(10, 4));
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status, c.never.exit], ["censored", 3, "censored", 4]);
  // Never operated, died after the window: censored from Operate at G, a death in No procedure.
  c = pair(P(9, null));
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status, c.never.exit], ["censored", 3, "death", 9]);
  // Boundary: a grace period as long as follow-up never censors the Operate clone.
  c = pair(P(null, null), 24);
  assert.equal(c.grace.status, "end");
});

test("consistency: a clone that stays uncensored reproduces its patient's potential outcome under that strategy", () => {
  for (const cl of A.clones) {
    if (cl.status === "censored") continue;
    const p = A.sim.patients[cl.id],
      po = p.po[cl.arm];
    assert.equal(po.death ?? K, cl.exit, `patient ${cl.id} arm ${cl.arm}`);
  }
  // Artificially censored clones are exactly the deviations.
  for (const cl of A.arms.grace.filter((c) => c.status === "censored")) assert.equal(cl.exit, G);
  for (const cl of A.arms.never.filter((c) => c.status === "censored")) assert.equal(cl.exit, cl.surgery);
});

test("KM kernel: unit weights give plain KM; without censoring KM equals the empirical survival", () => {
  const unit = C.km(A.arms.grace, K, () => 1);
  unit.forEach((v, k) => close(v, A.grace.unweighted[k]));
  // Build uncensored pseudo-clones from the potential outcomes: KM must equal the truth curve.
  for (const arm of ["grace", "never"]) {
    const full = A.sim.patients.map((p) => ({
      exit: p.po[arm].death ?? K,
      status: p.po[arm].death ? "death" : "end",
    }));
    C.km(full, K).forEach((v, k) => close(v, A[arm].truth[k], 1e-12));
  }
  close(C.rmst([1, 1, 1]), 2);
  close(C.rmst([1, 0.5, 0.25]), 1.5);
});

test("weighted KM agrees with R survival::survfit on the same registry (verified offline, 12 digits)", () => {
  // Rscript: glm(op ~ x + I(k - 1), binomial) on waiting patient-months; survfit(Surv(k, k+1, ev) ~ 1, weights).
  close(A.fit.g0, -1.4948167, 1e-6);
  close(A.fit.gX, -0.6759495, 1e-6);
  close(A.fit.gT, -0.1591329, 1e-6);
  close(A.grace.weighted[K], 0.612650362453, 1e-9);
  close(A.never.weighted[K], 0.427687099894, 1e-9);
  close(A.grace.unweighted[K], 0.683187020649, 1e-9);
  close(A.never.unweighted[K], 0.310982194494, 1e-9);
  close(A.grace.weighted[12], 0.701347774582, 1e-9);
});

test("the lesson's displayed numbers: unweighted clones exaggerate the benefit; weights recover the truth", () => {
  close(A.grace.risk.unweighted, 0.317, 5e-4);
  close(A.never.risk.unweighted, 0.689, 5e-4);
  close(A.grace.risk.truth, 0.4, 5e-4);
  close(A.never.risk.truth, 0.559, 5e-4);
  close(A.grace.risk.weighted, 0.387, 5e-4);
  close(A.never.risk.weighted, 0.572, 5e-4);
  // Direction of the bias: Operate looks better, No procedure looks worse, than the truth.
  assert.ok(A.grace.risk.unweighted < A.grace.risk.truth - 0.05);
  assert.ok(A.never.risk.unweighted > A.never.risk.truth + 0.05);
  // Artificial censoring is informative: cut Operate clones are frailer, cut No procedure clones more robust.
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const cutG = mean(A.arms.grace.filter((c) => c.status === "censored").map((c) => c.x)),
    cutN = mean(A.arms.never.filter((c) => c.status === "censored").map((c) => c.x));
  assert.ok(cutG > 0.1 && cutN < -0.2, `${cutG} ${cutN}`);
  // Weighted estimates within 2.5 simulation SDs (SD from the 200-registry check) of the truth.
  close(A.grace.risk.weighted - A.never.risk.weighted, A.grace.risk.truth - A.never.risk.truth, 0.08);
});

test("exact population truth: valid curves, matches the simulated patients, and the forced-at-G strategy", () => {
  for (const arm of ["grace", "never"]) {
    const T = C.populationTruth({}, arm).S;
    close(T[0], 1);
    for (let k = 1; k <= K; k++) assert.ok(T[k] <= T[k - 1] + 1e-15 && T[k] > 0);
    // Sampling SD of a proportion with n = 3000 is below 0.0092; allow 3 SD.
    close(A[arm].truth[K], T[K], 0.028, arm);
  }
  // Large-sample check of the sample truth against the recursion.
  const big = C.simulate({ n: 40000, seed: 7 });
  for (const arm of ["grace", "never"])
    close(C.sampleTruth(big.patients, arm, K)[K], C.populationTruth({}, arm).S[K], 0.008, arm);
  // G = 1 forces the procedure at month 1 for everyone alive: no natural timing left.
  const g1 = C.simulate({ n: 200, grace: 1, seed: 3 });
  for (const p of g1.patients)
    if (p.po.grace.death === null || p.po.grace.death > 1) assert.equal(p.po.grace.surgery, 1);
});

test("weights: identities and boundary cases", () => {
  // A model without frailty gives equal weights to every No procedure clone at risk in a month,
  // so the weighted KM equals the unweighted KM exactly.
  const noX = C.analyse({}, { sim: A.sim, useX: false });
  noX.never.weighted.forEach((v, k) => close(v, noX.never.unweighted[k], 1e-12));
  assert.equal(noX.fit.gX, 0);
  // In the Operate arm only clones operated exactly at G carry weights above 1, and only from month G.
  for (const cl of A.arms.grace)
    for (let k = 0; k < K; k++)
      if (cl.w[k] !== 1) assert.ok(cl.surgery === G && k >= G);
  // No procedure weights are nondecreasing in k and equal the closed-form product.
  const cl = A.arms.never.find((c) => c.exit === K);
  for (let k = 1; k < K; k++) assert.ok(cl.w[k] >= cl.w[k - 1]);
  close(cl.w[10], C.weight(cl, 10, A.fit, G), 1e-12);
  // The fitted decision model recovers the generator.
  close(A.fit.gX, C.DEFAULTS.gX, 0.1);
  close(A.fit.gT, C.DEFAULTS.gT, 0.03);
  // With no frailty effect on the decision, even unweighted clones are close to the truth.
  const flat = C.analyse({ gX: 0 });
  for (const arm of ["grace", "never"]) close(flat[arm].risk.unweighted, flat[arm].risk.truth, 0.03, arm);
});

test("blended weights animate from unweighted (u = 0) to weighted (u = 1) KM", () => {
  for (const arm of ["grace", "never"]) {
    C.blendedKM(A, arm, 0).forEach((v, k) => close(v, A[arm].unweighted[k], 1e-12));
    C.blendedKM(A, arm, 1).forEach((v, k) => close(v, A[arm].weighted[k], 1e-12));
  }
});

test("showcase: 12 deterministic patients sorted by frailty, including one operated exactly at G", () => {
  const s = C.showcase(A.sim.patients, G, K);
  assert.equal(s.length, 12);
  for (let i = 1; i < s.length; i++) assert.ok(s[i].x >= s[i - 1].x);
  assert.ok(s.some((p) => p.obs.surgery === G && (p.obs.death === null || p.obs.death > 12)));
  assert.ok(s.some((p) => p.obs.surgery === null && p.obs.death !== null && p.obs.death <= G));
  assert.deepEqual(C.showcase(A.sim.patients, G, K).map((p) => p.id), s.map((p) => p.id));
});

test("precomputed 200-registry check: weighted is unbiased within Monte Carlo error, unweighted is not", () => {
  const keys = Object.keys(C.MC);
  assert.ok(keys.includes("3|0.7"), "default cell present");
  for (const key of keys) {
    const [tRD, tRM, uRD, uRDsd, wRD, wRDsd, uRM, , wRM, wRMsd] = C.MC[key],
      se = (sd) => sd / Math.sqrt(C.MC_R);
    if (key === "3|1.4") {
      // Strongest frailty effect: very large weights (near-positivity violation) leave a small,
      // detectable finite-sample bias. The lesson says so; it is still a tenth of the unweighted bias.
      assert.ok(Math.abs(wRD - tRD) < 0.03 && Math.abs(wRD - tRD) < 0.1 * Math.abs(uRD - tRD));
      continue;
    }
    assert.ok(Math.abs(wRD - tRD) < 3 * se(wRDsd), `${key} RD ${wRD} vs ${tRD}`);
    assert.ok(Math.abs(wRM - tRM) < 3 * se(wRMsd), `${key} RMST ${wRM} vs ${tRM}`);
    if (!key.endsWith("|0")) assert.ok(uRD < tRD - 0.05 && uRM > tRM + 0.5, key);
  }
  const d = C.MC["3|0.7"];
  const Sg = C.populationTruth({}, "grace").S,
    Sn = C.populationTruth({}, "never").S;
  close(d[0], (1 - Sg[K]) - (1 - Sn[K]), 1e-4);
  close(d[1], C.rmst(Sg) - C.rmst(Sn), 1e-4);
});

test("one patient first: the three histories clone as the lesson says", () => {
  const { opMonth, deathTime, x } = C.ONE;
  const pair = (obs) => Object.fromEntries(C.cloneOne({ id: 0, x, obs }, G, K).map((c) => [c.arm, c]));
  // (i) Operated at month 2: Copy A (operate by G) continues, Copy B (never) is cut at month 2.
  let c = pair({ death: null, surgery: opMonth });
  assert.deepEqual([c.grace.status, c.never.status, c.never.exit], ["end", "censored", opMonth]);
  // (ii) Still waiting when the window closes: Copy A is cut at G, Copy B continues.
  c = pair({ death: null, surgery: null });
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status], ["censored", G, "end"]);
  // (iii) Dies while waiting: a death in both copies at the same time.
  c = pair({ death: deathTime, surgery: null });
  assert.deepEqual([c.grace.status, c.grace.exit, c.never.status, c.never.exit], ["death", deathTime, "death", deathTime]);
});

test("one patient first: his weights equal the lesson's weight() and the displayed numbers", () => {
  const P = C.onePerson(C.ONE.x, A.fit, G);
  // Same numbers as the general weight function for a clone with his frailty.
  const never = { arm: "never", x: C.ONE.x },
    graceAtG = { arm: "grace", x: C.ONE.x, surgery: G };
  for (let k = 0; k <= G; k++) close(P.wNever[k], C.weight(never, k, A.fit, G), 1e-12);
  close(P.wGrace, C.weight(graceAtG, G, A.fit, G), 1e-12);
  // Displayed: p̂1 ≈ 0.24, p̂2 ≈ 0.21, still unoperated after month 2 ≈ 0.60, so a similar copy counts 1.67;
  // a similar patient operated exactly at month 3 (p̂3 ≈ 0.19) counts 5.37.
  close(P.p[1], 0.239, 5e-4);
  close(P.p[2], 0.211, 5e-4);
  close(P.stay[2], 0.6, 5e-4);
  close(P.wNever[2], 1.667, 5e-4);
  close(P.p[3], 0.186, 5e-4);
  close(P.wGrace, 5.37, 5e-3);
  // Out of 100 similar patients: counts add to 100 and the survivors, weighted, stand for all 100.
  const n = C.perHundred([P.p[1], P.stay[1] * P.p[2], P.stay[2]]);
  assert.deepEqual(n, [24, 16, 60]);
  assert.equal(n.reduce((a, b) => a + b, 0), 100);
  close(100 * P.stay[2] * P.wNever[2], 100, 1e-9);
  const m = C.perHundred([1 - P.p[G], P.p[G]]);
  assert.deepEqual(m, [81, 19]);
});

test("one patient first: boundary cases", () => {
  // A coin-flip decision every month: stay = 0.5^k, weight = 2^k, and 1/p̂_G = 2.
  const coin = C.onePerson(0, { g0: 0, gX: 0, gT: 0 }, 3);
  [1, 0.5, 0.25, 0.125].forEach((v, k) => close(coin.stay[k], v, 1e-15));
  close(coin.wNever[3], 8, 1e-12);
  close(coin.wGrace, 2, 1e-12);
  // Month 0: no decision yet, so no one has been cut and the weight is 1.
  assert.equal(coin.wNever[0], 1);
  // Rounding: exact fractions stay exact, and ties still add to the total.
  assert.deepEqual(C.perHundred([0.25, 0.75]), [25, 75]);
  assert.deepEqual(C.perHundred([1 / 3, 1 / 3, 1 / 3]), [34, 33, 33]);
  assert.deepEqual(C.perHundred([1, 0]), [100, 0]);
});
