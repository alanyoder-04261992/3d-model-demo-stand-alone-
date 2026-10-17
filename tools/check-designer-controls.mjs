/* Real desktop/phone keyboard interactions through the customer page.
   Graphics are deliberately unavailable in this fixture: the verified
   fallback UI exercises the same choices, sheet, prices and placement rules
   without competing with geometric browser checks. check-all: browser */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), OUT = resolve(ROOT, "test/out");
const MIME = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg"};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(ROOT + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(file);
    response.writeHead(200, {"Content-Type": MIME[extname(file)] || "application/octet-stream"}); response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const require = createRequire(import.meta.url), {chromium} = require("/opt/node22/lib/node_modules/playwright/index.js");
let browser, checks = 0;
const proved = (name, value) => { assert.ok(value, name); checks++; console.log("  ok " + name); };
try {
  await mkdir(OUT, {recursive: true});
  browser = await chromium.launch({args: ["--disable-gpu"]});
  for (const [label, viewport, mobile] of [["desktop", {width: 1280, height: 800}, false], ["phone", {width: 390, height: 844}, true]]) {
    const context = await browser.newContext({viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: "reduce"});
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return /webgl/i.test(kind) ? null : original.call(this, kind, ...args); };
    });
    await page.goto(base + "/?company=demo", {waitUntil: "domcontentloaded"});
    await page.waitForFunction(() => window.shedUI?.ready, null, {timeout: 90000});
    proved(label + ": the supported no-graphics fallback still loads every control", await page.evaluate(() => window.shedUI.renderer.off && window.shedUI.plugins.share));
    const size = page.locator('#sizechips button[data-size="10x16"]'); await size.focus(); await page.keyboard.press("Enter");
    proved(label + ": selecting a size retains focus and announces selected state", await page.evaluate(() => document.activeElement.dataset.size === "10x16" && document.activeElement.getAttribute("aria-pressed") === "true" && window.shedUI.getState().size === "10x16"));
    const color = page.locator("#sw-body button").nth(3), name = await color.getAttribute("aria-label"); await color.focus(); await page.keyboard.press("Enter");
    proved(label + ": selecting a color retains the same named control and state", await page.evaluate(name => document.activeElement.getAttribute("aria-label") === name && document.activeElement.getAttribute("aria-pressed") === "true" && document.querySelectorAll('#sw-body [aria-pressed="true"]').length === 1, name));
    const heading = page.locator("#card-colors .card-toggle"); await heading.focus(); await page.keyboard.press("Space");
    proved(label + ": Space folds the color section with accurate expanded state", await heading.getAttribute("aria-expanded") === "false" && !await page.locator("#sw-body").isVisible());
    await page.keyboard.press("Enter"); proved(label + ": Enter opens the same focused section", await heading.getAttribute("aria-expanded") === "true" && await page.locator("#sw-body").isVisible() && await heading.evaluate(node => document.activeElement === node));
    const included = page.locator('#itemlist button[data-id="i0"]'); await included.focus(); await page.keyboard.press("Enter");
    proved(label + ": a keyboard item selection opens and focuses its editor", await page.locator("#sheet").evaluate(node => node.classList.contains("open")) && await page.locator("#sh-type").evaluate(node => document.activeElement === node));
    const labels = await page.locator("#sh-type").evaluate(node => Object.fromEntries(Array.from(node.options, option => [option.value, option.textContent])));
    proved(label + ": included and replacement-door labels show correct contributions", /included/.test(labels.w72) && /\+\$150\.00/.test(labels.d36in) && /\+\$400\.00/.test(labels.dfr));
    await page.locator("#sh-type").selectOption("d36in");
    proved(label + ": selecting the advertised upgrade adds exactly $150", await page.evaluate(() => window.shedUI.price().total === 5690));
    const back = page.locator('#sh-walls button[data-focus-key="B"]'); await back.focus(); await page.keyboard.press("Enter");
    proved(label + ": a wall change retains focus on its regenerated selected button", await back.evaluate(node => document.activeElement === node && node.getAttribute("aria-pressed") === "true"));
    const before = await page.evaluate(() => window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).pos);
    await page.locator("#sh-pos-p").focus(); await page.keyboard.press("Enter");
    proved(label + ": keyboard movement changes position by one inch", await page.evaluate(before => Math.abs(window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).pos - before - 1 / 12) < 1e-8, before));
    proved(label + ": movement retains focus and never changes the quote", await page.evaluate(() => document.activeElement.id === "sh-pos-p" && window.shedUI.price().total === 5690));
    await page.evaluate(async () => {
      const {moveItem} = await import("/ui/state.js");
      window.shedUI.setState(state => moveItem(state, state.sel, {pos: 100000}, window.shedUI.getCatalogue()));
    });
    const edge = await page.evaluate(() => window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).pos);
    await page.locator("#sh-pos-p").focus(); await page.keyboard.press("Enter");
    proved(label + ": keyboard movement respects the existing wall limit", await page.evaluate(edge => window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).pos === edge && document.querySelector("#sh-pos").textContent.includes("at the limit"), edge));
    await page.locator("#sh-done").focus(); await page.keyboard.press("Enter");
    proved(label + ": Done returns focus to the originating item row", await page.evaluate(() => document.activeElement.dataset.id === "i0" && !document.querySelector("#sheet").classList.contains("open")));
    await page.locator("#add-light").focus(); await page.keyboard.press("Enter");
    proved(label + ": adding an item by keyboard focuses its editor", await page.locator("#sh-type").evaluate(node => document.activeElement === node));
    const height = await page.evaluate(() => window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).vy || 0);
    await page.locator("#sh-vy-p").focus(); await page.keyboard.press("Enter");
    proved(label + ": a height-adjustable item can move up by keyboard", await page.evaluate(height => Math.abs((window.shedUI.getState().items.find(item => item.id === window.shedUI.getState().sel).vy || 0) - height - 1 / 12) < 1e-8, height));
    const viewportRules = await page.evaluate(() => ({
      meta: document.querySelector('meta[name="viewport"]').content,
      actions: [document.documentElement, document.body].map(node => getComputedStyle(node).touchAction),
      width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    }));
    proved(label + ": browser zoom is permitted " + JSON.stringify(viewportRules), !/maximum-scale|user-scalable/.test(viewportRules.meta) && viewportRules.actions.every(action => action === "auto" || action === "manipulation" || action.includes("pinch-zoom")));
    proved(label + ": controls do not overflow horizontally", viewportRules.scrollWidth <= viewportRules.width);
    proved(label + ": no JavaScript errors occurred", errors.length === 0);
    await page.screenshot({path: resolve(OUT, `designer-controls-${label}.png`)}); await context.close();
  }
  console.log(`PROVED: ${checks} customer designer input checks passed in real desktop/phone browser contexts; geometry was not changed or revalidated by this fixture.`);
} finally { if (browser) await browser.close(); await new Promise(done => server.close(done)); }
