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
      id: "onestep",
      topic: "the one-step correction",
      q: "A plug-in estimate of the ATE from machine-learned models is biased. The one-step estimator adds the average of the estimated influence function. What does that added term do?",
      options: [
        "It removes the first-order bias of the plug-in, leaving a second-order remainder",
        "It adds noise so that the confidence interval covers the truth",
        "It replaces the outcome model with propensity weights, so the outcome model no longer matters",
      ],
      answer: 0,
      why: "The plug-in's error is, to first order, minus the average influence function; adding its estimate cancels that part. What remains is a product of the two nuisance errors.",
      unit: "one-step-estimator",
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
    },
    {
      id: "geometry",
      name: "Geometry",
      title: "Start at the geometry",
      unit: "scores-from-scratch",
      stage: "model",
      probes: ["influence"],
      review: ["rct-adjustment"],
      why: "You can already get from a fitted model to a marginal effect. The geometry lessons ask why that answer can be biased and what a correction is made of, building the influence function by moving probability, one small picture at a time.",
    },
    {
      id: "estimation",
      name: "Estimation",
      title: "Start at estimation",
      unit: "one-step-estimator",
      stage: "estimation",
      probes: ["onestep"],
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
      review: ["clever-covariate"],
      why: "You know the estimator and what its correction removes. What is left is trust: when the interval is honest, which standard error to report, what positivity costs, and how wrong unmeasured confounding could make you.",
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
    "clever-covariate": "TMLE's fluctuation, which the quiz did not ask about.",
    "standard-errors": "Influence-function, sandwich and bootstrap standard errors side by side.",
  };

  const isCorrect = (q, a) => a !== UNSURE && a != null && Number(a) === q.answer;

  /* Pure scoring. `answers` is an array (or object keyed by question id) whose entries are an option
     index or "unsure". Returns the recommended placement, review lessons and a summary of strengths. */
  function score(answers) {
    const get = (q, i) =>
      Array.isArray(answers) ? answers[i] : answers ? answers[q.id] : undefined;
    const correct = {};
    QUESTIONS.forEach((q, i) => (correct[q.id] = isCorrect(q, get(q, i))));
    const unsure = QUESTIONS.filter((q, i) => {
      const a = get(q, i);
      return a === UNSURE || a == null;
    }).length;
    const ok = PLACEMENTS.map((p) => p.probes.every((id) => correct[id]));
    const missed = ok.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const last = PLACEMENTS.length - 1;
    let index,
      isolated = null;
    if (!missed.length) index = last;
    else if (missed.length === 1 && missed[0] < last - 1) {
      // One unfamiliar piece followed by at least two familiar ones: review it, do not restart.
      isolated = PLACEMENTS[missed[0]];
      index = last;
    } else index = missed[0];
    const place = PLACEMENTS[index];
    const review = [];
    const gap = isolated
      ? QUESTIONS.find((q) => q.id === isolated.probes.find((id) => !correct[id]))
      : null;
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
      review: review.slice(0, 2),
      isolated: isolated ? isolated.id : null,
      gapTopic: gap ? gap.topic : null,
      strengths: [...new Set(strengths)],
      correct: QUESTIONS.filter((q) => correct[q.id]).length,
      unsure,
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
  // The warm opening sentence of the result, chosen from the answers (never a score).
  function opener(r) {
    if (r.correct === r.total)
      return "Every answer matched. You clearly know this material, so the course can meet you near the end of the main route.";
    if (r.unsure === r.total)
      return "Thank you for being honest. You are exactly who this course was written for, and it starts from first principles.";
    if (!r.strengths.length)
      return "Good. Now you know where the course has the most to give you.";
    if (r.strengths.length > 3) return "You already know a good deal of this.";
    return `You were already solid on ${listJoin(r.strengths)}.`;
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
          return v && v.version === 1 && PLACEMENTS.some((p) => p.id === v.placement) ? v : null;
        } catch {
          return null;
        }
      },
      set(v) {
        try {
          win.localStorage.setItem(KEY, JSON.stringify(v));
        } catch {}
      },
    };
    let answers = [],
      current = 0;

    el.innerHTML = '<div class="pl-card" aria-live="off"></div>';
    const card = el.firstChild;
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
            <p>Find your starting point in ${QUESTIONS.length === 7 ? "seven" : QUESTIONS.length} questions. “I'm not sure” is always an answer, and a useful one.</p>
          </div>
          <div class="pl-cta">
            <button type="button" class="go pl-begin">Find my starting point <span aria-hidden="true">→</span></button>
            <span class="pl-note">About two minutes. Nothing is graded.</span>
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
          <p class="pl-sum-text" tabindex="-1"><span class="pl-sum-dot" aria-hidden="true"></span>You started at <b>${esc(p.name.charAt(0).toUpperCase() + p.name.slice(1))}</b>.
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
      store.set({ version: 1, placement: r.placement, answers: answers.slice(), at: new Date().toISOString() });
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
          <p class="pl-why">${esc(opener(r))}${isoText} ${esc(p.why)}</p>
          ${reviewHtml}
          <div class="pl-actions">
            <a class="go pl-start" href="lessons/${esc(u.file)}">Start here <span aria-hidden="true">→</span></a>
            ${earlier.length ? '<button type="button" class="pl-skim">Mark earlier lessons as skimmed</button>' : ""}
            <button type="button" class="pl-link pl-again">Take it again</button>
          </div>
          ${earlier.length ? `<p class="pl-fine">Skimmed means opened, not mastered: the ${earlier.length} earlier lesson${earlier.length > 1 ? "s" : ""} stay open for their transfer checks.</p>` : ""}
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
      const cont = doc.getElementById("continue"),
        before = cont ? cont.innerHTML : "";
      // Never "demonstrated": explore only moves a lesson from new to explored.
      todo.forEach((unit) => event({ type: "explore", unit }));
      const saved = store.get() || { version: 1, placement: r.placement, answers: answers.slice() };
      saved.skimmed = true;
      store.set(saved);
      const note = todo.length
        ? `Marked ${todo.length} earlier lesson${todo.length > 1 ? "s" : ""} as skimmed. The route and Up next now point here.`
        : "Every earlier lesson was already opened, so nothing changed.";
      // The course map re-renders on state changes if it subscribes; if it did not, reload so the
      // route and the Up next card reflect the new state, and restore this card afterwards.
      if (todo.length && cont && cont.innerHTML === before) {
        try {
          win.sessionStorage.setItem(KEY + ".note", note);
        } catch {}
        win.location.reload();
        return;
      }
      summary(saved, true, note);
    }

    let note = null;
    try {
      note = win.sessionStorage.getItem(KEY + ".note");
      win.sessionStorage.removeItem(KEY + ".note");
    } catch {}
    const saved = store.get();
    if (saved) summary(saved, !!note, note);
    else intro(false);
  }

  return { QUESTIONS, PLACEMENTS, UNSURE, KEY, score, earlierUnits, coreUnits, isCorrect, mount };
});
