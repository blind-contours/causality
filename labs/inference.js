/* Inference laboratory: three error terms, nuisance rates, cross-fitting, repeated samples.
 * Figures follow the kit rule: playback changes a mathematical state and leaves a trace. */
(function () {
  const { S, store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, ease, Plot, player } = CausalAnim,
    root = document.querySelector("[data-lab]"),
    state = store(
      "inference",
      {
        step: 0,
        alpha: 0.25,
        beta: 0.25,
        n: 100,
        exact: "none",
        learner: "memorise",
      },
      {
        step: [0, 3],
        alpha: [0, 0.6],
        beta: [0, 0.6],
        n: [100, 1000000],
        exact: ["none", "g", "m"],
        learner: ["memorise", "linear"],
      },
    ),
    big = (n) => Math.round(n).toLocaleString("en-US"),
    readout = (box, pairs) =>
      box.replaceChildren(
        ...pairs.flatMap(([k, v]) => [
          html("span", { class: "k" }, k),
          html("span", {}, v),
        ]),
      ),
    labelled = (text, input) => {
      const id = "fig-" + Math.random().toString(36).slice(2, 8);
      input.id = id;
      return html("label", { for: id }, text + " ", input);
    },
    range = (value, min = 0, max = 0.6, step = 0.01) =>
      html("input", { type: "range", min, max, step, value }),
    regimeOf = (sum) =>
      sum > 0.5 + 1e-9 ? "fast" : sum < 0.5 - 1e-9 ? "slow" : "boundary";

  /* ---------- Figure: double-robustness plane ---------- */
  CausalFigures.register("dr-plane", (mount, ds) => {
    const cfg = {
      alpha: Number.isFinite(+ds.alpha) ? +ds.alpha : 0.25,
      beta: Number.isFinite(+ds.beta) ? +ds.beta : 0.25,
      exact: "none",
    };
    mount.classList.add("figure");
    const plane = el("svg", {
        role: "img",
        "aria-label":
          "Plane of propensity error against outcome error. The current errors form a rectangle whose area bounds the remainder; the shaded region below the hyperbola is where that product is at most the sampling scale c over root n. Values are listed beside the figure.",
      }),
      trace = el("svg", {
        role: "img",
        "aria-label":
          "Square-root-n times the rectangle area, traced against log sample size.",
      }),
      out = html("div", { class: "fig-readout" }),
      cap = html("p", { class: "fig-caption", role: "status" }),
      main = html("div", {}, plane),
      side = html("div", {}, trace, out),
      controls = html("div", { class: "fig-controls" }),
      aIn = range(cfg.alpha),
      bIn = range(cfg.beta),
      exactIn = html("select", {});
    for (const [v, t] of [
      ["none", "neither: both nuisances carry error"],
      ["g", "propensity ĝ exactly right (‖ĝ−g‖ = 0)"],
      ["m", "outcome m̂ exactly right (‖m̂−m‖ = 0)"],
    ])
      exactIn.append(html("option", { value: v }, t));
    controls.append(
      labelled("Outcome rate α (‖m̂−m‖ ∝ n^−α)", aIn),
      labelled("Propensity rate β (‖ĝ−g‖ ∝ n^−β)", bIn),
      labelled("One nuisance exactly right?", exactIn),
    );
    mount.append(html("div", { class: "fig-row" }, main, side), cap, controls);
    const P = new Plot(plane, {
        x: [0, 0.6],
        y: [0, 0.6],
        width: 420,
        height: 380,
        margin: { l: 56, r: 16, t: 26, b: 48 },
        xlabel: "propensity error ‖ĝ − g‖",
        ylabel: "outcome error ‖m̂ − m‖",
      }),
      C = 2.5,
      T = new Plot(trace, {
        x: [2, 5],
        y: [-2, 2],
        width: 280,
        height: 240,
        margin: { l: 44, r: 14, t: 24, b: 40 },
        xlabel: "n (log scale)",
        ylabel: "√n · area (log scale)",
        xticks: [2, 3, 4, 5],
        xTickFormat: (v) => ["10²", "10³", "10⁴", "10⁵"][v - 2] ?? fmt(v, 1),
        yticks: [-2, -1, 0, 1, 2],
        yTickFormat: (v) =>
          Number.isInteger(v) && v >= -2 && v <= 2
            ? ["0.01", "0.1", "1", "10", "100"][v + 2]
            : fmt(v, 2),
      });
    const band = el("path", {
        fill: "var(--or)",
        "fill-opacity": 0.15,
        stroke: "var(--or)",
        "stroke-width": 1.5,
      }),
      halo = {
        stroke: "var(--paper)",
        "stroke-width": 4,
        "paint-order": "stroke",
        "stroke-linejoin": "round",
      },
      bandLab = el("text", { class: "fig-text", "text-anchor": "end", ...halo }),
      pathAll = P.line([[0, 0]], {
        stroke: "var(--purple)",
        "stroke-opacity": 0.35,
        "stroke-width": 1.5,
        "stroke-dasharray": "3 3",
      }),
      pathDone = P.line([[0, 0]], {
        stroke: "var(--purple)",
        "stroke-width": 2.5,
      }),
      rect = el("rect", {
        fill: "var(--purple)",
        "fill-opacity": 0.18,
        stroke: "var(--purple)",
        "stroke-width": 1.5,
      }),
      dot = el("circle", { r: 6, fill: "var(--purple)" }),
      areaLab = el("text", {
        class: "fig-text ink",
        "text-anchor": "middle",
        ...halo,
      }),
      nLab = el("text", { class: "fig-text ink", "text-anchor": "end" });
    P.marks.prepend(band);
    P.marks.append(rect, dot);
    P.fg.append(bandLab, areaLab, nLab);
    T.hline(Math.log10(C), { stroke: "var(--or)" });
    // The trace can sit on the dashed line, so its label lives in the always-empty top-left corner.
    T.text(2.08, 1.65, "dashed: band scale c = 2.5", {
      class: "fig-text",
      fill: "var(--or)",
      "text-anchor": "start",
    });
    // Region where ‖ĝ−g‖·‖m̂−m‖ ≤ band: everything under the hyperbola x·y = band.
    const hyperbola = (b) => {
      const xTop = b / P.y[1];
      if (xTop >= P.x[1])
        return `M${P.sx(0)},${P.sy(0)} V${P.sy(P.y[1])} H${P.sx(P.x[1])} V${P.sy(0)} Z`;
      let d = `M${P.sx(0)},${P.sy(0)} V${P.sy(P.y[1])} H${P.sx(xTop)}`;
      for (let k = 1; k <= 60; k++) {
        const x = xTop + ((P.x[1] - xTop) * k) / 60;
        d += ` L${fmt(P.sx(x), 2)},${fmt(P.sy(b / x), 2)}`;
      }
      return d + ` V${P.sy(0)} Z`;
    };
    const tracePath = T.line([[2, 0]], { stroke: "var(--purple)" }),
      traceDot = el("circle", { r: 4, fill: "var(--purple)" });
    T.marks.append(traceDot);
    const at = (n) =>
      S.ratePath(n, {
        alpha: cfg.alpha,
        beta: cfg.beta,
        c: C,
        exactG: cfg.exact === "g",
        exactM: cfg.exact === "m",
      });
    const logScaled = (v) => (v > 0 ? Math.max(-2, Math.log10(v)) : -2);
    const samples = (t0, t1, k = 40) =>
      Array.from({ length: k + 1 }, (_, i) => t0 + ((t1 - t0) * i) / k);
    let t = 0;
    function render() {
      const n = 10 ** (2 + 3 * t),
        r = at(n),
        sum = cfg.alpha + cfg.beta;
      band.setAttribute("d", hyperbola(r.band));
      // Errors start at 0.5, so the band above 0.5 is always free for this label.
      bandLab.setAttribute("x", P.sx(P.x[1]) - 6);
      bandLab.setAttribute("y", P.m.t + 38);
      bandLab.style.fill = "var(--or)";
      bandLab.textContent = `shaded: ‖ĝ−g‖·‖m̂−m‖ ≤ c/√n = ${fmt(r.band, 3)}`;
      pathAll.setAttribute(
        "d",
        P.d(
          samples(0, 1).map((u) => {
            const q = at(10 ** (2 + 3 * u));
            return [q.eg, q.em];
          }),
        ),
      );
      pathDone.setAttribute(
        "d",
        P.d(
          samples(0, t).map((u) => {
            const q = at(10 ** (2 + 3 * u));
            return [q.eg, q.em];
          }),
        ),
      );
      rect.setAttribute("x", P.sx(0));
      rect.setAttribute("y", P.sy(r.em));
      rect.setAttribute("width", Math.max(0, P.sx(r.eg) - P.sx(0)));
      rect.setAttribute("height", Math.max(0, P.sy(0) - P.sy(r.em)));
      dot.setAttribute("cx", P.sx(r.eg));
      dot.setAttribute("cy", P.sy(r.em));
      const small = r.eg < 0.12 || r.em < 0.12;
      areaLab.setAttribute("x", small ? P.sx(r.eg) + 60 : P.sx(r.eg / 2));
      areaLab.setAttribute("y", small ? P.sy(r.em) - 12 : P.sy(r.em / 2) + 4);
      areaLab.textContent = `area = ${fmt(r.area, 4)}`;
      nLab.setAttribute("x", P.sx(P.x[1]) - 6);
      nLab.setAttribute("y", P.m.t + 14);
      nLab.textContent = `n = ${big(n)}`;
      tracePath.setAttribute(
        "d",
        T.d(
          samples(0, t, 60).map((u) => [
            2 + 3 * u,
            logScaled(at(10 ** (2 + 3 * u)).scaled),
          ]),
        ),
      );
      traceDot.setAttribute("cx", T.sx(2 + 3 * t));
      traceDot.setAttribute("cy", T.sy(logScaled(r.scaled)));
      readout(out, [
        ["n", big(n)],
        ["‖ĝ−g‖", fmt(r.eg, 4)],
        ["‖m̂−m‖", fmt(r.em, 4)],
        ["area |R₂| bound", fmt(r.area, 4)],
        ["band c/√n", fmt(r.band, 4)],
        ["√n · area", fmt(r.scaled, 3)],
      ]);
      const regime = regimeOf(sum),
        lead =
          cfg.exact !== "none"
            ? `One nuisance is exactly right, so the rectangle has no area at any n: the remainder bound is zero however slowly the other error shrinks. That is double robustness of the point estimate; the interval still needs the other two terms.`
            : regime === "fast"
              ? `α + β = ${fmt(sum, 2)} > ½: the rectangle enters the boundary region and stays inside. √n · area falls toward zero, so this bound shows the remainder is negligible on the interval's scale (sufficient, given the other conditions).`
              : regime === "slow"
                ? `α + β = ${fmt(sum, 2)} < ½: the rectangle never enters the boundary region and √n · area grows. This bound cannot show the remainder is negligible. The actual signed remainder may still be smaller, even zero if contributions cancel, but nothing here guarantees it.`
                : `α + β = ½: the rectangle rides along the boundary and √n · area stays constant. The bound does not establish a negligible remainder. Whether the interval is actually off-centre depends on the signed remainder, which this product cannot see.`;
      cap.textContent =
        lead +
        ` At n = ${big(n)} the product is ${fmt(r.area, 4)} against c/√n = ${fmt(r.band, 4)}: the corner of the rectangle is ${Math.abs(r.area - r.band) <= 0.005 * r.band ? "on the boundary curve" : S.productInside(r.eg, r.em, r.band) ? "inside the region" : "outside the region"}.`;
    }
    cfg.n = 100;
    const announce = (detail) =>
      mount.dispatchEvent(new CustomEvent("figurechange", { detail }));
    const play = player(mount, {
      duration: 6000,
      label: "n from 100 to 100,000 (log scale)",
      onT(v) {
        t = v;
        render();
        const n = Math.round(10 ** (2 + 3 * t));
        if (n !== cfg.n) {
          cfg.n = n;
          announce({ n });
        }
      },
    });
    const change = () => {
      cfg.alpha = +aIn.value;
      cfg.beta = +bIn.value;
      cfg.exact = exactIn.value;
      render();
      announce({ alpha: cfg.alpha, beta: cfg.beta, exact: cfg.exact });
    };
    aIn.addEventListener("input", change);
    bIn.addEventListener("input", change);
    exactIn.addEventListener("change", change);
    mount.figure = {
      player: play,
      get: () => ({ ...cfg }),
      set(p) {
        const { n, ...rest } = p;
        Object.assign(cfg, rest);
        aIn.value = cfg.alpha;
        bIn.value = cfg.beta;
        exactIn.value = cfg.exact;
        if (Number.isFinite(n) && Math.abs(n - cfg.n) > 0.5) {
          cfg.n = Math.round(n);
          play.set(Math.max(0, Math.min(1, (Math.log10(n) - 2) / 3)));
        } else render();
      },
    };
    render();
  });

  /* ---------- Figure: cross-fitting deck ---------- */
  CausalFigures.register("crossfit", (mount, ds) => {
    const rows = S.toyCurve(+ds.n || 16, S.rng(+ds.seed || 872)),
      m = rows.length,
      fold = (i) => (i % 2 ? "B" : "A"),
      cfg = { learner: "memorise" };
    mount.classList.add("figure");
    const svg = el("svg", {
        class: "fig",
        viewBox: "0 0 640 340",
        role: "img",
        "aria-label":
          "Sixteen patients drawn as dots. A learner is fitted on all of them, then the deck splits into two folds and each fold is predicted by a model fitted on the other. Residuals are drawn as sticks. Values are listed beside the figure.",
      }),
      out = html("div", { class: "fig-readout" }),
      cap = html("p", { class: "fig-caption", role: "status" }),
      controls = html("div", { class: "fig-controls" }),
      learnerIn = html("select", {});
    learnerIn.append(
      html("option", { value: "memorise" }, "memorises every training outcome"),
      html(
        "option",
        { value: "linear" },
        "straight line fitted to the training fold",
      ),
    );
    controls.append(labelled("Learner", learnerIn));
    mount.append(
      html("div", { class: "fig-row" }, html("div", {}, svg), out),
      cap,
      controls,
    );
    const Y = [0.7, 3.5],
      top = 44,
      bot = 296,
      sy = (y) => bot - ((y - Y[0]) / (Y[1] - Y[0])) * (bot - top),
      full = { l: 60, r: 610 },
      panelA = { l: 40, r: 300 },
      panelB = { l: 340, r: 600 },
      px = (x, p) => p.l + x * (p.r - p.l);
    const g = {
      axes: el("g", { class: "fig-axes" }),
      curve: el("g"),
      sticks: el("g"),
      dots: el("g"),
      labels: el("g", { class: "fig-labels" }),
    };
    svg.append(g.axes, g.curve, g.sticks, g.dots, g.labels);
    const baseline = el("line", {
        class: "axis",
        x1: full.l,
        x2: full.r,
        y1: bot,
        y2: bot,
      }),
      divider = el("line", {
        class: "axis",
        x1: 320,
        x2: 320,
        y1: top - 8,
        y2: bot,
        "stroke-dasharray": "4 4",
      }),
      yLab = el(
        "text",
        { class: "axis-label", x: 12, y: top - 14 },
        "outcome y",
      ),
      xLab = el(
        "text",
        { class: "axis-label", x: 320, y: bot + 30, "text-anchor": "middle" },
        "covariate x",
      ),
      labA = el("text", {
        class: "fig-text ink",
        x: (panelA.l + panelA.r) / 2,
        y: top - 12,
        "text-anchor": "middle",
      }),
      labB = el("text", {
        class: "fig-text ink",
        x: (panelB.l + panelB.r) / 2,
        y: top - 12,
        "text-anchor": "middle",
      }),
      phaseLab = el("text", {
        class: "fig-text",
        x: 620,
        y: bot + 30,
        "text-anchor": "end",
      });
    g.axes.append(baseline, divider, yLab, xLab);
    g.labels.append(labA, labB, phaseLab);
    const curveA = el("path", {
        class: "mark-line",
        fill: "none",
        stroke: "var(--purple)",
      }),
      curveB = el("path", {
        class: "mark-line",
        fill: "none",
        stroke: "var(--purple)",
      });
    g.curve.append(curveA, curveB);
    const dots = rows.map((r, i) =>
        el("circle", {
          r: 5.5,
          fill: fold(i) === "A" ? "var(--p)" : "var(--or)",
          stroke: "var(--paper)",
          "stroke-width": 1.5,
        }),
      ),
      sticks = rows.map(() =>
        el("line", {
          stroke: "var(--red)",
          "stroke-width": 3,
          "stroke-linecap": "round",
        }),
      );
    g.dots.append(...dots);
    g.sticks.append(...sticks);
    const fit = (train) => {
      if (cfg.learner === "linear") {
        const { a, b } = S.linearFit(train);
        return (x) => a + b * x;
      }
      return (x) => S.interpolate(train, x);
    };
    const trainSet = (f) => rows.filter((_, i) => fold(i) === f),
      mse = (pred, set) => S.mean(set.map((r) => (r.y - pred(r.x)) ** 2)),
      curveD = (pred, panel, frac, xs) => {
        const x0 = xs[0].x,
          x1 = xs[xs.length - 1].x,
          k = Math.max(1, Math.round(80 * frac));
        return Array.from({ length: k + 1 }, (_, i) => {
          const x = x0 + ((x1 - x0) * i) / 80;
          return `${i ? "L" : "M"}${fmt(px(x, panel), 2)},${fmt(sy(pred(x)), 2)}`;
        }).join(" ");
      };
    let t = 0;
    function render() {
      const phase = t < 0.22 ? 1 : t < 0.4 ? 2 : t < 0.7 ? 3 : 4,
        split =
          phase === 1 ? 0 : phase === 2 ? ease.inOut((t - 0.22) / 0.18) : 1,
        frac =
          phase === 1
            ? Math.min(1, t / 0.2)
            : phase === 3
              ? Math.min(1, (t - 0.4) / 0.28)
              : phase === 4
                ? Math.min(1, (t - 0.7) / 0.28)
                : 0,
        trainF = phase === 4 ? "B" : "A",
        testF = phase === 4 ? "A" : "B",
        trainRows = phase === 1 ? rows : trainSet(trainF),
        pred = fit(trainRows),
        panelOf = (f) => (f === "A" ? panelA : panelB);
      rows.forEach((r, i) => {
        const p = panelOf(fold(i)),
          x = px(r.x, full) * (1 - split) + px(r.x, p) * split;
        dots[i].setAttribute("cx", x);
        dots[i].setAttribute("cy", sy(r.y));
        const training = phase === 1 || (phase >= 3 && fold(i) === trainF);
        dots[i].setAttribute(
          "stroke",
          training ? "var(--purple)" : "var(--paper)",
        );
        dots[i].setAttribute("stroke-width", training ? 2.5 : 1.5);
        let show = 0;
        if (phase === 1) show = frac;
        else if (phase >= 3 && fold(i) === testF) {
          const order = trainSet(testF).indexOf(r),
            mm = trainSet(testF).length;
          show = Math.max(0, Math.min(1, frac * mm - order));
        }
        const yhat = sy(pred(r.x)),
          y = sy(r.y);
        sticks[i].setAttribute("x1", x);
        sticks[i].setAttribute("x2", x);
        sticks[i].setAttribute("y1", yhat);
        sticks[i].setAttribute("y2", yhat + (y - yhat) * show);
        sticks[i].setAttribute("opacity", show > 0 ? 1 : 0);
      });
      divider.setAttribute("opacity", split);
      labA.setAttribute("opacity", split);
      labB.setAttribute("opacity", split);
      labA.textContent =
        phase >= 3
          ? `fold A: ${trainF === "A" ? "training" : "held out"}`
          : "fold A";
      labB.textContent =
        phase >= 3
          ? `fold B: ${trainF === "B" ? "training" : "held out"}`
          : "fold B";
      if (phase === 1) {
        curveA.setAttribute("d", curveD(pred, full, frac, rows));
        curveA.setAttribute("opacity", 1);
        curveB.setAttribute("opacity", 0);
      } else if (phase === 2) {
        curveA.setAttribute("opacity", 1 - split);
        curveB.setAttribute("opacity", 0);
      } else {
        const tr = trainSet(trainF),
          te = trainSet(testF);
        curveA.setAttribute(
          "d",
          curveD(pred, panelOf(trainF), Math.min(1, frac * 2), tr),
        );
        curveB.setAttribute("d", curveD(pred, panelOf(testF), frac, te));
        curveA.setAttribute("opacity", 1);
        curveB.setAttribute("opacity", frac > 0 ? 1 : 0);
        curveB.setAttribute("stroke-dasharray", "6 4");
      }
      const trainMSE = mse(pred, trainRows),
        testRows = phase >= 3 ? trainSet(testF) : [],
        shown = testRows.slice(
          0,
          Math.min(testRows.length, Math.ceil(frac * testRows.length - 1e-9)),
        ),
        testMSE = shown.length ? mse(pred, shown) : NaN,
        predA = fit(trainSet("B")),
        predB = fit(trainSet("A")),
        combined =
          (S.sum(trainSet("A").map((r) => (r.y - predA(r.x)) ** 2)) +
            S.sum(trainSet("B").map((r) => (r.y - predB(r.x)) ** 2))) /
          m;
      const names = {
        1: "fit on all 16",
        2: "split the deck",
        3: "fit A, predict B",
        4: "fit B, predict A",
      };
      phaseLab.textContent = "";
      readout(out, [
        ["phase", `${phase} of 4: ${names[phase]}`],
        ["learner", cfg.learner === "memorise" ? "memorises" : "straight line"],
        [
          "training fold",
          phase === 1
            ? "all 16"
            : phase === 2
              ? "—"
              : `${trainF} (${trainRows.length})`,
        ],
        ["training MSE", phase === 2 ? "—" : fmt(trainMSE, 3)],
        [
          "held-out fold",
          phase >= 3
            ? `${testF} (${shown.length} of ${testRows.length} shown)`
            : "—",
        ],
        ["held-out MSE", Number.isFinite(testMSE) ? fmt(testMSE, 3) : "—"],
        ["cross-fitted MSE", phase === 4 && frac >= 1 ? fmt(combined, 3) : "—"],
      ]);
      const mem = cfg.learner === "memorise";
      cap.textContent =
        `Phase ${phase} of 4, ${names[phase]}. ` +
        (phase === 1
          ? mem
            ? `Fit on all 16 patients. The memorising learner passes through every outcome, so its training residuals are all zero (MSE ${fmt(trainMSE, 3)}). That number says nothing about a new patient.`
            : `Fit on all 16 patients. The straight line cannot pass through every outcome, so it leaves residuals even in its own training data (MSE ${fmt(trainMSE, 3)}).`
          : phase === 2
            ? `Split the deck into fold A (blue) and fold B (orange). Each patient will now be predicted by a model that never saw that patient's outcome.`
            : phase === 3
              ? `Fit on fold A, predict fold B. On the training fold the residuals are ${mem ? "still zero" : fmt(trainMSE, 3)}; on the held-out fold they are real: MSE ${Number.isFinite(testMSE) ? fmt(testMSE, 3) : "appearing"} so far.`
              : `Swap: fit on fold B, predict fold A (held-out MSE ${Number.isFinite(testMSE) ? fmt(testMSE, 3) : "appearing"}). Every patient now has a prediction from a model that never saw its outcome; the cross-fitted MSE is ${fmt(combined, 3)}. The gap between the in-sample and held-out pictures is an analogy for data reuse, not the empirical-process term itself: that term compares an empirical average with a population average for a fixed fitted function, and cross-fitting makes it easier to control because the fitted function is independent of the fold it is evaluated on.`);
      mount.dispatchEvent(
        new CustomEvent("figurerender", { detail: { phase } }),
      );
    }
    const play = player(mount, {
      duration: 9000,
      label: "fit → split → predict → swap",
      onT(v) {
        t = v;
        render();
      },
    });
    learnerIn.addEventListener("change", () => {
      cfg.learner = learnerIn.value;
      render();
      mount.dispatchEvent(
        new CustomEvent("figurechange", { detail: { ...cfg } }),
      );
    });
    mount.figure = {
      player: play,
      rows,
      fold,
      get: () => ({ ...cfg }),
      set(p) {
        if (p.learner && p.learner !== cfg.learner) {
          cfg.learner = p.learner;
          learnerIn.value = cfg.learner;
          render();
        }
      },
      predictions() {
        // One model identity throughout: a patient's own-fold prediction comes from the
        // fit on that patient's fold; the held-out prediction from the fit on the other fold.
        const fitA = fit(trainSet("A")),
          fitB = fit(trainSet("B"));
        return rows.map((r, i) => ({
          own: (fold(i) === "A" ? fitA : fitB)(r.x),
          heldOut: (fold(i) === "A" ? fitB : fitA)(r.x),
        }));
      },
    };
    render();
  });

  /* ---------- Page ---------- */
  root.innerHTML = `<section class="lab-step" data-title="Three terms"><h2 tabindex="-1">A correction leaves three different sources of error</h2><p>The leading error is an average of true influence-function values. A second term comes from estimating that influence function. A third term is nonlinear bias: the remainder. Each needs its own argument.</p><div class="math">ψ̂ − ψ₀ = (Pₙ−P₀)D*(P₀)<br>+ (Pₙ−P₀)[D*(P̂)−D*(P₀)]<br>+ R₂(P̂,P₀)</div><p>The remainder is bounded by a product of two nuisance errors: a rectangle. Play lets n grow and asks whether the rectangle's area gets inside the sampling band before n runs out.</p><div data-figure="dr-plane" data-alpha="0.25" data-beta="0.25"></div><p>The first term gives the efficient variance. Cross-fitting helps control the second. Appropriate nuisance accuracy makes the last negligible. Identification is needed before any of these terms can describe a causal answer.</p><details><summary>Exact ATE remainder and its sign convention</summary><p class="math">Ψ(P̂)−Ψ(P₀) = −P₀D*(P̂) + R₂<br>R₂ = E₀[(ĝ−g₀){(m̂₁−m₁₀)/ĝ + (m̂₀−m₀₀)/(1−ĝ)}]</p><p>Under positivity and bounded inverse estimated propensities, its magnitude is bounded by a constant times the product of L² nuisance errors. A rectangle of side lengths “outcome error” and “propensity error” depicts a bound on magnitude, not the signed exact remainder. In the figure the errors start at 0.5 when n = 100 and the band constant c = 2.5 is chosen so that the boundary case α + β = ½ rides exactly along the band's edge.</p></details></section>
<section class="lab-step" data-title="Rates"><h2 tabindex="-1">The boundary matters: one quarter plus one quarter</h2><label>Outcome convergence exponent α <input id="alpha" type="range" min="0" max=".6" step=".01"></label><label>Propensity convergence exponent β <input id="beta" type="range" min="0" max=".6" step=".01"></label><div class="figure" id="rate-figure"><div class="fig-row"><div><svg id="rate-plot" role="img" aria-label="Square-root-n scaled remainder bound versus log10 sample size, with the boundary line at one. Values and interpretation follow."></svg></div><div><svg id="rate-square" role="img" aria-label="The rate square: alpha against beta with the boundary line alpha plus beta equals one half and the current point."></svg><div class="fig-readout" id="rate-readout"></div></div></div><p id="rate-status" class="fig-caption" role="status"></p></div><div id="rate-table"></div><p>If the errors are exactly n⁻¹⁄⁴ each, their product is n⁻¹⁄². Multiplication by √n leaves a constant. For centered efficient inference, require a little-o remainder: √n R₂ → 0. A rate sum strictly greater than ½ is sufficient under the other conditions; equality is not enough by itself.</p><p class="note">This plot sets bounding constants to one and uses exact power laws. It illustrates rates, not a finite-sample guarantee. One nuisance can be slower if the other is faster.</p></section>
<section class="lab-step" data-title="Cross-fitting"><h2 tabindex="-1">Make a prediction before seeing that patient's outcome</h2><p>Imagine a learner that memorizes the training outcomes. Its training residuals are all zero, even if it predicts new patients poorly. For cross-fitting, fit on one fold and evaluate on the other, then swap. Every patient receives a prediction from a model trained without that patient's observation.</p><div data-figure="crossfit" data-n="16" data-seed="872"></div><div id="fold-table"></div><p class="math">Fit fold A → evaluate fold B<br>Fit fold B → evaluate fold A<br>Combine the held-out influence-function contributions.</p><p>Conditional on the training fold, independent validation observations make the empirical-process term easier to control. Consistency in L² and suitable moments are still needed. Cross-fitting does not correct a persistently wrong model, weak overlap, confounding that was not measured, or a remainder that fails to vanish.</p><p class="note">In the table, “own-fold prediction” is what the learner says about a patient it was trained on: the memorising learner returns the outcome exactly. The held-out prediction comes from the model fitted on the other fold. Neither is advertised as an adequate nuisance learner. The purpose is to expose data reuse.</p></section>
<section class="lab-step" data-title="Cross-fitting on or off"><h2 tabindex="-1">Turn cross-fitting off and watch the interval shrink below the truth</h2><p>Step 3 used sixteen patients. Now run the same idea at scale. The outcome learner is k-nearest neighbours, as flexible as it gets: with k = 1 it predicts each patient by the single closest patient in the same arm. Fitted and evaluated on the same data, that closest patient is the patient itself, so every own-arm residual Y − m̂ is exactly zero.</p><div class="predict" data-options="Too narrow: coverage well below 95%|Too wide: coverage near 100%|About right: the propensity model is correct, so nothing breaks" data-answer="0" data-hint="The influence-function values are built from residuals. If the learner has memorised the outcomes, the residuals are zero and the values lose the outcome noise, so their spread understates the estimator's real spread.">With k = 1 and no cross-fitting, what happens to the AIPW 95% interval?</div><div id="cf-guess"></div><div data-simulation="crossfit" data-layout="grid"></div><p>Read the two panels from top to bottom. Without cross-fitting the estimates are roughly centred, but the IF-based standard error is about half the real spread, so nearly two intervals in five miss the truth. With two folds each patient is predicted by a model that never saw it, the residuals are honest again, and coverage returns close to 95%. Cross-fitting does not buy efficiency: a 1-nearest-neighbour fit never becomes accurate, so the cross-fitted SD stays well above the efficient bound. Try k = 25: a smoother learner cannot memorise, and fitting on the same patients does far less harm.</p><p class="note">This is the empirical-process term (Pₙ−P₀)[D*(P̂)−D*(P₀)] from step 1 made visible: when P̂ is fitted on the same patients it is evaluated on, that term need not be negligible. Consistency of the point estimate, efficiency and coverage are three separate promises, and each has its own condition.</p></section></section>`;
  CausalFigures.mountAll();
  control(document.getElementById("alpha"), state, "alpha");
  control(document.getElementById("beta"), state, "beta");

  /* Step 1 and step 2 share the rate path. */
  const dr = root.querySelector("[data-figure=dr-plane]"),
    cf = root.querySelector("[data-figure=crossfit]");
  dr.addEventListener("figurechange", (e) => state.set(e.detail));
  cf.addEventListener("figurechange", (e) =>
    state.set({ learner: e.detail.learner }),
  );
  const syncFigures = (c) => {
    const cur = dr.figure.get();
    if (
      cur.alpha !== c.alpha ||
      cur.beta !== c.beta ||
      cur.exact !== c.exact ||
      Math.abs(cur.n - c.n) > 0.5
    )
      dr.figure.set({ alpha: c.alpha, beta: c.beta, exact: c.exact, n: c.n });
    if (cf.figure.get().learner !== c.learner)
      cf.figure.set({ learner: c.learner });
  };
  state.subscribe(syncFigures);
  syncFigures(state.get());
  // Laboratory Reset also resets the figure clocks.
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail?.name !== "inference") return;
    dr.figure.player.set(0);
    cf.figure.player.set(0);
  });

  const sup = (v) =>
    String(v).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]);
  /* Step 2: rate plot with fixed axes, the boundary line, and the (α, β) square. */
  const RP = new Plot(document.getElementById("rate-plot"), {
      x: [2, 6],
      y: [-3, 3],
      width: 420,
      height: 300,
      margin: { l: 54, r: 18, t: 26, b: 46 },
      xlabel: "sample size n (log scale)",
      ylabel: "√n · |R₂| bound = n^(½ − α − β), log scale",
      xticks: [2, 3, 4, 5, 6],
      yticks: [-3, -2, -1, 0, 1, 2, 3],
      xTickFormat: (v) => "10" + sup(v),
      yTickFormat: (v) => (v === 0 ? "1" : "10" + sup(v)),
    }),
    RS = new Plot(document.getElementById("rate-square"), {
      x: [0, 0.6],
      y: [0, 0.6],
      width: 280,
      height: 280,
      margin: { l: 42, r: 14, t: 24, b: 42 },
      xlabel: "α (outcome rate)",
      ylabel: "β (propensity rate)",
      xticks: [0, 0.2, 0.4, 0.6],
      yticks: [0, 0.2, 0.4, 0.6],
    });
  RP.marks.append(
    el("rect", {
      x: RP.sx(2),
      y: RP.sy(3),
      width: RP.sx(6) - RP.sx(2),
      height: RP.sy(0) - RP.sy(3),
      fill: "var(--red)",
      "fill-opacity": 0.06,
    }),
    el("rect", {
      x: RP.sx(2),
      y: RP.sy(0),
      width: RP.sx(6) - RP.sx(2),
      height: RP.sy(-3) - RP.sy(0),
      fill: "var(--green)",
      "fill-opacity": 0.07,
    }),
  );
  const boundary = RP.hline(
    0,
    { stroke: "var(--ink)" },
    "boundary: √n · bound = constant (α + β = ½)",
  );
  RP.text(2.08, 2.7, "bound grows: α + β < ½", {
    class: "fig-text",
    fill: "var(--red)",
  });
  RP.text(2.08, -2.7, "bound vanishes: α + β > ½", {
    class: "fig-text",
    fill: "var(--green)",
  });
  const rateLine = RP.line([[2, 0]], { stroke: "var(--purple)" }),
    rateDot = el("circle", { r: 5, fill: "var(--purple)" }),
    rateLab = el("text", { class: "fig-text ink", "text-anchor": "end" });
  RP.marks.append(boundary, rateDot);
  RP.fg.append(rateLab);
  RS.marks.append(
    el("path", {
      d: `M${RS.sx(0)},${RS.sy(0)} L${RS.sx(0.5)},${RS.sy(0)} L${RS.sx(0)},${RS.sy(0.5)} Z`,
      fill: "var(--red)",
      "fill-opacity": 0.08,
    }),
    el("path", {
      d: `M${RS.sx(0.5)},${RS.sy(0)} L${RS.sx(0.6)},${RS.sy(0)} L${RS.sx(0.6)},${RS.sy(0.6)} L${RS.sx(0)},${RS.sy(0.6)} L${RS.sx(0)},${RS.sy(0.5)} Z`,
      fill: "var(--green)",
      "fill-opacity": 0.08,
    }),
  );
  RS.line(
    [
      [0, 0.5],
      [0.5, 0],
    ],
    { stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "5 4" },
  );
  RS.text(0.3, 0.27, "α + β = ½", {
    class: "fig-text ink",
    "text-anchor": "start",
  });
  RS.text(0.02, 0.05, "too slow", { class: "fig-text", fill: "var(--red)" });
  RS.text(0.34, 0.55, "fast enough", {
    class: "fig-text",
    fill: "var(--green)",
  });
  const sqH = el("line", {
      class: "mark-ref",
      stroke: "var(--purple)",
      "stroke-opacity": 0.6,
    }),
    sqV = el("line", {
      class: "mark-ref",
      stroke: "var(--purple)",
      "stroke-opacity": 0.6,
    }),
    sqDot = el("circle", { r: 6, fill: "var(--purple)" });
  RS.marks.append(sqH, sqV, sqDot);
  function render() {
    const c = state.get(),
      exponent = 0.5 - c.alpha - c.beta,
      points = Array.from({ length: 81 }, (_, i) => {
        const x = 2 + i / 20;
        return [x, x * exponent];
      }),
      regime = regimeOf(c.alpha + c.beta);
    rateLine.setAttribute("d", RP.d(points));
    const endY = points[points.length - 1][1];
    rateDot.setAttribute("cx", RP.sx(6));
    rateDot.setAttribute("cy", RP.sy(endY));
    rateLab.setAttribute("x", RP.sx(6) - 10);
    rateLab.setAttribute("y", RP.sy(endY) + (regime === "fast" ? -10 : 20));
    rateLab.textContent = `n^${fmt(exponent, 2)} (α = ${fmt(c.alpha, 2)}, β = ${fmt(c.beta, 2)})`;
    sqDot.setAttribute("cx", RS.sx(c.alpha));
    sqDot.setAttribute("cy", RS.sy(c.beta));
    sqH.setAttribute("x1", RS.sx(0));
    sqH.setAttribute("x2", RS.sx(c.alpha));
    sqH.setAttribute("y1", RS.sy(c.beta));
    sqH.setAttribute("y2", RS.sy(c.beta));
    sqV.setAttribute("x1", RS.sx(c.alpha));
    sqV.setAttribute("x2", RS.sx(c.alpha));
    sqV.setAttribute("y1", RS.sy(0));
    sqV.setAttribute("y2", RS.sy(c.beta));
    readout(document.getElementById("rate-readout"), [
      ["α + β", fmt(c.alpha + c.beta, 2)],
      ["exponent ½ − α − β", fmt(exponent, 2)],
      ["√n·bound at n = 10⁴", fmt(10 ** (4 * exponent), 4)],
      ["√n·bound at n = 10⁶", fmt(10 ** (6 * exponent), 4)],
      [
        "regime",
        regime === "fast"
          ? "vanishes"
          : regime === "slow"
            ? "grows"
            : "boundary",
      ],
    ]);
    document.getElementById("rate-status").textContent =
      `α = ${fmt(c.alpha, 2)}, β = ${fmt(c.beta, 2)}, so the scaled bound is n^${fmt(exponent, 2)}. ` +
      (regime === "fast"
        ? "The bound falls below the boundary line and keeps falling: this product bound shows the remainder is negligible on the √n scale (sufficient, with the other conditions)."
        : regime === "slow"
          ? "The bound rises above the boundary line: this product bound cannot show a negligible remainder. The actual signed remainder may be smaller, even zero, if contributions cancel."
          : "The bound sits exactly on the boundary line: it stays at 1, neither vanishing nor growing, so equality alone does not establish a negligible remainder.");
    document.getElementById("rate-table").innerHTML = table(
      ["n", "Outcome error", "Propensity error", "Scaled product"],
      [100, 1000, 10000, 1000000].map((n) => [
        n,
        fmt(n ** -c.alpha, 5),
        fmt(n ** -c.beta, 5),
        fmt(n ** exponent, 5),
      ]),
    );
  }
  state.subscribe(render);
  render();

  /* Step 3: the numeric view of the same 16 patients. */
  function foldTable() {
    const preds = cf.figure.predictions();
    document.getElementById("fold-table").innerHTML = table(
      [
        "Patient",
        "Fold",
        "x",
        "Outcome",
        "Own-fold prediction",
        "Held-out prediction",
        "Held-out residual",
      ],
      cf.figure.rows.map((r, i) => [
        i + 1,
        cf.figure.fold(i),
        fmt(r.x, 2),
        fmt(r.y),
        fmt(preds[i].own),
        fmt(preds[i].heldOut),
        fmt(r.y - preds[i].heldOut),
      ]),
      "The same sixteen patients as the figure; the learner follows the figure's control",
    );
  }
  cf.addEventListener("figurechange", foldTable);
  foldTable();
  guided(root, state);
  tools(root, state);

  /* Draw your guess: where does coverage land without cross-fitting? The answer is recomputed
   * here with the grid's default configuration (k = 1, n = 400, 300 samples, same seed), so it
   * matches the "Cross-fitting off" panel below until its controls are changed. */
  const CF_DEFAULT = { k: 1, mode: "fitted", n: 400, reps: 300, seed: 20260919, study: "smooth", crossfit: false };
  let cfSummary = null;
  const mountGuess = () =>
    window.CausalGuess &&
    CausalGuess.mount(document.getElementById("cf-guess"), {
      id: "cf-coverage-off",
      kind: "point",
      prompt:
        "Where will the coverage land without cross-fitting? Drag the marker to the share of nominal 95% intervals you expect to contain the true ATE (k = 1, n = 400, 300 repeated samples).",
      xDomain: [0, 1],
      xLabel: "Coverage of nominal 95% intervals",
      xTicks: (phone) => (phone ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.2, 0.4, 0.6, 0.8, 1]),
      xTickFormat: (v) => fmt(v * 100, 0) + "%",
      xFormat: (v) => fmt(v * 100, 1) + "%",
      valueFormat: (v) => fmt(v * 100, 1) + "%",
      diffFormat: (v) => fmt(v * 100, 1) + " percentage points",
      snap: 0.005,
      initial: 0.5,
      pointLabel: "Your guess for coverage without cross-fitting",
      truthLabel: "Simulated coverage",
      truthShort: "simulated",
      truthColor: "var(--purple)",
      margin: { l: 22, r: 26, t: 36, b: 48 },
      background: (svg, P, g) => {
        const X = P.sx(0.95);
        g.append(
          CausalAnim.el("line", { x1: X, x2: X, y1: P.m.t - 8, y2: P.H - P.m.b, stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }),
          CausalAnim.el("text", { class: "guess-text", x: X - 6, y: P.m.t - 14, "text-anchor": "end" }, "promised 95%"),
        );
      },
      veil: () => {
        const sim = root.querySelector('[data-simulation="crossfit"]');
        return sim ? [sim.querySelector(".simgrid"), sim.querySelector(".sim-results")] : [];
      },
      truth: () =>
        new Promise((resolve) =>
          setTimeout(() => {
            cfSummary = CausalScience.simulation(CF_DEFAULT, () => {}).summary;
            resolve(cfSummary.coverage);
          }, 30),
        ),
      feedback: (r) => {
        const s = cfSummary,
          ratio = s ? s.meanSE / s.aipw.sd : NaN;
        return r.error > 0.1
          ? `Most people expect a small dent. With k = 1 every own-arm residual is exactly zero, so the influence-function standard error is about ${fmt(ratio, 2)} of the real spread and roughly ${fmt((1 - r.truth) * 100, 0)} intervals in 100 miss.`
          : Math.abs(r.error) <= 0.1
            ? `Well judged. The memorised residuals are zero, the standard error comes out at about ${fmt(ratio, 2)} of the real spread, and coverage collapses even though the estimates stay roughly centred.`
            : `Coverage falls, but not all the way: the estimates stay roughly centred and the standard error is about ${fmt(ratio, 2)} of the real spread, so most intervals still reach the truth.`;
      },
    });
  // The simulation grid is mounted by labs/simulation.js, which loads after this file.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountGuess);
  else mountGuess();
})();
