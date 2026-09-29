/* Teacher's guide data. Written by hand from the lessons themselves: every number and claim below
 * appears in the lesson it describes. Titles, minutes, stages and order come from
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
        "None beyond means, risks and a survival curve. This is the entry point for everyone.",
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
      discuss: [
        "If everyone benefits by exactly the same amount, does the target population matter? What changes when the benefit differs by severity?",
        "Risks of 20% → 10% and 2% → 1% share a risk ratio of 0.5 but not a risk difference. Which would you report to a patient, and which to a regulator?",
        "Survival at 5 years and RMST up to 5 years answer different questions. Name a clinical decision for which each is the right one.",
      ],
      misconceptions: [
        {
          myth: "A better estimator, or more data, can repair unmeasured confounding.",
          fix: "In step 3 two worlds share every observed outcome yet their ATEs differ by κ. Only assumptions or a different design can choose between them.",
        },
        {
          myth: "A zero propensity and an empty cell in the sample are the same problem.",
          fix: "A zero population propensity is a structural absence. A positive propensity can still leave an empty cell in a small sample. The lesson keeps these apart.",
        },
      ],
      activity:
        "Estimand in one sentence. In pairs, write the estimand for a study one of you knows: population, interventions, outcome, horizon, contrast. Swap, and have the partner name one choice that would change the number. Then project step 3, untick exchangeability and slide κ: ask each pair to say, in one sentence, what the observed data cannot tell them.",
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
      discuss: [
        "Why is comparing the patients who finished event-free in each arm not the principal-stratum effect?",
        "Your trial censors control patients at crossover. Which strategy does the resulting Kaplan–Meier curve target, and what assumption does it rest on?",
        "Which of the five strategies would your regulator expect for the primary estimand in your area, and why?",
      ],
      misconceptions: [
        {
          myth: "Censoring at crossover is neutral bookkeeping.",
          fix: "It picks the hypothetical strategy. In step 4 high-risk patients cross over six times as often, so the censored curve reads 82.8% against a hypothetical 79.8% and a treatment-policy 81.3%.",
        },
        {
          myth: "Patients who stayed event-free in each arm form the principal stratum.",
          fix: "Stratum membership is defined by potential outcomes under both arms, and each patient shows only one. Event-free on the device and event-free on medical therapy are different groups of people.",
        },
      ],
      activity:
        "Estimand cards. Give each group a one-paragraph trial description from their own field. The group writes the five-attribute estimand sentence with step 5, then swaps with another group, who must name the intercurrent-event strategy chosen and the assumption it needs.",
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
      discuss: [
        "In a registry you know, which date would serve as time zero? Does it coincide with eligibility and with assignment?",
        "“Include treated patients with a 30-day echo on file” sounds like quality control. Why is it eligibility from the future?",
        "Everyone's clock starts at eligibility, but grace-period deaths are sent to the no-procedure arm. Why does the procedure now look protective?",
      ],
      misconceptions: [
        {
          myth: "Immortal time bias is a small-sample artefact.",
          fix: "Step 3 uses 2,000 simulated patients and still reports a one-year risk difference of −14.3 percentage points against a true 0. Changing the seed changes the noise; the bias stays.",
        },
        {
          myth: "Starting every clock at eligibility solves the problem completely.",
          fix: "With a grace period, patients who die untreated inside the window are compatible with both strategies. Forcing them into one arm still gives −7.4 percentage points against a truth of 0.",
        },
      ],
      activity:
        "Protocol table. Groups fill the eight-row target trial table for a published registry study, or for the lesson's valve example, and mark every row where the emulation could be misaligned. Before opening step 3, each group sketches on paper the treated and untreated survival curves they expect under choice (b).",
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
      discuss: [
        "The Operate clones cut at the end of the grace window: are they frailer, more robust, or no different from the whole cohort? What does that do to unweighted curves?",
        "If the decision model leaves frailty out, where do the weighted curves land, and why?",
        "Why bootstrap patients, not clones, to get a confidence interval?",
      ],
      misconceptions: [
        {
          myth: "Kaplan–Meier handles censoring, so the clone curves need no weights.",
          fix: "Artificial censoring is caused by treatment decisions that follow prognosis. Unweighted, the risk difference is −0.372 against a truth of −0.159.",
        },
        {
          myth: "One weighted analysis that lands near the truth shows the method works.",
          fix: "One registry cannot tell. The lesson repeats the whole study on 200 registries: the weighted average sits within two Monte Carlo standard errors of the truth, and weighting pays for it with a larger SD.",
        },
      ],
      activity:
        "One patient by hand. A waiting patient has a modelled chance of 0.2 of being operated at each monthly decision. Compute the weight of their No procedure clone after one, two and three decisions (1/0.8, 1/0.8², 1/0.8³). Then ask: which patients in the lesson end up with the largest weights, and whom are they standing in for?",
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
      discuss: [
        "Does adjustment change the question the trial answers? What would change it?",
        "Each severity stratum has an odds ratio of 3.0, yet the whole-population odds ratio is 2.18 with no confounding anywhere. Which one does your analysis plan promise?",
        "With 1:3 allocation and a benefit that varies with X, the ANCOVA model-based interval covers 88.2% of the time. Why does 1:1 allocation protect it, and what should you report instead?",
      ],
      misconceptions: [
        {
          myth: "Adjusting with a wrong model biases the treatment effect.",
          fix: "In a randomized trial the propensity is known. Standardization is AIPW with that propensity, so a wrong model costs precision, not validity: the curved-truth estimates average 14.8 m against a true 15 m.",
        },
        {
          myth: "The adjusted odds ratio from logistic regression estimates the same thing as the unadjusted one, only more precisely.",
          fix: "The logistic coefficient targets the conditional odds ratio. Standardizing the same model recovers the marginal target.",
        },
      ],
      activity:
        "Power trade. Each group takes a trial size and a plausible R² for one baseline covariate in their area, computes the equivalent unadjusted size n/(1 − R²), and drafts the covariate-adjustment clause of an analysis plan: prespecified covariates, few relative to the sample size, a standard error valid under misspecification.",
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
        anchor: "scores-from-scratch-topic-6",
        label: "Why it's called influence: the mean as a seesaw",
        ask: [
          "Before the extra patient lands: which way will the beam tip, and which way will the balance point slide?",
          "Move the patient further out. How does the slide change? What is the slide per unit of mass?",
          "Put the patient exactly on the balance point. What happens, and what does that say about ϕ there?",
        ],
      },
      discuss: [
        "Why must ∫ h p = 0 for every allowed direction? What would break otherwise?",
        "A treated patient sits where treatment is rare (probability 0.2) versus common (0.8). Why does the first pull the ATE four times as hard through its own regression?",
        "In what sense is the path whose score is ϕ the hardest one-dimensional problem inside the model?",
      ],
      misconceptions: [
        {
          myth: "An influence function belongs to the estimator you choose.",
          fix: "For the mean, ϕ(z) = z − ψ appears with no estimator in sight. It is a property of the parameter, and in the nonparametric model it is unique.",
        },
        {
          myth: "Point-mass contamination is always a legitimate path.",
          fix: "For continuous observations it is a formal derivative device, not a regular path with an L² score. The lesson says so and points to the finite-probability laboratory for a fully regular construction.",
        },
      ],
      activity:
        "Human seesaw. Place students along a taped number line at invented outcome values and find the balance point. Add one more person at several positions and record how far the mean moves; multiply each move by the new group size. Plot the results against position: the points line up on z − ψ.",
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
      background: "Scores and Influence, From Scratch, scene 5.",
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
      discuss: [
        "Why is ψ(Pε) exactly a straight line in ε for this path?",
        "Which candidate g can be added to ϕ without changing the slope in any direction, and what removes it?",
        "In a smaller model more candidates pass the test. What picks the efficient one? (Lesson 10's projection.)",
      ],
      misconceptions: [
        {
          myth: "Centering z at ψ is a trick that changes the answer.",
          fix: "The slope is the same for every c, because ∫ h p = 0 exactly. Centering only chooses the mean-zero representative.",
        },
        {
          myth: "Several different functions could serve as the mean's influence function in the nonparametric model.",
          fix: "For any non-constant g, the direction h = g − E[g] detects it, since there ∫ g h p = Var(g). Only constants pass, and mean-zero centering removes them.",
        },
      ],
      activity:
        "Two-bin board work. Outcomes 0 and 2, each with probability ½. A path moves ε of mass from the first to the second. Compute dψ/dε directly (it is 2). Then find the score h of this path, check that it has mean zero, and confirm E[ϕh] gives the same 2.",
      r: null,
      readings: [],
      readingsNote:
        "This lesson has no Further reading line of its own. It is the slow-motion version of scene 5 of Scores and Influence, whose sources (Tsiatis; Schuler and van der Laan; Hines et al. 2022) apply.",
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
      discuss: [
        "For a finite sum the exchange is exact. What extra condition does an integral need? (The lesson names an integrable dominating function.)",
        "The table's row sums sit about 0.012 below the fine-grid mean 0.4978. Is that a failure of the rule? (No: it is tail mass beyond ±3.5.)",
      ],
      misconceptions: [
        {
          myth: "Differentiating under the integral always needs heavy analysis.",
          fix: "Here each cell is a straight line in ε, so the derivative is read off as a coefficient. For other functionals the per-cell derivative is a genuine limit, with a remainder that is second order in ε.",
        },
        {
          myth: "The running sum should rise steadily to its final value.",
          fix: "The per-bin terms have both signs. The lesson's last prediction shows the running sum climbing past its final value and then coming back down.",
        },
      ],
      activity:
        "Spreadsheet table. Build a small (ε, z) table with your own p, h (mean zero under p) and z. Compute the slope Way A and Way B side by side and confirm they agree to rounding.",
      r: null,
      readings: [],
      readingsNote:
        "This optional aside has no Further reading line. Its sources are those of Scores and Influence.",
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
          "Watch D drop onto the allowed direction. What happens to E[D²]? Can it go up?",
          "What is the inner product between D* and the discarded piece, and why must it be zero?",
        ],
      },
      discuss: [
        "A direction can change the distribution while leaving the mean unchanged. What is such a direction called, and why does it matter?",
        "Knowing the propensity in a randomized trial restricts the model. Why does the ATE bound stay the same, while adjusting the difference in means still gains precision?",
        "Translate “let D* be the canonical gradient” into plain words.",
      ],
      misconceptions: [
        {
          myth: "Knowing more about the model always lowers the bound.",
          fix: "It can leave the bound unchanged when the removed directions were already orthogonal to the gradient.",
        },
        {
          myth: "The rotatable 3D picture means statistical models are three dimensional.",
          fix: "The picture establishes exact identities in a finite model. Extending them uses closed linear spans in L²(P) and regularity conditions.",
        },
      ],
      activity:
        "Three-outcome worksheet. Choose probabilities for −1, 0 and 2. Compute the mean, pick two directions v with zero sum, compute the scores v/p and the slopes of the mean. Then propose three sensitivities and test them against both directions, as step 3 does.",
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
      discuss: [
        "In which of the four repeated-sample panels is AIPW centred away from the truth? (Only when both models are wrong: bias 0.648.)",
        "Centred is not covered. Why does the propensity-only panel over-cover, and the outcome-only panel cover about 92%?",
        "Halve the nuisance error: the plug-in bias halves and the remainder quarters. Why does that asymmetry matter for inference?",
      ],
      misconceptions: [
        {
          myth: "A correction of zero means the outcome model is right.",
          fix: "At λ = 0, κ = 0 the linear model's correction is zero by the OLS normal equations, even though the model omits X² and A×X.",
        },
        {
          myth: "Double robustness guarantees a correct interval when one model is right.",
          fix: "It concerns the point estimate. In the default run the propensity-only panel's IF SE averages 0.142 while the estimates spread with SD 0.096.",
        },
      ],
      activity:
        "Stick by stick. Project the anatomy figure. Pause after each group of patients and ask the room to predict the next column before revealing it. Finish by writing the formula on the board with each term coloured as in the figure's legend.",
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
        "Explain why half of ψ rests on 5 treated old patients, and why the fit should move in proportion to 1/π.",
        "Use the budget plane: payoff is linear in the shift, cost is quadratic times the count, and the best move lies on the ray δO = 9δY.",
        "Compute ε̂ = ΣHr / ΣH² and see it equal the one-step correction here; separate a population positivity failure from an empty sample cell.",
      ],
      figure: {
        name: "budget-plane",
        anchor: "two-strata-topic-2",
        label: "The budget plane",
        ask: [
          "You have a fixed likelihood budget. How should you split it between the young and the old curve?",
          "Play grows the budget. Does the tangent point change direction as the ellipse swells?",
          "Why is the ellipse squashed hard in the δY direction?",
        ],
      },
      discuss: [
        "Why do 45 squares of side ⅓ cost the same as 5 squares of side 1?",
        "Suppose only one treated old patient is left. What weight does that patient carry, and what happens at zero?",
        "Population positivity fails when g(old) = 0; an empty sample cell has g(old) > 0. Which one can more data fix?",
      ],
      misconceptions: [
        {
          myth: "The correction should be spread evenly across strata.",
          fix: "Per unit of likelihood, a shift moves ψ most where treated people are rare. The efficient split is the ray δ ∝ 1/π.",
        },
        {
          myth: "An empty treated cell in the sample means the effect is not identified.",
          fix: "If g(old) > 0 it is identified in the population. The sample simply carries no treated evidence there, so any estimate comes from the model's extrapolation.",
        },
      ],
      activity:
        "Graph paper. Draw the cost ellipse 45δY² + 5δO² = 45 and several payoff lines 0.5δY + 0.5δO = c. Find the tangent point by hand and check that it lies on δO = 9δY. Then repeat for a different budget.",
      r: null,
      readings: [vdlRubin, schulerRose, petersen],
    },
    {
      id: "clever-covariate",
      background:
        "Two strata and the 1/π direction. Maximum likelihood and logistic regression.",
      goals: [
        "Explain why the influence function is centered and why it is the steepest direction for ψ among directions of equal size (Cauchy–Schwarz).",
        "Fit ε along ϕ by maximum likelihood, see the score equation Pₙϕ = 0, and identify H = A/π − (1 − A)/(1 − π) as the clever covariate for the ATE.",
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
      discuss: [
        "The one-step estimate of a treated risk comes out at 1.41. How can an estimate of a probability exceed 1, and how does the logistic TMLE avoid it?",
        "“Least favorable” and “steepest” are the same fact from two sides. Explain.",
        "Where does the fluctuation pull the regression hardest, and why is that the pseudopopulation arriving as a consequence?",
      ],
      misconceptions: [
        {
          myth: "TMLE and the one-step always give the same number.",
          fix: "For the mean they coincide. For nonlinear parameters they differ by a second-order amount; in scene 5 TMLE gives 0.560 while the one-step gives 1.283, which is not a possible risk difference.",
        },
        {
          myth: "Matching the influence function at ε = 0 guarantees one likelihood fit solves the updated equation for any parameter.",
          fix: "That holds for the mean tilt shown. In general, iterated locally least-favorable submodels or a valid universal construction may be needed.",
        },
      ],
      activity:
        "Rank the pull. Compute H for four patient types: treated with π = 0.1, treated with π = 0.9, control with π = 0.1, control with π = 0.9. Rank them by how hard their residual pulls ε̂, then check the ranking against the stick widths in the figure.",
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
        "Show that tilting the conditional density of Y by exp(εH(y − μ̂)) has score H(y − μ̂) and, for a Gaussian working model, mean μ̂ + εH.",
        "See Pₙ as a probability measure and the one-step correction as (Pₙ − P̂)D̂, which estimates (P − P̂)D̂ with sampling error of order 1/√n.",
      ],
      figure: {
        name: "Tilt the density of Y",
        anchor: "one-move-two-faces-topic-0",
        label: "Tilt the density, and the regression line moves",
        ask: [
          "At π(old) = 0.1 and π(young) = 0.9, how far does the old mean move compared with the young? (9 times as far.)",
          "The tilted mean is computed by numerical integration, not by formula. What does its agreement with μ̂ + εH check?",
        ],
      },
      discuss: [
        "Why is the average of D̂ under the fit P̂ exactly zero?",
        "Press New sample a few times. What is the jitter of PₙD̂ around PD̂, and which number reports its size?",
      ],
      misconceptions: [
        {
          myth: "The regression fluctuation μ̂ + εH is an arbitrary modelling choice.",
          fix: "For a Gaussian working model it is derived: the exponential tilt of the density along the outcome part of the influence function is a location shift by εH.",
        },
        {
          myth: "The one-step correction measures the plug-in's bias exactly.",
          fix: "It estimates the negative of the plug-in bias, with sampling noise (Pₙ − P)D̂ that shrinks like 1/√n.",
        },
      ],
      activity:
        "Complete the square at the board. Tilt a Gaussian with mean 1 and variance 2 by exp(εH(y − 1)) with ε = 0.1 and H = 2, and find the new mean (1 + εHσ² = 1.4). Then ask what changes if the variance is 1.",
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
        "Compute sd(D̂)/√n and a 95% interval, and say why a normal interval from four patients is not trustworthy.",
      ],
      figure: {
        name: "Your four sticks",
        anchor: "four-patients-topic-0",
        label: "The influence function of E[Y(1)], one patient at a time",
        ask: [
          "Untreated patients have H = 0. What is their stick, whatever their Y?",
          "Before typing, predict the sign of each treated patient's stick from Y − μ̂₁(X).",
          "A wrong entry draws a wrong stick. What would a sign error do to the one-step estimate?",
        ],
      },
      discuss: [
        "One treated young patient (H = 1.25) and one treated old patient (H = 4). Whose residual pulls ε̂ harder?",
        "Will the TMLE equal the one-step here? Why not, unlike in the two-strata lesson?",
        "The same four numbers D̂(Zᵢ) do three jobs. Name them.",
      ],
      misconceptions: [
        {
          myth: "Untreated patients drop out of the influence function entirely.",
          fix: "They contribute the X-piece μ̂₁(Xᵢ) − ψ̂. Only their outcome piece is zero, because H = 0.",
        },
        {
          myth: "Exact arithmetic makes a four-patient 95% interval trustworthy.",
          fix: "The sd is itself very noisy with four patients, and a t-quantile with 3 degrees of freedom would be 3.18, not 1.96.",
        },
      ],
      activity:
        "Paper first. Groups complete Part 1 on paper before touching the page, then type their values and see whose sticks match. Press New numbers for a second round and swap roles: one student computes, one checks.",
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
      discuss: [
        "Why is the efficient influence function the gradient taken in the tangent space?",
        "Use the rectangle: what happens to the remainder if one nuisance is exactly right? If both errors are exactly n^−1/4?",
        "TMLE walks through the model; the one-step jumps in ψ. When does it matter that the estimate stays inside the parameter space?",
      ],
      misconceptions: [
        {
          myth: "Asymptotic linearity guarantees valid intervals.",
          fix: "The plug-in is asymptotically linear around 2.64. Its intervals shrink around the wrong number and coverage falls as n grows.",
        },
        {
          myth: "Two nuisance errors of order n^−1/4 are enough for efficient inference.",
          fix: "Their product is then of the same order as the sampling error. Efficient inference needs a negligible product or a sharper argument.",
        },
      ],
      activity:
        "Tell the story. Assign one scene to each of eight small groups. Each group has three minutes to explain its picture to the class, using only the scene's “In one sentence” box as notes, in order, so that the room tells the whole story end to end.",
      r: null,
      readings: [
        {
          t: "Schuler and van der Laan, Introduction to Modern Causal Inference, chapters 3 and 4 (the geometry follows it)",
        },
        {
          t: "Tsiatis, Semiparametric Theory and Missing Data (the projection picture)",
        },
        {
          t: "Chernozhukov et al. (2018), and Kennedy's notes, for the Cauchy–Schwarz bound behind the rectangle",
        },
      ],
      readingsNote:
        "The lesson ends with an attribution line rather than linked readings; these are the works it names.",
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
      discuss: [
        "Without cross-fitting the IF SE is about half the real spread. Which term in the three-term error is responsible?",
        "Cross-fitting brings coverage back near 95% but does not buy efficiency here. Why not?",
        "Name problems cross-fitting cannot fix. (The lesson lists a persistently wrong model, weak overlap, unmeasured confounding and a remainder that fails to vanish.)",
      ],
      misconceptions: [
        {
          myth: "Zero training residuals mean an excellent fit.",
          fix: "A learner that memorises training outcomes has zero training error and says nothing about a new patient.",
        },
        {
          myth: "Cross-fitting corrects a wrong model.",
          fix: "It controls the empirical-process term. Consistency of the nuisance fits and a vanishing remainder are still needed.",
        },
      ],
      activity:
        "Two folds in the room. Split the class in half. Each half fits a simple rule on its own outcomes (the arm means, say) and predicts the other half. Compare the residuals on your own fold with the held-out residuals, and connect the gap to the SE in the figure.",
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
        "Say what a standard error estimates (the SD of the estimate over repeated studies) and compute the influence-function SE, sd(φ̂)/√n.",
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
      discuss: [
        "Three nuisance fits give nearly the same estimate but different IF SEs. What is the formula reading, if not the spread of the estimator?",
        "Why does estimating a correctly specified propensity make AIPW less variable than plugging in the true one?",
        "The IF SE and the bootstrap SE disagree clearly. What does that tell you, and which do you report?",
      ],
      misconceptions: [
        {
          myth: "The IF SE is always valid for AIPW.",
          fix: "In the lesson's four cases its intervals cover 99.8% of the time when only the propensity is right and 93.3% when only the outcome model is right.",
        },
        {
          myth: "A correct standard error gives a correct interval.",
          fix: "When both models are wrong every SE matches the spread, and coverage is still 0%: the estimate is centred at 2.64, not 2.",
        },
      ],
      activity:
        "Analysis-plan clinic. Each group adapts the lesson's sample sentence to a study they know: the working models, the bootstrap scheme (patients resampled, both models refitted), what happens when a resample cannot be fitted, and the IF SE as a sensitivity analysis.",
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
      discuss: [
        "At β = 4, 163 patients are treated. How many equally weighted patients is the treated arm worth?",
        "At β = 3 you trim patients with ĝ outside [0.1, 0.9], and the effect grows with severity, τ(x) = 2 + x. What does the trimmed analysis estimate?",
        "Both cohorts use β = 2; in one, nobody above severity 1.5 is ever treated. With ten times more patients, which IPW bias shrinks?",
      ],
      misconceptions: [
        {
          myth: "AIPW is immune to thin overlap because it is doubly robust.",
          fix: "With a correct outcome model it stays centred, but at β = 4 its SD is 4.7 times its no-separation value (IPW's is 8.3 times).",
        },
        {
          myth: "Trimming and overlap weights are ways to stabilise the ATE.",
          fix: "They change the population, so they change the estimand. Capping keeps the estimand and makes the estimator biased for it.",
        },
      ],
      activity:
        "Effective sample size by hand. A treated arm has 10 patients with weight 2 and one with weight 8. Compute (Σw)²/Σw² (it is 784/104, about 7.54). Discuss: eleven patients behave like seven and a half. Then draft the trigger sentence for an analysis plan using step 6.",
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
          "Why is B always smaller than both strengths?",
        ],
      },
      discuss: [
        "This study's interval has an E-value of about 1.8. What does that mean, and what does it not mean?",
        "Severity, the strongest measured confounder, could pull the interval to 1 but not erase the estimate. Is a confounder that strong plausibly left over? Whose judgement is that?",
        "A protective drug has RR 0.5. What is its E-value, and why is it the same as for RR 2?",
      ],
      misconceptions: [
        {
          myth: "An E-value is a probability, or odds, that the effect is real.",
          fix: "It is a strength of association a confounder would need. It is not a probability, not a test, and not proof of causation.",
        },
        {
          myth: "Two strengths of 2 multiply to 4, so together they could explain away RR 1.50.",
          fix: "The bias factor is 2·2/(2 + 2 − 1) = 4/3, less than 1.50. The estimate survives, though the interval could now include 1.",
        },
      ],
      activity:
        "Journal club E-values. Each student brings one published observational risk ratio with its interval, computes both E-values with the lesson's calculator, and names the strongest measured confounder in that paper as a benchmark. The group decides which results survive a confounder of that strength.",
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
        anchor: "step-2",
        label: "Kaplan–Meier, told as moving mass",
        ask: [
          "When a patient is censored and their mass is handed to the right, what happens to Ŝ(t)? (It does not move.)",
          "Who are the heirs of a dropout, and what does choosing them assume?",
          "At the end, tap a survivor. Where does its weight 1/Ĝ(t−) come from?",
        ],
      },
      discuss: [
        "Treated patients are 52% high severity and the cohort is 35%, yet pooled KM behaves like w = 0.41. Why neither number?",
        "The conditional hazard ratio is 0.65 at every severity level, but the marginal one is 0.73 at 5 years. Whose hazard ratio changed?",
        "Is a low censoring rate evidence that censoring is independent?",
      ],
      misconceptions: [
        {
          myth: "Censoring pulls the Kaplan–Meier curve down.",
          fix: "At a censoring nothing falls. The patient's mass is shared among those still at risk, which is exactly how KM assumes that whoever left was like everyone who stayed.",
        },
        {
          myth: "A Cox coefficient is a marginal survival contrast.",
          fix: "β targets a conditional log hazard ratio under proportional hazards. It is not automatically a survival difference or an RMST difference.",
        },
      ],
      activity:
        "Moving mass with coins. Line up ten students in order of follow-up time, each holding the same number of coins. At an event a student leaves with their coins; at a censoring the student shares their coins equally with everyone to their right. Track the coins still on the line and compare with the product-limit Kaplan–Meier computed on the board.",
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
          "Play turns the censoring weight on, from κ = 0 to κ = 1. Which pieces grow?",
          "Switch the event model to one that ignores severity. What happens to every orange piece, and who has to do the work?",
        ],
      },
      discuss: [
        "The unadjusted KM difference in RMST has the wrong sign. Why?",
        "Healthier patients drop out faster. Where does plain KM end at 8 years compared with the truth, and what do “same severity” heirs change?",
        "The band is pointwise, not simultaneous. What claim can and cannot be read off it?",
      ],
      misconceptions: [
        {
          myth: "An adjusted Cox hazard ratio answers “how many more event-free months”.",
          fix: "The adjusted hazard ratio is a conditional, model-based summary. In this world the effect on the hazard differs by severity, so no single conditional hazard ratio exists. ΔRMST names a population, a horizon and a unit.",
        },
        {
          myth: "If any nuisance model is wrong, the one-step estimate is biased.",
          fix: "With the event model wrong but the censoring and treatment models right, the one-step stays centred on the truth. The simple IF standard error need not be exact in that case.",
        },
      ],
      activity:
        "Write the result. Using the numbers on their own screen at step 5, groups write the sentence “Over the first 12 months, treating everyone rather than no one adds … event-free months per patient (95% CI …)”, then list every assumption the interval rests on.",
      r: {
        file: "km-vs-standardized.R",
        note: "The survival-lab script, which the R examples list for this lesson too.",
      },
      rInline:
        "The lesson also includes a 31-line base R script for the one-step S₁(τ) with an influence-function SE.",
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
        { week: 3, theme: "Back to survival", units: ["survival-lab", "targeted-survival"] },
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
        { week: 4, theme: "One step and the 1/π budget", units: ["one-step-estimator", "two-strata"] },
        { week: 4, theme: "Targeting by hand", units: ["clever-covariate", "one-move-two-faces", "four-patients"] },
        { week: 5, theme: "The story and its promises", units: ["efficiency-theory-story", "inference-lab"] },
        { week: 5, theme: "Standard errors you can report", units: ["standard-errors"] },
        { week: 6, theme: "Overlap and sensitivity", units: ["positivity", "sensitivity"] },
        { week: 6, theme: "Survival, targeted", units: ["survival-lab", "targeted-survival"] },
      ],
    },
  ];

  const guide = { lessons, elective, schedules };
  if (typeof module === "object" && module.exports) module.exports = guide;
  else root.CausalGuide = guide;
})(typeof window !== "undefined" ? window : this);
