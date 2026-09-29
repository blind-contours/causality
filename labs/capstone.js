/* Capstone: an emulated trial, end to end.
 * The registry is simulated live (science/capstone.js, seeded). The cross-fitted Super Learner is slow,
 * so its per-patient held-out predictions, weights and CV tables come from science/capstone-data.json
 * (scripts/capstone-precompute.cjs). Every estimate, SE, E-value and sentence below is computed here from those. */
(function () {
  const { store, control, fmt, esc } = CausalLab,
    { el, html, player } = CausalAnim,
    C = CausalCapstone,
    root = document.querySelector('[data-lab="capstone"]'),
    MASKS = Array.from({ length: 15 }, (_, i) => (i + 1).toString(2).padStart(4, "0")),
    state = store(
      "capstone",
      { step: 0, bound: C.BOUND, t0: "eligibility", keep: "1111" },
      { step: [0, 6], bound: [0, 0.1], t0: ["eligibility", "implant"], keep: MASKS },
    );
  const byId = (id) => document.getElementById(id),
    rows = C.simulate(C.N, C.SEED),
    n = rows.length,
    n1 = rows.filter((r) => r.a).length,
    n0 = n - n1,
    crossN = rows.filter((r) => r.cross).length,
    bench = C.benchmark(rows),
    minus = (s) => String(s).replace(/^-/, "−"),
    pts = (x, d = 1) => minus((100 * x).toFixed(d)), // risk difference in percentage points
    pc = (x, d = 1) => (100 * x).toFixed(d) + "%",
    f2 = (x) => minus(x.toFixed(2)),
    f3 = (x) => minus(x.toFixed(3)),
    rawP1 = rows.filter((r) => r.a && r.y).length / n1,
    rawP0 = rows.filter((r) => !r.a && r.y).length / n0,
    readout = (box, pairs) =>
      box.replaceChildren(...pairs.flatMap(([k, v]) => [html("span", { class: "k" }, k), html("span", {}, String(v))])),
    swatch = (color, kind = "line", dash = "") =>
      kind === "dot"
        ? `<svg class="swatch" width="28" height="10" aria-hidden="true"><circle cx="14" cy="5" r="4.5" fill="${color}"/></svg>`
        : kind === "box"
          ? `<svg class="swatch" width="28" height="10" aria-hidden="true"><rect x="1" y="0" width="26" height="10" fill="${color}" opacity=".45"/></svg>`
          : `<svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="2.5" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;
  // Figures are laid out at their container's real width, so text stays at 13px on a phone.
  const widthOf = (svg, max = 720) => {
    const w = svg.parentElement?.clientWidth || 0;
    return Math.max(280, Math.min(max, w || 640));
  };
  const size = (svg, W, H) => {
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.maxWidth = W + "px";
    svg.classList.add("fig");
    svg.replaceChildren();
  };
  const text = (svg, x, y, s, attrs = {}) => svg.append(el("text", { class: "fig-text", x, y, ...attrs }, s));

  root.innerHTML = `
<section class="lab-step" data-title="The question"><h2 tabindex="-1">One question, asked precisely</h2>
<p>A heart team asks: for patients like ours, does implanting the new transcatheter device when a patient becomes eligible lower the chance of death or heart-failure hospitalisation over the next year, compared with standard care?</p>
<aside class="world-card"><b>This lesson's world</b> ${n.toLocaleString("en-US")} simulated registry patients with five baseline covariates (age, sex, LVEF, eGFR, STS-PROM) · outcome: death or heart-failure hospitalisation within 12 months, and event-free months · truth: known exactly, because the world is simulated</aside>
<p>A registry does not randomise. Here sicker patients received the device more often, so a raw comparison mixes the device's effect with who received it.</p>
<p>Start with one patient. Picture her twice, once under each strategy, from the day she becomes eligible.</p>
<div class="figure"><svg id="cap-one" role="img" aria-label="One patient's two possible years. Top lane: device implanted at eligibility, event-free to 12 months. Bottom lane: standard care; she crosses over to the device at month 5 and has a heart-failure hospitalisation at month 8, which counts against standard care under the treatment-policy strategy."></svg>
<p class="fig-caption">Schematic. Only one of the two years is ever observed. The effect for her is the difference between the lanes; the estimand averages that difference over the population.</p></div>
<p>Before any model, write the estimand. ICH E9(R1) asks for five attributes.</p>
<div class="table-wrap"><table class="cap-table"><caption>The estimand</caption><thead><tr><th scope="col">Attribute</th><th scope="col">This study</th></tr></thead><tbody>
<tr><th scope="row">Population</th><td>Adults the heart team judges eligible for the device</td></tr>
<tr><th scope="row">Treatment strategies</th><td>Device implanted at eligibility, versus standard care (surgery or medical therapy)</td></tr>
<tr><th scope="row">Endpoint</th><td>Death or heart-failure hospitalisation within 12 months; secondary: event-free months through 12</td></tr>
<tr><th scope="row">Intercurrent event</th><td>Crossover from standard care to the device: handled by the strategy you choose below</td></tr>
<tr><th scope="row">Summary</th><td>Risk difference at 12 months (device minus standard care); secondary: difference in restricted mean survival time, ΔRMST(12), in months</td></tr>
</tbody></table></div>
<div class="predict" data-options="They stay in standard care, and their events count there|They are censored at the crossover|They move to the device arm" data-answer="0" data-hint="Treatment policy compares strategies as started at time zero. What happens later, crossover included, is part of the strategy. Censoring at crossover targets a hypothetical world without crossover and needs the weighting of the clone-censor-weight lesson.">${crossN} standard-care patients later crossed over to the device. Under the treatment-policy strategy, what happens to them in the analysis?</div>
<p>They stay where they started. The question matches the decision at time zero: start the device now, or start standard care knowing some patients later switch.</p>
<p class="math">ψ<sub>RD</sub> = P(Y¹ = 1) − P(Y⁰ = 1), where Yᵃ is the 1-year event status under strategy a</p>
<p>A "no crossover" estimand is possible. It answers a different question and needs extra assumptions about why patients switch.</p>
</section>

<section class="lab-step" data-title="The protocol"><h2 tabindex="-1">Write the protocol of the trial you wish you had run</h2>
<p>Target trial emulation starts on paper. Write each part of the randomised trial, then say how the registry imitates it.</p>
<div class="table-wrap"><table class="cap-table"><caption>Target trial protocol and its emulation</caption><thead><tr><th scope="col">Component</th><th scope="col">Target trial</th><th scope="col">Emulation in the registry</th></tr></thead><tbody>
<tr><th scope="row">Eligibility</th><td>Meets the device indication at heart-team review; no prior device</td><td>First registry visit at which every criterion is met</td></tr>
<tr><th scope="row">Strategies</th><td>Device at eligibility, or standard care</td><td>Strategy recorded in the heart-team decision at that visit</td></tr>
<tr><th scope="row">Assignment</th><td>Randomised</td><td>Assumed as good as random given age, sex, LVEF, eGFR and STS-PROM</td></tr>
<tr><th scope="row">Time zero</th><td>Randomisation</td><td>The eligibility visit, in both arms</td></tr>
<tr><th scope="row">Follow-up</th><td>12 months</td><td>Linked vital status and hospital records, complete through 12 months</td></tr>
<tr><th scope="row">Outcome</th><td>Death or heart-failure hospitalisation</td><td>The same, from linked records</td></tr>
<tr><th scope="row">Contrast</th><td>Intention to treat</td><td>Observational analogue: strategy at time zero (treatment policy)</td></tr>
<tr><th scope="row">Analysis</th><td>Difference in 1-year risk</td><td>AIPW and TMLE with cross-fitted Super Learner models; influence-function SE</td></tr>
</tbody></table></div>
<div class="predict" data-options="The device arm, because deaths while waiting for the implant drop out of its count|Standard care, because it has more follow-up|Neither: moving time zero only shifts the clock" data-answer="0" data-hint="A device patient must survive until the implant to be counted from the implant date. That waiting time is immortal time, and it flatters the device.">Suppose the device arm's time zero were its implant date, weeks after eligibility, while standard care started at eligibility. Which arm would look better, and why?</div>
<div class="figure"><div class="fig-row"><div><svg id="cap-t0" role="img" aria-label="Two device-arm patients on a timeline from eligibility. One waits six weeks and then receives the implant; the other dies during the wait. The shaded wait is immortal time when time zero is the implant date."></svg></div>
<div><div class="fig-controls"><label for="cap-t0-sel">Device arm's time zero</label><select id="cap-t0-sel"><option value="eligibility">Eligibility visit (protocol)</option><option value="implant">Implant date (a mistake)</option></select></div><div class="fig-readout" id="cap-t0-readout"></div></div></div>
<p class="fig-caption" id="cap-t0-caption" role="status"></p></div>
<p>Three assumptions let the registry stand in for the trial: consistency, no unmeasured confounding given the five covariates, and positivity. Only positivity leaves a trace in the data, so that is the next check.</p>
</section>

<section class="lab-step" data-title="Positivity"><h2 tabindex="-1">Did every kind of patient have a real chance of either strategy?</h2>
<p>Fit the propensity ĝ(x), the probability of starting the device given the covariates. Each device patient then counts 1/ĝ times, each standard-care patient 1/(1 − ĝ) times.</p>
<p>Kish's effective sample size, ESS = (Σw)² / Σw², says how many equally weighted patients an arm is worth.</p>
<div class="predict" data-options="The device arm|The standard-care arm|Both lose the same share" data-answer="0" data-hint="The device arm is the smaller one, and its few low-risk patients with small ĝ carry the largest weights of anyone in the registry.">Which arm will lose the larger share of its patients to unequal weights?</div>
<div class="figure"><div class="fig-row"><div><svg id="cap-overlap" role="img" aria-label="Mirrored histogram of cross-fitted propensity scores: device patients above the axis, standard-care patients below. Dashed red lines mark the propensity bound; its value and the diagnostics are listed beside the figure."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--p)", "box")}Device (above the axis)</span><span>${swatch("var(--teal)", "box")}Standard care (below)</span><span>${swatch("var(--red)", "line", "5 4")}Bound on ĝ</span></p></div>
<div><div class="fig-controls"><label for="cap-bound">Bound ĝ to [b, 1 − b], b = <span id="cap-bound-v"></span></label><input id="cap-bound" type="range" min="0" max="0.1" step="0.005"><button type="button" id="cap-bound-reset">Back to the pre-specified b = ${C.BOUND}</button></div>
<div class="fig-readout" id="cap-overlap-readout"></div></div></div>
<p class="fig-caption" id="cap-overlap-caption" role="status"></p></div>
<div class="cap-decision"><b>Pre-specified decision (written before outcomes were seen).</b> Bound ĝ to [${C.BOUND}, ${1 - C.BOUND}] inside the estimator; this keeps the estimand. Report the ESS per arm. If either arm's ESS falls below half its size, or more than 1% of patients fall outside the bound, add trimmed and overlap-weighted analyses as sensitivity analyses, labelled as different populations.</div>
<p id="cap-decision-result"></p>
</section>

<section class="lab-step" data-title="Nuisance models"><h2 tabindex="-1">Let cross-validation choose the models</h2>
<p>AIPW needs two fitted models: the outcome regression m̂ₐ(x) = P̂(Y = 1 | A = a, X = x) and the propensity ĝ(x). Nobody knows their true shapes, so fit several learners and let held-out error decide.</p>
<p>The library has four simple learners: logistic regression with main terms; the same with squares and pairwise interactions; k-nearest neighbours (k = ${C.KNN_K}); and additive piecewise-linear splines, a small GAM.</p>
<p>Each learner is fitted on four fifths of the patients and scored on the fifth it never saw, five times. The cross-validated risk is the mean squared error of those held-out predictions (the Brier score, for a yes/no outcome).</p>
<div class="predict" data-options="Yes: it keeps only the learner with the lowest CV risk|No: it mixes learners whose errors differ|It gives every learner a quarter" data-answer="1" data-hint="The Super Learner chooses the convex combination (weights ≥ 0, summing to 1) with the lowest CV risk. A mix beats every single learner when their mistakes are not the same.">Will the Super Learner put all its weight on the single learner with the lowest CV risk?</div>
<div class="figure"><div class="fig-row"><div><svg id="cap-sl" role="img" aria-label="For each learner, its cross-validated improvement over predicting the overall event rate, and the weight the Super Learner gives it. The last row is the ensemble. Values are in the table beside the figure."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--muted)", "box")}CV improvement over the overall rate</span><span>${swatch("var(--purple)", "box")}Super Learner weight</span></p></div>
<div><fieldset class="fig-controls cap-keep"><legend>Learners in the library</legend>${C.LEARNERS.map((l, j) => `<label><input type="checkbox" id="cap-keep-${j}"> ${esc(l.label)}</label>`).join("")}</fieldset>
<div class="fig-readout" id="cap-sl-readout"></div></div></div>
<p class="fig-caption" id="cap-sl-caption" role="status"></p></div>
<div id="cap-sl-table"></div>
<p>Cross-fitting uses the same idea one level up. The patients are split into five folds; for each fold, the whole Super Learner is refitted on the other four and predicts that fold. Every patient's m̂₁, m̂₀ and ĝ come from models that never saw that patient.</p>
<details><summary>The weights in each cross-fitting fold, and the propensity and RMST ensembles</summary><div id="cap-folds"></div><p class="note">The ensemble's CV risk is computed on the same held-out predictions that chose its weights, so it is slightly optimistic. The SuperLearner package's CV.SuperLearner nests one more layer of cross-validation to measure that honestly.</p></details>
</section>

<section class="lab-step" data-title="The estimate"><h2 tabindex="-1">The estimate, with an honest interval</h2>
<p>Among device patients ${pc(rawP1)} had an event within a year; among standard-care patients, ${pc(rawP0)}. The unadjusted difference is ${pts(rawP1 - rawP0)} percentage points.</p>
<div class="predict" data-options="It stays about the same: harm|It shrinks to about zero|It reverses: a benefit" data-answer="2" data-hint="Device patients were sicker (higher STS-PROM, older), and sickness raises the risk. Standardising both strategies to the whole registry removes that head start.">After adjusting for the five covariates, what happens to the difference?</div>
<div class="figure"><svg id="cap-forest" role="img" aria-label="Estimates of the 1-year risk difference in percentage points: unadjusted and plug-in in orange, AIPW and TMLE in purple with 95% intervals, the truth as a green dashed line and zero as a grey line. The numbers are in the table below."></svg><div id="cap-forest-player"></div>
<p class="legend legend-swatches"><span>${swatch("var(--or)", "dot")}Unadjusted and plug-in</span><span>${swatch("var(--purple)", "dot")}AIPW (one-step) and TMLE</span><span>${swatch("var(--green)", "line", "6 4")}Truth (known only because the world is simulated)</span></p>
<p class="fig-caption" id="cap-forest-caption" role="status"></p></div>
<div id="cap-est-table"></div>
<p class="math">ψ̂ = (1/n) Σᵢ [ m̂₁(Xᵢ) − m̂₀(Xᵢ) + Aᵢ/ĝ(Xᵢ)·(Yᵢ − m̂₁(Xᵢ)) − (1 − Aᵢ)/(1 − ĝ(Xᵢ))·(Yᵢ − m̂₀(Xᵢ)) ]<br>ϕ̂ᵢ = the bracket for patient i, minus ψ̂ &nbsp;·&nbsp; SE = √( (1/n) Σᵢ ϕ̂ᵢ² ) / √n</p>
<p id="cap-est-explain"></p>
<p>The secondary estimand uses the same machinery with the outcome min(T, 12), the event-free months in the first year. Follow-up is complete, so no censoring weights are needed.</p>
<div id="cap-rmst-table"></div>
</section>

<section class="lab-step" data-title="Sensitivity"><h2 tabindex="-1">How strong would a hidden confounder have to be?</h2>
<p>Everything so far assumed the five covariates capture every common cause of strategy and outcome. Frailty, for one, is not in the registry.</p>
<p>The E-value turns the estimate into a strength: the risk ratio by which an unmeasured confounder would need to be associated with both strategy and outcome, beyond the measured covariates, to move the risk ratio to 1.</p>
<p id="cap-rr-line"></p>
<p class="math">For a risk ratio below 1, invert it first: RR* = 1/RR. Then E = RR* + √(RR*(RR* − 1)).</p>
<div class="predict" data-options="Yes, it could explain the point estimate away|No, the effect is too large for that|Only if it also changed the outcome model" data-answer="0" data-hint="The joint bias factor of a confounder as strong as STS-PROM exceeds the observed RR* (and the E-value curve), so it could move the point estimate to the null. Frailty would have to be about that strong.">STS-PROM is the strongest measured confounder. If a confounder just as strong had gone unmeasured, could it explain the effect away?</div>
<div class="figure"><div class="fig-row"><div><svg id="cap-evalue" role="img" aria-label="Pairs of confounder strengths, association with strategy on the horizontal axis and with the outcome on the vertical, that would explain away the point estimate (solid purple curve) or the confidence limit (dashed). The E-value is where the solid curve meets the diagonal. An orange point marks the strength of STS-PROM."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--purple)")}Explains away the point estimate</span><span>${swatch("var(--purple)", "line", "5 4")}Explains away the confidence limit</span><span>${swatch("var(--or)", "dot")}STS-PROM's measured strength</span></p></div>
<div><div class="fig-readout" id="cap-evalue-readout"></div></div></div>
<p class="fig-caption" id="cap-evalue-caption" role="status"></p></div>
<p>Say it plainly in the report: a confounder about as strong as the strongest one we measured could erase the effect. Whether frailty is that strong, once age, LVEF, eGFR and STS-PROM are accounted for, is a clinical judgement, and a reader can now make it.</p>
</section>

<section class="lab-step" data-title="SAP and report"><h2 tabindex="-1">What goes in the SAP and in the report</h2>
<p>The statistical analysis plan fixes, before outcomes are seen: the estimand table, the protocol table, the covariates, the learner library and fold count, the propensity bound and the positivity trigger, the estimators and their SEs, and the sensitivity analyses.</p>
<p>The report then says what came out, in words a heart team can read. This paragraph is generated from the numbers above.</p>
<div class="cap-report" id="cap-report"></div>
<p>Questions a reviewer will ask, with the answers this analysis can give.</p>
<div class="cap-qa" id="cap-qa"></div>
<div data-r="capstone" data-r-intro="The same pipeline in base R: a simulated registry from this world (R's own random numbers, so a different draw from the page), a three-learner ensemble with convex weights chosen by 5-fold CV, 5-fold cross-fitting, AIPW with an influence-function SE, the risk ratio and its E-value."></div>
<p class="note">What is exact, simulated and schematic: the world's conditional risks and the propensity are exact formulas, and the population truth is a Monte Carlo average over one million simulated patients. The registry of ${n.toLocaleString("en-US")} patients is one seeded simulation; its cross-fitted Super Learner predictions are precomputed by scripts/capstone-precompute.cjs, and every estimate, SE, E-value and sentence here is computed from them in your browser. The two timelines are schematic.</p>
</section>`;

  /* ---------- controls ---------- */
  control(byId("cap-t0-sel"), state, "t0");
  control(byId("cap-bound"), state, "bound");
  byId("cap-bound-reset").onclick = () => state.set({ bound: C.BOUND });
  C.LEARNERS.forEach((_, j) => {
    const box = byId("cap-keep-" + j),
      read = () => (box.checked = state.get().keep[j] === "1");
    read();
    state.subscribe(read);
    box.addEventListener("change", () => {
      const k = state.get().keep.split("");
      k[j] = box.checked ? "1" : "0";
      if (!k.includes("1")) {
        box.checked = true;
        return;
      }
      state.set({ keep: k.join("") });
    });
  });

  /* ---------- Step 1: one patient, two years (schematic) ---------- */
  function drawOne() {
    const svg = byId("cap-one"),
      W = widthOf(svg, 1100),
      narrow = W < 480,
      H = narrow ? 220 : 200,
      L = narrow ? 16 : 170,
      R = W - 22,
      sx = (m) => L + (m / 12) * (R - L),
      lanes = narrow ? [58, 142] : [52, 122];
    size(svg, W, H);
    const name = ["Device at eligibility", "Standard care"];
    lanes.forEach((y, k) => {
      if (narrow) text(svg, L, y - 16, name[k], { class: "fig-text ink" });
      else text(svg, L - 12, y + 4, name[k], { class: "fig-text ink", "text-anchor": "end" });
      svg.append(el("line", { x1: sx(0), x2: sx(12), y1: y, y2: y, stroke: "var(--rule)", "stroke-width": 6, "stroke-linecap": "round" }));
    });
    // Device lane: event-free to 12 months.
    svg.append(el("line", { class: "cap-grow", x1: sx(0), x2: sx(12), y1: lanes[0], y2: lanes[0], stroke: "var(--p)", "stroke-width": 6, "stroke-linecap": "round" }));
    text(svg, sx(12), lanes[0] + 24, "event-free at 12 months", { "text-anchor": "end" });
    // Standard-care lane: crossover at 5, event at 8.
    svg.append(
      el("line", { class: "cap-grow", x1: sx(0), x2: sx(5), y1: lanes[1], y2: lanes[1], stroke: "var(--teal)", "stroke-width": 6, "stroke-linecap": "round" }),
      el("line", { class: "cap-grow", x1: sx(5), x2: sx(8), y1: lanes[1], y2: lanes[1], stroke: "var(--teal)", "stroke-width": 6, "stroke-dasharray": "2 6", "stroke-linecap": "round" }),
      el("circle", { cx: sx(5), cy: lanes[1], r: 6, fill: "var(--paper)", stroke: "var(--teal)", "stroke-width": 2.5 }),
      el("path", { d: `M${sx(8) - 7},${lanes[1] - 7} l14,14 m0,-14 l-14,14`, stroke: "var(--red)", "stroke-width": 3 }),
    );
    text(svg, sx(5), lanes[1] + 26, "crossover", { "text-anchor": "middle" });
    text(svg, sx(8) - 4, lanes[1] + 26, narrow ? "event" : "event: counts for standard care", { "text-anchor": "start" });
    // Time zero and horizon.
    const y0 = 16,
      yb = H - 12;
    svg.append(el("line", { x1: sx(0), x2: sx(0), y1: y0 + 8, y2: yb - 14, stroke: "var(--ink)", "stroke-width": 1.5 }));
    text(svg, sx(0), yb, "time zero: eligibility", { "text-anchor": "start", class: "fig-text ink" });
    svg.append(el("line", { x1: sx(12), x2: sx(12), y1: y0 + 8, y2: yb - 14, stroke: "var(--muted)", "stroke-width": 1.2, "stroke-dasharray": "4 4" }));
    text(svg, sx(12), yb, "12 months", { "text-anchor": "end" });
  }

  /* ---------- Step 2: time zero (schematic) ---------- */
  function drawT0() {
    const svg = byId("cap-t0"),
      W = widthOf(svg, 900),
      H = 200,
      L = 20,
      R = W - 20,
      sx = (w) => L + (w / 16) * (R - L), // weeks 0..16
      implant = state.get().t0 === "implant",
      yA = 70,
      yB = 140;
    size(svg, W, H);
    const z = implant ? 6 : 0;
    if (implant)
      svg.append(el("rect", { x: sx(0), y: 30, width: sx(6) - sx(0), height: 136, fill: "var(--red)", opacity: 0.12 }));
    text(svg, sx(0) + 4, 24, implant ? "waiting time: immortal" : "follow-up starts at eligibility", { class: "fig-text ink" });
    // Patient 1: waits 6 weeks, implanted, followed.
    svg.append(
      el("line", { x1: sx(0), x2: sx(6), y1: yA, y2: yA, stroke: "var(--p)", "stroke-width": 5, "stroke-dasharray": "3 5", "stroke-linecap": "round", opacity: implant ? 0.45 : 1 }),
      el("line", { x1: sx(6), x2: sx(16), y1: yA, y2: yA, stroke: "var(--p)", "stroke-width": 5, "stroke-linecap": "round" }),
      el("rect", { x: sx(6) - 5, y: yA - 9, width: 10, height: 18, rx: 2, fill: "var(--p)" }),
    );
    text(svg, sx(6) + 8, yA - 12, "implant, week 6");
    // Patient 2: dies at week 3 while waiting.
    svg.append(
      el("line", { x1: sx(0), x2: sx(3), y1: yB, y2: yB, stroke: "var(--p)", "stroke-width": 5, "stroke-dasharray": "3 5", "stroke-linecap": "round", opacity: implant ? 0.45 : 1 }),
      el("path", { d: `M${sx(3) - 7},${yB - 7} l14,14 m0,-14 l-14,14`, stroke: "var(--red)", "stroke-width": 3 }),
    );
    const deathLabel = W < 480 ? (implant ? "death, week 3: dropped" : "death, week 3: counted") : implant ? "death at week 3: never counted" : "death at week 3: counted for the device arm";
    text(svg, sx(3) + 12, yB + 5, deathLabel, { class: implant ? "fig-text" : "fig-text ink" });
    svg.append(el("line", { x1: sx(z), x2: sx(z), y1: 32, y2: 168, stroke: "var(--ink)", "stroke-width": 2 }));
    text(svg, sx(z) + (z ? -4 : 4), 188, "time zero", { "text-anchor": z ? "end" : "start", class: "fig-text ink" });
    readout(byId("cap-t0-readout"), [
      ["time zero", implant ? "implant date" : "eligibility"],
      ["death while waiting", implant ? "excluded" : "counted"],
      ["bias", implant ? "favours the device" : "none from timing"],
    ]);
    byId("cap-t0-caption").textContent = implant
      ? "Schematic. Counting the device arm from the implant date silently requires surviving the wait. Deaths during the wait vanish from the device arm, and the device looks better than it is."
      : "Schematic. With time zero at eligibility in both arms, a patient who dies while waiting for the implant counts against the device strategy, exactly as in a randomised trial.";
  }

  /* ---------- data-dependent steps ---------- */
  let D = null,
    preds = null,
    est = null,
    truth = null;
  const estFor = (b) => C.estimate(rows, preds, { bound: b });

  function drawOverlap() {
    if (!D) return;
    const svg = byId("cap-overlap"),
      b = state.get().bound,
      W = widthOf(svg, 900),
      H = 280,
      L = 62,
      R = W - 14,
      top = 24,
      mid = 132,
      bot = 238,
      bins = 25,
      c1 = Array(bins).fill(0),
      c0 = Array(bins).fill(0),
      sx = (p) => L + p * (R - L);
    preds.forEach((p, i) => (rows[i].a ? c1 : c0)[Math.min(bins - 1, Math.floor(p.g * bins))]++);
    const maxC = Math.max(...c1, ...c0),
      h = (k) => (k / maxC) * (mid - top - 6);
    size(svg, W, H);
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      svg.append(el("line", { class: "grid", x1: sx(v), x2: sx(v), y1: top, y2: bot }));
      text(svg, sx(v), bot + 16, fmt(v, 2), { class: "tick", "text-anchor": v === 0 ? "start" : v === 1 ? "end" : "middle" });
    });
    svg.append(el("text", { class: "axis-label", x: (L + R) / 2, y: H - 4, "text-anchor": "middle" }, "cross-fitted propensity ĝ(x)"));
    const bw = (R - L) / bins;
    for (let k = 0; k < bins; k++) {
      if (c1[k]) svg.append(el("rect", { x: sx(k / bins) + 1, y: mid - h(c1[k]), width: bw - 2, height: h(c1[k]), fill: "var(--p)", opacity: 0.55 }));
      if (c0[k]) svg.append(el("rect", { x: sx(k / bins) + 1, y: mid, width: bw - 2, height: h(c0[k]), fill: "var(--teal)", opacity: 0.55 }));
    }
    svg.append(el("line", { class: "axis", x1: L, x2: R, y1: mid, y2: mid }));
    text(svg, L - 6, top + 10, "device", { "text-anchor": "end", class: "tick" });
    text(svg, L - 6, bot - 4, "std", { "text-anchor": "end", class: "tick" });
    text(svg, (L + R) / 2, 12, `tallest bin: ${maxC} patients`, { class: "tick", "text-anchor": "middle" });
    if (b > 0)
      [b, 1 - b].forEach((v) =>
        svg.append(el("line", { x1: sx(v), x2: sx(v), y1: top, y2: bot, stroke: "var(--red)", "stroke-width": 1.8, "stroke-dasharray": "5 4" })),
      );
    const e = estFor(b),
      P = e.positivity;
    byId("cap-bound-v").textContent = b.toFixed(3);
    readout(byId("cap-overlap-readout"), [
      ["ĝ range", `${P.gMin.toFixed(3)} to ${P.gMax.toFixed(3)}`],
      ["outside [b, 1 − b]", `${P.outside} of ${n}`],
      ["device ESS", `${Math.round(P.ess1)} of ${n1} (${pc(P.ess1 / n1, 0)})`],
      ["standard-care ESS", `${Math.round(P.ess0)} of ${n0} (${pc(P.ess0 / n0, 0)})`],
      ["largest weight", `${P.maxW1.toFixed(1)} (device), ${P.maxW0.toFixed(1)} (std)`],
      ["AIPW risk difference", `${pts(e.aipw.rd)} points`],
    ]);
    const base = est.aipw.rd;
    byId("cap-overlap-caption").textContent =
      b === C.BOUND
        ? `At the pre-specified b = ${C.BOUND}, ${P.outside === 0 ? "no fitted propensity is outside the bound, so it changes nothing" : P.outside + " patients are bounded"}. The two histograms overlap across the whole range; the device arm thins out at small ĝ, where its largest weights live.`
        : `With b = ${b.toFixed(3)}, ${P.outside} patients have their ĝ pulled to the bound. The AIPW estimate moves from ${pts(base, 2)} to ${pts(e.aipw.rd, 2)} points. Bounding keeps the question (all eligible patients) but adds a little bias where it binds.`;
  }
  function decision() {
    const P = est.positivity,
      trig = P.ess1 < n1 / 2 || P.ess0 < n0 / 2 || P.outside > 0.01 * n;
    byId("cap-decision-result").textContent = `Result: the device arm's ESS is ${Math.round(P.ess1)} of ${n1} (${pc(P.ess1 / n1, 0)}), standard care's is ${Math.round(P.ess0)} of ${n0} (${pc(P.ess0 / n0, 0)}), and ${P.outside} patients fall outside the bound. The trigger is ${trig ? "met, so the trimmed and overlap-weighted analyses are added" : "not met, so the primary analysis stands as planned"}. Deciding this before seeing outcomes is what keeps it from becoming a search for a preferred answer.`;
  }

  /* Super Learner figure: improvement over the overall rate, and weights. */
  function slState() {
    const keep = state.get().keep.split("").map(Number),
      idx = keep.map((k, j) => (k ? j : -1)).filter((j) => j >= 0),
      rw = C.reweigh(D.cvY, rows.map((r) => r.y), idx);
    return { keep, idx, ...rw };
  }
  function drawSL() {
    if (!D) return;
    const svg = byId("cap-sl"),
      S = D.sl.y,
      s = slState(),
      W = widthOf(svg, 900),
      narrow = W < 480,
      rowsN = C.LEARNERS.length + 1,
      rowH = narrow ? 58 : 40,
      H = 34 + rowsN * rowH + 20,
      labelW = narrow ? 0 : 130,
      gap = 24,
      pw = (W - labelW - 24 - gap) / 2 - 44,
      x1 = labelW + 8,
      x2 = x1 + pw + 44 + gap,
      imp = (r) => (100 * (S.baseRisk - r)) / S.baseRisk,
      imps = [...S.cvRisk.map(imp), imp(s.risk)],
      maxImp = Math.max(4, Math.ceil(Math.max(...imps))),
      sxI = (v) => x1 + (Math.max(0, v) / maxImp) * pw,
      sxW = (v) => x2 + v * pw;
    size(svg, W, H);
    text(svg, x1, 18, "CV improvement, %", { class: "fig-text ink" });
    text(svg, x2, 18, "weight", { class: "fig-text ink" });
    const names = [...C.LEARNERS.map((l) => l.short), "Super Learner"];
    names.forEach((nm, j) => {
      const y = 34 + j * rowH + (narrow ? 20 : 0),
        on = j === C.LEARNERS.length || s.keep[j],
        ens = j === C.LEARNERS.length;
      if (narrow) text(svg, x1, y - 4, nm + (on ? "" : " (removed)"), { class: "fig-text ink" });
      else text(svg, labelW, y + 17, nm, { "text-anchor": "end", class: "fig-text ink", opacity: on ? 1 : 0.45 });
      svg.append(
        el("rect", { x: x1, y: y + 4, width: pw, height: 18, fill: "var(--grid)", rx: 3 }),
        el("rect", { x: x1, y: y + 4, width: Math.max(0, sxI(imps[j]) - x1), height: 18, fill: ens ? "var(--purple)" : "var(--muted)", opacity: on ? 0.75 : 0.25, rx: 3 }),
      );
      text(svg, sxI(imps[j]) + 5, y + 17, imps[j].toFixed(2), { class: "fig-text ink", fill: "var(--ink)" });
      if (!ens) {
        svg.append(
          el("rect", { x: x2, y: y + 4, width: pw, height: 18, fill: "var(--grid)", rx: 3 }),
          el("rect", { x: x2, y: y + 4, width: s.weights[j] * pw, height: 18, fill: "var(--purple)", rx: 3, opacity: on ? 1 : 0.2 }),
        );
        text(svg, x2 + s.weights[j] * pw + 5, y + 17, s.weights[j].toFixed(2), { class: "fig-text ink", fill: "var(--ink)" });
      } else {
        text(svg, x2, y + 17, "Σ weights = 1", { class: "fig-text" });
      }
    });
    const bestJ = s.idx.reduce((b, j) => (S.cvRisk[j] < S.cvRisk[b] ? j : b), s.idx[0]);
    readout(byId("cap-sl-readout"), [
      ["overall-rate Brier", S.baseRisk.toFixed(4)],
      ["best single learner", `${C.LEARNERS[bestJ].short}, ${S.cvRisk[bestJ].toFixed(4)}`],
      ["Super Learner", s.risk.toFixed(4)],
      ["learners in the library", String(s.idx.length)],
    ]);
    byId("cap-sl-caption").textContent =
      s.idx.length === 1
        ? `With one learner the ensemble is that learner. Put others back to let the weights mix them.`
        : `The ensemble's CV Brier score is ${s.risk.toFixed(4)}, against ${S.cvRisk[bestJ].toFixed(4)} for the best single learner in the library. Differences look small because most of a yes/no outcome's variance is irreducible; improvements are measured against predicting everyone at the overall rate. Remove a learner to see the others re-weighted.`;
    byId("cap-sl-table").innerHTML = tableHTML(
      ["Learner", "CV Brier score", "Improvement", "Weight"],
      [
        ...C.LEARNERS.map((l, j) => [l.label, S.cvRisk[j].toFixed(4), imps[j].toFixed(2) + "%", s.keep[j] ? s.weights[j].toFixed(3) : "removed"]),
        ["Super Learner (convex combination)", s.risk.toFixed(4), imps[C.LEARNERS.length].toFixed(2) + "%", "1"],
      ],
      "1-year outcome model, whole registry, 5-fold cross-validation",
    );
  }
  const tableHTML = (head, body, caption) =>
    `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${body
      .map((r) => "<tr>" + r.map((v, i) => (i ? `<td>${esc(v)}</td>` : `<th scope="row">${esc(v)}</th>`)).join("") + "</tr>")
      .join("")}</tbody></table></div>`;
  function foldTables() {
    const short = C.LEARNERS.map((l) => l.short),
      tbl = (key, cap) =>
        tableHTML(["Fold", ...short], D.perFold.map((f, k) => [`Fold ${k + 1}`, ...f[key].map((w) => w.toFixed(2))]), cap);
    byId("cap-folds").innerHTML =
      tbl("y", "Outcome ensemble weights, refitted inside each cross-fitting fold") +
      tableHTML(
        ["Model", ...short, "Ensemble"],
        [
          ["Propensity ĝ: CV Brier", ...D.sl.g.cvRisk.map((v) => v.toFixed(4)), D.sl.g.risk.toFixed(4)],
          ["Propensity ĝ: weight", ...D.sl.g.weights.map((v) => v.toFixed(2)), "1"],
          ["Event-free months: CV MSE", ...D.sl.rmst.cvRisk.map((v) => v.toFixed(3)), D.sl.rmst.risk.toFixed(3)],
          ["Event-free months: weight", ...D.sl.rmst.weights.map((v) => v.toFixed(2)), "1"],
        ],
        "Whole-registry ensembles for the propensity and for min(T, 12)",
      );
  }

  /* Forest plot of the risk difference, built row by row by the player. */
  let forestT = 1;
  // Player stages: 0 unadjusted, 1 plug-in, 2 AIPW, 3 TMLE, 4 the truth.
  const forestStage = (t) => Math.min(4, Math.floor(t * 5));
  function drawForest() {
    if (!D) return;
    const svg = byId("cap-forest"),
      W = widthOf(svg, 1100),
      narrow = W < 520,
      labelW = narrow ? 0 : 180,
      rowsSpec = [
        ["Unadjusted", est.unadjusted.rd, est.unadjusted.ci, "var(--or)"],
        ["Plug-in (g-computation)", est.plugin.rd, null, "var(--or)"],
        ["AIPW (one-step)", est.aipw.rd, est.aipw.ci, "var(--purple)"],
        ["TMLE", est.tmle.rd, est.tmle.ci, "var(--purple)"],
      ],
      rowH = narrow ? 58 : 48,
      H = 30 + rowsSpec.length * rowH + 50,
      L = labelW + 14,
      R = W - 16,
      lo = -0.14,
      hi = 0.1,
      sx = (v) => L + ((v - lo) / (hi - lo)) * (R - L),
      stage = forestStage(forestT),
      shown = Math.min(rowsSpec.length, stage + 1),
      showTruth = stage === rowsSpec.length;
    size(svg, W, H);
    const yB = 30 + rowsSpec.length * rowH;
    [-0.1, -0.05, 0, 0.05, 0.1].forEach((v) => {
      svg.append(el("line", { class: "grid", x1: sx(v), x2: sx(v), y1: 20, y2: yB }));
      text(svg, sx(v), yB + 16, minus(fmt(100 * v, 0)), { class: "tick", "text-anchor": "middle" });
    });
    svg.append(el("line", { x1: sx(0), x2: sx(0), y1: 20, y2: yB, stroke: "var(--muted)", "stroke-width": 1.5 }));
    svg.append(el("text", { class: "axis-label", x: (L + R) / 2, y: H - 6, "text-anchor": "middle" }, narrow ? "risk difference (points)" : "risk difference, device minus standard care (percentage points)"));
    rowsSpec.forEach(([nm, v, ci, col], j) => {
      const y = 30 + j * rowH + (narrow ? 36 : 28),
        on = j < shown;
      if (narrow) text(svg, L, y - 16, on ? `${nm}: ${pts(v)}` : nm, { class: "fig-text ink", opacity: on ? 1 : 0.35 });
      else text(svg, labelW, y + 4, nm, { class: "fig-text ink", "text-anchor": "end", opacity: on ? 1 : 0.35 });
      if (!on) return;
      if (ci) svg.append(el("line", { x1: sx(ci[0]), x2: sx(ci[1]), y1: y, y2: y, stroke: col, "stroke-width": 2.5 }));
      svg.append(el("circle", { cx: sx(v), cy: y, r: 6, fill: col }));
      if (!narrow) text(svg, sx(v), y - 11, pts(v), { "text-anchor": "middle", fill: col });
    });
    if (showTruth) {
      svg.append(el("line", { x1: sx(truth.rd), x2: sx(truth.rd), y1: 20, y2: yB, stroke: "var(--green)", "stroke-width": 2, "stroke-dasharray": "6 4" }));
      text(svg, sx(truth.rd) - 4, 14, `truth ${pts(truth.rd)}`, { fill: "var(--green)", "text-anchor": "end" });
    }
    byId("cap-forest-caption").textContent =
      shown < 2
        ? "The unadjusted difference compares the patients who happened to get each strategy."
        : shown < 3
          ? "The plug-in averages the fitted risks under each strategy over everyone: the confounding is gone, but it has no honest standard error."
          : showTruth
            ? `AIPW and TMLE agree (${pts(est.aipw.rd, 2)} and ${pts(est.tmle.rd, 2)} points) and their intervals cover the truth, ${pts(truth.rd)}. The unadjusted comparison points the wrong way.`
            : "AIPW adds the average weighted residual to the plug-in; TMLE moves the fitted risks until that average is zero.";
  }
  function estTables() {
    const A = est.aipw,
      T = est.tmle,
      U = est.unadjusted;
    byId("cap-est-table").innerHTML = tableHTML(
      ["Estimator", "Device risk", "Standard-care risk", "Difference (points)", "SE (points)", "95% CI (points)"],
      [
        ["Unadjusted", pc(U.risk1), pc(U.risk0), pts(U.rd), (100 * U.se).toFixed(2), `${pts(U.ci[0])} to ${pts(U.ci[1])}`],
        ["Plug-in", pc(est.plugin.risk1), pc(est.plugin.risk0), pts(est.plugin.rd), "none", "none"],
        ["AIPW (one-step)", pc(A.risk1), pc(A.risk0), pts(A.rd), (100 * A.se).toFixed(2), `${pts(A.ci[0])} to ${pts(A.ci[1])}`],
        ["TMLE", pc(T.risk1), pc(T.risk0), pts(T.rd), (100 * T.se).toFixed(2), `${pts(T.ci[0])} to ${pts(T.ci[1])}`],
        ["Truth (simulation)", pc(truth.risk1), pc(truth.risk0), pts(truth.rd), "", ""],
      ],
      "1-year risk of death or heart-failure hospitalisation",
    );
    byId("cap-est-explain").textContent = `The one-step correction here is ${pts(A.correction, 2)} points: the plug-in from cross-fitted Super Learner fits was already close, and the correction is what makes its interval honest. TMLE's fluctuation (ε₁ = ${f3(T.eps[0])}, ε₀ = ${f3(T.eps[1])}) moved the fitted risks until the mean influence value in each arm was zero (to ${Math.max(...T.score.map(Math.abs)).toExponential(0)}).`;
    const Rm = est.rmst;
    byId("cap-rmst-table").innerHTML = tableHTML(
      ["Estimator", "Device", "Standard care", "ΔRMST(12), months", "95% CI"],
      [
        ["Unadjusted", "", "", f2(est.unadjusted.drmst), ""],
        ["AIPW (one-step)", Rm.rm1.toFixed(2), Rm.rm0.toFixed(2), f2(Rm.drmst), `${f2(Rm.ci[0])} to ${f2(Rm.ci[1])}`],
        ["Truth (simulation)", "", "", f2(truth.drmst), ""],
      ],
      "Event-free months in the first year (restricted mean survival time at 12 months)",
    );
  }

  /* E-value figure. */
  function evals() {
    const A = est.aipw,
      rrStar = A.rr < 1 ? 1 / A.rr : A.rr,
      lim = A.rr < 1 ? A.rrCI[1] : A.rrCI[0],
      limStar = lim < 1 ? 1 / lim : lim,
      crosses = A.rrCI[0] <= 1 && A.rrCI[1] >= 1;
    return { rrStar, limStar, E: C.eValue(A.rr), Eci: C.eValueCI(A.rrCI[0], A.rrCI[1]), crosses };
  }
  function drawEvalue() {
    if (!D) return;
    const svg = byId("cap-evalue"),
      W = widthOf(svg, 520),
      H = Math.min(W, 460),
      v = evals(),
      maxv = 4,
      p = new CausalAnim.Plot(svg, {
        width: W,
        height: H,
        x: [1, maxv],
        y: [1, maxv],
        xticks: [1, 2, 3, 4],
        yticks: [1, 2, 3, 4],
        margin: { l: 48, r: 14, t: 26, b: 48 },
        xlabel: "RR_EU: confounder with strategy",
        ylabel: "RR_UD: confounder with outcome",
      });
    svg.classList.remove("fig-wide");
    svg.style.maxWidth = W + "px";
    const curve = (B) => {
      const out = [];
      for (let x = B + 1e-3; x <= maxv; x += 0.01) {
        const y = (B * (x - 1)) / (x - B); // solves x·y/(x + y − 1) = B
        if (y >= 1 && y <= maxv) out.push([x, y]);
      }
      return out;
    };
    const cp = curve(v.rrStar);
    p.area([...cp, [maxv, maxv]].filter((q) => q[1] <= maxv), maxv, { fill: "var(--purple)", opacity: 0.08, stroke: "none" });
    p.line(cp, { stroke: "var(--purple)" });
    if (!v.crosses) p.line(curve(v.limStar), { stroke: "var(--purple)", "stroke-dasharray": "5 4" });
    p.line([[1, 1], [maxv, maxv]], { stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "2 4" });
    p.scatter([[v.E, v.E]], 6, { fill: "var(--purple)" });
    p.text(v.E + 0.12, v.E - 0.32, `E = ${v.E.toFixed(2)}`, { fill: "var(--purple)" });
    const bx = Math.min(maxv - 0.05, bench.rrEU),
      by = Math.min(maxv - 0.05, bench.rrUD);
    p.scatter([[bx, by]], 6, { fill: "var(--or)" });
    p.text(bx + 0.12, by + 0.04, "STS-PROM", { fill: "var(--or)" });
    p.text(1.95, maxv - 0.25, "explains it away", {});
    readout(byId("cap-evalue-readout"), [
      ["risk ratio (AIPW)", `${est.aipw.rr.toFixed(2)} (${est.aipw.rrCI[0].toFixed(2)} to ${est.aipw.rrCI[1].toFixed(2)})`],
      ["RR* = 1/RR", v.rrStar.toFixed(2)],
      ["E-value, estimate", v.E.toFixed(2)],
      ["E-value, CI limit", v.Eci.toFixed(2)],
      ["STS-PROM RR_EU, RR_UD", `${bench.rrEU.toFixed(2)}, ${bench.rrUD.toFixed(2)}`],
      ["its bias factor", bench.bias.toFixed(2)],
    ]);
    byId("cap-evalue-caption").textContent = `STS-PROM (top third versus the rest) is ${bench.rrEU.toFixed(2)} times as common among device patients, and in standard care it multiplies the 1-year risk by ${bench.rrUD.toFixed(2)}. Together that is a bias factor of ${bench.bias.toFixed(2)}, ${bench.bias > v.rrStar ? "above" : "below"} RR* = ${v.rrStar.toFixed(2)}: its point lies ${bench.bias > v.rrStar ? "beyond" : "inside"} the solid curve.`;
  }
  function rrLine() {
    const A = est.aipw,
      v = evals();
    byId("cap-rr-line").textContent = `From the AIPW risks, the risk ratio is ${pc(A.risk1)} / ${pc(A.risk0)} = ${A.rr.toFixed(2)}, with 95% CI ${A.rrCI[0].toFixed(2)} to ${A.rrCI[1].toFixed(2)} (delta method on the log scale, from the same influence functions). The E-value is ${v.E.toFixed(2)} for the estimate and ${v.Eci.toFixed(2)} for the confidence limit closest to 1.`;
  }

  /* Step 7: the report paragraph and reviewer questions. */
  function report() {
    const A = est.aipw,
      T = est.tmle,
      Rm = est.rmst,
      P = est.positivity,
      v = evals();
    byId("cap-report").innerHTML = `<p>In an emulation of a target trial among ${n.toLocaleString("en-US")} registry patients eligible for the device (${n1} started the device at eligibility, ${n0} standard care), the estimated 12-month risk of death or heart-failure hospitalisation was ${pc(A.risk1)} under device implantation at eligibility and ${pc(A.risk0)} under standard care, analysed by treatment policy (${crossN} standard-care patients crossed over later). The risk difference was ${pts(A.rd)} percentage points (95% CI ${pts(A.ci[0])} to ${pts(A.ci[1])}), estimated by AIPW with 5-fold cross-fitted Super Learner models for the outcome and the propensity; TMLE gave ${pts(T.rd)} (${pts(T.ci[0])} to ${pts(T.ci[1])}). The risk ratio was ${A.rr.toFixed(2)} (${A.rrCI[0].toFixed(2)} to ${A.rrCI[1].toFixed(2)}). Over the first year, patients gained ${f2(Rm.drmst)} event-free months on average under the device strategy (${f2(Rm.ci[0])} to ${f2(Rm.ci[1])}). The unadjusted comparison, ${pts(est.unadjusted.rd)} points, was confounded by baseline risk. Fitted propensities ranged from ${P.gMin.toFixed(3)} to ${P.gMax.toFixed(3)}; effective sample sizes were ${Math.round(P.ess1)} of ${n1} (device) and ${Math.round(P.ess0)} of ${n0} (standard care), ${P.ess1 < n1 / 2 || P.ess0 < n0 / 2 || P.outside > 0.01 * n ? "which met the pre-specified trigger, so trimmed and overlap-weighted analyses are reported as sensitivity analyses" : "and the pre-specified trigger for additional positivity analyses was not met"}. The E-value was ${v.E.toFixed(2)} for the point estimate and ${v.Eci.toFixed(2)} for the confidence limit; an unmeasured confounder as strongly associated with strategy and outcome as STS-PROM (bias factor ${bench.bias.toFixed(2)}) ${bench.bias > v.rrStar ? "could" : "could not"} explain away the point estimate.</p>`;
    const qa = [
      [
        "Why not a Cox model and a hazard ratio?",
        "The estimand is a risk difference at a fixed horizon, with ΔRMST as a secondary summary. Both are marginal, have units a clinician can use, and are causal contrasts under the stated assumptions. A Cox hazard ratio is conditional on the covariates, averages over time, and its period-specific versions compare survivors who are no longer comparable (see the survival lessons).",
      ],
      [
        "Did flexible learners overfit and shrink the interval?",
        `The ensemble weights were chosen by 5-fold cross-validation, and every patient's m̂₁, m̂₀ and ĝ come from a Super Learner fitted without that patient (cross-fitting). The influence-function SE, ${(100 * A.se).toFixed(2)} points, is then valid when the product of the outcome and propensity errors shrinks faster than 1/√n; the inference lab shows how fitting without cross-fitting undercovers.`,
      ],
      [
        "What about the crossovers?",
        `${crossN} of ${n0} standard-care patients crossed over. The treatment-policy estimand keeps them in standard care, matching the decision at time zero. A hypothetical no-crossover estimand would need censoring at crossover and inverse probability of censoring weights, and it answers a different question; it belongs in a sensitivity analysis, labelled as such.`,
      ],
      [
        "Was positivity adequate?",
        `Fitted propensities ranged from ${P.gMin.toFixed(3)} to ${P.gMax.toFixed(3)}, ${P.outside} patients fell outside the pre-specified bound, and the ESS was ${pc(P.ess1 / n1, 0)} of the device arm and ${pc(P.ess0 / n0, 0)} of standard care. The trigger for trimmed and overlap-weighted analyses was ${P.ess1 < n1 / 2 || P.ess0 < n0 / 2 || P.outside > 0.01 * n ? "met" : "not met"}.`,
      ],
      [
        "Frailty was not measured. How worried should we be?",
        `The E-value is ${v.E.toFixed(2)} (${v.Eci.toFixed(2)} for the confidence limit). A confounder as strong as STS-PROM, the strongest measured one (bias factor ${bench.bias.toFixed(2)}), ${bench.bias > v.rrStar ? "could" : "could not"} explain away the point estimate. The honest summary is that the direction of the effect relies on frailty being weaker than that once the measured covariates are accounted for.`,
      ],
      [
        "Were the time zero and eligibility aligned?",
        "Yes. Both arms start at the first visit at which every eligibility criterion is met, which is also when the strategy is recorded. Deaths while waiting for the implant count against the device strategy, so there is no immortal time.",
      ],
    ];
    byId("cap-qa").innerHTML = qa.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("");
  }

  /* ---------- wiring ---------- */
  let forestPlayer = null;
  function drawAll() {
    drawOne();
    drawT0();
    if (!D) return;
    drawOverlap();
    drawSL();
    drawForest();
    drawEvalue();
  }
  state.subscribe((s) => {
    drawT0();
    if (!D) return;
    drawOverlap();
    drawSL();
  });
  let rt = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(drawAll, 60);
  });
  ["cap-one", "cap-t0", "cap-overlap", "cap-sl", "cap-forest", "cap-evalue"].forEach((id) => ro.observe(byId(id).parentElement));
  drawOne();
  drawT0();
  // Placeholders so no frame is empty while the fitted models load.
  ["cap-overlap", "cap-sl", "cap-forest", "cap-evalue"].forEach((id) => {
    const svg = byId(id);
    svg.setAttribute("viewBox", "0 0 640 80");
    svg.classList.add("fig");
    svg.replaceChildren(el("text", { class: "fig-text", x: 16, y: 44 }, "Loading the cross-fitted Super Learner fits…"));
  });
  fetch("../science/capstone-data.json")
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then((data) => {
      D = data;
      preds = C.predsFromData(D);
      truth = D.truth;
      est = estFor(C.BOUND);
      decision();
      foldTables();
      estTables();
      rrLine();
      report();
      forestPlayer = player(byId("cap-forest-player"), {
        duration: 5000,
        label: "Build",
        onT: (t) => {
          forestT = t;
          drawForest();
        },
        formatValue: (t) => ["unadjusted", "plug-in", "AIPW", "TMLE", "truth"][forestStage(t)],
      });
      forestPlayer.set(0);
      const fig = byId("cap-forest").closest(".figure");
      fig?.addEventListener("causality:finish", () => forestPlayer.set(1));
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) forestPlayer.set(1);
      drawAll();
    })
    .catch((e) => {
      ["cap-overlap", "cap-sl", "cap-forest", "cap-evalue"].forEach((id) =>
        byId(id).replaceChildren(el("text", { class: "fig-text", x: 16, y: 44 }, "Could not load science/capstone-data.json (" + e.message + ")."))
      );
    });

  CausalLab.guided(root, state);
})();
