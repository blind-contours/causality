/* Lesson 23: targeted survival curves and ΔRMST. All numbers come from science/targeted-survival.js
 * (live, seeded) or science/targeted-survival-data.json (precomputed repeated samples). */
(function () {
  const { store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player, tween } = CausalAnim,
    TS = CausalTargetedSurvival,
    K = TS.K,
    root = document.querySelector('[data-lab="targeted-survival"]'),
    byId = (id) => document.getElementById(id),
    SEED = 20260925,
    N = 1000,
    state = store(
      "targeted-survival",
      { step: 0, seed: SEED, s3event: "right", drEvent: "right", drNuis: "right", drTarget: "s1", tau: 12 },
      {
        step: [0, 4],
        seed: [1, 4294967295],
        s3event: ["right", "wrong"],
        drEvent: ["right", "wrong"],
        drNuis: ["right", "wrong"],
        drTarget: ["s1", "drmst"],
        tau: [2, 12],
      },
    );
  const swatch = (color, dash = "", w = 2.5) =>
    `<svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;
  const band = `<svg class="swatch" width="28" height="10" aria-hidden="true"><rect x="1" y="1" width="26" height="8" fill="var(--purple)" fill-opacity=".22"/></svg>`;
  const tick = `<svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="14" y1="0" x2="14" y2="10" stroke="var(--or)" stroke-width="1.5"/></svg>`;

  root.innerHTML = `
<section class="lab-step" data-title="Three curves and the truth"><h2 tabindex="-1">Three ways to draw “everyone treated”</h2>
<p>Last lesson ended with standardization inside severity strata. Now make it an estimator you could use with many covariates, with a confidence interval you can defend. The world is a 12-month study. Severity X (low, mid, high) raises the monthly event hazard. Sicker patients are treated more often. Patients who feel well drop out of follow-up more often, and treated patients drop out a little more. Because we built the world, we know the true survival curve if everyone were treated, S₁(t), exactly.</p>
<div class="predict" data-options="Below the truth|Above the truth|Right on it, censoring is random" data-answer="0" data-hint="Treated patients are sicker than the whole cohort, and the healthier ones leave the risk set early by dropping out. Both pull the unadjusted curve down.">Predict: at 12 months, where will the plain Kaplan–Meier curve of the treated patients sit relative to the true S₁(12)?</div>
<div class="figure"><div class="fig-row"><div><svg id="ts-curves" role="img" aria-label="Survival over 12 months under one treatment strategy: the truth as a green dashed line, the unadjusted Kaplan–Meier curve in orange with censoring ticks, the treatment- and censoring-weighted Kaplan–Meier curve in blue, and the one-step estimate in purple with a pointwise 95% influence-function band."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--green)", "6 4")}Truth</span><span>${swatch("var(--or)")}Unadjusted KM</span><span>${tick}Censored</span><span>${swatch("var(--p)", "5 4", 2)}IPTW + IPCW weighted KM</span><span>${swatch("var(--purple)", "", 3)}One-step</span><span>${band}95% IF band</span></p></div>
<div><div class="fig-controls"><label for="ts-arm">Curve to draw <select id="ts-arm"><option value="1">Everyone treated, S₁(t)</option><option value="0">Everyone untreated, S₀(t)</option></select></label><button id="ts-new">Draw a new study</button></div><div class="fig-readout" id="ts-curves-readout"></div></div></div><p class="fig-caption" id="ts-curves-caption"></p></div>
<div id="ts-table"></div>
<p>The weighted KM gives every treated patient still at risk a weight 1/(g · G): one over the chance of being treated, times one over the chance of still being followed. The one-step estimate starts from a model of the monthly hazard and then adds the mean of an influence function, the same move you used for the ATE. The band is estimate ± 1.96 × SE(t), with SE(t) the standard deviation of the estimated influence values divided by √n. It is pointwise, not a simultaneous band for the whole curve.</p>
</section>

<section class="lab-step" data-title="Where 1/G comes from"><h2 tabindex="-1">A patient still followed stands in for the ones who left</h2>
<p>Censoring removes people from the risk set, and here it removes the healthier ones faster. Watch the treated patients month by month. Filled dots are still followed; their area is the censoring weight 1/G(t− | X), where G(t− | X) is the estimated chance that a patient with this severity is still being followed when month t starts. Small grey ticks are patients who dropped out; red crosses had the event.</p>
<div class="predict" data-options="Low severity|High severity|Everyone gets the same weight" data-answer="0" data-hint="Low-severity patients drop out most often, so the few who remain must represent many similar patients who left.">Predict: by month 12, which severity group's remaining patients carry the largest censoring weights?</div>
<div class="figure"><svg id="ts-strip" role="img" aria-label="Risk-set strip for 48 treated patients in three severity lanes. As the month advances, events become red crosses, dropouts become grey ticks, and patients still followed grow in area in proportion to their censoring weight."></svg><div id="ts-strip-player"></div><p class="fig-caption" id="ts-strip-caption"></p></div>
<div id="ts-strip-table"></div>
<p>The weighted count rebuilds the risk set censoring took away. That is all inverse probability of censoring weighting does: among patients with the same severity and treatment, the ones still followed are, by assumption, like the ones who left, so each counts for 1/G of them. The assumption is that censoring is independent of the event time given A and X (coarsening at random), and it needs G(t− | A, X) &gt; 0 through the horizon.</p>
<h3>The same weights, as moving mass</h3>
<p>Back to the course's 58 treated patients, in years now, with dropout that depends on severity: low-severity patients leave at 15% a year, high-severity patients at 1%, and follow-up ends at 8 years. Kaplan–Meier hands each dropout's mass to everyone still at risk to the right. That is only fair if those heirs are like the person who left. Switch the heirs to "same severity" and a dropout's mass goes only to patients like them: that is inverse probability of censoring weighting with a censoring model that uses severity, and each survivor ends up standing for 1/G(t− | X) patients.</p>
<div class="predict" data-options="Above the truth|Below the truth|On the truth" data-answer="1" data-hint="The healthier patients leave, and plain KM gives their mass to everyone, including sicker patients who have events sooner. Mass that belonged to likely survivors lands on likely events and falls, so the curve ends too low.">Predict: healthier patients drop out faster. Where does plain Kaplan–Meier (heirs = everyone) end at 8 years, compared with the truth for these same patients had nobody dropped out?</div>
<div data-figure="redistribute" data-variant="informative"></div>
<details><summary>Derivation: where 1/G(t−) and S(τ)/S(t) come from, in four lines</summary>
<p class="math">1. S(τ | a, x) = ∏<sub>t≤τ</sub> (1 − λ(t | a, x)).<br>2. Nudging one monthly hazard: ∂S(τ)/∂λ(t) = −S(τ)/(1 − λ(t)) = −S(τ) S(t−1)/S(t).<br>3. The influence function of the observed hazard λ(t | a, x) is 1{A=a, X=x} Y(t)[dN(t) − λ(t)] / P(A=a, X=x, T̃ ≥ t), and under independent censoring P(T̃ ≥ t | a, x) = S(t−1 | a, x) · G(t− | a, x).<br>4. Multiply, sum over t ≤ τ, and average over X: S(t−1) cancels, leaving 1/g(a | X) · S(τ)/S(t) · 1/G(t−) times the residual, plus S(τ | a, X) − ψ from averaging over X.</p>
<p>Here Y(t) = 1{T̃ ≥ t} (still at risk when month t starts) and dN(t) = 1{T̃ = t, Δ = 1} (the event happened in month t). The censoring weight appears because the risk set at month t is thinned by exactly G(t−).</p></details>
</section>

<section class="lab-step" data-title="Each patient's influence value"><h2 tabindex="-1">Every patient's influence value, in three coloured parts</h2>
<p>This is the efficient influence function of ψ = S₁(τ) at τ = 12 months, which this lesson implements:</p>
<p class="math">D(O) = <span style="color:var(--or)">S(τ | 1, X) − ψ</span> − <span style="color:var(--p)">1{A = 1}/g(1 | X)</span> · Σ<sub>t≤τ</sub> S(τ | 1, X)/S(t | 1, X) · <span style="color:var(--teal)">1/G(t− | 1, X)</span> · [dN(t) − Y(t) λ(t | 1, X)]</p>
<p>Split each patient's value into three pieces. <strong style="color:var(--or)">Orange</strong>: the outcome-model part, the patient's predicted S(τ | 1, X) minus the plug-in average. <strong style="color:var(--p)">Blue</strong>: the augmentation with only the treatment weight 1/g, as if nobody dropped out (every 1/G replaced by 1). <strong style="color:var(--teal)">Teal</strong>: what the censoring weight adds, 1/G − 1 on each month's residual. The purple dot is the total. For a patient who was never censored, the blue piece telescopes to (1{T &gt; τ} − S(τ | 1, X))/g(1 | X), the familiar treatment-weighted residual from the ATE lessons. Untreated patients have no augmentation. For a treated patient, an event pulls the augmentation negative (it came sooner than the model predicted), and each month survived nudges it positive. Press Play to turn the censoring weight on, from κ = 0 (ignore dropout) to κ = 1 (full 1/G).</p>
<div class="figure"><div class="fig-row"><div><svg id="ts-if" role="img" aria-label="Horizontal influence-function sticks for 20 patients. Each patient has an orange outcome-model piece, a blue treatment-weighted residual piece, and a teal censoring-weight piece laid end to end, with a purple dot at the total."></svg><div id="ts-if-player"></div>
<p class="legend legend-swatches"><span>${swatch("var(--or)", "", 4)}Outcome model S(τ|1,X) − ψ̂</span><span>${swatch("var(--p)", "", 4)}Residual × 1/g</span><span>${swatch("var(--teal)", "", 4)}Extra from 1/G</span><span><svg class="swatch" width="28" height="10" aria-hidden="true"><circle cx="14" cy="5" r="4" fill="var(--purple)"/></svg>Total D</span></p></div>
<div><div class="fig-controls"><label for="ts-s3event">Event-hazard model <select id="ts-s3event"><option value="right">Uses severity (correct)</option><option value="wrong">Ignores severity (wrong)</option></select></label></div><div class="fig-readout" id="ts-if-readout"></div></div></div><p class="fig-caption" id="ts-if-caption"></p></div>
<p>The one-step estimator is the plug-in plus the mean of the correction over all ${N} patients, exactly the AIPW update from the ATE lessons. Switch the event model to one that ignores severity. Every orange piece becomes zero, because the model now predicts the same curve for everyone. The plug-in is then badly biased, and the correction has to do all the work. It only finishes the job with the censoring weight switched fully on.</p>
</section>

<section class="lab-step" data-title="Double robustness"><h2 tabindex="-1">Break a model, repeat the study 1000 times</h2>
<p>Each configuration below reruns the same study 1000 times (n = 800 each, seeded) and records every estimator. “Wrong” event model: monthly hazard with treatment but no severity. “Wrong” censoring and treatment models: the dropout hazard and the propensity both ignore severity.</p>
<div class="predict" data-options="Still centred on the truth|Biased like the plug-in|Biased, but less than the plug-in" data-answer="0" data-hint="The augmentation has mean zero whenever g and G are right, so the correction repairs a wrong hazard model. Try it with the controls.">Predict: the event-hazard model is wrong but the censoring and treatment models are right. Where is the one-step estimator centred?</div>
<div class="figure"><div class="fig-row"><div><svg id="ts-dr" role="img" aria-label="Three histograms of estimates across 1000 simulated studies: g-formula plug-in, IPTW plus IPCW weighted KM, and one-step, with the truth as a green dashed vertical line."></svg></div>
<div><div class="fig-controls"><label for="ts-dr-event">Event-hazard model <select id="ts-dr-event"><option value="right">Right (uses severity)</option><option value="wrong">Wrong (ignores severity)</option></select></label><label for="ts-dr-nuis">Censoring and treatment models <select id="ts-dr-nuis"><option value="right">Right (use severity)</option><option value="wrong">Wrong (ignore severity)</option></select></label><label for="ts-dr-target">Target <select id="ts-dr-target"><option value="s1">S₁(12)</option><option value="drmst">ΔRMST(12), months</option></select></label></div><div class="fig-readout" id="ts-dr-readout"></div></div></div><p class="fig-caption" id="ts-dr-caption"></p></div>
<div id="ts-dr-table"></div>
<p>With every model right, the repeated-sample SD of the one-step estimate of S₁(12) is <span id="ts-dr-sd"></span>, against √(E[D²]/n) = <span id="ts-dr-bound"></span> computed exactly from the true law: the influence function predicts its spread. Coverage is honest only when the models it relies on are right; when one nuisance model is wrong the estimator stays consistent but the simple IF standard error need not be exact. TMLE targets the fitted hazard by an iterated logistic fluctuation along the same clever covariate; its estimates track the one-step closely here.</p>
</section>

<section class="lab-step" data-title="ΔRMST or a hazard ratio?"><h2 tabindex="-1">Months of life gained, or a hazard ratio?</h2>
<p>The first lesson asked: if everyone in this population were treated rather than nobody, how would event-free time change over a fixed horizon? RMST(τ) is the area under S(t) up to τ, here the expected number of event-free months among the first τ. Its influence function is the sum of the S(t) influence functions for t = 0, …, τ − 1 (months are one unit wide), so the same machinery gives an interval.</p>
<div class="predict" data-options="ΔRMST(12)|The adjusted Cox hazard ratio|The unadjusted Cox hazard ratio" data-answer="0" data-hint="Only ΔRMST is a population-level contrast in months. The adjusted HR is a conditional ratio that assumes proportional hazards; the unadjusted HR also mixes in who got treated.">Predict: which number answers “how many more event-free months, on average over the first year, if everyone were treated”?</div>
<div class="figure"><div class="fig-row"><div><svg id="ts-rmst-curves" role="img" aria-label="One-step survival curves under treatment and under no treatment, with the area between them shaded up to the horizon."></svg><svg id="ts-rmst" role="img" aria-label="ΔRMST as a function of the horizon τ: one-step estimate with a 95% band, the truth as a green dashed line, and the unadjusted KM difference in orange."></svg>
<p class="legend legend-swatches"><span>${swatch("var(--p)", "", 3)}Everyone treated</span><span>${swatch("var(--teal)", "", 3)}Everyone untreated</span><span>${swatch("var(--green)", "6 4")}Truth</span><span>${swatch("var(--purple)", "", 3)}One-step ΔRMST</span><span>${swatch("var(--or)")}Unadjusted KM ΔRMST</span></p></div>
<div><div class="fig-controls"><label for="ts-tau">Horizon τ, months <input id="ts-tau" type="range" min="2" max="12" step="1"></label></div><div class="fig-readout" id="ts-rmst-readout"></div></div></div><p class="fig-caption" id="ts-rmst-caption"></p></div>
<div id="ts-hr-table"></div>
<p>The unadjusted Cox model says treatment looks harmful, because treated patients are sicker. Adjusting for severity flips it, but the adjusted hazard ratio is a conditional, model-based summary. In this world the treatment effect on the monthly hazard is weaker for sicker patients (log-odds −0.60, −0.45 and −0.30 for low, mid and high severity), so no single conditional hazard ratio exists, and the marginal one drifts over time, as in the previous lesson. ΔRMST names a population, a horizon and a unit, and its interval comes from the influence function, not from proportional hazards. That is the kind of population-level summary an ICH E9(R1) estimand asks you to state.</p>
<details><summary>Base R: one-step S₁(τ) with an influence-function SE (31 lines, base R only)</summary>
<pre class="code" tabindex="0"><code>${R_SNIPPET()}</code></pre>
<p class="note">Output in R 4.3.3: plug-in 0.609, one-step 0.612, SE 0.027, 95% CI 0.559 to 0.665, truth 0.617. The R simulation uses R's own random numbers, so it is a different draw from the study on this page. On this page's own study, the same formulas in R reproduce the one-step 0.6224 (SE 0.0285) and survival::coxph(ties = "breslow") reproduces both hazard ratios.</p></details>
</section>`;

  function R_SNIPPET() {
    return `# One-step (AIPW) estimate of S_1(tau) in discrete time, with an influence-function SE.
set.seed(1); n &lt;- 1000; K &lt;- 12; tau &lt;- 12
x &lt;- sample(0:2, n, TRUE, c(.4, .35, .25)); a &lt;- rbinom(n, 1, plogis(-1.1 + 1.1 * x))
lamT &lt;- function(t, a, x) plogis(-3.7 + .04 * (t - 1) + .75 * x - .6 * a + .15 * a * x)
cenT &lt;- function(a, x) plogis(-2.8 - .5 * x + .3 * a)
T &lt;- sapply(1:n, function(i) { t &lt;- 1; while (t &lt;= K &amp;&amp; runif(1) &gt; lamT(t, a[i], x[i])) t &lt;- t + 1; t })
C &lt;- sapply(1:n, function(i) { t &lt;- 1; while (t &lt; K &amp;&amp; runif(1) &gt; cenT(a[i], x[i])) t &lt;- t + 1; t })
time &lt;- pmin(T, C); event &lt;- as.integer(T &lt;= C)
# Person-month data: at risk of the event in month t if time &gt;= t; censored at t if time == t, no event, t &lt; K
pp &lt;- data.frame(id = rep(1:n, time), t = sequence(time), x = rep(x, time), a = rep(a, time))
pp$dN &lt;- as.integer(pp$t == time[pp$id] &amp; event[pp$id] == 1)
pp$dC &lt;- as.integer(pp$t == time[pp$id] &amp; event[pp$id] == 0 &amp; pp$t &lt; K)
fitE &lt;- glm(dN ~ factor(t) + factor(a):factor(x), binomial, pp)          # event hazard
fitC &lt;- glm(dC ~ factor(t) + factor(a):factor(x), binomial, pp, subset = dN == 0 &amp; t &lt; K)
g1 &lt;- fitted(glm(a ~ factor(x), binomial))                                  # propensity
nd &lt;- expand.grid(t = 1:K, x = 0:2, a = 1)
lam &lt;- matrix(predict(fitE, nd, type = "response"), K)                     # lam[t, x+1] under a = 1
hc &lt;- matrix(predict(fitC, transform(nd, t = pmin(t, K - 1)), type = "response"), K)
S &lt;- apply(1 - lam, 2, cumprod)                                             # S(t | 1, x)
G &lt;- rbind(1, apply(1 - hc, 2, cumprod)[-K, ])                              # G(t- | 1, x) = P(C &gt;= t)
Q &lt;- S[tau, x + 1]                                                          # plug-in part
aug &lt;- sapply(1:n, function(i) {
  if (a[i] == 0) return(0)
  j &lt;- x[i] + 1; s &lt;- 1:min(time[i], tau)
  res &lt;- (s == time[i] &amp; event[i] == 1) - lam[s, j]                         # dN(t) - Y(t) lambda(t)
  -sum(S[tau, j] / S[s, j] / G[s, j] * res) / g1[i]
})
psi &lt;- mean(Q) + mean(aug); D &lt;- Q - psi + aug
truth &lt;- sum(c(.4, .35, .25) * sapply(0:2, function(x) prod(1 - lamT(1:tau, 1, x))))
cat(sprintf("plug-in %.3f  one-step %.3f  SE %.3f  95%% CI %.3f to %.3f  truth %.3f\\n",
  mean(Q), psi, sqrt(mean(D^2) / n), psi - 1.96 * sqrt(mean(D^2) / n), psi + 1.96 * sqrt(mean(D^2) / n), truth))`;
  }

  [
    ["ts-s3event", "s3event"],
    ["ts-dr-event", "drEvent"],
    ["ts-dr-nuis", "drNuis"],
    ["ts-dr-target", "drTarget"],
    ["ts-tau", "tau"],
  ].forEach(([id, key]) => control(byId(id), state, key));
  // The arm shown in step 1 is a view choice, kept per viewer outside the shared store.
  let arm = 1;
  byId("ts-arm").addEventListener("input", (e) => {
    arm = +e.target.value;
    drawCurves();
  });
  byId("ts-new").onclick = () => state.set({ seed: (state.get().seed % 4294967295) + 1 });

  /* ---------- helpers ---------- */
  const widthOf = (svg, max = 760) => {
      const w = svg.parentElement.getBoundingClientRect().width;
      return w > 0 ? Math.max(300, Math.min(max, Math.floor(w))) : 640;
    },
    readout = (id, pairs) =>
      byId(id).replaceChildren(
        ...pairs.flatMap(([k, v]) => [html("span", { class: "k" }, k), html("span", {}, String(v))]),
      ),
    lim = (e, d = 3) => `${fmt(e.est - 1.96 * e.se, d)}, ${fmt(e.est + 1.96 * e.se, d)}`,
    ci = (e, se, d = 3) => `${fmt(e, d)} (${fmt(e - 1.96 * se, d)} to ${fmt(e + 1.96 * se, d)})`,
    SEV = ["low", "mid", "high"],
    // Keep right-margin labels apart: sort by y, push down by at least gap pixels.
    spread = (items, gap, lo, hi) => {
      items.sort((a, b) => a.y - b.y);
      for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + gap);
      const over = items.length ? items.at(-1).y - hi : 0;
      if (over > 0) items.forEach((it) => (it.y -= over));
      items.forEach((it) => (it.y = Math.max(lo, it.y)));
      return items;
    };

  /* ---------- cached analysis per seed ---------- */
  let cache = null;
  function analysis() {
    const seed = state.get().seed;
    if (cache && cache.seed === seed) return cache;
    const rows = TS.simulate(N, seed),
      c = TS.counts(rows),
      nu = TS.fit(rows, { event: "right", nuis: "right" }, c),
      arms = [0, 1].map((a) => {
        const curve = Array.from({ length: K + 1 }, (_, t) =>
          t ? TS.eif(rows, a, nu, TS.weightsS(t)) : { est: 1, se: 0, plugin: 1, D: rows.map(() => 0) },
        );
        return {
          truth: TS.truthCurve(a),
          km: TS.kmArm(c, a),
          wkm: TS.weightedKM(c, a, nu),
          curve,
          tmle12: TS.tmle(rows, a, nu, TS.weightsS(K), c),
          rmst: Array.from({ length: K + 1 }, (_, tau) => (tau ? TS.eif(rows, a, nu, TS.weightsRMST(tau)) : null)),
        };
      });
    cache = { seed, rows, c, nu, arms, byEvent: {} };
    return cache;
  }
  const nuFor = (spec) => {
    const A = analysis();
    return (A.byEvent[spec] ||= TS.fit(A.rows, { event: spec, nuis: "right" }, A.c));
  };

  /* ---------- Step 1: three curves ---------- */
  function drawCurves() {
    const A = analysis(),
      R = A.arms[arm],
      svg = byId("ts-curves"),
      W = widthOf(svg),
      plot = new Plot(svg, {
        x: [0, K],
        y: [0.3, 1],
        width: W,
        height: Math.round(Math.max(270, Math.min(360, W * 0.62))),
        margin: { l: 46, r: 58, t: 32, b: 44 },
        xticks: [0, 2, 4, 6, 8, 10, 12],
        yticks: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        xlabel: "Month",
        ylabel: arm ? "S₁(t), everyone treated" : "S₀(t), everyone untreated",
        tickFormat: (v) => fmt(v, 1),
      }),
      steps = (vals) => vals.map((v, t) => [t, v]).concat([[K, vals[K]]]),
      stepsTo = (vals) => {
        const pts = [];
        vals.forEach((v, t) => {
          if (t) pts.push([t, vals[t - 1]]);
          pts.push([t, v]);
        });
        return pts;
      },
      os = R.curve.map((e) => e.est),
      lo = R.curve.map((e) => e.est - 1.96 * e.se),
      hi = R.curve.map((e) => e.est + 1.96 * e.se),
      bandPts = stepsTo(hi).concat(stepsTo(lo).reverse());
    plot.marks.append(
      el("path", { d: plot.d(bandPts) + " Z", fill: "var(--purple)", "fill-opacity": 0.2, stroke: "none" }),
    );
    plot.line(stepsTo(R.truth), { stroke: "var(--green)", "stroke-dasharray": "7 5" });
    plot.line(stepsTo(R.km), { stroke: "var(--or)", "stroke-width": 2.2 });
    plot.line(stepsTo(os), { stroke: "var(--purple)", "stroke-width": 3 });
    plot.scatter(os.map((v, t) => [t, v]).slice(1), 3.2, { fill: "var(--purple)" });
    // Drawn on top, dashed, because with these models it nearly coincides with the one-step curve.
    plot.line(stepsTo(R.wkm), { stroke: "var(--p)", "stroke-width": 1.8, style: "stroke-dasharray: 5 4" });
    // Censoring ticks on the unadjusted KM: one tick per month with dropouts in this arm.
    const ticks = plot.layer("ticks");
    for (let t = 1; t < K; t++) {
      const cens = [0, 1, 2].reduce((s, x) => s + A.c.cens[arm][x][t], 0);
      if (cens)
        ticks.append(
          el("line", {
            x1: plot.sx(t + 0.5),
            x2: plot.sx(t + 0.5),
            y1: plot.sy(R.km[t]) - 5,
            y2: plot.sy(R.km[t]) + 5,
            stroke: "var(--or)",
            "stroke-width": 1.4,
          }),
        );
    }
    // End labels in the right margin, kept apart.
    const labs = spread(
      [
        { y: plot.sy(R.truth[K]), t: fmt(R.truth[K], 3), c: "var(--green)" },
        { y: plot.sy(R.km[K]), t: fmt(R.km[K], 3), c: "var(--or)" },
        { y: plot.sy(R.wkm[K]), t: fmt(R.wkm[K], 3), c: "var(--p)" },
        { y: plot.sy(os[K]), t: fmt(os[K], 3), c: "var(--purple)" },
      ],
      15,
      plot.m.t + 8,
      plot.H - plot.m.b,
    );
    labs.forEach((l) =>
      plot.fg.append(el("text", { class: "fig-text", x: plot.W - plot.m.r + 6, y: l.y + 4, style: `fill: ${l.c}` }, l.t)),
    );
    const e12 = R.curve[K],
      nArm = A.rows.filter((r) => r.a === arm).length,
      nCens = A.rows.filter((r) => r.a === arm && !r.event && r.time < K).length;
    readout("ts-curves-readout", [
      ["study", `n = ${N}, seed ${A.seed}`],
      ["in this arm", `${nArm} (${nCens} dropped out)`],
      ["truth S(12)", fmt(R.truth[K])],
      ["unadjusted KM", fmt(R.km[K])],
      ["weighted KM", fmt(R.wkm[K])],
      ["one-step", fmt(e12.est)],
      ["95% IF CI", `${fmt(e12.est - 1.96 * e12.se)} to ${fmt(e12.est + 1.96 * e12.se)}`],
    ]);
    byId("ts-curves-caption").textContent =
      `At 12 months the unadjusted KM of the ${arm ? "treated" : "untreated"} patients gives ${fmt(R.km[K])} against the truth ${fmt(R.truth[K])} (off by ${fmt(R.km[K] - R.truth[K])}). ` +
      `The weighted KM (${fmt(R.wkm[K])}) and the one-step estimate (${fmt(e12.est)}, SE ${fmt(e12.se)}) both adjust for severity in treatment and in dropout. ` +
      (Math.abs(e12.est - R.truth[K]) <= 1.96 * e12.se
        ? "The truth is inside this study's 95% interval."
        : "In this particular study the truth falls outside the 95% interval, which happens in about 1 study in 20.");
  }
  function drawCurveTable() {
    const A = analysis(),
      [a0, a1] = A.arms,
      w = TS.weightsS(K),
      plug = (a) => TS.gformula(A.rows, a, A.nu, w),
      d = TS.contrast(a1.curve[K], a0.curve[K]),
      dT = TS.contrast(a1.tmle12, a0.tmle12);
    byId("ts-table").innerHTML = table(
      ["Estimator", "S₁(12)", "S₀(12)", "S₁ − S₀"],
      [
        ["Truth (exact)", fmt(a1.truth[K]), fmt(a0.truth[K]), fmt(a1.truth[K] - a0.truth[K])],
        ["Unadjusted KM by arm", fmt(a1.km[K]), fmt(a0.km[K]), fmt(a1.km[K] - a0.km[K])],
        ["IPTW + IPCW weighted KM", fmt(a1.wkm[K]), fmt(a0.wkm[K]), fmt(a1.wkm[K] - a0.wkm[K])],
        ["g-formula plug-in (pooled logistic hazard)", fmt(plug(1)), fmt(plug(0)), fmt(plug(1) - plug(0))],
        ["One-step", fmt(a1.curve[K].est), fmt(a0.curve[K].est), fmt(d.est)],
        ["  95% IF CI", lim(a1.curve[K]), lim(a0.curve[K]), lim(d)],
        ["TMLE", fmt(a1.tmle12.est), fmt(a0.tmle12.est), fmt(dT.est)],
        ["  95% IF CI", lim(a1.tmle12), lim(a0.tmle12), lim(dT)],
      ],
      `Survival at 12 months, one study (n = ${N}, seed ${A.seed})`,
    );
  }

  /* ---------- Step 2: risk-set strip ---------- */
  let stripMonth = 1;
  function drawStrip() {
    const A = analysis(),
      nu = A.nu,
      svg = byId("ts-strip"),
      W = widthOf(svg, 900),
      PER_LANE = W < 560 ? 11 : 16,
      labelW = 16,
      laneH = 66,
      top = 34,
      H = top + laneH * 3 + 14,
      t = stripMonth;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.classList.add("fig");
    svg.replaceChildren();
    svg.append(
      el("text", { class: "fig-text ink", x: 10, y: 20 }, `Treated patients at the start of month ${t}`),
    );
    const gap = (W - labelW - 24) / (PER_LANE - 1);
    [0, 1, 2].forEach((x) => {
      const y = top + laneH * x + laneH / 2 + 8,
        people = A.rows.filter((r) => r.a === 1 && r.x === x).slice(0, PER_LANE),
        wgt = 1 / nu.G[1][x][t];
      svg.append(
        el("line", { x1: 8, x2: W - 8, y1: y + laneH / 2 - 6, y2: y + laneH / 2 - 6, stroke: "var(--grid)" }),
        el("text", { class: "fig-text ink", x: 10, y: y - 16 }, `${SEV[x]} severity`),
        el("text", { class: "fig-text", x: W - 10, y: y - 16, "text-anchor": "end", style: "fill: var(--teal)" }, `weight 1/G = ${fmt(wgt, 2)}`),
      );
      people.forEach((r, i) => {
        const cx = labelW + 6 + i * gap;
        if (r.time >= t)
          svg.append(
            el("circle", { cx, cy: y, r: 4.6 * Math.sqrt(wgt), fill: "var(--p)", "fill-opacity": 0.85, stroke: "var(--paper)", "stroke-width": 1 }),
          );
        else if (r.event)
          svg.append(
            el("path", { d: `M${cx - 4},${y - 4} L${cx + 4},${y + 4} M${cx - 4},${y + 4} L${cx + 4},${y - 4}`, stroke: "var(--red)", "stroke-width": 2 }),
          );
        else svg.append(el("line", { x1: cx, x2: cx, y1: y - 6, y2: y + 6, stroke: "var(--muted)", "stroke-width": 1.6 }));
      });
    });
    const rowsFor = [0, 1, 2].map((x) => {
      const arm = A.rows.filter((r) => r.a === 1 && r.x === x),
        followed = arm.filter((r) => r.time >= t).length,
        hidden = arm.filter((r) => r.latentT >= t).length;
      return [
        SEV[x],
        followed,
        "× " + fmt(1 / nu.G[1][x][t], 2),
        "= " + fmt(followed / nu.G[1][x][t], 1),
        hidden,
      ];
    });
    byId("ts-strip-table").innerHTML = table(
      ["Severity", "Followed", "× 1/G(t−)", "= Weighted", "Event-free (hidden)"],
      rowsFor,
      `Treated arm, start of month ${t}`,
    );
    const low = rowsFor[0];
    byId("ts-strip-caption").textContent =
      t === 1
        ? "Month 1: everyone is followed, so every weight is 1. Press Play to advance the months."
        : `Month ${t}: ${low[1]} low-severity treated patients are still followed, and each counts for ${low[2].slice(2)} of them, giving ${low[3].slice(2)}. In the full data, which a real study never sees, ${low[4]} low-severity treated patients are still event-free. The weighted risk set stands in for the full one that dropout thinned.`;
  }
  const stripPlayer = player(byId("ts-strip-player"), {
    duration: 7000,
    label: "Month",
    formatValue: (u) => String(1 + Math.round(u * (K - 1))),
    onT(u) {
      const m = 1 + Math.round(u * (K - 1));
      if (m !== stripMonth || !byId("ts-strip").childNodes.length) {
        stripMonth = m;
        drawStrip();
      }
    },
  });

  /* ---------- Step 3: influence values ---------- */
  let kappa = 0;
  function pickPatients(rows) {
    const chosen = [],
      used = new Set(),
      take = (f) => {
        const r = rows.find((q) => !used.has(q.id) && f(q));
        if (r) {
          used.add(r.id);
          chosen.push(r);
        }
      };
    for (const x of [0, 1, 2]) {
      take((r) => r.a === 1 && r.x === x && r.event && r.time <= 6);
      take((r) => r.a === 1 && r.x === x && r.event && r.time > 6);
      take((r) => r.a === 1 && r.x === x && !r.event && r.time < K);
      take((r) => r.a === 1 && r.x === x && !r.event && r.time === K);
    }
    take((r) => r.a === 1 && r.x === 0 && !r.event && r.time < K);
    take((r) => r.a === 1 && r.x === 0 && !r.event && r.time === K);
    take((r) => r.a === 1 && r.x === 1 && !r.event && r.time < K);
    take((r) => r.a === 1 && r.x === 2 && !r.event && r.time === K);
    for (const x of [0, 1, 2]) take((r) => r.a === 0 && r.x === x);
    take((r) => r.a === 0);
    const order = (r) => (r.a ? 0 : 1000) + r.x * 100 + (r.event ? 0 : 50) + r.time;
    return chosen.sort((p, q) => order(p) - order(q));
  }
  const outcomeText = (r) =>
    !r.a ? "untreated" : r.event ? `treated, event month ${r.time}` : r.time === K ? "treated, followed to 12" : `treated, dropout month ${r.time}`;
  function drawIF() {
    const A = analysis(),
      spec = state.get().s3event,
      nu = spec === "right" ? A.nu : nuFor("wrong"),
      w = TS.weightsS(K),
      e = TS.eif(A.rows, 1, nu, w, kappa),
      eFull = TS.eif(A.rows, 1, nu, w, 1),
      pts = pickPatients(A.rows),
      parts = pts.map((r) => e.parts[r.id]),
      svg = byId("ts-if"),
      W = widthOf(svg),
      narrow = W < 560,
      labelW = narrow ? 14 : 212,
      rowH = narrow ? 48 : 36,
      sy0 = narrow ? 9 : 0,
      top = 30,
      bottom = 40,
      H = top + rowH * pts.length + bottom;
    const ends = parts.flatMap((p) => [0, p.plug, p.plug + p.augG, p.plug + p.augG + p.augC]),
      fullEnds = pts.map((r) => eFull.parts[r.id]).flatMap((p) => [p.plug + p.augG, p.plug + p.augG + p.augC]),
      lo = Math.min(-0.5, ...ends, ...fullEnds),
      hi = Math.max(0.5, ...ends, ...fullEnds),
      plot = new Plot(svg, {
        x: [Math.floor(lo * 2) / 2, Math.ceil(hi * 2) / 2],
        y: [0, pts.length],
        width: W,
        height: H,
        margin: { l: labelW, r: 14, t: top, b: bottom },
        yticks: [],
        xlabel: "Influence value D for S₁(12)",
        tickFormat: (v) => fmt(v, 1),
      });
    plot.vline(0, { stroke: "var(--ink)", opacity: 0.5, style: "stroke-dasharray: none" });
    pts.forEach((r, i) => {
      const p = parts[i],
        yc = plot.sy(pts.length - i - 0.5),
        seg = (x0, x1, dy, color) =>
          plot.marks.append(
            el("line", { x1: plot.sx(x0), x2: plot.sx(x1), y1: yc + sy0 + dy, y2: yc + sy0 + dy, stroke: color, "stroke-width": 5, "stroke-linecap": "butt" }),
          );
      if (i % 2 === 0)
        plot.bg.append(el("rect", { x: 0, y: yc - rowH / 2, width: W, height: rowH, fill: "var(--soft)", opacity: 0.6 }));
      seg(0, p.plug, -6, "var(--or)");
      seg(p.plug, p.plug + p.augG, 0, "var(--p)");
      seg(p.plug + p.augG, p.plug + p.augG + p.augC, 6, "var(--teal)");
      plot.marks.append(el("circle", { cx: plot.sx(p.plug + p.augG + p.augC), cy: yc + sy0, r: 4.5, fill: "var(--purple)", stroke: "var(--paper)", "stroke-width": 1 }));
      if (narrow)
        plot.fg.append(
          el("text", { class: "fig-text ink", x: 8, y: yc - 9 }, `#${r.id + 1} ${SEV[r.x]}, ${outcomeText(r)}`),
        );
      else
        plot.fg.append(
          el("text", { class: "fig-text ink", x: 8, y: yc - 2 }, `#${r.id + 1} ${SEV[r.x]} severity`),
          el("text", { class: "fig-text", x: 8, y: yc + 13 }, outcomeText(r)),
        );
    });
    plot.fg.append(el("text", { class: "fig-text ink", x: 8, y: 18 }, `20 of ${N} patients · κ = ${fmt(kappa, 2)}`));
    const mG = TS.eif(A.rows, 1, nu, w, 0).correction,
      truth = TS.truth(1, w);
    readout("ts-if-readout", [
      ["κ", fmt(kappa, 2)],
      ["plug-in ψ̂", fmt(e.plugin)],
      ["mean orange", "0 (by construction)"],
      ["mean blue", fmt(mG)],
      ["mean teal", fmt(e.correction - mG)],
      ["mean correction", fmt(e.correction)],
      ["one-step", fmt(e.est)],
      ["IF SE", fmt(e.se)],
      ["truth S₁(12)", fmt(truth)],
    ]);
    byId("ts-if-caption").textContent =
      `One-step = plug-in ${fmt(e.plugin)} + mean correction ${fmt(e.correction)} = ${fmt(e.est)}; the truth is ${fmt(truth)}. ` +
      (spec === "wrong"
        ? `With the event model ignoring severity, κ = 0 reaches ${fmt(TS.eif(A.rows, 1, nu, w, 0).est)} and κ = 1 reaches ${fmt(eFull.est)}: the treatment weight fixes confounding, the censoring weight fixes selective dropout.`
        : `The event model is right, so the correction is small; the teal pieces still matter for the standard error (${fmt(TS.eif(A.rows, 1, nu, w, 0).se)} at κ = 0, ${fmt(eFull.se)} at κ = 1).`);
  }
  const ifPlayer = player(byId("ts-if-player"), {
    duration: 5000,
    label: "Censoring weight κ",
    formatValue: (u) => u.toFixed(2),
    onT(u) {
      kappa = u;
      drawIF();
    },
  });

  /* ---------- Step 4: double robustness (precomputed) ---------- */
  let DR = null,
    drShown = null;
  const DR_EST = [
    ["plugin", "g-formula plug-in", "var(--or)"],
    ["wkm", "IPTW + IPCW weighted KM", "var(--p)"],
    ["onestep", "One-step (AIPW)", "var(--purple)"],
  ];
  function drawDR(animate = false) {
    if (!DR) return;
    const s = state.get(),
      cfg = DR.configs.find((c) => c.spec.event === s.drEvent && c.spec.nuis === s.drNuis),
      tg = s.drTarget,
      res = cfg[tg],
      [a, b] = DR.domain[tg],
      bins = DR.bins,
      bw = (b - a) / bins,
      truth = DR.truth[tg],
      svg = byId("ts-dr"),
      W = widthOf(svg),
      panelH = 92,
      H = 30 + panelH * 3 + 44,
      target = DR_EST.map(([k]) => res[k].hist.map((v) => v / DR.reps / bw)),
      from = drShown && drShown.target === tg ? drShown.dens : target,
      ymax = Math.max(...DR.configs.flatMap((c) => DR_EST.flatMap(([k]) => c[tg][k].hist))) / DR.reps / bw;
    const draw = (u) => {
      const dens = target.map((h, j) => h.map((v, i) => from[j][i] + (v - from[j][i]) * u));
      drShown = { target: tg, dens };
      const plot = new Plot(svg, {
        x: [a, b],
        y: [0, 3],
        width: W,
        height: H,
        margin: { l: 14, r: 14, t: 30, b: 44 },
        yticks: [],
        grid: false,
        xlabel: tg === "s1" ? "Estimate of S₁(12)" : "Estimate of ΔRMST(12), months",
        tickFormat: (v) => fmt(v, 2),
      });
      DR_EST.forEach(([k, name, color], j) => {
        const base = 3 - j - 1,
          scale = 0.78 / ymax;
        plot.bars(
          dens[j].map((v, i) => [a + (i + 0.5) * bw, base + v * scale, base]),
          bw * 0.92,
          { fill: color, "fill-opacity": 0.75 },
        );
        plot.hline(base, { stroke: "var(--rule)", style: "stroke-dasharray: none" });
        plot.fg.append(
          el("text", { class: "fig-text ink", x: plot.m.l + 4, y: plot.sy(base + 1) + 16, style: `fill: ${color}` }, name),
          el("text", { class: "fig-text", x: plot.W - plot.m.r - 4, y: plot.sy(base + 1) + 16, "text-anchor": "end" }, `bias ${fmt(res[k].bias, 3)}`),
        );
        const m = res[k].mean;
        plot.marks.append(
          el("path", { d: `M${plot.sx(m)},${plot.sy(base) + 1} l-5,9 h10 Z`, fill: color }),
        );
      });
      plot.vline(truth, { stroke: "var(--green)", "stroke-dasharray": "7 5", "stroke-width": 2 });
      plot.fg.append(
        el("text", { class: "fig-text", x: plot.sx(truth) + (plot.sx(truth) > W * 0.7 ? -5 : 5), y: 20, style: "fill: var(--green)", "text-anchor": plot.sx(truth) > W * 0.7 ? "end" : "start" }, `truth ${fmt(truth, 3)}`),
      );
    };
    if (animate) tween({ duration: 500, onUpdate: draw });
    else draw(1);
    const o = res.onestep;
    readout("ts-dr-readout", [
      ["studies", `${DR.reps} × n = ${DR.n}`],
      ["truth", fmt(truth)],
      ["one-step bias", `${fmt(o.bias)} (MC SE ${fmt(o.mcse)})`],
      ["one-step SD", fmt(o.sd)],
      ["mean IF SE", fmt(o.meanSE)],
      ["95% coverage", fmt(o.coverage * 100, 1) + "%"],
    ]);
    const rowsT = [
      ["km", "Unadjusted KM"],
      ["wkm", "IPTW + IPCW weighted KM"],
      ["plugin", "g-formula plug-in"],
      ["onestep", "One-step"],
      ["tmle", "TMLE"],
    ].map(([k, name]) => [
      name,
      fmt(res[k].bias),
      fmt(res[k].mcse),
      fmt(res[k].sd),
      res[k].coverage === undefined ? "not computed" : fmt(res[k].coverage * 100, 1) + "%",
    ]);
    byId("ts-dr-table").innerHTML = table(
      ["Estimator", "Bias", "MC SE of bias", "SD", "IF-interval coverage"],
      rowsT,
      `${tg === "s1" ? "S₁(12)" : "ΔRMST(12)"}: event model ${s.drEvent}, censoring and treatment models ${s.drNuis}`,
    );
    const ok = s.drEvent === "right" || s.drNuis === "right";
    byId("ts-dr-caption").textContent = ok
      ? `At least one side is right, so the one-step estimator is centred on the truth (bias ${fmt(o.bias)}, Monte Carlo SE ${fmt(o.mcse)}). ` +
        (s.drEvent === "wrong" ? "The plug-in, which relies only on the event model, is off by " + fmt(res.plugin.bias) + ". " : "") +
        (s.drNuis === "wrong" ? "The weighted KM, which relies only on the weights, is off by " + fmt(res.wkm.bias) + ". " : "")
      : `Both sides wrong: every estimator lands near the unadjusted KM, bias ${fmt(o.bias)}. Double robustness gives two chances, not a guarantee.`;
    byId("ts-dr-sd").textContent = fmt(DR.configs[0].s1.onestep.sd, 4);
    byId("ts-dr-bound").textContent = fmt(Math.sqrt(DR.bound.s1 / DR.n), 4);
  }
  fetch("../science/targeted-survival-data.json")
    .then((r) => r.json())
    .then((d) => {
      DR = d;
      drawDR();
    })
    .catch(() => (byId("ts-dr-caption").textContent = "The precomputed repeated-sample results could not be loaded. Serve the site over HTTP."));

  /* ---------- Step 5: ΔRMST and Cox ---------- */
  function drawRMST() {
    const A = analysis(),
      tau = state.get().tau,
      [a0, a1] = A.arms,
      d = Array.from({ length: K + 1 }, (_, t) => (t ? TS.contrast(a1.rmst[t], a0.rmst[t]) : { est: 0, se: 0 })),
      truthD = Array.from({ length: K + 1 }, (_, t) => TS.truth(1, TS.weightsRMST(t)) - TS.truth(0, TS.weightsRMST(t))),
      kmD = Array.from({ length: K + 1 }, (_, t) => TS.rmstOf(a1.km, t) - TS.rmstOf(a0.km, t)),
      s1 = a1.curve.map((e) => e.est),
      s0 = a0.curve.map((e) => e.est);
    // Upper figure: the two one-step curves and the area between them up to τ.
    const svgA = byId("ts-rmst-curves"),
      W = widthOf(svgA),
      pA = new Plot(svgA, {
        x: [0, K],
        y: [0.3, 1],
        width: W,
        height: Math.round(Math.max(230, Math.min(280, W * 0.5))),
        margin: { l: 46, r: 18, t: 22, b: 40 },
        xticks: [0, 2, 4, 6, 8, 10, 12],
        yticks: [0.4, 0.6, 0.8, 1],
        xlabel: "Month",
        ylabel: "One-step survival",
        tickFormat: (v) => fmt(v, 1),
      }),
      stepPts = (v, upto) => {
        const pts = [];
        for (let t = 0; t < upto; t++) pts.push([t, v[t]], [t + 1, v[t]]);
        return pts;
      };
    pA.marks.append(
      el("path", {
        d: pA.d(stepPts(s1, tau)) + " " + pA.d(stepPts(s0, tau).reverse()).replace(/^M/, "L") + " Z",
        fill: "var(--purple)",
        "fill-opacity": 0.22,
        stroke: "none",
      }),
    );
    pA.line(stepPts(s1, K), { stroke: "var(--p)", "stroke-width": 2.6 });
    pA.line(stepPts(s0, K), { stroke: "var(--teal)", "stroke-width": 2.6 });
    pA.vline(tau, { stroke: "var(--ink)", opacity: 0.6 });
    pA.fg.append(el("text", { class: "fig-text", x: pA.sx(tau) + (tau > 9 ? -6 : 6), y: pA.m.t + 14, "text-anchor": tau > 9 ? "end" : "start" }, `τ = ${tau}`));
    // Lower figure: ΔRMST(τ) against τ with the IF band.
    const svgB = byId("ts-rmst"),
      ymax = Math.max(...d.map((e) => e.est + 1.96 * e.se), ...truthD) * 1.1,
      ymin = Math.min(-0.5, ...kmD, ...d.map((e) => e.est - 1.96 * e.se)) * 1.1,
      pB = new Plot(svgB, {
        x: [0, K],
        y: [ymin, ymax],
        width: W,
        height: Math.round(Math.max(250, Math.min(300, W * 0.55))),
        margin: { l: 46, r: 18, t: 24, b: 40 },
        xticks: [0, 2, 4, 6, 8, 10, 12],
        xlabel: "Horizon τ, months",
        ylabel: "ΔRMST(τ), months",
        tickFormat: (v) => fmt(v, 1),
      }),
      pts = (f) => Array.from({ length: K + 1 }, (_, t) => [t, f(t)]);
    pB.marks.append(
      el("path", {
        d: pB.d(pts((t) => d[t].est + 1.96 * d[t].se)) + " " + pB.d(pts((t) => d[t].est - 1.96 * d[t].se).reverse()).replace(/^M/, "L") + " Z",
        fill: "var(--purple)",
        "fill-opacity": 0.2,
        stroke: "none",
      }),
    );
    pB.hline(0, { stroke: "var(--muted)", style: "stroke-dasharray: none", opacity: 0.6 });
    pB.line(pts((t) => kmD[t]), { stroke: "var(--or)", "stroke-width": 2 });
    pB.line(pts((t) => truthD[t]), { stroke: "var(--green)", "stroke-dasharray": "7 5" });
    pB.line(pts((t) => d[t].est), { stroke: "var(--purple)", "stroke-width": 3 });
    pB.vline(tau, { stroke: "var(--ink)", opacity: 0.6 });
    pB.scatter([[tau, d[tau].est]], 5, { fill: "var(--purple)", stroke: "var(--paper)" });
    const e = d[tau],
      tA = [0, 1].map((a) => TS.tmle(A.rows, a, A.nu, TS.weightsRMST(tau), A.c)),
      eT = TS.contrast(tA[1], tA[0]),
      coxU = (A.coxU ||= TS.cox(A.rows, (o) => [o.a])),
      coxA = (A.coxA ||= TS.cox(A.rows, (o) => [o.a, +(o.x === 1), +(o.x === 2)])),
      hrCI = (c) => `${fmt(c.hr, 2)} (${fmt(Math.exp(c.beta[0] - 1.96 * c.se), 2)} to ${fmt(Math.exp(c.beta[0] + 1.96 * c.se), 2)})`;
    readout("ts-rmst-readout", [
      ["τ", `${tau} months`],
      ["RMST₁ one-step", fmt(a1.rmst[tau].est, 2)],
      ["RMST₀ one-step", fmt(a0.rmst[tau].est, 2)],
      ["ΔRMST one-step", fmt(e.est, 2)],
      ["95% IF CI", `${fmt(e.est - 1.96 * e.se, 2)} to ${fmt(e.est + 1.96 * e.se, 2)}`],
      ["ΔRMST truth", fmt(truthD[tau], 2)],
      ["unadjusted KM", fmt(kmD[tau], 2)],
    ]);
    byId("ts-rmst-caption").textContent =
      `Over the first ${tau} months, treating everyone rather than no one adds an estimated ${fmt(e.est, 2)} event-free months per patient (95% CI ${fmt(e.est - 1.96 * e.se, 2)} to ${fmt(e.est + 1.96 * e.se, 2)}); the truth is ${fmt(truthD[tau], 2)}. ` +
      `The shaded area between the curves is that difference. The unadjusted KM difference, ${fmt(kmD[tau], 2)}, ${kmD[tau] < 0 ? "even has the wrong sign" : "is biased"}.`;
    byId("ts-hr-table").innerHTML = table(
      ["Summary", "Estimate (95% CI)", "Truth", "Answers the months question?"],
      [
        [`ΔRMST(${tau}), one-step`, `${fmt(e.est, 2)} (${fmt(e.est - 1.96 * e.se, 2)} to ${fmt(e.est + 1.96 * e.se, 2)}) months`, fmt(truthD[tau], 2) + " months", "Yes"],
        [`ΔRMST(${tau}), TMLE`, `${fmt(eT.est, 2)} (${fmt(eT.est - 1.96 * eT.se, 2)} to ${fmt(eT.est + 1.96 * eT.se, 2)}) months`, fmt(truthD[tau], 2) + " months", "Yes"],
        [`ΔRMST(${tau}), unadjusted KM`, fmt(kmD[tau], 2) + " months", fmt(truthD[tau], 2) + " months", "Targets it, but biased here"],
        ["Cox HR, treatment only", hrCI(coxU), "no single value", "No: a ratio, confounded"],
        ["Cox HR, adjusted for severity", hrCI(coxA), "no single value", "No: conditional ratio, assumes PH"],
      ],
      `The same study (n = ${N}, seed ${A.seed}). Cox fits use Breslow ties.`,
    );
  }

  /* ---------- render ---------- */
  let queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      drawCurves();
      drawCurveTable();
      drawStrip();
      drawIF();
      drawDR();
      drawRMST();
    });
  }
  let lastSeed = state.get().seed,
    lastDR = "";
  state.subscribe((s) => {
    const key = s.drEvent + s.drNuis + s.drTarget;
    if (key !== lastDR && DR) {
      lastDR = key;
      requestAnimationFrame(() => drawDR(true));
    }
    if (s.seed !== lastSeed) lastSeed = s.seed;
    render();
  });
  lastDR = state.get().drEvent + state.get().drNuis + state.get().drTarget;
  // Draw synchronously once so every figure has content on arrival, then again after layout settles.
  drawCurves();
  drawCurveTable();
  drawStrip();
  drawIF();
  drawRMST();
  guided(root, state);
  tools(root, state);
  let lastW = root.getBoundingClientRect().width;
  if ("ResizeObserver" in window)
    new ResizeObserver(() => {
      const w = root.getBoundingClientRect().width;
      if (Math.abs(w - lastW) > 4) {
        lastW = w;
        render();
      }
    }).observe(root);
  window.addEventListener("causality:settings", render);
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail?.name === "targeted-survival") {
      arm = 1;
      byId("ts-arm").value = "1";
      stripPlayer.set(0);
      ifPlayer.set(0);
    }
  });
  window.TargetedSurvivalLab = { analysis, stripPlayer, ifPlayer };
})();
