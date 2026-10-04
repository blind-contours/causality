/* Optional foundations page: shared validated lab state, no lesson completion flag. */
(function () {
  "use strict";
  const W = CausalWeighting, { store, control, tools, table } = CausalLab;
  try {
    const theme = JSON.parse(localStorage.getItem("causality.progress.v2") || "{}")?.settings?.theme;
    if (["light", "dark"].includes(theme)) document.documentElement.dataset.theme = theme;
  } catch {}
  const state = store("propensity-weighting", W.DEFAULTS, {
    pHigh: [0.1, 0.9], gLow: [0, 1], gHigh: [0, 1],
    scoreMode: ["correct", "constant"], weightMode: ["unstabilized", "stabilized"],
  });
  const byId = (id) => document.getElementById(id);
  const f = (n, places = 2) => n === null ? "not defined" : n.toFixed(places);
  const pct = (n) => n === null ? "not defined" : (100 * n).toFixed(1) + "%";
  // The reading route stays separate from laboratory and course progress state.
  const chapters = [...document.querySelectorAll(".flow-chapter")];
  const routeLinks = [...document.querySelectorAll(".basics-contents a")];
  function markChapter(id) {
    routeLinks.forEach((a) => {
      if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }
  markChapter(chapters[0].id);
  if ("IntersectionObserver" in window) {
    const visible = new Set();
    const routeObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      const current = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (current) markChapter(current.id);
    }, { rootMargin: "-15% 0px -55% 0px" });
    chapters.forEach((el) => routeObserver.observe(el));
  }
  function openAnchor() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = byId(id);
    if (!target) return;
    const insideReveal = !!target.closest("details");
    for (let parent = target.parentElement; parent; parent = parent.parentElement)
      if (parent.tagName === "DETAILS") parent.open = true;
    if (insideReveal) requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "auto" }));
    const chapter = target.closest(".flow-chapter");
    if (chapter) markChapter(chapter.id);
  }
  window.addEventListener("hashchange", openAnchor);
  window.addEventListener("load", openAnchor, { once: true });
  openAnchor();
  for (const [id, key] of [["p-high", "pHigh"], ["g-low", "gLow"], ["g-high", "gHigh"], ["weight-score", "scoreMode"], ["weight-mode", "weightMode"]])
    control(byId(id), state, key);
  tools(byId("weight-tools"), state);
  byId("weight-extreme").onclick = () => state.set({ gLow: 0.02, gHigh: 0.98, scoreMode: "correct" });
  byId("weight-absent").onclick = () => state.set({ gHigh: 1, scoreMode: "correct" });

  function bar(label, high) {
    return '<div class="weight-bar-row"><p><b>' + label + '</b><br>Low ' + pct(high === null ? null : 1 - high) + ' · High ' + pct(high) + '</p>' +
      (high === null ? '<p>No supported weighted comparison.</p>' : '<div class="weight-bar" aria-hidden="true"><span class="low" style="width:' + (100 * (1 - high)) + '%"></span><span class="high" style="width:' + (100 * high) + '%"></span></div>') + '</div>';
  }
  function render() {
    const cfg = state.get(), pop = W.population(cfg);
    byId("weight-model-status").textContent = (cfg.scoreMode === "correct" ? "Correct treatment probabilities" : "Constant propensity 0.5") +
      " · " + (cfg.weightMode === "stabilized" ? "stabilized weights" : "unstabilized weights");
    byId("p-high-value").textContent = pct(cfg.pHigh);
    byId("g-low-value").textContent = f(cfg.gLow);
    byId("g-high-value").textContent = f(cfg.gHigh);
    byId("weight-bars").innerHTML = '<div class="weight-legend"><span><i style="background:var(--p)"></i>Low severity</span><span><i style="background:var(--or)"></i>High severity</span></div>' +
      bar("Target population", cfg.pHigh) +
      bar("Treated: before weighting", pop.arms[1].highShare) +
      bar("Untreated: before weighting", pop.arms[0].highShare) +
      bar("Treated: after weighting", pop.arms[1].weightedHighShare) +
      bar("Untreated: after weighting", pop.arms[0].weightedHighShare);
    const results = [["Observed mean difference", pop.naive], ["Weighted mean difference", pop.ipw], ["Target ATE", pop.truth], ["Largest weight", pop.maxWeight]];
    byId("weight-results").innerHTML = results.map(([label, value]) => '<div class="weight-result"><small>' + label + '</small><strong>' + f(value) + '</strong></div>').join("");
    byId("weight-evidence").textContent = "Effective sample size: treated " + f(pop.arms[1].ess, 1) + " · untreated " + f(pop.arms[0].ess, 1);
    byId("weight-table").innerHTML = table(
      ["Severity", "Received", "Expected people", "Probability of own treatment (model)", "Weight", "Weighted people"],
      pop.cells.map((c) => [c.x ? "High" : "Low", c.a ? "Treated" : "Untreated", f(c.count, 1), f(c.ownProbability), f(c.weight), f(c.weightedCount, 1)]),
      "Exact expected counts and weights in the two-stratum population",
    ) + table(["Group", "Expected people", "Weighted total", "Effective sample size"], pop.arms.map((a) => [a.a ? "Treated" : "Untreated", f(a.n, 1), f(a.totalWeight, 1), f(a.ess, 1)]), "Representation and weight concentration are different quantities");
    document.querySelectorAll(".weighting-tutorial .table-wrap").forEach((el) => { el.tabIndex = 0; el.setAttribute("role", "region"); el.setAttribute("aria-label", el.querySelector("caption").textContent); });
    let message;
    if (!pop.supported) message = "Positivity fails for this target: a severity group has no chance of one treatment. No weighted ATE is reported. Upweighting cannot supply the missing treatment history.";
    else if (cfg.scoreMode === "constant") message = "Giving everyone the same propensity score rescales the existing groups; it does not repair their severity imbalance. If the actual treatment chances are equal across severity, there is no such imbalance to repair.";
    else message = "Both weighted groups reproduce the target severity mix, and the weighted contrast equals 2 in this exact population calculation. In a finite sample with estimated probabilities, balance and accuracy must be checked.";
    if (pop.supported && pop.maxWeight >= 20) message += " Rare treatment histories now carry large weights. Notice how the effective sample sizes shrink.";
    byId("weight-status").textContent = message;
    byId("weight-status").dataset.status = !pop.supported ? "unsupported" : cfg.scoreMode;
    byId("dr-table").innerHTML = table(["Working models", "Population AIPW", "Target ATE"], [
      ["Both correct", f(W.aipw({ ...cfg, scoreMode: "correct" }, true)), "2.00"],
      ["Omit severity from outcome; propensity correct", f(W.aipw({ ...cfg, scoreMode: "correct" }, false)), "2.00"],
      ["Outcome correct; use propensity 0.5", f(W.aipw({ ...cfg, scoreMode: "constant" }, true)), "2.00"],
      ["Omit severity; use propensity 0.5", f(W.aipw({ ...cfg, scoreMode: "constant" }, false)), "2.00"],
    ], "Double robustness in this exact, identified teaching world");
    const drWrap = byId("dr-table").querySelector(".table-wrap");
    drWrap.tabIndex = 0; drWrap.setAttribute("role", "region"); drWrap.setAttribute("aria-label", "Double robustness population calculations");
  }
  state.subscribe(render); render();
  const cases = [{ g: 0.25, a: 1 }, { g: 0.25, a: 0 }, { g: 0.2, a: 0 }, { g: 0.8, a: 1 }];
  let variant = 0, assisted = false;
  function caseData() { const c = cases[variant]; return { ...c, p: c.a ? c.g : 1 - c.g }; }
  function newQuestion() {
    assisted = false; const c = caseData();
    byId("weight-question").textContent = "g(X) = " + c.g + " · " + (c.a ? "Treated" : "Untreated") + ". What is the unstabilized weight?";
    byId("weight-answer").value = ""; byId("weight-feedback").textContent = "";
  }
  byId("weight-hint").onclick = () => {
    assisted = true; const c = caseData();
    byId("weight-feedback").textContent = "Use the probability of the treatment received: " + (c.a ? c.g : "1 − " + c.g + " = " + c.p.toFixed(2)) + ". Its inverse is " + (1 / c.p).toFixed(2) + ". Try a different case afterwards without the reasoning shown.";
  };
  byId("weight-check").onclick = () => {
    const raw = byId("weight-answer").value, answer = Number(raw), c = caseData();
    byId("weight-feedback").textContent = raw !== "" && Number.isFinite(answer) && Math.abs(answer - 1 / c.p) <= 0.02
      ? "That matches the calculation." + (assisted ? " The reasoning was shown for this case; try a different one independently." : " Explain why the received treatment decides the denominator.")
      : "Check which treatment this person received. For an untreated person, the probability is 1 − g(X).";
  };
  byId("weight-new").onclick = () => { variant = (variant + 1) % cases.length; newQuestion(); };
  newQuestion();
})();
