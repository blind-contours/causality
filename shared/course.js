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
  /* Beats: inside the current guided step, one small idea at a time. Each step's direct children
   * are grouped into consecutive beats (heading with its first paragraph, controls with their
   * figure, readouts and tables with the figure they describe, one paragraph / note / predict box
   * each). Hidden beats use the hidden attribute. The step's single Continue button first reveals
   * the next beat, then moves on to the next step. Explore mode, or the setting "Reveal one idea at
   * a time" switched off, shows everything. */
  const beats = (function () {
    const steps = new Map(); // panel -> {groups, shown, row, next, own, dots, gate}
    let lessonId = "",
      enabledFn = () => false,
      lastPointer = "mouse",
      saved = {};
    const KEY = () => "causality.beats." + lessonId;
    const reduced = () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const FIG =
      "svg,canvas,figure,table,.figure,.scene,.paper,.stage,[data-figure],.table-wrap,.lab-grid,.figure-viewport,[data-simulation]";
    const INTERACTIVE =
      "a,button,input,select,textarea,label,summary,details,svg,canvas,table,[data-figure],.scene,.figure,.figure-viewport,.predict,[contenteditable],[role=slider],[role=button],[tabindex]:not([tabindex='-1'])";
    function kind(el) {
      if (/^H[1-6]$/.test(el.tagName) || el.classList.contains("eyebrow"))
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
    // Group a step's direct children into beats. Every group is a contiguous run of siblings.
    function split(panel) {
      const groups = [];
      let cur = null,
        lead = [],
        held = [];
      const open = (type, els) => {
        cur = { type, els };
        groups.push(cur);
      };
      for (const el of [...panel.children]) {
        if (el.classList.contains("step-btns") || el.classList.contains("beat"))
          continue;
        if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName)) continue;
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
    // Initial reveal: the first beat, plus the first figure when it follows directly.
    function initial(groups) {
      if (groups[0].type === "predict" || groups[0].type === "visual") return 1;
      return groups[1]?.type === "visual" ? 2 : 1;
    }
    function enabled() {
      return enabledFn();
    }
    function persist() {
      try {
        sessionStorage.setItem(KEY(), JSON.stringify(saved));
      } catch {}
    }
    function render(panel) {
      const s = steps.get(panel);
      if (!s) return;
      const on = enabled(),
        n = s.groups.length;
      s.groups.forEach((g, k) => (g.wrap.hidden = on && k >= s.shown));
      const more = on && s.shown < n;
      s.dots.hidden = !more;
      s.dots.replaceChildren(
        ...s.groups.map((_, k) => {
          const d = document.createElement("i");
          if (k < s.shown) d.className = "on";
          return d;
        }),
      );
      s.dots.title = s.shown + " of " + n + " ideas shown";
      const btn = s.next || s.own;
      if (s.own) s.own.hidden = !more;
      if (more) {
        btn.textContent = "Continue";
        btn.setAttribute(
          "aria-label",
          "Show the next idea (" + (s.shown + 1) + " of " + n + ")",
        );
        btn.classList.add("beat-more");
      } else if (s.next) {
        btn.textContent = s.nextLabel;
        btn.removeAttribute("aria-label");
        btn.classList.remove("beat-more");
      }
    }
    function scrollTo(panel, wrap) {
      const s = steps.get(panel),
        r = wrap.getBoundingClientRect(),
        row = s.row.getBoundingClientRect(),
        bottom = Math.max(r.bottom, s.row.offsetParent ? row.bottom : r.bottom) + 16,
        delta = Math.min(bottom - innerHeight, r.top - 72);
      if (delta > 0)
        window.scrollBy({ top: delta, behavior: reduced() ? "auto" : "smooth" });
    }
    // Reveal the next beat of a step. Returns true when there was one to reveal.
    function next(panel, opts = {}) {
      const s = steps.get(panel);
      if (!s || !enabled() || s.shown >= s.groups.length) return false;
      const g = s.groups[s.shown];
      s.shown++;
      saved[panel.id] = s.shown;
      persist();
      render(panel);
      if (!reduced()) {
        g.wrap.classList.remove("beat-enter");
        void g.wrap.offsetWidth;
        g.wrap.classList.add("beat-enter");
      }
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        scrollTo(panel, g.wrap);
        if (opts.focus !== false) g.wrap.focus({ preventScroll: true });
      });
      return true;
    }
    function revealTo(target) {
      for (const [panel, s] of steps) {
        if (!panel.contains(target) || panel === target) continue;
        const k = s.groups.findIndex((g) => g.wrap.contains(target));
        if (k >= s.shown) {
          s.shown = k + 1;
          saved[panel.id] = s.shown;
          persist();
          render(panel);
          requestAnimationFrame(() =>
            window.dispatchEvent(new Event("resize")),
          );
        }
      }
    }
    function current() {
      for (const panel of steps.keys()) if (!panel.hidden) return panel;
      return null;
    }
    function attach(panel) {
      const row = panel.querySelector(":scope > .step-btns");
      if (!row || steps.has(panel)) return;
      const groups = split(panel);
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
      const dots = document.createElement("span");
      dots.className = "beat-dots";
      dots.setAttribute("aria-hidden", "true");
      (nextBtn || own).before(dots);
      const s = {
        groups,
        row,
        dots,
        next: nextBtn,
        own,
        nextLabel: nextBtn?.textContent,
        shown: Math.min(
          groups.length,
          Math.max(initial(groups), +saved[panel.id] || 0),
        ),
      };
      steps.set(panel, s);
      // A predict box is a gate: answering it opens the next idea.
      panel.addEventListener("click", (e) => {
        const opt = e.target.closest(".predict-opt"),
          w = opt?.closest(".beat");
        if (opt && w && w.parentElement === panel) {
          const k = groups.findIndex((g) => g.wrap === w);
          if (k === s.shown - 1 && !w.dataset.answered) {
            w.dataset.answered = "1";
            setTimeout(() => next(panel, { focus: false }), 450);
          }
          return;
        }
        // On touch, tapping blank space in the step shows the next idea.
        if (
          lastPointer === "touch" &&
          !e.target.closest(INTERACTIVE) &&
          (getSelection?.().isCollapsed ?? true)
        )
          next(panel, { focus: false });
      });
      render(panel);
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
      const hash = () => {
        let target = null;
        try {
          target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        } catch {}
        if (target) revealTo(target);
      };
      window.addEventListener("hashchange", hash);
      hash();
    }
    return { init, next, revealTo, attach };
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
              panels[k + 1].scrollIntoView({ block: "start" });
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
          const target = document.getElementById(location.hash.slice(1)),
            k = panels.findIndex((p) => p.contains(target));
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
