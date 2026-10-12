/* CHECK: BARNWRIGHT SETUP ACCESS ON THE SCREENS (A14, and the browser half
   of F2 and F10; the server's rules are tools/check-setup-access.mjs).
   Run: node tools/check-setup-screens.mjs [--keep]
   check-all: browser

   It starts the local Dealer Center (tools/office-local.mjs) as a new
   business connected to a pretend control room, on port 9400, opens
   Chromium, and proves:

     1. before live, the owner's closed banner says Barnwright is setting up
        their prices, with Look at the preview; Settings has one card,
        Barnwright, saying so, with Stop Barnwright's setup access;
     2. the preview: the owner sees the closed lot's 3D designer with the
        Preview bar and no quote form; a customer still gets the closed page;
     3. Alan's visit: the link's pass leaves the address at once, the
        __Host- cookie is set, the bar says who and until when, and only
        Price list and Settings show (Settings without Open or Closed and
        without the Barnwright card); anything else is "Nothing here";
        and in it the Saved box's 3D designer link is the preview (M1), an
        option that changes the building shows how as words, with no box,
        chips or Remove, and no option gets a roof pitch box (M4);
     4. a visit that ends while Alan works never reloads and never asks to
        sign in: the words say what to do, the draft stays and is kept in
        the tab, and comes back with the next visit, which saves it;
     5. Done ends the visit;
     6. Open to customers asks first, with the line about setup access;
     7. after live, the card has the one choice (Run checks, or Run checks
        and change my price list and settings); turned on, it says until
        when, and the owner's banner says so with Turn off;
     8. on a phone the visit fits with no sideways scrolling, and the bars'
        buttons are full touch size (44 px);
     9. before the owner first signs in (a second local Dealer Center, on
        the next port): Alan's visit with the
        owner's sign-up agreement starts the price list and opens on it;
        the owner's first sign-in (an old #/setup link too) opens Today
        right away with the Getting started card, which says Barnwright
        set up the price list; Alan's $5,995 is kept as it was, their first
        lot is made, no terms line shows (the sign-up agreement is theirs),
        and the Barnwright card then says Barnwright is setting up, with
        Stop, the start in its log and who agreed on their sign-up page;
     and the review's fixes: a kept draft comes back once (Undo changes
     lets it go), a new visit opened in another tab brings the bar back,
     the visit's words say why it ended, Turn off before live says that
     setup access goes on, the card and Help say the new terms aren't out
     yet on a Dealer Center that still ships older terms (a third local
     one, two ports on, as if it shipped terms 2.1), a closed lot's preview
     points to Lots, and the log's end time reads right.

   Pictures go to test/out/setup-screens/. --keep leaves the server running. */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out/setup-screens");
const DATA = "test/out/setup-screens-data";
const PORT = Number(process.env.SETUP_SCREENS_PORT || 9400);
const BASE = `http://127.0.0.1:${PORT}`;
const KEEP = process.argv.includes("--keep");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const OWNER = "owner@example.com";
const DEALER = "dana@example.com";
/* the second local Dealer Center, for "Before the owner first signs in" (section 9) */
const PORT2 = PORT + 1;
const BASE2 = `http://127.0.0.1:${PORT2}`;
const DATA2 = "test/out/setup-screens-data-signup";
let server2 = null;
/* the third, as if it shipped terms 2.1 (a Dealer Center not updated since
   terms 2.2 went in), for section 0 */
const PORT3 = PORT + 2;
const BASE3 = `http://127.0.0.1:${PORT3}`;
const DATA3 = "test/out/setup-screens-data-older-terms";
let server3 = null;

const WORDS = {
  prelive: "Barnwright is setting up your prices. Look at the preview, check it with Alan, then open it to customers in Settings.",
  /* the closed banner when Barnwright hasn't set up the price list (ui/office/main.js CLOSED_WORDS) */
  closed: "Your 3D designer links are closed to customers. Check your prices, then open them in Settings.",
  beforeLive: "Barnwright is setting up your 3D designer. Until you open it to customers, they can change your price list and settings for you. Every change is listed here and in Price list, History.",
  preview: "Preview. Your customers can't see this until you open it in Settings.",
  ended: "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.",
  endedStopped: "Your Barnwright visit ended. The owner stopped Barnwright's setup access in Settings, Barnwright. Your changes are kept in this tab.",
  checksOff: "Checks are off. Barnwright can still set up your price list until you open it. To stop that too, tap Stop Barnwright's setup access.",
  termsNotOut: "Barnwright's new terms (2.2) aren't out yet, so Barnwright can only run checks for now.",
  termsFirst: "Agree to the new terms at the top of the page first.",
  /* the card's own line (ui/office/views/settings.js CARD.about, CARD.aboutChecks) */
  cardAbout: "Let Barnwright run checks on your Dealer Center, or change your price list and settings, for a few hours at a time.",
  cardAboutChecks: "Let Barnwright run checks on your Dealer Center for a few hours at a time. It turns itself off when the time is up. Barnwright never sees your customers, quotes, orders or team, and can't change anything.",
  /* Help's answer about the card (ui/office/help-answers.js) */
  helpChecks: "Let Barnwright run checks on your Dealer Center",
  helpChange: "Let Barnwright change your prices",
  previewLot: "Preview. Your customers can't see this lot until you open it in Lots.",
  /* a Barnwright visit: Alan is looking, and only the owner opens it */
  previewVisit: "Preview for Barnwright. Customers can't see this until the owner opens it in Settings.",
  previewVisitLot: "Preview for Barnwright. Customers can't see this lot until the owner opens it in Lots.",
  visitOnly: "A Barnwright visit has only the price list and settings.",
  opening: "Opening ends Barnwright's setup access. After this, Barnwright needs your switch to change your prices.",
  change: "Run checks and change my price list and settings",
  /* the Getting started card (ui/office/views/getting-started.js) */
  gsTitle: "Getting started",
  gsReady: "Your Dealer Center is ready. Your 3D designer stays closed to customers until you open it.",
  gsBarnwright: "Barnwright set up your price list. Check it, and change anything.",
  startLine: "started your price list from Every standard building, using the terms you agreed to when you signed up.",
  visitBiz: "Only the owner can change the numbers for every building. Each style's own numbers can be changed in that style, under How it's built.",
  /* ui/office/views/price-list/options.js VISIT_EXTRA_WORDS */
  visitExtraBuilt: "This option changes how the building is built, so only the owner can change that, where it is offered, or remove it.",
  visitExtraPlain: "Only the owner can make an option change how the building is built.",
};

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("    ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("    FAIL " + name + (extra ? " -- " + String(extra).slice(0, 400) : "")); }
}
const section = (t) => console.log("\n  " + t);

rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--empty", "--control-room", "--port", String(PORT), "--data", DATA], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", (d) => { serverLog += d; });
server.stderr.on("data", (d) => { serverLog += d; });
for (let i = 0; i < 120 && !/is running/.test(serverLog); i++) await new Promise((r) => setTimeout(r, 250));
if (!/is running/.test(serverLog)) {
  console.log("FAIL the local Dealer Center did not start:\n" + serverLog);
  server.kill();
  process.exit(1);
}

async function call(path, { method = "GET", body, email = OWNER } = {}) {
  const r = await fetch(BASE + path, {
    method, headers: { ...(email ? { cookie: `dealer_local_user=${encodeURIComponent(email)}` } : {}), origin: BASE, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}
const visitLink = async () => (await call("/__local/barnwright", { method: "POST", body: { visit: true } })).data.url;

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
async function contextFor(email, { width = 1280, height = 900, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE }]);
  return context;
}
async function pageIn(context) {
  const page = await context.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 40[1349]/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push("page error: " + e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}
async function settle(page) {
  await page.waitForSelector("#main", { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector("#main .loading"), null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(400);
}
/* open a screen afresh (a full load, so nothing on it is left over) */
async function open(page, hash) {
  await page.goto("about:blank");
  await page.goto(`${BASE}/dealer#${hash}`);
  await settle(page);
}
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const shot = (page, name) => page.screenshot({ path: resolve(OUT, name + ".png"), fullPage: false });

try {
  /* a new business, connected, made in one go (POST setup), one lot, the owner on terms 2.2 */
  await call("/api/office/me");
  const setup = await call("/api/office/setup", { method: "POST", body: { businessName: "Testing Sheds", phone: "941-555-0100", start: "small", agreeTerms: true } });
  const lot = await call("/api/office/lots", { method: "POST", body: { name: "Riverside", phone: "941-555-0140" } });
  if (setup.status !== 201 || lot.status !== 201) throw new Error("setting up the business failed: " + JSON.stringify([setup, lot]));

  section("0. W2: terms 2.2 are out (since October 12, 2026), so the card promises setup access; a Dealer Center on older terms doesn't");
  {
    const st = (await call("/api/office/barnwright-help")).data.setup;
    const c0 = await contextFor(OWNER);
    const o0 = await pageIn(c0);
    await open(o0, "/settings");
    const card0 = await text(o0, ".set-card:has(.card-title:text-is('Barnwright'))");
    ok("terms 2.2 are out here (termsOut), and the business was made agreeing to them (POST setup): the card says Barnwright is setting up, with Stop, and no \"aren't out yet\" line",
      st.termsOut === true && st.termsOk === true && card0?.includes(WORDS.beforeLive) && card0.includes("Stop Barnwright's setup access") && !card0.includes(WORDS.termsNotOut), card0);
    /* E2E-3: an owner who agreed to the older terms (2.1) only: until they
       agree to 2.2 at the top of the page, the card says only that, never
       that Barnwright is setting up (with a tick) or that nobody agreed */
    await call("/__local/barnwright", { method: "POST", body: { terms: "2.1" } });
    const stOld = (await call("/api/office/barnwright-help")).data.setup;
    await open(o0, "/settings");
    const cardOld = await text(o0, ".set-card:has(.card-title:text-is('Barnwright'))");
    ok("E2E-3: agreed to 2.1 only: the card says \"Agree to the new terms at the top of the page first.\", with no \"Barnwright is setting up\", no tick and no Stop",
      stOld.termsOut === true && stOld.termsOk === false && cardOld?.includes(WORDS.termsFirst) && !cardOld.includes(WORDS.beforeLive)
      && !cardOld.includes("Stop Barnwright's setup access") && !(await o0.$(".set-card:has(.card-title:text-is('Barnwright')) .help-state.on")), cardOld);
    ok("... and its terms line says they agreed to version 2.1 and where to agree to 2.2, never \"Nobody has agreed\"",
      /agreed to version 2\.1 on .+\. Agree to version 2\.2 at the top of the page\./.test(cardOld || "") && !cardOld.includes("Nobody has agreed"), cardOld);
    await o0.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
    await shot(o0, "0-owner-card-agreed-older-terms");
    await call("/__local/barnwright", { method: "POST", body: { terms: "2.2" } });
    await c0.close();
  }
  {
    /* a third local Dealer Center that ships terms 2.1: no owner can agree to
       2.2 there, so it must not promise setup access */
    rmSync(resolve(ROOT, DATA3), { recursive: true, force: true });
    server3 = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--empty", "--control-room", "--terms-version", "2.1", "--port", String(PORT3), "--data", DATA3], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let log3 = "";
    server3.stdout.on("data", (d) => { log3 += d; });
    server3.stderr.on("data", (d) => { log3 += d; });
    for (let i = 0; i < 120 && !/is running/.test(log3); i++) await new Promise((r) => setTimeout(r, 250));
    ok("(a third local Dealer Center, connected, as if it shipped terms 2.1)", /is running/.test(log3), log3.slice(-400));
    const call3 = async (path, { method = "GET", body, email = OWNER } = {}) => {
      const r = await fetch(BASE3 + path, {
        method, headers: { ...(email ? { cookie: `dealer_local_user=${encodeURIComponent(email)}` } : {}), origin: BASE3, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    const ctx3 = async (email, { width = 1280, height = 900, mobile = false } = {}) => {
      const c3 = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile });
      await c3.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      if (email) await c3.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE3 }]);
      return c3;
    };
    const open3 = async (page, hash) => {
      await page.goto("about:blank");
      await page.goto(`${BASE3}/dealer#${hash}`);
      await settle(page);
    };
    await call3("/api/office/me");
    const setup3 = await call3("/api/office/setup", { method: "POST", body: { businessName: "Testing Sheds", phone: "941-555-0100", start: "small", agreeTerms: true } });
    const lot3 = await call3("/api/office/lots", { method: "POST", body: { name: "Riverside", phone: "941-555-0140" } });
    const st3 = (await call3("/api/office/barnwright-help")).data?.setup;
    ok("... the business made there (POST setup) agrees to 2.1, and its setup access says the terms aren't out (termsOut false)",
      setup3.status === 201 && lot3.status === 201 && st3?.termsOut === false && st3.termsOk === false && st3.mode === null, JSON.stringify([setup3.status, lot3.status, st3]));
    const c3 = await ctx3(OWNER);
    const o3 = await pageIn(c3);
    await open3(o3, "/settings");
    const card3 = await text(o3, ".set-card:has(.card-title:text-is('Barnwright'))");
    ok("on older terms: one line says the new terms aren't out yet, with no setup access words, no Stop and no change choice",
      card3?.includes(WORDS.termsNotOut) && !card3.includes(WORDS.beforeLive) && !card3.includes("Stop Barnwright's setup access") && !card3.includes(WORDS.change)
      && !card3.includes("Agree to the new terms") && card3.includes("Turn on"), card3);
    ok("... and the card's own line says Barnwright can only run checks, never \"or change your price list and settings\"",
      card3?.includes(WORDS.cardAboutChecks) && !card3.includes(WORDS.cardAbout) && !/change your price list and settings, for a few hours/.test(card3), card3);
    await o3.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
    await shot(o3, "0-owner-card-terms-not-out");
    /* ORD-2: Help says the same to the owner and the team, on a phone */
    await call3("/api/office/team", { method: "POST", body: { email: DEALER, name: "Dana", role: "dealer", lots: ["riverside"] } });
    for (const [who, email] of [["the owner", OWNER], ["a dealer", DEALER]]) {
      const ch = await ctx3(email, { width: 390, height: 844, mobile: true });
      const hp = await pageIn(ch);
      await open3(hp, "/help");
      const answers = await text(hp, "#hp-answers");
      ok(`on older terms: ${who}'s Help (390 wide) says Barnwright can run checks and can't change anything, never "set up your price list" or "Run checks and change"`,
        answers?.includes(WORDS.helpChecks) && !answers.includes(WORDS.helpChange) && !/set up your price list|Run checks and change/.test(answers), answers);
      await shot(hp, `0-${email === OWNER ? "owner" : "dealer"}-390-help-terms-not-out`);
      await ch.close();
    }
    const err3 = o3.errors.filter((e) => !/status of 4\d\d/.test(e));
    ok("no errors on that page", err3.length === 0, err3.join(" | "));
    await c3.close();
    if (!KEEP) { server3.kill(); server3 = null; }
  }
  await call("/__local/barnwright", { method: "POST", body: { terms: "2.2" } });

  section("1. Before live: the owner's banner and the one Barnwright card");
  const ownerCtx = await contextFor(OWNER);
  const owner = await pageIn(ownerCtx);
  await open(owner, "/");
  ok("the closed banner: Barnwright hasn't changed this price list (the owner set it up), so it never says Barnwright is setting up their prices",
    (await text(owner, "#main .banner.warn"))?.startsWith(WORDS.closed) && !(await text(owner, "#main .banner.warn")).includes(WORDS.prelive), await text(owner, "#main .banner"));
  ok("... with Look at the preview and Open to customers",
    (await owner.$$eval("#main .banner.warn a", (els) => els.map((a) => [a.textContent.trim(), a.getAttribute("href"), a.target]))).some(([t, href, target]) => t === "Look at the preview" && href === "/d/riverside/?preview=1" && target === "_blank")
    && (await text(owner, "#main .banner.warn a[href='#/settings']")) === "Open to customers");
  await shot(owner, "1-owner-banner-before-live");
  await open(owner, "/settings");
  const titles = await owner.$$eval(".set-card .card-title", (els) => els.map((e) => e.textContent.trim()));
  ok("Settings has one card called Barnwright, and no Help from Barnwright card", titles.includes("Barnwright") && !titles.some((t) => /Help from Barnwright/.test(t)), titles.join(" | "));
  const card = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  ok("before live: \"Barnwright is setting up your 3D designer...\" with Stop Barnwright's setup access", card?.includes(WORDS.beforeLive) && card.includes("Stop Barnwright's setup access"), card);
  ok("... and with the owner agreed to terms 2.2 the card's own line says Barnwright can change the price list and settings too", card?.includes(WORDS.cardAbout) && !card.includes(WORDS.cardAboutChecks), card);
  {
    const ch = await contextFor(OWNER, { width: 390, height: 844, mobile: true });
    const hp = await pageIn(ch);
    await open(hp, "/help");
    const answers = await text(hp, "#hp-answers");
    ok("... and Help's answer is the one about changing prices (Let Barnwright change your prices), not the checks one", answers?.includes(WORDS.helpChange) && !answers.includes(WORDS.helpChecks), answers);
    await ch.close();
  }
  ok("... and Run checks still works as Help did (its own form, Turn on)", card?.includes("Run checks") && card.includes("Turn on") && !card.includes(WORDS.change), card);
  await owner.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
  await shot(owner, "1-owner-card-before-live");
  /* W1: Run checks on, then Turn off now: setup access goes on, and the words say so */
  await owner.fill(".set-card:has(.card-title:text-is('Barnwright')) input[required]", "Quotes from Riverside aren't arriving");
  await owner.click(".set-card:has(.card-title:text-is('Barnwright')) button[type=submit]");
  await owner.waitForSelector(".set-card:has(.card-title:text-is('Barnwright')) button:has-text('Turn off now')", { timeout: 8000 }).catch(() => {});
  await owner.click(".set-card:has(.card-title:text-is('Barnwright')) button:has-text('Turn off now')");
  await owner.waitForTimeout(1200);
  const offToasts = await owner.$$eval(".toast", (els) => els.map((e) => e.textContent.trim())).catch(() => []);
  const offCard = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  ok("W1: before live, Turn off now says checks are off and Barnwright can still set up the price list", offToasts.includes(WORDS.checksOff) && !offToasts.some((t) => /can't run checks or change anything/.test(t)), offToasts.join(" | "));
  ok("... the card still says Barnwright is setting up, and the log says checks were turned off", offCard?.includes(WORDS.beforeLive) && offCard.includes("turned off Barnwright's checks."), offCard);

  section("2. The preview of a closed 3D designer (F2)");
  const preview = await pageIn(ownerCtx);
  await preview.goto(`${BASE}/d/riverside/?preview=1`);
  await preview.waitForSelector("#previewbar", { timeout: 30000 }).catch(() => {});
  ok("the owner sees the closed lot's 3D designer with the Preview bar", (await text(preview, "#previewbar")) === WORDS.preview, await text(preview, "body"));
  ok("... with no quote form (a preview never takes a quote)", await preview.$eval("#quotecard", (el) => el.hidden || getComputedStyle(el).display === "none").catch(() => false));
  ok("... and no closed message", !(await preview.$("#bootmsg")));
  await preview.waitForTimeout(1500);
  await shot(preview, "2-owner-preview");
  const customerCtx = await contextFor(null);
  const customer = await pageIn(customerCtx);
  await customer.goto(`${BASE}/d/riverside/`);
  ok("a customer still gets the closed page", /isn't open right now/.test(await customer.textContent("body")));
  await customer.goto(`${BASE}/d/riverside/?preview=1`);
  await customer.waitForSelector("#bootmsg", { timeout: 30000 }).catch(() => {});
  ok("a customer who tries ?preview=1 gets no prices, only \"sign in first\"", /Sign in to your Dealer Center first/.test(await text(customer, "#bootmsg") || "") && !(await customer.$("#previewbar")), await text(customer, "body"));

  section("3. Alan's visit: the reduced Dealer Center");
  /* the owner's own Steep roof (7/12, on the Utility Shed only): an option
     that changes how the building is built, which only the owner changes */
  {
    const pl = (await call("/api/office/price-list")).data;
    const settings = structuredClone(pl.settings);
    settings.options.extras.push({ key: "steep-roof", name: "Steep roof", input: "check", price: 350, built: { roofPitch: 7 }, styles: ["UT"] });
    const r = await call("/api/office/price-list", { method: "PUT", body: { settings, version: pl.version } });
    if (r.status !== 200) throw new Error("the owner's Steep roof didn't save: " + JSON.stringify(r.data).slice(0, 300));
  }
  const alanCtx = await contextFor(null);
  const alan = await pageIn(alanCtx);
  await alan.addInitScript(() => { window.__sameLoad = window.__sameLoad || Math.random(); });
  const link = await visitLink();
  await alan.goto(BASE + link);
  await settle(alan);
  ok("the pass leaves the address at once", !alan.url().includes("barnwright=") && /#\/price-list$/.test(alan.url()), alan.url());
  const cookies = await alanCtx.cookies();
  const c = cookies.find((x) => x.name === "__Host-bw_setup");
  ok("the visit's cookie is __Host-bw_setup: HttpOnly, Secure, SameSite Strict, the whole site", !!c && c.httpOnly && c.secure && c.sameSite === "Strict" && c.path === "/", JSON.stringify(c));
  const bar = await text(alan, ".bw-bar");
  /* a visit lasts 8 hours: one started after 4 pm ends tomorrow, and the bar
     says the day too ("until Oct 12 at 12:08 AM", ui/office/words.js
     untilWords) */
  ok("the bar: \"Working on Testing Sheds as Barnwright until <time>.\" with Done", /^Working on Testing Sheds as Barnwright until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\./.test(bar || "") && bar.includes("Done"), bar);
  const nav = await alan.$$eval(".sidenav .nav-item", (els) => els.map((e) => e.textContent.trim()));
  ok("only Price list and Settings", JSON.stringify(nav) === JSON.stringify(["Price list", "Settings"]), nav.join(", "));
  ok("no Customer button, no Help, no person menu, no Today", !(await alan.$(".new-customer")) && !(await alan.$(".topbar-help")) && !(await alan.$(".person")) && !(await alan.$(".termsBanner")));
  await shot(alan, "3-visit-price-list");
  {
    /* HB: How it's built in the visit (server/office/setup-lock.js): the numbers for every building are the owner's */
    const biz = await alan.$("[data-flag='built:biz']");
    const bizText = biz ? (await biz.textContent()).replace(/\s+/g, " ") : "";
    ok("HB: the visit shows How it's built for the whole business with no boxes, and says only the owner can change it (old: boxes the lock refuses)",
      !!biz && (await biz.$$("input, select, textarea, button")).length === 0 && bizText.includes(WORDS.visitBiz), bizText.slice(0, 300));
    await alan.click(".pl-style[data-style='UT'] .pl-style-open");
    const box = await alan.waitForSelector("input[data-field='built:UT:roofPitch']", { timeout: 10000 }).catch(() => null);
    ok("HB: ... while a style's own How it's built boxes are there to change", !!box);
    /* M1: before live the 3D designer is closed to customers, so the Saved
       box's link is the visit's preview (with the design), never the closed
       page customers get */
    await alan.fill("input[data-field='built:UT:wallHeight']", "8 ft");
    await alan.dispatchEvent("input[data-field='built:UT:wallHeight']", "change");
    await alan.waitForTimeout(200);
    await alan.click(".pl-bar .btn-accent");
    await alan.waitForSelector(".pl-saved a.btn", { timeout: 30000 }).catch(() => {});
    const seeIt = await alan.getAttribute(".pl-saved a.btn", "href").catch(() => null);
    ok(`M1: in the visit the Saved box's "See the Utility Shed in the 3D designer" opens the preview with the design (${String(seeIt).slice(0, 48)}…; old: /d/riverside/#d=, the closed page)`,
      /^\/d\/riverside\/\?preview=barnwright#d=/.test(seeIt || "") && /See the Utility Shed in the 3D designer/.test(await text(alan, ".pl-saved") || ""), seeIt);
    if (seeIt) {
      const sv = await pageIn(alanCtx);
      await sv.goto(BASE + seeIt);
      await sv.waitForSelector("#previewbar", { timeout: 30000 }).catch(() => {});
      ok("M1: ... which shows the visit's Preview bar, not the closed page", (await text(sv, "#previewbar")) === WORDS.previewVisit && !/isn't open right now/.test(await sv.textContent("body")), await text(sv, "body"));
      await sv.close();
    }
    /* back to the standard wall, as the rest of this check expects */
    await alan.fill("input[data-field='built:UT:wallHeight']", "");
    await alan.dispatchEvent("input[data-field='built:UT:wallHeight']", "change");
    await alan.waitForTimeout(200);
    await alan.click(".pl-bar .btn-accent");
    await alan.waitForTimeout(1500);
    ok("(the Utility Shed's wall back to the standard)", !(await call("/api/office/price-list")).data?.settings?.offer?.UT?.built);
    /* close it again, as section 4 opens it */
    await alan.click(".pl-style[data-style='UT'] .pl-style-open");
    await alan.waitForSelector("input[data-field='built:UT:roofPitch']", { state: "detached", timeout: 10000 }).catch(() => {});
    /* M4: on the Options tab, an option's roof pitch and where an option
       that changes the building is offered are the owner's (the lock refuses
       them at Save): words, never boxes */
    await alan.click(".tab[data-key='options']");
    await alan.waitForSelector(".pl-extras .pl-extra", { timeout: 10000 }).catch(() => {});
    const extras = (await call("/api/office/price-list")).data.settings.options.extras;
    const steep = extras.findIndex((x) => x.key === "steep-roof"), vent = extras.findIndex((x) => x.key === "ridge-vent");
    const steepRow = alan.locator(".pl-extras .pl-extra").nth(steep), ventRow = alan.locator(".pl-extras .pl-extra").nth(vent);
    const steepText = ((await steepRow.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    ok("M4: in the visit the owner's Steep roof shows its roof pitch and where it is offered as words, with no box, no chips and no Remove (old: a box and chips the lock refuses at Save)",
      steep >= 0 && !(await alan.$(`[data-field='extra:${steep}:roofPitch']`)) && !(await alan.$(`[data-field^='extra:${steep}:style']`))
      && (await steepRow.locator("button[title='Remove']").count()) === 0
      && steepText.includes("Roof pitch at least 7/12") && steepText.includes("Offered only on the Utility Shed.") && steepText.includes(WORDS.visitExtraBuilt), steepText.slice(0, 400));
    const ventText = ((await ventRow.textContent().catch(() => "")) || "").replace(/\s+/g, " ");
    ok("M4: ... an option that doesn't change the building has no roof pitch box to add one, says only the owner can, and keeps its Offered on chips",
      vent >= 0 && !(await alan.$(`[data-field='extra:${vent}:roofPitch']`)) && !!(await alan.$(`[data-field='extra:${vent}:styles']`)) && ventText.includes(WORDS.visitExtraPlain), ventText.slice(0, 400));
    await alan.locator(".pl-extras").screenshot({ path: resolve(OUT, "3-visit-options.png") }).catch(() => {});
    await alan.click(".tab[data-key='buildings']").catch(() => {});
  }
  await alan.goto(`${BASE}/dealer#/settings`);
  await settle(alan);
  const vt = await alan.$$eval(".set-card .card-title", (els) => els.map((e) => e.textContent.trim()));
  ok("Settings in the visit: business, logo, colors, the 3D designer and the quote form; no Barnwright card", ["Your business", "Logo", "Colors", "3D designer", "The quote form"].every((t) => vt.includes(t)) && !vt.includes("Barnwright"), vt.join(" | "));
  ok("... and never Open or Closed", !(await alan.$("input[type=radio][value=suspended]")) && !/Can customers use it\?/.test(await alan.textContent("#main")));
  await shot(alan, "3-visit-settings");
  await alan.goto(`${BASE}/dealer#/customers`);
  await settle(alan);
  ok("W13: any other screen says a visit has only the price list and settings, with the way back to the price list",
    (await alan.textContent("#main")).includes(WORDS.visitOnly) && !/Nothing here|doesn't exist/.test(await alan.textContent("#main")) && !!(await alan.$("#main a[href='#/price-list']")), await text(alan, "#main"));
  const pv = await pageIn(alanCtx);
  await pv.goto(`${BASE}/d/riverside/?preview=barnwright`);
  await pv.waitForSelector("#previewbar", { timeout: 30000 }).catch(() => {});
  ok(`the visit's Look at the preview opens the closed 3D designer as a preview, with words true for Alan: "${WORDS.previewVisit}" (old: the owner's "${WORDS.preview}")`,
    (await text(pv, "#previewbar")) === WORDS.previewVisit, await text(pv, "#previewbar"));
  await pv.close();
  /* only one lot closed while the business is open: the visit's words point
     to the owner's Lots (the answer is changed in the page, as the server
     gives it for a closed lot of an open business) */
  const pvLot = await pageIn(alanCtx);
  await pvLot.route("**/api/office/barnwright/lots/riverside/preview", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, json: { ...(await r.json()), closed: "lot" } });
  });
  await pvLot.goto(`${BASE}/d/riverside/?preview=barnwright`);
  await pvLot.waitForSelector("#previewbar", { timeout: 30000 }).catch(() => {});
  ok(`... and for a closed lot of an open business: "${WORDS.previewVisitLot}"`, (await text(pvLot, "#previewbar")) === WORDS.previewVisitLot, await text(pvLot, "#previewbar"));
  await pvLot.close();

  section("4. A visit that ends while Alan works (F10)");
  await alan.goto(`${BASE}/dealer#/price-list`);
  await settle(alan);
  const marker = await alan.evaluate(() => window.__sameLoad);
  await alan.click(".pl-style[data-style='UT'] .pl-style-open");
  await alan.waitForSelector("input[data-field='size:UT:10x16']");
  await alan.fill("input[data-field='size:UT:10x16']", "5995");
  await alan.waitForTimeout(300);
  await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "stopped" } });
  await alan.click(".pl-bar .btn-accent");
  await alan.waitForSelector(".bw-bar.warn", { timeout: 10000 }).catch(() => {});
  ok("W3: the bar says the visit ended, why (the owner stopped it), and that the changes are kept", (await text(alan, ".bw-bar")) === WORDS.endedStopped, await text(alan, ".bw-bar"));
  ok("the page did not reload and shows no sign-in", (await alan.evaluate(() => window.__sameLoad)) === marker && !(await alan.$(".auth")) && !(await alan.$(".person-pick")));
  ok("the change is still on screen", (await alan.inputValue("input[data-field='size:UT:10x16']")) === "5995");
  const kept = await alan.evaluate(() => JSON.parse(sessionStorage.getItem("dealer-center:barnwright-draft:price-list") || "null"));
  ok("... and kept in this tab", kept?.draft?.offer?.UT?.sizes?.["10x16"] === 5995, JSON.stringify(kept)?.slice(0, 200));
  await shot(alan, "4-visit-ended");
  await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "on" } });
  await alan.goto(BASE + await visitLink());
  await settle(alan);
  await alan.waitForTimeout(500);
  const toastWords = await alan.$$eval(".toast", (els) => els.map((e) => e.textContent)).catch(() => []);
  ok("the next visit brings the change back", /Your changes from before are back/.test(toastWords.join(" ")), toastWords.join(" | "));
  ok("... counted in the bar at the bottom", /1 change/.test((await text(alan, ".pl-bar-count")) || ""), await text(alan, ".pl-bar-count"));
  await alan.click(".pl-bar .btn-accent");
  await alan.waitForTimeout(1500);
  const saved = (await call("/api/office/price-list")).data;
  ok("Save works: saved by Barnwright", saved.settings.offer.UT.sizes["10x16"] === 5995 && saved.savedBy?.id === "barnwright", JSON.stringify(saved.savedBy));
  ok("... and the kept draft is gone", (await alan.evaluate(() => sessionStorage.getItem("dealer-center:barnwright-draft:price-list"))) === null);

  section("4b. COR-2: a kept draft comes back once; Undo changes lets it go");
  {
    const priceBox = "input[data-field='size:UT:10x16']";
    const openUT = async () => { await alan.click(".pl-style[data-style='UT'] .pl-style-open"); await alan.waitForSelector(priceBox); };
    await openUT();
    await alan.fill(priceBox, "6100");
    await alan.waitForTimeout(300);
    await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "stopped" } });
    await alan.click(".pl-bar .btn-accent");
    await alan.waitForSelector(".bw-bar.warn", { timeout: 10000 }).catch(() => {});
    await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "on" } });
    await alan.goto(BASE + await visitLink());
    await settle(alan);
    ok("(the change comes back with the next visit: 1 change)", /1 change/.test((await text(alan, ".pl-bar-count")) || ""), await text(alan, ".pl-bar-count"));
    ok("... and it left this tab's storage as it came back", (await alan.evaluate(() => sessionStorage.getItem("dealer-center:barnwright-draft:price-list"))) === null);
    await alan.click(".pl-bar button:has-text('Undo changes')");
    await alan.waitForSelector("dialog button:has-text('Undo changes')", { timeout: 5000 }).catch(() => {});
    await alan.click("dialog button:has-text('Undo changes')");
    await alan.waitForTimeout(800);
    await openUT();
    ok("Undo changes: the saved price is back and the bar goes", (await alan.inputValue(priceBox)) === "5995" && await alan.$eval(".pl-bar", (el) => el.hidden), await alan.inputValue(priceBox));
    ok("... and nothing is kept in the tab", (await alan.evaluate(() => sessionStorage.getItem("dealer-center:barnwright-draft:price-list"))) === null);
    await alan.reload();
    await settle(alan);
    await openUT();
    ok("... a reload doesn't bring the undone change back", (await alan.inputValue(priceBox)) === "5995" && await alan.$eval(".pl-bar", (el) => el.hidden), await alan.inputValue(priceBox));
  }

  section("4c. COR-8: after a new visit opened in another tab, Save in this tab works and the bar comes back");
  {
    const priceBox = "input[data-field='size:UT:10x16']";
    await alan.fill(priceBox, "6200");
    await alan.waitForTimeout(300);
    await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "stopped" } });
    await alan.click(".pl-bar .btn-accent");
    await alan.waitForSelector(".bw-bar.warn", { timeout: 10000 }).catch(() => {});
    await call("/api/office/barnwright-help", { method: "POST", body: { prelive: "on" } });
    const other = await pageIn(alanCtx);
    await other.goto(BASE + await visitLink());
    await settle(other);
    await other.close();
    await alan.click(".pl-bar .btn-accent");
    await alan.waitForTimeout(1500);
    const saved2 = (await call("/api/office/price-list")).data;
    const bar2 = await text(alan, ".bw-bar");
    ok("Save works: saved by Barnwright", saved2.settings.offer.UT.sizes["10x16"] === 6200 && saved2.savedBy?.id === "barnwright", JSON.stringify(saved2.savedBy));
    ok("... and the bar says who and until when again, with Done", /^Working on Testing Sheds as Barnwright until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\./.test(bar2 || "") && bar2.includes("Done") && !(await alan.$(".bw-bar.warn")), bar2);
  }

  section("5. Done");
  await alan.click(".bw-bar .btn-primary");
  await alan.waitForSelector(".bw-card", { timeout: 10000 }).catch(() => {});
  ok("Done: the visit ends, \"You can close this tab.\"", /You can close this tab\./.test((await text(alan, ".bw-card")) || ""), await text(alan, "body"));
  ok("... the cookie is gone", !(await alanCtx.cookies()).some((x) => x.name === "__Host-bw_setup"));
  await shot(alan, "5-visit-done");
  const expired = await pageIn(await contextFor(null));
  await expired.goto(BASE + link);
  await expired.waitForSelector(".bw-card", { timeout: 15000 }).catch(() => {});
  ok("the first link again (its pass used): \"This link ran out. Tap Open their price list again.\", never a sign-in",
    /This link ran out\. Tap Open their price list again\./.test((await text(expired, ".bw-card")) || "") && !(await expired.$(".person-pick")), await text(expired, "body"));

  section("6. Open to customers asks first (D2)");
  await open(owner, "/");
  ok("now that Barnwright saved their price list, the owner's closed banner says Barnwright is setting up their prices", (await text(owner, "#main .banner.warn"))?.includes(WORDS.prelive), await text(owner, "#main .banner"));
  await shot(owner, "6-owner-banner-after-barnwright");
  await open(owner, "/settings");
  await owner.check("input[type=radio][value=active]");
  await owner.click(".set-bar .btn-accent");
  await owner.waitForSelector(".dialog, dialog", { timeout: 5000 }).catch(() => {});
  const confirmText = await owner.$$eval("dialog, .dialog", (els) => els.map((e) => e.textContent).join(" ")).catch(() => "");
  ok("the confirm says: \"Opening ends Barnwright's setup access...\"", confirmText.includes(WORDS.opening), confirmText.slice(0, 300));
  await shot(owner, "6-open-confirm");
  const yes = await owner.$("dialog button.btn-primary, .dialog button.btn-primary, dialog button:has-text('Open to customers')");
  await yes?.click();
  await owner.waitForTimeout(1500);
  ok("... and opening saves (live from now on)", (await call("/api/office/price-list")).data.settings.status === "active",
    `${yes ? "yes found" : "no yes button"}; bar: ${await text(owner, ".set-bar")}; toasts: ${await owner.$$eval(".toast", (els) => els.map((e) => e.textContent).join(" | "))}`);
  const opened = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  ok("E2E-4: on the same page, without reloading, the Barnwright card already offers the owner's switch, never \"Barnwright is setting up\"",
    opened?.includes("Off. Barnwright can't run checks or change your price list or settings.") && opened.includes(WORDS.change) && !opened.includes(WORDS.beforeLive)
    && !opened.includes("Stop Barnwright's setup access") && !!(await owner.$(".set-card:has(.card-title:text-is('Barnwright')) input[type=radio][value=change]")), opened);

  section("7. After live: the owner's switch");
  await open(owner, "/settings");
  const after = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  ok("off: \"Off. Barnwright can't run checks or change your price list or settings.\" and the one choice", after?.includes("Off. Barnwright can't run checks or change your price list or settings.")
    && after.includes("Run checks") && after.includes(WORDS.change) && !after.includes("Stop Barnwright's setup access"), after);
  await owner.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
  await shot(owner, "7-owner-card-after-live");
  await owner.check(`.set-card:has(.card-title:text-is('Barnwright')) input[type=radio][value=change]`);
  await owner.fill(".set-card:has(.card-title:text-is('Barnwright')) input[required]", "New 2027 prices");
  await owner.click(".set-card:has(.card-title:text-is('Barnwright')) button[type=submit]");
  await owner.waitForTimeout(1500);
  const on = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  /* the switch lasts 4 hours: turned on after 8 pm it ends tomorrow, and the
     card, log line and banner say the day too */
  ok("on:\"Barnwright can change your price list and settings until <time>.\" with Turn off now", /Barnwright can change your price list and settings until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\./.test(on || "") && on.includes("Turn off now"), on);
  ok("... and the log line, no time inside the words", /let Barnwright run checks and change the price list and settings for 4 hours: New 2027 prices \(until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\)/.test(on || ""), on);
  ok("W12: a visit's log line has no end time after its period", /opened your price list\./.test(on || "") && !/opened your price list\. \(until/.test(on || ""), on);
  await owner.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
  await shot(owner, "7-owner-card-on");
  await open(owner, "/");
  const banner = await text(owner, "#main .banner.setup-switch");
  ok("the owner's banner: \"Barnwright can change your price list and settings until <time>.\" with Turn off", /^Barnwright can change your price list and settings until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\.\s*Turn off$/.test(banner || ""), banner);
  await shot(owner, "7-owner-banner-on");
  await owner.click("#main .banner.setup-switch button");
  await owner.waitForTimeout(1200);
  ok("Turn off: the banner goes", !(await owner.$("#main .banner.setup-switch")));
  const manager = (await call("/api/office/me", { email: OWNER })).data.setup;
  ok("(me.setup is back to closed)", manager?.mode === null, JSON.stringify(manager));
  /* W7: a closed lot of an open business: its preview points to Lots */
  await call("/api/office/lots", { method: "POST", body: { name: "Northside", phone: "941-555-0150" } });
  await call("/api/office/lots/northside", { method: "PATCH", body: { active: false } });
  const lotPreview = await pageIn(ownerCtx);
  await lotPreview.goto(`${BASE}/d/northside/?preview=1`);
  await lotPreview.waitForSelector("#previewbar", { timeout: 30000 }).catch(() => {});
  ok("W7: a closed lot of an open business: \"Preview. Your customers can't see this lot until you open it in Lots.\"", (await text(lotPreview, "#previewbar")) === WORDS.previewLot, await text(lotPreview, "#previewbar"));
  await lotPreview.close();

  section("8. A visit on a phone");
  await call("/api/office/barnwright-help", { method: "POST", body: { on: true, level: "change", reason: "Phone check", hours: 1 } });
  const phoneCtx = await contextFor(null, { width: 390, height: 844, mobile: true });
  const phone = await pageIn(phoneCtx);
  await phone.goto(BASE + await visitLink());
  await settle(phone);
  const wide = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok("the bar and the price list fit a phone, with no sideways scrolling", !wide && /until/.test((await text(phone, ".bw-bar")) || ""));
  const tabs = await phone.$$eval(".tabbar .tab-item", (els) => els.map((e) => e.textContent.trim()));
  ok("the phone's tab bar has only Price list and Settings", JSON.stringify(tabs) === JSON.stringify(["Price list", "Settings"]), tabs.join(", "));
  const barButtons = await phone.$$eval(".bw-bar .btn", (els) => els.map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]));
  ok("W9: on a phone the bar's Done and Look at the preview are full touch size (44 px)", barButtons.length >= 2 && barButtons.every(([, hgt]) => hgt >= 44), JSON.stringify(barButtons));
  await shot(phone, "8-visit-phone");
  const ownerPhone = await pageIn(await contextFor(OWNER, { width: 390, height: 844, mobile: true }));
  await ownerPhone.goto(`${BASE}/dealer#/`);
  await settle(ownerPhone);
  const offButton = await ownerPhone.$$eval("#main .banner.setup-switch .btn", (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  ok("W9: ... and the owner's Turn off in the banner too", offButton.length === 1 && offButton[0] >= 44, JSON.stringify(offButton));
  await shot(ownerPhone, "8-owner-banner-phone");

  section("9. Before the owner first signs in");
  {
    rmSync(resolve(ROOT, DATA2), { recursive: true, force: true });
    server2 = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--empty", "--control-room", "--port", String(PORT2), "--data", DATA2], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let log2 = "";
    server2.stdout.on("data", (d) => { log2 += d; });
    server2.stderr.on("data", (d) => { log2 += d; });
    for (let i = 0; i < 120 && !/is running/.test(log2); i++) await new Promise((r) => setTimeout(r, 250));
    ok("(a second local Dealer Center, just made: connected, on the terms 2.2 this copy ships, nobody signed in)", /is running/.test(log2), log2.slice(-400));
    const call2 = async (path, { method = "GET", body, email = OWNER } = {}) => {
      const r = await fetch(BASE2 + path, {
        method, headers: { ...(email ? { cookie: `dealer_local_user=${encodeURIComponent(email)}` } : {}), origin: BASE2, "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    const ctx2 = async (email, opts = {}) => {
      const c2 = await browser.newContext({ viewport: { width: opts.width || 1280, height: opts.height || 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
      await c2.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
      if (email) await c2.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: BASE2 }]);
      return c2;
    };
    const link2 = (await call2("/__local/barnwright", { method: "POST", email: null, body: { visit: true, signup: true } })).data?.url;
    const alan2 = await pageIn(await ctx2(null));
    await alan2.goto(BASE2 + link2);
    await settle(alan2);
    await alan2.waitForSelector(".pl-style", { timeout: 15000 }).catch(() => {});
    const bar9 = await text(alan2, ".bw-bar");
    const styles = await alan2.$$eval(".pl-style", (els) => els.length).catch(() => 0);
    ok("Alan's visit with the owner's sign-up agreement starts the price list and opens on it: the bar, and Every standard building (23 styles)",
      /^Working on Testing Sheds as Barnwright until (?:[A-Z][a-z]{2} \d{1,2} at )?\d{1,2}:\d{2} [AP]M\./.test(bar9 || "") && styles === 23 && /#\/price-list$/.test(alan2.url()), `${bar9} | ${styles} styles | ${alan2.url()}`);
    await shot(alan2, "9-visit-before-sign-in");
    await alan2.click(".pl-style[data-style='UT'] .pl-style-open");
    await alan2.waitForSelector("input[data-field='size:UT:10x16']");
    await alan2.fill("input[data-field='size:UT:10x16']", "5995");
    await alan2.waitForTimeout(300);
    await alan2.click(".pl-bar .btn-accent");
    await alan2.waitForTimeout(1500);
    const pl9 = await alan2.evaluate(() => fetch("/api/office/barnwright/price-list").then((r) => r.json()));
    ok("... and Alan saves a change in it (version 2, by Barnwright), before anyone has signed in",
      pl9?.version === 2 && pl9.settings?.offer?.UT?.sizes?.["10x16"] === 5995 && pl9.savedBy?.id === "barnwright", JSON.stringify([pl9?.version, pl9?.savedBy]));
    const owner2 = await pageIn(await ctx2(OWNER));
    /* an old bookmark to First setup: it opens Today */
    await owner2.goto(`${BASE2}/dealer#/setup`);
    await settle(owner2);
    await owner2.waitForSelector(".gs-card", { timeout: 15000 }).catch(() => {});
    const card9 = await text(owner2, ".gs-card");
    ok("the owner's first sign-in opens Today right away (an old #/setup link too): no setup screens, the Getting started card on top",
      /#\/$/.test(owner2.url()) && !(await owner2.$(".setup-page")) && !!(await owner2.$(".crm-today")) && card9?.includes(WORDS.gsTitle) && card9.includes(WORDS.gsReady), `${owner2.url()} | ${card9}`);
    ok("... Check your prices says Barnwright set up the price list", card9?.includes("Check your prices") && card9.includes(WORDS.gsBarnwright), card9);
    ok("... and no terms line on top: the agreement from their sign-up page is theirs (terms 2.2)", !(await owner2.$(".banner.terms")) && (await call2("/api/office/me")).data?.terms?.agreed?.from === "signup");
    const lots9 = (await call2("/api/office/lots")).data?.lots || [];
    ok("... their first lot is made, named after the business (Testing Sheds)", lots9.length === 1 && lots9[0].name === "Testing Sheds" && lots9[0].slug === "testing-sheds", JSON.stringify(lots9));
    await shot(owner2, "9-first-sign-in-today");
    const after9 = (await call2("/api/office/price-list")).data;
    ok("the owner finds Alan's work kept exactly (the Utility Shed 10x16 at $5,995, still version 2, saved by Barnwright)",
      after9?.settings?.offer?.UT?.sizes?.["10x16"] === 5995 && after9.version === 2 && after9.savedBy?.id === "barnwright", JSON.stringify([after9?.version, after9?.savedBy, after9?.settings?.offer?.UT?.sizes]));
    await owner2.goto("about:blank");
    await owner2.goto(`${BASE2}/dealer#/settings`);
    await settle(owner2);
    const bw9 = await text(owner2, ".set-card:has(.card-title:text-is('Barnwright'))");
    ok("Settings, Barnwright: setting up, with Stop Barnwright's setup access, the log starts with Barnwright's start and change, and who agreed on their sign-up page",
      bw9?.includes(WORDS.beforeLive) && bw9.includes("Stop Barnwright's setup access") && bw9.includes(WORDS.startLine) && bw9.includes("changed your price list") && /Pat Owner agreed to the Barnwright Terms and Conditions \(version 2\.2\) on their sign-up page on /.test(bw9), bw9);
    await owner2.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
    await shot(owner2, "9-owner-card-after-first-sign-in");
    const err9 = [alan2, owner2].flatMap((p) => p.errors).filter((e) => !/status of 4\d\d/.test(e));
    ok("no errors in those pages", err9.length === 0, err9.join(" | "));
  }

  /* the customer's ?preview=1 was refused on purpose (401): that one line is expected */
  const errors = [owner, alan, customer, phone, ownerPhone].flatMap((p) => p.errors).filter((e) => !/preview \(the server said 401\)/.test(e));
  ok("no errors in any page (but the customer's refused preview)", errors.length === 0, errors.join(" | "));
} catch (e) {
  fail++;
  failures.push("the check stopped: " + (e.stack || e.message));
  console.log("    FAIL the check stopped: " + (e.stack || e.message));
} finally {
  await browser.close();
  if (!KEEP) { server.kill(); server2?.kill(); server3?.kill(); }
  else console.log(`\n  The local Dealer Center is still running at ${BASE}/dealer (stop it with Ctrl+C).`);
}

console.log("");
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} setup access screen checks failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PROVED (${pass} checks): before live the one Barnwright card says Barnwright is setting up, and the owner's closed banner says Barnwright is setting up their prices only once Barnwright changed them (its button Open to customers), with a preview of the closed 3D designer that customers can't open; Alan's visit clears the pass from the address, gets a __Host- cookie, and shows only Price list and Settings without Open or Closed; a visit that ends keeps the draft in the tab and the next visit saves it; Done ends it; opening asks first; after live the card offers Run checks or Run checks and change, and the owner's banner says until when with Turn off; it all fits a phone. Pictures: test/out/setup-screens/.`);
