/* CHECK: a concurrent price-list save refreshes the owner's layout editor.
   check-all: browser
   Move a door, change a conditional window's carry rule, remove a sold size
   in another session, then save twice: 409 must reopen the latest catalogue
   with the owner's edits intact before retrying. LAYOUT_CONFLICT_PORT: 8401. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.env.LAYOUT_CONFLICT_TEST_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LAYOUT_CONFLICT_PORT || 8401), BASE = `http://127.0.0.1:${PORT}`;
const DATA = "test/out/layout-conflict-data", OUT = resolve(ROOT, "test/out/your-buildings");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const headers = { cookie: "dealer_local_user=chris%40samplebarns.example", origin: BASE, "content-type": "application/json" };
let browser, log = "", checks = 0;
const errors = [], replies = [];
const check = (name, yes) => { assert.ok(yes, name); checks++; console.log("PASS " + name); };
const call = async (path, body, method = body ? "POST" : "GET") => {
  const r = await fetch(BASE + "/api/office/" + path, { headers, method, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json() };
};
const snapshot = page => page.evaluate(() => {
  const ui = window.shedUI, checked = ui.layoutMode.check();
  return { version: ui.layoutMode.version, catalogue: Object.keys(ui.getCatalogue().P.LB).sort(), sizes: [...ui.layoutStart.sizes].sort(), checked: [...checked.sizes].sort(), count: checked.checks.length,
    door: ui.getState().items.find(item => item.cat === "w72" && item.wall === "F").pos, recipe: ui.layoutMode.getRecipe() };
});
mkdirSync(OUT, { recursive: true }); rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
try {
  for (let n = 0; n < 120 && !log.includes("is running"); n++) await new Promise(r => setTimeout(r, 250));
  assert.ok(log.includes("is running"), log || "The local Dealer Center did not start.");
  const original = await call("price-list");
  const layout = [{ cat: "w72", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: { pos: "len*0.1" }, when: { minL: 20 }, ifFits: true }];
  const prepared = await call("price-list/layout", { style: "LB", layout, version: original.data.version });
  check("the owner starts with a window only on sizes 20 ft long and up", prepared.status === 200);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await context.addCookies([{ name: "dealer_local_user", value: "chris%40samplebarns.example", url: BASE }]);
  await context.addInitScript(() => { window.__layoutConflictBoot = crypto.randomUUID(); });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if (/\/api\/office\/price-list\/layout$/.test(r.url())) replies.push(r.status()); });
  await page.goto(BASE + "/d/riverside/?layout=LB", { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI?.ready && window.shedUI?.layoutMode, null, { timeout: 60000 });
  const boot = await page.evaluate(() => window.__layoutConflictBoot);
  await page.locator('[data-layout-view="R"]').click();
  await page.evaluate(() => { const ui = window.shedUI; ui.select(ui.getState().items.find(item => item.cat === "w23" && item.wall === "R").id); });
  await page.locator("#layout-rule-select").selectOption("center");
  const windowRule = (await snapshot(page)).recipe.find(entry => entry.cat === "w23" && entry.wall === "R");
  check("changing a carry rule keeps the window's existing size condition", windowRule.at === "center" && windowRule.when?.minL === 20);
  await page.locator("#sh-done").click(); await page.locator('[data-layout-view="F"]').click();
  await page.evaluate(() => { const ui = window.shedUI; ui.select(ui.getState().items.find(item => item.cat === "w72" && item.wall === "F").id); });
  const before = await snapshot(page); await page.locator("#layout-right").click();
  const moved = await snapshot(page);
  check("the owner's door moves three inches before the conflicting save", Math.abs(moved.door - before.door - .25) < .001);
  await page.locator("#sh-done").click();
  const current = await call("price-list"), settings = structuredClone(current.data.settings);
  check("the concurrent session can remove a real sold size", Object.hasOwn(settings.offer.LB.sizes, "8x12"));
  delete settings.offer.LB.sizes["8x12"];
  const newer = await call("price-list", { settings, version: current.data.version }, "PUT");
  check("the concurrent price-list save succeeds", newer.status === 200 && newer.data.version > current.data.version);
  const sizes = Object.keys(newer.data.settings.offer.LB.sizes).sort();
  await page.locator("#layout-save").click();
  await page.waitForFunction(previous => window.__layoutConflictBoot !== previous && window.shedUI?.ready && window.shedUI?.layoutMode && /Someone saved the price list first/.test(document.querySelector("#layout-notice")?.textContent || ""), boot, { timeout: 60000 });
  const refreshed = await snapshot(page);
  check("409 reopens the editor and explains that the owner's layout was kept", replies.includes(409) && /Your layout is still here/.test(await page.locator("#layout-notice").innerText()));
  check("the refreshed editor uses the newest version, catalogue and sold sizes", refreshed.version === newer.data.version && JSON.stringify(refreshed.catalogue) === JSON.stringify(sizes) && JSON.stringify(refreshed.sizes) === JSON.stringify(sizes));
  check("the every-size check drops the removed size as well", !refreshed.checked.includes("8x12") && JSON.stringify(refreshed.checked) === JSON.stringify(sizes) && refreshed.count === sizes.length);
  check("the door's three-inch move survives the conflict", Math.abs(refreshed.door - moved.door) < .001);
  const retained = refreshed.recipe.find(entry => entry.cat === "w23" && entry.wall === "R");
  check("the changed carry rule and its size condition survive reopening", retained.at === "center" && retained.when?.minL === 20);
  check("the removed size is absent from the visible size choices", await page.locator('#sizechips [data-size="8x12"]').count() === 0);
  await page.screenshot({ path: resolve(OUT, "layout-conflict-kept-1280.png") });
  await page.locator("#layout-save").click();
  await page.waitForFunction(() => /Saved/.test(document.querySelector("#layout-result h2")?.textContent || ""), null, { timeout: 60000 });
  const saved = await call("price-list");
  check("retry saves against the new price list without bringing its removed size back", replies.at(-1) === 200 && saved.data.version > newer.data.version && !Object.hasOwn(saved.data.settings.offer.LB.sizes, "8x12"));
  check("retry saves the owner's exact kept door and window rules", JSON.stringify(saved.data.settings.offer.LB.layout) === JSON.stringify(refreshed.recipe));
  check("the refreshed editor and retry have no page errors", errors.length === 0);
  await context.close();
  console.log(`PROVED: ${checks} layout conflict checks passed — stale saves refresh the catalogue and every-size check, keep the owner's moves and conditions, and retry against the newest price list.`);
} catch (error) { console.error("FAIL: " + (error.stack || error)); process.exitCode = 1; }
finally { await browser?.close(); server.kill(); }
