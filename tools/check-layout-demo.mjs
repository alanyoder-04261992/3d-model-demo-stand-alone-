/* CHECK: a prospective customer can set a standard layout in the demo.
   check-all: browser
   The actual Edit-page button opens the actual designer in the same tab,
   keeps unsaved prices and stopped buildings, then saves them on return.
   This runs with no account cookie; all API calls stay inside the demo.
   LAYOUT_DEMO_PORT defaults to 8398. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = process.env.LAYOUT_DEMO_TEST_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.LAYOUT_DEMO_PORT || 8398), BASE = `http://127.0.0.1:${PORT}`;
const DATA = "test/out/layout-demo-data", OUT = resolve(ROOT, "test/out/your-buildings");
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const check = (name, yes) => { assert.ok(yes, name); checks++; console.log("PASS " + name); };
let browser, log = "", checks = 0;
const calls = [], errors = [];
mkdirSync(OUT, { recursive: true }); rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
server.stdout.on("data", d => { log += d; }); server.stderr.on("data", d => { log += d; });
const record = page => page.evaluate(async () => (await fetch("/api/office/price-list")).json());
const route = async (page, path, selector) => { await page.evaluate(path => { location.hash = path; }, path); await page.waitForSelector(selector, { timeout: 30000 }); };
const price = page => page.locator('[data-field="size:LB:10x16"]');
async function signIn(page) {
  await page.goto(BASE + "/dealer?demo#/price-list", { waitUntil: "load" });
  await page.waitForSelector(".person-pick", { timeout: 30000 });
  await page.locator(".person-pick:has-text('Chris Walker')").click();
  await page.waitForSelector(".banner.demo", { timeout: 30000 });
  await page.waitForSelector(".pl-body .pl-tab");
}
try {
  for (let n = 0; n < 120 && !log.includes("is running"); n++) await new Promise(r => setTimeout(r, 250));
  assert.ok(log.includes("is running"), log || "The local Dealer Center did not start.");
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await context.route("**/api/office/**", r => r.abort());
  context.on("request", r => { if (/\/api\/(?:office|lots)\//.test(r.url())) calls.push(r.url()); });
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  await signIn(page);
  /* On the old code this fails before waiting for a new screen. */
  check("the demo uses the real new building cards", await page.locator(".pl-building-list .pl-card[data-style]").count() === 23);
  const original = await record(page), oldPrice = original.settings.offer.LB.sizes["10x16"], nextPrice = oldPrice + 123;
  await route(page, "/price-list/building/UT", '.pl-building-page[data-style="UT"]');
  await page.locator(".pl-stop button").click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop selling", exact: true }).click();
  await page.waitForSelector('.pl-card.off[data-style="UT"]');
  await route(page, "/price-list/building/LB", '.pl-building-page[data-style="LB"]');
  await price(page).fill(String(nextPrice)); await price(page).dispatchEvent("change");
  check("the demo has both an unsaved price and an unsaved stopped building", /2 changes/.test(await page.locator(".pl-bar-count").innerText()));
  await page.locator(".pl-layout-card").getByRole("button", { name: "Set the standard layout", exact: true }).click();
  await page.waitForFunction(() => window.shedUI?.ready && window.shedUI?.layoutMode, null, { timeout: 60000 });
  const url = new URL(page.url());
  check("Edit opens demo layout mode in the same tab without real credentials", url.searchParams.get("dealerDemo") === "1" && url.searchParams.get("layout") === "LB" && url.pathname === "/c/demo/");
  const kept = await page.evaluate(() => JSON.parse(sessionStorage.getItem("dealer-center:layout-return") || "null"));
  check("the return record binds the draft to the demo owner and keeps parked prices", kept?.actor === "person:sample-chris" && kept.draft.offer.LB.sizes["10x16"] === nextPrice && !kept.draft.offer.UT && !!kept.parked.offer.UT);
  const before = await page.evaluate(() => {
    const ui = window.shedUI, door = ui.getState().items.find(item => item.cat === "w72" && item.wall === "F");
    if (!door) throw new Error("The Lofted Barn's standard door is missing.");
    ui.select(door.id); return { id: door.id, pos: door.pos };
  });
  await page.locator("#layout-right").click();
  const moved = await page.evaluate(id => window.shedUI.getState().items.find(item => item.id === id).pos, before.id);
  check("the prospective customer can move the standard door three inches", Math.abs(moved - before.pos - .25) < .001);
  await page.locator("#sh-done").click(); await page.locator("#layout-save").click();
  await page.waitForFunction(() => /Saved/.test(document.querySelector("#layout-result h2")?.textContent || ""), null, { timeout: 60000 });
  const layoutSaved = await record(page);
  check("the demo saves only the layout while the Dealer Center draft waits", Array.isArray(layoutSaved.settings.offer.LB.layout) && layoutSaved.settings.offer.LB.sizes["10x16"] === oldPrice && !!layoutSaved.settings.offer.UT);
  await page.screenshot({ path: resolve(OUT, "layout-demo-saved-390.png") });
  await page.locator("#layout-return").click();
  await page.waitForSelector('.pl-building-page[data-style="LB"]', { timeout: 30000 });
  check("Back to Edit restores the unsaved price after the layout-only save", await price(page).inputValue() === String(nextPrice) && /\?demo#\/price-list\/building\/LB$/.test(page.url()));
  check("returning consumes the bridge and rebases without a stale-price warning", await page.evaluate(() => sessionStorage.getItem("dealer-center:layout-return") === null) && !/Someone else saved the price list while you were working/.test(await page.locator("body").innerText()));
  await route(page, "/price-list", ".pl-building-list");
  check("the stopped building and its Sell it again action survive returning", await page.locator('.pl-card.off[data-style="UT"]').count() === 1);
  await page.locator('.pl-card.off[data-style="UT"]').getByRole("button", { name: "Sell it again", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.pl-card.off[data-style="UT"]'));
  await route(page, "/price-list/building/LB", '.pl-building-page[data-style="LB"]');
  await page.locator(".pl-bar .btn-accent").click(); await page.waitForSelector(".pl-saved", { timeout: 60000 });
  const saved = await record(page);
  check("the gold Save keeps the price, restored building and standard layout together", saved.settings.offer.LB.sizes["10x16"] === nextPrice && !!saved.settings.offer.UT && JSON.stringify(saved.settings.offer.LB.layout) === JSON.stringify(layoutSaved.settings.offer.LB.layout));
  await page.screenshot({ path: resolve(OUT, "layout-demo-returned-390.png") });
  await page.reload({ waitUntil: "load" }); await page.waitForSelector('.pl-building-page[data-style="LB"]');
  check("the same demo tab keeps its saved price after reloading", await price(page).inputValue() === String(nextPrice));
  const fresh = await context.newPage(); await signIn(fresh);
  const freshData = await record(fresh);
  check("a fresh demo tab starts with the original sample price and layout", freshData.settings.offer.LB.sizes["10x16"] === oldPrice && freshData.settings.offer.LB.layout === undefined);
  check("demo layout uses no network API calls", calls.length === 0);
  check("demo layout and return have no page errors", errors.length === 0);
  check("no real sign-in cookie was needed", (await context.cookies()).every(c => c.name !== "dealer_local_user"));
  await context.close();
  console.log(`PROVED: ${checks} demo layout checks passed — same-tab layout edits and saves work without an account, unsaved prices and stopped buildings survive returning, and only that demo tab changes.`);
} catch (error) {
  console.error("FAIL: " + (error.stack || error)); if (calls.length) console.error("Network API calls: " + calls.join(", ")); process.exitCode = 1;
} finally { await browser?.close(); server.kill(); }
