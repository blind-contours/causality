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
  const numbered = units.map((u, i) => ({ ...u, n: i + 1 }));
  const stageName = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const label = {
    new: "Not started",
    part: "In progress",
    done: "Transfer shown",
    now: "Up next",
  };
  const detail = {
    new: "Not started",
    explored: "Explored",
    attempted: "Attempted",
    assisted: "Assisted practice",
    demonstrated: "Transfer shown",
  };

  function progress() {
    const s = state().units;
    // The frontier: first lesson not yet opened, or one with an unfinished transfer attempt.
    // An explored lesson (opened, or skipped via the diagnostic) does not hold the place.
    const holds = (st) =>
      !st || st === "new" || st === "attempted" || st === "assisted";
    const next =
      numbered.find((u) => holds(s[u.id]?.status)) ||
      numbered.find((u) => s[u.id]?.status !== "demonstrated") ||
      null;
    const status = (u) => {
      const st = s[u.id]?.status || "new";
      if (st === "demonstrated") return "done";
      if (next && u.id === next.id) return "now";
      return st === "new" ? "new" : "part";
    };
    const done = numbered.filter((u) => status(u) === "done").length;
    const left = numbered
      .filter((u) => status(u) !== "done")
      .reduce((a, u) => a + u.minutes, 0);
    const recent = numbered
      .filter((u) => s[u.id]?.updated)
      .sort((a, b) => s[b.id].updated.localeCompare(s[a.id].updated))[0];
    return { next, status, done, left, recent, s };
  }
  const hours = (m) => (m < 60 ? `${m} min` : `~${Math.round(m / 30) / 2} h`);

  function continueCard(p) {
    const el = document.getElementById("continue");
    const u = p.next;
    el.style.setProperty(
      "--stage",
      u ? `var(--s-${u.stage})` : "var(--s-interpretation)",
    );
    if (!u) {
      el.innerHTML = `<div class="k"><span class="eyebrow" style="color:var(--stage)">Course complete</span></div><h2>Every transfer check demonstrated</h2><p>Retrieval reminders will keep appearing here. Revisit any lesson from the map.</p>`;
      return;
    }
    const startedAny = p.done > 0 || !!p.recent;
    el.innerHTML = `<div class="k"><span class="eyebrow" style="color:var(--stage)">${startedAny ? "Up next" : "Start here"} · ${esc(u.chapter.title)}</span><span class="mono dim">${u.minutes} min</span></div>
      <h2>${esc(u.title)}</h2><p>${esc(u.blurb)}</p>
      <div class="prog"><span class="mono">${p.done} of ${numbered.length}</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${numbered.length}" aria-valuenow="${p.done}" aria-label="Lessons with a demonstrated transfer check"><i style="width:${(100 * p.done) / numbered.length}%"></i></div><span class="mono">${hours(p.left)} left</span></div>
      <div class="actions"><a class="go" href="lessons/${u.file}">${startedAny ? "Continue" : "Begin"} <span aria-hidden="true">→</span></a>${
        u.id === COURSE.diagnostic.unit
          ? '<a class="skip" href="#skip-ahead">Know identification already? Take the three-question check</a>'
          : p.recent && p.recent.id !== u.id
            ? `<a class="skip" href="lessons/${p.recent.file}">Last opened: ${esc(p.recent.short)}</a>`
            : ""
      }</div>`;
  }

  function pickCard(u, p) {
    const el = document.getElementById("pick");
    const st = p.status(u);
    el.style.setProperty("--stage", `var(--s-${u.stage})`);
    el.querySelector("h3").textContent = u.title;
    el.querySelector(".blurb").textContent = u.blurb;
    el.querySelector(".stage").textContent = stageName(u.stage);
    el.querySelector(".min").textContent = u.minutes + " min";
    el.querySelector(".status").textContent =
      detail[p.s[u.id]?.status || "new"];
    const go = el.querySelector(".go");
    go.href = "lessons/" + u.file;
    const raw = p.s[u.id]?.status || "new";
    go.textContent =
      raw === "new" ? "Open lesson" : st === "done" ? "Revisit" : "Continue";
  }

  function river(p) {
    const svg = document.getElementById("river");
    const draw = () =>
      CausalRiver.render(svg, {
        stages: COURSE.roadmap,
        units: numbered,
        status: p.status,
        label: (s) => label[s],
        href: (u) => "lessons/" + u.file,
        onSelect: (u) => pickCard(u, p),
        vertical: innerWidth < 720,
      });
    draw();
    let narrow = innerWidth < 720;
    addEventListener("resize", () => {
      if (innerWidth < 720 !== narrow) {
        narrow = innerWidth < 720;
        draw();
      }
    });
  }

  function itinerary(p) {
    const root = document.getElementById("chapters");
    root.replaceChildren();
    COURSE.chapters.forEach((c) => {
      const sec = document.createElement("section");
      sec.className = "chapter";
      sec.style.setProperty("--stage", `var(--s-${c.stage})`);
      const mins = c.units.reduce((a, u) => a + u.minutes, 0),
        done = c.units.filter((u) => p.status(u) === "done").length;
      sec.innerHTML = `<div class="chapter-h"><span class="stage">${esc(stageName(c.stage))}</span><h3>${esc(c.title)}</h3><span class="sum mono">${done}/${c.units.length} · ${mins} min</span></div>`;
      c.units.forEach((cu) => {
        const u = numbered.find((x) => x.id === cu.id),
          st = p.status(u);
        const a = document.createElement("a");
        a.className = "row";
        a.href = "lessons/" + u.file;
        a.innerHTML = `<span class="n">${String(u.n).padStart(2, "0")}</span><span class="t"><span>${esc(u.title)}</span><small>${esc(u.blurb)}</small></span><span class="m">${u.minutes} min</span><span class="chip ${st}">${label[st]}</span>`;
        a.addEventListener("mouseenter", () => pickCard(u, p));
        sec.append(a);
      });
      root.append(sec);
    });
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
        event({ type: "explore", unit: d.unit });
        out.className = "result ok";
        out.innerHTML = `All three correct. The roadmap lesson is marked explored, not demonstrated. <a href="lessons/${target.file}">Start at ${esc(target.title)} →</a>`;
        refresh();
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
  const titleEl = document.getElementById("itin-title");
  if (titleEl) {
    const w = words[units.length] || String(units.length);
    titleEl.textContent = `${w.charAt(0).toUpperCase() + w.slice(1)} lessons, one study carried through and one carried further`;
  }
  function refresh() {
    const p = progress();
    continueCard(p);
    river(p);
    itinerary(p);
    retrieval(p);
    pickCard(p.next || numbered[0], p);
  }
  refresh();
  diagnostic();
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
