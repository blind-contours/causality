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

1. **Ask and identify:** build an estimand contract; distinguish the causal question from an observed-data comparison; deliberately break exchangeability or positivity.
2. **Feel the geometry:** move three probabilities, construct scores and sensitivities, rotate the simplex and square-root sphere, restrict the model, and project a canonical gradient. Continue through the existing derivation lessons.
3. **Build an estimator:** one-step correction, Gaussian tilts, information geometry, clever covariates, binary targeting, and four-patient arithmetic.
4. **Earn inference and return to survival:** nuisance correctness, product rates, cross-fitting, repeated-sampling experiments, efficiency theory, KM, censoring and RMST versus hazard ratios.

Guided mode presents one topic at a time; Explore shows all topics. Direct entry is always available. The course map and each lesson show prerequisites. A saved estimand contract stays available across lessons; each experiment explicitly states when it uses a different toy target or population.

## Code organization

| Location | Responsibility |
|---|---|
| `science/core.js` | Pure probability, geometry, targeting, estimation, histogram and survival kernels; available in browsers and Node |
| `science/simulation-worker.js` | Seeded repeated experiments, progress messages, immutable run configuration |
| `labs/` | Laboratory state, controls and linked visual representations; reusable simulation panel |
| `shared/curriculum.js` | Unit order, roadmap stages, prerequisites and retrieval questions |
| `shared/state.js` | Versioned learning-state migration and explicit event transitions |
| `shared/practice.js` | Generated transfer cases, hints, worked solutions and reflection prompts |
| `shared/course.js` | Navigation, guided topics, contextual notation, progress and persistence |
| `shared/visuals.js` | SVG plotting, shared animation clock and accessible legacy-canvas containers |
| `shared/lesson.css`, `shared/labs.css`, `shared/course.css` | Shared visual language, lesson layouts and course controls |
| `lessons/` | Thirteen entry pages; nine existing derivations plus four laboratories |
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
