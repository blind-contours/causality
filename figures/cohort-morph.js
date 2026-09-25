/* Meet your cohort: the course's 100 patients, one object that keeps transforming.
 * Waiting room → who got treated → their outcomes → compare within severity.
 * Every number is computed from CausalCohort by numbers() below (also tested in node).
 * Encoding: fill = severity (low --p, high --or); arm = position. Naive --or, adjusted --purple,
 * truth --green dashed. Tap or drag a patient to read their card; the pin survives every morph. */
(function (root) {
  const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

  /* Pure summary of a cohort: naive contrast, within-severity contrasts, standardization. */
  function numbers(cohort) {
    const ps = cohort.patients;
    const n = ps.length;
    const T = ps.filter((p) => p.a),
      C = ps.filter((p) => !p.a);
    const strata = [0, 1].map((x) => {
      const inX = ps.filter((p) => p.x === x);
      const t = inX.filter((p) => p.a),
        c = inX.filter((p) => !p.a);
      const m1 = mean(t.map((p) => p.y)),
        m0 = mean(c.map((p) => p.y));
      return {
        x,
        n: inX.length,
        nT: t.length,
        nC: c.length,
        weight: inX.length / n,
        pTreat: inX.length ? t.length / inX.length : NaN,
        m1,
        m0,
        diff: m1 - m0,
        trueEffect: mean(inX.map((p) => p.y1 - p.y0)),
      };
    });
    const standardized = strata.reduce((s, k) => s + k.weight * k.diff, 0);
    const sampleATE = mean(ps.map((p) => p.y1 - p.y0));
    const meanT = mean(T.map((p) => p.y)),
      meanC = mean(C.map((p) => p.y));
    return {
      n,
      nT: T.length,
      nC: C.length,
      highT: T.filter((p) => p.x).length,
      highC: C.filter((p) => p.x).length,
      meanT,
      meanC,
      naive: meanT - meanC,
      strata,
      standardized,
      trueStandardized: strata.reduce((s, k) => s + k.weight * k.trueEffect, 0),
      sampleATE,
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { numbers };
    return;
  }
  root.CohortMorph = { numbers };
  if (!root.CausalFigures || !root.CausalMotion || !root.CausalCohort) return;

  const { el, html, tween, ease, lerp } = root.CausalAnim;
  const M = root.CausalMotion;

  const CSS = `
.cm-fig svg.fig{touch-action:pan-y;cursor:default}
.cm-fig svg.fig:focus{outline:none}
.cm-fig svg.fig:focus-visible{outline:3px solid var(--p);outline-offset:3px}
.cm-fig .dots .dot{touch-action:none;cursor:grab}
.cm-fig .dots .dot.sev-0{fill:var(--p)}
.cm-fig .dots .dot.sev-1{fill:var(--or)}
.cm-fig .dots .dot.pinned{stroke:var(--ink);stroke-width:3}
.cm-fig .dots .dot.lifted{cursor:grabbing;filter:drop-shadow(0 3px 4px rgba(0,0,0,.3))}
.cm-fig .cm-phase{opacity:0;transition:opacity .35s ease}
.cm-fig .cm-phase.on{opacity:1}
.cm-fig .cm-t{font:13px "IBM Plex Sans",system-ui,sans-serif;fill:var(--muted)}
.cm-fig .cm-t.ink{fill:var(--ink);font-weight:500}
.cm-fig .cm-m{font:13px "IBM Plex Mono",monospace;fill:var(--muted)}
.cm-fig .cm-m.ink{fill:var(--ink)}
.cm-fig .cm-or{fill:var(--or)}.cm-fig .cm-pu{fill:var(--purple)}.cm-fig .cm-gr{fill:var(--green)}
.cm-fig .cm-room{fill:var(--soft);stroke:var(--rule);stroke-width:1}
.cm-fig .cm-grid{stroke:var(--grid);stroke-width:1}
.cm-fig .cm-axis{stroke:var(--muted);stroke-width:1.2}
.cm-fig .cm-mean{stroke:var(--ink);stroke-width:2.5;stroke-linecap:round}
.cm-fig .cm-br{fill:none;stroke-width:2.5;stroke-linecap:round}
.cm-fig .cm-br.or{stroke:var(--or)}.cm-fig .cm-br.pu{stroke:var(--purple)}
.cm-fig .cm-mark.or{fill:var(--or)}.cm-fig .cm-mark.pu{fill:var(--purple)}
.cm-fig .cm-mark.faded{opacity:.4}
.cm-fig .cm-truth{stroke:var(--green);stroke-width:3;stroke-dasharray:4 3}
.cm-fig .cm-gap{stroke:var(--muted);stroke-width:4;opacity:.45;stroke-linecap:round}
.cm-fig .cm-ghosts{transition:opacity .4s ease}
.cm-fig .cm-ghost{fill:none;stroke-width:1.5;opacity:.75}
.cm-fig .cm-ghost.sev-0{stroke:var(--p)}.cm-fig .cm-ghost.sev-1{stroke:var(--or)}
.cm-fig .cm-link{stroke:var(--muted);stroke-width:1;opacity:.28}
.cm-fig .cm-link.pinned{stroke:var(--ink);stroke-width:2;opacity:1}
.cm-fig .cm-ghost.pinned{stroke:var(--ink);stroke-width:2.5;opacity:1}
.cm-fig .cm-stages{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:6px;margin:10px 0 4px}
.cm-fig .cm-stages button{min-height:42px;font-size:14px;line-height:1.2;padding:6px 10px}
.cm-fig .cm-stages button[aria-pressed=true]{background:var(--ink);color:var(--paper);border-color:var(--ink)}
.cm-fig .cm-toggle{display:flex;align-items:center;gap:8px;font-size:14px;margin:6px 0;min-height:40px}
.cm-fig .cm-toggle input{width:20px;height:20px}
.cm-fig .cm-card{border:1px solid var(--rule);border-radius:10px;background:var(--soft);padding:10px 12px;font-size:14px;margin-top:8px}
.cm-fig .cm-card h3{font-size:15px;margin:0 0 6px}
.cm-fig .cm-card dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;font-family:"IBM Plex Mono",monospace;font-size:13px;font-variant-numeric:tabular-nums}
.cm-fig .cm-card dt{color:var(--muted)}.cm-fig .cm-card dd{margin:0;color:var(--ink)}
.cm-fig .cm-card .never{color:var(--muted);font-style:italic}
.cm-fig .cm-card button{margin-top:8px;min-height:36px}
.cm-fig .cm-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;color:var(--muted);margin-top:6px}
.cm-fig .cm-legend i{display:inline-block;width:11px;height:11px;border-radius:50%;margin-right:5px;vertical-align:-1px}
`;

  const STAGES = ["Waiting room", "Who got treated", "Their outcomes", "Compare within severity"];
  const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "undefined");
  const pct = (v) => Math.round(100 * v) + "%";

  root.CausalFigures.register("cohort-morph", (mount) => {
    const cohort = root.CausalCohort.cohort;
    const P = cohort.patients;
    const N = numbers(cohort);
    const byId = new Map(P.map((p) => [p.id, p]));
    const bySlot = P.slice().sort((a, b) => a.slot - b.slot);

    if (!document.getElementById("cm-style")) {
      document.head.append(html("style", { id: "cm-style" }, CSS));
    }
    mount.classList.add("figure", "cm-fig");
    const svg = el("svg", { class: "fig", role: "img", tabindex: "0" });
    const cap = html("p", { class: "fig-caption", "aria-live": "polite" });
    const read = html("div", { class: "fig-readout" });
    const card = html("div", { class: "cm-card" });
    const ghostBox = html("input", { type: "checkbox", id: "cm-ghosts" });
    const ghostLab = html("label", { class: "cm-toggle", for: "cm-ghosts" }, ghostBox, "Show what we never see");
    const legend = html("div", { class: "cm-legend", "aria-hidden": "true" });
    legend.innerHTML =
      '<span><i style="background:var(--p)"></i>low severity</span><span><i style="background:var(--or)"></i>high severity</span>';
    const stagesBar = html("div", { class: "cm-stages", role: "group", "aria-label": "Stages of the cohort figure" });
    const playBtn = html("button", { type: "button", class: "primary" }, "Play all");
    const stageBtns = STAGES.map((s, k) => {
      const b = html("button", { type: "button", "aria-pressed": "false" }, k + 1 + ". " + s);
      b.onclick = () => {
        stopAuto();
        go(k);
      };
      return b;
    });
    stagesBar.append(playBtn, ...stageBtns);
    const left = html("div", {}, svg, stagesBar);
    const side = html("div", {}, cap, legend, ghostLab, read, card);
    mount.append(html("div", { class: "fig-row" }, left, side));

    /* ---------- geometry at the real width ---------- */
    let W = 640,
      G = null;
    function geom() {
      const w = Math.round(svg.getBoundingClientRect().width) || mount.clientWidth || 640;
      W = Math.max(300, w);
      const phone = W < 520;
      const H = phone ? 520 : 500;
      const L = phone ? 44 : 52,
        R = phone ? 12 : 20;
      const T = 66,
        Yb = H - 130,
        yr = H - 52;
      const pw = W - L - R;
      const sy = (v) => Yb - ((v + 1) / 10) * (Yb - T); // outcome domain [-1, 9]
      const xr = (v) => L + ((v - 1.5) / 1.5) * pw; // effect ruler [1.5, 3]
      const sGrid = Math.min(W - 32, H - 90, 420);
      const grid = { x: (W - sGrid) / 2, y: Math.max(40, (H - sGrid) / 2 - 12), s: sGrid, cell: sGrid / 10 };
      const gap = phone ? 18 : 48;
      const bw = Math.min((W - 32 - gap) / 2, 300);
      const rcols = phone ? 5 : 6;
      const rc = Math.min(bw / rcols, (H - 150) / Math.ceil(60 / rcols));
      const roomW = rc * rcols;
      const rooms = [
        { x: W / 2 - gap / 2 - roomW, y: 66, w: roomW, cell: rc },
        { x: W / 2 + gap / 2, y: 66, w: roomW, cell: rc },
      ];
      const rs = phone ? 4 : 4.6;
      G = { W, H, L, R, T, Yb, yr, pw, sy, xr, grid, rooms, rcols, rs, phone,
        col2: [0.25, 0.75].map((f) => L + f * pw), cw2: 0.3 * pw,
        col4: [0.12, 0.38, 0.62, 0.88].map((f) => L + f * pw), cw4: 0.17 * pw };
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      swarmCache.clear();
      return G;
    }

    /* Deterministic beeswarm: x offsets so dots at similar outcomes do not overlap. */
    const swarmCache = new Map();
    function swarm(key, list, halfW, r) {
      if (swarmCache.has(key)) return swarmCache.get(key);
      const out = new Map(),
        placed = [],
        d = 2 * r + 1,
        step = r * 0.9;
      list
        .slice()
        .sort((a, b) => a.y - b.y || a.slot - b.slot)
        .forEach((p) => {
          const yy = G.sy(p.y);
          let best = 0;
          for (let k = 0; k < 60; k++) {
            const off = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * step;
            if (Math.abs(off) > halfW) break;
            const ok = placed.every((q) => {
              const dy = q.y - yy;
              return Math.abs(dy) >= d || Math.abs(q.x - off) >= Math.sqrt(d * d - dy * dy);
            });
            if (ok) {
              best = off;
              break;
            }
            best = off;
          }
          placed.push({ x: best, y: yy });
          out.set(p.id, best);
        });
      swarmCache.set(key, out);
      return out;
    }
    const col2 = (a) => G.col2[a];
    const col4 = (x, a) => G.col4[2 * x + a];
    function offset2(p) {
      return swarm("s2-" + p.a, P.filter((q) => q.a === p.a), G.cw2 / 2, G.rs).get(p.id);
    }
    function offset4(p) {
      return swarm("s4-" + p.x + p.a, P.filter((q) => q.a === p.a && q.x === p.x), G.cw4 / 2, G.rs).get(p.id);
    }

    /* Rank inside a treatment room: high severity first, then by seat. */
    const roomRank = new Map();
    [0, 1].forEach((a) =>
      P.filter((p) => p.a === a)
        .sort((p, q) => q.x - p.x || p.slot - q.slot)
        .forEach((p, k) => roomRank.set(p.id, k)),
    );

    const layouts = [
      (p) => {
        const g = G.grid;
        return {
          x: g.x + g.cell * ((p.slot % 10) + 0.5),
          y: g.y + g.cell * (Math.floor(p.slot / 10) + 0.5),
          r: Math.min(12, g.cell * 0.34),
        };
      },
      (p) => {
        const b = G.rooms[p.a],
          k = roomRank.get(p.id);
        const c = G.rcols;
        return { x: b.x + b.cell * ((k % c) + 0.5), y: b.y + b.cell * (Math.floor(k / c) + 0.5), r: Math.min(10, b.cell * 0.34) };
      },
      (p) => ({ x: col2(p.a) + offset2(p), y: G.sy(p.y), r: G.rs }),
      (p) => ({ x: col4(p.x, p.a) + offset4(p), y: G.sy(p.y), r: G.rs }),
    ];
    const ghostAt = [
      null,
      null,
      (p) => ({ x: col2(1 - p.a) + offset2(p), y: G.sy(p.a ? p.y0 : p.y1) }),
      (p) => ({ x: col4(p.x, 1 - p.a) + offset4(p), y: G.sy(p.a ? p.y0 : p.y1) }),
    ];

    /* ---------- layers ---------- */
    const under = el("g");
    const ghostLayer = el("g", { class: "cm-ghosts", "aria-hidden": "true" });
    svg.append(under, ghostLayer);
    const dots = M.Dots(svg, P, { r: 8 });
    const over = el("g");
    svg.append(over);
    dots.style((p) => ({ class: "dot sev-" + p.x }));
    dots.nodes.forEach((c, id) => c.setAttribute("aria-hidden", "true"));

    geom();
    let stage = 0;
    dots.place(layouts[0]);

    /* ---------- overlays, built in phases: axes → data → estimate → truth → gap ---------- */
    function T(x, y, s, cls = "cm-t", attrs = {}, parent) {
      const t = el("text", { x, y, class: cls, ...attrs }, s);
      parent.append(t);
      return t;
    }
    function clampText(t, x) {
      const w = t.getComputedTextLength ? t.getComputedTextLength() : 0;
      const lo = 4 + w / 2,
        hi = G.W - 4 - w / 2;
      t.setAttribute("x", Math.max(lo, Math.min(hi, x)));
      t.setAttribute("text-anchor", "middle");
    }
    function phase(parent) {
      const g = el("g", { class: "cm-phase" });
      parent.append(g);
      return g;
    }
    function yAxis(g) {
      [0, 2, 4, 6, 8].forEach((v) => {
        g.append(el("line", { class: "cm-grid", x1: G.L, x2: G.W - G.R, y1: G.sy(v), y2: G.sy(v) }));
        T(G.L - 6, G.sy(v) + 4, String(v), "cm-m", { "text-anchor": "end" }, g);
      });
      T(14, (G.T + G.Yb) / 2, "outcome Y", "cm-t", { transform: `rotate(-90 14 ${(G.T + G.Yb) / 2})`, "text-anchor": "middle" }, g);
      T(G.L - 6, 56, "mean", "cm-t", { "text-anchor": "end" }, g);
    }
    function ruler(g) {
      const y = G.yr;
      g.append(el("line", { class: "cm-axis", x1: G.xr(1.5), x2: G.xr(3), y1: y, y2: y }));
      T(G.xr(1.5), y - 30, "effect estimate", "cm-t", {}, g);
      [1.5, 2, 2.5, 3].forEach((v) => {
        g.append(el("line", { class: "cm-axis", x1: G.xr(v), x2: G.xr(v), y1: y, y2: y + 5 }));
        if (Math.abs(v - N.sampleATE) < 0.12) return; // the truth label names this value
        const t = T(G.xr(v), y + 19, String(v), "cm-m", { "text-anchor": "middle" }, g);
        if (v === 1.5 || v === 3) clampText(t, G.xr(v));
      });
    }
    function marker(g, v, cls, label, row) {
      const c = el("circle", { class: "cm-mark " + cls, cx: G.xr(v), cy: G.yr, r: 6.5 });
      g.append(c);
      const t = T(G.xr(v), G.yr - row, label, "cm-m " + (cls === "or" ? "cm-or" : "cm-pu"), {}, g);
      clampText(t, G.xr(v));
      return { c, t };
    }
    function truth(g) {
      g.append(el("line", { class: "cm-truth", x1: G.xr(N.sampleATE), x2: G.xr(N.sampleATE), y1: G.yr - 9, y2: G.yr + 11 }));
      const t = T(G.xr(N.sampleATE), G.yr + 28, "truth " + f2(N.sampleATE), "cm-m cm-gr", {}, g);
      clampText(t, G.xr(N.sampleATE));
    }
    function gap(g, v) {
      g.append(el("line", { class: "cm-gap", x1: G.xr(N.sampleATE), x2: G.xr(v), y1: G.yr, y2: G.yr }));
    }
    function bracket(g, x, y1, y2, cls) {
      const k = 5;
      g.append(el("path", { class: "cm-br " + cls, d: `M${x - k},${y1}H${x}V${y2}H${x - k}` }));
    }

    function buildOverlay(k) {
      under.replaceChildren();
      over.replaceChildren();
      const phases = [];
      if (k === 0) {
        const a = phase(under);
        T(G.W / 2, G.grid.y - 16, G.phone ? `Waiting room: ${N.n} patients` : `The waiting room: ${N.n} patients, fill shows severity`, "cm-t ink", { "text-anchor": "middle" }, a);
        const b = phase(under);
        T(G.W / 2, G.grid.y + G.grid.s + 26, `${N.n - N.strata[1].n} low severity, ${N.strata[1].n} high severity`, "cm-t", { "text-anchor": "middle" }, b);
        phases.push([a, b]);
      } else if (k === 1) {
        const a = phase(under);
        ["Control", "Treated"].forEach((s, arm) => {
          const b = G.rooms[arm],
            n = arm ? N.nT : N.nC,
            hi = arm ? N.highT : N.highC,
            rows = Math.ceil(n / G.rcols);
          a.append(el("rect", { class: "cm-room", x: b.x - 6, y: b.y - 6, width: b.w + 12, height: rows * b.cell + 12, rx: 10 }));
          T(b.x + b.w / 2, 24, `${s} · ${n}`, "cm-t ink", { "text-anchor": "middle" }, a);
          T(b.x + b.w / 2, 44, `${hi} high (${pct(hi / n)})`, "cm-t", { "text-anchor": "middle" }, a);
        });
        const b = phase(under);
        const yMean = G.rooms[0].y + Math.ceil(Math.max(N.nT, N.nC) / G.rcols) * G.rooms[0].cell + 34;
        [N.meanC, N.meanT].forEach((m, arm) => {
          const r = G.rooms[arm];
          T(r.x + r.w / 2, yMean, "mean Y " + f2(m), "cm-m ink", { "text-anchor": "middle" }, b);
        });
        const c = phase(under);
        T(G.W / 2, yMean + 26, `naive gap ${f2(N.meanT)} − ${f2(N.meanC)} = ${f2(N.naive)}`, "cm-m cm-or", { "text-anchor": "middle" }, c);
        phases.push([a], [b], [c]);
      } else if (k === 2) {
        const a = phase(under);
        yAxis(a);
        ["Control", "Treated"].forEach((s, arm) => {
          T(G.col2[arm], 20, `${s} · ${arm ? N.nT : N.nC}`, "cm-t ink", { "text-anchor": "middle" }, a);
        });
        ruler(a);
        const m = phase(over);
        [N.meanC, N.meanT].forEach((v, arm) => {
          m.append(el("line", { class: "cm-mean", x1: G.col2[arm] - G.cw2 / 2, x2: G.col2[arm] + G.cw2 / 2, y1: G.sy(v), y2: G.sy(v) }));
          T(G.col2[arm], 56, f2(v), "cm-m ink", { "text-anchor": "middle" }, m);
        });
        const e = phase(over);
        const bx = G.L + 0.5 * G.pw;
        e.append(el("line", { class: "cm-br or", x1: G.col2[0] + G.cw2 / 2, x2: bx, y1: G.sy(N.meanC), y2: G.sy(N.meanC), "stroke-dasharray": "2 4" }));
        e.append(el("line", { class: "cm-br or", x1: bx, x2: G.col2[1] - G.cw2 / 2, y1: G.sy(N.meanT), y2: G.sy(N.meanT), "stroke-dasharray": "2 4" }));
        e.append(el("path", { class: "cm-br or", d: `M${bx},${G.sy(N.meanC)}V${G.sy(N.meanT)}` }));
        T(bx, G.Yb + 22, "naive gap " + f2(N.naive), "cm-m cm-or", { "text-anchor": "middle" }, e);
        marker(e, N.naive, "or", "naive " + f2(N.naive), 30);
        const t = phase(over);
        truth(t);
        const gp = phase(over);
        gap(gp, N.naive);
        phases.push([a], [m], [e], [t], [gp]);
      } else if (k === 3) {
        const a = phase(under);
        yAxis(a);
        ["Low severity", "High severity"].forEach((s, x) =>
          T((G.col4[2 * x] + G.col4[2 * x + 1]) / 2, 18, `${s} · ${N.strata[x].n}`, "cm-t ink", { "text-anchor": "middle" }, a),
        );
        G.col4.forEach((cx, j) => T(cx, 37, j % 2 ? "treated" : "control", "cm-t", { "text-anchor": "middle" }, a));
        ruler(a);
        const m = phase(over);
        N.strata.forEach((s, x) =>
          [s.m0, s.m1].forEach((v, arm) => {
            const cx = col4(x, arm);
            m.append(el("line", { class: "cm-mean", x1: cx - G.cw4 / 2, x2: cx + G.cw4 / 2, y1: G.sy(v), y2: G.sy(v) }));
            T(cx, 56, f2(v), "cm-m ink", { "text-anchor": "middle" }, m);
          }),
        );
        const d = phase(over);
        N.strata.forEach((s, x) => {
          const bx = (col4(x, 0) + col4(x, 1)) / 2;
          d.append(el("line", { class: "cm-br pu", x1: col4(x, 0) + G.cw4 / 2, x2: bx, y1: G.sy(s.m0), y2: G.sy(s.m0), "stroke-dasharray": "2 4" }));
          d.append(el("line", { class: "cm-br pu", x1: bx, x2: col4(x, 1) - G.cw4 / 2, y1: G.sy(s.m1), y2: G.sy(s.m1), "stroke-dasharray": "2 4" }));
          d.append(el("path", { class: "cm-br pu", d: `M${bx},${G.sy(s.m0)}V${G.sy(s.m1)}` }));
          T(bx, G.Yb + 22, `${f2(s.diff)} × ${f2(s.weight)}`, "cm-m cm-pu", { "text-anchor": "middle" }, d);
        });
        const naive = marker(d, N.naive, "or", "naive " + f2(N.naive), 30);
        naive.c.classList.add("faded");
        naive.t.setAttribute("opacity", 0.55);
        const e = phase(over);
        const adj = marker(e, N.standardized, "pu", "adjusted " + f2(N.standardized), 12);
        adj.c.setAttribute("data-term", "correction");
        const t = phase(over);
        truth(t);
        const gp = phase(over);
        gap(gp, N.standardized);
        phases.push([a], [m], [d], [e, adj], [t], [gp]);
      }
      return phases;
    }
    function showAll(phases) {
      phases.forEach((ph) => ph.forEach((g) => g.classList?.add("on")));
    }

    /* ---------- ghosts: the missing potential outcome of every patient ---------- */
    function drawGhosts() {
      ghostLayer.replaceChildren();
      const f = ghostAt[stage];
      if (!ghostBox.checked || !f) return;
      const links = el("g"),
        rings = el("g");
      P.forEach((p) => {
        const o = layouts[stage](p),
          q = f(p),
          on = p.id === pinned ? " pinned" : "";
        links.append(el("line", { class: "cm-link" + on, x1: o.x, y1: o.y, x2: q.x, y2: q.y }));
        rings.append(el("circle", { class: "cm-ghost sev-" + p.x + on, cx: q.x, cy: q.y, r: G.rs }));
      });
      ghostLayer.append(links, rings);
    }

    /* ---------- the pinned patient and their card ---------- */
    let pinned = null;
    function pin(id) {
      if (pinned != null) dots.get(pinned)?.classList.remove("pinned");
      pinned = id;
      if (id != null) {
        const c = dots.get(id);
        c.classList.add("pinned");
        dots.layer.append(c);
      }
      drawGhosts();
      renderCard();
    }
    function renderCard() {
      if (pinned == null) {
        card.innerHTML =
          "<h3>Patient card</h3><p style=\"margin:0\">Tap a patient, or press one and drag it around the waiting room, to read their card. Arrow keys move between patients when the figure has focus.</p>";
        return;
      }
      const p = byId.get(pinned);
      const obs = (a) => (p.a === a ? "observed" : "never observed");
      card.innerHTML = `<h3>Patient #${p.id}</h3><dl>
<dt>Severity</dt><dd>${p.x ? "high" : "low"}</dd>
<dt>Arm</dt><dd>${p.a ? "treated" : "control"}</dd>
<dt>Y(1) if treated</dt><dd>${f2(p.y1)} <span class="${p.a ? "" : "never"}">(${obs(1)})</span></dd>
<dt>Y(0) if control</dt><dd>${f2(p.y0)} <span class="${p.a ? "never" : ""}">(${obs(0)})</span></dd>
<dt>Own effect</dt><dd>${f2(p.y1 - p.y0)} <span class="never">(never observed)</span></dd>
</dl><button type="button" class="cm-unpin">Unpin</button>`;
      card.querySelector(".cm-unpin").onclick = () => pin(null);
    }

    /* ---------- captions, readout, aria ---------- */
    const [lo, hi] = N.strata;
    const captions = [
      "One hundred patients waiting to be seen. Blue dots are low severity, orange dots are high severity.",
      `High-severity patients were treated more often: ${pct(hi.pTreat)} of them versus ${pct(lo.pTreat)} of low-severity patients. So the treated room holds more of the sickest patients.`,
      `Each patient now sits at their outcome. The treated group scores ${f2(N.naive)} higher on average, but severity raises outcomes and treatment alike, so this naive gap overshoots the truth by ${f2(N.naive - N.sampleATE)}.`,
      `Within each severity group, who got treated was down to chance alone, so compare like with like: ${f2(lo.diff)} among low and ${f2(hi.diff)} among high severity. Weight them by how common each group is (${f2(lo.weight)} and ${f2(hi.weight)}) to get ${f2(N.standardized)}. The systematic bias is gone; the remaining ${f2(N.standardized - N.sampleATE)} is chance, which would average out over repeated studies.`,
    ];
    function readout() {
      const rows = [
        [["Patients", N.n], ["Low severity", lo.n], ["High severity", hi.n]],
        [
          ["Treated", `${N.nT} (${N.highT} high)`],
          ["Control", `${N.nC} (${N.highC} high)`],
          ["P(treated | high)", pct(hi.pTreat)],
          ["P(treated | low)", pct(lo.pTreat)],
          ["Naive gap", f2(N.naive)],
        ],
        [
          ["Mean Y, treated", f2(N.meanT)],
          ["Mean Y, control", f2(N.meanC)],
          ["Naive gap", f2(N.naive)],
          ["Truth (sample ATE)", f2(N.sampleATE)],
        ],
        [
          ["Low: treated − control", f2(lo.diff)],
          ["High: treated − control", f2(hi.diff)],
          ["Weights", `${f2(lo.weight)} / ${f2(hi.weight)}`],
          ["Adjusted", f2(N.standardized)],
          ["Naive", f2(N.naive)],
          ["Truth (sample ATE)", f2(N.sampleATE)],
        ],
      ][stage].slice();
      if (ghostBox.checked && stage >= 2)
        rows.push(
          ["True effect, low", f2(lo.trueEffect)],
          ["True effect, high", f2(hi.trueEffect)],
          ["Weighted truth", f2(N.trueStandardized)],
        );
      read.replaceChildren(...rows.flatMap(([k, v]) => [html("span", { class: "k" }, k), html("span", {}, String(v))]));
      cap.textContent =
        captions[stage] +
        (ghostBox.checked && stage >= 2
          ? ` Hollow rings are the outcomes we never see: each patient's other potential outcome, joined to them by their own effect. In truth the effect is ${f2(lo.trueEffect)} (low) and ${f2(hi.trueEffect)} (high), averaging exactly ${f2(N.trueStandardized)}.`
          : ghostBox.checked
            ? " The missing outcomes appear once patients sit on an outcome axis (stages 3 and 4)."
            : "");
      svg.setAttribute("aria-label", `Cohort figure, stage ${stage + 1} of 4, ${STAGES[stage]}. ${captions[stage]}`);
      stageBtns.forEach((b, k) => b.setAttribute("aria-pressed", String(k === stage)));
    }

    /* ---------- transitions ---------- */
    let token = 0,
      moving = Promise.resolve();
    async function go(k, { animate = true } = {}) {
      const my = ++token;
      stage = k;
      readout();
      if (!animate || A_reduced()) {
        await moving;
        if (my !== token) return;
        showAll(buildOverlay(k));
        dots.place(layouts[k]);
        drawGhosts();
        if (k === 3) M.pulse(adjMark());
        return;
      }
      ghostLayer.style.opacity = 0;
      [...under.children, ...over.children].forEach((g) => g.classList.remove("on"));
      await moving;
      if (my !== token) return;
      await M.wait(200);
      if (my !== token) return;
      const phases = buildOverlay(k);
      phases[0].forEach((g) => g.classList.add("on")); // axes first
      moving = dots.to(layouts[k], { duration: 900, stagger: 5, order: (a, b) => a.p.slot - b.p.slot });
      await moving;
      if (my !== token) return;
      for (const ph of phases.slice(1)) {
        await M.wait(380);
        if (my !== token) return;
        const [g, mark] = ph;
        if (mark && mark.c) {
          // the adjusted estimate starts where the naive one sat, then glides to its value
          const x0 = G.xr(N.naive),
            x1 = G.xr(N.standardized);
          mark.c.setAttribute("cx", x0);
          g.classList.add("on");
          await new Promise((res) =>
            tween({ duration: 900, ease: ease.inOut, onUpdate: (u) => mark.c.setAttribute("cx", lerp(x0, x1, u)), onDone: res }),
          );
          if (my !== token) return;
          M.pulse(mark.c);
        } else ph.forEach((x) => x.classList.add("on"));
      }
      drawGhosts();
      ghostLayer.style.opacity = 1;
    }
    const adjMark = () => over.querySelector(".cm-mark.pu");
    const A_reduced = () => root.CausalAnim.reduced();

    /* ---------- autoplay once in view; Play all replays ---------- */
    let auto = "pending",
      autoRun = 0;
    function stopAuto() {
      auto = "off";
      autoRun++;
    }
    async function playAll(fromStart) {
      const run = ++autoRun;
      if (A_reduced()) return go(3, { animate: false });
      if (fromStart) {
        go(0);
        await M.wait(1300);
      } else await M.wait(900);
      for (const k of [1, 2, 3]) {
        if (run !== autoRun) return;
        await go(k);
        if (run !== autoRun) return;
        if (k < 3) await M.wait(2200);
      }
    }
    playBtn.onclick = () => {
      stopAuto();
      auto = "off";
      playAll(true);
    };
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        (e) => {
          if (e[0].isIntersecting && auto === "pending") {
            auto = "off";
            playAll(false);
          }
        },
        { threshold: 0.4 },
      ).observe(svg);

    /* ---------- direct manipulation ---------- */
    function toSvg(ev) {
      const r = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      return { x: ((ev.clientX - r.left) / r.width) * vb.width, y: ((ev.clientY - r.top) / r.height) * vb.height };
    }
    function nearest(pt, max = 24) {
      let best = null,
        bd = max * max;
      P.forEach((p) => {
        const c = dots.get(p.id);
        const dx = +c.getAttribute("cx") - pt.x,
          dy = +c.getAttribute("cy") - pt.y,
          d = dx * dx + dy * dy;
        if (d < bd) {
          bd = d;
          best = p.id;
        }
      });
      return best;
    }
    let drag = null;
    svg.addEventListener("pointerdown", (ev) => {
      const pt = toSvg(ev);
      const onDot = ev.target.classList?.contains("dot");
      const id = onDot ? +ev.target.getAttribute("data-id") : nearest(pt);
      if (id == null) return;
      stopAuto();
      pin(id);
      if (onDot && stage === 0) {
        ev.preventDefault();
        svg.setPointerCapture(ev.pointerId);
        const c = dots.get(id);
        c.classList.add("lifted");
        drag = { id, pointer: ev.pointerId };
      }
    });
    svg.addEventListener("pointermove", (ev) => {
      if (!drag || ev.pointerId !== drag.pointer) return;
      const pt = toSvg(ev);
      const c = dots.get(drag.id);
      c.setAttribute("cx", Math.max(0, Math.min(G.W, pt.x)));
      c.setAttribute("cy", Math.max(0, Math.min(G.H, pt.y)));
    });
    const endDrag = () => {
      if (!drag) return;
      const c = dots.get(drag.id),
        home = layouts[stage](byId.get(drag.id));
      const x0 = +c.getAttribute("cx"),
        y0 = +c.getAttribute("cy");
      c.classList.remove("lifted");
      tween({
        duration: 420,
        onUpdate: (u) => {
          c.setAttribute("cx", lerp(x0, home.x, u));
          c.setAttribute("cy", lerp(y0, home.y, u));
        },
      });
      drag = null;
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("keydown", (ev) => {
      const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 };
      if (ev.key in moves) {
        ev.preventDefault();
        stopAuto();
        const slot = pinned == null ? 0 : (byId.get(pinned).slot + moves[ev.key] + 100) % 100;
        pin(bySlot[slot].id);
      } else if (ev.key === "Escape") pin(null);
    });
    ghostBox.addEventListener("change", () => {
      drawGhosts();
      ghostLayer.style.opacity = 1;
      readout();
    });

    /* ---------- resize: lay out again at the new width ---------- */
    let lastW = W;
    if ("ResizeObserver" in window)
      new ResizeObserver(() => {
        const w = Math.round(svg.getBoundingClientRect().width);
        if (!w || Math.abs(w - lastW) < 2) return;
        lastW = w;
        moving.then(() => {
          geom();
          showAll(buildOverlay(stage));
          dots.place(layouts[stage]);
          drawGhosts();
        });
      }).observe(svg);

    // Alive on arrival: the waiting room is drawn immediately.
    showAll(buildOverlay(0));
    renderCard();
    readout();
    mount.cohortMorph = { go, pin, get stage() { return stage; }, numbers: N };
  });
})(globalThis);
