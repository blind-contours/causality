# Methods notes: experiments when treatments spill over

These notes accompany the interference laboratory (`science/interference.js`,
`tests/interference.test.cjs`) and the synthetic fleet capstone (`examples/marketplace`). They
state what each method assumes and what the course's code checks. Every model here is a
teaching model; the fleet is synthetic and says nothing about any real service or about driving safety.

## 1. Exposure mappings and estimands

Without interference, unit *i* has two potential outcomes, `Y_i(1)` and `Y_i(0)`. With
interference, `Y_i` can depend on the whole assignment vector `a = (a_1, …, a_N)`: `2^N` potential
outcomes per unit, far more than any experiment can contrast.

[Aronow and Samii (2017)](https://arxiv.org/abs/1305.6156) organise the problem in three steps:

1. **Design**: the known distribution of `a` (Bernoulli, complete, cluster, switchback, …).
2. **Exposure mapping**: a function `f(a, θ_i)` that collapses the assignment vector to the
   exposure that matters for *i* (own treatment and, say, the fraction of treated neighbours).
   The assumption that outcomes depend on `a` only through `f` is a *modelling* assumption; it
   is not implied by randomization.
3. **Estimand**: contrasts of average potential outcomes under exposure levels, e.g.
   `E[Y_i(f = "treated, no treated neighbours")] − E[Y_i(f = "control, no treated neighbours")]`.
   Estimation uses the design-induced probability that each unit receives each exposure
   (Horvitz–Thompson style weights). A contrast is identified only if every unit has positive
   probability of both exposure levels under the design.

[Hudgens and Halloran (2008)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2600548/) define the
standard vocabulary under **partial interference** (interference within groups, none between):

- **direct effect**: change *i*'s own treatment, hold the group's assignment strategy fixed;
- **indirect (spillover) effect**: hold *i*'s own treatment fixed, change the group's strategy;
- **total effect**: change both;
- **overall effect**: compare the population average under two group strategies.

The course's *full-policy effect* (everyone under B versus everyone under A) is Hudgens and
Halloran's overall effect for the two extreme strategies. No single set of identification
assumptions covers every example: the eight-unit toy assumes a known graph and a known exposure
summary; the fleet assumes nothing of the sort and is analysed empirically.

## 2. The exact eight-unit toy and the τ − γ/(N−1) fact

`science/interference.js` uses a fixed graph on eight units (two tight groups joined by one
bridge edge) with deterministic potential outcomes

    Y_i(a) = b_i + τ a_i + γ g_i(a),   g_i(a) = fraction of i's neighbours with a_j = 1.

Because everything is enumerable (256 assignment vectors under Bernoulli assignment; 70 under
complete assignment with 4 treated; 4 under cluster assignment), the laboratory computes every
quantity exactly instead of simulating:

- direct effect at fixed exposure: `τ`; spillover per unit of exposure: `γ`;
  full-policy effect: `τ + γ` (every neighbour fraction goes from 0 to 1).
- **What individual randomization estimates.** Take the difference in means between treated and
  control units, averaged over the design (over assignments where both groups are non-empty).
  `tests/interference.test.cjs` checks that under Bernoulli(0.5), Bernoulli(0.3) and complete
  assignment with `k = 4` this contrast equals exactly

      τ − γ/(N − 1) = 1 − 0.8/7 ≈ 0.8857   (with τ = 1, γ = 0.8, N = 8).

  Why: condition on the number treated, `k` (with `1 ≤ k ≤ N−1` so both groups exist). Given
  `k`, both designs assign the `k` treatments uniformly at random, so each neighbour of a treated
  unit is treated with probability `(k−1)/(N−1)` and each neighbour of a control unit with
  probability `k/(N−1)`, whatever the unit's degree. The expected exposure gap between a treated
  and a control unit is therefore exactly `−1/(N−1)` for every unit and every `k`, the baseline
  terms cancel in expectation, and the spillover term enters the treated-minus-control contrast
  with weight `−1/(N−1)`. Averaging over `k` leaves the value unchanged, which is why Bernoulli
  and complete designs agree. The result holds for any graph without isolated units. The contrast
  is a perfectly valid estimand; it just is not `τ` and it is not `τ + γ`. Adjusting its standard
  error cannot turn it into either.
- **Cluster assignment** (both groups treated together or not) pushes the contrast toward the
  policy effect (the test checks a value between 1.6 and 1.7 against `τ + γ = 1.8`; the bridge
  units dilute it) but removes support for the contrasts that separate own and neighbour effects:
  a treated unit with no treated neighbours never occurs.
- A **shared shock** moves every outcome together without any unit's treatment reaching another
  unit. Correlated outcomes alone do not establish interference; toggling one unit and watching
  which outcomes move does.

## 3. Switchbacks and bounded carryover

A switchback assigns the whole market to one policy per time block. Its unit of randomization is
the block, so it targets a whole-market contrast, but the market carries state across block
boundaries.

[Bojinov, Simchi-Levi and Zhao (2023)](https://arxiv.org/abs/2009.00148) give a precise
framework: periods `t = 1…T`, potential outcomes `Y_t(w_{1:t})` that depend on the assignment
path, and an **m-carryover** assumption under which `Y_t` depends only on the last `m + 1`
assignments. Under that assumption they derive optimal block lengths, Horvitz–Thompson style
estimators of the (finite-history) causal effect, variance bounds and randomization-based
inference. The estimand is the contrast between "always B for the last `m+1` periods" and
"always A for the last `m+1` periods", averaged over periods.

**The validated benchmark in the course** (`estimators.benchmark`) is the simplest instance:
`y_t = μ + δ z_t + ρ z_{t−1} + e_t`, so `m = 1`, the finite-history effect is `δ + ρ`, and dropping
the first period of every block makes the equal-weight block-mean difference unbiased with
independent block means. `benchmark_calibration` checks bias and 95% coverage against Monte
Carlo standard errors; without washout the estimator targets `δ + ρ(L−1)/L` instead. This
verifies the estimator and its interval where the assumptions hold by construction.

**The fleet simulator does not satisfy these assumptions automatically.** In the fleet, the state
carried across a block boundary is the joint distribution of vehicle locations and free times and
the queue of waiting requests. Bounded trip durations bound how long any *one* vehicle stays
committed, but the distribution of the fleet's locations after a policy switch depends on the
whole history of assignments, and there is no fixed `m` after which it forgets. The washout rule
in the course (drop arrivals in the first `w` minutes of a block) changes the analysed
population; it does not reset the fleet. The grid in `examples/marketplace/results/grid.json`
shows the consequence: in the base scenario the switchback bias is within Monte Carlo error of
zero, while in the competition and persistence scenarios the bias shrinks with longer blocks and
a washout but does not vanish, and coverage of the policy target sits below nominal. Those are
empirical findings for those settings, not a general result in either direction.

## 4. The sharp-null randomization test

Making policies A and B identical (`sharp_null = True`) creates a world in which the sharp null
"the policy changes no outcome" holds exactly, even though requests still interact through the
shared fleet. This is what allows calibration of any assignment-based test without a model of the
interference.

`switchback_randomization_test` re-draws the **block sequence** under the actual design
(independent fair coins per block), recomputes the block-mean difference for every re-draw and
reports `(1 + #{|stat*| ≥ |stat|}) / (1 + reps)`. It tests only the sharp null of no effect on any
block; it does not produce a confidence interval, and inverting it into one would require a model
of how effects add across blocks. Shuffling individual requests instead of blocks would test a
design that was never run and gives wrong false-positive rates. The grid's sharp-null cells
report false-positive rates of the normal-interval rule with their Monte Carlo errors; the
L = 60 rows (12 blocks) show the cost of a 1.96 multiplier when the number of blocks is small.

## 5. What the validated benchmark does and does not show

Does show:

- The switchback block-mean estimator with washout is unbiased for the finite-history effect
  when carryover lasts one period and blocks are assigned independently; its two-sample
  interval covers at about 95% (checked to within Monte Carlo error, `tests/marketplace.test.cjs`
  and `examples/marketplace/python/test_fixture.py`).
- Without washout the same estimator is biased by about `−ρ/L`; the sign and size are predicted
  and observed.

Does not show:

- That the fleet satisfies one-period (or any fixed-length) carryover.
- That a favourable fleet scenario generalises to other fleet sizes, demand levels, trip lengths,
  block lengths or washouts. Each cell in the grid is evidence for that cell.
- Anything about ridership response to policy, pricing, geographic leakage between clusters,
  or sequential stopping; none is modelled.
- Anything about a real service.

## References

- Aronow, P. M. and Samii, C. (2017). Estimating average causal effects under general
  interference, with application to a social network experiment. *Annals of Applied Statistics*.
  <https://arxiv.org/abs/1305.6156>
- Hudgens, M. G. and Halloran, M. E. (2008). Toward causal inference with interference.
  *JASA*. <https://pmc.ncbi.nlm.nih.gov/articles/PMC2600548/>
- Bojinov, I., Simchi-Levi, D. and Zhao, J. (2023). Design and analysis of switchback
  experiments. *Management Science*. <https://arxiv.org/abs/2009.00148>
