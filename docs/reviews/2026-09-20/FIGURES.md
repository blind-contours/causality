# Figure and animation review

Date: 2026-09-20. Scope: all 13 lessons, 41 legacy canvases, the SVG figures in the four laboratories, and every prose or equation block that has no figure. Method: three full read-throughs of the lesson source, a rendered capture of every canvas at its final animation state, and page captures of the laboratories.

## The one rule that would improve most figures

**Play must change a mathematical state, not unveil a drawing.** Of the 41 canvases, only nine animate something a slider cannot show: an accumulating sum, a sample arriving, a likelihood being climbed, a sampling distribution filling. The rest use Play to sweep a slider the learner can already drag, or to fade parts of a finished picture in one at a time. 3Blue1Brown's animations work because motion is the argument: the thing that moves is the thing the theorem is about, and it leaves a trace you can read afterwards.

Corollaries:

- A sweep should leave a trace. When c sweeps in lesson 03 move 4, draw "area versus c" as a flat line being traced. The flat line is the theorem.
- A reveal should be a scrub, not a Play. Staged annotations (lesson 01 act 1, lesson 09 scenes 3 to 5 and 7) can stay as Step buttons but should not own the Play affordance.
- Never let Play overwrite a slider the learner set (lesson 02 scenes 2 and 5, lesson 03 moves 2 to 4, lesson 07 scene 2 all do this).

## Figures that genuinely work and should be the models

| Figure | Why it works |
|---|---|
| Lesson 03 move 1, move 5 | A sum accumulates bin by bin with the arithmetic shown for the current bin. Motion is the integral. |
| Lesson 02 scene 4 | Running integral of h·p with positive and negative parts, ending at zero. |
| Lesson 06 scenes 2 to 6 | The payoff versus cost story with the 45 and 5 squares. Concrete, physical, memorable. |
| Lesson 07 scene 3 | The likelihood is climbed and the score sticks shorten to zero as the tilted density's mean walks to the sample mean. |
| Lesson 09 scene 2 | Observations arrive, the mean sweeps, the sampling distribution fills. Three phases, each informative. |
| Lesson 09 scene 6 | Plug-in bias, empirical process and remainder shown as three separate gaps. |
| Lesson 09 scene 8 | The TMLE path across contours versus the one-step jump on the number line. |

## Missing figures, by importance

### Tier 1: a central idea with no picture anywhere in the course

1. **Projection onto the tangent space.** Requested by the prose in lessons 02 (line 115), 03 (line 116), 09 (scene 5) and 10 (step 5), and never actually drawn as a construction. Lesson 09 scene 5 is a schematic with invented units. Lesson 10 has the real geometry but it is static and its projection view is on a different step from the restriction checkbox that drives it. **Build:** the gradient D as an arrow; the tangent plane; a perpendicular dropped from D's tip to the plane; D\* appearing where it lands; the discarded component's squared length subtracting from a variance bar in sync. Then restrict the model and watch the plane shrink to a line and D\* slide along it. Camera rotation optional and separate.
2. **Double robustness as a product of two errors.** Lesson 01 line 131 and lesson 11 step 1 state the product remainder; lesson 09 scene 7 draws a rectangle from two sliders but the animation is a wipe, and its rate panel draws two identical curves on top of each other so the comparison it asks for is invisible. **Build:** a plane with axes ‖ĝ−g‖ and ‖m̂−m‖, the current error as a point, the rectangle's area as the remainder, and Play driving n upward so the point slides toward the origin along the chosen rate path while a horizontal 1/√n band shrinks. Whether the area gets inside the band before n runs out is the whole story.
3. **The Kaplan–Meier construction.** The survival lab draws finished curves. No figure anywhere shows the risk set shrinking, a step at each event, a tick at each censoring, and the product of (1 − d/n) factors accumulating. **Build:** n dots in a row over time; each event drops one dot and steps the curve; each censoring fades one dot without a step. Then shade the area under the curve up to τ as RMST, which the lab defines in words and never shows.
4. **Cross-fitting.** Lesson 11 step 3 is a table where the "memorizing" column is a copy of the outcome column. **Build:** a deck of patients physically split into two folds; a learner fitted on fold A shows zero residual sticks on A and real sticks on B; swap. The empirical-process term is the difference between the two pictures.
5. **The influence curve drawn from the action.** Lessons 02 scene 7 and 07 scene 1 show a contamination at one z₀ and print ϕ(z₀). Neither traces ϕ. **Build:** add a droplet of mass at z₀, watch the balance point shift, then sweep z₀ and let the shift-per-unit-mass trace out the purple line. The line ϕ(z) = z − ψ appears as a consequence, not a definition. This is the single best "3Blue1Brown moment" available in the material.

### Tier 2: a lesson-level gap

6. **Lesson 08 has no figure.** Four patients, ten columns, and the instruction to "notice which stratum's residuals dominate" with nothing to look at. Build the four-point version of lesson 06 scene 6: four sticks H·r with a running mean converging on the correction, driven by the values typed into the table. Also the stated check ΣH(r − ε̂H) = 0 is never evaluated, and the lede promises an explain step that does not exist.
7. **Lesson 00's DAG is decorative.** It never reacts to the exchangeability, positivity or hidden-shift controls two steps later. Make it respond: a U node with arrows into A and Y appears when exchangeability is unchecked; the X→A arrow greys out when g is degenerate. The two-worlds argument (same observed data, ATE differs by κ) is the lesson's core and has no picture: two potential-outcome columns per patient, observed cells solid, counterfactual cells hollow, κ sliding the hollow ones. Replace the three-number metric grid with a number line carrying naive, adjusted and truth. The DAG also lacks arrowheads on the two confounding edges.
8. **Lesson 06 tells one fact three times** (scenes 3, 4 and 5 all conclude 90δ_Y = 10δ_O). The natural single figure is the (δ_Y, δ_O) plane with cost ellipses 45δ_Y² + 5δ_O² = B and payoff lines 0.5δ_Y + 0.5δ_O = c. Grow the budget and the tangent points trace a ray: δ ∝ 1/π, which is the clever covariate. One figure, animated, replaces three.
9. **The tangent space itself** is never drawn in lesson 02 despite the note at line 52 defining it. Show a fan of allowed paths through P; their velocities at P form the plane. Restrict the model and the fan thins. This is also what lesson 09 scene 4's "illustrated width" slider is groping for.
10. **The derivative as a limit.** Every worked example uses the mean, which is exactly linear in ε, so the "|₀" in dψ/dε|₀ and the second-order remainder (lesson 02 line 100, lesson 04 line 64) are never seen. Build a zoom: for a nonlinear parameter, zoom into ψ(P_ε) near ε = 0 until the curve and its tangent coincide; beside it, the mean's curve, which is already a line.
11. **Coverage has no figure** although it is the inference lab's title question. A caterpillar of intervals from the repeated samples, coloured by whether each covers the truth, with the count accumulating.
12. **The pseudopopulation** (lesson 07 line 77) and the linear update leaving [0, 1] versus the logistic one (lesson 07 line 86, binary panel) are both text and table only.

### Tier 3: smaller gaps worth a figure

- Lesson 04 never plots h(z), whose mean-zero property is the load-bearing fact of its last step.
- Lesson 05 states the 1/√n shrinkage of (Pₙ − P)D̂ but never plots error against n.
- Lesson 07 scene 2 draws a cosine curve without the unit-circle picture that makes Cauchy–Schwarz obvious.
- Lesson 12 computes HR(t) for any t but prints two numbers; a curve of the marginal hazard ratio drifting from 0.65 would show the non-collapsibility argument. The stratum KM curves and their mixing weights behind the standardized curve are never drawn.
- Lesson 06 scene 7 is a probability (1 − g)⁵⁰ with two sliders and no plot.

## Bugs found while capturing

| Where | Problem |
|---|---|
| Lesson 09 scene 3 | Play writes the clock value into the θ label, replacing "110°" with "0.37". |
| Lesson 09 scene 7 | The product curve and the sampling-error curve are numerically identical, so the dashed one is invisible. |
| Lesson 11 step 2 | The rate plot's y-axis auto-scales to the line, so at α = β = 0.25 the line sits on the top edge and the plot looks empty. There is no reference line at 1, the boundary the whole step is about. |
| Lesson 01 act 1 | The (Pₙ − P)D noise dot only appears on the second Play, so the third term of the headline equation is invisible on first viewing. |
| Lesson 07 scene 1 | The population mean is labelled as a sample mean z̄; there is no sample in the scene. The contamination spike's height is not on the density's scale. |
| Lesson 03 move 4 | Prints a nonsense factor when c = 0. |
| Lesson 10 step 4 | The teal score vector is drawn twice. In guided mode the projection figure is on step 4 while the restriction checkbox is on step 5, so the learner toggles the restriction with the only relevant figure hidden. Same pattern in lesson 12: the survival plot's controls live on other steps. |
| Lesson 00 DAG | No arrowheads on the X→A and X→Y edges. |

## Rendering primitives needed

The shared layer has two primitives: `plot` (polylines only, five ticks, no gridlines, no bars, no steps, no shading) and `scene` (a canvas clock). Everything else is hand-drawn per lesson. Building the Tier 1 figures well needs a small SVG animation kit, not a library:

- `tween(from, to, duration, easing)` driving a redraw, with reduced-motion honoured by jumping to the end.
- Path morphing between two sampled curves (density to density, curve to tangent).
- Linked views: one state object, several renderers, so the density, the point in the model and the vector picture move together.
- Step, bar, area and scatter marks for `plot`, plus reference lines and a gridline option.
- A 2D projection of a 3D scene with a slowly orbiting camera (already in `labs/geometry.js`) exposed as a primitive.

## Suggested order of work

1. Fix the eight bugs above and apply the Play rule to the sweep-and-reveal scenes (removing Play where it adds nothing is a net gain).
2. Build the influence-curve-from-the-action figure (item 5) and the projection figure (item 1). They anchor the geometry half of the course and reuse each other's primitives.
3. Build the double-robustness plane (item 2) and the sampling rain plus interval caterpillar (item 11), which anchor the inference half.
4. Build Kaplan–Meier (item 3) and cross-fitting (item 4).
5. Fold lesson 06 scenes 3 to 5 into the (δ_Y, δ_O) plane, give lesson 08 its four-stick figure, and make lesson 00's DAG live.
