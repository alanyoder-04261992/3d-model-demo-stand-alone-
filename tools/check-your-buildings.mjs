/* CHECK: Your Buildings uses the owner's real price list in a browser.
   check-all: browser
   Run: node tools/check-your-buildings.mjs
   YOUR_BUILDINGS_PORT defaults to 8394. YOUR_BUILDINGS_TEST_ROOT can point
   at an isolated older checkout to prove these checks fail before the build.
   Screens: test/out/your-buildings/ at 390, 820 and 1280, light and dark. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.env.YOUR_BUILDINGS_TEST_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.YOUR_BUILDINGS_PORT || 8394);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = "test/out/your-buildings-data", OUT = resolve(ROOT, "test/out/your-buildings");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const OWNER = "chris@samplebarns.example", MANAGER = "sarah@samplebarns.example";
const headers = { cookie: `dealer_local_user=${encodeURIComponent(OWNER)}`, origin: BASE, "content-type": "application/json" };
let count = 0, browser, serverLog = "";
const check = (name, yes) => { assert.ok(yes, name); count++; console.log("PASS " + name); };
const call = async (body) => {
  const r = await fetch(BASE + "/api/office/price-list", { headers, method: body ? "PUT" : "GET", body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
mkdirSync(OUT, { recursive: true });
rmSync(resolve(ROOT, DATA), { force: true, recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => { serverLog += d; });
server.stderr.on("data", d => { serverLog += d; });

async function pageFor({ email = OWNER, width = 1280, scheme = "light", noWebGL = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, deviceScaleFactor: 1, colorScheme: scheme, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE }]);
  if (noWebGL) await context.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /^(?:webgl2?|experimental-webgl)$/.test(kind) ? null : get.call(this, kind, ...args);
    };
  });
  const page = await context.newPage();
  page.errors = []; page.on("pageerror", e => page.errors.push(e.message));
  await page.goto(BASE + "/dealer#/price-list", { waitUntil: "load" });
  await page.waitForSelector(".pl-body .pl-tab", { timeout: 30000 });
  return page;
}
async function route(page, path, selector) {
  await page.evaluate(path => { location.hash = path; }, path);
  await page.waitForSelector(selector, { timeout: 10000 });
}
const edit = (page, key) => route(page, "/price-list/building/" + key, `.pl-building-page[data-style="${key}"]`);
const list = page => route(page, "/price-list", ".pl-building-list");
const gallery = page => route(page, "/price-list/add-building", ".pl-gallery");
const field = (page, name) => page.locator(`[data-field="${name}"]`);
const key = (page, style) => page.locator(`.pl-card[data-style="${style}"] img`).getAttribute("data-picture-key");
async function input(page, name, value) { await field(page, name).fill(value); await field(page, name).dispatchEvent("change"); }
async function stop(page) {
  await page.locator(".pl-stop button").click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop selling", exact: true }).click();
  await page.waitForSelector(".pl-building-list");
}
async function save(page) { await page.locator(".pl-bar .btn-accent").click(); await page.waitForSelector(".pl-saved", { timeout: 60000 }); }
async function geometry(page, name) {
  const measure = await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    const short = [], els = dialog ? dialog.querySelectorAll("button, input, select, a") : document.querySelectorAll(".pl-tab button, .pl-tab input, .pl-tab select, .pl-tab a, .pl-bar button");
    for (let el of els) {
      if (el.matches('input[type="checkbox"], input[type="radio"]')) el = el.closest("label") || el;
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) short.push(`${el.tagName} ${el.textContent.trim().slice(0, 30)} (${r.width.toFixed(0)}×${r.height.toFixed(0)})`);
    }
    return { sideways: document.documentElement.scrollWidth - innerWidth, short };
  });
  check(name + ": no sideways scrolling", measure.sideways <= 1);
  check(name + ": every tap target is at least 44 px " + measure.short.join(", "), measure.short.length === 0);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(100);
  const covered = await page.evaluate(() => {
    const dialog = document.querySelector("dialog[open]");
    const buttons = [...(dialog || document).querySelectorAll(dialog ? "button" : ".pl-tab button")].filter(e => e.getBoundingClientRect().height);
    const el = buttons.at(-1); if (!el) return false;
    const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return !hit || !el.contains(hit);
  });
  check(name + ": the last button can be tapped above the fixed bars", !covered);
  await page.evaluate(() => window.scrollTo(0, 0));
}

try {
  for (let i = 0; i < 120 && !/is running/.test(serverLog); i++) await new Promise(r => setTimeout(r, 250));
  assert.ok(/is running/.test(serverLog), serverLog || "The local Dealer Center did not start.");
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const original = (await call()).data.settings;
  const page = await pageFor();
  /* Fail immediately on the old row-and-switch screen, without a timeout. */
  check("the owner has 23 building cards with pictures", await page.locator(".pl-building-list .pl-card[data-style] img").count() === 23);
  check("building cards replace the selling switches", await page.locator('.pl-building-list input[role="switch"]').count() === 0);
  /* The queue deliberately draws only visible cards. Bring the Utility
     Shed on screen before asking for its real picture. */
  await page.locator('.pl-card[data-style="UT"]').evaluate(el => el.scrollIntoView({ block: "start" }));
  try {
    await page.waitForFunction(() => document.querySelector('.pl-card[data-style="UT"] img')?.dataset.picture === "drawn", null, { timeout: 60000 });
  } catch (error) {
    console.error("Picture diagnostics:", await page.evaluate(() => ({ stats: window.__dcPictures?.stats, hidden: document.hidden, rendererHosts: document.querySelectorAll("[data-picture-renderer]").length, picture: document.querySelector('.pl-card[data-style="UT"] img')?.dataset.picture, key: document.querySelector('.pl-card[data-style="UT"] img')?.dataset.pictureKey })), page.errors);
    throw error;
  }
  check("a visible building is drawn with a blob picture", /^blob:/.test(await page.locator('.pl-card[data-style="UT"] img').getAttribute("src")));
  const oldUT = await key(page, "UT"), oldLB = await key(page, "LB");
  await page.locator('.pl-card[data-style="UT"]').evaluate(el => el.scrollIntoView({ block: "start" }));
  const scroll = await page.evaluate(() => scrollY);
  await page.locator('.pl-card[data-style="UT"]').click();
  await page.waitForSelector('.pl-building-page[data-style="UT"]');
  check("Edit opens the Utility Shed's own page with name, prices and building numbers", /#\/price-list\/building\/UT$/.test(page.url()) && await field(page, "name:UT").count() === 1 && await field(page, "built:UT:roofPitch").count() === 1 && await field(page, "built:UT:wallHeight").count() === 1 && await page.locator(".pl-stop button").innerText() === "Stop selling");
  const pagePic = page.locator(".pl-edit-picture img"), oldPageKey = await pagePic.getAttribute("data-picture-key");
  await input(page, "built:UT:roofPitch", "8/12");
  await page.waitForFunction(old => document.querySelector(".pl-edit-picture img")?.dataset.pictureKey !== old, oldPageKey);
  await list(page);
  await page.waitForTimeout(200);
  check("Back keeps the building-list scroll position", Math.abs((await page.evaluate(() => scrollY)) - scroll) <= 3);
  check("changing Utility Shed roof changes its picture key only", await key(page, "UT") !== oldUT && await key(page, "LB") === oldLB);
  const roofKeys = await page.locator(".pl-card[data-style] img").evaluateAll(els => els.map(e => [e.closest("[data-style]").dataset.style, e.dataset.pictureKey]));
  await edit(page, "UT");
  const priceName = "size:UT:" + Object.keys(original.offer.UT.sizes)[0];
  await input(page, priceName, String(original.offer.UT.sizes[Object.keys(original.offer.UT.sizes)[0]] + 100));
  await list(page);
  check("changing a price keeps every building's picture key", JSON.stringify(roofKeys) === JSON.stringify(await page.locator(".pl-card[data-style] img").evaluateAll(els => els.map(e => [e.closest("[data-style]").dataset.style, e.dataset.pictureKey]))));
  await edit(page, "UT"); await input(page, "built:UT:roofPitch", ""); await stop(page);
  check("Stop selling parks the card with Sell it again", await page.locator('.pl-card.off[data-style="UT"]').count() === 1 && await page.locator('.pl-card[data-style="UT"] button').innerText() === "Sell it again");
  await gallery(page);
  const utGallery = page.locator('.pl-gallery-card[data-style="UT"]');
  check("the gallery shows the stopped draft even when all 23 were sold", /Stopped, not saved yet/.test(await utGallery.innerText()) && await utGallery.getByRole("button", { name: "Sell it again", exact: true }).count() === 1);
  await utGallery.getByRole("button", { name: "Sell it again", exact: true }).click();
  await page.waitForSelector('.pl-building-page[data-style="UT"]'); await stop(page);
  await page.locator(".pl-bar-count").click();
  check("the draft says Stop selling the Utility Shed before Save", /Stop selling the Utility Shed/.test(await page.getByRole("dialog").innerText()));
  await page.getByRole("dialog").locator(".actions button").click();
  await save(page);
  check("Save says Stopped selling the Utility Shed", /Stopped selling the Utility Shed/.test(await page.locator(".pl-saved").innerText()));
  const stoppedHistory = await (await fetch(BASE + "/api/office/price-list/history", { headers })).json();
  check("History records Stopped selling the Utility Shed", stoppedHistory.entries[0].changes.includes("Stopped selling the Utility Shed"));
  await gallery(page);
  check("the saved stopped building offers Add it", await utGallery.getByRole("button", { name: "Add it", exact: true }).count() === 1);
  await utGallery.getByRole("button", { name: "Add it", exact: true }).click();
  await page.waitForSelector('.pl-building-page[data-style="UT"]');
  await page.waitForFunction(() => /^size:UT:/.test(document.activeElement?.dataset.field || "") && document.activeElement.value === "");
  check("Add it opens Edit with its first empty price focused", await page.evaluate(() => /^size:UT:/.test(document.activeElement?.dataset.field || "") && document.activeElement.value === ""));
  const sizes = Object.keys(original.offer.UT.sizes), missing = sizes.at(-1);
  for (const z of sizes) if (z !== missing) await input(page, "size:UT:" + z, String(original.offer.UT.sizes[z]));
  await list(page);
  check("one missing price flags its building card", /1 missing a price/.test(await page.locator('.pl-card[data-style="UT"]').innerText()));
  await page.locator(".pl-bar-show").click();
  await page.waitForSelector('.pl-building-page[data-style="UT"]');
  await page.waitForFunction(name => document.activeElement?.dataset.field === name, "size:UT:" + missing);
  check("Show me opens Edit and focuses the missing price", await page.evaluate(name => document.activeElement?.dataset.field === name, "size:UT:" + missing));
  await input(page, "size:UT:" + missing, String(original.offer.UT.sizes[missing])); await save(page);
  await gallery(page);
  await page.locator('.pl-gallery-card[data-style="LB"]').getByRole("button", { name: "Make my own from it", exact: true }).click();
  await page.getByRole("dialog").locator('input[type="text"]').fill("Premium Lofted Barn");
  await page.getByRole("dialog").locator('input[type="checkbox"]').uncheck();
  await page.getByRole("dialog").getByRole("button", { name: "Add my building", exact: true }).click();
  await page.waitForSelector('.pl-building-page[data-style="LB1"]');
  await page.waitForFunction(() => /^size:LB1:/.test(document.activeElement?.dataset.field || "") && document.activeElement.value === "");
  check("Make my own creates LB1 with its name and first empty price focused", await field(page, "name:LB1").inputValue() === "Premium Lofted Barn" && await page.evaluate(() => /^size:LB1:/.test(document.activeElement?.dataset.field || "") && document.activeElement.value === ""));
  for (const [z, amount] of Object.entries(original.offer.LB.sizes)) await input(page, "size:LB1:" + z, String(amount));
  await save(page);
  const soldKeys = Object.keys((await call()).data.settings.offer).sort();
  check("Save keeps the named own building alongside every standard building", soldKeys.length === 24 && soldKeys.includes("UT") && soldKeys.includes("LB1"));
  check("the new screens cause no page errors", page.errors.length === 0);
  await page.context().close();

  const fallback = await pageFor({ noWebGL: true });
  /* Scroll every card into the queue, so a unavailable renderer is exercised. */
  for (const img of await fallback.locator(".pl-building-list .pl-card img").all()) await img.scrollIntoViewIfNeeded();
  /* Resource completion, rather than a fixed delay, keeps slow software
     graphics runs from judging a valid fallback before its JPEG arrives. */
  await fallback.waitForFunction(() => [...document.querySelectorAll(".pl-building-list .pl-card img")].every(img => img.complete || img.dataset.picture === "none"), null, { timeout: 15000 }).catch(() => {});
  await fallback.waitForTimeout(1500);
  const pictures = await fallback.locator(".pl-building-list .pl-card img").evaluateAll(els => els.map(e => ({ style: e.closest(".pl-card").dataset.style, state: e.dataset.picture, src: e.getAttribute("src"), loaded: e.complete && e.naturalWidth > 0 })));
  const fallbackKeys = pictures.map(p => p.style).sort();
  const badPictures = pictures.filter(p => p.state !== "standard" || !/^\/ui\/office\/building-pictures\/[A-Z]+\.jpg$/.test(p.src) || !p.loaded);
  if (badPictures.length || JSON.stringify(fallbackKeys) !== JSON.stringify(soldKeys)) console.error("Fallback picture diagnostics:", JSON.stringify({ expected: soldKeys, pictures }, null, 2));
  check("without WebGL the standard and own building cards all remain, including UT and LB1", JSON.stringify(fallbackKeys) === JSON.stringify(soldKeys) && fallbackKeys.includes("UT") && fallbackKeys.includes("LB1"));
  check("without WebGL every card keeps its loaded standard picture", badPictures.length === 0);
  check("no WebGL causes no page error", fallback.errors.length === 0);
  await fallback.context().close();
  const manager = await pageFor({ email: MANAGER });
  check("a manager keeps the full price sheet including the own building, without cards or Edit", await manager.locator(".pl-sheet-card").count() === soldKeys.length && await manager.locator(".pl-sheet-card", { hasText: "Premium Lofted Barn" }).count() === 1 && await manager.locator(".pl-card[data-style], .pl-card-edit, .pl-building-page").count() === 0);
  await manager.context().close();

  for (const scheme of ["light", "dark"]) for (const width of [390, 820, 1280]) {
    const p = await pageFor({ width, scheme });
    await edit(p, "UT");
    await input(p, "size:UT:" + sizes[0], String(original.offer.UT.sizes[sizes[0]] + 1));
    for (const [name, path, selector] of [["buildings", "/price-list", ".pl-building-list"], ["edit", "/price-list/building/UT", ".pl-building-page"], ["add", "/price-list/add-building", ".pl-gallery"], ["all-built", "/price-list/how-its-built", ".pl-built-card"]]) {
      await route(p, path, selector);
      /* A dirty price list exercises the bottom Save bar on every screen. */
      if (name === "edit") await input(p, "size:UT:" + sizes[0], String(original.offer.UT.sizes[sizes[0]] + 1));
      await geometry(p, `${name} ${width} ${scheme}`);
      await p.screenshot({ path: resolve(OUT, `${name}-${width}-${scheme}.png`), fullPage: true });
      if (name === "add") {
        await p.locator('.pl-gallery-card[data-style="LB"]').getByRole("button", { name: "Make my own from it", exact: true }).click();
        await geometry(p, `make-own ${width} ${scheme}`);
        await p.screenshot({ path: resolve(OUT, `make-own-${width}-${scheme}.png`) });
        await p.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
      }
    }
    check(`${width} ${scheme}: no page errors`, p.errors.length === 0);
    await p.context().close();
  }
  for (const width of [768, 1024]) {
    const p = await pageFor({ width });
    await geometry(p, `buildings ${width}`); await edit(p, "UT"); await geometry(p, `edit ${width}`);
    await p.context().close();
  }

  /* A pre-build price list can contain an own style, own build numbers and
     its own category ordering. Reading and saving it must change nothing. */
  const file = resolve(ROOT, DATA, "price-list.json"), raw = JSON.parse(readFileSync(file, "utf8"));
  const settings = raw.data.settings;
  settings.offer.LB1 = { base: "LB", name: "My Lofted Barn", sizes: { "10x16": 6100, "12x20": 9000 }, built: { wallHeight: 84 } };
  settings.offer.UT.built = { roofPitch: 6 };
  settings.categories = [["My buildings", ["LB1", "UT"]], ...settings.categories.map(([name, ks]) => [name, ks.filter(k => k !== "UT" && k !== "LB1")]).filter(([, ks]) => ks.length)];
  raw.data.version++; writeFileSync(file, JSON.stringify(raw));
  const old = await call(), reopened = await pageFor();
  check("an older own building and categories open unchanged", await reopened.locator('.pl-card[data-style="LB1"]').count() === 1 && /My Lofted Barn/.test(await reopened.locator('.pl-card[data-style="LB1"]').innerText()));
  const unchanged = await call({ settings: old.data.settings, version: old.data.version });
  check("saving an older price list makes no changes", unchanged.status === 200 && JSON.stringify(unchanged.data.changes) === "[]" && JSON.stringify(unchanged.data.settings) === JSON.stringify(old.data.settings));
  await reopened.context().close();
  console.log(`PROVED: ${count} checks passed — real building pictures, per-building edits, selling and adding, focused problems, unchanged old prices, manager access and phone-safe screens. Pictures: test/out/your-buildings/.`);
} catch (error) {
  console.error("FAIL: " + (error.stack || error)); process.exitCode = 1;
} finally {
  await browser?.close(); server.kill();
}
