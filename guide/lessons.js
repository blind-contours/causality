/* Teacher's guide data. Written by hand from the lessons themselves: every number and claim below
 * appears in the lesson it describes, or follows exactly from a formula the lesson states. Titles, minutes, stages and order come from
 * shared/curriculum.js at render time, so they are not repeated here.
 * `anchor` is a deep link inside the lesson file (a lab step id, an explicit id in the source, or a
 * legacy topic id "<unit>-topic-<k>" that shared/course.js assigns to the k-th h2 section).
 * tests/guide.test.cjs checks every unit, file and anchor against the curriculum and the sources. */
(function (root) {
  const hines = {
    t: "Hines, Dukes, Diaz-Ordaz and Vansteelandt (2022), Demystifying statistical learning based on efficient influence functions",
    href: "https://doi.org/10.1080/00031305.2021.2021984",
  };
  const vdlRubin = {
    t: "van der Laan and Rubin (2006), Targeted maximum likelihood learning",
    href: "https://doi.org/10.2202/1557-4679.1043",
  };
  const schulerRose = {
    t: "Schuler and Rose (2017), Targeted maximum likelihood estimation for causal inference in observational studies",
    href: "https://doi.org/10.1093/aje/kww165",
  };
  const tl = {
    t: "van der Laan and Rose (2011), Targeted Learning",
    href: "https://doi.org/10.1007/978-1-4419-9782-1",
  };
  const ichE9 = {
    t: "ICH E9(R1) addendum on estimands and sensitivity analysis (2019)",
    href: "https://database.ich.org/sites/default/files/E9-R1_Step4_Guideline_2019_1203.pdf",
  };
  const petersen = {
    t: "Petersen, Porter, Gruber, Wang and van der Laan (2012), Diagnosing and responding to violations in the positivity assumption",
    href: "https://doi.org/10.1177/0962280210386207",
  };
  const sattenDatta = {
    t: "Satten and Datta (2001), The Kaplan–Meier estimator as an inverse-probability-of-censoring weighted average, Am Stat 55(3)",
    href: "https://doi.org/10.1198/000313001317098185",
  };

  const lessons = [
    {
      id: "causal-roadmap",
      background:
        "None beyond means, risks and a survival curve. This is the entry point for everyone. The opening lesson now introduces the motivation for propensity-score weighting and links an optional foundations tutorial adapted from Andy Wilson’s lectures 4a and 4b.",
      goals: [
        "Name the parts of an estimand (population, interventions, outcome, horizon, summary measure) and show how each choice changes the number.",
        "State the conditions that let adjustment for severity identify the average treatment effect: consistency, conditional exchangeability and positivity.",
        "Explain why no estimator can choose between two worlds that produce exactly the same observed patients (the κ shift).",
      ],
      figure: {
        name: "cohort-morph",
        anchor: "cohort-morph",
        label: "Meet your cohort: 100 patients sort themselves in four stages",
        ask: [
          "Waiting room: blue is low severity, orange is high. Roughly how many are high severity? (35 of 100.)",
          "Who got treated: which severity group was treated more often, and what will that do to a simple treated-minus-control comparison?",
          "Their outcomes: the naive gap is 2.59 and the true sample effect is 2. Where does the extra come from?",
          "Compare within severity: why does the systematic bias disappear, while a small difference from 2 remains? (The lesson calls the remainder chance.)",
        ],
      },
      r: null,
      readings: [
        {
          t: "The targeted learning roadmap",
          href: "https://onlinelibrary.wiley.com/doi/10.1155/2014/502678",
        },
        {
          t: "ICH E9(R1): defining an estimand",
          href: "https://database.ich.org/sites/default/files/E9-R1_Step4_Guideline_2019_1203.pdf",
        },
        {
          t: "Royston and Parmar: restricted mean survival time",
          href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3922847/",
        },
      ],
    },
    {
      id: "intercurrent-events",
      background:
        "The estimand from the first lesson. Familiarity with randomized trials and with Kaplan–Meier curves.",
      goals: [
        "Define an intercurrent event and name the five ICH E9(R1) strategies: treatment policy, composite, while on treatment, hypothetical and principal stratum.",
        "Tell which strategies a randomized comparison identifies on its own and which need further assumptions.",
        "Recognise that censoring at crossover targets a hypothetical strategy and rests on non-informative censoring.",
      ],
      figure: {
        name: "Five strategies (twelve patient lanes)",
        anchor: "step-2",
        label: "Same patients, five different questions",
        ask: [
          "Before switching strategy: which patients' values will turn grey, and which will become a red question mark (never observed)?",
          "Under treatment policy, does crossover make the device look better or worse than it would without crossover? (Worse: the device's advantage shrinks.)",
          "A patient dies at month 8. Under which strategies does their 12-month score exist at all?",
        ],
      },
      r: null,
      readings: [
        ichE9,
        {
          t: "FDA adoption of E9(R1) as guidance",
          href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/e9r1-statistical-principles-clinical-trials-addendum-estimands-and-sensitivity-analysis-clinical",
        },
        {
          t: "Kahan, Hindley, Edwards, Cro and Morris (2024), The estimands framework: a primer on the ICH E9(R1) addendum, BMJ 384:e076316",
          href: "https://doi.org/10.1136/bmj-2023-076316",
        },
      ],
    },
    {
      id: "target-trial",
      background:
        "Person-time, rate ratios and Kaplan–Meier curves. The estimand vocabulary of the first two lessons.",
      goals: [
        "Write a target trial protocol and its emulation row by row, and apply the time zero rule: eligibility, assignment and the start of follow-up coincide.",
        "Show how a misaligned time zero manufactures immortal time bias, and recognise two other disguises: prevalent users and eligibility from the future.",
        "Explain why a grace period leaves assignment ambiguous at time zero, which motivates clone, censor, weight.",
      ],
      figure: {
        name: "Twenty patients on the eligibility clock",
        anchor: "step-2",
        label: "Twenty patients, one clock, three places to start it",
        ask: [
          "The device truly does nothing. Under choice (b), will treated patients look better, the same, or worse?",
          "Where do the hatched person-months go under (b), and where do they go under (c)?",
          "Which patients who died on the waiting list end up counted as untreated?",
        ],
      },
      r: null,
      readings: [
        {
          t: "Hernán and Robins (2016), Using big data to emulate a target trial when a randomized trial is not available, Am J Epidemiol",
          href: "https://doi.org/10.1093/aje/kwv254",
        },
        {
          t: "Hernán, Sauer, Hernández-Díaz, Platt and Shrier (2016), Specifying a target trial prevents immortal time bias and other self-inflicted injuries in observational analyses, J Clin Epidemiol",
          href: "https://doi.org/10.1016/j.jclinepi.2016.04.014",
        },
        {
          t: "The TARGET reporting guideline for target trial emulations (JAMA, 2025)",
          href: "https://jamanetwork.com/journals/jama/fullarticle/2837724",
        },
        {
          t: "Suissa (2008), Immortal time bias in pharmacoepidemiology, Am J Epidemiol",
          href: "https://doi.org/10.1093/aje/kwm324",
        },
        {
          t: "FDA, Use of real-world evidence to support regulatory decision-making for medical devices (final guidance, December 2025)",
          href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/use-real-world-evidence-support-regulatory-decision-making-medical-devices",
        },
      ],
    },
    {
      id: "clone-censor-weight",
      background:
        "Target trial and time zero from the previous lesson. Kaplan–Meier and the idea of inverse probability weighting.",
      goals: [
        "Clone each eligible patient into every strategy and cut (artificially censor) a clone when the patient's history stops following its strategy.",
        "Explain why unweighted Kaplan–Meier on the clones is biased when the treatment decision depends on prognosis.",
        "Build inverse probability of censoring weights from a model of the decision, state what they need (no unmeasured confounding of the decision, positivity, a correct model), and report risk and RMST rather than a hazard ratio.",
      ],
      figure: {
        name: "One patient, two copies",
        anchor: "step-1",
        label: "Mr. Ortiz, copied into both plans",
        ask: [
          "On day one, which plan is a patient on the waiting list following? Why do we copy instead of guessing?",
          "He is operated at month 2. Which copy is cut, and when?",
          "He dies in his first month on the waiting list. Where does his death count? (In both copies: both plans were still possible.)",
        ],
      },
      r: null,
      readings: [
        {
          t: "Hernán MA (2018). How to estimate the effect of treatment duration on survival outcomes using observational data. BMJ 360:k182",
          href: "https://doi.org/10.1136/bmj.k182",
        },
        {
          t: "Maringe C, et al. (2020). Reflection on modern methods: trial emulation in the presence of immortal-time bias. Int J Epidemiol 49(5):1719",
          href: "https://doi.org/10.1093/ije/dyaa057",
        },
        {
          t: "Cain LE, Robins JM, Lanoy E, Logan R, Costagliola D, Hernán MA (2010). When to start treatment? A systematic approach to the comparison of dynamic regimes using observational data. Int J Biostat 6(2):18",
          href: "https://doi.org/10.2202/1557-4679.1212",
        },
      ],
    },
    {
      id: "rct-adjustment",
      background:
        "Linear and logistic regression, confidence intervals, and a randomized two-arm trial.",
      goals: [
        "Explain why standardization for a prognostic baseline covariate keeps the marginal estimand of a randomized trial and narrows the interval; use n·R²/(1 − R²) for the extra patients it is worth.",
        "Show that a wrong working model stays centred in a randomized trial, because standardization is AIPW with the known propensity.",
        "Separate conditional from marginal odds ratios (non-collapsibility) and choose a standard error that stays valid when the model is wrong.",
      ],
      figure: {
        name: "Drag the adjusted interval; 4000 repeated trials",
        anchor: "step-2",
        label: "Use what you knew at baseline",
        ask: [
          "X explains half the outcome variance and the trial has 200 patients. How many extra unadjusted patients give the same precision? (About 200.)",
          "Drag the adjusted interval to where you expect it. Then: where are the unadjusted and standardized histograms centred?",
          "The device arm started higher on X by chance. What does standardization do with that imbalance?",
        ],
      },
      r: {
        file: "rct-adjustment.R",
        note: "Unadjusted difference in means against standardization with a robust influence-function SE, in a 1:1 trial with a prognostic covariate.",
      },
      readings: [
        {
          t: "FDA (2023), Adjusting for Covariates in Randomized Clinical Trials for Drugs and Biological Products",
          href: "https://www.fda.gov/media/148910/download",
        },
        {
          t: "Tsiatis, Davidian, Zhang and Lu (2008), Covariate adjustment for two-sample treatment comparisons in randomized clinical trials, Statistics in Medicine",
          href: "https://doi.org/10.1002/sim.3113",
        },
        {
          t: "Benkeser, Díaz, Luedtke, Segal, Scharfstein and Rosenblum (2021), Improving precision and power in randomized trials for COVID-19 treatments using covariate adjustment, Biometrics",
          href: "https://doi.org/10.1111/biom.13377",
        },
        {
          t: "EMA (2022), Qualification opinion for Prognostic Covariate Adjustment (PROCOVA)",
          href: "https://www.ema.europa.eu/en/documents/regulatory-procedural-guideline/qualification-opinion-prognostic-covariate-adjustment-procovatm_en.pdf",
        },
      ],
    },
    {
      id: "scores-from-scratch",
      background:
        "A density on the real line, a derivative in one variable, and an expectation as a weighted sum.",
      goals: [
        "Treat a distribution as a point and a path p(1 + εh) as a one-dimensional submodel; read the score as the slope of log p along the path.",
        "Show that every score has mean zero and that the mean moves along the path at rate E[ϕh] with ϕ(z) = z − ψ.",
        "Read the influence function as one observation's pull on the parameter, and assemble the two parts of the ATE's efficient influence function.",
      ],
      figure: {
        name: "seesaw",
        anchor: "fig-seesaw",
        label: "The mean is a balance point: one more patient on the seesaw",
        ask: [
          "Before the extra patient lands: which way will the beam tip, and which way will the balance point slide?",
          "Move the patient further out. How does the slide change? What is the slide per unit of mass?",
          "Put the patient exactly on the balance point. What happens, and what does that say about ϕ there?",
        ],
      },
      r: null,
      readings: [
        {
          t: "Tsiatis, Semiparametric Theory and Missing Data, chapters 3 and 4 (the lesson's construction follows it)",
        },
        {
          t: "Schuler and van der Laan, Introduction to Modern Causal Inference, sections 3.1 to 3.3",
        },
        hines,
      ],
    },
    {
      id: "mean-along-a-path",
      background: "Scores and Influence, From Scratch, the step on the parameter along the path (helpful, not required: this lesson defines every symbol it uses).",
      goals: [
        "Write the mean as a sum of position times mass and see that along p(1 + εh) only the masses change.",
        "Split ψ(Pε) into ψ(P) + ε∫ z h p dz, and use ∫ h p = 0 to center: the slope is E[(Z − ψ)h].",
        "Explain why ϕ(z) = z − ψ is the only mean-zero gradient of the mean in the nonparametric model.",
      ],
      figure: {
        name: "Subtract any constant",
        anchor: "mean-along-a-path-topic-3",
        label: "You may subtract any constant from z",
        ask: [
          "Drag c far from the data. The shaded product changes shape everywhere. Will its signed area change?",
          "Which single fact makes the area stay put?",
          "Why is c = ψ the natural choice, if every c gives the same slope?",
        ],
      },
      r: null,
      readings: [
        { t: "Tsiatis, Semiparametric Theory and Missing Data, chapter 3" },
        { t: "Schuler and van der Laan, Introduction to Modern Causal Inference, section 3.2" },
      ],
    },
    {
      id: "under-the-integral",
      optional: true,
      background:
        "The mean along a path. The lesson is an optional aside: nothing later depends on it.",
      goals: [
        "See “the derivative passes inside the integral” as exchanging two operations on an (ε, z) table: adding a row and differencing two rows.",
        "Read each cell's slope as z·p(z)·h(z)·dz and add them up to E[Z·h(Z)], then center with the mean-zero score.",
      ],
      figure: {
        name: "Way A against Way B",
        anchor: "under-the-integral-topic-1",
        label: "Subtract row sums, or sum row differences",
        ask: [
          "Before Play: which way gives the larger slope, A (total each row, then subtract) or B (subtract cell by cell, then total)? (They are exactly equal.)",
          "Which of the two ways is “passing the derivative inside”?",
        ],
      },
      r: null,
      readings: [
        { t: "Folland, Real Analysis, Theorem 2.27 (differentiating under the integral sign, with a dominating function)" },
        { t: "Schuler and van der Laan, Introduction to Modern Causal Inference, section 3.2" },
      ],
    },
    {
      id: "canonical-gradient",
      background:
        "Scores and the influence function of the mean. Vectors, dot products and orthogonal projection.",
      goals: [
        "Represent a three-outcome distribution as a point in a triangle and a score as relative velocity h = v/p with mean zero.",
        "Find one set of numbers that predicts the target's slope along every allowed direction, and center it: a gradient.",
        "Project the gradient onto a restricted tangent space to get the canonical gradient, and connect the variance it removes to efficiency bounds and to covariate adjustment in randomized trials.",
      ],
      figure: {
        name: "Restrict and project",
        anchor: "step-5",
        label: "Tell the model what it already knows",
        ask: [
          "When the middle probability is known, which directions are still allowed?",
          "Watch ϕ drop onto the allowed direction. What happens to E[ϕ²]? Can it go up?",
          "What is the inner product between D* and the discarded piece, and why must it be zero?",
        ],
      },
      r: null,
      readings: [
        {
          t: "Kennedy: Semiparametric theory",
          href: "https://arxiv.org/pdf/1709.06418",
        },
      ],
    },
    {
      id: "one-step-estimator",
      background:
        "Influence functions and the canonical gradient. Regression, propensity scores and inverse probability weighting.",
      goals: [
        "Picture the plug-in as a point on the curve ψ(Pε) between the fit and the truth; the one-step extends the tangent, and what it misses is curvature, the second-order remainder.",
        "Compute the one-step (AIPW) correction as the inverse-propensity-weighted mean of the outcome model's residuals.",
        "Separate bias, spread and interval coverage across four nuisance cases: outcome model right or wrong, propensity model right or wrong.",
      ],
      figure: {
        name: "aipw-anatomy",
        anchor: "one-step-estimator-topic-2",
        label: "The same formula, one patient at a time",
        ask: [
          "Each column is one patient. Which patients carry the thickest residual sticks, and why?",
          "Pause Play after a few patients. Predict the sign and thickness of the next patient's residual stick from their severity and arm.",
          "When every stick has been added, how does the estimate compare with the severity-stratified estimate? (With ĝ equal to the stratum fractions, they are equal.)",
        ],
      },
      r: {
        file: "one-step-ate.R",
        note: "The confounded ATE study (true ATE 2): naive difference, g-computation, IPW and one-step/AIPW with influence-function SE, under a correct and a wrong outcome model.",
      },
      readings: [hines, vdlRubin],
      readingsNote:
        "The lesson itself has no Further reading line. The two readings here are cited by the later targeting lessons (One Move, Two Faces; Four Patients).",
    },
    {
      id: "two-strata",
      background:
        "The one-step estimator. Least squares, and the propensity as a fraction treated.",
      goals: [
        "Explain why half of ψ rests on 5 treated low-severity patients, and why the fit should move in proportion to 1/g, one over the propensity score.",
        "Use the budget plane: payoff is linear in the shift, cost is quadratic times the count, and the best move lies on the ray δlo = 9δhi.",
        "Compute ε̂ = ΣHr / ΣH² and see it equal the one-step correction here; separate a population positivity failure from an empty sample cell.",
      ],
      figure: {
        name: "budget-plane",
        anchor: "two-strata-topic-2",
        label: "The budget plane",
        ask: [
          "You have a fixed likelihood budget. How should you split it between the high-severity and the low-severity curve?",
          "Play grows the budget. Does the tangent point change direction as the ellipse swells?",
          "Why is the ellipse squashed hard in the δhi direction?",
        ],
      },
      r: null,
      readings: [vdlRubin, schulerRose, petersen],
    },
    {
      id: "clever-covariate",
      background:
        "Two strata and the 1/g direction. Maximum likelihood and logistic regression.",
      goals: [
        "Explain why the influence function is centered and why it is the steepest direction for ψ among directions of equal size (Cauchy–Schwarz).",
        "Fit ε along ϕ by maximum likelihood, see the score equation Pₙϕ = 0, and identify H = A/g − (1 − A)/(1 − g) as the clever covariate for the ATE.",
        "Explain why the logistic fluctuation keeps a binary-outcome TMLE inside [0, 1] where a one-step estimate can leave it.",
      ],
      figure: {
        name: "aipw-anatomy",
        anchor: "clever-covariate-topic-3",
        label: "The clever covariate on the course cohort",
        ask: [
          "Each residual stick is drawn as thick as |H|. Which patients' sticks are thickest?",
          "With stratum means as the outcome model the correction is already zero. What ε̂ will TMLE choose? (0: it would not move at all.)",
        ],
      },
      r: {
        file: "tmle-ate.R",
        note: "Binary outcome: a hand-rolled TMLE with a logistic fluctuation along H(A, X), influence-function SE, compared with AIPW from the same initial fits.",
      },
      readings: [
        vdlRubin,
        {
          t: "Gruber and van der Laan (2010), A targeted maximum likelihood estimator of a causal effect on a bounded continuous outcome",
          href: "https://doi.org/10.2202/1557-4679.1260",
        },
        schulerRose,
        tl,
      ],
    },
    {
      id: "one-move-two-faces",
      background:
        "The density tilt from the scores lessons and the regression fluctuation from the clever covariate.",
      goals: [
        "Show that tilting the conditional density of Y by exp(εH(y − m̂₁)) has score H(y − m̂₁) and, for a Gaussian working model, mean m̂₁ + εH.",
        "See Pₙ as a probability measure and the one-step correction as (Pₙ − P̂)ϕ̂, which estimates (P − P̂)ϕ̂ with sampling error of order 1/√n.",
      ],
      figure: {
        name: "Tilt the density of Y",
        anchor: "one-move-two-faces-topic-0",
        label: "Tilt the density, and the regression line moves",
        ask: [
          "With propensities g(low) = 0.1 and g(high) = 0.9, how far does the low-severity mean move compared with the high-severity one? (9 times as far.)",
          "The tilted mean is computed by numerical integration, not by formula. What does its agreement with m̂₁ + εH check?",
        ],
      },
      r: null,
      readings: [
        vdlRubin,
        {
          t: "Fisher and Kennedy (2021), Visually communicating and teaching intuition for influence functions",
          href: "https://doi.org/10.1080/00031305.2020.1717620",
        },
        hines,
      ],
    },
    {
      id: "four-patients",
      background:
        "The clever covariate and the one-step estimator. A calculator.",
      goals: [
        "Compute each patient's influence value for E[Y(1)] (X-piece plus H times the residual) and check that the mean of the Y-pieces is the one-step correction.",
        "Fit ε̂ = ΣHr / ΣH² by hand and form the TMLE.",
        "Compute sd(ϕ̂)/√n and a 95% interval, and say why a normal interval from four patients is not trustworthy.",
      ],
      figure: {
        name: "Your four sticks",
        anchor: "four-patients-topic-0",
        label: "The influence function of E[Y(1)], one patient at a time",
        ask: [
          "Untreated patients have H = 0. What is their stick, whatever their Y?",
          "Before typing, predict the sign of each treated patient's stick from Y − m̂₁(X).",
          "A wrong entry draws a wrong stick. What would a sign error do to the one-step estimate?",
        ],
      },
      r: {
        file: "four-patients.R",
        note: "The four-patient table: plug-in, correction and one-step, sd(D)/√n and a 95% interval, then the TMLE step and the stratum shifts.",
      },
      readings: [
        schulerRose,
        hines,
        {
          t: "van der Laan and Rose (2011), Targeted Learning, chapters 4 and 5",
          href: "https://doi.org/10.1007/978-1-4419-9782-1",
        },
      ],
    },
    {
      id: "efficiency-theory-story",
      background:
        "Every targeting lesson so far. This page puts the pieces in order.",
      goals: [
        "Tell the whole story in order: parameter as a map, asymptotic linearity, pathwise derivative, tangent space, projection, plug-in bias and the one-step, double robustness, and TMLE.",
        "Explain why a plug-in centred on the wrong value loses coverage as n grows, even though it is asymptotically linear.",
        "Read the double-robustness rectangle as a bound on the remainder by the product of the nuisance errors.",
      ],
      figure: {
        name: "galton",
        anchor: "efficiency-theory-story-topic-1",
        label: "Two hundred studies fall through a Galton board",
        ask: [
          "Each ball is one whole study. Before switching from n = 100 to n = 400, predict what happens to the width of the AIPW pile. (It halves.)",
          "The plug-in pile is centred at 2.64, not 2. As n grows from 50 to 800, what happens to the share of its intervals that cover the truth?",
          "Red balls are intervals that missed. About how many red balls do you expect on the AIPW board?",
        ],
      },
      r: null,
      readings: [
        {
          t: "Schuler and van der Laan, Introduction to Modern Causal Inference, chapters 3 and 4 (the geometry follows it)",
        },
        {
          t: "Tsiatis, Semiparametric Theory and Missing Data, chapters 3 and 4 (the projection picture)",
        },
        {
          t: "Kennedy (2022), Semiparametric doubly robust targeted double machine learning: a review",
          href: "https://arxiv.org/abs/2203.06469",
        },
        {
          t: "Chernozhukov et al. (2018), Double/debiased machine learning for treatment and structural parameters, Econometrics Journal 21(1)",
          href: "https://doi.org/10.1111/ectj.12097",
        },
      ],
    },
    {
      id: "inference-lab",
      background:
        "Efficiency Theory, Drawn. Sampling distributions and coverage.",
      goals: [
        "Split the one-step's error into three terms: the average of true influence values, the empirical-process term, and the remainder.",
        "Apply the product-rate condition: a rate sum strictly greater than ½ is sufficient under the other conditions; equality is not enough by itself.",
        "Show how cross-fitting restores honest residuals and coverage for a flexible learner, and list what it does not fix.",
      ],
      figure: {
        name: "Cross-fitting on or off",
        anchor: "step-4",
        label: "Turn cross-fitting off and watch the interval shrink below the truth",
        ask: [
          "With k = 1 nearest neighbour and no cross-fitting, what are the own-arm residuals? What will that do to the IF standard error?",
          "Drag the marker to the coverage you expect without cross-fitting, then run.",
          "Try k = 25. Why does a smoother learner do far less harm when fitted and evaluated on the same patients?",
        ],
      },
      r: {
        file: "crossfit-aipw.R",
        note: "AIPW with 2-fold cross-fitting, natural-spline GLM nuisances, propensity truncation and an influence-function SE.",
      },
      readings: [
        {
          t: "Hines et al.: Demystifying statistical learning based on efficient influence functions",
          href: "https://arxiv.org/html/2107.00681v3",
        },
      ],
    },
    {
      id: "standard-errors",
      background:
        "The inference laboratory. The bootstrap and the sandwich estimator, at least by name.",
      goals: [
        "Say what a standard error estimates (the SD of the estimate over repeated studies) and compute the influence-function SE, sd(ϕ̂)/√n.",
        "Explain why the IF SE can be too large (only the propensity model right) or too small (only the outcome model right) when the nuisances are parametric working models.",
        "Choose a reportable SE (a bootstrap that refits both models, or a stacked sandwich), write it into an analysis plan, and remember that no SE fixes bias.",
      ],
      figure: {
        name: "galton",
        anchor: "step-1",
        label: "A standard error is a guess about other studies",
        ask: [
          "Watch the pile grow. What quantity is every standard error trying to estimate?",
          "The plug-in board: its SE describes its own spread well, yet its intervals miss. Why?",
        ],
      },
      r: null,
      rInline:
        "No script in examples/r. The lesson's last step includes a 26-line base R script (“In base R”) for the only-propensity-right case.",
      readings: [
        {
          t: "Lunceford and Davidian (2004), Stratification and weighting via the propensity score in estimation of causal treatment effects, Statistics in Medicine 23:2937–2960",
          href: "https://doi.org/10.1002/sim.1903",
        },
        {
          t: "Hirano, Imbens and Ridder (2003), Efficient estimation of average treatment effects using the estimated propensity score, Econometrica 71:1161–1189",
          href: "https://doi.org/10.1111/1468-0262.00442",
        },
        {
          t: "Funk et al. (2011), Doubly robust estimation of causal effects, American Journal of Epidemiology 173:761–767",
          href: "https://doi.org/10.1093/aje/kwq439",
        },
        {
          t: "Stefanski and Boos (2002), The calculus of M-estimation, The American Statistician 56:29–38",
          href: "https://doi.org/10.1198/000313002753631330",
        },
        {
          t: "Efron and Tibshirani (1993), An Introduction to the Bootstrap, Chapman & Hall",
          href: "https://doi.org/10.1201/9780429246593",
        },
      ],
    },
    {
      id: "positivity",
      background:
        "Inverse probability weights, the clever covariate, and the two-strata discussion of an empty cell.",
      goals: [
        "Read a mirrored propensity plot and Kish's effective sample size per arm.",
        "Explain how thin overlap inflates the variance of IPW and of AIPW: double robustness is not immunity.",
        "Distinguish capping (same estimand, biased estimator) from trimming and overlap weights (new estimands), and structural from practical violations; write positivity decisions into the analysis plan.",
      ],
      figure: {
        name: "The overlap plot",
        anchor: "step-1",
        label: "Where do the two arms stop overlapping?",
        ask: [
          "As separation β grows, which patients end up carrying the largest weights? (Treated patients with low severity.)",
          "Most patients in the red bands have weights near 1. Who is the danger, and whom must they speak for?",
        ],
      },
      r: null,
      readings: [
        petersen,
        {
          t: "Crump, Hotz, Imbens and Mitnik (2009), Dealing with limited overlap in estimation of average treatment effects, Biometrika 96(1):187–199",
          href: "https://doi.org/10.1093/biomet/asn055",
        },
        {
          t: "Li, Morgan and Zaslavsky (2018), Balancing covariates via propensity score weighting, Journal of the American Statistical Association 113(521):390–400",
          href: "https://doi.org/10.1080/01621459.2016.1260466",
        },
        { t: "ICH E9(R1)", href: ichE9.href },
      ],
    },
    {
      id: "sensitivity",
      background:
        "The κ experiment from the first lesson. Risk ratios and confidence intervals.",
      goals: [
        "Turn an additive bias bound κ into the band ψ̂ ± κ, and a hidden binary confounder into the bias factor B = RR_EU·RR_UD / (RR_EU + RR_UD − 1).",
        "Compute and interpret the E-value for an estimate and for the confidence limit closest to 1.",
        "Benchmark against measured covariates and write a sensitivity paragraph that does not over-read the E-value.",
      ],
      figure: {
        name: "The bias map",
        anchor: "step-2",
        label: "Two strengths make one bias factor",
        ask: [
          "A hidden confounder doubles the chance of treatment and doubles the risk of the event. Can it explain away RR 1.50? (No: B = 4/3 ≈ 1.33.)",
          "Drag the confounder along the red curve. What do all its points have in common?",
          "Why can B never exceed the smaller of the two strengths? (For strengths a, b ≥ 1, B = ab/(a + b − 1) ≤ min(a, b), with equality only when the smaller strength is 1, where B = 1. So each strength on its own must reach the observed RR before the pair can explain it away.)",
        ],
      },
      r: null,
      readings: [
        {
          t: "Ding P, VanderWeele TJ (2016). Sensitivity analysis without assumptions. Epidemiology 27(3):368–377",
          href: "https://doi.org/10.1097/EDE.0000000000000457",
        },
        {
          t: "VanderWeele TJ, Ding P (2017). Sensitivity analysis in observational research: introducing the E-value. Annals of Internal Medicine 167(4):268–274",
          href: "https://doi.org/10.7326/M16-2607",
        },
        {
          t: "Cinelli C, Hazlett C (2020). Making sense of sensitivity: extending omitted variable bias. Journal of the Royal Statistical Society Series B 82(1):39–67",
          href: "https://doi.org/10.1111/rssb.12348",
        },
      ],
    },
    {
      id: "survival-lab",
      background:
        "Kaplan–Meier and Cox as students already use them. Standardization from the first lesson.",
      goals: [
        "Choose a survival target, survival at a horizon or RMST, separately from a conditional hazard ratio.",
        "See Kaplan–Meier as moving mass: at an event mass falls out, at a censoring it passes to everyone still at risk to the right, so each survivor carries 1/Ĝ.",
        "Explain why pooled KM answers a different question from standardized KM, and why a constant conditional hazard ratio does not give a constant marginal one.",
      ],
      figure: {
        name: "redistribute",
        anchor: "fig-redistribute",
        label: "Kaplan–Meier, told as moving mass",
        ask: [
          "When a patient is censored and their mass is handed to the right, what happens to Ŝ(t)? (It does not move.)",
          "Who are the heirs of a dropout, and what does choosing them assume?",
          "At the end, tap a survivor. Where does its weight 1/Ĝ(t−) come from?",
        ],
      },
      r: {
        file: "km-vs-standardized.R",
        note: "Pooled KM in the treated against severity-standardized KM at τ = 5, and RMST by integrating the step function, against the exact truth.",
      },
      readings: [
        {
          t: "Hernán: The hazards of hazard ratios",
          href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3653612/",
        },
        {
          t: "Efron (1967), The two sample problem with censored data",
          href: "https://projecteuclid.org/proceedings/berkeley-symposium-on-mathematical-statistics-and-probability/Proceedings-of-the-Fifth-Berkeley-Symposium-on-Mathematical-Statistics-and/Chapter/The-two-sample-problem-with-censored-data/bsmsp/1200513831",
        },
        sattenDatta,
      ],
    },
    {
      id: "targeted-survival",
      background:
        "The survival laboratory, the one-step estimator and the standard errors lesson.",
      goals: [
        "Weight for treatment and for censoring, 1/(g·G), and state what that needs: censoring independent of the event time given A and X, and G(t− | A, X) > 0 through the horizon.",
        "Read the efficient influence function for S₁(τ) in three coloured parts, and form the one-step estimate with a pointwise influence-function band.",
        "Show double robustness in repeated studies and report ΔRMST with an interval rather than a hazard ratio.",
      ],
      figure: {
        name: "Each patient's influence value",
        anchor: "step-3",
        label: "Every patient's influence value, in three coloured parts",
        ask: [
          "For a treated patient with an early event, which way does the augmentation go? And for each month survived?",
          "Play turns the censoring weight on, from none of it applied to the full 1/G. Which pieces grow?",
          "Switch the event model to one that ignores severity. What happens to every orange piece, and who has to do the work?",
        ],
      },
      r: {
        file: "survival-onestep.R",
        note: "The lesson's monthly world: discrete-time hazard fits, one-step S₁(12), S₀(12), their difference and ΔRMST(12) with influence-function SEs against the exact truth, then iterated TMLE updates for S₁(12).",
      },
      rInline:
        "The lesson page also includes a 31-line base R script for the one-step S₁(τ) with an influence-function SE.",
      readings: [
        {
          t: "Moore and van der Laan (2009), Increasing power in randomized trials with right censored outcomes through covariate adjustment, J Biopharm Stat 19(6)",
          href: "https://doi.org/10.1080/10543400903243017",
        },
        {
          t: "Bai, Tsiatis and O’Brien (2013), Doubly-robust estimators of treatment-specific survival distributions in observational studies with stratified sampling, Biometrics 69(4)",
          href: "https://doi.org/10.1111/biom.12076",
        },
        {
          t: "Benkeser, Carone and Gilbert (2018), Improved estimation of the cumulative incidence of rare outcomes, Stat Med 37(2)",
          href: "https://doi.org/10.1002/sim.7337",
        },
        {
          t: "Stitelman and van der Laan (2010), Collaborative targeted maximum likelihood for time to event data, Int J Biostat 6(1)",
          href: "https://doi.org/10.2202/1557-4679.1249",
        },
        sattenDatta,
        {
          t: "Royston and Parmar (2013), Restricted mean survival time: an alternative to the hazard ratio, BMC Med Res Methodol 13:152",
          href: "https://doi.org/10.1186/1471-2288-13-152",
        },
      ],
    },
    {
      id: "capstone",
      background:
        "The whole route. In particular Design the target trial, Positivity and weights, the one-step estimator, Standard errors you can report and the sensitivity lesson.",
      goals: [
        "Carry one registry question through every stage: a five-attribute estimand under treatment policy, a target trial protocol with time zero at eligibility, and a positivity check with a trigger fixed before outcomes are seen.",
        "Fit the nuisance models with a cross-validated Super Learner and cross-fitting, and report AIPW and TMLE with influence-function intervals for the risk difference, the risk ratio and the gain in event-free months.",
        "Quantify sensitivity to unmeasured confounding with E-values and a measured benchmark, and write the report paragraph a heart team can read.",
      ],
      figure: {
        name: "Unadjusted, plug-in, AIPW and TMLE against the truth",
        anchor: "cap-forest",
        label: "The estimate, with an honest interval",
        ask: [
          "Unadjusted, the device looks harmful by 4.1 points. After adjusting for the five covariates, what will happen to the difference?",
          "AIPW and TMLE give −5.41 and −5.40 points and the truth is −7.3. Do their intervals cover it, and does one registry's interval need to be centred on the truth?",
          "The one-step correction is only 0.30 points. What does that say about the cross-fitted plug-in, and why still add it?",
        ],
      },
      r: {
        file: "capstone.R",
        note: "The main estimate in base R: a three-learner Super Learner, 5-fold cross-fitting, AIPW for the 1-year risk difference with an influence-function SE, the risk ratio and its E-value. It draws its own registry with R's random numbers, so its numbers differ from the page by sampling noise.",
      },
      readings: [
        {
          t: "Hernán and Robins (2016), Using big data to emulate a target trial when a randomized trial is not available, Am J Epidemiol 183(8):758–764",
          href: "https://doi.org/10.1093/aje/kwv254",
        },
        {
          t: "Cashin et al. (2025), the TARGET guideline for reporting target trial emulations, JAMA",
          href: "https://jamanetwork.com/journals/jama/fullarticle/2837724",
        },
        {
          t: "van der Laan, Polley and Hubbard (2007), Super Learner, Statistical Applications in Genetics and Molecular Biology 6(1)",
          href: "https://doi.org/10.2202/1544-6115.1309",
        },
        {
          t: "Chernozhukov et al. (2018), Double/debiased machine learning for treatment and structural parameters, Econometrics Journal 21(1)",
          href: "https://doi.org/10.1111/ectj.12097",
        },
        petersen,
        {
          t: "VanderWeele and Ding (2017), Sensitivity analysis in observational research: introducing the E-value, Ann Intern Med 167(4):268–274",
          href: "https://doi.org/10.7326/M16-2607",
        },
        {
          t: "FDA (2025), Use of Real-World Evidence to Support Regulatory Decision-Making for Medical Devices (final guidance)",
          href: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/use-real-world-evidence-support-regulatory-decision-making-medical-devices",
        },
        ichE9,
      ],
    },
  ];

  const elective = {
    units: ["interference-lab", "experiment-design-lab", "marketplace-decision-lab"],
    intro:
      "Three laboratories on experiments where one unit's treatment changes another's outcome. They branch off after the inference laboratory; survival is not a prerequisite. They sit outside the river and the progress count.",
    uses: [
      "Eight connected people and exact enumeration of every assignment: direct, spillover and full-policy effects are three different questions.",
      "A two-zone shared fleet: request-level randomization against randomized switchbacks, compared with the full-policy reference.",
      "Repeated experiments, a validated switchback benchmark and a one-page recommendation.",
    ],
    suggestion:
      "Use it as a one-week extension for students from technology or platform settings, or as a capstone: examples/marketplace/ holds a Python and SQL version of the analysis.",
    readings: [
      {
        t: "Aronow & Samii: Estimating average causal effects under general interference",
        href: "https://arxiv.org/abs/1305.6156",
      },
      {
        t: "Hudgens & Halloran: Toward causal inference with interference",
        href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2600548/",
      },
      {
        t: "Bojinov, Simchi-Levi and Zhao: Design and analysis of switchback experiments",
        href: "https://arxiv.org/abs/2009.00148",
      },
    ],
  };

  const schedules = [
    {
      id: "three-weeks",
      title: "Three weeks to causally competent",
      pace: "Three sessions a week. Students complete about an hour of lessons before each session.",
      sessions: [
        { week: 1, theme: "What are we asking?", units: ["causal-roadmap", "intercurrent-events"] },
        { week: 1, theme: "Design before data", units: ["target-trial", "clone-censor-weight"] },
        { week: 1, theme: "The payoff, then the first picture", units: ["rct-adjustment", "scores-from-scratch"] },
        { week: 2, theme: "The mean's influence function, slowly", units: ["mean-along-a-path", "under-the-integral", "canonical-gradient"] },
        { week: 2, theme: "One step, then target", units: ["one-step-estimator", "two-strata", "clever-covariate"] },
        { week: 2, theme: "By hand, then the whole story", units: ["one-move-two-faces", "four-patients", "efficiency-theory-story"] },
        { week: 3, theme: "When is an interval earned?", units: ["inference-lab", "standard-errors"] },
        { week: 3, theme: "Overlap and hidden confounding", units: ["positivity", "sensitivity"] },
        { week: 3, theme: "Back to survival, then end to end", units: ["survival-lab", "targeted-survival", "capstone"] },
      ],
    },
    {
      id: "six-weeks",
      title: "Six weeks, one unit at a time",
      pace: "Two sessions a week, with more room for the activities and the elective as an optional seventh week.",
      sessions: [
        { week: 1, theme: "The question", units: ["causal-roadmap"] },
        { week: 1, theme: "Intercurrent events", units: ["intercurrent-events"] },
        { week: 2, theme: "Time zero", units: ["target-trial", "clone-censor-weight"] },
        { week: 2, theme: "Your trial, adjusted", units: ["rct-adjustment"] },
        { week: 3, theme: "Scores and influence", units: ["scores-from-scratch"] },
        { week: 3, theme: "The mean, then the canonical gradient", units: ["mean-along-a-path", "under-the-integral", "canonical-gradient"] },
        { week: 4, theme: "One step and the 1/g budget", units: ["one-step-estimator", "two-strata"] },
        { week: 4, theme: "Targeting by hand", units: ["clever-covariate", "one-move-two-faces", "four-patients"] },
        { week: 5, theme: "The story and its promises", units: ["efficiency-theory-story", "inference-lab"] },
        { week: 5, theme: "Standard errors you can report", units: ["standard-errors"] },
        { week: 6, theme: "Overlap and sensitivity", units: ["positivity", "sensitivity"] },
        { week: 6, theme: "Survival, targeted", units: ["survival-lab", "targeted-survival"] },
        { week: 6, theme: "An emulated trial, end to end", units: ["capstone"] },
      ],
    },
  ];

  /* Teaching material for each core lesson, merged into `lessons` below.
   * discuss: three questions that go beyond the lesson's own predictions (a new setting, a trial
   *   statistician's situation, a reviewer's question), each with a short model answer.
   * activity: one in-class activity of 10 to 20 minutes, with materials, steps, what to collect and
   *   what good work looks like.
   * misconceptions: ideas students often bring, where the lesson addresses each (`where` names the
   *   lesson step as it appears on the page) and, when one exists, a published source. They come
   *   from teaching experience and the literature, not from measured data on this course.
   * outline: a slide-free lecture, 5 to 7 moves through the lesson's own figures.
   * Numbers quoted here are the lessons' default displays or exact consequences of the formulas the
   * lessons state; activity outcomes marked "in our run" come from running examples/r as shipped. */
  const src = {
    whatIf: {
      t: "Hernán and Robins (2020), Causal Inference: What If, chapters 3 and 7",
      href: "https://miguelhernan.org/whatifbook",
    },
    ichE9: { t: "ICH E9(R1) addendum (2019), section A.3", href: ichE9.href },
    frangakis: {
      t: "Frangakis and Rubin (2002), Principal stratification in causal inference, Biometrics 58(1):21–29",
      href: "https://doi.org/10.1111/j.0006-341X.2002.00021.x",
    },
    suissa: {
      t: "Suissa (2008), Immortal time bias in pharmacoepidemiology, Am J Epidemiol 167(4):492–499",
      href: "https://doi.org/10.1093/aje/kwm324",
    },
    hernanJCE: {
      t: "Hernán, Sauer, Hernández-Díaz, Platt and Shrier (2016), Specifying a target trial prevents immortal time bias and other self-inflicted injuries, J Clin Epidemiol 79:70–75",
      href: "https://doi.org/10.1016/j.jclinepi.2016.04.014",
    },
    hernanBMJ: {
      t: "Hernán (2018), How to estimate the effect of treatment duration on survival outcomes using observational data, BMJ 360:k182",
      href: "https://doi.org/10.1136/bmj.k182",
    },
    tsiatis2008: {
      t: "Tsiatis, Davidian, Zhang and Lu (2008), Covariate adjustment for two-sample treatment comparisons in randomized clinical trials, Stat Med 27(23):4658–4677",
      href: "https://doi.org/10.1002/sim.3113",
    },
    greenland: {
      t: "Greenland, Robins and Pearl (1999), Confounding and collapsibility in causal inference, Statistical Science 14(1):29–46",
      href: "https://doi.org/10.1214/ss/1009211805",
    },
    hines,
    fisherKennedy: {
      t: "Fisher and Kennedy (2021), Visually communicating and teaching intuition for influence functions, Am Stat 75(2):162–172",
      href: "https://doi.org/10.1080/00031305.2020.1717620",
    },
    tsiatisBook: { t: "Tsiatis (2006), Semiparametric Theory and Missing Data, chapters 3 and 4" },
    kennedy: { t: "Kennedy (2016), Semiparametric theory and empirical processes in causal inference", href: "https://arxiv.org/abs/1510.04740" },
    chernozhukov: {
      t: "Chernozhukov et al. (2018), Double/debiased machine learning for treatment and structural parameters, Econometrics Journal 21(1):C1–C68",
      href: "https://doi.org/10.1111/ectj.12097",
    },
    zivich: {
      t: "Zivich and Breskin (2021), Machine learning for causal inference: on the use of cross-fit estimators, Epidemiology 32(3):393–401",
      href: "https://doi.org/10.1097/EDE.0000000000001332",
    },
    gruber: {
      t: "Gruber and van der Laan (2010), A targeted maximum likelihood estimator of a causal effect on a bounded continuous outcome, Int J Biostat 6(1)",
      href: "https://doi.org/10.2202/1557-4679.1260",
    },
    vdlRubin,
    lunceford: {
      t: "Lunceford and Davidian (2004), Stratification and weighting via the propensity score, Stat Med 23:2937–2960",
      href: "https://doi.org/10.1002/sim.1903",
    },
    petersen,
    crump: {
      t: "Crump, Hotz, Imbens and Mitnik (2009), Dealing with limited overlap, Biometrika 96(1):187–199",
      href: "https://doi.org/10.1093/biomet/asn055",
    },
    vdwDing: {
      t: "VanderWeele and Ding (2017), Sensitivity analysis in observational research: introducing the E-value, Ann Intern Med 167(4):268–274",
      href: "https://doi.org/10.7326/M16-2607",
    },
    dingVdw: {
      t: "Ding and VanderWeele (2016), Sensitivity analysis without assumptions, Epidemiology 27(3):368–377",
      href: "https://doi.org/10.1097/EDE.0000000000000457",
    },
    sattenDatta,
    hernanHR: {
      t: "Hernán (2010), The hazards of hazard ratios, Epidemiology 21(1):13–15",
      href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3653612/",
    },
    bai: {
      t: "Bai, Tsiatis and O’Brien (2013), Doubly-robust estimators of treatment-specific survival distributions, Biometrics 69(4)",
      href: "https://doi.org/10.1111/biom.12076",
    },
  };

  const teach = {
    "causal-roadmap": {
      discuss: [
        {
          q: "A clinical lead asks you “does the device work?” and the protocol already names the randomized population. Which choices from this lesson are still open, and which attribute does ICH E9(R1) add that this lesson leaves out?",
          a: "Still open: the outcome and its horizon (survival at a date or RMST up to a date), the summary measure (risk difference or risk ratio) and, in an observational comparison, whose effect (everyone, or the treated). E9(R1) adds the handling of intercurrent events such as death, crossover and device removal, which the next lesson fills in.",
        },
        {
          q: "A health system wants to know whether a follow-up phone call after discharge reduces 30-day readmission. Calls went mostly to patients the system flagged as high risk. What plays the role of severity here, and what would the naive called-minus-not-called comparison probably show?",
          a: "The risk flag (and whatever drove it) is the confounder: flagged patients are both more likely to be called and more likely to be readmitted. The naive comparison mixes a sicker called group with a healthier uncalled group, so it will tend to make the calls look harmful or less helpful than they are. Comparing within risk levels needs both called and uncalled patients at every level (positivity) and no other common cause left out (exchangeability).",
        },
        {
          q: "A reviewer writes: “You adjusted for every covariate in the registry, so confounding is addressed.” Using the κ experiment, what is the honest reply?",
          a: "Adjustment identifies the effect only if treatment is as good as random within levels of the measured covariates, and the data cannot check that. The κ step shows two worlds with exactly the same observed patients whose effects differ by κ. The honest reply states the exchangeability assumption, justifies the covariate set with subject knowledge, and quantifies how strong a missing confounder would have to be (the sensitivity lesson).",
        },
      ],
      activity: {
        title: "The estimand interview",
        format: "Role-play",
        minutes: 15,
        groups: "Pairs",
        materials: [
          "One index card per pair with a vague clinical question, for example “Does the new valve work?”, “Is the drug safe in older adults?”, “Does early discharge help?”.",
          "The lesson's “Roadmap” step projected.",
        ],
        steps: [
          "Partner A plays the clinical lead and holds the card. A answers only what is asked, in clinical words.",
          "Partner B, the statistician, has 6 minutes to write the estimand in one sentence: population, the two interventions, outcome, horizon and summary measure.",
          "B adds one identification assumption in plain words and names the variable most likely to confound the comparison.",
          "Swap roles with a new card and repeat.",
        ],
        collect: "Both estimand sentences from each pair, with the named assumption.",
        good: "Every attribute is explicit (a date for the horizon, a scale for the outcome); the choice between an absolute and a relative measure comes with a reason; the assumption is stated as a claim about people (“within frailty level, who got the device is as good as random”), not as a method name.",
      },
      misconceptions: [
        {
          myth: "A better estimator, or more data, can repair unmeasured confounding.",
          fix: "Two worlds share every observed outcome yet their average effects differ by κ. Only assumptions or a different design can choose between them.",
          where: "Break an assumption",
          source: src.whatIf,
        },
        {
          myth: "Risk ratio and risk difference tell the same story, so the choice is cosmetic.",
          fix: "Risks of 20% → 10% and 2% → 1% share a risk ratio of 0.5, but one prevents 10 events per 100 people and the other 1.",
          where: "Absolute or relative?",
        },
      ],
      outline: [
        { at: "Whose effect? (cohort figure)", show: "the 35 orange, high-severity patients in the waiting room", ask: "If we compare only treated with untreated, whose outcomes end up on each side?" },
        { at: "Whose effect? (weights readout)", show: "65% × 1.86 + 35% × 2.26 = 2, then switch the population", ask: "No individual benefit changed. Why did the average move?" },
        { at: "Absolute or relative?", show: "the two grids, 27% against 13.5%", ask: "Which number goes in a patient leaflet, and which in a regulatory summary?" },
        { at: "A gap or an area?", show: "the vertical gap (+11.9 points at 5 years) and the shaded area (+0.398 years)", ask: "Which one does a surgeon deciding for a 70-year-old need?" },
        { at: "Identify", show: "the back-door path A ← X → Y and the 0.64 gap between naive and adjusted", ask: "What has to be true for the adjusted number to be causal?" },
        { at: "Break an assumption", show: "untick exchangeability and slide κ: only hollow cells move", ask: "What does that say about what observed data can decide?" },
        { at: "Roadmap", show: "the six stages", ask: "Which stage is still unfinished after this lesson?" },
      ],
    },

    "intercurrent-events": {
      discuss: [
        {
          q: "A heart-failure device trial measures quality of life at 6 months, and some control patients receive the device off-protocol before then. The sponsor wants “the effect of the device if nobody had crossed over”. Which strategy is that, and what must the analysis plan add?",
          a: "The hypothetical strategy. The plan must say how the unobserved post-crossover scores are handled (for example multiple imputation or inverse probability weighting), state the assumption that makes this valid (crossover depends only on measured history) and prespecify sensitivity analyses that vary it. Many teams keep treatment policy as the primary estimand, since randomization identifies it, and report the hypothetical one as supplementary.",
        },
        {
          q: "In an oncology trial some patients start a new anticancer therapy before progression. For overall survival, analysts often censor at the start of new therapy. Which strategy does that implement, and why is its assumption doubtful here?",
          a: "A hypothetical strategy: survival had nobody started new therapy. It assumes those who switched resembled those who did not, given measured data. Patients usually switch because they are doing badly, so censoring removes sicker patients and makes the remaining curve look better, the same mechanism as the 82.8% against 79.8% in the lesson.",
        },
        {
          q: "A reviewer asks about a principal-stratum estimand: “Your target is patients who would survive 12 months on either arm. How would you know who they are?”",
          a: "You cannot observe it, because membership depends on outcomes under both arms and each patient shows one. Estimation needs assumptions such as monotonicity (the device never causes a death that would not otherwise happen) and a model linking membership to baseline data, and the results should come with bounds or sensitivity analyses. Naming those assumptions is the answer.",
        },
      ],
      activity: {
        title: "What does this SAP paragraph estimate?",
        format: "Critique a mock SAP paragraph",
        minutes: 15,
        groups: "Groups of three",
        materials: [
          "Printed mock paragraph: “Primary analysis (ITT). All randomized patients will be analysed in the arm to which they were randomized. Patients who cross over to the device will be censored at the date of crossover. Patients who die before month 12 will be excluded from the analysis of the 12-month symptom score. Missing scores will be imputed by last observation carried forward.”",
          "The lesson's “Write the estimand” step on one device per group.",
        ],
        steps: [
          "Alone for 2 minutes: underline every phrase that decides what happens after an intercurrent event.",
          "As a group, name the ICH E9(R1) strategy each phrase implements.",
          "Decide whether the paragraph describes one estimand or several mixed together.",
          "Rewrite it as one five-attribute estimand sentence, choosing a strategy for each event and naming the assumption each needs.",
        ],
        collect: "The rewritten paragraph and the list of strategies found.",
        good: "The group sees that the “ITT” label clashes with censoring at crossover (a hypothetical strategy); that excluding deaths compares survivors, a post-randomization subgroup, without the assumptions a principal-stratum or while-alive estimand would need; and that last observation carried forward is an unstated hypothetical assumption. The rewrite chooses one strategy per event on purpose.",
      },
      misconceptions: [
        {
          myth: "Censoring at crossover is neutral bookkeeping.",
          fix: "It picks the hypothetical strategy. High-risk patients cross over six times as often, so the censored curve reads 82.8% against a hypothetical 79.8% and a treatment-policy 81.3%.",
          where: "Censoring chooses",
          source: src.ichE9,
        },
        {
          myth: "Patients who stayed event-free in each arm form the principal stratum.",
          fix: "Membership is defined by outcomes under both arms. Event-free on the device and event-free on medical therapy are different groups of people.",
          where: "What needs an assumption",
          source: src.frangakis,
        },
      ],
      outline: [
        { at: "After randomization", show: "the twelve lanes and one lane changing colour at crossover", ask: "What does this patient's 12-month score now measure?" },
        { at: "After randomization", show: "the patient who dies at month 8", ask: "Does their 12-month score exist?" },
        { at: "Five strategies", show: "switch through the strategies and watch ringed, grey and red “?” values", ask: "Which strategies use only values somebody actually observed?" },
        { at: "What needs an assumption", show: "truth, randomized comparison and naive analysis for the hypothetical strategy", ask: "Why does dropping patients after rescue go wrong here?" },
        { at: "Censoring chooses", show: "the three curves, 82.8%, 79.8% and 81.3%", ask: "Which curve does an analyst who “censors at crossover” think they are reporting?" },
        { at: "Write the estimand", show: "build the sentence live and trigger one of the checks", ask: "Which combination of choices does not fit together, and why?" },
      ],
    },

    "target-trial": {
      discuss: [
        {
          q: "Your team wants an external control arm from a registry for a single-arm device study that enrols patients at the heart-team decision. Which registry date should be time zero for controls, and what goes wrong if you use the date of diagnosis?",
          a: "The date a control patient met the same eligibility criteria at a comparable decision point (for example a heart-team evaluation). Starting controls at diagnosis gives them follow-up during which trial patients, who had to survive to enrolment, could not have been counted; early deaths then fall on the control side and the device looks better. Eligibility is also assessed at different times in the two groups.",
        },
        {
          q: "A pharmacoepidemiology study calls anyone with a statin prescription in the year after a heart attack a “user” and starts everyone's follow-up at the heart attack. Name the problem and the target-trial fix.",
          a: "Immortal time: users had to survive until their first prescription, and that time is credited to them. The fix sets time zero at eligibility (say discharge), with strategies such as “start within 30 days” against “do not start”; the grace period is handled by cloning, censoring and weighting, which is the next lesson.",
        },
        {
          q: "An FDA reviewer notices your target trial table was finalised before the outcome analysis and asks why that matters.",
          a: "Fixing eligibility, time zero, strategies, estimand and analysis before seeing outcomes stops those choices from being tuned to the result. FDA's device RWE guidance asks whether data are fit for the specific question, and the TARGET guideline asks authors to report the protocol and how each component was emulated. A dated protocol is evidence that the analysis answers a prespecified question.",
        },
      ],
      activity: {
        title: "Draw three clocks",
        format: "Whiteboard timelines",
        minutes: 15,
        groups: "Groups of three or four",
        materials: [
          "Whiteboard or flip chart and three colours of marker.",
          "Three designs on a card: (a) patients with a new diagnosis of severe valve disease are followed from diagnosis, and anyone implanted in the next year is “treated”; (b) only treated patients with a 30-day echo are included, followed from the procedure; (c) a registry opened in 2020 includes everyone implanted since 2015 who was alive in 2020, followed from registry entry.",
        ],
        steps: [
          "For each design, draw one treated and one untreated patient on a timeline and mark eligibility, assignment (when the strategy is known) and the start of follow-up.",
          "Shade every stretch in which a treated patient cannot die and still be counted as treated.",
          "Name each misalignment with the lesson's words.",
          "Redraw each design with the three moments lined up. Mark where a grace period appears.",
        ],
        collect: "A photo of the redrawn timelines.",
        good: "Design (a) is immortal time, (b) is eligibility from the future, (c) is prevalent users; every shaded stretch sits in the treated group; the redrawn versions put eligibility, assignment and follow-up at one moment; and the group notices that (a) now needs a grace period, which is exactly the problem clone, censor, weight solves.",
      },
      misconceptions: [
        {
          myth: "Immortal time bias is a small-sample artefact.",
          fix: "With 2,000 simulated patients the misaligned analysis still reports a one-year risk difference of −14.3 percentage points against a true 0. A new seed changes the noise, not the bias.",
          where: "Compare with the truth",
          source: src.suissa,
        },
        {
          myth: "Starting every clock at eligibility solves the problem completely.",
          fix: "With a grace period, patients who die untreated inside the window fit both strategies. Forcing them into one arm still gives −7.4 percentage points against a truth of 0.",
          where: "Fix it, find the gap",
          source: src.hernanJCE,
        },
      ],
      outline: [
        { at: "Write the protocol", show: "the row for time zero flagged as misaligned", ask: "In a randomized trial, which three things happen at randomization?" },
        { at: "Move time zero, choice (b)", show: "the hatched immortal time and the rate ratio of 0.24", ask: "How does a device that does nothing earn a rate ratio of 0.24?" },
        { at: "Move time zero, choice (c)", show: "where the hatched person-time goes now", ask: "Is this better or just a different wrong?" },
        { at: "Compare with the truth", show: "the class sketch first, then the Kaplan–Meier curves against the single green truth", ask: "What does changing the seed change, and what does it not?" },
        { at: "Other misalignments", show: "observed 27.5% against true 29.5% for the 30-day echo rule", ask: "Why is requiring a future measurement a selection?" },
        { at: "Fix it, find the gap", show: "the patients still compatible with both strategies at time zero", ask: "Where should a grace-period death count? (Forced to one arm: −7.4 points.)" },
      ],
    },

    "clone-censor-weight": {
      discuss: [
        {
          q: "An analyst suggests handling grace-period deaths by assigning each one at random to one arm with probability ½. Why is cloning better?",
          a: "A patient who dies while waiting followed both strategies up to death, so under either strategy that death would have happened. Cloning counts it in both arms, which is what each strategy's risk should include. Random allocation puts only about half of these deaths in each arm, so both arms' early risks come out too low.",
        },
        {
          q: "An EHR study compares “start dialysis within 3 months of eGFR falling below 15” with “defer until symptoms”. Describe clone, censor and weight for it.",
          a: "At eligibility (eGFR below 15) copy each patient into both strategies. Censor the early-start clone at 3 months if dialysis has not started, and the deferral clone when dialysis starts before symptoms. Weight each uncensored clone by one over its modelled probability of remaining uncensored, from a model of the start decision given time-varying labs, symptoms and comorbidity. Report risk and RMST at a landmark, and bootstrap patients.",
        },
        {
          q: "A reviewer asks for the hazard ratio from the weighted clones. What do you report instead, and why?",
          a: "Risk at a landmark and RMST (in the lesson, −0.185 in 24-month risk and 1.83 months of life gained). The hazards are not proportional: the month after the procedure carries operative risk and the benefit comes later, so a single hazard ratio averages over that shape with weights nobody chose and has no clean causal reading.",
        },
      ],
      activity: {
        title: "Defend the weighted curves",
        format: "Role-play a reviewer and a sponsor",
        minutes: 20,
        groups: "Groups of four: two sponsor statisticians, two reviewers",
        materials: [
          "The lesson's “Read the contrast” step projected: weighted curves, −0.185 in risk, 1.83 months, the 200-registry table.",
          "A blank question sheet for reviewers with columns “question”, “answer”, “satisfied?”.",
        ],
        steps: [
          "Sponsors prepare a one-minute summary of the result and its assumptions (3 minutes).",
          "Reviewers, at the same time, write four questions: at least one on the decision model, one on positivity, one on the grace-period rule and one on the interval.",
          "Exchange for 8 minutes. Sponsors may answer only with what the lesson supports; reviewers mark each answer.",
          "Last 3 minutes: both sides agree on one thing that would change the conclusion.",
        ],
        collect: "The reviewers' marked question sheets.",
        good: "Sponsors say the weights assume the decision depends only on measured frailty and month, that every kind of patient had some chance of each timing, and that the interval comes from resampling patients and refitting the decision model. Reviewers ask what an unmeasured driver of surgery timing would do (the weighted curves would miss, as when frailty is left out of the model) and why no hazard ratio is reported.",
      },
      misconceptions: [
        {
          myth: "Kaplan–Meier handles censoring, so the clone curves need no weights.",
          fix: "Artificial censoring is caused by treatment decisions that follow prognosis. Unweighted, the risk difference is −0.372 against a truth of −0.159.",
          where: "Biased curves",
          source: src.hernanBMJ,
        },
        {
          myth: "One weighted analysis that lands near the truth shows the method works.",
          fix: "One registry cannot tell. The lesson repeats the whole study on 200 registries: the weighted average sits within two Monte Carlo standard errors of the truth, and weighting pays for it with a larger SD.",
          where: "Read the contrast",
        },
      ],
      outline: [
        { at: "One patient", show: "Mr. Ortiz and his two copies at month 0", ask: "On day one, which plan is he on?" },
        { at: "One patient", show: "the life in which he dies in his first month waiting", ask: "Why does that death count in both copies?" },
        { at: "One patient", show: "100 patients like him, 60 still unoperated after month 2", ask: "Each survivor's copy counts as 100/60 ≈ 1.67 people. Whom is Mr. Lee standing in for?" },
        { at: "Censor", show: "the ✂ marks at the end of the grace window", ask: "Are the clones cut here frailer or more robust than average?" },
        { at: "Biased curves", show: "unweighted −0.372 against the truth −0.159; then the slider at 0", ask: "Which assumption of Kaplan–Meier did artificial censoring break?" },
        { at: "Weight", show: "the fitted decision model and the purple weighted curves", ask: "Where do the curves land if frailty is left out of the decision model?" },
        { at: "Read the contrast", show: "risk −0.185 and 1.83 months of life", ask: "Why does the lesson refuse to report a hazard ratio?" },
      ],
    },

    "rct-adjustment": {
      discuss: [
        {
          q: "Your analysis plan for a 120-patient trial adjusts for baseline walk distance and eleven other covariates. What do the FDA guidance and this lesson suggest?",
          a: "Prespecify a few strongly prognostic covariates, few relative to the sample size (the baseline value of the outcome first), and use a standard error that stays valid under misspecification. Twelve covariates in 120 patients spend degrees of freedom and add finite-sample bias of order 1/n; a prespecified prognostic score, as in the PROCOVA step, is another way to summarize many variables in one.",
        },
        {
          q: "A vaccine trial reports an age-adjusted odds ratio from logistic regression. A reader compares it with an unadjusted odds ratio from another trial of the same vaccine. Both trials are perfectly randomized and the vaccine acts identically. Why might the numbers still differ?",
          a: "Non-collapsibility. The adjusted coefficient estimates a conditional odds ratio, which is farther from 1 than the marginal one whenever age predicts infection, even with no confounding (3.0 against 2.18 in the lesson). To compare like with like, standardize the logistic model to the marginal odds ratio, or report risk differences or risk ratios.",
        },
        {
          q: "A reviewer asks: “Your outcome model is surely misspecified. Why should we trust the adjusted estimate?”",
          a: "Because the propensity is known by design. With an intercept in each arm's model, standardization equals AIPW with that known propensity, so it stays centred on the marginal effect whatever the outcome model (mean 14.8 m against 15 m with a straight line fitted to a curve). A wrong model costs precision, not validity. The interval needs a robust standard error: with 1:3 allocation and effects that vary with baseline, the ANCOVA model-based interval covered only 88.2%.",
        },
      ],
      activity: {
        title: "Predict the precision gain, then check it",
        format: "R exercise",
        minutes: 20,
        groups: "Pairs with one laptop",
        materials: [
          "examples/r/rct-adjustment.R and R (base R only).",
          "A three-row table on paper: coefficient b, predicted width ratio, observed width ratio.",
        ],
        steps: [
          "Run the script. Note the CI width ratio (adjusted over unadjusted) and the equivalent sample-size gain.",
          "Before editing: the outcome is Y = 1 + A + b·X + noise with noise SD 1.2 and b = 1, so within an arm R² = b²/(b² + 1.44). Predict the width ratio √(1 − R²) for b = 0.5, 1 and 2.",
          "Change the coefficient of X in the line that generates Y to 0.5, then to 2, rerun and fill in the table.",
          "Compare the “standardized” row across the three runs and explain what you see.",
          "Stretch: replace lm(Y ~ A * X) by a wrong model, lm(Y ~ A * I(X^2)), and predict both the estimate and the width ratio before running it.",
        ],
        collect: "The filled table and one sentence on step 4.",
        good: "Predictions of about 0.92, 0.77 and 0.51 against observed ratios close to them (0.91, 0.76 and 0.51 in our run; one trial carries sampling noise). The pair notices that the standardized estimate and SE do not change with b at all: the model removes b·X exactly, so with the same seed the residuals are identical and the whole gain comes from the unadjusted analysis getting noisier. In the stretch the wrong model buys nothing but breaks nothing: X² is unrelated to a linear effect of a symmetric X, so the width ratio returns to about 1 and the estimate sits next to the unadjusted one (1.00 and 0.867 against 0.865 in our run).",
      },
      misconceptions: [
        {
          myth: "Adjusting with a wrong model biases the treatment effect.",
          fix: "In a randomized trial standardization is AIPW with the known propensity, so a wrong model costs precision, not validity: the curved-truth estimates average 14.8 m against a true 15 m.",
          where: "A wrong model stays centered",
          source: src.tsiatis2008,
        },
        {
          myth: "The adjusted odds ratio estimates the same thing as the unadjusted one, only more precisely.",
          fix: "The logistic coefficient targets a conditional odds ratio (3.0 in each stratum) while the whole population's is 2.18. Standardizing the same model recovers the marginal target.",
          where: "Binary outcomes: which odds ratio?",
          source: src.greenland,
        },
      ],
      outline: [
        { at: "One trial is noisy", show: "Play the repeated trials; each interval reaches about 17 m either side", ask: "The effect is 15 m. What share of these trials will fail to show it?" },
        { at: "Adjust for a prognostic covariate", show: "the two arm fits and the chance imbalance (0.06 against −0.19 SD)", ask: "What does standardization do with that imbalance?" },
        { at: "Adjust for a prognostic covariate", show: "the two histograms, SD 6.0 m against 8.4 m", ask: "Derive n·R²/(1 − R²) from “adjustment divides the variance by 1 − R²”." },
        { at: "A wrong model stays centered", show: "the curved truth and the straight fit; mean 14.8 m", ask: "Why does a wrong line not bias a randomized comparison?" },
        { at: "Binary outcomes: which odds ratio?", show: "the stratum odds ratios (3.0) and the population one (2.18)", ask: "Which one did your last analysis plan promise?" },
        { at: "Standard errors that survive", show: "1:3 allocation: ANCOVA 88.2% coverage against 94.1%", ask: "What does 1:1 allocation protect, and what should you report?" },
        { at: "One score from history", show: "680 against 401 equivalent patients", ask: "What does a poor prognostic score cost you?" },
      ],
    },

    "scores-from-scratch": {
      discuss: [
        {
          q: "A colleague says “influence” means the high-leverage points in a regression. How is the lesson's influence function related to that idea, and how is it different?",
          a: "Both measure how much one observation moves something. Regression diagnostics such as DFBETA measure how much a fitted coefficient changes when one point is deleted from one sample. The influence function here belongs to the parameter at a distribution: the rate at which ψ moves when a little probability is added at z. For the mean it is z − ψ, and a regular estimator of ψ has it as its own influence function.",
        },
        {
          q: "Use the point-mass argument to find the influence function of ψ = P(Z ≤ t), one point on a distribution function.",
          a: "ψ is the mean of the function 1{Z ≤ t}, so ϕ(z) = 1{z ≤ t} − F(t). Adding mass at a z below t raises ψ by ε(1 − F(t)); adding it above t lowers ψ by εF(t). Averaging these values over a sample gives the familiar error of the empirical distribution function.",
        },
        {
          q: "In a registry where the frailest patients are rarely treated, why should a reviewer care about the second part of the ATE's influence function?",
          a: "That part divides each patient's residual by the probability of the arm they were in. Where an arm is rare, a single patient's residual is multiplied by a large weight, so one patient can move the estimate and the variance grows. The reviewer should ask for overlap diagnostics and effective sample sizes (the positivity lesson).",
        },
      ],
      activity: {
        title: "The human seesaw",
        format: "Hands-on measurement",
        minutes: 15,
        groups: "Two groups of 8 to 10",
        materials: [
          "Masking tape on the floor marked from −5 to +5, or a line on the board with sticky notes.",
          "A phone calculator and one sheet of graph paper per group.",
        ],
        steps: [
          "Place 8 people (or notes) at invented outcome values. Compute the mean ψ and mark it.",
          "Add one more person at ψ + 3. Recompute the mean and record how far it moved.",
          "Repeat with the extra person at ψ − 2, ψ + 6 and exactly at ψ.",
          "Multiply each move by the new group size (9) and plot it against the extra person's distance from ψ.",
        ],
        collect: "Each group's plot, with the four points labelled.",
        good: "All points fall exactly on the line y = x: the new mean is (8ψ + z)/9, so the move is (z − ψ)/9 and nine times the move is z − ψ. The person placed at ψ moves nothing. The group can say that the share 1/9 plays the role of ε in ψ(Pε) = ψ + ε(z − ψ).",
      },
      misconceptions: [
        {
          myth: "An influence function belongs to the estimator you choose.",
          fix: "For the mean, ϕ(z) = z − ψ appears with no estimator in sight. It is a property of the parameter, and in the nonparametric model it is unique.",
          where: "Step 7, “The parameter along the path”",
          source: src.hines,
        },
        {
          myth: "Scores only exist for parametric models, as the derivative with respect to a parameter.",
          fix: "Any path p(1 + εh) through the model has a score, and it is h itself. The familiar parametric score is the special case of moving along a coordinate.",
          where: "Step 5, “The score is a slope”",
          source: src.tsiatisBook,
        },
      ],
      outline: [
        { at: "1 · The mean is a balance point", show: "the 100 patients on the beam, then one more patient 3.6 units out", ask: "How far does the balance point slide, and what is the slide per unit of mass?" },
        { at: "2 · Trace the pull everywhere", show: "sweep the droplet across the line", ask: "What shape do the recorded pulls make, and where does it cross zero?" },
        { at: "3 · A distribution is a point", show: "the Normal sheet and the density lifted off it by the bump", ask: "Which direction does the Normal model not have?" },
        { at: "4 · A path and 5 · The score is a slope", show: "tilt p(1 + εh), then the probe's log-height line", ask: "Why is the score of this path exactly the h you chose?" },
        { at: "6 · Every score averages to zero", show: "the green and red areas cancelling", ask: "Why must ∫hp be zero for every allowed h?" },
        { at: "7 · The parameter along the path and 8 · One ϕ for every direction", show: "the speed E[ϕh] against the actual move, for four directions", ask: "What makes ϕ a gradient?" },
        { at: "10 · Influence for the ATE (and its Go deeper box, the hardest direction)", show: "move x₀ to where its arm is rare; then rotate h toward ϕ", ask: "Why does the pull grow like one over the chance of the arm, and when is the variance floor highest?" },
      ],
    },

    "mean-along-a-path": {
      discuss: [
        {
          q: "Use the lesson's moves to find the influence function of the second moment ψ = E[Z²]. Which move has to change?",
          a: "None. ψ(Pε) = ∫ z² p(1 + εh) = ψ + ε∫ z² h p; subtracting the constant ψ is free because ∫hp = 0; so ϕ(z) = z² − E[Z²]. Only the “position” function changed, from z to z².",
        },
        {
          q: "The variance σ² = E[(Z − μ)²] is not linear in p. Why does the straight-line argument fail, and what is its influence function?",
          a: "The mean μ inside the square moves along the path too, so ψ(Pε) is no longer exactly a straight line in ε. Differentiating E_ε[Z²] − (E_ε[Z])² at ε = 0 gives E[(z² − E[Z²])h] − 2μE[(z − μ)h] = E[((z − μ)² − σ²)h], so ϕ(z) = (z − μ)² − σ².",
        },
        {
          q: "Why should a trial statistician care that the mean's influence function is unique in the nonparametric model?",
          a: "Every regular asymptotically linear estimator of the mean, with no restrictions on the model, then has the same influence function and the same asymptotic variance: nothing beats the sample mean without adding assumptions. Uniqueness breaks when the model is restricted, for example by a known randomization probability, and that is exactly where covariate adjustment gains (Build a canonical gradient).",
        },
      ],
      activity: {
        title: "Three more influence functions",
        format: "Whiteboard derivation",
        minutes: 15,
        groups: "Groups of three",
        materials: [
          "A whiteboard per group with the lesson's moves written as a checklist: weighted sum, masses change, split, subtract a constant, name ϕ.",
          "The two-bin check: outcomes 0 and 2 with probability ½ each; a path moves ε of mass from 0 to 2, so its score is h(0) = −2, h(2) = +2.",
        ],
        steps: [
          "Each group takes one target: E[Z²], P(Z ≤ 1) or E[Z³].",
          "Write ψ(Pε) as position × mass along p(1 + εh) and split it into the old part plus ε times a fixed number.",
          "Subtract the free constant and name ϕ.",
          "Check on the two bins: compute the slope of ψ(Pε) directly, then compute E[ϕh], and compare.",
          "One group presents; the others say which step of the checklist did the work.",
        ],
        collect: "A photo of each board.",
        good: "ϕ(z) = z² − E[Z²], 1{z ≤ 1} − P(Z ≤ 1) and z³ − E[Z³]. On the two bins the direct slopes are 4, −1 and 8, and E[ϕh] gives the same three numbers. Groups say that subtracting the constant is free because ∫hp = 0.",
      },
      misconceptions: [
        {
          myth: "Centering z at ψ is a trick that changes the answer.",
          fix: "The slope is the same for every constant c, because ∫hp = 0 exactly. Centering only chooses the mean-zero representative.",
          where: "You may subtract any constant from z inside the second integral",
        },
        {
          myth: "Several different functions could serve as the mean's influence function in the nonparametric model.",
          fix: "For any non-constant added function b, the direction h = b − E[b] detects it, since there ∫b h p = Var(b). Only constants pass, and centering removes them.",
          where: "Why this ϕ and not another",
          source: src.tsiatisBook,
        },
      ],
      outline: [
        { at: "The seesaw at the top", show: "the patient 3.60 to the right of the balance point", ask: "How far does the balance point slide per unit of added mass?" },
        { at: "ψ(P) is a weighted sum", show: "the running total dipping before it rises", ask: "Why does the total go down first?" },
        { at: "Along the path the masses change", show: "the bars changing height while their positions stay put", ask: "What exactly changes along the path, and what does not?" },
        { at: "Split each bin's contribution", show: "old part plus ε times a second integrand", ask: "Why is ψ(Pε) exactly a straight line in ε here?" },
        { at: "You may subtract any constant", show: "drag c far from the data", ask: "The shaded product changes shape everywhere. What keeps its signed area fixed?" },
        { at: "Choose c = ψ(P)", show: "the three rows of bars and their product", ask: "If every c gives the same slope, why is c = ψ the natural choice?" },
        { at: "Why this ϕ and not another", show: "the grid of ticks and crosses", ask: "Which candidate passes every column, and what does the last column prove?" },
      ],
    },

    "under-the-integral": {
      discuss: [
        {
          q: "Give an example in which exchanging a derivative and an integral fails, and say which condition from the lesson's note is missing.",
          a: "F(t) = ∫₀^∞ sin(tx)/x dx equals π/2 for every t > 0, so F′(t) = 0. Differentiating inside gives ∫₀^∞ cos(tx) dx, which does not even converge. There is no integrable function dominating the derivative of the integrand, which is the condition the lesson names.",
        },
        {
          q: "The table's row sums sit about 0.012 below 0.4978. A student concludes that differentiating inside is “only approximately right”. Correct them.",
          a: "The gap is mass in the tails beyond ±3.5 that the coarse 28-bin table leaves out, a quadrature error in computing ψ. For any finite table the two ways of computing the slope agree exactly, because a sum of differences is the difference of sums.",
        },
        {
          q: "Where later in the course is the same exchange used without comment?",
          a: "In every pathwise derivative: ∫hp = 0 comes from differentiating ∫pε = 1; dψ/dε = E[ϕh] for the ATE differentiates an integral of regressions; the Cramér–Rao argument in the scores lesson and the targeting step's score equation both rely on it.",
        },
      ],
      activity: {
        title: "Way A, Way B, and a curved path",
        format: "Spreadsheet table",
        minutes: 15,
        groups: "Pairs with a spreadsheet",
        materials: ["A spreadsheet program; the lesson's table step open for comparison."],
        steps: [
          "Columns z = −2, −1, 0, 1, 2. Choose probabilities p that sum to 1 and any h, then centre h by subtracting Σhp.",
          "Rows ε = 0, 0.05 and 0.10, cells z·p·(1 + εh). Compute Way A (row totals, then the difference divided by 0.05) and Way B (cell differences divided by 0.05, then the total).",
          "Replace the cells by an exponential tilt, z·p·exp(εh)/C(ε), where C(ε) = Σ p·exp(εh) keeps the row a distribution. Repeat both ways.",
          "Compare both slopes with E[(Z − ψ)h] at ε = 0, then shrink the step from 0.05 to 0.01.",
        ],
        collect: "A screenshot with the four slope numbers and the target E[(Z − ψ)h].",
        good: "Ways A and B agree exactly in both tables. In the linear table both equal E[(Z − ψ)h] for any step; in the tilted table both differ slightly from it, and the difference shrinks with the step, because the per-cell curve is no longer a straight line in ε.",
      },
      misconceptions: [
        {
          myth: "Differentiating under the integral always needs heavy analysis.",
          fix: "Here each cell is a straight line in ε, so the derivative is read off as a coefficient. For other functionals the per-cell derivative is a genuine limit, with a remainder that is second order in ε.",
          where: "Inside one cell: f is a straight line in ε",
        },
        {
          myth: "The running sum should rise steadily to its final value.",
          fix: "The per-bin terms have both signs. The running sum climbs past its final value and then comes back down.",
          where: "Add up the per-cell slopes",
        },
      ],
      outline: [
        { at: "The table", show: "rows ε, columns z, the printed row sums", ask: "What is one row sum, in the language of the earlier lessons?" },
        { at: "The table", show: "the 0.012 gap between the table and 0.4978", ask: "Where does the missing part of the mean live?" },
        { at: "Two ways to get the slope", show: "Way A and Way B side by side after Play", ask: "Which one is “passing the derivative inside”?" },
        { at: "Inside one cell", show: "one column's values against ε", ask: "What is the slope of this line, and why is no limit needed?" },
        { at: "Add up the per-cell slopes", show: "the running sum overshooting", ask: "How can a sum of slopes overshoot its own total?" },
      ],
    },

    "canonical-gradient": {
      discuss: [
        {
          q: "In a randomized trial the efficiency bound for the ATE does not change when the propensity is known, yet covariate adjustment gains precision. Reconcile the two statements.",
          a: "Knowing the propensity removes treatment-mechanism directions, and the ATE's efficient influence function is already orthogonal to them, so the bound stays. But the unadjusted difference in means is a gradient in the restricted model that is not the canonical one. Adjustment projects it onto the tangent space and removes E[(ϕ − D*)²], its excess variance: the adjusted estimator reaches the bound and the unadjusted one does not.",
        },
        {
          q: "Why can restricting the model never raise the efficiency bound at the same distribution?",
          a: "The canonical gradient in the smaller model is the projection of a gradient onto a smaller tangent space, and projecting onto a smaller subspace can only shorten a vector (Pythagoras). So E[(D*)²] can go down or stay the same, never up.",
        },
        {
          q: "A methods paper claims “our estimator attains the semiparametric efficiency bound in model 𝓜”. What should a reviewer ask about 𝓜?",
          a: "What 𝓜 restricts, and why. The canonical gradient and the bound depend on which directions the model allows. A restriction justified by design (a known randomization probability) is safe; one that comes from a parametric assumption buys efficiency that disappears, and can become bias, if the assumption is wrong.",
        },
      ],
      activity: {
        title: "Which knowledge is worth more?",
        format: "Whiteboard derivation",
        minutes: 20,
        groups: "Groups of three; half the groups take version A, half version B",
        materials: [
          "The lesson's three-outcome model: outcomes −1, 0 and 2 with probabilities 0.2, 0.5 and 0.3, so μ = 0.4, ϕ(z) = z − μ = (−1.4, −0.4, 1.6) and E[ϕ²] = 1.24.",
          "A whiteboard per group; the lesson's “Restrict and project” step for checking.",
        ],
        steps: [
          "Version A: the middle probability is known. Version B: the probability of −1 is known. Write the one allowed velocity v (mass moves only between the two free outcomes) and its score h = v/p.",
          "Project: D* = (E[ϕh]/E[h²])·h.",
          "Compute E[(D*)²] and E[(ϕ − D*)²], and check that they add to 1.24.",
          "Version A checks the result against the figure's readout after projecting.",
          "Put both answers on one board: which knowledge lowers the bound more, and why?",
        ],
        collect: "Both boards, with the two bounds side by side.",
        good: "A: h ∝ (1/0.2, 0, −1/0.3), D* = (−1.8, 0, 1.2), E[(D*)²] = 1.08 and 0.16 discarded. B: h ∝ (0, 1/0.5, −1/0.3), D* = (0, −0.75, 1.25), E[(D*)²] = 0.75 and 0.49 discarded. Knowing the mass at −1 is worth more here because more of ϕ lies along the direction it removes; in general, with the middle mass known, E[(D*)²] = 9p₁p₃/(p₁ + p₃).",
      },
      misconceptions: [
        {
          myth: "Knowing more about the model always lowers the bound.",
          fix: "It can leave the bound unchanged when the removed directions were already orthogonal to the gradient, as for the ATE when the propensity is known.",
          where: "Connect to estimation",
          source: src.hines,
        },
        {
          myth: "The rotatable 3D picture means statistical models are three dimensional.",
          fix: "The picture establishes exact identities in a finite model. Extending them uses closed linear spans in L²(P) and regularity conditions.",
          where: "See the geometry",
        },
      ],
      outline: [
        { at: "Move mass", show: "the mean moving while the three outcome positions stay fixed", ask: "What are the coordinates of a distribution here?" },
        { at: "Choose a path", show: "the velocity v and the score h = v/p", ask: "Why is the same velocity a bigger score in a small bin? Find a direction that leaves the mean unchanged." },
        { at: "Build the predictor", show: "a guessed set of sensitivities tested against both directions", ask: "What freedom is left once every slope is predicted?" },
        { at: "See the geometry", show: "blue ϕ in the tangent plane, in √p·h coordinates", ask: "What do length and right angles mean in these coordinates?" },
        { at: "Restrict and project", show: "ϕ dropping onto the allowed line", ask: "What happens to E[ϕ²], and what is the inner product of D* with the discarded piece?" },
        { at: "Connect to estimation", show: "the bound SE with and without the restriction", ask: "Where is this picture in a randomized trial?" },
      ],
    },

    "one-step-estimator": {
      discuss: [
        {
          q: "A colleague reports AIPW and IPW from the same fitted propensity, and they agree to four decimals. Should that reassure you about the outcome model?",
          a: "No. When the propensity model is saturated (one binary covariate, fitted by stratum fractions), AIPW equals IPW, and the stratified estimate, whatever the outcome model. Agreement then says nothing about the outcome model. The anatomy step shows the same identity on the course cohort.",
        },
        {
          q: "Write the one-step estimator for the treated mean E[Y(1)] alone. Which term of the ATE version disappears?",
          a: "ψ̂ = mean of m̂₁(X) + mean of A(Y − m̂₁(X))/ĝ(X). The control residual term, −(1 − A)(Y − m̂₀(X))/(1 − ĝ(X)), disappears. The Four Patients lesson computes exactly this by hand.",
        },
        {
          q: "A reviewer asks why you used cross-fitted flexible learners instead of prespecified parametric models. What does the four-panel experiment let you say, and what not?",
          a: "With parametric models, one correct model is enough for centring, but you cannot know which one is correct, and if both are wrong AIPW is biased (0.648 in the lesson). Flexible learners make both nuisances more likely to be consistent, and the remainder is a product of their errors. What you cannot say is that centring gives coverage: the standard error needs its own argument (Standard errors you can report), and nothing fixes a positivity problem or unmeasured confounding.",
        },
      ],
      activity: {
        title: "An outcome model that knows nothing",
        format: "R exercise",
        minutes: 15,
        groups: "Pairs with one laptop",
        materials: ["examples/r/one-step-ate.R and R (base R only)."],
        steps: [
          "Run the script. Read the plug-in, AIPW and SE for the right and the wrong outcome model, and the IPW line.",
          "Predict: if the outcome model is lm(Y ~ 1), which predicts the same value for everyone, what will the plug-in and the AIPW estimate be?",
          "Add nothing <- one_step(lm(Y ~ 1)); print(nothing) after the line that defines wrong, and rerun.",
          "Explain the result using the comment at the end of the script. Compare the SE with the right-model row.",
          "Stretch: make X continuous with X <- runif(n) (the true ATE becomes 2 + 0.4 × (0.5 − 0.35) = 2.06, so ignore the script's printed “truth = 2”) and check whether AIPW still equals IPW.",
        ],
        collect: "The printed rows and a two-sentence explanation.",
        good: "The plug-in is 0 (m̂₁ = m̂₀), AIPW equals the IPW line exactly, and its SE is larger than with the right outcome model. The explanation: X is binary, so the logistic propensity is saturated and AIPW reduces to IPW for any outcome model; a good outcome model buys precision, not centring, here. In the stretch AIPW and IPW differ, because a logistic model in a continuous X is no longer saturated.",
      },
      misconceptions: [
        {
          myth: "A correction of zero means the outcome model is right.",
          fix: "At λ = 0 with fidelity 0, the linear model's correction is zero by the least-squares normal equations, even though the model omits X² and A×X.",
          where: "One step on data: g-computation, then the correction",
        },
        {
          myth: "Double robustness guarantees a correct interval when one model is right.",
          fix: "It concerns the point estimate. In the propensity-only panel the IF SE averages 0.142 while the estimates spread with SD 0.096, so the intervals over-cover.",
          where: "Repeat samples and separate the promises",
          source: src.lunceford,
        },
      ],
      outline: [
        { at: "The curve ψ(Pε)", show: "orange plug-in, the tangent, purple one-step and green truth", ask: "What is the gap left between purple and green called?" },
        { at: "The curve ψ(Pε)", show: "drag δ down", ask: "The plug-in bias shrinks like δ and the remainder like δ². Why does that asymmetry matter for inference?" },
        { at: "One step on data", show: "the shrinkage slider and the correction built from weighted residuals", ask: "Where will the estimate land when the correction is added?" },
        { at: "The same formula, one patient at a time", show: "the thickest residual sticks", ask: "Which patients carry them, and why?" },
        { at: "The same formula, one patient at a time", show: "Play until every stick is added", ask: "How does the total compare with the severity-stratified estimate?" },
        { at: "Repeat samples", show: "the four panels; then SD 0.096 against mean SE 0.142 in the propensity-only panel", ask: "Which panel is centred away from 2, and which panel is centred but not covered correctly?" },
        { at: "Explain the correction", show: "the equation with its coloured terms", ask: "Say in one sentence what the one-step adds to the plug-in." },
      ],
    },

    "two-strata": {
      discuss: [
        {
          q: "A registry has 400 treated among 500 low-risk patients and 20 treated among 500 high-risk patients. For E[Y(1)], how many high-risk patients does each treated high-risk patient stand in for, and what would you check before trusting the estimate?",
          a: "1/ĝ = 500/20 = 25 each. Check the propensity distribution and the treated arm's effective sample size, whether those 20 differ from untreated high-risk patients in ways the data do not record, and how much the estimate depends on the outcome model's extrapolation in that stratum.",
        },
        {
          q: "In this lesson the TMLE step equals the one-step correction exactly. What makes that happen, and where in the course do the two differ?",
          a: "The fluctuation is linear with H = 1/ĝ, and ĝ equals the observed treated fraction in each stratum. Then ΣH² over the treated equals n times the mean of 1/ĝ over everyone, so the shift in ψ, ε̂ times that mean, equals the mean of H·r, which is the one-step correction. Four Patients uses propensities that do not match the treated fractions, and there they differ.",
        },
        {
          q: "When no treated low-severity patients are left (k = 0), a sponsor's model still produces m₁(low) by extrapolating from high-severity patients. What should a reviewer ask?",
          a: "Whether g(low) is zero in the population (a structural violation, which calls for a different target population) or only in this sample (an empty cell). In the second case the number is model extrapolation, not evidence: the reviewer should ask for the extrapolating assumption to be stated and varied in a sensitivity analysis.",
        },
      ],
      activity: {
        title: "Find the ray for any trial",
        format: "Whiteboard derivation on graph paper",
        minutes: 15,
        groups: "Groups of three",
        materials: [
          "Graph paper and a ruler.",
          "Assigned treated counts out of 50 high-severity and 50 low-severity patients, for example (40, 10), (30, 10) and (25, 25).",
        ],
        steps: [
          "Write the payoff 0.5δhi + 0.5δlo and the cost n_hi·δhi² + n_lo·δlo² for your counts.",
          "Draw two cost ellipses and several payoff lines; mark where a payoff line touches each ellipse.",
          "Derive the tangent ray with a Lagrange multiplier.",
          "Express the ray with the propensity scores g(high) = n_hi/50 and g(low) = n_lo/50.",
          "Check that the marginal costs are equal along δ = ε/g, as in the lesson's last panel.",
        ],
        collect: "Each group's sketch and its one-line ray.",
        good: "Every group finds δlo/δhi = n_hi/n_lo = g(high)/g(low), that is δ ∝ 1/g: slopes 4, 3 and 1. The (25, 25) group explains why equal propensities give equal shifts. The tangent point moves out along the same ray as the budget grows.",
      },
      misconceptions: [
        {
          myth: "The correction should be spread evenly across strata.",
          fix: "Per unit of likelihood, a shift moves ψ most where treated people are rare. The efficient split is the ray δ ∝ 1/g.",
          where: "The budget plane",
          source: src.vdlRubin,
        },
        {
          myth: "An empty treated cell in the sample means the effect is not identified.",
          fix: "If g(low) > 0 it is identified in the population. The sample simply carries no treated evidence there, so any estimate comes from the model's extrapolation.",
          where: "When the low-severity treated count runs out",
          source: src.petersen,
        },
      ],
      outline: [
        { at: "Two strata, equal share", show: "the filled dots and the two bars on the right", ask: "Half of ψ rests on how many people?" },
        { at: "Payoff is linear, cost is quadratic", show: "45 small squares against 5 large ones", ask: "Why do they cost the same?" },
        { at: "The budget plane", show: "Play the growing budget", ask: "Does the tangent direction change as the ellipse swells?" },
        { at: "The budget plane, marginal cost panel", show: "equal marginal costs along δ = ε/g", ask: "Say δ = ε/g in words." },
        { at: "Now let the data choose ε", show: "the 50 and 50 evidence bars; ε̂ = 0.18, shifts 0.2 and 1.8", ask: "Why do 5 low-severity residuals count as much as 45 high-severity ones?" },
        { at: "When the low-severity treated count runs out", show: "slide k to 1, then to 0", ask: "What weight does the last patient carry, and what does k = 0 leave?" },
      ],
    },

    "clever-covariate": {
      discuss: [
        {
          q: "For a binary endpoint in an observational comparison with some extreme propensities, why might you prefer TMLE with a logistic fluctuation as the primary analysis?",
          a: "TMLE plugs in updated predictions that are all probabilities, so an estimated risk stays in [0, 1] and a risk difference in [−1, 1]. The one-step adds an unbounded correction that large weights can push outside (1.283 against TMLE's 0.560 in scene 5). In large samples the two are equivalent.",
        },
        {
          q: "What is the clever covariate for the effect in the treated (ATT), and whose residuals get the large weights?",
          a: "H(A, X) = [A − (1 − A)·g(X)/(1 − g(X))]/P(A = 1). Control patients who look like treated patients (large g) get the largest weights, because they stand in for the treated patients' missing Y(0).",
        },
        {
          q: "A reviewer sees ε̂ = 0 in your TMLE output and asks whether the targeting step was skipped. What legitimate reasons are there?",
          a: "The initial fit already solves the score equation Pₙ[H(Y − m̂)] = 0, for example a saturated outcome model with stratum means and ĝ equal to the stratum fractions (the lesson's cohort figure). Show the reviewer the value of Pₙ[H(Y − m̂)] before and after the update.",
        },
      ],
      activity: {
        title: "When does TMLE not move?",
        format: "R exercise",
        minutes: 20,
        groups: "Pairs with one laptop",
        materials: ["examples/r/tmle-ate.R and R (base R only)."],
        steps: [
          "Run the script. Read the plug-in, AIPW and TMLE rows and ε. The outcome model ignores X on purpose.",
          "Predict ε if the outcome model is made correct, glm(Y ~ A * X, family = binomial).",
          "Edit and rerun. Explain the value of ε and why AIPW and TMLE agree.",
          "Undo the edit. Make the propensities extreme by changing the treatment line to plogis(−3.5 + 6 * X) (probabilities about 0.03 and 0.92) and rerun.",
          "Compare the plug-in, AIPW and TMLE with the printed truth, and compare the two SEs.",
        ],
        collect: "A three-row table (default, correct model, extreme propensities) of plug-in, AIPW, TMLE and ε.",
        good: "With the correct saturated model ε is 0: the initial fit already solves the score equation, so there is nothing to target. With extreme propensities the wrong-model plug-in moves far from the truth, while AIPW and TMLE stay close to each other and much closer to it; in our run TMLE's SE was a little smaller. The pair links this to scene 4's ε̂ = 0 on the cohort.",
      },
      misconceptions: [
        {
          myth: "TMLE and the one-step always give the same number.",
          fix: "For the mean they coincide. For nonlinear targets they differ by a second-order amount: 0.560 against 1.283 in the binary example, where the one-step is not a possible risk difference.",
          where: "For a binary outcome, fluctuate on the logit scale",
          source: src.gruber,
        },
        {
          myth: "Matching the influence function at ε = 0 guarantees that one likelihood fit solves the updated equation for any parameter.",
          fix: "That holds for the mean tilt shown. In general, iterated locally least-favorable submodels or a valid universal construction may be needed.",
          where: "Move along ϕ by maximum likelihood",
          source: src.vdlRubin,
        },
      ],
      outline: [
        { at: "Why ϕ is centered", show: "Pₙϕ as a measure of misfit", ask: "Which job does the uncentered candidate fail?" },
        { at: "Among directions of equal size", show: "the slope tracing a cosine as h rotates", ask: "When is the slope largest?" },
        { at: "Move along ϕ by maximum likelihood", show: "one-step and TMLE both landing on z̄", ask: "Why do they coincide for the mean?" },
        { at: "The clever covariate on the cohort", show: "stick widths |H|", ask: "Which patients have the thickest sticks, and what ε̂ will TMLE choose here?" },
        { at: "For a binary outcome", show: "the eight patients and the one-step at 1.41", ask: "What will the logistic TMLE give? Then slide g(x₇) up to 0.5." },
        { at: "For a binary outcome", show: "the score equation readout, about 1e-13", ask: "What does “the score equation is solved” mean in words?" },
      ],
    },

    "one-move-two-faces": {
      discuss: [
        {
          q: "On a real study your one-step correction is large compared with the standard error. What does that tell you, and what does it not?",
          a: "The correction (Pₙ − P̂)ϕ̂ estimates minus the plug-in bias, plus noise of order 1/√n. A correction several SEs large says the initial fit is biased in the direction that matters for ψ, for example from regularization or a wrong model. It does not say the corrected estimate is right (the remainder, or both nuisances wrong), nor which nuisance is at fault.",
        },
        {
          q: "If the working model for Y has variance σ² = 4 instead of 1, how does the tilt's location shift change, and why does the fitted TMLE update not care?",
          a: "The tilted mean becomes m̂ + εHσ². But ε is estimated by maximum likelihood: the fitted shift ε̂Hσ² is the least-squares move of the regression along H, the same whatever σ² is. Only the product matters.",
        },
        {
          q: "A reviewer asks you to explain, without formulas, why the correction is “the sample's disagreement with the fit”.",
          a: "Averaged over the fitted distribution, the influence function is zero by construction: the fit agrees with itself. Averaged over the actual patients it need not be. That gap measures how the data disagree with the fit, in the direction that matters for the target, and adding it moves the estimate toward what the data say.",
        },
      ],
      activity: {
        title: "Tilt a binary outcome",
        format: "Whiteboard derivation",
        minutes: 15,
        groups: "Groups of three",
        materials: ["A whiteboard per group; the lesson's first step (the Gaussian tilt) projected."],
        steps: [
          "Together, redo the lesson's Gaussian computation: tilting Normal(m̂, σ²) by exp(εH(y − m̂)) gives mean m̂ + εHσ².",
          "Each group now tilts a binary outcome, p̂(y) = m̂^y (1 − m̂)^(1 − y), by exp(εH(y − m̂)) and renormalizes.",
          "Find the new probability of y = 1 and write it on the logit scale.",
          "Check that the score at ε = 0 is H(y − m̂).",
          "Fast groups: do the same for a Poisson outcome with mean λ.",
        ],
        collect: "A photo of each board.",
        good: "logit m_ε = logit m̂ + εH: the logistic fluctuation of Where the Clever Covariate Comes From, derived rather than declared, and always a probability. For the Poisson outcome the tilt gives mean λe^(εH), a log-link fluctuation. Groups note that one move (tilt along the outcome part of ϕ) gives the right fluctuation for each outcome type.",
      },
      misconceptions: [
        {
          myth: "The regression fluctuation m̂ + εH is an arbitrary modelling choice.",
          fix: "For a Gaussian working model it is derived: the exponential tilt of the density along the outcome part of the influence function is a location shift by εH.",
          where: "Tilt the density of Y at one x",
          source: src.vdlRubin,
        },
        {
          myth: "The one-step correction measures the plug-in's bias exactly.",
          fix: "It estimates minus the plug-in bias, with sampling noise (Pₙ − P)ϕ̂ that shrinks like 1/√n.",
          where: "Pₙ is a point too",
          source: src.fisherKennedy,
        },
      ],
      outline: [
        { at: "Tilt the density of Y", show: "the conditional density at one x before and after the tilt", ask: "With g(low) = 0.1 and g(high) = 0.9, how far does the low-severity mean move compared with the high-severity one?" },
        { at: "Tilt the density of Y", show: "the mean computed by numerical integration next to m̂ + εH", ask: "What does their agreement check?" },
        { at: "Tilt the density of Y", show: "the two score panels on one vertical scale", ask: "Why is the low-severity line steeper?" },
        { at: "Pₙ is a point too", show: "P, P̂ and Pₙ side by side", ask: "What is the average of ϕ̂ under P̂?" },
        { at: "Pₙ is a point too", show: "press New sample several times", ask: "What is the jitter of Pₙϕ̂, and which number reports its size?" },
        { at: "Close", show: "write correction = (Pₙ − P̂)ϕ̂ ≈ (P − P̂)ϕ̂ = −bias on the board", ask: "What is left over after the correction?" },
      ],
    },

    "four-patients": {
      discuss: [
        {
          q: "With 400 patients nobody computes ϕ̂ by hand. Name checks from this lesson you would still run on software output.",
          a: "That the mean of the estimated influence values equals the reported correction (plug-in plus correction gives the one-step), and that for TMLE the mean at the updated fit is about zero; that untreated patients have a zero outcome piece for E[Y(1)]; which patients have the largest |H·r| (extreme H flags positivity trouble); and that sd(ϕ̂)/√n reproduces the reported SE.",
        },
        {
          q: "Extend the table to the ATE. Which columns do you add, and what is H for an untreated patient with g = 0.25?",
          a: "Add m̂₀(X), the control residual Y − m̂₀(X), and the control clever covariate −1/(1 − g). For g = 0.25 that is −1/0.75 ≈ −1.33. The X-piece becomes m̂₁(X) − m̂₀(X) − ψ̂.",
        },
        {
          q: "A training slide shows a 95% interval from four patients and a reviewer objects. What are the problems, and what changes at n = 40?",
          a: "With four patients the sd is itself very noisy and the normal approximation is poor (a t quantile with 3 degrees of freedom is 3.18, not 1.96), and the remainder need not be small. At moderate n, use a t quantile or a bootstrap and check stability; the interval still assumes the nuisances are estimated well enough.",
        },
      ],
      activity: {
        title: "Change one outcome, predict everything",
        format: "R exercise with a paper prediction",
        minutes: 15,
        groups: "Pairs: one predicts on paper, one edits the script, then swap",
        materials: ["examples/r/four-patients.R, R, and the lesson's Part 1 table on paper."],
        steps: [
          "Run the script and note, for the treated patient with the largest H, its H and residual, and the printed ΣH².",
          "On paper, predict what happens if that patient's Y rises by 2: the correction rises by 2H/4; ΣHr rises by 2H, so ε̂ rises by 2H/ΣH²; the TMLE rises by that change in ε̂ times the mean of 1/g over the four patients.",
          "Edit that patient's Y in the data frame and rerun. Compare with the predictions.",
          "Undo, and repeat for the treated patient with the smallest H.",
        ],
        collect: "Predictions and output side by side for both edits.",
        good: "Exact agreement, because every quantity is linear in Y. The patient with the larger H moves the correction, ε̂ and the TMLE more, in proportion to their H: the reweighting by 1/g, seen as arithmetic.",
      },
      misconceptions: [
        {
          myth: "Untreated patients drop out of the influence function entirely.",
          fix: "They contribute the X-piece m̂₁(Xᵢ) − ψ̂. Only their outcome piece is zero, because H = 0.",
          where: "The influence function of E[Y(1)], one patient at a time",
        },
        {
          myth: "Exact arithmetic makes a four-patient 95% interval trustworthy.",
          fix: "The sd is itself very noisy with four patients, and a t quantile with 3 degrees of freedom would be 3.18, not 1.96.",
          where: "The payoff: TMLE, a standard error, and an interval",
        },
      ],
      outline: [
        { at: "Part 1, the influence function by hand", show: "the H column", ask: "What is H for an untreated patient, and what is their stick?" },
        { at: "Part 1, the sticks", show: "the dashed running mean of the sticks", ask: "Predict each treated patient's stick sign before typing." },
        { at: "Part 2, ε̂ by hand", show: "the points (H, r) and the line r = εH through the origin", ask: "Whose point pulls ε harder, and why?" },
        { at: "Part 2, ε̂ by hand", show: "ε̂ = ΣHr/ΣH²", ask: "Which regression is this?" },
        { at: "Part 4, the payoff", show: "plug-in, one-step, interval and TMLE", ask: "Why does TMLE differ from the one-step here but not in Two Strata, One Step?" },
        { at: "Part 4, the honesty note", show: "t with 3 degrees of freedom: 3.18", ask: "What can a four-patient interval not do?" },
      ],
    },

    "efficiency-theory-story": {
      discuss: [
        {
          q: "Your AIPW uses gradient boosting for both nuisances. What rate condition do you need to argue, and what changes if the propensity comes from a correctly specified logistic model?",
          a: "The product of the two L² errors must be o(n^−1/2), for example each faster than n^−1/4, or one faster to compensate for a slower other, together with cross-fitting or a Donsker condition. With a correct parametric propensity (error of order n^−1/2) the outcome model need only be consistent for the product to be o(n^−1/2).",
        },
        {
          q: "The plug-in's intervals lose coverage as n grows. Would a bootstrap interval for the plug-in fix this?",
          a: "No. The bootstrap estimates the plug-in's spread, which its own SE already describes well; the problem is its centre, 2.64 instead of 2. Resampling does not remove bias, and the intervals shrink around the wrong value either way.",
        },
        {
          q: "A reviewer asks: “You call your estimator efficient. Efficient relative to what?”",
          a: "Relative to all regular asymptotically linear estimators in the stated model: its asymptotic variance equals the variance of the efficient influence function, the bound. No regular estimator does better without further assumptions, which would shrink the model. The claim is only as good as the model it is made in.",
        },
      ],
      activity: {
        title: "Tell the story as a relay",
        format: "Jigsaw presentation",
        minutes: 20,
        groups: "Seven small groups (with fewer students, give some groups two parts)",
        materials: [
          "Seven cards: the lesson's five steps plus its two “Go deeper” panels (the pathwise derivative and tangent space; the remainder rectangle).",
          "The lesson projected in Explore mode.",
        ],
        steps: [
          "Give each group one card.",
          "Six minutes: prepare a 90-second explanation using that part's figure, with only its “In one sentence” box (or the panel's first paragraph) as notes, and decide which control to press while talking.",
          "In the lesson's order, each group explains at the projector, with the two Go deeper panels placed where they open.",
          "Before starting, each group says one hand-off sentence: how its part uses the one before.",
        ],
        collect: "The seven hand-off sentences on one sheet.",
        good: "The hand-offs form a chain: a map, an error that is an average, a derivative in a tangent space, a projection to the shortest influence function, a correction, a remainder that is a product, a walk through the model. Groups use the right names (gradient, efficient influence function D*, tangent space), and someone points out that the rectangle bounds the size of the remainder, not its sign.",
      },
      misconceptions: [
        {
          myth: "Asymptotic linearity guarantees valid intervals.",
          fix: "The plug-in is asymptotically linear around 2.64. Its intervals shrink around the wrong number and coverage falls as n grows.",
          where: "Step 2, “The error is an average”",
        },
        {
          myth: "Two nuisance errors of order n^−1/4 are enough for efficient inference.",
          fix: "Their product is then of the same order as the sampling error. Efficient inference needs a negligible product or a sharper argument.",
          where: "Step 4, “Plug-in bias and one step” (Go deeper: the remainder is a rectangle)",
          source: src.chernozhukov,
        },
      ],
      outline: [
        { at: "1 · A parameter is a map", show: "the blob 𝓜 and its level curves", ask: "What does identification contribute, and what does estimation?" },
        { at: "2 · The error is an average", show: "switch n from 100 to 400; then the red balls and the plug-in's 47 of 200", ask: "What happens to the width of the AIPW pile, and why does the plug-in cover less as n grows?" },
        { at: "2, Go deeper: the pathwise derivative and the tangent space", show: "rotate the direction; the derivative traces a cosine", ask: "Why is E[h] = 0 the same as being tangent to the model?" },
        { at: "3 · The shortest influence function", show: "the line Φ of influence functions meeting the tangent space", ask: "Why does the meeting point, D*, have the smallest variance?" },
        { at: "4 · Plug-in bias and one step", show: "halve the nuisance error", ask: "The first-order term halves and the remainder quarters. What is left after the one-step?" },
        { at: "4, Go deeper: the remainder is a rectangle", show: "shrink one side to zero", ask: "What is double robustness in this picture, and what does the rectangle not tell you?" },
        { at: "5 · TMLE walks; the one-step jumps", show: "Play the walk and compare where each lands on the ψ line", ask: "When does staying inside the model matter?" },
      ],
    },

    "inference-lab": {
      discuss: [
        {
          q: "A colleague fits random forests for both nuisances on the full data, without cross-fitting, and reports AIPW with the influence-function SE. What do you ask?",
          a: "Whether each patient's predictions came from a forest that had seen that patient's outcome. Forests can nearly interpolate their training data, which shrinks the residuals and the IF SE, as the 1-nearest-neighbour learner does here. Ask for cross-fitted (or at least out-of-bag) predictions and compare the two SEs.",
        },
        {
          q: "The outcome model's error shrinks like n^−0.35 and the propensity model's like n^−0.15. Does the product-rate condition hold? What if both shrink like n^−0.2?",
          a: "0.35 + 0.15 = 0.5 sits exactly on the boundary, and equality is not enough by itself. With 0.2 + 0.2 = 0.4 the condition fails: √n times the product behaves like n^0.1 and grows.",
        },
        {
          q: "A reviewer asks whether cross-fitting makes your estimate “robust to model misspecification”. Answer precisely.",
          a: "No. Cross-fitting controls the empirical-process term that data reuse inflates. It does not fix a persistently wrong model, weak overlap, unmeasured confounding, or a remainder that fails to vanish; those need consistent nuisance estimates at adequate rates, positivity and identification.",
        },
      ],
      activity: {
        title: "Does more data fix data reuse?",
        format: "R exercise",
        minutes: 15,
        groups: "Pairs with one laptop",
        materials: ["examples/r/crossfit-aipw.R and R (base R and splines)."],
        steps: [
          "Run the script. Read the two Part 2 lines: 1-nearest neighbour without and with cross-fitting.",
          "Predict: with four times as many patients per study, will the coverage without cross-fitting improve?",
          "In the Part 2 simulation loop, change the per-study sample size from 400 to 1600 and rerun (a few seconds).",
          "For each run, compute mean SE divided by the SD of the estimates.",
          "Explain the result with the three-term error from the lesson's first step.",
        ],
        collect: "A two-by-two table (sample size by cross-fitting) of coverage and SE/SD ratio.",
        good: "Without cross-fitting the SE stays about half the real SD and coverage stays far below 95% at both sizes (70% and 68% in our run), so more data does not repair data reuse. With two folds, coverage is close to 95% at both sizes. The explanation names the empirical-process term.",
      },
      misconceptions: [
        {
          myth: "Zero training residuals mean an excellent fit.",
          fix: "A learner that memorises its training outcomes has zero training error and says nothing about a new patient.",
          where: "Cross-fitting",
          source: src.zivich,
        },
        {
          myth: "Cross-fitting corrects a wrong model.",
          fix: "It controls the empirical-process term. Consistent nuisance fits and a vanishing remainder are still needed.",
          where: "Cross-fitting on or off",
          source: src.chernozhukov,
        },
      ],
      outline: [
        { at: "Three terms", show: "the rectangle while Play grows n", ask: "On the boundary α + β = ½, what does √n times the area do?" },
        { at: "Rates", show: "α = β = 0.25", ask: "Why is equality not enough by itself?" },
        { at: "Cross-fitting", show: "phase 1: sixteen patients, training MSE 0", ask: "What does a training error of zero tell you?" },
        { at: "Cross-fitting", show: "phases 2 to 4, fold A predicting fold B and back", ask: "Who predicts each patient now?" },
        { at: "Cross-fitting on or off", show: "drag the coverage marker, run, then SD 0.119 against mean SE 0.057", ask: "Which term of the error did data reuse inflate?" },
        { at: "Cross-fitting on or off", show: "k = 25", ask: "Why does a smoother learner do far less harm without cross-fitting?" },
      ],
    },

    "standard-errors": {
      discuss: [
        {
          q: "Your AIPW uses a correctly specified logistic propensity; you are unsure about the outcome model. The influence-function SE is clearly larger than a bootstrap SE that refits both models. Which do you report, and what does the gap suggest?",
          a: "Report the bootstrap. A conservative IF SE is the signature of a wrong outcome model with a right propensity: in the lesson's large-sample limits the IF SE is 0.137 against a true SD of 0.087. The point estimate is still consistent if the propensity is right; the IF SE becomes a diagnostic.",
        },
        {
          q: "For a TMLE of a risk difference with cross-fitted Super Learner nuisances, which SE would you prespecify, and why does the answer differ from this lesson's parametric case?",
          a: "Usually the influence-function SE at the targeted fit. When both nuisances are consistent and the product-rate condition holds, the terms from fitting them vanish in large samples, so sd(ϕ̂)/√n is valid. In this lesson a parametric working model may be wrong, the fitting terms do not vanish, and the IF SE can be too large or too small.",
        },
        {
          q: "A reviewer asks for a bootstrap of a clone-censor-weight analysis. Why must you resample patients and refit the censoring model?",
          a: "The two clones of a patient share one history, so they are not independent, and the weights are estimated, so their variability belongs in the SE. Resample patients, re-clone, refit the decision model and recompute: the same principle as here, refit everything that was estimated.",
        },
      ],
      activity: {
        title: "Fix this standard-error paragraph",
        format: "Critique a mock SAP paragraph",
        minutes: 15,
        groups: "Groups of three",
        materials: [
          "Printed mock paragraph: “The ATE will be estimated by AIPW with a logistic propensity model and a linear outcome model. The 95% CI will use the standard error sd(ϕ̂)/√n, which is valid because AIPW is doubly robust. Bootstrap samples in which the propensity model fails to converge will be discarded. Missing covariates will be handled by complete-case analysis.”",
          "The lesson's “What to report” step.",
        ],
        steps: [
          "Mark each claim true, false or incomplete.",
          "For each false or incomplete claim, name the lesson step that addresses it.",
          "Rewrite the standard-error sentences as the lesson's recipe would.",
          "Compare the rewrite with the lesson's sample sentence and note what your study would need to add.",
        ],
        collect: "The marked paragraph and the rewrite.",
        good: "Double robustness is recognised as a property of the point estimate, not of the SE (the IF SE can be too large or too small with a parametric working model); the bootstrap refits both models in every resample; failed resamples are redrawn and counted, not silently dropped; the IF SE is kept as a sensitivity analysis. Complete-case analysis is flagged as a separate missing-data question that this lesson does not settle.",
      },
      misconceptions: [
        {
          myth: "The IF SE is always valid for AIPW.",
          fix: "In the four cases its intervals cover 99.8% of the time when only the propensity is right and 93.3% when only the outcome model is right.",
          where: "Four cases at a glance",
          source: src.lunceford,
        },
        {
          myth: "A correct standard error gives a correct interval.",
          fix: "When both models are wrong every SE matches the spread, and coverage is still 0%: the estimate is centred at 2.64, not 2.",
          where: "The bootstrap",
        },
      ],
      outline: [
        { at: "What an SE estimates", show: "Play the repeated studies; the green bracket settling", ask: "What quantity is every standard error trying to estimate?" },
        { at: "What an SE estimates", show: "the plug-in board: 0 of 200 intervals cover", ask: "Its SE describes its spread well. Why does it never cover?" },
        { at: "The influence-function SE", show: "the sticks, sd(ϕ̂) = 2.83, IF SE 0.1415", ask: "Four fits, nearly the same estimate: what will their IF SEs do?" },
        { at: "Why they disagree", show: "the true-propensity and estimated-propensity histograms", ask: "Which varies less, and why is that surprising?" },
        { at: "The bootstrap", show: "resamples accumulating, each refitting both models", ask: "Why refit in every resample?" },
        { at: "Four cases at a glance", show: "coverage 95.3%, 93.3%, 99.8% and 0%", ask: "Which SE do you report in each case?" },
        { at: "What to report", show: "the sample analysis-plan sentence", ask: "What would you change for your own study?" },
      ],
    },

    "positivity": {
      discuss: [
        {
          q: "Your mirrored propensity plot shows a small group of control patients with ĝ below 0.02 and no treated patients there. Is that a weighting problem for the ATE?",
          a: "Not through those controls' weights, which are about 1/(1 − 0.02) ≈ 1.02. It is a positivity problem all the same: no treated patient looks like them, so E[Y(1)] for that group is not learned from data and any estimate there is extrapolation. For the ATT it would not matter, because the ATT needs controls wherever treated patients are, not the other way round.",
        },
        {
          q: "A device is contraindicated for patients with severe kidney disease. A registry analysis targets the ATE in all registry patients. What should change?",
          a: "This is a structural violation: g = 0 for contraindicated patients by design, and more data will not help. Redefine the target population as patients eligible for the device, in the estimand itself, or state the extrapolation you rely on as an explicit assumption and vary it.",
        },
        {
          q: "A sponsor trimmed patients with ĝ outside [0.1, 0.9] and still calls the result “the ATE”. What does the reviewer ask for?",
          a: "A name for the new estimand (the average effect in the retained population), a baseline table of who remains, evidence the trimming rule was prespecified, and sensitivity analyses with other thresholds plus the untrimmed AIPW or TMLE with its effective sample size. When effects vary with covariates (τ(x) = 2 + x in the lesson) the trimmed answer is a different number.",
        },
      ],
      activity: {
        title: "Negotiate the positivity clause",
        format: "Role-play a reviewer and a sponsor",
        minutes: 20,
        groups: "Groups of four: two sponsor statisticians, two reviewers",
        materials: [
          "The lesson's “Three responses” step on the sponsors' device and “Write it in the SAP” on the reviewers'.",
          "Paper for the agreed paragraph.",
        ],
        steps: [
          "Sponsors choose one response (capping, trimming or overlap weights) at a separation they pick, and write a two-sentence justification.",
          "Reviewers prepare questions from the SAP checklist: structural checks, diagnostics, trigger, estimand, sensitivity.",
          "Eight-minute exchange; each side must use the lesson's figures as evidence.",
          "Together, write one analysis-plan paragraph both sides accept.",
        ],
        collect: "The agreed paragraph.",
        good: "The paragraph says whether the estimand changed (trimming and overlap weights: yes; capping: no, but the estimator becomes biased), describes the retained population, fixes the trigger before outcomes are seen, and lists sensitivity analyses. Reviewers challenge any claim that trimming “stabilises the ATE”.",
      },
      misconceptions: [
        {
          myth: "AIPW is immune to thin overlap because it is doubly robust.",
          fix: "With a correct outcome model it stays centred, but at β = 4 its SD is 4.7 times its no-separation value (IPW's is 8.3 times).",
          where: "Repeated samples",
          source: src.petersen,
        },
        {
          myth: "Trimming and overlap weights are ways to stabilise the ATE.",
          fix: "They change the population, so they change the estimand. Capping keeps the estimand and makes the estimator biased for it.",
          where: "Three responses",
          source: src.crump,
        },
      ],
      outline: [
        { at: "See the overlap", show: "slide β and watch the red rings appear", ask: "Which patients end up carrying the largest weights?" },
        { at: "See the overlap", show: "the few treated patients in the left band", ask: "Whom must each of them speak for?" },
        { at: "Effective sample size", show: "β = 4, 163 treated", ask: "How many equally weighted patients is this arm worth?" },
        { at: "Repeated samples", show: "IPW SD 8.3 times, AIPW 4.7 times its no-separation value", ask: "Why is double robustness not immunity?" },
        { at: "Three responses", show: "toggle capping, trimming and overlap weights", ask: "Which response keeps the question you wrote down?" },
        { at: "Structural or practical", show: "ten times more patients", ask: "Which bias shrinks?" },
        { at: "Write it in the SAP", show: "the draft wording built from the chosen response", ask: "What trigger would you prespecify in your area?" },
      ],
    },

    "sensitivity": {
      discuss: [
        {
          q: "Your study reports a hazard ratio of 0.70. Can you put 0.70 straight into the E-value formula?",
          a: "Only as an approximation when the outcome is rare, where a hazard ratio is close to a risk ratio: then use 1/0.70 ≈ 1.43, giving an E-value of about 1.43 + √(1.43 × 0.43) ≈ 2.21. For a common outcome, convert the hazard or odds ratio to an approximate risk ratio first, as the lesson's report step says (VanderWeele and Ding give conversions).",
        },
        {
          q: "Two studies of the same exposure report RR 1.50 (95% CI 1.26 to 1.79) and RR 3.0 (95% CI 1.1 to 8.2). Which is more robust to unmeasured confounding?",
          a: "It depends on the claim. For the point estimate the second is more robust: E-values of about 2.37 and 3 + √6 ≈ 5.45. For the interval the first is: about 1.8 against 1.1 + √(1.1 × 0.1) ≈ 1.43. A wide interval makes “no effect” easier to reach.",
        },
        {
          q: "A reviewer asks how to read your benchmark sentence, “the strongest measured confounder, severity, corresponds to a bias factor of 1.47”.",
          a: "An unmeasured confounder as strong as severity (given the other covariates) could shift the risk ratio by up to a factor of 1.47: enough to bring the lower limit 1.26 below 1, not enough to erase 1.50 (1.50/1.47 ≈ 1.02). Whether such a confounder plausibly remains is a scientific judgement, and the benchmark says “as strong as severity”, not “only severity-like confounders remain”.",
        },
      ],
      activity: {
        title: "Why each strength must reach the RR",
        format: "Whiteboard derivation",
        minutes: 15,
        groups: "Groups of three",
        materials: ["A whiteboard per group; the lesson's bias map projected."],
        steps: [
          "For strengths a, b ≥ 1 and B = ab/(a + b − 1), show that B ≤ a and B ≤ b.",
          "Show that B ≥ 1, and find when B equals the smaller strength.",
          "Set a = b = E and solve B(E, E) = RR for E.",
          "Check E for RR = 1.50 and RR = 2.",
          "Use step 1 to explain why the red curve on the bias map never crosses the lines RR_EU = 1.50 or RR_UD = 1.50.",
        ],
        collect: "A photo of each board.",
        good: "Since a + b − 1 > 0, B ≤ a ⇔ b ≤ a + b − 1 ⇔ a ≥ 1, and likewise for b. B ≥ 1 ⇔ (a − 1)(b − 1) ≥ 0. B equals the smaller strength only when that strength is 1, and then B = 1. E²/(2E − 1) = RR gives E² − 2·RR·E + RR = 0, whose root above 1 is E = RR + √(RR(RR − 1)): about 2.37 and 3.41. Consequence: a confounder can explain away RR only if each of its strengths is at least RR, however strong the other one is.",
      },
      misconceptions: [
        {
          myth: "An E-value is a probability, or odds, that the effect is real.",
          fix: "It is the strength of association a confounder would need. It is not a probability, not a test, and not proof of causation.",
          where: "Report it",
          source: src.vdwDing,
        },
        {
          myth: "Two strengths of 2 multiply to 4, so together they could explain away RR 1.50.",
          fix: "The bias factor is 2·2/(2 + 2 − 1) = 4/3, less than 1.50, and it can never exceed the smaller strength. The estimate survives, though the interval could now include 1.",
          where: "The bias map",
          source: src.dingVdw,
        },
      ],
      outline: [
        { at: "Recall κ", show: "the band ψ̂ ± κ", ask: "How large must κ be before the interval, and then the estimate, reaches zero?" },
        { at: "The bias map", show: "strengths 2 and 2, B = 1.33", ask: "Can this confounder explain away RR 1.50?" },
        { at: "The bias map", show: "drag along the red curve toward its asymptotes", ask: "What do all its points share, and why must each strength exceed 1.50?" },
        { at: "The E-value", show: "the diagonal meeting the curve at 2.37", ask: "What does an E-value of 2.37 not mean?" },
        { at: "The E-value", show: "the sweep from RR 0.25 to 4: E(2) = 3.41, E(3) = 5.45", ask: "Why does RR 0.5 have the same E-value as RR 2?" },
        { at: "Benchmark", show: "the measured covariates placed on the map", ask: "Could a confounder as strong as severity erase the estimate? The interval?" },
        { at: "Report it", show: "the suggested wording", ask: "What would you add for your own study?" },
      ],
    },

    "survival-lab": {
      discuss: [
        {
          q: "Your trial's primary analysis is a log-rank test with a Cox hazard ratio. The data monitoring committee asks “how much longer do patients stay event-free?”. What do you add, and what does it need?",
          a: "The RMST difference up to a prespecified horizon τ (and survival at τ): extra event-free time within the window. τ must lie within follow-up, where patients are still being observed in every arm and relevant subgroup, and should be chosen for clinical reasons before looking at treatment results.",
        },
        {
          q: "In another cohort, frail patients are lost to follow-up faster (they move to hospice care outside the network). Which way does plain Kaplan–Meier err, and what fixes it?",
          a: "The patients who leave are the ones most likely to have the event, so the risk set left behind is healthier and KM overestimates survival. Censoring weights from a model that includes frailty (heirs of the same frailty, in the moving-mass picture), or standardization within frailty strata, repair it, assuming censoring is independent of the event given the measured variables.",
        },
        {
          q: "The conditional hazard ratio is 0.65 at every severity level, but the marginal one is 0.73 at 5 years. A reviewer asks whether the treatment effect wanes. Reply.",
          a: "No one's own hazard ratio changed. High-severity patients leave the control risk set faster than the treated one, so the control arm's average hazard falls faster and the ratio drifts. Using the lesson's hazards it rises to about 0.75 near year 8 and returns toward 0.65 much later, when only low-severity survivors remain. Report survival differences or RMST for population statements.",
        },
      ],
      activity: {
        title: "Sketch the marginal hazard ratio",
        format: "Sketch before reveal",
        minutes: 15,
        groups: "Pairs, then the whole class",
        materials: [
          "Paper with axes: years 0 to 10 across, hazard ratio 0.5 to 1.0 up.",
          "The lesson's “Connect Cox to geometry” step projected but not yet played.",
        ],
        steps: [
          "Give the facts: 35% high severity; control hazards 0.08 and 0.32 per year; treatment multiplies every patient's hazard by 0.65.",
          "Each pair sketches the hazard ratio between everyone-treated and everyone-control from year 0 to 10.",
          "Compute the ratio at year 0 together on the board.",
          "Play the jars. Pairs compare their sketch and write one sentence explaining the direction.",
        ],
        collect: "The sketches with their sentences.",
        good: "The curve starts at exactly 0.65 (both arms begin with the same mix) and rises (0.73 at 5 years in the lesson), because high-severity patients leave the control jar faster. Strong pairs add that the ratio cannot rise forever: once only low-severity patients remain in both arms it returns toward 0.65 (it peaks near 0.75 around year 8 with these hazards).",
      },
      misconceptions: [
        {
          myth: "Censoring pulls the Kaplan–Meier curve down.",
          fix: "At a censoring nothing falls. The patient's mass is shared among those still at risk, which is how KM assumes that whoever left was like everyone who stayed.",
          where: "Moving mass",
          source: src.sattenDatta,
        },
        {
          myth: "A Cox coefficient is a marginal survival contrast.",
          fix: "β targets a conditional log hazard ratio under proportional hazards. It is not automatically a survival difference or an RMST difference, and the marginal hazard ratio drifts even when the conditional one is constant.",
          where: "Connect Cox to geometry",
          source: src.hernanHR,
        },
      ],
      outline: [
        { at: "Choose a survival target", show: "S₁(5) − S₀(5) against the area up to 5 years", ask: "What does an RMST difference of 0.4 years mean for one patient?" },
        { at: "See selection", show: "the 24-patient strip; Ŝ(τ) = 0.359 against the truth 0.625", ask: "Why is this strip so far off?" },
        { at: "Moving mass", show: "a censoring: the mass passed to the right", ask: "What happens to Ŝ(t) at that moment?" },
        { at: "Moving mass", show: "tap a survivor at the end", ask: "Where does its weight 1/Ĝ(t−) come from?" },
        { at: "Compare curves", show: "the blend slider; pooled KM behaves like w = 0.41", ask: "Why neither 0.52 nor 0.35?" },
        { at: "Connect Cox to geometry", show: "the two jars; 0.65 at baseline, 0.73 at 5 years", ask: "Whose hazard ratio changed?" },
      ],
    },

    "targeted-survival": {
      discuss: [
        {
          q: "Your device trial is randomized, so g is known. Does the censoring part of this lesson still matter?",
          a: "Yes. Randomization balances treatment, not dropout. If dropout depends on prognosis, plain KM is biased and censoring weights from a model with the prognostic covariates are needed; the augmented estimator also gains precision from covariate adjustment, as in Moore and van der Laan (2009).",
        },
        {
          q: "The horizon here is τ = 12 months. What goes wrong if you choose a horizon where hardly any patients of one severity level are still followed?",
          a: "G(t− | A, X) approaches zero, so the weights 1/G become huge and the variance explodes: the positivity condition for censoring, G > 0 through the horizon, is failing. Choose and prespecify τ where every relevant group is still observed.",
        },
        {
          q: "The step's estimate is ΔRMST(12) = 1.07 months (95% CI 0.58 to 1.57), while the truth in this simulated world is 0.83. A reviewer asks whether the estimator is biased.",
          a: "One study cannot show bias: its estimate varies around the truth, and this interval contains 0.83. The repeated-study step answers the question: with every model right the one-step estimate of S₁(12) has bias −0.012 with a Monte Carlo SE of 0.012, so no detectable bias, and it stays centred when the event model leaves severity out but the censoring and propensity models are right.",
        },
      ],
      activity: {
        title: "Mark up a survival results paragraph",
        format: "Critique a mock SAP and results paragraph",
        minutes: 15,
        groups: "Groups of three",
        materials: [
          "Printed mock paragraph: “Survival will be compared with Kaplan–Meier curves and a Cox model adjusted for severity. Patients lost to follow-up will be censored; since only 12% were lost, censoring is ignorable. The adjusted hazard ratio will be interpreted as the reduction in the risk of the event at 12 months, and the 95% band around the one-step survival curve shows that treated patients do better at every time point.”",
          "The lesson's “ΔRMST or a hazard ratio?” step.",
        ],
        steps: [
          "Find at least four problems.",
          "For each problem, name the lesson step that addresses it.",
          "Rewrite the result as one sentence using the numbers on screen in the last step, then list every assumption the interval rests on.",
        ],
        collect: "The list of problems and the rewrite.",
        good: "A low censoring rate is not evidence that censoring is independent (the survival lab); dropout related to health needs censoring weights from a model with severity; the adjusted hazard ratio is a conditional, model-based summary, not a risk reduction at 12 months, and here no single conditional hazard ratio exists; the band is pointwise, so “at every time point” is not supported. The rewrite names a population, a horizon, a unit and an interval, and lists exchangeability, positivity for treatment and censoring through 12 months, and censoring independent of the event given A and X.",
      },
      misconceptions: [
        {
          myth: "An adjusted Cox hazard ratio answers “how many more event-free months”.",
          fix: "The adjusted hazard ratio is a conditional, model-based summary, and in this world the effect on the hazard differs by severity, so no single conditional hazard ratio exists. ΔRMST names a population, a horizon and a unit.",
          where: "ΔRMST or a hazard ratio?",
          source: src.hernanHR,
        },
        {
          myth: "If any nuisance model is wrong, the one-step estimate is biased.",
          fix: "With the event model wrong but the censoring and treatment models right, the one-step stays centred on the truth. The simple IF standard error need not be exact in that case.",
          where: "Double robustness",
          source: src.bai,
        },
      ],
      outline: [
        { at: "Three curves and the truth", show: "unadjusted KM 0.519 against the truth 0.617, weighted 0.622", ask: "Why is the plain curve of the treated below the truth?" },
        { at: "Where 1/G comes from", show: "the dots growing month by month", ask: "Which severity group's remaining patients carry the largest weights?" },
        { at: "Where 1/G comes from, moving mass", show: "heirs switched from everyone to same severity", ask: "Why does the choice of heirs move the curve?" },
        { at: "Each patient's influence value", show: "the three coloured parts; Play turns 1/G on", ask: "Which pieces grow as the censoring weight comes in?" },
        { at: "Each patient's influence value", show: "switch the event model to one that ignores severity", ask: "Every orange piece becomes zero. Who does the work now?" },
        { at: "Double robustness", show: "first the event model without severity (censoring and propensity right), then both sides partly wrong", ask: "Where is the one-step centred in each case, and why does its bias sit below both the plug-in's and the weighted KM's when both sides are a little wrong?" },
        { at: "ΔRMST or a hazard ratio?", show: "1.07 months (0.58 to 1.57) and the unadjusted −0.16", ask: "Why does the unadjusted difference have the wrong sign?" },
      ],
    },
    capstone: {
      discuss: [
        {
          q: "The sponsor wants to submit this emulation as supporting evidence for a device label. Beyond the report paragraph, what will an FDA reviewer expect to see?",
          a: "The protocol and analysis plan dated before the outcome analysis; the estimand and protocol tables with the time-zero rule; evidence the registry is fit for the question (how eligibility, crossover and the outcome were captured), as the 2025 device RWE guidance asks; the positivity diagnostics and the prespecified trigger; sensitivity analyses for unmeasured confounding and for analysis choices such as the learner library; and a TARGET-style report of each protocol component and how it was emulated.",
        },
        {
          q: "Suppose 15% of patients had been lost to follow-up before 12 months, more often the frail. Which parts of the analysis change?",
          a: "The 1-year risk is no longer observed for everyone, so the estimator must handle censoring: censoring weights or the targeted survival estimator of S₁(12) and S₀(12), with a censoring model that includes the prognostic covariates. It assumes censoring is independent of the event given strategy and covariates, and that the chance of still being followed stays above zero through 12 months. The lesson needs none of this only because follow-up is complete.",
        },
        {
          q: "The E-value for the estimate is 1.87, yet the benchmark says a confounder as strong as STS-PROM (strengths 2.47 and 1.87) could explain the estimate away. Are these consistent?",
          a: "Yes. The E-value is the one point on the explain-away curve where both strengths are equal. STS-PROM's point is (2.47, 1.87): its bias factor 2.47 × 1.87/(2.47 + 1.87 − 1) ≈ 1.38 exceeds RR* = 1/0.78 ≈ 1.28, so it lies beyond the curve. An E-value that sounds reassuring on its own can be matched by a confounder you already measured, which is why the report states the benchmark.",
        },
      ],
      activity: {
        title: "The reviewer panel",
        format: "Mock review panel",
        minutes: 20,
        groups: "Six groups of two or three",
        materials: [
          "The six reviewer questions from the lesson's last step, one per card: why not a Cox model and a hazard ratio; did flexible learners overfit and shrink the interval; what about the crossovers; was positivity adequate; frailty was not measured, how worried should we be; were time zero and eligibility aligned.",
          "The lesson open on one device per group, with the “SAP and report” step's answers still closed.",
        ],
        steps: [
          "Each group draws one card and has 8 minutes to write a three-sentence answer, citing the lesson's numbers.",
          "Groups read their answers aloud in the order of the lesson's steps.",
          "After each answer, open the lesson's own answer and let the room say what the group added or missed.",
          "Close by listing, on the board, every number the answers used and the step it came from.",
        ],
        collect: "The six written answers.",
        good: "Answers cite the step and the number: treatment policy with the 92 crossovers kept in standard care; time zero at eligibility in both arms; effective sample sizes 448 of 730 and 672 of 870 with the prespecified trigger not met; cross-fitting so no patient's predictions came from a model that saw them; E-values 1.87 and 1.25 with the STS-PROM benchmark at 1.38; and risk differences, risk ratio and event-free months rather than a hazard ratio.",
      },
      misconceptions: [
        {
          myth: "A flexible learner with cross-fitting takes care of confounding.",
          fix: "Learners estimate the nuisances. The causal claim still rests on consistency, no unmeasured confounding given the five covariates, and positivity, and only positivity leaves a trace in the data. Frailty is not in the registry, which is why the sensitivity step exists.",
          where: "The protocol",
          source: src.whatIf,
        },
        {
          myth: "A Super Learner picks the single best model.",
          fix: "It mixes learners by cross-validated performance: the ensemble's CV Brier score, 0.1578, beats the best single learner's 0.1589, and removing a learner re-weights the others.",
          where: "Nuisance models",
          source: {
            t: "van der Laan, Polley and Hubbard (2007), Super Learner, Stat Appl Genet Mol Biol 6(1)",
            href: "https://doi.org/10.2202/1544-6115.1309",
          },
        },
        {
          myth: "An unadjusted comparison is a conservative version of the effect.",
          fix: "Here it points the wrong way: 4.1 points of apparent harm against an adjusted benefit of about 5.4 points, because sicker patients received the device more often.",
          where: "The estimate",
        },
      ],
      outline: [
        { at: "The question", show: "one patient drawn twice, then the five-attribute estimand", ask: "Under treatment policy, where do the 92 patients who later crossed over belong?" },
        { at: "The protocol", show: "the time-zero choice", ask: "If the device arm started at the implant date, which arm would look better, and why?" },
        { at: "Positivity", show: "the mirrored propensity histograms; ESS 448 of 730 and 672 of 870", ask: "Which arm loses the larger share to unequal weights, and was the trigger met?" },
        { at: "Nuisance models", show: "the learner weights; remove one learner", ask: "Why does the ensemble not simply keep the best learner?" },
        { at: "The estimate", show: "unadjusted +4.1 points against AIPW −5.41 and TMLE −5.40, truth −7.3", ask: "What did adjustment remove, and what does the interval promise?" },
        { at: "Sensitivity", show: "RR 0.78, E-values 1.87 and 1.25, the STS-PROM point", ask: "Could a confounder as strong as STS-PROM explain the effect away?" },
        { at: "SAP and report", show: "the generated report paragraph", ask: "Which sentence would a heart team act on, and which would a reviewer challenge first?" },
      ],
    },
  };

  /* Units the curriculum may register before their guide notes exist, with a note to show on the
   * page in place of the full entry. The tests accept a unit listed here without a full entry; the
   * schedules list it under "Not yet placed" until it is added to them. Empty while every
   * registered lesson has notes. */
  const pending = {};

  /* Six exam-style questions spanning the course. `covers` lists the lessons each draws on. */
  const assessment = [
    {
      covers: ["causal-roadmap", "intercurrent-events"],
      q: "A randomized trial compares a device with medical therapy; 15% of control patients cross over to the device before the 12-month endpoint. (a) Which estimand does comparing 12-month outcomes by randomized arm target? (b) Which does a Kaplan–Meier analysis that censors controls at crossover target, and what does it assume? (c) Which of the two is identified by randomization alone?",
      a: "(a) The treatment-policy effect: outcomes whatever happened after randomization, crossover included. (b) A hypothetical strategy, survival had nobody crossed over; it assumes censoring at crossover is non-informative given the measured factors, which fails when sicker patients cross over more often. (c) The treatment-policy comparison.",
    },
    {
      covers: ["target-trial", "clone-censor-weight"],
      q: "A registry study calls a patient “treated” if implanted within 12 months of eligibility, starts everyone's follow-up at eligibility, and assigns arms by what eventually happened. (a) Name the bias and its direction. (b) State the target trial's strategies and time zero. (c) Which method emulates that trial, what must its weights model, and what should be reported instead of a hazard ratio?",
      a: "(a) Immortal time bias: implanted patients had to survive until the implant, so the device looks protective. (b) “Implant within 12 months” against “no implant”, with time zero at eligibility and a 12-month grace period. (c) Clone, censor, weight: clone everyone into both strategies, censor a clone when the patient deviates, and weight by one over the probability of remaining uncensored from a model of implant timing given prognostic factors (assuming no unmeasured confounding of that decision, and positivity). Report risk at a landmark and RMST, with a bootstrap over patients.",
    },
    {
      covers: ["rct-adjustment", "canonical-gradient"],
      q: "A 1:1 trial of 300 patients adjusts for a baseline covariate with R² = 0.36 by standardization with a robust standard error. (a) About how many unadjusted patients give the same precision? (b) The linear working model is wrong. Is the estimate biased? (c) The endpoint is binary and the analyst reports exp(β̂) from a logistic regression on arm and the covariate. What does it estimate? (d) In the geometry of Build a canonical gradient, what is adjustment doing?",
      a: "(a) n/(1 − R²) = 300/0.64 ≈ 469, about 169 extra patients. (b) No: the propensity is known by design, standardization equals AIPW with that known propensity, so it stays centred on the marginal effect and only precision is lost. (c) A conditional odds ratio, generally farther from 1 than the marginal one (non-collapsibility); standardize the model for the marginal target. (d) Projecting the unadjusted estimator's influence function onto the tangent space of the model with a known propensity, removing a piece that only adds variance.",
    },
    {
      covers: ["scores-from-scratch", "one-step-estimator", "clever-covariate", "four-patients"],
      q: "Target ψ = E[Y(1)] with outcome regression m₁(x) and propensity g(x). (a) Write the efficient influence function. (b) Write the one-step estimator. (c) A patient has A = 1, ĝ(X) = 0.2, Y − m̂₁(X) = 0.5 and m̂₁(X) − ψ̂ = 0.1; compute ϕ̂. (d) State double robustness and one thing it does not guarantee. (e) Why might TMLE be preferred when Y is binary?",
      a: "(a) ϕ = m₁(X) − ψ + A(Y − m₁(X))/g(X). (b) ψ̂ = mean of m̂₁(X) plus mean of A(Y − m̂₁(X))/ĝ(X). (c) 0.1 + 0.5/0.2 = 2.6. (d) The estimate is consistent if either m̂₁ or ĝ is consistent, because the remainder is a product of their errors; it does not guarantee a valid standard error or coverage, and fails when both are wrong. (e) TMLE updates the fitted risks on the logit scale and plugs in, so the estimate is a probability; the one-step can leave [0, 1] when weights are large.",
    },
    {
      covers: ["inference-lab", "standard-errors", "positivity", "capstone"],
      q: "An AIPW analysis with parametric working models reports an influence-function SE of 0.14 and a bootstrap SE (refitting both models) of 0.09. The largest treated weight is 45 and the treated arm's effective sample size is under a third of its size. (a) Which SE do you report, and what does the disagreement suggest? (b) Would cross-fitting settle the disagreement? (c) Name two positivity diagnostics, one response that keeps the ATE and one that changes it. (d) In an end-to-end emulated-trial analysis, list in order the steps that come before the AIPW or TMLE estimate is computed.",
      a: "(a) The bootstrap SE; a clear disagreement warns that the simple fixed-nuisance IF approximation does not describe this estimator well; with parametric working models, misspecification is a leading reason (a conservative IF SE is typical when only the propensity is right), but weak overlap and small samples can also cause it. (b) No: cross-fitting controls overfitting of flexible learners, not the fitting terms of a wrong parametric model. (c) The mirrored propensity plot and the effective sample size per arm (or the largest weight's share). Keeping the ATE: capping weights (biased) or better models with AIPW or TMLE. Changing it: trimming or overlap weights, which target a different population. (d) State the estimand (population, treatment strategies, endpoint, intercurrent events, summary); write the target trial protocol with time zero at eligibility; check positivity and apply the pre-specified response; fit the nuisance models (for example a Super Learner) with cross-fitting.",
    },
    {
      covers: ["sensitivity", "survival-lab", "targeted-survival"],
      q: "An observational study reports a one-year risk ratio of 2.0 (95% CI 1.4 to 2.9) for a rare adverse event, and a conditional hazard ratio of 0.65 for a second, beneficial treatment in a separate survival analysis. (a) Compute both E-values for the risk ratio. (b) A hidden confounder is 3 times as common among the treated and doubles the risk. Can it explain away 2.0? (c) Is the marginal hazard ratio of the second treatment also 0.65 at 5 years? (d) What would you report instead of a hazard ratio for “how many more event-free months within 5 years”, and which nuisance models does a doubly robust estimator need?",
      a: "(a) 2 + √2 ≈ 3.41 for the estimate and 1.4 + √(1.4 × 0.4) ≈ 2.15 for the interval. (b) No: B = 3·2/(3 + 2 − 1) = 1.5, so the worst case is 2.0/1.5 ≈ 1.33; B can never exceed the smaller strength, 2. (c) Not in general: the marginal ratio starts at 0.65 and drifts as the risk sets change composition (0.73 at 5 years in the survival lab), with nobody's own hazard ratio changing. (d) ΔRMST(5), the difference in areas under S₁ and S₀ up to 5 years in the target population; it needs a treatment model, a censoring model and an event-hazard model, and it is consistent if the event model is right, or if the treatment and censoring models are right.",
    },
  ];

  lessons.forEach((l) => Object.assign(l, teach[l.id]));

  const guide = { lessons, elective, schedules, assessment, pending };
  if (typeof module === "object" && module.exports) module.exports = guide;
  else root.CausalGuide = guide;
})(typeof window !== "undefined" ? window : this);
