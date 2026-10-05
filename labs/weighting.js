/* Weighting foundations page: the mix balance, standardization with a prediction,
 * the two worlds and their weighted rebuild, a positivity failure, a quick check,
 * and the appendix (tabs, stress lab, doubly robust table).
 * Optional page: nothing here records course progress.
 */
(function () {
  "use strict";
  const W = CausalWeighting, WORLD = W.MORTALITY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const risk = (x, a) => WORLD.base + WORLD.sev * x + WORLD.effect * a;
  const MINUS = "−";
  const pct = (v, d) => {
    if (v === null || !Number.isFinite(v)) return "not identified";
    const p = 100 * v, places = d ?? (Math.abs(p - Math.round(p)) < 0.05 ? 0 : 1);
    return (p < 0 ? MINUS : "") + Math.abs(p).toFixed(places) + "%";
  };
  const pts = (v, d = 0) => v === null || !Number.isFinite(v) ? "not identified"
    : (v > 1e-9 ? "+" : v < -1e-9 ? MINUS : "") + Math.abs(100 * v).toFixed(d) + " points";
  const num = (v, d = 2) => v === null || !Number.isFinite(v) ? "n/a" : (+v).toFixed(d);
  const trim = (v) => String(+(+v).toFixed(2));

  try {
    const theme = JSON.parse(localStorage.getItem("causality.progress.v2") || "{}")?.settings?.theme;
    if (["light", "dark"].includes(theme)) document.documentElement.dataset.theme = theme;
  } catch {}


  /* ── Small utilities ─────────────────────────────────── */
  function onResize(fn) {
    let t, w = innerWidth;
    addEventListener("resize", () => {
      clearTimeout(t);
      t = setTimeout(() => { if (innerWidth !== w) { w = innerWidth; fn(); } }, 120);
    });
  }
  function tween(el, to, fmt, ms = 800) {
    const from = +el.dataset.v || 0;
    el.dataset.v = to;
    if (reduce() || !Number.isFinite(from) || Math.abs(from - to) < 1e-9) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const bringIntoView = (el) => {
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: r.height < innerHeight ? "nearest" : "start", behavior: reduce() ? "auto" : "smooth" });
  };
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(list, seed) {
    const r = rng(seed), a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ── Reading progress ────────────────────────────────── */
  const bar = $(".wt-progress span");
  function progress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, scrollY / max) : 0) + ")";
  }
  addEventListener("scroll", progress, { passive: true });
  progress();

  /* ── Hover terms: keep tips on screen, Escape closes ─── */
  $$(".term").forEach((t) => {
    const fit = () => {
      const tip = $(".tip", t);
      tip.classList.remove("flip");
      if (innerWidth > 640 && tip.getBoundingClientRect().right > innerWidth - 12) tip.classList.add("flip");
    };
    t.addEventListener("mouseenter", fit);
    t.addEventListener("focus", fit);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.activeElement && document.activeElement.classList.contains("term")) document.activeElement.blur();
  });

  /* ── 01 · Every average is a mix ─────────────────────── */
  (function mixFigure() {
    const fig = $("#fig-mix"), stage = $(".mix-stage", fig), input = $("#mix-share");
    const RATES = [risk(0, 0), risk(1, 0)];
    let share = +input.value;
    function layout() {
      const width = Math.max(300, Math.min(stage.clientWidth || 640, 960));
      const H = 166, L = 28, R = width - 28, beamY = 118;
      const x = (v) => L + (v / 0.6) * (R - L);
      const ticks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((v, i) => width > 520 || i % 2 === 0);
      stage.innerHTML =
        `<svg viewBox="0 0 ${width} ${H}" width="${width}" height="${H}" role="presentation">` +
        ticks.map((v) => `<line class="tick" x1="${x(v)}" x2="${x(v)}" y1="${beamY + 3}" y2="${beamY + 9}"/><text x="${x(v)}" y="${beamY + 22}" text-anchor="middle">${Math.round(v * 100)}%</text>`).join("") +
        [0, 1].map((s) =>
          `<text class="lbl" x="${x(RATES[s])}" y="16" text-anchor="middle">${s ? "HIGH SEVERITY" : "LOW SEVERITY"}</text>` +
          `<text x="${x(RATES[s])}" y="32" text-anchor="middle">${Math.round(RATES[s] * 100)}% die</text>` +
          `<line class="stem" data-stem="${s}" x1="${x(RATES[s])}" x2="${x(RATES[s])}" y1="40" y2="${beamY}"/>` +
          `<circle class="${s ? "w-high" : "w-low"}" data-w="${s}" cx="${x(RATES[s])}" cy="${beamY}" r="0"/>`).join("") +
        `<line class="beam" x1="${L}" x2="${R}" y1="${beamY}" y2="${beamY}"/>` +
        `<g class="mover"><polygon class="fulcrum" points="0,${beamY + 2} -11,${beamY + 22} 11,${beamY + 22}"/>` +
        `<text class="lbl fulcrum-lbl" x="0" y="${beamY + 40}" text-anchor="middle"></text></g></svg>`;
      fig._x = x; fig._beamY = beamY;
      update(true);
    }
    function update(instant) {
      const x = fig._x, beamY = fig._beamY, rate = (1 - share) * RATES[0] + share * RATES[1];
      [1 - share, share].forEach((w, s) => {
        const r = 30 * Math.sqrt(w), c = stage.querySelector(`[data-w="${s}"]`), stem = stage.querySelector(`[data-stem="${s}"]`);
        c.setAttribute("r", r.toFixed(2));
        c.setAttribute("cy", (beamY - r - 1.5).toFixed(2));
        stem.setAttribute("y2", (beamY - 2 * r - 1.5).toFixed(2));
      });
      const mover = stage.querySelector(".mover");
      if (instant) mover.style.transition = "none";
      mover.style.transform = `translateX(${x(rate)}px)`;
      if (instant) { mover.getBoundingClientRect(); mover.style.transition = ""; }
      stage.querySelector(".fulcrum-lbl").textContent = pct(rate);
      $("#mix-share-out").textContent = pct(share);
      $("#mix-eq").textContent = `Hospital death rate: ${(1 - share).toFixed(2)} × 20% + ${share.toFixed(2)} × 50% = ${pct(rate)}`;
    }
    input.addEventListener("input", () => { share = +input.value; update(false); });
    layout();
    onResize(layout);
  })();

  /* ── 02 · Compare at the same mix ────────────────────── */
  (function standardization() {
    const fig = $("#fig-std"), pop = W.population({ outcome: WORLD });
    const toggle = $("#std-toggle"), predict = $("#std-predict");
    function set(mode) {
      fig.classList.toggle("is-std", mode === "std");
      const rates = {};
      for (const a of [1, 0]) {
        const arm = pop.arms[a], row = $(`.std-row[data-arm="${a}"]`, fig);
        const hs = mode === "std" ? pop.cfg.pHigh : arm.highShare;
        $(".seg-low", row).style.width = 100 * (1 - hs) + "%";
        $(".seg-high", row).style.width = 100 * hs + "%";
        rates[a] = mode === "std" ? arm.standardized : arm.mean;
        tween($(".std-rate output", row), rates[a], (v) => pct(v, 0));
        $(".std-count", row).textContent = mode === "std" ? "reweighted to the 50/50 mix" : `${Math.round(arm.n * arm.mean)} of ${Math.round(arm.n)} died`;
        $(".std-mix", row).textContent = mode === "std" ? "50% low · 50% high · the hospital's mix" : `${pct(1 - hs)} low · ${pct(hs)} high`;
        $(".std-bar", row).setAttribute("aria-label", `${a ? "Treated" : "Untreated"} patients at ${mode === "std" ? "the hospital's 50/50 mix" : "their own mix"}: ` +
          `${pct(1 - hs)} low severity with ${pct(risk(0, a))} deaths, ${pct(hs)} high severity with ${pct(risk(1, a))} deaths. Overall ${pct(rates[a])}.`);
      }
      $("#std-diff").innerHTML = `Treated minus untreated: <b>${pts(rates[1] - rates[0])}</b>` +
        (mode === "std" ? " at the same mix" : "");
      $$("button", toggle).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mix === mode)));
    }
    $$("button", toggle).forEach((b) => b.addEventListener("click", () => set(b.dataset.mix)));
    for (const a of [1, 0]) $(`.std-row[data-arm="${a}"] .std-rate output`, fig).dataset.v = pop.arms[a].mean;
    const FEEDBACK = {
      1: "Right. The treated do better within each severity group, so they do better at any shared mix.",
      0: "That is what the raw rates suggest. Within each severity group, though, the treated do better, so at a shared mix they come out ahead.",
      same: "Within each severity group the treated do better, so at a shared mix they come out ahead by 10 points.",
    };
    $$("[data-guess]", predict).forEach((b) => b.addEventListener("click", () => {
      if (predict.classList.contains("done")) return;
      predict.classList.add("done");
      $$("[data-guess]", predict).forEach((o) => { o.setAttribute("aria-pressed", String(o === b)); o.setAttribute("aria-disabled", "true"); });
      $("#std-feedback").textContent = FEEDBACK[b.dataset.guess];
      toggle.hidden = false;
      bringIntoView(fig);
      setTimeout(() => {
        set("std");
        $("#std-after").hidden = false;
      }, reduce() ? 0 : 450);
    }));
    set("own");
  })();

  /* ── 03 to 05 · Two worlds and their rebuild ─────────── */
  /* People 0-49 have low severity, 50-99 high. Treatment and deaths are exact
   * counts placed by a fixed shuffle, so the picture looks natural but every
   * number matches the hospital: 10/40 treated, deaths 1, 8, 16 and 5. */
  function hospital(gLow, gHigh) {
    const g = [gLow, gHigh], people = [];
    for (const x of [0, 1]) {
      const ids = Array.from({ length: 50 }, (_, k) => x * 50 + k);
      const nT = Math.round(50 * g[x]);
      const treated = new Set(shuffled(ids, 11 + x).slice(0, nT));
      for (const a of [1, 0]) {
        const arm = ids.filter((i) => treated.has(i) === !!a);
        const died = new Set(shuffled(arm, 101 + 7 * x + a).slice(0, Math.round(arm.length * risk(x, a))));
        for (const i of arm) people[i] = { i, x, a, died: died.has(i), g: g[x] };
      }
    }
    return people;
  }
  /* For world w, every missing patient in a stratum becomes a stand-in for a seen
   * patient of the same severity. Dead stand-ins come from dead patients and
   * live ones from live patients, in the proportions the weights imply. */
  function rebuild(people, w) {
    const plan = { ghosts: {}, stuck: new Set(), sources: {} };
    for (const x of [0, 1]) {
      const stratum = people.filter((p) => p.x === x);
      const seen = stratum.filter((p) => p.a === w), missing = stratum.filter((p) => p.a !== w);
      if (!seen.length) { missing.forEach((p) => plan.stuck.add(p.i)); continue; }
      const weight = stratum.length / seen.length;
      const deadSeen = seen.filter((p) => p.died), aliveSeen = seen.filter((p) => !p.died);
      const deadGhosts = Math.round(deadSeen.length * weight) - deadSeen.length;
      const order = shuffled(missing.map((p) => p.i), 301 + 13 * x + w);
      order.forEach((cell, k) => {
        const dead = k < deadGhosts, pool = dead ? deadSeen : aliveSeen;
        const idx = dead ? k : k - deadGhosts, src = pool[idx % pool.length];
        plan.ghosts[cell] = { died: dead, x, src: src.i };
        (plan.sources[src.i] ||= []).push(cell);
      });
    }
    return plan;
  }
  function worldsFigure(fig, opts) {
    const pair = $(".worlds-pair", fig), status = $(".worlds-status", fig);
    let gHigh = 0.8, stage = fig.dataset.stage || "seen", ppl = [];
    function drawWorld(host, w, animate) {
      const width = Math.max(140, host.clientWidth || 300);
      const narrow = width < 260, room = narrow ? 28 : 40, lab = narrow && !w ? 0 : room;
      const pitch = Math.max(11, Math.min(26, Math.floor((width - room) / 10))), r = pitch * 0.36, gap = Math.max(6, Math.round(pitch * 0.36));
      const H = pitch * 10 + gap + 4, Wd = lab + pitch * 10;
      const plan = stage === "seen" ? null : rebuild(ppl, w);
      const rowY = (row) => 2 + pitch / 2 + row * pitch + (row >= 5 ? gap : 0);
      let html = `<svg viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" aria-hidden="true" focusable="false">` +
        (lab ? `<text x="0" y="${rowY(2) + 3}"${narrow ? ' style="font-size:8px"' : ""}>Low</text><text x="0" y="${rowY(7) + 3}"${narrow ? ' style="font-size:8px"' : ""}>High</text>` : "");
      let order = 0;
      for (const p of ppl) {
        const k = p.i - p.x * 50, row = p.x * 5 + Math.floor(k / 10), col = k % 10;
        const cx = lab + pitch / 2 + col * pitch, cy = rowY(row), sev = p.x ? "high" : "low";
        if (p.a === w) {
          html += `<g class="p seen" data-i="${p.i}" transform="translate(${cx} ${cy})"><circle class="${p.died ? "died" : "alive"} ${sev}" r="${r}"/></g>`;
        } else if (plan && plan.ghosts[p.i]) {
          const gh = plan.ghosts[p.i];
          html += `<g class="p ghost${animate ? " hidden-ghost" : ""}" data-i="${p.i}" data-src="${gh.src}" style="--d:${order++}" transform="translate(${cx} ${cy})"><circle class="${gh.died ? "died" : "alive"} ${sev}" r="${r * 0.92}"/></g>`;
        } else {
          const stuck = plan && plan.stuck.has(p.i);
          html += `<g class="p missing${stuck ? " stuck" : ""}" data-i="${p.i}" transform="translate(${cx} ${cy})"><circle class="miss" r="${r}"/>${pitch >= 15 ? '<text class="q">?</text>' : ""}</g>`;
        }
      }
      const box = host.querySelector(".w-svg");
      box.innerHTML = html + "</svg>";
      box.tabIndex = 0;
      box.setAttribute("role", "group");
      box.setAttribute("aria-label", `World ${w} patients. Arrow keys step through the patients seen in this world.`);
      host._plan = plan;
      if (animate) {
        const ghosts = $$(".p.ghost", host);
        ghosts.forEach((g) => { g.querySelector("circle").style.transitionDelay = (reduce() ? 0 : +g.style.getPropertyValue("--d") * 9) + "ms"; });
        requestAnimationFrame(() => requestAnimationFrame(() => ghosts.forEach((g) => g.classList.remove("hidden-ghost"))));
      }
      const seen = ppl.filter((p) => p.a === w), deaths = seen.filter((p) => p.died).length;
      const bySev = [0, 1].map((x) => seen.filter((p) => p.x === x).length);
      const read = host.querySelector(".w-read");
      if (stage === "seen") {
        read.innerHTML = `Seen: <b>${bySev[0]}</b> of 50 low, <b>${bySev[1]}</b> of 50 high.<br>Deaths among them: <b>${deaths} of ${seen.length}</b>.`;
      } else if (plan.stuck.size) {
        read.innerHTML = `<span class="bad">Cannot rebuild.</span> No high-severity patient was seen here, so no one can stand in for the ${plan.stuck.size} empty seats.`;
      } else {
        const ghostDeaths = Object.values(plan.ghosts).filter((g) => g.died).length, total = deaths + ghostDeaths;
        read.innerHTML = `Rebuilt: <b>100</b> patients, <b>${total}</b> deaths (${total}%).<br>${bySev[0]} low and ${bySev[1]} high, weighted to 50 and 50.`;
      }
    }
    function clearAll() {
      $$(".world", pair).forEach((h) => h.classList.remove("hl"));
      $$(".p.on, .p.twin", pair).forEach((n) => n.classList.remove("on", "twin"));
    }
    function show(host, node) {
      const w = +host.dataset.world, p = ppl[+node.dataset.i];
      if (!p) return;
      clearAll();
      const twin = pair.querySelector(`.world[data-world="${1 - w}"] .p[data-i="${p.i}"]`);
      if (twin) twin.classList.add("twin");
      const chance = w ? p.g : 1 - p.g, weight = 1 / chance, sev = p.x ? "high" : "low";
      const who = `${w ? "Treated" : "Untreated"}, ${sev} severity, ${p.died ? "died" : "survived"}.`;
      if (stage === "seen") {
        status.textContent = `${who} Seen in World ${w}; the same seat in World ${1 - w} is empty. Chance of being seen in World ${w}: ${num(chance, 1)}.`;
        return;
      }
      host.classList.add("hl");
      node.classList.add("on");
      const cells = (host._plan.sources[p.i] || []);
      cells.forEach((c) => host.querySelector(`.p[data-i="${c}"]`)?.classList.add("on"));
      const nSeen = ppl.filter((q) => q.x === p.x && q.a === w).length;
      const per = Math.round(1 / (weight - Math.floor(weight) || 1));
      const share = Math.abs(weight - 1) < 1e-9 ? "speaks only for themselves: every patient like them was seen here."
        : Math.abs(weight - Math.round(weight)) < 1e-9
        ? `speaks for ${Math.round(weight)} people: themselves and ${Math.round(weight) - 1} stand-ins.`
        : `has weight ${num(weight)}. The ${nSeen} ${sev}-severity patients seen here speak for all 50, so every ${per} of them share one stand-in.`;
      status.textContent = `${who} Chance of this treatment: ${num(chance, 1)}, so this patient ${share}`;
    }
    function wire() {
      $$(".world", pair).forEach((host) => {
        const box = $(".w-svg", host);
        let cur = -1;
        host.addEventListener("pointerover", (e) => { const n = e.target.closest(".p.seen"); if (n) show(host, n); });
        host.addEventListener("click", (e) => { const n = e.target.closest(".p.seen"); if (n) show(host, n); });
        box.addEventListener("keydown", (e) => {
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (!step) return;
          e.preventDefault();
          const nodes = $$(".p.seen", host);
          if (!nodes.length) return;
          cur = cur < 0 ? 0 : (cur + step + nodes.length) % nodes.length;
          nodes.forEach((n) => n.classList.remove("kb"));
          nodes[cur].classList.add("kb");
          show(host, nodes[cur]);
        });
        box.addEventListener("blur", () => { $$(".p.kb", host).forEach((n) => n.classList.remove("kb")); clearAll(); });
      });
      pair.addEventListener("pointerleave", clearAll);
    }
    function draw(animate = false) {
      ppl = hospital(0.2, gHigh);
      pair.innerHTML = [1, 0].map((w) =>
        `<div class="world" data-world="${w}"><h3>World ${w}</h3>` +
        `<p class="w-sub">${w ? "Everyone treated" : "No one treated"} · Y(${w})</p><div class="w-svg"></div><p class="w-read"></p></div>`).join("");
      $$(".world", pair).forEach((host) => drawWorld(host, +host.dataset.world, animate));
      wire();
      if (opts.after) opts.after(stage, gHigh);
    }
    fig._set = (next) => { if ("stage" in next) stage = next.stage; if ("gHigh" in next) gHigh = next.gHigh; draw(!!next.animate); };
    draw(false);
    onResize(() => draw(false));
    return fig;
  }

  const legend = (fig) => {
    const dot = (cls, extra = "") => `<svg viewBox="-8 -8 16 16" aria-hidden="true"><g class="p ${extra}"><circle class="${cls}" r="6"/></g></svg>`;
    $(".worlds-legend", fig).innerHTML =
      `<span>${dot("alive low")}Low severity</span><span>${dot("alive high")}High severity</span><span>${dot("died low")}Died (ring shows severity)</span>` +
      `<span><svg viewBox="-8 -8 16 16" aria-hidden="true"><g class="p"><circle class="miss" r="6"/><text class="q" style="font-size:7px">?</text></g></svg>Empty seat: not seen in this world</span>` +
      (fig.id === "fig-worlds-seen" ? "" : `<span>${dot("alive high", "ghost")}${dot("died high", "ghost")}Faded: stand-ins created by the weights</span>`);
  };


  const rebuildFig = $("#fig-worlds-rebuild");
  legend(rebuildFig);
  const rb = worldsFigure(rebuildFig, {
    after(stage) {
      const done = stage !== "seen";
      $('[data-act="rebuild"]', rebuildFig).hidden = done;
      $('[data-act="reset"]', rebuildFig).hidden = !done;
      $(".worlds-result", rebuildFig).hidden = !done;
    },
  });
  $('[data-act="rebuild"]', rebuildFig).addEventListener("click", () => {
    rb._set({ stage: "rebuilt", animate: true });
    $(".worlds-status", rebuildFig).textContent = "Each empty seat now holds a faded stand-in copied from a seen patient with the same severity. Hover or tap a seen patient to see their weight.";
    $("#rebuild-after").hidden = false;
    $('[data-act="reset"]', rebuildFig).focus({ preventScroll: true });
    bringIntoView($(".worlds-pair", rebuildFig));
  });
  $('[data-act="reset"]', rebuildFig).addEventListener("click", () => {
    rb._set({ stage: "seen" });
    $(".worlds-status", rebuildFig).textContent = "Hover or tap a seen patient for details.";
    $('[data-act="rebuild"]', rebuildFig).focus({ preventScroll: true });
  });

  const posFig = $("#fig-worlds-positivity");
  legend(posFig);
  const pf = worldsFigure(posFig, {
    after(stage, gHigh) {
      const broken = gHigh >= 1;
      $(".worlds-status", posFig).innerHTML = broken
        ? "World 0 cannot be rebuilt. There is no untreated high-severity patient to weight, and the weight 1 / (1 − 1) has no value, so the data alone <b>cannot identify</b> the average treatment effect. An outcome model could extrapolate to those seats, but nothing in the data could check it."
        : "Both worlds rebuilt: 25% and 35%. Use the toggle to treat every high-severity patient.";
    },
  });
  $$(".wt-toggle button", posFig).forEach((b) => b.addEventListener("click", () => {
    $$(".wt-toggle button", posFig).forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    pf._set({ stage: "rebuilt", gHigh: b.dataset.pos === "on" ? 1 : 0.8, animate: true });
    bringIntoView($(".worlds-pair", posFig));
  }));

  /* ── Appendix tabs ───────────────────────────────────── */
  const tabs = $$('.tabs [role="tab"]');
  function selectTab(panelId, focus = false) {
    tabs.forEach((t) => {
      const on = t.getAttribute("aria-controls") === panelId;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t.getAttribute("aria-controls")));
    t.addEventListener("keydown", (e) => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      selectTab(tabs[(n + tabs.length) % tabs.length].getAttribute("aria-controls"), true);
    });
  });

  /* Old anchors from the previous version of this page keep working. */
  const ALIAS = { sampling: "s-mix", score: "s-worlds", rebalance: "s-weight", diagnostics: "ax-checks", returns: "s-family" };
  function openHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    if (ALIAS[id]) { id = ALIAS[id]; history.replaceState(null, "", "#" + id); }
    const el = document.getElementById(id);
    if (!el) return;
    const panel = el.closest('[role="tabpanel"]');
    if (panel) {
      selectTab(panel.id);
      requestAnimationFrame(() => $("#appendix").scrollIntoView({ block: "start" }));
    } else {
      requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
    }
  }
  addEventListener("hashchange", openHash);
  /* In-page links replace the hash instead of adding history entries, so the
   * back link below can return to the lesson with one step back. */
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !a.hash) return;
    e.preventDefault();
    history.replaceState(null, "", a.hash);
    openHash();
    if (a.hash === "#main") $("#main").focus({ preventScroll: true });
  });

  /* Route back to wherever the reader came from: ?from= names the entry point.
   * When the previous history entry is that lesson, step back so it keeps its
   * guided step, revealed beats and scroll position. */
  (function returnRoute() {
    const ROUTES = {
      roadmap: ["../lessons/00-causal-roadmap.html", "Back to the roadmap"],
      bridge: ["../lessons/00-causal-roadmap.html#weighting-bridge", "Back to the roadmap"],
      "two-strata": ["../lessons/06-two-strata.html", "Back to Two strata, one step"],
      "clever-covariate": ["../lessons/07-clever-covariate.html", "Back to the clever covariate"],
    };
    let from = null;
    try { from = new URLSearchParams(location.search).get("from"); } catch {}
    const [href, label] = ROUTES[from] || ROUTES.bridge, target = new URL(href, location.href);
    $$("[data-return]").forEach((a) => {
      a.href = href;
      const text = a.querySelector(".wt-back-label");
      if (text) text.textContent = label;
      a.addEventListener("click", (e) => {
        try {
          const ref = new URL(document.referrer);
          if (ref.origin === location.origin && ref.pathname === target.pathname && history.length > 1) {
            e.preventDefault();
            history.back();
          }
        } catch {}
      });
    });
  })();
  openHash();

  /* ── Appendix lab ────────────────────────────────────── */
  (function lab() {
    const KEY = "causality.lab.propensity-weighting.hospital";
    const RANGES = { pHigh: [0.1, 0.9], gLow: [0, 1], gHigh: [0, 1] };
    let cfg = { ...W.DEFAULTS };
    try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch {}
    function clean() {
      for (const [k, [lo, hi]] of Object.entries(RANGES)) cfg[k] = Number.isFinite(+cfg[k]) ? Math.min(hi, Math.max(lo, +cfg[k])) : W.DEFAULTS[k];
      if (!["correct", "constant"].includes(cfg.scoreMode)) cfg.scoreMode = "correct";
      if (!["unstabilized", "stabilized"].includes(cfg.weightMode)) cfg.weightMode = "unstabilized";
      for (const k of Object.keys(cfg)) if (!(k in W.DEFAULTS)) delete cfg[k];
    }
    clean();
    const controls = { pHigh: $("#lab-p"), gLow: $("#lab-gl"), gHigh: $("#lab-gh"), scoreMode: $("#lab-score"), weightMode: $("#lab-mode") };
    function set(patch) {
      Object.assign(cfg, patch);
      clean();
      try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
      render();
    }
    for (const [k, el] of Object.entries(controls))
      el.addEventListener("input", () => set({ [k]: el.type === "range" ? +el.value : el.value }));
    $("#lab-rare").addEventListener("click", () => set({ gLow: 0.02, gHigh: 0.98, scoreMode: "correct" }));
    $("#lab-gone").addEventListener("click", () => set({ gHigh: 1, scoreMode: "correct" }));
    $("#lab-reset").addEventListener("click", () => { cfg = { ...W.DEFAULTS }; set({}); });

    const barRow = (label, high, cls = "") => `<div class="lab-bar ${cls}"><p><b>${label}</b><span>${high === null ? "" : pct(1 - high) + " low · " + pct(high) + " high"}</span></p>` +
      (high === null ? `<p class="none">No weighted comparison: a needed group is empty.</p>`
        : `<div class="bar" aria-hidden="true"><span class="l" style="width:${100 * (1 - high)}%"></span><span class="h" style="width:${100 * high}%"></span></div>`) + `</div>`;
    const table = (head, rows, caption) => `<div class="table-scroll" tabindex="0" role="region" aria-label="${caption}"><table><caption class="sr-only">${caption}</caption><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

    function render() {
      for (const [k, el] of Object.entries(controls)) el.value = cfg[k];
      $("#lab-p-out").textContent = pct(cfg.pHigh);
      $("#lab-gl-out").textContent = num(cfg.gLow);
      $("#lab-gh-out").textContent = num(cfg.gHigh);
      const pop = W.population({ ...cfg, outcome: WORLD });
      $("#lab-bars").innerHTML =
        barRow("Hospital · the target mix", cfg.pHigh, "target") +
        barRow("Treated · as seen", pop.arms[1].highShare) +
        barRow("Treated · weighted", pop.arms[1].weightedHighShare) +
        barRow("Untreated · as seen", pop.arms[0].highShare) +
        barRow("Untreated · weighted", pop.arms[0].weightedHighShare);
      $("#lab-results").innerHTML = [["Crude difference · points", pop.naive], ["Weighted difference · points", pop.ipw], ["True effect · points", pop.truth]]
        .map(([l, v]) => `<div><small>${l}</small><strong>${pts(v, 1).replace(" points", "")}</strong></div>`).join("");
      let msg;
      if (!pop.supported) msg = "Not identified: one severity group has no chance of one treatment, so no one can stand in for it. Weighting cannot supply evidence that was never collected.";
      else if (cfg.scoreMode === "constant") msg = "A constant score gives everyone in an arm the same weight, so the confounded mix and the crude difference stay put. It is only right when treatment does not depend on severity.";
      else msg = "Correct weights give both arms the hospital's mix and recover the true effect. These are exact expected values; with estimated weights in a real sample, check balance.";
      if (pop.supported) msg += ` Largest weight ${num(pop.maxWeight)}. Effective sample size: treated ${num(pop.arms[1].ess, 1)} of ${num(pop.arms[1].n, 1)}, untreated ${num(pop.arms[0].ess, 1)} of ${num(pop.arms[0].n, 1)}.`;
      if (pop.supported && pop.maxWeight >= 20) msg += " A few patients now carry much of the answer.";
      $("#lab-msg").textContent = msg;
      $("#lab-table").innerHTML = table(
        ["Severity", "Received", "Expected patients", "Model chance of own treatment", "Weight", "Weighted patients", "Death rate"],
        pop.cells.map((c) => [c.x ? "High" : "Low", c.a ? "Treated" : "Untreated", num(c.count, 1), num(c.ownProbability), num(c.weight), num(c.weightedCount, 1), pct(c.outcome)]),
        "Expected counts and weights in the hospital") +
        table(["Arm", "Expected patients", "Sum of weights", "Effective sample size"],
          pop.arms.map((a) => [a.a ? "Treated" : "Untreated", num(a.n, 1), num(a.totalWeight, 1), num(a.ess, 1)]),
          "Representation and weight concentration");
      $("#dr-table").innerHTML = table(["Outcome model", "Propensity model", "Population AIPW", "True effect"], [
        ["Right", "Right", pts(W.aipw({ ...cfg, outcome: WORLD, scoreMode: "correct" }, true), 1), pts(WORLD.effect, 1)],
        ["Wrong: ignores severity", "Right", pts(W.aipw({ ...cfg, outcome: WORLD, scoreMode: "correct" }, false), 1), pts(WORLD.effect, 1)],
        ["Right", "Wrong: 0.5 for everyone", pts(W.aipw({ ...cfg, outcome: WORLD, scoreMode: "constant" }, true), 1), pts(WORLD.effect, 1)],
        ["Wrong: ignores severity", "Wrong: 0.5 for everyone", pts(W.aipw({ ...cfg, outcome: WORLD, scoreMode: "constant" }, false), 1), pts(WORLD.effect, 1)],
      ], "Double robustness in the hospital");
    }
    render();
  })();
})();
