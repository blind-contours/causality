# Experiment decision memo (one page)

Use this template for the marketplace capstone. Fill every heading; a justified request for
more evidence is a complete answer. Label the setting as synthetic where it is. Keep it to one
page: the point is to make the reasoning inspectable, not to be exhaustive.

---

**Title:** _Should the fleet allow cross-zone dispatch (policy B) instead of local-only dispatch (policy A)?_ (edit)

**Author / date / simulator version / configuration file:** _name, date, `1.0.0`, `configs/….json`_

## 1. Proposed policy and operational reason for testing it

- What changes between A and B, in one sentence, including the tie-break and request-processing rules that stay fixed.
- Why a test rather than a rollout: what could go wrong and for whom.

## 2. Primary estimand, metric and guardrails

- **Estimand:** the expected difference in the primary metric between the all-B world and the all-A world, over a stated window, demand process and initial fleet-state distribution. State what is held fixed (demand exogenous to policy) and what is therefore omitted (ridership response, long-run equilibrium).
- **Primary metric:** fraction of *eligible* requests served within the deadline. Unserved requests stay in the denominator. State the eligibility window and the follow-up.
- **Two operational guardrails** (e.g. unserved-request rate; empty travel or cross-zone pickups). If a waiting-time metric among served requests is used, label it as conditioning on a policy-affected event.

## 3. Assignment unit, schedule, duration and rationale

- Unit (request, time block, cluster) and why it supports the estimand above rather than a different contrast.
- Schedule: block length, number of blocks, probability, start/end conventions (half-open intervals).
- Duration and the number of randomized units it yields; expected precision from the simulator, with Monte Carlo uncertainty.

## 4. Carryover and geographic leakage

- What physical state persists across a switch (occupied vehicles, waiting requests, vehicle locations) and how long it plausibly persists.
- Washout rule and its scientific rationale; what it removes from the analysed population (report the excluded share). A washout does not reset the system.
- Geographic leakage between zones or clusters, if any, and why zones are or are not isolated.

## 5. Analysis method, assumptions and data-quality checks

- Estimator (e.g. equal-weight block-mean difference), its interval, and the assumptions the interval needs (independent block outcomes given assignment; carryover ends within the washout). Name the benchmark in which those assumptions are known to hold and state that the fleet is not that benchmark.
- Sharp-null check: the randomization test that resamples the actual design, and the null it tests.
- Data checks before any aggregate: one row per eligible request; assignment joined by half-open interval; row counts, key uniqueness, missing assignments; assigned versus executed policy; unserved requests preserved.

## 6. Results with uncertainty and remaining model limitations

- Point estimate, interval, number of randomized units, excluded share.
- Discrepancy from the full-policy reference (with its MCSE) if a simulator reference exists; bias and coverage for the estimator's own target where computable; false-positive rate under the sharp null.
- Limitations of the model that produced the evidence (synthetic demand, two zones, no pricing, no demand response, fixed horizon, no sequential monitoring).

## 7. Recommendation and what would change it

- Adopt B / keep A / collect more evidence, in one sentence, with the strongest reason.
- The specific evidence that would reverse the recommendation (e.g. a scenario with longer persistence in which the switchback bias exceeds the effect; a guardrail breach).

---

## Assessment dimensions

Reviewers score each dimension separately. Free-text reasoning is assessed by a person; nothing here is auto-graded.

| Dimension | What a strong memo does |
|---|---|
| **Target definition** | States the policy estimand precisely (worlds compared, window, what is held fixed) and distinguishes it from the contrast the chosen design actually estimates. |
| **Design reasoning** | Chooses the randomization unit and schedule for the stated target; explains what carryover and leakage do to that choice and why the washout has a scientific rationale. |
| **Data / metric integrity** | Builds one row per eligible request with the correct joins and denominators; checks counts and keys; keeps assigned and executed policy separate; can show how a wrong join changes the answer. |
| **Inferential reasoning** | Names the estimator's assumptions, separates the validated benchmark from the exploratory fleet results, reads bias, coverage and false-positive rates with their Monte Carlo uncertainty, and does not treat a standard-error change as a fix for a target mismatch. |
| **Decision communication** | Gives a clear recommendation or a justified request for more evidence, with the limitations and the evidence that would change the decision. |

Assessment uses a changed scenario (for example, vehicles crossing cluster boundaries, or carryover longer than the planned washout) so that the memo cannot be completed by copying grid numbers.
