/* Standard errors you can report. Kernels: science/core.js (study, AIPW) and
 * science/standard-errors.js (cell statistics, stacked sandwich, bootstrap, exact limits).
 * Repeated-sampling results are precomputed by scripts/standard-errors-precompute.cjs into
 * science/standard-errors-data.json; single-study figures are computed live. */
(function () {
  const { S, esc, store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player } = CausalAnim,
    SE = window.CausalSE,
    root = document.querySelector("[data-lab]"),
    CASES = ["both", "outcome", "propensity", "neither"],
    NAMES = {
      both: "Both models right",
      outcome: "Only the outcome model right",
      propensity: "Only the propensity model right",
      neither: "Both models wrong",
    },
    SHORT = {
      both: "both right",
      outcome: "only outcome right",
      propensity: "only propensity right",
      neither: "both wrong",
    },
    N = 400,
    DATA_URL = "../science/standard-errors-data.json",
    state = store(
      "standard-errors",
      {
        step: 0,
        case1: "both",
        case2: "propensity",
        study: 1,
        case4: "propensity",
        method: "boot",
      },
      {
        step: [0, 5],
        case1: CASES,
        case2: CASES,
        study: [1, 999],
        case4: CASES,
        method: ["boot", "sandwich"],
      },
    );
  const caseOptions = CASES.map(
    (c) => `<option value="${c}">${esc(NAMES[c])}</option>`,
  ).join("");
  const pct = (x) => (x * 100).toFixed(1) + "%";
  const f4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : "n/a");
  const swatch = (color, dash = "") =>
    `<svg class="swatch" width="28" height="10" aria-hidden="true"><line x1="1" y1="5" x2="27" y2="5" stroke="${color}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ""}/></svg>`;

  root.innerHTML = `
<section class="lab-step" data-title="What an SE estimates"><h2 tabindex="-1">A standard error is a guess about other studies</h2>
<p>Return to the one-step lesson's study: 400 patients, a binary severity X, a confounded treatment A, and a true average treatment effect of 2. You ran AIPW once and got one number. A standard error is a claim about numbers you did not get: how much that estimate would move if the whole study were run again on new patients.</p>
<p>In a simulation we can run the study again. Press Play to repeat it 300 times and watch the estimates pile up. The standard deviation of that pile is the quantity every standard error is trying to estimate from a single study. Call it the true SD.</p>
<div class="figure"><div class="fig-row"><div><svg id="se-pile" role="img" aria-label="Histogram of AIPW estimates from repeated studies, growing as more studies are run, with the true ATE as a dashed line and a bracket of plus or minus one standard deviation. Values are in the readout."></svg><div id="se-pile-player"></div></div><div><div class="fig-controls"><label>Nuisance case <select id="se-case1">${caseOptions}</select></label></div><div class="fig-readout" id="se-pile-readout" role="status"></div></div></div><p class="fig-caption">Each bar counts studies whose AIPW estimate fell in that bin. <span style="color:var(--green)">Green dashed line: true ATE = 2. Green bracket: mean ± 1 SD of the estimates so far.</span> The SD settles as studies accumulate; the readout also gives the value from all 2000 simulated studies.</p></div>
<p class="note">Simulated: the same seeded patients as the default run in the one-step simulation (n = 400, seed 20260919), extended to 2000 studies, with nuisances fitted without cross-fitting. The true SD is itself estimated, with a Monte Carlo error of about 0.0014.</p>
</section>

<section class="lab-step" data-title="The influence-function SE"><h2 tabindex="-1">One study, one formula: sd(φ̂)/√n</h2>
<p>From one study you cannot see the pile, so you estimate its width. AIPW is an average of per-patient values, one for each patient:</p>
<p class="math">φ̂ᵢ = m̂(Xᵢ,1) − m̂(Xᵢ,0) + Aᵢ/ĝ(Xᵢ)·(Yᵢ − m̂(Xᵢ,1)) − (1−Aᵢ)/(1−ĝ(Xᵢ))·(Yᵢ − m̂(Xᵢ,0)),&nbsp;&nbsp; ψ̂ = mean(φ̂ᵢ)</p>
<p>If the φ̂ᵢ were independent draws of a fixed function, the SE of their mean would be the usual sd/√n. That is the influence-function (IF) SE that the one-step lesson and the inference lab print. Each stick below is one patient's φ̂ᵢ − ψ̂.</p>
<div class="figure"><div class="fig-row"><div><svg id="se-sticks" role="img" aria-label="Influence-function values for the 400 patients of one study as vertical sticks from zero, grouped by severity and treatment, with dashed lines at plus and minus one standard deviation. Values are in the readout and the table."></svg><p class="legend legend-swatches"><span>${swatch("var(--p)")}Treated patient</span><span>${swatch("var(--teal)")}Control patient</span><span>${swatch("var(--ink)", "5 4")}± 1 sd(φ̂)</span></p></div><div><div class="fig-controls"><label>Nuisance case <select id="se-case2">${caseOptions}</select></label><label>Study number <input id="se-study" type="number" min="1" max="999" step="1"></label><button id="se-new-study" type="button">Draw a new study</button></div><div class="fig-readout" id="se-sticks-readout" role="status"></div></div></div><p class="fig-caption" id="se-sticks-caption"></p></div>
<div class="predict" data-options="All four fits give about the same SE|The SEs differ a lot, even where the estimates agree|The SEs agree, but the estimates differ" data-answer="1" data-hint="In this study X has two levels, so a saturated propensity or outcome fit makes AIPW collapse to the same stratified difference. The estimates for the first three fits nearly coincide, yet sd(φ̂) depends on the fitted nuisances.">Before you look at the table: the same 400 patients are analyzed with the four nuisance fits. What happens to the estimate and the IF SE?</div>
<div id="se-four-fits"></div>
<p>With both models right, sd(φ̂)/√n is close to the true SD. In the other rows it is not, even though the first three estimates are nearly the same number. Here is why they coincide: X has two levels, so a correct model for either nuisance is saturated, and AIPW then reduces exactly to the stratified difference Σₓ p̂ₓ(Ȳₓ₁ − Ȳₓ₀) (up to the small smoothing of ĝ). Same estimator, same true SD, three different IF SEs. The formula is reading the fitted nuisances, not the spread of the estimator.</p>
</section>

<section class="lab-step" data-title="Why they disagree"><h2 tabindex="-1">The IF formula pretends the nuisances were handed to you</h2>
<p>sd(φ̂)/√n treats m̂ and ĝ as if they were fixed functions known in advance. The estimate actually uses fitted models, and fitting moves ψ̂ too. Whether that matters depends on which model is wrong.</p>
<h3>Only the propensity model is right: the SE is too large</h3>
<div class="predict" data-options="AIPW with the true propensity varies less|AIPW with the estimated propensity varies less|They vary the same" data-answer="1" data-hint="The estimated propensity equals the treated share actually observed in each severity group, so the weights correct this sample's chance imbalance, not only the expected imbalance. Known 0.136 versus estimated 0.086.">Keep the wrong outcome model. Compare AIPW that plugs in the true propensity g₀(x) with AIPW that estimates it from the same data. Which estimate varies less across studies?</div>
<div class="figure"><div class="fig-row"><div><svg id="se-known" role="img" aria-label="Two histograms over the same 2000 studies: AIPW with the true propensity, wide, and AIPW with the estimated propensity, narrow. Values are in the readout."></svg><p class="legend legend-swatches"><span>${swatch("var(--muted)")}True propensity plugged in</span><span>${swatch("var(--purple)")}Propensity estimated</span><span>${swatch("var(--green)", "5 4")}True ATE</span></p></div><div><div class="fig-readout" id="se-known-readout" role="status"></div></div></div><p class="fig-caption">Same 2000 simulated studies, outcome model [1, A] in both. Estimating a correctly specified propensity makes the estimator less variable, which is the known phenomenon described by Hirano, Imbens and Ridder (2003) and by Lunceford and Davidian (2004).</p></div>
<p>The IF formula with ĝ plugged in is, in large samples, the SD of the known-propensity estimator: exactly 2.732/√400 = 0.137. The estimated-propensity estimator actually has SD 1.740/√400 = 0.087, the efficiency bound. Estimating ĝ subtracts the part of φ that lies along the propensity model's score, and the fixed-nuisance formula never subtracts it. So the interval is too wide and covers the truth about 99.8% of the time instead of 95%.</p>
<h3>Only the outcome model is right: the SE is too small</h3>
<p>Now the weights in φ̂ use a wrong, pooled propensity ḡ. In large samples the IF SE squared tends to [Var τ(X) + σ²(1/ḡ + 1/(1−ḡ))]/n, while the estimator's true variance is [Var τ(X) + σ²·E{1/g₀(X) + 1/(1−g₀(X))}]/n. Because 1/g is convex, E[1/g₀(X)] ≥ 1/E[g₀(X)] = 1/ḡ, so the formula is too small: exactly 0.081 against 0.087.</p>
<p>Which fitting step is missing? A natural guess is the estimation of the wrong propensity model. The stacked calculation below adds each model's estimation term separately, and it says otherwise. When the outcome model is right, the derivative of E[φ] with respect to the propensity is zero, so estimating ĝ contributes nothing. The missing piece is the estimation of the outcome model, whose contribution does not vanish when the weights are wrong.</p>
<div id="se-decomp"></div>
<p class="note">Exact: the large-sample limits, computed from the known law. Simulated: the averages over 2000 studies. The stacked sandwich treats the outcome regression, the propensity proportions and the AIPW mean as one system of estimating equations (Stefanski and Boos, 2002); its influence function is φ − ψ̂ plus a term for each fitted model.</p>
</section>

<section class="lab-step" data-title="The bootstrap"><h2 tabindex="-1">Resample patients, refit everything, re-estimate</h2>
<p>The nonparametric bootstrap asks the data to play the role of new studies. Draw 400 patients with replacement from your 400, refit both nuisance models on that resample, recompute AIPW, and repeat. The SD of the re-estimates is the bootstrap SE (Efron and Tibshirani, 1993). Because the models are refitted every time, fitting variability is in the SE automatically, whichever model is wrong.</p>
<div class="figure"><div class="fig-row"><div><svg id="se-boot" role="img" aria-label="Histogram of bootstrap re-estimates for one study growing as resamples are added, with three horizontal bars of plus or minus one standard error: bootstrap, influence function, and the true SD. Values are in the readout."></svg><div id="se-boot-player"></div></div><div><div class="fig-controls"><label>Nuisance case <select id="se-case4">${caseOptions}</select></label></div><div class="fig-readout" id="se-boot-readout" role="status"></div></div></div><p class="fig-caption" id="se-boot-caption"></p></div>
<div class="predict" data-options="Smaller than the IF SE of 0.081|About the true SD, 0.086|Larger than the true SD" data-answer="1" data-hint="Each resample refits the outcome model, so the outcome-model term the IF formula dropped is back in. Average bootstrap SE 0.087.">Only the outcome model is right, and the IF SE (0.081) is too small. Over 2000 studies, what will the average bootstrap SE be?</div>
<div id="se-boot-table"></div>
<p>The bootstrap and the stacked sandwich both land on the true SD in all four cases, and their intervals cover about 95% of the time in the first three. In the fourth case every SE is right and coverage is still 0%: the estimate is centred at 2.64, not 2. A standard error measures spread, not bias. No choice of SE rescues an estimator that is aimed at the wrong target.</p>
</section>

<section class="lab-step" data-title="Four cases at a glance"><h2 tabindex="-1">Four cases, three bars</h2>
<p>Each panel shows the 2000 AIPW estimates and three bars of ± 1 SE centred on their mean: the true SD, the average IF SE, and the average of the second method. The large numbers are the coverage of 95% intervals built from each SE.</p>
<div class="fig-controls se-method"><label>Second method <select id="se-method"><option value="boot">Nonparametric bootstrap (B = 500)</option><option value="sandwich">Stacked estimating-equation sandwich</option></select></label></div>
<p class="legend legend-swatches"><span>${swatch("var(--green)")}True SD (over studies)</span><span>${swatch("var(--p)")}IF SE</span><span>${swatch("var(--teal)")}<span id="se-method-name">Bootstrap SE</span></span><span>${swatch("var(--green)", "5 4")}True ATE = 2</span></p>
<div class="se-grid" id="se-grid"></div>
<div id="se-grid-table"></div>
</section>

<section class="lab-step" data-title="What to report"><h2 tabindex="-1">A recipe you can write into the SAP</h2>
<ol class="se-recipe">
<li><strong>Flexible learners with cross-fitting.</strong> When both nuisances are estimated well enough that the product of their errors shrinks faster than 1/√n (the product-rate condition from the inference lab), the fitting terms vanish in large samples and the IF SE is valid. This is the setting TMLE and double machine learning are designed for.</li>
<li><strong>Parametric working models, one of which may be wrong.</strong> The IF SE can be too large or too small. Report a nonparametric bootstrap that refits both models in every resample, or a stacked estimating-equation sandwich. They agreed with the true SD in all four cases here.</li>
<li><strong>Report the IF SE as a diagnostic.</strong> If it and the bootstrap disagree clearly, at least one working model is probably wrong. The point estimate is still consistent if the other model is right, but the IF interval is not the one to report.</li>
<li><strong>No SE fixes bias.</strong> When both models are wrong, every method here estimates the spread correctly and every interval misses.</li>
</ol>
<p>A sentence for the statistical analysis plan: <em>"The ATE will be estimated by AIPW with a logistic propensity model and a linear outcome model, both prespecified. The primary 95% confidence interval will use the nonparametric bootstrap SE (2000 resamples of patients, refitting both models in each resample; resamples in which a model cannot be fitted will be redrawn and counted). The influence-function SE will be reported as a sensitivity analysis."</em></p>
<h3>Where the walkthrough numbers came from</h3>
<p>The numbers that started this lesson (IF SE 0.142 against SD 0.096; coverage about 92%) came from the one-step simulation, whose default fits the nuisances with two-fold cross-fitting. This lesson switches cross-fitting off, so that the estimator is a plain M-estimator and the stacked sandwich applies. Cross-fitting does not change the story when a parametric model is wrong:</p>
<div id="se-crossfit"></div>
<h3>In base R</h3>
<p>Twenty-six lines, base R only, for the only-propensity-right case. With this seed it prints an IF SE of 0.138 and a bootstrap SE of 0.090.</p>
<pre class="se-code"><code>${esc(`# AIPW for the ATE with an influence-function SE and a bootstrap SE (base R only)
set.seed(2026)
n <- 400
x <- rbinom(n, 1, 0.35)
a <- rbinom(n, 1, plogis(-0.8 + 1.6 * x))
y <- 0.5 + x + 0.6 * x^2 + a * (2 + 0.4 * (x - 0.35)) + rnorm(n, 0, 0.8)
d <- data.frame(x, a, y)

aipw <- function(d) {
  om <- lm(y ~ a, data = d)                      # outcome model (misspecified here)
  ps <- glm(a ~ x, family = binomial, data = d)  # propensity model (correct here)
  g  <- fitted(ps)
  m1 <- predict(om, transform(d, a = 1))
  m0 <- predict(om, transform(d, a = 0))
  phi <- m1 - m0 + d$a / g * (d$y - m1) - (1 - d$a) / (1 - g) * (d$y - m0)
  c(est = mean(phi), if_se = sd(phi) / sqrt(nrow(d)))
}

fit <- aipw(d)
B <- 1000
boot <- replicate(B, aipw(d[sample.int(n, replace = TRUE), ])["est"])
boot_se <- sd(boot)

round(c(fit, boot_se = boot_se), 3)
cat("95% CI, IF SE:        ", round(fit["est"] + c(-1, 1) * 1.96 * fit["if_se"], 3), "\\n")
cat("95% CI, bootstrap SE: ", round(fit["est"] + c(-1, 1) * 1.96 * boot_se, 3), "\\n")`)}</code></pre>
<p class="note">What is exact, simulated and schematic here. Exact: the large-sample limits (true SD and the limit of the IF SE) computed from the known data-generating law, and the identity that AIPW reduces to the stratified difference with a saturated nuisance fit. Simulated: all repeated-study summaries (2000 studies of n = 400, B = 500 bootstrap resamples each, seeded; coverage Monte Carlo error about 0.5 percentage points). Computed live: the single-study figures in steps 2 and 4. The collapse to one estimator is special to this binary-covariate example. The direction of the error when only the propensity is right holds generally for a correctly specified propensity fitted by maximum likelihood (estimating it removes a projection, so ignoring that is conservative). The direction when only the outcome model is right comes from the Jensen argument for this example and can differ in other settings, which is one more reason to bootstrap rather than to guess.</p>
</section>`;

  const byId = (id) => document.getElementById(id);
  [
    ["se-case1", "case1"],
    ["se-case2", "case2"],
    ["se-study", "study"],
    ["se-case4", "case4"],
    ["se-method", "method"],
  ].forEach(([id, key]) => control(byId(id), state, key));
  byId("se-new-study").onclick = () =>
    state.set({ study: (state.get().study % 999) + 1 });

  const readout = (id, pairs) =>
    byId(id).replaceChildren(
      ...pairs.flatMap(([k, v]) => [
        html("span", { class: "k" }, k),
        html("span", {}, String(v)),
      ]),
    );

  let DATA = null;
  /* Interior ticks only, so the first x label never collides with the y-axis zero. */
  const innerTicks = (lo, hi) =>
    [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.round((lo + f * (hi - lo)) * 100) / 100);
  /* Phones get a narrower viewBox so that text set in viewBox units stays legible. */
  const narrow = () => root.clientWidth > 0 && root.clientWidth < 560,
    W = () => (narrow() ? 380 : 600);

  /* ---------- shared drawing: histogram with ± 1 SE bars above it ---------- */
  function histBars(plot, counts, lo, hi, attrs) {
    const w = (hi - lo) / counts.length;
    plot.bars(
      counts.map((c, i) => [lo + (i + 0.5) * w, c]),
      w * 0.92,
      attrs,
    );
  }
  /* Bars: [{label, value, color}] drawn as horizontal ± value segments at `center`,
   * stacked in the band above the histogram, each labelled to its right. */
  function seBars(plot, center, bars, yTop, step) {
    bars.forEach((b, k) => {
      const y = yTop - k * step,
        x0 = plot.sx(center - b.value),
        x1 = plot.sx(center + b.value),
        Y = plot.sy(y);
      plot.marks.append(
        el("line", { x1: x0, x2: x1, y1: Y, y2: Y, stroke: b.color, "stroke-width": 5, "stroke-linecap": "butt" }),
        el("line", { x1: x0, x2: x0, y1: Y - 6, y2: Y + 6, stroke: b.color, "stroke-width": 2 }),
        el("line", { x1: x1, x2: x1, y1: Y - 6, y2: Y + 6, stroke: b.color, "stroke-width": 2 }),
      );
      plot.fg.append(
        el("text", { class: "fig-text", x: x1 + 8, y: Y + 4, fill: b.color }, `${b.label} ${b.value.toFixed(3)}`),
      );
    });
  }

  /* ---------- Step 1: the pile of estimates ---------- */
  let pileK = 60; // matches pilePlayer.set(0.2) below
  function drawPile() {
    const svg = byId("se-pile");
    if (!DATA) {
      readout("se-pile-readout", [["Status", "Loading precomputed studies"]]);
      return;
    }
    const c = state.get().case1,
      d = DATA.cases[c],
      lo = d.hist.min,
      hi = d.hist.max,
      bins = 40,
      w = (hi - lo) / bins,
      stream = d.stream,
      k = Math.max(5, Math.min(stream.length, pileK)),
      shown = stream.slice(0, k),
      counts = Array(bins).fill(0);
    shown.forEach((v) => {
      const b = Math.floor((v - lo) / w);
      if (b >= 0 && b < bins) counts[b]++;
    });
    const all = Array(bins).fill(0);
    stream.forEach((v) => {
      const b = Math.floor((v - lo) / w);
      if (b >= 0 && b < bins) all[b]++;
    });
    const ymax = Math.max(...all) * 1.35 + 2,
      plot = new Plot(svg, {
        x: [lo, hi],
        y: [0, ymax],
        width: W(),
        height: 300,
        xlabel: "AIPW estimate in each repeated study",
        xticks: innerTicks(lo, hi),
        tickFormat: (v) => fmt(v, 2),
        ylabel: "studies",
      });
    histBars(plot, counts, lo, hi, { fill: "var(--purple)", "fill-opacity": 0.45, stroke: "var(--purple)", "stroke-width": 0.6 });
    if (lo <= 2 && 2 <= hi)
      plot.vline(2, { stroke: "var(--green)" });
    else
      plot.text(lo + 0.01 * (hi - lo), ymax * 0.6, "← true ATE 2 (off scale)", { fill: "var(--green)" });
    const m = S.mean(shown),
      sd = shown.length > 1 ? Math.sqrt(S.variance(shown)) : 0;
    seBars(plot, m, [{ label: "SD", value: sd, color: "var(--green)" }], ymax * 0.9, 0);
    readout("se-pile-readout", [
      ["Case", SHORT[c]],
      ["Studies so far", k],
      ["Mean estimate", fmt(m, 3)],
      ["SD so far", f4(sd)],
      ["SD, all 2000", f4(d.summary.sd)],
      ["Truth", "2"],
    ]);
  }
  const pilePlayer = player(byId("se-pile-player"), {
    duration: 7000,
    label: "Studies run",
    formatValue: (t) => String(Math.max(5, Math.round(t * 300))),
    onT: (t) => {
      pileK = Math.max(5, Math.round(t * 300));
      drawPile();
    },
  });

  pilePlayer.set(0.2);

  /* ---------- Step 2: influence-function sticks for one study ---------- */
  const studyRows = (() => {
    const cache = new Map();
    return (k) => {
      if (!cache.has(k)) cache.set(k, S.generate(N, S.rng(20260000 + k)));
      return cache.get(k);
    };
  })();
  function drawSticks() {
    const { case2, study } = state.get(),
      rows = studyRows(study),
      fits = Object.fromEntries(
        CASES.map((c) => [c, S.estimate(rows, { preset: c, mode: "fitted", crossfit: false })]),
      ),
      f = fits[case2],
      ymax = Math.ceil(
        Math.max(...CASES.map((c) => Math.max(...fits[c].values.map((v) => Math.abs(v - fits[c].aipw))))),
      ),
      groups = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      GAP = 10,
      order = [];
    let pos = 0;
    const centers = [];
    groups.forEach(([x, a]) => {
      const idx = rows
        .map((r, i) => i)
        .filter((i) => rows[i].x === x && rows[i].a === a)
        .sort((i, j) => f.values[i] - f.values[j]);
      const start = pos;
      idx.forEach((i) => order.push([pos++, i]));
      centers.push([(start + pos - 1) / 2, x, a]);
      pos += GAP;
    });
    const plot = new Plot(byId("se-sticks"), {
      x: [-4, pos - GAP + 4],
      y: [-ymax, ymax],
      width: W(),
      height: 320,
      xticks: [],
      margin: { b: 50 },
      ylabel: "IF value minus estimate",
    });
    const g = plot.layer();
    order.forEach(([p, i]) => {
      const v = f.values[i] - f.aipw;
      g.append(
        el("line", {
          x1: plot.sx(p),
          x2: plot.sx(p),
          y1: plot.sy(0),
          y2: plot.sy(v),
          stroke: rows[i].a ? "var(--p)" : "var(--teal)",
          "stroke-width": 1.2,
        }),
      );
    });
    const sd = Math.sqrt(S.variance(f.values));
    plot.line([[-4, 0], [pos - GAP + 4, 0]], { stroke: "var(--muted)", "stroke-width": 1 });
    [sd, -sd].forEach((v) =>
      plot.line([[-4, v], [pos - GAP + 4, v]], { stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "5 4" }),
    );
    centers.forEach(([c, x, a]) => {
      plot.bg.append(
        el("text", { class: "tick", x: plot.sx(c), y: plot.H - plot.m.b + 17, "text-anchor": "middle" }, `X=${x}`),
        el("text", { class: "tick", x: plot.sx(c), y: plot.H - plot.m.b + 34, "text-anchor": "middle" }, `A=${a}`),
      );
    });
    const trueSD = DATA ? DATA.cases[case2].summary.sd : null;
    readout("se-sticks-readout", [
      ["Case", SHORT[case2]],
      ["Study", study],
      ["AIPW ψ̂", fmt(f.aipw, 3)],
      ["sd(φ̂)", fmt(sd, 3)],
      ["√n", "20"],
      ["IF SE", f4(f.se)],
      ["True SD", trueSD ? f4(trueSD) : "loading"],
    ]);
    byId("se-sticks-caption").textContent =
      `${NAMES[case2]}. Patients are grouped by severity X and treatment A and sorted within each group. sd(φ̂) = ${fmt(sd, 3)}, so the IF SE is ${fmt(sd, 3)}/√400 = ${f4(f.se)}. The vertical scale is shared by the four cases, so you can compare their spread.`;
    byId("se-four-fits").innerHTML = table(
      ["Nuisance fit", "AIPW estimate", "IF SE", "True SD over studies"],
      CASES.map((c) => [
        NAMES[c],
        f4(fits[c].aipw),
        f4(fits[c].se),
        DATA ? f4(DATA.cases[c].summary.sd) : "loading",
      ]),
      `Study ${study}: the same 400 patients analyzed four ways`,
    );
  }

  /* ---------- Step 3: known versus estimated propensity; the stacked decomposition ---------- */
  function drawKnown() {
    if (!DATA) return;
    const est = DATA.cases.propensity,
      kn = DATA.knownPropensity,
      lo = est.hist.min,
      hi = est.hist.max,
      ymax = Math.max(...est.hist.counts, ...kn.hist.counts) * 1.1,
      plot = new Plot(byId("se-known"), {
        x: [lo, hi],
        y: [0, ymax],
        width: W(),
        height: 280,
        xlabel: "AIPW estimate (outcome model wrong)",
        xticks: innerTicks(lo, hi),
        tickFormat: (v) => fmt(v, 2),
        ylabel: "studies",
      });
    histBars(plot, est.hist.counts, lo, hi, { fill: "var(--purple)", "fill-opacity": 0.45, stroke: "var(--purple)", "stroke-width": 0.6 });
    const w = (hi - lo) / kn.hist.counts.length,
      pts = [];
    kn.hist.counts.forEach((c, i) => {
      pts.push([lo + i * w, c], [lo + (i + 1) * w, c]);
    });
    plot.line([[lo, 0], ...pts, [hi, 0]], { stroke: "var(--muted)", "stroke-width": 2 });
    plot.vline(2, { stroke: "var(--green)" });
    readout("se-known-readout", [
      ["Known g: SD", f4(kn.summary.sd)],
      ["Known g: IF SE", f4(kn.summary.ifSE)],
      ["Known g: coverage", pct(kn.summary.ifCoverage.rate)],
      ["Fitted g: SD", f4(est.summary.sd)],
      ["Fitted g: IF SE", f4(est.summary.ifSE)],
      ["Fitted g: coverage", pct(est.summary.ifCoverage.rate)],
      ["Exact SD, known g", f4(kn.asymptotic.trueSD)],
      ["Exact SD, fitted g", f4(est.asymptotic.trueSD)],
    ]);
    byId("se-decomp").innerHTML = table(
      ["Case", "IF SE", "+ outcome-model term", "+ propensity-model term", "Full stacked sandwich", "True SD", "Exact: IF limit", "Exact: true SD"],
      CASES.map((c) => {
        const s = DATA.cases[c].summary,
          a = DATA.cases[c].asymptotic;
        return [
          NAMES[c],
          f4(s.ifSE),
          f4(s.outcomeTermSE),
          f4(s.propensityTermSE),
          f4(s.sandwichSE),
          f4(s.sd),
          f4(a.ifSD),
          f4(a.trueSD),
        ];
      }),
      "Adding each model's estimation term to the IF (averages over 2000 studies, n = 400)",
    );
  }

  /* ---------- Step 4: live bootstrap for the step-2 study ---------- */
  const BOOT_B = 500;
  let bootCache = { key: null, reps: null, fit: null },
    bootB = Math.round(10 + 0.2 * 490);
  function bootFor(c, study) {
    const key = c + ":" + study;
    if (bootCache.key !== key) {
      const rows = studyRows(study);
      bootCache = {
        key,
        reps: SE.bootstrap(rows, c, BOOT_B, S.rng(99000 + study)).reps,
        fit: SE.estimate(rows, c),
      };
    }
    return bootCache;
  }
  function drawBoot() {
    const { case4, study } = state.get(),
      bc = bootFor(case4, study),
      b = Math.max(10, Math.min(BOOT_B, bootB)),
      shown = bc.reps.slice(0, b),
      center = Math.round(bc.fit.aipw * 20) / 20,
      lo = center - 0.5,
      hi = center + 0.5,
      bins = 40,
      w = (hi - lo) / bins,
      countsOf = (arr) => {
        const out = Array(bins).fill(0);
        arr.forEach((v) => {
          const k = Math.floor((v - lo) / w);
          if (k >= 0 && k < bins) out[k]++;
        });
        return out;
      },
      finalMax = Math.max(...countsOf(bc.reps)),
      ymax = finalMax * 1.7 + 2,
      plot = new Plot(byId("se-boot"), {
        x: [lo, hi],
        y: [0, ymax],
        width: W(),
        height: 320,
        xlabel: "Bootstrap re-estimates of AIPW for one study",
        xticks: innerTicks(lo, hi),
        tickFormat: (v) => fmt(v, 2),
        ylabel: "resamples",
      });
    histBars(plot, countsOf(shown), lo, hi, { fill: "var(--teal)", "fill-opacity": 0.4, stroke: "var(--teal)", "stroke-width": 0.6 });
    plot.vline(bc.fit.aipw, { stroke: "var(--purple)", "stroke-dasharray": "none", "stroke-width": 2 });
    const bse = Math.sqrt(S.variance(shown)),
      trueSD = DATA ? DATA.cases[case4].summary.sd : null,
      bars = [
        { label: "Boot", value: bse, color: "var(--teal)" },
        { label: "IF", value: bc.fit.se, color: "var(--p)" },
      ];
    if (trueSD) bars.push({ label: "True SD", value: trueSD, color: "var(--green)" });
    seBars(plot, bc.fit.aipw, bars, ymax * 0.93, ymax * 0.11);
    readout("se-boot-readout", [
      ["Case", SHORT[case4]],
      ["Study", study],
      ["AIPW ψ̂", fmt(bc.fit.aipw, 3)],
      ["Resamples", b],
      ["Bootstrap SE", f4(bse)],
      ["IF SE", f4(bc.fit.se)],
      ["True SD", trueSD ? f4(trueSD) : "loading"],
    ]);
    byId("se-boot-caption").textContent =
      `Study ${study} from step 2, ${SHORT[case4]}. Each resample of 400 patients refits both nuisance models before re-estimating. Purple line: this study's estimate. Bars show ± 1 SE around it. With ${b} resamples the bootstrap SE is ${f4(bse)}; the IF SE is ${f4(bc.fit.se)}.`;
  }
  const bootPlayer = player(byId("se-boot-player"), {
    duration: 7000,
    label: "Resamples",
    formatValue: (t) => String(Math.max(10, Math.round(10 + t * (BOOT_B - 10)))),
    onT: (t) => {
      bootB = Math.round(10 + t * (BOOT_B - 10));
      drawBoot();
    },
  });
  bootPlayer.set(0.2);
  function drawBootTable() {
    if (!DATA) return;
    byId("se-boot-table").innerHTML = table(
      ["Case", "True SD", "IF SE", "Bootstrap SE", "Sandwich SE", "Coverage: IF", "Coverage: bootstrap", "Coverage: percentile", "Coverage: sandwich"],
      CASES.map((c) => {
        const s = DATA.cases[c].summary;
        return [
          NAMES[c],
          f4(s.sd),
          f4(s.ifSE),
          f4(s.bootSE),
          f4(s.sandwichSE),
          pct(s.ifCoverage.rate),
          pct(s.bootCoverage.rate),
          pct(s.percentileCoverage.rate),
          pct(s.sandwichCoverage.rate),
        ];
      }),
      "2000 studies of n = 400, B = 500 resamples each. SEs are averages over studies; intervals are estimate ± 1.96 SE, or the 2.5% to 97.5% bootstrap percentiles",
    );
  }

  /* ---------- Step 5: the 2 × 2 grid ---------- */
  function drawGrid() {
    const grid = byId("se-grid"),
      method = state.get().method,
      mName = method === "boot" ? "Bootstrap" : "Sandwich",
      mBar = method === "boot" ? "Boot" : "Sandwich";
    byId("se-method-name").textContent = mName + " SE";
    if (!DATA) {
      grid.textContent = "Loading precomputed studies.";
      return;
    }
    grid.replaceChildren();
    const ymaxAll = Math.max(...CASES.map((c) => Math.max(...DATA.cases[c].hist.counts)));
    CASES.forEach((c) => {
      const d = DATA.cases[c],
        s = d.summary,
        other = method === "boot" ? s.bootSE : s.sandwichSE,
        otherCov = method === "boot" ? s.bootCoverage : s.sandwichCoverage,
        fig = html("figure", { class: "se-panel" }),
        svg = el("svg", {
          role: "img",
          "aria-label": `${NAMES[c]}: sampling distribution of AIPW with true SD ${fmt(s.sd, 3)}, IF SE ${fmt(s.ifSE, 3)}, ${mName.toLowerCase()} SE ${fmt(other, 3)}; coverage ${pct(s.ifCoverage.rate)} with the IF SE and ${pct(otherCov.rate)} with the ${mName.toLowerCase()} SE.`,
        });
      const covCls = (r) => (Math.abs(r - 0.95) <= 0.015 ? "ok" : "bad");
      fig.innerHTML = `<figcaption><span class="se-panel-title">${esc(NAMES[c])}</span><span class="se-cov"><span class="se-cov-item ${covCls(s.ifCoverage.rate)}"><span class="se-cov-num" style="color:var(--p)">${pct(s.ifCoverage.rate)}</span><span class="se-cov-lab">IF coverage</span></span><span class="se-cov-item ${covCls(otherCov.rate)}"><span class="se-cov-num" style="color:var(--teal)">${pct(otherCov.rate)}</span><span class="se-cov-lab">${mName.toLowerCase()} coverage</span></span></span></figcaption>`;
      fig.append(svg);
      grid.append(fig);
      const lo = d.hist.min,
        hi = d.hist.max,
        ymax = ymaxAll * 1.75,
        plot = new Plot(svg, {
          x: [lo, hi],
          y: [0, ymax],
          width: 400,
          height: 290,
          margin: { l: 16, r: 14, t: 12, b: 40 },
          yticks: [],
          grid: false,
          xticks: [lo + 0.1, lo + 0.3, lo + 0.5, lo + 0.7, lo + 0.9].map((v) => Math.round(v * 100) / 100),
          tickFormat: (v) => fmt(v, 2),
          xlabel: "AIPW estimate",
        });
      histBars(plot, d.hist.counts, lo, hi, { fill: "var(--purple)", "fill-opacity": 0.45, stroke: "var(--purple)", "stroke-width": 0.6 });
      if (lo <= 2 && 2 <= hi) plot.vline(2, { stroke: "var(--green)" });
      else plot.text(lo + 0.02, ymax * 0.55, "← truth 2 (off scale)", { fill: "var(--green)", class: "fig-text" });
      seBars(
        plot,
        s.mean,
        [
          { label: "True SD", value: s.sd, color: "var(--green)" },
          { label: "IF", value: s.ifSE, color: "var(--p)" },
          { label: mBar, value: other, color: "var(--teal)" },
        ],
        ymax * 0.92,
        ymax * 0.12,
      );
    });
    byId("se-grid-table").innerHTML = table(
      ["Case", "Bias", "True SD", "IF SE", mName + " SE", "IF coverage", mName + " coverage"],
      CASES.map((c) => {
        const s = DATA.cases[c].summary;
        return [
          NAMES[c],
          fmt(s.bias, 3),
          f4(s.sd),
          f4(s.ifSE),
          f4(method === "boot" ? s.bootSE : s.sandwichSE),
          pct(s.ifCoverage.rate),
          pct((method === "boot" ? s.bootCoverage : s.sandwichCoverage).rate),
        ];
      }),
      "Numbers behind the four panels (2000 studies, n = 400; coverage Monte Carlo error about 0.5 percentage points)",
    );
  }

  /* ---------- Step 6: cross-fitting table ---------- */
  function drawCrossfit() {
    if (!DATA) return;
    byId("se-crossfit").innerHTML = table(
      ["Case", "True SD", "IF SE", "IF coverage"],
      CASES.map((c) => {
        const r = DATA.crossfit[c];
        return [NAMES[c], f4(r.sd), f4(r.ifSE), pct(r.coverage)];
      }),
      "Two-fold cross-fitting, same 2000 studies (IF SE only)",
    );
  }

  function render() {
    drawPile();
    drawSticks();
    drawKnown();
    drawBoot();
    drawBootTable();
    drawGrid();
    drawCrossfit();
  }
  state.subscribe(render);
  render();
  let wasNarrow = narrow();
  window.addEventListener("resize", () => {
    if (narrow() !== wasNarrow) {
      wasNarrow = narrow();
      render();
    }
  });
  fetch(DATA_URL)
    .then((r) => {
      if (!r.ok) throw Error("HTTP " + r.status);
      return r.json();
    })
    .then((d) => {
      DATA = d;
      render();
    })
    .catch((e) => {
      const msg = `The precomputed results (${DATA_URL}) could not be loaded: ${e.message}. Serve the course over HTTP; the single-study figures still work.`;
      ["se-pile-readout", "se-known-readout"].forEach((id) =>
        byId(id).replaceChildren(html("span", { class: "k" }, "Status"), html("span", {}, msg)),
      );
      byId("se-grid").textContent = msg;
    });
  guided(root, state);
  tools(root, state);
  window.addEventListener("causality:lab-reset", (e) => {
    if (e.detail?.name === "standard-errors") {
      pilePlayer.set(0.2);
      bootPlayer.set(0.2);
    }
  });
  window.StandardErrorsLab = { state, pilePlayer, bootPlayer };
})();
