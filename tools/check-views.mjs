/* CHECK: the view switcher on the designer (ui/views.js) -- Outside, Inside,
   Framing and Watch it build -- works on real buildings in a real browser.
   Run: node tools/check-views.mjs [--quiet]        (check-all: browser)

   WHY. Alan asked that "when there is a new design it builds it like in real
   life". The Framing view and the Watch-it-build playback are that promise
   on the screen (docs/ARCHITECTURE.md, "Views"). This check drives them the
   way a visitor does -- real clicks on the buttons -- and reads the actual
   pixels the renderer draws.

   WHAT IT PROVES, on seven buildings (a gable Utility Shed, a gambrel Lofted
   Barn with its loft, a saltbox Cottage, a Single Slope, a Cabin with a
   porch, a Dormer Shed and a Dog Kennel), each painted Navy so the siding is
   easy to count:
   1. FRAMING: the page builds the framing only now (build options frames on),
      the step table hides every finished step and shows every framing step,
      the picture changes a lot, the lumber colour covers far more of it, and
      the Navy siding is gone from it; the note gives the stud, truss and
      joist sizes from the company's own numbers.
   2. WATCH IT BUILD: the steps are exactly the company's build order less the
      steps this building has nothing on (worked out here from the drawing's
      own triangles); stepping through with the Next button shows, at every
      step, exactly the steps landed so far (a finish step hiding the framing
      it covers once it has landed: siding covers the wall framing, roofing
      the roof framing, deck, loft and dormer framing), with the counter and
      a caption that names the step and fills every {placeholder}; after the
      last step the view is Outside again, the framing is no longer built,
      and the picture is IDENTICAL, pixel for pixel, to the Outside picture
      before the playback started.
   3. A door the view hides cannot be picked: a click on a door in Framing,
      and in Watch it build before the doors are up, selects nothing; the
      same click on the Outside view selects that door.
   4. The captions are the COMPANY'S numbers: a copy of the demo company with
      24 in stud spacing and 16 in truss spacing reads "24 in on centre" and
      "16 in on centre" where the demo reads 16 and 24, in the Framing note
      and in the Watch-it-build captions, and its framing picture differs.
   5. Framing and Watch it build are offered only when the company's
      features allow them (features.framingView / buildPlayback false: the
      buttons are not there).
   6. Motion: for a visitor who allows motion the step being placed starts
      about 3 ft up and comes down to 0; played through at speed it ends on
      the Outside view, identical to it. For one who prefers reduced motion
      nothing is ever lifted.
   7. Inside: the Inside button asks for the floor plan (mode "in"); the
      Inside bar under the picture, pressed while in Framing, switches the
      framing off; Outside comes back out.
   8. Back on Outside the building carries no framing triangles at all (the
      finished view costs what it always did).
   9. At phone size (390x844) the buttons and the player stay inside the
      picture, clear of the camera View button, with no sideways scroll.
   10. No console errors (a plugin file not written yet may be missing).
   11. A long press in Framing leaves no "Add here" menu to pop up on
       Outside; a company whose framing cannot be drawn (a lumber size typo)
       goes back to Outside with a plain message instead of an empty yard;
       an empty build order says "Nothing to show step by step". And the
       captions: Roof framing leads with the trusses, and the "Porch posts
       and beam" step tells about the porch's own posts and beam.
   It saves pictures of Framing and of a step half way through Watch it
   build for three buildings to test/out/views-*.png. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { STAGES } from "../parts/stages.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const PORT = 8352, BASE = "http://127.0.0.1:" + PORT;
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

/* The contract (docs/ARCHITECTURE.md, Views), written out here on its own so
   the check does not lean on parts/stages.js buildVisibility. */
const COVER = { siding: ["wall-frame"], roofing: ["roof-frame", "roof-deck", "loft", "dormer-frame"] };
const KIND = Object.fromEntries(STAGES.map((s) => [s.key, s.kind]));
const NAME = Object.fromEntries(STAGES.map((s) => [s.key, s.name]));
function expectShown(steps, i) {
  const shown = new Set(steps.slice(0, i + 1));
  for (const c in COVER) if (steps.indexOf(c) >= 0 && steps.indexOf(c) < i) COVER[c].forEach((h) => shown.delete(h));
  return shown;
}

const DEMO = JSON.parse(readFileSync(resolve(ROOT, "companies/demo/company.json"), "utf8"));
const BUILDINGS = [
  ["UT", "a gable Utility Shed"], ["LB", "a gambrel Lofted Barn with a loft"], ["CS", "a saltbox Cottage Shed"],
  ["SS", "a Single Slope"], ["C", "a Cabin with a porch"], ["DS", "a Dormer Shed"], ["DK", "a Dog Kennel"],
];
const PICTURES = ["LB", "C", "DS"];

/* ---------------- the server and the browser ---------------- */
const servers = [];
async function serve() {
  const url = BASE + "/index.html";
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

const MISSING_PLUGINS = ["views", "blueprint", "quote", "share"].filter((n) => !existsSync(resolve(ROOT, "ui", n + ".js"))).map((n) => "/ui/" + n + ".js");
function realNoise(noise) {
  return noise.filter((m) => {
    if (m.type !== "error" && m.type !== "pageerror") return false;
    if (/404/.test(m.text) && MISSING_PLUGINS.some((p) => (m.url || "").endsWith(p))) return false;
    if (/fonts\.(googleapis|gstatic)\.com/.test(m.text + " " + (m.url || ""))) return false;
    return true;
  });
}

async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1000, height: 800 }, reducedMotion: o.motion ? "no-preference" : "reduce", deviceScaleFactor: 1 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  if (o.company) await ctx.route(/\/companies\/demo\/company\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o.company) }));
  return ctx;
}
async function openPage(ctx, query) {
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") noise.push({ type: t, text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  page.on("requestfailed", (rq) => { if (/127\.0\.0\.1/.test(rq.url()) && !MISSING_PLUGINS.some((p) => rq.url().endsWith(p))) noise.push({ type: "error", text: "request failed " + rq.url() }); });
  await page.goto(BASE + "/" + (query || "?company=demo"), { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
  await page.evaluate(() => {
    const api = window.shedUI, t = api.renderer.test;
    t.dprCap = 1; t.freezeWatchdog = true; t.forceShadow = true;
    api.camera.autoSpin = false;
  });
  return { page, noise };
}

/* choose a style (the designer's own chip rule), paint it Navy, put the camera back */
async function chooseBuilding(page, style) {
  return page.evaluate(async (style) => {
    const api = window.shedUI, S = await import("/ui/state.js");
    const cat = api.getCatalogue();
    api.views.set("finished");
    api.select(null);
    const cam = api.camera;
    cam.interacted = false; cam.anim = null; cam.autoSpin = false; cam.yaw = 0.62; cam.pitch = 0.215;
    const hex = (cat.COLORS.paint.find((c) => /navy/i.test(c[0])) || cat.COLORS.paint[0])[1];
    api.setState((s) => { S.chooseType(s, style, cat); s.body = hex; }, { reason: "check" });
    const st = api.getState();
    return { type: st.type, size: st.size, body: st.body };
  }, style);
}

/* draw now and read the picture back (same task), keep it under a name */
async function picture(page, name, against) {
  return page.evaluate(([name, against]) => {
    const r = window.shedUI.renderer;
    r.draw();
    const p = r.test.readPixels();
    const d = p.data;
    let h = 0x811c9dc5, filled = 0, navy = 0, lumber = 0, diff = 0;
    const prev = against && window.__px && window.__px[against];
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i], G = d[i + 1], B = d[i + 2], A = d[i + 3];
      h = Math.imul(h ^ R ^ (G << 8) ^ (B << 16) ^ (A << 24), 0x01000193) >>> 0;
      if (prev && (Math.abs(prev[i] - R) > 24 || Math.abs(prev[i + 1] - G) > 24 || Math.abs(prev[i + 2] - B) > 24 || Math.abs(prev[i + 3] - A) > 24)) diff++;
      if (A < 200) continue;
      filled++;
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0;
      if (B > R + 14 && B >= G && sat > 0.18) navy++;
      else if (R >= G && G >= B && sat > 0.2 && mx > 80) {
        const hue = 60 * (G - B) / Math.max(1, mx - mn);
        if (hue >= 18 && hue <= 56) lumber++;
      }
    }
    window.__px = window.__px || {};
    window.__px[name] = d.slice();
    const n = p.w * p.h;
    return { hash: h, filled: filled / n, navy: navy / n, lumber: lumber / n, diff: prev ? diff / n : null };
  }, [name, against || null]);
}

/* which building steps the current drawing has triangles on (read here,
   straight from the vertex numbers) */
async function stagesInDrawing(page) {
  return page.evaluate(() => {
    const b = window.shedUI.getResult().build, seen = new Set();
    for (const k of b.ORDER) { const bk = b.buckets[k]; if (!bk || !bk.n) continue; for (let i = 8; i < bk.v.length; i += 27) seen.add(bk.v[i]); }
    return [...seen];
  });
}
const table = (page) => page.evaluate(() => Array.from(window.shedUI.renderer.stageTable));

/* the middle of a door's tap target that faces the camera, in page pixels */
async function doorPoint(page) {
  return page.evaluate(() => {
    const api = window.shedUI, r = api.renderer, cat = api.getCatalogue();
    const doors = api.getState().items.filter((it) => cat.CAT[it.cat] && (cat.CAT[it.cat].k === "door" || cat.CAT[it.cat].k === "ru"));
    const rect = api.canvas.getBoundingClientRect();
    for (const yaw of [0.62, 0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      api.camera.yaw = yaw; api.camera.anim = null;
      r.draw();
      const pc = r.projCache;
      for (const it of doors) {
        for (const q of (api.getResult().build.hitQuads || []).filter((q) => q.id === it.id)) {
          const qc = [(q.pts[0][0] + q.pts[2][0]) / 2, (q.pts[0][1] + q.pts[2][1]) / 2, (q.pts[0][2] + q.pts[2][2]) / 2];
          if (q.n && q.n[0] * (pc.cp[0] - qc[0]) + q.n[1] * (pc.cp[1] - qc[1]) + q.n[2] * (pc.cp[2] - qc[2]) <= 0.1) continue;
          const pj = q.pts.map((p) => pc.proj(p));
          if (pj.some((p) => !p)) continue;
          const x = pj.reduce((a, p) => a + p[0], 0) / 4, y = pj.reduce((a, p) => a + p[1], 0) / 4;
          if (x < 20 || y < 60 || x > rect.width - 20 || y > rect.height - 140) continue;   /* clear of the buttons and the player */
          return { id: it.id, cat: it.cat, x: rect.left + x, y: rect.top + y, yaw: yaw, stage: q.stage };
        }
      }
    }
    return null;
  });
}
/* turn the camera to a yaw and draw, so the tap targets are where the picture is */
async function face(page, yaw) {
  await page.evaluate((yaw) => { const api = window.shedUI, c = api.camera; c.yaw = yaw; c.pitch = 0.215; c.anim = null; api.renderer.draw(); }, yaw);
}
async function clickAt(page, pt) {
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(120);
  return page.evaluate(() => window.shedUI.getState().sel);
}

const view = (page) => page.evaluate(() => window.shedUI.views.view);
const tabClick = (page, v) => page.click('.vw-tab[data-view="' + v + '"]');

console.log("check-views: Outside / Inside / Framing / Watch it build, driven in a real browser\n");
mkdirSync(OUT, { recursive: true });

let browser;
const finishedHash = {}, framingHash = {};
try {
  await serve();
  browser = await chromium.launch(LAUNCH);

  /* ================================================================ 1-3, 8 */
  const ctx = await newContext(browser);
  const { page, noise } = await openPage(ctx, "?company=demo");
  section("The switcher is there");
  const info = await page.evaluate(() => ({
    tabs: Array.from(document.querySelectorAll("#view-mount .vw-tab")).map((b) => b.getAttribute("data-view")),
    labels: Array.from(document.querySelectorAll("#view-mount .vw-tab .vw-long")).map((b) => b.textContent),
    offered: window.shedUI.views.offered(), plugin: window.shedUI.plugins.views, frames: window.shedUI.getBuildOptions().frames,
    reduced: window.shedUI.views.reducedMotion(),
  }));
  ok("the views plugin loaded and put four buttons in #view-mount: " + info.labels.join(", "), info.plugin === true && J(info.tabs) === J(["finished", "inside", "framing", "build"]) && J(info.labels) === J(["Outside", "Inside", "Framing", "Watch it build"]), J(info));
  ok("the page opens on Outside with no framing built", info.frames === false && (await view(page)) === "finished");

  for (const [style, what] of BUILDINGS) {
    section(`${style}: ${what}`);
    const b = await chooseBuilding(page, style);
    const F = await picture(page, "F-" + style);
    finishedHash[style] = F.hash;
    const noFrameF = (await stagesInDrawing(page)).every((id) => STAGES[id].kind !== "frame");
    ok(`${style} ${b.size}: the Outside view draws no framing triangles at all`, noFrameF);

    /* ---- Framing ---- */
    await tabClick(page, "framing");
    await sleep(80);
    const R = await picture(page, "R-" + style, "F-" + style);
    framingHash[style] = R.hash;
    const fr = await page.evaluate(() => ({ view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames, note: window.shedUI.views.framingNote(), plan: window.shedUI.getPlan().construction }));
    const tb = await table(page);
    const wrong = STAGES.filter((s) => (tb[s.id * 4] > 0.5) !== !(s.kind === "frame" || s.kind === "both" || s.kind === "always")).map((s) => s.key);
    ok(`${style}: Framing builds the framing and hides exactly the finished steps`, fr.view === "framing" && fr.frames === true && wrong.length === 0, J({ fr: fr.view, frames: fr.frames, wrong }));
    const present = new Set((await stagesInDrawing(page)).map((id) => STAGES[id].key));
    ok(`${style}: the framing parts are there (floor frame, wall framing, roof framing)`, ["floor-frame", "wall-frame", "roof-frame"].every((k) => present.has(k)), [...present].join(" "));
    ok(`${style}: the Framing picture differs from Outside (${(R.diff * 100).toFixed(1)}% of pixels) and lumber covers ${(R.lumber * 100).toFixed(1)}% against ${(F.lumber * 100).toFixed(1)}%`,
      R.diff > 0.04 && R.lumber > 0.01 && R.lumber > F.lumber * 2, J({ F, R }));
    ok(`${style}: the Navy siding is gone (${(F.navy * 100).toFixed(2)}% of the Outside picture, ${(R.navy * 100).toFixed(3)}% of Framing)`, F.navy > 0.02 && R.navy < F.navy * 0.03 + 0.0005, J({ F: F.navy, R: R.navy }));
    const c = fr.plan;
    const wantNote = `${c.walls.stud} studs ${c.walls.spacingIn} in on centre · ${c.roof.chord} trusses ${c.roof.spacingIn} in on centre · ${c.floor.joist} floor joists ${c.floor.spacingIn} in on centre`;
    ok(`${style}: the Framing note gives the company's sizes: "${wantNote}"`, fr.note.indexOf(wantNote) >= 0, fr.note);
    if (PICTURES.includes(style)) await (await page.$("#stage")).screenshot({ path: resolve(OUT, `views-${style}-framing.png`) });

    /* a door hidden by Framing cannot be picked */
    const dp = await doorPoint(page);
    if (ok(`${style}: found a door to tap`, !!dp)) {
      const sel = await clickAt(page, dp);
      ok(`${style}: tapping the hidden ${dp.cat} in Framing selects nothing`, sel === null, "selected " + sel);
    }
    await page.evaluate(() => { const c = window.shedUI.camera; c.yaw = 0.62; c.pitch = 0.215; c.anim = null; c.interacted = false; });

    /* ---- Watch it build ---- */
    await tabClick(page, "build");
    await sleep(60);
    await page.click("#vw-play");                                  /* pause: step by hand */
    const bs = await page.evaluate(() => ({ steps: window.shedUI.views.steps(), order: window.shedUI.getPlan().construction.buildOrder, playing: window.shedUI.views.playing(), frames: window.shedUI.getBuildOptions().frames }));
    const have = new Set((await stagesInDrawing(page)).map((id) => STAGES[id].key));
    const want = bs.order.filter((k, i) => bs.order.indexOf(k) === i && have.has(k));
    ok(`${style}: Watch it build plays the company's build order less the steps this building has nothing on (${want.length} of ${bs.order.length}: skips ${bs.order.filter((k) => !have.has(k)).join(", ") || "none"})`,
      J(bs.steps) === J(want) && bs.frames === true && bs.playing === false, J({ got: bs.steps, want }));
    if (dp) {
      await face(page, dp.yaw);
      const sel0 = await clickAt(page, dp);
      ok(`${style}: at step 1 (before the doors are up) tapping the door selects nothing`, sel0 === null, "selected " + sel0);
      await face(page, 0.62);
      await page.evaluate(() => { window.shedUI.camera.interacted = false; });
    }
    const bad = [], capIds = {};
    const mid = Math.max(0, bs.steps.indexOf("roof-frame"));
    for (let i = 0; i < bs.steps.length; i++) {
      const s = await page.evaluate(() => ({
        k: window.shedUI.views.step(), cap: window.shedUI.views.caption(),
        head: document.getElementById("vw-step").textContent, text: document.getElementById("vw-text").textContent,
        count: document.getElementById("vw-count").textContent, hidden: document.getElementById("vw-player").hidden,
      }));
      const tb2 = await table(page);
      const shown = expectShown(bs.steps, i);
      const tabBad = STAGES.filter((st) => (tb2[st.id * 4] > 0.5) === shown.has(st.key) || tb2[st.id * 4 + 1] !== 0).map((st) => st.key);
      const key = bs.steps[i];
      capIds[key] = s.cap.lines.map((l) => l.id);
      if (s.k !== i || s.hidden) bad.push(`step ${i}: at ${s.k}`);
      if (tabBad.length) bad.push(`step ${i} (${key}): wrong in the table: ${tabBad.join(" ")}`);
      if (s.head.indexOf(`Step ${i + 1} of ${bs.steps.length}`) !== 0 || s.head.indexOf(NAME[key]) < 0 || s.count !== `${i + 1} / ${bs.steps.length}`) bad.push(`step ${i}: heading "${s.head}" / "${s.count}"`);
      if (!s.cap.lines.length || !s.text.trim() || /[{}]/.test(s.text)) bad.push(`step ${i} (${key}): caption "${s.text}"`);
      if (key === "wall-frame") {
        const c2 = await page.evaluate(() => window.shedUI.getPlan().construction);
        if (s.text.indexOf(`${c2.walls.stud} studs at ${c2.walls.spacingIn} in on centre`) < 0) bad.push(`wall framing caption lacks the company's stud size and spacing: "${s.text}"`);
      }
      if (i === mid && PICTURES.includes(style)) await (await page.$("#stage")).screenshot({ path: resolve(OUT, `views-${style}-build.png`) });
      await page.click("#vw-next");
      await sleep(30);
    }
    ok(`${style}: every one of the ${bs.steps.length} steps, in order, shows exactly the steps landed so far (covered framing hidden), with its counter and a filled caption`, bad.length === 0, bad.slice(0, 6).join("\n       "));
    ok(`${style}: the Roof framing step's caption starts with the roof framing itself (${(capIds["roof-frame"] || []).join(", ")})`, (capIds["roof-frame"] || [])[0] === "roof-frame", J(capIds["roof-frame"]));
    if (bs.steps.indexOf("porch-frame") >= 0) {
      ok(`${style}: the "Porch posts and beam" step tells about the porch's own posts and beam, not only an added post (${capIds["porch-frame"].join(", ")})`, capIds["porch-frame"].indexOf("porch") >= 0, J(capIds["porch-frame"]));
    }
    await sleep(80);
    const end = await page.evaluate(() => ({ view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames, player: document.getElementById("vw-player").hidden }));
    const E = await picture(page, "E-" + style, "F-" + style);
    ok(`${style}: after the last step it is Outside again, with no framing built`, end.view === "finished" && end.frames === false && end.player === true, J(end));
    ok(`${style}: and the picture is identical to Outside before the playback (pixel for pixel)`, E.hash === F.hash && E.diff === 0, J({ E: E.hash, F: F.hash, diff: E.diff }));
    const noFrameE = (await stagesInDrawing(page)).every((id) => STAGES[id].kind !== "frame");
    ok(`${style}: back on Outside the drawing carries no framing triangles (the finished view costs what it did)`, noFrameE);
    if (dp) {
      await face(page, dp.yaw);
      const sel = await clickAt(page, dp);
      ok(`${style}: the same tap on Outside does select that ${dp.cat}`, sel === dp.id, `selected ${sel}, wanted ${dp.id}`);
      await page.evaluate(() => window.shedUI.select(null));
    }
  }

  /* ================================================================ 7 */
  section("Inside");
  await chooseBuilding(page, "UT");
  await tabClick(page, "inside");
  await sleep(80);
  let m = await page.evaluate(() => ({ mode: window.shedUI.getMode(), view: window.shedUI.views.view, bp: getComputedStyle(document.getElementById("bp")).display }));
  ok("the Inside button shows the floor plan (mode 'in')", m.mode === "in" && m.view === "inside" && m.bp !== "none", J(m));
  await tabClick(page, "framing");
  await sleep(80);
  m = await page.evaluate(() => ({ mode: window.shedUI.getMode(), view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames }));
  ok("Framing from the floor plan goes back to the 3D picture", m.mode === "out" && m.view === "framing" && m.frames === true, J(m));
  await page.click("#modebar");
  await sleep(80);
  m = await page.evaluate(() => ({ mode: window.shedUI.getMode(), view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames, on: document.querySelector(".vw-tab.on").getAttribute("data-view"), table: Array.from(window.shedUI.renderer.stageTable) }));
  const finTable = STAGES.every((s) => (m.table[s.id * 4] > 0.5) === (s.kind === "frame"));
  ok("the Inside bar under the picture, pressed in Framing, switches to Inside and stops building the framing", m.mode === "in" && m.view === "inside" && m.on === "inside" && m.frames === false && finTable, J({ mode: m.mode, view: m.view, on: m.on, frames: m.frames }));
  await tabClick(page, "finished");
  await sleep(80);
  m = await page.evaluate(() => ({ mode: window.shedUI.getMode(), view: window.shedUI.views.view }));
  ok("Outside comes back out of the floor plan", m.mode === "out" && m.view === "finished", J(m));

  /* ================================================================ 6 (reduced) */
  section("Reduced motion");
  await tabClick(page, "build");
  const rm = [];
  for (let i = 0; i < 4; i++) {
    const t = await table(page);
    const k = await page.evaluate(() => window.shedUI.views.steps()[window.shedUI.views.step()]);
    const id = STAGES.findIndex((s) => s.key === k);
    rm.push(t[id * 4 + 1]);
    await page.click("#vw-next");
  }
  ok("a visitor who prefers reduced motion gets each step put in place at once: nothing is ever lifted (" + rm.join(", ") + ")", rm.every((v) => v === 0), J(rm));
  await tabClick(page, "finished");
  ok("no console errors on the designer", realNoise(noise).length === 0, J(realNoise(noise)));
  await ctx.close();

  /* ================================================================ 4 */
  section("The captions are the company's numbers");
  const variant = JSON.parse(JSON.stringify(DEMO));
  variant.construction = Object.assign({}, variant.construction, { walls: { spacingIn: 24 }, roof: { spacingIn: 16 } });
  const cv = await newContext(browser, { company: variant });
  const v = await openPage(cv, "?company=demo");
  await chooseBuilding(v.page, "UT");
  await tabClick(v.page, "framing");
  await sleep(80);
  const VR = await picture(v.page, "VR");
  const vnote = await v.page.evaluate(() => window.shedUI.views.framingNote());
  ok(`a company with 24 in studs and 16 in trusses: the Framing note says so ("${vnote}")`, /2x4 studs 24 in on centre/.test(vnote) && /trusses 16 in on centre/.test(vnote), vnote);
  ok("and its framing is drawn differently from the demo's (the studs and trusses really moved)", VR.hash !== framingHash.UT, J({ variant: VR.hash, demo: framingHash.UT }));
  await tabClick(v.page, "build");
  await v.page.click("#vw-play");
  const caps = {};
  const vsteps = await v.page.evaluate(() => window.shedUI.views.steps());
  for (let i = 0; i < vsteps.length; i++) {
    caps[vsteps[i]] = await v.page.evaluate(() => document.getElementById("vw-text").textContent);
    await v.page.click("#vw-next");
  }
  ok(`its wall-framing step reads "24 in on centre" ("${(caps["wall-frame"] || "").slice(0, 70)}...")`, /2x4 studs at 24 in on centre/.test(caps["wall-frame"] || ""), caps["wall-frame"]);
  ok(`its roof-framing step reads "every 16 in on centre"`, /every 16 in on centre/.test(caps["roof-frame"] || ""), caps["roof-frame"]);
  ok("no console errors with the changed company", realNoise(v.noise).length === 0, J(realNoise(v.noise)));
  await cv.close();
  {
    const cd = await newContext(browser);
    const d = await openPage(cd, "?company=demo");
    await chooseBuilding(d.page, "UT");
    await tabClick(d.page, "build");
    await d.page.click("#vw-play");
    const st = await d.page.evaluate(() => window.shedUI.views.steps());
    const dcaps = {};
    for (let i = 0; i < st.length; i++) { dcaps[st[i]] = await d.page.evaluate(() => document.getElementById("vw-text").textContent); await d.page.click("#vw-next"); }
    ok("while the demo company's own reads 16 in studs and 24 in trusses", /2x4 studs at 16 in on centre/.test(dcaps["wall-frame"] || "") && /every 24 in on centre/.test(dcaps["roof-frame"] || ""), J({ w: dcaps["wall-frame"], r: dcaps["roof-frame"] }));
    await cd.close();
  }

  /* ================================================================ 5 */
  section("Only what the company's features allow");
  for (const [feats, want] of [[{ framingView: false, buildPlayback: false }, ["finished", "inside"]], [{ framingView: true, buildPlayback: false }, ["finished", "inside", "framing"]], [{ framingView: false, buildPlayback: true, floorPlan: false }, ["finished", "build"]]]) {
    const co = JSON.parse(JSON.stringify(DEMO));
    co.features = Object.assign({}, co.features || {}, feats);
    const cf = await newContext(browser, { company: co });
    const f = await openPage(cf, "?company=demo");
    const got = await f.page.evaluate(() => ({ tabs: Array.from(document.querySelectorAll("#view-mount .vw-tab")).map((b) => b.getAttribute("data-view")), offered: window.shedUI.views.offered() }));
    ok(`features ${J(feats)}: the buttons are ${want.join(", ")}`, J(got.tabs) === J(want) && J(got.offered) === J(want), J(got));
    ok(`features ${J(feats)}: no console errors`, realNoise(f.noise).length === 0, J(realNoise(f.noise)));
    await cf.close();
  }

  /* ================================================================ 11 */
  section("A menu left open, and settings that are wrong");
  {
    const ca = await newContext(browser);
    const a = await openPage(ca, "?company=demo");
    await tabClick(a.page, "framing");
    await sleep(80);
    const cb = await a.page.evaluate(() => { const r = window.shedUI.canvas.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55 }; });
    await a.page.mouse.move(cb.x, cb.y); await a.page.mouse.down(); await sleep(750); await a.page.mouse.up(); await sleep(80);
    await tabClick(a.page, "finished");
    await sleep(80);
    const pop = await a.page.evaluate(() => { const e = document.getElementById("addpop"); return { open: e.classList.contains("open"), shown: getComputedStyle(e).display !== "none" }; });
    ok("a long press on a wall in Framing (which shows no menu there) leaves no \"Add here\" menu popping up on Outside", !pop.open && !pop.shown, J(pop));
    const door = await a.page.evaluate(() => { const api = window.shedUI, cat = api.getCatalogue(); const it = api.getState().items.find((i) => cat.CAT[i.cat] && cat.CAT[i.cat].k === "door"); api.select(it.id); return it.id; });
    await sleep(80);
    await tabClick(a.page, "framing");
    await sleep(80);
    const ds = await a.page.evaluate(() => ({ sel: window.shedUI.getState().sel, sheet: document.getElementById("sheet").classList.contains("open") }));
    ok(`a door selected on Outside (${door}) is put down when Framing hides it: nothing selected, its card closed`, ds.sel === null && ds.sheet === false, J(ds));
    await ca.close();

    const bad = JSON.parse(JSON.stringify(DEMO));
    bad.construction = Object.assign({}, bad.construction, { roof: Object.assign({}, (bad.construction || {}).roof, { chord: "2y4" }) });
    const cw = await newContext(browser, { company: bad });
    const w = await openPage(cw, "?company=demo");
    const WF = await picture(w.page, "W-F");
    await tabClick(w.page, "framing");
    await sleep(120);
    const wr = await w.page.evaluate(() => ({ view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames, msg: window.shedUI.views.message(), on: document.querySelector(".vw-tab.on").getAttribute("data-view") }));
    const WR = await picture(w.page, "W-R", "W-F");
    ok(`a company whose roof lumber size is a typo ("2y4"): Framing cannot be drawn, so the page goes back to Outside and says so ("${wr.msg.slice(0, 60)}...")`, wr.view === "finished" && wr.on === "finished" && wr.frames === false && /could not be drawn/.test(wr.msg), J(wr));
    ok("and shows the finished building, not an empty yard (identical to Outside)", WR.hash === WF.hash && WR.diff === 0, J({ WR: WR.hash, WF: WF.hash }));
    await tabClick(w.page, "build");
    await sleep(120);
    const wb = await w.page.evaluate(() => ({ view: window.shedUI.views.view, player: document.getElementById("vw-player").hidden }));
    ok("Watch it build does the same (back to Outside, no player)", wb.view === "finished" && wb.player === true, J(wb));
    const other = realNoise(w.noise).filter((m) => !/could not be drawn|not a lumber size/.test(m.text));
    ok("nothing else goes wrong (only the page's own note about the drawing)", other.length === 0, J(other));
    await cw.close();

    const none = JSON.parse(JSON.stringify(DEMO));
    none.construction = Object.assign({}, none.construction, { buildOrder: [] });
    const cn = await newContext(browser, { company: none });
    const n = await openPage(cn, "?company=demo");
    await tabClick(n.page, "build");
    await sleep(2800);
    const nb = await n.page.evaluate(() => ({ view: window.shedUI.views.view, head: document.getElementById("vw-step").textContent, text: document.getElementById("vw-text").textContent, play: document.getElementById("vw-play").disabled }));
    ok(`a company whose build order is empty: the player says so in plain words ("${nb.head}") rather than "Step 1 of 0", and waits for Finished`, nb.view === "build" && /Nothing to show/.test(nb.head) && !/of 0/.test(nb.head + nb.text) && nb.play === true, J(nb));
    await n.page.click("#vw-end");
    ok("and Finished takes it back to Outside", (await view(n.page)) === "finished");
    ok("no console errors with an empty build order", realNoise(n.noise).length === 0, J(realNoise(n.noise)));
    await cn.close();
  }

  /* ================================================================ 6 (motion) */
  section("Motion: each step is lowered into place");
  {
    const cm = await newContext(browser, { motion: true });
    const mm = await openPage(cm, "?company=demo");
    const p = mm.page;
    await chooseBuilding(p, "LB");
    const F0 = await picture(p, "M-F");
    await p.evaluate(() => { window.shedUI.views.timeScale = 4; });            /* a slow drop, to read it on the way down */
    await tabClick(p, "build");
    await p.click("#vw-play");                                                /* pause: the step still lands */
    const lifts = [];
    const stepKey = await p.evaluate(() => window.shedUI.views.steps()[0]);
    const sid = STAGES.findIndex((s) => s.key === stepKey);
    for (let i = 0; i < 6; i++) { lifts.push(+(await table(p))[sid * 4 + 1].toFixed(3)); await sleep(500); }
    await (await p.$("#stage")).screenshot({ path: resolve(OUT, "views-LB-build-lowering.png") });
    ok(`the step being placed starts up to 3 ft up and comes down to 0 (${lifts.join(" -> ")} ft)`, lifts[0] > 0.3 && lifts[0] <= 3.0001 && lifts.every((x, i) => i === 0 || x <= lifts[i - 1] + 1e-6) && lifts[lifts.length - 1] < lifts[0], J(lifts));
    await p.evaluate(() => { window.shedUI.views.timeScale = 4; });
    await p.click("#vw-next");
    await sleep(150);
    const k1 = await p.evaluate(() => window.shedUI.views.steps()[window.shedUI.views.step()]);
    const lift1 = (await table(p))[STAGES.findIndex((s) => s.key === k1) * 4 + 1];
    ok(`the Next button lowers the next step too (${k1} at ${lift1.toFixed(2)} ft just after)`, lift1 > 0.3 && lift1 <= 3.0001, lift1);
    await p.evaluate(() => { window.shedUI.views.timeScale = 0.01; window.shedUI.views.play(); });
    await p.waitForFunction(() => window.shedUI.views.view === "finished", null, { timeout: 60000 }).catch(() => {});
    await sleep(100);
    const endM = await p.evaluate(() => ({ view: window.shedUI.views.view, frames: window.shedUI.getBuildOptions().frames }));
    const E0 = await picture(p, "M-E", "M-F");
    ok("played through on its own it ends on Outside, with no framing built", endM.view === "finished" && endM.frames === false, J(endM));
    ok("and the picture is identical to Outside before it started", E0.hash === F0.hash && E0.diff === 0, J({ E0: E0.hash, F0: F0.hash, diff: E0.diff }));
    ok("no console errors with motion on", realNoise(mm.noise).length === 0, J(realNoise(mm.noise)));
    await cm.close();
  }

  /* ================================================================ 9 */
  section("On a phone");
  {
    const cp = await newContext(browser, { viewport: { width: 390, height: 844 } });
    const ph = await openPage(cp, "?company=demo");
    await tabClick(ph.page, "build");
    await ph.page.click("#vw-play");
    const g = await ph.page.evaluate(() => {
      const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
      const st = box(document.getElementById("stage")), tabs = box(document.querySelector(".vw-tabs")), vb = box(document.getElementById("viewtoggle")), pl = box(document.getElementById("vw-player"));
      return { st, tabs, vb, pl, sw: document.documentElement.scrollWidth, iw: window.innerWidth };
    });
    const inside = (a, s) => a.l >= s.l - 0.5 && a.r <= s.r + 0.5 && a.t >= s.t - 0.5 && a.b <= s.b + 0.5;
    ok("at 390x844 the buttons fit inside the picture on one row, clear of the View button", inside(g.tabs, g.st) && g.tabs.r <= g.vb.l && g.tabs.b - g.tabs.t < 40, J(g));
    ok("and the player sits inside the picture, with no sideways scroll", inside(g.pl, g.st) && g.sw <= g.iw, J(g));
    await (await ph.page.$("#stage")).screenshot({ path: resolve(OUT, "views-phone-build.png") });
    ok("no console errors on a phone", realNoise(ph.noise).length === 0, J(realNoise(ph.noise)));
    await cp.close();
  }
} catch (e) {
  ok("the check ran to the end", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log(`\ncheck-views: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log(`PROVED: the Framing view and Watch it build work on ${BUILDINGS.length} buildings (${BUILDINGS.map((b) => b[0]).join(", ")}): Framing hides the siding and shows the lumber, ` +
  "the playback steps through the company's build order and ends identical to the finished picture, hidden doors cannot be tapped, the captions carry the company's own numbers, " +
  "the buttons follow the company's features, motion and reduced motion both behave, Inside works, the phone layout fits, no hidden menu or selection is left behind, " +
  "a framing that cannot be drawn goes back to Outside with a plain message, and an empty build order says so. Pictures in test/out/views-*.png.");
process.exit(0);
