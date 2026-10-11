/* TEST FIXTURES FOR BARNWRIGHT SETUP ACCESS (docs/OFFICE.md, "Barnwright
   setup access"). TEST ONLY: nothing here is real or trusted anywhere.

   Run:
     node tools/lib/make-setup-fixtures.mjs           writes tools/lib/setup-fixtures.json
     node tools/lib/make-setup-fixtures.mjs --check   proves the file is what this script
                                                      makes, and that every pass in it is
                                                      kept or refused by the contract's rule
     node tools/lib/make-setup-fixtures.mjs --new-key a new test key pair (every pass changes)

   WHAT IT MAKES. One JSON file that the Dealer Center checks (lane A) and the
   Control Room's tests (lanes B and D) both read, so both ends build against
   the same examples:
     * a test-only ECDSA P-256 key pair (and a second "wrong" one);
     * a good pass for each action, and passes that must be refused, each
       with the reason;
     * one example request and answer for every door action and every refusal,
       for the visit routes, the owner's routes and the check-in;
     * the base price list (First setup with the small starting price list)
       and sample edits with the change words they must give.

   The change words come from the Dealer Center's own describeChanges, so
   they are exactly what it writes today. Two kinds of words are new and
   written here by hand: the roof pitch line and the undo line (marked
   "newWords"), and every warning.

   Signatures: ECDSA signatures differ every time they are made, so a
   signature already in the file is kept when it still checks out. Running
   the script twice gives the same file. */

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readJSON, ROOT } from "./load.mjs";
import { createPriceList, describeChanges, priceFingerprint } from "../../server/office/price-list.js";
import { MemoryBlobs, wrapStore } from "../../server/office/store.js";
import { canonicalLease, LEASE_DURATION_MS } from "../../server/office/license-core.js";

const OUT = resolve(ROOT, "tools/lib/setup-fixtures.json");

/* ---- the contract's numbers (docs/OFFICE.md) -------------------------------------- */

export const SETUP_PASS_PREFIX = "barnwright-setup-pass/v1.";
export const PASS_MS = 120_000;            /* the Control Room issues passes good for 2 minutes */
export const MAX_WINDOW_MS = 300_000;      /* the Dealer Center refuses a longer window */
export const MAX_SKEW_MS = 60_000;         /* issuedAt at most this far ahead (license-core.js MAX_FUTURE_SKEW_MS) */
export const MAX_PASS_LENGTH = 8000;
export const ACTIONS = ["status", "read", "check", "save", "undo", "session"];
export const DOOR_ACTIONS = ["status", "read", "check", "save", "undo"];
export const VIA = ["control-room", "claude"];
export const PARTS = ["summary", "buildings", "doors_windows", "options", "colors", "prices_and_quotes", "library"];
export const DOOR_MAX_BYTES = 64 * 1024;
export const GABLE_STYLES = ["UT", "SU", "GU", "C", "SC", "DSC", "G", "MU", "MG", "DK"];

const NOW = Date.UTC(2026, 9, 11, 15, 0, 0);
const iso = (ms) => new Date(ms).toISOString();
const SET_UP_AT = iso(NOW - 3600_000);
const DEALER = { customerId: "cust_testing", siteId: "site-testing-1", siteUrl: "https://testing.barnwrightsoftware.com", business: "Testing Sheds" };
const ACTOR = "alan@barnwright.test";
const BARNWRIGHT = `Barnwright (${ACTOR})`;
const APP_VERSION = "dealer-center test";
const DOOR_URL = DEALER.siteUrl + "/.netlify/functions/barnwright-setup";

/* ---- the contract's words ------------------------------------------------------------ */

const money = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const listWords = (a) => (a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

export const WHY = {
  "not-connected": "This Dealer Center isn't connected to Barnwright.",
  "no-price-list": "The owner hasn't finished First setup yet, so there is no price list to change.",
  terms: "The owner hasn't agreed to the Barnwright Terms and Conditions 2.2 yet. They see the button at the top of their Dealer Center.",
  stopped: "The owner stopped Barnwright's setup access in Settings, Barnwright.",
  "live-off": "Their 3D designer is open to customers, so you need the owner's switch. Ask the owner to turn on Run checks and change my price list and settings in Settings, Barnwright.",
};
/* why "terms" while this Dealer Center's own terms are older than 2.2 (termsOut: false): no owner can agree yet */
export const TERMS_NOT_OUT = "Barnwright's new terms (2.2) aren't out yet, so Barnwright can only run checks for now.";

export const REFUSALS = {
  method: { status: 405, error: "Use POST." },
  "bad-request": { status: 400, error: "The Control Room sent a request this Dealer Center can't read." },
  "too-big": { status: 413, error: "That request is too big. Send at most 64 KB." },
  pass: { status: 401, error: "The pass for this request isn't valid. Try again from the Control Room." },
  "pass-used": { status: 410, error: "This pass was already used. Each request needs a new pass." },
  closed: { status: 403, error: "(the words for why: see why)" },
  "needs-alan": { status: 403, error: "Their 3D designer is open, so this change has to be made from your Control Room's Make the change page." },
  "not-connected": { status: 404, error: WHY["not-connected"] },
  version: { status: 409, error: "The price list was saved since you read it. Read it again, then check the change again." },
  changed: { status: 409, error: "The result isn't the one you checked. Check the change again." },
  "cant-undo": { status: 409, error: "The owner saved the price list after your change, so undo would take theirs away too. The owner can put back an earlier price list in Price list, History." },
  problems: { status: 422, error: "(the problems, joined: see problems)" },
  "account-off": { status: 423, error: "Their Dealer Center can't save changes right now: its Barnwright account is off or hasn't checked in for 7 days. Reading still works." },
  "too-many": { status: 429, error: "Too many Barnwright requests for this Dealer Center this hour. Try again later." },
  "no-copy": { status: 503, error: "Couldn't keep a copy of the current price list first, so nothing was changed. Try again." },
  error: { status: 503, error: "Something went wrong on their Dealer Center. Try again in a minute." },
};
const NOTHING_TO_UNDO = "Barnwright hasn't changed this price list, so there is nothing to undo.";
const TOO_MANY_SAVES = "Barnwright has saved 60 changes here today. Try again tomorrow.";

export const VISIT_WORDS = {
  linkRanOut: "This link ran out. Tap Open their price list again.",
  ended: "Your Barnwright visit ended. In your Control Room tap Open their price list, then come back and tap Save.",
  closed: "Your Barnwright visit ended. <the words for why> Your changes are kept in this tab.",
  bar: "Working on <business> as Barnwright until <time>.",
  preview: "Preview. Your customers can't see this until you open it in Settings.",
};

export const LOCK = {
  status: "Only the owner can open or close the 3D designer to customers.",
  id: "This price list belongs to a different business. Reload the page and try again.",
  manufacturer: "The builder's library cannot change here.",
  license: "The 3D designer's license settings can't be changed by Barnwright.",
  embed: "Only the owner can change which websites may show the 3D designer.",
  leads: "Only the owner can change where quotes go.",
  credit: "The 3D designer credit line can't be changed by Barnwright.",
  construction: "How the buildings are built can't be changed here, except a gable roof's pitch.",
  logoAddress: "The logo must be a picture uploaded in Settings, Logo, not a web address.",
  logoBig: "The logo is too big. Use a picture of 150 KB or less.",
  contact: "While their 3D designer is open, the business phone, email and website can be changed only by the owner, or by Alan by hand in Open their price list.",
};

export const WARN = {
  contact: (which) => `This changes the business ${listWords(which)} that customers see. Check it with the owner.`,
  contactInText: (where, kinds) => (/ words$/.test(where) ? `${where} have ${listWords(kinds)} in them. Customers read them, so check they are right.` : `${where} has ${listWords(kinds)} in it. Customers read it, so check it is right.`),
  rtoMoved: (months, was, now) => `The rent-to-own factor for ${months} months moves ${Math.round((Math.abs(now - was) / was) * 100)}%: ${was} → ${now}.`,
  cheaper: (style, big, bigPrice, small, smallPrice) => `${style} ${big} (${money(bigPrice)}) costs less than the smaller ${small} (${money(smallPrice)}).`,
  moved: (what, was, now) => `${what} moves ${Math.round((Math.abs(now - was) / was) * 100)}%: ${money(was)} → ${money(now)}.`,
  low: (style, size, price) => `${style} ${size} at ${money(price)} is under $500.`,
  high: (style, size, price) => `${style} ${size} at ${money(price)} is over $100,000.`,
  samePrice: (style, price) => `Every size of the ${style} is ${money(price)}.`,
  many: (n, total) => `This changes ${n} of ${total} building prices.`,
  stopped: (names) => `This stops selling ${names.length} building styles: ${names.join(", ")}.`,
};
const WARN_TEXT = {
  contact: "This changes the business <phone, email and website> that customers see. Check it with the owner.",
  contactInText: "<Where> has <a web address, an email address and a phone number> in it. Customers read it, so check it is right.",
  cheaper: "<Style> <bigger size> (<price>) costs less than the smaller <size> (<price>).",
  moved: "<Style> <size> (or the door, window, option or extra) moves <n>%: <old price> → <new price>.",
  rtoMoved: "The rent-to-own factor for <months> months moves <n>%: <old factor> → <new factor>.",
  low: "<Style> <size> at <price> is under $500.",
  high: "<Style> <size> at <price> is over $100,000.",
  samePrice: "Every size of the <style> is <price>.",
  many: "This changes <n> of <total> building prices.",
  stopped: "This stops selling <n> building styles: <names>.",
};

/* The owner's log line for a Barnwright save: the first 3 change lines and a count. */
export const logChanged = (lines) => `${BARNWRIGHT} changed your price list: ${lines.slice(0, 3).join("; ")}${lines.length > 3 ? `, and ${lines.length - 3} more` : ""}.`;
/* Settings, Barnwright: the owner's one card, the banner and the confirm line (times shown by the browser). */
export const OWNER_WORDS = {
  card: "Barnwright",
  beforeLive: "Barnwright is setting up your 3D designer. Until you open it to customers, they can change your price list and settings for you. Every change is listed here and in Price list, History.",
  stop: "Stop Barnwright's setup access",
  allowAgain: "Let Barnwright set it up again",
  levels: ["Run checks", "Run checks and change my price list and settings"],
  hours: [1, 4, 8, 24],
  onChange: "Barnwright can change your price list and settings until <time>.",
  onChecks: "Barnwright can run checks until <time>.",
  turnOffNow: "Turn off now",
  termsFirst: "Agree to the new terms at the top of the page first.",
  termsFirstRefusal: "Agree to the new Barnwright Terms and Conditions at the top of the page first.",
  afterLivePrelive: "Your 3D designer is open, so use Run checks and change my price list and settings instead.",
  notReached: "Barnwright couldn't be reached just now, so checks are off. Barnwright can change your price list and settings.",
  bannerSwitch: "Barnwright can change your price list and settings until <time>.",
  bannerTurnOff: "Turn off",
  bannerPrelive: "Barnwright is setting up your prices. Look at the preview, check it with Alan, then open it to customers in Settings.",
  openConfirm: "Opening ends Barnwright's setup access. After this, Barnwright needs your switch to change your prices.",
  helpAnswer: "Let Barnwright change your prices",
};
/* The owner's log ({at, words, until?}). */
export const LOG_WORDS = {
  changed: "Barnwright (<actor>) changed your price list: <the first 3 change lines, joined with ; >, and <n> more.",
  undone: "Barnwright (<actor>) put back the price list from before its last change.",
  visit: "Barnwright (<actor>) opened your price list.",
  looked: "Barnwright looked at your price list.",
  checksOn: "<Owner> let Barnwright run checks for <n> hours: <reason>",
  changeOn: "<Owner> let Barnwright run checks and change the price list and settings for <n> hours: <reason>",
  off: "<Owner> turned off Barnwright's access.",
  offChecks: "<Owner> turned off Barnwright's checks. (before live: setup access goes on)",
  stopped: "<Owner> stopped Barnwright's setup access.",
  allowed: "<Owner> let Barnwright set up the price list again.",
  liveOpened: "Barnwright's setup access ended when you opened your 3D designer to customers.",
  liveQuote: "Barnwright's setup access ended when your first quote was saved.",
};
const UNDO_LINE = "Put back the price list from before Barnwright's last change";
const pitchLine = (style, from, to) => `${style} and every building built like it: roof pitch ${from} → ${to}`;
const STANDARD_PITCH = "6.5/12 (standard)";

/* ---- keys and signing ------------------------------------------------------------------ */

const args = new Set(process.argv.slice(2));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const b64 = (text) => Buffer.from(text).toString("base64url");

function readOld() {
  try { return JSON.parse(readFileSync(OUT, "utf8")); } catch { return null; }
}

function keyPair(saved) {
  if (saved?.privateKeyJwk) {
    const priv = createPrivateKey({ key: saved.privateKeyJwk, format: "jwk" });
    return { priv, pub: createPublicKey(priv) };
  }
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { priv: privateKey, pub: publicKey };
}

function keyJson(k, label) {
  const jwk = k.priv.export({ format: "jwk" });
  return { _label: label, publicKeyPem: k.pub.export({ type: "spki", format: "pem" }), privateKeyJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d } };
}

/* -> {make(), check()} for one run, keeping the old file's signatures that still verify. */
function signer(old) {
  const TEST = keyPair(args.has("--new-key") ? null : old?.testKey);
  const OTHER = keyPair(args.has("--new-key") ? null : old?.otherKey);
  const kept = new Map();
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    const bearer = typeof v === "string" && /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(v);
    if (bearer) kept.set(`${SETUP_PASS_PREFIX}${bearer[1]}|ieee-p1363`, bearer[2]);
    if (!v || typeof v !== "object") return;
    if (typeof v.signed === "string" && typeof v.pass === "string") kept.set(`${v.signed}|${v.encoding || "ieee-p1363"}`, v.pass.split(".").pop());
    Object.values(v).forEach(walk);
  })(args.has("--new-key") ? null : old);
  function signText(text, key = TEST, encoding = "ieee-p1363") {
    const prior = kept.get(`${text}|${encoding}`);
    if (prior && verify("sha256", Buffer.from(text), { key: key.pub, dsaEncoding: encoding }, Buffer.from(prior, "base64url"))) return prior;
    return sign("sha256", Buffer.from(text), { key: key.priv, dsaEncoding: encoding }).toString("base64url");
  }
  return { TEST, OTHER, signText };
}

const passId = (name) => createHash("sha256").update("setup-fixture:" + name).digest().subarray(0, 16).toString("base64url");

function claimsFor(name, action, body, over = {}) {
  return {
    v: 1, purpose: "setup-pass", id: passId(name), customerId: DEALER.customerId, siteId: DEALER.siteId,
    actor: ACTOR, via: "control-room", action, bodySha256: sha256(body), issuedAt: NOW, expiresAt: NOW + PASS_MS, ...over,
  };
}

/* ---- the rule the Dealer Center uses (and the Control Room's own verifySetupPass) ---------- */

/* -> the claims, or throws an Error whose .reason says why (the door answers 401 "pass" for
   every reason; the reason is for the checks and the log only). bodyBytes: the exact request
   body (a Buffer or a string). action: the request's action (body.action, or "session"). */
export function checkSetupPass(token, { publicKeyPem, customerId, siteId, action, bodyBytes, now }) {
  const no = (reason) => { throw Object.assign(new Error("Setup pass refused: " + reason), { reason }); };
  if (typeof token !== "string" || !token || token.length > MAX_PASS_LENGTH || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) no("shape");
  const [head, sig] = token.split(".");
  const signature = Buffer.from(sig, "base64url");
  if (signature.length !== 64) no("signature");
  let key;
  try { key = createPublicKey(publicKeyPem); } catch { no("key"); }
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") no("key");
  if (!verify("sha256", Buffer.from(SETUP_PASS_PREFIX + head), { key, dsaEncoding: "ieee-p1363" }, signature)) no("signature");
  let c;
  try { c = JSON.parse(Buffer.from(head, "base64url").toString("utf8")); } catch { no("claims"); }
  if (!c || typeof c !== "object" || Array.isArray(c) || c.v !== 1 || c.purpose !== "setup-pass") no("claims");
  if (typeof c.id !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(c.id)) no("claims");
  if (typeof c.actor !== "string" || !c.actor.trim() || c.actor.length > 200 || /[\u0000-\u001f\u007f]/.test(c.actor)) no("claims");
  if (!VIA.includes(c.via) || !ACTIONS.includes(c.action)) no("claims");
  if (c.customerId !== customerId || c.siteId !== siteId) no("business");
  if (!Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) || c.expiresAt <= c.issuedAt) no("time");
  if (c.expiresAt - c.issuedAt > MAX_WINDOW_MS || c.issuedAt > now + MAX_SKEW_MS) no("time");
  if (c.expiresAt <= now) no("expired");
  if (c.action !== action) no("action");
  if (typeof c.bodySha256 !== "string" || c.bodySha256 !== sha256(bodyBytes)) no("body");
  return c;
}

/* ---- the base price list: First setup with the small starting price list ------------------ */

const M = readJSON("library/manufacturers/standard.json");
const LIB = readJSON("library/construction.json");

async function basePriceList() {
  const store = wrapStore(new MemoryBlobs());
  const pl = createPriceList({
    store, manufacturer: M, library: LIB, now: () => new Date(SET_UP_AT),
    templates: { full: readJSON("companies/demo/company.json"), small: readJSON("companies/starter/company.json") },
  });
  const record = await pl.setup({ userId: "u_owner", email: "pat@testingsheds.example", name: "Pat Owner" },
    { businessName: DEALER.business, phone: "941-555-0100", email: "office@testingsheds.example", website: "https://testingsheds.example", start: "small" });
  return { pl, record };
}

/* ---- the readable parts (setup-view.js builds these) -------------------------------------- */

const keysOf = (o) => Object.keys(o || {}).filter((k) => !k.startsWith("_"));
const baseOf = (s, k) => s.offer?.[k]?.base || k;
const styleName = (s, k) => s.offer?.[k]?.name || M.styles?.[baseOf(s, k)]?.name || k;
const priceOf = (v) => (v && typeof v === "object" ? v.price : v);
function itemName(s, k) { const v = s.items?.[k]; return (v && typeof v === "object" && v.name) || M.items?.[k]?.name || k; }
function optionName(s, g, k) {
  const v = s.options?.[g]?.[k];
  if (v && typeof v === "object" && v.name) return v.name;
  const def = M.options?.[g]?.[k];
  if (g === "elec") return `Electrical package ${def?.name?.replace(/^Option /, "") || k}`;
  return def?.name || k;
}
const logoOf = (logo) => ({ present: !!logo, kb: logo ? Math.ceil(logo.length / 1024) : 0 });
function pitchOf(s, code) {
  if (M.styles?.[code]?.roof !== "gable" || M.styles?.[code]?.dormer) return null;
  const rise = s.construction?.roof?.shapes?.gable?.rise;
  if (!Array.isArray(rise)) return "standard";
  const rule = rise.find((r) => r.when?.styles?.length === 1 && r.when.styles[0] === code);
  return rule ? `${Math.round(rule.value.w * 24)}/12` : "standard";
}
function groupsOf(s) {
  if (Array.isArray(s.categories)) return s.categories.map(([name, ks]) => ({ name, styles: ks.filter((k) => k in (s.offer || {})) }));
  const out = [];
  for (const k of keysOf(s.offer)) {
    const name = M.styles?.[baseOf(s, k)]?.category || "Buildings";
    let g = out.find((x) => x.name === name);
    if (!g) out.push(g = { name, styles: [] });
    g.styles.push(k);
  }
  return out;
}
const soldInOrder = (s) => groupsOf(s).flatMap((g) => g.styles);
const business = (s) => ({
  name: s.brand.name, short: s.brand.short || s.brand.name, tagline: s.brand.tagline || "",
  hasPhone: !!s.brand.phone, hasEmail: !!s.brand.email, hasWebsite: !!s.brand.website, logo: logoOf(s.brand.logo),
});
function colorList(s, g) {
  const lib = Object.fromEntries((M.palettes?.[g] || []).map((c) => [c[0], c[1]]));
  const list = s.palettes?.[g] || M.palettes?.[g] || [];
  return list.map((e) => (Array.isArray(e) ? { name: e[0], hex: e[1], own: true } : { name: e, hex: lib[e] || null, own: false }));
}
function optionList(s, g) {
  return keysOf(s.options?.[g]).map((k) => ({
    key: k, name: optionName(s, g, k), price: priceOf(s.options[g][k]),
    ...(g === "rates" ? { per: `sq ft of ${{ floor: "floor", wall: "wall", roof: "roof" }[M.options.rates[k]?.basis] || "floor"}` } : {}),
  }));
}

export function view(s, part) {
  switch (part) {
    case "summary": return {
      business: business(s),
      styles: soldInOrder(s).map((k) => ({ code: k, name: styleName(s, k), sizes: keysOf(s.offer[k].sizes).length, from: Math.min(...Object.values(s.offer[k].sizes)) })),
      counts: {
        styles: keysOf(s.offer).length,
        sizes: keysOf(s.offer).reduce((n, k) => n + keysOf(s.offer[k].sizes).length, 0),
        items: keysOf(s.items).length,
        options: ["dormers", "ramps", "elec", "misc", "rates"].reduce((n, g) => n + keysOf(s.options?.[g]).length, 0),
        extras: (s.options?.extras || []).length,
      },
      colors: Object.fromEntries(["paint", "trim", "metal"].map((g) => [g, colorList(s, g).length])),
      show: s.pricing?.show || "price",
      rentToOwn: !!s.pricing?.rto,
      open: s.status !== "suspended",
    };
    case "buildings": return {
      groups: groupsOf(s),
      styles: soldInOrder(s).map((k) => ({
        code: k, name: styleName(s, k), builtLike: s.offer[k].base || null, roof: M.styles?.[baseOf(s, k)]?.roof || null,
        pitch: pitchOf(s, baseOf(s, k)), sizes: s.offer[k].sizes,
      })),
      opensOn: { style: s.defaults?.style || null, size: s.defaults?.size || null },
    };
    case "doors_windows": return { items: keysOf(s.items).map((k) => ({ code: k, name: itemName(s, k), price: priceOf(s.items[k]) })) };
    case "options": return {
      ...Object.fromEntries(["dormers", "ramps", "elec", "misc", "rates"].map((g) => [g, optionList(s, g)])),
      extras: (s.options?.extras || []).map((x) => ({ key: x.key, name: x.name, charged: x.input, price: x.price })),
    };
    case "colors": return {
      ...Object.fromEntries(["paint", "trim", "metal"].map((g) => [g, colorList(s, g)])),
      opensOn: { body: s.defaults?.colors?.body || null, trim: s.defaults?.colors?.trim || null, roof: s.defaults?.colors?.roof || null },
    };
    case "prices_and_quotes": {
      const rto = s.pricing?.rto;
      return {
        show: s.pricing?.show || "price",
        finePrint: s.notes?.finePrint || "",
        sizeNotes: s.notes?.sizeNotes || {},
        rentToOwn: rto ? { terms: keysOf(rto.factors).map((m) => ({ months: Number(m), factor: rto.factors[m] })), showTerm: rto.showTerm ?? null, note: rto.note ?? null } : null,
        quoteForm: { fields: s.leads?.fields || {}, askPlan: s.leads?.askPlan !== false, smsConsent: s.leads?.smsConsent ?? null },
        business: { ...business(s), initials: s.brand.initials || "", colors: s.brand.colors || {} },
      };
    }
    case "library": return {
      styles: keysOf(M.styles).map((k) => ({ code: k, name: M.styles[k].name, roof: M.styles[k].roof, group: M.styles[k].category || "Buildings", sold: k in s.offer })),
      items: keysOf(M.items).map((k) => ({ code: k, name: M.items[k].name, sold: k in (s.items || {}) })),
      options: Object.fromEntries(["dormers", "ramps", "elec", "misc", "rates"].map((g) => [g, keysOf(M.options?.[g]).map((k) => ({ key: k, name: optionName({}, g, k) }))])),
      colors: Object.fromEntries(["paint", "trim", "metal"].map((g) => [g, (M.palettes?.[g] || []).map((c) => ({ name: c[0], hex: c[1] }))])),
      gableStyles: GABLE_STYLES,
    };
    default: throw new Error("No part " + part);
  }
}

/* ---- edits, applied by hand for the samples ------------------------------------------------ */

function settle(base, next) {
  next.cfg = priceFingerprint(next) === priceFingerprint(base) ? base.cfg : (base.cfg || 1) + 1;
  return next;
}
const sizeWords = (z) => z.replace("x", "×");

function sampleSet(base, pl) {
  const out = [];
  /* ok: {name, edits, mode?, apply(s), warnings?, paths?, newCodes?, newWords?(before, after)} */
  function ok(name, edits, apply, more = {}) {
    const after = structuredClone(base);
    apply(after);
    settle(base, after);
    pl.check(after);                                  /* throws when the sample would not save */
    const changes = more.changes || describeChanges(base, after, M, { contact: "new" });
    const paths = {};
    for (const p of more.paths || []) paths[p] = p.split(".").reduce((v, k) => (v == null ? undefined : v[k]), after);
    const contact = ["phone", "email", "website"].some((k) => (base.brand[k] || "") !== (after.brand[k] || ""));
    out.push({
      name, mode: more.mode || "prelive", edits,
      expect: {
        ok: true, changes, warnings: more.warnings || [], contactDetailsChange: contact, newCodes: more.newCodes || {},
        ...(more.newWords ? { newWords: true } : {}), paths, settingsSha256: sha256(JSON.stringify(after)),
      },
    });
  }
  function refused(name, edits, problems, more = {}) {
    out.push({ name, mode: more.mode || "prelive", edits, expect: { ok: false, code: "problems", problems } });
  }
  const sizes = (s, k) => s.offer[k].sizes;
  const sortSizes = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => {
    const [aw, al] = a.split("x").map(Number), [bw, bl] = b.split("x").map(Number);
    return aw - bw || al - bl;
  }));

  /* buildings */
  ok("set_price: a new price for a size they sell", [{ do: "set_price", style: "LB", size: "10x16", price: 5700 }],
    (s) => { sizes(s, "LB")["10x16"] = 5700; }, { paths: ["offer.LB.sizes.10x16"] });
  ok("set_price: a size they don't sell yet is added, in width then length order", [{ do: "set_price", style: "UT", size: "10x20", price: 6290 }],
    (s) => { s.offer.UT.sizes = sortSizes({ ...sizes(s, "UT"), "10x20": 6290 }); }, { paths: ["offer.UT.sizes"] });
  ok("remove_size", [{ do: "remove_size", style: "LB", size: "14x32" }],
    (s) => { delete sizes(s, "LB")["14x32"]; }, { paths: ["offer.LB.sizes"] });
  ok("sell_style: a library style they don't sell, into a group by name", [{ do: "sell_style", style: "GU", group: "Sheds", sizes: { "8x10": 2990, "8x12": 3290 } }],
    (s) => { s.offer.GU = { sizes: { "8x10": 2990, "8x12": 3290 } }; s.categories[0][1].push("GU"); }, { paths: ["offer.GU", "categories"] });
  ok("sell_style: a style they sell gets its whole size list replaced, in the order given", [{ do: "sell_style", style: "G", sizes: { "12x20": 8190, "12x24": 9690, "14x28": 13990, "14x32": 15490 } }],
    (s) => { s.offer.G.sizes = { "12x20": 8190, "12x24": 9690, "14x28": 13990, "14x32": 15490 }; }, { paths: ["offer.G.sizes"] });
  ok("add_own_style: the Dealer Center picks the code and places it after the style it is built like", [{ do: "add_own_style", built_like: "LB", name: "Premium Loft Barn", sizes: { "10x16": 6290, "12x24": 10490 } }],
    (s) => { s.offer.LB1 = { base: "LB", name: "Premium Loft Barn", sizes: { "10x16": 6290, "12x24": 10490 } }; s.categories[0][1].push("LB1"); },
    { paths: ["offer.LB1", "categories"], newCodes: { "Premium Loft Barn": "LB1" } });
  ok("stop_selling_style: an empty group is dropped", [{ do: "stop_selling_style", style: "G" }],
    (s) => { delete s.offer.G; s.categories = s.categories.filter((g) => g[0] !== "Garages"); }, { paths: ["categories"] });
  ok("rename_style", [{ do: "rename_style", style: "UT", name: "Classic Utility Shed" }],
    (s) => { s.offer.UT.name = "Classic Utility Shed"; }, { paths: ["offer.UT.name"] });
  ok("change_prices: the owner's Change prices rule (nearest $5)", [{ do: "change_prices", scope: { style: "G" }, by_percent: 3, round_to: 5 }],
    (s) => { for (const z of keysOf(sizes(s, "G"))) sizes(s, "G")[z] = Math.round((sizes(s, "G")[z] * 1.03) / 5) * 5; }, { paths: ["offer.G.sizes"] });
  ok("set_roof_pitch: one gable style, every building built like it too", [{ do: "set_roof_pitch", style: "UT", pitch: "5/12" }],
    (s) => { s.construction = { roof: { shapes: { gable: { rise: [{ when: { styles: ["UT"] }, value: { w: 5 / 24 } }, { value: { w: LIB.roof.shapes.gable.rise.w } }] } } } }; },
    { paths: ["construction"], changes: [pitchLine("Utility Shed", STANDARD_PITCH, "5/12")], newWords: true });

  /* doors and windows, options, colors */
  ok("set_item: a new price", [{ do: "set_item", item: "w48", price: 175 }], (s) => { s.items.w48 = 175; }, { paths: ["items.w48"] });
  ok("set_item: start selling one, with a name of their own", [{ do: "set_item", item: "oct", price: 120, name: "Round Gable Window" }],
    (s) => { s.items.oct = { price: 120, name: "Round Gable Window" }; }, { paths: ["items.oct"] });
  ok("stop_selling_item", [{ do: "stop_selling_item", item: "tr" }], (s) => { delete s.items.tr; }, { paths: ["items.tr"] });
  ok("set_option: a new price", [{ do: "set_option", group: "ramps", key: "r4", price: 275 }], (s) => { s.options.ramps.r4 = 275; }, { paths: ["options.ramps.r4"] });
  ok("set_option: start offering one, with a name of their own", [{ do: "set_option", group: "elec", key: "3", price: 990, name: "Workshop electric" }],
    (s) => { s.options.elec["3"] = { price: 990, name: "Workshop electric" }; }, { paths: ["options.elec.3"] });
  ok("stop_option", [{ do: "stop_option", group: "misc", key: "lite" }], (s) => { delete s.options.misc.lite; }, { paths: ["options.misc"] });
  ok("set_extra: a new extra gets a key made from its name", [{ do: "set_extra", name: "Gutters", charged: "lf", price: 8 }],
    (s) => { s.options.extras.push({ key: "gutters", name: "Gutters", input: "lf", price: 8 }); }, { paths: ["options.extras"] });
  ok("set_extra: change one by its key", [{ do: "set_extra", key: "ridge-vent", name: "Ridge vent", charged: "check", price: 135 }],
    (s) => { s.options.extras[0] = { key: "ridge-vent", name: "Ridge vent", input: "check", price: 135 }; }, { paths: ["options.extras"] });
  ok("remove_extra", [{ do: "remove_extra", key: "anchors" }], (s) => { s.options.extras = s.options.extras.filter((x) => x.key !== "anchors"); }, { paths: ["options.extras"] });
  ok("set_colors: replaces the whole list; a library name turns a swatch on, {name, hex} is their own", [{ do: "set_colors", which: "trim", colors: ["White", "Black", { name: "Forest", hex: "#2F4A3B" }, "Barn Red"] }],
    (s) => { s.palettes.trim = ["White", "Black", ["Forest", "#2F4A3B"], "Barn Red"]; }, { paths: ["palettes.trim"] });

  /* how prices and quotes show, the business */
  ok("set_defaults", [{ do: "set_defaults", style: "UT", size: "10x16" }], (s) => { s.defaults.style = "UT"; s.defaults.size = "10x16"; }, { paths: ["defaults"] });
  ok("set_price_display", [{ do: "set_price_display", show: "from" }], (s) => { s.pricing.show = "from"; }, { paths: ["pricing.show"] });
  ok("set_fine_print", [{ do: "set_fine_print", text: "Prices plus tax. Free delivery within 50 miles." }],
    (s) => { s.notes.finePrint = "Prices plus tax. Free delivery within 50 miles."; }, { paths: ["notes.finePrint"] });
  ok("set_size_note", [{ do: "set_size_note", width: 12, text: "12 ft wide buildings fit most driveways." }],
    (s) => { s.notes.sizeNotes["12"] = "12 ft wide buildings fit most driveways."; }, { paths: ["notes.sizeNotes"] });
  ok("set_rent_to_own: terms and the term shown", [{ do: "set_rent_to_own", terms: [{ months: 36, factor: 0.6 }, { months: 48, factor: 0.53 }, { months: 60, factor: 0.45 }, { months: 72, factor: 0.4 }], show_term: 72 }],
    (s) => { s.pricing.rto = { ...s.pricing.rto, factors: { 36: 0.6, 48: 0.53, 60: 0.45, 72: 0.4 }, showTerm: 72 }; }, { paths: ["pricing.rto"] });
  ok("set_rent_to_own: null turns rent to own off", [{ do: "set_rent_to_own", terms: null }], (s) => { delete s.pricing.rto; }, { paths: ["pricing"] });
  ok("set_quote_form", [{ do: "set_quote_form", fields: { email: "required" }, ask_plan: false }],
    (s) => { s.leads.fields.email = "required"; s.leads.askPlan = false; }, { paths: ["leads.fields", "leads.askPlan"] });
  ok("set_business: before live, contact details may change (always warned first)", [{ do: "set_business", tagline: "Built in Florida", phone: "941-555-0199" }],
    (s) => { s.brand.tagline = "Built in Florida"; s.brand.phone = "941-555-0199"; },
    { paths: ["brand.phone", "brand.tagline"], warnings: [WARN.contact(["phone"])] });
  ok("set_brand_colors", [{ do: "set_brand_colors", accent: "#B22222" }], (s) => { s.brand.colors.accent = "#B22222"; }, { paths: ["brand.colors"] });

  /* warnings */
  ok("warning: a bigger size cheaper than a smaller one", [{ do: "set_price", style: "UT", size: "12x24", price: 7000 }],
    (s) => { sizes(s, "UT")["12x24"] = 7000; }, { warnings: [WARN.cheaper("Utility Shed", "12×24", 7000, "12×20", 7290)] });
  ok("warning: a price moved more than 40%", [{ do: "set_price", style: "LB", size: "14x32", price: 21000 }],
    (s) => { sizes(s, "LB")["14x32"] = 21000; }, { warnings: [WARN.moved("Loft Barn 14×32", 14490, 21000)] });
  ok("warning: a building under $500", [{ do: "set_price", style: "UT", size: "4x6", price: 450 }],
    (s) => { s.offer.UT.sizes = sortSizes({ ...sizes(s, "UT"), "4x6": 450 }); }, { warnings: [WARN.low("Utility Shed", "4×6", 450)] });
  ok("warning: a building over $100,000", [{ do: "set_price", style: "G", size: "14x60", price: 120000 }],
    (s) => { s.offer.G.sizes = sortSizes({ ...sizes(s, "G"), "14x60": 120000 }); }, { warnings: [WARN.high("Garage", "14×60", 120000)] });
  ok("warning: every size of a style at one price", [{ do: "sell_style", style: "G", sizes: { "12x20": 9000, "12x24": 9000, "14x28": 9000 } }],
    (s) => { s.offer.G.sizes = { "12x20": 9000, "12x24": 9000, "14x28": 9000 }; }, { warnings: [WARN.samePrice("Garage", 9000)] });
  ok("warning: more than half of all prices change", [{ do: "change_prices", scope: { all: true }, by_percent: 3, round_to: 5 }],
    (s) => { for (const k of keysOf(s.offer)) for (const z of keysOf(sizes(s, k))) sizes(s, k)[z] = Math.round((sizes(s, k)[z] * 1.03) / 5) * 5; },
    { warnings: [WARN.many(15, 15)] });
  ok("warning: three or more styles stopped", [
    { do: "sell_style", style: "GU", group: "Sheds", sizes: { "8x12": 3290 } },
    { do: "stop_selling_style", style: "UT" }, { do: "stop_selling_style", style: "LB" }, { do: "stop_selling_style", style: "G" }],
  (s) => {
    s.offer = { GU: { sizes: { "8x12": 3290 } } };
    s.categories = [["Sheds", ["GU"]]];
    s.defaults.style = "GU"; s.defaults.size = "8x12";
  }, { paths: ["offer", "categories", "defaults"], warnings: [WARN.stopped(["Utility Shed", "Loft Barn", "Garage"])] });
  ok("warning: free text customers read with a phone number in it (listed first)", [{ do: "set_fine_print", text: "Call 941-555-0100 to book delivery." }],
    (s) => { s.notes.finePrint = "Call 941-555-0100 to book delivery."; }, { warnings: [WARN.contactInText("The line under the price", ["a phone number"])] });
  ok("warning: any web address, like bit.ly/3xYz or othersheds.shop", [{ do: "set_fine_print", text: "Book online at bit.ly/3xYz" }],
    (s) => { s.notes.finePrint = "Book online at bit.ly/3xYz"; }, { warnings: [WARN.contactInText("The line under the price", ["a web address"])] });
  ok("warning: the business name with a phone number in it", [{ do: "set_business", name: "Testing Sheds, call 941-555-0199" }],
    (s) => { s.brand.name = "Testing Sheds, call 941-555-0199"; }, { warnings: [WARN.contactInText("The business name", ["a phone number"])] });
  ok("warning: the short name with a phone number in it", [{ do: "set_business", short: "Sheds 941-555-0199" }],
    (s) => { s.brand.short = "Sheds 941-555-0199"; }, { warnings: [WARN.contactInText("The short name", ["a phone number"])] });
  ok("warning: the texting permission words with a web address in them", [{ do: "set_quote_form", sms_consent: "Yes, text me. Or order at othersheds.shop" }],
    (s) => { s.leads.smsConsent = "Yes, text me. Or order at othersheds.shop"; }, { warnings: [WARN.contactInText("The texting permission words", ["a web address"])] });
  ok("warning: a group name with a web address in it", [{ do: "sell_style", style: "GU", group: "Order at www.other-sheds.com", sizes: { "8x12": 3290 } }],
    (s) => { s.offer.GU = { sizes: { "8x12": 3290 } }; s.categories.push(["Order at www.other-sheds.com", ["GU"]]); },
    { paths: ["categories"], warnings: [WARN.contactInText("The building group \"Order at www.other-sheds.com\"", ["a web address"])] });
  ok("warning: a color of their own with a phone number in its name", [{ do: "set_colors", which: "trim", colors: ["White", "Black", { name: "Forest", hex: "#2F4A3B" }, { name: "Cedar", hex: "#8B5A3C" }, { name: "Call 9415550199", hex: "#123456" }] }],
    (s) => { s.palettes.trim = ["White", "Black", ["Forest", "#2F4A3B"], ["Cedar", "#8B5A3C"], ["Call 9415550199", "#123456"]]; },
    { warnings: [WARN.contactInText("The trim color \"Call 9415550199\"", ["a phone number"])] });
  ok("warning: a rent-to-own factor moved more than 40%", [{ do: "set_rent_to_own", terms: [{ months: 36, factor: 0.06 }, { months: 48, factor: 0.53 }, { months: 60, factor: 0.45 }] }],
    (s) => { s.pricing.rto = { ...s.pricing.rto, factors: { 36: 0.06, 48: 0.53, 60: 0.45 } }; }, { paths: ["pricing.rto"], warnings: [WARN.rtoMoved(36, 0.6, 0.06)] });
  ok("set_extra: charged another way is said with both ways", [{ do: "set_extra", key: "anchors", name: "Extra ground anchors", charged: "lf", price: 45 }],
    (s) => { s.options.extras[1] = { key: "anchors", name: "Extra ground anchors", input: "lf", price: 45 }; }, { paths: ["options.extras"] });

  /* refused: nothing is saved, every problem is listed */
  refused("an unknown edit", [{ do: "set_status", status: "active" }], ["Edit 1: there is no edit called set_status."]);
  refused("an unknown style", [{ do: "set_price", style: "XX", size: "10x16", price: 5000 }], ["Edit 1: there is no building style XX in their price list."]);
  refused("sell_style: a code not in the builder's library", [{ do: "sell_style", style: "ZZ", sizes: { "10x16": 5000 } }], ["Edit 1: ZZ is not a style in the builder's library."]);
  refused("a size the designer can't sell", [{ do: "set_price", style: "UT", size: "20x40", price: 9000 }],
    ["Edit 1: Utility Shed 20×40 is not a size the designer can sell (width 4 to 16 ft, length 4 to 60 ft, whole feet)."]);
  refused("a price over $1,000,000", [{ do: "set_price", style: "UT", size: "10x16", price: 1500000 }], ["Edit 1: Utility Shed 10×16 costs more than $1,000,000 — check that price."]);
  refused("a price with more than 2 decimals", [{ do: "set_item", item: "w48", price: 175.555 }], ["Edit 1: a price can have at most 2 decimals."]);
  refused("the last size of a style", [{ do: "remove_size", style: "G", size: "12x20" }, { do: "remove_size", style: "G", size: "12x24" }, { do: "remove_size", style: "G", size: "14x28" }],
    ["Edit 3: 14×28 is the Garage's last size. Stop selling the style instead."]);
  const noW72 = structuredClone(base);
  delete noW72.items.w72;
  let standard = false;
  try { pl.check(noW72); } catch { standard = true; }
  if (!standard) throw new Error("The stop_selling_item sample needs an item that comes standard on a style they sell.");
  refused("stop_selling_item: it comes with a style they sell", [{ do: "stop_selling_item", item: "w72" }],
    ["Edit 1: The 72″ Wooden Double Doors comes with the Utility Shed and the Loft Barn, so it stays sold."]);
  refused("set_roof_pitch: not a gable roof", [{ do: "set_roof_pitch", style: "LB", pitch: "6/12" }],
    ["Edit 1: Only a gable roof's pitch can be changed here. The Loft Barn has a gambrel roof, so a different pitch needs a new library style."]);
  refused("set_roof_pitch: the Dormer Shed", [{ do: "set_roof_pitch", style: "DS", pitch: "6/12" }],
    ["Edit 1: The Dormer Shed's dormer sets its roof, so its pitch can't be changed here. A different pitch needs a new library style."]);
  refused("set_roof_pitch: a style of their own", [{ do: "set_roof_pitch", style: "UT1", pitch: "6/12" }],
    ["Edit 1: UT1 is a style of their own. Change the pitch of the library style it is built like."]);
  refused("set_roof_pitch: out of range", [{ do: "set_roof_pitch", style: "UT", pitch: "14/12" }], ["Edit 1: Pick a pitch from 3/12 to 12/12, in whole twelfths, or standard."]);
  refused("set_business: contact details while the owner's switch is on", [{ do: "set_business", phone: "941-555-0199" }], ["Edit 1: " + LOCK.contact], { mode: "switch" });
  refused("too many edits", Array.from({ length: 301 }, () => ({ do: "set_price", style: "UT", size: "10x16", price: 5190 })).slice(0, 2), ["Send 1 to 300 edits at a time."]);
  out[out.length - 1].note = "the real request has 301 edits; two are shown here";

  /* the owner's own rules give the same problem a 422 from the owner's PUT would (parity) */
  const bad = structuredClone(base);
  bad.defaults.size = "14x40";
  let ownerWords = [];
  try { pl.check(bad); } catch (e) { ownerWords = e.problems || [e.message]; }
  refused("the Dealer Center's own check: the opening size isn't sold", [{ do: "set_defaults", size: "14x40" }], ownerWords);
  return out;
}

/* ---- the examples --------------------------------------------------------------------------- */

function build(old) {
  const { TEST, OTHER, signText } = signer(old);
  function passFor(claims, { prefix = SETUP_PASS_PREFIX, key = TEST, encoding } = {}) {
    const head = b64(JSON.stringify(claims));
    const signed = prefix + head;
    return { claims, signed, pass: `${head}.${signText(signed, key, encoding)}`, ...(encoding ? { encoding } : {}) };
  }
  const bodyOf = (o) => JSON.stringify(o);
  const request = (pass, body, headers = {}) => ({
    method: "POST", url: DOOR_URL,
    headers: { ...(pass ? { Authorization: `Bearer ${pass}` } : {}), "Content-Type": "application/json", ...headers }, body,
  });
  return { TEST, OTHER, signText, passFor, bodyOf, request };
}

async function make(old) {
  const { TEST, OTHER, signText, passFor, bodyOf, request } = build(old);
  const { pl, record } = await basePriceList();
  const base = record.settings;

  /* the six good passes, one per action */
  const bodies = {
    status: bodyOf({ action: "status" }),
    read: bodyOf({ action: "read", part: "buildings" }),
    check: bodyOf({ action: "check", version: 1, edits: [{ do: "set_price", style: "LB", size: "10x16", price: 5700 }, { do: "set_item", item: "w48", price: 175 }] }),
    save: null,                       /* needs the hash from check: below */
    undo: null,
    session: bodyOf({ action: "session" }),
  };

  /* what the door's check works out for the conversation's edits */
  const v2 = structuredClone(base);
  v2.offer.LB.sizes["10x16"] = 5700;
  v2.items.w48 = 175;
  settle(base, v2);
  pl.check(v2);
  const v2Changes = describeChanges(base, v2, M, { contact: "new" });
  const v2Sha = sha256(JSON.stringify(v2));
  bodies.save = bodyOf({ action: "save", version: 1, edits: JSON.parse(bodies.check).edits, settingsSha256: v2Sha });
  const v3 = settle(v2, structuredClone(base));
  v3.cfg = (v2.cfg || 1) + 1;
  const v3Changes = [UNDO_LINE, ...describeChanges(v2, v3, M, { contact: "hidden" })];
  const v3Sha = sha256(JSON.stringify(v3));
  const undoCheckBody = bodyOf({ action: "check", version: 2, undo: true });
  bodies.undo = bodyOf({ action: "undo", version: 2, settingsSha256: v3Sha });

  const passes = {};
  for (const action of ACTIONS) {
    const body = bodies[action];
    passes[action] = { ...passFor(claimsFor("good-" + action, action, body)), body, bodySha256: sha256(body) };
  }

  /* status fields at each step of the conversation */
  const at = (s) => iso(NOW + s * 1000);
  const S0 = {
    live: false, liveAt: null, access: "prelive", why: null, until: null, prelive: "on", termsOk: true, termsOut: true,
    priceList: { version: 1, savedAt: SET_UP_AT, by: "the owner", open: false }, lastBarnwrightSave: null, canUndo: false,
  };
  const savePassId = passes.save.claims.id, undoPassId = passes.undo.claims.id;
  const S1 = { ...S0, priceList: { version: 2, savedAt: at(4), by: BARNWRIGHT, open: false }, lastBarnwrightSave: { version: 2, passId: savePassId, at: at(4) }, canUndo: true };
  const S2 = { ...S0, priceList: { version: 3, savedAt: at(6), by: BARNWRIGHT, open: false }, lastBarnwrightSave: { version: 3, passId: undoPassId, at: at(6) }, canUndo: true };
  const fields = (S) => ({ v: 1, ...S, appVersion: APP_VERSION });
  const okAnswer = (S, more = {}) => ({ status: 200, body: { ok: true, ...fields(S), ...more } });
  const refusal = (code, S, more = {}) => {
    const r = REFUSALS[code];
    return { status: r.status, body: { ok: false, code, error: more.error || r.error, ...(more.extra || {}), ...(S ? fields(S) : {}) } };
  };

  const history1 = [{ version: 1, savedAt: SET_UP_AT, by: "the owner", changes: ["Set up the business with a starting price list"], more: 0 }];
  const examples = [];
  const ex = (name, given, req, answer, more = {}) => examples.push({ name, given, request: req, answer, ...more });

  /* the conversation: read, check, save, check an undo, undo */
  ex("status", "Testing Sheds is being set up: First setup done, terms 2.2 agreed, never opened to customers.",
    request(passes.status.pass, bodies.status), okAnswer(S0));
  for (const part of PARTS) {
    const body = part === "buildings" ? bodies.read : bodyOf({ action: "read", part });
    const p = part === "buildings" ? passes.read : passFor(claimsFor("read-" + part, "read", body));
    ex(`read ${part}`, "As above.", request(p.pass, body), okAnswer(S0, { part, view: view(base, part), history: history1 }));
  }
  ex("check", "As above. Nothing is written.", request(passes.check.pass, bodies.check), okAnswer(S0, {
    version: 1, changes: v2Changes, moreChanges: 0, warnings: [], counts: { edits: 2, changes: v2Changes.length, warnings: 0 },
    contactDetailsChange: false, newCodes: {}, settingsSha256: v2Sha,
  }));
  ex("save", "Right after the check, with its settingsSha256.", request(passes.save.pass, bodies.save), okAnswer(S1, { versionBefore: 1, version: 2, changes: v2Changes, newCodes: {} }));
  const undoCheckPass = passFor(claimsFor("check-undo", "check", undoCheckBody));
  ex("check an undo", "After the save above. Nothing is written.", request(undoCheckPass.pass, undoCheckBody), okAnswer(S1, {
    version: 2, changes: v3Changes, moreChanges: 0, warnings: [], counts: { edits: 0, changes: v3Changes.length - 1, warnings: 0 },
    contactDetailsChange: false, newCodes: {}, settingsSha256: v3Sha,
  }));
  ex("undo", "Right after checking the undo, with its settingsSha256.", request(passes.undo.pass, bodies.undo), okAnswer(S2, { versionBefore: 2, version: 3, changes: v3Changes }));

  /* refusals, one for every code (a few codes twice) */
  const fresh = (name, body, over = {}, opts = {}) => passFor(claimsFor(name, JSON.parse(body).action, body, over), opts);
  const sBody = bodies.status;
  ex("refused: not POST", "Any Dealer Center connected to Barnwright.", { method: "GET", url: DOOR_URL, headers: {}, body: "" }, refusal("method"));
  ex("refused: an Origin header (the door is server to server)", "As in status.",
    request(fresh("origin", sBody).pass, sBody, { Origin: "https://example.com" }), refusal("bad-request"));
  ex("refused: a Cookie header", "As in status.", request(fresh("cookie", sBody).pass, sBody, { Cookie: "a=b" }), refusal("bad-request"));
  ex("refused: not JSON", "As in status.", request(fresh("type", sBody).pass, sBody, { "Content-Type": "text/plain" }), refusal("bad-request"));
  const unknown = bodyOf({ action: "publish" });
  ex("refused: an action the door doesn't have", "As in status.", request(fresh("unknown", bodyOf({ action: "status" })).pass, unknown), refusal("bad-request"));
  ex("refused: a body over 64 KB", "As in status. The body is 65,537 bytes of a check (not shown).",
    { method: "POST", url: DOOR_URL, headers: { Authorization: "Bearer <a pass for that body>", "Content-Type": "application/json", "Content-Length": "65537" }, body: "<65,537 bytes>" }, refusal("too-big"));
  ex("refused: no pass", "As in status.", request(null, sBody), refusal("pass"));
  const expired = fresh("expired", sBody, { issuedAt: NOW - 200_000, expiresAt: NOW - 80_000 });
  ex("refused: an expired pass", "As in status.", request(expired.pass, sBody), refusal("pass"), { reason: "expired" });
  ex("refused: the body isn't the one the pass was made for", "As in status.",
    request(passes.read.pass, bodyOf({ action: "read", part: "summary" })), refusal("pass"), { reason: "body" });
  ex("refused: the pass was already used", "Right after the status example: the same request again.",
    request(passes.status.pass, bodies.status), refusal("pass-used", S0));
  const readSummary = bodyOf({ action: "read", part: "summary" });
  const S_stopped = { ...S0, access: "closed", why: "stopped", prelive: "stopped" };
  ex("refused: the owner stopped setup access", "The owner tapped Stop Barnwright's setup access.",
    request(fresh("stopped", readSummary).pass, readSummary),
    refusal("closed", S_stopped, { error: WHY.stopped, extra: { why: "stopped" } }));
  const S_live = { ...S0, live: true, liveAt: at(-1800), access: "closed", why: "live-off", priceList: { ...S0.priceList, open: true } };
  ex("refused: open to customers and the switch is off", "The owner opened the 3D designer to customers half an hour ago.",
    request(fresh("live-off", bodies.check).pass, bodies.check), refusal("closed", S_live, { error: WHY["live-off"], extra: { why: "live-off" } }));
  const S_terms = { ...S0, access: "closed", why: "terms", termsOk: false };
  ex("refused: the owner hasn't agreed to terms 2.2", "Terms 2.2 are out; the owner agreed to terms 2.1 only.",
    request(fresh("terms", bodies.check).pass, bodies.check), refusal("closed", S_terms, { error: WHY.terms, extra: { why: "terms" } }));
  const S_notOut = { ...S_terms, termsOut: false };
  ex("refused: terms 2.2 aren't out yet", "This Dealer Center's own terms are older than 2.2 (termsOut: false), so no owner can agree to them yet.",
    request(fresh("terms-not-out", bodies.check).pass, bodies.check), refusal("closed", S_notOut, { error: TERMS_NOT_OUT, extra: { why: "terms" } }));
  const S_noList = { ...S0, access: "closed", why: "no-price-list", priceList: null };
  ex("refused: no price list yet", "The owner hasn't done First setup.",
    request(fresh("no-list", readSummary).pass, readSummary),
    refusal("closed", S_noList, { error: WHY["no-price-list"], extra: { why: "no-price-list" } }));
  const S_switch = { ...S0, live: true, liveAt: at(-86400), access: "switch", why: null, until: at(4 * 3600), priceList: { ...S0.priceList, open: true } };
  const viaClaude = fresh("needs-alan", bodies.save, { via: "claude" });
  ex("refused: a save from Claude while the designer is open", "The owner's switch is on (Run checks and change my price list and settings). The pass says via claude.",
    request(viaClaude.pass, bodies.save), refusal("needs-alan", S_switch));
  ex("refused: not connected", "A copy of the Dealer Center with no Control Room settings (or only some of them).",
    request(fresh("not-connected", sBody).pass, sBody), refusal("not-connected"));
  ex("refused: the version moved", "After the undo example (the price list is at version 3).",
    request(fresh("version", bodies.check).pass, bodies.check), refusal("version", S2));
  const wrongHash = bodyOf({ ...JSON.parse(bodies.save), settingsSha256: "0".repeat(64) });
  ex("refused: the result isn't the one checked", "As in status (version 1).", request(fresh("changed", wrongHash).pass, wrongHash), refusal("changed", S0));
  const undoV4 = bodyOf({ action: "check", version: 4, undo: true });
  const S_owner = { ...S2, priceList: { version: 4, savedAt: at(60), by: "the owner", open: false }, canUndo: false };
  ex("refused: undo after the owner saved", "After the undo example, the owner saved the price list (version 4).",
    request(fresh("cant-undo", undoV4).pass, undoV4), refusal("cant-undo", S_owner));
  const undoV1 = bodyOf({ action: "check", version: 1, undo: true });
  ex("refused: nothing to undo", "As in status: Barnwright hasn't saved anything yet.",
    request(fresh("nothing-to-undo", undoV1).pass, undoV1),
    refusal("cant-undo", S0, { error: NOTHING_TO_UNDO }));
  const badEdits = bodyOf({ action: "check", version: 1, edits: [{ do: "set_price", style: "XX", size: "10x16", price: 5000 }, { do: "set_status", status: "active" }] });
  const probs = ["Edit 1: there is no building style XX in their price list.", "Edit 2: there is no edit called set_status."];
  ex("refused: problems", "As in status.", request(fresh("problems", badEdits).pass, badEdits), refusal("problems", S0, { error: probs.join(" "), extra: { problems: probs } }));
  const switchPhone = bodyOf({ action: "check", version: 1, edits: [{ do: "set_business", phone: "941-555-0199" }] });
  ex("refused: contact details while the owner's switch is on", "The owner's switch is on.",
    request(fresh("contact", switchPhone).pass, switchPhone), refusal("problems", S_switch, { error: "Edit 1: " + LOCK.contact, extra: { problems: ["Edit 1: " + LOCK.contact] } }));
  ex("refused: the account is off", "As in status, but the Barnwright account is switched off (the lease says read only).",
    request(fresh("account-off", bodies.save).pass, bodies.save), refusal("account-off", S0));
  ex("refused: too many requests", "121st Barnwright request this hour (door and visit together).",
    request(fresh("too-many", sBody).pass, sBody), refusal("too-many", S0));
  ex("refused: too many saves", "61st Barnwright save today (door saves, undos, visit saves and put backs together).",
    request(fresh("too-many-saves", bodies.save).pass, bodies.save), refusal("too-many", S0, { error: TOO_MANY_SAVES }));
  ex("refused: no copy of the current price list could be kept", "As in status, but the history store refuses writes.",
    request(fresh("no-copy", bodies.save).pass, bodies.save), refusal("no-copy", S0));
  ex("refused: something else went wrong", "As in status, but the price list can't be read (storage is down).",
    request(fresh("error", sBody).pass, sBody), refusal("error"));

  /* passes that must be refused (401 "pass"), for verifySetupPass on both ends */
  const bad = [];
  const badPass = (name, reason, token, body, action = JSON.parse(body).action) => bad.push({
    name, reason, action, claims: token.claims ?? null, ...(token.signed !== undefined ? { signed: token.signed } : {}),
    ...(token.encoding ? { encoding: token.encoding } : {}), pass: token.pass, body,
  });
  const cBody = bodies.check;
  const helpClaims = { v: 1, purpose: "help-pass", kind: "question", id: passId("help"), customerId: DEALER.customerId, siteId: DEALER.siteId, issuedAt: NOW, expiresAt: NOW + 600_000, account: {} };
  badPass("a help pass sent as a setup pass", "signature", passFor(helpClaims, { prefix: "barnwright-help-pass/v1." }), cBody);
  const supportClaims = { purpose: "support-diagnostics", customerId: DEALER.customerId, siteId: DEALER.siteId, actor: ACTOR, grantAt: iso(NOW - 60_000), issuedAt: NOW, expiresAt: NOW + 900_000 };
  badPass("a support pass sent as a setup pass", "signature", passFor(supportClaims, { prefix: "" }), cBody);
  const lease = { version: 1, customerId: DEALER.customerId, siteId: DEALER.siteId, status: "active", issuedAt: NOW, expiresAt: NOW + LEASE_DURATION_MS, dealerLimit: 2, addons: [] };
  const leaseText = canonicalLease(lease);
  badPass("a lease sent as a setup pass", "signature", { claims: lease, signed: leaseText, pass: `${b64(leaseText)}.${signText(leaseText, TEST)}` }, cBody);
  badPass("a setup pass signed without the prefix", "signature", passFor(claimsFor("no-prefix", "check", cBody), { prefix: "" }), cBody);
  badPass("signed by another key", "signature", passFor(claimsFor("other-key", "check", cBody), { key: OTHER }), cBody);
  badPass("a signature that isn't 64 bytes (DER)", "signature", passFor(claimsFor("der", "check", cBody), { encoding: "der" }), cBody);
  const sig = Buffer.from(passes.check.pass.split(".")[1], "base64url");
  sig[10] ^= 1;
  badPass("a changed signature (the good check pass with one bit changed)", "signature", { claims: passes.check.claims, pass: passes.check.pass.split(".")[0] + "." + sig.toString("base64url") }, cBody);
  badPass("purpose isn't setup-pass", "claims", passFor({ ...claimsFor("purpose", "check", cBody), purpose: "help-pass" }), cBody);
  badPass("version 2", "claims", passFor({ ...claimsFor("v2", "check", cBody), v: 2 }), cBody);
  badPass("an actor with a control character", "claims", passFor(claimsFor("actor", "check", cBody, { actor: "alan@barnwright.test\n" })), cBody);
  badPass("an actor over 200 characters", "claims", passFor(claimsFor("actor-long", "check", cBody, { actor: "a".repeat(201) })), cBody);
  badPass("via isn't control-room or claude", "claims", passFor(claimsFor("via", "check", cBody, { via: "script" })), cBody);
  badPass("another business's customer", "business", passFor(claimsFor("customer", "check", cBody, { customerId: "cust_other" })), cBody);
  badPass("another business's site", "business", passFor(claimsFor("site", "check", cBody, { siteId: "site-other-1" })), cBody);
  badPass("expired", "expired", passFor(claimsFor("bad-expired", "check", cBody, { issuedAt: NOW - 130_000, expiresAt: NOW - 10_000 })), cBody);
  badPass("a window over 5 minutes", "time", passFor(claimsFor("window", "check", cBody, { expiresAt: NOW + 360_000 })), cBody);
  badPass("issued more than 60 s ahead", "time", passFor(claimsFor("ahead", "check", cBody, { issuedAt: NOW + 61_000, expiresAt: NOW + 181_000 })), cBody);
  badPass("the pass's action isn't the body's", "action", passFor(claimsFor("action", "read", cBody)), cBody, "check");
  badPass("a session pass sent with a door body", "action", passes.session, cBody, "check");
  badPass("the body changed after the pass was made", "body", passes.check, bodyOf({ ...JSON.parse(cBody), edits: [{ do: "set_price", style: "LB", size: "10x16", price: 1 }] }), "check");
  badPass("three parts", "shape", { claims: null, pass: passes.check.pass + ".x" }, cBody);
  badPass("over 8,000 characters", "shape", { claims: null, pass: "a".repeat(8001) + ".b" }, cBody);

  /* the visit (Alan's browser, the business's own site) */
  const cookie = "__Host-bw_setup";
  const cookieValue = createHash("sha256").update("setup-fixture:cookie").digest().toString("base64url");
  const visitEnds = at(8 * 3600);
  const site = DEALER.siteUrl;
  const bizMe = { id: base.id, name: base.brand.name, short: base.brand.short, initials: base.brand.initials, logo: "", colors: base.brand.colors,
    phone: base.brand.phone, email: base.brand.email, website: base.brand.website, open: false };
  const visit = [
    { name: "start", given: "As in status. Alan tapped Open their price list; the page read the pass from #barnwright= and cleared it.",
      request: { method: "POST", url: site + "/api/office/barnwright/start", headers: { Authorization: `Bearer ${passes.session.pass}`, "Content-Type": "application/json", Origin: site }, body: bodies.session },
      answer: { status: 200, headers: { "Set-Cookie": `${cookie}=${cookieValue}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800` },
        body: { ok: true, mode: "prelive", until: null, visitEndsAt: visitEnds, business: { name: base.brand.name } } } },
    { name: "start with a pass that ran out", given: "The pass is more than 2 minutes old.",
      request: { method: "POST", url: site + "/api/office/barnwright/start", headers: { Authorization: "Bearer <an expired session pass>", "Content-Type": "application/json", Origin: site }, body: bodies.session },
      answer: { status: 401, body: { ok: false, code: "pass", error: VISIT_WORDS.linkRanOut } } },
    { name: "start with a pass the Claude connector asked for", given: "A session pass with via \"claude\". A visit is Alan by hand: only the Control Room's own Open their price list (via \"control-room\") starts one.",
      request: { method: "POST", url: site + "/api/office/barnwright/start", headers: { Authorization: "Bearer <a session pass with via claude>", "Content-Type": "application/json", Origin: site }, body: bodies.session },
      answer: { status: 401, body: { ok: false, code: "pass", error: VISIT_WORDS.linkRanOut } } },
    { name: "start with a pass already used", given: "The same link opened twice.",
      request: { method: "POST", url: site + "/api/office/barnwright/start", headers: { Authorization: `Bearer ${passes.session.pass}`, "Content-Type": "application/json", Origin: site }, body: bodies.session },
      answer: { status: 410, body: { ok: false, code: "pass-used", error: VISIT_WORDS.linkRanOut } } },
    { name: "me", given: "During the visit.", request: { method: "GET", url: site + "/api/office/barnwright/me", headers: { Cookie: `${cookie}=${cookieValue}` } },
      answer: { status: 200, body: { barnwright: { actor: ACTOR, mode: "prelive", until: null, visitEndsAt: visitEnds }, business: bizMe } } },
    { name: "save a change by hand", given: "During the visit.",
      request: { method: "PUT", url: site + "/api/office/barnwright/price-list", headers: { Cookie: `${cookie}=${cookieValue}`, "Content-Type": "application/json", Origin: site },
        body: "{\"settings\": <the whole price list, Loft Barn 10x16 at $5,700>, \"version\": 1}" },
      answer: { status: 200, body: { settings: "<the saved price list>", version: 2, cfg: 2, savedAt: at(30), savedBy: { id: "barnwright", name: BARNWRIGHT, passId: passes.session.claims.id }, changes: ["Loft Barn 10×16: $5,690 → $5,700"], lotCount: 1 } } },
    { name: "a change Barnwright may not make", given: "During the visit; the draft opens the designer to customers.",
      request: { method: "PUT", url: site + "/api/office/barnwright/price-list", headers: { Cookie: `${cookie}=${cookieValue}`, "Content-Type": "application/json", Origin: site },
        body: "{\"settings\": <the price list with status \"active\">, \"version\": 2}" },
      answer: { status: 422, body: { error: LOCK.status, problems: [LOCK.status] } } },
    { name: "the visit ended", given: "The visit's 8 hours since its last request passed (or the owner's switch was turned off and on again: a new switch needs a new visit).",
      request: { method: "PUT", url: site + "/api/office/barnwright/price-list", headers: { Cookie: `${cookie}=${cookieValue}`, "Content-Type": "application/json", Origin: site }, body: "{\"settings\": <...>, \"version\": 2}" },
      answer: { status: 401, body: { error: VISIT_WORDS.ended, code: "visit-ended" } } },
    { name: "the visit ended because access closed", given: "The owner tapped Stop Barnwright's setup access (or turned the switch off, or opened the designer to customers). Every visit ends then.",
      request: { method: "PUT", url: site + "/api/office/barnwright/price-list", headers: { Cookie: `${cookie}=${cookieValue}`, "Content-Type": "application/json", Origin: site }, body: "{\"settings\": <...>, \"version\": 2}" },
      answer: { status: 401, body: { error: VISIT_WORDS.closed.replace("<the words for why>", WHY.stopped), code: "visit-ended", why: "stopped" } } },
    { name: "the owner's routes ignore the visit's cookie", given: "During the visit.",
      request: { method: "GET", url: site + "/api/office/customers", headers: { Cookie: `${cookie}=${cookieValue}` } },
      answer: { status: 401, body: { error: "Please sign in." } } },
    { name: "a closed designer as a preview", given: "During the visit. The lot riverside exists; the designer is closed to customers.",
      request: { method: "GET", url: site + "/api/office/barnwright/lots/riverside/preview", headers: { Cookie: `${cookie}=${cookieValue}` } },
      answer: { status: 200, body: { company: "<the lot's 3D designer settings, as GET /api/lots/riverside gives an open lot>", lot: "<the lot>", version: 1, preview: true } } },
    { name: "end", given: "Alan tapped Done.",
      request: { method: "POST", url: site + "/api/office/barnwright/end", headers: { Cookie: `${cookie}=${cookieValue}`, Origin: site, "Content-Type": "application/json" }, body: "{}" },
      answer: { status: 200, headers: { "Set-Cookie": `${cookie}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` }, body: { ok: true } } },
  ];

  /* the owner's one card: Settings, Barnwright */
  const ownerSetup = (o) => ({ mode: "prelive", until: null, why: null, live: false, liveAt: null, prelive: "on", termsOk: true, termsOut: true, ...o });
  const log = (words, s, extra = {}) => ({ at: at(s), words, ...extra });
  const changedLine = logChanged(v2Changes);
  const owner = [
    { name: "GET before live", given: "As in status. The owner is signed in.",
      request: { method: "GET", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>" } },
      answer: { status: 200, body: { help: { on: false, until: null, reason: "", log: [log(changedLine, 4)] }, setup: ownerSetup({}) } } },
    { name: "stop setup access before live", given: "As above.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ prelive: "stopped" }) },
      answer: { status: 200, body: { help: { on: false, until: null, reason: "", log: [log("Pat Owner stopped Barnwright's setup access.", 90), log(changedLine, 4)] }, setup: ownerSetup({ mode: null, why: "stopped", prelive: "stopped" }) } } },
    { name: "turn on Run checks and change my price list and settings", given: "The designer is open to customers.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: true, level: "change", reason: "New 2027 prices", hours: 4 }) },
      answer: { status: 200, body: { help: { on: true, until: at(4 * 3600), reason: "New 2027 prices", log: [log("Pat Owner let Barnwright run checks and change the price list and settings for 4 hours: New 2027 prices", 0, { until: at(4 * 3600) })] },
        setup: ownerSetup({ mode: "switch", until: at(4 * 3600), live: true, liveAt: at(-86400) }) } } },
    { name: "turn on while Barnwright can't be reached", given: "As above, but the Control Room doesn't answer. Changes still turn on: they never depend on the Control Room.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: true, level: "change", reason: "New 2027 prices", hours: 4 }) },
      answer: { status: 200, body: { help: { on: false, until: null, reason: "", log: ["<the same line as above>"] }, setup: ownerSetup({ mode: "switch", until: at(4 * 3600), live: true, liveAt: at(-86400) }),
        notice: OWNER_WORDS.notReached } } },
    { name: "turn off checks before live", given: "As in status, and the owner had turned on Run checks. Setup access goes on until the business is live.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: false }) },
      answer: { status: 200, body: { help: { on: false, until: null, reason: "", log: [log("Pat Owner turned off Barnwright's checks.", 120)] }, setup: ownerSetup({}) } } },
    { name: "turn off", given: "The switch is on.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: false }) },
      answer: { status: 200, body: { help: { on: false, until: null, reason: "", log: [log("Pat Owner turned off Barnwright's access.", 120)] }, setup: ownerSetup({ mode: null, why: "live-off", live: true, liveAt: at(-86400) }) } } },
    { name: "refused: change before terms 2.2", given: "The owner agreed to terms 2.1 only.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <the owner's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: true, level: "change", reason: "New prices", hours: 4 }) },
      answer: { status: 422, body: { error: OWNER_WORDS.termsFirstRefusal } } },
    { name: "refused: a manager", given: "A manager is signed in.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Authorization: "Bearer <a manager's Identity token>", Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: true, level: "change", reason: "New prices", hours: 4 }) },
      answer: { status: 403, body: { error: "Only the owner can let Barnwright help." } } },
    { name: "refused: a Barnwright visit", given: "Only the visit's cookie, no Identity sign-in.",
      request: { method: "POST", url: site + "/api/office/barnwright-help", headers: { Cookie: `${cookie}=${cookieValue}`, Origin: site, "Content-Type": "application/json" }, body: bodyOf({ on: true, level: "change", reason: "Let me in", hours: 24 }) },
      answer: { status: 401, body: { error: "Please sign in." } } },
  ];

  /* the check-in */
  const checkIn = [
    { name: "a check-in with setup", given: "As in status.",
      request: { method: "POST", url: "https://barnwright-control-room.netlify.app/api/license", headers: { Authorization: "Bearer <the activation key>", "Content-Type": "application/json" },
        body: bodyOf({ customerId: DEALER.customerId, siteId: DEALER.siteId, appVersion: APP_VERSION, dealerCount: 1,
          setup: { v: 1, live: false, liveAt: null, access: "prelive", why: null, until: null, prelive: "on", termsOk: true, termsOut: true }, siteUrl: DEALER.siteUrl }) } },
    { name: "a check-in while the switch is on", given: "Open to customers since yesterday; the owner's switch is on for 4 hours.",
      request: { method: "POST", url: "https://barnwright-control-room.netlify.app/api/license", headers: { Authorization: "Bearer <the activation key>", "Content-Type": "application/json" },
        body: bodyOf({ customerId: DEALER.customerId, siteId: DEALER.siteId, appVersion: APP_VERSION, dealerCount: 1,
          setup: { v: 1, live: true, liveAt: at(-86400), access: "switch", why: null, until: at(4 * 3600), prelive: "on", termsOk: true, termsOut: true }, siteUrl: DEALER.siteUrl }) } },
    { name: "a check-in without setup", given: "setup.report() failed or took over 500 ms, or barnwright-live isn't written yet. The lease still renews.",
      request: { method: "POST", url: "https://barnwright-control-room.netlify.app/api/license", headers: { Authorization: "Bearer <the activation key>", "Content-Type": "application/json" },
        body: bodyOf({ customerId: DEALER.customerId, siteId: DEALER.siteId, appVersion: APP_VERSION, dealerCount: 1, siteUrl: DEALER.siteUrl }) } },
  ];

  return {
    _about: [
      "TEST ONLY. Made by tools/lib/make-setup-fixtures.mjs from docs/OFFICE.md, \"Barnwright setup access\". Never edit it by hand: change the script and run it.",
      "Nothing in it is real: the key pairs, the business, the people and the passes exist only for tests. No Dealer Center or Control Room trusts these keys.",
      "The Control Room's tests copy this file. Times, hashes and signatures in the example answers are examples: match the shapes and the words.",
    ],
    v: 1,
    contract: "docs/OFFICE.md#barnwright-setup-access",
    testKey: keyJson(TEST, "TEST ONLY. The pretend Control Room's key: every good pass below is signed with it. Load the private half with crypto.createPrivateKey({key: privateKeyJwk, format: \"jwk\"})."),
    otherKey: keyJson(OTHER, "TEST ONLY. A second key, for a pass signed by somebody else."),
    dealer: { ...DEALER, appVersion: APP_VERSION },
    actor: ACTOR,
    now: NOW,
    nowIso: iso(NOW),
    pass: {
      prefix: SETUP_PASS_PREFIX, lifetimeMs: PASS_MS, maxWindowMs: MAX_WINDOW_MS, maxFutureSkewMs: MAX_SKEW_MS, maxLength: MAX_PASS_LENGTH,
      actions: ACTIONS, via: VIA, claimOrder: Object.keys(claimsFor("x", "status", "{}")),
      reasons: ["shape", "signature", "key", "claims", "business", "time", "expired", "action", "body"],
    },
    passes,
    badPasses: bad,
    door: {
      url: DOOR_URL, maxBodyBytes: DOOR_MAX_BYTES, actions: DOOR_ACTIONS, parts: PARTS,
      limits: { requestsPerHour: 120, savesPerDay: 60, editsPerCheck: 300, changeLinesShown: 500, historyShown: 20, changesPerHistoryEntry: 5 },
      refusals: REFUSALS, why: WHY, whyTermsNotOut: TERMS_NOT_OUT, examples,
    },
    visit: { cookie, lastsMs: 8 * 3600_000, words: VISIT_WORDS, examples: visit },
    owner: { examples: owner },
    checkIn: { examples: checkIn },
    edits: {
      base: "First setup of Testing Sheds with the small starting price list (companies/starter/company.json), version 1, closed to customers.",
      baseSettings: base,
      samples: sampleSet(base, pl),
    },
    words: {
      lock: LOCK, warnings: WARN_TEXT, undoLine: UNDO_LINE, roofPitchLine: pitchLine("<Style>", "<old pitch>", "<new pitch>"), standardPitch: STANDARD_PITCH,
      nothingToUndo: NOTHING_TO_UNDO, tooManySaves: TOO_MANY_SAVES, refusedLog: "A Barnwright change was refused: <words>.",
      savedBy: ["the owner", "a manager", "Barnwright (<actor>)", "someone no longer on the team"],
      ownerSavedFirst: "Barnwright saved a change while you were working. Reload to see it, then make yours again.",
      owner: OWNER_WORDS,
      log: LOG_WORDS,
      forAlan: "You can change their prices", forOwner: "Barnwright can change your prices",
      needsNewestVersion: "Their Dealer Center needs the newest version. It updates on its next deploy.",
    },
  };
}

/* ---- --check: the file is what this script makes, and the passes behave ---------------------- */

function checkFile(fx) {
  const problems = [];
  const pub = fx.testKey.publicKeyPem;
  const opts = (action, body) => ({ publicKeyPem: pub, customerId: fx.dealer.customerId, siteId: fx.dealer.siteId, action, bodyBytes: body, now: fx.now });
  for (const [action, p] of Object.entries(fx.passes)) {
    try { checkSetupPass(p.pass, opts(action, p.body)); } catch (e) { problems.push(`the good ${action} pass is refused (${e.reason})`); }
    if (p.claims.bodySha256 !== sha256(p.body)) problems.push(`the ${action} pass's bodySha256 is not its body's`);
  }
  for (const b of fx.badPasses) {
    try { checkSetupPass(b.pass, opts(b.action, b.body)); problems.push(`"${b.name}" is accepted`); }
    catch (e) { if (e.reason !== b.reason) problems.push(`"${b.name}" is refused for ${e.reason}, not ${b.reason}`); }
  }
  for (const e of fx.door.examples) {
    if (e.answer.status !== 200) continue;
    const token = e.request.headers.Authorization.slice(7);
    const action = JSON.parse(e.request.body).action;
    try { checkSetupPass(token, opts(action, e.request.body)); } catch (err) { problems.push(`door example "${e.name}" has a pass that is refused (${err.reason})`); }
  }
  const codes = new Set(fx.door.examples.map((e) => e.answer.body.code).filter(Boolean));
  for (const code of Object.keys(REFUSALS)) if (!codes.has(code)) problems.push(`no door example for the refusal ${code}`);
  for (const a of DOOR_ACTIONS) if (!fx.door.examples.some((e) => e.answer.status === 200 && e.request.body && JSON.parse(e.request.body).action === a)) problems.push(`no door example for ${a}`);
  return problems;
}

/* Every pass the Dealer Center signs could be written down by somebody: this is the one place
   they live, and none of them would work anywhere real. */
async function main() {
  const old = readOld();
  const fx = await make(old);
  const text = JSON.stringify(fx, null, 2) + "\n";
  const problems = checkFile(fx);
  if (args.has("--check")) {
    if (!old) problems.unshift("tools/lib/setup-fixtures.json is missing: run node tools/lib/make-setup-fixtures.mjs");
    else if (readFileSync(OUT, "utf8") !== text) problems.unshift("tools/lib/setup-fixtures.json is not what this script makes now: run node tools/lib/make-setup-fixtures.mjs and tell the Control Room lanes");
    for (const p of problems) console.log("  FAIL " + p);
    if (problems.length) { console.log(`FAIL: ${problems.length} problem(s) with the setup access fixtures.`); process.exit(1); }
    console.log(`PROVED: the setup access fixtures are what the script makes; ${Object.keys(fx.passes).length} good passes are kept and ${fx.badPasses.length} bad ones refused for the stated reason; ${fx.door.examples.length} door examples cover every action and every refusal; ${fx.edits.samples.length} sample edits give the Dealer Center's own change words.`);
    return;
  }
  if (problems.length) { for (const p of problems) console.log("  FAIL " + p); process.exit(1); }
  writeFileSync(OUT, text);
  console.log(`Wrote tools/lib/setup-fixtures.json: ${Object.keys(fx.passes).length} passes, ${fx.badPasses.length} bad passes, ${fx.door.examples.length} door examples, ${fx.edits.samples.length} sample edits.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
