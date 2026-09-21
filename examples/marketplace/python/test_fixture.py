"""Tests for the Python fleet simulator, estimators and SQL metrics.

Run:  python3 -m unittest discover examples/marketplace/python
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
FIXTURE = os.path.join(os.path.dirname(HERE), "fixtures", "hand_worked.json")

import build_db  # noqa: E402
from estimators import (benchmark_calibration, experiment, policy_reference,  # noqa: E402
                        request_estimate, switchback_estimate, switchback_randomization_test)
from simulator import DEFAULT_CONFIG, VERSION, eligible, fulfilment, generate_requests, simulate  # noqa: E402
import random  # noqa: E402

ROW_KEYS = ["id", "policy", "block", "status", "vehicle", "pickup", "complete", "wait", "servedInTime"]


def load_fixture():
    with open(FIXTURE) as fh:
        return json.load(fh)


class FixtureReproduction(unittest.TestCase):
    def test_rows_events_and_metrics_match_exactly(self):
        f = load_fixture()
        self.assertEqual(f["version"], VERSION)
        run = simulate(f["config"], "fixed", requests=f["requests"], fleet=f["fleet"], schedule=f["schedule"])
        got = [{k: o[k] for k in ROW_KEYS} for o in run["requests"]]
        self.assertEqual(got, f["expected"])
        self.assertEqual(run["events"], f["events"])
        self.assertAlmostEqual(fulfilment(run["requests"]), f["metrics"]["fulfilment"])
        self.assertEqual(len(eligible(run)), f["metrics"]["eligible"])
        self.assertEqual(sum(1 for o in run["requests"] if o["status"] == "unserved"), f["metrics"]["unserved"])
        self.assertAlmostEqual(switchback_estimate(run, 0)["estimate"], f["metrics"]["switchback"])
        self.assertEqual(run["design"]["schedule"], f["schedule"])
        self.assertIsNone(run["design"]["probability"])

    def test_inputs_are_not_mutated(self):
        f = load_fixture()
        fleet = [dict(v) for v in f["fleet"]]
        simulate(f["config"], "fixed", requests=f["requests"], fleet=fleet, schedule=f["schedule"])
        self.assertEqual(fleet, f["fleet"])


class SimulatorInvariants(unittest.TestCase):
    def test_fleet_conserved_and_no_overlapping_service(self):
        run = simulate({"horizon": 300}, "switchback")
        self.assertEqual(run["fleetCount"], DEFAULT_CONFIG["fleet"])
        self.assertEqual(len({e["vehicle"] for e in run["events"]} | set(range(DEFAULT_CONFIG["fleet"]))), DEFAULT_CONFIG["fleet"])
        complete = {o["id"]: o["complete"] for o in run["requests"] if o["status"] == "served"}
        by_vehicle = {}
        for e in run["events"]:
            by_vehicle.setdefault(e["vehicle"], []).append(e)
        for evs in by_vehicle.values():
            evs.sort(key=lambda e: (e["t"], 0 if e["state"] == "free" else 1))
            busy_until = -1
            for e in evs:
                if e["state"] == "assigned":
                    self.assertGreaterEqual(e["t"], busy_until, "vehicle assigned before it was free")
                    busy_until = complete[e["request"]]
        self.assertTrue(all(o["status"] in ("served", "unserved") for o in run["requests"]))
        served = [o for o in run["requests"] if o["status"] == "served"]
        self.assertEqual(len(served) * 2, len(run["events"]))

    def test_deterministic_for_fixed_seeds(self):
        for kind in ("switchback", "request", "allB"):
            a = simulate({"horizon": 300}, kind)
            b = simulate({"horizon": 300}, kind)
            self.assertEqual(a["requests"], b["requests"])
            self.assertEqual(a["events"], b["events"])
        self.assertNotEqual(simulate({"horizon": 300, "demandSeed": 12}, "allA")["requests"],
                            simulate({"horizon": 300, "demandSeed": 13}, "allA")["requests"])

    def test_designs_match_documentation(self):
        run = simulate({"horizon": 120, "blockLength": 30}, "switchback")
        for i, b in enumerate(run["design"]["schedule"]):
            self.assertEqual((b["start"], b["end"], b["block"]), (i * 30, (i + 1) * 30, i))
        self.assertEqual(len(run["design"]["schedule"]), 5)  # ceil((120 + 30) / 30)
        for o in run["requests"]:
            self.assertEqual(o["policy"], run["design"]["schedule"][o["t"] // 30]["policy"])
            self.assertEqual(o["block"], o["t"] // 30)
        self.assertEqual(run["design"]["probability"], 0.5)
        req = simulate({"horizon": 120}, "request")
        self.assertIsNone(req["requests"][0]["block"])
        self.assertTrue({o["policy"] for o in req["requests"]} <= {"A", "B"})
        self.assertEqual(simulate({"horizon": 60}, "allA")["design"]["schedule"], [])

    def test_sharp_null_makes_B_identical_to_A(self):
        strip = lambda rows: [{k: v for k, v in o.items() if k != "policy"} for o in rows]
        a = simulate({"horizon": 200}, "allA")
        null_b = simulate({"horizon": 200}, "allB", sharp_null=True)
        self.assertEqual(strip(a["requests"]), strip(null_b["requests"]))
        self.assertEqual(a["events"], null_b["events"])
        # Any design under the sharp null reproduces the all-A world (same demand seed).
        sb = simulate({"horizon": 200}, "switchback", sharp_null=True)
        self.assertEqual([(o["status"], o["vehicle"], o["pickup"]) for o in sb["requests"]],
                         [(o["status"], o["vehicle"], o["pickup"]) for o in a["requests"]])
        # Without the sharp null, B differs from A somewhere.
        real_b = simulate({"horizon": 200}, "allB")
        self.assertNotEqual(strip(a["requests"]), strip(real_b["requests"]))

    def test_demand_cycle_is_python_only_and_shifts_arrivals(self):
        cfg = dict(DEFAULT_CONFIG, horizon=400, demandCycle=0.9)
        reqs = generate_requests(cfg, random.Random(3))
        first = sum(1 for r in reqs if r.t < 200)
        second = len(reqs) - first
        self.assertGreater(first, second)
        flat = generate_requests(dict(cfg, demandCycle=0.0), random.Random(3))
        self.assertNotEqual(len(flat), len(reqs))


class Estimators(unittest.TestCase):
    def test_switchback_denominator_and_washout(self):
        run = simulate({"horizon": 240, "blockLength": 30}, "switchback")
        e0 = switchback_estimate(run, 0)
        e5 = switchback_estimate(run, 5)
        self.assertEqual(e0["excluded"], 0)
        self.assertEqual(sum(b["n"] for b in e0["perBlock"]), len(eligible(run)))
        self.assertTrue(0 < e5["excluded"] < len(run["requests"]))
        self.assertEqual(sum(b["n"] for b in e5["perBlock"]), len(eligible(run)) - e5["excluded"])
        self.assertEqual(e0["units"], e0["blocksA"] + e0["blocksB"])

    def test_request_estimate_counts_every_request(self):
        run = simulate({"horizon": 240}, "request")
        e = request_estimate(run)
        self.assertEqual(e["units"], len(run["requests"]))
        self.assertEqual(e["nA"] + e["nB"], e["units"])

    def test_randomization_test_p_value_in_range(self):
        run = simulate({"horizon": 360}, "switchback")
        r = switchback_randomization_test(run, 100)
        self.assertTrue(0 < r["pValue"] <= 1)
        self.assertEqual(r["reps"], 100)
        # Under the sharp null the test is a randomization test of its own design.
        null = switchback_randomization_test(simulate({"horizon": 360}, "switchback", sharp_null=True), 100)
        self.assertTrue(0 < null["pValue"] <= 1)

    def test_policy_reference_and_experiment_shapes(self):
        ref = policy_reference({"horizon": 120}, reps=5, seed=100)
        self.assertEqual(ref["reps"], 5)
        self.assertTrue(ref["mcse"] >= 0)
        ex = experiment({"horizon": 120}, "switchback", reps=4, seed=500, target=ref["estimate"], washout=5)
        s = ex["summary"]
        for k in ("mean", "sd", "mcse", "mean_se", "units", "reject_rate", "reject_mcse", "bias",
                  "coverage", "coverage_mcse", "excluded_share"):
            self.assertIn(k, s)
        self.assertEqual(len(ex["rows"]), 4)
        self.assertEqual(ex["config"]["horizon"], 120)

    def test_benchmark_calibration_within_monte_carlo_error(self):
        c = benchmark_calibration({"blocks": 20, "L": 6, "delta": 0.1, "rho": 0.05, "sigma": 0.1, "washout": 1}, 400)
        self.assertAlmostEqual(c["target"], 0.15)
        self.assertLess(abs(c["bias"]), 3 * c["mcse"], "bias %.4f vs MCSE %.4f" % (c["bias"], c["mcse"]))
        self.assertLess(abs(c["coverage"] - 0.95), 3 * c["coverage_mcse"] + 0.01,
                        "coverage %.3f +- %.3f" % (c["coverage"], c["coverage_mcse"]))
        n = benchmark_calibration({"blocks": 20, "L": 6, "delta": 0.1, "rho": 0.05, "sigma": 0.1, "washout": 0}, 400)
        self.assertLess(n["bias"], -0.005, "without washout the estimator targets delta + rho(L-1)/L")


class SqlMetrics(unittest.TestCase):
    def _db(self):
        conn = sqlite3.connect(":memory:")
        build_db.create_schema(conn)
        return conn

    def test_fixture_metrics_and_wrong_joins(self):
        conn = self._db()
        build_db.build_from_fixture(conn, FIXTURE)
        m = build_db.run_metrics(conn)
        f = load_fixture()["metrics"]
        checks = m["row_count_checks"][0]
        self.assertEqual((checks["eligible_requests"], checks["view_rows"], checks["distinct_request_ids"]), (6, 6, 6))
        self.assertEqual((checks["missing_assignment"], checks["missing_outcome"], checks["assigned_vs_observed_mismatch"]), (0, 0, 0))
        overall = m["fulfilment_overall"][0]
        self.assertEqual((overall["eligible"], overall["unserved"]), (f["eligible"], f["unserved"]))
        self.assertAlmostEqual(overall["fulfilment"], f["fulfilment"])
        blocks = {b["block"]: b for b in m["fulfilment_by_block"]}
        self.assertEqual((blocks[0]["policy"], blocks[0]["n_requests"], blocks[1]["policy"], blocks[1]["n_requests"]), ("A", 4, "B", 2))
        self.assertAlmostEqual(m["switchback_block_weighted_estimate"][0]["estimate"], f["switchback"])
        # The wrong way: the inner join to vehicle events changes the denominator.
        wrong = m["wrong_inner_join_vehicle_events"][0]
        self.assertEqual((wrong["rows_after_join"], wrong["distinct_requests_kept"]), (6, 3))
        self.assertAlmostEqual(wrong["wrong_fulfilment"], 1.0)  # 0.5 is correct
        left = m["wrong_left_join_vehicle_events"][0]
        self.assertEqual(left["rows_after_join"], 9)  # 3 served x 2 events + 3 unserved x 1
        self.assertAlmostEqual(left["wrong_fulfilment"], 6 / 9)
        self.assertAlmostEqual(m["wrong_served_only_denominator"][0]["on_time_share_among_served"], 1.0)
        conn.close()

    def test_half_open_join_matches_simulator_and_closed_join_duplicates_boundaries(self):
        run = simulate({"horizon": 240, "blockLength": 30}, "switchback")
        conn = self._db()
        build_db.load_run(conn, run, "sb", 0)
        m = build_db.run_metrics(conn)
        elig = eligible(run)
        checks = m["row_count_checks"][0]
        self.assertEqual(checks["view_rows"], len(elig))
        self.assertEqual(checks["assigned_vs_observed_mismatch"], 0)
        self.assertAlmostEqual(m["fulfilment_overall"][0]["fulfilment"], fulfilment(elig))
        est = switchback_estimate(run, 0)
        self.assertAlmostEqual(m["switchback_block_weighted_estimate"][0]["estimate"], est["estimate"])
        sql_blocks = {b["block"]: b for b in m["fulfilment_by_block"]}
        for b in est["perBlock"]:
            self.assertEqual(sql_blocks[b["block"]]["n_requests"], b["n"])
            self.assertAlmostEqual(sql_blocks[b["block"]]["fulfilment"], b["y"])
        boundary = sum(1 for o in elig if o["t"] > 0 and o["t"] % 30 == 0)
        self.assertGreater(boundary, 0, "seed chosen so some arrivals fall on a block boundary")
        closed = m["wrong_closed_interval_join"][0]
        self.assertEqual(closed["duplicated_rows"], boundary)
        self.assertEqual(closed["rows_after_join"], len(elig) + boundary)
        conn.close()

    def test_request_design_uses_request_units(self):
        run = simulate({"horizon": 240}, "request")
        conn = self._db()
        build_db.load_run(conn, run, "req", 0)
        m = build_db.run_metrics(conn)
        self.assertEqual(m["row_count_checks"][0]["missing_assignment"], 0)
        e = request_estimate(run)
        by = {r["assigned_policy"]: r for r in m["fulfilment_by_policy_request_weighted"]}
        self.assertEqual((by["A"]["n_requests"], by["B"]["n_requests"]), (e["nA"], e["nB"]))
        self.assertAlmostEqual(by["B"]["fulfilment"] - by["A"]["fulfilment"], e["estimate"])
        self.assertEqual(m["fulfilment_by_block"], [])
        conn.close()


if __name__ == "__main__":
    unittest.main()
