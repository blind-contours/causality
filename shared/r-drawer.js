/* "Now in R" drawer.
   Usage on a lesson page:
     <link rel="stylesheet" href="../shared/r-drawer.css">
     <script src="../shared/r-drawer.js" defer></script>
     <div data-r="one-step-ate"></div>
   The drawer loads examples/r/<name>.R (resolved relative to this script), shows the
   code with light syntax highlighting, a Copy button, and the expected output parsed
   from the trailing "# Expected output:" comment block of the .R file.
   Optional attributes on the mount: data-r-intro="..." replaces the intro line;
   data-r-open opens the drawer initially. No dependencies. */
(function (root) {
  "use strict";
  const script = typeof document !== "undefined" ? document.currentScript : null;
  const base = (() => {
    try {
      return new URL("../examples/r/", script ? script.src : location.href).href;
    } catch (e) {
      return "../examples/r/";
    }
  })();
  const MARK = /^#\s*Expected output:\s*$/;
  const KEYWORDS = new Set([
    "function", "if", "else", "for", "in", "while", "repeat", "return", "next", "break",
    "TRUE", "FALSE", "NULL", "NA", "Inf", "NaN", "library", "require",
  ]);

  /* Split an .R file into code and expected output (comment prefix removed). */
  function parse(text) {
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    const at = lines.findIndex((l) => MARK.test(l));
    const codeLines = at < 0 ? lines : lines.slice(0, at);
    while (codeLines.length && !codeLines[codeLines.length - 1].trim()) codeLines.pop();
    let output = null;
    if (at >= 0) {
      const out = lines.slice(at + 1).map((l) => l.replace(/^# ?/, ""));
      while (out.length && !out[out.length - 1].trim()) out.pop();
      output = out.join("\n");
    }
    return { code: codeLines.join("\n"), output };
  }

  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* Tokenize R source: comments, strings, numbers and a few keywords. */
  function highlight(code) {
    const re =
      /(#[^\n]*)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|((?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?L?)|([A-Za-z.][A-Za-z0-9._]*)/g;
    let html = "",
      last = 0,
      m;
    while ((m = re.exec(code))) {
      html += esc(code.slice(last, m.index));
      const [t, com, str, num, word] = m;
      if (com) html += `<span class="r-com">${esc(com)}</span>`;
      else if (str) html += `<span class="r-str">${esc(str)}</span>`;
      else if (num) html += `<span class="r-num">${esc(num)}</span>`;
      else if (KEYWORDS.has(word)) html += `<span class="r-kw">${esc(word)}</span>`;
      else html += esc(t);
      last = m.index + t.length;
    }
    return html + esc(code.slice(last));
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext)
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return fallbackCopy(text);
  }
  function fallbackCopy(text) {
    return new Promise((resolve, reject) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      const sel = document.getSelection(),
        prev = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      ta.remove();
      if (prev && sel) {
        sel.removeAllRanges();
        sel.addRange(prev);
      }
      ok ? resolve() : reject(new Error("copy failed"));
    });
  }

  function selectCode(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function mount(host) {
    if (host.dataset.rReady) return;
    host.dataset.rReady = "1";
    const name = (host.getAttribute("data-r") || "").trim();
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) return;
    const file = name + ".R",
      url = base + file,
      uid = "r-drawer-" + name + "-" + Math.random().toString(36).slice(2, 7);
    const intro =
      host.getAttribute("data-r-intro") ||
      "The same computation in plain R. Paste it into R 4.3 or later: it is seeded, so your output should match the block below.";
    const details = document.createElement("details");
    details.className = "r-drawer";
    if (host.hasAttribute("data-r-open")) details.open = true;
    details.innerHTML = `<summary><span class="r-drawer-badge" aria-hidden="true">R</span><span class="r-drawer-title">Now in R</span><span class="r-drawer-file">${esc(file)}</span></summary>
<div class="r-drawer-body">
  <p class="r-drawer-intro">${esc(intro)}</p>
  <div class="r-drawer-bar">
    <span class="r-drawer-label" id="${uid}-code">R code</span>
    <span class="r-drawer-actions">
      <a class="r-drawer-raw" href="${esc(url)}" download="${esc(file)}">Download .R</a>
      <button type="button" class="r-drawer-copy" aria-label="Copy the R code of ${esc(file)} to the clipboard" disabled>Copy</button>
    </span>
  </div>
  <pre class="r-code" tabindex="0" aria-labelledby="${uid}-code"><code>Loading ${esc(file)}…</code></pre>
  <p class="r-drawer-status" role="status" aria-live="polite"></p>
  <div class="r-drawer-out" hidden>
    <span class="r-drawer-label" id="${uid}-out">Expected output</span>
    <pre class="r-output" tabindex="0" aria-labelledby="${uid}-out"><code></code></pre>
  </div>
</div>`;
    host.replaceChildren(details);
    host.classList.add("r-drawer-host");
    const codeEl = details.querySelector(".r-code code"),
      btn = details.querySelector(".r-drawer-copy"),
      status = details.querySelector(".r-drawer-status"),
      outWrap = details.querySelector(".r-drawer-out"),
      outEl = details.querySelector(".r-output code");
    let source = "",
      timer = 0;
    btn.addEventListener("click", () => {
      copyText(source).then(
        () => {
          btn.textContent = "Copied";
          status.textContent = "R code copied to the clipboard.";
        },
        () => {
          selectCode(codeEl);
          btn.textContent = "Copy";
          status.textContent = "Copying is blocked here. The code is selected: press Ctrl+C or Cmd+C.";
        },
      );
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = "Copy";
      }, 2000);
    });
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        return r.text();
      })
      .then((text) => {
        const { code, output } = parse(text);
        source = code + "\n";
        codeEl.innerHTML = highlight(code);
        btn.disabled = false;
        if (output != null) {
          outEl.textContent = output;
          outWrap.hidden = false;
        }
      })
      .catch((err) => {
        details.querySelector(".r-code").hidden = true;
        details.querySelector(".r-drawer-bar").hidden = true;
        status.innerHTML = `Could not load <a href="${esc(url)}">${esc(file)}</a> (${esc(String(err.message || err))}). Open the file directly instead.`;
      });
  }

  function init(scope) {
    (scope || document).querySelectorAll("[data-r]").forEach(mount);
  }

  const api = { parse, highlight, init };
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.RDrawer = api;
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", () => init());
    else init();
  }
})(typeof self !== "undefined" ? self : globalThis);
