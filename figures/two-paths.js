/* Two paths: one patient, two possible futures, and the gap no one can see.
 * Rosa is the first patient in the course cohort's presentation order (slot 0). She was treated.
 * A hand-drawn Rosa stands at time zero; her observed path (solid, treated) and the unseen path of
 * "Alt. Rosa" (dashed, in a soft cloud, untreated) fan out to their one-year outcomes; a green
 * bracket at one year marks her individual effect Y(1) − Y(0). Then the unseen world fades, and
 * the one person fans out into the 100-patient cohort: each shows us one path, and the course is
 * about recovering their average gap (the sample ATE).
 * Exact: the one-year values, Rosa's effect and the cohort average come from CausalCohort via
 * numbers() below (tested in tests/two-paths.test.cjs). Schematic: the shape of each path between
 * time zero and one year (the cohort records the outcome at one year only).
 * Works without CausalAnim (the landing page does not load anim.js). */
(function (root) {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;

  /* Rosa is chosen by rule, not by hand: the first patient in presentation order. */
  function pick(cohort) {
    return cohort.patients.find((p) => p.slot === 0);
  }

  function numbers(cohort) {
    const p = pick(cohort);
    const ps = cohort.patients;
    const tr = ps.filter((q) => q.a),
      co = ps.filter((q) => !q.a);
    return {
      id: p.id,
      x: p.x,
      a: p.a,
      y1: p.y1,
      y0: p.y0,
      seen: p.a ? p.y1 : p.y0,
      unseen: p.a ? p.y0 : p.y1,
      effect: p.y1 - p.y0,
      n: ps.length,
      nTreated: tr.length,
      sampleATE: mean(ps.map((q) => q.y1 - q.y0)),
      naive: mean(tr.map((q) => q.y)) - mean(co.map((q) => q.y)),
    };
  }

  /* Every number the figure prints, as text. */
  function labels(N) {
    const f = (v) => v.toFixed(2);
    return {
      patient: "Patient #" + N.id,
      severity: N.x ? "high severity" : "low severity",
      arm: N.a ? "treated" : "not treated",
      y1: f(N.y1),
      y0: f(N.y0),
      seen: f(N.seen),
      unseen: f(N.unseen),
      effect: (N.effect >= 0 ? "+" : "") + f(N.effect),
      ate: f(N.sampleATE),
      n: String(N.n),
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = { pick, numbers, labels };
    return;
  }
  root.TwoPaths = { pick, numbers, labels };

  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (t, a = {}, txt) => {
    const e = document.createElementNS(NS, t);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };
  const htmlEl = (t, a = {}, txt) => {
    const e = document.createElement(t);
    for (const [k, v] of Object.entries(a))
      k === "class" ? (e.className = v) : e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const smooth = (s) => s * s * (3 - 2 * s);
  const lerp = (a, b, t) => a + (b - a) * t;
  // Progress of a beat that runs from a to b (ms), eased.
  const beat = (t, a, b) => inOut(clamp((t - a) / (b - a)));
  const reduced = () =>
    !!(root.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  /* Timeline (ms). END is the final, fully annotated state. */
  const T = {
    person: [0, 1400],
    name: [1100, 1600],
    obs: [1800, 3800],
    cloud: [2300, 3300],
    alt: [2600, 4400],
    ends: [3900, 4500],
    bracket: [4800, 5700],
    blabel: [5500, 6200],
    dim: [7000, 7800],
    dots: [8200, 10000],
    avg: [10300, 10900],
  };
  const END = 11000;
  const CAPTIONS = [
    [0, "Meet Rosa, at time zero: the day she could start treatment."],
    [T.obs[0], "Two futures branch from here. In one, Rosa is treated. In the other, Alt. Rosa is not."],
    [T.bracket[0], "The gap between them at one year is Rosa's treatment effect. Nobody can ever observe it."],
    [T.dim[0], "We only ever see one path per person. Rosa was treated, so her other path stays unseen."],
    [T.dots[0], "Each of these 100 patients also shows us just one path. This course is about recovering their average gap from those single paths."],
  ];

  const CSS = `
.tp-fig{margin:0}
.tp-fig svg.tp-svg{display:block;width:100%;height:auto;overflow:visible}
.tp-fig .tp-pen{fill:none;stroke:var(--ink);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}
.tp-fig .tp-obs{fill:none;stroke:var(--p);stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
.tp-fig .tp-alt{fill:none;stroke:var(--teal);stroke-width:2.6;stroke-dasharray:7 7;stroke-linecap:round}
.tp-fig .tp-cloud{fill:var(--soft);stroke:var(--rule);stroke-width:1.4;stroke-dasharray:3 6;stroke-linecap:round}
.tp-fig .tp-axis{stroke:var(--rule);stroke-width:1.5;stroke-linecap:round}
.tp-fig .tp-tick{stroke:var(--muted);stroke-width:1.5;stroke-linecap:round}
.tp-fig .tp-t{font:13px "IBM Plex Sans",system-ui,sans-serif;fill:var(--muted)}
.tp-fig .tp-t.ink{fill:var(--ink);font-weight:500}
.tp-fig .tp-t.name{fill:var(--ink);font:600 15px "Fraunces",Georgia,serif}
.tp-fig .tp-t.it{font-style:italic}
.tp-fig .tp-t.p{fill:var(--p);font-weight:500}.tp-fig .tp-t.teal{fill:var(--teal)}
.tp-fig .tp-t.green{fill:var(--green);font-weight:600}
.tp-fig .tp-v{font:500 13px "IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.tp-fig .tp-v.big{font-size:20px;font-weight:600}
.tp-fig .tp-v.p{fill:var(--p)}.tp-fig .tp-v.teal{fill:var(--teal)}.tp-fig .tp-v.green{fill:var(--green)}
.tp-fig .tp-end.obs{fill:var(--p);stroke:var(--paper);stroke-width:2}
.tp-fig .tp-end.alt{fill:var(--paper);stroke:var(--teal);stroke-width:2;stroke-dasharray:2 3}
.tp-fig .tp-br{fill:none;stroke:var(--green);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.tp-fig .tp-dot.a1{fill:var(--p)}.tp-fig .tp-dot.a0{fill:var(--teal)}
.tp-fig .tp-ring{fill:none;stroke:var(--ink);stroke-width:2}
.tp-fig .tp-bar{display:flex;gap:12px;align-items:flex-start;margin-top:6px}
.tp-fig .tp-bar .fig-caption{margin:0;flex:1;font-size:15px;color:var(--ink);min-height:3em}
.tp-fig .tp-replay{min-height:40px;padding:6px 12px;font-size:14px;white-space:nowrap}
.tp-fig details{margin-top:8px;font-size:14px}
.tp-fig details summary{cursor:pointer;color:var(--muted);min-height:32px}
.tp-fig .fig-readout{margin-top:6px}
.tp-fig .tp-note{font-size:13.5px;color:var(--muted);margin:8px 0 0}
`;

  function mount(host) {
    if (host.dataset.tpMounted) return;
    host.dataset.tpMounted = "1";
    const C = root.CausalCohort;
    if (!C) {
      host.textContent = "This figure needs science/cohort.js.";
      return;
    }
    const cohort = C.cohort;
    const N = numbers(cohort);
    const L = labels(N);
    const bySlot = cohort.patients.slice().sort((a, b) => a.slot - b.slot);
    if (!document.getElementById("tp-style"))
      document.head.append(htmlEl("style", { id: "tp-style" }, CSS));
    host.classList.add("figure", "tp-fig");
    const uid = "tp" + Math.random().toString(36).slice(2, 7);

    const svg = svgEl("svg", {
      class: "tp-svg",
      role: "img",
      "aria-label": `Rosa (${L.patient}, ${L.severity}) stands at time zero. Two paths fan out over one year: the one we observe, treated, ends at ${L.seen}; the unseen one, Alt. Rosa untreated, ends at ${L.unseen}. The gap, her treatment effect of ${L.effect}, is impossible to observe. Then the cohort of ${L.n} patients appears; their average gap is ${L.ate}.`,
    });
    const replay = htmlEl("button", { type: "button", class: "tp-replay" }, "↺ Replay");
    const cap = htmlEl("p", { class: "fig-caption", "aria-live": "polite" });
    const bar = htmlEl("div", { class: "tp-bar" });
    bar.append(cap, replay);
    const det = htmlEl("details");
    det.innerHTML = `<summary>Rosa's numbers</summary>
<div class="fig-readout">
<span class="k">Who</span><span>${L.patient} in the course cohort, ${L.severity}, ${L.arm}</span>
<span class="k">Outcome at one year, treated</span><span>Y(1) = ${L.y1}${N.a ? " (seen)" : " (unseen)"}</span>
<span class="k">Outcome at one year, untreated</span><span>Y(0) = ${L.y0}${N.a ? " (unseen)" : " (seen)"}</span>
<span class="k">Her effect</span><span>Y(1) − Y(0) = ${L.effect}</span>
<span class="k">Average effect, all ${L.n}</span><span>${L.ate}</span>
</div>
<p class="tp-note">Larger outcomes are better. The two one-year values are Rosa's, from the simulated course cohort; we can print both only because we wrote both worlds down. In real data one of them is always missing. The wiggles between time zero and one year are drawn for feel: the cohort records the outcome at one year.</p>`;
    host.replaceChildren(svg, bar, det);

    let G = null; // current geometry and element handles
    let tNow = 0,
      raf = null,
      started = false;

    function build() {
      const W = Math.max(300, Math.round(host.clientWidth || 360));
      const wide = W >= 620;
      const top = 14;
      const plotH = wide ? 270 : 262;
      const axisY = top + plotH;
      const xStart = wide ? 104 : 74;
      const xEnd = W - (wide ? 70 : 50);
      const yHi = top + 40; // the higher one-year outcome
      const yLo = axisY - 78; // the lower one (and the start)
      const lo = Math.min(N.y0, N.y1),
        hi = Math.max(N.y0, N.y1);
      const k = (yLo - yHi) / (hi - lo || 1);
      const sy = (v) => yLo - (v - lo) * k;
      const start = N.y0; // both futures leave from where untreated Rosa would stay
      const ySeenEnd = sy(N.seen),
        yUnseenEnd = sy(N.unseen);

      // Teaser grid below the axis.
      const cols = wide ? 25 : 20,
        rows = Math.ceil(N.n / cols);
      const gap = wide ? 16 : Math.min(16.5, (W - 24) / cols);
      const r = wide ? 5 : 5;
      const gx0 = wide ? xStart - 24 : (W - gap * (cols - 1)) / 2;
      const headY = axisY + 58;
      const gy0 = headY + (wide ? 20 : 38);
      const gridBottom = gy0 + gap * (rows - 1);
      const avgY = wide ? gy0 + 4 : gridBottom + 32;
      const H = (wide ? Math.max(gridBottom, avgY + 46) : avgY + 46) + 12;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);
      svg.replaceChildren();

      // Hand wobble: deterministic, tapered to zero at both ends.
      const wob = (t, s) => Math.sin(Math.PI * t) * (1.1 * Math.sin(13 * t + s) + 0.7 * Math.sin(29 * t + 2 * s));
      const X = (t) => xStart + t * (xEnd - xStart);
      const seenV = (t) => start + (N.seen - start) * smooth(clamp(t / 0.62));
      const unseenV = (t) =>
        start + (N.unseen - start) * smooth(clamp(t / 0.62)) + 0.2 * Math.sin(2 * Math.PI * t) * (1 - 0.4 * t);
      const pathD = (fv, s) => {
        let d = "";
        for (let i = 0; i <= 80; i++) {
          const t = i / 80;
          d += (i ? "L" : "M") + X(t).toFixed(1) + " " + (sy(fv(t)) + wob(t, s)).toFixed(1);
        }
        return d;
      };

      const defs = svgEl("defs");
      const clipObs = svgEl("clipPath", { id: uid + "-co" }),
        clipAlt = svgEl("clipPath", { id: uid + "-ca" });
      const rObs = svgEl("rect", { x: xStart - 6, y: 0, height: axisY, width: 0 }),
        rAlt = svgEl("rect", { x: xStart - 6, y: 0, height: axisY, width: 0 });
      clipObs.append(rObs);
      clipAlt.append(rAlt);
      defs.append(clipObs, clipAlt);
      svg.append(defs);

      // Axis: always visible, so the frame is never empty.
      const axis = svgEl("g");
      axis.append(
        svgEl("line", { class: "tp-axis", x1: xStart - 6, x2: xEnd + 8, y1: axisY, y2: axisY }),
        svgEl("line", { class: "tp-tick", x1: xStart, x2: xStart, y1: axisY - 5, y2: axisY + 5 }),
        svgEl("line", { class: "tp-tick", x1: xEnd, x2: xEnd, y1: axisY - 5, y2: axisY + 5 }),
        svgEl("text", { class: "tp-t", x: xStart, y: axisY + 22, "text-anchor": "middle" }, "time zero"),
        svgEl("text", { class: "tp-t", x: xEnd, y: axisY + 22, "text-anchor": "middle" }, "one year"),
        svgEl("text", { class: "tp-t it", x: xStart + 8, y: top + 6 }, "outcome (larger is better)"),
      );
      svg.append(axis);

      // The unseen world: a soft cloud around Alt. Rosa's path.
      const cx0 = xStart + 30,
        cx1 = Math.min(xEnd + 22, W - 4),
        cyMid = yUnseenEnd + 6,
        halfH = wide ? 40 : 36;
      // A hand-drawn cloud: scalloped top and bottom edges, round ends.
      const nb = Math.max(4, Math.round((cx1 - cx0 - 2 * halfH) / (wide ? 46 : 38)));
      const bw = (cx1 - cx0 - 2 * halfH) / nb;
      const yT = cyMid - halfH + 10,
        yB = cyMid + halfH - 10;
      let cd = `M${(cx0 + halfH).toFixed(1)} ${yT.toFixed(1)}`;
      for (let i = 0; i < nb; i++) {
        const rr = bw / 2 + (i % 2 ? 3 : 0);
        cd += ` a${rr.toFixed(1)} ${(rr * 0.8).toFixed(1)} 0 0 1 ${bw.toFixed(1)} ${(i % 3 === 1 ? -2 : i % 3 === 2 ? 2 : 0).toFixed(1)}`;
      }
      cd += ` L${(cx1 - halfH).toFixed(1)} ${yT.toFixed(1)}`;
      cd += ` a${halfH - 10} ${halfH - 10} 0 0 1 0 ${(yB - yT).toFixed(1)}`;
      for (let i = 0; i < nb; i++) {
        const rr = bw / 2 + (i % 2 ? 0 : 3);
        cd += ` a${rr.toFixed(1)} ${(rr * 0.7).toFixed(1)} 0 0 1 ${(-bw).toFixed(1)} ${(i % 3 === 2 ? -2 : i % 3 === 0 ? 1.5 : 0).toFixed(1)}`;
      }
      cd += ` L${(cx0 + halfH).toFixed(1)} ${yB.toFixed(1)}`;
      cd += ` a${halfH - 10} ${halfH - 10} 0 0 1 0 ${(yT - yB).toFixed(1)}`;
      const cloud = svgEl("g", { opacity: 0 });
      cloud.append(
        svgEl("path", { class: "tp-cloud", d: cd + "Z" }),
        svgEl("text", { class: "tp-t it", x: wide ? cx0 + halfH - 6 : cx0 + 6, y: yB + (wide ? 2 : 6) }, "the unseen world"),
      );
      svg.append(cloud);

      // The two paths.
      const alt = svgEl("path", { class: "tp-alt", d: pathD(unseenV, 2.1), "clip-path": `url(#${uid}-ca)` });
      const obs = svgEl("path", { class: "tp-obs", d: pathD(seenV, 0.4), "clip-path": `url(#${uid}-co)` });
      svg.append(alt, obs);

      // End points, values and names.
      const ends = {
        obs: svgEl("g", { opacity: 0 }),
        alt: svgEl("g", { opacity: 0 }),
      };
      ends.obs.append(
        svgEl("circle", { class: "tp-end obs", cx: xEnd, cy: ySeenEnd, r: 6.5 }),
        svgEl("text", { class: "tp-v p", x: xEnd + 12, y: ySeenEnd + 4.5 }, L.seen),
        svgEl("text", { class: "tp-t p", x: xEnd, y: ySeenEnd - 16, "text-anchor": "end" }, wide ? "Rosa, treated (what we see)" : "Rosa, treated"),
      );
      ends.alt.append(
        svgEl("circle", { class: "tp-end alt", cx: xEnd, cy: yUnseenEnd, r: 6.5 }),
        svgEl("text", { class: "tp-v teal", x: xEnd + 12, y: yUnseenEnd + 4.5 }, L.unseen),
        svgEl("text", { class: "tp-t teal", x: xEnd, y: yUnseenEnd + 25, "text-anchor": "end" }, wide ? "Alt. Rosa, not treated" : "Alt. Rosa"),
      );
      svg.append(ends.alt, ends.obs);

      // Bracket at one year and its label, in the gap between the two futures.
      const bx = xEnd - 18,
        b1 = Math.min(ySeenEnd, yUnseenEnd) + 10,
        b2 = Math.max(ySeenEnd, yUnseenEnd) - 10,
        bm = (b1 + b2) / 2;
      const bracket = svgEl("path", {
        class: "tp-br",
        d: `M${bx + 7} ${b1} Q${bx} ${b1} ${bx} ${b1 + 8} L${bx - 0.8} ${bm - 5} L${bx - 6} ${bm} L${bx - 0.8} ${bm + 5} L${bx} ${b2 - 8} Q${bx} ${b2} ${bx + 7} ${b2}`,
      });
      const blab = svgEl("g", { opacity: 0 });
      const lx = bx - 14;
      const ly = bm + (wide ? 0 : 10);
      const blines = wide
        ? [["tp-t ink", "Rosa's treatment effect"], ["tp-v green", L.effect + " at one year"], ["tp-t it", "impossible to observe"]]
        : [["tp-t ink", "Her effect"], ["tp-v green", L.effect], ["tp-t it", "impossible"], ["tp-t it", "to observe"]];
      blines.forEach(([cls, txt], i) =>
        blab.append(
          svgEl("text", { class: cls, x: lx, y: ly + 4 + 19 * (i - (blines.length - 1) / 2), "text-anchor": "end" }, txt),
        ),
      );
      svg.append(bracket, blab);

      // Rosa, drawn by hand. Her reaching hand meets the start of both paths.
      const sc = wide ? 1.3 : 1;
      const px = xStart - 30 * sc,
        py = sy(start) - 4 * sc;
      const J = (a, b, bend) => {
        const mx = (a[0] + b[0]) / 2 + bend,
          my = (a[1] + b[1]) / 2 - bend * 0.6;
        return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
      };
      let head = "";
      for (let i = 0; i <= 40; i++) {
        const th = -2.2 + (i / 40) * (2 * Math.PI + 0.45);
        const rr = sc * (9.5 + 0.6 * Math.sin(3 * th + 1));
        head += (i ? "L" : "M") + (px + 1 + rr * Math.cos(th)).toFixed(1) + " " + (py - 28 * sc + rr * Math.sin(th)).toFixed(1);
      }
      const neck = [px + 0.5, py - 17.5 * sc],
        hip = [px + 1.5, py + 14 * sc],
        shoulder = [px + 0.5, py - 10 * sc];
      const pieces = [
        [head, 0, 0.42],
        [J(neck, hip, 1.2), 0.32, 0.58],
        [J(shoulder, [px - 12 * sc, py + 9 * sc], -1.5), 0.5, 0.72],
        [J(shoulder, [xStart - 4, sy(start)], 1.5), 0.55, 0.8],
        [J(hip, [px - 9 * sc, py + 42 * sc], 1), 0.7, 0.9],
        [J(hip, [px + 11 * sc, py + 42 * sc], -1), 0.76, 1],
      ];
      const person = svgEl("g");
      const penPaths = pieces.map(([d, a, b]) => {
        const e = svgEl("path", { class: "tp-pen", d });
        person.append(e);
        return { e, a, b, len: 0 };
      });
      const name = svgEl("text", { class: "tp-t name", x: px + 1, y: py + 42 * sc + 22, "text-anchor": "middle", opacity: 0 }, "Rosa");
      svg.append(person, name);
      penPaths.forEach((p) => {
        p.len = p.e.getTotalLength ? p.e.getTotalLength() + 1 : 60;
        p.e.setAttribute("stroke-dasharray", p.len);
      });

      // Teaser: the cohort, one dot per patient, in presentation order.
      const head2 = svgEl("g", { opacity: 0 });
      const leg = svgEl("text", { class: "tp-t ink", x: gx0 - 5, y: wide ? headY : headY + 18 });
      leg.append(
        document.createTextNode(wide ? "Rosa is one of 100 patients. Each shows us one path: " : "Each shows us one path: "),
        svgEl("tspan", { class: "tp-t p" }, "treated"),
        document.createTextNode(" or "),
        svgEl("tspan", { class: "tp-t teal" }, "not treated"),
      );
      if (!wide) head2.append(svgEl("text", { class: "tp-t ink", x: gx0 - 5, y: headY }, "Rosa is one of 100 patients."));
      head2.append(leg);
      svg.append(head2);
      const origin = [xStart - 2, sy(start)];
      const dots = svgEl("g");
      const dotEls = bySlot.map((p, i) => {
        const gxy = [gx0 + (i % cols) * gap, gy0 + Math.floor(i / cols) * gap];
        const c = svgEl("circle", { class: "tp-dot a" + p.a, r: 0, cx: origin[0], cy: origin[1] });
        dots.append(c);
        return { c, gxy, i };
      });
      const ring = svgEl("circle", { class: "tp-ring", cx: dotEls[0].gxy[0], cy: dotEls[0].gxy[1], r: r + 3.5, opacity: 0 });
      svg.append(dots, ring);
      const avg = svgEl("g", { opacity: 0 });
      const ax = wide ? gx0 + gap * (cols - 1) + 28 : gx0 - 5;
      avg.append(
        svgEl("text", { class: "tp-t ink", x: ax, y: avgY }, "Their average gap"),
        svgEl("text", { class: "tp-v green big", x: ax, y: avgY + 24 }, L.ate),
        svgEl("text", { class: "tp-t it", x: ax, y: avgY + 44 }, wide ? "is what this course teaches you to recover." : "is what you will learn to recover."),
      );
      svg.append(avg);

      G = { rObs, rAlt, span: xEnd - xStart + 12, cloud, alt, obs, ends, bracket, blab, penPaths, name, dotEls, origin, r, ring, head2, avg };
    }

    function render(t) {
      tNow = t;
      if (!G) return;
      G.penPaths.forEach((p) => {
        const u = clamp((beat(t, ...T.person) - p.a) / (p.b - p.a));
        p.e.setAttribute("stroke-dashoffset", (p.len * (1 - u)).toFixed(1));
        p.e.setAttribute("opacity", u > 0 ? 1 : 0); // hide the round cap of an undrawn stroke
      });
      G.name.setAttribute("opacity", beat(t, ...T.name));
      G.rObs.setAttribute("width", (G.span * beat(t, ...T.obs)).toFixed(1));
      G.rAlt.setAttribute("width", (G.span * beat(t, ...T.alt)).toFixed(1));
      const dim = beat(t, ...T.dim);
      G.cloud.setAttribute("opacity", (beat(t, ...T.cloud) * lerp(1, 0.5, dim)).toFixed(3));
      G.alt.setAttribute("opacity", lerp(0.8, 0.5, dim).toFixed(3));
      G.ends.obs.setAttribute("opacity", clamp((t - T.ends[0]) / 500));
      G.ends.alt.setAttribute("opacity", (clamp((t - T.ends[0] - 500) / 500) * lerp(1, 0.55, dim)).toFixed(3));
      const bk = beat(t, ...T.bracket);
      const blen = G.bracket.getTotalLength ? G.bracket.getTotalLength() + 1 : 200;
      G.bracket.setAttribute("stroke-dasharray", blen);
      G.bracket.setAttribute("stroke-dashoffset", (blen * (1 - bk)).toFixed(1));
      G.bracket.setAttribute("opacity", bk > 0 ? 1 : 0);
      G.blab.setAttribute("opacity", beat(t, ...T.blabel));
      // Teaser: dots fly out of Rosa into the grid, in order, with a short stagger.
      const d0 = T.dots[0],
        each = 700,
        stag = (T.dots[1] - d0 - each) / (G.dotEls.length - 1);
      G.dotEls.forEach(({ c, gxy, i }) => {
        const u = inOut(clamp((t - d0 - i * stag) / each));
        c.setAttribute("cx", lerp(G.origin[0], gxy[0], u).toFixed(1));
        c.setAttribute("cy", lerp(G.origin[1], gxy[1], u).toFixed(1));
        c.setAttribute("r", (G.r * clamp(u * 1.6)).toFixed(2));
      });
      G.head2.setAttribute("opacity", beat(t, d0 - 300, d0 + 300));
      G.ring.setAttribute("opacity", beat(t, d0 + 500, d0 + 900));
      G.avg.setAttribute("opacity", beat(t, ...T.avg));
      let c = CAPTIONS[0][1];
      for (const [at, txt] of CAPTIONS) if (t >= at) c = txt;
      if (cap.textContent !== c) cap.textContent = c;
      replay.hidden = !(started && t >= END);
    }

    function play() {
      cancelAnimationFrame(raf);
      started = true;
      if (reduced()) return render(END);
      const t0 = performance.now();
      const tick = (now) => {
        render(Math.min(END, now - t0));
        if (tNow < END) raf = requestAnimationFrame(tick);
        else render(END);
      };
      raf = requestAnimationFrame(tick);
    }
    replay.onclick = play;

    build();
    render(reduced() ? END : 0);

    // Autoplay once when the figure comes into view. An IntersectionObserver does the work; a light
    // poll backs it up, because lesson pages re-parent and un-hide figures as beats are revealed.
    if (reduced()) {
      started = true;
      render(END);
    } else {
      const inView = () => {
        const r = svg.getBoundingClientRect();
        if (!r.height || !svg.isConnected || host.closest("[hidden]")) return false;
        const vis = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
        return vis / Math.min(r.height, innerHeight) >= 0.35;
      };
      const kick = () => {
        if (started) return;
        if (inView()) {
          started = true;
          setTimeout(play, 250);
        }
      };
      if ("IntersectionObserver" in root) new IntersectionObserver(kick, { threshold: [0, 0.35, 0.7] }).observe(svg);
      const poll = setInterval(() => (started ? clearInterval(poll) : kick()), 400);
      kick();
    }

    // Lay out at the real width; redraw the current moment on resize.
    let lastW = host.clientWidth;
    if ("ResizeObserver" in root)
      new ResizeObserver(() => {
        const w = host.clientWidth;
        if (Math.abs(w - lastW) < 2) return;
        lastW = w;
        build();
        render(tNow);
      }).observe(host);

    // Test and screenshot hook: jump to a moment of the animation.
    host.twoPaths = {
      seek(t) {
        cancelAnimationFrame(raf);
        started = true;
        render(Math.max(0, Math.min(END, t)));
      },
      play,
      END,
    };
  }

  root.TwoPaths.mount = mount;
  const mountAll = () =>
    document.querySelectorAll('[data-figure="two-paths"]').forEach((m) => {
      if (m.dataset.mounted && m.dataset.tpMounted) return;
      m.dataset.mounted = "1";
      mount(m);
    });
  if (root.CausalFigures) root.CausalFigures.register("two-paths", (m) => mount(m));
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll);
  else mountAll();
})(globalThis);
