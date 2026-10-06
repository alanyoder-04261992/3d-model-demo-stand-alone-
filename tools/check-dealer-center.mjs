/* CHECK: THE DEALER CENTER WORKS IN A REAL BROWSER, FOR EVERY KIND OF PERSON.
   Run: node tools/check-dealer-center.mjs [--keep]
   check-all: browser

   It starts the local Dealer Center (tools/office-local.mjs) with fresh
   sample data in test/out/dealer-center-data, opens Chromium, and proves:

     1. signing in: the sign-in screen lists the sample team; picking the
        owner opens Today;
     2. every screen opens for the owner, the manager and a dealer, on a
        desktop and on a phone, with no errors, no "didn't load", no stray
        "null" or "undefined" in the words, and no sideways scrolling on
        the phone; a dealer has no Team or Settings
        and sees only their own lot;
     3. a price change reaches every lot at once: the owner raises a price,
        and each lot's 3D designer has the new price on its next visit;
     4. a customer's quote request from a lot's 3D designer lands on that
        lot's customer list, priced by the server;
     5. a dealer who types another lot's customer into the address gets
        "couldn't find", not the customer;
     6. designing a building for a customer inside the Dealer Center saves a
        quote on their file;
     7. the "try it" demo (/dealer?demo) works with made-up data and never
        calls the real server.

   Pictures of every screen go to test/out/dealer-center/. --keep leaves the
   server running at the end (for a look by hand). */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { decode } from "../model/design.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out/dealer-center");
const DATA = "test/out/dealer-center-data";
const PORT = 8370;
const BASE = `http://127.0.0.1:${PORT}`;
const KEEP = process.argv.includes("--keep");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");

const PEOPLE = {
  owner: "chris@samplebarns.example",
  manager: "sarah@samplebarns.example",
  dealer: "mike@samplebarns.example",      /* Riverside only */
};

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("    ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("    FAIL " + name + (extra ? " -- " + extra : "")); }
}
const section = (t) => console.log("\n  " + t);

/* ---- the local Dealer Center ------------------------------------------------ */

rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
for (let i = 0; i < 120 && !/is running/.test(serverLog); i++) await new Promise((r) => setTimeout(r, 250));
if (!/is running/.test(serverLog)) {
  console.log("FAIL the local Dealer Center did not start:\n" + serverLog);
  server.kill();
  process.exit(1);
}

async function apiAs(email, path, { method = "GET", body } = {}) {
  const r = await fetch(BASE + "/api/office/" + path, {
    method, headers: { cookie: `dealer_local_user=${encodeURIComponent(email)}`, origin: BASE, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function pageFor(email, { width = 1300, height = 860 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 40[134]/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push("page error: " + e.message));
  return page;
}

async function openScreen(page, hash) {
  await page.goto(`${BASE}/dealer#${hash}`, { waitUntil: "load" });
  await page.waitForSelector("#main", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector("#main .loading"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}

try {
  /* ---- 1 ----------------------------------------------------------------- */
  section("1. Signing in");
  {
    const page = await pageFor(null);
    await page.goto(`${BASE}/dealer`, { waitUntil: "load" });
    await page.waitForSelector(".person-pick", { timeout: 20000 });
    const names = await page.$$eval(".person-pick strong", (els) => els.map((e) => e.textContent));
    ok("the sign-in screen lists the sample team (" + names.join(", ") + ")", names.includes("Chris Walker") && names.includes("Mike Harper"));
    await page.screenshot({ path: `${OUT}/sign-in.png` });
    await page.click(".person-pick:has-text('Chris Walker')");
    await page.waitForSelector(".sidenav", { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector("#main .loading"), null, { timeout: 20000 });
    ok("picking the owner opens the Dealer Center on Today", (await page.textContent("#main")).length > 50 && /Today/.test(await page.textContent(".sidenav .on")));
    ok("no errors while signing in", page.errors.length === 0, page.errors.join(" | "));
    await page.context().close();
  }

  /* ---- 2 ----------------------------------------------------------------- */
  section("2. Every screen, for every kind of person, on a desktop and a phone");
  const rows = (await apiAs(PEOPLE.owner, "customers")).data.rows;
  const withOrder = rows.find((r) => r.orders.length && r.lot === "riverside");
  const pcCustomer = rows.find((r) => r.lot === "riverside");
  const screens = [
    ["today", "/"], ["customers", "/customers"], ["customers-board", "/customers?view=board"], ["customer", `/customers/${pcCustomer.id}`],
    ["orders", "/orders"], ["order-sheet", `/customers/${withOrder.id}/orders/${withOrder.orders[0].id}`],
    ["quote-sheet", `/customers/${pcCustomer.id}/quotes/${(await apiAs(PEOPLE.owner, `customers/${pcCustomer.id}`)).data.customer.quotes[0].id}`],
    ["price-list", "/price-list"], ["price-doors", "/price-list/doors"], ["price-options", "/price-list/options"],
    ["price-colors", "/price-list/colors"], ["price-history", "/price-list/history"],
    ["lots", "/lots"], ["lot", "/lots/riverside"], ["team", "/team"], ["settings", "/settings"],
  ];
  for (const [role, email] of Object.entries(PEOPLE)) {
    for (const [label, size] of [["desktop", { width: 1300, height: 860 }], ["phone", { width: 390, height: 844 }]]) {
      const page = await pageFor(email, size);
      const broken = [], sideways = [];
      for (const [name, hash] of screens) {
        await openScreen(page, hash);
        const text = await page.textContent("#main");
        if (/didn't load|Something went wrong|being built|Coming soon/.test(text)) broken.push(name);
        const junk = /\bnull\b|\bundefined\b|\bNaN\b|\[object Object\]/.exec(text);
        if (junk) broken.push(`${name} (shows "${junk[0]}")`);
        if (label === "phone") {
          const wide = await page.evaluate(() => document.documentElement.scrollWidth);
          if (wide > 392) sideways.push(`${name} (${wide}px)`);
        }
        await page.screenshot({ path: `${OUT}/${role}-${label}-${name}.png`, fullPage: label === "desktop" });
      }
      ok(`${role}, ${label}: all ${screens.length} screens open`, broken.length === 0, broken.join(", "));
      if (label === "phone") ok(`${role}, phone: no screen scrolls sideways`, sideways.length === 0, sideways.join(", "));
      ok(`${role}, ${label}: no errors in the page`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
      if (label === "desktop") {
        const nav = await page.$$eval(".sidenav .nav-item span", (els) => els.map((e) => e.textContent));
        if (role === "dealer") ok("a dealer's menu has no Team or Settings (" + nav.join(", ") + ")", !nav.includes("Team") && !nav.includes("Settings"));
        if (role === "owner") ok("the owner's menu has Team and Settings", nav.includes("Team") && nav.includes("Settings"));
      }
      await page.context().close();
    }
  }
  const mikeRows = (await apiAs(PEOPLE.dealer, "customers")).data.rows;
  ok(`a dealer's customer list holds only their lot (${mikeRows.length} customers, all Riverside)`, mikeRows.length > 0 && mikeRows.every((r) => r.lot === "riverside"));

  /* ---- 3 ----------------------------------------------------------------- */
  section("3. A price change reaches every lot at once");
  {
    const pl = (await apiAs(PEOPLE.owner, "price-list")).data;
    const settings = structuredClone(pl.settings);
    const before = settings.offer.LB.sizes["10x16"];
    settings.offer.LB.sizes["10x16"] = before + 100;
    const saved = await apiAs(PEOPLE.owner, "price-list", { method: "PUT", body: { settings, version: pl.version } });
    ok("the owner saves Lofted Barn 10×16 at $100 more", saved.status === 200, JSON.stringify(saved.data).slice(0, 200));
    for (const lot of ["riverside", "springfield", "brookside"]) {
      const page = await pageFor(null);
      await page.goto(`${BASE}/d/${lot}/`, { waitUntil: "load" });
      await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
      const price = await page.evaluate(() => window.shedUI.getCatalogue().P.LB["10x16"]);
      ok(`${lot}'s 3D designer shows the new price ($${price})`, price === before + 100);
      await page.context().close();
    }
  }

  /* ---- 4 ----------------------------------------------------------------- */
  section("4. A customer's quote request from a lot's 3D designer");
  {
    const page = await pageFor(null, { width: 1300, height: 900 });
    await page.goto(`${BASE}/d/springfield/`, { waitUntil: "load" });
    await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
    const shown = await page.evaluate(() => window.shedUI.price().total);
    await page.fill('.qform [name="name"]', "Pat Example");
    await page.fill('.qform [name="phone"]', "(555) 010-7788");
    const zip = await page.$('.qform [name="zip"]');
    if (zip) await zip.fill("34952");
    await page.waitForTimeout(3500);   /* the form waits a moment before it sends (robots are quicker) */
    await page.click(".qform .qsend");
    await page.waitForSelector(".qform .sent", { timeout: 20000 });
    const said = await page.textContent(".qform .qresult");
    ok("the customer sees their quote number (" + said.replace(/\s+/g, " ").trim().slice(0, 120) + ")", /quote number is #\d{4}/i.test(said));
    ok("no errors on the lot's designer", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.screenshot({ path: `${OUT}/lot-designer-sent.png` });
    await page.context().close();
    const pg = (await apiAs("dana@samplebarns.example", "customers")).data.rows.find((r) => r.name === "Pat Example");
    ok("Springfield's dealer has the new customer, New, at the price the server worked out", pg && pg.stage === "new" && pg.lot === "springfield" && pg.total === shown, JSON.stringify(pg || {}).slice(0, 160));
    const mike = (await apiAs(PEOPLE.dealer, "customers")).data.rows.find((r) => r.name === "Pat Example");
    ok("Riverside's dealer does not see them", !mike);
  }

  /* ---- 5 ----------------------------------------------------------------- */
  section("5. Another lot's customer stays private");
  {
    const other = rows.find((r) => r.lot === "brookside");
    const page = await pageFor(PEOPLE.dealer);
    await openScreen(page, `/customers/${other.id}`);
    const text = await page.textContent("#main");
    ok("Mike typing a Brookside customer's address sees \"couldn't find\", not the customer", /couldn.t find/i.test(text) && !text.includes(other.name), text.slice(0, 120));
    await page.context().close();
  }

  /* ---- 6 ----------------------------------------------------------------- */
  section("6. Designing a building for a customer");
  {
    const customer = (await apiAs(PEOPLE.owner, `customers/${pcCustomer.id}`)).data.customer;
    const page = await pageFor(PEOPLE.owner, { width: 1300, height: 900 });
    await openScreen(page, `/customers/${customer.id}/design`);
    const frame = await page.waitForSelector("iframe", { timeout: 20000 });
    const inner = await frame.contentFrame();
    await inner.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
    await page.screenshot({ path: `${OUT}/owner-desktop-design.png` });
    /* "Copy link to this building": the lot's own designer link, this exact building in it */
    await page.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; });
    await page.getByRole("button", { name: /copy link to this building/i }).click();
    await page.waitForFunction(() => window.__copied, null, { timeout: 10000 }).catch(() => {});
    const copied = await page.evaluate(() => window.__copied || "");
    const onScreen = await inner.evaluate(() => window.shedUI.getDesign());
    let linked = null;
    try { linked = await decode(copied); } catch (e) { linked = { error: e.message }; }
    const lotLink = `${BASE}/d/${customer.lot}/#d=`;
    ok("\"Copy link to this building\" copies the customer's lot's 3D designer link with this exact building in it", copied.startsWith(lotLink) && !/view=1/.test(copied) && linked && linked.type === onScreen.type && linked.size === onScreen.size && JSON.stringify(linked.items) === JSON.stringify(onScreen.items), copied.slice(0, 90));
    ok("... and says so", /Link copied/.test(await page.textContent("body")));
    ok("the 3D designer itself (the link customers use) has no copy-link button", !(await inner.evaluate(() => /Copy link to this building/.test(document.body.textContent))));
    await page.getByRole("button", { name: /save quote/i }).click();
    await page.waitForFunction((id) => location.hash === `#/customers/${id}`, customer.id, { timeout: 20000 }).catch(() => {});
    const after = (await apiAs(PEOPLE.owner, `customers/${customer.id}`)).data.customer;
    ok(`"Save quote" adds a quote to ${customer.name}'s file (${customer.quotes.length} → ${after.quotes.length})`, after.quotes.length === customer.quotes.length + 1);
    ok("the new quote was made in the Dealer Center, by Chris (the owner)", after.quotes.at(-1)?.source === "office" && /Chris/.test(after.quotes.at(-1)?.by?.name || ""));
    ok("no errors while designing", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---- 7 ----------------------------------------------------------------- */
  section("7. The \"try it\" demo");
  {
    const page = await pageFor(null);
    const calls = [];
    page.on("request", (r) => { if (/\/api\//.test(r.url())) calls.push(r.url()); });
    await page.goto(`${BASE}/dealer?demo`, { waitUntil: "load" });
    await page.waitForSelector(".person-pick", { timeout: 30000 });
    await page.click(".person-pick:has-text('Chris Walker')");
    await page.waitForSelector(".banner.demo", { timeout: 30000 });
    await page.goto(`${BASE}/dealer?demo#/customers`, { waitUntil: "load" });
    await page.waitForSelector(".banner.demo", { timeout: 30000 });
    await page.waitForFunction(() => !document.querySelector("#main .loading"), null, { timeout: 20000 });
    const text = await page.textContent("#main");
    ok("the demo opens the made-up business's customers", /30 customers|Customers/.test(text));
    ok("the demo never called the real server (" + calls.length + " calls)", calls.length === 0, calls.slice(0, 3).join(" "));
    ok("no errors in the demo", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.screenshot({ path: `${OUT}/demo-customers.png` });
    await page.context().close();
  }
} catch (e) {
  ok("the check ran to the end", false, e.stack || String(e));
} finally {
  await browser.close();
  if (!KEEP) server.kill();
  else console.log(`\n  The Dealer Center is still running: ${BASE}/dealer`);
}

for (const f of failures) console.log("  FAIL " + f);
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} checks failed.`);
  process.exit(1);
}
console.log(`PROVED: all ${pass} checks passed -- the Dealer Center opens every screen for the owner, a manager and a dealer on a desktop and a phone without errors; a dealer sees only their lot; a price change reaches all 3 lots' designers at once; a quote sent from a lot's designer lands on that lot's list priced by the server; designing for a customer saves a quote; the demo runs without the server. Pictures: test/out/dealer-center/.`);
