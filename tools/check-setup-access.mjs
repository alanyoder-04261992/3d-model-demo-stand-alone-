/* CHECK: BARNWRIGHT SETUP ACCESS (docs/OFFICE.md, "Barnwright setup access").
   Run: node tools/check-setup-access.mjs   (check-all: node)

   WHY. Barnwright may change a business's price list and settings before
   the business is live, and after that only while the owner's switch is
   on. Get it wrong one way and Alan can't set a new business up; get it
   wrong the other way and Barnwright could change the prices of a business
   that sells to customers without the owner knowing. So this tries every
   rule, against the real Dealer Center server and a pretend control room
   (tools/lib/fake-control-room.mjs, which signs setup passes like the real
   one), with a clock this check moves:

     A2   access: before terms 2.2 nothing; before live, yes; once live,
          only with the switch; the look back for businesses set up before
          this shipped, failing closed; stop and the switch take effect at
          the very next request
     F1   live: the first opening OR the first real quote or order, written
          before the change itself
     F2   the preview of a closed 3D designer, for the team and the visit
     A3   who may flip the switch: the owner only (not a manager, not a visit)
     A4   the lock, and putting back carries the locked parts forward
     D8   a copy of the price list in use is always kept first
     A9   the visit touches nothing but the price list and its own records,
          and sends nothing
     A10  the visit: the __Host- cookie, one-use start, separate routes,
          sliding up to 8 hours, ends with access
     A11  not connected, and the lease off
     A12  the check-in carries `setup`; F7 a report that fails or is slow
          never stops the lease renewing
     F8   who saved is said by role, never by name or email
     F9   no clock times inside stored sentences
     F10  a visit that ended says so in words, with a code, never a sign-in
     F11  the owner's one Barnwright card
     A6   every edit in the contract gives the fixtures' change words,
          warnings and exact settings; F5 contact details in words
          customers read; F13 a gable roof's pitch, drawn as set
     A1   the door: a one-use pass made for one request's exact body, from
          the Control Room's server only; the support check never takes one
     A5   the door refuses exactly what the owner's own save refuses
     A7   the door's save: exactly what was checked, by Barnwright, a copy
          kept first, within the limits; F3 while the owner's switch is on,
          only Alan's own tap in the Control Room saves
     A8   undo: the price list from before Barnwright's last change
   (A13, nothing but netlify.js imports control-room.js, is in
   tools/check-imports.mjs; A14, the screens, in tools/check-setup-screens.mjs.) */

import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync } from "node:crypto";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs, wrapStore } from "../server/office/store.js";
import { TenantLicenseClient, createLeaseStore, SETUP_PASS_PREFIX, misconfiguredLicense } from "../server/office/control-room.js";
import { lockProblems, carryLocked, LOCK_WORDS } from "../server/office/setup-lock.js";
import { WHY, VISIT_WORDS, OWNER_WORDS, DOOR_WORDS, termsAtLeast, termsOut, whyWords, TERMS_NOT_OUT } from "../server/office/setup-access.js";
import { TERMS } from "../server/office/terms.js";
import { BARNWRIGHT_SAVED_FIRST, NO_COPY, describeChanges, createPriceList, priceFingerprint } from "../server/office/price-list.js";
import { applyEdits, warnings, contactKinds, UNDO_LINE } from "../server/office/setup-edits.js";
import { readView } from "../server/office/setup-view.js";
import { canonicalLease } from "../server/office/license-core.js";
import { validate, resolve as resolveCatalogue } from "../model/company.js";
import { defaults as designDefaults, setType } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { fakeControlRoom } from "./lib/fake-control-room.mjs";
import { checkSetupPass } from "./lib/make-setup-fixtures.mjs";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(resolvePath(ROOT, p), "utf8"));
const manufacturer = J("library/manufacturers/standard.json"), library = J("library/construction.json");
const templates = { full: J("companies/demo/company.json"), small: J("companies/starter/company.json") };
const FX = J("tools/lib/setup-fixtures.json");

let passed = 0;
const failed = [];
function ok(what, cond, extra = "") {
  if (cond) { passed++; return; }
  failed.push(what);
  console.log(`  FAIL ${what}${extra ? `\n       ${String(extra).slice(0, 600)}` : ""}`);
}
const section = (t) => console.log(`\n${t}`);
const HOUR = 3600_000, MIN = 60_000;
const SITE = "https://testing.example";
const ACTOR = "alan@barnwright.test";
const COOKIE = "__Host-bw_setup";
const SESSION_BODY = JSON.stringify({ action: "session" });

const USERS = {
  pat: { id: "u-pat", email: "pat@testing.example", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
  sam: { id: "u-sam", email: "sam@testing.example", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
  mike: { id: "u-mike", email: "mike@testing.example", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
};

/* One business: a store, a pretend control room, the Dealer Center server. */
function business({ connected = true, start = Date.UTC(2026, 9, 11, 15, 0, 0), blobs = new MemoryBlobs() } = {}) {
  const clock = { t: start };
  const room = fakeControlRoom({ clock, customerId: "cust_testing", siteId: "site-testing-1" });
  const b = { clock, room, blobs, who: "pat", emails: [], sentLicense: [] };
  const spyFetch = async (url, init = {}) => {
    if (new URL(url).pathname === "/api/license") b.sentLicense.push(init.body);
    return room.fetch(url, init);
  };
  b.license = connected ? new TenantLicenseClient({
    controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
    activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
    store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch: spyFetch, now: () => clock.t,
  }) : undefined;
  b.make = () => createOffice({
    blobs, identityUser: async () => (b.who ? USERS[b.who] : null), ownerEmail: USERS.pat.email,
    manufacturer, library, templates, now: () => new Date(clock.t), log: () => {},
    license: b.license, appVersion: "dealer-center check", sendEmail: async (m) => { b.emails.push(m); return true; },
  });
  b.office = b.make();
  b.store = b.office.parts.store;
  b.call = async (method, path, body, { as, cookie, origin = SITE, auth, raw, type = "application/json" } = {}) => {
    const prev = b.who;
    if (as !== undefined) b.who = as;
    const headers = {};
    if (type) headers["content-type"] = type;
    if (origin) headers.origin = origin;
    if (cookie) headers.cookie = cookie;
    if (auth) headers.authorization = auth;
    const r = await b.office.handle(new Request(SITE + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) }), { clientIp: "203.0.113.9" });
    b.who = prev;
    const t = await r.text();
    let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: r.status, data, headers: r.headers, cookies: r.headers.getSetCookie() };
  };
  b.me = async (as) => (await b.call("GET", "/api/office/me", undefined, { as })).data;
  b.agree = async (version) => {
    const doc = (await b.store.get("barnwright-terms")) || { history: [] };
    const entry = { version, agreedAt: new Date(b.clock.t).toISOString(), by: { userId: USERS.pat.id, email: USERS.pat.email, name: "" } };
    await b.store.put("barnwright-terms", { current: entry, history: [entry, ...(doc.history || [])] });
  };
  b.setUp = async () => {
    await b.me("pat");
    const r = await b.call("POST", "/api/office/setup", { businessName: "Testing Sheds", phone: "941-555-0100", start: "small", agreeTerms: true });
    if (r.status !== 201) throw new Error("setup: " + JSON.stringify(r.data));
    const lot = await b.call("POST", "/api/office/lots", { name: "Riverside", phone: "941-555-0140" });
    if (lot.status !== 201) throw new Error("lot: " + JSON.stringify(lot.data));
  };
  b.pass = (opts = {}) => room.setupPass({ actor: ACTOR, ...opts });
  b.start = async (pass = b.pass(), { raw = SESSION_BODY, origin = SITE } = {}) =>
    b.call("POST", "/api/office/barnwright/start", undefined, { as: null, auth: `Bearer ${pass}`, raw, origin });
  b.visit = async (method, path, body, cookie, opts = {}) => b.call(method, "/api/office/barnwright/" + path, body, { as: null, cookie, ...opts });
  b.priceList = async () => (await b.call("GET", "/api/office/price-list", undefined, { as: "pat" })).data;
  b.ownerSave = async (change) => {
    const pl = await b.priceList();
    const settings = structuredClone(pl.settings);
    change(settings);
    return b.call("PUT", "/api/office/price-list", { settings, version: pl.version }, { as: "pat" });
  };
  b.access = () => b.office.parts.setup.access();
  b.owner = (body, as = "pat") => b.call("POST", "/api/office/barnwright-help", body, { as });
  b.log = async () => (await b.store.get("barnwright-help-log"))?.entries || [];
  return b;
}
const cookieFrom = (r) => {
  const line = (r.cookies || []).find((c) => c.startsWith(COOKIE + "="));
  return line ? line.split(";")[0] : null;
};
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
async function snapshot(store, keys) {
  const out = {};
  for (const prefix of keys) {
    if (prefix.endsWith("/")) for (const k of await store.keys(prefix)) out[k] = JSON.stringify(await store.get(k));
    else out[prefix] = JSON.stringify(await store.get(prefix));
  }
  return out;
}
const leaseKey = (blobs) => [...blobs.values.keys()].find((k) => /^[a-f0-9]{64}$/.test(k));

/* ======================================================================================== */
section("A2. When Barnwright may change things (access(), on every request)");
const A = business();
await A.me("pat");
{
  const none = await A.access();
  ok("before First setup: closed, no price list", none.mode === null && none.why === "no-price-list", JSON.stringify(none));
  const r = await A.start();
  ok("... a visit can't start (403, the words for no-price-list)", r.status === 403 && r.data.code === "closed" && r.data.why === "no-price-list" && r.data.error === WHY["no-price-list"] && !cookieFrom(r), JSON.stringify(r.data));
}
await A.setUp();
/* First setup agrees to this copy's own terms (2.1 today, 2.2 once they are
   out): the cases below need an owner who agreed to 2.1 only, whatever
   TERMS.version is */
await A.agree("2.1");
ok("First setup writes the live record at once: not live, checked through version 1",
  JSON.stringify(await A.store.get("barnwright-live")) === JSON.stringify({ live: false, checkedThrough: 1 }), JSON.stringify(await A.store.get("barnwright-live")));
{
  const v = await A.access();
  ok(`agreed to terms ${(await A.store.get("barnwright-terms"))?.current?.version} only: closed, terms`, v.mode === null && v.why === "terms" && v.termsOk === false, JSON.stringify(v));
  const r = await A.start();
  ok("... a visit is refused with the terms words, and no cookie", r.status === 403 && r.data.why === "terms" && r.data.error === whyWords("terms") && !cookieFrom(r), JSON.stringify(r.data));
  ok("W2: the terms words: while this copy's own terms are older than 2.2 they say the new terms aren't out yet, never to tap a button that isn't there",
    termsOut() === termsAtLeast(TERMS.version) && whyWords("terms") === (termsOut() ? WHY.terms : TERMS_NOT_OUT) && (termsOut() || !/button|tap/i.test(whyWords("terms"))), whyWords("terms"));
}
ok("terms: 2.2 or later counts, as numbers (2.10 is later than 2.9)",
  termsAtLeast("2.2") && termsAtLeast("2.10") && termsAtLeast("3") && !termsAtLeast("2.1") && !termsAtLeast("2.1.9") && !termsAtLeast("") && !termsAtLeast(null) && !termsAtLeast("2.2-beta"));
await A.agree("2.2");
{
  const m = await A.me("pat");
  ok("an owner who agreed to a later version than this copy knows (2.2 here) is not asked again", m.terms?.agreed?.version === "2.2", JSON.stringify(m.terms));
  const v = await A.access();
  ok("after the owner agrees to 2.2: open before live (prelive), with no end", v.mode === "prelive" && v.until === null && v.live === false && v.termsOk === true, JSON.stringify(v));
}

/* ---- the visit, before live ---- */
section("A10. The visit: a __Host- cookie made from a one-use pass");
let pass1 = A.pass();
let r = await A.start(pass1);
let cookie = cookieFrom(r);
{
  const line = r.cookies.find((c) => c.startsWith(COOKIE + "="));
  ok("start answers ok, prelive, no until, the visit's end and the business's name",
    r.status === 200 && r.data.ok === true && r.data.mode === "prelive" && r.data.until === null
    && Date.parse(r.data.visitEndsAt) === A.clock.t + 8 * HOUR && r.data.business?.name === "Testing Sheds", JSON.stringify(r.data));
  ok("... and sets __Host-bw_setup: 32 random bytes, Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age 8 hours",
    !!line && /^__Host-bw_setup=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/.test(line), line);
  const token = cookie.split("=")[1];
  const sessions = await A.store.get("barnwright-sessions");
  ok("only the cookie's SHA-256 is stored, never the cookie itself",
    Object.keys(sessions).length === 1 && Object.keys(sessions)[0] === sha256(token) && !JSON.stringify([...A.blobs.values]).includes(token), JSON.stringify(sessions));
  ok("... with who (the pass's actor), the pass's id, and the end", Object.values(sessions)[0].actor === ACTOR && Object.values(sessions)[0].passId === JSON.parse(Buffer.from(pass1.split(".")[0], "base64url")).id);
  const log = await A.log();
  ok("the owner's log: \"Barnwright (alan@...) opened your price list.\", no time in the words and no end (a visit's end slides, and setup access may end first)",
    log[0]?.words === `Barnwright (${ACTOR}) opened your price list.` && !("until" in log[0]), JSON.stringify(log[0]));
}
r = await A.start(pass1);
ok("the same start pass again: 410, \"This link ran out\", no cookie", r.status === 410 && r.data.code === "pass-used" && r.data.error === VISIT_WORDS.linkRanOut && !cookieFrom(r), JSON.stringify(r.data));
r = await A.start(A.pass({ over: { issuedAt: A.clock.t - 200_000, expiresAt: A.clock.t - 80_000 } }));
ok("an expired pass: 401, \"This link ran out\" (never a sign-in)", r.status === 401 && r.data.code === "pass" && r.data.error === VISIT_WORDS.linkRanOut, JSON.stringify(r.data));
{
  const bad = [
    ["a pass for another action (read)", A.pass({ action: "read", body: SESSION_BODY })],
    ["a pass made for another body", A.pass({ body: JSON.stringify({ action: "session", x: 1 }) })],
    ["another business's pass", A.pass({ over: { customerId: "cust_other" } })],
    ["another site's pass", A.pass({ over: { siteId: "site-other" } })],
    ["a window over 5 minutes", A.pass({ over: { expiresAt: A.clock.t + 6 * MIN } })],
    ["issued more than 60 s ahead", A.pass({ over: { issuedAt: A.clock.t + 61_000, expiresAt: A.clock.t + 181_000 } })],
    ["signed without the prefix", A.pass({ prefix: "" })],
    ["signed as a help pass", A.pass({ prefix: "barnwright-help-pass/v1." })],
    ["signed by another key", A.pass({ key: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey })],
    ["not a pass at all", "not-a-pass"],
  ];
  const results = [];
  for (const [name, p] of bad) {
    const x = await A.start(p);
    if (!(x.status === 401 && x.data.error === VISIT_WORDS.linkRanOut && !cookieFrom(x))) results.push(`${name}: ${x.status}`);
  }
  ok(`every pass that isn't right is refused with the same words (${bad.length} kinds)`, results.length === 0, results.join("; "));
  const x = await A.start(A.pass(), { origin: "https://evil.example" });
  ok("a start from another website is refused (the site's own Origin)", x.status === 403 && !cookieFrom(x), JSON.stringify(x.data));
}
{
  /* the Dealer Center's rule and the contract's are the same on every pass in the fixtures */
  const client = new TenantLicenseClient({
    controlRoomUrl: "https://control-room.test", customerId: FX.dealer.customerId, siteId: FX.dealer.siteId, activationKey: "bwk_" + "x".repeat(40),
    publicKeyPem: FX.testKey.publicKeyPem, store: createLeaseStore(FX.dealer.customerId, FX.dealer.siteId, new MemoryBlobs()), now: () => FX.now,
  });
  const differ = [];
  for (const [action, p] of Object.entries(FX.passes)) {
    try { client.verifySetupPass(p.pass, { action, bodyBytes: Buffer.from(p.body) }); } catch (e) { differ.push(`good ${action}: ${e.reason}`); }
  }
  for (const b of FX.badPasses) {
    let reason = null;
    try { client.verifySetupPass(b.pass, { action: b.action, bodyBytes: Buffer.from(b.body) }); } catch (e) { reason = e.reason; }
    let want = null;
    try { checkSetupPass(b.pass, { publicKeyPem: FX.testKey.publicKeyPem, customerId: FX.dealer.customerId, siteId: FX.dealer.siteId, action: b.action, bodyBytes: b.body, now: FX.now }); } catch (e) { want = e.reason; }
    if (reason !== want || reason !== b.reason) differ.push(`${b.name}: ${reason} (want ${b.reason})`);
  }
  ok(`verifySetupPass keeps the fixtures' ${Object.keys(FX.passes).length} good passes and refuses their ${FX.badPasses.length} bad ones for the same reason as the contract's rule`,
    differ.length === 0, differ.join("; "));
  ok("... and the prefix is the contract's", SETUP_PASS_PREFIX === FX.pass.prefix);
}

section("A10. The visit's own routes (the cookie, never Identity)");
r = await A.visit("GET", "me", undefined, cookie);
ok("GET me: who, the mode, the visit's end, and the business", r.status === 200 && r.data.barnwright?.actor === ACTOR && r.data.barnwright.mode === "prelive"
  && r.data.barnwright.until === null && !!r.data.barnwright.visitEndsAt && r.data.business?.name === "Testing Sheds", JSON.stringify(r.data));
ok("... and sends the cookie again with its new Max-Age", /Max-Age=28800$/.test(r.cookies.find((c) => c.startsWith(COOKIE)) || ""), r.cookies.join(" | "));
for (const [path, words] of [["/api/office/customers", "customers"], ["/api/office/team", "the team"], ["/api/office/price-list", "the owner's price list route"], ["/api/office/barnwright-help", "the owner's Barnwright card"], ["/api/office/help", "Help"]]) {
  const x = await A.call("GET", path, undefined, { as: null, cookie });
  ok(`the cookie alone gets nothing from ${words} (401 Please sign in.)`, x.status === 401 && x.data.error === "Please sign in.", `${x.status} ${JSON.stringify(x.data).slice(0, 120)}`);
}
{
  const x = await A.call("GET", "/api/office/me", undefined, { as: null, cookie });
  ok("GET /api/office/me with the cookie alone: signed out, no person, no business", x.status === 401 && !x.data.person && !x.data.business, JSON.stringify(x.data));
}
let pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
ok("GET price-list during the visit: the owner's price list", pl.version === 1 && pl.settings?.brand?.name === "Testing Sheds");
{
  const settings = structuredClone(pl.settings);
  settings.offer.LB.sizes["10x16"] = 5700;
  const noOrigin = await A.visit("PUT", "price-list", { settings, version: pl.version }, cookie, { origin: null });
  ok("a change without the site's own Origin is refused", noOrigin.status === 403);
  const sentBefore = A.emails.length;
  const before = await snapshot(A.store, ["customers/", "people/", "lots/", "invites/", "barnwright-terms", "barnwright-help", "barnwright-setup", leaseKey(A.blobs)]);
  r = await A.visit("PUT", "price-list", { settings, version: pl.version }, cookie);
  ok("PUT price-list: saved through the lock and the owner's own check", r.status === 200 && r.data.version === 2 && r.data.changes?.[0] === "Loft Barn 10×16: $5,690 → $5,700" && r.data.lotCount === 1, JSON.stringify(r.data).slice(0, 300));
  ok("... saved by Barnwright, with the start pass's id", r.data.savedBy?.id === "barnwright" && r.data.savedBy.name === `Barnwright (${ACTOR})` && r.data.savedBy.passId === JSON.parse(Buffer.from(pass1.split(".")[0], "base64url")).id, JSON.stringify(r.data.savedBy));
  const hist = (await A.visit("GET", "price-list/history", undefined, cookie)).data.entries;
  ok("... and History says by Barnwright (alan@...)", hist[0].version === 2 && hist[0].savedBy.name === `Barnwright (${ACTOR})`, JSON.stringify(hist[0]));
  const log = await A.log();
  ok("the owner's log: \"Barnwright (alan@...) changed your price list: Loft Barn 10×16: $5,690 → $5,700.\"",
    log[0]?.words === `Barnwright (${ACTOR}) changed your price list: Loft Barn 10×16: $5,690 → $5,700.`, log[0]?.words);
  r = await A.visit("GET", "lots", undefined, cookie);
  ok("GET lots: the lots, for the previews", r.status === 200 && JSON.stringify(r.data.lots) === JSON.stringify([{ slug: "riverside", name: "Riverside", active: true }]), JSON.stringify(r.data));
  r = await A.visit("GET", "lots/riverside/preview", undefined, cookie);
  ok("F2: GET lots/riverside/preview: the closed 3D designer as a preview", r.status === 200 && r.data.preview === true && r.data.company?.status === "suspended" && r.data.lot?.slug === "riverside" && r.data.version === 2, JSON.stringify(r.data).slice(0, 200));
  const after = await snapshot(A.store, ["customers/", "people/", "lots/", "invites/", "barnwright-terms", "barnwright-help", "barnwright-setup", leaseKey(A.blobs)]);
  ok("A9: the visit left customers, people, lots, invites, the terms, Help, the switch and the lease exactly as they were",
    JSON.stringify(before) === JSON.stringify(after), Object.keys(after).filter((k) => before[k] !== after[k]).join(", "));
  ok("A9: ... and sent nothing", A.emails.length === sentBefore);
}

section("D8 / F9. A copy is always kept first; the owner told in words with no clock time");
{
  /* the current version's history entry went missing (a write that failed): it is written first */
  await A.store.remove("price-list-history/000002");
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  const settings = structuredClone(pl.settings);
  settings.items.w48 = 175;
  r = await A.visit("PUT", "price-list", { settings, version: pl.version }, cookie);
  const kept = await A.store.get("price-list-history/000002");
  ok("a missing history entry for the price list in use is written before the save", r.status === 200 && kept?.version === 2 && kept.settings.offer.LB.sizes["10x16"] === 5700, JSON.stringify(kept).slice(0, 200));
  /* the history store refuses writes: nothing is saved */
  await A.store.remove("price-list-history/000003");
  const origSet = A.blobs.setJSON.bind(A.blobs);
  A.blobs.setJSON = async (key, data, o) => { if (key.startsWith("price-list-history/")) throw new Error("history store down"); return origSet(key, data, o); };
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  const s2 = structuredClone(pl.settings);
  s2.items.w48 = 180;
  r = await A.visit("PUT", "price-list", { settings: s2, version: pl.version }, cookie);
  A.blobs.setJSON = origSet;
  const now = await A.store.get("price-list");
  ok("when that copy can't be kept, nothing is saved (503, the contract's words)", r.status === 503 && r.data.error === NO_COPY && r.data.code === "no-copy" && now.version === 3 && now.settings.items.w48 === 175, JSON.stringify(r.data));
  /* the owner's save after Barnwright's: the time is a field, never in the words */
  const owner = await A.call("PUT", "/api/office/price-list", { settings: now.settings, version: 2 }, { as: "pat" });
  ok("the owner saving over a Barnwright save is told so (409), with savedAt for the browser to show",
    owner.status === 409 && owner.data.error === BARNWRIGHT_SAVED_FIRST && owner.data.savedAt === now.savedAt, JSON.stringify(owner.data));
  ok("... and no clock time is in those words", !/\d{1,2}:\d{2}|\b(AM|PM)\b/.test(owner.data.error));
  const words = (await A.log()).map((e) => e.words).join(" | ");
  ok("no line in the owner's log has a clock time in its words", !/\d{1,2}:\d{2}|\b(AM|PM)\b/.test(words), words);
}

section("A4. The lock: what Barnwright may never change");
{
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  const base = pl.settings;
  const tries = [
    ["status (open to customers)", (s) => { s.status = "active"; }, LOCK_WORDS.status],
    ["embed (which websites may show it)", (s) => { s.embed = { origins: ["https://evil.example"] }; }, LOCK_WORDS.embed],
    ["leads.mode", (s) => { s.leads.mode = "webhook"; }, LOCK_WORDS.leads],
    ["leads.url", (s) => { s.leads.url = "https://evil.example/hook"; }, LOCK_WORDS.leads],
    ["leads.email", (s) => { s.leads.email = "thief@evil.example"; }, LOCK_WORDS.leads],
    ["leads.target", (s) => { s.leads.target = "_top"; }, LOCK_WORDS.leads],
    ["leads.images", (s) => { s.leads.images = true; }, LOCK_WORDS.leads],
    ["license", (s) => { s.license = { key: "x" }; }, LOCK_WORDS.license],
    ["brand.credit", (s) => { s.brand.credit = { text: "Made by someone else", url: "https://evil.example", show: true }; }, LOCK_WORDS.credit],
    ["construction (other than a gable pitch)", (s) => { s.construction = { walls: { height: 120 } }; }, LOCK_WORDS.construction],
    ["a logo that is a web address", (s) => { s.brand.logo = "https://evil.example/logo.png"; }, LOCK_WORDS.logoAddress],
    ["a logo over 150 KB", (s) => { s.brand.logo = "data:image/png;base64," + "A".repeat(150 * 1024); }, LOCK_WORDS.logoBig],
  ];
  const wrong = [];
  for (const [what, change, words] of tries) {
    const settings = structuredClone(base);
    change(settings);
    const x = await A.visit("PUT", "price-list", { settings, version: pl.version }, cookie);
    if (!(x.status === 422 && x.data.error === words && JSON.stringify(x.data.problems) === JSON.stringify([words]))) wrong.push(`${what}: ${x.status} ${x.data.error}`);
  }
  ok(`each is refused with its one plain sentence, and nothing is saved (${tries.length} tried)`, wrong.length === 0 && (await A.store.get("price-list")).version === pl.version, wrong.join("; "));
  const log = await A.log();
  ok("the owner's log: \"A Barnwright change was refused: <words>.\", once a minute at most",
    log.filter((e) => /^A Barnwright change was refused: /.test(e.words)).length === 1 && log[0].words === `A Barnwright change was refused: ${LOCK_WORDS.status.replace(/\.$/, "")}.`, log[0]?.words);
  const small = structuredClone(base);
  small.brand.logo = "data:image/png;base64," + "iVBORw0KGgo".padEnd(4000, "A");
  r = await A.visit("PUT", "price-list", { settings: small, version: pl.version }, cookie);
  ok("a logo uploaded as a picture of 150 KB or less is saved", r.status === 200 && r.data.changes.includes("New logo"), JSON.stringify(r.data).slice(0, 200));
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  const look = structuredClone(pl.settings);
  look.look = { ...(look.look || {}), scene: "yard" };
  look.leads.fields.email = "required";
  look.leads.smsConsent = "Yes, text me.";
  look.brand.phone = "941-555-0199";
  r = await A.visit("PUT", "price-list", { settings: look, version: pl.version }, cookie);
  ok("the visit may change how it looks, the quote form's boxes and words, and (by hand) the business phone", r.status === 200, JSON.stringify(r.data).slice(0, 300));
}
{
  /* the lock on its own */
  const s = structuredClone(templates.small);
  s.status = "suspended";
  const t = structuredClone(s);
  t.brand.phone = "941-555-0000";
  ok("contact details: the door may not change them while the switch is on; before live, or by hand, it may",
    JSON.stringify(lockProblems(s, t, { door: true, mode: "switch" })) === JSON.stringify([LOCK_WORDS.contact])
    && lockProblems(s, t, { door: true, mode: "prelive" }).length === 0 && lockProblems(s, t, { door: false, mode: "switch" }).length === 0);
  const rise = library.roof.shapes.gable.rise.w;
  const pitch = structuredClone(s);
  pitch.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 5 / 24 } }, { value: { w: rise } }] } } } };
  ok("a gable roof's pitch rule may change; any other rise may not", lockProblems(s, pitch, { standardRise: rise }).length === 0
    && lockProblems(s, { ...pitch, construction: { roof: { shapes: { gable: { rise: [{ when: { styles: ["LB"] }, value: { w: 5 / 24 } }, { value: { w: rise } }] } } } } }, { standardRise: rise })[0] === LOCK_WORDS.construction
    && lockProblems(s, { ...pitch, construction: { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 20 / 24 } }, { value: { w: rise } }] } } } } }, { standardRise: rise })[0] === LOCK_WORDS.construction);
  const shuffled = structuredClone(s);
  shuffled.embed = Object.fromEntries(Object.entries(s.embed || { origins: [] }).reverse());
  shuffled.brand = Object.fromEntries(Object.entries(s.brand).reverse());
  ok("the same values written in another order are not a change", lockProblems(s, shuffled).length === 0, JSON.stringify(lockProblems(s, shuffled)));
  const now = structuredClone(s);
  now.status = "active"; now.embed = { origins: ["https://mine.example"] }; now.leads = { ...now.leads, mode: "form", url: "https://mine.example/q" };
  now.brand.credit = { text: "x", url: "", show: false };
  const old = structuredClone(s);
  old.offer.UT.sizes["10x16"] = 1234;
  old.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 5 / 24 } }, { value: { w: rise } }] } } } };
  const back = carryLocked(now, old);
  ok("carryLocked: going back keeps status, embed, where quotes go and the credit as they are now, and the prices and pitch as they were",
    back.status === "active" && JSON.stringify(back.embed) === JSON.stringify(now.embed) && back.leads.mode === "form" && back.leads.url === "https://mine.example/q"
    && JSON.stringify(back.brand.credit) === JSON.stringify(now.brand.credit) && back.offer.UT.sizes["10x16"] === 1234
    && JSON.stringify(back.construction) === JSON.stringify(old.construction) && lockProblems(now, back, { standardRise: rise }).length === 0, JSON.stringify(back).slice(0, 400));
}
{
  /* put back during a visit carries the locked parts forward */
  const ownerNow = await A.ownerSave((s) => { s.embed = { origins: ["https://testingsheds.example"] }; s.leads.mode = "form"; s.leads.url = "https://testingsheds.example/quote"; });
  ok("(the owner changes which websites may show it and where quotes go)", ownerNow.status === 200, JSON.stringify(ownerNow.data).slice(0, 200));
  const cur = (await A.visit("GET", "price-list", undefined, cookie)).data;
  r = await A.visit("POST", "price-list/restore", { version: 1, current: cur.version }, cookie);
  const after = await A.store.get("price-list");
  ok("Barnwright puts back version 1: the prices go back, the owner's websites and quote routing stay, and it is still closed",
    r.status === 200 && after.settings.offer.LB.sizes["10x16"] === 5690 && JSON.stringify(after.settings.embed) === JSON.stringify({ origins: ["https://testingsheds.example"] })
    && after.settings.leads.mode === "form" && after.settings.leads.url === "https://testingsheds.example/quote" && after.settings.status === "suspended"
    && after.savedBy.id === "barnwright" && /^Put back the price list saved /.test(r.data.changes[0]), JSON.stringify(r.data).slice(0, 300));
}

section("F8. Who saved is said by role, never by name or email");
{
  const st = await A.office.parts.setup.status();
  ok("the status fields after a Barnwright save: \"Barnwright (alan@...)\", its version and pass, and it can be undone",
    st.priceList.by === `Barnwright (${ACTOR})` && st.lastBarnwrightSave?.version === st.priceList.version && st.canUndo === true && st.access === "prelive" && st.v === 1, JSON.stringify(st));
  await A.ownerSave((s) => { s.items.w48 = 190; });
  const st2 = await A.office.parts.setup.status();
  ok("the owner (who has no name, so their save is under their email) is \"the owner\", and their email is nowhere in the answer",
    st2.priceList.by === "the owner" && !JSON.stringify(st2).includes(USERS.pat.email) && st2.canUndo === false && st2.lastBarnwrightSave?.passId, JSON.stringify(st2));
  ok("the fields are the contract's, in its order", JSON.stringify(Object.keys(st2)) === JSON.stringify(["v", "live", "liveAt", "access", "why", "until", "prelive", "termsOk", "termsOut", "priceList", "lastBarnwrightSave", "canUndo", "appVersion"]), Object.keys(st2).join(","));
  const pl2 = await A.store.get("price-list");
  await A.store.put("price-list", { ...pl2, savedBy: { id: "u-gone", name: "gone@testing.example" } });
  const st3 = await A.office.parts.setup.status();
  ok("someone no longer on the team is \"someone no longer on the team\"", st3.priceList.by === "someone no longer on the team" && !JSON.stringify(st3).includes("gone@"));
  await A.store.put("price-list", pl2);
}

section("A3 / F11. The owner's one card: only the owner flips it");
{
  /* a manager joins */
  await A.call("POST", "/api/office/team", { email: USERS.sam.email, name: "Sam", role: "manager" }, { as: "pat" });
  await A.me("sam");
  r = await A.owner({ prelive: "stopped" }, "sam");
  ok("a manager is refused: \"Only the owner can let Barnwright help.\"", r.status === 403 && r.data.error === "Only the owner can let Barnwright help.", JSON.stringify(r.data));
  r = await A.call("POST", "/api/office/barnwright-help", { on: true, level: "change", reason: "Let me in", hours: 24 }, { as: null, cookie });
  ok("a visit's cookie alone is refused: 401 Please sign in.", r.status === 401 && r.data.error === "Please sign in.", JSON.stringify(r.data));
  ok("... and the switch record is untouched", (await A.store.get("barnwright-setup")) === null);
  r = await A.call("GET", "/api/office/barnwright-help", undefined, { as: "pat" });
  ok("GET: {help: {on, until, reason, log}, setup: {mode, until, why, live, liveAt, prelive, termsOk, termsOut}}",
    r.status === 200 && JSON.stringify(Object.keys(r.data.help)) === JSON.stringify(["on", "until", "reason", "log"])
    && JSON.stringify(Object.keys(r.data.setup)) === JSON.stringify(["mode", "until", "why", "live", "liveAt", "prelive", "termsOk", "termsOut"]) && r.data.setup.mode === "prelive"
    && r.data.setup.termsOut === termsOut(), JSON.stringify(r.data).slice(0, 400));
  ok("me(): the owner gets setup {mode, until} for the banner; a manager gets null", JSON.stringify((await A.me("pat")).setup) === JSON.stringify({ mode: "prelive", until: null, live: false }) && (await A.me("sam")).setup === null);
}

section("A2. Stop and allow before live take effect at once");
{
  r = await A.owner({ prelive: "stopped" });
  ok("the owner stops setup access: closed, stopped", r.status === 200 && r.data.setup.mode === null && r.data.setup.why === "stopped" && r.data.setup.prelive === "stopped", JSON.stringify(r.data.setup));
  ok("... in the log: \"<owner> stopped Barnwright's setup access.\"", (await A.log())[0].words === `${USERS.pat.email} stopped Barnwright's setup access.`, (await A.log())[0].words);
  r = await A.visit("GET", "price-list", undefined, cookie);
  ok("F10 / W3: the very next visit request: 401 visit-ended, saying why (stopped) and that the changes are kept",
    r.status === 401 && r.data.code === "visit-ended" && r.data.why === "stopped" && r.data.error === `Your Barnwright visit ended. ${WHY.stopped} Your changes are kept in this tab.`, JSON.stringify(r.data));
  r = await A.start();
  ok("a new visit can't start: 403, the words for stopped", r.status === 403 && r.data.why === "stopped" && r.data.error === WHY.stopped, JSON.stringify(r.data));
  r = await A.owner({ prelive: "on" });
  ok("the owner allows it again: prelive", r.status === 200 && r.data.setup.mode === "prelive" && (await A.log())[0].words === `${USERS.pat.email} let Barnwright set up the price list again.`, JSON.stringify(r.data.setup));
  r = await A.start();
  cookie = cookieFrom(r);
  ok("... and a visit starts again", r.status === 200 && !!cookie);
}

section("A10. A visit slides up to 8 hours after its last request");
{
  A.clock.t += 7 * HOUR;
  r = await A.visit("GET", "me", undefined, cookie);
  ok("7 hours later it still works, and its end moves 8 hours on", r.status === 200 && Date.parse(r.data.barnwright.visitEndsAt) === A.clock.t + 8 * HOUR, JSON.stringify(r.data.barnwright));
  A.clock.t += 8 * HOUR + 1000;
  r = await A.visit("GET", "me", undefined, cookie);
  ok("8 hours after its last request it has ended (401 visit-ended)", r.status === 401 && r.data.code === "visit-ended");
  r = await A.start();
  cookie = cookieFrom(r);
  r = await A.visit("POST", "end", {}, cookie);
  ok("Done: the visit ends and the cookie is cleared", r.status === 200 && r.data.ok === true && (r.cookies.find((c) => c.startsWith(COOKIE)) || "").startsWith(`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`), r.cookies.join(" | "));
  r = await A.visit("GET", "me", undefined, cookie);
  ok("... and the old cookie gets 401 visit-ended", r.status === 401 && r.data.code === "visit-ended");
}

section("A7. Limits: 120 Barnwright requests an hour, 60 saves a day");
{
  r = await A.start();
  cookie = cookieFrom(r);
  const lim = await A.store.get("barnwright-setup-limits");
  await A.store.put("barnwright-setup-limits", { ...lim, requests: 120 });
  r = await A.visit("GET", "me", undefined, cookie);
  ok("the 121st request this hour: 429, the contract's words", r.status === 429 && r.data.code === "too-many" && /^Too many Barnwright requests/.test(r.data.error), JSON.stringify(r.data));
  A.clock.t += HOUR;
  const lim2 = await A.store.get("barnwright-setup-limits");
  await A.store.put("barnwright-setup-limits", { ...lim2, day: Math.floor(A.clock.t / 86400_000), saves: 60 });
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  r = await A.visit("PUT", "price-list", { settings: { ...pl.settings, notes: { ...pl.settings.notes, finePrint: "New words." } }, version: pl.version }, cookie);
  ok("the 61st save today: 429 \"Barnwright has saved 60 changes here today.\"", r.status === 429 && r.data.error === "Barnwright has saved 60 changes here today. Try again tomorrow.", JSON.stringify(r.data));
  await A.store.put("barnwright-setup-limits", { ...lim2, day: Math.floor(A.clock.t / 86400_000), saves: 0 });
}

section("A11. The lease off: saves 423, reading still works");
{
  A.room.business.status = "deactivated";
  await A.office.checkIn({ force: true });
  pl = (await A.visit("GET", "price-list", undefined, cookie)).data;
  ok("reading the price list still works during the visit", pl.version >= 1);
  r = await A.visit("PUT", "price-list", { settings: { ...pl.settings, notes: { ...pl.settings.notes, finePrint: "Off now." } }, version: pl.version }, cookie);
  ok("a save is refused (423) in the account's own words", r.status === 423 && /switched off/.test(r.data.error), JSON.stringify(r.data));
  A.room.business.status = "active";
  await A.office.checkIn({ force: true });
}
{
  const U = business({ connected: false });
  await U.setUp();
  r = await U.start(U.pass());
  ok("a Dealer Center not connected to Barnwright: start answers 404 not-connected", r.status === 404 && r.data.code === "not-connected" && r.data.error === WHY["not-connected"], JSON.stringify(r.data));
  r = await U.visit("GET", "me", undefined, "__Host-bw_setup=" + "a".repeat(43));
  ok("... and every visit route too", r.status === 404);
  ok("... and the owner's card has no setup there", (await U.call("GET", "/api/office/barnwright-help", undefined, { as: "pat" })).data.setup === null && (await U.me("pat")).setup === null);
}

section("A12 / F7. The check-in carries setup; a report that fails never stops the lease");
{
  A.sentLicense.length = 0;
  await A.office.checkIn({ force: true });
  const body = JSON.parse(A.sentLicense.at(-1));
  ok("the check-in sends setup, between dealerCount and siteUrl, with the status fields' names and values",
    JSON.stringify(Object.keys(body)) === JSON.stringify(["customerId", "siteId", "appVersion", "dealerCount", "setup"])
    && JSON.stringify(body.setup) === JSON.stringify({ v: 1, live: false, liveAt: null, access: "prelive", why: null, until: null, prelive: "on", termsOk: true, termsOut: termsOut() }), JSON.stringify(body));
  const lease0 = (await A.license.peekAccess()).expiresAt;
  A.clock.t += 2 * HOUR;
  const setup = A.office.parts.setup;
  const real = setup.report;
  setup.report = async () => { throw new Error("broken"); };
  await A.office.checkIn({ force: true });
  const lease1 = (await A.license.peekAccess()).expiresAt;
  ok("F7: report() throwing: the check-in goes without setup, and the lease still renews", lease1 > lease0 && !("setup" in JSON.parse(A.sentLicense.at(-1))), `${lease0} -> ${lease1}`);
  A.clock.t += 2 * HOUR;
  setup.report = () => new Promise((done) => setTimeout(() => done({ v: 1 }), 1500));
  const t0 = Date.now();
  await A.office.checkIn({ force: true });
  const lease2 = (await A.license.peekAccess()).expiresAt;
  ok("F7: report() slower than 500 ms: the check-in goes without it, within about half a second, and the lease renews",
    lease2 > lease1 && !("setup" in JSON.parse(A.sentLicense.at(-1))) && Date.now() - t0 < 1400, `${Date.now() - t0} ms`);
  setup.report = real;
  /* the real report() with its store failing: its own guard */
  const origGet = A.blobs.getWithMetadata.bind(A.blobs);
  A.blobs.getWithMetadata = async (key, o) => { if (key === "barnwright-live") throw new Error("store down"); return origGet(key, o); };
  ok("report() itself: a store that fails gives null, never an error", (await setup.report()) === null);
  A.blobs.getWithMetadata = origGet;
  ok("the pretend control room (which knows nothing about setup) renewed the lease every time", A.room.business.lastSeenAt === new Date(A.clock.t).toISOString());
}

section("F1 / A2. Live: the first opening, written before the save");
{
  /* the price list write fails after the live record is written: still live */
  const L = business();
  await L.setUp(); await L.agree("2.2");
  const origSet = L.blobs.setJSON.bind(L.blobs);
  L.blobs.setJSON = async (key, data, o) => (key === "price-list" && o?.onlyIfMatch ? { modified: false } : origSet(key, data, o));
  r = await L.ownerSave((s) => { s.status = "active"; });
  L.blobs.setJSON = origSet;
  const live = await L.store.get("barnwright-live");
  ok("the live record is written before the price list is replaced: a save that then fails still counts as live",
    r.status === 409 && (await L.store.get("price-list")).data?.status === undefined && (await L.store.get("price-list")).settings.status === "suspended"
    && live?.live === true && live.how === "opened", JSON.stringify(live));
  ok("... so access is closed (live-off) though the 3D designer never opened", (await L.access()).why === "live-off");
}
{
  /* the live record can't be written: the designer doesn't open either */
  const L = business();
  await L.setUp(); await L.agree("2.2");
  const origSet = L.blobs.setJSON.bind(L.blobs);
  L.blobs.setJSON = async (key, data, o) => { if (key === "barnwright-live") throw new Error("down"); return origSet(key, data, o); };
  r = await L.ownerSave((s) => { s.status = "active"; });
  L.blobs.setJSON = origSet;
  ok("when the live record can't be written, opening fails and the designer stays closed (so access never outlives an opening)",
    r.status === 503 && (await L.store.get("price-list")).settings.status === "suspended" && (await L.access()).mode === "prelive", JSON.stringify(r.data));
}
{
  const L = business();
  await L.setUp(); await L.agree("2.2");
  r = await L.start();
  const c = cookieFrom(r);
  r = await L.ownerSave((s) => { s.status = "active"; });
  ok("the owner opens the 3D designer: live, how opened", r.status === 200 && (await L.store.get("barnwright-live")).how === "opened");
  ok("... the owner's log: \"Barnwright's setup access ended when you opened your 3D designer to customers.\"",
    (await L.log()).some((e) => e.words === "Barnwright's setup access ended when you opened your 3D designer to customers."));
  r = await L.visit("GET", "me", undefined, c);
  ok("... the visit ends on its next request (401 visit-ended)", r.status === 401 && r.data.code === "visit-ended");
  r = await L.start();
  ok("... a new visit: 403 live-off, with the contract's words", r.status === 403 && r.data.why === "live-off" && r.data.error === WHY["live-off"], JSON.stringify(r.data));
  await L.ownerSave((s) => { s.status = "suspended"; });
  ok("closing it again doesn't bring setup access back (live never changes)", (await L.access()).why === "live-off" && (await L.store.get("barnwright-live")).live === true);

  section("F11. After live: the owner's switch");
  r = await L.owner({ on: true, level: "change", reason: "New 2027 prices", hours: 4 });
  const until = new Date(L.clock.t + 4 * HOUR).toISOString();
  ok("Run checks and change my price list and settings, 4 hours: switch, until then", r.status === 200 && r.data.setup.mode === "switch" && r.data.setup.until === until && r.data.help.on === true, JSON.stringify(r.data).slice(0, 300));
  ok("... one log line with until: \"<owner> let Barnwright run checks and change the price list and settings for 4 hours: New 2027 prices\"",
    (await L.log())[0].words === `${USERS.pat.email} let Barnwright run checks and change the price list and settings for 4 hours: New 2027 prices` && (await L.log())[0].until === until);
  r = await L.start();
  let c2 = cookieFrom(r);
  ok("a visit starts in switch mode, and ends no later than the switch", r.status === 200 && r.data.mode === "switch" && r.data.until === until && r.data.visitEndsAt === until, JSON.stringify(r.data));
  ok("me(): the owner's banner gets {mode: switch, until}", JSON.stringify((await L.me("pat")).setup) === JSON.stringify({ mode: "switch", until, live: true }));
  L.clock.t += 4 * HOUR + 1000;
  r = await L.visit("GET", "me", undefined, c2);
  ok("past the switch's end: closed at once (401 visit-ended)", r.status === 401 && (await L.access()).why === "live-off");
  r = await L.owner({ on: true, level: "change", reason: "Fix the Garage prices", hours: 1 });
  r = await L.start();
  c2 = cookieFrom(r);
  ok("(on again; a visit starts)", r.status === 200 && !!c2);
  r = await L.owner({ on: false });
  ok("Turn off: both off at once, \"<owner> turned off Barnwright's access.\"", r.status === 200 && r.data.setup.mode === null && r.data.help.on === false && (await L.log())[0].words === `${USERS.pat.email} turned off Barnwright's access.`, JSON.stringify(r.data).slice(0, 300));
  r = await L.visit("GET", "price-list", undefined, c2);
  ok("... and the visit is refused on its very next request", r.status === 401 && r.data.code === "visit-ended");
  r = await L.owner({ prelive: "on" });
  ok("after live, stop and allow are refused in plain words", r.status === 422 && r.data.error === OWNER_WORDS.afterLivePrelive, JSON.stringify(r.data));
  L.room.down = true;
  r = await L.owner({ on: true, level: "change", reason: "New prices", hours: 4 });
  L.room.down = false;
  ok("with the control room down, changes still turn on (checks stay off), with the notice", r.status === 200 && r.data.setup.mode === "switch" && r.data.help.on === false && r.data.notice === OWNER_WORDS.notReached, JSON.stringify(r.data).slice(0, 300));
  r = await L.owner({ on: true, reason: "Quotes aren't arriving", hours: 1 });
  ok("Run checks alone works as Help did, with its own log line", r.status === 200 && r.data.help.on === true && (await L.log())[0].words === `${USERS.pat.email} let Barnwright run checks for 1 hour: Quotes aren't arriving`, (await L.log())[0].words);
}
{
  const T = business();
  await T.setUp(); await T.agree("2.1");
  r = await T.owner({ on: true, level: "change", reason: "New prices", hours: 4 });
  ok("change before terms 2.2: refused in plain words, nothing turned on", r.status === 422 && r.data.error === OWNER_WORDS.termsFirstRefusal && (await T.store.get("barnwright-setup")) === null, JSON.stringify(r.data));
}

section("F1. Live: the first real quote or order");
{
  const Q = business();
  await Q.setUp(); await Q.agree("2.2");
  const cust = await Q.call("POST", "/api/office/customers", { lot: "riverside", name: "John Smith", phone: "941-555-1234" }, { as: "pat" });
  ok("adding a customer alone doesn't make it live", cust.status === 201 && (await Q.access()).mode === "prelive");
  const cat = (await Q.call("GET", "/api/office/lots/riverside/preview", undefined, { as: "pat" })).data;
  const { resolve: resolveCatalogue } = await import("../model/company.js");
  const { defaults, fromState } = await import("../model/design.js");
  const c = resolveCatalogue(cat.company, manufacturer, library);
  const design = fromState(defaults(c), c);
  const quote = await Q.call("POST", `/api/office/customers/${cust.data.customer.id}/quotes`, { design }, { as: "pat" });
  const live = await Q.store.get("barnwright-live");
  ok("the first quote saved in the office makes it live (how quote), with the 3D designer still closed",
    quote.status === 201 && live?.live === true && live.how === "quote" && (await Q.store.get("price-list")).settings.status === "suspended", JSON.stringify([quote.status, live]));
  ok("... access is closed, and the owner is told why", (await Q.access()).why === "live-off" && (await Q.log())[0].words === "Barnwright's setup access ended when your first quote was saved.");
  /* an order, in a business whose live record was somehow not written yet */
  await Q.store.put("barnwright-live", { live: false, checkedThrough: 1 });
  Q.office = Q.make();
  const order = await Q.call("POST", `/api/office/customers/${cust.data.customer.id}/orders`, { quoteId: quote.data.quote.id }, { as: "pat" });
  ok("an order is the same (how order)", order.status === 201 && (await Q.store.get("barnwright-live")).how === "order", JSON.stringify((await Q.store.get("barnwright-live"))));
}
{
  /* a quote from a lot's 3D designer: the designer is open, so it is live already; the record says so first */
  const W = business();
  await W.setUp();
  await W.ownerSave((s) => { s.status = "active"; });
  await W.store.put("barnwright-live", { live: false, checkedThrough: 1 });
  W.office = W.make();
  const pub = (await W.call("GET", "/api/lots/riverside", undefined, { as: null })).data;
  const { resolve: resolveCatalogue } = await import("../model/company.js");
  const { defaults, fromState } = await import("../model/design.js");
  const c = resolveCatalogue(pub.company, manufacturer, library);
  r = await W.call("POST", "/api/lots/riverside/quote-requests", { design: fromState(defaults(c), c), contact: { name: "Jane Doe", phone: "941-555-9999", zip: "33948" }, idempotencyKey: "setup-access-check-0001" }, { as: null });
  ok("a quote request from a lot's 3D designer writes the live record first (how website-quote)", r.status === 201 && (await W.store.get("barnwright-live")).how === "website-quote", JSON.stringify(await W.store.get("barnwright-live")));
}

section("F1 / A2. The look back, for businesses set up before this shipped");
async function oldBusiness(setupFn) {
  const O = business();
  await O.setUp(); await O.agree("2.2");
  await setupFn?.(O);
  await O.store.remove("barnwright-live");
  O.office = O.make();
  O.store = O.office.parts.store;
  return O;
}
{
  const O = await oldBusiness(async (O) => { await O.ownerSave((s) => { s.status = "active"; }); });
  const v = await O.access();
  ok("open to customers now: live (found open)", v.why === "live-off" && (await O.store.get("barnwright-live")).how === "found-open");
}
{
  const O = await oldBusiness(async (O) => { await O.ownerSave((s) => { s.status = "active"; }); await O.ownerSave((s) => { s.status = "suspended"; }); });
  await (await O.access());
  ok("closed now but open in its history: live (history)", (await O.store.get("barnwright-live")).how === "history");
}
{
  const O = await oldBusiness(async (O) => {
    const cu = await O.call("POST", "/api/office/customers", { lot: "riverside", name: "Old Quote", phone: "941-555-4321" }, { as: "pat" });
    const k = `customers/${cu.data.customer.id}`;
    const rec = await O.store.get(k);
    await O.store.put(k, { ...rec, quotes: [{ id: "q1", total: 5000 }] });
  });
  await O.access();
  ok("never open, but a customer has a quote: live (customers)", (await O.store.get("barnwright-live")).how === "customers", JSON.stringify(await O.store.get("barnwright-live")));
}
{
  const O = await oldBusiness();
  const v = await O.access();
  const rec = await O.store.get("barnwright-live");
  ok("nothing found: not live, checked through the current version, and setup access is open", v.mode === "prelive" && rec.live === false && rec.checkedThrough === 1, JSON.stringify(rec));
  /* a later version above checkedThrough that was open (a save that never ran markLive) is found on the next look */
  const pl3 = await O.store.get("price-list");
  await O.store.put("price-list-history/000002", { version: 2, savedAt: pl3.savedAt, savedBy: pl3.savedBy, changes: [], settings: { ...pl3.settings, status: "active" } });
  await O.store.put("price-list", { ...pl3, version: 3 });
  await O.store.put("price-list-history/000003", { version: 3, savedAt: pl3.savedAt, savedBy: pl3.savedBy, changes: [], settings: pl3.settings });
  await O.access();
  ok("... the next look reads only versions above checkedThrough, and finds one open: live", (await O.store.get("barnwright-live")).how === "history");
}
{
  const O = await oldBusiness();
  const pl4 = await O.store.get("price-list");
  await O.store.put("price-list", { ...pl4, version: 600 });
  await O.access();
  ok("more than 500 history entries to look through: live, unsure (fail closed)", (await O.store.get("barnwright-live")).how === "unsure");
}
{
  const O = await oldBusiness();
  const pl5 = await O.store.get("price-list");
  await O.store.put("price-list", { ...pl5, version: 3 });
  await O.store.put("price-list-history/000003", { version: 3, savedAt: pl5.savedAt, savedBy: pl5.savedBy, changes: [], settings: pl5.settings });
  await O.access();
  ok("a history entry missing on the first look (version 2): live, unsure (fail closed)", (await O.store.get("barnwright-live")).how === "unsure");
}
{
  const O = await oldBusiness();
  const origGet = O.blobs.getWithMetadata.bind(O.blobs);
  O.blobs.getWithMetadata = async (key, o) => { if (key.startsWith("price-list-history/")) throw new Error("read failed"); return origGet(key, o); };
  await O.access();
  O.blobs.getWithMetadata = origGet;
  ok("a read that fails: live, unsure (fail closed)", (await O.store.get("barnwright-live")).how === "unsure");
}
{
  const O = await oldBusiness();
  for (let i = 0; i < 501; i++) await O.store.put(`customers/c${String(i).padStart(10, "0")}`, { id: "x", quotes: [], orders: [] });
  await O.access();
  ok("more than 500 customers to look through: live, unsure (fail closed)", (await O.store.get("barnwright-live")).how === "unsure");
}
{
  /* the look back never runs inside the check-in or GET me */
  const O = await oldBusiness();
  await O.me("pat");
  O.sentLicense.length = 0;
  await O.office.checkIn({ force: true });
  ok("GET me and the check-in never look back: no live record yet, and the check-in goes without setup",
    (await O.store.get("barnwright-live")) === null && O.sentLicense.length === 1 && !("setup" in JSON.parse(O.sentLicense[0])) && (await O.me("pat")).setup.mode === null);
  await O.office.setupLookBack();
  ok("the scheduled check-in's look back (setupLookBack) writes it", (await O.store.get("barnwright-live"))?.live === false);
}

section("F2. The preview of a closed 3D designer, for the team");
{
  const P = business();
  await P.setUp();
  r = await P.call("GET", "/api/office/lots/riverside/preview", undefined, { as: "pat" });
  ok("the owner: the closed lot's 3D designer as a preview", r.status === 200 && r.data.preview === true && r.data.company.status === "suspended" && r.data.lot.slug === "riverside", JSON.stringify(r.data).slice(0, 200));
  ok("customers still get the closed page (404)", (await P.call("GET", "/api/lots/riverside", undefined, { as: null })).status === 404);
  ok("a preview needs a sign-in", (await P.call("GET", "/api/office/lots/riverside/preview", undefined, { as: null })).status === 401);
  await P.call("POST", "/api/office/lots", { name: "North Port" }, { as: "pat" });
  await P.call("POST", "/api/office/team", { email: USERS.mike.email, name: "Mike", role: "dealer", lots: ["north-port"] }, { as: "pat" });
  await P.me("mike");
  ok("a dealer sees their own lot's preview, not another lot's", (await P.call("GET", "/api/office/lots/north-port/preview", undefined, { as: "mike" })).status === 200
    && (await P.call("GET", "/api/office/lots/riverside/preview", undefined, { as: "mike" })).status === 404);
  /* W7: the preview says why customers can't see it, so its bar points to the right place */
  const closedWhy = async () => (await P.call("GET", "/api/office/lots/north-port/preview", undefined, { as: "pat" })).data.closed;
  const whileClosed = await closedWhy();
  await P.ownerSave((s) => { s.status = "active"; });
  await P.call("PATCH", "/api/office/lots/north-port", { active: false }, { as: "pat" });
  ok("W7: the preview says what is closed: the whole 3D designer (Settings), or only this lot (Lots)", whileClosed === "business" && (await closedWhy()) === "lot", `${whileClosed} ${await closedWhy()}`);
}

const fxExample = (name) => FX.door.examples.find((e) => e.name === name);
/* ======================================================================================== */
/* THE EDITS, THE WARNINGS AND THE READ PARTS on their own (setup-edits.js, setup-view.js)  */

const STD_RISE = library.roof.shapes.gable.rise.w;

section("A6 / F5 / F13. The edits, the warnings and the read parts, on their own");
{
  /* every sample in the fixtures: the edits, the lock, the owner's own check (the door's steps, without the door) */
  const pl = createPriceList({ store: wrapStore(new MemoryBlobs()), manufacturer, library, templates, now: () => new Date(), log: () => {} });
  const base = FX.edits.baseSettings;
  const wrong = [];
  for (const sm of FX.edits.samples) {
    const edits = sm.name === "too many edits" ? Array.from({ length: 301 }, () => sm.edits[0]) : sm.edits;
    const res = applyEdits(base, edits, { manufacturer, mode: sm.mode, standardRise: STD_RISE });
    let got;
    if (res.problems.length) got = { ok: false, problems: res.problems };
    else {
      const next = structuredClone(res.settings);
      next.cfg = priceFingerprint(next) === priceFingerprint(base) ? base.cfg : (base.cfg || 1) + 1;
      const locked = lockProblems(base, next, { door: true, mode: sm.mode, standardRise: STD_RISE });
      if (locked.length) got = { ok: false, problems: locked };
      else {
        try { pl.check(next); got = { ok: true, changes: describeChanges(base, next, manufacturer, { contact: "new" }), warnings: warnings(base, next, manufacturer), sha: sha256(JSON.stringify(next)), newCodes: res.newCodes }; }
        catch (e) { got = { ok: false, problems: e.problems || [e.message] }; }
      }
    }
    const want = sm.expect;
    const good = want.ok
      ? got.ok && JSON.stringify(got.changes) === JSON.stringify(want.changes) && JSON.stringify(got.warnings) === JSON.stringify(want.warnings)
        && got.sha === want.settingsSha256 && JSON.stringify(got.newCodes) === JSON.stringify(want.newCodes)
      : !got.ok && JSON.stringify(got.problems) === JSON.stringify(want.problems);
    if (!good) wrong.push(`${sm.name}: ${JSON.stringify(got).slice(0, 300)}`);
  }
  ok(`A6: all ${FX.edits.samples.length} sample edits give the fixtures' change words, warnings, problems and the exact settings (SHA-256)`, wrong.length === 0, wrong.join("\n       "));
  const pathsWrong = [];
  for (const sm of FX.edits.samples.filter((x) => x.expect.ok)) {
    const res = applyEdits(FX.edits.baseSettings, sm.edits, { manufacturer, mode: sm.mode, standardRise: STD_RISE });
    for (const [p, v] of Object.entries(sm.expect.paths)) {
      const got = p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), res.settings);
      if (JSON.stringify(got) !== JSON.stringify(v)) pathsWrong.push(`${sm.name}: ${p}`);
    }
  }
  ok("applyEdits on its own leaves every part the samples name as the fixtures say", pathsWrong.length === 0, pathsWrong.join("; "));
  const given = structuredClone(FX.edits.baseSettings);
  const before = JSON.stringify(given);
  applyEdits(given, [{ do: "set_price", style: "LB", size: "10x16", price: 1 }, { do: "set_price", style: "XX", size: "10x16", price: 1 }], { manufacturer });
  const half = applyEdits(given, [{ do: "set_price", style: "LB", size: "10x16", price: 1 }, { do: "set_price", style: "XX", size: "10x16", price: 1 }], { manufacturer });
  ok("an edit list with a problem gives no settings at all, and never changes what it was given", half.settings === null && half.problems.length === 1 && JSON.stringify(given) === before);
  const odd = applyEdits(given, [{ do: "constructor" }, { do: "set_price", style: "toString", size: "10x16", price: 1 }, { do: "set_price", style: "LB", size: "10x16", price: 1, prise: 2 }, "set_price", { do: "set_item", item: "__proto__", price: 1 }], { manufacturer });
  ok("odd edits are words, never a crash: an edit name, a style or a door that only looks like one, an unknown part, not an object",
    JSON.stringify(odd.problems) === JSON.stringify(["Edit 1: there is no edit called constructor.", "Edit 2: there is no building style toString in their price list.", "Edit 3: prise isn't part of set_price.",
      "Edit 4: every edit needs do: the name of the edit.", "Edit 5: there is no door or window called __proto__ in the builder's library."]), JSON.stringify(odd.problems));
  const viewsWrong = FX.door.parts.filter((part) => JSON.stringify(readView(base, part, manufacturer)) !== JSON.stringify(fxExample(`read ${part}`).answer.body.view));
  ok(`read: each of the ${FX.door.parts.length} parts is the contract's (the fixtures' view, word for word)`, viewsWrong.length === 0, viewsWrong.join(", "));
  const all = JSON.stringify(FX.door.parts.map((part) => readView(base, part, manufacturer)));
  ok("read: never the business phone, email or website, nor the logo itself", !["941-555-0100", "office@testingsheds.example", "https://testingsheds.example"].some((t) => all.includes(t)));
}
{
  /* F5: contact details in words customers read */
  const yes = ["Call 941-555-0100", "(941) 555-0100 any time", "941.555.0100", "+1 941 555 0100", "9415550100", "www.testingsheds.com", "testingsheds.com/prices", "https://x.example", "shop.co", "office@testingsheds.example",
    "othersheds.shop", "Book at bit.ly/3xYz", "t.me/sheds", "Order at other-sheds.store"];
  const no = ["Prices plus tax. Free delivery within 50 miles.", "10x16 for $5,540", "Built in Florida.", "36 months", "Call us", "Delivery and setup included within our area.",
    "St. Petersburg", "e.g. a 10x16", "U.S.A.", "Mr. Smith", "No. 1 in sheds", "3.5/12", "v2.1"];
  ok("F5: a phone number in any usual form, a web address and an email address are found; prices, sizes and plain words aren't",
    yes.every((t) => contactKinds(t).length) && no.every((t) => !contactKinds(t).length), JSON.stringify([...yes.filter((t) => !contactKinds(t).length), ...no.filter((t) => contactKinds(t).length)]));
  ok("... and an email isn't also a web address", JSON.stringify(contactKinds("office@testingsheds.com")) === JSON.stringify(["an email address"]));
}
{
  /* F13: the roof pitch, drawn the way dealersetup/library/pitch-override.mjs checks it */
  const opts = { manufacturer, standardRise: STD_RISE };
  const own = applyEdits(FX.edits.baseSettings, [{ do: "add_own_style", built_like: "UT", name: "Premium Utility", sizes: { "10x16": 6290 } }, { do: "set_roof_pitch", style: "UT", pitch: "5/12" }], opts);
  const pitched = (settings, st) => {
    const cat = resolveCatalogue(settings, manufacturer, library);
    const s = designDefaults(cat); setType(s, st, cat); s.size = "10x16";
    const f = frameOf(s, cat);
    return (Math.max(...f.prof.map((p) => p[1])) - f.topY) / (f.W / 2) * 12;
  };
  ok("F13: set_roof_pitch UT 5/12 draws the Utility Shed at 5/12, and the style of their own built like it too; the Garage stays standard",
    own.problems.length === 0 && validate(own.settings, manufacturer).length === 0 && Math.abs(pitched(own.settings, "UT") - 5) < 0.01
    && Math.abs(pitched(own.settings, "UT1") - 5) < 0.01 && Math.abs(pitched(own.settings, "G") - STD_RISE * 24) < 0.01 && Math.abs(pitched(FX.edits.baseSettings, "UT") - STD_RISE * 24) < 0.01,
    `${pitched(own.settings, "UT").toFixed(2)} ${pitched(own.settings, "UT1").toFixed(2)} ${pitched(own.settings, "G").toFixed(2)}`);
  const two = applyEdits(FX.edits.baseSettings, [{ do: "set_roof_pitch", style: "UT", pitch: "5/12" }, { do: "set_roof_pitch", style: "G", pitch: "8/12" }, { do: "set_roof_pitch", style: "UT", pitch: "7/12" }], opts);
  ok("F13: one rule per style, in the order first changed, then the library's own rise last",
    JSON.stringify(two.settings.construction) === JSON.stringify({ roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 7 / 24 } }, { when: { styles: ["G"] }, value: { w: 8 / 24 } }, { value: { w: STD_RISE } }] } } } })
    && lockProblems(FX.edits.baseSettings, two.settings, { door: true, standardRise: STD_RISE }).length === 0, JSON.stringify(two.settings.construction));
  const back = applyEdits(two.settings, [{ do: "set_roof_pitch", style: "G", pitch: "standard" }, { do: "set_roof_pitch", style: "UT", pitch: "standard" }], opts);
  ok("F13: standard takes the style's rule out; with none left the rise goes, and construction is as it was",
    JSON.stringify(back.settings.construction) === JSON.stringify(FX.edits.baseSettings.construction), JSON.stringify(back.settings.construction));
  ok("F13: the change words say every building built like it",
    JSON.stringify(describeChanges(FX.edits.baseSettings, two.settings, manufacturer)) === JSON.stringify(["Utility Shed and every building built like it: roof pitch 6.5/12 (standard) → 7/12", "Garage and every building built like it: roof pitch 6.5/12 (standard) → 8/12"])
    && JSON.stringify(describeChanges(two.settings, back.settings, manufacturer)) === JSON.stringify(["Utility Shed and every building built like it: roof pitch 7/12 → 6.5/12 (standard)", "Garage and every building built like it: roof pitch 8/12 → 6.5/12 (standard)"]),
    JSON.stringify(describeChanges(two.settings, back.settings, manufacturer)));
  const pitches = ["3/12", "12/12"].map((p) => applyEdits(FX.edits.baseSettings, [{ do: "set_roof_pitch", style: "MU", pitch: p }], opts).problems.length);
  const refusedPitch = ["2/12", "13/12", "5.5/12", "steep", 5].map((p) => applyEdits(FX.edits.baseSettings, [{ do: "set_roof_pitch", style: "UT", pitch: p }], opts).problems[0]);
  ok("F13: 3/12 to 12/12 in whole twelfths, or standard; anything else in plain words",
    pitches.every((n) => n === 0) && refusedPitch.every((w) => w === "Edit 1: Pick a pitch from 3/12 to 12/12, in whole twelfths, or standard."), JSON.stringify(refusedPitch));
  const roofs = ["CS", "SS", "BU", "SB"].map((st) => applyEdits(FX.edits.baseSettings, [{ do: "set_roof_pitch", style: st, pitch: "6/12" }], opts).problems[0]);
  ok("F13: saltbox, single slope, lean-to and gambrel roofs are refused, each in words",
    JSON.stringify(roofs) === JSON.stringify(["saltbox", "single slope", "lean-to", "gambrel"].map((w, i) => `Edit 1: Only a gable roof's pitch can be changed here. The ${manufacturer.styles[["CS", "SS", "BU", "SB"][i]].name} has a ${w} roof, so a different pitch needs a new library style.`)), JSON.stringify(roofs));
  const hand = structuredClone(FX.edits.baseSettings);
  hand.construction = { roof: { shapes: { gable: { rise: { w: 0.3 } } } } };
  ok("F13: gable roofs set up some other way (by hand in the repository) are left alone, in words",
    applyEdits(hand, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts).problems[0] === "Edit 1: Their gable roofs were set up another way, so the pitch can't be changed here.");
}

/* ======================================================================================== */
/* THE DOOR: A1, A5, A6, A7, A8, A9 and A11 for the door, F3, F5, F13                       */

const DOOR_URL = SITE + "/.netlify/functions/barnwright-setup";
const STATUS_KEYS = ["v", "live", "liveAt", "access", "why", "until", "prelive", "termsOk", "termsOut", "priceList", "lastBarnwrightSave", "canUndo", "appVersion"];
const passIdOf = (p) => JSON.parse(Buffer.from(p.split(".")[0], "base64url").toString()).id;
const b64url = (t) => Buffer.from(t).toString("base64url");

/* A door request, as the Control Room's server sends it: a fresh pass for these exact bytes. */
function withDoor(b) {
  b.door = async (body, { via, actor = ACTOR, over, prefix, key, raw, headers = {}, method = "POST", pass, auth } = {}) => {
    const text = raw ?? JSON.stringify(body);
    const p = pass ?? b.room.setupPass({ action: body?.action ?? "status", body: text, via, actor, over, prefix, key });
    const h = { "content-type": "application/json", ...(auth === null ? {} : { authorization: auth ?? `Bearer ${p}` }), ...headers };
    const res = await b.office.setupDoor(new Request(DOOR_URL, { method, headers: h, body: method === "GET" ? undefined : text }));
    const t = await res.text();
    let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: res.status, data, headers: res.headers, pass: p };
  };
  b.fresh = async () => b.store.remove("barnwright-setup-limits");
  return b;
}

/* A business being set up whose price list is the fixtures' base (First
   setup with the small starting price list), owner agreed to terms 2.2. */
async function fixtureBusiness() {
  const F = withDoor(business());
  await F.setUp(); await F.agree("2.2");
  const pl = await F.store.get("price-list");
  const settings = structuredClone(FX.edits.baseSettings);
  await F.store.put("price-list", { ...pl, settings, version: 1, cfg: settings.cfg });
  await F.store.put("price-list-history/000001", { version: 1, savedAt: pl.savedAt, savedBy: pl.savedBy, changes: ["Set up the business with a starting price list"], settings });
  return F;
}

section("A1. The door: a one-use setup pass for each request, from the Control Room's server only");
const D = await fixtureBusiness();
{
  r = await D.door({ action: "status" });
  ok("status: 200 ok, with the status fields in the contract's order, said by role",
    r.status === 200 && r.data.ok === true && JSON.stringify(Object.keys(r.data)) === JSON.stringify(["ok", ...STATUS_KEYS])
    && r.data.access === "prelive" && r.data.priceList.version === 1 && r.data.priceList.by === "the owner" && r.data.priceList.open === false, JSON.stringify(r.data));
  ok("... never cached, and no CORS headers", r.headers.get("cache-control") === "private, no-store" && ![...r.headers.keys()].some((k) => k.startsWith("access-control-")), [...r.headers.keys()].join(","));
  const again = await D.door({ action: "status" }, { pass: r.pass });
  ok("the same pass again: 410 pass-used, with the status fields", again.status === 410 && again.data.code === "pass-used"
    && again.data.error === "This pass was already used. Each request needs a new pass." && again.data.access === "prelive", JSON.stringify(again.data));
  const seen = await D.store.get("barnwright-setup-seen");
  ok("the pass's id is kept as spent until it expires", seen?.ids?.[passIdOf(r.pass)] === D.clock.t + 120_000, JSON.stringify(seen));
}
{
  const t = D.clock.t;
  const statusText = JSON.stringify({ action: "status" });
  const env = await D.license.getEnvelope();
  const leaseToken = `${b64url(canonicalLease(env.payload))}.${env.signature}`;
  const supportHead = b64url(JSON.stringify({ purpose: "support-diagnostics", customerId: D.room.business.id, siteId: D.room.business.siteId, actor: ACTOR, grantAt: new Date(t).toISOString(), issuedAt: t, expiresAt: t + 900_000 }));
  const bad = [
    ["a help pass", { prefix: "barnwright-help-pass/v1." }],
    ["a support pass (signed with no prefix)", { prefix: "", over: { purpose: "support-diagnostics" } }],
    ["a lease, signed by the same key", { pass: leaseToken }],
    ["a support pass's shape with a blank signature", { pass: `${supportHead}.${Buffer.alloc(64).toString("base64url")}` }],
    ["another business's customer", { over: { customerId: "cust_other" } }],
    ["another business's site", { over: { siteId: "site-other-1" } }],
    ["expired", { over: { issuedAt: t - 200_000, expiresAt: t - 80_000 } }],
    ["a window over 5 minutes", { over: { expiresAt: t + 6 * MIN } }],
    ["issued more than 60 s ahead", { over: { issuedAt: t + 61_000, expiresAt: t + 181_000 } }],
    ["made for another body", { pass: D.room.setupPass({ action: "status", body: JSON.stringify({ action: "status", part: "x" }) }) }],
    ["made for another action", { pass: D.room.setupPass({ action: "read", body: statusText }) }],
    ["a visit's start pass", { pass: D.room.setupPass({ action: "session", body: statusText }) }],
    ["signed by another key", { key: generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey }],
    ["no pass", { auth: null }],
    ["not a pass", { pass: "not.a-pass" }],
  ];
  const wrong = [];
  for (const [name, opts] of bad) {
    const x = await D.door({ action: "status" }, opts);
    if (!(x.status === 401 && x.data.code === "pass" && x.data.error === "The pass for this request isn't valid. Try again from the Control Room." && !("access" in x.data))) wrong.push(`${name}: ${x.status} ${x.data.code}`);
  }
  ok(`every pass that isn't right gets 401 pass, the same words, and no status (${bad.length} kinds)`, wrong.length === 0, wrong.join("; "));
}
{
  const shapes = [
    ["an Origin header", {}, { headers: { origin: SITE } }, 400, "bad-request"],
    ["a Cookie header", {}, { headers: { cookie: COOKIE + "=x" } }, 400, "bad-request"],
    ["not application/json", {}, { headers: { "content-type": "text/plain" } }, 400, "bad-request"],
    ["GET", {}, { method: "GET" }, 405, "method"],
    ["an action the door doesn't have", { action: "publish" }, {}, 400, "bad-request"],
    ["a visit's start body", { action: "session" }, {}, 400, "bad-request"],
    ["not a JSON object", null, { raw: "[1,2]" }, 400, "bad-request"],
    ["24 levels deep and more", null, { raw: JSON.stringify({ action: "status", x: JSON.parse("[".repeat(30) + "]".repeat(30)) }) }, 400, "bad-request"],
    ["over 64 KB", { action: "check", version: 1, edits: [{ do: "set_fine_print", text: "x".repeat(66_000) }] }, {}, 413, "too-big"],
  ];
  const wrong = [];
  for (const [name, body, opts, status, code] of shapes) {
    const x = await D.door(body ?? { action: "status" }, opts);
    if (!(x.status === status && x.data.code === code)) wrong.push(`${name}: ${x.status} ${x.data.code}`);
  }
  ok(`a request that isn't the Control Room's server's is refused before the pass (${shapes.length} kinds)`, wrong.length === 0, wrong.join("; "));
  const p = D.room.setupPass({ action: "status", body: JSON.stringify({ action: "status" }) });
  const first = await D.door({ action: "status" }, { pass: p, headers: { origin: SITE } });
  const then = await D.door({ action: "status" }, { pass: p });
  ok("... and such a refusal doesn't spend the pass", first.status === 400 && then.status === 200, `${first.status} ${then.status}`);
}
{
  const T = withDoor(business());
  await T.setUp(); await T.agree("2.1");
  const read = await T.door({ action: "read", part: "summary" });
  ok("before terms 2.2: status still answers, read is refused (403 closed, terms), with the status fields",
    (await T.door({ action: "status" })).data.why === "terms" && read.status === 403 && read.data.code === "closed" && read.data.why === "terms" && read.data.error === whyWords("terms") && read.data.termsOk === false && read.data.termsOut === termsOut(), JSON.stringify(read.data));
  const again = await T.door({ action: "read", part: "summary" }, { pass: read.pass });
  ok("... a pass refused for another reason is still spent (410)", again.status === 410 && again.data.code === "pass-used");
  const U = withDoor(business({ connected: false }));
  await U.setUp();
  r = await U.door({ action: "status" });
  ok("a Dealer Center not connected to Barnwright: 404 not-connected", r.status === 404 && r.data.code === "not-connected" && r.data.error === WHY["not-connected"], JSON.stringify(r.data));
  const Mis = withDoor(business());
  Mis.office = createOffice({ blobs: new MemoryBlobs(), identityUser: async () => null, ownerEmail: USERS.pat.email, manufacturer, library, templates, now: () => new Date(Mis.clock.t), log: () => {}, license: misconfiguredLicense() });
  r = await Mis.door({ action: "status" });
  ok("... and one with only some of its Control Room settings: 404 too, no pass is ever taken", r.status === 404 && r.data.code === "not-connected", JSON.stringify(r.data));
  let refused = "no";
  try { misconfiguredLicense().verifySetupPass(D.room.setupPass(), { action: "session", bodyBytes: SESSION_BODY }); } catch { refused = "yes"; }
  ok("... whose refusing twin refuses every setup pass", refused === "yes");
}
{
  /* the support check never takes a setup pass, and never asks the control room about one */
  await D.call("POST", "/api/office/barnwright-help", { on: true, reason: "Check the quotes", hours: 1 }, { as: "pat" });
  const calls = D.room.calls.length;
  const setupPass = D.room.setupPass({ action: "status", body: JSON.stringify({ action: "status" }) });
  const res = await D.office.diagnostics(new Request(SITE + "/.netlify/functions/tenant-diagnostics", { method: "POST", headers: { authorization: `Bearer ${setupPass}` } }));
  ok("tenant-diagnostics refuses a setup pass (403), without asking the control room", res.status === 403 && !D.room.calls.slice(calls).includes("/api/support-verify"), D.room.calls.slice(calls).join(","));
  const good = await D.office.diagnostics(new Request(SITE + "/.netlify/functions/tenant-diagnostics", { method: "POST", headers: { authorization: `Bearer ${D.room.issueSupport()}` } }));
  ok("... while a real support pass still works", good.status === 200);
  await D.call("POST", "/api/office/barnwright-help", { on: false }, { as: "pat" });
}

section("A1 / F8. read: one part at a time, readable, never contact details or emails");
{
  await D.fresh();
  const all = [];
  const wrong = [];
  for (const part of FX.door.parts) {
    const x = await D.door({ action: "read", part });
    all.push(x);
    const want = fxExample(`read ${part}`).answer.body;
    if (!(x.status === 200 && x.data.part === part && JSON.stringify(x.data.view) === JSON.stringify(want.view))) wrong.push(`${part}: ${x.status} ${JSON.stringify(x.data).slice(0, 120)}`);
  }
  ok(`each of the ${FX.door.parts.length} parts is the contract's (the fixtures' view, word for word)`, wrong.length === 0, wrong.join("; "));
  const h = all[0].data.history;
  ok("history: the newest saves, who by role, the first 5 changes and how many more", Array.isArray(h) && h.length === 1 && h[0].version === 1 && h[0].by === "the owner"
    && JSON.stringify(h[0].changes) === JSON.stringify(["Set up the business with a starting price list"]) && h[0].more === 0, JSON.stringify(h));
  const text = JSON.stringify(all.map((x) => x.data));
  ok("no read has the business phone, email or website, the owner's email, or the logo itself",
    !["941-555-0100", "office@testingsheds.example", "https://testingsheds.example", USERS.pat.email].some((s) => text.includes(s)), text.slice(0, 200));
  /* the owner changes the business phone and email: History says so, a read doesn't say what to */
  const pl0 = await D.store.get("price-list");
  await D.store.put("price-list-history/000099", { version: 99, savedAt: pl0.savedAt, savedBy: pl0.savedBy, settings: pl0.settings,
    changes: ["Phone: 941-555-0100 → 941-555-0123", "Email: office@testingsheds.example → pat@testing.example", "Website: https://testingsheds.example → https://www.testingsheds.com", "Tagline: A → B"] });
  const hx = (await D.door({ action: "read", part: "colors" })).data.history[0];
  await D.store.remove("price-list-history/000099");
  ok("a history line with the business phone, email or website says only what changed, never the numbers or addresses",
    JSON.stringify(hx.changes) === JSON.stringify(["Changed the business phone", "Changed the business email", "Changed the business website", "Tagline: A → B"]), JSON.stringify(hx));
  const sum = (await D.door({ action: "read" })).data;
  ok("part left out: summary", sum.part === "summary" && sum.view.business.hasPhone === true && JSON.stringify(sum.view.business.logo) === JSON.stringify({ present: false, kb: 0 }));
  ok("an unknown part: 400 bad-request", (await D.door({ action: "read", part: "customers" })).data.code === "bad-request");
  const looked = (await D.log()).filter((e) => e.words === "Barnwright looked at your price list.");
  ok("the owner's log: \"Barnwright looked at your price list.\" once, however many reads", looked.length === 1, JSON.stringify(looked));
  D.clock.t += 31 * MIN;
  await D.door({ action: "read", part: "colors" });
  ok("... and again after 30 minutes", (await D.log()).filter((e) => e.words === "Barnwright looked at your price list.").length === 2);
}

section("A6 / F5 / F13. check: every edit in the contract, through the door, against the fixtures");
const S = withDoor(await fixtureBusiness());
{
  /* the owner's switch is on: open to customers, then Run checks and change */
  await S.ownerSave((s) => { s.status = "active"; });
  await S.call("POST", "/api/office/barnwright-help", { on: true, level: "change", reason: "New prices", hours: 4 }, { as: "pat" });
  ok("(a second business, open to customers, with the owner's switch on)", (await S.access()).mode === "switch");
}
{
  const wrong = [];
  let n = 0;
  for (const sm of FX.edits.samples) {
    const B = sm.mode === "switch" ? S : D;
    if (++n % 50 === 0) { await D.fresh(); await S.fresh(); }
    const edits = sm.name === "too many edits" ? Array.from({ length: 301 }, () => sm.edits[0]) : sm.edits;
    const version = (await B.store.get("price-list")).version;
    const x = await B.door({ action: "check", version, edits });
    const want = sm.expect;
    const good = want.ok
      ? x.status === 200 && JSON.stringify(x.data.changes) === JSON.stringify(want.changes) && JSON.stringify(x.data.warnings) === JSON.stringify(want.warnings)
        && x.data.settingsSha256 === want.settingsSha256 && x.data.contactDetailsChange === want.contactDetailsChange && JSON.stringify(x.data.newCodes) === JSON.stringify(want.newCodes)
        && x.data.counts.edits === edits.length && x.data.counts.changes === want.changes.length && x.data.counts.warnings === want.warnings.length && x.data.moreChanges === 0
      : x.status === 422 && x.data.code === "problems" && JSON.stringify(x.data.problems) === JSON.stringify(want.problems) && x.data.error === want.problems.join(" ");
    if (!good) wrong.push(`${sm.name}: ${x.status} ${JSON.stringify(x.data).slice(0, 300)}`);
  }
  ok(`all ${FX.edits.samples.length} sample edits give the fixtures' change words, warnings, problems and the exact settings (SHA-256)`, wrong.length === 0, wrong.join("\n       "));
  ok("... and a check saves nothing", (await D.store.get("price-list")).version === 1 && (await D.store.keys("price-list-history/")).length === 1);
}
{
  /* F5: contact details first, then words customers read with contact details in them */
  r = await D.door({ action: "check", version: 1, edits: [{ do: "set_option", group: "misc", key: "shutter", price: 80, name: "Shutters, call 941-555-0100" }, { do: "set_size_note", width: 14, text: "See www.permits.gov" }, { do: "set_business", website: "https://testingsheds.example/new", email: "sales@testingsheds.example" }] });
  ok("F5: the contact change is listed first, then each text customers read with contact details in it",
    r.status === 200 && JSON.stringify(r.data.warnings.slice(0, 3)) === JSON.stringify([
      "This changes the business email and website that customers see. Check it with the owner.",
      "The note for 14 ft wide buildings has a web address in it. Customers read it, so check it is right.",
      "The option name \"Shutters, call 941-555-0100\" has a phone number in it. Customers read it, so check it is right."]) && r.data.contactDetailsChange === true, JSON.stringify(r.data.warnings));
  const v = (await S.store.get("price-list")).version;
  r = await S.door({ action: "check", version: v, edits: [{ do: "set_business", tagline: "Sheds that last" }] });
  ok("F5: while the switch is on, the door may still change the tagline and the name (not the contact details)", r.status === 200 && r.data.changes[0] === "Tagline: \"Sheds that last\"", JSON.stringify(r.data));
}
{
  /* F13 through the door */
  await D.fresh();
  const chk = await D.door({ action: "check", version: 1, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "5/12" }] });
  const sv = await D.door({ action: "save", version: 1, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "5/12" }], settingsSha256: chk.data.settingsSha256 });
  const bld = await D.door({ action: "read", part: "buildings" });
  ok("F13: through the door it passes the lock and saves, and read says UT 5/12, the Garage standard, the Loft Barn none",
    sv.status === 200 && sv.data.version === 2 && sv.data.changes[0] === "Utility Shed and every building built like it: roof pitch 6.5/12 (standard) → 5/12"
    && JSON.stringify(bld.data.view.styles.map((x) => [x.code, x.pitch])) === JSON.stringify([["UT", "5/12"], ["LB", null], ["G", "standard"]]), JSON.stringify([sv.data, bld.data.view?.styles?.map((x) => x.pitch)]));
  const und = await D.door({ action: "check", version: 2, undo: true });
  r = await D.door({ action: "undo", version: 2, settingsSha256: und.data.settingsSha256 });
  ok("(and undone again)", r.status === 200 && r.data.version === 3 && JSON.stringify((await D.store.get("price-list")).settings.construction) === "{}", JSON.stringify(r.data));
}

section("A5. Parity: the door's check refuses exactly what the owner's own save refuses");
{
  const cases = [
    ["the opening size isn't sold", [{ do: "set_defaults", size: "14x40" }]],
    ["a Dormer Shed with no dormer priced", [{ do: "sell_style", style: "DS", sizes: { "10x16": 6290 } }]],
    ["the opening siding color isn't on the list", [{ do: "set_defaults", colors: { body: "Purple" } }]],
    ["two styles with one name", [{ do: "rename_style", style: "UT", name: "Loft Barn" }]],
  ];
  const wrong = [];
  for (const [name, edits] of cases) {
    const v = (await D.store.get("price-list")).version;
    const door = await D.door({ action: "check", version: v, edits });
    const res = applyEdits((await D.store.get("price-list")).settings, edits, { manufacturer, standardRise: STD_RISE });
    const owner = res.settings ? await D.call("PUT", "/api/office/price-list", { settings: res.settings, version: v }, { as: "pat" }) : { status: 0, data: { problems: res.problems } };
    if (!(door.status === 422 && owner.status === 422 && door.data.problems.length && JSON.stringify(door.data.problems) === JSON.stringify(owner.data.problems))) {
      wrong.push(`${name}: door ${door.status} ${JSON.stringify(door.data.problems)} owner ${owner.status} ${JSON.stringify(owner.data.problems)}`);
    }
  }
  ok(`the door's problems are the owner's 422 problems, word for word (${cases.length} cases)`, wrong.length === 0, wrong.join("; "));
}

section("A7. save: exactly what was checked, by Barnwright, a copy kept first");
const F = await fixtureBusiness();
{
  /* the fixtures' conversation, on the fixtures' base */
  const conv = (n) => fxExample(n).answer.body;
  const edits = JSON.parse(fxExample("check").request.body).edits;
  const chk = await F.door({ action: "check", version: 1, edits });
  ok("check: the fixtures' change words and settingsSha256, nothing written", chk.status === 200 && JSON.stringify(chk.data.changes) === JSON.stringify(conv("check").changes)
    && chk.data.settingsSha256 === conv("check").settingsSha256 && (await F.store.get("price-list")).version === 1, JSON.stringify(chk.data));
  const before = await snapshot(F.store, ["customers/", "people/", "lots/", "invites/", "barnwright-terms", "barnwright-help", "barnwright-setup", leaseKey(F.blobs)]);
  const sv = await F.door({ action: "save", version: 1, edits, settingsSha256: chk.data.settingsSha256 }, { via: "claude" });
  const pl = await F.store.get("price-list");
  ok("save (before live, a pass from Claude is fine): version 1 to 2, the same change words", sv.status === 200 && sv.data.versionBefore === 1 && sv.data.version === 2
    && JSON.stringify(sv.data.changes) === JSON.stringify(conv("save").changes) && JSON.stringify(sv.data.newCodes) === "{}", JSON.stringify(sv.data));
  ok("... what was saved is exactly what was checked (its SHA-256)", sha256(JSON.stringify(pl.settings)) === chk.data.settingsSha256);
  ok("... saved by Barnwright (alan@...) with the pass's id; the status fields say so and that it can be undone",
    JSON.stringify(pl.savedBy) === JSON.stringify({ id: "barnwright", name: `Barnwright (${ACTOR})`, passId: passIdOf(sv.pass) })
    && sv.data.priceList.by === `Barnwright (${ACTOR})` && sv.data.lastBarnwrightSave?.passId === passIdOf(sv.pass) && sv.data.lastBarnwrightSave.version === 2 && sv.data.canUndo === true, JSON.stringify(sv.data));
  const hist = await F.store.get("price-list-history/000002");
  ok("... History has it, by Barnwright (alan@...)", hist?.savedBy?.name === `Barnwright (${ACTOR})` && hist.savedBy.passId === passIdOf(sv.pass) && (await F.door({ action: "read" })).data.history[0].by === `Barnwright (${ACTOR})`);
  ok("... and the owner's log: \"Barnwright (alan@...) changed your price list: ...\"", (await F.log()).some((e) => e.words === `Barnwright (${ACTOR}) changed your price list: Loft Barn 10×16: $5,690 → $5,700; 48″ Wooden Door: $160 → $175.`));
  r = await F.door({ action: "check", version: 1, edits });
  ok("a check on a version that moved: 409 version, with the status fields", r.status === 409 && r.data.code === "version" && r.data.error === DOOR_WORDS.version && r.data.priceList.version === 2, JSON.stringify(r.data));
  r = await F.door({ action: "save", version: 2, edits: [{ do: "set_item", item: "w48", price: 180 }], settingsSha256: "0".repeat(64) });
  ok("a save whose result isn't the one checked: 409 changed, nothing saved", r.status === 409 && r.data.code === "changed" && r.data.error === DOOR_WORDS.changed && (await F.store.get("price-list")).version === 2, JSON.stringify(r.data));
  ok("... and the owner's log says a change was refused", (await F.log())[0].words === `A Barnwright change was refused: ${DOOR_WORDS.changed}`, (await F.log())[0].words);
  /* D8: the copy of the price list in use is kept first */
  await F.store.remove("price-list-history/000002");
  const e2 = [{ do: "set_item", item: "w48", price: 180 }];
  const c2 = await F.door({ action: "check", version: 2, edits: e2 });
  r = await F.door({ action: "save", version: 2, edits: e2, settingsSha256: c2.data.settingsSha256 });
  const kept = await F.store.get("price-list-history/000002");
  ok("D8: a missing history entry for the price list in use is written before the save", r.status === 200 && r.data.version === 3 && kept?.settings?.items?.w48 === 175, JSON.stringify(kept)?.slice(0, 120));
  await F.store.remove("price-list-history/000003");
  const e3 = [{ do: "set_item", item: "w48", price: 185 }];
  const c3 = await F.door({ action: "check", version: 3, edits: e3 });
  const origSet = F.blobs.setJSON.bind(F.blobs);
  F.blobs.setJSON = async (key, data, o) => { if (key.startsWith("price-list-history/")) throw new Error("history store down"); return origSet(key, data, o); };
  r = await F.door({ action: "save", version: 3, edits: e3, settingsSha256: c3.data.settingsSha256 });
  F.blobs.setJSON = origSet;
  ok("D8: when that copy can't be kept, nothing is saved: 503 no-copy", r.status === 503 && r.data.code === "no-copy" && r.data.error === NO_COPY && (await F.store.get("price-list")).version === 3, JSON.stringify(r.data));
  const after = await snapshot(F.store, ["customers/", "people/", "lots/", "invites/", "barnwright-terms", "barnwright-help", "barnwright-setup", leaseKey(F.blobs)]);
  ok("A9: the door's reads, checks and saves left customers, people, lots, invites, the terms, Help, the switch and the lease exactly as they were",
    JSON.stringify(before) === JSON.stringify(after), Object.keys(after).filter((k) => before[k] !== after[k]).join(", "));
  ok("A9: ... and sent nothing", F.emails.length === 0);
}
{
  /* the limits: 120 Barnwright requests an hour, 60 saves a day (door and visit together) */
  const lim = await F.store.get("barnwright-setup-limits");
  await F.store.put("barnwright-setup-limits", { ...lim, requests: 120 });
  r = await F.door({ action: "status" });
  ok("the 121st Barnwright request this hour: 429 too-many, with the status fields", r.status === 429 && r.data.code === "too-many" && r.data.error === "Too many Barnwright requests for this Dealer Center this hour. Try again later." && r.data.v === 1, JSON.stringify(r.data));
  await F.store.put("barnwright-setup-limits", { ...lim, requests: 0, saves: 60 });
  const e4 = [{ do: "set_item", item: "w48", price: 190 }];
  const c4 = await F.door({ action: "check", version: 3, edits: e4 });
  r = await F.door({ action: "save", version: 3, edits: e4, settingsSha256: c4.data.settingsSha256 });
  ok("the 61st save today: 429, \"Barnwright has saved 60 changes here today.\"", r.status === 429 && r.data.error === "Barnwright has saved 60 changes here today. Try again tomorrow." && (await F.store.get("price-list")).version === 3, JSON.stringify(r.data));
  await F.fresh();
}
{
  /* A11: the lease off */
  F.room.business.status = "deactivated";
  await F.office.checkIn({ force: true });
  const e5 = [{ do: "set_item", item: "w48", price: 195 }];
  const c5 = await F.door({ action: "check", version: 3, edits: e5 });
  r = await F.door({ action: "save", version: 3, edits: e5, settingsSha256: c5.data.settingsSha256 });
  ok("A11: the account off: save answers 423 account-off; status, read and check still work",
    r.status === 423 && r.data.code === "account-off" && r.data.error === DOOR_WORDS.accountOff && c5.status === 200
    && (await F.door({ action: "status" })).status === 200 && (await F.door({ action: "read", part: "options" })).status === 200, JSON.stringify(r.data));
  F.room.business.status = "active";
  await F.office.checkIn({ force: true });
}
{
  /* F3: while the owner's switch is on, only Alan's own tap in the Control Room saves */
  const v = (await S.store.get("price-list")).version;
  const e6 = [{ do: "set_price", style: "G", size: "12x20", price: 8290 }];
  const c6 = await S.door({ action: "check", version: v, edits: e6 }, { via: "claude" });
  const viaClaude = await S.door({ action: "save", version: v, edits: e6, settingsSha256: c6.data.settingsSha256 }, { via: "claude" });
  ok("switch on: Claude may check (200), but a save from Claude is refused: 403 needs-alan", c6.status === 200 && viaClaude.status === 403 && viaClaude.data.code === "needs-alan"
    && viaClaude.data.error === DOOR_WORDS.needsAlan && viaClaude.data.access === "switch" && (await S.store.get("price-list")).version === v, JSON.stringify(viaClaude.data));
  const viaRoom = await S.door({ action: "save", version: v, edits: e6, settingsSha256: c6.data.settingsSha256 });
  ok("... the same save from the Control Room's Make the change page goes through", viaRoom.status === 200 && viaRoom.data.version === v + 1, JSON.stringify(viaRoom.data));
  await S.call("POST", "/api/office/barnwright-help", { on: false }, { as: "pat" });
  r = await S.door({ action: "read" });
  ok("the owner turns the switch off: the very next door request is refused (403 closed, live-off)", r.status === 403 && r.data.code === "closed" && r.data.why === "live-off" && r.data.error === WHY["live-off"], JSON.stringify(r.data));
  ok("... and status still answers, saying so", (await S.door({ action: "status" })).data.access === "closed");
}

section("A8. undo: the price list from before Barnwright's last change");
{
  const U = await fixtureBusiness();
  const conv = (n) => fxExample(n).answer.body;
  const edits = JSON.parse(fxExample("check").request.body).edits;
  r = await U.door({ action: "check", version: 1, undo: true });
  ok("nothing to undo yet: 409 cant-undo, in words", r.status === 409 && r.data.code === "cant-undo" && r.data.error === DOOR_WORDS.nothingToUndo, JSON.stringify(r.data));
  const chk = await U.door({ action: "check", version: 1, edits });
  await U.door({ action: "save", version: 1, edits, settingsSha256: chk.data.settingsSha256 });
  const cu = await U.door({ action: "check", version: 2, undo: true });
  ok("check an undo: the fixtures' words (\"Put back the price list from before Barnwright's last change\" first) and settingsSha256",
    cu.status === 200 && cu.data.changes[0] === UNDO_LINE && JSON.stringify(cu.data.changes) === JSON.stringify(conv("check an undo").changes)
    && cu.data.settingsSha256 === conv("check an undo").settingsSha256 && cu.data.counts.edits === 0, JSON.stringify(cu.data));
  ok("W6: the undo's first line isn't counted as a change (2 real changes: counts.changes 2)",
    cu.data.changes.length === 3 && cu.data.counts.changes === 2 && conv("check an undo").counts.changes === 2, JSON.stringify(cu.data.counts));
  r = await U.door({ action: "undo", version: 2, settingsSha256: cu.data.settingsSha256 });
  const pl = await U.store.get("price-list");
  ok("undo: version 3 is the price list of version 1 again, saved by Barnwright", r.status === 200 && r.data.versionBefore === 2 && r.data.version === 3
    && JSON.stringify(r.data.changes) === JSON.stringify(conv("undo").changes) && pl.settings.offer.LB.sizes["10x16"] === 5690 && pl.settings.items.w48 === 160 && pl.savedBy.id === "barnwright", JSON.stringify(r.data));
  ok("... and the owner's log: \"Barnwright (alan@...) put back the price list from before its last change.\"", (await U.log())[0].words === `Barnwright (${ACTOR}) put back the price list from before its last change.`);
  const again = await U.door({ action: "check", version: 3, undo: true });
  r = await U.door({ action: "undo", version: 3, settingsSha256: again.data.settingsSha256 });
  ok("an undo is a Barnwright save, so undo again puts the change back", r.status === 200 && (await U.store.get("price-list")).settings.offer.LB.sizes["10x16"] === 5700, JSON.stringify(r.data));
  r = await U.door({ action: "undo", version: 4, settingsSha256: "f".repeat(64) });
  ok("an undo whose result isn't the one checked: 409 changed", r.status === 409 && r.data.code === "changed");
  await U.ownerSave((s) => { s.items.w48 = 199; });
  r = await U.door({ action: "check", version: 5, undo: true });
  ok("once the owner saved after it: 409 cant-undo, \"The owner saved the price list after your change...\"", r.status === 409 && r.data.code === "cant-undo" && r.data.error === DOOR_WORDS.cantUndo && r.data.canUndo === false, JSON.stringify(r.data));
  r = await U.door({ action: "undo", version: 5, settingsSha256: "f".repeat(64) });
  ok("... and the undo itself too, with nothing saved", r.status === 409 && r.data.code === "cant-undo" && (await U.store.get("price-list")).version === 5);
}

/* ======================================================================================== */
/* THE REVIEW'S FIXES (each fails on the code before them)                                   */

section("A10 / DCSEC-3. Turning off, Stop and going live end every visit; a new grant needs a new visit");
{
  /* the owner's switch: on, a visit, off, on again (a new grant) */
  const V = business();
  await V.setUp(); await V.agree("2.2");
  await V.ownerSave((s) => { s.status = "active"; });
  await V.owner({ on: true, level: "change", reason: "first window", hours: 24 });
  let x = await V.start();
  const old = cookieFrom(x);
  ok("(a visit starts while the switch is on)", x.status === 200 && x.data.mode === "switch" && !!old);
  const kept = await V.store.get("barnwright-sessions");
  V.clock.t += 10 * MIN;
  await V.owner({ on: false });
  ok("Turn off: the visit is ended at once, with no visit request in between", Object.values((await V.store.get("barnwright-sessions")) || {}).every((s2) => s2.ended === true), JSON.stringify(await V.store.get("barnwright-sessions")));
  V.clock.t += HOUR;
  await V.owner({ on: true, level: "change", reason: "second window", hours: 1 });
  const logBefore = (await V.log()).length;
  x = await V.visit("GET", "me", undefined, old);
  ok("... a new switch an hour later doesn't bring the old visit back (401 visit-ended)", x.status === 401 && x.data.code === "visit-ended", JSON.stringify(x.data));
  /* the second guard: even if ending the visits had failed, a visit belongs to the switch it started under */
  await V.store.put("barnwright-sessions", kept);
  x = await V.visit("GET", "me", undefined, old);
  ok("... and even a visit record that wasn't ended can't ride a later switch (it started under another one)", x.status === 401 && x.data.code === "visit-ended", JSON.stringify(x.data));
  x = await V.start();
  ok("... a new visit starts, and the owner's log says so", x.status === 200 && (await V.log()).length === logBefore + 1 && (await V.log())[0].words === `Barnwright (${ACTOR}) opened your price list.`);
}
{
  /* before live: Stop, then allow again */
  const V = business();
  await V.setUp(); await V.agree("2.2");
  let x = await V.start();
  const old = cookieFrom(x);
  await V.owner({ prelive: "stopped" });
  await V.owner({ prelive: "on" });
  x = await V.visit("GET", "me", undefined, old);
  ok("Stop, then Let Barnwright set it up again: the visit from before Stop stays ended (401 visit-ended)", x.status === 401 && x.data.code === "visit-ended" && x.data.error === VISIT_WORDS.ended, JSON.stringify(x.data));
}
{
  /* a visit before live, the owner opens to customers, later the switch goes on */
  const V = business();
  await V.setUp(); await V.agree("2.2");
  let x = await V.start();
  const old = cookieFrom(x);
  await V.ownerSave((s) => { s.status = "active"; });
  ok("going live ends every visit at once", Object.values((await V.store.get("barnwright-sessions")) || {}).every((s2) => s2.ended === true));
  V.clock.t += 2 * HOUR;
  await V.owner({ on: true, level: "change", reason: "New prices", hours: 1 });
  x = await V.visit("GET", "me", undefined, old);
  ok("... the visit from before live is refused once the switch is on (401 visit-ended)", x.status === 401 && x.data.code === "visit-ended", JSON.stringify(x.data));
}
{
  /* W1: before live, turning off Run checks leaves setup access on, and says so */
  const V = business();
  await V.setUp(); await V.agree("2.2");
  let x = await V.start();
  const c = cookieFrom(x);
  await V.owner({ on: true, reason: "Check the quotes", hours: 4 });
  x = await V.owner({ on: false });
  ok("W1: before live, Turn off: \"<owner> turned off Barnwright's checks.\", and setup access is still on", x.status === 200 && x.data.help.on === false && x.data.setup.mode === "prelive"
    && (await V.log())[0].words === `${USERS.pat.email} turned off Barnwright's checks.`, JSON.stringify([x.data.setup, (await V.log())[0]]));
  x = await V.visit("GET", "me", undefined, c);
  ok("... and Alan's visit goes on (access never closed)", x.status === 200, JSON.stringify(x.data));
}

section("A10 / DCSEC-4. A visit is Alan by hand: never from a pass the Claude connector asked for");
{
  const V = business();
  await V.setUp(); await V.agree("2.2");
  await V.ownerSave((s) => { s.status = "active"; });
  await V.owner({ on: true, level: "change", reason: "New prices", hours: 4 });
  const p = V.pass({ via: "claude" });
  let x = await V.start(p);
  ok("a session pass with via claude: 401, \"This link ran out\", no cookie, no visit", x.status === 401 && x.data.code === "pass" && x.data.error === VISIT_WORDS.linkRanOut && !cookieFrom(x)
    && Object.keys((await V.store.get("barnwright-sessions")) || {}).length === 0, JSON.stringify(x.data));
  x = await V.start(p);
  ok("... and the pass is spent (410)", x.status === 410);
  ok("... while the Control Room's own pass still starts one", (await V.start(V.pass({ via: "control-room" }))).status === 200);
}

section("F8 / DCSEC-5. The business phone, email and website the owner typed never reach the door");
{
  const E = withDoor(business());
  await E.me("pat");
  await E.call("POST", "/api/office/setup", { businessName: "Testing Sheds", phone: "941-555-0100", email: "pat.owner@gmail.com", website: "https://testingsheds.example", start: "small", agreeTerms: true });
  await E.agree("2.2");
  const answers = [];
  let x = await E.door({ action: "check", version: 1, edits: [{ do: "set_business", phone: "", email: "" }] });
  answers.push(x.data);
  ok("check: \"Phone: taken off\", \"Email: taken off\" (never the old ones)", x.status === 200 && JSON.stringify(x.data.changes) === JSON.stringify(["Phone: taken off", "Email: taken off"]) && x.data.contactDetailsChange === true, JSON.stringify(x.data.changes));
  const edits = [{ do: "set_business", phone: "941-555-0123", website: "https://www.testingsheds.com" }];
  x = await E.door({ action: "check", version: 1, edits });
  answers.push(x.data);
  ok("check: a new number or address is said (an edit wrote it): \"Phone: changed to 941-555-0123\"",
    JSON.stringify(x.data.changes) === JSON.stringify(["Phone: changed to 941-555-0123", "Website: changed to https://www.testingsheds.com"]), JSON.stringify(x.data.changes));
  x = await E.door({ action: "save", version: 1, edits, settingsSha256: x.data.settingsSha256 });
  answers.push(x.data);
  ok("save: the same words", x.status === 200 && x.data.changes[0] === "Phone: changed to 941-555-0123", JSON.stringify(x.data.changes));
  x = await E.door({ action: "check", version: 2, undo: true });
  answers.push(x.data);
  ok("an undo puts back the owner's own: \"Phone: changed\", without the number", x.status === 200 && x.data.changes.includes("Phone: changed") && x.data.changes.includes("Website: changed"), JSON.stringify(x.data.changes));
  x = await E.door({ action: "undo", version: 2, settingsSha256: x.data.settingsSha256 });
  answers.push(x.data);
  answers.push((await E.door({ action: "read" })).data, (await E.door({ action: "status" })).data);
  const text = JSON.stringify(answers);
  ok("no door answer has the owner's business phone, email or website", !["941-555-0100", "pat.owner@gmail.com", "https://testingsheds.example"].some((t) => text.includes(t)), text.slice(0, 300));
  const hist = await E.store.get("price-list-history/000002");
  ok("... while the owner's own History still says it in full", hist.changes.includes("Phone: 941-555-0100 → 941-555-0123"), JSON.stringify(hist.changes));
}

section("A6 / DCSEC-1. The change words say what is written, so Alan reads the new words himself");
{
  const base = FX.edits.baseSettings;
  const linesFor = (edits) => {
    const res = applyEdits(base, edits, { manufacturer, standardRise: STD_RISE });
    return res.problems.length ? res.problems : describeChanges(base, res.settings, manufacturer, { contact: "new" });
  };
  const long = ("Prices plus tax. " + "Delivery and setup included within our area, on level ground with room for the truck. ".repeat(3) + "Deposits are paid only by gift card at the lot.").slice(0, 300).trim();
  const cases = [
    ["the line under the price", [{ do: "set_fine_print", text: "Deposits are paid only by gift card at the lot." }], ["The line under the price", "Deposits are paid only by gift card at the lot."]],
    ["a width note", [{ do: "set_size_note", width: 12, text: "12 ft wide buildings ship only after full payment." }], ["12 ft wide", "12 ft wide buildings ship only after full payment."]],
    ["a width note taken off", [{ do: "set_size_note", width: 14, text: null }], ["14 ft wide buildings: taken off"]],
    ["a rent-to-own factor", [{ do: "set_rent_to_own", terms: [{ months: 36, factor: 0.06 }, { months: 48, factor: 0.53 }, { months: 60, factor: 0.45 }] }], ["Rent to own 36 months: 0.6 → 0.06", "$231.48 → $2,314.81 a month"]],
    ["the words under the rent-to-own price", [{ do: "set_rent_to_own", terms: [{ months: 36, factor: 0.6 }, { months: 48, factor: 0.53 }, { months: 60, factor: 0.45 }], note: "No credit check." }], ["The words under the rent-to-own price", "No credit check."]],
    ["the texting permission words", [{ do: "set_quote_form", sms_consent: "By sending, you agree to marketing texts from us and our partners." }], ["Texting permission words", "marketing texts from us and our partners"]],
    ["a quote form box", [{ do: "set_quote_form", fields: { phone: "off" } }], ["Quote form phone box: required → off"]],
    ["an extra charged another way", [{ do: "set_extra", key: "ridge-vent", name: "Ridge vent", charged: "pct", price: 5 }], ["Ridge vent: $120 → 5% of the building price"]],
    ["the tagline", [{ do: "set_business", tagline: "Sheds that last" }], ["Tagline", "Sheds that last"]],
  ];
  const wrong = [];
  for (const [name, edits, want] of cases) {
    const lines = linesFor(edits).join(" | ");
    if (!want.every((w) => lines.includes(w))) wrong.push(`${name}: ${lines}`);
  }
  ok(`each of ${cases.length} edits customers read says the new words in its change line`, wrong.length === 0, wrong.join("\n       "));
  const longLines = linesFor([{ do: "set_fine_print", text: long }, { do: "set_quote_form", sms_consent: long }, { do: "set_size_note", width: 16, text: long }]);
  ok("a 300-letter text is said in full, and every line stays under 400 letters (the most the Control Room passes on)",
    longLines.length === 3 && longLines.every((l) => l.length < 400 && l.includes(long.trim())), longLines.map((l) => l.length).join(", "));
}

section("F1 / COR-5. A business live before this shipped is never told today that setup access ended");
{
  const O = await oldBusiness(async (O2) => { await O2.ownerSave((s) => { s.status = "active"; }); });
  await O.store.put("barnwright-help-log", { entries: [] });
  O.clock.t += 3 * 86400_000;
  const x = await O.ownerSave((s) => { s.offer.LB.sizes["10x16"] += 10; });
  const live = await O.store.get("barnwright-live");
  ok("the owner's first price save after the deploy: no \"setup access ended\" line in their log", x.status === 200 && (await O.log()).length === 0, JSON.stringify(await O.log()));
  ok("... the live record says it was found open, with no made-up date", live?.live === true && live.how === "found-open" && live.liveAt === null, JSON.stringify(live));
}
{
  const O = await oldBusiness();
  await O.store.put("barnwright-help-log", { entries: [] });
  await O.ownerSave((s) => { s.status = "active"; });
  ok("a business set up before this shipped and never open: opening it now says setup access ended", (await O.log()).some((e) => e.words === "Barnwright's setup access ended when you opened your 3D designer to customers.")
    && (await O.store.get("barnwright-live")).how === "opened", JSON.stringify(await O.log()));
}

section("A12 / F7 / DCSEC-6. The scheduled check-in renews the lease first, then looks back");
{
  const O = await oldBusiness();
  const setup = O.office.parts.setup;
  const real = setup.liveRecord;
  const lease0 = (await O.license.peekAccess()).expiresAt;
  O.clock.t += 2 * HOUR;
  let leaseWhenLooked = null;
  setup.liveRecord = async () => { leaseWhenLooked = (await O.license.peekAccess()).expiresAt; return real(); };
  await O.office.scheduledCheckIn();
  ok("the lease renews before the look back starts", leaseWhenLooked > lease0, `${lease0} -> ${leaseWhenLooked}`);
  ok("... and the look back still writes the live record", (await O.store.get("barnwright-live"))?.live === false);
  O.clock.t += 2 * HOUR;
  setup.liveRecord = async () => { throw new Error("history store down"); };
  let threw = false;
  try { await O.office.scheduledCheckIn(); } catch { threw = true; }
  ok("a look back that fails never stops the scheduled check-in", !threw && (await O.license.peekAccess()).expiresAt > leaseWhenLooked);
  setup.liveRecord = real;
}

section("A10 / E2E-1. A visit's save is told to the Control Room's service record, best effort");
{
  /* found end to end: the door's saves reach the Control Room's service
     record, but a change Alan saved by hand in a visit never did */
  const V = business();
  await V.setUp(); await V.agree("2.2");
  const c = cookieFrom(await V.start(V.pass()));
  let pl = (await V.visit("GET", "price-list", undefined, c)).data;
  let s = structuredClone(pl.settings);
  s.offer.UT.sizes["10x16"] = 5390;
  let x = await V.visit("PUT", "price-list", { settings: s, version: pl.version }, c);
  const told = V.room.setupService;
  ok("a visit's save tells the Control Room: setup-saved, the new version, the one before, the change words, who", x.status === 200 && told.length === 1
    && told[0].eventId === "setup:cust_testing:2" && told[0].action === "setup-saved" && told[0].version === 2 && told[0].versionBefore === 1
    && JSON.stringify(told[0].changes) === JSON.stringify(["Utility Shed 10×16: $5,190 → $5,390"]) && told[0].actor === ACTOR && told[0].undo === false
    && told[0].customerId === "cust_testing" && told[0].siteId === "site-testing-1", JSON.stringify(told));
  x = await V.visit("POST", "price-list/restore", { version: 1, current: 2 }, c);
  ok("... and a put back in the visit, as a put back (undo)", x.status === 200 && told.length === 2 && told[1].version === 3 && told[1].versionBefore === 2 && told[1].undo === true, JSON.stringify(told[1] || x.data).slice(0, 300));
  V.room.down = true;
  pl = (await V.visit("GET", "price-list", undefined, c)).data;
  s = structuredClone(pl.settings);
  s.offer.UT.sizes["10x16"] = 5490;
  x = await V.visit("PUT", "price-list", { settings: s, version: pl.version }, c);
  ok("a Control Room that can't be reached changes nothing: the save stands", x.status === 200 && x.data.version === 4 && (await V.priceList()).version === 4 && told.length === 2, JSON.stringify(x.data).slice(0, 200));
  V.room.down = false;
  const door = V.room.calls.filter((p) => p === "/api/setup-service").length;
  pl = (await V.visit("GET", "price-list", undefined, c)).data;
  x = await V.visit("PUT", "price-list", { settings: pl.settings, version: pl.version }, c);
  ok("a save that changes nothing tells nothing", x.status === 200 && V.room.calls.filter((p) => p === "/api/setup-service").length === door, JSON.stringify(x.data).slice(0, 200));
  ok("an unconnected copy's misconfigured license refuses to tell anything", await misconfiguredLicense().forwardSetupService({ version: 2, versionBefore: 1 }).then(() => false, () => true));
}

console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${passed + failed.length} setup access checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${passed} checks): Barnwright can change a price list only after terms 2.2, before live or while the owner's switch is on, and stop, switch off and going live end it on the very next request; live is the first opening or the first real quote or order, written before the change, and the look back for older businesses fails closed and never runs in the check-in or GET me; the visit is a __Host- cookie from a one-use pass, on its own routes, sliding up to 8 hours, and never reaches customers, the team, Help or the owner's card; the lock refuses status, embed, where quotes go, the license, the credit, construction and a web address logo, and putting back carries them forward; a copy is always kept first; who saved is said by role; no clock time is stored in words; only the owner flips the one Barnwright card; a check-in whose report fails or is slow still renews the lease; the preview shows a closed 3D designer to the team only; every edit gives the fixtures' change words, warnings and exact settings, and a gable pitch draws as set; the door takes only a one-use pass made for its exact body from the Control Room's server, reads in parts with no contact details, refuses what the owner's own save refuses, saves exactly what was checked with a copy kept first, saves for Claude only before live, and undoes only Barnwright's last change.`);
