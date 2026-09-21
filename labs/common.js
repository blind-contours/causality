(function () {
  const S = CausalScience,
    V = CausalVisuals,
    esc = (s) =>
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
  function store(name, defaults, ranges = {}) {
    let state = { ...defaults };
    const sharedFromHash = () => {
      try {
        const raw = new URLSearchParams(location.hash.slice(1)).get("lab");
        if (!raw) return null;
        const shared = JSON.parse(raw);
        return shared.name === name && shared.version === 1
          ? shared.state
          : null;
      } catch {
        return null;
      }
    };
    try {
      state = {
        ...state,
        ...JSON.parse(localStorage.getItem("causality.lab." + name) || "{}"),
      };
    } catch {}
    state = { ...state, ...(sharedFromHash() || {}) };
    function clean() {
      for (const [k, v] of Object.entries(defaults)) {
        if (typeof v === "number") {
          state[k] = Number.isFinite(+state[k]) ? +state[k] : v;
          if (ranges[k])
            state[k] = Math.max(ranges[k][0], Math.min(ranges[k][1], state[k]));
        } else if (typeof v === "boolean") state[k] = state[k] === true;
        else if (ranges[k] && !ranges[k].includes(state[k])) state[k] = v;
      }
      for (const k of Object.keys(state)) if (!(k in defaults)) delete state[k];
    }
    clean();
    const listeners = [];
    // A share link pasted while this page is already open only changes the hash.
    window.addEventListener("hashchange", () => {
      const shared = sharedFromHash();
      if (shared) api.set(shared);
    });
    const api = {
      get: () => ({ ...state }),
      set(p) {
        Object.assign(state, p);
        clean();
        try {
          localStorage.setItem("causality.lab." + name, JSON.stringify(state));
        } catch {}
        listeners.forEach((f) => f(state));
      },
      subscribe: (f) => listeners.push(f),
      reset() {
        this.set(defaults);
        window.dispatchEvent(
          new CustomEvent("causality:lab-reset", { detail: { name } }),
        );
      },
      share() {
        const u = new URL(location.href);
        u.hash = new URLSearchParams({
          lab: JSON.stringify({ version: 1, name, state }),
        }).toString();
        return u.href;
      },
    };
    return api;
  }
  function control(el, state, key) {
    const read = () => {
      const value = state.get()[key];
      if (el.type === "checkbox") el.checked = value;
      else el.value = value;
    };
    read();
    state.subscribe(read);
    el.addEventListener(el.type === "number" ? "change" : "input", () =>
      state.set({
        [key]:
          el.type === "checkbox"
            ? el.checked
            : el.type === "range" || el.type === "number"
              ? +el.value
              : el.value,
      }),
    );
  }
  function tools(el, state) {
    const row = document.createElement("div");
    row.className = "btns";
    row.innerHTML =
      '<button class="reset-lab">Reset laboratory</button><button class="share-lab">Share this configuration</button><span class="share-result" role="status"></span>';
    el.append(row);
    row.querySelector(".reset-lab").onclick = () => state.reset();
    row.querySelector(".share-lab").onclick = async () => {
      const url = state.share(),
        out = row.querySelector(".share-result");
      try {
        await navigator.clipboard.writeText(url);
        out.textContent = "Configuration link copied.";
      } catch {
        out.replaceChildren();
        const a = document.createElement("a");
        a.href = url;
        a.textContent = "Open this configuration link";
        out.append(a);
      }
    };
  }
  function guided(root, state) {
    const panels = [...root.querySelectorAll(".lab-step")],
      nav = document.createElement("nav");
    nav.className = "step-nav";
    nav.setAttribute("aria-label", "Learning steps");
    panels.forEach((p, i) => {
      p.id ||= "step-" + (i + 1);
      const b = document.createElement("button");
      b.textContent = i + 1 + ". " + p.dataset.title;
      b.onclick = () => {
        state.set({ step: i });
        p.querySelector("h2")?.focus();
      };
      nav.append(b);
      const btns = document.createElement("div");
      btns.className = "btns";
      if (i > 0) {
        const back = document.createElement("button");
        back.textContent = "← Previous step";
        back.onclick = () => state.set({ step: i - 1 });
        btns.append(back);
      }
      if (i < panels.length - 1) {
        const next = document.createElement("button");
        next.textContent = "Continue →";
        next.onclick = () => {
          state.set({ step: i + 1 });
          panels[i + 1].scrollIntoView({ block: "start", behavior: "instant" });
        };
        btns.append(next);
      }
      p.append(btns);
    });
    root.prepend(nav);
    const update = () => {
      const explore = document.body.dataset.mode === "explore";
      panels.forEach((p, i) => {
        p.hidden = !explore && i !== state.get().step;
        nav.children[i].setAttribute(
          "aria-current",
          i === state.get().step ? "step" : "false",
        );
      });
    };
    state.subscribe(update);
    window.addEventListener("causality:settings", update);
    document.addEventListener("DOMContentLoaded", update);
    const followHash = () => {
      const target = document.getElementById(location.hash.slice(1));
      const index = panels.findIndex(
        (panel) => panel === target || panel.contains(target),
      );
      if (index >= 0) state.set({ step: index });
    };
    window.addEventListener("hashchange", followHash);
    update();
    followHash();
  }
  function table(headers, rows, caption = "Current numerical values") {
    return `<div class="table-wrap"><table><caption>${esc(caption)}</caption><thead><tr>${headers.map((h) => '<th scope="col">' + esc(h) + "</th>").join("")}</tr></thead><tbody>${rows.map((row) => "<tr>" + row.map((v, i) => (i ? "<td>" : '<th scope="row">') + esc(v) + (i ? "</td>" : "</th>")).join("") + "</tr>").join("")}</tbody></table></div>`;
  }
  const fmt = (x, d = 3) =>
    Number.isFinite(x) ? Number(x.toFixed(d)).toString() : "undefined";
  window.CausalLab = { S, V, esc, store, control, tools, guided, table, fmt };
})();
