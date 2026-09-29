/* "Where should I start?" placement quiz on the course map. The scoring is pure and runs in node
   (tests/placement.test.cjs); the card renders only when a document and the course runtime exist. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CausalPlacement = api;
    if (root.document && root.Causality) api.mount(root);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const UNSURE = "unsure";
  const KEY = "causality.placement.v1";
  // Dispatched on window whenever the saved placement changes, so the course map can refresh.
  const EVENT = "causality:placement";

  // Seven questions, one idea each, in route order. `answer` is the index of the correct option.
  const QUESTIONS = [
    {
      id: "estimand",
      topic: "estimands",
      q: "Among patients who actually received a device, the one-year stroke risk was 4%. Had those same patients not received it, their risk would have been 8%. What have you described?",
      options: [
        "The average treatment effect (ATE), as a risk difference of −4 percentage points",
        "The effect among the treated (ATT), as a risk difference of −4 percentage points",
        "The effect among the treated (ATT), as a risk ratio of 2",
      ],
      answer: 1,
      why: "Both worlds are for the same people, those who were treated, so it is the ATT. 4% minus 8% is a risk difference of −4 points; the risk ratio is 4/8 = 0.5, not 2.",
      unit: "causal-roadmap",
    },
    {
      id: "identification",
      topic: "identification",
      q: "In a causal diagram, baseline severity affects both who is treated and the outcome. What does adjusting for severity do?",
      options: [
        "It blocks the back-door path through severity, so if no other path is open, treated and untreated patients are exchangeable within severity",
        "It removes the need for positivity, because the model can extrapolate to any severity",
        "It blocks the part of the treatment effect that flows through severity",
      ],
      answer: 0,
      why: "Severity is a common cause, so it opens a back-door path. Conditioning on it closes that path. Positivity is still needed: each severity level must have both treated and untreated patients.",
      unit: "causal-roadmap",
    },
    {
      id: "design",
      topic: "study design",
      q: "A registry study starts the clock at diagnosis and compares patients who received a device at any point in the first year with those who never did. What goes wrong?",
      options: [
        "Nothing, as long as you adjust for baseline covariates",
        "Immortal time: the device group had to survive until the implant, which manufactures a benefit",
        "Only confounding by indication, which a propensity score fixes",
      ],
      answer: 1,
      why: "Time zero, eligibility and assignment do not line up. Deaths before the implant can only land in the no-device group. No covariate adjustment repairs that.",
      unit: "target-trial",
    },
    {
      id: "gcomp",
      topic: "turning a regression into an effect",
      q: "You fit a logistic regression of the outcome on treatment and covariates. How do you turn it into a marginal risk difference (g-computation)?",
      options: [
        "Report the treatment coefficient: it is the adjusted effect",
        "Predict every patient's risk with treatment set to 1, then set to 0, average each set, and subtract",
        "Exponentiate the treatment coefficient into an odds ratio, then convert it using the overall risk",
      ],
      answer: 1,
      why: "Standardization: predict under both treatments for everyone, average, subtract. A logistic coefficient is a conditional log odds ratio, which is a different quantity.",
      unit: "rct-adjustment",
    },
    {
      id: "influence",
      topic: "influence functions",
      q: "For the mean ψ = E[Z], the influence function is D(z) = z − ψ. What does D(z) tell you?",
      options: [
        "The z-score of the observation z",
        "The probability density at z",
        "To first order, how much the parameter moves when a little probability is shifted toward the point z",
      ],
      answer: 2,
      why: "It is a derivative: tilt the distribution slightly toward z and the mean moves by about ε·(z − ψ). There is no division by a standard deviation, and it is not a density.",
      unit: "scores-from-scratch",
    },
    {
      id: "dr",
      topic: "the one-step correction and double robustness",
      q: "The one-step (AIPW) estimator adds an influence-function correction to a plug-in. What is left of its error is roughly a product: (outcome-model error) × (propensity-model error). In a randomized trial, where the propensity is known exactly, what follows?",
      options: [
        "The outcome model must be correctly specified, or the estimate stays biased",
        "The correction averages to exactly zero, so the one-step equals the plug-in",
        "The estimate is consistent even if the outcome model is wrong; a better outcome model buys precision, not validity",
      ],
      answer: 2,
      why: "With the true propensity the product is zero whatever the outcome model does. That is double robustness at work, and it is why covariate adjustment in a trial is safe. The correction is a weighted average of residuals, which is not zero in general.",
      unit: "one-step-estimator",
    },
    {
      id: "tmle",
      topic: "TMLE",
      q: "TMLE and the one-step estimator both use the influence function. What does TMLE do differently?",
      options: [
        "It drops the propensity model, so only the outcome model has to be right",
        "It nudges the fitted outcome model (along the clever covariate) until the estimated influence function averages to zero, then plugs the nudged model in, so a risk stays between 0 and 1",
        "It has a smaller large-sample variance than the one-step, because it is a different estimator",
      ],
      answer: 1,
      why: "TMLE solves the same estimating equation by updating the model rather than adding a term, so the answer is still a plug-in and respects the parameter's range. In large samples the two are equivalent; neither beats the other on variance.",
      unit: "clever-covariate",
    },
    {
      id: "se",
      topic: "standard errors",
      q: "You have an AIPW estimate of the ATE from n patients and each patient's estimated influence-function value. The usual standard error is:",
      options: [
        "The standard deviation of the outcomes divided by √n",
        "The standard deviation of the influence-function values divided by √n",
        "Not available without a bootstrap",
      ],
      answer: 1,
      why: "The estimate is, up to a small remainder, an average of influence-function values, so its standard error is theirs: sd/√n. This needs the nuisances to be estimated well enough (for example with cross-fitting).",
      unit: "standard-errors",
    },
  ];

  // Short names used in the result's opening sentence.
  const SHORT = {
    estimand: "estimand",
    identification: "identification",
    design: "study design",
    gcomp: "g-computation",
    influence: "influence function",
    dr: "double robustness",
    tmle: "TMLE",
    se: "standard error",
  };
  // The first four questions are foundations (question, identification, design, g-computation);
  // the last four are the estimation track the course builds (influence function to interval).
  const FOUNDATION = ["estimand", "identification", "design", "gcomp"];
  const THEORY = ["influence", "dr", "tmle", "se"];

  // Starting points in route order. `probes` lists the questions that check the material a
  // learner would skip by starting later. `review` lists earlier lessons worth a quick look.
  const PLACEMENTS = [
    {
      id: "beginning",
      name: "the beginning",
      title: "Start at the beginning",
      unit: "causal-roadmap",
      stage: "question",
      probes: ["estimand", "identification"],
      review: [],
      why: "The first lessons set up everything that follows: whose effect, on which scale, and what has to be true before data can answer the question. They also introduce the cohort you will carry through the whole course.",
    },
    {
      id: "design",
      name: "Design",
      title: "Start at Design",
      unit: "target-trial",
      stage: "identification",
      probes: ["design"],
      review: ["intercurrent-events"],
      why: "You can already say what effect you want and what makes it identifiable. Design is where observational studies usually go wrong before any model is fit: time zero, eligibility and assignment have to line up.",
    },
    {
      id: "payoff",
      name: "the payoff",
      title: "Start at the payoff: Your trial, adjusted",
      unit: "rct-adjustment",
      stage: "estimation",
      probes: ["gcomp"],
      review: ["intercurrent-events", "clone-censor-weight"],
      why: "The question, identification and design look familiar. Next comes turning a regression into an answer to the question: predict everyone under each treatment, average, subtract. The payoff lesson does it in a randomized trial, where it is easiest to trust.",
      // Used when the foundations all matched and the estimation questions did not.
      whyAhead: "The payoff lesson is where estimation begins: the adjusted estimator you already know, in a randomized trial, with the question of why it stays valid when the model is wrong. The geometry and TMLE lessons that follow explain that answer from first principles.",
    },
    {
      id: "geometry",
      name: "Geometry",
      title: "Start at the geometry",
      unit: "scores-from-scratch",
      stage: "model",
      probes: ["influence"],
      review: ["rct-adjustment"],
      why: "Some of the estimation ideas are familiar, but the influence function underneath them is not yet. The geometry lessons build it by moving probability, one small picture at a time, so the corrections that follow have something solid under them.",
    },
    {
      id: "estimation",
      name: "Estimation",
      title: "Start at estimation",
      unit: "one-step-estimator",
      stage: "estimation",
      probes: ["dr", "tmle"],
      review: ["canonical-gradient"],
      why: "You know what an influence function measures. The estimation chapter turns it into an estimator: the one-step correction, the clever covariate and TMLE, with every patient's contribution in view.",
    },
    {
      id: "inference",
      name: "Trust the answer",
      title: "Start at Trust the answer",
      unit: "efficiency-theory-story",
      stage: "uncertainty",
      probes: ["se"],
      review: ["four-patients"],
      why: "You know the estimator, what its correction removes and how TMLE differs. What is left is trust: when the interval is honest, which standard error to report, what positivity costs, and how wrong unmeasured confounding could make you.",
    },
  ];
  const REVIEW_WHY = {
    "causal-roadmap": "Estimands and identification, with the cohort the course uses.",
    "intercurrent-events": "Death, crossover and rescue change the estimand; the quiz did not ask about them.",
    "target-trial": "Time zero and immortal time, in one draggable picture.",
    "clone-censor-weight": "How to emulate a strategy trial; the quiz did not ask about it.",
    "rct-adjustment": "The same estimator the course builds, used where it is easiest to trust.",
    "scores-from-scratch": "Paths, scores and the influence function, built by hand.",
    "canonical-gradient": "Where the influence function you will correct with comes from.",
    "one-step-estimator": "What the correction adds, and why it is AIPW for the ATE.",
    "four-patients": "The correction and the TMLE update worked by hand for four patients.",
    "standard-errors": "Influence-function, sandwich and bootstrap standard errors side by side.",
  };

  const isCorrect = (q, a) => a !== UNSURE && a != null && Number(a) === q.answer;
  const byProbe = (id) => PLACEMENTS.find((p) => p.probes.includes(id));
  const byId = (id) => PLACEMENTS.find((p) => p.id === id);

  /* Pure scoring. `answers` is an array (or object keyed by question id) whose entries are an option
     index or "unsure". Rules:
     - Foundations (first four questions): two or more gaps, or a g-computation gap, start at the
       first gap. A single gap among the first three is listed for review instead of a restart.
     - Estimation track, once the foundations hold: no influence-function answer means starting at
       the payoff (or the geometry, if some later estimation answer matched); the influence function
       without both double robustness and TMLE means Estimation; only all three open Trust the
       answer. So never answering the TMLE question can never place anyone past Estimation. */
  function score(answers) {
    const get = (q, i) =>
      Array.isArray(answers) ? answers[i] : answers ? answers[q.id] : undefined;
    const correct = {};
    QUESTIONS.forEach((q, i) => (correct[q.id] = isCorrect(q, get(q, i))));
    const unsureIds = QUESTIONS.filter((q, i) => {
      const a = get(q, i);
      return a === UNSURE || a == null;
    }).map((q) => q.id);
    const fMiss = FOUNDATION.filter((id) => !correct[id]),
      known = THEORY.filter((id) => correct[id]);
    let place,
      isolated = null;
    if (fMiss.length > 1 || fMiss[0] === "gcomp") place = byProbe(fMiss[0]);
    else {
      if (fMiss.length === 1) isolated = fMiss[0];
      if (!correct.influence) place = byId(known.length ? "geometry" : "payoff");
      else if (!correct.dr || !correct.tmle) place = byId("estimation");
      else place = byId("inference");
    }
    const gap = isolated ? QUESTIONS.find((q) => q.id === isolated) : null;
    const review = [];
    if (gap) review.push(gap.unit);
    place.review.forEach((u) => {
      if (!review.includes(u)) review.push(u);
    });
    const strengths = QUESTIONS.filter((q) => correct[q.id]).map((q) => q.topic);
    return {
      placement: place.id,
      unit: place.unit,
      title: place.title,
      name: place.name,
      // Placed here because of later gaps, although this placement's own probes matched.
      ahead: place.probes.every((id) => correct[id]),
      review: review.slice(0, 2),
      isolated: isolated ? byProbe(isolated).id : null,
      gapTopic: gap ? gap.topic : null,
      strengths: [...new Set(strengths)],
      matched: QUESTIONS.filter((q) => correct[q.id]).map((q) => q.id),
      missed: QUESTIONS.filter((q) => !correct[q.id] && q.id !== isolated).map((q) => q.id),
      theoryKnown: known.length,
      // No estimation-track answer matched: the Tour is a gentle way in.
      tour: known.length === 0,
      correct: QUESTIONS.filter((q) => correct[q.id]).length,
      unsure: unsureIds.length,
      total: QUESTIONS.length,
    };
  }

  // Core (non-elective) units in route order, from the curriculum's chapter list.
  const coreUnits = (chapters) =>
    chapters.filter((c) => !c.elective).flatMap((c) => c.units.filter((u) => !u.elective));
  // Core units that come before `unitId`: the ones "Mark earlier lessons as skimmed" explores.
  function earlierUnits(chapters, unitId) {
    const core = coreUnits(chapters),
      i = core.findIndex((u) => u.id === unitId);
    return i < 0 ? [] : core.slice(0, i).map((u) => u.id);
  }

  function listJoin(items) {
    if (items.length < 2) return items.join("");
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const qs = (ids) =>
    `${listJoin(ids.map((id) => SHORT[id]))} question${ids.length > 1 ? "s" : ""}`;
  /* The opening of the result: what the learner actually showed, stated plainly. It names the
     questions that matched and the ones still ahead; it never praises beyond the answers. */
  function opener(r) {
    if (r.correct === r.total)
      return "Every answer matched, including TMLE and standard errors. The course can meet you near the end of the main route.";
    if (r.unsure === r.total)
      return "Thank you for being honest. You are exactly who this course was written for, and it starts from first principles.";
    if (!r.correct)
      return "None of these matched yet. That is useful: now you know where the course has the most to give you.";
    const ahead = r.missed.length
      ? ` The ${qs(r.missed)} ${r.missed.length > 1 ? "are" : "is"} still ahead of you.`
      : "";
    return `You answered the ${qs(r.matched)} correctly.${ahead}`;
  }
  // The reason for the placement, matched to how the learner got there.
  function reason(r) {
    const p = byId(r.placement);
    return r.ahead && p.whyAhead ? p.whyAhead : p.why;
  }

  /* ---------- Browser card ---------- */
  function mount(win) {
    const doc = win.document,
      el = doc.getElementById("placement");
    if (!el || !win.Causality) return;
    const { units, event, state } = win.Causality,
      chapters = win.Causality.COURSE.chapters,
      core = coreUnits(chapters),
      byId = (id) => units.find((u) => u.id === id),
      num = (id) => String(core.findIndex((u) => u.id === id) + 1).padStart(2, "0"),
      reduced = () => win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const esc = (s) =>
      String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const store = {
      get() {
        try {
          const v = JSON.parse(win.localStorage.getItem(KEY) || "null");
          // Results saved by an older quiz (a different number of questions) are dropped.
          return v &&
            v.version === 1 &&
            PLACEMENTS.some((p) => p.id === v.placement) &&
            Array.isArray(v.answers) &&
            v.answers.length === QUESTIONS.length
            ? v
            : null;
        } catch {
          return null;
        }
      },
      set(v) {
        try {
          win.localStorage.setItem(KEY, JSON.stringify(v));
        } catch {}
        // Tell the course map (hub.js) so the Continue card and the river follow the result.
        try {
          win.dispatchEvent(new win.CustomEvent(EVENT, { detail: v }));
        } catch {}
      },
    };
    let answers = [],
      current = 0;

    // Keep any static content already in the section (the quick identification check lives
    // there) below the card.
    const card = doc.createElement("div");
    card.className = "pl-card";
    card.setAttribute("aria-live", "off");
    el.insertBefore(card, el.firstChild);
    const show = (html, focusSel, cls) => {
      card.className = "pl-card " + (cls || "");
      card.innerHTML = html;
      if (!reduced()) {
        card.classList.remove("pl-in");
        void card.offsetWidth;
        card.classList.add("pl-in");
      }
      const f = focusSel && card.querySelector(focusSel);
      if (f) f.focus({ preventScroll: false });
    };

    function intro(focus) {
      show(
        `<div class="pl-intro">
          <div class="pl-text">
            <span class="eyebrow pl-eyebrow">Where should I start?</span>
            <h2 class="pl-title" tabindex="-1">New here, or already know some of this?</h2>
            <p>Find your starting point in ${["", "", "", "", "", "five", "six", "seven", "eight", "nine"][QUESTIONS.length] || QUESTIONS.length} questions. “I'm not sure” is always an answer, and a useful one.</p>
          </div>
          <div class="pl-cta">
            <button type="button" class="go pl-begin">Find my starting point <span aria-hidden="true">→</span></button>
            <span class="pl-note">About three minutes. Nothing is graded.</span>
          </div>
        </div>`,
        focus ? ".pl-title" : null,
        "pl-closed",
      );
      card.querySelector(".pl-begin").onclick = () => begin();
    }

    function summary(saved, focus, note) {
      const p = PLACEMENTS.find((x) => x.id === saved.placement),
        u = byId(p.unit);
      show(
        `<div class="pl-summary" style="--stage: var(--s-${p.stage})">
          <p class="pl-sum-text" tabindex="-1"><span class="pl-sum-dot" aria-hidden="true"></span>Your starting point: <b>${esc(cap(p.name))}</b>.
            <a href="lessons/${esc(u.file)}">${esc(u.title)}</a></p>
          <div class="pl-sum-btns"><button type="button" class="pl-link pl-why-btn">See why</button><button type="button" class="pl-link pl-change">Change</button></div>
          ${note ? `<p class="pl-status" role="status">${esc(note)}</p>` : ""}
        </div>`,
        focus ? ".pl-sum-text" : null,
        "pl-closed pl-slim",
      );
      card.querySelector(".pl-change").onclick = () => begin();
      card.querySelector(".pl-why-btn").onclick = () => result(saved.answers, true);
    }

    function begin() {
      answers = new Array(QUESTIONS.length).fill(undefined);
      current = 0;
      question();
    }

    function question() {
      const q = QUESTIONS[current],
        chosen = answers[current],
        n = QUESTIONS.length;
      const opt = (value, text, extra) =>
        `<label class="pl-opt ${extra || ""}"><input type="radio" name="pl-a" value="${value}" ${String(chosen) === String(value) ? "checked" : ""} /><span class="pl-mark" aria-hidden="true"></span><span class="pl-opt-t">${esc(text)}</span></label>`;
      show(
        `<form class="pl-quiz" novalidate>
          <div class="pl-top">
            <span class="pl-count mono" aria-hidden="true">${current + 1} / ${n}</span>
            <span class="pl-dots" aria-hidden="true">${QUESTIONS.map((_, i) => `<i class="${i < current ? "past" : i === current ? "now" : ""}"></i>`).join("")}</span>
            <button type="button" class="pl-link pl-close">Not now</button>
          </div>
          <fieldset class="pl-q" aria-labelledby="pl-qh">
            <h3 id="pl-qh" tabindex="-1"><span class="pl-sr">Question ${current + 1} of ${n}. </span>${esc(q.q)}</h3>
            <div class="pl-opts">
              ${q.options.map((o, k) => opt(k, o)).join("")}
              ${opt(UNSURE, "I'm not sure", "pl-unsure")}
            </div>
          </fieldset>
          <div class="pl-nav">
            ${current ? '<button type="button" class="pl-back"><span aria-hidden="true">←</span> Back</button>' : "<span></span>"}
            <button type="submit" class="go pl-next" ${chosen === undefined ? "disabled" : ""}>${current === n - 1 ? "See my starting point" : "Next"} <span aria-hidden="true">→</span></button>
          </div>
        </form>`,
        "#pl-qh",
        "pl-open",
      );
      const form = card.querySelector("form"),
        next = card.querySelector(".pl-next");
      form.addEventListener("change", () => {
        const v = form.querySelector("input:checked")?.value;
        answers[current] = v === UNSURE ? UNSURE : Number(v);
        next.disabled = false;
      });
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (answers[current] === undefined) return;
        if (current < n - 1) {
          current++;
          question();
        } else finish();
      });
      const back = card.querySelector(".pl-back");
      if (back)
        back.onclick = () => {
          current--;
          question();
        };
      card.querySelector(".pl-close").onclick = () => {
        const saved = store.get();
        saved ? summary(saved, true) : intro(true);
      };
    }

    function finish() {
      const r = score(answers);
      store.set({ version: 1, placement: r.placement, unit: r.unit, answers: answers.slice(), at: new Date().toISOString() });
      result(answers, true);
    }

    function result(ans, focus, note) {
      const r = score(ans),
        p = PLACEMENTS.find((x) => x.id === r.placement),
        u = byId(r.unit),
        earlier = earlierUnits(chapters, r.unit);
      const isoText = r.isolated
        ? ` One piece looked less familiar: ${esc(r.gapTopic)}. It is one lesson, so it is listed below for a quick look rather than a reason to start over.`
        : "";
      const reviewHtml = r.review.length
        ? `<div class="pl-review"><h3>Worth a quick review</h3><ul>${r.review
            .map((id) => {
              const v = byId(id);
              return `<li><a href="lessons/${esc(v.file)}"><span class="mono">${num(id)}</span>${esc(v.title)}</a><span>${esc(REVIEW_WHY[id] || v.blurb)}</span></li>`;
            })
            .join("")}</ul></div>`
        : "";
      const answersHtml = `<details class="pl-answers"><summary>See the answers</summary><ol>${QUESTIONS.map((q, i) => {
        const a = ans[i],
          mine = a === UNSURE || a == null ? "I'm not sure" : q.options[a];
        return `<li><p class="pl-a-q">${esc(q.q)}</p><p><b>Answer:</b> ${esc(q.options[q.answer])}</p><p class="pl-a-why">${esc(q.why)}</p><p class="pl-a-meta">You chose: ${esc(mine)} · Covered in <a href="lessons/${esc(byId(q.unit).file)}">${esc(byId(q.unit).title)}</a></p></li>`;
      }).join("")}</ol></details>`;
      show(
        `<div class="pl-result" style="--stage: var(--s-${p.stage})">
          <span class="eyebrow pl-eyebrow">Your starting point</span>
          <h2 class="pl-title" tabindex="-1">${esc(p.title)}</h2>
          <p class="pl-lesson"><span class="mono">Lesson ${num(u.id)}</span> · ${esc(u.title)} · <span class="mono">${u.minutes} min</span></p>
          <p class="pl-why">${esc(opener(r))}${isoText}</p>
          <p class="pl-why">${esc(reason(r))}</p>
          ${r.tour ? `<p class="pl-tour">New to influence functions? <a href="tour.html">Take the Tour first</a>: one patient, two paths, and the whole idea in a few minutes, before any symbols.</p>` : ""}
          ${reviewHtml}
          <div class="pl-actions">
            <a class="go pl-start" href="lessons/${esc(u.file)}">Start here <span aria-hidden="true">→</span></a>
            ${earlier.length ? '<button type="button" class="pl-skim">Mark earlier lessons as skimmed</button>' : ""}
            <button type="button" class="pl-link pl-again">Take it again</button>
          </div>
          ${earlier.length ? `<p class="pl-fine">Skimmed is not the same as walked through or passed: the ${earlier.length} earlier lesson${earlier.length > 1 ? "s" : ""} stay open for their transfer checks, and your progress counts only what you do.</p>` : ""}
          <p class="pl-status" role="status">${note ? esc(note) : ""}</p>
          ${answersHtml}
          <button type="button" class="pl-link pl-done">Close</button>
        </div>`,
        focus ? ".pl-title" : null,
        "pl-open pl-res",
      );
      card.querySelector(".pl-again").onclick = () => begin();
      card.querySelector(".pl-done").onclick = () => {
        const saved = store.get();
        saved ? summary(saved, true) : intro(true);
      };
      const skim = card.querySelector(".pl-skim");
      if (skim) skim.onclick = () => markSkimmed(r, earlier);
    }

    function markSkimmed(r, earlier) {
      const s = state().units,
        todo = earlier.filter((id) => !s[id] || s[id].status === "new");
      // Never "demonstrated": explore only moves a lesson from new to explored.
      // A skim is not a visit: these lessons become explored, never "Last opened" or "walked".
      todo.forEach((unit) => event({ type: "explore", unit, skim: true }));
      const saved = store.get() || { version: 1, placement: r.placement, unit: r.unit, answers: answers.slice() };
      saved.skimmed = true;
      store.set(saved);
      const note = todo.length
        ? `Marked ${todo.length} earlier lesson${todo.length > 1 ? "s" : ""} as skimmed. The route and Up next now point here.`
        : "Every earlier lesson was already opened, so nothing changed.";
      summary(saved, true, note);
    }

    const saved = store.get();
    if (saved) summary(saved, false);
    else intro(false);
  }

  return { QUESTIONS, PLACEMENTS, UNSURE, KEY, EVENT, score, opener, reason, earlierUnits, coreUnits, isCorrect, mount };
});
