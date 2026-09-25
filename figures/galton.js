/* Galton board of repeated studies.
 * Each simulated study is a ball. It falls from the estimator's centre, and its horizontal
 * drift is the running sum of that study's influence-function contributions, one small
 * arrow ϕ(Oᵢ)/n per patient, so the ball lands at centre + Pₙϕ. A final nudge (the
 * remainder) moves it to the actual estimate. Balls pile up into the sampling distribution,
 * outlined by N(centre, Var(ϕ)/n). Each ball carries its 95% interval: covers the truth or
 * misses it (red), with a running "k of N cover" counter.
 *
 * Study: science/core.js generate() (binary severity X, confounded A, ATE = 2).
 *   AIPW: estimate(rows, {preset:"both"}) with fitted, correctly specified nuisances; SE from φ̂.
 *   Plug-in: the outcome model [1, A] (estimate(..., {preset:"propensity"}).plugin), which is
 *   the treated-minus-control difference; SE is the usual two-sample (Welch) SE.
 * The arrows use the TRUE influence functions, computable here only because the law is known.
 * The pure part is exported for node tests; the figure registers as "galton" in the browser. */
(function (root) {
  "use strict";
  const isNode = typeof module === "object" && module.exports;
  const S = isNode ? require("../science/core.js") : root.CausalScience;

  const TRUTH = 2,
    Z = 1.959963984540054;

  /* Exact large-sample limits from the known law. */
  function limits() {
    const p = S.prevalence,
      g = S.trueG,
      m = S.trueM,
      pi = (1 - p) * g(0) + p * g(1),
      w1 = [((1 - p) * g(0)) / pi, (p * g(1)) / pi],
      w0 = [((1 - p) * (1 - g(0))) / (1 - pi), (p * (1 - g(1))) / (1 - pi)],
      mu1 = w1[0] * m(0, 1) + w1[1] * m(1, 1),
      mu0 = w0[0] * m(0, 0) + w0[1] * m(1, 0),
      v1 = 0.64 + w1[0] * (m(0, 1) - mu1) ** 2 + w1[1] * (m(1, 1) - mu1) ** 2,
      v0 = 0.64 + w0[0] * (m(0, 0) - mu0) ** 2 + w0[1] * (m(1, 0) - mu0) ** 2;
    return {
      psi: TRUTH,
      veff: S.efficiencyVariance(),
      pi,
      mu1,
      mu0,
      psiNaive: mu1 - mu0,
      vNaive: v1 / pi + v0 / (1 - pi),
    };
  }
  const LIM = limits();

  /* True influence functions (mean zero under the law). */
  function phiAIPW(r) {
    const g = S.trueG(r.x),
      m1 = S.trueM(r.x, 1),
      m0 = S.trueM(r.x, 0);
    return m1 - m0 + (r.a / g) * (r.y - m1) - ((1 - r.a) / (1 - g)) * (r.y - m0) - TRUTH;
  }
  function phiNaive(r) {
    return (r.a * (r.y - LIM.mu1)) / LIM.pi - ((1 - r.a) * (r.y - LIM.mu0)) / (1 - LIM.pi);
  }
  function welchSE(rows) {
    const arm = (a) => rows.filter((r) => r.a === a).map((r) => r.y),
      y1 = arm(1),
      y0 = arm(0);
    if (y1.length < 2 || y0.length < 2) return NaN;
    return Math.sqrt(S.variance(y1) / y1.length + S.variance(y0) / y0.length);
  }
  const covers = (est, se, psi = TRUTH) => Math.abs(est - psi) <= Z * se + 1e-12;

  /* Checkpoints of the running sum Σ_{i≤k} ϕᵢ / n at k = round(j n / K), j = 0..K. */
  function checkpoints(phi, K) {
    const n = phi.length,
      out = [0];
    let s = 0,
      i = 0;
    for (let j = 1; j <= K; j++) {
      const k = Math.round((j * n) / K);
      for (; i < k; i++) s += phi[i];
      out.push(s / n);
    }
    return out;
  }

  function oneStudy(rows, K, keep) {
    const fitA = S.estimate(rows, { preset: "both", mode: "fitted" }),
      fitP = S.estimate(rows, { preset: "propensity", mode: "fitted" }),
      phA = rows.map(phiAIPW),
      phP = rows.map(phiNaive);
    return {
      aipw: fitA.aipw,
      seA: fitA.se,
      plugin: fitP.plugin,
      seP: welchSE(rows),
      linA: TRUTH + S.mean(phA),
      linP: LIM.psiNaive + S.mean(phP),
      pathA: checkpoints(phA, K),
      pathP: checkpoints(phP, K),
      phiA: keep ? phA : null,
      phiP: keep ? phP : null,
    };
  }

  /* reps seeded studies of size n. The first `keep` keep their full ϕ vectors (the arrows). */
  function simulate({ n = 100, reps = 200, seed = 20260925, keep = 3, K = 16 } = {}) {
    const random = S.rng(seed + n),
      studies = [];
    for (let j = 0; j < reps; j++) studies.push(oneStudy(S.generate(n, random), K, j < keep));
    return {
      n,
      reps,
      seed,
      K,
      studies,
      sdA: Math.sqrt(LIM.veff / n),
      sdP: Math.sqrt(LIM.vNaive / n),
    };
  }

  /* Summary of the first `upto` studies for one estimator key ("A" or "P"). */
  function summary(sim, key, upto = sim.studies.length) {
    const list = sim.studies.slice(0, upto),
      est = list.map((s) => (key === "A" ? s.aipw : s.plugin)),
      se = list.map((s) => (key === "A" ? s.seA : s.seP)),
      k = est.filter((e, i) => covers(e, se[i])).length,
      rem = list.map((s, i) => est[i] - (key === "A" ? s.linA : s.linP));
    return {
      remRMS: list.length ? Math.sqrt(S.mean(rem.map((r) => r * r))) : NaN,
      count: list.length,
      mean: list.length ? S.mean(est) : NaN,
      sd: list.length > 1 ? Math.sqrt(S.variance(est)) : NaN,
      meanSE: list.length ? S.mean(se) : NaN,
      covered: k,
      coverage: list.length ? k / list.length : NaN,
    };
  }

  /* Pile layout: bin index and stacking level of each value, in arrival order. */
  function stack(values, lo, binw) {
    const levels = new Map();
    return values.map((v) => {
      const bin = Math.floor((v - lo) / binw),
        level = levels.get(bin) || 0;
      levels.set(bin, level + 1);
      return { bin, level };
    });
  }

  /* Timeline (ms). The first `arrows` studies walk slowly, one at a time; the rest rain. */
  const SPEEDS = {
    slow: { rate: 3, fall: 1500, arrow: 1.35 },
    normal: { rate: 8, fall: 1000, arrow: 1 },
    fast: { rate: 24, fall: 650, arrow: 0.7 },
  };
  const ARROW_MS = [4600, 3000, 2200];
  function schedule(reps, arrows = 3, speed = "normal") {
    const sp = SPEEDS[speed] || SPEEDS.normal,
      launch = [],
      dur = [];
    let t = 0;
    for (let j = 0; j < Math.min(arrows, reps); j++) {
      const d = (ARROW_MS[j] || 2200) * sp.arrow;
      launch.push(t);
      dur.push(d);
      t += d + 350;
    }
    for (let j = launch.length; j < reps; j++) {
      launch.push(t);
      dur.push(sp.fall);
      t += 1000 / sp.rate;
    }
    const land = launch.map((l, j) => l + dur[j]),
      total = reps ? land[reps - 1] + 400 : 0;
    return { launch, dur, land, total, arrows: Math.min(arrows, reps) };
  }
  /* Number of balls landed by time τ (land times are increasing). */
  function landedBy(sched, tau) {
    let lo = 0,
      hi = sched.land.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (sched.land[m] <= tau) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  const api = {
    TRUTH,
    Z,
    limits,
    LIM,
    phiAIPW,
    phiNaive,
    welchSE,
    covers,
    checkpoints,
    oneStudy,
    simulate,
    summary,
    stack,
    SPEEDS,
    schedule,
    landedBy,
  };
  if (isNode) {
    module.exports = api;
    return;
  }
  root.CausalGalton = api;
  if (!root.CausalFigures) return;

  /* ------------------------------------------------------------------ figure */
  const A = root.CausalAnim;
  const { el, html } = A;
  const LO = 1.1,
    HI = 3.7,
    TICKS = [1.5, 2, 2.5, 3, 3.5],
    STRIP = 30,
    MILESTONES = [10, 50, 100, 200];

  function injectStyle() {
    if (document.getElementById("galton-style")) return;
    const s = document.createElement("style");
    s.id = "galton-style";
    s.textContent = `
.galton-boards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.galton-board{min-width:0;max-width:680px}
.galton-count.pulse{transform-origin:right center}
.galton-head{display:grid;grid-template-columns:1fr auto;column-gap:10px;align-items:baseline;margin:0 0 6px}
.galton-head small{grid-column:1/-1;font-size:13px;color:var(--muted);line-height:1.3}
.galton-title{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:17px;line-height:1.2}
.galton-count{font-family:"IBM Plex Mono",monospace;font-size:14px;color:var(--ink);display:inline-block;white-space:nowrap}
.galton-count b{font-size:20px;font-weight:500;font-variant-numeric:tabular-nums}
.galton-stage{position:relative;width:100%;background:var(--paper);border:1px solid var(--rule);border-radius:8px;overflow:hidden}
.galton-stage svg{position:absolute;left:0;top:0;display:block}
.galton-stage text{font-family:"IBM Plex Mono",monospace;font-size:13px;paint-order:stroke;stroke:var(--paper);stroke-width:4px;stroke-linejoin:round}
.galton-stage .g-lab{font-family:"IBM Plex Sans",system-ui,sans-serif}
.galton-stage .g-axis{font-family:"Fraunces",Georgia,serif;font-style:italic;font-size:14px;fill:var(--ink)}
.galton-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 16px;margin-top:10px;align-items:end}
.galton-ctl label{display:flex;flex-direction:column;gap:4px;font-size:13.5px;margin:0}
.galton-ctl select{font:inherit;font-size:15px;min-height:40px}
.galton-ctl label.galton-check{flex-direction:row;align-items:center;gap:10px;min-height:44px;cursor:pointer}
.galton-check input{width:22px;height:22px;flex:none;margin:0}
.galton-play{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}
.galton-play button{min-height:40px;min-width:64px}
.galton-play label{display:flex;align-items:center;gap:8px;flex:1;min-width:200px;font-size:13px;color:var(--muted);margin:0}
.galton-play label input{flex:1}
.galton-play .v{font-family:"IBM Plex Mono",monospace;color:var(--ink);min-width:3ch}
.galton .fig-readout{grid-template-columns:auto auto auto;max-width:560px}
.galton .fig-readout .h{color:var(--ink);font-weight:500}
`;
    document.head.append(s);
  }

  CausalFigures.register("galton", (mount, ds) => {
    injectStyle();
    const reduced = A.reduced;
    const opt = {
      n: [50, 100, 200, 400, 800].includes(+ds.n) ? +ds.n : 100,
      boards: ["both", "aipw", "plugin"].includes(ds.boards) ? ds.boards : "both",
      arrows: ds.arrows === "0" ? false : true,
      speed: ["slow", "normal", "fast"].includes(ds.speed) ? ds.speed : "normal",
      reps: Math.max(20, Math.min(400, +ds.reps || 200)),
    };
    const uid = "galton-" + Math.random().toString(36).slice(2, 7);
    mount.classList.add("figure", "galton");

    const cache = new Map();
    const getSim = (n) => {
      if (!cache.has(n)) cache.set(n, simulate({ n, reps: opt.reps }));
      return cache.get(n);
    };

    /* ---- DOM ---- */
    const boardsEl = html("div", { class: "galton-boards" });
    const playRow = html("div", { class: "galton-play" });
    const playBtn = html("button", { type: "button", class: "primary" }, "Play");
    const againBtn = html("button", { type: "button" }, "Run again");
    const scrubId = uid + "-scrub";
    const scrubLab = html("label", { for: scrubId }, "Studies landed ");
    const scrubVal = html("span", { class: "v" }, "0");
    const scrub = html("input", { type: "range", id: scrubId, min: 0, max: 1, step: 0.001, value: 0 });
    scrubLab.append(scrubVal, scrub);
    playRow.append(playBtn, againBtn, scrubLab);

    const ctl = html("div", { class: "galton-ctl" });
    const mkSelect = (id, label, options, value) => {
      const lab = html("label", { for: id }, label);
      const s = html("select", { id });
      options.forEach(([v, t]) => {
        const o = html("option", { value: v }, t);
        if (String(v) === String(value)) o.selected = true;
        s.append(o);
      });
      lab.append(s);
      ctl.append(lab);
      return s;
    };
    const nSel = mkSelect(
      uid + "-n",
      "Patients per study, n",
      [50, 100, 200, 400, 800].map((v) => [v, String(v)]),
      opt.n,
    );
    const speedSel = mkSelect(
      uid + "-speed",
      "Speed",
      [
        ["slow", "Slow"],
        ["normal", "Normal"],
        ["fast", "Fast"],
      ],
      opt.speed,
    );
    const boardSel = mkSelect(
      uid + "-boards",
      "Estimators",
      [
        ["both", "AIPW and plug-in, side by side"],
        ["aipw", "AIPW only"],
        ["plugin", "Plug-in only"],
      ],
      opt.boards,
    );
    const arrowBox = html("input", { type: "checkbox", id: uid + "-arrows" });
    arrowBox.checked = opt.arrows;
    const arrowLab = html("label", { for: uid + "-arrows", class: "galton-check" });
    arrowLab.append(arrowBox, html("span", {}, "Draw the arrows for the first 3 studies"));
    ctl.append(arrowLab);

    const caption = html("p", { class: "fig-caption", "aria-live": "off" });
    const readout = html("div", { class: "fig-readout", role: "status" });
    mount.append(boardsEl, playRow, ctl, caption, readout);

    /* ---- state ---- */
    let sim = null,
      sched = null,
      boards = [],
      tau = 0,
      raf = null,
      last = 0,
      autoplay = "pending",
      lastLanded = -1,
      lastCaption = "";


    const KIND = {
      A: {
        title: "AIPW",
        sub: "both nuisance models fitted; SE = sd(φ̂)/√n",
        color: "--purple",
        est: (s) => s.aipw,
        se: (s) => s.seA,
        lin: (s) => s.linA,
        path: (s) => s.pathA,
        phi: (s) => s.phiA,
        centre: () => LIM.psi,
        sd: () => sim.sdA,
        varphi: () => LIM.veff,
      },
      P: {
        title: "Plug-in",
        sub: "outcome model [1, A], i.e. treated minus control; two-sample SE",
        color: "--or",
        est: (s) => s.plugin,
        se: (s) => s.seP,
        lin: (s) => s.linP,
        path: (s) => s.pathP,
        phi: (s) => s.phiP,
        centre: () => LIM.psiNaive,
        sd: () => sim.sdP,
        varphi: () => LIM.vNaive,
      },
    };

    function buildBoards() {
      boardsEl.replaceChildren();
      const keys = boardSel.value === "aipw" ? ["A"] : boardSel.value === "plugin" ? ["P"] : ["A", "P"];
      boards = keys.map((key) => {
        const K = KIND[key];
        const wrap = html("div", { class: "galton-board" });
        const head = html("div", { class: "galton-head" });
        const title = html("div", { class: "galton-title", style: `color:var(${K.color})` }, K.title);
        const count = html("span", { class: "galton-count" });
        head.append(title, count, html("small", {}, K.sub));
        const stage = html("div", {
          class: "galton-stage",
          role: "img",
          "aria-label": `${K.title} Galton board: each ball is one simulated study of n patients. It falls from ${key === "A" ? "the truth, 2" : "the plug-in's centre, " + LIM.psiNaive.toFixed(2)}, drifts by the average of its patients' influence-function values, and lands at its estimate. Landed balls pile into the sampling distribution under the curve N(centre, Var(ϕ)/n). Each ball's 95% interval either covers the true ATE of 2 or misses it (red). Counts are in the readout.`,
        });
        const svg = el("svg", { "aria-hidden": "true" });
        const g = (cls) => el("g", { class: cls });
        const bg = g("g-bg"),
          trail = g("g-trail"),
          pile = g("g-pile"),
          flashes = g("g-flash"),
          strip = g("g-strip"),
          balls = g("g-balls"),
          fg = g("g-fg");
        svg.append(bg, trail, pile, flashes, strip, balls, fg);
        const col = `var(${K.color})`;
        const trailPath = el("path", { fill: "none", stroke: col, "stroke-linejoin": "round" }),
          headPath = el("path", { fill: col, stroke: col, "stroke-width": 2.4, "stroke-linecap": "round" }),
          linDot = el("circle", { r: 2.8, fill: col });
        trail.append(trailPath, headPath, linDot);
        for (let i = 0; i < STRIP; i++) strip.append(el("line", { "stroke-width": 2, visibility: "hidden" }));
        for (let i = 0; i < 40; i++)
          flashes.append(el("path", { fill: "none", "stroke-width": 2.5, visibility: "hidden" }));
        for (let i = 0; i < 40; i++)
          balls.append(el("circle", { fill: col, stroke: "var(--paper)", "stroke-width": 1.2, visibility: "hidden" }));
        stage.append(svg);
        wrap.append(head, stage);
        boardsEl.append(wrap);
        return {
          key, K, col, wrap, count, stage, svg, bg, fg, trailPath, headPath, linDot, pile, flashes, strip, balls,
          lay: null, cells: null, milestone: 0, stripN: -1,
        };
      });
    }

    /* Layout at the container's real width. SVG units are CSS pixels. */
    function layout() {
      const binw = sim.sdA / 2.2;
      const phone = boardsEl.clientWidth < 520;
      boards.forEach((b) => {
        const w = Math.max(260, b.stage.clientWidth || 300),
          top = 30,
          Hf = phone ? 130 : 150,
          Hp = phone ? 104 : 116,
          yF = top + Hf,
          yB = yF + Hp,
          stripTop = yB + 62,
          rowH = 3.4,
          h = stripTop + STRIP * rowH + 10,
          l = 12,
          r = 12,
          sx = (v) => l + ((v - LO) / (HI - LO)) * (w - l - r),
          binPx = sx(LO + binw) - sx(LO);
        // expected final heap: reps · binw · pdf, the tallest over the boards shown
        const peak = Math.max(...boards.map((q) => (opt.reps * binw * 0.398942) / q.K.sd()));
        const dh = Math.min(binPx, (Hp * 0.86) / peak);
        b.lay = { w, h, top, Hf, Hp, yF, yB, stripTop, rowH, l, r, sx, binw, binPx, dh };
        b.stage.style.height = h + "px";
        b.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        b.svg.setAttribute("width", w);
        b.svg.setAttribute("height", h);
        b.pile.replaceChildren();
        b.stripN = -1;
        const vals = sim.studies.map((s) => b.K.est(s));
        b.cells = stack(vals, LO, binw);
        drawStatic(b);
      });
    }

    function drawStatic(b) {
      const { w, top, yF, yB, stripTop, rowH, sx, binw, dh } = b.lay,
        K = b.K,
        c = K.centre(),
        sd = K.sd();
      // background: pegs, axis, ticks
      const bg = [];
      const gap = 15;
      for (let row = 0, y = top + 8; y < yF - 4; row++, y += gap * 0.8)
        for (let x = (row % 2 ? gap / 2 : 0) + 6; x < w - 4; x += gap)
          bg.push(el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.3, fill: "var(--grid)" }));
      bg.push(el("line", { x1: 0, x2: w, y1: yB, y2: yB, stroke: "var(--muted)", "stroke-width": 1.2 }));
      TICKS.forEach((v) => {
        bg.push(
          el("line", { x1: sx(v), x2: sx(v), y1: yB, y2: yB + 5, stroke: "var(--muted)" }),
          el("text", { x: sx(v), y: yB + 19, "text-anchor": "middle", fill: "var(--muted)" }, v.toFixed(1)),
        );
      });
      bg.push(
        el("text", { class: "g-axis", x: w / 2, y: yB + 38, "text-anchor": "middle" }, "estimate of the ATE, one per study"),
        el(
          "text",
          { class: "g-lab", x: 12, y: stripTop - 8, fill: "var(--muted)" },
          `latest ${STRIP} intervals, newest on top`,
        ),
        el("text", { class: "g-lab", x: w - 10, y: top + 12, "text-anchor": "end", fill: "var(--muted)" }, "patient 1"),
        el("text", { class: "g-lab", x: w - 10, y: yF - 6, "text-anchor": "end", fill: "var(--muted)" }, `patient ${sim.n}`),
      );
      const texts = bg.filter((e) => e.tagName === "text");
      b.bg.replaceChildren(...bg.filter((e) => e.tagName !== "text"));
      // foreground: truth, centre, normal outline
      const fg = [];
      const tx = sx(TRUTH);
      fg.push(
        // broken around the tick labels and the strip heading so no text sits on the line
        ...[
          [20, yB],
          [stripTop, stripTop + STRIP * rowH],
        ].map(([y1, y2]) =>
          el("line", { x1: tx, x2: tx, y1, y2, stroke: "var(--green)", "stroke-width": 1.6, "stroke-dasharray": "5 4" }),
        ),
        el("text", { x: tx - 5, y: 15, "text-anchor": "end", fill: "var(--green)" }, "truth 2"),
      );
      if (b.key === "P") {
        const cx = sx(c);
        fg.push(
          el("line", { x1: cx, x2: cx, y1: 20, y2: yB, stroke: "var(--or)", "stroke-width": 1.2, "stroke-dasharray": "2 3" }),
          el("text", { x: cx + 5, y: 15, fill: "var(--or)" }, `centre ${c.toFixed(2)}`),
        );
      }
      const pts = [];
      for (let k = 0; k <= 160; k++) {
        const v = LO + ((HI - LO) * k) / 160,
          pdf = S.normal(v, c, sd),
          y = yB - opt.reps * binw * pdf * dh;
        pts.push(`${k ? "L" : "M"}${sx(v).toFixed(1)},${Math.max(top, y).toFixed(1)}`);
      }
      fg.push(
        el("path", {
          d: pts.join(" "),
          fill: "none",
          stroke: `var(${K.color})`,
          "stroke-width": 1.6,
          "stroke-opacity": 0.9,
        }),
      );
      fg.push(
        el(
          "text",
          { class: "g-lab", x: w - 10, y: yF + 16, "text-anchor": "end", fill: `var(${K.color})` },
          "curve: N(centre, Var ϕ / n)",
        ),
      );
      b.fg.replaceChildren(...fg, ...texts);
    }

    /* ---- per-frame drawing ---- */
    const easeIn = (u) => u * u;
    function ballPos(b, j, u) {
      // u in [0,1] of the ball's own flight. Returns {x, y, phase, k}.
      const s = sim.studies[j],
        K = b.K,
        L = b.lay,
        c = K.centre(),
        est = K.est(s),
        cell = b.cells[j],
        yCell = L.yB - (cell.level + 0.5) * L.dh,
        xCell = L.sx(LO + (cell.bin + 0.5) * L.binw),
        xEst = L.sx(clamp(est)),
        arrow = j < sched.arrows && K.phi(s);
      if (arrow) {
        const phi = K.phi(s),
          n = phi.length;
        if (u < 0.72) {
          const f = u / 0.72,
            kf = f * n,
            k = Math.floor(kf);
          let sum = 0;
          for (let i = 0; i < k; i++) sum += phi[i];
          const frac = kf - k,
            x = c + (sum + (k < n ? phi[k] * frac : 0)) / n;
          return { x: L.sx(clamp(x)), y: L.top + (L.Hf * kf) / n, phase: "walk", k };
        }
        const xl = L.sx(clamp(K.lin(s)));
        if (u < 0.8) {
          const f = A.ease.inOut((u - 0.72) / 0.08);
          return { x: A.lerp(xl, xEst, f), y: L.yF, phase: "nudge" };
        }
        const f = easeIn((u - 0.8) / 0.2);
        return { x: A.lerp(xEst, xCell, f), y: A.lerp(L.yF, yCell, f), phase: "drop" };
      }
      const P = K.path(s),
        Kc = P.length - 1;
      if (u < 0.7) {
        const f = (u / 0.7) * Kc,
          k = Math.min(Kc - 1, Math.floor(f)),
          fr = f - k,
          x = c + A.lerp(P[k], P[k + 1], fr);
        return { x: L.sx(clamp(x)), y: L.top + (L.Hf * f) / Kc, phase: "walk" };
      }
      const f = easeIn((u - 0.7) / 0.3),
        xl = L.sx(clamp(c + P[Kc]));
      // the remainder nudge happens in the first part of the drop
      const xn = A.lerp(xl, xEst, Math.min(1, f * 3));
      return { x: A.lerp(xn, xCell, f), y: A.lerp(L.yF, yCell, f), phase: "drop" };
    }
    const clamp = (v) => Math.max(LO, Math.min(HI, v));

    const r1 = (v) => Math.round(v * 10) / 10;
    function drawBoard(b, landed) {
      const L = b.lay,
        K = b.K,
        col = b.col,
        red = "var(--red)";
      // arrow trail of the active (or most recent) arrow study
      let trailD = "",
        headD = "",
        alpha = 0,
        lin = null;
      for (let j = 0; j < sched.arrows; j++) {
        const t0 = sched.launch[j],
          t1 = sched.land[j],
          fadeEnd = (j + 1 < sched.launch.length ? sched.launch[j + 1] : t1 + 1200) + 600;
        if (tau < t0 || tau > fadeEnd) continue;
        const s = sim.studies[j],
          phi = K.phi(s);
        if (!phi) continue;
        const u = Math.min(1, (tau - t0) / (t1 - t0)),
          n = phi.length,
          kMax = Math.min(n, Math.floor((Math.min(u, 0.72) / 0.72) * n));
        alpha = tau > t1 ? Math.max(0, 1 - (tau - t1) / (fadeEnd - t1)) * 0.6 : 1;
        let sum = 0,
          x = L.sx(K.centre());
        const pts = [`M${r1(x)},${L.top}`];
        for (let i = 0; i < kMax; i++) {
          const y = r1(L.top + (L.Hf * (i + 1)) / n);
          pts.push(`V${y}`);
          sum += phi[i];
          x = L.sx(clamp(K.centre() + sum / n));
          pts.push(`H${r1(x)}`);
        }
        trailD = pts.join("");
        b.trailPath.setAttribute("stroke-width", n > 200 ? 1 : 1.4);
        if (u < 0.72 && kMax > 0) {
          const i = kMax - 1,
            y = r1(L.top + (L.Hf * (i + 1)) / n),
            x0 = L.sx(clamp(K.centre() + (sum - phi[i]) / n)),
            dir = Math.sign(x - x0) || 1,
            xe = x0 + dir * Math.max(Math.abs(x - x0), 6);
          headD = `M${r1(x0)},${y}H${r1(xe)}M${r1(xe + dir * 2)},${y}L${r1(xe - dir * 5)},${y - 4}L${r1(xe - dir * 5)},${y + 4}Z`;
        }
        if (u >= 0.72) lin = L.sx(clamp(K.lin(s)));
      }
      b.trailPath.setAttribute("d", trailD || "M0,0");
      b.trailPath.setAttribute("opacity", trailD ? alpha : 0);
      b.headPath.setAttribute("d", headD || "M0,0");
      b.headPath.setAttribute("opacity", headD ? alpha : 0);
      b.linDot.setAttribute("visibility", lin != null && alpha > 0 ? "visible" : "hidden");
      if (lin != null) {
        b.linDot.setAttribute("cx", r1(lin));
        b.linDot.setAttribute("cy", L.yF);
        b.linDot.setAttribute("opacity", alpha);
      }
      // landed pile: one element per study, in arrival order
      while (b.pile.childElementCount > landed) b.pile.lastChild.remove();
      const cw = Math.max(1.5, L.binPx - (L.binPx > 5 ? 1 : 0.3)),
        chh = Math.max(1, L.dh - (L.dh > 4 ? 0.8 : 0.25)),
        round = L.dh >= L.binPx - 0.5 && L.binPx >= 5;
      for (let j = b.pile.childElementCount; j < landed; j++) {
        const s = sim.studies[j],
          cell = b.cells[j],
          fill = covers(K.est(s), K.se(s)) ? col : red,
          x = L.sx(LO + cell.bin * L.binw),
          y = L.yB - (cell.level + 1) * L.dh,
          hide = x < L.l - 2 || x > L.w - L.r ? "hidden" : "visible";
        b.pile.append(
          round
            ? el("circle", { cx: r1(x + L.binPx / 2), cy: r1(y + L.dh / 2), r: r1(Math.min(cw, chh) / 2), fill, visibility: hide })
            : el("rect", { x: r1(x + (L.binPx - cw) / 2), y: r1(y + (L.dh - chh) / 2), width: r1(cw), height: r1(chh), fill, visibility: hide }),
        );
      }
      // strip of the latest intervals, newest on top
      if (b.stripN !== landed) {
        b.stripN = landed;
        [...b.strip.children].forEach((ln, r) => {
          const j = landed - 1 - r;
          if (j < 0) return ln.setAttribute("visibility", "hidden");
          const s = sim.studies[j],
            est = K.est(s),
            se = K.se(s),
            y = r1(L.stripTop + r * L.rowH + L.rowH / 2);
          ln.setAttribute("visibility", "visible");
          ln.setAttribute("x1", r1(L.sx(clamp(est - Z * se))));
          ln.setAttribute("x2", r1(L.sx(clamp(est + Z * se))));
          ln.setAttribute("y1", y);
          ln.setAttribute("y2", y);
          ln.setAttribute("stroke", covers(est, se) ? col : red);
        });
      }
      // landing flashes: each ball shows its 95% interval where it lands, then fades
      const fl = b.flashes.children;
      let f = 0;
      for (let j = Math.max(0, landed - fl.length); j < landed; j++) {
        const age = tau - sched.land[j];
        if (age < 0 || age > 1000) continue;
        const s = sim.studies[j],
          est = K.est(s),
          se = K.se(s),
          cell = b.cells[j],
          y = r1(L.yB - (cell.level + 0.5) * L.dh),
          x0 = r1(L.sx(clamp(est - Z * se))),
          x1 = r1(L.sx(clamp(est + Z * se))),
          p = fl[f++];
        p.setAttribute("d", `M${x0},${y}H${x1}M${x0},${y - 5}V${y + 5}M${x1},${y - 5}V${y + 5}`);
        p.setAttribute("stroke", covers(est, se) ? col : red);
        p.setAttribute("opacity", (1 - age / 1000).toFixed(2));
        p.setAttribute("visibility", "visible");
      }
      for (; f < fl.length; f++) fl[f].setAttribute("visibility", "hidden");
      // balls in flight
      const bl = b.balls.children,
        rad = L.w < 360 ? 4 : 4.6;
      let q = 0;
      for (let j = landed; j < sim.studies.length && q < bl.length; j++) {
        const t0 = sched.launch[j];
        if (t0 > tau) break;
        const pos = ballPos(b, j, (tau - t0) / sched.dur[j]),
          c = bl[q++];
        c.setAttribute("cx", r1(pos.x));
        c.setAttribute("cy", r1(pos.y));
        c.setAttribute("r", rad);
        c.setAttribute("visibility", "visible");
      }
      for (; q < bl.length; q++) bl[q].setAttribute("visibility", "hidden");
    }

    const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "n/a");
    const sgn = (x) => (x < 0 ? "−" : "+") + Math.abs(x).toFixed(3);

    function updateText(landed, fromUser) {
      boards.forEach((b) => {
        const sm = summary(sim, b.key, landed);
        b.count.innerHTML = `<b>${sm.covered}</b> of <b>${sm.count}</b> cover`;
        // pulse at milestones, only when crossing them by playing forward
        const m = MILESTONES.filter((v) => v <= landed).length;
        if (!fromUser && m > b.milestone) root.CausalMotion?.pulse?.(b.count);
        b.milestone = m;
      });
      const rows = [html("span", { class: "k" }, `n = ${sim.n}, studies landed ${landed} of ${sim.reps}`), html("span", { class: "h" }, "AIPW"), html("span", { class: "h" }, "Plug-in")];
      const sA = summary(sim, "A", landed),
        sP = summary(sim, "P", landed);
      const line = (k, a, p) => rows.push(html("span", { class: "k" }, k), html("span", {}, a), html("span", {}, p));
      line("centre (large n)", f3(LIM.psi), f3(LIM.psiNaive));
      line("mean of the pile", f3(sA.mean), f3(sP.mean));
      line("SD of the pile", f3(sA.sd), f3(sP.sd));
      line("√(Var ϕ / n)", f3(sim.sdA), f3(sim.sdP));
      line("average SE", f3(sA.meanSE), f3(sP.meanSE));
      line("remainder, RMS", f3(sA.remRMS), f3(sP.remRMS));
      line(
        "95% intervals covering 2",
        landed ? `${sA.covered}/${landed} (${Math.round(100 * sA.coverage)}%)` : "none yet",
        landed ? `${sP.covered}/${landed} (${Math.round(100 * sP.coverage)}%)` : "none yet",
      );
      readout.replaceChildren(...rows);
      scrubVal.textContent = String(landed);
      scrub.setAttribute("aria-valuetext", `${landed} of ${sim.reps} studies landed`);
      // caption
      const b = boards[0],
        K = b.K;
      let text;
      const j = sched.arrows ? Math.min(sched.arrows - 1, [...sched.launch].filter((t) => t <= tau).length - 1) : -1;
      if (j >= 0 && tau <= sched.land[sched.arrows - 1] + 300) {
        const s = sim.studies[j],
          phi = K.phi(s),
          n = phi.length,
          u = Math.min(1, (tau - sched.launch[j]) / sched.dur[j]);
        if (u < 0.72) {
          const k = Math.max(1, Math.min(n, Math.floor((u / 0.72) * n)));
          let sum = 0;
          for (let i = 0; i < k; i++) sum += phi[i];
          text = `Study ${j + 1}, ${K.title}: patient ${k} of ${n} adds the arrow ϕ(O${sub(k)})/n = ${sgn(phi[k - 1] / n)}. Running sum so far: ${sgn(sum / n)}. The ball's horizontal position is the centre plus that sum.`;
        } else {
          const est = K.est(s),
            lin = K.lin(s);
          text = `Study ${j + 1}: the ${n} arrows add up to Pₙϕ = ${sgn(lin - K.centre())}, so the linear term is ${f3(lin)}. The actual ${K.title} estimate is ${f3(est)}; the last small nudge, ${sgn(est - lin)}, is the remainder. The error is (almost exactly) an average.`;
        }
      } else if (landed === 0) text = "Press Play: each ball is one whole study of n patients.";
      else if (landed < sim.reps)
        text = `${landed} studies so far. The pile's SD is ${f3(summary(sim, b.key, landed).sd)}; the curve's is √(Var ϕ / n) = ${f3(K.sd())}. Change n and the pile tightens like 1/√n.`;
      else
        text = `All ${sim.reps} studies have landed. ${boards
          .map((q) => {
            const sm = summary(sim, q.key, landed);
            return `${q.K.title}: ${sm.covered} of ${sm.count} intervals cover the truth (${Math.round(100 * sm.coverage)}%)`;
          })
          .join("; ")}. ${boards.some((q) => q.key === "P") ? "The plug-in pile is centred at " + LIM.psiNaive.toFixed(2) + ", not 2: as n grows its intervals shrink around the wrong number and coverage falls." : "Coverage near 95% is what the SE promises."}`;
      if (text !== lastCaption) {
        caption.textContent = text;
        lastCaption = text;
      }
    }
    const SUBS = "₀₁₂₃₄₅₆₇₈₉";
    const sub = (k) => String(k).replace(/\d/g, (d) => SUBS[+d]);

    function render(fromUser = false) {
      if (!sim) return;
      const landed = landedBy(sched, tau);
      boards.forEach((b) => drawBoard(b, landed));
      if (landed !== lastLanded || sched.arrows) updateText(landed, fromUser);
      lastLanded = landed;
      scrub.value = sched.total ? tau / sched.total : 0;
    }

    function pause() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      playBtn.textContent = "Play";
    }
    function play() {
      if (raf) return pause();
      if (tau >= sched.total) {
        tau = 0;
        boards.forEach((b) => (b.milestone = 0));
      }
      if (reduced()) {
        tau = sched.total;
        return render(true);
      }
      playBtn.textContent = "Pause";
      last = performance.now();
      const tick = (now) => {
        tau = Math.min(sched.total, tau + Math.min(100, now - last));
        last = now;
        render(false);
        if (tau < sched.total) raf = requestAnimationFrame(tick);
        else pause();
      };
      raf = requestAnimationFrame(tick);
    }
    playBtn.onclick = () => {
      autoplay = "off";
      play();
    };
    againBtn.onclick = () => {
      autoplay = "off";
      pause();
      tau = 0;
      boards.forEach((b) => (b.milestone = 0));
      play();
    };
    scrub.addEventListener("input", () => {
      autoplay = "off";
      pause();
      tau = +scrub.value * sched.total;
      boards.forEach((b) => (b.milestone = MILESTONES.filter((v) => v <= landedBy(sched, tau)).length));
      render(true);
    });

    function rebuild(restart) {
      const was = !!raf;
      pause();
      sim = getSim(+nSel.value);
      sched = schedule(sim.reps, arrowBox.checked ? 3 : 0, speedSel.value);
      buildBoards();
      layout();
      lastLanded = -1;
      tau = restart ? 0 : Math.min(tau, sched.total);
      if (reduced()) tau = sched.total;
      render(true);
      if (restart && (was || autoplay === "off") && !reduced()) play();
    }
    [nSel, boardSel].forEach((s) =>
      s.addEventListener("change", () => {
        autoplay = "off";
        rebuild(true);
      }),
    );
    arrowBox.addEventListener("change", () => {
      autoplay = "off";
      rebuild(true);
    });
    speedSel.addEventListener("change", () => {
      // keep the same studies landed, re-timed
      const landed = landedBy(sched, tau),
        was = !!raf;
      pause();
      sched = schedule(sim.reps, arrowBox.checked ? 3 : 0, speedSel.value);
      tau = landed ? sched.land[landed - 1] : 0;
      render(true);
      if (was) play();
    });

    rebuild(false);
    // End state first under reduced motion; otherwise the first ball waits at the top.
    let rw = 0;
    new ResizeObserver(() => {
      const w = boardsEl.clientWidth;
      if (Math.abs(w - rw) < 1) return;
      rw = w;
      layout();
      render(true);
    }).observe(boardsEl);
    document.addEventListener("visibilitychange", () => document.hidden && pause());
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        (e) => {
          if (!e[0].isIntersecting) {
            if (raf) {
              pause();
              if (autoplay === "running") autoplay = "pending";
            }
          } else if (autoplay === "pending" && tau < sched.total && !raf) {
            autoplay = "running";
            play();
          }
        },
        { threshold: 0.3 },
      ).observe(boardsEl);
  });
})(typeof self !== "undefined" ? self : globalThis);
