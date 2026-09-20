/* Shared navigation, learning events and persistence. No completion by scrolling. */
(function () {
  "use strict";
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
      '<summary>Learning and display settings</summary><label>Learning mode <select id="course-mode"><option value="guided">Guided: one step at a time</option><option value="explore">Explore: all views</option></select></label><label>Theme <select id="course-theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><p>Saved on this device. Progress records attempts, assistance, and successful transfer checks separately.</p>';
    for (const key of ["mode", "theme"]) {
      const sel = box.querySelector("#course-" + key);
      sel.value = state.settings[key] || (key === "mode" ? "guided" : "system");
      sel.onchange = () => {
        event({ type: "settings", value: { [key]: sel.value } });
        applySettings();
        window.dispatchEvent(new Event("causality:settings"));
      };
    }
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
    const u = units[i],
      prev = units[i - 1],
      next = units[i + 1];
    const bar = document.createElement("nav");
    bar.className = "course-bar";
    bar.setAttribute("aria-label", "Course");
    bar.innerHTML = `<a class="course-home" href="../index.html">Causality</a><span>${i + 1} / ${units.length} · ${esc(u.chapter.title)}</span><span class="course-nav">${prev ? `<a href="${prev.file}">← Previous</a>` : ""}<a href="../index.html">Map</a><a href="../glossary.html">Symbols</a>${next ? `<a href="${next.file}">Next →</a>` : ""}</span>`;
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
      '<summary>Your estimand contract</summary><p></p><a href="00-causal-roadmap.html">Revise the question and assumptions</a>';
    const contractText = () => {
      contract.querySelector("p").textContent =
        `Target: ${state.contract.target === "ate" ? "population average treatment effect" : "treated population average treatment effect"}. High-severity prevalence: ${Math.round(state.contract.population * 100)}%. Survival horizon: ${state.contract.horizon} years. This is your saved question; individual lessons label their own toy examples.`;
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
          b.textContent = k + 1 + ". " + headings[k].textContent;
          b.onclick = () => select(k);
          nav.append(b);
          const row = document.createElement("div");
          row.className = "btns";
          if (k > 0) {
            const back = document.createElement("button");
            back.textContent = "← Previous topic";
            back.onclick = () => select(k - 1);
            row.append(back);
          }
          if (k < panels.length - 1) {
            const next = document.createElement("button");
            next.textContent = "Continue →";
            next.onclick = () => {
              select(k + 1);
              panels[k + 1].scrollIntoView({ block: "start" });
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
  });
})();
