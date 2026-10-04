const { test } = require("node:test");
const assert = require("node:assert/strict");
const W = require("../science/weighting.js");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

test("IPW reconstructs the target in both arms across unequal assignment and target mixes", () => {
  for (const pHigh of [0.1, 0.35, 0.5, 0.9])
    for (const gLow of [0.02, 0.2, 0.6])
      for (const gHigh of [0.1, 0.8, 0.98]) {
        const pop = W.population({ pHigh, gLow, gHigh });
        for (const a of pop.arms) {
          close(a.weightedHighShare, pHigh);
          close(a.totalWeight, 100);
          close(a.weightedMean, 2 + 3 * pHigh + 2 * a.a);
          assert.ok(a.ess <= a.n + 1e-9);
        }
        close(pop.ipw, 2);
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

test("a constant wrong propensity can preserve confounded composition and bias", () => {
  const p = W.population({ scoreMode: "constant" });
  close(p.ipw, p.naive);
  close(p.arms[1].weightedHighShare, 0.8);
  close(p.arms[0].weightedHighShare, 0.2);
  assert.ok(Math.abs(p.ipw - p.truth) > 1);
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
  for (const pHigh of [0.2, 0.5, 0.8]) {
    close(W.aipw({ pHigh }, true), 2);
    close(W.aipw({ pHigh }, false), 2);
    close(W.aipw({ pHigh, scoreMode: "constant" }, true), 2);
    assert.ok(Math.abs(W.aipw({ pHigh, scoreMode: "constant" }, false) - 2) > 0.1);
  }
});

test("invalid probabilities and unknown model choices are rejected", () => {
  for (const config of [{ pHigh: NaN }, { gLow: -0.01 }, { gHigh: 1.01 }, { scoreMode: "fit" }, { weightMode: "clipped" }])
    assert.throws(() => W.population(config), RangeError);
});
