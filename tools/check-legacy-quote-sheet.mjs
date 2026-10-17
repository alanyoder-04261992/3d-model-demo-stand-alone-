/* A QUOTE OR ORDER SAVED BEFORE QUOTES KEPT THEIR OWN COPY OF THE PRICE LIST
   still prints a whole paper (review 17 P2/CS-2).

   Quotes saved before Oct 13 2026 have no snapshot. Their printed quote and
   order sheet showed no fine print, no "Comes with" and "Added" lists and no
   picture, and printed a note telling the customer to ask Barnwright; "See
   it in 3D" opened an error page. They now show those from today's price
   list, as every sheet did before snapshots, say so on the screen only, and
   open the lot's 3D designer with the saved design. The prices are the
   quote's own.

   Run: node tools/check-legacy-quote-sheet.mjs (opens a browser) */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "test/out/legacy-quote-data"), OUT = resolve(ROOT, "test/out/legacy-quote");
const PORT = 16110, BASE = `http://127.0.0.1:${PORT}`;
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");

rmSync(DATA, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--port", String(PORT), "--identity", "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let log = "", browser, page, passed = 0;
server.stdout.on("data", (d) => { log += d; }); server.stderr.on("data", (d) => { log += d; });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const ok = (name, value) => { if (!value) throw new Error(name); passed++; console.log("  ok " + name); };
const errors = [];
async function api(path, body, method = "GET") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch("/api/office/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}
async function open(hash) {
  await page.goto(BASE + "/dealer" + hash, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main");
  await page.waitForFunction(() => !document.querySelector("#main .loading"));
}
/* the stored customer, edited the way a record saved before Oct 13 2026 looks */
function dropSnapshots(customerId) {
  const name = encodeURIComponent(`customers/${customerId}`) + ".json";
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name === name) files.push(p); } };
  walk(DATA);
  if (files.length !== 1) throw new Error(`Found ${files.length} stored records for the customer`);
  const record = JSON.parse(readFileSync(files[0], "utf8"));
  for (const q of record.data.quotes) delete q.snapshot;
  writeFileSync(files[0], JSON.stringify(record));
}

try {
  for (let i = 0; i < 120 && !log.includes("is running"); i++) await pause(250);
  if (!log.includes("is running")) throw new Error("Local server did not start: " + log);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  page = await context.newPage(); page.setDefaultTimeout(25000); page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE + "/dealer", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email", { exact: true }).fill("chris@samplebarns.example");
  await page.getByLabel("Password", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForSelector("#main");

  /* the background picture frame is not needed to prove the link it opens */
  await page.route("**/d/**", (route) => route.request().frame().parentFrame()
    ? route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>picture</title>" }) : route.continue());

  const made = await api("customers", { lot: "brookside", name: "Saved before snapshots", email: "legacy-quote@example.com", requestKey: "legacy-quote-fixture" }, "POST");
  ok("a customer is made", made.status === 201);
  const id = made.data.customer.id;
  const design = await page.evaluate(async () => {
    const { loadLot } = await import("/ui/load.js"), { toState, fromState } = await import("/model/design.js");
    const { catalogue: cat } = await loadLot("brookside");
    return fromState(toState({ v: 1, company: cat.id, cfg: cat.cfg, type: "LB", size: "10x20", colors: {} }, cat).state, cat);
  });
  const quoted = await api(`customers/${id}/quotes`, { design }, "POST");
  ok("a Lofted Barn quote is saved", quoted.status === 201);
  const quote = quoted.data.quote;
  const sold = await api(`customers/${id}/orders`, { quoteId: quote.id, payment: "cash", deposit: 0 }, "POST");
  ok("the quote is sold as an order", sold.status === 201);
  const orderId = (sold.data.order || sold.data.customer?.orders?.[0])?.id;
  dropSnapshots(id);
  const stored = await api(`customers/${id}`);
  ok("the quote now looks like one saved before quotes kept their own copy", !stored.data.customer.quotes[0].snapshot && stored.data.customer.quotes[0].total === quote.total);
  const finePrint = (await api("price-list")).data.settings.notes.finePrint;
  ok("the price list has fine print to show", !!finePrint);

  for (const [what, hash] of [["quote", `#/customers/${id}/quotes/${quote.id}`], ["order", `#/customers/${id}/orders/${orderId}`]]) {
    await open(hash);
    await page.locator(".sheet").waitFor();
    const sheet = await page.locator(".sheet").innerText();
    ok(`the old ${what} sheet prints the business's fine print`, (await page.locator(".sheet-fine").count()) === 1 && (await page.locator(".sheet-fine").innerText()) === finePrint);
    ok(`the old ${what} sheet lists what the building comes with`, (await page.locator(".sheet-item-cols").count()) === 1 && /Comes with/i.test(await page.locator(".sheet-item-cols").innerText()));
    ok(`the old ${what} sheet keeps its own price`, sheet.includes("$" + quote.total.toLocaleString("en-US")));
    ok(`nothing on the old ${what} paper sends the customer to Barnwright`, !/Barnwright|unavailable/i.test(sheet));
    const link = await page.getByRole("link", { name: "See it in 3D", exact: true }).getAttribute("href");
    const url = new URL(link);
    ok(`the old ${what} opens in the lot's 3D designer with its saved design`, !url.searchParams.has("saved-quote") && /^#d=.+&view=1$/.test(url.hash));
    ok(`the old ${what} says on the screen where the names and fine print come from`, /saved before quotes kept their own copy of the price list/.test(await page.locator(".sheet-screen-note").innerText()));
    await page.emulateMedia({ media: "print" });
    ok(`that note is not printed on the ${what}`, !(await page.locator(".sheet-screen-note").isVisible()) && await page.locator(".sheet-fine").isVisible());
    await page.screenshot({ path: `${OUT}/legacy-${what}-print.png`, fullPage: true });
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({ path: `${OUT}/legacy-${what}-screen.png`, fullPage: true });
  }

  await open(`#/customers/${id}`);
  const cardLink = new URL(await page.getByRole("link", { name: "See it in 3D", exact: true }).first().getAttribute("href"));
  ok("the customer card opens the old quote in the 3D designer, not an error page", !cardLink.searchParams.has("saved-quote") && /^#d=.+&view=1$/.test(cardLink.hash));
  await page.unroute("**/d/**");
  await page.goto(cardLink.href, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.shedUI?.ready, null, { timeout: 60000 });
  ok("the 3D designer draws the old quote's building", await page.evaluate(() => shedUI.getDesign().type === "LB" && shedUI.getDesign().size === "10x20"));
  ok("no uncaught browser errors", errors.length === 0);
  console.log(`PROVED (${passed} checks): a quote or order saved before quotes kept their own copy of the price list prints with the business's fine print and its door and window lists, keeps its own prices, never tells the customer to ask Barnwright, and opens in the 3D designer.`);
} finally { if (browser) await browser.close(); server.kill("SIGTERM"); }
