/* CHECK: A BUSINESS'S DEALER CENTER AND BARNWRIGHT'S CONTROL ROOM.
   Run: node tools/check-control-room.mjs   (check-all: node)

   WHY. A shed company that buys the Dealer Center from Barnwright gets an
   activation key; its Dealer Center checks in with Barnwright's control
   room and gets a signed pass good for seven days (server/office/
   control-room.js, a copy of the control room's own check-in code, and
   account.js, what the pass means here). If that goes wrong, a paying
   company could be locked out, or a company that stopped paying could keep
   selling. So this tries every rule.

   HOW. Leases signed by the control room's own code (test/control-room/
   leases.json) prove the copy reads them the same way. Then the real
   Dealer Center server runs against a pretend control room
   (tools/lib/fake-control-room.mjs) with a clock this check moves. Last,
   the help pass the Help screen asks for (helpPass): what is sent, and
   that only a well-formed answer is taken (what Help does with the pass
   is tools/check-help.mjs). */

import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs } from "../server/office/store.js";
import { closedPage } from "../server/office/pages.js";
import { TenantLicenseClient, createLeaseStore, verifyLease, misconfiguredLicense, LEASE_DURATION_MS } from "../server/office/control-room.js";
import { parseLease } from "../server/office/license-core.js";
import { TERMS } from "../server/office/terms.js";
import { resolve as resolveCatalogue } from "../model/company.js";
import { defaults, fromState } from "../model/design.js";
import { fakeControlRoom, controlRoomRejects } from "./lib/fake-control-room.mjs";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(resolvePath(ROOT, p), "utf8"));
const manufacturer = J("library/manufacturers/standard.json"), library = J("library/construction.json");
const templates = { full: J("companies/demo/company.json"), small: J("companies/starter/company.json") };

let passed = 0;
const failed = [];
function ok(what, cond, extra = "") {
  if (cond) { passed++; return; }
  failed.push(what);
  console.log(`  FAIL ${what}${extra ? `\n       ${extra}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);
const HOUR = 3600_000, DAY = 24 * HOUR;

/* ---- 1. the control room's own signatures -------------------------------------------------- */
section("1. Leases signed by the control room's own code read the same way here");
const fx = J("test/control-room/leases.json");
const at = fx.issuedAt + 5000;
ok("an active lease it signed is accepted", !!verifyLease(fx.leases.active, fx.publicKeyPem, fx.binding, at));
ok("a read-only lease it signed is accepted (and says read_only)", verifyLease(fx.leases.readOnly, fx.publicKeyPem, fx.binding, at)?.status === "read_only");
ok("a lease with add-ons and a bigger lot limit is accepted", verifyLease(fx.leases.withAddons, fx.publicKeyPem, fx.binding, at)?.dealerLimit === 10);
const tampered = structuredClone(fx.leases.active); tampered.payload.dealerLimit = 99;
ok("a lease with its lot limit changed afterwards is refused", !verifyLease(tampered, fx.publicKeyPem, fx.binding, at));
ok("a lease for another site is refused", !verifyLease(fx.leases.active, fx.publicKeyPem, { ...fx.binding, siteId: "someone-else" }, at));
ok("a lease for another business is refused", !verifyLease(fx.leases.active, fx.publicKeyPem, { ...fx.binding, customerId: "cust_other" }, at));
ok("an expired lease is refused unless asked for (allowExpired)", !verifyLease(fx.leases.active, fx.publicKeyPem, fx.binding, fx.issuedAt + LEASE_DURATION_MS)
  && !!verifyLease(fx.leases.active, fx.publicKeyPem, fx.binding, fx.issuedAt + LEASE_DURATION_MS, { allowExpired: true }));
ok("a lease from the future (more than a minute) is refused", !verifyLease(fx.leases.active, fx.publicKeyPem, fx.binding, fx.issuedAt - 120_000));
ok("a lease that is not exactly seven days long is not even read", parseLease({ ...fx.leases.active.payload, expiresAt: fx.issuedAt + 6 * DAY }) === null);
ok("a lease with an extra field is not read", parseLease({ ...fx.leases.active.payload, bonus: 1 }) === null);

/* ---- the Dealer Center against a pretend control room ----------------------------------------- */
const clock = { t: Date.UTC(2026, 9, 5, 14, 0, 0) };
const room = fakeControlRoom({ clock, dealerLimit: 2 });
const blobs = new MemoryBlobs();
const USERS = {
  alan: { id: "u-alan", email: "alan@yoder.test", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
  mike: { id: "u-mike", email: "mike@yoder.test", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
};
let who = "alan";
function officeWith(license) {
  return createOffice({
    blobs, identityUser: async () => (who ? USERS[who] : null), ownerEmail: USERS.alan.email,
    manufacturer, library, templates, now: () => new Date(clock.t), log: () => {},
    license, appVersion: "dealer-center check",
  });
}
const license = new TenantLicenseClient({
  controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
  activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
  store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch: room.fetch, now: () => clock.t,
});
let office = officeWith(license);
async function call(method, path, body, { as } = {}) {
  const prev = who;
  if (as !== undefined) who = as;
  const r = await office.handle(new Request("https://dealer.test" + path, {
    method, headers: { "content-type": "application/json", origin: "https://dealer.test" }, body: body ? JSON.stringify(body) : undefined,
  }), { clientIp: "203.0.113.9" });
  who = prev;
  const textBody = await r.text();
  let data; try { data = JSON.parse(textBody); } catch { data = textBody; }
  return { status: r.status, data };
}
const me = async (as) => (await call("GET", "/api/office/me", null, { as })).data;
const closedCall = async (slug) => office.publicLot(slug).then(() => null, (e) => e);

section("2. Never switched on: nothing can be saved, the 3D designer is closed");
room.down = true;
let m = await me();
ok("the screens are told: not switched on yet", m.account?.canWrite === false && m.account.reason === "unactivated", JSON.stringify(m.account));
let r = await call("POST", "/api/office/setup", { businessName: "Yoder Storage Barns", phone: "(941) 555-0100", start: "small" });
ok("first setup is refused with plain words (423)", r.status === 423 && /isn't switched on yet/.test(r.data.error), JSON.stringify(r));

section("3. Switched on: it checks in, and setup works");
room.down = false;
m = await me();
ok("opening the Dealer Center checks in with the control room", room.calls.includes("/api/license") && m.account?.canWrite === true && m.account.reason === "active", JSON.stringify(m.account));
ok("... and reports this copy and its open lots", room.business.appVersion === "dealer-center check" && room.business.dealerCount === 0);
ok("the owner is asked to agree to the Barnwright terms, with a link to read them", m.terms?.version === TERMS.version && m.terms.url === "/legal/barnwright-terms.pdf" && m.terms.agreed === null, JSON.stringify(m.terms));
r = await call("POST", "/api/office/setup", { businessName: "Yoder Storage Barns", phone: "(941) 555-0100", start: "small" });
ok("first setup without ticking \"I agree\" is refused in plain words, and no business is made", r.status === 422 && r.data.error === "Tick the box to agree to the Barnwright terms." && !(await office.parts.store.get("price-list")), JSON.stringify(r));
r = await call("POST", "/api/office/setup", { businessName: "Yoder Storage Barns", phone: "(941) 555-0100", start: "small", agreeTerms: true });
ok("first setup works", r.status === 201, JSON.stringify(r.data));
m = await me();
ok(`the agreement is kept: version ${TERMS.version}, when, and who (the owner's login)`, m.terms.agreed?.version === TERMS.version && m.terms.agreed.by.email === USERS.alan.email && m.terms.agreed.agreedAt === new Date(clock.t).toISOString(), JSON.stringify(m.terms));
{
  /* the terms changed since the owner agreed: asked again, and both are kept */
  const kept = await office.parts.store.get("barnwright-terms");
  const older = { ...kept.current, version: "0.9" };
  await office.parts.store.put("barnwright-terms", { current: older, history: [older] });
  m = await me();
  ok("after the terms change, the owner is asked again", m.terms.agreed === null);
  r = await call("POST", "/api/office/terms", { agree: false });
  ok("... not agreeing is refused in plain words", r.status === 422 && /Tick the box/.test(r.data.error));
  r = await call("POST", "/api/office/terms", { agree: true });
  const doc = await office.parts.store.get("barnwright-terms");
  ok("... \"I agree\" saves the new version and keeps the old one", r.status === 200 && r.data.terms.agreed?.version === TERMS.version && doc.history.length === 2 && doc.history[1].version === "0.9", JSON.stringify(doc));
  r = await call("POST", "/api/office/terms", { agree: true });
  ok("... agreeing again to the same version changes nothing", r.status === 200 && (await office.parts.store.get("barnwright-terms")).history.length === 2);
}
const pl = (await call("GET", "/api/office/price-list")).data;
await call("PUT", "/api/office/price-list", { settings: { ...pl.settings, status: "active" }, version: pl.version });
const calls0 = room.calls.length;
await me();
ok("it does not check in again on every page (only after six hours)", room.calls.length === calls0);

section("4. The plan's number of open lots (2 here)");
r = await call("POST", "/api/office/lots", { name: "Port Charlotte", phone: "(941) 555-0140" });
ok("first lot opens", r.status === 201, JSON.stringify(r.data));
r = await call("POST", "/api/office/lots", { name: "Punta Gorda", phone: "(941) 555-0172" });
ok("second lot opens", r.status === 201);
r = await call("POST", "/api/office/lots", { name: "Arcadia", phone: "(863) 555-0119" });
ok("a third is refused, saying the plan's number", r.status === 423 && /includes 2 open lots/.test(r.data.error), JSON.stringify(r));
m = await me();
ok("the screens are told 2 of 2 lots are open", m.account.openLots === 2 && m.account.lotLimit === 2);
r = await call("POST", "/api/office/lots", { name: "Arcadia", phone: "(863) 555-0119", active: false });
ok("a lot added closed does not need a place", r.status === 201 && r.data.lot.active === false, JSON.stringify(r.data));
r = await call("PATCH", "/api/office/lots/arcadia", { active: true });
ok("reopening it while the plan is full is refused, and it stays closed", r.status === 423 && (await office.parts.lots.get("arcadia")).active === false);
r = await call("PATCH", "/api/office/lots/punta-gorda", { active: false });
ok("closing a lot gives its place back", r.status === 200 && r.data.lot.active === false);
const tries = await Promise.all(["North Port", "Venice", "Englewood"].map((name) => call("POST", "/api/office/lots", { name })));
ok("three lots opened at the same moment for the one free place: exactly one opens",
  tries.filter((x) => x.status === 201).length === 1 && tries.filter((x) => x.status === 423).length === 2, tries.map((x) => x.status).join(","));
const openNow = (await office.parts.lots.all()).filter((l) => l.active !== false).length;
ok("... and never more than 2 are open", openNow === 2, String(openNow));
clock.t += 7 * HOUR;
await me();
ok("the next check-in reports 2 open lots", room.business.dealerCount === 2, String(room.business.dealerCount));
room.business.dealerLimit = 3;
clock.t += 7 * HOUR;
await me();
r = await call("PATCH", "/api/office/lots/arcadia", { active: true });
ok("when Barnwright raises the plan to 3, a closed lot can open again", r.status === 200 && r.data.lot.active === true, JSON.stringify(r.data));

section("5. Open: customers, quotes and the 3D designer work");
const pub = (await call("GET", "/api/lots/port-charlotte")).data;
ok("a lot's 3D designer opens", !!pub.company && pub.lot.slug === "port-charlotte");
const cat = resolveCatalogue(pub.company, manufacturer, library);
const design = fromState(defaults(cat), cat);
r = await call("POST", "/api/lots/port-charlotte/quote-requests", { design, contact: { name: "John Smith", phone: "941-555-1234", zip: "33948" }, idempotencyKey: "control-room-check-0001" });
ok("a customer's quote from the 3D designer arrives", r.status === 201, JSON.stringify(r.data));
r = await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Walk In", phone: "9415550111" });
ok("adding a customer works", r.status === 201);
r = await call("POST", "/api/office/team", { email: USERS.mike.email, name: "Mike", role: "dealer", lots: ["port-charlotte"] });
ok("adding a person works", r.status === 201 || r.status === 200, JSON.stringify(r));
await me("mike");
r = await call("POST", "/api/office/terms", { agree: true }, { as: "mike" });
ok("a dealer can't agree to the Barnwright terms for the business", r.status === 403, JSON.stringify(r));

section("6. Switched off by Barnwright: read-only at the next check-in");
room.business.status = "deactivated";
clock.t += 7 * HOUR;
m = await me();
ok("the screens are told the account is switched off", m.account.canWrite === false && m.account.reason === "deactivated", JSON.stringify(m.account));
r = await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Too Late", phone: "9415550112" });
ok("adding a customer is refused with plain words", r.status === 423 && /switched off/.test(r.data.error), JSON.stringify(r));
r = await call("PATCH", "/api/office/lots/punta-gorda", { active: true });
ok("opening a lot is refused", r.status === 423);
ok("customers can still be read", (await call("GET", "/api/office/customers")).status === 200);
ok("and downloaded", (await call("GET", "/api/office/customers.csv")).status === 200);
ok("a dealer can still read too", (await call("GET", "/api/office/customers", null, { as: "mike" })).status === 200);
r = await call("GET", "/api/lots/port-charlotte");
ok("the lot's 3D designer is closed (404, no prices)", r.status === 404 && !r.data.company, JSON.stringify(r));
const why = await closedCall("port-charlotte");
ok("... and its page gives the lot's number to call", why?.call?.phone === "(941) 555-0140", JSON.stringify(why?.call));
const page = await closedPage(404, why.call).text();
ok("... as the usual \"Our 3D designer isn't open right now\" page", /Our 3D designer isn't open right now/.test(page) && /tel:9415550140/.test(page));
r = await call("POST", "/api/lots/port-charlotte/quote-requests", { design, contact: { name: "Jane Doe", phone: "941-555-9999", zip: "33948" }, idempotencyKey: "control-room-check-0002" });
ok("a quote sent anyway is refused", r.status === 404);
r = await call("POST", "/api/office/team", { email: "new@yoder.test", name: "New", role: "dealer", lots: ["port-charlotte"] });
ok("adding a person is refused", r.status === 423);
r = await call("PATCH", "/api/office/team/u-mike", { active: false });
ok("taking a person off the team still works (nobody keeps access by accident)", r.status === 200, JSON.stringify(r));
r = await call("PATCH", "/api/office/team/u-mike", { active: true });
ok("putting them back is a change, so it waits", r.status === 423);

section("7. Switched back on");
room.business.status = "active";
clock.t += 7 * HOUR;
m = await me();
ok("at the next check-in changes work again", m.account.canWrite === true && (await call("PATCH", "/api/office/team/u-mike", { active: true })).status === 200);
ok("and the 3D designer opens again", (await call("GET", "/api/lots/port-charlotte")).status === 200);

section("8. The control room can't be reached: seven days, then read-only");
room.down = true;
const lastGood = clock.t;
clock.t = lastGood + 6 * DAY;
m = await me();
ok("six days later, changes still work", m.account.canWrite === true && (await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Day Six", phone: "9415550113" })).status === 201);
ok("and the owner is told when the last check-in was", m.account.checkedAt === lastGood && m.account.expiresAt === lastGood + LEASE_DURATION_MS);
clock.t = lastGood + LEASE_DURATION_MS;
m = await me();
ok("at seven days to the millisecond, it is read-only (\"hasn't reached Barnwright\")", m.account.canWrite === false && m.account.reason === "expired");
r = await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Day Seven", phone: "9415550114" });
ok("changes are refused with plain words", r.status === 423 && /hasn't reached Barnwright in 7 days/.test(r.data.error), JSON.stringify(r));
ok("the 3D designer is closed", (await call("GET", "/api/lots/port-charlotte")).status === 404);
clock.t = lastGood + DAY;
r = await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Clock Back", phone: "9415550115" });
ok("turning the clock back does not bring changes back", r.status === 423, JSON.stringify(r));
clock.t = lastGood + LEASE_DURATION_MS + HOUR;
room.down = false;
m = await me();
ok("when the control room answers again, it is open again", m.account.canWrite === true);

section("9. Help from Barnwright");
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "Quotes", hours: 2 }, { as: "mike" });
ok("a dealer can't turn it on", r.status === 403);
const post = (token) => office.diagnostics(new Request("https://dealer.test/.netlify/functions/tenant-diagnostics", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" }));
let early;
try { early = room.issueSupport(); } catch { early = null; }
ok("while it is off, Barnwright can't even start a check", early === null);
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "Quotes from Arcadia aren't showing up", hours: 4 });
ok("the owner turns it on for 4 hours", r.status === 200 && r.data.help.on === true && Date.parse(r.data.help.until) === clock.t + 4 * HOUR, JSON.stringify(r.data));
ok("the control room has the owner's permission and reason", room.business.support?.enabled === true && room.business.support.approvedBy === USERS.alan.email && /Arcadia/.test(room.business.support.reason));
let token = room.issueSupport();
let d = await post(token);
const report = await d.json();
ok("Barnwright's check is answered", d.status === 200, JSON.stringify(report));
ok("... in exactly the shape the control room accepts", controlRoomRejects(report) === null, controlRoomRejects(report));
ok("... with only how it runs: no customers, prices or keys", !/John Smith|9415551234|price|bwk_/i.test(JSON.stringify(report)) && report.checks.database === true && report.license.reason === "active");
ok("... and written in the owner's log", (await call("GET", "/api/office/barnwright-help")).data.help.log.some((e) => /ran a check/.test(e.words)));
d = await post(token.slice(0, -4) + "AAAA");
ok("a pass that was changed is refused (403)", d.status === 403);
d = await post("not-a-pass");
ok("something that isn't a pass is refused", d.status === 403);
r = await call("POST", "/api/office/barnwright-help", { on: false });
ok("the owner turns it off", r.status === 200 && r.data.help.on === false && room.business.support.enabled === false);
d = await post(token);
ok("the pass Barnwright already had stops working at once", d.status === 403);
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "Check again", hours: 1 });
token = room.issueSupport();
room.down = true;
r = await call("POST", "/api/office/barnwright-help", { on: false });
ok("turning it off works even when the control room can't be reached", r.status === 200 && r.data.help.on === false);
room.down = false;
d = await post(token);
ok("... and that pass is refused here even though the control room still allows it", d.status === 403 && room.business.support.enabled === true);
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "One hour", hours: 1 });
token = room.issueSupport();
clock.t += HOUR + 60_000;
d = await post(token);
ok("when the hour is up, help turns itself off", d.status === 403 && (await call("GET", "/api/office/barnwright-help")).data.help.on === false);
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "", hours: 1 });
ok("turning it on needs a reason", r.status === 422);
r = await call("POST", "/api/office/barnwright-help", { on: true, reason: "Too long", hours: 30 });
ok("and at most 24 hours", r.status === 422 && /1 to 24 hours/.test(r.data.error));

section("10. A changed or broken pass, and incomplete settings");
const leaseKey = [...blobs.values.keys()].find((k) => /^[a-f0-9]{64}$/.test(k));
const saved = blobs.values.get(leaseKey);
const broken = structuredClone(saved.data); broken.envelope.payload.dealerLimit = 50;
blobs.values.set(leaseKey, { data: broken, etag: '"tampered"' });
room.down = true;
m = await me();
ok("a pass changed in storage is not trusted: read-only", m.account.reason === "invalid_license" && m.account.canWrite === false, JSON.stringify(m.account));
ok("... and no change gets through", (await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "Tampered", phone: "9415550117" })).status === 423);
room.down = false;
m = await me();
ok("the next check-in replaces it", m.account.canWrite === true && m.account.lotLimit === 3, JSON.stringify(m.account));
office = officeWith(misconfiguredLicense());
m = await me();
ok("with some control room settings missing, nothing can be changed", m.account.reason === "invalid_license" && (await call("POST", "/api/office/customers", { lot: "port-charlotte", name: "X", phone: "9415550116" })).status === 423);
office = officeWith(undefined);
m = await me();
ok("not connected at all (Alan's own business): no account, nothing limited", m.account === null && (await call("POST", "/api/office/lots", { name: "Sixth Lot" })).status === 201);
ok("... and no Barnwright terms to agree to", m.terms === null && (await call("POST", "/api/office/terms", { agree: true })).status === 404);
d = await office.diagnostics(new Request("https://dealer.test/.netlify/functions/tenant-diagnostics", { method: "POST" }));
ok("... and no support check address", d.status === 404);

section("11. The help pass (the Help screen asks the control room for one)");
{
  /* every call the check-in code makes, with what it sent */
  const sent = [];
  const spyOn = (answer) => async (url, init = {}) => { sent.push({ url, init, body: JSON.parse(init.body || "{}") }); return answer(url, init); };
  const clientWith = (fetchImpl, more = {}) => new TenantLicenseClient({
    controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
    activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
    store: createLeaseStore(room.business.id, room.business.siteId, new MemoryBlobs()), fetch: fetchImpl, now: () => clock.t, ...more,
  });
  const refused = (promise) => promise.then(() => false, () => true);
  room.down = false;
  room.business.status = "active";
  const live = clientWith(spyOn(room.fetch));
  const pass = await live.helpPass("question", "How do I add a 12x32 size?");
  const q = sent.at(-1);
  ok("a question's pass: POST /api/help-pass at the control room", q.url === `${room.origin}/api/help-pass` && q.init.method === "POST", q.url);
  ok("... signed in with the activation key, as JSON", q.init.headers.Authorization === `Bearer ${room.business.key}` && q.init.headers["Content-Type"] === "application/json", JSON.stringify(q.init.headers));
  ok("... never following a redirect, and given up after a while", q.init.redirect === "error" && q.init.signal instanceof AbortSignal);
  ok("... sending exactly the business, the site, the kind and the question's first words",
    JSON.stringify(q.body) === JSON.stringify({ customerId: room.business.id, siteId: room.business.siteId, kind: "question", subject: "How do I add a 12x32 size?" }), JSON.stringify(q.body));
  ok("... and handing back the pass the control room signed", typeof pass === "string" && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(pass)
    && JSON.parse(Buffer.from(pass.split(".")[0], "base64url").toString()).purpose === "help-pass");
  await live.helpPass("thread");
  ok("reading the answers and reporting a problem send no subject at all", JSON.stringify(sent.at(-1).body) === JSON.stringify({ customerId: room.business.id, siteId: room.business.siteId, kind: "thread" }), JSON.stringify(sent.at(-1).body));
  const before = sent.length;
  ok("a kind the control room doesn't know is refused before anything is sent", await refused(live.helpPass("support")) && sent.length === before);
  ok("so are first words for anything but a question, words over 120 characters, and words with control characters",
    await refused(live.helpPass("thread", "Hi")) && await refused(live.helpPass("question", "x".repeat(121))) && await refused(live.helpPass("question", "line one\nline two")) && sent.length === before);
  room.business.status = "deactivated";
  ok("a business Barnwright switched off still gets a pass (it needs help most)", typeof (await live.helpPass("question", "Why is my account off?")) === "string");
  room.business.status = "active";

  const answering = (status, body) => clientWith(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  const good = "eyJ2IjoxfQ.c2lnbmF0dXJl";
  ok("the strict answer check takes {ok: true, pass} as it is", (await answering(200, { ok: true, pass: good, expiresAt: "2026-10-06T14:10:00.000Z" }).helpPass("thread")) === good);
  const bad = [
    ["a refusal (401)", 401, { error: "The activation key is not valid for this business." }],
    ["a failure (500)", 500, { ok: true, pass: good }],
    ["ok that is not exactly true", 200, { ok: "true", pass: good }],
    ["no ok at all", 200, { pass: good }],
    ["no pass", 200, { ok: true }],
    ["a pass that is not text", 200, { ok: true, pass: 12345 }],
    ["a pass without its signature", 200, { ok: true, pass: "eyJ2IjoxfQ" }],
    ["a pass with a space in it", 200, { ok: true, pass: "eyJ2Ijox fQ.c2ln" }],
    ["a pass of three parts", 200, { ok: true, pass: "a.b.c" }],
    ["a pass over 8,000 characters", 200, { ok: true, pass: "a".repeat(7999) + ".bb" }],
    ["an answer that is not JSON", 200, "<html>Sign in</html>"],
    ["an empty answer", 200, "null"],
  ];
  for (const [what, status, body] of bad) ok(`... and refuses ${what}`, await refused(answering(status, body).helpPass("thread")));
  ok("... and a control room that can't be reached", await refused(clientWith(async () => { throw new TypeError("fetch failed"); }).helpPass("problem")));
  const slow = clientWith(async (_url, init) => new Promise((_done, fail) => init.signal.addEventListener("abort", () => fail(init.signal.reason))), { timeoutMs: 50 });
  const awake = setTimeout(() => {}, 5000);   /* Node's timeout signal alone doesn't keep a check running */
  ok("... and one that doesn't answer in time", await refused(slow.helpPass("thread")));
  clearTimeout(awake);
  ok("with some control room settings missing, there is no help pass", await refused(misconfiguredLicense().helpPass("question", "Hi")));
}

console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${passed + failed.length} control room checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${passed} checks): leases signed by the control room's own code read the same way; a Dealer Center never switched on, switched off, or out of touch for 7 days stops changes and closes its 3D designer links with the lot's number while reading and downloading still work; open lots never pass the plan's number, even when opened at the same moment; taking a person off always works; the owner agrees to the Barnwright terms before the business is made, again when they change, and every agreement is kept; help from Barnwright needs the owner's switch, ends when turned off or when time is up, and answers only how the Dealer Center runs, in the shape the control room accepts; a help pass is asked for with the activation key in exactly the shape the control room expects, switched off or not, and only a well-formed pass is ever taken.`);
