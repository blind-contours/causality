(function () {
  const { S, store, control, tools, guided, table, fmt } = CausalLab,
    { el, html, tween, lerp } = CausalAnim,
    root = document.querySelector("[data-lab]");
  const state = store(
    "roadmap",
    {
      ...CausalEstimands.DEFAULTS,
      step: 0,
      hidden: 0,
      exchange: true,
      consistent: true,
    },
    {
      step: [0, 5],
      gLow: [0.05, 0.95],
      effectLow: [0, 5],
      effectHigh: [0, 5],
      riskLow: [0, 0.5],
      riskHigh: [0, 0.5],
      riskMultiplier: [0, 2],
      riskContrast: ["rd", "rr"],
      tau: [0, 10],
      hazardRatio: [0.4, 1.6],
      delay: [0, 3],
      survivalContrast: ["survival", "rmst"],
      p: [0.05, 0.9],
      target: ["ate", "att", "atc"],
      gHigh: [0, 1],
      hidden: [-1, 1],
    },
  );
  root.innerHTML = `<style>
.dag-node rect{fill:var(--soft);stroke:var(--rule);stroke-width:1.2}
.dag-node text{fill:var(--ink);font:500 14px "IBM Plex Sans",system-ui,sans-serif}
.dag-node.u rect{stroke:var(--red);stroke-dasharray:4 3}
.dag-node.u text{fill:var(--red)}
.dag-edge{stroke:var(--ink);stroke-width:2;fill:none}
.dag-edge.dashed{stroke-dasharray:7 5}
.dag-edge.broken{stroke:var(--muted);stroke-dasharray:3 5;opacity:.75}
.dag-edge.u{stroke:var(--red)}
.dag-arrow.ink{fill:var(--ink)}.dag-arrow.red{fill:var(--red)}.dag-arrow.grey{fill:var(--muted)}
.dag-label{font:11.5px "IBM Plex Mono",monospace;fill:var(--muted)}
.dag-label.red{fill:var(--red)}
.nl-name,.nl-tick,.nl-val{font:11.5px "IBM Plex Mono",monospace;fill:var(--muted)}
.nl-name{fill:var(--ink)}
.nl-rail{stroke:var(--grid);stroke-width:1}
.nl-axis{stroke:var(--muted);stroke-width:1.2}
.nl-guide{stroke:var(--purple);stroke-width:1;stroke-dasharray:3 3;opacity:.6}
.nl-mark.obs{fill:var(--muted);stroke:var(--muted)}
.nl-mark.adj{fill:var(--purple);stroke:var(--purple)}
.nl-mark.adj.hollow{fill:var(--paper)}
.nl-mark.tru{fill:var(--green);stroke:var(--green)}
.nl-mark{stroke-width:2}
.nl-val.obs{fill:var(--muted)}.nl-val.adj{fill:var(--purple)}.nl-val.tru{fill:var(--green)}
.nl-bracket{stroke:var(--green);stroke-width:2;fill:none}
.nl-band{fill:var(--green);opacity:.12}
.tw-head,.tw-row,.tw-tick{font:11.5px "IBM Plex Mono",monospace;fill:var(--muted)}
.tw-head{fill:var(--ink);font-weight:500;font-size:13px}
.tw-rail{stroke:var(--grid);stroke-width:1}
.tw-axis{stroke:var(--muted);stroke-width:1.2}
.tw-mark{stroke-width:2}
.tw-mark.p{stroke:var(--p);fill:var(--p)}.tw-mark.or{stroke:var(--or);fill:var(--or)}
.tw-mark.hollow{fill:var(--paper)}
.tw-mean-obs{stroke:var(--ink);stroke-width:1.5}
.tw-mean-all{stroke:var(--purple);stroke-width:1.5;stroke-dasharray:4 3}
.tw-legend{font:11.5px "IBM Plex Mono",monospace;fill:var(--muted)}
.strip-line{stroke:var(--rule);stroke-width:2}
.strip-dot{stroke:var(--paper);stroke-width:2}
.strip-dot.ahead{opacity:.35}
.strip-ring{fill:none;stroke:var(--ink);stroke-width:1.5}
.strip-label{font:11.5px "IBM Plex Sans",system-ui,sans-serif;fill:var(--muted)}
.strip-label.now{fill:var(--ink);font-weight:600}
.strip-label.ahead{opacity:.6}
.estimand-sweep{font:500 14px "IBM Plex Mono",monospace;color:var(--ink);margin:.5rem 0 .25rem}
.estimand-sweep b{color:var(--purple)}.estimand-sweep span{display:block;color:var(--muted);font-weight:400;font-size:13px}
.kappa-box{border:1px solid var(--rule);border-radius:10px;padding:.75rem .9rem;margin:.75rem 0;background:var(--soft)}
.kappa-box>label{margin:0}
.kappa-row{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem .9rem;margin-top:.6rem}
.kappa-row label{flex:1 1 240px;margin:0}
.kappa-row input[type=range]:disabled{opacity:.45}
.kappa-hint{font-size:14px;color:var(--muted);flex:1 1 220px}
.kappa-hint button{margin-top:.35rem;min-height:40px}
</style>
${CausalEstimandScenes.populationHTML}
${CausalEstimandScenes.outcomesHTML}
<section class="lab-step" id="step-2" data-title="Identify"><h2 tabindex="-1">Why comparing the two observed groups can mislead</h2><p>Return to the one-year numerical outcome from the first scene. Severity affects both treatment and outcome; treatment probabilities and benefits are the ones you chose there. First compare the observed groups; then compare treatment and control within each severity group and average using your target population. Two pieces of notation appear below: g(x) is the chance of treatment given severity x (the propensity score), and m₁(x), m₀(x) are the mean outcomes of treated and untreated patients with severity x.</p><div class="figure" id="dag-fig-2"></div><div id="study-values"></div><div class="figure" id="line-fig"></div><details class="formula-details"><summary>Name the operation: identification by adjustment</summary><p class="math" id="adjustment-formula"></p><p>This observed-data expression equals the causal target under consistency, conditional exchangeability, and treatment positivity for the target population. For ATT, average over X among treated people and require controls wherever treated people occur. For ATC, average among untreated people and require treated observations wherever those controls occur.</p></details></section>
<section class="lab-step" id="step-3" data-title="Break an assumption"><h2 tabindex="-1">Some gaps cannot be repaired by a better estimator</h2><div class="kappa-box"><label><span><input id="exchange" type="checkbox"> Exchangeability: severity captures the common causes of treatment and outcome</span></label><div class="kappa-row"><label>Unobserved counterfactual shift κ <output id="kappa-value"></output><input id="hidden-shift" type="range" min="-1" max="1" step=".1"></label><p class="kappa-hint" id="kappa-hint"></p></div></div><label><span><input id="consistent" type="checkbox"> Treatment is well defined and observed outcomes match the corresponding intervention</span></label><label>Treatment probability among high-severity patients <input id="g-high" type="range" min="0" max="1" step=".01"></label><p id="positivity-status"></p><p id="identification-status" class="warning" role="status"></p><div class="figure" id="dag-fig-3"></div><p>Two possible worlds can have exactly the same observed patients. In the second world, add κ to Y(1) for the untreated and subtract κ from Y(0) for the treated. Their observed outcomes stay fixed, but their population ATE changes by κ. Observed data alone cannot select between those worlds.</p><p class="note">The eight-person illustration below has fixed membership and a 50/50 severity mix. It isolates the missing-counterfactual problem; its ATE is separate from the selected population average above.</p><div class="figure" id="worlds-fig"></div><p class="note">A zero population propensity is a structural absence. A positive propensity can still produce an empty cell in a small sample. Those are different problems.</p></section>
<section class="lab-step" id="step-4" data-title="Roadmap"><h2 tabindex="-1">Keep the question while the tools change</h2><div class="figure" id="strip-fig"></div><ol class="road-list"><li><b>Question:</b> choose the population, interventions, outcome, horizon, and contrast. ICH E9(R1) asks for one more attribute that this lesson left out: what to do about intercurrent events such as death, treatment crossover, or device removal, which the next lesson handles.</li><li><b>Identification:</b> state why a causal target equals a function of observed data.</li><li><b>Model:</b> say which probability distributions are allowed. The nonparametric model leaves their shapes unrestricted; semiparametric models combine finite and infinite dimensional components.</li><li><b>Estimation:</b> choose how to learn that function from a sample.</li><li><b>Uncertainty:</b> justify the approximation behind an interval.</li><li><b>Interpretation:</b> answer the original question with its assumptions and limitations.</li></ol><p>Cox regression is already a semiparametric model: a finite coefficient vector and an unspecified baseline hazard. Kaplan–Meier is a nonparametric survival estimator under its censoring conditions. The journey is to make those choices explicit and connect them to the target.</p><a class="course-btn" href="17-intercurrent-events.html">Next: When something happens after treatment starts →</a></section>`;
  /* Opening figure: meet the course cohort (figures/cohort-morph.js). */
  document
    .querySelector("#step-1 > h2")
    ?.insertAdjacentHTML(
      "afterend",
      '<p class="cohort-intro">These 100 patients stay with you for the whole course. Watch them sort themselves, then tap one to meet them.</p><div data-figure="cohort-morph" id="cohort-morph"></div>',
    );
  [
    ["g-high", "gHigh"],
    ["hidden-shift", "hidden"],
    ["exchange", "exchange"],
    ["consistent", "consistent"],
  ].forEach(([id, key]) => control(document.getElementById(id), state, key));

  /* ---- figure scaffolding: svg | caption + readout ---- */
  function figure(id, viewBox, label) {
    const fig = document.getElementById(id),
      svg = el("svg", {
        class: "fig",
        viewBox,
        role: "img",
        "aria-label": label,
      }),
      cap = html("p", { class: "fig-caption" }),
      read = html("div", { class: "fig-readout" }),
      side = html("div", {}, cap, read),
      row = html("div", { class: "fig-row" }, svg, side);
    fig.append(row);
    return {
      svg,
      caption: (t) => (cap.textContent = t),
      readout: (pairs) =>
        read.replaceChildren(
          ...pairs.flatMap(([k, v]) => [
            html("span", { class: "k" }, k),
            html("span", {}, String(v)),
          ]),
        ),
    };
  }
  /* Interpolate a flat numeric object between renders. */
  function animator(apply) {
    let cur = null,
      tw = null;
    return (next, meta) => {
      if (!cur) {
        cur = { ...next };
        apply(cur, meta);
        return;
      }
      const from = { ...cur };
      tw?.cancel();
      tw = tween({
        duration: 550,
        onUpdate: (u) => {
          for (const k in next) cur[k] = lerp(from[k] ?? next[k], next[k], u);
          apply(cur, meta);
        },
      });
    };
  }
  const rmText = (parent, cls, lines, x, y, anchor = "middle") => {
    const t = el("text", { class: cls, x, y, "text-anchor": anchor });
    lines.forEach((s, i) => t.append(el("tspan", { x, dy: i ? 13 : 0 }, s)));
    parent.append(t);
    return t;
  };

  /* ---- 1. the DAG, one function, two mounts ---- */
  const NODES = {
      X: { x: 300, y: 34, w: 118, label: "Severity X" },
      A: { x: 96, y: 132, w: 122, label: "Treatment A" },
      Y: { x: 504, y: 132, w: 116, label: "Outcome Y" },
      U: { x: 300, y: 206, w: 136, label: "Unmeasured U" },
    },
    NH = 15;
  function exitPoint(from, to, pad) {
    const dx = to.x - from.x,
      dy = to.y - from.y,
      t = Math.min(
        (from.w / 2 + pad) / Math.max(1e-9, Math.abs(dx)),
        (NH + pad) / Math.max(1e-9, Math.abs(dy)),
      );
    return [fmt(from.x + dx * t, 1), fmt(from.y + dy * t, 1)];
  }
  function makeDag(id) {
    const f = figure(
        id,
        "0 0 600 232",
        "Causal diagram: severity points to treatment and outcome, treatment points to outcome.",
      ),
      uid = id.replace(/[^a-z0-9]/gi, ""),
      defs = el("defs"),
      edges = el("g"),
      nodes = el("g"),
      labels = el("g");
    for (const kind of ["ink", "red", "grey"])
      defs.append(
        el(
          "marker",
          {
            id: `arrow-${uid}-${kind}`,
            viewBox: "0 0 10 10",
            refX: 9,
            refY: 5,
            markerWidth: 7,
            markerHeight: 7,
            orient: "auto-start-reverse",
          },
          el("path", { class: "dag-arrow " + kind, d: "M0 0L10 5L0 10Z" }),
        ),
      );
    f.svg.append(defs, edges, nodes, labels);
    const edge = (a, b, cls, kind) => {
      const [x1, y1] = exitPoint(NODES[a], NODES[b], 3),
        [x2, y2] = exitPoint(NODES[b], NODES[a], 5);
      return el("line", {
        class: "dag-edge " + cls,
        x1,
        y1,
        x2,
        y2,
        "marker-end": `url(#arrow-${uid}-${kind})`,
      });
    };
    const node = (k, cls) => {
      const n = NODES[k];
      return el(
        "g",
        { class: "dag-node " + cls },
        el("rect", {
          x: n.x - n.w / 2,
          y: n.y - NH,
          width: n.w,
          height: 2 * NH,
          rx: 8,
        }),
        el("text", { x: n.x, y: n.y + 5, "text-anchor": "middle" }, n.label),
      );
    };
    return (c, v) => {
      const posFail = c.gHigh === 0 || c.gHigh === 1;
      edges.replaceChildren(
        edge("X", "A", posFail ? "broken" : "", posFail ? "grey" : "ink"),
        edge("X", "Y", "", "ink"),
        edge("A", "Y", c.consistent ? "" : "dashed", "ink"),
        ...(c.exchange
          ? []
          : [edge("U", "A", "u", "red"), edge("U", "Y", "u", "red")]),
      );
      nodes.replaceChildren(
        node("X", ""),
        node("A", ""),
        node("Y", ""),
        ...(c.exchange ? [] : [node("U", "u")]),
      );
      labels.replaceChildren();
      if (posFail)
        rmText(
          labels,
          "dag-label",
          [
            c.gHigh === 0 ? "no treated" : "no untreated",
            "high-severity patients",
          ],
          14,
          170,
          "start",
        );
      if (!c.consistent)
        rmText(labels, "dag-label", ["ill-defined intervention"], 300, 120);
      const parts = [];
      if (c.exchange)
        parts.push(
          "Severity X causes both treatment and outcome. Adjusting for X closes the back-door path A ← X → Y.",
        );
      else
        parts.push(
          "U is an unmeasured common cause of A and Y. Adjusting for X leaves A ← U → Y open, so the observed law is compatible with causal values shifted by any κ (here κ = " +
            fmt(c.hidden) +
            ").",
        );
      if (posFail)
        parts.push(
          "g(high) = " +
            c.gHigh +
            ": the stratum has only " +
            (c.gHigh === 0 ? "controls" : "treated patients") +
            ", so the X → A edge carries no contrast there and " +
            (c.gHigh === 0 ? "m₁(high)" : "m₀(high)") +
            " is never observed.",
        );
      if (!c.consistent)
        parts.push(
          "With an ill-defined treatment the A → Y edge bundles several interventions; E[Y | A=1, X] no longer answers one question.",
        );
      f.caption(parts.join(" "));
      f.readout([
        ["g(low), g(high)", fmt(v.g[0]) + ", " + fmt(v.g[1])],
        [
          "back-door via X",
          c.exchange ? "blocked by adjustment" : "open through U",
        ],
        ["κ", c.exchange ? "0 (exchangeable)" : fmt(c.hidden)],
        ["A well defined", c.consistent ? "yes" : "no"],
      ]);
    };
  }
  const dag2 = makeDag("dag-fig-2"),
    dag3 = makeDag("dag-fig-3");

  /* ---- 2. number line: observed, adjusted, causal ---- */
  const lineFig = (() => {
    const f = figure(
        "line-fig",
        "0 0 640 120",
        "Number line with the observed group difference, the adjusted estimand and the generator's causal value.",
      ),
      X0 = 132,
      X1 = 626,
      dom = [-2, 7],
      sx = (v) => X0 + ((v - dom[0]) / (dom[1] - dom[0])) * (X1 - X0),
      lanes = [
        { key: "obs", y: 22, name: "observed" },
        { key: "adj", y: 50, name: "adjusted" },
        { key: "tru", y: 78, name: "causal" },
      ],
      AX = 100,
      s = f.svg;
    lanes.forEach((l) => {
      s.append(
        el("line", { class: "nl-rail", x1: X0, x2: X1, y1: l.y, y2: l.y }),
      );
      l.nameEl = el(
        "text",
        { class: "nl-name", x: X0 - 12, y: l.y + 4, "text-anchor": "end" },
        l.name,
      );
      s.append(l.nameEl);
    });
    s.append(el("line", { class: "nl-axis", x1: X0, x2: X1, y1: AX, y2: AX }));
    for (let v = dom[0]; v <= dom[1] + 1e-9; v += 0.5) {
      const major = Math.abs(v - Math.round(v)) < 1e-9;
      s.append(
        el("line", {
          class: "nl-axis",
          x1: sx(v),
          x2: sx(v),
          y1: AX,
          y2: AX + (major ? 6 : 3),
        }),
      );
      if (major)
        s.append(
          el(
            "text",
            { class: "nl-tick", x: sx(v), y: AX + 17, "text-anchor": "middle" },
            fmt(v),
          ),
        );
    }
    s.append(
      el(
        "text",
        { class: "nl-tick", x: X0 - 12, y: AX + 17, "text-anchor": "end" },
        "difference in Y",
      ),
    );
    const guide = el("line", { class: "nl-guide", y1: 10, y2: AX }),
      band = el("rect", { class: "nl-band", y: lanes[2].y - 9, height: 18 }),
      bracket = el("path", { class: "nl-bracket" });
    s.append(guide, band, bracket);
    lanes.forEach((l) => {
      l.mark = el("circle", { class: "nl-mark " + l.key, cy: l.y, r: 6 });
      l.val = el("text", { class: "nl-val " + l.key, y: l.y + 4 });
      s.append(l.mark, l.val);
    });
    const place = (v, m) => {
      guide.setAttribute("x1", sx(v.adj));
      guide.setAttribute("x2", sx(v.adj));
      lanes.forEach((l) => {
        const x = sx(v[l.key]),
          flip = x > X1 - 120;
        l.mark.setAttribute("cx", x);
        l.val.setAttribute("x", flip ? x - 12 : x + 12);
        l.val.setAttribute("text-anchor", flip ? "end" : "start");
      });
      const a = sx(v.lo),
        b = sx(v.hi),
        y = lanes[2].y;
      band.setAttribute("x", Math.min(a, b));
      band.setAttribute("width", Math.abs(b - a));
      bracket.setAttribute(
        "d",
        `M${a} ${y - 8}V${y + 8}M${a} ${y}H${b}M${b} ${y - 8}V${y + 8}`,
      );
      const show = m.exchange ? "none" : "";
      band.style.display = show;
      bracket.style.display = show;
    };
    const anim = animator(place);
    return (c, v) => {
      const kappa = c.exchange ? 0 : c.hidden,
        truth = v.target + kappa,
        name = "adjusted " + c.target.toUpperCase();
      lanes[1].nameEl.textContent = name;
      lanes[1].mark.classList.toggle("hollow", !v.computable);
      lanes[0].val.textContent = fmt(v.naive);
      lanes[1].val.textContent = v.computable ? fmt(v.target) : "no support";
      lanes[2].val.textContent = fmt(truth);
      anim(
        {
          obs: v.naive,
          adj: v.target,
          tru: truth,
          lo: v.target - Math.abs(kappa),
          hi: v.target + Math.abs(kappa),
        },
        c,
      );
      const gap = v.naive - v.target;
      f.caption(
        (Math.abs(gap) < 0.005
          ? "The observed and adjusted contrasts coincide in this configuration. Numerical agreement alone does not establish the identifying assumptions."
          : "The observed difference is " + fmt(Math.abs(gap), 2) + (gap > 0 ? " above" : " below") +
            " the adjusted " + c.target.toUpperCase() + ". The observed comparison uses a different severity mix in each arm; adjustment compares within severity and uses one target mix for both arms.") +
          (!v.computable
            ? " The adjusted value is hollow: this target needs a stratum the observed data never show, so the adjustment cannot be computed."
            : !c.exchange
              ? " The adjusted contrast is still computed from the observed data and stays at " +
                fmt(v.target, 2) +
                ". What breaks is its equality to the causal value: every value in the green bracket [" +
                fmt(v.target - Math.abs(kappa), 2) +
                ", " +
                fmt(v.target + Math.abs(kappa), 2) +
                "] belongs to a world with exactly these observed data."
              : !c.consistent
                ? " The adjusted contrast is computed, but without a well-defined intervention it does not answer a causal question."
                : " With exchangeability the adjusted value is the causal value."),
      );
      f.readout([
        ["observed group difference", fmt(v.naive)],
        [
          name,
          v.computable
            ? fmt(v.target) + (v.identified ? "" : " (computed, not causal)")
            : "no support",
        ],
        ["generator's causal value", fmt(truth)],
        ["observed − adjusted", fmt(gap)],
      ]);
    };
  })();

  /* ---- 3. two worlds: eight patients, filled observed cells, hollow counterfactuals ---- */
  const PATIENTS = [
    { x: 0, a: 1, d: 0 },
    { x: 1, a: 1, d: -0.3 },
    { x: 1, a: 1, d: 0.3 },
    { x: 1, a: 1, d: 0 },
    { x: 0, a: 0, d: -0.3 },
    { x: 0, a: 0, d: 0.3 },
    { x: 0, a: 0, d: 0 },
    { x: 1, a: 0, d: 0 },
  ];
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  function worldValues(kappa, c) {
    const m = CausalEstimands.means(c);
    const y0 = PATIENTS.map((p) => m.control[p.x] + p.d - (p.a ? kappa : 0)),
      y1 = PATIENTS.map((p) => m.treatment[p.x] + p.d + (p.a ? 0 : kappa)),
      obs1 = mean(y1.filter((_, i) => PATIENTS[i].a)),
      obs0 = mean(y0.filter((_, i) => !PATIENTS[i].a)),
      adj = mean(
        [0, 1].map(
          (x) =>
            mean(
              PATIENTS.map((p, i) => (p.x === x && p.a ? y1[i] : null)).filter(
                (v) => v !== null,
              ),
            ) -
            mean(
              PATIENTS.map((p, i) => (p.x === x && !p.a ? y0[i] : null)).filter(
                (v) => v !== null,
              ),
            ),
        ),
      );
    return { y0, y1, obs0, obs1, all0: mean(y0), all1: mean(y1), adj };
  }
  const worldsFig = (() => {
    const f = figure(
        "worlds-fig",
        "0 0 640 264",
        "Eight patients with potential outcomes Y(0) and Y(1); observed cells filled, counterfactual cells hollow.",
      ),
      s = f.svg,
      cols = [
        { a: 0, x0: 152, x1: 372, name: "Y(0)", color: "or" },
        { a: 1, x0: 402, x1: 622, name: "Y(1)", color: "p" },
      ],
      dom = [-2, 9],
      sx = (c, v) => c.x0 + ((v - dom[0]) / (dom[1] - dom[0])) * (c.x1 - c.x0),
      rowY = (i) => 44 + i * 23,
      AX = 218;
    cols.forEach((c) => {
      s.append(
        el(
          "text",
          {
            class: "tw-head",
            x: (c.x0 + c.x1) / 2,
            y: 18,
            "text-anchor": "middle",
          },
          c.name,
        ),
      );
      PATIENTS.forEach((p, i) =>
        s.append(
          el("line", {
            class: "tw-rail",
            x1: c.x0,
            x2: c.x1,
            y1: rowY(i),
            y2: rowY(i),
          }),
        ),
      );
      s.append(
        el("line", { class: "tw-axis", x1: c.x0, x2: c.x1, y1: AX, y2: AX }),
      );
      for (let v = dom[0]; v <= dom[1]; v += 1) {
        s.append(
          el("line", {
            class: "tw-axis",
            x1: sx(c, v),
            x2: sx(c, v),
            y1: AX,
            y2: AX + 5,
          }),
        );
        s.append(
          el(
            "text",
            {
              class: "tw-tick",
              x: sx(c, v),
              y: AX + 17,
              "text-anchor": "middle",
            },
            fmt(v),
          ),
        );
      }
      c.meanObs = el("line", {
        class: "tw-mean-obs",
        y1: rowY(0) - 10,
        y2: rowY(7) + 10,
      });
      c.meanAll = el("line", {
        class: "tw-mean-all",
        y1: rowY(0) - 10,
        y2: rowY(7) + 10,
      });
      s.append(c.meanObs, c.meanAll);
      c.marks = PATIENTS.map((p, i) => {
        const m = el("circle", {
          class: "tw-mark " + c.color + (p.a === c.a ? "" : " hollow"),
          cy: rowY(i),
          r: 6,
        });
        s.append(m);
        return m;
      });
    });
    PATIENTS.forEach((p, i) =>
      s.append(
        el(
          "text",
          { class: "tw-row", x: 140, y: rowY(i) + 4, "text-anchor": "end" },
          `${i + 1}  ${p.x ? "high" : "low"}, A=${p.a}`,
        ),
      ),
    );
    s.append(
      el("text", { class: "tw-legend", x: 8, y: 18 }, "solid = observed"),
    );
    s.append(
      el(
        "text",
        { class: "tw-legend", x: 8, y: 32 },
        "hollow = counterfactual",
      ),
    );
    s.append(
      el(
        "text",
        { class: "tw-legend", x: cols[0].x0, y: AX + 36 },
        "│ mean of observed cells     ┆ mean of all cells (moves with κ)",
      ),
    );
    const place = (v) => {
      cols.forEach((c) => {
        PATIENTS.forEach((p, i) =>
          c.marks[i].setAttribute("cx", sx(c, v[`y${c.a}_${i}`])),
        );
        const mo = sx(c, v["obs" + c.a]),
          ma = sx(c, v["all" + c.a]);
        c.meanObs.setAttribute("x1", mo);
        c.meanObs.setAttribute("x2", mo);
        c.meanAll.setAttribute("x1", ma);
        c.meanAll.setAttribute("x2", ma);
      });
    };
    const anim = animator(place);
    return (c) => {
      const kappa = c.exchange ? 0 : c.hidden,
        w = worldValues(kappa, c),
        base = worldValues(0, c),
        flat = { obs0: w.obs0, obs1: w.obs1, all0: w.all0, all1: w.all1 };
      PATIENTS.forEach((p, i) => {
        flat["y0_" + i] = w.y0[i];
        flat["y1_" + i] = w.y1[i];
      });
      anim(flat, c);
      f.caption(
        "Same observed data, different world. " +
          (c.exchange
            ? "Unlock κ at the top of this step: only the hollow cells will move."
            : "κ = " +
              fmt(kappa) +
              ": the hollow cells moved by κ, the filled cells did not. The observed contrast is still " +
              fmt(w.obs1 - w.obs0, 2) +
              " while the ATE is now " +
              fmt(w.all1 - w.all0, 2) +
              "."),
      );
      f.readout([
        ["observed contrast", fmt(w.obs1 - w.obs0)],
        ["adjusted within severity", fmt(w.adj)],
        ["ATE = mean Y(1) − mean Y(0)", fmt(w.all1 - w.all0)],
        ["ATE at κ = 0", fmt(base.all1 - base.all0)],
        ["κ", fmt(kappa)],
      ]);
    };
  })();

  /* ---- 4. roadmap strip ---- */
  (() => {
    const STAGES = [
        ["question", "Question"],
        ["identification", "Identification"],
        ["model", "Model"],
        ["estimation", "Estimation"],
        ["uncertainty", "Uncertainty"],
        ["interpretation", "Interpretation"],
      ],
      f = figure(
        "strip-fig",
        "0 0 640 58",
        "The six stages of the roadmap; this lesson sits at identification.",
      ),
      s = f.svg,
      now = 1,
      x = (i) => 60 + i * 104;
    s.append(
      el("line", { class: "strip-line", x1: x(0), x2: x(5), y1: 22, y2: 22 }),
    );
    STAGES.forEach(([key, name], i) => {
      const cls = i === now ? "now" : i > now ? "ahead" : "";
      s.append(
        el("circle", {
          class: "strip-dot " + cls,
          cx: x(i),
          cy: 22,
          r: i === now ? 9 : 7,
          style: `fill:var(--s-${key})`,
        }),
      );
      if (i === now)
        s.append(
          el("circle", { class: "strip-ring", cx: x(i), cy: 22, r: 13 }),
        );
      s.append(
        el(
          "text",
          {
            class: "strip-label " + cls,
            x: x(i),
            y: 50,
            "text-anchor": "middle",
          },
          name,
        ),
      );
    });
    f.caption(
      "You wrote most of the question (stage 1) and tested identification (stage 2). The next lesson returns to stage 1 to finish the question with intercurrent events; the statistical model (stage 3) and the estimator (stage 4) come after.",
    );
    f.readout([
      ["stages done here", "2 of 6"],
      ["next", "Question: intercurrent events"],
    ]);
  })();

  let lastIdentification = "";
  function render() {
    const c = state.get();
    const signature = JSON.stringify([c.p, c.target, c.gLow, c.gHigh, c.effectLow, c.effectHigh, c.hidden, c.exchange, c.consistent]);
    if (signature === lastIdentification) return;
    lastIdentification = signature;
    const m = CausalEstimands.means(c),
      g = m.propensity, naive = m.naive, target = m.target;
    document.getElementById("study-values").innerHTML = table(
      ["Severity", "Population share", "g(x)", "m₀(x)", "m₁(x)", "Effect"],
      [0, 1].map(x => [x ? "High" : "Low", fmt(m.all[x]), fmt(g[x]), fmt(m.control[x]), fmt(m.treatment[x]), fmt(m.effect[x])]),
    );
    document.getElementById("adjustment-formula").textContent =
      `${c.target.toUpperCase()} = Σₓ [m₁(x) − m₀(x)] ${c.target === "ate" ? "P(X=x)" : `P(X=x | A=${c.target === "att" ? 1 : 0})`}\nmₐ(x) = E[Y | A=a, X=x]`;
    const { computable, identified } = S.identification(c);
    const v = { g, naive, target, computable, identified };
    dag2(c, v);
    dag3(c, v);
    lineFig(c, v);
    worldsFig(c);
    document.getElementById("positivity-status").textContent =
      "g(high) = " +
      fmt(c.gHigh) +
      ". " +
      (c.gHigh === 0
        ? "No high-severity treated people in this population."
        : c.gHigh === 1
          ? "No high-severity controls in this population."
          : "Both arms are possible in this stratum.");
    document.getElementById("hidden-shift").disabled = c.exchange;
    document.getElementById("kappa-value").textContent = c.exchange ? "locked at 0" : fmt(c.hidden);
    const hint = document.getElementById("kappa-hint");
    if (c.exchange) {
      hint.innerHTML = 'κ is locked while exchangeability holds. <button type="button" id="kappa-unlock">Untick exchangeability to unlock κ</button>';
      document.getElementById("kappa-unlock").onclick = () => { state.set({ exchange: false }); document.getElementById("hidden-shift").focus(); };
    } else {
      hint.innerHTML = 'Unlocked: slide κ and watch only the hollow counterfactual cells below move. <button type="button" id="kappa-lock">Restore exchangeability</button>';
      document.getElementById("kappa-lock").onclick = () => { state.set({ exchange: true }); document.getElementById("exchange").focus(); };
    }
    document.getElementById("identification-status").textContent = identified
      ? "Under the stated assumptions, adjustment identifies this target. The assumptions themselves are not established by the data."
      : !c.consistent
        ? "Define the intervention and its versions before interpreting an observed contrast causally."
        : !c.exchange
          ? "Exchangeability removed: adjustment still computes " +
            fmt(v.target, 2) +
            " from the observed data, but that number no longer equals the causal effect. The same observed law supports different causal answers; κ = " +
            fmt(c.hidden) +
            "."
          : "Positivity fails for this target: the observed data do not identify the needed stratum-specific contrast.";
  }
  state.subscribe(render);
  render();
  CausalEstimandScenes.mount(root, state);
  guided(root, state);
  tools(root, state);
})();
