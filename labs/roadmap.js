(function () {
  const { S, V, store, control, tools, guided, table, fmt } = CausalLab,
    root = document.querySelector("[data-lab]");
  const state = store(
    "roadmap",
    {
      step: 0,
      p: 0.35,
      target: "ate",
      gHigh: S.trueG(1),
      hidden: 0,
      exchange: true,
      consistent: true,
    },
    {
      step: [0, 3],
      p: [0.05, 0.9],
      target: ["ate", "att"],
      gHigh: [0, 1],
      hidden: [-1, 1],
    },
  );
  root.innerHTML = `<section class="lab-step" data-title="Question"><h2 tabindex="-1">An analysis begins with a question</h2><p>Consider a synthetic cohort. Severity is measured before treatment. We ask how much an outcome at one year would change if everyone received treatment rather than everyone receiving control. Larger outcomes are better.</p><p>Only one potential outcome is observed for each patient. A regression coefficient does not choose the population, intervention, outcome, or time for us.</p><div class="lab-grid"><div><label>Whose effect? <select id="target"><option value="ate">Everyone in the target population (ATE)</option><option value="att">Those who actually received treatment (ATT)</option></select></label><label>High-severity proportion <input id="population" type="range" min=".05" max=".9" step=".01"></label><p id="population-value"></p><p class="math" id="target-formula"></p></div><div class="lab-card"><h3>Your estimand contract</h3><p>Population: the selected cohort.<br>Interventions: treatment versus control, assigned at baseline.<br>Outcome: numerical outcome at one year.<br>Summary: average individual difference.</p><button id="save-contract">Save this contract across lessons</button><p id="contract-status" role="status"></p></div></div></section>
<section class="lab-step" data-title="Identify"><h2 tabindex="-1">Why comparing the two observed groups can mislead</h2><p>Severity affects both treatment and outcome. Treatment is more common among high-severity patients. First compare the observed groups; then compare treatment and control within each severity group and average using your target population.</p><svg id="dag" viewBox="0 0 600 180" role="img" aria-label="Severity points to treatment and outcome; treatment points to outcome."><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs><g stroke="currentColor" fill="none" marker-end="url(#arrow)"><path d="M280 40L110 115M320 40L490 115M150 140H450"/></g><text x="300" y="30" text-anchor="middle">Severity X</text><text x="100" y="155" text-anchor="middle">Treatment A</text><text x="500" y="155" text-anchor="middle">Outcome Y</text></svg><div id="study-values"></div><div class="metric-grid" id="study-metrics"></div><details class="formula-details"><summary>Name the operation: identification by adjustment</summary><p class="math">ATE = Σₓ [m₁(x) − m₀(x)] P(X=x)<br>mₐ(x) = E[Y | A=a, X=x]</p><p>This observed-data expression equals the causal target under consistency, conditional exchangeability, and treatment positivity for the target population. For ATT, average over X among treated people and require controls wherever treated people occur.</p></details></section>
<section class="lab-step" data-title="Break an assumption"><h2 tabindex="-1">Some gaps cannot be repaired by a better estimator</h2><label><span><input id="exchange" type="checkbox"> Severity captures the common causes of treatment and outcome</span></label><label><span><input id="consistent" type="checkbox"> Treatment is well defined and observed outcomes match the corresponding intervention</span></label><label>Treatment probability among high-severity patients <input id="g-high" type="range" min="0" max="1" step=".01"></label><p id="positivity-status"></p><label>Unobserved counterfactual shift (when exchangeability is removed) <input id="hidden-shift" type="range" min="-1" max="1" step=".1"></label><p id="identification-status" class="warning" role="status"></p><p>Two possible worlds can have exactly the same observed patients. In the second world, add κ to Y(1) for the untreated and subtract κ from Y(0) for the treated. Their observed outcomes stay fixed, but their population ATE changes by κ. Observed data alone cannot select between those worlds.</p><p class="note">A zero population propensity is a structural absence. A positive propensity can still produce an empty cell in a small sample. Those are different problems.</p></section>
<section class="lab-step" data-title="Roadmap"><h2 tabindex="-1">Keep the question while the tools change</h2><ol class="road-list"><li><b>Question:</b> choose the population, interventions, outcome, horizon, and contrast.</li><li><b>Identification:</b> state why a causal target equals a function of observed data.</li><li><b>Model:</b> say which probability distributions are allowed. The nonparametric model leaves their shapes unrestricted; semiparametric models combine finite and infinite dimensional components.</li><li><b>Estimation:</b> choose how to learn that function from a sample.</li><li><b>Uncertainty:</b> justify the approximation behind an interval.</li><li><b>Interpretation:</b> answer the original question with its assumptions and limitations.</li></ol><p>Cox regression is already a semiparametric model: a finite coefficient vector and an unspecified baseline hazard. Kaplan–Meier is a nonparametric survival estimator under its censoring conditions. The journey is to make those choices explicit and connect them to the target.</p><a class="course-btn" href="10-canonical-gradient.html">Next: hold a probability distribution in your hands →</a></section>`;
  [
    ["target", "target"],
    ["population", "p"],
    ["g-high", "gHigh"],
    ["hidden-shift", "hidden"],
    ["exchange", "exchange"],
    ["consistent", "consistent"],
  ].forEach(([id, key]) => control(document.getElementById(id), state, key));
  function render() {
    const c = state.get(),
      p = c.p,
      g = [S.trueG(0), c.gHigh],
      w = [1 - p, p],
      pa = S.dot(w, g),
      wt = w.map((v, i) => (v * g[i]) / pa),
      wc = w.map((v, i) => (v * (1 - g[i])) / (1 - pa)),
      tau = [0, 1].map((x) => S.trueM(x, 1) - S.trueM(x, 0)),
      ate = S.dot(w, tau),
      att = S.dot(wt, tau),
      naive =
        S.dot(
          wt,
          [0, 1].map((x) => S.trueM(x, 1)),
        ) -
        S.dot(
          wc,
          [0, 1].map((x) => S.trueM(x, 0)),
        ),
      target = c.target === "ate" ? ate : att;
    document.getElementById("population-value").textContent =
      fmt(p * 100, 0) + "% high severity";
    document.getElementById("target-formula").textContent =
      c.target === "ate" ? "E[Y(1) − Y(0)]" : "E[Y(1) − Y(0) | A=1]";
    document.getElementById("study-values").innerHTML = table(
      ["Severity", "Population share", "g(x)", "m₀(x)", "m₁(x)", "Effect"],
      [0, 1].map((x) => [
        x ? "High" : "Low",
        fmt(w[x]),
        fmt(g[x]),
        fmt(S.trueM(x, 0)),
        fmt(S.trueM(x, 1)),
        fmt(tau[x]),
      ]),
    );
    const identified =
      c.exchange &&
      c.consistent &&
      (c.target === "att" ? c.gHigh < 1 : c.gHigh > 0 && c.gHigh < 1);
    document.getElementById("study-metrics").innerHTML =
      `<div>Observed group difference<b>${fmt(naive)}</b></div><div>Adjusted ${c.target.toUpperCase()}<b>${identified ? fmt(target) : "Not identified"}</b></div><div>Generator's causal value<b>${fmt(target + (c.exchange ? 0 : c.hidden))}</b></div>`;
    document.getElementById("positivity-status").textContent =
      "g(high) = " +
      fmt(c.gHigh) +
      ". " +
      (c.gHigh === 0
        ? "No high-severity treated people in this population."
        : c.gHigh === 1
          ? "No high-severity controls in this population."
          : "Both arms are possible in this stratum.");
    document.getElementById("hidden-shift").disabled = c.exchange;
    document.getElementById("identification-status").textContent = identified
      ? "Under the stated assumptions, adjustment identifies this target. The assumptions themselves are not established by the data."
      : !c.consistent
        ? "Define the intervention and its versions before interpreting an observed contrast causally."
        : !c.exchange
          ? "Exchangeability removed: the same observed law now supports different causal answers. κ = " +
            fmt(c.hidden) +
            "."
          : "Positivity fails for this target: the observed data do not identify the needed stratum-specific contrast.";
  }
  state.subscribe(render);
  render();
  document.getElementById("save-contract").onclick = () => {
    const c = state.get();
    Causality.event({
      type: "contract",
      value: { target: c.target, population: c.p },
    });
    document.getElementById("contract-status").textContent =
      "Contract saved. It is available beside the roadmap in every lesson.";
  };
  guided(root, state);
  tools(root, state);
})();
