(function () {
  const { COURSE, units, state } = Causality,
    root = document.getElementById("chapters"),
    labels = {
      new: "Ready to explore",
      explored: "Explored",
      attempted: "Attempted",
      assisted: "Assisted practice",
      demonstrated: "Transfer check demonstrated",
    };
  COURSE.chapters.forEach((chapter, i) => {
    const section = document.createElement("section"),
      h = document.createElement("h2");
    h.textContent = i + 1 + ". " + chapter.title;
    const p = document.createElement("p");
    p.textContent = chapter.description;
    const grid = document.createElement("div");
    grid.className = "hub-grid";
    chapter.units.forEach((u) => {
      const card = document.createElement("article");
      card.className = "unit-card";
      card.innerHTML = `<span class="status">${labels[state().units[u.id]?.status || "new"]}</span><h3><a href="lessons/${u.file}">${u.title}</a></h3><p>${u.blurb}</p>`;
      grid.append(card);
    });
    section.append(h, p, grid);
    root.append(section);
  });
  const recent = units
    .filter((u) => state().units[u.id]?.updated)
    .sort((a, b) =>
      state().units[b.id].updated.localeCompare(state().units[a.id].updated),
    )[0];
  if (recent)
    document.getElementById("resume").innerHTML =
      `Resume: <a href="lessons/${recent.file}">${recent.title}</a>. Your controls and practice answers are saved.`;
  const due = units.filter(
    (u) =>
      state().units[u.id]?.reviewAt &&
      Date.parse(state().units[u.id].reviewAt) < Date.now(),
  );
  document.getElementById("retrieval").innerHTML = due.length
    ? "Time to retrieve: " +
      due.map((u) => `<a href="lessons/${u.file}">${u.title}</a>`).join(", ") +
      ". Use New case before looking at the worked solution."
    : "After a successful transfer check, a retrieval reminder appears here in three days.";
  document.getElementById("reset").onclick = () => {
    Causality.reset();
    location.reload();
  };
})();
