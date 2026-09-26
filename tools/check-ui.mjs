/* CHECK: the designer page (index.html + ui/*) works, in Node and in a real
   browser.
   Run: node tools/check-ui.mjs [--only=3,5] [--quiet]     (check-all: browser)

   IN NODE (ui/state.js, no browser):
     * every style of the demo starts on its standard doors and windows;
     * DIFFERENCES #12, changing size: while the doors and windows are still
       the standard ones, a new size gets the standard ones FOR THAT SIZE
       (every style, every size, from its default size) -- a 10x12 Cottage made
       10x16 swaps its 46 in door for the 70 in doubles, a 6x8 Backyard Utility
       made 6x12 gets its two windows; once the customer has moved, added,
       removed or dressed up anything, a size change keeps their items and
       only moves them onto the new walls, exactly as Barnwright's setSize
       (model/design.js setSize) does; an electric package's fixtures are
       laid again after a re-lay and still charged;
     * the "Add here", add-button, duplicate and type-change rules land items
       where Barnwright's would.
   IN THE BROWSER (the repo served on port 8340; Barnwright's page on 8341 for
   the comparison), with software graphics:
     * the demo and the starter company load with no console errors (a plugin
       file -- ui/views.js, blueprint.js, quote.js, share.js -- that does not
       exist yet may be reported missing by the browser, nothing else), the
       header shows the company's name, and window.shedUI has its API;
     * every category, every style chip (real clicks) and every size chip of
       every style can be picked, and after each the plate shows exactly the
       total model/pricing.js priceParts gives for the state on the page
       (worked out again here, in Node);
     * picking a colour changes the design, the colour's NAME and the picture;
     * the canvas is not blank (pixels read back from the renderer);
     * every door, window, roll-up, light and porch post the company sells
       can be added, turned into its kind from the sheet, put down, tapped on
       the 3D picture to select it, DRAGGED along its wall (its new place is
       one clampPos accepts) and removed; a bench and a shelf can be added,
       lengthened and removed; shutters, double window, window in door, the
       steel door's lite swap and the door colour work from the sheet;
     * pressing and holding a bare wall opens "Add here" (door, window,
       outlet), the finger lifting does not close it, and "+ Window" puts a
       window on that wall where the finger was; holding the sky does not;
     * the Inside button and an electric package call window.shedUI.onInside,
       and setMode("in") shows the floor-plan canvas;
     * size change in the page: a Cottage at 10x12 made 10x16 gets its
       doubles; after the customer moves the door, a size change keeps it;
     * the opening turn runs for a visitor, and not for one who prefers
       reduced motion;
     * layouts: no sideways scroll at 390x844 (phone) and 1440x900 (desktop),
       sheet open or shut; two columns at 1180x820, stacked at 820x1180 and on
       an upright iPad Pro (1024x1366); in two columns the Inside button is
       fully on screen and the sheet never covers it;
     * a company whose name (and style, colour, extra, fine print, size note
       and credit) contains <script> and <img onerror> shows those characters
       as text and runs none of them;
     * a company file with a mistake shows its problems in plain words; a
       suspended company shows "not available" and its number to call;
     * a part that is still a stub leaves a partial building and no error; a
       part that throws leaves the cards, the prices and the buttons working
       and says so on the picture;
     * embedded (?embed=1): no header; on a phone a "Tap to design" cover lets
       a finger scroll the page past; on a desktop the wheel zooms only with
       Ctrl; under /c/<company>/ the page finds its own files; a company's
       pricing.show "none" shows no money, "from" says "from" on the plate;
     * it looks like Barnwright's page: the same hint, views, cards, sheet
       controls, and the same type sizes, spacing and corners on the header,
       stage, plate, cards, chips, swatches and buttons, and the same stage
       and column boxes at 1440x900 and 390x844. */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadCatalogue, readJSON } from "./lib/load.mjs";
import * as S from "../ui/state.js";
import { esc, safeUrl } from "../ui/esc.js";
import { defaults, setSize as modelSetSize, normalize } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { clampPos, resetItems } from "../model/layout.js";
import { priceParts, money, pSizes } from "../model/pricing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BW_PUBLIC = "/home/user/boisterous-lokum-a737e0/public";
const PORT = 8340, BW_PORT = 8341, BASE = "http://127.0.0.1:" + PORT;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; if (!QUIET) console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 900) : "")); }
  return !!cond;
}
const QUIET = process.argv.includes("--quiet");
/* --only=3,5 runs just those browser sections (section 1, in Node, always runs) */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).map(Number);
const want = (n) => !ONLY.length || ONLY.indexOf(n) >= 0;
function section(t) { console.log("\n" + t); }
const J = (v) => JSON.stringify(v);
const copy = (v) => JSON.parse(JSON.stringify(v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEMO = loadCatalogue("demo");
const STARTER = loadCatalogue("starter");
const CATS = { demo: DEMO, starter: STARTER };

console.log("check-ui: the designer page works -- the rules in Node, the page in a real browser\n");

/* ======================================================================
   PART 1: ui/state.js in Node */
section("1. The design rules (ui/state.js, in Node)");

ok("esc() turns every HTML character into text", esc(`<a href="x" onclick='y'>&\`</a>`) === "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;");
ok("safeUrl() refuses javascript:, data: text, //other-site and tab-split schemes",
  ["javascript:alert(1)", "JAVASCRIPT:x", "java\tscript:x", " javascript:x", "data:text/html,x", "//evil.example/x", "vbscript:x"].every((u) => safeUrl(u, { image: true }) === ""));
ok("safeUrl() keeps https, http, mailto, relative paths and data:image", safeUrl("https://a.example/x") && safeUrl("http://a.example") && safeUrl("mailto:a@b.c") && safeUrl("images/logo.png") && safeUrl("/logo.png") && safeUrl("data:image/png;base64,AAAA", { image: true }));

function itemsSig(items) { return items.map((it) => [it.cat, it.wall, +(it.pos || 0).toFixed(6), +(it.vy || 0).toFixed(6), !!it.dbl, !!it.inc, it.origCat || null, !!it.pk]); }

{
  let allStd = true, relayOk = 0, relayBad = [], keptOk = 0, keptBad = [], priceBad = [], pairs = 0, keptTried = 0;
  for (const t of Object.keys(DEMO.TYPES)) {
    const s = defaults(DEMO); S.chooseType(s, t, DEMO); normalize(s, null, DEMO);
    if (!S.isStandardLayout(s, DEMO)) { allStd = false; relayBad.push(t + " starts non-standard"); }
    const start = s.size;
    for (const sz of pSizes(t, DEMO)) {
      if (sz === start) continue;
      pairs++;
      /* untouched: exactly the standard layout for the new size */
      const a = copy(s);
      const r = S.chooseSize(a, sz, DEMO); normalize(a, null, DEMO);
      const want = copy(a); resetItems(want, frameOf(want, DEMO), DEMO);
      if (r.relaid && J(itemsSig(a.items)) === J(itemsSig(want.items)) && S.isStandardLayout(a, DEMO)) relayOk++;
      else relayBad.push(`${t} ${start}->${sz}`);
      const pp = priceParts(a, DEMO);
      if (!(pp.total > 0) || pp.total !== priceParts(copy(a), DEMO).total) priceBad.push(`${t} ${sz}`);
      /* touched (the first item nudged 0.3 ft): Barnwright's setSize, item for item */
      const b = copy(s);
      const wallItem = b.items.find((it) => typeof it.pos === "number" && !DEMO.CAT[it.cat].gable);
      if (!wallItem) continue;
      wallItem.pos += 0.3; clampPos(wallItem, b, frameOf(b, DEMO));
      if (S.isStandardLayout(b, DEMO)) continue;           /* the nudge was clamped straight back */
      keptTried++;
      const bw = copy(b);
      const r2 = S.chooseSize(b, sz, DEMO);
      modelSetSize(bw, sz, DEMO);
      if (!r2.relaid && J(b.items) === J(bw.items)) keptOk++; else keptBad.push(`${t} ${start}->${sz}`);
    }
  }
  ok("every demo style starts on its standard doors and windows", allStd, relayBad.join(", "));
  ok(`untouched: a size change lays the NEW size's standard doors and windows (all ${relayOk} style/size changes from each style's first size)`, relayBad.length === 0 && relayOk === pairs && pairs > 100, relayBad.slice(0, 12).join(", "));
  ok(`touched: a size change keeps the customer's items, moved as Barnwright's setSize moves them (${keptOk} changes)`, keptBad.length === 0 && keptOk === keptTried && keptOk > 100, keptBad.slice(0, 12).join(", "));
  ok("every re-laid building still prices", priceBad.length === 0, priceBad.join(", "));
}
{
  const s = defaults(DEMO); S.chooseType(s, "CS", DEMO); S.chooseSize(s, "10x12", DEMO);
  const before = s.items.map((it) => it.cat).join(",");
  const r = S.chooseSize(s, "10x16", DEMO);
  ok("a 10x12 Cottage made 10x16 swaps its 46 in door for the 70 in doubles", r.relaid && /w48/.test(before) && s.items.some((it) => it.cat === "w72") && !s.items.some((it) => it.cat === "w48"), before + " -> " + s.items.map((it) => it.cat).join(","));
  const b = defaults(DEMO); S.chooseType(b, "BU", DEMO); S.chooseSize(b, "6x8", DEMO);
  const n8 = b.items.length; S.chooseSize(b, "6x12", DEMO);
  ok("a 6x8 Backyard Utility made 6x12 gets its two windows", n8 === 1 && b.items.filter((it) => it.cat === "w23").length === 2, n8 + " -> " + b.items.map((it) => it.cat).join(","));
  const c = defaults(DEMO); S.chooseType(c, "UT", DEMO); S.chooseSize(c, "10x12", DEMO);
  S.addItem(c, "w23", DEMO, 0);
  S.chooseSize(c, "12x24", DEMO);
  ok("an added window is kept through a size change (the doors are not re-laid)", c.items.length === 2 && c.items.some((it) => it.cat === "w23"));
  const p = defaults(DEMO); S.chooseType(p, "UT", DEMO); S.chooseSize(p, "10x12", DEMO); S.setElec(p, 2, DEMO);
  const pkBefore = p.items.filter((it) => it.pk).length;
  ok("with an electric package the building is still 'untouched' (the package's fixtures are its own)", S.isStandardLayout(p, DEMO));
  S.chooseSize(p, "14x40", DEMO);
  ok("after a re-lay the package's fixtures are laid again and charged", pkBefore > 0 && p.items.filter((it) => it.pk).length === pkBefore && priceParts(p, DEMO).lines.some((l) => /Electric package 2/.test(l[0])));
  const d = defaults(DEMO); S.chooseType(d, "UT", DEMO);
  const shut = d.items.find((it) => it.cat === "w72"); shut.lite = true;
  ok("a door given a window counts as touched", !S.isStandardLayout(d, DEMO));
}
{
  /* the add rules */
  const s = defaults(DEMO); S.chooseType(s, "DK", DEMO);
  const it = S.addItem(s, "w23", DEMO, 0);
  ok("nothing is added to a kennel's open front (facing the front, the window goes on the back)", it.wall === "B");
  const s2 = defaults(DEMO); S.chooseType(s2, "SC", DEMO);
  ok("a porch post goes on a side-cabin's porch (R)", S.addItem(s2, "ppost", DEMO, 0).wall === "R");
  const s3 = defaults(DEMO); S.chooseType(s3, "UT", DEMO);
  const g = S.addItem(s3, "oct", DEMO, Math.PI);
  ok("a gable window goes on the front gable whatever the camera faces", g.wall === "F" && g.pos === 0);
  const w = S.addAt(s3, "w23", { px: 3.5, pz: -2 }, DEMO);
  ok("'Add here' on open floor puts a wall item on the nearest wall", w.wall === "R");
  const bench = S.addAt(s3, "bench", { px: 1, pz: 2, rot: true }, DEMO);
  ok("'Add here' puts a bench on the floor where the finger was, 4 ft long, turned", bench.wall === "IN" && bench.ln === 4 && bench.rot === true && bench.px === 1 && bench.pz === 2);
  const dup = S.duplicateItem(s3, bench.id, DEMO);
  ok("a duplicated bench is a foot over each way and has no wall position (no NaN)", dup.px === 2 && dup.pz === 3 && dup.pos === undefined);
  const o = S.addItem(s3, "outlet", DEMO, 0);
  S.setItemType(s3, o.id, "ilight", DEMO);
  ok("an outlet turned into an overhead light is lifted off the wall onto the floor", o.wall === "IN" && typeof o.px === "number");
  const pk = S.setItemType(s3, o.id, "PKG1", DEMO);
  ok("picking 'Electric package' on a loose piece lays the whole package and names its switch", s3.elec.pkg === 1 && pk.select && DEMO.CAT[s3.items.find((i) => i.id === pk.select).cat].switch === true && !s3.items.some((i) => i.id === o.id));
  const d36 = S.addItem(s3, "d36in", DEMO, 0);
  S.toggleLite(s3, d36.id, DEMO);
  ok("the steel door's 'window in door' swaps it for its 11-lite twin", d36.cat === "d36lite");
}

/* ======================================================================
   PART 2: the page in a browser */

const servers = [];
async function serve(dir, port, probe) {
  const url = "http://127.0.0.1:" + port + "/" + probe;
  const answers = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await answers()) return;
  const child = spawn("npx", ["http-server", dir, "-p", String(port), "-s", "-c-1", "-a", "127.0.0.1"], { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve " + dir + " on port " + port);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const LAUNCH = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

/* A plugin file that is not written yet is the only thing allowed to be missing. */
const MISSING_PLUGINS = ["views", "blueprint", "quote", "share"].filter((n) => !existsSync(resolve(ROOT, "ui", n + ".js"))).map((n) => "/ui/" + n + ".js");
function isAllowedNoise(m) {
  if (m.type !== "error") return false;
  return /Failed to load resource: the server responded with a status of 404/.test(m.text) && MISSING_PLUGINS.some((p) => (m.url || "").endsWith(p));
}

async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 900, height: 1000 }, reducedMotion: o.motion ? "no-preference" : "reduce", hasTouch: !!o.touch, isMobile: !!o.mobile, deviceScaleFactor: 1 });
  /* nothing leaves this machine -- and the sandbox cannot reach Google's font
     server anyway, so an empty stylesheet stands in for it (Playwright asks
     the routes added LAST first, so the font one goes second) */
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  return ctx;
}
async function openPage(ctx, query, o) {
  o = o || {};
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") noise.push({ type: t, text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  await page.goto(BASE + "/" + (query || ""), { waitUntil: "load" });
  if (o.noWait) return { page, noise };
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
  await page.evaluate(() => { const t = window.shedUI.renderer.test; if (t) { t.dprCap = 1; t.freezeWatchdog = true; } });
  return { page, noise };
}
const realNoise = (noise) => noise.filter((m) => !isAllowedNoise(m));
const stateOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.shedUI.getState())));
const plateOf = (page) => page.evaluate(() => ({ price: document.getElementById("plateprice").textContent, name: document.getElementById("platename").textContent }));
async function settle(page) {
  /* the render loop (which finishes a camera glide) rests while the picture is off screen */
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => !window.shedUI.camera.anim, null, { timeout: 10000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
/* the on-screen middle of an item's tap target (null when none faces the camera) */
async function itemPoint(page, id) {
  return page.evaluate((id) => {
    const api = window.shedUI, r = api.renderer;
    r.draw();
    const pc = r.projCache, rect = api.canvas.getBoundingClientRect();
    const qs = (api.getResult().build.hitQuads || []).filter((q) => q.id === id);
    for (const q of qs) {
      const qc = [(q.pts[0][0] + q.pts[2][0]) / 2, (q.pts[0][1] + q.pts[2][1]) / 2, (q.pts[0][2] + q.pts[2][2]) / 2];
      if (q.n && q.n[0] * (pc.cp[0] - qc[0]) + q.n[1] * (pc.cp[1] - qc[1]) + q.n[2] * (pc.cp[2] - qc[2]) <= 0.1) continue;
      const pj = q.pts.map((p) => pc.proj(p));
      if (pj.some((p) => !p)) continue;
      const x = pj.reduce((a, p) => a + p[0], 0) / 4, y = pj.reduce((a, p) => a + p[1], 0) / 4;
      return { x: rect.left + x, y: rect.top + y, inX: x, inY: y, w: rect.width, h: rect.height };
    }
    return null;
  }, id);
}
async function pixels(page) {
  return page.evaluate(() => {
    const r = window.shedUI.renderer;
    r.draw();
    const p = r.test.readPixels();
    let filled = 0, h = 0x811c9dc5; const cols = new Set();
    for (let i = 0; i < p.data.length; i += 4) {
      if (p.data[i + 3] > 0) { filled++; if ((i >> 2) % 97 === 0) cols.add(p.data[i] >> 4 << 8 | p.data[i + 1] >> 4 << 4 | p.data[i + 2] >> 4); }
      h ^= p.data[i] ^ (p.data[i + 1] << 8) ^ (p.data[i + 2] << 16); h = Math.imul(h, 0x01000193) >>> 0;
    }
    return { w: p.w, h: p.h, filled: filled / (p.w * p.h), colours: cols.size, hash: h };
  });
}

let browser;
try {
  await serve(ROOT, PORT, "index.html");
  browser = await chromium.launch(LAUNCH);

  /* ---------------------------------------------------------------- 2 */
  if (want(2)) section("2. The page loads each company, with no console errors");
  if (want(2)) for (const id of ["demo", "starter"]) {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=" + id);
    const cat = CATS[id];
    const info = await page.evaluate(() => {
      const a = window.shedUI;
      const want = ["getState", "setState", "rebuild", "refresh", "getCatalogue", "on", "select", "getMode", "setMode", "setBuildOptions", "applyDesign", "getDesign", "price", "showAddPop", "hideAddPop", "addAt", "setReadOnly"];
      return {
        missing: want.filter((k) => typeof a[k] !== "function"),
        mounts: ["view-mount", "quote-mount", "share-mount", "bp"].filter((m) => !document.getElementById(m)),
        hasInsideHook: "onInside" in a,
        name: document.getElementById("brand-name").textContent, plateBrand: document.getElementById("plate-brand").textContent, title: document.title,
        catId: a.getCatalogue().id,
      };
    });
    ok(`${id}: loads with no console errors or warnings`, realNoise(noise).length === 0, J(realNoise(noise)));
    ok(`${id}: window.shedUI has the documented API, onInside and the four mount points`, info.missing.length === 0 && info.mounts.length === 0 && info.hasInsideHook, J(info));
    ok(`${id}: the header, the plate and the title carry the company's name`, info.name === cat.brand.name && info.plateBrand === (cat.brand.short || cat.brand.name) && info.title.indexOf(cat.brand.name) === 0 && info.catId === id, J(info));
    const st = await stateOf(page), pl = await plateOf(page);
    ok(`${id}: the first picture is the company's default building, priced by priceParts`, st.type === cat.defaults.type && st.size === cat.defaults.size && pl.price === money(priceParts(st, cat).total), J(pl));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 3 */
  if (want(3)) section("3. Every category, style and size can be picked; the plate always equals priceParts");
  if (want(3)) {
    const ctx = await newContext(browser, { viewport: { width: 1200, height: 800 } });
    const { page, noise } = await openPage(ctx, "?company=demo");
    const cat = DEMO;
    let styles = 0, stylesOk = 0, sizes = 0, sizesBad = [], chipsOn = true;
    for (let ci = 0; ci < cat.CATS.length; ci++) {
      await page.selectOption("#catsel", String(ci));
      const want = S.stylesIn(ci, cat);
      for (let ti = 0; ti < want.length; ti++) {
        await page.click(`#typechips .chip:nth-child(${ti + 1})`);
        styles++;
        const st = await stateOf(page), pl = await plateOf(page);
        const on = await page.evaluate(() => Array.from(document.querySelectorAll("#typechips .chip.on")).length);
        if (st.type === want[ti] && on === 1 && pl.price === money(priceParts(st, cat).total) && pl.name === st.size.replace("x", " × ") + " " + cat.TYPES[st.type].name) stylesOk++;
        /* every size of this style, clicked in the page */
        const res = await page.evaluate(() => {
          const out = [];
          const chips = () => Array.from(document.querySelectorAll("#sizechips .chip"));
          const n = chips().length;
          for (let i = 0; i < n; i++) {
            const c = chips()[i], sz = c.getAttribute("data-size");
            c.click();
            const now = chips();
            out.push({ sz, on: now[i].classList.contains("on") && now.filter((b) => b.classList.contains("on")).length === 1, state: JSON.parse(JSON.stringify(window.shedUI.getState())), plate: document.getElementById("plateprice").textContent });
          }
          return out;
        });
        if (J(res.map((r) => r.sz)) !== J(pSizes(want[ti], cat))) sizesBad.push(want[ti] + ": size chips " + res.map((r) => r.sz).join(","));
        for (const r of res) {
          sizes++;
          if (!r.on) chipsOn = false;
          const pp = priceParts(r.state, cat);
          if (r.state.size !== r.sz || r.plate !== money(pp.total)) sizesBad.push(`${want[ti]} ${r.sz}: plate ${r.plate}, priceParts ${money(pp.total)}`);
        }
      }
    }
    ok(`every style chip (${styles}, real clicks through every category) is picked and the plate equals priceParts`, stylesOk === styles && styles === Object.keys(cat.TYPES).length, `${stylesOk}/${styles}`);
    ok(`every size chip of every style (${sizes}) is picked and the plate equals priceParts`, sizesBad.length === 0 && sizes === Object.keys(cat.P).reduce((a, t) => a + pSizes(t, cat).length, 0), sizesBad.slice(0, 10).join("\n       "));
    ok("the chip picked is the one lit, and only that one", chipsOn);
    /* options and extras price through the same function */
    await page.selectOption("#catsel", "0"); await page.click("#typechips .chip:nth-child(1)");
    await page.click("#opt-jo12"); await page.click("#rampchips .chip:nth-child(2)"); await page.click("#elecchips .chip:nth-child(3)");
    const st = await stateOf(page), pl = await plateOf(page);
    ok("an upgrade, a ramp and an electric package are charged as priceParts charges them", st.opts.jo12 === true && st.ramp !== "none" && st.elec.pkg === 2 && pl.price === money(priceParts(st, cat).total), J(pl));
    const lbl = await page.evaluate(() => document.getElementById("opr-jo12").textContent);
    const lineAmt = priceParts(st, cat).lines.find((l) => l[2] === "rate.jo12");
    ok("an upgrade's button shows the same money as its quote line", lineAmt && lbl === "+ " + money(lineAmt[1]), lbl + " vs " + J(lineAmt));
    ok("no console errors while picking", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 4 */
  if (want(4)) section("4. Colours, and the picture");
  if (want(4)) {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=demo");
    const px0 = await pixels(page);
    ok(`the canvas is not blank (${Math.round(px0.filled * 100)}% of it drawn, ${px0.colours} colours)`, px0.filled > 0.2 && px0.colours > 20, J(px0));
    const rows = [["sw-body", "body", "nm-body", "paint"], ["sw-trim", "trim", "nm-trim", "trim"], ["sw-roof", "roof", "nm-roof", "metal"], ["sw-door", "doorC", "nm-doorC", "paint"], ["sw-shut", "shutC", "nm-shutC", "paint"]];
    let last = px0.hash;
    for (const [host, key, nameId, pal] of rows) {
      const before = (await stateOf(page))[key];
      const idx = await page.evaluate(([host, cur]) => { const b = Array.from(document.querySelectorAll("#" + host + " .sw")); return b.findIndex((x) => !x.classList.contains("on")); }, [host, before]);
      await page.click(`#${host} .sw:nth-child(${idx + 1})`);
      const st = await stateOf(page);
      const want = DEMO.COLORS[pal][idx];
      const nm = await page.evaluate((id) => document.getElementById(id).textContent, nameId);
      const on = await page.evaluate((h) => document.querySelectorAll("#" + h + " .sw.on").length, host);
      const px = await pixels(page);
      const moved = px.hash !== last; last = px.hash;
      ok(`${key}: picking ${want[0]} sets the design, lights one swatch and shows its name` + (key === "shutC" ? "" : ", and the picture changes"), st[key] === want[1] && nm === want[0] && on === 1 && (key === "shutC" || moved), J({ got: st[key], want, nm, on, moved }));
    }
    ok("no console errors while colouring", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 5 */
  if (want(5)) section("5. Every door, window, roll-up, light and post: add, pick its kind, tap, drag, remove");
  if (want(5)) {
    const ctx = await newContext(browser, { viewport: { width: 900, height: 1000 } });
    const { page, noise } = await openPage(ctx, "?company=demo");
    const cat = DEMO;
    await page.evaluate(() => window.shedUI.setState((s) => { }, { reason: "test" }));
    /* a big plain building with room on every wall */
    await page.selectOption("#catsel", String(S.catOfType("UT", cat)));
    await page.click(`#typechips .chip:nth-child(${S.stylesIn(S.catOfType("UT", cat), cat).indexOf("UT") + 1})`);
    await page.click('#sizechips .chip[data-size="14x40"]');
    /* face the long right-hand wall, which is bare: every door goes there
       (the 14 ft front already has its 72 in doors, and a second big door
       has no room beside them -- clampPos rightly pins it) */
    await page.evaluate(() => window.shedUI.animYaw(Math.PI / 2, 0.26));
    await settle(page);
    const kinds = [];
    for (const k of S.listOf(cat, "sheetDoor")) kinds.push({ k, button: "#add-door" });
    for (const k of S.listOf(cat, "sheetWindow")) kinds.push({ k, button: "#add-win" });
    kinds.push({ k: "light", button: "#add-light" });
    async function tapSelect(id) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      const pt = await itemPoint(page, id);
      if (!pt) return { ok: false, why: "no tap target faces the camera" };
      const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id; }, [pt.x, pt.y]);
      if (top !== "c3d") return { ok: false, why: "something covers the item: " + top };
      await page.mouse.click(pt.x, pt.y);
      const st = await stateOf(page);
      const open = await page.evaluate(() => document.getElementById("sheet").classList.contains("open"));
      return { ok: st.sel === id && open, why: J({ sel: st.sel, open }) };
    }
    async function dragIt(id) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle(page);
      const before = (await stateOf(page)).items.find((i) => i.id === id);
      for (const dir of [1, -1]) {
        const pt = await itemPoint(page, id);
        if (!pt) return { ok: false, why: "no tap target" };
        await page.mouse.move(pt.x, pt.y);
        await page.mouse.down();
        for (let s = 1; s <= 6; s++) await page.mouse.move(pt.x + dir * 12 * s, pt.y - (cat.CAT[before.cat].gable ? 4 * s : 0));
        await page.mouse.up();
        const st = await stateOf(page);
        const now = st.items.find((i) => i.id === id);
        if (Math.abs((now.pos || 0) - (before.pos || 0)) > 0.05 || Math.abs((now.vy || 0) - (before.vy || 0)) > 0.05) {
          /* its new place is legal: clampPos (in Node) leaves it where it is */
          const probe = copy(st); const pi = probe.items.find((i) => i.id === id);
          clampPos(pi, probe, frameOf(probe, cat));
          const legal = Math.abs(pi.pos - now.pos) < 1e-6 && Math.abs((pi.vy || 0) - (now.vy || 0)) < 1e-6;
          return { ok: legal && st.sel === id, why: J({ before: [before.pos, before.vy], now: [now.pos, now.vy], clamped: [pi.pos, pi.vy], sel: st.sel }) };
        }
      }
      return { ok: false, why: "it did not move either way" };
    }
    for (const { k, button } of kinds) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click(button);
      let st = await stateOf(page);
      let id = st.sel;
      const selOk = await page.$eval("#sh-type", (s, k) => Array.from(s.options).some((o) => o.value === k), k).catch(() => false);
      if (selOk && st.items.find((i) => i.id === id).cat !== k) await page.selectOption("#sh-type", k);
      st = await stateOf(page);
      const it = st.items.find((i) => i.id === id);
      const kindOk = ok(`${k}: added and turned into a ${cat.CAT[k].n} from the sheet`, it && it.cat === k && st.sel === id, J({ it, sel: st.sel }));
      if (!kindOk) continue;
      await page.click("#sh-done");
      const off = await stateOf(page);
      const t = await tapSelect(id);
      const d = t.ok ? await dragIt(id) : { ok: false, why: "not selected" };
      await page.evaluate(() => window.scrollTo(0, 0));
      if ((await stateOf(page)).sel !== id) await page.click(`#itemlist .itemrow[data-id="${id}"]`);
      await page.click("#sh-del");
      const gone = await stateOf(page);
      ok(`${k}: put down, tapped on the 3D picture to select it, dragged to a legal place, removed`,
        off.sel === null && t.ok && d.ok && !gone.items.some((i) => i.id === id) && gone.sel === null, J({ tap: t.why, drag: d.why }));
    }
    /* the sheet's switches */
    await page.click("#add-win");
    let st = await stateOf(page); let id = st.sel;
    await page.click("#sh-shut"); await page.click("#sh-dbl");
    st = await stateOf(page);
    let it = st.items.find((i) => i.id === id);
    const sum = await page.evaluate(() => document.getElementById("sum").textContent);
    ok("a window's shutters and double window switch on from the sheet and are charged", it.shut && it.dbl && /Shutters × 1 set/.test(sum) && (await plateOf(page)).price === money(priceParts(st, cat).total), sum);
    await page.click("#sh-shutc .sw:nth-child(3)");
    st = await stateOf(page);
    ok("the shutter colour is picked on the sheet and named there", st.shutC === cat.COLORS.paint[1][1] && (await page.evaluate(() => document.getElementById("nm-sh-shutc").textContent)) === cat.COLORS.paint[1][0]);
    await page.click("#sh-del");
    await page.click("#add-door");
    st = await stateOf(page); id = st.sel;
    if (st.items.find((i) => i.id === id).cat !== "w48") await page.selectOption("#sh-type", "w48");
    await page.click("#sh-lite"); await page.click("#sh-doorc .sw:nth-child(2)");
    st = await stateOf(page); it = st.items.find((i) => i.id === id);
    ok("a wooden door takes a window and a door colour from the sheet", it.lite === true && st.doorC === cat.COLORS.paint[0][1] && /Door window × 1/.test(await page.evaluate(() => document.getElementById("sum").textContent)));
    await page.click('#sh-walls button:nth-child(2)');
    st = await stateOf(page);
    ok("the wall chips jump a door to the back wall", st.items.find((i) => i.id === id).wall === "B");
    await page.selectOption("#sh-type", "d36in"); await page.click("#sh-lite");
    st = await stateOf(page);
    ok("the steel door's 'window in door' swaps it for the 11-lite door", st.items.find((i) => i.id === id).cat === "d36lite");
    await page.click("#sh-dup");
    const st2 = await stateOf(page);
    ok("Duplicate adds a copy, selected, not included", st2.items.length === st.items.length + 1 && st2.sel !== id && st2.items.find((i) => i.id === st2.sel).inc === false);
    await page.click("#sh-del");
    /* inside: bench and shelf (no 3D tap target: picked from the list) */
    for (const k of ["bench", "shelf"]) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.click("#add-" + k);
      let s = await stateOf(page); const bid = s.sel;
      await page.click("#sh-len-p"); await page.click("#sh-len-p"); await page.click("#sh-rot");
      s = await stateOf(page);
      const b = s.items.find((i) => i.id === bid);
      const lenTxt = await page.evaluate(() => document.getElementById("sh-lenv").textContent);
      await page.click("#sh-del");
      const g = await stateOf(page);
      ok(`${k}: added, made 6 ft and turned from the sheet, charged by the foot, removed`, b && b.cat === k && b.ln === 6 && b.rot === true && lenTxt === "6 ft" && !g.items.some((i) => i.id === bid), J(b));
    }
    ok("no console errors while adding, tapping, dragging and removing", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }
  if (want(5)) {
    /* a porch post, on a building with a porch */
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=demo");
    await page.evaluate(() => window.shedUI.setState((s) => {}, {}));
    await page.selectOption("#catsel", String(S.catOfType("SC", DEMO)));
    await page.click(`#typechips .chip:nth-child(${S.stylesIn(S.catOfType("SC", DEMO), DEMO).indexOf("SC") + 1})`);
    const vis = await page.evaluate(() => getComputedStyle(document.getElementById("add-post")).display !== "none");
    await page.click("#add-post");
    const st = await stateOf(page);
    const it = st.items.find((i) => i.id === st.sel);
    await page.click("#sh-done");
    await settle(page);
    const pt = await itemPoint(page, it.id);
    let tapped = false;
    if (pt) { await page.mouse.click(pt.x, pt.y); tapped = (await stateOf(page)).sel === it.id; }
    await page.click("#sh-del");
    ok("a porch post: the button shows on a porch building, it goes on the porch, it can be tapped and removed", vis && it.cat === "ppost" && it.wall === "R" && tapped && !(await stateOf(page)).items.some((i) => i.id === it.id), J({ vis, it, pt }));
    ok("no console errors with a porch post", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 6 */
  if (want(6)) section("6. Press and hold: the 'Add here' menu");
  if (want(6)) {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=demo");
    await page.selectOption("#catsel", String(S.catOfType("UT", DEMO)));
    await page.click(`#typechips .chip:nth-child(${S.stylesIn(S.catOfType("UT", DEMO), DEMO).indexOf("UT") + 1})`);
    await page.click('#sizechips .chip[data-size="14x24"]');
    await page.evaluate(() => window.shedUI.animYaw(0, 0.26));
    await settle(page);
    /* a bare spot on the front wall, left of the 72 in door */
    const spot = await page.evaluate(() => {
      const api = window.shedUI, r = api.renderer; r.draw();
      const plan = api.getPlan(), w = plan.ws.F, u = -plan.d.W / 2 + 1.6;
      const p = { F: w };
      const at = w.cx + w.ax[0] * u;
      const pt = r.projCache.proj([at, 0.92 + 3.4, w.at + 0.12]);
      const rect = api.canvas.getBoundingClientRect();
      return { x: rect.left + pt[0], y: rect.top + pt[1], u, top: document.elementFromPoint(rect.left + pt[0], rect.top + pt[1]).id };
    });
    const n0 = (await stateOf(page)).items.length;
    await page.mouse.move(spot.x, spot.y);
    await page.mouse.down();
    await sleep(750);
    const openHeld = await page.evaluate(() => ({ open: document.getElementById("addpop").classList.contains("open"), labels: Array.from(document.querySelectorAll("#addpop button")).map((b) => b.textContent) }));
    await page.mouse.up();
    const afterUp = await page.evaluate(() => ({ open: document.getElementById("addpop").classList.contains("open"), sel: window.shedUI.getState().sel }));
    ok("holding a bare wall for half a second opens 'Add here': door, window, electrical, cancel", openHeld.open && J(openHeld.labels) === J(["+ Door", "+ Window", "+ Electrical", "Cancel"]), J({ spot, openHeld }));
    ok("lifting the finger leaves the menu open and selects nothing", afterUp.open && afterUp.sel === null, J(afterUp));
    await page.click('#addpop button[data-cat="w23"]');
    const st = await stateOf(page);
    const it = st.items.find((i) => i.id === st.sel);
    ok("'+ Window' puts a window on that wall, near where the finger was, and selects it", st.items.length === n0 + 1 && it && it.cat === "w23" && it.wall === "F" && Math.abs(it.pos - spot.u) < 1.2, J({ it, u: spot.u }));
    await page.click("#sh-done");
    const box = await page.evaluate(() => { const r = document.getElementById("stage").getBoundingClientRect(); return { x: r.left + 30, y: r.top + 60 }; });
    await page.mouse.move(box.x, box.y); await page.mouse.down(); await sleep(750); await page.mouse.up();
    const sky = await page.evaluate(() => document.getElementById("addpop").classList.contains("open"));
    ok("holding the sky opens nothing", !sky);
    /* the floor-plan version, through the API */
    const bench = await page.evaluate(() => { const it = window.shedUI.addAt("bench", { px: 1, pz: -2, rot: true }); return it && { cat: it.cat, wall: it.wall, px: it.px, pz: it.pz, rot: it.rot, sel: window.shedUI.getState().sel === it.id }; });
    ok("api.addAt puts a bench on the floor where asked and selects it (the floor plan uses this)", bench && bench.cat === "bench" && bench.wall === "IN" && bench.px === 1 && bench.pz === -2 && bench.rot && bench.sel, J(bench));
    ok("no console errors around the menu", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 7 */
  if (want(7)) section("7. The Inside button, the mode, the events, a shared link, read-only");
  if (want(7)) {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=demo");
    const r = await page.evaluate(async () => {
      const api = window.shedUI, calls = [], ev = { change: 0, select: 0, rebuild: 0, mode: 0 };
      api.onInside = (req) => calls.push(req);
      for (const k of Object.keys(ev)) api.on(k, () => { ev[k]++; });
      document.getElementById("modebar").click();
      Array.from(document.querySelectorAll("#elecchips .chip"))[1].click();
      api.setMode("in");
      const inMode = { cls: document.getElementById("stage").classList.contains("bpmode"), bp: getComputedStyle(document.getElementById("bp")).display, label: document.getElementById("modebar").textContent };
      api.setMode("out");
      const outMode = { cls: document.getElementById("stage").classList.contains("bpmode"), bp: getComputedStyle(document.getElementById("bp")).display };
      const item = api.getState().items.find((i) => !i.pk);
      api.select(item.id); api.select(null);
      /* a shared design goes back in */
      const d = api.getDesign();
      d.type = "UT"; d.size = "10x12"; delete d.items;
      const warnings = api.applyDesign(d);
      const after = { type: api.getState().type, size: api.getState().size, n: api.getState().items.filter((i) => !i.pk).length, pk: api.getState().items.filter((i) => i.pk).length, plate: document.getElementById("platename").textContent };
      api.setReadOnly(true);
      api.select(api.getState().items[0].id);
      const ro = { sel: api.getState().sel, cls: document.body.classList.contains("viewonly") };
      api.setReadOnly(false);
      return { calls, ev, inMode, outMode, warnings, after, ro };
    });
    ok("the Inside button calls window.shedUI.onInside({want: 'toggle'})", r.calls[0] && r.calls[0].want === "toggle" && r.calls[0].reason === "button", J(r.calls));
    ok("choosing an electric package asks for the Inside view ({want: 'in'})", r.calls[1] && r.calls[1].want === "in", J(r.calls));
    ok("setMode('in') shows the floor-plan canvas and relabels the button; 'out' puts it back", r.inMode.cls && r.inMode.bp === "block" && /Outside/.test(r.inMode.label) && !r.outMode.cls && r.outMode.bp === "none", J(r));
    ok("'change', 'select', 'rebuild' and 'mode' events fire", r.ev.change > 0 && r.ev.select >= 2 && r.ev.rebuild > 0 && r.ev.mode === 2, J(r.ev));
    ok("applyDesign opens a saved design (the standard doors when it has none, the package it had) with no warnings", r.after.type === "UT" && r.after.size === "10x12" && r.after.n === 1 && r.after.pk > 0 && r.warnings.length === 0 && /10 × 12/.test(r.after.plate), J(r));
    ok("a read-only page selects nothing and hides the cards", r.ro.sel === null && r.ro.cls, J(r.ro));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
    /* a #d= link is applied before the first picture */
    const c2 = await newContext(browser);
    const { encode } = await import("../model/design.js");
    const design = { v: 1, company: "demo", cfg: DEMO.cfg, type: "G", size: "12x24", colors: { body: "Barn Red", trim: "White", roof: "Galvalume" } };
    const link = await encode(design);
    const { page: p2, noise: n2 } = await openPage(c2, "?company=demo#d=" + link);
    const s2 = await stateOf(p2);
    const sw = await p2.evaluate(() => ({ w: window.shedUI.startWarnings, e: window.shedUI.startError, d: !!window.shedUI.startDesign }));
    ok("a shared link (#d=...) is opened before the first picture: its style, size and colours", s2.type === "G" && s2.size === "12x24" && s2.body === DEMO.COLORS.paint.find((c) => c[0] === "Barn Red")[1] && sw.d && sw.e === null, J({ type: s2.type, size: s2.size, sw }));
    ok("no console errors opening a link", realNoise(n2).length === 0, J(realNoise(n2)));
    await c2.close();
  }

  /* ---------------------------------------------------------------- 8 */
  if (want(8)) section("8. Changing size in the page (DIFFERENCES #12)");
  if (want(8)) {
    const ctx = await newContext(browser);
    const { page, noise } = await openPage(ctx, "?company=demo");
    await page.selectOption("#catsel", String(S.catOfType("CS", DEMO)));
    await page.click(`#typechips .chip:nth-child(${S.stylesIn(S.catOfType("CS", DEMO), DEMO).indexOf("CS") + 1})`);
    await page.click('#sizechips .chip[data-size="10x12"]');
    const a = (await stateOf(page)).items.map((i) => i.cat);
    await page.click('#sizechips .chip[data-size="10x16"]');
    const b = await stateOf(page);
    ok("a Cottage at 10x12 (46 in door) clicked to 10x16 gets its 70 in doubles", a.includes("w48") && b.items.some((i) => i.cat === "w72") && !b.items.some((i) => i.cat === "w48"), J({ a, b: b.items.map((i) => i.cat) }));
    const door = b.items.find((i) => i.cat === "w72");
    await page.click(`#itemlist .itemrow[data-id="${door.id}"]`);
    await page.click('#sh-walls button:nth-child(2)');          /* the customer moves it to the back */
    await page.click("#sh-done");
    await page.click('#sizechips .chip[data-size="10x20"]');
    const c = await stateOf(page);
    ok("after the customer moves the door, the next size change keeps it where they put it", c.items.length === b.items.length && c.items.find((i) => i.id === door.id && i.wall === "B"), J(c.items));
    ok("the plate follows (priceParts)", (await plateOf(page)).price === money(priceParts(c, DEMO).total));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ---------------------------------------------------------------- 9 */
  if (want(9)) section("9. The opening turn and reduced motion");
  if (want(9)) {
    const c1 = await newContext(browser, { motion: true });
    const { page: p1 } = await openPage(c1, "?company=demo");
    const y1 = await p1.evaluate(() => window.shedUI.camera.yaw); await sleep(1500);
    const y2 = await p1.evaluate(() => window.shedUI.camera.yaw);
    ok("a visitor sees the building turn by itself", Math.abs(y2 - y1) > 0.01, `${y1} -> ${y2}`);
    await c1.close();
    const c2 = await newContext(browser);
    const { page: p2 } = await openPage(c2, "?company=demo");
    const z1 = await p2.evaluate(() => window.shedUI.camera.yaw); await sleep(1500);
    const z2 = await p2.evaluate(() => ({ yaw: window.shedUI.camera.yaw, spin: window.shedUI.camera.autoSpin }));
    ok("a visitor who prefers reduced motion does not", z2.yaw === z1 && z2.spin === false, J({ z1, z2 }));
    await c2.close();
  }

  /* ---------------------------------------------------------------- 10 */
  if (want(10)) section("10. Layout: phones, desktops, iPads");
  if (want(10)) {
    const shapes = [[390, 844, "phone"], [1440, 900, "desktop"], [1180, 820, "iPad landscape"], [820, 1180, "iPad upright"], [1024, 1366, "iPad Pro upright"], [320, 640, "small phone"]];
    for (const [w, h, what] of shapes) {
      const ctx = await newContext(browser, { viewport: { width: w, height: h } });
      const { page, noise } = await openPage(ctx, "?company=demo");
      const lay = async () => page.evaluate(() => {
        const de = document.documentElement, r = (id) => document.getElementById(id).getBoundingClientRect();
        const sw = document.querySelector(".stagewrap").getBoundingClientRect(), wr = r("wrap"), mb = r("modebar"), sh = r("sheet");
        return { scrollW: de.scrollWidth, clientW: de.clientWidth, twoCol: wr.left >= sw.right - 1 && wr.top < sw.bottom, stageW: sw.width, mbBottom: mb.bottom, mbTop: mb.top, vh: innerHeight, sheetBottom: sh.bottom, sheetOpen: document.getElementById("sheet").classList.contains("open") };
      });
      const shut = await lay();
      await page.click("#itemlist .itemrow");
      const open = await lay();
      const wantTwo = w >= 940 && w >= h;
      ok(`${what} ${w}x${h}: no sideways scroll, sheet shut or open`, shut.scrollW <= shut.clientW && open.scrollW <= open.clientW && open.sheetOpen, J({ shut, open }));
      ok(`${what} ${w}x${h}: ${wantTwo ? "two columns" : "stacked"}`, shut.twoCol === wantTwo, J(shut));
      if (wantTwo) ok(`${what} ${w}x${h}: the Inside button is fully on screen and the open sheet stops above it`, shut.mbBottom <= shut.vh + 0.5 && open.sheetBottom <= open.mbTop, J(open));
      ok(`${what}: no console errors`, realNoise(noise).length === 0, J(realNoise(noise)));
      await ctx.close();
    }
  }

  /* ---------------------------------------------------------------- 11 */
  if (want(11)) section("11. A company whose words contain HTML: shown as text, never run");
  if (want(11)) {
    const EVIL = `<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>`;
    const co = readJSON("companies/starter/company.json");
    co.id = "xss-test";
    co.brand.name = "Acme " + EVIL; co.brand.short = "Short" + EVIL; co.brand.initials = "<b>"; co.brand.tagline = EVIL;
    co.brand.credit = { text: "Credit " + EVIL, url: "javascript:window.__pwned=3", show: true };
    co.brand.logo = "javascript:window.__pwned=4";
    co.offer.UT.name = "Utility " + EVIL;
    co.categories = [["Sheds " + EVIL, ["UT", "LB"]], ["Garages", ["G"]]];
    co.palettes.paint[0] = ["Cream " + EVIL, "#EFE7D2"];
    co.defaults.colors.body = "Cream " + EVIL;
    co.options.extras.push({ key: "evil", name: "Extra " + EVIL, input: "check", price: 5 });
    co.notes.finePrint = "Fine " + EVIL; co.notes.sizeNotes = { "12": "Note " + EVIL };
    co.items.w23 = { price: 210, name: "Window " + EVIL };
    const ctx = await newContext(browser);
    await ctx.route(/\/companies\/xss-test\/company\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(co) }));
    const { page, noise } = await openPage(ctx, "?company=xss-test");
    await page.selectOption("#catsel", "0");
    await page.click("#typechips .chip:nth-child(1)");                 /* the renamed Utility */
    await page.click('#sizechips .chip[data-size="12x16"]');
    await page.click("#add-win");
    await page.click("#sw-body .sw:nth-child(1)");
    const r = await page.evaluate((EVIL) => ({
      pwned: window.__pwned,
      scripts: document.querySelectorAll("script").length,
      imgs: Array.from(document.querySelectorAll("img")).map((i) => i.getAttribute("src")),
      onerr: document.querySelectorAll("[onerror]").length,
      jsLinks: Array.from(document.querySelectorAll("a")).filter((a) => /^javascript:/i.test(a.getAttribute("href") || "")).length,
      name: document.getElementById("brand-name").textContent,
      plateBrand: document.getElementById("plate-brand").textContent,
      chip: document.querySelector("#typechips .chip").textContent,
      cat: document.querySelector("#catsel option").textContent,
      colour: document.getElementById("nm-body").textContent,
      fine: document.getElementById("fineprint").textContent,
      note: document.getElementById("sizenote").textContent,
      credit: document.getElementById("credit").textContent,
      extra: document.getElementById("xoptrows").textContent,
      list: document.getElementById("itemlist").textContent,
      sum: document.getElementById("sum").textContent,
      plate: document.getElementById("platename").textContent,
      badge: document.getElementById("brand-badge").textContent,
    }), EVIL);
    const pageScripts = (readFileSync(resolve(ROOT, "index.html"), "utf8").match(/<script\b/g) || []).length;
    ok("nothing in the company's words ran (no script, no onerror, no javascript: link or picture)", r.pwned === undefined && r.onerr === 0 && r.jsLinks === 0 && r.imgs.length === 0 && r.scripts === pageScripts, J(r));
    ok("the header, plate, style chip, category, colour name, extra, fine print, size note, credit, item list and summary show the characters as text",
      r.name === "Acme " + EVIL && r.plateBrand === "Short" + EVIL && r.chip.indexOf("Utility " + EVIL) === 0 && r.cat === "Sheds " + EVIL && r.colour === "Cream " + EVIL &&
      r.extra.indexOf("Extra " + EVIL) >= 0 && r.fine === "Fine " + EVIL && r.note === "Note " + EVIL && r.credit === "Credit " + EVIL && r.list.indexOf("Window " + EVIL) >= 0 &&
      r.sum.indexOf("Utility " + EVIL) >= 0 && r.plate.indexOf("Utility " + EVIL) >= 0 && r.badge === "<B>", J(r));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
    /* a settings mistake: the problems in plain words, not a half-working designer */
    const bad = readJSON("companies/starter/company.json");
    bad.id = "broken-test"; bad.offer.UT.sizes["10x12"] = "lots"; bad.brand.name = "Broken " + EVIL;
    const c3 = await newContext(browser);
    await c3.route(/\/companies\/broken-test\/company\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(bad) }));
    const { page: p3, noise: n3 } = await openPage(c3, "?company=broken-test", { noWait: true });
    await p3.waitForSelector("#bootmsg", { timeout: 30000 });
    const b3 = await p3.evaluate(() => ({ text: document.getElementById("bootmsg").textContent, items: document.querySelectorAll("#bootmsg li").length, api: !!window.shedUI, layout: getComputedStyle(document.getElementById("layout")).display, pwned: window.__pwned }));
    ok("a company file with a mistake shows its problems in plain words (and nothing else)", b3.items >= 1 && /UT/.test(b3.text) && /10x12/.test(b3.text) && !b3.api && b3.layout === "none" && b3.pwned === undefined, J(b3));
    ok("... and says so in the console too", realNoise(n3).some((m) => /problem/.test(m.text)), J(realNoise(n3)));
    await c3.close();
    /* a suspended company */
    const sus = readJSON("companies/starter/company.json");
    sus.id = "paused-test"; sus.status = "suspended";
    const c4 = await newContext(browser);
    await c4.route(/\/companies\/paused-test\/company\.json/, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sus) }));
    const { page: p4, noise: n4 } = await openPage(c4, "?company=paused-test", { noWait: true });
    await p4.waitForSelector("#bootmsg", { timeout: 30000 });
    const b4 = await p4.evaluate(() => ({ text: document.getElementById("bootmsg").textContent, tel: (document.querySelector("#bootmsg a") || {}).href, api: !!window.shedUI }));
    ok("a suspended company shows 'This designer is not available' with a tap-to-call number", /not available/.test(b4.text) && /\(555\) 010-0142/.test(b4.text) && b4.tel === "tel:5550100142" && !b4.api && realNoise(n4).length === 0, J({ b4, noise: realNoise(n4) }));
    await c4.close();
  }

  /* ---------------------------------------------------------------- 12 */
  if (want(12)) section("12. Parts not finished yet do not break the page");
  if (want(12)) {
    /* the stand-ins keep every other export of the real file (other parts
       import helpers from it) and replace only the part itself */
    const stub = `export * from "./roofing.js?real=1"; import real from "./roofing.js?real=1";
      export default Object.assign({}, real, { pending: true, build() {} });`;
    const ctx = await newContext(browser);
    await ctx.route(/\/parts\/roofing\.js$/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: stub }));
    const { page, noise } = await openPage(ctx, "?company=demo");
    const px = await pixels(page);
    await page.click('#sizechips .chip[data-size="12x24"]');
    const st = await stateOf(page);
    const note = await page.evaluate(() => document.getElementById("stagenote").hidden);
    ok("with the roofing still a stub: a partial building is drawn, prices and chips work, no error", px.filled > 0.1 && st.size === "12x24" && (await plateOf(page)).price === money(priceParts(st, DEMO).total) && note && realNoise(noise).length === 0, J({ px, noise: realNoise(noise) }));
    await ctx.close();
    const broken = `export * from "./gable-vent.js?real=1"; import real from "./gable-vent.js?real=1";
      export default Object.assign({}, real, { build() { throw new Error("test: this part is broken"); } });`;
    const c2 = await newContext(browser);
    await c2.route(/\/parts\/gable-vent\.js$/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: broken }));
    const { page: p2, noise: n2 } = await openPage(c2, "?company=demo");
    await p2.click('#sizechips .chip[data-size="12x24"]');
    await p2.click("#sw-body .sw:nth-child(3)");
    const s2 = await stateOf(p2);
    const r2 = await p2.evaluate(() => ({ note: !document.getElementById("stagenote").hidden, text: document.getElementById("stagenote").textContent }));
    const said = realNoise(n2).filter((m) => /could not be drawn/.test(m.text));
    ok("with a part that throws: the cards, prices and colours still work and the picture says so", s2.size === "12x24" && (await plateOf(p2)).price === money(priceParts(s2, DEMO).total) && r2.note && said.length >= 1 && realNoise(n2).every((m) => /could not be drawn|test: this part is broken/.test(m.text)), J({ r2, noise: realNoise(n2) }));
    await c2.close();
  }

  /* ---------------------------------------------------------------- 13 */
  if (want(13)) section("13. Embedded on a company's page, the /c/<company>/ address, and the 'show prices' setting");
  if (want(13)) {
    /* a phone, embedded: no header; "Tap to design" until tapped */
    const c1 = await newContext(browser, { viewport: { width: 390, height: 700 }, touch: true, mobile: true });
    const { page: p1, noise: n1 } = await openPage(c1, "?company=starter&embed=1");
    const e1 = await p1.evaluate(() => ({ hdr: getComputedStyle(document.getElementById("hdr")).display, cover: !!document.getElementById("tapcover"), emb: window.shedUI.embedded, touchAction: getComputedStyle(document.getElementById("tapcover")).touchAction }));
    await p1.tap("#tapcover");
    const e1b = await p1.evaluate(() => !!document.getElementById("tapcover"));
    ok("embedded on a phone: no header bar, and a 'Tap to design' cover (a finger scrolls the page past it) until tapped", e1.hdr === "none" && e1.cover && e1.emb && e1.touchAction === "pan-y" && !e1b, J({ e1, e1b }));
    ok("embedded on a phone: no console errors", realNoise(n1).length === 0, J(realNoise(n1)));
    await c1.close();
    /* a desktop, embedded: the mouse wheel scrolls the page unless Ctrl is held or the picture was clicked */
    const c2 = await newContext(browser, { viewport: { width: 1200, height: 800 } });
    const { page: p2 } = await openPage(c2, "?company=demo&embed=1");
    const box = await p2.evaluate(() => { const r = document.getElementById("c3d").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 }; });
    const d0 = await p2.evaluate(() => window.shedUI.camera.dist);
    await p2.mouse.move(box.x, box.y); await p2.mouse.wheel(0, 200); await sleep(150);
    const d1 = await p2.evaluate(() => window.shedUI.camera.dist);
    await p2.keyboard.down("Control"); await p2.mouse.wheel(0, 200); await p2.keyboard.up("Control"); await sleep(150);
    const d2 = await p2.evaluate(() => window.shedUI.camera.dist);
    ok("embedded on a desktop: the wheel does not zoom on its own, it does with Ctrl held", d1 === d0 && d2 > d1, J({ d0, d1, d2 }));
    await c2.close();
    /* not embedded: the wheel zooms as in Barnwright */
    const c3 = await newContext(browser, { viewport: { width: 1200, height: 800 } });
    const { page: p3 } = await openPage(c3, "?company=demo");
    const b3 = await p3.evaluate(() => { const r = document.getElementById("c3d").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40 }; });
    const z0 = await p3.evaluate(() => window.shedUI.camera.dist);
    await p3.mouse.move(b3.x, b3.y); await p3.mouse.wheel(0, 200); await sleep(150);
    const z1 = await p3.evaluate(() => window.shedUI.camera.dist);
    ok("on the designer's own page the wheel zooms (Barnwright's 1.2 thousandths a unit)", z1 > z0, J({ z0, z1 }));
    await c3.close();
    /* /c/<company>/ -- what embed.js opens; a rewrite to index.html on the host */
    const c4 = await newContext(browser);
    const html = readFileSync(resolve(ROOT, "index.html"), "utf8");
    await c4.route(/\/c\/starter\/(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: "text/html", body: html }));
    const pg4 = await c4.newPage();
    const n4 = [];
    pg4.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") n4.push({ type: m.type(), text: m.text(), url: (m.location() || {}).url }); });
    await pg4.goto(BASE + "/c/starter/?embed=1");
    await pg4.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
    const c4r = await pg4.evaluate(() => ({ id: window.shedUI.getCatalogue().id, css: getComputedStyle(document.querySelector(".stage")).position }));
    ok("under /c/starter/ the page finds its files and loads the starter company", c4r.id === "starter" && c4r.css === "relative" && realNoise(n4).length === 0, J({ c4r, n4: realNoise(n4) }));
    await c4.close();
    /* pricing.show "none" and "from" */
    for (const mode of ["none", "from"]) {
      const co = readJSON("companies/starter/company.json");
      co.id = "prices-" + mode; co.pricing.show = mode;
      const c5 = await newContext(browser);
      await c5.route(new RegExp("/companies/prices-" + mode + "/company\\.json"), (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(co) }));
      const { page: p5, noise: n5 } = await openPage(c5, "?company=prices-" + mode);
      await p5.click("#itemlist .itemrow");
      const t5 = await p5.evaluate(() => ({ cards: Array.from(document.querySelectorAll("#wrap .card")).map((c) => c.textContent).join(" "), plate: document.getElementById("plateprice").textContent, sheet: document.getElementById("sheet").textContent, sel: Array.from(document.querySelectorAll("#sh-type option")).map((o) => o.textContent).join("|") }));
      const st5 = await stateOf(p5);
      const cat5 = loadCatalogue("starter");
      if (mode === "none") ok("pricing.show 'none': no dollar amount anywhere on the cards, the sheet or the plate", !/\$/.test(t5.cards + t5.plate + t5.sheet + t5.sel), J(t5).slice(0, 400));
      else ok("pricing.show 'from': the plate says 'from' the building's own price", t5.plate === "from " + money(priceParts(st5, cat5).base) && /\$/.test(t5.cards), J(t5.plate));
      ok(`pricing.show '${mode}': no console errors`, realNoise(n5).length === 0, J(realNoise(n5)));
      await c5.close();
    }
  }

  if (want(14)) section("14. It looks like Barnwright's designer (its page served on port 8341)");
  if (!want(14)) { /* skipped */ }
  else if (!existsSync(resolve(BW_PUBLIC, "3ddesign.html"))) ok("Barnwright's page is available to compare with", false, BW_PUBLIC);
  else {
    await serve(BW_PUBLIC, BW_PORT, "3ddesign.html");
    const SEL = [".hdr", ".wkbadge", ".hdr .t1", ".hdr .t2", ".stage", ".plate", ".plate .l1", ".plate .l2", ".plate .price", ".modebar", ".hint", ".views button", ".card", ".card h3", ".card h3 .no", ".catsel", ".chip", ".chip small", ".sw", ".addbtn", ".itemhint", ".itemrow", ".sumline", ".sheet"];
    const PROPS = ["font-size", "font-weight", "letter-spacing", "text-transform", "border-top-left-radius", "padding-top", "padding-right", "padding-bottom", "padding-left", "border-top-width", "min-height", "position"];
    /* Neither page can reach Google's fonts here, and Barnwright's rules name
       Oswald with no fallback (a serif) where ours fall back to a sans-serif:
       so both are put on the SAME font before measuring, and the boxes
       compare the stylesheet's geometry, not two different fallback fonts. */
    const sameFont = (page) => page.addStyleTag({ content: "*{font-family:'DejaVu Sans',sans-serif!important}" }).then(() => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))));
    const grab = (page) => page.evaluate(([SEL, PROPS]) => {
      const out = {};
      for (const s of SEL) { const e = document.querySelector(s); if (!e) { out[s] = null; continue; } const cs = getComputedStyle(e); out[s] = {}; for (const p of PROPS) out[s][p] = cs.getPropertyValue(p); }
      const box = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; };
      return {
        css: out, stage: box(".stage"), stagewrap: box(".stagewrap"), wrap: box("main.wrap"), hdr: box(".hdr"),
        hint: document.getElementById("hint").textContent,
        views: Array.from(document.querySelectorAll("#viewmenu button")).map((b) => b.getAttribute("data-v") + ":" + b.textContent),
        cards: Array.from(document.querySelectorAll(".card h3")).map((h) => h.textContent.trim()),
        sheetIds: ["sh-title", "sh-price", "sh-type", "sh-walls", "sh-rot", "sh-len-m", "sh-len-p", "sh-shut", "sh-shutc", "sh-dbl", "sh-lite", "sh-doorc", "sh-dup", "sh-del", "sh-done"].filter((id) => document.getElementById(id)),
        addIds: ["add-door", "add-win", "add-ru", "add-post", "add-light", "add-bench", "add-shelf"].filter((id) => document.getElementById(id)),
        modebar: document.getElementById("modebar").textContent,
      };
    }, [SEL, PROPS]);
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const cb = await newContext(browser, { viewport: { width: w, height: h } });
      const pb = await cb.newPage();
      await pb.goto("http://127.0.0.1:" + BW_PORT + "/3ddesign.html", { waitUntil: "load" });
      await pb.waitForFunction(() => document.getElementById("plateprice") && /\$/.test(document.getElementById("plateprice").textContent), null, { timeout: 60000 });
      await sameFont(pb);
      const bw = await grab(pb);
      await cb.close();
      const co = await newContext(browser, { viewport: { width: w, height: h } });
      const { page } = await openPage(co, "?company=demo");
      await sameFont(page);
      const us = await grab(page);
      await co.close();
      const diffs = [];
      for (const s of SEL) for (const p of PROPS) {
        const a = bw.css[s] && bw.css[s][p], b = us.css[s] && us.css[s][p];
        if (a !== b) diffs.push(`${s} ${p}: Barnwright ${a}, ours ${b}`);
      }
      ok(`${w}x${h}: the same type sizes, weights, spacing, corners and padding on ${SEL.length} parts of the page (${SEL.length * PROPS.length} values)`, diffs.length === 0, diffs.slice(0, 12).join("\n       "));
      /* the side column's HEIGHT differs only because the quote form is ui/quote.js's */
      const boxes = (x) => [x.stage, x.stagewrap, x.wrap.slice(0, 3), x.hdr];
      ok(`${w}x${h}: the header, stage, Inside button and columns sit in the same boxes`, J(boxes(bw)) === J(boxes(us)), J({ bw: boxes(bw), us: boxes(us) }));
      if (w === 1440) {
        ok("the same hint, camera views, Inside button and sheet and add controls", bw.hint === us.hint && J(bw.views) === J(us.views) && bw.modebar === us.modebar && J(bw.sheetIds) === J(us.sheetIds) && J(bw.addIds) === J(us.addIds), J({ bw: [bw.hint, bw.views, bw.modebar], us: [us.hint, us.views, us.modebar] }));
        ok("the same six cards in the same order", J(bw.cards) === J(us.cards), J({ bw: bw.cards, us: us.cards }));
      }
    }
  }
} catch (e) {
  ok("the check ran to the end", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log(`\ncheck-ui: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("The designer page works: every style and size picks and prices exactly as the model says, colours and items can be picked, added, tapped, dragged and removed, the add menu works, size changes follow DIFFERENCES #12, it lays out on phones, desktops and iPads, it escapes every company word, it survives unfinished parts, and it is laid out like Barnwright's.");
process.exit(0);
