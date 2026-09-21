/* Experiment-design laboratory: two zones, one shared fleet. Every number on this page comes
 * from science/marketplace.js (browser global CausalMarketplace). The opening trace is the
 * validated fixture examples/marketplace/fixtures/hand_worked.json, replayed through simulate(). */
(function () {
  const { store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, Plot, player } = CausalAnim,
    M = CausalMarketplace,
    root = document.querySelector("[data-lab]"),
    byId = (id) => document.getElementById(id),
    ASSIGN_SEED = 7,
    REF_REPS = 30,
    EXP_REPS = 30,
    EXP_SEED = 500,
    REF_SEED = 100,
    COLOR = {
      A: "var(--p)",
      B: "var(--or)",
      inTime: "var(--green)",
      late: "var(--purple)",
      unserved: "var(--red)",
      waiting: "var(--muted)",
    },
    CASE = {
      fleet: 5,
      demandPerMinute: 0.55,
      blockLength: 12,
      washout: 0,
      demandSeed: 11,
      assignSeed: ASSIGN_SEED,
    },
    // Copied from examples/marketplace/fixtures/hand_worked.json (simulator 1.0.0). The
    // expected rows are not copied: simulate() reproduces them, and tests/marketplace.test.cjs
    // checks that it does.
    FIXTURE = {
      config: {
        horizon: 20,
        followUp: 20,
        fleet: 2,
        demandPerMinute: 0.35,
        zoneShare: 0.5,
        crossDestShare: 0.3,
        maxWait: 3,
        deadline: 4,
        pickupLocal: 2,
        pickupCross: 4,
        tripLocal: 6,
        tripCross: 10,
        blockLength: 10,
        washout: 0,
        demandSeed: 11,
        assignSeed: 7,
        schedule: [
          { block: 0, start: 0, end: 10, policy: "A" },
          { block: 1, start: 10, end: 20, policy: "B" },
          { block: 2, start: 20, end: 30, policy: "A" },
          { block: 3, start: 30, end: 40, policy: "B" },
        ],
      },
      fleet: [
        { id: 0, zone: 0, freeAt: 0 },
        { id: 1, zone: 1, freeAt: 0 },
      ],
      requests: [
        { id: 0, t: 0, origin: 0, dest: 0, maxWait: 3 },
        { id: 1, t: 1, origin: 0, dest: 1, maxWait: 3 },
        { id: 2, t: 2, origin: 0, dest: 0, maxWait: 3 },
        { id: 3, t: 9, origin: 0, dest: 0, maxWait: 3 },
        { id: 4, t: 11, origin: 1, dest: 1, maxWait: 3 },
        { id: 5, t: 12, origin: 0, dest: 0, maxWait: 3 },
      ],
    };

  const state = store(
    "experiment-design-lab",
    {
      step: 0,
      fleet: 6,
      demand: 0.35,
      block: 30,
      washout: 0,
      seed: 11,
      predictHelp: "",
      predictCloser: "",
      caseDesign: "",
      caseSign: "",
    },
    {
      step: [0, 4],
      fleet: [3, 12],
      demand: [0.15, 0.6],
      block: [10, 60],
      washout: [0, 10],
      seed: [1, 4294967295],
      predictHelp: ["", "helps", "hurts", "none"],
      predictCloser: ["", "request", "switchback", "same"],
      caseDesign: ["", "request", "switchback", "more"],
      caseSign: ["", "negative", "zero", "positive"],
    },
  );

  /* ---------- markup ---------- */
  const predictHTML = (key, question, options) =>
    `<fieldset class="forecast" data-key="${key}"><legend>Predict first</legend><p>${question}</p><div class="btns">${options
      .map(
        ([v, label]) =>
          `<button type="button" data-value="${v}" aria-pressed="false">${label}</button>`,
      )
      .join("")}</div><p class="forecast-result" role="status"></p></fieldset>`;
  root.innerHTML = `<section class="lab-step" data-title="The product question"><h2 tabindex="-1">Should a vehicle from the next zone be allowed to serve this request?</h2><p>A shared fleet serves two adjacent zones. Each request arrives at a minute, in a zone, with a maximum wait before the rider gives up. Two dispatch rules are on the table.</p><div class="policy-grid"><div class="policy A"><h3>Policy A: local only</h3><p>Look for a free vehicle in the request's own zone. If there is none, the request waits and tries again next minute, until it expires.</p></div><div class="policy B"><h3>Policy B: local, then the neighbour</h3><p>Same search; if the own zone has no free vehicle, take a free one from the neighbouring zone. A cross-zone pickup takes longer (4 minutes instead of 2), and that vehicle is now away from its zone.</p></div></div><h3>The estimand contract</h3><dl class="contract"><dt>Primary metric</dt><dd>The fraction of eligible requests, those arriving in the evaluation window, that are picked up within the deadline after arrival. Unserved requests stay in the denominator. The last arrivals are followed until every eligible request has a terminal status.</dd><dt>Policy target</dt><dd>The expected difference in that fraction between a world running all-B and a world running all-A, under the same demand process, the same horizon, and the same distribution of initial fleet positions.</dd><dt>What it omits</dt><dd>Riders changing their behaviour because of the policy (demand stays exogenous), and long-run equilibrium such as drivers repositioning or joining. The target is a statement about this window, not about the service a year later.</dd></dl><p class="math">Ψ = E[fulfilment under all-B] − E[fulfilment under all-A]</p>${predictHTML(
    "predictHelp",
    "With a small fleet, does letting B pull vehicles from the other zone help the A requests that arrive in that other zone right after?",
    [
      ["helps", "It helps them"],
      ["hurts", "It hurts them"],
      ["none", "No effect on them"],
    ],
  )}<p class="note">One vehicle serves one request at a time. That is the whole mechanism of interference here: whatever B does to a vehicle changes what the next request finds, whichever policy that next request was assigned.</p></section>
<section class="lab-step" data-title="Step through the fleet"><h2 tabindex="-1">Six requests, two vehicles, one switch</h2><p>This is the hand-worked trace that validates the simulator: maximum wait 3 minutes, deadline 4, local pickup 2 minutes, cross-zone pickup 4, local trip 6, cross-zone trip 10. The schedule runs policy A for minutes 0–9 and policy B for 10–19; the eligible window closes at t = 20 and the fleet is followed to t = 40. Press Step to advance the clock one minute at a time.</p><div class="figure" id="trace-figure"><div class="fig-row"><div><svg id="trace-svg" role="img" aria-label="Timeline of two zones from minute 0 to 40. Each zone lane shows request arrivals as dots coloured by outcome and the two vehicles as bars while busy. A dashed line marks the policy switch at minute 10. The table and the minute-by-minute text below give every value."></svg><div id="trace-player"></div><p class="legend"><span style="color:var(--green)">Green dot: served in time</span><span style="color:var(--purple)">Purple dot: served late</span><span style="color:var(--red)">Red ×: unserved</span><span style="color:var(--muted)">Hollow dot, dashed tail: waiting</span><span style="color:var(--p)">Blue bar: busy under A</span><span style="color:var(--or)">Orange bar: busy under B</span></p></div><div><div class="fig-readout" id="trace-readout"></div></div></div><p class="fig-caption" id="trace-caption"></p></div><div id="trace-table"></div><details><summary>Every minute in words</summary><ol id="trace-log"></ol></details><p>The switch at t = 10 changes which rule a new request uses. It does not touch vehicle 0, which is mid-trip until t = 17. Request 5 arrives at t = 12 under policy B, looks in both zones, and still finds nobody free.</p></section>
<section class="lab-step" data-title="Two designs, one fleet"><h2 tabindex="-1">Randomize requests, or randomize time blocks?</h2><p>Request-level randomization flips a coin for every request while all of them share the fleet. A randomized switchback flips a coin for every time block, so the whole market runs one policy at a time. Both are compared with the full-policy reference: repeated all-B and all-A worlds with matched demand.</p><div class="ctl-grid"><label>Fleet size <input id="c-fleet" type="range" min="3" max="12" step="1"></label><label>Demand, requests per minute <input id="c-demand" type="range" min="0.15" max="0.6" step="0.05"></label><label>Block length, minutes <input id="c-block" type="range" min="10" max="60" step="5"></label><label>Washout, minutes dropped after each switch <input id="c-washout" type="range" min="0" max="10" step="1"></label><label>Demand seed <input id="c-seed" type="number" min="1" max="4294967295" step="1"></label></div><p class="note">The demand seed generates the requests and the initial fleet, shared by both designs. Assignment seed ${ASSIGN_SEED} (fixed) draws the coins. Horizon 240 minutes plus 30 minutes of follow-up.</p>${predictHTML(
    "predictCloser",
    "Which design's estimate will be closer to the all-B minus all-A reference?",
    [
      ["request", "Request-level"],
      ["switchback", "Switchback"],
      ["same", "About the same"],
    ],
  )}<div class="btns"><button id="run-designs" class="primary" type="button">Run both designs</button></div><p id="run-status" role="status">No run yet. Predict, then run.</p><p class="run-config" id="run-config" hidden></p><div class="design-pair"><div class="figure"><h3>Request-level randomization</h3><svg id="design-request" role="img" aria-label="Request-level run: a strip of coloured ticks, one per request, above the fraction of the fleet busy each minute and the fulfilment of A and B requests in each window. Values follow in the table."></svg><p class="fig-caption" id="cap-request"></p></div><div class="figure"><h3>Randomized switchback</h3><svg id="design-switchback" role="img" aria-label="Switchback run: a strip of coloured blocks above the fraction of the fleet busy each minute and the fulfilment of each block. Values follow in the table."></svg><p class="fig-caption" id="cap-switchback"></p></div></div><p class="legend" id="design-legend" hidden><span style="color:var(--p)">Blue: policy A</span><span style="color:var(--or)">Orange: policy B</span><span style="color:var(--ink)">Thin dark step: fraction of fleet busy</span><span>Thick segments: fulfilment per window (unserved in the denominator)</span><span style="color:var(--red)">Red shading: washout</span></p><div id="design-results"></div></section>
<section class="lab-step" data-title="What a switch does not reset"><h2 tabindex="-1">The block changes at a minute; the fleet does not</h2><p>Predict before you look: at the moment a switchback flips from one policy to the other, what happens to the vehicles that are mid-trip? Then move the washout slider. It deletes the first minutes of every block from the analysis. Watch what it does to the vehicles.</p><div class="figure" id="zoom-figure"><div class="fig-row"><div><svg id="zoom-svg" role="img" aria-label="Zoom on one policy switch: one row per vehicle with busy bars coloured by the policy of the request being served, requests as dots along the top, the switch as a dashed line and the washout window shaded. Values follow beside the figure."></svg><p class="legend"><span style="color:var(--p)">Blue bar: serving an A request</span><span style="color:var(--or)">Orange bar: serving a B request</span><span style="color:var(--red)">Red outline: trip carried across the switch</span><span style="color:var(--muted)">Faded dot: deleted by the washout</span></p></div><div><div class="fig-controls"><label>Washout, minutes dropped after each switch <input id="c-washout-2" type="range" min="0" max="10" step="1"></label></div><div class="fig-readout" id="zoom-readout"></div></div></div><p class="fig-caption" id="zoom-caption"></p></div><p class="run-config" id="zoom-config"></p><p class="warning">A washout needs a scientific rationale: a stated carryover length and a reason to believe it for this fleet. It also changes what is analysed. With washout w the estimate describes arrivals from minute w of each block onward, a different population of requests and time periods from the contract in step 1.</p><p>Bojinov, Simchi-Levi and Zhao, <a href="https://arxiv.org/abs/2009.00148">Design and analysis of switchback experiments</a>, give a precise design and inference for switchbacks under bounded carryover: after m periods, the outcome depends on the last m assignments only. That is a premise about the system. It is not automatically valid for this fleet: even bounded trip durations do not ensure that the fleet's location distribution forgets earlier assignments after a fixed number of blocks, because where a vehicle ends up depends on which requests it was pulled toward.</p></section>
<section class="lab-step" data-title="A changed case"><h2 tabindex="-1">Busier, with shorter blocks: what would you run?</h2><p>Nothing is drawn for you this time. The case: fleet ${CASE.fleet}, demand ${CASE.demandPerMinute} requests per minute, blocks of ${CASE.blockLength} minutes, washout ${CASE.washout}, demand seed ${CASE.demandSeed}, assignment seed ${CASE.assignSeed}. A cross-zone trip takes 14 minutes, longer than a block.</p><fieldset class="case-box"><legend>Which design would you run?</legend><label><span><input type="radio" name="case-design" value="request"> Request-level randomization</span></label><label><span><input type="radio" name="case-design" value="switchback"> Randomized switchback with these blocks</span></label><label><span><input type="radio" name="case-design" value="more"> Neither yet: I would ask for a different design or more evidence</span></label></fieldset><label>Sign of the bias of the request-level estimate relative to the reference <select id="case-sign"><option value="">Choose a sign</option><option value="negative">Negative: it will understate B</option><option value="zero">Indistinguishable from zero</option><option value="positive">Positive: it will overstate B</option></select></label><label>What could make the result misleading? <textarea id="case-text" rows="4" placeholder="Carryover, exogenous demand, the population the washout leaves behind, …"></textarea></label><p class="note">Your text is saved in this browser only and is not graded.</p><div class="btns"><button id="check-case" class="primary" type="button">Check the sign against ${EXP_REPS} replications</button></div><p id="case-status" role="status"></p><p class="run-config" id="case-config" hidden></p><div id="case-results"></div></section>`;

  /* ---------- controls and prediction cards ---------- */
  const rangeFormat = {
    fleet: (v) => v + " vehicles",
    demand: (v) => fmt(v, 2) + " per minute",
    block: (v) => v + " minutes",
    washout: (v) => (v ? v + " minutes" : "none"),
  };
  [
    ["c-fleet", "fleet"],
    ["c-demand", "demand"],
    ["c-block", "block"],
    ["c-washout", "washout"],
    ["c-washout-2", "washout"],
    ["c-seed", "seed"],
  ].forEach(([id, key]) => {
    const input = byId(id);
    control(input, state, key);
    if (input.type === "range") {
      const out = html("output", { for: id });
      input.before(out);
      const update = () =>
        (out.textContent = rangeFormat[key](state.get()[key]));
      state.subscribe(update);
      update();
    }
  });
  function wirePredict(key, explain) {
    const box = root.querySelector(`.forecast[data-key="${key}"]`),
      out = box.querySelector(".forecast-result");
    box
      .querySelectorAll("button")
      .forEach(
        (b) => (b.onclick = () => state.set({ [key]: b.dataset.value })),
      );
    const render = () => {
      const v = state.get()[key];
      box
        .querySelectorAll("button")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.value === v)),
        );
      out.textContent = v ? explain(v) : "";
    };
    state.subscribe(render);
    render();
  }
  wirePredict(
    "predictHelp",
    (v) =>
      (v === "hurts"
        ? "Your prediction matches the mechanism. "
        : "The mechanism says otherwise. ") +
      "When B takes a vehicle out of the neighbouring zone, the next A request there finds one fewer free local vehicle, and A is not allowed to look anywhere else. Those A requests are served less often, so an A-versus-B comparison inside one shared fleet is partly measuring what B did to A. Step 3 shows how large that gets.",
  );

  /* ---------- pure helpers ---------- */
  const full = (partial) => ({ ...M.DEFAULT_CONFIG, ...partial }),
    labConfig = () => {
      const c = state.get();
      return full({
        fleet: c.fleet,
        demandPerMinute: c.demand,
        blockLength: c.block,
        washout: c.washout,
        demandSeed: c.seed,
        assignSeed: ASSIGN_SEED,
      });
    },
    // Exogenous inputs exactly as simulate() would generate them, so both designs share them.
    inputs = (c) => {
      const random = M.rng(c.demandSeed),
        requests = M.generateRequests(c, random),
        fleet = M.initialFleet(c, random);
      return { requests, fleet };
    },
    clone = (rows) => rows.map((r) => ({ ...r })),
    runDesign = (c, kind, inp) =>
      M.simulate(c, kind, {
        requests: clone(inp.requests),
        fleet: clone(inp.fleet),
      }),
    // Vehicle timelines from the event log: busy segments [t0, t1) with the request served.
    segments = (run, fleet0) => {
      const reqById = new Map(run.requests.map((o) => [o.id, o])),
        out = fleet0.map((v) => ({ id: v.id, zone0: v.zone, busy: [] }));
      run.events
        .filter((e) => e.state === "assigned")
        .forEach((e) => {
          const o = reqById.get(e.request);
          out[e.vehicle].busy.push({
            t0: e.t,
            t1: o.complete,
            pickup: o.pickup,
            request: o.id,
            policy: o.policy,
            zone: e.zone,
            dest: o.dest,
          });
        });
      out.forEach((v) => v.busy.sort((a, b) => a.t0 - b.t0));
      return out;
    },
    utilisation = (segs, end) =>
      Array.from(
        { length: end },
        (_, t) =>
          segs.filter((v) => v.busy.some((s) => s.t0 <= t && t < s.t1)).length /
          segs.length,
      ),
    carryover = (segs, B) =>
      segs.flatMap((v) =>
        v.busy
          .filter((s) => s.t0 < B && s.t1 > B)
          .map((s) => ({ ...s, vehicle: v.id })),
      ),
    // Fulfilment per window of length L, split by policy for request-level designs.
    windows = (run, washout) => {
      const c = run.config,
        L = c.blockLength,
        n = Math.ceil(c.horizon / L),
        rows = run.requests.filter((o) => o.t < c.horizon),
        out = [];
      for (let b = 0; b < n; b++) {
        const from = b * L,
          to = Math.min((b + 1) * L, c.horizon),
          inWin = rows.filter((o) => Math.floor(o.t / L) === b);
        if (run.design.kind === "switchback") {
          const kept = inWin.filter((o) => o.t - from >= washout);
          if (kept.length)
            out.push({
              block: b,
              policy: run.design.schedule[b].policy,
              from: from + washout,
              to,
              y: M.fulfilment(kept),
              n: kept.length,
            });
        } else
          ["A", "B"].forEach((p) => {
            const kept = inWin.filter((o) => o.policy === p);
            if (kept.length)
              out.push({
                block: b,
                policy: p,
                from,
                to,
                y: M.fulfilment(kept),
                n: kept.length,
              });
          });
      }
      return out;
    },
    status = (o) =>
      o.status === "unserved" ? "unserved" : o.servedInTime ? "inTime" : "late",
    statusWord = {
      inTime: "served in time",
      late: "served late",
      unserved: "unserved",
      waiting: "waiting",
    },
    readout = (id, pairs) =>
      byId(id).replaceChildren(
        ...pairs.flatMap(([k, v]) => [
          html("span", { class: "k" }, k),
          html("span", {}, String(v)),
        ]),
      ),
    pm = (x, s) => `${fmt(x, 3)} ± ${fmt(s, 3)}`,
    describe = (c, extra = "") =>
      `Configuration: fleet ${c.fleet}; demand ${fmt(c.demandPerMinute, 2)}/min; block ${c.blockLength} min; washout ${c.washout} min; demand seed ${c.demandSeed}; assignment seed ${c.assignSeed}; horizon ${c.horizon} + ${c.followUp} follow-up; simulator v${M.VERSION}.${extra}`;

  /* ---------- Step 2: the fixture trace ---------- */
  const TRACE = (() => {
    const run = M.simulate(FIXTURE.config, "fixed", {
        requests: clone(FIXTURE.requests),
        fleet: clone(FIXTURE.fleet),
      }),
      segs = segments(run, FIXTURE.fleet),
      c = run.config,
      end = c.horizon + c.followUp,
      assigned = new Map(
        run.events
          .filter((e) => e.state === "assigned")
          .map((e) => [e.request, e]),
      ),
      terminal = (o) =>
        o.status === "served"
          ? assigned.get(o.id).t
          : Math.min(o.t + o.maxWait + 1, end),
      before = (q, o) => q.t < o.t || (q.t === o.t && q.id < o.id),
      // Fleet state at minute t as the matcher sees it while processing request o.
      seen = (v, t, o) => {
        const done = v.busy.filter(
          (s) => s.t0 < t || (s.t0 === t && before(run.requests[s.request], o)),
        );
        const last = done[done.length - 1];
        return {
          id: v.id,
          zone: last ? last.dest : v.zone0,
          busyUntil: last && last.t1 > t ? last.t1 : null,
        };
      },
      busyList = (list) =>
        list.length
          ? list
              .map((x) => `vehicle ${x.id} busy until ${x.busyUntil}`)
              .join(" and ")
          : "no vehicle at all",
      moments = [];
    run.requests.forEach((o) => (o.maxWait = FIXTURE.requests[o.id].maxWait));
    const add = (t, order, text) => moments.push({ t, order, text });
    run.design.schedule.forEach((b) => {
      if (b.start > 0 && b.start < end) {
        const carried = carryover(segs, b.start);
        add(
          b.start,
          0,
          `block ${b.block} begins under policy ${b.policy}; ` +
            (carried.length
              ? carried
                  .map(
                    (s) =>
                      `vehicle ${s.vehicle} is still busy until ${s.t1} with request ${s.request} from the previous block`,
                  )
                  .join(", ") + ": the switch does not reset the fleet"
              : "every vehicle happens to be free"),
        );
      }
    });
    run.events
      .filter((e) => e.state === "free")
      .forEach((e) =>
        add(
          e.t,
          1,
          `vehicle ${e.vehicle} completes request ${e.request} and is free in zone ${e.zone}`,
        ),
      );
    run.requests.forEach((o) => {
      const t = o.t,
        z = o.origin,
        P = o.policy,
        e = assigned.get(o.id),
        local = segs.map((v) => seen(v, t, o)).filter((x) => x.zone === z),
        other = segs.map((v) => seen(v, t, o)).filter((x) => x.zone === 1 - z),
        localBusy = local.filter((x) => x.busyUntil),
        verdict = () =>
          `pickup at ${o.pickup}, wait ${o.wait} ${o.servedInTime ? "≤" : ">"} deadline ${c.deadline}: ${o.servedInTime ? "served in time" : "served late"}`;
      let text = `request ${o.id} (zone ${z}, policy ${P}) arrives`;
      if (e && e.t === t) {
        text +=
          e.zone === z
            ? `; vehicle ${e.vehicle} is free in zone ${z}: ${verdict()}`
            : `; no free vehicle in zone ${z} (${busyList(localBusy)}); B looks in zone ${1 - z} and takes vehicle ${e.vehicle}: cross-zone ${verdict()}`;
      } else {
        text += ` and finds ${local.length ? busyList(localBusy) : "no vehicle in zone " + z}`;
        text +=
          P === "A"
            ? `; A does not look in zone ${1 - z}, so it waits`
            : `; B also looks in zone ${1 - z}: ${other.length ? busyList(other.filter((x) => x.busyUntil)) : "no vehicle there"}, so it waits`;
      }
      add(t, 3, text);
      if (e && e.t > t)
        add(
          e.t,
          2,
          `request ${o.id}, waiting since ${t}, is matched to vehicle ${e.vehicle}${e.zone === z ? "" : " from zone " + e.zone}: ${verdict()}`,
        );
      if (o.status === "unserved")
        add(
          terminal(o),
          1.5,
          terminal(o) < end
            ? `request ${o.id} exceeded its ${o.maxWait}-minute maximum wait: unserved`
            : `the trace ends with request ${o.id} still waiting: unserved`,
        );
    });
    if (c.horizon < end)
      add(
        c.horizon,
        4,
        "the eligible window closes; the follow-up only resolves requests already in the system",
      );
    moments.sort((a, b) => a.t - b.t || a.order - b.order);
    const byMinute = new Map();
    moments.forEach((m) =>
      byMinute.set(m.t, [...(byMinute.get(m.t) || []), m.text]),
    );
    return { run, segs, c, end, terminal, byMinute };
  })();
  let traceClock = 0;
  byId("trace-log").replaceChildren(
    ...[...TRACE.byMinute.entries()].map(([t, texts]) =>
      html("li", {}, `t = ${t}: ${texts.join("; ")}.`),
    ),
  );
  function drawLanes(plot, laneTop, laneH, label) {
    const L = plot.m.l,
      R = plot.W - plot.m.r;
    plot.bg.append(
      el("rect", {
        x: L,
        y: laneTop,
        width: R - L,
        height: laneH,
        fill: "var(--soft)",
        rx: 4,
      }),
      el(
        "text",
        {
          class: "tick",
          x: L - 6,
          y: laneTop + laneH - 5,
          "text-anchor": "end",
        },
        label,
      ),
    );
  }
  function drawSchedule(plot, schedule, end, y, h) {
    const g = plot.layer("schedule");
    schedule.forEach((b) => {
      if (b.start >= end) return;
      const x0 = plot.sx(b.start),
        x1 = plot.sx(Math.min(b.end, end));
      g.append(
        el("rect", {
          x: x0,
          y,
          width: x1 - x0,
          height: h,
          fill: COLOR[b.policy],
          opacity: 0.3,
        }),
        el(
          "text",
          {
            class: "tick ink",
            x: (x0 + x1) / 2,
            y: y + h - 5,
            "text-anchor": "middle",
            fill: "var(--ink)",
          },
          x1 - x0 > 72 ? `block ${b.block}: ${b.policy}` : b.policy,
        ),
      );
    });
    return g;
  }
  function requestMarker(g, x, y, kind, label, labelY = y - 9) {
    if (kind === "unserved")
      g.append(
        el("line", {
          x1: x - 5,
          x2: x + 5,
          y1: y - 5,
          y2: y + 5,
          stroke: COLOR.unserved,
          "stroke-width": 2.2,
        }),
        el("line", {
          x1: x - 5,
          x2: x + 5,
          y1: y + 5,
          y2: y - 5,
          stroke: COLOR.unserved,
          "stroke-width": 2.2,
        }),
      );
    else
      g.append(
        el("circle", {
          cx: x,
          cy: y,
          r: 5,
          fill: kind === "waiting" ? "var(--paper)" : COLOR[kind],
          stroke: COLOR[kind],
          "stroke-width": 2,
        }),
      );
    if (label)
      g.append(
        el(
          "text",
          { class: "tick", x, y: labelY, "text-anchor": "middle" },
          label,
        ),
      );
  }
  function busyBar(g, plot, s, y, h, clip, label) {
    const x0 = plot.sx(s.t0),
      xp = plot.sx(Math.min(s.pickup, clip)),
      x1 = plot.sx(Math.min(s.t1, clip));
    if (xp > x0)
      g.append(
        el("rect", {
          x: x0,
          y: y - h / 2,
          width: xp - x0,
          height: h,
          fill: COLOR[s.policy],
          opacity: 0.4,
        }),
      );
    if (x1 > xp)
      g.append(
        el("rect", {
          x: xp,
          y: y - h / 2,
          width: x1 - xp,
          height: h,
          fill: COLOR[s.policy],
          opacity: 0.85,
        }),
      );
    // The label sits on the solid trip segment, where light text is legible.
    if (label && x1 - xp > 34)
      g.append(
        el(
          "text",
          { class: "tick", x: xp + 4, y: y + 4, fill: "var(--paper)" },
          label,
        ),
      );
  }
  function drawTrace() {
    const { run, segs, c, end, terminal } = TRACE,
      clock = traceClock,
      rowH = 18,
      reqRow = 42,
      laneH = reqRow + segs.length * rowH + 14,
      gap = 12,
      mt = 56,
      plot = new Plot(byId("trace-svg"), {
        x: [0, end],
        y: [0, 1],
        width: 640,
        height: mt + 2 * laneH + gap + 44,
        margin: { l: 58, r: 18, t: mt, b: 44 },
        yticks: [],
        grid: false,
        xticks: Array.from({ length: end / 5 + 1 }, (_, i) => i * 5),
        xlabel: "Calendar time t, minutes",
      }),
      laneTop = (z) => mt + z * (laneH + gap),
      reqY = (z) => laneTop(z) + 33,
      // Request labels alternate between two rows so neighbours a minute apart stay legible.
      labelY = (z, id) => laneTop(z) + (id % 2 ? 23 : 11),
      vehY = (z, v) => laneTop(z) + reqRow + v * rowH + rowH / 2;
    [0, 1].forEach((z) => {
      drawLanes(plot, laneTop(z), laneH, "zone " + z);
      segs.forEach((v) =>
        plot.bg.append(
          el(
            "text",
            {
              class: "tick",
              x: plot.m.l - 6,
              y: vehY(z, v.id) + 4,
              "text-anchor": "end",
            },
            "v" + v.id,
          ),
        ),
      );
    });
    drawSchedule(plot, run.design.schedule, end, 20, 20);
    run.design.schedule.forEach((b, i) => {
      if (
        i &&
        b.policy !== run.design.schedule[i - 1].policy &&
        b.start < end
      ) {
        plot.vline(b.start, { stroke: "var(--ink)" }, null, plot.bg);
        plot.bg.append(
          el(
            "text",
            { class: "tick", x: plot.sx(b.start) + 4, y: 15 },
            "switch",
          ),
        );
      }
    });
    plot.vline(c.horizon, { stroke: "var(--muted)" }, null, plot.bg);
    plot.bg.append(
      el(
        "text",
        { class: "tick", x: plot.sx(c.horizon) + 4, y: plot.H - plot.m.b - 4 },
        "window ends",
      ),
    );
    const bars = plot.layer("vehicles"),
      dots = plot.layer("requests");
    segs.forEach((v) => {
      // Idle lines in the zone the vehicle is waiting in, then busy bars in its zone at assignment.
      let t = 0,
        zone = v.zone0;
      const idle = (from, to, z) => {
        if (to > from)
          bars.append(
            el("line", {
              x1: plot.sx(from),
              x2: plot.sx(Math.min(to, clock)),
              y1: vehY(z, v.id),
              y2: vehY(z, v.id),
              stroke: "var(--muted)",
              "stroke-width": 1.5,
              opacity: 0.6,
            }),
          );
      };
      v.busy.forEach((s) => {
        if (s.t0 <= clock) idle(t, s.t0, zone);
        if (s.t0 <= clock)
          busyBar(
            bars,
            plot,
            s,
            vehY(s.zone, v.id),
            12,
            clock,
            `v${v.id} · r${s.request}`,
          );
        if (s.dest !== s.zone && s.t1 <= clock)
          bars.append(
            el("line", {
              x1: plot.sx(s.t1),
              x2: plot.sx(s.t1),
              y1: vehY(s.zone, v.id),
              y2: vehY(s.dest, v.id),
              stroke: "var(--muted)",
              "stroke-dasharray": "2 3",
            }),
          );
        t = s.t1;
        zone = s.dest;
      });
      if (t <= clock) idle(t, end, zone);
    });
    run.requests.forEach((o) => {
      if (o.t > clock) return;
      const term = terminal(o),
        kind = clock < term ? "waiting" : status(o),
        y = reqY(o.origin);
      if (term > o.t)
        dots.append(
          el("line", {
            x1: plot.sx(o.t),
            x2: plot.sx(Math.min(term, clock)),
            y1: y,
            y2: y,
            stroke: "var(--muted)",
            "stroke-dasharray": "3 3",
            "stroke-width": 1.5,
          }),
        );
      requestMarker(
        dots,
        plot.sx(o.t),
        y,
        kind,
        "r" + o.id,
        labelY(o.origin, o.id),
      );
    });
    plot.fg.append(
      el("line", {
        x1: plot.sx(clock),
        x2: plot.sx(clock),
        y1: 20,
        y2: plot.H - plot.m.b,
        stroke: "var(--ink)",
        "stroke-width": 2,
      }),
    );
    // Linked table and readout: the state of every arrived request at this minute.
    const arrived = run.requests.filter((o) => o.t <= clock),
      kinds = arrived.map((o) => (clock < terminal(o) ? "waiting" : status(o))),
      count = (k) => kinds.filter((x) => x === k).length,
      block = run.design.schedule.find(
        (b) => clock >= b.start && clock < b.end,
      ),
      busy = segs.filter((v) =>
        v.busy.some((s) => s.t0 <= clock && clock < s.t1),
      ).length,
      inTime = count("inTime");
    byId("trace-table").innerHTML = table(
      [
        "Request",
        "Arrives",
        "Zone",
        "Policy",
        "Block",
        "Status at t",
        "Vehicle",
        "Pickup",
        "Complete",
        "Wait",
        "In time",
      ],
      arrived.map((o, i) => [
        o.id,
        o.t,
        o.origin,
        o.policy,
        o.block,
        statusWord[kinds[i]],
        kinds[i] === "waiting" || o.vehicle === null ? "—" : o.vehicle,
        kinds[i] === "waiting" || o.pickup === null ? "—" : o.pickup,
        kinds[i] === "waiting" || o.complete === null ? "—" : o.complete,
        kinds[i] === "waiting" || o.wait === null ? "—" : o.wait,
        kinds[i] === "waiting" ? "—" : o.servedInTime,
      ]),
      `Requests that have arrived by t = ${clock}` +
        (clock >= end
          ? " (final: identical to the fixture's expected rows)"
          : ""),
    );
    readout("trace-readout", [
      [
        "Clock",
        `t = ${clock}` +
          (block
            ? `, block ${block.block} (policy ${block.policy})`
            : ", follow-up"),
      ],
      ["Arrived, eligible", arrived.length],
      ["Served in time", inTime],
      ["Served late", count("late")],
      ["Unserved", count("unserved")],
      ["Waiting", count("waiting")],
      ["Vehicles busy", `${busy} of ${segs.length}`],
      [
        "Fulfilment so far",
        arrived.length
          ? `${inTime} / ${arrived.length} = ${fmt(inTime / arrived.length, 3)}`
          : "—",
      ],
      ...(clock >= end
        ? [
            [
              "Final fulfilment",
              `${inTime} / ${run.requests.length} = ${fmt(M.fulfilment(run.requests), 3)}, unserved counted in the denominator`,
            ],
          ]
        : []),
    ]);
    const now = TRACE.byMinute.get(clock);
    let caption = now
      ? `t = ${clock}: ${now.join("; ")}.`
      : `t = ${clock}: nothing changes this minute.`;
    if (!now) {
      const prev = [...TRACE.byMinute.keys()].filter((t) => t < clock).pop();
      if (prev !== undefined)
        caption += ` Last event, t = ${prev}: ${TRACE.byMinute.get(prev).join("; ")}.`;
    }
    byId("trace-caption").textContent = caption;
  }
  const tracePlayer = player(byId("trace-player"), {
    duration: 12000,
    label: "Calendar time t, minutes",
    onT(u) {
      traceClock = Math.round(u * TRACE.end);
      byId("trace-player").querySelector(".v").textContent = String(traceClock);
      drawTrace();
    },
  });
  // The kit's Step advances a tenth of the clock; this trace steps one minute.
  byId("trace-player").querySelectorAll("button")[1].onclick = () =>
    tracePlayer.set(Math.min(1, (traceClock + 1) / TRACE.end));
  drawTrace();

  /* ---------- Step 3: two designs on one fleet ---------- */
  let result = null;
  function drawDesign(svg, run, fleet0, washout) {
    const c = run.config,
      end = c.horizon + c.followUp,
      segs = segments(run, fleet0),
      sb = run.design.kind === "switchback",
      plot = new Plot(svg, {
        x: [0, end],
        y: [0, 1],
        width: 640,
        height: 300,
        margin: { l: 54, r: 18, t: 64, b: 44 },
        xlabel: "Calendar time, minutes",
        ylabel: "fraction",
      }),
      strip = plot.layer("strip"),
      sy = 20,
      sh = 20;
    if (sb) drawSchedule(plot, run.design.schedule, end, sy, sh);
    else
      run.requests.forEach((o) =>
        strip.append(
          el("line", {
            x1: plot.sx(o.t),
            x2: plot.sx(o.t),
            y1: sy,
            y2: sy + sh,
            stroke: COLOR[o.policy],
            "stroke-width": 1.2,
          }),
        ),
      );
    strip.append(
      el(
        "text",
        { class: "tick", x: plot.m.l, y: sy - 4 },
        sb ? "policy by block" : "policy per request (one tick each)",
      ),
    );
    if (sb && washout > 0)
      run.design.schedule.forEach((b) => {
        if (b.start < c.horizon)
          plot.marks.append(
            el("rect", {
              x: plot.sx(b.start),
              y: plot.m.t,
              width: plot.sx(b.start + washout) - plot.sx(b.start),
              height: plot.H - plot.m.t - plot.m.b,
              fill: "var(--red)",
              opacity: 0.1,
            }),
          );
      });
    plot.vline(c.horizon, { stroke: "var(--muted)" }, "window ends");
    const u = utilisation(segs, end);
    plot.step([...u.map((f, t) => [t, f]), [end, u[end - 1]]], {
      stroke: "var(--ink)",
      "stroke-width": 1.5,
      opacity: 0.8,
    });
    windows(run, sb ? washout : 0).forEach((w) =>
      plot.line(
        [
          [w.from, w.y],
          [w.to, w.y],
        ],
        {
          stroke: COLOR[w.policy],
          "stroke-width": 5,
          "stroke-linecap": "butt",
        },
      ),
    );
    return u;
  }
  function runDesigns() {
    const c = labConfig(),
      inp = inputs(c),
      rq = runDesign(c, "request", inp),
      sb = runDesign(c, "switchback", inp),
      ref = M.policyReference(c, REF_REPS, REF_SEED);
    result = {
      c,
      inp,
      rq,
      sb,
      ref,
      eq: M.requestEstimate(rq),
      es: M.switchbackEstimate(sb, { washout: c.washout }),
      xq: M.experiment(c, "request", {
        reps: EXP_REPS,
        seed: EXP_SEED,
        target: ref.estimate,
      }),
      xs: M.experiment(c, "switchback", {
        reps: EXP_REPS,
        seed: EXP_SEED,
        target: ref.estimate,
        washout: c.washout,
      }),
    };
    renderDesigns();
  }
  function renderDesigns() {
    const { c, inp, rq, sb, ref, eq, es, xq, xs } = result,
      uq = drawDesign(byId("design-request"), rq, inp.fleet, 0),
      us = drawDesign(byId("design-switchback"), sb, inp.fleet, c.washout),
      meanU = (u) => M.mean(u.slice(0, c.horizon)),
      dq = Math.abs(eq.estimate - ref.estimate),
      ds = Math.abs(es.estimate - ref.estimate);
    byId("design-legend").hidden = false;
    byId("run-config").hidden = false;
    byId("run-config").className = "run-config";
    byId("run-config").textContent = describe(
      c,
      ` Reference: ${REF_REPS} matched all-B/all-A pairs, seeds ${REF_SEED}–${REF_SEED + REF_REPS - 1}. Replications: ${EXP_REPS} per design, seeds ${EXP_SEED}–${EXP_SEED + EXP_REPS - 1}.`,
    );
    byId("run-status").textContent =
      `Run complete: ${rq.requests.length} eligible requests, ${inp.fleet.length} vehicles, ${sb.design.schedule.filter((b) => b.start < c.horizon).length} blocks.`;
    byId("cap-request").textContent =
      `${eq.nA} requests drew A and ${eq.nB} drew B while sharing the fleet, busy ${fmt(100 * meanU(uq), 0)}% of the time. In each window the thick blue and orange segments are the fulfilment of the A and B requests of that window.`;
    byId("cap-switchback").textContent =
      `${es.blocksA} blocks ran A and ${es.blocksB} ran B, fleet busy ${fmt(100 * meanU(us), 0)}% of the time. Each thick segment is one block's fulfilment${c.washout ? `, computed after dropping its first ${c.washout} minutes (${es.excluded} requests excluded in total)` : ""}.`;
    byId("design-results").innerHTML =
      table(
        ["Quantity", "Estimate", "SE", "Units", "What it targets"],
        [
          [
            "Request-level",
            fmt(eq.estimate, 3),
            fmt(eq.se, 3),
            `${eq.units} requests`,
            eq.about,
          ],
          [
            "Switchback",
            fmt(es.estimate, 3),
            fmt(es.se, 3),
            `${es.units} blocks`,
            es.about,
          ],
          [
            "Reference (all-B − all-A)",
            fmt(ref.estimate, 3),
            fmt(ref.mcse, 3) + " (Monte Carlo)",
            `${ref.reps} matched pairs`,
            "Mean difference in fulfilment over repeated all-B and all-A worlds with matched demand. This is a reference with Monte Carlo error, not exact truth.",
          ],
        ],
        "This run: one request-level experiment, one switchback, and the full-policy reference",
      ) +
      table(
        [
          "Design",
          "Mean estimate",
          "MC SE",
          "Bias vs reference",
          "95% interval coverage",
        ],
        [
          [
            "Request-level",
            fmt(xq.summary.mean, 3),
            fmt(xq.summary.mcse, 3),
            fmt(xq.summary.bias, 3),
            `${fmt(xq.summary.coverage, 2)} ± ${fmt(xq.summary.coverageMCSE, 2)}`,
          ],
          [
            "Switchback" + (c.washout ? ` (washout ${c.washout})` : ""),
            fmt(xs.summary.mean, 3),
            fmt(xs.summary.mcse, 3),
            fmt(xs.summary.bias, 3),
            `${fmt(xs.summary.coverage, 2)} ± ${fmt(xs.summary.coverageMCSE, 2)}`,
          ],
        ],
        `${EXP_REPS} independent replications of each design at this configuration`,
      );
    const closer =
        Math.abs(dq - ds) < 0.005 ? "same" : dq < ds ? "request" : "switchback",
      word = {
        request: "the request-level estimate",
        switchback: "the switchback estimate",
        same: "neither; they are about equally far",
      };
    predictCloserExplain = (v) =>
      `You predicted: ${word[v]}. In this run, ${word[closer]} was closer (request-level off by ${fmt(dq, 3)}, switchback by ${fmt(ds, 3)}). One run is noisy; over ${EXP_REPS} replications the request-level mean misses the reference by ${fmt(xq.summary.bias, 3)} and the switchback mean by ${fmt(xs.summary.bias, 3)}, each with Monte Carlo SE about ${fmt(Math.max(xq.summary.mcse, xs.summary.mcse), 3)}. Neither design is estimating the reference without bias here: both share one fleet across policies.`;
    renderPredictCloser();
  }
  let predictCloserExplain = () =>
    "Run both designs to compare your prediction with the result.";
  const renderPredictCloser = () => {
    const v = state.get().predictCloser,
      box = root.querySelector('.forecast[data-key="predictCloser"]');
    box
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.value === v)),
      );
    box.querySelector(".forecast-result").textContent = v
      ? predictCloserExplain(v)
      : "";
  };
  root
    .querySelectorAll('.forecast[data-key="predictCloser"] button')
    .forEach(
      (b) => (b.onclick = () => state.set({ predictCloser: b.dataset.value })),
    );
  state.subscribe(renderPredictCloser);
  renderPredictCloser();
  byId("run-designs").onclick = runDesigns;
  const same = (a, b) =>
    ["fleet", "demandPerMinute", "blockLength", "washout", "demandSeed"].every(
      (k) => a[k] === b[k],
    );
  state.subscribe(() => {
    if (!result) return;
    const stale = !same(result.c, labConfig()),
      box = byId("run-config");
    box.className = "run-config" + (stale ? " stale" : "");
    box.textContent =
      describe(result.c) +
      (stale
        ? " Controls changed: rerun to compare. The displayed results keep this configuration."
        : "");
  });

  /* ---------- Step 4: zoom on one switch ---------- */
  let zoomCache = null;
  function zoomData() {
    const c = labConfig(),
      key = JSON.stringify([
        c.fleet,
        c.demandPerMinute,
        c.blockLength,
        c.demandSeed,
      ]);
    if (zoomCache?.key !== key) {
      const inp = inputs(c),
        run = runDesign(c, "switchback", inp);
      zoomCache = { key, inp, run, segs: segments(run, inp.fleet) };
    }
    return { c, ...zoomCache };
  }
  function drawZoom() {
    const { c, inp, run, segs } = zoomData(),
      w = c.washout,
      L = c.blockLength,
      end = c.horizon + c.followUp,
      sched = run.design.schedule,
      bi = Math.max(
        1,
        sched.findIndex(
          (b, i) =>
            i > 0 && b.start < c.horizon && b.policy !== sched[i - 1].policy,
        ),
      ),
      B = sched[bi].start,
      span = Math.min(L, 20),
      x0 = Math.max(0, B - span),
      x1 = Math.min(end, B + span),
      rowH = 15,
      mt = 84,
      plot = new Plot(byId("zoom-svg"), {
        x: [x0, x1],
        y: [0, 1],
        width: 640,
        height: mt + segs.length * rowH + 50,
        margin: { l: 52, r: 18, t: mt, b: 44 },
        yticks: [],
        grid: false,
        xlabel: "Calendar time, minutes",
      }),
      vy = (v) => mt + v * rowH + rowH / 2,
      reqY = 64;
    drawSchedule(
      plot,
      sched
        .filter((b) => b.end > x0 && b.start < x1)
        .map((b) => ({
          ...b,
          start: Math.max(b.start, x0),
          end: Math.min(b.end, x1),
        })),
      end,
      20,
      20,
    );
    plot.bg.append(
      el(
        "text",
        { class: "tick", x: plot.m.l - 6, y: reqY + 4, "text-anchor": "end" },
        "requests",
      ),
      el(
        "text",
        { class: "tick", x: plot.sx(B) + 4, y: 15 },
        `switch ${sched[bi - 1].policy} → ${sched[bi].policy}`,
      ),
    );
    segs.forEach((v) =>
      plot.bg.append(
        el(
          "text",
          {
            class: "tick",
            x: plot.m.l - 6,
            y: vy(v.id) + 4,
            "text-anchor": "end",
          },
          "v" + v.id,
        ),
      ),
    );
    if (w > 0)
      sched.forEach((b) => {
        if (b.start > 0 && b.start < x1 && b.start + w > x0) {
          plot.marks.append(
            el("rect", {
              x: plot.sx(Math.max(b.start, x0)),
              y: 44,
              width:
                plot.sx(Math.min(b.start + w, x1)) -
                plot.sx(Math.max(b.start, x0)),
              height: plot.H - plot.m.b - 44,
              fill: "var(--red)",
              opacity: 0.1,
            }),
          );
          if (b.start === B)
            plot.marks.append(
              el(
                "text",
                { class: "tick", x: plot.sx(B) + 4, y: 54, fill: "var(--red)" },
                `washout ${w} min`,
              ),
            );
        }
      });
    const bars = plot.layer("vehicles"),
      dots = plot.layer("requests"),
      carried = carryover(segs, B);
    segs.forEach((v) =>
      v.busy.forEach((s) => {
        if (s.t1 <= x0 || s.t0 >= x1) return;
        const clipped = {
            ...s,
            t0: Math.max(s.t0, x0),
            pickup: Math.max(s.pickup, x0),
          },
          over = s.t0 < B && s.t1 > B;
        busyBar(bars, plot, clipped, vy(v.id), 10, x1, `r${s.request}`);
        if (over)
          bars.append(
            el("rect", {
              x: plot.sx(clipped.t0),
              y: vy(v.id) - 6,
              width: plot.sx(Math.min(s.t1, x1)) - plot.sx(clipped.t0),
              height: 12,
              fill: "none",
              stroke: "var(--red)",
              "stroke-width": 1.5,
            }),
          );
      }),
    );
    run.requests.forEach((o) => {
      if (o.t < x0 || o.t > x1 || o.t >= c.horizon) return;
      const excluded = o.t - o.block * L < w,
        g = el("g", { opacity: excluded ? 0.25 : 1 });
      requestMarker(g, plot.sx(o.t), reqY, status(o));
      dots.append(g);
    });
    plot.vline(B, { stroke: "var(--ink)" });
    const eligible = run.requests.filter((o) => o.t < c.horizon),
      atBoundary = eligible.filter((o) => o.block === bi && o.t - B < w).length,
      est = M.switchbackEstimate(run, { washout: w }),
      stillBusy = carried.filter((s) => s.t1 > B + w).length,
      lastEnd = carried.length ? Math.max(...carried.map((s) => s.t1)) : B;
    readout("zoom-readout", [
      [
        "Switch",
        `t = ${B}: block ${bi - 1} (${sched[bi - 1].policy}) → block ${bi} (${sched[bi].policy})`,
      ],
      ["Mid-trip at the switch", `${carried.length} of ${inp.fleet.length}`],
      [
        "After deleting rows",
        `${carried.length} of ${inp.fleet.length}, unchanged`,
      ],
      ["Last carried trip ends", `t = ${lastEnd}`],
      ["Still mid-trip at t = " + (B + w), `${stillBusy} of ${carried.length}`],
      ["Deleted at this switch", atBoundary],
      ["Deleted, all blocks", `${est.excluded} of ${eligible.length}`],
      ["Estimate", `${pm(est.estimate, est.se)}, ${est.units} blocks`],
    ]);
    byId("zoom-caption").textContent =
      `At t = ${B} the policy switches from ${sched[bi - 1].policy} to ${sched[bi].policy}, but ${carried.length} of ${inp.fleet.length} vehicles are still carrying trips that started under ${sched[bi - 1].policy}, the last ending at t = ${lastEnd}. ` +
      (w
        ? `Washout ${w} deletes ${atBoundary} arrivals at this switch and ${est.excluded} over all blocks from the analysis; ${stillBusy} of the carried trips ${stillBusy === 1 ? "is" : "are"} still running when the deleted minutes end. The vehicles are exactly as busy as before, because deleting rows changes the analysed population of requests and time periods, not the fleet. `
        : "No washout: every arrival counts, including those that met a fleet still shaped by the previous block. ") +
      "A washout needs a scientific rationale, a stated carryover length and a reason to believe it, and it changes what the estimate is about.";
    byId("zoom-config").textContent = describe(
      c,
      " Drawn live from the current controls; this switchback run is the one step 3 produces at the same configuration.",
    );
  }
  state.subscribe(drawZoom);
  drawZoom();

  /* ---------- Step 5: the changed case ---------- */
  const TEXT_KEY = "causality.lab.experiment-design-lab.reflection",
    caseText = byId("case-text");
  try {
    caseText.value = localStorage.getItem(TEXT_KEY) || "";
  } catch {}
  caseText.addEventListener("input", () => {
    try {
      localStorage.setItem(TEXT_KEY, caseText.value);
    } catch {}
  });
  root.querySelectorAll('input[name="case-design"]').forEach((r) => {
    r.addEventListener("change", () => state.set({ caseDesign: r.value }));
  });
  control(byId("case-sign"), state, "caseSign");
  const syncCase = () => {
    const c = state.get();
    root
      .querySelectorAll('input[name="case-design"]')
      .forEach((r) => (r.checked = r.value === c.caseDesign));
  };
  state.subscribe(syncCase);
  syncCase();
  byId("check-case").onclick = () => {
    const pick = state.get().caseSign,
      design = state.get().caseDesign;
    if (!pick) {
      byId("case-status").textContent =
        "Choose a sign first; the check compares your sign with the replications.";
      return;
    }
    const c = full(CASE),
      ref = M.policyReference(c, REF_REPS, REF_SEED),
      xq = M.experiment(c, "request", {
        reps: EXP_REPS,
        seed: EXP_SEED,
        target: ref.estimate,
      }),
      xs = M.experiment(c, "switchback", {
        reps: EXP_REPS,
        seed: EXP_SEED,
        target: ref.estimate,
        washout: c.washout,
      }),
      se = Math.sqrt(xq.summary.mcse ** 2 + ref.mcse ** 2),
      sign =
        Math.abs(xq.summary.bias) <= 2 * se
          ? "zero"
          : xq.summary.bias > 0
            ? "positive"
            : "negative",
      correct = pick === sign;
    Causality.event({
      type: "exercise",
      unit: "experiment-design-lab",
      id: "transfer",
      variant: 0,
      answer: pick,
      correct,
      assisted: false,
      transfer: true,
    });
    byId("case-config").hidden = false;
    byId("case-config").textContent = describe(
      c,
      ` Reference: ${REF_REPS} matched pairs, seeds ${REF_SEED}–${REF_SEED + REF_REPS - 1}. Replications: ${EXP_REPS} per design, seeds ${EXP_SEED}–${EXP_SEED + EXP_REPS - 1}.`,
    );
    byId("case-status").textContent =
      (correct
        ? "Your sign matches the replications. "
        : `The replications disagree with your sign (${pick}). `) +
      `The request-level bias is ${fmt(xq.summary.bias, 3)} with Monte Carlo SE ${fmt(se, 3)}, so its sign is ${sign === "zero" ? "not distinguishable from zero at two standard errors" : sign}. ` +
      (ref.estimate < 0
        ? "At this load the reference itself is negative: all-B sends vehicles on long cross-zone pickups and the market serves fewer requests in time, yet request-level randomization reports B as an improvement because B requests jump the local queue at their A neighbours' expense."
        : "The request-level design shares one fleet across policies, so it reports the effect of switching one request, not the effect of switching the market.") +
      (design === "more"
        ? " Asking for a different design or more evidence is a defensible answer here: the recorded outcome is your sign; the text is not graded."
        : design === "switchback"
          ? " With 12-minute blocks and 14-minute cross-zone trips, every block inherits the previous block's trips; see the switchback row before trusting it."
          : design === "request"
            ? " Request-level randomization is the design with the largest bias in this case; compare the rows."
            : "");
    byId("case-results").innerHTML = table(
      [
        "Quantity",
        "Mean estimate",
        "MC SE",
        "Bias vs reference",
        "95% interval coverage",
      ],
      [
        [
          "Reference (all-B − all-A)",
          fmt(ref.estimate, 3),
          fmt(ref.mcse, 3),
          "—",
          "reference, not exact truth",
        ],
        [
          "Request-level",
          fmt(xq.summary.mean, 3),
          fmt(xq.summary.mcse, 3),
          fmt(xq.summary.bias, 3),
          `${fmt(xq.summary.coverage, 2)} ± ${fmt(xq.summary.coverageMCSE, 2)}`,
        ],
        [
          "Switchback, 12-minute blocks, no washout",
          fmt(xs.summary.mean, 3),
          fmt(xs.summary.mcse, 3),
          fmt(xs.summary.bias, 3),
          `${fmt(xs.summary.coverage, 2)} ± ${fmt(xs.summary.coverageMCSE, 2)}`,
        ],
      ],
      "The changed case over " + EXP_REPS + " replications",
    );
  };

  guided(root, state);
  tools(root, state);
})();
