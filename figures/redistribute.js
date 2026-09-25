/* Kaplan–Meier as "redistribute to the right" (Efron 1967).
 *
 * Every patient starts with the same mass 1/n. Time sweeps right. At an event the patient's
 * current mass falls out and Ŝ steps down by exactly that mass. At a censoring nothing falls:
 * the patient's mass is split equally among the heirs, the patients still at risk to the right
 * (plain KM), or only those with the same severity (IPCW with a censoring model that uses
 * severity). A survivor's mass times n is then 1/Ĝ(t−), where Ĝ is the Kaplan–Meier curve of
 * remaining uncensored (in the heirs' pool).
 *
 * Pure computations are exported for node tests (tests/redistribute.test.cjs); in the browser the
 * module also registers the figure "redistribute" (data-variant="informative" for lesson 23).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.CausalRedistribute = api;
    if (root.CausalFigures) registerFigure(api);
  }
})(globalThis, function () {
  /* Sort by follow-up time; at ties events come before censorings (the KM convention). */
  function order(rows) {
    return rows
      .map((_, i) => i)
      .sort((i, j) => rows[i].time - rows[j].time || rows[j].event - rows[i].event || i - j);
  }

  /* The redistribution schedule. Patients censored at or after the horizon H are still followed
   * at the end: they never give their mass away. stratum(row) picks the heirs' pool
   * (null: everyone to the right). Returns items in time order:
   *   {i, t, kind: "event" | "censor" | "kept", mass, heirs, gift, s}
   * where mass is the patient's mass when the cursor reaches them, gift = mass / heirs.length,
   * and s is Ŝ just after the item. "kept": a censoring with nobody left in its pool (mass stays). */
  function schedule(rows, { horizon = Infinity, stratum = null } = {}) {
    const n = rows.length,
      key = stratum || (() => 0),
      idx = order(rows),
      mass = new Array(n).fill(1 / n),
      alive = new Set(idx),
      items = [];
    let s = 1;
    for (const i of idx) {
      const r = rows[i];
      if (!r.event && r.time >= horizon) continue;
      if (r.event && r.time > horizon) continue;
      alive.delete(i);
      const m = mass[i];
      if (r.event) {
        s -= m;
        mass[i] = 0;
        items.push({ i, t: r.time, kind: "event", mass: m, heirs: [], gift: 0, s });
      } else {
        const heirs = [...alive].filter((j) => key(rows[j]) === key(r));
        if (!heirs.length) {
          items.push({ i, t: r.time, kind: "kept", mass: m, heirs, gift: 0, s });
          continue;
        }
        const gift = m / heirs.length;
        heirs.forEach((j) => (mass[j] += gift));
        mass[i] = 0;
        items.push({ i, t: r.time, kind: "censor", mass: m, heirs, gift, s });
      }
    }
    return { n, horizon, items, survivors: [...alive], finalMass: mass, finalS: s };
  }

  /* Discrete state once every item with time ≤ T has happened: masses, at-risk set, Ŝ(T). */
  function stateAt(sched, T) {
    const mass = new Array(sched.n).fill(1 / sched.n),
      gone = new Set();
    let s = 1;
    for (const it of sched.items) {
      if (it.t > T) break;
      gone.add(it.i);
      if (it.kind === "event") {
        s -= mass[it.i];
        mass[it.i] = 0;
      } else if (it.kind === "censor") {
        it.heirs.forEach((j) => (mass[j] += it.gift));
        mass[it.i] = 0;
      }
    }
    const atRisk = [];
    for (let i = 0; i < sched.n; i++) if (!gone.has(i)) atRisk.push(i);
    const onLine = atRisk.reduce((a, i) => a + mass[i], 0);
    return { mass, atRisk, s, onLine };
  }

  /* Ŝ as a right-continuous step function from the schedule's events. */
  function curve(sched) {
    const pts = [{ t: 0, s: 1 }];
    sched.items.filter((it) => it.kind === "event").forEach((it) => pts.push({ t: it.t, s: it.s }));
    return pts;
  }
  const valueAt = (pts, t) => {
    let v = pts[0].s;
    for (const p of pts) if (p.t <= t) v = p.s;
    return v;
  };

  /* Ĝ(T): Kaplan–Meier probability of remaining uncensored through the censorings at times ≤ T
   * (before the horizon), computed directly from counts in the patient's pool. At a tie an
   * event at the same time has already left the risk set (events first). */
  function censorKM(rows, T, { horizon = Infinity, stratum = null, pool = null } = {}) {
    const key = stratum || (() => 0),
      inPool = rows.filter((r) => pool === null || key(r) === pool),
      times = [...new Set(inPool.filter((r) => !r.event && r.time < horizon && r.time <= T).map((r) => r.time))].sort(
        (a, b) => a - b,
      );
    let g = 1;
    for (const c of times) {
      const atRisk = inPool.filter((r) => r.time > c || (r.time === c && !r.event)).length,
        d = inPool.filter((r) => r.time === c && !r.event).length;
      g *= 1 - d / atRisk;
    }
    return g;
  }

  /* Truth for these same patients had nobody dropped out: the share whose potential event time
   * under their own treatment exceeds t. */
  const potentialTime = (p) => (p.a ? p.t1 : p.t0);
  function truthCurve(rows) {
    const ts = rows.map(potentialTime).sort((a, b) => a - b),
      n = rows.length,
      pts = [{ t: 0, s: 1 }];
    ts.forEach((t, k) => pts.push({ t, s: (n - k - 1) / n }));
    return pts;
  }

  /* The informative-censoring world for lesson 23: the same course cohort (same patients,
   * treatments and event times, because the censoring draw scales the same uniform), but
   * low-severity patients drop out at 15% a year, high-severity at 1%, and follow-up ends at 8 years. */
  const INFORMATIVE = { censor: [0.15, 0.01], horizon: 8 };
  const bySeverity = (p) => p.x;

  /* Average gap to the truth at the horizon over many seeded cohorts (same design). */
  function gapsOverSeeds(Cohort, params, seeds) {
    let sumPlain = 0,
      sumStrat = 0;
    for (let k = 1; k <= seeds; k++) {
      const rows = Cohort.build({ ...params, seed: k }).patients.filter((p) => p.a),
        H = params.horizon,
        truth = valueAt(truthCurve(rows), H);
      sumPlain += schedule(rows, { horizon: H }).finalS - truth;
      sumStrat += schedule(rows, { horizon: H, stratum: bySeverity }).finalS - truth;
    }
    return { plain: sumPlain / seeds, strat: sumStrat / seeds, seeds };
  }

  return {
    order,
    schedule,
    stateAt,
    curve,
    valueAt,
    censorKM,
    truthCurve,
    potentialTime,
    INFORMATIVE,
    bySeverity,
    gapsOverSeeds,
  };
});

/* ------------------------------------------------------------------------------------------ */
function registerFigure(RD) {
  const { el, html, player, fmt, ease } = CausalAnim;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  if (!document.getElementById("rd-style")) {
    const st = document.createElement("style");
    st.id = "rd-style";
    st.textContent = `
.rd-fig svg.fig .tick, .rd-fig svg.fig .fig-text, .rd-fig svg.fig .ref-label { font-size: 13px; }
.rd-fig svg.fig .fig-text.ink { font-size: 13.5px; }
.rd-fig svg.fig .axis-label { font-size: 14px; }
.rd-fig svg.fig { touch-action: manipulation; cursor: pointer; }
.rd-fig svg.fig:focus { outline: none; }
.rd-fig svg.fig:focus-visible { outline: 3px solid var(--p); outline-offset: 2px; }
.rd-fig .fig-readout { min-height: 7.5em; }
.rd-fig .rd-heirs { border: 0; padding: 0; margin: 0 0 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.rd-fig .rd-heirs legend { font-size: 14px; color: var(--ink); padding: 0; margin: 0 0 6px; width: 100%; }
.rd-fig .rd-heirs label { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 14px; border: 1px solid var(--rule); border-radius: 22px; cursor: pointer; font-size: 14px; background: var(--paper); margin: 0; }
.rd-fig .rd-heirs label:has(input:checked) { border-color: currentColor; box-shadow: inset 0 0 0 1px currentColor; }
.rd-fig .rd-heirs label.plain { color: var(--or); }
.rd-fig .rd-heirs label.strat { color: var(--purple); }
.rd-fig .rd-heirs label span { color: var(--ink); }
.rd-fig .rd-heirs input { width: 18px; height: 18px; margin: 0; accent-color: currentColor; }
.rd-fig .legend { font-size: 13px; }
.rd-fig .rd-sel { font-family: "IBM Plex Sans", system-ui, sans-serif; grid-column: 1 / -1; color: var(--ink); margin-top: 4px; line-height: 1.45; }
`;
    document.head.append(st);
  }

  CausalFigures.register("redistribute", (mount, data) => {
    const C = window.CausalCohort;
    const informative = data.variant === "informative";
    const params = informative ? RD.INFORMATIVE : { horizon: C.PARAMS.horizon };
    const cohort = informative ? C.build(params) : C.cohort;
    const rows = cohort.patients.filter((p) => p.a);
    const n = rows.length,
      H = params.horizon;

    // Both rules share patients, times and kinds; only the heirs differ.
    const sched = {
      plain: RD.schedule(rows, { horizon: H }),
      strat: RD.schedule(rows, { horizon: H, stratum: RD.bySeverity }),
    };
    const curves = { plain: RD.curve(sched.plain), strat: RD.curve(sched.strat) };
    // The plain curve must be Kaplan–Meier, twice over: Efron's kernel in the cohort module and
    // the product-limit formula. If either disagrees, say so instead of drawing.
    const pl = C.km(rows),
      efron = C.kmRedistribute(rows).steps.filter((s) => s.event && s.t <= H);
    curves.plain.slice(1).forEach((p, k) => {
      if (Math.abs(p.s - RD.valueAt(pl, p.t)) > 1e-9 || Math.abs(p.s - efron[k].s) > 1e-9)
        throw new Error("redistribution does not reproduce Kaplan–Meier");
    });
    const truth = RD.truthCurve(rows);
    let rule = "plain";

    // Per-patient incoming gifts for both rules, and each patient's schedule item.
    const itemOf = {};
    const incoming = { plain: rows.map(() => []), strat: rows.map(() => []) };
    ["plain", "strat"].forEach((r) => {
      itemOf[r] = {};
      sched[r].items.forEach((it, k) => {
        itemOf[r][it.i] = k;
        it.heirs.forEach((j, rank) => incoming[r][j].push({ k, rank }));
      });
    });

    // Clock: the cursor meets each patient at their own time. Screen time per gap blends real
    // time and "one beat per patient", so the early crowd is not a blur.
    const items = sched.plain.items;
    const K = items.length;
    const U = [];
    let beat = 0;
    {
      const w = [];
      let prev = 0;
      items.forEach((it) => {
        w.push(0.5 * ((it.t - prev) / H) + 0.5 / (K + 1));
        prev = it.t;
      });
      w.push(0.5 * ((H - prev) / H) + 0.5 / (K + 1));
      const tail = 0.05,
        tot = w.reduce((a, b) => a + b, 0) / (1 - tail);
      beat = 0.5 / (K + 1) / tot;
      let acc = 0;
      w.forEach((v, k) => {
        acc += v / tot;
        U[k] = acc; // U[k] for k < K: when the cursor reaches item k; U[K]: reaches H
      });
    }
    const du = 1.6 * beat; // one transition lasts about 1.6 beats of the clock
    const timeOf = (u) => {
      if (u >= U[K]) return H;
      let k = 0;
      while (k < K && U[k] < u) k++;
      const u0 = k ? U[k - 1] : 0,
        t0 = k ? items[k - 1].t : 0,
        t1 = k < K ? items[k].t : H;
      return t0 + ((u - u0) / (U[k] - u0)) * (t1 - t0);
    };
    const progress = (k, u) => clamp((u - U[k]) / du);

    // For automated checks: the clock of each patient's transition.
    mount.rdClock = { U: U.slice(), du, kinds: items.map((it) => it.kind), times: items.map((it) => it.t) };

    /* ---------- DOM ---------- */
    mount.classList.add("figure", "rd-fig");
    let heirsBox = null;
    if (informative) {
      heirsBox = html("fieldset", { class: "rd-heirs" });
      heirsBox.append(html("legend", {}, "Who inherits a dropout's mass?"));
      [
        ["plain", "Everyone still at risk (plain KM)"],
        ["strat", "Only the same severity (IPCW given severity)"],
      ].forEach(([v, text]) => {
        const id = "rd-heirs-" + v;
        const input = html("input", { type: "radio", name: "rd-heirs", id, value: v });
        if (v === rule) input.checked = true;
        const lab = html("label", { for: id, class: v });
        lab.append(input, html("span", {}, text));
        heirsBox.append(lab);
        input.addEventListener("change", () => {
          if (input.checked) {
            rule = v;
            render(clock.t);
          }
        });
      });
      mount.append(heirsBox);
    }
    const svg = el("svg", {
      class: "fig",
      role: "img",
      tabindex: 0,
      "aria-label": informative
        ? `Kaplan–Meier as moving mass for ${n} treated patients with severity-dependent dropout. Dots sit on a time axis at their follow-up time; a cursor sweeps right. Events drop the curve by the patient's mass; dropouts hand their mass to heirs, either everyone to the right or only the same severity. The truth curve appears at the end. Use the left and right arrow keys to select a patient.`
        : `Kaplan–Meier as moving mass for the ${n} treated patients of the course cohort. Dots sit on a time axis at their follow-up time; a cursor sweeps right. At an event the dot's mass falls into the curve, which steps down by exactly that mass. At a censoring the dot dissolves and its mass flows to every patient still at risk to the right, who grow. Use the left and right arrow keys to select a patient.`,
    });
    mount.append(svg);
    const playMount = html("div");
    mount.append(playMount);
    const legend = html("p", { class: "legend legend-swatches" });
    const sw = (inner, w = 16) => `<svg class="swatch" width="${w}" height="14" aria-hidden="true">${inner}</svg>`;
    legend.innerHTML = [
      `<span>${sw(`<circle cx="8" cy="7" r="4.5" fill="${informative ? "var(--p)" : "var(--p)"}"/>`)}${informative ? "Low severity, own mass 1/" + n : "Own mass, 1/" + n}</span>`,
      informative ? `<span>${sw(`<circle cx="8" cy="7" r="4.5" fill="var(--or)"/>`)}High severity</span>` : "",
      `<span>${sw(`<circle cx="8" cy="7" r="6.5" fill="var(--teal)"/><circle cx="8" cy="7" r="3.8" fill="${"var(--p)"}"/>`)}Teal ring: mass inherited from dropouts</span>`,
      `<span>${sw(`<path d="M4 3L12 11M12 3L4 11" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round"/>`)}Event</span>`,
      `<span>${sw(`<line x1="8" y1="2" x2="8" y2="12" stroke="var(--muted)" stroke-width="2"/>`)}Censored (tick)</span>`,
      informative
        ? `<span>${sw(`<line x1="1" y1="7" x2="27" y2="7" stroke="var(--or)" stroke-width="2.5"/>`, 28)}Heirs: everyone</span><span>${sw(`<line x1="1" y1="7" x2="27" y2="7" stroke="var(--purple)" stroke-width="2.5"/>`, 28)}Heirs: same severity</span><span>${sw(`<line x1="1" y1="7" x2="27" y2="7" stroke="var(--green)" stroke-width="2.5" stroke-dasharray="6 4"/>`, 28)}Truth (nobody drops out)</span>`
        : `<span>${sw(`<line x1="1" y1="7" x2="27" y2="7" stroke="var(--ink)" stroke-width="2.5"/>`, 28)}Ŝ(t) from moving mass</span><span>${sw(`<line x1="1" y1="7" x2="27" y2="7" stroke="var(--ink)" stroke-width="8" opacity=".16"/>`, 28)}Product-limit KM, computed separately</span>`,
    ].join("");
    mount.append(legend);
    const readout = html("div", { class: "fig-readout", "aria-live": "off" });
    const cap = html("p", { class: "fig-caption" });
    const note = html("p", { class: "note" });
    mount.append(readout, cap, note);

    /* ---------- geometry (laid out at the container's real width) ---------- */
    let G = null;
    const sevFill = (p) => (informative ? (p.x ? "var(--or)" : "var(--p)") : "var(--p)");
    function layout() {
      const W = Math.max(300, Math.round(mount.clientWidth || 0));
      const phone = W < 560;
      const m = { l: phone ? 40 : 50, r: informative ? (phone ? 24 : 34) : phone ? 14 : 22 };
      const r0 = clamp(W / 110, 3.6, 7);
      const top = 30,
        hc = phone ? 170 : 210;
      const sx = (t) => m.l + (t / H) * (W - m.l - m.r);
      const sy = (s) => top + (1 - s) * hc;
      // Largest mass each patient ever carries (at their exit, or at the end), over both rules.
      const maxW = rows.map((_, i) =>
        Math.max(
          ...["plain", "strat"].map((r) => {
            const k = itemOf[r][i];
            return (k === undefined ? sched[r].finalMass[i] : sched[r].items[k].mass) * n;
          }),
        ),
      );
      const rmax = maxW.map((w) => r0 * Math.sqrt(Math.max(1, w)));
      // Beeswarm: x is the follow-up time, exactly; y is the smallest offset with no overlap.
      const pos = new Array(n);
      const placed = [];
      const pad = 1.4;
      const fits = (x, y, r) => placed.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 >= (q.r + r + pad) ** 2);
      const bestY = (x, r, limit = Infinity) => {
        const cands = [0];
        placed.forEach((q) => {
          const dx = x - q.x,
            R = q.r + r + pad;
          if (Math.abs(dx) < R) {
            const h = Math.sqrt(R * R - dx * dx);
            cands.push(q.y + h + 0.01, q.y - h - 0.01);
          }
        });
        cands.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);
        for (const y of cands) if (Math.abs(y) <= limit && fits(x, y, r)) return y;
        return null;
      };
      const exiting = RD.order(rows).filter((i) => itemOf.plain[i] !== undefined);
      const staying = RD.order(rows).filter((i) => itemOf.plain[i] === undefined);
      exiting.forEach((i) => {
        const x = sx(rows[i].time),
          y = bestY(x, rmax[i]);
        pos[i] = { x, y };
        placed.push({ x, y, r: rmax[i] });
      });
      // Patients still followed at the end cluster at the horizon: packed leftward by at most a
      // small distance, and the strip grows taller instead of spreading them back in time.
      const base = placed.length;
      const maxShift = Math.max(24, 0.06 * (W - m.l - m.r));
      let limit = Math.max(2.2 * Math.max(...rmax), ...placed.map((q) => Math.abs(q.y) + q.r));
      const order2 = staying.slice().sort((a, b) => rmax[b] - rmax[a] || a - b);
      for (let tries = 0; tries < 80; tries++) {
        placed.length = base;
        let ok = true;
        for (const i of order2) {
          let x = sx(H) - rmax[i],
            y = null;
          while (y === null && sx(H) - rmax[i] - x <= maxShift) {
            y = bestY(x, rmax[i], limit - rmax[i]);
            if (y === null) x -= rmax[i] * 0.6;
          }
          if (y === null) {
            ok = false;
            break;
          }
          pos[i] = { x, y };
          placed.push({ x, y, r: rmax[i] });
        }
        if (ok) break;
        limit += Math.max(...rmax) * 0.5;
      }
      const ext = Math.max(...placed.map((q) => Math.abs(q.y) + q.r));
      const stripTop = top + hc + 44;
      const mid = stripTop + ext + 4;
      const stripBottom = mid + ext + 4;
      pos.forEach((p) => (p.y += mid));
      const axisY = stripBottom + 6;
      const Ht = axisY + (phone ? 44 : 46);
      G = { W, Ht, m, r0, sx, sy, top, hc, pos, stripTop, stripBottom, axisY, phone };
      build();
    }

    /* ---------- static layers ---------- */
    let L = {};
    const dotEls = [];
    function build() {
      const { W, Ht, m, sx, sy, top, hc, stripTop, axisY, phone } = G;
      svg.setAttribute("viewBox", `0 0 ${W} ${Ht}`);
      svg.replaceChildren();
      const axes = el("g", { class: "fig-axes" });
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
        axes.append(
          el("line", { class: "grid", x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v) }),
          el("text", { class: "tick", x: m.l - 7, y: sy(v) + 4, "text-anchor": "end" }, fmt(v, 2)),
        );
      });
      axes.append(
        el("line", { class: "axis", x1: m.l, x2: m.l, y1: top, y2: top + hc }),
        el("line", { class: "axis", x1: m.l, x2: W - m.r, y1: top + hc, y2: top + hc }),
        el("text", { class: "axis-label", x: m.l, y: top - 10 }, "Ŝ(t)"),
        el("line", { class: "axis", x1: m.l, x2: W - m.r, y1: axisY, y2: axisY }),
      );
      const step = phone ? 2 : 1;
      for (let t = 0; t <= H + 1e-9; t += step) {
        axes.append(
          el("line", { class: "axis", x1: sx(t), x2: sx(t), y1: axisY, y2: axisY + 4 }),
          el("text", { class: "tick", x: sx(t), y: axisY + 19, "text-anchor": "middle" }, fmt(t, 0)),
        );
      }
      axes.append(
        el(
          "text",
          { class: "axis-label", x: (m.l + W - m.r) / 2, y: axisY + 38, "text-anchor": "middle" },
          "Years since the start of follow-up",
        ),
      );
      svg.append(axes);
      L.under = el("g");
      L.curve = el("g");
      L.ticks = el("g");
      L.cursor = el("g");
      L.marks = el("g"); // crosses and ticks in the strip
      L.dots = el("g");
      L.particles = el("g");
      L.sel = el("g");
      L.fg = el("g");
      // The strip title sits above the cursor, with a paper halo so the cursor never crosses it.
      L.title = el("g");
      L.title.append(
        el(
          "text",
          {
            class: "fig-text ink",
            x: m.l,
            y: stripTop - 12,
            stroke: "var(--paper)",
            "stroke-width": 5,
            "stroke-linejoin": "round",
            "paint-order": "stroke",
          },
          phone ? `${n} patients, at their follow-up time` : `The ${n} treated patients, each at their follow-up time`,
        ),
      );
      svg.append(L.under, L.curve, L.ticks, L.cursor, L.title, L.marks, L.dots, L.particles, L.sel, L.fg);
      if (!informative) {
        // Product-limit KM from CausalCohort.km as a faint band: the moving-mass curve traces it.
        const pts = C.km(rows);
        L.under.append(
          el("path", {
            d: stepPath(pts, H),
            fill: "none",
            stroke: "var(--ink)",
            "stroke-width": 8,
            opacity: 0.13,
            "stroke-linejoin": "round",
          }),
        );
      }
      dotEls.length = 0;
      rows.forEach((p, i) => {
        const g = el("g", { "data-id": p.id });
        const halo = el("circle", { r: G.r0, fill: "var(--teal)" });
        const core = el("circle", { r: G.r0, fill: sevFill(p), stroke: "var(--paper)", "stroke-width": 0.8 });
        g.append(halo, core);
        L.dots.append(g);
        const cross = el("path", {
          d: crossD(G.pos[i].x, G.pos[i].y, G.r0 * 0.95),
          stroke: "var(--red)",
          "stroke-width": 2.2,
          "stroke-linecap": "round",
          opacity: 0,
        });
        const tick = el("line", {
          x1: G.pos[i].x,
          x2: G.pos[i].x,
          y1: G.pos[i].y - G.r0 - 1,
          y2: G.pos[i].y + G.r0 + 1,
          stroke: "var(--muted)",
          "stroke-width": 1.6,
          opacity: 0,
        });
        L.marks.append(cross, tick);
        dotEls.push({ g, halo, core, cross, tick });
      });
    }
    const crossD = (x, y, a) => `M${x - a},${y - a}L${x + a},${y + a}M${x + a},${y - a}L${x - a},${y + a}`;
    function stepPath(pts, tEnd) {
      let d = `M${G.sx(0)},${G.sy(pts[0].s)}`;
      pts.slice(1).forEach((p) => {
        if (p.t > tEnd) return;
        d += ` H${G.sx(p.t).toFixed(2)} V${G.sy(p.s).toFixed(2)}`;
      });
      return d + ` H${G.sx(tEnd).toFixed(2)}`;
    }

    /* ---------- the pure render: everything is a function of the clock u ---------- */
    let selected = null,
      userSelected = false,
      landed = false;
    const arrival = (k, rank, count, u) => {
      // A particle leaves after the source starts dissolving and arrives in turn.
      const p = progress(k, u),
        start = 0.08 + (0.3 * rank) / Math.max(1, count),
        span = 0.55;
      return clamp((p - start) / span);
    };
    function render(u) {
      if (!G) return;
      const S = sched[rule],
        T = timeOf(u),
        its = S.items,
        colour = informative ? (rule === "plain" ? "var(--or)" : "var(--purple)") : "var(--ink)";
      const parts = [];
      const selRing = [];
      // Curve: the drop at an event grows while the mass lands.
      let level = 1,
        d = `M${G.sx(0)},${G.sy(1)}`;
      const drops = [];
      its.forEach((it, k) => {
        if (it.kind !== "event") return;
        const p = progress(k, u);
        if (p <= 0) return;
        const f = ease.inOut(clamp((p - 0.5) / 0.45));
        const before = level;
        level -= it.mass * f;
        d += ` H${G.sx(it.t).toFixed(2)} V${G.sy(level).toFixed(2)}`;
        if (p < 1) drops.push({ t: it.t, a: before, b: level });
      });
      d += ` H${G.sx(T).toFixed(2)}`;
      L.curve.replaceChildren(
        el("path", { d, fill: "none", stroke: colour, "stroke-width": 2.5, "stroke-linejoin": "round" }),
        ...drops.map((q) =>
          el("line", {
            x1: G.sx(q.t),
            x2: G.sx(q.t),
            y1: G.sy(q.a),
            y2: G.sy(q.b),
            stroke: "var(--red)",
            "stroke-width": 4,
            "stroke-linecap": "round",
          }),
        ),
      );
      // Censoring ticks on the curve (the curve does not step there).
      const ticks = [];
      its.forEach((it, k) => {
        if (it.kind === "event" || progress(k, u) <= 0) return;
        const y = G.sy(RD.valueAt(curves[rule], it.t));
        ticks.push(el("line", { x1: G.sx(it.t), x2: G.sx(it.t), y1: y - 5, y2: y + 5, stroke: "var(--muted)", "stroke-width": 1.5 }));
      });
      L.ticks.replaceChildren(...ticks);
      // End of the story (informative): truth, the other rule as a ghost, and the gap.
      const endF = clamp((u - (1 - 0.045)) / 0.04);
      L.fg.replaceChildren();
      if (informative && endF > 0) {
        const other = rule === "plain" ? "strat" : "plain";
        L.fg.append(
          el("path", {
            d: stepPath(truth, H),
            fill: "none",
            stroke: "var(--green)",
            "stroke-width": 2.2,
            "stroke-dasharray": "6 4",
            opacity: endF,
          }),
          el("path", {
            d: stepPath(curves[other], H),
            fill: "none",
            stroke: other === "plain" ? "var(--or)" : "var(--purple)",
            "stroke-width": 1.5,
            opacity: 0.4 * endF,
          }),
        );
        const xs = G.sx(H) + 7,
          a = G.sy(S.finalS),
          b = G.sy(RD.valueAt(truth, H));
        const gapEl = el("path", {
          d: `M${xs - 3},${a}H${xs}V${b}H${xs - 3}`,
          fill: "none",
          stroke: colour,
          "stroke-width": 2,
          opacity: endF,
        });
        L.fg.append(gapEl);
        if (endF >= 1 && !landed) {
          landed = true;
          window.CausalMotion?.pulse(gapEl);
        }
      }
      if (u < 1) landed = false;
      // Cursor.
      const cx = G.sx(T);
      L.cursor.replaceChildren(
        el("line", { x1: cx, x2: cx, y1: G.top - 4, y2: G.stripBottom, stroke: "var(--phat)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }),
        el(
          "text",
          {
            class: "ref-label",
            x: cx + (T > H * 0.7 ? -6 : 6),
            y: G.top - 12,
            "text-anchor": T > H * 0.7 ? "end" : "start",
            fill: "var(--phat)",
          },
          `t = ${T.toFixed(1)} y`,
        ),
      );
      // Dots.
      rows.forEach((p, i) => {
        const E = dotEls[i],
          k = itemOf[rule][i],
          home = G.pos[i];
        let m = 1 / n;
        incoming[rule][i].forEach(({ k: kk, rank }) => {
          const it = its[kk];
          m += it.gift * ease.inOut(arrival(kk, rank, it.heirs.length, u));
        });
        const rTot = G.r0 * Math.sqrt(m * n);
        let x = home.x,
          y = home.y,
          scale = 1,
          show = 1,
          cross = 0,
          tick = 0;
        if (k !== undefined) {
          const it = its[k],
            pr = progress(k, u);
          if (it.kind === "event" && pr > 0) {
            // The dot's mass flies up and becomes the curve's drop.
            const e = ease.inOut(clamp(pr / 0.6));
            const before = RD.valueAt(curves[rule], it.t) + it.mass;
            const tx = G.sx(it.t),
              ty = G.sy(before - it.mass / 2);
            const lift = Math.min(60, (home.y - ty) * 0.3);
            x = (1 - e) * (1 - e) * home.x + 2 * (1 - e) * e * ((home.x + tx) / 2) + e * e * tx;
            y = (1 - e) * (1 - e) * home.y + 2 * (1 - e) * e * ((home.y + ty) / 2 - lift) + e * e * ty;
            scale = 1 - clamp((pr - 0.45) / 0.4);
            cross = clamp((pr - 0.6) / 0.4);
          } else if (it.kind === "censor" && pr > 0) {
            scale = 1 - ease.inOut(clamp(pr / 0.4));
            tick = clamp((pr - 0.3) / 0.4);
            // Particles: one per heir, from the dissolving dot along a gentle arc.
            it.heirs.forEach((j, rank) => {
              const a = arrival(k, rank, it.heirs.length, u);
              if (a <= 0 || a >= 1) return;
              const e = ease.inOut(a),
                to = G.pos[j],
                lift = 18 + Math.min(40, Math.abs(to.x - home.x) * 0.15),
                mx = (home.x + to.x) / 2,
                my = Math.min(home.y, to.y) - lift;
              const px = (1 - e) * (1 - e) * home.x + 2 * (1 - e) * e * mx + e * e * to.x,
                py = (1 - e) * (1 - e) * home.y + 2 * (1 - e) * e * my + e * e * to.y;
              parts.push(el("circle", { cx: px.toFixed(1), cy: py.toFixed(1), r: Math.max(1.8, G.r0 * Math.sqrt(it.gift * n)).toFixed(2), fill: "var(--teal)", opacity: 0.9 }));
            });
          }
        }
        if (scale <= 0.001) show = 0;
        E.g.setAttribute("opacity", show);
        E.halo.setAttribute("cx", x);
        E.halo.setAttribute("cy", y);
        E.halo.setAttribute("r", Math.max(0, rTot * scale));
        E.core.setAttribute("cx", x);
        E.core.setAttribute("cy", y);
        E.core.setAttribute("r", Math.max(0, G.r0 * scale));
        E.cross.setAttribute("opacity", cross);
        E.tick.setAttribute("opacity", tick);
        if (i === shownSel(u)) selRing.push({ x: home.x, y: home.y, r: show ? rTot * scale + 3 : G.r0 + 3 });
      });
      L.particles.replaceChildren(...parts);
      L.sel.replaceChildren(
        ...selRing.map((q) =>
          el("circle", { cx: q.x, cy: q.y, r: q.r, fill: "none", stroke: "var(--ink)", "stroke-width": 2 }),
        ),
      );
      writeText(u, T);
    }
    // With no user choice, the end state points at the largest survivor.
    function shownSel(u) {
      if (userSelected || selected !== null) return selected;
      if (u >= 1) {
        const f = sched[rule].finalMass;
        let best = null;
        sched[rule].survivors.forEach((i) => {
          if (best === null || f[i] > f[best]) best = i;
        });
        return best;
      }
      return null;
    }

    /* ---------- text: exact values at the cursor ---------- */
    const f3 = (v) => v.toFixed(3);
    const sevName = (p) => (p.x ? "high severity" : "low severity");
    const sevAdj = (p) => (p.x ? "high-severity" : "low-severity");
    function writeText(u, T) {
      const S = sched[rule],
        st = RD.stateAt(S, T),
        rowsOut = [
          ["t", T.toFixed(2) + " y"],
          ["still at risk", `${st.atRisk.length} of ${n}`],
          ["mass still on the line", f3(st.onLine)],
        ];
      if (!informative) rowsOut.push(["product-limit Ŝ(t)", f3(RD.valueAt(C.km(rows), T))]);
      else {
        rowsOut.push([rule === "plain" ? "Ŝ(t), heirs = everyone" : "Ŝ(t), heirs = same severity", f3(st.s)]);
        if (u >= 1) {
          const tr = RD.valueAt(truth, H);
          rowsOut.push(
            [`truth S(${H}), nobody drops out`, f3(tr)],
            ["gap, heirs = everyone", signed(sched.plain.finalS - tr)],
            ["gap, heirs = same severity", signed(sched.strat.finalS - tr)],
          );
        }
      }
      readout.replaceChildren();
      rowsOut.forEach(([k, v]) => readout.append(html("span", { class: "k" }, k), html("span", {}, v)));
      const sel = shownSel(u);
      readout.append(html("div", { class: "rd-sel" }, selText(sel, T, st)));
      cap.textContent = captionText(u);
    }
    const signed = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(3);
    function selText(i, T, st) {
      if (i === null) return "Tap a dot (or focus the figure and use the arrow keys) to read what that patient stands for.";
      const p = rows[i],
        S = sched[rule],
        k = itemOf[rule][i],
        it = k === undefined ? null : S.items[k],
        who = `Patient ${p.id + 1} (${informative ? sevName(p) + ", " : ""}${
          it ? (it.kind === "event" ? "event" : "censored") + " at " + p.time.toFixed(2) + " y" : "still followed at " + H + " y"
        })`;
      if (it && it.t <= T) {
        if (it.kind === "event")
          return `${who} carried ${(it.mass * n).toFixed(2)} patients' worth of mass into the event: Ŝ fell by ${(it.mass * n).toFixed(2)}/${n} = ${f3(it.mass)} there.`;
        if (it.kind === "censor")
          return `${who} handed ${(it.mass * n).toFixed(2)} patients' worth of mass to ${it.heirs.length} ${
            informative && rule === "strat" ? sevAdj(p) + " " : ""
          }patients still at risk, ${(it.gift * n).toFixed(3)} each. The curve did not move.`;
        return `${who} had nobody left in their pool, so their mass stays put.`;
      }
      const w = st.mass[i] * n,
        g = RD.censorKM(rows, T, {
          horizon: H,
          stratum: rule === "strat" ? RD.bySeverity : null,
          pool: rule === "strat" ? p.x : null,
        });
      return `${who} now stands for ${w.toFixed(2)} patients = 1/Ĝ(t−) = 1/${f3(g)}, where Ĝ(t−) = ${f3(g)} is the Kaplan–Meier chance of still being followed${
        rule === "strat" ? " among " + sevAdj(p) + " patients" : ""
      }.`;
    }
    function captionText(u) {
      const S = sched[rule];
      let last = -1;
      for (let k = 0; k < K; k++) if (U[k] <= u + 1e-12) last = k;
      if (u >= 1) {
        const surv = S.survivors.map((i) => S.finalMass[i] * n);
        const lo = Math.min(...surv),
          hi = Math.max(...surv);
        return `Follow-up ends at ${H} years. The ${S.survivors.length} patients still followed hold all the remaining mass, Ŝ(${H}) = ${f3(
          S.finalS,
        )}. Each stands for ${lo === hi || hi - lo < 0.005 ? lo.toFixed(2) : lo.toFixed(2) + " to " + hi.toFixed(2)} patients: 1/Ĝ, the inverse chance of remaining uncensored${
          rule === "strat" ? " within their severity" : ""
        }.`;
      }
      if (last < 0)
        return `Every patient starts with the same mass, 1/${n}; all of it is on the line, so Ŝ(0) = 1. The cursor meets each patient at their own follow-up time.`;
      const it = S.items[last];
      if (it.kind === "event")
        return `At ${it.t.toFixed(2)} y a patient has the event. Their mass, ${(it.mass * n).toFixed(2)}/${n} = ${f3(it.mass)}, falls out and Ŝ steps down by exactly that: Ŝ = ${f3(it.s)}.`;
      if (it.kind === "censor")
        return `At ${it.t.toFixed(2)} y a patient is censored. Nothing falls: their ${(it.mass * n).toFixed(2)}/${n} is split among the ${it.heirs.length} ${
          informative && rule === "strat" ? sevAdj(rows[it.i]) + " " : ""
        }patients still at risk to the right, ${(it.gift * n).toFixed(3)}/${n} each. Ŝ stays at ${f3(it.s)}.`;
      return `At ${it.t.toFixed(2)} y the last ${sevAdj(rows[it.i])} patient at risk is censored; with no heirs, their mass stays put.`;
    }

    // What is exact and what is not.
    if (informative) {
      note.textContent =
        "Exact: every curve and weight is computed from these 58 patients. The truth is the share of the same patients whose own event time exceeds t, known here because the cohort is simulated. This is one draw; the average over 300 simulated cohorts of the same design is being computed…";
      setTimeout(() => {
        const g = RD.gapsOverSeeds(C, params, 300);
        note.textContent = `Exact: every curve and weight is computed from these ${n} patients. The truth is the share of the same patients whose own event time exceeds t, known here because the cohort is simulated. This cohort is one draw. Over ${g.seeds} simulated cohorts of the same design, the average gap at ${H} years is ${signed(
          g.plain,
        )} with everyone as heirs and ${signed(g.strat)} with same-severity heirs.`;
      }, 60);
    } else {
      note.textContent = `Exact: the curve is the Kaplan–Meier estimate for these ${n} patients (it is checked against the product-limit formula before drawing), and the masses are exact arithmetic. Patients still followed at ${H} years never give their mass away.`;
    }

    /* ---------- interaction ---------- */
    const clock = player(playMount, {
      duration: 20000,
      label: "Time",
      onT: (u) => render(u),
      formatValue: (u) => timeOf(u).toFixed(1) + " y",
    });
    const byTime = RD.order(rows);
    function pick(i) {
      selected = i;
      userSelected = true;
      render(clock.t);
    }
    svg.addEventListener("pointerdown", (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = null,
        bd = Infinity;
      rows.forEach((_, i) => {
        const d = Math.hypot(G.pos[i].x - q.x, G.pos[i].y - q.y);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best !== null && bd < Math.max(16, G.r0 * 3)) pick(best);
    });
    svg.addEventListener("keydown", (e) => {
      const cur = shownSel(clock.t);
      const at = cur === null ? -1 : byTime.indexOf(cur);
      let next = null;
      if (e.key === "ArrowRight") next = byTime[Math.min(n - 1, at + 1)];
      else if (e.key === "ArrowLeft") next = byTime[Math.max(0, at < 0 ? n - 1 : at - 1)];
      else if (e.key === "Home") next = byTime[0];
      else if (e.key === "End") next = byTime[n - 1];
      else if (e.key === "Escape") {
        selected = null;
        userSelected = false;
        render(clock.t);
        return;
      }
      if (next !== null && next !== undefined) {
        e.preventDefault();
        pick(next);
      }
    });

    let lastW = 0;
    const relayout = () => {
      const w = Math.round(mount.clientWidth || 0);
      if (!w || w === lastW) return;
      lastW = w;
      layout();
      render(clock.t);
    };
    if ("ResizeObserver" in window) new ResizeObserver(relayout).observe(mount);
    layout();
    render(0);
  });
}
