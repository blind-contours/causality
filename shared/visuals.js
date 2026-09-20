/* Rendering utilities and legacy canvas access. Camera/playback are view state. */
(function () {
  const NS = "http://www.w3.org/2000/svg",
    labels = new WeakMap(),
    oldFill = CanvasRenderingContext2D.prototype.fillText,
    oldClear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
    let rows = labels.get(this.canvas);
    if (!rows) {
      rows = [];
      labels.set(this.canvas, rows);
    }
    rows.push({ text: String(text), x, y });
    return oldFill.call(this, text, x, y, ...args);
  };
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    labels.set(this.canvas, []);
    return oldClear.apply(this, args);
  };
  const oldRect = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    if (
      x === 0 &&
      y === 0 &&
      w === this.canvas.width &&
      h === this.canvas.height
    )
      labels.set(this.canvas, []);
    return oldRect.call(this, x, y, w, h);
  };
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
  function scene(id, draw, opts = {}) {
    const cv = document.getElementById("c" + id),
      g = cv.getContext("2d"),
      tEl = opts.parameter ? null : document.getElementById("t" + id),
      pb = document.getElementById("p" + id);
    let raf = null,
      last = 0;
    const S = {
      cv,
      g,
      t: tEl ? +tEl.value : (opts.t0 ?? 1),
      draw: () => draw(g, cv.width, cv.height, S.t),
      pause() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        if (pb) pb.textContent = "Play";
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
    function update() {
      if (tEl) tEl.value = S.t;
      const v = document.getElementById("v" + id);
      if (v && !opts.parameter) v.textContent = S.t.toFixed(2);
      opts.onT?.(S.t);
      S.draw();
    }
    function tick(now) {
      S.t = Math.min(1, S.t + (now - last) / (opts.dur || 6000));
      last = now;
      update();
      if (S.t < 1) raf = requestAnimationFrame(tick);
      else S.pause();
    }
    if (tEl)
      tEl.addEventListener("input", () => {
        S.pause();
        S.t = +tEl.value;
        update();
      });
    if (pb && !opts.noplay) {
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
    if ("IntersectionObserver" in window)
      new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) S.pause();
      }).observe(cv);
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
      cv.style.width = cv.width + "px";
      cv.style.maxWidth = "none";
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
      const note = document.createElement("p");
      note.className = "figure-scroll-note";
      note.textContent =
        "Full-size figure: scroll inside this panel to see all labels.";
      viewport.before(note);
    });
  }
  window.CausalVisuals = { svg, plot, scene, enhance };
})();
