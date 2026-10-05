const { test } = require("node:test");
const assert = require("node:assert/strict");
const W = require("../science/weighting.js");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("IPW reconstructs the target in both arms across unequal assignment and target mixes", () => {
  for (const outcome of [W.LEGACY, W.MORTALITY])
    for (const pHigh of [0.1, 0.35, 0.5, 0.9])
      for (const gLow of [0.02, 0.2, 0.6])
        for (const gHigh of [0.1, 0.8, 0.98]) {
          const pop = W.population({ pHigh, gLow, gHigh, outcome });
          for (const a of pop.arms) {
            close(a.weightedHighShare, pHigh);
            close(a.totalWeight, 100);
            close(a.weightedMean, outcome.base + outcome.sev * pHigh + outcome.effect * a.a);
            close(a.weightedMean, a.standardized);
            assert.ok(a.ess <= a.n + 1e-9);
          }
          close(pop.ipw, outcome.effect);
        }
});

test("the worked example uses received-treatment probabilities and normalized means", () => {
  const p = W.population();
  close(p.naive, 3.8);
  p.cells.forEach((c, i) => close(c.count, [40, 10, 10, 40][i]));
  close(p.cells[1].weight, 5);
  close(p.cells[2].weight, 5);
  close(p.arms[1].weightedMean, 5.5);
  close(p.arms[0].weightedMean, 3.5);
});

test("the mortality story reverses: crude 34% vs 26%, restored 25% vs 35%", () => {
  const p = W.population({ outcome: W.MORTALITY });
  p.cells.forEach((c, i) => close(c.count, [40, 10, 10, 40][i]));
  // Deaths per cell are whole people: 8, 1, 5, 16.
  p.cells.forEach((c, i) => close(c.count * c.outcome, [8, 1, 5, 16][i]));
  close(p.arms[1].mean, 0.34);
  close(p.arms[0].mean, 0.26);
  assert.ok(p.naive > 0, "treated look worse before adjustment");
  close(p.arms[1].weightedMean, 0.25);
  close(p.arms[0].weightedMean, 0.35);
  close(p.ipw, -0.1);
  close(p.truth, -0.1);
  // Weighted deaths: 5 and 20 in the treated world, 10 and 25 in the untreated world.
  p.cells.forEach((c, i) => close(c.weightedCount * c.outcome, [10, 5, 25, 20][i]));
});

test("a constant wrong propensity can preserve confounded composition and bias", () => {
  for (const outcome of [W.LEGACY, W.MORTALITY]) {
    const p = W.population({ scoreMode: "constant", outcome });
    close(p.ipw, p.naive);
    close(p.arms[1].weightedHighShare, 0.8);
    close(p.arms[0].weightedHighShare, 0.2);
    assert.ok(Math.abs(p.ipw - p.truth) > 0.1);
  }
});

test("stabilization changes representation totals, not arm-normalized estimates or ESS", () => {
  const cfg = { pHigh: 0.35, gLow: 0.15, gHigh: 0.7 };
  const raw = W.population(cfg), stable = W.population({ ...cfg, weightMode: "stabilized" });
  for (const a of [0, 1]) {
    close(stable.arms[a].weightedMean, raw.arms[a].weightedMean);
    close(stable.arms[a].weightedHighShare, cfg.pHigh);
    close(stable.arms[a].ess, raw.arms[a].ess);
    close(stable.arms[a].totalWeight, raw.arms[a].n);
  }
  close(stable.arms[0].totalWeight + stable.arms[1].totalWeight, 100);
});

test("population support failure remains undefined even under a nonzero working propensity", () => {
  for (const scoreMode of ["correct", "constant"])
    for (const edge of [{ gHigh: 1 }, { gLow: 0 }, { gLow: 1, gHigh: 1 }]) {
      const p = W.population({ ...edge, scoreMode });
      assert.equal(p.supported, false);
      assert.equal(p.ipw, null);
      assert.equal(W.aipw({ ...edge, scoreMode }), null);
      for (const a of p.arms) assert.equal(a.weightedMean, null);
    }
  assert.equal(W.population({ pHigh: 0, gHigh: 1 }).supported, true, "a zero-mass stratum needs no evidence");
});

test("rare histories reduce effective evidence despite exact population balance", () => {
  const base = W.population(), rare = W.population({ gLow: 0.02, gHigh: 0.98 });
  close(rare.maxWeight, 50);
  for (const a of [0, 1]) assert.ok(rare.arms[a].ess < base.arms[a].ess / 4);
  close(rare.ipw, 2);
});

test("population AIPW is doubly robust, and the both-wrong counterexample remains", () => {
  for (const outcome of [W.LEGACY, W.MORTALITY])
    for (const pHigh of [0.2, 0.5, 0.8]) {
      close(W.aipw({ pHigh, outcome }, true), outcome.effect);
      close(W.aipw({ pHigh, outcome }, false), outcome.effect);
      close(W.aipw({ pHigh, outcome, scoreMode: "constant" }, true), outcome.effect);
      const bothWrong = W.aipw({ pHigh, outcome, scoreMode: "constant" }, false);
      assert.ok(Math.abs(bothWrong - outcome.effect) > 0.05);
      // With a severity-blind outcome model and a constant score, AIPW collapses to the crude contrast.
      close(bothWrong, W.population({ pHigh, outcome }).naive);
    }
});

test("invalid probabilities, outcomes and unknown model choices are rejected", () => {
  for (const config of [{ pHigh: NaN }, { gLow: -0.01 }, { gHigh: 1.01 }, { scoreMode: "fit" }, { weightMode: "clipped" }, { outcome: { base: 0, sev: NaN, effect: 0 } }])
    assert.throws(() => W.population(config), RangeError);
});
