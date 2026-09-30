/* For your trial: planning math, simulation calibration, and the generated SAP text and R code. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const T = require("../science/trial.js");
const S = require("../science/trial-sap.js");
const close = (a, b, tol, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} != ${b} (tol ${tol})`);

test("normal quantile and CDF agree with standard values", () => {
  close(T.qnorm(0.975), 1.959964, 1e-6);
  close(T.qnorm(0.9), 1.281552, 1e-6);
  close(T.qnorm(0.001), -3.090232, 1e-5);
  close(T.pnorm(1.959964), 0.975, 1e-6);
  close(T.pnorm(-1), 0.158655, 1e-6);
});

test("continuous plan matches the textbook formula and the (1 - R²) rule", () => {
  const p = T.plan({ endpoint: "continuous", delta: 0.3, sd: 1, r2: 0.3, power: 0.9, alpha: 0.05, ratio: 1, dropout: 0 });
  const z = T.qnorm(0.975) + T.qnorm(0.9);
  const nU = (4 * z * z) / 0.09; // total, 1:1
  assert.equal(p.unadjusted.evaluable, 2 * Math.ceil(nU / 2));
  assert.equal(p.adjusted.evaluable, 2 * Math.ceil((nU * 0.7) / 2));
  close(p.variance.ratio, 0.7, 1e-6);
  close(p.powerAdjustedAtAdjusted, 0.9, 0.005);
  // R² = 0 gives the unadjusted power at the adjusted sample size.
  close(p.sensitivity.at(-1).power, p.powerUnadjustedAtAdjusted, 1e-9);
  assert.ok(p.powerBuffer > 0.9 && p.powerBuffer < 1);
});

test("binary world hits the stated control rate, treated rate and R²", () => {
  for (const [p0, p1, r2] of [[0.3, 0.2, 0.2], [0.1, 0.06, 0.35], [0.5, 0.6, 0.1]]) {
    const w = T.world({ endpoint: "binary", p0, p1, r2 });
    const m = T.moments(w);
    close(m.mu0, p0, 1e-6, "p0");
    close(m.mu1, p1, 1e-6, "p1");
    close(m.var0 / (p0 * (1 - p0)), r2, 1e-4, "R²");
  }
});

test("binary unadjusted sample size matches the two-proportion formula for every measure", () => {
  const p0 = 0.3, p1 = 0.2, z = T.qnorm(0.975) + T.qnorm(0.8);
  const v = p1 * (1 - p1) * 2 + p0 * (1 - p0) * 2; // per-participant, 1:1
  const cases = {
    rd: [v, p1 - p0],
    rr: [(1 - p1) / p1 * 2 + (1 - p0) / p0 * 2, Math.log(p1 / p0)],
    or: [2 / (p1 * (1 - p1)) + 2 / (p0 * (1 - p0)), Math.log((p1 / (1 - p1)) / (p0 / (1 - p0)))],
  };
  for (const [measure, [V, eff]] of Object.entries(cases)) {
    const p = T.plan({ endpoint: "binary", measure, p0, p1, r2: 0.2, power: 0.8, dropout: 0 });
    assert.equal(p.unadjusted.evaluable, 2 * Math.ceil((z * z * V) / (eff * eff) / 2), measure);
    assert.ok(p.adjusted.evaluable < p.unadjusted.evaluable, measure);
  }
});

test("allocation and dropout rounding keep whole arms in the stated ratio", () => {
  const p = T.plan({ endpoint: "continuous", ratio: 2, dropout: 0.15 });
  for (const n of [p.adjusted.evaluable, p.adjusted.enrolled, p.unadjusted.evaluable, p.unadjusted.enrolled])
    assert.equal(n % 3, 0);
  assert.ok(p.adjusted.enrolled * 0.85 >= p.adjusted.evaluable);
});

test("zero planned effect is reported, not divided by", () => {
  const p = T.plan({ endpoint: "continuous", delta: 0 });
  assert.equal(p.ok, false);
});

test("simulation: adjusted analysis keeps type I error and coverage, gains power, and the stress case stays valid", () => {
  const cfg = { endpoint: "continuous", delta: 0.3, r2: 0.3, power: 0.9 };
  const p = T.plan(cfg);
  const r = T.operatingCharacteristics(cfg, { n: p.adjusted.evaluable, reps: 1500, seed: 11 });
  const [nul, planned, stress] = r;
  const mc = (q) => 3.5 * Math.sqrt((q * (1 - q)) / 1500);
  close(nul.adjusted.rejectRate, 0.05, mc(0.05), "type I");
  close(planned.adjusted.coverage, 0.95, mc(0.95), "coverage");
  close(stress.adjusted.coverage, 0.95, mc(0.95), "stress coverage");
  close(planned.adjusted.rejectRate, p.powerAdjustedAtAdjusted, mc(0.9), "power matches the plan");
  assert.ok(planned.adjusted.empiricalSD < planned.unadjusted.empiricalSD);
  assert.ok(stress.adjusted.rejectRate < planned.adjusted.rejectRate);
  close(planned.adjusted.meanSE / planned.adjusted.empiricalSD, 1, 0.08, "SE calibrated");
});

test("simulation: binary odds ratio with 2:1 allocation is calibrated", () => {
  const cfg = { endpoint: "binary", measure: "or", p0: 0.3, p1: 0.2, r2: 0.3, power: 0.8, ratio: 2 };
  const p = T.plan(cfg);
  const r = T.operatingCharacteristics(cfg, { n: p.adjusted.evaluable, reps: 800, seed: 5 });
  const mc = (q) => 3.5 * Math.sqrt((q * (1 - q)) / 800);
  close(r[0].adjusted.rejectRate, 0.05, mc(0.05), "type I");
  close(r[1].adjusted.coverage, 0.95, mc(0.95), "coverage");
  close(r[1].adjusted.rejectRate, p.powerAdjustedAtAdjusted, mc(0.8), "power");
  assert.equal(r[1].adjusted.failed, 0);
});

test("unadjusted analysis is the difference in arm means with the Wald standard error", () => {
  const data = { x: [0, 1, 2, 3, 4, 5], a: [1, 0, 1, 0, 1, 0], y: [3, 1, 4, 1, 5, 9] };
  const r = T.analyze(data, "continuous", "md", false);
  const y1 = [3, 4, 5], y0 = [1, 1, 9];
  const m = (v) => v.reduce((s, t) => s + t, 0) / v.length,
    s2 = (v) => v.reduce((s, t) => s + (t - m(v)) ** 2, 0) / (v.length - 1);
  close(r.est, m(y1) - m(y0), 1e-12);
  close(r.se, Math.sqrt(s2(y1) / 3 + s2(y0) / 3), 1e-12);
});

const STATE = {
  trialName: "TRIAL-X",
  product: "device",
  population: "Adults with severe tricuspid regurgitation",
  treatment: "Device",
  control: "Medical therapy",
  endpointName: "KCCQ overall summary score",
  timepoint: "12 months",
  endpoint: "continuous",
  measure: "md",
  events: [{ name: "Death", strategy: "composite" }, { name: "Crossover", strategy: "hypothetical" }],
  covariates: "Baseline KCCQ, age, NYHA class",
  strata: "Region, TR grade",
  ratio: 1, alpha: 0.05, power: 0.9, delta: 5, sd: 18, p0: 0.3, p1: 0.2, r2: 0.3,
  r2Source: "a prior pivotal trial", dropout: 0.1, sizing: "adjusted",
};
const VARIANTS = [
  STATE,
  { ...STATE, endpoint: "binary", measure: "rd", sizing: "conservative", strata: "", product: "drug" },
  { ...STATE, endpoint: "binary", measure: "rr", ratio: 2 },
  { ...STATE, endpoint: "binary", measure: "or", covariates: "", strata: "region", events: [] },
];

test("generated SAP text is complete, sourced, and free of em dashes", () => {
  for (const s of VARIANTS) {
    const p = T.plan(s);
    const oc = T.operatingCharacteristics(s, { n: p.adjusted.evaluable, reps: 20 });
    oc.reps = 20;
    oc.n = p.adjusted.evaluable;
    const text = S.sap(s, p, oc);
    for (const h of ["## 1. Estimand", "## 2. Primary analysis", "## 3. Sample size", "## 4. Operating characteristics", "## References"])
      assert.ok(text.includes(h), `${s.measure}: ${h}`);
    assert.ok(text.includes("FDA (2023)") && text.includes("E9(R1)"));
    assert.ok(!/\u2014/.test(text), "em dash in SAP");
    assert.ok(!/undefined|NaN/.test(text), `${s.measure}: undefined or NaN in SAP`);
    if (s.measure === "or") assert.match(text, /non-collapsible/);
    if (s.product === "device") assert.match(text, /CDRH/);
    else assert.doesNotMatch(text, /CDRH/);
    const qs = S.reviewerQuestions(s, p);
    assert.ok(qs.length >= 6);
    for (const q of qs) assert.ok(q.q && q.a && q.source && !/\u2014|undefined|NaN/.test(q.q + q.a), q.id);
    assert.equal(qs.some((q) => q.id === "device"), s.product === "device");
  }
});

test("generated R code runs in base R for every variant", { skip: spawnSync("Rscript", ["--version"]).status !== 0 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "trial-r-"));
  for (const [i, s] of VARIANTS.entries()) {
    const code = S.rCode(s);
    assert.ok(!/\u2014/.test(code));
    assert.ok(!/library\(/.test(code), "base R only");
    const f = path.join(dir, `c${i}.R`);
    fs.writeFileSync(f, code + '\ncat("\\nRESULT", primary$estimate, primary$se, "\\n")\n');
    const out = spawnSync("Rscript", [f], { encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    const m = out.stdout.match(/RESULT ([-\d.e]+) ([-\d.e]+)/);
    assert.ok(m, "result line");
    assert.ok(Number.isFinite(+m[1]) && +m[2] > 0);
  }
});

test("covariate names become safe R names", () => {
  assert.equal(S.varName("Baseline KCCQ"), "baseline_kccq");
  assert.equal(S.varName("6MWD (m)"), "x_6mwd_m");
  assert.deepEqual(S.list("a, b;c\n d ,"), ["a", "b", "c", "d"]);
});
