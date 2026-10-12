/* CHECK THE BROWSER PICTURE QUEUE AND CACHE.
   Run: node tools/check-picture-cache.mjs
   check-all: browser
   Uses the actual renderer on a small local harness. Proves on-screen work
   starts first, hidden tabs and native dialogs pause, cancel releases the renderer, context loss
   recovers, IndexedDB survives a reload, and blocked storage uses memory. */
import { openPictureHarness, standardPicturesCatalogue } from "./lib/building-pictures.mjs";

const failures = [];
let passed = 0;
function ok(name, condition, detail = "") {
  if (condition) { passed++; console.log(`  ok   ${name}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ": " + detail : ""}`); }
}
const { cat, manufacturer } = standardPicturesCatalogue();
const harness = await openPictureHarness();
const { page } = harness;
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function setup(target = page) {
  await target.evaluate(async ({ cat, manufacturer }) => {
    window.pics = await import("/ui/office/views/price-list/pictures.js");
    window.pictureCat = cat; window.pictureManufacturer = manufacturer;
    document.body.style.margin = "0";
    window.addPicture = (style, options = {}) => {
      const box = window.pics.picture(style, { cat: window.pictureCat, M: window.pictureManufacturer, name: style, ...options });
      document.body.appendChild(box);
      return box;
    };
  }, { cat, manufacturer });
}
async function waitDrawn(selector = 'img[data-picture="drawn"]', target = page) {
  await target.waitForFunction((selector) => document.querySelector(selector)?.src.startsWith("blob:"), selector, { timeout: 45000 });
}
try {
  await setup();
  await page.evaluate(async () => {
    window.picturesHidden = true;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => window.picturesHidden });
    /* Real tabs await their view before attaching its picture cards. */
    const box = await (async () => window.pics.picture("UT", { cat: window.pictureCat, M: window.pictureManufacturer, name: "Utility Shed" }))();
    document.body.appendChild(box);
  });
  await page.waitForTimeout(150);
  ok("a hidden tab starts no renderer", await page.evaluate(() => !window.pics.stats.engineLoaded));
  await page.evaluate(() => {
    const dialog = document.createElement("dialog"); dialog.textContent = "Name your building";
    document.body.appendChild(dialog); dialog.showModal(); window.pictureDialog = dialog;
    window.picturesHidden = false; document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(150);
  ok("a native dialog pauses queued pictures before loading a renderer", await page.evaluate(() => !window.pics.stats.engineLoaded && window.pics.stats.drawn === 0));
  await page.evaluate(() => { window.pictureDialog.close(); window.pictureDialog.remove(); });
  await waitDrawn();
  ok("closing and removing the native dialog resumes the picture queue", await page.evaluate(() => window.pics.stats.drawn === 1));
  ok("visible pictures start one renderer", await page.evaluate(() => window.pics.stats.drawn === 1 && window.pics.stats.renderersStarted === 1 && document.querySelectorAll("[data-picture-renderer]").length === 1));
  ok("an asynchronously mounted view keeps its queued picture", await page.evaluate(() => document.querySelector('[data-style="UT"] img').dataset.picture === "drawn"));
  await page.evaluate(() => {
    const space = document.createElement("div"); space.style.height = "2500px"; document.body.appendChild(space);
    window.addPicture("LB");
  });
  await page.waitForTimeout(150);
  ok("an off-screen card keeps its fallback until it comes into view", await page.evaluate(() => window.pics.stats.drawn === 1 && document.querySelector('[data-style="LB"] img').dataset.picture === "standard"));
  await page.locator('[data-style="LB"]').scrollIntoViewIfNeeded();
  await waitDrawn('[data-style="LB"] img');
  ok("scrolling to a missing picture uses the same renderer", await page.evaluate(() => window.pics.stats.drawn === 2 && window.pics.stats.renderersStarted === 1));
  await page.evaluate(() => {
    window.pics.release(); document.body.replaceChildren(); window.scrollTo(0, 0); window.addPicture("UT");
  });
  await waitDrawn();
  ok("returning to a cached picture draws nothing and leaves the graphics released", await page.evaluate(() => window.pics.stats.drawn === 2 && document.querySelectorAll("[data-picture-renderer]").length === 0));
  await page.evaluate(() => {
    window.addPicture("SU"); window.pics.release();
  });
  await page.waitForTimeout(150);
  ok("canceling queued work creates no renderer after release", await page.evaluate(() => document.querySelectorAll("[data-picture-renderer]").length === 0 && window.pics.stats.drawn === 2));

  /* Wait for the two successful writes before testing a fresh module visit. */
  await page.waitForFunction(() => new Promise((done) => {
    const request = indexedDB.open("dealer-center-pictures", 1);
    request.onerror = () => done(false);
    request.onsuccess = () => {
      const db = request.result, count = db.transaction("pictures").objectStore("pictures").count();
      count.onsuccess = () => { db.close(); done(count.result >= 2); };
      count.onerror = () => { db.close(); done(false); };
    };
  }));
  await page.reload(); await setup();
  await page.evaluate(() => window.addPicture("UT")); await waitDrawn();
  ok("a reload reads IndexedDB before loading the drawing engine", await page.evaluate(() => window.pics.stats.fromStore === 1 && window.pics.stats.drawn === 0 && !window.pics.stats.engineLoaded));

  await page.evaluate(() => new Promise((done, fail) => {
    const request = indexedDB.open("dealer-center-pictures", 1);
    request.onerror = fail;
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction("pictures", "readwrite"), store = tx.objectStore("pictures");
      for (let i = 0; i < 151; i++) store.put({ key: `old-picture-${i}`, blob: new Blob(["old picture"]), at: i });
      tx.oncomplete = () => { db.close(); done(); }; tx.onerror = fail;
    };
  }));

  await page.evaluate(() => window.addPicture("SU"));
  await page.locator('[data-style="SU"]').scrollIntoViewIfNeeded();
  await waitDrawn('[data-style="SU"] img');
  await page.waitForFunction(() => new Promise((done) => {
    const request = indexedDB.open("dealer-center-pictures", 1);
    request.onerror = () => done(false);
    request.onsuccess = () => {
      const db = request.result, count = db.transaction("pictures").objectStore("pictures").count();
      count.onsuccess = () => { db.close(); done(count.result <= 150); };
      count.onerror = () => { db.close(); done(false); };
    };
  }));
  ok("a new picture keeps browser storage capped at the newest 150", await page.evaluate(() => new Promise((done) => {
    const request = indexedDB.open("dealer-center-pictures", 1);
    request.onerror = () => done(false);
    request.onsuccess = () => {
      const db = request.result, lookup = db.transaction("pictures").objectStore("pictures").get("old-picture-0");
      lookup.onsuccess = () => { db.close(); done(!lookup.result); };
      lookup.onerror = () => { db.close(); done(false); };
    };
  })));
  await page.evaluate(() => document.querySelector("[data-picture-renderer] canvas").getContext("webgl").getExtension("WEBGL_lose_context").loseContext());
  await page.waitForTimeout(100);
  await page.evaluate(() => window.addPicture("DS"));
  await page.locator('[data-style="DS"]').scrollIntoViewIfNeeded();
  await waitDrawn('[data-style="DS"] img');
  ok("a lost graphics context is replaced and the next picture draws", await page.evaluate(() => window.pics.stats.renderersStarted === 2 && document.querySelectorAll("[data-picture-renderer]").length === 1));
  await page.evaluate(() => window.pics.release());
  ok("release removes the renderer canvas", await page.evaluate(() => !document.querySelector("[data-picture-renderer]")));

  const blocked = await harness.browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
  const privatePage = await blocked.newPage();
  privatePage.on("pageerror", (error) => errors.push(error.message));
  await privatePage.addInitScript(() => Object.defineProperty(window, "indexedDB", { configurable: true, get() { throw new Error("Storage is blocked"); } }));
  await privatePage.goto(harness.url + "/__pictures"); await setup(privatePage);
  await privatePage.evaluate(() => window.addPicture("UT")); await waitDrawn(undefined, privatePage);
  await privatePage.evaluate(() => { window.pics.release(); document.body.replaceChildren(); window.addPicture("UT"); });
  await waitDrawn(undefined, privatePage);
  ok("blocked browser storage falls back to memory without drawing twice", await privatePage.evaluate(() => window.pics.stats.drawn === 1 && window.pics.stats.fromStore === 0 && !document.querySelector("[data-picture-renderer]")));
  await blocked.close();
  ok("the queue and cache raise no page errors", !errors.length, errors.join("; "));
} catch (error) {
  try { console.error("Picture queue diagnostics:", JSON.stringify(await page.evaluate(() => ({ stats: window.pics?.stats, hidden: document.hidden, dialog: !!document.querySelector("dialog[open]"), images: [...document.querySelectorAll("img")].map(img => ({ state: img.dataset.picture, src: img.getAttribute("src")?.slice(0, 100), top: img.getBoundingClientRect().top, bottom: img.getBoundingClientRect().bottom, viewport: innerHeight })), renderers: document.querySelectorAll("[data-picture-renderer]").length })), null, 2)); } catch { /* retain the original failure */ }
  ok("the browser picture checks complete", false, error.stack || error.message);
}
finally { await harness.close(); }
if (failures.length) { console.log(`FAIL: ${failures.length} picture cache check(s) failed: ${failures.join("; ")}`); process.exitCode = 1; }
else console.log(`PROVED: ${passed} browser picture checks passed: visible work first, tab pause, memory and persistent cache, cancellation, context recovery and release.`);
