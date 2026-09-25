/* Native Chrome DevTools smoke test. Start a local server and Chrome with --remote-debugging-port=9227. */
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  out = path.join(root, "docs/implementation/evidence");
fs.mkdirSync(out, { recursive: true });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const targets = await (
      await fetch(
        "http://127.0.0.1:" + (process.env.CDP_PORT || 9227) + "/json/list",
      )
    ).json(),
    ws = new WebSocket(
      targets.find((t) => t.type === "page").webSocketDebuggerUrl,
    );
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pending = new Map(),
    errors = [],
    failures = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(m.error) : p.resolve(m.result);
    } else if (m.method === "Runtime.exceptionThrown")
      errors.push(
        m.params.exceptionDetails.exception?.description ||
          m.params.exceptionDetails.text,
      );
  });
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expression) => {
    const r = await cdp("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw Error(
        r.exceptionDetails.exception?.description || r.exceptionDetails.text,
      );
    return r.result.value;
  };
  const assert = (ok, message) => {
    if (!ok) failures.push(message);
  };
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  const base = process.env.BASE_URL || "http://127.0.0.1:8765/";
  const nav = async (file) => {
    await cdp("Page.navigate", { url: base + file });
    await delay(180);
    await ev(
      "Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,800))]).then(()=>true)",
    );
  };
  const set = (id, value) =>
    ev(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(String(value))};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`,
    );
  const click = (selector) =>
    ev(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const shot = async (name) => {
    const r = await cdp("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(
      path.join(out, name + ".png"),
      Buffer.from(r.data, "base64"),
    );
  };
  const report = {
    browser: (await cdp("Browser.getVersion")).product,
    pages: [],
    checks: {},
  };
  await nav("index.html");
  await ev("Causality.reset()");
  await nav("index.html");
  assert(
    (await ev(`document.querySelectorAll('#river a.node').length`)) ===
      (await ev(`Causality.units.filter((u) => !u.elective).length`)),
    "river map does not show every core lesson",
  );
  assert(
    await ev(
      `document.querySelector('#continue .go').textContent.includes('Begin')`,
    ),
    "continue card does not offer a starting point on a fresh profile",
  );
  await ev(
    `for(const [i,v] of [[0,1],[1,1],[2,2]]) document.getElementById('skip-q'+i+'-'+v).checked=true;document.querySelector('#skip-ahead form').requestSubmit()`,
  );
  await delay(80);
  assert(
    (await ev(`Causality.state().units['causal-roadmap']?.status`)) ===
      "explored" &&
      (await ev(`document.querySelector('#skip-ahead .result').className`)) ===
        "result ok",
    "diagnostic did not mark the roadmap lesson explored",
  );
  assert(
    (await ev(`document.querySelector('#river a.node.now').dataset.unit`)) ===
      "scores-from-scratch" &&
      (await ev(`Causality.state().units['causal-roadmap'].status`)) !==
        "demonstrated",
    "after the diagnostic, the map should point at the first geometry lesson without claiming demonstration",
  );
  await ev("Causality.reset()");
  const files = [
    "index.html",
    "glossary.html",
    ...fs
      .readdirSync(path.join(root, "lessons"))
      .filter((f) => f.endsWith(".html"))
      .map((f) => "lessons/" + f),
  ];
  for (const [width, theme] of [
    [1440, "light"],
    [390, "light"],
    [390, "dark"],
  ]) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width,
      height: 950,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const file of files) {
      errors.length = 0;
      await nav(file);
      await ev(
        `Causality.event({type:'settings',value:{theme:${JSON.stringify(theme)},mode:'explore'}});document.documentElement.dataset.theme=${JSON.stringify(theme)};document.body.dataset.mode='explore';window.dispatchEvent(new Event('causality:settings'))`,
      );
      await delay(40);
      const info = await ev(
        `({file:${JSON.stringify(file)},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,unlabelled:[...document.querySelectorAll('input,select,textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).map(e=>e.id||e.className),canvases:[...document.querySelectorAll('canvas')].map(c=>{const vp=c.closest('.figure-viewport');return {id:c.id,name:c.getAttribute('aria-label'),displayWidth:c.getBoundingClientRect().width,nativeWidth:+c.dataset.w||c.width,fits:!vp||vp.scrollWidth<=vp.clientWidth+1}}),lessonStatus:document.querySelector('.course-status')?.textContent})`,
      );
      info.theme = theme;
      info.errors = [...errors];
      report.pages.push(info);
      assert(!errors.length, file + ": " + errors.join("; "));
      assert(
        info.scrollWidth <= width + 1,
        file + ` overflow at ${width}: ${info.scrollWidth}`,
      );
      assert(
        !info.unlabelled.length,
        file + ": unlabelled controls " + info.unlabelled.join(","),
      );
      assert(
        info.canvases.every((c) => c.name),
        file + ": canvas name absent",
      );
      assert(
        info.canvases.every((c) =>
          width >= 1000
            ? c.fits && c.displayWidth >= c.nativeWidth * 0.9
            : c.displayWidth >= c.nativeWidth * 0.8,
        ),
        file +
          ` figures at ${width}: ` +
          info.canvases
            .filter(
              (c) =>
                !(width >= 1000
                  ? c.fits && c.displayWidth >= c.nativeWidth * 0.9
                  : c.displayWidth >= c.nativeWidth * 0.8),
            )
            .map(
              (c) =>
                `${c.id} ${Math.round(c.displayWidth)}/${c.nativeWidth}${c.fits ? "" : " overflows"}`,
            )
            .join(", "),
      );
      if (file === "index.html" && width === 1440) await shot("course-map");
    }
  }
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await nav("lessons/10-canonical-gradient.html");
  await ev(
    `Causality.event({type:'settings',value:{mode:'explore',theme:'light'}});document.body.dataset.mode='explore';document.documentElement.dataset.theme='light';window.dispatchEvent(new Event('causality:settings'))`,
  );
  await click("#reference-example");
  report.checks.projection = await ev(
    `document.getElementById('projection-values').textContent`,
  );
  assert(
    report.checks.projection.includes("1.24") &&
      report.checks.projection.includes("1.08"),
    "canonical projection numbers",
  );
  const before = await ev(
    `document.getElementById('projection-values').textContent`,
  );
  await set("yaw", 1.2);
  assert(
    before ===
      (await ev(`document.getElementById('projection-values').textContent`)),
    "camera changed scientific state",
  );
  await set("view", "scores");
  await ev(
    `document.getElementById('geometry').scrollIntoView({block:'center'})`,
  );
  await shot("canonical-gradient");
  await set("mass", 0.12);
  await nav("lessons/10-canonical-gradient.html");
  assert(
    (await ev(`document.getElementById('mass').value`)) === "0.12",
    "lab configuration persistence",
  );
  await ev(
    `document.getElementById('restricted').checked=false;document.getElementById('restricted').dispatchEvent(new Event('input',{bubbles:true}))`,
  );
  await set("direction", "nuisance");
  await set("epsilon", 0.05);
  report.checks.nuisance = await ev(
    `document.getElementById('path-identity').textContent`,
  );
  assert(
    report.checks.nuisance.includes("slope = 0"),
    "nuisance direction changes mean",
  );
  await nav("lessons/05-one-move-two-faces.html");
  await set("pi1", 0.05);
  await set("e1", 0.4);
  report.checks.tilt = await ev(`document.getElementById('ro1').innerText`);
  assert(
    (report.checks.tilt.match(/9\.000/g) || []).length === 2,
    "tilt boundary numerical mean is not 9",
  );
  await nav("lessons/08-four-patients.html");
  await click("#show1");
  await click("#show2");
  await click("#chk1");
  report.checks.revealed = await ev(`Causality.state().units['four-patients']`);
  assert(
    report.checks.revealed.exercises["table-1"].assisted &&
      report.checks.revealed.exercises["table-2"].assisted,
    "revealed solutions not marked assisted",
  );
  assert(
    report.checks.revealed.status !== "demonstrated",
    "revealed solutions marked demonstrated",
  );
  await click("#new1");
  await ev(
    `document.querySelector('#t1 input').value='1.25';document.querySelector('#t1 input').dispatchEvent(new Event('input',{bubbles:true}))`,
  );
  const caseText = await ev(`document.querySelector('#t1b').textContent`);
  await nav("lessons/08-four-patients.html");
  assert(
    (await ev(`document.querySelector('#t1 input').value`)) === "1.25",
    "worked answer persistence",
  );
  assert(
    caseText === (await ev(`document.querySelector('#t1b').textContent`)),
    "worked case changed on reload",
  );
  await nav("lessons/02-scores-from-scratch.html");
  await ev(
    `Causality.markDone('scores-from-scratch',false);document.querySelector('.course-foot').scrollIntoView()`,
  );
  await delay(100);
  assert(
    !(await ev(`Causality.isDone('scores-from-scratch')`)),
    "scroll or reset marks lesson complete",
  );
  await ev(
    `localStorage.setItem('causality.progress.v1',JSON.stringify({'scores-from-scratch':'old'}));localStorage.removeItem('causality.progress.v2')`,
  );
  await nav("lessons/02-scores-from-scratch.html");
  assert(
    (await ev(`Causality.state().units['scores-from-scratch'].status`)) ===
      "explored",
    "legacy completion migration",
  );
  await nav("lessons/11-inference-lab.html");
  await set("alpha", 0.25);
  await set("beta", 0.25);
  report.checks.rates = await ev(
    `document.getElementById('rate-status').textContent`,
  );
  assert(
    report.checks.rates.includes("stays at 1"),
    "quarter-rate equality incorrectly vanishes",
  );
  await ev(
    `const sim=document.querySelector('[data-simulation]');for(const [key,value]of [['mode','oracle'],['n',100],['reps',20]]){const e=sim.querySelector('[data-key='+key+']');e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}sim.querySelector('.run').click()`,
  );
  for (let i = 0; i < 100; i++) {
    if (await ev(`!document.querySelector('.download').disabled`)) break;
    await delay(100);
  }
  report.checks.simulation = await ev(
    `document.querySelector('.sim-status').textContent`,
  );
  assert(
    report.checks.simulation.startsWith("Finished"),
    "worker simulation did not finish",
  );
  report.checks.histogram = await ev(
    `document.querySelector('.hist-table').innerText`,
  );
  assert(
    report.checks.histogram.includes("total per estimator = 20"),
    "histogram total missing",
  );
  await ev(
    `Causality.event({type:'settings',value:{mode:'explore'}});document.body.dataset.mode='explore';window.dispatchEvent(new Event('causality:settings'));document.querySelector('.sim-results').scrollIntoView({block:'center'})`,
  );
  await shot("simulation-results");
  await ev(
    `for(const [key,value]of [['n',2000],['reps',2000]]){const e=document.querySelector('[data-key='+key+']');e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('.run').click();document.querySelector('.cancel').click()`,
  );
  assert(
    await ev(
      `document.querySelector('.sim-status').textContent.includes('cancelled')`,
    ),
    "worker cancellation",
  );
  await nav("lessons/12-survival-lab.html");
  await set("censoring", 4);
  await set("horizon", 10);
  report.checks.survival = await ev(
    `document.getElementById('support-status').textContent`,
  );
  assert(
    report.checks.survival.includes("nobody observed"),
    "censoring support warning absent at extreme",
  );
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await ev(
    `Causality.event({type:'settings',value:{mode:'explore'}});document.body.dataset.mode='explore';window.dispatchEvent(new Event('causality:settings'));document.getElementById('survival-plot').scrollIntoView({block:'start'})`,
  );
  await shot("survival-mobile");
  // Exercise the guided route, deep links, keyboard camera and a real animation clock.
  await nav("lessons/10-canonical-gradient.html");
  await ev(
    `Causality.event({type:'settings',value:{mode:'guided'}});document.body.dataset.mode='guided';window.dispatchEvent(new Event('causality:settings'));location.hash='step-4'`,
  );
  await delay(80);
  assert(
    await ev(
      `document.querySelectorAll('.lab-step:not([hidden])').length===1 && !document.getElementById('step-4').hidden`,
    ),
    "guided deep link did not select its step",
  );
  await set("view", "plane");
  assert(
    (await ev(`document.getElementById('view').value`)) === "plane",
    "2D view unavailable",
  );
  const beforeKeyboard = await ev(
    `document.getElementById('projection-values').textContent`,
  );
  await set("view", "scores");
  const oldYaw = await ev(`+document.getElementById('yaw').value`);
  await ev(`document.getElementById('geometry').focus()`);
  await cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  await cdp("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "ArrowRight",
    code: "ArrowRight",
    windowsVirtualKeyCode: 39,
  });
  assert(
    (await ev(`+document.getElementById('yaw').value`)) > oldYaw,
    "keyboard camera did not turn",
  );
  assert(
    beforeKeyboard ===
      (await ev(`document.getElementById('projection-values').textContent`)),
    "keyboard camera changed the mathematics",
  );
  await set("guess0", -1.7);
  await nav("lessons/10-canonical-gradient.html");
  assert(
    (await ev(`document.getElementById('guess0').value`)) === "-1.7",
    "partial construction was not saved",
  );
  const sharedHash = new URLSearchParams({
    lab: JSON.stringify({
      version: 1,
      name: "geometry",
      state: { mass: 0.18, middle: 0.4, step: 3, view: "plane" },
    }),
  }).toString();
  await nav("index.html");
  await nav("lessons/10-canonical-gradient.html#" + sharedHash);
  assert(
    (await ev(`document.getElementById('mass').value`)) === "0.18" &&
      (await ev(`document.getElementById('view').value`)) === "plane",
    "shared laboratory configuration failed to load on a fresh visit",
  );
  const pastedHash = new URLSearchParams({
    lab: JSON.stringify({
      version: 1,
      name: "geometry",
      state: { mass: 0.22, view: "simplex" },
    }),
  }).toString();
  await ev(`location.hash=${JSON.stringify(pastedHash)}`);
  await delay(60);
  assert(
    (await ev(`document.getElementById('mass').value`)) === "0.22" &&
      (await ev(`document.getElementById('view').value`)) === "simplex",
    "shared laboratory configuration failed to load on the open page",
  );
  await nav("lessons/03-mean-along-a-path.html");
  assert(
    await ev(
      `document.querySelectorAll('.legacy-step:not([hidden])').length===1`,
    ),
    "legacy guided topics do not segment the lesson",
  );
  // Scene 1 is in the visible first topic and has a scrub slider (t1).
  await ev(`document.getElementById('c1').scrollIntoView({block:'center'})`);
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  await ev(
    `document.getElementById('t1').value='0';document.getElementById('t1').dispatchEvent(new Event('input',{bubbles:true}))`,
  );
  await click("#p1");
  await delay(250);
  await click("#p1");
  const paused = await ev(`document.getElementById('t1').value`);
  await delay(200);
  assert(
    paused === (await ev(`document.getElementById('t1').value`)) &&
      +paused > 0 &&
      +paused < 1,
    "play/pause clock did not pause mid-scene: t=" + paused,
  );
  await cdp("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await click("#p1");
  assert(
    (await ev(`document.getElementById('t1').value`)) === "1",
    "reduced-motion playback did not reveal the final state",
  );
  await ev(
    `document.querySelector('#c1').closest('.paper').querySelector('details').open=true`,
  );
  await delay(80);
  assert(
    await ev(
      `document.querySelector('#c1').closest('.paper').querySelector('.figure-transcript li')!==null`,
    ),
    "figure transcript is empty",
  );
  await click(".step-nav button:nth-child(2)");
  assert(
    await ev(`!document.querySelectorAll('.legacy-step')[1].hidden`),
    "legacy topic navigation failed",
  );
  // Registered figures mount and draw; the projection step animates the perpendicular.
  await nav("lessons/02-scores-from-scratch.html");
  assert(
    await ev(
      `document.querySelectorAll('[data-figure=influence] svg.fig').length===2 && !document.querySelector('[data-figure=influence]').textContent.includes('could not be drawn')`,
    ),
    "influence figure did not mount",
  );
  await nav("lessons/10-canonical-gradient.html");
  await ev(
    `Causality.event({type:'settings',value:{mode:'explore'}});document.body.dataset.mode='explore';window.dispatchEvent(new Event('causality:settings'));document.getElementById('restricted').checked=true;document.getElementById('restricted').dispatchEvent(new Event('input',{bubbles:true}))`,
  );
  await delay(120);
  assert(
    (
      await ev(`document.getElementById('projection-caption').textContent`)
    ).includes("E[(D*)²]"),
    "projection figure caption missing after restriction",
  );
  for (const [file, sel] of [
    ["lessons/00-causal-roadmap.html", "#line-fig, #worlds-fig"],
    [
      "lessons/11-inference-lab.html",
      "[data-figure=dr-plane] svg.fig, [data-figure=crossfit] svg.fig",
    ],
    ["lessons/12-survival-lab.html", "#km-figure svg, #hr-figure svg"],
    ["lessons/06-two-strata.html", "[data-figure=budget-plane] svg.fig"],
    ["lessons/08-four-patients.html", "#fig1 svg, #fig2 svg"],
  ]) {
    await nav(file);
    assert(
      (await ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`)) >=
        1 &&
        !(await ev(
          `[...document.querySelectorAll('[data-figure]')].some(m=>m.textContent.includes('could not be drawn'))`,
        )),
      file + ": new figures did not mount (" + sel + ")",
    );
  }
  // Figure settings round-trip through the laboratory store: Share carries them, Reset clears them.
  await nav("lessons/11-inference-lab.html");
  await ev(
    `Causality.event({type:'settings',value:{mode:'explore'}});document.body.dataset.mode='explore';window.dispatchEvent(new Event('causality:settings'))`,
  );
  await ev(
    `(()=>{const s=document.querySelector('[data-figure=dr-plane] select');s.value='g';s.dispatchEvent(new Event('change',{bubbles:true}));const p=document.querySelector('[data-figure=dr-plane] .fig-player input');p.value=1;p.dispatchEvent(new Event('input',{bubbles:true}));const l=document.querySelector('[data-figure=crossfit] select');l.value='linear';l.dispatchEvent(new Event('change',{bubbles:true}));return 1})()`,
  );
  await delay(100);
  const saved = await ev(`localStorage.getItem('causality.lab.inference')`);
  assert(
    saved.includes('"exact":"g"') &&
      saved.includes('"n":100000') &&
      saved.includes('"learner":"linear"'),
    "inference figure settings did not reach the laboratory store: " + saved,
  );
  // The simulation panel has its own Reset; the laboratory's is the last one on the page.
  await ev(`[...document.querySelectorAll('.reset-lab')].pop().click()`);
  await delay(100);
  assert(
    (await ev(
      `document.querySelector('[data-figure=dr-plane] select').value`,
    )) === "none" &&
      (await ev(
        `+document.querySelector('[data-figure=dr-plane] .fig-player input').value`,
      )) === 0 &&
      (await ev(
        `document.querySelector('[data-figure=crossfit] select').value`,
      )) === "memorise",
    "laboratory Reset did not reset the figure settings and clocks",
  );
  // The estimand explorer keeps populations, contrasts, saved questions, and figure state linked.
  await nav("lessons/00-causal-roadmap.html");
  await click(".reset-lab");
  await click("#estimand-example");
  await set("target", "att");
  assert((await ev(`document.getElementById('estimand-mean-value').textContent`)).includes("3.4"), "ATT should be 3.4 in the worked example");
  await set("target", "atc");
  assert((await ev(`document.getElementById('estimand-mean-value').textContent`)).includes("1.4"), "ATC should be 1.4 in the worked example");
  await click("#estimand-equal");
  assert(await ev(`CausalEstimands.means(JSON.parse(localStorage.getItem('causality.lab.roadmap'))).effects.att === 1`), "Equal benefits did not remove population differences");
  await click("#risk-common");
  await set("risk-contrast", "rr");
  assert((await ev(`document.getElementById('estimand-risk-value').textContent`)).includes("0.5"), "Common-event risk ratio should be 0.5");
  await click("#risk-rare");
  assert((await ev(`document.getElementById('estimand-risk-value').textContent`)).includes("0.5"), "Rare-event risk ratio should remain 0.5");
  await set("risk-contrast", "rd");
  assert((await ev(`document.getElementById('estimand-risk-value').textContent`)).startsWith("-1 percentage"), "Rare-event RD should be -1 percentage point");
  await set("risk-low", 0); await set("risk-high", 0); await set("risk-contrast", "rr");
  assert(await ev(`document.getElementById('estimand-risk-value').textContent.includes('undefined') && document.getElementById('save-risk-contract').disabled`), "Zero control risk should make the ratio undefined and unsavable");
  await set("estimand-delay", 3); await set("estimand-horizon", 2); await set("estimand-survival-contrast", "rmst");
  assert((await ev(`document.getElementById('estimand-survival-value').textContent`)).startsWith("0 years"), "An effect starting at year 3 cannot change RMST through year 2");
  await set("estimand-horizon", 6);
  await click("#save-survival-contract");
  const savedQuestion = await ev(`Causality.state().contract`);
  assert(savedQuestion.target === "atc" && savedQuestion.measure === "rmst" && savedQuestion.horizon === 6, "Saved question lost its population, contrast, or horizon");
  await nav("lessons/10-canonical-gradient.html");
  const reminder = await ev(`document.querySelector('.contract-reminder').textContent`);
  assert(reminder.includes("actually received control") && reminder.includes("within 6 years"), "Saved ATC/RMST question did not carry to the geometry lesson");
  await nav("lessons/00-causal-roadmap.html");
  await click(".reset-lab");
  await click("#estimand-restore");
  assert(await ev(`document.getElementById('target').value==='atc' && +document.getElementById('estimand-delay').value===3 && +document.getElementById('estimand-horizon').value===6`), "Restoring a question did not restore its example settings");
  const sharedQuestion = await ev(`new URLSearchParams({lab:JSON.stringify({version:1,name:'roadmap',state:JSON.parse(localStorage.getItem('causality.lab.roadmap'))})}).toString()`);
  await click(".reset-lab");
  await nav("lessons/00-causal-roadmap.html#" + sharedQuestion);
  assert(await ev(`document.getElementById('target').value==='atc' && +document.getElementById('estimand-horizon').value===6`), "Shared estimand configuration did not restore the scene");
  await ev(`Causality.event({type:'settings',value:{mode:'guided'}});document.body.dataset.mode='guided';window.dispatchEvent(new Event('causality:settings'));location.hash='estimand-risk'`);
  await delay(60);
  assert(await ev(`[...document.querySelectorAll('.lab-step')].filter(p=>!p.hidden).length===1 && !document.getElementById('estimand-risk').hidden`), "Risk deep link did not select its guided step");
  await ev(`location.hash='estimand-survival'`); await delay(60);
  await ev(`document.getElementById('estimand-survival-figure').scrollIntoView({block:'center'})`);
  await set("estimand-horizon", 4);
  await click("#estimand-time-player button:nth-child(2)");
  assert(await ev(`+document.getElementById('estimand-horizon').value===5 && document.querySelector('#estimand-time-player .v').textContent==='5 years'`), "The time player should step in physical years");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await click("#estimand-time-player button:first-child"); await delay(250);
  const runningTime = await ev(`+document.getElementById('estimand-horizon').value`);
  await click("#estimand-time-player button:first-child");
  const pausedTime = await ev(`+document.getElementById('estimand-horizon').value`);
  await delay(120);
  assert(runningTime > 5 && (await ev(`+document.getElementById('estimand-horizon').value`)) === pausedTime, "The horizon must advance during playback and stop on pause");
  await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await click("#estimand-time-player button:first-child");
  assert((await ev(`+document.getElementById('estimand-horizon').value`)) === 10, "Reduced-motion Play should jump to the final horizon");
  await click(".reset-lab");
  assert(await ev(`+document.getElementById('estimand-horizon').value===5 && document.querySelector('#estimand-time-player .v').textContent==='5 years' && document.getElementById('target').value==='ate'`), "Reset did not restore the estimand controls and clock");
  assert(await ev(`+document.getElementById('effect-low').value===1.86 && +document.getElementById('effect-high').value===2.26`), "Effect slider precision must preserve the reference cohort values");
  await click(".practice .new-case");
  assert((await ev(`document.querySelector('.practice .question').textContent`)).includes("ATT"), "The estimand transfer bank should include a changed-population problem");
  await ev(`document.querySelector('.practice .answer').value='4.8'`); await click(".practice .check");
  assert((await ev(`document.querySelector('.practice .feedback').textContent`)).startsWith("Correct"), "ATT transfer answer was not accepted");
  report.checks.estimands = "Population weights, equal effects, absolute/relative risks, zero-risk guard, delayed survival, saved/restored/shared questions, guided deep links, playback, reduced motion, reset, and transfer passed.";
  report.checks.interaction =
    "Guided and legacy navigation, deep links, shared configurations, partial construction, keyboard camera, pause/resume and reduced motion passed.";
  assert(
    !errors.length,
    "Runtime exception during interaction checks: " + errors.join("; "),
  );
  report.failures = failures;
  fs.writeFileSync(
    path.join(out, "browser.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      { pages: report.pages.length, failures, checks: report.checks },
      null,
      2,
    ),
  );
  ws.close();
  if (failures.length) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
