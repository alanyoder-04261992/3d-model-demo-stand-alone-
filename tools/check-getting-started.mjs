/* CHECK: A NEW OWNER'S FIRST SIGN-IN OPENS TODAY RIGHT AWAY, WITH THE
   GETTING STARTED CARD (Alan, Oct 12 2026: "When a new customer owner first
   log in does it still do this because I think it's point less should just
   open to home page right away"; server/office/first-start.js,
   ui/office/views/getting-started.js).
   Run: node tools/check-getting-started.mjs [--keep]
   check-all: browser

   It starts four local Dealer Centers (tools/office-local.mjs --empty, a
   new business nobody has signed in to), opens Chromium at 1280 and 390
   wide, and proves:

     A. connected to a pretend control room, as if it shipped terms 2.2, and
        the Control Room's status pass already brought the owner's sign-up
        (business name, phone, email and their "I agree"): the owner's
        first sign-in opens Today at once, with no setup screens and no
        terms line on top; the business, its price list (closed to
        customers) and one lot named after the business are there; the
        Getting started card is black and gold, fits a phone with no
        sideways scrolling and full-size taps, and each step links to the
        right screen (Look at the preview opens the preview in a new tab
        and ticks itself); no closed banner above the card on Today, and
        on the price list the closed banner never says Barnwright is
        setting up prices the owner's own start made (its button: Open to
        customers); opening to customers ticks Open to customers; Hide this
        list hides it, and it stays hidden after a reload; a manager never
        sees the card;
     B. not connected (Alan's own kind of Dealer Center): Today asks for
        the business name first (no "all caught up" line), and Price list
        and Settings say to type it on Today with Go to Today; Start makes
        the business, its price list and first lot, and the card shows its
        steps; the closed banner's Look at the preview on Lots ticks the
        card's step;
     C. connected, but no pass brought a sign-up: Today asks for the
        business name, and the "I have read and agree" line is on top;
     D. the account is switched off: the start fails for another reason
        than the name, and the card says why with Try again, and asks for
        no business name.

   Pictures go to test/out/getting-started/. --keep leaves the servers running. */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out/getting-started");
const PORT = Number(process.env.GETTING_STARTED_PORT || 9420);
const KEEP = process.argv.includes("--keep");
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");
const OWNER = "owner@example.com";
const MANAGER = "sam@example.com";

/* the card's words (ui/office/views/getting-started.js GETTING_STARTED_WORDS) */
const WORDS = {
  title: "Getting started",
  ready: "Your Dealer Center is ready. Your 3D designer stays closed to customers until you open it.",
  name: "Type your business name to start. Your price list and your first lot are made from it.",
  prices: "Every price is an example. Switch off the buildings you don't sell and type your own prices.",
  hide: "Hide this list",
  agree: "I have read and agree to the Barnwright Terms and Conditions",
  left: "Here is what is left to set up.",
  caughtUp: "You're all caught up. Nice work.",
  /* the closed banner (ui/office/main.js CLOSED_WORDS, PRELIVE_WORDS) */
  closed: "Your 3D designer links are closed to customers. Check your prices, then open them in Settings.",
  prelive: "Barnwright is setting up your prices.",
  /* Price list and Settings before there is a business (main.js NO_BUSINESS) */
  noBusiness: "No price list yet",
  noBusinessOwner: "Your price list and settings are made from your business name. Type it on Today, then come back here.",
  failed: "Your Dealer Center couldn't get ready",
};

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("    ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("    FAIL " + name + (extra ? " -- " + String(extra).slice(0, 400) : "")); }
}
const section = (t) => console.log("\n  " + t);

mkdirSync(OUT, { recursive: true });
const servers = [];
async function startServer(port, data, extra) {
  rmSync(resolve(ROOT, data), { recursive: true, force: true });
  const proc = spawn(process.execPath, ["tools/office-local.mjs", "--reset", "--empty", ...extra, "--port", String(port), "--data", data], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  servers.push(proc);
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  for (let i = 0; i < 160 && !/is running/.test(log); i++) await new Promise((r) => setTimeout(r, 250));
  if (!/is running/.test(log)) throw new Error(`the local Dealer Center on ${port} did not start:\n${log}`);
  const base = `http://127.0.0.1:${port}`;
  const call = async (path, { method = "GET", body, email = OWNER, raw, headers = {} } = {}) => {
    const r = await fetch(base + path, {
      method, headers: { ...(email ? { cookie: `dealer_local_user=${encodeURIComponent(email)}` } : {}), origin: base, "content-type": "application/json", ...headers },
      body: raw ?? (body ? JSON.stringify(body) : undefined),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  return { base, call, log: () => log };
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
async function pageFor(base, email, { width = 1280, height = 900, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", isMobile: mobile, hasTouch: mobile });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  if (email) await context.addCookies([{ name: "dealer_local_user", value: encodeURIComponent(email), url: base }]);
  const page = await context.newPage();
  page.errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 4(01|03|09|22|23)/.test(m.text())) page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push("page error: " + e.message));
  page.on("dialog", (d) => d.accept());
  return page;
}
async function settle(page) {
  await page.waitForSelector("#main", { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector("#main .loading"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
}
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const shot = (page, name) => page.screenshot({ path: resolve(OUT, name + ".png"), fullPage: true });
/* no sideways scrolling, and the card's taps full size (44 px) */
const fits = (page) => page.evaluate(() => {
  const wide = document.documentElement.scrollWidth - window.innerWidth;
  const small = [...document.querySelectorAll(".gs-card a, .gs-card button")].filter((el) => el.getBoundingClientRect().height < 44).map((el) => el.textContent.trim().slice(0, 40));
  const out = [...document.querySelectorAll(".gs-card *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1).map((el) => el.className || el.tagName);
  return { wide, small, out: out.slice(0, 5) };
});
const steps = (page) => page.$$eval(".gs-step", (els) => els.map((li) => ({
  id: li.dataset.step, done: li.classList.contains("done"), title: li.querySelector("strong")?.textContent.trim(),
  href: li.querySelector("a")?.getAttribute("href"), target: li.querySelector("a")?.getAttribute("target") || "",
}))).catch(() => []);

try {
  /* ======================================================================== */
  section("A. The owner's first sign-in, with their sign-up already brought (connected, terms 2.2)");
  {
    const A = await startServer(PORT, "test/out/getting-started-data-a", ["--control-room", "--terms-version", "2.2"]);
    /* the Control Room's status pass, right after Make their Dealer Center: it carries the sign-up */
    const door = (await A.call("/__local/barnwright", { method: "POST", email: null, body: { door: { action: "status" }, signup: true } })).data?.door;
    const st = await fetch(A.base + "/.netlify/functions/barnwright-setup", { method: "POST", headers: { authorization: `Bearer ${door?.pass}`, "content-type": "application/json" }, body: door?.body });
    const stBody = await st.json().catch(() => null);
    ok("(the Control Room's status pass brought the owner's sign-up before anyone signed in: prelive on it, no price list)", st.status === 200 && stBody?.agreement === "signup" && stBody.priceList === null, JSON.stringify(stBody).slice(0, 300));

    const owner = await pageFor(A.base, OWNER);
    await owner.goto(`${A.base}/dealer`);
    await settle(owner);
    await owner.waitForSelector(".gs-card .gs-step", { timeout: 20000 }).catch(() => {});
    const card = await text(owner, ".gs-card");
    ok("the first sign-in opens Today right away: the Today screen, no setup screens, the address /dealer (Today)",
      !!(await owner.$(".crm-today")) && !(await owner.$(".setup-page")) && /\/dealer(#\/)?$/.test(owner.url()), owner.url());
    ok("... with the Getting started card at the top, saying the Dealer Center is ready and the 3D designer stays closed",
      card?.startsWith(WORDS.title) && card.includes(WORDS.ready) && card.includes(WORDS.hide), card);
    ok("... no \"I have read and agree\" line on top: the agreement from their sign-up page is theirs", !(await owner.$(".banner.terms")));
    ok("... and no closed-to-customers banner above the card either (the card says it, with Look at the preview and Open to customers)", !(await owner.$("#main > .banner.warn")), await text(owner, "#main > .banner"));
    const headLine = await text(owner, ".crm-today-head .page-titles > p:not(.crm-eyebrow)");
    ok("... and the line under the greeting says what the card is for, never \"You're all caught up\"", headLine === WORDS.left, headLine);
    ok("... the business from their sign-up at the top (Testing Sheds)", (await text(owner, ".topbar .brand-words strong")) === "Testing Sheds", await text(owner, ".topbar .brand-words"));
    const me = (await A.call("/api/office/me")).data;
    const pl = (await A.call("/api/office/price-list")).data;
    ok("... their price list is Every standard building, version 1, closed to customers, with the sign-up's phone and email",
      pl?.version === 1 && pl.settings.status === "suspended" && Object.keys(pl.settings.offer).length === 23 && pl.settings.brand.phone === "941-555-0100" && pl.settings.brand.email === OWNER, JSON.stringify([pl?.version, pl?.settings?.brand]));
    ok("... one lot, named after the business; terms agreed from the sign-up page", me.lots.length === 1 && me.lots[0].name === "Testing Sheds" && me.lots[0].slug === "testing-sheds" && me.terms?.agreed?.from === "signup", JSON.stringify([me.lots, me.terms]));
    const s1 = await steps(owner);
    const want = { prices: "#/price-list", look: "#/settings", lots: "#/lots", team: "#/team", preview: "/d/testing-sheds/?preview=1", open: "#/settings" };
    ok("the card's steps, in order, none done yet: Check your prices, logo and colors, other lots (the plan has 3), team, preview, Open to customers",
      JSON.stringify(s1.map((x) => x.id)) === JSON.stringify(Object.keys(want)) && s1.every((x) => !x.done), JSON.stringify(s1));
    ok("... each one a link to the screen that does it (the preview in a new tab)", s1.every((x) => x.href === want[x.id]) && s1.find((x) => x.id === "preview")?.target === "_blank", JSON.stringify(s1.map((x) => [x.id, x.href, x.target])));
    ok("... Check your prices says every price is an example; the other lots say what the plan includes", card?.includes(WORDS.prices) && card.includes("Your plan includes 3 open lots. 1 is open now."), card);
    const style = await owner.$eval(".gs-top", (el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el.querySelector("h2")).color]).catch(() => []);
    ok("... black and gold: a black band with the gold title", style[0] === "rgb(22, 19, 14)" && style[1] === "rgb(226, 190, 78)", JSON.stringify(style));
    let f = await fits(owner);
    ok("... at 1280 wide nothing runs off the screen, and every tap is full size", f.wide <= 0 && !f.small.length && !f.out.length, JSON.stringify(f));
    await shot(owner, "a-first-sign-in-1280");

    const phone = await pageFor(A.base, OWNER, { width: 390, height: 844, mobile: true });
    await phone.goto(`${A.base}/dealer`);
    await settle(phone);
    await phone.waitForSelector(".gs-card .gs-step", { timeout: 20000 }).catch(() => {});
    f = await fits(phone);
    ok("on a phone (390 wide): the card fits, no sideways scrolling, every tap at least 44 px", !!(await phone.$(".gs-card")) && f.wide <= 0 && !f.small.length && !f.out.length, JSON.stringify(f));
    await shot(phone, "a-first-sign-in-390");

    /* each link goes where it says */
    await owner.click(".gs-step[data-step='prices'] a");
    await owner.waitForFunction(() => location.hash === "#/price-list", null, { timeout: 10000 }).catch(() => {});
    ok("tapping Check your prices opens the price list", /#\/price-list$/.test(owner.url()), owner.url());
    await settle(owner);
    const plBanner = await text(owner, "#main > .banner.warn");
    ok("... where the closed banner shows: the price list is the owner's own start's, so it never says Barnwright is setting up their prices; its button is Open to customers",
      plBanner?.startsWith(WORDS.closed) && !plBanner.includes(WORDS.prelive) && (await text(owner, "#main > .banner.warn a[href='#/settings']")) === "Open to customers", plBanner);
    await owner.goBack();
    await settle(owner);
    await owner.click(".gs-step[data-step='team'] a");
    await owner.waitForFunction(() => location.hash === "#/team", null, { timeout: 10000 }).catch(() => {});
    ok("tapping Add your team opens Team", /#\/team$/.test(owner.url()), owner.url());
    await owner.goBack();
    await settle(owner);
    const [preview] = await Promise.all([
      owner.context().waitForEvent("page", { timeout: 15000 }).catch(() => null),
      owner.click(".gs-step[data-step='preview'] a"),
    ]);
    await owner.waitForSelector(".gs-step[data-step='preview'].done", { timeout: 10000 }).catch(() => {});
    ok("Look at the preview opens the lot's preview in a new tab, and ticks itself", !!preview && /\/d\/testing-sheds\/\?preview=1$/.test(preview.url()) && !!(await owner.$(".gs-step[data-step='preview'].done")), preview?.url());
    await preview?.close();
    await owner.reload();
    await settle(owner);
    ok("... and stays ticked after a reload", !!(await owner.$(".gs-step[data-step='preview'].done")) && /1 of 6 done/.test((await text(owner, ".gs-count")) || ""), await text(owner, ".gs-count"));

    /* opening to customers ticks Open to customers (and Check your prices) */
    const now = (await A.call("/api/office/price-list")).data;
    const opened = await A.call("/api/office/price-list", { method: "PUT", body: { settings: { ...now.settings, status: "active" }, version: now.version } });
    await owner.goto("about:blank");
    await owner.goto(`${A.base}/dealer#/`);
    await settle(owner);
    const s2 = await steps(owner);
    ok("once the owner opens the 3D designer to customers, Open to customers ticks itself (and Check your prices)", opened.status === 200 && s2.find((x) => x.id === "open")?.done && s2.find((x) => x.id === "prices")?.done, JSON.stringify(s2));

    /* a manager never sees it */
    await A.call("/api/office/team", { method: "POST", body: { email: MANAGER, name: "Sam", role: "manager", lots: [] } });
    const mgr = await pageFor(A.base, MANAGER);
    await mgr.goto(`${A.base}/dealer`);
    await settle(mgr);
    ok("a manager's Today has no Getting started card", !!(await mgr.$(".crm-today")) && !(await mgr.$(".gs-card")) && (await A.call("/api/office/me", { email: MANAGER })).data?.gettingStarted === null);
    await owner.reload();
    await settle(owner);
    ok("... and adding them ticked Add your team for the owner", (await steps(owner)).find((x) => x.id === "team")?.done === true);

    /* Hide this list */
    await owner.click(".gs-hide");
    await owner.waitForSelector(".gs-card", { state: "detached", timeout: 10000 }).catch(() => {});
    ok("Hide this list: the card goes", !(await owner.$(".gs-card")));
    await owner.reload();
    await settle(owner);
    ok("... and stays hidden after a reload", !!(await owner.$(".crm-today")) && !(await owner.$(".gs-card")));
    const errs = [owner, phone, mgr].flatMap((p) => p.errors);
    ok("no errors on these pages", errs.length === 0, errs.join(" | "));
  }

  /* ======================================================================== */
  section("B. Not connected (no sign-up to start from): the business name first");
  {
    const B = await startServer(PORT + 1, "test/out/getting-started-data-b", []);
    const owner = await pageFor(B.base, OWNER);
    await owner.goto(`${B.base}/dealer#/setup`);
    await settle(owner);
    await owner.waitForSelector(".gs-card.gs-name", { timeout: 20000 }).catch(() => {});
    const card = await text(owner, ".gs-card");
    ok("the first sign-in (an old #/setup link) opens Today, and the card asks for the business name first",
      /#\/$/.test(owner.url()) && !!(await owner.$(".crm-today")) && card?.includes(WORDS.name) && !!(await owner.$(".gs-card input[autocomplete=organization]")), `${owner.url()} | ${card}`);
    ok("... no business yet, nothing made, and no terms line (not connected)", (await text(owner, ".topbar .brand-words strong")) === "Dealer Center" && !(await owner.$(".banner.terms"))
      && (await B.call("/api/office/me")).data?.business === null);
    ok("... and no line under the greeting (never \"You're all caught up\" above the business name)", !(await owner.$(".crm-today-head .page-titles > p:not(.crm-eyebrow)")), await text(owner, ".crm-today-head .page-titles"));
    await shot(owner, "b-business-name-1280");
    /* Price list and Settings before there is a business: a way back to Today, never a page that didn't load */
    for (const where of ["price-list", "settings"]) {
      await owner.goto(`${B.base}/dealer#/${where}`);
      await settle(owner);
      const said = await text(owner, "#main");
      ok(`... ${where === "price-list" ? "Price list" : "Settings"} before the business name says to type it on Today, with Go to Today (never "This page didn't load")`,
        said?.includes(WORDS.noBusiness) && said.includes(WORDS.noBusinessOwner) && !said.includes("didn't load") && (await text(owner, "#main a[href='#/']")) === "Go to Today", said);
      if (where === "price-list") await shot(owner, "b-price-list-before-name-1280");
    }
    await owner.goto(`${B.base}/dealer#/`);
    await settle(owner);
    await owner.waitForSelector(".gs-card.gs-name", { timeout: 20000 }).catch(() => {});
    const phone = await pageFor(B.base, OWNER, { width: 390, height: 844, mobile: true });
    await phone.goto(`${B.base}/dealer`);
    await settle(phone);
    await phone.waitForSelector(".gs-card.gs-name", { timeout: 20000 }).catch(() => {});
    const f = await fits(phone);
    ok("... it fits a phone (390 wide) with full-size taps", f.wide <= 0 && !f.small.length && !f.out.length, JSON.stringify(f));
    await shot(phone, "b-business-name-390");
    await owner.click(".gs-start");
    await owner.waitForTimeout(300);
    ok("Start with no name says what to type", /Business name/.test((await text(owner, ".gs-card .form-status")) || "") || /Type your business name/.test((await text(owner, ".gs-card .form-status")) || ""), await text(owner, ".gs-card .form-status"));
    await owner.fill(".gs-card input[autocomplete=organization]", "River Bend Sheds");
    await owner.click(".gs-start");
    await owner.waitForSelector(".gs-card .gs-step", { timeout: 20000 }).catch(() => {});
    const me = (await B.call("/api/office/me")).data;
    ok("Start makes the business, its price list (closed) and the first lot named after it; the card shows its steps; the top says the name",
      me.business?.name === "River Bend Sheds" && me.business.open === false && me.lots.length === 1 && me.lots[0].slug === "river-bend-sheds"
      && (await steps(owner)).length === 5 && (await text(owner, ".topbar .brand-words strong")) === "River Bend Sheds", JSON.stringify([me.business, me.lots]));
    await shot(owner, "b-after-start-1280");
    /* the closed banner on another screen: its Look at the preview ticks the card's step too */
    await owner.goto(`${B.base}/dealer#/lots`);
    await settle(owner);
    const banner = await text(owner, "#main > .banner.warn");
    const [bPreview] = await Promise.all([
      owner.context().waitForEvent("page", { timeout: 15000 }).catch(() => null),
      owner.click("#main > .banner.warn a[target=_blank]", { timeout: 10000 }).catch(() => null),
    ]);
    await owner.waitForTimeout(800);
    await bPreview?.close();
    await owner.goto(`${B.base}/dealer#/`);
    await settle(owner);
    await owner.waitForSelector(".gs-card .gs-step", { timeout: 20000 }).catch(() => {});
    ok("the closed banner on Lots (its button Open to customers): tapping its Look at the preview opens the preview and ticks Look at the preview on the card",
      banner?.startsWith(WORDS.closed) && banner.includes("Open to customers") && !banner.includes("Open for customers") && !!bPreview
      && (await steps(owner)).find((x) => x.id === "preview")?.done === true, `${banner} | ${JSON.stringify(await steps(owner))}`);
    const errs = [owner, phone].flatMap((p) => p.errors);
    ok("no errors on these pages", errs.length === 0, errs.join(" | "));
  }

  /* ======================================================================== */
  section("C. Connected, but no pass brought a sign-up: the business name, and the terms line on top");
  {
    const C = await startServer(PORT + 2, "test/out/getting-started-data-c", ["--control-room", "--terms-version", "2.2"]);
    const owner = await pageFor(C.base, OWNER);
    await owner.goto(`${C.base}/dealer`);
    await settle(owner);
    await owner.waitForSelector(".gs-card.gs-name", { timeout: 20000 }).catch(() => {});
    const banner = await text(owner, ".banner.terms");
    ok("Today asks for the business name, and the \"I have read and agree\" line is on top (no agreement from a sign-up page)",
      !!(await owner.$(".gs-card.gs-name")) && banner?.includes(WORDS.agree) && /version 2\.2/.test(banner), banner);
    await shot(owner, "c-terms-line-1280");
    await owner.click(".banner.terms button");
    await owner.waitForSelector(".banner.terms", { state: "detached", timeout: 10000 }).catch(() => {});
    ok("... tapping it keeps the agreement, and the line goes", !(await owner.$(".banner.terms")) && (await C.call("/api/office/me")).data?.terms?.agreed?.version === "2.2");
    /* another tab starts the business first; then this tab's Start: the toast says what is there */
    const other = await C.call("/api/office/start", { method: "POST", body: { businessName: "Other Tab Sheds" } });
    await owner.fill(".gs-card input[autocomplete=organization]", "This Tab Sheds");
    await owner.click(".gs-start");
    await owner.waitForFunction(() => [...document.querySelectorAll(".toast")].some((t) => /Your price list/.test(t.textContent)), null, { timeout: 15000 }).catch(() => {});
    const toastWords = await owner.$$eval(".toast", (els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()).join(" | ")).catch(() => "");
    ok("another tab started the business first (its lot made): this tab's Start says the price list and the first lot are ready, never \"Add your first lot\"",
      other.status === 200 && other.data?.start?.lot === "other-tab-sheds" && toastWords.includes("Your price list and your first lot are ready.") && !toastWords.includes("Add your first lot"), toastWords);
    const errs = owner.errors;
    ok("no errors on this page", errs.length === 0, errs.join(" | "));
  }

  /* ======================================================================== */
  section("D. The start fails for another reason than the name (the account is switched off)");
  {
    const D = await startServer(PORT + 3, "test/out/getting-started-data-d", ["--control-room-off", "--terms-version", "2.2"]);
    const owner = await pageFor(D.base, OWNER, { width: 390, height: 844, mobile: true });
    await owner.goto(`${D.base}/dealer`);
    await settle(owner);
    await owner.waitForSelector(".gs-card", { timeout: 20000 }).catch(() => {});
    const card = await text(owner, ".gs-card");
    ok("the card says why it couldn't get ready (the server's own words), with Try again, and never asks for a business name the name isn't missing for",
      card?.startsWith(WORDS.failed) && !card.includes(WORDS.name) && !(await owner.$(".gs-card input")) && !!(await owner.$(".gs-card button")) && (await text(owner, ".gs-card button")) === "Try again", card);
    const f = await fits(owner);
    ok("... it fits a phone with full-size taps", f.wide <= 0 && !f.small.length && !f.out.length, JSON.stringify(f));
    await shot(owner, "d-start-failed-390");
    await owner.click(".gs-card button", { timeout: 10000 }).catch(() => null);
    await owner.waitForTimeout(1500);
    ok("... Try again while it is still switched off says so again (still no name box)", (await text(owner, ".gs-card"))?.startsWith(WORDS.failed) && !(await owner.$(".gs-card input")), await text(owner, ".gs-card"));
    ok("no errors on this page", owner.errors.length === 0, owner.errors.join(" | "));
  }
} catch (e) {
  fail++;
  failures.push("the check stopped: " + (e.stack || e.message));
  console.log("    FAIL the check stopped: " + (e.stack || e.message));
} finally {
  await browser.close();
  if (!KEEP) for (const s of servers) s.kill();
  else console.log(`\n  The local Dealer Centers are still running at http://127.0.0.1:${PORT}/dealer, ${PORT + 1}, ${PORT + 2} and ${PORT + 3} (stop them with Ctrl+C).`);
}

console.log("");
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} Getting started checks failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PROVED (${pass} checks): a new owner's first sign-in opens Today right away, with no setup screens: their business, price list (closed to customers) and one lot named after it are made from the sign-up the Control Room passed on, their sign-up agreement counts (no terms line on top), and the black and gold Getting started card fits 1280 and 390 wide, links every step to its screen, ticks the preview and Open to customers by itself, and stays hidden once hidden; a manager never sees it; with no sign-up to start from, Today asks for the business name first (Price list and Settings point there, and connected, the terms line asks on top); Today shows no closed banner above the card, and the banner elsewhere ticks the preview too and never says Barnwright set up prices it didn't; a start that fails for another reason says why, with Try again. Pictures: test/out/getting-started/.`);
