/* Causality: shared course layer.
   Lessons stay self-contained; this file adds the registry, the top bar, the
   recap card, predict cards, the completion footer, and localStorage progress. */
(function () {
  const COURSE = {
    name: "Causality",
    chapters: [
      {
        id: "targeting",
        title: "Targeting: fixing a machine-learned estimate",
        units: [
          { id: "one-step-estimator", minutes: 12, file: "01-one-step-estimator.html", title: "The One-Step Estimator",
            blurb: "A plug-in from a regularized learner is biased. One step removes the first-order part. For the ATE it is AIPW.",
            recap: [
              { q: "A regularized S-learner's ATE comes out smaller than the truth. Why?", options: ["Random noise in the sample", "Shrinkage pulls the treatment coefficient toward zero and the plug-in inherits it", "The propensity model is wrong"], answer: 1, hint: "Unit 1, the λ slider: shrinkage is bias, not noise." },
              { q: "The one-step estimator is the plug-in plus what?", options: ["The sample mean of the influence function at the fitted P̂", "A bootstrap correction", "The propensity score"], answer: 0, hint: "ψ(P̂) + PₙD(P̂). For the ATE the second term is the mean of the weighted residuals." },
              { q: "For the ATE, the one-step estimator is the same as:", options: ["A causal forest", "Inverse probability weighting", "AIPW (augmented IPW)"], answer: 2, hint: "Plug-in plus the mean of H·(Y − μ̂) is exactly AIPW." }
            ] },
          { id: "scores-from-scratch", minutes: 25, file: "02-scores-from-scratch.html", title: "Scores and Influence, From Scratch",
            blurb: "A distribution is a point, a path is p(1+εh), a score is a slope. What the parameter does along a path.",
            recap: [
              { q: "In the path p_ε = p(1 + εh), what is z?", options: ["A covariate", "The whole observation, e.g. (X, A, Y)", "The parameter"], answer: 1, hint: "z is a point in the space of observations; z₀ is one specific patient's value." },
              { q: "Why must a score h have mean zero under p?", options: ["So the slope is positive", "Because total probability mass must stay one along the path", "It's a convention"], answer: 1, hint: "∫ p(1+εh) = 1 + ε∫hp, so ∫hp must be 0." },
              { q: "The pathwise derivative dψ/dε at ε = 0 equals:", options: ["E[ϕ·h]", "E[h]", "Var(h)"], answer: 0, hint: "One function ϕ works for every direction h; that ϕ is the influence function." }
            ] },
          { id: "mean-along-a-path", minutes: 15, file: "03-mean-along-a-path.html", title: "The Mean Along a Path",
            blurb: "Derive D(z) = z − ψ for the mean as arithmetic on bins. No calculus you can't see.",
            recap: [
              { q: "Along the path p(1+εh), what changes and what doesn't?", options: ["Positions z change, masses stay", "Masses change, positions z stay", "Both change"], answer: 1, hint: "The bins are fixed; only the mass in each bin moves." },
              { q: "Why can you subtract any constant c from z inside ∫ z h p dz?", options: ["Because ∫ h p = 0, so ∫ c h p = 0", "Because c is small", "You can't"], answer: 0, hint: "The mean-zero property of h is what pays for it." },
              { q: "Choosing c = ψ gives the influence function of the mean as:", options: ["z", "z − ψ", "ψ − z²"], answer: 1, hint: "Centered so that it also measures misfit: Pₙ(z − ψ̂) = z̄ − ψ̂." }
            ] },
          { id: "under-the-integral", minutes: 10, file: "04-under-the-integral.html", title: "Differentiating Under the Integral",
            blurb: "Leibniz's rule as a table: rows ε, columns z. The slope of a sum is the sum of slopes.",
            recap: [
              { q: "In the (ε, z) table, the value in one cell is linear in ε with slope:", options: ["z·p(z)·h(z)·dz", "p(z)·dz", "ε·z"], answer: 0, hint: "Each cell is z·p(z)(1+εh(z))dz; its ε-slope is z·p·h·dz." },
              { q: "The slope of the row sum equals:", options: ["The product of the cell slopes", "The sum of the cell slopes", "The largest cell slope"], answer: 1, hint: "Derivative of a sum is the sum of derivatives; that is all Leibniz's rule says here." },
              { q: "Summing z·p·h·dz over z gives:", options: ["E[Z]", "E[Z·h(Z)]", "Var(Z)"], answer: 1, hint: "A value times a probability, added up, is an expectation." }
            ] },
          { id: "one-move-two-faces", minutes: 10, file: "05-one-move-two-faces.html", title: "One Move, Two Faces",
            blurb: "Tilting the density of Y and shifting the regression are the same move. And Pₙ is a point too.",
            recap: [
              { q: "Tilt the conditional density of Y by exp(ε·H·(y − μ)). Its score at ε = 0 is:", options: ["H", "H·(y − μ)", "y − μ"], answer: 1, hint: "The score is the derivative of the log of the tilt factor." },
              { q: "For a Gaussian Y with variance 1, the mean of the tilted density is:", options: ["μ + ε·H", "μ·(1 + ε)", "μ + ε"], answer: 0, hint: "That is exactly the regression fluctuation μ_ε = μ̂ + εH." },
              { q: "The one-step correction PₙD(P̂) is the gap between averaging D under:", options: ["P̂ and P", "Pₙ and P̂", "Pₙ and P"], answer: 1, hint: "P̂ D(P̂) = 0 by construction, so PₙD(P̂) = (Pₙ − P̂)D(P̂)." }
            ] },
          { id: "two-strata", minutes: 20, file: "06-two-strata.html", title: "Two Strata, One Step",
            blurb: "With 100 patients, why the fit should move in proportion to 1/π. Budget, marginal cost, positivity, and the strip trade.",
            recap: [
              { q: "Raising the old curve by δ costs 5δ² and the young curve 45δ². Why the difference?", options: ["Old patients have bigger outcomes", "Only treated people resist the move, and there are 5 vs 45 of them", "The old stratum is smaller"], answer: 1, hint: "Cost is one square of side δ per treated person." },
              { q: "At the optimal split, δ_old / δ_young equals:", options: ["1", "9 = π(young)/π(old)", "45"], answer: 1, hint: "Equal marginal cost: 90δ_Y = 10δ_O." },
              { q: "Which of these depends on the residuals?", options: ["The direction δ ∝ 1/π", "The step size ε̂", "Both"], answer: 1, hint: "The direction is set by ψ and the design; only ε̂ is fit to data." }
            ] },
          { id: "clever-covariate", minutes: 15, file: "07-clever-covariate.html", title: "Where the Clever Covariate Comes From",
            blurb: "D is centered, D is the steepest direction, and moving along it by likelihood solves PₙD = 0.",
            recap: [
              { q: "Among directions h with E[h²] = 1, which gives the largest dψ/dε?", options: ["h = constant", "h ∝ D (the influence function)", "h ∝ z"], answer: 1, hint: "Cauchy–Schwarz: E[Dh] ≤ √E[D²]·√E[h²], equality when h ∝ D." },
              { q: "Fluctuating along D and choosing ε by maximum likelihood stops where:", options: ["PₙD = 0", "ε = 1", "The likelihood is zero"], answer: 0, hint: "The score of the fluctuation at ε = 0 is D itself." },
              { q: "For the ATE, the clever covariate H is:", options: ["π(X)", "A/π(X) − (1−A)/(1−π(X))", "Y − μ(X)"], answer: 1, hint: "The coefficient of the residual in the efficient influence function." }
            ] },
          { id: "four-patients", minutes: 12, file: "08-four-patients.html", title: "Four Patients",
            blurb: "Type the four values of D(Zᵢ) yourself and watch their mean equal the correction. Then ε̂ by hand.",
            recap: [
              { q: "With four patients, the one-step correction PₙD(P̂) is:", options: ["The largest D(Zᵢ)", "The mean of the four D(Zᵢ)", "The sum of the four residuals"], answer: 1, hint: "Pₙ means average over the sample." },
              { q: "A treated patient's D(Zᵢ) for E[Y(1)] includes the residual times:", options: ["π(Xᵢ)", "1/π(Xᵢ)", "1"], answer: 1, hint: "H = A/π for the treated arm." },
              { q: "ε̂ = ΣH r / ΣH² is:", options: ["A least-squares slope of r on H with no intercept", "A mean of r", "A variance"], answer: 0, hint: "One regressor, one coefficient." }
            ] },
          { id: "efficiency-theory-story", minutes: 25, file: "09-efficiency-theory-story.html", title: "Efficiency Theory, Drawn",
            blurb: "Nine pictures: parameter as map, tangent space, projection, plug-in bias, double robustness, TMLE walk, coverage.",
            recap: [] }
        ]
      }
    ]
  };
  const units = COURSE.chapters.flatMap(c => c.units.map(u => ({ ...u, chapter: c })));
  const KEY = "causality.progress.v1";
  function loadProgress() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function saveProgress(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function isDone(id) { return !!loadProgress()[id]; }
  function markDone(id, done) { const p = loadProgress(); if (done) p[id] = new Date().toISOString(); else delete p[id]; saveProgress(p); }
  window.Causality = { COURSE, units, loadProgress, markDone, isDone };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // Predict cards: <div class="predict" data-options="A|B|C" data-answer="1" data-hint="...">Question</div>
  function buildPredict(el, onAnswer) {
    const q = el.textContent.trim(), opts = (el.getAttribute("data-options") || "").split("|"), ans = +el.getAttribute("data-answer"), hint = el.getAttribute("data-hint") || "";
    el.innerHTML = `<div class="predict-label">Predict before you play</div><div class="predict-q">${esc(q)}</div><div class="predict-opts">${opts.map((o, i) => `<button class="predict-opt" data-i="${i}">${esc(o)}</button>`).join("")}</div><div class="predict-result" hidden></div>`;
    const res = el.querySelector(".predict-result");
    el.querySelectorAll(".predict-opt").forEach(b => b.onclick = () => {
      const i = +b.getAttribute("data-i");
      el.querySelectorAll(".predict-opt").forEach(x => { x.disabled = true; x.classList.toggle("chosen", x === b); x.classList.toggle("right", +x.getAttribute("data-i") === ans); });
      res.hidden = false; res.className = "predict-result " + (i === ans ? "ok" : "no");
      res.textContent = (i === ans ? "Right. " : "Not quite. ") + hint + " Now play the scene and check.";
      if (onAnswer) onAnswer();
    });
  }

  // Recap card at the top of a unit, from the previous unit's questions
  function buildRecap(prev, mount, where) {
    if (!prev || !prev.recap || !prev.recap.length) return;
    const card = document.createElement("section"); card.className = "recap";
    card.innerHTML = `<div class="recap-head"><span class="recap-label">Before you start: three questions from “${esc(prev.title)}”</span><button class="recap-skip">Skip</button></div>` +
      prev.recap.map((r, k) => `<div class="recap-q" data-k="${k}"><div class="recap-qt">${k + 1}. ${esc(r.q)}</div><div class="recap-opts">${r.options.map((o, i) => `<button class="recap-opt" data-i="${i}">${esc(o)}</button>`).join("")}</div><div class="recap-res" hidden></div></div>`).join("") +
      `<div class="recap-foot" hidden><a class="course-btn" href="${prev.file}">Revisit ${esc(prev.title)}</a></div>`;
    let answered = 0;
    card.querySelectorAll(".recap-q").forEach(qel => {
      const k = +qel.getAttribute("data-k"), r = prev.recap[k], res = qel.querySelector(".recap-res");
      qel.querySelectorAll(".recap-opt").forEach(b => b.onclick = () => {
        const i = +b.getAttribute("data-i");
        qel.querySelectorAll(".recap-opt").forEach(x => { x.disabled = true; x.classList.toggle("chosen", x === b); x.classList.toggle("right", +x.getAttribute("data-i") === r.answer); });
        res.hidden = false; res.className = "recap-res " + (i === r.answer ? "ok" : "no"); res.textContent = (i === r.answer ? "Right. " : "Not quite. ") + r.hint;
        if (++answered === prev.recap.length) card.querySelector(".recap-foot").hidden = false;
      });
    });
    card.querySelector(".recap-skip").onclick = () => card.remove();
    if (where === "afterend") mount.insertAdjacentElement("afterend", card); else mount.insertBefore(card, mount.firstChild);
  }

  // ---- Unit page decoration ----
  document.addEventListener("DOMContentLoaded", () => {
    const id = document.body && document.body.getAttribute("data-lesson");
    // predict cards exist on any page
    const predicts = Array.from(document.querySelectorAll(".predict"));
    let predictsAnswered = 0;
    predicts.forEach(el => buildPredict(el, () => { predictsAnswered++; refresh(); }));
    if (!id) return;
    const i = units.findIndex(u => u.id === id);
    if (i < 0) return;
    const u = units[i], prev = units[i - 1], next = units[i + 1];
    const chIdx = COURSE.chapters.indexOf(u.chapter);
    const uIdx = u.chapter.units.findIndex(x => x.id === u.id);
    const wrap = document.querySelector(".wrap") || document.body;

    // Scenes: each .scene/.act block, titled by the nearest preceding h2
    const blocks = Array.from(document.querySelectorAll(".scene, .act"));
    const scenes = blocks.map((b, k) => {
      let h = b.previousElementSibling; while (h && h.tagName !== "H2") h = h.previousElementSibling;
      if (h && !h.id) h.id = "scene-" + (k + 1);
      return { el: b, h, title: h ? h.textContent.trim() : "Scene " + (k + 1), seen: false };
    });
    let reachedEnd = scenes.length === 0;

    // Top bar with dot strip
    const bar = document.createElement("nav");
    bar.className = "course-bar";
    bar.innerHTML =
      `<a class="course-home" href="../index.html">${COURSE.name}</a>` +
      `<span class="course-where"><span class="course-unit">Unit ${uIdx + 1} of ${u.chapter.units.length}</span>` +
      (scenes.length ? ` · <span id="course-scene">Scene 1 of ${scenes.length}</span> <span class="course-dots">${scenes.map((sc, k) => `<a href="#${sc.h ? sc.h.id : ""}" class="dot" data-k="${k}" title="${esc(sc.title)}"></a>`).join("")}</span>` : "") +
      `</span>` +
      `<span class="course-nav">` +
        (prev ? `<a href="${prev.file}" title="${esc(prev.title)}">← Prev</a>` : `<span class="dim">← Prev</span>`) +
        ` <a href="../index.html">Hub</a> <a href="../glossary.html">Symbols</a> ` +
        (next ? `<a href="${next.file}" title="${esc(next.title)}">Next →</a>` : `<span class="dim">Next →</span>`) +
      `</span>`;
    document.body.insertBefore(bar, document.body.firstChild);
    const dots = Array.from(bar.querySelectorAll(".dot"));
    const sceneLabel = bar.querySelector("#course-scene");

    // Unit meta line + recap strip + scene index, placed after the lede (or the h1)
    const h1 = wrap.querySelector("h1");
    const lede = wrap.querySelector(".lede");
    const anchor = lede || h1;
    if (anchor) {
      const meta = document.createElement("div"); meta.className = "unit-meta";
      meta.innerHTML = `<span>Chapter ${chIdx + 1} · Unit ${uIdx + 1}</span><span>About ${u.minutes || 15} min</span><span>${scenes.length} scene${scenes.length === 1 ? "" : "s"}</span>${predicts.length ? `<span>${predicts.length} prediction${predicts.length === 1 ? "" : "s"}</span>` : ""}`;
      anchor.insertAdjacentElement("afterend", meta);
      let after = meta;
      if (prev && prev.recap && prev.recap.length) {
        const strip = document.createElement("div"); strip.className = "recap-strip";
        strip.innerHTML = `<span class="recap-label">Quick check on “${esc(prev.title)}” · ${prev.recap.length} questions</span><button class="course-btn small" id="recap-open">Show</button>`;
        after.insertAdjacentElement("afterend", strip); after = strip;
        strip.querySelector("#recap-open").onclick = () => { strip.remove(); buildRecap(prev, meta.nextElementSibling || meta, "afterend"); };
      }
      if (scenes.length > 1 && !wrap.querySelector(".toc")) {
        const idx = document.createElement("div"); idx.className = "scene-index";
        idx.innerHTML = `<span class="scene-index-label">In this unit</span>` + scenes.map((sc, k) => `<a href="#${sc.h ? sc.h.id : ""}">${k + 1} · ${esc(sc.title)}</a>`).join("");
        after.insertAdjacentElement("afterend", idx);
      }
    }

    // Completion checks (Four Patients uses .fp-msg)
    const checkMsgs = Array.from(document.querySelectorAll(".fp-msg"));
    const checksPassed = () => checkMsgs.filter(m => m.classList.contains("ok") || /^Filled in/.test(m.textContent)).length;
    checkMsgs.forEach(m => new MutationObserver(refresh).observe(m, { childList: true, characterData: true, subtree: true, attributes: true }));

    // Footer
    const foot = document.createElement("footer");
    foot.className = "course-foot";
    document.body.appendChild(foot);
    function requirements() {
      const req = [];
      if (predicts.length) req.push({ ok: predictsAnswered >= predicts.length, text: `${predictsAnswered} of ${predicts.length} prediction${predicts.length === 1 ? "" : "s"} answered` });
      if (checkMsgs.length) req.push({ ok: checksPassed() >= checkMsgs.length, text: `${checksPassed()} of ${checkMsgs.length} worked table${checkMsgs.length === 1 ? "" : "s"} checked` });
      if (scenes.length) req.push({ ok: reachedEnd, text: reachedEnd ? "reached the last scene" : "reach the last scene" });
      return req;
    }
    function refresh() {
      const req = requirements(); const allOk = req.every(r => r.ok);
      if (allOk && !isDone(id)) markDone(id, true);
      const done = isDone(id);
      foot.innerHTML =
        `<div class="course-foot-inner">` +
          `<div><div class="course-foot-title">${done ? "Unit complete ✓" : "To complete this unit"}</div>` +
          (done ? `<div class="course-foot-sub">Saved in this browser. <a href="#" id="course-undo">Mark incomplete</a></div>` :
            `<ul class="course-req">${req.map(r => `<li class="${r.ok ? "ok" : ""}">${r.ok ? "●" : "○"} ${esc(r.text)}</li>`).join("")}</ul>`) +
          `</div>` +
          `<div class="course-foot-actions">` +
            (next ? `<a class="course-btn ${done ? "primary" : ""}" href="${next.file}">Next: ${esc(next.title)} →</a>` : `<a class="course-btn ${done ? "primary" : ""}" href="../index.html">Back to hub →</a>`) +
          `</div></div>`;
      const undo = foot.querySelector("#course-undo"); if (undo) undo.onclick = e => { e.preventDefault(); markDone(id, false); refresh(); };
    }
    refresh();

    // Scene tracking
    if (scenes.length && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (!en.isIntersecting) return; const k = scenes.findIndex(sc => sc.el === en.target); if (k < 0) return;
          scenes[k].seen = true; if (sceneLabel) sceneLabel.textContent = `Scene ${k + 1} of ${scenes.length}`;
          dots.forEach((d, j) => { d.classList.toggle("seen", scenes[j].seen); d.classList.toggle("now", j === k); });
          if (k === scenes.length - 1 && !reachedEnd) { reachedEnd = true; refresh(); } });
      }, { threshold: 0.35 });
      scenes.forEach(sc => io.observe(sc.el));
    }
  });
})();
