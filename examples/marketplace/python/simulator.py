"""Two-zone shared-fleet simulator: a pure-Python port of science/marketplace.js.

Synthetic teaching model. Nothing here is calibrated to any real service and nothing
here says anything about driving safety.

SPEC (identical to the SPEC comment at the top of science/marketplace.js; the two
implementations are checked against examples/marketplace/fixtures/hand_worked.json):
  - Time is integer minutes t = 0 ... horizon-1. Two zones, 0 and 1, adjacent.
  - Vehicles: {id, zone, freeAt}. A vehicle is free at t if freeAt <= t.
  - Requests: {id, t, origin, dest, maxWait}. Eligible requests are those arriving in
    [0, horizon). Requests arriving after horizon - followUp are still followed for
    followUp minutes so every eligible request gets a terminal status.
  - Each minute: expiry first, then waiting requests (ordered by arrival then id) are
    matched, then the minute's new arrivals (ordered by id). A request keeps the policy
    assigned at its arrival.
  - Policy A: choose a free vehicle in the origin zone. Policy B: same; if none, choose a
    free vehicle in the other zone. Tie-break: smallest freeAt, then smallest id.
  - Pickup takes pickupLocal minutes from the same zone, pickupCross from the other zone.
    Trip takes tripLocal if origin = dest, else tripCross. The vehicle ends at dest and is
    free at pickup + trip. Served-within-deadline means pickup - arrival <= deadline.
  - A request expires unserved when t - arrival > maxWait and it is still unmatched.
  - Demand and travel inputs come from the demand RNG; assignments come from the assign RNG.

Random streams: Python uses random.Random(seed); the JavaScript uses a mulberry32-style
generator. The same seed therefore produces DIFFERENT demand and assignment draws in the
two languages. Cross-language agreement is checked on the explicit fixture (given requests,
fleet and schedule), never on seeds. `generate_requests` also accepts a `demandCycle`
amplitude that the JavaScript generator does not implement (see the docstring).

Requires Python 3.8+ and only the standard library.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, asdict
from typing import Any, Callable, Dict, List, Optional

VERSION = "1.0.0"  # matches science/marketplace.js VERSION

DEFAULT_CONFIG: Dict[str, Any] = {
    "horizon": 240,
    "followUp": 30,
    "fleet": 6,
    "demandPerMinute": 0.35,
    "zoneShare": 0.5,
    "crossDestShare": 0.3,
    "maxWait": 8,
    "deadline": 6,
    "pickupLocal": 2,
    "pickupCross": 4,
    "tripLocal": 8,
    "tripCross": 14,
    "blockLength": 30,
    "washout": 0,
    "demandSeed": 11,
    "assignSeed": 7,
    # Python-only extension (0 reproduces the JavaScript generator's constant rate):
    # per-minute rate = demandPerMinute * (1 + demandCycle * sin(2*pi*t/horizon)).
    "demandCycle": 0.0,
}

Policy = str  # "A" or "B"


@dataclass
class Vehicle:
    id: int
    zone: int
    freeAt: int = 0


@dataclass
class Request:
    id: int
    t: int
    origin: int
    dest: int
    maxWait: int


def _as_vehicle(v: Any) -> Vehicle:
    if isinstance(v, Vehicle):
        return Vehicle(v.id, v.zone, v.freeAt)
    return Vehicle(int(v["id"]), int(v["zone"]), int(v.get("freeAt", 0)))


def _as_request(r: Any, max_wait_default: int) -> Request:
    if isinstance(r, Request):
        return Request(r.id, r.t, r.origin, r.dest, r.maxWait)
    return Request(int(r["id"]), int(r["t"]), int(r["origin"]), int(r["dest"]),
                   int(r.get("maxWait", max_wait_default)))


def demand_rate(cfg: Dict[str, Any], t: int) -> float:
    """Per-minute arrival rate at minute t. Constant unless demandCycle != 0."""
    amp = float(cfg.get("demandCycle", 0.0) or 0.0)
    base = float(cfg["demandPerMinute"])
    if amp == 0.0:
        return base
    return max(0.0, base * (1.0 + amp * math.sin(2.0 * math.pi * t / cfg["horizon"])))


def generate_requests(cfg: Dict[str, Any], rng: random.Random) -> List[Request]:
    """Exogenous demand: capped Poisson arrivals per minute (inversion, cap 8, as in the
    JavaScript), origin by zone share, destination by cross-destination share.

    `demandCycle` (Python only) modulates the rate sinusoidally over the horizon; the
    JavaScript generator has a constant rate, so JavaScript results with demandCycle set
    would not be comparable. With demandCycle = 0 the two generators follow the same
    algorithm but consume different random streams."""
    reqs: List[Request] = []
    next_id = 0
    for t in range(cfg["horizon"]):
        lam = demand_rate(cfg, t)
        k = 0
        p = math.exp(-lam)
        u = rng.random()
        acc = p
        while u > acc and k < 8:
            k += 1
            p *= lam / k
            acc += p
        for _ in range(k):
            origin = 0 if rng.random() < cfg["zoneShare"] else 1
            dest = (1 - origin) if rng.random() < cfg["crossDestShare"] else origin
            reqs.append(Request(next_id, t, origin, dest, cfg["maxWait"]))
            next_id += 1
    return reqs


def initial_fleet(cfg: Dict[str, Any], rng: random.Random) -> List[Vehicle]:
    """Vehicles start free, spread across zones. The initial-state distribution is part of
    the estimand: comparison worlds start from the same distribution."""
    return [Vehicle(i, 0 if rng.random() < cfg["zoneShare"] else 1, 0) for i in range(cfg["fleet"])]


@dataclass
class Design:
    kind: str
    schedule: List[Dict[str, Any]]
    probability: Optional[float]
    policy_at: Callable[[Request], Policy]
    block_of: Optional[Callable[[int], int]]


def design(kind: str, cfg: Dict[str, Any], rng: random.Random) -> Design:
    """Assignment designs. Each yields policy_at(request) in {"A", "B"} plus a schedule."""
    if kind in ("allA", "allB"):
        z = "B" if kind == "allB" else "A"
        return Design(kind, [], None, lambda r: z, None)
    if kind == "request":
        draws: Dict[int, Policy] = {}

        def policy_at(r: Request) -> Policy:
            if r.id not in draws:
                draws[r.id] = "B" if rng.random() < 0.5 else "A"
            return draws[r.id]

        return Design(kind, [], 0.5, policy_at, None)
    if kind == "fixed":
        schedule = [dict(b) for b in cfg["schedule"]]
        L = schedule[0]["end"] - schedule[0]["start"]

        def policy_at(r: Request) -> Policy:
            for b in schedule:
                if b["start"] <= r.t < b["end"]:
                    return b["policy"]
            raise ValueError("No block covers arrival time %d" % r.t)

        return Design(kind, schedule, None, policy_at, lambda t: t // L)
    if kind == "switchback":
        L = cfg["blockLength"]
        blocks = math.ceil((cfg["horizon"] + cfg["followUp"]) / L)
        schedule = [
            {"block": b, "start": b * L, "end": (b + 1) * L,  # half-open [start, end)
             "policy": "B" if rng.random() < 0.5 else "A"}
            for b in range(blocks)
        ]
        return Design(kind, schedule, 0.5, lambda r: schedule[r.t // L]["policy"], lambda t: t // L)
    raise ValueError("Unknown design " + kind)


def simulate(config: Optional[Dict[str, Any]] = None, design_kind: str = "allA", requests=None,
             fleet=None, schedule=None, sharp_null: bool = False) -> Dict[str, Any]:
    """Run the fleet through one experiment.

    Returns {"version", "config", "design": {"kind", "schedule", "probability"},
    "requests": [row...], "events": [event...], "fleetCount"} with the same field names as
    the JavaScript. Rows: id, t, origin, dest, policy, block, status, vehicle, pickup,
    complete, wait, servedInTime. Events: t, vehicle, state, zone, request.

    `requests`, `fleet` (lists of dicts or dataclasses) and `schedule` override the
    generated inputs; inputs are copied, never mutated. `sharp_null=True` makes policy B
    behave exactly as A (no cross-zone search), which gives an exact no-effect world."""
    c = dict(DEFAULT_CONFIG)
    c.update(config or {})
    if schedule is not None:
        c["schedule"] = [dict(b) for b in schedule]
    demand_rng = random.Random(c["demandSeed"])
    assign_rng = random.Random(c["assignSeed"])
    reqs = ([_as_request(r, c["maxWait"]) for r in requests]
            if requests is not None else generate_requests(c, demand_rng))
    vehicles = ([_as_vehicle(v) for v in fleet]
                if fleet is not None else initial_fleet(c, demand_rng))
    d = design(design_kind, c, assign_rng)
    end = c["horizon"] + c["followUp"]

    def search_other(policy: Policy) -> bool:
        return policy == "B" and not sharp_null

    outcomes: List[Dict[str, Any]] = []
    for r in reqs:
        outcomes.append({
            "id": r.id, "t": r.t, "origin": r.origin, "dest": r.dest,
            "policy": d.policy_at(r),
            "block": d.block_of(r.t) if d.block_of else None,
            "status": "waiting", "vehicle": None, "pickup": None, "complete": None,
            "wait": None, "servedInTime": 0,
            "_maxWait": r.maxWait,
        })
    by_arrival: Dict[int, List[Dict[str, Any]]] = {}
    for o in outcomes:
        by_arrival.setdefault(o["t"], []).append(o)

    events: List[Dict[str, Any]] = []

    def match(o: Dict[str, Any], t: int) -> bool:
        free = [v for v in vehicles if v.freeAt <= t]

        def pick(zone: int) -> Optional[Vehicle]:
            cands = [v for v in free if v.zone == zone]
            return min(cands, key=lambda v: (v.freeAt, v.id)) if cands else None

        v = pick(o["origin"])
        pickup_time = c["pickupLocal"]
        if v is None and search_other(o["policy"]):
            v = pick(1 - o["origin"])
            pickup_time = c["pickupCross"]
        if v is None:
            return False
        pickup = t + pickup_time
        trip = c["tripLocal"] if o["origin"] == o["dest"] else c["tripCross"]
        o["status"] = "served"
        o["vehicle"] = v.id
        o["pickup"] = pickup
        o["complete"] = pickup + trip
        o["wait"] = pickup - o["t"]
        o["servedInTime"] = 1 if o["wait"] <= c["deadline"] else 0
        events.append({"t": t, "vehicle": v.id, "state": "assigned", "zone": v.zone, "request": o["id"]})
        events.append({"t": o["complete"], "vehicle": v.id, "state": "free", "zone": o["dest"], "request": o["id"]})
        v.freeAt = o["complete"]
        v.zone = o["dest"]
        return True

    waiting: List[Dict[str, Any]] = []
    for t in range(end):
        # Expire, then match waiting requests in arrival order, then new arrivals.
        still = []
        for o in waiting:
            if t - o["t"] > o["_maxWait"]:
                o["status"] = "unserved"
            else:
                still.append(o)
        waiting = [o for o in still if not match(o, t)]
        for o in by_arrival.get(t, []):
            if not match(o, t):
                waiting.append(o)
    for o in waiting:
        o["status"] = "unserved"
    for o in outcomes:
        del o["_maxWait"]
    return {
        "version": VERSION,
        "config": c,
        "design": {"kind": d.kind, "schedule": d.schedule, "probability": d.probability},
        "requests": outcomes,
        "events": events,
        "fleetCount": len(vehicles),
    }


def eligible(run: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Rows for requests arriving in [0, horizon). All eligible requests stay in the
    denominator whatever their terminal status."""
    return [o for o in run["requests"] if o["t"] < run["config"]["horizon"]]


def fulfilment(rows: List[Dict[str, Any]]) -> float:
    """Primary metric: fraction of eligible requests served within the deadline."""
    if not rows:
        return float("nan")
    return sum(o["servedInTime"] for o in rows) / len(rows)


def vehicle_as_dict(v: Vehicle) -> Dict[str, Any]:
    return asdict(v)
