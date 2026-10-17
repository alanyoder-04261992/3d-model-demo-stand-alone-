/* THE PRICE LIST: stored once, used by every lot.

   The record "price-list" holds {settings, version, cfg, savedAt, savedBy}.
   settings is a company settings object, the same shape as a
   companies/<id>/company.json file, checked by model/company.js.

   version goes up on every save (it is how two owners editing at once are
   told "someone saved first"). settings.cfg goes up only when something a
   customer can pick or pay for changes -- so fixing the phone number does
   not make every open designer out of date.

   Every save also writes price-list-history/<version>: who, when, a copy of
   the settings, and the changes in words ("Lofted Barn 10×16: $5,540 →
   $5,700"), so the owner can see and put back an earlier price list.

   Barnwright's saves (docs/OFFICE.md, "Barnwright setup access") use the
   same save with a few more steps: the lock first (setup-lock.js, handed in
   as `lock`), a copy of the price list in use kept before anything changes
   (ensureHistory: the save is refused when that copy can't be kept), and
   who saved it (savedBy: Barnwright, with the pass it came with).

   Going live: a save that leaves the 3D designer open to customers calls
   markLive (setup-access.js, handed in so this file stays free of it)
   BEFORE the price list is replaced. Only the owner can make that save, so
   one that then fails still counts as live, which is the safe way round. */

import { validate, validateManufacturer, resolve, strictProblems, swapNeedProblems, newSwapNeedProblems, SIZE_RE, ID_RE } from "../../model/company.js";
import { fail, OfficeError, text, phone as phoneField, email as emailField } from "./http.js";
import { describeChanges as builtChanges, describeExtraBuilt, liftRawRules, tidyBuilt } from "../../model/build-settings.js";
import { drawnOf } from "../../model/built-check.js";
import { checkChangedStyles, SAVE_BUDGET_MS } from "./built-check.js";
import { checkLayout } from "../../model/layout-check.js";
import { builderRecipe } from "../../model/loadout-twins.js";

/* The parts of the settings that change what a customer can pick or pay. */
const PRICE_PARTS = ["offer", "categories", "items", "options", "palettes", "construction", "built"];
const POLICY_PARTS = ["roundTo", "minCharge", "roofAreaFactor"];

export function priceFingerprint(settings) {
  const pricing = settings.pricing || {};
  return JSON.stringify([PRICE_PARTS.map((k) => settings[k] ?? null), POLICY_PARTS.map((k) => pricing[k] ?? null)]);
}

/* Does a customer's open design need to be told "prices or items have
   changed"? A How it's built number counts only when it changes what is
   drawn (model/built-check.js drawnOf): typing the standard's own 5/12 on
   the Utility Shed changes nothing a customer sees (review F9). */
function customerSeesChange(before, after, manufacturer) {
  const noBuilt = (s) => {
    const c = { ...s, built: undefined };
    if (s.offer && typeof s.offer === "object") {
      c.offer = {};
      for (const k of Object.keys(s.offer)) c.offer[k] = s.offer[k] && typeof s.offer[k] === "object" && !Array.isArray(s.offer[k]) ? { ...s.offer[k], built: undefined } : s.offer[k];
    }
    return c;
  };
  if (priceFingerprint(noBuilt(before)) !== priceFingerprint(noBuilt(after))) return true;
  try { return JSON.stringify(drawnOf(before, manufacturer)) !== JSON.stringify(drawnOf(after, manufacturer)); } catch (e) { return true; }
}

/* Limits on top of model/company.js: whole feet, sensible sizes and
   prices, so a typo cannot put a $5,540,000 shed or a 1×900 building on a
   lot's designer. The words are already the owner's. */
const PRICE_CAP = 1000000;

export function officeProblems(settings, manufacturer = {}) {
  const out = [];
  const M = manufacturer;
  const tooMuch = (what) => out.push(`${what} costs more than $1,000,000 — check that price.`);
  const priceOf = (v) => (v && typeof v === "object" ? v.price : v);
  for (const [key, entry] of Object.entries(settings.offer || {})) {
    if (key.startsWith("_")) continue;
    const style = (typeof entry?.name === "string" && entry.name.trim()) || M.styles?.[key]?.name || "A building style";
    for (const [size, price] of Object.entries(entry?.sizes || {})) {
      const m = SIZE_RE.exec(size);
      if (!m) continue;
      const w = Number(m[1]), l = Number(m[2]);
      const shown = size.replace("x", "×");
      if (!Number.isInteger(w) || !Number.isInteger(l) || w < 4 || w > 16 || l < 4 || l > 60 || /^0/.test(m[1]) || /^0/.test(m[2])) {
        out.push(`${style} ${shown} is not a size the designer can sell (width 4 to 16 ft, length 4 to 60 ft, whole feet).`);
      }
      if (typeof price === "number" && price > PRICE_CAP) tooMuch(`${style} ${shown}`);
    }
  }
  for (const [key, value] of Object.entries(settings.items || {})) {
    if (key.startsWith("_")) continue;
    const name = (value && typeof value === "object" && typeof value.name === "string" && value.name) || M.items?.[key]?.name || "A door or window";
    if (typeof priceOf(value) === "number" && priceOf(value) > PRICE_CAP) tooMuch(`The ${name}`);
  }
  for (const group of ["dormers", "ramps", "elec", "misc", "rates"]) {
    for (const [id, value] of Object.entries(settings.options?.[group] || {})) {
      if (id.startsWith("_") || !(typeof value === "number" && value > PRICE_CAP)) continue;
      tooMuch(optionWords(group, id, settings, M));
    }
  }
  if (Array.isArray(settings.options?.extras)) {
    for (const x of settings.options.extras) {
      if (x && typeof x.price === "number" && x.price > PRICE_CAP) tooMuch(typeof x.name === "string" && x.name ? x.name : "One of your extras");
    }
  }
  return out;
}

/* An option as the owner knows it: "6 ft dormer", "Electrical package 2". */
function optionWords(group, id, settings, M) {
  const own = settings.options?.[group]?.[id];
  if (own && typeof own === "object" && typeof own.name === "string" && own.name) return own.name;
  const def = M.options?.[group]?.[id];
  if (group === "elec") return `Electrical package ${def?.name?.replace(/^Option /, "") || ""}`.trim();
  return def?.name || { dormers: "A dormer", ramps: "A ramp", misc: "An option", rates: "An upgrade" }[group] || "An option";
}

/* model/company.js speaks in settings-file paths ("items.w48 needs a
   price: the 48″ Wooden Door (w48) comes as standard on the Lofted Barn
   (LB)..."). Owners see the same facts in their own words. Every sentence
   model/company.js can say has a rule below; one that has none (a new
   check added there later) becomes GENERAL, so a settings path or a code
   never reaches the owner. */
const GENERAL = "Part of the price list could not be saved. Reload the page and try again.";
const BRAND_WORDS = { short: "short name", initials: "initials", tagline: "tagline", phone: "phone", email: "email", website: "website", logo: "logo" };
const COLOR_GROUPS = { paint: "siding", trim: "trim", metal: "roof" };
const OPTION_GROUP_WORDS = { dormers: "dormers", ramps: "ramps", elec: "electrical packages", misc: "options", rates: "per-square-foot upgrades" };

export function explainProblem(problem, manufacturer, settings = {}) {
  const M = manufacturer || {};
  const S = settings && typeof settings === "object" ? settings : {};
  const styleName = (key) => {
    const own = S.offer?.[key]?.name;
    return (typeof own === "string" && own.trim()) || M.styles?.[key]?.name || "One of the building styles";
  };
  const itemName = (key) => {
    const own = S.items?.[key];
    return (own && typeof own === "object" && typeof own.name === "string" && own.name.trim()) || M.items?.[key]?.name || "door or window";
  };
  const extraName = (i) => {
    const x = Array.isArray(S.options?.extras) ? S.options.extras[Number(i)] : null;
    return (x && typeof x.name === "string" && x.name.trim()) || "One of your extras";
  };
  const sizeWords = (quoted) => {
    try { return String(JSON.parse(quoted)).replace("x", "×"); } catch { return "one size"; }
  };
  const colors = (g) => COLOR_GROUPS[g] || "color";
  const withoutCodes = (names) => names.replace(/ \([A-Za-z0-9_-]+\)/g, "");

  const rules = [
    /* How it's built (model/build-settings.js): its problems are already in
       the owner's words, after the settings path */
    [/^(?:offer\.\w+\.|options\.extras\[\d+\]\.)?built(?:\.\S+)?: (.*)$/, (m) => m[1]],
    [/^offer\.\w+\.layout(?:\S*)?: (.*)$/, (m) => m[1]],
    [/^construction\S*?: (The construction settings hold .+)$/, (m) => m[1]],
    /* a roof length the 3D designer cannot draw (model/construction.js
       roofValueProblems), already in the owner's words */
    [/^construction\S*?: (The [^{}]+)$/, (m) => m[1]],
    /* an extra's construction effect (model/company.js effectProblems) */
    [/^options\.extras\[(\d+)\]\.construction\S*: An option's construction settings hold the (.+?)\. Set it in How it's built/,
      (m) => `${extraName(m[1])}: set this extra's ${m[2]} in How it's built.`],
    [/^options\.extras\[(\d+)\]\.construction\S*?\.([^.\s\[\]]+) is not a construction setting(?:\. Did you mean (\w+)\?)?/,
      (m) => `${extraName(m[1])}: "${m[2]}" is not a construction setting.${m[3] ? ` Did you mean ${m[3]}?` : ""}`],
    [/^options\.extras\[(\d+)\]\.construction(\S*?): (.+)$/,
      (m) => `${extraName(m[1])}${settingWords(m[2]) ? ` (${settingWords(m[2])})` : ""}: ${/[{}]/.test(m[3]) ? "this construction setting is not written right." : m[3]}`],
    [/^options\.extras\[(\d+)\]\.construction must be/,
      (m) => `${extraName(m[1])}: how it changes the building could not be read. Take the extra out and add it again.`],
    [/^offer\.(\w+)\.\S+ is not part of a building style\. Set its (.+?) in How it's built instead\./,
      (m) => `${styleName(m[1])}: set its ${m[2]} in How it's built.`],
    [/^The company file is not a settings object/, () => "The price list is missing. Reload the page and try again."],
    [/^status must be/, () => "Pick whether the designer is open or closed to customers."],
    [/^manufacturer is /, () => "The builder's library cannot change here."],
    [/^brand is missing|^brand\.name is missing/, () => "The business name is needed."],
    [/^brand\.(\w+) must be text/, (m) => `The business ${BRAND_WORDS[m[1]] || "details"} must be written as text.`],
    [/^brand\.email /, () => "The business email does not look like an email address."],
    [/^brand\.website /, () => "The business website must be a web address that starts with https://."],
    [/^brand\.colors/, () => "One of the business colors is not a color. Pick it again."],
    [/^brand\.credit/, () => "The designer credit line could not be saved. Reload the page and try again."],

    [/^offer is empty/, () => "Sell at least one building style."],
    [/^offer\.(\w+): there is no style/, () => "One of the building styles is not in the builder's library. Reload the page and try again."],
    /* a style of the business's own, built like one of the library's */
    [/^offer\.(\w+) is the .+? manufacturer's own (.+?), so it cannot also be built like/,
      (m) => `The ${m[2]} is one of the builder's own styles, so it cannot be built like another one.`],
    [/^offer\.(\w+)(?: \(".*?"\))? is built like ".*?", which is itself built like/,
      (m) => `${styleName(m[1])} must be built like one of the builder's own styles.`],
    [/^offer\.(\w+)(?: \(".*?"\))? is built like ".*?", but the/,
      (m) => `${styleName(m[1])} is built like a style that is not in the builder's library. Pick another one to build it like.`],
    [/^offer\.(\w+) is built like the (.+?), so it needs a name of its own/,
      (m) => `A style built like the ${m[2]} needs a name of its own that customers see, like Premium ${m[2]}.`],
    [/^offer\.(\w+)\.name ".*?" is too long: .*? at most (\d+) letters/,
      (m) => `${styleName(m[1])} is too long a name for its button: use at most ${m[2]} letters.`],
    [/^offer\.(\w+) is called "(.+?)", the same name as/,
      (m) => `Two building styles are called ${m[2]}. Give each building style its own name.`],
    [/^offer\.(\w+): (?:a style's code|the code )/, () => "A new building style could not be saved. Reload the page and try again."],
    [/^offer\.(\w+): its standard doors and windows could not be worked out/, (m) => `${styleName(m[1])}: its standard doors and windows could not be worked out for one of its sizes. Check its sizes.`],
    [/^offer\.(\w+) must be \{/, (m) => `${styleName(m[1])} could not be saved. Reload the page and try again.`],
    [/^offer\.(\w+)\.name must be text/, (m) => `${M.styles?.[m[1]]?.name || "One of the building styles"} needs a name.`],
    [/^offer\.(\w+)\.sizes: no sizes/, (m) => `${styleName(m[1])} has no sizes. Add a size, or stop selling it.`],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: a size must be written/, (m) => `${styleName(m[1])}: ${sizeWords(m[2])} is not a size. Write it as width × length in feet, like 10×16.`],
    [/^offer\.(\w+)\.sizes\[(.+?)\] has no price/, (m) => `${styleName(m[1])} ${sizeWords(m[2])} needs a price.`],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: the price must be more than 0/, (m) => `${styleName(m[1])} ${sizeWords(m[2])} needs a price above $0. To stop selling a size, remove it.`],
    [/^offer\.(\w+)\.sizes\[(.+?)\]: the price must be/, (m) => `${styleName(m[1])} ${sizeWords(m[2])}: the price must be a dollar amount.`],

    [/^items is missing/, () => "Price the doors and windows you sell."],
    /* a door a building comes with that is not sold: the styles joined
       "A, B and C" (a swapped-in door's sentence already is, its sizes said
       once), then what to do (review DOORS-7) */
    [/^items\.(\w+) needs a price: the standard layout of the (.+?) uses the (.+?)'s size to place its doors, windows or posts\./,
      (m) => `The ${itemName(m[1])} needs a price: the standard layout of the ${withoutCodes(m[2])} uses its size to place doors, windows and posts. Sell it on Doors & windows ($0 is fine).`],
    [/^items\.(\w+) needs a price: the (.+?) \([A-Za-z0-9_-]+\) comes as standard on the (.+?)\. 0 is fine/,
      (m) => `The ${m[2]} comes with the ${swapNeedProblems(S, M).includes(problem) ? withoutCodes(m[3]) : withoutCodes(m[3]).replace(/, ([^,]+)$/, " and $1")}. Sell it on Doors & windows ($0 is fine).`],
    [/^items\.(\w+): there is no item/, () => "One of the doors or windows is not in the builder's library. Reload the page and try again."],
    [/^items\.(\w+) has no price/, (m) => `The ${itemName(m[1])} needs a price ($0 is fine).`],
    [/^items\.(\w+): the price must be/, (m) => `The ${itemName(m[1])} price must be a dollar amount, $0 or more.`],
    [/^items\.(\w+)\.name must be text/, (m) => `The ${M.items?.[m[1]]?.name || "door or window"} needs a name.`],

    [/^(.+?) (?:is|are) offered, so options\.dormers needs at least one dormer/,
      (m) => `${m[1]} ${/ are offered/.test(problem) ? "are" : "is"} sold, so at least one dormer size needs a price.`],
    [/^An electrical package places an? (.+?), so items\.\w+ needs a price/,
      (m) => `An electrical package puts in the ${m[1]}, so the ${m[1]} needs a price ($0 is fine).`],
    [/^options\.misc\.ext \(the exterior light\)/,
      () => `The exterior light option puts up the ${M.items?.light?.name || "outside light"}, so the ${M.items?.light?.name || "outside light"} needs a price ($0 is fine).`],
    [/^options\.extras\[(\d+)\]\.key .* is used twice/, () => "Two of your extras are the same. Remove one."],
    [/^options\.extras\[(\d+)\]\.name is missing/, () => "Every extra needs a name."],
    [/^options\.extras\[(\d+)\]\.input/, (m) => `Pick how ${extraName(m[1])} is charged.`],
    [/^options\.extras\[(\d+)\]\.price/, (m) => `${extraName(m[1])} needs a price, $0 or more.`],
    [/^options\.extras\[(\d+)\]\.styles/, (m) => `${extraName(m[1])}: pick again which buildings it is offered on.`],
    [/^options\.extras/, () => "One of your extras could not be saved. Reload the page and try again."],
    [/^options\.(\w+)\.([^:\s]+): the manufacturer has no/, (m) => `One of the ${OPTION_GROUP_WORDS[m[1]] || "options"} is not in the builder's library. Reload the page and try again.`],
    [/^options\.(\w+)\.([^:\s]+) has no price/, (m) => `${optionWords(m[1], m[2], S, M)} needs a price ($0 is fine).`],
    [/^options\.(\w+)\.([^:\s]+): the price must be/, (m) => `${optionWords(m[1], m[2], S, M)}: the price must be a dollar amount, $0 or more.`],

    [/^(.+?) \((\w+)\) is offered but in no category/, (m) => `The ${styleName(m[2])} is not in any group, so customers could never pick it. Put it in a group.`],
    [/^categories/, () => "Every building style must be in exactly one group."],

    [/^palettes\.(\w+) must be a list/, (m) => `Pick at least one ${colors(m[1])} color.`],
    [/^palettes\.(\w+)\[\d+\]: the manufacturer has no colour called "(.+?)"/, (m) => `${m[2]} is not a ${colors(m[1])} color we know. Give it a color, or pick another.`],
    [/^palettes\.(\w+)\[\d+\] must be/, (m) => `One of the ${colors(m[1])} colors could not be read. Pick it again.`],
    [/^palettes\.(\w+) lists "(.+?)" twice/, (m) => `${m[2]} is on the ${colors(m[1])} color list twice. Remove one.`],

    [/^defaults\.style/, () => "The building the designer opens on is not sold any more. Pick another one in Settings."],
    [/^defaults\.size/, () => "The size the designer opens on is not sold any more. Pick another one in Settings."],
    [/^defaults\.colors/, () => "The colors the designer opens on are not on the color lists any more. Pick them again in Settings."],
    [/^defaults\.dormer/, () => "The dormer the designer opens on is not sold any more. Pick another one in Settings."],
    [/^defaults\.porchLength/, () => "The porch the designer opens on must be 4 to 20 ft long, in whole feet."],

    /* the stricter rules (model/company.js strictProblems): a typo is named,
       with the setting it was most likely meant to be */
    [/^offer\.(\w+)\.(\S+) is not part of a building style(?:\. Did you mean (\w+)\?)?/,
      (m) => `${styleName(m[1])}: "${m[2]}" is not part of a building style.${m[3] ? ` Did you mean ${m[3]}?` : ""}`],
    [/^construction\S*?\.([^.\s\[\]]+) is not a construction setting(?:\. Did you mean (\w+)\?)?/,
      (m) => `"${m[1]}" is not a construction setting.${m[2] ? ` Did you mean ${m[2]}?` : ""}`],
    [/^construction\S*?\.([^.\s\[\]]+) is not a roof shape(?:\. Did you mean (\w+)\?)?/,
      (m) => `"${m[1]}" is not a roof shape.${m[2] ? ` Did you mean ${m[2]}?` : ""}`],
    [/^construction\S*?\.([^.\s\[\]]+) is not a building width/,
      (m) => `"${m[1]}" is not a building width. Write the width in whole feet, like 10.`],
    [/^construction\S*?\.(rise|lowerRise|upperRise|knee|ridge|dormerRise|left|right)(?:\[\d+\]\.value)?: .* is not a length/,
      () => "One of the roof sizes in the construction settings is not a length. Write it in feet."],
    [/^construction(\S*?): (.+)$/, (m) => `The construction setting${settingWords(m[1]) ? ` ${settingWords(m[1])}` : "s"}: ${/[{}]/.test(m[2]) ? "it is not written right." : m[2]}`],
    [/^construction(\S*)/, (m) => `The construction setting${settingWords(m[1]) ? ` ${settingWords(m[1])}` : "s"} ${settingWords(m[1]) ? "is" : "are"} not written right. Take ${settingWords(m[1]) ? "it" : "them"} out, or ask Barnwright to set ${settingWords(m[1]) ? "it" : "them"}.`],

    [/^pricing\.show/, () => "Pick how prices show on the designer: the full price, a starting price, or no price."],
    [/^pricing\.(roundTo|minCharge|roofAreaFactor)/, () => "The per-square-foot rounding could not be saved. Reload the page and try again."],
    [/^pricing\.rto\.showTerm/, () => "The rent-to-own term shown on the designer must be one of your terms."],
    [/^pricing\.rto\.note/, () => "The words under the rent-to-own price can be at most 300 letters."],
    [/^pricing\.rto/, () => "Each rent-to-own term needs a number of months and a factor between 0 and 1."],

    [/^notes\.finePrint/, () => "The line under the price must be written as text."],
    [/^notes\.sizeNotes/, () => "The notes for building widths must be written as text."],

    [/^leads\.fields/, () => "Pick Required, Optional or Off for each box on the quote form."],
    [/^leads\.smsConsent/, () => "The texting permission wording must be written as text."],
    [/^leads\.askPlan/, () => "Say whether the quote form asks what they want to do with the quote."],
    [/^leads/, () => "The quote form settings could not be saved. Reload the page and try again."],

    [/^embed/, () => "The websites allowed to show the designer must each be a full address that starts with https://, like https://mysite.com."],
    [/^look|^features/, () => "The designer's look could not be saved. Reload the page and try again."],
  ];
  for (const [pattern, say] of rules) {
    const m = pattern.exec(problem);
    if (m) return say(m);
  }
  return GENERAL;
}

/* -------------------------------------------------------------------- */
/* What changed, in words.                                               */

const fmtMoney = (n) => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
const fmtSize = (s) => String(s).replace("x", "×");
const priceOf = (v) => (v && typeof v === "object" ? v.price : v);
const keys = (o) => Object.keys(o || {}).filter((k) => !k.startsWith("_"));
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/* the same value whatever order its keys were written in */
function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

/* Words customers read, said in the change line itself (the owner's
   History, and what Alan reads before he says yes to a Barnwright change):
   the new words in full, up to TEXT_SHOWN letters, on one line. A change
   line stays under 400 letters, the most the Control Room passes on. */
const TEXT_SHOWN = 300;
function quoted(t) {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return `"${s.length > TEXT_SHOWN ? s.slice(0, TEXT_SHOWN - 1) + "…" : s}"`;
}
const textLine = (label, before, after) => {
  const a = typeof before === "string" ? before.trim() : "", b = typeof after === "string" ? after.trim() : "";
  if (a === b) return null;
  return b ? `${label}: ${quoted(b)}` : `${label}: taken off`;
};

/* An extra's price, the way it is charged: "$8 a foot", "5% of the building price". */
const EXTRA_UNITS = { check: "", qty: " each", lf: " a foot", sqftF: " a sq ft of floor", sqftW: " a sq ft of walls", sqftR: " a sq ft of roof" };
const chargeWords = (x) => (x?.input === "pct" ? `${Number(x.price)}% of the building price` : `${fmtMoney(x?.price)}${EXTRA_UNITS[x?.input] ?? ""}`);

const LAYOUT_WALLS = { F: "the front", R: "the right side", B: "the back", L: "the left side", IN: "inside", S1: "the porch", S2: "the porch", S3: "the porch", P1: "the porch", P2: "the porch", P3: "the porch" };
function layoutChanges(key, name, before, after, manufacturer, library) {
  const next = after.offer[key].layout;
  if (next == null) return [`Standard layout of the ${name}: went back to the builder's layout`];
  let old = before.offer?.[key]?.layout;
  if (!Array.isArray(old) && library) {
    try { old = builderRecipe(resolve(before, manufacturer, library), key); } catch { old = []; }
  }
  const had = Array.isArray(old) ? [...old] : [];
  const added = [];
  for (const entry of next) {
    const at = had.findIndex((e) => same(e, entry));
    if (at >= 0) had.splice(at, 1);
    else added.push(entry);
  }
  const facts = [];
  const itemWords = (e) => {
    const own = after.items?.[e.cat];
    const item = typeof own?.name === "string" && own.name.trim() || manufacturer.items?.[e.cat]?.name || "An item";
    return `${item} on ${LAYOUT_WALLS[e.wall] || "a wall"}`;
  };
  for (const e of added) {
    const moved = had.findIndex((o) => o.cat === e.cat && o.wall === e.wall);
    facts.push(`${itemWords(e)} ${moved >= 0 ? "moved" : "added"}`);
    if (moved >= 0) had.splice(moved, 1);
  }
  for (const e of had) facts.push(`${itemWords(e)} removed`);
  return [`Standard layout of the ${name}: ${facts.slice(0, 12).join("; ") || "kept the builder's doors, windows and porch posts"}${facts.length > 12 ? `; and ${facts.length - 12} more changes` : ""}`];
}

/* A rent-to-own term: the factor, and what it makes the monthly payment on
   a $5,000 building (the payment is the price / the factor / the months). */
const RTO_EXAMPLE = 5000;
const monthly = (f, m) => fmtMoney(Math.round((RTO_EXAMPLE / f / m) * 100) / 100);
const factorsOf = (rto) => {
  const f = rto && typeof rto.factors === "object" && rto.factors ? rto.factors : null;
  if (!f) return null;
  const out = new Map();
  for (const k of Object.keys(f).filter((k) => /^\d+$/.test(k)).sort((x, y) => Number(x) - Number(y))) out.set(Number(k), Number(f[k]));
  return out;
};
const termWords = (m, f) => `${m} months at ${f} (${monthly(f, m)} a month on ${fmtMoney(RTO_EXAMPLE)})`;
const termShown = (t) => (t == null ? "none" : `${t} months`);
function rtoChanges(before, after) {
  const out = [];
  const o = factorsOf(before), n = factorsOf(after);
  if (!o && n) {
    out.push(`Rent to own turned on: ${[...n].map(([m, f]) => termWords(m, f)).join("; ")}`);
    if (after?.showTerm != null) out.push(`Rent-to-own price shown on the 3D designer: ${termShown(after.showTerm)}`);
    return out;
  }
  if (o && !n) return ["Rent to own turned off"];
  if (!o || !n) return out;
  for (const m of [...new Set([...o.keys(), ...n.keys()])].sort((x, y) => x - y)) {
    if (!o.has(m)) out.push(`Rent to own: added ${termWords(m, n.get(m))}`);
    else if (!n.has(m)) out.push(`Rent to own: took off ${m} months`);
    else if (o.get(m) !== n.get(m)) out.push(`Rent to own ${m} months: ${o.get(m)} → ${n.get(m)} (${monthly(o.get(m), m)} → ${monthly(n.get(m), m)} a month on ${fmtMoney(RTO_EXAMPLE)})`);
  }
  if ((before?.showTerm ?? null) !== (after?.showTerm ?? null)) out.push(`Rent-to-own price shown on the 3D designer: ${termShown(before?.showTerm)} → ${termShown(after?.showTerm)}`);
  return out;
}

/* The quote form: its boxes, the plan question and the texting permission
   words, said one by one. */
const BOX_NAMES = { name: "name", phone: "phone", email: "email", zip: "ZIP", address: "street address", note: "note" };
function quoteFormChanges(before, after) {
  const out = [];
  const o = before || {}, n = after || {};
  const of = o.fields && typeof o.fields === "object" ? o.fields : {}, nf = n.fields && typeof n.fields === "object" ? n.fields : {};
  for (const k of [...new Set([...Object.keys(of), ...Object.keys(nf)])]) {
    if ((of[k] ?? "off") !== (nf[k] ?? "off")) out.push(`Quote form ${BOX_NAMES[k] || "box"} box: ${of[k] ?? "off"} → ${nf[k] ?? "off"}`);
  }
  if ((o.askPlan !== false) !== (n.askPlan !== false)) out.push(`Quote form asks what they want to do with the quote: ${o.askPlan !== false ? "yes" : "no"} → ${n.askPlan !== false ? "yes" : "no"}`);
  const sms = textLine("Texting permission words", o.smsConsent, n.smsConsent);
  if (sms) out.push(sms);
  const rest = (L) => { const { fields, askPlan, smsConsent, ...r } = L; return r; };
  const ro = rest(o), rn = rest(n);
  if (["mode", "url", "email"].some((k) => !same(ro[k], rn[k]))) out.push("Changed where quotes go");
  else if (!same(ro, rn)) out.push("Changed what the quote form asks for");
  return out;
}

/* The words for a change. options.contact says how the business phone,
   email and website are said: "full" (the owner's own History: old → new),
   "new" (Barnwright's door: only the new one, never the one the owner
   typed) or "hidden" (Barnwright's undo: neither). options.library: the
   builder's library (library/construction.json), which How it's built
   reads a style's numbers against. A style's own numbers Barnwright sets
   (set_built, set_roof_pitch) are How it's built numbers, so they are said
   with the rest of How it's built ("Utility Shed roof pitch: 5/12 → 7/12"). */
export function describeChanges(before, after, manufacturer, { contact = "full", library = null } = {}) {
  const out = [];
  const M = manufacturer;
  const styleName = (s, key) => s.offer?.[key]?.name || M.styles?.[key]?.name || s.offer?.[key]?.base && M.styles?.[s.offer[key].base]?.name || key;
  const itemName = (s, key) => (s.items?.[key] && typeof s.items[key] === "object" && s.items[key].name) || M.items?.[key]?.name || key;

  const b = before.brand || {}, a = after.brand || {};
  for (const [k, word] of [["name", "Business name"], ["short", "Short name"], ["initials", "Initials"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"]]) {
    if ((b[k] || "") === (a[k] || "")) continue;
    if (contact !== "full" && ["phone", "email", "website"].includes(k)) out.push(!a[k] ? `${word}: taken off` : contact === "new" ? `${word}: changed to ${a[k]}` : `${word}: changed`);
    else out.push(`${word}: ${b[k] || "(blank)"} → ${a[k] || "(blank)"}`);
  }
  const tagline = textLine("Tagline", b.tagline, a.tagline);
  if (tagline) out.push(tagline);
  if ((b.logo || "") !== (a.logo || "")) out.push(a.logo ? "New logo" : "Removed the logo");
  if (!same(b.colors, a.colors)) out.push("Changed the business colors");
  if ((before.status || "active") !== (after.status || "active")) {
    out.push(after.status === "suspended" ? "Closed the designer to customers" : "Opened the designer to customers");
  }

  /* buildings */
  const oldStyles = keys(before.offer), newStyles = keys(after.offer);
  for (const k of newStyles) if (!oldStyles.includes(k)) {
    const sizes = keys(after.offer[k].sizes);
    const base = after.offer[k].base ? ` (built like the ${M.styles?.[after.offer[k].base]?.name || after.offer[k].base})` : "";
    out.push(`Started selling the ${styleName(after, k)}${base} in ${sizes.length} size${sizes.length === 1 ? "" : "s"}`);
    if (Array.isArray(after.offer[k].layout)) out.push(...layoutChanges(k, styleName(after, k), before, after, manufacturer, library));
  }
  for (const k of oldStyles) if (!newStyles.includes(k)) out.push(`Stopped selling the ${styleName(before, k)}`);
  for (const k of newStyles) {
    if (!oldStyles.includes(k)) continue;
    const o = before.offer[k], n = after.offer[k];
    if ((o.name || "") !== (n.name || "")) out.push(`The ${styleName(before, k)} is now called the ${styleName(after, k)}`);
    const name = styleName(after, k);
    if (!same(o.layout, n.layout)) {
      out.push(...layoutChanges(k, name, before, after, manufacturer, library));
    }
    /* which library style a style of their own is built like: its shape */
    if ((o.base || null) !== (n.base || null)) {
      const like = (b) => M.styles?.[b]?.name || b;
      out.push(n.base ? `${name}: now built like the ${like(n.base)}${o.base ? ` (was the ${like(o.base)})` : ""}` : `${name}: no longer built like the ${like(o.base)}`);
    }
    const os = o.sizes || {}, ns = n.sizes || {};
    for (const z of keys(ns)) {
      if (!(z in os)) out.push(`${name}: added ${fmtSize(z)} at ${fmtMoney(ns[z])}`);
      else if (os[z] !== ns[z]) out.push(`${name} ${fmtSize(z)}: ${fmtMoney(os[z])} → ${fmtMoney(ns[z])}`);
    }
    for (const z of keys(os)) if (!(z in ns)) out.push(`${name}: removed ${fmtSize(z)}`);
  }
  /* Starting or stopping a style moves it in or out of its group; only a
     real regrouping of the styles sold both before and after is news. A
     group's name is words customers read, so a new one is said. */
  const kept = (cats) => (Array.isArray(cats) ? cats : [])
    .map((g) => [g?.[0], (Array.isArray(g?.[1]) ? g[1] : []).filter((k) => oldStyles.includes(k) && newStyles.includes(k))])
    .filter((g) => g[1].length);
  const groupNames = (cats) => (Array.isArray(cats) ? cats : []).map((g) => g?.[0]).filter((n) => typeof n === "string" && n);
  const oldGroups = groupNames(before.categories), newGroups = groupNames(after.categories);
  for (const g of newGroups) if (!oldGroups.includes(g)) out.push(`New building group ${quoted(g)}`);
  for (const g of oldGroups) if (!newGroups.includes(g)) out.push(`Took away the building group ${quoted(g)}`);
  if (Array.isArray(before.categories) !== Array.isArray(after.categories) || !same(kept(before.categories), kept(after.categories))) {
    out.push("Changed how buildings are grouped");
  }

  /* doors, windows, fixtures */
  const oi = before.items || {}, ni = after.items || {};
  for (const k of keys(ni)) {
    if (!(k in oi)) out.push(`Started selling the ${itemName(after, k)} at ${fmtMoney(priceOf(ni[k]))}`);
    else if (priceOf(oi[k]) !== priceOf(ni[k])) out.push(`${itemName(after, k)}: ${fmtMoney(priceOf(oi[k]))} → ${fmtMoney(priceOf(ni[k]))}`);
    else if (itemName(before, k) !== itemName(after, k)) out.push(`The ${itemName(before, k)} is now called the ${itemName(after, k)}`);
  }
  for (const k of keys(oi)) if (!(k in ni)) out.push(`Stopped selling the ${itemName(before, k)}`);

  /* options */
  const groups = { dormers: "dormer", ramps: "ramp", elec: "electrical package", misc: "", rates: "" };
  for (const [g] of Object.entries(groups)) {
    const og = before.options?.[g] || {}, ng = after.options?.[g] || {};
    const optName = (s, id) => {
      const v = s.options?.[g]?.[id];
      if (v && typeof v === "object" && v.name) return v.name;
      const def = M.options?.[g]?.[id];
      if (g === "elec") return `Electrical package ${def?.name?.replace(/^Option /, "") || id}`;
      return def?.name || id;
    };
    const fmt = (v) => (g === "rates" ? `${fmtMoney(priceOf(v))} a sq ft` : fmtMoney(priceOf(v)));
    for (const id of keys(ng)) {
      if (!(id in og)) out.push(`Started offering ${optName(after, id)} at ${fmt(ng[id])}`);
      else if (priceOf(og[id]) !== priceOf(ng[id])) out.push(`${optName(after, id)}: ${fmt(og[id])} → ${fmt(ng[id])}`);
      else if (optName(before, id) !== optName(after, id)) out.push(`${optName(before, id)} is now called ${optName(after, id)}`);
    }
    for (const id of keys(og)) if (!(id in ng)) out.push(`Stopped offering ${optName(before, id)}`);
  }
  const ox = new Map((before.options?.extras || []).map((x) => [x.key, x]));
  const nx = new Map((after.options?.extras || []).map((x) => [x.key, x]));
  /* "Steep roof is offered on the Utility Shed and Side Utility" */
  const offeredOn = (x) => {
    if (!Array.isArray(x.styles)) return `${x.name} is offered on every building`;
    const names = x.styles.map((k) => styleName(after, k));
    return `${x.name} is offered on the ${names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1]}`;
  };
  for (const [k, x] of nx) {
    const old = ox.get(k);
    const built = describeExtraBuilt(x.name, old?.built, x.built);
    const where = (!old ? Array.isArray(x.styles) : !same(old.styles, x.styles)) ? [offeredOn(x)] : [];
    if (!old) { out.push(`Added the extra "${x.name}" at ${chargeWords(x)}`, ...built, ...where); continue; }
    if (same(old, x)) continue;
    const before0 = out.length;
    if (old.name !== x.name) out.push(`The extra "${old.name}" is now called "${x.name}"`);
    if (old.price !== x.price || old.input !== x.input) out.push(`${x.name}: ${chargeWords(old)} → ${chargeWords(x)}`);
    out.push(...built, ...where);
    if (out.length === before0) out.push(`Changed the extra "${x.name}"`);
  }
  for (const [k, x] of ox) if (!nx.has(k)) out.push(`Removed the extra "${x.name}"`);

  /* colors */
  const words = { paint: "Siding colors", trim: "Trim colors", metal: "Roof colors" };
  for (const [g, word] of Object.entries(words)) {
    const name = (c) => (Array.isArray(c) ? c[0] : c);
    const olist = (before.palettes?.[g] || M.palettes?.[g] || []).map(name);
    const nlist = (after.palettes?.[g] || M.palettes?.[g] || []).map(name);
    const added = nlist.filter((c) => !olist.includes(c)), removed = olist.filter((c) => !nlist.includes(c));
    if (added.length || removed.length) {
      out.push(`${word}: ${[added.length ? "added " + added.join(", ") : "", removed.length ? "removed " + removed.join(", ") : ""].filter(Boolean).join("; ")}`);
    }
  }

  /* how the designer shows things */
  const showWords = { price: "the full price", from: "a starting price", none: "no price" };
  if ((before.pricing?.show || "price") !== (after.pricing?.show || "price")) {
    out.push(`The designer shows ${showWords[after.pricing?.show || "price"]} (was ${showWords[before.pricing?.show || "price"]})`);
  }
  out.push(...rtoChanges(before.pricing?.rto, after.pricing?.rto));
  const rtoNote = textLine("The words under the rent-to-own price", before.pricing?.rto?.note, after.pricing?.rto?.note);
  if (rtoNote) out.push(rtoNote);
  for (const k of POLICY_PARTS) if ((before.pricing?.[k] ?? null) !== (after.pricing?.[k] ?? null)) out.push("Changed how per-square-foot prices are rounded");
  const fine = textLine("The line under the price", before.notes?.finePrint, after.notes?.finePrint);
  if (fine) out.push(fine);
  const on = before.notes?.sizeNotes || {}, nn = after.notes?.sizeNotes || {};
  for (const w of [...new Set([...keys(on), ...keys(nn)])].sort((x, y) => Number(x) - Number(y))) {
    const line = textLine(`The note for ${w} ft wide buildings`, on[w], nn[w]);
    if (line) out.push(line);
  }
  if (!same(before.defaults, after.defaults)) out.push("Changed the building the designer opens on");
  out.push(...quoteFormChanges(before.leads, after.leads));
  if (!same(before.features, after.features) || !same(before.look, after.look)) out.push("Changed how the designer looks");

  /* How it's built: "Lofted Barn wall height: 6 ft 8 in → 7 ft" */
  out.push(...builtChanges(before, after, M, library));

  /* an older roof pitch rule list moved into How it's built (liftRawRules)
     is the same building: the save says so in its own line */
  const asBuilt = (s) => {
    const l = liftRawRules(s, M).settings;
    if (!l?.construction || typeof l.construction !== "object" || Object.keys(l.construction).length) return l;
    const { construction, ...rest } = l;
    return rest;
  };
  if (!out.length && !same(asBuilt(before), asBuilt(after))) out.push("Changed other settings");
  return [...new Set(out)];
}

/* -------------------------------------------------------------------- */

const SAVED_FIRST = "Someone else saved the price list while you were working. Reload to see their changes, then make yours again.";
/* No clock time in the words: the answer carries savedAt and the browser
   shows it in the owner's own time. */
export const BARNWRIGHT_SAVED_FIRST = "Barnwright saved a change while you were working. Reload to see it, then make yours again.";
export const NO_COPY = "Couldn't keep a copy of the current price list first, so nothing was changed. Try again.";
const KEPT_COPY = "A copy kept before Barnwright changed the price list";

const historyKey = (version) => `price-list-history/${String(version).padStart(6, "0")}`;

/* Before the owner first signs in (docs/OFFICE.md): the history line of the
   starting price list Barnwright makes from the owner's sign-up. */
export const START_LINE = "Started the price list from Every standard building, at example prices";

/* The short name and initials worked out from a business name. */
function brandNames(businessName) {
  const words = businessName.split(/\s+/).filter(Boolean);
  return {
    short: businessName.length > 24 ? words.slice(0, 2).join(" ") : businessName,
    initials: words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "SB",
  };
}

/* A construction setting's path in plain words: ".walls.topPlates" -> "top
   plates", ".floor.spacingIn[1].value" -> "floor spacing in inches". */
function settingWords(path) {
  const bits = String(path || "").replace(/\[\d+\]/g, "").split(".").filter((b) => b && b !== "value" && b !== "shapes");
  if (!bits.length) return "";
  const last = bits[bits.length - 1], group = bits.length > 1 ? bits[bits.length - 2] : "";
  const words = (w) => w.replace(/In$/, " in inches").replace(/Ft$/, " in feet").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  const one = words(last);
  return group && !/^\d+$/.test(group) && /^(spacing|size|type)/i.test(last) ? `${words(group)} ${one}` : one;
}

/* A strict problem with an extra's place in the list (options.extras[3])
   swapped for the extra's own key, so moving, adding or removing another
   extra never makes an old problem look new (an older price list keeps
   saving). */
function byExtraKey(settings, problem) {
  return String(problem).replace(/^options\.extras\[(\d+)\]/, (m, i) => {
    const x = Array.isArray(settings?.options?.extras) ? settings.options.extras[Number(i)] : null;
    return x && typeof x === "object" && typeof x.key === "string" ? `options.extras[key=${x.key}]` : m;
  });
}

export function createPriceList({ store, manufacturer, library, templates, now, log = console.error, markLive = null, sizeCheckMs = SAVE_BUDGET_MS }) {
  const iso = () => now().toISOString();

  /* someone saved first: who, when the save that got in was Barnwright's */
  function savedFirst(record) {
    const by = record?.data?.savedBy;
    if (by?.id === "barnwright") fail(409, BARNWRIGHT_SAVED_FIRST, { savedAt: record.data.savedAt || null });
    fail(409, SAVED_FIRST);
  }

  /* -> the resolved catalogue, or a 422 listing the problems in words.
     previous: the price list this one replaces. The stricter rules
     (strictProblems) refuse only what previous did not already have, so an
     older price list keeps saving price changes and an old copy can always
     be put back. With no previous at all (a check of a draft), the strict
     problems are not refused. */
  function check(settings, previous) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) fail(422, "The price list is missing. Reload the page and try again.");
    const modelProblems = [...validateManufacturer(manufacturer), ...validate(settings, manufacturer)];
    const fresh = newStrictProblems(settings, previous);
    const words = [...new Set([
      ...modelProblems.map((p) => explainProblem(p, manufacturer, settings)),
      ...fresh.map((p) => explainProblem(p, manufacturer, settings)),
      ...officeProblems(settings, manufacturer),
    ])];
    if (words.length) {
      const err = new OfficeError(422, words.slice(0, 8).join(" ") + (words.length > 8 ? ` (and ${words.length - 8} more)` : ""));
      err.problems = words;
      throw err;
    }
    return resolve(settings, manufacturer, library);
  }

  /* The strict problems settings has that previous did not (same path,
     same words); [] when there is no previous to compare with. previous
     may be a list: what any of them had is not new. A door a building
     comes with at some sizes (the 48 in Wooden Door) is compared by style
     and size, not by its sentence, so taking a style or size off, or
     renaming a style of their own, is never a new problem (review
     DOORS-2). */
  function newStrictProblems(settings, previous) {
    if (previous === undefined) return [];
    const had = new Set();
    const before = (Array.isArray(previous) ? previous : [previous]).filter((p) => p && typeof p === "object");
    for (const p of before) for (const x of strictProblems(p, manufacturer)) had.add(byExtraKey(p, x));
    const swaps = new Set(swapNeedProblems(settings, manufacturer));
    const freshSwaps = new Set(newSwapNeedProblems(settings, before, manufacturer));
    return strictProblems(settings, manufacturer).filter((p) => (swaps.has(p) ? freshSwaps.has(p) : !had.has(byExtraKey(settings, p))));
  }

  async function current() {
    return store.read("price-list");
  }

  /* The record as the routes send it. cfg is repeated at the top so the
     screens need not dig for it. */
  async function get() {
    const r = await current();
    if (!r) fail(404, "The price list has not been set up yet.");
    return { ...r.data, cfg: r.data.settings.cfg };
  }

  /* The resolved catalogue for pricing (cached per version). */
  let cached = null;
  const olderCatalogues = new Map();
  /* the History copy's own settings, for a lot's 3D designer opening an
     older design (website.js publicLot) */
  const olderSettings = new WeakMap();
  /* Which History copy holds each older cfg, learnt as copies are read.
     History copies never change, so each is read at most once per running
     server: the copies read so far are always the newest ones (from hi down
     to lo), a later save only adds newer ones, and when every copy has been
     read an unknown cfg costs nothing (review 17 P3/CS-3: anyone sending an
     older cfg on the public quote form made the server read the whole
     History again). */
  const pastCfgs = { byCfg: new Map(), hi: null, lo: null, all: false, version: null, names: [] };
  function learn(key, entry) {
    const cfg = entry?.settings?.cfg;
    if (!Number.isSafeInteger(cfg) || (cached && entry.settings.id !== cached.cat.id)) return;
    /* every copy with this cfg, newest first, so an unreadable newest copy
       falls back to the next older one as the old lookup did */
    const keys = pastCfgs.byCfg.get(cfg) || [];
    if (!keys.includes(key)) { keys.push(key); keys.sort().reverse(); }
    pastCfgs.byCfg.set(cfg, keys);
  }
  async function readHistory(keys) {
    for (let i = 0; i < keys.length; i += 16) {
      const batch = keys.slice(i, i + 16);
      const entries = await Promise.all(batch.map((key) => store.get(key)));
      entries.forEach((entry, j) => learn(batch[j], entry));
    }
  }
  /* The History copies with this cfg, newest first: at least `need` of
     them, or every one there is. */
  async function historyKeysFor(cfg, version, need = 1) {
    if (pastCfgs.version !== version) {
      pastCfgs.names = (await store.keys("price-list-history/")).sort().reverse();
      pastCfgs.version = version;
    }
    const names = pastCfgs.names;
    const found = () => (pastCfgs.byCfg.get(cfg) || []).length >= need;
    if (pastCfgs.hi === null) {
      /* nothing read yet: newest first, stopping once enough are found */
      for (let i = 0; i < names.length && !found(); i += 16) {
        await readHistory(names.slice(i, i + 16));
        pastCfgs.hi = names[0]; pastCfgs.lo = names[Math.min(i + 15, names.length - 1)];
      }
      if (pastCfgs.lo === names[names.length - 1]) pastCfgs.all = true;
      return pastCfgs.byCfg.get(cfg) || [];
    }
    /* copies saved since: read them all, so the copies read stay the newest */
    const newer = names.filter((key) => key > pastCfgs.hi);
    if (newer.length) { await readHistory(newer); pastCfgs.hi = names[0]; }
    if (found() || pastCfgs.all) return pastCfgs.byCfg.get(cfg) || [];
    const older = names.filter((key) => key < pastCfgs.lo);
    for (let i = 0; i < older.length && !found(); i += 16) {
      await readHistory(older.slice(i, i + 16));
      pastCfgs.lo = older[Math.min(i + 15, older.length - 1)];
    }
    if (!older.length || pastCfgs.lo === older[older.length - 1]) pastCfgs.all = true;
    return pastCfgs.byCfg.get(cfg) || [];
  }
  async function catalogue({ cfg = null, company = null } = {}) {
    const record = await get();
    if (cached?.version !== record.version) cached = { version: record.version, cat: resolve(record.settings, manufacturer, library), record };
    if (!Number.isSafeInteger(cfg) || cfg < 1 || cfg >= cached.cat.cfg || (company !== null && company !== cached.cat.id)) return cached;
    /* An older saved design keeps what its own price list included. The
       browser's cfg only asks for a record: the allowance always comes
       from a copy the server itself kept, never from browser item flags.
       The newest History copy with that cfg that resolves is used, and an
       immutable cfg is cached. */
    let includedCat = olderCatalogues.get(cfg);
    if (!includedCat) {
      /* newest first; a copy that no longer resolves is passed over for
         the next older one with the same cfg */
      for (let tried = 0; !includedCat; tried++) {
        const keys = await historyKeysFor(cfg, record.version, tried + 1);
        if (tried >= keys.length) break;
        const entry = await store.get(keys[tried]);
        if (entry?.settings?.cfg !== cfg || entry.settings.id !== cached.cat.id) continue;
        try { includedCat = resolve(entry.settings, manufacturer, library); olderSettings.set(includedCat, entry.settings); } catch { /* an unreadable older copy gives no allowance */ }
      }
      if (includedCat) {
        olderCatalogues.set(cfg, includedCat);
        if (olderCatalogues.size > 16) olderCatalogues.delete(olderCatalogues.keys().next().value);
      }
    }
    return includedCat ? { ...cached, includedCat, includedSettings: olderSettings.get(includedCat) } : cached;
  }

  function layoutStyle(record, style) {
    if (typeof style !== "string" || !/^[A-Za-z0-9]{1,8}$/.test(style) || !Object.prototype.hasOwnProperty.call(record.settings.offer || {}, style)) {
      fail(404, "This building isn't on your price list. Tap Add a building to sell it.");
    }
    return record.settings.offer[style];
  }

  /* The owner gets the same resolved building every lot opens on. A
     builder's named recipe is offered as editable data, without changing
     an older price list merely because this page was opened. */
  async function layoutMode(style, lots = []) {
    const { cat, record } = await catalogue();
    const offer = layoutStyle(record, style);
    const sizes = Object.keys(cat.P[style]);
    const openingSize = sizes.includes(cat.defaults.size) ? cat.defaults.size : sizes[Math.min(4, sizes.length - 1)];
    const own = Array.isArray(offer.layout);
    const layout = own ? structuredClone(offer.layout) : builderRecipe(cat, style);
    if (!Array.isArray(layout)) fail(422, "This building's standard layout could not be opened. Ask Barnwright to check it.");
    return {
      style, name: cat.TYPES[style].name, sizes, layout, own, version: record.version,
      companyId: cat.id, colors: { body: cat.defaults.body, trim: cat.defaults.trim, roof: cat.defaults.roof },
      openingSize, catalogue: cat, lotSlug: lots.find((l) => l.active !== false)?.slug || null,
    };
  }

  /* The layout route changes only the chosen building's recipe. It must
     still save against the version the owner opened, through prepared()
     and the same compare-and-replace write as the whole price list. */
  async function layoutSettings({ style, layout }) {
    const record = await get();
    layoutStyle(record, style);
    if (layout !== null && !Array.isArray(layout)) fail(422, "The standard layout could not be read. Open it again and try saving.");
    const settings = structuredClone(record.settings);
    if (layout === null) delete settings.offer[style].layout;
    else settings.offer[style].layout = structuredClone(layout);
    return settings;
  }

  function clean(settings) {
    const copy = structuredClone(settings);
    for (const k of Object.keys(copy)) if (k.startsWith("_")) delete copy[k];
    return copy;
  }

  /* A history entry is a copy kept for the owner. The save itself has
     already happened when it is written, so a history entry that cannot be
     written is logged instead of telling the owner the save failed (they
     would save again and be told someone else saved first). */
  async function keepHistory(entry) {
    try {
      await store.put(historyKey(entry.version), entry);
    } catch (e) {
      log("A price list history entry could not be saved:", e);
    }
  }

  /* Before a Barnwright save: the price list in use now must be in the
     history (it can always be put back). Written now when it is missing;
     when that can't be done, nothing is saved (503). */
  async function keepCopy(data) {
    try {
      if (await store.get(historyKey(data.version))) return;
      await store.create(historyKey(data.version), {
        version: data.version, savedAt: data.savedAt, savedBy: data.savedBy, changes: [KEPT_COPY], settings: data.settings,
      });
    } catch (e) {
      log("A copy of the price list could not be kept before a Barnwright change:", e?.name || "Error");
      fail(503, NO_COPY, { code: "no-copy" });
    }
  }

  /* The settings a business starts on: one of the example files, closed to
     customers, with the business's name, phone, email and website. Nothing
     is written. */
  function startingSettings({ businessName, phone, email, website, start }) {
    const template = templates[start === "small" ? "small" : "full"];
    if (!template) fail(422, "Pick a starting price list.");
    const settings = clean(template);
    const slug = String(businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
    settings.id = ID_RE.test(slug) ? slug : "business";
    settings.status = "suspended";
    settings.brand = {
      ...settings.brand,
      name: businessName,
      ...brandNames(businessName),
      tagline: "Portable storage buildings",
      phone, email, website, logo: "",
      colors: { header: "#16130E", primary: "#2E2920", accent: "#C9A227" },
      credit: { text: "3D designer by Barnwright", url: "", show: true },
    };
    settings.leads = {
      mode: "none",
      fields: { name: "required", phone: "required", email: "optional", zip: "required", address: "optional", note: "optional" },
      smsConsent: "Yes, you may text me about this quote. Message and data rates may apply. Reply STOP to stop.",
      images: false,
    };
    settings.embed = { origins: [] };
    delete settings.license;
    settings.notes = { finePrint: "Prices plus tax. Delivery and setup included within our area.", sizeNotes: settings.notes?.sizeNotes || {} };
    settings.cfg = 1;
    check(settings, null);
    return settings;
  }

  /* A starting price list from one of the example files, made create-only
     as version 1 by the owner: the owner's start (index.js, "Every standard
     building") and POST setup (the sample business and the checks). */
  async function setup(by, { businessName, phone, email, website, start }) {
    if (await current()) fail(409, "The business is already set up.");
    const settings = startingSettings({ businessName, phone, email, website, start });
    const record = { settings, version: 1, cfg: 1, savedAt: iso(), savedBy: { id: by.userId, name: by.name || by.email } };
    if (!(await store.create("price-list", record))) fail(409, "The business is already set up.");
    await keepHistory({ version: 1, savedAt: record.savedAt, savedBy: record.savedBy, changes: ["Set up the business with a starting price list"], settings });
    return record;
  }

  /* Before the owner first signs in (docs/OFFICE.md): the starting price
     list made from the owner's sign-up, the "Every standard building"
     template set up the way setup() sets up a business, with the business
     name, phone and email they gave on the sign-up page. The phone and
     email are what the business's own checks give (trimmed, the email in
     lower case); one those checks would refuse is left empty. Never a
     website. Nothing is written. Barnwright's start uses it, and so does
     the owner's start (index.js) with the remembered sign-up. */
  function signupStart(signup) {
    const or = (fn) => { try { return fn(); } catch { return ""; } };
    return startingSettings({
      businessName: text(signup?.business, 80, "Business name", { required: true }),
      phone: or(() => phoneField(signup?.phone, "Business phone")),
      email: or(() => emailField(signup?.email, "Business email")),
      website: "", start: "full",
    });
  }

  /* ... and making it: version 1, saved by Barnwright (savedBy), with a
     create-only write. -> the record, or null when a price list exists
     already. startForOwner is the same, saved by the owner (their start,
     index.js). */
  async function startForBarnwright(settings, savedBy) {
    const record = { settings, version: 1, cfg: settings.cfg, savedAt: iso(), savedBy };
    if (!(await store.create("price-list", record))) return null;
    await keepHistory({ version: 1, savedAt: record.savedAt, savedBy, changes: [START_LINE], settings });
    return record;
  }

  /* The save worked out without writing anything: the settings it would
     store (cfg worked out), the changes in words and the every-size check
     of How it's built (sizeCheck). Throws what save() would (409 someone
     saved first, 422 problems in the owner's words, 422 what the
     business's own building numbers cause at some size). lock(old, next)
     -> [words] runs first, for Barnwright, so a refused change never runs
     the size check. lead: a first change line of its own (Barnwright's
     undo). restoredFrom: the copy being put back (the stricter rules
     compare with it). mixedFrom: that copy as it was kept, when putting it
     back carried parts of the price list in use forward (Barnwright's put
     back, setup-lock.js carryLocked): the mix was never saved, so it is
     checked like a save, and only what the copy itself (or the price list
     in use, for the stricter rules) already had is let through. */
  function prepared(previous, settings, version, { restoring = null, restoredFrom = undefined, mixedFrom = undefined, lock = null, lead = null } = {}) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) fail(422, "The price list is missing. Reload the page and try again.");
    if (!previous) fail(404, "The price list has not been set up yet.");
    if (version !== previous.data.version) savedFirst(previous);
    let next = clean(settings);
    const old = previous.data.settings;
    if (lock) {
      const words = [...new Set(lock(old, next))];
      if (words.length) {
        const err = new OfficeError(422, words.join(" "));
        err.problems = words;
        err.locked = true;
        throw err;
      }
    }
    if (next.id !== old.id) fail(422, "This price list belongs to a different business. Reload the page and try again.");
    if (next.manufacturer !== old.manufacturer) fail(422, "The builder's library cannot change here.");
    /* a roof pitch rule list the Barnwright setup connector wrote moves into
       How it's built (model/build-settings.js liftRawRules): the same roof */
    const lifted = liftRawRules(next, manufacturer);
    next = lifted.settings === next ? next : clean(lifted.settings);
    /* How it's built numbers are stored as numbers ("5/12" as 5) */
    const tidied = tidyBuilt(next, manufacturer);
    next = tidied === next ? next : clean(tidied);
    next.cfg = customerSeesChange(liftRawRules(old, manufacturer).settings, next, manufacturer) ? (old.cfg || 1) + 1 : old.cfg;
    /* a stricter rule refuses only what is new: compared with the stored
       price list, or, when putting an old copy back, with that copy */
    const cat = check(next, mixedFrom !== undefined ? [mixedFrom, old] : restoredFrom !== undefined ? restoredFrom : old);
    /* How it's built: every style whose numbers of the business's own
       changed is drawn at every size (server/office/built-check.js). What
       those numbers cause refuses the save; putting back an old copy is
       never refused (what it finds is said instead), unless the put back
       carried parts forward: then what the copy didn't already cause is
       refused (review SEC-BUILT-1). */
    const sizeCheck = sizeCheckOf(old, next, cat, { refuse: !restoring, mixedFrom });
    const changes = describeChanges(old, next, manufacturer, { library });
    if (lifted.moved.length) changes.push(...lifted.moved);
    if (restoring) changes.unshift(`Put back the price list saved ${restoring}`);
    if (lead && changes.length) changes.unshift(lead);
    return { next, changes, sizeCheck };
  }

  /* -> {next, changes, version}: what saving these settings over `version`
     would store, with nothing written. */
  async function preview(settings, version, { previous: given, ...options } = {}) {
    /* given: the price list to work from instead of the one in use (the
       starting price list at version 0, before there is one) */
    const previous = given !== undefined ? given : await current();
    return { ...prepared(previous, settings, version, options), version: previous?.data.version ?? null };
  }

  /* Save the whole price list. The browser sends the version it started
     from; if someone else saved since, nothing is written (409).
     options: restoring (the day of the price list put back), restoredFrom
     (that copy), lock, lead, savedBy (who, when it isn't `by`:
     Barnwright), ensureHistory (keep a copy of the one in use first, or
     refuse). */
  async function save(by, { settings, version }, { restoring = null, restoredFrom = undefined, mixedFrom = undefined, lock = null, lead = null, savedBy = null, ensureHistory = false } = {}) {
    const previous = await current();
    const { next, changes, sizeCheck } = prepared(previous, settings, version, { restoring, restoredFrom, mixedFrom, lock, lead });
    const old = previous.data.settings;
    if (!changes.length) return { ...previous.data, cfg: old.cfg, changes: [], sizeCheck };
    if (ensureHistory) await keepCopy(previous.data);
    if (next.status !== "suspended" && markLive) await markLive("opened");
    const record = { settings: next, version: previous.data.version + 1, cfg: next.cfg, savedAt: iso(), savedBy: savedBy || { id: by.userId, name: by.name || by.email } };
    if (!(await store.replace("price-list", previous, record))) savedFirst(await current());
    await keepHistory({ version: record.version, savedAt: record.savedAt, savedBy: record.savedBy, changes, settings: next });
    return { ...record, changes, sizeCheck };
  }

  /* -> {checked, warnings, unchecked, problems} for the screen; refuses
     (422) when the business's own numbers cause a problem at some size. */
  function sizeCheckOf(old, next, cat, { refuse, mixedFrom = undefined }) {
    const before = liftRawRules(old, manufacturer).settings;
    const t0 = performance.now();
    const layoutReports = [];
    let catBefore = null;
    if (Object.values(next.offer).some((o) => Array.isArray(o?.layout))) {
      try { catBefore = resolve(before, manufacturer, library); } catch { /* an older unreadable list has no previous shapes */ }
    }
    const shape = (t) => t ? { ...t, name: undefined } : null;
    for (const key of Object.keys(next.offer)) {
      const own = Array.isArray(next.offer[key]?.layout);
      const changed = !same(before.offer?.[key]?.layout, next.offer[key]?.layout);
      const sizesChanged = !same(Object.keys(before.offer?.[key]?.sizes || {}), Object.keys(next.offer[key]?.sizes || {}));
      if (!changed && !(own && (sizesChanged || !same(shape(catBefore?.TYPES[key]), shape(cat.TYPES[key]))))) continue;
      /* Going back to the builder's layout has always been supported at
         every sold size. Only a recipe of the business's own is judged. */
      if (!own) continue;
      const report = checkLayout(next.offer[key].layout, cat, key, { budgetMs: Math.max(0, sizeCheckMs - (performance.now() - t0)) });
      layoutReports.push({ key, name: cat.TYPES[key].name, ...report });
    }
    const r = checkChangedStyles(before, next, manufacturer, library, { cat, budgetMs: Math.max(0, sizeCheckMs - (performance.now() - t0)) });
    for (const report of layoutReports) {
      r.problems.push(...report.errors);
      r.warnings.push(...report.warnings);
      r.unchecked.push(...(report.unchecked || []));
      if (report.unchecked?.length && refuse) r.problems.push("The standard layout could not be checked in time. Tap Save as standard again.");
      if (!r.styles.some((s) => s.key === report.key)) r.styles.push({ key: report.key, name: report.name });
      if (!report.unchecked?.length && !r.checked.includes(report.name)) r.checked.push(report.name);
    }
    /* a put back that carried parts forward: what the copy as it was kept
       finds too is the copy's; anything else the mix caused (a copy that
       can't be read any more causes it all) */
    let mixWords = [];
    if (!refuse && mixedFrom !== undefined && r.problems.length) {
      let had = [];
      try {
        const kept = tidyBuilt(liftRawRules(mixedFrom, manufacturer).settings, manufacturer);
        had = checkChangedStyles(before, kept, manufacturer, library, { budgetMs: sizeCheckMs }).problems;
        const keptCat = resolve(kept, manufacturer, library);
        for (const report of layoutReports) if (Array.isArray(kept.offer?.[report.key]?.layout)) {
          had.push(...checkLayout(kept.offer[report.key].layout, keptCat, report.key, { budgetMs: sizeCheckMs }).errors);
        }
      } catch { had = []; }
      mixWords = r.problems.filter((w) => !had.includes(w));
    }
    if ((refuse && r.problems.length) || mixWords.length) {
      const words = refuse ? r.problems : mixWords;
      const err = new OfficeError(422, words.slice(0, 8).join(" ") + (words.length > 8 ? ` (and ${words.length - 8} more)` : ""));
      err.problems = words;
      throw err;
    }
    /* The browser already has its result drawings. Keep the answer small:
       each full check carries a frame and the entire door/window list. */
    const layouts = layoutReports.map(({ key, name, ok, errors, warnings, problems, fixes, sizes, summary, unchecked, leftOff }) =>
      ({ key, name, ok, errors, warnings, problems, fixes, sizes, summary, unchecked, leftOff }));
    return { checked: r.checked, styles: r.styles, buildings: r.buildings, problems: refuse ? [] : r.problems, warnings: r.warnings, unchecked: r.unchecked, ...(layouts.length ? { layouts } : {}) };
  }

  async function history() {
    const names = (await store.keys("price-list-history/")).sort().reverse().slice(0, 100);
    const entries = (await Promise.all(names.map((key) => store.get(key)))).filter(Boolean)
      .map((e) => ({ version: e.version, savedAt: e.savedAt, savedBy: e.savedBy, changes: e.changes }));
    return { entries };
  }

  /* "Oct 3" this year, "Oct 3, 2025" another year. */
  function dayWords(at) {
    const d = new Date(at);
    const sameYear = d.getUTCFullYear() === now().getUTCFullYear();
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  }

  /* options as save(), plus carry(now, earlier) -> the settings to save
     (Barnwright's put back keeps the parts it may never change as they
     are now: setup-lock.js carryLocked). */
  async function restore(by, { version, current: currentVersion }, { carry = null, ...options } = {}) {
    if (!Number.isSafeInteger(version) || version < 1) fail(422, "Pick a saved price list.");
    const entry = await store.get(historyKey(version));
    if (!entry) fail(404, "That saved price list is gone.");
    let settings = entry.settings, mixedFrom;
    if (carry) {
      const now = await current();
      if (now) {
        settings = carry(now.data.settings, entry.settings);
        /* carried something that differs from the copy: a mix never saved */
        if (canon(settings) !== canon(tidyBuilt(liftRawRules(entry.settings, manufacturer).settings, manufacturer))) mixedFrom = entry.settings;
      }
    }
    /* the stricter rules compare with the copy put back, so an old copy can
       always be put back; a mix with the copy as it was kept, and the price
       list in use (prepared) */
    return save(by, { settings, version: currentVersion }, { ...options, restoring: dayWords(entry.savedAt), restoredFrom: settings, mixedFrom });
  }

  const startForOwner = (by, settings) => startForBarnwright(settings, { id: by.userId, name: by.name || by.email });

  return { get, current, catalogue, layoutMode, layoutSettings, setup, signupStart, startForBarnwright, startForOwner, preview, save, history, restore, check };
}
