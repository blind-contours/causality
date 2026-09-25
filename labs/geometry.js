(function () {
  const { S, V, store, control, tools, guided, table, fmt } = CausalLab,
    root = document.querySelector("[data-lab]");
  const state = store(
    "geometry",
    {
      step: 0,
      mass: 0.2,
      middle: 0.5,
      epsilon: 0,
      direction: "transfer",
      restricted: false,
      yaw: -0.55,
      pitch: 0.55,
      view: "simplex",
    },
    {
      step: [0, 5],
      mass: [0.05, 0.8],
      middle: [0.05, 0.8],
      epsilon: [-0.15, 0.15],
      direction: ["transfer", "nuisance"],
      yaw: [-3.14, 3.14],
      pitch: [-1.4, 1.4],
      view: ["simplex", "sphere", "scores", "plane"],
    },
  );
  root.innerHTML = `<section class="lab-step" data-title="Move mass"><h2 tabindex="-1">A distribution is a position you can move</h2><p>Three possible outcomes: −1, 0, and 2. Their probabilities add to one. Set the probabilities at −1 and at 0; outcome 2 takes whatever is left. Watch the mean move while the outcome positions stay fixed.</p><label>Probability at outcome −1 <input id="mass" type="range" min=".05" max=".45" step=".01"></label><label>Probability at outcome 0 <input id="middle" type="range" min=".05" max=".8" step=".01"></label><div id="mass-bars"></div><p class="readout" id="mean-value"></p><p class="note">This is an exact finite statistical model. A three-outcome distribution lives on a two-dimensional triangle in three coordinates. The later function spaces can be infinite dimensional.</p></section>
<section class="lab-step" data-title="Choose a path"><h2 tabindex="-1">A score describes relative changes in probability</h2><p>In the full model, choose a direction, then scrub ε to travel along it. Probability velocity is vᵢ. The score is hᵢ = vᵢ / pᵢ: the same absolute movement is a larger relative change in a small bin.</p><label>Direction <select id="direction"><option value="transfer">Move mass from −1 to 2</option><option value="nuisance">Move without changing the mean</option></select></label><label>Position along the path ε <input id="epsilon" type="range" min="-.15" max=".15" step=".005"></label><div id="path-table"></div><p class="math" id="path-identity"></p><p>Scores have probability-weighted mean zero because mass is conserved. That condition alone is not enough for arbitrary ε: every probability must also stay nonnegative.</p><p class="note">A direction can visibly change the distribution while leaving this target unchanged. That is a nuisance direction for the mean. Under the middle-mass restriction, this direction is disallowed; only the outer-mass transfer remains.</p></section>
<section class="lab-step" data-title="Build the predictor"><h2 tabindex="-1">One set of numbers predicts every slope</h2><p>Try assigning a sensitivity to each outcome. Multiply sensitivity × score × probability, then add. Can your three numbers reproduce the target slope for both independent directions? A constant shift does not change the slope prediction; mean-zero centering fixes that freedom in the full model.</p><div class="geometry-controls"><label>Sensitivity at −1 <input id="guess0" type="number" step=".1" value="0"></label><label>Sensitivity at 0 <input id="guess1" type="number" step=".1" value="0"></label><label>Sensitivity at 2 <input id="guess2" type="number" step=".1" value="0"></label></div><button id="check-gradient">Test my sensitivities</button><button id="show-gradient">Show a worked construction</button><p id="gradient-feedback" role="status"></p><details><summary>Give the successful construction its name</summary><p class="math">Dᵢ = zᵢ − μ<br>dΨ(Pε)/dε |₀ = Σᵢ Dᵢ hᵢ pᵢ = Eₚ[Dh]<br>Eₚ[D] = 0</p><p>These sensitivities form the mean's efficient influence function in the full three-outcome model. Its inner product with a score gives the target derivative along that direction.</p></details></section>
<section class="lab-step" data-title="Rotate the geometry"><h2 tabindex="-1">Three views of the same movement</h2><p>The triangle shows probability mass. The sphere shows square-root probabilities. The score view uses √pᵢ hᵢ coordinates, so ordinary Euclidean dot products equal probability-weighted score inner products.</p><label>Representation <select id="view"><option value="simplex">Probability simplex</option><option value="sphere">Square-root probability sphere</option><option value="scores">Weighted score vectors and projection</option><option value="plane">Flat tangent plane (2D alternative)</option></select></label><svg id="geometry" class="geometry-figure" viewBox="0 0 600 420" role="img" tabindex="0" aria-label="Rotatable three-dimensional probability geometry. Drag, use arrow keys, or use the camera sliders. Exact values are in the table below."></svg><div class="geometry-controls"><label>Camera yaw <input id="yaw" type="range" min="-3.14" max="3.14" step=".02"></label><label>Camera pitch <input id="pitch" type="range" min="-1.4" max="1.4" step=".02"></label></div><div class="btns"><button id="reset-camera">Reset camera</button><button id="plane-camera">Look straight at the probability plane</button></div><p class="legend">Blue D: original gradient · purple D*: canonical gradient · dashed orange: discarded component · teal: chosen unit score. In the score view, the shaded plane is the full tangent space; the purple line is the restricted tangent space when selected.</p><div id="geometry-table"></div><p class="note">Rotating changes only the camera. The square-root-density velocity is ½√p h, not √p h; the displayed score vectors use the latter coordinates to preserve inner products.</p></section>
<section class="lab-step" data-title="Restrict and project"><h2 tabindex="-1">Now tell the model what it already knows</h2><label><span><input id="restricted" type="checkbox"> The middle probability is known: allow only paths that keep it fixed</span></label><div class="figure"><svg id="projection-figure" viewBox="0 0 600 360" role="img" aria-label="The gradient D, the allowed tangent space, and the perpendicular dropped from D to the canonical gradient D*"></svg><div class="btns"><button id="replay-projection" type="button">Replay the projection</button></div><div class="variance-bar" id="variance-bar" aria-hidden="true"><i class="kept"></i><i class="lost"></i></div><p class="fig-caption" id="projection-caption"></p></div><p>The full tangent space contains every mean-zero score. With the middle mass fixed, only one independent direction remains. Project the original gradient onto the allowed tangent space. The discarded component predicts no slope along an allowed path, so it adds variance without adding relevant information.</p><div id="projection-table"></div><p class="math" id="projection-values"></p><p>This projection is the <b>canonical gradient</b>, D*. It lies in the tangent space and represents all target derivatives there. Every other mean-zero gradient is D* plus an element orthogonal to that tangent space.</p><p>The nuisance tangent space consists of allowed directions with zero target derivative. It is not the whole tangent space. Projecting a gradient onto the model tangent space and projecting a parameter score away from nuisance scores are related, distinct constructions.</p><button id="reference-example">Load the reference example (0.2, 0.5, 0.3)</button></section>
<section class="lab-step" data-title="Connect to estimation"><h2 tabindex="-1">Sensitivity becomes sampling error</h2><p>For an asymptotically linear estimator, the leading estimation error is the average of its influence-function values. Its variance is therefore approximately E[D²]/n. The canonical gradient has the smallest variance among the influence functions of regular asymptotically linear estimators in this model (the gradients).</p><p class="math" id="variance-values"></p><p>Knowing something about a model can lower the bound, or leave it unchanged when the removed directions were already orthogonal to the gradient. For the population ATE at the same observed law, knowing the treatment mechanism is such an unchanged-bound case.</p><p>When a paper says “let D* be the canonical gradient,” translate it as: find the shortest mean-zero vector inside the allowed tangent space whose dot product with every allowed direction predicts the target's slope.</p><p class="note">This picture establishes exact identities in a finite model. Extending it uses closed linear spans in L²(P), differentiability, and regularity conditions; a rotatable surface is an illustration of those ideas.</p></section>`;
  const ids = {
    mass: "mass",
    middle: "middle",
    direction: "direction",
    epsilon: "epsilon",
    view: "view",
    yaw: "yaw",
    pitch: "pitch",
    restricted: "restricted",
  };
  for (const [id, key] of Object.entries(ids))
    control(document.getElementById(id), state, key);
  const sensitivityInputs = [0, 1, 2].map((i) =>
    document.getElementById("guess" + i),
  );
  try {
    const answers = JSON.parse(
      localStorage.getItem("causality.geometry-construction") || "[]",
    );
    sensitivityInputs.forEach((input, i) => {
      if (answers[i] !== undefined) input.value = answers[i];
    });
  } catch {}
  sensitivityInputs.forEach((input) =>
    input.addEventListener("input", () => {
      try {
        localStorage.setItem(
          "causality.geometry-construction",
          JSON.stringify(sensitivityInputs.map((el) => el.value)),
        );
      } catch {}
    }),
  );
  function math() {
    const c = state.get(),
      middle = c.middle,
      mass = Math.min(c.mass, 0.95 - middle),
      p = [mass, middle, 1 - middle - mass],
      g = S.geometry(p),
      v = c.direction === "transfer" ? [-1, 0, 1] : [2, -3, 1],
      h = S.score(p, v),
      [lo, hi] = S.pathBounds(p, h),
      epsilonMin = Math.ceil(Math.max(-0.15, lo * 0.95) / 0.005) * 0.005,
      epsilonMax = Math.floor(Math.min(0.15, hi * 0.95) / 0.005) * 0.005,
      epsilon = Math.max(epsilonMin, Math.min(epsilonMax, c.epsilon)),
      q = S.path(p, h, epsilon),
      dstar = c.restricted ? g.canonical : g.d;
    return {
      ...g,
      c,
      v,
      h,
      epsilon,
      q,
      dstar,
      slope: S.dot(v, g.z),
      epsilonMin,
      epsilonMax,
    };
  }
  let lastModelKey, lastMath;
  function render() {
    if (state.get().restricted && state.get().direction === "nuisance") {
      state.set({ direction: "transfer" });
      return;
    }
    document.querySelector("#direction option[value=nuisance]").disabled =
      state.get().restricted;
    const current = state.get(),
      key = JSON.stringify([
        current.mass,
        current.middle,
        current.epsilon,
        current.direction,
        current.restricted,
      ]);
    if (key === lastModelKey) {
      draw({ ...lastMath, c: current });
      return;
    }
    const m = math(),
      { p, z, mu, d, h, q, dstar, c } = m;
    lastModelKey = key;
    lastMath = m;
    if (c.restricted !== lastRestricted) {
      const first = lastRestricted === null;
      lastRestricted = c.restricted;
      if (c.restricted && !first) animateProjection();
      else {
        projAnim?.cancel();
        proj = 1;
      }
    }
    const mass = document.getElementById("mass");
    mass.max = fmt(0.95 - c.middle, 2);
    mass.value = p[0];
    document.getElementById("middle").disabled = c.restricted;
    const eps = document.getElementById("epsilon");
    eps.min = m.epsilonMin;
    eps.max = m.epsilonMax;
    eps.value = m.epsilon;
    document.getElementById("mass-bars").innerHTML = p
      .map(
        (x, i) =>
          `<div class="bar-mass"><span>z = ${z[i]}</span><div class="mass-track"><div class="mass-fill" style="width:${100 * x}%"></div></div><span>${fmt(x)}</span></div>`,
      )
      .join("");
    document.getElementById("mean-value").innerHTML =
      "Mean μ = <strong>" + fmt(mu) + "</strong>";
    document.getElementById("path-table").innerHTML = table(
      ["Outcome", "p", "Velocity v", "Score h", "pε"],
      z.map((v, i) => [v, fmt(p[i]), fmt(m.v[i]), fmt(h[i]), fmt(q[i])]),
    );
    document.getElementById("path-identity").textContent =
      `ε = ${fmt(m.epsilon)} · E[h] = ${fmt(S.inner(h, [1, 1, 1], p))} · slope = ${fmt(m.slope)} · mean along path = ${fmt(S.dot(q, z))}`;
    document.getElementById("geometry-table").innerHTML = table(
      ["Outcome", "Probability", "√p", "√p h"],
      z.map((v, i) => [
        v,
        fmt(p[i]),
        fmt(Math.sqrt(p[i])),
        fmt(Math.sqrt(p[i]) * h[i]),
      ]),
    );
    document.getElementById("projection-table").innerHTML = table(
      ["Outcome", "Original D", "Canonical D*", "Discarded"],
      z.map((v, i) => [v, fmt(d[i]), fmt(dstar[i]), fmt(d[i] - dstar[i])]),
    );
    const res = d.map((v, i) => v - dstar[i]),
      variance = S.inner(dstar, dstar, p);
    document.getElementById("projection-values").textContent =
      `E[D²] = ${fmt(m.fullVariance)} = E[(D*)²] ${fmt(variance)} + E[(D−D*)²] ${fmt(S.inner(res, res, p))}. Inner product of D* and the discarded component = ${fmt(S.inner(dstar, res, p))}.`;
    document.getElementById("variance-values").textContent =
      `At n=100: full-model bound SE = ${fmt(Math.sqrt(m.fullVariance / 100))}; selected-model bound SE = ${fmt(Math.sqrt(variance / 100))}.`;
    draw(m);
  }
  // proj ∈ [0,1] is view state: how far the perpendicular from D has been dropped.
  let proj = 1,
    projAnim = null,
    lastRestricted = null;
  function draw(m) {
    drawInto(document.getElementById("geometry"), m, proj);
    const mini = document.getElementById("projection-figure");
    if (mini)
      drawInto(mini, { ...m, c: { ...m.c, view: "plane" } }, proj, true);
  }
  function drawInto(el, m, proj, isMini = false) {
    const { c, p, q, d, dstar, h } = m;
    el.replaceChildren();
    const isScore = ["scores", "plane"].includes(c.view);
    const scale = isScore ? (isMini ? 165 : 95) : 260,
      center = isScore ? [0, 0, 0] : [1 / 3, 1 / 3, 1 / 3];
    const rawBasis = S.score(p, [-1, 0, 1]).map((v, i) => v * Math.sqrt(p[i])),
      basisLength = Math.sqrt(S.dot(rawBasis, rawBasis)),
      basis1 = rawBasis.map((v) => v / basisLength),
      normal = p.map(Math.sqrt),
      basis2 = [
        normal[1] * basis1[2] - normal[2] * basis1[1],
        normal[2] * basis1[0] - normal[0] * basis1[2],
        normal[0] * basis1[1] - normal[1] * basis1[0],
      ];
    const project = (a) => {
      if (c.view === "plane")
        return [300 + scale * S.dot(a, basis1), 230 - scale * S.dot(a, basis2)];
      const [x, y, z] = a.map((v, i) => v - center[i]),
        X = Math.cos(c.yaw) * x - Math.sin(c.yaw) * y,
        Y = Math.sin(c.yaw) * x + Math.cos(c.yaw) * y;
      return [
        300 + scale * X,
        230 - scale * (Math.cos(c.pitch) * z - Math.sin(c.pitch) * Y),
      ];
    };
    const line = (a, b, color, dash = "") => {
      const A = project(a),
        B = project(b);
      el.append(
        V.svg("path", {
          d: `M${A}L${B}`,
          stroke: color,
          "stroke-width": 2,
          "stroke-dasharray": dash,
          fill: "none",
        }),
      );
    };
    const point = (a, label, color, dx = 10, dy = -10) => {
      const [x, y] = project(a);
      const labelWidth = label.length * (innerWidth < 760 ? 15 : 9);
      el.append(
        V.svg("circle", { cx: x, cy: y, r: 6, fill: color }),
        V.svg(
          "text",
          {
            x: Math.max(10, Math.min(590 - labelWidth, x + dx)),
            y: Math.max(25, Math.min(400, y + dy)),
          },
          label,
        ),
      );
    };
    const origin = [0, 0, 0];
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ].forEach((a, i) => {
      line(origin, a, "var(--muted)", "3 5");
      if (c.view !== "plane") point(a, ["−1", "0", "2"][i], "var(--muted)");
    });
    if (c.view === "simplex") {
      const corners = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ].map(project);
      el.append(
        V.svg("polygon", {
          points: corners.map((v) => v.join(",")).join(" "),
          fill: "var(--teal)",
          "fill-opacity": 0.12,
          stroke: "var(--teal)",
        }),
      );
      if (c.restricted)
        line([0, p[1], 1 - p[1]], [1 - p[1], p[1], 0], "var(--purple)");
      line(p, q, "var(--purple)");
      point(p, "P", "var(--teal)");
      point(q, "Pε", "var(--purple)");
    } else if (c.view === "sphere") {
      for (let a = 0; a <= Math.PI / 2; a += Math.PI / 12) {
        for (let j = 0; j < 40; j++) {
          const b = (j * Math.PI) / 80,
            B = ((j + 1) * Math.PI) / 80;
          line(
            [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)],
            [Math.cos(a) * Math.cos(B), Math.sin(a) * Math.cos(B), Math.sin(B)],
            "var(--rule)",
          );
          line(
            [Math.cos(b) * Math.cos(a), Math.sin(b) * Math.cos(a), Math.sin(a)],
            [Math.cos(B) * Math.cos(a), Math.sin(B) * Math.cos(a), Math.sin(a)],
            "var(--rule)",
          );
        }
      }
      for (let i = 0; i < 40; i++) {
        const a = p.map((v, k) => Math.sqrt(v + ((q[k] - v) * i) / 40)),
          b = p.map((v, k) => Math.sqrt(v + ((q[k] - v) * (i + 1)) / 40));
        line(a, b, "var(--purple)");
      }
      point(p.map(Math.sqrt), "√P", "var(--teal)");
      point(q.map(Math.sqrt), "√Pε", "var(--purple)");
    } else {
      const weighted = (v) => v.map((x, i) => x * Math.sqrt(p[i]));
      const b1 = weighted(S.score(p, [-1, 0, 1]));
      const n1 = Math.sqrt(S.dot(b1, b1));
      for (let i = 0; i < 3; i++) b1[i] /= n1;
      let b2 = weighted(S.score(p, [2, -3, 1]));
      const ip = S.dot(b1, b2);
      b2 = b2.map((v, i) => v - ip * b1[i]);
      const n2 = Math.sqrt(S.dot(b2, b2));
      b2 = b2.map((v) => v / n2);
      const corners = [
        [-1.5, -1.1],
        [1.5, -1.1],
        [1.5, 1.1],
        [-1.5, 1.1],
      ].map(([a, b]) => project(b1.map((v, i) => a * v + b * b2[i])));
      el.append(
        V.svg("polygon", {
          points: corners.map((v) => v.join(",")).join(" "),
          fill: "var(--teal)",
          "fill-opacity": c.restricted ? 0.05 : 0.12,
          stroke: "var(--rule)",
        }),
      );
      if (c.restricted)
        line(
          b1.map((v) => -1.7 * v),
          b1.map((v) => 1.7 * v),
          "var(--purple)",
        );
      if (isMini) {
        const [px, py] = project(b1.map((v) => 1.7 * v)),
          [cx, cy] = project(b1.map((v, i) => -1.5 * v + 1.1 * b2[i]));
        el.append(
          V.svg(
            "text",
            { x: cx + 6, y: cy + 16, fill: "var(--teal)", "font-size": 12 },
            "all mean-zero directions",
          ),
        );
        const [qx, qy] = project(b1.map((v) => -1.7 * v));
        if (c.restricted)
          el.append(
            V.svg(
              "text",
              {
                // Start of the purple line, below it: clear of D, D* and the right-angle marker.
                x: Math.max(8, Math.min(qx, px) + 4),
                y: (px < qx ? py : qy) + 20,
                fill: "var(--purple)",
                "font-size": 12,
              },
              "allowed: middle mass fixed",
            ),
          );
      }
      const a = weighted(d),
        b = weighted(dstar),
        hScaled = weighted(h).map((x) => x / Math.sqrt(S.inner(h, h, p)));
      // The moving point Q slides from the tip of D down the perpendicular to D*.
      const Q = a.map((v, i) => v + (b[i] - v) * proj);
      line(origin, a, "var(--p)");
      line(origin, hScaled, "var(--teal)");
      if (c.restricted || !isMini) {
        line(origin, Q, "var(--purple)");
        if (proj > 0.02) line(Q, a, "var(--or)", "5 5");
        if (c.restricted && proj > 0.98) {
          // Right-angle marker at the foot of the perpendicular.
          const ab = a.map((v, i) => v - b[i]),
            nab = Math.sqrt(S.dot(ab, ab)) || 1,
            nb = Math.sqrt(S.dot(b, b)) || 1,
            k = 0.12,
            u = ab.map((v) => (k * v) / nab),
            w = b.map((v) => (-k * v) / nb);
          const p1 = b.map((v, i) => v + w[i]),
            p2 = b.map((v, i) => v + w[i] + u[i]),
            p3 = b.map((v, i) => v + u[i]);
          line(p1, p2, "var(--muted)");
          line(p2, p3, "var(--muted)");
        }
      }
      point(a, "D", "var(--p)", 16, -24);
      if (c.restricted || !isMini)
        point(
          Q,
          proj > 0.98 || !c.restricted ? "D*" : "Q",
          "var(--purple)",
          10,
          24,
        );
      if (isMini) {
        const { total, kept, lost, cross } = S.projectionSplit(a, b, proj);
        const bar = document.getElementById("variance-bar");
        bar.querySelector(".kept").style.width =
          `${Math.min(100, (100 * kept) / total)}%`;
        bar.querySelector(".lost").style.width =
          `${Math.min(100, (100 * lost) / total)}%`;
        document.getElementById("projection-caption").textContent =
          !c.restricted
            ? `Nothing is known about the middle mass, so every mean-zero direction is allowed and D is already inside the tangent space: D* = D and E[D²] = ${fmt(total)}.`
            : proj < 0.98
              ? `Q is on its way from D to the allowed line; it becomes D* only when it arrives. Kept ${fmt(kept)} + discarded ${fmt(lost)} = ${fmt(kept + lost)} falls short of E[D²] = ${fmt(total)} by the cross term 2t(1−t)‖D−D*‖² = ${fmt(cross)}: two pieces add up to the whole only when they are orthogonal.`
              : `At the foot of the perpendicular the split is exact: E[(D*)²] ${fmt(kept)} + E[(D−D*)²] ${fmt(lost)} = E[D²] ${fmt(total)}. The purple vector is the canonical gradient; it is the shortest vector in the allowed space that still predicts every allowed slope.`;
      }
    }
  }
  function animateProjection() {
    projAnim?.cancel();
    proj = 0;
    projAnim = CausalAnim.tween({
      duration: 1600,
      onUpdate: (u) => {
        proj = u;
        if (lastMath) draw({ ...lastMath, c: state.get() });
      },
    });
  }
  state.subscribe(render);
  render();
  document.getElementById("reset-camera").onclick = () =>
    state.set({ yaw: -0.55, pitch: 0.55 });
  document.getElementById("plane-camera").onclick = () =>
    state.set({ yaw: Math.PI / 4, pitch: Math.asin(1 / Math.sqrt(3)) });
  document.getElementById("reference-example").onclick = () =>
    state.set({ mass: 0.2, middle: 0.5, restricted: true });
  document.getElementById("replay-projection").onclick = () => {
    if (!state.get().restricted) state.set({ restricted: true });
    else animateProjection();
  };
  const fig = document.getElementById("geometry");
  let drag;
  fig.onpointerdown = (e) => {
    drag = [e.clientX, e.clientY, state.get().yaw, state.get().pitch];
    fig.setPointerCapture(e.pointerId);
  };
  fig.onpointermove = (e) => {
    if (drag)
      state.set({
        yaw: drag[2] + (e.clientX - drag[0]) * 0.009,
        pitch: drag[3] + (e.clientY - drag[1]) * 0.009,
      });
  };
  fig.onpointerup = fig.onpointercancel = () => (drag = null);
  fig.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    const c = state.get();
    state.set({
      yaw:
        c.yaw +
        (e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0),
      pitch:
        c.pitch +
        (e.key === "ArrowUp" ? 0.1 : e.key === "ArrowDown" ? -0.1 : 0),
    });
  };
  const exercise = (assisted, correct) =>
    Causality.event({
      type: "exercise",
      unit: "canonical-gradient",
      id: "construct",
      variant: JSON.stringify(math().p),
      correct,
      assisted,
    });
  document.getElementById("show-gradient").onclick = () => {
    const m = math();
    document.getElementById("gradient-feedback").textContent =
      "Subtract μ = " +
      fmt(m.mu) +
      " from each outcome: " +
      m.d.map((x) => fmt(x)).join(", ") +
      ". Their mean is zero and their inner product with every score gives the slope.";
    exercise(true, false);
  };
  document.getElementById("check-gradient").onclick = () => {
    const m = math(),
      guess = [0, 1, 2].map((i) => +document.getElementById("guess" + i).value),
      pred = [S.dot(guess, [-1, 0, 1]), S.dot(guess, [2, -3, 1])],
      center = S.dot(guess, m.p),
      correct =
        Math.abs(pred[0] - 3) < 0.02 &&
        Math.abs(pred[1]) < 0.02 &&
        Math.abs(center) < 0.02;
    document.getElementById("gradient-feedback").textContent =
      `Predicted slopes: ${fmt(pred[0])} (target 3), ${fmt(pred[1])} (target 0). Weighted mean: ${fmt(center)} (target 0). ` +
      (correct
        ? "Your construction works for a basis, so it works for every direction in the full tangent space."
        : "Adjust the sensitivities and test again.");
    exercise(false, correct);
  };
  guided(root, state);
  tools(root, state);
})();
