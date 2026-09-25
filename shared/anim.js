/* Small SVG animation kit for the course figures.
 * Rule: playback must change a mathematical state, never merely unveil a drawing.
 * Provides: el, tween, ease, Plot, player, morph, resample, fmt, and a figure registry. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const reduced = () =>
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function el(tag, attrs = {}, ...kids) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs))
      if (v !== undefined && v !== null) e.setAttribute(k, v);
    for (const k of kids)
      if (k !== undefined && k !== null)
        e.append(
          typeof k === "string" || typeof k === "number" ? String(k) : k,
        );
    return e;
  }
  function html(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs))
      if (k === "class") e.className = v;
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    for (const k of kids) if (k !== undefined && k !== null) e.append(k);
    return e;
  }

  const ease = {
    linear: (t) => t,
    out: (t) => 1 - (1 - t) * (1 - t),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (x, d = 3) =>
    Number.isFinite(x) ? Number(x.toFixed(d)).toString() : "—";

  /* tween({duration, ease, onUpdate(u), onDone}) → {cancel}. u runs 0→1.
   * Under reduced motion the end state is applied immediately. */
  function tween({ duration = 800, ease: fn = ease.inOut, onUpdate, onDone }) {
    let raf = null,
      start = null,
      done = false;
    if (reduced()) {
      onUpdate?.(1);
      onDone?.();
      return { cancel() {} };
    }
    const frame = (now) => {
      if (done) return;
      start ??= now;
      const u = Math.min(1, (now - start) / duration);
      onUpdate?.(fn(u));
      if (u < 1) raf = requestAnimationFrame(frame);
      else {
        done = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(frame);
    return {
      cancel() {
        done = true;
        if (raf) cancelAnimationFrame(raf);
      },
    };
  }

  /* Resample a polyline to n points by arc-length-free index interpolation
   * (adequate for curves sampled on a shared x-grid). */
  function resample(points, n) {
    if (points.length === n) return points;
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = (i * (points.length - 1)) / (n - 1),
        k = Math.floor(s),
        f = s - k,
        a = points[k],
        b = points[Math.min(points.length - 1, k + 1)];
      out.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f)]);
    }
    return out;
  }
  const morph = (a, b, t) => {
    const n = Math.max(a.length, b.length),
      A = resample(a, n),
      B = resample(b, n);
    return A.map((p, i) => [lerp(p[0], B[i][0], t), lerp(p[1], B[i][1], t)]);
  };

  const ticks = (min, max, count) => {
    const span = max - min,
      raw = span / Math.max(1, count),
      mag = 10 ** Math.floor(Math.log10(raw)),
      norm = raw / mag,
      step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag,
      out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step)
      out.push(Number(v.toFixed(10)));
    return out;
  };

  /* Plot: one scale, gridlines, axes, tick labels, and mark methods that return elements.
   * new Plot(svg, {x:[min,max], y:[min,max], width, height, margin, xlabel, ylabel, grid, xticks, yticks}) */
  class Plot {
    constructor(svg, o = {}) {
      this.svg = svg;
      this.W = o.width || 600;
      this.H = o.height || 320;
      this.m = { l: 54, r: 18, t: 18, b: 44, ...(o.margin || {}) };
      this.x = o.x || [0, 1];
      this.y = o.y || [0, 1];
      svg.setAttribute("viewBox", `0 0 ${this.W} ${this.H}`);
      svg.classList.add("fig", this.W >= 500 ? "fig-wide" : "fig-narrow");
      svg.replaceChildren();
      this.bg = el("g", { class: "fig-axes" });
      this.marks = el("g", { class: "fig-marks" });
      this.fg = el("g", { class: "fig-labels" });
      svg.append(this.bg, this.marks, this.fg);
      this.o = o;
      this.axes();
    }
    sx(v) {
      return (
        this.m.l +
        ((v - this.x[0]) / (this.x[1] - this.x[0])) *
          (this.W - this.m.l - this.m.r)
      );
    }
    sy(v) {
      return (
        this.H -
        this.m.b -
        ((v - this.y[0]) / (this.y[1] - this.y[0])) *
          (this.H - this.m.t - this.m.b)
      );
    }
    axes() {
      const o = this.o,
        L = this.m.l,
        R = this.W - this.m.r,
        T = this.m.t,
        B = this.H - this.m.b;
      this.bg.replaceChildren();
      const xt = o.xticks || ticks(this.x[0], this.x[1], 6),
        yt = o.yticks || ticks(this.y[0], this.y[1], 5);
      if (o.grid !== false)
        yt.forEach((v) =>
          this.bg.append(
            el("line", {
              class: "grid",
              x1: L,
              x2: R,
              y1: this.sy(v),
              y2: this.sy(v),
            }),
          ),
        );
      this.bg.append(
        el("line", { class: "axis", x1: L, x2: R, y1: B, y2: B }),
        el("line", { class: "axis", x1: L, x2: L, y1: T, y2: B }),
      );
      const f = o.tickFormat || ((v) => fmt(v, 3)),
        fx = o.xTickFormat || f,
        fy = o.yTickFormat || f;
      xt.forEach((v) =>
        this.bg.append(
          el(
            "text",
            {
              class: "tick",
              x: this.sx(v),
              y: B + 16,
              "text-anchor": "middle",
            },
            fx(v),
          ),
        ),
      );
      yt.forEach((v) =>
        this.bg.append(
          el(
            "text",
            {
              class: "tick",
              x: L - 8,
              y: this.sy(v) + 4,
              "text-anchor": "end",
            },
            fy(v),
          ),
        ),
      );
      if (o.xlabel)
        this.bg.append(
          el(
            "text",
            {
              class: "axis-label",
              x: (L + R) / 2,
              y: B + 34,
              "text-anchor": "middle",
            },
            o.xlabel,
          ),
        );
      if (o.ylabel)
        this.bg.append(
          el("text", { class: "axis-label", x: L, y: T - 4 }, o.ylabel),
        );
    }
    layer(cls = "") {
      const g = el("g", { class: cls });
      this.marks.append(g);
      return g;
    }
    d(points) {
      return points
        .map(
          (p, i) =>
            (i ? "L" : "M") +
            fmt(this.sx(p[0]), 2) +
            "," +
            fmt(this.sy(p[1]), 2),
        )
        .join(" ");
    }
    line(points, attrs = {}, parent = this.marks) {
      const p = el("path", {
        class: "mark-line",
        fill: "none",
        d: this.d(points),
        ...attrs,
      });
      parent.append(p);
      return p;
    }
    area(points, y0 = 0, attrs = {}, parent = this.marks) {
      const d =
        this.d(points) +
        ` L${fmt(this.sx(points[points.length - 1][0]), 2)},${fmt(this.sy(y0), 2)}` +
        ` L${fmt(this.sx(points[0][0]), 2)},${fmt(this.sy(y0), 2)} Z`;
      const p = el("path", { class: "mark-area", d, ...attrs });
      parent.append(p);
      return p;
    }
    step(points, attrs = {}, parent = this.marks) {
      let d = "";
      points.forEach((p, i) => {
        const X = fmt(this.sx(p[0]), 2),
          Y = fmt(this.sy(p[1]), 2);
        d += i ? ` H${X} V${Y}` : `M${X},${Y}`;
      });
      const p = el("path", { class: "mark-line", fill: "none", d, ...attrs });
      parent.append(p);
      return p;
    }
    bars(points, width, attrs = {}, parent = this.marks) {
      const g = el("g", { class: "mark-bars" });
      const w = Math.abs(this.sx(width) - this.sx(0));
      points.forEach(([x, y, y0 = 0]) => {
        const top = Math.min(this.sy(y), this.sy(y0));
        g.append(
          el("rect", {
            x: this.sx(x) - w / 2,
            y: top,
            width: w,
            height: Math.abs(this.sy(y) - this.sy(y0)),
            ...attrs,
          }),
        );
      });
      parent.append(g);
      return g;
    }
    scatter(points, r = 3, attrs = {}, parent = this.marks) {
      const g = el("g", { class: "mark-dots" });
      points.forEach(([x, y]) =>
        g.append(el("circle", { cx: this.sx(x), cy: this.sy(y), r, ...attrs })),
      );
      parent.append(g);
      return g;
    }
    vline(x, attrs = {}, label, parent = this.marks) {
      const g = el("g");
      g.append(
        el("line", {
          class: "mark-ref",
          x1: this.sx(x),
          x2: this.sx(x),
          y1: this.m.t,
          y2: this.H - this.m.b,
          ...attrs,
        }),
      );
      if (label)
        g.append(
          el(
            "text",
            {
              class: "ref-label",
              x: this.sx(x) + 5,
              y: this.m.t + 12,
              fill: attrs.stroke,
            },
            label,
          ),
        );
      parent.append(g);
      return g;
    }
    hline(y, attrs = {}, label, parent = this.marks) {
      const g = el("g");
      g.append(
        el("line", {
          class: "mark-ref",
          x1: this.m.l,
          x2: this.W - this.m.r,
          y1: this.sy(y),
          y2: this.sy(y),
          ...attrs,
        }),
      );
      if (label)
        g.append(
          el(
            "text",
            {
              class: "ref-label",
              x: this.W - this.m.r - 4,
              y: this.sy(y) - 5,
              "text-anchor": "end",
              fill: attrs.stroke,
            },
            label,
          ),
        );
      parent.append(g);
      return g;
    }
    text(x, y, str, attrs = {}, parent = this.fg) {
      const t = el(
        "text",
        { class: "fig-text", x: this.sx(x), y: this.sy(y), ...attrs },
        str,
      );
      parent.append(t);
      return t;
    }
  }

  /* player(mount, {duration, onT, label, loop, autoplay}) → {t, set(t), play(), pause(), toggle()}
   * Renders Play/Pause, Step, Reset and a scrub slider. onT(t) is called with t in [0,1]
   * whenever the clock or the slider moves. Reduced motion: Play jumps to t = 1. */
  function player(
    mount,
    { duration = 6000, onT, label = "Progress", loop = false, autoplay = true, formatValue = t => t.toFixed(2) } = {},
  ) {
    const wrap = html("div", { class: "fig-player" });
    const play = html("button", { type: "button", class: "primary" }, "Play");
    const step = html("button", { type: "button" }, "Step");
    const reset = html("button", { type: "button" }, "Reset");
    const id = "scrub-" + Math.random().toString(36).slice(2, 8);
    const lab = html("label", { for: id }, label + " ");
    const val = html("span", { class: "v" }, formatValue(0));
    const range = html("input", {
      type: "range",
      id,
      min: 0,
      max: 1,
      step: 0.002,
      value: 0,
      "aria-valuetext": formatValue(0),
    });
    lab.append(val, range);
    wrap.append(play, step, reset, lab);
    mount.append(wrap);
    let t = 0,
      raf = null,
      last = 0;
    const api = {
      get t() {
        return t;
      },
      set(v, fromClock = false) {
        t = Math.max(0, Math.min(1, v));
        if (!fromClock) api.pause();
        range.value = t;
        val.textContent = formatValue(t);
        range.setAttribute("aria-valuetext", formatValue(t));
        onT?.(t);
      },
      play() {
        if (raf) return api.pause();
        if (t >= 1) t = 0;
        if (reduced()) return api.set(1);
        last = performance.now();
        play.textContent = "Pause";
        const tick = (now) => {
          t = Math.min(1, t + (now - last) / duration);
          last = now;
          api.set(t, true);
          if (t < 1) raf = requestAnimationFrame(tick);
          else if (loop) {
            t = 0;
            raf = requestAnimationFrame(tick);
          } else api.pause();
        };
        raf = requestAnimationFrame(tick);
      },
      pause() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        play.textContent = "Play";
      },
      toggle() {
        api.play();
      },
    };
    play.onclick = api.play;
    step.onclick = () => api.set(Math.min(1, t + 0.1));
    reset.onclick = () => api.set(0);
    range.addEventListener("input", () => api.set(+range.value));
    document.addEventListener(
      "visibilitychange",
      () => document.hidden && api.pause(),
    );
    // Alive on arrival: play once the first time the figure comes into view.
    // It resumes if it left the view mid-play; any user control ends autoplay.
    let auto = loop || !autoplay ? "off" : "pending";
    const stopAuto = () => (auto = "off");
    wrap.addEventListener("click", stopAuto, { capture: true });
    range.addEventListener("pointerdown", stopAuto);
    range.addEventListener("keydown", stopAuto);
    range.addEventListener("input", stopAuto);
    if ("IntersectionObserver" in window)
      new IntersectionObserver(
        (e) => {
          if (!e[0].isIntersecting) api.pause();
          else if (auto === "pending" && t < 1 && !raf) api.play();
        },
        { threshold: 0.35 },
      ).observe(mount);
    return api;
  }

  /* Figure registry. A lesson places <div data-figure="name"></div>; a figure module calls
   * CausalFigures.register("name", (mount, dataset) => {...}) and mounting happens on load. */
  const registry = {};
  function register(name, fn) {
    registry[name] = fn;
    if (document.readyState !== "loading") mountAll();
  }
  function mountAll() {
    document.querySelectorAll("[data-figure]").forEach((m) => {
      if (m.dataset.mounted) return;
      const fn = registry[m.dataset.figure];
      if (!fn) return;
      m.dataset.mounted = "1";
      try {
        fn(m, m.dataset);
      } catch (e) {
        m.textContent = "This figure could not be drawn: " + e.message;
        console.error(e);
      }
    });
  }
  document.addEventListener("DOMContentLoaded", mountAll);

  window.CausalAnim = {
    el,
    html,
    ease,
    lerp,
    fmt,
    tween,
    morph,
    resample,
    ticks,
    Plot,
    player,
    reduced,
  };
  window.CausalFigures = { register, mountAll, registry };
})();
