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
        calls the real server, Help included;
     8. Help: every role has it in the menu (under More on a phone) and at
        the top; not connected, it shows the short answers, the search and
        the email to write to. Then a second local Dealer Center, connected
        to a pretend control room and Sales Inbox (--control-room): a dealer
        asks from Help, is told where the answer will come, and sees
        Barnwright's answer; the owner sees the dealer's question, another
        dealer doesn't; a problem on a screen or on a lot's 3D designer goes
        to the site's own server (at most 3 a page, no query string), and a
        designer whose site answers 404 there carries on.

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
/* the second copy, connected to a pretend control room and Sales Inbox (section 8) */
const DATA_CR = "test/out/dealer-center-data-connected";
const PORT_CR = 8371;
const BASE_CR = `http://127.0.0.1:${PORT_CR}`;
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

async function pageFor(email, { width = 1300, height = 860, base = BASE } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: base }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 40[134]/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push("page error: " + e.message));
  return page;
}

async function openScreen(page, hash, base = BASE) {
  await page.goto(`${base}/dealer#${hash}`, { waitUntil: "load" });
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
    ["lots", "/lots"], ["lot", "/lots/riverside"], ["team", "/team"], ["settings", "/settings"], ["help", "/help"],
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
        ok(`the ${role}'s menu ends with Help`, nav[nav.length - 1] === "Help", nav.join(", "));
      } else {
        const more = await page.$$eval(".more-sheet .more-item span", (els) => els.map((e) => e.textContent));
        ok(`on a phone, the ${role}'s Help is under More (${more.join(", ")})`, more.includes("Help"));
      }
      ok(`the ${role} has a Help button at the top on a ${label}`, await page.$eval(".topbar-help", (a) => a.getAttribute("href") === "#/help" && a.getBoundingClientRect().width > 20));
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
    await page.goto(`${BASE}/dealer?demo#/help`, { waitUntil: "load" });
    await page.waitForSelector(".banner.demo", { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector(".hp-answer") && !document.querySelector("#main .loading"), null, { timeout: 20000 });
    ok("the demo's Help shows the short answers, and the email to write to instead of the box",
      (await page.$$eval(".hp-answer", (els) => els.length)) >= 10 && !(await page.$(".hp-ask textarea")) && /support@barnwrightsoftware\.com/.test(await page.textContent(".hp-ask")));
    await page.screenshot({ path: `${OUT}/demo-help.png` });
    ok("the demo never called the real server (" + calls.length + " calls)", calls.length === 0, calls.slice(0, 3).join(" "));
    ok("no errors in the demo", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.screenshot({ path: `${OUT}/demo-customers.png` });
    await page.context().close();
  }

  /* ---- 8 ----------------------------------------------------------------- */
  section("8. Help");
  {
    /* this computer isn't connected to Barnwright: the answers, and the email */
    const page = await pageFor(PEOPLE.dealer, { width: 390, height: 844 });
    await openScreen(page, "/price-list");
    await page.click(".topbar-help");
    await page.waitForFunction(() => location.hash === "#/help" && document.querySelector(".hp-answer") && !document.querySelector("#main .loading"), null, { timeout: 20000 });
    const n = await page.$$eval(".hp-answer", (els) => els.length);
    ok(`the Help button at the top opens Help, with the short answers (${n})`, n >= 10 && n <= 14);
    await page.fill(".hp-search input", "website code");
    await page.waitForTimeout(400);
    const found = await page.$$eval(".hp-answer", (els) => els.map((e) => [e.querySelector(".hp-q").textContent, e.open]));
    ok("the search finds the website answer and opens it", found.length === 1 && /website/.test(found[0][0]) && found[0][1] === true, JSON.stringify(found));
    ok("not connected: no question box, one line with the email to write to", !(await page.$(".hp-ask textarea"))
      && !!(await page.$('.hp-ask a[href="mailto:support@barnwrightsoftware.com"]')) && await page.$eval("#hp-questions", (el) => el.hidden));
    ok("no errors on Help", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.screenshot({ path: `${OUT}/help-not-connected-phone.png` });
    await page.context().close();
  }
  rmSync(resolve(ROOT, DATA_CR), { recursive: true, force: true });
  const connected = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--control-room", "--port", String(PORT_CR), "--data", DATA_CR], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let connectedLog = "";
  connected.stdout.on("data", (d) => { connectedLog += d; });
  connected.stderr.on("data", (d) => { connectedLog += d; });
  try {
    for (let i = 0; i < 120 && !/is running/.test(connectedLog); i++) await new Promise((r) => setTimeout(r, 250));
    ok("a Dealer Center connected to a pretend control room and Sales Inbox starts", /is running/.test(connectedLog), connectedLog.slice(-300));
    const inboxNow = async (body = {}) => (await fetch(`${BASE_CR}/__local/help-inbox`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
    {
      const page = await pageFor(PEOPLE.dealer, { width: 1300, height: 900, base: BASE_CR });
      await openScreen(page, "/price-list", BASE_CR);
      await page.click(".topbar-help");
      await page.waitForSelector(".hp-ask textarea", { timeout: 20000 });
      await page.fill(".hp-ask textarea", "How do I add a 12×32 size to the Lofted Barn?");
      await page.click(".hp-ask button[type=submit]");
      await page.waitForFunction(() => /^Sent\./.test(document.querySelector(".hp-ask .form-status")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
      const said = (await page.textContent(".hp-ask .form-status")).trim();
      ok("Mike (a dealer) asks Barnwright from Help and is told where the answer will come", said === "Sent. Barnwright will answer here and by email at mike@samplebarns.example.", said);
      await page.waitForFunction(() => document.querySelectorAll(".hp-item").length === 1, null, { timeout: 20000 }).catch(() => {});
      ok("... and his question shows under Your questions, waiting for an answer", /Waiting for an answer/.test(await page.textContent("#hp-questions")) && (await page.inputValue(".hp-ask textarea")) === "");
      const held = await inboxNow();
      ok("Barnwright has it from Mike, with the screen he came from and the technical details", held.questions?.length === 1 && held.questions[0].asker.id === "sample-mike"
        && held.questions[0].asker.role === "dealer" && held.questions[0].page === "#/price-list" && ["appVersion", "account", "lots", "errors"].every((k) => held.questions[0].details.includes(k)), JSON.stringify(held.questions));
      await inboxNow({ answer: "Open Price list, tap the Lofted Barn, then Add a size: 12 ft wide, 32 long, and its price. The owner taps Save for all lots." });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.querySelector("#main") && !document.querySelector("#main .loading"), null, { timeout: 20000 }).catch(() => {});
      await page.waitForSelector(".hp-reply", { timeout: 20000 }).catch(() => {});
      const mine = await page.textContent("#hp-questions");
      ok("Barnwright's answer shows on his Help screen, marked Answered", /Answered/.test(mine) && /Add a size: 12 ft wide/.test(mine) && !/Waiting for an answer/.test(mine), mine.slice(0, 200));
      ok("no errors while asking", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
      await page.screenshot({ path: `${OUT}/help-answered-desktop.png`, fullPage: true });
      /* from a customer's page: Barnwright learns it was a customer's page, never which customer */
      await openScreen(page, "/customers", BASE_CR);
      const row = await page.$eval('a[href^="#/customers/"]', (a) => a.getAttribute("href"));
      await page.click(`a[href="${row}"]`);
      await page.waitForFunction((h) => location.hash === h && !document.querySelector("#main .loading"), row, { timeout: 20000 }).catch(() => {});
      await page.click(".topbar-help");
      await page.waitForSelector(".hp-ask textarea", { timeout: 20000 });
      const goes = await page.textContent(".hp-goes");
      ok("opened from a customer's page, the form says that page goes with the question", /the page you came from \(a customer's page\)/.test(goes), goes);
      await page.fill(".hp-ask textarea", "A question from a customer's page");
      await page.click(".hp-ask button[type=submit]");
      await page.waitForFunction(() => /^Sent\./.test(document.querySelector(".hp-ask .form-status")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
      const heldNow = (await inboxNow()).questions || [];
      ok("... and Barnwright gets the screen (#/customers/:id), never which customer", heldNow.length === 2 && heldNow[1].page === "#/customers/:id" && !heldNow[1].page.includes(row.split("/")[2]), JSON.stringify(heldNow.map((q) => q.page)));
      await page.context().close();
    }
    {
      const owner = await pageFor(PEOPLE.owner, { base: BASE_CR });
      await openScreen(owner, "/help", BASE_CR);
      await owner.waitForSelector(".hp-item", { timeout: 20000 }).catch(() => {});
      ok("the owner sees Mike's question", (await owner.$$eval(".hp-item", (els) => els.length)) === 1 && /Mike Harper/.test(await owner.textContent("#hp-questions")));
      await owner.context().close();
      const dana = await pageFor("dana@samplebarns.example", { base: BASE_CR });
      await openScreen(dana, "/help", BASE_CR);
      await dana.waitForSelector("#hp-questions:not([hidden])", { timeout: 20000 }).catch(() => {});
      ok("another dealer (Dana) doesn't", (await dana.$$eval(".hp-item", (els) => els.length)) === 0 && /No questions yet/.test(await dana.textContent("#hp-questions")));
      await dana.context().close();
    }
    {
      /* a problem nothing caught, on a Dealer Center screen and on a lot's 3D designer */
      const page = await pageFor(PEOPLE.dealer, { base: BASE_CR });
      const sent = [];
      page.on("request", (rq) => { if (rq.url().endsWith("/api/office/problem")) sent.push({ url: rq.url(), body: JSON.parse(rq.postData() || "{}") }); });
      await openScreen(page, "/", BASE_CR);
      /* a real script of this site with a query string that can't run as a plain script, and some thrown errors */
      const broken = (src) => page.evaluate((address) => new Promise((done) => {
        const el = document.createElement("script");
        el.src = address;
        el.onload = el.onerror = () => setTimeout(done, 50);
        document.head.append(el);
      }), src);
      await broken("/ui/problems.js?v=check");
      await page.evaluate(() => { for (let i = 0; i < 4; i++) setTimeout(() => { throw new Error(`check: a test problem ${i}`); }, 20 * (i + 1)); });
      await page.waitForTimeout(1500);
      ok("problems on a Dealer Center screen go to this site's own server: at most 3 a page", sent.length === 3 && sent.every((x) => x.url === `${BASE_CR}/api/office/problem` && x.body.area === "dealer-center" && /^dealer-center:[0-9a-f]{16}$/.test(x.body.signature)), JSON.stringify(sent.map((x) => x.body.message)));
      ok("... with where in the code and no query string, and the screen", sent[0]?.body.where && /^\/ui\/problems\.js:\d+:\d+$/.test(sent[0].body.where) && sent.every((x) => x.body.page === "/dealer#/" && !/\?/.test(x.body.where)), JSON.stringify(sent[0]?.body));
      await page.goto(`${BASE_CR}/d/riverside/`, { waitUntil: "load" });
      await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
      const before = sent.length;
      await broken("ui/problems.js?v=designer");
      await page.waitForTimeout(1000);
      const designer = sent.slice(before);
      ok("a problem on a lot's 3D designer goes too, as the designer's, with the page's path only", designer.length === 1 && designer[0].body.area === "designer" && designer[0].body.page === "/d/riverside/" && /^\/ui\/problems\.js:\d+:\d+$/.test(designer[0].body.where), JSON.stringify(designer.map((x) => x.body)));
      await page.waitForTimeout(500);
      const held = await inboxNow();
      ok("the pretend Sales Inbox has them, one per kind", held.problems.some((x) => x.area === "designer") && held.problems.filter((x) => x.area === "dealer-center").length === 3, JSON.stringify(held.problems));
      await page.context().close();
    }
    {
      /* a static copy of the designer, where that address answers 404 */
      const page = await pageFor(null);
      await page.context().route("**/api/office/problem", (r) => r.fulfill({ status: 404, contentType: "text/plain", body: "Not found." }));
      const tries = [];
      page.on("request", (rq) => { if (rq.url().endsWith("/api/office/problem")) tries.push(rq.url()); });
      await page.goto(`${BASE}/c/demo/`, { waitUntil: "load" });
      await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 60000 });
      await page.evaluate(() => { setTimeout(() => { throw new Error("check: a test problem on a static copy"); }, 10); });
      await page.waitForTimeout(800);
      const others = page.errors.filter((e) => !/a test problem on a static copy/.test(e));
      ok("a site where that address answers 404: the report was tried once, the designer carries on, nothing else went wrong",
        tries.length === 1 && others.length === 0 && await page.evaluate(() => window.shedUI.ready && window.shedUI.price().total > 0), others.join(" | "));
      await page.context().close();
    }
  } finally {
    connected.kill();
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
console.log(`PROVED: all ${pass} checks passed -- the Dealer Center opens every screen for the owner, a manager and a dealer on a desktop and a phone without errors; a dealer sees only their lot; a price change reaches all 3 lots' designers at once; a quote sent from a lot's designer lands on that lot's list priced by the server; designing for a customer saves a quote; the demo runs without the server; Help is in every menu and at the top, a dealer's question reaches Barnwright and the answer comes back to them, and a problem on a screen or a designer reaches the site's own server at most 3 times a page. Pictures: test/out/dealer-center/.`);
