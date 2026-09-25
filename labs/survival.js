(function () {
  const { S, store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player } = CausalAnim,
    root = document.querySelector("[data-lab]"),
    state = store(
      "survival",
      {
        step: 0,
        tau: 5,
        n: 1200,
        censor: 2,
        seed: 20260919,
        stdW: -1,
        hrT: 0,
        hrMix: "cohort",
      },
      {
        step: [0, 3],
        tau: [1, 10],
        n: [200, 5000],
        censor: [0, 4],
        seed: [1, 4294967295],
        stdW: [-1, 1],
        hrT: [0, 1],
        hrMix: ["cohort", "treated"],
      },
    );
  root.innerHTML = `<section class="lab-step" data-title="Choose a survival target"><h2 tabindex="-1">“Does it improve survival?” still needs a target</h2><p>Extend the severity-and-treatment study to time until an event. Choose a time horizon. Compare the chance of surviving to that time, or average event-free time up to it. These answer different clinical questions from a conditional hazard ratio.</p><label>Horizon τ, years <input id="horizon" type="range" min="1" max="10" step=".5"></label><p class="math" id="survival-target"></p><p>Restricted mean survival time, RMST(τ), is the area under a survival curve from 0 to τ. A difference of 0.4 years means an average additional 0.4 event-free years within that window.</p><button id="save-horizon">Save this survival question</button><p id="horizon-status" role="status"></p><p class="note">This extension changes the outcome to time until an event. Its treatment effect is not the numerical ATE=2 used in the continuous-outcome simulation.</p></section>
<section class="lab-step" data-title="See selection"><h2 tabindex="-1">The risk set changes as people leave it</h2><p>In this generator, high-severity patients have a higher event rate and receive treatment more often. They can also be censored sooner. Event and censoring times are independent conditional on severity and treatment; they need not be independent within pooled treatment groups.</p><label>Severity dependence of censoring (0 turns censoring off) <input id="censoring" type="range" min="0" max="4" step=".25"></label><label>Cohort size <input id="cohort-n" type="range" min="200" max="5000" step="200"></label><label>Seed <input id="survival-seed" type="number" min="1" step="1"></label><p id="censoring-status"></p>
<div class="figure" id="km-figure"><p class="legend legend-swatches km-legend" id="km-legend"><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--p)"/></svg>Low severity</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--or)"/></svg>High severity</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--muted)"/></svg>Filled: still at risk</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--muted)" stroke-width="2"/></svg>Hollow: censored</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><path d="M2 2L12 12M12 2L2 12" stroke="var(--muted)" stroke-width="2.4"/></svg>Cross: event (death)</span></p><div class="fig-row"><div><svg id="km-svg" role="img" aria-label="Kaplan–Meier construction for an illustrative strip of 24 treated patients: a row of patients ordered by time above a survival curve that steps down at each death as calendar time advances. Colour shows severity throughout; filled means still at risk, hollow means censored, a cross means an event."></svg><div id="km-player"></div></div><div><div class="fig-readout" id="km-readout"></div></div></div><p class="fig-caption" id="km-caption"></p><p class="note" id="km-why"></p></div>
<div id="risk-table"></div><p>A low censoring rate is not evidence that censoring is independent. This experiment declares its mechanism so we can check estimators against a known target.</p></section>
<section class="lab-step" data-title="Compare curves"><h2 tabindex="-1">Separate the estimator from the question</h2>
<div class="figure" id="survival-figure"><div class="fig-row"><div><svg id="survival-plot" role="img" aria-label="Treated survival: truth, pooled Kaplan–Meier, and severity-standardized Kaplan–Meier, with the control truth curve, the RMST area shaded to the horizon, and censoring ticks. Exact selected-time values follow."></svg><p class="legend legend-swatches"><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--green)" stroke-width="2.5"/></svg>Everyone treated, truth</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="6 4"/></svg>Everyone control, truth</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="6 4"/></svg>Pooled treated KM</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--purple)" stroke-width="2.5" stroke-dasharray="2 3"/></svg>Standardized treated KM</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="14" y1="0" x2="14" y2="10" stroke="var(--muted)" stroke-width="1.5"/></svg>Censoring</span></p></div><div><div class="fig-controls"><label>Horizon τ, years <input id="horizon-2" type="range" min="1" max="10" step=".5"></label><label>Severity dependence of censoring <input id="censoring-2" type="range" min="0" max="4" step=".25"></label></div><div class="fig-readout" id="survival-readout"></div></div></div><p class="fig-caption" id="survival-caption"></p></div>
<div id="survival-values"></div><div id="rmst-values"></div><p id="support-status" class="warning"></p><p>Standardization fits KM within each severity/treatment group and averages over the whole cohort's severity distribution. In this finite-stratum example, it adjusts both measured baseline confounding and censoring that is independent within those strata. Pooled KM among treated people uses a different severity mix and may also violate its censoring condition.</p>
<div class="predict" data-options="Exactly at the treated share of high severity, about 0.52|Between the cohort share and the treated share|Below the cohort share, 0.35" data-answer="1" data-hint="Two distortions pull in opposite directions. The treated arm is sicker, which pushes w up; sicker patients are also censored sooner, which pulls the pooled risk set back toward low severity. Press Match pooled KM to see the w it implies here.">Predict: the pooled treated KM is itself some blend of the two stratum curves. Treated patients are about 52% high severity and the cohort is 35%. Where does pooled KM land on the w scale?</div>
<div class="figure" id="std-figure"><p class="legend legend-swatches"><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--p)" stroke-width="2.5"/></svg>Low-severity treated KM</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--or)" stroke-width="2.5"/></svg>High-severity treated KM</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--purple)" stroke-width="3.5"/></svg>Blend (1 − w)·low + w·high</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--muted)" stroke-width="2.5" stroke-dasharray="6 4"/></svg>Pooled treated KM</span></p><div class="fig-row"><div><svg id="std-svg" role="img" aria-label="The two stratum-specific treated Kaplan–Meier curves, low and high severity, their blend with weight w on the high-severity curve, and the pooled treated KM for comparison. Values follow as text."></svg></div><div><div class="fig-controls"><label>Weight w on the high-severity curve <output id="std-w-out"></output><input id="std-weight" type="range" min="0" max="1" step=".01"></label></div><div class="btns std-btns"><button type="button" id="std-cohort">w = cohort share</button><button type="button" id="std-treated">w = treated share</button><button type="button" id="std-pooled">Match pooled KM</button></div><div class="fig-readout" id="std-readout"></div></div></div><p class="fig-caption" id="std-caption"></p></div>
<p>For continuous covariates and longitudinal histories, conditional survival regressions and inverse censoring weights generalize the adjustment. Identification still requires exchangeability, consistency, treatment positivity, and censoring positivity through the chosen horizon.</p></section>
<section class="lab-step" data-title="Connect Cox to geometry"><h2 tabindex="-1">Cox already contains an infinite-dimensional part</h2><p class="math">λ(t | A,X) = λ₀(t) exp(βA + γX)</p><p>The baseline hazard λ₀ is unspecified; β and γ are finite-dimensional. This is a semiparametric model. Its regression coefficient β targets a conditional log hazard ratio under proportional hazards. It is not automatically a marginal survival contrast or an RMST difference.</p><p>Here the conditional treatment hazard ratio is 0.65 at every severity level. Mixing severity groups creates different evolving risk sets; the population hazard ratio need not stay at 0.65. Conditional proportional hazards does not make every marginal contrast proportional.</p>
<div class="predict" data-options="Still 0.65|Above 0.65, drifting toward 1|Below 0.65" data-answer="1" data-hint="Within each jar, high-severity marbles leave fastest. They leave the control jar faster than the treated jar, so after a while the treated jar holds a sicker mix. Its average hazard is pushed up, and the ratio rises above 0.65 even though no one's own hazard ratio changed.">Predict: two risk sets start with the same severity mix, and treatment multiplies every patient's hazard by exactly 0.65. After five years, what is the hazard ratio between the two risk sets?</div>
<div class="figure" id="hr-figure"><p class="legend legend-swatches"><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--p)"/></svg>Low severity, hazard 0.08 per year under control</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--or)"/></svg>High severity, hazard 0.32 per year under control</span><span><svg class="swatch" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="var(--muted)" opacity=".25"/></svg>Faded: already had the event</span></p><div class="fig-row"><div><svg id="hr-jars" class="fig" role="img" aria-label="Two risk-set jars, control and treated, each starting with 100 marbles in the same severity mix. Marbles fade as their expected share of the risk set has an event. Exact shares and hazards follow as text."></svg><div id="hr-player"></div><label class="hr-mix">Both jars start with <select id="hr-mix"><option value="cohort">the whole cohort's severity mix</option><option value="treated">the treated-only severity mix</option></select></label></div><div class="hr-ticker" id="hr-ticker" aria-live="off"></div></div><svg id="hr-svg" role="img" aria-label="Trail of the marginal hazard ratio over time for the whole-cohort and treated-only starting mixes, against the conditional hazard ratio 0.65."></svg><p class="fig-caption" id="hr-caption"></p><div class="fig-readout" id="hr-readout"></div></div>
<p class="math" id="hazard-values"></p><p>Carry the geometry back to this setting: permitted changes in baseline hazard and covariate distributions form directions in the statistical model. Which directions are nuisance directions depends on whether your target is β, survival at τ, or RMST. Choose that target first.</p><p class="note">No Cox model is fitted in this laboratory. The conditional hazard ratio is a known generator parameter. The jars and the ticker are exact population calculations (expected counts out of 100, no sampling); the displayed finite-sample estimators are Kaplan–Meier and stratified standardization.</p><h3>Where this goes next</h3><p>Stratified standardization is the plug-in estimator of the survival curve you want: fit the curve within each severity group, then average over the target population. With continuous covariates the plug-in leans on a model, and it inherits that model's bias. The final lesson keeps the same target, weights for censoring, and then targets the curve itself so that S(τ) and ΔRMST come with honest intervals.</p><a class="course-btn" href="23-targeted-survival.html">Next: Targeted survival curves and ΔRMST →</a></section>
<style>
.km-legend{margin:0 0 .5rem}
.std-btns{display:flex;flex-wrap:wrap;gap:.5rem;margin:.5rem 0}
.std-btns button{min-height:40px}
.hr-mix{margin-top:.6rem}
.hr-ticker{border:1px solid var(--rule);border-radius:10px;padding:.8rem 1rem;background:var(--soft);font-size:14px;line-height:1.45}
.hr-ticker .big{font:600 40px/1.1 "IBM Plex Mono",monospace;color:var(--purple);margin:.15rem 0 .35rem}
.hr-ticker .k{color:var(--muted);font:500 13px "IBM Plex Mono",monospace}
.hr-ticker .row{margin:.35rem 0;font-family:"IBM Plex Mono",monospace;font-size:13px}
.hr-ticker .row b{color:var(--ink)}
#hr-svg{margin-top:.75rem}
#hr-jars{max-width:480px}
</style>`;
  [
    ["horizon", "tau"],
    ["horizon-2", "tau"],
    ["censoring", "censor"],
    ["censoring-2", "censor"],
    ["cohort-n", "n"],
    ["survival-seed", "seed"],
    ["hr-mix", "hrMix"],
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
    // Figure settings live in the validated store so Reset and Share reproduce them:
    // stdW < 0 means "follow the cohort share"; hrT is the jar clock as a fraction of τ.
    stdWget = () => (state.get().stdW < 0 ? null : state.get().stdW);

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
        margin: { l: 54, r: 18, t: 104, b: 44 },
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
        `Illustrative strip: the first ${data.length} treated patients, ordered by time`,
      ),
    );
    data.forEach((v, i) => {
      // Colour is severity, always. Filled = at risk, hollow = censored, cross = event.
      const x = L + i * gap,
        gone = v.time <= t,
        sev = v.x ? "var(--or)" : "var(--p)";
      dots.append(
        gone && v.event
          ? el("path", {
              d: `M${x - 5.5} ${38 - 5.5}L${x + 5.5} ${38 + 5.5}M${x + 5.5} ${38 - 5.5}L${x - 5.5} ${38 + 5.5}`,
              stroke: sev,
              "stroke-width": 3,
              "stroke-linecap": "round",
            })
          : el("circle", {
              cx: x,
              cy: 38,
              r: gone ? 5.5 : 6.5,
              fill: gone ? "none" : sev,
              stroke: sev,
              "stroke-width": 2,
            }),
        el(
          "text",
          {
            class: "tick",
            x,
            y: 64 + (i % 2) * 17,
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
    plot.step(curve, { stroke: "var(--ink)" });
    const ticks = plot.layer("km-ticks");
    done
      .filter((x) => x.c > 0)
      .forEach((x) =>
        censorTick(plot, x.t, x.s, { stroke: "var(--muted)" }, ticks),
      );
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
    let sentence = `Clock at t = 0: all ${data.length} patients are at risk and Ŝ = 1. Colour shows severity for the whole animation; a dot turns into a cross at an event and goes hollow when censored. Press Play to advance calendar time to τ = ${tau}.`;
    if (last && last.d > 0) {
      const prev = done.length > 1 ? done.at(-2).s : 1;
      sentence = `At t = ${fmt(last.t, 2)} ${last.d === 1 ? "one" : last.d} of ${last.atRisk} at risk died: multiply by ${last.atRisk - last.d}/${last.atRisk}, so Ŝ falls from ${fmt(prev, 3)} to ${fmt(last.s, 3)}. ${last.after} remain at risk.`;
    } else if (last) {
      sentence = `At t = ${fmt(last.t, 2)} ${last.c === 1 ? "one patient was" : last.c + " patients were"} censored (hollow dot, small tick on the curve): ${last.atRisk} at risk become ${last.after}; Ŝ stays ${fmt(last.s, 3)}, but the next death divides by a smaller risk set.`;
    }
    if (kmClock >= 1)
      sentence += ` At the horizon, Ŝ(τ) = ${fmt(sNow, 3)} against the arm truth ${fmt(r.arms[1].truthS(tau), 3)}; ${data.filter((v) => v.time > tau).length} patients (labelled >τ) were still observed at τ.`;
    byId("km-caption").textContent = sentence;
    const nHigh = data.filter((v) => v.x).length,
      full = r.arms[1].naive.s,
      drops = steps
        .map((x, i) => (i ? steps[i - 1].s : 1) - x.s)
        .filter((d) => d > 0)
        .map((d) => d * 100),
      jump = drops.length
        ? `each death moves Ŝ by ${fmt(Math.min(...drops), 0)} to ${fmt(Math.max(...drops), 0)} points`
        : "a single death would move Ŝ by at least 4 points";
    byId("km-why").textContent =
      `Why is the strip's Ŝ(τ) = ${fmt(steps.length ? steps.at(-1).s : 1, 3)} so far from the green truth ${fmt(r.arms[1].truthS(tau), 3)}? The green curve is everyone in the cohort treated, ${fmt(S.prevalence * 100, 0)}% high severity. This strip is ${nHigh} of ${data.length} high severity (${fmt((nHigh / data.length) * 100, 0)}%, like the treated arm), and with only ${data.length} patients ${jump}, so chance adds to the sicker mix. The strip is illustrative; the full treated arm (${r.rows.filter((v) => v.a === 1).length} patients) gives pooled KM ${fmt(full, 3)} in the next step.`;
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
        ? ` ${nC} treated patients were censored before τ${censored.length < nC ? ` (one in every ${Math.ceil(nC / 60)} shown as a tick)` : ""}.`
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
      w = stdWget() === null ? p : stdWget(),
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
    plot.step(a.naive.points, {
      stroke: "var(--muted)",
      "stroke-dasharray": "7 5",
    });
    plot.step(
      times.map((t) => [t, mix(t)]),
      { stroke: "var(--purple)", "stroke-width": 3.5 },
    );
    plot.vline(tau, { stroke: "var(--ink)", opacity: 0.4 });
    plot.scatter([[tau, mix(tau)]], 5, { fill: "var(--purple)" });
    const lo = kmS(a.strata[0], tau),
      hi = kmS(a.strata[1], tau),
      wPooled =
        Math.abs(lo - hi) > 1e-9
          ? Math.max(0, Math.min(1, (lo - a.naive.s) / (lo - hi)))
          : null;
    byId("std-w-out").textContent = fmt(w, 2);
    byId("std-cohort").textContent = `w = cohort share (${fmt(p, 2)})`;
    byId("std-treated").textContent = `w = treated share (${fmt(pT, 2)})`;
    byId("std-pooled").disabled = wPooled === null;
    byId("std-pooled").textContent =
      wPooled === null ? "Match pooled KM" : `Match pooled KM (${fmt(wPooled, 2)})`;
    stdTargets = { p, pT, wPooled };
    readout("std-readout", [
      ["chosen w", fmt(w, 2)],
      ["low-severity KM S(τ)", fmt(lo)],
      ["high-severity KM S(τ)", fmt(hi)],
      ["blend S(τ)", fmt(mix(tau))],
      ["standardized S(τ), w = cohort", fmt(a.standardizedS(tau))],
      ["pooled KM S(τ)", fmt(a.naive.s)],
      ["w that reproduces pooled", wPooled === null ? "n/a" : fmt(wPooled, 2)],
      ["truth S₁(τ)", fmt(a.truthS(tau))],
    ]);
    byId("std-caption").textContent =
      `The purple blend is (1 − w)·KM_low + w·KM_high = ${fmt(1 - w, 2)} × ${fmt(lo)} + ${fmt(w, 2)} × ${fmt(hi)} = ${fmt(mix(tau))} at τ. At w = ${fmt(p, 2)}, the cohort's share of high severity, the blend is the standardized curve. ` +
      (wPooled === null
        ? "The two stratum curves meet at τ, so every w gives the same value there."
        : `Pooled KM behaves like w = ${fmt(wPooled, 2)}: treated patients are ${fmt(pT * 100, 0)}% high severity, ${c.censor > 0 ? "but high-severity patients are also censored sooner, which thins them out of the pooled risk set" : "and with censoring off pooled KM uses exactly that mix"}. Neither is the cohort's mix, so pooled KM answers a different question.`);
  }
  let stdTargets = null;
  [
    ["std-cohort", "p"],
    ["std-treated", "pT"],
    ["std-pooled", "wPooled"],
  ].forEach(([id, k]) =>
    byId(id).addEventListener("click", () => {
      if (stdTargets?.[k] != null)
        state.set({ stdW: k === "p" ? -1 : Math.round(stdTargets[k] * 100) / 100 });
    }),
  );
  const stdSlider = byId("std-weight");
  stdSlider.addEventListener("input", () =>
    state.set({ stdW: +stdSlider.value }),
  );

  /* ---------- Step 4: two risk-set jars and a hazard-ratio ticker ---------- */
  // Exact expected counts out of 100 per jar: n_x(t) = 100·w_x·exp(−λ_x t). No sampling.
  const JAR_N = 100,
    jarLayout = (() => {
      let seed = 7;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647),
        slots = Array.from({ length: JAR_N }, (_, i) => i);
      for (let i = slots.length - 1; i > 0; i--) {
        const k = Math.floor(rand() * (i + 1));
        [slots[i], slots[k]] = [slots[k], slots[i]];
      }
      return slots; // slot order; the first H slots hold high-severity marbles
    })();
  let hrLocal = state.get().hrT,
    hrSave = null;
  const hrMixW = () => (state.get().hrMix === "treated" ? TREATED_W : COHORT_W);
  function drawJars(t) {
    const svg = byId("hr-jars"),
      w = hrMixW(),
      H0 = Math.round(JAR_N * w[1]),
      L0 = JAR_N - H0;
    svg.setAttribute("viewBox", "0 0 460 300");
    svg.replaceChildren();
    [0, 1].forEach((arm) => {
      const x0 = 20 + arm * 230,
        rates = RATES.map((v) => v * (arm ? HR : 1)),
        left = [L0 * Math.exp(-rates[0] * t), H0 * Math.exp(-rates[1] * t)],
        share = highShare(arm, t, w),
        haz = hazard(arm, t, w);
      svg.append(
        el(
          "text",
          { x: x0 + 100, y: 26, "text-anchor": "middle", style: "font:600 19px 'IBM Plex Sans',system-ui,sans-serif;fill:var(--ink)" },
          arm ? "Treated risk set" : "Control risk set",
        ),
        el("path", {
          d: `M${x0} 40 V224 Q${x0} 240 ${x0 + 16} 240 H${x0 + 184} Q${x0 + 200} 240 ${x0 + 200} 224 V40`,
          fill: "var(--paper)",
          stroke: "var(--rule)",
          "stroke-width": 2.5,
        }),
      );
      // Rank within severity decides who leaves first; slots fix the positions.
      let rank = [0, 0];
      jarLayout.forEach((slot, i) => {
        const x = i < H0 ? 1 : 0,
          k = rank[x]++,
          present = Math.max(0, Math.min(1, left[x] - k)),
          col = slot % 10,
          row = Math.floor(slot / 10);
        svg.append(
          el("circle", {
            cx: x0 + 19 + col * 18,
            cy: 60 + row * 18,
            r: 7,
            fill: x ? "var(--or)" : "var(--p)",
            opacity: 0.16 + 0.84 * present,
          }),
        );
      });
      svg.append(
        el(
          "text",
          { x: x0 + 100, y: 266, "text-anchor": "middle", style: "font:500 18px 'IBM Plex Sans',system-ui,sans-serif;fill:var(--ink)" },
          `${fmt(share * 100, 0)}% high severity`,
        ),
        el(
          "text",
          { x: x0 + 100, y: 291, "text-anchor": "middle", style: "font:18px 'IBM Plex Sans',system-ui,sans-serif;fill:var(--muted)" },
          `hazard ${fmt(haz, 3)}/yr`,
        ),
      );
    });
  }
  function drawHR() {
    const { c } = cache,
      tau = c.tau,
      w = hrMixW(),
      mixName = c.hrMix === "treated" ? "treated-only" : "whole-cohort",
      time = grid(tau),
      cohort = time.map((q) => [q, marginalHR(q, COHORT_W)]),
      treatedMix = time.map((q) => [q, marginalHR(q, TREATED_W)]),
      hi = Math.max(...cohort.map((q) => q[1]), ...treatedMix.map((q) => q[1])),
      ymax = Math.max(0.8, Math.ceil((hi + 0.03) * 20) / 20),
      t = hrLocal * tau,
      hrNow = marginalHR(t, w),
      plot = new Plot(byId("hr-svg"), {
        x: [0, tau],
        y: [0.6, ymax],
        width: 640,
        height: 230,
        margin: { l: 54, r: 18, t: 22, b: 44 },
        xlabel: "Years",
        ylabel: "HR(t) between the jars",
        tickFormat: (v) => fmt(v, 2),
      });
    drawJars(t);
    plot.hline(HR, { stroke: "var(--muted)", "stroke-dasharray": "4 4" });
    const selCohort = c.hrMix !== "treated";
    plot.line(treatedMix, { stroke: "var(--or)", "stroke-dasharray": "6 4", opacity: selCohort ? 0.35 : 1 });
    plot.line(cohort, { stroke: "var(--purple)", opacity: selCohort ? 1 : 0.35 });
    // The trail: the part of the selected curve already swept by the clock.
    plot.line(
      time.filter((q) => q <= t).concat([t]).map((q) => [q, marginalHR(q, w)]),
      { stroke: selCohort ? "var(--purple)" : "var(--or)", "stroke-width": 4 },
    );
    plot.vline(t, { stroke: "var(--phat)" });
    plot.scatter([[t, hrNow]], 5.5, { fill: selCohort ? "var(--purple)" : "var(--or)" });
    const s0 = highShare(0, t, w),
      s1 = highShare(1, t, w),
      h0 = hazard(0, t, w),
      h1 = hazard(1, t, w);
    byId("hr-ticker").innerHTML =
      `<div class="k">Hazard ratio between the jars at t = ${fmt(t, 1)} years</div>` +
      `<div class="big">${hrNow.toFixed(3)}</div>` +
      `<div>Inside every severity group the ratio is <b>0.65</b> at all times. Drift since t = 0: <b>${(hrNow - HR >= 0 ? "+" : "") + fmt(hrNow - HR, 3)}</b>, all of it from the mix.</div>` +
      `<div class="row">Control jar, ${fmt(s0 * 100, 0)}% high:<br>${fmt(1 - s0, 2)}×0.08 + ${fmt(s0, 2)}×0.32 = <b>${fmt(h0, 3)}</b></div>` +
      `<div class="row">Treated jar, ${fmt(s1 * 100, 0)}% high:<br>0.65×(${fmt(1 - s1, 2)}×0.08 + ${fmt(s1, 2)}×0.32) = <b>${fmt(h1, 3)}</b></div>` +
      `<div class="row">Ratio ${fmt(h1, 3)} ÷ ${fmt(h0, 3)} = <b>${fmt(hrNow, 3)}</b></div>`;
    readout("hr-readout", [
      ["t", fmt(t, 1) + " y"],
      ["HR(t), whole-cohort mix", fmt(marginalHR(t, COHORT_W))],
      ["HR(t), treated-only mix", fmt(marginalHR(t, TREATED_W))],
      ["HR(τ), whole-cohort mix", fmt(marginalHR(tau, COHORT_W))],
      ["HR(τ), treated-only mix", fmt(marginalHR(tau, TREATED_W))],
    ]);
    byId("hr-caption").textContent =
      `Both jars start with the ${mixName} mix (${fmt(w[1] * 100, 0)}% high severity) and HR(0) = 0.65. High-severity marbles leave fastest, and they leave the control jar faster than the treated jar. By t = ${fmt(t, 1)} they are ${fmt(s0 * 100, 0)}% of the control jar but ${fmt(s1 * 100, 0)}% of the treated jar, so the treated jar's average hazard is pushed up and the ratio reads ${fmt(hrNow, 3)}. Nobody's own hazard ratio changed. Trail: purple = whole-cohort start, orange dashed = treated-only start, grey dashed = 0.65.`;
  }
  const hrPlayer = player(byId("hr-player"), {
    duration: 9000,
    label: "Time t",
    formatValue: (u) => fmt(u * state.get().tau, 1) + " years",
    onT(u) {
      hrLocal = u;
      if (cache) drawHR();
      clearTimeout(hrSave);
      hrSave = setTimeout(() => {
        if (Math.abs(state.get().hrT - hrLocal) > 1e-3) state.set({ hrT: Math.round(hrLocal * 1000) / 1000 });
      }, 600);
    },
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
    stdSlider.value =
      stdWget() === null ? S.mean(r.rows.map((v) => v.x)) : stdWget();
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
    const tau = state.get().tau;
    Causality.event({ type: "contract", value: {
      target: "ate", population: S.prevalence, horizon: tau,
      measure: Causality.state().contract.measure === "rmst" ? "rmst" : "survival",
      scenario: { target: "ate", p: S.prevalence, tau, gLow: S.trueG(0), gHigh: S.trueG(1), hazardRatio: HR, delay: 0 },
    } });
    byId("horizon-status").textContent = "Saved this laboratory's survival question for everyone in the reference cohort.";
  };
  guided(root, state);
  tools(root, state);
  if (hrLocal > 0) hrPlayer.set(hrLocal);
  window.SurvivalLab = { kmTrace, marginalHR, hazard, kmPlayer, hrPlayer };
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail?.name === "survival") {
      kmPlayer.set(0);
      hrPlayer.set(0);
    }
  });
})();
