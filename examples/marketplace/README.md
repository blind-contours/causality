# Marketplace capstone: a synthetic two-zone shared-fleet experiment

Everything in this directory is a **synthetic teaching model**. It is not calibrated to any real
service, it does not model a real road network, and it says nothing about driving safety.

Python (standard library only, tested on 3.8.8; no numpy, no DuckDB) owns the reference
simulation, assignment designs, estimators, the repeated-experiment grid and the report. SQL
(SQLite through the built-in `sqlite3` module; DuckDB accepts the same schema and queries as a
drop-in) owns metric construction. `science/marketplace.js` is the browser implementation of the
same rules; the two are checked against the shared fixture rather than against each other's
random streams.

## Commands

```
# tests: fixture reproduction, invariants, sharp null, benchmark calibration, SQL metrics
python3 -m unittest discover examples/marketplace/python

# simulation grid -> results/grid.json (about 30 s on a laptop; the browser panel reads this file)
python3 examples/marketplace/python/run_grid.py --config examples/marketplace/configs/grid.json --out examples/marketplace/results/grid.json

# Markdown report from the grid -> results/REPORT.md
python3 examples/marketplace/python/report.py --grid examples/marketplace/results/grid.json --out examples/marketplace/results/REPORT.md

# load the fixture (or one simulated run) into the SQL schema and print every metric query
python3 examples/marketplace/python/build_db.py --fixture examples/marketplace/fixtures/hand_worked.json
python3 examples/marketplace/python/build_db.py --design switchback --horizon 240 --db examples/marketplace/results/switchback.sqlite
```

`run_grid.py --reps N` makes a quick run; the value used is recorded in the output's `command`.

## Layout

| Path | Contents |
|---|---|
| `python/simulator.py` | `simulate(config, design_kind, requests=None, fleet=None, schedule=None, sharp_null=False)`, `generate_requests`, `initial_fleet`, `design`, `fulfilment`, `eligible`; `VERSION = "1.0.0"` |
| `python/estimators.py` | `request_estimate`, `switchback_estimate`, `switchback_randomization_test`, `policy_reference`, `experiment`/`experiment_rows`/`summarize`, `benchmark`, `benchmark_calibration` |
| `python/build_db.py` | loads runs into `sql/schema.sql`, splits `sql/metrics.sql` on `-- name:` markers and runs each query |
| `python/run_grid.py`, `python/report.py` | the grid and its report |
| `python/test_fixture.py` | the unittest suite |
| `sql/schema.sql`, `sql/metrics.sql` | tables and metric queries (correct and deliberately wrong versions) |
| `configs/grid.json` | the frozen grid configuration (scenarios, designs, reps, seeds) |
| `fixtures/hand_worked.json` | the cross-language fixture with expected per-request rows, events and metrics |
| `results/grid.json`, `results/REPORT.md` | generated outputs (committed because the site serves them) |

## Simulator specification (identical to the SPEC comment in `science/marketplace.js`)

- Time is integer minutes `t = 0 … horizon−1`. Two zones, 0 and 1, adjacent.
- Vehicles `{id, zone, freeAt}`; a vehicle is free at `t` if `freeAt ≤ t`.
- Requests `{id, t, origin, dest, maxWait}`. Eligible requests arrive in `[0, horizon)`. The run
  continues for `followUp` minutes after the horizon so every eligible request reaches a terminal
  status; no new requests arrive during the follow-up.
- Each minute, in order: (1) waiting requests older than `maxWait` expire unserved; (2) the
  remaining waiting requests are matched in arrival order (then id); (3) the minute's new
  arrivals are matched in id order. A request keeps the policy assigned at its arrival while it waits.
- Policy A: a free vehicle in the origin zone. Policy B: the same; if none, a free vehicle in the
  other zone. Tie-break: smallest `freeAt`, then smallest id.
- Pickup takes `pickupLocal` minutes from the same zone, `pickupCross` from the other zone. The
  trip takes `tripLocal` if origin = dest, else `tripCross`. The vehicle ends at `dest` and is
  free at `pickup + trip`. Served-within-deadline means `pickup − arrival ≤ deadline`.
- Blocks are half-open `[start, end)`; block `b` of length `L` covers `[bL, (b+1)L)`.
- Demand and the initial fleet come from the demand RNG (`demandSeed`); assignments come from the
  assignment RNG (`assignSeed`). Comparison worlds share `demandSeed`.
- `sharp_null=True` makes B behave exactly as A: an exact no-effect world for calibration.

Designs: `allA`, `allB`, `request` (independent fair coin per request), `switchback`
(independent fair coin per block of `blockLength` minutes, `ceil((horizon+followUp)/L)` blocks),
`fixed` (an explicit schedule, used by the fixture).

**Random streams differ between languages.** Python uses `random.Random(seed)`; the JavaScript
uses a mulberry32-style generator. The same seed gives different demand and assignments in the two
implementations, so cross-language agreement is checked on the fixture (explicit requests, fleet,
schedule), never on seeds. **`demandCycle` is Python-only**: with amplitude `a` the per-minute
rate is `demandPerMinute × (1 + a·sin(2πt/horizon))`; the JavaScript generator has a constant
rate. The `cycle` scenario in the grid therefore has no browser counterpart.

Per-request row fields (same names in both languages): `id, t, origin, dest, policy, block,
status, vehicle, pickup, complete, wait, servedInTime`. Event fields: `t, vehicle, state, zone,
request`. Each served request produces two events (`assigned`, `free`); unserved requests produce none.

## Estimand and estimators

Primary metric: fraction of **eligible** requests served within `deadline` minutes of arrival.
Unserved requests stay in the denominator. Policy target: expected all-B minus all-A fulfilment
under the same demand process, horizon and initial-state distribution, with demand exogenous to
policy. `policy_reference` estimates it by independent replications with matched demand seeds and
reports its Monte Carlo standard error; it is not an exact truth.

| Estimator | Target | Interval assumptions |
|---|---|---|
| `request_estimate` | effect of switching one request's own policy while the fleet is shared | independent request outcomes (false under shared supply); not the policy effect |
| `switchback_estimate` | policy effect, if carryover ends within the washout | block outcomes independent given assignment; equal block weights; the first `washout` minutes of every block are excluded from the analysis population |
| `switchback_randomization_test` | sharp null: the policy changes no block outcome | re-randomizes the block sequence under the actual design; not a confidence interval |

Intervals use `estimate ± 1.96 × SE` with a two-sample SE, as in the browser. With few blocks
that multiplier is optimistic; the report shows the resulting coverage with Monte Carlo error.

## The validated benchmark

`benchmark` implements `y_t = μ + δ z_t + ρ z_{t−1} + e_t`, `e_t` iid normal, `z` constant within
blocks assigned by independent fair coins. Carryover lasts exactly one period, so with washout 1
the equal-weight block-mean difference is unbiased for `δ + ρ` and block means are independent
given assignment. `benchmark_calibration` checks bias and 95% coverage against their Monte Carlo
standard errors; without washout the estimator targets `δ + ρ(L−1)/L`. This is the only setting
here where the switchback interval's assumptions are known to hold; the fleet results are
exploratory and are evidence for the simulated settings only.

## SQL schema

All tables carry `(experiment_id, replication)` keys.

- `runs`: simulator version, design, sharp-null flag, horizon, follow-up, fleet count, frozen config JSON.
- `requests`: `request_id, arrival_t, origin, dest, max_wait, eligible`.
- `assignments`: `unit_kind ('block' | 'request'), unit_id, policy, interval_start, interval_end, probability`.
  Block intervals are half-open: a request belongs to the block with `interval_start <= arrival_t < interval_end`.
- `request_outcomes`: `status, observed_policy, vehicle_id, pickup_t, complete_t, wait_minutes,
  trip_minutes, pickup_zone, cross_zone_pickup, served_in_time`. `observed_policy` is what the
  simulator executed; the metrics derive the assigned policy from `assignments` and compare the
  two. `cross_zone_pickup` is realized execution: a B-assigned request served locally has 0.
- `vehicle_events`: `event_seq, vehicle_id, t, state, zone, request_id` (two rows per served request).

`metrics.sql` builds the view `eligible_request_rows` (one row per eligible request, LEFT JOINs to
assignments and outcomes, `served_in_time` coalesced to 0), then `row_count_checks`,
`fulfilment_overall`, `fulfilment_by_block`, `fulfilment_by_policy_request_weighted`,
`switchback_block_weighted_estimate`, and four deliberately wrong queries:
`wrong_inner_join_vehicle_events`, `wrong_left_join_vehicle_events`,
`wrong_served_only_denominator`, `wrong_closed_interval_join`. Request-weighted and
equal-block-weighted contrasts are different targets; the report matches each to its estimator.

## The fixture and the hand-worked exercise

`fixtures/hand_worked.json`: two vehicles (vehicle 0 in zone 0, vehicle 1 in zone 1), six requests,
`maxWait 3, deadline 4, pickupLocal 2, pickupCross 4, tripLocal 6, tripCross 10`, blocks of 10
minutes with policy A on `[0,10)` and B on `[10,20)`.

| Request | Arrives | Origin → dest | Policy | What happens |
|---|---|---|---|---|
| 0 | 0 | 0 → 0 | A | vehicle 0 picks up at 2, completes at 8; on time |
| 1 | 1 | 0 → 1 | A | vehicle 0 busy, vehicle 1 is in zone 1 and A does not search there; expires at t = 5 |
| 2 | 2 | 0 → 0 | A | same; expires at t = 6 |
| 3 | 9 | 0 → 0 | A | vehicle 0 free since 8; picks up at 11, completes at 17; on time |
| 4 | 11 | 1 → 1 | B | vehicle 1 picks up at 13, completes at 19; on time |
| 5 | 12 | 0 → 0 | B | both vehicles busy until 17 and 19; expires at t = 16 |

Correct metrics: 6 eligible, 3 served, 3 unserved, **fulfilment 3/6 = 0.5**; block 0 (A) 2/4 =
0.5, block 1 (B) 1/2 = 0.5, switchback estimate 0.

Exercise: *identify how an incorrect join or denominator changes the answer.*

| Query | Rows | "Fulfilment" | Why it is wrong |
|---|---|---|---|
| `eligible_request_rows` (LEFT JOIN, half-open blocks) | 6 | 0.500 | correct |
| `wrong_inner_join_vehicle_events` | 6 (3 requests × 2 events) | 1.000 | inner join drops the 3 unserved requests and duplicates each served one |
| `wrong_left_join_vehicle_events` | 9 (3 × 2 + 3 × 1) | 0.667 | unserved requests survive but served ones count twice |
| `wrong_served_only_denominator` | 3 | 1.000 | conditions on being served, a policy-affected event |
| `wrong_closed_interval_join` | 6 here; `eligible + boundary arrivals` in general | — | `start <= t <= end` attaches a boundary arrival to two blocks; the test shows the duplication on a run with arrivals at t = 30, 60, … |

`row_count_checks` must show `view_rows = distinct_request_ids = eligible_requests` and zero
missing assignments, missing outcomes and assigned/observed mismatches before any aggregate is trusted.

Note: the fixture's `note` field says request 5 "is served late"; the expected rows (which both
implementations reproduce) have it expiring unserved at t = 16. The rows are authoritative.

## The grid (`configs/grid.json` → `results/grid.json`)

Scenarios (horizon 720, follow-up 30): `base` (defaults), `competition` (fleet 4, demand 0.5/min),
`persistence` (trips 16/26 min, `maxWait` 12), `cycle` (`demandCycle` 0.6). For each: the policy
reference (200 replications, MCSE) and cells design ∈ {request, switchback} × blockLength ∈ {30, 60}
× washout ∈ {0, 5} × sharpNull ∈ {false, true}, 200 replications each; request-level cells have one
entry per sharp-null setting (`blockLength` null, `washout` 0). Switchback cells that differ only in
washout share the same simulated runs. Under `sharpNull = true` the true effect is 0 and the target
for bias and coverage is 0; otherwise the target is the scenario's policy reference.
Output schema: `{"version", "generated", "command", "scenarios": {name: {"label", "config"}},
"reference": [{"scenario", "policyEffect", "mcse", "reps"}], "cells": [{"scenario", "design",
"blockLength", "washout", "sharpNull", "reps", "mean", "sd", "mcse", "meanSE", "units",
"bias_vs_policy", "coverage_policy", "coverage_policy_mcse", "reject_rate", "reject_mcse",
"excluded_share"}]}`. Runtime: about 30 s. `results/REPORT.md` summarises the file and states
explicitly that favourable results are evidence for the simulated settings only.

## Deferred

Geographic clusters (and the cross-boundary leakage that would make zones non-isolated), pricing,
demand response to policy, richer road networks, and sequential monitoring are described in the
lessons but not implemented. The reference target omits policy-induced changes in ridership and
long-run equilibrium effects.
