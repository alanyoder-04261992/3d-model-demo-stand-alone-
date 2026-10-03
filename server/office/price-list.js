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
   $5,700"), so the owner can see and put back an earlier price list. */

import { validate, validateManufacturer, resolve, SIZE_RE, ID_RE } from "../../model/company.js";
import { fail, OfficeError } from "./http.js";

/* The parts of the settings that change what a customer can pick or pay. */
const PRICE_PARTS = ["offer", "categories", "items", "options", "palettes", "construction"];
const POLICY_PARTS = ["roundTo", "minCharge", "roofAreaFactor"];

export function priceFingerprint(settings) {
  const pricing = settings.pricing || {};
  return JSON.stringify([PRICE_PARTS.map((k) => settings[k] ?? null), POLICY_PARTS.map((k) => pricing[k] ?? null)]);
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
    [/^items\.(\w+) needs a price: the (.+?) \([A-Za-z0-9_-]+\) comes as standard on the (.+?)\. 0 is fine/,
      (m) => `The ${m[2]} comes with the ${withoutCodes(m[3])}, so it needs a price ($0 is fine).`],
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
    [/^defaults\.porchLength/, () => "The porch the designer opens on must be 8 or 12 ft long."],

    [/^construction/, () => "The construction settings could not be saved. Reload the page and try again."],

    [/^pricing\.show/, () => "Pick how prices show on the designer: the full price, a starting price, or no price."],
    [/^pricing\.(roundTo|minCharge|roofAreaFactor)/, () => "The per-square-foot rounding could not be saved. Reload the page and try again."],
    [/^pricing\.rto\.showTerm/, () => "The rent-to-own term shown on the designer must be one of your terms."],
    [/^pricing\.rto/, () => "Each rent-to-own term needs a number of months and a factor between 0 and 1."],

    [/^notes\.finePrint/, () => "The line under the price must be written as text."],
    [/^notes\.sizeNotes/, () => "The notes for building widths must be written as text."],

    [/^leads\.fields/, () => "Pick Required, Optional or Off for each box on the quote form."],
    [/^leads\.smsConsent/, () => "The texting permission wording must be written as text."],
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

export function describeChanges(before, after, manufacturer) {
  const out = [];
  const M = manufacturer;
  const styleName = (s, key) => s.offer?.[key]?.name || M.styles?.[key]?.name || s.offer?.[key]?.base && M.styles?.[s.offer[key].base]?.name || key;
  const itemName = (s, key) => (s.items?.[key] && typeof s.items[key] === "object" && s.items[key].name) || M.items?.[key]?.name || key;

  const b = before.brand || {}, a = after.brand || {};
  for (const [k, word] of [["name", "Business name"], ["phone", "Phone"], ["email", "Email"], ["website", "Website"], ["tagline", "Tagline"]]) {
    if ((b[k] || "") !== (a[k] || "")) out.push(`${word}: ${b[k] || "(blank)"} → ${a[k] || "(blank)"}`);
  }
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
  }
  for (const k of oldStyles) if (!newStyles.includes(k)) out.push(`Stopped selling the ${styleName(before, k)}`);
  for (const k of newStyles) {
    if (!oldStyles.includes(k)) continue;
    const o = before.offer[k], n = after.offer[k];
    if ((o.name || "") !== (n.name || "")) out.push(`The ${styleName(before, k)} is now called the ${styleName(after, k)}`);
    const name = styleName(after, k);
    const os = o.sizes || {}, ns = n.sizes || {};
    for (const z of keys(ns)) {
      if (!(z in os)) out.push(`${name}: added ${fmtSize(z)} at ${fmtMoney(ns[z])}`);
      else if (os[z] !== ns[z]) out.push(`${name} ${fmtSize(z)}: ${fmtMoney(os[z])} → ${fmtMoney(ns[z])}`);
    }
    for (const z of keys(os)) if (!(z in ns)) out.push(`${name}: removed ${fmtSize(z)}`);
  }
  if (!same(before.categories, after.categories)) out.push("Changed how buildings are grouped");

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
  for (const [k, x] of nx) {
    const old = ox.get(k);
    if (!old) out.push(`Added the extra "${x.name}" at ${fmtMoney(x.price)}`);
    else if (!same(old, x)) out.push(old.price !== x.price ? `${x.name}: ${fmtMoney(old.price)} → ${fmtMoney(x.price)}` : `Changed the extra "${x.name}"`);
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
  if (!same(before.pricing?.rto, after.pricing?.rto)) out.push("Changed the rent-to-own terms");
  for (const k of POLICY_PARTS) if ((before.pricing?.[k] ?? null) !== (after.pricing?.[k] ?? null)) out.push("Changed how per-square-foot prices are rounded");
  if ((before.notes?.finePrint || "") !== (after.notes?.finePrint || "")) out.push("Changed the line under the price");
  if (!same(before.notes?.sizeNotes, after.notes?.sizeNotes)) out.push("Changed the notes shown for building widths");
  if (!same(before.defaults, after.defaults)) out.push("Changed the building the designer opens on");
  if (!same(before.leads, after.leads)) out.push("Changed what the quote form asks for");
  if (!same(before.features, after.features) || !same(before.look, after.look)) out.push("Changed how the designer looks");

  if (!out.length && !same(before, after)) out.push("Changed other settings");
  return [...new Set(out)];
}

/* -------------------------------------------------------------------- */

const SAVED_FIRST = "Someone else saved the price list while you were working. Reload to see their changes, then make yours again.";

export function createPriceList({ store, manufacturer, library, templates, now, log = console.error }) {
  const iso = () => now().toISOString();

  /* -> the resolved catalogue, or a 422 listing the problems in words. */
  function check(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) fail(422, "The price list is missing. Reload the page and try again.");
    const modelProblems = [...validateManufacturer(manufacturer), ...validate(settings, manufacturer)];
    const words = [...new Set([
      ...modelProblems.map((p) => explainProblem(p, manufacturer, settings)),
      ...officeProblems(settings, manufacturer),
    ])];
    if (words.length) {
      const err = new OfficeError(422, words.slice(0, 8).join(" ") + (words.length > 8 ? ` (and ${words.length - 8} more)` : ""));
      err.problems = words;
      throw err;
    }
    return resolve(settings, manufacturer, library);
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
  async function catalogue() {
    const record = await get();
    if (cached?.version !== record.version) cached = { version: record.version, cat: resolve(record.settings, manufacturer, library), record };
    return cached;
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
      await store.put(`price-list-history/${String(entry.version).padStart(6, "0")}`, entry);
    } catch (e) {
      log("A price list history entry could not be saved:", e);
    }
  }

  /* First setup: a starting price list from one of the example files. */
  async function setup(by, { businessName, phone, email, website, start }) {
    if (await current()) fail(409, "The business is already set up.");
    const template = templates[start === "small" ? "small" : "full"];
    if (!template) fail(422, "Pick a starting price list.");
    const settings = clean(template);
    const slug = String(businessName).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
    settings.id = ID_RE.test(slug) ? slug : "business";
    settings.status = "suspended";
    const words = businessName.split(/\s+/).filter(Boolean);
    settings.brand = {
      ...settings.brand,
      name: businessName,
      short: businessName.length > 24 ? words.slice(0, 2).join(" ") : businessName,
      initials: words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "SB",
      tagline: "Portable storage buildings",
      phone, email, website, logo: "",
      colors: { header: "#0A2C49", primary: "#0E3A5F", accent: "#B23A2E" },
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
    check(settings);
    const record = { settings, version: 1, cfg: 1, savedAt: iso(), savedBy: { id: by.userId, name: by.name || by.email } };
    if (!(await store.create("price-list", record))) fail(409, "The business is already set up.");
    await keepHistory({ version: 1, savedAt: record.savedAt, savedBy: record.savedBy, changes: ["Set up the business with a starting price list"], settings });
    return record;
  }

  /* Save the whole price list. The browser sends the version it started
     from; if someone else saved since, nothing is written (409). */
  async function save(by, { settings, version }, { restoring = null } = {}) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) fail(422, "The price list is missing. Reload the page and try again.");
    const previous = await current();
    if (!previous) fail(404, "The price list has not been set up yet.");
    if (version !== previous.data.version) fail(409, SAVED_FIRST);
    const next = clean(settings);
    const old = previous.data.settings;
    if (next.id !== old.id) fail(422, "This price list belongs to a different business. Reload the page and try again.");
    if (next.manufacturer !== old.manufacturer) fail(422, "The builder's library cannot change here.");
    next.cfg = priceFingerprint(next) === priceFingerprint(old) ? old.cfg : (old.cfg || 1) + 1;
    check(next);
    const changes = describeChanges(old, next, manufacturer);
    if (restoring) changes.unshift(`Put back the price list saved ${restoring}`);
    if (!changes.length) return { ...previous.data, cfg: old.cfg, changes: [] };
    const record = { settings: next, version: previous.data.version + 1, cfg: next.cfg, savedAt: iso(), savedBy: { id: by.userId, name: by.name || by.email } };
    if (!(await store.replace("price-list", previous, record))) fail(409, SAVED_FIRST);
    await keepHistory({ version: record.version, savedAt: record.savedAt, savedBy: record.savedBy, changes, settings: next });
    return { ...record, changes };
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

  async function restore(by, { version, current: currentVersion }) {
    if (!Number.isSafeInteger(version) || version < 1) fail(422, "Pick a saved price list.");
    const entry = await store.get(`price-list-history/${String(version).padStart(6, "0")}`);
    if (!entry) fail(404, "That saved price list is gone.");
    return save(by, { settings: entry.settings, version: currentVersion }, { restoring: dayWords(entry.savedAt) });
  }

  return { get, current, catalogue, setup, save, history, restore, check };
}
