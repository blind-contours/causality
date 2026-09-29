/* Shared navigation, learning events and persistence. No completion by scrolling. */
(function () {
  "use strict";
  // One step button: a number pill, plus a title that guided mode shows only for the current step.
  window.CausalCourseNav = {
    label(b, n, title) {
      b.replaceChildren();
      const num = document.createElement("span"),
        t = document.createElement("span");
      num.className = "sn";
      num.textContent = n;
      t.className = "st";
      t.textContent = title;
      b.append(num, t);
      b.title = n + ". " + title;
      b.setAttribute("aria-label", "Step " + n + ": " + title);
    },
  };
  /* Beats: inside the current guided step, one small idea at a time.
   *
   * Splitting. A step's children are grouped into consecutive beats: a heading travels with what
   * follows it, controls and readouts travel with their figure, and a predict box is always a beat
   * of its own. Then the groups are paced: consecutive short text groups are joined so a beat holds
   * roughly 25 to 90 words or one visual, a short lead-in joins the figure it introduces, and a step
   * keeps at most 7 beats. Nothing is ever joined across a predict box or a figure. When a step has
   * one wrapper container holding most of its content, the splitter descends into it.
   *
   * Controls. The step's Continue button reveals the next beat, then moves to the next step. Next to
   * it: "Show the rest of this step" (reveals everything, no animation), a subtle "Space to
   * continue" hint (desktop only), and, while a prediction is unanswered, "Answer to continue"
   * (aria-disabled, still focusable; pressing it focuses the options) with a small "Skip".
   *
   * Figures. Text that follows an animation must not arrive before the animation ends. If a shown
   * beat holds a figure that is still playing and the next beat is text, the first Continue press
   * fast-forwards the figure and only the second press reveals the text. Fast-forward dispatches
   * a bubbling CustomEvent "causality:finish" on the figure element ([data-figure], .scene, .figure
   * or .paper around the player); a figure may listen for it and jump to its end state, or ignore
   * it. A figure counts as playing when it carries [data-playing] or holds a CausalAnim player
   * (.fig-player) whose Play button currently reads "Pause"; such a player is then set to its end
   * through its own scrub slider, so it finishes even when the figure ignores the event.
   *
   * Links. A #hash that targets a step, a step heading, or a figure reveals that whole step and
   * scrolls the target into view after layout; any other target reveals up to its beat. The query
   * ?reveal=all shows every beat of every step, and ?finish=1 fast-forwards the players of the
   * linked step once they have started, so a link can land on a figure's end state.
   *
   * Explore mode, or the setting "Reveal one idea at a time" switched off, shows everything. */
  const beats = (function () {
    const steps = new Map(); // panel -> {groups, shown, row, next, own, dots, rest, skip, hint}
    let lessonId = "",
      enabledFn = () => false,
      lastPointer = "mouse",
      saved = {},
      userScrolled = false;
    const params = (() => {
      try {
        return new URLSearchParams(location.search);
      } catch {
        return new URLSearchParams();
      }
    })();
    const REVEAL_ALL = params.get("reveal") === "all";
    const MIN_WORDS = 25,
      MAX_WORDS = 90,
      MAX_BEATS = 7;
    const KEY = () => "causality.beats." + lessonId;
    const reduced = () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const FIG =
      "svg,canvas,figure,table,.figure,.scene,.paper,.stage,[data-figure],.table-wrap,.lab-grid,.figure-viewport,[data-simulation]";
    const PICTURE = "svg,canvas,figure,.figure,.scene,.paper,[data-figure],.figure-viewport,[data-simulation]";
    const INTERACTIVE =
      "a,button,input,select,textarea,label,summary,details,svg,canvas,table,[data-figure],.scene,.figure,.figure-viewport,.predict,[contenteditable],[role=slider],[role=button],[tabindex]:not([tabindex='-1'])";
    // Words a reader meets: closed <details> count only their summary.
    function words(root) {
      let n = 0;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let t; (t = w.nextNode()); ) {
        const p = t.parentElement;
        if (!p || p.closest("script,style,template")) continue;
        const d = p.closest("details");
        if (d && !d.open && root.contains(d) && !p.closest("summary")) continue;
        n += (t.data.match(/\S+/g) || []).length;
      }
      return n;
    }
    function kind(el) {
      if (
        /^H[1-6]$/.test(el.tagName) ||
        el.classList.contains("eyebrow") ||
        el.classList.contains("world-card")
      )
        return "lead";
      if (el.hidden) return "attach";
      if (el.classList.contains("predict")) return "predict";
      if (
        el.matches(
          ".readout,.legend,.fig-caption,.cap,.variance-bar,.fig-player,[role=status],[aria-live]",
        )
      )
        return "attach";
      // A short paragraph with an id is a status line that a script fills.
      if (el.tagName === "P" && el.id && !el.matches(".note,.say,.sources,.src"))
        return "attach";
      if (el.matches(".math,.eq,.notation-key,.figure-transcript"))
        return "math";
      if (el.matches("table,.table-wrap") || (el.tagName === "DIV" && el.children.length === 1 && el.firstElementChild.matches("table,.table-wrap")))
        return "table";
      if (el.matches(FIG) || el.querySelector(FIG)) return "visual";
      if (
        el.tagName === "DIV" &&
        el.id &&
        !el.querySelector("p,input,select,button,textarea") &&
        el.textContent.trim().length < 400
      )
        return "visual"; // an empty mount point that a script fills
      if (
        el.matches(
          "label,fieldset,input,select,button,.btns,.controls,.ctl,.geometry-controls,.control-row",
        ) ||
        (el.tagName === "DIV" && el.querySelector("input,select,button"))
      )
        return "control";
      return "text";
    }
    const skipped = (el) =>
      el.classList.contains("step-btns") ||
      el.classList.contains("beat") ||
      /^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName);
    // Group a container's direct children into raw groups. Every group is a contiguous run of siblings.
    function split(host) {
      const groups = [];
      let cur = null,
        lead = [],
        held = [];
      const open = (type, els) => {
        cur = { type, els };
        groups.push(cur);
      };
      for (const el of [...host.children]) {
        if (skipped(el)) continue;
        let k = kind(el);
        if (k === "lead") {
          if (held.length && cur) cur.els.push(...held.splice(0));
          lead.push(el);
          continue;
        }
        if (k === "control") {
          held.push(el);
          continue;
        }
        // Readouts right after controls travel with those controls (and their figure).
        if (k === "attach" && held.length) {
          held.push(el);
          continue;
        }
        if (k === "table") k = cur?.type === "visual" && !lead.length ? "attach" : "visual";
        if (k === "visual") {
          const bare = /^(svg|SVG|CANVAS)$/.test(el.tagName);
          if (
            bare &&
            cur?.type === "visual" &&
            !lead.length &&
            !held.length &&
            /^(svg|SVG|CANVAS)$/.test(cur.els[cur.els.length - 1].tagName)
          )
            cur.els.push(el);
          else open("visual", [...lead.splice(0), ...held.splice(0), el]);
          continue;
        }
        // Nothing joins a predict box: what follows it may be the answer.
        if (
          (k === "attach" || k === "math") &&
          cur &&
          cur.type !== "predict" &&
          !lead.length
        ) {
          cur.els.push(...held.splice(0), el);
          continue;
        }
        if (held.length && cur && !lead.length) cur.els.push(...held.splice(0));
        // A run of sibling "another way" drawers is one idea.
        const last = cur?.els[cur.els.length - 1];
        if (
          el.tagName === "DETAILS" &&
          last?.tagName === "DETAILS" &&
          cur.type === "text" &&
          !lead.length &&
          last.className === el.className
        ) {
          cur.els.push(el);
          continue;
        }
        open(k === "predict" ? "predict" : "text", [
          ...lead.splice(0),
          ...held.splice(0),
          el,
        ]);
      }
      const rest = [...lead, ...held];
      if (rest.length) {
        if (cur) cur.els.push(...rest);
        else open("text", rest);
      }
      return groups;
    }
    // Pace raw groups: join short text, fold a short lead-in into its figure, cap the count.
    function pace(raw) {
      raw.forEach((g) => (g.words = g.els.reduce((s, e) => s + words(e), 0)));
      const join = (a, b) => {
        a.els.push(...b.els);
        a.words += b.words;
        if (b.type === "visual") a.type = "visual";
        return a;
      };
      const fits = (a, b) =>
        a + b <= MAX_WORDS || ((a < MIN_WORDS || b < MIN_WORDS) && a + b <= MAX_WORDS + 40);
      let out = [];
      for (const g of raw) {
        const prev = out[out.length - 1];
        // An empty status line or mount point is not an idea: it rides with its neighbour.
        if (prev && g.type === "text" && g.words === 0 && prev.type !== "predict") {
          join(prev, g);
          continue;
        }
        if (prev?.type === "text" && g.type === "text" && fits(prev.words, g.words)) {
          join(prev, g);
          continue;
        }
        out.push(g);
      }
      // A short lead-in ("Watch the bins...") arrives with the figure it introduces.
      const folded = [];
      for (let i = 0; i < out.length; i++) {
        const g = out[i],
          nx = out[i + 1];
        if (g.type === "text" && g.words < MIN_WORDS && nx?.type === "visual") {
          nx.els.unshift(...g.els);
          nx.words += g.words;
          continue;
        }
        folded.push(g);
      }
      out = folded;
      // At most MAX_BEATS: join the smallest neighbouring pair of text beats.
      while (out.length > MAX_BEATS) {
        let best = -1,
          size = Infinity;
        for (let i = 0; i + 1 < out.length; i++) {
          const a = out[i],
            b = out[i + 1];
          if (a.type !== "text" || b.type !== "text") continue;
          if (a.words + b.words < size) {
            size = a.words + b.words;
            best = i;
          }
        }
        if (best < 0 || size > 2.5 * MAX_WORDS) break;
        join(out[best], out[best + 1]);
        out.splice(best + 1, 1);
      }
      return out;
    }
    // If one plain wrapper holds most of a step, split its children instead.
    function host(panel) {
      let h = panel;
      for (let depth = 0; depth < 3; depth++) {
        const kids = [...h.children].filter(
          (el) =>
            !skipped(el) &&
            !/^H[1-6]$/.test(el.tagName) &&
            !el.classList.contains("eyebrow"),
        );
        const box = kids.filter(
          (el) =>
            /^(DIV|SECTION|ARTICLE|MAIN|FORM)$/.test(el.tagName) &&
            !el.matches(FIG) &&
            !el.matches(".predict,.btns,.controls,.ctl,.table-wrap") &&
            el.children.length >= 3,
        );
        const total = words(h) || 1;
        if (
          kids.length <= 2 &&
          box.length === 1 &&
          words(box[0]) >= 0.7 * total &&
          pace(split(box[0])).length >= 2
        )
          h = box[0];
        else break;
      }
      return h;
    }
    function enabled() {
      return enabledFn();
    }
    function persist() {
      try {
        sessionStorage.setItem(KEY(), JSON.stringify(saved));
      } catch {}
    }
    const answered = (g) =>
      !!g.wrap.dataset.answered ||
      !!g.wrap.querySelector(".predict-opt[aria-pressed='true']");
    // The next beat waits for an answer when the last shown beat is an unanswered prediction.
    function gated(s) {
      const g = s.groups[s.shown - 1];
      return !!g && g.type === "predict" && s.shown < s.groups.length && !answered(g);
    }
    function render(panel) {
      const s = steps.get(panel);
      if (!s) return;
      const on = enabled(),
        n = s.groups.length;
      s.groups.forEach((g, k) => (g.wrap.hidden = on && k >= s.shown));
      const more = on && s.shown < n,
        gate = more && gated(s);
      s.dots.hidden = !more;
      s.dots.replaceChildren(
        ...s.groups.map((_, k) => {
          const d = document.createElement("i");
          if (k < s.shown) d.className = "on";
          return d;
        }),
      );
      s.dots.title = s.shown + " of " + n + " ideas shown";
      s.rest.hidden = !more;
      s.skip.hidden = !gate;
      s.hint.hidden = !more || gate;
      const btn = s.next || s.own;
      if (s.own) s.own.hidden = !more;
      btn.classList.toggle("beat-gated", gate);
      if (gate) btn.setAttribute("aria-disabled", "true");
      else btn.removeAttribute("aria-disabled");
      if (more) {
        btn.textContent = gate ? "Answer to continue" : "Continue";
        btn.setAttribute(
          "aria-label",
          gate
            ? "Answer the prediction above to continue, or choose Skip"
            : "Show the next idea (" + (s.shown + 1) + " of " + n + ")",
        );
        btn.classList.add("beat-more");
      } else if (s.next) {
        btn.textContent = s.nextLabel;
        btn.removeAttribute("aria-label");
        btn.classList.remove("beat-more");
      }
    }
    // Height of the sticky course bar, so a scrolled-to target is not hidden under it.
    function barHeight() {
      const bar = document.querySelector(".course-bar");
      if (!bar || getComputedStyle(bar).position !== "sticky") return 0;
      return bar.getBoundingClientRect().height;
    }
    // Only ever scroll forward: bring the new beat (and the Continue row) into view.
    function scrollForward(panel, wrap) {
      const s = steps.get(panel),
        r = wrap.getBoundingClientRect(),
        row = s.row.getBoundingClientRect(),
        bottom = Math.max(r.bottom, s.row.offsetParent ? row.bottom : r.bottom) + 16,
        delta = Math.min(bottom - innerHeight, r.top - barHeight() - 16);
      if (delta > 0)
        window.scrollBy({ top: delta, behavior: reduced() ? "auto" : "smooth" });
    }
    // Place a step (or any target) just under the sticky bar. Used when a new step opens.
    function land(el) {
      // Instant, and repeated once layout settles, so a smooth scroll still running from the
      // previous beat cannot carry the page past the new heading.
      const go = () => {
        const y = el.getBoundingClientRect().top + scrollY - barHeight() - 12;
        window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
      };
      go();
      requestAnimationFrame(go);
      setTimeout(go, 120);
    }
    function playing(root) {
      const figs = [];
      root.querySelectorAll("[data-playing]").forEach((f) => figs.push({ fig: f }));
      root.querySelectorAll(".fig-player").forEach((p) => {
        const b = p.querySelector("button");
        if (b && /^pause$/i.test(b.textContent.trim()))
          figs.push({
            fig: p.closest("[data-figure],.scene,.figure,.paper") || p.parentElement,
            player: p,
          });
      });
      return figs;
    }
    // Fast-forward playing figures to their end state (see the header comment).
    function finish(list) {
      for (const { fig, player } of list) {
        fig.dispatchEvent(new CustomEvent("causality:finish", { bubbles: true }));
        const b = player?.querySelector("button"),
          range = player?.querySelector("input[type=range]");
        if (range && b && /^pause$/i.test(b.textContent.trim())) {
          range.value = range.max || 1;
          range.dispatchEvent(new Event("input"));
        }
      }
      return list.length > 0;
    }
    function shownPlaying(s) {
      return s.groups.slice(0, s.shown).flatMap((g) => playing(g.wrap));
    }
    // Reveal the next beat of a step. Returns true when the press was used inside the step.
    function next(panel, opts = {}) {
      const s = steps.get(panel);
      if (!s || !enabled() || s.shown >= s.groups.length) return false;
      if (gated(s) && !opts.force) {
        const opt = s.groups[s.shown - 1].wrap.querySelector(".predict-opt");
        opt?.focus();
        return true;
      }
      const g = s.groups[s.shown];
      if (!opts.force && g.type === "text" && finish(shownPlaying(s))) return true;
      s.shown++;
      saved[panel.id] = s.shown;
      persist();
      render(panel);
      if (!reduced() && opts.animate !== false) {
        g.wrap.classList.remove("beat-enter");
        void g.wrap.offsetWidth;
        g.wrap.classList.add("beat-enter");
      }
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        scrollForward(panel, g.wrap);
        if (opts.focus !== false) g.wrap.focus({ preventScroll: true });
      });
      return true;
    }
    function skip(panel) {
      const s = steps.get(panel);
      if (!s || !gated(s)) return;
      s.groups[s.shown - 1].wrap.dataset.answered = "skipped";
      next(panel, { force: true });
    }
    // Show everything left in the step at once, without animation.
    function showRest(panel) {
      const s = steps.get(panel);
      if (!s || s.shown >= s.groups.length) return;
      finish(shownPlaying(s));
      const first = s.groups[s.shown];
      s.groups.forEach((g) => {
        if (g.type === "predict" && !answered(g)) g.wrap.dataset.answered = "skipped";
      });
      s.shown = s.groups.length;
      saved[panel.id] = s.shown;
      persist();
      render(panel);
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        first.wrap.focus({ preventScroll: true });
      });
    }
    // Reveal for a deep link: whole step for a step, heading or figure; otherwise up to the target.
    function revealTo(target) {
      let hit = null;
      for (const [panel, s] of steps) {
        if (!panel.contains(target)) continue;
        const k = s.groups.findIndex((g) => g.wrap.contains(target));
        const whole =
          target === panel ||
          k < 0 ||
          target.matches(PICTURE) ||
          !!target.querySelector(PICTURE) ||
          (k === 0 && (/^H[1-6]$/.test(target.tagName) || target.classList.contains("eyebrow")));
        const want = whole ? s.groups.length : k + 1;
        if (want > s.shown) {
          s.shown = want;
          saved[panel.id] = s.shown;
          persist();
          render(panel);
        }
        hit = panel;
      }
      return hit;
    }
    /* Resolve a #hash to an element: an id, or "fig-<name>" (optionally "fig-<name>-<k>") for the
     * k-th <div data-figure="name">, so links can land on a figure that has no id of its own. */
    function find(hash) {
      let id = hash;
      try {
        id = decodeURIComponent(hash);
      } catch {}
      if (!id) return null;
      const byId = document.getElementById(id);
      if (byId) return byId;
      const m = /^fig-(.+)$/.exec(id);
      if (!m) return null;
      const esc = (v) => (window.CSS?.escape ? CSS.escape(v) : v);
      const all = document.querySelectorAll(`[data-figure="${esc(m[1])}"]`);
      if (all.length) return all[0];
      const k = /^(.+)-(\d+)$/.exec(m[1]);
      return k ? document.querySelectorAll(`[data-figure="${esc(k[1])}"]`)[+k[2] - 1] || null : null;
    }
    function current() {
      for (const panel of steps.keys()) if (!panel.hidden) return panel;
      return null;
    }
    function attach(panel) {
      const row = panel.querySelector(":scope > .step-btns");
      if (!row || steps.has(panel)) return;
      const h = host(panel),
        groups = pace(split(h));
      if (groups.length < 2) return;
      groups.forEach((g, k) => {
        const w = document.createElement("div");
        w.className = "beat";
        w.dataset.beat = k + 1;
        w.tabIndex = -1;
        if (g.type === "predict") w.dataset.gate = "predict";
        g.els[0].before(w);
        w.append(...g.els);
        w.addEventListener("animationend", () =>
          w.classList.remove("beat-enter"),
        );
        g.wrap = w;
      });
      const nextBtn = row.querySelector(".step-next");
      let own = null;
      if (!nextBtn) {
        own = document.createElement("button");
        own.type = "button";
        own.className = "step-next beat-only primary";
        own.onclick = () => next(panel);
        row.append(own);
      }
      const mk = (tag, cls, text) => {
        const e = document.createElement(tag);
        e.className = cls;
        e.textContent = text;
        if (tag === "button") e.type = "button";
        return e;
      };
      const rest = mk("button", "beat-rest", "Show the rest of this step"),
        dots = mk("span", "beat-dots", ""),
        hint = mk("span", "beat-key", "Space to continue"),
        skipBtn = mk("button", "beat-skip", "Skip");
      dots.setAttribute("aria-hidden", "true");
      hint.setAttribute("aria-hidden", "true");
      skipBtn.setAttribute("aria-label", "Skip this prediction and continue");
      rest.onclick = () => showRest(panel);
      skipBtn.onclick = () => skip(panel);
      (nextBtn || own).before(rest, dots, hint, skipBtn);
      const done = saved.answered?.[panel.id] || [];
      groups.forEach((g, k) => {
        if (done.includes(k)) g.wrap.dataset.answered = "1";
      });
      const s = {
        groups,
        row,
        dots,
        rest,
        skip: skipBtn,
        hint,
        next: nextBtn,
        own,
        nextLabel: nextBtn?.textContent,
        shown: REVEAL_ALL
          ? groups.length
          : Math.min(groups.length, Math.max(1, +saved[panel.id] || 0)),
      };
      steps.set(panel, s);
      // A predict box is a gate: answering it opens the next idea.
      panel.addEventListener("click", (e) => {
        const opt = e.target.closest(".predict-opt"),
          w = opt?.closest(".beat");
        const k = w ? groups.findIndex((g) => g.wrap === w) : -1;
        if (opt && k >= 0) {
          if (!w.dataset.answered) {
            w.dataset.answered = "1";
            saved.answered = saved.answered || {};
            (saved.answered[panel.id] ||= []).push(k);
            persist();
            render(panel);
            if (k === s.shown - 1) setTimeout(() => next(panel, { focus: false }), 450);
          }
          return;
        }
        // On touch, tapping blank space in the step shows the next idea.
        if (
          lastPointer === "touch" &&
          !e.target.closest(INTERACTIVE) &&
          !e.target.closest(".step-btns") &&
          (getSelection?.().isCollapsed ?? true)
        )
          next(panel, { focus: false });
      });
      render(panel);
    }
    // After a deep link: scroll the target into view once layout has settled.
    function settle(target, firstLoad) {
      const go = () => {
        if (!userScrolled && !target.closest("[hidden]")) {
          // A target that guided mode hides by CSS (a legacy eyebrow) lands on its beat instead.
          const box = target.getClientRects().length
            ? target
            : target.closest(".beat,.legacy-step,.lab-step") || target;
          const y = box.getBoundingClientRect().top + scrollY - barHeight() - 12;
          window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(go));
      // On first load, figures and fonts can still move the layout: land again once they settle.
      // A later hash change lands once, so it never fights a scroll that follows it.
      if (!firstLoad) return;
      setTimeout(go, 250);
      if (document.readyState !== "complete")
        window.addEventListener("load", () => setTimeout(go, 50), { once: true });
      else setTimeout(go, 700);
    }
    function finishLinked(panel) {
      // ?finish=1: wait for the linked step's players to start, then fast-forward them.
      let tries = 0;
      const tick = () => {
        const list = playing(panel);
        if (list.length) return finish(list);
        if (++tries < 40) setTimeout(tick, 100);
      };
      tick();
    }
    function init(id, isEnabled) {
      lessonId = id;
      enabledFn = isEnabled;
      try {
        saved = JSON.parse(sessionStorage.getItem(KEY()) || "{}") || {};
      } catch {
        saved = {};
      }
      document
        .querySelectorAll(".legacy-step,.lab-step")
        .forEach((p) => attach(p));
      for (const ev of ["wheel", "touchmove", "keydown"])
        window.addEventListener(ev, () => (userScrolled = true), { passive: true, once: true });
      if (!steps.size) return;
      document.body.classList.add("has-beats");
      const all = () => steps.forEach((_, p) => render(p));
      window.addEventListener("causality:settings", all);
      document.addEventListener(
        "pointerdown",
        (e) => (lastPointer = e.pointerType || "mouse"),
        { capture: true },
      );
      document.addEventListener("keydown", (e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
          return;
        const t = e.target;
        if (t !== document.body && t !== document.documentElement && t.closest?.(INTERACTIVE))
          return;
        const panel = current();
        if (!panel) return;
        if (t !== document.body && t !== document.documentElement && !panel.contains(t) && !t.matches?.("#main-content"))
          return;
        if (next(panel)) e.preventDefault();
      });
      const hash = (first) => {
        const target = find(location.hash.slice(1));
        if (!target) return;
        const panel = revealTo(target);
        if (!panel) return;
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        settle(target, first === true);
        if (params.get("finish") === "1") finishLinked(panel);
      };
      window.addEventListener("hashchange", hash);
      hash(true);
    }
    return { init, next, revealTo, attach, showRest, land, find };
  })();
  window.CausalBeats = beats;
  const COURSE = window.CausalCurriculum,
    units = COURSE.chapters.flatMap((ch) =>
      ch.units.map((u) => ({ ...u, chapter: ch })),
    );
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = { getItem: () => null, setItem: () => {} };
  }
  let state = CausalState.load(storage);
  const listeners = [];
  const event = (e) => {
    state = CausalState.reduce(state, e);
    try {
      storage.setItem(CausalState.KEY, JSON.stringify(state));
    } catch {}
    listeners.forEach((f) => f());
  };
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const api = (window.Causality = {
    COURSE,
    units,
    state: () => state,
    event,
    isDone: (id) => state.units[id]?.status === "demonstrated",
    loadProgress: () => state.units,
    markDone: (id, done) => {
      if (!done) event({ type: "reset-unit", unit: id });
    },
    reset() {
      const keys = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith("causality.")) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
      state = CausalState.migrate();
    },
    subscribe: (f) => listeners.push(f),
  });
  function predict(el, id, k) {
    const question = el.textContent.trim(),
      options = (el.dataset.options || "").split("|"),
      correct = +el.dataset.answer;
    el.innerHTML = `<div class="predict-label">Predict → explore → explain</div><p>${esc(question)}</p><div class="predict-opts">${options.map((v, i) => `<button data-choice="${i}" class="predict-opt">${esc(v)}</button>`).join("")}</div><p class="predict-result" role="status"></p>`;
    el.querySelectorAll("button").forEach(
      (b) =>
        (b.onclick = () => {
          const yes = +b.dataset.choice === correct;
          event({
            type: "exercise",
            unit: id,
            id: "prediction-" + k,
            variant: 0,
            answer: b.dataset.choice,
            correct: yes,
          });
          el.querySelector(".predict-result").textContent = yes
            ? "That prediction fits this example. " + el.dataset.hint
            : "Test that prediction with the controls, then try again. " +
              el.dataset.hint;
          el.querySelectorAll("button").forEach((x) =>
            x.setAttribute("aria-pressed", String(x === b)),
          );
        }),
    );
  }
  function settings() {
    const box = document.createElement("details");
    box.className = "course-settings";
    box.innerHTML =
      '<summary>Learning and display settings</summary><label>Learning mode <select id="course-mode"><option value="guided">Guided: one step at a time</option><option value="explore">Explore: all views</option></select></label><label>Theme <select id="course-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label class="course-check"><input type="checkbox" id="course-beats"> Reveal one idea at a time (guided mode)</label><p>Saved on this device. Progress records attempts, assistance, and successful transfer checks separately.</p>';
    for (const key of ["mode", "theme"]) {
      const sel = box.querySelector("#course-" + key);
      sel.value = state.settings[key] || (key === "mode" ? "guided" : "system");
      sel.onchange = () => {
        event({ type: "settings", value: { [key]: sel.value } });
        applySettings();
        window.dispatchEvent(new Event("causality:settings"));
      };
    }
    const beatBox = box.querySelector("#course-beats");
    beatBox.checked = state.settings.beats !== false;
    beatBox.onchange = () => {
      event({ type: "settings", value: { beats: beatBox.checked } });
      window.dispatchEvent(new Event("causality:settings"));
    };
    return box;
  }
  function applySettings() {
    document.body.dataset.mode = state.settings.mode || "guided";
    const theme = state.settings.theme;
    if (theme && theme !== "system")
      document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }
  document.addEventListener("DOMContentLoaded", () => {
    applySettings();
    const id = document.body.dataset.lesson,
      wrap = document.querySelector(".wrap") || document.body;
    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#main-content";
    skip.textContent = "Skip navigation";
    document.body.prepend(skip);
    wrap.id = "main-content";
    wrap.tabIndex = -1;
    wrap.prepend(settings());
    if (!id) return;
    const i = units.findIndex((u) => u.id === id);
    if (i < 0) return;
    // Navigation stays inside a track: the core route or the elective branch.
    const u = units[i],
      track = units.filter((v) => !!v.elective === !!u.elective),
      t = track.findIndex((v) => v.id === u.id),
      prev = track[t - 1],
      next = track[t + 1];
    document.body.style.setProperty("--stage", `var(--s-${u.stage})`);
    document.body.dataset.stage = u.stage;
    const bar = document.createElement("nav");
    bar.className = "course-bar";
    bar.setAttribute("aria-label", "Course");
    bar.innerHTML = `<a class="course-home" href="../index.html">Causality</a><span class="course-where"><span class="course-stage">${u.elective ? "elective" : esc(u.stage)}</span> ${u.elective ? "E" : ""}${t + 1} / ${track.length} · ${esc(u.chapter.title)}</span><span class="course-nav">${prev ? `<a href="${prev.file}">← Previous</a>` : ""}<a href="../index.html">Map</a><a href="../glossary.html">Symbols</a>${next ? `<a href="${next.file}">Next →</a>` : ""}</span>`;
    document.body.insertBefore(bar, wrap);
    const road = document.createElement("nav");
    road.className = "roadmap";
    road.setAttribute("aria-label", "Causal roadmap");
    road.innerHTML = COURSE.roadmap
      .map(
        (s) =>
          `<span ${u.stage === s ? 'aria-current="step"' : ""}>${esc(s)}</span>`,
      )
      .join('<span aria-hidden="true">→</span>');
    (wrap.querySelector(".lede") || wrap.querySelector("h1")).after(road);
    const contract = document.createElement("details");
    contract.className = "contract-reminder";
    contract.innerHTML =
      '<summary>Your estimand contract</summary><p></p><p class="note">This is your saved question. Each lesson labels the target used in its worked example; an ATE influence function does not automatically apply to ATT, ATC, a risk ratio, or a survival target.</p><a href="00-causal-roadmap.html">Revise the question and assumptions</a>';
    const contractText = () => {
      contract.querySelector("p").textContent =
        CausalState.describeContract(state.contract);
    };
    contractText();
    listeners.push(contractText);
    road.after(contract);
    if (u.prerequisites.length) {
      const p = document.createElement("p");
      p.className = "note";
      p.innerHTML =
        "Builds on " +
        u.prerequisites
          .map((pid) => {
            const prior = units.find((v) => v.id === pid);
            return `<a href="${prior.file}">${esc(prior.title)}</a>`;
          })
          .join(", ") +
        ". You can enter any lesson directly.";
      contract.after(p);
    }
    let scenes = [
      ...wrap.querySelectorAll(".scene,.act,.lab-step,[data-scene]"),
    ];
    if (scenes.length) {
      const idx = document.createElement("nav");
      idx.className = "scene-index";
      idx.setAttribute("aria-label", "Lesson scenes");
      scenes.forEach((s, k) => {
        s.id ||= id + "-scene-" + (k + 1);
        const a = document.createElement("a");
        a.href = "#" + s.id;
        a.textContent = s.dataset.title || "Scene " + (k + 1);
        idx.append(a);
      });
      contract.after(idx);
    }
    wrap.querySelectorAll(".predict").forEach((el, k) => predict(el, id, k));
    if (prev?.recap?.length) {
      const recap = document.createElement("details");
      recap.className = "recap";
      recap.innerHTML =
        "<summary>Retrieve before you begin: " + esc(prev.title) + "</summary>";
      prev.recap.slice(0, 2).forEach((q, k) => {
        const el = document.createElement("div");
        el.className = "predict";
        el.textContent = q.q;
        el.dataset.options = q.options.join("|");
        el.dataset.answer = q.answer;
        el.dataset.hint = q.hint;
        recap.append(el);
        predict(el, id, "recall-" + k);
      });
      contract.after(recap);
    }
    if (!wrap.querySelector("[data-lab]")) {
      const headings = [...wrap.querySelectorAll(":scope > h2")];
      const starts = headings.map((h) =>
        h.previousElementSibling?.classList.contains("eyebrow")
          ? h.previousElementSibling
          : h,
      );
      const panels = [];
      headings.forEach((h, k) => {
        const panel = document.createElement("section");
        panel.className = "legacy-step";
        panel.id = id + "-topic-" + k;
        const stop = starts[k + 1] || null;
        let node = starts[k];
        node.before(panel);
        while (node && node !== stop) {
          const after = node.nextSibling;
          panel.append(node);
          node = after;
        }
        panels.push(panel);
      });
      if (panels.length > 1) {
        const nav = document.createElement("nav");
        nav.className = "step-nav";
        nav.setAttribute("aria-label", "Guided lesson topics");
        let selected = Math.min(
          panels.length - 1,
          state.settings["topic-" + id] || 0,
        );
        const update = () => {
          panels.forEach((p, k) => {
            p.hidden = state.settings.mode !== "explore" && k !== selected;
            nav.children[k].setAttribute(
              "aria-current",
              k === selected ? "step" : "false",
            );
          });
        };
        const select = (k) => {
          selected = k;
          event({ type: "settings", value: { ["topic-" + id]: k } });
          update();
        };
        panels.forEach((p, k) => {
          const b = document.createElement("button");
          CausalCourseNav.label(b, k + 1, headings[k].textContent);
          b.onclick = () => select(k);
          nav.append(b);
          const row = document.createElement("div");
          row.className = "btns step-btns";
          if (k > 0) {
            const back = document.createElement("button");
            back.textContent = "← Previous topic";
            back.onclick = () => select(k - 1);
            row.append(back);
          }
          if (k < panels.length - 1) {
            const next = document.createElement("button");
            next.textContent = "Continue →";
            next.className = "step-next primary";
            next.onclick = () => {
              if (window.CausalBeats?.next(p)) return;
              select(k + 1);
              // Land the new topic just under the sticky course bar.
              beats.land(panels[k + 1]);
              const h = headings[k + 1];
              if (!h.hasAttribute("tabindex")) h.tabIndex = -1;
              h.focus({ preventScroll: true });
            };
            row.append(next);
          }
          p.append(row);
        });
        panels[0].before(nav);
        window.addEventListener("causality:settings", update);
        const hash = () => {
          const target = beats.find(location.hash.slice(1)),
            k = target ? panels.findIndex((p) => p.contains(target)) : -1;
          if (k >= 0) select(k);
        };
        window.addEventListener("hashchange", hash);
        update();
        hash();
      }
    }
    const practice = document.createElement("section");
    wrap.append(practice);
    CausalPractice.mount(practice, id, api);
    const footer = document.createElement("footer");
    footer.className = "course-foot";
    footer.innerHTML =
      '<div class="course-foot-inner"><div><strong class="course-status"></strong><p class="course-foot-sub">This status describes the transfer check, not mastery of the whole topic.</p><button class="course-reset">Reset this lesson</button></div>' +
      (next
        ? `<a class="course-btn" href="${next.file}">Next: ${esc(next.title)} →</a>`
        : '<a class="course-btn" href="../index.html">Return to the map</a>') +
      "</div>";
    wrap.after(footer);
    const refresh = () => {
      const status = state.units[id]?.status || "new";
      footer.querySelector(".course-status").textContent = {
        new: "Ready to explore",
        explored: "Explored",
        attempted: "Transfer check attempted",
        assisted: "Practiced with assistance",
        demonstrated: "Transfer check demonstrated",
      }[status];
    };
    listeners.push(refresh);
    refresh();
    footer.querySelector(".course-reset").onclick = () => {
      event({ type: "reset-unit", unit: id });
      location.reload();
    };
    const saved = state.forms[id] || {};
    const fields = [...wrap.querySelectorAll("input[id],select[id]")].filter(
      (el) =>
        !el.closest(".course-settings,.practice") &&
        !el.closest("[data-lab]") &&
        !el.closest(".fp"),
    );
    fields.forEach((el) => {
      if (Object.hasOwn(saved, el.id)) {
        if (el.type === "checkbox") el.checked = !!saved[el.id];
        else el.value = saved[el.id];
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    const saveForm = () =>
      event({
        type: "form",
        unit: id,
        value: Object.fromEntries(
          fields.map((el) => [
            el.id,
            el.type === "checkbox" ? el.checked : el.value,
          ]),
        ),
      });
    fields.forEach((el) => el.addEventListener("change", saveForm));
    wrap.addEventListener(
      "input",
      (e) => {
        if (!e.target.closest(".course-settings"))
          event({ type: "explore", unit: id });
      },
      { once: true },
    );
    wrap.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("button")) event({ type: "explore", unit: id });
      },
      { once: true },
    );
    // Associate every legacy numeric cell with its row and column; no color-only feedback.
    const labelInputs = () => {
      wrap.querySelectorAll("input").forEach((el) => {
        if (el.labels?.length || el.hasAttribute("aria-label")) return;
        const row = el.closest("tr"),
          table = el.closest("table");
        if (row) {
          const c = [...row.children].findIndex((td) => td.contains(el)),
            heading =
              table?.querySelector("thead tr")?.children[c]?.textContent;
          el.setAttribute(
            "aria-label",
            [row.children[0]?.textContent, heading || el.dataset.k || el.id]
              .filter(Boolean)
              .join(", "),
          );
        } else el.setAttribute("aria-label", el.id || "Value");
      });
    };
    labelInputs();
    new MutationObserver(labelInputs).observe(wrap, {
      childList: true,
      subtree: true,
    });
    CausalVisuals.enhance();
    // Contextual vocabulary stays beside the equation instead of navigating away.
    wrap.querySelectorAll(".eq").forEach((eq) => {
      const details = document.createElement("details");
      details.className = "notation-key";
      details.innerHTML =
        '<summary>Read these symbols</summary><p>P₀: true law · P̂: fitted law · Pₙ: empirical average · Ψ: target map · ψ₀=Ψ(P₀): true value · D*: efficient influence function · h: score · g (also π): propensity · m (also μ): outcome regression.</p><a href="../glossary.html">Full symbol dictionary</a>';
      eq.after(details);
    });
    beats.init(
      id,
      () => state.settings.mode !== "explore" && state.settings.beats !== false,
    );
  });
})();
