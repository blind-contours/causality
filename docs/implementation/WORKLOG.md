# Course redesign

Implements the September 19 review. Preserve a static, account-free course; use shared deterministic scientific kernels and linked, accessible visualizations.

## Delivery checklist

- [x] Shared probability, geometry, estimation, survival, and simulation kernels with invariant tests
- [x] Question-first curriculum, estimand contract, prerequisites, guided/explore routes
- [x] Finite-distribution canonical-gradient laboratory with rotatable geometry
- [x] Inference/cross-fitting and survival/KM/Cox laboratories
- [x] Mathematical and numerical correction pass through the nine existing lessons
- [x] Explicit assessment states, persistence, retrieval, accessible figures and controls
- [x] Browser verification, authoring documentation, external-review and learner-study materials

External mathematical review and participant studies require people and are not represented as completed by automated checks. See `docs/learning/EVALUATION.md`.

## Status (2026-09-20)

- `npm test`: 19 invariant, state and source tests pass.
- `npm run test:browser`: 45 page renders (desktop, phone, light, dark) with no runtime errors, overflow, unlabelled controls or shrunken canvases; interaction checks for guided routes, deep links, shared configurations, keyboard camera, play/pause and reduced motion pass. Evidence in `docs/implementation/evidence/`.
- Final fixes after the redesign: the scene-clock check targets a scene that has a scrub slider, the browser script exits on an exception instead of hanging on its open WebSocket, and laboratory stores now apply a shared configuration pasted while the page is already open.

## Not done

- Independent mathematical review and learner study (people required).
- Legacy canvases are readable in scrollable viewports but are not rebuilt as responsive SVG.
- Screen-reader equivalence of figure transcripts is unverified.

## Visual system (2026-09-20, second pass)

- One palette for every page: the original cool-grey lesson theme, defined once in `shared/labs.css`, with six stage hues (`--s-question` … `--s-interpretation`) that follow the causal roadmap. The cream lab palette is retired.
- Homepage rebuilt around the course map (`shared/river.js`): roadmap stages as the channel, lessons as tributaries, progress in node fill, one primary action, dense itinerary, three-question skip-ahead diagnostic that marks the roadmap lesson explored (never demonstrated).
- Lesson headers carry their stage colour (bar underline, stage label, breadcrumb, current step).
- Type scale raised one step (16px body) after readability review; web fonts now load on every page.
- Legacy canvases fit their column again. `shared/visuals.js` fits each canvas on its first 2D context: the backing store is scaled to the device pixel ratio (crisp on retina), the element fills its column, and it shrinks to no less than 80% of its declared size before the surrounding viewport scrolls. Scenes stack to one column below 980px so a figure column is never narrower than that floor. The scroll note appears only when a figure actually overflows.

## Figures (2026-09-20, third pass)

Implements `docs/reviews/2026-09-20/FIGURES.md`. Kit in `shared/anim.js`; new figures under `figures/` and inside the laboratory renderers. Anchor figures: the influence curve drawn from the action (`figures/influence.js`) and the animated projection onto the allowed tangent space (geometry lab step 5, with the Pythagorean variance split). Legacy scenes follow the Play rule: sweeps trace, reveals are labelled Reveal, and the clock never overwrites a slider.

## Review corrections (2026-09-20, fourth pass)

Responds to the review at 785427c. Adjustment stays computable when exchangeability is removed; only its equality to the causal value breaks (`science.identification`). The double-robustness plane draws the product boundary as a hyperbola. Rate captions describe a bound that cannot show a negligible remainder rather than a guaranteed bias; the cancellation counterexample is a unit test. The projection animation reports the missing cross term and labels the moving vector Q until it reaches the allowed line. Rate curves use a log scale instead of clamping. Cross-fitting's caption calls the MSE gap an analogy, and own-fold predictions come from the fit on that fold. Inference and survival figure settings live in the validated store so Reset and Share reproduce them; laboratory Reset also resets figure clocks. Presentation-attribute colours are no longer overridden by the kit stylesheet, and the phone text bump applies only to wide figures; the standardization legend reflows in HTML.

## Spillover branch (2026-09-21)

Implements the network-experimentation brief: lessons 13–15 (interference lab, experiment design lab, marketplace decision lab) with prerequisites causal-roadmap and inference-lab, exact and simulated kernels in `science/interference.js` and `science/marketplace.js` with tests, a cross-language fixture, and the Python/SQL capstone under `examples/marketplace/`. Transfer questions and retrieval questions cover interference versus correlation, assignment versus exposure, and experimental versus rollout effects.

## Estimand explorer (2026-09-24)

- Expanded the opening lesson to six guided steps. Three linked scenes introduce ATE/ATT/ATC population weights, risk differences versus risk ratios, and survival differences versus RMST differences before identification and the roadmap.
- Added an exact kernel in `science/estimands.js`. The reference numerical outcome matches the existing generator; the worked heterogeneous-effect example gives ATE 1.8, ATT 3.4, and ATC 1.4. Binary risks and time until death are separately specified outcomes in the same baseline cohort. RMST is integrated analytically, including delayed effects.
- Figures respond to controls, use shape/line style as well as colour, and provide numerical tables. Time supports dragging, keyboard sliders, Play/Step/Reset, physical-year readouts, and reduced motion. All settings participate in the existing laboratory persistence, Share, and Reset.
- Saved questions now include the outcome measure, population, time horizon, and example settings. Existing contracts migrate. Later examples explicitly retain their own targets; the survival laboratory saves its reference-cohort question. ATC has the appropriate one-sided support check.
- Added prediction prompts, six types of numerical transfer cases, retrieval questions, glossary links, sources, and authoring/evaluation notes. The opening lesson's provisional time estimate is 25 minutes.
- Verification: 48 JavaScript tests passed, including exact weighting identities, reference-generator agreement, target-specific positivity, zero-risk ratios, analytic RMST versus numerical integration, and contract migration. The browser suite passed 54 page/viewport/theme renders and the new interaction checks for saved/restored/shared questions, deep links, delayed effects, playback, reduced motion, and reset. Inspected the new scenes at desktop and phone widths. External mathematical and learner evaluation remain separate work.
