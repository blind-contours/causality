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
  function mount(root) {
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
