/* CHECK: "HOW IT'S BUILT" IN THE DEALER CENTER, IN A REAL BROWSER.
   Run: node tools/check-how-its-built.mjs [--keep]
   check-all: browser
   Port: 8392 (HOW_ITS_BUILT_PORT=<port> to use another).

   WHY. Alan (Oct 2026, "lets all 5"): each business types how its own
   buildings are built -- a roof pitch like 5/12, a wall height like 7 ft
   9 1/2 in -- gets a plain error next to the box on a typo, sees every
   change in History, and an automatic every-size check replaces checking
   by eye. This drives the screens the owner uses for it
   (ui/office/views/price-list/built.js) on the local Dealer Center
   (tools/office-local.mjs, sample data in test/out/how-its-built-data).

   It proves:
     1. the owner sees "How it's built" in a style's editor and the
        business-wide card, at 1280 and 390 wide, with no sideways scrolling
        and every box, chip and button at least 44 px tall;
     2. typing "5\12" as the Utility Shed's roof pitch says "Roof pitch:
        write it like 5/12." under the box and puts a red count on the
        Buildings tab; a porch depth of "72" asks "Did you mean 72 in
        (6 ft)?"; clearing the box takes the problem away;
     3. "Check every size" with a 5 ft Utility Shed wall shows the door that
        does not fit, in words; saving it is refused by the server with the
        same words;
     4. a 7 ft Lofted Barn wall saves, the "Saved" box says what changed
        ("Lofted Barn wall height: 6 ft 7 1/2 in → 7 ft"), that every size
        was drawn and fits, and links to a lot's 3D designer; History says
        it too;
     4b. closed to customers (as before it opens), that link is the lot's
        preview, as the banner's is, and shows the design, never the
        closed page;
     5. when the price list opens, a style whose own numbers no longer fit
        (the standard changed under them) shows a yellow note with the words;
     6. a manager sees the numbers read only, never a box, with the barn
        height and the eave at every width sold; typing one barn width
        keeps the other widths' numbers (the empty boxes say them, and they
        are drawn); the empty eave box says "1 3/4 to 2 1/8 in";
     7. the "try it" demo (/dealer?demo) shows the same screens and saves a
        wall height with its in-page copy of the server.
   Pictures: test/out/how-its-built/. --keep leaves the server running. */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEEP = process.argv.includes("--keep");
const PORT = Number(process.env.HOW_ITS_BUILT_PORT || 8392);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = "test/out/how-its-built-data";
const OUT = resolve(ROOT, "test/out/how-its-built");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");

const OWNER = "chris@samplebarns.example", MANAGER = "sarah@samplebarns.example";

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("    ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("    FAIL " + name + (extra ? " -- " + extra : "")); }
}
const section = (t) => console.log("\n  " + t);

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

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function pageFor(email, { width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 4\d\d/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push("page error: " + e.message));
  return page;
}
async function openPriceList(page, base = `${BASE}/dealer`) {
  await page.goto(`${base}#/price-list`, { waitUntil: "load" });
  await page.waitForSelector(".pl-body .pl-tab", { timeout: 30000 });
  await page.waitForTimeout(300);
}
async function openStyle(page, key) {
  const sel = `.pl-style[data-style="${key}"]`;
  if (!(await page.$(`${sel}.open`))) await page.click(`${sel} .pl-style-open`);
  await page.waitForSelector(`[data-built="${key}"]`, { timeout: 10000 });
}
async function typeIn(page, field, text) {
  const box = page.locator(`[data-field="${field}"]`);
  await box.fill(text);
  await box.dispatchEvent("change");
  await page.waitForTimeout(150);
}
const msgText = (page, where) => page.$eval(`[data-msgs="${where}"]`, (el) => el.textContent).catch(() => "");
async function sideways(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}
/* every box, chip and button the screens add, at least 44 px tall */
async function smallTaps(page, scope) {
  return page.$$eval(`${scope} input, ${scope} button, ${scope} summary`, (els) => els.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.height < 43.5;
  }).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute("data-field") || "").trim().slice(0, 30)}" ${Math.round(e.getBoundingClientRect().height)} px`));
}
function storedPriceList() {
  const file = resolve(ROOT, DATA, encodeURIComponent("price-list") + ".json");
  return { file, raw: JSON.parse(readFileSync(file, "utf8")) };
}

try {
  /* ---- 1 ----------------------------------------------------------------- */
  section("1. The owner's screens, on a computer and a phone");
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const page = await pageFor(OWNER, { width, height });
    await openPriceList(page);
    await openStyle(page, "LB");
    const fields = await page.$$eval('[data-built="LB"] .pl-built-field', (els) => els.map((e) => e.querySelector("label, .pl-label")?.textContent));
    ok(`${width} wide: the Lofted Barn has How it's built with its numbers (${fields.join(", ")})`,
      ["Barn roof height", "Eave overhang", "Gable-end overhang", "Wall height", "Wooden shop door height"].every((f) => fields.includes(f)) && !fields.includes("Roof pitch"));
    const wall = await page.getAttribute('[data-field="built:LB:wallHeight"]', "placeholder");
    const from = await page.$eval('[data-built="LB"] [data-field="built:LB:wallHeight"] ~ .hint .pl-built-from', (el) => el.textContent).catch(() => "");
    ok(`${width} wide: an empty box shows the number it builds with ("${wall}") and where it comes from ("${from}")`, wall === "6 ft 7 1/2 in" && from === "Standard: 6 ft 7 1/2 in", `${wall} | ${from}`);
    ok(`${width} wide: the business-wide card "How your buildings are built" is there`, !!(await page.$(".pl-built-card")) && /Reaches the/.test(await page.textContent(".pl-built-card")));
    /* "standard" is not one number: the card says what each style is built
       with now (review W4) */
    const card = await page.textContent(".pl-built-card");
    /* five gable styles have the shop's 5/12 since Oct 11 2026 (the Garage,
       Dog Kennel and Garden Utility too); the Dormer Shed keeps its own */
    ok(`${width} wide: ... and what each style is built with now ("Built now: 5/12 on the Utility Shed, Side Utility and 3 more; about 6 1/2/12 on the ...")`, /Built now: 5\/12 on the Utility Shed, Side Utility and 3 more; about 6 1\/2\/12 on the /.test(card), card.slice(card.indexOf("Built now"), card.indexOf("Built now") + 300));
    ok(`${width} wide: no sideways scrolling`, (await sideways(page)) <= 0, String(await sideways(page)));
    const small = [...await smallTaps(page, '[data-built="LB"]'), ...await smallTaps(page, ".pl-built-card")];
    ok(`${width} wide: every box, chip and button is at least 44 px tall`, small.length === 0, small.slice(0, 5).join("; "));
    await page.locator('[data-built="LB"]').screenshot({ path: `${OUT}/style-${width}.png` });
    await page.locator(".pl-built-card").screenshot({ path: `${OUT}/business-${width}.png` });
    ok(`${width} wide: no errors`, page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
    await page.context().close();
  }

  /* ---- 2 ----------------------------------------------------------------- */
  section("2. A typo is said next to the box, as it is typed");
  const page = await pageFor(OWNER);
  await openPriceList(page);
  await openStyle(page, "UT");
  await typeIn(page, "built:UT:roofPitch", "5\\12");
  let said = await msgText(page, "built:UT:roofPitch");
  ok(`"5\\12" says "${said}" under the box`, said === "Roof pitch: write it like 5/12.", said);
  const flag = await page.$eval('.tab[data-key="buildings"] .pl-tab-flag', (el) => el.textContent).catch(() => "");
  ok(`... and the Buildings tab has a red count (${flag})`, flag === "1", flag);
  ok("... and the bar at the bottom says there is 1 thing to fix", /1 thing to fix/.test(await page.textContent(".pl-bar")));
  await page.screenshot({ path: `${OUT}/typo-1280.png` });
  await typeIn(page, "built:UT:roofPitch", "5/12");
  said = await msgText(page, "built:UT:roofPitch");
  ok("typing 5/12 takes the problem away", said === "" && !(await page.$('.tab[data-key="buildings"] .pl-tab-flag')), said);
  await typeIn(page, "built:UT:roofPitch", "");
  await openStyle(page, "C");
  await typeIn(page, "built:C:porchDepth", "72");
  said = await msgText(page, "built:C:porchDepth");
  ok(`a porch depth of "72" asks about inches ("${said}")`, /Porch depth 72 ft is deeper than 8 ft\. Did you mean 72 in \(6 ft\)\?/.test(said), said);
  await typeIn(page, "built:C:porchDepth", "");
  ok("... and an empty box is the standard again", (await msgText(page, "built:C:porchDepth")) === "" && !(await page.isVisible(".pl-bar")), await page.textContent(".pl-bar"));

  /* ---- 3 ----------------------------------------------------------------- */
  section("3. Check every size, and the server's check on save");
  /* a style with no numbers of its own: what the standard building has too
     is listed, never "not yours to fix" (review W10) */
  await openStyle(page, "SLB");
  await page.click('[data-built="SLB"] .pl-built-check button');
  await page.waitForSelector('[data-built="SLB"] .pl-built-box', { timeout: 30000 });
  const slbSaid = await page.textContent('[data-built="SLB"] .pl-built-result');
  ok("Check every size on the Side Lofted Barn says everything fits and lists what the standard building has too",
    /Everything fits: 9 buildings drawn\./.test(slbSaid) && /Already so in the standard building:/.test(slbSaid) && /Side Lofted Barn 8×12: the 72″ Wooden Double Doors and the 2×3 Window on the right side overlap by 2 3\/8 in\./.test(slbSaid) && !/not yours to fix/.test(slbSaid), slbSaid.slice(0, 300));
  /* the 8x12 and 10x12 Side Utility come with the 48 in Wooden Door (Alan,
     Oct 11 2026: "replace 6 foot to 4 foot"): no window runs into it */
  await openStyle(page, "SU");
  await page.click('[data-built="SU"] .pl-built-check button');
  await page.waitForSelector('[data-built="SU"] .pl-built-box', { timeout: 30000 });
  const suSaid = await page.textContent('[data-built="SU"] .pl-built-result');
  ok("Check every size on the Side Utility says everything fits, and no door and window overlap (the 8×12 and 10×12 have the 48″ Wooden Door)",
    /Everything fits: 11 buildings drawn\./.test(suSaid) && !/overlap/.test(suSaid) && !/not yours to fix/.test(suSaid), suSaid.slice(0, 300));
  await typeIn(page, "built:UT:wallHeight", "60");
  ok("a bare 60 in the wall height box reads as inches: 5 ft", (await page.inputValue('[data-field="built:UT:wallHeight"]')) === "5 ft");
  await page.click('[data-built="UT"] .pl-built-check button');
  await page.waitForSelector('[data-built="UT"] .pl-built-box', { timeout: 30000 });
  const checked = await page.textContent('[data-built="UT"] .pl-built-result');
  ok("Check every size says the door does not fit, in words", /Change these numbers before you save/.test(checked) && /72″ Wooden Double Doors on the front should be 76 1\/2 in tall, but the wall leaves room for 55 5\/8 in/.test(checked), checked.slice(0, 300));
  ok("... and not the gable window the standard Utility Shed has the same trouble with", !/Gable Window/.test(checked));
  await page.locator('[data-built="UT"]').screenshot({ path: `${OUT}/check-every-size-1280.png` });
  await typeIn(page, "built:UT:wallHeight", "61");
  ok("a new number clears the old answer of Check every size", (await page.$$('[data-built="UT"] .pl-built-result > *')).length === 0);
  await typeIn(page, "built:UT:wallHeight", "60");
  await page.click(".pl-bar .btn-accent");
  await page.waitForSelector("dialog.dialog", { timeout: 30000 });
  const refused = await page.textContent("dialog.dialog");
  ok("Save is refused by the server with the same words", /The price list wasn't saved/.test(refused) && /should be 76 1\/2 in tall, but the wall leaves room for 55 5\/8 in/.test(refused), refused.slice(0, 300));
  await page.screenshot({ path: `${OUT}/save-refused-1280.png` });
  await page.click("dialog.dialog .btn-primary");
  await typeIn(page, "built:UT:wallHeight", "");

  /* ---- 4 ----------------------------------------------------------------- */
  section("4. A 7 ft Lofted Barn wall saves, says so, and shows in History");
  await openStyle(page, "LB");
  await typeIn(page, "built:LB:wallHeight", "7 ft");
  await page.click(".pl-bar .btn-accent");
  await page.waitForSelector(".pl-saved", { timeout: 30000 });
  const saved = await page.textContent(".pl-saved");
  ok("the Saved box says \"Lofted Barn wall height: 6 ft 7 1/2 in → 7 ft\"", saved.includes("Lofted Barn wall height: 6 ft 7 1/2 in → 7 ft"), saved.slice(0, 300));
  ok("... that every size was drawn and fits", /Every size of the Lofted Barn was drawn with your numbers and fits\./.test(saved), saved.slice(0, 300));
  const link = await page.getAttribute(".pl-saved a.btn", "href").catch(() => null);
  ok(`... with a link to see it in a lot's 3D designer (${link ? link.slice(0, 40) + "…" : "none"})`, !!link && /^\/d\/[a-z0-9-]+\/#d=/.test(link) && /See the Lofted Barn in the 3D designer/.test(saved), link);
  await page.screenshot({ path: `${OUT}/saved-1280.png` });
  const history = await page.evaluate(async () => (await (await fetch("/api/office/price-list/history", { credentials: "same-origin" })).json()).entries[0].changes);
  ok("History has the line", history.includes("Lofted Barn wall height: 6 ft 7 1/2 in → 7 ft"), JSON.stringify(history));

  /* an option like a steep roof: "Roof pitch at least" on the Options tab */
  await page.click('.tab[data-key="options"]');
  await page.waitForSelector(".pl-extras", { timeout: 10000 });
  await page.click('.pl-extras .pl-card-head button');
  const n = (await page.$$(".pl-extras .pl-extra")).length - 1;
  await typeIn(page, `extra:${n}:name`, "Steep roof");
  await page.fill(`[data-field="extra:${n}:price"]`, "350");
  /* the roof pitch and "Offered on" are folded away: an option like a ridge
     vent stays short (review W15) */
  const shortRow = await page.$eval(`.pl-extras .pl-extra:nth-child(${n + 1})`, (el) => Math.round(el.getBoundingClientRect().height)).catch(() => -1);
  ok(`a new option shows only its name and price, the rest folded away (${shortRow} px tall)`, shortRow > 0 && shortRow < 260 && !(await page.isVisible(`[data-field="extra:${n}:roofPitch"]`)), String(shortRow));
  await page.click(`[data-extra-more="${n}"] > summary`);
  await typeIn(page, `extra:${n}:roofPitch`, "15/12");
  said = await msgText(page, `extra:${n}`);
  ok(`an option's roof pitch past the limit says so ("${said}")`, /Roof pitch 15\/12 is steeper than 12\/12/.test(said)
    && (await page.$eval('.tab[data-key="options"] .pl-tab-flag', (el) => el.textContent).catch(() => "")) === "1", said);
  await typeIn(page, `extra:${n}:roofPitch`, "7/12");
  /* offered on every building: said under it where it changes nothing
     (review W2) */
  const miss = await page.$eval(`[data-extra-warn="${n}"]`, (el) => (el.hidden ? "" : el.textContent)).catch(() => "");
  ok(`... and where a 7/12 roof changes nothing it says so ("${miss.slice(0, 120)}...")`, /^Steep roof does not change the /.test(miss) && /Lofted Barn \(it has a barn roof\)/.test(miss) && /Backyard Utility \(its lean-to roof can be 6\/12 at most\)/.test(miss) && /A customer would pay for nothing there\.$/.test(miss), miss);
  await page.click(`[data-field="extra:${n}:style:UT"]`);
  await page.click(`[data-field="extra:${n}:style:SU"]`);
  const missAfter = await page.$eval(`[data-extra-warn="${n}"]`, (el) => (el.hidden ? "" : el.textContent)).catch(() => "");
  ok("... and on the Utility Shed and Side Utility only, nothing is said", missAfter === "", missAfter);
  await page.click(".pl-bar .btn-accent");
  await page.waitForSelector(".pl-saved", { timeout: 30000 });
  const xsaved = await page.textContent(".pl-saved");
  ok("an option \"Steep roof\" at 7/12 saves, says \"Steep roof: roof pitch at least 7/12\" and was drawn on the styles it reaches",
    xsaved.includes("Steep roof: roof pitch at least 7/12") && /Every size of the Utility Shed and Side Utility was drawn with your numbers and fits\./.test(xsaved), xsaved.slice(0, 400));
  await page.locator(".pl-extras .pl-extra").last().screenshot({ path: `${OUT}/option-roof-pitch-1280.png` });
  ok("no errors on the owner's screens", page.errors.length === 0, page.errors.slice(0, 3).join(" | "));
  await page.context().close();

  /* ---- 4b ---------------------------------------------------------------- */
  section("4b. Closed to customers: the Saved box's link is the preview, which shows the design");
  {
    const p = await pageFor(OWNER);
    await openPriceList(p);
    /* the owner closes the 3D designer to customers (as before it opens) */
    const putList = (status, utBuilt) => p.evaluate(async ([status, utBuilt]) => {
      const cur = await (await fetch("/api/office/price-list", { credentials: "same-origin" })).json();
      const s = cur.settings;
      s.status = status;
      if (utBuilt) s.offer.UT.built = utBuilt; else delete s.offer.UT.built;
      const r = await fetch("/api/office/price-list", { method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: s, version: cur.version }) });
      return r.status;
    }, [status, utBuilt]);
    const closed = await putList("suspended", null);
    await p.reload({ waitUntil: "load" });
    await p.waitForSelector(".pl-body .pl-tab", { timeout: 30000 });
    await openStyle(p, "UT");
    await typeIn(p, "built:UT:wallHeight", "8 ft");
    await p.click(".pl-bar .btn-accent");
    await p.waitForSelector(".pl-saved a.btn", { timeout: 30000 }).catch(() => {});
    const href = await p.getAttribute(".pl-saved a.btn", "href").catch(() => null);
    const bannerHref = await p.getAttribute(".banner a:has-text('Look at the preview')", "href").catch(() => null);
    ok(`closed to customers, "See the Utility Shed in the 3D designer" opens the preview as the banner does (${String(href).slice(0, 44)}…; old code: /d/<lot>/#d=, the closed page)`,
      closed === 200 && !!href && !!bannerHref && /\?preview=1$/.test(bannerHref) && href.startsWith(bannerHref + "#d=") && /See the Utility Shed in the 3D designer/.test(await p.textContent(".pl-saved")), `${href} | ${bannerHref}`);
    if (href) {
      const d = await p.context().newPage();
      await d.goto(BASE + href, { waitUntil: "load" });
      await d.waitForFunction(() => /Preview\.|isn't open right now/.test(document.body.textContent), null, { timeout: 30000 }).catch(() => {});
      const shows = (await d.textContent("body")).replace(/\s+/g, " ");
      ok("... which shows the design with the Preview words, never the closed page", /Preview\. Your customers can't see this until you open it in Settings\./.test(shows) && !/isn't open right now/.test(shows), shows.slice(0, 200));
      await d.close();
    }
    ok("(open to customers again, the Utility Shed's wall back to the standard, for the rest of this check)", (await putList("active", null)) === 200);
    ok("no errors", p.errors.length === 0, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  }

  /* ---- 5 ----------------------------------------------------------------- */
  section("5. When the price list opens: a quiet check of the styles with numbers of their own");
  {
    /* the standard changed under a saved number: put a 5 ft Utility Shed
       wall straight into the stored price list, as if it had been saved
       before the change */
    const { file, raw } = storedPriceList();
    raw.data.settings.offer.UT.built = { wallHeight: 60 };
    raw.data.version += 1;
    writeFileSync(file, JSON.stringify(raw));
    const p = await pageFor(OWNER, { width: 390, height: 844 });
    await openPriceList(p);
    await p.waitForSelector("[data-built-notes] .pl-built-box", { timeout: 30000 });
    const note = await p.textContent("[data-built-notes]");
    ok("a yellow note says the Utility Shed's own wall no longer fits, in words", /Since the last update, your own building numbers do not fit everywhere/.test(note) && /should be 76 1\/2 in tall/.test(note), note.slice(0, 300));
    ok("... with no sideways scrolling on a phone", (await sideways(p)) <= 0);
    await p.locator("[data-built-notes]").screenshot({ path: `${OUT}/since-last-update-390.png` });
    ok("no errors", p.errors.length === 0, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
    delete raw.data.settings.offer.UT.built;
    raw.data.version += 1;
    writeFileSync(file, JSON.stringify(raw));
  }

  /* ---- 6 ----------------------------------------------------------------- */
  section("6. A manager sees the numbers, read only");
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    const p = await pageFor(MANAGER, { width, height });
    await openPriceList(p);
    ok(`${width} wide: no How it's built boxes for a manager`, (await p.$$(".pl-built-input, .pl-built-card")).length === 0);
    const lb = p.locator(".pl-sheet-card", { hasText: "Lofted Barn" }).first();
    await lb.locator(".pl-built-ro summary").click();
    const lines = await lb.locator(".pl-built-ro").textContent();
    ok(`${width} wide: the Lofted Barn's numbers show, with its own 7 ft wall`, /Wall height\s*7 ft/.test(lines) && /Barn roof height, 10 ft wide\s*4 ft(?!\s*\d)/.test(lines), lines.slice(0, 200));
    /* every width sold, the 14 ft one too (review W6) */
    ok(`${width} wide: ... and the barn height at 14 ft wide, which it is sold in (6 ft 3 1/8 in)`, /Barn roof height, 14 ft wide\s*6 ft 3 1\/8 in/.test(lines), lines.slice(0, 400));
    /* the eave as drawn at each width: the lower slope changes with the
       barn roof height (round 2 review) */
    ok(`${width} wide: ... and the eave at each width (1 3/4 in at 8 ft wide, 1 15/16 in at 10 ft, 2 1/8 in at 12 ft)`, /Eave overhang, 8 ft wide\s*1 3\/4 in/.test(lines) && /Eave overhang, 10 ft wide\s*1 15\/16 in/.test(lines) && /Eave overhang, 12 ft wide\s*2 1\/8 in/.test(lines), lines.slice(0, 600));
    ok(`${width} wide: no sideways scrolling`, (await sideways(p)) <= 0);
    const small = await smallTaps(p, ".pl-built-ro");
    ok(`${width} wide: the "How it's built" line is at least 44 px tall`, small.length === 0, small.join("; "));
    await lb.screenshot({ path: `${OUT}/manager-${width}.png` });
    ok(`${width} wide: no errors`, p.errors.length === 0, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  }

  /* ---- 6b ---------------------------------------------------------------- */
  section("6b. One barn width typed: the other widths keep their numbers");
  {
    /* review W1: a height typed for 10 ft wide keeps the shop's 8 and 12 ft
       heights; the empty boxes say what they build with, and they do */
    const p = await pageFor(OWNER);
    await openPriceList(p);
    await openStyle(p, "LB");
    const ph = async (w) => p.getAttribute(`[data-field="built:LB:barnPeak${w === 8 ? "" : ":" + w}"]`, "placeholder");
    ok(`the empty barn boxes say what each width is built at (${[await ph(8), await ph(10), await ph(12), await ph(14)].join(", ")})`,
      (await ph(8)) === "3 ft 7 3/4 in" && (await ph(10)) === "4 ft" && (await ph(12)) === "4 ft 3 in" && (await ph(14)) === "6 ft 3 1/8 in");
    /* the empty eave box says it short, the line under it width by width */
    const eavePh = await p.getAttribute('[data-field="built:LB:eaveOverhang"]', "placeholder");
    const eaveFrom = await p.locator('[data-field="built:LB:eaveOverhang"]').locator("xpath=..").locator(".pl-built-from").textContent();
    ok(`the empty eave box says "1 3/4 to 2 1/8 in" and under it each width ("${eaveFrom}")`, eavePh === "1 3/4 to 2 1/8 in" && eaveFrom === "Standard: 1 3/4 in at 8 ft wide, 1 15/16 in at 10 ft wide, 2 1/8 in at 12 ft wide and 1 3/4 in at 14 ft wide", `${eavePh} | ${eaveFrom}`);
    await typeIn(p, "built:LB:barnPeak:10", "4 ft 2 in");
    ok("typing 4 ft 2 in for 10 ft wide leaves the 8 and 12 ft boxes saying the standard's", (await ph(8)) === "3 ft 7 3/4 in" && (await ph(12)) === "4 ft 3 in" && (await msgText(p, "built:LB:barnPeak")) === "");
    await p.click(".pl-bar .btn-accent");
    await p.waitForSelector(".pl-saved", { timeout: 30000 });
    const saved = await p.textContent(".pl-saved");
    ok("the Saved box says \"Lofted Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in\" and nothing about the other widths", saved.includes("Lofted Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in") && !/at (8|12) ft wide:/.test(saved), saved.slice(0, 300));
    /* what the lot's designer draws, from the stored price list */
    const { raw } = storedPriceList();
    const { resolve: resolveCo } = await import("../model/company.js");
    const { frameOf } = await import("../model/frame.js");
    const { defaults, setType } = await import("../model/design.js");
    const { barnTrussPeakFt } = await import("../model/roof-shapes.js");
    const M = JSON.parse(readFileSync(resolve(ROOT, "library/manufacturers/standard.json"), "utf8"));
    const L = JSON.parse(readFileSync(resolve(ROOT, "library/construction.json"), "utf8"));
    const cat = resolveCo(raw.data.settings, M, L);
    const peak = (z) => { const st = setType(defaults(cat), "LB", cat) || defaults(cat); const s2 = { ...st, type: "LB", size: z }; const f = frameOf(s2, cat); return Math.round(barnTrussPeakFt(f.W, f.t, f.construction) * 12 * 16) / 16; };
    ok(`... and the 3D designer draws 8, 10 and 12 ft wide at 43 3/4, 50 and 51 in (${[peak("8x12"), peak("10x12"), peak("12x16")].join(", ")})`, peak("8x12") === 43.75 && peak("10x12") === 50 && peak("12x16") === 51);
    await p.locator('[data-built="LB"]').screenshot({ path: `${OUT}/barn-one-width-1280.png` });
    ok("no errors", p.errors.length === 0, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  }

  /* ---- 7 ----------------------------------------------------------------- */
  section("7. The \"try it\" demo");
  {
    const p = await pageFor(null);
    const calls = [];
    p.on("request", (r) => { if (/\/api\//.test(r.url())) calls.push(r.url()); });
    await p.goto(`${BASE}/dealer?demo`, { waitUntil: "load" });
    await p.waitForSelector(".person-pick", { timeout: 30000 });
    await p.click(".person-pick:has-text('Chris Walker')");
    await p.waitForSelector(".banner.demo", { timeout: 30000 });
    await openPriceList(p, `${BASE}/dealer?demo`);
    await openStyle(p, "LB");
    await typeIn(p, "built:LB:wallHeight", "84");
    await p.click(".pl-bar .btn-accent");
    await p.waitForSelector(".pl-saved", { timeout: 60000 });
    const saved = await p.textContent(".pl-saved");
    ok("the demo saves a 7 ft Lofted Barn wall, checked at every size, in the page", saved.includes("Lofted Barn wall height: 6 ft 7 1/2 in → 7 ft") && /Every size of the Lofted Barn was drawn/.test(saved), saved.slice(0, 300));
    ok("... and never calls the real server", calls.length === 0, calls.slice(0, 3).join(" "));
    ok("no errors in the demo", p.errors.length === 0, p.errors.slice(0, 3).join(" | "));
    await p.context().close();
  }
} catch (e) {
  fail++;
  failures.push("the check stopped: " + (e && e.stack || e));
  console.log("    FAIL the check stopped: " + (e && e.message || e));
} finally {
  await browser.close();
  if (!KEEP) server.kill();
  else console.log(`\nThe local Dealer Center is still running: ${BASE}/dealer`);
}

if (fail) {
  console.log(`\nFAIL: ${fail} of ${pass + fail} checks failed:`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
console.log(`\nPROVED: all ${pass} checks passed -- the owner types how a style or the whole business is built and sees a plain problem under the box as it types ("Roof pitch: write it like 5/12.", "Did you mean 72 in (6 ft)?") with a red count on the tab; Check every size and the server's save both say what does not fit in words; a good change saves with its History line and a link to the 3D designer; a quiet check on open finds numbers the standard no longer fits; a manager sees the numbers read only; the "try it" demo does the same in the page; 1280 and 390 wide with no sideways scrolling and 44 px taps. Pictures: test/out/how-its-built/.`);
if (!KEEP) process.exit(0);
