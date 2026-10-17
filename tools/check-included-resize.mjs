/* check-all: browser
   PROVE in the real 3D designer page (Alan, Oct 17 2026: "Yes, charge for
   them"): a customer picks the Cabin at 12x32, moves a door one inch, then
   picks 8x12. The windows the 12x32 came with stay on the walls, but the
   ones an 8x12 does not come with are charged at the normal window price:
   the plate and Your quote show the charged total, which is the total the
   server charges for the design the page would send, and one plain line
   says why ("2 windows that came with the 12×32 are now charged on the
   8×12."). Back to 12x32, the line goes and the windows are free again.
   On a desktop and a phone, with no sideways scrolling. On c355440 the page
   showed the 8x12's own price and no line.

   Served on 127.0.0.1:16201 (this lane's ports are 16200-16249). Graphics
   are switched off for speed: the no-graphics page has every card, price
   and the plate (ui/app.js). */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadCatalogue } from "./lib/load.mjs";
import { priceDesign } from "../server/office/pricing.js";
import { money } from "../model/pricing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), ".."), OUT = resolve(ROOT, "test/out");
const PORT = 16201;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = resolve(ROOT, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(ROOT + sep)) { response.writeHead(403).end(); return; }
    const data = await readFile(file);
    response.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" }); response.end(data);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done, fail) => { server.once("error", fail); server.listen(PORT, "127.0.0.1", done); });
const base = `http://127.0.0.1:${PORT}`;
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const cat = loadCatalogue("demo");
const LINE = "2 windows that came with the 12×32 are now charged on the 8×12.";
const charged = cat.P.C["8x12"] + 2 * cat.CAT.w23.p;
let browser, checks = 0;
const proved = (name, value, detail) => { assert.ok(value, name + (detail ? " -- " + detail : "")); checks++; console.log("  ok " + name); };
try {
  await mkdir(OUT, { recursive: true });
  browser = await chromium.launch({ args: ["--disable-gpu"] });
  for (const [label, viewport, mobile] of [["desktop", { width: 1280, height: 800 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return /webgl/i.test(kind) ? null : original.call(this, kind, ...args); };
    });
    await page.goto(base + "/?company=demo", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.shedUI?.ready, null, { timeout: 90000 });
    /* the Cabin, as a customer picks it: its group, its chip, then 12x32 */
    const group = await page.evaluate(() => (window.shedUI.getCatalogue().CATS || []).findIndex((c) => String(c[1]).split(",").includes("C")));
    await page.locator("#catsel").selectOption(String(group));
    await page.locator('#typechips button[data-focus-key="C"]').click();
    await page.locator('#sizechips button[data-size="12x32"]').click();
    proved(label + ": the Cabin 12x32 is picked with its windows free, and no line",
      await page.evaluate((p) => { const s = window.shedUI.getState(); return s.type === "C" && s.size === "12x32" && window.shedUI.price().total === p; }, cat.P.C["12x32"])
      && await page.locator("#platenote").isHidden() && await page.locator("#sum .chargednote").count() === 0);
    /* move a door one inch, the way a customer does: pick it, tap the arrow */
    const doorId = await page.evaluate(() => { const c = window.shedUI.getCatalogue(); return window.shedUI.getState().items.find((i) => c.CAT[i.cat].k === "door").id; });
    await page.locator(`#itemlist button[data-id="${doorId}"]`).click();
    await page.locator("#sh-pos-p").click();
    await page.locator("#sh-done").click();
    await page.locator('#sizechips button[data-size="8x12"]').click();
    const seen = await page.evaluate(() => ({
      size: window.shedUI.getState().size, total: window.shedUI.price().total,
      plate: document.getElementById("plateprice").textContent, note: document.getElementById("platenote")?.textContent || "",
      noteShown: !!document.getElementById("platenote") && !document.getElementById("platenote").hidden, sum: document.querySelector("#sum .chargednote")?.textContent || "",
      sumTotal: document.querySelector("#sum .sumline.tot b")?.textContent || "",
      design: window.shedUI.getDesign(), wins: window.shedUI.getState().items.filter((i) => i.inc && window.shedUI.getCatalogue().CAT[i.cat].k === "win").length,
      scroll: document.documentElement.scrollWidth - innerWidth,
    }));
    proved(`${label}: after 8x12 the 12x32's windows are still on the walls (${seen.wins})`, seen.size === "8x12" && seen.wins > 2);
    proved(`${label}: the plate and Your quote show the charged total ${money(charged)}`, seen.total === charged && seen.plate === money(charged) && seen.sumTotal === money(charged), JSON.stringify([seen.total, seen.plate, seen.sumTotal]));
    proved(`${label}: one plain line near the price: "${seen.note}"`, seen.noteShown && seen.note === LINE && seen.sum === LINE, JSON.stringify([seen.note, seen.sum]));
    const server = priceDesign(seen.design, cat);
    proved(`${label}: the server charges exactly what the page shows`, server.price.total === seen.total);
    const box = await page.locator("#platenote").boundingBox();
    proved(`${label}: the line fits on the screen, with no sideways scrolling`, box && box.x >= 0 && box.x + box.width <= viewport.width && seen.scroll <= 0, JSON.stringify([box, seen.scroll]));
    await page.locator("#plate").screenshot({ path: resolve(OUT, `included-resize-${label}-plate.png`) });
    await page.screenshot({ path: resolve(OUT, `included-resize-${label}.png`) });
    await page.locator('#sizechips button[data-size="12x32"]').click();
    proved(label + ": back to 12x32, the windows are free again and the line is gone",
      await page.evaluate((p) => window.shedUI.price().total === p, cat.P.C["12x32"]) && await page.locator("#platenote").isHidden() && await page.locator("#sum .chargednote").count() === 0);
    proved(label + ": no page errors", errors.length === 0, errors.join(" | "));
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  server.close();
}
console.log(`PROVED (${checks} checks): in the 3D designer, a Cabin made 12x32, a door moved, then 8x12, keeps the 12x32's windows on its walls but is charged the normal window price for the two an 8x12 does not come with; the plate and Your quote show the total the server charges, with one plain line saying why, on a desktop and a phone.`);
