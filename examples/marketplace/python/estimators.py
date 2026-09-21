"""Estimators, randomization test, policy reference, repeated experiments and the validated
finite-history benchmark for the two-zone fleet simulator (port of science/marketplace.js).

Every estimator states its target and assumptions in its `about` string. Nothing here is a
proof of validity for the fleet simulator: the finite-history benchmark is the only setting
in which the switchback interval's assumptions are known to hold.

Requires Python 3.8+ and only the standard library.
"""
from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Optional

from simulator import DEFAULT_CONFIG, eligible, fulfilment, simulate

NAN = float("nan")


def mean(v: List[float]) -> float:
    return sum(v) / len(v) if v else NAN


def variance(v: List[float]) -> float:
    """Sample variance (n-1); NaN when fewer than two values, as in the JavaScript."""
    if len(v) < 2:
        return NAN
    m = mean(v)
    return sum((x - m) ** 2 for x in v) / (len(v) - 1)


def _isfinite(x: Any) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(x)


def two_sample_se(a: List[float], b: List[float]) -> float:
    """sqrt(var(a)/n_a + var(b)/n_b); NaN if either arm has fewer than two units."""
    if len(a) < 2 or len(b) < 2:
        return NAN
    return math.sqrt(variance(a) / len(a) + variance(b) / len(b))


# ---------------------------------------------------------------- request-level estimator
def request_estimate(run: Dict[str, Any]) -> Dict[str, Any]:
    A = [o for o in run["requests"] if o["policy"] == "A"]
    B = [o for o in run["requests"] if o["policy"] == "B"]
    yA = [float(o["servedInTime"]) for o in A]
    yB = [float(o["servedInTime"]) for o in B]
    return {
        "estimate": mean(yB) - mean(yA),
        "se": two_sample_se(yA, yB),
        "units": len(A) + len(B),
        "nA": len(A),
        "nB": len(B),
        "about": ("Difference in fulfilment between B-assigned and A-assigned requests sharing "
                  "one fleet. Its target is the effect of switching a request's own policy while "
                  "the fleet is shared; it is not the all-B versus all-A policy effect."),
    }


# -------------------------------------------------------------------- switchback estimator
def switchback_estimate(run: Dict[str, Any], washout: Optional[int] = None) -> Dict[str, Any]:
    """Block-mean difference, blocks weighted equally, first `washout` minutes of every block
    excluded. Two-sample SE across blocks."""
    cfg = run["config"]
    L = cfg["blockLength"]
    w = cfg["washout"] if washout is None else washout
    elig = eligible(run)
    kept = [o for o in elig if o["t"] - o["block"] * L >= w]
    blocks: Dict[int, Dict[str, Any]] = {}
    for o in kept:
        blocks.setdefault(o["block"], {"policy": o["policy"], "rows": []})["rows"].append(o)
    per = [{"block": b, "policy": v["policy"], "y": fulfilment(v["rows"]), "n": len(v["rows"])}
           for b, v in blocks.items()]
    A = [p["y"] for p in per if p["policy"] == "A"]
    B = [p["y"] for p in per if p["policy"] == "B"]
    return {
        "estimate": mean(B) - mean(A),
        "se": two_sample_se(A, B),
        "units": len(per),
        "blocksA": len(A),
        "blocksB": len(B),
        "excluded": len(elig) - len(kept),
        "eligible": len(elig),
        "perBlock": per,
        "about": ("Difference in block-level fulfilment between B blocks and A blocks, blocks "
                  "weighted equally, with the first `washout` minutes of each block excluded. "
                  "Valid as a two-sample interval when block outcomes are independent given "
                  "assignment and carryover ends within the washout."),
    }


def switchback_randomization_test(run: Dict[str, Any], reps: int = 400, seed: int = 3,
                                  washout: Optional[int] = None) -> Dict[str, Any]:
    """Sharp-null randomization test: re-randomize the BLOCK sequence under the actual design
    (independent fair coins per block) and recompute the statistic. Tests H0: the policy has
    no effect on any block outcome. It does not shuffle individual requests and it is not a
    confidence interval."""
    rng = random.Random(seed)
    observed = switchback_estimate(run, washout)["estimate"]
    L = run["config"]["blockLength"]
    n_blocks = len(run["design"]["schedule"])
    extreme = 0
    for _ in range(reps):
        relabel = ["B" if rng.random() < 0.5 else "A" for _ in range(n_blocks)]
        fake = dict(run)
        fake["requests"] = [dict(o, policy=relabel[o["t"] // L]) for o in run["requests"]]
        s = switchback_estimate(fake, washout)["estimate"]
        if _isfinite(s) and abs(s) >= abs(observed) - 1e-12:
            extreme += 1
    return {"observed": observed, "pValue": (extreme + 1) / (reps + 1), "reps": reps}


# ----------------------------------------------------------------------- policy reference
def policy_reference(cfg: Dict[str, Any], reps: int = 40, seed: int = 100) -> Dict[str, Any]:
    """Full-policy reference: independent repeated all-B and all-A worlds with matched
    demand (same demandSeed within a replication), reported with Monte Carlo uncertainty.
    This is a simulation estimate of the target, not a known exact truth."""
    diffs = []
    for r in range(reps):
        c = dict(cfg, demandSeed=seed + r, assignSeed=1)
        b = simulate(c, "allB")
        a = simulate(c, "allA")
        diffs.append(fulfilment(eligible(b)) - fulfilment(eligible(a)))
    return {"estimate": mean(diffs), "mcse": math.sqrt(variance(diffs) / reps), "reps": reps,
            "diffs": diffs}


# ------------------------------------------------------------------- repeated experiments
def experiment_rows(cfg: Dict[str, Any], design_kind: str, reps: int = 60, seed: int = 500,
                    sharp_null: bool = False, washout: Optional[int] = None) -> List[Dict[str, Any]]:
    """One row per replication: estimate, se, units, excluded, eligible."""
    rows = []
    for r in range(reps):
        c = dict(cfg, demandSeed=seed + r, assignSeed=seed + 1000 + r)
        run = simulate(c, design_kind, sharp_null=sharp_null)
        if design_kind == "switchback":
            e = switchback_estimate(run, washout)
            excluded, elig = e["excluded"], e["eligible"]
        else:
            e = request_estimate(run)
            excluded, elig = 0, len(eligible(run))
        rows.append({"estimate": e["estimate"], "se": e["se"], "units": e["units"],
                     "excluded": excluded, "eligible": elig})
    return rows


def summarize(rows: List[Dict[str, Any]], target: Optional[float] = None) -> Dict[str, Any]:
    """Mean/sd/MCSE of the estimates, mean SE, reject rate at |est| > 1.96 se, and, when a
    target is given, bias and 95% interval coverage of that target with MC uncertainty."""
    ests = [x["estimate"] for x in rows if _isfinite(x["estimate"])]
    ses = [x["se"] for x in rows if _isfinite(x["se"])]
    n = len(rows)
    s: Dict[str, Any] = {
        "mean": mean(ests),
        "sd": math.sqrt(variance(ests)) if len(ests) > 1 else NAN,
        "mcse": math.sqrt(variance(ests) / len(ests)) if len(ests) > 1 else NAN,
        "mean_se": mean(ses),
        "units": mean([x["units"] for x in rows]),
        "reps": len(ests),
        "excluded_share": mean([x["excluded"] / x["eligible"] for x in rows if x["eligible"]]),
    }
    reject = sum(1 for x in rows if _isfinite(x["se"]) and abs(x["estimate"]) > 1.96 * x["se"])
    s["reject_rate"] = reject / n if n else NAN
    s["reject_mcse"] = math.sqrt(s["reject_rate"] * (1 - s["reject_rate"]) / n) if n else NAN
    if target is not None and _isfinite(target):
        s["target"] = target
        s["bias"] = s["mean"] - target
        cover = sum(1 for x in rows if _isfinite(x["se"]) and abs(x["estimate"] - target) <= 1.96 * x["se"])
        s["coverage"] = cover / n if n else NAN
        s["coverage_mcse"] = math.sqrt(s["coverage"] * (1 - s["coverage"]) / n) if n else NAN
    return s


def experiment(cfg: Dict[str, Any], design_kind: str, reps: int = 60, seed: int = 500,
               target: Optional[float] = None, sharp_null: bool = False,
               washout: Optional[int] = None) -> Dict[str, Any]:
    rows = experiment_rows(cfg, design_kind, reps, seed, sharp_null, washout)
    full = dict(DEFAULT_CONFIG)
    full.update(cfg)
    return {"rows": rows, "summary": summarize(rows, target), "design": design_kind, "config": full}


# ------------------------------------------------- validated finite-history benchmark
def benchmark(blocks: int = 20, L: int = 6, mu: float = 0.5, delta: float = 0.1, rho: float = 0.05,
              sigma: float = 0.1, washout: int = 1, seed: int = 1) -> Dict[str, Any]:
    """Periods t = 1..T, policy z_t in {0,1} constant within blocks of length L, blocks assigned
    independently with probability 1/2. Outcome y_t = mu + delta*z_t + rho*z_{t-1} + e_t with
    e_t iid N(0, sigma^2). Full-policy effect: delta + rho. Carryover lasts exactly one period,
    so dropping the first period of every block makes the block-mean difference unbiased for
    delta + rho, and block means are independent given assignment: the two-sample interval
    is valid. Without washout the first period of each block carries the previous block's
    policy (mean 1/2 in expectation over the design), so the block-mean difference targets
    delta + rho(L-1)/L: bias about -rho/L."""
    rng = random.Random(seed)
    z = [1 if rng.random() < 0.5 else 0 for _ in range(blocks)]
    per = []
    prev = 0
    for b in range(blocks):
        ys = []
        for k in range(L):
            z_prev = prev if k == 0 else z[b]
            u1 = max(1e-12, rng.random())
            u2 = rng.random()
            e = sigma * math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)  # Box-Muller
            y = mu + delta * z[b] + rho * z_prev + e
            if k >= washout:
                ys.append(y)
        per.append({"policy": "B" if z[b] else "A", "y": mean(ys), "n": len(ys)})
        prev = z[b]
    A = [p["y"] for p in per if p["policy"] == "A"]
    B = [p["y"] for p in per if p["policy"] == "B"]
    return {
        "estimate": mean(B) - mean(A),
        "se": two_sample_se(A, B),
        "target": delta + rho,
        "naiveBias": -rho / L if washout == 0 else 0.0,
        "perBlock": per,
        "z": z,
    }


def benchmark_calibration(opts: Optional[Dict[str, Any]] = None, reps: int = 400, seed: int = 900) -> Dict[str, Any]:
    """Repeat the benchmark; report bias and coverage with Monte Carlo standard errors.
    A single coverage percentage is a random quantity; compare it with its MCSE."""
    opts = dict(opts or {})
    rows = [benchmark(**dict(opts, seed=seed + r)) for r in range(reps)]
    ests = [x["estimate"] for x in rows]
    target = rows[0]["target"]
    cover = sum(1 for x in rows if _isfinite(x["se"]) and abs(x["estimate"] - target) <= 1.96 * x["se"])
    cov = cover / reps
    return {
        "target": target,
        "mean": mean(ests),
        "bias": mean(ests) - target,
        "mcse": math.sqrt(variance(ests) / reps),
        "coverage": cov,
        "coverage_mcse": math.sqrt(cov * (1 - cov) / reps),
        "reps": reps,
    }
