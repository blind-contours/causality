/* Interference laboratory: eight connected units, exact enumeration, and three different
 * questions that a randomized experiment might answer. Every number comes from
 * science/interference.js (CausalInterference). */
(function () {
  const { store, control, tools, guided, table, fmt, esc } = CausalLab,
    I = CausalInterference,
    A = CausalAnim,
    root = document.querySelector("[data-lab]");
  const DESIGNS = ["bernoulli", "complete", "cluster"],
    DESIGN_NAME = {
      bernoulli: "Bernoulli assignment",
      complete: "complete randomization",
      cluster: "cluster assignment",
    },
    N = I.N,
    ZERO = new Array(N).fill(0),
    FLAT = new Array(N).fill(1);
  // Node positions for the fixed graph: two tight groups joined by the bridge 3–4.
  const POS = [
    [70, 165],
    [165, 62],
    [165, 268],
    [255, 165],
    [385, 165],
    [475, 62],
    [475, 268],
    [570, 165],
  ];
  const state = store(
    "interference-lab",
    {
      step: 0,
      a: "00000000",
      last: -1,
      gamma: 0.8,
      tau: 1,
      hetero: true,
      shock: 0,
      design: "bernoulli",
      p: 0.5,
      k: 4,
      unit: 3,
      tdesign: "cluster",
      tanswer: -1,
      thint: false,
    },
    {
      step: [0, 4],
      last: [-1, 7],
      gamma: [0, 1.5],
      tau: [0, 2],
      shock: [0, 1],
      design: DESIGNS,
      p: [0.1, 0.9],
      k: [1, 7],
      unit: [0, 7],
      tdesign: DESIGNS,
      tanswer: [-1, 3],
    },
  );
  const unitOptions = (sel) =>
    Array.from(
      { length: N },
      (_, i) =>
        `<option value="${i}"${i === sel ? " selected" : ""}>Unit ${i}</option>`,
    ).join("");
  const designOptions =
    '<option value="bernoulli">Bernoulli: each unit independently with probability p</option><option value="complete">Complete: exactly k of the 8 units</option><option value="cluster">Cluster: each group {0,1,2,3}, {4,5,6,7} as a whole with probability p</option>';

  root.innerHTML = `<div class="predict" data-options="Only unit 3|Unit 3 and its neighbours 1, 2 and 4|Everyone" data-answer="1" data-hint="With spillover strength γ above zero, a unit's treatment enters its neighbours' outcomes through their exposure g. Nobody further away is touched. Set γ to zero and the answer becomes “only unit 3”.">Toggle unit 3. Whose outcomes change?</div>
<section class="lab-step" data-title="Whose outcome changes?"><h2 tabindex="-1">Whose outcome changes?</h2><p>Eight people on a fixed network. Click a node (or use the buttons) to give that person the treatment. Filled nodes are treated. Each node shows its outcome Y; the table lists own treatment, neighbour exposure g (the fraction of that unit's neighbours who are treated) and the outcome.</p><div class="figure"><div id="net-1"></div><p class="fig-caption" id="cap-1"></p><div class="fig-controls"><label><span>Spillover strength γ <span class="v" id="gamma-1-v"></span></span><input id="gamma-1" type="range" min="0" max="1.5" step="0.05"></label><div class="explore-only"><label><span>Direct effect τ <span class="v" id="tau-1-v"></span></span><input id="tau-1" type="range" min="0" max="2" step="0.05"></label><label><span><input id="hetero-1" type="checkbox"> Heterogeneous baselines b<sub>i</sub> (unchecked: every baseline equals 1)</span></label><label><span>Shared shock added to every outcome <span class="v" id="shock-1-v"></span></span><input id="shock-1" type="range" min="0" max="1" step="0.05"></label></div></div></div><div id="table-1"></div><p class="note">The network and the exposure summary g are a teaching model, assumed sufficient: nothing outside the drawn edges carries treatment, and only the fraction of treated neighbours matters. This is the exposure-mapping framework of <a href="https://arxiv.org/abs/1305.6156">Aronow &amp; Samii (2013)</a>; Hudgens &amp; Halloran (2008) give the definitions under partial interference, where spillover stays inside groups.</p></section>
<section class="lab-step" data-title="Recover the familiar model"><h2 tabindex="-1">Set γ to zero and recover the familiar model</h2><p>First set γ to 0 and toggle anyone: exactly one outcome moves. Then raise γ, choose a unit to watch, keep its own treatment fixed, and toggle its neighbours. The outcome of the watched unit moves although its own treatment did not.</p><div class="figure"><div class="fig-controls"><label><span>Spillover strength γ <span class="v" id="gamma-2-v"></span></span><input id="gamma-2" type="range" min="0" max="1.5" step="0.05"></label><div class="btns"><button type="button" id="gamma-zero">Set γ = 0</button><button type="button" id="gamma-default">Set γ = 0.8</button></div><label>Unit to watch <select id="unit-2">${unitOptions(3)}</select></label></div><div id="net-2"></div><p class="fig-caption" id="cap-2"></p><div class="fig-readout" id="readout-2"></div></div><div id="table-2"></div><details><summary>Give the rule its name</summary><p class="math" id="math-2"></p><p>Y<sub>i</sub>(a) depends on the whole assignment vector a, but only through two numbers: own treatment a<sub>i</sub> and neighbour exposure g<sub>i</sub>(a). With γ = 0 the second term vanishes and each outcome depends on its own treatment alone: the no-interference model you have used in every earlier lesson.</p></details></section>
<section class="lab-step" data-title="Three different questions"><h2 tabindex="-1">Three different questions</h2><p>“The effect of treatment” is now three different quantities. Each is exact in this model and each is a contrast between two exposure levels (own, g).</p><div class="figure"><svg id="bars-3" class="fig fig-wide" role="img" aria-label="Bar chart of four effects: direct, spillover, full policy, and the contrast the chosen design estimates. Values are in the table below."></svg><p class="fig-caption" id="cap-3"></p></div><div id="table-3"></div><h3>Which comparisons does the assignment mechanism allow?</h3><p>A contrast can only be estimated if both of its exposure levels can occur. Choose a design and a unit; the table lists every (own, g) level that has positive probability for that unit, from enumeration of every allowable assignment.</p><div class="fig-controls"><label>Design <select id="design-3">${designOptions}</select></label><label id="p-3-label"><span>Treatment probability p <span class="v" id="p-3-v"></span></span><input id="p-3" type="range" min="0.1" max="0.9" step="0.05"></label><label id="k-3-label">Number treated k <input id="k-3" type="number" min="1" max="7" step="1"></label><label>Unit <select id="unit-3">${unitOptions(3)}</select></label></div><div id="support-3"></div><div id="verdict-3"></div><p class="fig-caption" id="cap-3b"></p><p class="note">Individual randomization does not become meaningless under interference. Its contrast answers a question, exactly; it is just not the full-deployment question. Cluster assignment moves closer to that question and gives up the contrasts that separate own from neighbour effects.</p></section>
<section class="lab-step" data-title="Correlation is not interference"><h2 tabindex="-1">Correlation is not interference</h2><p>A shared shock, a good week for everyone, moves all eight outcomes together. Raise it and watch every number rise by the same amount. Then toggle unit 0: only the outcomes its treatment actually reaches change. Correlated outcomes alone do not establish interference.</p><div class="figure"><div class="fig-controls"><label><span>Shared shock added to every outcome <span class="v" id="shock-4-v"></span></span><input id="shock-4" type="range" min="0" max="1" step="0.05"></label><label><span>Spillover strength γ <span class="v" id="gamma-4-v"></span></span><input id="gamma-4" type="range" min="0" max="1.5" step="0.05"></label></div><div id="net-4"></div><p class="fig-caption" id="cap-4"></p></div><div id="table-4"></div><p class="note">Interference is a statement about what happens when one unit's treatment changes. A common cause of all outcomes produces co-movement without any unit's treatment reaching another; a test of interference must vary assignments, not merely observe that outcomes rise and fall together.</p></section>
<section class="lab-step" data-title="Transfer: a new target"><h2 tabindex="-1">A changed case: a new target</h2><p>Same network, new target. <strong>Unit 5</strong> stays untreated (own = 0). We want the spillover contrast from g = 0 (none of its neighbours 4, 6, 7 treated) to g = 2/3 (two of them treated). Using the design's default settings (Bernoulli p = 0.5, complete k = 4, cluster p = 0.5), which designs give both exposure levels positive probability, and what is the exact value of the contrast at the current γ?</p><div class="fig-controls"><label>Inspect a design for unit 5 <select id="tdesign-5">${designOptions}</select></label></div><div id="support-5"></div><fieldset class="transfer-options"><legend>Which designs support this contrast?</legend><div id="options-5"></div></fieldset><label><span>Exact contrast value at γ = <span class="v" id="gamma-5-v"></span> (to three decimals)</span><input id="answer-5" type="text" inputmode="decimal" autocomplete="off"></label><div class="btns"><button type="button" id="check-5" class="primary">Check my answer</button><button type="button" id="hint-5">Show me</button></div><p id="feedback-5" role="status"></p><p id="hint-text-5" hidden></p><label>Explain what randomization does and does not identify here <textarea id="justify-5" rows="3" placeholder="Which exposure levels does each design produce for unit 5? What can a treated-minus-control contrast answer, and what can it not?"></textarea></label><p class="note">The support check and the arithmetic are automatic. Your explanation is saved on this device for reflection; it is not graded.</p></section>`;

  const $ = (id) => document.getElementById(id);
  for (const [id, key] of Object.entries({
    "gamma-1": "gamma",
    "tau-1": "tau",
    "hetero-1": "hetero",
    "shock-1": "shock",
    "gamma-2": "gamma",
    "unit-2": "unit",
    "design-3": "design",
    "p-3": "p",
    "k-3": "k",
    "unit-3": "unit",
    "shock-4": "shock",
    "gamma-4": "gamma",
    "tdesign-5": "tdesign",
  }))
    control($(id), state, key);
  $("gamma-zero").onclick = () => state.set({ gamma: 0 });
  $("gamma-default").onclick = () => state.set({ gamma: 0.8 });

  const syncMode = () => {
    const explore = document.body.dataset.mode === "explore";
    root
      .querySelectorAll(".explore-only")
      .forEach((e) => (e.hidden = !explore));
  };
  window.addEventListener("causality:settings", syncMode);
  document.addEventListener("DOMContentLoaded", syncMode);

  let toggleSeq = 0;
  function toggle(i) {
    const a = assignment(state.get());
    a[i] = 1 - a[i];
    toggleSeq++;
    state.set({ a: a.join(""), last: i });
  }
  const assignment = (c) =>
    /^[01]{8}$/.test(c.a) ? [...c.a].map(Number) : ZERO.slice();
  const designOf = (c) =>
    c.design === "bernoulli"
      ? { type: "bernoulli", p: c.p }
      : c.design === "complete"
        ? { type: "complete", k: Math.round(c.k) }
        : { type: "cluster", p: c.p };
  const gfmt = (g) => {
    for (const d of [1, 2, 3])
      if (Math.abs(g * d - Math.round(g * d)) < 1e-3)
        return d === 1 ? String(Math.round(g)) : `${Math.round(g * d)}/${d}`;
    return fmt(g);
  };

  // The kernel stores exposure levels rounded to four decimals, so fractional levels
  // such as 2/3 must be matched at that precision.
  const level = (own, g) => ({ own, g: Number(g.toFixed(4)) });
  function model() {
    const c = state.get(),
      a = assignment(c),
      params = {
        tau: c.tau,
        gamma: c.gamma,
        shock: c.shock,
        baseline: c.hetero ? I.DEFAULTS.baseline : FLAT,
      },
      y = I.outcomes(a, params),
      g = I.exposure(a);
    let prev = null,
      hit = null,
      dy = null,
      dg = null;
    if (c.last >= 0) {
      prev = a.slice();
      prev[c.last] = 1 - prev[c.last];
      hit = I.affected(prev, c.last, params);
      const y0 = I.outcomes(prev, params),
        g0 = I.exposure(prev);
      dy = y.map((v, i) => v - y0[i]);
      dg = g.map((v, i) => v - g0[i]);
    }
    const design = designOf(c),
      est = I.estimands(params),
      dc = I.designContrast(design, params),
      support = I.exposureSupport(design)[c.unit],
      lv = level,
      verdict = {
        direct: I.contrastSupported(design, c.unit, lv(1, 0), lv(0, 0)),
        spill: I.contrastSupported(design, c.unit, lv(0, 1), lv(0, 0)),
        policy: I.contrastSupported(design, c.unit, lv(1, 1), lv(0, 0)),
      },
      shock = I.shockVersusSpillover(a, params);
    return {
      c,
      a,
      params,
      y,
      g,
      prev,
      hit,
      dy,
      dg,
      design,
      est,
      dc,
      support,
      verdict,
      shock,
    };
  }

  /* One network view: SVG nodes (mouse) plus a mirrored button list (keyboard). */
  function network(mount, label) {
    const svg = A.el("svg", {
      class: "fig fig-wide",
      viewBox: "0 0 640 330",
      role: "img",
      "aria-label": label,
    });
    const edges = A.el("g"),
      halos = A.el("g"),
      nodes = A.el("g");
    svg.append(edges, halos, nodes);
    I.EDGES.forEach(([i, j]) =>
      edges.append(
        A.el("line", {
          x1: POS[i][0],
          y1: POS[i][1],
          x2: POS[j][0],
          y2: POS[j][1],
          stroke: "var(--muted)",
          "stroke-width": 2,
          "stroke-opacity": 0.55,
        }),
      ),
    );
    const parts = POS.map(([x, y], i) => {
      const halo = A.el("circle", {
        cx: x,
        cy: y,
        r: 20,
        fill: "var(--or)",
        "fill-opacity": 0,
        stroke: "var(--or)",
        "stroke-width": 2,
        "stroke-dasharray": "4 3",
        "stroke-opacity": 0,
      });
      const circle = A.el("circle", {
        cx: x,
        cy: y,
        r: 20,
        fill: "var(--paper)",
        stroke: "var(--ink)",
        "stroke-width": 2,
      });
      const num = A.el(
        "text",
        {
          x,
          y: y + 5,
          "text-anchor": "middle",
          class: "fig-text ink",
          "font-weight": 600,
        },
        i,
      );
      const yl = A.el("text", {
        x,
        y: y + 38,
        "text-anchor": "middle",
        class: "fig-text ink",
        style: "paint-order:stroke;stroke:var(--paper);stroke-width:4px",
      });
      const gl = A.el("text", {
        x,
        y: y + 53,
        "text-anchor": "middle",
        class: "fig-text",
        style: "paint-order:stroke;stroke:var(--paper);stroke-width:4px",
      });
      const grp = A.el("g", { style: "cursor:pointer" }, circle, num, yl, gl);
      grp.addEventListener("click", () => toggle(i));
      halos.append(halo);
      nodes.append(grp);
      return { halo, circle, num, yl, gl };
    });
    const buttons = A.html("div", {
      class: "node-toggles",
      role: "group",
      "aria-label": "Toggle each unit's treatment",
    });
    const btns = POS.map((_, i) => {
      const b = A.html(
        "button",
        { type: "button", "aria-pressed": "false" },
        "Unit " + i,
      );
      b.onclick = () => toggle(i);
      buttons.append(b);
      return b;
    });
    mount.append(svg, buttons);
    let anim = null,
      seen = -1;
    return {
      update(m) {
        const { a, y, g, hit } = m;
        parts.forEach((p, i) => {
          const on = a[i] === 1;
          p.circle.setAttribute("fill", on ? "var(--purple)" : "var(--paper)");
          p.circle.setAttribute("stroke", on ? "var(--purple)" : "var(--ink)");
          if (on) p.num.setAttribute("fill", "#fff");
          else p.num.removeAttribute("fill");
          p.yl.textContent = "Y " + fmt(y[i], 2);
          p.gl.textContent = "g " + gfmt(g[i]);
          const changed = !!(hit && hit[i]);
          p.halo.setAttribute("stroke-opacity", changed ? 0.9 : 0);
          p.halo.setAttribute("fill-opacity", changed ? 0.18 : 0);
          p.halo.setAttribute("r", changed ? 30 : 20);
          btns[i].setAttribute("aria-pressed", String(on));
          btns[i].textContent = `Unit ${i}: ${on ? "treated" : "control"}`;
          btns[i].setAttribute(
            "aria-label",
            `Unit ${i}, currently ${on ? "treated" : "control"}. Toggle.`,
          );
        });
        if (hit && seen !== toggleSeq) {
          seen = toggleSeq;
          anim?.cancel();
          anim = A.tween({
            duration: 700,
            ease: A.ease.out,
            onUpdate: (u) =>
              parts.forEach((p, i) => {
                if (hit[i]) {
                  p.halo.setAttribute("r", 20 + 10 * u);
                  p.halo.setAttribute("fill-opacity", 0.18 * u);
                }
              }),
          });
        }
      },
    };
  }
  const nets = {
    1: network(
      $("net-1"),
      "Eight units on a network. Treated units are filled. Each node shows outcome Y and neighbour exposure g. Values are listed in the table below.",
    ),
    2: network(
      $("net-2"),
      "The same network. Halos mark the units whose outcomes changed at the last toggle.",
    ),
    4: network(
      $("net-4"),
      "The same network under a shared shock. Values are listed in the table below.",
    ),
  };

  function unitTable(m, withDelta) {
    const headers = ["Unit", "Neighbours", "Own a", "Exposure g", "Outcome Y"];
    if (withDelta) headers.push("Changed by last toggle");
    return table(
      headers,
      m.a.map((ai, i) => {
        const row = [
          i,
          I.NEIGHBOURS[i].join(", "),
          ai,
          gfmt(m.g[i]),
          fmt(m.y[i]),
        ];
        if (withDelta)
          row.push(
            m.hit
              ? m.hit[i]
                ? (m.dy[i] > 0 ? "+" : "") + fmt(m.dy[i])
                : "no"
              : "—",
          );
        return row;
      }),
      "Own treatment, neighbour exposure and outcome for every unit",
    );
  }

  function drawBars(m) {
    const { c, est, dc } = m,
      svg = $("bars-3"),
      bars = [
        { x: 0.5, v: est.direct, name: "direct", sub: "τ", fill: "var(--p)" },
        {
          x: 1.5,
          v: est.spilloverPerUnitExposure,
          name: "spillover g 0→1",
          sub: "γ",
          fill: "var(--teal)",
        },
        {
          x: 2.5,
          v: est.policy,
          name: "full policy",
          sub: "τ + γ",
          fill: "var(--green)",
        },
        {
          x: 3.5,
          v: dc.value,
          name: DESIGN_NAME[c.design].split(" ")[0] + " contrast",
          sub: "treated − control",
          fill: "var(--purple)",
        },
      ],
      vals = bars.map((b) => b.v),
      lo = Math.min(0, ...vals) - 0.25,
      hi = Math.max(0.5, ...vals) + 0.35,
      plot = new A.Plot(svg, {
        width: 600,
        height: 300,
        x: [0, 4],
        y: [lo, hi],
        xticks: [],
        ylabel: "effect on Y",
        margin: { b: 52 },
      });
    plot.hline(0, { stroke: "var(--muted)" });
    bars.forEach((b) => {
      plot.bars([[b.x, b.v]], 0.62, { fill: b.fill, "fill-opacity": 0.85 });
      plot.text(b.x, b.v, fmt(b.v), {
        "text-anchor": "middle",
        dy: b.v >= 0 ? -6 : 14,
        class: "fig-text ink",
      });
      plot.fg.append(
        A.el(
          "text",
          {
            x: plot.sx(b.x),
            y: plot.H - plot.m.b + 18,
            "text-anchor": "middle",
            class: "fig-text ink",
          },
          b.name,
        ),
        A.el(
          "text",
          {
            x: plot.sx(b.x),
            y: plot.H - plot.m.b + 34,
            "text-anchor": "middle",
            class: "fig-text",
          },
          b.sub,
        ),
      );
    });
  }

  const yes = (ok) =>
    ok
      ? '<span class="support-ok">supported</span>'
      : '<span class="support-no">not supported</span>';

  function render() {
    const m = model(),
      { c, a, y, g, est, dc, verdict, support } = m,
      u = c.unit;
    $("gamma-1-v").textContent = fmt(c.gamma);
    $("gamma-2-v").textContent = fmt(c.gamma);
    $("gamma-4-v").textContent = fmt(c.gamma);
    $("tau-1-v").textContent = fmt(c.tau);
    $("shock-1-v").textContent = fmt(c.shock);
    $("shock-4-v").textContent = fmt(c.shock);
    $("p-3-v").textContent = fmt(c.p);
    $("p-3-label").hidden = c.design === "complete";
    $("k-3-label").hidden = c.design !== "complete";
    Object.values(nets).forEach((n) => n.update(m));

    // Step 1
    const treated = a.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    $("cap-1").textContent = m.hit
      ? `Last toggle: unit ${c.last} is now ${a[c.last] ? "treated" : "control"}. Outcomes changed for ${m.hit.map((h, i) => (h ? i : -1)).filter((i) => i >= 0).length} unit(s): ${m.hit
          .map((h, i) =>
            h
              ? `unit ${i} by ${(m.dy[i] > 0 ? "+" : "") + fmt(m.dy[i])}`
              : null,
          )
          .filter(Boolean)
          .join(", ")}. Halos mark them.`
      : `Nobody is treated yet. Toggle a unit and watch which outcomes move. γ = ${fmt(c.gamma)}.`;
    if (!m.hit && treated.length)
      $("cap-1").textContent =
        `Treated: ${treated.join(", ")}. Toggle a unit and watch which outcomes move. γ = ${fmt(c.gamma)}.`;
    $("table-1").innerHTML = unitTable(m, true);

    // Step 2
    const nb = I.NEIGHBOURS[u];
    $("readout-2").innerHTML = [
      ["watched unit", String(u)],
      ["its neighbours", nb.join(", ")],
      ["own treatment a", String(a[u])],
      [
        "exposure g",
        `${gfmt(g[u])} (${nb.filter((j) => a[j]).length} of ${nb.length} neighbours treated)`,
      ],
      ["outcome Y", fmt(y[u])],
    ]
      .map(([k, v]) => `<span class="k">${esc(k)}</span><span>${esc(v)}</span>`)
      .join("");
    $("cap-2").textContent = !m.hit
      ? `γ = ${fmt(c.gamma)}. Toggle a unit to see how many outcomes move.`
      : c.gamma === 0
        ? `γ = 0: toggling unit ${c.last} moved exactly one outcome, its own, by ${(m.dy[c.last] > 0 ? "+" : "") + fmt(m.dy[c.last])} = ${a[c.last] ? "+" : "−"}τ. Its neighbours' exposure changed, but with γ = 0 exposure has no effect.`
        : `γ = ${fmt(c.gamma)}: toggling unit ${c.last} moved its own outcome by ${(m.dy[c.last] > 0 ? "+" : "") + fmt(m.dy[c.last])} (τ) and each neighbour j by γ × Δg_j: ${I.NEIGHBOURS[
            c.last
          ]
            .map(
              (j) =>
                `unit ${j} by ${(m.dy[j] > 0 ? "+" : "") + fmt(m.dy[j])} (Δg = ${(m.dg[j] > 0 ? "+" : "−") + gfmt(Math.abs(m.dg[j]))})`,
            )
            .join(
              ", ",
            )}. ${m.hit[u] && c.last !== u ? `The watched unit ${u} moved without its own treatment changing.` : ""}`;
    $("table-2").innerHTML = m.hit
      ? table(
          ["Unit", "Δ own a", "Δ exposure g", "τ·Δa", "γ·Δg", "Δ outcome Y"],
          a.map((ai, i) => {
            const da = ai - m.prev[i];
            return [
              i,
              da,
              fmt(m.dg[i]),
              fmt(c.tau * da),
              fmt(c.gamma * m.dg[i]),
              fmt(m.dy[i]),
            ];
          }),
          `Exact outcome changes from toggling unit ${c.last}`,
        )
      : "";
    $("math-2").innerHTML =
      `Y<sub>i</sub>(a) = b<sub>i</sub> + τ·a<sub>i</sub> + γ·g<sub>i</sub>(a),&nbsp; g<sub>i</sub>(a) = (treated neighbours of i) / (neighbours of i)<br>Currently τ = ${fmt(c.tau)}, γ = ${fmt(c.gamma)}; for unit ${u}: Y = ${fmt(m.params.baseline[u])} + ${fmt(c.tau)}·${a[u]} + ${fmt(c.gamma)}·${gfmt(g[u])}${c.shock ? ` + shock ${fmt(c.shock)}` : ""} = ${fmt(y[u])}`;

    // Step 3
    drawBars(m);
    const individual = c.design !== "cluster",
      gap = dc.meanExposureTreated - dc.meanExposureControl;
    $("cap-3").textContent =
      `Direct effect at fixed exposure: τ = ${fmt(est.direct)}. Spillover per unit of neighbour exposure at fixed own treatment: γ = ${fmt(est.spilloverPerUnitExposure)}. Full policy, everyone treated minus nobody treated: ${fmt(est.policy)} = τ + γ. The fourth bar is what the ${DESIGN_NAME[c.design]} treated-minus-control contrast estimates: ${fmt(dc.value)}.`;
    $("table-3").innerHTML = table(
      ["Quantity", "Exposure contrast", "Exact value"],
      [
        [
          "Direct effect at fixed exposure",
          "(own 1, g fixed) − (own 0, same g)",
          fmt(est.direct),
        ],
        [
          "Spillover at fixed own treatment",
          "(own 0, g 1) − (own 0, g 0)",
          fmt(est.spilloverPerUnitExposure),
        ],
        [
          "Full policy effect (mean over units)",
          "everyone treated − nobody treated",
          fmt(est.policy),
        ],
        [
          `${DESIGN_NAME[c.design]}: mean treated − mean control`,
          `averaged over assignments where both groups exist (probability ${fmt(dc.massDefined)})`,
          fmt(dc.value),
        ],
      ],
      "Three estimands and one design contrast, all exact",
    );
    $("support-3").innerHTML = table(
      ["Own a", "Exposure g", "Probability"],
      support.map((r) => [r.own, gfmt(r.g), fmt(r.prob, 4)]),
      `Exposure levels with positive probability for unit ${u} under ${DESIGN_NAME[c.design]}${c.design === "complete" ? ` (k = ${Math.round(c.k)})` : ` (p = ${fmt(c.p)})`}`,
    );
    $("verdict-3").innerHTML = table(
      ["Contrast for unit " + u, "Needs", "Under this design", "Exact value"],
      [
        [
          "Direct effect at g = 0",
          "(1, 0) and (0, 0)",
          verdict.direct,
          fmt(est.direct),
        ],
        [
          "Spillover, own = 0, g 0 → 1",
          "(0, 1) and (0, 0)",
          verdict.spill,
          fmt(est.spilloverPerUnitExposure),
        ],
        [
          "Full policy for this unit",
          "(1, 1) and (0, 0)",
          verdict.policy,
          fmt(est.policyByUnit[u]),
        ],
      ],
      "Is each contrast supported?",
    ).replace(
      /<td>(true|false)<\/td>/g,
      (_, v) => `<td>${yes(v === "true")}</td>`,
    );
    $("cap-3b").textContent = individual
      ? `Under ${DESIGN_NAME[c.design]} the treated-minus-control contrast is defined with probability ${fmt(dc.massDefined)} and equals ${fmt(dc.value)}. Exactly: τ + γ × (mean exposure of treated ${fmt(dc.meanExposureTreated)} − mean exposure of control ${fmt(dc.meanExposureControl)}) = τ − γ/7 = ${fmt(c.tau - c.gamma / 7)}. A treated unit's neighbours are drawn from the other seven, of whom one fewer can be treated, so the treated are exposed to 1/7 less than the control. This is neither the direct effect τ = ${fmt(c.tau)} nor the policy effect τ + γ = ${fmt(c.tau + c.gamma)}; it answers its own question.`
      : `Under cluster assignment the treated-minus-control contrast is defined only when exactly one cluster is treated (probability ${fmt(dc.massDefined)}). It then equals ${fmt(dc.value)} = τ + γ × (${fmt(dc.meanExposureTreated)} − ${fmt(dc.meanExposureControl)}): the treated cluster's bridge unit sees one untreated neighbour across the boundary and the control cluster's bridge unit sees one treated one, so the contrast falls short of the policy effect τ + γ = ${fmt(c.tau + c.gamma)} by γ × ${fmt(1 - gap)}. And every unit is either (1, 1) or (0, 0)-like: the contrasts separating own from neighbour effects are gone for non-bridge units.`;

    // Step 4
    const moved = m.shock.toggleAffects
      .map((h, i) => (h ? i : -1))
      .filter((i) => i >= 0);
    $("cap-4").textContent =
      `Shared shock ${fmt(c.shock)}: raising it by 0.5 moves all ${N} outcomes by exactly ${fmt(m.shock.shockMoves[0])} each, together. Toggling unit 0's treatment at γ = ${fmt(c.gamma)} changes ${moved.length} outcome(s): unit${moved.length > 1 ? "s" : ""} ${moved.join(", ")}. Co-movement comes from the shock; interference shows up only when an assignment changes.`;
    $("table-4").innerHTML = table(
      [
        "Unit",
        "Outcome Y now",
        "Y if the shock rises by 0.5",
        "Change from shock",
        "Changes if unit 0 is toggled?",
      ],
      a.map((_, i) => [
        i,
        fmt(y[i]),
        fmt(y[i] + m.shock.shockMoves[i]),
        "+" + fmt(m.shock.shockMoves[i]),
        m.shock.toggleAffects[i] ? "yes" : "no",
      ]),
      "A shared shock versus toggling one unit",
    );

    // Step 5
    renderTransfer(m);
  }

  /* Transfer: unit 5, own = 0, spillover from g = 0 to g = 2/3. */
  const TRANSFER = {
    unit: 5,
    gA: 0,
    gB: 2 / 3,
    aB: [0, 0, 0, 0, 1, 0, 1, 0], // neighbours 4 and 6 of unit 5 treated, 7 not: g_5 = 2/3
    aA: ZERO,
    designs: {
      bernoulli: { type: "bernoulli", p: 0.5 },
      complete: { type: "complete", k: 4 },
      cluster: { type: "cluster", p: 0.5 },
    },
    options: [
      { label: "Bernoulli only", pat: [1, 0, 0] },
      {
        label: "Bernoulli and complete (k = 4), but not cluster",
        pat: [1, 1, 0],
      },
      { label: "All three designs", pat: [1, 1, 1] },
      { label: "Cluster only", pat: [0, 0, 1] },
    ],
  };
  function transferModel(m) {
    const T = TRANSFER,
      lvA = level(0, T.gA),
      lvB = level(0, T.gB),
      pattern = DESIGNS.map((d) =>
        I.contrastSupported(T.designs[d], T.unit, lvA, lvB),
      ),
      value =
        I.outcomes(T.aB, m.params)[T.unit] - I.outcomes(T.aA, m.params)[T.unit],
      correct = T.options.findIndex((o) =>
        o.pat.every((v, i) => !!v === pattern[i]),
      ),
      support = I.exposureSupport(T.designs[m.c.tdesign])[T.unit];
    return { pattern, value, correct, support };
  }
  let optionsBuilt = false;
  function renderTransfer(m) {
    const t = transferModel(m),
      c = m.c;
    $("gamma-5-v").textContent = fmt(c.gamma);
    $("support-5").innerHTML = table(
      ["Own a", "Exposure g", "Probability"],
      t.support.map((r) => [r.own, gfmt(r.g), fmt(r.prob, 4)]),
      `Exposure levels for unit 5 under ${DESIGN_NAME[c.tdesign]} at its default setting`,
    );
    if (!optionsBuilt) {
      optionsBuilt = true;
      $("options-5").innerHTML = TRANSFER.options
        .map(
          (o, i) =>
            `<label><input type="radio" name="transfer-design" value="${i}"> <span>${esc(o.label)}</span></label>`,
        )
        .join("");
      $("options-5")
        .querySelectorAll("input")
        .forEach((r) => (r.onchange = () => state.set({ tanswer: +r.value })));
    }
    $("options-5")
      .querySelectorAll("input")
      .forEach((r) => (r.checked = +r.value === c.tanswer));
    if (c.thint) {
      const T = TRANSFER;
      $("hint-text-5").hidden = false;
      $("hint-text-5").textContent =
        `From enumeration: ${DESIGNS.map((d, i) => `${DESIGN_NAME[d]} ${t.pattern[i] ? "supports" : "does not support"} (0, 0) versus (0, 2/3) for unit 5`).join("; ")}. Under cluster assignment units 4, 6 and 7 are all in unit 5's own group, so g can only be 0 or 1. The value is γ × (2/3 − 0) = ${fmt(c.gamma)} × ${gfmt(T.gB)} = ${fmt(t.value)}; the baseline b₅ cancels.`;
    } else $("hint-text-5").hidden = true;
  }
  $("hint-5").onclick = () => state.set({ thint: true });
  $("check-5").onclick = () => {
    const m = model(),
      t = transferModel(m),
      c = m.c,
      raw = $("answer-5").value.trim().replace(",", "."),
      number = Number(raw),
      numberOk =
        raw !== "" &&
        Number.isFinite(number) &&
        Math.abs(number - t.value) < 0.006,
      designOk = c.tanswer === t.correct,
      correct = numberOk && designOk;
    Causality.event({
      type: "exercise",
      unit: "interference-lab",
      id: "transfer",
      variant: 0,
      answer: JSON.stringify({ design: c.tanswer, value: raw }),
      correct,
      assisted: c.thint,
      transfer: true,
    });
    $("feedback-5").textContent = correct
      ? `Correct: ${TRANSFER.options[t.correct].label.toLowerCase()}, and the contrast is ${fmt(t.value)}.` +
        (c.thint
          ? " This attempt used the hint, so it counts as assisted; reset the laboratory and try again independently."
          : " Recorded as an independent transfer.")
      : `${designOk ? "The design choice is right." : c.tanswer < 0 ? "Choose which designs support the contrast." : "Check the support tables: which designs give unit 5 both g = 0 and g = 2/3 with own = 0?"} ${numberOk ? "The value is right." : "The value is not yet right: the contrast is γ times the change in exposure; the baseline cancels."}`;
  };
  const JUSTIFY = "causality.interference-lab.justification";
  try {
    $("justify-5").value = localStorage.getItem(JUSTIFY) || "";
  } catch {}
  $("justify-5").oninput = () => {
    try {
      localStorage.setItem(JUSTIFY, $("justify-5").value);
    } catch {}
  };

  state.subscribe(render);
  render();
  syncMode();
  guided(root, state);
  tools(root, state);
})();
