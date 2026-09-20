const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((d) =>
      d.isDirectory() && d.name !== ".git"
        ? walk(path.join(dir, d.name))
        : d.isFile()
          ? [path.join(dir, d.name)]
          : [],
    );
}
test("all production JavaScript and inline lesson scripts parse", () => {
  for (const file of walk(root).filter(
    (p) => !p.includes("/docs/") && !p.includes("/tests/"),
  )) {
    const source = fs.readFileSync(file, "utf8");
    if (file.endsWith(".js")) new vm.Script(source, { filename: file });
    if (file.endsWith(".html"))
      for (const match of source.matchAll(
        /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g,
      ))
        new vm.Script(match[1], { filename: file });
  }
});
test("local page, stylesheet and script references resolve", () => {
  for (const file of walk(root).filter(
    (p) => p.endsWith(".html") && !p.includes("/docs/"),
  )) {
    const html = fs.readFileSync(file, "utf8");
    for (const [, url] of html.matchAll(
      /(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g,
    )) {
      if (/^[a-z]+:|^\/\//i.test(url)) continue;
      assert.ok(
        fs.existsSync(path.resolve(path.dirname(file), url)),
        `${file}: ${url}`,
      );
    }
  }
});
