# Architecture and authoring

## State and data flow

A laboratory has one validated state store. Controls dispatch state changes. A deterministic scientific kernel computes the quantities used by every linked representation. The rendering layer consumes those quantities; it does not define a separate version of the estimand. Camera changes do not change probabilities, scores, projections, or simulation results. The geometry renderer caches mathematical state independently of camera updates.

The finite model uses probability masses. Fine-grid density helpers return `{z,p,dx,mean,mass}`, where `sum(p)*dx=1`; callers must not mix a density value with a probability mass. The older coarse midpoint diagrams are explicitly approximate and may omit tails. Full Gaussian-mixture targeting uses exact moment-generating functions, independently of the plotting window.

Classic JavaScript modules attach small namespaces because legacy lesson pages are plain HTML with no bundler. `science/core.js` and `shared/state.js` also expose CommonJS exports for tests. Production imports follow this order: science and visuals; curriculum, state, practice and course; laboratory common code and page-specific renderers. The optional reusable simulation panel loads after its mount element is created.

## Scientific contracts

The opening estimand explorer uses `science/estimands.js` and the roadmap's single validated store. `population` holds factual treatment membership fixed across interventions; `means` and `risks` use those same population weights for both arms. The binary event occurs within one year and is a separate outcome from the numerical mean. `survival` uses the existing two-stratum baseline hazards (0.08 and 0.32/year) with an optional delayed hazard multiplier. Its RMST is integrated analytically, independently of the plotting grid. Undefined ratios and empty target populations remain undefined.

`labs/estimands.js` mounts three scenes inside the opening lesson. Their inputs participate in the usual Reset and Share flow. Saved contracts include a measure (`mean`, `rd`, `rr`, `survival`, or `rmst`) and a snapshot of the teaching-world settings. Older version-2 contracts gain `measure: mean` on load. The reminder describes the saved question, while later lessons retain their explicitly labelled worked-example targets. Saving a question does not substitute an ATE influence function for an ATT or risk-ratio influence function. A survival-lab save explicitly selects that lab's reference cohort.

Deep links `#step-1` through `#step-4` retain their original topics; the new outcome scenes use `#estimand-risk` and `#estimand-survival`. The player accepts `formatValue` so its accessible readout can show physical years rather than normalized playback position.

- `score(p,v)`: strictly positive masses and a mass-conserving velocity; returns `v/p`.
- `path(p,h,epsilon)`: weighted mean-zero score and a valid epsilon; rejects negative probabilities instead of silently clipping invalid paths.
- `project(d,basis,p)`: probability-weighted Gram–Schmidt projection; dependent basis directions are dropped.
- `geometry(p,z)`: mean, full gradient, the fixed-middle-mass tangent direction, its canonical projection and variance decomposition.
- `grid(n,min,max)`: normalized discretization of the shared Gaussian-mixture reference shape.
- `mixtureTilt(components,epsilon,center)`: exact full-mixture exponential tilt using log-sum-exp; supplies normalizer, mean and density.
- `gaussianTarget`, `binaryTarget`: fluctuation fits and the updated empirical targeting score. The binary example assumes an interior finite fit; separation remains a distinct issue.
- `landscapeTarget(initial,sampleMean,curvature,fixed)`: targeting in a specified N₂(θ,I) model; one local line fit or iterative local line fits. It is not a universal-submodel implementation.
- `ateRemainder`: both treatment arms under the documented sign convention.
- `generate(n,rng)` and `estimate(rows,config)`: explicit asymmetric study and nuisance-correctness cases. Cross-fitting trains on the opposite fold; oracle mode uses supplied functions.
- `simulation(config)`: returns a copy of its configuration, compact per-repeat estimates and summaries. It does not read controls while running.
- `histogram(values,bins,domain)`: every observation is counted, including explicit underflow/overflow when a fixed domain is requested.
- `km(rows,tau)` and `survival(config)`: event-before-censor handling at ties, integrated step-curve RMST, strata and support diagnostics. No Cox estimator is implemented or implied.

## Figures

`shared/anim.js` is the figure kit. Its rule: playback must change a mathematical state, never merely unveil a drawing. `CausalAnim.player` supplies Play, Step, Reset and a scrub slider and calls `onT(t)`; the figure maps `t` to a quantity (a sweep position, a budget, calendar time, a sample count) and redraws. Sweeps leave a trace. The clock never overwrites a slider the learner set. `CausalAnim.Plot` draws one scale with gridlines and returns mark elements so a figure can update a layer without redrawing axes. Reduced motion is honoured in `tween` and `player` by jumping to the end state.

Figures register with `CausalFigures.register(name, (mount, dataset) => …)` and lessons mount them with `<div data-figure="name">`. Legacy canvases remain on `CausalVisuals.scene`; new figures are SVG so labels stay text and the accessible transcript is the DOM.

## Spillover kernels

`science/interference.js` is exact: eight units, a fixed graph, deterministic potential outcomes, and full enumeration of allowable assignments with their probabilities under each design. Every number in lesson 13 comes from enumeration, including the fact that individual randomization's treated-minus-control contrast is τ − γ/(N−1).

`science/marketplace.js` is a specified minute-loop simulator (the rules are the comment at the top of the file). Demand and assignment use separate seeded streams. The Python port in `examples/marketplace/python` implements the same rules; agreement is checked on `examples/marketplace/fixtures/hand_worked.json`, not on shared random streams. The full-policy reference is estimated with Monte Carlo uncertainty and is never called an exact truth. The finite-history benchmark is the one place where an estimator's guarantee is verified; fleet results are exploratory evidence for the simulated settings.

## Worker protocol

Input: `{preset, mode, crossfit, n, reps, seed}`. Valid presets are `both`, `outcome`, `propensity`, `neither`; modes are `fitted` and `oracle`.

Messages are `{type:'progress',n}`, `{type:'result',result}`, or `{type:'error',message}`. Cancellation terminates the worker, so a cancelled run cannot overwrite a later run. Completed displays keep their original configuration even when controls change. CSV exports carry that same configuration. No package download or external simulation service is used.

## Assessment contract

`CausalState.reduce(state,event)` returns a new state. Event types are `explore`, `exercise`, `settings`, `contract`, `form` and `reset-unit`.

Exercise events identify the unit, exercise and variant, and distinguish correctness from assistance. Once a variant has been assisted, rechecking the supplied answer does not count as independent demonstration. A new variant resets that assistance flag for the new case. Transfer events determine the lesson's displayed check status; additional prediction and construction events remain separately inspectable.

A future adaptive tutor should consume these explicit events rather than infer understanding from scroll position, CSS classes or feedback text. User-written explanations are local text and are not assigned a correctness label.

## New lesson checklist

1. Define the target and observed-data model, the identifying assumptions, and a concrete action the learner can predict.
2. Add pure scientific kernels only if existing ones cannot express the example. Test the mathematical promise, including a boundary or counterexample.
3. Register the lesson, roadmap stage and prerequisites in `shared/curriculum.js`.
4. Create the HTML shell with a `data-lesson` identifier. Load the shared layers in the order above.
5. Render semantic `lab-step` sections from a validated state store. Use controls and HTML readouts at ordinary text sizes. Pair figures with descriptions and exact numerical tables.
6. Introduce notation after the learner uses the underlying object. Use worked construction, faded help, an independent altered case, reflection and later retrieval.
7. Add a transfer case to `shared/practice.js`. Make clear exactly what its automatic check establishes.
8. Use `CausalVisuals.scene` for animation: pause, step, scrub, reset, reduced motion, and offscreen suspension are shared behavior. Keep physical parameters separate from reveal progress.
9. Test phone widths, keyboard paths, dark mode, reset, persistence, parameter extremes and all relevant invariants. Inspect the actual pictures; passing JavaScript tests does not prevent misleading geometry or overlapping labels.
10. Include a primary scientific source and label which elements are exact calculations, approximations or schematic illustrations.

## Remaining research and rendering work

The course now provides the review's core laboratories and shared architecture. Legacy canvases are readable and inspectable but are not all replaced with responsive, directly manipulable SVG scenes. Transcript quality and spatial equivalence require assistive-technology review. The current deterministic transfer bank is deliberately small; broader misconception-specific problem banks and adaptations should be driven by the learner study rather than labelled validated now.
