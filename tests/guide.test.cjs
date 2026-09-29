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
  // "#fig-<name>" lands on a <div data-figure="name"> (CausalBeats.find in shared/course.js).
  for (const s of sources) for (const m of s.matchAll(/data-figure=\\?"([a-z0-9-]+)\\?"/g)) ids.add("fig-" + m[1]);
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
  for (const id of ids) {
    assert.ok(units[id] && !units[id].elective, `${id} is not a core curriculum unit`);
    assert.ok(fs.existsSync(path.join(root, "lessons", units[id].file)), id);
  }
});

test("guide: every unit in the curriculum has an entry (core lessons, electives, or a pending note)", () => {
  const covered = new Set([...guide.lessons.map((l) => l.id), ...guide.elective.units]);
  for (const u of Object.values(units)) {
    if (covered.has(u.id)) continue;
    // A lesson registered before its guide notes exist must be listed in `pending` with a note;
    // the page then shows a placeholder card for it (see the TODO in guide/lessons.js).
    assert.ok(typeof guide.pending[u.id] === "string" && guide.pending[u.id].length > 20, `no guide entry for ${u.id}`);
  }
  for (const id of Object.keys(guide.pending))
    assert.ok(!guide.lessons.some((l) => l.id === id), `${id} is both pending and written`);
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

test("guide: each lesson has goals, a key figure, readings and a slide-free outline of 5 to 7 moves", () => {
  for (const l of guide.lessons) {
    assert.ok(l.goals.length >= 2 && l.goals.length <= 3, `${l.id} goals`);
    assert.ok(l.figure.ask.length >= 1, `${l.id} ask`);
    assert.ok(l.readings.length > 0 || l.readingsNote, `${l.id} readings`);
    for (const r of l.readings) if (r.href) assert.match(r.href, /^https:\/\//, `${l.id}: ${r.href}`);
    assert.ok(l.outline.length >= 5 && l.outline.length <= 7, `${l.id} outline has ${l.outline.length} moves`);
    for (const o of l.outline) for (const k of ["at", "show", "ask"]) assert.ok(o[k] && o[k].length > 3, `${l.id} outline ${k}`);
  }
});

test("guide: three discussion questions per lesson, each with an answer key", () => {
  for (const l of guide.lessons) {
    assert.equal(l.discuss.length, 3, `${l.id} discussion`);
    for (const d of l.discuss) {
      assert.ok(d.q.length > 40, `${l.id}: question too short`);
      assert.ok(d.a.length > 60, `${l.id}: answer key missing or too short for “${d.q.slice(0, 40)}”`);
    }
  }
});

test("guide: one in-class activity per lesson, 10 to 20 minutes, with materials, steps, what to collect and what good work looks like", () => {
  const formats = new Set();
  for (const l of guide.lessons) {
    const a = l.activity;
    assert.ok(a && typeof a === "object", `${l.id} activity`);
    assert.ok(a.minutes >= 10 && a.minutes <= 20, `${l.id} minutes`);
    for (const k of ["title", "format", "groups", "collect", "good"]) assert.ok(a[k] && a[k].length > 3, `${l.id} activity ${k}`);
    assert.ok(a.materials.length >= 1, `${l.id} materials`);
    assert.ok(a.steps.length >= 3 && a.steps.length <= 6, `${l.id} steps`);
    formats.add(a.format.split(" ")[0]);
    // An R exercise must name a script that exists in examples/r.
    if (/\bR exercise\b/.test(a.format)) {
      const m = a.materials.join(" ").match(/examples\/r\/([\w-]+\.R)/);
      assert.ok(m && fs.existsSync(path.join(root, "examples/r", m[1])), `${l.id}: R exercise names no existing script`);
    }
  }
  assert.ok(formats.size >= 5, `only ${formats.size} activity formats: ${[...formats]}`);
});

/* Text a learner can see in a lesson: its HTML and the lab or figure scripts it loads, both raw (step
 * names live in data-title attributes) and with tags removed (headings can contain markup). */
function lessonText(file) {
  const html = read("lessons/" + file);
  const scripts = [...html.matchAll(/src="\.\.\/((?:labs|figures)\/[^"]+\.js)"/g)].map((m) => read(m[1]));
  const raw = [html, ...scripts].join(" ").replace(/&amp;/g, "&");
  return raw + " " + raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

test("guide: misconceptions name the lesson step that addresses them, and cite a source or say where they come from", () => {
  for (const l of guide.lessons) {
    assert.ok(l.misconceptions.length >= 2 && l.misconceptions.length <= 3, `${l.id} misconceptions`);
    const text = lessonText(units[l.id].file);
    for (const m of l.misconceptions) {
      assert.ok(m.myth && m.fix, `${l.id} myth/fix`);
      // "Scene 5, “The parameter along the path”" names scene 5 by its quoted title.
      const step = (m.where.match(/“([^”]+)”/) || [, m.where])[1];
      assert.ok(text.includes(step), `${l.id}: step “${step}” not found in the lesson`);
      if (m.source) {
        assert.ok(m.source.t.length > 10, `${l.id} source title`);
        if (m.source.href) assert.match(m.source.href, /^https:\/\//, `${l.id}: ${m.source.href}`);
      }
    }
  }
  const html = read("guide/index.html");
  assert.match(html, /Misconceptions students often bring/);
  assert.match(html, /teaching\s+experience and from the literature, not from measured data/);
});

test("guide: six assessment questions spanning the course, each with an answer key", () => {
  assert.equal(guide.assessment.length, 6);
  const chapterOf = {};
  for (const ch of C.chapters) for (const u of ch.units) chapterOf[u.id] = ch.id;
  const covered = new Set();
  for (const x of guide.assessment) {
    assert.ok(x.q.length > 80 && x.a.length > 80, "assessment question or answer too short");
    for (const id of x.covers) {
      assert.ok(units[id], `assessment covers unknown unit ${id}`);
      covered.add(chapterOf[id]);
    }
  }
  const chapters = new Set(C.chapters.filter((ch) => !ch.elective).map((ch) => ch.id));
  for (const ch of chapters) assert.ok(covered.has(ch), `assessment skips the ${ch} chapter`);
});

test("guide page: answer keys are collapsible and print only when the answers switch is on", () => {
  const html = read("guide/index.html");
  assert.match(html, /<details class="g-key"><summary>Answer key<\/summary>/);
  assert.match(html, /id="g-with-answers"/);
  assert.match(html, /id="assessment"/);
  assert.match(html, /id="start"/);
  assert.match(html, /placement/);
  assert.match(html, /tour\.html/);
  const css = read("guide/guide.css");
  const print = css.slice(css.indexOf("@media print"));
  assert.match(print, /body:not\(\.g-with-answers\) \.g-key\s*\{\s*display:\s*none/);
});

test("guide: R scripts named in the guide exist in examples/r", () => {
  for (const l of guide.lessons)
    if (l.r) assert.ok(fs.existsSync(path.join(root, "examples/r", l.r.file)), `${l.id}: ${l.r.file}`);
});

test("guide: schedules use curriculum units and cover every core lesson exactly once, in order", () => {
  for (const s of guide.schedules) {
    const seq = s.sessions.flatMap((x) => x.units);
    // A pending lesson (see guide.pending) may be absent from a schedule until its notes are written.
    const order = core.map((u) => u.id).filter((id) => !(id in guide.pending) || seq.includes(id));
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
