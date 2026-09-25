/* The seesaw: the mean is a balance point, and the influence function is how hard one extra
 * patient tips it.
 *
 * Exact for the mean functional. The 100 cohort outcomes Y (science/cohort.js) rest on a beam
 * over a fulcrum at their mean ψ. A new patient of mass ε placed at z exerts torque ε(z − ψ)
 * about ψ; the balance point moves to ψ_ε = (1 − ε)ψ + εz, so the shift per unit mass is
 * exactly z − ψ = ϕ(z). With ε = 1/101 that is literally the mean of 101 patients.
 * Weights mode: the treated arm with weights 1/g(X) balances at the weighted (Hájek IPW) mean;
 * a new patient with propensity g carries weight 1/g, so ε = (1/g)/(W + 1/g).
 * Schematic parts: the tilt angle is proportional to the torque and capped where the beam
 * touches the ground; dot areas are proportional to mass.
 *
 * Pure math is exported for node tests (tests/seesaw.test.cjs); the figure registers itself
 * as <div data-figure="seesaw"></div> when loaded in a page with shared/anim.js. */
(function (root) {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  const mean = (ys) => sum(ys) / ys.length;
  const wmean = (ys, ws) => sum(ys.map((y, i) => y * ws[i])) / sum(ws);
  // Mass share of a new patient who counts as m of n equal patients.
  const epsCount = (m, n = 100) => m / (n + m);
  // Mass share of a new patient of weight w joining total weight W.
  const epsWeight = (w, W) => w / (W + w);
  // Balance point after adding mass ε at z to a distribution balanced at ψ.
  const contaminate = (psi, eps, z) => (1 - eps) * psi + eps * z;
  // Shift of the balance point per unit of added mass (computed from the move, not assumed).
  const perMass = (psi, eps, z) => (contaminate(psi, eps, z) - psi) / eps;
  // Torque about the old fulcrum, per unit of total mass. The cohort's own torque about ψ is 0.
  const torque = (eps, z, psi) => eps * (z - psi);
  // Largest tilt (degrees) before the heavy end of the beam touches the ground.
  const tiltLimit = (armLength, height) =>
    (Math.asin(clamp(height / Math.max(armLength, 1e-9), 0, 1)) * 180) / Math.PI;
  // Schematic tilt: proportional to torque, saturating at the limit.
  const tiltAngle = (tau, tauRef, limit) => clamp(tau / tauRef, -1, 1) * limit;
  // Reference torque that gives a full tilt: one patient (ε = 1/101) five units from ψ.
  const TAU_REF = 5 / 101;
  // Dots resting on a line: bin by pixel x, stack upward. Returns [{x, y, r}] in input order.
  function stack(xs, radii, baseY, binW) {
    const cols = new Map();
    return xs.map((x, i) => {
      const r = radii[i];
      const b = Math.round(x / binW);
      const h = cols.get(b) || 0;
      cols.set(b, h + 2 * r + 0.6);
      return { x: b * binW, y: baseY - h - r, r };
    });
  }
  // The numbers the figure shows, from the cohort.
  function cohortSummary(C) {
    const ps = C.cohort.patients;
    const ys = ps.map((p) => p.y);
    const tr = ps.filter((p) => p.a);
    const ty = tr.map((p) => p.y),
      tw = tr.map((p) => 1 / p.g);
    return {
      n: ps.length,
      psi: mean(ys),
      nTreated: tr.length,
      W: sum(tw),
      psiW: wmean(ty, tw),
      naive: mean(ty),
      truth: mean(ps.map((p) => p.y1)),
    };
  }
  const M = {
    clamp,
    mean,
    wmean,
    epsCount,
    epsWeight,
    contaminate,
    perMass,
    torque,
    tiltLimit,
    tiltAngle,
    TAU_REF,
    stack,
    cohortSummary,
  };
  if (typeof module === "object" && module.exports) {
    module.exports = M;
    return;
  }
  root.SeesawMath = M;
  if (!root.CausalFigures || !root.CausalAnim) return;

  const A = root.CausalAnim;
  const { el, html } = A;
  const num = (x, d = 3) => (x < 0 ? "−" : "") + Math.abs(x).toFixed(d);
  const pulse = (e) => (root.CausalMotion ? root.CausalMotion.pulse(e) : null);
  const T13 = "font-size:13px";

  function injectStyle() {
    if (document.getElementById("seesaw-style")) return;
    const s = document.createElement("style");
    s.id = "seesaw-style";
    s.textContent = `
.seesaw .ss-stage{touch-action:none;cursor:grab;border-radius:8px}
.seesaw .ss-stage:focus-visible{outline:3px solid var(--purple);outline-offset:3px}
.seesaw .ss-stage.dragging{cursor:grabbing}
.seesaw svg{width:100%;height:auto;display:block;background:var(--paper);border:1px solid var(--rule);border-radius:8px}
.seesaw svg text{font-family:"IBM Plex Mono",monospace;font-size:13px}
.seesaw .ss-plot{margin-top:8px}
.seesaw .ss-modes{display:flex;flex-wrap:wrap;gap:6px;border:0;padding:0;margin:0}
.seesaw .ss-modes legend{font-size:13.5px;color:var(--muted);padding:0;margin-bottom:6px}
.seesaw .ss-modes label{display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;min-height:44px;border:1px solid var(--rule);border-radius:999px;font-size:14px;cursor:pointer;background:var(--paper)}
.seesaw .ss-modes label:has(input:checked){border-color:var(--purple);box-shadow:inset 0 0 0 1px var(--purple)}
.seesaw .ss-modes input{width:18px;height:18px;margin:0;accent-color:var(--purple)}
.seesaw [hidden]{display:none!important}
.seesaw .fig-controls label.ss-range{display:grid;gap:4px;font-size:14px;min-width:0}
.seesaw .fig-controls input[type=range]{width:100%;min-height:32px}
.seesaw .fig-controls .v{font-family:"IBM Plex Mono",monospace;color:var(--ink)}
.seesaw .ss-btns{display:flex;flex-wrap:wrap;gap:8px}
.seesaw .ss-btns button{min-height:44px}
.seesaw .sw{display:inline-block;width:14px;height:0;border-top:3px solid;vertical-align:middle;margin-right:6px}
.seesaw .fig-readout{grid-template-columns:minmax(0,1fr) auto}
.seesaw .fig-readout .k{font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:13.5px}
.seesaw .ss-hint{font-size:13.5px;color:var(--muted);margin:6px 0 0}
`;
    document.head.append(s);
  }

  root.CausalFigures.register("seesaw", (mount) => {
    injectStyle();
    const C = root.CausalCohort;
    if (!C) throw new Error("science/cohort.js is not loaded");
    const S = cohortSummary(C);
    const pts = C.cohort.patients.slice().sort((a, b) => a.slot - b.slot);
    const ZMIN = -2,
      ZMAX = 10;
    const W_MIN = Math.min(...pts.map((p) => 1 / p.g));

    // ---------- state ----------
    const st = {
      mode: "equal", // or "weights"
      m: 1, // equal mode: the new patient counts as m patients
      g: 0.3, // weights mode: the new patient's propensity
      z: 7.5,
      placed: false,
      drop: 0, // 0 hovering, 1 resting on the beam
      fulc: S.psi, // animated fulcrum position (data units)
      tilt: 0, // animated tilt (degrees, clockwise positive)
      blend: 0, // 0 equal layout, 1 weights layout (animated)
      holding: false, // being dragged or moved by keys: fulcrum stays at ψ, beam tilts
      trace: { equal: new Map(), weights: new Map() },
    };
    const base = () => (st.mode === "equal" ? S.psi : S.psiW);
    const wNew = () => 1 / st.g;
    const eps = () => (st.mode === "equal" ? epsCount(st.m, S.n) : epsWeight(wNew(), S.W));
    const settled = () => contaminate(base(), eps(), st.z);

    // ---------- DOM ----------
    mount.classList.add("figure", "seesaw");
    const row = html("div", { class: "fig-row" });
    const left = html("div"),
      right = html("div");
    row.append(left, right);
    mount.append(row);
    const stage = html("div", { class: "ss-stage", tabindex: "0" });
    const svg = el("svg", { role: "img" });
    stage.append(svg);
    const plotSvg = el("svg", { role: "img", class: "ss-plot" });
    const hint = html(
      "p",
      { class: "ss-hint" },
      "Drag the purple patient along the beam, or tap the beam. Arrow keys move it when the seesaw has focus (Shift for bigger steps).",
    );
    left.append(stage, hint, plotSvg);

    const uid = "ss" + Math.random().toString(36).slice(2, 7);
    const modes = html("fieldset", { class: "ss-modes" });
    modes.append(html("legend", {}, "Masses on the beam"));
    const mkRadio = (value, text, checked) => {
      const id = uid + "-" + value;
      const inp = html("input", { type: "radio", name: uid + "-mode", id, value });
      inp.checked = checked;
      const lab = html("label", { for: id });
      lab.append(inp, text);
      modes.append(lab);
      return inp;
    };
    const rEq = mkRadio("equal", "Equal, 1 per patient", true);
    const rW = mkRadio("weights", "Weights 1/g (treated arm)", false);
    const controls = html("div", { class: "fig-controls" });
    const mId = uid + "-m",
      gId = uid + "-g";
    const mLab = html("label", { for: mId, class: "ss-range" });
    const mVal = html("span", { class: "v" });
    const mIn = html("input", { type: "range", id: mId, min: 1, max: 60, step: 1, value: 1 });
    mLab.append(html("span", {}, "New patient counts as m patients: "), mVal, mIn);
    const gLab = html("label", { for: gId, class: "ss-range" });
    const gVal = html("span", { class: "v" });
    const gIn = html("input", { type: "range", id: gId, min: 0.02, max: 0.9, step: 0.01, value: 0.3 });
    gLab.append(html("span", {}, "New patient's propensity g: "), gVal, gIn);
    const btns = html("div", { class: "ss-btns" });
    const sweepBtn = html("button", { type: "button", class: "primary" }, "Sweep z for me");
    const clearBtn = html("button", { type: "button" }, "Clear trace");
    btns.append(sweepBtn, clearBtn);
    controls.append(modes, mLab, gLab, btns);
    const readout = html("div", { class: "fig-readout" });
    const cap = html("p", { class: "fig-caption", "aria-live": "polite" });
    right.append(controls, readout, cap);

    // ---------- geometry (pixels = viewBox units, recomputed on resize) ----------
    let G = null;
    const node = {};
    function geometry() {
      const Wd = Math.max(300, Math.round(left.clientWidth || mount.clientWidth || 640));
      const m = { l: 44, r: 18 };
      const sx = (z) => m.l + ((z - ZMIN) / (ZMAX - ZMIN)) * (Wd - m.l - m.r);
      const zx = (x) => ZMIN + ((x - m.l) / (Wd - m.l - m.r)) * (ZMAX - ZMIN);
      const r0 = clamp((Wd - 62) / 150, 2.6, 4.8);
      const radEq = pts.map(() => r0);
      const radW = pts.map((p) => r0 * Math.sqrt(1 / p.g / W_MIN));
      const binEq = 2 * r0 + 0.6,
        binW = 2 * Math.max(...radW) + 0.6;
      const lay0 = stack(pts.map((p) => sx(p.y)), radEq, 0, binEq);
      const tr = pts.filter((p) => p.a);
      const layT = stack(tr.map((p) => sx(p.y)), tr.map((p) => r0 * Math.sqrt(1 / p.g / W_MIN)), 0, binW);
      const layW = [];
      let k = 0;
      pts.forEach((p, i) => {
        if (p.a) layW.push({ ...layT[k++], o: 1 });
        else layW.push({ x: lay0[i].x, y: lay0[i].y + 14, r: radW[i], o: 0 });
      });
      lay0.forEach((q) => (q.o = 1));
      const stackMax = Math.max(...lay0.map((q) => -q.y + q.r), ...layT.map((q) => -q.y + q.r));
      const rNewMax = 20;
      const top = 8,
        tiltRoom = 34,
        labelY = top + tiltRoom + 12,
        bracketY = labelY + 10,
        stackTop = bracketY + 12,
        beamTop = stackTop + Math.max(stackMax, 2 * rNewMax) + 2,
        beamH = 5,
        beamY = beamTop + beamH,
        triH = 34,
        groundY = beamY + triH,
        tickY = groundY + 20,
        fulcLabelY = groundY + 40,
        H = fulcLabelY + 10;
      return { Wd, H, m, sx, zx, r0, lay0, layW, beamTop, beamH, beamY, triH, groundY, tickY, fulcLabelY, bracketY, labelY, stackTop };
    }

    function build() {
      G = geometry();
      const { Wd, H, sx } = G;
      svg.setAttribute("viewBox", `0 0 ${Wd} ${H}`);
      svg.replaceChildren();
      // Ground: the number line, fixed.
      const ground = el("g");
      ground.append(el("line", { x1: sx(ZMIN) - 8, x2: sx(ZMAX) + 8, y1: G.groundY, y2: G.groundY, stroke: "var(--muted)", "stroke-width": 1.4 }));
      for (let v = ZMIN; v <= ZMAX; v += 1) {
        const major = v % 2 === 0 || Wd > 560;
        ground.append(el("line", { x1: sx(v), x2: sx(v), y1: G.groundY, y2: G.groundY + (major ? 6 : 3), stroke: "var(--muted)" }));
        if (major)
          ground.append(el("text", { x: sx(v), y: G.tickY, "text-anchor": "middle", fill: "var(--muted)", style: T13 }, num(v, 0)));
      }
      ground.append(el("text", { x: 6, y: G.tickY, fill: "var(--muted)", style: "font-size:13px;font-style:italic" }, "y"));
      svg.append(ground);
      // Reference marks under the ground (weights mode): naive treated mean, truth.
      node.naive = el("line", { y1: G.groundY + 1, y2: G.groundY + 11, stroke: "var(--or)", "stroke-width": 3 });
      node.truth = el("line", { y1: G.groundY + 1, y2: G.groundY + 11, stroke: "var(--green)", "stroke-width": 2.5, "stroke-dasharray": "3 2" });
      node.oldPsi = el("line", { y1: G.groundY - 1, y2: G.groundY - 12, stroke: "var(--muted)", "stroke-width": 2 });
      svg.append(node.naive, node.truth, node.oldPsi);
      // Fulcrum (outside the rotating group; slides along the ground).
      node.fulc = el("polygon", { fill: "var(--ink)", "fill-opacity": 0.85, style: "color:var(--purple)" });
      node.fulcLabel = el("text", { y: G.fulcLabelY, "text-anchor": "middle", fill: "var(--ink)", style: T13 });
      svg.append(node.fulc, node.fulcLabel);
      // Rotating beam group.
      node.beamG = el("g");
      node.beam = el("rect", { x: sx(ZMIN) - 8, y: G.beamTop, width: sx(ZMAX) - sx(ZMIN) + 16, height: G.beamH, rx: 2.5, fill: "var(--ink)", "fill-opacity": 0.75 });
      node.dotsG = el("g");
      node.dots = pts.map(() => el("circle", { fill: "var(--muted)", stroke: "var(--paper)", "stroke-width": 0.8 }));
      node.dotsG.append(...node.dots);
      // Lever-arm bracket ϕ(z) = z − ψ, drawn above the stacks.
      node.bracket = el("g", { fill: "none", stroke: "var(--purple)", "stroke-width": 1.8 });
      node.brPath = el("path");
      node.brLead1 = el("line", { "stroke-dasharray": "2 3", "stroke-width": 1.2 });
      node.brLead2 = el("line", { "stroke-dasharray": "2 3", "stroke-width": 1.2 });
      node.brText = el("text", { "text-anchor": "middle", fill: "var(--purple)", stroke: "none", style: T13 + ";font-weight:600" });
      node.bracket.append(node.brLead1, node.brLead2, node.brPath, node.brText);
      node.dropLine = el("line", { stroke: "var(--purple)", "stroke-dasharray": "3 3", "stroke-width": 1.4 });
      node.halo = el("circle", { fill: "var(--purple)", "fill-opacity": 0.18 });
      node.pat = el("circle", { fill: "var(--purple)", stroke: "var(--paper)", "stroke-width": 1.5 });
      node.beamG.append(node.dotsG, node.beam, node.bracket, node.dropLine, node.halo, node.pat);
      svg.append(node.beamG);
      buildPlot();
      render();
    }

    // Trace plot: shift per unit mass against z, same x scale as the beam.
    let P = null;
    function buildPlot() {
      const { Wd, sx } = G;
      const H = Wd < 520 ? 200 : 190,
        t = 30,
        b = 40;
      const Y0 = -7,
        Y1 = 7;
      const sy = (v) => t + ((Y1 - v) / (Y1 - Y0)) * (H - t - b);
      P = { H, sy };
      plotSvg.setAttribute("viewBox", `0 0 ${Wd} ${H}`);
      plotSvg.replaceChildren();
      const g = el("g");
      [-6, -3, 0, 3, 6].forEach((v) => {
        g.append(el("line", { x1: sx(ZMIN), x2: sx(ZMAX), y1: sy(v), y2: sy(v), stroke: v === 0 ? "var(--muted)" : "var(--grid)", "stroke-width": v === 0 ? 1.2 : 1 }));
        g.append(el("text", { x: G.m.l - 8, y: sy(v) + 4, "text-anchor": "end", fill: "var(--muted)", style: T13 }, num(v, 0)));
      });
      for (let v = ZMIN; v <= ZMAX; v += 2)
        g.append(el("text", { x: sx(v), y: H - b + 18, "text-anchor": "middle", fill: "var(--muted)", style: T13 }, num(v, 0)));
      g.append(el("text", { x: (sx(ZMIN) + sx(ZMAX)) / 2, y: H - 6, "text-anchor": "middle", fill: "var(--ink)", style: "font-size:13px;font-family:Fraunces,Georgia,serif;font-style:italic" }, "z, where the new patient sits"));
      g.append(
        el(
          "text",
          { x: G.m.l - 36, y: 18, fill: "var(--ink)", style: "font-size:13px;font-family:Fraunces,Georgia,serif;font-style:italic" },
          Wd < 520 ? "shift per unit mass, (ψε − ψ)/ε" : "shift of the balance point per unit of added mass, (ψε − ψ)/ε",
        ),
      );
      plotSvg.append(g);
      node.pZero = el("circle", { r: 4, fill: "var(--paper)", stroke: "var(--ink)", "stroke-width": 1.5 });
      node.pLine = el("line", { stroke: "var(--purple)", "stroke-width": 2, "stroke-opacity": 0.55 });
      node.pLineText = el("text", { x: sx(ZMAX) - 4, y: sy(-5.2), "text-anchor": "end", fill: "var(--purple)", style: T13 });
      node.pTrace = el("g");
      node.pNow = el("g");
      plotSvg.append(node.pLine, node.pTrace, node.pZero, node.pNow, node.pLineText);
    }

    // ---------- render from state ----------
    function render() {
      if (!G) return;
      const { sx } = G;
      const e = eps();
      const ps = base();
      const fx = sx(st.fulc);
      // Fulcrum and its label.
      node.fulc.setAttribute("points", `${fx},${G.beamY} ${fx - 16},${G.groundY} ${fx + 16},${G.groundY}`);
      const lab = st.mode === "equal" ? "balance " : "weighted balance ";
      node.fulcLabel.textContent = lab + num(st.fulc, 3);
      const half = (lab.length + 6) * 4;
      node.fulcLabel.setAttribute("x", clamp(fx, half + 2, G.Wd - half - 2));
      node.oldPsi.setAttribute("x1", sx(ps));
      node.oldPsi.setAttribute("x2", sx(ps));
      const wv = st.blend > 0.5 ? 1 : 0;
      [node.naive, node.truth].forEach((n) => n.setAttribute("opacity", st.blend));
      node.naive.setAttribute("x1", sx(S.naive));
      node.naive.setAttribute("x2", sx(S.naive));
      node.truth.setAttribute("x1", sx(S.truth));
      node.truth.setAttribute("x2", sx(S.truth));
      // Beam rotation about the fulcrum apex.
      node.beamG.setAttribute("transform", `rotate(${st.tilt.toFixed(3)} ${fx.toFixed(2)} ${G.beamY})`);
      // Dots, morphing between layouts.
      const u = st.blend;
      node.dots.forEach((c, i) => {
        const a = G.lay0[i],
          b = G.layW[i];
        c.setAttribute("cx", A.lerp(a.x, b.x, u).toFixed(2));
        c.setAttribute("cy", (G.beamTop + A.lerp(a.y, b.y, u)).toFixed(2));
        c.setAttribute("r", A.lerp(a.r, b.r, u).toFixed(2));
        c.setAttribute("opacity", A.lerp(a.o, b.o, u).toFixed(3));
        c.setAttribute("fill", wv ? "var(--p)" : "var(--muted)");
      });
      // The new patient: area proportional to its mass (relative to one cohort patient).
      const massRel = st.mode === "equal" ? st.m : wNew() / W_MIN;
      const rN = clamp(G.r0 * Math.sqrt(massRel), G.r0 * 1.25, 20);
      const px = sx(st.z);
      const restY = G.beamTop - rN;
      const hoverY = G.bracketY - 4;
      const py = A.lerp(hoverY, restY, st.drop);
      node.pat.setAttribute("cx", px);
      node.pat.setAttribute("cy", py);
      node.pat.setAttribute("r", rN);
      node.halo.setAttribute("cx", px);
      node.halo.setAttribute("cy", py);
      node.halo.setAttribute("r", rN + 5);
      node.dropLine.setAttribute("x1", px);
      node.dropLine.setAttribute("x2", px);
      node.dropLine.setAttribute("y1", py + rN);
      node.dropLine.setAttribute("y2", G.beamTop);
      node.dropLine.setAttribute("opacity", st.drop < 1 ? 1 - st.drop : 0);
      // Bracket from ψ to z.
      const bx = sx(ps),
        by = G.bracketY;
      node.bracket.setAttribute("opacity", st.drop);
      node.brPath.setAttribute("d", `M${bx},${by + 6} V${by} H${px} V${by + 6}`);
      node.brLead1.setAttribute("x1", bx);
      node.brLead1.setAttribute("x2", bx);
      node.brLead1.setAttribute("y1", by + 6);
      node.brLead1.setAttribute("y2", G.beamTop);
      node.brLead2.setAttribute("x1", px);
      node.brLead2.setAttribute("x2", px);
      node.brLead2.setAttribute("y1", by + 6);
      node.brLead2.setAttribute("y2", py - rN - 2);
      const phiTxt = `ϕ(z) = z − ψ = ${num(st.z - ps, 2)}`;
      const tw = phiTxt.length * 7.9;
      node.brText.textContent = phiTxt;
      node.brText.setAttribute("x", clamp((bx + px) / 2, tw / 2 + 4, G.Wd - tw / 2 - 4));
      node.brText.setAttribute("y", G.labelY - 2);
      // aria and readout.
      svg.setAttribute(
        "aria-label",
        `Seesaw. ${st.mode === "equal" ? "100 cohort outcomes" : S.nTreated + " treated outcomes weighted by 1/g"} balance at ${num(ps, 3)}. ` +
          (st.placed
            ? `A new patient of mass ε = ${e.toFixed(4)} at z = ${num(st.z, 2)} has lever arm ${num(st.z - ps, 2)}; the balance point moves to ${num(settled(), 3)}.`
            : `A new patient waits above the beam at z = ${num(st.z, 2)}.`),
      );
      stage.setAttribute("aria-label", "Seesaw figure. Arrow keys move the new patient along the beam.");
      renderPlot();
      renderReadout();
    }

    function renderPlot() {
      const { sx } = G,
        sy = P.sy,
        ps = base();
      node.pZero.setAttribute("cx", sx(ps));
      node.pZero.setAttribute("cy", sy(0));
      const tr = st.trace[st.mode];
      node.pTrace.replaceChildren();
      const zs = [...tr.keys()];
      for (const [z, v] of tr) {
        node.pTrace.append(
          el("line", { x1: sx(z), x2: sx(z), y1: sy(0), y2: sy(v), stroke: "var(--purple)", "stroke-width": 1.5, "stroke-opacity": 0.45 }),
          el("circle", { cx: sx(z), cy: sy(v), r: 3, fill: "var(--purple)" }),
        );
      }
      const show = zs.length >= 5 && Math.max(...zs) - Math.min(...zs) >= 3;
      node.pLine.setAttribute("x1", sx(ZMIN));
      node.pLine.setAttribute("x2", sx(ZMAX));
      node.pLine.setAttribute("y1", sy(ZMIN - ps));
      node.pLine.setAttribute("y2", sy(ZMAX - ps));
      node.pLine.setAttribute("opacity", show ? 1 : 0);
      node.pLineText.setAttribute("opacity", show ? 1 : 0);
      node.pLineText.textContent = G.Wd < 520 ? `ϕ(z) = z − ${num(ps, 2)}` : `the line ϕ(z) = z − ${num(ps, 2)}, slope 1`;
      node.pNow.replaceChildren();
      if (st.placed) {
        const v = perMass(ps, eps(), st.z);
        node.pNow.append(el("circle", { cx: sx(st.z), cy: sy(v), r: 6.5, fill: "none", stroke: "var(--purple)", "stroke-width": 2 }));
      }
      plotSvg.setAttribute(
        "aria-label",
        `Trace of the shift per unit mass against z: ${tr.size} points recorded, each equal to z − ${num(ps, 3)}; they lie on a line of slope 1 through (${num(ps, 2)}, 0).`,
      );
    }

    function renderReadout() {
      const e = eps(),
        ps = base(),
        pe = settled();
      const rows = [];
      if (st.mode === "equal") {
        rows.push(["cohort mean ψ (100 patients)", num(ps)]);
        rows.push([`mass ε = m/(100 + m)${st.m === 1 ? ", 1/101" : ""}`, e.toFixed(4)]);
      } else {
        rows.push([`weighted balance ψ (${S.nTreated} treated, weight 1/g)`, num(ps)]);
        rows.push([`<span class="sw" style="border-color:var(--or)"></span>naive: unweighted treated mean`, num(S.naive)]);
        rows.push([`<span class="sw" style="border-color:var(--green);border-top-style:dashed"></span>truth: mean of Y(1), all 100`, num(S.truth)]);
        rows.push([`mass ε = w/(W + w), W = ${S.W.toFixed(1)}`, e.toFixed(4)]);
      }
      rows.push(["new patient at z", num(st.z, 2)]);
      rows.push(["lever arm ϕ(z) = z − ψ", num(st.z - ps)]);
      rows.push(["new balance ψε = (1 − ε)ψ + εz", num(pe)]);
      rows.push(["shift ψε − ψ = ε ϕ(z)", num(pe - ps, 4)]);
      rows.push(["shift ÷ ε", num(perMass(ps, e, st.z))]);
      readout.innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span>${v}</span>`).join("");
      mVal.textContent = `${st.m}, ε = ${st.m === 1 ? "1/101 = " : ""}${epsCount(st.m, S.n).toFixed(4)}`;
      gVal.textContent = `${st.g.toFixed(2)}, weight ${(1 / st.g).toFixed(2)}, ε = ${epsWeight(1 / st.g, S.W).toFixed(3)}`;
      mLab.hidden = st.mode !== "equal";
      gLab.hidden = st.mode !== "weights";
    }

    function caption() {
      const ps = base(),
        e = eps(),
        d = st.z - ps;
      if (st.holding) {
        cap.textContent = `Holding the patient at z = ${num(st.z, 2)}: the beam tips ${st.z > ps ? "clockwise" : "anticlockwise"} about ψ with torque ε(z − ψ) = ${num(e * (st.z - ps), 4)}. Let go and the balance point slides to rebalance it.`;
        return;
      }
      if (!st.placed) {
        cap.textContent = "Before it lands: which way will the beam tip, and which way will the balance point slide?";
        return;
      }
      const side = d > 0 ? "right" : d < 0 ? "left" : "nowhere";
      let s =
        Math.abs(d) < 0.005
          ? `Placed exactly at the balance point, the patient exerts no torque: the beam stays level and nothing moves.`
          : `The patient sits ${num(Math.abs(d), 2)} to the ${side} of the balance point. With a share ε = ${e.toFixed(4)} of the mass it tips the beam ${d > 0 ? "clockwise" : "anticlockwise"}, and the balance point slides ${side} by ε × ${num(Math.abs(d), 2)} = ${num(Math.abs(e * d), 4)}. Per unit of mass, the slide is ${num(d, 2)}: the lever arm itself.`;
      if (st.mode === "weights")
        s += ` With propensity g = ${st.g.toFixed(2)} this one patient carries ${(100 * e).toFixed(1)}% of the arm's total weight.${e > 0.15 ? " A rare patient far out dominates the weighted mean: this is why small propensities make IPW unstable." : ""}`;
      cap.textContent = s;
    }

    // ---------- motion ----------
    let tw = null,
      follow = null;
    const stop = () => {
      tw?.cancel();
      tw = null;
    };
    function tiltFor(z, fulc) {
      const ps = base();
      const tau = torque(eps(), z, ps);
      // Beam touches the ground on the heavy side at this limit.
      const arm = tau >= 0 ? G.sx(ZMAX) + 8 - G.sx(fulc) : G.sx(fulc) - (G.sx(ZMIN) - 8);
      return tiltAngle(tau, TAU_REF, tiltLimit(arm, G.triH));
    }
    function animate(to, duration, done) {
      stop();
      const from = { fulc: st.fulc, tilt: st.tilt, drop: st.drop, blend: st.blend };
      tw = A.tween({
        duration,
        onUpdate: (k) => {
          for (const key of Object.keys(to)) st[key] = A.lerp(from[key], to[key], k);
          render();
        },
        onDone: () => {
          tw = null;
          done?.();
        },
      });
    }
    // Direct manipulation: the fulcrum stays at ψ, the tilt follows the torque.
    function followLoop() {
      if (follow) return;
      const step = () => {
        const target = tiltFor(st.z, st.fulc);
        const k = A.reduced() ? 1 : 0.22;
        st.tilt += (target - st.tilt) * k;
        st.fulc += (base() - st.fulc) * (A.reduced() ? 1 : 0.2);
        render();
        if (st.holding || Math.abs(target - st.tilt) > 0.01 || Math.abs(base() - st.fulc) > 1e-4) follow = requestAnimationFrame(step);
        else follow = null;
      };
      follow = requestAnimationFrame(step);
    }
    function record() {
      const z = Math.round(st.z * 4) / 4; // one trace point per quarter unit
      st.trace[st.mode].set(z, perMass(base(), eps(), z));
    }
    function hold() {
      auto = "off";
      stop();
      st.holding = true;
      st.placed = true;
      st.drop = 1;
      followLoop();
    }
    function settle() {
      st.holding = false;
      if (follow) cancelAnimationFrame(follow);
      follow = null;
      // Beam levels as the fulcrum slides to the new balance point.
      animate({ fulc: settled(), tilt: 0 }, 900, () => {
        render();
        pulse(node.fulc);
        caption();
      });
    }
    function setZ(z) {
      st.z = clamp(Math.round(z * 20) / 20, ZMIN, ZMAX);
      record();
      render();
      if (st.holding) caption();
    }

    // Pointer: grab the patient or tap anywhere on the beam.
    const toZ = (ev) => {
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const q = pt.matrixTransform(svg.getScreenCTM().inverse());
      return G.zx(q.x);
    };
    let dragging = false;
    stage.addEventListener("pointerdown", (ev) => {
      if (ev.target.closest && !ev.target.closest("svg")) return;
      dragging = true;
      stage.classList.add("dragging");
      stage.setPointerCapture?.(ev.pointerId);
      hold();
      setZ(toZ(ev));
      caption();
      ev.preventDefault();
      stage.focus({ preventScroll: true });
    });
    stage.addEventListener("pointermove", (ev) => {
      if (!dragging) return;
      setZ(toZ(ev));
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("dragging");
      settle();
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    // Keyboard.
    let idle = null;
    stage.addEventListener("keydown", (ev) => {
      const stepK = ev.shiftKey ? 1 : 0.25;
      const map = { ArrowRight: stepK, ArrowUp: stepK, ArrowLeft: -stepK, ArrowDown: -stepK };
      let nz = null;
      if (ev.key in map) nz = st.z + map[ev.key];
      else if (ev.key === "Home") nz = ZMIN;
      else if (ev.key === "End") nz = ZMAX;
      if (nz == null) return;
      ev.preventDefault();
      hold();
      setZ(nz);
      clearTimeout(idle);
      idle = setTimeout(settle, 450);
    });

    // Controls.
    function switchMode(mode) {
      if (mode === st.mode) return;
      auto = "off";
      st.mode = mode;
      st.holding = false;
      if (follow) cancelAnimationFrame(follow);
      follow = null;
      if (st.placed) record();
      animate({ blend: mode === "weights" ? 1 : 0, fulc: st.placed ? settled() : base(), tilt: 0 }, 800, () => {
        render();
        pulse(node.fulc);
        caption();
      });
    }
    rEq.addEventListener("change", () => rEq.checked && switchMode("equal"));
    rW.addEventListener("change", () => rW.checked && switchMode("weights"));
    function massChanged() {
      if (!st.placed) return render();
      // Re-drop: the beam tips with the new torque, then rebalances.
      stop();
      st.trace[st.mode].clear();
      record();
      animate({ fulc: base(), tilt: tiltFor(st.z, base()) }, 350, () => settle());
    }
    let massTimer = null;
    mIn.addEventListener("input", () => {
      st.m = +mIn.value;
      render();
      clearTimeout(massTimer);
      massTimer = setTimeout(massChanged, 120);
    });
    gIn.addEventListener("input", () => {
      st.g = +gIn.value;
      render();
      clearTimeout(massTimer);
      massTimer = setTimeout(massChanged, 120);
    });
    clearBtn.addEventListener("click", () => {
      st.trace[st.mode].clear();
      if (st.placed) record();
      render();
    });
    sweepBtn.addEventListener("click", () => {
      auto = "off";
      stop();
      st.placed = true;
      st.drop = 1;
      st.holding = true;
      followLoop();
      const z0 = ZMIN + 0.5,
        z1 = ZMAX - 0.5;
      tw = A.tween({
        duration: 3200,
        ease: A.ease.inOut,
        onUpdate: (k) => setZ(A.lerp(z0, z1, k)),
        onDone: () => {
          tw = null;
          settle();
        },
      });
    });

    // Alive on arrival: the patient hovers over the beam; once in view it drops, tips, rebalances.
    let auto = "pending";
    function autoplay() {
      if (auto !== "pending") return;
      auto = "running";
      animate({ drop: 1 }, 450, () => {
        if (auto !== "running") return;
        st.placed = true;
        record();
        animate({ tilt: tiltFor(st.z, st.fulc) }, 650, () => {
          if (auto !== "running") return;
          setTimeout(() => {
            if (auto !== "running") return;
            auto = "off";
            settle();
          }, A.reduced() ? 0 : 350);
        });
      });
    }

    stage.setAttribute("role", "group");
    build();
    caption();
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        (en) => {
          if (en[0].isIntersecting) autoplay();
        },
        { threshold: 0.4 },
      ).observe(stage);
    else autoplay();
    let lastW = left.clientWidth;
    if ("ResizeObserver" in window)
      new ResizeObserver(() => {
        const w = left.clientWidth;
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        build();
      }).observe(left);
    // Test hook: settle instantly and expose the state (used by Playwright checks only).
    mount.seesaw = { state: st, summary: S, render, settle, setZ, hold };
  });
})(globalThis);
