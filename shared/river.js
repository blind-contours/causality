/* The course map: roadmap stages as a channel, lessons as tributaries.
 * Pure rendering from data; progress states and navigation are supplied by the caller. */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    kids.forEach((k) => e.append(k));
    return e;
  };
  const color = (stage) => `var(--s-${stage})`;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // Positions are computed in (along, across) coordinates so one layout serves both orientations.
  function layout(stages, units, vertical) {
    const L = vertical ? 1500 : 1240,
      across = 380,
      axis = vertical ? 64 : across / 2;
    const map = (s, t) => (vertical ? [axis + t, s] : [s, axis + t]);
    const stationS = stages.map(
      (_, i) => 60 + (i * (L - 120)) / (stages.length - 1),
    );
    const wave = (i) => (vertical ? 0 : [22, -18, 12, -22, 10, -16][i % 6]);
    const pts = stationS.map((s, i) => map(s, wave(i)));
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
        c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
    }
    const byStage = {};
    units.forEach((u) => (byStage[u.stage] ||= []).push(u));
    const tribs = [];
    stages.forEach((key, i) => {
      const list = byStage[key] || [];
      const s1 = stationS[i],
        s0 = i ? stationS[i - 1] : s1 - 60;
      list.forEach((u, k) => {
        const f = (k + 1) / (list.length + 1),
          s = s0 + (s1 - s0) * (0.12 + 0.8 * f);
        const sign = vertical ? 1 : k % 2 ? 1 : -1,
          reach = vertical ? 96 : [108, 132, 150][Math.floor(k / 2) % 3];
        const join = map(s, wave(i) * (0.5 + 0.5 * f)),
          node = map(s - (vertical ? 0 : 30), sign * reach);
        const path = vertical
          ? `M ${node[0]} ${node[1]} C ${node[0] - 40} ${node[1]}, ${join[0] + 30} ${join[1] - 10}, ${join[0]} ${join[1]}`
          : `M ${node[0]} ${node[1]} C ${node[0] + 30} ${node[1]}, ${join[0] - 34} ${join[1] - sign * 6}, ${join[0]} ${join[1]}`;
        tribs.push({ u, node, sign, path });
      });
    });
    return { L, across, pts, d, tribs, vertical };
  }

  /* opts: { stages, units, status(u) -> "new"|"part"|"done"|"now", href(u), label(status),
   *         onSelect(u), vertical } */
  function render(svg, opts) {
    const { stages, units } = opts;
    const g = layout(stages, units, !!opts.vertical);
    svg.replaceChildren();
    svg.setAttribute(
      "viewBox",
      g.vertical ? `0 0 ${g.across} ${g.L}` : `0 0 ${g.L} ${g.across}`,
    );
    svg.append(el("path", { class: "channel-bed", d: g.d }));
    const segs = g.d.split(" C ");
    let start = segs[0];
    segs.slice(1).forEach((seg, i) => {
      svg.append(
        el("path", {
          class: "channel",
          d: `${start} C ${seg}`,
          stroke: color(stages[i + 1]),
          style: `animation-delay:${i * 0.18}s`,
        }),
      );
      start = "M " + seg.split(", ")[2];
    });
    g.tribs.forEach(({ u, path }, i) =>
      svg.append(
        el("path", {
          class: "trib",
          d: path,
          stroke: color(u.stage),
          style: `animation-delay:${0.5 + i * 0.06}s`,
        }),
      ),
    );
    const [sx, sy] = g.pts[0];
    svg.append(
      el(
        "text",
        {
          class: "source",
          x: g.vertical ? sx + 20 : sx - 46,
          y: g.vertical ? sy + 4 : sy + 44,
          "text-anchor": "start",
        },
        "headwaters: a question",
      ),
    );
    g.pts.forEach(([x, y], i) => {
      const st = el("g", {
        class: "station",
        style: `animation-delay:${0.2 + i * 0.18}s`,
      });
      st.append(el("circle", { cx: x, cy: y, r: 9, stroke: color(stages[i]) }));
      st.append(
        el(
          "text",
          {
            x: g.vertical ? x + 20 : x,
            y: g.vertical ? y - 16 : y + 30,
            "text-anchor": g.vertical ? "start" : "middle",
            fill: color(stages[i]),
          },
          cap(stages[i]),
        ),
      );
      svg.append(st);
    });
    g.tribs.forEach(({ u, node: [x, y], sign }, i) => {
      const status = opts.status(u);
      const a = el("a", {
        class: "node " + status,
        href: opts.href(u),
        "data-unit": u.id,
        "aria-label": `${u.n}. ${u.title}, ${u.minutes} minutes, ${opts.label(status)}`,
        style: `animation-delay:${0.6 + i * 0.06}s`,
      });
      if (status === "now")
        a.append(
          el("circle", {
            class: "halo",
            cx: x,
            cy: y,
            r: 16,
            stroke: color(u.stage),
          }),
        );
      a.append(
        el("circle", {
          class: "ring",
          cx: x,
          cy: y,
          r: 11,
          stroke: color(u.stage),
        }),
      );
      if (status === "done")
        a.append(el("circle", { cx: x, cy: y, r: 7, fill: color(u.stage) }));
      if (status === "part")
        a.append(
          el("path", {
            d: `M ${x} ${y - 7} A 7 7 0 0 1 ${x} ${y + 7} Z`,
            fill: color(u.stage),
          }),
        );
      const up = sign < 0,
        tx = g.vertical ? x + 18 : x + 10,
        ty = g.vertical ? y + 4 : y + (up ? -20 : 33);
      const t = el("text", {
        x: tx,
        y: ty,
        "text-anchor": g.vertical ? "start" : "end",
      });
      t.append(
        el("tspan", { class: "n" }, String(u.n).padStart(2, "0") + "  "),
        u.short,
      );
      a.append(t);
      if (opts.onSelect) {
        a.addEventListener("mouseenter", () => opts.onSelect(u));
        a.addEventListener("focus", () => opts.onSelect(u));
      }
      svg.append(a);
    });
  }
  window.CausalRiver = { render, layout };
})();
