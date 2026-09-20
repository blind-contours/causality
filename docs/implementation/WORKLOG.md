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
