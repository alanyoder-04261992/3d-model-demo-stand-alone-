/* CHECK: STAYING SIGNED IN, AND SIGNING OUT, ON THE SERVER.
   Run: node tools/check-sign-in.mjs           (check-all: node)

   WHY. Alan (Oct 2026): "if i sign out it doesn't let me log back in, add
   save login for 30 days". The Dealer Center now keeps the sign-in in its
   own cookie, set by its own server (server/office/session.js), with
   "Keep me signed in on this device for 30 days". A sign-in is the door to
   every customer, so this check tries every way it could be too loose or
   too strict.

   HOW. The real server code (createOffice) with the real Identity client
   (server/office/identity.js) talking to a pretend Netlify Identity
   (tools/lib/fake-identity.mjs, which spends a refresh token once used and
   drops every refresh token of a person on logout, the way Netlify's
   does), the sample business (server/office/sample.js) and a clock it can
   move. Every request is a real web request with an Origin header.

   WHAT IT PROVES:
    1. The cookie: __Host-, HttpOnly, Secure, SameSite=Strict, the whole
       site and no Domain; 32 days (30 and two to say why) when kept, none
       (until the browser closes) when not; the page's own refresh token is
       spent at once; Identity's old cookies are cleared.
    2. Signed in with it: the person, their role and their lots exactly as
       before; the access token renewed by the server when it runs out, one
       renewal for two requests at once.
    3. Day 29 still signed in; day 31 asked to sign in again, saying why;
       the records of an ended sign-in hold no tokens.
    4. Removed from the team: refused at once with a kept sign-in; put
       back, in again. A dealer's kept sign-in is still only a dealer's.
    5. Sign out: this device only, at once; Identity is not asked, so the
       other device stays signed in, also two hours later. Sign out on every
       device ends them all (and at Identity), saying why. A new password
       ends the others, saying why. A refresh token spent elsewhere ends it.
    6. Identity slow, down or busy: the answer is 503 "The sign-in isn't
       answering right now", never 401 "Please sign in" -- also for a sign-in
       from before the cookie (nf_jwt).
    7. No way around it: a made-up or changed cookie, another site, no
       Origin, a spent or unconfirmed refresh token, a stale nf_jwt for
       somebody else next to a good cookie; the old nf_jwt sign-in still
       works (a page open across a deploy); the cookie is never in an answer
       body or the log; at most 20 sign-ins at once per person and ended
       records tidied away.
   Prints PROVED with the count, or FAIL with what broke. */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { netlifyIdentity, identityClient } from "../server/office/identity.js";
import { seedSample, SAMPLE_PEOPLE } from "../server/office/sample.js";
import { fakeIdentity } from "./lib/fake-identity.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));
const manufacturer = readJson("library/manufacturers/standard.json");
const library = readJson("library/construction.json");
const templates = { full: readJson("companies/demo/company.json"), small: readJson("companies/starter/company.json") };

let passed = 0;
const failures = [];
function ok(what, cond, extra = "") {
  if (cond) { passed++; return true; }
  failures.push(what + (extra ? " -- " + extra : ""));
  console.log(`  FAIL ${what}${extra ? " -- " + String(extra).slice(0, 300) : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

/* ---- the pretend world ------------------------------------------------------- */

const SITE = "https://dealers.example";
const clock = { t: Date.parse("2026-10-11T14:00:00Z") };
const HOUR = 3600000, DAY = 86400000;
const idp = fakeIdentity({ clock: () => clock.t });
const PASSWORD = "sample-password-1";
for (const p of SAMPLE_PEOPLE) idp.addUser({ id: p.id, email: p.email, password: PASSWORD, name: p.name });
idp.addUser({ id: "u-unconfirmed", email: "new@elsewhere.example", password: PASSWORD, confirmed: false });
const OWNER = SAMPLE_PEOPLE[0], DEALER = SAMPLE_PEOPLE[2];   /* chris (owner), mike (dealer, Riverside) */

const logged = [];
const blobs = new MemoryBlobs();
const client = identityClient({ fetchImpl: idp.fetch, now: () => clock.t, timeoutMs: 300, refreshMs: 300 });
let seeding = null;
const office = createOffice({
  blobs, manufacturer, library, templates, ownerEmail: OWNER.email, siteUrl: SITE,
  now: () => new Date(clock.t), signIn: "netlify",
  identityUser: async (request) => (seeding ? seeding.user : netlifyIdentity({ client })(request)),
  identity: client,
  log: (...a) => logged.push(a.map(String).join(" ")),
});
await seedSample({
  office, clock: { set at(d) { if (d) clock.t = d.getTime(); }, get at() { return new Date(clock.t); } }, manufacturer, library,
  act: (person) => { seeding = person ? { user: { id: person.id, email: person.email, name: person.name, confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true } } : { user: null }; },
});
seeding = null;
clock.t = Date.parse("2026-10-11T14:00:00Z");

const answers = [];
async function call(method, path, { cookie = "", body, origin = SITE, headers = {} } = {}) {
  const init = { method, headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), ...headers } };
  if (body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(body); }
  const res = await office.handle(new Request(SITE + path, init), { clientIp: "1.2.3.4" });
  const text = await res.text();
  answers.push(text);
  let data = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, cookies: res.headers.getSetCookie() };
}
/* what Identity gives the page for a password: the refresh token (and the access token) */
async function passwordTokens(email, password = PASSWORD) {
  const r = await idp.handle(new Request(`${SITE}/.netlify/identity/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "password", username: email, password }) }));
  return r.json();
}
const cookieValue = (lines) => (lines.map((l) => /^__Host-dc_signin=([^;]*)/.exec(l)?.[1]).find((v) => v != null) ?? null);
/* a browser: sign in (keep or not) -> the Cookie header it then sends */
async function signIn(person, { keep = true, why } = {}) {
  const t = await passwordTokens(person.email);
  const r = await call("POST", "/api/office/session", { body: { refreshToken: t.refresh_token, keep, ...(why ? { why } : {}) } });
  return { r, cookie: `__Host-dc_signin=${cookieValue(r.cookies)}`, refreshToken: t.refresh_token, accessToken: t.access_token };
}
const refreshCalls = () => idp.calls.filter((c) => c.from === "server" && c.grant === "refresh_token").length;

/* ---- 1 ---------------------------------------------------------------------- */
section("1. The cookie");
{
  const s = await signIn(OWNER, { keep: true });
  ok("a fresh sign-in becomes the Dealer Center's cookie (201)", s.r.status === 201 && s.r.data?.ok === true && s.r.data?.keep === true, JSON.stringify(s.r.data));
  const line = s.r.cookies.find((l) => l.startsWith("__Host-dc_signin=")) || "";
  ok("... __Host-dc_signin, HttpOnly, Secure, SameSite=Strict, Path=/ and no Domain", /; HttpOnly/.test(line) && /; Secure/.test(line) && /; SameSite=Strict/.test(line) && /; Path=\//.test(line) && !/Domain=/i.test(line), line.replace(/=[^;]+/, "=…"));
  ok("... kept: Max-Age 32 days (30, and two to say why it ended)", /; Max-Age=2764800(;|$)/.test(line), line.replace(/=[^;]+/, "=…"));
  ok("... the value: a user key and 32 random bytes", /^__Host-dc_signin=[a-f0-9]{24}\.[A-Za-z0-9_-]{43};/.test(line));
  ok("... ends 30 days after it started", s.r.data.endsAt === new Date(clock.t + 30 * DAY).toISOString(), s.r.data.endsAt);
  ok("... Identity's old cookies (nf_jwt, nf_refresh) are cleared by the server, even HttpOnly ones", ["nf_jwt", "nf_refresh"].every((n) => s.r.cookies.some((l) => l.startsWith(`${n}=;`) && /Max-Age=0/.test(l))));
  const again = await call("POST", "/api/office/session", { body: { refreshToken: s.refreshToken, keep: true } });
  ok("the page's own refresh token is spent at once: handing it over again is refused", again.status === 401 && again.data?.error === "That sign-in ran out. Sign in again.", JSON.stringify(again.data));
  const atIdentity = await idp.handle(new Request(`${SITE}/.netlify/identity/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refreshToken }) }));
  ok("... and at Identity too", atIdentity.status === 400);
  const loose = await signIn(OWNER, { keep: false });
  const looseLine = loose.r.cookies.find((l) => l.startsWith("__Host-dc_signin=")) || "";
  ok("not kept: no Max-Age, so it goes when the browser closes", loose.r.status === 201 && !/Max-Age/.test(looseLine) && loose.r.data.keep === false, looseLine.replace(/=[^;]+/, "=…"));
}

/* ---- 2 ---------------------------------------------------------------------- */
section("2. Signed in with the cookie");
let owner = await signIn(OWNER, { keep: true });
let dealer = await signIn(DEALER, { keep: true });
{
  const me = await call("GET", "/api/office/me", { cookie: owner.cookie });
  ok("me: the owner, from the cookie alone", me.status === 200 && me.data.person?.role === "owner" && me.data.user?.id === OWNER.id, JSON.stringify(me.data?.person));
  ok("... me says the sign-in is kept and until when", me.data.session?.keep === true && me.data.session?.endsAt === owner.r.data.endsAt, JSON.stringify(me.data.session));
  const team = await call("GET", "/api/office/team", { cookie: owner.cookie });
  ok("the owner can open Team", team.status === 200 && Array.isArray(team.data.people));
  const dm = await call("GET", "/api/office/me", { cookie: dealer.cookie });
  ok("a dealer's kept sign-in: still a dealer, with only their lot", dm.status === 200 && dm.data.person?.role === "dealer" && dm.data.lots.map((l) => l.slug).join() === "riverside", JSON.stringify(dm.data.lots?.map((l) => l.slug)));
  ok("... Team is still refused", (await call("GET", "/api/office/team", { cookie: dealer.cookie })).status === 403);
  ok("... the price list still can't be changed", (await call("PUT", "/api/office/price-list", { cookie: dealer.cookie, body: { settings: {}, version: 1 } })).status === 403);
  const rows = (await call("GET", "/api/office/customers?lot=springfield", { cookie: dealer.cookie })).data?.rows || [];
  ok("... another lot's customers stay out of sight", rows.length === 0);
  const before = refreshCalls();
  clock.t += 2 * HOUR;
  const [a, b] = await Promise.all([call("GET", "/api/office/me", { cookie: owner.cookie }), call("GET", "/api/office/customers", { cookie: owner.cookie })]);
  ok("two hours later (the access token ran out): two requests at once both work", a.status === 200 && b.status === 200, `${a.status} ${b.status}`);
  ok("... the server renewed it once at Identity (never two renewals with the same token)", refreshCalls() - before === 1, String(refreshCalls() - before));
  const c = await call("GET", "/api/office/me", { cookie: owner.cookie });
  ok("... and keeps using the new one", c.status === 200 && refreshCalls() - before === 1);
}

/* ---- 3 ---------------------------------------------------------------------- */
section("3. Day 29 and day 31");
{
  const start = clock.t;
  const kept = await signIn(OWNER, { keep: true });
  const loose = await signIn(OWNER, { keep: false });
  clock.t = start + 29 * DAY;
  ok("day 29: still signed in (kept)", (await call("GET", "/api/office/me", { cookie: kept.cookie })).status === 200);
  clock.t = start + 30 * DAY + 60000;
  const me = await call("GET", "/api/office/me", { cookie: kept.cookie });
  ok("30 days and a minute: asked to sign in again (401)", me.status === 401 && me.data.error === "Please sign in.", JSON.stringify(me.data));
  ok("... saying why: it ran out, and it was kept", me.data.ended === "time" && me.data.kept === true, JSON.stringify(me.data));
  ok("... every other route too", (await call("GET", "/api/office/customers", { cookie: kept.cookie })).status === 401);
  const l = await call("GET", "/api/office/me", { cookie: loose.cookie });
  ok("a sign-in that wasn't kept ends at 30 days too (a browser left open)", l.status === 401 && l.data.ended === "time" && l.data.kept === false, JSON.stringify(l.data));
  const records = [...blobs.values.entries()].filter(([k]) => k.startsWith("sessions/")).map(([, v]) => v.data);
  ok("an ended sign-in's record keeps no tokens", records.filter((r) => r.ended).length >= 2 && records.filter((r) => r.ended).every((r) => !("refreshToken" in r) && !("accessToken" in r)));
  /* the others signed in this check run out too: sign them in again at this time */
  owner = await signIn(OWNER, { keep: true });
  dealer = await signIn(DEALER, { keep: true });
}

/* ---- 4 ---------------------------------------------------------------------- */
section("4. Removed from the team");
{
  const off = await call("PATCH", `/api/office/team/${DEALER.id}`, { cookie: owner.cookie, body: { active: false } });
  ok("the owner removes the dealer", off.status === 200, JSON.stringify(off.data));
  const me = await call("GET", "/api/office/me", { cookie: dealer.cookie });
  ok("... the dealer's kept sign-in sees nothing at once (not on the team)", me.status === 200 && me.data.person === null && me.data.lots.length === 0, JSON.stringify(me.data?.person));
  ok("... customers refused at once (403)", (await call("GET", "/api/office/customers", { cookie: dealer.cookie })).status === 403);
  await call("PATCH", `/api/office/team/${DEALER.id}`, { cookie: owner.cookie, body: { active: true } });
  ok("put back: in again with the same sign-in", (await call("GET", "/api/office/customers", { cookie: dealer.cookie })).status === 200);
}

/* ---- 5 ---------------------------------------------------------------------- */
section("5. Signing out");
{
  const computer = await signIn(OWNER, { keep: true });
  const ipad = await signIn(OWNER, { keep: true });
  const logoutsBefore = idp.calls.filter((c) => c.path === "/logout").length;
  const out = await call("POST", "/api/office/sign-out", { cookie: computer.cookie, body: {} });
  const line = out.cookies.find((l) => l.startsWith("__Host-dc_signin=")) || "";
  ok("Sign out: 200 and the cookie cleared (Max-Age=0)", out.status === 200 && /^__Host-dc_signin=;/.test(line) && /Max-Age=0/.test(line), line);
  ok("... Identity's old cookies cleared too", ["nf_jwt", "nf_refresh"].every((n) => out.cookies.some((l) => l.startsWith(`${n}=;`))));
  const me = await call("GET", "/api/office/me", { cookie: computer.cookie });
  ok("... this device is signed out at once, with no 'why' words (it was asked for)", me.status === 401 && (!me.data.ended || me.data.ended === "gone"), JSON.stringify(me.data));
  ok("... Identity was not asked to sign the person out everywhere", idp.calls.filter((c) => c.path === "/logout").length === logoutsBefore);
  ok("... the iPad is still signed in", (await call("GET", "/api/office/me", { cookie: ipad.cookie })).status === 200);
  clock.t += 2 * HOUR;
  ok("... and still two hours later (its token renewed)", (await call("GET", "/api/office/customers", { cookie: ipad.cookie })).status === 200);
  const again = await signIn(OWNER, { keep: true });
  ok("signing in again at once works", again.r.status === 201 && (await call("GET", "/api/office/me", { cookie: again.cookie })).data?.person?.role === "owner");
  ok("Sign out with no cookie at all: still 200", (await call("POST", "/api/office/sign-out", { body: {} })).status === 200);

  const phone = await signIn(OWNER, { keep: true });
  const all = await call("POST", "/api/office/sign-out", { cookie: again.cookie, body: { everywhere: true } });
  ok("Sign out on every device: 200", all.status === 200 && all.data.everywhere === true);
  const ip = await call("GET", "/api/office/me", { cookie: ipad.cookie });
  ok("... the iPad is signed out, saying why", ip.status === 401 && ip.data.ended === "everywhere", JSON.stringify(ip.data));
  ok("... the phone too", (await call("GET", "/api/office/me", { cookie: phone.cookie })).data?.ended === "everywhere");
  ok("... and Identity dropped the person's refresh tokens", idp.liveRefresh(OWNER.id).length === 0, String(idp.liveRefresh(OWNER.id).length));

  const desk = await signIn(OWNER, { keep: true });
  const lost = await signIn(OWNER, { keep: true, why: "reset" });
  ok("a new password (a reset link) signs in", lost.r.status === 201);
  const d = await call("GET", "/api/office/me", { cookie: desk.cookie });
  ok("... and signs out the other devices, saying why", d.status === 401 && d.data.ended === "password", JSON.stringify(d.data));
  ok("... but not the one that reset it", (await call("GET", "/api/office/me", { cookie: lost.cookie })).status === 200);

  /* Identity dropped the refresh token some other way (Netlify's own logout) */
  await idp.fetch(`${SITE}/.netlify/identity/logout`, { method: "POST", headers: { authorization: `Bearer ${(await passwordTokens(OWNER.email)).access_token}` } });
  clock.t += 2 * HOUR;
  const gone = await call("GET", "/api/office/me", { cookie: lost.cookie });
  ok("a refresh token Identity no longer takes ends the sign-in, saying so", gone.status === 401 && gone.data.ended === "identity", JSON.stringify(gone.data));
  owner = await signIn(OWNER, { keep: true });
}

/* ---- 6 ---------------------------------------------------------------------- */
section("6. Identity slow, down or busy");
{
  const s = await signIn(OWNER, { keep: true });
  clock.t += 2 * HOUR;     /* the access token ran out: the server has to ask Identity */
  for (const trouble of ["down", "slow", 503, 429]) {
    idp.trouble.server = trouble;
    const me = await call("GET", "/api/office/me", { cookie: s.cookie });
    ok(`Identity ${trouble}: 503 with plain words, not "Please sign in"`, me.status === 503 && me.data.error === "The sign-in isn't answering right now. Try again in a minute." && me.data.code === "sign-in-down", `${me.status} ${JSON.stringify(me.data)}`);
  }
  idp.trouble.server = 503;
  const t = await passwordTokens(OWNER.email);
  const hand = await call("POST", "/api/office/session", { body: { refreshToken: t.refresh_token, keep: true } });
  ok("handing over a fresh sign-in while Identity is down: 503, never 'ran out'", hand.status === 503, `${hand.status} ${JSON.stringify(hand.data)}`);
  idp.trouble.server = null;
  ok("Identity back: the same sign-in works (it was never ended)", (await call("GET", "/api/office/me", { cookie: s.cookie })).status === 200);
  /* a sign-in from before the cookie (the nf_jwt cookie), Identity down */
  const old = await passwordTokens(OWNER.email);
  idp.trouble.server = "down";
  const om = await call("GET", "/api/office/me", { cookie: `nf_jwt=${old.access_token}` });
  ok("Identity down for a sign-in from before (nf_jwt): 503 too, not 401", om.status === 503 && om.data.code === "sign-in-down", `${om.status} ${JSON.stringify(om.data)}`);
  idp.trouble.server = 429;
  ok("... Identity busy (429): 503 too", (await call("GET", "/api/office/customers", { cookie: `nf_jwt=${old.access_token}` })).status === 503);
  idp.trouble.server = null;
  ok("... and back: that old sign-in still works (a page open across a deploy)", (await call("GET", "/api/office/me", { cookie: `nf_jwt=${old.access_token}` })).data?.person?.role === "owner");
  const om2 = await call("GET", "/api/office/me", { cookie: `nf_jwt=${old.access_token}` });
  ok("... me says it isn't on the cookie yet (session null), so the page moves it", om2.status === 200 && om2.data.session === null);
}

/* ---- 7 ---------------------------------------------------------------------- */
section("7. No way around it");
{
  const real = owner.cookie.split("=")[1];
  const made = `__Host-dc_signin=${real.slice(0, 25)}${"A".repeat(43)}`;
  const m1 = await call("GET", "/api/office/me", { cookie: made });
  ok("a made-up cookie (a real person's key, random rest): 401", m1.status === 401 && m1.data.person === undefined);
  ok("a cookie with one letter changed: 401", (await call("GET", "/api/office/me", { cookie: `__Host-dc_signin=${real.slice(0, -1)}${real.endsWith("A") ? "B" : "A"}` })).status === 401);
  ok("a cookie in the wrong shape: 401", (await call("GET", "/api/office/me", { cookie: "__Host-dc_signin=hello" })).status === 401);
  const t = await passwordTokens(OWNER.email);
  ok("handing over from another website: 403", (await call("POST", "/api/office/session", { origin: "https://evil.example", body: { refreshToken: t.refresh_token, keep: true } })).status === 403);
  ok("... or with no Origin: 403", (await call("POST", "/api/office/session", { origin: null, body: { refreshToken: t.refresh_token, keep: true } })).status === 403);
  ok("Sign out from another website: 403 (the sign-in stays)", (await call("POST", "/api/office/sign-out", { origin: "https://evil.example", cookie: owner.cookie, body: {} })).status === 403
    && (await call("GET", "/api/office/me", { cookie: owner.cookie })).status === 200);
  ok("a made-up refresh token: 401 'That sign-in ran out'", (await call("POST", "/api/office/session", { body: { refreshToken: "made-up-token-123", keep: true } })).data?.error === "That sign-in ran out. Sign in again.");
  ok("no refresh token: 422", (await call("POST", "/api/office/session", { body: { keep: true } })).status === 422);
  ok("anything else in the body: 422", (await call("POST", "/api/office/session", { body: { refreshToken: t.refresh_token, keep: true, role: "owner" } })).status === 422);
  /* Identity issued a token for an unconfirmed email (it shouldn't): refused */
  const un = idp.users.find((u) => u.id === "u-unconfirmed");
  un.confirmed_at = "2026-10-01T00:00:00Z";
  const ut = await passwordTokens(un.email);
  un.confirmed_at = null;
  const uh = await call("POST", "/api/office/session", { body: { refreshToken: ut.refresh_token, keep: true } });
  ok("a login Identity says isn't confirmed: refused", uh.status === 401 && /Confirm your email/.test(uh.data?.error || ""), JSON.stringify(uh.data));
  /* a stale nf_jwt for somebody else, next to a good cookie: the cookie wins */
  const stranger = await passwordTokens(DEALER.email);
  const both = await call("GET", "/api/office/me", { cookie: `nf_jwt=${stranger.access_token}; ${owner.cookie}` });
  ok("a leftover nf_jwt of somebody else never beats the cookie", both.data?.person?.role === "owner", JSON.stringify(both.data?.person));
  const junk = await call("GET", "/api/office/me", { cookie: `nf_jwt=not-a-real-token-at-all-xxxxxxxx; ${owner.cookie}` });
  ok("a broken leftover nf_jwt doesn't block the cookie (it used to loop on Sign in)", junk.status === 200 && junk.data?.person?.role === "owner");
  /* a Barnwright visit's cookie is not a sign-in, and the sign-in cookie is not a visit */
  ok("the sign-in cookie is not a Barnwright visit", (await call("GET", "/api/office/barnwright/me", { cookie: owner.cookie })).status !== 200);
  /* at most 20 sign-ins at once */
  const many = [];
  for (let i = 0; i < 22; i++) { many.push(await signIn(SAMPLE_PEOPLE[1], { keep: false })); clock.t += 1000; }
  const live = [];
  for (const s of many) live.push((await call("GET", "/api/office/me", { cookie: s.cookie })).status === 200);
  ok("at most 20 sign-ins at once per person: the oldest end", live.filter(Boolean).length === 20 && !live[0] && !live[1] && live[21], live.map((x) => (x ? 1 : 0)).join(""));
  clock.t += 3 * DAY;
  await signIn(SAMPLE_PEOPLE[1], { keep: false });
  const left = [...blobs.values.entries()].filter(([k, v]) => k.startsWith("sessions/") && v.data.userId === SAMPLE_PEOPLE[1].id && v.data.ended && Date.parse(v.data.endedAt) + 2 * DAY <= clock.t);
  ok("ended records go two days later, at that person's next sign-in", left.length === 0, String(left.length));
  /* nothing secret in any answer or the log */
  const secrets = [...blobs.values.entries()].filter(([k]) => k.startsWith("sessions/")).flatMap(([, v]) => [v.data.refreshToken, v.data.accessToken]).filter(Boolean);
  const cookieValues = [owner.cookie, dealer.cookie].map((c) => c.split("=")[1]);
  const all = answers.join("\n") + "\n" + logged.join("\n");
  ok("no answer body and no log line ever holds a sign-in cookie or a token the server keeps", [...secrets, ...cookieValues].every((s) => !all.includes(s)), String(secrets.length));
  ok("the records hold only the cookie's hash", [...blobs.values.keys()].filter((k) => k.startsWith("sessions/")).every((k) => /^sessions\/[a-f0-9]{24}\/[a-f0-9]{64}$/.test(k) && !cookieValues.some((v) => k.includes(v))));
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} checks failed:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`\nPROVED (${passed} checks): the Dealer Center's own sign-in cookie (__Host-, HttpOnly, Secure, SameSite=Strict) keeps a person signed in 30 days when kept and until the browser closes when not, renews Identity's token on the server (once for two requests), ends on day 31 saying why, keeps every role and lot rule and refuses a removed person at once, signs out this device only (or every device, or after a new password) without signing out the iPad, answers 503 instead of "Please sign in" when Identity is slow, down or busy, and can't be made up, borrowed by another site, beaten by a leftover nf_jwt or found in an answer or the log.`);
