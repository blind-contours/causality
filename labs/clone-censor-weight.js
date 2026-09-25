/* Clone, censor, weight: lanes of clones, artificial censoring, and IPCW-weighted KM.
 * All numbers come from science/clone-censor-weight.js (CausalCCW). */
(function () {
  const { store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player, ease } = CausalAnim,
    C = CausalCCW,
    root = document.querySelector('[data-lab="clone-censor-weight"]'),
    STEER = [0, 0.35, 0.7, 1.05, 1.4],
    LOOK = 12,
    state = store(
      "clone-censor-weight",
      { step: 0, grace: 3, steer: 0.7, useX: true, seed: C.DEFAULTS.seed },
      { step: [0, 4], grace: [1, 6], steer: [0, 1.4], seed: [1, 4294967295] },
    );
  const byId = (id) => document.getElementById(id),
    snap = (v) =>
      STEER.reduce((b, s) => (Math.abs(s - v) < Math.abs(b - v) ? s : b), 0.7),
    ARM = {
      grace: { color: "var(--p)", name: (G) => `Operate by month ${G}` },
      never: { color: "var(--teal)", name: () => "No procedure" },
    },
    legendLine = (color, dash, label, width = 2.5) =>
      `<span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>${label}</span>`,
    kmLegend = (withWeighted) =>
      `<p class="legend legend-swatches">${legendLine("var(--or)", "", "Clones, unweighted KM")}${withWeighted ? legendLine("var(--purple)", "", "Clones, weighted KM") : ""}${legendLine("var(--green)", "6 4", "Truth: these patients under the strategy")}<span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="14" y1="0" x2="14" y2="10" stroke="var(--or)" stroke-width="1.5"/></svg>Artificial censoring</span></p>`,
    laneLegend = `<p class="legend legend-swatches"><span><svg class="swatch" width="28" height="12" aria-hidden="true"><path d="M14 1 L19 6 L14 11 L9 6 Z" fill="var(--ink)"/></svg>Procedure</span><span><svg class="swatch" width="28" height="12" aria-hidden="true"><path d="M9 1 L19 11 M19 1 L9 11" stroke="var(--red)" stroke-width="2.4"/></svg>Death</span><span><svg class="swatch" width="28" height="12" aria-hidden="true"><text x="14" y="11" text-anchor="middle" font-size="13" fill="var(--ink)">✂</text></svg>Artificially censored</span><span><svg class="swatch" width="28" height="12" aria-hidden="true"><circle cx="14" cy="6" r="4" fill="none" stroke="var(--muted)" stroke-width="1.5"/></svg>Alive at 24 months</span></p>`;

  root.innerHTML = `
<section class="lab-step" data-title="Clone"><h2 tabindex="-1">Copy every patient into both strategies</h2>
<p>The target trial from the last lesson compares two strategies for patients with severe valve disease, both starting at eligibility:</p>
<ul class="ccw-arms"><li><b class="ccw-grace">Operate by month <span class="g-val">3</span></b>: receive the procedure within a grace period of <span class="g-val">3</span> months after eligibility.</li><li><b class="ccw-never">No procedure</b>: do not receive it during the 24 months of follow-up.</li></ul>
<p>At time zero, a patient who is waiting for the procedure is compatible with both strategies. We cannot tell yet which one their data will follow, and we should not guess by peeking at the future. So we give the patient to both arms: one <em>clone</em> per strategy, each with the same frailty, the same history and the same time zero.</p>
<div class="figure"><svg id="lanes-clone" role="img" aria-label="Twelve registry patients, each shown as one dot at eligibility that splits into two clones: one in the Operate lane and one in the No procedure lane."></svg><div id="player-clone"></div><div class="fig-readout" id="readout-clone"></div><p class="fig-caption" id="caption-clone"></p></div>
<p>Every clone starts at eligibility, so no one's follow-up begins late and no survival time is credited before it could be observed. That removes the immortal time from the last lesson. The price comes next: the two clones of one patient cannot both keep following their strategies.</p>
<p class="note">What is simulated: 3000 registry patients followed month by month for 24 months. Frailty X is measured at eligibility; frail patients die sooner and wait longer for the procedure. The figure shows 12 of them, robust at the top of each lane, frail at the bottom. The rule that picks these 12 is fixed in the code, so the same registry always shows the same patients.</p>
</section>

<section class="lab-step" data-title="Censor"><h2 tabindex="-1">Cut a clone the moment its patient deviates</h2>
<p>Follow the clones month by month. A clone stays in its arm while the real patient's history is still compatible with its strategy. When it stops being compatible, the clone is <em>artificially censored</em> (✂):</p>
<ul><li>An <b class="ccw-grace">Operate</b> clone is censored at month <span class="g-val">3</span> if the patient is alive and still waiting.</li><li>A <b class="ccw-never">No procedure</b> clone is censored in the month the patient is operated.</li></ul>
<p>A patient who dies while waiting inside the grace window followed both strategies right up to death. That death counts in <em>both</em> arms. It is not handed to the no-procedure arm alone, which is exactly the mistake that makes naive "ever operated versus never operated" comparisons look so good.</p>
<div class="predict" data-options="Frailer than average|More robust than average|No different: censoring is just missing data" data-answer="0" data-hint="The patients still waiting at the end of the window are the ones the surgeons were hesitant about. In this registry, frailty delays the decision.">Predict: in the Operate lane, the clones cut at the end of the grace window. Are they frailer, more robust, or no different from the whole cohort?</div>
<div class="figure"><div class="fig-controls"><label>Grace period G, months: <span id="grace-out">3</span> <input id="grace" type="range" min="1" max="6" step="1"></label></div><svg id="lanes-censor" role="img" aria-label="Clone timelines by month for both strategy lanes, with procedures, deaths, and artificial censoring marked as scissors."></svg>${laneLegend}<div id="player-censor"></div><div class="fig-readout" id="readout-censor"></div><p class="fig-caption" id="caption-censor"></p></div>
<div id="censor-table"></div>
</section>

<section class="lab-step" data-title="Biased curves"><h2 tabindex="-1">Plain KM on the clones is biased</h2>
<p>Each arm now has 3000 clones, some censored. Run an ordinary Kaplan–Meier in each arm and compare it with the truth. We know the truth because the simulation also ran every patient under each strategy, using the same random draws for their deaths.</p>
<div class="predict" data-options="Operating looks better than it truly is|Operating looks worse than it truly is|Both curves are unbiased, since KM handles censoring" data-answer="0" data-hint="The Operate arm loses its frailest clones at month G; the No procedure arm loses its most robust clones every time someone is operated. Both errors flatter the procedure.">Predict: without weights, which strategy looks better, compared with the truth?</div>
<div class="figure"><div class="fig-controls"><label>How strongly frailty delays the procedure: <span id="steer-out">0.7</span> <input id="steer" type="range" min="0" max="1.4" step="0.35"></label><div class="btns"><button type="button" id="new-registry">Draw another registry</button></div></div><div class="ccw-pair"><svg id="km-a-grace" role="img" aria-label="Operate arm: unweighted KM of the clones against the true survival under the strategy."></svg><svg id="km-a-never" role="img" aria-label="No procedure arm: unweighted KM of the clones against the true survival under the strategy."></svg></div>${kmLegend(false)}<div id="bias-table"></div><p class="fig-caption" id="caption-bias"></p></div>
<p>KM is unbiased when censoring is unrelated to prognosis among those still at risk. Artificial censoring breaks that on purpose: we cut clones <em>because</em> of a treatment decision, and treatment decisions follow prognosis. Set the slider to 0 and the decision no longer depends on frailty; the unweighted curves then land on the truth, apart from sampling noise.</p>
</section>

<section class="lab-step" data-title="Weight"><h2 tabindex="-1">Let the survivors stand in for the clones that were cut</h2>
<p>Model the decision that caused the censoring: the monthly chance of being operated, among patients who are alive and still waiting, given frailty and month.</p>
<p class="math" id="model-line"></p>
<p>Then give each clone still in its arm the inverse of its probability of having remained uncensored so far:</p>
<ul><li><b class="ccw-never">No procedure</b> clone in month k: W = ∏<sub>t=1..k</sub> 1 / (1 − p̂<sub>t</sub>(X)). Robust patients were likely to be operated, so the robust ones who were not carry large weights.</li><li><b class="ccw-grace">Operate</b> clone operated exactly at month G: W = 1 / p̂<sub>G</sub>(X) from month G on; it stands in for similar patients who were still waiting and got cut. Clones operated earlier were never at risk of this censoring and keep W = 1.</li></ul>
<div class="predict" data-options="Close to the unweighted curves|On the truth|Beyond the truth, overcorrected" data-answer="0" data-hint="Without frailty in the model, every waiting patient gets the same probability in a given month. The weights then cannot tell a frail survivor from a robust one. Untick the box and look.">Predict: if the decision model leaves frailty out, where do the weighted curves land?</div>
<div class="figure"><div class="fig-controls"><label class="ccw-check"><input id="use-x" type="checkbox"> Decision model includes frailty</label></div><svg id="lanes-weight" role="img" aria-label="Clone timelines with the clones still at risk in month 12 drawn as dots whose area grows with their weight."></svg><div id="player-weight"></div><div class="ccw-pair"><svg id="km-b-grace" role="img" aria-label="Operate arm: KM with weights growing from 1 to the inverse probability of censoring weights, against unweighted KM and truth."></svg><svg id="km-b-never" role="img" aria-label="No procedure arm: KM with weights growing from 1 to the inverse probability of censoring weights, against unweighted KM and truth."></svg></div>${kmLegend(true)}<div class="fig-readout" id="readout-weight"></div><p class="fig-caption" id="caption-weight"></p></div>
<p class="math">Ŝ(k + 1) = Ŝ(k) · (1 − Σ<sub>deaths in month k</sub> W / Σ<sub>at risk in month k</sub> W)</p>
<p>The weighted risk set in each month looks like the whole cohort would have looked had everyone followed that arm's strategy. The mean frailty in the readout shows it: weighting moves each lane's at-risk frailty toward its value under the strategy. This works if frailty is all that drives the decision and also predicts death (no unmeasured confounding of the decision), if every kind of patient has some chance both of being operated at month G and of staying unoperated (positivity), and if the decision model is right.</p>
</section>

<section class="lab-step" data-title="Read the contrast"><h2 tabindex="-1">What the weighted contrast means</h2>
<p>The weighted curves estimate survival had everyone followed each strategy: a <em>per-protocol</em> effect of sustained strategies, as in a trial with full adherence. Be precise about the Operate strategy: inside the window the usual timing applies, and anyone still waiting at month G is operated then. The weights target exactly that; a different timing rule is a different strategy.</p>
<div class="figure"><svg id="contrast-svg" role="img" aria-label="Weighted survival under each strategy with the area between them shaded, the true curves dashed, and the 24-month landmark marked."></svg><p class="legend legend-swatches">${legendLine("var(--p)", "", "Operate, weighted")}${legendLine("var(--teal)", "", "No procedure, weighted")}${legendLine("var(--green)", "6 4", "Truth")}</p><p class="fig-caption" id="caption-contrast"></p></div>
<div id="contrast-table"></div>
<p>Report the risk at a landmark (here 24 months) and the restricted mean survival time (RMST, the area under the curve up to 24 months), not a hazard ratio. The hazards here are not proportional: the month after the procedure carries operative risk, and the benefit comes later. A single hazard ratio from the clones would average over that shape with weights nobody chose, and it has no clean causal reading.</p>
<h3>Is the weighted estimate right, or just lucky?</h3>
<p>One registry cannot tell. The table below repeats the whole study, simulation, cloning, model fit and weighting, on 200 fresh registries (with frailty in the decision model), and compares the average with the exact population truth.</p>
<div id="mc-table"></div>
<p id="mc-note" class="note"></p>
<p>For a confidence interval in a real analysis, bootstrap <em>patients</em>, not clones: resample patients, re-clone, refit the decision model and recompute the weighted curves in each resample, then take percentiles. Both clones of a patient share one history, and the weights are estimated, so a naive standard error that treats clones as independent and weights as known is wrong.</p>
<p class="note">Exact: the population truth (a forward recursion over each frailty value, integrated over the normal frailty distribution). Simulated: the registry, the "truth for these patients" (the same patients run under each strategy with the same random draws), and the 200-registry check (precomputed with the same code). Schematic: the 12 patients in the lane figures illustrate the rule; the curves use all 3000.</p>
</section>`;

  /* ---------- controls ---------- */
  control(byId("grace"), state, "grace");
  control(byId("steer"), state, "steer");
  control(byId("use-x"), state, "useX");

  /* ---------- cached analysis ---------- */
  let simKey = null,
    sim = null,
    anaKey = null,
    A = null,
    show = null,
    popT = null;
  function data() {
    const s = state.get(),
      steer = snap(s.steer),
      key = [s.seed, s.grace, steer].join("|");
    if (key !== simKey) {
      sim = C.simulate({ seed: s.seed, grace: s.grace, gX: -steer });
      simKey = key;
      anaKey = null;
      popT = {
        grace: C.populationTruth(sim.config, "grace"),
        never: C.populationTruth(sim.config, "never"),
      };
    }
    const k2 = key + "|" + s.useX;
    if (k2 !== anaKey) {
      A = C.analyse(sim.config, { sim, useX: s.useX });
      anaKey = k2;
      const byPatient = {};
      A.clones.forEach((c) => ((byPatient[c.id] ||= {})[c.arm] = c));
      show = C.showcase(sim.patients, s.grace, sim.config.K).map((p) => ({
        p,
        grace: byPatient[p.id].grace,
        never: byPatient[p.id].never,
      }));
    }
    return { A, show, popT, steer, s };
  }

  /* ---------- responsive sizing ---------- */
  const widthOf = (svg) =>
    Math.max(
      300,
      Math.min(900, Math.round(svg.getBoundingClientRect().width || svg.parentElement.clientWidth || 640)),
    );
  const readout = (id, pairs) =>
    byId(id).replaceChildren(
      ...pairs.flatMap(([k, v]) => [
        html("span", { class: "k" }, k),
        html("span", {}, String(v)),
      ]),
    );

  /* ---------- lane figure ---------- */
  function lanes(svg, mode, t) {
    const { A, show } = data(),
      K = A.config.K,
      G = A.config.grace,
      W = widthOf(svg),
      narrow = W < 520,
      rowH = narrow ? 17 : 18,
      n = show.length,
      gl = 46,
      gr = mode === "weight" ? 58 : 14,
      x0 = gl + 8,
      x1 = W - gr - 6,
      sx = (m) => x0 + (m / K) * (x1 - x0),
      top = 22,
      head = 24,
      laneH = head + n * rowH,
      gap = 16,
      lanesY = { grace: top, never: top + laneH + gap },
      rowY = (arm, i) => lanesY[arm] + head + i * rowH + rowH / 2,
      H = top + 2 * laneH + gap + 40;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "fig ccw-lanes");
    svg.replaceChildren();
    const g = (cls) => {
      const e = el("g", { class: cls || "" });
      svg.append(e);
      return e;
    };
    const bg = g(),
      marks = g(),
      fg = g();
    // Grace window band across both lanes (not yet relevant while cloning).
    if (mode !== "clone")
      bg.append(
      el("rect", {
        x: sx(0),
        y: lanesY.grace + head - 4,
        width: sx(G) - sx(0),
        height: lanesY.never + laneH - (lanesY.grace + head) + 4,
        fill: "var(--soft)",
      }),
      el("text", { class: "tick", x: 4, y: 14 }, "frailty"),
    );
    // Time axis.
    const axisY = lanesY.never + laneH + 6;
    bg.append(el("line", { class: "axis", x1: x0, x2: x1, y1: axisY, y2: axisY }));
    for (let m = 0; m <= K; m += 6)
      bg.append(
        el("line", { class: "grid", x1: sx(m), x2: sx(m), y1: lanesY.grace + head - 4, y2: axisY }),
        el("text", { class: "tick", x: sx(m), y: axisY + 15, "text-anchor": "middle" }, m),
      );
    bg.append(
      el("text", { class: "axis-label", x: (x0 + x1) / 2, y: axisY + 32, "text-anchor": "middle" }, "Months since eligibility"),
    );
    if (mode === "weight")
      bg.append(el("text", { class: "tick", x: W - 4, y: 14, "text-anchor": "end" }, `W, month ${LOOK}`));
    else if (mode === "censor")
      bg.append(el("text", { class: "tick", x: x1, y: 14, "text-anchor": "end" }, `shaded: grace window, months 0 to ${G}`));
    // Lane headers and row guides.
    for (const arm of ["grace", "never"]) {
      bg.append(
        el(
          "text",
          { class: "fig-text ccw-lane-name", x: x0 + 16, y: lanesY[arm] + 15, fill: ARM[arm].color },
          ARM[arm].name(G),
        ),
      );
      show.forEach((r, i) => {
        const y = rowY(arm, i);
        bg.append(el("line", { x1: sx(0), x2: sx(K), y1: y, y2: y, stroke: "var(--grid)", "stroke-width": 1 }));
      });
    }
    const cross = (x, y, s = 4.5) =>
      el("path", {
        d: `M${x - s},${y - s} L${x + s},${y + s} M${x + s},${y - s} L${x - s},${y + s}`,
        stroke: "var(--red)",
        "stroke-width": 2.4,
        "stroke-linecap": "round",
      });
    const diamond = (x, y, color) =>
      el("path", {
        d: `M${x},${y - 5} L${x + 5},${y} L${x},${y + 5} L${x - 5},${y} Z`,
        fill: color,
        stroke: "var(--paper)",
        "stroke-width": 1,
      });
    const scissors = (x, y) => [
      el("line", { x1: x, x2: x, y1: y - 7, y2: y + 7, stroke: "var(--ink)", "stroke-width": 1.4 }),
      el("text", { x: x + 3, y: y + 1, "font-size": 17, fill: "var(--ink)", class: "ccw-scissors" }, "✂"),
    ];
    const frailLabel = (x, y, v, opacity = 1) =>
      el("text", { class: "tick", x, y: y + 4, "text-anchor": "end", opacity }, (Math.round(v * 10) > 0 ? "+" : Math.round(v * 10) < 0 ? "−" : "") + Math.abs(v).toFixed(1));

    if (mode === "clone") {
      const u = ease.inOut(t);
      show.forEach((r, i) => {
        const yt = rowY("grace", i),
          yb = rowY("never", i),
          mid = (rowY("grace", 0) + rowY("never", n - 1)) / 2 + (i - (n - 1) / 2) * rowH,
          ya = mid + (yt - mid) * u,
          yb2 = mid + (yb - mid) * u,
          x = sx(0) + 6;
        fg.append(frailLabel(gl, mid, r.p.x, 1 - u));
        fg.append(frailLabel(gl, yt, r.p.x, u), frailLabel(gl, yb, r.p.x, u));
        if (u > 0)
          marks.append(
            el("path", {
              d: `M${x},${ya} L${x},${yb2}`,
              fill: "none",
              stroke: "var(--muted)",
              "stroke-width": 1,
              opacity: 0.35 * Math.min(1, u * 3),
            }),
          );
        marks.append(
          el("circle", { cx: x, cy: mid, r: 5.5, fill: "var(--ink)", opacity: 1 - u }),
          el("circle", { cx: x, cy: ya, r: 5, fill: ARM.grace.color, opacity: Math.min(1, u * 2) }),
          el("circle", { cx: x, cy: yb2, r: 5, fill: ARM.never.color, opacity: Math.min(1, u * 2) }),
        );
      });
      return;
    }
    const clock = mode === "censor" ? t * K : K,
      faded = mode === "weight" ? 0.4 : 1;
    for (const arm of ["grace", "never"])
      show.forEach((r, i) => {
        const c = r[arm],
          y = rowY(arm, i),
          end = Math.min(clock, c.exit),
          grp = el("g", { opacity: faded });
        marks.append(grp);
        fg.append(frailLabel(gl, y, r.p.x));
        grp.append(el("line", { x1: sx(0), x2: sx(end), y1: y, y2: y, stroke: ARM[arm].color, "stroke-width": 2.5, "stroke-linecap": "round" }));
        if (c.surgery !== null && c.surgery <= end && !(c.status === "censored" && c.surgery === c.exit))
          grp.append(diamond(sx(c.surgery), y, "var(--ink)"));
        if (clock >= c.exit) {
          if (c.status === "death") grp.append(cross(sx(c.exit), y));
          else if (c.status === "censored") grp.append(...scissors(sx(c.exit), y));
          else grp.append(el("circle", { cx: sx(K), cy: y, r: 4, fill: "var(--paper)", stroke: "var(--muted)", "stroke-width": 1.5 }));
        } else grp.append(el("circle", { cx: sx(end), cy: y, r: 4.5, fill: ARM[arm].color }));
        if (mode === "weight") {
          const atRisk = c.exit > LOOK,
            w = atRisk ? 1 + t * (c.w[LOOK] - 1) : null;
          if (atRisk) {
            const rad = Math.min(4.5 * Math.sqrt(w), rowH * 2.2);
            marks.append(
              el("circle", {
                cx: sx(LOOK),
                cy: y,
                r: rad,
                fill: "var(--purple)",
                "fill-opacity": 0.28,
                stroke: "var(--purple)",
                "stroke-width": 1.5,
              }),
            );
          }
          fg.append(
            el(
              "text",
              { class: "tick", x: W - 4, y: y + 4, "text-anchor": "end", fill: atRisk ? "var(--purple)" : undefined },
              atRisk ? "×" + (w < 10 ? w.toFixed(2) : w.toFixed(1)) : c.status === "death" ? "died" : "cut",
            ),
          );
        }
      });
    if (mode === "censor")
      fg.append(el("line", { x1: sx(clock), x2: sx(clock), y1: lanesY.grace + head - 4, y2: axisY, stroke: "var(--phat)", "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
    if (mode === "weight") {
      fg.append(el("line", { x1: sx(LOOK), x2: sx(LOOK), y1: lanesY.grace + head - 4, y2: axisY, stroke: "var(--purple)", "stroke-width": 1.2, "stroke-dasharray": "4 3" }));
    }
  }

  /* ---------- KM panels ---------- */
  function kmPanel(svg, arm, u) {
    const { A } = data(),
      K = A.config.K,
      G = A.config.grace,
      W = widthOf(svg),
      plot = new Plot(svg, {
        x: [0, K],
        y: [0, 1],
        width: W,
        height: 250,
        margin: { l: 44, r: 12, t: 30, b: 42 },
        xticks: [0, 6, 12, 18, 24],
        yticks: [0, 0.25, 0.5, 0.75, 1],
        xlabel: "Months since eligibility",
      }),
      pts = (S) => S.map((v, k) => [k, v]);
    svg.classList.remove("fig-wide", "fig-narrow");
    svg.classList.add("ccw-km");
    plot.fg.append(el("text", { class: "fig-text ccw-lane-name", x: plot.m.l, y: 18, fill: ARM[arm].color }, ARM[arm].name(G)));
    const R = A[arm];
    plot.step(pts(R.truth), { stroke: "var(--green)", "stroke-dasharray": "7 5" });
    plot.step(pts(R.unweighted), { stroke: "var(--or)", opacity: u === undefined ? 1 : 0.55 });
    // Artificial censoring ticks on the unweighted curve, one per month with any.
    const cens = new Set(A.arms[arm].filter((c) => c.status === "censored").map((c) => c.exit)),
      ticks = plot.layer();
    cens.forEach((m) =>
      ticks.append(el("line", { x1: plot.sx(m), x2: plot.sx(m), y1: plot.sy(R.unweighted[m]) - 6, y2: plot.sy(R.unweighted[m]) + 6, stroke: "var(--or)", "stroke-width": 1.5 })),
    );
    if (u !== undefined) plot.step(pts(C.blendedKM(A, arm, u)), { stroke: "var(--purple)" });
  }

  /* ---------- contrast figure ---------- */
  function contrast() {
    const { A } = data(),
      K = A.config.K,
      svg = byId("contrast-svg"),
      W = widthOf(svg),
      plot = new Plot(svg, {
        x: [0, K],
        y: [0, 1],
        width: W,
        height: 300,
        margin: { l: 44, r: 118, t: 18, b: 42 },
        xticks: [0, 6, 12, 18, 24],
        yticks: [0, 0.25, 0.5, 0.75, 1],
        xlabel: "Months since eligibility",
        ylabel: "Survival",
      }),
      g = A.grace.weighted,
      nv = A.never.weighted;
    svg.classList.remove("fig-wide", "fig-narrow");
    svg.classList.add("ccw-km");
    // Step-shaped band between the two weighted curves: the RMST difference.
    const stepPts = (S) => S.flatMap((v, k) => (k < K ? [[k, v], [k + 1, v]] : []));
    const band = plot.d(stepPts(g)) + " " + plot.d(stepPts(nv).reverse()).replace(/^M/, "L") + " Z";
    plot.marks.append(el("path", { d: band, fill: "var(--purple)", "fill-opacity": 0.14, stroke: "none" }));
    const pts = (S) => S.map((v, k) => [k, v]);
    plot.step(pts(A.grace.truth), { stroke: "var(--green)", "stroke-dasharray": "7 5" });
    plot.step(pts(A.never.truth), { stroke: "var(--green)", "stroke-dasharray": "7 5" });
    plot.step(pts(g), { stroke: "var(--p)" });
    plot.step(pts(nv), { stroke: "var(--teal)" });
    // Right-margin labels with a minimum vertical separation.
    let ya = plot.sy(g[K]),
      yb = plot.sy(nv[K]);
    if (Math.abs(ya - yb) < 34) {
      const m = (ya + yb) / 2;
      ya = m - 17;
      yb = m + 17;
    }
    const xl = plot.sx(K) + 8;
    const label = (y, color, a, b) => {
      plot.fg.append(el("text", { class: "fig-text", x: xl, y: y, fill: color }, a), el("text", { class: "fig-text", x: xl, y: y + 14, fill: color }, b));
    };
    label(ya - 2, "var(--p)", "Operate", `risk ${fmt(1 - g[K], 3)}`);
    label(yb - 2, "var(--teal)", "No procedure", `risk ${fmt(1 - nv[K], 3)}`);
    if (W >= 520) plot.text(6, 0.1, `Shaded area: ΔRMST = ${fmt(A.grace.rmst.weighted - A.never.rmst.weighted, 2)} months`, { fill: "var(--purple)" });
  }

  /* ---------- players ---------- */
  let tClone = 0,
    tCensor = 0,
    tWeight = 0;
  const pClone = player(byId("player-clone"), {
    duration: 3500,
    label: "Cloning",
    formatValue: (t) => Math.round(t * 100) + "%",
    onT(t) {
      tClone = t;
      drawClone();
    },
  });
  const pCensor = player(byId("player-censor"), {
    duration: 12000,
    label: "Month",
    formatValue: (t) => (t * 24).toFixed(1),
    onT(t) {
      tCensor = t;
      drawCensor();
    },
  });
  const pWeight = player(byId("player-weight"), {
    duration: 5000,
    label: "Weights applied",
    formatValue: (t) => Math.round(t * 100) + "%",
    onT(t) {
      tWeight = t;
      drawWeight();
    },
  });

  function drawClone() {
    const { A, show } = data();
    lanes(byId("lanes-clone"), "clone", tClone);
    readout("readout-clone", [
      ["patients in registry", A.config.n],
      ["clones", A.clones.length],
      ["shown", `${show.length} patients, ${2 * show.length} clones`],
    ]);
    byId("caption-clone").textContent =
      tClone < 1
        ? "Each patient at eligibility (dark dot) becomes two clones with identical data. Press Play or drag the slider."
        : `Done: ${A.config.n} patients became ${A.clones.length} clones, all at month 0, all alive, all compatible with their strategy so far.`;
  }
  function drawCensor() {
    const { A, show } = data(),
      G = A.config.grace,
      m = tCensor * A.config.K;
    lanes(byId("lanes-censor"), "censor", tCensor);
    const shown = (arm, st, upto = m) => show.filter((r) => r[arm].status === st && r[arm].exit <= upto).length;
    readout("readout-censor", [
      ["month", m.toFixed(1)],
      ["Operate lane: cut / died", `${shown("grace", "censored")} / ${shown("grace", "death")}`],
      ["No procedure lane: cut / died", `${shown("never", "censored")} / ${shown("never", "death")}`],
    ]);
    const waitDead = show.filter((r) => r.grace.status === "death" && r.grace.surgery === null && r.grace.exit <= G);
    let cap;
    if (m < G) cap = `Inside the grace window both clones of a waiting patient are still compatible with their strategies. Patients operated now stay in the Operate lane and are cut from the No procedure lane.`;
    else if (m < G + 1) cap = `Month ${G}: the window closes. Every Operate clone whose patient is still waiting is cut (✂). ${waitDead.length ? `The ${waitDead.length === 1 ? "death" : waitDead.length + " deaths"} while waiting inside the window ${waitDead.length === 1 ? "counts" : "count"} in both lanes.` : ""}`;
    else cap = `After month ${G} the Operate lane holds only patients operated in time. The No procedure lane keeps losing clones whenever a patient is operated, even late.`;
    byId("caption-censor").textContent = cap;
  }
  function drawWeight() {
    const { A, show, popT } = data();
    lanes(byId("lanes-weight"), "weight", tWeight);
    kmPanel(byId("km-b-grace"), "grace", tWeight);
    kmPanel(byId("km-b-never"), "never", tWeight);
    const blend = (c, k) => 1 + tWeight * (A.weightAt(c, k) - 1),
      fx = (arm) => C.atRiskFrailty(A.arms[arm], LOOK, blend),
      S = (arm) => C.blendedKM(A, arm, tWeight)[A.config.K];
    const allW = A.clones.filter((c) => c.exit > LOOK).map((c) => c.w[LOOK]);
    readout("readout-weight", [
      ["weights applied", Math.round(tWeight * 100) + "%"],
      [`mean frailty at risk, month ${LOOK}, Operate`, `${fmt(fx("grace"), 2)} (strategy: ${fmt(popT.grace.meanX[LOOK], 2)})`],
      [`mean frailty at risk, month ${LOOK}, No procedure`, `${fmt(fx("never"), 2)} (strategy: ${fmt(popT.never.meanX[LOOK], 2)})`],
      ["24-month risk, Operate", `${fmt(1 - S("grace"), 3)} (truth ${fmt(A.grace.risk.truth, 3)})`],
      ["24-month risk, No procedure", `${fmt(1 - S("never"), 3)} (truth ${fmt(A.never.risk.truth, 3)})`],
      [`largest weight at month ${LOOK}`, fmt(Math.max(...allW), 1)],
    ]);
    const useX = state.get().useX;
    byId("caption-weight").textContent =
      tWeight < 1
        ? "Dots on the month 12 line are clones still at risk; their area grows with their weight. The purple curves are KM with the weights applied so far."
        : useX
          ? "Full weights: the purple curves now sit on the dashed truth, within sampling noise. The lanes are rebalanced: each lane's weighted at-risk frailty is close to its value under the strategy."
          : "Full weights from a model without frailty: the purple curves barely move. Weights can only correct for what the decision model sees.";
  }
  function drawBias() {
    const { A, steer } = data();
    kmPanel(byId("km-a-grace"), "grace");
    kmPanel(byId("km-a-never"), "never");
    const rows = ["grace", "never"].map((arm) => [
      ARM[arm].name(A.config.grace),
      fmt(A[arm].risk.unweighted, 3),
      fmt(A[arm].risk.truth, 3),
      fmt(A[arm].risk.unweighted - A[arm].risk.truth, 3),
    ]);
    const rdU = A.grace.risk.unweighted - A.never.risk.unweighted,
      rdT = A.grace.risk.truth - A.never.risk.truth;
    rows.push(["Risk difference (Operate − None)", fmt(rdU, 3), fmt(rdT, 3), fmt(rdU - rdT, 3)]);
    byId("bias-table").innerHTML = table(["24-month risk", "Unweighted clones", "Truth, these patients", "Error"], rows, "Risk of death by 24 months");
    byId("caption-bias").textContent =
      steer === 0
        ? "Frailty no longer drives the decision, so artificial censoring is unrelated to prognosis and the orange curves track the truth."
        : `The orange Operate curve sits above its truth and the orange No procedure curve sits below its truth. The unweighted risk difference is ${fmt(rdU, 3)}; the truth is ${fmt(rdT, 3)}.`;
  }
  function drawCensorTable() {
    const { A } = data(),
      G = A.config.grace,
      P = A.sim.patients,
      mean = (v) => v.reduce((a, b) => a + b, 0) / v.length,
      cutG = A.arms.grace.filter((c) => c.status === "censored"),
      cutN = A.arms.never.filter((c) => c.status === "censored"),
      both = A.arms.grace.filter((c) => c.status === "death" && c.exit <= G && c.surgery === null);
    byId("censor-table").innerHTML = table(
      ["Group (all 3000 patients)", "Clones", "Mean frailty"],
      [
        ["Whole cohort", P.length, fmt(mean(P.map((p) => p.x)), 2)],
        [`Operate clones cut at month ${G} (still waiting)`, cutG.length, fmt(mean(cutG.map((c) => c.x)), 2)],
        ["No procedure clones cut at the procedure", cutN.length, fmt(mean(cutN.map((c) => c.x)), 2)],
        [`Deaths while waiting in the window (count in both arms)`, both.length, fmt(mean(both.map((c) => c.x)), 2)],
      ],
      "Who gets artificially censored",
    );
  }
  function drawContrast() {
    const { A, popT, steer, s } = data(),
      K = A.config.K;
    contrast();
    const pr = (arm) => 1 - popT[arm].S[K],
      pm = (arm) => C.rmst(popT[arm].S),
      col = (fn) => [fn("unweighted"), fn("weighted"), fn("truth")];
    const risk = (arm) => col((k) => fmt(A[arm].risk[k], 3)),
      rm = (arm) => col((k) => fmt(A[arm].rmst[k], 2)),
      rd = col((k) => fmt(A.grace.risk[k] - A.never.risk[k], 3)),
      dr = col((k) => fmt(A.grace.rmst[k] - A.never.rmst[k], 2));
    byId("contrast-table").innerHTML = table(
      ["Through 24 months", "Unweighted", "Weighted", "Truth, these patients", "Truth, population"],
      [
        ["Risk, Operate", ...risk("grace"), fmt(pr("grace"), 3)],
        ["Risk, No procedure", ...risk("never"), fmt(pr("never"), 3)],
        ["Risk difference", ...rd, fmt(pr("grace") - pr("never"), 3)],
        ["RMST, Operate (months)", ...rm("grace"), fmt(pm("grace"), 2)],
        ["RMST, No procedure (months)", ...rm("never"), fmt(pm("never"), 2)],
        ["RMST difference (months)", ...dr, fmt(pm("grace") - pm("never"), 2)],
      ],
      "Estimates from this registry",
    );
    byId("caption-contrast").textContent = `Weighted estimate: operating by month ${A.config.grace} changes the 24-month risk of death by ${fmt(A.grace.risk.weighted - A.never.risk.weighted, 3)} and adds ${fmt(A.grace.rmst.weighted - A.never.rmst.weighted, 2)} months of life on average over 24 months (the shaded area).`;
    const mc = C.MC && C.MC[`${s.grace}|${steer}`];
    if (!mc) {
      byId("mc-table").innerHTML = "";
      byId("mc-note").textContent = "The 200-registry check is precomputed for every grace period with the default frailty effect (0.7), and for every frailty effect with a 3-month grace period. Move one slider back to see it.";
      return;
    }
    const [tRD, tRM, uRD, uRDsd, wRD, wRDsd, uRM, uRMsd, wRM, wRMsd] = mc,
      R = C.MC_R,
      se = (sd) => sd / Math.sqrt(R);
    byId("mc-table").innerHTML = table(
      ["Across 200 registries", "Population truth", "Unweighted mean (SD)", "Weighted mean (SD)", "Weighted bias ± 2 MC SE"],
      [
        ["Risk difference", fmt(tRD, 3), `${fmt(uRD, 3)} (${fmt(uRDsd, 3)})`, `${fmt(wRD, 3)} (${fmt(wRDsd, 3)})`, `${fmt(wRD - tRD, 3)} ± ${fmt(2 * se(wRDsd), 3)}`],
        ["RMST difference, months", fmt(tRM, 2), `${fmt(uRM, 2)} (${fmt(uRMsd, 2)})`, `${fmt(wRM, 2)} (${fmt(wRMsd, 2)})`, `${fmt(wRM - tRM, 2)} ± ${fmt(2 * se(wRMsd), 2)}`],
      ],
      `Grace period ${s.grace} months, frailty effect on the decision ${steer}`,
    );
    const ok = Math.abs(wRD - tRD) <= 2 * se(wRDsd) && Math.abs(wRM - tRM) <= 2 * se(wRMsd);
    byId("mc-note").textContent =
      (ok
        ? "The weighted average lies within two Monte Carlo standard errors of the truth for both measures: no detectable bias. "
        : "The weighted average is outside two Monte Carlo standard errors of the truth here. When frailty steers the decision strongly, robust patients almost never stay unoperated and frail ones are almost never operated by month G, so a few clones carry enormous weights (positivity is nearly violated). Weighting then leaves a small finite-sample bias, though far less than no weighting. ") +
      `The unweighted estimator misses by ${fmt(uRD - tRD, 3)} in risk difference, far beyond its own spread. Note the price of weighting: its SD is larger. ${state.get().useX ? "" : "This check always uses the frailty model, whatever the checkbox says."}`;
  }

  function render() {
    const s = state.get();
    byId("grace-out").textContent = s.grace;
    byId("steer-out").textContent = snap(s.steer);
    document.querySelectorAll(".g-val").forEach((e) => (e.textContent = s.grace));
    const { A } = data();
    const f = A.fit;
    byId("model-line").textContent = `logit p̂ₜ(X) = ${fmt(f.g0, 2)} ${f.gX < 0 ? "−" : "+"} ${fmt(Math.abs(f.gX), 2)}·X ${f.gT < 0 ? "−" : "+"} ${fmt(Math.abs(f.gT), 3)}·(t − 1)   fitted on ${f.rows} waiting patient-months with ${f.events} procedures${s.useX ? "" : " (frailty left out)"}`;
    drawClone();
    drawCensor();
    drawCensorTable();
    drawBias();
    drawWeight();
    drawContrast();
  }
  render();
  let raf = 0,
    lastW = root.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(root.clientWidth - lastW) < 2) return;
    lastW = root.clientWidth;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(render);
  }).observe(root);
  guided(root, state);
  // Subscribe after guided() so a step change has already unhidden its panel when figures measure it.
  state.subscribe(render);
  tools(root, state);
  byId("new-registry").onclick = () => state.set({ seed: (state.get().seed + 1) >>> 0 });
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail?.name !== "clone-censor-weight") return;
    pClone.set(0);
    pCensor.set(0);
    pWeight.set(0);
  });
})();
