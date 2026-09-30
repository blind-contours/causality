/* Course map page: continue card, river, itinerary and the skip-ahead diagnostic. */
(function () {
  const { COURSE, units, state, event } = Causality,
    esc = (s) =>
      String(s).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  // Core lessons are numbered 1..n; electives are numbered E1, E2, ... and sit outside the main route.
  let coreN = 0,
    electiveN = 0;
  const numbered = units.map((u) => ({
    ...u,
    n: u.elective ? "E" + ++electiveN : ++coreN,
  }));
  const core = numbered.filter((u) => !u.elective);
  const stageName = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const label = {
    new: "Not started",
    part: "In progress",
    done: "Transfer shown",
    now: "Up next",
    skim: "Skimmed",
  };
  // The placement quiz's saved result (shared/placement.js). Only results that name their
  // start unit (the current quiz) are honoured.
  const PLACEMENT_KEY = "causality.placement.v1";
  function placement() {
    try {
      const v = JSON.parse(localStorage.getItem(PLACEMENT_KEY) || "null");
      return v && v.version === 1 && core.some((u) => u.id === v.unit) ? v : null;
    } catch {
      return null;
    }
  }
  function progress() {
    const s = state().units;
    // The frontier: first lesson not yet opened, or one with an unfinished transfer attempt.
    // An explored lesson (opened, or skimmed) does not hold the place. After the placement quiz,
    // the search starts at the recommended lesson, so the card and the river point there until
    // it is opened, and then move on from there rather than back to lesson 1.
    const holds = (st) =>
      !st || st === "new" || st === "attempted" || st === "assisted";
    const placed = placement(),
      from = placed ? core.findIndex((u) => u.id === placed.unit) : -1;
    const next =
      (from >= 0 && core.slice(from).find((u) => holds(s[u.id]?.status))) ||
      core.find((u) => holds(s[u.id]?.status)) ||
      core.find((u) => s[u.id]?.status !== "demonstrated") ||
      null;
    const status = (u) => {
      const st = s[u.id]?.status || "new";
      if (st === "demonstrated") return "done";
      if (next && u.id === next.id) return "now";
      if (st === "new") return "new";
      // Marked by the placement quiz or the quick check, never opened.
      return s[u.id]?.skimmed ? "skim" : "part";
    };
    const { walked, passed } = CausalState.counts(
      s,
      core.map((u) => u.id),
    );
    const done = passed;
    const left = core
      .filter((u) => status(u) !== "done")
      .reduce((a, u) => a + u.minutes, 0);
    // Last opened: a real visit only. Skimmed lessons carry no timestamp.
    const recent = numbered
      .filter((u) => CausalState.opened(s[u.id]) && s[u.id].updated)
      .sort((a, b) => s[b.id].updated.localeCompare(s[a.id].updated))[0];
    // The placement leads while its lesson has not been opened.
    const fromPlacement =
      !!placed && !!next && next.id === placed.unit && !CausalState.opened(s[next.id]);
    return { next, status, done, walked, passed, left, recent, s, fromPlacement };
  }
  const tally = (p) =>
    `${p.walked} walked · ${p.passed} check${p.passed === 1 ? "" : "s"} passed of ${core.length}`;
  const hours = (m) => (m < 60 ? `${m} min` : `~${Math.round(m / 30) / 2} h`);

  function continueCard(p) {
    const el = document.getElementById("continue");
    const u = p.next;
    el.style.setProperty(
      "--stage",
      u ? `var(--s-${u.stage})` : "var(--s-interpretation)",
    );
    if (!u) {
      el.innerHTML = `<div class="k"><span class="eyebrow" style="color:var(--stage)">Course complete</span></div><h2>Every transfer check demonstrated</h2><p>Retrieval reminders will keep appearing here. Revisit any lesson from the route below.</p>`;
      return;
    }
    const startedAny = p.walked > 0 || p.passed > 0;
    const eyebrow = p.fromPlacement
      ? "Your starting point"
      : startedAny
        ? "Up next"
        : "Start here";
    const verb = p.fromPlacement ? "Start here" : startedAny ? "Continue" : "Begin";
    const side = p.fromPlacement
      ? '<a class="skip" href="#placement">From your placement answers · change</a>'
      : u.id === COURSE.diagnostic.unit && !startedAny
        ? '<a class="skip" href="#placement">Know some of this already? Find your starting point</a>'
        : p.recent && p.recent.id !== u.id
          ? `<a class="skip" href="lessons/${p.recent.file}">Last opened: ${esc(p.recent.short)}</a>`
          : "";
    // Two honest numbers: lessons walked through (opened) and transfer checks passed.
    el.innerHTML = `<div class="k"><span class="eyebrow" style="color:var(--stage)">${eyebrow} · ${esc(u.chapter.title)}</span><span class="mono dim">${u.minutes} min</span></div>
      <h2>${esc(u.title)}</h2><p>${esc(u.blurb)}</p>
      <div class="prog"><span class="mono prog-n">${tally(p)}</span><span class="prog-row"><span class="bar" role="img" aria-label="${p.walked} of ${core.length} core lessons walked through; ${p.passed} transfer checks passed"><i class="walk" style="width:${(100 * p.walked) / core.length}%"></i><i class="pass" style="width:${(100 * p.passed) / core.length}%"></i></span><span class="mono">${hours(p.left)} left</span></span></div>
      <div class="actions"><a class="go" href="lessons/${u.file}">${verb} <span aria-hidden="true">→</span></a>${side}</div>`;
  }

  function river(p) {
    const svg = document.getElementById("river");
    // The river flows in once, on arrival; later in-place refreshes redraw without replaying it.
    if (svg.childElementCount) svg.classList.add("settled");
    const draw = () =>
      CausalRiver.render(svg, {
        stages: COURSE.roadmap,
        units: core,
        status: p.status,
        label: (s) => label[s],
        href: (u) => "lessons/" + u.file,
        // On wide screens the river is a picture of progress; the path list below does the
        // navigating. Hovering a node highlights its row. Phones hide the river (CSS).
        onSelect: (u) => {
          document
            .querySelectorAll(".lesson.hl")
            .forEach((e) => e.classList.remove("hl"));
          document
            .querySelector(`.lesson[data-unit="${u.id}"]`)
            ?.classList.add("hl");
        },
        vertical: false,
      });
    draw();
  }

  // The route: one vertical path, grouped by roadmap stage. The stage carrying the next lesson is
  // open; on phones the other stages collapse to one line each.
  function itinerary(p) {
    const root = document.getElementById("chapters");
    const wide = matchMedia("(min-width: 880px)").matches;
    const openIds = new Set(
      [...root.querySelectorAll("details[open]")].map((d) => d.dataset.chapter),
    );
    const first = !root.childElementCount;
    root.replaceChildren();
    COURSE.chapters.forEach((c) => {
      const li = document.createElement("li");
      li.className = "stage-group" + (c.elective ? " elective" : "");
      li.style.setProperty("--stage", `var(--s-${c.stage})`);
      const mins = c.units.reduce((a, u) => a + u.minutes, 0),
        done = c.units.filter((u) => p.status(u) === "done").length,
        hasNext = c.units.some((u) => p.next && u.id === p.next.id);
      if (hasNext) li.classList.add("current");
      const det = document.createElement("details");
      det.dataset.chapter = c.id;
      det.open = first ? (c.elective ? false : wide || hasNext) : openIds.has(c.id);
      det.innerHTML = `<summary class="stage-h"><span class="dot" aria-hidden="true"></span><span class="stage-text"><span class="stage-tag">${c.elective ? "Elective" : esc(stageName(c.stage))}</span><span class="stage-title">${esc(c.title.replace(/^Elective:\s*/, ""))}</span></span><span class="sum mono">${done}/${c.units.length} · ${hours(mins)}</span></summary>`;
      const ol = document.createElement("ol");
      ol.className = "lessons";
      c.units.forEach((cu) => {
        const u = numbered.find((x) => x.id === cu.id),
          st = p.status(u);
        const item = document.createElement("li");
        item.innerHTML = `<a class="lesson ${st}" data-unit="${u.id}" href="lessons/${u.file}"><span class="node" aria-hidden="true"></span><span class="n mono">${String(u.n).padStart(2, "0")}</span><span class="t"><b>${esc(u.title)}</b><small>${esc(u.blurb)}</small><span class="meta"><span class="mono">${u.minutes} min</span>${st === "new" ? "" : `<span class="chip ${st}">${label[st]}</span>`}</span></span></a>`;
        ol.append(item);
      });
      det.append(ol);
      li.append(det);
      root.append(li);
    });
  }

  // Phones: once someone has started, keep a slim Continue bar at the bottom of the screen
  // whenever the Continue card itself is out of view.
  function resumeBar(p) {
    const bar = document.getElementById("resume-bar"),
      u = p.next,
      started = p.walked > 0 || p.passed > 0 || p.fromPlacement;
    if (!bar) return;
    bar.dataset.on = u && started ? "1" : "";
    if (!(u && started)) {
      bar.hidden = true;
      return;
    }
    bar.href = "lessons/" + u.file;
    bar.style.setProperty("--stage", `var(--s-${u.stage})`);
    bar.innerHTML = `<span class="rb-k mono">Continue · ${String(u.n).padStart(2, "0")}</span><span class="rb-t">${esc(u.short)}</span><span class="rb-m mono">${u.minutes} min →</span>`;
  }
  let resumeWatch = false;
  function watchResume() {
    if (resumeWatch || !("IntersectionObserver" in window)) return;
    resumeWatch = true;
    const bar = document.getElementById("resume-bar");
    new IntersectionObserver((e) => {
      bar.hidden = e[0].isIntersecting || !bar.dataset.on;
    }).observe(document.getElementById("continue"));
  }

  function retrieval(p) {
    const due = numbered.filter(
      (u) => p.s[u.id]?.reviewAt && Date.parse(p.s[u.id].reviewAt) < Date.now(),
    );
    const el = document.getElementById("retrieval");
    el.hidden = !due.length;
    if (due.length)
      el.innerHTML =
        "<strong>Time to retrieve:</strong> " +
        due
          .map((u) => `<a href="lessons/${u.file}">${esc(u.title)}</a>`)
          .join(", ") +
        ". Use New case before looking at the worked solution.";
  }

  function diagnostic() {
    const d = COURSE.diagnostic,
      root = document.getElementById("skip-ahead"),
      form = root.querySelector("form"),
      out = root.querySelector(".result");
    form.innerHTML =
      d.questions
        .map(
          (q, i) =>
            `<fieldset><legend>${i + 1}. ${esc(q.q)}</legend>${q.options
              .map(
                (o, k) =>
                  `<label><input type="radio" name="q${i}" value="${k}" id="skip-q${i}-${k}"> ${esc(o)}</label>`,
              )
              .join("")}</fieldset>`,
        )
        .join("") +
      '<button type="submit" class="go">Check my answers</button>';
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const wrong = d.questions
        .map((q, i) => (Number(data.get("q" + i)) === q.answer ? null : i + 1))
        .filter(Boolean);
      const target = units.find((u) => u.id === d.next),
        lesson = units.find((u) => u.id === d.unit);
      if (!wrong.length) {
        // A skim: explored, but not a visit and not a passed check.
        event({ type: "explore", unit: d.unit, skim: true });
        out.className = "result ok";
        out.innerHTML = `All three correct. The first lesson is marked skimmed, not passed. <a href="lessons/${target.file}">Start at ${esc(target.title)} →</a>`;
      } else {
        out.className = "result no";
        out.innerHTML = `Question${wrong.length > 1 ? "s" : ""} ${wrong.join(", ")} missed. <a href="lessons/${lesson.file}">${esc(lesson.title)}</a> covers exactly this, in about ${lesson.minutes} minutes.`;
      }
    });
  }

  const words = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
  ];
  const titleEl = document.getElementById("route-sub");
  if (titleEl) {
    const w = words[core.length] || String(core.length);
    const mins = core.reduce((a, u) => a + u.minutes, 0);
    titleEl.textContent = `${w.charAt(0).toUpperCase() + w.slice(1)} core lessons, about ${Math.round(mins / 30) / 2} hours. One recurring cohort of 100 patients ties it together, with clearly marked teaching worlds when a new idea needs a different setting. Every lesson opens directly; prerequisites are advice, not gates.`;
  }
  // The route heading carries the same two numbers as the card, once there is something to count.
  function routeProgress(p) {
    const sub = document.getElementById("route-sub");
    if (!sub) return;
    let line = document.getElementById("route-prog");
    if (!line) {
      line = document.createElement("p");
      line.id = "route-prog";
      line.className = "route-prog mono";
      sub.after(line);
    }
    line.hidden = !(p.walked || p.passed);
    line.textContent = tally(p);
  }
  function refresh() {
    const p = progress();
    continueCard(p);
    routeProgress(p);
    river(p);
    itinerary(p);
    retrieval(p);
    resumeBar(p);
    watchResume();
  }
  refresh();
  diagnostic();
  // Refresh in place whenever progress or the placement changes (this tab or another one).
  let queued = false;
  const soon = () => {
    if (queued) return;
    queued = true;
    // A microtask batches a burst of events (skimming marks many lessons at once).
    queueMicrotask(() => {
      queued = false;
      refresh();
    });
  };
  Causality.subscribe(soon);
  window.addEventListener("causality:placement", soon);
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === PLACEMENT_KEY) soon();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest('a[href="#skip-ahead"]'))
      document.getElementById("skip-ahead").open = true;
  });
  // The shared settings panel belongs with the footer on this page. course.js creates it on
  // DOMContentLoaded; its listener was registered first, so this one runs after it.
  document.addEventListener("DOMContentLoaded", () => {
    const settings = document.querySelector(".course-settings");
    if (settings) document.getElementById("settings-slot").append(settings);
  });
  document.getElementById("reset").onclick = () => {
    Causality.reset();
    location.reload();
  };
})();
