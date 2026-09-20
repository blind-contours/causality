/* Reusable repeated-sampling experiment. Each result owns its run configuration. */
(function () {
  const { S, V, store, control, table, fmt } = CausalLab;
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
    root.innerHTML = `<div class="lab-grid"><div><h3>One target, four nuisance cases</h3><p>ATE = 2 in an asymmetric, confounded population. High severity occurs in 35% of people. Treatment and outcome both depend on severity.</p><label>Nuisance specification <select data-key="preset"><option value="both">Outcome and propensity correctly specified</option><option value="outcome">Only outcome correctly specified</option><option value="propensity">Only propensity correctly specified</option><option value="neither">Both misspecified</option></select></label><label>What is supplied? <select data-key="mode"><option value="fitted">Fit nuisances from each sample</option><option value="oracle">Oracle reference: fixed true or wrong functions</option></select></label><label><span><input type="checkbox" data-key="crossfit"> Two-fold cross-fitting for fitted nuisances</span></label><label>Sample size <input data-key="n" type="number" min="80" max="2000" step="20"></label><label>Repeated samples <input data-key="reps" type="number" min="20" max="2000" step="20"></label><label>Seed <input data-key="seed" type="number" min="1" max="4294967295" step="1"></label><div class="btns"><button class="run primary">Run experiment</button><button class="cancel" disabled>Cancel</button><button class="download" disabled>Download estimates (CSV)</button></div><p class="sim-status" role="status">Choose a case and predict what its bias and spread will be.</p></div><div><p class="run-config"></p><svg class="histogram" viewBox="0 0 600 300" role="img" aria-label="Histogram of plug-in and AIPW estimates. Bin counts and statistics are provided in the tables below."></svg><p class="legend"><span style="color:var(--muted)">Solid gray: plug-in</span><span style="color:var(--purple)">Purple outline: AIPW</span><span>Dashed line: true ATE = 2</span></p><div class="sim-results"></div></div></div><details><summary>Exact histogram counts and simulation specification</summary><div class="hist-table"></div><p>X is Bernoulli(0.35), g₀(x)=expit(−0.8+1.6x), and Y=0.5+x+0.6x²+A[2+0.4(x−0.35)]+N(0,0.8²). The correctly specified fitted outcome includes 1, X, A, AX; its misspecified version includes only 1, A. Fitted g uses smoothed treatment proportions within X, or a pooled proportion when misspecified. Estimated propensities are clipped to [0.02,0.98].</p><p>Oracle mode supplies the true functions, or fixed wrong functions m(x,a)=0.7+0.8a and g(x)=0.5. It isolates nuisance correctness; fitted mode also includes nuisance-estimation uncertainty. Cross-fitting is irrelevant for supplied functions.</p><p>AIPW intervals use its empirical influence-function standard error. Coverage is a diagnostic, particularly with misspecified fitted nuisances; double robustness of the point estimator alone does not guarantee valid inference. Plug-in bias, SD and RMSE are reported without borrowing AIPW's standard error. The bound is the nonparametric efficiency bound at the true law. An oracle plug-in uses supplied truth, so it is not a regular estimator in the full unknown-nuisance model; its SD can be below that model's bound without contradicting efficiency theory.</p></details>`;
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
      ha.counts.forEach((count, i) => {
        svg.append(
          V.svg("rect", {
            x: L + i * bw + 1,
            y: B - (H * count) / max,
            width: bw - 2,
            height: (H * count) / max,
            fill: "var(--muted)",
            "fill-opacity": 0.5,
          }),
        );
        svg.append(
          V.svg("rect", {
            x: L + i * bw + 1,
            y: B - (H * hb.counts[i]) / max,
            width: bw - 2,
            height: (H * hb.counts[i]) / max,
            fill: "none",
            stroke: "var(--purple)",
            "stroke-width": 2,
          }),
        );
      });
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
