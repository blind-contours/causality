/* Landing-page toy: the one-step estimator in ten seconds.
 * Along a path from the fitted model P̂ (ε = 0) to the truth P (ε = 1) the target is
 *   ψ(ε) = ψ₀ − aδ(1 − ε) − bδ²(1 − ε)²  (a = b = 1),
 * so the plug-in ψ(0) misses by aδ + bδ². Its tangent at ε = 0 (the influence-function slope)
 * reaches ψ₀ + bδ² at ε = 1: the one-step removes the first-order error and leaves a remainder
 * that shrinks like δ². A schematic of the lesson-6 picture, not a fitted model. */
(function () {
  const svg = document.getElementById("hero-svg");
  if (!svg) return;
  const NS = "http://www.w3.org/2000/svg",
    el = (t, a = {}, txt) => {
      const e = document.createElementNS(NS, t);
      for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
      if (txt != null) e.textContent = txt;
      return e;
    };
  const slider = document.getElementById("hero-delta"),
    val = document.getElementById("hero-delta-v"),
    btn = document.getElementById("hero-step"),
    read = document.getElementById("hero-read");
  const PSI0 = 2,
    A = 1.0,
    B = 1.0;
  const L = 44,
    R = 272,
    T = 14,
    Bt = 172;
  const ymin = 0.45,
    ymax = 2.75;
  const sx = (e) => L + (R - L) * e,
    sy = (v) => Bt - ((Bt - T) * (v - ymin)) / (ymax - ymin);
  const psi = (e, d) => PSI0 - A * d * (1 - e) - B * d * d * (1 - e) ** 2;
  let step = 0,
    raf = null,
    played = false;

  function draw() {
    const d = +slider.value,
      plug = psi(0, d),
      slope = A * d + 2 * B * d * d,
      one = plug + slope,
      reach = step;
    val.textContent = d.toFixed(2);
    svg.replaceChildren();
    // axes and truth
    svg.append(
      el("line", { x1: L, x2: R, y1: Bt, y2: Bt, class: "h-axis" }),
      el("line", { x1: L, x2: R, y1: sy(PSI0), y2: sy(PSI0), class: "h-truth" }),
      el("text", { x: 2, y: sy(PSI0) - 6, class: "h-lab truth" }, "truth"),
      el("text", { x: L, y: Bt + 18, class: "h-lab" }, "your fit P̂"),
      el("text", { x: R + 6, y: Bt + 18, class: "h-lab end" }, "truth P"),
      el("text", { x: (L + R) / 2, y: Bt + 34, class: "h-lab mid dim" }, "a path through the model"),
    );
    // the curve ψ(ε)
    let dpath = "";
    for (let k = 0; k <= 60; k++) {
      const e = k / 60;
      dpath += (k ? "L" : "M") + sx(e).toFixed(1) + " " + sy(psi(e, d)).toFixed(1);
    }
    svg.append(el("path", { d: dpath, class: "h-curve" }));
    // tangent from the plug-in, drawn as far as the step has travelled
    if (reach > 0) {
      const e1 = reach;
      svg.append(
        el("line", { x1: sx(0), y1: sy(plug), x2: sx(e1), y2: sy(plug + slope * e1), class: "h-tan" }),
      );
    }
    // plug-in error bracket (left) and remainder bracket (right)
    svg.append(
      el("line", { x1: sx(0) - 10, x2: sx(0) - 10, y1: sy(plug), y2: sy(PSI0), class: "h-gap plug" }),
      el("circle", { cx: sx(0), cy: sy(plug), r: 6, class: "h-dot plug" }),
      el("circle", { cx: sx(1), cy: sy(PSI0), r: 5, class: "h-dot truth" }),
    );
    if (reach >= 1) {
      svg.append(
        el("line", { x1: sx(1) + 12, x2: sx(1) + 12, y1: sy(one), y2: sy(PSI0), class: "h-gap one" }),
        el("circle", { cx: sx(1), cy: sy(one), r: 6, class: "h-dot one" }),
        el("text", { x: sx(1) + 22, y: (sy(one) + sy(PSI0)) / 2 + 4, class: "h-lab one" }, "one step"),
      );
    }
    svg.append(el("text", { x: sx(0) + 10, y: sy(plug) + 16, class: "h-lab plug" }, "plug-in"));
    const e0 = plug - PSI0,
      e1 = one - PSI0;
    read.innerHTML =
      reach >= 1
        ? `Plug-in error <b class="plug">${e0.toFixed(2)}</b> → after one step <b class="one">+${e1.toFixed(2)}</b>. The step follows the tangent (the influence function). What is left shrinks like δ²: halve δ and it quarters.`
        : `The plug-in misses the truth by <b class="plug">${e0.toFixed(2)}</b>. The tangent at your fit points toward the truth.`;
    btn.textContent = reach >= 1 ? "Replay the step" : "Take one step";
  }
  function play() {
    cancelAnimationFrame(raf);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      step = 1;
      return draw();
    }
    step = 0;
    let last = performance.now();
    const tick = (now) => {
      step = Math.min(1, step + (now - last) / 1100);
      last = now;
      draw();
      if (step < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  slider.addEventListener("input", () => {
    played = true;
    draw();
  });
  btn.addEventListener("click", () => {
    played = true;
    play();
  });
  draw();
  // Alive on arrival: take the step once when the toy first comes into view.
  if ("IntersectionObserver" in window)
    new IntersectionObserver(
      (e, obs) => {
        if (e[0].isIntersecting && !played) {
          played = true;
          obs.disconnect();
          setTimeout(play, 600);
        }
      },
      { threshold: 0.6 },
    ).observe(svg);
})();
