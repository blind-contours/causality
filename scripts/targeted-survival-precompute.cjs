/* Repeated-sample experiment for lesson 23 (targeted survival).
 * Four nuisance configurations × REPS seeded studies of size N. For each study:
 * treated-arm KM, IPTW+IPCW weighted KM, g-formula plug-in, one-step and TMLE for S_1(τ) and ΔRMST(τ).
 * Writes science/targeted-survival-data.json. Run: node scripts/targeted-survival-precompute.cjs */
const fs = require("fs"),
  path = require("path"),
  T = require("../science/targeted-survival.js");
const N = 800, REPS = 1000, TAU = 12, SEED0 = 7000;
const wS = T.weightsS(TAU), wR = T.weightsRMST(TAU),
  truth = { s1: T.truth(1, wS), drmst: T.truth(1, wR) - T.truth(0, wR) },
  bound = { s1: T.efficiencyBound(wS).variance, drmst: T.efficiencyBound(wR, { 1: 1, 0: -1 }).variance },
  configs = [
    { event: "right", nuis: "right" },
    { event: "wrong", nuis: "right" },
    { event: "right", nuis: "wrong" },
    { event: "wrong", nuis: "wrong" },
  ],
  estimators = ["km", "wkm", "plugin", "onestep", "tmle"];
const out = { n: N, reps: REPS, tau: TAU, seed0: SEED0, truth, bound, configs: [] };
const t0 = Date.now();
for (const spec of configs) {
  const res = { s1: {}, drmst: {} }, cover = { s1: { onestep: 0, tmle: 0 }, drmst: { onestep: 0, tmle: 0 } }, ses = { s1: [], drmst: [] };
  estimators.forEach((e) => { res.s1[e] = []; res.drmst[e] = []; });
  for (let r = 0; r < REPS; r++) {
    const rows = T.simulate(N, SEED0 + r), c = T.counts(rows), nu = T.fit(rows, spec, c);
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
    ses.s1.push(os.se); ses.drmst.push(dO.se);
    const cov = (e, se, tr) => +(Math.abs(e - tr) <= 1.959964 * se);
    cover.s1.onestep += cov(os.est, os.se, truth.s1); cover.s1.tmle += cov(tm.est, tm.se, truth.s1);
    cover.drmst.onestep += cov(dO.est, dO.se, truth.drmst); cover.drmst.tmle += cov(dT.est, dT.se, truth.drmst);
  }
  const summary = {};
  for (const target of ["s1", "drmst"]) {
    summary[target] = {};
    for (const e of estimators) {
      const v = res[target][e], m = v.reduce((s, x) => s + x, 0) / v.length,
        sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
      summary[target][e] = {
        mean: +m.toFixed(5), bias: +(m - truth[target]).toFixed(5), sd: +sd.toFixed(5),
        mcse: +(sd / Math.sqrt(v.length)).toFixed(5),
        values: v,
      };
    }
    summary[target].onestep.coverage = cover[target].onestep / REPS;
    summary[target].tmle.coverage = cover[target].tmle / REPS;
    summary[target].onestep.meanSE = +(ses[target].reduce((s, x) => s + x, 0) / REPS).toFixed(5);
  }
  out.configs.push({ spec, ...summary });
  console.log(JSON.stringify(spec), "S1", Object.fromEntries(estimators.map((e) => [e, [summary.s1[e].bias, summary.s1[e].sd]])), "cov", summary.s1.onestep.coverage, summary.s1.tmle.coverage);
  console.log("   dRMST", Object.fromEntries(estimators.map((e) => [e, [summary.drmst[e].bias, summary.drmst[e].sd]])), "cov", summary.drmst.onestep.coverage, summary.drmst.tmle.coverage);
}
// Replace raw values by histograms on one shared grid per target (keeps the JSON small).
const BINS = 48;
for (const target of ["s1", "drmst"]) {
  const all = out.configs.flatMap((c) => estimators.flatMap((e) => c[target][e].values)),
    lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.02;
  out.domain = out.domain || {};
  out.domain[target] = [+(lo - pad).toFixed(4), +(hi + pad).toFixed(4)];
  const [a, b] = out.domain[target];
  for (const c of out.configs)
    for (const e of estimators) {
      const h = new Array(BINS).fill(0);
      c[target][e].values.forEach((v) => h[Math.min(BINS - 1, Math.floor(((v - a) / (b - a)) * BINS))]++);
      c[target][e].hist = h;
      delete c[target][e].values;
    }
}
out.bins = BINS;
console.log("bound SD s1", Math.sqrt(bound.s1 / N), "drmst", Math.sqrt(bound.drmst / N), "sec", (Date.now() - t0) / 1000);
fs.writeFileSync(path.join(__dirname, "../science/targeted-survival-data.json"), JSON.stringify(out));
