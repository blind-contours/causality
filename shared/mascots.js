/* The page's one guide: a Greek letter drawn as a stick figure, in the
 * hand-drawn, warm-clay style of the Tao of RWD mascots. It reacts to what the
 * reader does; it never carries content that is not also in the text.
 *
 *   <span class="mascot" data-mood="worried"></span>
 *   CausalMascots.mount(document)          render every placeholder
 *   CausalMascots.mood(el, "cheer")        change expression in place
 *   CausalMascots.svg({ mood, tilt, x, y, size })  markup for embedding in an SVG
 *
 * Decorative only (aria-hidden). Motion lives in CSS and stops under
 * prefers-reduced-motion.
 */
(function (root) {
  "use strict";
  const MOODS = ["hello", "smile", "cheer", "worried", "surprised", "think", "calm", "warn"];

  /* Face centred at (cx, cy) for a head of radius 15. */
  function face(cx, cy, mood) {
    const e = (dx) => cx + dx;
    let eyes, mouth, brows = "";
    const open = (dx) =>
      `<g class="m-eye-g"><ellipse class="m-eye" cx="${e(dx)}" cy="${cy - 1}" rx="2.4" ry="3"/>` +
      `<circle class="m-glint" cx="${e(dx) + 0.9}" cy="${cy - 2.2}" r="0.85"/></g>`;
    const shut = (dx) => `<path class="m-mouth m-lid" d="M${e(dx) - 2.6} ${cy - 0.6} Q${e(dx)} ${cy - 3} ${e(dx) + 2.6} ${cy - 0.6}"/>`;
    eyes = mood === "calm" ? shut(-5) + shut(5) : open(-5) + open(5);
    switch (mood) {
      case "cheer":
        mouth = `<path class="m-open" d="M${cx - 5} ${cy + 4.2} Q${cx} ${cy + 11.5} ${cx + 5} ${cy + 4.2} Z"/>`;
        break;
      case "worried":
        mouth = `<path class="m-mouth" d="M${cx - 4.2} ${cy + 8} Q${cx} ${cy + 4.6} ${cx + 4.2} ${cy + 8}"/>`;
        brows = `<path class="m-brow" d="M${cx - 8.5} ${cy - 5.4} L${cx - 3.2} ${cy - 7.8}"/><path class="m-brow" d="M${cx + 8.5} ${cy - 5.4} L${cx + 3.2} ${cy - 7.8}"/>`;
        break;
      case "surprised":
        mouth = `<ellipse class="m-open" cx="${cx}" cy="${cy + 6.4}" rx="2.3" ry="2.9"/>`;
        brows = `<path class="m-brow" d="M${cx - 8} ${cy - 8} Q${cx - 5} ${cy - 10} ${cx - 2.4} ${cy - 8.2}"/><path class="m-brow" d="M${cx + 8} ${cy - 8} Q${cx + 5} ${cy - 10} ${cx + 2.4} ${cy - 8.2}"/>`;
        break;
      case "think":
        mouth = `<path class="m-mouth" d="M${cx - 3.4} ${cy + 6.6} Q${cx + 0.5} ${cy + 5.6} ${cx + 4} ${cy + 6}"/>`;
        brows = `<path class="m-brow" d="M${cx + 2.8} ${cy - 8.4} Q${cx + 5.5} ${cy - 10.2} ${cx + 8.3} ${cy - 8.2}"/>`;
        break;
      case "warn":
        mouth = `<path class="m-mouth" d="M${cx - 3.8} ${cy + 6.4} L${cx + 3.8} ${cy + 6.4}"/>`;
        brows = `<path class="m-brow" d="M${cx - 8.2} ${cy - 7} L${cx - 2.8} ${cy - 6.4}"/><path class="m-brow" d="M${cx + 8.2} ${cy - 7} L${cx + 2.8} ${cy - 6.4}"/>`;
        break;
      default: /* hello, smile, calm */
        mouth = `<path class="m-mouth" d="M${cx - 4.4} ${cy + 4.8} Q${cx} ${cy + 9.2} ${cx + 4.4} ${cy + 4.8}"/>`;
    }
    const cheeks = `<circle class="m-cheek" cx="${cx - 9}" cy="${cy + 4.6}" r="3"/><circle class="m-cheek" cx="${cx + 9}" cy="${cy + 4.6}" r="3"/>`;
    return `<g class="m-face-g">${eyes}${brows}${cheeks}${mouth}</g>`;
  }

  function figure(mood, tilt = 0) {
    return `<g class="m-body">
      <ellipse class="m-shadow" cx="50" cy="124.5" rx="22" ry="3.4"/>
      <path class="m-line" d="M50 95 C48.6 105 45.6 113 42.4 120.4"/>
      <path class="m-line" d="M50 95 C51.6 105 54.6 113 57.8 120.4"/>
      <ellipse class="m-foot" cx="39.4" cy="121.6" rx="6.4" ry="2.9"/>
      <ellipse class="m-foot" cx="60.8" cy="121.6" rx="6.4" ry="2.9"/>
      <path class="m-glyph" d="M50 38 C50.8 56 49.2 76 50.2 96"/>
      <g class="m-arms" style="transform: rotate(${tilt}deg)">
        <path class="m-glyph" d="M21.5 30 C20 52 31 63.5 50 63.5 C69 63.5 80.2 52 78.6 30"/>
        <circle class="m-hand" cx="21.4" cy="27.6" r="4.6"/>
        <circle class="m-hand" cx="78.6" cy="27.6" r="4.6"/>
      </g>
      <g class="m-head">
        <circle class="m-face" cx="50" cy="23" r="15"/>
        ${face(50, 23, mood)}
      </g>
    </g>`;
  }

  /* Full SVG; pass x/y/size to embed inside another SVG. */
  function svg(opts = {}) {
    const mood = MOODS.includes(opts.mood) ? opts.mood : "hello";
    const body = figure(mood, +opts.tilt || 0);
    const place = opts.size ? ` x="${opts.x || 0}" y="${opts.y || 0}" width="${opts.size}" height="${opts.size * 1.3}"` : "";
    return `<svg class="mascot-svg mood-${mood}" viewBox="0 0 100 130"${place} aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function render(el) {
    el.innerHTML = svg({ mood: el.dataset.mood });
    el.setAttribute("aria-hidden", "true");
  }

  function mount(scope = document) {
    scope.querySelectorAll(".mascot").forEach(render);
  }

  function mood(el, next) {
    if (!el) return;
    el.dataset.mood = next;
    render(el);
  }

  const api = { svg, mount, mood, MOODS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CausalMascots = api;
})(typeof window === "object" ? window : globalThis);
