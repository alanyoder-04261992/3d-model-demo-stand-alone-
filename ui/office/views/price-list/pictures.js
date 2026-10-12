/* THE PICTURES ON "YOUR BUILDINGS": which one each card shows, and when it
   is drawn (docs/OFFICE.md, "Your buildings").

   picture(key, {size, cat, base, name}) -> an <img> for a card ("card",
   400×300) or the Edit page ("page", 640×480):
     * at once the standard picture of the style it is built like
       (/library/style-refs/<CODE>.jpg, alt "The standard <name>"),
       data-picture="standard"; a library with no such picture shows the
       shed tile instead (data-picture="none");
     * then the business's own picture, drawn in this browser by
       ui/office/pictures.js (loaded only when a picture is missing) from
       the price list as it stands, data-picture="drawn", alt "<name> as
       your 3D designer shows it".
   Each picture has a key (model/picture-key.js, data-picture-key): a
   picture is drawn again only when its key changed.

   The queue draws one picture at a time, the ones on screen first, giving
   the page back between pictures. It waits while the tab is hidden, is
   dropped when the screen changes (forget()), starts a new renderer when
   the browser took the graphics away, and release() gives the graphics
   back when the owner leaves the price list.

   The pictures are kept: in this tab (key -> blob address) and in the
   browser's own storage (IndexedDB "dealer-center-pictures", the newest
   150, about 5 MB). Private windows and blocked storage just keep them in
   the tab. */

import { pictureKey, CARD_PICTURE, PAGE_PICTURE, PICTURE_CAMERA, PICTURE_BACKDROP } from "../../../../model/picture-key.js";
import { h, icon, frame } from "../../dom.js";

/* the built drawing code's hash (tools/build-site.mjs, tools/office-local.mjs) */
export const PICTURES_ID = typeof __PICTURES_ID__ !== "undefined" ? __PICTURES_ID__ : "source";
/* kept in a variable so the bundler leaves the 3D engine in its own file */
const ENGINE_FILE = "/ui/office/pictures.js";
const DB = "dealer-center-pictures", STORE = "pictures", KEEP = 150;
const SIZES = { card: CARD_PICTURE, page: PAGE_PICTURE };

const mem = new Map();          /* key -> blob: address */
let jobs = [];                  /* {key, cat, style, size, imgs} waiting */
let running = false, engine = null, engineFailed = false, observer = null;
const shown = new WeakSet();    /* imgs on screen or near it */
export const stats = { drawn: 0, fromStore: 0, failed: 0, engineLoaded: false };

const dprNow = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));
export function recipeOf(size) {
  const s = SIZES[size] || CARD_PICTURE;
  return { w: s.w, h: s.h, dpr: dprNow(), cam: PICTURE_CAMERA, bg: PICTURE_BACKDROP };
}
export function keyFor(cat, style, size = "card") {
  try { return pictureKey(cat, style, recipeOf(size), PICTURES_ID); } catch { return null; }
}

/* ---- the browser's own storage ---------------------------------------- */

let dbp = null;
function openDb() {
  if (dbp) return dbp;
  dbp = new Promise((done) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore(STORE, { keyPath: "key" }).createIndex("at", "at"); } catch { /* there already */ } };
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch { done(null); }
  });
  return dbp;
}
async function stored(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((done) => {
    try {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => done(r.result?.blob || null);
      r.onerror = () => done(null);
    } catch { done(null); }
  });
}
async function store(key, blob) {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    const os = tx.objectStore(STORE);
    os.put({ key, blob, at: Date.now() });
    const count = os.count();
    count.onsuccess = () => {
      let extra = count.result - KEEP;
      if (extra <= 0) return;
      const cur = os.index("at").openCursor();
      cur.onsuccess = () => { const c = cur.result; if (c && extra-- > 0) { c.delete(); c.continue(); } };
    };
  } catch { /* storage full or blocked: the tab keeps it */ }
}

/* ---- one picture ------------------------------------------------------- */

function standardSrc(M, base) {
  return M?.id === "standard" && M.styles?.[base] ? `/library/style-refs/${encodeURIComponent(base)}.jpg` : null;
}

function show(img, url, name) {
  img.src = url;
  img.dataset.picture = "drawn";
  img.alt = `${name} as your 3D designer shows it`;
}

/* An <img> for the style. cat: the catalogue the picture is drawn from
   (null: the standard picture only). */
export function picture(style, { size = "card", cat = null, M = null, base = style, name = "" } = {}) {
  const S = SIZES[size] || CARD_PICTURE;
  const std = standardSrc(M, base);
  const img = h("img", { class: "pl-pic-img", width: S.w, height: S.h, decoding: "async", alt: std ? `The standard ${M.styles[base].name}` : "" });
  img.dataset.picture = std ? "standard" : "none";
  if (std) img.src = std;
  const key = cat ? keyFor(cat, style, size) : null;
  if (key) img.dataset.pictureKey = key;
  const box = h("span", { class: ["pl-pic", size === "page" && "big"], dataset: { style } }, img,
    std ? null : h("span", { class: "pl-pic-none", "aria-hidden": "true" }, icon("lots")));
  if (!key) return box;
  if (mem.has(key)) { show(img, mem.get(key), name); return box; }
  img.addEventListener("error", () => { if (img.dataset.picture === "standard") { img.removeAttribute("src"); img.dataset.picture = "none"; box.classList.add("none"); } });
  ask({ key, cat, style, size, img, name });
  return box;
}

function ask(j) {
  let job = jobs.find((x) => x.key === j.key);
  if (!job) { job = { key: j.key, cat: j.cat, style: j.style, size: j.size, imgs: [] }; jobs.push(job); }
  job.imgs.push({ img: j.img, name: j.name });
  watch(j.img);
  queueMicrotask(run);
}

function watch(img) {
  if (typeof IntersectionObserver === "undefined") { shown.add(img); return; }
  if (!observer) {
    observer = new IntersectionObserver((list) => {
      for (const e of list) { if (e.isIntersecting) shown.add(e.target); else shown.delete(e.target); }
      if (list.some((e) => e.isIntersecting)) run();
    }, { rootMargin: "300px" });
  }
  observer.observe(img);
}

const onPage = (job) => job.imgs.some((x) => x.img.isConnected);
const visible = (job) => job.imgs.some((x) => x.img.isConnected && shown.has(x.img));

async function loadEngine() {
  if (engine && !engine.lost) return engine;
  if (engineFailed) return null;
  try {
    if (engine?.lost) { engine.close(); engine = null; }
    const mod = await import(/* @vite-ignore */ ENGINE_FILE);
    stats.engineLoaded = true;
    engine = mod.startPictures();
    return engine;
  } catch {
    engineFailed = true;
    return null;
  }
}

async function run() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      jobs = jobs.filter(onPage);
      if (!jobs.length) break;
      if (document.hidden) { await new Promise((r) => document.addEventListener("visibilitychange", r, { once: true })); continue; }
      const job = jobs.find(visible);
      if (!job) break;
      jobs.splice(jobs.indexOf(job), 1);
      let url = mem.get(job.key);
      if (!url) {
        const blob = await stored(job.key);
        if (blob) { url = URL.createObjectURL(blob); mem.set(job.key, url); stats.fromStore++; }
      }
      if (!url) {
        const e = await loadEngine();
        if (!e || e.off) { jobs = []; break; }
        try {
          const S = SIZES[job.size] || CARD_PICTURE;
          const blob = await e.draw(job.cat, job.style, { w: S.w, h: S.h, dpr: dprNow() });
          url = URL.createObjectURL(blob);
          mem.set(job.key, url);
          stats.drawn++;
          store(job.key, blob);
        } catch {
          stats.failed++;
          if (e.off) { jobs = []; break; }
        }
      }
      if (url) for (const { img, name } of job.imgs) if (img.isConnected) show(img, url, name);
      await frame();
    }
  } finally {
    running = false;
  }
}

/* The screen changed: drop what is waiting (pictures already drawn stay). */
export function forget() {
  jobs = [];
}

/* Leaving the price list: give the graphics back. */
export function release() {
  jobs = [];
  if (engine) { try { engine.close(); } catch { /* gone */ } engine = null; }
  observer?.disconnect();
  observer = null;
}

/* For the checks: what the queue has done. */
if (typeof window !== "undefined") window.__dcPictures = { stats, PICTURES_ID };
