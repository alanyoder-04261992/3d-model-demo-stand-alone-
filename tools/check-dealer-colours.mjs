/* CHECK: the Dealer Center's red Stop selling buttons and the How it's built
   chips are readable in light and dark: every state reaches 4.5:1.
   Loads the real stylesheets into a small page in Chromium.
   Run: node tools/check-dealer-colours.mjs   (check-all: browser) */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const sheets = ["office.css", "crm.css", "owner.css", "help.css"].map((name) => pathToFileURL(resolve(ROOT, "ui/office", name)).href);
const body = `<div class="main pl">
  <button class="btn btn-danger" data-name="Stop selling on the Edit page">Stop selling</button>
  <div class="pl-built-chips">
    <button class="pl-built-chip" aria-pressed="false" data-name="an unpicked chip">4 ft</button>
    <button class="pl-built-chip" aria-pressed="true" data-name="a picked chip">8 ft</button>
    <button class="pl-built-chip std" aria-pressed="true" data-name="a picked chip from the standard">Door side</button>
  </div>
</div>
<dialog class="dialog" open><div class="dialog-body"><div class="actions end"><button class="btn">Keep selling</button><button class="btn btn-danger" data-name="Stop selling in its question box">Stop selling</button></div></div></dialog>`;

const channel = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const rgb = (text) => text.match(/[\d.]+/g).slice(0, 3).map(Number);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const OUT = resolve(ROOT, "test/out/dealer-colours"), file = resolve(OUT, "page.html");
mkdirSync(OUT, { recursive: true });
writeFileSync(file, `<!doctype html><html><head><meta charset="utf-8">${sheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body>${body}</body></html>`);
let browser, passed = 0, failed = 0;
try {
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
  for (const colorScheme of ["light", "dark"]) {
    const page = await browser.newPage({ colorScheme });
    await page.goto(pathToFileURL(file).href);
    await page.waitForLoadState("load");
    if (await page.$eval(".btn-danger", (node) => getComputedStyle(node).backgroundColor) === "rgb(239, 239, 239)") throw new Error("The Dealer Center stylesheets did not load.");
    const found = await page.$$eval("[data-name]", (nodes) => nodes.map((node) => { const s = getComputedStyle(node); return { name: node.dataset.name, color: s.color, background: s.backgroundColor, filter: s.filter }; }));
    for (const item of found) {
      const value = ratio(rgb(item.color), rgb(item.background));
      const good = value >= 4.5 && item.filter === "none";
      console.log(`  ${good ? "ok" : "FAIL"} ${colorScheme}: ${item.name} ${value.toFixed(2)}:1 (${item.color} on ${item.background})`);
      good ? passed++ : failed++;
    }
    await page.close();
  }
} finally { await browser?.close(); }
if (failed) { console.log(`FAILED: ${failed} of ${passed + failed} colour pairs are below 4.5:1.`); process.exit(1); }
console.log(`PROVED (${passed} checks): Stop selling buttons and How it's built chips read at 4.5:1 or better in light and dark.`);
