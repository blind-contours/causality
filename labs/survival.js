(function () {
  const { S, V, store, control, tools, guided, table, fmt } = CausalLab,
    root = document.querySelector("[data-lab]"),
    state = store(
      "survival",
      { step: 0, tau: 5, n: 1200, censor: 2, seed: 20260919 },
      {
        step: [0, 3],
        tau: [1, 10],
        n: [200, 5000],
        censor: [0, 4],
        seed: [1, 4294967295],
      },
    );
  root.innerHTML = `<section class="lab-step" data-title="Choose a survival target"><h2 tabindex="-1">“Does it improve survival?” still needs a target</h2><p>Extend the severity-and-treatment study to time until an event. Choose a time horizon. Compare the chance of surviving to that time, or average event-free time up to it. These answer different clinical questions from a conditional hazard ratio.</p><label>Horizon τ, years <input id="horizon" type="range" min="1" max="10" step=".5"></label><p class="math" id="survival-target"></p><p>Restricted mean survival time, RMST(τ), is the area under a survival curve from 0 to τ. A difference of 0.4 years means an average additional 0.4 event-free years within that window.</p><button id="save-horizon">Save this horizon to my contract</button><p id="horizon-status" role="status"></p><p class="note">This extension changes the outcome to time until an event. Its treatment effect is not the numerical ATE=2 used in the continuous-outcome simulation.</p></section>
<section class="lab-step" data-title="See selection"><h2 tabindex="-1">The risk set changes as people leave it</h2><p>In this generator, high-severity patients have a higher event rate and receive treatment more often. They can also be censored sooner. Event and censoring times are independent conditional on severity and treatment; they need not be independent within pooled treatment groups.</p><label>Severity dependence of censoring (0 turns censoring off) <input id="censoring" type="range" min="0" max="4" step=".25"></label><label>Cohort size <input id="cohort-n" type="range" min="200" max="5000" step="200"></label><label>Seed <input id="survival-seed" type="number" min="1" step="1"></label><p id="censoring-status"></p><div id="risk-table"></div><p>A low censoring rate is not evidence that censoring is independent. This experiment declares its mechanism so we can check estimators against a known target.</p></section>
<section class="lab-step" data-title="Compare curves"><h2 tabindex="-1">Separate the estimator from the question</h2><svg id="survival-plot" role="img" aria-label="Treated survival: truth, pooled Kaplan–Meier, and severity-standardized Kaplan–Meier. Exact selected-time values follow."></svg><p class="legend"><span style="color:var(--green)">Solid green: everyone treated, truth</span><span style="color:var(--muted)">Dashed gray: pooled treated KM</span><span style="color:var(--purple)">Dotted purple: standardized treated KM</span></p><div id="survival-values"></div><div id="rmst-values"></div><p id="support-status" class="warning"></p><p>Standardization fits KM within each severity/treatment group and averages over the whole cohort's severity distribution. In this finite-stratum example, it adjusts both measured baseline confounding and censoring that is independent within those strata. Pooled KM among treated people uses a different severity mix and may also violate its censoring condition.</p><p>For continuous covariates and longitudinal histories, conditional survival regressions and inverse censoring weights generalize the adjustment. Identification still requires exchangeability, consistency, treatment positivity, and censoring positivity through the chosen horizon.</p></section>
<section class="lab-step" data-title="Connect Cox to geometry"><h2 tabindex="-1">Cox already contains an infinite-dimensional part</h2><p class="math">λ(t | A,X) = λ₀(t) exp(βA + γX)</p><p>The baseline hazard λ₀ is unspecified; β and γ are finite-dimensional. This is a semiparametric model. Its regression coefficient β targets a conditional log hazard ratio under proportional hazards. It is not automatically a marginal survival contrast or an RMST difference.</p><p>Here the conditional treatment hazard ratio is 0.65 at every severity level. Mixing severity groups creates different evolving risk sets; the population hazard ratio need not stay at 0.65. Conditional proportional hazards does not make every marginal contrast proportional.</p><p class="math" id="hazard-values"></p><p>Carry the geometry back to this setting: permitted changes in baseline hazard and covariate distributions form directions in the statistical model. Which directions are nuisance directions depends on whether your target is β, survival at τ, or RMST. Choose that target first.</p><p class="note">No Cox model is fitted in this laboratory. The conditional hazard ratio is a known generator parameter. The displayed finite-sample estimators are Kaplan–Meier and stratified standardization.</p></section>`;
  [
    ["horizon", "tau"],
    ["censoring", "censor"],
    ["cohort-n", "n"],
    ["survival-seed", "seed"],
  ].forEach(([id, key]) => control(document.getElementById(id), state, key));
  function render() {
    const c = state.get(),
      r = S.survival({ ...c, n: Math.round(c.n) }),
      a = r.arms[1],
      time = Array.from({ length: 101 }, (_, i) => (c.tau * i) / 100),
      kmS = (km, t) => km.points.filter((p) => p[0] <= t).at(-1)[1];
    document.getElementById("survival-target").textContent =
      `S₁(${c.tau})−S₀(${c.tau}) or ∫₀^${c.tau} [S₁(t)−S₀(t)] dt. The population is everyone in this synthetic cohort.`;
    document.getElementById("censoring-status").textContent =
      `${fmt(r.censored * 100, 1)}% of event times are censored. n=${c.n}; seed=${c.seed}.`;
    document.getElementById("risk-table").innerHTML = table(
      [
        "Treated stratum",
        "At baseline",
        "Still observed at τ",
        "Censored by τ",
      ],
      [0, 1].map((x) => {
        const rows = r.rows.filter((v) => v.a === 1 && v.x === x);
        return [
          x ? "High severity" : "Low severity",
          rows.length,
          rows.filter((v) => v.time >= c.tau).length,
          rows.filter((v) => !v.event && v.time < c.tau).length,
        ];
      }),
    );
    const stdPoints = [
        0,
        ...new Set(a.strata.flatMap((s) => s.points.map((p) => p[0]))),
      ].sort((x, y) => x - y),
      stepPoints = (km) => {
        let last = 1;
        return km.points.flatMap(([t, s]) => {
          const pts = [
            [t, last],
            [t, s],
          ];
          last = s;
          return pts;
        });
      },
      stdStep = [];
    let last = 1;
    for (const t of stdPoints) {
      const s = a.standardizedS(t);
      stdStep.push([t, last], [t, s]);
      last = s;
    }
    V.plot(
      document.getElementById("survival-plot"),
      [
        { points: time.map((t) => [t, a.truthS(t)]), color: "var(--green)" },
        { points: stepPoints(a.naive), color: "var(--muted)", dash: "7 5" },
        { points: stdStep, color: "var(--purple)", dash: "2 4" },
      ],
      {
        xmin: 0,
        xmax: c.tau,
        ymin: 0,
        ymax: 1,
        xlabel: "Years",
        ylabel: "Survival",
      },
    );
    document.getElementById("survival-values").innerHTML = table(
      ["Time", "Truth S₁", "Pooled KM", "Standardized KM"],
      [0, c.tau / 2, c.tau].map((t) => [
        fmt(t),
        fmt(a.truthS(t)),
        fmt(kmS(a.naive, t)),
        fmt(a.standardizedS(t)),
      ]),
    );
    document.getElementById("rmst-values").innerHTML = table(
      ["Target through τ", "Truth", "Pooled KM", "Standardized KM"],
      [
        [
          "Everyone control RMST",
          fmt(r.arms[0].trueRMST),
          fmt(r.arms[0].naive.rmst),
          fmt(r.arms[0].standardizedRMST),
        ],
        [
          "Everyone treated RMST",
          fmt(a.trueRMST),
          fmt(a.naive.rmst),
          fmt(a.standardizedRMST),
        ],
        [
          "Difference, years",
          fmt(a.trueRMST - r.arms[0].trueRMST),
          fmt(a.naive.rmst - r.arms[0].naive.rmst),
          fmt(a.standardizedRMST - r.arms[0].standardizedRMST),
        ],
      ],
    );
    const supported = r.arms.every((arm) => arm.strata.every((s) => s.support));
    document.getElementById("support-status").textContent = supported
      ? "Each arm/severity cell supports this horizon: observation continues to τ, or its KM curve has already reached zero. Finite-sample accuracy still depends on the risk-set sizes."
      : "At least one cell has nobody observed through τ. Its KM curve is carried forward for display, but its tail and RMST require support or extrapolation. Shorten the horizon, reduce censoring, or increase n.";
    const hazard = (arm, t) => {
      const rates = [0.08, 0.32].map((v) => v * (arm ? 0.65 : 1)),
        weights = [0.65, 0.35];
      return (
        S.sum(rates.map((v, i) => weights[i] * v * Math.exp(-v * t))) /
        S.sum(rates.map((v, i) => weights[i] * Math.exp(-v * t)))
      );
    };
    document.getElementById("hazard-values").textContent =
      `Conditional HR = 0.65. Marginal HR at baseline = ${fmt(hazard(1, 0) / hazard(0, 0))}; at ${c.tau} years = ${fmt(hazard(1, c.tau) / hazard(0, c.tau))}.`;
  }
  state.subscribe(render);
  render();
  document.getElementById("save-horizon").onclick = () => {
    Causality.event({ type: "contract", value: { horizon: state.get().tau } });
    document.getElementById("horizon-status").textContent =
      "Horizon saved to your contract.";
  };
  guided(root, state);
  tools(root, state);
})();
