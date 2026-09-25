/* Intercurrent events laboratory: swimlanes of a device trial rewritten by five ICH E9(R1) strategies,
 * the unobservable parts that need assumptions, censoring as a hypothetical strategy, and an estimand builder. */
(function () {
  const { store, control, guided, table, fmt, esc } = CausalLab,
    { el, html, tween, lerp, Plot } = CausalAnim,
    I = CausalIntercurrent,
    root = document.querySelector("[data-lab]");
  const S5 = I.STRATEGIES;
  const state = store(
    "intercurrent",
    {
      step: 0, strategy: "treatment", reveal: false, ratio: 6,
      pop: "all", treat: "policy", endpoint: "score12", nonfatal: "treatment", death: "composite", summary: "mean",
    },
    {
      step: [0, 4], strategy: S5, ratio: [1, 9],
      pop: ["all", "stratum", "completers"], treat: ["policy", "strict", "ontreat"],
      endpoint: ["score12", "binary", "scoreLast"], nonfatal: S5,
      death: ["composite", "whileOn", "principal", "hypothetical", "treatment"], summary: ["mean", "prop", "median"],
    },
  );
  const KIND = {
    death: { letter: "D", label: "Death", color: "var(--ink)" },
    crossover: { letter: "X", label: "Crossover to the device", color: "var(--p)" },
    explant: { letter: "E", label: "Device removed (explant)", color: "var(--red)" },
    rescue: { letter: "R", label: "Rescue medication", color: "var(--phat)" },
  };
  const ARM = { 1: "Device + medical therapy", 0: "Medical therapy alone" }, ARM_SHORT = { 1: "Device", 0: "Medical" };
  const RULES = {
    treatment: {
      what: "Use the 12-month score whatever happened: crossover, explant and rescue are part of the treatment policy being compared.",
      death: "Death: a dead patient has no symptom score, so treatment policy cannot handle it. Here death counts as the worst score, 0 (a composite rule for death only).",
      assume: "Identified by randomization. No extra assumption beyond a well-run trial with complete follow-up.",
    },
    hypothetical: {
      what: "Use the score each patient would have had if crossover, explant and rescue had not happened. For patients who had one, that score was never observed.",
      death: "Death: counts as the worst score, 0. A world without death is rarely a clinically relevant question.",
      assume: "Needs a model. Someone must predict the unobserved scores, for example from patients who did not have the event, which is only right if those patients are comparable.",
    },
    composite: {
      what: "Any intercurrent event is itself a bad outcome: the patient gets the worst score, 0, from the moment it happens. Everyone else keeps their 12-month score.",
      death: "Death: also 0. The endpoint now mixes symptoms and event-free status.",
      assume: "Identified by randomization. The price is interpretation: the number is no longer a pure symptom effect.",
    },
    whileOn: {
      what: "Use the last score measured while the patient was still on assigned treatment and alive, before the first event.",
      death: "Death: the last score measured alive.",
      assume: "Identified by randomization, but patients contribute scores from different times, so a treatment that shortens time on treatment can look good.",
    },
    principal: {
      what: "Compare only patients who would have had no intercurrent event on either arm. Everyone else is outside the population.",
      death: "Death: dying on either arm puts a patient outside the stratum.",
      assume: "Needs assumptions. Membership depends on what would have happened on both arms, and each patient shows only one.",
    },
  };
  const pts = (v, d = 1) => (Number.isFinite(v) ? (v > 0 ? "+" : "") + fmt(v, d) : "undefined");

  /* ---------------------------------------------------------------- page ---------------------------------------------------------------- */
  root.innerHTML = `<style>
.ice-legend{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:14px;margin:8px 0}
.ice-legend span{display:inline-flex;align-items:center;gap:6px}
.ice-legend b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;color:var(--paper);font:600 12px "IBM Plex Mono",monospace}
.ice-legend i{display:inline-block;width:24px;height:4px;border-radius:2px}
.ice-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.ice-tabs button{flex:1 1 auto;min-height:44px}
.ice-tabs button[aria-pressed="true"]{border:2px solid var(--purple);font-weight:600;background:var(--soft)}
.ice-rule{border-left:4px solid var(--stage);background:var(--soft);padding:10px 14px;border-radius:0 8px 8px 0;margin:10px 0}
.ice-rule p{margin:5px 0;font-size:15px}
.ice-rule .needs{color:var(--red)}
svg.ice-lanes text{font:13px "IBM Plex Sans",system-ui,sans-serif;fill:var(--ink)}
svg.ice-lanes .muted{fill:var(--muted)}
svg.ice-lanes .head{font-weight:600}
svg.ice-lanes .mono{font-family:"IBM Plex Mono",monospace}
svg.ice-lanes .icon text{fill:var(--paper);font:600 13px "IBM Plex Mono",monospace}
svg.ice-lanes .need{fill:var(--red)}
svg.ice-bar text{font:13px "IBM Plex Sans",system-ui,sans-serif;fill:var(--ink)}
svg.ice-bar .muted{fill:var(--muted)}
svg.ice-bar .naive{fill:var(--or)}
svg.ice-bar .true{fill:var(--green)}
.ice-builder{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 22px}
.ice-builder label{font-size:15px}
.ice-builder select{min-height:44px;width:100%}
.ice-sentence{font-size:17px;line-height:1.55;padding:16px 18px;border-left:4px solid var(--teal);background:var(--soft);border-radius:0 8px 8px 0}
.ice-checks li{margin:6px 0}
svg#ice-surv text.tick{font-size:13px}
.ice-toggle{display:flex;align-items:center;gap:10px;margin:10px 0}
.ice-toggle input{width:22px;height:22px}
@media (max-width:700px){.ice-builder{grid-template-columns:1fr}}
</style>
<section class="lab-step" data-title="After randomization">
  <h2 tabindex="-1">Twelve patients, twelve months, and things that get in the way</h2>
  <p>In the first lesson you saved a question with a population, a contrast and a summary measure. Here is a randomized trial of an implanted device: <strong>device plus medical therapy</strong> versus <strong>medical therapy alone</strong>. The endpoint is a symptom score at 12 months, from 0 to 100, where higher is better.</p>
  <p id="ice-contract" class="note"></p>
  <p>Between randomization and month 12, things happen that change what the 12-month score means. ICH E9(R1) calls them <strong>intercurrent events</strong>: events after treatment starts that affect either the interpretation or the existence of the measurements. Here there are four kinds.</p>
  <div class="ice-legend" aria-hidden="true">
    <span><b style="background:var(--ink)">D</b>Death</span><span><b style="background:var(--p)">X</b>Crossover: a control patient gets the device</span><span><b style="background:var(--red)">E</b>Device removed</span><span><b style="background:var(--phat)">R</b>Rescue medication</span>
    <span><i style="background:var(--p)"></i>On the device</span><span><i style="background:var(--teal)"></i>Medical therapy only</span>
  </div>
  <div class="figure"><svg class="ice-lanes" id="ice-lanes-observed" role="img" aria-label="Swimlanes for 12 patients over 12 months, six per arm, with intercurrent events marked by lettered circles and the 12-month score at the right. The table below lists every event and score."></svg>
  <p class="fig-caption">Each lane is one patient. Dots are visits at months 3, 6, 9 and 12. The lane colour shows what the patient is actually receiving, so crossover turns a teal lane blue and device removal turns a blue lane teal.</p></div>
  <div class="predict" data-options="0, the worst possible score|Their last score before death|It does not exist: the estimand has to say how death counts" data-answer="2" data-hint="Pair F on medical therapy dies at month 8. No 12-month score was ever produced. Every choice (worst score, last value, leave them out) is a decision about the question, not a fact in the data.">Predict: a patient dies at month 8. What is their 12-month symptom score?</div>
  <div id="ice-observed-table"></div>
  <p class="note">Each pair letter marks two patients with the same prognosis, one in each arm. Pairing is a teaching device: it makes randomization perfectly balanced, so any gap you see later comes from the strategy, never from chance. A real trial does not label anyone's twin.</p>
</section>
<section class="lab-step" data-title="Five strategies">
  <h2 tabindex="-1">Same patients, five different questions</h2>
  <p>ICH E9(R1) lists five strategies for intercurrent events. Each one rewrites what counts for each patient. Pick one and watch the lanes: the ringed value is what the analysis uses, grey means ignored, a red question mark means nobody ever observed the value.</p>
  <div class="predict" data-options="Better: crossover adds device benefit to the comparison|Worse: the device's advantage shrinks|No change: crossover happens after randomization" data-answer="1" data-hint="Under treatment policy, pair C's control patient keeps the score earned after getting the device (48, instead of 24 without it). That raises the control mean by 4 points and shrinks the difference.">Predict: under a treatment-policy strategy, does crossover make the device look better or worse than it would without crossover?</div>
  <div class="ice-tabs" role="group" aria-label="Strategy for intercurrent events">${S5.map((s) => `<button type="button" data-strategy="${s}">${I.NAMES[s]}</button>`).join("")}</div>
  <div class="ice-rule" id="ice-rule" aria-live="polite"></div>
  <label class="ice-toggle"><input type="checkbox" id="ice-reveal"> Show the teaching world's hidden values (scores never observed, and who is truly in the principal stratum)</label>
  <div class="figure"><svg class="ice-lanes" id="ice-lanes" role="img" aria-label="The same 12 swimlanes, rewritten by the selected strategy. Ringed values are used, greyed parts are ignored, red question marks are unobserved. The table below lists each patient's value."></svg>
  <svg class="ice-bar" id="ice-bar" role="img" aria-label="Group means under the selected strategy for each arm and their difference, with the true value as a green dashed mark and a naive analysis as an orange diamond when the two differ."></svg>
  <p class="fig-caption" id="ice-bar-caption"></p></div>
  <div id="ice-strategy-table"></div>
</section>
<section class="lab-step" data-title="What needs an assumption">
  <h2 tabindex="-1">Three strategies are read off the trial. Two are not.</h2>
  <p>Randomization makes the arms comparable at time zero. Any rule that uses only what each patient actually experienced (treatment policy, composite, while on treatment) is then estimated by comparing arm means. The hypothetical and principal-stratum strategies ask about values nobody saw.</p>
  <div class="predict" data-options="Yes: those patients had no events, so they are the stratum|No: event-free on the device and event-free on medical therapy are different groups of people" data-answer="1" data-hint="On the device, pairs C, D and F finish event-free because the device helped them. On medical therapy they would have crossed over, needed rescue or died. They are not in the stratum, yet a completers analysis keeps them.">Predict: compare the patients who finished event-free in each arm. Is that the principal-stratum effect?</div>
  <div class="figure"><svg class="ice-bar" id="ice-five" role="img" aria-label="Five strategies, one row each: the true value in the teaching world as a green dashed mark and the analysis of observed data as a diamond. They coincide for three strategies and differ for hypothetical and principal stratum. The table below gives the numbers."></svg>
  <p class="legend legend-swatches"><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="14" y1="0" x2="14" y2="10" stroke="var(--green)" stroke-width="3" stroke-dasharray="3 2"/></svg>True value, teaching world</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><path d="M14 0l5 5-5 5-5-5z" fill="var(--ink)"/></svg>Randomized comparison</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><path d="M14 0l5 5-5 5-5-5z" fill="var(--or)"/></svg>Naive analysis</span></p></div>
  <div id="ice-five-table"></div>
  <p><strong>Hypothetical.</strong> The naive analysis drops patients after crossover, explant or rescue. It is right only if the patients who stayed are like those who left, and here they are not: the patients who needed rescue or crossover were the sickest. Real analyses replace dropping with a model (multiple imputation, inverse probability weighting, g-methods), which moves the problem into assumptions you must state and probe with sensitivity analyses.</p>
  <p><strong>Principal stratum.</strong> The stratum is pairs A and B: event-free on either arm. Membership is defined by potential outcomes under both arms, and each patient shows one. Estimating it needs assumptions such as monotonicity plus a model linking membership to baseline data.</p>
</section>
<section class="lab-step" data-title="Censoring chooses">
  <h2 tabindex="-1">Censoring at an event is a strategy in disguise</h2>
  <p>Switch to a time-to-event endpoint: death or heart-failure hospitalization in the control arm. A common analysis censors control patients when they cross over to the device. Censoring says "we stop watching and assume those still watched stand in for this patient". That is a claim about a world without crossover.</p>
  <div class="predict" data-options="Treatment policy|Hypothetical: survival had nobody crossed over|Composite" data-answer="1" data-hint="Kaplan-Meier after censoring at crossover estimates the curve in a world where crossover never happened, and only if crossover is unrelated to prognosis. Slide the dependence to 1 and the orange and green curves coincide.">Predict: censoring control patients at crossover targets which strategy?</div>
  <div class="figure"><div class="fig-row"><div><svg id="ice-surv" role="img" aria-label="Control-arm event-free probability over 12 months: the hypothetical world without crossover (green dashed), what Kaplan-Meier converges to after censoring at crossover (orange), and the control arm as randomized, with crossover (teal). Values at 12 months follow."></svg>
  <p class="legend legend-swatches"><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="6 4"/></svg>No crossover (hypothetical truth)</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--or)" stroke-width="2.5"/></svg>Censor at crossover (KM limit)</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="var(--teal)" stroke-width="2.5"/></svg>As randomized (treatment policy)</span></p></div>
  <div><div class="fig-controls"><label>Crossover rate in high-risk patients ÷ low-risk patients <output id="ice-ratio-out"></output><input id="ice-ratio" type="range" min="1" max="9" step="0.5"></label></div><div class="fig-readout" id="ice-surv-readout"></div></div></div>
  <p class="fig-caption" id="ice-surv-caption"></p></div>
  <div id="ice-surv-table"></div>
  <details class="formula-details"><summary>The teaching world behind the curves</summary><p>Two risk groups: 70% low risk (hazard 0.1 per year) and 30% high risk (0.6 per year). After crossover the hazard is multiplied by 0.7. The cohort's average crossover rate stays at 0.5 per year; the slider moves crossover toward high-risk patients. The Kaplan-Meier limit is exp(−∫ λ*(u) du), where λ*(u) is the event hazard among patients still uncensored and event-free, integrated numerically. When crossover is equally likely in both groups, λ*(u) is exactly the no-crossover hazard.</p></details>
  <p>So censoring is not neutral bookkeeping. It picks the hypothetical strategy, and its validity rests on non-informative censoring, the same "those who stayed resemble those who left" assumption as the naive hypothetical analysis in the last step. Following everyone through crossover instead gives the treatment-policy curve. The <a href="12-survival-lab.html">survival laboratory</a> and <a href="23-targeted-survival.html">targeted survival</a> return to censoring weights that relax this assumption.</p>
</section>
<section class="lab-step" data-title="Write the estimand">
  <h2 tabindex="-1">Five attributes, one sentence</h2>
  <p>ICH E9(R1) describes an estimand with five attributes. Pick each one. The sentence below is the question your trial answers, and the checks point out choices that do not fit together.</p>
  <div class="ice-builder">
    <label>1. Population <select id="ice-pop" data-ice="pop"><option value="all">All randomized patients</option><option value="stratum">Principal stratum: event-free on either arm</option><option value="completers">Completers on assigned treatment</option></select></label>
    <label>2. Treatment conditions (device plus medical therapy vs medical therapy alone) <select id="ice-treat" data-ice="treat"><option value="policy">Crossover, removal, rescue allowed</option><option value="strict">As if no crossover, removal or rescue</option><option value="ontreat">While on assigned treatment</option></select></label>
    <label>3. Endpoint (variable) <select id="ice-endpoint" data-ice="endpoint"><option value="score12">Symptom score at 12 months</option><option value="scoreLast">Score at last visit on treatment</option><option value="binary">Alive, no HF hospitalization, 12 mo</option></select></label>
    <label>4a. Crossover, explant and rescue <select id="ice-nonfatal" data-ice="nonfatal">${S5.map((s) => `<option value="${s}">${I.NAMES[s]}</option>`).join("")}</select></label>
    <label>4b. Death <select id="ice-death" data-ice="death"><option value="composite">Composite: worst outcome</option><option value="whileOn">While alive: last value</option><option value="principal">Principal stratum: survivors</option><option value="hypothetical">Hypothetical: as if no death</option><option value="treatment">Treatment policy: value after death</option></select></label>
    <label>5. Population-level summary <select id="ice-summary" data-ice="summary"><option value="mean">Difference in means</option><option value="prop">Difference in proportions</option><option value="median">Difference in medians</option></select></label>
  </div>
  <div class="eyebrow">Your estimand</div>
  <p class="ice-sentence" id="ice-sentence" aria-live="polite"></p>
  <p class="estimand-value" id="ice-builder-value"></p><p class="note" id="ice-builder-note"></p>
  <ul class="ice-checks" id="ice-checks"></ul>
  <div class="btns"><button id="ice-preset-tp">Typical primary: treatment policy</button><button id="ice-preset-hyp">Typical supplementary: hypothetical</button><button id="ice-save">Add these attributes to my estimand contract</button></div>
  <p id="ice-save-status" role="status"></p>
  <p class="note">What is exact here: every true value is computed from the teaching world's complete potential outcomes. What is schematic: the patients, scores and rates are invented to show the logic, and pairing patients is a device no real trial has.</p>
</section>`;

  const byId = (id) => document.getElementById(id);
  root.querySelectorAll("[data-ice]").forEach((e) => control(e, state, e.dataset.ice));
  control(byId("ice-reveal"), state, "reveal");
  control(byId("ice-ratio"), state, "ratio");
  root.querySelectorAll("[data-strategy]").forEach((b) => (b.onclick = () => state.set({ strategy: b.dataset.strategy })));

  const contractLine = () => {
    const c = window.Causality ? Causality.state().contract : null;
    byId("ice-contract").textContent = c
      ? "Your saved question: " + CausalState.describeContract(c) + " This lesson fills in the attributes that question left open: the exact treatment conditions, the endpoint, and what happens when patients die, cross over or stop."
      : "";
  };
  contractLine();
  window.Causality?.subscribe(contractLine);

  /* ------------------------------------------------------------ swimlanes ------------------------------------------------------------ */
  const LANES = I.lanes();
  const pairOf = (id) => I.PAIRS.find((p) => p.id === id);
  function segments(rec) {
    // [from, to, onDevice] pieces of the lane, ending at death or month 12.
    const ev = rec.events.slice().sort((a, b) => a.month - b.month);
    const end = ev.find((e) => e.kind === "death")?.month ?? 12;
    const out = [];
    let t = 0, dev = rec.arm === 1;
    for (const e of ev) {
      if (e.kind === "crossover" || e.kind === "explant") {
        out.push([t, e.month, dev]);
        t = e.month;
        dev = e.kind === "crossover";
      }
    }
    out.push([t, end, dev]);
    return { pieces: out, end, rescue: ev.find((e) => e.kind === "rescue")?.month };
  }
  function drawLanes(svg, strategy, reveal) {
    const W = Math.max(320, Math.round(svg.parentElement.clientWidth || 720)), narrow = W < 560;
    const L = narrow ? 50 : 70, R = narrow ? 82 : 170, x0 = L + 12, x1 = W - R - 16;
    const sx = (m) => x0 + ((x1 - x0) * m) / 12, laneH = 34, headH = 26;
    const yArm = { 1: 50, 0: 50 + headH + 6 * laneH + 18 };
    const H = yArm[0] + headH + 6 * laneH + 4;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const g = (cls) => { const e = el("g", cls ? { class: cls } : {}); svg.append(e); return e; };
    const axis = g();
    [0, 3, 6, 9, 12].forEach((m) => {
      axis.append(el("line", { x1: sx(m), x2: sx(m), y1: 30, y2: H - 4, stroke: "var(--grid)", "stroke-width": 1 }));
      axis.append(el("text", { x: sx(m), y: 16, "text-anchor": "middle", class: "muted mono" }, m));
    });
    axis.append(el("text", { x: 0, y: 16, class: "muted" }, "month"));
    axis.append(el("text", { x: W - R + 6, y: 16, class: "muted" }, strategy ? "value used" : "score at 12"));
    const H_ = strategy ? I.preset(strategy) : null;
    const rows = [];
    for (const arm of [1, 0]) {
      axis.append(el("text", { x: 0, y: yArm[arm], class: "head", fill: arm ? "var(--p)" : "var(--teal)" }, ARM[arm]));
      LANES.filter((r) => r.arm === arm).forEach((rec, k) => {
        const cy = yArm[arm] + headH - 6 + k * laneH + laneH / 2, lane = g();
        const pair = pairOf(rec.pair), v = H_ ? I.valueFor(rec, pair, H_) : null;
        const { pieces, end, rescue } = segments(rec);
        const principal = strategy === "principal";
        const knownOut = principal && !v.member && (v.memberKnown || reveal);
        const counted = !v ? end : principal ? (knownOut ? 0 : end) : Math.min(end, v.counted);
        lane.append(el("text", { x: 0, y: cy + 4.5 }, (narrow ? "" : "Pair ") + rec.pair));
        if (principal && !knownOut && !(reveal || v.memberKnown))
          lane.append(el("text", { x: narrow ? 16 : 50, y: cy + 4.5, class: "need", "font-weight": 600 }, "?"));
        // Lane body: coloured while counted, grey and dashed once ignored.
        for (const [a, b, dev] of pieces) {
          const col = dev ? "var(--p)" : "var(--teal)";
          const cut = Math.max(a, Math.min(b, counted));
          if (cut > a) lane.append(el("line", { x1: sx(a), x2: sx(cut), y1: cy, y2: cy, stroke: col, "stroke-width": 5, "stroke-linecap": "round" }));
          if (b > cut) lane.append(el("line", { x1: sx(cut), x2: sx(b), y1: cy, y2: cy, stroke: "var(--muted)", "stroke-width": 3, "stroke-dasharray": "4 4", opacity: 0.45 }));
        }
        if (rescue != null) lane.append(el("line", { x1: sx(rescue), x2: sx(end), y1: cy + 6, y2: cy + 6, stroke: "var(--phat)", "stroke-width": 2, opacity: rescue < counted ? 1 : 0.4 }));
        if (v?.basis === "needs a model") {
          lane.append(el("line", { x1: sx(v.counted), x2: sx(12), y1: cy - 7, y2: cy - 7, stroke: "var(--red)", "stroke-width": 1.6, "stroke-dasharray": "3 3" }));
        }
        // Visits.
        I.VISITS.forEach((m, i) => {
          if (rec.visits[i] == null) return;
          lane.append(el("circle", { cx: sx(m), cy, r: 3.4, fill: "var(--paper)", stroke: "var(--ink)", "stroke-width": 1.3, opacity: m <= counted ? 1 : 0.35 }));
        });
        // The value used.
        let ring = null, label, cls = "mono";
        if (!v) label = rec.visits[3] == null ? "none (died)" : String(rec.visits[3]);
        else if (principal) {
          if (knownOut) label = narrow ? "out" : v.memberKnown ? "outside: own event" : "outside: other arm";
          else if (reveal || v.memberKnown) { label = String(v.value); ring = 12; }
          else { label = narrow ? v.value + " ?" : v.value + ", if in stratum"; ring = 12; cls = "mono need"; }
        } else if (v.basis === "needs a model") {
          label = reveal ? (narrow ? "? " + v.value : "hidden: " + v.value) : narrow ? "? model" : "? needs a model";
          cls = "mono need";
          lane.append(el("rect", { x: sx(12) - 8, y: cy - 8, width: 16, height: 16, fill: "var(--paper)", stroke: "var(--red)", "stroke-width": 1.6, "stroke-dasharray": "3 2", rx: 3 }),
            el("text", { x: sx(12), y: cy + 4.5, "text-anchor": "middle", class: "need", "font-weight": 600 }, "?"));
        } else if (v.basis.includes("worst")) label = narrow ? "0 worst" : "0 (worst score)";
        else if (v.basis.startsWith("last")) { label = narrow ? `${v.value}, mo ${v.month}` : `${v.value} (month ${v.month})`; ring = v.month; }
        else if (Number.isNaN(v.value)) label = "no score";
        else { label = String(v.value); ring = 12; }
        if (ring != null) lane.append(el("circle", { cx: sx(ring), cy, r: 7.5, fill: "none", stroke: "var(--ink)", "stroke-width": 2.2 }));
        // Event icons last, so they sit on top.
        rec.events.forEach((e) => {
          const K = KIND[e.kind], ic = el("g", { class: "icon" });
          const hot = v && v.basis.includes("worst") && v.event === e;
          if (hot) ic.append(el("circle", { cx: sx(e.month), cy, r: 13, fill: "none", stroke: "var(--ink)", "stroke-width": 2.2 }));
          ic.append(el("circle", { cx: sx(e.month), cy, r: 9.5, fill: K.color, stroke: "var(--paper)", "stroke-width": 1.5 }), el("text", { x: sx(e.month), y: cy + 4.2, "text-anchor": "middle" }, K.letter));
          lane.append(ic);
        });
        lane.append(el("text", { x: W - R + 6, y: cy + 4.5, class: cls }, label));
        if (knownOut) lane.setAttribute("opacity", 0.45);
        rows.push({ rec, v, label });
      });
    }
    return rows;
  }
  const eventText = (rec) => rec.events.length ? rec.events.map((e) => `${KIND[e.kind].label}, month ${e.month}`).join("; ") : "None";
  const observedSvg = byId("ice-lanes-observed"), strategySvg = byId("ice-lanes");
  function renderObserved() {
    drawLanes(observedSvg, null, false);
    byId("ice-observed-table").innerHTML = table(
      ["Patient", "Arm", "Intercurrent events", "12-month score"],
      LANES.map((r) => [`Pair ${r.pair}`, ARM_SHORT[r.arm], eventText(r), r.visits[3] == null ? "None: died" : String(r.visits[3])]),
      "What happened to each patient (all values exact, invented for teaching)",
    );
  }

  /* ------------------------------------------------------ group estimate bar ------------------------------------------------------ */
  let barFrom = null, barAnim = null;
  function drawBar(frame, c) {
    const svg = byId("ice-bar"), W = Math.max(320, Math.round(svg.parentElement.clientWidth || 720)), narrow = W < 560;
    const L = narrow ? 88 : 180, R = 18, x0 = L, x1 = W - R;
    const sx = (v) => x0 + ((x1 - x0) * v) / 80, dx = (v) => x0 + ((x1 - x0) * (v + 5)) / 35;
    const H = 222;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const identified = frame.identified;
    const defs = el("defs"), pid = "ice-hatch";
    for (const [id, col] of [["p", "var(--p)"], ["t", "var(--teal)"]]) {
      const pat = el("pattern", { id: pid + id, width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      pat.append(el("rect", { width: 7, height: 7, fill: col, opacity: 0.25 }), el("line", { x1: 0, x2: 0, y1: 0, y2: 7, stroke: col, "stroke-width": 3 }));
      defs.append(pat);
    }
    svg.append(defs);
    svg.append(el("text", { x: 0, y: 14, class: "muted" }, "Arm mean under this strategy (score 0 to 80)"));
    [0, 20, 40, 60, 80].forEach((v) => {
      svg.append(el("line", { x1: sx(v), x2: sx(v), y1: 24, y2: 96, stroke: "var(--grid)" }), el("text", { x: sx(v), y: 110, "text-anchor": "middle", class: "muted" }, v));
    });
    [[1, frame.t1, frame.a1, 32], [0, frame.t0, frame.a0, 64]].forEach(([arm, t, a, y]) => {
      const col = arm ? "var(--p)" : "var(--teal)";
      svg.append(el("text", { x: 0, y: y + 15 }, narrow ? (arm ? "Device" : "Medical") : ARM[arm]));
      svg.append(el("rect", { x: sx(0), y, width: Math.max(0, sx(t) - sx(0)), height: 20, fill: identified ? col : `url(#${pid}${arm ? "p" : "t"})`, opacity: identified ? 0.85 : 1, rx: 2 }));
      svg.append(el("line", { x1: sx(t), x2: sx(t), y1: y - 4, y2: y + 24, stroke: "var(--green)", "stroke-width": 2.5, "stroke-dasharray": "4 3" }));
      if (!identified) svg.append(el("path", { d: `M${sx(a)} ${y + 1}l9 9-9 9-9-9Z`, fill: "var(--or)", stroke: "var(--paper)", "stroke-width": 1.2 }));
    });
    // Difference row on its own scale.
    const yD = 160;
    svg.append(el("text", { x: 0, y: 136, class: "muted" }, "Difference, device minus medical therapy (points)"));
    [-5, 0, 10, 20, 30].forEach((v) => {
      svg.append(el("line", { x1: dx(v), x2: dx(v), y1: yD - 14, y2: yD + 14, stroke: v === 0 ? "var(--muted)" : "var(--grid)" }), el("text", { x: dx(v), y: yD + 30, "text-anchor": "middle", class: "muted" }, v));
    });
    svg.append(el("text", { x: 0, y: yD + 5 }, narrow ? "Effect" : "Effect"));
    svg.append(el("line", { x1: dx(frame.te), x2: dx(frame.te), y1: yD - 14, y2: yD + 14, stroke: "var(--green)", "stroke-width": 3, "stroke-dasharray": "4 3" }));
    svg.append(el("path", { d: `M${dx(frame.ae)} ${yD - 9}l9 9-9 9-9-9Z`, fill: identified ? "var(--ink)" : "var(--or)", stroke: "var(--paper)", "stroke-width": 1.2 }));
    const lab = identified ? `truth = randomized comparison = ${pts(c.te)}` : `truth ${pts(c.te)} · naive ${pts(c.ae)}`;
    svg.append(el("text", { x: 0, y: yD + 52, class: identified ? "true" : "naive", "font-weight": 600 }, lab));
  }
  function renderBar(s) {
    const t = I.truth(s), a = I.analysis(s);
    const next = { t1: t.m1, t0: t.m0, a1: a.m1, a0: a.m0, te: t.effect, ae: a.effect, identified: a.identified };
    barAnim?.cancel();
    const from = barFrom || next;
    barAnim = tween({ duration: 450, onUpdate(u) {
      const f = { identified: next.identified };
      for (const k of ["t1", "t0", "a1", "a0", "te", "ae"]) f[k] = lerp(from[k], next[k], u);
      barFrom = f; drawBar(f, next);
    } });
    const pc = I.truth("principal");
    byId("ice-bar-caption").textContent = a.identified
      ? `${I.NAMES[s]}: device arm mean ${fmt(t.m1, 1)}, medical therapy ${fmt(t.m0, 1)}, difference ${pts(t.effect)} points. Every value comes from what patients actually experienced, so the randomized comparison equals the truth.`
      : s === "hypothetical"
        ? `Hypothetical: the true difference is ${pts(t.effect)} points (hatched bars: only the teaching world knows them). Dropping patients after their event gives ${pts(a.effect)} points (orange), because the patients who needed rescue or crossover were the sickest.`
        : `Principal stratum: the true effect among pairs ${pc.members.join(" and ")} is ${pts(t.effect)} points. Comparing everyone who finished event-free (${a.n1} device patients, ${a.n0} control patients) gives ${pts(a.effect)} (orange), because the device keeps sicker patients event-free.`;
  }
  function renderStrategy() {
    const c = state.get(), s = c.strategy, R = RULES[s];
    root.querySelectorAll("[data-strategy]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.strategy === s)));
    byId("ice-rule").innerHTML = `<p><strong>${esc(I.NAMES[s])}.</strong> ${esc(R.what)}</p><p>${esc(R.death)}</p><p class="${s === "hypothetical" || s === "principal" ? "needs" : ""}">${esc(R.assume)}</p>`;
    const rows = drawLanes(strategySvg, s, c.reveal);
    byId("ice-strategy-table").innerHTML = table(
      ["Patient", "Arm", "Value used", "Why"],
      rows.map(({ rec, v }) => {
        const shown = s === "principal"
          ? (!v.member && (v.memberKnown || c.reveal) ? "Not counted" : c.reveal || v.memberKnown ? fmt(v.value, 1) : fmt(v.value, 1) + " if a member")
          : v.basis === "needs a model" ? (c.reveal ? fmt(v.value, 1) + " (hidden)" : "Unobserved") : Number.isNaN(v.value) ? "None" : fmt(v.value, 1);
        const why = s === "principal"
          ? (v.member ? (c.reveal ? "Event-free on both arms" : "Event-free here; other arm unknown") : v.memberKnown ? "Event on this arm" : c.reveal ? "Event-free here, not on the other arm" : "Event-free here; other arm unknown")
          : v.basis === "last score on treatment" || v.basis === "last score alive" ? `${v.basis}, month ${v.month}` : v.basis;
        return [`Pair ${rec.pair}`, ARM_SHORT[rec.arm], shown, why];
      }),
      `${I.NAMES[s]}: the value each patient contributes`,
    );
    renderBar(s);
  }

  /* ------------------------------------------------------- five answers ------------------------------------------------------- */
  const SUM = I.summary();
  function renderFive() {
    const svg = byId("ice-five"), W = Math.max(320, Math.round(svg.parentElement.clientWidth || 720));
    const x0 = 14, x1 = W - 14, dx = (v) => x0 + ((x1 - x0) * (v + 5)) / 35, rowH = 58, top = 12;
    const H = top + SUM.length * rowH + 30;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.replaceChildren();
    const cur = state.get().strategy;
    [-5, 0, 5, 10, 15, 20, 25, 30].forEach((v) => {
      svg.append(el("line", { x1: dx(v), x2: dx(v), y1: top, y2: H - 26, stroke: v === 0 ? "var(--muted)" : "var(--grid)" }));
      if (W > 460 || v % 10 === 0 || v === -5) svg.append(el("text", { x: dx(v), y: H - 8, "text-anchor": "middle", class: "muted" }, v));
    });
    SUM.forEach((r, i) => {
      const y = top + i * rowH + 40, t = r.truth.effect, a = r.analysis.effect, id = r.analysis.identified;
      svg.append(el("text", { x: x0, y: y - 18, "font-weight": r.strategy === cur ? 700 : 400 }, r.name),
        el("text", { x: x1, y: y - 18, "text-anchor": "end", class: id ? "true" : "naive" }, id ? `${pts(t)} (both)` : `truth ${pts(t)} · naive ${pts(a)}`));
      svg.append(el("line", { x1: x0, x2: x1, y1: y, y2: y, stroke: "var(--rule)" }));
      if (!id) svg.append(el("line", { x1: dx(Math.min(t, a)), x2: dx(Math.max(t, a)), y1: y, y2: y, stroke: "var(--or)", "stroke-width": 4, opacity: 0.35 }));
      svg.append(el("line", { x1: dx(t), x2: dx(t), y1: y - 11, y2: y + 11, stroke: "var(--green)", "stroke-width": 3, "stroke-dasharray": "4 3" }));
      svg.append(el("path", { d: `M${dx(a)} ${y - 8}l8 8-8 8-8-8Z`, fill: id ? "var(--ink)" : "var(--or)", stroke: "var(--paper)", "stroke-width": 1.2 }));
    });
    byId("ice-five-table").innerHTML = table(
      ["Strategy", "True value (points)", "From observed data", "What the observed-data number is"],
      SUM.map((r) => [r.name, pts(r.truth.effect, 2), pts(r.analysis.effect, 2),
        r.analysis.identified ? "Randomized comparison of arm means; equals the truth" : r.strategy === "hypothetical" ? "Naive: drop patients after crossover, explant or rescue" : "Naive: compare patients event-free in their own arm"]),
      "One trial, five estimands: exact values in the teaching world",
    );
  }

  /* -------------------------------------------------------- censoring -------------------------------------------------------- */
  const survSvg = byId("ice-surv");
  let SP, cTP, cKM, cHyp, survW = 0;
  function survPlot() {
    // Built at the container's width so tick labels stay at text size on a phone.
    const W = Math.max(300, Math.round(survSvg.parentElement.clientWidth || 520));
    if (W === survW) return;
    survW = W;
    SP = new Plot(survSvg, { x: [0, 12], y: [0.75, 1], width: W, height: Math.round(Math.min(320, Math.max(250, W * 0.62))), margin: { l: 46, r: 16, t: 26, b: 46 }, xticks: [0, 3, 6, 9, 12], yticks: [0.75, 0.8, 0.85, 0.9, 0.95, 1], xlabel: "Months since randomization", ylabel: "Event-free probability, control arm" });
    cTP = SP.line([[0, 1]], { stroke: "var(--teal)", "stroke-width": 2.5 });
    cKM = SP.line([[0, 1]], { stroke: "var(--or)", "stroke-width": 2.5 });
    cHyp = SP.line([[0, 1]], { stroke: "var(--green)", "stroke-width": 2.5, "stroke-dasharray": "7 5" });
  }
  function renderSurv() {
    survPlot();
    const r = state.get().ratio, W = I.censoring(r), grid = Array.from({ length: 61 }, (_, i) => i / 5);
    const path = (f) => SP.d(grid.map((m) => [m, f(m / 12)]));
    cTP.setAttribute("d", path(W.tp)); cKM.setAttribute("d", path(W.km)); cHyp.setAttribute("d", path(W.hyp));
    const h = W.hyp(1), k = W.km(1), t = W.tp(1);
    byId("ice-ratio-out").textContent = fmt(r, 1) + "×";
    byId("ice-surv-readout").replaceChildren(...[
      ["Crossover per year, low / high risk", `${fmt(W.rates[0], 2)} / ${fmt(W.rates[1], 2)}`],
      ["No crossover, 12 months", fmt(h * 100, 1) + "%"],
      ["Censor at crossover", fmt(k * 100, 1) + "%"],
      ["As randomized", fmt(t * 100, 1) + "%"],
    ].flatMap(([a, b]) => [html("span", { class: "k" }, a), html("span", {}, b)]));
    byId("ice-surv-caption").textContent = Math.abs(k - h) < 5e-4
      ? `Crossover is unrelated to risk, so censoring is non-informative: the censored Kaplan-Meier curve estimates the no-crossover curve exactly (${fmt(h * 100, 1)}% at 12 months).`
      : `High-risk patients cross over ${fmt(r, 1)} times as often. Censoring removes them early, so the patients left look healthier: ${fmt(k * 100, 1)}% instead of the hypothetical ${fmt(h * 100, 1)}%. Following everyone gives the treatment-policy curve, ${fmt(t * 100, 1)}%.`;
    byId("ice-surv-table").innerHTML = table(["Month", "No crossover", "Censored", "As randomized"],
      [3, 6, 9, 12].map((m) => [String(m), fmt(W.hyp(m / 12) * 100, 1) + "%", fmt(W.km(m / 12) * 100, 1) + "%", fmt(W.tp(m / 12) * 100, 1) + "%"]),
      "Control arm, event-free probability");
  }

  /* ---------------------------------------------------------- builder ---------------------------------------------------------- */
  const PHRASE = {
    pop: { all: "all randomized patients", stratum: "patients who would be free of intercurrent events on either arm", completers: "patients who completed 12 months on their assigned treatment" },
    treat: { policy: "device plus medical therapy versus medical therapy alone, with crossover, device removal and rescue medication allowed as they occur", strict: "device plus medical therapy versus medical therapy alone, in a world where no one crossed over, had the device removed or took rescue medication", ontreat: "device plus medical therapy versus medical therapy alone, while patients stay on their assigned treatment" },
    endpoint: { score12: "the symptom score at 12 months", scoreLast: "the symptom score at the last visit on assigned treatment", binary: "being alive and free of heart-failure hospitalization at 12 months" },
    nonfatal: { treatment: "patients are followed to month 12 whatever happens (treatment policy)", hypothetical: "scores are those that would have been seen without crossover, device removal or rescue (hypothetical)", composite: "crossover, device removal or rescue counts as the worst outcome (composite)", whileOn: "only scores measured before crossover, device removal or rescue count (while on treatment)", principal: "patients with crossover, device removal or rescue on either arm are outside the population (principal stratum)" },
    death: { composite: "death counts as the worst outcome", whileOn: "for patients who die, the last value measured alive is used", principal: "patients who would die on either arm are outside the population", hypothetical: "outcomes are imagined as if no one had died", treatment: "outcomes after death are used" },
    summary: { mean: "difference in means", prop: "difference in proportions", median: "difference in medians" },
  };
  function renderBuilder() {
    const c = state.get(), P = PHRASE;
    byId("ice-sentence").textContent = `In ${P.pop[c.pop]}, what is the ${P.summary[c.summary]} in ${P.endpoint[c.endpoint]}, comparing ${P.treat[c.treat]}, where ${P.nonfatal[c.nonfatal]} and ${P.death[c.death]}?`;
    const checks = [];
    const principal = c.nonfatal === "principal" || c.death === "principal";
    if (principal && c.pop !== "stratum") checks.push("A principal-stratum strategy changes the population: set attribute 1 to the principal stratum.");
    if (!principal && c.pop === "stratum") checks.push("This population is a principal stratum; choose the principal-stratum strategy in 4a or 4b so the attributes agree.");
    if (c.pop === "completers") checks.push("Completers are chosen by what happened after randomization, which the treatment itself changes. The two arms' completers are different kinds of people, so this is not a randomized comparison. The principal stratum is the well-defined version of this idea.");
    if (c.endpoint === "binary" && c.death !== "composite") checks.push("This endpoint already counts death as a failure, so death is handled by the endpoint itself (a composite). Set 4b to composite.");
    else if (c.death === "treatment") checks.push("A symptom score does not exist after death, so a treatment-policy strategy cannot be applied to death. Choose composite, while alive, or principal stratum.");
    if (c.death === "hypothetical") checks.push("A hypothetical world without death is rarely a clinically relevant question for a symptom endpoint; ICH E9(R1) asks that hypothetical scenarios be precisely described and relevant.");
    if (c.nonfatal === "hypothetical" && c.treat !== "strict") checks.push("A hypothetical strategy imagines a world without these events; the treatment conditions (attribute 2) should say so.");
    if (c.nonfatal === "treatment" && c.treat !== "policy") checks.push("A treatment-policy strategy compares the regimens including what patients did afterwards; attribute 2 should say crossover, removal and rescue are allowed.");
    if (c.nonfatal === "whileOn" && (c.endpoint !== "scoreLast" || c.treat !== "ontreat")) checks.push("While on treatment pairs with the last-on-treatment score and with treatment 'while patients stay on it'.");
    if (c.nonfatal !== "whileOn" && c.endpoint === "scoreLast") checks.push("The last-on-treatment score is a while-on-treatment endpoint; choose that strategy in 4a.");
    if (c.summary === "prop" && c.endpoint !== "binary") checks.push("A difference in proportions needs a binary endpoint, or a responder threshold on the score.");
    if (c.summary !== "prop" && c.endpoint === "binary") checks.push("For a yes-or-no endpoint, summarize with a difference in proportions.");
    byId("ice-checks").innerHTML = checks.length ? checks.map((t) => `<li>${esc(t)}</li>`).join("") : "<li>These attributes fit together.</li>";
    let value = "", note = "";
    const scoreOK = c.endpoint === "score12" || (c.endpoint === "scoreLast" && c.nonfatal === "whileOn");
    if (c.pop === "completers") { value = "No causal value"; note = "The comparison groups are not defined by randomization."; }
    else if (!scoreOK || c.summary !== "mean") { value = "Not computed"; note = "This teaching world records only the symptom score, summarized as a difference in means."; }
    else if (principal !== (c.pop === "stratum")) { value = "Not computed"; note = "Make the population and strategy agree to see a value."; }
    else {
      const t = I.truth({ nonfatal: c.nonfatal, death: c.death });
      if (Number.isFinite(t.effect)) {
        value = pts(t.effect, 2) + " points";
        note = "True value in the teaching world. " + (c.nonfatal === "hypothetical" || principal ? "The trial alone cannot estimate it without extra assumptions." : "Randomization identifies it: comparing arm means recovers it.");
      } else { value = "Undefined"; note = "Some patients have no value under this rule."; }
    }
    byId("ice-builder-note").textContent = note;
    byId("ice-builder-value").textContent = value;
    byId("ice-save").disabled = checks.length > 0;
  }
  byId("ice-preset-tp").onclick = () => state.set({ pop: "all", treat: "policy", endpoint: "score12", nonfatal: "treatment", death: "composite", summary: "mean" });
  byId("ice-preset-hyp").onclick = () => state.set({ pop: "all", treat: "strict", endpoint: "score12", nonfatal: "hypothetical", death: "composite", summary: "mean" });
  byId("ice-save").onclick = () => {
    const c = state.get();
    Causality.event({ type: "contract", value: { intercurrent: { population: c.pop, treatment: c.treat, endpoint: c.endpoint, nonfatal: c.nonfatal, death: c.death, summary: c.summary, sentence: byId("ice-sentence").textContent } } });
    byId("ice-save-status").textContent = "Saved. Your estimand contract now carries these five attributes.";
  };

  /* ---------------------------------------------------------- wiring ---------------------------------------------------------- */
  let last = {};
  function render() {
    const c = state.get();
    if (c.strategy !== last.strategy || c.reveal !== last.reveal) { renderStrategy(); renderFive(); }
    if (c.ratio !== last.ratio) renderSurv();
    renderBuilder();
    if (last.pop !== undefined && byId("ice-save-status").textContent && ["pop", "treat", "endpoint", "nonfatal", "death", "summary"].some((k) => c[k] !== last[k]))
      byId("ice-save-status").textContent = "Changed since saving. Save again to update your contract.";
    last = c;
  }
  renderObserved();
  state.subscribe(render);
  render();
  // Swimlanes are laid out at the container's real width so text stays at 13px on a phone.
  const widths = new Map(), redraw = new Map([
    [observedSvg.parentElement, renderObserved],
    [strategySvg.parentElement, renderStrategy],
    [byId("ice-five").parentElement, renderFive],
    [survSvg.parentElement, () => { survW = 0; renderSurv(); }],
  ]);
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        if (!w || widths.get(e.target) === w) continue;
        widths.set(e.target, w);
        redraw.get(e.target)();
      }
    });
    redraw.forEach((_, node) => ro.observe(node));
  }
  guided(root, state);
})();
