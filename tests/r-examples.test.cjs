/* R examples for the "Now in R" drawer: files exist, carry a verbatim expected-output
   block the drawer can parse, and (when Rscript is installed) still reproduce it. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync, spawnSync } = require("node:child_process");
const drawer = require("../shared/r-drawer.js");
const dir = path.resolve(__dirname, "../examples/r");
const names = [
  "propensity-weighting",
  "four-patients",
  "one-step-ate",
  "tmle-ate",
  "rct-adjustment",
  "crossfit-aipw",
  "km-vs-standardized",
  "survival-onestep",
  "capstone",
];
// Code-line budgets: short by default; the three end-to-end scripts get more room.
const budget = { "crossfit-aipw": 60, "survival-onestep": 50, capstone: 70 };
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
    assert.ok(lines.length <= (budget[n] || 40), `${n}: ${lines.length} code lines`);
    assert.ok(/set\.seed\(|^d <- data\.frame/m.test(code), `${n}: not seeded`);
    assert.ok(!/library\((?!survival|splines)/.test(code), `${n}: non-base package`);
  }
  const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  for (const n of names) assert.ok(readme.includes(n + ".R"), `README lists ${n}.R`);
});

test("every example opens with an accurate In practice block naming real package functions", () => {
  const known = [
    "tmle::tmle", "AIPW::AIPW", "lmtp::lmtp_tmle", "lmtp::lmtp_sdr", "lmtp::lmtp_contrast",
    "SuperLearner::SuperLearner", "sl3::Lrnr_sl", "WeightIt::weightit", "EValue::evalues.RR",
    "survtmle::survtmle", "RobinCar::robincar_linear", "RobinCar::robincar_glm", "survival::survfit",
    "survRM2::rmst2", "adjustedCurves::adjustedsurv", "adjustedCurves::adjusted_rmst", "cobalt::bal.tab",
  ];
  for (const n of names) {
    const { code } = drawer.parse(read(n));
    const lines = code.split("\n"),
      at = lines.findIndex((l) => l.startsWith("# In practice:"));
    assert.ok(at >= 0, `${n}: In practice block`);
    let end = at;
    while (end < lines.length && lines[end].startsWith("#")) end++;
    const head = lines.slice(at, end).join("\n");
    for (const m of head.matchAll(/\b([A-Za-z0-9]+)::([A-Za-z0-9_.]+)/g))
      assert.ok(known.includes(m[0]), `${n}: unlisted function ${m[0]} (check it exists, then add it here)`);
  }
});

test("four-patients reproduces the Four Patients page: Part 2 uses Part 1's patients", () => {
  const { output } = drawer.parse(read("four-patients"));
  for (const s of [
    "correction = 0.8125, one-step = 3.3125",
    "sum(H*r) = 3.25, sum(H^2) = 17.5625, eps = 0.1851",
    "TMLE = 2.9858, one-step = 3.3125",
    "SE = sd(D)/sqrt(4) = 0.5141",
  ])
    assert.ok(output.includes(s), s);
  // The same numbers from first principles.
  const H = [1.25, 0, 4, 0], r = [1, 0, 0.5, 0], g = [0.8, 0.8, 0.25, 0.25], m = [3, 3, 2, 2];
  const eps = H.reduce((s, h, i) => s + h * r[i], 0) / H.reduce((s, h) => s + h * h, 0);
  const tmle = m.reduce((s, v, i) => s + v + eps / g[i], 0) / 4;
  assert.equal(eps.toFixed(3), "0.185");
  assert.equal(tmle.toFixed(3), "2.986");
});

test("crossfit-aipw shows the too-small SE and undercoverage without cross-fitting", () => {
  const { output } = drawer.parse(read("crossfit-aipw"));
  const row = (label) => {
    const m = output.match(new RegExp(label + "\\s+mean est ([\\d.]+), SD of est ([\\d.]+), mean SE ([\\d.]+), coverage (\\d+)%"));
    assert.ok(m, label);
    return { sd: +m[2], se: +m[3], cover: +m[4] };
  };
  const off = row("no cross-fitting:"), on = row("2-fold cross-fit:");
  assert.ok(off.se < 0.7 * off.sd, "SE well below the real SD without cross-fitting");
  assert.ok(off.cover < 85, "undercoverage without cross-fitting");
  assert.ok(Math.abs(on.se - on.sd) < 0.15 * on.sd && on.cover >= 90, "honest with cross-fitting");
});

test("survival-onestep reports the lesson's exact truth and a converged TMLE", () => {
  const { output } = drawer.parse(read("survival-onestep"));
  assert.match(output, /^S1\s+[\d.]+\s+[\d.]+\s+[\d.]+/m);
  assert.match(output, /^dRMST\s/m);
  assert.match(output, /TMLE S1\(tau\) = [\d.]+, SE [\d.]+, after \d+ update/);
  assert.match(output, /\|mean augmentation\| < 1e-4 \* SE: TRUE/);
  // Truth column equals the exact truth of the lesson's world.
  const T = require("../science/targeted-survival.js");
  const truthS1 = +output.match(/^S1(?:\s+[\d.-]+){5}\s+([\d.]+)/m)[1];
  assert.equal(truthS1.toFixed(4), T.truth(1, T.weightsS(12)).toFixed(4));
  const truthR = +output.match(/^dRMST(?:\s+[\d.-]+){5}\s+([\d.]+)/m)[1];
  assert.equal(truthR.toFixed(4), (T.truth(1, T.weightsRMST(12)) - T.truth(0, T.weightsRMST(12))).toFixed(4));
});

test("capstone.R targets the lesson's truth", () => {
  const { output } = drawer.parse(read("capstone"));
  const C = require("../science/capstone.js");
  const D = require("../science/capstone-data.json");
  const t = +output.match(/truth \(Monte Carlo, 400,000 patients\): RD = (-?[\d.]+)/)[1];
  assert.ok(Math.abs(t - D.truth.rd) < 0.002, `R truth ${t} vs ${D.truth.rd}`);
  const m = output.match(/RD = (-?[\d.]+), SE ([\d.]+), 95% CI \((-?[\d.]+), (-?[\d.]+)\)/);
  assert.ok(+m[3] < D.truth.rd && D.truth.rd < +m[4], "R's interval covers the truth");
  const e = output.match(/RR = ([\d.]+) .*E-value ([\d.]+)/);
  assert.equal(C.eValue(+e[1]).toFixed(2), e[2]);
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
