/* CHECK: customer Outside/Inside views, dimensioned floor plan, no learning
   controls or construction runtime, and preserved finished geometry.
   Run: node tools/check-views.mjs [--quiet]             (check-all: browser)
   PLAYWRIGHT_MODULE may point at an existing Playwright installation;
   PLAYWRIGHT_EXECUTABLE may select an installed Chromium/Edge executable. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const require = createRequire(import.meta.url);
let playwright;
for (const name of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright/index.js"].filter(Boolean)) {
  try { playwright = require(name); break; } catch { /* try the next installed runtime */ }
}
if (!playwright) throw new Error("Playwright is unavailable. Set PLAYWRIGHT_MODULE to an existing installation.");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (path === "/favicon.ico") { res.writeHead(204).end(); return; }
    const file = resolve(ROOT, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(ROOT + sep)) { res.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" }).end(bytes);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const BASE = `http://127.0.0.1:${server.address().port}`;
const demo = JSON.parse(await readFile(resolve(ROOT, "companies/demo/company.json"), "utf8"));
const QUIET = process.argv.includes("--quiet");
let checks = 0;
function check(name, condition) { assert.ok(condition, name); checks++; if (!QUIET) console.log("  ok   " + name); }
let browser;
const contexts = [];
async function open(options = {}) {
  const context = await browser.newContext({ viewport: options.phone ? { width: 390, height: 844 } : { width: 1200, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  contexts.push(context);
  if (options.features) await context.route("**/companies/demo/company.json", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ ...demo, features: options.features }) }));
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("request", request => requests.push(new URL(request.url()).pathname));
  await page.goto(BASE + "/?company=demo");
  await page.waitForFunction(() => window.shedUI?.ready);
  await page.evaluate(() => {
    const api = window.shedUI;
    api.camera.autoSpin = false;
    window.__viewRebuilds = 0;
    api.on("rebuild", () => window.__viewRebuilds++);
    window.__planText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      if (this.canvas.id === "bp") window.__planText.push(String(text));
      return original.call(this, text, ...rest);
    };
  });
  return { page, errors, requests };
}
const status = page => page.evaluate(() => ({
  view: window.shedUI.views.view, mode: window.shedUI.getMode(),
  offered: window.shedUI.views.offered(), frames: window.shedUI.getBuildOptions().frames,
  labels: [...document.querySelectorAll(".vw-tab")].map(button => button.textContent),
  selected: document.querySelector(".vw-tab.on")?.getAttribute("data-view"),
  constructionControls: !!document.querySelector("#vw-player, #vw-note, [data-view=framing], [data-view=build]"),
  playerAPI: ["play", "pause", "steps", "caption"].some(key => key in window.shedUI.views),
  rebuilds: window.__viewRebuilds,
}));

try {
  browser = await playwright.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const { page, errors, requests } = await open();
  let result = await status(page);
  check("only Outside and Inside appear, even when legacy construction flags are enabled", JSON.stringify(result.labels) === JSON.stringify(["Outside", "Inside"]) && JSON.stringify(result.offered) === JSON.stringify(["finished", "inside"]));
  check("no construction controls, player API or framing build", !result.constructionControls && !result.playerAPI && !result.frames);
  check("quote, share and blueprint plugins still load", await page.evaluate(() => ["quote", "share", "blueprint"].every(name => window.shedUI.plugins[name] && window.shedUI[name])));
  check("customer page requests no lesson or gallery UI", !requests.some(path => /lesson|learn\.html|part-details|parts-gallery|\.claude|\.agents/.test(path)));

  for (const type of ["UT", "LB", "CS", "SS", "C", "DS", "DK"]) {
    await page.evaluate(async type => {
      const api = window.shedUI, { chooseType } = await import("/ui/state.js");
      api.setState(state => chooseType(state, type, api.getCatalogue()));
      window.__beforeView = api.getResult();
      window.__beforePrice = api.price().total;
      window.__viewRebuilds = 0;
      window.__planText = [];
    }, type);
    await page.click('[data-view="inside"]');
    const inside = await page.evaluate(() => {
      const api = window.shedUI, plan = api.getPlan();
      return { view: api.views.view, mode: api.getMode(), visible: getComputedStyle(document.getElementById("bp")).display !== "none", width: window.__planText.includes(api.ftIn(plan.W)), length: window.__planText.includes(api.ftIn(plan.L)) };
    });
    check(type + ": Inside opens the floor plan with width and length dimensions", inside.view === "inside" && inside.mode === "in" && inside.visible && inside.width && inside.length);
    await page.click('[data-view="finished"]');
    check(type + ": Outside returns without rebuilding, changing geometry or changing price", await page.evaluate(() => {
      const api = window.shedUI;
      return api.views.view === "finished" && api.getMode() === "out" && api.getResult() === window.__beforeView && api.price().total === window.__beforePrice && window.__viewRebuilds === 0;
    }));
  }
  await page.click("#modebar");
  check("the existing Inside bar keeps the selected tab in sync", (await status(page)).selected === "inside");
  await page.click("#modebar");
  check("the existing Outside bar keeps the selected tab in sync", (await status(page)).selected === "finished");
  check("legacy construction API requests are refused", await page.evaluate(() => ["framing", "build"].every(name => { try { window.shedUI.views.set(name); return false; } catch { return true; } })));
  await page.evaluate(() => window.shedUI.setBuildOptions({ frames: true }));
  check("customer rebuild options cannot turn framing back on", !(await status(page)).frames);
  const single = await open({ features: { floorPlan: false, framingView: true, buildPlayback: true } });
  const disabled = await status(single.page);
  check("floor plan disabled leaves Outside with no redundant switcher", JSON.stringify(disabled.offered) === '["finished"]' && disabled.labels.length === 0 && !disabled.constructionControls);

  const mobile = await open({ phone: true });
  check("the phone switcher fits inside the picture and stays clear of camera controls", await mobile.page.evaluate(() => {
    const tabs = document.querySelector(".vw-tabs").getBoundingClientRect(), stage = document.getElementById("stage").getBoundingClientRect(), camera = document.getElementById("views").getBoundingClientRect();
    return tabs.left >= stage.left && tabs.right <= stage.right && tabs.bottom <= stage.bottom && tabs.right < camera.left && document.documentElement.scrollWidth <= innerWidth;
  }));
  await mobile.page.click('[data-view="inside"]');
  check("the phone floor plan remains available", (await status(mobile.page)).view === "inside");
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: resolve(OUT, "views-customer-desktop.png") });
  await mobile.page.screenshot({ path: resolve(OUT, "views-customer-phone.png") });
  check("all customer pages run without browser errors", [...errors, ...single.errors, ...mobile.errors].length === 0);
  console.log(`PROVED: ${checks} customer view checks passed: seven buildings, dimensions, unchanged finished geometry and price, no construction controls or runtime, phone layout.`);
} finally {
  for (const context of contexts) await context.close();
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
