/* WHAT BARNWRIGHT READS OF A PRICE LIST THROUGH THE DOOR (docs/OFFICE.md,
   "Barnwright setup access", The door, read).

   The Control Room (and Claude, through it) never gets the price list
   record itself. It asks for one part at a time and gets it in readable
   pieces: the buildings, the doors and windows, the options, the colors,
   how prices and quotes show, a summary, or the builder's library (codes
   and names, no prices), so it can write edits (setup-edits.js).

   Never in a read:
     * the business's phone, email and website: only whether each is
       filled in (hasPhone, hasEmail, hasWebsite);
     * the logo: only {present, kb};
     * who saved it by name or email (setup-access.js says who by role).
   Names and words in a view are what the business typed. The Control Room
   treats them as the business's data, never as instructions.

   Pure: no store, no clock. Node-safe and browser-safe. */

import { GABLE_STYLES } from "./setup-lock.js";
import { apply as builtOf, liftRawRules, format as formatBuilt } from "../../model/build-settings.js";

export const PARTS = Object.freeze(["summary", "buildings", "doors_windows", "options", "colors", "prices_and_quotes", "library"]);
const OPTION_GROUPS = ["dormers", "ramps", "elec", "misc", "rates"];
const COLOR_GROUPS = ["paint", "trim", "metal"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const keysOf = (o) => (isObj(o) ? Object.keys(o).filter((k) => !k.startsWith("_")) : []);
const priceOf = (v) => (isObj(v) ? v.price : v);
const baseOf = (s, k) => s.offer?.[k]?.base || k;

/* The name customers see: the business's own, or the builder's. */
export function styleName(s, k, M) {
  const own = s.offer?.[k]?.name;
  return (typeof own === "string" && own.trim()) || M.styles?.[baseOf(s, k)]?.name || k;
}
export function itemName(s, k, M) {
  const v = s.items?.[k];
  return (isObj(v) && typeof v.name === "string" && v.name.trim()) || M.items?.[k]?.name || k;
}
export function optionName(s, g, k, M) {
  const v = s.options?.[g]?.[k];
  if (isObj(v) && typeof v.name === "string" && v.name.trim()) return v.name;
  const def = M.options?.[g]?.[k];
  if (g === "elec") return `Electrical package ${def?.name?.replace(/^Option /, "") || k}`;
  return def?.name || k;
}

const logoOf = (logo) => ({ present: !!logo, kb: logo ? Math.ceil(String(logo).length / 1024) : 0 });

/* The roof pitch of each offered style with a gable roof Barnwright may
   change: "5/12" when the business set one in How it's built (on the style,
   on the style it is built like, or for the whole business; an older price
   list's roof pitch rule list counts as the style's own), else "standard"
   (the standard building's own). null for every other roof, and the
   Dormer Shed, whose dormer sets it. -> {code: words} */
export function pitchesOf(s, M) {
  const eff = builtOf(liftRawRules(s, M).settings, M).styles || {};
  const out = {};
  for (const k of keysOf(s.offer)) {
    const base = baseOf(s, k), t = M.styles?.[base];
    if (t?.roof !== "gable" || t?.dormer) { out[k] = null; continue; }
    const e = eff[k]?.built?.roofPitch;
    const theirs = e && e.value !== undefined && (e.from === "this style" || e.from === "business-wide" || /^built like /.test(e.from));
    out[k] = theirs ? formatBuilt("roofPitch", e.value) : "standard";
  }
  return out;
}

/* The groups as customers see them: the business's own, or the builder's. */
function groupsOf(s, M) {
  if (Array.isArray(s.categories)) {
    return s.categories.filter((g) => Array.isArray(g) && Array.isArray(g[1]))
      .map(([name, ks]) => ({ name, styles: ks.filter((k) => keysOf(s.offer).includes(k)) }));
  }
  const out = [];
  for (const k of keysOf(s.offer)) {
    const name = M.styles?.[baseOf(s, k)]?.category || "Buildings";
    let g = out.find((x) => x.name === name);
    if (!g) out.push((g = { name, styles: [] }));
    g.styles.push(k);
  }
  return out;
}
const soldInOrder = (s, M) => groupsOf(s, M).flatMap((g) => g.styles);
const sizesOf = (s, k) => Object.fromEntries(keysOf(s.offer?.[k]?.sizes).map((z) => [z, s.offer[k].sizes[z]]));

function business(s) {
  const b = isObj(s.brand) ? s.brand : {};
  return {
    name: b.name || "", short: b.short || b.name || "", tagline: b.tagline || "",
    hasPhone: !!b.phone, hasEmail: !!b.email, hasWebsite: !!b.website, logo: logoOf(b.logo),
  };
}

function colorList(s, g, M) {
  const lib = Object.fromEntries((M.palettes?.[g] || []).map((c) => [c[0], c[1]]));
  const list = s.palettes?.[g] || M.palettes?.[g] || [];
  return list.map((e) => (Array.isArray(e) ? { name: e[0], hex: e[1], own: true } : { name: e, hex: lib[e] || null, own: false }));
}

function optionList(s, g, M) {
  return keysOf(s.options?.[g]).map((k) => ({
    key: k, name: optionName(s, g, k, M), price: priceOf(s.options[g][k]),
    ...(g === "rates" ? { per: `sq ft of ${{ floor: "floor", wall: "wall", roof: "roof" }[M.options?.rates?.[k]?.basis] || "floor"}` } : {}),
  }));
}

/* -> the readable part of these settings (part one of PARTS). */
export function readView(settings, part, M) {
  const s = isObj(settings) ? settings : {};
  switch (part) {
    case "summary": return {
      business: business(s),
      styles: soldInOrder(s, M).map((k) => {
        const prices = Object.values(sizesOf(s, k)).filter((p) => typeof p === "number");
        return { code: k, name: styleName(s, k, M), sizes: prices.length, from: prices.length ? Math.min(...prices) : null };
      }),
      counts: {
        styles: keysOf(s.offer).length,
        sizes: keysOf(s.offer).reduce((n, k) => n + keysOf(s.offer[k]?.sizes).length, 0),
        items: keysOf(s.items).length,
        options: OPTION_GROUPS.reduce((n, g) => n + keysOf(s.options?.[g]).length, 0),
        extras: Array.isArray(s.options?.extras) ? s.options.extras.length : 0,
      },
      colors: Object.fromEntries(COLOR_GROUPS.map((g) => [g, colorList(s, g, M).length])),
      show: s.pricing?.show || "price",
      rentToOwn: !!s.pricing?.rto,
      open: s.status !== "suspended",
    };
    case "buildings": {
      const pitches = pitchesOf(s, M);
      return {
        groups: groupsOf(s, M),
        styles: soldInOrder(s, M).map((k) => ({
          code: k, name: styleName(s, k, M), builtLike: s.offer[k]?.base || null, roof: M.styles?.[baseOf(s, k)]?.roof || null,
          pitch: pitches[k] ?? null, sizes: sizesOf(s, k),
        })),
        opensOn: { style: s.defaults?.style || null, size: s.defaults?.size || null },
      };
    }
    case "doors_windows": return {
      items: keysOf(s.items).map((k) => ({ code: k, name: itemName(s, k, M), price: priceOf(s.items[k]) })),
    };
    case "options": return {
      ...Object.fromEntries(OPTION_GROUPS.map((g) => [g, optionList(s, g, M)])),
      extras: (Array.isArray(s.options?.extras) ? s.options.extras : []).map((x) => ({ key: x?.key, name: x?.name, charged: x?.input, price: x?.price })),
    };
    case "colors": return {
      ...Object.fromEntries(COLOR_GROUPS.map((g) => [g, colorList(s, g, M)])),
      opensOn: { body: s.defaults?.colors?.body || null, trim: s.defaults?.colors?.trim || null, roof: s.defaults?.colors?.roof || null },
    };
    case "prices_and_quotes": {
      const rto = s.pricing?.rto;
      return {
        show: s.pricing?.show || "price",
        finePrint: s.notes?.finePrint || "",
        sizeNotes: isObj(s.notes?.sizeNotes) ? s.notes.sizeNotes : {},
        rentToOwn: isObj(rto) ? { terms: keysOf(rto.factors).map((m) => ({ months: Number(m), factor: rto.factors[m] })), showTerm: rto.showTerm ?? null, note: rto.note ?? null } : null,
        quoteForm: { fields: isObj(s.leads?.fields) ? s.leads.fields : {}, askPlan: s.leads?.askPlan !== false, smsConsent: s.leads?.smsConsent ?? null },
        business: { ...business(s), initials: s.brand?.initials || "", colors: isObj(s.brand?.colors) ? s.brand.colors : {} },
      };
    }
    case "library": return {
      styles: keysOf(M.styles).map((k) => ({ code: k, name: M.styles[k].name, roof: M.styles[k].roof, group: M.styles[k].category || "Buildings", sold: keysOf(s.offer).includes(k) })),
      items: keysOf(M.items).map((k) => ({ code: k, name: M.items[k].name, sold: keysOf(s.items).includes(k) })),
      options: Object.fromEntries(OPTION_GROUPS.map((g) => [g, keysOf(M.options?.[g]).map((k) => ({ key: k, name: optionName({}, g, k, M) }))])),
      colors: Object.fromEntries(COLOR_GROUPS.map((g) => [g, (M.palettes?.[g] || []).map((c) => ({ name: c[0], hex: c[1] }))])),
      gableStyles: [...GABLE_STYLES],
    };
    default: throw new Error("There is no part " + part);
  }
}
