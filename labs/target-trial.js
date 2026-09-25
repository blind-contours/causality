/* Design the target trial: protocol table, swimlanes with a movable time zero,
 * Kaplan–Meier curves against the known truth, other misalignments, and the grace-period problem.
 * All numbers come from science/target-trial.js. */
(function () {
  const { store, control, tools, guided, table, fmt, esc } = CausalLab,
    { el, html, tween, lerp, Plot, player } = CausalAnim,
    T = CausalTargetTrial,
    root = document.querySelector('[data-lab="target-trial"]'),
    byId = (id) => document.getElementById(id),
    // Phones get narrower viewBoxes so figure text stays legible; chosen once at load.
    phone = window.matchMedia?.("(max-width: 600px)").matches;
  const state = store(
    "target-trial",
    {
      step: 0,
      elig: "new",
      strat: "grace",
      zero: "procedure",
      contrast: "pp",
      effect: "null",
      seed: T.DEFAULTS.seed,
      days: 30,
      graceDeaths: "none",
    },
    {
      step: [0, 4],
      elig: ["new", "prevalent"],
      strat: ["grace", "ever"],
      zero: ["aligned", "procedure", "ever"],
      contrast: ["pp", "itt"],
      effect: ["null", "benefit"],
      seed: [1, 4294967295],
      days: [0, 90],
      graceDeaths: ["none", "procedure"],
    },
  );
  const HR = { null: 1, benefit: 0.7 };
  const pct = (v, d = 1) => fmt(v * 100, d) + "%";
  const pp = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v * 100), d) + " pp";
  const zeroNames = {
    aligned: "(a) Eligibility for everyone",
    procedure: "(b) Procedure date if treated, eligibility if not",
    ever: "(c) Eligibility, grouped by later treatment",
  };
  const zeroOptions = Object.entries(zeroNames)
    .map(([v, t]) => `<option value="${v}">${esc(t)}</option>`)
    .join("");
  const zeroRadios = (name) =>
    `<fieldset class="tt-zero"><legend>Time zero (start of follow-up)</legend>${Object.entries(zeroNames)
      .map(([v, t]) => `<label><input type="radio" name="${name}" value="${v}"> ${esc(t)}</label>`)
      .join("")}</fieldset>`;
  const sw = (attrs) =>
    `<svg class="swatch" width="28" height="10" aria-hidden="true">${attrs}</svg>`;

  root.innerHTML = `<style>
.tt-protocol{width:100%;border-collapse:collapse;font-size:15px}
.tt-protocol caption{text-align:left;color:var(--muted);font-size:14px;padding-bottom:6px}
.tt-protocol th,.tt-protocol td{border-top:1px solid var(--rule);padding:10px 8px;vertical-align:top;text-align:left}
.tt-protocol thead th{font-size:13px;color:var(--muted);font-weight:500;border-top:0}
.tt-protocol tbody th{font-weight:600;width:17%}
.tt-protocol td{width:41.5%}
.tt-protocol select{width:100%;max-width:100%;font-size:15px;min-height:40px}
.tt-protocol .tt-emu{color:var(--ink)}
.tt-protocol .tt-flag{display:block;margin-top:6px;font-size:14px}
.tt-flag.ok{color:var(--green)}.tt-flag.bad{color:var(--red)}.tt-flag.warn{color:var(--or)}
.tt-protocol tr.bad td.tt-emu{box-shadow:inset 3px 0 0 var(--red)}
.tt-protocol tr.warn td.tt-emu{box-shadow:inset 3px 0 0 var(--or)}
@media (max-width:680px){
  .tt-protocol thead{display:none}
  .tt-protocol caption{display:block}
  .tt-protocol,.tt-protocol tbody,.tt-protocol tr,.tt-protocol th,.tt-protocol td{display:block;width:auto}
  .tt-protocol tr{border-top:1px solid var(--rule);padding:8px 0}
  .tt-protocol th,.tt-protocol td{border:0;padding:4px 0}
  .tt-protocol td::before{content:attr(data-col);display:block;font-size:13px;color:var(--muted)}
  .tt-protocol tr.bad td.tt-emu,.tt-protocol tr.warn td.tt-emu{box-shadow:none;padding-left:8px;border-left:3px solid var(--red)}
  .tt-protocol tr.warn td.tt-emu{border-left-color:var(--or)}
}
.tt-zero{border:1px solid var(--rule);border-radius:8px;padding:8px 12px;margin:10px 0;display:grid;gap:2px}
.tt-zero legend{font-size:14px;color:var(--muted);padding:0 4px}
.tt-zero label{display:flex;gap:10px;align-items:center;margin:0;min-height:40px;font-size:15px}
.tt-zero input{width:20px;height:20px;flex:none}
.tt-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px 16px;align-items:end}
.tt-controls label{margin:0}
.tt-controls select,.tt-controls input[type=number]{width:100%;min-height:40px;font-size:15px}
.tt-summary{font-weight:500}
.tt-desc{display:block;margin-top:6px;font-size:14px;color:var(--muted)}
.tt-lane-head{font:600 13px "IBM Plex Sans",system-ui,sans-serif;fill:var(--ink)}
svg.fig .tt-lab{font:12px "IBM Plex Mono",monospace;fill:var(--muted)}
.tt-rail{stroke:var(--rule);stroke-width:1.5}
.tt-window{fill:var(--grid);opacity:.9}
.tt-seg-u{stroke:var(--teal);stroke-width:6;stroke-linecap:butt}
.tt-seg-t{stroke:var(--p);stroke-width:6;stroke-linecap:butt}
.tt-seg-t.faint{opacity:.45}
.tt-zero-bar{stroke:var(--ink);stroke-width:2.5}
.tt-proc{fill:var(--paper);stroke:var(--ink);stroke-width:1.6}
.tt-death{stroke:var(--red);stroke-width:2.4}
.tt-cens{stroke:var(--muted);stroke-width:1.6}
.tt-cursor{fill:var(--ink)}
.tt-counted{stroke:var(--red);stroke-width:1.5;fill:none}
.tt-grace{fill:var(--or);opacity:.12}
.tt-track-a{stroke:var(--p);stroke-width:4}
.tt-track-b{stroke:var(--teal);stroke-width:4}
.tt-sweep{stroke:var(--ink);stroke-width:1.2;stroke-dasharray:3 3}
.tt-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.tt-big{font:500 22px "IBM Plex Mono",monospace}
.tt-status{font-size:15px}
svg.fig .tt-halo{paint-order:stroke;stroke:var(--paper);stroke-width:4px;stroke-linejoin:round}
#tt-rd{max-width:680px}
[data-lab="target-trial"] .figure .fig-readout{font-size:13px}
@media (max-width:720px){
  [data-lab="target-trial"] svg.fig .tick,[data-lab="target-trial"] svg.fig .fig-text,[data-lab="target-trial"] svg.fig .ref-label{font-size:15px}
  [data-lab="target-trial"] svg.fig .fig-text.ink,[data-lab="target-trial"] svg.fig .tt-lane-head,[data-lab="target-trial"] svg.fig .axis-label{font-size:16px}
}
</style>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<pattern id="tt-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--paper)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--or)" stroke-width="3"/></pattern>
</defs></svg>

<section class="lab-step" data-title="Write the protocol">
<h2 tabindex="-1">Write the trial you would run, then say how you will copy it</h2>
<p>Your sponsor wants to show FDA that a transcatheter valve device lowers mortality, using a national registry of patients with severe valve disease. Each patient becomes <strong>eligible</strong> on a date (severe disease confirmed, no prior valve procedure). Some receive the device after a waiting list; some die while waiting; some are never scheduled.</p>
<p>A registry analysis is only as clear as the trial it imitates. So write that trial first: the <strong>target trial</strong>. The left column is the protocol you would submit for a randomized trial. The right column says how the registry emulates each row. Choose the target trial entries; the emulation column follows.</p>
<div class="table-wrap"><table class="tt-protocol" id="tt-protocol"><caption>Target trial protocol and its emulation in the registry</caption>
<thead><tr><th scope="col">Protocol component</th><th scope="col">Target trial (what you would randomize)</th><th scope="col">Emulation in the registry</th></tr></thead><tbody>
<tr data-row="elig"><th scope="row">Eligibility</th><td data-col="Target trial"><label><span class="sr-only">Target trial eligibility</span><select id="tt-elig"><option value="new">New users only</option><option value="prevalent">Prior procedures allowed</option></select></label><span class="tt-desc" data-desc="tt-elig"></span></td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="strat"><th scope="row">Treatment strategies</th><td data-col="Target trial"><label><span class="sr-only">Target trial treatment strategies</span><select id="tt-strat"><option value="grace">Procedure within 6 months vs none</option><option value="ever">Ever vs never had the procedure</option></select></label><span class="tt-desc" data-desc="tt-strat"></span></td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="assign"><th scope="row">Assignment</th><td data-col="Target trial">Random assignment at eligibility; unblinded, as device trials usually are.</td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="zero"><th scope="row">Time zero (start of follow-up)</th><td data-col="Target trial"><label><span class="sr-only">Target trial time zero</span><select id="tt-zero-select">${zeroOptions}</select></label><span class="tt-desc" data-desc="tt-zero-select"></span></td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="end"><th scope="row">End of follow-up</th><td data-col="Target trial">Death, loss to follow-up, or one year after time zero, whichever comes first.</td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="outcome"><th scope="row">Outcome</th><td data-col="Target trial">All-cause death within one year.</td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="contrast"><th scope="row">Causal contrast</th><td data-col="Target trial"><label><span class="sr-only">Target trial causal contrast</span><select id="tt-contrast"><option value="pp">Per-protocol effect</option><option value="itt">Intention-to-treat effect</option></select></label><span class="tt-desc" data-desc="tt-contrast"></span></td><td class="tt-emu" data-col="Emulation"></td></tr>
<tr data-row="plan"><th scope="row">Analysis plan</th><td data-col="Target trial">One-year risk in each arm from Kaplan–Meier curves; risk difference; per-protocol analysis adjusts for deviations from the assigned strategy.</td><td class="tt-emu" data-col="Emulation"></td></tr>
</tbody></table></div>
<p class="tt-summary" id="tt-protocol-summary" role="status"></p>
<div class="btns"><button id="tt-fix-all" type="button">Show a protocol that emulates cleanly</button></div>
<p class="note">One rule carries most of the weight: at time zero, three things must happen together. The patient meets the eligibility criteria, is assigned to a strategy, and starts follow-up. In a randomized trial this is automatic. In a registry you have to make it true on purpose.</p>
<p class="note">Reporting now expects this table. The TARGET guideline (JAMA, 2025) asks authors of target trial emulations to report the protocol of the target trial and how each component was emulated. FDA's final device guidance on real-world evidence (December 2025) asks whether registry data are fit for the specific regulatory question; a protocol written before the outcome analysis is how you show what that question is.</p>
</section>

<section class="lab-step" data-title="Move time zero">
<h2 tabindex="-1">Twenty patients, one clock, three places to start it</h2>
<p>These are 20 patients from the simulated registry, drawn on the <em>eligibility</em> clock. In this world the device <strong>truly does nothing</strong> to mortality, and the waiting time is unrelated to how sick anyone is. Any difference between groups is self-inflicted.</p>
<div class="predict" data-options="Treated patients will look better|The groups will look about the same|Treated patients will look worse" data-answer="0" data-hint="Treated patients had to survive the whole wait to be counted as treated, and every death on the waiting list is charged to the untreated group. Switch between (a) and (b) and compare the death rates.">Predict: under choice (b), each treated patient's clock starts on the procedure date and each untreated patient's clock starts at eligibility. With no true effect, what will the death rates show?</div>
${zeroRadios("tt-zero-2")}
<div class="figure" id="tt-lanes-figure"><div class="fig-row"><div>
<svg id="tt-lanes" role="img" aria-label="Swimlanes for 20 registry patients on the eligibility clock. Each lane shows waiting time, the procedure as a diamond, death as a cross and censoring as a tick. A black bar marks each patient's time zero and a grey band the first year of follow-up from it. Under choice (b) and (c) the waiting time of treated patients is hatched as immortal time. Death counts and person-years follow."></svg>
<p class="legend legend-swatches">
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--teal)" stroke-width="6"/>')}Counted as untreated</span>
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--p)" stroke-width="6"/>')}Counted as treated</span>
<span>${sw('<rect x="1" y="1" width="26" height="8" fill="url(#tt-hatch)"/>')}Immortal time</span>
<span>${sw('<rect x="1" y="0" width="26" height="10" fill="var(--grid)"/><line x1="3" y1="0" x2="3" y2="10" stroke="var(--ink)" stroke-width="2.5"/>')}Time zero and first year</span>
<span>${sw('<path d="M9 1l8 8M17 1l-8 8" stroke="var(--red)" stroke-width="2.2"/>')}Death</span>
<span>${sw('<line x1="14" y1="0" x2="14" y2="10" stroke="var(--muted)" stroke-width="1.6"/>')}Censored</span>
<span>${sw('<path d="M14 1l4 4-4 4-4-4z" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.4"/>')}Procedure</span>
</p>
<div id="tt-lane-player"></div></div>
<div><div class="fig-readout" id="tt-lane-readout" aria-live="polite"></div></div></div>
<p class="fig-caption" id="tt-lane-caption"></p></div>
<details><summary>The 20 patients as a table</summary><div id="tt-lane-table"></div></details>
<p>The hatched stretch is <strong>immortal time</strong>: a period during which a patient cannot die <em>and still end up in the treated group</em>, because being treated requires surviving it. Under (b) that time vanishes from the analysis while the deaths that happen during it land in the untreated group. Under (c) it is added to the treated group's person-time. Either way the treated group looks healthier than it is (Suissa, 2008).</p>
</section>

<section class="lab-step" data-title="Compare with the truth">
<h2 tabindex="-1">A benefit made from nothing, measured</h2>
<p>Now use the whole registry: 2,000 simulated patients from the same generator. Because we built the world, we know the truth exactly. The green dashed curve is survival if everyone had the procedure on the eligibility date, and if nobody ever had it; with no true effect those two curves are the same curve.</p>
${zeroRadios("tt-zero-3")}
<div class="tt-controls">
<label>True effect of the procedure <select id="tt-effect"><option value="null">None (hazard ratio 1)</option><option value="benefit">Modest benefit (hazard ratio 0.7 after the procedure)</option></select></label>
<label>Random seed for the registry <input id="tt-seed" type="number" min="1" step="1"></label>
</div>
<div class="figure"><div class="fig-row"><div>
<svg id="tt-km" role="img" aria-label="Kaplan–Meier survival for treated and untreated patients under the chosen time zero, over one year, with the true survival curves as green dashed lines. One-year risks follow in the table."></svg>
<p class="legend legend-swatches">
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--p)" stroke-width="2.5"/>')}Treated, Kaplan–Meier</span>
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--teal)" stroke-width="2.5"/>')}Untreated, Kaplan–Meier</span>
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="6 4"/>')}Truth</span>
</p></div>
<div><div class="fig-readout" id="tt-km-readout"></div></div></div>
<p class="fig-caption" id="tt-km-caption"></p></div>
<div class="figure"><svg id="tt-rd" role="img" aria-label="One-year risk difference, treated minus untreated, from each choice of time zero, against the true risk difference as a green dashed line. Values are listed in the table below."></svg></div>
<div id="tt-km-table"></div>
<details class="formula-details"><summary>Why does (a) land on the truth here, and what does it estimate?</summary>
<p>Under (a) everyone's clock starts at eligibility. A patient contributes untreated person-time until the procedure and treated person-time after it; the treated curve admits patients only from their procedure date onward (delayed entry). Nobody is classified by what happens later.</p>
<p class="math">Ŝ(t) = ∏<sub>tⱼ ≤ t</sub> (1 − dⱼ / nⱼ),&nbsp; nⱼ = #{entry &lt; tⱼ ≤ exit}</p>
<p>It recovers the truth in this world because the death hazard is constant over time and waiting is unrelated to prognosis. It is really a comparison of death <em>rates</em> in treated and not-yet-treated person-time. In real registries, sicker patients may be treated sooner or later, and the effect may depend on when the procedure happens; then this analysis needs adjustment and answers a question that is not quite the protocol's. Step 5 asks what the protocol's question requires.</p></details>
<p class="note">Exact: the truth curves, S(t) = exp(−0.35·t) without the procedure and exp(−0.35·HR·t) with it at eligibility. Simulated: the Kaplan–Meier curves (seeded, n = 2,000). Change the seed to see ordinary sampling noise; the immortal time bias does not go away.</p>
</section>

<section class="lab-step" data-title="Other misalignments">
<h2 tabindex="-1">The same injury, in two other disguises</h2>
<p>Immortal time is the most famous misalignment, but not the only one. Each of these breaks the rule that eligibility, assignment and the start of follow-up coincide.</p>
<div class="tt-grid2">
<div class="figure"><svg id="tt-prevalent" role="img" aria-label="Schematic. Calendar timelines for four patients around the registry start. New users start follow-up at their procedure. Prevalent users had the procedure years earlier and start follow-up at registry entry; a patient who died soon after an early procedure never enters the registry."></svg>
<p class="fig-caption"><strong>Prevalent versus new users (schematic).</strong> Patients implanted before the registry opened enter only if they survived until it opened. Early procedural deaths are invisible, so the device looks safer. A target trial enrolls new users: time zero is the procedure decision, not registry entry.</p></div>
<div class="figure"><svg id="tt-postbase" role="img" aria-label="Schematic. Four treated patients followed from the procedure. Inclusion requires a 30-day echocardiogram, so a patient who died on day 10 is excluded and the first 30 days are immortal for everyone included."></svg>
<p class="fig-caption"><strong>Eligibility from the future (schematic).</strong> “Include treated patients with a 30-day echo on file” uses information recorded after time zero. Anyone who died before day 30 cannot qualify, so the first 30 days of follow-up are immortal.</p></div>
</div>
<div class="predict" data-options="Lower than the true 29.5%|About 29.5%|Higher than 29.5%" data-answer="0" data-hint="Every early death is removed from the treated group by the inclusion rule, while follow-up still starts at the procedure. Move the slider to see how much.">Predict: the device still does nothing and the true one-year risk from the procedure is 29.5%. Among treated patients required to have a 30-day echo, with follow-up from the procedure date, the observed one-year risk will be</div>
<label>Days of post-procedure survival required for inclusion <output id="tt-days-out"></output><input id="tt-days" type="range" min="0" max="90" step="1"></label>
<p class="tt-big" id="tt-days-value" role="status"></p>
<p id="tt-days-caption"></p>
<p class="note">Exact in this constant-hazard world: the selected one-year risk is 1 − exp(−0.35·(1 − d/365.25)) for a required survival of d days. The prevalent-user picture is schematic; in this constant-hazard world early and late risks are equal, so its bias needs early procedural hazard to appear, as real devices have.</p>
</section>

<section class="lab-step" data-title="Fix it, find the gap">
<h2 tabindex="-1">Align time zero, and meet the grace period</h2>
<p>The fix is to start every clock at eligibility. But the protocol's strategies are “procedure <em>within 6 months</em>” and “no procedure”. On the eligibility date, which strategy is a waiting patient following? Both. The 6-month window is a <strong>grace period</strong>, and a patient's strategy only becomes visible as time passes.</p>
<div class="figure" id="tt-grace-figure"><div class="fig-row"><div>
<svg id="tt-grace" role="img" aria-label="Four patients on the eligibility clock with the 6-month grace period shaded. Under each patient, a blue track shows how long they remain compatible with the procedure-within-6-months strategy and a teal track how long they remain compatible with the no-procedure strategy. A sweep line moves through time."></svg>
<p class="legend legend-swatches">
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--p)" stroke-width="4"/>')}Still compatible with A: procedure within 6 months</span>
<span>${sw('<line x1="1" y1="5" x2="27" y2="5" stroke="var(--teal)" stroke-width="4"/>')}Still compatible with B: no procedure</span>
<span>${sw('<rect x="1" y="0" width="26" height="10" fill="var(--or)" opacity=".25"/>')}Grace period</span>
</p>
<div id="tt-grace-player"></div></div>
<div><div class="fig-readout" id="tt-grace-readout" aria-live="polite"></div></div></div>
<p class="fig-caption" id="tt-grace-caption"></p></div>
<p>At time zero all 2,000 patients are compatible with both strategies. Some die in the grace period without a procedure, and they are compatible with both strategies to the end. A conventional analysis has to put them somewhere.</p>
<div class="predict" data-options="The procedure will look protective|The comparison will be about right|The procedure will look harmful" data-answer="0" data-hint="Treated-within-6-months patients had to survive until their procedure, while the no-procedure arm collects every early death. That is immortal time again, now capped at 6 months.">Predict: you start everyone's clock at eligibility, but you assign patients who die untreated during the grace period to the no-procedure arm. With no true effect, the procedure will look</div>
<label>Untreated patients who die or are lost during the grace period go to <select id="tt-grace-deaths"><option value="none">the no-procedure arm</option><option value="procedure">the procedure-within-6-months arm</option></select></label>
<div id="tt-grace-table"></div>
<p id="tt-grace-verdict" class="warning"></p>
<p>Neither arm is right, because these patients belong to <strong>both</strong>. The way out is to stop forcing a choice at time zero: <strong>clone</strong> each patient into both arms, <strong>censor</strong> each copy when its data stop following that arm's strategy, and <strong>weight</strong> the remaining copies so the censoring does not select a healthier or sicker group. In this simulated world waiting time is unrelated to prognosis, so censoring happens to be harmless; in a real registry, who gets the procedure and when depends on how sick they are, and the weights carry that load.</p>
<details class="formula-details"><summary>What about a landmark analysis?</summary><p>Classifying patients by their status at 6 months and starting follow-up at 6 months among survivors also removes immortal time. It emulates a different trial: one that enrolls patients alive 6 months after eligibility and ignores the deaths that happen before. That is a legitimate question, but not the protocol you wrote in step 1.</p></details>
<p class="note">Counts and risks here come from the same seeded 2,000-patient registry as step 3, always under no true effect. The four patients in the figure are from the 20 in step 2.</p>
<a class="course-btn" id="tt-next" href="#">Next lesson: Clone, censor, weight →</a>
</section>`;

  /* ---------- controls ---------- */
  control(byId("tt-elig"), state, "elig");
  control(byId("tt-strat"), state, "strat");
  control(byId("tt-zero-select"), state, "zero");
  control(byId("tt-contrast"), state, "contrast");
  control(byId("tt-effect"), state, "effect");
  control(byId("tt-seed"), state, "seed");
  control(byId("tt-days"), state, "days");
  control(byId("tt-grace-deaths"), state, "graceDeaths");
  root.querySelectorAll('.tt-zero input[type=radio]').forEach((r) => {
    r.addEventListener("change", () => r.checked && state.set({ zero: r.value }));
  });
  const syncRadios = () =>
    root.querySelectorAll('.tt-zero input[type=radio]').forEach((r) => (r.checked = r.value === state.get().zero));
  byId("tt-fix-all").onclick = () =>
    state.set({ elig: "new", strat: "grace", zero: "aligned", contrast: "pp" });
  // The next lesson is built separately; link it through the curriculum registry.
  const nextUnit = (window.CausalCurriculum?.chapters || [])
    .flatMap((ch) => ch.units)
    .find((u) => u.id === "clone-censor-weight");
  byId("tt-next").href = nextUnit?.file || "19-clone-censor-weight.html";

  /* ---------- step 1: protocol table ---------- */
  function protocol(c) {
    const rows = {
      elig:
        c.elig === "new"
          ? ["ok", "Registry patients on the first date all criteria are met, using only information recorded on or before that date."]
          : ["bad", "Patients who had a procedure before the registry opened enter only if they survived until then. Their early deaths are missing (step 4)."],
      strat:
        c.strat === "grace"
          ? ["warn", "Classify from registry procedure dates. A patient alive and untreated at month 4 is still consistent with both strategies (step 5)."]
          : ["bad", "“Ever treated” is defined by the future. Nobody can be assigned to it at time zero, and anyone who dies early can never qualify as treated."],
      assign: ["ok", "Not randomized. Assume the arms are exchangeable given baseline covariates measured at eligibility. In this teaching world waiting time is unrelated to prognosis by design, so no adjustment is needed."],
      zero:
        c.zero === "aligned"
          ? ["ok", "The eligibility date for every patient: eligibility, assignment and start of follow-up coincide."]
          : c.zero === "procedure"
            ? ["bad", "Treated patients start at their procedure, untreated at eligibility. Waiting time becomes immortal time and waiting-list deaths are charged to the untreated (step 2)."]
            : ["bad", "Clocks start at eligibility, but the groups are defined by later treatment, so waiting time is credited to the treated group as immortal time (step 2)."],
      end: ["ok", "Death from registry linkage; loss to follow-up when contact stops; administrative end of data 2 years after eligibility."],
      outcome: ["ok", "Date of death from linkage; one-year risk from time zero."],
      contrast:
        c.contrast === "pp"
          ? ["ok", "Estimable: follow each patient while their data are consistent with a strategy, and adjust for the deviations (next lesson)."]
          : ["warn", "Nobody is assigned a strategy in a registry. The observational analogue of intention-to-treat is the effect of starting treatment at time zero, and here nobody starts on the eligibility date. The per-protocol effect is the one to emulate."],
      plan:
        c.zero === "aligned"
          ? ["ok", "Start every clock at eligibility. Handle the grace period by cloning, censoring and weighting (step 5 and the next lesson)."]
          : ["bad", "The planned clock credits waiting time to one group. Fix the time zero row first."],
    };
    const desc = {
      "tt-elig": c.elig === "new" ? "Severe valve disease newly confirmed, no prior valve procedure, anatomically suitable for the device." : "Everyone in the registry, including patients who already had a valve procedure before it opened.",
      "tt-strat": c.strat === "grace" ? "A: receive the procedure within 6 months of eligibility. B: no procedure during follow-up." : "Compare patients who ever received the procedure with those who never did.",
      "tt-zero-select": c.zero === "aligned" ? "In the trial this is the randomization date, which is the eligibility date." : "In a randomized trial nobody would start the clock this way; the choice is here because registry analyses often do.",
      "tt-contrast": c.contrast === "pp" ? "The effect of following each strategy as written, adjusting for deviations." : "The effect of being assigned a strategy, whatever happens next.",
    };
    root.querySelectorAll("[data-desc]").forEach((e) => (e.textContent = desc[e.dataset.desc]));
    const labels = { ok: "Emulates the protocol", warn: "Needs care", bad: "Misaligned" };
    let ok = 0;
    const issues = [];
    byId("tt-protocol").querySelectorAll("tbody tr").forEach((tr) => {
      const [kind, text] = rows[tr.dataset.row];
      tr.className = kind;
      tr.querySelector(".tt-emu").innerHTML = `${esc(text)}<span class="tt-flag ${kind}">${kind === "ok" ? "✓" : kind === "warn" ? "!" : "✗"} ${labels[kind]}</span>`;
      if (kind === "ok") ok++;
      else if (kind === "bad") issues.push(tr.querySelector("th").textContent.toLowerCase());
    });
    byId("tt-protocol-summary").textContent =
      `${ok} of 8 rows emulate the protocol directly. ` +
      (issues.length
        ? `Misaligned: ${issues.join(", ")}.`
        : "No row is misaligned; the treatment strategies row still needs the grace-period machinery of step 5.");
  }

  /* ---------- step 2: swimlanes ---------- */
  const lanes = T.lanes(),
    H = T.DEFAULTS.horizon,
    order = [
      ...lanes.filter((r) => r.proc).sort((a, b) => a.W - b.W),
      ...lanes.filter((r) => !r.proc).sort((a, b) => a.end - b.end),
    ],
    nTreated = lanes.filter((r) => r.proc).length;
  const LW = phone ? 400 : 680,
    L = { l: 18, r: 18, top: 38, lane: phone ? 19 : 17, gap: 34 },
    xMax = T.DEFAULTS.admin,
    lx = (t) => L.l + (Math.min(t, xMax) / xMax) * (LW - L.l - L.r),
    laneY = (i) => L.top + i * L.lane + (i >= nTreated ? L.gap : 0) + L.lane / 2,
    LH = laneY(order.length - 1) + L.lane / 2 + 48;
  const lsvg = byId("tt-lanes");
  lsvg.setAttribute("viewBox", `0 0 ${LW} ${LH}`);
  lsvg.classList.add("fig", "fig-wide");
  const g = (cls) => el("g", { class: cls || "" });
  const axisG = g(),
    windowG = g(),
    railG = g(),
    segG = g(),
    markG = g(),
    cursorG = g();
  lsvg.append(axisG, windowG, railG, segG, markG, cursorG);
  axisG.append(
    el("text", { class: "tt-lane-head", x: L.l, y: L.top - 10 }, `Had the procedure during follow-up (${nTreated})`),
    el("text", { class: "tt-lane-head", x: L.l, y: laneY(nTreated) - L.lane / 2 - 10 }, `No procedure during follow-up (${order.length - nTreated})`),
  );
  const axisY = LH - 34;
  axisG.append(el("line", { class: "axis", x1: lx(0), x2: lx(xMax), y1: axisY, y2: axisY }));
  [0, 0.5, 1, 1.5, 2].forEach((v) => {
    axisG.append(
      el("line", { class: "grid", x1: lx(v), x2: lx(v), y1: L.top - 4, y2: axisY }),
      el("text", { class: "tick", x: lx(v), y: axisY + 16, "text-anchor": v === 0 ? "start" : v === 2 ? "end" : "middle" }, fmt(v, 1)),
    );
  });
  axisG.append(el("text", { class: "axis-label", x: LW / 2, y: axisY + 32, "text-anchor": "middle" }, "Years since eligibility"));
  const laneEls = order.map((r, i) => {
    const y = laneY(i),
      e = {
        r,
        y,
        window: el("rect", { class: "tt-window", y: y - 7, height: 14 }),
        hatch: el("rect", { y: y - 4, height: 8, fill: "url(#tt-hatch)" }),
        u: el("line", { class: "tt-seg-u", y1: y, y2: y }),
        t: el("line", { class: "tt-seg-t", y1: y, y2: y }),
        zero: el("line", { class: "tt-zero-bar", y1: y - 7, y2: y + 7 }),
        cursor: el("circle", { class: "tt-cursor", cy: y, r: 3 }),
        ring: el("circle", { class: "tt-counted", cy: y, r: 7, cx: lx(r.T) }),
      };
    windowG.append(e.window);
    railG.append(el("line", { class: "tt-rail", x1: lx(0), x2: lx(r.end), y1: y, y2: y }));
    segG.append(e.u, e.t, e.hatch);
    if (r.proc) {
      const x = lx(r.W);
      markG.append(el("path", { class: "tt-proc", d: `M${x} ${y - 5}l5 5-5 5-5-5z` }));
    }
    if (r.died) {
      const x = lx(r.T);
      markG.append(el("path", { class: "tt-death", d: `M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8` }), e.ring);
    } else {
      const x = lx(r.end);
      markG.append(el("line", { class: "tt-cens", x1: x, x2: x, y1: y - 6, y2: y + 6 }));
    }
    markG.append(e.zero);
    cursorG.append(e.cursor);
    return e;
  });
  const laneZero = (r, kind) => (kind === "procedure" && r.proc ? r.W : 0);
  let laneState = null,
    laneTween = null,
    laneT = 0;
  function setX(node, a, b) {
    node.setAttribute("x1", lx(a));
    node.setAttribute("x2", lx(Math.max(a, b)));
  }
  function drawLanes(zeros, kind) {
    laneEls.forEach((e, i) => {
      const r = e.r,
        z = zeros[i],
        wEnd = Math.min(z + H, r.end);
      e.window.setAttribute("x", lx(z));
      e.window.setAttribute("width", Math.max(0, lx(z + H) - lx(z)));
      e.zero.setAttribute("x1", lx(z));
      e.zero.setAttribute("x2", lx(z));
      const immortal = r.proc && kind !== "aligned";
      e.hatch.style.display = immortal ? "" : "none";
      if (immortal) {
        e.hatch.setAttribute("x", lx(0));
        e.hatch.setAttribute("width", lx(r.W) - lx(0));
      }
      if (r.proc) {
        e.u.style.display = kind === "aligned" ? "" : "none";
        setX(e.u, 0, r.W);
        setX(e.t, kind === "ever" ? 0 : r.W, r.end);
        e.t.style.display = "";
        e.t.classList.toggle("faint", false);
      } else {
        e.u.style.display = "";
        setX(e.u, 0, r.end);
        e.t.style.display = "none";
      }
      // Analysis-clock cursor: each patient's own time zero plus the shared analysis time.
      const cx = z + laneT * H;
      e.cursor.setAttribute("cx", lx(Math.min(cx, r.end)));
      e.cursor.style.display = cx <= r.end + 1e-9 ? "" : "none";
      // Ring the deaths that the chosen analysis has counted by this analysis time.
      const counted = r.died && r.T <= z + laneT * H && r.T >= z;
      e.ring.style.display = counted ? "" : "none";
      void wEnd;
    });
  }
  function laneReadout(kind) {
    const tl = T.tally(lanes, kind, laneT * H),
      row = (name, s) => [
        html("span", { class: "k" }, name),
        html("span", {}, `${s.deaths} deaths / ${fmt(s.years, 2)} person-years = ${Number.isFinite(s.rate) ? fmt(s.rate, 2) : "undefined"} per year`),
      ];
    byId("tt-lane-readout").replaceChildren(
      html("span", { class: "k" }, "Analysis time"),
      html("span", {}, `${fmt(laneT * 12, 1)} months after each time zero`),
      ...row("Treated", tl.treated),
      ...row("Untreated", tl.untreated),
      html("span", { class: "k" }, "Rate ratio"),
      html("span", {}, Number.isFinite(tl.ratio) ? fmt(tl.ratio, 2) + " (truth: 1)" : "undefined yet"),
    );
    return tl;
  }
  const lanePlayer = player(byId("tt-lane-player"), {
    duration: 7000,
    label: "Analysis clock",
    formatValue: (t) => fmt(t * 12, 1) + " months",
    onT(t) {
      laneT = t;
      if (laneState) {
        drawLanes(laneState, state.get().zero);
        laneReadout(state.get().zero);
      }
    },
  });
  let lastKind = null;
  function renderLanes(kind) {
    const target = order.map((r) => laneZero(r, kind));
    if (!laneState || kind === lastKind) {
      laneState = target;
      drawLanes(target, kind);
    } else {
      laneTween?.cancel();
      const from = laneState.slice();
      laneTween = tween({
        duration: 650,
        onUpdate(u) {
          laneState = from.map((v, i) => lerp(v, target[i], u));
          drawLanes(laneState, kind);
        },
      });
    }
    lastKind = kind;
    const tl = laneReadout(kind),
      full = T.tally(lanes, kind, H),
      waitDeaths = lanes.filter((r) => r.W < Infinity && !r.proc && r.died && r.T <= H).length,
      immortal = lanes.filter((r) => r.proc).reduce((a, r) => a + Math.min(r.W, H), 0);
    void tl;
    byId("tt-lane-caption").textContent =
      kind === "aligned"
        ? `(a) Every clock starts at eligibility. Waiting time counts as untreated until the procedure, then as treated. Over the first year the death rates are ${fmt(full.treated.rate, 2)} and ${fmt(full.untreated.rate, 2)} per person-year: a rate ratio of ${fmt(full.ratio, 2)}, close to the truth of 1.`
        : kind === "procedure"
          ? `(b) Treated clocks start at the procedure. The ${fmt(immortal * 12, 0)} person-months of waiting (hatched) leave the analysis, and the ${waitDeaths} patients who died on the waiting list within the first year count only as untreated. Rate ratio ${fmt(full.ratio, 2)}: a large benefit from a device that does nothing.`
          : `(c) Every clock starts at eligibility but groups are fixed by later treatment. The hatched waiting time, ${fmt(immortal * 12, 0)} person-months in which no treated patient can die, is credited to the treated group. Rate ratio ${fmt(full.ratio, 2)}.`;
  }
  byId("tt-lane-table").innerHTML = table(
    ["Patient", "Waiting time (months)", "Procedure", "Exit (months)", "Exit reason"],
    order.map((r, i) => [
      String(i + 1),
      r.W === Infinity ? "never scheduled" : fmt(r.W * 12, 1),
      r.proc ? "yes" : "no",
      fmt(r.end * 12, 1),
      r.died ? (r.proc ? "died after procedure" : r.W < Infinity ? "died while waiting" : "died, never scheduled") : r.C >= xMax ? "end of data" : "lost to follow-up",
    ]),
    "Swimlane patients, top to bottom (fixed seed); times from eligibility, shown up to the 24-month end of data",
  );

  /* ---------- step 3: Kaplan–Meier against the truth ---------- */
  const cache = new Map();
  const studyFor = (c) => {
    const key = c.seed + ":" + c.effect;
    if (!cache.has(key)) {
      if (cache.size > 6) cache.clear();
      cache.set(key, T.study({ seed: c.seed, hr: HR[c.effect] }));
    }
    return cache.get(key);
  };
  const kmSvg = byId("tt-km");
  const KP = new Plot(kmSvg, {
    x: [0, 1],
    y: [0.4, 1],
    width: phone ? 440 : 600,
    height: 330,
    margin: { l: phone ? 52 : 50, r: phone ? 150 : 142, t: 26, b: 46 },
    xticks: [0, 0.25, 0.5, 0.75, 1],
    yticks: [0.4, 0.6, 0.8, 1],
    xTickFormat: (v) => fmt(v * 12, 0),
    yTickFormat: (v) => fmt(v * 100, 0) + "%",
    xlabel: "Months since time zero",
    ylabel: "Alive",
  });
  const truth0 = KP.line([[0, 1]], { stroke: "var(--green)", "stroke-dasharray": "7 5", "stroke-width": 2.5 }),
    truth1 = KP.line([[0, 1]], { stroke: "var(--green)", "stroke-dasharray": "2 4", "stroke-width": 2.5 }),
    kmU = KP.step([[0, 1]], { stroke: "var(--teal)" }),
    kmT = KP.step([[0, 1]], { stroke: "var(--p)" }),
    endLabels = KP.layer();
  const rdSvg = byId("tt-rd");
  function drawRD(s, kind) {
    const W = phone ? 420 : 600,
      rows = T.ANALYSES,
      Hh = 40 + rows.length * 34 + 36;
    rdSvg.setAttribute("viewBox", `0 0 ${W} ${Hh}`);
    rdSvg.classList.add("fig", "fig-wide");
    rdSvg.replaceChildren();
    const lo = -0.35,
      hi = 0.1,
      x0 = phone ? 170 : 190,
      x1 = W - (phone ? 84 : 70),
      sx = (v) => x0 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (x1 - x0),
      top = 30,
      bottom = top + rows.length * 34;
    rdSvg.append(el("text", { class: "axis-label", x: 12, y: 20 }, phone ? "Risk difference at 1 year (pp)" : "Risk difference at 1 year, treated − untreated (pp)"));
    [-0.3, -0.2, -0.1, 0, 0.1].forEach((v) =>
      rdSvg.append(
        el("line", { class: "grid", x1: sx(v), x2: sx(v), y1: top, y2: bottom }),
        el("text", { class: "tick", x: sx(v), y: bottom + 16, "text-anchor": "middle" }, fmt(v * 100, 0)),
      ),
    );
    const tx = sx(s.truth.rd);
    rdSvg.append(
      el("line", { x1: tx, x2: tx, y1: top - 6, y2: bottom + 2, stroke: "var(--green)", "stroke-width": 2, "stroke-dasharray": "6 4" }),
      el("text", { class: "ref-label", x: tx + 5, y: top - 8, fill: "var(--green)" }, "truth " + pp(s.truth.rd)),
    );
    const short = { aligned: "(a) eligibility", procedure: "(b) procedure date", ever: "(c) ever treated" };
    rows.forEach((k, i) => {
      const y = top + 17 + i * 34,
        v = s.analyses[k].rd,
        colour = k === "aligned" ? "var(--purple)" : "var(--or)";
      rdSvg.append(
        el("text", { class: "fig-text ink", x: 12, y: y + 4, "font-weight": k === kind ? 600 : 400 }, short[k]),
        el("line", { x1: sx(s.truth.rd), x2: sx(v), y1: y, y2: y, stroke: colour, "stroke-width": 2, opacity: 0.5 }),
        el("circle", { cx: sx(v), cy: y, r: k === kind ? 8 : 6, fill: colour, stroke: k === kind ? "var(--ink)" : "var(--paper)", "stroke-width": 2 }),
        el("text", { class: "fig-text", x: W - 10, y: y + 4, "text-anchor": "end", fill: colour }, pp(v)),
      );
    });
  }
  function renderKM(c) {
    const s = studyFor(c),
      a = s.analyses[c.zero],
      grid = Array.from({ length: 101 }, (_, i) => i / 100);
    truth0.setAttribute("d", KP.d(grid.map((t) => [t, s.truth.S0(t)])));
    truth1.setAttribute("d", KP.d(grid.map((t) => [t, s.truth.S1(t)])));
    truth1.style.display = c.effect === "null" ? "none" : "";
    const stepD = (pts) => {
      let d = "";
      pts.forEach((p, i) => {
        const X = fmt(KP.sx(p[0]), 2),
          Y = fmt(KP.sy(p[1]), 2);
        d += i ? ` H${X} V${Y}` : `M${X},${Y}`;
      });
      return d;
    };
    kmT.setAttribute("d", stepD(a.treated.km.points));
    kmU.setAttribute("d", stepD(a.untreated.km.points));
    // End labels outside the plot, spaced so they never overlap.
    const items = [
      { y: 1 - a.treated.risk, text: `Treated ${pct(a.treated.risk)}`, fill: "var(--p)" },
      { y: 1 - a.untreated.risk, text: `Untreated ${pct(a.untreated.risk)}`, fill: "var(--teal)" },
      { y: 1 - s.truth.r0, text: c.effect === "null" ? `Truth ${pct(s.truth.r0)}` : `True, none ${pct(s.truth.r0)}`, fill: "var(--green)" },
    ];
    if (c.effect !== "null") items.push({ y: 1 - s.truth.r1, text: `True, device ${pct(s.truth.r1)}`, fill: "var(--green)" });
    items.forEach((it) => (it.py = KP.sy(it.y) + 4));
    items.sort((p, q) => p.py - q.py);
    for (let i = 1; i < items.length; i++) items[i].py = Math.max(items[i].py, items[i - 1].py + 16);
    const overflow = items.at(-1).py - (KP.H - KP.m.b + 4);
    if (overflow > 0) items.forEach((it) => (it.py -= overflow));
    endLabels.replaceChildren(
      el("text", { class: "fig-text", x: KP.sx(1) + 8, y: KP.m.t - 8 }, "1-year risk"),
      ...items.map((it) => el("text", { class: "fig-text", x: KP.sx(1) + 8, y: it.py, fill: it.fill }, it.text)),
    );
    drawRD(s, c.zero);
    byId("tt-km-readout").replaceChildren(
      ...[
        ["Time zero", zeroNames[c.zero]],
        ["Treated", `${a.treated.n} patients, ${a.treated.deaths} deaths by 1 year`],
        ["Untreated", `${a.untreated.n} patients, ${a.untreated.deaths} deaths by 1 year`],
        ["Risk difference", pp(a.rd)],
        ["True difference", pp(s.truth.rd)],
        ["Error", pp(a.rd - s.truth.rd)],
      ].flatMap(([k, v]) => [html("span", { class: "k" }, k), html("span", {}, v)]),
    );
    const bias = a.rd - s.truth.rd;
    byId("tt-km-caption").textContent =
      c.zero === "aligned"
        ? `With every clock at eligibility, treated and untreated curves track the truth: risk difference ${pp(a.rd)} against a true ${pp(s.truth.rd)}. The remaining gap is sampling noise.`
        : `This choice reports a one-year risk difference of ${pp(a.rd)} against a true ${pp(s.truth.rd)}: ${fmt(Math.abs(bias) * 100, 1)} percentage points of ${c.effect === "null" ? "benefit manufactured from nothing" : "extra benefit on top of the real one"}. The untreated curve absorbs every death on the waiting list.`;
    byId("tt-km-table").innerHTML = table(
      ["Time zero", "Treated risk", "Untreated risk", "Difference", "Error vs truth"],
      [
        ...T.ANALYSES.map((k) => {
          const x = s.analyses[k];
          return [zeroNames[k], pct(x.treated.risk), pct(x.untreated.risk), pp(x.rd), pp(x.rd - s.truth.rd)];
        }),
        ["Truth (exact)", pct(s.truth.r1), pct(s.truth.r0), pp(s.truth.rd), "0"],
      ],
      `One-year risks, Kaplan–Meier, seed ${c.seed}, n = ${s.counts.n}: ${s.counts.treated} had the procedure, ${s.counts.diedWaiting} died while waiting, ${s.counts.neverScheduled} were never scheduled`,
    );
  }

  /* ---------- step 4: schematics and the exact post-baseline calculation ---------- */
  function schematic(svg, spec) {
    const W = 360,
      Hs = 40 + spec.lanes.length * 34 + 44,
      sx = (v) => 20 + ((v - spec.x[0]) / (spec.x[1] - spec.x[0])) * (W - 40);
    svg.setAttribute("viewBox", `0 0 ${W} ${Hs}`);
    svg.classList.add("fig", "fig-narrow");
    const bottom = 40 + spec.lanes.length * 34;
    if (spec.band) svg.append(el("rect", { x: sx(spec.band[0]), y: 26, width: sx(spec.band[1]) - sx(spec.band[0]), height: bottom - 26, fill: "url(#tt-hatch)", opacity: 0.55 }));
    if (spec.vline) {
      svg.append(
        el("line", { x1: sx(spec.vline[0]), x2: sx(spec.vline[0]), y1: 22, y2: bottom, stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }),
        el("text", { class: "fig-text", x: sx(spec.vline[0]) + (spec.vline[2] === "end" ? -4 : 4), y: 16, "text-anchor": spec.vline[2] || "start" }, spec.vline[1]),
      );
    }
    spec.lanes.forEach((ln, i) => {
      const y = 44 + i * 34;
      svg.append(el("line", { x1: sx(ln.from), x2: sx(ln.to), y1: y, y2: y, stroke: ln.ghost ? "var(--muted)" : "var(--p)", "stroke-width": ln.ghost ? 2 : 5, "stroke-dasharray": ln.ghost ? "4 4" : null }));
      if (ln.zero !== undefined) svg.append(el("line", { x1: sx(ln.zero), x2: sx(ln.zero), y1: y - 8, y2: y + 8, stroke: "var(--ink)", "stroke-width": 2.5 }));
      if (ln.proc !== undefined) {
        const x = sx(ln.proc);
        svg.append(el("path", { d: `M${x} ${y - 5}l5 5-5 5-5-5z`, fill: "var(--paper)", stroke: "var(--ink)", "stroke-width": 1.5 }));
      }
      if (ln.death !== undefined) {
        const x = sx(ln.death);
        svg.append(el("path", { d: `M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8`, stroke: "var(--red)", "stroke-width": 2.2 }));
      }
      svg.append(el("text", { class: "fig-text tt-halo", x: 20, y: y - 10 }, ln.label));
    });
    svg.append(
      el("line", { class: "axis", x1: 20, x2: W - 20, y1: bottom + 6, y2: bottom + 6 }),
      el("text", { class: "axis-label", x: W / 2, y: bottom + 30, "text-anchor": "middle" }, spec.xlabel),
    );
  }
  schematic(byId("tt-prevalent"), {
    x: [0, 10],
    vline: [5, "registry opens", "start"],
    xlabel: "Calendar time (schematic)",
    lanes: [
      { from: 6, to: 9.6, proc: 6, zero: 6, label: "new user: starts at procedure" },
      { from: 1.5, to: 9.6, proc: 1.5, zero: 5, label: "prevalent: starts at entry" },
      { from: 2.5, to: 3.3, proc: 2.5, death: 3.3, ghost: true, label: "died early: never enters" },
      { from: 7, to: 7.8, proc: 7, zero: 7, death: 7.8, label: "new user: early death counted" },
    ],
  });
  schematic(byId("tt-postbase"), {
    x: [0, 120],
    band: [0, 30],
    vline: [30, "30-day echo required", "start"],
    xlabel: "Days since procedure (schematic)",
    lanes: [
      { from: 0, to: 118, proc: 0, zero: 0, label: "included" },
      { from: 0, to: 10, proc: 0, death: 10, ghost: true, label: "died on day 10: excluded" },
      { from: 0, to: 75, proc: 0, zero: 0, death: 75, label: "included, death counted" },
      { from: 0, to: 118, proc: 0, zero: 0, label: "included" },
    ],
  });
  function renderDays(c) {
    const r = T.postBaselineRisk({}, c.days);
    byId("tt-days-out").textContent = ` ${c.days} days`;
    byId("tt-days-value").textContent = `Observed ${pct(r.selected)} vs true ${pct(r.honest)}`;
    byId("tt-days-caption").textContent =
      c.days === 0
        ? "With no survival requirement, follow-up from the procedure gives the true one-year risk."
        : `Requiring ${c.days} days of survival removes ${fmt((r.honest - r.selected) * 100, 1)} percentage points of one-year risk from the treated group, with no true effect. Add the waiting-list immortal time of step 2 and the two biases stack.`;
  }

  /* ---------- step 5: the grace period ---------- */
  const graceIds = [
    order.find((r) => r.proc && r.W < 0.5 && !r.died) || order.find((r) => r.proc && r.W < 0.5),
    order.find((r) => r.proc && r.W > 0.5 && r.W < 1),
    order.find((r) => !r.proc && r.W < Infinity && r.died && r.T < 0.5),
    order.find((r) => !r.proc && !r.died),
  ].filter(Boolean);
  const graceNames = ["Procedure at month ", "Procedure at month ", "Died waiting, month ", "Never treated, alive"];
  const GW = phone ? 400 : 600,
    GL = { l: 16, r: 16, top: 52, lane: phone ? 84 : 62 },
    gx = (t) => GL.l + (Math.min(Math.max(t, 0), 1) / 1) * (GW - GL.l - GL.r),
    GH = GL.top + graceIds.length * GL.lane + 44,
    gsvg = byId("tt-grace"),
    grace = T.DEFAULTS.grace;
  gsvg.setAttribute("viewBox", `0 0 ${GW} ${GH}`);
  gsvg.classList.add("fig", "fig-wide");
  const gBottom = GL.top + graceIds.length * GL.lane;
  gsvg.append(
    el("rect", { class: "tt-grace", x: gx(0), y: GL.top - 38, width: gx(grace) - gx(0), height: gBottom - GL.top + 16 }),
    el("text", { class: "fig-text", x: gx(0) + 4, y: GL.top - 20 }, "grace period: first 6 months"),
    el("line", { class: "axis", x1: gx(0), x2: gx(1), y1: gBottom + 4, y2: gBottom + 4 }),
    el("text", { class: "axis-label", x: GW / 2, y: gBottom + 38, "text-anchor": "middle" }, "Months since eligibility (time zero for everyone)"),
  );
  [0, 3, 6, 9, 12].forEach((m) =>
    gsvg.append(el("text", { class: "tick", x: gx(m / 12), y: gBottom + 20, "text-anchor": m === 0 ? "start" : m === 12 ? "end" : "middle" }, m)),
  );
  const tracks = graceIds.map((r, i) => {
    const y = GL.top + i * GL.lane + 22,
      name = graceNames[i] + (i < 2 ? fmt(r.W * 12, 1) : i === 2 ? fmt(r.T * 12, 1) : "");
    gsvg.append(
      el("text", { class: "fig-text ink", x: gx(0), y: y - 10 }, name),
      el("line", { class: "tt-rail", x1: gx(0), x2: gx(Math.min(r.end, 1)), y1: y, y2: y }),
    );
    if (r.proc) {
      const x = gx(r.W);
      gsvg.append(el("path", { class: "tt-proc", d: `M${x} ${y - 5}l5 5-5 5-5-5z` }));
    }
    if (r.died && r.T <= 1) {
      const x = gx(r.T);
      gsvg.append(el("path", { class: "tt-death", d: `M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8` }));
    }
    const a = el("line", { class: "tt-track-a", y1: y + 11, y2: y + 11, x1: gx(0) }),
      b = el("line", { class: "tt-track-b", y1: y + 18, y2: y + 18, x1: gx(0) }),
      tag = phone
        ? el("text", { class: "fig-text tt-halo", x: gx(0), y: y + 40 })
        : el("text", { class: "fig-text tt-halo", x: gx(1) - 8, y: y - 10, "text-anchor": "end" });
    gsvg.append(a, b, tag);
    return { r, a, b, tag };
  });
  const sweep = el("line", { class: "tt-sweep", y1: GL.top - 16, y2: gBottom + 4 });
  gsvg.append(sweep);
  // How long a patient stays compatible with each strategy, on the eligibility clock.
  const aUntil = (r) => (r.proc && r.W <= grace ? r.end : Math.min(r.end, grace, r.proc ? r.W : Infinity)),
    bUntil = (r) => Math.min(r.end, r.proc ? r.W : Infinity);
  const statusText = { both: "compatible with A and B", A: "follows A only", B: "follows B only", neither: "follows neither" };
  let graceT = 0;
  const rows2000 = () => studyFor({ seed: T.DEFAULTS.seed, effect: "null" }).rows;
  function drawGrace() {
    const t = graceT;
    sweep.setAttribute("x1", gx(t));
    sweep.setAttribute("x2", gx(t));
    tracks.forEach(({ r, a, b, tag }) => {
      const au = Math.min(aUntil(r), t, 1),
        bu = Math.min(bUntil(r), t, 1);
      a.setAttribute("x2", gx(au));
      b.setAttribute("x2", gx(bu));
      const s = T.status(r, t);
      tag.textContent = (r.end <= t ? (r.died ? "died: " : "lost: ") : "") + statusText[s];
    });
    const comp = T.compatibility(rows2000(), t);
    byId("tt-grace-readout").replaceChildren(
      ...[
        ["Time since eligibility", fmt(t * 12, 1) + " months"],
        ["Both, still in follow-up", String(comp.both - comp.bothEnded)],
        ["Both, died or lost", String(comp.bothEnded)],
        ["Follow A only", String(comp.A)],
        ["Follow B only", String(comp.B)],
        ["Follow neither", String(comp.neither)],
      ].flatMap(([k, v]) => [html("span", { class: "k" }, k), html("span", {}, v)]),
    );
    byId("tt-grace-caption").textContent =
      t === 0
        ? "At time zero, every one of the 2,000 registry patients is compatible with both strategies. Nobody can be assigned yet."
        : t < grace
          ? `At month ${fmt(t * 12, 1)}, ${comp.A} patients have had the procedure and follow A; ${comp.both - comp.bothEnded} are alive, untreated and still compatible with both; ${comp.bothEnded} died or were lost while compatible with both.`
          : `After 6 months, ${comp.bothEnded} patients died or were lost untreated inside the grace period. Their data fit both strategies to the end.`;
  }
  const gracePlayer = player(byId("tt-grace-player"), {
    duration: 8000,
    label: "Eligibility clock",
    formatValue: (t) => fmt(t * 12, 1) + " months",
    onT(t) {
      graceT = t;
      drawGrace();
    },
  });
  function renderGrace(c) {
    const rows = rows2000(),
      tr = T.truth({ hr: 1 }),
      counts = T.graceCounts(rows),
      a = T.analyse(rows, c.graceDeaths === "none" ? "grace" : "graceToProcedure");
    byId("tt-grace-table").innerHTML = table(
      ["Arm", "Patients", "Deaths by 1 year", "One-year risk", "Truth"],
      [
        ["A: procedure within 6 months", String(a.treated.n), String(a.treated.deaths), pct(a.treated.risk), pct(tr.r1)],
        ["B: no procedure", String(a.untreated.n), String(a.untreated.deaths), pct(a.untreated.risk), pct(tr.r0)],
        ["A − B", "", "", pp(a.rd), pp(tr.rd)],
      ],
      `Clock at eligibility for everyone; ${counts.diedInGraceUntreated + counts.censoredInGraceUntreated} patients died (${counts.diedInGraceUntreated}) or were lost (${counts.censoredInGraceUntreated}) untreated inside the grace period`,
    );
    byId("tt-grace-verdict").textContent =
      c.graceDeaths === "none"
        ? `Sent to the no-procedure arm, the grace-period deaths make the procedure look protective: ${pp(a.rd)} against a truth of 0. Treated patients still had to survive until their procedure.`
        : `Sent to the procedure arm, the same deaths make the procedure look harmful: ${pp(a.rd)} against a truth of 0. Now the no-procedure arm is guaranteed to survive 6 months.`;
  }

  function render() {
    const c = state.get();
    syncRadios();
    protocol(c);
    renderLanes(c.zero);
    renderKM(c);
    renderDays(c);
    renderGrace(c);
  }
  guided(root, state);
  tools(root, state);
  state.subscribe(render);
  render();
  drawGrace();
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail.name === "target-trial") {
      lanePlayer.set(0);
      gracePlayer.set(0);
    }
  });
})();
