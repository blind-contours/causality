(function () {
  const { S, V, store, control, tools, guided, table, fmt } = CausalLab,
    root = document.querySelector("[data-lab]"),
    state = store(
      "inference",
      { step: 0, alpha: 0.25, beta: 0.25, n: 10000 },
      { step: [0, 3], alpha: [0, 0.6], beta: [0, 0.6], n: [100, 1000000] },
    );
  root.innerHTML = `<section class="lab-step" data-title="Three terms"><h2 tabindex="-1">A correction leaves three different sources of error</h2><p>The leading error is an average of true influence-function values. A second term comes from estimating that influence function. A third term is nonlinear bias: the remainder. Each needs its own argument.</p><div class="math">ψ̂ − ψ₀ = (Pₙ−P₀)D*(P₀)<br>+ (Pₙ−P₀)[D*(P̂)−D*(P₀)]<br>+ R₂(P̂,P₀)</div><p>The first term gives the efficient variance. Cross-fitting helps control the second. Appropriate nuisance accuracy makes the last negligible. Identification is needed before any of these terms can describe a causal answer.</p><details><summary>Exact ATE remainder and its sign convention</summary><p class="math">Ψ(P̂)−Ψ(P₀) = −P₀D*(P̂) + R₂<br>R₂ = E₀[(ĝ−g₀){(m̂₁−m₁₀)/ĝ + (m̂₀−m₀₀)/(1−ĝ)}]</p><p>Under positivity and bounded inverse estimated propensities, its magnitude is bounded by a constant times the product of L² nuisance errors. A rectangle of side lengths “outcome error” and “propensity error” depicts a bound on magnitude, not the signed exact remainder.</p></details></section>
<section class="lab-step" data-title="Rates"><h2 tabindex="-1">The boundary matters: one quarter plus one quarter</h2><label>Outcome convergence exponent α <input id="alpha" type="range" min="0" max=".6" step=".01"></label><label>Propensity convergence exponent β <input id="beta" type="range" min="0" max=".6" step=".01"></label><svg id="rate-plot" role="img" aria-label="Square-root-n scaled remainder bound versus log10 sample size. Values and interpretation follow."></svg><p id="rate-status" class="math" role="status"></p><div id="rate-table"></div><p>If the errors are exactly n⁻¹⁄⁴ each, their product is n⁻¹⁄². Multiplication by √n leaves a constant. For centered efficient inference, require a little-o remainder: √n R₂ → 0. A rate sum strictly greater than ½ is sufficient under the other conditions; equality is not enough by itself.</p><p class="note">This plot sets bounding constants to one and uses exact power laws. It illustrates rates, not a finite-sample guarantee. One nuisance can be slower if the other is faster.</p></section>
<section class="lab-step" data-title="Cross-fitting"><h2 tabindex="-1">Make a prediction before seeing that patient's outcome</h2><p>Imagine a learner that memorizes the training outcomes. Its training residuals are all zero, even if it predicts new patients poorly. For cross-fitting, fit on one fold and evaluate on the other, then swap. Every patient receives a prediction from a model trained without that patient's observation.</p><div id="fold-table"></div><p class="math">Fit fold A → evaluate fold B<br>Fit fold B → evaluate fold A<br>Combine the held-out influence-function contributions.</p><p>Conditional on the training fold, independent validation observations make the empirical-process term easier to control. Consistency in L² and suitable moments are still needed. Cross-fitting does not correct a persistently wrong model, weak overlap, confounding that was not measured, or a remainder that fails to vanish.</p><p class="note">In the table, “memorizing” means predicting each training outcome exactly; the held-out example uses the training-fold mean. Neither is advertised as an adequate nuisance learner. The purpose is to expose data reuse.</p></section>
<section class="lab-step" data-title="Repeat samples"><h2 tabindex="-1">Consistency, efficiency, and coverage are separate questions</h2><p>Predict first: when only one nuisance model is correctly specified, does the correction remove asymptotic bias? Must it attain the efficient bound? Must its empirical influence-function interval be valid? Use the four cases to separate those claims.</p><div data-simulation="inference"></div></section>`;
  control(document.getElementById("alpha"), state, "alpha");
  control(document.getElementById("beta"), state, "beta");
  function render() {
    const c = state.get(),
      exponent = 0.5 - c.alpha - c.beta,
      points = Array.from({ length: 81 }, (_, i) => {
        const x = 2 + i / 20;
        return [x, Math.pow(10, x * exponent)];
      }),
      max = Math.max(1, ...points.map((p) => p[1]));
    V.plot(
      document.getElementById("rate-plot"),
      [{ points, color: "var(--purple)" }],
      {
        xmin: 2,
        xmax: 6,
        ymin: 0,
        ymax: max,
        xlabel: "Sample size, log₁₀ n",
        ylabel: "Scaled remainder bound",
      },
    );
    document.getElementById("rate-status").textContent =
      `α=${fmt(c.alpha, 2)}, β=${fmt(c.beta, 2)}. Scaled bound = n^${fmt(exponent, 2)}. ` +
      (exponent < -1e-8
        ? "It vanishes as n grows."
        : exponent > 1e-8
          ? "It grows; the bound does not justify efficient inference."
          : "It stays at 1; equality alone does not justify centered efficient inference.");
    document.getElementById("rate-table").innerHTML = table(
      ["n", "Outcome error", "Propensity error", "Scaled product"],
      [100, 1000, 10000, 1000000].map((n) => [
        n,
        fmt(n ** -c.alpha, 5),
        fmt(n ** -c.beta, 5),
        fmt(n ** exponent, 5),
      ]),
    );
  }
  state.subscribe(render);
  render();
  const data = S.generate(8, S.rng(872)),
    foldMean = (k) =>
      S.mean(data.filter((_, i) => i % 2 === k).map((r) => r.y));
  document.getElementById("fold-table").innerHTML = table(
    [
      "Patient",
      "Fold",
      "Outcome",
      "Memorized prediction",
      "Held-out prediction",
    ],
    data.map((r, i) => [
      i + 1,
      i % 2 ? "B" : "A",
      fmt(r.y),
      fmt(r.y),
      fmt(foldMean(1 - (i % 2))),
    ]),
  );
  guided(root, state);
  tools(root, state);
})();
