# R examples ("Now in R")

Short, seeded, base-R scripts that reproduce the estimators of the Causality lessons.
Each runs in under a few seconds on R 4.3 with only base R, `splines` and `survival`
(no CRAN packages). Each file ends with a `# Expected output:` comment block pasted
verbatim from `Rscript <file>.R`; `shared/r-drawer.js` shows that block under the code.
In applied work the packages `tmle` (`tmle::tmle()`), `AIPW` (`AIPW::AIPW`) and `lmtp`
do the same computations with Super Learner nuisance fits and more options.

| File | Lessons | What it reproduces |
| --- | --- | --- |
| `four-patients.R` | 08 Four Patients | The four-patient table: plug-in 2.5, correction 0.8125, one-step 3.3125, then sd(D)/sqrt(n) and a 95% interval; the TMLE step ΣHr = 10, ΣH² = 35.125, ε = 0.2847 and the stratum shifts. |
| `one-step-ate.R` | 01 One-Step Estimator | The confounded ATE study of `science/core.js` (true ATE 2): naive difference, g-computation plug-in, IPW, and one-step/AIPW with influence-function SE and 95% CI, under a correct and a wrong outcome model. |
| `tmle-ate.R` | 07 Clever Covariate | Same X and A, binary outcome: a hand-rolled TMLE (logistic fluctuation along the clever covariate H(A, X)), influence-function SE, compared with AIPW from the same initial fits. |
| `rct-adjustment.R` | 16 RCT Adjustment | A 1:1 trial with a prognostic covariate: unadjusted difference in means vs standardization (g-computation) with robust influence-function SE; the adjusted interval is about 76% as wide, worth about 75% more patients. |
| `crossfit-aipw.R` | 11 Inference Lab | AIPW with 2-fold cross-fitting, natural-spline GLM nuisances (`splines::ns`), propensity truncation, influence-function SE. |
| `km-vs-standardized.R` | 12 Survival Lab, 23 Targeted Survival | The survival-lab generator: pooled KM in the treated vs severity-standardized KM at τ = 5, RMST by integrating the step function, against the exact truth; cross-checked with `survival`'s restricted mean. |

Run all: `for f in *.R; do Rscript "$f"; done`. `tests/r-examples.test.cjs` checks that
the files exist, that the drawer can parse each output block, and (when `Rscript` is
installed) that each script still prints exactly its expected output.

To show a drawer on a lesson page, add to the head

```html
<link rel="stylesheet" href="../shared/r-drawer.css" />
<script src="../shared/r-drawer.js" defer></script>
```

and place `<div data-r="one-step-ate"></div>` where the drawer belongs. Optional:
`data-r-intro="..."` replaces the intro sentence, `data-r-open` opens it initially.
