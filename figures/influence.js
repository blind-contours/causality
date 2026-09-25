/* The influence curve drawn from the action.
 * Add a droplet of mass ε at z₀, watch the balance point move, sweep z₀ and let the
 * shift per unit mass trace the line z − ψ. A spring from the balance point ψ to the
 * droplet makes the pull literal: its stretch is ϕ(z₀) = z₀ − ψ, and its tension is
 * drawn in proportion to |ϕ(z₀)|. The line appears as a consequence. */
(function () {
  const { el, html, Plot, player, fmt } = CausalAnim;
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
        "Density with its balance point ψ. A droplet of mass ε sits at z₀, tied to ψ by a spring whose stretch is z₀ − ψ; the balance point moves toward the droplet.",
    });
    const bottom = el("svg", {
      role: "img",
      "aria-label":
        "Shift of the balance point per unit of added mass, against z₀. The traced points fall on the line z₀ − ψ.",
    });
    left.append(top, bottom);
    mount.append(row);

    // Top: density, spring row above it, fulcrums below the tick labels.
    const YS = 0.5; // height (in density units) of the spring row, clear of the density peak
    const P1 = new Plot(top, {
      width: 640,
      height: 290,
      x: [-4, 4],
      y: [0, 0.62],
      ylabel: "p(z)",
      yticks: [0, 0.2, 0.4],
      margin: { l: 46, r: 14, t: 26, b: 66 },
    });
    const dens = G.z.map((z, i) => [z, G.p[i]]);
    P1.area(dens, 0, { fill: "var(--p)", "fill-opacity": 0.12 });
    P1.line(dens, { stroke: "var(--p)" });
    P1.text(3.95, 0.02, "z", {
      "text-anchor": "end",
      class: "axis-label",
    });
    const ghostLayer = P1.layer("ghost");
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
    const trail = []; // recent droplet positions, oldest first

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
    const revealLabel = html("label", {
      for: revealId,
      style:
        "display:flex;align-items:flex-start;gap:10px;min-height:44px;cursor:pointer",
    });
    reveal.style.cssText = "width:22px;height:22px;flex:none;margin:2px 0 0";
    revealLabel.append(
      reveal,
      html("span", {}, "Overlay the line z − ψ once the trace suggests it"),
    );
    const playMount = html("div");
    controls.append(epsLabel, revealLabel);
    const readout = html("div", { class: "fig-readout", "aria-live": "off" });
    const cap = html("p", { class: "fig-caption" });
    right.append(playMount, controls, readout, cap);

    // A zigzag spring between two x positions (pixels) at height y (pixels).
    function spring(x1, x2, y, width) {
      const coils = 8,
        amp = 6,
        lead = Math.min(10, Math.abs(x2 - x1) / 6),
        dir = Math.sign(x2 - x1) || 1,
        a = x1 + dir * lead,
        b = x2 - dir * lead;
      let d = `M${x1},${y} L${a},${y}`;
      for (let k = 1; k <= 2 * coils; k++) {
        const x = a + ((b - a) * (k - 0.5)) / (2 * coils);
        d += ` L${x},${y + (k % 2 ? -amp : amp)}`;
      }
      d += ` L${b},${y} L${x2},${y}`;
      return el("path", {
        d,
        fill: "none",
        stroke: "var(--purple)",
        "stroke-width": width,
        "stroke-linejoin": "round",
      });
    }

    let z0 = -2.2;
    function draw() {
      const e = +eps.value,
        m = shifted(z0, e),
        perUnit = (m - psi) / e,
        phi = z0 - psi;
      epsVal.textContent = e.toFixed(2);
      const base = P1.sy(0),
        ys = P1.sy(YS),
        x = P1.sx(z0),
        ax = P1.sx(psi),
        L = P1.m.l,
        R = P1.W - P1.m.r;

      // Ghost trail: where the droplet has just been.
      const last = trail[trail.length - 1];
      if (last === undefined || Math.abs(last - z0) > 0.18) trail.push(z0);
      while (trail.length > 10) trail.shift();
      ghostLayer.replaceChildren(
        ...trail.slice(0, -1).map((v, k, arr) =>
          el("circle", {
            cx: P1.sx(v),
            cy: ys,
            r: 5,
            fill: "var(--or)",
            "fill-opacity": (0.08 + (0.32 * (k + 1)) / arr.length).toFixed(2),
          }),
        ),
      );

      layer.replaceChildren();
      // Anchor post at ψ: the spring pulls on the balance point.
      layer.append(
        el("line", {
          x1: ax,
          x2: ax,
          y1: base,
          y2: ys,
          stroke: "var(--muted)",
          "stroke-width": 2,
        }),
        el("circle", { cx: ax, cy: ys, r: 4, fill: "var(--muted)" }),
      );
      // The spring: stretch = |z₀ − ψ| on the z axis; stroke width grows with tension |ϕ|.
      if (Math.abs(x - ax) > 6)
        layer.append(spring(ax, x, ys, 1.4 + 0.9 * Math.abs(phi)));
      // Droplet: a needle down to z₀ and a filled drop on the spring.
      layer.append(
        el("line", {
          x1: x,
          x2: x,
          y1: base,
          y2: ys,
          stroke: "var(--or)",
          "stroke-width": 1.5,
          "stroke-dasharray": "3 3",
        }),
        el("circle", { cx: x, cy: ys, r: 5 + 18 * e, fill: "var(--or)" }),
      );
      // Spring label, centred on the spring and kept inside the plot.
      const label = `ϕ(z₀) = z₀ − ψ = ${fmt(phi, 2)}`,
        half = label.length * (innerWidth < 720 ? 5.4 : 3.6),
        mid = Math.max(L + half, Math.min(R - half, (ax + x) / 2));
      layer.append(
        el(
          "text",
          {
            class: "fig-text",
            x: mid,
            y: ys - 18,
            "text-anchor": "middle",
            fill: "var(--purple)",
          },
          label,
        ),
      );
      // Fulcrums below the tick labels: ψ (muted) and ψ_ε (purple), labels on opposite sides.
      const fy = base + 24,
        bx = P1.sx(m),
        leftOf = m < psi;
      const tri = (cx, color) =>
        el("path", { d: `M${cx},${fy} l-7,12 h14 z`, fill: color });
      layer.append(
        tri(ax, "var(--muted)"),
        tri(bx, "var(--purple)"),
        el(
          "text",
          {
            class: "fig-text",
            x: ax + (leftOf ? 10 : -10),
            y: fy + 30,
            "text-anchor": leftOf ? "start" : "end",
          },
          "ψ",
        ),
        el(
          "text",
          {
            class: "fig-text",
            x: bx + (leftOf ? -10 : 10),
            y: fy + 30,
            "text-anchor": leftOf ? "end" : "start",
            fill: "var(--purple)",
          },
          "ψ_ε",
        ),
      );
      if (Math.abs(bx - ax) > 3)
        layer.append(
          el("line", {
            x1: ax,
            x2: bx,
            y1: fy + 6,
            y2: fy + 6,
            stroke: "var(--purple)",
            "stroke-width": 2.5,
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
          zmax - psi - 0.45,
          "ϕ(z) = z − ψ",
          {
            "text-anchor": "end",
            fill: "var(--purple)",
            class: "fig-text ink",
          },
          guideLayer,
        );
      }
      readout.innerHTML =
        `<span class="k">z₀</span><span>${fmt(z0, 2)}</span>` +
        `<span class="k">ψ (balance point)</span><span>${fmt(psi, 3)}</span>` +
        `<span class="k">spring stretch z₀ − ψ</span><span>${fmt(phi, 3)}</span>` +
        `<span class="k">ψ_ε with mass ε</span><span>${fmt(m, 3)}</span>` +
        `<span class="k">shift / ε</span><span>${fmt(perUnit, 3)}</span>`;
      const span = visited.size;
      cap.textContent =
        span < 12
          ? `The spring from ψ to the droplet is stretched by z₀ − ψ = ${fmt(phi, 2)}. Mass ${e.toFixed(2)} there moves the balance point by ${fmt(m - psi, 3)}, which is ε times that stretch. Sweep z₀ and watch the pull per unit mass.`
          : `The trace is a straight line through zero at z₀ = ψ: shift per unit mass = z₀ − ψ, the stretch of the spring. That function of z₀ is the influence function of the mean. A droplet far from ψ pulls hard; a droplet at ψ does not pull at all.`;
    }
    const clock = player(playMount, {
      duration: 7000,
      label: "Droplet position z₀",
      formatValue: (t) => (zmin + (zmax - zmin) * t).toFixed(2),
      onT: (t) => {
        z0 = zmin + (zmax - zmin) * t;
        draw();
      },
    });
    // Give the z₀ slider its own full-width row under the buttons.
    const scrubLabel = playMount.querySelector(".fig-player label");
    if (scrubLabel) scrubLabel.style.flexBasis = "100%";
    eps.addEventListener("input", draw);
    reveal.addEventListener("input", draw);
    reveal.addEventListener("change", draw);
    clock.set((-2.2 - zmin) / (zmax - zmin));
  });
})();
