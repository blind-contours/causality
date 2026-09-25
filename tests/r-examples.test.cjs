/* R examples for the "Now in R" drawer: files exist, carry a verbatim expected-output
   block the drawer can parse, and (when Rscript is installed) still reproduce it. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync, spawnSync } = require("node:child_process");
const drawer = require("../shared/r-drawer.js");
const dir = path.resolve(__dirname, "../examples/r");
const names = ["four-patients", "one-step-ate", "tmle-ate", "rct-adjustment", "crossfit-aipw", "km-vs-standardized"];
const read = (n) => fs.readFileSync(path.join(dir, n + ".R"), "utf8");
const hasR = spawnSync("Rscript", ["--version"]).status === 0;

test("every example exists, is seeded, short, and has an Expected output block", () => {
  for (const n of names) {
    const text = read(n);
    assert.match(text, /^# Expected output:\s*$/m, n);
    const { code, output } = drawer.parse(text);
    assert.ok(output && output.trim().length > 0, `${n}: empty expected output`);
    assert.ok(!code.includes("Expected output"), `${n}: marker leaked into code`);
    const lines = code.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
    assert.ok(lines.length <= 40, `${n}: ${lines.length} code lines`);
    assert.ok(/set\.seed\(|^d <- data\.frame/m.test(code), `${n}: not seeded`);
    assert.ok(!/library\((?!survival|splines)/.test(code), `${n}: non-base package`);
  }
  const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  for (const n of names) assert.ok(readme.includes(n + ".R"), `README lists ${n}.R`);
});

test("four-patients expected output shows lesson 08's numbers", () => {
  const { output } = drawer.parse(read("four-patients"));
  for (const s of ["correction = 0.8125", "one-step = 3.3125", "sum(H*r) = 10", "sum(H^2) = 35.125"])
    assert.ok(output.includes(s), s);
});

test("drawer parser and highlighter", () => {
  const p = drawer.parse("x <- 1 # one\n\n# Expected output:\n# [1] 1\n#\n# done\n");
  assert.equal(p.code, "x <- 1 # one");
  assert.equal(p.output, "[1] 1\n\ndone");
  assert.equal(drawer.parse("y <- 2\n").output, null);
  const h = drawer.highlight('a <- "x # <b>" # c < d\nf(1.5e-3L)');
  assert.ok(h.includes('<span class="r-str">"x # &lt;b&gt;"</span>'), h);
  assert.ok(h.includes('<span class="r-com"># c &lt; d</span>'), h);
  assert.ok(h.includes('<span class="r-num">1.5e-3L</span>'), h);
  assert.ok(!/<b>/.test(h));
});

test("examples reproduce their Expected output verbatim", { skip: !hasR && "Rscript not installed" }, () => {
  for (const n of names) {
    const out = execFileSync("Rscript", [n + ".R"], { cwd: dir, encoding: "utf8", timeout: 20000 });
    const norm = (s) => s.replace(/[ \t]+$/gm, "").replace(/\s+$/, "");
    assert.equal(norm(out), norm(drawer.parse(read(n)).output), n);
  }
});
