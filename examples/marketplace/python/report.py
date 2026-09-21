"""Assemble results/REPORT.md from results/grid.json.

Usage:
  python3 examples/marketplace/python/report.py \
      --grid examples/marketplace/results/grid.json --out examples/marketplace/results/REPORT.md

Also re-runs the finite-history benchmark calibration (fast, stdlib) so the report shows the
validated benchmark next to the exploratory fleet results, with Monte Carlo uncertainty.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estimators import benchmark_calibration  # noqa: E402

BENCH = {"blocks": 20, "L": 6, "delta": 0.1, "rho": 0.05, "sigma": 0.1}


def f(x: Any, d: int = 3) -> str:
    if x is None:
        return "-"
    if isinstance(x, bool):
        return "yes" if x else "no"
    if isinstance(x, float):
        if math.isnan(x):
            return "nan"
        return ("%%.%df" % d) % x
    return str(x)


def pm(x: float, se: float, d: int = 3) -> str:
    return "%s ± %s" % (f(x, d), f(se, d))


def cell_label(c: Dict[str, Any]) -> str:
    if c["design"] == "request":
        return "request-level"
    return "switchback L=%d, washout %d" % (c["blockLength"], c["washout"])


def scenario_table(cells: List[Dict[str, Any]], sharp: bool) -> List[str]:
    rows = [c for c in cells if c["sharpNull"] == sharp]
    head = ("| Design | Reps | Units | Mean estimate ± MCSE | SD of estimates | Mean SE | "
            + ("Bias vs policy ref | Coverage of policy ref ± MCSE | Reject rate ± MCSE (power) | Excluded share |"
               if not sharp else
               "Bias vs 0 | Coverage of 0 ± MCSE | False-positive rate ± MCSE | Excluded share |"))
    sep = "|" + "---|" * (head.count("|") - 1)
    out = [head, sep]
    for c in rows:
        out.append("| %s | %d | %s | %s | %s | %s | %s | %s | %s | %s |" % (
            cell_label(c), c["reps"], f(c["units"], 1), pm(c["mean"], c["mcse"]), f(c["sd"]), f(c["meanSE"]),
            f(c["bias_vs_policy"]), pm(c["coverage_policy"], c["coverage_policy_mcse"], 2),
            pm(c["reject_rate"], c["reject_mcse"], 2), f(c["excluded_share"], 3)))
    return out


def config_line(cfg: Dict[str, Any]) -> str:
    keys = ["horizon", "followUp", "fleet", "demandPerMinute", "demandCycle", "zoneShare", "crossDestShare",
            "maxWait", "deadline", "pickupLocal", "pickupCross", "tripLocal", "tripCross"]
    return ", ".join("%s=%s" % (k, cfg.get(k)) for k in keys if k in cfg)


def observations(grid: Dict[str, Any]) -> List[str]:
    """Scenario-by-scenario facts read off the grid, so the prose cannot drift from the numbers."""
    out: List[str] = []
    for name in grid["scenarios"]:
        ref = next(r for r in grid["reference"] if r["scenario"] == name)
        cells = [c for c in grid["cells"] if c["scenario"] == name and not c["sharpNull"]]
        nulls = [c for c in grid["cells"] if c["scenario"] == name and c["sharpNull"]]
        req = next(c for c in cells if c["design"] == "request")
        sbs = [c for c in cells if c["design"] == "switchback"]
        best = min(sbs, key=lambda c: abs(c["bias_vs_policy"]))
        worst = max(sbs, key=lambda c: abs(c["bias_vs_policy"]))
        same_sign = (req["mean"] > 0) == (ref["policyEffect"] > 0)
        out.append("- **%s**: policy reference %s ± %s. Request-level mean %s (%s the reference; bias %s, coverage of the "
                   "policy target %s). Switchback bias ranges from %s (%s) to %s (%s); coverage of the policy target from %s to %s. "
                   "Under the sharp null the false-positive rates are %s." % (
                       name, f(ref["policyEffect"], 3), f(ref["mcse"], 3), f(req["mean"], 3),
                       "same sign as" if same_sign else "OPPOSITE sign to", f(req["bias_vs_policy"], 3), f(req["coverage_policy"], 2),
                       f(best["bias_vs_policy"], 3), cell_label(best), f(worst["bias_vs_policy"], 3), cell_label(worst),
                       f(min(c["coverage_policy"] for c in sbs), 2), f(max(c["coverage_policy"] for c in sbs), 2),
                       ", ".join("%s %s ± %s" % (cell_label(c), f(c["reject_rate"], 2), f(c["reject_mcse"], 2)) for c in nulls)))
    out.append("- Intervals use the normal 1.96 multiplier on a two-sample SE, as in the browser code. With 12 blocks (L=60) "
               "that multiplier is optimistic (a t quantile with about 10 degrees of freedom is 2.2), which is consistent with the "
               "slightly-below-nominal sharp-null coverage in the L=60 rows. Read those rows with their MCSE.")
    return out


def build(grid: Dict[str, Any], bench_reps: int = 400) -> str:
    L: List[str] = []
    L.append("# Synthetic fleet experiment grid — report")
    L.append("")
    L.append("Generated %s by `%s` (simulator version %s). Everything below is simulated from a "
             "two-zone teaching model; nothing is calibrated to a real service and nothing says "
             "anything about driving safety." % (grid["generated"], grid["command"], grid["version"]))
    L.append("")
    L.append("## How to read this")
    L.append("")
    L.append("- **Policy reference**: mean over independent replications of (all-B fulfilment − all-A fulfilment) with matched demand seeds. "
             "It is a Monte Carlo estimate with the MCSE shown, not an exact truth.")
    L.append("- **Request-level cell**: difference in fulfilment between B-assigned and A-assigned requests sharing one fleet. "
             "Its own target (the effect of switching one request's policy while everyone else keeps theirs) is not the policy effect; "
             "`Bias vs policy ref` therefore mixes estimator noise with a target mismatch.")
    L.append("- **Switchback cells**: equal-weight block-mean difference, B blocks minus A blocks, dropping arrivals in the first `washout` minutes of each block; "
             "two-sample SE across blocks. Bias and coverage are measured against the policy reference.")
    L.append("- **Sharp-null cells**: policy B is made identical to A, so the true effect is exactly 0. `Reject rate` there is the false-positive rate of the |estimate| > 1.96 SE rule, and `Coverage of 0` is interval coverage of the true value.")
    L.append("- Every rate carries a Monte Carlo standard error (binomial, %d reps). A coverage of 0.93 ± 0.02 is not evidence against 0.95." % grid["cells"][0]["reps"])
    L.append("- `Excluded share`: fraction of eligible requests dropped by the washout. `Units`: mean number of randomized units (requests or blocks).")
    L.append("")
    L.append("## Policy reference by scenario")
    L.append("")
    L.append("| Scenario | Policy effect (all-B − all-A) | MCSE | Reps | Configuration |")
    L.append("|---|---|---|---|---|")
    for r in grid["reference"]:
        sc = grid["scenarios"][r["scenario"]]
        L.append("| %s (%s) | %s | %s | %d | %s |" % (r["scenario"], sc["label"], f(r["policyEffect"], 4), f(r["mcse"], 4), r["reps"], config_line(sc["config"])))
    L.append("")
    for name, sc in grid["scenarios"].items():
        cells = [c for c in grid["cells"] if c["scenario"] == name]
        ref = next(r for r in grid["reference"] if r["scenario"] == name)
        L.append("## Scenario `%s`: %s" % (name, sc["label"]))
        L.append("")
        L.append("Policy reference %s (MCSE %s, %d reps). Configuration: %s." % (f(ref["policyEffect"], 4), f(ref["mcse"], 4), ref["reps"], config_line(sc["config"])))
        L.append("")
        L.append("### Policy effect present (sharpNull = false)")
        L.append("")
        L.extend(scenario_table(cells, False))
        L.append("")
        L.append("### No policy effect (sharpNull = true; B behaves exactly as A)")
        L.append("")
        L.extend(scenario_table(cells, True))
        L.append("")
    bench_w = benchmark_calibration(dict(BENCH, washout=1), bench_reps)
    bench_0 = benchmark_calibration(dict(BENCH, washout=0), bench_reps)
    L.append("## Validated finite-history benchmark (separate from the fleet results)")
    L.append("")
    L.append("Model: y_t = μ + δ z_t + ρ z_{t−1} + e_t with e_t iid N(0, σ²), z constant within blocks of length L, "
             "blocks assigned independently with probability ½. Carryover lasts exactly one period. "
             "Target: full-policy effect δ + ρ = %s. Settings: %s." % (f(bench_w["target"], 3), ", ".join("%s=%s" % kv for kv in BENCH.items())))
    L.append("")
    L.append("| Washout | Mean estimate | Bias ± MCSE | Coverage ± MCSE | Reps |")
    L.append("|---|---|---|---|---|")
    for w, b in ((1, bench_w), (0, bench_0)):
        L.append("| %d | %s | %s | %s | %d |" % (w, f(b["mean"], 4), pm(b["bias"], b["mcse"], 4), pm(b["coverage"], b["coverage_mcse"], 3), b["reps"]))
    L.append("")
    L.append("With washout 1 the block-mean difference is unbiased and its two-sample interval covers at about the nominal rate, "
             "within Monte Carlo error. Without washout the first period of each block still carries the previous block's policy, "
             "so the estimator targets δ + ρ(L−1)/L (bias ≈ −ρ/L = %s). This is the only setting in this report where the "
             "estimator's assumptions are known to hold." % f(-BENCH["rho"] / BENCH["L"], 4))
    L.append("")
    L.append("## Observations computed from the grid")
    L.append("")
    L.extend(observations(grid))
    L.append("")
    L.append("## What the fleet results do and do not show")
    L.append("")
    L.append("- Favourable bias or coverage in a scenario is evidence for **that simulated setting** (its fleet size, demand, trip lengths, "
             "block length and washout) and nothing more. The fleet simulator does not satisfy the bounded-carryover assumptions of the "
             "switchback procedure automatically: vehicles and pending work persist across block boundaries and the fleet's location "
             "distribution need not forget earlier assignments within a fixed washout.")
    L.append("- The request-level design answers a different question from the all-B versus all-A policy question; changing its standard error cannot repair that.")
    L.append("- Sharp-null cells are the only exact calibration check for the fleet: there the true effect is 0 by construction.")
    L.append("- Demand is exogenous to policy; ridership response, pricing, geographic clusters and sequential monitoring are not modelled.")
    L.append("")
    L.append("## Reproduce")
    L.append("")
    L.append("```")
    L.append("python3 -m unittest discover examples/marketplace/python")
    L.append(grid["command"])
    L.append("python3 examples/marketplace/python/report.py --grid examples/marketplace/results/grid.json --out examples/marketplace/results/REPORT.md")
    L.append("python3 examples/marketplace/python/build_db.py --fixture examples/marketplace/fixtures/hand_worked.json")
    L.append("```")
    L.append("")
    return "\n".join(L)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--grid", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--bench-reps", type=int, default=400)
    a = ap.parse_args(argv)
    with open(a.grid) as fh:
        grid = json.load(fh)
    text = build(grid, a.bench_reps)
    with open(a.out, "w") as fh:
        fh.write(text)
    print("wrote %s (%d lines)" % (a.out, text.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
