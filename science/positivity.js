/* Positivity teaching world. Pure computations, no DOM.
 *
 * World: severity X ~ N(0, 1). Treatment A | X ~ Bernoulli(g(X)) with
 *   logit g(X) = β (X − 0.5)      (α = −β/2, so the 50/50 point stays at severity 0.5).
 * β is the "separation" slider; β = 0 is a coin flip for everyone.
 * Outcome: Y = m(A, X) + ε, ε ~ N(0, 1), with
 *   m(0, x) = 1 + 1.5x,  m(1, x) = m(0, x) + τ(x),  τ(x) = 2 + x.
 * So the ATE is exactly E[τ(X)] = 2, and any other target population has its own
 * average of τ: that is how trimming and overlap weights change the answer.
 *
 * Exact (numerical integration to ~1e-9): the ATE, trimmed-population averages, the ATO,
 * and the population densities. Simulated (seeded): one analysis sample and repeated samples.
 * Samples use common random numbers: X, U and ε depend only on the seed, and
 * A = 1{U < g(X)}, so moving β changes only who is treated. */
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.CausalScience;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalPositivity = api;
})(globalThis, function (core) {
  const CENTER = 0.5,
    N = 500,
    SEED = 20260925,
    ATE = 2;
  const expit = (z) => 1 / (1 + Math.exp(-z));
  const logit = (p) => Math.log(p / (1 - p));
  const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  // Standard normal CDF via erfc (Numerical Recipes erfcc, relative error < 1.2e-7).
  function Phi(x) {
    const z = Math.abs(x) / Math.SQRT2,
      t = 1 / (1 + 0.5 * z),
      r =
        t *
        Math.exp(
          -z * z -
            1.26551223 +
            t *
              (1.00002368 +
                t *
                  (0.37409196 +
                    t *
                      (0.09678418 +
                        t *
                          (-0.18628806 +
                            t *
                              (0.27886807 +
                                t *
                                  (-1.13520398 +
                                    t *
                                      (1.48851587 +
                                        t * (-0.82215223 + t * 0.17087277)))))))),
        );
    return x >= 0 ? 1 - r / 2 : r / 2;
  }
  const g = (x, beta) => expit(beta * (x - CENTER));
  const tau = (x) => 2 + x;
  const m = (a, x) => 1 + 1.5 * x + (a ? tau(x) : 0);

  // Simpson's rule on [lo, hi] with an even number of panels.
  function integrate(f, lo = -10, hi = 10, panels = 4000) {
    const h = (hi - lo) / panels;
    let s = f(lo) + f(hi);
    for (let i = 1; i < panels; i++) s += (i % 2 ? 4 : 2) * f(lo + i * h);
    return (s * h) / 3;
  }

  /* ---------- exact targets ---------- */
  // Patients kept when trimming to a ≤ g ≤ 1 − a (Crump et al. 2009): an interval of X.
  function trimInterval(beta, a) {
    if (!(a > 0)) return { lo: -Infinity, hi: Infinity };
    if (a >= 0.5) return { lo: CENTER, hi: CENTER }; // nobody (measure zero)
    if (beta === 0) return { lo: -Infinity, hi: Infinity };
    const L = logit(1 - a) / Math.abs(beta);
    return { lo: CENTER - L, hi: CENTER + L };
  }
  function trimmedTarget(beta, a) {
    const { lo, hi } = trimInterval(beta, a),
      share = Phi(hi) - Phi(lo);
    if (!(share > 0)) return { lo, hi, share: 0, value: NaN, meanX: NaN };
    const meanX = (phi(lo) - phi(hi)) / share; // E[X | lo ≤ X ≤ hi]
    return { lo, hi, share, meanX, value: tau(meanX) };
  }
  // ATO = E[g(1−g) τ(X)] / E[g(1−g)] (Li, Morgan & Zaslavsky 2018).
  function atoTarget(beta) {
    const w = (x) => g(x, beta) * (1 - g(x, beta)) * phi(x),
      mass = integrate(w),
      meanX = integrate((x) => x * w(x)) / mass;
    return { value: tau(meanX), meanX, tilt: mass };
  }
  // Density of X in each target population, for the "who is the answer about" figure.
  function targetDensity(x, beta, method, a = 0.1) {
    if (method === "trim") {
      const t = trimmedTarget(beta, a);
      return x >= t.lo && x <= t.hi && t.share > 0 ? phi(x) / t.share : 0;
    }
    if (method === "overlap") {
      const t = atoTarget(beta);
      return (g(x, beta) * (1 - g(x, beta)) * phi(x)) / t.tilt;
    }
    return phi(x);
  }
  // Structural variant: a contraindication means nobody with X > cut is ever treated.
  const gStructural = (x, beta, cut = 1.5) => (x > cut ? 0 : g(x, beta));

  /* ---------- sampling ---------- */
  function draws(n = N, seed = SEED) {
    const random = core.rng(seed),
      out = [];
    for (let i = 0; i < n; i++)
      out.push({
        x: core.randn(random),
        u: random(),
        e: core.randn(random),
      });
    return out;
  }
  function sample(beta, n = N, seed = SEED, opts = {}) {
    const base = opts.draws || draws(n, seed),
      prop = opts.structural
        ? (x) => gStructural(x, beta, opts.cut)
        : (x) => g(x, beta);
    return base.map(({ x, u, e }) => {
      const p = prop(x),
        a = +(u < p);
      return { x, a, g: p, y: m(a, x) + e };
    });
  }

  /* ---------- nuisance fits ---------- */
  // Logistic regression of A on (1, X) by Newton–Raphson. A tiny ridge keeps it finite
  // under complete separation; it is otherwise negligible.
  function fitLogistic(rows) {
    let b0 = 0,
      b1 = 0;
    for (let it = 0; it < 50; it++) {
      let g0 = 0,
        g1 = 0,
        h00 = 1e-6,
        h01 = 0,
        h11 = 1e-6;
      for (const r of rows) {
        const p = expit(b0 + b1 * r.x),
          w = p * (1 - p);
        g0 += r.a - p;
        g1 += (r.a - p) * r.x;
        h00 += w;
        h01 += w * r.x;
        h11 += w * r.x * r.x;
      }
      g0 -= 1e-6 * b0;
      g1 -= 1e-6 * b1;
      const det = h00 * h11 - h01 * h01,
        d0 = (h11 * g0 - h01 * g1) / det,
        d1 = (h00 * g1 - h01 * g0) / det;
      b0 += d0;
      b1 += d1;
      if (Math.abs(d0) + Math.abs(d1) < 1e-10) break;
    }
    return [b0, b1];
  }
  // Least squares of Y on (1, X) within one arm.
  function fitLine(rows) {
    const n = rows.length;
    if (n < 2) return [n ? rows[0].y : 0, 0];
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (const r of rows) {
      sx += r.x;
      sy += r.y;
      sxx += r.x * r.x;
      sxy += r.x * r.y;
    }
    const vx = sxx - (sx * sx) / n,
      slope = vx > 1e-12 ? (sxy - (sx * sy) / n) / vx : 0;
    return [(sy - slope * sx) / n, slope];
  }
  // Kish effective sample size (Σw)² / Σw².
  function kish(w) {
    let s = 0,
      s2 = 0;
    for (const v of w) {
      s += v;
      s2 += v * v;
    }
    return s2 > 0 ? (s * s) / s2 : 0;
  }
  function quantile(values, q) {
    const v = values.slice().sort((a, b) => a - b),
      h = (v.length - 1) * q,
      k = Math.floor(h);
    return v[k] + (h - k) * ((v[Math.min(k + 1, v.length - 1)] ?? v[k]) - v[k]);
  }
  const hajek = (rows, w) => {
    let n1 = 0,
      d1 = 0,
      n0 = 0,
      d0 = 0;
    rows.forEach((r, i) => {
      if (r.a) {
        n1 += w[i] * r.y;
        d1 += w[i];
      } else {
        n0 += w[i] * r.y;
        d0 += w[i];
      }
    });
    return d1 > 0 && d0 > 0 ? n1 / d1 - n0 / d0 : NaN;
  };

  /* ---------- one analysis ----------
   * opts.cap: percentile (0 < cap ≤ 1) at which each patient's weight is capped (1 = none).
   * opts.trim: a, drop patients with ĝ outside [a, 1 − a] (0 = none).
   * opts.oracle: use the true g instead of the fitted one. */
  function analyze(rows, opts = {}) {
    const cap = opts.cap ?? 1,
      a = opts.trim ?? 0,
      coef = opts.oracle ? null : fitLogistic(rows),
      gh = rows.map((r) => (coef ? expit(coef[0] + coef[1] * r.x) : r.g)),
      w = rows.map((r, i) => (r.a ? 1 / gh[i] : 1 / (1 - gh[i]))),
      l1 = fitLine(rows.filter((r) => r.a)),
      l0 = fitLine(rows.filter((r) => !r.a)),
      m1 = rows.map((r) => l1[0] + l1[1] * r.x),
      m0 = rows.map((r) => l0[0] + l0[1] * r.x),
      aipwTerms = rows.map(
        (r, i) =>
          m1[i] -
          m0[i] +
          (r.a / gh[i] - (1 - r.a) / (1 - gh[i])) *
            (r.y - (r.a ? m1[i] : m0[i])),
      ),
      arm = (k) => w.filter((_, i) => rows[i].a === k),
      w1 = arm(1),
      w0 = arm(0),
      sum = (v) => v.reduce((s, x) => s + x, 0);
    // Capping (truncation).
    const capAt = cap < 1 ? quantile(w, cap) : Infinity,
      wc = w.map((v) => Math.min(v, capAt));
    // Trimming.
    const keep = gh.map((p) => p >= a && p <= 1 - a),
      kr = rows.filter((_, i) => keep[i]),
      kw = w.filter((_, i) => keep[i]),
      kt = aipwTerms.filter((_, i) => keep[i]);
    // Overlap weights: 1 − ĝ for the treated, ĝ for controls.
    const ow = rows.map((r, i) => (r.a ? 1 - gh[i] : gh[i]));
    const aipw = sum(aipwTerms) / rows.length,
      se = Math.sqrt(
        sum(aipwTerms.map((v) => (v - aipw) ** 2)) / rows.length ** 2,
      );
    return {
      coef,
      gh,
      w,
      ipw: hajek(rows, w),
      ipwHT:
        sum(rows.map((r, i) => (r.a ? r.y * w[i] : -r.y * w[i]))) /
        rows.length,
      aipw,
      aipwSE: se,
      n1: w1.length,
      n0: w0.length,
      ess1: kish(w1),
      ess0: kish(w0),
      maxShare1: w1.length ? Math.max(...w1) / sum(w1) : NaN,
      maxShare0: w0.length ? Math.max(...w0) / sum(w0) : NaN,
      maxW: Math.max(...w),
      capAt,
      capped: hajek(rows, wc),
      nCapped: w.filter((v) => v > capAt).length,
      kept: kr.length,
      trimmedIPW: hajek(kr, kw),
      trimmedAIPW: kt.length ? sum(kt) / kt.length : NaN,
      overlap: hajek(rows, ow),
      essOverlap1: kish(ow.filter((_, i) => rows[i].a)),
      essOverlap0: kish(ow.filter((_, i) => !rows[i].a)),
    };
  }

  /* ---------- repeated samples ---------- */
  const KEYS = ["ipw", "aipw", "capped", "trimmedIPW", "trimmedAIPW", "overlap"];
  function describe(values, truth) {
    const v = values.filter(Number.isFinite),
      n = v.length,
      mu = v.reduce((s, x) => s + x, 0) / n,
      sd = Math.sqrt(v.reduce((s, x) => s + (x - mu) ** 2, 0) / (n - 1));
    return {
      mean: mu,
      bias: mu - truth,
      sd,
      rmse: Math.sqrt((mu - truth) ** 2 + sd * sd),
      mcse: sd / Math.sqrt(n),
      n,
    };
  }
  function repeated({
    beta,
    reps = 400,
    n = N,
    seed = 7,
    cap = 0.99,
    trim = 0.1,
    structural = false,
    cut = 1.5,
  }) {
    const random = core.rng(seed),
      est = Object.fromEntries(KEYS.map((k) => [k, []])),
      esses = [];
    for (let r = 0; r < reps; r++) {
      const rows = sample(beta, n, Math.floor(random() * 4294967295) + 1, {
          structural,
          cut,
        }),
        out = analyze(rows, { cap, trim });
      KEYS.forEach((k) => est[k].push(out[k]));
      esses.push(Math.min(out.ess1, out.ess0));
    }
    const trimT = trimmedTarget(beta, trim).value,
      ato = atoTarget(beta).value,
      targets = {
        ipw: ATE,
        aipw: ATE,
        capped: ATE,
        trimmedIPW: trimT,
        trimmedAIPW: trimT,
        overlap: ato,
      };
    return {
      config: { beta, reps, n, seed, cap, trim, structural, cut },
      targets,
      summary: Object.fromEntries(
        KEYS.map((k) => [
          k,
          { ...describe(est[k], targets[k]), vsATE: describe(est[k], ATE).bias },
        ]),
      ),
      medianMinESS: quantile(esses, 0.5),
    };
  }

  // The β grid for the repeated-sample figure, and the structural/practical comparison.
  const BETAS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4],
    SUPPORT_BETA = 2;
  function buildGrid() {
    const round = (x) => Math.round(x * 1e4) / 1e4,
      compact = (res) => ({
        beta: res.config.beta,
        n: res.config.n,
        medianMinESS: round(res.medianMinESS),
        ...Object.fromEntries(
          KEYS.map((k) => [
            k,
            {
              bias: round(res.summary[k].bias),
              sd: round(res.summary[k].sd),
              mcse: round(res.summary[k].mcse),
              vsATE: round(res.summary[k].vsATE),
            },
          ]),
        ),
      });
    return {
      sweep: BETAS.map((beta) =>
        compact(repeated({ beta, reps: 400, n: N, seed: 11 })),
      ),
      support: [500, 5000].flatMap((n) =>
        [false, true].map((structural) => ({
          structural,
          ...compact(
            repeated({ beta: SUPPORT_BETA, reps: 200, n, seed: 13, structural }),
          ),
        })),
      ),
    };
  }
  // Precomputed by buildGrid() (node: require('./science/positivity.js').buildGrid());
  // tests/positivity.test.cjs recomputes it and checks every number.
  const GRID = {"sweep":[{"beta":0,"n":500,"medianMinESS":241.5462,"ipw":{"bias":0.0002,"sd":0.1008,"mcse":0.005,"vsATE":0.0002},"aipw":{"bias":0,"sd":0.1009,"mcse":0.005,"vsATE":0},"capped":{"bias":0.0001,"sd":0.1009,"mcse":0.005,"vsATE":0.0001},"trimmedIPW":{"bias":0.0002,"sd":0.1008,"mcse":0.005,"vsATE":0.0002},"trimmedAIPW":{"bias":0,"sd":0.1009,"mcse":0.005,"vsATE":0},"overlap":{"bias":0.0001,"sd":0.1008,"mcse":0.005,"vsATE":0.0001}},{"beta":0.5,"n":500,"medianMinESS":202.0395,"ipw":{"bias":0.0095,"sd":0.1154,"mcse":0.0058,"vsATE":0.0095},"aipw":{"bias":0.0067,"sd":0.1065,"mcse":0.0053,"vsATE":0.0067},"capped":{"bias":0.0502,"sd":0.1089,"mcse":0.0054,"vsATE":0.0502},"trimmedIPW":{"bias":0.012,"sd":0.1138,"mcse":0.0057,"vsATE":0.0122},"trimmedAIPW":{"bias":0.0081,"sd":0.1062,"mcse":0.0053,"vsATE":0.0083},"overlap":{"bias":0.007,"sd":0.1046,"mcse":0.0052,"vsATE":0.0599}},{"beta":1,"n":500,"medianMinESS":139.375,"ipw":{"bias":0.0173,"sd":0.2194,"mcse":0.011,"vsATE":0.0173},"aipw":{"bias":0.0047,"sd":0.1173,"mcse":0.0059,"vsATE":0.0047},"capped":{"bias":0.1727,"sd":0.1486,"mcse":0.0074,"vsATE":0.1727},"trimmedIPW":{"bias":0.0137,"sd":0.1573,"mcse":0.0079,"vsATE":0.102},"trimmedAIPW":{"bias":0.0089,"sd":0.1144,"mcse":0.0057,"vsATE":0.0971},"overlap":{"bias":0.0068,"sd":0.1076,"mcse":0.0054,"vsATE":0.157}},{"beta":1.5,"n":500,"medianMinESS":87.984,"ipw":{"bias":0.0636,"sd":0.4896,"mcse":0.0245,"vsATE":0.0636},"aipw":{"bias":0.0061,"sd":0.1555,"mcse":0.0078,"vsATE":0.0061},"capped":{"bias":0.4031,"sd":0.2085,"mcse":0.0104,"vsATE":0.4031},"trimmedIPW":{"bias":0.0092,"sd":0.1813,"mcse":0.0091,"vsATE":0.2475},"trimmedAIPW":{"bias":0.0112,"sd":0.1276,"mcse":0.0064,"vsATE":0.2496},"overlap":{"bias":0.0123,"sd":0.1172,"mcse":0.0059,"vsATE":0.2478}},{"beta":2,"n":500,"medianMinESS":58.7557,"ipw":{"bias":0.1388,"sd":0.6555,"mcse":0.0328,"vsATE":0.1388},"aipw":{"bias":0.0082,"sd":0.2437,"mcse":0.0122,"vsATE":0.0082},"capped":{"bias":0.6512,"sd":0.2495,"mcse":0.0125,"vsATE":0.6512},"trimmedIPW":{"bias":0.0239,"sd":0.1921,"mcse":0.0096,"vsATE":0.3556},"trimmedAIPW":{"bias":0.0155,"sd":0.1346,"mcse":0.0067,"vsATE":0.3472},"overlap":{"bias":0.0139,"sd":0.121,"mcse":0.006,"vsATE":0.313}},{"beta":2.5,"n":500,"medianMinESS":37.8755,"ipw":{"bias":0.2347,"sd":0.7369,"mcse":0.0368,"vsATE":0.2347},"aipw":{"bias":0.0211,"sd":0.2837,"mcse":0.0142,"vsATE":0.0211},"capped":{"bias":0.9399,"sd":0.2677,"mcse":0.0134,"vsATE":0.9399},"trimmedIPW":{"bias":0.034,"sd":0.2005,"mcse":0.01,"vsATE":0.4192},"trimmedAIPW":{"bias":0.0202,"sd":0.1508,"mcse":0.0075,"vsATE":0.4054},"overlap":{"bias":0.0102,"sd":0.1314,"mcse":0.0066,"vsATE":0.3552}},{"beta":3,"n":500,"medianMinESS":29.6508,"ipw":{"bias":0.3883,"sd":0.8719,"mcse":0.0436,"vsATE":0.3883},"aipw":{"bias":0.0218,"sd":0.4764,"mcse":0.0238,"vsATE":0.0218},"capped":{"bias":1.2178,"sd":0.2993,"mcse":0.015,"vsATE":1.2178},"trimmedIPW":{"bias":0.0322,"sd":0.1921,"mcse":0.0096,"vsATE":0.4497},"trimmedAIPW":{"bias":0.0186,"sd":0.1549,"mcse":0.0077,"vsATE":0.4361},"overlap":{"bias":0.0104,"sd":0.1384,"mcse":0.0069,"vsATE":0.3885}},{"beta":3.5,"n":500,"medianMinESS":24.6967,"ipw":{"bias":0.6103,"sd":0.8805,"mcse":0.044,"vsATE":0.6103},"aipw":{"bias":-0.0095,"sd":0.3799,"mcse":0.019,"vsATE":-0.0095},"capped":{"bias":1.4774,"sd":0.2986,"mcse":0.0149,"vsATE":1.4774},"trimmedIPW":{"bias":0.0287,"sd":0.1976,"mcse":0.0099,"vsATE":0.4668},"trimmedAIPW":{"bias":0.0186,"sd":0.1661,"mcse":0.0083,"vsATE":0.4567},"overlap":{"bias":0.0126,"sd":0.1415,"mcse":0.0071,"vsATE":0.415}},{"beta":4,"n":500,"medianMinESS":24.1677,"ipw":{"bias":0.8647,"sd":0.8324,"mcse":0.0416,"vsATE":0.8647},"aipw":{"bias":-0.0026,"sd":0.4715,"mcse":0.0236,"vsATE":-0.0026},"capped":{"bias":1.7026,"sd":0.3002,"mcse":0.015,"vsATE":1.7026},"trimmedIPW":{"bias":0.022,"sd":0.2069,"mcse":0.0103,"vsATE":0.4739},"trimmedAIPW":{"bias":0.0182,"sd":0.1735,"mcse":0.0087,"vsATE":0.4701},"overlap":{"bias":0.0145,"sd":0.1474,"mcse":0.0074,"vsATE":0.435}}],"support":[{"structural":false,"beta":2,"n":500,"medianMinESS":52.8562,"ipw":{"bias":0.1104,"sd":0.7039,"mcse":0.0498,"vsATE":0.1104},"aipw":{"bias":-0.0033,"sd":0.2235,"mcse":0.0158,"vsATE":-0.0033},"capped":{"bias":0.6531,"sd":0.257,"mcse":0.0182,"vsATE":0.6531},"trimmedIPW":{"bias":0.0252,"sd":0.1958,"mcse":0.0138,"vsATE":0.3569},"trimmedAIPW":{"bias":0.0145,"sd":0.1422,"mcse":0.0101,"vsATE":0.3462},"overlap":{"bias":0.0098,"sd":0.1229,"mcse":0.0087,"vsATE":0.3089}},{"structural":true,"beta":2,"n":500,"medianMinESS":119.5549,"ipw":{"bias":0.5535,"sd":0.1862,"mcse":0.0132,"vsATE":0.5535},"aipw":{"bias":-0.0018,"sd":0.1258,"mcse":0.0089,"vsATE":-0.0018},"capped":{"bias":0.6471,"sd":0.1553,"mcse":0.011,"vsATE":0.6471},"trimmedIPW":{"bias":-0.0041,"sd":0.1612,"mcse":0.0114,"vsATE":0.3276},"trimmedAIPW":{"bias":-0.1268,"sd":0.1219,"mcse":0.0086,"vsATE":0.2049},"overlap":{"bias":0.1568,"sd":0.1072,"mcse":0.0076,"vsATE":0.4558}},{"structural":false,"beta":2,"n":5000,"medianMinESS":370.8021,"ipw":{"bias":0.0064,"sd":0.2963,"mcse":0.021,"vsATE":0.0064},"aipw":{"bias":0.0016,"sd":0.0716,"mcse":0.0051,"vsATE":0.0016},"capped":{"bias":0.636,"sd":0.0752,"mcse":0.0053,"vsATE":0.636},"trimmedIPW":{"bias":-0.0052,"sd":0.0566,"mcse":0.004,"vsATE":0.3265},"trimmedAIPW":{"bias":-0.0026,"sd":0.0451,"mcse":0.0032,"vsATE":0.329},"overlap":{"bias":-0.0031,"sd":0.0413,"mcse":0.0029,"vsATE":0.2959}},{"structural":true,"beta":2,"n":5000,"medianMinESS":1199.7395,"ipw":{"bias":0.5413,"sd":0.0583,"mcse":0.0041,"vsATE":0.5413},"aipw":{"bias":-0.001,"sd":0.0399,"mcse":0.0028,"vsATE":-0.001},"capped":{"bias":0.6334,"sd":0.0494,"mcse":0.0035,"vsATE":0.6334},"trimmedIPW":{"bias":-0.0035,"sd":0.0504,"mcse":0.0036,"vsATE":0.3282},"trimmedAIPW":{"bias":-0.1443,"sd":0.0405,"mcse":0.0029,"vsATE":0.1873},"overlap":{"bias":0.1441,"sd":0.0374,"mcse":0.0026,"vsATE":0.4432}}]};

  return {
    CENTER,
    N,
    SEED,
    ATE,
    BETAS,
    SUPPORT_BETA,
    KEYS,
    expit,
    logit,
    phi,
    Phi,
    g,
    gStructural,
    tau,
    m,
    integrate,
    trimInterval,
    trimmedTarget,
    atoTarget,
    targetDensity,
    draws,
    sample,
    fitLogistic,
    fitLine,
    kish,
    quantile,
    analyze,
    repeated,
    buildGrid,
    GRID,
  };
});
