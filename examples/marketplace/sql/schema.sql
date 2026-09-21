-- Schema for the synthetic two-zone fleet experiments (examples/marketplace).
-- SQLite dialect via Python's built-in sqlite3; DuckDB accepts the same statements.
-- Every table carries the (experiment_id, replication) keys so several runs can share one file.

DROP TABLE IF EXISTS runs;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS assignments;
DROP TABLE IF EXISTS request_outcomes;
DROP TABLE IF EXISTS vehicle_events;

-- One row per simulated run: frozen configuration, simulator version, design.
CREATE TABLE runs (
  experiment_id     TEXT    NOT NULL,
  replication       INTEGER NOT NULL,
  simulator_version TEXT    NOT NULL,
  design            TEXT    NOT NULL,          -- allA | allB | request | switchback | fixed
  sharp_null        INTEGER NOT NULL DEFAULT 0,
  horizon           INTEGER NOT NULL,
  follow_up         INTEGER NOT NULL,
  fleet_count       INTEGER NOT NULL,
  config_json       TEXT    NOT NULL,
  PRIMARY KEY (experiment_id, replication)
);

-- Every generated request, eligible or not. Eligibility = arrival in [0, horizon).
CREATE TABLE requests (
  experiment_id TEXT    NOT NULL,
  replication   INTEGER NOT NULL,
  request_id    INTEGER NOT NULL,
  arrival_t     INTEGER NOT NULL,
  origin        INTEGER NOT NULL,
  dest          INTEGER NOT NULL,
  max_wait      INTEGER NOT NULL,
  eligible      INTEGER NOT NULL,              -- 1 if 0 <= arrival_t < horizon
  PRIMARY KEY (experiment_id, replication, request_id)
);

-- Assignment units. unit_kind = 'block': policy applies to arrivals with
-- interval_start <= arrival_t < interval_end (half-open). unit_kind = 'request': the unit is one
-- request (unit_id = request_id); interval columns are NULL.
CREATE TABLE assignments (
  experiment_id  TEXT    NOT NULL,
  replication    INTEGER NOT NULL,
  unit_kind      TEXT    NOT NULL CHECK (unit_kind IN ('block', 'request')),
  unit_id        INTEGER NOT NULL,
  policy         TEXT    NOT NULL CHECK (policy IN ('A', 'B')),
  interval_start INTEGER,
  interval_end   INTEGER,
  probability    REAL,                          -- P(policy = B) under the design; NULL if fixed
  PRIMARY KEY (experiment_id, replication, unit_kind, unit_id)
);

-- Terminal status and realized execution. `observed_policy` is the policy the simulator
-- actually applied; the metrics derive the ASSIGNED policy from `assignments` and compare.
-- Realized execution (vehicle, pickup zone, cross-zone pickup) is kept separate from assignment:
-- a B-assigned request may still be served locally.
CREATE TABLE request_outcomes (
  experiment_id     TEXT    NOT NULL,
  replication       INTEGER NOT NULL,
  request_id        INTEGER NOT NULL,
  status            TEXT    NOT NULL CHECK (status IN ('served', 'unserved')),
  observed_policy   TEXT    NOT NULL,
  vehicle_id        INTEGER,                    -- NULL when unserved
  pickup_t          INTEGER,
  complete_t        INTEGER,
  wait_minutes      INTEGER,
  trip_minutes      INTEGER,                    -- realized in-vehicle minutes (no distances in the model)
  pickup_zone       INTEGER,                    -- zone of the vehicle when it was assigned
  cross_zone_pickup INTEGER,                    -- 1 if pickup_zone <> origin (realized fallback)
  served_in_time    INTEGER NOT NULL,           -- 1 if served and wait <= deadline, else 0
  PRIMARY KEY (experiment_id, replication, request_id)
);

-- Raw vehicle state changes. Each served request produces TWO rows (assigned, free);
-- unserved requests produce none. Never join this table directly into request metrics.
CREATE TABLE vehicle_events (
  experiment_id TEXT    NOT NULL,
  replication   INTEGER NOT NULL,
  event_seq     INTEGER NOT NULL,               -- order in the simulator's event log
  vehicle_id    INTEGER NOT NULL,
  t             INTEGER NOT NULL,
  state         TEXT    NOT NULL CHECK (state IN ('assigned', 'free')),
  zone          INTEGER NOT NULL,
  request_id    INTEGER,
  PRIMARY KEY (experiment_id, replication, event_seq)
);

CREATE INDEX idx_assign_interval ON assignments (experiment_id, replication, unit_kind, interval_start, interval_end);
CREATE INDEX idx_events_request ON vehicle_events (experiment_id, replication, request_id);
