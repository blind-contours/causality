# R examples ("Now in R")

Short, seeded, base-R scripts that reproduce the estimators of the Causality lessons.
Each runs in under a few seconds on R 4.3 with only base R, `splines` and `survival`
(no CRAN packages). Each file ends with a `# Expected output:` comment block pasted
verbatim from `Rscript <file>.R`; `shared/r-drawer.js` shows that block under the code.

Each script opens with an **In practice** comment naming the production package and function
you would call instead of the hand-rolled version: `tmle::tmle()`, `AIPW::AIPW` (an R6 class:
`AIPW$new(...)$fit()$summary()`), `lmtp::lmtp_tmle()` / `lmtp::lmtp_sdr()`,
`SuperLearner::SuperLearner()` or `sl3::Lrnr_sl`, `WeightIt::weightit()`, `EValue::evalues.RR()`,
`survtmle::survtmle()` or the `concrete` package for survival, and `RobinCar::robincar_linear()` /
`RobinCar::robincar_glm()` for covariate adjustment in randomized trials. The test checks
every `pkg::fun` named there against a reviewed list.

| File | Lessons | What it reproduces |
| --- | --- | --- |
| `propensity-weighting.R` | Optional weighting foundations | An invented two-stratum table: observed difference 3.80, normalized IPW difference 2.00, high-severity shares changing from 0.80/0.20 to 0.50 in both arms. Fits the treatment model and checks balance; point estimation only. |
| `four-patients.R` | Four Patients | Part 1: plug-in 2.5, correction 0.8125, one-step 3.3125. Part 2 on the same four patients: ΣHr = 3.25, ΣH² = 17.5625, ε̂ = 0.1851, stratum shifts. Part 3: TMLE 2.9858, sd(D̂)/√4 = 0.5141 and the 95% interval, exactly as on the page. |
| `one-step-ate.R` | The One-Step Estimator | The confounded ATE study of `science/core.js` (true ATE 2): naive difference, g-computation plug-in, IPW, and one-step/AIPW with influence-function SE and 95% CI, under a correct and a wrong outcome model. |
| `tmle-ate.R` | Where the Clever Covariate Comes From | Same X and A, binary outcome: a hand-rolled TMLE (logistic fluctuation along the clever covariate H(A, X)), influence-function SE, compared with AIPW from the same initial fits. |
| `rct-adjustment.R` | Your trial, adjusted | A 1:1 trial with a prognostic covariate: unadjusted difference in means vs standardization (g-computation) with robust influence-function SE; the adjusted interval is about 76% as wide, worth about 75% more patients. |
| `crossfit-aipw.R` | When does the correction earn a confidence interval? | Part 1: AIPW with 2-fold cross-fitting, natural-spline GLM nuisances, propensity truncation, influence-function SE. Part 2: the same AIPW with a 1-nearest-neighbour outcome learner, with and without cross-fitting, over 200 repeated studies: without cross-fitting the SE is about half the real SD and coverage falls to about 70%. |
| `km-vs-standardized.R` | From KM and Cox back to the question | The survival-lab generator: pooled KM in the treated vs severity-standardized KM at τ = 5, RMST by integrating the step function, against the exact truth; cross-checked with `survival`'s restricted mean. |
| `survival-onestep.R` | Targeted survival curves and ΔRMST | The lesson's monthly world: discrete-time hazard fits on person-month data, one-step S₁(12), S₀(12), their difference and ΔRMST(12) with influence-function SEs, against the exact truth, then iterated TMLE updates for S₁(12). On the same data it matches `science/targeted-survival.js` to four decimals. |
| `capstone.R` | An emulated trial, end to end | The capstone's registry world drawn with R's random numbers: a three-learner Super Learner with convex CV weights, 5-fold cross-fitting, AIPW risk difference with IF SE, risk ratio with a log-scale CI, E-values, and the Monte Carlo truth. |
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
