/* CHECK: SIGNING IN, STAYING SIGNED IN AND SIGNING OUT, IN A REAL BROWSER.
   Run: node tools/check-sign-in-screens.mjs [--keep]
   check-all: browser
   Port: 8395 and 8396 (SIGN_IN_SCREENS_PORT=<port> to use another pair).

   Alan (Oct 2026): "if i sign out it doesn't let me log back in, add save
   login for 30 days" -- the Dealer Center's sign-in, on Edge and the iPad.
   This starts the local Dealer Center with the live site's sign-in
   (tools/office-local.mjs --identity: the real page and server code, and a
   pretend Netlify Identity that behaves like Netlify's), opens Chromium
   (the engine Edge uses) and proves, each in a fresh browser:

     1. the Sign in card: email, password and "Keep me signed in on this
        device for 30 days", unticked, with "Leave it off on a computer
        other people use."; a full-size row to tap; no sideways scrolling
        at 390, 820 and 1280 wide (pictures of each);
     2. ticked: in the Dealer Center, with nothing about the sign-in a page
        script can read (no nf_jwt or nf_refresh cookie, no gotrue.user);
        the cookie is HttpOnly, Secure, SameSite Strict, for 32 days; the
        browser closed and opened again (only cookies with an end date
        kept): still in, on the page it was on; the person menu says until
        when; opened from a link on another site: still in;
     3. not ticked: the same, until the browser closes -- then Sign in;
     4. Sign out on Team: a clean Sign in card at /dealer (no #/team, no
        cookie, no words), Back shows no Dealer Center, and signing in again
        works at once; a screen with unsaved changes asks first, and Stay
        keeps everything;
     5. Sign out on the computer leaves the iPad signed in, also two hours
        later; Sign out on every device signs the iPad out, saying so;
     6. two tabs: Sign out in one shows the Sign in card in the other at
        once; signing in again in one brings the other back in;
     7. a leftover nf_jwt cookie (even an HttpOnly one) no longer sends the
        Sign in card round in a loop;
     8. Identity trouble says so: Identity down or busy for the Dealer
        Center's server shows "Can't check your sign-in" with Try again
        (never a bare Sign in card), and Try again gets back in; at Sign in,
        Identity busy or broken says that, never "don't match"; a wrong
        password says "don't match"; an email typed with capitals works;
     9. Sign out still finishes when Identity's sign-out would hang, and
        when the Dealer Center can't be reached it never shows the Dealer
        Center again before the sign-out is done;
    10. day 31: asked to sign in again, with "You were kept signed in on
        this device for 30 days. Sign in again.";
    11. the email links: an invite (Choose a password, with the tick) and a
        "Make your login" confirmation sign the person in (kept when
        ticked); a reset link shows the email, signs in, and signs the other
        devices out with "Your password was changed";
    12. a sign-in from before the Dealer Center's own cookie (Identity's
        tokens left in the browser) moves onto the cookie while it is still
        signed in, and one left in a browser that was closed is cleared,
        never used to sign anybody in;
    13. a tab still marked from a Barnwright visit that ended offers "Sign
        in to this Dealer Center", which leads to the Sign in card;
    14. the local Dealer Center's "pick who you are" has no tick;
    15. day 30 ends while Settings has a change not saved yet: Save never
        reloads (no "Leave site?" box), the typed words stay, a note says
        to sign in in a new tab, and then Save saves;
    16. not ticked, the browser kept the cookie (Edge's "continue where
        you left off", an iPad that never closes Safari): 12 hours later
        it asks to sign in, saying why;
    17. "Forgot your password?" with a login saved with capitals sends the
        link; a login that isn't on the team gets no sign-in, only words;
    18. signing out of the "try it" demo leaves a real Dealer Center tab in
        the same browser alone.
   Also in 5b: Sign out on every device while Identity can't be asked
   still signs the iPad out (and says Identity didn't answer), and when the
   Dealer Center couldn't do it this device stays signed in and says so; in
   10: the last 24 hours a note says when this device's sign-in ends, the
   person menu says the time, and the day-31 card starts ticked; in 11:
   the reset link survives Identity breaking half way (Save password again
   finishes it), and a refresh token kept from the old password stops
   working.

   Pictures go to test/out/sign-in-screens/. --keep leaves the server
   running; --only 4,8b runs just those parts. */

import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/out/sign-in-screens");
const DATA = "test/out/sign-in-screens-data";
const PORT = Number(process.env.SIGN_IN_SCREENS_PORT || 8395);
const BASE = `http://127.0.0.1:${PORT}`;
const KEEP = process.argv.includes("--keep");
/* --only 4,8b: just those parts (and 14 when named) */
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? process.argv[i + 1].split(",") : null; })();
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "/opt/node22/lib/node_modules/playwright/index.js");

const OWNER = { email: "chris@samplebarns.example", password: "sample-password" };
const DEALER = { email: "mike@samplebarns.example", password: "sample-password" };
const WORDS = {
  keep: "Keep me signed in on this device for 30 days",
  hint: "Leave it off on a computer other people use.",
  wrong: "That email and password don't match. Try again, or reset your password.",
  busy: "Too many tries. Wait a few minutes, then try again.",
  down: "Can't reach the sign-in right now. Check your internet connection and try again in a minute.",
  cantCheck: "The sign-in isn't answering right now. Try again in a minute.",
  finishing: "Your password is right, but the Dealer Center couldn't finish signing you in. Try again in a minute.",
  day31: "You were kept signed in on this device for 30 days. Sign in again.",
  everywhere: "You signed out on every device. Sign in again.",
  password: "Your password was changed. Sign in with the new one.",
  everywhereHalf: "You're signed out of the Dealer Center on every device, but the sign-in didn't answer. In a minute, sign in and tap Sign out on every device again to finish.",
  resetNotOut: "Your new password is saved, but the sign-in didn't answer, so your other devices may still be signed in. Wait a minute, then tap Save password again.",
  idle: "You weren't kept signed in on this device, so you were signed out after 12 hours away. Sign in again.",
  endsSoon: "Your sign-in on this device ends ",
  endsSoonTail: "Sign out and sign in again before then to keep going.",
  midwork: "Your 30 days on this device are up. Your changes are still here: open the Dealer Center in a new tab, sign in, then come back and tap Save.",
  notOnTeam: "You're not on the team here yet. Ask the owner to add ",
};
const HOUR = 3600000;
const DAY = 86400000;

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("    ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("    FAIL " + name + (extra ? " -- " + String(extra).slice(0, 400) : "")); }
}
const section = (t) => console.log("\n  " + t);
/* one numbered part of the walk: a part that stops half way is one FAIL, and the next part still runs */
async function part(title, fn) {
  if (ONLY && !ONLY.includes(title.split(".")[0])) return;
  section(title);
  try { await fn(); } catch (e) { ok(`${title.replace(/^\d+\. /, "")}: the walk got to the end`, false, String(e?.message || e).split("\n")[0]); }
  /* whatever happened, the next part starts from today with Identity well */
  await setClock(0).catch(() => {});
  await identity({ server: null, serverUser: null, browser: null, logout: null }).catch(() => {});
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(port, data, extra) {
  const proc = spawn(process.execPath, ["tools/office-local.mjs", "--reset", ...extra, "--port", String(port), "--data", data], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  proc.stdout.on("data", (d) => { log += d; });
  proc.stderr.on("data", (d) => { log += d; });
  return { proc, log: () => log };
}
async function waitFor(server) {
  for (let i = 0; i < 160 && !/is running/.test(server.log()); i++) await sleep(250);
  return /is running/.test(server.log());
}

rmSync(resolve(ROOT, DATA), { recursive: true, force: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const server = startServer(PORT, DATA, ["--identity"]);
if (!(await waitFor(server))) {
  console.log("FAIL the local Dealer Center did not start:\n" + server.log());
  server.proc.kill();
  process.exit(1);
}

const local = (path, body) => fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify(body) }).then((r) => r.json());
const identity = (body) => local("/__local/identity", body);
const setClock = (shift) => local("/__local/clock", { shift });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const contexts = [];
async function device({ width = 1280, height = 860, state } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "reduce", ...(state ? { storageState: state } : {}) });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  contexts.push(context);
  return context;
}
async function open(context, path = "/dealer") {
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.goto(BASE + path);
  await settle(page);
  return page;
}
async function settle(page, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const busy = await page.evaluate(() => !!document.querySelector("#dealer-center .boot, #main .loading") || !document.querySelector("#dealer-center")?.children.length).catch(() => true);
    if (!busy) break;
    await sleep(100);
  }
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
  await sleep(150);
}
/* which screen: {screen: "card"|"dealer-center"|"other", heading, status, note, intro} */
async function screen(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".auth-card h1");
    const status = [...document.querySelectorAll(".form-status")].map((s) => s.textContent.trim()).filter(Boolean).join(" | ");
    if (card) return {
      screen: "card", heading: card.textContent.trim(), status,
      note: [...document.querySelectorAll(".auth-note")].map((n) => n.textContent.trim()).join(" | "),
      words: document.querySelector(".auth-card")?.innerText || "",
    };
    if (document.querySelector(".topbar")) return { screen: "dealer-center", heading: document.querySelector("#main h1")?.textContent.trim() || "" };
    return { screen: "other", words: document.body.innerText.slice(0, 300) };
  }).catch((e) => ({ screen: "error", words: String(e) }));
}
const isIn = (s) => s.screen === "dealer-center";
const isSignIn = (s) => s.screen === "card" && s.heading === "Sign in";
async function signIn(page, who, { keep = false, expect = "load" } = {}) {
  await page.waitForSelector(".auth-card form", { timeout: 15000 });
  await page.getByLabel("Email", { exact: true }).fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  /* (a page without the tick signs in without it, so the check shows what that page does) */
  if (keep) await tick(page);
  const loaded = expect === "load" ? page.waitForEvent("load", { timeout: 15000 }).catch(() => null) : null;
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  if (loaded) await loaded;
  else await page.waitForSelector(".form-status:not(:empty)", { timeout: 15000 }).catch(() => {});
  await settle(page);
  return screen(page);
}
/* tick "Keep me signed in", where the page has it (a page without it carries on without, so the
   walk shows what that page does next) */
async function tick(page) {
  const box = page.getByLabel(WORDS.keep);
  if (await box.count()) await box.check();
}
async function openMenu(page) {
  if (!(await page.locator(".person-menu").isVisible().catch(() => false))) await page.locator(".person-button").click();
}
async function signOut(page, { everywhere = false } = {}) {
  await openMenu(page);
  const loaded = page.waitForEvent("load", { timeout: 15000 }).catch(() => null);
  await page.locator(".person-menu").getByRole("button", { name: everywhere ? "Sign out on every device" : "Sign out", exact: true }).click();
  await loaded;
  await settle(page);
  return screen(page);
}
/* (every cookie of this site: context.cookies(BASE) leaves out the Secure
   ones for an http address, though Chromium sends them to 127.0.0.1) */
const cookies = async (context) => (await context.cookies()).filter((c) => c.domain === "127.0.0.1");
const signInCookie = async (context) => (await cookies(context)).find((c) => c.name === "__Host-dc_signin") || null;
/* the browser closed and opened again: cookies without an end date go */
async function reopened(context, opts = {}) {
  const state = await context.storageState();
  state.cookies = state.cookies.filter((c) => c.expires > 0);
  return device({ ...opts, state });
}
const shot = (page, name) => page.screenshot({ path: resolve(OUT, name + ".png") }).catch(() => {});
const textOf = (page, sel) => page.evaluate((q) => [...document.querySelectorAll(q)].map((e) => e.textContent.trim()).join(" | "), sel).catch(() => "");
async function noSideways(page) { return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1); }

/* ---- 1 -------------------------------------------------------------------- */
await part("1. The Sign in card", async () => {
  for (const [w, h] of [[390, 844], [820, 1180], [1280, 860]]) {
    const ctx = await device({ width: w, height: h });
    const page = await open(ctx, "/dealer");
    const s = await screen(page);
    ok(`${w} wide: the Sign in card`, isSignIn(s), JSON.stringify(s));
    const box = page.getByLabel(WORDS.keep);
    ok(`${w} wide: "${WORDS.keep}" is there, unticked`, (await box.count()) === 1 && !(await box.isChecked()));
    ok(`${w} wide: with "${WORDS.hint}"`, s.words.includes(WORDS.hint));
    const row = await page.locator(".check.keep").boundingBox();
    ok(`${w} wide: the whole row is a full-size tap (44 px)`, !!row && row.height >= 44, JSON.stringify(row));
    ok(`${w} wide: no sideways scrolling`, await noSideways(page));
    if (w === 1280) {
      ok("the email box is the browser's username (password managers pair them)", (await page.getByLabel("Email", { exact: true }).getAttribute("autocomplete")) === "username");
      ok("the password box is the current password", (await page.getByLabel("Password", { exact: true }).getAttribute("autocomplete")) === "current-password");
    }
    await shot(page, `sign-in-${w}`);
    await tick(page);
    await shot(page, `sign-in-${w}-ticked`);
    await ctx.close();
  }
});

/* ---- 2 -------------------------------------------------------------------- */
await part("2. Ticked: 30 days on this device", async () => {
  const ctx = await device();
  const page = await open(ctx, "/dealer#/team");
  const s = await signIn(page, OWNER, { keep: true });
  ok("ticked sign-in: in the Dealer Center, on the page it was on (Team)", isIn(s) && page.url().endsWith("#/team"), JSON.stringify(s) + " " + page.url());
  const c = await signInCookie(ctx);
  ok("the cookie: HttpOnly, Secure, SameSite Strict, the whole site", !!c && c.httpOnly && c.secure && c.sameSite === "Strict" && c.path === "/", JSON.stringify(c && { ...c, value: "…" }));
  ok("... it lasts 32 days (30, and two to say why it ended)", !!c && Math.abs(c.expires * 1000 - (Date.now() + 32 * DAY)) < 120000, c && new Date(c.expires * 1000).toISOString());
  const seen = await page.evaluate(() => ({ cookie: document.cookie, keys: Object.keys(localStorage) }));
  ok("a page script sees no nf_jwt or nf_refresh cookie and no gotrue.user (nothing to steal or to go stale)", !/nf_(jwt|refresh)/.test(seen.cookie) && !seen.keys.includes("gotrue.user"), JSON.stringify(seen));
  await openMenu(page);
  ok("the person menu says until when", /Signed in on this device until [A-Z][a-z]{2} \d{1,2}/.test(await page.locator(".person-menu").innerText()));
  await shot(page, "kept-person-menu");
  const again = await reopened(ctx);
  const p2 = await open(again, "/dealer#/team");
  const s2 = await screen(p2);
  ok("the browser closed and opened again: still in, on Team", isIn(s2) && s2.heading === "Team", JSON.stringify(s2));
  await shot(p2, "kept-reopened-team");
  /* opened from a link on another website (localhost is another site than 127.0.0.1) */
  const other = await again.newPage();
  await other.goto(`http://localhost:${PORT}/__nothing`).catch(() => {});
  await other.setContent(`<a id="go" href="${BASE}/dealer#/customers">Dealer Center</a>`);
  await other.click("#go");
  await other.waitForURL(/127\.0\.0\.1.*dealer/, { timeout: 10000 }).catch(() => {});
  await settle(other);
  ok("opened from a link on another website: still in (the page's own requests carry the Strict cookie)", isIn(await screen(other)), JSON.stringify(await screen(other)));
  await again.close();
  await ctx.close();
});

/* ---- 3 -------------------------------------------------------------------- */
await part("3. Not ticked: until the browser closes", async () => {
  const ctx = await device();
  const page = await open(ctx);
  ok("unticked sign-in: in", isIn(await signIn(page, OWNER)));
  const c = await signInCookie(ctx);
  ok("... the cookie ends when the browser closes (no end date)", !!c && c.expires === -1, c && String(c.expires));
  await page.reload();
  await settle(page);
  ok("... a reload stays in", isIn(await screen(page)));
  const again = await reopened(ctx);
  const p2 = await open(again, "/dealer#/team");
  ok("the browser closed and opened again: asked to sign in", isSignIn(await screen(p2)));
  await again.close();
  await ctx.close();
});

/* ---- 4 -------------------------------------------------------------------- */
await part("4. Sign out, then sign in again", async () => {
  const ctx = await device();
  const page = await open(ctx, "/dealer#/team");
  await signIn(page, OWNER);
  const out = await signOut(page);
  ok("Sign out on Team: the Sign in card", isSignIn(out), JSON.stringify(out));
  ok("... at /dealer (no #/team left in the address)", new URL(page.url()).hash === "" && new URL(page.url()).pathname === "/dealer", page.url());
  ok("... no sign-in cookie left, and nothing of a sign-in a page script can read", !(await signInCookie(ctx)) && !/nf_(jwt|refresh)=/.test(await page.evaluate(() => document.cookie)) && !(await page.evaluate(() => Object.keys(localStorage))).includes("gotrue.user"));
  ok("... and no words (nothing went wrong)", !out.note && !out.status, JSON.stringify(out));
  await shot(page, "signed-out");
  await page.goBack().catch(() => {});
  await settle(page);
  ok("the Back button shows no Dealer Center", !isIn(await screen(page)));
  await page.goto(BASE + "/dealer");
  await settle(page);
  const s = await signIn(page, OWNER);
  ok("signing in again works at once", isIn(s), JSON.stringify(s));
  await ctx.close();
});

await part("4b. Unsaved changes ask before Sign out", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await signIn(page, OWNER);
  /* unsaved changes: Settings with a changed name */
  await page.goto(BASE + "/dealer#/settings");
  await settle(page);
  const name = page.getByLabel("Business name", { exact: true });
  if (await name.count()) await name.fill("Sample Storage Barns and Sheds");
  await settle(page, 2000);
  page.removeAllListeners("dialog");
  let asked = null;
  page.once("dialog", (d) => { asked = d.message(); d.dismiss().catch(() => {}); });
  await openMenu(page);
  await page.locator(".person-menu").getByRole("button", { name: "Sign out", exact: true }).click();
  await sleep(800);
  ok("a screen with unsaved changes asks before signing out", !!asked, String(asked));
  ok("... Stay keeps the Dealer Center and the sign-in", isIn(await screen(page)) && (await page.evaluate(() => fetch("/api/office/me").then((r) => r.status))) === 200);
  await ctx.close();
});

/* ---- 5 -------------------------------------------------------------------- */
await part("5. The computer and the iPad", async () => {
  const computer = await device();
  const ipad = await device({ width: 820, height: 1180 });
  const pc = await open(computer);
  const pi = await open(ipad);
  await signIn(pc, OWNER, { keep: true });
  ok("both signed in (kept)", isIn(await signIn(pi, OWNER, { keep: true })));
  await signOut(pc);
  await pi.goto(BASE + "/dealer#/customers");
  await settle(pi);
  ok("Sign out on the computer: the iPad is still in", isIn(await screen(pi)));
  await setClock(2 * 3600000);
  await pi.goto(BASE + "/dealer#/team");
  await settle(pi);
  ok("... and still two hours later", isIn(await screen(pi)), JSON.stringify(await screen(pi)));
  await signIn(pc, OWNER, { keep: true });
  await signOut(pc, { everywhere: true });
  await pi.reload();
  await settle(pi);
  const s = await screen(pi);
  ok("Sign out on every device: the iPad asks to sign in, saying so", isSignIn(s) && s.note.includes(WORDS.everywhere), JSON.stringify(s));
  await shot(pi, "signed-out-everywhere-820");
  await setClock(0);
  await computer.close();
  await ipad.close();
});

await part("5b. Sign out on every device when it can't all be done", async () => {
  const computer = await device();
  const ipad = await device({ width: 820, height: 1180 });
  const pc = await open(computer);
  const pi = await open(ipad);
  await signIn(pc, OWNER, { keep: true });
  await signIn(pi, OWNER, { keep: true });
  /* the Dealer Center's server can't reach Identity, past its one-minute memory */
  await setClock(2 * 60000);
  await identity({ server: "down" });
  const s = await signOut(pc, { everywhere: true });
  ok("Identity down: Sign out on every device still lands on the Sign in card, saying the sign-in didn't answer", isSignIn(s) && s.note.includes(WORDS.everywhereHalf), JSON.stringify(s));
  await shot(pc, "everywhere-identity-down-1280");
  await identity({ server: null });
  await pi.reload();
  await settle(pi);
  const si = await screen(pi);
  ok("... Identity back: the iPad asks to sign in, saying so", isSignIn(si) && si.note.includes(WORDS.everywhere), JSON.stringify(si));
  ok("... with the tick off (only a device whose kept 30 days ran out starts ticked)", !(await pi.getByLabel(WORDS.keep).isChecked()));
  /* the Dealer Center itself can't do it right now */
  await signIn(pc, OWNER, { keep: true });
  await pc.route("**/api/office/sign-out", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Something went wrong on our end. Try again in a minute." }) }));
  await openMenu(pc);
  await pc.locator(".person-menu").getByRole("button", { name: "Sign out on every device", exact: true }).click();
  await sleep(2000);
  await settle(pc);
  ok("the Dealer Center couldn't do it: still in the Dealer Center here, saying so (never a card that looks done)", isIn(await screen(pc)) && (await textOf(pc, ".toast")).includes("Something went wrong on our end"), JSON.stringify(await screen(pc)) + " " + (await textOf(pc, ".toast")));
  await pc.unroute("**/api/office/sign-out");
  await computer.close();
  await ipad.close();
});

/* ---- 6 -------------------------------------------------------------------- */
await part("6. Two tabs", async () => {
  const ctx = await device();
  const t1 = await open(ctx);
  await signIn(t1, OWNER, { keep: true });
  const t2 = await open(ctx, "/dealer#/team");
  ok("the second tab is in", isIn(await screen(t2)));
  await t1.bringToFront();
  await signOut(t1);
  await t2.waitForSelector(".auth-card", { timeout: 5000 }).catch(() => {});
  await settle(t2);
  ok("Sign out in one tab: the other shows the Sign in card at once, without a tap", isSignIn(await screen(t2)), JSON.stringify(await screen(t2)));
  await signIn(t1, OWNER);
  await t2.waitForSelector(".topbar", { timeout: 5000 }).catch(() => {});
  await settle(t2);
  ok("signing in again in one tab brings the other back in", isIn(await screen(t2)), JSON.stringify(await screen(t2)));
  await ctx.close();
});

/* ---- 7 -------------------------------------------------------------------- */
await part("7. A leftover nf_jwt cookie", async () => {
  const ctx = await device();
  await ctx.addCookies([{ name: "nf_jwt", value: "eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.c3RhbGUtbGVmdG92ZXItdG9rZW4", url: BASE, httpOnly: true, sameSite: "Lax" }]);
  const page = await open(ctx);
  const s = await signIn(page, OWNER);
  ok("an HttpOnly nf_jwt left from before: signing in works (no loop back to Sign in)", isIn(s), JSON.stringify(s));
  ok("... and the server cleared it", !(await cookies(ctx)).some((c) => c.name === "nf_jwt"));
  await ctx.close();
});

/* ---- 8 -------------------------------------------------------------------- */
await part("8. Identity trouble for the server says so", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await signIn(page, OWNER, { keep: true });
  await setClock(2 * 3600000);              /* the server has to ask Identity for a new token */
  await identity({ server: "down" });
  await page.reload();
  await settle(page);
  const s = await screen(page);
  ok("Identity down for the server: \"Can't check your sign-in\", not a bare Sign in card", s.screen === "card" && s.heading === "Can't check your sign-in" && s.words.includes(WORDS.cantCheck), JSON.stringify(s));
  await shot(page, "cant-check");
  await identity({ server: 429 });
  await page.reload();
  await settle(page);
  ok("Identity busy (429) for the server: the same", (await screen(page)).heading === "Can't check your sign-in");
  await identity({ server: null });
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForEvent("load", { timeout: 10000 }).catch(() => {});
  await settle(page);
  ok("Try again once Identity answers: back in, still signed in", isIn(await screen(page)));
  await setClock(0);
  await ctx.close();
});

await part("8b. The words at Sign in", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await identity({ server: 503 });
  const f = await signIn(page, OWNER, { expect: "words" });
  ok("signing in while the server can't reach Identity: says so", isSignIn(f) && f.status === WORDS.finishing, JSON.stringify(f));
  await identity({ server: null, browser: 503 });
  const d = await signIn(page, OWNER, { expect: "words" });
  ok("Identity broken (503) at Sign in: \"Can't reach the sign-in\", never \"don't match\"", d.status === WORDS.down, JSON.stringify(d));
  await shot(page, "sign-in-cant-reach");
  await identity({ browser: 429 });
  ok("Identity busy (429) at Sign in: \"Too many tries\"", (await signIn(page, OWNER, { expect: "words" })).status === WORDS.busy);
  await identity({ browser: null });
  ok("a wrong password: \"don't match\"", (await signIn(page, { email: OWNER.email, password: "not-the-password" }, { expect: "words" })).status === WORDS.wrong);
  await shot(page, "sign-in-wrong-password");
  ok("the email typed with capital letters: in", isIn(await signIn(page, { email: "Chris@SampleBarns.example", password: OWNER.password })));
  await ctx.close();
});

/* ---- 9 -------------------------------------------------------------------- */
await part("9. Sign out never gets stuck", async () => {
  await identity({ logout: "hang" });
  const ctx = await device();
  const page = await open(ctx);
  await signIn(page, OWNER);
  const t = Date.now();
  const s = await signOut(page);
  ok("Identity's sign-out would hang: Sign out still lands on the Sign in card at once", isSignIn(s) && Date.now() - t < 8000, `${Date.now() - t} ms ${JSON.stringify(s)}`);
  await identity({ logout: null });
  await signIn(page, OWNER);
  await page.route("**/api/office/sign-out", (r) => r.abort());
  await openMenu(page);
  await page.locator(".person-menu").getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForEvent("load", { timeout: 15000 }).catch(() => {});
  await settle(page);
  const s2 = await screen(page);
  ok("the Dealer Center can't be reached to sign out: it never shows the Dealer Center, it says so", s2.screen === "card" && !isIn(s2) && s2.heading === "The Dealer Center isn't answering", JSON.stringify(s2));
  await page.unroute("**/api/office/sign-out");
  await page.getByRole("button", { name: "Try again" }).click();
  await page.waitForEvent("load", { timeout: 10000 }).catch(() => {});
  await settle(page);
  ok("... Try again finishes the sign-out: the Sign in card, and the cookie is gone", isSignIn(await screen(page)) && !(await signInCookie(ctx)), JSON.stringify(await screen(page)));
  await ctx.close();
});

/* ---- 10 ------------------------------------------------------------------- */
await part("10. Day 31", async () => {
  const ctx = await device({ width: 390, height: 844 });
  const page = await open(ctx);
  await signIn(page, OWNER, { keep: true });
  await setClock(28 * DAY);
  await page.reload();
  await settle(page);
  ok("day 28: no note yet about the sign-in ending", isIn(await screen(page)) && !(await textOf(page, ".sign-in-ends")));
  await setClock(29 * DAY);
  await page.reload();
  await settle(page);
  ok("day 29: still in", isIn(await screen(page)));
  await setClock(29 * DAY + 12 * HOUR);
  await page.reload();
  await settle(page);
  const soon = await textOf(page, ".sign-in-ends");
  ok("the last 24 hours: a note on top says when this device's sign-in ends and what to do", soon.startsWith(WORDS.endsSoon) && /(today|tomorrow) at \d{1,2}:\d{2} [AP]M/.test(soon) && soon.includes(WORDS.endsSoonTail), soon);
  ok("... no sideways scrolling at 390 with it", await noSideways(page));
  await shot(page, "ends-soon-390");
  await page.locator(".person-button").click();
  const menu = await page.locator(".person-menu").innerText().catch(() => "");
  ok("... the person menu says the day and the time", /Signed in on this device until [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2} [AP]M/.test(menu), menu);
  await setClock(30 * DAY + 60000);
  await page.reload();
  await settle(page);
  const s = await screen(page);
  ok("30 days and a minute: asked to sign in again, with the 30-day words", isSignIn(s) && s.note.includes(WORDS.day31), JSON.stringify(s));
  ok("... the tick starts ticked: this is the device the person chose to keep", await page.getByLabel(WORDS.keep).isChecked());
  ok("... no sideways scrolling at 390", await noSideways(page));
  await shot(page, "day-31-390");
  ok("... signing in again works", isIn(await signIn(page, OWNER, { keep: true })));
  await setClock(0);
  await ctx.close();
});

/* ---- 11 ------------------------------------------------------------------- */
await part("11. The email links", async () => {
  /* the owner adds Pat to the team, and Netlify emails Pat an invite */
  const ownerCtx = await device();
  const op = await open(ownerCtx);
  await signIn(op, OWNER);
  const added = await op.evaluate(() => fetch("/api/office/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "pat@samplebarns.example", name: "Pat Moore", role: "manager", lots: [] }) }).then((r) => r.status));
  ok("the owner adds Pat (a manager)", added === 201, String(added));
  const { token } = await identity({ link: { type: "invite", email: "pat@samplebarns.example" } });
  const ctx = await device({ width: 390, height: 844 });
  const page = await open(ctx, `/dealer#invite_token=${token}`);
  let s = await screen(page);
  ok("the invite link: \"Welcome! Choose a password\", with the tick", s.heading === "Welcome! Choose a password" && (await page.getByLabel(WORDS.keep).count()) === 1, JSON.stringify(s));
  ok("... the token left the address at once", !page.url().includes("invite_token"), page.url());
  await shot(page, "invite-390");
  await page.getByLabel("Password", { exact: true }).fill("pats-new-password");
  await page.getByLabel("Type it again").fill("pats-new-password");
  await tick(page);
  await page.getByRole("button", { name: "Save password" }).click();
  await page.waitForSelector(".topbar", { timeout: 15000 }).catch(() => {});
  await settle(page);
  s = await screen(page);
  ok("... Save password: in the Dealer Center (it used to land on Sign in)", isIn(s), JSON.stringify(s));
  ok("... kept for 30 days", ((await signInCookie(ctx))?.expires || 0) > 0);
  await ctx.close();

  /* Make your login (ticked), then the confirmation link in the same browser */
  const c2 = await device();
  const p2 = await open(c2);
  await p2.getByRole("button", { name: "Make your login" }).click();
  await p2.getByLabel("Your name").fill("Lee Carter");
  await p2.getByLabel("Email", { exact: true }).fill("Lee.New@SampleBarns.example");
  await p2.getByLabel("Password", { exact: true }).fill("lees-password-1");
  ok("Make your login has the tick", (await p2.getByLabel(WORDS.keep).count()) === 1);
  await tick(p2);
  await shot(p2, "make-your-login-1280");
  await p2.getByRole("button", { name: "Make my login" }).click();
  await p2.waitForSelector("text=Check your email", { timeout: 10000 }).catch(() => {});
  const check = await screen(p2);
  ok("... Check your email, open it in this browser to stay signed in", check.heading === "Check your email" && /Open it in this browser to stay signed in for 30 days/.test(check.words), JSON.stringify(check));
  const st = await identity({});
  /* the email's link opens a new tab */
  const p3 = await open(c2, `/dealer#confirmation_token=${st.lastSignup}`);
  const after = await screen(p3);
  ok("... the confirmation link of a login that isn't on the team: no sign-in, the card says to ask the owner", isSignIn(after) && after.note.includes(WORDS.notOnTeam), JSON.stringify(after));
  ok("... with the email, saved in small letters, and no sign-in cookie made", after.note.includes("lee.new@samplebarns.example") && !(await signInCookie(c2)), after.note);
  await c2.close();

  /* a link that ran out */
  const c4 = await device();
  const p4 = await open(c4, "/dealer#recovery_token=made-up-or-used-token");
  const s4 = await screen(p4);
  ok("a link that ran out or was used: the Sign in card says so, and the token left the address", isSignIn(s4) && s4.note.includes("That link has expired or was already used.") && !p4.url().includes("token"), JSON.stringify(s4) + " " + p4.url());
  await c4.close();

  /* a reset link on the phone: the computer is signed out, saying why */
  const desk = await device();
  const dp = await open(desk);
  await signIn(dp, DEALER, { keep: true });
  const phone = await device({ width: 390, height: 844 });
  const pp = await open(phone);
  await pp.getByRole("button", { name: "Forgot your password?" }).click();
  await pp.getByLabel("Email", { exact: true }).fill(DEALER.email);
  await pp.getByRole("button", { name: "Email me a link" }).click();
  await pp.waitForSelector(".form-status:not(:empty)", { timeout: 10000 });
  const { lastRecovery } = await identity({});
  await pp.close();
  /* somebody who knew the old password kept an Identity sign-in of their own */
  const kept = await dp.evaluate(async (who) => {
    const r = await fetch("/.netlify/identity/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: who.email, password: who.password }) });
    return (await r.json()).refresh_token;
  }, DEALER);
  const rp = await open(phone, `/dealer#recovery_token=${lastRecovery}`);
  s = await screen(rp);
  ok("the reset link: \"Choose a new password\", showing whose", s.heading === "Choose a new password" && (await rp.getByLabel("Email", { exact: true }).inputValue()) === DEALER.email, JSON.stringify(s));
  await shot(rp, "reset-390");
  await rp.getByLabel("Password", { exact: true }).fill("mikes-new-password");
  await rp.getByLabel("Type it again").fill("mikes-new-password");
  /* Identity breaks half way, for the Dealer Center's server only */
  await identity({ serverUser: 503 });
  await rp.getByRole("button", { name: "Save password" }).click();
  await rp.waitForSelector(".form-status:not(:empty)", { timeout: 15000 }).catch(() => {});
  const half = await screen(rp);
  ok("... Identity breaks half way: the password is saved, and it says to tap Save password again", half.screen === "card" && half.status === WORDS.resetNotOut, JSON.stringify(half));
  await shot(rp, "reset-half-390");
  await identity({ serverUser: null });
  await rp.getByRole("button", { name: "Save password" }).click();
  await rp.waitForSelector(".topbar", { timeout: 15000 }).catch(() => {});
  await settle(rp);
  ok("... Save password again: in", isIn(await screen(rp)), JSON.stringify(await screen(rp)));
  const reused = await rp.evaluate(async (t) => (await fetch("/api/office/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: t, keep: true }) })).status, kept);
  ok("... a refresh token kept from the old password no longer signs anybody in", reused === 401, String(reused));
  await dp.reload();
  await settle(dp);
  const ds = await screen(dp);
  ok("... the computer is signed out, with \"Your password was changed\"", isSignIn(ds) && ds.note.includes(WORDS.password), JSON.stringify(ds));
  ok("... and the new password works there", isIn(await signIn(dp, { email: DEALER.email, password: "mikes-new-password" })));
  await desk.close();
  await phone.close();
  await ownerCtx.close();
});

/* ---- 12 ------------------------------------------------------------------- */
await part("12. A sign-in from before the Dealer Center's own cookie", async () => {
  /* what @netlify/identity left in a browser: gotrue.user in localStorage and two cookies a page can read */
  const ctx = await device();
  const page = await ctx.newPage();
  await page.goto(BASE + "/dealer.webmanifest");
  await page.evaluate(async (who) => {
    const r = await fetch("/.netlify/identity/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: who.email, password: who.password }) });
    const t = await r.json();
    localStorage.setItem("gotrue.user", JSON.stringify({ url: location.origin + "/.netlify/identity", token: { ...t, expires_at: Date.now() + 3600000 }, email: who.email }));
    document.cookie = `nf_jwt=${t.access_token}; path=/; secure; samesite=lax`;
    document.cookie = `nf_refresh=${t.refresh_token}; path=/; secure; samesite=lax`;
  }, OWNER);
  await page.goto(BASE + "/dealer#/team");
  await settle(page);
  await settle(page, 3000);
  ok("still signed in from before: in, on Team", isIn(await screen(page)));
  const seen = await page.evaluate(() => ({ cookie: document.cookie, keys: Object.keys(localStorage) }));
  ok("... moved onto the Dealer Center's cookie, nothing of it left in the page", !!(await signInCookie(ctx)) && !/nf_(jwt|refresh)/.test(seen.cookie) && !seen.keys.includes("gotrue.user"), JSON.stringify(seen));
  ok("... until the browser closes (it was never ticked)", (await signInCookie(ctx))?.expires === -1);
  await ctx.close();

  /* still open, but its access token ran out (no nf_jwt left, nf_refresh still here) */
  const c1 = await device();
  const p1 = await c1.newPage();
  await p1.goto(BASE + "/dealer.webmanifest");
  await p1.evaluate(async (who) => {
    const r = await fetch("/.netlify/identity/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: who.email, password: who.password }) });
    const t = await r.json();
    localStorage.setItem("gotrue.user", JSON.stringify({ url: location.origin + "/.netlify/identity", token: { ...t, expires_at: Date.now() - 1000 }, email: who.email }));
    document.cookie = `nf_refresh=${t.refresh_token}; path=/; secure; samesite=lax`;
  }, OWNER);
  await p1.goto(BASE + "/dealer#/customers");
  await settle(p1);
  await settle(p1, 3000);
  ok("still open but its token ran out: in (as the code before renewed it), now on the cookie", isIn(await screen(p1)) && !!(await signInCookie(c1)), JSON.stringify(await screen(p1)));
  await c1.close();

  /* the browser was closed since: only gotrue.user is left */
  const c2 = await device();
  const p2 = await c2.newPage();
  await p2.goto(BASE + "/dealer.webmanifest");
  await p2.evaluate(async (who) => {
    const r = await fetch("/.netlify/identity/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: who.email, password: who.password }) });
    const t = await r.json();
    localStorage.setItem("gotrue.user", JSON.stringify({ url: location.origin + "/.netlify/identity", token: { ...t, expires_at: Date.now() + 3600000 }, email: who.email }));
  }, OWNER);
  await p2.goto(BASE + "/dealer");
  await settle(p2);
  ok("a browser closed since (only gotrue.user left): the Sign in card -- the next person on a lot computer isn't signed in as somebody else", isSignIn(await screen(p2)));
  ok("... and gotrue.user is cleared", !(await p2.evaluate(() => Object.keys(localStorage))).includes("gotrue.user"));
  await c2.close();
});

/* ---- 13 ------------------------------------------------------------------- */
await part("13. A tab still marked from a Barnwright visit", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await page.evaluate(() => sessionStorage.setItem("dealer-center:barnwright-visit", "1"));
  await page.goto(BASE + "/dealer#/team");
  await page.reload();
  await settle(page);
  const s = await screen(page);
  const button = page.getByRole("button", { name: "Sign in to this Dealer Center" });
  ok("the ended visit's card offers \"Sign in to this Dealer Center\"", s.screen === "card" && (await button.count()) === 1, JSON.stringify(s));
  await shot(page, "visit-ended-sign-in");
  await button.click();
  await page.waitForEvent("load", { timeout: 10000 }).catch(() => {});
  await settle(page);
  ok("... it leads to the Sign in card", isSignIn(await screen(page)));
  ok("... and signing in works in that tab", isIn(await signIn(page, OWNER)));
  await ctx.close();
});

/* ---- 15 ------------------------------------------------------------------- */
await part("15. Day 30 ends in the middle of a change", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await signIn(page, OWNER, { keep: true });
  await setClock(30 * DAY - 10 * 60000);
  await page.goto(BASE + "/dealer#/settings");
  await page.reload();
  await settle(page);
  const box = page.locator('input[type="tel"]').first();
  const before = await box.inputValue();
  const typed = "(555) 010-0199";
  await box.fill(typed);
  await settle(page, 1000);
  ok("10 minutes before the 30 days end: Settings, a new phone typed, and the note on top says it ends soon", (await textOf(page, ".sign-in-ends")).startsWith(WORDS.endsSoon), await textOf(page, ".sign-in-ends"));
  await setClock(30 * DAY + 60000);
  let reloads = 0;
  page.on("load", () => { reloads++; });
  page.removeAllListeners("dialog");
  const asked = [];
  page.on("dialog", (d) => { asked.push(d.type()); d.dismiss().catch(() => {}); });
  await page.getByRole("button", { name: "Save settings" }).click();
  await sleep(2000);
  ok("the 30 days end, then Save settings: no reload, and no \"Leave site?\" box", reloads === 0 && asked.length === 0, `reloads ${reloads}, dialogs ${asked.join(",")}`);
  ok("... the typed phone is still there", (await box.inputValue().catch(() => "")) === typed, await box.inputValue().catch(() => "(gone)"));
  ok("... a note that stays says what happened and what to do", (await textOf(page, ".banner.signed-out")) === WORDS.midwork, await textOf(page, ".banner.signed-out"));
  await shot(page, "day-30-mid-change-1280");
  /* sign in again in a new tab, as the note says */
  const t2 = await open(ctx);
  ok("a new tab: the Sign in card, ticked (the same device)", isSignIn(await screen(t2)) && (await t2.getByLabel(WORDS.keep).isChecked()));
  ok("... signs in", isIn(await signIn(t2, OWNER, { keep: true })));
  await page.bringToFront();
  await sleep(1500);
  ok("back in the first tab: the note is gone, the phone still typed", !(await textOf(page, ".banner.signed-out")) && (await box.inputValue()) === typed);
  await page.getByRole("button", { name: "Save settings" }).click();
  await page.waitForFunction(() => /Saved/.test(document.querySelector(".toasts")?.textContent || ""), null, { timeout: 10000 }).catch(() => {});
  ok("... Save settings saves", /Saved/.test(await textOf(page, ".toast")), await textOf(page, ".toast"));
  await page.reload();
  await settle(page);
  ok("... and after a reload the new phone is there", (await page.locator('input[type="tel"]').first().inputValue()) === typed && before !== typed);
  await ctx.close();
});

/* ---- 16 ------------------------------------------------------------------- */
await part("16. Not ticked: 12 hours away ends it, whatever the browser kept", async () => {
  const ctx = await device();
  const page = await open(ctx);
  await signIn(page, OWNER);
  await setClock(11 * HOUR);
  await page.reload();
  await settle(page);
  ok("not ticked, the browser never closed: still in 11 hours later", isIn(await screen(page)));
  await setClock(11 * HOUR + 13 * HOUR);
  await page.reload();
  await settle(page);
  const s = await screen(page);
  ok("... 13 hours with nobody using it: the Sign in card, saying why", isSignIn(s) && s.note.includes(WORDS.idle), JSON.stringify(s));
  ok("... with the tick off", !(await page.getByLabel(WORDS.keep).isChecked()));
  await shot(page, "idle-12-hours-1280");
  await ctx.close();
});

/* ---- 17 ------------------------------------------------------------------- */
await part("17. Logins with capitals, and logins not on the team", async () => {
  /* a login made before "Make your login" saved emails in small letters */
  await identity({ addUser: { email: "Pat.Old@SampleBarns.example", password: "pats-password-1", name: "Pat Old" } });
  const ctx = await device();
  const page = await open(ctx);
  const before = (await identity({})).recoveries;
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await page.getByLabel("Email", { exact: true }).fill("Pat.Old@SampleBarns.example");
  await page.getByRole("button", { name: "Email me a link" }).click();
  await page.waitForSelector(".form-status:not(:empty)", { timeout: 10000 }).catch(() => {});
  const after = await identity({});
  ok("Forgot your password? for a login saved with capitals, typed as made: the link goes", after.recoveries === before + 1, `${before} -> ${after.recoveries}`);
  await page.getByRole("button", { name: "Back to sign in" }).click();
  /* a login that isn't on the team: no sign-in, words */
  await identity({ addUser: { email: "stranger@elsewhere.example", password: "strangers-password", name: "A Stranger" } });
  const s = await signIn(page, { email: "stranger@elsewhere.example", password: "strangers-password" }, { expect: "words" });
  ok("a login that isn't on the team: the card says to ask the owner, with the email", isSignIn(s) && s.status.startsWith(WORDS.notOnTeam) && s.status.includes("stranger@elsewhere.example"), JSON.stringify(s));
  ok("... and no sign-in cookie", !(await signInCookie(ctx)));
  await shot(page, "not-on-team-1280");
  await ctx.close();
});

/* ---- 18 ------------------------------------------------------------------- */
if (!ONLY || ONLY.includes("18")) {
  section("18. Signing out of the \"try it\" demo");
  const port3 = PORT + 2;
  const demoSite = startServer(port3, DATA + "-demo", ["--identity", "--demo"]);
  try {
    if (await waitFor(demoSite)) {
      const base3 = `http://127.0.0.1:${port3}`;
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      const real = await ctx.newPage();
      real.on("dialog", (d) => d.accept().catch(() => {}));
      await real.goto(base3 + "/dealer");
      await settle(real);
      await real.getByLabel("Email", { exact: true }).fill(OWNER.email);
      await real.getByLabel("Password", { exact: true }).fill(OWNER.password);
      const loaded = real.waitForEvent("load", { timeout: 15000 }).catch(() => null);
      await real.getByRole("button", { name: "Sign in", exact: true }).click();
      await loaded;
      await settle(real);
      ok("a real sign-in in one tab (a site that also offers the demo)", isIn(await screen(real)), JSON.stringify(await screen(real)));
      const demo = await ctx.newPage();
      await demo.goto(base3 + "/dealer?demo");
      await demo.waitForSelector(".person-pick", { timeout: 20000 });
      let l = demo.waitForEvent("load", { timeout: 15000 }).catch(() => null);
      await demo.locator(".person-pick").first().click();
      await l;
      await demo.waitForSelector(".topbar", { timeout: 30000 }).catch(() => {});
      let reloads = 0;
      real.on("load", () => { reloads++; });
      await demo.locator(".person-button").click();
      l = demo.waitForEvent("load", { timeout: 15000 }).catch(() => null);
      await demo.locator(".person-menu").getByRole("button", { name: "Sign out", exact: true }).click();
      await l;
      await sleep(2500);
      ok("signing out of the demo in another tab: the real tab doesn't reload and stays in", reloads === 0 && isIn(await screen(real)), `reloads ${reloads} ${JSON.stringify(await screen(real))}`);
      await ctx.close();
    } else ok("the local Dealer Center with the demo started", false, demoSite.log());
  } catch (e) {
    ok("18: the walk got to the end", false, String(e?.message || e).split("\n")[0]);
  }
  demoSite.proc.kill();
  rmSync(resolve(ROOT, DATA + "-demo"), { recursive: true, force: true });
}

/* ---- 14 --------------------------------------------------------------------- */
if (!ONLY || ONLY.includes("14")) {
section("14. The local Dealer Center's \"pick who you are\"");
  const port2 = PORT + 1;
  const plain = startServer(port2, DATA + "-plain", []);
  if (await waitFor(plain)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port2}/dealer`);
    await settle(page);
    const s = await screen(page);
    ok("\"Who are you?\" with no tick", s.heading === "Who are you?" && (await page.locator('input[type="checkbox"]').count()) === 0, JSON.stringify(s));
    await ctx.close();
  } else ok("the plain local Dealer Center started", false, plain.log());
  plain.proc.kill();
}

await browser.close();
if (!KEEP) server.proc.kill();
else console.log(`\nThe server is still running at ${BASE}/dealer`);
rmSync(resolve(ROOT, DATA + "-plain"), { recursive: true, force: true });

if (fail) {
  console.log(`\nFAIL: ${fail} of ${pass + fail} checks failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nPROVED (${pass} checks): in Chromium, the Sign in card has "${WORDS.keep}" (unticked, with its hint, a full-size row, at 390, 820 and 1280); ticked stays signed in through closing the browser with nothing a page script can read; unticked ends with the browser, or 12 hours unused when the browser keeps it; Sign out lands on a clean card at /dealer, asks first with unsaved changes, signs in again at once, leaves the iPad signed in (two hours later too) and redraws other tabs; Sign out on every device signs the iPad out even while Identity can't be asked, and never looks done when it isn't; a new password and day 31 each say why, the last day says when it ends, and day 31 starts ticked; day 30 ending mid-change keeps the change and Save works after signing in in a new tab; a leftover nf_jwt no longer loops; Identity trouble says so (never "don't match" or a bare card); Sign out never gets stuck; the invite and reset links sign in (the reset survives Identity breaking half way and stops a token kept from the old password); a login with capitals gets its reset link; a login not on the team gets words and no sign-in; the demo's Sign out leaves a real tab alone; a sign-in from before moves onto the cookie (or is cleared after the browser closed); an ended Barnwright visit's tab offers the sign-in; pictures in test/out/sign-in-screens/.`);
