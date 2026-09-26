/* PROVE A NEW COMPANY CAN BE SET UP IN ONE COMMAND. check-all: browser

     node tools/check-starter.mjs

   Acts out what Alan (or a Claude session) does for a new customer, with a
   made-up company, "Pine Hollow Sheds":
   1. A price spreadsheet (test/out/starter-check/prices.csv) in the shapes a
      dealer really sends: a header row, a note, styles by code AND by name,
      "12 x 24", "$9,690", items, upgrades.
   2. ONE command -- tools/new-company.mjs with --from-csv -- writes
      companies/check-starter-tmp/company.json. It checks out, it sells
      exactly the three styles, every price is the spreadsheet's, nothing is
      left at the $1 placeholder, its colours, phone and websites are in.
      Asking again for the same id is refused; a company made WITHOUT a
      spreadsheet names every price still to do.
   3. tools/import-prices.mjs: --export writes the prices back out and
      reading them in again changes nothing; a changed price goes in (and
      the price-list number goes up); a bad row changes nothing and says
      which line.
   4. The designer (a real browser, port 8356) opens the new company with
      its name, badge, colours, its three styles and the spreadsheet's price.
   5. tools/list-companies.mjs shows it -- status, licence renewal, styles,
      where quotes go, its website -- and shows it SUSPENDED once it is.
   6. tools/build-headers.mjs would let only the company's website show it.
   Then the test companies are deleted (always, even when something fails).
   Picture: test/out/starter-check.png. */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { ROOT, loadCompany, readManufacturer } from "./lib/load.mjs";
import { readPriceRows, applyPrices, exportCsv } from "./import-prices.mjs";
import { placeholders } from "./new-company.mjs";
import { serveFolder } from "./lib/barnwright-page.mjs";

const require = createRequire(import.meta.url);
const ID = "check-starter-tmp", ID2 = "check-starter-tmp2";
const DIRS = [ID, ID2].map((i) => resolvePath(ROOT, "companies", i));
const WORK = resolvePath(ROOT, "test/out/starter-check");
const PORT = 8356, BASE = `http://127.0.0.1:${PORT}`;
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
const failures = [], shots = [];
function section(t) { console.log("\n" + t); }
function ok(what, cond, info) {
  if (cond) { passed++; console.log("  ok   " + what); }
  else { failures.push(what); console.log("  FAIL " + what + (info ? "\n       " + String(info).slice(0, 900) : "")); }
  return !!cond;
}
function run(tool, args) {
  const r = spawnSync(process.execPath, [resolvePath(ROOT, "tools", tool), ...args], { cwd: ROOT, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
function cleanUp() { for (const d of DIRS) if (existsSync(d)) rmSync(d, { recursive: true, force: true }); }

/* the spreadsheet a dealer sends */
const PRICES = {
  UT: { "8x12": 3450, "10x12": 4190, "10x16": 5150, "12x16": 6150, "12x20": 7250, "12x24": 8350 },
  LB: { "10x16": 5650, "10x20": 6850, "12x20": 8250, "12x24": 9550, "14x32": 14350 },
  G: { "12x20": 8150, "12x24": 9690, "14x28": 13950 },
};
const ITEMS = { w48: 155, w72: 305, w36: 130, d36in: 495, d36lite: 545, ru6: 620, ru8: 680, w23: 205, w33: 255, tr: 150, fake: 0, g1824: 205, bench: 20, shelf: 12, outlet: 75, gfci: 0, ilight: 100, light: 90, ppost: 0 };
const OPTIONS = { "ramps.r4": 250, "ramps.r6": 300, "elec.1": 700, "elec.2": 800, "misc.shutter": 75, "misc.lite": 40, "misc.ext": 95, "rates.jo12": 0.75, "rates.dbl": 2 };
function spreadsheet() {
  const L = ["style,size,price", "# Pine Hollow Sheds -- prices from the office, September"];
  for (const [z, p] of Object.entries(PRICES.UT)) L.push(`UT,${z},${p}`);
  for (const [z, p] of Object.entries(PRICES.LB)) L.push(`Lofted Barn,"${z.replace("x", " x ")}","$${p.toLocaleString("en-US")}"`);
  for (const [z, p] of Object.entries(PRICES.G)) L.push(`g,${z}',${p},a note nobody reads`);
  L.push("", "item,price");
  for (const [k, p] of Object.entries(ITEMS)) L.push(`${k},${p}`);
  L.push("option,price");
  for (const [k, p] of Object.entries(OPTIONS)) L.push(`${k},${p}`);
  return L.join("\r\n") + "\r\n";
}

const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
let server = null, browser = null;
try {
  cleanUp();
  mkdirSync(WORK, { recursive: true });
  const CSV = resolvePath(WORK, "prices.csv");
  writeFileSync(CSV, spreadsheet());
  const M = readManufacturer("standard");

  /* ------------------------------------------------------------------ 1-2 */
  section("1-2. One command: new-company.mjs with a price spreadsheet");
  const made = run("new-company.mjs", ["--id", ID, "--name", "Pine Hollow Sheds", "--phone", "(555) 010-0177", "--email", "sales@pinehollow.example",
    "--website", "https://pinehollow.example", "--styles", "UT,LB,G", "--from-csv", CSV, "--header", "#3B2F5A", "--accent", "#D08A2E",
    "--origins", "https://pinehollow.example,https://www.pinehollow.example", "--leads", "form", "--leads-url", "https://formspree.io/f/pinehollow", "--renews", "2027-01-15"]);
  ok("new-company.mjs finishes and says it wrote companies/check-starter-tmp/company.json", made.code === 0 && /Wrote companies\/check-starter-tmp\/company\.json for Pine Hollow Sheds/.test(made.out), made.out);
  ok("... and prints what is still to do, in plain words (the contact sheet to sign off)", /STILL TO DO/.test(made.out) && /setup\.html\?company=check-starter-tmp/.test(made.out), made.out);
  ok("... with NO price left at the $1 placeholder (the spreadsheet gave them all)", !/\$1 placeholder/.test(made.out), made.out);
  const r = loadCompany(ID);
  ok("the new file checks out exactly as the designer will check it", r.problems.length === 0, J(r.problems));
  const cat = r.catalogue || { P: {}, brand: {}, TYPES: {} };
  ok("it sells exactly the three styles asked for, in the usual order: UT, LB, G", J(Object.keys(cat.P)) === J(["UT", "LB", "G"]), J(Object.keys(cat.P)));
  ok("every building's price is the spreadsheet's, sizes in the spreadsheet's order (\"12 x 24\", \"$9,690\", 14x28' all read)",
    ["UT", "LB", "G"].every((k) => J(cat.P[k]) === J(PRICES[k])), J(cat.P));
  ok("every door, window and upgrade price is the spreadsheet's", Object.keys(ITEMS).every((k) => r.company.items[k] === ITEMS[k]) &&
    Object.keys(OPTIONS).every((k) => { const [g, id] = k.split("."); return r.company.options[g][id] === OPTIONS[k]; }), J({ items: r.company.items, options: r.company.options }));
  ok("nothing is left at the $1 placeholder", placeholders(r.company, M).length === 0, J(placeholders(r.company, M)));
  ok("its name, badge letters, phone, e-mail and colours are in", cat.brand.name === "Pine Hollow Sheds" && cat.brand.initials === "PHS" && cat.brand.phone === "(555) 010-0177" &&
    cat.brand.email === "sales@pinehollow.example" && r.company.brand.colors.header === "#3B2F5A" && r.company.brand.colors.accent === "#D08A2E", J(cat.brand));
  ok("quotes go to its form service; only its two websites may show it; the licence renews 2027-01-15",
    r.company.leads.mode === "form" && r.company.leads.url === "https://formspree.io/f/pinehollow" && J(cat.embed.origins) === J(["https://pinehollow.example", "https://www.pinehollow.example"]) && r.company.license.renews === "2027-01-15");
  ok("the style buttons are grouped (Utility & Storage / Barns / Garages) and a new visitor starts on a Lofted Barn it sells",
    J(r.company.categories.map((g) => g[1])) === J([["UT"], ["LB"], ["G"]]) && r.company.defaults.style === "LB" && Object.keys(PRICES.LB).indexOf(r.company.defaults.size) >= 0, J({ c: r.company.categories, d: r.company.defaults }));
  const again = run("new-company.mjs", ["--id", ID, "--name", "Pine Hollow Sheds", "--styles", "UT"]);
  ok("asking for the same id again is refused (nothing is overwritten without --force)", again.code === 1 && /already exists/.test(again.out), again.out);
  const bare = run("new-company.mjs", ["--id", ID2, "--name", "Bare Sheds", "--styles", "UT,DS"]);
  const r2 = existsSync(resolvePath(DIRS[1], "company.json")) ? loadCompany(ID2) : { problems: ["not written"], company: null };
  ok("without a spreadsheet the company still loads, every size at the $1 placeholder, and the list says so style by style",
    bare.code === 0 && r2.problems.length === 0 && /PRICES still at the \$1 placeholder/.test(bare.out) && /Utility Shed \(UT\): every size/.test(bare.out) && /Dormer Shed \(DS\): every size/.test(bare.out), bare.out);
  ok("... a Dormer Shed brings its dormer sizes, and the standard doors it needs, onto the list to price",
    !!r2.company && r2.company.options.dormers && Object.keys(r2.company.options.dormers).length >= 1 && /dormers\.6/.test(bare.out), bare.out);
  ok("... and no phone, no quote form and no website are named as still to do", /No phone number/.test(bare.out) && /Quote requests are switched OFF/.test(bare.out) && /embed\.origins is empty/.test(bare.out), bare.out);
  const badNew = run("new-company.mjs", ["--id", "Bad Id", "--name", "X", "--styles", "QQ"]);
  ok("a bad id and an unknown style are refused in plain words, and nothing is written", badNew.code === 1 && /is not allowed/.test(badNew.out) && /no style "QQ"/.test(badNew.out) && !existsSync(resolvePath(ROOT, "companies", "Bad Id")), badNew.out);

  /* ------------------------------------------------------------------ 3 */
  section("3. import-prices.mjs: out to a spreadsheet and back in");
  const exp = run("import-prices.mjs", ["companies/" + ID, "--export"]);
  const reparsed = readPriceRows(exp.out, M, r.company);
  const round = applyPrices(r.company, reparsed, M);
  ok("--export writes every price, and reading it straight back in changes nothing", exp.code === 0 && reparsed.problems.length === 0 && round.changes.length === 0 &&
    reparsed.rows === 14 + Object.keys(ITEMS).length + Object.keys(OPTIONS).length, J({ problems: reparsed.problems, changes: round.changes, rows: reparsed.rows }));
  ok("... with the style and item names beside the codes, for the dealer to read", /UT,8x12,3450,Utility Shed/.test(exp.out) && /w48,155,/.test(exp.out));
  const edited = resolvePath(WORK, "edited.csv");
  writeFileSync(edited, exp.out.replace("LB,10x20,6850", "LB,10x20,6990"));
  const imp = run("import-prices.mjs", ["companies/" + ID, edited]);
  const after = loadCompany(ID);
  ok("a changed price goes in, and the price-list number (cfg) goes up so old saved designs know", imp.code === 0 && after.catalogue && after.catalogue.P.LB["10x20"] === 6990 && after.company.cfg === 2 && /LB\)|Lofted Barn/.test(imp.out), imp.out);
  const badCsv = resolvePath(WORK, "bad.csv");
  writeFileSync(badCsv, "style,size,price\nUT,10x16,5150\nQuonset Hut,10x16,4000\nUT,10x20,lots\n");
  const before = readFileSync(resolvePath(DIRS[0], "company.json"), "utf8");
  const bad = run("import-prices.mjs", ["companies/" + ID, badCsv]);
  ok("a spreadsheet with a bad row changes NOTHING and names the lines (an unknown style, a price that is not a number)", bad.code === 1 && /line 3/.test(bad.out) && /Quonset Hut/.test(bad.out) && /line 4/.test(bad.out) &&
    readFileSync(resolvePath(DIRS[0], "company.json"), "utf8") === before, bad.out);

  /* ------------------------------------------------------------------ 4 */
  section("4. The designer opens the new company (a real browser)");
  server = await serveFolder(ROOT, PORT, "index.html");
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (rt) => rt.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (rt) => rt.fulfill({ status: 200, contentType: "text/css", body: "" }));
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { if (m.type() === "error") noise.push(m.text()); });
  page.on("pageerror", (e) => noise.push(String(e)));
  await page.goto(`${BASE}/?company=${ID}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 120000 }).catch(() => null);
  const seen = await page.evaluate(() => {
    const api = window.shedUI;
    if (!api) return { ready: false, boot: (document.getElementById("bootmsg") || {}).textContent || "" };
    const cs = getComputedStyle(document.documentElement);
    const cat = api.getCatalogue();
    return {
      ready: api.ready, name: document.getElementById("brand-name").textContent, badge: document.getElementById("brand-badge").textContent,
      header: cs.getPropertyValue("--navy-deep").trim().toLowerCase(), accent: cs.getPropertyValue("--red").trim().toLowerCase(),
      hdrBg: getComputedStyle(document.getElementById("hdr")).backgroundColor,
      styles: Object.keys(cat.P), cats: Array.from(document.querySelectorAll("#catsel option")).map((o) => o.textContent),
      type: api.getState().type, size: api.getState().size, plate: document.getElementById("plateprice").textContent,
      plateBrand: document.getElementById("plate-brand").textContent,
    };
  });
  const wantPrice = "$" + (after.catalogue ? after.catalogue.P.LB[r.company.defaults.size] : 0).toLocaleString("en-US") + ".00";
  ok("the designer starts with the company's name on the header and the plate, and its badge letters", seen.ready && seen.name === "Pine Hollow Sheds" && seen.badge === "PHS" && seen.plateBrand === "Pine Hollow Sheds", J(seen));
  ok("... in the company's colours (header #3b2f5a, accent #d08a2e)", seen.header === "#3b2f5a" && seen.accent === "#d08a2e" && seen.hdrBg === "rgb(59, 47, 90)", J(seen));
  ok("... offering its three styles in their three groups", J(seen.styles) === J(["UT", "LB", "G"]) && seen.cats.length === 3, J(seen));
  ok(`... on a ${r.company.defaults.size} Lofted Barn at the spreadsheet's price (${wantPrice}), with no errors`, seen.type === "LB" && seen.plate === wantPrice && noise.length === 0, J({ plate: seen.plate, noise }));
  await page.selectOption("#catsel", { index: 2 }).catch(() => null);
  await sleep(300);
  const garage = await page.evaluate(() => Array.from(document.querySelectorAll("#typechips .chip")).map((c) => c.textContent.replace(/\s+/g, " ").trim()));
  ok("the Garages group shows the Garage, from the spreadsheet's lowest garage price ($8,150)", garage.some((t) => /Garage/i.test(t) && /8,150/.test(t)), J(garage));
  await page.selectOption("#catsel", { index: 1 }).catch(() => null);
  await sleep(300);
  await page.screenshot({ path: resolvePath(ROOT, "test/out/starter-check.png") });
  shots.push("test/out/starter-check.png: the designer for the company made by one command (its name, badge and colours, its price)");
  await ctx.close();

  /* ------------------------------------------------------------------ 5 */
  section("5. list-companies.mjs shows it");
  const list = run("list-companies.mjs", []);
  const block = (list.out.split(/\n(?=\S)/).find((b) => b.startsWith(ID + "  --")) || "");
  ok("it is listed by id and name, its file loads, it is active", /check-starter-tmp {2}-- {2}Pine Hollow Sheds/.test(block) && /settings file: +loads/.test(block) && /status: +active/.test(block), list.out);
  ok("... with its licence renewal (2027-01-15) and how many days are left", /licence: +hosted, renews 2027-01-15 \(in \d+ days?/.test(block), block);
  ok("... its three styles with their sizes, where quotes go, and its websites", /styles \(3\): +UT Utility Shed \(6\), LB Lofted Barn \(5\), G Garage \(3\)/.test(block) && /a form service \(formspree\.io\)/.test(block) && /https:\/\/pinehollow\.example, https:\/\/www\.pinehollow\.example/.test(block), block);
  const file = JSON.parse(readFileSync(resolvePath(DIRS[0], "company.json"), "utf8"));
  file.status = "suspended";
  writeFileSync(resolvePath(DIRS[0], "company.json"), JSON.stringify(file, null, 2));
  const list2 = run("list-companies.mjs", ["--json"]);
  const row = (JSON.parse(list2.out || "[]").find((c) => c.id === ID)) || {};
  ok("once suspended, it is listed as suspended (and the designer then says it is not available -- tools/check-embed.mjs)", row.status === "suspended" && row.loads === true, J(row));

  /* ------------------------------------------------------------------ 6 */
  section("6. build-headers.mjs would let only its websites show it");
  const hdr = run("build-headers.mjs", ["--print"]);
  const m = new RegExp("/c/" + ID + "/\\*\\n  Content-Security-Policy: [^\\n]*frame-ancestors ([^\\n;]+)").exec(hdr.out);
  ok("its frame rule: this site, https://pinehollow.example and https://www.pinehollow.example, nobody else", !!m && m[1].trim() === "'self' https://pinehollow.example https://www.pinehollow.example", m ? m[1] : hdr.out.slice(0, 400));
} catch (e) {
  failures.push("the check itself crashed: " + (e && e.message));
  console.log("  FAIL the check itself crashed:\n       " + (e && e.stack || e));
} finally {
  if (browser) await browser.close();
  if (server) await server.stop();
  cleanUp();
}
ok("the test companies are deleted afterwards", DIRS.every((d) => !existsSync(d)));

console.log("");
if (shots.length) { console.log("Pictures:"); for (const s of shots) console.log("  " + s); }
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} checks failed:`);
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log(`\nPROVED: all ${passed} checks passed -- one command and a price spreadsheet make a working three-style company: it checks out, every price is the spreadsheet's, the designer shows it with its own name and colours, list-companies shows it, and nothing is left behind.`);
}
