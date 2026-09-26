/* CHECK: "Share my design" makes a link that opens the very same building,
   and a shared link is opened honestly -- look-only when asked, priced from
   today's list, and with a plain message when it cannot be read.
   Run: node tools/check-share.mjs [--quiet]            (check-all: browser)

   WHY. A customer sends the link to their spouse; the quote form sends it to
   the company (ui/quote.js); a salesperson opens it to see what was asked
   for. If the link opens a DIFFERENT building, or quotes an old price as if
   it were today's, or shows a blank page because a text message cut it
   short, somebody is misled. docs/ARCHITECTURE.md ("Share link") and
   docs/DIFFERENCES.md #3, #5 and #14 are the promises; ui/share.js keeps
   them.

   WHAT IT PROVES, in a real browser with a test company (the demo company
   renamed "Acme Sheds", with a phone number):
   1. ROUND TRIP: a design changed by real clicks (a size, a colour, an added
      window), shared with the Share button (which copies the link and shows
      it), opens in a fresh page as the SAME design -- every item where it was
      put -- at the SAME price, with the same name on the plate.
   2. LOOK-ONLY (#d=...&view=1, and ?view=1): the page is read-only (nothing
      can be selected, by the page's API or by a click on the building), the
      cards are hidden, a card shows the building and today's total, and
      "Change this design" gives the designer back. A link without view=1
      opens editable.
   3. PRICE CHANGED: a link that was priced at $1,234.50 on 2026-01-15 says
      "This design was priced at $1,234.50 on January 15, 2026; prices may
      have changed - contact Acme Sheds at (555) 010-0142", and shows today's
      price; a link priced at today's price says nothing of the sort.
   4. NO LONGER OFFERED: a link naming a door the company does not sell and a
      colour it no longer has shows both warnings in plain words -- and an
      item named <img src=x onerror=...> shows as those characters, never runs.
   5. A LONG LINK: a design with far more items than the 30 the link was
      sized for makes a link over 2,000 characters, and it still opens the
      same building at the same price.
   6. A DAMAGED LINK (a changed character, a link cut in half, text that is
      not a design) opens the standard building with a plain "This design
      link could not be opened" message -- no blank page, no console error.
   7. WHERE THE LINK POINTS: the company's own designer page (embed.shareUrl)
      when it has one, else this page without "embed=1".
   8. ON A PHONE: the Share button opens the phone's share sheet with the
      link; where copying is blocked, the link is shown selected to copy by
      hand.
   9. A DIFFERENT link opened in the same tab replaces the building.
  10. The day a link says it was priced is the customer's own calendar day
      (9:30 pm in Florida is not yet tomorrow), and a day the calendar does
      not have (February 30) is never printed as one.
  11. A company that shows no prices: its links carry no price inside them,
      and its look-only page shows no dollar figure. A company's phone
      number and fine print, even with HTML in them, show as typed.
   Pictures: test/out/share-*.png. */

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { encode, encodeSync, decode } from "../model/design.js";
import { money } from "../model/pricing.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out");
const PORT = 8354, BASE = "http://127.0.0.1:" + PORT;
const QUIET = process.argv.includes("--quiet");
const J = (v) => JSON.stringify(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; if (!QUIET) console.log("  ok   " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (extra !== undefined ? "\n       " + String(extra).slice(0, 1200) : "")); }
  return !!cond;
}
function section(t) { console.log("\n" + t); }

const servers = [];
async function serve() {
  const url = BASE + "/index.html";
  const answers = async () => { try { return (await fetch(url)).ok; } catch { return false; } };
  if (await answers()) return;
  const child = spawn("npx", ["http-server", ROOT, "-p", String(PORT), "-s", "-c-1", "-a", "127.0.0.1"], { detached: true, stdio: "ignore" });
  servers.push(child);
  for (let i = 0; i < 150; i++) { if (await answers()) return; await sleep(100); }
  throw new Error("could not serve the repo on port " + PORT);
}
function stopServers() { for (const c of servers) { try { process.kill(-c.pid, "SIGTERM"); } catch {} } servers.length = 0; }
process.on("exit", stopServers);

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright/index.js");
const LAUNCH = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };

/* ---------------- the test companies ---------------- */
const DEMO = JSON.parse(readFileSync(resolve(ROOT, "companies/demo/company.json"), "utf8"));
function company(id, extra) {
  const c = JSON.parse(JSON.stringify(DEMO));
  c.id = id;
  c.brand = Object.assign({}, c.brand, { name: "Acme Sheds", short: "Acme Sheds", phone: "(555) 010-0142", email: "sales@acme.example" });
  c.leads = { mode: "none" };
  c.embed = { origins: [], shareUrl: "" };
  c.notes = Object.assign({}, c.notes, { finePrint: "Prices plus tax. Free delivery within 40 miles." });
  return Object.assign(c, extra || {});
}
const COS = {
  sharetest: company("sharetest"),
  shareown: company("shareown", { embed: { origins: [], shareUrl: "https://acme-sheds.example/design?from=site#old" } }),
  /* a company that shows no prices */
  sharenone: company("sharenone", { pricing: Object.assign({}, DEMO.pricing, { show: "none" }) }),
};
/* a company whose phone and fine print have HTML in them */
COS.shareevil = company("shareevil");
COS.shareevil.brand.phone = '(555) 010-0142 <img src=x onerror="window.__pwned=true">';
COS.shareevil.notes.finePrint = '<img src=x onerror="window.__pwned=true"> Prices plus tax.';

async function newContext(browser, o) {
  o = o || {};
  const ctx = await browser.newContext(Object.assign({ viewport: o.viewport || { width: 1200, height: 860 }, reducedMotion: "reduce", deviceScaleFactor: 1 }, o.extra || {}));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1[:\/])/, (r) => r.abort());
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await ctx.route(/\/companies\/(share[a-z]+)\/company\.json/, (r) => {
    const id = /\/companies\/(share[a-z]+)\//.exec(r.request().url())[1];
    return COS[id] ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(COS[id]) }) : r.fulfill({ status: 404, body: "no" });
  });
  if (o.clipboard !== false) { try { await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE }); } catch { /* older Playwright */ } }
  if (o.init) await ctx.addInitScript(o.init);
  return ctx;
}
function realNoise(noise) {
  return noise.filter((m) => (m.type === "error" || m.type === "pageerror") && !/fonts\.(googleapis|gstatic)\.com/.test(m.text + " " + (m.url || "")));
}
async function open(ctx, address) {
  const page = await ctx.newPage();
  const noise = [];
  page.on("console", (m) => { if (m.type() === "error") noise.push({ type: "error", text: m.text(), url: (m.location() || {}).url }); });
  page.on("pageerror", (e) => noise.push({ type: "pageerror", text: String(e) }));
  await page.goto(address, { waitUntil: "load" });
  await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
  return { page, noise };
}
const snap = (page) => page.evaluate(() => ({
  design: window.shedUI.getDesign(), total: window.shedUI.price().total,
  plate: document.getElementById("platename").textContent + " " + document.getElementById("plateprice").textContent,
  readOnly: window.shedUI.readOnly, viewonly: document.body.classList.contains("viewonly"),
}));
async function clickShare(page, sel) {
  await page.click(sel || "#share-mount .sharebtn");
  await page.waitForFunction((s) => { const b = document.querySelector(s); const m = b && b.parentElement.querySelector(".sharemsg"); return m && m.textContent && !/Making/.test(m.textContent); }, sel || "#share-mount .sharebtn", { timeout: 15000 });
  return page.evaluate((s) => { const box = document.querySelector(s).parentElement; return { msg: box.querySelector(".sharemsg").textContent, input: box.querySelector(".sharelink").value, open: !box.querySelector(".sharepanel").hidden, focused: document.activeElement === box.querySelector(".sharelink") }; }, sel || "#share-mount .sharebtn");
}
async function picture(page, name, locator) {
  try { mkdirSync(OUT, { recursive: true }); if (locator) await page.locator(locator).first().screenshot({ path: resolve(OUT, name) }); else await page.screenshot({ path: resolve(OUT, name) }); }
  catch (e) { console.log("       (picture " + name + " not saved: " + e.message + ")"); }
}
function withoutPriced(d) { const o = Object.assign({}, d); delete o.priced; return o; }

let browser = null;
try {
  await serve();
  browser = await chromium.launch(LAUNCH);

  /* ------------------------------------------------------------ 1 */
  section("1. Round trip: share a changed design, open it, get the same building and price");
  let LINK = "", A = null;
  {
    const ctx = await newContext(browser);
    const { page, noise } = await open(ctx, BASE + "/?company=sharetest");
    const sizes = await page.$$eval("#sizechips .chip[data-size]", (b) => b.map((x) => x.getAttribute("data-size")));
    const size = sizes[Math.min(3, sizes.length - 1)];
    await page.click(`#sizechips .chip[data-size="${size}"]`);
    await page.click("#sw-body button:nth-child(4)");
    await page.click("#add-win");
    await page.click("#sh-done");
    await sleep(300);
    A = await snap(page);
    const r = await clickShare(page);
    let clip = "";
    try { clip = await page.evaluate(() => navigator.clipboard.readText()); } catch (e) { clip = "(could not read: " + e.message + ")"; }
    LINK = clip;
    ok("the design was changed by real clicks (size " + size + ", a colour, an added window)", A.design.size === size && A.design.items.length > 0, J({ size: A.design.size, n: A.design.items.length }));
    ok("the Share button copies the link and says so, and shows the link to copy by hand too", /Link copied/.test(r.msg) && r.open && r.input === clip && clip.startsWith(BASE + "/?company=sharetest#d="), J(r));
    await picture(page, "share-panel.png", "#quotecard");
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    const b = await open(ctx, LINK);
    const B = await snap(b.page);
    ok("the link opens the SAME design in a fresh page: style, size, colours and every item where it was put", J(B.design) === J(A.design), J({ A: A.design, B: B.design }));
    ok("at the SAME price (" + money(A.total) + ") with the same name on the plate", B.total === A.total && B.plate === A.plate, J({ A: [A.total, A.plate], B: [B.total, B.plate] }));
    ok("a link without view=1 opens the designer ready to change it (not look-only), with nothing to warn about", !B.readOnly && !B.viewonly && !(await b.page.$(".vcard")), J(B));
    ok("no console errors opening it", realNoise(b.noise).length === 0, J(realNoise(b.noise)));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2 */
  section("2. The look-only page (&view=1 and ?view=1)");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await open(ctx, LINK + "&view=1");
    const V = await snap(page);
    const ui = await page.evaluate(() => {
      const api = window.shedUI, card = document.querySelector(".vcard.shview");
      const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none";
      const it = api.getState().items[0];
      api.select(it.id);
      const sel1 = api.getState().sel;
      return { card: vis(card), text: card ? card.textContent : "", cardsHidden: Array.from(document.querySelectorAll("section.card")).every((c) => !vis(c)),
        sel1, hint: document.getElementById("hint").textContent, view: api.share.view, note: api.share.priceNote,
        buttons: card ? Array.from(card.querySelectorAll("a, button")).map((x) => x.textContent.trim()) : [] };
    });
    /* a real click on the middle of the building selects nothing either */
    const box = await page.locator("#c3d").boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(300);
    const sel2 = await page.evaluate(() => window.shedUI.getState().sel);
    ok("the page is look-only: read-only, body.viewonly, and the cards are hidden", V.readOnly && V.viewonly && ui.cardsHidden && ui.view, J({ V, ui }));
    ok("nothing can be selected -- not by the page's API, not by a click on the building", ui.sel1 === null && sel2 === null, J({ ui: ui.sel1, sel2 }));
    ok("it is the same building at the same price", J(V.design) === J(A.design) && V.total === A.total);
    ok("a card shows the company, the building and TODAY'S total (" + money(A.total) + ")", ui.card && /Acme Sheds — a shared design/.test(ui.text) && ui.text.indexOf(money(A.total)) >= 0 && /Estimated total today/i.test(ui.text), ui.text.slice(0, 400));
    ok("the price has not changed, so there is no price note", ui.note === "" && !/priced at/.test(ui.text), ui.note);
    ok("the card has Call and Text buttons for the company, Change this design and Share this design", ui.buttons.some((t) => /^Call \(555\) 010-0142$/.test(t)) && ui.buttons.some((t) => /^Text/.test(t)) && ui.buttons.includes("Change this design") && ui.buttons.includes("Share this design"), J(ui.buttons));
    ok("the hint says what a look-only page can do ('Drag to spin it around')", ui.hint === "Drag to spin it around", ui.hint);
    await picture(page, "share-view.png");
    const sh = await clickShare(page, ".vcard.shview .sharebtn");
    ok("'Share this design' on the look-only page copies a link to the same building", /Link copied/.test(sh.msg) && sh.input.startsWith(BASE + "/?company=sharetest#d="), J(sh));
    await page.click(".vcard.shview .shchange");
    await sleep(300);
    const after = await page.evaluate(() => ({ ro: window.shedUI.readOnly, cls: document.body.classList.contains("viewonly"), card: !!document.querySelector(".vcard.shview"), hash: location.hash, visible: getComputedStyle(document.getElementById("card-colors")).display !== "none", hint: document.getElementById("hint").textContent }));
    ok("'Change this design' gives the designer back: editable, the cards showing, the address no longer asking for look-only", !after.ro && !after.cls && !after.card && after.visible && !/view=1/.test(after.hash) && /Drag to spin ·/.test(after.hint), J(after));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    const q = await open(ctx, LINK.replace("?company=sharetest", "?company=sharetest&view=1"));
    const Q = await snap(q.page);
    ok("?view=1 in the address works the same way", Q.readOnly && Q.viewonly && J(Q.design) === J(A.design), J(Q));
    await ctx.close();
    /* on a phone */
    const cp = await newContext(browser, { viewport: { width: 390, height: 844 } });
    const p = await open(cp, LINK + "&view=1");
    const sideways = await p.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok("the look-only page fits a 390 px phone with no sideways scroll", sideways <= 0, sideways);
    await picture(p.page, "share-view-phone.png");
    await cp.close();
  }

  /* ------------------------------------------------------------ 3 */
  section("3. A link priced on another day");
  {
    const ctx = await newContext(browser);
    const d = Object.assign({}, A.design, { priced: { total: 1234.5, at: "2026-01-15" } });
    const body = await encode(d);
    const { page, noise } = await open(ctx, BASE + "/?company=sharetest#d=" + body + "&view=1");
    const r = await page.evaluate(() => ({ note: (document.querySelector(".vcard.shview .shprice") || {}).textContent || "", text: (document.querySelector(".vcard.shview") || {}).textContent || "", total: window.shedUI.price().total, plate: document.getElementById("plateprice").textContent }));
    ok("it says: priced at $1,234.50 on January 15, 2026; prices may have changed - contact Acme Sheds at (555) 010-0142", /This design was priced at \$1,234\.50 on January 15, 2026; prices may have changed - contact Acme Sheds at \(555\) 010-0142/.test(r.note), r.note);
    ok("and it prices from TODAY'S list (" + money(A.total) + "), on the card and the plate", r.total === A.total && r.text.indexOf(money(A.total)) >= 0 && r.plate === money(A.total), J({ total: r.total, plate: r.plate }));
    await picture(page, "share-price-note.png", ".vcard.shview");
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    const e = await open(ctx, BASE + "/?company=sharetest#d=" + body);
    const en = await e.page.evaluate(() => ({ note: (document.querySelector(".vcard.shnotice .shprice") || {}).textContent || "", ro: window.shedUI.readOnly }));
    ok("opened to change (no view=1), the same note shows at the top, and the designer stays editable", /priced at \$1,234\.50/.test(en.note) && !en.ro, J(en));
    /* a price that is not a number or a date that is not a date is not shown as one */
    const junk = await encode(Object.assign({}, A.design, { priced: { total: "<b>9</b>", at: "<img src=x onerror=window.__pwned=1>" } }));
    const k = await open(ctx, BASE + "/?company=sharetest#d=" + junk + "&view=1");
    const kr = await k.page.evaluate(() => ({ note: window.shedUI.share.priceNote, pw: window.__pwned, imgs: document.querySelectorAll(".vcard img").length }));
    ok("a hand-made 'price' that is not a number is ignored, and nothing in it runs", kr.note === "" && kr.pw === undefined && kr.imgs === 0, J(kr));
    const feb30 = await encode(Object.assign({}, A.design, { priced: { total: 1234.5, at: "2026-02-30" } }));
    const f = await open(ctx, BASE + "/?company=sharetest#d=" + feb30 + "&view=1");
    const fr = await f.page.evaluate(() => window.shedUI.share.priceNote);
    ok("a day the calendar does not have (February 30) is not printed as a date ('priced at $1,234.50 earlier')", /priced at \$1,234\.50 earlier;/.test(fr) && !/February/.test(fr), fr);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 4 */
  section("4. Things the company no longer offers");
  {
    const ctx = await newContext(browser);
    const d = JSON.parse(JSON.stringify(A.design));
    d.items.push({ cat: '<img src=x onerror="window.__pwned=1">', wall: "L", pos: 1 });
    d.colors.body = "Plaid";
    const body = await encode(d);
    const { page, noise } = await open(ctx, BASE + "/?company=sharetest#d=" + body + "&view=1");
    const r = await page.evaluate(() => {
      const w = document.querySelector(".vcard.shview .shwarn");
      return { items: w ? Array.from(w.querySelectorAll("li")).map((l) => l.textContent) : [], imgs: document.querySelectorAll(".vcard img").length, pw: window.__pwned, warnings: window.shedUI.startWarnings };
    });
    ok("each thing no longer offered is listed in plain words (a door and a colour)", r.items.length === 2 && r.items.some((t) => /no longer offers; it was left off/.test(t)) && r.items.some((t) => /siding colour "Plaid" is no longer offered/.test(t)), J(r.items));
    ok("an item named <img src=x onerror=...> shows as those characters -- nothing runs, no picture is made", r.items.some((t) => t.indexOf('<img src=x onerror="window.__pwned=1">') >= 0) && r.imgs === 0 && r.pw === undefined, J(r));
    await picture(page, "share-warnings.png", ".vcard.shview");
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    /* a company whose phone number and fine print have an <img> tag in them */
    const ev = await open(ctx, BASE + "/?company=shareevil#d=" + (await encode(A.design)) + "&view=1");
    const er = await ev.page.evaluate(() => { const c = document.querySelector(".vcard.shview"); const call = c && c.querySelector(".shcall"); return { pw: window.__pwned, imgs: document.querySelectorAll(".vcard img").length, text: c ? c.textContent : "", tel: call ? call.getAttribute("href") : "" }; });
    ok("a company phone number and fine print with an <img> tag in them show as typed on the look-only card -- nothing runs -- and the Call button still dials the digits", er.pw === undefined && er.imgs === 0 && er.text.indexOf('(555) 010-0142 <img src=x onerror="window.__pwned=true">') >= 0 && er.text.indexOf('<img src=x onerror="window.__pwned=true"> Prices plus tax.') >= 0 && er.tel === "tel:5550100142", J(er));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 5 */
  section("5. A link longer than it was sized for");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await open(ctx, BASE + "/?company=sharetest");
    const r = await page.evaluate(async () => {
      const api = window.shedUI;
      let n = 40, link = "", d = null;
      /* positions from a fixed number sequence (the same every run), so the
         link cannot squeeze them down to nothing */
      let seed = 12345;
      const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
      for (; n <= 400; n += 40) {
        d = api.getDesign();
        d.type = "UT"; d.size = "14x40";
        d.items = [];
        seed = 12345;
        for (let i = 0; i < n; i++) {
          const wall = ["L", "R", "F", "B"][Math.floor(next() * 4)];
          const half = wall === "L" || wall === "R" ? 18 : 5;
          d.items.push({ cat: ["w23", "w33", "tr"][Math.floor(next() * 3)], wall: wall, pos: Math.round((next() * 2 - 1) * half * 100) / 100, shut: next() < 0.3 });
        }
        api.applyDesign(d);
        link = await api.share.link();
        if (link.length > 2000) break;
      }
      return { n, len: link.length, link, design: api.getDesign(), total: api.price().total };
    });
    ok("a design with " + r.n + " items makes a link of " + r.len + " characters (more than 2,000)", r.len > 2000, r.len);
    const b = await open(ctx, r.link);
    const B = await snap(b.page);
    ok("it still opens the same building, every item, at the same price (" + money(r.total) + ")", J(B.design) === J(r.design) && B.total === r.total, J({ n: B.design.items.length, want: r.design.items.length, t: [B.total, r.total] }));
    ok("no console errors", realNoise(noise).length === 0 && realNoise(b.noise).length === 0, J(realNoise(noise).concat(realNoise(b.noise))));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 6 */
  section("6. A damaged link");
  {
    const ctx = await newContext(browser);
    const body = LINK.split("#d=")[1];
    const plain = encodeSync(A.design);
    const cases = [
      ["a character changed by hand", "#d=" + body.slice(0, 12) + "!" + body.slice(13)],
      ["a link cut in half by a text message", "#d=" + body.slice(0, Math.floor(body.length / 2))],
      ["a plain (uncompressed) link cut short", "#d=" + plain.slice(0, Math.floor(plain.length * 0.6))],
      ["text that is not a design at all", "#d=aGVsbG8gdGhlcmU"],
    ];
    for (const [what, hash] of cases) {
      const { page, noise } = await open(ctx, BASE + "/?company=sharetest" + hash + "&view=1");
      const r = await page.evaluate(() => {
        const c = document.querySelector(".vcard.shnotice.shbad");
        return { shown: !!c && c.getClientRects().length > 0, text: c ? c.textContent : "", err: window.shedUI.startError, type: window.shedUI.getState().type, size: window.shedUI.getState().size, ro: window.shedUI.readOnly, tel: !!(c && c.querySelector('a[href^="tel:"]')) };
      });
      ok(what + ": a plain message ('This design link could not be opened ... the standard building instead'), the standard building, and the designer still usable", r.shown && /This design link could not be opened/.test(r.text) && /standard building instead/.test(r.text) && r.err && r.type === DEMO.defaults.style && !r.ro && r.tel, J(r));
      ok(what + ": no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
      if (what === "a link cut in half by a text message") await picture(page, "share-damaged.png", ".vcard.shbad");
    }
    await ctx.close();
  }

  /* ------------------------------------------------------------ 7 */
  section("7. Where the link points");
  {
    const ctx = await newContext(browser);
    const own = await open(ctx, BASE + "/?company=shareown");
    const l1 = await own.page.evaluate(() => window.shedUI.share.link());
    ok("with embed.shareUrl, the link goes to the company's own designer page (its old #... dropped)", l1.startsWith("https://acme-sheds.example/design?from=site#d=") && !/#old/.test(l1), l1.slice(0, 80));
    const emb = await open(ctx, BASE + "/?company=sharetest&embed=1");
    const l2 = await emb.page.evaluate(() => window.shedUI.share.link());
    ok("without one, the link is this page's address without embed=1", l2.startsWith(BASE + "/?company=sharetest#d=") && !/embed=1/.test(l2), l2.slice(0, 80));
    const ql = await emb.page.evaluate(() => window.shedUI.share.viewLink());
    ok("the quote form's link is the same address, look-only (&view=1 at the end)", ql.startsWith(BASE + "/?company=sharetest#d=") && /&view=1$/.test(ql), ql.slice(-20));
    ok("no console errors", realNoise(own.noise).length === 0 && realNoise(emb.noise).length === 0);
    await ctx.close();
  }

  /* ------------------------------------------------------------ 8 */
  section("8. On a phone: the share sheet, and copying blocked");
  {
    const ctx = await newContext(browser, {
      viewport: { width: 390, height: 844 }, extra: { isMobile: true, hasTouch: true },
      init: () => { navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; },
    });
    const { page, noise } = await open(ctx, BASE + "/?company=sharetest");
    const want = await page.evaluate(() => window.shedUI.share.link());
    await page.locator("#share-mount .sharebtn").scrollIntoViewIfNeeded();
    const r = await clickShare(page);
    const shared = await page.evaluate(() => window.__shared || null);
    ok("on a touch screen the Share button opens the phone's share sheet with the link", shared && shared.url === want && /Sent/.test(r.msg), J({ shared, msg: r.msg }));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
    const c2 = await newContext(browser, {
      clipboard: false,
      init: () => { try { Object.defineProperty(Navigator.prototype, "clipboard", { get() { return undefined; }, configurable: true }); } catch (e) {} document.execCommand = () => false; },
    });
    const p2 = await open(c2, BASE + "/?company=sharetest");
    const want2 = await p2.page.evaluate(() => window.shedUI.share.link());
    const r2 = await clickShare(p2.page);
    ok("where copying is blocked, it says so and shows the link selected, ready to copy by hand", /blocked/.test(r2.msg) && r2.input === want2 && r2.focused, J(r2));
    ok("no console errors", realNoise(p2.noise).length === 0, J(realNoise(p2.noise)));
    await c2.close();
  }

  /* ------------------------------------------------------------ 9 */
  section("9. A different link opened in the same tab");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await open(ctx, LINK);
    const other = Object.assign({}, A.design, { type: "UT", size: "10x12" });
    delete other.items;
    const body = await encode(other);
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.evaluate((b) => { location.hash = "#d=" + b; }, body)]);
    await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
    const s = await page.evaluate(() => ({ type: window.shedUI.getState().type, size: window.shedUI.getState().size }));
    ok("the page shows the new link's building (it reloads)", s.type === "UT" && s.size === "10x12", J(s));
    ok("no console errors", realNoise(noise).length === 0, J(realNoise(noise)));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 10 */
  section("10. The day a link was priced is the customer's own day");
  {
    /* 9:30 in the evening in Florida is already tomorrow in London */
    const ctx = await newContext(browser, { extra: { timezoneId: "America/New_York" } });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date("2026-01-15T02:30:00Z"));
    await page.goto(BASE + "/?company=sharetest", { waitUntil: "load" });
    await page.waitForFunction(() => window.shedUI && window.shedUI.ready, null, { timeout: 90000 });
    const r = await page.evaluate(async () => ({ clock: new Date().toString(), link: await window.shedUI.share.link() }));
    const d = await decode(r.link);
    ok("a link made at 9:30 pm on January 14 in Florida says it was priced on 2026-01-14, not London's January 15 (" + r.clock.slice(0, 24) + ")", d.priced && d.priced.at === "2026-01-14", J(d.priced));
    await ctx.close();
  }

  /* ------------------------------------------------------------ 11 */
  section("11. A company that shows no prices");
  {
    const ctx = await newContext(browser);
    const { page, noise } = await open(ctx, BASE + "/?company=sharenone");
    const link = await page.evaluate(() => window.shedUI.share.viewLink());
    const d = await decode(link);
    ok("its share link carries no price at all (anybody can unpack a link and read it)", d.priced === undefined && !/\$/.test(JSON.stringify(d)), J(d.priced));
    const v = await open(ctx, link);
    const t = await v.page.evaluate(() => ({ card: (document.querySelector(".vcard.shview") || {}).textContent || "", plate: document.getElementById("plateprice").textContent, ro: window.shedUI.readOnly }));
    ok("its look-only page shows no dollar figure anywhere on the card", t.ro && t.card && !/\$/.test(t.card) && !/priced at/.test(t.card), J(t));
    ok("no console errors", realNoise(noise).length === 0 && realNoise(v.noise).length === 0, J(realNoise(noise).concat(realNoise(v.noise))));
    await ctx.close();
  }
} catch (e) {
  ok("the check ran to the end", false, e && e.stack || e);
} finally {
  if (browser) await browser.close();
  stopServers();
}

console.log(`\ncheck-share: ${pass} passed, ${fail} failed`);
if (fail) { console.log("FAILED:\n - " + failures.join("\n - ")); process.exit(1); }
console.log("PROVED: a shared link opens the same building at the same price (even one far longer than it was sized for); a look-only link cannot be changed and prices from today's list, saying so when the price has changed (dated by the customer's own calendar), and a company that shows no prices puts no price in its links; anything no longer offered is listed in plain words; a damaged link shows the standard building with a plain message; the link points at the company's own page when it has one; and on a phone the share sheet opens, or the link is shown to copy by hand.");
process.exit(0);
