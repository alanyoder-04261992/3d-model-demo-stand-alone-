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
     A4   the lock, and putting back carries the locked parts forward,
          that mix checked like a save (HB)
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
     F15  item 3: a refused change is said in the owner's log in the
          owner's own words, never the door's words for Alan; item 4: the
          lock refuses adding, changing or taking away an extra's
          construction effect or its own How it's built numbers (door,
          visit, undo and put back), so a building style's own numbers in
          How it's built (set_built at the door, and its short form
          set_roof_pitch) stay the only building-shape change
     HB   How it's built (model/build-settings.js): set_roof_pitch writes the
          style's own roof pitch there; the lock lets a building style's own
          numbers change (door in both modes, and the visit), checked like
          the owner's own and by the every-size check; never the
          construction settings or the numbers for the whole business; an
          older price list's roof pitch rule list reads as the pitch it
          draws
     SB   set_built: a building style's own numbers in How it's built, in a
          builder's words ("8 ft", "6/12"), only the ones that apply, with
          How it's built's own limits and words; stored as numbers, drawn as
          set, said in History (a new style's own number too); the every-
          size check's warnings and the sizes it had no time for in the
          check answer, what it finds that doesn't build refused in words;
          an extra of the owner's that a new pitch makes change nothing is
          a warning; the styles of their own a library style's number
          reaches are named; set_roof_pitch is its short form
     RL   read part library: every library style's How it's built numbers
          now and the standard's, by set_built's names, only those that
          apply, the same as the owner's own screen says
   (A13, nothing but netlify.js imports control-room.js, is in
   tools/check-imports.mjs; A14, the screens, in tools/check-setup-screens.mjs.) */

import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey } from "node:crypto";
import { createOffice } from "../server/office/index.js";
import { MemoryBlobs, wrapStore } from "../server/office/store.js";
import { TenantLicenseClient, createLeaseStore, SETUP_PASS_PREFIX, misconfiguredLicense } from "../server/office/control-room.js";
import { lockProblems, carryLocked, LOCK_WORDS } from "../server/office/setup-lock.js";
import { WHY, VISIT_WORDS, OWNER_WORDS, DOOR_WORDS, termsAtLeast, termsOut, whyWords, TERMS_NOT_OUT } from "../server/office/setup-access.js";
import * as setupAccessModule from "../server/office/setup-access.js";
import { TERMS } from "../server/office/terms.js";
import * as termsModule from "../server/office/terms.js";
import { BARNWRIGHT_SAVED_FIRST, NO_COPY, describeChanges, createPriceList, priceFingerprint } from "../server/office/price-list.js";
import { applyEdits, warnings, contactKinds, UNDO_LINE } from "../server/office/setup-edits.js";
import { readView } from "../server/office/setup-view.js";
import { checkChangedStyles } from "../server/office/built-check.js";
import { canonicalLease } from "../server/office/license-core.js";
import { validate, resolve as resolveCatalogue } from "../model/company.js";
import { effective, format as formatBuilt } from "../model/build-settings.js";
import { defaults as designDefaults, setType } from "../model/design.js";
import { frameOf } from "../model/frame.js";
import { fakeControlRoom } from "./lib/fake-control-room.mjs";
import { checkSetupPass } from "./lib/make-setup-fixtures.mjs";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const J = (p) => JSON.parse(readFileSync(resolvePath(ROOT, p), "utf8"));
const manufacturer = J("library/manufacturers/standard.json"), library = J("library/construction.json");
const templates = { full: J("companies/demo/company.json"), small: J("companies/starter/company.json") };
const FX = J("tools/lib/setup-fixtures.json");
/* the owner's log for a refused change: the contract's own words (setup-access.js REFUSED_LOG says the same, checked below) */
const REFUSED_LOG = FX.words.refusedLog;
const extraWords = (name) => FX.words.lock.extraConstruction.replace("<name>", name);

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
  /* the owner who signed up on the Control Room's sign-up page (the fixtures' beforeSignIn) */
  signup: { id: "u-signup", email: FX.beforeSignIn.ownerEmail, confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
  /* anyone can make a login (Identity registration is open): confirmed, on no team */
  stranger: { id: "u-stranger", email: "someone@elsewhere.example", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true },
  /* the owner's email, not yet checked by Identity: not the owner yet */
  unchecked: { id: "u-unchecked", email: FX.beforeSignIn.ownerEmail, confirmedAt: "2026-01-01T00:00:00Z", emailVerified: false },
};

/* One business: a store, a pretend control room, the Dealer Center server.
   keyPair: the room signs with it (the fixtures' TEST ONLY pair);
   termsVersion: the terms this copy pretends to ship; termsCopies: its
   pretend copies of terms texts ({"2.2": [sha256]}); siteUrl: what each
   check-in reports. */
function business({ connected = true, start = Date.UTC(2026, 9, 11, 15, 0, 0), blobs = new MemoryBlobs(), keyPair = null, ownerEmail = USERS.pat.email,
  termsVersion = undefined, termsCopies = undefined, appVersion = "dealer-center check", siteUrl = undefined, sizeCheckMs = undefined } = {}) {
  const clock = { t: start };
  const room = fakeControlRoom({ clock, customerId: "cust_testing", siteId: "site-testing-1", keyPair });
  const b = { clock, room, blobs, who: "pat", emails: [], sentLicense: [] };
  const spyFetch = async (url, init = {}) => {
    if (new URL(url).pathname === "/api/license") b.sentLicense.push(init.body);
    return room.fetch(url, init);
  };
  b.license = connected ? new TenantLicenseClient({
    controlRoomUrl: room.origin, customerId: room.business.id, siteId: room.business.siteId,
    activationKey: room.business.key, publicKeyPem: room.publicKeyPem,
    store: createLeaseStore(room.business.id, room.business.siteId, blobs), fetch: spyFetch, now: () => clock.t, siteUrl,
  }) : undefined;
  b.make = () => createOffice({
    blobs, identityUser: async () => (b.who ? USERS[b.who] : null), ownerEmail,
    manufacturer, library, templates, now: () => new Date(clock.t), log: () => {},
    license: b.license, appVersion, sendEmail: async (m) => { b.emails.push(m); return true; },
    ...(termsVersion ? { termsVersion } : {}),
    ...(termsCopies ? { termsCopies } : {}),
    ...(sizeCheckMs !== undefined ? { sizeCheckMs } : {}),
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
  ok("before the business is made: closed, no price list", none.mode === null && none.why === "no-price-list", JSON.stringify(none));
  const r = await A.start();
  ok("... a visit can't start (403, the words for no-price-list)", r.status === 403 && r.data.code === "closed" && r.data.why === "no-price-list" && r.data.error === WHY["no-price-list"] && !cookieFrom(r), JSON.stringify(r.data));
}
await A.setUp();
/* POST setup agrees to this copy's own terms (2.1 today, 2.2 once they are
   out): the cases below need an owner who agreed to 2.1 only, whatever
   TERMS.version is */
await A.agree("2.1");
ok("a business made writes the live record at once: not live, checked through version 1",
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
  ok("the owner's log, in the owner's own words: \"Barnwright tried to change something only you can change. Nothing was changed.\", once a minute at most",
    log.filter((e) => Object.values(REFUSED_LOG).includes(e.words)).length === 1 && log[0].words === REFUSED_LOG.locked, log[0]?.words);
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
  /* HB: How it's built (old code: a raw roof pitch rule could change; the
     numbers for the whole business and an extra's own numbers were not
     looked at) */
  const rise = library.roof.shapes.gable.rise.w;
  const rule = (code, twelfths) => ({ roof: { shapes: { gable: { rise: [{ when: { styles: [code] }, value: { w: twelfths / 24 } }, { value: { w: rise } }] } } } });
  const own = structuredClone(s);
  own.offer.UT.built = { roofPitch: 6 };
  own.offer.LB.built = { wallHeight: 84 };
  const allModes = [[true, "prelive"], [true, "switch"], [false, "prelive"], [false, "switch"]];
  ok("HB: a building style's own How it's built numbers may change: at the door before live and while the switch is on, and in the visit",
    allModes.every(([door, mode]) => lockProblems(s, own, { door, mode, manufacturer }).length === 0 && lockProblems(own, s, { door, mode, manufacturer }).length === 0));
  const biz = structuredClone(s);
  biz.built = { roofPitch: { gable: 6 } };
  ok("HB: How it's built for the whole business may not, at the door or in the visit",
    allModes.every(([door, mode]) => JSON.stringify(lockProblems(s, biz, { door, mode, manufacturer })) === JSON.stringify([LOCK_WORDS.built])), JSON.stringify(lockProblems(s, biz, { manufacturer })));
  const raw = structuredClone(s);
  raw.construction = rule("UT", 7);
  const rawLB = structuredClone(s);
  rawLB.construction = rule("LB", 7);
  const rawWall = structuredClone(s);
  rawWall.construction = { walls: { heightIn: 96 } };
  ok("HB: the construction settings may not change, a roof pitch rule list included (except as the same pitch, below)",
    [rawLB, rawWall].every((n) => JSON.stringify(lockProblems(s, n, { door: true, manufacturer })) === JSON.stringify([LOCK_WORDS.construction]))
    && JSON.stringify(lockProblems(s, raw, { door: true })) === JSON.stringify([LOCK_WORDS.construction]), JSON.stringify(lockProblems(s, rawLB, { door: true, manufacturer })));
  const lifted = structuredClone(s);
  lifted.offer.UT.built = { roofPitch: 7 };
  const steeper = structuredClone(s);
  steeper.offer.UT.built = { roofPitch: 8 };
  ok("HB: a price list from before, holding set_roof_pitch's old rule list, reads as the Utility Shed's own pitch: moved into How it's built, or changed there, it passes",
    lockProblems(raw, lifted, { door: true, manufacturer }).length === 0 && lockProblems(raw, steeper, { door: true, mode: "switch", manufacturer }).length === 0
    && lockProblems(raw, raw, { door: true, manufacturer }).length === 0, JSON.stringify(lockProblems(raw, lifted, { door: true, manufacturer })));
  ok("HB: History never says a roof pitch changed when an older rule list only moves into How it's built (the rule list's own words are gone)",
    JSON.stringify(describeChanges(raw, lifted, manufacturer, { library })) === "[]" && JSON.stringify(describeChanges(raw, steeper, manufacturer, { library })) === JSON.stringify(["Utility Shed roof pitch: 7/12 → 8/12"]),
    JSON.stringify([describeChanges(raw, lifted, manufacturer, { library }), describeChanges(raw, steeper, manufacturer, { library })]));
  const shuffled = structuredClone(s);
  shuffled.embed = Object.fromEntries(Object.entries(s.embed || { origins: [] }).reverse());
  shuffled.brand = Object.fromEntries(Object.entries(s.brand).reverse());
  ok("the same values written in another order are not a change", lockProblems(s, shuffled).length === 0, JSON.stringify(lockProblems(s, shuffled)));
  const now = structuredClone(s);
  now.status = "active"; now.embed = { origins: ["https://mine.example"] }; now.leads = { ...now.leads, mode: "form", url: "https://mine.example/q" };
  now.brand.credit = { text: "x", url: "", show: false };
  now.built = { eaveOverhang: { gable: 6 } };
  now.construction = { walls: { heightIn: 96 } };
  const old = structuredClone(s);
  old.offer.UT.sizes["10x16"] = 1234;
  old.construction = rule("UT", 5);
  const back = carryLocked(now, old, { manufacturer });
  ok("carryLocked: going back keeps status, embed, where quotes go, the credit, the construction settings and How it's built for the whole business as they are now, and the prices and each style's own pitch as they were (an old rule list as the pitch it drew)",
    back.status === "active" && JSON.stringify(back.embed) === JSON.stringify(now.embed) && back.leads.mode === "form" && back.leads.url === "https://mine.example/q"
    && JSON.stringify(back.brand.credit) === JSON.stringify(now.brand.credit) && back.offer.UT.sizes["10x16"] === 1234
    && back.offer.UT.built?.roofPitch === 5 && JSON.stringify(back.construction) === JSON.stringify(now.construction) && JSON.stringify(back.built) === JSON.stringify(now.built)
    && lockProblems(now, back, { manufacturer }).length === 0, JSON.stringify(back).slice(0, 400));
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
    st.priceList.by === `Barnwright (${ACTOR})` && st.lastBarnwrightSave?.version === st.priceList.version && st.canUndo === true && st.access === "prelive" && st.v === 2 && st.agreement === "owner", JSON.stringify(st));
  await A.ownerSave((s) => { s.items.w48 = 190; });
  const st2 = await A.office.parts.setup.status();
  ok("the owner (who has no name, so their save is under their email) is \"the owner\", and their email is nowhere in the answer",
    st2.priceList.by === "the owner" && !JSON.stringify(st2).includes(USERS.pat.email) && st2.canUndo === false && st2.lastBarnwrightSave?.passId, JSON.stringify(st2));
  ok("the fields are the contract's, in its order", JSON.stringify(Object.keys(st2)) === JSON.stringify(FX.status.order) && JSON.stringify(FX.status.order) === JSON.stringify(["v", "live", "liveAt", "access", "why", "until", "prelive", "termsOk", "termsOut", "agreement", "priceList", "lastBarnwrightSave", "canUndo", "appVersion"]), Object.keys(st2).join(","));
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
  ok("me(): the owner gets setup {mode, until, live, barnwright} for the banner; a manager gets null", JSON.stringify((await A.me("pat")).setup) === JSON.stringify({ mode: "prelive", until: null, live: false, barnwright: false }) && (await A.me("sam")).setup === null, JSON.stringify((await A.me("pat")).setup));
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
    && JSON.stringify(body.setup) === JSON.stringify({ v: 2, live: false, liveAt: null, access: "prelive", why: null, until: null, prelive: "on", termsOk: true, termsOut: termsOut(), agreement: "owner" }), JSON.stringify(body));
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
  ok("me(): the owner's banner gets {mode: switch, until}", JSON.stringify((await L.me("pat")).setup) === JSON.stringify({ mode: "switch", until, live: true, barnwright: false }), JSON.stringify((await L.me("pat")).setup));
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


section("A6 / F5 / F13. The edits, the warnings and the read parts, on their own");
{
  /* every sample in the fixtures: the edits, the lock, the owner's own check (the door's steps, without the door) */
  const pl = createPriceList({ store: wrapStore(new MemoryBlobs()), manufacturer, library, templates, now: () => new Date(), log: () => {} });
  const base = FX.edits.baseSettings;
  const wrong = [];
  for (const sm of FX.edits.samples) {
    const edits = sm.name === "too many edits" ? Array.from({ length: 301 }, () => sm.edits[0]) : sm.edits;
    const res = applyEdits(base, edits, { manufacturer, mode: sm.mode });
    let got;
    if (res.problems.length) got = { ok: false, problems: res.problems };
    else {
      const next = structuredClone(res.settings);
      next.cfg = priceFingerprint(next) === priceFingerprint(base) ? base.cfg : (base.cfg || 1) + 1;
      const locked = lockProblems(base, next, { door: true, mode: sm.mode, manufacturer });
      if (locked.length) got = { ok: false, problems: locked };
      else {
        try {
          /* the owner's own check (its stricter rules against the price list before), then the every-size check, as the door runs them */
          pl.check(next, base);
          const sc = checkChangedStyles(base, next, manufacturer, library, { budgetMs: Infinity });
          if (sc.problems.length) got = { ok: false, problems: sc.problems };
          else got = { ok: true, changes: describeChanges(base, next, manufacturer, { contact: "new", library }), warnings: [...warnings(base, next, manufacturer), ...sc.warnings], sha: sha256(JSON.stringify(next)), newCodes: res.newCodes };
        } catch (e) { got = { ok: false, problems: e.problems || [e.message] }; }
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
    const res = applyEdits(FX.edits.baseSettings, sm.edits, { manufacturer, mode: sm.mode });
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
  const viewsWrong = FX.door.parts.filter((part) => JSON.stringify(readView(base, part, manufacturer, library)) !== JSON.stringify(fxExample(`read ${part}`).answer.body.view));
  ok(`read: each of the ${FX.door.parts.length} parts is the contract's (the fixtures' view, word for word)`, viewsWrong.length === 0, viewsWrong.join(", "));
  const all = JSON.stringify(FX.door.parts.map((part) => readView(base, part, manufacturer, library)));
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
  /* F13 / HB: the roof pitch, a style's own number in How it's built, drawn
     the way dealersetup/library/pitch-override.mjs checks it */
  const opts = { manufacturer };
  const base = FX.edits.baseSettings;
  const own = applyEdits(base, [{ do: "add_own_style", built_like: "UT", name: "Premium Utility", sizes: { "10x16": 6290 } }, { do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts);
  const pitched = (settings, st) => {
    const cat = resolveCatalogue(settings, manufacturer, library);
    const s = designDefaults(cat); setType(s, st, cat); s.size = st === "G" ? "12x20" : "10x16";
    const f = frameOf(s, cat);
    return (Math.max(...f.prof.map((p) => p[1])) - f.topY) / (f.W / 2) * 12;
  };
  const shopUT = manufacturer.styles.UT.built.roofPitch, shopG = manufacturer.styles.G.built.roofPitch;
  ok("F13: set_roof_pitch UT 6/12 writes the Utility Shed's own roof pitch in How it's built (old code: a construction rule), and nothing in the construction settings",
    own.problems.length === 0 && own.settings.offer.UT.built?.roofPitch === 6 && JSON.stringify(own.settings.construction) === JSON.stringify(base.construction) && !("built" in own.settings.offer.UT1),
    JSON.stringify([own.problems, own.settings?.offer?.UT, own.settings?.construction]));
  ok("F13: it draws the Utility Shed at 6/12, and the style of their own built like it too; the Garage keeps its standard (the shop's 5/12)",
    validate(own.settings, manufacturer).length === 0 && Math.abs(pitched(own.settings, "UT") - 6) < 0.01
    && Math.abs(pitched(own.settings, "UT1") - 6) < 0.01 && Math.abs(pitched(own.settings, "G") - shopG) < 0.01 && Math.abs(pitched(base, "UT") - shopUT) < 0.01,
    `${pitched(own.settings, "UT").toFixed(2)} ${pitched(own.settings, "UT1").toFixed(2)} ${pitched(own.settings, "G").toFixed(2)} ${pitched(base, "UT").toFixed(2)}`);
  const two = applyEdits(base, [{ do: "set_roof_pitch", style: "UT", pitch: "5/12" }, { do: "set_roof_pitch", style: "G", pitch: "8/12" }, { do: "set_roof_pitch", style: "UT", pitch: "7/12" }], opts);
  ok("F13: each style keeps its own number; the last one set wins",
    two.settings.offer.UT.built?.roofPitch === 7 && two.settings.offer.G.built?.roofPitch === 8 && JSON.stringify(two.settings.construction) === JSON.stringify(base.construction)
    && lockProblems(base, two.settings, { door: true, manufacturer }).length === 0 && lockProblems(base, two.settings, { door: true, mode: "switch", manufacturer }).length === 0, JSON.stringify(two.settings?.offer));
  const back = applyEdits(two.settings, [{ do: "set_roof_pitch", style: "G", pitch: "standard" }, { do: "set_roof_pitch", style: "UT", pitch: "standard" }], opts);
  ok("F13: standard takes the style's own number out, and the price list is as it was",
    JSON.stringify(back.settings) === JSON.stringify(base), JSON.stringify([back.settings.offer.UT, back.settings.offer.G]));
  const std = (n) => manufacturer.styles.UT.built ? `${n}/12` : "";
  ok("F13: the change words are the owner's own History words for How it's built, the standard said as its number (the shop's 5/12)",
    JSON.stringify(describeChanges(base, two.settings, manufacturer, { library })) === JSON.stringify([`Utility Shed roof pitch: ${std(shopUT)} → 7/12`, `Garage roof pitch: ${std(shopG)} → 8/12`])
    && JSON.stringify(describeChanges(two.settings, back.settings, manufacturer, { library })) === JSON.stringify([`Utility Shed roof pitch: 7/12 → ${std(shopUT)}`, `Garage roof pitch: 8/12 → ${std(shopG)}`]),
    JSON.stringify([describeChanges(base, two.settings, manufacturer, { library }), describeChanges(two.settings, back.settings, manufacturer, { library })]));
  /* the Premium Utility (a style of their own built like the Utility Shed) is
     drawn at the Utility Shed's new pitch: the words Alan says yes to name it
     (review M2; lane/dc-setup said "Utility Shed and every building built
     like it") */
  const pu = applyEdits(base, [{ do: "add_own_style", built_like: "UT", name: "Premium Utility", sizes: { "10x16": 6290 } }], opts).settings;
  const puPitch = applyEdits(pu, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts).settings;
  const puOwn = applyEdits(pu, [{ do: "set_built", style: "UT1", roofPitch: "7/12" }], opts).settings;
  const puOwnPitch = applyEdits(puOwn, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts).settings;
  ok("F13: the change words name each style of their own built like it that the new pitch reaches (old code: only the Utility Shed); one with its own pitch isn't named",
    JSON.stringify(describeChanges(pu, puPitch, manufacturer, { library })) === JSON.stringify([`Utility Shed roof pitch: ${std(shopUT)} → 6/12 (and Premium Utility, built like it)`])
    && JSON.stringify(describeChanges(puOwn, puOwnPitch, manufacturer, { library })) === JSON.stringify([`Utility Shed roof pitch: ${std(shopUT)} → 6/12`])
    && Math.abs(pitched(puPitch, "UT1") - 6) < 0.01 && Math.abs(pitched(puOwnPitch, "UT1") - 7) < 0.01,
    JSON.stringify([describeChanges(pu, puPitch, manufacturer, { library }), describeChanges(puOwn, puOwnPitch, manufacturer, { library })]));
  const views = (st) => JSON.stringify(readView(st, "buildings", manufacturer).styles.map((x) => [x.code, x.pitch]));
  ok("F13: read says each style's own pitch (old code: standard), its own style built like it the same, and standard again after",
    views(two.settings) === JSON.stringify([["UT", "7/12"], ["LB", null], ["G", "8/12"]]) && views(back.settings) === JSON.stringify([["UT", "standard"], ["LB", null], ["G", "standard"]])
    && JSON.stringify(readView(own.settings, "buildings", manufacturer).styles.find((x) => x.code === "UT1")?.pitch) === JSON.stringify("6/12"), views(two.settings));
  const pitches = ["3/12", "12/12"].map((p) => applyEdits(base, [{ do: "set_roof_pitch", style: "UT", pitch: p }], opts).problems.length);
  const refusedPitch = ["2/12", "13/12", "5.5/12", "steep", 5].map((p) => applyEdits(base, [{ do: "set_roof_pitch", style: "UT", pitch: p }], opts).problems[0]);
  ok("F13: 3/12 to 12/12 in whole twelfths, or standard; anything else in plain words",
    pitches.every((n) => n === 0) && refusedPitch.every((w) => w === "Edit 1: Pick a pitch from 3/12 to 12/12, in whole twelfths, or standard."), JSON.stringify(refusedPitch));
  const metal = applyEdits(base, [{ do: "sell_style", style: "MU", sizes: { "10x12": 4990 } }, { do: "set_roof_pitch", style: "MU", pitch: "3/12" }], opts);
  const unsold = applyEdits(base, [{ do: "set_roof_pitch", style: "GU", pitch: "6/12" }], opts);
  ok("F13: How it's built's own limits hold (a metal roof never flatter than 4/12), and a style they don't sell is said in words",
    JSON.stringify(metal.problems) === JSON.stringify(["Edit 2: Roof pitch 3/12 is flatter than 4/12, the flattest the 3D designer can frame a metal roof."])
    && JSON.stringify(unsold.problems) === JSON.stringify(["Edit 1: They don't sell the Garden Utility. Sell it first (sell_style), then set its roof pitch."]), JSON.stringify([metal.problems, unsold.problems]));
  /* a business that sells only its own Premium Utility (built like the
     Utility Shed), not the Utility Shed itself: set_roof_pitch takes the
     style of their own, and the library style's refusal names it (review
     M3; old code: each refusal sent Claude to the other) */
  const onlyOwn = applyEdits(base, [{ do: "add_own_style", built_like: "UT", name: "Premium Utility", sizes: { "10x16": 6290 } }, { do: "stop_selling_style", style: "UT" }], opts).settings;
  const ownPitch = applyEdits(onlyOwn, [{ do: "set_roof_pitch", style: "UT1", pitch: "6/12" }], opts);
  const ownBuilt = applyEdits(onlyOwn, [{ do: "set_built", style: "UT1", roofPitch: "6/12" }], opts);
  const libPitch = applyEdits(onlyOwn, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts);
  ok("F13: set_roof_pitch on a style of their own built like a gable style writes its own pitch, the same as set_built (old code: refused), and draws it",
    ownPitch.problems.length === 0 && ownPitch.settings.offer.UT1.built?.roofPitch === 6 && JSON.stringify(ownPitch.settings) === JSON.stringify(ownBuilt.settings) && Math.abs(pitched(ownPitch.settings, "UT1") - 6) < 0.01
    && JSON.stringify(describeChanges(onlyOwn, ownPitch.settings, manufacturer, { library })) === JSON.stringify([`Premium Utility roof pitch: ${std(shopUT)} → 6/12`])
    && JSON.stringify(applyEdits(ownPitch.settings, [{ do: "set_roof_pitch", style: "UT1", pitch: "standard" }], opts).settings) === JSON.stringify(onlyOwn),
    JSON.stringify([ownPitch.problems, ownPitch.settings?.offer?.UT1]));
  ok("F13: ... and the library style they don't sell says to sell it first or to set the pitch of their own style built like it",
    JSON.stringify(libPitch.problems) === JSON.stringify(["Edit 1: They don't sell the Utility Shed. Sell it first (sell_style), then set its roof pitch, or set the roof pitch of their own Premium Utility (UT1), built like it."]), JSON.stringify(libPitch.problems));
  const barnOwn = applyEdits(base, [{ do: "add_own_style", built_like: "LB", name: "Premium Loft Barn", sizes: { "10x16": 6290 } }, { do: "set_roof_pitch", style: "LB1", pitch: "6/12" }], opts);
  const unknownOwn = applyEdits(base, [{ do: "set_roof_pitch", style: "UT1", pitch: "6/12" }], opts);
  ok("F13: ... a style of their own built like a barn is refused in words that name both, and a code they don't sell is said as such",
    JSON.stringify(barnOwn.problems) === JSON.stringify(["Edit 2: Only a gable roof's pitch can be changed here. The Premium Loft Barn is built like the Loft Barn, which has a gambrel roof, so a different pitch needs a new library style."])
    && JSON.stringify(unknownOwn.problems) === JSON.stringify(["Edit 1: there is no building style UT1 in their price list."]), JSON.stringify([barnOwn.problems, unknownOwn.problems]));
  const roofs = ["CS", "SS", "BU", "SB"].map((st) => applyEdits(base, [{ do: "set_roof_pitch", style: st, pitch: "6/12" }], opts).problems[0]);
  ok("F13: saltbox, single slope, lean-to and gambrel roofs are refused, each in words",
    JSON.stringify(roofs) === JSON.stringify(["saltbox", "single slope", "lean-to", "gambrel"].map((w, i) => `Edit 1: Only a gable roof's pitch can be changed here. The ${manufacturer.styles[["CS", "SS", "BU", "SB"][i]].name} has a ${w} roof, so a different pitch needs a new library style.`)), JSON.stringify(roofs));
  const hand = structuredClone(base);
  hand.construction = { roof: { shapes: { gable: { rise: { w: 0.3 } } } } };
  ok("F13: gable roofs set up some other way (by hand in the repository) are left alone, in words",
    applyEdits(hand, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], opts).problems[0] === "Edit 1: Their gable roofs were set up another way, so the pitch can't be changed here.");
  const older = structuredClone(base);
  older.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 7 / 24 } }, { value: { w: library.roof.shapes.gable.rise.w } }] } } } };
  const moved = applyEdits(older, [{ do: "set_roof_pitch", style: "G", pitch: "8/12" }], opts);
  ok("HB: on a price list from before, holding set_roof_pitch's old rule list, the next pitch moves that rule into How it's built first: the Utility Shed keeps 7/12 and draws it",
    moved.problems.length === 0 && moved.settings.offer.UT.built?.roofPitch === 7 && moved.settings.offer.G.built?.roofPitch === 8 && JSON.stringify(moved.settings.construction ?? {}) === "{}"
    && Math.abs(pitched(moved.settings, "UT") - 7) < 0.01 && Math.abs(pitched(older, "UT") - 7) < 0.01 && lockProblems(older, moved.settings, { door: true, manufacturer }).length === 0,
    JSON.stringify([moved.problems, moved.settings?.offer?.UT, moved.settings?.construction]));
}

/* ======================================================================================== */
/* THE DOOR: A1, A5, A6, A7, A8, A9 and A11 for the door, F3, F5, F13                       */

const DOOR_URL = SITE + "/.netlify/functions/barnwright-setup";
const STATUS_KEYS = FX.status.order;
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
   setup with the small starting price list), owner agreed to terms 2.2.
   base: another price list to start from (edits.effects.effectBase). */
async function fixtureBusiness(base = FX.edits.baseSettings, opts = {}) {
  const F = withDoor(business(opts));
  await F.setUp(); await F.agree("2.2");
  const pl = await F.store.get("price-list");
  const settings = structuredClone(base);
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
  const chk = await D.door({ action: "check", version: 1, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }] });
  const sv = await D.door({ action: "save", version: 1, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], settingsSha256: chk.data.settingsSha256 });
  const bld = await D.door({ action: "read", part: "buildings" });
  const saved = (await D.store.get("price-list")).settings;
  ok("F13: through the door it passes the lock and saves the Utility Shed's own roof pitch in How it's built, and read says UT 6/12, the Garage standard, the Loft Barn none",
    sv.status === 200 && sv.data.version === 2 && sv.data.changes[0] === `Utility Shed roof pitch: ${manufacturer.styles.UT.built.roofPitch}/12 → 6/12`
    && saved.offer.UT.built?.roofPitch === 6 && JSON.stringify(saved.construction) === "{}"
    && JSON.stringify(bld.data.view.styles.map((x) => [x.code, x.pitch])) === JSON.stringify([["UT", "6/12"], ["LB", null], ["G", "standard"]]), JSON.stringify([sv.data, bld.data.view?.styles?.map((x) => x.pitch)]));
  const hist = await D.store.get("price-list-history/000002");
  ok("... and the owner's History says the same words", JSON.stringify(hist?.changes) === JSON.stringify(sv.data.changes), JSON.stringify(hist?.changes));
  const und = await D.door({ action: "check", version: 2, undo: true });
  r = await D.door({ action: "undo", version: 2, settingsSha256: und.data.settingsSha256 });
  const undone = (await D.store.get("price-list")).settings;
  ok("(and undone again)", r.status === 200 && r.data.version === 3 && JSON.stringify(undone.construction) === "{}" && !("built" in undone.offer.UT), JSON.stringify(r.data));
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
    const res = applyEdits((await D.store.get("price-list")).settings, edits, { manufacturer });
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
  ok("... and the owner's log says a change was refused, in the owner's own words (never the door's words for Alan)",
    (await F.log())[0].words === REFUSED_LOG.other && !(await F.log()).some((e) => e.words.includes(DOOR_WORDS.changed)), (await F.log())[0].words);
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
  ok("the 121st Barnwright request this hour: 429 too-many, with the status fields", r.status === 429 && r.data.code === "too-many" && r.data.error === "Too many Barnwright requests for this Dealer Center this hour. Try again later." && r.data.v === 2, JSON.stringify(r.data));
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
  /* HB: while the owner's switch is on, the door may set a style's own roof pitch too */
  const v = (await S.store.get("price-list")).version;
  const ep = [{ do: "set_roof_pitch", style: "G", pitch: "7/12" }];
  const cp = await S.door({ action: "check", version: v, edits: ep });
  const sp = await S.door({ action: "save", version: v, edits: ep, settingsSha256: cp.data.settingsSha256 });
  ok("HB: switch on: set_roof_pitch passes the lock and saves the Garage's own roof pitch (Alan's tap in the Control Room)",
    cp.status === 200 && cp.data.access === "switch" && sp.status === 200 && (await S.store.get("price-list")).settings.offer.G.built?.roofPitch === 7, JSON.stringify([cp.data, sp.data]).slice(0, 400));
}
{
  /* F3: while the owner's switch is on, only Alan's own tap in the Control Room saves */
  const v = (await S.store.get("price-list")).version;
  const e6 = [{ do: "set_price", style: "G", size: "12x20", price: 8290 }];
  const c6 = await S.door({ action: "check", version: v, edits: e6 }, { via: "claude" });
  const viaClaude = await S.door({ action: "save", version: v, edits: e6, settingsSha256: c6.data.settingsSha256 }, { via: "claude" });
  ok("switch on: Claude may check (200), but a save from Claude is refused: 403 needs-alan", c6.status === 200 && viaClaude.status === 403 && viaClaude.data.code === "needs-alan"
    && viaClaude.data.error === DOOR_WORDS.needsAlan && viaClaude.data.access === "switch" && (await S.store.get("price-list")).version === v, JSON.stringify(viaClaude.data));
  {
    /* item 3: the owner reads their own words, never the words the door gives Alan */
    const log = await S.log();
    ok("... and the owner's log says so in the owner's words: \"Barnwright tried a change that needs Alan's OK in his Control Room first. Nothing was changed.\"",
      log[0]?.words === REFUSED_LOG["needs-alan"], log[0]?.words);
    ok("... never the words for Alan (\"your Control Room's Make the change page\")",
      !log.some((e) => Object.values(DOOR_WORDS).includes(e.words) || /your Control Room|Make the change page|A Barnwright change was refused/.test(e.words)), JSON.stringify(log.map((e) => e.words)));
  }
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
    const res = applyEdits(base, edits, { manufacturer });
    return res.problems.length ? res.problems : describeChanges(base, res.settings, manufacturer, { contact: "new", library });
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

/* ======================================================================================== */
/* F15: BEFORE THE OWNER FIRST SIGNS IN (docs/OFFICE.md), against the fixtures' beforeSignIn */

const BS = FX.beforeSignIn;
const FX_KEYS = { privateKey: createPrivateKey({ key: FX.testKey.privateKeyJwk, format: "jwk" }), publicKey: createPublicKey(FX.testKey.publicKeyPem) };
const asJson = (x) => JSON.stringify(x);
const fxBody = (e) => e.answer.body;

/* A Dealer Center just made by Make their Dealer Center, as the fixtures'
   business (cust_testing, its TEST ONLY key, its clock): no owner has
   signed in and there is no price list. ships: the terms it ships. */
/* copies: this copy's own terms texts; by default the fixtures' sign-up's
   (the terms text the owner read on the sign-up page is one it has) */
async function signupBusiness({ ships = "2.2", at = FX.now, checkIn = true, copies = { [BS.signup.termsVersion]: [BS.signup.termsSha256] } } = {}) {
  const b = withDoor(business({ start: at, keyPair: FX_KEYS, ownerEmail: BS.ownerEmail, termsVersion: ships, termsCopies: copies, appVersion: FX.dealer.appVersion, siteUrl: FX.dealer.siteUrl }));
  b.who = null;
  b.replay = async (req) => {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]));
    const res = await b.office.setupDoor(new Request(req.url, { method: req.method, headers, body: req.body }));
    const t = await res.text();
    let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: res.status, data };
  };
  b.visitReplay = async (req) => {
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]));
    const res = await b.office.handle(new Request(req.url, { method: req.method, headers, body: req.body }), { clientIp: "203.0.113.9" });
    const t = await res.text();
    let data; try { data = JSON.parse(t); } catch { data = t; }
    return { status: res.status, data, cookies: res.headers.getSetCookie() };
  };
  b.checkInBody = async () => { b.sentLicense.length = 0; await b.office.checkIn({ force: true }); return b.sentLicense.at(-1); };
  if (checkIn) await b.checkInBody();
  return b;
}
const doorEx = (name) => BS.door.examples.find((e) => e.name === name);
const sameAnswer = (got, ex) => got.status === ex.answer.status && asJson(got.data) === asJson(fxBody(ex));

section("F15. The sign-up agreement on the pass, and when it counts");
{
  const client = new TenantLicenseClient({
    controlRoomUrl: "https://control-room.test", customerId: FX.dealer.customerId, siteId: FX.dealer.siteId, activationKey: "bwk_" + "x".repeat(40),
    publicKeyPem: FX.testKey.publicKeyPem, store: createLeaseStore(FX.dealer.customerId, FX.dealer.siteId, new MemoryBlobs()), now: () => FX.now,
  });
  const differ = [];
  for (const [name, p] of Object.entries(BS.passes)) {
    try {
      const c = client.verifySetupPass(p.pass, { action: p.claims.action, bodyBytes: Buffer.from(p.body) });
      if (asJson(c.signup) !== asJson(BS.signup)) differ.push(`${name}: the sign-up isn't handed on as it came`);
    } catch (e) { differ.push(`good ${name}: ${e.reason}`); }
  }
  for (const b of BS.badPasses) {
    let reason = null;
    try { client.verifySetupPass(b.pass, { action: b.action, bodyBytes: Buffer.from(b.body) }); } catch (e) { reason = e.reason; }
    let want = null;
    try { checkSetupPass(b.pass, { publicKeyPem: FX.testKey.publicKeyPem, customerId: FX.dealer.customerId, siteId: FX.dealer.siteId, action: b.action, bodyBytes: b.body, now: FX.now }); } catch (e) { want = e.reason; }
    if (reason !== want || reason !== "signup") differ.push(`${b.name}: ${reason} (want signup)`);
  }
  ok(`verifySetupPass keeps the ${Object.keys(BS.passes).length} passes that carry a sign-up (and hands the sign-up on exactly), and refuses the ${BS.badPasses.length} whose sign-up isn't the claim's shape, for the reason signup`,
    differ.length === 0, differ.join("; "));
  const counted = BS.counts.filter((c) => {
    const got = typeof termsModule.signupCounts === "function" ? termsModule.signupCounts(c.signup, c.dealerCenter) : null;
    return !got || got.counts !== c.counts || got.why !== c.why;
  });
  ok(`when a sign-up agreement counts: each of the ${BS.counts.length} cases is the contract's (terms.js signupCounts)`, counted.length === 0, counted.map((c) => c.name).join("; "));
  const copies = J("docs/legal/terms-sha256.json");
  const paper = readFileSync(resolvePath(ROOT, "docs/legal/terms.json"));
  const shipsNew = termsAtLeast(TERMS.version);
  ok("docs/legal/terms-sha256.json is {versions: {version: [64 hex, ...]}}, every version 2.2 or later, and it holds this copy's own terms.json when its terms are 2.2 or later",
    asJson(Object.keys(copies)) === asJson(["versions"]) && Object.entries(copies.versions).every(([v, list]) => termsAtLeast(v) && Array.isArray(list) && list.length && list.every((x) => /^[0-9a-f]{64}$/.test(x)))
    && (!shipsNew || (copies.versions[TERMS.version] || []).includes(sha256(paper))) && asJson(termsModule.termsCopies?.()) === asJson(copies.versions), asJson(copies));
}

section("F15. The starting price list (version 0)");
{
  const pl = createPriceList({ store: wrapStore(new MemoryBlobs()), manufacturer, library, templates, now: () => new Date(FX.now), log: () => {} });
  const want = BS.startingPriceList;
  const start = typeof pl.signupStart === "function" ? pl.signupStart(BS.signup) : null;
  ok("Every standard building, set up the way every new business starts, from the sign-up's business name, phone and email: its SHA-256, id, closed to customers, its brand, no website",
    !!start && sha256(JSON.stringify(start)) === want.settingsSha256 && start.id === want.id && start.status === want.status && Object.keys(start.offer).length === want.styles
    && Object.entries(want.brand).every(([k, v]) => start.brand[k] === v), start ? asJson(start.brand) : "no signupStart");
  const cleaned = want.cleaned.filter((c) => {
    const s2 = pl.signupStart?.({ ...BS.signup, ...c.signup });
    return !s2 || s2.brand.phone !== c.brand.phone || s2.brand.email !== c.brand.email;
  });
  ok("its phone and email are what the business's own checks give (an email in lower case and trimmed; one those checks would refuse is left empty)", !!start && cleaned.length === 0, cleaned.map((c) => c.name).join("; "));
}

section("F15. The door before the owner first signs in");
{
  const S1 = await signupBusiness();
  ok("right after Make their Dealer Center, before any pass brought the sign-up: the check-in says no-price-list (v 2, agreement null)",
    S1.sentLicense.length && asJson(JSON.parse(S1.sentLicense.at(-1))) === asJson(JSON.parse(BS.checkIn.examples[0].request.body)), S1.sentLicense.at(-1));
  let x = await S1.replay(doorEx("status before a price list exists").request);
  ok("status before a price list exists: prelive on the sign-up agreement, priceList null (the fixtures' answer, word for word)", sameAnswer(x, doorEx("status before a price list exists")), asJson(x.data));
  ok("... and the agreement is remembered once, in barnwright-signup-agreement: never a phone, an email or a business name",
    asJson(await S1.store.get("barnwright-signup-agreement")) === asJson(BS.record.example), asJson(await S1.store.get("barnwright-signup-agreement")));
  ok("... and the sign-up's business name, phone and email once, in barnwright-signup-details (the fixtures' record), for the owner's start",
    !!BS.detailsRecord && asJson(await S1.store.get("barnwright-signup-details")) === asJson(BS.detailsRecord.example), asJson(await S1.store.get("barnwright-signup-details")));
  ok("... the next check-in says prelive with agreement signup (the fixtures' check-in)", asJson(JSON.parse(await S1.checkInBody())) === asJson(JSON.parse(BS.checkIn.examples[1].request.body)), S1.sentLicense.at(-1));
  ok("... and it is never the owner's own tick: no barnwright-terms, no owner, no price list", (await S1.store.get("barnwright-terms")) === null && (await S1.store.get("setup")) === null && (await S1.store.get("price-list")) === null);
  const logBefore = (await S1.log()).length;
  x = await S1.replay(doorEx("read summary: the starting price list, version 0").request);
  ok("read summary: the starting price list's parts, history [] (the fixtures' answer)", sameAnswer(x, doorEx("read summary: the starting price list, version 0")), asJson(x.data).slice(0, 400));
  x = await S1.replay(doorEx("check at version 0").request);
  ok("check at version 0: the edits on the starting price list, their words and settingsSha256 (the fixtures' answer)", sameAnswer(x, doorEx("check at version 0")), asJson(x.data).slice(0, 400));
  ok("... read and check write nothing: no price list and no line in the owner's log", (await S1.store.get("price-list")) === null && (await S1.log()).length === logBefore);
  S1.clock.t = FX.now + 30_000;
  const saveEx = doorEx("save at version 0: the starting price list (version 1), then the edits (version 2)");
  x = await S1.replay(saveEx.request);
  ok("save at version 0: the starting price list as version 1, then the edits as version 2; versionBefore 0 (the fixtures' answer)", sameAnswer(x, saveEx), asJson(x.data).slice(0, 500));
  const h1 = await S1.store.get("price-list-history/000001"), h2 = await S1.store.get("price-list-history/000002");
  ok("... History: version 1 \"Started the price list from Every standard building, at example prices\" and version 2 the changes, both by Barnwright (alan@...)",
    asJson(h1?.changes) === asJson(saveEx.history[1].changes) && asJson(h2?.changes) === asJson(saveEx.history[0].changes)
    && saveEx.history.every((e) => e.by === h1.savedBy.name && e.by === h2.savedBy.name) && h1.savedAt === saveEx.history[1].savedAt && sha256(JSON.stringify(h1.settings)) === BS.startingPriceList.settingsSha256, asJson([h1?.changes, h2?.changes, h1?.savedBy]));
  ok("... the owner's log: the start line, then the changed line", asJson((await S1.log()).slice(0, 2).map((e) => e.words)) === asJson(saveEx.log), asJson((await S1.log()).slice(0, 3).map((e) => e.words)));
  ok("... and the business is not live: barnwright-live {live: false}, checked through the price list's versions", (await S1.store.get("barnwright-live"))?.live === false && (await S1.store.get("barnwright-live")).checkedThrough >= 1, asJson(await S1.store.get("barnwright-live")));
  /* SEC-F15-1: the starting price list's phone and email are the ones the
     owner typed on the sign-up page (the email is their login), so a login
     that isn't on the team gets the business without them */
  const leaked = [];
  for (const as of ["stranger", "unchecked"]) {
    const r = await S1.call("GET", "/api/office/me", undefined, { as });
    /* (user is the login's own email: the unchecked one typed the owner's) */
    const said = asJson({ ...r.data, user: undefined });
    if (r.status !== 200 || r.data.person !== null || r.data.business?.name !== BS.signup.business) leaked.push(`${as}: ${r.status} ${said.slice(0, 200)}`);
    else if ([BS.signup.phone, BS.signup.email].some((t) => said.includes(t)) || ["phone", "email", "website"].some((k) => k in r.data.business)) leaked.push(`${as}: ${said.slice(0, 300)}`);
  }
  ok("GET me for a login on no team (a stranger, or the owner's email not yet checked) after the start: the business's name, never the sign-up's phone or email (no phone, email or website at all)",
    leaked.length === 0, leaked.join("\n       "));
  x = await S1.replay(doorEx("refused: version 0 once a price list exists").request);
  ok("version 0 once a price list exists: 409 version (the fixtures' answer)", sameAnswer(x, doorEx("refused: version 0 once a price list exists")), asJson(x.data).slice(0, 300));
  /* F15-R2: with no edits too (the starting price list alone, sent after
     someone else made one): the version is checked before the edits */
  const r2wrong = [];
  for (const body of [{ action: "check", version: 0, edits: [] }, { action: "check", version: 0 }, { action: "save", version: 0, edits: [], settingsSha256: BS.startingPriceList.settingsSha256 },
    { action: "save", version: 0, settingsSha256: BS.startingPriceList.settingsSha256 }, { action: "check", version: 7, edits: [] }]) {
    const y = await S1.door(body);
    if (y.status !== 409 || y.data.code !== "version" || y.data.error !== DOOR_WORDS.version) r2wrong.push(`${asJson(body).slice(0, 80)}: ${y.status} ${asJson(y.data).slice(0, 200)}`);
  }
  const atNow = (await S1.store.get("price-list")).version;
  const y1 = await S1.door({ action: "check", version: atNow, edits: [] });
  if (y1.status !== 422 || asJson(y1.data.problems) !== asJson(["Send 1 to 300 edits at a time."])) r2wrong.push(`at the current version with no edits: ${y1.status} ${asJson(y1.data).slice(0, 200)}`);
  ok("version 0 with no edits ([] or left out) once a price list exists, check or save, and any other old version with none: 409 version, never \"Send 1 to 300 edits\"; at the current version, no edits is still 422",
    r2wrong.length === 0 && (await S1.store.get("price-list")).version === atNow, r2wrong.join("\n       "));
  const answers = JSON.stringify([...(await S1.log()).map((e) => e.words), h1?.changes, h2?.changes, x.data]);
  ok("the sign-up's phone and email are in no door answer, log line or change line", ![BS.signup.phone, BS.signup.email].some((t) => answers.includes(t)), answers.slice(0, 200));

  section("F15. The owner's first sign-in: Today right away, Barnwright's price list kept");
  const fs = (n) => BS.firstStart?.examples.find((e) => e.name === n);
  const hist1 = asJson(await S1.store.get("price-list-history/000001")), hist2 = asJson(await S1.store.get("price-list-history/000002"));
  const plBefore = asJson(await S1.store.get("price-list"));
  S1.who = "signup";
  const m = await S1.me("signup");
  const wantMe = fxBody(fs("GET me at the owner's first sign-in") || { answer: { body: {} } });
  ok("GET me at the owner's first sign-in: startNeeded, the business Barnwright set up, no lot yet, no card yet, the terms not yet theirs here (the fixtures' answer)",
    m.startNeeded === true && m.gettingStarted === null && asJson(m.business) === asJson(wantMe.business) && asJson(m.lots) === "[]" && m.terms?.agreed === null && m.setup?.mode === null, asJson([m.startNeeded, m.business, m.terms, m.setup]));
  x = await S1.replay(doorEx("the owner has signed in, before their Dealer Center's start").request);
  ok("the owner has signed in, before their Dealer Center's start: the sign-up agreement on the pass no longer counts, closed terms (the fixtures' answer)", sameAnswer(x, doorEx("the owner has signed in, before their Dealer Center's start")), asJson(x.data).slice(0, 400));
  const startEx = fs("POST start on the price list Barnwright started");
  let r2 = await S1.call("POST", "/api/office/start", {}, { as: "signup" });
  ok("POST start: 200 {business, start: {priceList: kept, lot, terms: signup}} (the fixtures' answer)", r2.status === 200 && !!startEx && asJson(r2.data) === asJson(startEx.answer.body), asJson(r2));
  ok("... Barnwright's price list is kept exactly as it was: the same record, version 2, the same History, nothing saved",
    asJson(await S1.store.get("price-list")) === plBefore && asJson(await S1.store.get("price-list-history/000001")) === hist1 && asJson(await S1.store.get("price-list-history/000002")) === hist2
    && (await S1.store.keys("price-list-history/")).length === 2);
  const lotS1 = await S1.store.all("lots/");
  ok("... the first lot is made, named after the business, with the business phone and email (the fixtures' lot)",
    lotS1.length === 1 && !!startEx && Object.entries(startEx.lot).every(([k, v]) => lotS1[0][k] === v), asJson(lotS1));
  const agreed = await S1.store.get("barnwright-terms");
  ok("... the sign-up agreement is kept as the owner's own: version 2.2, when they signed, the name they typed, from the sign-up page (the fixtures' terms)",
    !!startEx && asJson({ ...agreed?.current, by: { ...agreed?.current?.by, userId: "<the owner's login id>" } }) === asJson(startEx.terms) && agreed.current.by.userId === USERS.signup.id, asJson(agreed));
  ok("... and the owner's empty name is the one they typed on the sign-up page", (await S1.store.get(`people/${USERS.signup.id}`))?.name === BS.signup.signature);
  const m2 = await S1.me("signup");
  ok("GET me after the start: no start needed, the lot, the terms agreed (no line at the top), Getting started saying Barnwright set up the price list, and setup.barnwright (the closed banner may say Barnwright is setting up their prices)",
    m2.startNeeded === false && m2.lots.length === 1 && m2.terms?.agreed?.from === "signup" && m2.terms.agreed.version === "2.2" && m2.gettingStarted?.barnwright === true && m2.setup?.barnwright === true
    && m2.gettingStarted.steps.some((st) => st.id === "prices" && !st.done), asJson([m2.startNeeded, m2.terms, m2.gettingStarted]));
  x = await S1.replay(doorEx("after the owner's first sign-in").request);
  ok("after the owner's first sign-in: prelive on the owner's own agreement (the fixtures' answer)", sameAnswer(x, doorEx("after the owner's first sign-in")), asJson(x.data).slice(0, 400));
  const snap = asJson([await S1.store.get("price-list"), await S1.store.all("lots/"), await S1.store.get("barnwright-terms"), await S1.store.get("first-start")]);
  r2 = await S1.call("POST", "/api/office/start", {}, { as: "signup" });
  ok("POST start again: nothing changes (the fixtures' answer)", r2.status === 200 && asJson(r2.data) === asJson(fs("POST start again")?.answer.body)
    && asJson([await S1.store.get("price-list"), await S1.store.all("lots/"), await S1.store.get("barnwright-terms"), await S1.store.get("first-start")]) === snap, asJson(r2));
  r2 = await S1.call("GET", "/api/office/barnwright-help", undefined, { as: "signup" });
  ok("the owner's Barnwright card: setting up, with Stop (prelive), and its log starts with Barnwright's start and change",
    r2.status === 200 && r2.data.setup?.mode === "prelive" && r2.data.setup.prelive === "on" && r2.data.help.log.some((e) => e.words === saveEx.log[1]) && r2.data.help.log.some((e) => e.words === saveEx.log[0]), asJson(r2.data).slice(0, 500));
  const said = asJson([r2.data, (await S1.me("signup")).gettingStarted, x.data]);
  ok("barnwright-signup-details itself is in no answer (only the business the owner's own price list holds)", !said.includes("barnwright-signup-details") && !said.includes(BS.detailsRecord.example.passId));
}
{
  /* the owner signs in before any pass brought the sign-up (Make their
     Dealer Center hadn't finished when they made their login) */
  const E = await signupBusiness();
  E.who = "signup";
  const m0 = await E.me("signup");
  let r2 = await E.call("POST", "/api/office/start", {}, { as: "signup" });
  ok("the owner signs in before any pass brought their sign-up: startNeeded, and the start asks for the business name (422, nothing made)",
    m0.startNeeded === true && r2.status === 422 && r2.data.error === "Type your business name." && !(await E.store.get("price-list")) && !(await E.store.get("first-start")), asJson(r2));
  await E.replay(doorEx("status before a price list exists").request);
  ok("... the status pass that comes after the owner's claim still brings the business name, phone and email (barnwright-signup-details), and, as their start hasn't run yet, the agreement too (barnwright-signup-agreement)",
    (await E.store.get("barnwright-signup-details"))?.business === BS.signup.business && (await E.store.get("barnwright-signup-agreement"))?.termsSha256 === BS.signup.termsSha256);
  ok("... which changes nothing about access once the owner has signed in (no price list: closed, no-price-list)", (await E.access()).why === "no-price-list" && (await E.access()).agreement === null);
  r2 = await E.call("POST", "/api/office/start", {}, { as: "signup" });
  const plE = await E.store.get("price-list");
  ok("... so the next start makes Every standard building from them (saved by the owner, version 1, closed) and the first lot",
    r2.status === 200 && r2.data.start?.priceList === "made" && plE?.version === 1 && plE.savedBy.id === USERS.signup.id && plE.settings.status === "suspended"
    && plE.settings.brand.name === BS.signup.business && plE.settings.brand.phone === BS.signup.phone && plE.settings.brand.email === BS.signup.email
    && sha256(JSON.stringify(plE.settings)) === BS.startingPriceList.settingsSha256 && (await E.store.keys("lots/")).length === 1, asJson(r2.data));
  ok("... and keeps the agreement from their sign-up page as theirs, as if the pass had come first: no line at the top (terms.agreed from the sign-up page), access prelive on the owner's agreement",
    r2.data.start?.terms === "signup" && (await E.store.get("barnwright-terms"))?.current?.from === "signup" && (await E.me("signup")).terms?.agreed?.from === "signup"
    && (await E.access()).mode === "prelive" && (await E.access()).agreement === "owner", asJson([r2.data.start, await E.store.get("barnwright-terms")]));
  ok("... and the sign-up details are removed: they were only for the start", (await E.store.get("barnwright-signup-details")) === null);
  ok("... and, the price list being the owner's own start's, setup.barnwright is false (the closed banner never says Barnwright is setting up their prices)", (await E.me("signup")).setup?.barnwright === false, asJson((await E.me("signup")).setup));
  /* a plan of 3 open lots: Add your other lots ticks once one more lot is open */
  E.room.business.dealerLimit = 3;
  E.clock.t += 7 * 3600_000;
  await E.me("signup");
  const lotsStep = async () => { const g = (await E.me("signup")).gettingStarted; return { limit: g?.lotLimit, ...g?.steps.find((st) => st.id === "lots") }; };
  const before = await lotsStep();
  const added = await E.call("POST", "/api/office/lots", { name: "Second Lot" }, { as: "signup" });
  const after = await lotsStep();
  ok("Getting started, a plan of 3 lots: Add your other lots isn't done with the first lot, and is done once a second lot is open (the third place can wait)",
    before.limit === 3 && before.done === false && added.status === 201 && after.limit === 3 && after.done === true, asJson([before, added.status, after]));
}
{
  /* the version this Dealer Center ships, but a terms text none of its own copies has */
  const U = await signupBusiness({ copies: {} });
  U.clock.t = FX.now + 30_000;
  const saved = await U.replay(doorEx("save at version 0 with no edits: only the starting price list (version 1)").request);
  ok("a sign-up to the terms version this Dealer Center ships, with a terms text none of its copies has: Barnwright can still start the price list (the version alone counts for setup access)",
    saved.status === 200 && (await U.store.get("price-list"))?.version === 1 && (await U.store.get("barnwright-signup-agreement"))?.termsSha256 === BS.signup.termsSha256, asJson(saved.data).slice(0, 300));
  U.who = "signup";
  await U.me("signup");
  const r2 = await U.call("POST", "/api/office/start", {}, { as: "signup" });
  const ex = BS.firstStart.examples.find((e) => e.name === "POST start, a sign-up to a terms text this Dealer Center doesn't have");
  ok("... but the owner's start never keeps it as theirs: terms null (the fixtures' answer), barnwright-terms empty, and the line at the top asks",
    r2.status === 200 && !!ex && asJson(r2.data.start) === asJson(ex.answer.body.start) && (await U.store.get("barnwright-terms")) === null
    && (await U.me("signup")).terms?.agreed === null && (await U.access()).why === "terms", asJson([r2.data, await U.store.get("barnwright-terms")]));
}
{
  /* a sign-up under terms 2.1: the details make the price list, the agreement is never kept */
  const O = await signupBusiness();
  const old = doorEx("refused: they signed up before terms 2.2");
  await O.replay(old.request);
  ok("a pass whose sign-up doesn't count (they signed up under 2.1) still brings the details, never the agreement",
    (await O.store.get("barnwright-signup-details"))?.business === BS.signup.business && !(await O.store.get("barnwright-signup-agreement")));
  O.who = "signup";
  await O.me("signup");
  const r2 = await O.call("POST", "/api/office/start", {}, { as: "signup" });
  ok("... the owner's start makes their price list from them and writes no terms (a sign-up under 2.1 is never kept as an agreement)",
    r2.status === 200 && r2.data.start?.priceList === "made" && r2.data.start.terms === null && (await O.store.get("barnwright-terms")) === null, asJson(r2.data));
}
{
  /* the details are never written once a price list exists, nor by a pass with no sign-up */
  const P = await signupBusiness();
  await P.replay(doorEx("refused: no sign-up agreement").request);
  ok("a pass with no sign-up writes no details", !(await P.store.get("barnwright-signup-details")));
  P.who = "signup";
  await P.me("signup");
  await P.call("POST", "/api/office/start", { businessName: "Typed Barns" }, { as: "signup" });
  await P.replay(doorEx("status before a price list exists").request);
  ok("... and once a price list exists, a pass with a sign-up writes none either (the owner's typed name stays), nor, once their start ran, the agreement",
    !(await P.store.get("barnwright-signup-details")) && (await P.store.get("price-list"))?.settings.brand.name === "Typed Barns" && !(await P.store.get("barnwright-signup-agreement")));
}
{
  /* the starting price list alone, and undo at it */
  const A0 = await signupBusiness();
  let x = await A0.replay(doorEx("check at version 0 with no edits: the starting price list alone").request);
  ok("check at version 0 with no edits: the starting price list alone (the fixtures' answer)", sameAnswer(x, doorEx("check at version 0 with no edits: the starting price list alone")), asJson(x.data).slice(0, 400));
  A0.clock.t = FX.now + 30_000;
  const ex = doorEx("save at version 0 with no edits: only the starting price list (version 1)");
  x = await A0.replay(ex.request);
  ok("save at version 0 with no edits: only the starting price list, version 1; canUndo false (the fixtures' answer)", sameAnswer(x, ex), asJson(x.data).slice(0, 400));
  ok("... the owner's log: the start line only", asJson((await A0.log()).map((e) => e.words)) === asJson(ex.log), asJson((await A0.log()).map((e) => e.words)));
  x = await A0.replay(doorEx("refused: undo at the starting price list").request);
  ok("undo at the starting price list: 409 cant-undo, \"This is the starting price list Barnwright set up, so there is nothing before it to put back.\" (the fixtures' answer)",
    sameAnswer(x, doorEx("refused: undo at the starting price list")) && x.data.error === BS.words.nothingBeforeStart, asJson(x.data).slice(0, 400));
}
{
  const wrong = [];
  for (const n of ["refused: a version other than 0 before a price list exists", "refused: they signed up before terms 2.2", "refused: they signed up under terms this Dealer Center doesn't have", "refused: no sign-up agreement"]) {
    const B2 = await signupBusiness();
    const x = await B2.replay(doorEx(n).request);
    if (!sameAnswer(x, doorEx(n))) wrong.push(`${n}: ${x.status} ${asJson(x.data).slice(0, 300)}`);
    if (n !== "refused: a version other than 0 before a price list exists" && (await B2.store.get("barnwright-signup-agreement")) !== null) wrong.push(`${n}: remembered an agreement that doesn't count`);
  }
  const N = await signupBusiness({ ships: "2.1" });
  const nx = await N.replay(doorEx("refused: terms 2.2 aren't out here").request);
  if (!sameAnswer(nx, doorEx("refused: terms 2.2 aren't out here"))) wrong.push(`not out: ${nx.status} ${asJson(nx.data).slice(0, 300)}`);
  ok("each refusal is the fixtures' answer: a version other than 0 (409), signed up before 2.2 (signup-terms), under terms this copy doesn't have (signup-unknown), no sign-up (no-price-list), and terms 2.2 not out here (terms)",
    wrong.length === 0, wrong.join("\n       "));
  ok("... and the words for signup-terms and signup-unknown are the contract's", WHY["signup-terms"] === BS.words.why["signup-terms"] && WHY["signup-unknown"] === BS.words.why["signup-unknown"]);
}

section("F15. The visit that starts the price list");
{
  const vx = (n) => BS.visit.examples.find((e) => e.name === n);
  const V = await signupBusiness();
  const ex = vx("start before a price list exists: the starting price list is made first");
  const r3 = await V.visitReplay(ex.request);
  const line = (r3.cookies || []).find((c) => c.startsWith(COOKIE + "="));
  ok("start before a price list exists: 200, started true, prelive, the business's name (the fixtures' answer), and the cookie",
    r3.status === 200 && asJson(r3.data) === asJson(ex.answer.body) && /^__Host-bw_setup=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/.test(line || ""), asJson(r3.data));
  const pl1 = await V.store.get("price-list");
  ok("... the starting price list is version 1, saved by Barnwright with the start pass's id, closed to customers",
    pl1?.version === 1 && pl1.savedBy.id === "barnwright" && pl1.savedBy.passId === BS.passes.session.claims.id && sha256(JSON.stringify(pl1.settings)) === BS.startingPriceList.settingsSha256, asJson(pl1?.savedBy));
  ok("... the owner's log: the start line, then \"opened your price list\"", asJson((await V.log()).map((e) => e.words)) === asJson(ex.log), asJson((await V.log()).map((e) => e.words)));
  const told = V.room.setupService[0];
  const wantTold = JSON.parse(ex.serviceRecord.body);
  ok("... and the Control Room's service record is told: version 1, versionBefore 0, the start line", !!told && Object.entries(wantTold).every(([k, v]) => asJson(told[k]) === asJson(v)), asJson(told));
  const sess = Object.values((await V.store.get("barnwright-sessions")) || {})[0] || {};
  ok("... the visit records what it started under: before live, on the sign-up agreement", sess?.mode === "prelive" && sess.agreement === "signup", asJson(sess));
  const strangerMe = await V.call("GET", "/api/office/me", undefined, { as: "stranger" });
  ok("... and a login on no team that asks GET me now gets the business without the sign-up's phone or email",
    strangerMe.status === 200 && strangerMe.data.person === null && strangerMe.data.business?.name === BS.signup.business
    && ![BS.signup.phone, BS.signup.email].some((t) => asJson(strangerMe.data).includes(t)), asJson(strangerMe.data).slice(0, 300));
  const cookie = (line || "__Host-bw_setup=none").split(";")[0];
  const got = await V.visit("GET", "price-list", undefined, cookie);
  ok("the price list screens open on it, ready to edit (GET price-list during the visit: version 1)", got.status === 200 && got.data.version === 1 && got.data.settings.brand.name === BS.signup.business, asJson(got.data).slice(0, 200));
  const s1 = structuredClone(got.data.settings);
  s1.offer.LB.sizes["10x16"] = 5700;
  let put = await V.visit("PUT", "price-list", { settings: s1, version: 1 }, cookie);
  ok("... and Alan's save in the visit is version 2", put.status === 200 && put.data.version === 2, asJson(put.data).slice(0, 200));
  await V.me("signup");
  const afterIn = vx("a visit started on the sign-up agreement, after the owner first signed in");
  put = await V.visit("PUT", "price-list", { settings: s1, version: 2 }, cookie);
  ok("the owner makes their login: the visit started on the sign-up agreement ends (401 visit-ended, the words for terms)",
    put.status === afterIn.answer.status && Object.keys(afterIn.answer.body).length === Object.keys(put.data).length && Object.entries(afterIn.answer.body).every(([k, v]) => put.data[k] === v), asJson(put.data));
  /* F15-R3, now: the owner who just made their login lands on Today, where
     the terms are the line at the top (when the agreement from the sign-up
     page isn't kept): the words say to tap I have read and agree there */
  ok("F15-R3: ... the words for terms say to tap the I have read and agree button at the top of their Dealer Center, the contract's words",
    /They tap the I have read and agree button at the top of their Dealer Center\./.test(put.data.error || "") && !/First setup/.test(put.data.error || "")
    && WHY.terms === FX.door.why.terms && !/First setup/.test(WHY.terms + WHY["no-price-list"]), asJson(put.data.error));
  await V.call("POST", "/api/office/start", {}, { as: "signup" });
  const sessKey = Object.keys(await V.store.get("barnwright-sessions") || {});
  await V.store.put("barnwright-sessions", { [sha256(cookie.split("=")[1])]: { ...sess, endsAt: new Date(V.clock.t + 3600_000).toISOString() } });
  put = await V.visit("GET", "me", undefined, cookie);
  ok("... and even after the owner's start keeps their sign-up agreement as theirs, that visit stays ended (Alan opens a new one)", put.status === 401 && put.data.code === "visit-ended" && put.data.error === VISIT_WORDS.ended
    && (await V.store.get("barnwright-terms"))?.current?.from === "signup", asJson([put.data, sessKey]));
  const again = await V.start(V.pass());
  ok("... a new visit (no sign-up needed now) starts on the owner's own agreement", again.status === 200 && Object.values((await V.store.get("barnwright-sessions")) || {}).some((x) => x.agreement === "owner"), asJson(again.data));
}
{
  /* the check-in right after the deploy never came, and nobody has opened the Dealer Center: the start checks in once first */
  const N = await signupBusiness({ checkIn: false });
  const before = N.room.calls.filter((p) => p === "/api/license").length;
  const r0 = await N.start(N.room.setupPass({ actor: "alan@barnwrightsoftware.com", signup: BS.signup }));
  ok("a Dealer Center that has never checked in: the visit's start checks in once first, then starts the price list (200, started)",
    before === 0 && r0.status === 200 && r0.data.started === true && N.room.calls.filter((p) => p === "/api/license").length === 1 && (await N.store.get("price-list"))?.version === 1, asJson([before, r0.status, r0.data]));
  const N2 = await signupBusiness({ checkIn: false });
  const ex0 = doorEx("save at version 0 with no edits: only the starting price list (version 1)");
  const r02 = await N2.replay(ex0.request);
  ok("... and so does the door's first save at version 0", r02.status === 200 && r02.data.version === 1 && N2.room.calls.filter((p) => p === "/api/license").length === 1, asJson(r02.data).slice(0, 300));
}
{
  const vx = (n) => BS.visit.examples.find((e) => e.name === n);
  const O = await signupBusiness();
  O.room.business.status = "deactivated";
  await O.office.checkIn({ force: true });
  const r3 = await O.start(O.room.setupPass({ actor: "alan@barnwrightsoftware.com", signup: BS.signup }));
  const ex = vx("start when the account can't save");
  ok("start when the account can't save: 423 account-off in the door's words; no price list is made and no visit starts",
    r3.status === 423 && r3.data.ok === false && r3.data.code === ex.answer.body.code && r3.data.error === ex.answer.body.error && !cookieFrom(r3)
    && (await O.store.get("price-list")) === null && !Object.keys((await O.store.get("barnwright-sessions")) || {}).length, asJson(r3.data));
  const P = await signupBusiness();
  const old = { ...BS.signup, termsVersion: "2.1", termsSha256: sha256("TEST ONLY: the bytes of docs/legal/terms.json for terms 2.1") };
  const r4 = await P.start(P.room.setupPass({ actor: "alan@barnwrightsoftware.com", signup: old }));
  const ex4 = vx("start with a sign-up from before terms 2.2");
  ok("start with a sign-up from before terms 2.2: 403 closed, signup-terms, no cookie", r4.status === 403 && r4.data.code === "closed" && r4.data.why === ex4.answer.body.why && r4.data.error === ex4.answer.body.error && !cookieFrom(r4), asJson(r4.data));
  const Q = await signupBusiness();
  const r5 = await Q.start(Q.room.setupPass({ actor: "alan@barnwrightsoftware.com" }));
  ok("start with no sign-up and no price list: 403 closed, no-price-list, as before", r5.status === 403 && r5.data.why === "no-price-list" && r5.data.error === WHY["no-price-list"], asJson(r5.data));
}

section("F15 item 4. The lock: an extra that changes how the building is built");
{
  /* the fixtures' extra of the business's own that carries a construction
     effect (model/company.js optionEffects): Barnwright never adds one,
     changes one, or removes an extra that has one */
  const FXE = FX.edits.effects;
  const E = await fixtureBusiness(FXE.effectBase);
  const words = extraWords;
  ok("the lock's words and the owner's log words are the contract's", typeof LOCK_WORDS.extraConstruction === "function" && LOCK_WORDS.extraConstruction("Heavy-duty floor") === words("Heavy-duty floor")
    && JSON.stringify(setupAccessModule.REFUSED_LOG) === JSON.stringify(FX.words.refusedLog), String(LOCK_WORDS.extraConstruction));
  const wrong = [];
  for (const sm of FXE.door) {
    const x = await E.door({ action: "check", version: 1, edits: sm.edits });
    const want = sm.expect;
    const good = want.ok
      ? x.status === 200 && JSON.stringify(x.data.changes) === JSON.stringify(want.changes) && x.data.settingsSha256 === want.settingsSha256
        && JSON.stringify(x.data.warnings) === JSON.stringify(want.warnings)
      : x.status === 422 && x.data.code === "problems" && JSON.stringify(x.data.problems) === JSON.stringify(want.problems);
    if (!good) wrong.push(`${sm.name}: ${x.status} ${JSON.stringify(x.data).slice(0, 300)}`);
  }
  ok(`the door: each of the ${FXE.door.length} examples (a name and price change keeps the effect; remove_extra and a construction part are refused; a style's own pitch that makes an extra change nothing is a warning)`, wrong.length === 0, wrong.join("\n       "));
  const pathsWrong = FXE.door.filter((sm) => sm.expect.ok).filter((sm) => {
    const res = applyEdits(FXE.effectBase, sm.edits, { manufacturer });
    return JSON.stringify(res.settings?.options?.extras) !== JSON.stringify(sm.expect.paths["options.extras"] ?? FXE.effectBase.options.extras);
  });
  ok("set_extra on its own keeps the extra's construction effect exactly", pathsWrong.length === 0, pathsWrong.map((x) => x.name).join(", "));
  /* the visit sends whole settings */
  const cookie = cookieFrom(await E.start());
  const vwrong = [];
  for (const sm of FXE.visit) {
    const pl = (await E.visit("GET", "price-list", undefined, cookie)).data;
    const settings = structuredClone(pl.settings);
    settings.options.extras = structuredClone(sm.extras);
    const x = await E.visit("PUT", "price-list", { settings, version: pl.version }, cookie);
    const good = sm.expect.status === 200 ? x.status === 200 : x.status === 422 && JSON.stringify(x.data.problems) === JSON.stringify(sm.expect.problems);
    if (!good) vwrong.push(`${sm.name}: ${x.status} ${JSON.stringify(x.data).slice(0, 300)}`);
  }
  ok(`the visit: each of the ${FXE.visit.length} examples (a new effect, a changed one, one taken off, the extra removed: refused; name, charge and price: saved)`, vwrong.length === 0, vwrong.join("\n       "));
  {
    /* a hand-made visit request with an extra keyed by the number 5 */
    const pl = (await E.visit("GET", "price-list", undefined, cookie)).data;
    const settings = structuredClone(pl.settings);
    settings.options.extras = [...settings.options.extras, { key: 5, name: "Cheap shelf", input: "check", price: 10 }];
    const x = await E.visit("PUT", "price-list", { settings, version: pl.version }, cookie);
    const own = await E.call("PUT", "/api/office/price-list", { settings, version: pl.version }, { as: "pat" });
    const words5 = "One of your extras could not be saved. Reload the page and try again.";
    ok("the visit's save of an extra keyed by a number (not text) is refused in the owner's words, as the owner's own save is; nothing saved",
      x.status === 422 && asJson(x.data.problems) === asJson([words5]) && own.status === 422 && asJson(own.data.problems) === asJson([words5])
      && (await E.store.get("price-list")).version === pl.version, asJson([x.data, own.data]));
  }
  const log = await E.log();
  ok("... and a refusal says so in the owner's log, in the owner's own words", log.some((e) => e.words === REFUSED_LOG.locked), JSON.stringify(log.map((e) => e.words)));
  /* the lock on its own: a building style's own numbers (set_built, set_roof_pitch) stay the only building-shape change */
  const s0 = FXE.effectBase;
  const variants = [
    ["the effect's value changed", (s) => { s.options.extras.find((x) => x.key === "heavy-floor").construction["floor.spacingIn"] = 24; }, ["Heavy-duty floor"]],
    ["an effect added to an extra that had none", (s) => { s.options.extras.find((x) => x.key === "ridge-vent").construction = { "roof.ventIn": 4 }; }, ["Ridge vent"]],
    ["the extra with the effect renamed and its effect removed", (s) => { const x = s.options.extras.find((y) => y.key === "heavy-floor"); x.name = "Floor"; delete x.construction; }, ["Heavy-duty floor"]],
    ["the effect moved to another key", (s) => { const x = s.options.extras.find((y) => y.key === "heavy-floor"); x.key = "floor-2"; }, ["Heavy-duty floor"]],
    /* HB: an extra's own How it's built numbers (old code: not looked at) */
    ["How it's built numbers added to an extra that had none", (s) => { s.options.extras.find((x) => x.key === "ridge-vent").built = { roofPitch: 8 }; }, ["Ridge vent"]],
    ["an extra's How it's built numbers changed", (s) => { s.options.extras.find((x) => x.key === FXE.builtExtra.key).built.roofPitch = 9; }, [FXE.builtExtra.name]],
    ["the buildings an extra with How it's built numbers is offered on", (s) => { delete s.options.extras.find((x) => x.key === FXE.builtExtra.key).styles; }, [FXE.builtExtra.name]],
    ["an extra with How it's built numbers removed", (s) => { s.options.extras = s.options.extras.filter((x) => x.key !== FXE.builtExtra.key); }, [FXE.builtExtra.name]],
  ];
  const lwrong = [];
  for (const [what, change, names] of variants) {
    const n = structuredClone(s0);
    change(n);
    const got = lockProblems(s0, n, { manufacturer });
    if (JSON.stringify(got) !== JSON.stringify(names.map(words))) lwrong.push(`${what}: ${JSON.stringify(got)}`);
  }
  const reordered = structuredClone(s0);
  reordered.options.extras.reverse();
  /* the same numbers written as text ("7/12" for 7) are the same numbers */
  reordered.options.extras.find((x) => x.key === FXE.builtExtra.key).built.roofPitch = "7/12";
  reordered.options.extras.find((x) => x.key === "heavy-floor").construction = { ...s0.options.extras.find((x) => x.key === "heavy-floor").construction };
  if (lockProblems(s0, reordered, { manufacturer }).length) lwrong.push("the same extras in another order are refused");
  ok("lockProblems: every way of adding, changing or taking away an extra's effect or its own How it's built numbers is refused with its name; the same extras in another order (a number written as text) are not", lwrong.length === 0, lwrong.join("; "));
  /* SEC-F15-2: the 3D designer reads an extra's key as text (optionEffects[x.key]),
     so the number 5 and the text "5" are one choice there */
  const owner5 = structuredClone(s0);
  owner5.options.extras = [{ key: "5", name: "Heavy floor", input: "check", price: 300, construction: { "floor.spacingIn": 12 } }];
  const twin = structuredClone(owner5);
  twin.options.extras.push({ key: 5, name: "Cheap shelf", input: "check", price: 10 });
  const kwrong = [];
  for (const door of [true, false]) {
    const got = lockProblems(owner5, twin, { door, manufacturer });
    if (asJson(got) !== asJson([words("Heavy floor")])) kwrong.push(`a second extra keyed 5 beside "5" (${door ? "door" : "visit"}): ${asJson(got)}`);
  }
  const both = structuredClone(s0);
  both.options.extras = [
    { key: "5", name: "Shelf", input: "check", price: 10, construction: { "floor.spacingIn": 16 } },
    { key: 5, name: "Heavy floor", input: "check", price: 300, construction: { "floor.spacingIn": 12 } },
  ];
  const swapped = structuredClone(both);
  swapped.options.extras.reverse();
  if (!lockProblems(both, swapped, { manufacturer }).length) kwrong.push("5 and \"5\" swapped (which one builds changes): not refused");
  ok("the lock reads extras' keys as the 3D designer does, as text: an extra keyed 5 beside the owner's \"5\" that has an effect is refused with its name, and so is swapping 5 and \"5\"",
    kwrong.length === 0, kwrong.join("; "));
  const vk = validate(twin, manufacturer);
  ok("... and model/company.js validate() takes only text keys for extras (the number 5 is refused; \"5\" is fine)",
    vk.includes("options.extras[1].key must be 1 to 40 letters, digits, dashes or underscores.") && validate(owner5, manufacturer).length === 0, asJson(vk));
  const pitch = applyEdits(s0, [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }], { manufacturer });
  ok("... while a gable roof's pitch (set_roof_pitch) still passes the lock with the effect extras there", pitch.problems.length === 0 && lockProblems(s0, pitch.settings, { door: true, manufacturer }).length === 0);
}
{
  /* Which library style a style of their own is built like (offer.<code>.base)
     is its shape: the Premium Utility re-based on the Lofted Barn becomes a
     barn, and an extra of the owner's pinned to it lands on a barn. Only the
     owner changes it; a new style of their own still names its own (review
     SEC-BUILT-3). */
  const R = await fixtureBusiness();
  const rb = await R.ownerSave((x) => {
    x.offer.UT1 = { base: "UT", name: "Premium Utility", sizes: { "10x16": 6000, "12x20": 8000 } }; x.categories[0][1].push("UT1");
    x.options.extras.push({ key: "jo12", name: "Joists 12 in", input: "check", price: 100, construction: { "floor.spacingIn": 12 }, styles: ["UT1"] });
  });
  const rc = cookieFrom(await R.start());
  const put = async (fn) => {
    const pl = (await R.visit("GET", "price-list", undefined, rc)).data;
    const settings = structuredClone(pl.settings);
    fn(settings);
    return R.visit("PUT", "price-list", { settings, version: pl.version }, rc);
  };
  const rebase = await put((x) => { x.offer.UT1.base = "LB"; });
  const libBase = await put((x) => { x.offer.G.base = "UT"; });
  const fresh = await put((x) => { x.offer.LB1 = { base: "LB", name: "Tall Loft Barn", sizes: { "10x16": 6490 } }; x.categories[0][1].push("LB1"); });
  ok("A4: the visit can't change which building a style of their own is built like, nor make a library style built like another, in the lock's words (old code: allowed); a new style of their own still names its own",
    rb.status === 200 && rebase.status === 422 && JSON.stringify(rebase.data.problems) === JSON.stringify([LOCK_WORDS.construction])
    && libBase.status === 422 && (libBase.data.problems || []).includes(LOCK_WORDS.construction) && fresh.status === 200,
    JSON.stringify([rb.status, rebase.status, rebase.data, libBase.status, libBase.data?.problems, fresh.status]).slice(0, 500));
  const stored = (await R.store.get("price-list")).settings;
  const reb = structuredClone(stored); reb.offer.UT1.base = "LB";
  ok("A4: ... and at the door's lock too, in both modes", ["prelive", "switch"].every((mode) => JSON.stringify(lockProblems(stored, reb, { door: true, mode, manufacturer })) === JSON.stringify([LOCK_WORDS.construction])),
    JSON.stringify(lockProblems(stored, reb, { door: true, mode: "switch", manufacturer })));
  /* the owner re-bases it; putting back the copy from before would re-base it again */
  const own = await R.ownerSave((x) => { x.offer.UT1.base = "LB"; });
  const ownHist = await R.store.get(`price-list-history/${String((await R.store.get("price-list")).version).padStart(6, "0")}`);
  const back = await R.visit("POST", "price-list/restore", { version: 2, current: (await R.store.get("price-list")).version }, rc);
  ok("A4: the owner may (History says \"Premium Utility: now built like the Lofted Barn (was the Utility Shed)\", old code: nothing), and a put back in the visit that would re-base it again is refused by the lock",
    own.status === 200 && (ownHist?.changes || []).includes("Premium Utility: now built like the Lofted Barn (was the Utility Shed)")
    && back.status === 422 && JSON.stringify(back.data.problems) === JSON.stringify([LOCK_WORDS.construction]), JSON.stringify([own.status, ownHist?.changes, back.status, back.data]).slice(0, 500));
}
section("HB. How it's built through Barnwright's setup access: a building style's own numbers, checked like the owner's");
{
  const H = await fixtureBusiness();
  const hc = cookieFrom(await H.start());
  const put = async (fn) => {
    const pl = (await H.visit("GET", "price-list", undefined, hc)).data;
    const settings = structuredClone(pl.settings);
    fn(settings);
    const x = await H.visit("PUT", "price-list", { settings, version: pl.version }, hc);
    return { x, before: pl.version, after: (await H.store.get("price-list")).version };
  };
  let t = await put((s) => { s.offer.LB.built = { wallHeight: "7 ft" }; });
  const savedLB = await H.store.get("price-list");
  const histLB = await H.store.get(`price-list-history/${String(savedLB.version).padStart(6, "0")}`);
  ok("HB: the visit may set a building style's own number in How it's built: stored as a number, said in History like the owner's own",
    t.x.status === 200 && savedLB.settings.offer.LB.built?.wallHeight === 84 && (histLB?.changes || []).includes("Loft Barn wall height: 6 ft 7 1/2 in → 7 ft"), JSON.stringify([t.x.data, histLB?.changes]).slice(0, 400));
  t = await put((s) => { s.offer.UT.built = { wallHeight: 60 }; });
  ok("HB: ... and the every-size check judges it as it does the owner's: a 5 ft Utility Shed wall that no door fits is refused in words, nothing saved",
    t.x.status === 422 && /Utility Shed 12×20: the 72″ Wooden Double Doors on the front should be 76 1\/2 in tall, but the wall leaves room for/.test((t.x.data.problems || [])[0] || "") && t.after === t.before, JSON.stringify(t.x.data).slice(0, 400));
  t = await put((s) => { s.offer.UT.built = { roofPitch: "5\\12" }; });
  ok("HB: ... and How it's built's own words refuse a number it can't read", t.x.status === 422 && JSON.stringify(t.x.data.problems) === JSON.stringify(["Roof pitch: write it like 5/12."]) && t.after === t.before, JSON.stringify(t.x.data));
  t = await put((s) => { s.built = { roofPitch: { gable: 6 } }; });
  ok("HB: How it's built for the whole business is the owner's alone: refused in the lock's words", t.x.status === 422 && JSON.stringify(t.x.data.problems) === JSON.stringify([LOCK_WORDS.built]) && t.after === t.before, JSON.stringify(t.x.data));
  t = await put((s) => { s.construction = { walls: { heightIn: 96 } }; });
  ok("HB: so are the construction settings", t.x.status === 422 && JSON.stringify(t.x.data.problems) === JSON.stringify([LOCK_WORDS.construction]) && t.after === t.before, JSON.stringify(t.x.data));
  const own = await H.ownerSave((s) => { s.built = { roofPitch: { gable: 6 } }; });
  ok("(the owner may set How it's built for the whole business)", own.status === 200, JSON.stringify(own.data).slice(0, 300));
  const bld = await (withDoor(H)).door({ action: "read", part: "buildings" });
  ok("HB: read says a gable roof's pitch the owner set for the whole business, not standard", JSON.stringify(bld.data.view?.styles?.map((x) => [x.code, x.pitch])) === JSON.stringify([["UT", "6/12"], ["LB", null], ["G", "6/12"]]), JSON.stringify(bld.data.view?.styles?.map((x) => [x.code, x.pitch])));
}

{
  /* putting back can't take an effect away either: the owner added the extra after the version Barnwright puts back */
  const G = withDoor(business());
  await G.setUp(); await G.agree("2.2");
  const added = await G.ownerSave((s) => { s.options.extras = [...(s.options.extras || []), { key: "heavy-floor", name: "Heavy-duty floor", input: "check", price: 350, construction: { "floor.spacingIn": 12 } }]; });
  ok("(the owner adds an extra that changes how the building is built: the owner may)", added.status === 200, JSON.stringify(added.data).slice(0, 300));
  const c = cookieFrom(await G.start());
  const x = await G.visit("POST", "price-list/restore", { version: 1, current: 2 }, c);
  ok("a put back in the visit to before the owner added it is refused by the lock, naming the extra", x.status === 422 && JSON.stringify(x.data.problems) === JSON.stringify([extraWords("Heavy-duty floor")])
    && (await G.store.get("price-list")).version === 2, JSON.stringify(x.data));
  const owner2 = await G.ownerSave((s) => { s.items.w48 = 170; });
  const p = await G.door({ action: "check", version: 3, edits: [{ do: "set_item", item: "w48", price: 175 }] });
  await G.door({ action: "save", version: 3, edits: [{ do: "set_item", item: "w48", price: 175 }], settingsSha256: p.data.settingsSha256 });
  const st = await G.store.get("price-list");
  await G.store.put("price-list-history/000003", { ...(await G.store.get("price-list-history/000003")), settings: { ...(await G.store.get("price-list-history/000003")).settings, options: { ...st.settings.options, extras: st.settings.options.extras.filter((e) => e.key !== "heavy-floor") } } });
  const u = await G.door({ action: "check", version: 4, undo: true });
  ok("the door's undo to a copy without the effect extra is refused by the lock too", owner2.status === 200 && u.status === 422 && JSON.stringify(u.data.problems) === JSON.stringify([extraWords("Heavy-duty floor")]), JSON.stringify(u.data).slice(0, 400));
}

{
  /* Putting back in the visit carries the locked parts (How it's built for
     the whole business, the construction settings) forward from now: that
     mix was never saved, so it is checked like a save, against the copy as
     it was kept (review SEC-BUILT-1). */
  const P = await fixtureBusiness();
  const p2 = await P.ownerSave((x) => { x.offer.UT.built = { wallHeight: 81 }; });
  const p3 = await P.ownerSave((x) => { delete x.offer.UT.built; x.built = { doorHeight: { other: 78 } }; });
  const mixOwn = await P.ownerSave((x) => { x.offer.UT.built = { wallHeight: 81 }; });
  const pc = cookieFrom(await P.start());
  const kept = await P.store.get("price-list");
  const px = await P.visit("POST", "price-list/restore", { version: 2, current: 3 }, pc);
  const pAfter = await P.store.get("price-list");
  ok("HB: a put back in the visit whose own 6 ft 9 in wall doesn't fit the 78 in shop doors the owner set for the whole business since is refused, in the every-size words, nothing saved (old code: saved)",
    p2.status === 200 && p3.status === 200 && mixOwn.status === 422 && px.status === 422
    && /^Utility Shed \d+×\d+: the 72″ Wooden Double Doors on the front should be 78 in tall, but the wall leaves room for 76 5\/8 in\./.test(px.data.problems?.[0] || "")
    && pAfter.version === 3 && JSON.stringify(pAfter.settings) === JSON.stringify(kept.settings), JSON.stringify([p2.status, p3.status, mixOwn.status, px.status, px.data]).slice(0, 500));
  /* the strict half: a style's own barn height joined with a business-wide one set since */
  const Q = await fixtureBusiness();
  const q2 = await Q.ownerSave((x) => { x.offer.LB.built = { barnPeak: { 10: 50 } }; });
  const q3 = await Q.ownerSave((x) => { delete x.offer.LB.built; x.built = { barnPeak: { 12: 49 } }; });
  const qc = cookieFrom(await Q.start());
  const qx = await Q.visit("POST", "price-list/restore", { version: 2, current: 3 }, qc);
  ok("HB: ... and one whose own 10 ft barn height would stand above the 12 ft barn height set for the whole business since is refused in How it's built's words (old code: saved)",
    q2.status === 200 && q3.status === 200 && qx.status === 422
    && JSON.stringify(qx.data.problems) === JSON.stringify(["Barn roof height: the 12 ft wide barn (4 ft 1 in, business-wide) would be lower than the 10 ft wide barn (4 ft 2 in). Type a height for the 12 ft wide barn too."])
    && (await Q.store.get("price-list")).version === 3, JSON.stringify([q2.status, q3.status, qx.status, qx.data]).slice(0, 500));
  /* what the copy itself already had stays the copy's: it goes back, said */
  const R = await fixtureBusiness();
  const r2 = await R.ownerSave((x) => { x.offer.UT.built = { wallHeight: 81 }; });
  const h2 = await R.store.get("price-list-history/000002");
  await R.store.put("price-list-history/000002", { ...h2, settings: { ...h2.settings, built: { doorHeight: { other: 78 } } } });
  const r3 = await R.ownerSave((x) => { delete x.offer.UT.built; x.built = { doorHeight: { other: 78 } }; x.embed = { origins: ["https://testingsheds.example"] }; });
  const rc = cookieFrom(await R.start());
  const rx = await R.visit("POST", "price-list/restore", { version: 2, current: 3 }, rc);
  const rAfter = await R.store.get("price-list");
  ok("HB: ... while what the copy put back had already (kept that way) still goes back, the every-size words said, and the website list kept as now",
    r2.status === 200 && r3.status === 200 && rx.status === 200 && rAfter.version === 4 && rAfter.settings.offer.UT.built?.wallHeight === 81
    && JSON.stringify(rAfter.settings.embed) === JSON.stringify({ origins: ["https://testingsheds.example"] })
    && /^Utility Shed \d+×\d+: the 72″ Wooden Double Doors on the front should be 78 in tall/.test(rx.data.sizeCheck?.problems?.[0] || ""), JSON.stringify([r2.status, r3.status, rx.status, rx.data]).slice(0, 500));
  /* the owner's own put back takes the whole copy, its numbers for the whole business too, so it builds */
  const ownBack = await P.call("POST", "/api/office/price-list/restore", { version: 2, current: (await P.store.get("price-list")).version }, { as: "pat" });
  ok("HB: (the owner's own put back of that copy takes it whole, the business-wide door height too, and goes back as before)",
    ownBack.status === 200 && ownBack.data.settings?.offer.UT.built?.wallHeight === 81 && !("built" in (ownBack.data.settings || {})) && !(ownBack.data.sizeCheck?.problems || []).length, JSON.stringify(ownBack.data).slice(0, 300));
}

section("SB. set_built: a building style's own numbers in How it's built, in a builder's words, through the door");
{
  const opts = { manufacturer };
  const base = FX.edits.baseSettings;
  const D2 = await fixtureBusiness();
  /* check, then save, then read back: stored as numbers, drawn as set, History in the owner's own words */
  const edits = [{ do: "set_built", style: "UT", wallHeight: "8 ft", doorHeight: "80 in" }, { do: "add_own_style", built_like: "LB", name: "Tall Loft Barn", sizes: { "10x16": 6490 } }, { do: "set_built", style: "LB1", wallHeight: "7 ft" }];
  const c = await D2.door({ action: "check", version: 1, edits });
  const sv = await D2.door({ action: "save", version: 1, edits, settingsSha256: c.data.settingsSha256 });
  const saved = (await D2.store.get("price-list")).settings;
  const hist = await D2.store.get("price-list-history/000002");
  const cat = resolveCatalogue(saved, manufacturer, library);
  ok("SB: set_built through the door: the Utility Shed's own wall and door height and a style of their own's wall, stored as numbers (old code: no such edit)",
    c.status === 200 && sv.status === 200 && sv.data.version === 2 && JSON.stringify(saved.offer.UT.built) === JSON.stringify({ wallHeight: 96, doorHeight: 80 })
    && JSON.stringify(saved.offer.LB1?.built) === JSON.stringify({ wallHeight: 84 }) && JSON.stringify(saved.construction) === "{}" && !("built" in saved), JSON.stringify([c.data, sv.data]).slice(0, 500));
  ok("SB: ... drawn as set: 8 ft walls on the Utility Shed, 7 ft on the Tall Loft Barn, the Loft Barn keeps the standard",
    Math.abs(cat.TYPES.UT.wallH * 12 - 96) < 1e-9 && Math.abs(cat.TYPES.LB1?.wallH * 12 - 84) < 1e-9 && Math.abs(cat.TYPES.LB.wallH * 12 - manufacturer.styles.LB.built.wallHeight) < 1e-9,
    JSON.stringify([cat.TYPES.UT.wallH, cat.TYPES.LB1?.wallH, cat.TYPES.LB.wallH]));
  ok("SB: ... the change words and History say what moved, a new style's own number too",
    JSON.stringify(sv.data.changes) === JSON.stringify(["Started selling the Tall Loft Barn (built like the Lofted Barn) in 1 size", "Utility Shed wall height: 7 ft 9 1/2 in → 8 ft", "Utility Shed wooden shop door height: 76 1/2 in → 80 in", "Tall Loft Barn wall height: 7 ft of its own"])
    && JSON.stringify(hist?.changes) === JSON.stringify(sv.data.changes), JSON.stringify([sv.data.changes, hist?.changes]));
  const back = await D2.door({ action: "check", version: 2, edits: [{ do: "set_built", style: "UT", wallHeight: "standard", doorHeight: "standard" }] });
  ok("SB: standard takes them out again, said with the standard's own numbers",
    back.status === 200 && JSON.stringify(back.data.changes) === JSON.stringify(["Utility Shed wall height: 8 ft → 7 ft 9 1/2 in", "Utility Shed wooden shop door height: 80 in → 76 1/2 in"]), JSON.stringify(back.data));
  /* a library style's own number reaches every style of theirs built like
     it with no number of its own: the words Alan says yes to, the History
     and the owner's log name them (review SEC-BUILT-4) */
  const R2 = await fixtureBusiness();
  const pr = await R2.ownerSave((x) => { x.offer.UT1 = { base: "UT", name: "Premium Utility", sizes: { "10x16": 6290 } }; x.offer.LB1 = { base: "LB", name: "Tall Loft Barn", sizes: { "10x16": 6490 }, built: { wallHeight: 84 } }; x.categories[0][1].push("UT1", "LB1"); });
  const reachEdits = [{ do: "set_built", style: "UT", wallHeight: "8 ft 6 in" }, { do: "set_built", style: "LB", wallHeight: "7 ft", barnHeights: { 10: "4 ft 2 in" } }];
  const rc = await R2.door({ action: "check", version: 2, edits: reachEdits });
  const rs = await R2.door({ action: "save", version: 2, edits: reachEdits, settingsSha256: rc.data.settingsSha256 });
  const rcat = resolveCatalogue((await R2.store.get("price-list")).settings, manufacturer, library);
  const reachWords = ["Utility Shed wall height: 7 ft 9 1/2 in → 8 ft 6 in (and Premium Utility, built like it)", "Loft Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in (and Tall Loft Barn, built like it)", "Loft Barn wall height: 6 ft 7 1/2 in → 7 ft"];
  ok("SB: set_built on a library style names each style of theirs built like it that the number reaches (old code: only the library style); one with its own number isn't named",
    pr.status === 200 && rc.status === 200 && rs.status === 200 && JSON.stringify(rc.data.changes) === JSON.stringify(reachWords)
    && JSON.stringify((await R2.store.get("price-list-history/000003"))?.changes) === JSON.stringify(reachWords)
    && Math.abs(rcat.TYPES.UT1.wallH * 12 - 102) < 1e-9 && Math.abs(rcat.TYPES.LB1.wallH * 12 - 84) < 1e-9, JSON.stringify([pr.data?.error, rc.data.changes]));

  /* the every-size result in the check answer: what it warns, and what it had no time for */
  /* (set_roof_pitch, set_built's short form, so the old code can be asked too) */
  const w = await D2.door({ action: "check", version: 2, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }] });
  const gw = (w.data.warnings || []).filter((x) => /^Utility Shed 12×20: even set as low as it goes, right under the peak, the 18×24 Gable Window's trim runs into the roof\./.test(x));
  ok("SB: the door's check answer carries the every-size check's warnings in plain words, counted (old code: warnings [])",
    w.status === 200 && gw.length === 1 && w.data.counts?.warnings === w.data.warnings?.length, JSON.stringify(w.data.warnings));
  const H2 = await fixtureBusiness(FX.edits.baseSettings, { sizeCheckMs: 0 });
  const hurried = await H2.door({ action: "check", version: 1, edits: [{ do: "set_built", style: "UT", wallHeight: "8 ft" }] });
  const later = (hurried.data.warnings || []).filter((x) => /^Not checked yet: \d+ sizes? of the Utility Shed\. To check the rest, tap Open their price list and press Check every size in that building's How it's built\.$/.test(x));
  const hs = await H2.door({ action: "save", version: 1, edits: [{ do: "set_built", style: "UT", wallHeight: "8 ft" }], settingsSha256: hurried.data.settingsSha256 });
  ok("SB: sizes the check had no time for are a warning that says where Alan checks the rest, and never stop the save",
    hurried.status === 200 && later.length === 1 && hs.status === 200 && hs.data.version === 2, JSON.stringify([hurried.data.warnings, hs.data]).slice(0, 500));
  const low = await D2.door({ action: "check", version: 2, edits: [{ do: "set_built", style: "UT", wallHeight: "5 ft" }] });
  ok("SB: what the every-size check finds refuses the change, in its own words (422 problems), nothing saved",
    low.status === 422 && low.data.code === "problems" && /^Utility Shed 12×20: the 72″ Wooden Double Doors on the front should be 80 in tall, but the wall leaves room for/.test(low.data.problems?.[0] || "")
    && (await D2.store.get("price-list")).version === 2, JSON.stringify(low.data).slice(0, 400));

  /* an extra of the owner's whose roof pitch only counts when steeper: a
     style's own pitch at least as steep makes it change nothing there, and
     a customer would pay for it all the same (review SEC-BUILT-2) */
  const W2 = await fixtureBusiness();
  const steep = await W2.ownerSave((x) => { x.options.extras.push({ key: "steep-roof", name: "Steep roof", input: "check", price: 350, built: { roofPitch: 7 }, styles: ["UT"] }); });
  const nothing = "Steep roof does not change the Utility Shed (its roof is already 8/12). A customer would pay for nothing there.";
  const w8 = await W2.door({ action: "check", version: 2, edits: [{ do: "set_built", style: "UT", roofPitch: "8/12" }] });
  const w6 = await W2.door({ action: "check", version: 2, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "6/12" }] });
  const w9 = await W2.door({ action: "check", version: 2, edits: [{ do: "set_roof_pitch", style: "UT", pitch: "9/12" }] });
  ok("SB: a style's own pitch that makes the owner's Steep roof change nothing on it is a warning in the owner's own words (old code: none); a flatter one isn't; the set_roof_pitch short form too",
    steep.status === 200 && w8.status === 200 && (w8.data.warnings || []).includes(nothing) && w8.data.counts?.warnings === w8.data.warnings.length
    && w6.status === 200 && !(w6.data.warnings || []).some((x) => /pay for nothing/.test(x))
    && w9.status === 200 && (w9.data.warnings || []).includes(nothing.replace("8/12", "9/12")), JSON.stringify([steep.status, w8.data.warnings, w6.data.warnings, w9.data.warnings]).slice(0, 700));
  const already = await W2.ownerSave((x) => { x.offer.UT.built = { roofPitch: 7 }; });
  const w8b = await W2.door({ action: "check", version: 3, edits: [{ do: "set_built", style: "UT", roofPitch: "8/12" }] });
  ok("SB: ... once the Steep roof changed nothing there already (the owner's own 7/12), steeper still isn't said again",
    already.status === 200 && w8b.status === 200 && !(w8b.data.warnings || []).some((x) => /pay for nothing/.test(x)), JSON.stringify([already.status, w8b.data.warnings]).slice(0, 400));

  /* while the owner's switch is on, the same (the lock lets a style's own numbers change in both modes) */
  const S2 = await fixtureBusiness();
  await S2.ownerSave((x) => { x.status = "active"; });
  await S2.call("POST", "/api/office/barnwright-help", { on: true, level: "change", reason: "New barn heights", hours: 4 }, { as: "pat" });
  const sw = await S2.door({ action: "check", version: (await S2.store.get("price-list")).version, edits: [{ do: "set_built", style: "LB", barnHeights: { 10: "4 ft 2 in" } }] });
  ok("SB: while the owner's switch is on, set_built still checks (a style's own numbers pass the lock in both modes)",
    (await S2.access()).mode === "switch" && sw.status === 200 && JSON.stringify(sw.data.changes) === JSON.stringify(["Loft Barn barn roof height at 10 ft wide: 4 ft → 4 ft 2 in"]), JSON.stringify(sw.data).slice(0, 300));

  /* set_roof_pitch is set_built's short form: the same settings */
  const a = applyEdits(base, [{ do: "set_roof_pitch", style: "UT", pitch: "7/12" }], opts), b = applyEdits(base, [{ do: "set_built", style: "UT", roofPitch: "7/12" }], opts);
  ok("SB: set_roof_pitch {UT, 7/12} and set_built {UT, roofPitch 7/12} leave the very same price list", a.problems.length === 0 && JSON.stringify(a.settings) === JSON.stringify(b.settings), JSON.stringify([a, b]).slice(0, 300));
  const quarter = applyEdits(base, [{ do: "set_built", style: "UT", roofPitch: "6 1/4/12" }], opts), dormer = applyEdits(base, [{ do: "sell_style", style: "DS", sizes: { "10x16": 6190 } }, { do: "set_built", style: "DS", roofPitch: "6/12" }], opts);
  ok("SB: set_built has How it's built's own limits, wider than set_roof_pitch's: quarter steps, and the Dormer Shed's own main roof",
    quarter.problems.length === 0 && quarter.settings?.offer.UT.built?.roofPitch === 6.25 && dormer.problems.length === 0 && dormer.settings?.offer.DS?.built?.roofPitch === 6, JSON.stringify([quarter.problems, dormer.problems]));
  const many = applyEdits(base, [{ do: "set_built", style: "LB", roofPitch: "6/12", porchDepth: "5 ft", wallHeight: "80 ft" }], opts);
  ok("SB: every part's problem in one edit is said at once", JSON.stringify(many.problems) === JSON.stringify(["Edit 1: The Loft Barn has a barn roof, so it has no roof pitch. Set its barn roof height instead. Wall height 80 ft is taller than 10 ft. The Loft Barn has no porch."]), JSON.stringify(many.problems));
  const odd = applyEdits(base, [{ do: "set_built", style: "UT", wallHeight: "8 ft\n" }, { do: "set_built", style: "UT", wall: "8 ft" }, { do: "set_built", style: "UT", wallHeight: ["8 ft"] }, { do: "set_built", style: "SC", porchDepth: "5 ft" }], opts);
  ok("SB: odd values are words, never a crash: a control character, an unknown part, a list for a single number, a style they don't sell",
    JSON.stringify(odd.problems) === JSON.stringify(["Edit 1: Wall height: write it the way a builder says it, like 7 ft 9 1/2 in, or standard.", "Edit 2: wall isn't part of set_built.", "Edit 3: Wall height: write it the way a builder says it, like 7 ft 9 1/2 in, or standard.", "Edit 4: They don't sell the Side Cabin. Sell it first (sell_style), then set how it's built."]), JSON.stringify(odd.problems));
  const hand = structuredClone(base);
  hand.construction = { openings: { doorHeightIn: 78 } };
  ok("SB: a number set up by hand some other way (a construction setting on its path) stays theirs, in words",
    JSON.stringify(applyEdits(hand, [{ do: "set_built", style: "UT", doorHeight: "80 in" }], opts).problems) === JSON.stringify(["Edit 1: Their wooden shop door height was set up another way, so it can't be changed here."])
    && applyEdits(hand, [{ do: "set_built", style: "UT", wallHeight: "8 ft" }], opts).problems.length === 0);
  const older = structuredClone(base);
  older.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 7 / 24 } }, { value: { w: library.roof.shapes.gable.rise.w } }] } } } };
  const lifted = applyEdits(older, [{ do: "set_built", style: "G", wallHeight: "8 ft" }], opts);
  ok("SB: on a price list from before, set_built moves the old roof pitch rule list into How it's built first (the Utility Shed keeps 7/12)",
    lifted.problems.length === 0 && lifted.settings?.offer.UT.built?.roofPitch === 7 && lifted.settings?.offer.G.built?.wallHeight === 96 && JSON.stringify(lifted.settings?.construction ?? {}) === "{}"
    && !!lifted.settings && lockProblems(older, lifted.settings, { door: true, manufacturer }).length === 0, JSON.stringify([lifted.problems, lifted.settings?.offer?.UT]));
}

section("RL. read library: each style's How it's built numbers now and the standard's, by set_built's names");
{
  const PARTS_BY_KNOB = { roofPitch: "roofPitch", barnPeak: "barnHeights", eaveOverhang: "eaveOverhang", gableEndOverhang: "gableOverhang", wallHeight: "wallHeight",
    doorHeight: "doorHeight", porchDepth: "porchDepth", sidePorchLengths: "sidePorchLength", dormerSide: "dormerSide" };
  const L = await fixtureBusiness();
  /* the owner sets How it's built for the whole business (6/12 gable roofs); Barnwright the Utility Shed's own walls */
  await L.ownerSave((x) => { x.built = { roofPitch: { gable: 6 } }; });
  const c = await L.door({ action: "check", version: 2, edits: [{ do: "set_built", style: "UT", wallHeight: "8 ft" }] });
  await L.door({ action: "save", version: 2, edits: [{ do: "set_built", style: "UT", wallHeight: "8 ft" }], settingsSha256: c.data.settingsSha256 });
  const r = await L.door({ action: "read", part: "library" });
  const styles = r.data.view?.styles || [];
  const row = (code, setting) => (styles.find((x) => x.code === code)?.built || []).find((b) => b.setting === setting);
  ok("RL: read library gives every library style its How it's built numbers, as set_built's parts (old code: none)",
    r.status === 200 && styles.length === Object.keys(manufacturer.styles).length && styles.every((x) => Array.isArray(x.built) && x.built.length >= 3
      && x.built.every((b) => Object.values(PARTS_BY_KNOB).includes(b.setting) && typeof b.name === "string" && typeof b.now === "string" && b.now && typeof b.standard === "string" && b.standard && typeof b.from === "string")),
    JSON.stringify(styles.slice(0, 2)).slice(0, 400));
  ok("RL: ... only the numbers that apply: a barn roof's heights and no pitch, a gable roof's pitch and no barn heights, porches and the dormer where there are",
    row("LB", "barnHeights") && !row("LB", "roofPitch") && row("UT", "roofPitch") && !row("UT", "barnHeights") && !row("UT", "porchDepth")
    && row("SC", "porchDepth") && row("SC", "sidePorchLength") && row("DS", "dormerSide") && !row("CS", "roofPitch"), JSON.stringify([row("LB", "roofPitch"), row("UT", "barnHeights")]));
  ok("RL: ... now and standard in a builder's words, and where now comes from: the Utility Shed's own 8 ft walls (standard 7 ft 9 1/2 in), the whole business's 6/12 (standard 5/12)",
    JSON.stringify(row("UT", "wallHeight")) === JSON.stringify({ setting: "wallHeight", name: "Wall height", now: "8 ft", standard: "7 ft 9 1/2 in", from: "their own number for this style" })
    && JSON.stringify(row("UT", "roofPitch")) === JSON.stringify({ setting: "roofPitch", name: "Roof pitch", now: "6/12", standard: "5/12", from: "their number for the whole business" })
    && JSON.stringify(row("G", "wallHeight")) === JSON.stringify({ setting: "wallHeight", name: "Wall height", now: "7 ft 9 1/2 in", standard: "7 ft 9 1/2 in", from: "standard" }),
    JSON.stringify([row("UT", "wallHeight"), row("UT", "roofPitch"), row("G", "wallHeight")]));
  ok("RL: ... a style they don't sell as it would be if they sold it (the whole business's 6/12 reaches the Side Utility), the Dormer Shed's own main roof kept",
    row("SU", "roofPitch")?.now === "6/12" && row("SU", "roofPitch")?.standard === "5/12" && styles.find((x) => x.code === "SU")?.sold === false
    && row("DS", "roofPitch")?.now === "7/12" && row("DS", "roofPitch")?.from === "standard", JSON.stringify([row("SU", "roofPitch"), row("DS", "roofPitch")]));
  ok("RL: ... the shop standard's own numbers: the Loft Barn's barn roof 3 ft 7 3/4 in, 4 ft and 4 ft 3 in at 8, 10 and 12 ft wide, its 6 ft 7 1/2 in walls, a 71 1/2 in barn door",
    /8 ft wide: 3 ft 7 3\/4 in, 10 ft wide: 4 ft, 12 ft wide: 4 ft 3 in/.test(row("LB", "barnHeights")?.standard || "") && row("LB", "wallHeight")?.standard === formatBuilt("wallHeight", manufacturer.styles.LB.built.wallHeight)
    && row("LB", "doorHeight")?.standard === "71 1/2 in", JSON.stringify([row("LB", "barnHeights"), row("LB", "wallHeight"), row("LB", "doorHeight")]));
  /* the same numbers the owner's How it's built screen shows (effective()), for every style they sell */
  const saved = (await L.store.get("price-list")).settings;
  const cat = resolveCatalogue(saved, manufacturer, library);
  const differ = [];
  for (const k of Object.keys(saved.offer)) {
    if (!manufacturer.styles[k]) continue;
    for (const e of effective(cat, k)) if (row(k, PARTS_BY_KNOB[e.id])?.now !== e.words) differ.push(`${k} ${e.id}: ${row(k, PARTS_BY_KNOB[e.id])?.now} / ${e.words}`);
  }
  ok("RL: ... now is what the owner's own How it's built screen says for each style they sell, number for number", differ.length === 0, differ.join("; "));
  const B0 = await signupBusiness();
  const libBody = { action: "read", part: "library" };
  const r0 = await B0.door(libBody, { pass: B0.room.setupPass({ action: "read", body: JSON.stringify(libBody), actor: ACTOR, signup: BS.signup }) });
  ok("RL: before a price list exists (version 0), read library gives the starting price list's numbers too",
    r0.status === 200 && (r0.data.view?.styles || []).every((x) => Array.isArray(x.built) && x.built.length >= 3), JSON.stringify(r0.data).slice(0, 300));
}

console.log("");
if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${passed + failed.length} setup access checks failed.`);
  process.exit(1);
}
console.log(`PROVED (${passed} checks): Barnwright can change a price list only after terms 2.2, before live or while the owner's switch is on, and stop, switch off and going live end it on the very next request; live is the first opening or the first real quote or order, written before the change, and the look back for older businesses fails closed and never runs in the check-in or GET me; the visit is a __Host- cookie from a one-use pass, on its own routes, sliding up to 8 hours, and never reaches customers, the team, Help or the owner's card; the lock refuses status, embed, where quotes go, the license, the credit, the construction settings, what a style of their own is built like, How it's built for the whole business, an extra that changes how a building is built and a web address logo, and putting back carries them forward, checked like a save, while a building style's own How it's built numbers pass to the owner's own checks and the every-size check (set_roof_pitch writes the style's roof pitch there, and an older rule list reads as the pitch it draws); a copy is always kept first; who saved is said by role; no clock time is stored in words; only the owner flips the one Barnwright card; a check-in whose report fails or is slow still renews the lease; the preview shows a closed 3D designer to the team only; every edit gives the fixtures' change words, warnings and exact settings, and a gable pitch draws as set; set_built writes a building style's own How it's built numbers from a builder's words, only those that apply, checked with How it's built's limits and the every-size check, whose warnings and unchecked sizes come back with the check; read part library gives every library style's numbers now and the standard's; the door takes only a one-use pass made for its exact body from the Control Room's server, reads in parts with no contact details, refuses what the owner's own save refuses, saves exactly what was checked with a copy kept first, saves for Claude only before live, and undoes only Barnwright's last change.`);
