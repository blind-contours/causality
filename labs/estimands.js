/* Linked question-building scenes, mounted inside the causal-roadmap laboratory. */
(function () {
  const E = CausalEstimands;
  const options = `<option value="ate">Everyone (ATE population)</option><option value="att">Treated people (ATT population)</option><option value="atc">Untreated people (ATC population)</option>`;
  const populationHTML = `
<section class="lab-step" id="step-1" data-title="Whose effect?">
  <h2 tabindex="-1">The same treatment, a different question</h2>
  <p>An <strong>estimand</strong> is the precise quantity your question asks for. Start with a synthetic cohort: severity is measured before treatment, and the numerical outcome is measured at one year. Larger outcomes are better.</p><p class="note">The first three scenes define quantities in known teaching worlds. Later, break an assumption to see what observed data can and cannot identify.</p>
  <div class="predict" data-options="The average stays the same|The average must change" data-answer="0" data-hint="If every person has the same benefit, changing whose effects you average cannot change that benefit. Try Equal benefits below.">Predict: if treatment benefits everyone by exactly the same amount, will changing the target population change the average effect?</div>
  <div class="estimand-workbench"><div>
    <label>Whose effect? <select id="target" data-est-key="target">${options}</select></label>
  <div class="estimand-figure" id="estimand-population-figure">
    <div class="estimand-key"><span><i class="low"></i>Low severity</span><span><i class="high"></i>High severity</span></div>
    <div id="estimand-weights" aria-label="Severity composition of each target population"></div>
    <svg id="estimand-effect-plot" viewBox="0 0 560 300" role="img" aria-label="Group benefits stay at their positions. Circle and square areas encode the selected population weights; the diamond is their weighted average. Exact values follow."></svg>
    <p id="estimand-population-caption" class="fig-caption"></p>
  </div>
  </div><div class="estimand-panel">
  <div class="estimand-controls">
    <label>High-severity share of everyone <output data-est-output="p"></output><input id="population" data-est-key="p" type="range" min=".05" max=".9" step=".01"></label>
    <label>Benefit in low severity <output data-est-output="effectLow"></output><input id="effect-low" data-est-key="effectLow" type="range" min="0" max="5" step=".01"></label>
    <label>Benefit in high severity <output data-est-output="effectHigh"></output><input id="effect-high" data-est-key="effectHigh" type="range" min="0" max="5" step=".01"></label>
  </div>
  <div class="btns"><button id="estimand-example">Try ATE 1.8 vs ATT 3.4</button><button id="estimand-equal">Equal benefits</button><button id="estimand-reference">Reference cohort</button></div>
  <details><summary>Who receives treatment in this cohort?</summary><p>These are the actual treatment probabilities. They determine who belongs to the treated and untreated populations; selecting a target keeps that membership fixed in both intervention worlds.</p><div class="estimand-controls">
    <label>Treatment probability, low severity <output data-est-output="gLow"></output><input id="g-low" data-est-key="gLow" type="range" min=".05" max=".95" step=".01"></label>
    <label>Treatment probability, high severity <output data-est-output="gHigh"></output><input id="g-high-population" data-est-key="gHigh" type="range" min="0" max="1" step=".01"></label>
  </div></details>
  </div></div>
  <div id="estimand-population-table"></div>
  <details class="formula-details"><summary>Give the weights their mathematical names</summary><p class="math" id="target-formula"></p><p class="math">ATE: w(x) = P(X=x)<br>ATT: w(x) = P(X=x | A=1)<br>ATC: w(x) = P(X=x | A=0)<br>Here: effect = Σₓ w(x) · E[Y(1) − Y(0) | X=x]</p><p>Here the within-severity benefit is the same for treated and untreated people by construction. That is why the three targets can average the same subgroup effects with different weights. In general, this needs an assumption about effects within severity groups.</p><p>Low- and high-severity effects are subgroup averages, often called conditional average treatment effects. They do not identify an individual person's benefit. We know the full synthetic world here; in observed data, each person reveals only Y(0) or Y(1).</p></details>
  <div class="estimand-summary"><div class="eyebrow">Your mean-difference question</div><p id="estimand-mean-question"></p><p id="estimand-mean-value" class="estimand-value"></p><button id="save-contract" data-save-estimand="mean">Save this question across lessons</button></div>
  <p id="contract-status" role="status"></p><button id="estimand-restore">Restore my saved question</button>
</section>`;
  const outcomesHTML = `
<section class="lab-step" id="estimand-risk" data-title="Absolute or relative?">
  <h2 tabindex="-1">The same risks, two ways to compare them</h2>
  <p>Keep the baseline groups and change the outcome: an adverse event within <strong>one year</strong>. Each grid represents 100 people from the same selected population under a different intervention. Lower event risk is better.</p>
  <div class="predict" data-options="Both have RR 0.5, but different risk differences|Both have a risk difference of −10 percentage points|The risk ratio must be smaller for 20% → 10%" data-answer="0" data-hint="Halving 20% removes 10 events per 100; halving 2% removes 1 per 100. Try the two presets.">Predict: compare risks of 20% → 10% and 2% → 1%. What stays the same?</div>
  <div class="estimand-controls">
    <label>Target population <select id="risk-population" data-est-key="target">${options}</select></label>
    <label>How should we compare? <select id="risk-contrast" data-est-key="riskContrast"><option value="rd">Risk difference: treatment − control</option><option value="rr">Risk ratio: treatment ÷ control</option></select></label>
    <label>Control risk, low severity <output data-est-output="riskLow"></output><input id="risk-low" data-est-key="riskLow" type="range" min="0" max=".5" step=".01"></label>
    <label>Control risk, high severity <output data-est-output="riskHigh"></output><input id="risk-high" data-est-key="riskHigh" type="range" min="0" max=".5" step=".01"></label>
    <label>Treatment risk multiplier, in each group <output data-est-output="riskMultiplier"></output><input id="risk-multiplier" data-est-key="riskMultiplier" type="range" min="0" max="2" step=".05"></label>
  </div>
  <div class="btns"><button id="risk-common">20% → 10%</button><button id="risk-rare">2% → 1%</button></div>
  <div class="estimand-pair estimand-figure" id="estimand-risk-figure">
    <div class="estimand-risk-card"><h3>Under control</h3><strong id="risk-control-value"></strong><svg id="risk-control-grid" viewBox="0 0 220 220" role="img" aria-label="Expected adverse events per 100 under control; exact count above."></svg></div>
    <div class="estimand-risk-card"><h3>Under treatment</h3><strong id="risk-treatment-value"></strong><svg id="risk-treatment-grid" viewBox="0 0 220 220" role="img" aria-label="Expected adverse events per 100 under treatment; exact count above."></svg></div>
  </div>
  <p class="note">Filled area = expected events; an outlined square = the remaining share. Each square is 1 person per 100, and a partial square is a fractional expected count. Positions do not pair identifiable people across worlds.</p>
  <div class="estimand-summary"><div class="eyebrow">Your one-year event question</div><p id="estimand-risk-question"></p><p id="estimand-risk-value" class="estimand-value"></p><p id="estimand-risk-caption"></p><button id="save-risk-contract" data-save-estimand="risk">Save this question across lessons</button></div>
  <p id="risk-contract-status" role="status"></p><div id="estimand-risk-table"></div>
  <details class="formula-details"><summary>Reveal the two contrasts</summary><p class="math">rₐ = Pr(Y(a)=1) in the selected population<br>Risk difference = r₁ − r₀<br>Risk ratio = r₁ / r₀, when r₀ &gt; 0</p><p>For ATT or ATC, both risks refer to the same actually treated or actually untreated people. A population and a contrast are choices you combine. The risk ratio is undefined when the control risk is zero.</p></details>
</section>
<section class="lab-step" id="estimand-survival" data-title="A gap or an area?">
  <h2 tabindex="-1">Surviving to a date, or accumulating time alive?</h2>
  <p>Now the outcome is time until death. Use the same target population for both survival curves. Drag the time marker, move the horizon slider, or play time forward.</p>
  <div class="predict" data-options="The area between the curves from year 2 to year 5|Only the vertical gap at year 5|The hazard ratio multiplied by 3" data-answer="0" data-hint="RMST adds time alive throughout the window. Extending the horizon adds the signed area over the new interval.">Predict: when the horizon moves from two to five years, what gets added to the RMST difference?</div>
  <div class="estimand-workbench"><div>
  <div class="estimand-figure" id="estimand-survival-figure">
    <div class="estimand-key"><span><i class="control"></i>Control · dashed curve</span><span><i class="treatment"></i>Treatment · solid curve</span></div>
    <svg id="estimand-survival-plot" role="img" aria-label="Two survival curves. In probability mode the marker measures the vertical gap; in RMST mode the signed area between the curves is shaded up to the horizon. Use the labelled horizon slider for keyboard control."></svg>
    <div id="estimand-time-player"></div>
  </div>
  </div><div class="estimand-panel">
  <div class="estimand-controls">
    <label>Target population <select id="survival-population" data-est-key="target">${options}</select></label>
    <label>What matters to the decision? <select id="estimand-survival-contrast" data-est-key="survivalContrast"><option value="survival">Survival at the horizon</option><option value="rmst">Time alive within horizon (RMST)</option></select></label>
    <label>Horizon, years <output data-est-output="tau"></output><input id="estimand-horizon" data-est-key="tau" type="range" min="0" max="10" step=".1"></label>
    <label>When the treatment effect begins, years <output data-est-output="delay"></output><input id="estimand-delay" data-est-key="delay" type="range" min="0" max="3" step=".5"></label>
    <label>Treated hazard ÷ control hazard after that time <output data-est-output="hazardRatio"></output><input id="estimand-hazard-ratio" data-est-key="hazardRatio" type="range" min=".4" max="1.6" step=".05"></label>
  </div>
  </div></div>
  <div class="estimand-summary"><div class="eyebrow">Your survival question</div><p id="estimand-survival-question"></p><p id="estimand-survival-value" class="estimand-value"></p><p id="estimand-survival-caption"></p><button id="save-survival-contract" data-save-estimand="survival">Save this question across lessons</button></div>
  <p id="survival-contract-status" role="status"></p><div id="estimand-survival-table"></div>
  <details class="formula-details"><summary>Reveal the gap and the area</summary><p class="math">Survival difference = S₁(τ) − S₀(τ)<br>RMST difference = ∫₀^τ [S₁(t) − S₀(t)] dt</p><p>The first has probability units; the second has time units. These are different summaries of the same two survival distributions. The synthetic baseline hazards are 0.08/year in low severity and 0.32/year in high severity. The slider multiplies each stratum's hazard after the selected delay; it is not generally the population hazard ratio.</p><p>No censoring or estimation is involved in this picture. The <a href="12-survival-lab.html">survival laboratory</a> later asks how to estimate these curves from incomplete observations.</p></details>
  <p class="estimand-note">The time horizon is part of the question. Explore it here, then choose it for scientific reasons before inspecting a real study's treatment results.</p>
</section>`;

  function mount(root, state) {
    const { control, table, fmt } = CausalLab, { el, tween, lerp, Plot, player } = CausalAnim;
    const byId = id => document.getElementById(id);
    root.querySelectorAll("[data-est-key]").forEach(e => control(e, state, e.dataset.estKey));
    const names = { ate: "everyone in the cohort", att: "people who actually received treatment", atc: "people who actually received control" };
    const keys = Object.keys(E.DEFAULTS);
    const pct = v => fmt(v * 100, 1) + "%";
    const signed = (v, digits = 2) => (v > 0 ? "+" : "") + fmt(v, digits);
    const sentences = (c) => ({
      mean: `Among ${names[c.target]}, how much would the average one-year numerical outcome change under treatment versus control?`,
      risk: `Among ${names[c.target]}, what is the one-year adverse-event risk ${c.riskContrast === "rd" ? "difference (treatment minus control)" : "ratio (treatment divided by control)"}?`,
      survival: `Among ${names[c.target]}, ${c.survivalContrast === "rmst" ? `how much additional time alive would treatment provide on average within ${fmt(c.tau, 1)} years` : `how much would treatment change the chance of being alive at ${fmt(c.tau, 1)} years`}?`,
    });
    const snapshot = c => Object.fromEntries(keys.map(k => [k, c[k]]));
    const save = kind => {
      const c = state.get(), measure = kind === "risk" ? c.riskContrast : kind === "survival" ? c.survivalContrast : "mean";
      Causality.event({ type: "contract", value: {
        target: c.target, population: c.p, measure, horizon: kind === "survival" ? c.tau : 1,
        scenario: snapshot(c),
      } });
      saved(kind, "Question saved. Open Your estimand contract in any lesson to revisit it.");
    };
    const statusIds = { mean: "contract-status", risk: "risk-contract-status", survival: "survival-contract-status" };
    function saved(kind, message) { byId(statusIds[kind]).textContent = message; }
    root.querySelectorAll("[data-save-estimand]").forEach(b => b.onclick = () => save(b.dataset.saveEstimand));
    byId("estimand-restore").onclick = () => {
      const c = Causality.state().contract, measure = c.measure || "mean";
      state.set({
        ...E.DEFAULTS, ...(c.scenario || {}), target: c.target, p: c.population,
        ...(measure === "rd" || measure === "rr" ? { riskContrast: measure, step: 1 } :
          measure === "survival" || measure === "rmst" ? { survivalContrast: measure, tau: c.horizon, step: 2 } : { step: 0 }),
      });
      root.querySelectorAll(".lab-step")[state.get().step].scrollIntoView({ block: "start" });
      saved(measure === "mean" ? "mean" : measure === "rd" || measure === "rr" ? "risk" : "survival", "Your saved population, outcome, contrast, and example settings are restored.");
    };
    byId("estimand-example").onclick = () => state.set({ p: .2, gLow: .1, gHigh: .6, effectLow: 1, effectHigh: 5, target: "ate" });
    byId("estimand-equal").onclick = () => state.set({ effectHigh: state.get().effectLow });
    byId("estimand-reference").onclick = () => state.set(Object.fromEntries(["p", "target", "gLow", "gHigh", "effectLow", "effectHigh"].map(k => [k, E.DEFAULTS[k]])));
    byId("risk-common").onclick = () => state.set({ riskLow: .2, riskHigh: .2, riskMultiplier: .5 });
    byId("risk-rare").onclick = () => state.set({ riskLow: .02, riskHigh: .02, riskMultiplier: .5 });

    // A single mathematical state drives the weight bars and effect markers.
    const weightRows = ["ate", "att", "atc"].map(id => {
      const row = document.createElement("div");
      row.className = "estimand-weight-row";
      row.innerHTML = `<span>${id.toUpperCase()} mix</span><div class="estimand-weight-track" aria-hidden="true"><i></i><i></i></div><span></span>`;
      byId("estimand-weights").append(row);
      return { id, row, parts: row.querySelectorAll("i"), value: row.lastElementChild };
    });
    const effectSvg = byId("estimand-effect-plot"), sx = v => 140 + v * 76;
    const labels = [["Low severity", 78], ["High severity", 158], ["Average", 243]];
    labels.forEach(([name, y]) => {
      effectSvg.append(el("text", { x: 18, y: y + 5 }, name), el("line", { class: "est-axis", x1: sx(0), x2: sx(5), y1: y, y2: y }));
    });
    for (let v = 0; v <= 5; v++) effectSvg.append(el("text", { x: sx(v), y: 273, "text-anchor": "middle", class: "est-small" }, v));
    effectSvg.append(el("text", { x: 330, y: 294, "text-anchor": "middle", class: "est-small" }, "Benefit in outcome units"));
    const low = el("circle", { cy: 78, fill: "var(--teal)", "fill-opacity": .65, stroke: "var(--teal)", "stroke-width": 2 }),
      high = el("rect", { fill: "var(--purple)", "fill-opacity": .65, stroke: "var(--purple)", "stroke-width": 2 }),
      average = el("path", { fill: "var(--ink)" });
    effectSvg.append(low, high, average);
    function placeEffects(v) {
      // Circle and square areas are proportional to their weights on a common scale.
      const r = Math.sqrt(1600 * v.w0 / Math.PI), side = Math.sqrt(1600 * v.w1);
      low.setAttribute("cx", sx(v.low)); low.setAttribute("r", r);
      high.setAttribute("x", sx(v.high) - side / 2); high.setAttribute("y", 158 - side / 2);
      high.setAttribute("width", side); high.setAttribute("height", side);
      const x = sx(v.avg);
      average.setAttribute("d", `M${x} 233l10 10-10 10-10-10Z`);
      weightRows.forEach((r, i) => {
        r.parts[0].style.width = (1 - v["p" + i]) * 100 + "%";
        r.parts[1].style.width = v["p" + i] * 100 + "%";
      });
    }
    // Grids encode expected counts, not an invented pairing of potential outcomes.
    function riskGrid(id, colour) {
      const svg = byId(id), cells = [];
      for (let i = 0; i < 100; i++) {
        const x = 12 + (i % 10) * 20, y = 12 + Math.floor(i / 10) * 20;
        svg.append(el("rect", { x, y, width: 16, height: 16, fill: "var(--paper)", stroke: "var(--muted)", "stroke-width": .8 }));
        const fill = el("rect", { x, y, width: 0, height: 16, fill: colour });
        cells.push(fill); svg.append(fill);
      }
      return risk => cells.forEach((cell, i) => cell.setAttribute("width", 16 * Math.max(0, Math.min(1, risk * 100 - i))));
    }
    const grid0 = riskGrid("risk-control-grid", "var(--or)"), grid1 = riskGrid("risk-treatment-grid", "var(--p)");
    let previous = null, animation = null;
    function animate(next) {
      animation?.cancel();
      const from = previous || next;
      animation = tween({ duration: 420, onUpdate(u) {
        const frame = Object.fromEntries(Object.keys(next).map(k => [k, lerp(from[k], next[k], u)]));
        placeEffects(frame); grid0(frame.r0); grid1(frame.r1); previous = frame;
      } });
    }

    const sv = byId("estimand-survival-plot"), P = new Plot(sv, {
      x: [0, 10], y: [0, 1], width: 520, height: 300,
      margin: { l: 46, r: 24, t: 28, b: 46 }, xticks: [0, 5, 10], yticks: [0, .5, 1],
      xlabel: "Years since baseline", ylabel: "Survival probability",
    });
    const shaded = P.line([[0, 1]], { stroke: "none", "fill-opacity": .23 }),
      curve0 = P.line([[0, 1]], { stroke: "var(--or)", "stroke-dasharray": "7 5" }),
      curve1 = P.line([[0, 1]], { stroke: "var(--p)" }),
      marker = P.vline(5, { stroke: "var(--muted)" }),
      gap = el("line", { stroke: "var(--purple)", "stroke-width": 5 }),
      dots = [0, 1].map(a => el("circle", { r: 5, fill: a ? "var(--p)" : "var(--or)", stroke: "var(--paper)", "stroke-width": 2 }));
    P.marks.append(gap, ...dots);
    let syncing = false;
    const clock = player(byId("estimand-time-player"), { duration: 10000, autoplay: false, label: "Horizon", formatValue: t => fmt(t * 10, 1) + " years", onT(t) {
      const tau = Math.round(t * 100) / 10;
      if (!syncing && tau !== state.get().tau) state.set({ tau });
    } });
    function syncClock(c) {
      if (Math.abs(clock.t * 10 - c.tau) > .051) {
        syncing = true; clock.set(c.tau / 10); syncing = false;
      }
    }
    let dragging = false;
    const dragTime = e => {
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(sv.getScreenCTM().inverse()),
        tau = Math.max(0, Math.min(10, (point.x - P.sx(0)) / (P.sx(10) - P.sx(0)) * 10));
      clock.pause(); state.set({ tau: Math.round(tau * 10) / 10 });
    };
    sv.addEventListener("pointerdown", e => { dragging = true; sv.setPointerCapture(e.pointerId); dragTime(e); });
    sv.addEventListener("pointermove", e => { if (dragging) dragTime(e); });
    sv.addEventListener("pointerup", () => { dragging = false; });
    sv.addEventListener("pointercancel", () => { dragging = false; });
    root.querySelectorAll("[data-est-key]").forEach(e => e.addEventListener("input", () => clock.pause()));
    window.addEventListener("causality:lab-reset", e => { if (e.detail.name === "roadmap") { clock.pause(); syncClock(state.get()); } });

    function render() {
      const c = state.get(), m = E.means(c), r = E.risks(c), s = E.survival(c), q = sentences(c);
      root.querySelectorAll("[data-est-output]").forEach(e => {
        const k = e.dataset.estOutput;
        e.textContent = ["p", "gLow", "gHigh", "riskLow", "riskHigh"].includes(k) ? pct(c[k]) : fmt(c[k], 2);
      });
      const weights = [m.all, m.treated, m.untreated];
      weightRows.forEach((row, i) => {
        row.value.textContent = pct(weights[i][1]) + " high";
        row.row.setAttribute("aria-current", String(c.target === row.id));
        row.row.setAttribute("aria-label", `${row.id.toUpperCase()}: ${pct(weights[i][0])} low severity, ${pct(weights[i][1])} high severity`);
      });
      animate({ low: c.effectLow, high: c.effectHigh, avg: m.target, w0: m.weights[0], w1: m.weights[1], p0: m.all[1], p1: m.treated[1], p2: m.untreated[1], r0: r.r0, r1: r.r1 });
      byId("estimand-population-caption").textContent = `${c.target.toUpperCase()}: ${pct(m.weights[0])} low severity × ${fmt(c.effectLow)} + ${pct(m.weights[1])} high severity × ${fmt(c.effectHigh)} = ${fmt(m.target)} units. Circle and square area show the weights. Changing the selected population moves the average while keeping the two group benefits fixed.`;
      byId("estimand-population-table").innerHTML = table(["Average effect", "Low-severity weight", "High-severity weight", "Benefit (units)"], ["ate", "att", "atc"].map((id, i) => [id.toUpperCase(), pct(weights[i][0]), pct(weights[i][1]), fmt(m.effects[id])]), "One cohort, three target populations");
      byId("target-formula").textContent = c.target === "ate" ? "E[Y(1) − Y(0)]" : `E[Y(1) − Y(0) | A=${c.target === "att" ? 1 : 0}]`;
      byId("estimand-mean-question").textContent = q.mean;
      byId("estimand-mean-value").textContent = signed(m.target) + " outcome units";
      byId("risk-control-value").textContent = fmt(r.r0 * 100, 1) + " events per 100";
      byId("risk-treatment-value").textContent = fmt(r.r1 * 100, 1) + " events per 100";
      byId("estimand-risk-question").textContent = q.risk;
      byId("estimand-risk-value").textContent = c.riskContrast === "rd" ? signed(r.rd * 100, 1) + " percentage points" : Number.isFinite(r.rr) ? fmt(r.rr) + " × the control risk" : "Risk ratio undefined";
      byId("estimand-risk-caption").textContent = `Control risk ${pct(r.r0)}; treatment risk ${pct(r.r1)}. ` + (c.riskContrast === "rd" ? `${fmt(Math.abs(r.rd) * 100, 1)} ${r.rd > 0 ? "additional" : "fewer"} expected events per 100 people under treatment.` : Number.isFinite(r.rr) ? `The ratio is dimensionless. The absolute difference is still ${signed(r.rd * 100, 1)} percentage points.` : "A zero denominator does not define a risk ratio, even when both risks are zero. The risk difference is still defined.");
      byId("estimand-risk-table").innerHTML = table(["Population", "Risk under control", "Risk under treatment", "Risk difference (pp)", "Risk ratio"], [[c.target.toUpperCase(), pct(r.r0), pct(r.r1), signed(r.rd * 100, 1), fmt(r.rr)]], "Exact population quantities at one year; no sampling noise");
      byId("save-risk-contract").disabled = c.riskContrast === "rr" && !Number.isFinite(r.rr);
      const times = [...new Set([...Array.from({ length: 101 }, (_, i) => i / 10), c.delay])].sort((a, b) => a - b);
      curve0.setAttribute("d", P.d(times.map(t => [t, s.at(t, 0)])));
      curve1.setAttribute("d", P.d(times.map(t => [t, s.at(t, 1)])));
      const kept = [...new Set([...times.filter(t => t <= c.tau), c.tau])].sort((a, b) => a - b);
      shaded.setAttribute("d", P.d([...kept.map(t => [t, s.at(t, 1)]), ...kept.slice().reverse().map(t => [t, s.at(t, 0)])]) + " Z");
      shaded.setAttribute("fill", s.rmstDifference < 0 ? "var(--red)" : "var(--purple)");
      shaded.style.display = c.survivalContrast === "rmst" ? "" : "none";
      const x = P.sx(c.tau), y0 = P.sy(s.s0), y1 = P.sy(s.s1), line = marker.firstElementChild;
      line.setAttribute("x1", x); line.setAttribute("x2", x);
      Object.entries({ x1: x, x2: x, y1: y0, y2: y1 }).forEach(([k, v]) => gap.setAttribute(k, v));
      gap.style.display = c.survivalContrast === "survival" ? "" : "none";
      dots.forEach((d, a) => { d.setAttribute("cx", x); d.setAttribute("cy", a ? y1 : y0); });
      byId("estimand-survival-question").textContent = q.survival;
      byId("estimand-survival-value").textContent = c.survivalContrast === "rmst" ? signed(s.rmstDifference, 3) + " years per person" : signed(s.difference * 100, 1) + " percentage points";
      byId("estimand-survival-caption").textContent = c.survivalContrast === "rmst" ? `The signed area from 0 to ${fmt(c.tau, 1)} years is ${signed(s.rmstDifference * 12, 2)} months of average survival time under treatment versus control, within this window.` : `At ${fmt(c.tau, 1)} years, ${fmt(s.s1 * 100, 1)} per 100 would be alive under treatment versus ${fmt(s.s0 * 100, 1)} under control. The vertical gap answers a question about this date.`;
      byId("estimand-survival-table").innerHTML = table(["Intervention", `Survival at ${fmt(c.tau, 1)} years`, "RMST (years)"], [["Control", pct(s.s0), fmt(s.rmst0)], ["Treatment", pct(s.s1), fmt(s.rmst1)], ["Treatment − control", signed(s.difference * 100, 1) + " pp", signed(s.rmstDifference, 3)]], "Same target population; exact curves and analytic integrals");
      byId("save-survival-contract").disabled = c.tau === 0;
      syncClock(c);
      // An edit makes an old save confirmation stale, but does not silently change the saved question.
      Object.values(statusIds).forEach(id => { if (byId(id).textContent) byId(id).textContent = "Exploring changes. Save again to update the question carried across lessons."; });
    }
    state.subscribe(render); render();
    return { render };
  }
  window.CausalEstimandScenes = { populationHTML, outcomesHTML, mount };
})();
