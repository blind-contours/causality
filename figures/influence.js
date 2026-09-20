/* The influence curve drawn from the action.
 * Add a droplet of mass ε at z₀, watch the balance point move, sweep z₀ and let the
 * shift per unit mass trace the line z − ψ. The line appears as a consequence. */
(function () {
  const { el, html, Plot, player, fmt, tween } = CausalAnim;
  const S = CausalScience;

  CausalFigures.register("influence", (mount) => {
    const G = S.grid(241, -4, 4);
    const psi = G.mean;
    const zmin = -3,
      zmax = 3;
    // Contaminated mean: (1−ε)ψ + ε z₀ exactly, for the mean functional.
    const shifted = (z0, eps) => (1 - eps) * psi + eps * z0;

    mount.classList.add("figure");
    const row = html("div", { class: "fig-row" });
    const left = html("div");
    const right = html("div");
    row.append(left, right);
    const top = el("svg", {
      role: "img",
      "aria-label":
        "Density with a balance point; a droplet of mass at z₀ moves it",
    });
    const bottom = el("svg", {
      role: "img",
      "aria-label":
        "Shift of the balance point per unit of added mass, against z₀",
    });
    left.append(top, bottom);
    mount.append(row);

    // Top: density with fulcrum.
    const P1 = new Plot(top, {
      width: 640,
      height: 250,
      x: [-4, 4],
      y: [0, 0.55],
      ylabel: "p(z)",
      xlabel: "z",
      yticks: [0, 0.2, 0.4],
      margin: { l: 46, r: 14, t: 26, b: 40 },
    });
    const dens = G.z.map((z, i) => [z, G.p[i]]);
    P1.area(dens, 0, { fill: "var(--p)", "fill-opacity": 0.12 });
    P1.line(dens, { stroke: "var(--p)" });
    const layer = P1.layer("dynamic");
    // Bottom: the trace.
    const P2 = new Plot(bottom, {
      width: 640,
      height: 230,
      x: [zmin, zmax],
      y: [-3.5, 2.5],
      xlabel: "z₀, where the mass was added",
      ylabel: "shift of the balance point per unit mass",
      margin: { l: 46, r: 14, t: 26, b: 40 },
      yticks: [-3, -2, -1, 0, 1, 2],
    });
    P2.hline(0, { stroke: "var(--muted)", "stroke-dasharray": "2 3" });
    const traceLayer = P2.layer("trace");
    const guideLayer = P2.layer("guide");
    const visited = new Set();

    // Controls and readouts.
    const controls = html("div", { class: "fig-controls" });
    const epsId = "inf-eps";
    const epsLabel = html("label", { for: epsId }, "Added mass ε ");
    const epsVal = html("span", { class: "v" }, "0.15");
    const eps = html("input", {
      type: "range",
      id: epsId,
      min: 0.02,
      max: 0.3,
      step: 0.01,
      value: 0.15,
    });
    epsLabel.append(epsVal, eps);
    const revealId = "inf-reveal";
    const reveal = html("input", { type: "checkbox", id: revealId });
    const revealLabel = html("label", { for: revealId });
    revealLabel.append(
      reveal,
      " Overlay the line z − ψ once the trace suggests it",
    );
    controls.append(epsLabel, revealLabel);
    const readout = html("div", { class: "fig-readout" });
    const cap = html("p", { class: "fig-caption" });
    right.append(controls, readout, cap);

    let z0 = -2.2;
    function draw() {
      const e = +eps.value,
        m = shifted(z0, e),
        perUnit = (m - psi) / e;
      epsVal.textContent = e.toFixed(2);
      layer.replaceChildren();
      // Droplet: a needle at z₀ with a filled drop; its height says "ε of mass", not density.
      const x = P1.sx(z0),
        base = P1.sy(0),
        h = 40 + 220 * e;
      layer.append(
        el("line", {
          x1: x,
          x2: x,
          y1: base,
          y2: base - h,
          stroke: "var(--or)",
          "stroke-width": 2,
        }),
        el("circle", { cx: x, cy: base - h - 7, r: 7, fill: "var(--or)" }),
        el(
          "text",
          { class: "fig-text", x: x + 10, y: base - h - 4, fill: "var(--or)" },
          `mass ε = ${e.toFixed(2)} at z₀`,
        ),
      );
      // Fulcrums: original ψ (muted) and contaminated ψ_ε (purple), plus the arrow.
      const tri = (cx, color, label, dy) =>
        el(
          "g",
          {},
          el("path", { d: `M${cx},${base + 2} l-7,12 h14 z`, fill: color }),
          el(
            "text",
            {
              class: "fig-text",
              x: cx,
              y: base + 26 + dy,
              "text-anchor": "middle",
              fill: color,
            },
            label,
          ),
        );
      layer.append(
        tri(P1.sx(psi), "var(--muted)", "ψ", 0),
        tri(P1.sx(m), "var(--purple)", "ψ_ε", 12),
      );
      const ax = P1.sx(psi),
        bx = P1.sx(m),
        ay = base - 14;
      if (Math.abs(bx - ax) > 2)
        layer.append(
          el("line", {
            x1: ax,
            x2: bx,
            y1: ay,
            y2: ay,
            stroke: "var(--purple)",
            "stroke-width": 2.5,
          }),
          el("path", {
            d: `M${bx},${ay} l${bx > ax ? -7 : 7},-4 v8 z`,
            fill: "var(--purple)",
          }),
        );
      // Trace point.
      visited.add(Math.round(z0 * 20) / 20);
      traceLayer.replaceChildren();
      [...visited].forEach((v) =>
        traceLayer.append(
          el("circle", {
            cx: P2.sx(v),
            cy: P2.sy(v - psi),
            r: 3,
            fill: "var(--purple)",
            "fill-opacity": 0.7,
          }),
        ),
      );
      traceLayer.append(
        el("circle", {
          cx: P2.sx(z0),
          cy: P2.sy(perUnit),
          r: 6,
          fill: "var(--or)",
        }),
      );
      guideLayer.replaceChildren();
      if (reveal.checked) {
        P2.line(
          [
            [zmin, zmin - psi],
            [zmax, zmax - psi],
          ],
          { stroke: "var(--purple)", "stroke-dasharray": "6 4" },
          guideLayer,
        );
        P2.text(
          zmax - 0.05,
          zmax - psi - 0.35,
          "ϕ(z) = z − ψ",
          {
            "text-anchor": "end",
            fill: "var(--purple)",
            class: "fig-text ink",
          },
          guideLayer,
        );
        P2.vline(
          psi,
          { stroke: "var(--muted)" },
          "z₀ = ψ: no shift",
          guideLayer,
        );
      }
      readout.innerHTML =
        `<span class="k">z₀</span><span>${fmt(z0, 2)}</span>` +
        `<span class="k">ψ (balance point)</span><span>${fmt(psi, 3)}</span>` +
        `<span class="k">ψ_ε after adding mass</span><span>${fmt(m, 3)}</span>` +
        `<span class="k">shift / ε</span><span>${fmt(perUnit, 3)}</span>` +
        `<span class="k">z₀ − ψ</span><span>${fmt(z0 - psi, 3)}</span>`;
      const span = visited.size;
      cap.textContent =
        span < 12
          ? `Mass ${e.toFixed(2)} at z₀ = ${fmt(z0, 2)} moves the balance point by ${fmt(m - psi, 3)}, which is ε × (z₀ − ψ). Sweep z₀ to see what the shift does as a function of where the mass lands.`
          : `The trace is a straight line through zero at z₀ = ψ: shift per unit mass = z₀ − ψ. That function of z₀ is the influence function of the mean. Mass added below ψ pulls the balance point down, above ψ pulls it up, in proportion to distance.`;
    }
    const clock = player(right, {
      duration: 7000,
      label: "z₀ (sweep or place the droplet)",
      onT: (t) => {
        z0 = zmin + (zmax - zmin) * t;
        draw();
      },
    });
    eps.addEventListener("input", draw);
    reveal.addEventListener("input", draw);
    clock.set(0.13);
  });
})();
