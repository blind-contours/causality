/* Repeated-sample experiment for the lesson "Targeted survival curves and ΔRMST".
 * Every combination of an event-hazard model, a censoring model and a propensity model
 * (4 × 3 × 3 = 36 configurations) × REPS seeded studies of size N. Study r uses seed SEED0 + r in every
 * configuration, so configurations differ only in the working models. For each study:
 * treated-arm KM, IPTW+IPCW weighted KM, g-formula plug-in, one-step and TMLE for S_1(τ) and ΔRMST(τ).
 *   event: right (month factor + a separate effect per (a, x) cell), noint (severity linear, no a × x
 *          interaction), notime (no time trend), drop (severity left out: the extreme case)
 *   cens:  right, high (severity coded high vs not: wrong functional form), drop
 *   prop:  right, merge (mid and high severity merged), drop
 * Writes science/targeted-survival-data.json. Run: node scripts/targeted-survival-precompute.cjs
 * Deterministic: the same seeds give byte-identical output. */
const fs = require("fs"),
  path = require("path"),
  T = require("../science/targeted-survival.js");
// TS_REPS and TS_OUT override the repeat count and output path (used only to check determinism quickly).
const N = 800, REPS = +process.env.TS_REPS || 1000, TAU = 12, SEED0 = 7000, Z = 1.959964;
const wS = T.weightsS(TAU), wR = T.weightsRMST(TAU),
  truth = { s1: T.truth(1, wS), drmst: T.truth(1, wR) - T.truth(0, wR) },
  bound = { s1: T.efficiencyBound(wS).variance, drmst: T.efficiencyBound(wR, { 1: 1, 0: -1 }).variance },
  LEVELS = { event: ["right", "noint", "notime", "drop"], cens: ["right", "high", "drop"], prop: ["right", "merge", "drop"] },
  configs = [];
for (const event of LEVELS.event) for (const cens of LEVELS.cens) for (const prop of LEVELS.prop) configs.push({ event, cens, prop });
const estimators = ["km", "wkm", "plugin", "onestep", "tmle"];
const out = { n: N, reps: REPS, tau: TAU, seed0: SEED0, truth, bound, levels: LEVELS, configs: [] };
const r6 = (v) => +v.toFixed(6);
const t0 = Date.now();
// Simulate each study once and reuse it across configurations.
const studies = Array.from({ length: REPS }, (_, r) => {
  const rows = T.simulate(N, SEED0 + r);
  return { rows, c: T.counts(rows) };
});
for (const spec of configs) {
  const res = { s1: {}, drmst: {} }, se = { s1: { onestep: [], tmle: [] }, drmst: { onestep: [], tmle: [] } },
    gap = { s1: { tmle: [], wkm: [] }, drmst: { tmle: [], wkm: [] } };
  estimators.forEach((e) => { res.s1[e] = []; res.drmst[e] = []; });
  for (const { rows, c } of studies) {
    const nu = T.fit(rows, spec, c);
    const km = [0, 1].map((a) => T.kmArm(c, a)), wkm = [0, 1].map((a) => T.weightedKM(c, a, nu));
    res.s1.km.push(km[1][TAU]); res.s1.wkm.push(wkm[1][TAU]);
    res.drmst.km.push(T.rmstOf(km[1], TAU) - T.rmstOf(km[0], TAU));
    res.drmst.wkm.push(T.rmstOf(wkm[1], TAU) - T.rmstOf(wkm[0], TAU));
    res.s1.plugin.push(T.gformula(rows, 1, nu, wS));
    res.drmst.plugin.push(T.gformula(rows, 1, nu, wR) - T.gformula(rows, 0, nu, wR));
    const os = T.eif(rows, 1, nu, wS), tm = T.tmle(rows, 1, nu, wS, c);
    const rm = [0, 1].map((a) => T.eif(rows, a, nu, wR)), rt = [0, 1].map((a) => T.tmle(rows, a, nu, wR, c));
    const dO = T.contrast(rm[1], rm[0]), dT = T.contrast(rt[1], rt[0]);
    res.s1.onestep.push(os.est); res.s1.tmle.push(tm.est);
    res.drmst.onestep.push(dO.est); res.drmst.tmle.push(dT.est);
    se.s1.onestep.push(os.se); se.s1.tmle.push(tm.se); se.drmst.onestep.push(dO.se); se.drmst.tmle.push(dT.se);
    for (const tg of ["s1", "drmst"]) {
      const o = res[tg].onestep.at(-1);
      gap[tg].tmle.push(Math.abs(res[tg].tmle.at(-1) - o));
      gap[tg].wkm.push(Math.abs(res[tg].wkm.at(-1) - o));
    }
  }
  const summary = {};
  for (const tg of ["s1", "drmst"]) {
    summary[tg] = {};
    for (const e of estimators) {
      const v = res[tg][e], m = v.reduce((s, x) => s + x, 0) / v.length,
        sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
      summary[tg][e] = {
        mean: r6(m), bias: r6(m - truth[tg]), sd: r6(sd), mcse: r6(sd / Math.sqrt(v.length)),
        // Coverage of est ± 1.96 × (repeated-sample SD): what an interval of the right width would give,
        // so it isolates the damage done by bias. Available for every estimator.
        oracleCoverage: v.filter((x) => Math.abs(x - truth[tg]) <= Z * sd).length / REPS,
        values: v,
      };
    }
    for (const e of ["onestep", "tmle"]) {
      const s = se[tg][e];
      summary[tg][e].coverage = res[tg][e].filter((x, i) => Math.abs(x - truth[tg]) <= Z * s[i]).length / REPS;
      summary[tg][e].meanSE = r6(s.reduce((a, b) => a + b, 0) / REPS);
    }
    summary[tg].gap = {
      tmle: r6(gap[tg].tmle.reduce((a, b) => a + b, 0) / REPS),
      wkm: r6(gap[tg].wkm.reduce((a, b) => a + b, 0) / REPS),
    };
  }
  out.configs.push({ spec, ...summary });
  const line = (tg) => estimators.map((e) => `${e} ${summary[tg][e].bias.toFixed(4)}/${summary[tg][e].sd.toFixed(4)}`).join("  ");
  console.log(JSON.stringify(spec), "S1", line("s1"), "cov", summary.s1.onestep.coverage, summary.s1.tmle.coverage);
  console.log("   dRMST", line("drmst"), "cov", summary.drmst.onestep.coverage, summary.drmst.tmle.coverage);
}
// Replace raw values by histograms on one shared grid per target (keeps the JSON small).
const BINS = 48;
out.domain = {};
for (const tg of ["s1", "drmst"]) {
  const all = out.configs.flatMap((c) => estimators.flatMap((e) => c[tg][e].values)),
    lo = all.reduce((m, v) => Math.min(m, v), Infinity), hi = all.reduce((m, v) => Math.max(m, v), -Infinity), pad = (hi - lo) * 0.02;
  out.domain[tg] = [+(lo - pad).toFixed(4), +(hi + pad).toFixed(4)];
  const [a, b] = out.domain[tg];
  for (const c of out.configs)
    for (const e of estimators) {
      const h = new Array(BINS).fill(0);
      c[tg][e].values.forEach((v) => h[Math.min(BINS - 1, Math.floor(((v - a) / (b - a)) * BINS))]++);
      c[tg][e].hist = h;
      delete c[tg][e].values;
    }
}
out.bins = BINS;
console.log("bound SD s1", Math.sqrt(bound.s1 / N), "drmst", Math.sqrt(bound.drmst / N), "sec", (Date.now() - t0) / 1000);
fs.writeFileSync(process.env.TS_OUT || path.join(__dirname, "../science/targeted-survival-data.json"), JSON.stringify(out));
