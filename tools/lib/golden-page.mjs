/* OPEN BARNWRIGHT'S 3D DESIGNER THE SAME WAY EVERY TIME, SO ITS DRAWING CAN BE RECORDED.

   Used by tools/capture-golden.mjs. It starts a small web server over
   Barnwright's public/ folder on port 8303 (READ ONLY -- nothing here writes a
   byte there), opens 3ddesign.html in headless Chromium with software WebGL,
   and makes the page repeatable:

   - a fixed 1440x900 window, 1 device pixel per CSS pixel, "reduce motion" on
     (so Barnwright's opening auto-spin never starts), service workers blocked;
   - nothing leaves this machine, and Barnwright's boot-time database loads
     (office prices, colours, extras) are refused, so its built-in tables are
     what it draws with;
   - THE TEXTURES ARE SEEDED. Barnwright paints its 11 surface pictures (siding
     grain, metal ribs, grass...) with Math.random, so every load differs a
     little. Before any of Barnwright's scripts run we (a) replace Math.random
     with one that reads the "current texture generator", and (b) watch
     document.createElement: when mkTex creates its FIRST canvas (line 1717 of
     the pinned file -- that is the entry of one mkTex call) the generator is
     restarted as mulberry32(textureSeed(i)), i = 0 for the first texture
     (siding) ... 10 for the last (corner shadow). mkTex runs its painter and
     then its height painter synchronously, so both draw from that one
     restarted stream -- exactly what engine/textures.js does with
     { seeded: true }. When mkTex uploads the finished picture (texImage2D with
     an ImageData) we keep a copy of its bytes and stop the generator, so any
     other random call is counted as "outside a texture";
   - the texture bytes kept are the exact RGBA that went to the graphics card
     (after mkTex's brightness normalising and height-in-alpha packing).

   It also carries the in-page code the capture runs: the case interpreter
   (sets Barnwright's state through its own functions), the triangle labeller
   (hooks pushTri / uploadBuffers and the wrapped functions listed in
   barnwright-blocks.mjs, then puts every original back), and the picture
   taker for the look fixtures (fixed camera, shadows forced on, the
   frame-cost watchdogs frozen, draw() twice -- see inPageLook for why --
   and read the canvas in the same task). */

import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { MULBERRY32_SOURCE, textureSeed } from "../../engine/seeded.js";
import { BARNWRIGHT_PUBLIC, BARNWRIGHT_SHA256, MKTEX_ENTRY_LINE, BARNWRIGHT_PAGE } from "./barnwright-blocks.mjs";

const require = createRequire(import.meta.url);

export const PORT = 8303;
export const VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const DEVICE_SCALE_FACTOR = 1;
export const CHROMIUM_ARGS = Object.freeze(["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]);
export const TEXTURE_COUNT = 11;

export function loadPlaywright() {
  return require("/opt/node22/lib/node_modules/playwright/index.js");
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function probe(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  } catch (e) {
    return null;
  }
}

/* The page the browser will actually be given must be the pinned copy, byte
   for byte -- checking the file on disk is not enough when a server that was
   already running is reused (it could be serving some other folder). */
function assertServedPinned(buf, url) {
  const sha = createHash("sha256").update(buf).digest("hex");
  if (sha !== BARNWRIGHT_SHA256) {
    throw new Error(`${url}3ddesign.html is not the pinned Barnwright copy (SHA-256 ${sha}). ` +
      "Something else is answering on that port: stop it, or let the capture start its own server.");
  }
}

/* Serve Barnwright's public/ folder on our port. If something already answers
   there with the same file, reuse it (a previous run left it up). */
export async function startServer(port = PORT) {
  const url = `http://127.0.0.1:${port}/`;
  const already = await probe(url + "3ddesign.html");
  if (already != null) {
    assertServedPinned(already, url);
    return { url, reused: true, stop: async () => {} };
  }
  const child = spawn("npx", ["http-server", BARNWRIGHT_PUBLIC, "-p", String(port), "-a", "127.0.0.1", "-s", "-c-1"], {
    stdio: "ignore", detached: true,
  });
  let dead = false;
  child.on("exit", () => { dead = true; });
  for (let i = 0; ; i++) {
    if (dead) throw new Error(`The web server on port ${port} did not start (is the port taken?).`);
    const got = await probe(url + "3ddesign.html");
    if (got != null) {
      try { assertServedPinned(got, url); } catch (e) { try { process.kill(-child.pid, "SIGTERM"); } catch (e2) { /* gone */ } throw e; }
      break;
    }
    if (i > 300) throw new Error(`The web server on port ${port} never answered.`);
    await sleep(100);
  }
  return {
    url, reused: false,
    stop: async () => { try { process.kill(-child.pid, "SIGTERM"); } catch (e) { /* gone */ } await sleep(50); },
  };
}

export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  return chromium.launch({ args: [...CHROMIUM_ARGS] });
}

/* The script that runs in the page before any of Barnwright's own. */
function initScript() {
  const seeds = [];
  for (let i = 0; i < 32; i++) seeds.push(textureSeed(i));
  return `(function(){
  var mulberry32 = ${MULBERRY32_SOURCE};
  var SEEDS = ${JSON.stringify(seeds)};
  var ENTRY_LINE = ${MKTEX_ENTRY_LINE};
  var G = { texIndex: 0, rand: null, tex: [], randomInside: 0, randomOutside: 0, entries: [] };
  Object.defineProperty(window, "__golden", { value: G, enumerable: false, configurable: false, writable: false });
  var nativeRandom = Math.random;
  Math.random = function random(){
    if (G.rand) { G.randomInside++; return G.rand(); }
    G.randomOutside++; return nativeRandom();
  };
  /* the first frame of the stack that is in Barnwright's page: {fn, line} */
  function pageFrame(stack){
    var lines = String(stack).split("\\n");
    for (var i = 1; i < lines.length; i++) {
      var m = /at (?:(\\S+) \\()?(.*?):(\\d+):(\\d+)\\)?\\s*$/.exec(lines[i]);
      if (m && /\\/3ddesign\\.html(\\?[^\\s]*)?$/.test(m[2])) return { fn: m[1] || "", line: +m[3] };
    }
    return null;
  }
  var origCE = Document.prototype.createElement;
  Document.prototype.createElement = function createElement(tag){
    if (typeof tag === "string" && tag.toLowerCase() === "canvas") {
      var f = pageFrame(new Error().stack);
      if (f && f.fn === "mkTex" && f.line === ENTRY_LINE) {
        G.entries.push(G.texIndex);
        G.rand = mulberry32(SEEDS[G.texIndex]);
        G.texIndex++;
      }
    }
    return origCE.apply(this, arguments);
  };
  /* count fetches still in flight, so the capture can wait for the refused
     boot-time loads to finish failing (instead of guessing with a timer) */
  G.pendingFetch = 0;
  var origFetch = window.fetch;
  window.fetch = function fetch(){
    G.pendingFetch++;
    var done = function(){ G.pendingFetch--; };
    var p = origFetch.apply(this, arguments);
    p.then(done, done);
    return p;
  };
  var origTI = WebGLRenderingContext.prototype.texImage2D;
  WebGLRenderingContext.prototype.texImage2D = function texImage2D(){
    var src = arguments[arguments.length - 1];
    if (arguments.length === 6 && src instanceof ImageData) {
      G.tex.push({ index: G.texIndex - 1, w: src.width, h: src.height, data: new Uint8Array(src.data) });
      G.rand = null;
    }
    return origTI.apply(this, arguments);
  };
})();`;
}

/* A fresh, isolated browser context with one page on Barnwright's designer,
   loaded, painted and idle. */
export async function openPage(browser, server) {
  const context = await browser.newContext({
    viewport: { ...VIEWPORT },
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String((e && e.message) || e)));
  const origin = server.url.replace(/\/$/, "");
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (!u.startsWith(origin + "/")) return route.abort();
    if (/shedline-[a-z]+\.json|designs(-img)?\/|\.netlify\/functions/.test(u)) return route.abort();
    return route.continue();
  });
  await page.addInitScript({ content: initScript() });
  await page.goto(origin + "/" + BARNWRIGHT_PAGE, { waitUntil: "load" });   /* its warm light: what the answers were recorded in */
  await page.waitForFunction((n) =>
    window.__golden && window.__golden.tex.length === n &&
    typeof buildShed === "function" && typeof renderItem === "function" &&
    window.state && Array.isArray(state.items) && state.items.length > 0 &&
    typeof TYPES === "object" && typeof CAT === "object" && buckets && ORDER && ORDER.length > 0,
    TEXTURE_COUNT, { timeout: 120000 });
  /* let every refused boot-time load finish failing before anything is set */
  await page.waitForFunction(() => window.__golden.pendingFetch === 0, null, { timeout: 60000 });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  await page.waitForFunction(() => window.__golden.pendingFetch === 0, null, { timeout: 60000 });
  if (errors.length) throw new Error("Barnwright's page reported errors while loading: " + errors.join(" | "));
  return {
    page, context, errors,
    async close() { try { await context.close(); } catch (e) { /* ignore */ } },
  };
}

/* The SHA-256 of each seeded texture's bytes, in creation order, and how the
   seeding went on this load. */
export async function textureReport(page) {
  return page.evaluate(async () => {
    const G = window.__golden;
    const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const names = ["texSiding", "texMetal", "texTrim", "texFlat", "texGrass", "texGlass", "texRoofMetal", "texRoofCap", "texAO", "texAOv", "texAOcorner"];
    const out = [];
    for (const t of G.tex) {
      out.push({ index: t.index, size: [t.w, t.h], sha256: hex(await crypto.subtle.digest("SHA-256", t.data)) });
    }
    return {
      textures: out,
      mkTexEntries: G.entries.slice(),
      randomInsideTextures: G.randomInside,
      randomOutsideTextures: G.randomOutside,
      globalsDefined: names.every((n) => window[n] && typeof window[n] === "object"),
    };
  });
}

/* ---------------------------------------------------------------------------
   IN-PAGE CODE. Each function below is handed to page.evaluate, so it runs
   inside Barnwright's page and may only use Barnwright's globals and its
   argument. They are written as plain functions (no closures over Node). */

/* Run a case's steps, on a freshly opened page, through Barnwright's own
   functions. Returns what happened, for the record. */
export function inPageRunSteps(arg) {
  const steps = arg.steps;
  const names = {};
  const log = [];
  const WALL_YAW = { F: 0, R: Math.PI / 2, B: Math.PI, L: -Math.PI / 2 };
  function find(sel) {
    if (sel == null) throw new Error("no item selector");
    if (typeof sel === "string") {
      if (sel === "last") return state.items[state.items.length - 1];
      if (names[sel]) return itemById(names[sel]);
      const byId = itemById(sel);
      if (byId) return byId;
      throw new Error("no item named " + sel);
    }
    const hits = state.items.filter((i) =>
      (sel.cat == null || i.cat === sel.cat) && (sel.wall == null || i.wall === sel.wall) &&
      (sel.inc == null || !!i.inc === sel.inc));
    const it = hits[sel.nth || 0];
    if (!it) throw new Error("no item matches " + JSON.stringify(sel));
    return it;
  }
  function hexFor(group, name) {
    const list = group === "metal" ? COLORS.metal : group === "trim" ? COLORS.trim : COLORS.paint;
    const hit = list.filter((c) => c[0] === name)[0];
    if (!hit) throw new Error("no colour " + name + " in " + group);
    return hit[1];
  }
  for (const s of steps) {
    switch (s.op) {
      case "setType": setType(s.type); break;
      case "setSize": setSize(s.size); break;
      case "resetItems": resetItems(); refreshUI(); break;
      case "flipPorch": flipPorch(); break;
      case "porchLen": state.pLen = s.len; state.items.forEach(clampPos); refreshUI(); break;          /* the 4x8 / 4x12 chip */
      case "porchMid": state.pMid = !!s.mid; resetItems(); refreshUI(); break;                          /* corner / middle chip */
      case "dormer": state.dormer = s.value; refreshUI(); break;                                         /* a dormer chip */
      case "color": state[s.key] = s.hex != null ? s.hex : hexFor(s.group, s.name); refreshUI(); break; /* a swatch */
      case "opt": state.opts[s.key] = !!s.on; refreshUI(); break;                                        /* an option toggle */
      case "elec": state.elec.pkg = s.pkg; if (s.ext != null) state.elec.ext = !!s.ext; pkFixtures(); refreshUI(); setMode("out"); break;
      case "ramp": state.ramp = s.value; refreshUI(); break;
      case "addItem": {                                 /* turn to face the wall, press the add button */
        if (s.face) cam.yaw = WALL_YAW[s.face];
        addItem(s.cat);
        if (s.as) names[s.as] = state.sel;
        break;
      }
      case "addInterior": {
        if (s.face) cam.yaw = WALL_YAW[s.face];
        addInterior(s.cat);
        if (s.as) names[s.as] = state.sel;
        setMode("out");
        break;
      }
      case "edit": {                                    /* an item-sheet toggle or a drag: change the item, then clampPos as the UI does */
        const it = find(s.item);
        for (const k of Object.keys(s.set)) it[k] = s.set[k];
        if (s.toWall) { it.wall = s.toWall; it.pos = 0; it.vy = 0; }
        clampPos(it);
        if (s.as) names[s.as] = it.id;
        break;
      }
      case "drag": {                                    /* where a drag leaves an item: new pos (and height), clampPos, snapCenter, clampPos */
        const it = find(s.item);
        if (s.pos != null) it.pos = s.pos;
        if (s.vy != null) it.vy = s.vy;
        clampPos(it);
        if (snapCenter(it)) clampPos(it);
        break;
      }
      case "delete": {
        const it = find(s.item);
        state.items.splice(state.items.indexOf(it), 1);
        break;
      }
      case "select": select(find(s.item).id); break;
      case "deselect": select(null); break;
      default: throw new Error("unknown step " + s.op);
    }
    log.push(s.op);
  }
  if (MODE !== "out") setMode("out");
  if (yawAnim) yawAnim = null;
  return { log, sel: state.sel };
}

/* Record one build: hook pushTri (and the wrapped functions), call
   buildShed() once, put everything back. Returns per bucket its parameters,
   every vertex float (as base64 of a Float64Array, exact), and the part label
   of every triangle. Then builds again WITHOUT the labeller and returns that
   build's vertices too, so the capture can prove the hooks changed nothing. */
export function inPageCapture(table) {
  const saved = {};
  const wrapStack = [];
  const tagsOf = new Map();
  const keyOf = new Map();
  const texNames = [["texSiding", "siding"], ["texMetal", "metal"], ["texTrim", "trim"], ["texFlat", "flat"],
    ["texGrass", "grass"], ["texGlass", "glass"], ["texRoofMetal", "roofMetal"], ["texRoofCap", "roofCap"],
    ["texAO", "ao"], ["texAOv", "aoV"], ["texAOcorner", "aoCorner"]];
  const problems = [];
  function b64(arr) {
    const f = new Float64Array(arr);
    const u8 = new Uint8Array(f.buffer);
    let s = "";
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function lineTag(stack) {
    const lines = String(stack).split("\n");
    for (let i = 1; i < lines.length; i++) {
      const m = /at (?:(\S+) \()?(.*?):(\d+):(\d+)\)?\s*$/.exec(lines[i]);
      if (!m || !/\/3ddesign\.html(\?\S*)?$/.test(m[2])) continue;   /* the page is opened with ?light=warm */
      const ln = +m[3];
      if (ln < table.buildShed.from || ln > table.buildShed.to) continue;
      for (const r of table.lineRanges) if (ln >= r.from && ln <= r.to) return r.part;
      return "UNTAGGED:buildShed line " + ln;
    }
    return "UNTAGGED:no buildShed frame";
  }
  function bucketKey(b) {
    if (keyOf.has(b)) return keyOf.get(b);
    for (const k in buckets) if (buckets[k] === b) { keyOf.set(b, k); return k; }
    return null;
  }
  function params(b) {
    const out = {};
    const known = texNames.filter((t) => window[t[0]] === b.tex);
    if (known.length !== 1) problems.push("a bucket uses a texture that is not one of the 11");
    out.tex = known.length ? known[0][1] : "UNKNOWN";
    for (const k of Object.keys(b).sort()) {
      if (k === "v" || k === "n" || k === "buf" || k === "count" || k === "tex") continue;
      out[k] = b[k];
    }
    return out;
  }
  let captured = null, plain = null;
  const origUpload = window.uploadBuffers;
  try {
    saved.limit = Error.stackTraceLimit;
    Error.stackTraceLimit = Infinity;
    for (const fname of Object.keys(table.wrappers)) {
      const orig = window[fname];
      if (typeof orig !== "function") throw new Error("Barnwright has no function " + fname);
      saved[fname] = orig;
      const fixed = table.wrappers[fname];
      window[fname] = function () {
        let tag = fixed;
        if (fname === "renderItem") {
          const it = arguments[0];
          tag = table.itemParts[it && it.cat] || (table.interior.indexOf(it && it.cat) >= 0 ? "INTERIOR:" + it.cat : "UNTAGGED:item " + (it && it.cat));
        }
        wrapStack.push(tag);
        try { return orig.apply(this, arguments); } finally { wrapStack.pop(); }
      };
    }
    saved.pushTri = window.pushTri;
    const origPush = saved.pushTri;
    window.pushTri = function (b) {
      const tag = wrapStack.length ? wrapStack[wrapStack.length - 1] : lineTag(new Error().stack);
      let list = tagsOf.get(b);
      if (!list) { list = []; tagsOf.set(b, list); }
      list.push(tag);
      return origPush.apply(this, arguments);
    };
    window.uploadBuffers = function () {
      const out = [];
      for (const k of ORDER) {
        const b = buckets[k];
        const tags = tagsOf.get(b) || [];
        if (tags.length * 3 !== b.n) problems.push("bucket " + k + " has " + b.n + " vertices but " + tags.length + " labelled triangles");
        if (bucketKey(b) !== k) problems.push("bucket " + k + " is not where ORDER says");
        out.push({ key: k, params: params(b), n: b.n, v: b64(b.v), tags });
      }
      const extra = Object.keys(buckets).filter((k) => ORDER.indexOf(k) < 0);
      if (extra.length) problems.push("buckets missing from ORDER: " + extra.join(","));
      captured = out;
      return origUpload.apply(this, arguments);
    };
    buildShed();
  } finally {
    for (const k of Object.keys(saved)) {
      if (k === "limit") Error.stackTraceLimit = saved.limit;
      else window[k] = saved[k];
    }
    window.uploadBuffers = origUpload;
  }
  /* the same build again, nothing hooked but the upload (to read the vertices) */
  window.uploadBuffers = function () {
    plain = ORDER.map((k) => ({ key: k, n: buckets[k].n, v: b64(buckets[k].v) }));
    return origUpload.apply(this, arguments);
  };
  try { buildShed(); } finally { window.uploadBuffers = origUpload; }
  const restored = Object.keys(table.wrappers).concat(["pushTri", "uploadBuffers"]).every((k) => window[k] === (saved[k] || origUpload));
  return {
    buckets: captured,
    plain,
    order: ORDER.slice(),
    fitDist: cam.fitDist,
    gr: window.__GR,
    canvas: { clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight },
    state: JSON.parse(JSON.stringify(state)),
    problems,
    restored,
    hasShadow,
    shadowPossible: !!(extDepth && shadowFB),
  };
}

/* Draw the Finished view from a fixed camera and read the picture, in the same
   task (Barnwright's canvas does not keep its picture after the browser shows
   it). The watchdogs are frozen by pushing their warm-up out of reach
   (WARMUP = 1e15: neither the frame-cost check in draw() nor the one in the
   loop ever runs), shadows are forced on and supersampling is capped at 2,
   and any running camera glide is dropped.

   IT DRAWS TWICE, AND READS THE SECOND. Found while proving the pictures
   repeatable (Sep 26 2026): buildShed deletes the old vertex buffers, but the
   normal and texture-coordinate arrays are still switched on and pointing at
   them from the last frame. So in Barnwright the FIRST draw after every
   rebuild has every draw of its shadow pass refused by WebGL
   (INVALID_OPERATION) -- AFTER the shadow map has been cleared (line 4137) --
   so that frame has NO cast shadow at all (checked: pixel for pixel the same
   as a draw with shadows switched off, whatever building was drawn before).
   Whether the capture's first draw was that frame depended on whether the
   page's own animation loop happened to draw in between, which is what made
   one recording show a cast shadow and the next not. The first draw re-points
   the arrays; the second draws the real shadow for this building and this
   camera, with no error (the capture fails otherwise).
   IT IS VISIBLE IN BARNWRIGHT: its loop only draws while needsDraw is set and
   one draw clears it, so after a rebuild with the camera still (a colour tap,
   a size change, an item added) the customer sees the building with no cast
   shadow until the camera next moves (checked: the loop draws exactly one
   frame after a colour tap and the screen changes when it draws once more).
   The recorded picture is Barnwright's look once the camera has moved, which
   is what our engine draws on its first frame. */
export function inPageLook(cfg) {
  yawAnim = null;
  autoSpin = false;
  interacted = true;
  WARMUP = 1e15; FRAMES = 0; FCOST.length = 0; RAFDT.length = 0;
  hasShadow = true; shadowDropped = false;
  DPRCAP = 2;
  cam.yaw = cfg.yaw; cam.pitch = cfg.pitch;
  cam.dist = cam.fitDist * cfg.distOverFit;
  function glErrors() {
    const out = [];
    for (let e = gl.getError(), n = 0; e && n < 16; e = gl.getError(), n++) out.push(e);
    return out;
  }
  const before = glErrors();
  draw();                      /* re-points the vertex arrays at the new buffers; its shadow pass fails (see above) */
  const first = glErrors();
  draw();                      /* the picture: a shadow map made for THIS building and camera */
  const second = glErrors();
  const png = canvas.toDataURL("image/png");
  needsDraw = false;
  return {
    png,
    glErrors: { beforeDrawing: before, firstDraw: first, secondDraw: second },
    camera: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, fitDist: cam.fitDist, distOverFit: cfg.distOverFit },
    canvas: { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight },
    dpr: Math.min(DPRCAP, Math.max(window.devicePixelRatio || 1, 1.5)),
    hasShadow, DPRCAP, gr: window.__GR,
  };
}
