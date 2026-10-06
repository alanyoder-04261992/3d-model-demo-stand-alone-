/* CHECK: the parts gallery (parts.html) and the contact sheet (setup.html)
   draw what they promise, in a real browser.
   Run: node tools/check-gallery.mjs [--quiet]        (check-all: browser)

   WHY. Alan asked for "a 3D model of each part of a shed" -- the gallery is
   where each part can be seen on its own -- and for new companies to be
   "fast to set up": the contact sheet is the page he screenshots or prints
   for a new company to sign off every building, size and price.

   WHAT IT PROVES:
   THE PARTS GALLERY
   1. For the demo company's default building, the gallery shows exactly the
      parts that building has (worked out here in Node from the building's
      own triangles, framing included), each with a picture that is not blank
      and not the same as any other part's, its building step(s), a caption
      with every {placeholder} filled, and a link to its skill that the
      server really serves; every other part a building can have is listed
      as "not on this building", and the LESSON parts (see 2) are listed
      apart, "only in a lesson", each a link to the lesson page that draws
      it, a page the server really serves. The whole page uses ONE 3D
      drawing surface (one WebGL context), not one per picture.
   2. Picking each of the demo's styles in the style list, with "Show the
      optional parts too" ticked, draws every part of that building, none
      blank -- and across the styles EVERY part a building can have (every
      part in parts/, the doors and windows one by one) has been drawn on its
      own at least once.
      The LESSON parts are the exception, by design. They are construction
      details Alan taught in his lessons (today: the window header and the
      window plate, the doorway framing, the utility top window plate, the
      gable backing and the gable window box), marked `lesson` in their
      modules (parts/README.md). Each applies only to a plan its lesson page
      builds (a windowHeaderStudy, a doorwayStudy, a trussStudy ...), never
      to a building the designer offers -- CLAUDE.md rule 5 keeps the
      customer designer apart from the lessons -- so the gallery can never
      draw one. For them the check proves instead that none was drawn on any
      of the styles, and that each one DOES draw on its own (assemble
      { only }, the gallery's own filter) from the plan its lesson page
      builds with the learning company's example numbers (LESSON_PLANS
      below), and nothing of it on that same building without the lesson.
      A part marked `lesson` that a building draws, or that has no lesson
      plan here, fails. Their measurements are proved by their own checks:
      check-window-header, check-window-plate, check-doorway,
      check-utility-framing, check-gable-backing and check-gable-window.
   3. A company whose stud spacing is 24 in reads "24 in on centre" on the
      wall-framing card.
   THE CONTACT SHEET
   4. For the starter company: one tile for every style and size its
      settings offer, in its category order; every picture drawn and not
      blank; every price is the price the designer shows for that building
      when a customer picks that style and size (ui/state.js chooseType +
      chooseSize, priced by model/pricing.js priceParts); the standard doors
      and windows are named; a 14 ft wide tile carries the company's note for
      that width. One WebGL context.
   5. For the demo company (161 buildings) every price is the designer's
      (some of them are above the size's base price, which the starter
      company's are not), and the pictures are drawn only as they come near
      the screen: at first only some are drawn, and scrolling to the bottom
      draws the last one. Printing hides the buttons.
   BOTH
   6. A company name with HTML in it is shown as text and runs nothing; an
      unknown company says so in plain words; no console errors otherwise.
   7. The gallery's cards come in the order the shop puts the building
      together (the company's build order), as the page says; and on the
      hosted website -- which does not serve the skills folder -- each skill
      name is shown as text rather than as a link that goes nowhere.
   It saves test/out/gallery-demo.png, gallery-cabin-extras.png and
   contact-sheet-starter.png. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadCatalogue } from "./lib/load.mjs";
import { defaults, normalize } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { pSizes, priceParts, money } from "../model/pricing.js";
import { assemble } from "../engine/assemble.js";
import * as S from "../ui/state.js";
import { STAGES } from "../parts/stages.js";
import { PIPELINE } from "../parts/index.js";
import { partCatalogue } from "../ui/part-details.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { trussStudyPlan } from "../model/truss-study.js";
import { windowHeaderStudyPlan } from "../model/window-header-study.js";
import { windowPlateStudyPlan } from "../model/window-plate-study.js";
import { doorwayStudyPlan } from "../model/doorway-study.js";
import { utilityWallStudyPlan, utilityWindowStudyPlan } from "../model/utility-study.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const PORT = 8353, BASE = "http://127.0.0.1:" + PORT;
const QUIET = process.argv.includes("--quiet");
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; if (!QUIET) console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 900) : "")); }
  return !!cond;
}
function section(t) { console.log("\n" + t); }

const DEMO = loadCatalogue("demo"), STARTER = loadCatalogue("starter");
const DEMO_FILE = JSON.parse(readFileSync(resolve(ROOT, "companies/demo/company.json"), "utf8"));
const STARTER_FILE = JSON.parse(readFileSync(resolve(ROOT, "companies/starter/company.json"), "utf8"));

/* every part label a triangle can carry (the PIPELINE's own list) */
const ALL_LABELS = [];
for (const en of PIPELINE) for (const t of en.tags) if (ALL_LABELS.indexOf(t) < 0) ALL_LABELS.push(t);

/* the LESSON parts (label -> the lesson page that draws it: a part module
   with `lesson`, parts/README.md), and the rest, the parts a building can have */
const LESSONS = partCatalogue().lessons;
const LESSON_LABELS = ALL_LABELS.filter((l) => LESSONS[l]);
const BUILDING_LABELS = ALL_LABELS.filter((l) => !LESSONS[l]);

/* How each lesson page builds the plan its lesson part needs, with the
   learning company's example numbers: the same calls as the page's own
   script (named on each line). A new lesson part needs its line here. */
const LEARN = loadCatalogue("learning-side-loft"), LC = LEARN.construction;
const LEARN_PLAN = makePlan(defaults(LEARN), LEARN);
const endWall = () => wallStudyPlan(floorStudyPlan(LEARN_PLAN), { wall: "end" });
const loftHeader = () => windowHeaderStudyPlan(endWall(), { lengthIn: LC.windowHeader.exampleLengthIn });
const trussLesson = (windowOpening) => trussStudyPlan(gableStudyPlan(endWall(), { gable: true }), { truss: true, windowOpening });
const LESSON_PLANS = {
  "window-header": loftHeader,                                                       /* window-framing.html: ui/learn-window-header.js */
  "window-plate": () => windowPlateStudyPlan(loftHeader(), { lengthIn: LC.windowHeader.exampleLengthIn, clearHeightIn: LC.windowPlateLesson.exampleClearHeightIn }),   /* the same page */
  "doorway-frame": () => doorwayStudyPlan(endWall(), { widthIn: LC.doorwayLesson.exampleWidthIn, kingCutIn: LC.doorwayLesson.exampleKingCutIn, headerMode: "loft" }),   /* ui/learn-doorway.js */
  "utility-window-frame": () => utilityWindowStudyPlan(utilityWallStudyPlan(LEARN_PLAN), { lengthIn: LC.utilityStudy.examplePlateCutIn }),   /* ui/learn-utility.js */
  "gable-backing": () => trussLesson(null),                                          /* learn.html?step=truss, no gable window: ui/learn-wall.js */
  "gable-window-frame": () => trussLesson({ kind: "window", widthIn: LC.trussStudy.windowExample.widthIn, heightIn: LC.trussStudy.windowExample.heightIn, centerIn: 0, bottomIn: null }),   /* &window=1: ui/learn-gable-window.js */
};

/* triangles per part label in a drawing */
function trianglesOf(build) {
  const out = new Map();
  for (const k of build.ORDER) for (const sg of build.tags[k] || []) if (sg.count > 0) out.set(sg.part, (out.get(sg.part) || 0) + sg.count);
  return out;
}

/* the part labels a building really has: every label with triangles, read
   straight from the drawing's tags */
function labelsOf(state, cat) {
  const r = assemble(makePlan(state, cat), { viewport: { w: 320, h: 240 }, fit: "fitref", frames: true });
  const out = new Set();
  for (const k of r.build.ORDER) for (const sg of r.build.tags[k] || []) if (sg.count > 0) out.add(sg.part);
  return out;
}

/* the building steps each part label's triangles are on (the 9th number of
   every triangle), for the order the shop puts the parts together */
function stagesByLabel(state, cat) {
  const r = assemble(makePlan(state, cat), { viewport: { w: 320, h: 240 }, fit: "fitref", frames: true });
  const out = new Map();
  for (const k of r.build.ORDER) {
    const b = r.build.buckets[k];
    for (const sg of r.build.tags[k] || []) for (let t = sg.from; t < sg.from + sg.count; t++) {
      if (!out.has(sg.part)) out.set(sg.part, new Set());
      out.get(sg.part).add(STAGES[b.v[t * 27 + 8]].key);
    }
  }
  return out;
}

/* ---------------- server and browser ---------------- */
const servers = [];
async function serve() {
  const url = BASE + "/parts.html";
  const answers = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await answers()) return;
  const child = spawn("npx", ["http-server", ROOT, "-p", String(PORT), "-s", "-c-1", "-a", "127.0.0.1"], { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve the repo on port " + PORT);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const LAUNCH = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

/* counts the 3D drawing surfaces a page makes */
const COUNT_GL = `(() => {
  const orig = HTMLCanvasElement.prototype.getContext, seen = new WeakSet();
  window.__glCanvases = 0;
  HTMLCanvasElement.prototype.getContext = function (t, o) {
    const c = orig.call(this, t, o);
    if (c && /webgl/i.test(t) && !seen.has(this)) { seen.add(this); window.__glCanvases++; }
    return c;
  };
})();`;

async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1200, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  await ctx.addInitScript(COUNT_GL);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  for (const [id, body] of Object.entries(o.companies || {})) {
    await ctx.route(new RegExp("/companies/" + id + "/company\\.json"), (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }));
  }
  return ctx;
}
async function openPage(ctx, path, ready) {
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") noise.push({ type: t, text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  await page.goto(BASE + "/" + path, { waitUntil: "load" });
  await page.waitForFunction(ready, null, { timeout: 180000 });
  return { page, noise };
}
const realNoise = (noise) => noise.filter((m) => (m.type === "error" || m.type === "pageerror") && !/fonts\.(googleapis|gstatic)\.com/.test(m.text + " " + (m.url || "")));
const galleryReady = () => window.partsGallery && window.partsGallery.ready && document.body.getAttribute("data-ready") === "1";

/* how much of each picture is drawn: part pictures are see-through PNGs
   (count what is not see-through); contact-sheet pictures are JPEGs on the
   haze colour (count what differs from the corner) */
async function imageStats(page, selector) {
  return page.evaluate(async (selector) => {
    const out = [];
    for (const img of document.querySelectorAll(selector)) {
      const host = img.closest("[data-part],[data-size]");
      const key = host ? (host.getAttribute("data-part") || host.getAttribute("data-style") + " " + host.getAttribute("data-size")) : "?";
      if (!img.getAttribute("src")) { out.push({ key, src: false }); continue; }
      if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; });
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext("2d"); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const bg = [d[0], d[1], d[2]];
      let solid = 0, differs = 0; const cols = new Set();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 16) { solid++; if ((i >> 2) % 7 === 0) cols.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4)); }
        if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 30) differs++;
      }
      const n = c.width * c.height;
      let h = 0x811c9dc5; const s = img.src; for (let i = 0; i < s.length; i += 7) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
      out.push({ key, src: true, w: c.width, h: c.height, solid: solid / n, differs: differs / n, colours: cols.size, hash: h });
    }
    return out;
  }, selector);
}
const blankPart = (s) => !s.src || s.solid < 0.002;          /* a flat wall can be one colour; blank means nothing drawn */
const blankTile = (s) => !s.src || s.differs < 0.03 || s.colours < 8;

console.log("check-gallery: the parts gallery and the contact sheet, in a real browser\n");
mkdirSync(OUT, { recursive: true });

let browser;
try {
  await serve();
  browser = await chromium.launch(LAUNCH);

  /* ================================================================ 1 */
  section("1. The parts gallery, the demo company's default building");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "parts.html?company=demo", galleryReady);
    const st = defaults(DEMO); normalize(st, null, DEMO);
    const want = labelsOf(st, DEMO);
    const g = await page.evaluate(() => ({
      cards: Array.from(document.querySelectorAll(".pg-card")).map((c) => ({
        part: c.getAttribute("data-part"), title: c.querySelector("h3").textContent,
        stages: Array.from(c.querySelectorAll(".pg-stage")).map((s) => s.textContent),
        text: Array.from(c.querySelectorAll(".pg-real")).map((p) => p.textContent).join(" "),
        skills: Array.from(c.querySelectorAll(".pg-skill a")).map((a) => ({ text: a.textContent, href: a.getAttribute("href") })),
      })),
      off: document.getElementById("pg-off").textContent, building: document.getElementById("pg-building").textContent,
      gl: window.__glCanvases, style: document.getElementById("pg-style").value, size: document.getElementById("pg-size").value,
      offList: window.partsGallery.off.slice(), lessons: window.partsGallery.lessons.map((x) => ({ label: x.label, page: x.page })),
      lessonLinks: Array.from(document.querySelectorAll("#pg-off a.pg-lesson")).map((a) => ({ text: a.textContent, href: a.getAttribute("href") })),
    }));
    const got = g.cards.map((c) => c.part);
    /* the page says "in the order the shop puts them together": each part at
       its earliest step in the company's build order, parts on no step of it
       (the finished floor slab) last, the rest in the parts list's own order */
    const order = makePlan(st, DEMO).construction.buildOrder, sbl = stagesByLabel(st, DEMO);
    const firstStep = (l) => Math.min(...[...(sbl.get(l) || [])].map((k) => order.indexOf(k)).filter((i) => i >= 0), Infinity);
    const wantOrder = ALL_LABELS.filter((l) => want.has(l)).sort((a, b) => (firstStep(a) - firstStep(b)) || (ALL_LABELS.indexOf(a) - ALL_LABELS.indexOf(b)));
    ok(`the cards come in the order the shop puts the building together (${got.slice(0, 5).join(", ")}, ...)`, J(got) === J(wantOrder), J({ got, want: wantOrder }));
    ok(`the gallery shows the ${DEMO.TYPES[st.type].name} ${st.size} (the company's default building)`, g.style === st.type && g.size === st.size, J({ style: g.style, size: g.size }));
    ok(`it has one card for each of the ${want.size} parts this building really has (framing included), no more, no fewer`, got.length === want.size && got.every((p) => want.has(p)), J({ got, want: [...want] }));
    const stats = await imageStats(page, ".pg-card img");
    const blank = stats.filter(blankPart).map((s) => s.key);
    ok(`every one of the ${stats.length} pictures is drawn and not blank`, stats.length === got.length && blank.length === 0, "blank: " + blank.join(", "));
    ok("every picture is different (each part is drawn on its own)", new Set(stats.map((s) => s.hash)).size === stats.length);
    const stageNames = new Set(STAGES.map((s) => s.name));
    const badCap = g.cards.filter((c) => !c.title || !c.stages.length || !c.stages.every((n) => stageNames.has(n)) || c.text.trim().length < 30 || /[{}]/.test(c.text)).map((c) => c.part);
    ok("every card has its name, its building step(s) and a real-life caption with every {placeholder} filled", badCap.length === 0, badCap.join(", "));
    const wf = g.cards.find((c) => c.part === "wall-frame");
    ok(`the wall-framing card reads the company's numbers ("${wf && wf.text.slice(0, 60)}...")`, !!wf && wf.text.indexOf(`${DEMO.construction.walls.stud} studs at ${DEMO.construction.walls.spacingIn} in on centre`) >= 0);
    const links = [];
    for (const c of g.cards) for (const s of c.skills) links.push(s);
    const linkBad = [];
    for (const l of links) {
      const m = /^\.claude\/skills\/(part-[a-z0-9-]+)\/SKILL\.md$/.exec(l.href || "");
      if (!m || m[1] !== l.text) { linkBad.push(l.href + " (" + l.text + ")"); continue; }
      const r = await fetch(BASE + "/" + l.href);
      if (!r.ok || !/^---/.test(await r.text())) linkBad.push(l.href + " -> " + r.status);
    }
    ok(`every card names its skill, and all ${links.length} skill links open the skill file`, links.length >= got.length && g.cards.every((c) => c.skills.length > 0) && linkBad.length === 0, linkBad.join(", "));
    const offLabels = BUILDING_LABELS.filter((l) => !want.has(l));
    ok(`the parts this building does not have are listed as "not on this building" (${offLabels.length} labels)`,
      J(g.offList) === J(offLabels) && (offLabels.length === 0 || /Not on this building/.test(g.off)), J({ got: g.offList, want: offLabels }));
    /* the lesson parts: listed apart, each a link to the lesson page that draws it */
    const lessonWant = LESSON_LABELS.filter((l) => !want.has(l)).map((l) => ({ label: l, page: LESSONS[l] }));
    const lessonBad = [];
    for (const x of lessonWant) {
      const name = partCatalogue().byLabel[x.label][0].name;
      if (!g.lessonLinks.some((a) => a.href === x.page && a.text === name)) { lessonBad.push(`${x.label}: no link "${name}" to ${x.page}`); continue; }
      const r = await fetch(BASE + "/" + x.page);
      if (!r.ok) lessonBad.push(`${x.page} -> ${r.status}`);
    }
    ok(`the ${lessonWant.length} parts learned in a lesson are listed apart, "only in a lesson", each a link to the lesson page that draws it (${[...new Set(lessonWant.map((x) => x.page))].join(", ")}), and the server serves every one`,
      J(g.lessons) === J(lessonWant) && g.lessonLinks.length === lessonWant.length && (lessonWant.length === 0 || /Only in a lesson/.test(g.off)) && lessonBad.length === 0,
      lessonBad.join("; ") || J({ got: g.lessons, want: lessonWant }));
    ok(`the whole page used ONE 3D drawing surface for all ${stats.length} pictures`, g.gl === 1, "WebGL canvases: " + g.gl);
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await page.screenshot({ path: resolve(OUT, "gallery-demo.png"), fullPage: true });
    await ctx.close();
  }

  /* ================================================================ 2 */
  section("2. Every style, with the optional parts: every part of the shed drawn on its own");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "parts.html?company=demo&extras=1", galleryReady);
    const drawnLabels = new Set();
    const problems = [];
    let pictures = 0;
    for (const t of Object.keys(DEMO.TYPES)) {
      const cur = await page.evaluate(() => document.getElementById("pg-style").value);
      if (cur !== t) {
        await page.selectOption("#pg-style", t);
        await page.waitForFunction(galleryReady, null, { timeout: 120000 });
      }
      const got = await page.evaluate(() => ({ parts: window.partsGallery.parts.map((p) => p.label), extras: document.getElementById("pg-extras").checked, style: document.getElementById("pg-style").value, url: location.search }));
      const stats = await imageStats(page, ".pg-card img");
      const blank = stats.filter(blankPart).map((s) => s.key);
      if (got.style !== t || !got.extras || !/extras=1/.test(got.url)) problems.push(`${t}: the page did not switch (${J(got)})`);
      if (blank.length || stats.length !== got.parts.length) problems.push(`${t}: blank pictures: ${blank.join(", ")}`);
      stats.filter((s) => !blankPart(s)).forEach((s) => drawnLabels.add(s.key));
      pictures += stats.length;
      if (t === "C") await page.screenshot({ path: resolve(OUT, "gallery-cabin-extras.png"), fullPage: true });
    }
    ok(`all ${Object.keys(DEMO.TYPES).length} styles drew every part they have (${pictures} pictures, none blank)`, problems.length === 0, problems.slice(0, 5).join("\n       "));
    const missing = BUILDING_LABELS.filter((l) => !drawnLabels.has(l));
    ok(`every one of the ${BUILDING_LABELS.length} parts a building can have was drawn on its own at least once (${BUILDING_LABELS.join(", ")})`, missing.length === 0, "never drawn: " + missing.join(", "));
    const leaked = LESSON_LABELS.filter((l) => drawnLabels.has(l));
    ok(`none of the ${LESSON_LABELS.length} lesson parts (${LESSON_LABELS.join(", ")}) was drawn on a building: they are Alan's lessons, kept apart from the designer (CLAUDE.md rule 5)`,
      leaked.length === 0, "drawn on a building: " + leaked.join(", "));
    /* the lesson parts, each drawn on its own where Alan sees it: from the
       plan its lesson page builds -- and nothing of it on the same building
       without the lesson (the learning company's own default building) */
    const lessonBad = [], lessonDrawn = [];
    for (const l of LESSON_LABELS) {
      if (!LESSON_PLANS[l]) { lessonBad.push(`${l}: no lesson plan in LESSON_PLANS -- add how ${LESSONS[l]} builds it`); continue; }
      try {
        const own = trianglesOf(assemble(LESSON_PLANS[l](), { viewport: { w: 320, h: 240 }, fit: "fitref", frames: true, only: [l] }).build);
        const without = trianglesOf(assemble(LEARN_PLAN, { viewport: { w: 320, h: 240 }, fit: "fitref", frames: true, only: [l] }).build);
        if (!(own.get(l) > 0) || own.size !== 1) lessonBad.push(`${l}: its lesson plan drew ${J(Object.fromEntries(own))}`);
        else if (without.size) lessonBad.push(`${l}: drawn on the building without the lesson too (${J(Object.fromEntries(without))})`);
        else lessonDrawn.push(`${l} ${own.get(l)}`);
      } catch (e) { lessonBad.push(`${l}: ${e && e.message || e}`); }
    }
    ok(`each lesson part draws on its own from the plan its lesson page builds, and nothing of it on that building without the lesson (triangles: ${lessonDrawn.join(", ")})`,
      lessonBad.length === 0, lessonBad.join("; "));
    const gl = await page.evaluate(() => window.__glCanvases);
    ok("still ONE 3D drawing surface after all of that", gl === 1, "WebGL canvases: " + gl);
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ================================================================ 3 */
  section("3. The captions are the company's numbers");
  {
    const co = JSON.parse(JSON.stringify(DEMO_FILE));
    co.construction = Object.assign({}, co.construction, { walls: { spacingIn: 24 } });
    const ctx = await newContext(browser, { companies: { demo: co } });
    const { page, noise } = await openPage(ctx, "parts.html?company=demo", galleryReady);
    const txt = await page.evaluate(() => document.querySelector('.pg-card[data-part="wall-frame"] .pg-real').textContent);
    ok(`with 24 in stud spacing the wall-framing card reads "2x4 studs at 24 in on centre"`, /2x4 studs at 24 in on centre/.test(txt), txt);
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ================================================================ 4 */
  section("4. The contact sheet for the starter company");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "setup.html?company=starter", () => window.contactSheet && window.contactSheet.ready);
    /* what the designer would show for every offered style and size */
    const want = [];
    for (const c of STARTER.CATS) for (const t of String(c[1]).split(",")) {
      for (const sz of pSizes(t, STARTER)) {
        const s = defaults(STARTER);
        S.chooseType(s, t, STARTER); normalize(s, null, STARTER);
        if (s.size !== sz) S.chooseSize(s, sz, STARTER);
        normalize(s, null, STARTER);
        const names = s.items.filter((it) => !it.pk).map((it) => STARTER.CAT[it.cat].n);
        want.push({ style: t, size: sz, price: money(priceParts(s, STARTER).total), names });
      }
    }
    await page.evaluate(() => window.contactSheet.drawAll());
    const tiles = await page.evaluate(() => Array.from(document.querySelectorAll(".cs-tile")).map((t) => ({
      style: t.getAttribute("data-style"), size: t.getAttribute("data-size"),
      price: (t.querySelector(".cs-price") || {}).textContent, std: (t.querySelector(".cs-std") || {}).textContent || "",
      notes: Array.from(t.querySelectorAll(".cs-note")).map((n) => n.textContent),
    })));
    ok(`one tile for each of the ${want.length} buildings the starter company offers, in its category order`, J(tiles.map((t) => t.style + " " + t.size)) === J(want.map((w) => w.style + " " + w.size)), J(tiles.map((t) => t.style + " " + t.size)));
    const priceBad = want.filter((w, i) => !tiles[i] || tiles[i].price !== w.price).map((w, i) => `${w.style} ${w.size}: sheet ${tiles[i] && tiles[i].price}, designer ${w.price}`);
    ok("every price is what the designer shows when a customer picks that style and size", priceBad.length === 0, priceBad.join("; "));
    const stdBad = want.filter((w, i) => !tiles[i] || !w.names.every((n) => tiles[i].std.indexOf(n) >= 0)).map((w) => w.style + " " + w.size);
    ok("every tile names its standard doors and windows (by the company's own names)", stdBad.length === 0 && tiles.every((t) => /^Standard:/.test(t.std)), stdBad.join(", "));
    const wide = tiles.filter((t) => /^14x/.test(t.size));
    const note14 = STARTER.notes.sizeNotes["14"];
    ok(`the 14 ft wide tiles (${wide.length}) carry the company's note for that width`, wide.length > 0 && wide.every((t) => t.notes.some((n) => n.indexOf(note14) >= 0)), J(wide));
    const stats = await imageStats(page, ".cs-tile img");
    const blank = stats.filter(blankTile).map((s) => s.key);
    ok(`all ${stats.length} pictures are drawn, none blank`, stats.length === want.length && blank.length === 0, "blank: " + blank.join(", "));
    const gl = await page.evaluate(() => window.__glCanvases);
    ok("ONE 3D drawing surface for the whole sheet", gl === 1, "WebGL canvases: " + gl);
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await page.screenshot({ path: resolve(OUT, "contact-sheet-starter.png"), fullPage: true });
    await ctx.close();
  }

  /* ================================================================ 5 */
  section("5. The demo's whole sheet draws as you scroll, and prints");
  {
    const ctx = await newContext(browser, { viewport: { width: 1000, height: 800 } });
    const { page, noise } = await openPage(ctx, "setup.html?company=demo", () => window.contactSheet && window.contactSheet.ready);
    await sleep(2500);
    const first = await page.evaluate(() => ({ drawn: window.contactSheet.drawn, total: window.contactSheet.tiles.length, last: window.contactSheet.tiles[window.contactSheet.tiles.length - 1].drawn }));
    let total = 0;
    for (const t of Object.keys(DEMO.TYPES)) total += pSizes(t, DEMO).length;
    ok(`the sheet has all ${total} demo buildings`, first.total === total, J(first));
    /* every demo price too: the starter company's buildings all cost exactly
       their size's base price, so only here can the sheet be caught showing
       the base price where the designer shows the total */
    const dtiles = await page.evaluate(() => Array.from(document.querySelectorAll(".cs-tile")).map((t) => ({ key: t.getAttribute("data-style") + " " + t.getAttribute("data-size"), price: (t.querySelector(".cs-price") || {}).textContent })));
    const dwant = new Map();
    let aboveBase = 0;
    for (const t of Object.keys(DEMO.TYPES)) for (const sz of pSizes(t, DEMO)) {
      const s = defaults(DEMO);
      S.chooseType(s, t, DEMO); normalize(s, null, DEMO);
      if (s.size !== sz) S.chooseSize(s, sz, DEMO);
      normalize(s, null, DEMO);
      const pp = priceParts(s, DEMO);
      if (pp.total !== pp.base) aboveBase++;
      dwant.set(t + " " + sz, money(pp.total));
    }
    const dbad = dtiles.filter((t) => dwant.get(t.key) !== t.price).map((t) => `${t.key}: sheet ${t.price}, designer ${dwant.get(t.key)}`);
    ok(`all ${dtiles.length} demo prices are what the designer shows (${aboveBase} of them are more than the size's base price, because of what comes standard)`, dtiles.length === total && aboveBase > 0 && dbad.length === 0, dbad.slice(0, 5).join("; "));
    ok(`at first only the ones near the screen are drawn (${first.drawn} of ${first.total})`, first.drawn > 0 && first.drawn < first.total / 3 && !first.last, J(first));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => window.contactSheet.tiles[window.contactSheet.tiles.length - 1].drawn, null, { timeout: 60000 }).catch(() => {});
    const later = await page.evaluate(() => ({ drawn: window.contactSheet.drawn, last: window.contactSheet.tiles[window.contactSheet.tiles.length - 1].drawn }));
    ok(`scrolling to the bottom draws the last building (${later.drawn} drawn now)`, later.last && later.drawn > first.drawn && later.drawn < first.total, J(later));
    await page.emulateMedia({ media: "print" });
    const pr = await page.evaluate(() => ({ btn: getComputedStyle(document.getElementById("cs-drawall")).display, print: getComputedStyle(document.getElementById("cs-print")).display }));
    ok("printing hides the buttons", pr.btn === "none" && pr.print === "none", J(pr));
    await page.emulateMedia({ media: "screen" });
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ================================================================ 6 */
  section("6. Company words are text; a missing company says so");
  {
    const evil = JSON.parse(JSON.stringify(STARTER_FILE));
    evil.brand.name = '<img src=x onerror="window.__pwned=1">Cedar & <b>Sons</b>';
    evil.offer.LB.name = "<script>window.__pwned=2</script>Loft";
    evil.notes = Object.assign({}, evil.notes, { sizeNotes: { "14": '<img src=y onerror="window.__pwned=3">wide' } });
    const ctx = await newContext(browser, { companies: { starter: evil } });
    for (const path of ["parts.html?company=starter&style=LB", "setup.html?company=starter"]) {
      const isSheet = /setup/.test(path);
      const { page, noise } = await openPage(ctx, path, isSheet ? () => window.contactSheet && window.contactSheet.ready : galleryReady);
      if (isSheet) await page.evaluate(() => window.contactSheet.drawAll());
      await sleep(300);
      const r = await page.evaluate(() => ({ pwned: window.__pwned || null, imgs: Array.from(document.querySelectorAll("img")).filter((i) => /\/(x|y)$/.test(i.src)).length, scripts: document.querySelectorAll("header script, main script").length, head: document.querySelector(".hdr .t1").textContent, body: document.body.textContent }));
      ok(`${path.split("?")[0]}: the company's HTML is shown as text and nothing in it runs`, !r.pwned && r.imgs === 0 && r.scripts === 0 && r.head.indexOf("<img") === 0 && /<script>window/.test(r.body), J({ pwned: r.pwned, imgs: r.imgs, head: r.head }));
      ok(`${path.split("?")[0]}: no console errors`, realNoise(noise).length === 0, J(realNoise(noise)));
      await page.close();
    }
    await ctx.close();
    const c2 = await newContext(browser);
    for (const path of ["parts.html?company=no-such-co", "setup.html?company=no-such-co"]) {
      const isSheet = /setup/.test(path);
      const { page, noise } = await openPage(c2, path, isSheet ? () => window.contactSheet && window.contactSheet.ready : () => window.partsGallery && window.partsGallery.ready);
      const msg = await page.evaluate(() => (document.querySelector(".pg-msg") || {}).textContent || "");
      ok(`${path.split("?")[0]} for an unknown company says so in plain words ("${msg.slice(0, 70)}...")`, /could not/i.test(msg) && /companies\/no-such-co\/company\.json/.test(msg), msg);
      const other = realNoise(noise).filter((m) => !/404/.test(m.text));
      ok(`${path.split("?")[0]}: nothing else goes wrong (only the missing file's 404)`, other.length === 0, J(other));
    }
    await c2.close();
  }

  /* ================================================================ 7 */
  section("7. On the hosted website a skill name is plain text, not a link that goes nowhere");
  {
    const toml = readFileSync(resolve(ROOT, "netlify.toml"), "utf8");
    const blocked = /from\s*=\s*"\/\.claude\/\*"[\s\S]{0,80}?status\s*=\s*404/.test(toml);
    ok("the website does not serve the skills folder (netlify.toml answers \"not found\" for /.claude/*)", blocked);
    const ctx = await newContext(browser);
    /* the same files, opened under a website's name instead of this computer's */
    await ctx.route(/^http:\/\/designer\.example\//, async (r) => { const resp = await r.fetch({ url: r.request().url().replace("http://designer.example", BASE) }); await r.fulfill({ response: resp }); });
    const page = await ctx.newPage();
    const noise = [];
    page.on("console", (m) => { if (m.type() === "error") noise.push({ type: "error", text: m.text(), url: (m.location() || {}).url }); });
    page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
    await page.goto("http://designer.example/parts.html?company=demo", { waitUntil: "load" });
    await page.waitForFunction(galleryReady, null, { timeout: 180000 });
    const h = await page.evaluate(() => ({ cards: document.querySelectorAll(".pg-card").length, links: document.querySelectorAll(".pg-skill a").length, named: Array.from(document.querySelectorAll(".pg-card")).filter((c) => /part-[a-z0-9-]+/.test((c.querySelector(".pg-skill code") || {}).textContent || "")).length }));
    ok(`opened from a website address, all ${h.cards} cards still name their skill, as text (no links to the skills folder)`, h.cards > 0 && h.links === 0 && h.named === h.cards, J(h));
    ok("no console errors there", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }
} catch (e) {
  ok("the check ran to the end", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log(`\ncheck-gallery: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log(`PROVED: the parts gallery draws every part a building has on its own (one WebGL context), with its step, a caption in the company's own numbers and a working link to its skill, ` +
  `and across the demo's styles every one of the ${BUILDING_LABELS.length} parts a building can have is drawn at least once; the ${LESSON_LABELS.length} parts learned in a lesson ` +
  "are on no building, are listed with a working link to their lesson page, and each draws on its own from the plan that lesson builds; " +
  "the contact sheet shows every offered style and size of the starter company " +
  "with its picture, the designer's own price, its standard doors and windows and its size notes, draws the demo's whole sheet as you scroll (every one of its prices the designer's too), prints without its buttons, and shows company words as text; " +
  "the gallery's cards follow the company's build order, and on the hosted website skill names are text, not links that go nowhere. " +
  "Pictures in test/out/gallery-*.png and contact-sheet-starter.png.");
process.exit(0);
