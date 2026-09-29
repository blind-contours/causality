/* Rendering utilities and legacy canvas access. Camera/playback are view state. */
(function () {
  const NS = "http://www.w3.org/2000/svg",
    labels = new WeakMap(),
    oldFill = CanvasRenderingContext2D.prototype.fillText,
    oldMeasure = CanvasRenderingContext2D.prototype.measureText,
    oldClear = CanvasRenderingContext2D.prototype.clearRect,
    oldGetContext = HTMLCanvasElement.prototype.getContext;
  /* Smallest on-screen text size (CSS px) a canvas may show. */
  const FLOOR = 11;
  const logical = (cv) => ({
    w: +cv.dataset.w || cv.width,
    h: +cv.dataset.h || cv.height,
  });
  const dprOf = () => Math.min(2, window.devicePixelRatio || 1);
  /* Drawing code works in the canvas's declared width/height. The backing store is scaled to the
   * device pixel ratio for crisp output. How the element meets its column is decided by layout():
   *   native  the column is at least as wide as the drawing;
   *   fit     the drawing scales down to the column and its smallest text stays >= 11 CSS px;
   *   stack   (phones) a canvas that declares data-panels="x0 y0 x1 y1, ..." (drawing coordinates)
   *           has those panels drawn one above the other at the column's width, with text raised to
   *           at least 11 CSS px; only canvases drawn through scene() can stack;
   *   scroll  otherwise, the drawing shrinks to no less than 80% of its size and scrolls sideways. */
  function fit(cv) {
    if (cv.dataset.fitted || !cv.isConnected) return;
    const w = +cv.getAttribute("width") || cv.width,
      h = +cv.getAttribute("height") || cv.height,
      dpr = dprOf();
    cv.dataset.w = w;
    cv.dataset.h = h;
    cv.dataset.fitted = "1";
    if (dpr !== 1) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    cv.style.width = "100%";
    cv.style.height = "auto";
    cv.style.minWidth = Math.round(w * 0.8) + "px";
    cv.style.aspectRatio = `${w} / ${h}`;
    oldGetContext.call(cv, "2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type === "2d") fit(this);
    return oldGetContext.call(this, type, ...rest);
  };
  const PX = /(\d+(?:\.\d+)?)px/;
  const fontPx = (font) => {
    const m = PX.exec(font || "");
    return m ? +m[1] : 10;
  };
  /* Run fn with the context's font raised to the canvas's floor (stack mode only). */
  function withFloor(ctx, fn) {
    const cv = ctx.canvas,
      want = fontPx(ctx.font);
    if (!cv || !(want < cv._floor)) return fn();
    const kept = ctx.font;
    ctx.font = kept.replace(PX, cv._floor.toFixed(2) + "px");
    try {
      return fn();
    } finally {
      ctx.font = kept;
    }
  }
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
    const cv = this.canvas;
    let rows = labels.get(cv);
    if (!rows) {
      rows = [];
      labels.set(cv, rows);
    }
    rows.push({ text: String(text), x, y });
    if (cv && cv.isConnected && String(text).trim()) {
      const size = fontPx(this.font);
      if (!(cv._minFont <= size)) {
        cv._minFont = size;
        if (cv._laidOut) requestAnimationFrame(() => layout(cv));
      }
    }
    return withFloor(this, () => oldFill.call(this, text, x, y, ...args));
  };
  CanvasRenderingContext2D.prototype.measureText = function (text) {
    return withFloor(this, () => oldMeasure.call(this, text));
  };
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (!this.canvas?._painting) labels.set(this.canvas, []);
    return oldClear.apply(this, args);
  };
  const oldRect = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    const size = logical(this.canvas);
    if (
      x === 0 &&
      y === 0 &&
      w === size.w &&
      h === size.h &&
      !this.canvas._painting
    )
      labels.set(this.canvas, []);
    return oldRect.call(this, x, y, w, h);
  };
  /* Canvas text with subscripts: "ψ(P_ε)" or "m_{a₀}(x₀)" draws the subscript small and low,
   * and records the flattened label ("ψ(Pε)") once for the figure transcript. */
  const SUB = /_\{([^}]*)\}|_([^\s_(){}\[\],.;:=+−\-])/g;
  function rich(g, text, x, y) {
    const s = String(text);
    if (!s.includes("_")) return g.fillText(s, x, y);
    const parts = [];
    let last = 0,
      m;
    SUB.lastIndex = 0;
    while ((m = SUB.exec(s))) {
      if (m.index > last) parts.push([s.slice(last, m.index), false]);
      parts.push([m[1] ?? m[2], true]);
      last = SUB.lastIndex;
    }
    if (last < s.length) parts.push([s.slice(last), false]);
    const cv = g.canvas,
      flat = parts.map((p) => p[0]).join("");
    let rows = labels.get(cv);
    if (!rows) labels.set(cv, (rows = []));
    rows.push({ text: flat, x, y });
    const base = g.font,
      size = fontPx(base),
      small = base.replace(PX, (size * 0.72).toFixed(2) + "px");
    if (cv && cv.isConnected && !(cv._minFont <= size)) {
      cv._minFont = size;
      if (cv._laidOut) requestAnimationFrame(() => layout(cv));
    }
    const align = g.textAlign,
      widths = parts.map(([t, sub]) => {
        g.font = sub ? small : base;
        return g.measureText(t).width;
      }),
      total = widths.reduce((a, b) => a + b, 0),
      drop = Math.max(size, cv?._floor || 0) * 0.32;
    let cx =
      align === "center"
        ? x - total / 2
        : align === "right" || align === "end"
          ? x - total
          : x;
    g.textAlign = "left";
    parts.forEach(([t, sub], i) => {
      g.font = sub ? small : base;
      withFloor(g, () => oldFill.call(g, t, cx, sub ? y + drop : y));
      cx += widths[i];
    });
    g.font = base;
    g.textAlign = align;
  }
  function panelsOf(cv) {
    const spec = cv.dataset.panels;
    if (!spec) return null;
    const gap = 10;
    let oy = 0;
    const list = spec
      .split(",")
      .map((s) => s.trim().split(/\s+/).map(Number))
      .filter((a) => a.length === 4 && a.every(Number.isFinite))
      .map(([x0, y0, x1, y1]) => {
        const p = { x0, y0, w: x1 - x0, h: y1 - y0, oy };
        oy += p.h + gap;
        return p;
      });
    if (!list.length) return null;
    return {
      list,
      w: Math.max(...list.map((p) => p.w)),
      h: oy - gap,
    };
  }
  /* Draw fn(W, H) in the canvas's current layout: once, or once per stacked panel. */
  function paint(cv, g, fn) {
    const { w, h } = logical(cv),
      st = cv._stack;
    if (!st) return fn(w, h);
    labels.set(cv, []);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    oldClear.call(g, 0, 0, cv.width, cv.height);
    g.restore();
    cv._painting = true;
    try {
      for (const p of st.list) {
        g.save();
        g.setTransform(st.k, 0, 0, st.k, -p.x0 * st.k, (p.oy - p.y0) * st.k);
        g.beginPath();
        g.rect(p.x0, p.y0, p.w, p.h);
        g.clip();
        fn(w, h);
        g.restore();
      }
    } finally {
      cv._painting = false;
    }
  }
  function layout(cv) {
    const vp = cv.parentElement;
    if (!vp || !vp.classList.contains("figure-viewport")) return;
    const cw = vp.clientWidth;
    if (!cw) return;
    cv._laidOut = true;
    const { w, h } = logical(cv),
      dpr = dprOf(),
      minF = cv._minFont || 12,
      panels = cv._redraw ? panelsOf(cv) : null;
    let mode;
    if (cw >= w) mode = "native";
    else if ((cw / w) * minF >= FLOOR) mode = "fit";
    else if (panels && cw < w * 0.8) mode = "stack";
    else mode = "scroll";
    const prev = cv.dataset.layout,
      prevK = cv._stack?.k;
    cv.dataset.layout = mode;
    if (mode === "stack") {
      const k = (cw * dpr) / panels.w;
      cv._stack = { ...panels, k };
      cv._floor = FLOOR / (cw / panels.w);
      cv.style.minWidth = "0";
      cv.style.aspectRatio = `${panels.w} / ${panels.h}`;
      cv.dataset.fontPx = (Math.max(minF, cv._floor) * (cw / panels.w)).toFixed(1);
      if (prev !== "stack" || Math.abs(prevK - k) > 1e-6) {
        cv.width = Math.round(panels.w * k);
        cv.height = Math.round(panels.h * k);
        cv._redraw();
      }
      return;
    }
    const wasStack = prev === "stack";
    cv._stack = null;
    cv._floor = 0;
    cv.style.aspectRatio = `${w} / ${h}`;
    cv.style.minWidth = mode === "scroll" ? Math.round(w * 0.8) + "px" : "0";
    const shown = mode === "scroll" ? Math.max(cw, w * 0.8) : Math.min(cw, w);
    cv.dataset.fontPx = ((minF * Math.min(shown, w)) / w).toFixed(1);
    if (wasStack) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      oldGetContext.call(cv, "2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      cv._redraw?.();
    }
  }
  const svg = (tag, attrs = {}, text) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    return el;
  };
  function plot(
    el,
    series,
    { xmin = 0, xmax = 1, ymin = 0, ymax = 1, xlabel = "", ylabel = "" } = {},
  ) {
    const W = 600,
      H = 300,
      L = 56,
      R = 580,
      T = 24,
      B = 246,
      x = (v) => L + ((R - L) * (v - xmin)) / (xmax - xmin),
      y = (v) => B - ((B - T) * (v - ymin)) / (ymax - ymin);
    el.replaceChildren();
    el.setAttribute("viewBox", `0 0 ${W} ${H}`);
    el.append(svg("path", { d: `M${L},${T}V${B}H${R}`, class: "axis" }));
    for (let i = 0; i <= 4; i++) {
      const vx = xmin + ((xmax - xmin) * i) / 4,
        vy = ymin + ((ymax - ymin) * i) / 4;
      el.append(
        svg(
          "text",
          { x: x(vx), y: B + 22, "text-anchor": "middle" },
          Number(vx.toFixed(2)),
        ),
        svg(
          "text",
          { x: L - 8, y: y(vy) + 4, "text-anchor": "end" },
          Number(vy.toFixed(2)),
        ),
      );
    }
    el.append(
      svg("text", { x: (L + R) / 2, y: 292, "text-anchor": "middle" }, xlabel),
      svg("text", { x: L, y: 16 }, ylabel),
    );
    series.forEach((s) => {
      el.append(
        svg("path", {
          d: s.points
            .map((p, i) => (i ? "L" : "M") + x(p[0]) + "," + y(p[1]))
            .join(" "),
          fill: "none",
          stroke: s.color || "var(--purple)",
          "stroke-width": 3,
          "stroke-dasharray": s.dash || "",
        }),
      );
    });
  }
  /* A canvas clock. scene(id, draw, opts) binds canvas #c<id>, the optional scrub #t<id> with its
   * value span #v<id>, and the primary button #p<id>.
   *   opts.dur        playback length in ms (default 6000); also settable later as S.dur
   *   opts.t0         initial clock value when there is no scrub (default 1)
   *   opts.parameter  the #t<id> input is a parameter of the drawing, not a scrub
   *   opts.noplay     do not wire the primary button or add Step / Reset
   *   opts.playLabel  text for the primary button when idle ("Play"); use "Reveal" when the clock
   *                   only uncovers annotations of a finished drawing
   *   opts.sweep      {id, at(t), label, fmt}: Play drives input #id through at(t) instead of a
   *                   scrub. The value the user had set is remembered when the sweep starts and put
   *                   back when it finishes or is reset; S.sweeping is true while the sweep owns
   *                   the input, so draw() can record a trace.
   *   opts.onT(t)     called on every clock update before draw
   */
  function scene(id, draw, opts = {}) {
    const cv = document.getElementById("c" + id),
      g = cv.getContext("2d"),
      tEl = opts.parameter ? null : document.getElementById("t" + id),
      vEl = tEl && document.getElementById("v" + id),
      pb = document.getElementById("p" + id),
      idle = opts.playLabel || "Play",
      sw = opts.sweep,
      swEl = sw && document.getElementById(sw.id),
      swLabel = sw && sw.label && document.getElementById(sw.label);
    // Only a value span that sits with the scrub shows the clock; #v<id> may belong to a parameter.
    const ownsV =
      vEl && (vEl.closest("label") || vEl.parentElement).contains(tEl);
    let raf = null,
      last = 0,
      kept = null;
    const S = {
      cv,
      g,
      t: tEl ? +tEl.value : (opts.t0 ?? 1),
      dur: opts.dur || 6000,
      sweeping: false,
      get playing() {
        return !!raf;
      },
      draw: () => paint(cv, g, (W, H) => draw(g, W, H, S.t)),
      pause() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (pb) pb.textContent = idle;
      },
      play() {
        if (raf) {
          S.pause();
          return;
        }
        if (S.t >= 1) S.t = 0;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          S.t = 1;
          update();
          return;
        }
        last = performance.now();
        if (pb) pb.textContent = "Pause";
        raf = requestAnimationFrame(tick);
      },
    };
    function setSweepLabel() {
      if (swLabel) swLabel.textContent = (sw.fmt || String)(+swEl.value);
    }
    function restoreSweep() {
      if (kept === null) return;
      swEl.value = kept;
      kept = null;
      S.sweeping = false;
      setSweepLabel();
    }
    function update() {
      S.t = Math.max(0, Math.min(1, S.t));
      if (tEl) tEl.value = S.t;
      if (ownsV) vEl.textContent = S.t.toFixed(2);
      if (swEl) {
        if (S.t > 0) {
          if (kept === null) kept = swEl.value;
          swEl.value = sw.at(S.t);
          S.sweeping = true;
          setSweepLabel();
        } else restoreSweep();
      }
      opts.onT?.(S.t);
      S.draw();
      if (swEl && S.t >= 1) {
        restoreSweep();
        S.draw();
      }
    }
    function tick(now) {
      S.t = Math.min(1, S.t + (now - last) / S.dur);
      last = now;
      update();
      if (S.t < 1) raf = requestAnimationFrame(tick);
      else {
        S.pause();
        if (auto === "pending") auto = "off";
      }
    }
    if (tEl)
      tEl.addEventListener("input", () => {
        S.pause();
        S.t = +tEl.value;
        update();
      });
    if (swEl)
      swEl.addEventListener("input", () => {
        // The user took the input back: stop the sweep and keep their value.
        S.pause();
        kept = null;
        S.sweeping = false;
      });
    if (pb && !opts.noplay) {
      pb.textContent = idle;
      pb.onclick = S.play;
      const step = document.createElement("button");
      step.textContent = "Step";
      step.onclick = () => {
        S.pause();
        S.t = Math.min(1, S.t + 0.1);
        update();
      };
      const reset = document.createElement("button");
      reset.textContent = "Reset animation";
      reset.onclick = () => {
        S.pause();
        S.t = 0;
        update();
      };
      pb.after(step, reset);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) S.pause();
    });
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
      "change",
      (event) => {
        if (event.matches) S.pause();
      },
    );
    // A figure should be alive on arrival: the first time a scene that starts at t = 0 scrolls
    // into view (or its guided step is opened), play it once. Reduced motion jumps to the end state.
    // If the figure leaves the view mid-play, it resumes on return; any user control ends autoplay.
    let auto = !pb || opts.noplay || !!sw || opts.autoplay === false ? "off" : "pending";
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) S.pause();
          else if (auto === "pending" && S.t < 1 && !S.playing) S.play();
        },
        { threshold: 0.35 },
      ).observe(cv);
    const stopAuto = () => (auto = "off");
    tEl?.addEventListener("pointerdown", stopAuto);
    tEl?.addEventListener("keydown", stopAuto);
    tEl?.addEventListener("input", stopAuto);
    pb?.addEventListener("click", stopAuto, { capture: true });
    pb?.parentElement?.addEventListener("click", stopAuto);
    cv._redraw = S.draw;
    return S;
  }
  function enhance() {
    document.querySelectorAll("canvas").forEach((cv, k) => {
      const stage = cv.closest(".paper,.stage") || cv.parentElement,
        sceneEl = cv.closest(".scene,.act");
      let h = sceneEl?.previousElementSibling;
      while (h && !/^H[12]$/.test(h.tagName)) h = h.previousElementSibling;
      const title = h?.textContent || "Interactive mathematical figure";
      cv.setAttribute("role", "img");
      cv.setAttribute(
        "aria-label",
        title + ". Read the figure description and values below.",
      );
      const viewport = document.createElement("div");
      viewport.className = "figure-viewport";
      viewport.tabIndex = 0;
      viewport.setAttribute("role", "region");
      viewport.setAttribute(
        "aria-label",
        title + "; scroll horizontally to inspect the full-size figure",
      );
      cv.before(viewport);
      viewport.append(cv);
      fit(cv);
      const details = document.createElement("details");
      details.className = "figure-transcript";
      const summary = document.createElement("summary");
      summary.textContent = "Figure description, values, and labels";
      const desc = document.createElement("p");
      desc.textContent =
        h?.nextElementSibling?.tagName === "P"
          ? h.nextElementSibling.textContent
          : title;
      const list = document.createElement("ul");
      details.append(summary, desc, list);
      viewport.after(details);
      const repaint = () => {
        if (!details.open) return;
        const values = [
          ...new Set((labels.get(cv) || []).map((r) => r.text).filter(Boolean)),
        ];
        list.replaceChildren(
          ...values.map((v) => {
            const li = document.createElement("li");
            li.textContent = v;
            return li;
          }),
        );
      };
      details.addEventListener("toggle", repaint);
      stage.addEventListener("input", () => requestAnimationFrame(repaint));
      sceneEl?.addEventListener("input", () => requestAnimationFrame(repaint));
      let timer;
      const cap = stage.querySelector(".cap,.caption");
      if (cap) {
        const ident = "figure-description-" + k;
        cap.id ||= ident;
        cv.setAttribute("aria-describedby", cap.id);
        new MutationObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(repaint, 250);
        }).observe(cap, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
      // Only mention scrolling when the figure actually overflows (narrow screens).
      const note = document.createElement("p");
      note.className = "figure-scroll-note";
      note.textContent = "Scroll sideways inside the figure to see all labels.";
      note.hidden = true;
      viewport.before(note);
      const overflow = () => {
        layout(cv);
        note.hidden = viewport.scrollWidth <= viewport.clientWidth + 1;
      };
      if ("ResizeObserver" in window)
        new ResizeObserver(overflow).observe(viewport);
      overflow();
    });
  }
  window.CausalVisuals = {
    logical,
    layout,
    rich,
    svg,
    plot,
    scene,
    enhance,
  };
})();
