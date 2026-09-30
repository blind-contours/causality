/* For your trial: the page. Reads the form into a state object, and renders the estimand, sample
 * size, sensitivity, operating characteristics, SAP text, reviewer questions and R script from the
 * pure kernels in science/trial.js (CausalTrial) and science/trial-sap.js (CausalTrialSAP).
 * State lives in the URL hash (shareable) with a localStorage copy as a convenience. */
(function () {
  "use strict";
  const T = window.CausalTrial,
    S = window.CausalTrialSAP;
  const $ = (sel, root = document) => root.querySelector(sel);
  const form = $("#trial-form");
  const esc = (t) =>
    String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pct = (p, d = 0) => `${(100 * p).toFixed(d)}%`;
  const num = (n) => n.toLocaleString("en-US");

  const PRESETS = {
    device: {
      trialName: "TRIAL-X",
      product: "device",
      population: "Adults with severe, symptomatic tricuspid regurgitation despite medical therapy",
      treatment: "Transcatheter valve plus medical therapy",
      control: "Medical therapy alone",
      endpointName: "Change in KCCQ overall summary score from baseline",
      timepoint: "12 months",
      endpoint: "continuous",
      measure: "rd",
      events: [
        { name: "Death before 12 months", strategy: "composite" },
        { name: "Crossover to the device", strategy: "treatment-policy" },
      ],
      delta: 8,
      sd: 22,
      p0: 0.3,
      p1: 0.2,
      alpha: 0.05,
      power: 0.9,
      ratio: 1,
      dropoutPct: 10,
      r2: 0.3,
      r2Source: "a registry analysis of 12-month KCCQ change",
      covariates: "Baseline KCCQ, age, NYHA class, atrial fibrillation",
      strata: "Region",
      sizing: "conservative",
    },
    drug: {
      trialName: "",
      product: "drug",
      population: "Adults with moderate to severe disease meeting the protocol criteria",
      treatment: "Study drug",
      control: "Placebo",
      endpointName: "Clinical response",
      timepoint: "week 16",
      endpoint: "binary",
      measure: "rd",
      events: [
        { name: "Discontinuation of study drug", strategy: "treatment-policy" },
        { name: "Use of rescue therapy", strategy: "composite" },
      ],
      delta: 0.3,
      sd: 1,
      p0: 0.25,
      p1: 0.4,
      alpha: 0.05,
      power: 0.9,
      ratio: 1,
      dropoutPct: 5,
      r2: 0.15,
      r2Source: "the Phase 2 trial, pooled over arms",
      covariates: "Baseline severity score, prior biologic use, age",
      strata: "Prior biologic use",
      sizing: "adjusted",
    },
    blank: {
      trialName: "",
      product: "drug",
      population: "",
      treatment: "",
      control: "",
      endpointName: "",
      timepoint: "",
      endpoint: "continuous",
      measure: "rd",
      events: [],
      delta: 0.3,
      sd: 1,
      p0: 0.3,
      p1: 0.2,
      alpha: 0.05,
      power: 0.9,
      ratio: 1,
      dropoutPct: 10,
      r2: 0.2,
      r2Source: "",
      covariates: "",
      strata: "",
      sizing: "conservative",
    },
  };

  /* ---------- State in and out of the form ---------- */
  let state = null;
  let oc = null; // last simulation results, tagged with the planning key they were run for
  let running = null;

  function readForm() {
    const f = new FormData(form),
      g = (k) => (f.get(k) ?? "").toString();
    const events = [...document.querySelectorAll("#ie-rows .ie-row")].map((row) => ({
      name: $("input", row).value,
      strategy: $("select", row).value,
    }));
    return {
      trialName: g("trialName").trim(),
      product: g("product"),
      population: g("population").trim(),
      treatment: g("treatment").trim(),
      control: g("control").trim(),
      endpointName: g("endpointName").trim(),
      timepoint: g("timepoint").trim(),
      endpoint: g("endpoint"),
      measure: g("measure"),
      events,
      delta: +g("delta"),
      sd: +g("sd"),
      p0: +g("p0"),
      p1: +g("p1"),
      alpha: +g("alpha"),
      power: +g("power"),
      ratio: +g("ratio"),
      dropoutPct: +g("dropoutPct"),
      r2: +g("r2"),
      r2Source: g("r2Source").trim(),
      covariates: g("covariates"),
      strata: g("strata"),
      sizing: g("sizing") || "conservative",
    };
  }
  function writeForm(s) {
    for (const [k, v] of Object.entries(s)) {
      if (k === "events") continue;
      const els = form.elements.namedItem(k);
      if (!els) continue;
      if (els instanceof RadioNodeList) [...els].forEach((r) => (r.checked = r.value === String(v)));
      else els.value = v;
    }
    const rows = $("#ie-rows");
    rows.innerHTML = "";
    (s.events || []).forEach((e) => addEvent(e));
  }
  function addEvent(e = { name: "", strategy: "treatment-policy" }) {
    const rows = $("#ie-rows");
    if (rows.children.length >= 6) return;
    const row = document.createElement("div");
    row.className = "ie-row";
    row.innerHTML = `<input aria-label="Intercurrent event" placeholder="e.g. Discontinuation of treatment" value="${esc(e.name)}" /><select aria-label="Strategy">${Object.entries(
      S.STRATEGIES,
    )
      .map(([k, v]) => `<option value="${k}"${k === e.strategy ? " selected" : ""}>${v.label}</option>`)
      .join("")}</select><button type="button" class="ie-del" aria-label="Remove this event">Remove</button>`;
    $(".ie-del", row).addEventListener("click", () => {
      row.remove();
      update();
    });
    rows.append(row);
  }

  // The inputs the kernels see: validated and clamped, never NaN.
  function model(s) {
    const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    return {
      ...s,
      endpoint: s.endpoint === "binary" ? "binary" : "continuous",
      measure: s.endpoint === "binary" ? s.measure : "md",
      delta: Number.isFinite(s.delta) ? s.delta : 0,
      sd: clamp(s.sd, 1e-6, 1e9, 1),
      p0: clamp(s.p0, 0.005, 0.995, 0.3),
      p1: clamp(s.p1, 0.005, 0.995, 0.2),
      alpha: clamp(s.alpha, 0.001, 0.2, 0.05),
      power: clamp(s.power, 0.5, 0.99, 0.9),
      ratio: clamp(Math.round(s.ratio), 1, 3, 1),
      dropout: clamp(s.dropoutPct, 0, 60, 10) / 100,
      r2: clamp(s.r2, 0, 0.7, 0.2),
    };
  }
  const planKey = (m) =>
    JSON.stringify([m.endpoint, m.measure, m.delta, m.sd, m.p0, m.p1, m.alpha, m.power, m.ratio, m.r2, m.sizing]);

  /* ---------- Persistence ---------- */
  function encode(s) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decode(t) {
    try {
      const b = t.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch {
      return null;
    }
  }
  function save(s) {
    const h = "#t=" + encode(s);
    try {
      history.replaceState(null, "", h);
    } catch {}
    try {
      localStorage.setItem("causality.trial.v1", JSON.stringify(s));
    } catch {}
  }
  function load() {
    const m = location.hash.match(/#t=([\w-]+)/);
    if (m) {
      const s = decode(m[1]);
      if (s) return { ...PRESETS.blank, ...s };
    }
    try {
      const s = JSON.parse(localStorage.getItem("causality.trial.v1") || "null");
      if (s) return { ...PRESETS.blank, ...s };
    } catch {}
    return PRESETS.device;
  }

  /* ---------- Renderers ---------- */
  function renderEstimand(m) {
    const e = S.estimand(m);
    const ev = e.events.length
      ? `<ul>${e.events.map((x) => `<li><b>${esc(x.name)}</b>: ${esc(x.label.toLowerCase())}. <span>${esc(x.sentence)}</span></li>`).join("")}</ul>`
      : `<p class="warn">None listed yet. Most trials have at least one; add them above.</p>`;
    $("#estimand-card").innerHTML = `<h3>Your estimand</h3><dl>
      <div><dt>Population</dt><dd>${esc(e.population)}</dd></div>
      <div><dt>Treatment</dt><dd>${esc(e.treatment)}</dd></div>
      <div><dt>Endpoint</dt><dd>${esc(e.variable)}</dd></div>
      <div><dt>Intercurrent events</dt><dd>${ev}</dd></div>
      <div><dt>Summary</dt><dd>${esc(e.summary)}</dd></div></dl>`;
  }

  function renderSize(p, m) {
    const out = $("#size-out");
    if (!p.ok) {
      out.innerHTML = `<p class="warn">${esc(p.reason)}</p>`;
      $("#sens").innerHTML = "";
      return;
    }
    const max = p.unadjusted.enrolled,
      w = (n) => `${Math.max(2, (100 * n) / max).toFixed(1)}%`;
    const conservative = m.sizing !== "adjusted";
    out.innerHTML = `
      <div class="size-grid">
        <div class="size-row unadj${conservative ? " chosen" : ""}">
          <span class="size-label">Unadjusted analysis</span>
          <span class="size-bar"><i style="width:${w(p.unadjusted.enrolled)}"></i></span>
          <span class="size-n"><b>${num(p.unadjusted.enrolled)}</b> randomized <small>${num(p.unadjusted.evaluable)} evaluable</small></span>
        </div>
        <div class="size-row adj${conservative ? "" : " chosen"}">
          <span class="size-label">Covariate-adjusted</span>
          <span class="size-bar"><i style="width:${w(p.adjusted.enrolled)}"></i></span>
          <span class="size-n"><b>${num(p.adjusted.enrolled)}</b> randomized <small>${num(p.adjusted.evaluable)} evaluable</small></span>
        </div>
      </div>
      <p class="size-head">${
        conservative
          ? `Sized for the unadjusted analysis, the adjusted primary analysis has about <b>${pct(p.powerBuffer)}</b> power instead of ${pct(m.power)}.`
          : `Sized for the adjusted analysis, the trial needs <b>${num(p.saved.enrolled)} fewer patients</b> (${pct(p.saved.share)}) for the same ${pct(m.power)} power.`
      }</p>
      <p class="hint">Same estimand, same α. The adjusted variance is ${pct(p.variance.ratio)} of the unadjusted one${
        m.endpoint === "continuous" ? ", which is 1 − R²" : ""
      }. Large-sample normal approximation.</p>`;
    renderSensitivity(p, m);
  }

  function renderSensitivity(p, m) {
    const fig = $("#sens");
    const W = Math.round(Math.max(300, Math.min(560, fig.clientWidth || 560))), H = W < 420 ? 220 : 200, L = 44, R = 12, Tp = 26, B = 40;
    const xs = (f) => L + (1 - f) * (W - L - R),
      lo = 0.5,
      ys = (v) => Tp + (1 - (Math.max(lo, v) - lo) / (1 - lo)) * (H - Tp - B);
    const n = m.sizing === "adjusted" ? p.adjusted.evaluable : p.unadjusted.evaluable;
    // Dense curve of power of the adjusted analysis at the chosen n as the true R² shrinks.
    const pts = [];
    for (let k = 0; k <= 40; k++) {
      const f = k / 40,
        a = T.asymptotic(T.world({ ...m, r2: m.r2 * f }), m.measure, T.piOf(m.ratio));
      pts.push([f, T.powerAt(n, a.adjusted, a.effect, m.alpha)]);
    }
    const path = pts.map(([f, v], i) => `${i ? "L" : "M"}${xs(f).toFixed(1)},${ys(v).toFixed(1)}`).join("");
    const target = ys(m.power);
    const ticksY = [0.5, 0.6, 0.7, 0.8, 0.9, 1]
      .map((v) => `<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" class="grid"/><text x="${L - 6}" y="${ys(v) + 4}" class="tick" text-anchor="end">${pct(v)}</text>`)
      .join("");
    const ticksX = [1, 0.75, 0.5, 0.25, 0]
      .map((f) => `<text x="${xs(f)}" y="${H - B + 16}" class="tick" text-anchor="${f === 1 ? "start" : f === 0 ? "end" : "middle"}">${(m.r2 * f).toFixed(2)}</text>`)
      .join("");
    const half = pts[20][1];
    fig.innerHTML = `<figcaption><b>If the covariates are weaker than you assumed.</b> Power of the adjusted analysis with ${num(n)} evaluable patients, as the true R² falls from your ${m.r2.toFixed(2)} to zero.</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Power falls from ${pct(pts[40][1])} at the assumed R² to ${pct(half)} at half of it and ${pct(pts[0][1])} at zero.">
        ${ticksY}${ticksX}
        <line x1="${L}" x2="${W - R}" y1="${target}" y2="${target}" class="target"/>
        <text x="${L + 6}" y="${target + 15}" class="tick target-label">target ${pct(m.power)}</text>
        <path d="${path}" class="curve"/>
        <circle cx="${xs(1)}" cy="${ys(pts[40][1])}" r="4.5" class="dot"/>
        <circle cx="${xs(0.5)}" cy="${ys(half)}" r="4.5" class="dot half"/>
        <text x="${xs(0.5)}" y="${Math.abs(ys(half) - target) < 20 && ys(half) >= target - 2 ? ys(half) + 20 : ys(half) - 10}" class="tick ink" text-anchor="middle">half the R²: ${pct(half)}</text>
        <text x="${(L + W - R) / 2}" y="${H - 6}" class="tick" text-anchor="middle">true R²</text>
      </svg>`;
  }

  function renderOC(m) {
    const out = $("#oc-out");
    if (!oc) {
      out.innerHTML = `<p class="hint">Not run yet. It takes a few seconds in your browser.</p>`;
      return;
    }
    const stale = oc.key !== planKey(m);
    const ratioNote = S.MEASURE_WORDS[m.measure].ratio ? " Bias, SD and SE are on the log scale." : "";
    const cell = (v, good) => `<td${good === false ? ' class="bad"' : ""}>${pct(v, 1)}</td>`;
    const mc = (q) => 2.6 * Math.sqrt((q * (1 - q)) / oc.reps);
    const rows = oc.results
      .map((r) =>
        ["adjusted", "unadjusted"]
          .map((k, j) => {
            const x = r[k],
              okT1 = r.key !== "null" || Math.abs(x.rejectRate - m.alpha) <= mc(m.alpha) + 0.005,
              okCov = Math.abs(x.coverage - (1 - m.alpha)) <= mc(1 - m.alpha) + 0.005;
            return `<tr class="${k}">${j === 0 ? `<th scope="rowgroup" rowspan="2">${esc(r.label)}</th>` : ""}<td class="an">${k === "adjusted" ? "Adjusted (primary)" : "Unadjusted"}</td>${cell(x.rejectRate, okT1)}${cell(x.coverage, okCov)}<td>${x.bias.toFixed(3)}</td><td>${x.empiricalSD.toFixed(3)}</td><td>${x.meanSE.toFixed(3)}</td></tr>`;
          })
          .join(""),
      )
      .join("");
    const [nul, planned, stress] = oc.results;
    out.innerHTML = `${stale ? `<p class="warn">Inputs changed since this run. Simulate again to update.</p>` : ""}
      <div class="oc-cards">
        <div><span>Type I error, adjusted</span><b>${pct(nul.adjusted.rejectRate, 1)}</b><small>target ${pct(m.alpha, 1)}, simulation noise ±${pct(1.96 * Math.sqrt((m.alpha * (1 - m.alpha)) / oc.reps), 1)}</small></div>
        <div><span>Power, adjusted</span><b>${pct(planned.adjusted.rejectRate, 1)}</b><small>unadjusted ${pct(planned.unadjusted.rejectRate, 1)}</small></div>
        <div><span>Coverage when the model is wrong</span><b>${pct(stress.adjusted.coverage, 1)}</b><small>target ${pct(1 - m.alpha, 0)}</small></div>
      </div>
      <p class="oc-caption">${num(oc.reps)} simulated trials per scenario, ${num(oc.n)} evaluable patients, ${m.ratio === 1 ? "1:1" : m.ratio + ":1"} randomization</p>
      <div class="table-wrap"><table class="oc-table">
        <thead><tr><th scope="col">Scenario</th><th scope="col" class="an">Analysis</th><th scope="col">Rejects H₀</th><th scope="col">CI covers truth</th><th scope="col">Bias</th><th scope="col">Empirical SD</th><th scope="col">Mean SE</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="hint">Under no effect, "rejects H₀" is the type I error; under an effect it is power. The stress scenario bends the true relationship between the covariates and the endpoint while the prespecified working model stays linear: validity holds, some of the gain is lost.${ratioNote} Monte Carlo error is about ±${pct(mc(0.5) / 2.6 * 1.96, 1)} on a rate near 50%.</p>`;
  }

  /* A small Markdown renderer for the SAP text: headings, paragraphs, lists (two levels), tables,
   * bold, italics and links. Input is escaped first. */
  function md(text) {
    const inline = (t) =>
      esc(t)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, "$1<em>$2</em>")
        .replace(/(https:\/\/[^\s)]+)/g, '<a href="$1" rel="noopener">$1</a>');
    const lines = text.split("\n"),
      out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (!l.trim()) {
        i++;
        continue;
      }
      const h = l.match(/^(#{1,3}) (.*)$/);
      if (h) {
        const lv = h[1].length + 2;
        out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
        i++;
        continue;
      }
      if (l.startsWith("|")) {
        const rows = [];
        while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[i++]);
        const cells = (r) => r.split("|").slice(1, -1).map((c) => c.trim());
        const head = cells(rows[0]),
          body = rows.slice(2).map(cells);
        out.push(
          `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
            .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody></table></div>`,
        );
        continue;
      }
      if (/^\s*- /.test(l)) {
        let html = "<ul>",
          open = false;
        while (i < lines.length && /^\s*- /.test(lines[i])) {
          const sub = /^\s{2,}- /.test(lines[i]),
            t = lines[i].replace(/^\s*- /, "");
          if (sub && !open) {
            html = html.replace(/<\/li>$/, "") + "<ul>";
            open = true;
          } else if (!sub && open) {
            html += "</ul></li>";
            open = false;
          }
          html += `<li>${inline(t)}</li>`;
          i++;
        }
        if (open) html += "</ul></li>";
        out.push(html + "</ul>");
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#|\||\s*- )/.test(lines[i])) para.push(lines[i++]);
      out.push(`<p>${inline(para.join(" "))}</p>`);
    }
    return out.join("\n");
  }

  let sapText = "",
    rText = "";
  function renderText(m, p) {
    const ocForText = oc && oc.key === planKey(m) ? Object.assign(oc.results.slice(), { reps: oc.reps, n: oc.n }) : null;
    sapText = S.sap(m, p, ocForText);
    $("#sap-doc").innerHTML = md(sapText);
    const qs = S.reviewerQuestions(m, p);
    $("#rev").innerHTML = qs
      .map(
        (q, i) =>
          `<details class="rev-q"${i < 2 ? " open" : ""}><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p><p class="rev-src">Source: ${esc(q.source)}</p></details>`,
      )
      .join("");
    rText = S.rCode({ ...m, nExample: p.ok ? Math.min(2000, p.adjusted.evaluable) : 400 });
    $("#r-code").textContent = rText;
  }

  function syncVisibility(m) {
    document.querySelectorAll("[data-when]").forEach((el) => {
      el.hidden = el.dataset.when !== m.endpoint;
    });
    $("#r2-out").textContent = m.r2.toFixed(2);
  }

  let lastPlan = null;
  function update() {
    state = readForm();
    const m = model(state);
    syncVisibility(m);
    renderEstimand(m);
    const p = T.plan(m);
    lastPlan = p;
    renderSize(p, m);
    renderOC(m);
    renderText(m, p);
    $("#oc-run").disabled = !p.ok || !!running;
    save(state);
  }

  /* ---------- Simulation, in slices so the page stays responsive ---------- */
  function runOC() {
    const m = model(readForm()),
      p = T.plan(m);
    if (!p.ok || running) return;
    const n = m.sizing === "adjusted" ? p.adjusted.evaluable : p.unadjusted.evaluable;
    const reps = 1000;
    const r = T.ocRunner(m, { n, reps });
    const bar = $("#oc-bar"),
      btn = $("#oc-run"),
      status = $("#oc-status");
    bar.parentElement.hidden = false;
    btn.disabled = true;
    running = r;
    status.textContent = "Simulating…";
    const tick = () => {
      if (running !== r) return;
      const t0 = performance.now();
      let done = false;
      while (!done && performance.now() - t0 < 30) done = r.step(20);
      bar.style.width = `${(100 * r.progress()).toFixed(1)}%`;
      if (!done) return requestAnimationFrame(tick);
      oc = { key: planKey(m), results: r.results(), reps, n };
      running = null;
      bar.parentElement.hidden = true;
      status.textContent = `Done: ${num(3 * reps)} trials.`;
      update();
      $("#oc-out").scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Copy and download ---------- */
  async function copy(text, msgEl, what) {
    try {
      await navigator.clipboard.writeText(text);
      msgEl.textContent = `${what} copied.`;
    } catch {
      msgEl.textContent = "Copy was blocked by the browser. Use the download instead.";
    }
    setTimeout(() => (msgEl.textContent = ""), 2500);
  }
  function download(text, name, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }
  const slug = () => (state.trialName ? S.varName(state.trialName) + "-" : "") + "primary-analysis";

  /* ---------- Wire up ---------- */
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  $("#ie-add").addEventListener("click", () => {
    addEvent();
    update();
    const rows = document.querySelectorAll("#ie-rows .ie-row input");
    rows[rows.length - 1]?.focus();
  });
  document.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      oc = null;
      writeForm(PRESETS[b.dataset.preset]);
      update();
    }),
  );
  $("#oc-run").addEventListener("click", runOC);
  let lastW = innerWidth;
  addEventListener("resize", () => {
    if (Math.abs(innerWidth - lastW) < 40) return;
    lastW = innerWidth;
    const m = model(readForm());
    if (lastPlan && lastPlan.ok) renderSensitivity(lastPlan, m);
  });
  $("#sap-copy").addEventListener("click", () => copy(sapText, $("#sap-msg"), "SAP text"));
  $("#sap-download").addEventListener("click", () => download(sapText, slug() + ".md", "text/markdown"));
  $("#share").addEventListener("click", () => copy(location.href, $("#sap-msg"), "Link"));
  $("#r-copy").addEventListener("click", () => copy(rText, $("#r-msg"), "R script"));
  $("#r-download").addEventListener("click", () => download(rText, slug() + ".R", "text/plain"));

  writeForm(load());
  update();
  window.CausalTrialPage = { update, runOC, md, get state() { return state; }, get oc() { return oc; }, get plan() { return lastPlan; } };
})();
