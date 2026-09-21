"""Load simulated runs into the SQL schema (sqlite3, stdlib) and run sql/metrics.sql.

Usage:
  python3 examples/marketplace/python/build_db.py --fixture examples/marketplace/fixtures/hand_worked.json \
      --db examples/marketplace/results/hand_worked.sqlite
  python3 examples/marketplace/python/build_db.py --design switchback --horizon 240 --db :memory:

DuckDB would be a drop-in for the same schema and queries; sqlite3 is used so the example has
no dependencies outside the Python standard library.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
import sys
from typing import Any, Dict, List, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from simulator import VERSION, simulate  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.join(os.path.dirname(HERE), "sql")
SCHEMA = os.path.join(SQL_DIR, "schema.sql")
METRICS = os.path.join(SQL_DIR, "metrics.sql")


def create_schema(conn: sqlite3.Connection) -> None:
    with open(SCHEMA) as fh:
        conn.executescript(fh.read())


def load_run(conn: sqlite3.Connection, run: Dict[str, Any], experiment_id: str, replication: int = 0,
             sharp_null: bool = False) -> None:
    """Insert one simulate() result into the schema."""
    cfg = run["config"]
    horizon, follow_up = cfg["horizon"], cfg["followUp"]
    conn.execute(
        "INSERT INTO runs VALUES (?,?,?,?,?,?,?,?,?)",
        (experiment_id, replication, run["version"], run["design"]["kind"], int(sharp_null),
         horizon, follow_up, run["fleetCount"], json.dumps(cfg, sort_keys=True)),
    )
    # Assignment units.
    kind = run["design"]["kind"]
    prob = run["design"]["probability"]
    if kind in ("switchback", "fixed"):
        conn.executemany(
            "INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?)",
            [(experiment_id, replication, "block", b["block"], b["policy"], b["start"], b["end"], prob)
             for b in run["design"]["schedule"]],
        )
    elif kind in ("allA", "allB"):
        # One deterministic block covering the whole run, so block metrics still work.
        conn.execute("INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?)",
                     (experiment_id, replication, "block", 0, "B" if kind == "allB" else "A",
                      0, horizon + follow_up, None))
    elif kind == "request":
        conn.executemany(
            "INSERT INTO assignments VALUES (?,?,?,?,?,?,?,?)",
            [(experiment_id, replication, "request", o["id"], o["policy"], None, None, prob)
             for o in run["requests"]],
        )
    else:
        raise ValueError(kind)
    # Requests, outcomes, events. Pickup zone comes from the 'assigned' event of the request.
    assigned_zone = {e["request"]: e["zone"] for e in run["events"] if e["state"] == "assigned"}
    req_rows, out_rows = [], []
    for o in run["requests"]:
        req_rows.append((experiment_id, replication, o["id"], o["t"], o["origin"], o["dest"],
                         cfg["maxWait"], int(0 <= o["t"] < horizon)))
        served = o["status"] == "served"
        pz = assigned_zone.get(o["id"]) if served else None
        out_rows.append((experiment_id, replication, o["id"], o["status"], o["policy"],
                         o["vehicle"], o["pickup"], o["complete"], o["wait"],
                         (o["complete"] - o["pickup"]) if served else None,
                         pz, (int(pz != o["origin"]) if served else None), o["servedInTime"]))
    conn.executemany("INSERT INTO requests VALUES (?,?,?,?,?,?,?,?)", req_rows)
    conn.executemany("INSERT INTO request_outcomes VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", out_rows)
    conn.executemany(
        "INSERT INTO vehicle_events VALUES (?,?,?,?,?,?,?,?)",
        [(experiment_id, replication, i, e["vehicle"], e["t"], e["state"], e["zone"], e["request"])
         for i, e in enumerate(run["events"])],
    )
    conn.commit()


def metric_sections() -> List[Tuple[str, str]]:
    """Split metrics.sql on '-- name:' markers."""
    with open(METRICS) as fh:
        text = fh.read()
    parts = re.split(r"^-- name:\s*(\S+)\s*$", text, flags=re.M)
    out = []
    for i in range(1, len(parts), 2):
        sql = "\n".join(line for line in parts[i + 1].splitlines() if not line.strip().startswith("--"))
        out.append((parts[i], sql.strip()))
    return out


def run_metrics(conn: sqlite3.Connection) -> Dict[str, List[Dict[str, Any]]]:
    """Execute every section; return {name: rows-as-dicts} for the ones that return rows."""
    results: Dict[str, List[Dict[str, Any]]] = {}
    for name, sql in metric_sections():
        if sql.upper().startswith(("DROP", "CREATE")):
            conn.executescript(sql)
            continue
        cur = conn.execute(sql)
        cols = [d[0] for d in cur.description]
        results[name] = [dict(zip(cols, row)) for row in cur.fetchall()]
    return results


def build_from_fixture(conn: sqlite3.Connection, fixture_path: str, experiment_id: str = "fixture") -> Dict[str, Any]:
    with open(fixture_path) as fh:
        f = json.load(fh)
    run = simulate(f["config"], "fixed", requests=f["requests"], fleet=f["fleet"], schedule=f["schedule"])
    load_run(conn, run, experiment_id, 0)
    return run


def print_results(results: Dict[str, List[Dict[str, Any]]]) -> None:
    for name, rows in results.items():
        print("\n== %s (%d rows)" % (name, len(rows)))
        if not rows:
            continue
        cols = list(rows[0].keys())
        print(" | ".join(cols))
        for r in rows[:20]:
            print(" | ".join("" if r[c] is None else (("%.4f" % r[c]) if isinstance(r[c], float) else str(r[c])) for c in cols))
        if len(rows) > 20:
            print("... %d more" % (len(rows) - 20))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fixture", help="load examples/marketplace/fixtures/hand_worked.json")
    ap.add_argument("--design", default=None, help="simulate one run: allA|allB|request|switchback")
    ap.add_argument("--horizon", type=int, default=240)
    ap.add_argument("--block-length", type=int, default=30)
    ap.add_argument("--demand-seed", type=int, default=11)
    ap.add_argument("--assign-seed", type=int, default=7)
    ap.add_argument("--db", default=":memory:", help="sqlite file path or :memory:")
    ap.add_argument("--json", default=None, help="write metric results as JSON to this path")
    a = ap.parse_args(argv)
    if a.db != ":memory:" and os.path.exists(a.db):
        os.remove(a.db)
    conn = sqlite3.connect(a.db)
    create_schema(conn)
    if a.fixture:
        build_from_fixture(conn, a.fixture)
    if a.design:
        run = simulate({"horizon": a.horizon, "blockLength": a.block_length, "demandSeed": a.demand_seed,
                        "assignSeed": a.assign_seed}, a.design)
        load_run(conn, run, a.design, 0)
    if not a.fixture and not a.design:
        ap.error("give --fixture and/or --design")
    results = run_metrics(conn)
    print("simulator version %s; database %s" % (VERSION, a.db))
    print_results(results)
    if a.json:
        with open(a.json, "w") as fh:
            json.dump(results, fh, indent=2)
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
