/* Deterministic scientific kernels. No DOM, randomness supplied explicitly.
 * Probability arrays are masses; grid density arrays integrate using grid.dx.
 * P0 = truth, P = generic law, Ψ = target map, ψ0 = Ψ(P0). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalScience = api;
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => sum(a) / a.length;
  const variance = (a) => {
    const m = mean(a);
    return sum(a.map((x) => (x - m) ** 2)) / (a.length - 1);
  };
  const dot = (a, b) => sum(a.map((x, i) => x * b[i]));
  const inner = (a, b, p) => sum(a.map((x, i) => x * b[i] * p[i]));
  const expit = (x) => 1 / (1 + Math.exp(-x));
  const normal = (x, m = 0, s = 1) =>
    Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  function normalize(a) {
    const s = sum(a);
    if (!(s > 0) || a.some((x) => x < 0 || !Number.isFinite(x)))
      throw Error("Invalid probability mass");
    return a.map((x) => x / s);
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(random) {
    return (
      Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) *
      Math.cos(2 * Math.PI * random())
    );
  }
  function score(p, velocity) {
    if (Math.abs(sum(velocity)) > 1e-9 || p.some((x) => x <= 0))
      throw Error(
        "An interior probability and mass-conserving velocity are required",
      );
    return velocity.map((v, i) => v / p[i]);
  }
  function pathBounds(p, h) {
    let lo = -Infinity,
      hi = Infinity;
    h.forEach((x) => {
      if (x > 0) lo = Math.max(lo, -1 / x);
      if (x < 0) hi = Math.min(hi, -1 / x);
    });
    return [lo, hi];
  }
  function path(p, h, e) {
    if (
      Math.abs(
        inner(
          h,
          p.map(() => 1),
          p,
        ),
      ) > 1e-9
    )
      throw Error("Score must have weighted mean zero");
    const q = p.map((x, i) => x * (1 + e * h[i]));
    if (q.some((x) => x < -1e-12))
      throw Error("Path left the probability simplex");
    return q.map((x) => Math.max(0, x));
  }
  function project(d, basis, p) {
    const orth = [];
    for (const b of basis) {
      let v = b.slice();
      for (const u of orth) {
        const a = inner(v, u, p);
        v = v.map((x, i) => x - a * u[i]);
      }
      const n = Math.sqrt(inner(v, v, p));
      if (n > 1e-10) orth.push(v.map((x) => x / n));
    }
    return d.map((_, i) => sum(orth.map((u) => inner(d, u, p) * u[i])));
  }
  function geometry(p = [0.2, 0.5, 0.3], z = [-1, 0, 2]) {
    const mu = dot(p, z),
      d = z.map((x) => x - mu),
      h = [-1, 0, p[0] / p[2]],
      canonical = project(d, [h], p),
      residual = d.map((x, i) => x - canonical[i]);
    return {
      p,
      z,
      mu,
      d,
      h,
      canonical,
      residual,
      fullVariance: inner(d, d, p),
      restrictedVariance: inner(canonical, canonical, p),
    };
  }
  function grid(n = 481, min = -4, max = 4) {
    const dx = (max - min) / (n - 1),
      z = Array.from({ length: n }, (_, i) => min + i * dx),
      raw = z.map(
        (x) => 0.55 * normal(x, -0.4, 0.7) + 0.45 * normal(x, 1.6, 0.8),
      ),
      p = normalize(raw).map((x) => x / dx);
    return {
      z,
      p,
      dx,
      mean: sum(z.map((x, i) => x * p[i] * dx)),
      mass: sum(p) * dx,
    };
  }
  function centerGrid(h, p, dx) {
    const m = (dot(h, p) * dx) / (sum(p) * dx);
    return h.map((x) => x - m);
  }
  function gaussianTilt(mu, sigma, epsilon, H) {
    return {
      mean: mu + epsilon * H * sigma * sigma,
      sd: sigma,
      score: (y) => H * (y - mu),
    };
  }
  function gaussianTarget(y, m, h, weights = null) {
    const r = y.map((v, i) => v - m[i]),
      den = dot(h, h),
      epsilon = den ? dot(h, r) / den : 0,
      updated = m.map((v, i) => v + epsilon * h[i]);
    return {
      epsilon,
      updated,
      score: mean(updated.map((v, i) => h[i] * (y[i] - v))),
      shift: weights
        ? dot(
            updated.map((v, i) => v - m[i]),
            weights,
          )
        : mean(updated.map((v, i) => v - m[i])),
    };
  }
  function ateRemainder(g0, gh, m10, mh1, m00, mh0, p) {
    return sum(
      p.map(
        (w, i) =>
          w *
          (gh[i] - g0[i]) *
          ((mh1[i] - m10[i]) / gh[i] + (mh0[i] - m00[i]) / (1 - gh[i])),
      ),
    );
  }
  // One synthetic study: X=high severity (35%), confounded treatment, ATE=2.
  const prevalence = 0.35;
  const trueG = (x) => expit(-0.8 + 1.6 * x);
  const trueM = (x, a) =>
    0.5 + x + 0.6 * x * x + a * (2 + 0.4 * (x - prevalence));
  function generate(n, random) {
    return Array.from({ length: n }, () => {
      const x = +(random() < prevalence),
        a = +(random() < trueG(x));
      return { x, a, y: trueM(x, a) + 0.8 * randn(random) };
    });
  }
  function solve(A, b) {
    const n = b.length,
      M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let k = c + 1; k < n; k++)
        if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-12) throw Error("Singular design");
      const v = M[c][c];
      for (let j = c; j <= n; j++) M[c][j] /= v;
      for (let k = 0; k < n; k++) {
        if (k === c) continue;
        const f = M[k][c];
        for (let j = c; j <= n; j++) M[k][j] -= f * M[c][j];
      }
    }
    return M.map((r) => r[n]);
  }
  function regression(data, correct) {
    const features = (x, a) => (correct ? [1, x, a, a * x] : [1, a]),
      k = correct ? 4 : 2,
      A = Array.from({ length: k }, () => Array(k).fill(0)),
      b = Array(k).fill(0);
    for (const r of data) {
      const v = features(r.x, r.a);
      for (let i = 0; i < k; i++) {
        b[i] += v[i] * r.y;
        for (let j = 0; j < k; j++) A[i][j] += v[i] * v[j];
      }
    }
    for (let i = 0; i < k; i++) A[i][i] += 1e-8;
    const beta = solve(A, b);
    return (x, a) => dot(beta, features(x, a));
  }
  /* A second study for the inference lab: the same target (ATE = 2) with a continuous severity
   * score X ~ Uniform(0, 1), strong confounding, and a jump in the outcome at X = 0.6 that a
   * straight line cannot follow. Its outcome learner is k-nearest neighbours within each arm;
   * with k = 1 and no cross-fitting every patient is its own nearest neighbour. */
  const smoothG = (x) => expit(-2 + 4 * x);
  const smoothM = (x, a) =>
    0.5 + x + 0.6 * x * x + (x > 0.6 ? 1.2 : 0) + a * (2 + 0.4 * (x - 0.5));
  function generateSmooth(n, random) {
    return Array.from({ length: n }, () => {
      const x = random(),
        a = +(random() < smoothG(x));
      return { x, a, y: smoothM(x, a) + 0.8 * randn(random) };
    });
  }
  // Average of the k training outcomes in arm a whose x is closest (ties: the larger x first).
  function knn(train, k) {
    const arms = [0, 1].map((a) =>
      train.filter((r) => r.a === a).sort((p, q) => p.x - q.x),
    );
    return (x, a) => {
      const arr = arms[a];
      if (!arr.length) throw Error("An arm has no training patients");
      let lo = 0,
        hi = arr.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (arr[m].x < x) lo = m + 1;
        else hi = m;
      }
      let i = lo - 1,
        j = lo,
        s = 0,
        c = 0;
      while (c < k && (i >= 0 || j < arr.length)) {
        if (j >= arr.length || (i >= 0 && x - arr[i].x < arr[j].x - x))
          s += arr[i--].y;
        else s += arr[j++].y;
        c++;
      }
      return s / c;
    };
  }
  // Main-terms logistic regression of A on (1, X) by Newton-Raphson; correctly specified here.
  function logistic(train) {
    let b = [0, 0];
    for (let it = 0; it < 30; it++) {
      const g = [0, 0],
        H = [
          [1e-9, 0],
          [0, 1e-9],
        ];
      for (const r of train) {
        const v = [1, r.x],
          p = expit(b[0] + b[1] * r.x);
        for (let i = 0; i < 2; i++) {
          g[i] += v[i] * (r.a - p);
          for (let j = 0; j < 2; j++) H[i][j] += v[i] * v[j] * p * (1 - p);
        }
      }
      const step = solve(H, g);
      b = [b[0] + step[0], b[1] + step[1]];
      if (Math.abs(step[0]) + Math.abs(step[1]) < 1e-10) break;
    }
    return (x) => expit(b[0] + b[1] * x);
  }
  // Nonparametric bound for the continuous study, in closed form:
  // E[0.64(1/g + 1/(1−g))] = 0.64(2 + sinh 2) and Var τ(X) = 0.16/12.
  const smoothVariance = () => 0.64 * (2 + Math.sinh(2)) + 0.16 / 12;
  function nuisance(data, config) {
    if (config.study === "smooth") {
      if (config.mode === "oracle") return { m: smoothM, g: smoothG };
      const g = logistic(data);
      return {
        m: knn(data, Math.max(1, Math.round(config.k || 1))),
        g: (x) => Math.max(0.02, Math.min(0.98, g(x))),
      };
    }
    const goodM = ["both", "outcome"].includes(config.preset),
      goodG = ["both", "propensity"].includes(config.preset);
    if (config.mode === "oracle")
      return {
        m: goodM ? trueM : (x, a) => 0.7 + 0.8 * a,
        g: goodG ? trueG : () => 0.5,
      };
    const m = regression(data, goodM),
      counts = [0, 0],
      treated = [0, 0];
    for (const r of data) {
      counts[r.x]++;
      treated[r.x] += r.a;
    }
    const pooled = (sum(treated) + 0.5) / (data.length + 1),
      gs = counts.map((n, i) => (treated[i] + 0.5) / (n + 1));
    return {
      m,
      g: (x) => Math.max(0.02, Math.min(0.98, goodG ? gs[x] : pooled)),
    };
  }
  function estimate(data, config) {
    const K = config.crossfit && config.mode !== "oracle" ? 2 : 1,
      values = [],
      contrasts = [];
    for (let k = 0; k < K; k++) {
      const train = K === 1 ? data : data.filter((_, i) => i % K !== k),
        fit = nuisance(train, config);
      data.forEach((r, i) => {
        if (K > 1 && i % K !== k) return;
        const m1 = fit.m(r.x, 1),
          m0 = fit.m(r.x, 0),
          g = fit.g(r.x),
          c = m1 - m0;
        contrasts[i] = c;
        values[i] =
          c + (r.a / g) * (r.y - m1) - ((1 - r.a) / (1 - g)) * (r.y - m0);
      });
    }
    const plugin = mean(contrasts),
      aipw = mean(values),
      se = Math.sqrt(variance(values) / data.length);
    return { plugin, aipw, se, values, contrasts };
  }
  function efficiencyVariance() {
    return sum(
      [0, 1].map((x) => {
        const p = x ? prevalence : 1 - prevalence,
          g = trueG(x),
          tau = trueM(x, 1) - trueM(x, 0);
        return p * (0.64 * (1 / g + 1 / (1 - g)) + (tau - 2) ** 2);
      }),
    );
  }
  function summarize(estimates, n, boundVariance = efficiencyVariance()) {
    const describe = (a) => {
      const bias = mean(a) - 2,
        sd = Math.sqrt(variance(a));
      return {
        bias,
        sd,
        rmse: Math.sqrt(mean(a.map((x) => (x - 2) ** 2))),
        biasMCSE: sd / Math.sqrt(a.length),
      };
    };
    const coverage = mean(
      estimates.map((r) => +(Math.abs(r.aipw - 2) <= 1.96 * r.se)),
    );
    return {
      plugin: describe(estimates.map((r) => r.plugin)),
      aipw: describe(estimates.map((r) => r.aipw)),
      meanSE: mean(estimates.map((r) => r.se)),
      coverage,
      coverageMCSE: Math.sqrt((coverage * (1 - coverage)) / estimates.length),
      boundSE: Math.sqrt(boundVariance / n),
    };
  }
  function simulation(config, onProgress = () => {}) {
    const random = rng(config.seed),
      smooth = config.study === "smooth",
      draw = smooth ? generateSmooth : generate,
      results = [];
    for (let i = 0; i < config.reps; i++) {
      const { plugin, aipw, se } = estimate(draw(config.n, random), config);
      results.push({ plugin, aipw, se });
      if (i % 25 === 0) onProgress(i);
    }
    return {
      config: { ...config },
      results,
      summary: summarize(
        results,
        config.n,
        smooth ? smoothVariance() : efficiencyVariance(),
      ),
    };
  }
  function histogram(values, bins = 24, domain = null) {
    let [min, max] = domain || [Math.min(...values), Math.max(...values)];
    if (max - min < 1e-9) {
      min -= 0.5;
      max += 0.5;
    }
    const pad = domain ? 0 : (max - min) * 0.04;
    min -= pad;
    max += pad;
    const counts = Array(bins).fill(0);
    let underflow = 0,
      overflow = 0;
    for (const x of values) {
      if (x < min) {
        underflow++;
        continue;
      }
      if (x > max) {
        overflow++;
        continue;
      }
      counts[
        Math.min(bins - 1, Math.floor(((x - min) / (max - min)) * bins))
      ]++;
    }
    return {
      min,
      max,
      counts,
      underflow,
      overflow,
      total: sum(counts) + underflow + overflow,
    };
  }
  function km(rows, tau) {
    const data = rows.slice().sort((a, b) => a.time - b.time);
    let risk = data.length,
      s = 1,
      last = 0,
      rmst = 0;
    const points = [[0, 1]];
    for (let i = 0; i < data.length; ) {
      const t = data[i].time;
      if (t > tau) break;
      let d = 0,
        c = 0;
      while (i < data.length && data[i].time === t) {
        data[i].event ? d++ : c++;
        i++;
      }
      rmst += s * (t - last);
      s *= 1 - d / risk;
      risk -= d + c;
      points.push([t, s]);
      last = t;
    }
    rmst += s * (tau - last);
    points.push([tau, s]);
    return {
      s,
      rmst,
      points,
      n: data.length,
      support: data.length > 0 && (s === 0 || data.some((r) => r.time >= tau)),
    };
  }
  function survival(config) {
    const random = rng(config.seed),
      tau = config.tau,
      lambda = (x, a) => (x ? 0.32 : 0.08) * (a ? 0.65 : 1),
      rows = Array.from({ length: config.n }, () => {
        const x = +(random() < prevalence),
          a = +(random() < trueG(x)),
          eventTime = -Math.log(Math.max(random(), 1e-12)) / lambda(x, a),
          rate = config.censor === 0 ? 0 : 0.04 * Math.exp(config.censor * x),
          censorTime = rate
            ? -Math.log(Math.max(random(), 1e-12)) / rate
            : Infinity;
        return {
          x,
          a,
          time: Math.min(eventTime, censorTime),
          event: eventTime <= censorTime,
        };
      });
    const arms = [0, 1].map((a) => {
      const naive = km(
          rows.filter((r) => r.a === a),
          tau,
        ),
        strata = [0, 1].map((x) =>
          km(
            rows.filter((r) => r.a === a && r.x === x),
            tau,
          ),
        ),
        p = mean(rows.map((r) => r.x)),
        weights = [1 - p, p],
        truthS = (t) =>
          sum(
            [0, 1].map(
              (x) =>
                (x ? prevalence : 1 - prevalence) * Math.exp(-lambda(x, a) * t),
            ),
          ),
        trueRMST = sum(
          [0, 1].map(
            (x) =>
              ((x ? prevalence : 1 - prevalence) *
                -Math.expm1(-lambda(x, a) * tau)) /
              lambda(x, a),
          ),
        );
      return {
        naive,
        strata,
        standardizedRMST: dot(
          strata.map((s) => s.rmst),
          weights,
        ),
        standardizedS: (t) =>
          dot(
            strata.map((s) => s.points.filter((v) => v[0] <= t).at(-1)[1]),
            weights,
          ),
        truthS,
        trueRMST,
      };
    });
    return {
      rows,
      arms,
      censored: mean(rows.map((r) => +!r.event)),
      conditionalHR: 0.65,
    };
  }
  function mixtureTilt(components, epsilon, center = 0) {
    const logs = components.map(
        (c) =>
          Math.log(c.weight) +
          epsilon * (c.mean - center) +
          0.5 * epsilon * epsilon * c.sd * c.sd,
      ),
      max = Math.max(...logs),
      weights = normalize(logs.map((l) => Math.exp(l - max))),
      logNorm = max + Math.log(sum(logs.map((l) => Math.exp(l - max)))),
      means = components.map((c) => c.mean + epsilon * c.sd * c.sd);
    return {
      logNorm,
      weights,
      mean: dot(weights, means),
      density: (z) =>
        sum(components.map((c, i) => weights[i] * normal(z, means[i], c.sd))),
    };
  }
  function landscapeTarget(initial, sampleMean, curvature, fixed = false) {
    const psi = (t) =>
      2 +
      0.9 * t[0] +
      0.5 * t[1] +
      curvature * (0.6 * t[0] ** 2 - 0.7 * t[0] * t[1] + 0.2 * t[1] ** 2);
    const grad = (t) => [
      0.9 + curvature * (1.2 * t[0] - 0.7 * t[1]),
      0.5 + curvature * (-0.7 * t[0] + 0.4 * t[1]),
    ];
    const path = [initial.slice()];
    let theta = initial.slice();
    for (let k = 0; k < (fixed ? 1 : 80); k++) {
      const g = grad(theta),
        score = dot(
          g,
          sampleMean.map((v, i) => v - theta[i]),
        );
      if (Math.abs(score) < 1e-10) break;
      const epsilon = score / dot(g, g);
      theta = theta.map((v, i) => v + epsilon * g[i]);
      path.push(theta.slice());
    }
    return {
      path,
      theta,
      value: psi(theta),
      score: dot(
        grad(theta),
        sampleMean.map((v, i) => v - theta[i]),
      ),
      oneStep:
        psi(initial) +
        dot(
          grad(initial),
          sampleMean.map((v, i) => v - initial[i]),
        ),
    };
  }
  function binaryTarget(y, m, h) {
    const logits = m.map((p) => Math.log(p / (1 - p)));
    let epsilon = 0;
    for (let k = 0; k < 100; k++) {
      const q = logits.map((l, i) => expit(l + epsilon * h[i])),
        score = sum(q.map((p, i) => h[i] * (y[i] - p))),
        information = sum(q.map((p, i) => h[i] * h[i] * p * (1 - p)));
      if (Math.abs(score) < 1e-10 || information < 1e-12) break;
      epsilon += Math.max(-5, Math.min(5, score / information));
    }
    const updated = logits.map((l, i) => expit(l + epsilon * h[i]));
    return {
      epsilon,
      updated,
      score: mean(updated.map((p, i) => h[i] * (y[i] - p))),
    };
  }
  /* Toy regression deck for the cross-fitting figure: n patients with a continuous
   * covariate x in (0,1), sorted by x, outcome = smooth curve + noise. */
  function toyCurve(n, random) {
    const rows = Array.from({ length: n }, (_, i) => {
      const x = Math.max(
        0.02,
        Math.min(0.98, (i + 0.5) / n + ((0.3 * (random() - 0.5)) / n) * 2),
      );
      return {
        x,
        y: 1 + 0.5 * x + 0.8 * Math.sin(3.2 * x) + 0.35 * randn(random),
      };
    });
    return rows.sort((a, b) => a.x - b.x);
  }
  /* Piecewise-linear interpolant through sorted points {x,y}; constant beyond the ends.
   * A learner that memorises: it reproduces every training outcome exactly. */
  function interpolate(points, x) {
    if (!points.length) return NaN;
    if (x <= points[0].x) return points[0].y;
    const last = points[points.length - 1];
    if (x >= last.x) return last.y;
    let k = 1;
    while (points[k].x < x) k++;
    const a = points[k - 1],
      b = points[k],
      f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
    return a.y + f * (b.y - a.y);
  }
  /* Ordinary least squares line y = a + b x through points {x,y}. */
  function linearFit(points) {
    const mx = mean(points.map((p) => p.x)),
      my = mean(points.map((p) => p.y)),
      sxx = sum(points.map((p) => (p.x - mx) ** 2)),
      sxy = sum(points.map((p) => (p.x - mx) * (p.y - my))),
      b = sxx > 0 ? sxy / sxx : 0;
    return { a: my - b * mx, b };
  }
  /* Power-law nuisance errors along a rate path: error_j = scale * (n / n0)^(-rate_j).
   * Returns both errors, the rectangle area (the |R2| bound with constant one),
   * the sampling band c / sqrt(n), and sqrt(n) * area. */
  /* Observed-data support for the adjusted contrast is separate from causal identification.
   * computable: the adjustment functional exists in the observed law for the chosen target.
   * identified: computable AND the causal assumptions hold, so it equals the causal target. */
  function identification({ target, gHigh, gLow = trueG(0), p = prevalence, exchange, consistent }) {
    const w = [1 - p, p], g = [gLow, gHigh];
    const selected = w.map((v, i) => v * (target === "att" ? g[i] : target === "atc" ? 1 - g[i] : 1));
    const computable = sum(selected) > 0 && selected.every((v, i) =>
      v === 0 || (target === "att" ? g[i] < 1 : target === "atc" ? g[i] > 0 : g[i] > 0 && g[i] < 1));
    return {
      computable,
      identified: computable && !!exchange && !!consistent,
    };
  }
  /* Moving point Q(t) = D + t(D* − D) between a gradient and its projection.
   * kept + lost = total − cross, with cross = 2t(1−t)‖D−D*‖²; equality only at t ∈ {0,1}. */
  function projectionSplit(d, dstar, t, p) {
    const q = d.map((v, i) => v + t * (dstar[i] - v)),
      r = d.map((v, i) => v - dstar[i]),
      w = (a, b) => (p ? inner(a, b, p) : dot(a, b));
    const total = w(d, d),
      kept = w(q, q),
      lost = w(
        d.map((v, i) => v - q[i]),
        d.map((v, i) => v - q[i]),
      ),
      cross = 2 * t * (1 - t) * w(r, r);
    return { q, total, kept, lost, cross };
  }
  /* Product boundary in the (propensity error, outcome error) plane. */
  function productInside(eg, em, band) {
    return eg * em <= band + 1e-12;
  }
  function ratePath(
    n,
    {
      alpha,
      beta,
      scale = 0.5,
      n0 = 100,
      c = 2.5,
      exactG = false,
      exactM = false,
    } = {},
  ) {
    const eg = exactG ? 0 : scale * (n / n0) ** -beta,
      em = exactM ? 0 : scale * (n / n0) ** -alpha,
      area = eg * em;
    return {
      n,
      eg,
      em,
      area,
      band: c / Math.sqrt(n),
      scaled: Math.sqrt(n) * area,
      c,
    };
  }
  return {
    sum,
    mean,
    variance,
    dot,
    inner,
    expit,
    normal,
    normalize,
    rng,
    randn,
    score,
    pathBounds,
    path,
    project,
    geometry,
    grid,
    centerGrid,
    gaussianTilt,
    gaussianTarget,
    ateRemainder,
    prevalence,
    trueG,
    trueM,
    generate,
    smoothG,
    smoothM,
    generateSmooth,
    knn,
    logistic,
    smoothVariance,
    nuisance,
    estimate,
    efficiencyVariance,
    summarize,
    simulation,
    histogram,
    km,
    survival,
    landscapeTarget,
    binaryTarget,
    mixtureTilt,
    toyCurve,
    interpolate,
    linearFit,
    ratePath,
    identification,
    projectionSplit,
    productInside,
  };
});
