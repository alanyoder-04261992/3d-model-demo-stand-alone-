/* check-all: browser
   PROVE, in the real Dealer Center and lot 3D designer (review 17 FREE),
   that what a customer sees, what is saved and what is printed agree when
   items marked "comes with the building" are charged (Alan, Oct 17 2026:
   "Yes, charge for them"). Each part fails on bf2be2c.

   FREE-2  A design link made before the owner changed a standard layout:
           the lot's 3D designer shows the price the server charges for
           what it sends, and that is the price the design was made at.
   FREE-4  The printed quote lists a charged window under "Added", never
           under "Comes with"; a kept door standing in for the one the size
           comes with is named plainly; the base line says what it covers.
   FREE-3  A quote saved before the rule (its extra windows were free),
           opened with "See it in 3D": its rows say "included", as its
           saved total does, never "+ $195".
   FREE-8  On a phone (390 wide), that saved quote's "Back to customer"
           button sits below "Original quote total", never over it.
   And (Alan, Oct 17 2026, "Yes, take its price off"): a standard window
   the customer took off comes off the saved price and is printed under
   "Taken off".

   Runs the local Dealer Center (tools/office-local.mjs) with its sample
   business on a free port, signed in as the sample owner. */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = resolve(ROOT, "test/out/included-saved-data"), OUT = resolve(ROOT, "test/out/included-saved");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");

/* a port nobody is using right now */
const PORT = await new Promise((done, fail) => { const s = createServer(); s.once("error", fail); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => done(port)); }); });
const BASE = `http://127.0.0.1:${PORT}`;
rmSync(DATA, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let log = "", browser, page, passed = 0;
const failed = [];
server.stdout.on("data", (d) => { log += d; }); server.stderr.on("data", (d) => { log += d; });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
/* every check runs, so a failure says each thing that is wrong */
const ok = (name, value, detail = "") => { if (value) { passed++; console.log("  ok " + name); } else { failed.push(name); console.log("  FAIL " + name + (detail ? " -- " + detail : "")); } };
const errors = [];
async function api(path, body, method = "GET") {
  return page.evaluate(async ({ path, body, method }) => {
    const response = await fetch("/api/office/" + path, { method, headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
  }, { path, body, method });
}
async function openDealer(hash) {
  await page.goto(BASE + "/dealer" + hash, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#main");
  await page.waitForFunction(() => !document.querySelector("#main .loading"));
}
async function openDesigner(url) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.shedUI?.ready, null, { timeout: 90000 });
}
/* a design made in the lot's own designer, in the page */
async function designed(steps) {
  return page.evaluate(async (steps) => {
    const { loadLot } = await import("/ui/load.js"), D = await import("/model/design.js"), S = await import("/ui/state.js");
    const { catalogue: cat } = await loadLot("riverside");
    const s = D.defaults(cat);
    for (const [what, arg] of steps) {
      if (what === "type") S.chooseType(s, arg, cat);
      if (what === "size") S.chooseSize(s, arg, cat);
      if (what === "removeWindow") { const w = s.items.find((i) => i.inc && cat.CAT[i.cat].k === "win"); S.removeItem(s, w.id); }
      if (what === "moveDoor") { const d = s.items.find((i) => i.inc && cat.CAT[i.cat].k === "door"); S.moveItem(s, d.id, { pos: d.pos + 0.25 }, cat); }
    }
    return { design: D.fromState(s, cat), names: { w23: cat.CAT.w23?.n, w72: cat.CAT.w72?.n, w48: cat.CAT.w48?.n }, cfg: cat.cfg, price: (await import("/model/pricing.js")).priceParts(s, cat).total };
  }, steps);
}
/* the stored customer, edited the way a quote saved before Oct 17 2026 looks */
function editStored(customerId, change) {
  const name = encodeURIComponent(`customers/${customerId}`) + ".json";
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name === name) files.push(p); } };
  walk(DATA);
  if (files.length !== 1) throw new Error(`Found ${files.length} stored records for the customer`);
  const record = JSON.parse(readFileSync(files[0], "utf8"));
  change(record.data);
  writeFileSync(files[0], JSON.stringify(record));
}

try {
  for (let i = 0; i < 240 && !log.includes("is running"); i++) await pause(250);
  if (!log.includes("is running")) throw new Error("Local server did not start: " + log);
  browser = await chromium.launch({ ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent("chris@samplebarns.example"), url: BASE }]);
  page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on("pageerror", (error) => errors.push(error.message));
  await openDealer("");

  const made = await api("customers", { lot: "riverside", name: "Included Items", phone: "941-555-0177", requestKey: "included-saved-fixture" }, "POST");
  ok("a customer is made at Riverside", made.status === 201, JSON.stringify(made.data.error || ""));
  const id = made.data.customer.id;

  /* ---- FREE-4: the printed quote ---- */
  const cabin = await designed([["type", "C"], ["size", "12x32"], ["moveDoor"], ["size", "8x12"]]);
  const cabinQ = await api(`customers/${id}/quotes`, { design: cabin.design }, "POST");
  ok(`a Cabin made 12x32, a door moved, then 8x12 is saved at the designer's ${cabin.price}`, cabinQ.status === 201 && cabinQ.data.quote.total === cabin.price, JSON.stringify(cabinQ.data.quote?.total ?? cabinQ.data.error));
  await openDealer(`#/customers/${id}/quotes/${cabinQ.data.quote.id}`);
  await page.locator(".sheet .sheet-item-cols").waitFor();
  const lists = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".sheet .sheet-items")].map((b) => [b.querySelector("h4").textContent, [...b.querySelectorAll("li")].map((li) => li.textContent)])));
  const winName = cabin.names.w23;
  ok(`the printed quote lists 1 ${winName} under "Comes with" and the 2 charged ones under "Added"`,
    (lists["Comes with"] || []).includes(winName) && (lists["Added"] || []).includes(`${winName} × 2`), JSON.stringify(lists));
  const baseLine = await page.locator(".sheet-price tbody tr").first().innerText();
  ok(`the base line says what it covers: "${baseLine.replace(/\s+/g, " ").trim()}"`, /base price, with the doors and windows this size comes with/.test(baseLine), baseLine);
  await page.screenshot({ path: `${OUT}/quote-sheet-cabin.png`, fullPage: true });

  const cottage = await designed([["type", "CS"], ["size", "10x16"], ["moveDoor"], ["size", "10x12"]]);
  const cotQ = await api(`customers/${id}/quotes`, { design: cottage.design }, "POST");
  ok(`a Cottage made 10x16, a door moved, then 10x12 is saved at the designer's ${cottage.price}`, cotQ.status === 201 && cotQ.data.quote.total === cottage.price);
  await openDealer(`#/customers/${id}/quotes/${cotQ.data.quote.id}`);
  await page.locator(".sheet .sheet-item-cols").waitFor();
  const plainly = `${cottage.names.w72}, in place of the ${cottage.names.w48}`;
  const cotSheet = await page.locator(".sheet").innerText();
  const cotComes = await page.evaluate(() => [...document.querySelectorAll(".sheet .sheet-items")].find((b) => b.querySelector("h4").textContent === "Comes with")?.innerText || "");
  ok(`the kept double doors are named plainly in "Comes with" and on the price line: "${plainly}"`, cotComes.includes(plainly) && cotSheet.split(plainly).length >= 3, cotComes);

  /* a standard window taken off (Alan, Oct 17 2026: "Yes, take its price off") */
  const fewer = await designed([["type", "C"], ["size", "10x16"], ["removeWindow"]]);
  const fewerQ = await api(`customers/${id}/quotes`, { design: fewer.design }, "POST");
  ok(`a Cabin 10x16 with a standard window taken off is saved at the designer's ${fewer.price}, the window's price less`, fewerQ.status === 201 && fewerQ.data.quote.total === fewer.price && fewerQ.data.quote.total === fewerQ.data.quote.price.base - (fewerQ.data.quote.price.lines.find((l) => l[2] === "removed.w23") ? -fewerQ.data.quote.price.lines.find((l) => l[2] === "removed.w23")[1] : NaN));
  await openDealer(`#/customers/${id}/quotes/${fewerQ.data.quote.id}`);
  await page.locator(".sheet .sheet-item-cols").waitFor();
  const offLists = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".sheet .sheet-items")].map((b) => [b.querySelector("h4").textContent, [...b.querySelectorAll("li")].map((li) => li.textContent)])));
  const offSheet = await page.locator(".sheet-price").innerText();
  ok(`the printed quote lists the window under "Taken off" and its price comes off ("${winName}, taken off")`, (offLists["Taken off"] || []).includes(winName) && offSheet.includes(`${winName}, taken off`) && offSheet.includes("-$195"), JSON.stringify(offLists));

  /* ---- FREE-3 and FREE-8: a quote saved before the rule ---- */
  const forged = structuredClone(cabin.design);
  for (const it of forged.items) if (!it.pk && it.cat === "w23") it.inc = true;
  const oldQ = await api(`customers/${id}/quotes`, { design: cabin.design }, "POST");
  const base8 = cabinQ.data.quote.price.base;
  editStored(id, (c) => {
    const q = c.quotes.find((x) => x.id === oldQ.data.quote.id);
    q.design = forged; q.price = { base: base8, lines: [], total: base8 }; q.total = base8;
  });
  const opened = new URL(`/d/riverside/?saved-quote=${id}/${oldQ.data.quote.id}&view=1`, BASE);
  await openDesigner(opened.href);
  const rows = await page.evaluate(() => ({
    total: window.shedUI.price().total, plate: document.getElementById("plateprice").textContent,
    wins: [...document.querySelectorAll("#itemlist button")].filter((b) => /Window/.test(b.textContent)).map((b) => b.querySelector(".pr")?.textContent || ""),
    note: document.getElementById("platenote")?.hidden === false,
  }));
  ok(`the saved quote opens at its saved total ${base8}`, rows.total === base8, JSON.stringify(rows));
  ok(`... and its ${rows.wins.length} window rows each say "included", never a charge`, rows.wins.length === 3 && rows.wins.every((t) => t === "included") && !rows.note, JSON.stringify(rows.wins));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const boxes = await page.evaluate(() => {
    const card = document.querySelector(".vcard.shview"), tot = card?.querySelector(".sumline.tot"), back = [...(card?.querySelectorAll("a.bigbtn") || [])].find((a) => /Back to customer/.test(a.textContent));
    const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
    return tot && back ? { tot: r(tot), back: r(back), sideways: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth } : null;
  });
  ok("on a phone, \"Back to customer\" sits below \"Original quote total\", not over it", boxes && boxes.back.top >= boxes.tot.bottom - 0.5 && boxes.sideways <= 0, JSON.stringify(boxes));
  if (boxes) await page.locator(".vcard.shview").screenshot({ path: `${OUT}/saved-quote-card-390.png` });
  await page.setViewportSize({ width: 1280, height: 850 });

  /* ---- FREE-2: a design link made before the owner changed a layout ---- */
  await openDealer("");
  const barn = await designed([["type", "LB"], ["size", "10x20"]]);
  const list = (await api("price-list")).data;
  list.settings.offer.LB = { ...(list.settings.offer.LB || {}), layout: [{ cat: "w48", wall: "B", at: "center" }] };
  const saved = await api("price-list", { settings: list.settings, version: list.version }, "PUT");
  const now = (await api("price-list")).data;
  ok("the owner saves a new standard layout for the Lofted Barn (a new price list version)", saved.status === 200 && now.settings.cfg > barn.cfg, JSON.stringify(saved.data.error || ""));
  const { encodeSync } = await import("../model/design.js");
  await openDesigner(`${BASE}/d/riverside/#d=${encodeSync(barn.design)}`);
  await page.waitForTimeout(500);
  const shown = await page.evaluate(() => ({ total: window.shedUI.price().total, plate: document.getElementById("plateprice").textContent, design: window.shedUI.getDesign({ priced: true, at: "2026-10-17" }), note: document.getElementById("platenote")?.hidden === false }));
  const sent = await page.evaluate(async (design) => {
    const r = await fetch("/api/lots/riverside/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ design, contact: { name: "Older link", phone: "941-555-0166", zip: "34950" }, idempotencyKey: "included-saved-older-link-0001" }) });
    return { status: r.status, data: await r.json() };
  }, shown.design);
  ok(`the older Lofted Barn link shows ${shown.total}, the total the server charges for what the page sends (${sent.data.total})`, sent.status === 201 && sent.data.total === shown.total, JSON.stringify(sent.data.error || ""));
  ok(`... which is the price it was made at (${barn.price}), with no line about charges`, shown.total === barn.price && !shown.note);
  await page.screenshot({ path: `${OUT}/older-link.png` });

  ok("no uncaught browser errors", errors.length === 0, errors.join(" | "));
  if (failed.length) { console.log(`FAIL: ${failed.length} of ${failed.length + passed} checks failed.`); process.exitCode = 1; }
  else console.log(`PROVED (${passed} checks): an older design link shows the price the server charges (the price it was made at); a printed quote lists charged windows as added and names a kept door plainly; a quote saved before the rule shows its windows as included, as its saved total does; and on a phone its "Back to customer" button sits clear of the total.`);
} catch (e) {
  console.log("FAIL: " + (e && e.stack || e));
  process.exitCode = 1;
} finally { if (browser) await browser.close(); server.kill("SIGTERM"); }
