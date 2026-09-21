"""Run the simulation grid and write results/grid.json (the browser panel reads this file).

Usage:
  python3 examples/marketplace/python/run_grid.py \
      --config examples/marketplace/configs/grid.json --out examples/marketplace/results/grid.json

For every scenario: the full-policy reference (independent all-B and all-A worlds, matched
demand seeds, MCSE), then one cell per design x blockLength x washout x sharpNull with `reps`
replications. Switchback cells that differ only in washout share the same simulated runs
(the washout is an analysis choice, not a simulation input); request-level cells have one
blockLength/washout entry (null / 0) because those settings do not apply.

Targets: for sharpNull = false, bias and coverage are measured against the scenario's policy
reference; for sharpNull = true the policies are identical, so the target is exactly 0 and
reject_rate is the false-positive rate.

Deterministic given the seeds in the config. Stdlib only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from estimators import (experiment_rows, policy_reference, request_estimate,  # noqa: E402
                        summarize, switchback_estimate)
from simulator import DEFAULT_CONFIG, VERSION, eligible, simulate  # noqa: E402


def switchback_cells(cfg: Dict[str, Any], reps: int, seed: int, sharp_null: bool,
                     washouts: List[int]) -> Dict[int, List[Dict[str, Any]]]:
    """Simulate once per replication, evaluate every washout on the same runs."""
    rows: Dict[int, List[Dict[str, Any]]] = {w: [] for w in washouts}
    for r in range(reps):
        c = dict(cfg, demandSeed=seed + r, assignSeed=seed + 1000 + r)
        run = simulate(c, "switchback", sharp_null=sharp_null)
        for w in washouts:
            e = switchback_estimate(run, w)
            rows[w].append({"estimate": e["estimate"], "se": e["se"], "units": e["units"],
                            "excluded": e["excluded"], "eligible": e["eligible"]})
    return rows


def cell_record(scenario: str, design: str, block_length, washout: int, sharp_null: bool,
                rows: List[Dict[str, Any]], target: float) -> Dict[str, Any]:
    s = summarize(rows, target)
    return {
        "scenario": scenario,
        "design": design,
        "blockLength": block_length,
        "washout": washout,
        "sharpNull": sharp_null,
        "reps": s["reps"],
        "mean": s["mean"],
        "sd": s["sd"],
        "mcse": s["mcse"],
        "meanSE": s["mean_se"],
        "units": s["units"],
        "bias_vs_policy": s["bias"],
        "coverage_policy": s["coverage"],
        "coverage_policy_mcse": s["coverage_mcse"],
        "reject_rate": s["reject_rate"],
        "reject_mcse": s["reject_mcse"],
        "excluded_share": s["excluded_share"],
    }


def run_grid(grid: Dict[str, Any], log=print) -> Dict[str, Any]:
    reps = int(grid.get("reps", 200))
    seed = int(grid.get("experimentSeed", 500))
    ref_reps = int(grid.get("referenceReps", 200))
    ref_seed = int(grid.get("referenceSeed", 100))
    sharp_nulls = [bool(x) for x in grid.get("sharpNull", [False, True])]
    designs = grid.get("designs", {"request": {}, "switchback": {"blockLengths": [30, 60], "washouts": [0, 5]}})
    out: Dict[str, Any] = {"version": VERSION, "generated": None, "command": None,
                           "scenarios": {}, "reference": [], "cells": []}
    for name, sc in grid["scenarios"].items():
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(sc["config"])
        out["scenarios"][name] = {"label": sc.get("label", name), "config": cfg}
        t0 = time.time()
        ref = policy_reference(cfg, ref_reps, ref_seed)
        out["reference"].append({"scenario": name, "policyEffect": ref["estimate"],
                                 "mcse": ref["mcse"], "reps": ref["reps"]})
        log("%-12s reference %.4f (mcse %.4f) [%.1fs]" % (name, ref["estimate"], ref["mcse"], time.time() - t0))
        for sharp in sharp_nulls:
            target = 0.0 if sharp else ref["estimate"]
            if "request" in designs:
                t0 = time.time()
                rows = experiment_rows(cfg, "request", reps, seed, sharp)
                out["cells"].append(cell_record(name, "request", None, 0, sharp, rows, target))
                log("%-12s request      sharp=%-5s mean %.4f [%.1fs]" % (name, sharp, out["cells"][-1]["mean"], time.time() - t0))
            if "switchback" in designs:
                for L in designs["switchback"].get("blockLengths", [30, 60]):
                    t0 = time.time()
                    washouts = designs["switchback"].get("washouts", [0, 5])
                    by_w = switchback_cells(dict(cfg, blockLength=L), reps, seed, sharp, washouts)
                    for w in washouts:
                        out["cells"].append(cell_record(name, "switchback", L, w, sharp, by_w[w], target))
                    log("%-12s switchback L=%-3d sharp=%-5s means %s [%.1fs]" % (
                        name, L, sharp, ", ".join("w%d %.4f" % (w, out["cells"][-len(washouts) + i]["mean"]) for i, w in enumerate(washouts)),
                        time.time() - t0))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--reps", type=int, default=None, help="override reps for a quick run (recorded in the output)")
    a = ap.parse_args(argv)
    with open(a.config) as fh:
        grid = json.load(fh)
    if a.reps is not None:
        grid["reps"] = a.reps
        grid["referenceReps"] = a.reps
    start = time.time()
    out = run_grid(grid)
    out["generated"] = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    out["command"] = "python3 examples/marketplace/python/run_grid.py --config %s --out %s%s" % (
        a.config, a.out, (" --reps %d" % a.reps) if a.reps is not None else "")
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w") as fh:
        json.dump(out, fh, indent=1)
    print("wrote %s: %d scenarios, %d cells, %.1f s" % (a.out, len(out["scenarios"]), len(out["cells"]), time.time() - start))
    return 0


if __name__ == "__main__":
    sys.exit(main())
