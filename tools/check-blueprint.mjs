/* CHECK: THE INSIDE VIEW -- the floor-plan blueprint (ui/blueprint.js).
   Run: node tools/check-blueprint.mjs [--quiet] [--only=2,4]   (check-all: browser)

   IN NODE (no browser):
     * the plan's words are safe: a company name with HTML in it is painted as
       those very letters (the plan paints with fillText and never builds
       HTML), control characters (and the invisible right-to-left turners)
       are taken out and a very long name is cut; a picture for a quote
       leaves "PINCH TO ZOOM" off its footer;
     * the porch outline for every porch kind, and the "Add here" choices come
       from what the company sells.
   IN A REAL BROWSER (the repo served on port 8350, Barnwright on 8351 for the
   side-by-side), software graphics, the demo company:
     1. the Inside button opens the plan (navy paper on the stage, the canvas
        as sharp as the screen, the title written below the view switcher)
        and closes it again;
     2. the plan of a Utility Shed, a Lofted Barn, a Side Cabin (side porch),
        a Deluxe Side Cabin (corner porch) and a Dog Kennel is drawn: pixel
        checks region by region -- the paper, every wall of the building
        (the porch walls too), the empty room inside, the title, FRONT, the
        width and length dimension lines, the porch outline and its posts --
        and every door, window, roll-up, post and fixture has its own
        symbol at its own place (drawn with and without it, the difference
        is right there and nowhere else);
     3. EVERY standard opening of EVERY style at EVERY size the demo sells
        (and the side porch moved to the middle and flipped) has its symbol,
        counted by sampling the known positions: a window is three lines, a
        roll-up a dashed line, a door a leaf and a swing arc drawn OUTWARD
        (two leaves on double doors, one on the rest), a post a square, an
        outlet a dot, a light a gold ring; and every door's swing is on the
        paper: where Barnwright's size would run it off the edge (the 4 ft door
        on a 6x8 Garden Utility) or up into the title (the Dog Kennel's back
        door), the plan is drawn a little smaller, and ONLY there;
     4. tapping an item on the plan picks it; dragging it moves it (a window
        along its wall, a bench across the floor) by the distance the finger
        went, within the rules; the 3D building is NOT rebuilt while the
        finger moves and IS when it lifts; back Outside the 3D picture shows
        the item where the plan put it; a picked window is drawn in the
        picked-item blue; pulled far past the end of its wall it stops where
        the rules stop it, and let go near the middle of its space it is
        eased onto the middle; a TAP on the picked item (a finger wobbles a
        pixel or two) does not slide it; the plan's WORDS say the right
        numbers (the size, and the gaps to the next window and to the
        corner) and the right labels (a turned bench's label turned with
        it, the shelf's level, FRONT, the footer); an item that is not
        picked does not move (the plan moves instead);
     5. dragging empty paper moves the plan; two fingers pinch it to 2x and
        never past 5x or under 1x; a double-tap puts it back;
     6. press and hold: on open floor "Add here" offers a work bench, a shelf
        and a light, and "+ Shelf" puts a shelf right there; near a wall it
        offers a door, a window and an outlet, and "+ Window" puts the window
        on that wall where the finger was; lifting the finger leaves the menu
        open; outside the building, or moving first, nothing opens;
     7. picking an electric package brings up the plan with every fixture of
        the package drawn at its place (switch + GFCI, outlets, lights), and
        the exterior light when that is ticked;
     8. a ramp is drawn at the biggest door (and at the porch entry when the
        door opens onto the porch, where the 3D ramp is);
     9. a look-only page can be zoomed but nothing on it picked or added;
    10. drawPlanPicture (the quote pictures) hands back the plan on its own
        canvas, the size asked for, with or without the picked item, and its
        footer does not ask anybody to pinch a picture;
    11. on a phone (390 x 844, two pixels per point, touch) the plan is drawn
        at full sharpness; the front of the building (the doors, the ends of
        their swings, FRONT) is drawn above the price plate that lies across
        the foot of the picture, not under it; a finger tapping the doors
        picks them AND the plan stays up (the item sheet scrolls the page,
        and the phone's click after the tap used to land on "Outside" and
        throw the customer back to the 3D picture); on a computer the plate
        sits in the corner and no room is kept for it (section 1);
    12. SIDE BY SIDE WITH BARNWRIGHT: the same buildings drawn by Barnwright's
        own page and by ours (at Barnwright's size -- the Dog Kennel's picture
        adds a fourth panel, the plan as our page shows it, a little smaller so
        its back door's swing stays on the paper), at Barnwright's canvas
        size, pixel for pixel:
        outside the letters (Barnwright's page falls back to a serif font here;
        ours has Oswald, which this site serves itself) nothing differs on the
        plain buildings (20 pixels at most -- a dimension line one foot short
        is about 60); on
        the Side Cabin only the porch outline differs, as intended. The
        pictures are written to test/out/ (Barnwright | ours | where they
        differ);
    13. no errors in the browser console the whole time. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { BARNWRIGHT_PAGE } from "./lib/barnwright-blocks.mjs";
import { loadCatalogue } from "./lib/load.mjs";
import { paperText, footerText, titleText, porchRect, planFrame, wallChoices, floorChoices, hitAt } from "../ui/blueprint.js";
import { defaults } from "../model/design.js";
import * as S from "../ui/state.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const PORT = 8350, BW_PORT = 8351, BASE = "http://127.0.0.1:" + PORT;
const BW_PUBLIC = "/home/user/boisterous-lokum-a737e0/public";
const QUIET = process.argv.includes("--quiet");
/* --only=2,4 runs just those browser sections (the Node part always runs) */
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).map(Number);
const want = (n) => !ONLY.length || ONLY.indexOf(n) >= 0;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; if (!QUIET) console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 1200) : "")); }
  return !!cond;
}
function section(t) { console.log("\n" + t); }
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [];

console.log("check-blueprint: the Inside view -- the floor plan -- draws every building and every opening, and answers the finger\n");

/* ======================================================================
   IN NODE */
section("0. The plan's words and rules (in Node)");
const DEMO = loadCatalogue("demo");
{
  const evil = { brand: { name: "<img src=x onerror=alert(1)> & \"Sons\"\u0007" }, TYPES: { UT: { name: "Utility <b>Shed</b>" } } };
  const f = footerText({ type: "UT", size: "10x16" }, evil);
  ok("a company name with HTML in it is painted as those letters, control characters taken out",
    f === "<IMG SRC=X ONERROR=ALERT(1)> & \"SONS\" · 10 × 16 UTILITY <B>SHED</B> · PINCH TO ZOOM", f);
  ok("a very long company name is cut short so it cannot run off the paper", paperText("x".repeat(200), 48).length === 48);
  ok("the invisible characters that would turn the rest of the footer round, right to left, are taken out", paperText("Acme‮sdehS⁦ Co‏") === "Acme sdehS Co", J(paperText("Acme‮sdehS⁦ Co‏")));
  ok("a picture for a quote leaves PINCH TO ZOOM off the footer (nobody can pinch a picture in an e-mail)", footerText({ type: "UT", size: "8x12" }, { brand: { name: "Acme" }, TYPES: { UT: { name: "Utility Shed" } } }, false) === "ACME · 8 × 12 UTILITY SHED");
  ok("no company name: the footer just says the size and style", footerText({ type: "UT", size: "8x12" }, { brand: {}, TYPES: { UT: { name: "Utility Shed" } } }) === "8 × 12 UTILITY SHED · PINCH TO ZOOM");
  ok("the title reads like Barnwright's: 12′ × 24′ — FLOOR PLAN", titleText(12, 24) === "12′ × 24′ — FLOOR PLAN");
}
{
  const rect = (t, size, extra) => { const s = defaults(DEMO); S.chooseType(s, t, DEMO); S.chooseSize(s, size, DEMO); Object.assign(s, extra || {}); return porchRect(planFrame(s, DEMO)); };
  ok("no porch on a Utility Shed", rect("UT", "10x16") === null);
  ok("a front porch is the 4 ft across the front (Cabin 10x16)", J(rect("C", "10x16")) === J([-5, 4, 10, 4]), J(rect("C", "10x16")));
  ok("a side porch is its 4 ft notch on the right side, not the whole width (Side Cabin 12x24)", J(rect("SC", "12x24")) === J([2, 0, 4, 12]), J(rect("SC", "12x24")));
  ok("... moved to the middle", J(rect("SC", "12x24", { pMid: true })) === J([2, -6, 4, 12]), J(rect("SC", "12x24", { pMid: true })));
  ok("... flipped to the back", J(rect("SC", "12x24", { pFlip: true })) === J([2, -12, 4, 12]), J(rect("SC", "12x24", { pFlip: true })));
  ok("a corner porch is its span across the width, as Barnwright (Deluxe Side Cabin 12x24, deck included)", J(rect("DSC", "12x24")) === J([-6, 2, 12, 12]), J(rect("DSC", "12x24")));
}
{
  const wc = wallChoices(DEMO), fc = floorChoices(DEMO);
  ok("hold near a wall offers the company's first door, first wall window and its outlet (w48, w23, outlet on the demo)", J(wc.map((c) => c[1])) === J(["w48", "w23", "outlet"]), J(wc));
  ok("hold on the floor offers a work bench, a shelf and an overhead light", J(fc.map((c) => c[1])) === J(["bench", "shelf", "ilight"]), J(fc));
  const STARTER = loadCatalogue("starter");
  const ws = wallChoices(STARTER).concat(floorChoices(STARTER));
  ok("the starter company is offered only items it sells", ws.every((c) => STARTER.CAT[c[1]]), J(ws));
  ok("with nothing on the plan to find, a tap finds nothing", hitAt([10, 10], { items: [] }, DEMO, { s: 20, cx: 300, cy: 300, d: 1, fr: planFrame(defaults(DEMO), DEMO) }) === null);
}

/* ======================================================================
   IN THE BROWSER */
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

/* A plugin file that is not written yet is the only thing allowed to be missing
   (the Google font cannot be reached from here; it is answered empty). */
const MISSING_PLUGINS = ["views", "blueprint", "quote", "share"].filter((n) => !existsSync(resolve(ROOT, "ui", n + ".js"))).map((n) => "/ui/" + n + ".js");
function isAllowedNoise(m) {
  if (m.type !== "error") return false;
  return /Failed to load resource: the server responded with a status of 404/.test(m.text) && MISSING_PLUGINS.some((p) => (m.url || "").endsWith(p));
}
const realNoise = (noise) => noise.filter((m) => !isAllowedNoise(m));

async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1440, height: 900 }, reducedMotion: "reduce", hasTouch: !!o.touch, isMobile: !!o.mobile, deviceScaleFactor: o.dpr || 1 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  return ctx;
}
async function openPage(ctx, query) {
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { const t = m.type(); if (t === "error" || t === "warning") noise.push({ type: t, text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  await page.goto(BASE + "/" + (query || "?company=demo"), { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
  await page.evaluate(() => { const t = window.shedUI.renderer.test; if (t) { t.dprCap = 1; t.freezeWatchdog = true; } });
  await page.evaluate(installHelpers);
  return { page, noise };
}

/* ---- the page-side helpers (run inside the browser) ---- */
async function installHelpers() {
  const B = await import("/ui/blueprint.js");
  const { wallPt } = await import("/engine/wall.js");
  const LAY = await import("/model/layout.js");
  const ST = await import("/ui/state.js");
  const DES = await import("/model/design.js");
  const api = window.shedUI, cat = api.getCatalogue();
  const H = { B, ST, DES, LAY, wallPt, cat };
  H.lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  H.isLight = (c) => !!c && H.lum(c) > 150;
  H.isGold = (c) => !!c && c[0] > 150 && c[1] > 120 && c[0] - c[2] > 45;
  /* the dimension / porch cyan -- also when a 1 px line lights two pixels by half */
  H.isCyan = (c) => !!c && c[2] > 130 && c[2] - c[0] > 60 && c[1] > 100 && c[1] - c[0] > 30;
  H.isPaper = (c) => !!c && c[2] > c[0] + 25 && H.lum(c) < 95;
  /* read a canvas's pixels through a copy made for reading (reading the
     drawing canvas itself again and again makes the browser warn) */
  H.imgOf = (cv) => { const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(cv, 0, 0); return x.getImageData(0, 0, cv.width, cv.height); };
  /* the live plan: its pixels and where it is */
  H.live = () => {
    const cv = api.mounts.bp, v = api.blueprint.view();
    return H.withPosts({ img: H.imgOf(cv), W: cv.width, H: cv.height, s: v.s, cx: v.cx, cy: v.cy, d: v.d, TH: v.TH, fr: H.B.planFrame(api.getState(), cat) }, api.getState());
  };
  /* the plan drawn off screen by the same code (drawPlan), for a design */
  H.off = (state, w, h, o) => {
    o = o || {};
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const x = cv.getContext("2d");                              /* an ordinary canvas, drawn the way the page draws */
    const b = H.B.drawPlan(x, w, h, o.d || 1, state, cat, { zoom: o.zoom || 1, ox: 0, oy: 0 }, { selection: o.selection, fit: o.fit });
    return H.withPosts({ img: H.imgOf(cv), W: w, H: h, s: b.s, cx: b.cx, cy: b.cy, d: b.d, TH: b.TH, fr: b.fr, canvas: cv }, state);
  };
  H.px = (R, x, y) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= R.W || y >= R.H) return null;
    const i = (y * R.W + x) * 4, a = R.img.data;
    return [a[i], a[i + 1], a[i + 2], a[i + 3]];
  };
  H.P = (R, wx, wz) => [R.cx + wx * R.s, R.cy + wz * R.s];
  H.wp = (R, it, u, o) => { const q = wallPt(R.fr.ws[it.wall], u, 0, o); return H.P(R, q[0], q[2]); };
  H.anyNear = (R, p, rad, test) => {
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) if (test(H.px(R, p[0] + dx, p[1] + dy))) return true;
    return false;
  };
  /* light / dark runs along a line of samples */
  H.runs = (R, p0, p1, step, test) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(2, Math.ceil(len / step));
    let runs = 0, gaps = 0, prev = null, lit = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, q = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t], c = H.px(R, q[0], q[1]), on = !!test(c, q);
      if (on) lit++;
      if (prev !== null && on !== prev) { if (on) runs++; else gaps++; }
      if (prev === null && on) runs++;
      prev = on;
    }
    return { runs, gaps, frac: lit / (n + 1) };
  };
  /* the brightest pixel within `rad` of p (a thin line drawn between two
     pixels lights both of them only half) */
  H.maxLum = (R, p, rad) => { let m = 0; for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const c = H.px(R, p[0] + dx, p[1] + dy); if (c) m = Math.max(m, H.lum(c)); } return m; };
  /* the share of a line's samples that are lit (a line is drawn there) */
  /* the porch posts' little squares, which can sit right beside a door */
  H.nearPost = (R, q) => (R.posts || []).some((p) => Math.abs(p[0] - q[0]) < 5 * R.d && Math.abs(p[1] - q[1]) < 5 * R.d);
  H.withPosts = (R, state) => { R.posts = state.items.filter((it) => cat.CAT[it.cat] && cat.CAT[it.cat].k === "post").map((it) => H.B.postPoint(it, R.fr, (x, z) => H.P(R, x, z))); return R; };
  H.litLine = (R, p0, p1, rad) => {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), n = Math.max(2, Math.ceil(len / 0.5));
    let on = 0, lit = 0;
    for (let i = 0; i <= n; i++) {
      const q = [p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n];
      if (!H.px(R, q[0], q[1]) || H.nearPost(R, q)) continue;    /* off the sheet, or on a post: not counted either way */
      on++; if (H.maxLum(R, q, rad == null ? 1 : rad) > 130) lit++;
    }
    return on >= 5 ? lit / on : NaN;
  };
  /* Does item `it` have its symbol at its place in render R? */
  H.symbol = (R, it) => {
    const c = cat.CAT[it.cat], d = R.d, s = R.s;
    if (!c) return { kind: "unknown", ok: false, why: "not in the catalogue" };
    if (c.gable) return { kind: "gable", ok: null };
    if (c.k === "post") {
      /* a solid square: nearly every pixel of its middle lit (a wall's edge alone is a thin stripe) */
      const q = H.B.postPoint(it, R.fr, (x, z) => H.P(R, x, z));
      let lit = 0, all = 0;
      /* the middle 5 x 5 (x d) pixels of the 7 x 7 square: its outermost pixels are
         only half covered when the square lands between pixels */
      const k = Math.round(2 * d);
      for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { all++; const col = H.px(R, Math.round(q[0]) + dx, Math.round(q[1]) + dy); if (col && H.lum(col) > 150) lit++; }
      return { kind: "post", ok: lit / all > 0.9, why: "lit " + lit + "/" + all, at: q };
    }
    if (c.k === "ilt") {
      const q = H.P(R, it.px || 0, it.pz || 0);
      let ring = 0, rays = 0;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; if (H.anyNear(R, [q[0] + Math.cos(a) * 5.5 * d, q[1] + Math.sin(a) * 5.5 * d], 1, H.isGold)) ring++; }
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; if (H.anyNear(R, [q[0] + Math.cos(a) * 8.75 * d, q[1] + Math.sin(a) * 8.75 * d], 1, H.isGold)) rays++; }
      return { kind: "overhead light", ok: ring >= 6 && rays >= 3, why: "ring " + ring + "/8, rays " + rays + "/4", at: q };
    }
    if (c.stretch) {
      const ln = it.ln || 4, along = 0.3 * ln;
      const q = H.P(R, (it.px || 0) + (it.rot ? 0 : along), (it.pz || 0) + (it.rot ? along : 0));
      const col = H.px(R, q[0], q[1]);
      const good = c.k === "bench" ? (col && col[0] > 150 && col[0] > col[1] && col[1] > col[2] && col[0] - col[2] > 45) : (col && col[0] > 190 && col[1] > 180 && col[2] > 140 && col[0] >= col[2]);
      return { kind: c.k, ok: !!good, why: J2(col), at: q };
    }
    const w = R.fr.ws[it.wall];
    if (!w) return { kind: c.k, ok: false, why: "no wall " + it.wall };
    if (c.k === "out") {
      const q = H.wp(R, it, it.pos, 0);
      const dot = H.maxLum(R, [q[0], q[1] - 2.6 * d], 0) > 150 || H.maxLum(R, [q[0], q[1] + 2.6 * d], 0) > 150;
      const sOk = !c.switch || H.anyNear(R, [q[0] + w.n[0] * 11 * d, q[1] + w.n[2] * 11 * d], Math.round(2 * d), H.isLight);
      return { kind: c.switch ? "switch + GFCI" : "outlet", ok: dot && sOk, why: "dot " + dot + ", S " + sOk, at: q };
    }
    if (c.k === "light") {
      const q = H.wp(R, it, it.pos, 0.7);
      let ring = 0;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; if (H.anyNear(R, [q[0] + Math.cos(a) * 3.6 * d, q[1] + Math.sin(a) * 3.6 * d], 1, H.isGold)) ring++; }
      return { kind: "outside light", ok: ring >= 5, why: "ring " + ring + "/8", at: q };
    }
    const cw = H.LAY.itemW(it, cat.CAT), n = [w.n[0], w.n[2]];
    const along = (o, rad) => H.litLine(R, H.wp(R, it, it.pos - cw * 0.4, o), H.wp(R, it, it.pos + cw * 0.4, o), rad);
    if (c.k === "win") {
      /* three lines along the opening -- the middle one where a plain wall is dark */
      const f3 = [along(-0.13), along(0), along(0.13)];
      let runs = null;
      if (0.13 * s >= 4 * d) {
        /* and, where the lines are far enough apart to tell, exactly three of them across it */
        const half = 0.13 * s + 1.6 * d;
        runs = (it.dbl ? [it.pos - cw * 0.3, it.pos + cw * 0.3] : [it.pos - cw * 0.3, it.pos, it.pos + cw * 0.3]).map((u) => { const q = H.wp(R, it, u, 0); return H.runs(R, [q[0] - n[0] * half, q[1] - n[1] * half], [q[0] + n[0] * half, q[1] + n[1] * half], 0.34, (col) => !!col && H.lum(col) > 130).runs; });
      }
      /* a double window: the shared board across the lines, in the middle */
      const board = it.dbl ? H.litLine(R, H.wp(R, it, it.pos, -0.065), H.wp(R, it, it.pos, 0.065), 1) : 1;
      return { kind: it.dbl ? "double window" : "window", ok: f3.every((f) => f > 0.9) && (!runs || runs.every((r) => r === 3)) && !(board < 0.9), why: J2({ lines: f3.map((f) => +f.toFixed(2)), across: runs, board }), at: H.wp(R, it, it.pos, 0) };
    }
    const lineRuns = H.runs(R, H.wp(R, it, it.pos - cw * 0.45, 0), H.wp(R, it, it.pos + cw * 0.45, 0), 0.5, (col, q) => H.maxLum(R, q, 1) > 130);
    if (c.k === "ru") return { kind: "roll-up", ok: lineRuns.runs >= 3 && lineRuns.gaps >= 2 && lineRuns.frac > 0.3 && lineRuns.frac < 0.95, why: J2(lineRuns), at: H.wp(R, it, it.pos, 0) };
    /* a door: its sill line, a leaf (two on double doors) straight OUT from
       the hinge, nothing inward, the dashed swing arc, no leaf at the far jamb */
    const two = c.leaves === 2, r = two ? cw / 2 : cw;
    const hinges = two ? [[it.pos - cw / 2, 1], [it.pos + cw / 2, -1]] : [[it.pos - cw / 2, 1]];
    const leaf = hinges.map((h) => H.litLine(R, H.wp(R, it, h[0], 0.2 * r), H.wp(R, it, h[0], 0.85 * r)));
    const inside = hinges.map((h) => H.litLine(R, H.wp(R, it, h[0], -0.3 * r), H.wp(R, it, h[0], -0.6 * r), 0));
    let arc = 0, arcOn = 0, arcOff = 0;
    hinges.forEach((h) => {
      for (let a = 15; a <= 90; a += 15) {
        const tt = a * Math.PI / 180;
        const q = H.wp(R, it, h[0] + h[1] * r * Math.cos(tt), r * Math.sin(tt));
        if (!H.px(R, q[0], q[1])) { arcOff++; continue; }          /* past the edge of the sheet */
        arcOn++; if (H.maxLum(R, q, Math.round(2 * d)) > 130) arc++;
      }
    });
    const farJamb = two ? 0 : H.litLine(R, H.wp(R, it, it.pos + cw / 2, 0.35 * r), H.wp(R, it, it.pos + cw / 2, 0.65 * r), 0);
    const good = lineRuns.frac > 0.9 && leaf.every((f) => f > 0.9) && inside.every((f) => !(f >= 0.1)) && arcOn >= 2 && arc >= arcOn * 0.6 && !(farJamb >= 0.1);
    const f2 = (v) => isNaN(v) ? "off the sheet" : +v.toFixed(2);
    return { kind: two ? "double door" : "door", ok: good, leaves: hinges.length, arcOff, why: J2({ sill: f2(lineRuns.frac), leaf: leaf.map(f2), inside: inside.map(f2), arc: arc + "/" + arcOn, farJamb: f2(farJamb) }), at: H.wp(R, it, it.pos, 0) };
  };
  function J2(v) { return JSON.stringify(v); }
  /* where the pixels change when one item is taken off the design */
  H.presence = (state, it, w, h) => {
    const full = H.off(state, w, h, { selection: false, fit: "barnwright" });   /* one size for both: taking a door off may change the page's size */
    const s2 = JSON.parse(JSON.stringify(state)); s2.items = s2.items.filter((i) => i.id !== it.id);
    const without = H.off(s2, w, h, { selection: false, fit: "barnwright" });
    const a = full.img.data, b = without.img.data;
    let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) {
        n++; const p = i >> 2, x = p % w, y = (p / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    const c = cat.CAT[it.cat], R = full;
    let at;
    if (c.k === "post") at = H.B.postPoint(it, R.fr, (x, z) => H.P(R, x, z));
    else if (c.int && (c.free || c.stretch)) at = H.P(R, it.px || 0, it.pz || 0);
    else at = H.wp(R, it, it.pos, c.k === "light" ? 0.7 : 0);
    const reach = (Math.max(H.LAY.itemW(it, cat.CAT) || 1, c.stretch ? (it.ln || 4) : 1) * 1.25 + 1.2) * R.s + 24;
    const inBox = at[0] >= x0 - 4 && at[0] <= x1 + 4 && at[1] >= y0 - 4 && at[1] <= y1 + 4;
    const local = Math.max(Math.abs(x0 - at[0]), Math.abs(x1 - at[0]), Math.abs(y0 - at[1]), Math.abs(y1 - at[1])) <= reach;
    return { n, box: [x0, y0, x1, y1], at: at.map((v) => +v.toFixed(1)), ok: n > 15 && inBox && local, inBox, local };
  };
  H.setDesign = (t, size, extra) => {
    api.setState((s) => { H.ST.chooseType(s, t, cat); H.ST.chooseSize(s, size, cat); if (extra) Object.assign(s, extra); if (extra && (extra.pMid !== undefined || extra.pFlip !== undefined)) { H.LAY.resetItems(s, null, cat); } });
  };
  H.screenOf = (wx, wz) => { const p = api.blueprint.toScreen(wx, wz), r = api.mounts.bp.getBoundingClientRect(); return [r.left + p[0], r.top + p[1]]; };
  H.itemScreen = (id) => {
    const st = api.getState(), it = H.LAY.itemById(st, id), c = cat.CAT[it.cat];
    if (c.free || c.stretch) return H.screenOf(it.px || 0, it.pz || 0);
    const fr = H.B.planFrame(st, cat), q = wallPt(fr.ws[it.wall], it.pos, 0, c.k === "light" ? 0.7 : 0);
    return H.screenOf(q[0], q[2]);
  };
  H.rebuilds = 0;
  api.on("rebuild", () => { H.rebuilds++; });
  window.__bp = H;
}

let browser;
try {
  await serve(ROOT, PORT, "index.html");
  browser = await chromium.launch(LAUNCH);
  mkdirSync(OUT, { recursive: true });
  const ctx = await newContext(browser);
  const { page, noise } = await openPage(ctx);

  /* ---------------------------------------------------------------- 1 */
  if (want(1)) section("1. The Inside button opens the floor plan");
  if (want(1)) {
    const before = await page.evaluate(() => ({ mode: shedUI.getMode(), hook: typeof shedUI.onInside, plugin: shedUI.plugins.blueprint }));
    ok("the blueprint plugin loaded and set shedUI.onInside", before.plugin === true && before.hook === "function", J(before));
    await page.click("#modebar");
    const inView = await page.evaluate(() => {
      const cv = document.getElementById("bp"), st = document.getElementById("stage");
      const R = __bp.live(), H = __bp;
      return { mode: shedUI.getMode(), bpmode: st.classList.contains("bpmode"), shown: getComputedStyle(cv).display, w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight,
        label: document.getElementById("modebar").textContent, corner: H.isPaper(H.px(R, 3, R.H / 2)) && H.isPaper(H.px(R, R.W - 3, R.H - 40)), css: !!document.querySelector("link[data-blueprint-css]") };
    });
    ok("tapping Inside switches to the plan: the stage is in plan mode and the plan canvas shows", inView.mode === "in" && inView.bpmode && inView.shown === "block", J(inView));
    ok("the button now offers the way back Outside", /Outside/.test(inView.label), inView.label);
    ok("the plan canvas has one pixel per screen pixel (as sharp as the screen)", inView.w === inView.cw && Math.abs(inView.h - inView.ch) <= 1, J(inView));
    ok("the paper is Barnwright's navy blueprint", inView.corner, J(inView));
    ok("the plan's own stylesheet (ui/blueprint.css) is on the page", inView.css);
    /* the title is written clear of the view switcher that sits over the top of the stage */
    const tsw = await page.evaluate(() => {
      const vm = shedUI.mounts.view, cv = shedUI.mounts.bp, v = shedUI.blueprint.view();
      const r = vm.getBoundingClientRect(), cr = cv.getBoundingClientRect();
      return { switcherBottom: r.bottom - cr.top, switcherRight: r.right - cr.left, titleBaseline: (18 * v.d + (v.top || 0)) / v.d, titleTop: (18 * v.d + (v.top || 0)) / v.d - 11, mid: cr.width / 2, shown: !!vm.children.length };
    });
    ok(`the title is written below the view switcher, not under it (switcher ends ${tsw.switcherBottom.toFixed(0)} px down, the title's letters start ${tsw.titleTop.toFixed(0)} px down)`, !tsw.shown || tsw.switcherRight < tsw.mid - 90 || tsw.titleTop > tsw.switcherBottom + 2, J(tsw));
    const botDesk = await page.evaluate(() => shedUI.blueprint.view().bot);
    ok("on a computer the price plate sits in the corner, clear of the plan, so no room is kept for it (the plan keeps Barnwright's size)", botDesk === 0, botDesk);
    await page.click("#modebar");
    ok("tapping it again goes back to the 3D picture", await page.evaluate(() => shedUI.getMode() === "out" && !document.getElementById("stage").classList.contains("bpmode")));
    await page.click("#modebar");
  }

  await page.evaluate(() => { if (shedUI.getMode() !== "in") shedUI.onInside({ want: "in", reason: "check" }); });

  /* ---------------------------------------------------------------- 2 */
  if (want(2)) section("2. The plans of five buildings, region by region");
  const FIVE = [["UT", "10x16", "a Utility Shed"], ["LB", "12x24", "a Lofted Barn"], ["SC", "12x24", "a Side Cabin (side porch)"], ["DSC", "12x24", "a Deluxe Side Cabin (corner porch)"], ["DK", "8x12", "a Dog Kennel"]];
  for (const [t, size, what] of (want(2) ? FIVE : [])) {
    await page.evaluate(([t, size]) => __bp.setDesign(t, size), [t, size]);
    const r = await page.evaluate(() => {
      const H = __bp, R = H.live(), api = shedUI, st = api.getState(), cat = H.cat, fr = R.fr, W = fr.d.W, L = fr.d.L, d = R.d;
      const out = {};
      out.paper = [[4, R.H * 0.3], [R.W - 4, R.H * 0.6], [R.W * 0.05, R.H * 0.9]].every((p) => H.isPaper(H.px(R, p[0], p[1])));
      /* every wall: along the stretches clear of its openings, its two light
         edges and its dark core (where a porch outline runs along a wall, its
         cyan dashes sit on the core) */
      const walls = {};
      for (const k of Object.keys(fr.ws)) {
        const w = fr.ws[k], th = (R.TH / 2 - 0.7 * d) / R.s;
        const busy = st.items.filter((it) => it.wall === k && cat.CAT[it.cat] && !cat.CAT[it.cat].gable && cat.CAT[it.cat].k !== "post").map((it) => [it.pos - H.LAY.itemW(it, cat.CAT) / 2 - 0.3, it.pos + H.LAY.itemW(it, cat.CAT) / 2 + 0.3]);
        /* where another wall joins this one, and where a dimension's label box sits over it (as in Barnwright) */
        const segs = Object.keys(fr.ws).filter((k2) => k2 !== k).map((k2) => { const w2 = fr.ws[k2], a = H.wallPt(w2, -w2.len / 2, 0, 0), b = H.wallPt(w2, w2.len / 2, 0, 0); return [H.P(R, a[0], a[2]), H.P(R, b[0], b[2])]; });
        const segDist = (q, sg) => { const ax = sg[0][0], ay = sg[0][1], bx = sg[1][0], by = sg[1][1], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((q[0] - ax) * vx + (q[1] - ay) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(q[0] - ax - vx * t, q[1] - ay - vy * t); };
        const labels = [[R.cx, H.P(R, 0, -L / 2)[1] - 12 * d], [H.P(R, -W / 2, 0)[0] - 12 * d, R.cy]];
        let tried = 0, good = 0;
        const bad = [];
        for (let f = 0.04; f <= 0.96; f += 0.02) {
          const u = -w.len / 2 + w.len * f;
          if (busy.some((b) => u > b[0] && u < b[1])) continue;
          const pt = (o) => { const q = H.wallPt(w, u, 0, o); return H.P(R, q[0], q[2]); };
          const mid = pt(0);
          if (segs.some((sg) => segDist(mid, sg) < R.TH + 2 * d)) continue;
          if (labels.some((l) => Math.abs(mid[0] - l[0]) < 45 * d && Math.abs(mid[1] - l[1]) < 22 * d)) continue;
          const e1 = H.maxLum(R, pt(-th), 1) > 130, e2 = H.maxLum(R, pt(th), 1) > 130;
          const core = H.px(R, pt(0)[0], pt(0)[1]), coreOk = !!core && (H.lum(core) < 110 || H.isCyan(core));
          tried++;
          if (e1 && e2 && coreOk) good++; else if (bad.length < 3) bad.push({ u: +u.toFixed(2), e1, e2, core });
        }
        walls[k] = tried === 0 ? (busy.length ? "covered" : "nothing to sample") : (good / tried >= 0.95 ? true : ("good " + good + "/" + tried + " " + JSON.stringify(bad)));
      }
      out.walls = walls;
      /* the empty room: a spot inside the walls away from everything */
      const room = H.P(R, -W / 4, -L / 4);
      out.room = H.isPaper(H.px(R, room[0], room[1])) || (H.lum(H.px(R, room[0], room[1])) < 95);
      /* the title near the top, FRONT under the front wall */
      const tY = 18 * d + 0;
      let title = 0; for (let y = 0; y < R.H * 0.12; y++) for (let x = R.cx - 60 * d; x < R.cx + 60 * d; x++) if (H.isLight(H.px(R, x, y))) title++;
      out.title = title > 30;
      const fy = H.P(R, 0, L / 2)[1] + 26 * d;
      let front = 0; for (let y = fy - 8 * d; y < fy + 3 * d; y++) for (let x = R.cx - 25 * d; x < R.cx + 25 * d; x++) { const c = H.px(R, x, y); if (c && H.lum(c) > 110) front++; }
      out.front = front > 8;
      /* the width line above the building and the length line down its left side */
      const topY = H.P(R, 0, -L / 2)[1] - 12 * d, leftX = H.P(R, -W / 2, 0)[0] - 12 * d;
      out.widthLine = [0.2, 0.3, 0.7, 0.8].every((f) => H.anyNear(R, [H.P(R, -W / 2 + W * f, 0)[0], topY], 1, H.isCyan));
      out.lengthLine = [0.2, 0.3, 0.7, 0.8].every((f) => H.anyNear(R, [leftX, H.P(R, 0, -L / 2 + L * f)[1]], 1, H.isCyan));
      /* the porch outline (dashed cyan) */
      const pr = H.B.porchRect(fr);
      if (pr) {
        let hits = 0, tried = 0;
        for (let f = 0.1; f < 0.9; f += 0.04) {
          const edges = [[pr[0] + pr[2] * f, pr[1]], [pr[0] + pr[2] * f, pr[1] + pr[3]], [pr[0], pr[1] + pr[3] * f], [pr[0] + pr[2], pr[1] + pr[3] * f]];
          for (const e of edges) { tried++; if (H.anyNear(R, H.P(R, e[0], e[1]), 1, H.isCyan)) hits++; }
        }
        out.porch = hits / tried;
      } else out.porch = null;
      /* every item: its symbol where it belongs */
      out.items = st.items.map((it) => Object.assign({ id: it.id, cat: it.cat, wall: it.wall }, H.symbol(R, it)));
      /* and the same item taken off: the drawing changes right there and nowhere else */
      out.presence = st.items.filter((it) => !cat.CAT[it.cat].gable).map((it) => Object.assign({ id: it.id, cat: it.cat }, H.presence(st, it, 900, 900)));
      out.gable = st.items.filter((it) => cat.CAT[it.cat].gable).map((it) => it.cat);
      out.W = W; out.L = L;
      return out;
    });
    ok(`${what} ${size}: the navy paper fills the sheet`, r.paper, J(r));
    const covered = Object.keys(r.walls).filter((k) => r.walls[k] === "covered");
    ok(`${what} ${size}: every wall is drawn (${Object.keys(r.walls).join(" ")}) as a wall -- two edges and a dark core${covered.length ? " (" + covered.join(", ") + ": taken up by its door or window, checked below)" : ""}`, Object.values(r.walls).every((v) => v === true || v === "covered"), J(r.walls));
    ok(`${what} ${size}: the room inside is empty paper`, r.room);
    ok(`${what} ${size}: the title and FRONT are written`, r.title && r.front, J({ title: r.title, front: r.front }));
    ok(`${what} ${size}: the width and length are drawn as dimension lines`, r.widthLine && r.lengthLine, J({ w: r.widthLine, l: r.lengthLine }));
    if (r.porch !== null) ok(`${what} ${size}: the porch is outlined (dashed)`, r.porch > 0.3, "cyan on " + (r.porch * 100).toFixed(0) + "% of the outline");
    const bad = r.items.filter((i) => i.ok === false);
    const drawn = r.items.filter((i) => i.ok !== null);
    ok(`${what} ${size}: every door, window, post and fixture has its symbol at its place (${drawn.length - bad.length} of ${drawn.length}: ${drawn.map((i) => i.kind).join(", ")})`, bad.length === 0 && drawn.length > 0, J(bad));
    const pb = r.presence.filter((p) => !p.ok);
    ok(`${what} ${size}: taking each one off changes the drawing right where it was and nowhere else (${r.presence.length - pb.length} of ${r.presence.length})`, pb.length === 0, J(pb));
    if (r.gable.length) console.log(`       (${r.gable.join(", ")}: up in the gable, so not on the floor plan -- as Barnwright)`);
    const file = resolve(OUT, `blueprint-${t}-${size}.png`);
    await (await page.$("#stage")).screenshot({ path: file });
    shots.push([file, `our Inside view of ${what} ${size}`]);
  }

  /* ---------------------------------------------------------------- 3 */
  if (want(3)) section("3. Every standard opening of every style, at every size the demo sells");
  if (want(3)) {
    const r = await page.evaluate(() => {
      const H = __bp, cat = H.cat, out = { buildings: 0, symbols: 0, kinds: {}, bad: [], gable: 0, leaves: { one: 0, two: 0 }, control: 0, controlBad: [], swings: 0, offPaper: [] };
      for (const t of Object.keys(cat.TYPES)) {
        const sizes = Object.keys(cat.P[t] || {});
        const variants = cat.TYPES[t].porch === "S" ? [{}, { pMid: true }, { pFlip: true }] : [{}];
        for (const size of sizes) for (const v of variants) {
          const s = H.DES.defaults(cat); H.ST.chooseType(s, t, cat); H.ST.chooseSize(s, size, cat);
          if (v.pMid || v.pFlip) { Object.assign(s, v); H.LAY.resetItems(s, null, cat); }
          H.DES.normalize(s, null, cat);
          /* big enough that the three lines of a window are 4 px apart or more */
          const fr0 = H.B.planFrame(s, cat), cw0 = Math.ceil((fr0.d.W + 6) * 40), ch0 = Math.ceil((fr0.d.L + 6) * 40);
          const R = H.off(s, cw0, ch0, { selection: false });
          out.buildings++;
          /* the control: the same building drawn with NO doors or windows must fail every symbol test */
          if (out.buildings % 4 === 1) {
            const bare = JSON.parse(JSON.stringify(s)); bare.items = [];
            const R0 = H.withPosts(H.off(bare, cw0, ch0, { selection: false }), s);
            for (const it of s.items) { const sy = H.symbol(R0, it); if (sy.ok === null) continue; out.control++; if (sy.ok) out.controlBad.push(t + " " + size + ": " + it.cat + " found on a bare wall"); }
          }
          for (const it of s.items) {
            const sy = H.symbol(R, it);
            if (sy.ok === null) { out.gable++; continue; }
            out.symbols++;
            out.kinds[sy.kind] = (out.kinds[sy.kind] || 0) + 1;
            if (sy.leaves === 1) out.leaves.one++; else if (sy.leaves === 2) out.leaves.two++;
            if (sy.leaves) { out.swings++; if (sy.arcOff) out.offPaper.push(t + " " + size + ": " + it.cat + " on " + it.wall + " (" + sy.arcOff + " points of its swing past the edge)"); }
            if (!sy.ok) out.bad.push(t + " " + size + (v.pMid ? " (porch in the middle)" : v.pFlip ? " (porch flipped)" : "") + ": " + it.cat + " on " + it.wall + " at " + (+it.pos).toFixed(2) + " -- " + sy.kind + " " + sy.why);
          }
        }
      }
      return out;
    });
    ok(`all ${r.symbols} standard doors, windows and posts on ${r.buildings} buildings have their symbol (${Object.keys(r.kinds).map((k) => r.kinds[k] + " " + k).join(", ")})`, r.bad.length === 0 && r.symbols > 300, r.bad.slice(0, 12).join("\n       "));
    ok(`the double doors are drawn with two leaves (${r.leaves.two}) and every other door with one (${r.leaves.one})`, r.leaves.two > 50 && r.leaves.one > 50, J(r.leaves));
    ok(`the sampling can tell: on the same buildings drawn with no doors or windows, none of ${r.control} symbols is found`, r.control > 100 && r.controlBad.length === 0, r.controlBad.slice(0, 8).join("\n       "));
    console.log(`       (${r.gable} gable windows sit up in the gable and are left off the floor plan, as Barnwright)`);
    ok(`every door's swing is on the paper, all the way round (${r.swings} doors)`, r.swings > 150 && r.offPaper.length === 0, r.offPaper.slice(0, 8).join("\n       "));
    /* the rule that does it: only buildings whose swing would run off get a smaller plan */
    const fitR = await page.evaluate(() => {
      const H = __bp, cat = H.cat, w = 742, h = 803, res = {};
      const mk = (t, size) => { const s = H.DES.defaults(cat); H.ST.chooseType(s, t, cat); H.ST.chooseSize(s, size, cat); H.DES.normalize(s, null, cat); return s; };
      const offOf = (R, s) => s.items.reduce((n, it) => n + (H.symbol(R, it).arcOff || 0), 0);
      for (const [t, size] of [["GU", "6x8"], ["DK", "8x12"], ["UT", "10x16"], ["LB", "12x24"]]) {
        const s = mk(t, size), a = H.off(s, w, h, { selection: false, fit: "barnwright" }), b = H.off(s, w, h, { selection: false });
        const reach = H.B.planReach(s, b.fr, cat.CAT);
        res[t] = { bwOff: offOf(a, s), ourOff: offOf(b, s), bwS: +a.s.toFixed(3), ourS: +b.s.toFixed(3),
          /* how far below the title's line the highest point of the drawing is, in pixels */
          backGap: +((b.cy + reach.z0 * b.s) - 18).toFixed(1), bwBackGap: +((a.cy + reach.z0 * a.s) - 18).toFixed(1) };
      }
      return res;
    });
    ok(`Barnwright's size runs the 4 ft door's swing off a 6x8 Garden Utility (${fitR.GU.bwOff} points off); ours shrinks that plan (${fitR.GU.bwS} -> ${fitR.GU.ourS} px a foot) and keeps it all on (${fitR.GU.ourOff} off)`, fitR.GU.bwOff > 0 && fitR.GU.ourOff === 0 && fitR.GU.ourS < fitR.GU.bwS, J(fitR.GU));
    ok(`the Dog Kennel's back door no longer swings up into the title (Barnwright: ${fitR.DK.bwBackGap} px from the title line, ours ${fitR.DK.backGap} px below it)`, fitR.DK.bwBackGap < 0 && fitR.DK.backGap >= 5.5, J(fitR.DK));
    ok(`buildings whose swings already fit keep exactly Barnwright's size (Utility Shed 10x16 ${fitR.UT.ourS} px a foot, Lofted Barn 12x24 ${fitR.LB.ourS})`, fitR.UT.ourS === fitR.UT.bwS && fitR.LB.ourS === fitR.LB.bwS, J({ UT: fitR.UT, LB: fitR.LB }));
  }

  /* ---------------------------------------------------------------- 4 */
  if (want(4)) section("4. Tapping and dragging on the plan");
  if (want(4)) {
    await page.evaluate(() => { __bp.setDesign("UT", "12x24"); shedUI.select(null); shedUI.blueprint.reset(); });
    const winId = await page.evaluate(() => { const H = __bp; const it = shedUI.setState((s) => H.ST.addAt(s, "w23", { wall: "L", u: -3 }, H.cat)); shedUI.select(null); return it.id; });
    const p0 = await page.evaluate((id) => __bp.itemScreen(id), winId);
    await page.mouse.click(p0[0], p0[1]);
    const t1 = await page.evaluate((id) => ({ sel: shedUI.getState().sel, sheet: document.getElementById("sheet").classList.contains("open"), id }), winId);
    ok("tapping a window on the plan picks it (and the item sheet opens)", t1.sel === winId && t1.sheet, J(t1));
    /* ...and the plan shows it picked: its three lines turn the light blue
       of a picked item (and back to white when it is put down) */
    const blue = async () => page.evaluate((id) => {
      const H = __bp, R = H.live(), it = H.LAY.itemById(shedUI.getState(), id), cw = H.LAY.itemW(it, H.cat.CAT);
      let cyan = 0, n = 0;
      for (const o of [-0.13, 0, 0.13]) for (let f = -0.35; f <= 0.35; f += 0.05) { n++; const q = H.wp(R, it, it.pos + cw * f, o); if (H.anyNear(R, q, 1, (c) => !!c && c[2] > 160 && c[2] - c[0] > 70)) cyan++; }   /* the light blue, also where a thin line lights two pixels by half */
      return cyan / n;
    }, winId);
    const pickedBlue = await blue();
    await page.evaluate(() => shedUI.select(null));
    const plainBlue = await blue();
    await page.evaluate((id) => shedUI.select(id), winId);
    ok(`the picked window is drawn in the picked-item blue (${(pickedBlue * 100).toFixed(0)}% of its lines; ${(plainBlue * 100).toFixed(0)}% when it is not picked)`, pickedBlue > 0.9 && plainBlue < 0.1, J({ pickedBlue, plainBlue }));
    const before = await page.evaluate((id) => { const it = __bp.LAY.itemById(shedUI.getState(), id); __bp.rebuilds = 0; return { pos: it.pos, s: shedUI.blueprint.view().s }; }, winId);
    const dy = 90;
    await page.mouse.move(p0[0], p0[1]);
    await page.mouse.down();
    for (let i = 1; i <= 9; i++) await page.mouse.move(p0[0], p0[1] + dy * i / 9);
    const mid = await page.evaluate(() => __bp.rebuilds);
    await page.mouse.up();
    const after = await page.evaluate((id) => {
      const H = __bp, st = shedUI.getState(), it = H.LAY.itemById(st, id);
      const copy = JSON.parse(JSON.stringify(it)), fr = H.B.planFrame(st, H.cat);
      H.LAY.clampPos(copy, st, fr);
      const planIt = shedUI.getPlan().state.items.find((i) => i.id === id);
      return { pos: it.pos, legal: Math.abs(copy.pos - it.pos) < 1e-9, planPos: planIt && planIt.pos, rebuilds: H.rebuilds, sel: st.sel };
    }, winId);
    const expect = before.pos + dy / before.s;          /* the L wall runs toward the front (+z = down the plan) */
    ok(`dragging the picked window ${dy} px down the left wall moves it ${(dy / before.s).toFixed(2)} ft along the wall (it moved ${(after.pos - before.pos).toFixed(2)} ft)`, Math.abs(after.pos - expect) < 0.3, J({ before, after, expect }));
    ok("where it ended up is a place the rules allow (clampPos leaves it there)", after.legal, J(after));
    ok("the 3D building is not rebuilt while the finger moves, and is when it lifts", mid === 0 && after.rebuilds >= 1 && after.planPos === after.pos, J({ mid, after }));
    ok("the window is still the picked item after the drag", after.sel === winId);
    /* the rules while dragging: pulled far past the end of the wall, the
       window stops where the rules stop it (clampPos) -- never off the wall */
    {
      const far = await page.evaluate((id) => ({ at: __bp.itemScreen(id), s: shedUI.blueprint.view().s }), winId);
      await page.mouse.move(far.at[0], far.at[1]); await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(far.at[0], far.at[1] + (880 - far.at[1]) * i / 10);   /* to the foot of the window: many feet past the wall's end */
      await page.mouse.up();
      const f2 = await page.evaluate((id) => {
        const H = __bp, st = shedUI.getState(), it = H.LAY.itemById(st, id), fr = H.B.planFrame(st, H.cat), w = fr.ws[it.wall], cw = H.LAY.itemW(it, H.cat.CAT);
        const probe = JSON.parse(JSON.stringify(it)); probe.pos = 1e6; H.LAY.clampPos(probe, st, fr);
        return { pos: it.pos, limit: probe.pos, end: w.len / 2 - cw / 2 };
      }, winId);
      ok(`dragged far past the front end of the wall, the window stops where the rules stop it (${f2.pos.toFixed(3)} ft along; the furthest the rules allow is ${f2.limit.toFixed(3)}, the wall's end ${f2.end.toFixed(3)})`, Math.abs(f2.pos - f2.limit) < 1e-6 && f2.pos <= f2.end + 1e-6, J(f2));
    }
    /* and eased onto the middle of its space: let go 0.1 ft from the middle of
       an empty wall, it lands exactly on the middle (snapCenter) */
    {
      const sn = await page.evaluate(() => {
        const H = __bp, cat = H.cat;
        const it = shedUI.setState((s) => H.ST.addAt(s, "w23", { wall: "R", u: 3 }, cat));
        shedUI.setState((s) => { H.LAY.itemById(s, it.id).pos = 3; });
        shedUI.select(it.id);
        return { id: it.id, at: H.itemScreen(it.id), s: shedUI.blueprint.view().s };
      });
      /* the R wall runs toward the back (-z = up the plan): 2.9 ft down the plan brings it to 0.1 ft from the middle */
      const dy2 = 2.9 * sn.s;
      await page.mouse.move(sn.at[0], sn.at[1]); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(sn.at[0], sn.at[1] + dy2 * i / 8);
      await page.mouse.up();
      const sn2 = await page.evaluate((id) => { const it = __bp.LAY.itemById(shedUI.getState(), id); const pos = it.pos; shedUI.setState((s) => { s.items = s.items.filter((i) => i.id !== id); s.sel = null; }); return pos; }, sn.id);
      ok(`let go 0.1 ft from the middle of an empty wall, a window is eased onto the exact middle (it landed at ${sn2.toFixed(4)} ft)`, Math.abs(sn2) < 1e-9, sn2);
      await page.evaluate((id) => shedUI.select(id), winId);
    }
    /* back outside: the 3D picture has the window where the plan put it */
    await page.click("#modebar");
    const threeD = await page.evaluate((id) => {
      const res = shedUI.getResult(), qs = res.build.hitQuads.filter((q) => q.id === id);
      const zs = qs.flatMap((q) => q.pts.map((p) => p[2])), xs = qs.flatMap((q) => q.pts.map((p) => p[0]));
      const it = __bp.LAY.itemById(shedUI.getState(), id);
      return { mode: shedUI.getMode(), quads: qs.length, zMid: (Math.min(...zs) + Math.max(...zs)) / 2, x: Math.max(...xs), pos: it.pos, W: +shedUI.getState().size.split("x")[0] };
    }, winId);
    ok(`back Outside, the 3D window is where the plan put it (its middle ${threeD.zMid.toFixed(3)} ft along, the plan says ${threeD.pos.toFixed(3)})`, threeD.mode === "out" && threeD.quads > 0 && Math.abs(threeD.zMid - threeD.pos) < 0.02 && threeD.x < -threeD.W / 2, J(threeD));
    await page.click("#modebar");
    /* a bench dragged across the floor */
    const bench = await page.evaluate(() => { const H = __bp; const it = shedUI.setState((s) => H.ST.addInterior(s, "bench", H.cat, 0)); shedUI.select(it.id); return it.id; });
    const b0 = await page.evaluate((id) => { const it = __bp.LAY.itemById(shedUI.getState(), id); return { px: it.px, pz: it.pz, s: shedUI.blueprint.view().s, at: __bp.itemScreen(id) }; }, bench);
    await page.mouse.move(b0.at[0], b0.at[1]); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(b0.at[0] + 60 * i / 8, b0.at[1] + 45 * i / 8);
    await page.mouse.up();
    const b1 = await page.evaluate((id) => { const it = __bp.LAY.itemById(shedUI.getState(), id); return { px: it.px, pz: it.pz }; }, bench);
    ok(`a picked work bench slides across the floor with the finger (${(b1.px - b0.px).toFixed(2)} ft across, ${(b1.pz - b0.pz).toFixed(2)} ft along)`, Math.abs(b1.px - b0.px - 60 / b0.s) < 0.05 && Math.abs(b1.pz - b0.pz - 45 / b0.s) < 0.05, J({ b0, b1 }));
    /* pulled right out through the left wall, the bench stops inside the room where the rules stop it */
    {
      const bb = await page.evaluate((id) => __bp.itemScreen(id), bench);
      await page.mouse.move(bb[0], bb[1]); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(bb[0] + (8 - bb[0]) * i / 8, bb[1]);   /* to the left edge of the window */
      await page.mouse.up();
      const b2 = await page.evaluate((id) => {
        const H = __bp, st = shedUI.getState(), it = H.LAY.itemById(st, id), fr = H.B.planFrame(st, H.cat), c = H.cat.CAT[it.cat];
        const probe = JSON.parse(JSON.stringify(it)); probe.px = -1e6; H.LAY.clampPos(probe, st, fr);
        const halfX = (it.rot ? c.dep : (it.ln || 4)) / 2;
        return { px: it.px, limit: probe.px, inside: it.px - halfX >= -fr.d.W / 2 - 1e-6 };
      }, bench);
      ok(`pulled out through the left wall, the bench stops inside the room (${b2.px.toFixed(3)} ft across; the rules stop it at ${b2.limit.toFixed(3)})`, Math.abs(b2.px - b2.limit) < 1e-6 && b2.inside, J(b2));
    }
    /* a TAP on the picked item -- a finger always wobbles a pixel or two --
       must not slide it: 0.15 ft off the middle of an empty wall is inside
       the snap-to-the-middle distance, so any slide at all would jump it */
    const jig = await page.evaluate(() => {
      const H = __bp, cat = H.cat;
      const it = shedUI.setState((s) => { const w = H.ST.addAt(s, "w23", { wall: "R", u: 0 }, cat); return w; });
      shedUI.setState((s) => { H.LAY.itemById(s, it.id).pos = 0.15; });
      shedUI.select(it.id);
      window.__bpChanges = 0; if (!window.__bpChangeHook) { window.__bpChangeHook = true; shedUI.on("change", () => { window.__bpChanges++; }); }
      return { id: it.id, at: H.itemScreen(it.id) };
    });
    await page.mouse.move(jig.at[0], jig.at[1]); await page.mouse.down(); await page.mouse.move(jig.at[0], jig.at[1] + 2); await page.mouse.up();
    const jig2 = await page.evaluate((id) => { const it = __bp.LAY.itemById(shedUI.getState(), id), pl = shedUI.getPlan().state.items.find((i) => i.id === id); return { pos: it.pos, planPos: pl && pl.pos, sel: shedUI.getState().sel === id, changes: window.__bpChanges }; }, jig.id);
    ok(`a tap on the picked window (the finger wobbling 2 px) leaves it where it was (${jig2.pos.toFixed(3)} ft; it was 0.150) and it stays picked`, Math.abs(jig2.pos - 0.15) < 1e-9 && jig2.planPos === jig2.pos && jig2.sel, J(jig2));
    await page.evaluate((id) => shedUI.setState((s) => { s.items = s.items.filter((i) => i.id !== id); s.sel = null; }), jig.id);
    /* THE WORDS ON THE PLAN say the right numbers (the pixel comparisons
       leave the letters out, so this is where the numbers are proved): the
       size in the title and on the two dimension lines, and for a picked
       window the gap to the NEXT window along the wall on one side and to
       the corner on the other (model/layout.js neighborGaps) */
    const wr = await page.evaluate(() => {
      const H = __bp, cat = H.cat, ft = shedUI.ftIn;          /* still the Utility Shed 12x24 of this section */
      /* the right-hand wall, which has nothing else on it */
      const a = shedUI.setState((s) => H.ST.addAt(s, "w23", { wall: "R", u: -6 }, cat));
      const b = shedUI.setState((s) => H.ST.addAt(s, "w23", { wall: "R", u: 3 }, cat));
      shedUI.setState((s) => { H.LAY.itemById(s, a.id).pos = -6; H.LAY.itemById(s, b.id).pos = 3; });
      /* a bench turned to run along the length, and a shelf across */
      const bench = shedUI.setState((s) => { const it = H.ST.addInterior(s, "bench", cat, 0); it.px = -3; it.pz = -6; it.rot = true; it.ln = 6; return it; });
      const shelf = shedUI.setState((s) => { const it = H.ST.addInterior(s, "shelf", cat, 0); it.px = 2; it.pz = 6; it.rot = false; it.ln = 8; return it; });
      shedUI.select(b.id);
      const P = CanvasRenderingContext2D.prototype, keep = P.fillText, got = [], turn = {};
      P.fillText = function (t) { got.push(String(t)); const m = this.getTransform(); turn[String(t)] = Math.abs(m.b) > 0.9 * Math.abs(m.a) + 0.1 ? "turned" : "level"; return keep.apply(this, arguments); };
      try { shedUI.blueprint.draw(); } finally { P.fillText = keep; }
      const st = shedUI.getState(), A = H.LAY.itemById(st, a.id), B = H.LAY.itemById(st, b.id), cw = H.LAY.itemW(B, cat.CAT), fr = H.B.planFrame(st, cat), w = fr.ws.R;
      const others = st.items.filter((i) => i.wall === "R" && i.id !== a.id && i.id !== b.id).length;
      /* worked out here from the two windows' own places, not from the plan's code */
      const toNeighbour = (B.pos - cw / 2) - (A.pos + H.LAY.itemW(A, cat.CAT) / 2), toCorner = w.len / 2 - (B.pos + cw / 2), toFarCorner = (B.pos - cw / 2) + w.len / 2;
      const want = { title: "12′ × 24′ — FLOOR PLAN", width: ft(12), length: ft(24), toNeighbour: ft(toNeighbour), toCorner: ft(toCorner), bench: "BENCH 6′", shelf: "SHELF 8′", front: "FRONT", footer: "PORTABLE BUILDINGS · 12 × 24 UTILITY SHED · PINCH TO ZOOM" };
      shedUI.setState((s) => { s.items = s.items.filter((i) => [a.id, b.id, bench.id, shelf.id].indexOf(i.id) < 0); s.sel = null; });
      return { got, want, wrongCorner: ft(toFarCorner), turn, others };
    });
    const miss = Object.keys(wr.want).filter((k) => wr.got.indexOf(wr.want[k]) < 0);
    ok(`the plan's words say the right numbers: the title, ${wr.want.width} across, ${wr.want.length} long, and for the picked window ${wr.want.toNeighbour} to the next window and ${wr.want.toCorner} to the corner`, wr.others === 0 && ["title", "width", "length", "toNeighbour", "toCorner"].every((k) => miss.indexOf(k) < 0) && wr.got.indexOf(wr.wrongCorner) < 0, J({ miss, got: wr.got, want: wr.want }));
    ok(`... and the other words: "${wr.want.bench}" written along its turned bench, "${wr.want.shelf}" across its shelf, FRONT, and the footer with the company's name`, miss.length === 0 && wr.turn[wr.want.bench] === "turned" && wr.turn[wr.want.shelf] === "level", J({ miss, turn: wr.turn }));
    /* an item that is NOT picked does not move: the plan moves */
    await page.evaluate(() => { shedUI.select(null); shedUI.blueprint.reset(); });
    const p2 = await page.evaluate((id) => __bp.itemScreen(id), winId);
    const w2 = await page.evaluate((id) => __bp.LAY.itemById(shedUI.getState(), id).pos, winId);
    await page.mouse.move(p2[0], p2[1]); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(p2[0] + 30 * i / 6, p2[1] + 40 * i / 6);
    await page.mouse.up();
    const w3 = await page.evaluate((id) => ({ pos: __bp.LAY.itemById(shedUI.getState(), id).pos, view: shedUI.blueprint.view(), sel: shedUI.getState().sel }), winId);
    ok("dragging an item that is not picked leaves it where it is and moves the plan instead", w3.pos === w2 && Math.abs(w3.view.ox - 30) < 1 && Math.abs(w3.view.oy - 40) < 1 && !w3.sel, J({ w2, w3 }));
  }

  /* ---------------------------------------------------------------- 5 */
  if (want(5)) section("5. Moving the plan, pinching it, double-tapping it");
  if (want(5)) {
    await page.evaluate(() => { __bp.setDesign("UT", "12x24"); shedUI.select(null); shedUI.blueprint.reset(); });
    /* let the rebuild that setDesign started finish first: a finger held still
       for half a second while the page is busy would count as press-and-hold */
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await sleep(150);
    const box = await (await page.$("#bp")).boundingBox();
    const empty = await page.evaluate(() => __bp.screenOf(-4.5, 2));         /* open floor */
    await page.mouse.move(empty[0], empty[1]); await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(empty[0] - 50 * i / 5, empty[1] + 20 * i / 5);
    await page.mouse.up();
    const v1 = await page.evaluate(() => Object.assign(shedUI.blueprint.view(), { addMenu: !!(document.querySelector("#addpop.open, .addpop.open")) }));
    ok("dragging empty paper moves the plan with the finger", Math.abs(v1.ox + 50) < 1 && Math.abs(v1.oy - 20) < 1, J(v1));
    await page.evaluate(() => shedUI.hideAddPop());
    const pinch = async (pairs) => page.evaluate(([pairs, bx]) => {
      const cv = document.getElementById("bp"), r = cv.getBoundingClientRect();
      const fire = (type, id, x, y, primary) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + x, clientY: r.top + y, isPrimary: primary, pointerType: "touch", bubbles: true, cancelable: true }));
      const cx = r.width / 2, cy = r.height / 2;
      const selBefore = shedUI.getState().sel;
      fire("pointerdown", 11, cx - pairs[0] / 2, cy, true);
      fire("pointerdown", 12, cx + pairs[0] / 2, cy, false);
      const zooms = [];
      for (let i = 1; i < pairs.length; i++) { fire("pointermove", 12, cx - pairs[0] / 2 + pairs[i], cy, false); zooms.push(shedUI.blueprint.view().zoom); }
      fire("pointerup", 12, cx - pairs[0] / 2 + pairs[pairs.length - 1], cy, false);
      fire("pointerup", 11, cx - pairs[0] / 2, cy, true);
      return { zooms, view: shedUI.blueprint.view(), sel: shedUI.getState().sel, selBefore, pop: document.getElementById("addpop").classList.contains("open") };
    }, [pairs, box]);
    await page.evaluate(() => shedUI.blueprint.reset());
    const z1 = await pinch([100, 150, 200]);
    ok(`two fingers spreading from 100 to 200 px apart zoom the plan to 2x (${z1.view.zoom.toFixed(3)})`, Math.abs(z1.view.zoom - 2) < 0.01, J(z1));
    ok("... and pick nothing and open no menu", z1.sel === z1.selBefore && !z1.pop, J(z1));
    const z2 = await pinch([100, 300, 600, 900]);
    ok(`spreading much further stops at 5x (${z2.view.zoom.toFixed(2)})`, Math.abs(z2.view.zoom - 5) < 1e-9 && z2.zooms.every((z) => z <= 5), J(z2.zooms));
    const z3 = await pinch([400, 100, 20]);
    ok(`pinching in never goes below the whole plan (1x) (${z3.view.zoom.toFixed(2)})`, Math.abs(z3.view.zoom - 1) < 1e-9, J(z3.zooms));
    await pinch([100, 250]);
    const zBefore = await page.evaluate(() => shedUI.blueprint.view().zoom);
    const e2 = await page.evaluate(() => __bp.screenOf(-4.5, 2));
    await page.mouse.click(e2[0], e2[1]); await page.mouse.click(e2[0], e2[1]);
    const v2 = await page.evaluate(() => shedUI.blueprint.view());
    ok(`a double-tap on empty paper puts the whole plan back (zoom ${zBefore.toFixed(2)} -> ${v2.zoom}, moved back to the middle)`, zBefore > 1.5 && v2.zoom === 1 && v2.ox === 0 && v2.oy === 0, J({ zBefore, v2 }));
  }

  /* ---------------------------------------------------------------- 6 */
  if (want(6)) section("6. Press and hold: \"Add here\"");
  if (want(6)) {
    await page.evaluate(() => { __bp.setDesign("UT", "12x24"); shedUI.select(null); shedUI.blueprint.reset(); });
    const floor = await page.evaluate(() => __bp.screenOf(-2.5, 3));
    const n0 = await page.evaluate(() => shedUI.getState().items.length);
    await page.mouse.move(floor[0], floor[1]); await page.mouse.down(); await sleep(700);
    const pop = await page.evaluate(() => ({ open: document.getElementById("addpop").classList.contains("open"), choices: Array.from(document.querySelectorAll("#addpop button[data-cat]")).map((b) => b.getAttribute("data-cat") + ":" + b.textContent) }));
    await page.mouse.up();
    const still = await page.evaluate(() => document.getElementById("addpop").classList.contains("open"));
    ok("holding a finger on open floor for half a second opens \"Add here\" with a work bench, a shelf and a light", pop.open && J(pop.choices) === J(["bench:+ Work bench", "shelf:+ Shelf", "ilight:+ Electrical"]), J(pop));
    ok("lifting the finger leaves the menu open (it does not count as a tap)", still);
    await page.click('#addpop button[data-cat="shelf"]');
    const shelf = await page.evaluate((n0) => { const st = shedUI.getState(), it = st.items[st.items.length - 1]; return { n: st.items.length, n0, cat: it.cat, px: it.px, pz: it.pz, rot: it.rot, sel: st.sel === it.id, mode: shedUI.getMode(), pop: document.getElementById("addpop").classList.contains("open") }; }, n0);
    ok(`"+ Shelf" puts a shelf right where the finger was (${shelf.px.toFixed(2)}, ${shelf.pz.toFixed(2)} -- held at -2.50, 3.00), picked, the plan still up`, shelf.n === n0 + 1 && shelf.cat === "shelf" && Math.abs(shelf.px + 2.5) < 0.01 && Math.abs(shelf.pz - 3) < 0.01 && shelf.sel && shelf.mode === "in" && !shelf.pop, J(shelf));
    const ok2 = await page.evaluate(() => { const b = shedUI.blueprint.view(); return true; });
    await page.evaluate(() => shedUI.select(null));
    const wallSpot = await page.evaluate(() => __bp.screenOf(-5.4, -6));    /* 0.6 ft in from the left wall */
    await page.mouse.move(wallSpot[0], wallSpot[1]); await page.mouse.down(); await sleep(700); await page.mouse.up();
    const pop2 = await page.evaluate(() => Array.from(document.querySelectorAll("#addpop button[data-cat]")).map((b) => b.getAttribute("data-cat")));
    ok("holding near a wall offers a door, a window and an outlet on that wall", J(pop2) === J(["w48", "w23", "outlet"]), J(pop2));
    await page.click('#addpop button[data-cat="w23"]');
    const win = await page.evaluate(() => { const st = shedUI.getState(), it = st.items[st.items.length - 1]; return { cat: it.cat, wall: it.wall, pos: it.pos, sel: st.sel === it.id }; });
    ok(`"+ Window" puts the window on the left wall where the finger was (${win.pos.toFixed(2)} ft along; held at -6.00)`, win.cat === "w23" && win.wall === "L" && Math.abs(win.pos + 6) < 0.01 && win.sel, J(win));
    await page.evaluate(() => shedUI.select(null));
    const outside = await page.evaluate(() => __bp.screenOf(-9, 0));
    await page.mouse.move(outside[0], outside[1]); await page.mouse.down(); await sleep(700); await page.mouse.up();
    ok("holding outside the building opens nothing", await page.evaluate(() => !document.getElementById("addpop").classList.contains("open")));
    const f2 = await page.evaluate(() => __bp.screenOf(-2.5, 6));
    await page.mouse.move(f2[0], f2[1]); await page.mouse.down(); await page.mouse.move(f2[0] + 12, f2[1] + 4); await sleep(700); await page.mouse.up();
    ok("moving the finger before the half second is up opens nothing (it was a drag)", await page.evaluate(() => !document.getElementById("addpop").classList.contains("open")));
    await page.evaluate(() => shedUI.blueprint.reset());
  }

  /* ---------------------------------------------------------------- 7 */
  if (want(7)) section("7. The electric package's fixtures on the plan");
  if (want(7)) {
    await page.evaluate(() => { __bp.setDesign("UT", "12x24"); shedUI.select(null); shedUI.blueprint.reset(); });
    await page.click("#modebar");                                        /* start Outside, as a customer would */
    const chip = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("#elecchips button, #elecchips .chip")).find((x) => /Option 3/.test(x.textContent));
      if (b) b.scrollIntoView();
      return !!b;
    });
    ok("the demo offers electric package Option 3", chip);
    await page.evaluate(() => Array.from(document.querySelectorAll("#elecchips button, #elecchips .chip")).find((x) => /Option 3/.test(x.textContent)).click());
    await sleep(50);
    const r = await page.evaluate(() => {
      const H = __bp, R = H.live(), st = shedUI.getState();
      const pk = st.items.filter((i) => i.pk);
      return { mode: shedUI.getMode(), pk: pk.map((it) => Object.assign({ cat: it.cat }, H.symbol(R, it))) };
    });
    ok("picking the package brings the floor plan up by itself", r.mode === "in", J(r.mode));
    const kinds = r.pk.map((p) => p.cat).sort().join(",");
    ok(`the package lays its fixtures: ${r.pk.length} (switch + GFCI, 5 outlets, 2 overhead lights)`, kinds === "gfci,ilight,ilight,outlet,outlet,outlet,outlet,outlet", kinds);
    ok(`every fixture of the package is drawn at its place (${r.pk.filter((p) => p.ok).length} of ${r.pk.length})`, r.pk.length === 8 && r.pk.every((p) => p.ok), J(r.pk.filter((p) => !p.ok)));
    await page.evaluate(() => { const b = document.getElementById("opt-ext"); b.scrollIntoView(); b.click(); });
    const ext = await page.evaluate(() => { const H = __bp, R = H.live(), it = shedUI.getState().items.find((i) => i.pk && H.cat.CAT[i.cat].k === "light"); return it ? H.symbol(R, it) : null; });
    ok("ticking the exterior light draws it as a gold ring just outside the wall, beside the switch", ext && ext.ok, J(ext));
    const file = resolve(OUT, "blueprint-electric-option3.png");
    await page.evaluate(() => window.scrollTo(0, 0));
    await (await page.$("#stage")).screenshot({ path: file });
    shots.push([file, "Utility Shed 12x24 with electric package Option 3 and the exterior light"]);
    await page.evaluate(() => shedUI.setState((s) => { s.elec.pkg = 0; s.elec.ext = false; __bp.LAY.pkFixtures(s, __bp.B.planFrame(s, __bp.cat), __bp.cat); }));
  }

  /* ---------------------------------------------------------------- 8 */
  if (want(8)) section("8. The ramp");
  if (want(8)) {
    const ramp = async (t, size) => page.evaluate(([t, size]) => {
      const H = __bp; H.setDesign(t, size);
      const st0 = shedUI.getState(), s1 = JSON.parse(JSON.stringify(st0)); s1.ramp = "r4"; s1.sel = null;
      const s0 = JSON.parse(JSON.stringify(st0)); s0.ramp = "none"; s0.sel = null;
      const a = H.off(s1, 900, 900, { fit: "barnwright" }), b = H.off(s0, 900, 900, { fit: "barnwright" });   /* the same size with and without it */
      let n = 0, sx = 0, sy = 0;
      for (let i = 0; i < a.img.data.length; i += 4) if (Math.abs(a.img.data[i] - b.img.data[i]) + Math.abs(a.img.data[i + 1] - b.img.data[i + 1]) + Math.abs(a.img.data[i + 2] - b.img.data[i + 2]) > 12) { n++; sx += (i >> 2) % 900; sy += ((i >> 2) / 900) | 0; }
      const wx = (sx / n - a.cx) / a.s, wz = (sy / n - a.cy) / a.s;
      const site = H.B.rampOf(a.fr);
      return { n, wx, wz, W: a.fr.d.W, L: a.fr.d.L, site: site && { u: site.u, porch: site.porch, len: site.len } };
    }, [t, size]);
    const u = await ramp("UT", "10x16");
    ok(`a 4 ft ramp on a Utility Shed is drawn out from its front door (centre ${u.wx.toFixed(1)}, ${u.wz.toFixed(1)} ft; the front wall is at ${u.L / 2})`, u.n > 200 && Math.abs(u.wx) < 0.8 && u.wz > u.L / 2 && u.wz < u.L / 2 + 5, J(u));
    const sc = await ramp("SC", "12x24");
    ok(`on a Side Cabin, whose door opens onto the porch, the ramp is at the porch entry on the side (centre ${sc.wx.toFixed(1)} ft across -- past the side at ${sc.W / 2})`, sc.n > 200 && sc.site && sc.site.porch && sc.wx > sc.W / 2, J(sc));
    await page.evaluate(() => { shedUI.setState((s) => { s.ramp = "r4"; }); });
    const lbl = await page.evaluate(() => { const H = __bp, R = H.live(), site = H.B.rampOf(R.fr), q0 = H.wallPt(site.w, site.u, 0, 0.25 + site.len / 2), q = H.P(R, q0[0], q0[2]); let lit = 0; for (let y = -5; y <= 5; y++) for (let x = -20; x <= 20; x++) if (H.isLight(H.px(R, q[0] + x, q[1] + y))) lit++; return lit; });
    ok("the live plan labels it RAMP 4′", lbl > 15, lbl);
    await page.evaluate(() => { shedUI.setState((s) => { s.ramp = "none"; }); });
  }

  /* ---------------------------------------------------------------- 9 */
  if (want(9)) section("9. A look-only page");
  if (want(9)) {
    await page.evaluate(() => { __bp.setDesign("UT", "12x24"); shedUI.select(null); shedUI.blueprint.reset(); shedUI.setReadOnly(true); });
    const door = await page.evaluate(() => __bp.itemScreen(shedUI.getState().items[0].id));
    await page.mouse.click(door[0], door[1]);
    const sel = await page.evaluate(() => shedUI.getState().sel);
    const floor = await page.evaluate(() => __bp.screenOf(-2.5, -3));
    await page.mouse.move(floor[0], floor[1]); await page.mouse.down(); await sleep(700); await page.mouse.up();
    const pop = await page.evaluate(() => document.getElementById("addpop").classList.contains("open"));
    ok("on a look-only page a tap picks nothing and holding adds nothing", !sel && !pop, J({ sel, pop }));
    await page.evaluate(() => shedUI.setReadOnly(false));
  }

  /* ---------------------------------------------------------------- 10 */
  if (want(10)) section("10. drawPlanPicture, for the quote pictures");
  if (want(10)) {
    const r = await page.evaluate(() => {
      const H = __bp; H.setDesign("SC", "12x24");
      const st = shedUI.getState(), it = st.items[0];
      shedUI.select(it.id);
      const cyan = (cv) => { const d = H.imgOf(cv).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] > 100 && d[i] < 150 && d[i + 1] > 190) n++; return n; };
      const a = H.B.drawPlanPicture(shedUI.getState(), H.cat, 600, 420);
      const b = H.B.drawPlanPicture(shedUI.getState(), H.cat, 600, 420, { selection: false });
      const c = H.B.drawPlanPicture(shedUI.getState(), H.cat, 1200, 840, { scale: 2 });
      /* the words painted on a picture, and on the live plan */
      const words = (fn) => { const P = CanvasRenderingContext2D.prototype, keep = P.fillText, got = []; P.fillText = function (t) { got.push(String(t)); return keep.apply(this, arguments); }; try { fn(); } finally { P.fillText = keep; } return got; };
      const picWords = words(() => H.B.drawPlanPicture(shedUI.getState(), H.cat, 600, 420, { selection: false }));
      const liveWords = words(() => shedUI.blueprint.draw());
      const R = { img: H.imgOf(a), W: 600, H: 420 };
      const mode = shedUI.getMode();
      shedUI.select(null);
      return { a: [a.width, a.height], c: [c.width, c.height], paper: H.isPaper(H.px(R, 3, 200)), cyanSel: cyan(a), cyanNo: cyan(b), url: c.toDataURL("image/png"), mode, isCanvas: a instanceof HTMLCanvasElement, picWords, liveWords };
    });
    ok("drawPlanPicture(state, catalogue, 600, 420) hands back a 600 x 420 canvas with the plan on its navy paper", r.isCanvas && J(r.a) === J([600, 420]) && r.paper, J({ a: r.a, paper: r.paper }));
    ok("scale 2 draws the same plan twice the size (1200 x 840)", J(r.c) === J([1200, 840]));
    ok("with selection:false the picked item's highlight and measurements are left out", r.cyanSel > r.cyanNo, J({ with: r.cyanSel, without: r.cyanNo }));
    ok("making the picture does not change the screen (still Inside)", r.mode === "in");
    const foot = (ws) => ws.find((w) => /SIDE CABIN/.test(w)) || "";
    ok(`the picture's footer names the company and the building without "PINCH TO ZOOM" ("${foot(r.picWords)}"); the plan on the screen still says it`, /^PORTABLE BUILDINGS · 12 × 24 SIDE CABIN$/.test(foot(r.picWords)) && /PINCH TO ZOOM$/.test(foot(r.liveWords)) && !r.picWords.some((w) => /PINCH/.test(w)), J({ pic: r.picWords, live: r.liveWords }));
    const file = resolve(OUT, "blueprint-picture-SC-12x24.png");
    writeFileSync(file, Buffer.from(r.url.split(",")[1], "base64"));
    shots.push([file, "drawPlanPicture of a Side Cabin 12x24 at 1200 x 840, scale 2 (the quote picture)"]);
  }
  ok("no errors in the browser console on the desktop page", realNoise(noise).length === 0, J(realNoise(noise)));

  /* ---------------------------------------------------------------- 11 */
  if (want(11)) section("11. On a phone (390 x 844, two pixels per point, touch)");
  if (want(11)) {
    const pctx = await newContext(browser, { viewport: { width: 390, height: 844 }, dpr: 2, touch: true, mobile: true });
    const { page: pp, noise: pn } = await openPage(pctx);
    await pp.evaluate(() => { __bp.setDesign("LB", "12x24"); });
    await pp.tap("#modebar");
    const r = await pp.evaluate(() => { const cv = document.getElementById("bp"), H = __bp, R = H.live(); return { w: cv.width, h: cv.height, cw: cv.clientWidth, ch: cv.clientHeight, d: R.d, door: H.symbol(R, shedUI.getState().items[0]), mode: shedUI.getMode() }; });
    ok(`the plan is drawn at two pixels per point (${r.w} x ${r.h} for a ${r.cw} x ${r.ch} canvas)`, r.mode === "in" && r.w === r.cw * 2 && Math.abs(r.h - r.ch * 2) <= 2 && r.d === 2, J(r));
    ok("the double doors are drawn on the phone too", r.door.ok, J(r.door));
    /* the price plate lies right across the foot of a phone's picture: the
       front of the plan -- the doors, the ends of their swings, FRONT -- must
       be drawn above it, where a finger and an eye can reach it */
    const clear = await pp.evaluate(() => {
      const H = __bp, st = shedUI.getState(), cat = H.cat, v = shedUI.blueprint.view(), fr = H.B.planFrame(st, cat), cv = shedUI.mounts.bp, cr = cv.getBoundingClientRect();
      const on = (wx, wz) => { const p = shedUI.blueprint.toScreen(wx, wz), q = [cr.left + p[0], cr.top + p[1]]; return document.elementFromPoint(q[0], q[1]) === cv; };
      const spots = [];
      for (const it of st.items) {
        const c = cat.CAT[it.cat]; if (!c || c.k !== "door") continue;
        const w = fr.ws[it.wall], cw = H.LAY.itemW(it, cat.CAT), r = c.leaves === 2 ? cw / 2 : cw;
        for (const u of [it.pos - cw / 2, it.pos + cw / 2, it.pos]) { const q = H.wallPt(w, u, 0, u === it.pos ? 0 : r); spots.push(on(q[0], q[2])); }
      }
      const fy = (v.cy + fr.d.L / 2 * v.s + 26 * v.d) / v.d, fx = v.cx / v.d;
      const front = document.elementFromPoint(cr.left + fx, cr.top + fy - 3) === cv;
      return { spots, front, bot: v.bot, plate: document.getElementById("plate").getBoundingClientRect().top - cr.top };
    });
    ok(`on the phone the doors, the ends of their swings and FRONT are drawn above the price plate, not under it (${clear.spots.filter(Boolean).length} of ${clear.spots.length} door points on show, FRONT ${clear.front ? "on show" : "hidden"})`, clear.spots.length >= 3 && clear.spots.every(Boolean) && clear.front && clear.bot > 0, J(clear));
    const door = await pp.evaluate(() => __bp.itemScreen(shedUI.getState().items[0].id));
    await pp.touchscreen.tap(door[0], door[1]);
    await sleep(350);
    ok("a finger tapping the doors picks them", await pp.evaluate(() => shedUI.getState().sel === shedUI.getState().items[0].id));
    /* picking opens the item sheet, which scrolls the page; the click a phone
       sends after a tap must not then land on the Outside button that has
       scrolled under the finger */
    const stay = await pp.evaluate(() => ({ mode: shedUI.getMode(), scrolled: window.scrollY }));
    ok(`... and the plan stays on the screen (the page scrolled ${stay.scrolled} px to show the item sheet; the tap did not also press "Outside")`, stay.mode === "in", J(stay));
    const file = resolve(OUT, "blueprint-phone-LB-12x24.png");
    await (await pp.$("#stage")).screenshot({ path: file });
    shots.push([file, "the Inside view on a phone, Lofted Barn 12x24 with its doors picked (the measurements to the corners show)"]);
    ok("no errors in the browser console on the phone", realNoise(pn).length === 0, J(realNoise(pn)));
    await pctx.close();
  }

  /* ---------------------------------------------------------------- 12 */
  if (want(12)) section("12. Side by side with Barnwright's own floor plan");
  if (want(12)) {
    await serve(BW_PUBLIC, BW_PORT, "3ddesign.html");
    const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
    const bw = await bctx.newPage();
    const bwErrors = [];
    bw.on("pageerror", (e) => bwErrors.push(String(e)));
    const origin = "http://127.0.0.1:" + BW_PORT;
    await bw.route("**/*", (route) => {
      const u = route.request().url();
      if (!u.startsWith(origin + "/")) return route.abort();
      if (/shedline-[a-z]+\.json|designs(-img)?\/|\.netlify\/functions/.test(u)) return route.abort();
      return route.continue();
    });
    await bw.goto(origin + "/" + BARNWRIGHT_PAGE, { waitUntil: "load" });
    await bw.waitForFunction(() => typeof bpDraw === "function" && typeof setMode === "function" && window.state && state.items.length > 0, null, { timeout: 60000 });
    const CASES = [["UT", "10x16", "Utility Shed", "plain"], ["LB", "12x24", "Lofted Barn", "plain"], ["DK", "8x12", "Dog Kennel", "plain"], ["SC", "12x24", "Side Cabin", "porch"]];
    for (const [t, size, name, kind] of CASES) {
      const design = await page.evaluate(([t, size]) => { __bp.setDesign(t, size); shedUI.select(null); const s = JSON.parse(JSON.stringify(shedUI.getState())); return s; }, [t, size]);
      const bwShot = await bw.evaluate((ds) => {
        setType(ds.type); setSize(ds.size);
        state.items = JSON.parse(JSON.stringify(ds.items)); state.seq = ds.seq; state.sel = null;
        state.pLen = ds.pLen; state.pFlip = ds.pFlip; state.pMid = ds.pMid; state.ramp = ds.ramp; state.elec = ds.elec;
        buildShed(); setMode("in");
        const cv = document.getElementById("bp");
        return { url: cv.toDataURL("image/png"), w: cv.width, h: cv.height };
      }, design);
      const cmp = await page.evaluate(async ([bwShot, name]) => {
        const H = __bp, st = JSON.parse(JSON.stringify(shedUI.getState())); st.sel = null;
        const img = new Image(); img.src = bwShot.url; await img.decode();
        const w = bwShot.w, h = bwShot.h;
        const bcv = document.createElement("canvas"); bcv.width = w; bcv.height = h; const bx = bcv.getContext("2d", { willReadFrequently: true }); bx.drawImage(img, 0, 0);
        const A = bx.getImageData(0, 0, w, h).data;
        /* the same rules as Barnwright (its size); the page itself may draw a
           plan a little smaller when a door swing would run off the paper */
        const ours = H.off(st, w, h, { selection: false, fit: "barnwright" }), Bd = ours.img.data, R = ours, d = 1;
        const shown = H.off(st, w, h, { selection: false });
        const sameAsShown = shown.s === ours.s;
        const fr = R.fr, W = fr.d.W, L = fr.d.L;
        /* the boxes where letters are written (Barnwright's page falls back to a serif font, ours to a sans-serif) */
        const P = (x, z) => H.P(R, x, z);
        const boxes = [[R.cx - 170, 0, R.cx + 170, 26], [w * 0.35, h - 24, w, h], [R.cx - 40, P(0, L / 2)[1] + 14, R.cx + 40, P(0, L / 2)[1] + 34],
          [R.cx - 50, P(0, -L / 2)[1] - 21, R.cx + 50, P(0, -L / 2)[1] - 3], [P(-W / 2, 0)[0] - 12 - 42, R.cy - 9, P(-W / 2, 0)[0] - 12 + 42, R.cy + 9]];
        const pr = H.B.porchRect(fr);
        if (pr) { const q = P(pr[0] + pr[2] / 2, pr[1] + pr[3] / 2); boxes.push([q[0] - 36, q[1] - 9, q[0] + 36, q[1] + 9]); }
        const inText = (x, y) => boxes.some((b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]);
        let diff = 0, diffOut = 0, lineA = 0, lineB = 0, lineBoth = 0;
        const map = new Uint8ClampedArray(w * h * 4);
        const isLine = (a, i) => Math.abs(a[i] - 234) < 14 && Math.abs(a[i + 1] - 244) < 14 && Math.abs(a[i + 2] - 251) < 14;
        for (let i = 0, p = 0; i < A.length; i += 4, p++) {
          const dd = Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2]);
          const x = p % w, y = (p / w) | 0, t = inText(x, y);
          const la = isLine(A, i), lb = isLine(Bd, i);
          if (la) lineA++; if (lb) lineB++; if (la && lb) lineBoth++;
          if (dd > 30) { diff++; if (!t) diffOut++; map[i] = t ? 255 : 255; map[i + 1] = t ? 200 : 40; map[i + 2] = t ? 60 : 40; map[i + 3] = 255; }
          else { const g = (A[i] + A[i + 1] + A[i + 2]) / 9; map[i] = g; map[i + 1] = g; map[i + 2] = g; map[i + 3] = 255; }
        }
        const mcv = document.createElement("canvas"); mcv.width = w; mcv.height = h; mcv.getContext("2d").putImageData(new ImageData(map, w, h), 0, 0);
        /* Barnwright | ours | the difference, with a caption strip */
        const panels = sameAsShown ? 3 : 4;
        const comp = document.createElement("canvas"); comp.width = w * panels + 20 * (panels - 1); comp.height = h + 44;
        const cx2 = comp.getContext("2d"); cx2.fillStyle = "#ffffff"; cx2.fillRect(0, 0, comp.width, comp.height);
        cx2.drawImage(bcv, 0, 44); cx2.drawImage(ours.canvas, w + 20, 44); cx2.drawImage(mcv, 2 * w + 40, 44);
        if (!sameAsShown) cx2.drawImage(shown.canvas, 3 * w + 60, 44);
        cx2.fillStyle = "#0E3A5F"; cx2.font = "600 18px Arial, sans-serif"; cx2.textBaseline = "middle";
        cx2.fillText("BARNWRIGHT — " + name, 10, 22); cx2.fillText("OURS — " + name + (sameAsShown ? "" : " (Barnwright's size)"), w + 30, 22); cx2.fillText("DIFFERENCE (red: shape, orange: letters)", 2 * w + 50, 22);
        if (!sameAsShown) cx2.fillText("OURS AS THE PAGE SHOWS IT (swing kept on)", 3 * w + 70, 22);
        return { w, h, diff, diffOut, total: w * h, lineIoU: lineBoth / Math.max(1, lineA + lineB - lineBoth), sameAsShown, comp: comp.toDataURL("image/png"), ours: shown.canvas.toDataURL("image/png") };
      }, [bwShot, name]);
      const base = `blueprint-vs-barnwright-${t}-${size}`;
      writeFileSync(resolve(OUT, base + ".png"), Buffer.from(cmp.comp.split(",")[1], "base64"));
      writeFileSync(resolve(OUT, `blueprint-barnwright-${t}-${size}.png`), Buffer.from(bwShot.url.split(",")[1], "base64"));
      writeFileSync(resolve(OUT, `blueprint-ours-${t}-${size}.png`), Buffer.from(cmp.ours.split(",")[1], "base64"));
      shots.push([resolve(OUT, base + ".png"), `Barnwright | ours | difference, ${name} ${size}`]);
      const pct = (v) => (100 * v / cmp.total).toFixed(3) + "%";
      console.log(`       ${name} ${size} at Barnwright's ${cmp.w} x ${cmp.h}: ${pct(cmp.diff)} of the pixels differ, ${pct(cmp.diffOut)} outside the letters; the white lines (walls, doors, windows) overlap ${(cmp.lineIoU * 100).toFixed(1)}%` + (cmp.sameAsShown ? "" : " -- compared at Barnwright's size; the page draws this one a little smaller so its door swing stays on the paper (fourth picture)"));
      if (kind === "plain") {
        /* pixel for pixel means pixel for pixel: a dimension line one foot
           short is only ~60 pixels, so the allowance is 20 pixels, not a share */
        ok(`${name} ${size}: outside the letters ours is Barnwright's plan pixel for pixel (${cmp.diffOut} of ${cmp.total} pixels differ)`, cmp.diffOut <= 20, J({ diff: cmp.diff, diffOut: cmp.diffOut }));
        ok(`${name} ${size}: the walls, doors and windows are the same lines (${(cmp.lineIoU * 100).toFixed(1)}% overlap)`, cmp.lineIoU > 0.97, cmp.lineIoU);
      } else {
        ok(`${name} ${size}: the lines of the building are Barnwright's (${(cmp.lineIoU * 100).toFixed(1)}% overlap) -- only the porch outline moved, to the porch`, cmp.lineIoU > 0.95 && cmp.diffOut / cmp.total < 0.02, J({ diffOut: cmp.diffOut, iou: cmp.lineIoU }));
      }
    }
    ok("Barnwright's page raised no errors while drawing its plans", bwErrors.length === 0, J(bwErrors));
    await bctx.close();
  }
  ok("no errors in the browser console by the end", realNoise(noise).length === 0, J(realNoise(noise)));
  await ctx.close();
} catch (e) {
  fail++; failures.push("the check itself crashed: " + (e && e.message));
  console.log("  FAIL the check itself crashed:\n       " + (e && e.stack || e));
} finally {
  if (browser) await browser.close();
  stopServers();
}

if (shots.length) {
  console.log("\nPictures written:");
  for (const [f, what] of shots) console.log("  " + f.replace(ROOT + "/", "") + "  --  " + what);
}
console.log(`\ncheck-blueprint: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("PROVED: the Inside view draws the floor plan of every building the demo sells -- walls, porch, posts, every door, window, roll-up and fixture with its own symbol, the ramp, the electric package -- like Barnwright's, pixel for pixel outside the letters; a tap picks, a drag moves the item (and the 3D follows), two fingers zoom, a double-tap resets, press-and-hold adds, a look-only page stays look-only, and drawPlanPicture hands the quote its picture.");
