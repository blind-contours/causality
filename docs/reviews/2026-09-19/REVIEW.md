# Causality review — September 19, 2026

**Recommendation: build the course around a continuous causal investigation, with a mathematically faithful geometry laboratory at its center.** The existing package contains useful material for that laboratory. Its strongest ideas are moving probability mass, making integrals into arithmetic, contrasting population weights with observed evidence, and calculating residual corrections patient by patient. Preserve these.

The main work is curriculum sequencing, mathematical validation, and asking learners to construct explanations. More animations alone will not resolve the current gaps. The desired outcome is that someone encountering “canonical gradient” in a paper can reconstruct what problem it solves, which space it belongs to, and how it connects to their data analysis.

This is a review and implementation proposal, not a product rewrite. The lessons were not changed. Reviewed revision: `6e4df22`. Findings below distinguish observed behavior, mathematical analysis, and proposed designs.

**What I inspected.** All nine lessons, the hub, glossary, registry, progress logic, styles, numerical routines, and animation scaffolds. I opened all 11 pages in Chrome at 1440 × 1000 and 390 × 844, checked selected interactions, and inspected screenshots. There were no page-load JavaScript exceptions in those checks. Browser checks used reduced motion and do not establish full animation, keyboard, assistive-technology, or cross-browser compatibility. I also ran the actual Unit 1 estimation functions with a seeded generator for 1,500 replications per configuration at n = 2,000. The [numerical script](numerical-checks.cjs), [numerical results](evidence/numerical.json), and [browser findings](evidence/browser.json) are retained.

The current course has **44 canvas scenes, seven prediction cards, two worked tables, and 144 advertised minutes**. Units 2 and 9 each contain nine scenes. The default entry point is the one-step estimator; causal questions and identification are listed as future chapters. These facts explain much of the distance between the present prototype and the intended audience.

**1. Preserve the strongest material, but change where learners encounter it.**

| Existing material | What it does well | Recommended role |
|---|---|---|
| Unit 3, moving masses in fixed bins | Makes an expectation and its derivative concrete | Early core lesson, before general EIF terminology |
| Unit 4, sums of cell slopes | Gives a useful finite calculation behind differentiation | Optional mathematical bridge; qualify the passage to integrals |
| Unit 6, two strata | Connects the target population to inverse-propensity weighting | First causal EIF derivation, after identification |
| Unit 8, four patients | Requires the learner to produce an answer | Bring a small version forward; retain a later independent challenge |
| Unit 5, density tilt and regression shift | Connects two representations that otherwise seem unrelated | Bridge into targeting, after fixing the numerical integration |
| Units 2 and 9, geometry | Supplies the beginnings of a connected visual language | Break into shorter lessons with an explicit map between spaces |
| Static deployment and local progress | Low operational burden and no account barrier | Preserve while separating reusable code |

The desktop visual style is already restrained and readable. [Desktop example](evidence/desktop-09-efficiency-theory-story.png). Keep the typography, whitespace, direct readouts, and learner-controlled playback. Replace the insider framing “What to say when Alec asks” with an explanation the learner can give to a colleague. Avoid making memorized technical fluency the objective.

**2. Correct the mathematical claims before expanding the curriculum.**

The priorities below concern what a learner may carry away, not merely notation preferences.

| Priority | Finding and source location | Correction and better teaching opportunity |
|---|---|---|
| P1 | Unit 9, scene 4, lines 113–123: knowing the propensity in an RCT is said to produce a smaller efficiency bound | For the usual population ATE, at the same observed-data law, restricting the propensity to be known leaves the EIF and bound unchanged. Teach this as a counterexample to “removing any direction improves precision.” |
| P1 | Unit 1, lines 118–140, and Unit 9, scene 9: bias correction is presented as automatically efficient, with no variance cost | Separate consistency, asymptotic normality, and efficiency. The implemented outcome fit remains misspecified, and the simulations do not attain the bound. |
| P1 | Unit 9, scene 6, line 143 and drawing code around 382–394: the derivative toward truth is labeled `−P D̂` | For the stated path from P̂ to P, it is `+P D̂`. The first-order component of plug-in error is its negative. Unit 1 already uses the correct sign. |
| P1 | Units 1 and 9: two nuisance rates exactly n⁻¹/⁴ are described as sufficient for the usual efficient centered limit | Show a remainder negligible relative to n⁻¹/², not merely the same order. Add a rate-boundary experiment and the empirical-process conditions. |
| P1 | Unit 6, scene 7, lines 157–175: a zero observed treated count is equated with structural nonidentification | Separate a population propensity of zero from an empty cell in one finite sample. Give each its own control and interpretation. |
| P1 | Unit 5, lines 125–136: numerical integration does not cover the allowed shifted distributions | At ε = 0.4, π(old) = 0.05, the formula gives 9.000 but the numerical mean is 7.483. Integrate over an adequate domain and report truncation error. |
| P1 | Unit 9, line 460: plug-in coverage uses the one-step estimator's standard error | Compute an appropriate variance estimate for each displayed estimator, or explicitly identify the comparison as using an imposed common interval width. |
| P2 | Units 6–7: Gaussian fluctuation and local score arguments are generalized too broadly | Explain the conditions behind exact one-step/TMLE equality and distinguish a locally least-favorable path from a universal one. |
| P2 | Units 2 and 9, plus glossary: probability distributions, score functions, tangent vectors, and efficient gradients are sometimes conflated | Introduce separate, linked views with declared coordinates and metrics. Give the canonical gradient a precise definition. |
| P2 | Unit 4: independence of the axes and linearity are said to suffice for differentiation under an integral | Finite sums justify the displayed arithmetic; infinite integrals require interchange conditions. Add an optional controlled counterexample. |

Source files: [Unit 1](../../../lessons/01-one-step-estimator.html), [Unit 2](../../../lessons/02-scores-from-scratch.html), [Unit 4](../../../lessons/04-under-the-integral.html), [Unit 5](../../../lessons/05-one-move-two-faces.html), [Unit 6](../../../lessons/06-two-strata.html), [Unit 7](../../../lessons/07-clever-covariate.html), [Unit 9](../../../lessons/09-efficiency-theory-story.html), [glossary](../../../glossary.html).

**Why the RCT statement matters.** The ATE EIF is

\[
D^*(O)=\mu_1(X)-\mu_0(X)-\psi
 +\left\{\frac A{g(X)}-\frac{1-A}{1-g(X)}\right\}\{Y-\mu_A(X)\}.
\]

Its inner product with a treatment-mechanism score is zero: the residual has conditional mean zero given A,X, and the remaining X-only term pairs with a score whose mean given X is zero. The EIF already lies in the smaller tangent space with known treatment mechanism. Its projection therefore does not change. This comparison holds the law fixed; changing the actual treatment allocation can change the bound. The contrast with ATT is also instructive. See [Hahn's original paper](https://doi.org/10.2307/2998560).

**What the simulation actually establishes.** The generator contains X² and A×X; `ols()` fits only 1, X, A. Setting λ = 0 removes shrinkage but does not make that outcome model correct. With κ = 0 and λ = 0, the correction is exactly zero by the OLS normal equations. A favorable ATE here is not a clean demonstration of the “correct outcome model” branch of double robustness; the symmetric generator also matters.

The seeded review run produced:

| n = 2,000; 1,500 replications | Plug-in bias | One-step bias | Plug-in SD | One-step SD | Efficient SE |
|---|---:|---:|---:|---:|---:|
| λ = 0, κ = 0 | 0.0017 | 0.0017 | 0.0533 | 0.0533 | 0.0423 |
| λ = 0.5, κ = 1 | −1.0009 | −0.0023 | 0.0260 | 0.0600 | 0.0423 |
| λ = 1, κ = 1 | −2.0000 | −0.0025 | 0.0000 | 0.0766 | 0.0423 |

These are Monte Carlo results, not proofs. They expose a mismatch with the prose. At λ = 0.5, κ = 1 the SD ratio is 1.416; at λ = 1, 1.809. At λ = 1 the plug-in is identically zero, so correcting it necessarily increases variance. Efficiency is a comparison within an appropriate class of regular estimators, not a promise to beat the variance of a biased constant.

Build four explicit presets: both nuisances correct; only outcome correct; only propensity correct; both wrong. Include oracle nuisances as a reference and distinguish them from fitted nuisances. Add a deliberately asymmetric data generator so accidental cancellation does not stand in for robustness. Display bias, SD, RMSE, estimated SE, coverage, and Monte Carlo uncertainty. At 95% coverage, 300 replications give a Monte Carlo SE of about 1.3 percentage points.

**Make the remainder and rate conditions visible.** Under the convention already used in the glossary,

\[
\Psi(\widehat P)-\Psi(P_0)=-P_0D^*(\widehat P)+R_2,
\]

the ATE remainder is

\[
R_2=E_0\left[(\widehat g-g_0)
\left\{\frac{\widehat\mu_1-\mu_{1,0}}{\widehat g}
      +\frac{\widehat\mu_0-\mu_{0,0}}{1-\widehat g}\right\}\right].
\]

The single-arm expression currently labeled “ATE remainder” omits the control-arm term. The rectangle is useful as a bound on its magnitude, subject to denominator control; it is not the exact signed remainder. Allow positive and negative errors to show cancellation as well as magnitude.

For the non-cross-fitted one-step notation, display the exact decomposition

\[
\widehat\psi_{OS}-\psi_0
=(P_n-P_0)D^*(P_0)
+(P_n-P_0)\{D^*(\widehat P)-D^*(P_0)\}
+R_2.
\]

Reveal the three pieces in stages: sampling noise, the term involving a learned function, and remaining bias. Cross-fitting controls the second under suitable convergence and moment conditions; it does not eliminate the third. If nuisance errors behave like n⁻ᵅ and n⁻ᵝ, compare √n times their product for α+β below, equal to, and above 1/2. Equality need not vanish. Faster-than-quarter rates are sufficient, not necessary: unequal rates can work. [Kennedy's review](https://arxiv.org/pdf/1709.06418) provides the formal foundation.

**Do not conflate two likelihood ideas.** Unit 6's quadratic `n_s δ_s²` is proportional to a Gaussian likelihood metric or KL cost under a unit-variance working model. It is not the observed change in residual sum of squares from an arbitrary biased fit. That change is `n_s δ_s² − 2δ_s Σr_i`. Distinguish the metric that identifies a direction from the sample residuals that choose the step.

The exact equality of TMLE and one-step in that two-stratum example also uses its empirical propensity/count relationship. Gaussian updating alone is insufficient. The retained numerical check gives a four-person example where the one-step correction is 0.8125 and the targeted plug-in change is 0.4858, while the updated empirical residual score is zero. This is a useful “same estimating goal, different finite-sample answer” exercise.

In Unit 7 the exponential-tilt argument works for the mean. Having score equal to the initial EIF at ε = 0 does not, by itself, prove that one likelihood fit solves the updated EIF equation for an arbitrary parameter. Unit 9's fixed-path/universal-path comparison needs an explicit model and loss. Its current polynomial landscape and vector projection are a geometric analogy; a learner is not shown the statistical model that would make those vectors actual EIFs. Label it as an analogy or instantiate a real finite-dimensional model with computed likelihood. The relevant distinction is developed in [van der Laan and Gruber](https://pmc.ncbi.nlm.nih.gov/articles/PMC4912007/).

**Tighten the geometry without putting all the technicalities on the first screen.**

- A linear tilt needs nonnegative probabilities as well as a mean-zero score. The present bounded grid directions and ε limits keep factors positive; the broader prose should state the restriction. An arbitrary unbounded mean-zero function does not automatically define a valid linear tilt for every small two-sided ε.
- For the square-root embedding, `d√pε/dε|0 = (1/2)h√p`. Unit 9 omits the factor. An embedding at `2√p` has velocity `h√p` and radius 2; choose one convention consistently.
- A tangent space is the closed linear span of allowable scores, in the declared L² metric. Its size means available directions, not the visible width of a drawn plane.
- All gradients satisfying the derivative identity form an affine set `D* + T⊥` within the mean-zero ambient space. A line is a special illustration, not the general dimension.
- A mean-zero gradient reproducing all allowable derivatives is not necessarily unique in a restricted model. The canonical gradient is the unique representative in T.
- The nuisance tangent space consists of allowable directions with zero first-order effect on the target. Orthogonality to this space differs from projecting a candidate gradient onto the full tangent space.
- A point-mass contamination argument is exact and accessible for a discrete distribution. In a continuous dominated model it is not automatically a regular score path. Start discretely, then explain the limiting/formal interpretation; [Hines et al.](https://arxiv.org/html/2107.00681v3) is a useful derivation reference.
- Pₙ is a probability measure, but it need not belong to a model containing only smooth densities. Its empirical average still makes sense. The mean of Pₙ works without claiming that every functional or model accepts it.
- Separate the map Ψ, the truth ψ₀ = Ψ(P₀), and an estimate ψ̂. They are not aliases. Reserve P₀ for truth and P for a generic law. Distinguish a whole-law estimate from a regression estimate when using Q̂.

Unit 2's truncated grid also has mass 0.999637 rather than 1, and its score centering omits division by that mass. Some claimed equalities consequently disagree numerically. Unit 3 uses a different base mixture. Normalize finite-grid models once, use the same quadrature convention throughout, and make approximation error explicit. The larger Unit 5 integration error is visible in this [boundary screenshot](evidence/tilt-boundary.png). Its caption also continues to claim a ninefold movement after the propensity control changes that ratio.

**3. Start the learning journey where the audience already has expertise.**

The opening should respect the learner's existing statistical knowledge. Cox regression itself is semiparametric: a finite-dimensional coefficient accompanies an unspecified baseline hazard. Kaplan–Meier is a valuable nonparametric estimator under its censoring assumptions. These are useful entry points, rather than examples of intrinsically bad methods. See the original papers by [Cox](https://rss.onlinelibrary.wiley.com/doi/10.1111/j.2517-6161.1972.tb00899.x) and [Kaplan and Meier](https://www.tandfonline.com/doi/abs/10.1080/01621459.1958.10501452).

Use one synthetic study throughout: a treatment decision, baseline severity, an outcome by a chosen horizon, and eventual loss to follow-up. Start with a small table before extending to curves. Ask what quantity would answer the substantive question, then compare analyses that answer different questions.

| Stage | Learner's question | Main interaction | Evidence of understanding |
|---|---|---|---|
| 1. Specify the question | “What do we want to know?” | Change population, intervention, comparator, outcome, horizon | Write an estimand in ordinary language and distinguish it from a coefficient |
| 2. Identify it | “Could the observed data answer that?” | Reveal/hide counterfactuals; vary assignment and overlap | Distinguish identification failure from imprecision |
| 3. Connect familiar estimators | “Where do standardization, KM, and Cox fit?” | Compare observed group averages with standardized risks; later inspect risk sets | Explain which question and assumptions make each estimate useful |
| 4. Learn probability geometry | “How can a whole distribution be one point?” | Move probability among three outcomes; link table, bars, and simplex | Predict a target's change under a specified move |
| 5. Discover gradients | “Can one object summarize all small changes?” | Construct score directions; test a candidate gradient | Reproduce a new directional derivative |
| 6. Discover efficiency | “Which valid gradient wastes the least variation?” | Restrict a model, project, compare weighted squared lengths | Explain canonical gradient and nuisance tangent space |
| 7. Construct estimators | “How does this become a data analysis?” | Patient residuals → one-step → targeted regression | Build the correction and explain its sign |
| 8. Justify inference | “When can we trust the uncertainty?” | Repeat samples; compare rate regimes and training/evaluation folds | Distinguish bias, variance, coverage, and efficiency |
| 9. Return to survival | “How does this change my next analysis?” | Censoring and risk-set selection; survival risks and RMST | Choose an estimand and estimator, justify assumptions, interpret limits |

Keep a persistent roadmap: **question → causal target → assumptions → observed-data target → model → estimation → uncertainty → interpretation**. A lesson highlights its current stage and preserves a compact record of the choices made. Identification should include consistency, exchangeability, positivity, and the observation process; a correct EIF cannot repair a failure there. This sequencing follows the separation in [the targeted-learning roadmap](https://onlinelibrary.wiley.com/doi/10.1155/2014/502678).

For the survival bridge, let the learner watch treatment groups' risk sets change over time, then compare a hazard ratio with a fixed-time survival difference and RMST difference. Do not teach that every Cox analysis is invalid or every marginal contrast is automatically causal. Make selection and the question being answered visible. [Hernán's hazard-ratio paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC3653612/) motivates this exercise. Introduce competing events and intercurrent-event strategies after the basic censoring story, rather than all at once.

Provide an optional diagnostic entry route for experienced learners and keep the existing targeting sequence reachable directly. A short motivating preview of bias correction can remain at the beginning; require no EIF notation to understand that preview.

**4. Make “canonical gradient” a discovery with an exact, testable visual.**

The highest-value new lesson is a small laboratory where learners earn the terminology through actions. Proposed starting point:

| Outcome z | −1 | 0 | 2 |
|---|---:|---:|---:|
| Probability p | 0.2 | 0.5 | 0.3 |
| Contribution to mean | −0.2 | 0 | 0.6 |
| Centered outcome D = z − 0.4 | −1.4 | −0.4 | 1.6 |

The mean is 0.4. Each view is computed from this same distribution, not from independently scripted pictures.

| Beat | Learner action | What changes on screen | Name introduced afterward |
|---|---|---|---|
| A | Move 0.02 probability from −1 to 2 | Bars, simplex point, mean: it rises by 0.06 | Distribution and parameter |
| B | Choose a small continuous move | A trace through valid probability vectors | Path/submodel |
| C | Compare probability velocity with velocity divided by current probability | A score bar for each outcome; weighted sum stays zero | Score |
| D | Make a move that preserves the mean | Nonzero movement with zero target slope | Nuisance direction |
| E | Guess three numbers that predict every tested slope | Weighted products accumulate; a hidden direction tests the guess | Gradient |
| F | Lock the middle probability to 0.5 | Only one independent direction remains | Restricted model and tangent space |
| G | Remove the part of a valid gradient irrelevant to permitted directions | Same slopes, shorter weighted length | Canonical gradient / EIF |
| H | Repeatedly draw samples | Centered contributions become the estimator's sampling error | Influence function and variance bound |

There is an exact reference answer for beat G. With `h = (−1, 0, 2/3)`, the weighted mean of h is zero, its squared norm is 1/3, and `E[D h] = 0.6`. The projection onto the restricted tangent line is

\[
D^*_{restricted}=\frac{0.6}{1/3}h=(-1.8,0,1.2).
\]

Its variance is 1.08 instead of 1.24. The discarded component is orthogonal to every allowed direction. The [retained calculation](evidence/numerical.json) verifies these identities. This is a finite-dimensional teaching model; increasing the number of bins prepares the transition to function spaces without pretending a three-dimensional picture literally contains an infinite-dimensional model.

The learner's own construction should precede the formal definition:

> For this model and target, the canonical gradient is the unique mean-zero function inside the tangent space whose inner product with every allowable score gives the target's derivative along that path.

Then distinguish its two uses: sensitivity of a parameter, and first-order error of an appropriately constructed estimator. The second requires a theorem and conditions; it does not follow from drawing an arrow.

**Use rotation for a specific conceptual job.** A three-outcome probability simplex and its square-root image in the positive octant of a sphere are literal finite geometry. A rotatable display can show the radial direction, tangent directions, and orthogonality. Use `√p h` to translate score inner products into Euclidean ones, keeping the factor 1/2 in the actual square-root path velocity. Never represent `E_p[f h]` using an unweighted screen angle without declaring the coordinate transform.

Give every 3D figure a reset camera, labeled axes, preset views along and perpendicular to a plane, a 2D projection, keyboard controls, and numerical checks that stay visible. Rotating the camera changes no probabilities or derivatives. Changing the model can change them. Learners should be asked to distinguish those operations.

**5. Turn demonstrations into a learning cycle.**

Recommended cycle: **predict → manipulate → explain → express mathematically → transfer to a new case → retrieve later**. This is a design proposal grounded in the following research, not a claim that this exact product has been validated.

| Research | Implication for this package | Concrete change |
|---|---|---|
| [Chi & Wylie, ICAP](https://education.asu.edu/sites/g/files/litvpz656/files/lcl/chiwylie2014icap_2.pdf) | Clicking and dragging alone need not elicit constructive reasoning. “Interactive” in the framework is more demanding than an interactive widget. | Ask learners to construct a direction, explain an unexpected result, or repair a false statement. |
| [Mayer & Moreno, cognitive load](https://anenadic.github.io/instructor-training/files/papers/mayer-reduce-cognitive-load-2003.pdf) | Pretraining, segmentation, and placing related information together can reduce avoidable processing demands. | Start with one representation; reveal a linked second view; highlight corresponding quantities when introducing a formula. |
| [Ainsworth, DeFT](https://doi.org/10.1016/j.learninstruc.2006.03.001) | Multiple representations need purposeful roles and support for translating between them. | Selecting a patient contribution highlights its table cell, probability mass, score term, and formula factor. |
| [Fyfe et al., concreteness fading](https://doi.org/10.1007/s10648-014-9249-3) | Moving from concrete examples toward abstract forms is a useful instructional strategy, with context-dependent evidence. | Patient → count → probability → function → vector; let learners restore earlier views. |
| [Roediger & Karpicke, retrieval practice](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/) | Successful immediate viewing is not the same as durable retention. | Revisit a concept later with new numbers and a new context; require retrieval before showing the old explanation. |
| [Tversky, Morrison & Bétrancourt, animation](https://www.tc.columbia.edu/faculty/bt2158/faculty-profile/files/_Morrison_Betrancourt_AnimationCanitfacilitate.pdf) | Motion must match the concept and remain comprehensible. Animation is not automatically better than a static diagram. | Preserve endpoints and trails, allow pausing and replay, and animate the particular dependency the learner is investigating. |
| [PhET work on implicit scaffolding](https://arxiv.org/abs/1306.6544) | Constraints, affordances, and feedback can guide exploration within a well-designed simulation. | Conserve probability automatically, make legal directions visible, and offer an open challenge after the worked example. |

These findings come from settings other than this course's target population. They motivate design choices and evaluation; they do not establish an optimal lesson duration, a universal benefit of 3D, or the effectiveness of a commercial product's mechanics. [Seeing Theory](https://seeing-theory.brown.edu/) is a useful visual reference for direct manipulation and coordinated probability displays, rather than evidence of learning efficacy for this topic.

Current prediction cards are mostly recognition questions; some answers are stated immediately above them. Put a prediction before the revealing explanation. A wrong prediction should start a useful feedback sequence, not merely disable every option. Feedback can point to the violated idea: “You moved probability without removing it elsewhere,” or “You used the number treated as the target-population weight.” Then offer a different case so a correct second response demonstrates more than copying.

Use a worked example, a partially completed example, and an independent example. Unit 8 is a good foundation, but doing its arithmetic is not sufficient evidence of understanding the estimator. Add explanation and transfer questions: “Why does an untreated patient still affect the covariate-distribution component?” and “What changes if the target population changes?”

Offer “guided lesson” and “explore” modes. Guided mode introduces controls incrementally; explore mode retains all useful controls, reset, and shareable state. Treat roughly 4–7 minutes per focused lesson as an initial design hypothesis to test, not a research-derived constant. Let experts skip scaffolding after demonstrating the relevant knowledge.

**6. Repair the product mechanics that currently undermine learning.**

| Observed behavior | Evidence / source | Recommended fix |
|---|---|---|
| Canvas labels become extremely small on a phone | An 800 px canvas renders at 328 CSS px; a 12 px canvas label becomes 4.92 CSS px. [Screenshot](evidence/mobile-03-mean-along-a-path.png) | Reflow charts, keep text in HTML/SVG at readable sizes, reduce simultaneous panels, offer expanded views. Increasing pixel density alone does not fix text size. |
| All 44 canvases lack an accessible name and fallback content | DOM inspection; adjacent prose does not expose every plotted quantity or relation | Provide linked descriptions, equivalent tables and controls, and accessible announcements of meaningful state changes. |
| Four Patients has 28 inputs without associated labels | Browser DOM inspection | Associate row, patient, and quantity with each field; announce validation and support keyboard navigation. |
| Merely viewing the last scene completes Unit 2 | Browser reproduction; `shared/course.js:192–222` | Track exploration and assessed learning separately. Do not call scrolling mastery. |
| “Mark incomplete” immediately marks the unit complete again | Browser reproduction; `shared/course.js:199–212` | Separate explicit learner reset from automatic completion transitions. |
| Showing answers to both Unit 8 tables reports only 1 of 2 checked | `shared/course.js:185` detects the English prefix “Filled in”; the second table uses different text | Emit a structured exercise event. Record revealed answers separately from independent correctness. |
| With λ = 1, the plug-in distribution disappears from the histogram | All plug-in values are zero; Unit 1 bins only 0.6–3.4. [Screenshot](evidence/histogram-lambda-one.png) | Use an appropriate domain or explicit overflow bins; retain a labeled point mass at zero. |
| Unit 5 captions and predictions assume the default ratio after parameters change | Boundary browser check | Derive numerical language from current state; state the baseline setup of a prediction explicitly. |
| Simulation settings can change while old results remain displayed | Unit 1 `R3` and Unit 9 `R9` store only some settings | Save a complete immutable run configuration; show “results for these settings” and a rerun state. |
| The glossary overflows at phone width | Browser check | Reflow symbols into accessible cards or an intentionally scrollable table with a visible cue. |

For accessibility, aim for equivalent access to relationships, not an alt label saying “graph.” A keyboard user should be able to choose a score, change its components, read the resulting derivative, and complete the same challenge. A text/table explanation of the geometry is essential. [W3C's guidance for complex images](https://www.w3.org/WAI/tutorials/images/complex/) is a useful baseline; a full accessibility evaluation remains necessary.

**7. Separate the scientific model, the view, and the teaching state.**

The package is currently a static web course, not a conventional installable package. Its small deployment footprint is an asset. The architecture problem is duplication and coupling: each HTML file owns numerical calculations, plotting helpers, palette definitions, animation state, and prose. `course.js` separately infers learning state from DOM position, CSS classes, and English feedback strings. It has no explicit concept of a prerequisite or demonstrated skill.

Recommended structure, introduced incrementally:

```text
course/
  curriculum                 concept IDs, prerequisites, routes, objectives
  lessons/                   prose, exercises, scene configurations
  notation                   symbol definitions, aliases, spoken descriptions
science/
  distributions              normalized finite laws and valid paths
  geometry                   weighted inner products, projections, derivatives
  causal                     targets, nuisance functions, EIFs, remainders
  estimators                 plug-in, one-step, targeting, variance
  simulation                 seeded generation and repeated experiments
ui/
  scene                      semantic controls, layout, readouts, descriptions
  renderers                  SVG, dense canvas plots, selected 3D views
  playback                   time, camera, pause, step, reset, reduced motion
learning/
  exercises                  assessment rules and misconception feedback
  progress                   attempted, explored, assisted, demonstrated
workers/                     long simulation runs
verification/                mathematical properties and critical user journeys
```

This does not require a framework rewrite. First extract pure numerical functions and shared scene utilities while retaining current page URLs and static hosting. Use ordinary modules and explicit data contracts; add static type checking for state and lesson definitions. A build step becomes useful if it generates a deployable static site and standalone lesson exports from one source. It should support the authoring process rather than impose a server application.

One state object should contain the distribution, target, model restrictions, score direction, fitted nuisances, seed, and current exercise. The renderer consumes computed results. Animation time and camera orientation belong to separate presentation state. An algebraic result must not change merely because a frame was skipped or the camera rotated.

Each scene should declare: learning objective; prerequisites; model and assumptions; manipulable quantities; numerical invariants; whether it is exact, approximate, simulated, or schematic; equation mapping; assessment; accessible equivalent; and supporting references. Content identifiers should survive a reorder of the course.

Each exercise should emit structured results such as `attempted`, `correct`, `hintUsed`, and `solutionRevealed`. Progress should distinguish viewing an explanation from solving an unfamiliar problem. Store a schema version and migrate existing local completion records to an honest “completed under earlier criteria” state. Persist partially completed exercises and learner settings; retain the account-free workflow.

For rendering, use SVG/HTML for readable labels and directly manipulated simple shapes, canvas for dense marks where it is useful, and 3D only for the geometry lessons that benefit from it. Moving repeated simulation calculations into a worker lets the interface remain responsive and supports cancellation; [Web Workers documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) describes that execution model. Pause offscreen animation and share cached numerical results between frames.

Keep a stable visual vocabulary, reinforced by labels and line styles: truth, empirical sample, fitted model, target sensitivity, and correction. The current pages change both notation and color roles. A glossary should be available beside an equation, with the corresponding object highlighted in the figure, so learners do not have to leave the scene and remember what they were inspecting.

**8. Test mathematical promises and learning outcomes separately.**

The most valuable technical checks protect identities and boundaries, rather than screenshots alone:

- A finite probability vector sums to one; every supported path remains valid throughout its allowed control range.
- Scores have weighted mean zero, and finite-difference target derivatives converge to their inner products with the proposed gradient.
- Projection residuals are orthogonal to the permitted tangent directions; squared norms satisfy the relevant Pythagorean identity.
- The simulated ATE matches the generator; the stated remainder matches the estimator's decomposition.
- The appropriate targeting score approaches zero, and binary-outcome fluctuations retain valid probabilities.
- Independent nuisance-correctness presets exhibit their claimed behavior across seeds; deliberate counterexamples fail for the stated reason.
- Integration results meet a declared tolerance at slider extremes, and plots account for all simulated observations.
- Correctness, hints, answer revelation, page navigation, reset, and progress migration have explicit, verifiable transitions.

Use deterministic kernels and representative seeds for checks; report Monte Carlo uncertainty when testing a distributional claim. Browser verification should add narrow-screen layouts, keyboard operation, light/dark contrast, reduced motion, persistence, and selected full-motion paths. Full screen-reader testing and learner studies were not performed in this review.

Evaluate the first redesigned lesson with traditional applied statisticians, causal-inference learners, and mathematically experienced users. Begin with think-aloud sessions to discover where the picture is misread. Then compare versions using an immediate unfamiliar problem and a delayed follow-up. An initial small usability sample can reveal problems; it cannot establish effectiveness.

Examples of useful outcomes: explain why a score is mean-zero; distinguish a density from a score function; construct a direction with zero first-order target effect; predict which patient contribution grows when overlap weakens; recognize that an unbiased estimate can be inefficient; explain why cross-fitting cannot restore identification. Include a paper excerpt after the lesson and ask the learner to translate it back into the visual model.

Completion, time spent, and confidence are secondary measures. The principal outcome is accurate reasoning in a new setting, including knowing when the picture or theorem no longer applies.

**9. Recommended delivery order.**

| Sequence | Deliverable | Acceptance criterion |
|---|---|---|
| First | Mathematical correction pass plus the reproduced UI fixes | Claims match kernels; boundary controls preserve invariants; progress events work; figures remain readable on phones |
| Second | One complete causal-question → finite-distribution → canonical-gradient lesson | A learner can construct and explain a previously unseen direction; all linked views derive from the same state |
| Third | Extract the shared scientific and scene layers around that lesson | A second lesson reuses the same kernels, controls, notation, and assessment contracts |
| Fourth | Reorganize existing lessons around prerequisites and the causal roadmap | A newcomer reaches each formal term after meeting its underlying problem; experts can enter directly |
| Fifth | Add survival/censoring and inference laboratories | Learners connect the geometry back to KM/Cox, choose a target, and diagnose a failure case |
| Throughout | External mathematical review and learner evaluation | Fixes are driven by observed misconceptions and transfer performance |

The next substantial investment should be that one complete learning sequence. It will test the hardest assumptions about the product: whether the linked geometry is intelligible, whether learners can act on it, and whether the understanding transfers back to mathematical causal-inference writing.
