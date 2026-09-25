/* Reusable repeated-sampling experiment. Each result owns its run configuration. */
(function () {
  const { S, V, store, control, table, fmt } = CausalLab;
  const A = window.CausalAnim;
  const pending = new Map();
  /* Run fn(u) for u in [0,1] over ms milliseconds, one tween per key; without the kit
   * (or under reduced motion) jump to the end. */
  function animate(key, fn, ms) {
    pending.get(key)?.cancel();
    if (!A) return fn(1);
    pending.set(key, A.tween({ duration: ms, ease: A.ease.out, onUpdate: fn }));
  }
  /* Coverage caterpillar: the first min(60, reps) AIPW intervals, sorted by estimate. */
  function caterpillar(svg, label, results) {
    const rows = results
        .slice(0, Math.min(60, results.length))
        .map((x) => ({
          est: x.aipw,
          lo: x.aipw - 1.96 * x.se,
          hi: x.aipw + 1.96 * x.se,
        }))
        .sort((a, b) => a.est - b.est),
      m = rows.length,
      truth = 2,
      lo = Math.min(truth, ...rows.map((r) => r.lo)),
      hi = Math.max(truth, ...rows.map((r) => r.hi)),
      pad = Math.max(0.05, (hi - lo) * 0.04),
      W = 600,
      Hh = Math.max(180, Math.min(340, 40 + m * 5)),
      Lm = 40,
      Rm = 18,
      Tm = 34,
      Bm = 44,
      sx = (v) => Lm + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (W - Lm - Rm),
      sy = (i) => Tm + ((i + 0.5) / m) * (Hh - Tm - Bm),
      NS = "http://www.w3.org/2000/svg",
      mk = (tag, attrs) => {
        const e = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        return e;
      };
    svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    svg.replaceChildren();
    const ticks = A ? A.ticks(lo - pad, hi + pad, 6) : [lo, truth, hi];
    ticks.forEach((v) => {
      svg.append(
        mk("line", {
          class: "grid",
          x1: sx(v),
          x2: sx(v),
          y1: Tm,
          y2: Hh - Bm,
        }),
      );
      const t = mk("text", {
        class: "tick",
        x: sx(v),
        y: Hh - Bm + 16,
        "text-anchor": "middle",
      });
      t.textContent = Number(v.toFixed(3)).toString();
      svg.append(t);
    });
    svg.append(
      mk("line", {
        class: "axis",
        x1: Lm,
        x2: W - Rm,
        y1: Hh - Bm,
        y2: Hh - Bm,
      }),
      mk("line", { class: "axis", x1: Lm, x2: Lm, y1: Tm, y2: Hh - Bm }),
    );
    const xl = mk("text", {
      class: "axis-label",
      x: (Lm + W - Rm) / 2,
      y: Hh - 10,
      "text-anchor": "middle",
    });
    xl.textContent =
      "AIPW estimate ± 1.96 · SE, one row per repeated sample (sorted)";
    const yl = mk("text", { class: "axis-label", x: Lm, y: Tm - 8 });
    yl.textContent = "first " + m + " samples";
    const tl = mk("text", {
      class: "ref-label",
      x: sx(truth),
      y: Tm - 8,
      "text-anchor": "middle",
    });
    tl.textContent = "truth = 2";
    tl.setAttribute("fill", "var(--ink)");
    const counter = mk("text", {
      class: "fig-text ink",
      x: W - Rm - 4,
      y: Tm - 8,
      "text-anchor": "end",
    });
    svg.append(xl, yl, tl, counter);
    const lines = rows.map((r, i) => {
      const covers = r.lo <= truth && truth <= r.hi,
        g = mk("g", { opacity: 0 }),
        seg = mk("line", {
          x1: sx(r.est),
          x2: sx(r.est),
          y1: sy(i),
          y2: sy(i),
          stroke: covers ? "var(--green)" : "var(--red)",
          "stroke-width": 2.2,
          "stroke-linecap": "round",
        }),
        dot = mk("circle", {
          cx: sx(r.est),
          cy: sy(i),
          r: 2.2,
          fill: covers ? "var(--green)" : "var(--red)",
        });
      g.append(seg, dot);
      svg.append(g);
      return { g, seg, r, covers };
    });
    svg.append(
      mk("line", {
        class: "mark-ref",
        x1: sx(truth),
        x2: sx(truth),
        y1: Tm,
        y2: Hh - Bm,
        stroke: "var(--ink)",
      }),
    );
    const total = lines.filter((l) => l.covers).length;
    animate(
      "intervals",
      (u) => {
        let shown = 0,
          k = 0;
        lines.forEach((l, i) => {
          const f = Math.max(0, Math.min(1, u * m - i));
          l.g.setAttribute("opacity", f > 0 ? 1 : 0);
          l.seg.setAttribute("x1", sx(l.r.est - (l.r.est - l.r.lo) * f));
          l.seg.setAttribute("x2", sx(l.r.est + (l.r.hi - l.r.est) * f));
          if (f > 0) {
            shown++;
            if (l.covers) k++;
          }
        });
        counter.textContent = `${k} of ${shown} cover`;
        label.textContent =
          `${k} of ${shown} intervals shown cover the truth` +
          (shown === m
            ? ` (${fmt((100 * total) / m, 1)}% of these ${m}; the table reports coverage over all ${results.length} samples).`
            : ".");
      },
      1500,
    );
  }
  /* ---------- Grid layout: every case of one study side by side ----------
   * <div data-simulation="one-step" data-layout="grid"> shows the four nuisance cases as a
   * 2 × 2 grid; data-simulation="crossfit" shows the continuous study with cross-fitting off
   * and on. Every case uses the same seed, so the cases see the same simulated data sets. */
  const VARIANTS = {
    "one-step": {
      heading: "Four nuisance cases, one population",
      intro:
        "ATE = 2 in an asymmetric, confounded population: high severity occurs in 35% of people, and treatment and outcome both depend on it. Each panel repeats the whole study under one nuisance case.",
      defaults: { mode: "fitted", crossfit: true, n: 400, reps: 300, seed: 20260919 },
      axes: { rows: "Outcome model", cols: "Propensity model", labels: ["right", "wrong"] },
      cases: [
        { id: "both", title: "Outcome right, propensity right", short: "Both right", patch: { preset: "both" } },
        { id: "outcome", title: "Outcome right, propensity wrong", short: "Outcome only right", patch: { preset: "outcome" } },
        { id: "propensity", title: "Outcome wrong, propensity right", short: "Propensity only right", patch: { preset: "propensity" } },
        { id: "neither", title: "Outcome wrong, propensity wrong", short: "Both wrong", patch: { preset: "neither" } },
      ],
      spec: `<p>X is Bernoulli(0.35), g₀(x)=expit(−0.8+1.6x), and Y=0.5+x+0.6x²+A[2+0.4(x−0.35)]+N(0,0.8²). The correctly specified fitted outcome regression includes 1, X, A, AX; the misspecified one includes only 1, A. Fitted g uses smoothed treatment proportions within X, or a pooled proportion when misspecified. Estimated propensities are clipped to [0.02, 0.98].</p><p>Oracle mode supplies the true functions, or fixed wrong functions m(x,a)=0.7+0.8a and g(x)=0.5. It isolates nuisance correctness; fitted mode also includes nuisance-estimation uncertainty. Cross-fitting is irrelevant for supplied functions. An oracle plug-in uses supplied truth, so it is not a regular estimator in the full unknown-nuisance model; its SD can be below the bound without contradicting efficiency theory.</p>`,
    },
    crossfit: {
      heading: "A flexible outcome learner, with and without cross-fitting",
      intro:
        "The same target, ATE = 2, now with a continuous severity score. Treatment is strongly confounded by severity, and outcomes jump at severity 0.6, so a straight line will not do: the outcome model is k-nearest neighbours within each arm. Both panels analyse the same simulated data sets.",
      defaults: { k: 1, mode: "fitted", n: 400, reps: 300, seed: 20260919 },
      study: "smooth",
      intervals: true,
      cases: [
        { id: "off", title: "Cross-fitting off: fit and evaluate on the same patients", short: "Cross-fitting off", patch: { crossfit: false } },
        { id: "on", title: "Cross-fitting on: two folds, each predicted by the other", short: "Cross-fitting on", patch: { crossfit: true } },
      ],
      spec: `<p>X is Uniform(0, 1), g₀(x)=expit(−2+4x), and Y=0.5+x+0.6x²+1.2·1{x>0.6}+A[2+0.4(x−0.5)]+N(0,0.8²), so the ATE is exactly 2. The outcome model averages the k nearest outcomes within the same arm. The propensity model is a correctly specified logistic regression of A on X, clipped to [0.02, 0.98]. Without cross-fitting, a patient is its own nearest neighbour, so with k = 1 its own-arm residual Y − m̂ is exactly zero.</p><p>Oracle mode supplies the true m and g, so there is nothing to cross-fit and the two panels agree. The efficient bound here is 0.64(2 + sinh 2) + 0.16/12 ≈ 3.61 in variance units, exact.</p>`,
    },
  };
  function mountGrid(root) {
    const name = root.dataset.simulation,
      V0 = VARIANTS[name],
      NS = "http://www.w3.org/2000/svg",
      mk = (tag, attrs = {}, text) => {
        const e = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        if (text != null) e.textContent = text;
        return e;
      },
      state = store("simulation-" + name, V0.defaults, {
        mode: ["fitted", "oracle"],
        k: [1, 50],
        n: [80, 2000],
        reps: [20, 2000],
        seed: [1, 4294967295],
      }),
      has = (key) => key in V0.defaults,
      f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "undefined"),
      pct = (x) => (100 * x).toFixed(1) + "%";
    if (!document.getElementById("simgrid-style")) {
      const st = document.createElement("style");
      st.id = "simgrid-style";
      st.textContent = `
.simgrid-controls{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:flex-end;margin:14px 0 10px}
.simgrid-controls>label{flex:1 1 140px;min-width:0;margin:0}
.simgrid-controls>label.wide{flex:2 1 300px}
.simgrid-controls>label.check{flex:1 1 230px;display:flex;align-items:center;gap:8px;min-height:44px}
.simgrid-controls>label.check input{width:22px;height:22px;flex:none}
.simgrid-legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:14px;color:var(--muted);margin:14px 0 8px}
.simgrid-legend i{display:inline-block;width:18px;height:10px;margin-right:6px;vertical-align:-1px;border-radius:2px}
.simgrid{display:grid;gap:14px;grid-template-columns:repeat(var(--cols),minmax(0,1fr))}
.simgrid.axes{grid-template-columns:28px repeat(var(--cols),minmax(0,1fr))}
.simgrid .ax{font:600 13px/1.3 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);align-self:end;text-align:center}
.simgrid .ax.row{writing-mode:vertical-rl;transform:rotate(180deg);align-self:center;justify-self:center}
.simgrid .ax.corner{visibility:hidden}
.sim-cell{margin:0;border:1px solid var(--rule);border-radius:10px;padding:12px 14px 10px;background:var(--paper);min-width:0}
.sim-cell .cell-title{font-weight:600;font-size:14.5px;line-height:1.3;margin:0 0 6px}
.sim-cell .cell-cov{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 4px}
.sim-cell .cov{font:600 34px/1 "Fraunces",Georgia,serif;font-variant-numeric:tabular-nums;color:var(--ink)}
.sim-cell .cov.bad{color:var(--red)}
.sim-cell .cov-lab{font-size:13.5px;color:var(--muted)}
.sim-cell .cell-stats{font:13px/1.5 "IBM Plex Mono",ui-monospace,monospace;color:var(--muted);margin:6px 0 0;font-variant-numeric:tabular-nums}
.sim-cell .cell-stats b{color:var(--ink);font-weight:500}
.sim-cell svg{width:100%;height:auto;display:block;overflow:visible}
.sim-cell svg text{font:13px "IBM Plex Mono",ui-monospace,monospace;fill:var(--muted)}
.sim-cell svg text.truth{fill:var(--green)}
.sim-cell .pending{font-size:14px;color:var(--muted);min-height:120px;display:flex;align-items:center}
@media (max-width:640px){.simgrid,.simgrid.axes{grid-template-columns:minmax(0,1fr)}.simgrid .ax{display:none}}`;
      document.head.append(st);
    }
    const ctl = [];
    if (has("k"))
      ctl.push(
        `<label class="wide">Outcome learner <select data-key="k"><option value="1">1 nearest neighbour (memorises)</option><option value="5">5 nearest neighbours</option><option value="25">25 nearest neighbours</option></select></label>`,
      );
    ctl.push(
      `<label class="wide">What is supplied? <select data-key="mode"><option value="fitted">Fit nuisances from each sample</option><option value="oracle">Oracle reference: fixed true or wrong functions</option></select></label>`,
    );
    if (has("crossfit"))
      ctl.push(
        `<label class="check"><input type="checkbox" data-key="crossfit"> Two-fold cross-fitting for fitted nuisances</label>`,
      );
    ctl.push(
      `<label>Sample size <input data-key="n" type="number" min="80" max="2000" step="20"></label><label>Repeated samples per case <input data-key="reps" type="number" min="20" max="2000" step="20"></label><label>Seed <input data-key="seed" type="number" min="1" max="4294967295" step="1"></label>`,
    );
    const ax = V0.axes,
      cols = 2,
      cellsHTML = V0.cases
        .map(
          (c) =>
            `<figure class="sim-cell" data-case="${c.id}"><figcaption class="cell-title">${c.title}</figcaption><div class="cell-cov"><strong class="cov">…</strong><span class="cov-lab">AIPW 95% interval coverage</span></div><svg class="cell-hist" role="img" aria-label="Histogram of plug-in and AIPW estimates for this case, with the true ATE marked. Numbers are in the table below the grid."></svg>${V0.intervals ? `<svg class="cell-int" role="img" aria-label="The first 40 AIPW intervals for this case, sorted by estimate, green when they cover the true ATE and red otherwise."></svg>` : ""}<p class="cell-stats"></p></figure>`,
        ),
      gridHTML = ax
        ? `<div class="simgrid axes" style="--cols:${cols}"><span class="ax corner"></span>${ax.labels.map((l) => `<span class="ax">${ax.cols} ${l}</span>`).join("")}<span class="ax row">${ax.rows} ${ax.labels[0]}</span>${cellsHTML[0]}${cellsHTML[1]}<span class="ax row">${ax.rows} ${ax.labels[1]}</span>${cellsHTML[2]}${cellsHTML[3]}</div>`
        : `<div class="simgrid" style="--cols:${cols}">${cellsHTML.join("")}</div>`;
    root.innerHTML = `<h3>${V0.heading}</h3><p>${V0.intro}</p><div class="simgrid-controls">${ctl.join("")}</div><div class="btns"><button class="run primary">Run experiment</button><button class="cancel" disabled>Cancel</button><button class="download" disabled>Download estimates (CSV)</button></div><p class="sim-status" role="status">Running the default experiment in a background worker…</p><p class="run-config"></p><p class="simgrid-legend"><span><i style="background:var(--or);opacity:.55"></i>plug-in estimates</span><span><i style="border:2px solid var(--purple)"></i>AIPW (one-step) estimates</span><span><i style="border-top:2px dashed var(--green);height:0;border-radius:0"></i>true ATE = 2</span></p>${gridHTML}<p class="note simgrid-note">Histogram heights are scaled within each panel; the horizontal axis is shared, so positions and spreads compare across panels. <span class="mc"></span></p><div class="sim-results"></div><details><summary>Exact histogram counts and simulation specification</summary><div class="hist-table"></div>${V0.spec}<p>AIPW intervals are estimate ± 1.96 × the empirical influence-function standard error. Plug-in bias, SD and RMSE are reported without borrowing AIPW's standard error. The bound is the nonparametric efficiency bound at the true law.</p></details>`;
    root
      .querySelectorAll("[data-key]")
      .forEach((el) => control(el, state, el.dataset.key));
    const status = root.querySelector(".sim-status"),
      run = root.querySelector(".run"),
      cancel = root.querySelector(".cancel"),
      download = root.querySelector(".download");
    let workers = [],
      result = null;
    const configuration = (c) =>
      `Displayed run: ${has("k") ? `k = ${c.k} nearest neighbour${c.k > 1 ? "s" : ""}; ` : ""}${c.mode === "oracle" ? "oracle functions" : "fitted nuisances"}; ${has("crossfit") ? (c.crossfit && c.mode === "fitted" ? "2 folds; " : "no cross-fitting; ") : ""}n = ${c.n}; ${c.reps} samples per case; seed ${c.seed}.`;
    const sync = () => {
      const c = state.get(),
        cf = root.querySelector("[data-key=crossfit]");
      if (cf) cf.disabled = c.mode === "oracle";
      if (result)
        root.querySelector(".run-config").textContent =
          configuration(result.config) +
          (JSON.stringify(c) === JSON.stringify(result.config)
            ? ""
            : " Controls changed: press Run to compare. The panels keep this configuration until then.");
    };
    state.subscribe(sync);
    function stop() {
      workers.forEach((w) => w.terminate());
      workers = [];
      run.disabled = false;
      cancel.disabled = true;
    }
    /* Mini histogram: plug-in filled orange, AIPW purple outline, truth dashed green. */
    function drawHist(svg, r, domain, animateIt) {
      const W = Math.max(260, Math.round(svg.clientWidth || 320)),
        H = 150,
        L = 8,
        R = W - 8,
        T = 22,
        B = H - 26,
        bins = 30,
        sx = (v) => L + ((v - domain[0]) / (domain[1] - domain[0])) * (R - L),
        ha = S.histogram(r.results.map((x) => x.plugin), bins, domain),
        hb = S.histogram(r.results.map((x) => x.aipw), bins, domain),
        max = Math.max(...ha.counts, ...hb.counts, 1),
        bw = (R - L) / bins;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.replaceChildren();
      const ticks = (A ? A.ticks(domain[0], domain[1], W < 360 ? 4 : 6) : [2]).filter(
        (v) => v >= domain[0] && v <= domain[1],
      );
      ticks.forEach((v) => {
        svg.append(
          mk("line", { x1: sx(v), x2: sx(v), y1: T, y2: B, stroke: "var(--grid)" }),
          mk("text", { x: sx(v), y: B + 17, "text-anchor": "middle" }, Number(v.toFixed(2)).toString()),
        );
      });
      svg.append(mk("line", { x1: L, x2: R, y1: B, y2: B, stroke: "var(--muted)" }));
      const bars = [];
      ha.counts.forEach((count, i) => {
        const a = mk("rect", {
            x: L + i * bw + 0.5,
            y: B,
            width: Math.max(0, bw - 1),
            height: 0,
            fill: "var(--or)",
            "fill-opacity": 0.62,
          }),
          b = mk("rect", {
            x: L + i * bw + 1,
            y: B,
            width: Math.max(0, bw - 2),
            height: 0,
            fill: "none",
            stroke: "var(--purple)",
            "stroke-width": 1.8,
          });
        svg.append(a, b);
        bars.push([a, ((B - T) * count) / max], [b, ((B - T) * hb.counts[i]) / max]);
      });
      const x2 = sx(2);
      svg.append(
        mk("line", { x1: x2, x2: x2, y1: T - 4, y2: B, stroke: "var(--green)", "stroke-width": 2, "stroke-dasharray": "5 4" }),
        mk("text", { class: "truth", x: x2, y: T - 8, "text-anchor": x2 > W - 60 ? "end" : x2 < 60 ? "start" : "middle" }, "truth 2"),
      );
      const grow = (u) =>
        bars.forEach(([rect, h]) => {
          rect.setAttribute("y", B - h * u);
          rect.setAttribute("height", h * u);
        });
      if (animateIt) animate("grid-" + name + svg.parentNode.dataset.case, grow, 1200);
      else grow(1);
    }
    /* First 40 AIPW intervals, sorted, on the shared axis. */
    function drawIntervals(svg, r, domain) {
      const rows = r.results
          .slice(0, 40)
          .map((x) => ({ e: x.aipw, lo: x.aipw - 1.96 * x.se, hi: x.aipw + 1.96 * x.se }))
          .sort((a, b) => a.e - b.e),
        W = Math.max(260, Math.round(svg.clientWidth || 320)),
        H = 150,
        L = 8,
        R = W - 8,
        T = 8,
        B = H - 22,
        sx = (v) => L + ((Math.max(domain[0], Math.min(domain[1], v)) - domain[0]) / (domain[1] - domain[0])) * (R - L),
        sy = (i) => T + ((i + 0.5) / rows.length) * (B - T);
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.replaceChildren();
      const k = rows.filter((q) => q.lo <= 2 && 2 <= q.hi).length;
      rows.forEach((q, i) => {
        const ok = q.lo <= 2 && 2 <= q.hi;
        svg.append(
          mk("line", { x1: sx(q.lo), x2: sx(q.hi), y1: sy(i), y2: sy(i), stroke: ok ? "var(--green)" : "var(--red)", "stroke-width": 2, "stroke-linecap": "round" }),
        );
      });
      svg.append(
        mk("line", { x1: sx(2), x2: sx(2), y1: T, y2: B, stroke: "var(--ink)", "stroke-width": 1.2, "stroke-dasharray": "3 3" }),
        mk("text", { x: L, y: H - 4 }, W < 400 ? `first 40: ${k} cover, ${rows.length - k} miss` : `first 40 intervals: ${k} cover (green), ${rows.length - k} miss (red)`),
      );
    }
    function domainOf(r) {
      const all = r.cases.flatMap((c) => c.results.flatMap((x) => [x.plugin, x.aipw])).concat([2]),
        lo = Math.min(...all),
        hi = Math.max(...all),
        pad = Math.max(0.05, (hi - lo) * 0.04);
      return [lo - pad, hi + pad];
    }
    function paint(animateIt) {
      if (!result) return;
      const domain = domainOf(result);
      result.cases.forEach((c) => {
        const cell = root.querySelector(`[data-case="${c.id}"]`);
        drawHist(cell.querySelector(".cell-hist"), c, domain, animateIt);
        if (V0.intervals) drawIntervals(cell.querySelector(".cell-int"), c, domain);
      });
    }
    function render(r) {
      result = r;
      root.querySelector(".run-config").textContent = configuration(r.config);
      root.querySelector(".simgrid-note .mc").textContent = ` A coverage of exactly 95% would still wobble by about ±${(196 * Math.sqrt((0.95 * 0.05) / r.config.reps)).toFixed(1)} percentage points with ${r.config.reps} samples.`;
      r.cases.forEach((c) => {
        const cell = root.querySelector(`[data-case="${c.id}"]`),
          s = c.summary,
          cov = cell.querySelector(".cov");
        cov.textContent = pct(s.coverage);
        cov.classList.toggle("bad", s.coverage < 0.9);
        cell.querySelector(".cov-lab").textContent =
          "AIPW 95% interval coverage" +
          (s.coverage < 0.9 ? ": far too low" : s.coverage > 0.985 ? ": intervals too wide" : "");
        cell.querySelector(".cell-stats").innerHTML =
          `bias: plug-in <b>${f3(s.plugin.bias)}</b>, AIPW <b>${f3(s.aipw.bias)}</b><br>AIPW spread: SD <b>${f3(s.aipw.sd)}</b>, mean SE <b>${f3(s.meanSE)}</b>`;
      });
      paint(true);
      root.querySelector(".sim-results").innerHTML = table(
        ["Case", "Plug-in bias", "AIPW bias", "AIPW empirical SD", "Mean IF-based SE", "95% coverage (MC SE)", "Efficient bound SE"],
        r.cases.map((c) => {
          const s = c.summary;
          return [
            c.short || c.title,
            f3(s.plugin.bias),
            f3(s.aipw.bias),
            f3(s.aipw.sd),
            f3(s.meanSE),
            `${pct(s.coverage)} (± ${(100 * s.coverageMCSE).toFixed(1)})`,
            f3(s.boundSE),
          ];
        }),
        "Results for every case",
      );
      const domain = domainOf(r),
        hs = r.cases.map((c) => [
          S.histogram(c.results.map((x) => x.plugin), 30, domain),
          S.histogram(c.results.map((x) => x.aipw), 30, domain),
        ]);
      root.querySelector(".hist-table").innerHTML = table(
        ["Bin lower edge", ...r.cases.flatMap((c) => [c.id + " plug-in", c.id + " AIPW"])],
        hs[0][0].counts.map((_, i) => [
          fmt(domain[0] + (i * (domain[1] - domain[0])) / 30),
          ...hs.flatMap(([a, b]) => [a.counts[i], b.counts[i]]),
        ]),
        "Every simulated estimate is included; total per estimator = " + r.config.reps,
      );
      download.disabled = false;
      status.textContent = "Finished. Compare bias, sampling spread, and coverage across the panels.";
    }
    function start() {
      stop();
      const config = state.get();
      for (const key of ["n", "reps", "seed", "k"])
        if (key in config) config[key] = Math.round(config[key]);
      if (V0.study) config.study = V0.study;
      run.disabled = true;
      cancel.disabled = false;
      download.disabled = true;
      status.textContent = "Running in a background worker…";
      const done = new Array(V0.cases.length).fill(null),
        progress = new Array(V0.cases.length).fill(0);
      try {
        V0.cases.forEach((c, i) => {
          const w = new Worker("../science/simulation-worker.js");
          workers.push(w);
          w.onmessage = ({ data }) => {
            if (data.type === "progress") {
              progress[i] = data.n;
              status.textContent = `Completed ${progress.reduce((a, b) => a + b, 0)} of ${config.reps * V0.cases.length} repeated samples.`;
            }
            if (data.type === "result") {
              done[i] = { id: c.id, title: c.title, short: c.short, ...data.result };
              if (done.every(Boolean)) {
                stop();
                const { study, ...shown } = config;
                render({ config: shown, cases: done });
              }
            }
            if (data.type === "error") {
              stop();
              status.textContent = "Simulation failed: " + data.message;
            }
          };
          w.onerror = () => {
            stop();
            status.textContent =
              "Could not start the worker. The course must be served over HTTP (for example npm run serve), not opened as a file.";
          };
          w.postMessage({ ...config, ...c.patch });
        });
      } catch (error) {
        stop();
        status.textContent = "Could not start the worker: " + error.message;
      }
    }
    run.onclick = start;
    cancel.onclick = () => {
      stop();
      status.textContent =
        "Run cancelled. Any displayed results are from the earlier completed configuration.";
    };
    window.addEventListener("pagehide", stop);
    download.onclick = () => {
      if (!result) return;
      const rows = [
        "# " + configuration(result.config),
        "case,repeat,plugin,aipw,aipw_se",
        ...result.cases.flatMap((c) =>
          c.results.map((r, i) => [c.id, i + 1, r.plugin, r.aipw, r.se].join(",")),
        ),
      ];
      const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" })),
        a = document.createElement("a");
      a.href = url;
      a.download = "causality-simulation-" + name + "-" + result.config.seed + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    let lastW = 0;
    if (window.ResizeObserver)
      new ResizeObserver(() => {
        const w = root.querySelector(".cell-hist")?.clientWidth || 0;
        if (w && Math.abs(w - lastW) > 2) {
          lastW = w;
          paint(false);
        }
      }).observe(root);
    CausalLab.tools(root, state);
    sync();
    // Alive on arrival: run the default configuration straight away (a fraction of a second).
    start();
  }
  function mount(root) {
    if (root.dataset.layout === "grid" && VARIANTS[root.dataset.simulation])
      return mountGrid(root);
    const name = root.dataset.simulation || "ate",
      state = store(
        "simulation-" + name,
        {
          preset: "both",
          mode: "fitted",
          crossfit: true,
          n: 400,
          reps: 300,
          seed: 20260919,
        },
        {
          preset: ["both", "outcome", "propensity", "neither"],
          mode: ["fitted", "oracle"],
          n: [80, 2000],
          reps: [20, 2000],
          seed: [1, 4294967295],
        },
      );
    let worker = null,
      result = null;
    root.innerHTML = `<div class="lab-grid"><div><h3>One target, four nuisance cases</h3><p>ATE = 2 in an asymmetric, confounded population. High severity occurs in 35% of people. Treatment and outcome both depend on severity.</p><label>Nuisance specification <select data-key="preset"><option value="both">Outcome and propensity correctly specified</option><option value="outcome">Only outcome correctly specified</option><option value="propensity">Only propensity correctly specified</option><option value="neither">Both misspecified</option></select></label><label>What is supplied? <select data-key="mode"><option value="fitted">Fit nuisances from each sample</option><option value="oracle">Oracle reference: fixed true or wrong functions</option></select></label><label><span><input type="checkbox" data-key="crossfit"> Two-fold cross-fitting for fitted nuisances</span></label><label>Sample size <input data-key="n" type="number" min="80" max="2000" step="20"></label><label>Repeated samples <input data-key="reps" type="number" min="20" max="2000" step="20"></label><label>Seed <input data-key="seed" type="number" min="1" max="4294967295" step="1"></label><div class="btns"><button class="run primary">Run experiment</button><button class="cancel" disabled>Cancel</button><button class="download" disabled>Download estimates (CSV)</button></div><p class="sim-status" role="status">Choose a case and predict what its bias and spread will be.</p></div><div><p class="run-config"></p><svg class="histogram" viewBox="0 0 600 300" role="img" aria-label="Histogram of plug-in and AIPW estimates. Bin counts and statistics are provided in the tables below."></svg><p class="legend"><span style="color:var(--muted)">Solid gray: plug-in</span><span style="color:var(--purple)">Purple outline: AIPW</span><span>Dashed line: true ATE = 2</span></p><svg class="intervals fig" role="img" aria-label="The first repeated samples as horizontal 95% intervals, sorted by estimate, green when covering the true ATE and red otherwise. The count is stated beside the figure."></svg><p class="intervals-label" role="status"></p><div class="sim-results"></div></div></div><details><summary>Exact histogram counts and simulation specification</summary><div class="hist-table"></div><p>X is Bernoulli(0.35), g₀(x)=expit(−0.8+1.6x), and Y=0.5+x+0.6x²+A[2+0.4(x−0.35)]+N(0,0.8²). The correctly specified fitted outcome includes 1, X, A, AX; its misspecified version includes only 1, A. Fitted g uses smoothed treatment proportions within X, or a pooled proportion when misspecified. Estimated propensities are clipped to [0.02,0.98].</p><p>Oracle mode supplies the true functions, or fixed wrong functions m(x,a)=0.7+0.8a and g(x)=0.5. It isolates nuisance correctness; fitted mode also includes nuisance-estimation uncertainty. Cross-fitting is irrelevant for supplied functions.</p><p>AIPW intervals use its empirical influence-function standard error. Coverage is a diagnostic, particularly with misspecified fitted nuisances; double robustness of the point estimator alone does not guarantee valid inference. Plug-in bias, SD and RMSE are reported without borrowing AIPW's standard error. The bound is the nonparametric efficiency bound at the true law. An oracle plug-in uses supplied truth, so it is not a regular estimator in the full unknown-nuisance model; its SD can be below that model's bound without contradicting efficiency theory.</p></details>`;
    root
      .querySelectorAll("[data-key]")
      .forEach((el) => control(el, state, el.dataset.key));
    const status = root.querySelector(".sim-status"),
      run = root.querySelector(".run"),
      cancel = root.querySelector(".cancel");
    state.subscribe(() => {
      const c = state.get();
      root.querySelector("[data-key=crossfit]").disabled = c.mode === "oracle";
      if (result)
        root.querySelector(".run-config").textContent =
          configuration(result.config) +
          " Controls changed? Rerun to compare; the displayed result retains this configuration.";
    });
    function configuration(c) {
      return `Displayed run: ${c.preset}; ${c.mode}; ${c.crossfit && c.mode === "fitted" ? "2 folds" : "no cross-fitting"}; n=${c.n}; ${c.reps} samples; seed=${c.seed}.`;
    }
    function stop() {
      worker?.terminate();
      worker = null;
      run.disabled = false;
      cancel.disabled = true;
    }
    function render(r) {
      result = r;
      root.querySelector(".run-config").textContent = configuration(r.config);
      const a = r.results.map((x) => x.plugin),
        b = r.results.map((x) => x.aipw),
        combined = [...a, ...b, 2],
        lo = Math.min(...combined),
        hi = Math.max(...combined),
        pad = Math.max(0.1, (hi - lo) * 0.05),
        domain = [lo - pad, hi + pad],
        ha = S.histogram(a, 24, domain),
        hb = S.histogram(b, 24, domain),
        max = Math.max(...ha.counts, ...hb.counts, 1),
        svg = root.querySelector(".histogram");
      V.plot(svg, [], {
        xmin: domain[0],
        xmax: domain[1],
        ymin: 0,
        ymax: max,
        xlabel: "Estimate",
        ylabel: "Count",
      });
      const L = 56,
        W = 524,
        B = 246,
        H = 222,
        bw = W / 24;
      const bars = [];
      ha.counts.forEach((count, i) => {
        const a = V.svg("rect", {
            x: L + i * bw + 1,
            y: B,
            width: bw - 2,
            height: 0,
            fill: "var(--muted)",
            "fill-opacity": 0.5,
          }),
          b = V.svg("rect", {
            x: L + i * bw + 1,
            y: B,
            width: bw - 2,
            height: 0,
            fill: "none",
            stroke: "var(--purple)",
            "stroke-width": 2,
          });
        svg.append(a, b);
        bars.push([a, (H * count) / max], [b, (H * hb.counts[i]) / max]);
      });
      const grow = (u) =>
        bars.forEach(([rect, h]) => {
          rect.setAttribute("y", B - h * u);
          rect.setAttribute("height", h * u);
        });
      animate("bars", grow, 1500);
      caterpillar(
        root.querySelector(".intervals"),
        root.querySelector(".intervals-label"),
        r.results,
      );
      const x2 = L + (W * (2 - domain[0])) / (domain[1] - domain[0]);
      svg.append(
        V.svg("path", {
          d: `M${x2},24V246`,
          stroke: "var(--ink)",
          "stroke-width": 2,
          "stroke-dasharray": "5 4",
        }),
      );
      const s = r.summary;
      root.querySelector(".sim-results").innerHTML = table(
        ["Metric", "Plug-in", "AIPW"],
        [
          ["Bias", fmt(s.plugin.bias), fmt(s.aipw.bias)],
          ["Bias Monte Carlo SE", fmt(s.plugin.biasMCSE), fmt(s.aipw.biasMCSE)],
          ["Empirical SD", fmt(s.plugin.sd), fmt(s.aipw.sd)],
          ["RMSE", fmt(s.plugin.rmse), fmt(s.aipw.rmse)],
          ["Mean estimated SE", "Not reported", fmt(s.meanSE)],
          [
            "95% interval coverage",
            "Not reported",
            fmt(s.coverage * 100, 1) + "%",
          ],
          [
            "Coverage Monte Carlo SE",
            "—",
            fmt(s.coverageMCSE * 100, 1) + " percentage points",
          ],
          ["Efficient bound SE", fmt(s.boundSE), fmt(s.boundSE)],
        ],
        "Repeated-sampling results; Monte Carlo SE measures simulation uncertainty",
      );
      root.querySelector(".hist-table").innerHTML = table(
        ["Bin lower edge", "Plug-in count", "AIPW count"],
        ha.counts.map((v, i) => [
          fmt(domain[0] + (i * (domain[1] - domain[0])) / 24),
          v,
          hb.counts[i],
        ]),
        "Every simulated estimate is included; total per estimator = " +
          r.results.length,
      );
      root.querySelector(".download").disabled = false;
      status.textContent =
        "Finished. Compare bias, sampling spread, and coverage separately.";
    }
    run.onclick = () => {
      stop();
      const config = state.get();
      for (const key of ["n", "reps", "seed"])
        config[key] = Math.round(config[key]);
      run.disabled = true;
      cancel.disabled = false;
      status.textContent = "Running in a background worker…";
      try {
        worker = new Worker("../science/simulation-worker.js");
        worker.onmessage = ({ data }) => {
          if (data.type === "progress")
            status.textContent = `Completed ${data.n} of ${config.reps} repeated samples.`;
          if (data.type === "result") {
            stop();
            render(data.result);
          }
          if (data.type === "error") {
            stop();
            status.textContent = "Simulation failed: " + data.message;
          }
        };
        worker.onerror = () => {
          stop();
          status.textContent =
            "Could not start the worker. The course must be served over HTTP (for example npm run serve), not opened as a file.";
        };
        worker.postMessage(config);
      } catch (error) {
        stop();
        status.textContent = "Could not start the worker: " + error.message;
      }
    };
    cancel.onclick = () => {
      stop();
      status.textContent =
        "Run cancelled. Any displayed results are from the earlier completed configuration.";
    };
    window.addEventListener("pagehide", stop);
    root.querySelector(".download").onclick = () => {
      if (!result) return;
      const rows = [
        "# " + configuration(result.config),
        "repeat,plugin,aipw,aipw_se",
        ...result.results.map((r, i) =>
          [i + 1, r.plugin, r.aipw, r.se].join(","),
        ),
      ];
      const url = URL.createObjectURL(
          new Blob([rows.join("\n")], { type: "text/csv" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = "causality-simulation-" + result.config.seed + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    CausalLab.tools(root, state);
  }
  window.CausalSimulation = { mount };
  document.querySelectorAll("[data-simulation]").forEach(mount);
})();
