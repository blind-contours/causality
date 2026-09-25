/* Draw your guess: a reusable sketch-prediction.
 *
 * CausalGuess.mount(container, {
 *   id, xDomain, yDomain, xLabel, yLabel, kind: "curve" | "survival" | "point" | "band",
 *   prompt, truth: () => points | {seriesId: points} | number | [lo, hi] (may return a Promise),
 *   onReveal(result), background(svg, plot), series: [{id, label, color}], ...
 * })
 *
 * The learner sketches (freehand stroke snapped to a function of x; monotone non-increasing for
 * "survival"), drags a point, or drags the two ends of a band. "Reveal" draws the answer over the
 * sketch, shades the gap and scores it. Guesses are saved as form data (never an exercise, so a
 * guess can never count as a transfer demonstration).
 *
 * The pure scoring math below is exported for node tests (tests/guess.test.cjs). */
(function (root) {
  "use strict";

  /* ---------- pure math ---------- */
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const grid = (x0, x1, n) =>
    Array.from({ length: n }, (_, i) => x0 + ((x1 - x0) * i) / (n - 1));

  /* Right-continuous step function through sorted [x, y] points (a Kaplan–Meier curve). */
  function stepAt(points, x) {
    let y = points[0][1];
    for (const p of points) {
      if (p[0] <= x) y = p[1];
      else break;
    }
    return y;
  }
  /* Piecewise-linear interpolation through sorted [x, y] points, flat beyond the ends. */
  function linAt(points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [xa, ya] = points[i - 1],
        [xb, yb] = points[i];
      if (x <= xb) return xb === xa ? yb : ya + ((yb - ya) * (x - xa)) / (xb - xa);
    }
    return points[points.length - 1][1];
  }

  /* Snap a freehand stroke (data-unit [x, y] points in drawing order) onto a grid.
   * Each segment of the stroke writes linearly interpolated values into every grid x it spans,
   * so fast pointer moves leave no holes and a later pass over the same x overwrites an earlier one.
   * raw holds null where nothing has been drawn. Returns a new array. */
  function applyStroke(raw, xs, stroke) {
    const out = raw.slice();
    if (!stroke.length) return out;
    const n = xs.length,
      x0 = xs[0],
      h = (xs[n - 1] - x0) / (n - 1),
      put = (i, y) => {
        if (i >= 0 && i < n) out[i] = y;
      };
    put(Math.round((stroke[0][0] - x0) / h), stroke[0][1]);
    for (let s = 1; s < stroke.length; s++) {
      const [xa, ya] = stroke[s - 1],
        [xb, yb] = stroke[s],
        lo = Math.min(xa, xb),
        hi = Math.max(xa, xb),
        i0 = Math.ceil((lo - x0) / h - 1e-9),
        i1 = Math.floor((hi - x0) / h + 1e-9);
      if (i1 < i0) {
        put(Math.round((xb - x0) / h), yb);
        continue;
      }
      for (let i = i0; i <= i1; i++) {
        const x = xs[i];
        put(i, hi === lo ? yb : ya + ((yb - ya) * (x - xa)) / (xb - xa));
      }
    }
    return out;
  }

  /* Pool-adjacent-violators: the least-squares non-increasing fit to y (weights w). */
  function pavaDown(y, w) {
    const blocks = [];
    y.forEach((v, i) => {
      blocks.push({ v, w: w ? w[i] : 1, n: 1 });
      while (blocks.length > 1) {
        const b = blocks[blocks.length - 1],
          a = blocks[blocks.length - 2];
        if (a.v >= b.v) break;
        const W = a.w + b.w;
        blocks.splice(-2, 2, { v: (a.v * a.w + b.v * b.w) / W, w: W, n: a.n + b.n });
      }
    });
    return blocks.flatMap((b) => Array(b.n).fill(b.v));
  }

  /* Turn a raw sketch into a complete function on the grid.
   * o.monotone: project the drawn values onto non-increasing sequences (PAVA);
   * o.lo, o.hi: clamp; o.anchor: fixed value at xs[0] (a survival curve starts at 1).
   * Gaps are filled linearly, ends are carried flat (from the anchor on the left if given).
   * Returns null when nothing has been drawn. */
  function project(raw, o = {}) {
    const idx = [];
    raw.forEach((v, i) => {
      if (v !== null && v !== undefined && Number.isFinite(v)) idx.push(i);
    });
    if (o.anchor !== undefined && o.anchor !== null) {
      const k = idx.indexOf(0);
      if (k >= 0) idx.splice(k, 1);
    }
    if (!idx.length) return null;
    let vals = idx.map((i) => raw[i]);
    if (o.monotone) vals = pavaDown(vals);
    const lo = o.lo ?? -Infinity,
      hi = Math.min(o.hi ?? Infinity, o.anchor ?? Infinity);
    vals = vals.map((v) => clamp(v, lo, hi));
    const n = raw.length,
      out = new Array(n);
    const pts = idx.map((i, k) => [i, vals[k]]);
    if (o.anchor !== undefined && o.anchor !== null) pts.unshift([0, o.anchor]);
    for (let i = 0; i < n; i++) out[i] = linAt(pts, i);
    return out;
  }

  /* Share of the grid between the first and last drawn point (how much of the range was sketched). */
  function drawnShare(raw) {
    let a = -1,
      b = -1;
    raw.forEach((v, i) => {
      if (v !== null && v !== undefined) {
        if (a < 0) a = i;
        b = i;
      }
    });
    return a < 0 ? 0 : (b - a) / (raw.length - 1);
  }

  /* Move a hat-shaped neighbourhood of a curve: weight 1 at cx, falling linearly to 0 at cx ± half. */
  function hatAdjust(values, xs, cx, half, delta) {
    return values.map((v, i) => {
      const w = Math.max(0, 1 - Math.abs(xs[i] - cx) / half);
      return v + w * delta;
    });
  }

  /* Trapezoid mean of f over the grid (uniform or not). */
  function trapMean(xs, f) {
    let s = 0;
    for (let i = 1; i < xs.length; i++) s += ((f[i] + f[i - 1]) / 2) * (xs[i] - xs[i - 1]);
    return s / (xs[xs.length - 1] - xs[0]);
  }

  /* Curve score. within: share of the x-range where |guess − truth| <= tol (grid-point share on a
   * uniform grid); meanAbs: area between the curves divided by the x-range; maxAbs; the end values. */
  function curveScore(guess, truth, xs, tol) {
    const d = guess.map((g, i) => Math.abs(g - truth[i]));
    return {
      within: d.filter((v) => v <= tol + 1e-12).length / d.length,
      meanAbs: trapMean(xs, d),
      maxAbs: Math.max(...d),
      endGuess: guess[guess.length - 1],
      endTruth: truth[truth.length - 1],
      tol,
    };
  }

  function pointScore(guess, truth, span) {
    const error = guess - truth;
    return { guess, truth, error, absError: Math.abs(error), relError: Math.abs(error) / span };
  }

  /* Band score: widths, width ratio, overlap as intersection ÷ union (Jaccard), centre error. */
  function bandScore(g, t) {
    const [gl, gh] = [Math.min(...g), Math.max(...g)],
      [tl, th] = [Math.min(...t), Math.max(...t)],
      gw = gh - gl,
      tw = th - tl,
      inter = Math.max(0, Math.min(gh, th) - Math.max(gl, tl)),
      union = gw + tw - inter;
    return {
      guess: [gl, gh],
      truth: [tl, th],
      widthGuess: gw,
      widthTruth: tw,
      widthRatio: tw > 0 ? gw / tw : gw > 0 ? Infinity : 1,
      widthError: tw > 0 ? gw / tw - 1 : gw > 0 ? Infinity : 0,
      overlap: union > 0 ? inter / union : 1,
      centerError: (gl + gh) / 2 - (tl + th) / 2,
    };
  }

  const math = {
    clamp,
    grid,
    stepAt,
    linAt,
    applyStroke,
    pavaDown,
    project,
    drawnShare,
    hatAdjust,
    trapMean,
    curveScore,
    pointScore,
    bandScore,
  };
  if (typeof module === "object" && module.exports) {
    module.exports = math;
    return;
  }

  /* ---------- browser component ---------- */
  const A = root.CausalAnim,
    { el, html, tween, ease } = A,
    f = (x, d = 2) => (Number.isFinite(x) ? Number(x.toFixed(d)).toString() : "—");

  function unitId() {
    return document.body?.dataset.lesson || "course";
  }
  function load(id) {
    try {
      const s = root.Causality?.state?.();
      const v = s?.forms?.[unitId()]?.["guess:" + id];
      if (v) return v;
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("causality.guess." + unitId() + "." + id) || "null");
    } catch {
      return null;
    }
  }
  function save(id, value) {
    // Form data only: a guess is never an exercise, so it can never count as a transfer check.
    try {
      if (root.Causality?.event && root.Causality.state) {
        const unit = unitId(),
          prev = root.Causality.state().forms?.[unit] || {};
        root.Causality.event({ type: "form", unit, value: { ...prev, ["guess:" + id]: value } });
        return;
      }
    } catch {}
    try {
      localStorage.setItem("causality.guess." + unitId() + "." + id, JSON.stringify(value));
    } catch {}
  }

  let counter = 0;
  function mount(container, opts) {
    const o = {
      kind: "curve",
      xDomain: [0, 1],
      yDomain: [0, 1],
      samples: 121,
      handles: 6,
      tolerance: 0.05,
      spanWord: "of the range",
      truthLabel: "Truth",
      truthName: null,
      truthColor: "var(--green)",
      guessColor: "var(--ink)",
      xFormat: (v) => f(v, 2),
      yFormat: (v) => f(v, 2),
      ...opts,
    };
    const survival = o.kind === "survival",
      curve = survival || o.kind === "curve",
      id = o.id || "g" + ++counter,
      [x0, x1] = o.xDomain,
      [y0, y1] = o.yDomain,
      xs = grid(x0, x1, o.samples),
      anchor = o.anchor ?? (survival ? y1 : undefined),
      series = curve
        ? o.series || [{ id: "y", label: o.yLabel || "Your curve", color: o.guessColor }]
        : [],
      proj = { monotone: survival || o.monotone, lo: y0, hi: y1, anchor },
      diffFmt = o.diffFormat || o.yFormat,
      tName = o.truthName || o.truthLabel.toLowerCase(),
      valueFmt = o.valueFormat || o.xFormat;
    const st = {
      active: 0,
      raw: Object.fromEntries(series.map((s) => [s.id, new Array(o.samples).fill(null)])),
      value: (typeof o.initial === "number" ? o.initial : (x0 + x1) / 2),
      band: Array.isArray(o.initial) ? [...o.initial] : [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7],
      touched: {},
      revealed: false,
      truth: null,
      result: null,
    };

    /* DOM scaffold */
    const box = html("div", { class: "guess", "data-guess": id, "data-kind": o.kind });
    const head = html("div", { class: "guess-label" }, "Draw your guess");
    const prompt = html("p", { class: "guess-prompt", id: "guess-prompt-" + id }, o.prompt || "");
    box.append(head, prompt);
    let toggle = null;
    if (series.length > 1) {
      toggle = html("div", { class: "guess-series", role: "group", "aria-label": "Which curve you are drawing" });
      toggle.append(html("span", { class: "guess-series-lab" }, "Drawing:"));
      series.forEach((s, i) => {
        const b = html("button", { type: "button", "data-series": s.id, "aria-pressed": String(i === 0) });
        b.style.setProperty("--c", s.color);
        b.append(html("i", { "aria-hidden": "true" }), s.label);
        b.onclick = () => setActive(i, true);
        toggle.append(b);
      });
      box.append(toggle);
    }
    const svg = el("svg", {
      class: "guess-svg",
      role: "group",
      "aria-labelledby": "guess-prompt-" + id,
      "aria-describedby": "guess-help-" + id,
    });
    const help = html(
      "p",
      { class: "guess-help", id: "guess-help-" + id },
      curve
        ? "Press and drag across the plot to sketch. Keyboard: Tab to a handle, Up and Down arrows move it, Left and Right move between handles."
        : o.kind === "point"
          ? "Drag the marker or tap the line. Keyboard: Tab to the marker, then use the arrow keys (Page Up and Page Down for larger steps)."
          : "Drag either end, or drag the middle to slide the whole interval. Keyboard: Tab to an end, then use the arrow keys.",
    );
    const legend = html("p", { class: "guess-legend", "aria-hidden": "true" });
    const btns = html("div", { class: "guess-btns" });
    const reveal = html("button", { type: "button", class: "primary guess-reveal" }, "Reveal");
    const clear = html("button", { type: "button", class: "guess-clear" }, curve ? "Clear sketch" : "Reset guess");
    btns.append(reveal, clear);
    const status = html("p", { class: "guess-status", role: "status", "aria-live": "polite" });
    const result = html("div", { class: "guess-result", "aria-live": "polite" });
    box.append(svg, help, legend, btns, status, result);
    container.append(box);

    /* Veil: blur the lesson's own answer until the guess is revealed (click a veiled element to skip). */
    const veiled = (typeof o.veil === "function" ? o.veil() : o.veil || []).filter(Boolean);
    const unveil = () =>
      veiled.forEach((v) => {
        v.classList.remove("guess-veiled");
        v.removeAttribute("title");
      });
    veiled.forEach((v) => {
      v.classList.add("guess-veiled");
      v.title = "Blurred until you reveal your guess. Click to show it now.";
      v.addEventListener("click", unveil, { once: true });
    });

    let P = null,
      L = {},
      W = 0;
    const placeholder = () => new Array(o.samples).fill(anchor ?? (y0 + y1) / 2);
    const values = (sid) => (st.touched[sid] && project(st.raw[sid], proj)) || placeholder();
    const handleXs = () => {
      const K = o.handles;
      return Array.from({ length: K }, (_, k) => x0 + ((x1 - x0) * (k + (anchor === undefined ? 0 : 1))) / (anchor === undefined ? K - 1 : K));
    };
    let focusIdx = 0;

    function svgWidth() {
      const w = svg.getBoundingClientRect().width || box.clientWidth - 30 || container.clientWidth || 600;
      return Math.round(clamp(w, 260, 1200));
    }
    function layout() {
      // One viewBox unit per CSS pixel, so figure text is 13px at every width.
      W = svgWidth();
      const phone = W < 480;
      const H = curve ? (phone ? 300 : 340) : o.kind === "point" ? 172 : 196;
      const margin = curve
        ? { l: 52, r: series.length > 1 ? (phone ? 86 : 120) : 70, t: 28, b: 46, ...(o.margin || {}) }
        : { l: 18, r: 22, t: 36, b: 48, ...(o.margin || {}) };
      if (!curve && o.marginPhone && phone) Object.assign(margin, o.marginPhone);
      P = new A.Plot(svg, {
        x: [x0, x1],
        y: curve ? [y0, y1] : [0, 1],
        width: W,
        height: H,
        margin,
        xlabel: o.xLabel,
        ylabel: curve ? o.yLabel : undefined,
        xticks: o.xTicks ? o.xTicks(phone) : undefined,
        yticks: curve ? o.yTicks : [],
        grid: curve,
        xTickFormat: o.xTickFormat || o.xFormat,
        yTickFormat: o.yTickFormat || o.yFormat,
      });
      svg.classList.remove("fig", "fig-wide", "fig-narrow");
      // A number line needs no vertical axis.
      if (!curve) svg.querySelectorAll(".fig-axes line.axis")[1]?.remove();
      svg.style.touchAction = "none";
      L = {};
      for (const k of ["bg", "gap", "place", "pen", "truth", "handles", "labels"]) L[k] = P.layer("guess-" + k);
      // Plot area as a hit target so strokes can start anywhere inside it.
      L.bg.append(
        el("rect", {
          class: "guess-hit",
          x: P.m.l,
          y: P.m.t,
          width: P.W - P.m.l - P.m.r,
          height: P.H - P.m.t - P.m.b,
          fill: "transparent",
        }),
      );
      if (o.background) o.background(svg, P, L.bg);
      draw();
    }

    /* ---------- drawing ---------- */
    const pathD = (vals) => P.d(vals.map((v, i) => [xs[i], v]));
    /* Keep a centred label inside the plot's horizontal extent. */
    function fitText(node, cx) {
      let w = 0;
      try {
        w = node.getComputedTextLength();
      } catch {}
      if (!w) w = String(node.textContent).length * 7.8;
      node.setAttribute("x", clamp(cx, P.m.l + w / 2, P.W - P.m.r - w / 2));
      return node;
    }
    function stepD(points) {
      const pts = points.filter((p) => p[0] <= x1);
      let d = "";
      pts.forEach((p, i) => {
        const X = f(P.sx(p[0]), 2),
          Y = f(P.sy(clamp(p[1], y0, y1)), 2);
        d += i ? ` H${X} V${Y}` : `M${X},${Y}`;
      });
      return d + ` H${f(P.sx(x1), 2)}`;
    }
    const truthCurve = (sid) => {
      const t = st.truth[sid];
      return typeof t === "function" ? xs.map(t) : xs.map((x) => (o.truthStep ?? survival ? stepAt(t, x) : linAt(t, x)));
    };

    function drawCurve() {
      L.place.replaceChildren();
      L.pen.replaceChildren();
      L.handles.replaceChildren();
      L.labels.replaceChildren();
      const ends = [];
      series.forEach((s, si) => {
        const v = values(s.id),
          on = si === st.active && !st.revealed;
        if (!st.touched[s.id])
          L.place.append(el("path", { d: pathD(v), fill: "none", stroke: s.color, "stroke-width": 2, "stroke-dasharray": "2 6", "stroke-linecap": "round", opacity: 0.8 }));
        else
          L.pen.append(
            el("path", { class: "guess-pen-line", "data-series": s.id, d: pathD(v), fill: "none", stroke: s.color, "stroke-width": st.revealed ? 5 : on ? 5 : 4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: st.revealed ? 0.4 : on ? 0.62 : 0.4 }),
          );
        ends.push({ y: v[v.length - 1], text: s.label + (st.revealed ? "" : st.touched[s.id] ? "" : " ?"), fill: s.color, you: true });
      });
      if (st.revealed && st.truth) {
        ends.length = 0;
        series.forEach((s) => {
          const t = truthCurve(s.id);
          ends.push({ y: t[t.length - 1], text: s.label, value: o.yFormat(t[t.length - 1]), fill: s.color });
        });
      }
      // End labels outside the plot, nudged apart so they never overlap.
      const twoLine = P.W < 480;
      ends.forEach((e) => (e.py = P.sy(e.y) + 4 - (twoLine && e.value ? 8 : 0)));
      ends.sort((a, b) => a.py - b.py);
      for (let i = 1; i < ends.length; i++) ends[i].py = Math.max(ends[i].py, ends[i - 1].py + (twoLine && ends[i - 1].value ? 34 : 17));
      const lastEnd = ends[ends.length - 1],
        over = lastEnd ? lastEnd.py + (twoLine && lastEnd.value ? 16 : 0) - (P.H - P.m.b + 4) : 0;
      if (over > 0) ends.forEach((e) => (e.py -= over));
      ends.forEach((e) => {
        const x = P.sx(x1) + 8;
        if (!e.value) return L.labels.append(el("text", { class: "guess-text", x, y: e.py, fill: e.fill }, e.text));
        L.labels.append(
          twoLine
            ? el("text", { class: "guess-text", x, y: e.py, fill: e.fill }, el("tspan", { x }, e.text), el("tspan", { x, dy: 16 }, e.value))
            : el("text", { class: "guess-text", x, y: e.py, fill: e.fill }, `${e.text} ${e.value}`),
        );
      });
      if (!st.revealed) {
        if (!series.some((s) => st.touched[s.id]))
          L.labels.append(
            el("text", { class: "guess-hint", x: (P.m.l + P.W - P.m.r) / 2, y: P.m.t + (P.H - P.m.t - P.m.b) * 0.62, "text-anchor": "middle" }, "Press and drag to draw"),
          );
        const s = series[st.active],
          v = values(s.id),
          hx = handleXs();
        hx.forEach((x, k) => {
          const y = linAt(v.map((y, i) => [xs[i], y]), x);
          const g = el("g", {
            class: "guess-handle",
            tabindex: k === focusIdx ? 0 : -1,
            role: "slider",
            "aria-label": `${s.label} curve: ${o.yLabel || "value"} at ${o.xFormat(x)}`,
            "aria-valuemin": f(y0, 3),
            "aria-valuemax": f(y1, 3),
            "aria-valuenow": f(y, 3),
            "aria-valuetext": o.yFormat(y),
            "data-k": k,
            transform: `translate(${f(P.sx(x), 2)},${f(P.sy(y), 2)})`,
          });
          g.append(
            el("circle", { class: "ring", r: 11, fill: "none" }),
            el("circle", { r: 16, fill: "transparent" }),
            el("circle", { class: "dot", r: 5.5, fill: s.color, stroke: "var(--paper)", "stroke-width": 2 }),
          );
          L.handles.append(g);
        });
      }
      legend.innerHTML = st.revealed
        ? `<span><i class="sw pen"></i>your sketch (wide, pale)</span><span><i class="sw solid"></i>${o.truthLabel} (thin, solid)</span><span><i class="sw area"></i>gap between them</span>`
        : series.length > 1
          ? series.map((s) => `<span style="color:${s.color}"><i class="sw solid" style="background:${s.color}"></i>${s.label}</span>`).join("")
          : "";
    }

    function drawPoint() {
      L.pen.replaceChildren();
      L.handles.replaceChildren();
      L.labels.replaceChildren();
      const yT = P.sy(0.58);
      L.pen.append(el("line", { class: "guess-track", x1: P.sx(x0), x2: P.sx(x1), y1: yT, y2: yT }));
      const X = P.sx(st.value),
        g = el("g", {
          class: "guess-handle",
          tabindex: st.revealed ? -1 : 0,
          role: "slider",
          "aria-label": o.pointLabel || "Your guess",
          "aria-valuemin": x0,
          "aria-valuemax": x1,
          "aria-valuenow": f(st.value, 4),
          "aria-valuetext": valueFmt(st.value),
          transform: `translate(${f(X, 2)},${f(yT, 2)})`,
        });
      g.append(
        el("circle", { class: "ring", r: 15, fill: "none" }),
        el("circle", { r: 20, fill: "transparent" }),
        el("circle", { class: "dot", r: 9, fill: o.guessColor, stroke: "var(--paper)", "stroke-width": 2.5, opacity: st.touched.v ? 1 : 0.55 }),
      );
      L.handles.append(g);
      const lab = `${st.touched.v ? "you" : "drag me"}: ${valueFmt(st.value)}`;
      fitText(L.labels.appendChild(el("text", { class: "guess-text ink", x: X, y: yT - 18, "text-anchor": "middle" }, lab)), X);
      legend.textContent = "";
    }

    function drawBand() {
      L.pen.replaceChildren();
      L.handles.replaceChildren();
      L.labels.replaceChildren();
      const yR = P.sy(o.bandY ?? 0.45),
        [lo, hi] = st.band;
      L.pen.append(
        el("line", { x1: P.sx(lo), x2: P.sx(hi), y1: yR, y2: yR, stroke: o.guessColor, "stroke-width": 16, "stroke-linecap": "butt", opacity: st.touched.v ? 0.32 : 0.18 }),
      );
      if (o.bandLabel)
        L.labels.append(el("text", { class: "guess-text ink", x: P.m.l - 10, y: yR + 5, "text-anchor": "end" }, o.bandLabel));
      [lo, hi].forEach((v, k) => {
        const g = el("g", {
          class: "guess-handle",
          tabindex: st.revealed ? -1 : 0,
          role: "slider",
          "aria-label": k ? "Upper end of your interval" : "Lower end of your interval",
          "aria-valuemin": x0,
          "aria-valuemax": x1,
          "aria-valuenow": f(v, 3),
          "aria-valuetext": valueFmt(v),
          "data-k": k,
          transform: `translate(${f(P.sx(v), 2)},${f(yR, 2)})`,
        });
        g.append(
          el("circle", { class: "ring", r: 14, fill: "none" }),
          el("circle", { r: 19, fill: "transparent" }),
          el("rect", { class: "dot", x: -4, y: -13, width: 8, height: 26, rx: 3, fill: o.guessColor, stroke: "var(--paper)", "stroke-width": 1.5 }),
        );
        L.handles.append(g);
      });
      const mid = P.sx((lo + hi) / 2);
      fitText(L.labels.appendChild(el("text", { class: "guess-text", x: mid, y: yR - 20, "text-anchor": "middle" }, `${st.touched.v ? "your width" : "drag the ends"}: ${valueFmt(hi - lo)}`)), mid);
      legend.textContent = "";
    }

    function draw() {
      if (curve) drawCurve();
      else if (o.kind === "point") drawPoint();
      else drawBand();
      if (st.revealed && st.truth !== null) drawTruth(false);
      else {
        L.truth.replaceChildren();
        L.gap.replaceChildren();
      }
      const fh = svg.querySelector(`.guess-handle[tabindex="0"]`);
      if (restoreFocus && fh) fh.focus({ preventScroll: true });
      restoreFocus = false;
      reveal.disabled = st.revealed;
      clear.textContent = st.revealed ? "Try again" : curve ? "Clear sketch" : "Reset guess";
      if (toggle)
        toggle.querySelectorAll("button").forEach((b, i) => {
          b.setAttribute("aria-pressed", String(i === st.active));
          b.disabled = st.revealed;
        });
    }
    let restoreFocus = false;

    /* ---------- truth: animated draw-on, gap shading, score ---------- */
    function drawOn(path, delay, ms) {
      let len = 0;
      try {
        len = path.getTotalLength();
      } catch {}
      if (!len) len = 2000;
      path.style.strokeDasharray = `${len} ${len}`;
      path.style.strokeDashoffset = len;
      return new Promise((res) =>
        setTimeout(
          () =>
            tween({
              duration: ms,
              ease: ease.inOut,
              onUpdate: (u) => (path.style.strokeDashoffset = len * (1 - u)),
              onDone: () => {
                path.style.strokeDasharray = "";
                path.style.strokeDashoffset = "";
                res();
              },
            }),
          A.reduced() ? 0 : delay,
        ),
      );
    }
    const fadeIn = (node, ms = 450) =>
      tween({ duration: ms, onUpdate: (u) => node.setAttribute("opacity", u) });

    function drawTruth(animate) {
      L.truth.replaceChildren();
      L.gap.replaceChildren();
      const jobs = [],
        gaps = [];
      if (curve) {
        series.forEach((s, si) => {
          const g = values(s.id),
            t = truthCurve(s.id),
            poly = xs.map((x, i) => `${f(P.sx(x), 2)},${f(P.sy(g[i]), 2)}`).concat(xs.map((x, i) => `${f(P.sx(x), 2)},${f(P.sy(t[i]), 2)}`).reverse());
          const area = el("polygon", { class: "guess-gap", points: poly.join(" "), fill: s.color, "fill-opacity": 0.2, stroke: "none", opacity: animate ? 0 : 1 });
          L.gap.append(area);
          gaps.push(area);
          const raw = st.truth[s.id],
            d = Array.isArray(raw) && (o.truthStep ?? survival) ? stepD(raw) : pathD(t);
          const p = el("path", { class: "guess-truth-line", d, fill: "none", stroke: s.color, "stroke-width": 2.5, "stroke-linejoin": "round" });
          L.truth.append(p);
          if (animate) jobs.push(drawOn(p, si * 180, 1100));
        });
      } else if (o.kind === "point") {
        const t = st.truth,
          yT = P.sy(0.58),
          X = P.sx(t),
          a = Math.min(P.sx(st.value), X),
          b = Math.max(P.sx(st.value), X);
        const area = el("rect", { class: "guess-gap", x: a, y: yT - 8, width: Math.max(0, b - a), height: 16, fill: o.truthColor, "fill-opacity": 0.22, opacity: animate ? 0 : 1 });
        L.gap.append(area);
        gaps.push(area);
        const line = el("path", { d: `M${f(X, 2)},${f(P.m.t - 6, 2)} V${f(P.H - P.m.b, 2)}`, stroke: o.truthColor, "stroke-width": 2.5, fill: "none" });
        const dia = el("path", { d: `M${f(X, 2)},${f(yT - 9, 2)} l9,9 l-9,9 l-9,-9 Z`, fill: o.truthColor, stroke: "var(--paper)", "stroke-width": 2, opacity: animate ? 0 : 1, class: "guess-dia" });
        const lab = el("text", { class: "guess-text", x: X, y: yT + 30, "text-anchor": "middle", fill: o.truthColor, opacity: animate ? 0 : 1 }, `${o.truthShort || o.truthLabel}: ${valueFmt(t)}`);
        L.truth.append(line, dia, lab);
        fitText(lab, X);
        if (animate) jobs.push(drawOn(line, 0, 700).then(() => (fadeIn(dia, 250), fadeIn(lab, 300))));
      } else {
        const [tl, th] = st.truth,
          yR = P.sy(o.bandY ?? 0.45),
          [gl, gh] = st.band,
          segs = [];
        // Symmetric difference: stretches in one interval but not the other.
        if (gl < tl) segs.push([gl, Math.min(gh, tl)]);
        if (tl < gl) segs.push([tl, Math.min(th, gl)]);
        if (gh > th) segs.push([Math.max(gl, th), gh]);
        if (th > gh) segs.push([Math.max(tl, gh), th]);
        segs.forEach(([a, b]) => {
          if (b <= a) return;
          const r = el("rect", { class: "guess-gap", x: P.sx(a), y: yR - 11, width: P.sx(b) - P.sx(a), height: 22, fill: "url(#guess-hatch-" + id + ")", opacity: animate ? 0 : 1 });
          L.gap.append(r);
          gaps.push(r);
        });
        L.gap.prepend(
          el("defs", {}, el("pattern", { id: "guess-hatch-" + id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, el("rect", { width: 6, height: 6, fill: o.truthColor, "fill-opacity": 0.12 }), el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: o.truthColor, "stroke-width": 2, "stroke-opacity": 0.55 }))),
        );
        const c = (tl + th) / 2,
          bar = el("line", { x1: P.sx(animate ? c : tl), x2: P.sx(animate ? c : th), y1: yR, y2: yR, stroke: o.truthColor, "stroke-width": 5, "stroke-linecap": "round" }),
          lab = el("text", { class: "guess-text", x: P.sx(c), y: yR + 32, "text-anchor": "middle", fill: o.truthColor, opacity: animate ? 0 : 1 }, `${o.truthShort || o.truthLabel}: ${valueFmt(th - tl)}`);
        L.truth.append(bar, lab);
        fitText(lab, P.sx(c));
        if (animate)
          jobs.push(
            new Promise((res) =>
              tween({
                duration: 900,
                onUpdate: (u) => {
                  bar.setAttribute("x1", P.sx(c + (tl - c) * u));
                  bar.setAttribute("x2", P.sx(c + (th - c) * u));
                },
                onDone: () => (fadeIn(lab, 300), res()),
              }),
            ),
          );
      }
      return Promise.all(jobs).then(() => gaps.forEach((g) => animate && fadeIn(g)));
    }

    function scoreNow() {
      if (curve) {
        const per = series.map((s) => ({ id: s.id, label: s.label, ...curveScore(values(s.id), truthCurve(s.id), xs, o.tolerance) }));
        const within = per.reduce((a, r) => a + r.within, 0) / per.length,
          meanAbs = per.reduce((a, r) => a + r.meanAbs, 0) / per.length;
        const tolTxt = o.tolText || diffFmt(o.tolerance);
        const text =
          per.length === 1
            ? `Your curve was within ${tolTxt} of the ${tName} over ${f(per[0].within * 100, 0)}% ${o.spanWord}.`
            : `Within ${tolTxt} of the ${tName} over ${f(within * 100, 0)}% ${o.spanWord}: ` +
              per.map((r) => `${r.label.toLowerCase()} ${f(r.within * 100, 0)}%`).join(", ") +
              `. Average gap ${diffFmt(meanAbs)}.`;
        return { kind: o.kind, series: per, within, meanAbs, text };
      }
      if (o.kind === "point") {
        const s = pointScore(st.value, st.truth, x1 - x0);
        return { kind: "point", ...s, text: `You guessed ${valueFmt(s.guess)}; ${tName} is ${valueFmt(s.truth)}, ${o.diffFormat ? o.diffFormat(s.absError) : valueFmt(s.absError)} ${s.error > 0 ? "too high" : s.error < 0 ? "too low" : "away"}.` };
      }
      const s = bandScore(st.band, st.truth);
      const wErr = s.widthError;
      return {
        kind: "band",
        ...s,
        text: `Your interval was ${valueFmt(s.widthGuess)} wide; ${tName} is ${valueFmt(s.widthTruth)} wide, so your width was ${Math.abs(wErr) < 0.005 ? "spot on" : f(Math.abs(wErr) * 100, 0) + "% too " + (wErr > 0 ? "wide" : "narrow")}. The two overlap on ${f(s.overlap * 100, 0)}% of their combined length.`,
      };
    }
    function defaultFeedback(r) {
      const q = r.kind === "point" ? 1 - r.relError * 5 : r.kind === "band" ? r.overlap : r.within;
      return q >= 0.8
        ? "Close: your intuition matched what the data do."
        : q >= 0.5
          ? "Partly there: the shaded gap shows where your picture and the data part ways."
          : "The shaded gap is the lesson: it marks where intuition and the data disagree.";
    }
    function showResult(r, animate) {
      result.replaceChildren(
        html("p", { class: "guess-score" }, r.text),
        html("p", { class: "guess-feedback" }, (o.feedback ? o.feedback(r, st) : null) || defaultFeedback(r)),
      );
      if (animate && !A.reduced()) {
        result.classList.remove("guess-pop");
        void result.offsetWidth;
        result.classList.add("guess-pop");
      }
    }

    function snapshot() {
      const r3 = (v) => (v === null ? null : Math.round(v * 1e4) / 1e4);
      return {
        kind: o.kind,
        touched: st.touched,
        raw: curve ? Object.fromEntries(series.map((s) => [s.id, st.raw[s.id].map(r3)])) : undefined,
        value: o.kind === "point" ? r3(st.value) : undefined,
        band: o.kind === "band" ? st.band.map(r3) : undefined,
        revealed: st.revealed,
        score: st.result ? (curve ? r3(st.result.within) : o.kind === "point" ? r3(st.result.absError) : r3(st.result.overlap)) : undefined,
      };
    }
    let saveTimer = null;
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => save(id, snapshot()), 250);
    };

    async function doReveal(animate = true) {
      const untouched = curve ? series.filter((s) => !st.touched[s.id]) : st.touched.v ? [] : [1];
      if (animate && untouched.length) {
        status.textContent = curve
          ? `Sketch ${untouched.map((s) => "the " + s.label.toLowerCase() + " curve").join(" and ")} first, then reveal.`
          : o.kind === "point"
            ? "Move the marker to your guess first, then reveal."
            : "Drag the ends to your guess first, then reveal.";
        if (curve) setActive(series.indexOf(untouched[0]), false);
        return;
      }
      reveal.disabled = true;
      status.textContent = "Revealing…";
      let t;
      try {
        t = await Promise.resolve(o.truth());
      } catch (e) {
        status.textContent = "The answer could not be computed: " + e.message;
        reveal.disabled = false;
        return;
      }
      st.truth = curve && series.length === 1 && Array.isArray(t) ? { [series[0].id]: t } : t;
      st.revealed = true;
      st.result = scoreNow();
      draw();
      L.truth.replaceChildren();
      L.gap.replaceChildren();
      const done = drawTruth(animate);
      status.textContent = "";
      await done;
      showResult(st.result, animate);
      unveil();
      box.classList.add("is-revealed");
      o.onReveal?.(st.result);
      if (animate) persist();
    }

    function resetGuess() {
      if (st.revealed) {
        st.revealed = false;
        st.truth = null;
        st.result = null;
        result.replaceChildren();
        box.classList.remove("is-revealed");
      } else {
        st.touched = {};
        series.forEach((s) => st.raw[s.id].fill(null));
        st.value = (typeof o.initial === "number" ? o.initial : (x0 + x1) / 2);
        st.band = Array.isArray(o.initial) ? [...o.initial] : [x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7];
        st.active = 0;
      }
      status.textContent = "";
      draw();
      persist();
    }
    reveal.onclick = () => doReveal(true);
    clear.onclick = resetGuess;

    function setActive(i, fromToggle) {
      st.active = i;
      focusIdx = Math.min(focusIdx, o.handles - 1);
      draw();
      if (fromToggle) status.textContent = `Now drawing the ${series[i].label.toLowerCase()} curve.`;
    }

    /* ---------- pointer input ---------- */
    const toData = (e) => {
      const r = svg.getBoundingClientRect(),
        px = ((e.clientX - r.left) * P.W) / r.width,
        py = ((e.clientY - r.top) * P.H) / r.height,
        fx = (px - P.m.l) / (P.W - P.m.l - P.m.r),
        fy = (P.H - P.m.b - py) / (P.H - P.m.t - P.m.b);
      return { x: clamp(x0 + fx * (x1 - x0), x0, x1), y: clamp(y0 + fy * (y1 - y0), y0, y1), u: clamp(P.y[0] + fy * (P.y[1] - P.y[0]), 0, 1), px };
    };
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (st.revealed || e.button > 0) return;
      const d = toData(e),
        h = e.target.closest?.(".guess-handle");
      e.preventDefault();
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {}
      if (curve) {
        const sid = series[st.active].id;
        if (h) {
          focusIdx = +h.dataset.k;
          drag = { type: "handle", k: focusIdx, sid };
        } else {
          drag = { type: "stroke", sid, stroke: [[d.x, d.y]] };
          st.raw[sid] = applyStroke(st.raw[sid], xs, drag.stroke);
          st.touched[sid] = true;
        }
      } else if (o.kind === "point") {
        drag = { type: "point" };
        st.value = snapValue(d.x);
        st.touched.v = true;
      } else {
        const [lo, hi] = st.band,
          dl = Math.abs(P.sx(lo) - d.px),
          dh = Math.abs(P.sx(hi) - d.px);
        if (Math.min(dl, dh) <= 22 || d.x < lo || d.x > hi) {
          const k = dl <= dh ? 0 : 1;
          drag = { type: "end", k };
          setBandEnd(k, d.x);
        } else drag = { type: "slide", from: d.x, band: [lo, hi] };
        st.touched.v = true;
      }
      draw();
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const d = toData(e);
      if (drag.type === "stroke") {
        drag.stroke.push([d.x, d.y]);
        st.raw[drag.sid] = applyStroke(st.raw[drag.sid], xs, drag.stroke.slice(-2));
      } else if (drag.type === "handle") {
        const hx = handleXs()[drag.k],
          v = values(drag.sid),
          cur = linAt(v.map((y, i) => [xs[i], y]), hx);
        nudge(drag.sid, drag.k, d.y - cur);
      } else if (drag.type === "point") st.value = snapValue(d.x);
      else if (drag.type === "end") setBandEnd(drag.k, d.x);
      else if (drag.type === "slide") {
        const w = drag.band[1] - drag.band[0],
          lo = clamp(drag.band[0] + d.x - drag.from, x0, x1 - w);
        st.band = [lo, lo + w].map(snapValue);
      }
      draw();
    });
    const endDrag = () => {
      if (!drag) return;
      if (drag.type === "stroke" && series.length > 1) {
        const share = drawnShare(st.raw[drag.sid]),
          next = series.findIndex((s) => !st.touched[s.id]);
        if (share > 0.6 && next >= 0) {
          st.active = next;
          status.textContent = `Now sketch the ${series[next].label.toLowerCase()} curve (or switch back with the buttons above).`;
        }
      }
      if (drag.type === "stroke") {
        const v = project(st.raw[drag.sid], proj);
        if (v) st.raw[drag.sid] = v.map((y, i) => (st.raw[drag.sid][i] === null ? null : y));
        else st.touched[drag.sid] = false;
      }
      drag = null;
      draw();
      persist();
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("lostpointercapture", endDrag);

    const snapValue = (v) => {
      const s = o.snap || 0;
      return clamp(s ? Math.round(v / s) * s : v, x0, x1);
    };
    function setBandEnd(k, v) {
      v = snapValue(v);
      const b = st.band.slice();
      b[k] = v;
      if (b[0] > b[1]) {
        b.reverse();
        if (drag) drag.k = 1 - k;
      }
      st.band = b;
    }
    function nudge(sid, k, delta) {
      if (!st.touched[sid]) {
        st.raw[sid] = values(sid).slice();
        st.touched[sid] = true;
      }
      const hx = handleXs(),
        half = (x1 - x0) / o.handles,
        base = values(sid);
      const next = hatAdjust(base, xs, hx[k], half, delta).map((v) => clamp(v, y0, y1));
      // Keep the whole curve as drawn data so the projection acts on everything.
      st.raw[sid] = project(next, proj);
    }

    /* ---------- keyboard ---------- */
    svg.addEventListener("keydown", (e) => {
      const h = e.target.closest?.(".guess-handle");
      if (!h || st.revealed) return;
      const big = e.shiftKey || e.key === "PageUp" || e.key === "PageDown";
      let used = true;
      if (curve) {
        const sid = series[st.active].id,
          step = (o.yStep || (y1 - y0) / 50) * (big ? 5 : 1);
        if (e.key === "ArrowUp" || e.key === "PageUp") nudge(sid, focusIdx, step);
        else if (e.key === "ArrowDown" || e.key === "PageDown") nudge(sid, focusIdx, -step);
        else if (e.key === "ArrowRight") focusIdx = Math.min(o.handles - 1, focusIdx + 1);
        else if (e.key === "ArrowLeft") focusIdx = Math.max(0, focusIdx - 1);
        else if (e.key === "Home") focusIdx = 0;
        else if (e.key === "End") focusIdx = o.handles - 1;
        else used = false;
      } else {
        const step = (o.step || (x1 - x0) / 100) * (big ? 10 : 1),
          up = e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "PageUp",
          down = e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "PageDown";
        if (!up && !down && e.key !== "Home" && e.key !== "End") used = false;
        else if (o.kind === "point") {
          st.value = e.key === "Home" ? x0 : e.key === "End" ? x1 : snapValue(st.value + (up ? step : -step));
          st.touched.v = true;
        } else {
          const k = +h.dataset.k;
          setBandEnd(k, e.key === "Home" ? x0 : e.key === "End" ? x1 : st.band[k] + (up ? step : -step));
          st.touched.v = true;
          restoreK = k;
        }
      }
      if (!used) return;
      e.preventDefault();
      restoreFocus = true;
      draw();
      if (o.kind === "band" && restoreK !== null) {
        svg.querySelectorAll(".guess-handle")[restoreK]?.focus({ preventScroll: true });
        restoreK = null;
      }
      persist();
    });
    let restoreK = null;

    /* ---------- restore, lay out, keep in sync with the container width ---------- */
    const saved = load(id);
    if (saved && saved.kind === o.kind) {
      if (curve && saved.raw)
        series.forEach((s) => {
          if (Array.isArray(saved.raw[s.id]) && saved.raw[s.id].length === o.samples) st.raw[s.id] = saved.raw[s.id].slice();
        });
      if (saved.value !== undefined && saved.value !== null) st.value = saved.value;
      if (Array.isArray(saved.band)) st.band = saved.band.slice();
      st.touched = { ...(saved.touched || {}) };
    }
    layout();
    if (saved?.revealed) doReveal(false);
    let lastW = W;
    if (root.ResizeObserver)
      new ResizeObserver(() => {
        const w = svgWidth();
        if (Math.abs(w - lastW) > 4 && container.clientWidth) {
          lastW = w;
          layout();
        }
      }).observe(container);

    return {
      el: box,
      reveal: () => doReveal(true),
      reset: resetGuess,
      get state() {
        return { ...st };
      },
      /* For tests and scripted demos: set a whole sketch at once. */
      sketch(sid, fn) {
        st.raw[sid] = xs.map(fn);
        st.touched[sid] = true;
        draw();
      },
    };
  }

  root.CausalGuess = { ...math, mount };
})(typeof window !== "undefined" ? window : globalThis);
