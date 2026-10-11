/* THE LOCK: WHAT BARNWRIGHT MAY CHANGE IN A BUSINESS'S PRICE LIST AND
   SETTINGS (docs/OFFICE.md, "Barnwright setup access", "The lock").

   Every Barnwright check and save runs this first (the visit's save and
   put back now; the door's check, save and undo too), then the very same
   check() the owner's own save runs. So a Barnwright save can never be
   anything an owner's save couldn't be, and it can never:

     * open or close the 3D designer to customers (status);
     * change which websites may show it (embed), the license settings,
       the credit line, or where quotes go (every `leads` key except the
       quote form's boxes, its plan question and its texting words);
     * change how the buildings are built, except a building style's own
       numbers in How it's built (offer.<code>.built, which the door's
       set_roof_pitch writes; checked by model/build-settings.js and the
       every-size check like the owner's own): not the construction
       settings, not the numbers for the whole business (the top-level
       built), and not through an extra of the business's own that changes
       how the building is built (its construction or its own How it's
       built numbers, options.extras[].construction and .built, and where
       such an extra is offered): no new one, no change to one, no removing
       an extra that has one;
     * put a web address in as the logo: a logo is a picture of 150 KB or
       less, so no customer's 3D designer ever loads it from somewhere else.

   While the owner's switch is on (the business is open to customers), the
   door may not change the business phone, email or website either; Alan
   by hand in the visit may.

   carryLocked() is for going back (put back, undo): the "never" parts keep
   their values from now, so going back can't open the 3D designer, change
   where quotes go or which websites may show it. Going back to a price
   list whose extras build differently is refused by the lock itself.

   A price list from before How it's built may hold the roof pitch rule
   list Barnwright's set_roof_pitch used to write (construction.roof.
   shapes.gable.rise). Both sides are read with it moved into How it's
   built first (liftRawRules, the same move every save makes), so such a
   list compares as the style's own roof pitch it draws.

   Pure: no store, no clock. Node-safe and browser-safe. */

import { liftRawRules, tidyBuilt } from "../../model/build-settings.js";

export const LOCK_WORDS = Object.freeze({
  status: "Only the owner can open or close the 3D designer to customers.",
  id: "This price list belongs to a different business. Reload the page and try again.",
  manufacturer: "The builder's library cannot change here.",
  license: "The 3D designer's license settings can't be changed by Barnwright.",
  embed: "Only the owner can change which websites may show the 3D designer.",
  leads: "Only the owner can change where quotes go.",
  credit: "The 3D designer credit line can't be changed by Barnwright.",
  construction: "How the buildings are built can't be changed here, except a building style's own numbers in How it's built.",
  /* the top-level built: How it's built for the whole business */
  built: "Only the owner can change How it's built for the whole business. A building style's own numbers can be changed here.",
  /* an extra of the business's own that changes how the building is built */
  extraConstruction: (name) => `The extra "${name}" changes how the building is built, so only the owner can add it, remove it or change what it builds.`,
  logoAddress: "The logo must be a picture uploaded in Settings, Logo, not a web address.",
  logoBig: "The logo is too big. Use a picture of 150 KB or less.",
  contact: "While their 3D designer is open, the business phone, email and website can be changed only by the owner, or by Alan by hand in Open their price list.",
});

/* The library styles whose gable roof pitch may change (set_roof_pitch). */
export const GABLE_STYLES = Object.freeze(["UT", "SU", "GU", "C", "SC", "DSC", "G", "MU", "MG", "DK"]);
export const LOGO_MAX = 150 * 1024;

/* the quote form's own parts; every other `leads` key says where quotes go */
const LEADS_OPEN = ["fields", "askPlan", "smsConsent"];
const CONTACT = ["phone", "email", "website"];
const NEVER = ["status", "id", "manufacturer", "license", "embed"];
const LOGO_RE = /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* The same value whatever order its keys were written in. */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
const same = (a, b) => canon(a) === canon(b);
const openOf = (s) => (s?.status === "suspended" ? "suspended" : "active");

/* A price list as the lock reads it: a roof pitch rule list of the shape
   set_roof_pitch used to write moved into How it's built (the stored
   settings may be from before), and How it's built numbers as numbers
   ("5/12" as 5), the way every save stores them. Without the builder's
   library nothing moves. */
function asSaved(s, manufacturer) {
  if (!isObj(s)) return {};
  if (!isObj(manufacturer)) return s;
  return tidyBuilt(liftRawRules(s, manufacturer).settings, manufacturer);
}
const emptyAsNull = (v) => (v === undefined || (isObj(v) && !Object.keys(v).length) ? null : v);

/* The extras that change how the building is built, by key: an extra's
   construction effect counts when it is there at all (model/company.js
   reads it with `if (x.construction)`), and so do its own How it's built
   numbers (options.extras[].built, read when it holds any). Keys are
   compared as the 3D designer reads them, as text (optionEffects[x.key],
   the design's choices), so 5 and "5" are one key. -> {first: key -> the
   first extra with it, all: key -> every extra with it}. */
const hasEffect = (x) => isObj(x) && (!!x.construction || (isObj(x.built) && Object.keys(x.built).length > 0));
/* what such an extra builds, and on which buildings it is offered (its
   numbers reach only those) */
const effectOf = (x) => (hasEffect(x) ? { construction: x.construction ?? null, built: emptyAsNull(x.built), styles: x.styles ?? null } : null);
function extrasByKey(s) {
  const first = new Map(), all = new Map();
  for (const x of Array.isArray(s?.options?.extras) ? s.options.extras : []) {
    if (!isObj(x)) continue;
    const key = String(x.key);
    if (!first.has(key)) first.set(key, x);
    all.set(key, [...(all.get(key) || []), x]);
  }
  return { first, all };
}
const extraName = (x) => (typeof x?.name === "string" && x.name.trim() ? x.name.trim() : "with no name");

/* -> the names of the extras whose construction effect `next` adds,
   changes or takes away (with the extra itself or on its own): each extra
   that had one must still be there with exactly the same effect, and no
   other extra may have one. Nor may a key with an effect (before or
   after) be used by two extras, since the designer can't tell them apart
   and the second would build the first's way. The name is the one before
   the change, or a new extra's own. */
export function extraEffectChanges(old, next) {
  const { first: before } = extrasByKey(old), { first: after, all } = extrasByKey(next);
  const names = [];
  for (const [key, x] of before) {
    if (!hasEffect(x)) continue;
    const now = after.get(key);
    if (!now || !same(effectOf(x), effectOf(now))) names.push(extraName(x));
  }
  for (const [key, x] of after) {
    if (!hasEffect(x) || hasEffect(before.get(key))) continue;
    names.push(extraName(x));
  }
  for (const [key, list] of all) {
    if (list.length < 2) continue;
    const had = before.get(key);
    if (hasEffect(had)) names.push(extraName(had));
    else for (const x of list) if (hasEffect(x)) names.push(extraName(x));
  }
  return [...new Set(names)];
}

/* -> the plain sentences for everything in `next` that Barnwright may not
   change from `old` (none: an empty list). options:
     door          true for the door (Claude through the Control Room)
     mode          "prelive" or "switch" (access() says which)
     manufacturer  the builder's library (library/manufacturers), so a
                   price list holding the old roof pitch rule list is read
                   as the pitch it draws (asSaved)
   A building style's own How it's built numbers (offer.<code>.built) may
   change, in either mode, at the door and in the visit: the owner's own
   check() (model/build-settings.js) and the every-size check judge them
   after the lock, as they do the owner's. */
export function lockProblems(old, next, { door = false, mode = "prelive", manufacturer = null } = {}) {
  const out = [];
  const o = asSaved(old, manufacturer), n = asSaved(next, manufacturer);
  if (openOf(o) !== openOf(n)) out.push(LOCK_WORDS.status);
  if (o.id !== n.id) out.push(LOCK_WORDS.id);
  if (o.manufacturer !== n.manufacturer) out.push(LOCK_WORDS.manufacturer);
  if (!same(o.license, n.license)) out.push(LOCK_WORDS.license);
  if (!same(o.embed, n.embed)) out.push(LOCK_WORDS.embed);
  const ol = isObj(o.leads) ? o.leads : {}, nl = isObj(n.leads) ? n.leads : {};
  const routing = [...new Set([...Object.keys(ol), ...Object.keys(nl)])].filter((k) => !LEADS_OPEN.includes(k));
  if (routing.some((k) => !same(ol[k], nl[k]))) out.push(LOCK_WORDS.leads);
  const ob = isObj(o.brand) ? o.brand : {}, nb = isObj(n.brand) ? n.brand : {};
  if (!same(ob.credit, nb.credit)) out.push(LOCK_WORDS.credit);
  if (!same(emptyAsNull(o.construction), emptyAsNull(n.construction))) out.push(LOCK_WORDS.construction);
  if (!same(emptyAsNull(o.built), emptyAsNull(n.built))) out.push(LOCK_WORDS.built);
  for (const name of extraEffectChanges(o, n)) out.push(LOCK_WORDS.extraConstruction(name));
  const logo = nb.logo ?? "";
  if (logo !== (ob.logo ?? "") && logo !== "") {
    if (typeof logo !== "string" || !LOGO_RE.test(logo)) out.push(LOCK_WORDS.logoAddress);
    else if (logo.length > LOGO_MAX) out.push(LOCK_WORDS.logoBig);
  }
  if (door && mode === "switch" && CONTACT.some((k) => (ob[k] || "") !== (nb[k] || ""))) out.push(LOCK_WORDS.contact);
  return out;
}

/* -> a copy of `into` (an earlier price list being put back) with the
   parts Barnwright may never change taken from `from` (the one in use now):
   status, id, manufacturer, license, embed, the credit line, where quotes
   go, the construction settings and How it's built for the whole business.
   Each building style's own How it's built numbers (its roof pitch) stay
   as `into` had them. Both are read as saved (asSaved), so an earlier
   price list's roof pitch rule list comes back as the pitch it drew. */
export function carryLocked(from, into, { manufacturer = null } = {}) {
  const f = asSaved(from, manufacturer);
  const out = structuredClone(asSaved(into, manufacturer));
  for (const k of NEVER) {
    if (k in f) out[k] = structuredClone(f[k]);
    else delete out[k];
  }
  out.brand = isObj(out.brand) ? out.brand : {};
  if (isObj(f.brand) && "credit" in f.brand) out.brand.credit = structuredClone(f.brand.credit);
  else delete out.brand.credit;
  const fl = isObj(f.leads) ? f.leads : {};
  const leads = isObj(out.leads) ? out.leads : {};
  for (const k of [...new Set([...Object.keys(fl), ...Object.keys(leads)])]) {
    if (LEADS_OPEN.includes(k)) continue;
    if (k in fl) leads[k] = structuredClone(fl[k]);
    else delete leads[k];
  }
  if (isObj(out.leads) || Object.keys(leads).length) out.leads = leads;
  /* written the way they are now ({} or left out) */
  for (const k of ["construction", "built"]) {
    if (k in f) out[k] = structuredClone(f[k]);
    else delete out[k];
  }
  return out;
}
