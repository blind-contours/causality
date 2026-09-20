(function () {
  const { S, table, fmt } = CausalLab,
    root = document.createElement("section");
  root.className = "lab-card";
  root.innerHTML =
    '<h2>For a binary outcome, stay inside [0,1]</h2><p>A linear update can leave the probability range. The logistic fluctuation uses logit(mε)=logit(m̂)+εH. Move the initial probabilities and inspect the fitted score.</p><label>Initial probability offset <input id="binary-offset" type="range" min="-.15" max=".15" step=".01" value="0"></label><div id="binary-values"></div><p id="binary-score" class="math"></p><p class="note">This example has a finite logistic fit. Completely separated samples can put the optimum at a boundary; they need separate diagnostics.</p>';
  document.querySelector(".wrap").append(root);
  const render = () => {
    const y = [1, 1, 1, 0, 1, 0],
      h = [-2, 2, 3, -3, 1.2, -1.2],
      m = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map(
        (v) => v + +document.getElementById("binary-offset").value,
      ),
      r = S.binaryTarget(y, m, h);
    document.getElementById("binary-values").innerHTML = table(
      ["Patient", "Y", "H", "Initial m̂", "Updated mε"],
      y.map((v, i) => [i + 1, v, h[i], fmt(m[i]), fmt(r.updated[i])]),
    );
    document.getElementById("binary-score").textContent =
      "ε̂ = " +
      fmt(r.epsilon) +
      "; empirical targeting score = " +
      r.score.toExponential(2) +
      ". Every updated value remains a valid probability.";
  };
  document.getElementById("binary-offset").oninput = render;
  render();
})();
