/* AIPW anatomy: the one-step / AIPW formula as a colour-linked legend over the cohort.
 *
 *   ψ̂ = (1/n) Σ [m̂₁(X) − m̂₀(X)]  +  (1/n) Σ [A/ĝ(X)·(Y − m̂₁(X)) − (1−A)/(1−ĝ(X))·(Y − m̂₀(X))]
 *
 * Every patient of CausalCohort is a column: an orange stick (plug-in contribution m̂₁ − m̂₀) and a
 * residual stick Y − m̂_A(X), signed by arm, whose thickness and dot size carry the weight 1/ĝ or
 * 1/(1 − ĝ). The player detaches each stick and stacks 1/n of it, tip to tail, into two running
 * sums: the plug-in (orange) and the correction (purple walk), which lands on ψ̂_AIPW.
 *
 * ĝ is the stratum treated fraction (the saturated propensity). With stratum-mean m̂ the
 * correction is exactly 0. With an outcome model that ignores severity the plug-in is the naive
 * contrast and the correction repairs it exactly: for any m̂ that depends on (A, X) only,
 * plug-in + correction = Σ_x (n_x/n)(Ȳ₁ₓ − Ȳ₀ₓ), the stratified estimator, because within a
 * stratum Σ_{A=1} (1/ĝ(x))(Y − m̂₁(x)) = (n_x/n₁ₓ) Σ_{A=1}(Y − m̂₁(x)) = n_x (Ȳ₁ₓ − m̂₁(x)).
 *
 * The pure computation is exported for node tests (module.exports); in the browser it is
 * window.AipwAnatomy and the figure registers as data-figure="aipw-anatomy" (data-model="wrong"
 * or "strata" sets the starting outcome model). */
(function (root) {
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;

  /* compute(patients, {model}) with model "strata" (m̂ = cell means), "wrong" (m̂ = arm means,
   * ignoring severity) or a function (a, x) → prediction. ĝ(x) = stratum treated fraction. */
  function compute(patients, { model = "strata" } = {}) {
    const xs = [...new Set(patients.map((p) => p.x))].sort((a, b) => a - b);
    const cell = (a, x) => patients.filter((p) => p.a === a && p.x === x);
    const g = {},
      nx = {},
      cellMean = {};
    for (const x of xs) {
      const n1 = cell(1, x).length,
        n0 = cell(0, x).length;
      if (!n1 || !n0)
        throw new Error(
          `positivity fails in stratum X = ${x}: ${n1} treated, ${n0} control, so ĝ(${x}) = ${n1 / (n1 + n0)} and a weight is infinite`,
        );
      nx[x] = n1 + n0;
      g[x] = n1 / (n1 + n0);
      cellMean[`1,${x}`] = mean(cell(1, x).map((p) => p.y));
      cellMean[`0,${x}`] = mean(cell(0, x).map((p) => p.y));
    }
    const armMean = [0, 1].map((a) => mean(patients.filter((p) => p.a === a).map((p) => p.y)));
    const m =
      typeof model === "function"
        ? model
        : model === "wrong"
          ? (a) => armMean[a]
          : (a, x) => cellMean[`${a},${x}`];
    const n = patients.length;
    const rows = patients.map((p) => {
      const m1 = m(1, p.x),
        m0 = m(0, p.x),
        mA = p.a ? m1 : m0,
        w = p.a ? 1 / g[p.x] : 1 / (1 - g[p.x]),
        s = p.a ? 1 : -1,
        r = p.y - mA;
      return { id: p.id, slot: p.slot ?? p.id, x: p.x, a: p.a, y: p.y, m1, m0, plug: m1 - m0, g: g[p.x], w, s, r, corr: s * w * r };
    });
    const plugin = mean(rows.map((q) => q.plug)),
      correction = mean(rows.map((q) => q.corr));
    const stratified = xs.reduce((s, x) => s + (nx[x] / n) * (cellMean[`1,${x}`] - cellMean[`0,${x}`]), 0);
    const truth = patients.every((p) => Number.isFinite(p.y1) && Number.isFinite(p.y0))
      ? mean(patients.map((p) => p.y1 - p.y0))
      : NaN;
    return { rows, g, nx, cellMean, armMean, plugin, correction, aipw: plugin + correction, stratified, truth, n };
  }

  /* The textbook formula, written independently of the sticks, for the identity test. */
  function aipwFormula(patients, m, g) {
    let s = 0;
    for (const p of patients) {
      const gx = g(p.x);
      s += m(1, p.x) - m(0, p.x) + (p.a / gx) * (p.y - m(1, p.x)) - ((1 - p.a) / (1 - gx)) * (p.y - m(0, p.x));
    }
    return s / patients.length;
  }

  const api = { compute, aipwFormula };
  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }
  root.AipwAnatomy = api;
  if (!root.CausalFigures) return;

  const { el, html, player, fmt, ease, tween } = root.CausalAnim;
  const f3 = (v) => (Math.abs(v) < 5e-13 ? "0.000" : v.toFixed(3));
  const sgn = (v) => (Math.abs(v) < 0.0005 ? "0.000" : (v > 0 ? "+" : "−") + Math.abs(v).toFixed(3));

  const EQ =
    '<span class="aa-lhs">ψ̂ =</span> ' +
    '<span data-term="plugin" aria-label="plug-in term">(1/n) Σ [ m̂₁(X) − m̂₀(X) ]</span>' +
    ' <span class="aa-plus">+</span> ' +
    '<span data-term="correction" aria-label="correction term">(1/n) Σ [ ' +
    '<span class="aa-nw"><span data-term="gweight">A/ĝ(X)</span> · <span data-term="residual">(Y − m̂₁(X))</span></span>' +
    ' − <span class="aa-nw"><span data-term="gweight">(1−A)/(1−ĝ(X))</span> · <span data-term="residual">(Y − m̂₀(X))</span></span> ]</span>';

  // Phases of the clock (t ∈ [0, 1]).
  const PH = { p0: 0.03, p1: 0.43, c0: 0.5, c1: 0.9, fly: 0.07 };

  root.CausalFigures.register("aipw-anatomy", (mount, data) => {
    const C = root.CausalCohort;
    const patients = C.cohort.patients;
    const models = { strata: compute(patients, { model: "strata" }), wrong: compute(patients, { model: "wrong" }) };
    let modelName = data.model === "strata" ? "strata" : "wrong";
    let R = models[modelName];
    let blend = null; // {from, to, u} while morphing between models
    const uid = "aa-" + Math.random().toString(36).slice(2, 7);

    mount.classList.add("figure", "aipw-anatomy");
    const style = html("style");
    style.textContent = `
      .aipw-anatomy .eq-linked{white-space:normal;margin:0 0 10px}
      .aipw-anatomy .aa-nw{white-space:nowrap}
      .aipw-anatomy .aa-lhs{font-family:"IBM Plex Sans",system-ui,sans-serif}
      .aipw-anatomy [data-term="correction"].term{padding:2px 4px}
      .aipw-anatomy svg.aa-svg{width:100%;height:auto;display:block;background:var(--paper);border:1px solid var(--rule);border-radius:8px;touch-action:pan-y}
      .aipw-anatomy svg.aa-svg text{font-family:"IBM Plex Mono",monospace;font-size:13px;fill:var(--muted)}
      .aipw-anatomy svg.aa-svg text.aa-h{font-family:"IBM Plex Sans",system-ui,sans-serif;fill:var(--ink)}
      .aipw-anatomy .aa-toggle{display:flex;align-items:flex-start;gap:10px;min-height:44px;cursor:pointer;font-size:14px;color:var(--ink);margin:6px 0 0}
      .aipw-anatomy .aa-toggle input{width:22px;height:22px;flex:none;margin:1px 0 0;accent-color:var(--purple)}
      .aipw-anatomy .aa-patient{font-family:"IBM Plex Mono",monospace;font-size:13px;color:var(--muted);margin:6px 0 0;min-height:3em}
      .aipw-anatomy .fig-readout .aa-or{color:var(--or)} .aipw-anatomy .fig-readout .aa-pu{color:var(--purple)} .aipw-anatomy .fig-readout .aa-gr{color:var(--green)}
      .aipw-anatomy .aa-below{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px 24px;align-items:start}
      @media (max-width:760px){.aipw-anatomy .aa-below{grid-template-columns:1fr}}
    `;
    const eq = html("div", { class: "eq-linked", role: "note", "aria-label": "AIPW formula; each coloured term is linked to the figure" });
    eq.innerHTML = EQ;
    const svg = el("svg", { class: "aa-svg", role: "img" });
    const patientLine = html("p", { class: "aa-patient", "aria-live": "polite" }, "Hover or tap a column to read one patient's numbers.");
    const playMount = html("div");
    const toggleId = uid + "-wrong";
    const toggle = html("input", { type: "checkbox", id: toggleId });
    toggle.checked = modelName === "wrong";
    const toggleLabel = html("label", { for: toggleId, class: "aa-toggle" });
    toggleLabel.append(toggle, html("span", {}, "Wrong outcome model: m̂ ignores severity (arm means only)"));
    const readout = html("div", { class: "fig-readout" });
    const cap = html("p", { class: "fig-caption" });
    const left = html("div"),
      right = html("div"),
      ctl = html("div");
    left.append(svg, patientLine);
    ctl.append(playMount, toggleLabel);
    right.append(readout);
    const below = html("div", { class: "aa-below" }, ctl, right);
    mount.append(style, eq, left, below, cap);

    // ---------- geometry (recomputed on resize, laid out at the container's real width) ----------
    const allRows = () => [...models.strata.rows, ...models.wrong.rows];
    const groupOf = (q) => q.x * 2 + q.a; // 0: low ctrl, 1: low trt, 2: high ctrl, 3: high trt
    const byGroup = [0, 1, 2, 3].map((gk) =>
      models.strata.rows.filter((q) => groupOf(q) === gk).sort((a, b) => a.slot - b.slot),
    );
    const colIndex = new Map();
    byGroup.forEach((list, gk) => list.forEach((q, k) => colIndex.set(q.id, { gk, k })));
    const flightOrder = models.strata.rows.slice().sort((a, b) => a.slot - b.slot).map((q) => q.id);
    const orderOf = new Map(flightOrder.map((id, k) => [id, k]));
    const resMax = Math.max(...allRows().map((q) => Math.abs(q.r))) * 1.08;
    const G = {};
    function layout() {
      const W = Math.max(300, Math.round(mount.clientWidth ? left.clientWidth || mount.clientWidth : 640));
      const wide = W >= 620;
      G.W = W;
      G.wide = wide;
      G.L = 40;
      G.gap = wide ? 10 : 5;
      G.leftR = wide ? Math.round(W * 0.66) : W - 10;
      G.colW = (G.leftR - G.L - 3 * G.gap) / 100;
      // Rows: top = plug-in contributions, bottom = residuals, sums panel right (wide) or below.
      G.topT = 44;
      G.topB = G.topT + (wide ? 200 : 150);
      G.resT = G.topB + 50;
      G.resB = G.resT + (wide ? 170 : 150);
      G.labelY = G.resB + 20;
      if (wide) {
        G.sumT = G.topT;
        G.sumB = G.topB;
        G.sumX = G.leftR + 34;
        G.H = G.labelY + 30;
      } else {
        G.sumT = G.labelY + 84;
        G.sumB = G.sumT + 170;
        G.sumX = G.L + 6;
        G.H = G.sumB + 44;
      }
      G.barW = wide ? Math.min(56, (W - G.sumX) * 0.2) : 54;
      G.colA = G.sumX;
      G.colB = G.colA + G.barW + 16;
      G.labX = G.colB + G.barW + 12;
      const runs = [];
      for (const Mo of [models.strata, models.wrong]) {
        let c = 0;
        flightOrder.forEach((id) => {
          c += Mo.rows[id].corr / Mo.n;
          runs.push(Mo.plugin + c);
        });
      }
      const topVal = Math.max(3, ...runs, ...allRows().map((q) => q.plug)) + 0.15;
      G.yMax = Math.ceil(topVal * 2) / 2;
      svg.setAttribute("viewBox", `0 0 ${W} ${G.H}`);
    }
    const colX = (id) => {
      const { gk, k } = colIndex.get(id);
      const before = byGroup.slice(0, gk).reduce((s, l) => s + l.length, 0);
      return G.L + gk * G.gap + (before + k + 0.5) * G.colW;
    };
    const yTop = (v) => G.topB - (v / G.yMax) * (G.topB - G.topT);
    const ySum = (v) => G.sumB - (v / G.yMax) * (G.sumB - G.sumT);
    const yRes = (v) => (G.resT + G.resB) / 2 - (v / resMax) * ((G.resB - G.resT) / 2);

    // ---------- persistent elements ----------
    const L = {};
    function build() {
      svg.replaceChildren();
      const axes = el("g");
      const marks = el("g");
      svg.append(axes, marks);
      // Row headings.
      axes.append(
        el("text", { class: "aa-h", x: G.L, y: G.topT - 22 }, "plug-in stick  m̂₁(X) − m̂₀(X)"),
        el("text", { class: "aa-h", x: G.L, y: G.resT - 22 }, "residual  ±(Y − m̂_A(X)), width = weight"),
      );
      // Top row axis and ticks.
      const tk = [];
      for (let v = 0; v <= G.yMax + 1e-9; v += 1) tk.push(v);
      tk.forEach((v) => {
        axes.append(
          el("line", { x1: G.L, x2: G.leftR, y1: yTop(v), y2: yTop(v), stroke: "var(--grid)" }),
          el("text", { x: G.L - 8, y: yTop(v) + 4, "text-anchor": "end" }, String(v)),
        );
      });
      // Residual row: zero line and ± ticks.
      const rt = Math.floor(resMax);
      [-rt, 0, rt].forEach((v) =>
        axes.append(
          el("line", { x1: G.L, x2: G.leftR, y1: yRes(v), y2: yRes(v), stroke: v ? "var(--grid)" : "var(--muted)", "stroke-width": v ? 1 : 1 }),
          el("text", { x: G.L - 8, y: yRes(v) + 4, "text-anchor": "end" }, v > 0 ? "+" + v : v < 0 ? "−" + -v : "0"),
        ),
      );
      // Group labels under the residual row.
      byGroup.forEach((list, gk) => {
        const x0 = colX(list[0].id) - G.colW / 2,
          x1 = colX(list[list.length - 1].id) + G.colW / 2,
          cx = (x0 + x1) / 2;
        axes.append(
          el("line", { x1: x0, x2: x1, y1: G.resB + 4, y2: G.resB + 4, stroke: "var(--rule)", "stroke-width": 2 }),
          el("text", { x: cx, y: G.labelY + 4, "text-anchor": "middle" }, gk < 2 ? "low" : "high"),
          el("text", { x: cx, y: G.labelY + 21, "text-anchor": "middle" }, gk % 2 ? "A=1" : "A=0"),
        );
      });
      // Sums panel.
      const sumAxis = el("g");
      tk.forEach((v) =>
        sumAxis.append(
          el("line", { x1: G.colA - 6, x2: G.colB + G.barW + 4, y1: ySum(v), y2: ySum(v), stroke: "var(--grid)" }),
        ),
      );
      if (!G.wide) {
        tk.forEach((v) => sumAxis.append(el("text", { x: G.colA - 12, y: ySum(v) + 4, "text-anchor": "end" }, String(v))));
        sumAxis.append(el("text", { class: "aa-h", x: G.L, y: G.sumT - 26 }, "running sums, each patient adds 1/n"));
      } else {
        sumAxis.append(el("text", { class: "aa-h", x: G.colA - 6, y: G.topT - 22 }, "running sums (1/n each)"));
        // Key, in the free space beside the residual row.
        const kx = G.colA - 6,
          ky = G.resT + 6;
        sumAxis.append(
          el("line", { x1: kx, x2: kx, y1: ky - 10, y2: ky + 4, stroke: "var(--or)", "stroke-width": 4 }),
          el("text", { x: kx + 12, y: ky + 2 }, "plug-in stick"),
          el("line", { x1: kx, x2: kx, y1: ky + 18, y2: ky + 32, stroke: "var(--phat)", "stroke-width": 4 }),
          el("text", { x: kx + 12, y: ky + 30 }, "residual, signed by arm"),
          el("circle", { cx: kx, cy: ky + 53, r: 4, fill: "var(--p)" }),
          el("text", { x: kx + 12, y: ky + 58 }, "size = weight 1/ĝ, 1/(1−ĝ)"),
          el("line", { x1: kx - 4, x2: kx + 6, y1: ky + 80, y2: ky + 80, stroke: "var(--purple)", "stroke-width": 3 }),
          el("text", { x: kx + 12, y: ky + 86 }, "correction walk"),
          el("line", { x1: kx - 4, x2: kx + 6, y1: ky + 108, y2: ky + 108, stroke: "var(--green)", "stroke-width": 2, "stroke-dasharray": "4 3" }),
          el("text", { x: kx + 12, y: ky + 114 }, "truth, sample ATE"),
        );
      }
      sumAxis.append(
        el("line", { x1: G.colA - 6, x2: G.colB + G.barW + 4, y1: ySum(0), y2: ySum(0), stroke: "var(--muted)" }),
        el("text", { x: G.colA + G.barW / 2, y: ySum(0) + 18, "text-anchor": "middle" }, "plug-in"),
        el("text", { x: G.colB + G.barW / 2, y: ySum(0) + 18, "text-anchor": "middle" }, "AIPW"),
      );
      axes.append(sumAxis);

      // Truth: green dashed at the sample ATE, over the plug-in row and the sums.
      const truth = models.strata.truth;
      L.truthTop = el("line", { x1: G.L, x2: G.leftR, y1: yTop(truth), y2: yTop(truth), stroke: "var(--green)", "stroke-width": 1.8, "stroke-dasharray": "6 4", "data-term": "truth" });
      L.truthSum = el("line", { x1: G.colA - 6, x2: G.colB + G.barW + 4, y1: ySum(truth), y2: ySum(truth), stroke: "var(--green)", "stroke-width": 1.8, "stroke-dasharray": "6 4", "data-term": "truth" });

      // Hit bands (hover the rows to link terms and read one patient).
      L.bandTop = el("rect", { x: G.L, y: G.topT, width: G.leftR - G.L, height: G.topB - G.topT, fill: "transparent", "data-term": "plugin" });
      L.bandRes = el("rect", { x: G.L, y: G.resT, width: G.leftR - G.L, height: G.resB - G.resT, fill: "transparent", "data-term": "residual" });
      marks.append(L.bandTop, L.bandRes);

      L.plug = new Map();
      L.res = new Map();
      L.dot = new Map();
      L.flyP = new Map();
      L.flyR = new Map();
      const gHomeP = el("g", { "pointer-events": "none" }),
        gHomeR = el("g", { "pointer-events": "none" }),
        gDots = el("g"),
        gFly = el("g", { "pointer-events": "none" });
      flightOrder.forEach((id) => {
        const x = colX(id);
        const lp = el("line", { x1: x, x2: x, stroke: "var(--or)", "data-term": "plugin" });
        const lr = el("line", { x1: x, x2: x, stroke: "var(--phat)", "data-term": "residual" });
        const dt = el("circle", { cx: x, fill: "var(--p)", "data-term": "gweight", "data-id": id });
        const fp = el("line", { stroke: "var(--or)", "data-term": "plugin", visibility: "hidden" });
        const fr = el("line", { stroke: "var(--purple)", "data-term": "correction", visibility: "hidden" });
        gHomeP.append(lp);
        gHomeR.append(lr);
        gDots.append(dt);
        gFly.append(fp, fr);
        L.plug.set(id, lp);
        L.res.set(id, lr);
        L.dot.set(id, dt);
        L.flyP.set(id, fp);
        L.flyR.set(id, fr);
      });
      // Sums: plug-in bar, AIPW ghost + walk, landing line and marker.
      L.barP = el("rect", { x: G.colA, width: G.barW, fill: "var(--or)", "data-term": "plugin" });
      L.ghost = el("rect", { x: G.colB, width: G.barW, fill: "var(--or)", "fill-opacity": 0.3, "data-term": "plugin" });
      L.walk = el("path", { fill: "none", stroke: "var(--purple)", "stroke-width": 2, "stroke-linejoin": "round", "data-term": "correction" });
      L.land = el("line", { x1: G.colB - 3, x2: G.colB + G.barW + 3, stroke: "var(--purple)", "stroke-width": 3, "data-term": "correction" });
      L.marker = el("circle", { r: 5, fill: "var(--purple)", "data-term": "correction" });
      L.labs = el("g");
      marks.append(gHomeP, gHomeR, L.truthTop, L.barP, L.ghost, L.walk, L.land, L.truthSum, gDots, gFly, L.marker, L.labs);
      L.cursor = el("rect", { y: G.topT - 4, height: G.resB - G.topT + 8, fill: "var(--ink)", "fill-opacity": 0.07, visibility: "hidden", "pointer-events": "none" });
      marks.prepend(L.cursor);
    }

    // ---------- state at clock t ----------
    const lerp = (a, b, u) => a + (b - a) * u;
    function rowsNow() {
      if (!blend) return R.rows;
      const u = ease.inOut(blend.u);
      return blend.from.rows.map((q, i) => {
        const b = blend.to.rows[i];
        return { ...b, plug: lerp(q.plug, b.plug, u), r: lerp(q.r, b.r, u), corr: lerp(q.corr, b.corr, u) };
      });
    }
    const flightU = (k, a0, a1) => {
      const start = a0 + (k * (a1 - a0 - PH.fly)) / (flightOrder.length - 1);
      return Math.max(0, Math.min(1, (t_ - start) / PH.fly));
    };
    let t_ = 0,
      landed = false;
    // A flying piece: its centre travels on the ease, its signed length shrinks early (ease.out),
    // and it widens into a slab only at the very end, so pieces never balloon mid-flight.
    const late = (u) => Math.max(0, Math.min(1, (u - 0.75) / 0.25));
    function seg(line, a0, a1, b0, b1, u) {
      const e = ease.inOut(u),
        eL = ease.out(Math.min(1, u * 1.6));
      const mid = lerp((a0 + a1) / 2, (b0 + b1) / 2, e),
        half = lerp((a1 - a0) / 2, (b1 - b0) / 2, eL);
      line.setAttribute("y1", mid - half);
      line.setAttribute("y2", mid + half);
    }
    function render(t) {
      t_ = t;
      const rows = rowsNow();
      const n = rows.length;
      const plugin = rows.reduce((s, q) => s + q.plug, 0) / n;
      const sw = (w) => Math.max(0.9, Math.min(G.colW * 0.95, G.colW * 0.27 * w));
      const pw = Math.max(1, G.colW * 0.55);
      let cumP = 0,
        cumC = 0,
        landedP = 0,
        landedC = 0,
        nP = 0,
        nC = 0;
      let d = `M${G.colB},${ySum(plugin)}`;
      flightOrder.forEach((id, k) => {
        const q = rows[id],
          x = colX(id);
        const uP = flightU(k, PH.p0, PH.p1),
          uC = flightU(k, PH.c0, PH.c1);
        // Home sticks (ghosted once their contribution has left).
        const lp = L.plug.get(id);
        lp.setAttribute("y1", yTop(0));
        lp.setAttribute("y2", yTop(q.plug));
        lp.setAttribute("stroke-width", pw);
        lp.setAttribute("opacity", uP > 0 && t < PH.p1 ? 0.28 : 1);
        const yr = yRes(q.s * q.r);
        const lr = L.res.get(id);
        lr.setAttribute("y1", yRes(0));
        lr.setAttribute("y2", yr);
        lr.setAttribute("stroke-width", sw(q.w));
        lr.setAttribute("opacity", uC > 0 && t < PH.c1 ? 0.28 : 1);
        const dt = L.dot.get(id);
        dt.setAttribute("cy", yr);
        dt.setAttribute("r", Math.max(1.6, Math.min(G.colW * 0.9, G.colW * 0.3 * Math.sqrt(q.w) + 0.6)));
        dt.setAttribute("opacity", uC > 0 && t < PH.c1 ? 0.35 : 1);
        // Plug-in piece: the stick becomes a slab of height plug/n on top of the stack.
        const aP0 = cumP;
        cumP += q.plug / n;
        const fp = L.flyP.get(id);
        if (uP > 0 && uP < 1) {
          const e = ease.inOut(uP);
          const tx = G.colA + G.barW / 2;
          fp.setAttribute("visibility", "visible");
          fp.setAttribute("x1", lerp(x, tx, e));
          fp.setAttribute("x2", lerp(x, tx, e));
          seg(fp, yTop(0), yTop(q.plug), ySum(aP0), ySum(cumP), uP);
          fp.setAttribute("stroke-width", lerp(pw, G.barW, late(uP)));
        } else fp.setAttribute("visibility", "hidden");
        if (uP >= 1) {
          landedP = cumP;
          nP++;
        }
        // Correction piece: weighted, signed residual, 1/n of it, tip to tail on the walk.
        const aC0 = cumC;
        cumC += q.corr / n;
        const xs0 = G.colB + (k / n) * G.barW,
          xs1 = G.colB + ((k + 1) / n) * G.barW;
        const fr = L.flyR.get(id);
        if (uC > 0 && uC < 1) {
          const e = ease.inOut(uC);
          fr.setAttribute("visibility", "visible");
          fr.setAttribute("x1", lerp(x, xs1, e));
          fr.setAttribute("x2", lerp(x, xs1, e));
          seg(fr, yRes(0), yr, ySum(plugin + aC0), ySum(plugin + cumC), uC);
          fr.setAttribute("stroke-width", lerp(sw(q.w), 2.5, late(uC)));
          fr.setAttribute("stroke", uC < 0.5 ? "var(--phat)" : "var(--purple)");
        } else fr.setAttribute("visibility", "hidden");
        if (uC >= 1) {
          landedC = cumC;
          nC++;
          d += ` H${xs1.toFixed(2)} V${ySum(plugin + cumC).toFixed(2)}`;
        }
      });
      const aipw = plugin + cumC;
      // Plug-in bar and AIPW ghost.
      L.barP.setAttribute("y", ySum(landedP));
      L.barP.setAttribute("height", Math.max(0, ySum(0) - ySum(landedP)));
      const ghostOn = t >= PH.p1;
      L.ghost.setAttribute("y", ySum(plugin));
      L.ghost.setAttribute("height", ySum(0) - ySum(plugin));
      L.ghost.setAttribute("visibility", ghostOn ? "visible" : "hidden");
      L.walk.setAttribute("d", d);
      L.walk.setAttribute("visibility", t >= PH.c0 ? "visible" : "hidden");
      const walkEnd = plugin + landedC;
      L.marker.setAttribute("cx", G.colB + (nC / n) * G.barW);
      L.marker.setAttribute("cy", ySum(walkEnd));
      L.marker.setAttribute("visibility", t >= PH.c0 ? "visible" : "hidden");
      const done = nC === n;
      L.land.setAttribute("y1", ySum(aipw));
      L.land.setAttribute("y2", ySum(aipw));
      L.land.setAttribute("visibility", done ? "visible" : "hidden");
      if (done && !landed && !blend) root.CausalMotion.pulse(L.marker);
      landed = done;
      // Value labels right of the bars, spaced so they never collide.
      const labs = [{ v: models.strata.truth, s: `truth ${f3(models.strata.truth)}`, c: "var(--green)" }];
      if (nP === n) labs.push({ v: plugin, s: `plug-in ${f3(plugin)}`, c: "var(--or)" });
      if (done) labs.push({ v: aipw, s: `AIPW ${f3(aipw)}`, c: "var(--purple)" });
      else if (t >= PH.c0) labs.push({ v: walkEnd, s: `${sgn(landedC)}`, c: "var(--purple)" });
      labs.forEach((o) => (o.y = ySum(o.v) + 4));
      labs.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 17);
      const over = labs.length ? labs[labs.length - 1].y - (ySum(0) - 4) : 0;
      if (over > 0) labs.forEach((o) => (o.y -= over));
      L.labs.replaceChildren(
        ...labs.map((o) => el("text", { x: G.labX, y: o.y, fill: o.c, style: `fill:${o.c}` }, o.s)),
      );
      // Caption.
      const M = blend ? blend.to : R;
      const wrong = M === models.wrong;
      if (t < PH.p0)
        cap.textContent =
          "Each column is one patient, grouped by severity and arm. Top: the plug-in stick m̂₁(X) − m̂₀(X). Bottom: the residual Y − m̂_A(X), flipped for controls and drawn as thick as its weight. Press Play to add them up.";
      else if (t < PH.p1)
        cap.textContent = `Plug-in: each patient hands in 1/n of their orange stick. Running sum ${f3(cumP_at(t))} after ${nP} of ${n}.`;
      else if (t < PH.c0)
        cap.textContent = `The plug-in lands at ${f3(plugin)}, ${sgn(plugin - M.truth)} from the truth ${f3(M.truth)}.${wrong ? " A model that ignores severity inherits the confounding." : ""}`;
      else if (!done)
        cap.textContent = `Correction: each residual times its weight 1/ĝ or 1/(1−ĝ), signed by arm, adds 1/n of itself. Running correction ${sgn(landedC)} after ${nC} of ${n}.`;
      else if (wrong)
        cap.textContent = `The correction sums to ${sgn(M.correction)} and carries the estimate from ${f3(M.plugin)} to ${f3(M.aipw)}, exactly the severity-stratified estimate. The outcome model ignored severity; ĝ did not. The ${sgn(M.aipw - M.truth)} left over is sampling noise in 100 patients, not model bias. Now untick the wrong model: how big will the correction be?`;
      else
        cap.textContent = `With stratum means as m̂, the residuals in every stratum and arm sum to zero, so the weighted correction is exactly ${f3(M.correction)}: the purple walk wanders and comes home. The plug-in ${f3(M.plugin)} was already the stratified estimate. Its ${sgn(M.aipw - M.truth)} from the truth is sampling noise.`;
    }
    function cumP_at() {
      // Landed plug-in sum (for the caption), recomputed from the bar.
      const rows = rowsNow();
      let s = 0;
      flightOrder.forEach((id, k) => {
        if (flightU(k, PH.p0, PH.p1) >= 1) s += rows[id].plug / rows.length;
      });
      return s;
    }
    function updateText() {
      const M = R;
      readout.innerHTML =
        `<span class="k">ĝ(low), ĝ(high)</span><span>${M.g[0].toFixed(3)}, ${M.g[1].toFixed(3)}</span>` +
        `<span class="k">weights 1/ĝ, 1/(1−ĝ)</span><span>low ${(1 / M.g[0]).toFixed(2)}, ${(1 / (1 - M.g[0])).toFixed(2)}; high ${(1 / M.g[1]).toFixed(2)}, ${(1 / (1 - M.g[1])).toFixed(2)}</span>` +
        `<span class="k aa-or">plug-in estimate</span><span>${f3(M.plugin)}</span>` +
        `<span class="k aa-pu">correction</span><span>${sgn(M.correction)}</span>` +
        `<span class="k aa-pu">AIPW estimate</span><span>${f3(M.aipw)}</span>` +
        `<span class="k">stratified estimate</span><span>${f3(M.stratified)}</span>` +
        `<span class="k aa-gr">truth (sample ATE)</span><span>${f3(M.truth)}</span>`;
      svg.setAttribute(
        "aria-label",
        `One hundred patients as columns grouped by severity and arm. Orange plug-in sticks m̂₁ − m̂₀ and weighted residual sticks stack into running sums. Outcome model: ${modelName === "wrong" ? "ignores severity" : "stratum means"}. Plug-in ${f3(M.plugin)}, correction ${sgn(M.correction)}, AIPW ${f3(M.aipw)}, truth ${f3(M.truth)}.`,
      );
    }

    layout();
    build();
    const clock = player(playMount, {
      duration: 11000,
      label: "Patients added",
      formatValue: (t) => {
        const s = (a0, a1) => flightOrder.reduce((c, _, k) => c + (Math.max(0, Math.min(1, (t - a0 - (k * (a1 - a0 - PH.fly)) / (flightOrder.length - 1)) / PH.fly)) >= 1 ? 1 : 0), 0);
        return t < PH.c0 ? `plug-in ${s(PH.p0, PH.p1)}` : `correction ${s(PH.c0, PH.c1)}`;
      },
      onT: (t) => render(t),
    });
    const scrubLabel = playMount.querySelector(".fig-player label");
    if (scrubLabel) scrubLabel.style.flexBasis = "100%";
    updateText();
    render(0);

    // Switching the outcome model: the same sticks morph to their new lengths, then replay.
    let morph = null;
    toggle.addEventListener("change", () => {
      const next = toggle.checked ? "wrong" : "strata";
      if (next === modelName) return;
      morph?.cancel();
      blend = { from: blend ? { rows: rowsNow() } : R, to: models[next], u: 0 };
      modelName = next;
      R = models[next];
      updateText();
      clock.set(0);
      morph = tween({
        duration: root.CausalMotion.MOTION.base,
        ease: ease.linear,
        onUpdate: (u) => {
          blend.u = u;
          render(0);
        },
        onDone: () => {
          blend = null;
          render(0);
          clock.play();
        },
      });
    });

    // Colour-linked equation, plus: the correction term lights its residuals and weights too.
    root.CausalMotion.linkEquation(eq, svg);
    const corrSpan = eq.querySelector('[data-term="correction"]');
    const lightParts = (on) =>
      svg.querySelectorAll('[data-term="residual"],[data-term="gweight"]').forEach((e) => e.classList.toggle("term-on", on));
    ["mouseenter", "focus"].forEach((ev) => corrSpan.addEventListener(ev, () => lightParts(true)));
    ["mouseleave", "blur"].forEach((ev) => corrSpan.addEventListener(ev, () => lightParts(false)));
    // On an inner term (a weight or a residual) show only that part; back on the bracket, all of it.
    corrSpan.querySelectorAll("[data-term]").forEach((inner) => {
      ["mouseenter", "focus"].forEach((ev) =>
        inner.addEventListener(ev, () => setTimeout(() => {
          lightParts(false);
          svg.querySelectorAll(`[data-term="${inner.dataset.term}"]`).forEach((e) => e.classList.add("term-on"));
        })),
      );
      inner.addEventListener("mouseleave", (e) => {
        if (corrSpan.contains(e.relatedTarget)) lightParts(true);
      });
    });

    // Hover or tap a column: one patient's numbers.
    function nearest(evt) {
      const pt = svg.getBoundingClientRect();
      const sx = ((evt.clientX - pt.left) / pt.width) * G.W;
      let best = null,
        bd = Infinity;
      flightOrder.forEach((id) => {
        const dx = Math.abs(colX(id) - sx);
        if (dx < bd) (bd = dx), (best = id);
      });
      return bd <= Math.max(G.colW, 4) ? best : null;
    }
    function showPatient(id) {
      if (id == null) {
        L.cursor.setAttribute("visibility", "hidden");
        return;
      }
      const q = R.rows[id];
      L.cursor.setAttribute("x", colX(id) - Math.max(G.colW, 3) / 2);
      L.cursor.setAttribute("width", Math.max(G.colW, 3));
      L.cursor.setAttribute("visibility", "visible");
      patientLine.textContent = `Patient ${id}: ${q.x ? "high" : "low"} severity, A=${q.a}, Y=${q.y.toFixed(2)} · m̂₁−m̂₀=${q.plug.toFixed(2)} · Y−m̂_A=${q.r >= 0 ? "+" : "−"}${Math.abs(q.r).toFixed(2)} · weight ${q.w.toFixed(2)} · adds ${sgn(q.corr)} / n`;
    }
    [L.bandTop, L.bandRes].forEach((b) => {
      b.addEventListener("pointermove", (e) => showPatient(nearest(e)));
      b.addEventListener("pointerdown", (e) => showPatient(nearest(e)));
    });
    svg.addEventListener("pointerleave", () => showPatient(null));

    // Relayout at the container's real width.
    let lastW = G.W;
    if ("ResizeObserver" in root)
      new ResizeObserver(() => {
        const w = Math.max(300, Math.round(left.clientWidth || mount.clientWidth));
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        layout();
        build();
        [L.bandTop, L.bandRes].forEach((b) => {
          b.addEventListener("pointermove", (e) => showPatient(nearest(e)));
          b.addEventListener("pointerdown", (e) => showPatient(nearest(e)));
        });
        render(clock.t);
      }).observe(mount);
  });
})(globalThis);
