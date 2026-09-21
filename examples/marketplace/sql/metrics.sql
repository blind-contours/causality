-- Metric construction for the synthetic fleet experiments. SQLite dialect (DuckDB-compatible).
-- build_db.py splits this file on "-- name:" markers and runs each section in order.
-- Sections that return rows are printed; DDL sections are just executed.

-- name: eligible_request_rows_view
-- ONE ROW PER ELIGIBLE REQUEST. This view is the only object the metrics aggregate from.
--   * requests  -> LEFT JOIN request_outcomes: a request with no outcome row survives (status NULL)
--   * requests  -> LEFT JOIN assignments (block): the half-open interval start <= t < end attaches
--                  exactly one block; an arrival at a boundary belongs to the block that starts there
--   * requests  -> LEFT JOIN assignments (request): request-level designs
--   assigned_policy comes from `assignments`; observed_policy from `request_outcomes`. They are
--   kept as separate columns so the metrics can check that execution followed assignment.
--   served_in_time is COALESCEd to 0 so unserved requests stay in the denominator.
DROP VIEW IF EXISTS eligible_request_rows;
CREATE VIEW eligible_request_rows AS
SELECT
  r.experiment_id,
  r.replication,
  r.request_id,
  r.arrival_t,
  r.origin,
  r.dest,
  b.unit_id                         AS block,
  b.policy                          AS block_policy,
  ra.policy                         AS request_policy,
  COALESCE(ra.policy, b.policy)     AS assigned_policy,
  COALESCE(ra.probability, b.probability) AS assignment_probability,
  o.status,
  o.observed_policy,
  o.vehicle_id,
  o.pickup_t,
  o.complete_t,
  o.wait_minutes,
  o.pickup_zone,
  o.cross_zone_pickup,
  COALESCE(o.served_in_time, 0)     AS served_in_time
FROM requests r
LEFT JOIN assignments b
       ON b.experiment_id = r.experiment_id AND b.replication = r.replication
      AND b.unit_kind = 'block'
      AND b.interval_start <= r.arrival_t AND r.arrival_t < b.interval_end
LEFT JOIN assignments ra
       ON ra.experiment_id = r.experiment_id AND ra.replication = r.replication
      AND ra.unit_kind = 'request' AND ra.unit_id = r.request_id
LEFT JOIN request_outcomes o
       ON o.experiment_id = r.experiment_id AND o.replication = r.replication
      AND o.request_id = r.request_id
WHERE r.eligible = 1;

-- name: row_count_checks
-- The view must have exactly one row per eligible request, every row must carry an assignment,
-- and assigned policy must match what the simulator executed. Any non-zero "problem" column
-- means the joins above are wrong for this data.
SELECT
  v.experiment_id,
  v.replication,
  (SELECT COUNT(*) FROM requests r WHERE r.experiment_id = v.experiment_id
      AND r.replication = v.replication AND r.eligible = 1)          AS eligible_requests,
  COUNT(*)                                                            AS view_rows,
  COUNT(DISTINCT v.request_id)                                        AS distinct_request_ids,
  SUM(CASE WHEN v.assigned_policy IS NULL THEN 1 ELSE 0 END)          AS missing_assignment,
  SUM(CASE WHEN v.status IS NULL THEN 1 ELSE 0 END)                   AS missing_outcome,
  SUM(CASE WHEN v.observed_policy IS NOT NULL
            AND v.observed_policy <> v.assigned_policy THEN 1 ELSE 0 END) AS assigned_vs_observed_mismatch
FROM eligible_request_rows v
GROUP BY v.experiment_id, v.replication
ORDER BY v.experiment_id, v.replication;

-- name: fulfilment_overall
-- Primary metric per run: share of ELIGIBLE requests served within the deadline.
SELECT
  experiment_id,
  replication,
  COUNT(*)                                                    AS eligible,
  SUM(CASE WHEN status = 'served' THEN 1 ELSE 0 END)          AS served,
  SUM(CASE WHEN status = 'unserved' OR status IS NULL THEN 1 ELSE 0 END) AS unserved,
  SUM(served_in_time)                                         AS served_in_time,
  AVG(served_in_time)                                         AS fulfilment,
  SUM(cross_zone_pickup)                                      AS cross_zone_pickups
FROM eligible_request_rows
GROUP BY experiment_id, replication
ORDER BY experiment_id, replication;

-- name: fulfilment_by_block
-- Block-level fulfilment: the analysis unit of the switchback estimator. Every eligible request
-- in the block counts, served or not.
SELECT
  experiment_id,
  replication,
  block,
  block_policy                                                AS policy,
  COUNT(*)                                                    AS n_requests,
  SUM(CASE WHEN status = 'unserved' OR status IS NULL THEN 1 ELSE 0 END) AS unserved,
  AVG(served_in_time)                                         AS fulfilment
FROM eligible_request_rows
WHERE block IS NOT NULL
GROUP BY experiment_id, replication, block, block_policy
ORDER BY experiment_id, replication, block;

-- name: fulfilment_by_policy_request_weighted
-- Request-weighted contrast: every eligible request counts once. This matches the
-- request-level estimator's target, NOT the switchback estimator's equal-block weighting.
SELECT
  experiment_id,
  replication,
  assigned_policy,
  COUNT(*)                                                    AS n_requests,
  AVG(served_in_time)                                         AS fulfilment
FROM eligible_request_rows
GROUP BY experiment_id, replication, assigned_policy
ORDER BY experiment_id, replication, assigned_policy;

-- name: switchback_block_weighted_estimate
-- Equal-block weighting: mean over blocks of block fulfilment, then B minus A. This is what
-- estimators.switchback_estimate computes (washout 0). Request-weighted and block-weighted
-- contrasts are different targets; pick the one that matches the estimator you report.
WITH per_block AS (
  SELECT experiment_id, replication, block, block_policy AS policy, AVG(served_in_time) AS y
  FROM eligible_request_rows
  WHERE block IS NOT NULL
  GROUP BY experiment_id, replication, block, block_policy
),
per_policy AS (
  SELECT experiment_id, replication, policy, AVG(y) AS block_mean, COUNT(*) AS blocks
  FROM per_block
  GROUP BY experiment_id, replication, policy
)
SELECT
  a.experiment_id,
  a.replication,
  a.blocks                                                    AS blocks_A,
  b.blocks                                                    AS blocks_B,
  a.block_mean                                                AS mean_A,
  b.block_mean                                                AS mean_B,
  b.block_mean - a.block_mean                                 AS estimate
FROM per_policy a
JOIN per_policy b
  ON a.experiment_id = b.experiment_id AND a.replication = b.replication
 AND a.policy = 'A' AND b.policy = 'B'
ORDER BY a.experiment_id, a.replication;

-- name: wrong_inner_join_vehicle_events
-- THE WRONG WAY, on purpose. Joining raw vehicle events into request rows multiplies every
-- served request by its number of events (two here) and an INNER join drops every unserved
-- request (they have no events). The row count no longer equals the number of eligible
-- requests and the "fulfilment" becomes a share among served-request events.
SELECT
  r.experiment_id,
  r.replication,
  COUNT(*)                                                    AS rows_after_join,
  COUNT(DISTINCT r.request_id)                                AS distinct_requests_kept,
  AVG(o.served_in_time)                                       AS wrong_fulfilment
FROM requests r
JOIN vehicle_events e
  ON e.experiment_id = r.experiment_id AND e.replication = r.replication
 AND e.request_id = r.request_id
JOIN request_outcomes o
  ON o.experiment_id = r.experiment_id AND o.replication = r.replication
 AND o.request_id = r.request_id
WHERE r.eligible = 1
GROUP BY r.experiment_id, r.replication
ORDER BY r.experiment_id, r.replication;

-- name: wrong_left_join_vehicle_events
-- Still wrong: a LEFT join keeps unserved requests but served requests are still duplicated,
-- so served requests are over-weighted.
SELECT
  r.experiment_id,
  r.replication,
  COUNT(*)                                                    AS rows_after_join,
  AVG(COALESCE(o.served_in_time, 0))                          AS wrong_fulfilment
FROM requests r
LEFT JOIN vehicle_events e
  ON e.experiment_id = r.experiment_id AND e.replication = r.replication
 AND e.request_id = r.request_id
LEFT JOIN request_outcomes o
  ON o.experiment_id = r.experiment_id AND o.replication = r.replication
 AND o.request_id = r.request_id
WHERE r.eligible = 1
GROUP BY r.experiment_id, r.replication
ORDER BY r.experiment_id, r.replication;

-- name: wrong_served_only_denominator
-- A different mistake: computing "on-time share" among served requests only. It conditions
-- on a policy-affected event (being served) and answers a different question.
SELECT
  experiment_id,
  replication,
  COUNT(*)                                                    AS served_requests,
  AVG(served_in_time)                                         AS on_time_share_among_served
FROM eligible_request_rows
WHERE status = 'served'
GROUP BY experiment_id, replication
ORDER BY experiment_id, replication;

-- name: wrong_closed_interval_join
-- Closed intervals (start <= t <= end) attach a boundary arrival to two blocks and double it.
-- Compare rows_after_join with the eligible count; any excess is boundary duplication.
SELECT
  r.experiment_id,
  r.replication,
  COUNT(*)                                                    AS rows_after_join,
  COUNT(DISTINCT r.request_id)                                AS distinct_requests,
  COUNT(*) - COUNT(DISTINCT r.request_id)                     AS duplicated_rows
FROM requests r
LEFT JOIN assignments b
  ON b.experiment_id = r.experiment_id AND b.replication = r.replication
 AND b.unit_kind = 'block'
 AND b.interval_start <= r.arrival_t AND r.arrival_t <= b.interval_end
WHERE r.eligible = 1
GROUP BY r.experiment_id, r.replication
ORDER BY r.experiment_id, r.replication;
