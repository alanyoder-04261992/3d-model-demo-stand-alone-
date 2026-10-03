/* CHECK: THE DEALER CENTER'S SERVER KEEPS EVERY RULE IN docs/OFFICE.md.
   Run: node tools/check-office.mjs            (check-all: node)

   WHY. The Dealer Center (/dealer) is where a shed business keeps its price
   list, its lots, its team and every customer. The screens only hide what a
   person may not do; the server (server/office/) is what really stops a
   dealer from reading another lot's customers, a website visitor from
   sending a cheaper price, or two people working at once from losing each
   other's notes. Those rules are easy to break without noticing, so this
   check tries every one of them.

   HOW. It runs the real server code (createOffice) on an in-memory filing
   cabinet (MemoryBlobs, which behaves like Netlify Blobs), with a pretend
   sign-in it can switch between people, a clock it can move, a pretend
   email service that only writes down what it was asked to send, and the
   real builder's library, construction settings and example price lists
   (companies/demo and companies/starter). Every request is a real web
   request with an Origin header, as a browser sends it. Nothing is sent
   anywhere and nothing touches Netlify.

   WHAT IT PROVES, one heading each:
    1. Sign-in: no login, an unconfirmed login, an email Identity never
       checked, a second account with the owner's email, owner roles on a
       person's own profile -- none of them get in; OWNER_EMAIL claims the
       business once, and changing it later makes nobody owner.
    2. First setup: only the owner, only once; the designer starts closed.
    3. Lots: link names, websites cleaned to the site itself, closing.
    4. Team: invites (emailed only when asked and email is on), the first
       sign-in claims the invite, re-adding updates, the last owner stays,
       a removed person loses access at once.
    5. Who can do what: every management route for owner, manager, dealer.
    6. The price list: versions, cfg only for prices, 409 for a stale save,
       history in words, putting an old copy back, plain-word problems.
    7. Website quote requests: priced on the server, forged fields refused,
       safe to send twice, rate limits, matching a lot's own customers,
       emails that never block a quote, no contact details in the answer.
    8. The 38 damaged or forged designs from the old check, refused.
    9. Price parity: every style, size and electrical package of three
       example price lists costs exactly what the designer shows (1,380+).
   10. A price change reaches every lot at once; quotes keep their price;
       a design made before the change is priced again or sent back.
   11. Customers: add, edit, stages, follow-ups, notes, quotes, orders.
   12. Lots are walls: a dealer never sees or changes another lot's
       customers (404, never 403); closing a lot keeps its customers.
   13. Working at the same moment: notes, numbers, orders and list rows.
   14. The spreadsheet: owner and manager only, formula cells defused.
   15. Request safety: Origin, JSON only, size, reserved keys, routes,
       methods, and internal errors that never show their details.
   16. Words: every message a person could read is plain words.
   Prints PROVED with the counts, or FAIL with what broke. */

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { priceOrExplain } from "../server/office/pricing.js";
import { rowOf } from "../server/office/customers.js";
import { resolve } from "../model/company.js";
import { defaults, fromState, toState } from "../model/design.js";
import { priceParts } from "../model/pricing.js";
import { pkFixtures } from "../model/layout.js";
import { frameOf } from "../model/frame.js";
import { setElec, toggleExt } from "../ui/state.js";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(readFileSync(resolvePath(ROOT, p), "utf8"));
const manufacturer = readJson("library/manufacturers/standard.json");
const library = readJson("library/construction.json");
const templates = { full: readJson("companies/demo/company.json"), small: readJson("companies/starter/company.json") };
const clone = structuredClone;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (s) => createHash("sha256").update(s).digest("hex");
const dollars = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

/* The two sentences a customer sees when a design is refused. */
const UNREADABLE = "This design could not be read. Refresh the page and try again.";
const NOT_OFFERED = "Something in this building is no longer offered. Refresh the page to see today's options, then send it again.";

/* ---- counting -------------------------------------------------------------- */

let passed = 0;
const failures = [];
const perSection = [];
function section(title) {
  perSection.push({ title, n: 0 });
  console.log(`\n${title}`);
}
function ok(what, cond, extra = "") {
  perSection[perSection.length - 1].n++;
  if (cond) { passed++; return true; }
  const line = `${perSection[perSection.length - 1].title} -- ${what}${extra ? " -- " + extra : ""}`;
  failures.push(line);
  console.log(`  FAIL ${what}${extra ? " -- " + extra : ""}`);
  return false;
}
function sectionDone() {
  const s = perSection[perSection.length - 1];
  console.log(`  ${s.n} checks`);
}

/* ---- the people Identity knows ------------------------------------------------ */

const SITE = "https://dealers.example";
const OWNER_EMAIL = "alan@yoder.example";
const IDENTITY = {};
function identity(id, email, more = {}) {
  IDENTITY[id] = { id, email, name: "", confirmedAt: "2026-01-02T03:04:05Z", emailVerified: true, ...more };
  return IDENTITY[id];
}
identity("u-alan", OWNER_EMAIL, { name: "Alan Yoder" });
identity("u-sarah", "sarah@yoder.example", { name: "Sarah Miller" });
identity("u-mike", "mike@yoder.example", { name: "Mike Hostetler" });
identity("u-dana", "dana@yoder.example", { name: "Dana Ruiz" });
identity("u-lee", "lee@yoder.example", { name: "Lee Carter" });
identity("u-pat", "pat@yoder.example", { name: "Pat Owner" });
identity("u-stranger", "stranger@example.com");
/* the owner's email, but Identity never confirmed it -- and the person put
   owner roles on their own profile */
identity("u-unconfirmed", OWNER_EMAIL, { confirmedAt: null, roles: ["owner"], app_metadata: { roles: ["admin"] }, userMetadata: { role: "owner" } });
/* the owner's email, confirmed, but Identity is on "autoconfirm" (anybody
   could have typed it) */
identity("u-unverified", OWNER_EMAIL, { emailVerified: false });
/* a second Identity account with the owner's email */
identity("u-twin", OWNER_EMAIL);
identity("u-profile", "profile@example.com", { roles: ["owner", "admin"], userMetadata: { role: "owner", lots: ["port-charlotte"] }, app_metadata: { roles: ["owner"] } });

let signedIn = null;
const as = (id) => { signedIn = id; };

/* ---- the server under test ------------------------------------------------------ */

const clock = { t: Date.parse("2026-10-03T14:00:00Z") };
const sent = [];
const logged = [];
let emailBroken = false;
const blobs = new MemoryBlobs();

function makeOffice(over = {}) {
  return createOffice({
    blobs,
    /* who is signed in: the person named on the request (for requests sent
       at the same moment by different people), else the current person */
    identityUser: async (request) => {
      const id = request?.headers.get("x-test-as") || signedIn;
      return id && IDENTITY[id] ? clone(IDENTITY[id]) : null;
    },
    ownerEmail: OWNER_EMAIL,
    manufacturer, library, templates,
    now: () => new Date(clock.t),
    sendEmail: async (message) => {
      if (emailBroken) throw new Error("the email service is down");
      sent.push(message);
      return true;
    },
    siteUrl: SITE,
    signIn: "netlify",
    log: (...parts) => logged.push(parts.map((p) => (p instanceof Error ? p.message : String(p))).join(" ")),
    ...over,
  });
}
let office = makeOffice();
const S = office.parts.store;          /* the same filing cabinet, read directly */

/* ---- sending requests ------------------------------------------------------------- */

const wordsSeen = [];                  /* every error sentence, for section 16 */
async function call(method, path, body, opts = {}) {
  const { origin = SITE, type = "application/json", raw, headers = {}, ip = "203.0.113.10", app = office, who } = opts;
  const h = new Headers(headers);
  if (origin) h.set("Origin", origin);
  if (who) h.set("x-test-as", who);
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) payload = JSON.stringify(body);
  if (payload !== undefined && type) h.set("Content-Type", type);
  const res = await app.handle(new Request(SITE + path, { method, headers: h, body: payload }), { clientIp: ip });
  const text = await res.text();
  let data = text;
  try { data = JSON.parse(text); } catch { /* the spreadsheet */ }
  if (data && typeof data === "object" && typeof data.error === "string") {
    wordsSeen.push({ where: `${method} ${path}`, words: data.error });
    for (const p of data.problems || []) wordsSeen.push({ where: `${method} ${path}`, words: p });
  }
  return { status: res.status, data, text, headers: res.headers };
}
/* call, and check the status; -> the answer's data */
async function want(status, method, path, body, opts = {}) {
  const r = await call(method, path, body, opts);
  const label = opts.label || `${opts.who || signedIn || "nobody"}: ${method} ${path}`;
  ok(`${label} answers ${status}`, r.status === status, `it answered ${r.status}: ${r.text.slice(0, 300)}`);
  return r.data;
}

let keySeq = 0;
const freshKey = () => `check-office-${String(++keySeq).padStart(6, "0")}`;
const visitorIp = () => `198.51.100.${(keySeq % 200) + 1}`;
async function sendQuote(slug, design, contact, { key = freshKey(), ip = visitorIp(), status = 201, extra = {}, label } = {}) {
  return want(status, "POST", `/api/lots/${slug}/quote-requests`, { design, contact, idempotencyKey: key, ...extra }, { ip, label: label || `website send to ${slug}` });
}
const requestKey = (slug, key) => `website-requests/${sha(`${slug}:${key}`).slice(0, 40)}`;

async function liveCat() {
  return (await office.parts.priceList.catalogue()).cat;
}
/* A design of the business's 3D designer: the standard building of a
   style and size (its standard doors and windows), changed by `change`. */
function designOf(cat, type, size, change) {
  const d = fromState(defaults(cat), cat);
  if (type) { d.type = type; d.size = size; delete d.items; }
  const state = toState(d, cat).state;
  if (change) change(state);
  return { design: fromState(state, cat), state };
}
async function allCustomers() {
  return S.all("customers/");
}
async function quoteCount() {
  return (await allCustomers()).reduce((n, c) => n + c.quotes.length, 0);
}
/* The list rows agree with the customer: their lot's list has exactly
   rowOf(customer), and no other lot's list has a row for them. */
async function rowsRight(id) {
  const c = await S.get(`customers/${id}`);
  for (const key of await S.keys("lists/")) {
    const row = (await S.get(key))?.rows?.[id];
    if (key === `lists/${c.lot}`) { if (!same(row, rowOf(c))) return false; }
    else if (row) return false;
  }
  return true;
}

/* ======================================================================= */
section("1. Sign-in: only a confirmed login on the team gets in; the first owner is claimed once");

as(null);
let r = await call("GET", "/api/office/me");
ok("nobody signed in: me answers 401", r.status === 401, r.text);
ok("... and names the sign-in screen to show", r.data.signIn === "netlify");
await want(401, "GET", "/api/office/customers");
await want(401, "POST", "/api/office/customers", { lot: "port-charlotte", name: "A", phone: "9415550100" });
await want(401, "POST", "/api/office/setup", { businessName: "Nobody's Barns" });

as("u-unconfirmed");
await want(401, "GET", "/api/office/me");
ok("an unconfirmed login with the owner's email and owner roles on its profile claims nothing", !(await S.get("setup")));

as("u-unverified");
let me = await want(200, "GET", "/api/office/me");
ok("an email Identity never checked (autoconfirm) does not make the owner", me.person === null);
ok("... and the business is still unclaimed", !(await S.get("setup")));
await want(403, "GET", "/api/office/price-list");

as("u-alan");
me = await want(200, "GET", "/api/office/me");
ok("the first confirmed OWNER_EMAIL login becomes the owner", me.person?.role === "owner");
ok("... before setup the business is null and setup is needed", me.business === null && me.setupNeeded === true);
ok("... the claim names that login", (await S.get("setup"))?.userId === "u-alan");
ok("... me never answers with Identity roles", !("roles" in (me.user || {})));

as("u-twin");
me = await want(200, "GET", "/api/office/me");
ok("a second Identity account with the owner's email is not an owner", me.person === null);
ok("... the claim still names the first login", (await S.get("setup"))?.userId === "u-alan");
ok("... no person record was made for it", !(await S.get("people/u-twin")));
await want(403, "GET", "/api/office/customers");

const laterOffice = makeOffice({ ownerEmail: "stranger@example.com" });
as("u-stranger");
r = await call("GET", "/api/office/me", undefined, { app: laterOffice });
ok("changing OWNER_EMAIL after the claim makes nobody an owner", r.status === 200 && r.data.person === null, r.text);
await want(403, "GET", "/api/office/team", undefined, { app: laterOffice });

as("u-profile");
me = await want(200, "GET", "/api/office/me");
ok("owner roles and lots on a person's own Identity profile grant nothing", me.person === null && same(me.lots, []));
for (const path of ["/api/office/customers", "/api/office/team", "/api/office/price-list", "/api/office/lots", "/api/office/customers.csv", "/api/office/price-list/history"]) {
  await want(403, "GET", path);
}
await want(403, "POST", "/api/office/setup", { businessName: "Profile Barns" });
await want(403, "POST", "/api/office/lots", { name: "Profile Lot" });
sectionDone();

/* ======================================================================= */
section("2. First setup: only the owner, only once, and closed to customers until opened");

as("u-alan");
await want(404, "GET", "/api/office/price-list");
await want(422, "POST", "/api/office/setup", { businessName: "" });
await want(422, "POST", "/api/office/setup", { businessName: "Yoder Storage Barns", email: "not-an-email" });
await want(422, "POST", "/api/office/setup", { businessName: "Yoder Storage Barns", website: "http://yoderbarns.example" });
ok("a refused setup saved nothing", !(await S.get("price-list")));
const setup = await want(201, "POST", "/api/office/setup", {
  businessName: "Yoder Storage Barns", yourName: "Alan Yoder", phone: "(941) 555-0100",
  email: "office@yoderbarns.example", website: "yoderbarns.example", start: "full",
});
ok("setup answers the business, closed to customers", setup.business?.name === "Yoder Storage Barns" && setup.business.open === false);
await want(409, "POST", "/api/office/setup", { businessName: "Second Try" });
let pl = await want(200, "GET", "/api/office/price-list");
ok("the price list starts at version 1 with cfg 1 (also at the top)", pl.version === 1 && pl.cfg === 1 && pl.settings.cfg === 1);
ok("... closed to customers", pl.settings.status === "suspended");
ok("... the business website made a full address", pl.settings.brand.website === "https://yoderbarns.example/", pl.settings.brand.website);
ok("... the business id made from its name", pl.settings.id === "yoder-storage-barns");
ok("... every style of the full example price list", same(Object.keys(pl.settings.offer).sort(), Object.keys(templates.full.offer).filter((k) => !k.startsWith("_")).sort()));
ok("... quote requests come to the Dealer Center (leads mode none)", pl.settings.leads.mode === "none");
const firstHistory = await want(200, "GET", "/api/office/price-list/history");
ok("setup is the first history entry, in words", firstHistory.entries.length === 1 && /starting price list/.test(firstHistory.entries[0].changes[0]));
me = await want(200, "GET", "/api/office/me");
ok("after setup me has the business and needs no setup", me.business?.name === "Yoder Storage Barns" && me.setupNeeded === false);
ok("... and the owner's name from setup", me.person.name === "Alan Yoder");

const portCharlotte = await want(201, "POST", "/api/office/lots", {
  name: "Port Charlotte", address: "4250 Tamiami Trail", city: "Port Charlotte", state: "FL", zip: "33952",
  phone: "(941) 555-0140", email: "portcharlotte@yoderbarns.example", hours: "Mon–Fri 9–5\nSat 9–2", embedOrigins: ["yoderbarns.example"],
});
as(null);
await want(404, "GET", "/api/lots/port-charlotte", undefined, { label: "a lot's designer before the business is open" });
await want(404, "POST", "/api/lots/port-charlotte/quote-requests", { design: {}, contact: { name: "A" }, idempotencyKey: freshKey() }, { label: "a quote request before the business is open" });

as("u-alan");
pl = await want(200, "GET", "/api/office/price-list");
const opened = await want(200, "PUT", "/api/office/price-list", { settings: { ...pl.settings, status: "active" }, version: pl.version });
ok("opening the designer says so in words", opened.changes?.includes("Opened the designer to customers"), JSON.stringify(opened.changes));
ok("... and does not raise cfg (nothing a customer pays for changed)", opened.cfg === 1 && opened.version === 2);
as(null);
const pub = await want(200, "GET", "/api/lots/port-charlotte");
ok("once open, the lot's designer gets the price list and the lot", pub.company?.id === "yoder-storage-barns" && pub.lot?.slug === "port-charlotte" && pub.version === 2);
ok("... and nothing private (who saved, who made the lot)", !("savedBy" in pub) && !("createdBy" in pub.lot) && !JSON.stringify(pub).includes("u-alan"));
sectionDone();

/* ======================================================================= */
section("3. Lots: link names, websites cleaned to the site itself, closing");

as("u-alan");
ok("a lot's link name comes from its name", portCharlotte.lot.slug === "port-charlotte");
ok("\"yoderbarns.example\" is kept as https://yoderbarns.example", same(portCharlotte.lot.embedOrigins, ["https://yoderbarns.example"]));
const puntaGorda = await want(201, "POST", "/api/office/lots", {
  name: "Punta Gorda", city: "Punta Gorda", state: "FL", phone: "(941) 555-0172", email: "puntagorda@yoderbarns.example",
  embedOrigins: ["https://www.puntagorda.example/sheds/page?x=1", "http://localhost:3000", "PUNTAGORDA.example", "https://www.puntagorda.example"],
});
ok("websites lose their paths, keep localhost on http, lower-case, and repeat once",
  same(puntaGorda.lot.embedOrigins, ["https://www.puntagorda.example", "http://localhost:3000", "https://puntagorda.example"]), JSON.stringify(puntaGorda.lot.embedOrigins));
const arcadia = await want(201, "POST", "/api/office/lots", { name: "Arcadia", city: "Arcadia", state: "FL", website: "arcadiasheds.example" });
ok("a lot without email is fine; its website becomes a full address", arcadia.lot.slug === "arcadia" && arcadia.lot.website === "https://arcadiasheds.example/");
const second = await want(201, "POST", "/api/office/lots", { name: "Port Charlotte" });
ok("the same name again gets -2", second.lot.slug === "port-charlotte-2");
const taken = await want(409, "POST", "/api/office/lots", { name: "Another", slug: "port-charlotte" });
ok("an explicit link name that is taken says so", /port-charlotte/.test(taken.error) && /taken/.test(taken.error));
await want(422, "POST", "/api/office/lots", { name: "Bad", slug: "Bad Slug!" });
for (const [label, origins] of [
  ["a * website", ["*"]], ["a wildcard website", ["https://*.mysite.example"]], ["a plain http website", ["http://mysite.example"]],
  ["a website with a policy in it", ["https://example.test;script-src"]], ["an ftp address", ["ftp://files.example"]],
  ["eleven websites", Array.from({ length: 11 }, (_, i) => `https://site${i}.example`)], ["a website that is not text", [42]],
]) {
  await want(422, "POST", "/api/office/lots", { name: "Refused Lot", embedOrigins: origins }, { label: `a lot with ${label}` });
}
ok("a refused lot was never saved", !(await S.get("lots/refused-lot")));
await want(422, "POST", "/api/office/lots", { name: "Odd", colour: "red" }, { label: "a lot with a field nobody knows" });
await want(422, "POST", "/api/office/lots", { name: "" }, { label: "a lot without a name" });
await want(422, "PATCH", "/api/office/lots/port-charlotte-2", { slug: "somewhere-else" }, { label: "changing a lot's link name" });
const renamed = await want(200, "PATCH", "/api/office/lots/port-charlotte-2", { name: "Port Charlotte North" });
ok("renaming a lot keeps its link", renamed.lot.slug === "port-charlotte-2" && renamed.lot.name === "Port Charlotte North");
await want(404, "PATCH", "/api/office/lots/no-such-lot", { name: "X" });
const closedLot = await want(200, "PATCH", "/api/office/lots/port-charlotte-2", { active: false });
ok("a lot can be closed", closedLot.lot.active === false);
as(null);
await want(404, "GET", "/api/lots/port-charlotte-2", undefined, { label: "a closed lot's designer" });
as("u-alan");
const lotList = await want(200, "GET", "/api/office/lots");
ok("the owner sees every lot, open ones first", lotList.lots.length === 4 && lotList.lots[lotList.lots.length - 1].slug === "port-charlotte-2");
sectionDone();

/* ======================================================================= */
section("4. Team: invites, roles, the last owner, removing people");

as("u-alan");
let added = await want(201, "POST", "/api/office/team", { email: "Mike@Yoder.example", name: "Mike Hostetler", role: "dealer", lots: ["port-charlotte"], sendEmail: true });
ok("adding an email makes an invite (email kept in lower case)", added.invite?.email === "mike@yoder.example" && added.person === null);
ok("... emailed, because the owner asked and email is on", added.emailed === true && sent.at(-1)?.to === "mike@yoder.example");
ok("... the email names the Dealer Center, the role and the email to use",
  /Dealer Center/.test(sent.at(-1).text) && /as a dealer/.test(sent.at(-1).text) && sent.at(-1).text.includes("mike@yoder.example") && sent.at(-1).text.includes(`${SITE}/dealer`));
let emailsBefore = sent.length;
added = await want(201, "POST", "/api/office/team", { email: "dana@yoder.example", name: "Dana Ruiz", role: "dealer", lots: ["punta-gorda"] });
ok("an invite is not emailed unless the owner asks", added.emailed === false && sent.length === emailsBefore);
await want(201, "POST", "/api/office/team", { email: "lee@yoder.example", name: "Lee Carter", role: "dealer", lots: ["arcadia", "punta-gorda", "arcadia"] });
added = await want(201, "POST", "/api/office/team", { email: "sarah@yoder.example", name: "Sarah Miller", role: "manager", lots: ["port-charlotte"] });
ok("a manager's invite has no lots (a manager works every lot)", same(added.invite.lots, []));

const quietOffice = makeOffice({ sendEmail: null });
r = await call("POST", "/api/office/team", { email: "temp1@yoder.example", name: "Temp One", role: "dealer", lots: ["arcadia"], sendEmail: true }, { app: quietOffice });
ok("with email off, asking to email the invite saves it and emails nothing", r.status === 201 && r.data.emailed === false && sent.length === emailsBefore, r.text);
emailBroken = true;
r = await call("POST", "/api/office/team", { email: "temp2@yoder.example", name: "Temp Two", role: "dealer", lots: ["arcadia"], sendEmail: true });
emailBroken = false;
ok("an invite email that fails still saves the invite", r.status === 201 && r.data.emailed === false && !!(await S.get(`invites/${sha("temp2@yoder.example").slice(0, 40)}`)), r.text);
ok("... and the failure is logged, not shown", logged.some((l) => /invite email/.test(l)));

await want(422, "POST", "/api/office/team", { email: "x1@yoder.example", name: "X", role: "dealer", lots: [] }, { label: "a dealer with no lot" });
await want(422, "POST", "/api/office/team", { email: "x2@yoder.example", name: "X", role: "dealer", lots: ["nowhere"] }, { label: "a dealer at a lot that does not exist" });
await want(422, "POST", "/api/office/team", { email: "x3@yoder.example", name: "X", role: "boss" }, { label: "a role nobody knows" });
await want(422, "POST", "/api/office/team", { email: "not an email", name: "X", role: "manager" }, { label: "an address that is not an email" });
await want(422, "POST", "/api/office/team", { email: "x4@yoder.example", role: "manager" }, { label: "a person without a name" });

for (const id of ["u-mike", "u-dana", "u-lee", "u-sarah"]) {
  as(id);
  me = await want(200, "GET", "/api/office/me");
  ok(`${IDENTITY[id].name}'s first sign-in claims the invite`, !!me.person && me.person.email === IDENTITY[id].email);
}
as("u-mike");
me = await want(200, "GET", "/api/office/me");
ok("the invite's role and lots became the person's", me.person.role === "dealer" && same(me.person.lots, ["port-charlotte"]));
ok("... and a dealer's me lists only their lots", same(me.lots.map((l) => l.slug), ["port-charlotte"]));
ok("... the used invite is gone", !(await S.get(`invites/${sha("mike@yoder.example").slice(0, 40)}`)));
as("u-lee");
me = await want(200, "GET", "/api/office/me");
ok("a dealer can work more than one lot (repeats dropped)", same(me.person.lots, ["arcadia", "punta-gorda"]));

as("u-alan");
await want(201, "POST", "/api/office/team", { email: "eve@yoder.example", name: "Eve Stone", role: "dealer", lots: ["arcadia"] });
identity("u-eve-unverified", "eve@yoder.example", { emailVerified: false });
identity("u-eve", "eve@yoder.example", { name: "Eve" });
as("u-eve-unverified");
me = await want(200, "GET", "/api/office/me");
ok("an invited email Identity never checked does not claim the invite", me.person === null && !!(await S.get(`invites/${sha("eve@yoder.example").slice(0, 40)}`)));
as("u-eve");
me = await want(200, "GET", "/api/office/me");
ok("... the same email, checked, does (with the name the owner typed)", me.person?.role === "dealer" && me.person.name === "Eve Stone");

as("u-alan");
const temp3 = await want(201, "POST", "/api/office/team", { email: "temp3@yoder.example", name: "Temp Three", role: "manager" });
await want(200, "DELETE", `/api/office/team/invites/${temp3.invite.id}`);
await want(404, "DELETE", `/api/office/team/invites/${temp3.invite.id}`, undefined, { label: "cancelling the same invite again" });
await want(404, "DELETE", "/api/office/team/invites/not-an-invite", undefined, { label: "cancelling an invite that is not one" });
identity("u-temp3", "temp3@yoder.example");
as("u-temp3");
me = await want(200, "GET", "/api/office/me");
ok("a cancelled invite gives no access", me.person === null);

as("u-alan");
added = await want(201, "POST", "/api/office/team", { email: "mike@yoder.example", name: "Mike H.", role: "manager" });
ok("adding an email that already has access changes that person", added.person?.userId === "u-mike" && added.person.role === "manager" && added.invite === null);
await want(422, "PATCH", "/api/office/team/u-mike", { role: "dealer", lots: [] }, { label: "making someone a dealer with no lot" });
const mikeBack = await want(200, "PATCH", "/api/office/team/u-mike", { role: "dealer", lots: ["port-charlotte"], name: "Mike Hostetler" });
ok("... and back to a dealer at their lot", mikeBack.person.role === "dealer" && same(mikeBack.person.lots, ["port-charlotte"]));

let lastOwner = await want(422, "PATCH", "/api/office/team/u-alan", { role: "manager" }, { label: "demoting the only owner" });
ok("the last owner cannot be demoted, in words", lastOwner.error === "Every business needs at least one owner.");
await want(422, "PATCH", "/api/office/team/u-alan", { active: false }, { label: "removing the only owner" });
await want(422, "POST", "/api/office/team", { email: OWNER_EMAIL, name: "Alan", role: "dealer", lots: ["arcadia"] }, { label: "re-adding the only owner as a dealer" });
ok("the only owner is still an active owner", (await S.get("people/u-alan")).role === "owner" && (await S.get("people/u-alan")).active !== false);

await want(201, "POST", "/api/office/team", { email: "pat@yoder.example", name: "Pat Owner", role: "owner" });
as("u-pat");
me = await want(200, "GET", "/api/office/me");
ok("there can be a second owner", me.person?.role === "owner");
const race = await Promise.all([
  call("PATCH", "/api/office/team/u-pat", { role: "manager" }, { who: "u-alan" }),
  call("PATCH", "/api/office/team/u-alan", { role: "manager" }, { who: "u-pat" }),
]);
const ownersLeft = (await S.all("people/")).filter((p) => p.role === "owner" && p.active !== false);
ok("two owners demoting each other at the same moment still leave an owner", ownersLeft.length >= 1, JSON.stringify(race.map((x) => x.status)));
ok("... and at least one of them is told why", race.some((x) => x.status === 422 && x.data.error === "Every business needs at least one owner."), JSON.stringify(race.map((x) => x.status)));
/* put both back as owners, then remove Pat */
const remaining = ownersLeft[0].userId;
await want(200, "PATCH", `/api/office/team/${remaining === "u-alan" ? "u-pat" : "u-alan"}`, { role: "owner" }, { who: remaining, label: "putting the other owner back" });
as("u-alan");
await want(200, "PATCH", "/api/office/team/u-pat", { active: false });
as("u-pat");
me = await want(200, "GET", "/api/office/me");
ok("a removed owner loses access at once", me.person === null);
await want(403, "GET", "/api/office/customers");
await want(403, "PUT", "/api/office/price-list", { settings: {}, version: 1 });

as("u-alan");
await want(200, "PATCH", "/api/office/team/u-dana", { active: false });
as("u-dana");
await want(403, "GET", "/api/office/customers", undefined, { label: "a removed dealer" });
as("u-alan");
await want(200, "PATCH", "/api/office/team/u-dana", { active: true });
as("u-dana");
await want(200, "GET", "/api/office/customers", undefined, { label: "the dealer, added back" });
as("u-alan");
await want(404, "PATCH", "/api/office/team/nobody-here", { name: "X" });
await want(422, "PATCH", "/api/office/team/u-dana", { active: "no" }, { label: "can-sign-in that is not yes or no" });
const team = await want(200, "GET", "/api/office/team");
ok("the team page lists the people and the invites not yet used",
  ["u-alan", "u-sarah", "u-mike", "u-dana", "u-lee", "u-eve"].every((id) => team.people.some((p) => p.userId === id)) && team.invites.some((i) => i.email === "temp2@yoder.example"));
ok("... owners first", team.people[0].role === "owner");
sectionDone();

/* ======================================================================= */
section("5. Who can do what: every management route for owner, manager and dealer");

as("u-alan");
pl = await want(200, "GET", "/api/office/price-list");
const MATRIX = [
  /* method, path, body, [owner, manager, dealer] */
  ["GET", "/api/office/me", undefined, [200, 200, 200]],
  ["GET", "/api/office/price-list", undefined, [200, 200, 200]],
  ["PUT", "/api/office/price-list", { settings: pl.settings, version: pl.version }, [200, 403, 403]],
  ["GET", "/api/office/price-list/history", undefined, [200, 200, 403]],
  ["POST", "/api/office/price-list/restore", { version: 1, current: 0 }, [409, 403, 403]],
  ["GET", "/api/office/lots", undefined, [200, 200, 200]],
  ["POST", "/api/office/lots", { name: "Matrix Lot" }, [201, 403, 403]],
  ["PATCH", "/api/office/lots/arcadia", { hours: "Tue–Sat 9–4" }, [200, 403, 403]],
  ["GET", "/api/office/team", undefined, [200, 200, 403]],
  ["POST", "/api/office/team", { email: "matrix@yoder.example", name: "Matrix", role: "dealer", lots: ["arcadia"] }, [201, 403, 403]],
  ["PATCH", "/api/office/team/u-lee", { name: "Lee Carter" }, [200, 403, 403]],
  ["DELETE", `/api/office/team/invites/${sha("nobody@yoder.example").slice(0, 40)}`, undefined, [404, 403, 403]],
  ["GET", "/api/office/customers", undefined, [200, 200, 200]],
  ["GET", "/api/office/customers.csv", undefined, [200, 200, 403]],
  ["POST", "/api/office/setup", { businessName: "Again" }, [409, 403, 403]],
];
for (const [index, role, id] of [[2, "dealer", "u-mike"], [1, "manager", "u-sarah"], [0, "owner", "u-alan"]]) {
  for (const [method, path, body, statuses] of MATRIX) {
    await want(statuses[index], method, path, body, { who: id, label: `${role}: ${method} ${path}` });
  }
}
as("u-mike");
ok("a dealer's lot list is only their lots", same((await want(200, "GET", "/api/office/lots")).lots.map((l) => l.slug), ["port-charlotte"]));
as("u-sarah");
ok("a manager's lot list is every lot", (await want(200, "GET", "/api/office/lots")).lots.length === 5);
as("u-lee");
ok("a dealer of two lots sees both", same((await want(200, "GET", "/api/office/lots")).lots.map((l) => l.slug).sort(), ["arcadia", "punta-gorda"]));
sectionDone();

/* ======================================================================= */
section("6. The price list: versions, cfg, history in words, putting back, plain-word problems");

as("u-alan");
let cur = await want(200, "GET", "/api/office/price-list");
const lbName = cur.settings.offer.LB.name || manufacturer.styles.LB.name;
const lb1016 = cur.settings.offer.LB.sizes["10x16"];
let next = clone(cur.settings);
next.offer.LB.sizes["10x16"] = lb1016 + 160;
let saved = await want(200, "PUT", "/api/office/price-list", { settings: next, version: cur.version });
ok("a price change raises the version and cfg", saved.version === cur.version + 1 && saved.cfg === cur.cfg + 1 && saved.settings.cfg === saved.cfg);
const priceWords = `${lbName} 10×16: ${dollars(lb1016)} → ${dollars(lb1016 + 160)}`;
ok(`... and says "${priceWords}"`, same(saved.changes, [priceWords]), JSON.stringify(saved.changes));
ok("... the answer counts the open lots it reached", saved.lotCount === 4, String(saved.lotCount));
const versionWithNewLb = saved.version;

for (const [label, change, words] of [
  ["the business phone", (s) => { s.brand.phone = "(941) 555-0199"; }, "Phone: (941) 555-0100 → (941) 555-0199"],
  ["the business name", (s) => { s.brand.name = "Yoder Barns"; }, "Business name: Yoder Storage Barns → Yoder Barns"],
  ["the line under the price", (s) => { s.notes.finePrint = "Prices plus tax."; }, "Changed the line under the price"],
]) {
  cur = await want(200, "GET", "/api/office/price-list");
  next = clone(cur.settings);
  change(next);
  saved = await want(200, "PUT", "/api/office/price-list", { settings: next, version: cur.version }, { label: `saving ${label}` });
  ok(`changing ${label} raises the version but not cfg (open designers stay current)`, saved.version === cur.version + 1 && saved.cfg === cur.cfg);
  ok(`... and says "${words}"`, same(saved.changes, [words]), JSON.stringify(saved.changes));
}
cur = await want(200, "GET", "/api/office/price-list");
saved = await want(200, "PUT", "/api/office/price-list", { settings: cur.settings, version: cur.version }, { label: "saving with nothing changed" });
ok("a save with nothing changed writes nothing", saved.version === cur.version && same(saved.changes, []));

next = clone(cur.settings);
next.offer.LB.sizes["10x20"] += 5;
const stale = await want(409, "PUT", "/api/office/price-list", { settings: next, version: cur.version - 1 }, { label: "a save from an old copy" });
ok("a stale save is told someone else saved first", /Someone else saved the price list/.test(stale.error));
let after = await want(200, "GET", "/api/office/price-list");
ok("... and nothing was written", after.version === cur.version && after.settings.offer.LB.sizes["10x20"] === cur.settings.offer.LB.sizes["10x20"]);

const nextA = clone(cur.settings); nextA.offer.UT.sizes["8x12"] += 10;
const nextB = clone(cur.settings); nextB.offer.UT.sizes["8x12"] += 20;
const both = await Promise.all([nextA, nextB].map((s) => call("PUT", "/api/office/price-list", { settings: s, version: cur.version })));
ok("two saves at the same moment: one is saved, the other is told (200 + 409)", same(both.map((x) => x.status).sort(), [200, 409]), JSON.stringify(both.map((x) => x.status)));
after = await want(200, "GET", "/api/office/price-list");
const winner = both.find((x) => x.status === 200).data;
ok("... the saved one is the one stored", after.version === cur.version + 1 && after.settings.offer.UT.sizes["8x12"] === winner.settings.offer.UT.sizes["8x12"]);

/* the change words for each part of the price list */
async function saveChange(label, change) {
  const before = await want(200, "GET", "/api/office/price-list");
  const s = clone(before.settings);
  change(s);
  const out = await want(200, "PUT", "/api/office/price-list", { settings: s, version: before.version }, { label: `saving: ${label}` });
  return { before, out };
}
let step = await saveChange("stop selling the Dog Kennel", (s) => {
  delete s.offer.DK;
  for (const group of s.categories) group[1] = group[1].filter((k) => k !== "DK");
  s.categories = s.categories.filter((g) => g[1].length);
});
ok("stopping a style says \"Stopped selling the Dog Kennel\" and raises cfg", step.out.changes.includes("Stopped selling the Dog Kennel") && step.out.cfg === step.before.cfg + 1, JSON.stringify(step.out.changes));
step = await saveChange("sell the Dog Kennel again", (s) => {
  s.offer.DK = clone(templates.full.offer.DK);
  s.categories.push(["Dog Kennels", ["DK"]]);
});
const dkSizes = Object.keys(templates.full.offer.DK.sizes).length;
ok(`starting a style says "Started selling the Dog Kennel in ${dkSizes} sizes"`, step.out.changes.includes(`Started selling the Dog Kennel in ${dkSizes} sizes`), JSON.stringify(step.out.changes));
step = await saveChange("add a style built like the Lofted Barn", (s) => {
  s.offer.LBX1 = { base: "LB", name: "Premium Lofted Barn", sizes: { "10x16": 6290 } };
  s.categories.find((g) => g[1].includes("LB"))[1].push("LBX1");
});
ok("a style of the business's own says what it is built like",
  step.out.changes.includes("Started selling the Premium Lofted Barn (built like the Lofted Barn) in 1 size"), JSON.stringify(step.out.changes));
step = await saveChange("a door price", (s) => { s.items.w48 = 200; });
ok(`a door price says "48″ Wooden Door: $175 → $200"`, step.out.changes.includes(`${manufacturer.items.w48.name}: ${dollars(templates.full.items.w48)} → $200`), JSON.stringify(step.out.changes));
step = await saveChange("an electrical package price", (s) => { s.options.elec["1"] = 700; });
ok("an electrical package price says \"Electrical package 1: $675 → $700\"", step.out.changes.includes(`Electrical package 1: ${dollars(templates.full.options.elec["1"])} → $700`), JSON.stringify(step.out.changes));
step = await saveChange("two extras", (s) => {
  s.options.extras = [
    { key: "ridge-vent", name: "Ridge vent", input: "check", price: 120 },
    { key: "anchors", name: "Extra ground anchors", input: "qty", price: 45 },
  ];
});
ok("adding extras says \"Added the extra \\\"Ridge vent\\\" at $120\"", step.out.changes.includes("Added the extra \"Ridge vent\" at $120") && step.out.changes.includes("Added the extra \"Extra ground anchors\" at $45"), JSON.stringify(step.out.changes));
step = await saveChange("take Navy off the siding colors", (s) => {
  s.palettes = { paint: manufacturer.palettes.paint.map((c) => (Array.isArray(c) ? c[0] : c)).filter((n) => n !== "Navy") };
});
ok("a color taken off says \"Siding colors: removed Navy\"", step.out.changes.includes("Siding colors: removed Navy"), JSON.stringify(step.out.changes));
const everyChange = [];

const history = await want(200, "GET", "/api/office/price-list/history");
ok("history lists every save, newest first", history.entries[0].version === step.out.version && history.entries.every((e, i, a) => i === 0 || a[i - 1].version > e.version));
ok("... with who saved it", history.entries.every((e) => e.savedBy?.name === "Alan Yoder"));
ok("... and the price change in words", history.entries.some((e) => e.version === versionWithNewLb && e.changes.includes(priceWords)));
for (const e of history.entries) everyChange.push(...e.changes);
ok("... and no settings copies in the list (they stay on the server)", history.entries.every((e) => !("settings" in e)));
as("u-sarah");
ok("a manager can read the history", (await want(200, "GET", "/api/office/price-list/history")).entries.length === history.entries.length);
as("u-alan");

cur = await want(200, "GET", "/api/office/price-list");
const beforeLb = versionWithNewLb - 1;
const restored = await want(200, "POST", "/api/office/price-list/restore", { version: beforeLb, current: cur.version });
ok("putting an older copy back saves it as a new version", restored.version === cur.version + 1);
ok("... says when it was from (\"Oct 3\" this year)", restored.changes[0] === "Put back the price list saved Oct 3", restored.changes[0]);
ok("... and what that changed back", restored.changes.includes(`${lbName} 10×16: ${dollars(lb1016 + 160)} → ${dollars(lb1016)}`), JSON.stringify(restored.changes));
ok("... with the older price in place", restored.settings.offer.LB.sizes["10x16"] === lb1016);
await want(409, "POST", "/api/office/price-list/restore", { version: beforeLb, current: cur.version }, { label: "putting back from an old copy" });
await want(404, "POST", "/api/office/price-list/restore", { version: 9999, current: restored.version }, { label: "putting back a copy that does not exist" });
await want(422, "POST", "/api/office/price-list/restore", { version: "two", current: restored.version }, { label: "putting back a version that is not a number" });
/* put the newer prices back for the rest of the check */
cur = await want(200, "GET", "/api/office/price-list");
const latestBeforeRestore = restored.version - 1;
await want(200, "POST", "/api/office/price-list/restore", { version: latestBeforeRestore, current: cur.version }, { label: "putting the newest copy back" });

/* problems in the owner's words */
cur = await want(200, "GET", "/api/office/price-list");
const PATHS = /(?:^|[\s("])(?:offer|items|options|brand|palettes|defaults|leads|embed|pricing|notes|categories|construction|look|features|renames|license|status|cfg|settings)(?:\.|\[)/;
const BROKEN = [
  ["a size priced at $0", (s) => { s.offer.LB.sizes["10x16"] = 0; }, /10×16 needs a price above \$0/],
  ["a size written wrong", (s) => { s.offer.LB.sizes["10x"] = 5000; }, /is not a size/],
  ["a price that is words", (s) => { s.offer.LB.sizes["10x16"] = "abc"; }, /dollar amount/],
  ["a 3 ft wide building", (s) => { s.offer.LB.sizes["3x10"] = 3000; }, /width 4 to 16 ft/],
  ["a 61 ft long building", (s) => { s.offer.LB.sizes["10x61"] = 30000; }, /length 4 to 60 ft/],
  ["half a foot", (s) => { s.offer.LB.sizes["10.5x16"] = 5000; }, /whole feet/],
  ["a price over $1,000,000", (s) => { s.offer.LB.sizes["10x16"] = 1000001; }, /costs more than \$1,000,000/],
  ["a door over $1,000,000", (s) => { s.items.w48 = 2000000; }, /48″ Wooden Door costs more than \$1,000,000/],
  ["a door priced below $0", (s) => { s.items.w48 = -1; }, /48″ Wooden Door price must be a dollar amount/],
  ["a standard door with no price", (s) => { delete s.items.w48; }, /comes with the .*so it needs a price/],
  ["nothing sold", (s) => { s.offer = {}; s.categories = []; }, /Sell at least one building style/],
  ["a setting nobody knows", (s) => { s.colour = "red"; }, /could not be saved/],
  ["a business email that is not one", (s) => { s.brand.email = "nope"; }, /business email/],
  ["a business color that is not one", (s) => { s.brand.colors.header = "red"; }, /business colors/],
  ["a siding color nobody knows", (s) => { s.palettes = { paint: ["Sunset Purple"] }; }, /Sunset Purple is not a siding color we know/],
  ["no siding colors", (s) => { s.palettes = { paint: [] }; }, /Pick at least one siding color/],
  ["a siding color twice", (s) => { s.palettes = { paint: ["White", "White"] }; }, /on the siding color list twice/],
  ["an extra with no name", (s) => { s.options.extras = [{ key: "x1", name: "", input: "check", price: 1 }]; }, /Every extra needs a name/],
  ["two extras the same", (s) => { s.options.extras = [{ key: "x1", name: "A", input: "check", price: 1 }, { key: "x1", name: "B", input: "check", price: 2 }]; }, /Two of your extras are the same/],
  ["an extra charged an unknown way", (s) => { s.options.extras = [{ key: "x1", name: "Gutters", input: "weird", price: 1 }]; }, /Pick how Gutters is charged/],
  ["an extra with no price", (s) => { s.options.extras = [{ key: "x1", name: "Gutters", input: "check" }]; }, /Gutters needs a price/],
  ["no dormer prices with a Dormer Shed sold", (s) => { s.options.dormers = {}; }, /dormer size needs a price/],
  ["an electrical package with no price", (s) => { s.options.elec["1"] = null; }, /Electrical package 1 needs a price/],
  ["an upgrade price that is words", (s) => { s.options.rates.dbl = "x"; }, /Double floor: the price must be a dollar amount/],
  ["a style in no group", (s) => { for (const g of s.categories) g[1] = g[1].filter((k) => k !== "UT"); }, /Utility Shed is not in any group/],
  ["opening on a style not sold", (s) => { s.defaults.style = "ZZ"; }, /The building the designer opens on/],
  ["prices shown an unknown way", (s) => { s.pricing.show = "maybe"; }, /Pick how prices show/],
  ["a rent-to-own factor of 2", (s) => { s.pricing.rto = { factors: { 36: 2 }, showTerm: null }; }, /rent-to-own term/],
  ["a quote form box that is neither", (s) => { s.leads.fields.phone = "maybe"; }, /Required, Optional or Off/],
  ["a * website for the designer", (s) => { s.embed.origins = ["*"]; }, /websites allowed to show the designer/],
  ["open or closed written wrong", (s) => { s.status = "open"; }, /open or closed/],
  ["construction written wrong", (s) => { s.construction = { floor: { spacingIn: "lots" } }; }, /construction settings/],
  ["fine print that is not text", (s) => { s.notes.finePrint = 5; }, /line under the price/],
  ["a style renamed to nothing", (s) => { s.offer.LB.name = ""; }, /needs a name/],
  ["a dormer the builder does not make", (s) => { s.options.dormers["99"] = 100; }, /not in the builder's library/],
  ["a door the builder does not make", (s) => { s.items.zzz = 10; }, /not in the builder's library/],
  ["a quote form sent nowhere", (s) => { s.leads.mode = "webhook"; }, /quote form settings/],
  ["a look nobody knows", (s) => { s.look = { scene: "moon" }; }, /look could not be saved/],
  ["two styles with one name", (s) => { s.offer.UT.name = "Lofted Barn"; }, /Two building styles are called Lofted Barn/],
];
for (const [label, change, words] of BROKEN) {
  const s = clone(cur.settings);
  change(s);
  const answer = await want(422, "PUT", "/api/office/price-list", { settings: s, version: cur.version }, { label: `saving a price list with ${label}` });
  ok(`... ${label}: said in the owner's words`, typeof answer.error === "string" && words.test(answer.error) && !PATHS.test(answer.error), answer.error);
  ok(`... ${label}: every problem listed, none as a settings path`, Array.isArray(answer.problems) && answer.problems.length > 0 && answer.problems.every((p) => !PATHS.test(p) && !/[{}]/.test(p)), JSON.stringify(answer.problems));
}
for (const [label, settings] of [["no price list", null], ["a price list that is a word", "prices"], ["a price list that is a list", [1, 2]]]) {
  const answer = await want(422, "PUT", "/api/office/price-list", { settings, version: cur.version }, { label: `saving ${label}` });
  ok(`... ${label}: "The price list is missing."`, /The price list is missing/.test(answer.error), answer.error);
}
let s6 = clone(cur.settings); s6.id = "someone-else";
await want(422, "PUT", "/api/office/price-list", { settings: s6, version: cur.version }, { label: "changing the business id" });
s6 = clone(cur.settings); s6.manufacturer = "other-builder";
await want(422, "PUT", "/api/office/price-list", { settings: s6, version: cur.version }, { label: "changing the builder's library" });
after = await want(200, "GET", "/api/office/price-list");
ok("none of the refused saves changed the price list", after.version === cur.version && same(after.settings, cur.settings));
ok("the size limits are the Dealer Center's own (a 16×60 is fine)", await (async () => {
  const s = clone(cur.settings); s.offer.UT.sizes["16x60"] = 30000;
  const a = await call("PUT", "/api/office/price-list", { settings: s, version: cur.version });
  return a.status === 200;
})());
sectionDone();

/* ======================================================================= */
section("7. Website quote requests: priced on the server, safe to send twice, never leaking");

let cat = await liveCat();
const { design: lbDesign, state: lbState } = designOf(cat, "LB", "10x16");
const lbTotal = priceParts(lbState, cat).total;
const john = { name: "John Smith", phone: "(941) 555-0101", email: "john@example.com", zip: "33952", note: "Call after 5", smsOk: true };
as(null);
emailsBefore = sent.length;
let receipt = await sendQuote("port-charlotte", lbDesign, john);
ok("the total is the server's own price for the design", receipt.total === lbTotal, `${receipt.total} vs ${lbTotal}`);
ok("the answer is the quote's number and price only", same(Object.keys(receipt).sort(), ["id", "number", "price", "receivedAt", "repriced", "total"]), JSON.stringify(Object.keys(receipt)));
ok("... never the customer's details", !["john@example.com", "555-0101", "John Smith", "33952", "Call after 5"].some((t) => JSON.stringify(receipt).includes(t)));
ok("... a design made under today's price list is not repriced", receipt.repriced === false);
ok("quote numbers start at 1001", receipt.number === 1001, String(receipt.number));
const johnReceipt = receipt;
const lotEmail = sent.at(-1);
ok("the lot is emailed about it", sent.length === emailsBefore + 1 && lotEmail.to === "portcharlotte@yoderbarns.example");
ok("... with the building, the customer and a link to them", lotEmail.subject === "New quote request: 10×16 Lofted Barn — John Smith" && lotEmail.text.includes(`${SITE}/dealer#/customers/`) && lotEmail.replyTo === "john@example.com", lotEmail.subject);
ok("... in Dealer Center words", /Dealer Center/.test(lotEmail.text) && !/\boffice\b/i.test(lotEmail.text));
as("u-alan");
let rows = (await want(200, "GET", "/api/office/customers?lot=port-charlotte")).rows;
const johnRow = rows.find((x) => x.name === "John Smith");
ok("the website customer is on the lot's list as New, from the 3D designer", johnRow?.stage === "new" && johnRow.source === "website" && johnRow.building === "10×16 Lofted Barn" && johnRow.total === lbTotal);
let johnFile = (await want(200, "GET", `/api/office/customers/${johnRow.id}`)).customer;
ok("... the quote keeps the server's price lines and today's cfg", johnFile.quotes[0].total === lbTotal && johnFile.quotes[0].cfg === cat.cfg && johnFile.quotes[0].source === "website");
ok("... their note and texting permission are kept", johnFile.activity.some((a) => a.type === "website" && a.text.includes("Call after 5")) && johnFile.smsOk === true);
as(null);

const forged = clone(lbDesign); forged.priced = { total: 1, at: "2026-10-03" };
receipt = await sendQuote("port-charlotte", forged, john, { label: "a design that says it costs $1" });
ok("a design that says it costs $1 is priced at its real price", receipt.total === lbTotal);
for (const [label, extra] of [["a total", { total: 1 }], ["a price", { price: { total: 1 } }], ["another business", { companyId: "other-business" }], ["another lot", { lotId: "punta-gorda" }], ["a lot", { lot: "punta-gorda" }]]) {
  await sendQuote("port-charlotte", lbDesign, john, { extra, status: 422, label: `a quote request that sends ${label}` });
}
const wrongBusiness = clone(lbDesign); wrongBusiness.company = "someone-else";
let refused = await sendQuote("port-charlotte", wrongBusiness, john, { status: 422, label: "a design from another business" });
ok("... refused with the customer's words", refused.error === UNREADABLE);
const freeDoor = clone(lbDesign); freeDoor.items.push({ cat: "d36in", wall: "B", pos: 0, inc: true, origCat: "w72" });
await sendQuote("port-charlotte", freeDoor, john, { status: 422, label: "a steel door marked as coming with the building" });
const freeFixture = clone(lbDesign); freeFixture.items.push({ cat: "d36in", wall: "B", pos: 0, pk: true });
await sendQuote("port-charlotte", freeFixture, john, { status: 422, label: "a door marked as part of an electrical package" });
const packageLight = clone(lbDesign); packageLight.items.push({ cat: "light", wall: "F", pos: 2, pk: true });
await sendQuote("port-charlotte", packageLight, john, { status: 422, label: "an outside light marked as part of a package nobody bought" });
const minusBench = clone(lbDesign); minusBench.items.push({ cat: "bench", wall: "IN", ln: -20 });
await sendQuote("port-charlotte", minusBench, john, { status: 422, label: "a work bench -20 ft long" });
const tooMany = clone(lbDesign); tooMany.items = Array.from({ length: 251 }, () => lbDesign.items[0]);
await sendQuote("port-charlotte", tooMany, john, { status: 422, label: "251 doors and windows" });

const key1 = freshKey();
const first = await sendQuote("port-charlotte", lbDesign, john, { key: key1 });
const again = await sendQuote("port-charlotte", lbDesign, john, { key: key1, status: 200, label: "the same send again" });
ok("the same send again gets the same receipt (200), and no second quote", same(first, again));
const restarted = await call("POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: john, idempotencyKey: key1 }, { app: makeOffice() });
ok("... even after the server restarts", restarted.status === 200 && same(restarted.data, first), restarted.text);
refused = await sendQuote("port-charlotte", lbDesign, { ...john, name: "Johnny Smith" }, { key: key1, status: 409, label: "the same key with other details" });
ok("... the same key with other details is refused (409) in words", refused.error === "Please refresh the page and send it again.");
await sendQuote("port-charlotte", designOf(cat, "UT", "10x12").design, john, { key: key1, status: 409, label: "the same key with another building" });

const quotesBefore = await quoteCount();
const key2 = freshKey();
const twice = await Promise.all([1, 2].map(() => call("POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: john, idempotencyKey: key2 }, { ip: "198.51.100.250" })));
ok("two identical sends at the same moment: one makes the quote, the other gets its receipt (201 + 200)", same(twice.map((x) => x.status).sort(), [200, 201]), JSON.stringify(twice.map((x) => [x.status, x.data])));
ok("... the same receipt", twice[0].data.id === twice[1].data.id);
ok("... and one quote, not two", (await quoteCount()) === quotesBefore + 1);

const key3 = freshKey();
const stuckFingerprint = sha(JSON.stringify({ design: lbDesign, contact: john }));
await S.put(requestKey("port-charlotte", key3), { state: "working", fingerprint: stuckFingerprint, at: new Date(clock.t - 2 * 60000).toISOString() });
receipt = await sendQuote("port-charlotte", lbDesign, john, { key: key3, label: "a send whose first try stopped halfway two minutes ago" });
ok("a send stuck \"working\" for over a minute is taken over", receipt.total === lbTotal && (await S.get(requestKey("port-charlotte", key3)))?.state === "done");
const key4 = freshKey();
await S.put(requestKey("port-charlotte", key4), { state: "working", fingerprint: stuckFingerprint, at: new Date(clock.t).toISOString() });
const waited = Date.now();
refused = await sendQuote("port-charlotte", lbDesign, john, { key: key4, status: 409, label: "a send still being saved by another request" });
ok("a send still being saved elsewhere waits a few seconds, then says it is on its way", refused.error === "Your request is already on its way. Wait a moment, then check for the confirmation." && Date.now() - waited >= 4000);
await S.remove(requestKey("port-charlotte", key4));

await sendQuote("port-charlotte", lbDesign, john, { key: "short", status: 422, label: "a one-time key that is too short" });
await want(422, "POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: john }, { label: "a send with no one-time key" });

for (const [label, contact, words] of [
  ["no name", { phone: "9415550111", zip: "33952" }, "Your name is needed."],
  ["no phone (this business asks for one)", { name: "Ann Lee", email: "ann@example.com", zip: "33952" }, "Phone is needed."],
  ["no ZIP (this business asks for one)", { name: "Ann Lee", phone: "9415550111" }, "ZIP is needed."],
  ["a phone that is letters", { name: "Ann Lee", phone: "call me", zip: "33952" }, null],
  ["an email that is not one", { name: "Ann Lee", phone: "9415550111", email: "ann at example", zip: "33952" }, "Email does not look like an email address."],
  ["a field nobody asked for", { name: "Ann Lee", phone: "9415550111", zip: "33952", ssn: "123" }, null],
  ["details that are a word", "Ann Lee", null],
]) {
  refused = await sendQuote("port-charlotte", lbDesign, contact, { status: 422, label: `a quote request with ${label}` });
  if (words) ok(`... ${label}: "${words}"`, refused.error === words, refused.error);
}

/* matching a lot's own customers */
as("u-mike");
const maria = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Maria Gonzalez", phone: "941-555-0102", email: "maria@example.com", source: "phone" })).customer;
as("u-dana");
const greg = (await want(201, "POST", "/api/office/customers", { lot: "punta-gorda", name: "Greg Foster", phone: "941-555-0103", email: "greg@example.com" })).customer;
as(null);
const customersBefore = (await allCustomers()).length;
receipt = await sendQuote("port-charlotte", lbDesign, { name: "Maria G", phone: "+1 (941) 555 0102", zip: "33952" }, { label: "Maria, by her phone number written another way" });
let mariaNow = await S.get(`customers/${maria.id}`);
ok("a send with a known phone number (digits compared) adds the quote to that customer", mariaNow.quotes.some((q) => q.id === receipt.id) && (await allCustomers()).length === customersBefore);
receipt = await sendQuote("port-charlotte", lbDesign, { name: "Maria", phone: "941-555-0999", email: "MARIA@example.com", zip: "33952" }, { label: "Maria, by her email in capitals" });
mariaNow = await S.get(`customers/${maria.id}`);
ok("... and a known email (any capitals) does too", mariaNow.quotes.some((q) => q.id === receipt.id) && (await allCustomers()).length === customersBefore);
ok("... the customer keeps their own name; a blank detail is filled in", mariaNow.name === "Maria Gonzalez" && mariaNow.phone === "941-555-0102");
for (const stage of ["lost", "delivered"]) {
  as("u-mike");
  await want(200, "PATCH", `/api/office/customers/${maria.id}`, { stage, ...(stage === "lost" ? { lostReason: "Price" } : {}) }, { label: `marking Maria ${stage}` });
  as(null);
  await sendQuote("port-charlotte", lbDesign, { name: "Maria", phone: "9415550102", zip: "33952" }, { label: `Maria comes back after being ${stage}` });
  mariaNow = await S.get(`customers/${maria.id}`);
  ok(`a ${stage === "lost" ? "Lost" : "Delivered"} customer who sends a design goes back to New`, mariaNow.stage === "new" && mariaNow.activity.some((a) => a.text === `${stage === "lost" ? "Lost" : "Delivered"} → New`));
}
receipt = await sendQuote("port-charlotte", lbDesign, { name: "Greg Foster", phone: "941-555-0103", email: "greg@example.com", zip: "33952" }, { label: "another lot's customer, at this lot" });
const gregNow = await S.get(`customers/${greg.id}`);
const newGreg = (await allCustomers()).find((c) => c.quotes.some((q) => q.id === receipt.id));
ok("another lot's customer is never matched: a new customer at this lot", gregNow.quotes.length === 0 && newGreg.lot === "port-charlotte" && newGreg.id !== greg.id);

emailBroken = true;
receipt = await sendQuote("port-charlotte", lbDesign, { name: "Kelly Nguyen", phone: "941-555-0104", zip: "33952" }, { label: "a send while email is down" });
emailBroken = false;
ok("an email that fails never stops the quote", !!receipt.id && logged.some((l) => /email about a website quote/.test(l)));
emailsBefore = sent.length;
await sendQuote("arcadia", lbDesign, { name: "Hank Wells", phone: "863-555-0119", zip: "34266" }, { label: "a send to a lot with no email" });
ok("a lot with no email gets no email (and the quote is saved)", sent.length === emailsBefore);
const quietSend = await call("POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: { name: "Quiet", phone: "9415550190", zip: "33952" }, idempotencyKey: freshKey() }, { app: makeOffice({ sendEmail: null }), ip: visitorIp() });
ok("with email off, a quote is saved and nothing is emailed", quietSend.status === 201 && sent.length === emailsBefore);

as("u-alan");
await want(201, "POST", "/api/office/lots", { name: "Rate Lot", email: "rate@yoderbarns.example" });
as(null);
let rateStatuses = [];
for (let n = 0; n < 21; n++) {
  const a = await call("POST", "/api/lots/rate-lot/quote-requests", { design: lbDesign, contact: { name: `Visitor ${n}`, phone: `94155502${String(n).padStart(2, "0")}`, zip: "33952" }, idempotencyKey: freshKey() }, { ip: "192.0.2.77" });
  rateStatuses.push(a.status);
  if (n === 20) ok("the 21st send from one visitor in 10 minutes is refused (429) in words", a.status === 429 && /Too many quote requests/.test(a.data.error), a.text);
}
ok("... the first 20 were taken", rateStatuses.slice(0, 20).every((st) => st === 201), JSON.stringify(rateStatuses));
await sendQuote("rate-lot", lbDesign, { name: "Other Visitor", phone: "9415550300", zip: "33952" }, { ip: "192.0.2.78", label: "another visitor at the same time" });
clock.t += 10 * 60000;
await sendQuote("rate-lot", lbDesign, { name: "Visitor Later", phone: "9415550301", zip: "33952" }, { ip: "192.0.2.77", label: "the first visitor, ten minutes later" });
await S.put("limits/rate-lot/all", { bucket: Math.floor(clock.t / 3600000), count: 300 });
refused = await sendQuote("rate-lot", lbDesign, { name: "Busy Hour", phone: "9415550302", zip: "33952" }, { ip: "192.0.2.90", status: 429, label: "the 301st send to one lot in an hour" });
clock.t += 60 * 60000;
await sendQuote("rate-lot", lbDesign, { name: "Next Hour", phone: "9415550303", zip: "33952" }, { ip: "192.0.2.91", label: "a send the next hour" });
sectionDone();

/* ======================================================================= */
section("8. The 38 damaged or forged designs from the old check: refused, nothing saved");

cat = await liveCat();
const baseDesign = fromState(defaults(cat), cat);
const MALFORMED = [
  ["negative package with free exterior fixture", (d) => { d.elec = { pkg: -1, ext: true }; d.items.push({ cat: "light", wall: "F", pos: 2, pk: true }); }],
  ["NaN electrical package", (d) => { d.elec.pkg = NaN; }],
  ["infinite electrical package", (d) => { d.elec.pkg = Infinity; }],
  ["string electrical package", (d) => { d.elec.pkg = "1"; }],
  ["fractional electrical package", (d) => { d.elec.pkg = 1.5; }],
  ["unoffered electrical package", (d) => { d.elec.pkg = 999; }],
  ["null electrical package", (d) => { d.elec.pkg = null; }],
  ["array electrical package", (d) => { d.elec.pkg = [1]; }],
  ["package zero with exterior light", (d) => { d.elec = { pkg: 0, ext: true }; }],
  ["nonboolean exterior option", (d) => { d.elec.ext = "false"; }],
  ["null electrical object", (d) => { d.elec = null; }],
  ["array style ID", (d) => { d.type = [d.type]; }],
  ["array size ID", (d) => { d.size = [d.size]; }],
  ["object color", (d) => { d.colors.body = { toString: "White" }; }],
  ["array colors", (d) => { d.colors = []; }],
  ["object extra", (d) => { d.xopt.anchors = { toString: "x" }; }],
  ["array extras", (d) => { d.xopt = []; }],
  ["negative extra", (d) => { d.xopt.anchors = -1; }],
  ["excessive quantity", (d) => { d.xopt.anchors = 100; }],
  ["nonboolean switch value", (d) => { d.xopt["ridge-vent"] = 2; }],
  ["unknown extra", (d) => { d.xopt.unknown = 0; }],
  ["array upgrade ID", (d) => { d.opts = [["jo12"]]; }],
  ["repeated upgrade", (d) => { d.opts = ["jo12", "jo12"]; }],
  ["object upgrades", (d) => { d.opts = { jo12: 1 }; }],
  ["array porch", (d) => { d.porch = []; }],
  ["string porch length", (d) => { d.porch.pLen = "12"; }],
  ["number porch toggle", (d) => { d.porch.pMid = 1; }],
  ["array ramp ID", (d) => { d.ramp = ["none"]; }],
  ["object dormer ID", (d) => { d.dormer = {}; }],
  ["array item ID", (d) => { d.items[0].cat = [d.items[0].cat]; }],
  ["array wall", (d) => { d.items[0].wall = ["F"]; }],
  ["array original item", (d) => { d.items[0].origCat = [d.items[0].cat]; }],
  ["string item flag", (d) => { d.items[0].inc = "false"; }],
  ["null item flag", (d) => { d.items[0].pk = null; }],
  ["infinite position", (d) => { d.items[0].pos = Infinity; }],
  ["string measurement", (d) => { d.items[0].pos = "0"; }],
  ["invalid displayed price", (d) => { d.priced = { total: -1, at: "2026-10-01" }; }],
  ["unknown design field", (d) => { d.role = "admin"; }],
];
ok("there are 38 of them", MALFORMED.length === 38);
const quotesBeforeMalformed = await quoteCount();
const keysBefore = (await S.keys("website-requests/")).length;
for (const [index, [label, change]] of MALFORMED.entries()) {
  const bad = clone(baseDesign);
  change(bad);
  let error = null;
  try { priceOrExplain(bad, cat, () => {}); } catch (e) { error = e; }
  ok(`${label}: refused by the server's own pricing`, error && [409, 422].includes(error.status) && [UNREADABLE, NOT_OFFERED].includes(error.message), error ? `${error.status} ${error.message}` : "it was priced");
  const answer = await call("POST", "/api/lots/port-charlotte/quote-requests", { design: bad, contact: john, idempotencyKey: `malformed-case-${String(index).padStart(4, "0")}` }, { ip: `203.0.113.${100 + index}` });
  ok(`${label}: refused when sent from a browser (422 or 409, in the customer's words)`, [409, 422].includes(answer.status) && [UNREADABLE, NOT_OFFERED].includes(answer.data.error), answer.text.slice(0, 200));
}
ok("none of them made a quote", (await quoteCount()) === quotesBeforeMalformed);
ok("none of them left its one-time key behind (the customer can fix and resend)", (await S.keys("website-requests/")).length === keysBefore);

const demoCat = resolve(templates.full, manufacturer, library);
const demoState = defaults(demoCat);
const demoDesign = fromState(demoState, demoCat);
demoDesign.items.push({ cat: "light", wall: "F", pos: 2 });
ok("an outside light the customer added is charged", priceOrExplain(demoDesign, demoCat).price.total === priceParts(demoState, demoCat).total + demoCat.CAT.light.p);
demoDesign.elec = { pkg: -1, ext: true }; demoDesign.items.at(-1).pk = true;
let thrown = null;
try { priceOrExplain(demoDesign, demoCat, () => {}); } catch (e) { thrown = e; }
ok("a negative package cannot make that light free", thrown?.status === 422);
const switchedOff = defaults(demoCat);
setElec(switchedOff, 1, demoCat); toggleExt(switchedOff, demoCat); setElec(switchedOff, 0, demoCat);
ok("switching off an electrical package also clears its exterior light", same(switchedOff.elec, { pkg: 0, ext: false }) && !switchedOff.items.some((i) => i.pk));
ok("... and is priced like the designer prices it", priceOrExplain(fromState(switchedOff, demoCat), demoCat).price.total === priceParts(switchedOff, demoCat).total);
ok("... also with the price the designer showed attached", priceOrExplain(fromState(switchedOff, demoCat, { priced: true, at: "2026-10-01" }), demoCat).price.total === priceParts(switchedOff, demoCat).total);
const oldLink = fromState(switchedOff, demoCat); oldLink.elec.ext = true;
const reopened = toState(oldLink, demoCat);
ok("an old link with an exterior light and no package is cleared when opened", reopened.state.elec.ext === false && reopened.warnings.some((w) => w.includes("exterior electrical light")));
ok("... and then priced like the designer prices it", priceOrExplain(fromState(reopened.state, demoCat), demoCat).price.total === priceParts(switchedOff, demoCat).total);
sectionDone();

/* ======================================================================= */
section("9. Price parity: the server's total is the designer's total for every style, size and electrical package");

let parity = 0, parityWrong = [];
for (const companyId of ["demo", "starter", "learning-side-loft"]) {
  const company = readJson(`companies/${companyId}/company.json`);
  const c = resolve(company, manufacturer, library);
  for (const type of Object.keys(c.TYPES)) for (const size of Object.keys(c.P[type])) {
    const d = fromState(defaults(c), c); d.type = type; d.size = size; delete d.items;
    const fresh = toState(d, c).state;
    const check = (what) => {
      parity++;
      const server = priceOrExplain(fromState(fresh, c), c).price.total;
      const designer = priceParts(fresh, c).total;
      if (server !== designer) parityWrong.push(`${companyId} ${type} ${size} ${what}: ${server} vs ${designer}`);
    };
    check("standard");
    for (const pkg of c.ELECPK || []) {
      fresh.elec = { pkg: +pkg[0], ext: false }; pkFixtures(fresh, frameOf(fresh, c), c);
      check(`package ${pkg[0]}`);
      if (+pkg[0] > 0 && c.MISC.ext != null) {
        fresh.elec.ext = true; pkFixtures(fresh, frameOf(fresh, c), c);
        check(`package ${pkg[0]} + exterior light`);
      }
    }
  }
}
ok(`all ${parity} cases cost exactly what the designer shows`, parityWrong.length === 0, parityWrong.slice(0, 5).join("; "));
ok("at least the old check's 1,380 cases were tried", parity >= 1380, String(parity));
cat = await liveCat();
let parityHttp = 0;
as(null);
for (const type of Object.keys(cat.TYPES)) {
  const size = Object.keys(cat.P[type])[0];
  const { design, state } = designOf(cat, type, size, (st) => { st.elec = { pkg: 1, ext: false }; pkFixtures(st, frameOf(st, cat), cat); });
  const answer = await call("POST", "/api/lots/punta-gorda/quote-requests", { design, contact: { name: `Parity ${type}`, phone: `9415551${String(parityHttp).padStart(3, "0")}`, zip: "33950" }, idempotencyKey: freshKey() }, { ip: `203.0.113.${200 + (parityHttp % 50)}` });
  ok(`a ${size.replace("x", "×")} ${cat.TYPES[type].name} with electrical package 1, sent from a browser, costs what the designer shows`, answer.status === 201 && answer.data.total === priceParts(state, cat).total, answer.text.slice(0, 200));
  parityHttp++;
}
sectionDone();

/* ======================================================================= */
section("10. A price change reaches every lot at once; quotes keep their price");

as("u-alan");
const oldCat = await liveCat();
const oldDesign = lbDesign;                         /* made under the earlier price list */
cur = await want(200, "GET", "/api/office/price-list");
next = clone(cur.settings);
const lbNow = next.offer.LB.sizes["10x16"];
next.offer.LB.sizes["10x16"] = lbNow + 100;
saved = await want(200, "PUT", "/api/office/price-list", { settings: next, version: cur.version });
as(null);
const openLots = ["port-charlotte", "punta-gorda", "arcadia", "rate-lot", "matrix-lot"];
for (const slug of openLots) {
  const lot = await want(200, "GET", `/api/lots/${slug}`);
  ok(`${slug}'s designer has the new price right after the save`, lot.company.offer.LB.sizes["10x16"] === lbNow + 100 && lot.version === saved.version && lot.company.cfg === saved.cfg);
}
as("u-alan");
johnFile = (await want(200, "GET", `/api/office/customers/${johnRow.id}`)).customer;
ok("an existing quote keeps the price it was made at", johnFile.quotes[0].total === johnReceipt.total && johnFile.quotes[0].cfg === oldCat.cfg);
as(null);
receipt = await sendQuote("port-charlotte", oldDesign, { name: "Late Larry", phone: "9415550401", zip: "33952" }, { label: "a design made before the price change" });
const todayCat = resolve(saved.settings, manufacturer, library);
const todayTotal = priceParts(toState({ ...oldDesign, cfg: saved.cfg }, todayCat).state, todayCat).total;
ok("a design made before the change is priced at today's price", receipt.total === todayTotal && todayTotal === johnReceipt.total + 100, `${receipt.total} vs ${todayTotal}`);
ok("... and marked as priced again, so the customer's confirmation shows the new total", receipt.repriced === true);
as("u-alan");
cur = await want(200, "GET", "/api/office/price-list");
next = clone(cur.settings);
delete next.offer.LB.sizes["10x16"];
if (next.defaults.size === "10x16") next.defaults.size = "10x20";
await want(200, "PUT", "/api/office/price-list", { settings: next, version: cur.version }, { label: "stop selling the 10×16 Lofted Barn" });
as(null);
refused = await sendQuote("port-charlotte", oldDesign, { name: "Late Larry", phone: "9415550401", zip: "33952" }, { status: 409, label: "a design with a size no longer sold" });
ok("a design with something no longer sold is sent back with today's words", refused.error === NOT_OFFERED);
as("u-alan");
cur = await want(200, "GET", "/api/office/price-list");
next = clone(cur.settings); next.offer.LB.sizes["10x16"] = lbNow + 100;
await want(200, "PUT", "/api/office/price-list", { settings: next, version: cur.version }, { label: "sell the 10×16 again" });

cur = await want(200, "GET", "/api/office/price-list");
await want(200, "PUT", "/api/office/price-list", { settings: { ...cur.settings, status: "suspended" }, version: cur.version }, { label: "closing the designer for the whole business" });
as(null);
for (const slug of ["port-charlotte", "arcadia"]) await want(404, "GET", `/api/lots/${slug}`, undefined, { label: `${slug} while the business is closed` });
await sendQuote("port-charlotte", lbDesign, john, { status: 404, label: "a send while the business is closed" });
as("u-alan");
cur = await want(200, "GET", "/api/office/price-list");
await want(200, "PUT", "/api/office/price-list", { settings: { ...cur.settings, status: "active" }, version: cur.version }, { label: "opening it again" });
sectionDone();

/* ======================================================================= */
section("11. Customers: adding, editing, stages, follow-ups, notes, quotes and orders");

as("u-mike");
let walkIn = await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Bob Whitaker", phone: "(941) 555-0201", note: "Wants a garage by Christmas" });
let bob = walkIn.customer;
ok("a walk-in is added as New, from the lot, working with whoever added them", bob.stage === "new" && bob.source === "walk-in" && bob.assignedTo === "u-mike");
ok("... with an \"added\" line and the note", bob.activity[0].type === "created" && /Added by Mike Hostetler/.test(bob.activity[0].text) && bob.activity[1].text === "Wants a garage by Christmas");
ok("... and on the lot's list", await rowsRight(bob.id));
await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", phone: "9415550202" }, { label: "a customer with no name" });
await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", name: "No Way To Reach" }, { label: "a customer with no phone or email" });
refused = await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Fake Web", phone: "9415550203", source: "website" }, { label: "a customer marked as from the website" });
ok("... only the website can make a website customer, said plainly", refused.error === "Pick where they came from.");
await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Bad Phone", phone: "call me" }, { label: "a phone that is letters" });
await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Odd", phone: "9415550204", favorite: "blue" }, { label: "a field nobody knows" });
await want(422, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Line\u0007Break", phone: "9415550205" }, { label: "a name with a control character" });
await want(404, "POST", "/api/office/customers", { lot: "punta-gorda", name: "Elsewhere", phone: "9415550206" }, { label: "a dealer adding at another lot" });
await want(404, "POST", "/api/office/customers", { lot: "nowhere", name: "Nowhere", phone: "9415550207" }, { label: "a customer at a lot that does not exist" });
const phoned = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Ray Johnson", email: "ray@example.com", source: "phone", assignedTo: null })).customer;
ok("a phone call can be added for nobody in particular", phoned.source === "phone" && phoned.assignedTo === null);

let changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { phone: "(941) 555-0299", city: "Port Charlotte" })).customer;
ok("changing contact details says what changed", changed.phone === "(941) 555-0299" && changed.activity.at(-1).text === "Changed phone, city");
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { stage: "lost", lostReason: "Bought somewhere else" })).customer;
ok("marking Lost keeps the reason", changed.stage === "lost" && changed.lostReason === "Bought somewhere else" && changed.activity.at(-1).text === "New → Lost: Bought somewhere else");
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { stage: "contacted" })).customer;
ok("... leaving Lost clears the reason", changed.stage === "contacted" && changed.lostReason === "");
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { stage: "maybe" }, { label: "a stage nobody knows" });
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { name: "" }, { label: "taking away the name" });
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { phone: "", email: "" }, { label: "taking away every way to reach them" });
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { assignedTo: "u-sarah" })).customer;
ok("a customer can be given to someone who works their lot (a manager works every lot)", changed.assignedTo === "u-sarah" && changed.activity.at(-1).text === "Assigned to Sarah Miller");
refused = await want(422, "PATCH", `/api/office/customers/${bob.id}`, { assignedTo: "u-dana" }, { label: "giving a customer to another lot's dealer" });
ok("... not to another lot's dealer", refused.error === "Dana Ruiz does not work this lot.");
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { assignedTo: "u-nobody" }, { label: "giving a customer to someone not on the team" });
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { name: "Robert Whitaker", assignedTo: "u-dana" }, { label: "a good change together with a refused one" });
ok("... a refused change saves none of it", (await S.get(`customers/${bob.id}`)).name === "Bob Whitaker");
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { assignedTo: null })).customer;
ok("... and can be given to nobody", changed.assignedTo === null && changed.activity.at(-1).text === "Not assigned to anyone");
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { followUp: { date: "2026-10-05", note: "Bring the color card" } })).customer;
ok("a follow-up date is kept, in words", same(changed.followUp, { date: "2026-10-05", note: "Bring the color card" }) && changed.activity.at(-1).text === "Follow up Oct 5: Bring the color card");
for (const [label, date] of [["Feb 30", "2026-02-30"], ["a date written the US way", "10/05/2026"], ["a date that is a number", 20261005], ["no date", ""]]) {
  await want(422, "PATCH", `/api/office/customers/${bob.id}`, { followUp: { date } }, { label: `a follow-up on ${label}` });
}
await want(422, "PATCH", `/api/office/customers/${bob.id}`, { followUp: { date: "2026-10-06", when: "noon" } }, { label: "a follow-up with a field nobody knows" });
const note = (await want(201, "POST", `/api/office/customers/${bob.id}/activity`, { type: "note", text: "Asked about rent-to-own" })).customer;
ok("a note is added to the history", note.activity.at(-1).type === "note" && note.activity.at(-1).text === "Asked about rent-to-own" && note.activity.at(-1).by.name === "Mike Hostetler");
await want(422, "POST", `/api/office/customers/${bob.id}/activity`, { type: "note", text: "" }, { label: "an empty note" });
await want(422, "POST", `/api/office/customers/${bob.id}/activity`, { type: "fax", text: "Sent a fax" }, { label: "a fax" });
const fresh = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Linda Park", phone: "9415550208" })).customer;
let called = (await want(201, "POST", `/api/office/customers/${fresh.id}/activity`, { type: "call", text: "Left a message" })).customer;
ok("a call moves a New customer to Contacted", called.stage === "contacted" && called.activity.some((a) => a.text === "Called: Left a message") && called.activity.some((a) => a.text === "New → Contacted"));
for (const type of ["text", "email", "visit"]) {
  const someone = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: `New ${type}`, phone: `94155503${type.length}0` })).customer;
  const after2 = (await want(201, "POST", `/api/office/customers/${someone.id}/activity`, { type })).customer;
  ok(`a ${type} moves a New customer to Contacted`, after2.stage === "contacted");
}
called = (await want(201, "POST", `/api/office/customers/${bob.id}/activity`, { type: "call", text: "Talked colors", clearFollowUp: true })).customer;
ok("a call can mark the follow-up done", called.followUp === null && called.activity.at(-1).text === "Follow-up done");
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { followUp: { date: "2026-10-09" } })).customer;
changed = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { followUp: null })).customer;
ok("a follow-up can be cleared", changed.followUp === null);

cat = await liveCat();
const garage = designOf(cat, "G", "12x24");
const officeQuote = await want(201, "POST", `/api/office/customers/${bob.id}/quotes`, { design: garage.design, note: "Price good until Nov 1" });
ok("a quote made in the Dealer Center is priced by the server", officeQuote.quote.total === priceParts(garage.state, cat).total && officeQuote.quote.source === "office");
ok("... named in words, with the next number from the one shared counter", officeQuote.quote.building === "12×24 Garage" && officeQuote.quote.number > johnReceipt.number);
ok("... and moves the customer to Quoted", officeQuote.customer.stage === "quoted" && officeQuote.customer.activity.some((a) => a.text === `Quote #${officeQuote.quote.number}: 12×24 Garage — ${dollars(officeQuote.quote.total)}`));
const counterNow = (await S.get("counters/quote-number")).next;
ok("the counter is ready for the next number", counterNow === officeQuote.quote.number + 1);
const forgedOffice = clone(garage.design); forgedOffice.items.push({ cat: "d36in", wall: "B", pos: 0, inc: true, origCat: "w72" });
await want(422, "POST", `/api/office/customers/${bob.id}/quotes`, { design: forgedOffice }, { label: "a quote with a free steel door" });
await want(422, "POST", `/api/office/customers/${bob.id}/quotes`, { design: garage.design, total: 1 }, { label: "a quote that sends its own total" });

const order = await want(201, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: officeQuote.quote.id, payment: "rto", deposit: 450, deliveryDate: "2026-10-20", notes: "Gate code 1234" });
ok("an order keeps its quote's number and price", order.order.number === officeQuote.quote.number && order.order.total === officeQuote.quote.total && order.order.building === "12×24 Garage");
ok("... starts as Sold and moves the customer to Sold", order.order.status === "sold" && order.customer.stage === "sold");
ok("... in words", order.customer.activity.some((a) => a.text === `Sold: 12×24 Garage — ${dollars(order.order.total)} (order #${order.order.number}, rent-to-own)`));
ok("... with the delivery address from the customer when none is given", order.order.deliveryAddress === "Port Charlotte");
await want(409, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: officeQuote.quote.id }, { label: "a second live order for the same quote" });
await want(422, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: "nosuchquote1" }, { label: "an order for a quote that is not theirs" });
const second2 = await want(201, "POST", `/api/office/customers/${bob.id}/quotes`, { design: lbDesign.cfg === cat.cfg ? lbDesign : designOf(cat, "LB", "10x16").design });
await want(422, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: second2.quote.id, deposit: second2.quote.total + 1 }, { label: "a deposit above the price" });
await want(422, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: second2.quote.id, payment: "bitcoin" }, { label: "a payment nobody knows" });
await want(422, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: second2.quote.id, deliveryDate: "2026-13-01" }, { label: "a delivery date in month 13" });
await want(422, "POST", `/api/office/customers/${bob.id}/orders`, { quoteId: second2.quote.id, deposit: -5 }, { label: "a deposit below $0" });
const orderId = order.order.id;
for (const [status, stage] of [["sent", "sold"], ["ready", "sold"], ["delivered", "delivered"]]) {
  const moved = await want(200, "PATCH", `/api/office/customers/${bob.id}/orders/${orderId}`, { status });
  ok(`order status ${status}: customer ${stage}`, moved.order.status === status && moved.customer.stage === stage && moved.order.history.at(-1).status === status);
}
await want(422, "PATCH", `/api/office/customers/${bob.id}/orders/${orderId}`, { status: "lost" }, { label: "an order status nobody knows" });
await want(422, "PATCH", `/api/office/customers/${bob.id}/orders/${orderId}`, { deposit: 1e7 }, { label: "a deposit above the price, later" });
const paid = await want(200, "PATCH", `/api/office/customers/${bob.id}/orders/${orderId}`, { deposit: 900, deliveryNotes: "Back of lot" });
ok("changing an order says what changed", paid.order.deposit === 900 && paid.customer.activity.at(-1).text === `Order #${order.order.number}: changed deposit, delivery notes`);
await want(404, "PATCH", `/api/office/customers/${bob.id}/orders/nosuchorder1`, { status: "sent" }, { label: "an order that does not exist" });

const amy = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Amy Ross", phone: "9415550209" })).customer;
const amyQuote = await want(201, "POST", `/api/office/customers/${amy.id}/quotes`, { design: garage.design });
const amyOrder = await want(201, "POST", `/api/office/customers/${amy.id}/orders`, { quoteId: amyQuote.quote.id });
const cancelled = await want(200, "PATCH", `/api/office/customers/${amy.id}/orders/${amyOrder.order.id}`, { status: "cancelled" });
ok("cancelling the only order sends the customer back to Quoted", cancelled.customer.stage === "quoted");
const resold = await want(201, "POST", `/api/office/customers/${amy.id}/orders`, { quoteId: amyQuote.quote.id });
ok("a cancelled quote can be sold again (same number)", resold.order.number === amyQuote.quote.number && resold.customer.stage === "sold");
refused = await want(409, "PATCH", `/api/office/customers/${amy.id}/orders/${amyOrder.order.id}`, { status: "sold" }, { label: "bringing back a cancelled order whose quote was sold again" });
ok("... and the cancelled order cannot come back alongside it", refused.error === "That quote was sold again on another order.");

as("u-sarah");
const moved = (await want(200, "PATCH", `/api/office/customers/${bob.id}`, { lot: "punta-gorda" })).customer;
ok("a manager can move a customer to another lot (in words)", moved.lot === "punta-gorda" && moved.activity.at(-1).text === "Moved from Port Charlotte to Punta Gorda");
ok("... their row leaves the old lot's list and joins the new one", await rowsRight(bob.id));
await want(404, "PATCH", `/api/office/customers/${bob.id}`, { lot: "nowhere" }, { label: "moving a customer to a lot that does not exist" });
as("u-mike");
await want(404, "GET", `/api/office/customers/${bob.id}`, undefined, { label: "the old lot's dealer, after the move" });
ok("... the old lot's dealer no longer has them on the list", !(await want(200, "GET", "/api/office/customers")).rows.some((x) => x.id === bob.id));
as("u-dana");
ok("... the new lot's dealer does", (await want(200, "GET", `/api/office/customers/${bob.id}`)).customer.name === "Bob Whitaker");
const danaMove = await want(403, "PATCH", `/api/office/customers/${bob.id}`, { lot: "arcadia" }, { label: "a dealer moving a customer" });
ok("... a dealer cannot move a customer, and is told who can", danaMove.error === "Only the owner or a manager can move a customer to another lot.");
await want(200, "PATCH", `/api/office/customers/${bob.id}`, { lot: "punta-gorda", stage: "delivered" }, { label: "a dealer sending the lot it is already at" });
sectionDone();

/* ======================================================================= */
section("12. Lots are walls: a dealer never sees or changes another lot's customers");

as("u-mike");
rows = (await want(200, "GET", "/api/office/customers")).rows;
ok("a dealer's list has only their lot's customers", rows.length > 0 && rows.every((x) => x.lot === "port-charlotte"));
ok("... never another lot's (Greg at Punta Gorda)", !rows.some((x) => x.id === greg.id));
await want(404, "GET", "/api/office/customers?lot=punta-gorda", undefined, { label: "a dealer asking for another lot's list" });
const notFound = await want(404, "GET", `/api/office/customers/${greg.id}`, undefined, { label: "a dealer opening another lot's customer" });
const madeUp = await want(404, "GET", "/api/office/customers/abcdefgh1234", undefined, { label: "a customer that does not exist" });
ok("another lot's customer answers exactly like one that does not exist", same(notFound, madeUp));
await want(404, "PATCH", `/api/office/customers/${greg.id}`, { stage: "lost" });
await want(404, "POST", `/api/office/customers/${greg.id}/activity`, { type: "note", text: "Peeking" });
await want(404, "POST", `/api/office/customers/${greg.id}/quotes`, { design: garage.design });
as("u-dana");
const gregQuote = await want(201, "POST", `/api/office/customers/${greg.id}/quotes`, { design: garage.design });
const gregOrder = await want(201, "POST", `/api/office/customers/${greg.id}/orders`, { quoteId: gregQuote.quote.id });
as("u-mike");
await want(404, "POST", `/api/office/customers/${greg.id}/orders`, { quoteId: gregQuote.quote.id });
await want(404, "PATCH", `/api/office/customers/${greg.id}/orders/${gregOrder.order.id}`, { status: "cancelled" });
await want(403, "GET", "/api/office/customers.csv");
ok("nothing the other lot's dealer tried changed Greg", (await S.get(`customers/${greg.id}`)).orders[0].status === "sold" && !(await S.get(`customers/${greg.id}`)).activity.some((a) => a.text === "Peeking"));
as("u-lee");
rows = (await want(200, "GET", "/api/office/customers")).rows;
ok("a dealer of two lots sees both lots' customers", rows.some((x) => x.lot === "arcadia") && rows.some((x) => x.lot === "punta-gorda") && rows.every((x) => ["arcadia", "punta-gorda"].includes(x.lot)));
ok("... and can narrow to one", (await want(200, "GET", "/api/office/customers?lot=arcadia")).rows.every((x) => x.lot === "arcadia"));
as("u-sarah");
rows = (await want(200, "GET", "/api/office/customers")).rows;
ok("a manager sees every lot's customers", ["port-charlotte", "punta-gorda", "arcadia", "rate-lot"].every((slug) => rows.some((x) => x.lot === slug)));
ok("... newest activity first", rows.every((x, i) => i === 0 || String(rows[i - 1].lastActivityAt) >= String(x.lastActivityAt)));

as("u-alan");
await want(200, "PATCH", "/api/office/lots/arcadia", { active: false }, { label: "closing Arcadia" });
as(null);
await want(404, "GET", "/api/lots/arcadia", undefined, { label: "a closed lot's designer" });
await sendQuote("arcadia", designOf(await liveCat(), "LB", "10x16").design, { name: "Closed Lot", phone: "8635550120", zip: "34266" }, { status: 404, label: "a quote request to a closed lot" });
as("u-lee");
ok("a closed lot's customers stay, for its dealers", (await want(200, "GET", "/api/office/customers?lot=arcadia")).rows.length > 0);
as("u-alan");
ok("... and for the owner", (await want(200, "GET", "/api/office/customers?lot=arcadia")).rows.length > 0);
await want(200, "PATCH", "/api/office/lots/arcadia", { active: true }, { label: "opening Arcadia again" });
sectionDone();

/* ======================================================================= */
section("13. Working at the same moment: notes, numbers, orders and list rows");

as(null);
const busy = (await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Susan Reed", phone: "9415550210" }, { who: "u-mike" })).customer;
const twoNotes = await Promise.all([
  call("POST", `/api/office/customers/${busy.id}/activity`, { type: "note", text: "Mike's note" }, { who: "u-mike" }),
  call("POST", `/api/office/customers/${busy.id}/activity`, { type: "note", text: "Sarah's note" }, { who: "u-sarah" }),
]);
let busyNow = await S.get(`customers/${busy.id}`);
ok("two people adding a note at the same moment: both answered 201", twoNotes.every((x) => x.status === 201), JSON.stringify(twoNotes.map((x) => x.status)));
ok("... and both notes stay", busyNow.activity.some((a) => a.text === "Mike's note") && busyNow.activity.some((a) => a.text === "Sarah's note"));
ok("... the list row matches the customer", await rowsRight(busy.id));
const dozen = await Promise.all(Array.from({ length: 12 }, (_, i) => call("POST", `/api/office/customers/${busy.id}/activity`, { type: "note", text: `Note ${i}` }, { who: i % 2 ? "u-mike" : "u-alan" })));
busyNow = await S.get(`customers/${busy.id}`);
ok("twelve notes at the same moment: all saved", dozen.every((x) => x.status === 201) && Array.from({ length: 12 }, (_, i) => `Note ${i}`).every((t) => busyNow.activity.some((a) => a.text === t)), JSON.stringify(dozen.map((x) => x.status)));
ok("... the list row matches the customer", await rowsRight(busy.id));
const mixed = await Promise.all([
  call("PATCH", `/api/office/customers/${busy.id}`, { stage: "contacted" }, { who: "u-mike" }),
  call("PATCH", `/api/office/customers/${busy.id}`, { followUp: { date: "2026-10-07" } }, { who: "u-sarah" }),
  call("PATCH", `/api/office/customers/${busy.id}`, { email: "susan@example.com" }, { who: "u-alan" }),
  call("POST", `/api/office/customers/${busy.id}/activity`, { type: "visit" }, { who: "u-mike" }),
]);
busyNow = await S.get(`customers/${busy.id}`);
ok("four different changes at the same moment all land", mixed.every((x) => x.status < 300) && busyNow.stage === "contacted" && busyNow.followUp?.date === "2026-10-07" && busyNow.email === "susan@example.com" && busyNow.activity.some((a) => a.text === "Visited the lot"));
ok("... and the list row has them all", await rowsRight(busy.id));

const crowd = [];
for (let i = 0; i < 10; i++) crowd.push((await want(201, "POST", "/api/office/customers", { lot: "port-charlotte", name: `Crowd ${i}`, phone: `94155506${String(i).padStart(2, "0")}` }, { who: "u-mike", label: `adding crowd customer ${i}` })).customer);
const crowdChanges = await Promise.all(crowd.map((c, i) => call("PATCH", `/api/office/customers/${c.id}`, { stage: i % 2 ? "contacted" : "lost", followUp: { date: "2026-10-1" + (i % 9) } }, { who: i % 2 ? "u-mike" : "u-sarah" })));
ok("ten customers of one lot changed at the same moment: all saved", crowdChanges.every((x) => x.status === 200), JSON.stringify(crowdChanges.map((x) => x.status)));
let allRight = true;
for (const c of crowd) allRight = (await rowsRight(c.id)) && allRight;
ok("... and every row on the lot's list matches its customer", allRight);
const crowdQuotes = await Promise.all(crowd.map((c) => call("POST", `/api/office/customers/${c.id}/quotes`, { design: garage.design }, { who: "u-mike" })));
const numbers = crowdQuotes.map((x) => x.data.quote?.number);
ok("ten quotes at the same moment get ten different numbers", crowdQuotes.every((x) => x.status === 201) && new Set(numbers).size === 10, JSON.stringify(numbers));
ok("... one after another, with none skipped", Math.max(...numbers) - Math.min(...numbers) === 9);
const webBurst = await Promise.all(Array.from({ length: 10 }, (_, i) => call("POST", "/api/lots/punta-gorda/quote-requests", {
  design: designOf(cat, "UT", "10x12").design, contact: { name: `Burst ${i}`, phone: `94155507${String(i).padStart(2, "0")}`, zip: "33950" }, idempotencyKey: freshKey(),
}, { ip: `203.0.113.${30 + i}` })));
const burstNumbers = webBurst.map((x) => x.data.number);
ok("ten website sends to one lot at the same moment: ten quotes, ten numbers", webBurst.every((x) => x.status === 201) && new Set(burstNumbers).size === 10, JSON.stringify(webBurst.map((x) => x.status)));
const burstCustomers = (await allCustomers()).filter((c) => /^Burst \d$/.test(c.name));
allRight = burstCustomers.length === 10;
for (const c of burstCustomers) allRight = (await rowsRight(c.id)) && allRight;
ok("... and all ten customers are on the lot's list, rows matching", allRight);

const sellTwice = await Promise.all([1, 2].map(() => call("POST", `/api/office/customers/${crowd[0].id}/orders`, { quoteId: crowdQuotes[0].data.quote.id }, { who: "u-mike" })));
ok("selling the same quote twice at the same moment: one order, the other told (201 + 409)", same(sellTwice.map((x) => x.status).sort(), [201, 409]), JSON.stringify(sellTwice.map((x) => x.status)));
ok("... the customer has one live order", (await S.get(`customers/${crowd[0].id}`)).orders.filter((o) => o.status !== "cancelled").length === 1);

const moveAndNote = await Promise.all([
  call("PATCH", `/api/office/customers/${crowd[1].id}`, { lot: "arcadia" }, { who: "u-sarah" }),
  call("POST", `/api/office/customers/${crowd[1].id}/activity`, { type: "note", text: "Noted while moving" }, { who: "u-mike" }),
]);
const movedCrowd = await S.get(`customers/${crowd[1].id}`);
ok("a move and a note at the same moment: the move lands", moveAndNote[0].status === 200 && movedCrowd.lot === "arcadia");
ok("... the note either landed before the move or was refused (the dealer lost the customer)", moveAndNote[1].status === 201 ? movedCrowd.activity.some((a) => a.text === "Noted while moving") : moveAndNote[1].status === 404);
ok("... and the row is only on the new lot's list", await rowsRight(crowd[1].id));

const moveAndEdit = [];
for (const c of crowd.slice(5, 10)) {
  moveAndEdit.push(...await Promise.all([
    call("PATCH", `/api/office/customers/${c.id}`, { lot: "punta-gorda" }, { who: "u-sarah" }),
    call("PATCH", `/api/office/customers/${c.id}`, { stage: "quoted" }, { who: "u-alan" }),
  ]));
}
const afterMoveAndEdit = await Promise.all(crowd.slice(5, 10).map((c) => S.get(`customers/${c.id}`)));
ok("a move and an edit by someone else at the same moment: both land, and the edit never moves the customer back",
  moveAndEdit.every((x) => x.status === 200) && afterMoveAndEdit.every((c) => c.lot === "punta-gorda" && c.stage === "quoted"),
  JSON.stringify(afterMoveAndEdit.map((c) => [c.lot, c.stage])));
allRight = true;
for (const c of crowd.slice(5, 10)) allRight = (await rowsRight(c.id)) && allRight;
ok("... and their rows are only on the new lot's list", allRight);

/* The same, in the worst order, every time: the edit has read the customer
   (at the old lot) and is held at a gate while the move finishes; then it
   goes on. A server that remembered the lot it first read would move the
   customer back, or let a dealer change a customer no longer theirs. */
let gate = null;
const gatedBlobs = new Proxy(blobs, {
  get(target, prop) {
    if (prop === "list") {
      return (options) => {
        const pages = target.list(options);
        if (!gate || options?.prefix !== "lots/") return pages;
        const held = gate;
        gate = null;
        return (async function* () { await held.open; yield* pages; })();
      };
    }
    const v = target[prop];
    return typeof v === "function" ? v.bind(target) : v;
  },
});
const gatedOffice = makeOffice({ blobs: gatedBlobs });
async function editHeldDuringMove(customerId, who, edit, moveTo) {
  let open;
  gate = { open: new Promise((done) => { open = done; }) };
  const held = call("PATCH", `/api/office/customers/${customerId}`, edit, { who, app: gatedOffice });
  while (gate) await new Promise((done) => setTimeout(done, 1));
  const move = await call("PATCH", `/api/office/customers/${customerId}`, { lot: moveTo }, { who: "u-sarah" });
  open();
  return { move, edit: await held };
}
const heldOwner = await editHeldDuringMove(crowd[4].id, "u-alan", { stage: "quoted" }, "punta-gorda");
let heldNow = await S.get(`customers/${crowd[4].id}`);
ok("an edit that read the customer before a move and saved after it never moves them back",
  heldOwner.move.status === 200 && heldOwner.edit.status === 200 && heldNow.lot === "punta-gorda" && heldNow.stage === "quoted", `${heldOwner.edit.status} ${heldNow.lot} ${heldNow.stage}`);
ok("... and the row is only on the new lot's list", await rowsRight(crowd[4].id));
const heldDealer = await editHeldDuringMove(crowd[0].id, "u-mike", { stage: "lost", lostReason: "Price" }, "arcadia");
heldNow = await S.get(`customers/${crowd[0].id}`);
ok("a dealer's edit to a customer moved away from their lot a moment ago is refused (404) and changes nothing",
  heldDealer.move.status === 200 && heldDealer.edit.status === 404 && heldNow.lot === "arcadia" && heldNow.stage !== "lost", `${heldDealer.edit.status} ${heldNow.lot} ${heldNow.stage}`);

/* rows put right by opening the customer */
await S.change("lists/port-charlotte", (doc) => { delete doc.rows[crowd[2].id]; return doc; });
as("u-mike");
ok("a customer whose row went missing is off the list", !(await want(200, "GET", "/api/office/customers")).rows.some((x) => x.id === crowd[2].id));
await want(200, "GET", `/api/office/customers/${crowd[2].id}`, undefined, { label: "opening that customer" });
ok("... opening the customer puts the row back", await rowsRight(crowd[2].id));
await S.change("lists/port-charlotte", (doc) => { doc.rows[crowd[3].id].name = "Out Of Date"; return doc; });
await want(200, "GET", `/api/office/customers/${crowd[3].id}`, undefined, { label: "opening a customer whose row is out of date" });
ok("... an out-of-date row is put right the same way", await rowsRight(crowd[3].id));
/* a move that stopped halfway left a row on the old lot */
const halfMoved = await S.get(`customers/${crowd[1].id}`);
await S.change("lists/port-charlotte", (doc) => { doc.rows[halfMoved.id] = { ...rowOf(halfMoved), lot: "port-charlotte" }; return doc; });
ok("(a row left behind on the old lot by a stopped move)", (await want(200, "GET", "/api/office/customers")).rows.some((x) => x.id === halfMoved.id));
const behind = await want(404, "GET", `/api/office/customers/${halfMoved.id}`, undefined, { label: "the old lot's dealer opening a row left behind" });
ok("... opening it answers 404 and takes the row away", behind.error === "We couldn't find that customer." && await rowsRight(halfMoved.id));

/* a list write that fails after the customer is saved */
const flaky = new Proxy(blobs, {
  get(target, prop) {
    if (prop === "setJSON") return async (key, ...rest) => { if (key.startsWith("lists/")) throw new Error("the list is busy"); return target.setJSON(key, ...rest); };
    const v = target[prop];
    return typeof v === "function" ? v.bind(target) : v;
  },
});
const flakyOffice = makeOffice({ blobs: flaky });
const saidOnce = await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Half Saved", phone: "9415550888" }, { who: "u-mike", app: flakyOffice });
ok("when the list cannot be written, the customer is still saved and the person is told it worked (no second try, no double)", saidOnce.status === 201 && !!(await S.get(`customers/${saidOnce.data.customer.id}`)));
ok("... and the problem is logged", logged.some((l) => /list row could not be updated/.test(l)));
await want(200, "GET", `/api/office/customers/${saidOnce.data.customer.id}`, undefined, { who: "u-mike", label: "opening that customer later" });
ok("... opening the customer later puts the row on the list", await rowsRight(saidOnce.data.customer.id));
sectionDone();

/* ======================================================================= */
section("14. The spreadsheet: owner and manager only, formula cells defused");

as("u-mike");
const trick = (await want(201, "POST", "/api/office/customers", {
  lot: "port-charlotte", name: "=HYPERLINK(\"http://evil.example\",\"click\")", phone: "+1 941 555 0777", city: "-2+3", zip: "@SUM(A1:A2)",
}, { label: "a customer whose details look like spreadsheet formulas" })).customer;
await want(403, "GET", "/api/office/customers.csv", undefined, { label: "a dealer downloading the spreadsheet" });
as("u-alan");
r = await call("GET", "/api/office/customers.csv");
ok("the owner downloads a spreadsheet", r.status === 200 && /^text\/csv/.test(r.headers.get("content-type")) && /attachment; filename="customers-2026-10-0\d\.csv"/.test(r.headers.get("content-disposition")), r.headers.get("content-disposition"));
ok("... never cached", r.headers.get("cache-control") === "private, no-store");
ok("... with headings in words", r.text.replace(/^﻿/, "").startsWith("Name,Phone,Email,City,ZIP,Lot,Stage,Came from,Working them,Follow-up,Latest building,Latest quote,Orders,Added,Last activity"));
const trickLine = r.text.split("\r\n").find((line) => line.includes("HYPERLINK"));
ok("a name starting with = is defused with '", trickLine?.startsWith("\"'=HYPERLINK(\"\"http://evil.example\"\",\"\"click\"\")\""), trickLine);
ok("... a phone starting with +, a city starting with - and a ZIP starting with @ too", trickLine.includes(",'+1 941 555 0777,") && trickLine.includes(",'-2+3,") && trickLine.includes(",'@SUM(A1:A2),"), trickLine);
ok("... and no cell starts a formula", !r.text.split("\r\n").some((line) => line.split(",").some((cell) => /^[=+\-@]/.test(cell))));
ok("... it has every lot's customers, with lot names in words", r.text.includes(",Punta Gorda,") && r.text.includes(",Port Charlotte,") && r.text.includes(",Arcadia,"));
as("u-sarah");
r = await call("GET", "/api/office/customers.csv");
ok("a manager downloads it too", r.status === 200 && r.text.includes("Susan Reed"));
sectionDone();

/* ======================================================================= */
section("15. Request safety: same site only, JSON only, small, no tricks, no leaks");

as("u-alan");
const WRITES = [
  ["POST", "/api/office/customers", { lot: "port-charlotte", name: "Origin Test", phone: "9415550999" }],
  ["PUT", "/api/office/price-list", { settings: {}, version: 1 }],
  ["PATCH", `/api/office/customers/${fresh.id}`, { stage: "lost" }],
  ["DELETE", `/api/office/team/invites/${sha("temp2@yoder.example").slice(0, 40)}`, undefined],
  ["POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: john, idempotencyKey: freshKey() }],
];
for (const [method, path, body] of WRITES) {
  await want(403, method, path, body, { origin: null, label: `${method} ${path} with no Origin` });
  await want(403, method, path, body, { origin: "https://evil.example", label: `${method} ${path} from another website` });
  await want(403, method, path, body, { headers: { "Sec-Fetch-Site": "cross-site" }, label: `${method} ${path} marked cross-site by the browser` });
}
ok("none of those writes happened", !(await allCustomers()).some((c) => c.name === "Origin Test") && !!(await S.get(`invites/${sha("temp2@yoder.example").slice(0, 40)}`)));
await want(415, "POST", "/api/office/customers", undefined, { raw: "lot=port-charlotte&name=Form", type: "application/x-www-form-urlencoded", label: "a form post instead of JSON" });
await want(415, "POST", "/api/office/customers", undefined, { raw: "{}", type: "text/plain", label: "JSON sent as plain text" });
await want(415, "POST", "/api/office/customers", undefined, { raw: "{}", type: null, label: "a body with no type" });
await want(413, "POST", "/api/office/customers", { lot: "port-charlotte", name: "Big", phone: "9415550998", note: "x".repeat(300 * 1024) }, { label: "a body over 256 KB" });
await want(413, "POST", "/api/office/customers", undefined, { raw: "{\"a\":".repeat(30) + "1" + "}".repeat(30), label: "a body nested 30 deep" });
for (const key of ["__proto__", "constructor", "prototype"]) {
  await want(422, "POST", "/api/office/customers", undefined, { raw: `{"lot":"port-charlotte","name":"Proto","phone":"9415550997","x":{"${key}":{"role":"owner"}}}`, label: `a body with a "${key}" key` });
}
ok("the reserved keys changed nothing", ({}).role === undefined && !(await allCustomers()).some((c) => c.name === "Proto"));
await want(400, "POST", "/api/office/customers", undefined, { raw: "{\"lot\":", label: "a body that is not finished" });
await want(422, "POST", "/api/office/customers", undefined, { raw: "[1,2]", label: "a body that is a list" });
await want(404, "GET", "/api/office/nothing-here");
await want(404, "GET", "/api/office/customers/short");
await want(404, "POST", "/api/lots/UPPER-CASE/quote-requests", { design: lbDesign, contact: john, idempotencyKey: freshKey() }, { label: "a lot link in capitals" });
await want(404, "GET", "/api/lots/no-such-lot", undefined, { label: "a lot that does not exist" });
await want(405, "DELETE", "/api/office/customers");
await want(405, "PUT", "/api/lots/port-charlotte", {}, { label: "PUT on a lot's designer data" });
await want(405, "OPTIONS", "/api/office/me");
await want(405, "PATCH", "/api/office/price-list", {});
await want(405, "GET", "/api/lots/port-charlotte/quote-requests");
r = await call("GET", "/api/office/me");
ok("answers are never cached", r.headers.get("cache-control") === "private, no-store" && r.headers.get("x-content-type-options") === "nosniff");
r = await call("GET", "/api/office/nothing-here");
ok("... errors neither", r.headers.get("cache-control") === "private, no-store");

const brokenBlobs = {
  getWithMetadata: async (key) => { throw new Error(`SECRET-DETAIL could not read ${key} from bucket 7f3a`); },
  setJSON: async () => { throw new Error("SECRET-DETAIL write"); },
  delete: async () => {},
  async *list() { throw new Error("SECRET-DETAIL list"); },
};
const loggedBefore = logged.length;
r = await call("GET", "/api/office/me", undefined, { app: makeOffice({ blobs: brokenBlobs }) });
ok("when the filing cabinet fails, the answer is 503 in plain words", r.status === 503 && r.data.error === "Something went wrong on our end. Try again in a minute.", r.text);
ok("... with none of the details", !r.text.includes("SECRET") && !r.text.includes("bucket") && !r.text.includes("people/"));
ok("... which are logged for whoever looks after the site", logged.slice(loggedBefore).some((l) => l.includes("SECRET-DETAIL")));
as(null);
r = await call("POST", "/api/lots/port-charlotte/quote-requests", { design: lbDesign, contact: john, idempotencyKey: freshKey() }, { app: makeOffice({ blobs: brokenBlobs }) });
ok("a website send while the filing cabinet fails says so plainly", r.status === 503 && !r.text.includes("SECRET"));
as("u-alan");
sectionDone();

/* ======================================================================= */
section("16. Words: every message a person could read is plain words");

const DEV_WORDS = /\b(JSON|json|Office|office|portal|Portal|admin|Admin|catalogue|catalog|config|undefined|null|NaN|tenant|ID|true|false)\b|[{}]|(?:^|[\s("])(?:offer|items|options|brand|palettes|defaults|leads|embed|pricing|notes|categories|construction|settings|cfg)(?:\.|\[)/;
const CODES = new Set([
  ...Object.keys(manufacturer.styles).filter((k) => k.length >= 2),
  ...Object.keys(manufacturer.items).filter((k) => /\d/.test(k) || ["dfr", "gfci", "ilight", "ppost", "tr", "oct"].includes(k)),
  "dbl", "jo12", "mbF", "mbW", "rbS", "rbR", "r4", "r6", "rto", "LBX1",
]);
const codeIn = (t) => [...CODES].find((code) => new RegExp(`(^|[^A-Za-z0-9-])${code.replace(/[-]/g, "\\-")}($|[^A-Za-z0-9-])`).test(t));
const badWords = wordsSeen.filter((w) => DEV_WORDS.test(w.words) || codeIn(w.words));
ok(`all ${wordsSeen.length} error messages seen in this run are plain words`, badWords.length === 0, badWords.slice(0, 6).map((w) => `${w.where}: "${w.words}"`).join(" | "));
const distinct = new Set(wordsSeen.map((w) => w.words));
ok(`(${distinct.size} different sentences)`, distinct.size > 60, String(distinct.size));
const historyNow = await want(200, "GET", "/api/office/price-list/history");
const changeWords = [...new Set([...everyChange, ...historyNow.entries.flatMap((e) => e.changes)])];
const badChanges = changeWords.filter((t) => DEV_WORDS.test(t) || codeIn(t));
ok(`all ${changeWords.length} price list change lines are plain words, never a code`, badChanges.length === 0, badChanges.slice(0, 6).join(" | "));
const activityWords = [...new Set((await allCustomers()).flatMap((c) => c.activity.map((a) => a.text)))];
const badActivity = activityWords.filter((t) => /\b(undefined|null|NaN)\b|\[object/.test(t) || codeIn(t));
ok(`all ${activityWords.length} different customer history lines are plain words`, badActivity.length === 0, badActivity.slice(0, 6).join(" | "));
const emailWords = sent.map((m) => `${m.subject}\n${m.text}`);
ok(`all ${sent.length} emails say "Dealer Center", never office or portal`, emailWords.every((t) => /Dealer Center/.test(t) && !/\b(office|Office|portal)\b/.test(t)));
sectionDone();

/* ======================================================================= */

console.log("\nChecks per heading:");
for (const s of perSection) console.log(`  ${String(s.n).padStart(4)}  ${s.title}`);
if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${passed + failures.length} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log("  - " + f);
  process.exit(1);
}
console.log(`\nPROVED (${passed} checks, ${MALFORMED.length} damaged designs, ${parity} price parity cases + ${parityHttp} sent from a browser): ` +
  "only confirmed logins on the team get in and OWNER_EMAIL claims the business once; owner, manager and dealer each can do exactly what docs/OFFICE.md says; " +
  "a dealer never sees another lot's customers; prices come only from the server and a price change reaches every lot at once while quotes keep theirs; " +
  "website sends are safe to repeat, rate-limited and never echo contact details; notes, numbers, orders and list rows survive people working at the same moment; " +
  "bad requests are refused and every message is plain words.");
