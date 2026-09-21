# Synthetic fleet experiment grid — report

Generated 2026-09-21T17:48:33+00:00 by `python3 examples/marketplace/python/run_grid.py --config examples/marketplace/configs/grid.json --out examples/marketplace/results/grid.json` (simulator version 1.0.0). Everything below is simulated from a two-zone teaching model; nothing is calibrated to a real service and nothing says anything about driving safety.

## How to read this

- **Policy reference**: mean over independent replications of (all-B fulfilment − all-A fulfilment) with matched demand seeds. It is a Monte Carlo estimate with the MCSE shown, not an exact truth.
- **Request-level cell**: difference in fulfilment between B-assigned and A-assigned requests sharing one fleet. Its own target (the effect of switching one request's policy while everyone else keeps theirs) is not the policy effect; `Bias vs policy ref` therefore mixes estimator noise with a target mismatch.
- **Switchback cells**: equal-weight block-mean difference, B blocks minus A blocks, dropping arrivals in the first `washout` minutes of each block; two-sample SE across blocks. Bias and coverage are measured against the policy reference.
- **Sharp-null cells**: policy B is made identical to A, so the true effect is exactly 0. `Reject rate` there is the false-positive rate of the |estimate| > 1.96 SE rule, and `Coverage of 0` is interval coverage of the true value.
- Every rate carries a Monte Carlo standard error (binomial, 200 reps). A coverage of 0.93 ± 0.02 is not evidence against 0.95.
- `Excluded share`: fraction of eligible requests dropped by the washout. `Units`: mean number of randomized units (requests or blocks).

## Policy reference by scenario

| Scenario | Policy effect (all-B − all-A) | MCSE | Reps | Configuration |
|---|---|---|---|---|
| base (Base: default fleet and demand, 12-hour horizon) | 0.1704 | 0.0042 | 200 | horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14 |
| competition (Supply competition: fleet 4, demand 0.5 per minute) | -0.1809 | 0.0023 | 200 | horizon=720, followUp=30, fleet=4, demandPerMinute=0.5, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14 |
| persistence (Persistence: longer trips (16 / 26 min) and longer patience (maxWait 12)) | -0.1609 | 0.0033 | 200 | horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=12, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=16, tripCross=26 |
| cycle (Demand cycle: rate 0.35 x (1 + 0.6 sin(2 pi t / horizon)) (Python-only generator)) | 0.0217 | 0.0049 | 200 | horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.6, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14 |

## Scenario `base`: Base: default fleet and demand, 12-hour horizon

Policy reference 0.1704 (MCSE 0.0042, 200 reps). Configuration: horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14.

### Policy effect present (sharpNull = false)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs policy ref | Coverage of policy ref ± MCSE | Reject rate ± MCSE (power) | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 252.7 | 0.161 ± 0.004 | 0.055 | 0.047 | -0.009 | 0.91 ± 0.02 | 0.88 ± 0.02 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | 0.163 ± 0.006 | 0.090 | 0.080 | -0.007 | 0.90 ± 0.02 | 0.52 ± 0.04 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | 0.163 ± 0.007 | 0.096 | 0.086 | -0.007 | 0.92 ± 0.02 | 0.52 ± 0.04 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | 0.163 ± 0.006 | 0.090 | 0.093 | -0.007 | 0.91 ± 0.02 | 0.47 ± 0.04 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | 0.163 ± 0.006 | 0.092 | 0.097 | -0.008 | 0.91 ± 0.02 | 0.43 ± 0.04 | 0.084 |

### No policy effect (sharpNull = true; B behaves exactly as A)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs 0 | Coverage of 0 ± MCSE | False-positive rate ± MCSE | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 252.7 | -0.001 ± 0.004 | 0.060 | 0.058 | -0.001 | 0.95 ± 0.02 | 0.05 ± 0.02 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | -0.003 ± 0.006 | 0.081 | 0.087 | -0.003 | 0.94 ± 0.02 | 0.06 ± 0.02 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | 0.002 ± 0.006 | 0.088 | 0.093 | 0.002 | 0.95 ± 0.01 | 0.04 ± 0.01 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | 0.002 ± 0.006 | 0.091 | 0.094 | 0.002 | 0.90 ± 0.02 | 0.10 ± 0.02 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | 0.002 ± 0.007 | 0.093 | 0.099 | 0.002 | 0.92 ± 0.02 | 0.07 ± 0.02 | 0.084 |

## Scenario `competition`: Supply competition: fleet 4, demand 0.5 per minute

Policy reference -0.1809 (MCSE 0.0023, 200 reps). Configuration: horizon=720, followUp=30, fleet=4, demandPerMinute=0.5, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14.

### Policy effect present (sharpNull = false)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs policy ref | Coverage of policy ref ± MCSE | Reject rate ± MCSE (power) | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 359.8 | 0.090 ± 0.004 | 0.052 | 0.046 | 0.271 | 0.00 ± 0.00 | 0.47 ± 0.04 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | -0.087 ± 0.006 | 0.086 | 0.084 | 0.094 | 0.81 ± 0.03 | 0.23 ± 0.03 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | -0.121 ± 0.006 | 0.091 | 0.090 | 0.060 | 0.90 ± 0.02 | 0.30 ± 0.03 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | -0.136 ± 0.006 | 0.087 | 0.083 | 0.045 | 0.90 ± 0.02 | 0.44 ± 0.04 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | -0.157 ± 0.006 | 0.089 | 0.084 | 0.024 | 0.90 ± 0.02 | 0.51 ± 0.04 | 0.085 |

### No policy effect (sharpNull = true; B behaves exactly as A)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs 0 | Coverage of 0 ± MCSE | False-positive rate ± MCSE | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 359.8 | -0.001 ± 0.004 | 0.051 | 0.050 | -0.001 | 0.97 ± 0.01 | 0.03 ± 0.01 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | -0.001 ± 0.005 | 0.070 | 0.072 | -0.001 | 0.96 ± 0.01 | 0.04 ± 0.01 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | -0.002 ± 0.005 | 0.076 | 0.079 | -0.002 | 0.95 ± 0.01 | 0.04 ± 0.01 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | -0.002 ± 0.006 | 0.079 | 0.071 | -0.002 | 0.90 ± 0.02 | 0.10 ± 0.02 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | -0.003 ± 0.006 | 0.081 | 0.074 | -0.003 | 0.89 ± 0.02 | 0.11 ± 0.02 | 0.085 |

## Scenario `persistence`: Persistence: longer trips (16 / 26 min) and longer patience (maxWait 12)

Policy reference -0.1609 (MCSE 0.0033, 200 reps). Configuration: horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.0, zoneShare=0.5, crossDestShare=0.3, maxWait=12, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=16, tripCross=26.

### Policy effect present (sharpNull = false)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs policy ref | Coverage of policy ref ± MCSE | Reject rate ± MCSE (power) | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 252.7 | 0.115 ± 0.005 | 0.066 | 0.058 | 0.276 | 0.01 ± 0.00 | 0.47 ± 0.04 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | -0.008 ± 0.009 | 0.124 | 0.119 | 0.153 | 0.77 ± 0.03 | 0.09 ± 0.02 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | -0.036 ± 0.009 | 0.127 | 0.126 | 0.125 | 0.86 ± 0.02 | 0.12 ± 0.02 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | -0.073 ± 0.009 | 0.130 | 0.128 | 0.088 | 0.85 ± 0.03 | 0.14 ± 0.02 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | -0.092 ± 0.009 | 0.133 | 0.131 | 0.069 | 0.85 ± 0.02 | 0.17 ± 0.03 | 0.084 |

### No policy effect (sharpNull = true; B behaves exactly as A)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs 0 | Coverage of 0 ± MCSE | False-positive rate ± MCSE | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 252.7 | 0.000 ± 0.004 | 0.057 | 0.062 | 0.000 | 0.98 ± 0.01 | 0.02 ± 0.01 | 0.000 |
| switchback L=30, washout 0 | 200 | 24.0 | 0.004 ± 0.007 | 0.101 | 0.093 | 0.004 | 0.92 ± 0.02 | 0.08 ± 0.02 | 0.000 |
| switchback L=30, washout 5 | 200 | 24.0 | 0.009 ± 0.008 | 0.109 | 0.101 | 0.009 | 0.93 ± 0.02 | 0.07 ± 0.02 | 0.168 |
| switchback L=60, washout 0 | 200 | 12.0 | -0.004 ± 0.007 | 0.101 | 0.097 | -0.004 | 0.93 ± 0.02 | 0.07 ± 0.02 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | -0.005 ± 0.007 | 0.102 | 0.100 | -0.005 | 0.94 ± 0.02 | 0.06 ± 0.02 | 0.084 |

## Scenario `cycle`: Demand cycle: rate 0.35 x (1 + 0.6 sin(2 pi t / horizon)) (Python-only generator)

Policy reference 0.0217 (MCSE 0.0049, 200 reps). Configuration: horizon=720, followUp=30, fleet=6, demandPerMinute=0.35, demandCycle=0.6, zoneShare=0.5, crossDestShare=0.3, maxWait=8, deadline=6, pickupLocal=2, pickupCross=4, tripLocal=8, tripCross=14.

### Policy effect present (sharpNull = false)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs policy ref | Coverage of policy ref ± MCSE | Reject rate ± MCSE (power) | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 251.2 | 0.137 ± 0.004 | 0.062 | 0.057 | 0.116 | 0.48 ± 0.04 | 0.65 ± 0.03 | 0.000 |
| switchback L=30, washout 0 | 200 | 23.9 | 0.111 ± 0.009 | 0.121 | 0.109 | 0.089 | 0.79 ± 0.03 | 0.28 ± 0.03 | 0.000 |
| switchback L=30, washout 5 | 200 | 23.9 | 0.103 ± 0.009 | 0.120 | 0.115 | 0.081 | 0.84 ± 0.03 | 0.23 ± 0.03 | 0.165 |
| switchback L=60, washout 0 | 200 | 12.0 | 0.088 ± 0.011 | 0.157 | 0.146 | 0.067 | 0.84 ± 0.03 | 0.17 ± 0.03 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | 0.083 ± 0.011 | 0.159 | 0.149 | 0.061 | 0.84 ± 0.03 | 0.17 ± 0.03 | 0.083 |

### No policy effect (sharpNull = true; B behaves exactly as A)

| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | Bias vs 0 | Coverage of 0 ± MCSE | False-positive rate ± MCSE | Excluded share |
|---|---|---|---|---|---|---|---|---|---|
| request-level | 200 | 251.2 | -0.002 ± 0.004 | 0.063 | 0.061 | -0.002 | 0.94 ± 0.02 | 0.06 ± 0.02 | 0.000 |
| switchback L=30, washout 0 | 200 | 23.9 | -0.000 ± 0.007 | 0.101 | 0.102 | -0.000 | 0.94 ± 0.02 | 0.07 ± 0.02 | 0.000 |
| switchback L=30, washout 5 | 200 | 23.9 | 0.000 ± 0.007 | 0.106 | 0.106 | 0.000 | 0.94 ± 0.02 | 0.07 ± 0.02 | 0.165 |
| switchback L=60, washout 0 | 200 | 12.0 | 0.002 ± 0.009 | 0.126 | 0.121 | 0.002 | 0.89 ± 0.02 | 0.10 ± 0.02 | 0.000 |
| switchback L=60, washout 5 | 200 | 12.0 | 0.005 ± 0.009 | 0.128 | 0.122 | 0.005 | 0.91 ± 0.02 | 0.09 ± 0.02 | 0.083 |

## Validated finite-history benchmark (separate from the fleet results)

Model: y_t = μ + δ z_t + ρ z_{t−1} + e_t with e_t iid N(0, σ²), z constant within blocks of length L, blocks assigned independently with probability ½. Carryover lasts exactly one period. Target: full-policy effect δ + ρ = 0.150. Settings: blocks=20, L=6, delta=0.1, rho=0.05, sigma=0.1.

| Washout | Mean estimate | Bias ± MCSE | Coverage ± MCSE | Reps |
|---|---|---|---|---|
| 1 | 0.1496 | -0.0004 ± 0.0010 | 0.955 ± 0.010 | 400 |
| 0 | 0.1409 | -0.0091 ± 0.0009 | 0.917 ± 0.014 | 400 |

With washout 1 the block-mean difference is unbiased and its two-sample interval covers at about the nominal rate, within Monte Carlo error. Without washout the first period of each block still carries the previous block's policy, so the estimator targets δ + ρ(L−1)/L (bias ≈ −ρ/L = -0.0083). This is the only setting in this report where the estimator's assumptions are known to hold.

## Observations computed from the grid

- **base**: policy reference 0.170 ± 0.004. Request-level mean 0.161 (same sign as the reference; bias -0.009, coverage of the policy target 0.91). Switchback bias ranges from -0.007 (switchback L=60, washout 0) to -0.008 (switchback L=60, washout 5); coverage of the policy target from 0.90 to 0.92. Under the sharp null the false-positive rates are request-level 0.05 ± 0.02, switchback L=30, washout 0 0.06 ± 0.02, switchback L=30, washout 5 0.04 ± 0.01, switchback L=60, washout 0 0.10 ± 0.02, switchback L=60, washout 5 0.07 ± 0.02.
- **competition**: policy reference -0.181 ± 0.002. Request-level mean 0.090 (OPPOSITE sign to the reference; bias 0.271, coverage of the policy target 0.00). Switchback bias ranges from 0.024 (switchback L=60, washout 5) to 0.094 (switchback L=30, washout 0); coverage of the policy target from 0.81 to 0.90. Under the sharp null the false-positive rates are request-level 0.03 ± 0.01, switchback L=30, washout 0 0.04 ± 0.01, switchback L=30, washout 5 0.04 ± 0.01, switchback L=60, washout 0 0.10 ± 0.02, switchback L=60, washout 5 0.11 ± 0.02.
- **persistence**: policy reference -0.161 ± 0.003. Request-level mean 0.115 (OPPOSITE sign to the reference; bias 0.276, coverage of the policy target 0.01). Switchback bias ranges from 0.069 (switchback L=60, washout 5) to 0.153 (switchback L=30, washout 0); coverage of the policy target from 0.77 to 0.86. Under the sharp null the false-positive rates are request-level 0.02 ± 0.01, switchback L=30, washout 0 0.08 ± 0.02, switchback L=30, washout 5 0.07 ± 0.02, switchback L=60, washout 0 0.07 ± 0.02, switchback L=60, washout 5 0.06 ± 0.02.
- **cycle**: policy reference 0.022 ± 0.005. Request-level mean 0.137 (same sign as the reference; bias 0.116, coverage of the policy target 0.48). Switchback bias ranges from 0.061 (switchback L=60, washout 5) to 0.089 (switchback L=30, washout 0); coverage of the policy target from 0.79 to 0.84. Under the sharp null the false-positive rates are request-level 0.06 ± 0.02, switchback L=30, washout 0 0.07 ± 0.02, switchback L=30, washout 5 0.07 ± 0.02, switchback L=60, washout 0 0.10 ± 0.02, switchback L=60, washout 5 0.09 ± 0.02.
- Intervals use the normal 1.96 multiplier on a two-sample SE, as in the browser code. With 12 blocks (L=60) that multiplier is optimistic (a t quantile with about 10 degrees of freedom is 2.2), which is consistent with the slightly-below-nominal sharp-null coverage in the L=60 rows. Read those rows with their MCSE.

## What the fleet results do and do not show

- Favourable bias or coverage in a scenario is evidence for **that simulated setting** (its fleet size, demand, trip lengths, block length and washout) and nothing more. The fleet simulator does not satisfy the bounded-carryover assumptions of the switchback procedure automatically: vehicles and pending work persist across block boundaries and the fleet's location distribution need not forget earlier assignments within a fixed washout.
- The request-level design answers a different question from the all-B versus all-A policy question; changing its standard error cannot repair that.
- Sharp-null cells are the only exact calibration check for the fleet: there the true effect is 0 by construction.
- Demand is exogenous to policy; ridership response, pricing, geographic clusters and sequential monitoring are not modelled.

## Reproduce

```
python3 -m unittest discover examples/marketplace/python
python3 examples/marketplace/python/run_grid.py --config examples/marketplace/configs/grid.json --out examples/marketplace/results/grid.json
python3 examples/marketplace/python/report.py --grid examples/marketplace/results/grid.json --out examples/marketplace/results/REPORT.md
python3 examples/marketplace/python/build_db.py --fixture examples/marketplace/fixtures/hand_worked.json
```
