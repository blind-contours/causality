/* Positivity and weights laboratory.
 * One continuous confounder X (severity), logit g(X) = β(X − 0.5), known outcome model, ATE = 2.
 * All numbers come from science/positivity.js; this file only draws them. */
(function () {
  const { store, control, tools, guided, table, fmt, esc } = CausalLab,
    { el, html, player } = CausalAnim,
    P = CausalPositivity,
    root = document.querySelector("[data-lab]"),
    state = store(
      "positivity",
      {
        step: 0,
        beta: 0,
        cap: 0.99,
        trim: 0.1,
        method: "trim",
        support: "structural",
      },
      {
        step: [0, 5],
        beta: [0, 4],
        cap: [0.8, 1],
        trim: [0, 0.2],
        method: ["cap", "trim", "overlap"],
        support: ["structural", "practical"],
      },
    );
  const byId = (id) => document.getElementById(id),
    D = P.draws(P.N, P.SEED),
    memo = new Map(),
    analysis = (beta, cap = 0.99, trim = 0.1) => {
      const key = [beta.toFixed(3), cap, trim].join("|");
      if (!memo.has(key)) {
        if (memo.size > 400) memo.clear();
        const rows = P.sample(beta, P.N, P.SEED, { draws: D });
        memo.set(key, { rows, r: P.analyze(rows, { cap, trim }) });
      }
      return memo.get(key);
    },
    readout = (box, pairs) =>
      box.replaceChildren(
        ...pairs.flatMap(([k, v]) => [
          html("span", { class: "k" }, k),
          html("span", {}, String(v)),
        ]),
      ),
    pct = (x, d = 0) => (Number.isFinite(x) ? (100 * x).toFixed(d) + "%" : "undefined"),
    ord = (q) => {
      const v = Math.round(q * 1000) / 10;
      return v === 100 ? "no cap" : fmt(v, 1) + "th percentile";
    },
    swatch = (color, kind = "line", dash = "") =>
      kind === "dot"
        ? `<svg class="swatch" width="28" height="10" aria-hidden="true"><circle cx="14" cy="5" r="4.5" fill="${color}"/></svg>`
        : kind === "box"
          ? `<svg class="swatch" width="28" height="10" aria-hidden="true"><rect x="1" y="0" width="26" height="10" fill="${color}" opacity=".35"/></svg>`
          : `<svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="2.5" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;

  root.innerHTML = `
<section class="lab-step" data-title="See the overlap"><h2 tabindex="-1">Where do the two arms stop overlapping?</h2>
<p>An observational cohort of ${P.N} patients. Sicker patients (higher severity X) are more likely to be treated. The <strong>separation</strong> β sets how strongly severity decides treatment: at β = 0 treatment is a coin flip for everyone; at β = 4 a mild patient is almost never treated and a severe one almost always is.</p>
<p class="math">logit g(X) = α + βX, with α = −β/2 so that severity 0.5 is always a 50/50 call</p>
<p>You already know the weights: a treated patient counts 1/ĝ(X) times, a control patient 1/(1 − ĝ(X)) times. That is the clever covariate H = A/g − (1 − A)/(1 − g) wearing its IPW clothes, and the 1/π from the two-strata lesson.</p>
<div class="predict" data-options="Treated patients with low severity|Patients with severity near 0.5|Control patients with low severity" data-answer="0" data-hint="A treated patient with ĝ = 0.03 stands in for about 33 people like them, because 97% of such people went untreated. Control patients with high severity are the mirror image.">As separation grows, which patients end up carrying the largest weights?</div>
<div class="figure"><div class="fig-row"><div><svg id="pos-mirror" role="img" aria-label="Mirrored histogram of fitted propensity scores: treated patients above the axis, control patients below. Red bands mark fitted propensities below 0.05 or above 0.95. Beneath it, a strip of every patient at their fitted propensity, dot area proportional to weight. Numbers are listed beside the figure."></svg><div id="pos-mirror-player"></div>
<p class="legend legend-swatches"><span>${swatch("var(--p)", "box")}Treated (above the axis, top lane)</span><span>${swatch("var(--teal)", "box")}Control (below the axis, bottom lane)</span><span>${swatch("var(--red)", "box")}ĝ below 0.05 or above 0.95: the other arm's patients there weigh over 20 (red ring)</span></p></div>
<div><div class="fig-readout" id="pos-mirror-readout"></div></div></div><p class="fig-caption" id="pos-mirror-caption" role="status"></p></div>
<p>Most patients in the red bands are unremarkable: controls on the left and treated patients on the right, each with a weight close to 1. The danger is the few treated patients in the left band (and the few controls in the right one). Each of them must speak for a whole crowd of similar people who went the other way.</p>
</section>

<section class="lab-step" data-title="Effective sample size"><h2 tabindex="-1">How many patients is a weighted arm worth?</h2>
<p>Weights that vary a lot waste data. Kish's effective sample size asks: how many equally weighted patients would give the same precision for a weighted mean?</p>
<p class="math">ESS = (Σ wᵢ)² / Σ wᵢ², computed within each arm</p>
<p>Equal weights give ESS = n. One enormous weight gives ESS close to 1.</p>
<div class="predict" data-options="About 160|About 100|Fewer than 50" data-answer="2" data-hint="At β = 4 the treated arm has 163 patients but an effective size of about 47: the weights spread over two orders of magnitude.">At β = 4, 163 patients are treated. How many equally weighted patients is the treated arm worth?</div>
<div class="figure"><div class="fig-row"><div><div id="pos-meters" class="pos-meters" role="img" aria-label="Effective sample size meters for each arm, and the largest single weight's share of its arm's total weight."></div>
<svg id="pos-ess-trace" role="img" aria-label="Effective sample size as a fraction of arm size, traced for this cohort as separation goes from 0 to 4, treated and control arms, with a marker at the current separation."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--p)")}Treated ESS / n₁</span><span>${swatch("var(--teal)")}Control ESS / n₀</span></p></div>
<div><div class="fig-controls"><label>Separation β <input id="pos-beta-2" type="range" min="0" max="4" step="0.05"></label><button type="button" id="pos-go4">Set β = 4</button></div><div class="fig-readout" id="pos-ess-readout"></div></div></div><p class="fig-caption" id="pos-ess-caption" role="status"></p></div>
<p>The treated arm loses precision first here because treatment is the rarer choice (about a third of patients once β is large), so its thin tail is thinner. Report the ESS per arm alongside the propensity plot; it is the single most useful number in a positivity diagnostic.</p>
</section>

<section class="lab-step" data-title="Repeated samples"><h2 tabindex="-1">What thin overlap does to an estimator</h2>
<p>One sample hides the problem: the patients with truly enormous weights are so rare that most samples do not contain any. To see the damage, repeat the study. Each point below is 400 fresh cohorts of ${P.N} patients at that separation, analysed with a fitted logistic propensity model. The outcome model in AIPW is correctly specified (a line in X within each arm).</p>
<div class="predict" data-options="It stays flat, because the outcome model does the work|It grows too, but much less than IPW|It grows exactly as fast as IPW" data-answer="1" data-hint="AIPW multiplies residuals, not whole outcomes, by the same weights. Residuals are smaller, so it suffers less, but at β = 4 its SD is still about 4.7 times its β = 0 value.">AIPW uses the same weights as IPW. As separation grows, what happens to AIPW's standard deviation across samples?</div>
<div class="figure"><div class="fig-row"><div><svg id="pos-rep-bias" role="img" aria-label="Bias of IPW and AIPW against separation, with plus or minus two Monte Carlo standard errors. Values are in the table below."></svg><svg id="pos-rep-sd" role="img" aria-label="Standard deviation across repeated samples of IPW and AIPW against separation. Values are in the table below."></svg><div id="pos-rep-player"></div>
<p class="legend legend-swatches"><span>${swatch("var(--or)")}IPW (normalized)</span><span>${swatch("var(--purple)")}AIPW</span><span>${swatch("var(--green)", "line", "6 4")}Zero bias</span></p></div>
<div><div class="fig-readout" id="pos-rep-readout"></div></div></div><p class="fig-caption" id="pos-rep-caption" role="status"></p></div>
<details><summary>All repeated-sample numbers</summary><div id="pos-rep-table"></div></details>
<p>Two things go wrong for IPW. Its spread explodes, and it also drifts upward: a heavy-tailed average is usually computed without its rare giant terms, so a typical sample misses them in the same direction. AIPW stays centred because its outcome model is right, but its spread still grows about fivefold. Double robustness does not buy immunity from thin overlap; the efficiency bound itself grows with E[1/g(X)].</p>
</section>

<section class="lab-step" data-title="Three responses"><h2 tabindex="-1">Three responses, and what each one costs</h2>
<p>Choose a response. Watch two things: the population the answer is about (the figure), and whether the estimate is centred on the question you wrote down (the table).</p>
<div class="predict" data-options="Unbiased for the ATE, and less variable|Biased for the ATE, and less variable|Biased for the ATE, and more variable" data-answer="1" data-hint="At β = 3 the 99th-percentile cap cuts the SD by more than half, but the estimate sits about 1.2 above the ATE. The target did not change; the estimator stopped aiming at it.">At β = 3 you cap every weight at its 99th percentile. Across repeated samples, the capped IPW estimate is:</div>
<div class="predict" data-options="Still the ATE, 2|A larger effect, about 2.4|A smaller effect, about 1.6" data-answer="1" data-hint="At β = 3 trimming keeps patients with severity between about −0.23 and 1.23, 48% of the cohort. Their average severity is 0.42, and the effect grows with severity: τ(x) = 2 + x.">At β = 3 you trim patients with ĝ outside [0.1, 0.9]. The effect grows with severity, τ(x) = 2 + x. What does the trimmed analysis estimate?</div>
<div class="figure"><div class="fig-row"><div><svg id="pos-pop" role="img" aria-label="Severity distribution of the whole cohort, the population the ATE is about, compared with the population the chosen response actually targets. A rug shows this sample's patients; dropped or capped patients are marked in red."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--muted)", "box")}Whole cohort (the ATE population)</span><span>${swatch("var(--purple)", "box")}Population the response targets</span><span>${swatch("var(--red)", "dot")}Patients dropped or capped</span></p></div>
<div><div class="fig-controls"><label>Response <select id="pos-method"><option value="cap">(a) Cap weights at a percentile</option><option value="trim">(b) Trim patients with extreme ĝ</option><option value="overlap">(c) Overlap weights</option></select></label>
<label>Cap at percentile <span id="pos-cap-v"></span><input id="pos-cap" type="range" min="0.8" max="1" step="0.005"></label>
<label>Trim threshold a (keep a ≤ ĝ ≤ 1 − a) <span id="pos-trim-v"></span><input id="pos-trim" type="range" min="0" max="0.2" step="0.01"></label>
<label>Separation β <input id="pos-beta-4" type="range" min="0" max="4" step="0.05"></label><button type="button" id="pos-go3">Set β = 3</button></div>
<div class="fig-readout" id="pos-pop-readout"></div></div></div><p class="fig-caption" id="pos-pop-caption" role="status"></p></div>
<div id="pos-resp-table"></div><p class="note" id="pos-resp-status" role="status"></p>
<h3>(a) Capping (truncating) weights</h3><p>Replace every weight above a chosen percentile by that percentile. The target is still the ATE, so the estimand has not changed, but the estimator is now biased for it: the patients who were standing in for many others are made to stand in for fewer, so the thin region is under-represented. You buy variance with bias, and the bias does not shrink with more data.</p>
<h3>(b) Trimming patients (Crump et al. 2009)</h3><p>Drop everyone whose ĝ is outside [a, 1 − a]. Crump, Hotz, Imbens and Mitnik showed that under homoskedasticity the most precisely estimable average effect is over such a region, with a ≈ 0.1 as a practical rule. The estimate is then honest, but about a different population: the patients for whom both treatments were realistic. That is a new estimand, and it moves as β moves.</p>
<h3>(c) Overlap weights (Li, Morgan and Zaslavsky 2018)</h3><p>Weight treated patients by 1 − ĝ and controls by ĝ. No weight exceeds 1, and with a logistic ĝ the weighted means of X balance exactly. The target is the ATO: the average effect in a population tilted smoothly toward g ≈ 0.5, density ∝ g(x)(1 − g(x))f(x). It is the lowest-variance weighted target in their class, and it is also a different estimand.</p>
<div class="warning" id="pos-contract"></div>
</section>

<section class="lab-step" data-title="Structural or practical"><h2 tabindex="-1">Structural or practical: can more data fix it?</h2>
<p>A <strong>structural</strong> violation means some patients could never receive a treatment: g(x) = 0 by design, for example a contraindication. A <strong>practical</strong> violation means everyone could, but in your sample some kinds of patient rarely did. Both look like a thin tail in a histogram. Only one of them goes away with more patients.</p>
<div class="predict" data-options="Both shrink|Only the practical one shrinks|Only the structural one shrinks" data-answer="1" data-hint="With n = 5000 the practical case's IPW bias is indistinguishable from zero, while the structural case's stays near 0.54. No sample contains a treated patient above severity 1.5, so nothing in the data speaks for them.">Both cohorts use β = 2. In the structural one, nobody with severity above 1.5 is ever treated. You collect ten times more patients (500 → 5000). Which IPW bias shrinks?</div>
<div class="figure"><div class="fig-row"><div><svg id="pos-support" role="img" aria-label="Mirrored histogram of severity by arm: treated above the axis, control below. In the structural case the region above severity 1.5 has no treated patients and is shaded red; in the practical case the thin tails where the true propensity is below 0.05 or above 0.95 are shaded."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--p)", "box")}Treated</span><span>${swatch("var(--teal)", "box")}Control</span><span>${swatch("var(--red)", "box")}Region with no or almost no treated patients</span></p></div>
<div><div class="fig-controls"><label>Violation <select id="pos-support-kind"><option value="structural">Structural (none treated above 1.5)</option><option value="practical">Practical (few, not none)</option></select></label></div><div class="fig-readout" id="pos-support-readout"></div></div></div><p class="fig-caption" id="pos-support-caption" role="status"></p></div>
<div id="pos-support-table"></div>
<p>Here AIPW survives the structural case, but only because its outcome model is exactly right and can be extended beyond the data. In a real study the effect in patients who are never treated is not learned from data at all: any number you report for them is an extrapolation of a model, and should be called one. The honest options are to change the question to the population where treatment is possible, or to state the extrapolation as an assumption and vary it in a sensitivity analysis.</p>
</section>

<section class="lab-step" data-title="Write it in the SAP"><h2 tabindex="-1">What to write before you see the outcomes</h2>
<p>Positivity decisions change either the estimate's reliability or the question itself. Both belong in the statistical analysis plan, fixed before outcome data are unblinded, following Petersen and colleagues' diagnose-then-respond approach and the ICH E9(R1) estimand framework.</p>
<ol class="road-list">
<li><strong>Structural checks first.</strong> List eligibility rules, contraindications and label restrictions that make g(x) = 0 or 1 for some patients. Exclude those patients from the target population in the estimand itself, or state the extrapolation you will rely on.</li>
<li><strong>Diagnostics you will report.</strong> The mirrored propensity plot by arm; the ESS per arm; the largest weight and its share of the arm total; the distribution of ĝ (for example its 1st and 99th percentiles).</li>
<li><strong>A trigger and a primary response.</strong> For example: if either arm's ESS falls below half its size, or any ĝ is outside [0.025, 0.975], report the prespecified response. Say whether that response keeps the estimand (capping, better models, AIPW or TMLE) or changes it (trimming, overlap weights).</li>
<li><strong>If the estimand changes, name the new population.</strong> Describe who remains (a table of baseline characteristics before and after trimming or overlap weighting) so readers know whose effect is reported.</li>
<li><strong>Sensitivity analyses.</strong> Several thresholds (a = 0.05, 0.1), the untrimmed AIPW or TMLE estimate with its ESS, and a statement of the direction of the change.</li>
</ol>
<p id="pos-sap-draft" class="pos-draft"></p>
<p class="note">What is exact and what is simulated: the ATE (2), the trimmed-population and ATO targets, and the population densities are exact numerical integrals. The single cohort and the repeated-sample results are seeded simulations (${P.N} patients; 400 repeats per separation in the third step, 200 in the fifth, and 150 computed on demand in the fourth). Propensities are fitted by logistic regression, which is correctly specified except in the structural example.</p>
</section>`;

  [
    ["pos-beta-2", "beta"],
    ["pos-beta-4", "beta"],
    ["pos-cap", "cap"],
    ["pos-trim", "trim"],
    ["pos-method", "method"],
    ["pos-support-kind", "support"],
  ].forEach(([id, key]) => control(byId(id), state, key));
  byId("pos-go4").onclick = () => state.set({ beta: 4 });
  byId("pos-go3").onclick = () => state.set({ beta: 3 });

  /* ---------- Step 1: mirrored histogram and weight strip ---------- */
  const W1 = 640,
    H1 = 470,
    L1 = 54,
    R1 = W1 - 18,
    top = 40,
    base = 140,
    bottom = 240,
    laneT = 305,
    laneC = 395,
    sx1 = (p) => L1 + p * (R1 - L1),
    jitter = (i) => (((i * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
  function drawMirror() {
    const beta = state.get().beta,
      { rows, r } = analysis(beta),
      svg = byId("pos-mirror"),
      bins = 25,
      c1 = Array(bins).fill(0),
      c0 = Array(bins).fill(0);
    svg.setAttribute("viewBox", `0 0 ${W1} ${H1}`);
    svg.classList.add("fig", "fig-wide");
    svg.replaceChildren();
    r.gh.forEach((p, i) =>
      (rows[i].a ? c1 : c0)[Math.min(bins - 1, Math.floor(p * bins))]++,
    );
    const maxC = Math.max(10, ...c1, ...c0),
      hScale = (k) => Math.sqrt(k / maxC) * (base - top),
      inZone = r.gh.filter((p) => p < 0.05 || p > 0.95).length,
      glow = 0.05 + 0.25 * Math.min(1, inZone / 40);
    // Gridlines.
    [25, 100].filter((k) => k <= maxC).forEach((k) =>
      svg.append(
        el("text", { class: "tick", x: L1 - 6, y: base - hScale(k) + 4, "text-anchor": "end" }, String(k)),
        el("text", { class: "tick", x: L1 - 6, y: base + hScale(k) + 4, "text-anchor": "end" }, String(k)),
      ),
    );
    [0, 0.25, 0.5, 0.75, 1].forEach((v) =>
      svg.append(
        el("line", { class: "grid", x1: sx1(v), x2: sx1(v), y1: top - 6, y2: laneC + 36 }),
        el("text", { class: "tick", x: sx1(v), y: H1 - 22, "text-anchor": "middle" }, fmt(v, 2)),
      ),
    );
    // Red zones.
    [
      [0, 0.05],
      [0.95, 1],
    ].forEach(([a, b]) =>
      svg.append(
        el("rect", {
          x: sx1(a),
          y: top - 6,
          width: sx1(b) - sx1(a),
          height: laneC + 42 - top,
          fill: "var(--red)",
          opacity: glow,
        }),
        el("line", {
          x1: sx1(a ? a : b),
          x2: sx1(a ? a : b),
          y1: top - 6,
          y2: laneC + 36,
          stroke: "var(--red)",
          "stroke-width": 1.5,
          opacity: 0.4 + glow,
        }),
      ),
    );
    svg.append(
      el("text", { class: "fig-text", x: L1, y: 18, fill: "var(--red)" }, "ĝ < 0.05"),
      el("text", { class: "fig-text", x: R1, y: 18, "text-anchor": "end", fill: "var(--red)" }, "ĝ > 0.95"),
      el("text", { class: "fig-text ink", x: W1 / 2, y: 18, "text-anchor": "middle" }, `β = ${fmt(beta, 2)}`),
    );
    // Bars.
    const bw = (R1 - L1) / bins;
    for (let k = 0; k < bins; k++) {
      const x = L1 + k * bw + 1;
      if (c1[k])
        svg.append(el("rect", { x, y: base - hScale(c1[k]), width: bw - 2, height: hScale(c1[k]), fill: "var(--p)", opacity: 0.8 }));
      if (c0[k])
        svg.append(el("rect", { x, y: base, width: bw - 2, height: hScale(c0[k]), fill: "var(--teal)", opacity: 0.8 }));
    }
    svg.append(
      el("line", { class: "axis", x1: L1, x2: R1, y1: base, y2: base }),
      el("text", { class: "tick", x: L1 - 6, y: base + 4, "text-anchor": "end" }, "0"),
      el("text", { class: "fig-text", x: sx1(0.05) + 6, y: top + 12, fill: "var(--p)" }, "treated"),
      el("text", { class: "fig-text", x: sx1(0.05) + 6, y: bottom - 4, fill: "var(--teal)" }, "control"),
      el("text", { class: "fig-text", x: sx1(0.95) - 6, y: bottom - 4, "text-anchor": "end" }, "bar height ∝ √count"),
      el("text", { class: "tick", x: L1 - 6, y: laneT + 4, "text-anchor": "end" }, "A=1"),
      el("text", { class: "tick", x: L1 - 6, y: laneC + 4, "text-anchor": "end" }, "A=0"),
    );
    // Weight strip.
    svg.append(
      el("text", { class: "fig-text ink", x: L1, y: laneT - 36 }, "Every patient at ĝ; dot area ∝ weight"),
      el("line", { class: "grid", x1: L1, x2: R1, y1: laneT, y2: laneT }),
      el("line", { class: "grid", x1: L1, x2: R1, y1: laneC, y2: laneC }),
    );
    const order = rows.map((_, i) => i).sort((i, j) => r.w[j] - r.w[i]).reverse();
    order.forEach((i) => {
      const w = r.w[i],
        big = w > 20,
        rad = Math.min(34, 1.6 * Math.sqrt(w));
      svg.append(
        el("circle", {
          cx: sx1(r.gh[i]),
          cy: (rows[i].a ? laneT : laneC) + jitter(i) * 34,
          r: rad,
          fill: rows[i].a ? "var(--p)" : "var(--teal)",
          "fill-opacity": big ? 0.55 : 0.35,
          stroke: big ? "var(--red)" : "none",
          "stroke-width": 1.5,
        }),
      );
    });
    svg.append(
      el("text", { class: "axis-label", x: (L1 + R1) / 2, y: H1 - 4, "text-anchor": "middle" }, "Fitted propensity ĝ(X)"),
    );
    let iMax = 0;
    r.w.forEach((w, i) => w > r.w[iMax] && (iMax = i));
    readout(byId("pos-mirror-readout"), [
      ["Separation β", fmt(beta, 2)],
      ["Fitted α̂, β̂", `${fmt(r.coef[0], 2)}, ${fmt(r.coef[1], 2)}`],
      ["Treated / control", `${r.n1} / ${r.n0}`],
      ["In a red band", `${inZone} patients`],
      ["Largest weight", fmt(r.maxW, 1)],
      ["  held by", `${rows[iMax].a ? "treated" : "control"}, severity ${fmt(rows[iMax].x, 2)}`],
      ["Weights over 20", String(r.w.filter((w) => w > 20).length)],
    ]);
    byId("pos-mirror-caption").textContent =
      beta < 0.05
        ? "No separation: every ĝ is near 0.5, every weight near 2. Press Play or drag the slider to separate the arms."
        : `At β = ${fmt(beta, 2)}, ${inZone} patients have ĝ below 0.05 or above 0.95. The largest weight is ${fmt(r.maxW, 1)}: one ${rows[iMax].a ? "treated" : "control"} patient counts as ${fmt(r.maxW, 0)} people.`;
  }
  let fromPlayer = false,
    syncing = false;
  const mirrorPlayer = player(byId("pos-mirror-player"), {
    duration: 7000,
    label: "Separation β",
    formatValue: (t) => (4 * t).toFixed(2),
    onT: (t) => {
      if (syncing) return;
      fromPlayer = true;
      state.set({ beta: Math.round((4 * t) / 0.05) * 0.05 });
      fromPlayer = false;
    },
  });
  const syncPlayer = () => {
    if (fromPlayer) return;
    const b = state.get().beta;
    if (Math.abs(4 * mirrorPlayer.t - b) > 0.03) {
      syncing = true;
      mirrorPlayer.set(b / 4);
      syncing = false;
    }
  };

  /* ---------- Step 2: ESS meters and trace ---------- */
  const essTrace = (() => {
    const out = [];
    for (let k = 0; k <= 80; k++) {
      const b = k * 0.05,
        { r } = analysis(b);
      out.push([b, r.ess1 / r.n1, r.ess0 / r.n0]);
    }
    return out;
  })();
  function meter(label, n, value, color, note) {
    const frac = Math.max(0, Math.min(1, value / n));
    return `<div class="pos-meter"><div class="pos-meter-label"><span>${esc(label)}</span><span>${esc(note)}</span></div><div class="pos-track"><i style="width:${(100 * frac).toFixed(1)}%;background:${color}"></i></div></div>`;
  }
  function drawESS() {
    const beta = state.get().beta,
      { r } = analysis(beta);
    byId("pos-meters").innerHTML =
      meter("Treated arm", r.n1, r.ess1, "var(--p)", `ESS ${fmt(r.ess1, 1)} of ${r.n1} (${pct(r.ess1 / r.n1)})`) +
      meter("Control arm", r.n0, r.ess0, "var(--teal)", `ESS ${fmt(r.ess0, 1)} of ${r.n0} (${pct(r.ess0 / r.n0)})`) +
      meter("Largest treated weight's share of the treated total", 1, r.maxShare1, "var(--red)", pct(r.maxShare1, 1)) +
      meter("Largest control weight's share of the control total", 1, r.maxShare0, "var(--red)", pct(r.maxShare0, 1));
    byId("pos-meters").setAttribute(
      "aria-label",
      `Effective sample size: treated ${fmt(r.ess1, 1)} of ${r.n1}, control ${fmt(r.ess0, 1)} of ${r.n0}. Largest weight share: treated ${pct(r.maxShare1, 1)}, control ${pct(r.maxShare0, 1)}.`,
    );
    const svg = byId("pos-ess-trace"),
      plot = new CausalAnim.Plot(svg, {
        x: [0, 4],
        y: [0, 1],
        width: 640,
        height: 250,
        margin: { l: 54, r: 18, t: 26, b: 44 },
        xlabel: "Separation β",
        ylabel: "ESS / arm size",
      });
    plot.line(essTrace.map((v) => [v[0], v[1]]), { stroke: "var(--p)" });
    plot.line(essTrace.map((v) => [v[0], v[2]]), { stroke: "var(--teal)" });
    plot.vline(beta, { stroke: "var(--ink)" });
    plot.scatter([[beta, r.ess1 / r.n1]], 5, { fill: "var(--p)" });
    plot.scatter([[beta, r.ess0 / r.n0]], 5, { fill: "var(--teal)" });
    let s1 = 0,
      s2 = 0;
    r.w.forEach((w, i) => {
      if (analysis(beta).rows[i].a) {
        s1 += w;
        s2 += w * w;
      }
    });
    readout(byId("pos-ess-readout"), [
      ["β", fmt(beta, 2)],
      ["Treated Σw", fmt(s1, 1)],
      ["Treated Σw²", fmt(s2, 1)],
      ["ESS₁ = (Σw)²/Σw²", fmt(r.ess1, 1)],
      ["ESS₀", fmt(r.ess0, 1)],
      ["Largest weight", fmt(r.maxW, 1)],
    ]);
    byId("pos-ess-caption").textContent =
      `Treated: ${r.n1} patients behave like ${fmt(r.ess1, 0)} equally weighted ones. Control: ${r.n0} behave like ${fmt(r.ess0, 0)}. ` +
      (r.ess1 / r.n1 < 0.5 ? "The treated arm has lost more than half its information to uneven weights. " : "The weights are still fairly even. ") +
      "Each jump in the trace is one patient changing arms as β moves: a single treated patient with a huge weight can take most of an arm's effective size with them.";
  }

  /* ---------- Step 3: repeated samples ---------- */
  const G = P.GRID.sweep;
  let repBeta = 4;
  function drawRep() {
    const shown = G.filter((v) => v.beta <= repBeta + 1e-9),
      mk = (id, key, yr, ylabel, bars) => {
        const plot = new CausalAnim.Plot(byId(id), {
          x: [0, 4],
          y: yr,
          width: 640,
          height: 230,
          margin: { l: 54, r: 18, t: 26, b: 44 },
          xlabel: "Separation β",
          ylabel,
        });
        if (key === "bias") plot.hline(0, { stroke: "var(--green)", "stroke-dasharray": "6 4" });
        plot.vline(repBeta, { stroke: "var(--muted)" });
        [
          ["ipw", "var(--or)"],
          ["aipw", "var(--purple)"],
        ].forEach(([k, color]) => {
          if (!shown.length) return;
          plot.line(shown.map((v) => [v.beta, v[k][key]]), { stroke: color });
          plot.scatter(shown.map((v) => [v.beta, v[k][key]]), 4, { fill: color });
          if (bars)
            shown.forEach((v) =>
              plot.marks.append(
                el("line", {
                  x1: plot.sx(v.beta),
                  x2: plot.sx(v.beta),
                  y1: plot.sy(v[k].bias - 2 * v[k].mcse),
                  y2: plot.sy(v[k].bias + 2 * v[k].mcse),
                  stroke: color,
                  "stroke-width": 1.5,
                }),
              ),
            );
        });
      };
    mk("pos-rep-bias", "bias", [-0.2, 1], "Bias (± 2 Monte Carlo SE)", true);
    mk("pos-rep-sd", "sd", [0, 1], "SD across samples", false);
    const cur = shown.at(-1);
    if (cur)
      readout(byId("pos-rep-readout"), [
        ["β", fmt(cur.beta, 1)],
        ["IPW bias", `${fmt(cur.ipw.bias, 3)} ± ${fmt(2 * cur.ipw.mcse, 3)}`],
        ["IPW SD", fmt(cur.ipw.sd, 3)],
        ["AIPW bias", `${fmt(cur.aipw.bias, 3)} ± ${fmt(2 * cur.aipw.mcse, 3)}`],
        ["AIPW SD", fmt(cur.aipw.sd, 3)],
        ["Median smaller-arm ESS", fmt(cur.medianMinESS, 0)],
      ]);
    byId("pos-rep-caption").textContent = cur
      ? `At β = ${fmt(cur.beta, 1)}: IPW's SD is ${fmt(cur.ipw.sd / G[0].ipw.sd, 1)} times its no-separation value; AIPW's is ${fmt(cur.aipw.sd / G[0].aipw.sd, 1)} times.`
      : "";
  }
  byId("pos-rep-table").innerHTML = table(
    ["β", "IPW bias", "IPW SD", "AIPW bias", "AIPW SD", "Median smaller-arm ESS"],
    G.map((v) => [fmt(v.beta, 1), `${fmt(v.ipw.bias)} ± ${fmt(2 * v.ipw.mcse)}`, fmt(v.ipw.sd), `${fmt(v.aipw.bias)} ± ${fmt(2 * v.aipw.mcse)}`, fmt(v.aipw.sd), fmt(v.medianMinESS, 0)]),
    "400 repeated samples of 500 patients at each separation (± is 2 Monte Carlo SE)",
  );
  player(byId("pos-rep-player"), {
    duration: 6000,
    label: "Separation β",
    formatValue: (t) => (4 * t).toFixed(1),
    onT: (t) => {
      repBeta = 4 * t;
      drawRep();
    },
  });

  /* ---------- Step 4: responses ---------- */
  const repMemo = new Map();
  let repTimer = null;
  function repeatedFor(beta, cap, trim) {
    const key = [beta.toFixed(2), cap, trim].join("|");
    if (repMemo.has(key)) return repMemo.get(key);
    clearTimeout(repTimer);
    byId("pos-resp-status").textContent = "Running 150 repeated samples for these settings…";
    repTimer = setTimeout(() => {
      repMemo.set(key, P.repeated({ beta, reps: 150, n: P.N, seed: 7, cap, trim }));
      drawResponses();
    }, 250);
    return null;
  }
  function drawResponses() {
    const { beta, cap, trim, method } = state.get(),
      { rows, r } = analysis(beta, cap, trim),
      trimT = P.trimmedTarget(beta, trim),
      ato = P.atoTarget(beta),
      targets = {
        cap: { value: P.ATE, meanX: 0, name: "ATE (everyone)" },
        trim: { value: trimT.value, meanX: trimT.meanX, name: `Trimmed ATE (${pct(trimT.share)} of cohort)` },
        overlap: { value: ato.value, meanX: ato.meanX, name: "ATO (overlap population)" },
      },
      T = targets[method];
    byId("pos-cap-v").textContent = ord(cap);
    byId("pos-trim-v").textContent = fmt(trim, 2);
    byId("pos-cap").closest("label").style.opacity = method === "cap" ? 1 : 0.55;
    byId("pos-trim").closest("label").style.opacity = method === "trim" ? 1 : 0.55;
    // Population figure.
    const xs = Array.from({ length: 281 }, (_, i) => -3.5 + i * 0.025),
      whole = xs.map((x) => [x, P.phi(x)]),
      tgt = xs.map((x) => [x, P.targetDensity(x, beta, method, trim)]),
      ymax = Math.max(0.45, ...tgt.map((v) => v[1])) * 1.1,
      plot = new CausalAnim.Plot(byId("pos-pop"), {
        x: [-3.5, 3.5],
        y: [0, ymax],
        width: 640,
        height: 320,
        margin: { l: 54, r: 18, t: 40, b: 78 },
        xlabel: "Severity X",
        ylabel: "Density",
      });
    plot.area(whole, 0, { fill: "var(--muted)", opacity: 0.22 });
    plot.area(tgt, 0, { fill: "var(--purple)", opacity: 0.3 });
    plot.line(tgt, { stroke: "var(--purple)", "stroke-width": 2 });
    // Target means, labelled in the top margin.
    const m0 = plot.sx(0),
      m1 = plot.sx(T.meanX);
    plot.marks.append(
      el("line", { x1: m0, x2: m0, y1: plot.m.t, y2: plot.H - plot.m.b, stroke: "var(--green)", "stroke-dasharray": "6 4", "stroke-width": 1.5 }),
      el("line", { x1: m1, x2: m1, y1: plot.m.t, y2: plot.H - plot.m.b, stroke: "var(--purple)", "stroke-width": 1.5 }),
    );
    const apart = Math.abs(m1 - m0) > 150;
    plot.fg.append(
      el("text", { class: "fig-text", x: m0 - 4, y: 16, "text-anchor": "end", fill: "var(--green)" }, "ATE: τ̄ = 2"),
      el(
        "text",
        { class: "fig-text", x: apart ? m1 : m0 + 4, y: apart ? 16 : 32, "text-anchor": apart ? "middle" : "start", fill: "var(--purple)" },
        method === "cap" ? "target unchanged" : `target: τ̄ = ${fmt(T.value, 2)}`,
      ),
    );
    // Rug of this sample.
    const rugY = plot.H - 14;
    rows.forEach((v, i) => {
      const out =
        method === "trim"
          ? r.gh[i] < trim || r.gh[i] > 1 - trim
          : method === "cap"
            ? r.w[i] > r.capAt
            : false;
      plot.fg.append(
        el("line", {
          x1: plot.sx(v.x),
          x2: plot.sx(v.x),
          y1: rugY - (out ? 8 : 5),
          y2: rugY + (out ? 8 : 5),
          stroke: out ? "var(--red)" : "var(--muted)",
          "stroke-width": out ? 1.6 : 1,
          opacity: out ? 0.9 : method === "overlap" ? 0.15 + 0.85 * (v.a ? 1 - r.gh[i] : r.gh[i]) : 0.35,
        }),
      );
    });
    plot.fg.append(el("text", { class: "tick", x: plot.m.l - 6, y: rugY + 4, "text-anchor": "end" }, "rug"));
    const est = { cap: r.capped, trim: r.trimmedAIPW, overlap: r.overlap }[method];
    readout(byId("pos-pop-readout"), [
      ["Response", { cap: "cap weights", trim: "trim patients", overlap: "overlap weights" }[method]],
      ["Estimand", T.name],
      ["Its true value", fmt(T.value, 3)],
      ["This sample", fmt(est, 3)],
      method === "cap"
        ? ["Patients capped", `${r.nCapped} (cap ${fmt(r.capAt, 1)})`]
        : method === "trim"
          ? ["Patients kept", `${r.kept} of ${P.N}`]
          : ["Overlap ESS₁, ESS₀", `${fmt(r.essOverlap1, 0)}, ${fmt(r.essOverlap0, 0)}`],
    ]);
    byId("pos-pop-caption").textContent =
      method === "cap"
        ? "Capping leaves the population alone (purple equals grey): the question is still the ATE. The red ticks are the patients whose weights were cut."
        : method === "trim"
          ? `Trimming keeps severity between ${fmt(trimT.lo, 2)} and ${fmt(trimT.hi, 2)} in the population (${pct(trimT.share)}). Its average effect is ${fmt(trimT.value, 3)}, not 2.`
          : `Overlap weights tilt the population toward severity 0.5, where g ≈ 0.5. The ATO is ${fmt(ato.value, 3)}, not 2. Tick darkness shows each patient's overlap weight.`;
    // Comparison table.
    const rep = repeatedFor(beta, cap, trim),
      s = rep && rep.summary,
      row = (label, k, target, changes) => [
        label,
        target === P.ATE ? "ATE" : k === "overlap" ? "ATO" : "Trimmed ATE",
        fmt(target, 3),
        fmt(r[k], 3),
        s ? `${fmt(s[k].bias, 3)} ± ${fmt(2 * s[k].mcse, 3)}` : "…",
        s ? fmt(s[k].sd, 3) : "…",
        s ? fmt(s[k].vsATE, 3) : "…",
        changes,
      ];
    byId("pos-resp-table").innerHTML = table(
      ["Analysis", "Estimand", "True value", "This sample", "Bias vs its estimand", "SD", "Mean minus ATE", "Changes the question?"],
      [
        row("IPW, no fix", "ipw", P.ATE, "No"),
        row("AIPW, no fix", "aipw", P.ATE, "No"),
        row(`(a) IPW capped at ${ord(cap)}`, "capped", P.ATE, "No, but biased"),
        row(`(b) IPW, trimmed at a = ${fmt(trim, 2)}`, "trimmedIPW", trimT.value, trim > 0 ? "Yes" : "No (a = 0)"),
        row(`(b) AIPW, trimmed at a = ${fmt(trim, 2)}`, "trimmedAIPW", trimT.value, trim > 0 ? "Yes" : "No (a = 0)"),
        row("(c) Overlap weights", "overlap", ato.value, beta > 0 ? "Yes" : "No (β = 0)"),
      ],
      `This cohort and 150 repeated samples at β = ${fmt(beta, 2)} (± is 2 Monte Carlo SE)`,
    );
    if (rep) byId("pos-resp-status").textContent = "Repeated samples: 150 cohorts of 500, propensity refitted in each.";
    // Contract connection.
    let target = "ate";
    try {
      target = Causality.state().contract.target || "ate";
    } catch {}
    const who = { ate: "everyone in the cohort (ATE)", att: "the people who were actually treated (ATT)", atc: "the people who actually received control (ATC)" }[target] || "everyone in the cohort (ATE)";
    byId("pos-contract").innerHTML =
      `<strong>Your estimand contract</strong> from the first lesson asks about ${esc(who)}. ` +
      (target === "att"
        ? "For the ATT only one side of positivity is needed: every kind of treated patient must have some chance of control, g(x) < 1. The thin left tail (treated patients with tiny ĝ) is no longer a problem; the right tail still is. "
        : target === "atc"
          ? "For the ATC only one side of positivity is needed: every kind of control patient must have some chance of treatment, g(x) > 0. "
          : "") +
      "Capping keeps that question and accepts bias in answering it. Trimming and overlap weights answer a different question, about a population defined by the propensity model. If you choose them, amend the contract and say so in the SAP; do not report the result as the effect in the original population.";
  }

  /* ---------- Step 5: structural vs practical ---------- */
  function drawSupport() {
    const kind = state.get().support,
      structural = kind === "structural",
      beta = P.SUPPORT_BETA,
      rows = P.sample(beta, P.N, P.SEED, { draws: D, structural, cut: 1.5 }),
      bins = 28,
      lo = -3.5,
      hi = 3.5,
      bw = (hi - lo) / bins,
      c1 = Array(bins).fill(0),
      c0 = Array(bins).fill(0);
    rows.forEach((v) => {
      const k = Math.max(0, Math.min(bins - 1, Math.floor((v.x - lo) / bw)));
      (v.a ? c1 : c0)[k]++;
    });
    const maxC = Math.max(...c1, ...c0),
      plot = new CausalAnim.Plot(byId("pos-support"), {
        x: [lo, hi],
        y: [-maxC, maxC],
        width: 640,
        height: 300,
        margin: { l: 54, r: 18, t: 30, b: 44 },
        xlabel: "Severity X",
        ylabel: "Patients (treated up, control down)",
        yTickFormat: (v) => String(Math.abs(v)),
      });
    const zones = structural
      ? [[1.5, hi]]
      : [
          [lo, P.CENTER - P.logit(0.95) / beta],
          [P.CENTER + P.logit(0.95) / beta, hi],
        ];
    zones.forEach(([a, b]) =>
      plot.marks.append(
        el("rect", {
          x: plot.sx(a),
          y: plot.m.t,
          width: plot.sx(b) - plot.sx(a),
          height: plot.H - plot.m.t - plot.m.b,
          fill: "var(--red)",
          opacity: structural ? 0.2 : 0.1,
        }),
      ),
    );
    plot.bars(c1.map((c, k) => [lo + (k + 0.5) * bw, c, 0]).filter((v) => v[1]), bw * 0.9, { fill: "var(--p)", opacity: 0.8 });
    plot.bars(c0.map((c, k) => [lo + (k + 0.5) * bw, -c, 0]).filter((v) => v[1]), bw * 0.9, { fill: "var(--teal)", opacity: 0.8 });
    plot.marks.append(el("line", { class: "axis", x1: plot.m.l, x2: plot.W - plot.m.r, y1: plot.sy(0), y2: plot.sy(0) }));
    plot.fg.append(
      el(
        "text",
        { class: "fig-text", x: plot.W - plot.m.r - 4, y: plot.m.t - 10, "text-anchor": "end", fill: "var(--red)" },
        structural ? "g(x) = 0 above 1.5" : "true g below 0.05 or above 0.95",
      ),
    );
    const treatedAbove = rows.filter((v) => v.a && v.x > 1.5).length,
      above = rows.filter((v) => v.x > 1.5).length,
      sup = (n) => P.GRID.support.find((v) => v.n === n && v.structural === structural);
    readout(byId("pos-support-readout"), [
      ["Case", structural ? "structural" : "practical"],
      ["Separation β", String(beta)],
      ["Severity > 1.5", `${above} patients`],
      ["  of them treated", String(treatedAbove)],
      ["IPW bias, n = 500", fmt(sup(500).ipw.bias, 3)],
      ["IPW bias, n = 5000", fmt(sup(5000).ipw.bias, 3)],
    ]);
    byId("pos-support-caption").textContent = structural
      ? `${above} patients have severity above 1.5 and none of them is treated, in this sample or any other. What treatment would do for them is not in the data.`
      : `${treatedAbove} of the ${above} patients above severity 1.5 are treated, and a few mild patients are too. The tails are thin, but a larger study fills them.`;
    const S = P.GRID.support;
    byId("pos-support-table").innerHTML = table(
      ["Case", "n", "IPW bias", "IPW SD", "AIPW bias", "AIPW SD"],
      S.map((v) => [
        (v.structural ? "Structural" : "Practical") + (v.structural === structural ? " (shown)" : ""),
        String(v.n),
        `${fmt(v.ipw.bias)} ± ${fmt(2 * v.ipw.mcse)}`,
        fmt(v.ipw.sd),
        `${fmt(v.aipw.bias)} ± ${fmt(2 * v.aipw.mcse)}`,
        fmt(v.aipw.sd),
      ]),
      `200 repeated samples at β = ${beta}; truth ATE = 2 in both cases (± is 2 Monte Carlo SE)`,
    );
  }

  /* ---------- Step 6: SAP draft ---------- */
  function drawSAP() {
    const { trim, cap, method } = state.get(),
      primary =
        method === "overlap"
          ? "the average treatment effect in the overlap population (ATO), estimated with overlap weights; the target population will be described by a weighted table of baseline characteristics"
          : method === "trim"
            ? `the average treatment effect among patients whose estimated propensity lies in [${fmt(trim, 2)}, ${fmt(1 - trim, 2)}]; this is a different estimand from the ATE and the retained population will be described`
            : `the ATE, estimated by AIPW; as a sensitivity analysis, IPW with weights capped at the ${ord(cap)}, reported with its direction of bias`;
    byId("pos-sap-draft").textContent =
      `Draft wording from your choices in step 4: “Overlap will be assessed before outcome data are examined, using the mirrored distribution of estimated propensity scores by arm, the effective sample size per arm, and the largest weight's share of each arm's total. If either arm's effective sample size is below half its size, the primary analysis will target ${primary}.”`;
  }

  function render() {
    drawMirror();
    syncPlayer();
    drawESS();
    drawResponses();
    drawSupport();
    drawSAP();
  }
  state.subscribe(render);
  render();
  drawRep();
  guided(root, state);
  tools(root, state);
  window.PositivityLab = { analysis, mirrorPlayer };
})();
