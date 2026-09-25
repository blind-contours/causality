/* Motion kit: one cast of patients that persists and transforms, and the shared motion grammar.
 * Depends on shared/anim.js (CausalAnim) and, for the cohort, science/cohort.js (CausalCohort).
 *
 * Grammar (use everywhere):
 *   - Build order: axes → data → estimate → truth → gap.
 *   - One easing (CausalAnim.ease.inOut), durations MOTION.short/base/long.
 *   - A "landing" pulse when an estimate reaches its target: CausalMotion.pulse(el).
 *   - Reduced motion: every transition jumps to its end state (tween already does this).
 *   - Colour roles: naive/plug-in --or, truth --green (dashed), corrected/targeted --purple,
 *     treatment weight --p, censoring weight --teal, low severity --p, high severity --or.
 *
 * API
 *   CausalMotion.MOTION                      durations and stagger
 *   CausalMotion.Dots(svg, patients, opts)   keyed circles that morph between layouts
 *     .to(layoutFn, {duration, stagger, style}) → Promise   move every dot to layoutFn(p, i)
 *     .style(fn)                              per-dot attributes {r, fill, stroke, opacity, ...}
 *     .get(id)                                the <circle> for patient id
 *   CausalMotion.layouts                      grid, scatter, split, timeline, sorted, stack
 *   CausalMotion.linkEquation(eqEl, figureEl) hover/focus a [data-term] in the equation to
 *                                             highlight [data-term] shapes in the figure and back
 *   CausalMotion.pulse(el)                    a short scale-and-glow on arrival
 *   CausalMotion.sequence(steps)              run async steps in order; returns {cancel}
 */
(function () {
  const A = window.CausalAnim;
  const MOTION = { short: 320, base: 600, long: 1100, stagger: 6 };
  const reduced = () => A.reduced();

  function Dots(svg, patients, opts = {}) {
    const layer = A.el("g", { class: "dots" });
    svg.append(layer);
    const nodes = new Map();
    const pos = new Map();
    patients.forEach((p) => {
      const c = A.el("circle", {
        r: opts.r ?? 5,
        cx: 0,
        cy: 0,
        "data-id": p.id,
        class: "dot",
      });
      layer.append(c);
      nodes.set(p.id, c);
      pos.set(p.id, { x: 0, y: 0, r: opts.r ?? 5 });
    });
    const api = {
      layer,
      nodes,
      patients,
      get: (id) => nodes.get(id),
      style(fn) {
        patients.forEach((p, i) => {
          const s = fn(p, i) || {};
          const c = nodes.get(p.id);
          for (const [k, v] of Object.entries(s))
            if (k !== "r") c.setAttribute(k, v);
          if (s.r != null) {
            c.setAttribute("r", s.r);
            pos.get(p.id).r = s.r;
          }
        });
        return api;
      },
      place(layoutFn) {
        patients.forEach((p, i) => {
          const q = layoutFn(p, i);
          const c = nodes.get(p.id);
          c.setAttribute("cx", q.x);
          c.setAttribute("cy", q.y);
          if (q.r != null) c.setAttribute("r", q.r);
          pos.set(p.id, { x: q.x, y: q.y, r: q.r ?? pos.get(p.id).r });
        });
        return api;
      },
      to(layoutFn, { duration = MOTION.base, stagger = MOTION.stagger, order } = {}) {
        const targets = patients.map((p, i) => ({ p, from: { ...pos.get(p.id) }, to: layoutFn(p, i) }));
        const seq = order ? targets.slice().sort(order) : targets;
        const span = duration + stagger * (seq.length - 1);
        if (reduced()) {
          api.place(layoutFn);
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          A.tween({
            duration: span,
            ease: A.ease.linear,
            onUpdate: (u) => {
              const now = u * span;
              seq.forEach(({ p, from, to }, k) => {
                const local = Math.max(0, Math.min(1, (now - k * stagger) / duration));
                const e = A.ease.inOut(local);
                const c = nodes.get(p.id);
                const x = A.lerp(from.x, to.x, e),
                  y = A.lerp(from.y, to.y, e),
                  r = to.r != null ? A.lerp(from.r, to.r, e) : from.r;
                c.setAttribute("cx", x);
                c.setAttribute("cy", y);
                c.setAttribute("r", r);
              });
            },
            onDone: () => {
              api.place(layoutFn);
              resolve();
            },
          });
        });
      },
    };
    return api;
  }

  /* Layout factories. Each returns (p, i) => {x, y, r?}. Boxes are {x, y, w, h}. */
  const layouts = {
    // 10 × 10 waiting-room grid in presentation order (p.slot).
    grid(box, cols = 10) {
      const rows = Math.ceil(100 / cols),
        dx = box.w / cols,
        dy = box.h / rows;
      return (p) => {
        const k = p.slot ?? p.id;
        return { x: box.x + dx * ((k % cols) + 0.5), y: box.y + dy * (Math.floor(k / cols) + 0.5) };
      };
    },
    // Two grids side by side, split by a key (e.g. treatment): key(p) ∈ {0, 1}.
    split(boxes, key, cols = 8) {
      return (p) => layouts._inGroup(boxes[key(p)], cols, key(p), p, key);
    },
    _groupIndex: new WeakMap(),
    _inGroup(box, cols, g, p, key) {
      // rank of p within its group by slot, computed lazily per key function
      let table = layouts._groupIndex.get(key);
      if (!table) {
        table = new Map();
        layouts._groupIndex.set(key, table);
      }
      if (!table.has(p.id)) {
        const all = window.CausalCohort.cohort.patients;
        const byGroup = [0, 1].map((v) =>
          all.filter((q) => key(q) === v).sort((a, b) => (a.slot ?? a.id) - (b.slot ?? b.id)),
        );
        byGroup.forEach((list) => list.forEach((q, k) => table.set(q.id, k)));
      }
      const k = table.get(p.id) ?? 0,
        dx = box.w / cols,
        rows = Math.max(1, Math.ceil(60 / cols)),
        dy = Math.min(dx, box.h / rows);
      return { x: box.x + dx * ((k % cols) + 0.5), y: box.y + dy * (Math.floor(k / cols) + 0.5) };
    },
    // Scatter: sx(p), sy(p) are pixel functions.
    scatter: (sx, sy) => (p) => ({ x: sx(p), y: sy(p) }),
    // One row per patient ordered by a value, x at a pixel function (e.g. event time).
    timeline(box, sortKey, sx) {
      return (p, i) => {
        const order = layouts._rank(sortKey);
        const k = order.get(p.id);
        const n = order.size;
        return { x: sx(p), y: box.y + (box.h * (k + 0.5)) / n };
      };
    },
    _ranks: new WeakMap(),
    _rank(sortKey) {
      let m = layouts._ranks.get(sortKey);
      if (!m) {
        const all = window.CausalCohort.cohort.patients.slice().sort((a, b) => sortKey(a) - sortKey(b));
        m = new Map(all.map((p, k) => [p.id, k]));
        layouts._ranks.set(sortKey, m);
      }
      return m;
    },
    // Histogram stack: dots pile into bins of value(p) along x.
    stack(box, value, lo, hi, bins, r = 4) {
      return (p) => {
        const key = value;
        let m = layouts._stacks.get(key);
        if (!m) {
          m = new Map();
          const counts = new Array(bins).fill(0);
          window.CausalCohort.cohort.patients
            .slice()
            .sort((a, b) => (a.slot ?? a.id) - (b.slot ?? b.id))
            .forEach((q) => {
              const b = Math.max(0, Math.min(bins - 1, Math.floor(((value(q) - lo) / (hi - lo)) * bins)));
              m.set(q.id, [b, counts[b]++]);
            });
          layouts._stacks.set(key, m);
        }
        const [b, h] = m.get(p.id) || [0, 0];
        const bw = box.w / bins;
        return { x: box.x + bw * (b + 0.5), y: box.y + box.h - r - h * (2 * r + 1) };
      };
    },
    _stacks: new WeakMap(),
  };

  /* Colour-linked equations. In the equation, wrap terms as
   *   <span data-term="plugin">ψ(P̂)</span>; in the figure, give shapes data-term="plugin".
   * Hover or focus either side to highlight both. Terms get their colour from --term-<name>
   * set in motion.css (plugin, correction, gweight, cweight, truth, residual). */
  function linkEquation(eqEl, figureEl) {
    const terms = [...eqEl.querySelectorAll("[data-term]")];
    const set = (name, on) => {
      [eqEl, figureEl].forEach((root) =>
        root.querySelectorAll(`[data-term="${name}"]`).forEach((e) => e.classList.toggle("term-on", on)),
      );
      figureEl.classList.toggle("term-focus", on);
    };
    terms.forEach((t) => {
      t.tabIndex = 0;
      t.classList.add("term");
      const name = t.dataset.term;
      ["mouseenter", "focus"].forEach((ev) => t.addEventListener(ev, () => set(name, true)));
      ["mouseleave", "blur"].forEach((ev) => t.addEventListener(ev, () => set(name, false)));
    });
    figureEl.addEventListener("mouseover", (e) => {
      const s = e.target.closest?.("[data-term]");
      if (s) set(s.dataset.term, true);
    });
    figureEl.addEventListener("mouseout", (e) => {
      const s = e.target.closest?.("[data-term]");
      if (s) set(s.dataset.term, false);
    });
  }

  function pulse(el) {
    if (!el || reduced()) return;
    el.classList.remove("pulse");
    void el.getBoundingClientRect();
    el.classList.add("pulse");
  }

  function sequence(steps) {
    let cancelled = false;
    (async () => {
      for (const s of steps) {
        if (cancelled) return;
        await s();
      }
    })();
    return { cancel: () => (cancelled = true) };
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, reduced() ? 0 : ms));

  window.CausalMotion = { MOTION, Dots, layouts, linkEquation, pulse, sequence, wait };
})();
