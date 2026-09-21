/* Marketplace decision laboratory: a validated switchback benchmark, a comparison panel over
 * repeated fleet experiments (precomputed in Python when examples/marketplace/results/grid.json
 * is present, otherwise computed here), a guided discovery sequence, a design-respecting
 * randomization test, and the decision memo. Fixed analysis horizon throughout: every
 * experiment is analysed once, at its end. */
(function () {
  const { S, store, control, tools, guided, table, fmt, esc } = CausalLab,
    { el, html, tween, ease, Plot } = CausalAnim,
    M = CausalMarketplace,
    UNIT = "marketplace-decision-lab",
    GRID_URL = "../examples/marketplace/results/grid.json",
    MEMO_KEY = "causality.memo-marketplace",
    FALLBACK_REPS = 40,
    root = document.querySelector("[data-lab=" + UNIT + "]");
  if (!root) return;

  const SCENARIOS = {
    base: {
      label: "Base fleet",
      config: {},
      note: "6 vehicles, 0.35 requests per minute, trips of 8 or 14 minutes.",
    },
    competition: {
      label: "Supply competition",
      config: { fleet: 4, demandPerMinute: 0.5 },
      note: "A smaller fleet meets more demand: requests compete for vehicles.",
    },
    persistence: {
      label: "Long trips (persistence)",
      config: { tripLocal: 14, tripCross: 22 },
      note: "Longer trips keep vehicles busy across block boundaries.",
    },
    cycle: {
      label: "Demand cycle",
      config: { demandCycle: 0.6 },
      note: "Arrival rate 0.35·(1 + 0.6·sin(2πt/horizon)): demand rises, then falls.",
    },
  };
  const SCENARIO_IDS = Object.keys(SCENARIOS);

  const state = store(
    "marketplace-decision",
    {
      step: 0,
      benchWashout: 1,
      benchSeed: 1,
      scenario: "base",
      discovery: 0,
      rtBlock: 30,
      rtWashout: 0,
      rtSeed: 11,
    },
    {
      step: [0, 4],
      benchWashout: [0, 1],
      benchSeed: [1, 1000000],
      scenario: SCENARIO_IDS,
      discovery: [0, 3],
      rtBlock: [15, 60],
      rtWashout: [0, 10],
      rtSeed: [1, 1000000],
    },
  );

  const pending = new Map();
  function animate(key, fn, ms) {
    pending.get(key)?.cancel();
    pending.set(key, tween({ duration: ms, ease: ease.out, onUpdate: fn }));
  }
  const pct = (x, d = 1) => (Number.isFinite(x) ? fmt(100 * x, d) + "%" : "—");
  const pm = (x, m, d = 3) => `${fmt(x, d)} ± ${fmt(m, d)}`;
  const sum = (v) => v.reduce((a, b) => a + b, 0);
  const mean = (v) => (v.length ? sum(v) / v.length : NaN);
  const variance = (v) => {
    if (v.length < 2) return NaN;
    const m = mean(v);
    return sum(v.map((x) => (x - m) ** 2)) / (v.length - 1);
  };
  const ABOUT = {
    request: M.requestEstimate(M.simulate({}, "request")).about,
    switchback: M.switchbackEstimate(M.simulate({}, "switchback")).about,
  };

  /* ---------- Fallback grid: the same cells as the Python grid, computed here ----------
   * Seeds and summaries mirror CausalMarketplace.experiment and policyReference exactly; the
   * only addition is the Python `demandCycle` rate, fed to simulate() as a request stream. */
  function cycleRequests(c) {
    const random = M.rng(c.demandSeed),
      amp = +c.demandCycle || 0,
      reqs = [];
    let id = 0;
    for (let t = 0; t < c.horizon; t++) {
      const lam = Math.max(
        0,
        c.demandPerMinute * (1 + amp * Math.sin((2 * Math.PI * t) / c.horizon)),
      );
      let k = 0,
        p = Math.exp(-lam),
        u = random(),
        acc = p;
      while (u > acc && k < 8) {
        k++;
        p *= lam / k;
        acc += p;
      }
      for (let j = 0; j < k; j++) {
        const origin = random() < c.zoneShare ? 0 : 1,
          dest = random() < c.crossDestShare ? 1 - origin : origin;
        reqs.push({ id: id++, t, origin, dest, maxWait: c.maxWait });
      }
    }
    return reqs;
  }
  function runOne(cfg, kind, sharpNull = false) {
    const c = { ...M.DEFAULT_CONFIG, ...cfg },
      opts = { sharpNull };
    if (+c.demandCycle) opts.requests = cycleRequests(c);
    return M.simulate(c, kind, opts);
  }
  const eligible = (run) =>
    run.requests.filter((o) => o.t < run.config.horizon);
  function reference(cfg, reps = FALLBACK_REPS, seed = 100) {
    const diffs = [];
    for (let r = 0; r < reps; r++) {
      const c = { ...cfg, demandSeed: seed + r, assignSeed: 1 };
      diffs.push(
        M.fulfilment(eligible(runOne(c, "allB"))) -
          M.fulfilment(eligible(runOne(c, "allA"))),
      );
    }
    return {
      policyEffect: mean(diffs),
      mcse: Math.sqrt(variance(diffs) / reps),
      reps,
    };
  }
  function cell(
    scenario,
    cfg,
    design,
    {
      blockLength,
      washout,
      sharpNull,
      target,
      reps = FALLBACK_REPS,
      seed = 500,
    },
  ) {
    const rows = [];
    for (let r = 0; r < reps; r++) {
      const c = {
          ...cfg,
          blockLength,
          washout,
          demandSeed: seed + r,
          assignSeed: seed + 1000 + r,
        },
        run = runOne(c, design, sharpNull),
        e =
          design === "switchback"
            ? M.switchbackEstimate(run, { washout })
            : M.requestEstimate(run),
        n = eligible(run).length;
      rows.push({
        estimate: e.estimate,
        se: e.se,
        units: e.units,
        excluded: design === "switchback" && n ? e.excluded / n : 0,
      });
    }
    const ests = rows.map((x) => x.estimate).filter(Number.isFinite),
      ok = rows.filter((x) => Number.isFinite(x.se)),
      reject = ok.filter((x) => Math.abs(x.estimate) > 1.96 * x.se).length,
      rejectRate = reject / rows.length,
      cover = ok.filter(
        (x) => Math.abs(x.estimate - target) <= 1.96 * x.se,
      ).length,
      coverage = cover / rows.length;
    return {
      scenario,
      design,
      blockLength,
      washout,
      sharpNull,
      reps: ests.length,
      mean: mean(ests),
      sd: Math.sqrt(variance(ests)),
      mcse: Math.sqrt(variance(ests) / ests.length),
      meanSE: mean(rows.map((x) => x.se).filter(Number.isFinite)),
      units: mean(rows.map((x) => x.units)),
      bias_vs_policy: sharpNull ? null : mean(ests) - target,
      coverage_policy: sharpNull ? null : coverage,
      coverage_policy_mcse: sharpNull
        ? null
        : Math.sqrt((coverage * (1 - coverage)) / rows.length),
      reject_rate: rejectRate,
      reject_mcse: Math.sqrt((rejectRate * (1 - rejectRate)) / rows.length),
      excluded_share: mean(rows.map((x) => x.excluded)),
    };
  }
  const fallback = {};
  function fallbackScenario(id) {
    if (fallback[id]) return fallback[id];
    const cfg = SCENARIOS[id].config,
      ref = reference(cfg),
      cells = [];
    for (const sharpNull of [false, true])
      cells.push(
        cell(id, cfg, "request", {
          blockLength: M.DEFAULT_CONFIG.blockLength,
          washout: 0,
          sharpNull,
          target: ref.policyEffect,
        }),
      );
    for (const blockLength of [15, 30, 60])
      for (const washout of [0, 5, 10])
        for (const sharpNull of [false, true])
          cells.push(
            cell(id, cfg, "switchback", {
              blockLength,
              washout,
              sharpNull,
              target: ref.policyEffect,
            }),
          );
    return (fallback[id] = { reference: ref, cells });
  }

  /* ---------- Data access: precomputed file or browser fallback ---------- */
  let grid = null,
    source = { kind: "loading" };
  function dataFor(id) {
    if (grid) {
      const sc = grid.scenarios?.[id];
      return {
        label: sc?.label || SCENARIOS[id].label,
        config: sc?.config || null,
        note: SCENARIOS[id].note,
        reference: grid.reference.find((r) => r.scenario === id) || null,
        cells: grid.cells.filter((c) => c.scenario === id),
      };
    }
    const f = fallbackScenario(id);
    return {
      label: SCENARIOS[id].label,
      config: { ...M.DEFAULT_CONFIG, ...SCENARIOS[id].config },
      note: SCENARIOS[id].note,
      reference: f.reference,
      cells: f.cells,
    };
  }
  const cellLabel = (c) =>
    c.design === "request"
      ? "Request-level randomization"
      : `Switchback, blocks of ${c.blockLength} min, washout ${c.washout} min`;
  const byDesign = (a, b) =>
    (a.design === "request" ? 0 : 1) - (b.design === "request" ? 0 : 1) ||
    a.blockLength - b.blockLength ||
    a.washout - b.washout;
  const nullOf = (cells, c) =>
    cells.find(
      (x) =>
        x.sharpNull &&
        x.design === c.design &&
        x.blockLength === c.blockLength &&
        x.washout === c.washout,
    );
  function sourceBadge() {
    if (source.kind === "python")
      return `<span class="mkt-source python">precomputed in Python, reps = ${esc(source.reps)}</span>`;
    if (source.kind === "browser")
      return `<span class="mkt-source browser">computed in your browser, reps = ${FALLBACK_REPS}</span>`;
    return `<span class="mkt-source">loading precomputed results…</span>`;
  }
  function sourceNote() {
    if (source.kind === "python")
      return `<p class="note">Loaded <code>examples/marketplace/results/grid.json</code> (simulator version ${esc(source.version)}, generated ${esc(source.generated)}${source.version !== M.VERSION ? `; this page's simulator is version ${esc(M.VERSION)}, so browser and file numbers may not match` : ""}). Regenerate it with:</p><pre class="mkt-command">${esc(source.command || "(no command recorded in the file)")}</pre>`;
    if (source.kind === "browser")
      return `<p class="note">No precomputed file was found at <code>examples/marketplace/results/grid.json</code> (${esc(source.reason)}). Every cell below was simulated in this page with ${FALLBACK_REPS} repeated experiments per cell and a reference of ${FALLBACK_REPS} paired all-B and all-A worlds, so Monte Carlo uncertainty is larger than in the Python grid. The demand cycle is implemented here exactly as in the Python simulator (<code>demandCycle</code>).</p>`;
    return "";
  }
  async function loadGrid() {
    try {
      const res = await fetch(GRID_URL, { cache: "no-store" });
      if (!res.ok) throw Error("HTTP " + res.status);
      const data = await res.json();
      if (!Array.isArray(data.cells) || !Array.isArray(data.reference))
        throw Error("file lacks cells or reference arrays");
      grid = data;
      source = {
        kind: "python",
        reps: Math.max(...data.cells.map((c) => c.reps || 0)),
        version: data.version,
        generated: data.generated,
        command: data.command,
      };
    } catch (e) {
      grid = null;
      source = { kind: "browser", reason: e.message };
    }
    renderComparison();
    renderDiscovery();
  }

  /* ---------- DOM ---------- */
  root.innerHTML = `<section class="lab-step" data-title="Two modes"><h2 tabindex="-1">Two modes of evidence</h2><p>Before trusting a procedure on the fleet, verify it somewhere its assumptions hold exactly. This lab therefore runs in two modes. The <strong>validated benchmark</strong> is a finite-history model built to satisfy the switchback estimator's assumptions: periods t = 1…120 in 20 blocks of 6, block policy z<sub>t</sub> ∈ {0, 1} assigned independently by coin flip, and y<sub>t</sub> = μ + δ z<sub>t</sub> + ρ z<sub>t−1</sub> + e<sub>t</sub> with μ = 0.5, δ = 0.1, ρ = 0.05 and independent noise (σ = 0.1). Carryover lasts exactly one period, so the full-policy effect is δ + ρ = 0.15. The <strong>fleet exploration</strong> then runs the same procedure, and alternatives, on the simulator, where the assumptions are only approximately true; a favourable result there is evidence for those simulated settings, not a proof.</p><div class="predict" data-options="Washout 0: keep every period|Washout 1: drop the first period of each block|Both are unbiased; washout only changes the variance" data-answer="1" data-hint="The first period of a block still carries the previous block's policy through ρ z(t−1); dropping it removes that contamination.">Carryover lasts one period and blocks have 6 periods. Which washout gives an unbiased block-mean difference for the full-policy effect δ + ρ?</div><div class="figure" id="bench-figure"><div class="mkt-controls"><label>Washout (periods dropped at the start of each block) <select data-key="benchWashout"><option value="0">0: keep every period</option><option value="1">1: drop the first period</option></select></label><label>Assignment and noise seed <input data-key="benchSeed" type="number" min="1" max="1000000" step="1"></label></div><svg id="bench-plot" role="img" aria-label="Periods 1 to 120 with blocks shaded by policy, outcomes as points, and block means as horizontal segments. Excluded periods are hollow. Values follow in the readout and table."></svg><div class="mkt-legend"><span><i style="background:var(--purple);opacity:.35"></i>B blocks (z = 1)</span><span><i style="background:var(--teal);opacity:.35"></i>A blocks (z = 0)</span><span><i style="background:var(--ink)"></i>kept period</span><span><i style="border:2px solid var(--or)"></i>excluded by washout</span></div><p class="fig-caption" role="status" id="bench-caption"></p><div class="fig-readout" id="bench-readout"></div></div><div id="bench-calibration"></div><p class="note">A fixed analysis horizon applies everywhere in this lab: each experiment is analysed once, when it ends. Nothing here supports stopping early at the first significant result; sequential monitoring is a separate procedure with its own guarantees.</p></section>
<section class="lab-step" data-title="Compare designs"><h2 tabindex="-1">Compare designs on the fleet</h2><p>Each row is one design and analysis run many times on the simulated fleet. The reference is the full-policy effect: the fulfilment difference between an all-B world and an all-A world with matched demand, averaged over independent demand draws. Bias and coverage are computed against that policy target for every row, which is a diagnostic where a row's own stated target differs from it.</p><label>Scenario <select data-key="scenario">${SCENARIO_IDS.map((id) => `<option value="${id}">${esc(SCENARIOS[id].label)}</option>`).join("")}</select></label><div id="compare-source"></div><p id="compare-scenario" class="note"></p><svg id="compare-plot" role="img" aria-label="Dot-and-interval figure: each design's mean estimate across repeated experiments with plus or minus 1.96 Monte Carlo standard errors, against the full-policy reference line and its band. The same numbers are in the table below."></svg><p class="fig-caption" role="status" id="compare-caption"></p><div id="compare-table"></div><details><summary>What the columns mean</summary><ul class="note"><li><strong>Target and assumptions</strong>: the estimator's own statement, from the analysis code.</li><li><strong>Discrepancy</strong>: mean estimate minus the full-policy reference; the reference has its own Monte Carlo SE.</li><li><strong>Bias and coverage (policy target)</strong>: mean minus reference, and the share of 95% intervals containing the reference. For the request-level row this is a diagnostic: its stated target is a different contrast.</li><li><strong>False positives</strong>: rejection rate when A and B are made identical (a sharp null), so any positive is an artefact of the design or analysis.</li><li><strong>Units</strong>: what was randomized, requests or blocks; the interval's degrees of freedom come from these, not from request counts.</li><li><strong>Excluded</strong>: share of eligible requests dropped by washout; the metric denominator is every eligible request in the kept window, unserved requests included.</li></ul></details></section>
<section class="lab-step" data-title="Discovery"><h2 tabindex="-1">Discovery sequence</h2><p>Four short questions on the same results. Each caption is computed from the displayed numbers, with Monte Carlo uncertainty, so it can change when the source changes.</p><div class="mkt-sub" role="tablist" aria-label="Discovery sub-steps"></div><div id="discovery-body"></div><h3>Why a standard error cannot fix a mismatch</h3><p>A standard error describes how an estimate would vary across repetitions of the same design. It says nothing about whether the contrast being averaged is the contrast the decision needs. The request-level design measures the effect of switching one request's policy while the rest of the fleet keeps a mixture of policies: its interval can be narrow, well calibrated for that contrast, and still centred on the wrong number for the all-B versus all-A decision. Cluster-robust or block-bootstrap standard errors change the width of the interval; they cannot move its centre. Only changing what is randomized, what is excluded, or the estimand can do that.</p></section>
<section class="lab-step" data-title="Randomization test"><h2 tabindex="-1">A randomization test that respects the design</h2><p>One switchback experiment on the base fleet, with the real policy difference switched on. The test re-randomizes the <em>block sequence</em>, exactly as the design did, and recomputes the block-mean difference each time. Individual requests are never shuffled: they were not the randomized units.</p><div class="lab-grid"><div><label>Block length (minutes) <input data-key="rtBlock" type="range" min="15" max="60" step="15"></label><label>Washout (minutes dropped at the start of each block) <input data-key="rtWashout" type="range" min="0" max="10" step="1"></label><label>Demand seed <input data-key="rtSeed" type="number" min="1" max="1000000" step="1"></label><div class="btns"><button class="primary" id="rt-run">Run this experiment and test</button></div><p class="run-config" id="rt-config"></p></div><div><div class="fig-readout" id="rt-readout"></div></div></div><div class="figure"><svg id="rt-plot" role="img" aria-label="Histogram of the block-mean difference under 400 re-randomizations of the block sequence, with the observed statistic marked. Counts are listed below."></svg><p class="fig-caption" role="status" id="rt-caption"></p></div><div id="rt-blocks"></div><details><summary>Re-randomized statistics by bin</summary><div id="rt-table"></div></details></section>
<section class="lab-step" data-title="Memo"><h2 tabindex="-1">Write the recommendation</h2><p>A one-page decision memo. Fill it from the panels above (or from a scenario you choose to argue). It is saved on this device and is <strong>not automatically graded</strong>: a methods reviewer or colleague should read it. Recommending that more evidence be collected is an acceptable conclusion when the results do not support a decision.</p><form class="mkt-memo" id="memo" autocomplete="off"><label class="wide">Proposed policy and the operational reason for testing it <textarea id="memo-question" required></textarea></label><label>Primary estimand (name the contrast and the worlds it compares) <textarea id="memo-estimand" required></textarea></label><label>Primary metric and its denominator <textarea id="memo-metric" required></textarea></label><label>Guardrail 1 (operational) <input id="memo-guardrail1" type="text" required></label><label>Guardrail 2 (operational) <input id="memo-guardrail2" type="text" required></label><label>Assignment unit and why <textarea id="memo-unit" required></textarea></label><label>Schedule and duration (block length, horizon, rationale) <textarea id="memo-schedule" required></textarea></label><label class="wide">Carryover handling and any geographic leakage <textarea id="memo-carryover" required></textarea></label><label>Analysis method <textarea id="memo-analysis" required></textarea></label><label>Assumptions and data-quality checks <textarea id="memo-assumptions" required></textarea></label><label class="wide">Results with uncertainty, and remaining model limitations <textarea id="memo-results" required></textarea></label><label class="wide"><span><input id="memo-more" type="checkbox"> More evidence is needed before a decision (state what evidence below)</span></label><label>Recommendation <textarea id="memo-recommendation"></textarea></label><label>What additional evidence would change it <textarea id="memo-change" required></textarea></label></form><p class="note">Possible operational metrics: completion and unserved-request rates, waiting-time distributions, empty travel. Waiting time among served requests conditions on a policy-affected event (being served), so label it as such. The simulator says nothing about driving safety.</p><div class="btns"><button id="memo-download">Download memo (.md)</button><button id="memo-clear">Clear memo</button></div><p class="note" id="memo-status" role="status"></p><h3>Final check</h3><p>The switchback estimate in this lab targets…</p><div class="mkt-check" id="memo-check"><button type="button" data-choice="0">the all-B versus all-A policy effect, under bounded carryover that ends within the washout</button><button type="button" data-choice="1">the request-level contrast between B-assigned and A-assigned requests</button></div><p class="note" id="memo-check-result" role="status"></p></section>`;
  root
    .querySelectorAll("[data-key]")
    .forEach((n) => control(n, state, n.dataset.key));

  /* ---------- Step 1: benchmark figure and calibration ---------- */
  const BENCH = {
    blocks: 20,
    L: 6,
    mu: 0.5,
    delta: 0.1,
    rho: 0.05,
    sigma: 0.1,
  };
  /* Reproduce benchmark()'s draws in order (block policies, then u1,u2 per period) so the
   * points drawn are the ones its block means summarise. Checked against perBlock below. */
  function benchmarkSeries(o) {
    const random = M.rng(o.seed),
      z = Array.from({ length: o.blocks }, () => (random() < 0.5 ? 1 : 0)),
      periods = [];
    let prev = 0;
    for (let b = 0; b < o.blocks; b++) {
      for (let k = 0; k < o.L; k++) {
        const zPrev = k === 0 ? prev : z[b],
          u1 = Math.max(1e-12, random()),
          u2 = random(),
          e =
            o.sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        periods.push({
          t: b * o.L + k,
          block: b,
          z: z[b],
          y: o.mu + o.delta * z[b] + o.rho * zPrev + e,
          kept: k >= o.washout,
        });
      }
      prev = z[b];
    }
    return { z, periods };
  }
  const benchSvg = root.querySelector("#bench-plot"),
    benchCap = root.querySelector("#bench-caption"),
    benchOut = root.querySelector("#bench-readout");
  function renderBench() {
    const s = state.get(),
      o = { ...BENCH, washout: s.benchWashout, seed: Math.round(s.benchSeed) },
      b = M.benchmark(o),
      { periods } = benchmarkSeries(o),
      T = o.blocks * o.L;
    const P = new Plot(benchSvg, {
      x: [0, T],
      y: [0.1, 1],
      width: 600,
      height: 300,
      margin: { l: 48, r: 14, t: 20, b: 44 },
      xlabel: "period t (blocks of " + o.L + ")",
      ylabel: "outcome y",
      xticks: [0, 24, 48, 72, 96, 120],
    });
    const bands = P.layer("bands");
    b.perBlock.forEach((blk, i) =>
      bands.append(
        el("rect", {
          x: P.sx(i * o.L),
          y: P.m.t,
          width: P.sx(o.L) - P.sx(0),
          height: P.H - P.m.b - P.m.t,
          fill: blk.policy === "B" ? "var(--purple)" : "var(--teal)",
          "fill-opacity": blk.policy === "B" ? 0.14 : 0.1,
        }),
      ),
    );
    P.hline(o.mu, { stroke: "var(--muted)" });
    P.hline(o.mu + o.delta + o.rho, { stroke: "var(--purple)" });
    // Reference labels at the left edge, clear of the marks.
    P.fg.append(
      el(
        "text",
        {
          class: "ref-label",
          x: P.m.l + 6,
          y: P.sy(o.mu) + 14,
          fill: "var(--muted)",
        },
        "μ = " + o.mu,
      ),
      el(
        "text",
        {
          class: "ref-label",
          x: P.m.l + 6,
          y: P.sy(o.mu + o.delta + o.rho) - 6,
          fill: "var(--purple)",
        },
        "μ + δ + ρ = " + fmt(o.mu + o.delta + o.rho, 2),
      ),
    );
    const dots = P.layer("dots");
    periods.forEach((p) =>
      dots.append(
        el("circle", {
          cx: P.sx(p.t + 0.5),
          cy: P.sy(p.y),
          r: 2.4,
          fill: p.kept ? "var(--ink)" : "none",
          stroke: p.kept ? "none" : "var(--or)",
          "stroke-width": 1.6,
        }),
      ),
    );
    const means = P.layer("means"),
      segs = b.perBlock.map((blk, i) => {
        const seg = el("line", {
          x1: P.sx(i * o.L + o.washout),
          x2: P.sx(i * o.L + o.washout),
          y1: P.sy(blk.y),
          y2: P.sy(blk.y),
          stroke: blk.policy === "B" ? "var(--purple)" : "var(--teal)",
          "stroke-width": 3,
          "stroke-linecap": "round",
        });
        means.append(seg);
        return { seg, i };
      });
    animate(
      "bench",
      (u) =>
        segs.forEach(({ seg, i }) =>
          seg.setAttribute(
            "x2",
            P.sx(i * o.L + o.washout + u * (o.L - o.washout)),
          ),
        ),
      900,
    );
    const nA = b.perBlock.filter((x) => x.policy === "A").length;
    benchOut.replaceChildren(
      ...[
        ["blocks A / B", `${nA} / ${o.blocks - nA}`],
        ["periods kept per block", o.L - o.washout],
        ["estimate B − A", fmt(b.estimate, 4)],
        ["two-sample SE", fmt(b.se, 4)],
        ["target δ + ρ", fmt(b.target, 3)],
        ["expected bias −ρ/L", o.washout ? "0" : fmt(-o.rho / o.L, 4)],
      ].flatMap(([k, v]) => [
        html("span", { class: "k" }, k),
        html("span", {}, v),
      ]),
    );
    benchCap.textContent = o.washout
      ? `Washout 1: every kept period sits under its own block's policy, so each block mean is an unbiased draw around μ + (δ + ρ)z. This draw gives ${fmt(b.estimate, 3)} ± ${fmt(1.96 * b.se, 3)} for the target 0.15; one draw cannot show unbiasedness, so the table below repeats it 400 times.`
      : `Washout 0: the hollow points would be kept. The first period of each block still carries ρ times the previous block's policy, which averages ½ over assignments, so the block-mean difference targets δ + ρ(L − 1)/L instead of δ + ρ: bias −ρ/L = ${fmt(-o.rho / o.L, 4)}. This draw gives ${fmt(b.estimate, 3)} ± ${fmt(1.96 * b.se, 3)}.`;
  }
  function renderCalibration() {
    const rows = [0, 1].map((washout) => {
      const c = M.benchmarkCalibration({ ...BENCH, washout }, 400, 900);
      return [
        `Washout ${washout}`,
        fmt(c.target, 3),
        washout ? "0" : fmt(-BENCH.rho / BENCH.L, 4),
        pm(c.bias, c.mcse, 4),
        pm(100 * c.coverage, 100 * c.coverageMCSE, 1) + "%",
        c.reps,
      ];
    });
    root.querySelector("#bench-calibration").innerHTML =
      table(
        [
          "Procedure",
          "Target δ + ρ",
          "Expected bias",
          "Bias ± MCSE",
          "95% coverage ± MCSE",
          "Repetitions",
        ],
        rows,
        "Benchmark calibration, 400 repetitions each (computed in this page, seeds 900–1299)",
      ) +
      `<p class="note">With washout 1 the estimator is unbiased for δ + ρ up to Monte Carlo error and the two-sample interval covers at close to its nominal 95%: block means are independent given assignment and the carryover has ended. Without washout the bias is about −ρ/L and coverage drops below nominal. This is the guarantee the fleet exploration then puts to the test, where carryover is not one period long and blocks are not independent of what the fleet was doing before.</p>`;
  }

  /* ---------- Step 2: comparison panel ---------- */
  const cmpSvg = root.querySelector("#compare-plot"),
    cmpCap = root.querySelector("#compare-caption");
  function renderComparison() {
    const id = state.get().scenario;
    root.querySelector("#compare-source").innerHTML =
      sourceBadge() + sourceNote();
    if (source.kind === "loading") return;
    const d = dataFor(id),
      ref = d.reference,
      cells = d.cells.filter((c) => !c.sharpNull).sort(byDesign);
    root.querySelector("#compare-scenario").textContent =
      `${d.label}: ${d.note}` +
      (d.config
        ? ` Configuration: ${Object.entries(d.config)
            .filter(([k]) => !/Seed$/.test(k))
            .map(([k, v]) => `${k} = ${v}`)
            .join(", ")}.`
        : "") +
      (ref
        ? ` Full-policy reference ${fmt(ref.policyEffect, 3)} ± ${fmt(ref.mcse, 3)} (MCSE, ${ref.reps} paired worlds).`
        : " No reference for this scenario in the file.");
    if (!cells.length || !ref) {
      cmpSvg.replaceChildren();
      cmpCap.textContent = "This scenario has no cells in the loaded results.";
      root.querySelector("#compare-table").innerHTML = "";
      return;
    }
    const lo = Math.min(
        ref.policyEffect - 1.96 * ref.mcse,
        ...cells.map((c) => c.mean - 1.96 * c.mcse),
      ),
      hi = Math.max(
        ref.policyEffect + 1.96 * ref.mcse,
        ...cells.map((c) => c.mean + 1.96 * c.mcse),
      ),
      pad = Math.max(0.02, (hi - lo) * 0.08),
      n = cells.length,
      P = new Plot(cmpSvg, {
        x: [lo - pad, hi + pad],
        y: [0, n],
        width: 600,
        height: Math.max(200, 70 + n * 26),
        margin: { l: 210, r: 16, t: 26, b: 44 },
        xlabel: "mean estimate across repeated experiments ± 1.96 · MCSE",
        yticks: [],
        grid: false,
        tickFormat: (v) => fmt(v, 2),
      });
    P.marks.append(
      el("rect", {
        x: P.sx(ref.policyEffect - 1.96 * ref.mcse),
        y: P.m.t,
        width: Math.max(
          1,
          P.sx(ref.policyEffect + 1.96 * ref.mcse) -
            P.sx(ref.policyEffect - 1.96 * ref.mcse),
        ),
        height: P.H - P.m.t - P.m.b,
        fill: "var(--purple)",
        "fill-opacity": 0.12,
      }),
    );
    P.vline(
      ref.policyEffect,
      { stroke: "var(--purple)" },
      "full-policy reference",
    );
    P.vline(0, { stroke: "var(--muted)" });
    const marks = cells.map((c, i) => {
      const y = n - i - 0.5,
        colour = c.design === "request" ? "var(--or)" : "var(--teal)",
        seg = el("line", {
          x1: P.sx(c.mean),
          x2: P.sx(c.mean),
          y1: P.sy(y),
          y2: P.sy(y),
          stroke: colour,
          "stroke-width": 2.4,
          "stroke-linecap": "round",
        }),
        dot = el("circle", {
          cx: P.sx(c.mean),
          cy: P.sy(y),
          r: 4,
          fill: colour,
        });
      P.marks.append(seg, dot);
      P.fg.append(
        el(
          "text",
          {
            class: "fig-text ink",
            x: P.m.l - 8,
            y: P.sy(y) + 4,
            "text-anchor": "end",
          },
          c.design === "request"
            ? "request-level"
            : `switchback L=${c.blockLength}, w=${c.washout}`,
        ),
      );
      return { seg, c };
    });
    animate(
      "compare",
      (u) =>
        marks.forEach(({ seg, c }) => {
          seg.setAttribute("x1", P.sx(c.mean - u * 1.96 * c.mcse));
          seg.setAttribute("x2", P.sx(c.mean + u * 1.96 * c.mcse));
        }),
      1000,
    );
    const request = cells.find((c) => c.design === "request"),
      sb = cells.filter((c) => c.design === "switchback"),
      best = sb.length
        ? sb.reduce((a, b) =>
            Math.abs(b.bias_vs_policy) < Math.abs(a.bias_vs_policy) ? b : a,
          )
        : null;
    cmpCap.textContent =
      `${d.label}. ` +
      (request
        ? `The request-level mean is ${fmt(request.mean, 3)}, ${fmt(request.mean - ref.policyEffect, 3)} from the reference (${Math.abs(request.mean - ref.policyEffect) <= 2 * Math.hypot(request.mcse, ref.mcse) ? "within" : "beyond"} two combined Monte Carlo SEs). `
        : "") +
      (best
        ? `The switchback cell closest to the reference is L = ${best.blockLength}, washout ${best.washout}: bias ${pm(best.bias_vs_policy, best.mcse)}, coverage ${pct(best.coverage_policy)} ± ${pct(best.coverage_policy_mcse)}.`
        : "");
    root.querySelector("#compare-table").innerHTML = table(
      [
        "Design and analysis",
        "Target and assumptions",
        "Mean estimate",
        "Discrepancy from reference",
        "Bias (policy target) ± MCSE",
        "Coverage (policy target) ± MCSE",
        "False positives (sharp null) ± MCSE",
        "Randomized units",
        "Monte Carlo SE",
        "Excluded share",
      ],
      cells.map((c) => {
        const z = nullOf(d.cells, c);
        return [
          cellLabel(c),
          ABOUT[c.design] || "",
          fmt(c.mean, 3),
          `${fmt(c.mean - ref.policyEffect, 3)} (reference MCSE ${fmt(ref.mcse, 3)})`,
          pm(c.bias_vs_policy, c.mcse) +
            (c.design === "request" ? " (diagnostic)" : ""),
          (Number.isFinite(c.coverage_policy)
            ? pct(c.coverage_policy) + " ± " + pct(c.coverage_policy_mcse)
            : "—") + (c.design === "request" ? " (diagnostic)" : ""),
          z ? pct(z.reject_rate) + " ± " + pct(z.reject_mcse) : "not run",
          `${fmt(c.units, 1)} ${c.design === "request" ? "requests" : "blocks"}`,
          fmt(c.mcse, 4) + ` (${c.reps} reps, SD ${fmt(c.sd, 3)})`,
          pct(c.excluded_share),
        ];
      }),
      `Comparison panel: ${d.label}, ${source.kind === "python" ? "precomputed in Python" : "computed in your browser"}; reference ${fmt(ref.policyEffect, 3)} ± ${fmt(ref.mcse, 3)}`,
    );
    root
      .querySelectorAll("#compare-table tbody td:nth-child(2)")
      .forEach((td) => td.classList.add("mkt-about"));
  }

  /* ---------- Step 3: discovery sequence ---------- */
  const SUBSTEPS = [
    "a. Base: is the target recoverable?",
    "b. Competition: what each design estimates",
    "c. Persistence and cycle: block length",
    "d. Contamination, retained data, periods",
  ];
  const subNav = root.querySelector(".mkt-sub");
  SUBSTEPS.forEach((t, i) => {
    const b = html("button", { type: "button", role: "tab" }, t);
    b.onclick = () => state.set({ discovery: i });
    subNav.append(b);
  });
  const within = (x, m, k = 2) => Math.abs(x) <= k * m;
  const sbCells = (d, f = () => true) =>
    d.cells
      .filter((c) => c.design === "switchback" && !c.sharpNull && f(c))
      .sort(byDesign);
  function renderDiscovery() {
    const k = state.get().discovery,
      body = root.querySelector("#discovery-body");
    [...subNav.children].forEach((b, i) =>
      b.setAttribute("aria-current", String(i === k)),
    );
    if (source.kind === "loading") {
      body.innerHTML = "<p class='note'>Loading results…</p>";
      return;
    }
    body.innerHTML = "";
    const badge = html("div", {});
    badge.innerHTML = sourceBadge();
    body.append(badge);
    if (k === 0) {
      const d = dataFor("base"),
        ref = d.reference,
        cells = sbCells(d),
        ok = cells.filter((c) => within(c.bias_vs_policy, c.mcse));
      body.insertAdjacentHTML(
        "beforeend",
        `<p><strong>Question.</strong> In the base fleet, does any switchback cell recover the full-policy effect ${ref ? fmt(ref.policyEffect, 3) + " ± " + fmt(ref.mcse, 3) : ""}?</p>` +
          table(
            [
              "Switchback cell",
              "Mean",
              "Bias ± MCSE",
              "Coverage ± MCSE",
              "Blocks",
              "Excluded",
            ],
            cells.map((c) => [
              cellLabel(c),
              fmt(c.mean, 3),
              pm(c.bias_vs_policy, c.mcse),
              pct(c.coverage_policy) + " ± " + pct(c.coverage_policy_mcse),
              fmt(c.units, 1),
              pct(c.excluded_share),
            ]),
            "Base scenario, switchback cells against the policy target",
          ) +
          `<p class="fig-caption" role="status">${
            cells.length
              ? `${ok.length} of ${cells.length} switchback cells have bias within two Monte Carlo SEs of zero${ok.length ? " (" + ok.map((c) => `L = ${c.blockLength}, w = ${c.washout}`).join("; ") + ")" : ""}. Coverage ranges from ${pct(Math.min(...cells.map((c) => c.coverage_policy)))} to ${pct(Math.max(...cells.map((c) => c.coverage_policy)))}. With ${fmt(Math.min(...cells.map((c) => c.units)), 0)}–${fmt(Math.max(...cells.map((c) => c.units)), 0)} randomized blocks, a two-sample t-style interval is a rough instrument; "recoverable" here means bias not distinguishable from zero at this Monte Carlo precision, not proof of unbiasedness.`
              : "No switchback cells for the base scenario."
          }</p>`,
      );
    } else if (k === 1) {
      const d = dataFor("competition"),
        ref = d.reference,
        req = d.cells.find((c) => c.design === "request" && !c.sharpNull),
        cells = sbCells(d),
        best = cells.length
          ? cells.reduce((a, b) =>
              Math.abs(b.bias_vs_policy) < Math.abs(a.bias_vs_policy) ? b : a,
            )
          : null;
      body.insertAdjacentHTML(
        "beforeend",
        `<p><strong>Question.</strong> With ${d.config ? `${d.config.fleet} vehicles and ${d.config.demandPerMinute} requests per minute` : "a small fleet and high demand"}, what does each design estimate?</p>` +
          table(
            [
              "Design",
              "Stated target",
              "Mean",
              "Reference",
              "Discrepancy",
              "Coverage of policy target",
            ],
            [
              ...(req
                ? [
                    [
                      "Request-level",
                      "own-policy switch for one request while the fleet is shared",
                      fmt(req.mean, 3),
                      fmt(ref.policyEffect, 3),
                      fmt(req.mean - ref.policyEffect, 3),
                      pct(req.coverage_policy) + " (diagnostic)",
                    ],
                  ]
                : []),
              ...cells.map((c) => [
                cellLabel(c),
                "all-B vs all-A, if carryover ends within washout",
                fmt(c.mean, 3),
                fmt(ref.policyEffect, 3),
                fmt(c.mean - ref.policyEffect, 3),
                pct(c.coverage_policy),
              ]),
            ],
            "Supply-competition scenario",
          ) +
          `<p class="fig-caption" role="status">${
            req && ref
              ? `The request-level contrast averages ${fmt(req.mean, 3)} against a policy effect of ${fmt(ref.policyEffect, 3)}: a difference of ${fmt(req.mean - ref.policyEffect, 3)}, ${within(req.mean - ref.policyEffect, Math.hypot(req.mcse, ref.mcse)) ? "within" : "well beyond"} two combined Monte Carlo SEs. Under policy B a request can borrow a vehicle from the other zone; under request-level randomization the B-assigned requests borrow from a fleet that A-assigned requests are also drawing on, so the contrast includes the cost that borrowing imposes on neighbours in the mixed world, not in the all-B world. Its ${pct(req.coverage_policy)} coverage of the policy target is a diagnostic of a target mismatch, not of a broken interval.${best ? ` The switchback cell nearest the reference (L = ${best.blockLength}, w = ${best.washout}) has bias ${pm(best.bias_vs_policy, best.mcse)}.` : ""}`
              : "Cells missing for this scenario."
          }</p>`,
      );
    } else if (k === 2) {
      const parts = ["persistence", "cycle"].map((id) => {
        const d = dataFor(id),
          ref = d.reference,
          cells = sbCells(d),
          washouts = [...new Set(cells.map((c) => c.washout))].sort(
            (a, b) => a - b,
          ),
          w = washouts.includes(5)
            ? 5
            : (washouts[Math.min(1, washouts.length - 1)] ?? 0),
          shown = cells.filter((c) => c.washout === w);
        return { d, ref, w, shown };
      });
      body.insertAdjacentHTML(
        "beforeend",
        `<p><strong>Question.</strong> When vehicles stay busy across block boundaries (long trips) or demand follows a cycle, how does block length trade contamination against the number of randomized blocks?</p>` +
          parts
            .map(({ d, ref, w, shown }) =>
              table(
                [
                  "Block length",
                  "Mean",
                  "Bias ± MCSE",
                  "Coverage ± MCSE",
                  "Blocks",
                  "False positives",
                ],
                shown.map((c) => [
                  `${c.blockLength} min (washout ${c.washout})`,
                  fmt(c.mean, 3),
                  pm(c.bias_vs_policy, c.mcse),
                  pct(c.coverage_policy) + " ± " + pct(c.coverage_policy_mcse),
                  fmt(c.units, 1),
                  (() => {
                    const z = nullOf(d.cells, c);
                    return z ? pct(z.reject_rate) : "—";
                  })(),
                ]),
                `${d.label}: reference ${ref ? fmt(ref.policyEffect, 3) + " ± " + fmt(ref.mcse, 3) : "—"}, washout ${w}`,
              ),
            )
            .join("") +
          `<p class="fig-caption" role="status">${parts
            .map(({ d, shown }) => {
              if (!shown.length) return `${d.label}: no cells.`;
              const s = shown
                  .slice()
                  .sort((a, b) => a.blockLength - b.blockLength),
                first = s[0],
                last = s[s.length - 1];
              return `${d.label}: going from L = ${first.blockLength} to L = ${last.blockLength} changes bias from ${pm(first.bias_vs_policy, first.mcse)} to ${pm(last.bias_vs_policy, last.mcse)} while the number of randomized blocks falls from ${fmt(first.units, 0)} to ${fmt(last.units, 0)}.`;
            })
            .join(
              " ",
            )} Longer blocks let the fleet settle into each policy, so less of each block is contaminated by the previous one, but they leave fewer randomized units, wider intervals, and a coarser sharp-null test. A demand cycle adds a second concern: blocks fall on different parts of the cycle, so block-level variance rises even without any policy effect.</p>`,
      );
    } else {
      const id = state.get().scenario,
        d = dataFor(id),
        cells = sbCells(d),
        Ls = [...new Set(cells.map((c) => c.blockLength))].sort(
          (a, b) => a - b,
        ),
        ws = [...new Set(cells.map((c) => c.washout))].sort((a, b) => a - b),
        colours = ["var(--teal)", "var(--purple)", "var(--or)", "var(--phat)"];
      body.insertAdjacentHTML(
        "beforeend",
        `<p><strong>Question.</strong> For the ${esc(d.label)} scenario (chosen in step 2), what does washout buy and what does it cost?</p><div class="figure"><div class="mkt-two"><div><svg id="disc-excluded" role="img" aria-label="Excluded share of eligible requests against washout, one line per block length."></svg></div><div><svg id="disc-units" role="img" aria-label="Number of randomized blocks against washout, one line per block length."></svg></div></div><div class="mkt-legend" id="disc-legend"></div><p class="fig-caption" role="status" id="disc-caption"></p></div>`,
      );
      const maxW = Math.max(1, ...ws),
        maxShare = Math.max(0.05, ...cells.map((c) => c.excluded_share)),
        Pe = new Plot(body.querySelector("#disc-excluded"), {
          x: [-0.3, maxW + 0.3],
          y: [0, maxShare * 1.25],
          width: 420,
          height: 260,
          margin: { l: 52, r: 16, t: 24, b: 44 },
          xlabel: "washout (minutes)",
          ylabel: "excluded share of eligible requests",
          xticks: ws,
          tickFormat: (v) => fmt(v, 2),
        }),
        Pu = new Plot(body.querySelector("#disc-units"), {
          x: [-0.3, maxW + 0.3],
          y: [0, Math.max(1, ...cells.map((c) => c.units)) * 1.2],
          width: 420,
          height: 260,
          margin: { l: 52, r: 16, t: 24, b: 44 },
          xlabel: "washout (minutes)",
          ylabel: "randomized blocks",
          xticks: ws,
          tickFormat: (v) => fmt(v, 0),
        });
      body.querySelector("#disc-legend").append(
        ...Ls.map((L, i) => {
          const s = html("span", {}, `block length ${L} min`);
          s.prepend(
            html("i", { style: "background:" + colours[i % colours.length] }),
          );
          return s;
        }),
      );
      Ls.forEach((L, i) => {
        const series = cells
          .filter((c) => c.blockLength === L)
          .sort((a, b) => a.washout - b.washout);
        Pe.line(
          series.map((c) => [c.washout, c.excluded_share]),
          { stroke: colours[i % colours.length] },
        );
        Pe.scatter(
          series.map((c) => [c.washout, c.excluded_share]),
          3.5,
          { fill: colours[i % colours.length] },
        );
        Pu.line(
          series.map((c) => [c.washout, c.units]),
          { stroke: colours[i % colours.length] },
        );
        Pu.scatter(
          series.map((c) => [c.washout, c.units]),
          3.5,
          { fill: colours[i % colours.length] },
        );
      });
      const biasLine = Ls.map((L) => {
        const s = cells
          .filter((c) => c.blockLength === L)
          .sort((a, b) => a.washout - b.washout);
        return s.length
          ? `L = ${L}: bias ${s.map((c) => `${fmt(c.bias_vs_policy, 3)} at w = ${c.washout}`).join(", ")}`
          : "";
      }).filter(Boolean);
      body.querySelector("#disc-caption").textContent =
        `Washout removes contamination at the start of each block, and the excluded share grows roughly as washout ÷ block length; the number of randomized blocks depends on block length alone. ${biasLine.join("; ")}. Bias is against the policy target with Monte Carlo SE about ${fmt(mean(cells.map((c) => c.mcse)), 3)}; a change smaller than that is not resolved by this grid. The three quantities cannot all be improved at once: shorter blocks give more randomized periods but more contaminated boundaries; longer washout cleans the boundaries but discards requests; longer blocks reduce both problems but leave fewer units.`;
    }
  }

  /* ---------- Step 4: randomization test on one run ---------- */
  const rtSvg = root.querySelector("#rt-plot"),
    rtCap = root.querySelector("#rt-caption"),
    rtOut = root.querySelector("#rt-readout"),
    rtConf = root.querySelector("#rt-config"),
    RT_REPS = 400,
    RT_SEED = 3;
  let rtResult = null;
  const rtConfigOf = (s) => ({
    blockLength: Math.round(s.rtBlock),
    washout: Math.round(s.rtWashout),
    demandSeed: Math.round(s.rtSeed),
  });
  const rtDescribe = (c) =>
    `Displayed run: blocks of ${c.blockLength} min, washout ${c.washout} min, demand seed ${c.demandSeed}, assignment seed 7, horizon ${M.DEFAULT_CONFIG.horizon} min, policy difference on; ${RT_REPS} re-randomizations of the block sequence (seed ${RT_SEED}).`;
  /* Same draws as switchbackRandomizationTest (one coin per block per replicate), kept so the
   * histogram shows the statistics whose count produced the module's p-value. */
  function rerandomized(run, reps, seed, opts) {
    const random = M.rng(seed),
      L = run.config.blockLength,
      stats = [];
    for (let r = 0; r < reps; r++) {
      const relabel = run.design.schedule.map(() =>
        random() < 0.5 ? "B" : "A",
      );
      stats.push(
        M.switchbackEstimate(
          {
            ...run,
            requests: run.requests.map((o) => ({
              ...o,
              policy: relabel[Math.floor(o.t / L)],
            })),
          },
          opts,
        ).estimate,
      );
    }
    return stats;
  }
  function runRT() {
    const c = rtConfigOf(state.get()),
      run = M.simulate({ ...c, assignSeed: 7 }, "switchback"),
      e = M.switchbackEstimate(run, { washout: c.washout }),
      t = M.switchbackRandomizationTest(run, RT_REPS, RT_SEED, {
        washout: c.washout,
      }),
      all = rerandomized(run, RT_REPS, RT_SEED, { washout: c.washout }),
      stats = all.filter(Number.isFinite);
    rtResult = {
      c,
      run,
      e,
      t,
      stats,
      undefinedCount: all.length - stats.length,
    };
    renderRT();
  }
  function renderRT() {
    if (!rtResult) return;
    const { c, run, e, t, stats, undefinedCount } = rtResult,
      absObs = Math.abs(e.estimate),
      lo = Math.min(-absObs, ...stats),
      hi = Math.max(absObs, ...stats),
      pad = Math.max(0.02, (hi - lo) * 0.06),
      domain = [lo - pad, hi + pad],
      bins = 21,
      h = S.histogram(stats, bins, domain),
      width = (domain[1] - domain[0]) / bins,
      P = new Plot(rtSvg, {
        x: domain,
        y: [0, Math.max(1, ...h.counts) * 1.08],
        width: 600,
        height: 280,
        margin: { l: 48, r: 14, t: 24, b: 44 },
        xlabel:
          "block-mean difference B − A under re-randomized block sequences",
        ylabel: "count",
        tickFormat: (v) => fmt(v, 2),
      }),
      bars = P.bars(
        h.counts.map((n, i) => [domain[0] + (i + 0.5) * width, n]),
        width * 0.92,
        { fill: "var(--purple)", "fill-opacity": 0.55 },
      );
    P.vline(
      e.estimate,
      { stroke: "var(--ink)" },
      "observed " + fmt(e.estimate, 3),
    );
    if (absObs > 1e-12)
      P.vline(-e.estimate, { stroke: "var(--ink)", "stroke-opacity": 0.5 });
    const rects = [...bars.children].map((r) => ({
        r,
        y: +r.getAttribute("y"),
        h: +r.getAttribute("height"),
      })),
      base = P.sy(0);
    animate(
      "rt",
      (u) =>
        rects.forEach(({ r, y, h: hh }) => {
          r.setAttribute("y", base - (base - y) * u);
          r.setAttribute("height", hh * u);
        }),
      900,
    );
    rtConf.textContent = rtDescribe(c);
    const extreme = stats.filter((s) => Math.abs(s) >= absObs - 1e-12).length;
    rtOut.replaceChildren(
      ...[
        ["blocks A / B analysed", `${e.blocksA} / ${e.blocksB}`],
        ["requests excluded by washout", e.excluded],
        ["observed B − A", fmt(e.estimate, 4)],
        [
          "re-randomized |stat| ≥ observed",
          `${extreme} of ${RT_REPS}` +
            (undefinedCount
              ? ` (${undefinedCount} undefined: every block drew the same policy)`
              : ""),
        ],
        ["p-value (extreme + 1)/(reps + 1)", fmt(t.pValue, 3)],
        ["fulfilment overall", fmt(M.fulfilment(eligible(run)), 3)],
      ].flatMap(([k, v]) => [
        html("span", { class: "k" }, k),
        html("span", {}, v),
      ]),
    );
    rtCap.textContent = `Null hypothesis tested: the policy has no effect on any block, so relabelling the block sequence would have produced the same block outcomes. Under that sharp null the observed difference ${fmt(e.estimate, 3)} is matched or exceeded by ${extreme} of ${RT_REPS} re-randomized values${undefinedCount ? ` (${undefinedCount} sequences with a single policy give no contrast and count as not extreme)` : ""}: p = (${extreme} + 1)/(${RT_REPS} + 1) = ${fmt(t.pValue, 3)}. This is a test of one sharp null under the actual design. It is not a confidence interval, and inverting it into one would require a model for how a policy effect shifts every block, which the fleet does not supply.`;
    root.querySelector("#rt-blocks").innerHTML = table(
      ["Block", "Policy", "Fulfilment", "Requests kept"],
      e.perBlock.map((b, i) => [String(i), b.policy, fmt(b.y, 3), b.n]),
      `Per-block outcomes for the displayed run (blocks weighted equally; ${e.excluded} requests dropped by washout)`,
    );
    root.querySelector("#rt-table").innerHTML = table(
      ["Bin lower edge", "Count"],
      h.counts.map((n, i) => [fmt(domain[0] + i * width, 3), n]),
      `All ${stats.length} re-randomized statistics; observed ${fmt(e.estimate, 4)}`,
    );
  }
  root.querySelector("#rt-run").onclick = runRT;

  /* ---------- Step 5: memo ---------- */
  const memoForm = root.querySelector("#memo"),
    memoFields = [...memoForm.querySelectorAll("textarea, input")],
    memoStatus = root.querySelector("#memo-status"),
    checkBox = root.querySelector("#memo-check"),
    checkResult = root.querySelector("#memo-check-result"),
    memoLabel = (f) =>
      f.closest("label").textContent.trim().replace(/\s+/g, " ");
  let memo = {};
  try {
    memo = JSON.parse(localStorage.getItem(MEMO_KEY) || "{}") || {};
  } catch {}
  memoFields.forEach((f) => {
    if (f.type === "checkbox") f.checked = memo[f.id] === true;
    else f.value = typeof memo[f.id] === "string" ? memo[f.id] : "";
  });
  function saveMemo() {
    memoFields.forEach(
      (f) => (memo[f.id] = f.type === "checkbox" ? f.checked : f.value),
    );
    try {
      localStorage.setItem(MEMO_KEY, JSON.stringify(memo));
    } catch {}
  }
  function memoComplete() {
    const more = memoForm.querySelector("#memo-more").checked;
    const required = memoFields.filter(
      (f) => f.type !== "checkbox" && (f.id !== "memo-recommendation" || !more),
    );
    return {
      done: required.filter((f) => f.value.trim()).length,
      total: required.length,
      complete: required.every((f) => f.value.trim()),
    };
  }
  let transferFired = false;
  function maybeTransfer() {
    const { done, total, complete } = memoComplete();
    memoStatus.textContent = `${done} of ${total} required fields filled${complete ? "" : "; the final check records a transfer attempt once the memo is complete"}. The memo is saved on this device and is not automatically graded.`;
    if (complete && memo.check === "0" && !transferFired) {
      transferFired = true;
      window.Causality?.event({
        type: "exercise",
        unit: UNIT,
        id: "transfer",
        variant: 0,
        answer: "0",
        correct: true,
        assisted: false,
        transfer: true,
      });
      checkResult.textContent =
        "Correct: the switchback estimator states that target and its assumptions in its own description. With the memo complete, this lesson's transfer check is recorded.";
    }
  }
  memoForm.addEventListener("input", () => {
    saveMemo();
    maybeTransfer();
  });
  checkBox.querySelectorAll("button").forEach((b) => {
    b.onclick = () => {
      memo.check = b.dataset.choice;
      saveMemo();
      checkBox
        .querySelectorAll("button")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      if (memo.check === "0") {
        checkResult.textContent = memoComplete().complete
          ? ""
          : "Correct. Complete the memo's required fields to record the transfer check.";
        maybeTransfer();
      } else
        checkResult.textContent =
          "Not this one: the request-level contrast is the other estimator's target. Re-read the switchback row's target and assumptions in step 2, then answer again.";
    };
  });
  if (memo.check)
    checkBox
      .querySelector(`[data-choice="${memo.check}"]`)
      ?.setAttribute("aria-pressed", "true");
  maybeTransfer();
  root.querySelector("#memo-clear").onclick = () => {
    memo = {};
    memoFields.forEach((f) =>
      f.type === "checkbox" ? (f.checked = false) : (f.value = ""),
    );
    checkBox
      .querySelectorAll("button")
      .forEach((x) => x.removeAttribute("aria-pressed"));
    checkResult.textContent = "";
    saveMemo();
    maybeTransfer();
  };
  root.querySelector("#memo-download").onclick = () => {
    saveMemo();
    const lines = [
      "# Decision memo: marketplace dispatch policy",
      "",
      `Written ${new Date().toISOString().slice(0, 10)} in the Causality marketplace decision lab. Not automatically graded.`,
      "",
    ];
    memoFields.forEach((f) => {
      if (f.type === "checkbox")
        lines.push(`- [${f.checked ? "x" : " "}] ${memoLabel(f)}`, "");
      else
        lines.push(
          `## ${memoLabel(f)}`,
          "",
          f.value.trim() || "_(not filled in)_",
          "",
        );
    });
    lines.push(
      `## Final check`,
      "",
      memo.check === "0"
        ? "The switchback estimate targets the all-B versus all-A policy effect under bounded carryover that ends within the washout."
        : "_(not answered correctly yet)_",
      "",
    );
    const url = URL.createObjectURL(
        new Blob([lines.join("\n")], { type: "text/markdown" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "marketplace-decision-memo.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ---------- Wiring ---------- */
  let last = state.get();
  state.subscribe((s) => {
    if (s.benchWashout !== last.benchWashout || s.benchSeed !== last.benchSeed)
      renderBench();
    if (s.scenario !== last.scenario) {
      renderComparison();
      if (s.discovery === 3) renderDiscovery();
    }
    if (s.discovery !== last.discovery) renderDiscovery();
    if (rtResult) {
      const c = rtConfigOf(s),
        same = Object.keys(c).every((k) => c[k] === rtResult.c[k]);
      rtConf.textContent =
        rtDescribe(rtResult.c) +
        (same
          ? ""
          : " Controls changed? Rerun to compare; the displayed result retains this configuration.");
    }
    last = { ...s };
  });
  renderBench();
  renderCalibration();
  renderComparison();
  renderDiscovery();
  rtConf.textContent =
    "No run yet. Choose a block length and washout, then run the experiment; the result keeps the configuration it was computed with.";
  guided(root, state);
  tools(root, state);
  loadGrid();
})();
