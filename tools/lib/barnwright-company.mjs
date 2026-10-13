/* BARNWRIGHT, WRITTEN AS A COMPANY FILE -- for the checks only.

   The golden checks need a company that sells exactly what Barnwright's 3D
   designer sells, at exactly Barnwright's prices, so our rules can be compared
   with Barnwright's number for number. This builds that company object from
   test/golden/barnwright-catalogue.json (Barnwright's tables, read live from
   its page) and the standard manufacturer file. Barnwright's real prices are
   never written into companies/: they live only in test/golden.

   BARNWRIGHT'S NUMBERS. Since Oct 2026 ("yes match") the standard
   manufacturer file carries Alan's shop numbers as "How it's built" blocks
   (library/manufacturers/standard.json styles.<KEY>.built: the Utility Shed's
   5/12 roof, the Lofted Barn's walls and barn roof heights ...). Barnwright's
   own numbers are still the raw traits and library/construction.json, so
   Barnwright's company is the standard manufacturer WITHOUT those blocks.
   Its measured opening trim is also removed for this legacy reference.
   Every check that compares with Barnwright resolves through this file, and
   tools/check-construction.mjs proves no other tools file pairs
   barnwrightCompany() with the standard manufacturer by itself.

   barnwrightCompany()          -> the company object (not written to disk)
   barnwrightManufacturer()     -> standard.json without its built blocks
   barnwrightCatalogue(change)  -> the company resolved with Barnwright's
                                   numbers; change(company), when given, edits
                                   a fresh copy first (extras, construction)
   standardManufacturer()       -> standard.json as every other company
                                   gets it (the shop standard), for a check
                                   that pairs it with this company on purpose
   shopStandardCatalogue(change) -> the same company (every style at every
                                   size Barnwright sells) with the shop
                                   standard numbers, for the every-size check
   golden()                     -> the recorded Barnwright tables */

import { readJSON, readManufacturer } from "./load.mjs";
import { resolve, colorName } from "../../model/company.js";

let G = null;
export function golden() {
  if (!G) G = readJSON("test/golden/barnwright-catalogue.json");
  return G;
}

/* What Barnwright's page opens on and calls itself, in case the golden file
   was rewritten with only the price and parts tables. */
const FALLBACK_START = { type: "LB", size: "10x20", body: "#FAF9F3", trim: "#2E3134", roof: "#2E3134", dormer: "9", pLen: 12 };
const FALLBACK_BRAND = { name: "Portable Buildings", short: "Portable Buildings", initials: "PB", tagline: "Portable Storage Buildings" };

export function barnwrightCompany() {
  const g = golden();
  if (!g.P || !g.TYPES || !g.CAT || !g.COLORS) throw new Error("test/golden/barnwright-catalogue.json is missing Barnwright's tables; run node tools/extract-barnwright-catalogue.mjs.");
  const brand = g.brand || FALLBACK_BRAND;
  const offer = {};
  for (const k of Object.keys(g.TYPES)) offer[k] = { sizes: Object.assign({}, g.P[k]) };
  const items = {};
  for (const k of Object.keys(g.CAT)) items[k] = g.CAT[k].p;
  const pairs = (list) => list.filter((x) => x[0] !== "none" && x[0] !== "0").map((x) => [x[0], x[2]]);
  const st = g.defaultState || FALLBACK_START;
  const siding = g.TYPES[st.type].metal ? g.COLORS.metal : g.COLORS.paint;
  return {
    id: "barnwright",
    status: "active",
    manufacturer: "standard",
    brand: { name: brand.name, short: brand.short, initials: brand.initials, tagline: brand.tagline,
      phone: "", email: "", website: "", colors: {}, logo: "", credit: { text: "3D designer by Barnwright", url: "", show: true } },
    offer,
    categories: g.CATS.map((c) => [c[0], c[1].split(",")]),
    items,
    options: {
      dormers: Object.fromEntries(pairs(g.DORMERS)),
      ramps: Object.fromEntries(pairs(g.RAMPS)),
      elec: Object.fromEntries(pairs(g.ELECPK)),
      misc: Object.assign({}, g.MISC),
      rates: Object.assign({}, g.RATES),
      extras: ((g.OPTX && g.OPTX.extras) || []).slice(),
    },
    palettes: { paint: g.COLORS.paint.map((c) => c.slice()), trim: g.COLORS.trim.map((c) => c.slice()), metal: g.COLORS.metal.map((c) => c.slice()) },
    defaults: {
      style: st.type, size: st.size,
      colors: { body: colorName(siding, st.body), trim: colorName(g.COLORS.trim, st.trim), roof: colorName(g.COLORS.metal, st.roof) },
      dormer: st.dormer, porchLength: st.pLen,
    },
    pricing: { show: "price", roundTo: 5, minCharge: 5, roofAreaFactor: 1.15 },
    leads: { mode: "none" },
    look: { trueColour: false, scene: "studio" },
    cfg: 1,
  };
}

/* The standard manufacturer with every style's "How it's built" block taken
   out: Barnwright's own numbers. Nothing else differs (check-construction). */
export function barnwrightManufacturer() {
  const m = JSON.parse(JSON.stringify(readManufacturer("standard")));
  for (const k of Object.keys(m.styles || {})) if (m.styles[k] && typeof m.styles[k] === "object") delete m.styles[k].built;
  /* The recorded reference predates Alan's measured opening trim and the
     Yoder casing joint. Keep those shop changes out of legacy fixtures. */
  if (m.construction?.openings) {
    delete m.construction.openings.trim;
    if (!Object.keys(m.construction.openings).length) delete m.construction.openings;
  }
  return m;
}

export function standardManufacturer() {
  return readManufacturer("standard");
}

function resolved(manufacturer, change) {
  const c = barnwrightCompany();
  if (typeof change === "function") change(c);
  return resolve(c, manufacturer, readJSON("library/construction.json"));
}
export function barnwrightCatalogue(change) {
  return resolved(barnwrightManufacturer(), change);
}
export function shopStandardCatalogue(change) {
  return resolved(readManufacturer("standard"), change);
}
