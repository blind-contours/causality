/* For your trial: planning numbers for a covariate-adjusted randomized trial. Pure kernels, no DOM.
 *
 * The baseline covariates are summarized by one prognostic score X ~ N(0, 1): the part of the
 * outcome the prespecified working model can predict at baseline. R² is the share of the control
 * arm's outcome variance that score explains.
 *
 * Continuous endpoint: Y(0) = mu0 + sd·(√R² s(X) + √(1 − R²) e), Y(1) = Y(0) + delta.
 * Binary endpoint:     P(Y(0) = 1 | X) = expit(b0 + gamma·s(X)), P(Y(1) = 1 | X) = expit(b0 + gamma·s(X) + beta),
 *                      with b0, gamma chosen so P(Y(0) = 1) = p0 and Var m0(X) / (p0(1 − p0)) = R²,
 *                      and beta chosen so P(Y(1) = 1) = p1.
 * s(X) = √(1 − c)·X − √c·(X² − 1)/√2 has mean 0 and variance 1. c = 0 is the planned (linear)
 * world; c > 0 is the stress test in which a working model linear in X misses curvature.
 *
 * Asymptotic variance of n^{1/2}(estimate − truth), for the arm means (mu1, mu0):
 *   adjusted (the efficient estimator given X, which standardization with a correct working model attains)
 *     V11 = E[v1(X)]/pi + Var m1(X),  V00 = E[v0(X)]/(1 − pi) + Var m0(X),  V10 = Cov(m1(X), m0(X));
 *   unadjusted (difference of arm means)
 *     V11 = Var Y(1)/pi,  V00 = Var Y(0)/(1 − pi),  V10 = 0.
 * A contrast h(mu1, mu0) with gradient (c1, c0) has variance c1² V11 + c0² V00 + 2 c1 c0 V10.
 * Ratio measures are handled on the log scale, which is also how their intervals are built.
 */
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports ? require("./core.js") : root.CausalScience;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalTrial = api;
})(typeof self !== "undefined" ? self : globalThis, function (core) {
  "use strict";
  const { rng, randn } = core;
  const expit = (x) => 1 / (1 + Math.exp(-x));
  const logit = (p) => Math.log(p / (1 - p));

  /* Standard normal CDF (Zelen and Severo 26.2.17 via erf, |error| < 1e-7) and quantile (Acklam). */
  function pnorm(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z)),
      d = 0.3989422804014327 * Math.exp((-z * z) / 2),
      p =
        d *
        t *
        (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return z >= 0 ? 1 - p : p;
  }
  function qnorm(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239],
      b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
      c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783],
      d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const lo = 0.02425;
    let q, r;
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > 1 - lo) return -qnorm(1 - p);
    q = p - 0.5;
    r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  /* Quadrature over X ~ N(0, 1): a fine grid with normalized normal weights. */
  const GRID = (() => {
    const xs = [], ws = [];
    let tot = 0;
    for (let k = -1400; k <= 1400; k++) {
      const x = k / 200,
        w = Math.exp((-x * x) / 2);
      xs.push(x);
      ws.push(w);
      tot += w;
    }
    return { xs, ws: ws.map((w) => w / tot) };
  })();
  const E = (f) => {
    let s = 0;
    for (let i = 0; i < GRID.xs.length; i++) s += GRID.ws[i] * f(GRID.xs[i]);
    return s;
  };
  const shape = (x, c = 0) => Math.sqrt(1 - c) * x - (Math.sqrt(c) * (x * x - 1)) / Math.SQRT2;

  function bisect(f, lo, hi, it = 80) {
    let flo = f(lo);
    for (let i = 0; i < it; i++) {
      const mid = (lo + hi) / 2,
        fm = f(mid);
      if (fm === 0) return mid;
      if (fm > 0 === flo > 0) {
        lo = mid;
        flo = fm;
      } else hi = mid;
    }
    return (lo + hi) / 2;
  }

  const MEASURES = {
    md: { label: "difference in means", ratio: false },
    rd: { label: "risk difference", ratio: false },
    rr: { label: "risk ratio", ratio: true },
    or: { label: "odds ratio", ratio: true },
  };
  /* Contrast on its analysis scale (log for ratios) and its gradient in (mu1, mu0). */
  function contrast(measure, mu1, mu0) {
    switch (measure) {
      case "rr":
        return { value: Math.log(mu1 / mu0), c1: 1 / mu1, c0: -1 / mu0 };
      case "or":
        return { value: logit(mu1) - logit(mu0), c1: 1 / (mu1 * (1 - mu1)), c0: -1 / (mu0 * (1 - mu0)) };
      default:
        return { value: mu1 - mu0, c1: 1, c0: -1 };
    }
  }
  const natural = (measure, v) => (MEASURES[measure].ratio ? Math.exp(v) : v);

  /* A data-generating world. cfg: {endpoint, mu0, delta, sd, p0, p1, r2, curve}. */
  function world(cfg) {
    const c = { endpoint: "continuous", mu0: 0, delta: 0.3, sd: 1, p0: 0.3, p1: 0.2, r2: 0.3, curve: 0, ...cfg };
    const r2 = Math.min(0.95, Math.max(0, c.r2));
    if (c.endpoint === "continuous") {
      const a = c.sd * Math.sqrt(r2),
        v = c.sd * c.sd * (1 - r2);
      return {
        cfg: c,
        m0: (x) => c.mu0 + a * shape(x, c.curve),
        m1: (x) => c.mu0 + c.delta + a * shape(x, c.curve),
        v0: () => v,
        v1: () => v,
        draw(x, arm, random) {
          const m = c.mu0 + arm * c.delta + a * shape(x, c.curve);
          return m + Math.sqrt(v) * randn(random);
        },
      };
    }
    const p0 = c.p0,
      p1 = c.p1;
    // For a given gamma, b0 hits the control rate; gamma is then chosen to hit R².
    const b0For = (g) => bisect((b) => E((x) => expit(b + g * shape(x, c.curve))) - p0, -40, 40);
    const r2For = (g) => {
      const b = b0For(g),
        m = E((x) => expit(b + g * shape(x, c.curve))),
        v = E((x) => (expit(b + g * shape(x, c.curve)) - m) ** 2);
      return v / (p0 * (1 - p0));
    };
    const gamma = r2 <= 0 ? 0 : bisect((g) => r2For(g) - r2, 0, 60);
    const b0 = b0For(gamma);
    const beta = bisect((bt) => E((x) => expit(b0 + gamma * shape(x, c.curve) + bt)) - p1, -40, 40);
    const m0 = (x) => expit(b0 + gamma * shape(x, c.curve)),
      m1 = (x) => expit(b0 + gamma * shape(x, c.curve) + beta);
    return {
      cfg: c,
      b0,
      gamma,
      beta,
      m0,
      m1,
      v0: (x) => m0(x) * (1 - m0(x)),
      v1: (x) => m1(x) * (1 - m1(x)),
      draw(x, arm, random) {
        return random() < (arm ? m1(x) : m0(x)) ? 1 : 0;
      },
    };
  }

  function moments(w) {
    const mu1 = E(w.m1),
      mu0 = E(w.m0),
      var1 = E((x) => (w.m1(x) - mu1) ** 2),
      var0 = E((x) => (w.m0(x) - mu0) ** 2),
      cov = E((x) => (w.m1(x) - mu1) * (w.m0(x) - mu0)),
      ev1 = E(w.v1),
      ev0 = E(w.v0);
    return { mu1, mu0, var1, var0, cov, ev1, ev0 };
  }

  /* Per-participant asymptotic variance of the contrast, adjusted and unadjusted. */
  function asymptotic(w, measure, pi) {
    const m = moments(w),
      k = contrast(measure, m.mu1, m.mu0),
      q = (V11, V00, V10) => k.c1 * k.c1 * V11 + k.c0 * k.c0 * V00 + 2 * k.c1 * k.c0 * V10;
    return {
      ...m,
      effect: k.value,
      adjusted: q(m.ev1 / pi + m.var1, m.ev0 / (1 - pi) + m.var0, m.cov),
      unadjusted: q((m.ev1 + m.var1) / pi, (m.ev0 + m.var0) / (1 - pi), 0),
    };
  }

  /* Allocation k:1 (treatment:control) as a fraction treated. */
  const piOf = (ratio) => ratio / (ratio + 1);
  /* Total evaluable sample size, rounded up so both arms are whole and in the stated ratio. */
  function roundToRatio(n, ratio) {
    const block = ratio + 1;
    return Math.ceil(n / block) * block;
  }
  function nFor(V, effect, alpha, power) {
    const z = qnorm(1 - alpha / 2) + qnorm(power);
    return (z * z * V) / (effect * effect);
  }
  function powerAt(n, V, effect, alpha) {
    if (!effect) return alpha;
    const z = qnorm(1 - alpha / 2),
      s = Math.abs(effect) * Math.sqrt(n / V);
    return pnorm(s - z) + pnorm(-s - z);
  }

  const PLAN_DEFAULTS = Object.freeze({
    endpoint: "continuous",
    measure: "md",
    ratio: 1,
    alpha: 0.05,
    power: 0.9,
    mu0: 0,
    delta: 0.3,
    sd: 1,
    p0: 0.3,
    p1: 0.2,
    r2: 0.3,
    dropout: 0.1,
  });

  /* The planning table: evaluable and enrolled sample sizes, power buffers, and R² sensitivity. */
  function plan(input) {
    const c = { ...PLAN_DEFAULTS, ...input };
    if (c.endpoint === "continuous") c.measure = "md";
    else if (c.measure === "md") c.measure = "rd";
    const pi = piOf(c.ratio),
      w = world(c),
      a = asymptotic(w, c.measure, pi);
    if (!isFinite(a.effect) || Math.abs(a.effect) < 1e-12)
      return { ok: false, reason: "The planned effect is zero, so no sample size can power it.", cfg: c };
    const nU = roundToRatio(nFor(a.unadjusted, a.effect, c.alpha, c.power), c.ratio),
      nA = roundToRatio(nFor(a.adjusted, a.effect, c.alpha, c.power), c.ratio),
      inflate = (n) => roundToRatio(n / (1 - Math.min(0.9, Math.max(0, c.dropout))), c.ratio);
    // If the covariates turn out weaker than assumed, what power does the adjusted plan keep?
    const sensitivity = [1, 0.75, 0.5, 0.25, 0].map((f) => {
      const ww = world({ ...c, r2: c.r2 * f }),
        aa = asymptotic(ww, c.measure, pi);
      return { fraction: f, r2: c.r2 * f, power: powerAt(nA, aa.adjusted, aa.effect, c.alpha) };
    });
    return {
      ok: true,
      cfg: c,
      pi,
      truth: { mu1: a.mu1, mu0: a.mu0, effect: natural(c.measure, a.effect), scaleEffect: a.effect },
      variance: { adjusted: a.adjusted, unadjusted: a.unadjusted, ratio: a.adjusted / a.unadjusted },
      unadjusted: { evaluable: nU, enrolled: inflate(nU) },
      adjusted: { evaluable: nA, enrolled: inflate(nA) },
      saved: { evaluable: nU - nA, enrolled: inflate(nU) - inflate(nA), share: 1 - nA / nU },
      // Option A: size for the unadjusted analysis and let adjustment buy extra power.
      powerBuffer: powerAt(nU, a.adjusted, a.effect, c.alpha),
      // Power of each analysis at the adjusted sample size.
      powerAdjustedAtAdjusted: powerAt(nA, a.adjusted, a.effect, c.alpha),
      powerUnadjustedAtAdjusted: powerAt(nA, a.unadjusted, a.effect, c.alpha),
      sensitivity,
      world: w,
    };
  }

  /* ---------- Simulation of operating characteristics ---------- */

  function assign(n, pi, random) {
    const n1 = Math.round(n * pi),
      a = Array.from({ length: n }, (_, i) => (i < n1 ? 1 : 0));
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }
  function simulate(w, n, pi, random) {
    const a = assign(n, pi, random),
      x = new Array(n),
      y = new Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = randn(random);
      y[i] = w.draw(x[i], a[i], random);
    }
    return { x, a, y };
  }

  /* Two-parameter fits within one arm. Returns a prediction function over x. */
  function fitLinear(xs, ys) {
    const n = xs.length;
    let sx = 0, sy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i];
      sy += ys[i];
    }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) {
      sxx += (xs[i] - mx) ** 2;
      sxy += (xs[i] - mx) * (ys[i] - my);
    }
    const b = sxx > 1e-12 ? sxy / sxx : 0;
    return (x) => my + b * (x - mx);
  }
  function fitLogistic(xs, ys) {
    const n = xs.length;
    const ybar = ys.reduce((s, v) => s + v, 0) / n;
    if (ybar <= 0 || ybar >= 1) return { predict: () => ybar, separated: true };
    let b0 = logit(ybar), b1 = 0, separated = false;
    for (let it = 0; it < 30; it++) {
      let h00 = 0, h01 = 0, h11 = 0, g0 = 0, g1 = 0;
      for (let i = 0; i < n; i++) {
        const p = expit(b0 + b1 * xs[i]),
          wt = p * (1 - p),
          r = ys[i] - p;
        h00 += wt;
        h01 += wt * xs[i];
        h11 += wt * xs[i] * xs[i];
        g0 += r;
        g1 += r * xs[i];
      }
      const det = h00 * h11 - h01 * h01;
      if (!(det > 1e-10)) {
        separated = true;
        break;
      }
      const d0 = (h11 * g0 - h01 * g1) / det,
        d1 = (h00 * g1 - h01 * g0) / det;
      b0 += d0;
      b1 += d1;
      if (Math.abs(b1) > 25) {
        separated = true;
        break;
      }
      if (Math.abs(d0) + Math.abs(d1) < 1e-9) break;
    }
    if (separated) return { predict: () => ybar, separated: true };
    return { predict: (x) => expit(b0 + b1 * x), separated: false };
  }

  /* Standardization (g-computation) with a working model fitted separately in each arm, and its
   * influence-function standard error. adjusted = false uses intercept-only working models, which
   * gives the unadjusted difference in arm means with the usual Wald standard error.
   * Because each arm's working model has an intercept (canonical link), the arm residuals average
   * zero and this equals AIPW with the observed randomization fraction. */
  function analyze({ x, a, y }, endpoint, measure, adjusted) {
    const n = y.length,
      i1 = [], i0 = [];
    for (let i = 0; i < n; i++) (a[i] ? i1 : i0).push(i);
    const pi = i1.length / n,
      k = adjusted ? 2 : 1;
    const fit = (idx) => {
      const xs = idx.map((i) => x[i]),
        ys = idx.map((i) => y[i]);
      if (!adjusted) {
        const m = ys.reduce((s, v) => s + v, 0) / ys.length;
        return { predict: () => m, separated: false };
      }
      return endpoint === "continuous" ? { predict: fitLinear(xs, ys), separated: false } : fitLogistic(xs, ys);
    };
    const f1 = fit(i1),
      f0 = fit(i0);
    const m1 = x.map(f1.predict),
      m0 = x.map(f0.predict);
    let mu1 = 0, mu0 = 0, r1 = 0, r0 = 0;
    for (let i = 0; i < n; i++) {
      mu1 += m1[i];
      mu0 += m0[i];
      if (a[i]) r1 += y[i] - m1[i];
      else r0 += y[i] - m0[i];
    }
    mu1 = mu1 / n + r1 / n / pi;
    mu0 = mu0 / n + r0 / n / (1 - pi);
    const ratio = MEASURES[measure].ratio;
    if (ratio && (mu1 <= 0 || mu0 <= 0 || mu1 >= 1 || mu0 >= 1))
      return { failed: true, reason: "an arm estimate is 0 or 1" };
    const k2 = contrast(measure, mu1, mu0);
    const df1 = i1.length / Math.max(1, i1.length - k),
      df0 = i0.length / Math.max(1, i0.length - k);
    let ss = 0;
    for (let i = 0; i < n; i++) {
      const res1 = a[i] ? ((y[i] - m1[i]) / pi) * Math.sqrt(df1) : 0,
        res0 = a[i] ? 0 : ((y[i] - m0[i]) / (1 - pi)) * Math.sqrt(df0),
        phi = k2.c1 * (res1 + m1[i] - mu1) + k2.c0 * (res0 + m0[i] - mu0);
      ss += phi * phi;
    }
    const se = Math.sqrt(ss / n) / Math.sqrt(n);
    return {
      failed: false,
      separated: f1.separated || f0.separated,
      mu1,
      mu0,
      est: k2.value,
      se,
    };
  }

  /* Operating characteristics by simulation. Returns a runner so a page can do the work in slices.
   * Scenarios: "null" (no effect), "planned" (the planning world), "stress" (the true prognostic
   * relationship is curved, the prespecified working model stays linear; same R², p0, p1). */
  function ocRunner(input, { n, reps = 1000, seed = 20260929, alpha } = {}) {
    const c = { ...PLAN_DEFAULTS, ...input };
    if (c.endpoint === "continuous") c.measure = "md";
    else if (c.measure === "md") c.measure = "rd";
    const pi = piOf(c.ratio),
      a = alpha ?? c.alpha,
      z = qnorm(1 - a / 2),
      nullCfg = c.endpoint === "continuous" ? { ...c, delta: 0 } : { ...c, p1: c.p0 };
    const scenarios = [
      { key: "null", label: "No effect (type I error)", world: world(nullCfg) },
      { key: "planned", label: "Planned effect", world: world(c) },
      { key: "stress", label: "Planned effect, working model misses curvature", world: world({ ...c, curve: 0.6 }) },
    ].map((s) => {
      const t = asymptotic(s.world, c.measure, pi).effect;
      return { ...s, truth: t, results: { unadjusted: tally(), adjusted: tally() } };
    });
    function tally() {
      return { runs: 0, failed: 0, separated: 0, reject: 0, cover: 0, sum: 0, sum2: 0, sumSE: 0 };
    }
    const random = rng(seed);
    let done = 0;
    const total = reps * scenarios.length;
    function step(budget = 200) {
      while (done < total && budget-- > 0) {
        const s = scenarios[Math.floor(done / reps)];
        const data = simulate(s.world, n, pi, random);
        for (const which of ["unadjusted", "adjusted"]) {
          const r = analyze(data, c.endpoint, c.measure, which === "adjusted"),
            t = s.results[which];
          t.runs++;
          if (r.failed) {
            t.failed++;
            continue;
          }
          if (r.separated) t.separated++;
          const lo = r.est - z * r.se,
            hi = r.est + z * r.se,
            nullValue = 0; // on the analysis scale (log for ratios)
          if (lo > nullValue || hi < nullValue) t.reject++;
          if (lo <= s.truth && s.truth <= hi) t.cover++;
          t.sum += r.est;
          t.sum2 += r.est * r.est;
          t.sumSE += r.se;
        }
        done++;
      }
      return done >= total;
    }
    function results() {
      return scenarios.map((s) => ({
        key: s.key,
        label: s.label,
        truth: s.truth,
        truthNatural: natural(c.measure, s.truth),
        ...Object.fromEntries(
          ["unadjusted", "adjusted"].map((k) => {
            const t = s.results[k],
              ok = t.runs - t.failed,
              m = ok ? t.sum / ok : NaN,
              sd = ok > 1 ? Math.sqrt(Math.max(0, (t.sum2 - ok * m * m) / (ok - 1))) : NaN;
            return [
              k,
              {
                runs: t.runs,
                failed: t.failed,
                separated: t.separated,
                rejectRate: t.runs ? t.reject / t.runs : NaN,
                coverage: ok ? t.cover / ok : NaN,
                bias: m - s.truth,
                empiricalSD: sd,
                meanSE: ok ? t.sumSE / ok : NaN,
              },
            ];
          }),
        ),
      }));
    }
    return { step, results, progress: () => done / total, n, reps, cfg: c };
  }
  function operatingCharacteristics(input, opts) {
    const r = ocRunner(input, opts);
    while (!r.step(1e9));
    return r.results();
  }

  return {
    PLAN_DEFAULTS,
    MEASURES,
    pnorm,
    qnorm,
    shape,
    E,
    world,
    moments,
    asymptotic,
    contrast,
    natural,
    piOf,
    roundToRatio,
    nFor,
    powerAt,
    plan,
    simulate,
    analyze,
    fitLogistic,
    ocRunner,
    operatingCharacteristics,
  };
});
