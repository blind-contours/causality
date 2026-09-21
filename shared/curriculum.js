/* Curriculum and prerequisite graph; independent of page rendering. */
(function () {
  const legacy = {
    name: "Causality",
    chapters: [
      {
        id: "targeting",
        title: "Targeting: fixing a machine-learned estimate",
        units: [
          {
            id: "one-step-estimator",
            minutes: 12,
            file: "01-one-step-estimator.html",
            title: "The One-Step Estimator",
            blurb:
              "A plug-in from a regularized learner is biased. One step removes the first-order part. For the ATE it is AIPW.",
            recap: [
              {
                q: "A regularized S-learner's ATE comes out smaller than the truth. Why?",
                options: [
                  "Random noise in the sample",
                  "Shrinkage pulls the treatment coefficient toward zero and the plug-in inherits it",
                  "The propensity model is wrong",
                ],
                answer: 1,
                hint: "The one-step lesson’s λ slider: shrinkage is bias, not noise.",
              },
              {
                q: "The one-step estimator is the plug-in plus what?",
                options: [
                  "The sample mean of the influence function at the fitted P̂",
                  "A bootstrap correction",
                  "The propensity score",
                ],
                answer: 0,
                hint: "ψ(P̂) + PₙD(P̂). For the ATE the second term is the mean of the weighted residuals.",
              },
              {
                q: "For the ATE, the one-step estimator is the same as:",
                options: [
                  "A causal forest",
                  "Inverse probability weighting",
                  "AIPW (augmented IPW)",
                ],
                answer: 2,
                hint: "Plug-in plus the mean of H·(Y − μ̂) is exactly AIPW.",
              },
            ],
          },
          {
            id: "scores-from-scratch",
            minutes: 25,
            file: "02-scores-from-scratch.html",
            title: "Scores and Influence, From Scratch",
            blurb:
              "A distribution is a point, a path is p(1+εh), a score is a slope. What the parameter does along a path.",
            recap: [
              {
                q: "In the path p_ε = p(1 + εh), what is z?",
                options: [
                  "A covariate",
                  "The whole observation, e.g. (X, A, Y)",
                  "The parameter",
                ],
                answer: 1,
                hint: "z is a point in the space of observations; z₀ is one specific patient's value.",
              },
              {
                q: "Why must a score h have mean zero under p?",
                options: [
                  "So the slope is positive",
                  "Because total probability mass must stay one along the path",
                  "It's a convention",
                ],
                answer: 1,
                hint: "∫ p(1+εh) = 1 + ε∫hp, so ∫hp must be 0.",
              },
              {
                q: "The pathwise derivative dψ/dε at ε = 0 equals:",
                options: ["E[ϕ·h]", "E[h]", "Var(h)"],
                answer: 0,
                hint: "One function ϕ works for every direction h; that ϕ is the influence function.",
              },
            ],
          },
          {
            id: "mean-along-a-path",
            minutes: 15,
            file: "03-mean-along-a-path.html",
            title: "The Mean Along a Path",
            blurb:
              "Derive D(z) = z − ψ for the mean as arithmetic on bins. No calculus you can't see.",
            recap: [
              {
                q: "Along the path p(1+εh), what changes and what doesn't?",
                options: [
                  "Positions z change, masses stay",
                  "Masses change, positions z stay",
                  "Both change",
                ],
                answer: 1,
                hint: "The bins are fixed; only the mass in each bin moves.",
              },
              {
                q: "Why can you subtract any constant c from z inside ∫ z h p dz?",
                options: [
                  "Because ∫ h p = 0, so ∫ c h p = 0",
                  "Because c is small",
                  "You can't",
                ],
                answer: 0,
                hint: "The mean-zero property of h is what pays for it.",
              },
              {
                q: "Choosing c = ψ gives the influence function of the mean as:",
                options: ["z", "z − ψ", "ψ − z²"],
                answer: 1,
                hint: "Centered so that it also measures misfit: Pₙ(z − ψ̂) = z̄ − ψ̂.",
              },
            ],
          },
          {
            id: "under-the-integral",
            minutes: 10,
            file: "04-under-the-integral.html",
            title: "Differentiating Under the Integral",
            blurb:
              "Leibniz's rule as a table: rows ε, columns z. The slope of a sum is the sum of slopes.",
            recap: [
              {
                q: "In the (ε, z) table, the value in one cell is linear in ε with slope:",
                options: ["z·p(z)·h(z)·dz", "p(z)·dz", "ε·z"],
                answer: 0,
                hint: "Each cell is z·p(z)(1+εh(z))dz; its ε-slope is z·p·h·dz.",
              },
              {
                q: "The slope of the row sum equals:",
                options: [
                  "The product of the cell slopes",
                  "The sum of the cell slopes",
                  "The largest cell slope",
                ],
                answer: 1,
                hint: "Derivative of a sum is the sum of derivatives; that is all Leibniz's rule says here.",
              },
              {
                q: "Summing z·p·h·dz over z gives:",
                options: ["E[Z]", "E[Z·h(Z)]", "Var(Z)"],
                answer: 1,
                hint: "A value times a probability, added up, is an expectation.",
              },
            ],
          },
          {
            id: "one-move-two-faces",
            minutes: 10,
            file: "05-one-move-two-faces.html",
            title: "One Move, Two Faces",
            blurb:
              "Tilting the density of Y and shifting the regression are the same move. And Pₙ is a point too.",
            recap: [
              {
                q: "Tilt the conditional density of Y by exp(ε·H·(y − μ)). Its score at ε = 0 is:",
                options: ["H", "H·(y − μ)", "y − μ"],
                answer: 1,
                hint: "The score is the derivative of the log of the tilt factor.",
              },
              {
                q: "For a Gaussian Y with variance 1, the mean of the tilted density is:",
                options: ["μ + ε·H", "μ·(1 + ε)", "μ + ε"],
                answer: 0,
                hint: "That is exactly the regression fluctuation μ_ε = μ̂ + εH.",
              },
              {
                q: "The one-step correction PₙD(P̂) is the gap between averaging D under:",
                options: ["P̂ and P", "Pₙ and P̂", "Pₙ and P"],
                answer: 1,
                hint: "P̂ D(P̂) = 0 by construction, so PₙD(P̂) = (Pₙ − P̂)D(P̂).",
              },
            ],
          },
          {
            id: "two-strata",
            minutes: 20,
            file: "06-two-strata.html",
            title: "Two Strata, One Step",
            blurb:
              "With 100 patients, why the fit should move in proportion to 1/π. Budget, marginal cost, positivity, and the strip trade.",
            recap: [
              {
                q: "Raising the old curve by δ costs 5δ² and the young curve 45δ². Why the difference?",
                options: [
                  "Old patients have bigger outcomes",
                  "Only treated people resist the move, and there are 5 vs 45 of them",
                  "The old stratum is smaller",
                ],
                answer: 1,
                hint: "Cost is one square of side δ per treated person.",
              },
              {
                q: "At the optimal split, δ_old / δ_young equals:",
                options: ["1", "9 = π(young)/π(old)", "45"],
                answer: 1,
                hint: "Equal marginal cost: 90δ_Y = 10δ_O.",
              },
              {
                q: "Which of these depends on the residuals?",
                options: ["The direction δ ∝ 1/π", "The step size ε̂", "Both"],
                answer: 1,
                hint: "The direction is set by ψ and the design; only ε̂ is fit to data.",
              },
            ],
          },
          {
            id: "clever-covariate",
            minutes: 15,
            file: "07-clever-covariate.html",
            title: "Where the Clever Covariate Comes From",
            blurb:
              "D is centered, D is the steepest direction, and moving along it by likelihood solves PₙD = 0.",
            recap: [
              {
                q: "Among directions h with E[h²] = 1, which gives the largest dψ/dε?",
                options: [
                  "h = constant",
                  "h ∝ D (the influence function)",
                  "h ∝ z",
                ],
                answer: 1,
                hint: "Cauchy–Schwarz: E[Dh] ≤ √E[D²]·√E[h²], equality when h ∝ D.",
              },
              {
                q: "Fluctuating along D and choosing ε by maximum likelihood stops where:",
                options: ["PₙD = 0", "ε = 1", "The likelihood is zero"],
                answer: 0,
                hint: "The score of the fluctuation at ε = 0 is D itself.",
              },
              {
                q: "For the ATE, the clever covariate H is:",
                options: ["π(X)", "A/π(X) − (1−A)/(1−π(X))", "Y − μ(X)"],
                answer: 1,
                hint: "The coefficient of the residual in the efficient influence function.",
              },
            ],
          },
          {
            id: "four-patients",
            minutes: 12,
            file: "08-four-patients.html",
            title: "Four Patients",
            blurb:
              "Type the four values of D(Zᵢ) yourself and watch their mean equal the correction. Then ε̂ by hand.",
            recap: [
              {
                q: "With four patients, the one-step correction PₙD(P̂) is:",
                options: [
                  "The largest D(Zᵢ)",
                  "The mean of the four D(Zᵢ)",
                  "The sum of the four residuals",
                ],
                answer: 1,
                hint: "Pₙ means average over the sample.",
              },
              {
                q: "A treated patient's D(Zᵢ) for E[Y(1)] includes the residual times:",
                options: ["π(Xᵢ)", "1/π(Xᵢ)", "1"],
                answer: 1,
                hint: "H = A/π for the treated arm.",
              },
              {
                q: "ε̂ = ΣH r / ΣH² is:",
                options: [
                  "A least-squares slope of r on H with no intercept",
                  "A mean of r",
                  "A variance",
                ],
                answer: 0,
                hint: "One regressor, one coefficient.",
              },
            ],
          },
          {
            id: "efficiency-theory-story",
            minutes: 25,
            file: "09-efficiency-theory-story.html",
            title: "Efficiency Theory, Drawn",
            blurb:
              "Nine pictures: parameter as map, tangent space, projection, plug-in bias, double robustness, TMLE walk, coverage.",
            recap: [],
          },
        ],
      },
    ],
  };
  const old = Object.fromEntries(
    legacy.chapters[0].units.map((u) => [u.id, u]),
  );
  old["clever-covariate"].blurb =
    "Choose a direction that moves the target; fit a fluctuation and check its score.";
  old["clever-covariate"].recap[1] = {
    q: "For the Gaussian mean tilt used here, the fitted fluctuation solves:",
    options: [
      "The updated empirical influence-function equation",
      "Every possible target equation",
      "The identification assumptions",
    ],
    answer: 0,
    hint: "This equality is exact for this mean model. General locally least-favorable fluctuations may require iteration.",
  };
  old["two-strata"].recap[0].q =
    "The local Gaussian information metric is 5δ² for old and 45δ² for young. Why?";
  old["two-strata"].recap[0].hint =
    "This is twice the KL divergence for independent unit-variance Gaussians, not the observed loss change from an arbitrary initial fit.";
  const add = (id, file, title, blurb, stage) => ({
    id,
    file,
    title,
    blurb,
    stage,
    minutes: 8,
    recap: [],
  });
  const groups = [
    {
      id: "question",
      title: "Ask, identify, and choose a target",
      description:
        "Start with the scientific question. Keep the estimand visible as the models change.",
      stage: "question",
      units: [
        add(
          "causal-roadmap",
          "00-causal-roadmap.html",
          "What are we trying to learn?",
          "Build an estimand contract, adjust for severity, and break an identifying assumption.",
          "identification",
        ),
      ],
    },
    {
      id: "geometry",
      title: "Feel the geometry",
      description:
        "Move probability before naming scores and tangent spaces. The guided route introduces one representation at a time.",
      stage: "model",
      units: [
        add(
          "canonical-gradient",
          "10-canonical-gradient.html",
          "Build a canonical gradient",
          "Move three probabilities, predict slopes, then rotate and project the geometry.",
          "model",
        ),
        old["mean-along-a-path"],
        old["scores-from-scratch"],
        old["under-the-integral"],
      ],
    },
    {
      id: "targeting",
      title: "Turn geometry into an estimator",
      description:
        "Correct a fit, inspect individual contributions, and understand when targeting equations hold.",
      stage: "estimation",
      units: [
        old["one-step-estimator"],
        old["one-move-two-faces"],
        old["two-strata"],
        old["clever-covariate"],
        old["four-patients"],
      ],
    },
    {
      id: "inference",
      title: "Know what your uncertainty means",
      description:
        "Separate consistency from efficiency and return to the survival analyses you already know.",
      stage: "uncertainty",
      units: [
        add(
          "inference-lab",
          "11-inference-lab.html",
          "When does the correction earn a confidence interval?",
          "Experiment with nuisance correctness, product rates, cross-fitting, and repeated samples.",
          "uncertainty",
        ),
        old["efficiency-theory-story"],
        add(
          "survival-lab",
          "12-survival-lab.html",
          "From KM and Cox back to the question",
          "Compare survival and restricted mean survival under confounding and censoring.",
          "interpretation",
        ),
      ],
    },
  ];
  // Short labels for the course map. Titles stay as written on each lesson.
  const short = {
    "causal-roadmap": "The question",
    "canonical-gradient": "Canonical gradient",
    "mean-along-a-path": "Mean along a path",
    "scores-from-scratch": "Scores & influence",
    "under-the-integral": "Under the integral",
    "one-step-estimator": "One-step estimator",
    "one-move-two-faces": "One move, two faces",
    "two-strata": "Two strata",
    "clever-covariate": "Clever covariate",
    "four-patients": "Four patients",
    "inference-lab": "Inference lab",
    "efficiency-theory-story": "Efficiency theory",
    "survival-lab": "Survival lab",
    "interference-lab": "Spillovers",
    "experiment-design-lab": "What to randomize",
    "marketplace-decision-lab": "Decide from evidence",
  };
  groups.push({
    id: "spillover",
    title: "Experiment when treatments spill over",
    description:
      "A branch after the inference laboratory: define effects when one unit's treatment reaches another, choose what to randomize in a shared fleet, and judge whether the evidence supports a decision. The clinical study stays as it is; the marketplace is a transfer to a new setting.",
    stage: "estimation",
    units: [
      add(
        "interference-lab",
        "13-interference-lab.html",
        "Whose treatment changes whose outcome?",
        "Eight connected people, exact enumeration of every assignment, and the difference between direct, spillover and full-policy effects.",
        "identification",
      ),
      add(
        "experiment-design-lab",
        "14-experiment-design-lab.html",
        "What should we randomize?",
        "Two zones, one shared fleet: step through requests, then compare request-level randomization with randomized switchbacks.",
        "estimation",
      ),
      add(
        "marketplace-decision-lab",
        "15-marketplace-decision-lab.html",
        "Does the evidence support the decision?",
        "Repeated experiments, a validated benchmark, calibration against a named target, and a one-page recommendation.",
        "uncertainty",
      ),
    ],
  });
  const recaps = {
    "interference-lab": [
      {
        q: "Two neighbours' outcomes rise together after a heatwave. Is that interference?",
        options: [
          "Yes: outcomes moved together",
          "Not by itself: a shared shock moves outcomes without one unit's treatment reaching another",
          "Only if the graph has a bridge",
        ],
        answer: 1,
        hint: "Interference means changing one unit's assignment changes another unit's outcome.",
      },
      {
        q: "Under individual Bernoulli randomization in the eight-unit model, the treated-minus-control contrast estimates:",
        options: [
          "The direct effect τ",
          "τ − γ/7",
          "The full-policy effect τ + γ",
        ],
        answer: 1,
        hint: "Treating unit i removes one potential treated neighbour for each of the other seven.",
      },
    ],
    "experiment-design-lab": [
      {
        q: "A request's policy is assigned at arrival. What decides whether a B request finds a vehicle?",
        options: [
          "Only its own policy",
          "Its policy and the fleet state left by earlier requests, whatever their policy",
          "The block it falls in, nothing else",
        ],
        answer: 1,
        hint: "Shared supply is the mechanism of spillover between requests.",
      },
      {
        q: "Deleting the first five minutes after a switch from the analysis:",
        options: [
          "Resets the fleet to the same state as at the start",
          "Changes which requests are analysed; the vehicles stay where they were",
          "Makes the switchback estimate equal to the policy effect",
        ],
        answer: 1,
        hint: "A washout is an analysis choice with a scientific rationale; it is not a physical reset.",
      },
    ],
    "marketplace-decision-lab": [
      {
        q: "In the fleet simulation the request-level estimate and the all-B minus all-A reference differ. Which fixes the mismatch?",
        options: [
          "A larger standard error",
          "Neither: they answer different questions; a design that randomizes the whole market targets the policy effect",
          "More replications",
        ],
        answer: 1,
        hint: "A standard error describes uncertainty about a contrast; it cannot change which contrast is measured.",
      },
      {
        q: "A sharp-null randomization test for a switchback should resample:",
        options: [
          "Individual requests",
          "The block sequence under the actual design",
          "Vehicles",
        ],
        answer: 1,
        hint: "Resample the design that was actually run; the null is no policy effect on any block.",
      },
    ],
  };
  const explicitPrerequisites = {
    "interference-lab": ["causal-roadmap", "inference-lab"],
    "experiment-design-lab": ["interference-lab"],
    "marketplace-decision-lab": ["experiment-design-lab"],
  };
  const minutes = {
    "interference-lab": 30,
    "experiment-design-lab": 30,
    "marketplace-decision-lab": 35,
  };
  let previous = null;
  for (const chapter of groups)
    for (const unit of chapter.units) {
      unit.stage ||= chapter.stage;
      unit.short ||= short[unit.id] || unit.title;
      if (minutes[unit.id]) unit.minutes = minutes[unit.id];
      if (recaps[unit.id]) unit.recap = recaps[unit.id];
      unit.prerequisites =
        explicitPrerequisites[unit.id] || (previous ? [previous] : []);
      previous = unit.id;
    }
  // Three questions that let someone who already knows identification skip the roadmap lesson.
  const diagnostic = {
    unit: "causal-roadmap",
    next: "canonical-gradient",
    questions: [
      {
        q: "Which assumption lets E[Y | A=1, X] stand in for E[Y(1) | X]?",
        options: [
          "Positivity",
          "Conditional exchangeability: no unmeasured confounding given X",
          "Consistency",
        ],
        answer: 1,
      },
      {
        q: "In the population, no high-severity patient is ever treated (propensity exactly 0). For the population ATE, what does that break?",
        options: [
          "Nothing; a flexible outcome model extrapolates",
          "Positivity: that stratum's treated mean is not identified without further assumptions",
          "Consistency",
        ],
        answer: 1,
      },
      {
        q: "Two worlds produce identical observed data but different ATEs. What resolves it?",
        options: [
          "A larger sample",
          "A doubly robust estimator",
          "Nothing in the data; only assumptions or a different design",
        ],
        answer: 2,
      },
    ],
  };
  window.CausalCurriculum = {
    name: "Causality",
    chapters: groups,
    diagnostic,
    roadmap: [
      "question",
      "identification",
      "model",
      "estimation",
      "uncertainty",
      "interpretation",
    ],
  };
})();
