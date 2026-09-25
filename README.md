# Causality

An interactive course connecting causal questions, semiparametric geometry, targeting, inference, and familiar survival methods. It is built for applied statisticians who want to understand what their estimators are doing.

## Run and verify

No build or dependency installation is required. Serve the repository over HTTP so the simulation worker can load:

```sh
npm run serve
# Open http://127.0.0.1:8765
npm test
```

`npm test` requires Node 22 or later and uses its built-in test runner. Any static HTTP host can serve the site. `file://` is not a supported way to run the worker. The older lessons request Google Fonts; system fonts remain usable when offline. There is no account, analytics, or server-side learner database.

For browser checks, start an isolated Chrome/Chromium profile with remote debugging on port 9227, alongside the server, then run `npm run test:browser`. The script uses Node's WebSocket client, so Playwright is not required. `CDP_PORT` and `BASE_URL` can override the defaults. Use a test browser profile: the checks reset course data in that profile. Results and selected screenshots are written to `docs/implementation/evidence/`.

## The learning route

Twenty-one core lessons in seven units, plus an elective branch. `shared/curriculum.js` is the source of truth for the order.

1. **Ask** (1 to 2): population weights, absolute vs relative risks, survival gap vs RMST area, identification; then intercurrent events and the five ICH E9(R1) strategies, completing the estimand contract.
2. **Design** (3 to 4): write the target trial protocol and emulate it; move time zero and watch immortal time manufacture a benefit; then clone, censor and weight for sustained strategies with a grace period.
3. **The payoff, first** (5): covariate adjustment in a randomized trial. Same estimand, narrower interval, robust standard errors, the conditional vs marginal odds ratio, and a prognostic score (the FDA 2023 guidance and PROCOVA ideas).
4. **Geometry** (6 to 9): paths, scores and influence functions from one density; the mean's influence function one line at a time; an optional aside on differentiating under the integral; the canonical gradient by projection.
5. **Estimation** (10 to 14): one-step, two strata and the 1/π budget, the clever covariate and logistic TMLE, the density tilt as a regression shift, and four patients by hand through TMLE, a standard error and a 95% interval.
6. **Trust the answer** (15 to 19): the efficiency story on one page; when an interval is earned (rates and cross-fitting with an overfitting learner); standard errors you can report (influence function, sandwich, bootstrap); positivity and weights; sensitivity to unmeasured confounding (bias factor, E-value, benchmarking).
7. **Survival** (20 to 21): KM, censoring and RMST vs hazard ratios, then targeted survival curves and ΔRMST with IPCW, the survival influence function, TMLE and a double-robustness experiment.

Estimator lessons carry a "Now in R" drawer (`shared/r-drawer.js`, scripts in `examples/r/`, base R only, with their verified output).

**Elective: experiments when treatments spill over** (E1 to E3, after the inference laboratory; survival is not a prerequisite): define direct, spillover and full-policy effects on an exact eight-unit network; step through a two-zone shared fleet and compare request-level randomization with randomized switchbacks; judge repeated experiments against a named target with a validated benchmark, and write a one-page recommendation. A Python/SQL capstone in `examples/marketplace/` reproduces the analysis and generates the precomputed grid the third lesson reads. Electives are listed on the course map but sit outside the river and the progress count.

File names keep their original numbers so existing links keep working.

Guided mode presents one topic at a time; Explore shows all topics. Direct entry is always available. The course map and each lesson show prerequisites. A saved estimand contract stays available across lessons; each experiment explicitly states when it uses a different toy target or population.

## Code organization

| Location | Responsibility |
|---|---|
| `science/core.js` | Pure probability, geometry, targeting, estimation, histogram and survival kernels; available in browsers and Node |
| `science/estimands.js` | Exact population weights, mean and risk contrasts, and analytic survival/RMST contrasts for the opening estimand explorer |
| `science/interference.js` | Exact eight-unit interference model: enumeration of every assignment under Bernoulli, complete and cluster designs; exposure support; exact design contrasts and estimands |
| `science/marketplace.js` | Two-zone shared-fleet simulator (specified minute loop), request and switchback designs, estimators, sharp-null randomization test, full-policy reference, repeated experiments, and the validated finite-history benchmark |
| `examples/marketplace/` | Python port of the simulator checked against a shared fixture, SQL metric construction with unserved requests in the denominator, the simulation grid, and the report |
| `science/simulation-worker.js` | Seeded repeated experiments, progress messages, immutable run configuration |
| `labs/` | Laboratory state, controls and linked visual representations; reusable simulation panel |
| `shared/curriculum.js` | Unit order, roadmap stages, prerequisites and retrieval questions |
| `shared/state.js` | Versioned learning-state migration and explicit event transitions |
| `shared/practice.js` | Generated transfer cases, hints, worked solutions and reflection prompts |
| `shared/course.js` | Navigation, guided topics, contextual notation, progress and persistence |
| `shared/visuals.js` | SVG plotting, shared animation clock and accessible legacy-canvas containers |
| `shared/anim.js` | Figure kit: `Plot` (one scale, gridlines, line/step/area/bars/scatter/reference marks), `player` (Play, Step, Reset, scrub; reduced motion honoured), `tween`, `morph`, and the `data-figure` registry |
| `figures/` | Registered figures that lessons mount with `<div data-figure="name">`; each is built from a mathematical state and a clock, never from a reveal |
| `shared/river.js`, `shared/hub.js`, `shared/hub.css` | The course map: roadmap stages as a river, lessons as tributaries, progress states, skip-ahead diagnostic |
| `shared/labs.css`, `shared/lesson.css`, `shared/course.css` | One token set (palette, six stage hues, type) in `labs.css`; legacy lesson components; course navigation and study layer |
| `lessons/` | Sixteen entry pages, including the core route and three interference/marketplace application labs |
| `tests/` | Scientific invariants, state transitions, source/link checks and browser verification |
| `docs/learning/` | References, mathematical-review packet and learner-study protocol |

The architecture deliberately remains a static site with small modules. A lesson depends on shared files and is not a self-contained attachment. New mathematics belongs in `science/`, not in drawing callbacks. Some older drawing primitives and illustrative datasets remain inside the original HTML; the common scene clock, styles, progression and repeated simulations have been extracted.

See [architecture and authoring](docs/implementation/ARCHITECTURE.md) for contracts and extension guidance.

## What progress means

Progress uses `causality.progress.v2`. Legacy “complete” flags migrate to **explored**. Current states distinguish **explored**, **attempted**, **assisted**, and **transfer check demonstrated**. A correct answer after revealing that case's solution remains assisted; a new case allows an independent attempt. Scrolling and answer revelation do not demonstrate a lesson. A numerical check is evidence about that check, not a claim of mastery. Free-text explanations are saved but not automatically graded.

Controls, laboratory configurations and worked-table entries are stored locally. New laboratory configurations can be shared by URL; explanations and progress are not included in those links. Course reset removes only keys beginning with `causality.`. A successful transfer check schedules a reminder on the course map after three days; there are no background notifications.

## Mathematical and visual scope

The finite geometry has exact probability-weighted inner products and projections. Its 3D views do not imply that a general statistical model is three dimensional. Gaussian and binary targeting calculations, ATE remainders, population-versus-sample positivity, and product-rate boundaries are stated with their conditions. Repeated simulations report bias, SD, RMSE, AIPW SE and coverage with Monte Carlo uncertainty; consistency is not labelled efficiency.

New SVG figures have numerical tables and keyboard controls. Older canvases remain full size in keyboard-scrollable panels, with descriptions and label transcripts, so phone layouts no longer shrink all text. This is a transitional rendering approach: it is not a claim of fully reflowed SVG versions of all legacy figures or complete screen-reader equivalence.

Automated verification does not establish educational effectiveness. The [evaluation protocol](docs/learning/EVALUATION.md) defines the independent mathematical review, accessibility sessions and immediate/delayed transfer study still to conduct. The [original review](docs/reviews/2026-09-19/REVIEW.md) and its evidence are preserved as the baseline.

## Credits and licenses

Original lessons by David McCoy with Claude. Geometric framing includes Schuler and van der Laan's *Introduction to Modern Causal Inference*. Scientific and learning-design sources are listed in [References](docs/learning/REFERENCES.md).

Code: [MIT](LICENSE). Lesson content: [CC BY-NC-SA 4.0](LICENSE-CONTENT.md).
