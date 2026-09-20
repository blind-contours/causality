(function () {
  const { S, store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player } = CausalAnim,
    root = document.querySelector("[data-lab]"),
    state = store(
      "survival",
      { step: 0, tau: 5, n: 1200, censor: 2, seed: 20260919 },
      {
        step: [0, 3],
        tau: [1, 10],
        n: [200, 5000],
        censor: [0, 4],
        seed: [1, 4294967295],
      },
    );
  root.innerHTML = `<section class="lab-step" data-title="Choose a survival target"><h2 tabindex="-1">“Does it improve survival?” still needs a target</h2><p>Extend the severity-and-treatment study to time until an event. Choose a time horizon. Compare the chance of surviving to that time, or average event-free time up to it. These answer different clinical questions from a conditional hazard ratio.</p><label>Horizon τ, years <input id="horizon" type="range" min="1" max="10" step=".5"></label><p class="math" id="survival-target"></p><p>Restricted mean survival time, RMST(τ), is the area under a survival curve from 0 to τ. A difference of 0.4 years means an average additional 0.4 event-free years within that window.</p><button id="save-horizon">Save this horizon to my contract</button><p id="horizon-status" role="status"></p><p class="note">This extension changes the outcome to time until an event. Its treatment effect is not the numerical ATE=2 used in the continuous-outcome simulation.</p></section>
<section class="lab-step" data-title="See selection"><h2 tabindex="-1">The risk set changes as people leave it</h2><p>In this generator, high-severity patients have a higher event rate and receive treatment more often. They can also be censored sooner. Event and censoring times are independent conditional on severity and treatment; they need not be independent within pooled treatment groups.</p><label>Severity dependence of censoring (0 turns censoring off) <input id="censoring" type="range" min="0" max="4" step=".25"></label><label>Cohort size <input id="cohort-n" type="range" min="200" max="5000" step="200"></label><label>Seed <input id="survival-seed" type="number" min="1" step="1"></label><p id="censoring-status"></p>
<div class="figure" id="km-figure"><div class="fig-row"><div><svg id="km-svg" role="img" aria-label="Kaplan–Meier construction for 24 treated patients: a row of patients ordered by time above a survival curve that steps down at each death as calendar time advances."></svg><div id="km-player"></div></div><div><div class="fig-readout" id="km-readout"></div></div></div><p class="fig-caption" id="km-caption"></p></div>
<div id="risk-table"></div><p>A low censoring rate is not evidence that censoring is independent. This experiment declares its mechanism so we can check estimators against a known target.</p></section>
<section class="lab-step" data-title="Compare curves"><h2 tabindex="-1">Separate the estimator from the question</h2>
<div class="figure" id="survival-figure"><div class="fig-row"><div><svg id="survival-plot" role="img" aria-label="Treated survival: truth, pooled Kaplan–Meier, and severity-standardized Kaplan–Meier, with the control truth curve, the RMST area shaded to the horizon, and censoring ticks. Exact selected-time values follow."></svg><p class="legend"><span style="color:var(--green)">Solid green: everyone treated, truth</span><span style="color:var(--green)">Dashed green: everyone control, truth</span><span style="color:var(--muted)">Dashed gray: pooled treated KM</span><span style="color:var(--purple)">Dotted purple: standardized treated KM</span><span style="color:var(--muted)">Small ticks: censoring</span></p></div><div><div class="fig-controls"><label>Horizon τ, years <input id="horizon-2" type="range" min="1" max="10" step=".5"></label><label>Severity dependence of censoring <input id="censoring-2" type="range" min="0" max="4" step=".25"></label></div><div class="fig-readout" id="survival-readout"></div></div></div><p class="fig-caption" id="survival-caption"></p></div>
<div id="survival-values"></div><div id="rmst-values"></div><p id="support-status" class="warning"></p><p>Standardization fits KM within each severity/treatment group and averages over the whole cohort's severity distribution. In this finite-stratum example, it adjusts both measured baseline confounding and censoring that is independent within those strata. Pooled KM among treated people uses a different severity mix and may also violate its censoring condition.</p>
<div class="figure" id="std-figure"><div class="fig-row"><div><svg id="std-svg" role="img" aria-label="The two stratum-specific treated Kaplan–Meier curves, low and high severity, and their weighted average."></svg></div><div><svg id="std-weights" role="img" aria-label="Mixing weights on the two severity strata: whole cohort versus treated-only, and the weight currently chosen."></svg><div class="fig-controls"><label>Weight w on the high-severity curve <input id="std-weight" type="range" min="0" max="1" step=".01"></label></div><div class="fig-readout" id="std-readout"></div></div></div><p class="fig-caption" id="std-caption"></p></div>
<p>For continuous covariates and longitudinal histories, conditional survival regressions and inverse censoring weights generalize the adjustment. Identification still requires exchangeability, consistency, treatment positivity, and censoring positivity through the chosen horizon.</p></section>
<section class="lab-step" data-title="Connect Cox to geometry"><h2 tabindex="-1">Cox already contains an infinite-dimensional part</h2><p class="math">λ(t | A,X) = λ₀(t) exp(βA + γX)</p><p>The baseline hazard λ₀ is unspecified; β and γ are finite-dimensional. This is a semiparametric model. Its regression coefficient β targets a conditional log hazard ratio under proportional hazards. It is not automatically a marginal survival contrast or an RMST difference.</p><p>Here the conditional treatment hazard ratio is 0.65 at every severity level. Mixing severity groups creates different evolving risk sets; the population hazard ratio need not stay at 0.65. Conditional proportional hazards does not make every marginal contrast proportional.</p>
<div class="figure" id="hr-figure"><div class="fig-row"><div><svg id="hr-svg" role="img" aria-label="Marginal hazard ratio over time for the whole-cohort severity mix and for the treated-only severity mix, against the conditional hazard ratio 0.65."></svg></div><div><div class="fig-controls"><label>Inspect time t, years <input id="hr-time" type="range" min="0" max="1" step=".01"></label></div><div class="fig-readout" id="hr-readout"></div></div></div><p class="fig-caption" id="hr-caption"></p></div>
<p class="math" id="hazard-values"></p><p>Carry the geometry back to this setting: permitted changes in baseline hazard and covariate distributions form directions in the statistical model. Which directions are nuisance directions depends on whether your target is β, survival at τ, or RMST. Choose that target first.</p><p class="note">No Cox model is fitted in this laboratory. The conditional hazard ratio is a known generator parameter. The displayed finite-sample estimators are Kaplan–Meier and stratified standardization.</p></section>`;
  [
    ["horizon", "tau"],
    ["horizon-2", "tau"],
    ["censoring", "censor"],
    ["censoring-2", "censor"],
    ["cohort-n", "n"],
    ["survival-seed", "seed"],
  ].forEach(([id, key]) => control(document.getElementById(id), state, key));

  /* ---------- pure helpers ---------- */
  const byId = (id) => document.getElementById(id),
    RATES = [0.08, 0.32],
    HR = 0.65,
    COHORT_W = [1 - S.prevalence, S.prevalence],
    treatedShare =
      (S.trueG(1) * S.prevalence) /
      (S.trueG(1) * S.prevalence + S.trueG(0) * (1 - S.prevalence)),
    TREATED_W = [1 - treatedShare, treatedShare],
    grid = (tau, k = 100) =>
      Array.from({ length: k + 1 }, (_, i) => (tau * i) / k),
    kmS = (km, t) => km.points.filter((p) => p[0] <= t).at(-1)[1],
    // Population hazard of arm at time t when severity is mixed with the given weights.
    hazard = (arm, t, w = COHORT_W) => {
      const rates = RATES.map((v) => v * (arm ? HR : 1));
      return (
        S.sum(rates.map((v, i) => w[i] * v * Math.exp(-v * t))) /
        S.sum(rates.map((v, i) => w[i] * Math.exp(-v * t)))
      );
    },
    marginalHR = (t, w) => hazard(1, t, w) / hazard(0, t, w),
    // Share of high-severity patients among those still event-free at t.
    highShare = (arm, t, w = COHORT_W) => {
      const rates = RATES.map((v) => v * (arm ? HR : 1)),
        alive = rates.map((v, i) => w[i] * Math.exp(-v * t));
      return alive[1] / S.sum(alive);
    },
    // Ordered KM bookkeeping: one record per distinct time ≤ τ.
    kmTrace = (rows, tau) => {
      const data = rows.slice().sort((a, b) => a.time - b.time),
        steps = [];
      let risk = data.length,
        s = 1;
      for (let i = 0; i < data.length; ) {
        const t = data[i].time;
        if (t > tau) break;
        let d = 0,
          c = 0;
        while (i < data.length && data[i].time === t) {
          data[i].event ? d++ : c++;
          i++;
        }
        const atRisk = risk;
        s *= 1 - d / atRisk;
        risk -= d + c;
        steps.push({ t, d, c, atRisk, factor: 1 - d / atRisk, s, after: risk });
      }
      return { data, steps };
    },
    readout = (id, pairs) => {
      byId(id).replaceChildren(
        ...pairs.flatMap(([k, v]) => [
          html("span", { class: "k" }, k),
          html("span", {}, String(v)),
        ]),
      );
    },
    // Split a step curve at time T into the observed part and the carried-forward tail.
    splitAt = (points, T) => {
      const head = points.filter((p) => p[0] <= T),
        s = head.at(-1)[1];
      return {
        head: [...head, [T, s]],
        tail: [[T, s], ...points.filter((p) => p[0] > T)],
      };
    },
    thin = (arr, max) =>
      arr.length <= max
        ? arr
        : arr.filter((_, i) => i % Math.ceil(arr.length / max) === 0),
    censorTick = (plot, t, s, attrs, parent) =>
      parent.append(
        el("line", {
          x1: plot.sx(t),
          x2: plot.sx(t),
          y1: plot.sy(s) - 5,
          y2: plot.sy(s) + 5,
          "stroke-width": 1.2,
          ...attrs,
        }),
      );

  /* ---------- cached data and per-figure local state ---------- */
  let cache = null,
    kmClock = 0, // calendar time as a fraction of τ
    stdW = null, // weight on the high-severity curve; null = follow the cohort share
    hrClock = 1; // inspected time as a fraction of τ

  /* ---------- Step 2: Kaplan–Meier construction ---------- */
  const KM_N = 24;
  function drawKM() {
    const { c, r } = cache,
      tau = c.tau,
      sub = r.rows.filter((v) => v.a === 1).slice(0, KM_N),
      { data, steps } = kmTrace(sub, tau),
      t = kmClock * tau,
      done = steps.filter((x) => x.t <= t),
      sNow = done.length ? done.at(-1).s : 1,
      atRisk = done.length ? done.at(-1).after : data.length,
      svg = byId("km-svg"),
      plot = new Plot(svg, {
        x: [0, tau],
        y: [0, 1],
        width: 640,
        height: 360,
        margin: { l: 54, r: 18, t: 88, b: 44 },
        xlabel: "Calendar time, years",
        ylabel: "Ŝ(t)",
      }),
      L = plot.m.l,
      R = plot.W - plot.m.r,
      dots = plot.layer("km-dots"),
      gap = (R - L) / (data.length - 1 || 1);
    dots.append(
      el(
        "text",
        { class: "fig-text ink", x: L, y: 16 },
        `${data.length} treated patients, both severity strata, ordered by time`,
      ),
    );
    data.forEach((v, i) => {
      const x = L + i * gap,
        gone = v.time <= t,
        sev = v.x ? "var(--or)" : "var(--p)",
        fill = !gone ? sev : v.event ? "var(--red)" : "none",
        stroke = !gone ? sev : v.event ? "var(--red)" : "var(--muted)";
      dots.append(
        el("circle", {
          cx: x,
          cy: 34,
          r: 6,
          fill,
          stroke,
          "stroke-width": 2,
          "fill-opacity": gone && !v.event ? 0 : 1,
          opacity: gone && !v.event ? 0.6 : 1,
        }),
        el(
          "text",
          {
            class: "tick",
            x,
            y: 54 + (i % 2) * 12,
            "text-anchor": "middle",
            fill: v.time > tau ? "var(--muted)" : undefined,
          },
          v.time > tau ? ">τ" : fmt(v.time, 1),
        ),
      );
    });
    // Faint truth curve for the whole treated arm as a reference.
    plot.line(
      grid(tau).map((u) => [u, r.arms[1].truthS(u)]),
      { stroke: "var(--green)", "stroke-width": 1.5, opacity: 0.45 },
    );
    const curve = [[0, 1], ...done.map((x) => [x.t, x.s]), [t, sNow]];
    plot.step(curve, { stroke: "var(--p)" });
    const ticks = plot.layer("km-ticks");
    done
      .filter((x) => x.c > 0)
      .forEach((x) =>
        censorTick(plot, x.t, x.s, { stroke: "var(--muted)" }, ticks),
      );
    done
      .filter((x) => x.d > 0)
      .forEach((x) => plot.scatter([[x.t, x.s]], 3.5, { fill: "var(--red)" }));
    plot.vline(t, { stroke: "var(--phat)" });
    plot.fg.append(
      el(
        "text",
        {
          class: "ref-label",
          x: plot.sx(t) + (t > tau * 0.8 ? -5 : 5),
          y: plot.m.t + 12,
          "text-anchor": t > tau * 0.8 ? "end" : "start",
          fill: "var(--phat)",
        },
        `t = ${fmt(t, 2)}`,
      ),
    );
    const factors = done.filter((x) => x.d > 0),
      shown = factors.slice(-3),
      product =
        (factors.length > 3 ? "… × " : "") +
        (shown.length
          ? shown.map((x) => `${x.atRisk - x.d}/${x.atRisk}`).join(" × ")
          : "1");
    readout("km-readout", [
      ["t", fmt(t, 2) + " y"],
      ["at risk", atRisk],
      ["events so far", S.sum(done.map((x) => x.d))],
      ["censored so far", S.sum(done.map((x) => x.c))],
      ["∏(1 − dⱼ/nⱼ)", product],
      ["Ŝ(t)", fmt(sNow, 3)],
      ["arm truth S₁(t)", fmt(r.arms[1].truthS(t), 3)],
    ]);
    const last = done.at(-1);
    let sentence = `Clock at t = 0: all ${data.length} patients are at risk and Ŝ = 1. Blue rings are low severity, orange rings high severity. Press Play to advance calendar time to τ = ${tau}.`;
    if (last && last.d > 0) {
      const prev = done.length > 1 ? done.at(-2).s : 1;
      sentence = `At t = ${fmt(last.t, 2)} ${last.d === 1 ? "one" : last.d} of ${last.atRisk} at risk died: multiply by ${last.atRisk - last.d}/${last.atRisk}, so Ŝ falls from ${fmt(prev, 3)} to ${fmt(last.s, 3)}. ${last.after} remain at risk.`;
    } else if (last) {
      sentence = `At t = ${fmt(last.t, 2)} ${last.c === 1 ? "one patient was" : last.c + " patients were"} censored (hollow dot, small tick): ${last.atRisk} at risk become ${last.after}; Ŝ stays ${fmt(last.s, 3)}, but the next death divides by a smaller risk set.`;
    }
    if (kmClock >= 1)
      sentence += ` At the horizon, Ŝ(τ) = ${fmt(sNow, 3)} against the arm truth ${fmt(r.arms[1].truthS(tau), 3)}; ${data.filter((v) => v.time > tau).length} patients (labelled >τ) were still observed at τ.`;
    byId("km-caption").textContent = sentence;
  }
  const kmPlayer = player(byId("km-player"), {
    duration: 9000,
    label: "Calendar time t, years",
    onT(u) {
      kmClock = u;
      byId("km-player").querySelector(".v").textContent = fmt(
        u * state.get().tau,
        2,
      );
      if (cache) drawKM();
    },
  });

  /* ---------- Step 3: survival curves with RMST shading ---------- */
  function drawSurvival() {
    const { c, r } = cache,
      tau = c.tau,
      a = r.arms[1],
      b = r.arms[0],
      time = grid(tau),
      plot = new Plot(byId("survival-plot"), {
        x: [0, tau],
        y: [0, 1],
        width: 640,
        height: 340,
        xlabel: "Years",
        ylabel: "Survival",
      }),
      truth1 = time.map((t) => [t, a.truthS(t)]),
      truth0 = time.map((t) => [t, b.truthS(t)]),
      shade = plot.layer("shade");
    // RMST₁(τ): the area under the treated truth curve up to τ.
    plot.area(
      truth1,
      0,
      { fill: "var(--green)", "fill-opacity": 0.12, stroke: "none" },
      shade,
    );
    // Between-curve region: the RMST difference.
    const between =
      plot.d(truth1) +
      " " +
      plot.d(truth0.slice().reverse()).replace(/^M/, "L") +
      " Z";
    shade.append(
      el("path", {
        d: between,
        fill: "var(--teal)",
        "fill-opacity": 0.28,
        stroke: "none",
      }),
    );
    plot.line(truth0, { stroke: "var(--green)", "stroke-dasharray": "8 5" });
    plot.line(truth1, { stroke: "var(--green)" });
    // Pooled treated KM, with carried-forward tail if the cell lacks support through τ.
    const treated = r.rows.filter((v) => v.a === 1),
      lastObs = (rows) => Math.max(0, ...rows.map((v) => v.time)),
      tails = [];
    const drawKMcurve = (points, support, T, attrs, label) => {
      if (support) return plot.step(points, attrs);
      const { head, tail } = splitAt(points, T);
      plot.step(head, attrs);
      plot.step(tail, {
        ...attrs,
        "stroke-dasharray": "1.5 4",
        "stroke-width": 3.5,
        "stroke-linecap": "round",
      });
      tails.push({ T, s: head.at(-1)[1], label, color: attrs.stroke });
    };
    drawKMcurve(
      a.naive.points,
      a.naive.support,
      lastObs(treated),
      { stroke: "var(--muted)", "stroke-dasharray": "7 5" },
      "pooled",
    );
    const stdTimes = [
        0,
        ...new Set(a.strata.flatMap((s) => s.points.map((p) => p[0]))),
      ].sort((x, y) => x - y),
      stdPoints = stdTimes.map((t) => [t, a.standardizedS(t)]),
      unsupported = a.strata
        .map((s, x) =>
          s.support ? null : lastObs(treated.filter((v) => v.x === x)),
        )
        .filter((v) => v !== null);
    drawKMcurve(
      stdPoints,
      !unsupported.length,
      Math.min(...unsupported),
      { stroke: "var(--purple)", "stroke-dasharray": "2 4" },
      "standardized",
    );
    // Censoring ticks on both KM curves (thinned when there are many).
    const censored = thin(
        treated
          .filter((v) => !v.event && v.time < tau)
          .sort((p, q) => p.time - q.time),
        60,
      ),
      ticks = plot.layer("censor-ticks");
    censored.forEach((v) => {
      censorTick(
        plot,
        v.time,
        kmS(a.naive, v.time),
        { stroke: "var(--muted)" },
        ticks,
      );
      censorTick(
        plot,
        v.time,
        a.standardizedS(v.time),
        { stroke: "var(--purple)", opacity: 0.7 },
        ticks,
      );
    });
    plot.vline(tau, { stroke: "var(--ink)", opacity: 0.6 }, "τ");
    // Labels inside the shaded regions.
    const xr = tau * 0.3,
      dRMST = a.trueRMST - b.trueRMST;
    plot.text(xr, a.truthS(xr) / 2, `RMST₁(τ) = ${fmt(a.trueRMST, 2)} y`, {
      class: "fig-text ink",
      "text-anchor": "middle",
      fill: "var(--green)",
    });
    const xd = tau * 0.97,
      yd = b.truthS(xd) - 0.05;
    plot.text(xd, yd, `ΔRMST = ${fmt(dRMST, 2)} y`, {
      class: "fig-text ink",
      "text-anchor": "end",
      fill: "var(--teal)",
    });
    tails.forEach((tl, i) =>
      plot.text(
        tl.T,
        0.05 + 0.06 * i,
        `${tl.label} KM carried forward from t = ${fmt(tl.T, 1)}`,
        {
          class: "fig-text",
          "text-anchor": tl.T > tau * 0.55 ? "end" : "start",
          fill: tl.color,
        },
      ),
    );
    readout("survival-readout", [
      ["τ", tau + " y"],
      ["S₁(τ) truth", fmt(a.truthS(tau))],
      ["pooled KM", fmt(a.naive.s)],
      ["standardized", fmt(a.standardizedS(tau))],
      ["RMST₁ truth", fmt(a.trueRMST, 2) + " y"],
      ["RMST₀ truth", fmt(b.trueRMST, 2) + " y"],
      ["ΔRMST truth", fmt(dRMST, 2) + " y"],
      ["ΔRMST pooled", fmt(a.naive.rmst - b.naive.rmst, 2) + " y"],
      [
        "ΔRMST standardized",
        fmt(a.standardizedRMST - b.standardizedRMST, 2) + " y",
      ],
      ["censored", fmt(r.censored * 100, 1) + "%"],
    ]);
    const nC = treated.filter((v) => !v.event && v.time < tau).length;
    byId("survival-caption").textContent =
      `Green shading is RMST₁(τ) = ${fmt(a.trueRMST, 2)} years, the area under the treated truth curve up to τ = ${tau}; the teal band between the two truth curves is the RMST difference ${fmt(dRMST, 2)} years. Pooled KM misses the truth at τ by ${fmt(a.naive.s - a.truthS(tau), 3)}, standardization by ${fmt(a.standardizedS(tau) - a.truthS(tau), 3)}.` +
      (nC
        ? ` ${nC} treated patients were censored before τ${censored.length < nC ? ` (every ${Math.ceil(nC / 60)}th shown as a tick)` : ""}.`
        : " Nobody is censored before τ.") +
      (tails.length
        ? " A dotted tail marks a curve carried forward with nobody observed."
        : "");
  }

  /* ---------- Step 3: standardization as a weighted average ---------- */
  function drawStd() {
    const { c, r } = cache,
      tau = c.tau,
      a = r.arms[1],
      p = S.mean(r.rows.map((v) => v.x)),
      treatedRows = r.rows.filter((v) => v.a === 1),
      pT = S.mean(treatedRows.map((v) => v.x)),
      w = stdW === null ? p : stdW,
      mix = (t) => (1 - w) * kmS(a.strata[0], t) + w * kmS(a.strata[1], t),
      times = [
        0,
        ...new Set(a.strata.flatMap((s) => s.points.map((q) => q[0]))),
      ].sort((x, y) => x - y),
      plot = new Plot(byId("std-svg"), {
        x: [0, tau],
        y: [0, 1],
        width: 640,
        height: 300,
        xlabel: "Years",
        ylabel: "Treated KM by stratum",
      });
    plot.step(a.strata[0].points, { stroke: "var(--p)" });
    plot.step(a.strata[1].points, { stroke: "var(--or)" });
    plot.step(
      times.map((t) => [t, mix(t)]),
      { stroke: "var(--purple)", "stroke-width": 3 },
    );
    [
      ["low-severity treated KM", "var(--p)"],
      [`(1 − w)·low + w·high, w = ${fmt(w, 2)}`, "var(--purple)"],
      ["high-severity treated KM", "var(--or)"],
    ].forEach(([k, col], i) =>
      plot.text(tau * 0.02, 0.2 - 0.065 * i, k, {
        class: "fig-text ink",
        fill: col,
      }),
    );
    const bars = new Plot(byId("std-weights"), {
      x: [0, 4.4],
      y: [0, 1],
      width: 300,
      height: 220,
      margin: { l: 40, r: 10, t: 22, b: 40 },
      xticks: [1.2, 3.2],
      yticks: [0, 0.25, 0.5, 0.75, 1],
      tickFormat: (v) => (v === 1.2 ? "low" : v === 3.2 ? "high" : fmt(v, 2)),
      xlabel: "Severity stratum weight",
    });
    bars.bars(
      [
        [0.65, 1 - p],
        [2.65, p],
      ],
      0.5,
      { fill: "var(--purple)" },
    );
    bars.bars(
      [
        [1.2, 1 - pT],
        [3.2, pT],
      ],
      0.5,
      { fill: "var(--muted)" },
    );
    bars.bars(
      [
        [1.75, 1 - w],
        [3.75, w],
      ],
      0.5,
      { fill: "none", stroke: "var(--phat)", "stroke-width": 2 },
    );
    [
      ["cohort", "var(--purple)"],
      ["treated only", "var(--muted)"],
      ["chosen w", "var(--phat)"],
    ].forEach(([k, col], i) =>
      bars.fg.append(
        el(
          "text",
          { class: "fig-text", x: [42, 106, 214][i], y: 14, fill: col },
          k,
        ),
      ),
    );
    readout("std-readout", [
      ["cohort share high", fmt(p, 3)],
      ["treated share high", fmt(pT, 3)],
      ["chosen w", fmt(w, 2)],
      ["mix S(τ)", fmt(mix(tau))],
      ["standardized S(τ)", fmt(a.standardizedS(tau))],
      ["pooled KM S(τ)", fmt(a.naive.s)],
    ]);
    byId("std-caption").textContent =
      `The purple curve is (1 − w)·KM_low + w·KM_high with w = ${fmt(w, 2)}. At w = ${fmt(p, 2)}, the cohort's share of high severity, it is the standardized curve, S(τ) = ${fmt(a.standardizedS(tau))}. ` +
      `Treated patients are ${fmt(pT * 100, 0)}% high severity, so pooled KM (S(τ) = ${fmt(a.naive.s)}) leans on the faster-falling orange curve; move w to ${fmt(pT, 2)} to see roughly where it lands.`;
  }
  const stdSlider = byId("std-weight");
  stdSlider.addEventListener("input", () => {
    stdW = +stdSlider.value;
    if (cache) drawStd();
  });

  /* ---------- Step 4: marginal hazard ratio over time ---------- */
  function drawHR() {
    const { c } = cache,
      tau = c.tau,
      time = grid(tau),
      cohort = time.map((t) => [t, marginalHR(t, COHORT_W)]),
      treatedMix = time.map((t) => [t, marginalHR(t, TREATED_W)]),
      hi = Math.max(...cohort.map((q) => q[1]), ...treatedMix.map((q) => q[1])),
      ymax = Math.max(0.8, Math.ceil((hi + 0.03) * 20) / 20),
      plot = new Plot(byId("hr-svg"), {
        x: [0, tau],
        y: [0.6, ymax],
        width: 640,
        height: 300,
        xlabel: "Years",
        ylabel: "Marginal hazard ratio HR(t)",
        tickFormat: (v) => fmt(v, 2),
      }),
      t = hrClock * tau;
    plot.hline(HR, { stroke: "var(--muted)" });
    plot.text(tau * 0.02, HR - 0.012, "conditional HR = 0.65", {
      fill: "var(--muted)",
    });
    plot.line(treatedMix, { stroke: "var(--or)", "stroke-dasharray": "6 4" });
    plot.line(cohort, { stroke: "var(--purple)" });
    plot.vline(t, { stroke: "var(--phat)" });
    plot.scatter([[t, marginalHR(t, COHORT_W)]], 4.5, {
      fill: "var(--purple)",
    });
    plot.scatter([[t, marginalHR(t, TREATED_W)]], 4.5, { fill: "var(--or)" });
    plot.text(tau * 0.02, ymax - 0.012, "whole-cohort severity mix", {
      fill: "var(--purple)",
    });
    plot.text(tau * 0.02, ymax - 0.03, "treated-only severity mix", {
      fill: "var(--or)",
    });
    readout("hr-readout", [
      ["t", fmt(t, 2) + " y"],
      ["HR(t), cohort mix", fmt(marginalHR(t, COHORT_W))],
      ["HR(t), treated mix", fmt(marginalHR(t, TREATED_W))],
      ["high-severity share at risk, control", fmt(highShare(0, t))],
      ["high-severity share at risk, treated", fmt(highShare(1, t))],
      ["HR(τ), cohort mix", fmt(marginalHR(tau, COHORT_W))],
    ]);
    byId("hr-caption").textContent =
      `At t = 0 every risk set has the baseline severity mix and HR(0) = 0.65. By t = ${fmt(t, 2)}, high-severity patients are ${fmt(highShare(0, t) * 100, 0)}% of the control risk set but ${fmt(highShare(1, t) * 100, 0)}% of the treated one (treatment slowed their exit), so the marginal hazard ratio is ${fmt(marginalHR(t))}: the same conditional 0.65 is not the population hazard ratio. Starting from the treated-only mix (${fmt(treatedShare * 100, 0)}% high severity) drifts further.`;
  }
  const hrSlider = byId("hr-time");
  hrSlider.addEventListener("input", () => {
    hrClock = +hrSlider.value;
    if (cache) drawHR();
  });

  /* ---------- full render on state change ---------- */
  function render() {
    const c = state.get(),
      r = S.survival({ ...c, n: Math.round(c.n) }),
      a = r.arms[1];
    cache = { c, r };
    byId("survival-target").textContent =
      `S₁(${c.tau})−S₀(${c.tau}) or ∫₀^${c.tau} [S₁(t)−S₀(t)] dt. The population is everyone in this synthetic cohort.`;
    byId("censoring-status").textContent =
      `${fmt(r.censored * 100, 1)}% of event times are censored. n=${c.n}; seed=${c.seed}.`;
    byId("risk-table").innerHTML = table(
      [
        "Arm and stratum",
        "At baseline",
        "Events by τ",
        "Censored by τ",
        "Still observed at τ",
      ],
      [1, 0].flatMap((arm) =>
        [0, 1].map((x) => {
          const rows = r.rows.filter((v) => v.a === arm && v.x === x);
          return [
            `${arm ? "Treated" : "Control"}, ${x ? "high" : "low"} severity`,
            rows.length,
            rows.filter((v) => v.event && v.time <= c.tau).length,
            rows.filter((v) => !v.event && v.time < c.tau).length,
            rows.filter((v) => v.time >= c.tau).length,
          ];
        }),
      ),
      "Risk sets by arm and severity",
    );
    drawKM();
    drawSurvival();
    drawStd();
    stdSlider.value = stdW === null ? S.mean(r.rows.map((v) => v.x)) : stdW;
    drawHR();
    byId("survival-values").innerHTML = table(
      ["Time", "Truth S₁", "Pooled KM", "Standardized KM"],
      [0, c.tau / 2, c.tau].map((t) => [
        fmt(t),
        fmt(a.truthS(t)),
        fmt(kmS(a.naive, t)),
        fmt(a.standardizedS(t)),
      ]),
    );
    byId("rmst-values").innerHTML = table(
      ["Target through τ", "Truth", "Pooled KM", "Standardized KM"],
      [
        [
          "Everyone control RMST",
          fmt(r.arms[0].trueRMST),
          fmt(r.arms[0].naive.rmst),
          fmt(r.arms[0].standardizedRMST),
        ],
        [
          "Everyone treated RMST",
          fmt(a.trueRMST),
          fmt(a.naive.rmst),
          fmt(a.standardizedRMST),
        ],
        [
          "Difference, years",
          fmt(a.trueRMST - r.arms[0].trueRMST),
          fmt(a.naive.rmst - r.arms[0].naive.rmst),
          fmt(a.standardizedRMST - r.arms[0].standardizedRMST),
        ],
      ],
    );
    const supported = r.arms.every((arm) => arm.strata.every((s) => s.support));
    byId("support-status").textContent = supported
      ? "Each arm/severity cell supports this horizon: observation continues to τ, or its KM curve has already reached zero. Finite-sample accuracy still depends on the risk-set sizes."
      : "At least one cell has nobody observed through τ. Its KM curve is carried forward for display, but its tail and RMST require support or extrapolation. Shorten the horizon, reduce censoring, or increase n.";
    byId("hazard-values").textContent =
      `Conditional HR = 0.65. Marginal HR at baseline = ${fmt(marginalHR(0))}; at ${c.tau} years = ${fmt(marginalHR(c.tau))}.`;
  }
  state.subscribe(render);
  render();
  byId("save-horizon").onclick = () => {
    Causality.event({ type: "contract", value: { horizon: state.get().tau } });
    byId("horizon-status").textContent = "Horizon saved to your contract.";
  };
  guided(root, state);
  tools(root, state);
  window.SurvivalLab = { kmTrace, marginalHR, hazard, kmPlayer };
})();
