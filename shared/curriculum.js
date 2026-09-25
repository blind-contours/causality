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
              "Optional aside. Leibniz's rule as a table: rows ε, columns z. The slope of a sum is the sum of slopes.",
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
              "Type the four values of D(Zᵢ) yourself and watch their mean equal the correction. Then ε̂, TMLE, a standard error and a 95% interval by hand.",
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
              "Eight pictures: parameter as map, asymptotic linearity, tangent space, projection, plug-in bias, double robustness, and the TMLE walk.",
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
        "Start with the scientific question and write it down precisely, including what happens when patients die, cross over or stop treatment.",
      stage: "question",
      units: [
        add(
          "causal-roadmap",
          "00-causal-roadmap.html",
          "What are we trying to learn?",
          "Explore whose effect matters, absolute and relative risks, and survival gaps versus areas. Save your question, then test identification.",
          "identification",
        ),
        add(
          "intercurrent-events",
          "17-intercurrent-events.html",
          "When something happens after treatment starts",
          "Death, explant, crossover, rescue: the five ICH E9(R1) strategies rewrite what counts for each patient, and the answer moves with them.",
          "question",
        ),
      ],
    },
    {
      id: "design",
      title: "Design the study you wish you had run",
      description:
        "Write the protocol of the randomized trial you would run, then emulate it with the data you have. Time zero, eligibility and assignment must line up.",
      stage: "identification",
      units: [
        add(
          "target-trial",
          "18-target-trial.html",
          "Design the target trial",
          "Specify the trial, then emulate it. Drag time zero and watch immortal time manufacture a benefit.",
          "identification",
        ),
        add(
          "clone-censor-weight",
          "19-clone-censor-weight.html",
          "Clone, censor, weight",
          "Copy each patient into every strategy, cut the copies that deviate, and reweight the rest.",
          "identification",
        ),
      ],
    },
    {
      id: "hook",
      title: "The payoff, first",
      description:
        "Before any geometry: the same estimator the course builds, used where it is easiest to trust, in a randomized trial.",
      stage: "estimation",
      units: [
        add(
          "rct-adjustment",
          "16-rct-adjustment.html",
          "Your trial, adjusted",
          "Adjust a randomized trial for prognostic covariates: same estimand, narrower interval. See how many patients it is worth, and why it stays valid.",
          "estimation",
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
        old["scores-from-scratch"],
        old["mean-along-a-path"],
        old["under-the-integral"],
        add(
          "canonical-gradient",
          "10-canonical-gradient.html",
          "Build a canonical gradient",
          "Move three probabilities, predict slopes, then rotate and project the geometry.",
          "model",
        ),
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
        old["two-strata"],
        old["clever-covariate"],
        old["one-move-two-faces"],
        old["four-patients"],
      ],
    },
    {
      id: "inference",
      title: "Trust the answer",
      description:
        "See the whole efficiency story in one picture, test when an interval can be trusted, report a standard error, check positivity, and ask how wrong unmeasured confounding could make you.",
      stage: "uncertainty",
      units: [
        old["efficiency-theory-story"],
        add(
          "inference-lab",
          "11-inference-lab.html",
          "When does the correction earn a confidence interval?",
          "Experiment with nuisance correctness, product rates, cross-fitting, and repeated samples.",
          "uncertainty",
        ),
        add(
          "standard-errors",
          "20-standard-errors.html",
          "Standard errors you can report",
          "Influence-function, sandwich and bootstrap standard errors side by side, and why they disagree when a model is wrong.",
          "uncertainty",
        ),
        add(
          "positivity",
          "21-positivity.html",
          "Positivity and weights",
          "Overlap plots, effective sample size, and what trimming or truncating weights buys and costs.",
          "uncertainty",
        ),
        add(
          "sensitivity",
          "22-sensitivity.html",
          "How wrong could unmeasured confounding make you?",
          "A bias map, the E-value, and the κ from the first lesson made quantitative.",
          "uncertainty",
        ),
      ],
    },
    {
      id: "survival",
      title: "Return to survival",
      description:
        "Bring the estimand, the geometry and the estimators back to Kaplan–Meier, Cox and restricted mean survival, then target the survival curve itself.",
      stage: "interpretation",
      units: [
        add(
          "survival-lab",
          "12-survival-lab.html",
          "From KM and Cox back to the question",
          "Compare survival and restricted mean survival under confounding and censoring.",
          "interpretation",
        ),
        add(
          "targeted-survival",
          "23-targeted-survival.html",
          "Targeted survival curves and ΔRMST",
          "Weight for censoring, augment, and target S(τ) and RMST with an influence-function interval.",
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
    "intercurrent-events": "Intercurrent events",
    "target-trial": "Target trial",
    "clone-censor-weight": "Clone, censor, weight",
    "rct-adjustment": "Your trial, adjusted",
    "standard-errors": "Standard errors",
    "positivity": "Positivity",
    "sensitivity": "Sensitivity",
    "targeted-survival": "Targeted survival",
    "interference-lab": "Spillovers",
    "experiment-design-lab": "What to randomize",
    "marketplace-decision-lab": "Decide from evidence",
  };
  groups.push({
    id: "spillover",
    title: "Elective: experiments when treatments spill over",
    elective: true,
    description:
      "An optional branch after the inference laboratory: define effects when one unit's treatment reaches another, choose what to randomize in a shared fleet, and judge whether the evidence supports a decision. The clinical study stays as it is; the marketplace is a transfer to a new setting.",
    stage: "identification",
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
    "intercurrent-events": [
      { q: "Under a treatment-policy strategy, control patients who cross over to the device keep their post-crossover scores. The estimated device benefit is usually:", options: ["Larger than without crossover", "Smaller, because the control arm gains some device benefit", "Unchanged, because crossover happens after randomization"], answer: 1, hint: "Pair C's control patient scored 48 after crossover instead of 24: the control mean rises and the difference shrinks." },
      { q: "Why does the principal-stratum strategy need extra assumptions?", options: ["Its sample size is smaller", "Membership depends on events under both arms, and each patient reveals only one", "Randomization is broken by death"], answer: 1, hint: "Being event-free on the device does not show you would have been event-free on medical therapy." },
    ],
    "target-trial": [
      { q: "In a target trial emulation, what three things must happen at time zero?", options: ["Eligibility is met, a strategy is assigned, and follow-up starts", "The procedure is performed, the outcome is measured, and the patient is censored", "Propensity scores are fitted, weights are trimmed, and follow-up starts"], answer: 0, hint: "In a randomized trial all three happen at randomization. A registry analysis must make them coincide on purpose." },
      { q: "A device truly does nothing. Treated patients' follow-up starts at the procedure, untreated patients' at eligibility. What happens?", options: ["The estimate is unbiased because both clocks start at an event", "The device looks protective: waiting-list deaths are charged to the untreated", "The device looks harmful because treated patients are older"], answer: 1, hint: "To be counted as treated, a patient had to survive the wait. That waiting time is immortal time." },
    ],
    "clone-censor-weight": [
      { q: "With a 3-month grace period, a patient dies in month 2 while still waiting for the procedure. Where does the death count?", options: ["Only in the No procedure arm", "In both arms", "In neither arm; the clone is censored"], answer: 1, hint: "Up to death the history is compatible with both strategies, so both clones record the death." },
      { q: "Why are unweighted Kaplan–Meier curves of the clones biased?", options: ["Cloning doubles the sample size", "Artificial censoring depends on prognosis, because treatment decisions do", "KM cannot handle ties at monthly times"], answer: 1, hint: "Frail patients wait longer: the Operate arm loses its frailest clones at the end of the window, the No procedure arm loses its most robust." },
    ],
    "rct-adjustment": [
      { q: "In a randomized trial you adjust for baseline covariates with a linear outcome model that turns out to be wrong. What happens to the standardized estimate?", options: ["It is biased toward the model's prediction", "It stays centered on the marginal effect; only the precision gain shrinks", "It becomes a conditional effect"], answer: 1, hint: "Randomization makes the propensity known, and the standardized estimator is AIPW with that known propensity." },
      { q: "With perfect randomization and a strongly prognostic covariate, the logistic-regression odds ratio for treatment is:", options: ["The same number as the marginal odds ratio", "Farther from 1 than the marginal odds ratio (non-collapsibility)", "Biased by confounding"], answer: 1, hint: "Within-stratum odds ratios of 3 gave a whole-population odds ratio of 2.18. Standardize to recover the marginal effect." },
    ],
    "inference-lab": [
      { q: "With a 1-nearest-neighbour outcome model fitted and evaluated on the same patients, what goes wrong with the AIPW interval?", options: ["It is too narrow, because the own-arm residuals are zero", "It is centred far from the truth", "Nothing, if the propensity model is correct"], answer: 0, hint: "Each patient is its own nearest neighbour, so the influence-function values lose the outcome noise." },
      { q: "In the 2×2 grid of nuisance cases, which panel's AIPW estimates are centred away from the true ATE?", options: ["Only outcome and propensity both wrong", "Any panel with one wrong model", "All four"], answer: 0, hint: "One correct nuisance model is enough for the point estimate: double robustness." },
    ],
    "standard-errors": [
      { q: "AIPW uses a correctly specified logistic propensity model and a misspecified outcome model. The influence-function SE, which treats the fitted models as fixed, will tend to be:", options: ["Too small", "Too large (conservative)", "Correct"], answer: 1, hint: "Estimating a correct propensity model lowers the estimator's variance; the fixed-nuisance formula measures the known-propensity estimator instead." },
      { q: "Both nuisance models are wrong and AIPW is biased by 0.6. A bootstrap that refits both models in every resample gives SE 0.118, equal to the true SD. What will 95% interval coverage be?", options: ["About 95%", "Close to 0%", "Above 95%"], answer: 1, hint: "A standard error measures spread, not bias; intervals around a biased centre miss the truth." },
    ],
    "positivity": [
      { q: "Trimming patients whose ĝ lies outside [0.1, 0.9] mainly changes:", options: ["Only the variance; the target is still the ATE", "The target population, so the estimand is no longer the ATE", "Nothing, if the propensity model is correct"], answer: 1, hint: "The kept patients have a different covariate mix, so their average effect differs whenever effects vary with covariates (Crump et al. 2009)." },
      { q: "Capping weights at their 99th percentile:", options: ["Keeps the ATE as the target but biases the estimator for it", "Changes the estimand to the ATO", "Removes both bias and variance"], answer: 0, hint: "The question is unchanged; the capped patients stand in for fewer people than they should, so the thin region is under-represented." },
    ],
    "sensitivity": [
      { q: "An observed RR of 1.5 has E-value 2.37. Which statement is correct?", options: ["There is a 2.37-to-1 chance the effect is causal", "A confounder tied to treatment and outcome by RR 2.37 each, beyond measured covariates, could explain it away; one weaker on both could not", "The true RR is at least 2.37"], answer: 1, hint: "The E-value is a strength of association on the RR scale, where the diagonal meets the curve B = RR." },
      { q: "A 95% CI for a risk ratio is 0.9 to 1.6. What is the E-value for the interval?", options: ["1", "1.6 + √(1.6 × 0.6)", "1/0.9"], answer: 0, hint: "The interval already contains 1, so no confounding is needed to reach the null." },
    ],
    "targeted-survival": [
      { q: "Why does 1/G(t−|A,X) appear in the influence function of S₁(τ)?", options: ["It makes the curve monotone", "The risk set at month t is thinned by the probability of still being followed, so each patient still followed stands in for 1/G similar patients", "It converts hazards to odds"], answer: 1, hint: "P(T̃ ≥ t | a, x) = S(t−1 | a, x) · G(t− | a, x)." },
      { q: "The event-hazard model omits severity but the censoring and treatment models are right. The one-step estimate of S₁(τ) is:", options: ["Biased like the plug-in", "Still consistent: the augmentation repairs the hazard model", "Undefined"], answer: 1, hint: "Double robustness: the correction has mean zero whenever g and G are right." },
    ],
    "causal-roadmap": [
      {
        q: "Switch from ATE to ATT while keeping the treatment effects within each severity group fixed. What changes?",
        options: ["The treatment itself", "The population weights used to average effects", "Only the name of the estimator"],
        answer: 1,
        hint: "ATT averages over the actually treated population, held fixed in both intervention worlds.",
      },
      {
        q: "A gap between survival curves at year 5 and an area between them through year 5 have which units?",
        options: ["Both are hazard ratios", "Both are years", "Probability and years, respectively"],
        answer: 2,
        hint: "Survival at a date is a probability; RMST accumulates time alive within the window.",
      },
    ],
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
    "causal-roadmap": 25,
    "intercurrent-events": 18,
    "target-trial": 20,
    "clone-censor-weight": 18,
    "rct-adjustment": 15,
    "standard-errors": 15,
    "positivity": 15,
    "sensitivity": 15,
    "targeted-survival": 25,
    "interference-lab": 30,
    "experiment-design-lab": 30,
    "marketplace-decision-lab": 35,
  };
  let previous = null;
  for (const chapter of groups)
    for (const unit of chapter.units) {
      unit.stage ||= chapter.stage;
      if (chapter.elective) unit.elective = true;
      unit.short ||= short[unit.id] || unit.title;
      if (minutes[unit.id]) unit.minutes = minutes[unit.id];
      if (recaps[unit.id]) unit.recap = recaps[unit.id];
      unit.prerequisites =
        explicitPrerequisites[unit.id] || (previous ? [previous] : []);
      if (!chapter.elective) previous = unit.id;
    }
  // Three questions that let someone who already knows identification skip the roadmap lesson.
  const diagnostic = {
    unit: "causal-roadmap",
    next: "intercurrent-events",
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
