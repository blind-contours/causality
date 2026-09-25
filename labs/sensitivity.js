(function () {
  const { store, control, tools, guided, table } = CausalLab,
    { el, html, Plot, player } = CausalAnim,
    X = CausalSensitivity,
    root = document.querySelector("[data-lab]"),
    byId = (id) => document.getElementById(id),
    f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "undefined"),
    pp = (x) => (100 * x).toFixed(1),
    study = X.study(),
    F = study.full,
    sev = study.covariates.find((c) => c.key === "severity");

  const state = store(
    "sensitivity",
    {
      step: 0,
      kappa: 0.01,
      rrEU: 2,
      rrUD: 2,
      calcRR: 0.72,
      calcLo: 0.55,
      calcHi: 0.94,
    },
    {
      step: [0, 4],
      kappa: [0, 0.08],
      rrEU: [1, 6],
      rrUD: [1, 6],
      calcRR: [0.01, 100],
      calcLo: [0.01, 100],
      calcHi: [0.01, 100],
    },
  );

  const swatch = (inner) =>
    `<svg class="swatch" width="28" height="10" aria-hidden="true">${inner}</svg>`;
  const LEG = {
    point: `<span>${swatch('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--red)" stroke-width="2.5"/>')}B = ${f2(F.rr)}: explains away the estimate</span>`,
    ci: `<span>${swatch('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--teal)" stroke-width="2.5" stroke-dasharray="6 4"/>')}B = ${f2(F.rrLo)}: explains away the interval</span>`,
    iso: `<span>${swatch('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--muted)" stroke-width="1"/>')}Other values of B (top edge)</span>`,
    u: `<span>${swatch('<circle cx="14" cy="5" r="4.5" fill="var(--purple)"/>')}Your hypothesized confounder U</span>`,
    diag: `<span>${swatch('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="3 3"/>')}Equal strengths (the diagonal)</span>`,
    bench: `<span>${swatch('<circle cx="14" cy="5" r="4" fill="var(--ink)"/>')}Measured covariate (benchmark)</span>`,
  };

  root.innerHTML = `<style>
svg.sens-map .region-point{fill:var(--red);opacity:.13}
svg.sens-map .region-ci{fill:var(--teal);opacity:.12}
svg.sens-map .iso{stroke:var(--muted);stroke-width:1;fill:none;opacity:.55}
svg.sens-map .handle-hit{fill:transparent;cursor:grab;touch-action:none}
svg.sens-map.draggable{cursor:crosshair}
svg.sens-map .guide{stroke:var(--purple);stroke-width:1;stroke-dasharray:3 3;opacity:.7}
.sens-status{font-weight:500}
.sens-status.explained{color:var(--red)}
.report-list li{margin:8px 0}
.calc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px 14px}
.calc-grid input{width:100%;box-sizing:border-box;min-height:40px;font-size:16px}
@media (max-width:720px){
  svg.fig.fig-wide.sens-map .tick, svg.fig.fig-wide.sens-map .fig-text, svg.fig.fig-wide.sens-band .tick, svg.fig.fig-wide.sens-band .fig-text, svg.fig.fig-wide.sens-evalue .tick, svg.fig.fig-wide.sens-evalue .fig-text{font-size:19px}
  svg.fig.fig-wide.sens-map .axis-label, svg.fig.fig-wide.sens-band .axis-label, svg.fig.fig-wide.sens-evalue .axis-label{font-size:21px}
}
</style>
<section class="lab-step" data-title="Recall κ"><h2 tabindex="-1">How big would the hidden bias have to be?</h2>
<p>In the first lesson you broke exchangeability and met κ: two worlds with exactly the same observed patients whose causal effects differ by κ. The data could not tell them apart. That settled <em>whether</em> unmeasured confounding can hide in observed data. This lesson asks <em>how much</em> it would take to change your conclusion.</p>
<p>Here is a new observational safety study: ${study.n.toLocaleString("en-US")} patients, ${study.treated.toLocaleString("en-US")} of them started on a new drug, and a serious adverse event within one year as the outcome. Adjusting for severity, age 75+, diabetes and sex by standardization, the estimated risk difference is <strong>${pp(F.rd)} percentage points</strong> (95% CI ${pp(F.rdLo)} to ${pp(F.rdHi)}).</p>
<p>Suppose unmeasured confounding shifts the causal risk difference by an unknown amount of size at most κ. Then every value in ψ̂ ± κ is compatible with the data.</p>
<div class="predict" data-options="${pp(F.rd)} percentage points, the size of the estimate itself|1.96 standard errors, about ${pp(1.96 * F.seRD)} points|Any κ above zero moves the answer to zero" data-answer="0" data-hint="The band ψ̂ ± κ reaches zero exactly when κ equals |ψ̂|. The interval needs less: κ equal to the lower limit, ${pp(F.rdLo)} points.">How large must κ be before the band ψ̂ ± κ reaches zero, no effect?</div>
<div class="figure"><div class="fig-row"><div><svg id="band-svg" class="sens-band" role="img" aria-label="Risk difference in percentage points: the point estimate with its 95% confidence interval, the band estimate plus or minus kappa, and the interval widened by kappa, against a line at zero."></svg><p class="legend legend-swatches"><span>${swatch('<circle cx="14" cy="5" r="4.5" fill="var(--or)"/>')}Estimate and 95% CI (assumes no unmeasured confounding)</span><span>${swatch('<rect x="1" y="1" width="26" height="8" rx="3" fill="var(--purple)" opacity=".45"/>')}Allowing bias up to κ</span></p></div>
<div><div class="fig-controls"><label>Bias bound κ, percentage points <span id="kappa-val"></span><input id="kappa" type="range" min="0" max="0.08" step="0.001"></label></div><div class="fig-readout" id="band-readout"></div></div></div><p class="fig-caption" id="band-caption" role="status"></p></div>
<p>A single κ is honest but hard to judge: is 2.6 percentage points of bias plausible? It depends on how strongly a hidden variable would have to be tied to treatment and to the outcome. The next steps put numbers on those two links.</p>
<p class="note">Exact: the band arithmetic. Simulated: the study (seeded, so the numbers never change). κ here is an additive bias on the risk difference, the same object as in the first lesson.</p></section>

<section class="lab-step" data-title="The bias map"><h2 tabindex="-1">Two strengths make one bias factor</h2>
<p>For a binary outcome, confounding acts multiplicatively. The same study on the risk-ratio scale gives <strong>RR = ${f2(F.rr)}</strong> (95% CI ${f2(F.rrLo)} to ${f2(F.rrHi)}). Imagine an unmeasured binary variable U, over and above the measured covariates, with two strengths:</p>
<ul><li><strong>RR<sub>EU</sub></strong>: how much more common U is among the treated than among the untreated (the largest such ratio over levels of U);</li><li><strong>RR<sub>UD</sub></strong>: how much U multiplies the risk of the event, within each treatment group.</li></ul>
<p>Ding and VanderWeele showed that no such U can move the observed risk ratio by more than the <em>bias factor</em></p>
<p class="math">B = RR<sub>EU</sub> · RR<sub>UD</sub> / (RR<sub>EU</sub> + RR<sub>UD</sub> − 1),&nbsp;&nbsp; true RR ≥ observed RR / B.</p>
<p>No assumption about U's prevalence or distribution is needed, which is why the paper is called "sensitivity analysis without assumptions". B is always smaller than both strengths.</p>
<div class="predict" data-options="Yes: 2 × 2 = 4 is far more than ${f2(F.rr)}|No: B = 4/3 ≈ 1.33, less than ${f2(F.rr)}|Yes: either strength alone exceeds ${f2(F.rr)}" data-answer="1" data-hint="B(2, 2) = 4 / 3. The observed ${f2(F.rr)} could fall only to ${f2(F.rr / (4 / 3))}, still above 1. But it would take the interval's lower limit below 1.">A hidden confounder doubles the chance of treatment and doubles the risk of the event (both strengths equal 2). Could it explain away the observed RR of ${f2(F.rr)}?</div>
<p>Drag the purple point, tap anywhere on the map, or use the sliders. Every point is a hypothesized confounder.</p>
<div class="figure"><div class="fig-row"><div><svg id="map-drag" class="sens-map draggable" role="img" aria-label="Bias map. Horizontal axis RR_EU and vertical axis RR_UD, both from 1 to 6 on log scales. Curves mark where the bias factor equals the observed risk ratio and the lower confidence limit; the shaded regions beyond them hold confounders that would explain the result away. A draggable point marks the hypothesized confounder."></svg><p class="legend legend-swatches">${LEG.point}${LEG.ci}${LEG.iso}${LEG.u}</p></div>
<div><div class="fig-controls"><label><span>RR<sub>EU</sub>, U with treatment</span> <input id="rr-eu" type="range" min="1" max="6" step="0.01"></label><label><span>RR<sub>UD</sub>, U with the event</span> <input id="rr-ud" type="range" min="1" max="6" step="0.01"></label></div><div class="fig-readout" id="drag-readout"></div>
<svg id="strip-svg" class="sens-strip" role="img" aria-label="Observed risk ratio and interval, and the same after dividing by the bias factor, against a line at 1."></svg></div></div><p class="fig-caption sens-status" id="drag-caption" role="status"></p></div>
<p class="note">Exact: the bias factor and the curves B = constant, which are hyperbolas RR<sub>UD</sub> = B(RR<sub>EU</sub> − 1)/(RR<sub>EU</sub> − B). The adjusted value is the worst case, the most U could move the estimate; a real confounder of that strength might move it less.</p></section>

<section class="lab-step" data-title="The E-value"><h2 tabindex="-1">One number: the E-value</h2>
<p>The red curve is every confounder that would just explain away the estimate. Reporting a whole curve is awkward, so VanderWeele and Ding proposed one point on it: where the two strengths are equal. That point is the <strong>E-value</strong>.</p>
<p class="math">E = RR + √(RR (RR − 1)),&nbsp;&nbsp; for RR &lt; 1 use 1/RR first.</p>
<p>It solves B(E, E) = RR. For the interval, apply the same formula to the limit closest to 1; if the interval already contains 1, the E-value is 1.</p>
<div class="predict" data-options="There is an 80% chance the association is causal|The true risk ratio is at least 1.8|A confounder tied to both treatment and the event by risk ratios of at least 1.8 each, beyond the measured covariates, could pull the interval to 1; one weaker than 1.8 on both could not" data-answer="2" data-hint="An E-value is a strength of association on the risk-ratio scale, not a probability and not an effect size. A confounder stronger on one link can be weaker on the other: the whole curve counts.">This study's interval has an E-value of about 1.8. What does that mean?</div>
<div class="figure"><div class="fig-row"><div><svg id="map-e" class="sens-map" role="img" aria-label="Bias map with the equal-strength diagonal. The E-value for the estimate is where the diagonal meets the curve for the observed risk ratio; the E-value for the interval is where it meets the curve for the lower limit."></svg><p class="legend legend-swatches">${LEG.point}${LEG.ci}${LEG.diag}</p></div>
<div><div id="e-table"></div></div></div><p class="fig-caption">A confounder at the red dot, with RR<sub>EU</sub> = RR<sub>UD</sub> = ${f2(study.eValue)}, could just explain away the estimate. Anywhere else on the red curve works too, for example a weaker link to treatment paired with a stronger link to the event.</p></div>
<div class="predict" data-options="0.5 + √(0.5 × (−0.5)), which is undefined|The same as for RR = 2, about 3.41|Smaller than for RR = 2, because protective effects are more robust" data-answer="1" data-hint="E(0.5) = E(1/0.5) = E(2) = 2 + √2 ≈ 3.41. The E-value is symmetric in log RR.">A protective drug has RR = 0.5. What is its E-value?</div>
<p>Play the sweep below to trace the E-value as the observed risk ratio moves from 0.25 to 4 on a log scale.</p>
<div class="figure"><div class="fig-row"><div><svg id="evalue-svg" class="sens-evalue" role="img" aria-label="E-value as a function of the observed risk ratio from 0.25 to 4 on a log scale: a V shape with its minimum of 1 at a risk ratio of 1, symmetric in log risk ratio."></svg><div id="evalue-player"></div></div>
<div><div class="fig-readout" id="evalue-readout"></div></div></div><p class="fig-caption">The curve rises faster than the risk ratio itself: E(2) = 3.41, E(3) = 5.45. A modest association needs a hidden confounder stronger than itself to be explained away.</p></div></section>

<section class="lab-step" data-title="Benchmark"><h2 tabindex="-1">Is 1.8 a lot? Compare with what you measured</h2>
<p>An E-value is only meaningful next to confounders you understand. You measured four. Treat each in turn as if it had not been measured, and place its strengths on the same map: how much more common it is among the treated, and how much it multiplies risk, each conditional on the other three covariates.</p>
<div class="predict" data-options="Neither the estimate nor the interval|The interval, but not the estimate|Both the estimate and the interval" data-answer="1" data-hint="Severity sits at B = ${f2(sev.B)}: past the teal curve (${f2(F.rrLo)}) but short of the red one (${f2(F.rr)}).">Severity is the strongest measured confounder. Could an unmeasured confounder as strong as severity explain away this result?</div>
<div class="figure"><div class="fig-row"><div><svg id="map-bench" class="sens-map" role="img" aria-label="Bias map with the four measured covariates plotted as benchmarks: severity lies between the interval curve and the estimate curve; age 75+, diabetes and female lie near the origin, inside both curves."></svg><p class="legend legend-swatches">${LEG.point}${LEG.ci}${LEG.bench}</p></div>
<div><p class="note" style="margin-top:0">Leaving severity out of the adjustment moves this sample's estimate from ${f2(F.rr)} to ${f2(sev.omitted.rr)}. A confounder of its strength is not hypothetical: you have one.</p></div></div></div>
<div id="bench-table"></div>
<p>So the defensible statement is: an unmeasured confounder as strong as severity, the strongest thing we measured, could make the interval include 1 but could not by itself erase the point estimate. Whether such a confounder plausibly remains is a scientific judgement about what was not measured, not a statistical one.</p>
<p class="note">This is the idea behind Cinelli and Hazlett's benchmarking, which they develop for linear models on the partial R² scale with formal bounds; here it is adapted informally to the risk-ratio scale. Strengths are computed exactly in the teaching population that generated the data (conditional on the other covariates, maximum over their strata), so sampling noise does not blur them. In your own study you would estimate them. Two cautions from their paper apply: a benchmark says "as strong as X", not "X-like confounders are all that remain", and a covariate's strength can be distorted when it is correlated with the others. The last column is this sample's estimate with that covariate dropped; female moves it by slightly more than its tiny bound because of sampling noise, not confounding.</p></section>

<section class="lab-step" data-title="Report it"><h2 tabindex="-1">What to put in the report</h2>
<ol class="report-list">
<li><strong>Prespecify.</strong> Name the sensitivity analysis for unmeasured confounding in the protocol and analysis plan, with the estimand it targets (ICH E9(R1) asks for sensitivity analyses planned for the same estimand). Choosing one after seeing the results invites the one that looks best.</li>
<li><strong>Report two E-values.</strong> One for the estimate and one for the confidence limit closest to 1, on the scale of the effect measure you reported (convert odds or hazard ratios first when the outcome is common).</li>
<li><strong>Benchmark.</strong> Place measured covariates on the same scale and say which known confounders would or would not be strong enough.</li>
<li><strong>Name the candidates.</strong> List plausible unmeasured confounders and why each would or would not be this strong.</li>
<li><strong>Do not over-read it.</strong> An E-value is not a probability, not a test, and not proof of causation. A large one says a confounder would have to be strong; it does not say one is absent.</li></ol>
<p>Suggested wording for this study: "The observed risk ratio of ${f2(F.rr)} (95% CI ${f2(F.rrLo)} to ${f2(F.rrHi)}) could be explained away by an unmeasured confounder associated with both treatment and the adverse event by a risk ratio of ${f2(study.eValue)} each, above and beyond the measured covariates, but weaker confounding could not do so; to move the confidence interval to include 1 would need a risk ratio of ${f2(study.eValueCI)} each. The strongest measured confounder, severity, corresponds to a bias factor of ${f2(sev.B)}."</p>
<h3>E-value calculator</h3>
<div class="calc-grid"><label>Risk ratio <input id="calc-rr" type="number" min="0.01" max="100" step="0.01" inputmode="decimal"></label><label>Lower 95% limit <input id="calc-lo" type="number" min="0.01" max="100" step="0.01" inputmode="decimal"></label><label>Upper 95% limit <input id="calc-hi" type="number" min="0.01" max="100" step="0.01" inputmode="decimal"></label></div>
<div id="calc-out" role="status"></div>
<h3>Quick check: common misreadings</h3>
<div class="predict" data-options="The association is causal|Confounders of strength 1 were ruled out|Nothing needs explaining away: the interval already includes 1" data-answer="2" data-hint="E-value 1 for the interval means no confounding at all is needed to reach the null; the data alone already allow it. The point estimate's E-value, ${f2(X.eValue(1.2))}, still describes the estimate.">Another study reports RR 1.2 (95% CI 0.9 to 1.6), with E-values ${f2(X.eValue(1.2))} for the estimate and 1 for the interval. What does the 1 tell you?</div>
<div class="predict" data-options="Right: E-values are odds|Wrong: an E-value is a strength of association, not a probability or odds|Right, as long as the interval excludes 1" data-answer="1" data-hint="The E-value has the units of a risk ratio. It says how strong confounding would need to be, and nothing about how likely such confounding is.">A reviewer writes: "E-value ${f2(study.eValue)}, so the odds are ${f2(study.eValue)} to 1 that the effect is real." Is that right?</div>
</section>`;

  [
    ["kappa", "kappa"],
    ["rr-eu", "rrEU"],
    ["rr-ud", "rrUD"],
    ["calc-rr", "calcRR"],
    ["calc-lo", "calcLo"],
    ["calc-hi", "calcHi"],
  ].forEach(([id, key]) => control(byId(id), state, key));

  const readout = (id, pairs) =>
    byId(id).replaceChildren(
      ...pairs.flatMap(([k, v]) => [
        html("span", { class: "k" }, k),
        html("span", {}, String(v)),
      ]),
    );

  /* ---------- Step 1: the κ band ---------- */
  function drawBand() {
    const k = state.get().kappa,
      b = X.kappaBand(F.rd, F.rdLo, F.rdHi, k),
      P = (v) => 100 * v,
      plot = new Plot(byId("band-svg"), {
        x: [-10, 16],
        y: [0, 3.15],
        width: 620,
        height: 260,
        margin: { l: 16, r: 16, t: 14, b: 46 },
        xlabel: "Risk difference, percentage points",
        yticks: [],
        grid: false,
        xticks: [-10, -5, 0, 5, 10, 15],
      }),
      g = plot.layer(),
      rows = [
        { y: 2.45, label: "Estimate and 95% CI" },
        { y: 1.45, label: "Estimate ± κ" },
        { y: 0.45, label: "95% CI widened by κ" },
      ];
    plot.vline(0, { stroke: "var(--ink)" }, "no effect");
    rows.forEach((r) =>
      plot.text(-9.8, r.y + 0.1, r.label, { class: "fig-text ink" }),
    );
    const bar = (lo, hi, y, attrs) =>
      g.append(
        el("rect", {
          x: plot.sx(P(lo)),
          y: plot.sy(y) - 7,
          width: Math.max(1.5, plot.sx(P(hi)) - plot.sx(P(lo))),
          height: 14,
          rx: 4,
          ...attrs,
        }),
      );
    // Row 1: point and CI
    g.append(
      el("line", {
        x1: plot.sx(P(F.rdLo)),
        x2: plot.sx(P(F.rdHi)),
        y1: plot.sy(2.45),
        y2: plot.sy(2.45),
        stroke: "var(--or)",
        "stroke-width": 3,
      }),
      el("circle", {
        cx: plot.sx(P(F.rd)),
        cy: plot.sy(2.45),
        r: 6,
        fill: "var(--or)",
      }),
    );
    bar(b.point[0], b.point[1], 1.45, { fill: "var(--purple)", opacity: 0.45 });
    g.append(
      el("circle", {
        cx: plot.sx(P(F.rd)),
        cy: plot.sy(1.45),
        r: 5,
        fill: "var(--or)",
      }),
    );
    bar(b.interval[0], b.interval[1], 0.45, {
      fill: "var(--purple)",
      opacity: 0.25,
    });
    g.append(
      el("line", {
        x1: plot.sx(P(F.rdLo)),
        x2: plot.sx(P(F.rdHi)),
        y1: plot.sy(0.45),
        y2: plot.sy(0.45),
        stroke: "var(--or)",
        "stroke-width": 3,
      }),
    );
    byId("kappa-val").textContent = pp(k);
    const toNull = X.kappaToNull(F.rd),
      toCI = X.kappaToCI(F.rdLo, F.rdHi);
    readout("band-readout", [
      ["κ", pp(k) + " points"],
      ["Estimate ± κ", `${pp(b.point[0])} to ${pp(b.point[1])}`],
      ["CI ± κ", `${pp(b.interval[0])} to ${pp(b.interval[1])}`],
      ["κ to reach 0, estimate", pp(toNull)],
      ["κ to reach 0, CI", pp(toCI)],
    ]);
    byId("band-caption").textContent =
      k >= toNull
        ? `With κ = ${pp(k)} points even the point estimate is compatible with no effect.`
        : k >= toCI
          ? `With κ = ${pp(k)} points the widened interval includes zero, though ψ̂ ± κ does not yet.`
          : `With κ = ${pp(k)} points both bands stay above zero. The interval needs κ ≥ ${pp(toCI)} to reach it; the estimate needs κ ≥ ${pp(toNull)}.`;
  }

  /* ---------- Bias map (steps 2 to 4) ---------- */
  const LMAX = Math.log(6),
    lg = Math.log,
    TICKS = [1, 1.5, 2, 3, 4, 6];
  function curvePoints(T) {
    // The part of B(x, y) = T inside [1, 6]^2, parameterized by log x.
    const x0 = X.contourUD(6, T),
      pts = [];
    for (let i = 0; i <= 120; i++) {
      const x = Math.exp(lg(x0) + ((LMAX - lg(x0)) * i) / 120),
        y = Math.min(6, X.contourUD(x, T));
      pts.push([lg(x), lg(y)]);
    }
    return pts;
  }
  function baseMap(svg) {
    const plot = new Plot(svg, {
        x: [0, LMAX],
        y: [0, LMAX],
        width: 520,
        height: 500,
        margin: { l: 72, r: 18, t: 44, b: 52 },
        xticks: TICKS.map(lg),
        yticks: TICKS.map(lg),
        tickFormat: (v) => String(+Math.exp(v).toFixed(1)),
        xlabel: "",
        ylabel: "",
      }),
      g = plot.layer();
    svg.classList.add("sens-map");
    // Vertical axis label, rotated, outside the plot area.
    plot.fg.append(
      el(
        "text",
        {
          class: "axis-label",
          transform: `translate(20 ${(plot.m.t + plot.H - plot.m.b) / 2}) rotate(-90)`,
          "text-anchor": "middle",
        },
        "RR",
        el("tspan", { "baseline-shift": "sub", "font-size": "75%" }, "UD"),
        el("tspan", {}, ": U's association with the event"),
      ),
      el(
        "text",
        {
          class: "axis-label",
          x: (plot.m.l + plot.W - plot.m.r) / 2,
          y: plot.H - plot.m.b + 36,
          "text-anchor": "middle",
        },
        "RR",
        el("tspan", { "baseline-shift": "sub", "font-size": "75%" }, "EU"),
        el("tspan", {}, ": U's association with treatment"),
      ),
    );
    // Vertical gridlines to match the horizontal ones.
    TICKS.forEach((t) =>
      plot.bg.prepend(
        el("line", {
          class: "grid",
          x1: plot.sx(lg(t)),
          x2: plot.sx(lg(t)),
          y1: plot.m.t,
          y2: plot.H - plot.m.b,
        }),
      ),
    );
    const region = (T, cls) => {
      const pts = curvePoints(T);
      plot.area(pts, LMAX, { class: cls });
    };
    region(F.rrLo, "region-ci");
    region(F.rr, "region-point");
    // Iso-B contours labelled at the top edge.
    const tops = [];
    plot.fg.append(
      el(
        "text",
        {
          class: "fig-text",
          x: plot.m.l - 10,
          y: plot.m.t - 16,
          "text-anchor": "end",
        },
        "B =",
      ),
    );
    [1.25, 2, 2.5, 3]
      .filter((B) => Math.abs(B - F.rr) > 0.1 && Math.abs(B - F.rrLo) > 0.1)
      .forEach((B) => {
        plot.line(curvePoints(B), { class: "iso" }, g);
        tops.push([B, "var(--muted)"]);
      });
    plot.line(curvePoints(F.rrLo), {
      stroke: "var(--teal)",
      "stroke-dasharray": "7 5",
    }, g);
    plot.line(curvePoints(F.rr), { stroke: "var(--red)" }, g);
    tops.push([F.rrLo, "var(--teal)"], [F.rr, "var(--red)"]);
    tops.forEach(([B, fill]) =>
      plot.fg.append(
        el(
          "text",
          {
            class: "fig-text",
            x: plot.sx(lg(X.contourUD(6, B))),
            y: plot.m.t - 16,
            "text-anchor": "middle",
            fill,
          },
          String(+B.toFixed(2)),
        ),
      ),
    );
    return { plot, g };
  }

  /* Step 2: draggable confounder */
  const dragSvg = byId("map-drag");
  const drag = baseMap(dragSvg);
  const uLayer = drag.plot.layer();
  function drawU() {
    const { rrEU, rrUD } = state.get(),
      p = drag.plot,
      x = p.sx(lg(rrEU)),
      y = p.sy(lg(rrUD)),
      B = X.biasFactor(rrEU, rrUD);
    uLayer.replaceChildren(
      el("line", { class: "guide", x1: p.m.l, x2: x, y1: y, y2: y }),
      el("line", { class: "guide", x1: x, x2: x, y1: y, y2: p.H - p.m.b }),
      el("circle", { cx: x, cy: y, r: 8, fill: "var(--purple)", stroke: "var(--paper)", "stroke-width": 2 }),
      el("circle", { class: "handle-hit", cx: x, cy: y, r: 24 }),
    );
    const a = X.adjust(F.rr, F.rrLo, F.rrHi, B),
      pointGone = X.explainsPoint(F.rr, B),
      ciGone = X.explainsCI(F.rrLo, F.rrHi, B);
    readout("drag-readout", [
      ["RR, U and treatment", f2(rrEU)],
      ["RR, U and event", f2(rrUD)],
      ["B", f2(B)],
      ["Observed RR", `${f2(F.rr)} (${f2(F.rrLo)} to ${f2(F.rrHi)})`],
      ["Worst-case RR", `${f2(a.rr)} (${f2(a.lo)} to ${f2(a.hi)})`],
    ]);
    drawStrip(a);
    const cap = byId("drag-caption");
    cap.classList.toggle("explained", ciGone);
    cap.textContent = pointGone
      ? `B = ${f2(B)} ≥ ${f2(F.rr)}: this confounder could explain away the estimate itself (worst-case RR ${f2(a.rr)}).`
      : ciGone
        ? `B = ${f2(B)}: the estimate survives (worst case ${f2(a.rr)}), but the interval could now include 1.`
        : `B = ${f2(B)}: too weak. Even in the worst case the RR stays at ${f2(a.rr)} with the interval above 1.`;
  }
  function drawStrip(a) {
    const plot = new Plot(byId("strip-svg"), {
        x: [lg(0.6), lg(2.2)],
        y: [0, 2],
        width: 280,
        height: 150,
        margin: { l: 84, r: 12, t: 10, b: 40 },
        grid: false,
        xticks: [0.75, 1, 1.5, 2].map(lg),
        yticks: [],
        tickFormat: (v) => String(+Math.exp(v).toFixed(2)),
        xlabel: "Risk ratio (log scale)",
      }),
      g = plot.layer();
    byId("strip-svg").classList.add("sens-strip");
    plot.vline(0, { stroke: "var(--ink)" });
    const row = (y, rr, lo, hi, color, label) => {
      g.append(
        el("line", {
          x1: plot.sx(lg(Math.max(0.6, lo))),
          x2: plot.sx(lg(Math.min(2.2, hi))),
          y1: plot.sy(y),
          y2: plot.sy(y),
          stroke: color,
          "stroke-width": 3,
        }),
        el("circle", { cx: plot.sx(lg(Math.max(0.6, rr))), cy: plot.sy(y), r: 5.5, fill: color }),
      );
      plot.fg.append(el("text", { class: "fig-text", x: plot.m.l - 8, y: plot.sy(y) + 4, "text-anchor": "end", fill: color }, label));
    };
    row(1.4, F.rr, F.rrLo, F.rrHi, "var(--or)", "observed");
    row(0.45, a.rr, a.lo, a.hi, "var(--purple)", "worst case");
  }
  const toData = (evt) => {
    const pt = dragSvg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const q = pt.matrixTransform(dragSvg.getScreenCTM().inverse()),
      p = drag.plot,
      ux = ((q.x - p.m.l) / (p.W - p.m.l - p.m.r)) * LMAX,
      uy = ((p.H - p.m.b - q.y) / (p.H - p.m.t - p.m.b)) * LMAX,
      clamp = (v) => +Math.min(6, Math.max(1, Math.exp(v))).toFixed(2);
    return { rrEU: clamp(ux), rrUD: clamp(uy) };
  };
  let dragging = false;
  dragSvg.addEventListener("pointerdown", (e) => {
    if (e.target.classList.contains("handle-hit")) {
      dragging = true;
      dragSvg.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  });
  dragSvg.addEventListener("pointermove", (e) => {
    if (dragging) state.set(toData(e));
  });
  const stop = () => (dragging = false);
  dragSvg.addEventListener("pointerup", stop);
  dragSvg.addEventListener("pointercancel", stop);
  dragSvg.addEventListener("click", (e) => {
    if (!e.target.classList.contains("handle-hit")) state.set(toData(e));
  });

  /* Step 3: E-values on the map, and the E(RR) sweep */
  const emap = baseMap(byId("map-e"));
  (function () {
    const { plot, g } = emap;
    plot.line(
      [
        [0, 0],
        [LMAX, LMAX],
      ],
      { stroke: "var(--muted)", "stroke-width": 1.5, "stroke-dasharray": "3 3" },
      g,
    );
    [
      [study.eValueCI, "var(--teal)", `E=${f2(study.eValueCI)}`],
      [study.eValue, "var(--red)", `E=${f2(study.eValue)}`],
    ].forEach(([e, c, label]) => {
      g.append(
        el("circle", { cx: plot.sx(lg(e)), cy: plot.sy(lg(e)), r: 7, fill: c, stroke: "var(--paper)", "stroke-width": 2 }),
      );
      plot.text(lg(e), lg(e), label, {
        dx: -20,
        dy: 5,
        "text-anchor": "end",
        fill: c,
        class: "fig-text",
      });
    });
  })();
  byId("e-table").innerHTML = table(
    ["Quantity", "Risk ratio", "E-value"],
    [
      ["Estimate", f2(F.rr), f2(study.eValue)],
      ["Lower limit (closest to 1)", f2(F.rrLo), f2(study.eValueCI)],
      ["Upper limit", f2(F.rrHi), "not used"],
    ],
    "E-values for this study",
  );
  const LO = lg(0.25),
    HI = lg(4),
    rrAt = (t) => Math.exp(LO + (HI - LO) * t);
  function drawEValue(t) {
    const plot = new Plot(byId("evalue-svg"), {
        x: [LO, HI],
        y: [1, 8],
        width: 560,
        height: 320,
        margin: { l: 50, r: 18, t: 22, b: 46 },
        xticks: [0.25, 0.5, 1, 2, 4].map(lg),
        yticks: [2, 4, 6, 8],
        tickFormat: (v) => String(+v.toFixed(2)),
        xTickFormat: (v) => String(+Math.exp(v).toFixed(2)),
        xlabel: "Observed risk ratio (log scale)",
        ylabel: "E-value",
      }),
      g = plot.layer();
    byId("evalue-svg").classList.add("sens-evalue");
    const full = [],
      trace = [];
    for (let i = 0; i <= 200; i++) {
      const u = i / 200,
        p = [LO + (HI - LO) * u, X.eValue(rrAt(u))];
      full.push(p);
      if (u <= t) trace.push(p);
    }
    plot.line(full, { stroke: "var(--rule)", "stroke-width": 1.5 }, g);
    const rr = rrAt(t),
      e = X.eValue(rr);
    trace.push([lg(rr), e]);
    plot.line(trace, { stroke: "var(--purple)" }, g);
    plot.line([[LO, 1], [HI, 1]], { stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "3 3" }, g);
    // This study's two points stay put.
    [
      [F.rr, study.eValue, "var(--red)"],
      [F.rrLo, study.eValueCI, "var(--teal)"],
    ].forEach(([r, v, c]) =>
      g.append(el("circle", { cx: plot.sx(lg(r)), cy: plot.sy(v), r: 5, fill: "none", stroke: c, "stroke-width": 2 })),
    );
    g.append(el("circle", { cx: plot.sx(lg(rr)), cy: plot.sy(e), r: 6, fill: "var(--purple)" }));
    readout("evalue-readout", [
      ["Observed RR", f2(rr)],
      ["Used as", f2(X.awayFromNull(rr))],
      ["E-value", f2(e)],
      ["This study, RR " + f2(F.rr), "E = " + f2(study.eValue)],
      ["This study, CI " + f2(F.rrLo), "E = " + f2(study.eValueCI)],
    ]);
  }
  const ePlayer = player(byId("evalue-player"), {
    duration: 7000,
    label: "Observed RR",
    formatValue: (t) => f2(rrAt(t)),
    onT: drawEValue,
  });
  drawEValue(0);

  /* Step 4: benchmarks */
  const bmap = baseMap(byId("map-bench"));
  (function () {
    const { plot, g } = bmap,
      // Label offsets (px) chosen so labels clear each other and the points.
      offsets = { severity: [22, 5, "start"], age: [10, 4, "start"], diabetes: [10, 18, "start"], female: [10, 4, "start"] };
    study.covariates.forEach((c) => {
      const x = plot.sx(lg(c.rrAX)),
        y = plot.sy(lg(c.rrXY)),
        [dx, dy, anchor] = offsets[c.key];
      g.append(el("circle", { cx: x, cy: y, r: 5.5, fill: "var(--ink)", stroke: "var(--paper)", "stroke-width": 1.5 }));
      plot.fg.append(
        el("text", { class: "fig-text ink", x: x + dx, y: y + dy, "text-anchor": anchor }, c.label),
      );
    });
  })();
  byId("bench-table").innerHTML = table(
    ["Covariate", "RR with treatment", "RR with event", "B", "Explains away CI?", "Explains away RR?", "RR if left out"],
    study.covariates.map((c) => [
      c.label,
      f2(c.rrAX),
      f2(c.rrXY),
      f2(c.B),
      X.explainsCI(F.rrLo, F.rrHi, c.B) ? "yes" : "no",
      X.explainsPoint(F.rr, c.B) ? "yes" : "no",
      f2(c.omitted.rr),
    ]),
    "Measured covariates as benchmarks",
  );

  /* Step 5: calculator */
  function drawCalc() {
    const { calcRR: rr, calcLo: lo, calcHi: hi } = state.get(),
      out = byId("calc-out");
    if (!(lo <= rr && rr <= hi)) {
      out.innerHTML = '<p class="warning">Enter limits with lower ≤ risk ratio ≤ upper.</p>';
      return;
    }
    const e = X.eValue(rr),
      eci = X.eValueCI(lo, hi),
      side = lo <= 1 && hi >= 1 ? "The interval already contains 1, so its E-value is 1." : rr < 1 ? `Protective estimate: the formula uses 1/RR = ${f2(1 / rr)} and the upper limit ${f2(hi)}, the one closest to 1.` : `The formula uses the lower limit ${f2(lo)}, the one closest to 1.`;
    out.innerHTML = `<p class="math">E-value (estimate) = ${f2(e)}<br>E-value (interval) = ${f2(eci)}</p><p>${side}</p>`;
  }

  function render() {
    drawBand();
    drawU();
    drawCalc();
  }
  state.subscribe(render);
  render();
  guided(root, state);
  tools(root, state);
  window.SensitivityLab = { study, ePlayer };
})();
