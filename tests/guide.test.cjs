/* The tour and the teacher's guide point into the lessons. These checks keep those pointers honest:
 * every unit and file exists in the curriculum, every deep link lands on a real step or element,
 * the guide covers every core lesson once, and the new pages contain no em dashes. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

global.window = global.window || {};
require(path.join(root, "shared/curriculum.js"));
const C = window.CausalCurriculum;
const guide = require(path.join(root, "guide/lessons.js"));

const units = {};
for (const ch of C.chapters)
  for (const u of ch.units) units[u.id] = Object.assign({ elective: !!ch.elective }, u);
const core = Object.values(units).filter((u) => !u.elective);
const byFile = Object.fromEntries(Object.values(units).map((u) => [u.file, u]));

/* Every id a deep link can land on, for one lesson file:
 * - ids written in the lesson HTML or in the lab/figure scripts it loads (id="..." in either);
 * - "step-N" for the N-th lab step (labs/common.js assigns it when a step has no id of its own);
 * - "<unit>-topic-K" for the K-th h2 section of a lesson without a lab (shared/course.js). */
function anchorsFor(file) {
  const html = read("lessons/" + file);
  const scripts = [...html.matchAll(/<script[^>]*src="\.\.\/((?:labs|figures)\/[^"]+\.js)"/g)].map(
    (m) => m[1],
  );
  const sources = [html, ...scripts.map(read)];
  const ids = new Set();
  for (const s of sources) for (const m of s.matchAll(/\bid=\\?"([^"\\$]+)\\?"/g)) ids.add(m[1]);
  const isLab = /data-lab="/.test(html);
  const unit = byFile[file];
  if (isLab) {
    const steps = scripts
      .filter((s) => s.startsWith("labs/"))
      .reduce((n, s) => n + (read(s).match(/class=\\?"lab-step\\?"/g) || []).length, 0);
    for (let i = 1; i <= steps; i++) ids.add("step-" + i);
  } else {
    const body = html.slice(html.indexOf("<body"));
    const h2 = (body.match(/<h2[\s>]/g) || []).length;
    for (let k = 0; k < h2; k++) ids.add(unit.id + "-topic-" + k);
  }
  return ids;
}

/* Links of the form lessons/<file>#<anchor> in the tour, with the unit its card names. */
const tour = read("tour.html");
const tourStops = [...tour.matchAll(/<li class="stop"([^>]*)>([\s\S]*?)<\/li>/g)].map((m) => {
  const attr = m[1],
    body = m[2];
  const link = body.match(/href="lessons\/([^"#]+)#([^"]+)"/);
  return {
    unit: attr.match(/data-unit="([^"]+)"/)?.[1],
    minutes: Number(attr.match(/data-minutes="([^"]+)"/)?.[1]),
    file: link?.[1],
    anchor: link?.[2],
  };
});

test("tour: 8 to 10 stops, 2 to 6 minutes each, about 45 minutes in all", () => {
  assert.ok(tourStops.length >= 8 && tourStops.length <= 10, `${tourStops.length} stops`);
  for (const s of tourStops) assert.ok(s.minutes >= 2 && s.minutes <= 6, JSON.stringify(s));
  assert.equal(
    tourStops.reduce((t, s) => t + s.minutes, 0),
    45,
  );
});

test("tour: every stop names a curriculum unit and links into that unit's lesson file", () => {
  for (const s of tourStops) {
    assert.ok(units[s.unit], `unknown unit ${s.unit}`);
    assert.equal(s.file, units[s.unit].file, `${s.unit} links to ${s.file}`);
    assert.ok(fs.existsSync(path.join(root, "lessons", s.file)), s.file);
  }
});

test("tour: stops follow the course order, from the question to survival", () => {
  const order = core.map((u) => u.id);
  const pos = tourStops.map((s) => order.indexOf(s.unit));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] >= pos[i - 1], tourStops[i].unit);
  assert.equal(tourStops[0].unit, order[0]);
  assert.equal(tourStops.at(-1).unit, order.at(-1));
});

test("tour: every deep-link anchor exists in its lesson or lab source", () => {
  for (const s of tourStops)
    assert.ok(anchorsFor(s.file).has(s.anchor), `${s.file}#${s.anchor}`);
  for (const [, file, anchor] of tour.matchAll(/href="lessons\/([^"#]+)#([^"]+)"/g))
    assert.ok(anchorsFor(file).has(anchor), `${file}#${anchor}`);
});

test("tour: links back to the start of the course and to the map", () => {
  assert.match(tour, /Want the full course\? Start at the beginning/);
  assert.match(tour, new RegExp(`href="lessons/${core[0].file}"`));
  assert.match(tour, /href="index\.html"/);
});

test("guide: one entry per core lesson, each a curriculum unit with a lesson file", () => {
  const ids = guide.lessons.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate guide entries");
  assert.deepEqual([...ids].sort(), core.map((u) => u.id).sort());
  for (const id of ids) assert.ok(fs.existsSync(path.join(root, "lessons", units[id].file)), id);
});

test("guide: every key-figure anchor exists in its lesson or lab source", () => {
  for (const l of guide.lessons) {
    const file = units[l.id].file;
    assert.ok(anchorsFor(file).has(l.figure.anchor), `${l.id}: ${file}#${l.figure.anchor}`);
  }
});

test("guide: named data-figure mounts exist in figures/ and are used by that lesson", () => {
  for (const l of guide.lessons) {
    if (!/^[a-z-]+$/.test(l.figure.name)) continue;
    const file = units[l.id].file;
    const html = read("lessons/" + file);
    const scripts = [...html.matchAll(/src="\.\.\/((?:labs|figures)\/[^"]+\.js)"/g)].map((m) => read(m[1]));
    const used = [html, ...scripts].some((s) => s.includes(`data-figure="${l.figure.name}"`) || s.includes(`data-figure=\\"${l.figure.name}\\"`));
    assert.ok(used, `${l.id} does not mount ${l.figure.name}`);
  }
});

test("guide: each lesson has 2 to 3 goals, discussion questions, 2 misconceptions, an activity and readings", () => {
  for (const l of guide.lessons) {
    assert.ok(l.goals.length >= 2 && l.goals.length <= 3, `${l.id} goals`);
    assert.ok(l.discuss.length >= 2 && l.discuss.length <= 3, `${l.id} discussion`);
    assert.equal(l.misconceptions.length, 2, `${l.id} misconceptions`);
    assert.ok(l.figure.ask.length >= 1, `${l.id} ask`);
    assert.ok(l.activity.length > 40, `${l.id} activity`);
    assert.ok(l.readings.length > 0 || l.readingsNote, `${l.id} readings`);
    for (const r of l.readings) if (r.href) assert.match(r.href, /^https:\/\//, `${l.id}: ${r.href}`);
  }
});

test("guide: R scripts named in the guide exist in examples/r", () => {
  for (const l of guide.lessons)
    if (l.r) assert.ok(fs.existsSync(path.join(root, "examples/r", l.r.file)), `${l.id}: ${l.r.file}`);
});

test("guide: schedules use curriculum units and cover every core lesson exactly once, in order", () => {
  const order = core.map((u) => u.id);
  for (const s of guide.schedules) {
    const seq = s.sessions.flatMap((x) => x.units);
    for (const id of seq) assert.ok(units[id], `${s.id}: unknown unit ${id}`);
    assert.deepEqual(seq, order, s.id);
    const weeks = s.sessions.map((x) => x.week);
    for (let i = 1; i < weeks.length; i++) assert.ok(weeks[i] >= weeks[i - 1], `${s.id} week order`);
  }
  assert.equal(guide.schedules.find((s) => s.id === "three-weeks").sessions.length, 9);
  assert.equal(Math.max(...guide.schedules.find((s) => s.id === "six-weeks").sessions.map((x) => x.week)), 6);
});

test("guide: the elective lists the curriculum's elective units", () => {
  const electives = Object.values(units).filter((u) => u.elective).map((u) => u.id);
  assert.deepEqual(guide.elective.units, electives);
});

test("guide page loads the curriculum and the guide data, and has a print stylesheet", () => {
  const html = read("guide/index.html");
  assert.match(html, /src="\.\.\/shared\/curriculum\.js"/);
  assert.match(html, /src="lessons\.js"/);
  const css = read("guide/guide.css");
  assert.match(css, /@media print/);
  assert.match(css, /\.g-lesson\s*\{[^}]*break-before:\s*page/);
  for (const f of ["LICENSE", "LICENSE-CONTENT.md"]) {
    assert.ok(fs.existsSync(path.join(root, f)), f);
    assert.ok(html.includes(`../${f}`), `guide links ${f}`);
  }
});

test("no em dashes in the tour, the guide or this test", () => {
  for (const f of ["tour.html", "guide/index.html", "guide/guide.css", "guide/lessons.js", "tests/guide.test.cjs"])
    assert.ok(!read(f).includes(String.fromCharCode(0x2014)), `${f} contains an em dash`);
});
