# Causality

Interactive lessons in semiparametric causal inference. Every idea is something you drag, scrub or play, and every formula is derived on screen from a picture you already understand.

Built for epidemiologists, trial statisticians, and anyone who runs analyses and wants the rigor underneath them: what a plug-in estimate gets wrong, what a one-step estimator does about it, what a score, a path and an influence function are, and where TMLE's clever covariate comes from.

**Live site:** turn on GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root) and the course is at `https://<you>.github.io/causality/`. Nothing to build, nothing to install.

## What's here

```
index.html              the hub: chapters, unit order, your progress
lessons/                one self-contained HTML page per unit
shared/course.js        lesson registry, recap and predict cards, top bar, footer, progress
shared/course.css       styles for the bar and footer
manifest.webmanifest    lets the site install to a home screen
glossary.html           symbols reference
icons/                  app icon
LICENSE                 MIT, for the code
LICENSE-CONTENT.md      CC BY-NC-SA 4.0, for the lesson content
```

### Chapter 1. Targeting: fixing a machine-learned estimate

| Unit | Page | You leave knowing |
| --- | --- | --- |
| 1 | The One-Step Estimator | Why a regularized plug-in is biased and how ψ̂ + PₙD(P̂) removes the first-order part. For the ATE this is AIPW. |
| 2 | Scores and Influence, From Scratch | A distribution is a point, a path is p(1+εh), a score is a slope of log p, and one function D gives dψ/dε for every direction. |
| 3 | The Mean Along a Path | The derivation of D(z) = z − ψ as arithmetic on bins. |
| 4 | Differentiating Under the Integral | Leibniz's rule as a table of rows ε and columns z. |
| 5 | One Move, Two Faces | Tilting the density of Y by exp(εH(y − μ̂)) has score H(y − μ̂) and mean μ̂ + εH: the regression fluctuation, derived. And Pₙ is a point in the same space as P and P̂. |
| 6 | Two Strata, One Step | With 100 patients in two strata, why the fit should move in proportion to 1/π; positivity as the case k = 0; the estimand as the thing that picks the direction. |
| 7 | Where the Clever Covariate Comes From | D is centered, D is the steepest direction, and fluctuating along it by likelihood solves PₙD = 0. |
| 8 | Four Patients | Compute D(Zᵢ) for four patients by hand and watch the mean equal the correction; then ε̂ by hand. |
| 9 | Efficiency Theory, Drawn | Nine pictures: parameter as a map, tangent space, projection, plug-in bias, double robustness, the TMLE walk, coverage. |

Each unit shows its length up front, opens with a collapsed quick check on the previous unit, lists its scenes, and tracks where you are with a dot strip in the top bar. Animated scenes start at the beginning; Play reveals them. Key scenes carry a predict-before-you-play prompt. A unit completes itself once its predictions are answered, its worked tables are checked, and the last scene is reached; the hub shows a Continue button for the next unit. A [symbols page](glossary.html) maps every notation the lessons use.

Later chapters (identification, estimators you already use, what the influence function is and why it wins, heterogeneous effects, time and intercurrent events) are sketched in the curriculum map and listed on the hub as "coming later."

## Running locally

Open `index.html` in a browser. That's it. If your browser blocks `file://` scripts, serve the folder:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Adding a unit

1. Write the lesson as a single HTML page in `lessons/` (copy an existing one for the design tokens and the `scene()` / `bind()` scaffold).
2. Give its `<body>` a `data-lesson="<id>"` attribute and include `../shared/course.css` and `../shared/course.js`.
3. Register it in the `COURSE` object at the top of `shared/course.js`, with three `recap` questions. The hub, the top bar, the next/previous links, and the next unit's recap card pick it up from there.
4. Optional: put a `<div class="predict" data-options="A|B|C" data-answer="1" data-hint="…">Question</div>` just above a scene for a predict-before-you-play prompt.

Lessons are deliberately self-contained: one file, no build step, so a lesson can be forked, emailed, or dropped into a slide deck without the rest of the repo.

## Design rules the lessons follow

- No calculus you can't see. Every derivative is a slope on screen before it is a symbol.
- Every scene has a readout. Learners verify numbers; they don't take them on faith.
- Sliders before formulas. The learner predicts, then the scrub reveals.
- Each scene ends with a "Say" box: the result in one breath.

## Progress

Completion is earned, not self-reported: a unit is marked complete when every predict card is answered, every worked table is checked (or its answers shown), and the last scene has been scrolled into view. It is stored in the browser's `localStorage` under `causality.progress.v1`. It never leaves the device. "Reset progress" on the hub clears it.

## Credits

Lessons written by David McCoy with Claude. The geometry in unit 7 follows the framing of Schuler and van der Laan's *Introduction to Modern Causal Inference*.
