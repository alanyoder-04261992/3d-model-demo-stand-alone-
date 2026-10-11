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
     and the review's fixes: a kept draft comes back once (Undo changes
     lets it go), a new visit opened in another tab brings the bar back,
     the visit's words say why it ended, Turn off before live says that
     setup access goes on, the card says so when terms 2.2 aren't out yet,
     a closed lot's preview points to Lots, and the log's end time reads
     right.

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

const WORDS = {
  prelive: "Barnwright is setting up your prices. Look at the preview, check it with Alan, then open it to customers in Settings.",
  beforeLive: "Barnwright is setting up your 3D designer. Until you open it to customers, they can change your price list and settings for you. Every change is listed here and in Price list, History.",
  preview: "Preview. Your customers can't see this until you open it in Settings.",
  ended: "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.",
  endedStopped: "Your Barnwright visit ended. The owner stopped Barnwright's setup access in Settings, Barnwright. Your changes are kept in this tab.",
  checksOff: "Checks are off. Barnwright can still set up your price list until you open it. To stop that too, tap Stop Barnwright's setup access.",
  termsNotOut: "Barnwright's new terms (2.2) aren't out yet, so Barnwright can only run checks for now.",
  previewLot: "Preview. Your customers can't see this lot until you open it in Lots.",
  visitOnly: "A Barnwright visit has only the price list and settings.",
  opening: "Opening ends Barnwright's setup access. After this, Barnwright needs your switch to change your prices.",
  change: "Run checks and change my price list and settings",
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
  /* a new business, connected, First setup done, one lot, the owner on terms 2.2 */
  await call("/api/office/me");
  const setup = await call("/api/office/setup", { method: "POST", body: { businessName: "Testing Sheds", phone: "941-555-0100", start: "small", agreeTerms: true } });
  const lot = await call("/api/office/lots", { method: "POST", body: { name: "Riverside", phone: "941-555-0140" } });
  if (setup.status !== 201 || lot.status !== 201) throw new Error("setting up the business failed: " + JSON.stringify([setup, lot]));

  section("0. W2: before terms 2.2 are out, the card doesn't promise setup access");
  {
    const st = (await call("/api/office/barnwright-help")).data.setup;
    const c0 = await contextFor(OWNER);
    const o0 = await pageIn(c0);
    await open(o0, "/settings");
    const card0 = await text(o0, ".set-card:has(.card-title:text-is('Barnwright'))");
    if (st.termsOut === false) {
      ok("terms 2.2 aren't out yet: one line says so, with no setup access words, no Stop and no change choice",
        card0?.includes(WORDS.termsNotOut) && !card0.includes(WORDS.beforeLive) && !card0.includes("Stop Barnwright's setup access") && !card0.includes(WORDS.change)
        && !card0.includes("Agree to the new terms") && card0.includes("Turn on"), card0);
      await o0.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
      await shot(o0, "0-owner-card-terms-not-out");
    } else {
      ok("terms 2.2 are out, and First setup agreed to them: the card says Barnwright is setting up", st.termsOk === true && card0?.includes(WORDS.beforeLive), card0);
    }
    await c0.close();
  }
  await call("/__local/barnwright", { method: "POST", body: { terms: "2.2" } });

  section("1. Before live: the owner's banner and the one Barnwright card");
  const ownerCtx = await contextFor(OWNER);
  const owner = await pageIn(ownerCtx);
  await open(owner, "/");
  ok("the closed banner says Barnwright is setting up their prices", (await text(owner, "#main .banner.warn"))?.includes(WORDS.prelive), await text(owner, "#main .banner"));
  ok("... with Look at the preview and Open for customers",
    (await owner.$$eval("#main .banner.warn a", (els) => els.map((a) => [a.textContent.trim(), a.getAttribute("href"), a.target]))).some(([t, href, target]) => t === "Look at the preview" && href === "/d/riverside/?preview=1" && target === "_blank")
    && !!(await owner.$("#main .banner.warn a[href='#/settings']")));
  await shot(owner, "1-owner-banner-before-live");
  await open(owner, "/settings");
  const titles = await owner.$$eval(".set-card .card-title", (els) => els.map((e) => e.textContent.trim()));
  ok("Settings has one card called Barnwright, and no Help from Barnwright card", titles.includes("Barnwright") && !titles.some((t) => /Help from Barnwright/.test(t)), titles.join(" | "));
  const card = await text(owner, ".set-card:has(.card-title:text-is('Barnwright'))");
  ok("before live: \"Barnwright is setting up your 3D designer...\" with Stop Barnwright's setup access", card?.includes(WORDS.beforeLive) && card.includes("Stop Barnwright's setup access"), card);
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
  ok("the bar: \"Working on Testing Sheds as Barnwright until <time>.\" with Done", /^Working on Testing Sheds as Barnwright until \d{1,2}:\d{2} [AP]M\./.test(bar || "") && bar.includes("Done"), bar);
  const nav = await alan.$$eval(".sidenav .nav-item", (els) => els.map((e) => e.textContent.trim()));
  ok("only Price list and Settings", JSON.stringify(nav) === JSON.stringify(["Price list", "Settings"]), nav.join(", "));
  ok("no Customer button, no Help, no person menu, no Today", !(await alan.$(".new-customer")) && !(await alan.$(".topbar-help")) && !(await alan.$(".person")) && !(await alan.$(".termsBanner")));
  await shot(alan, "3-visit-price-list");
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
  ok("the visit's Look at the preview opens the closed 3D designer as a preview", (await text(pv, "#previewbar")) === WORDS.preview);
  await pv.close();

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
    ok("... and the bar says who and until when again, with Done", /^Working on Testing Sheds as Barnwright until \d{1,2}:\d{2} [AP]M\./.test(bar2 || "") && bar2.includes("Done") && !(await alan.$(".bw-bar.warn")), bar2);
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
  ok("on: \"Barnwright can change your price list and settings until <time>.\" with Turn off now", /Barnwright can change your price list and settings until \d{1,2}:\d{2} [AP]M\./.test(on || "") && on.includes("Turn off now"), on);
  ok("... and the log line, no time inside the words", /let Barnwright run checks and change the price list and settings for 4 hours: New 2027 prices \(until \d{1,2}:\d{2} [AP]M\)/.test(on || ""), on);
  ok("W12: a visit's log line has no end time after its period", /opened your price list\./.test(on || "") && !/opened your price list\. \(until/.test(on || ""), on);
  await owner.$eval(".set-card:has(.card-title:text-is('Barnwright'))", (el) => el.scrollIntoView());
  await shot(owner, "7-owner-card-on");
  await open(owner, "/");
  const banner = await text(owner, "#main .banner.setup-switch");
  ok("the owner's banner: \"Barnwright can change your price list and settings until <time>.\" with Turn off", /^Barnwright can change your price list and settings until \d{1,2}:\d{2} [AP]M\.\s*Turn off$/.test(banner || ""), banner);
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

  /* the customer's ?preview=1 was refused on purpose (401): that one line is expected */
  const errors = [owner, alan, customer, phone, ownerPhone].flatMap((p) => p.errors).filter((e) => !/preview \(the server said 401\)/.test(e));
  ok("no errors in any page (but the customer's refused preview)", errors.length === 0, errors.join(" | "));
} catch (e) {
  fail++;
  failures.push("the check stopped: " + (e.stack || e.message));
  console.log("    FAIL the check stopped: " + (e.stack || e.message));
} finally {
  await browser.close();
  if (!KEEP) server.kill();
  else console.log(`\n  The local Dealer Center is still running at ${BASE}/dealer (stop it with Ctrl+C).`);
}

console.log("");
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} setup access screen checks failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PROVED (${pass} checks): before live the owner's banner and one Barnwright card say Barnwright is setting up their prices, with a preview of the closed 3D designer that customers can't open; Alan's visit clears the pass from the address, gets a __Host- cookie, and shows only Price list and Settings without Open or Closed; a visit that ends keeps the draft in the tab and the next visit saves it; Done ends it; opening asks first; after live the card offers Run checks or Run checks and change, and the owner's banner says until when with Turn off; it all fits a phone. Pictures: test/out/setup-screens/.`);
