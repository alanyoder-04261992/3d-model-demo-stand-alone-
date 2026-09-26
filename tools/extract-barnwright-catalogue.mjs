/* RECORD BARNWRIGHT'S EXACT PRICE AND PARTS TABLES, straight out of its running page.

   node tools/extract-barnwright-catalogue.mjs

   Opens Barnwright's untouched 3ddesign.html (read only, see
   tools/lib/barnwright-page.mjs) and writes test/golden/barnwright-catalogue.json:
   its price book P, the styles TYPES, the categories CATS, the item catalogue
   CAT, the colours COLORS, the option price lists (DORMERS RAMPS ELECPK MISC
   RATES OPTX), the electric package descriptions ELECDESC, the state the page
   opens with, a handful of shop constants, and the SHA-256 of the file they
   came from.

   The tables are read LIVE from the page's own variables, not picked out of the
   source with a pattern, so what is recorded is exactly what Barnwright uses.
   These are Barnwright's real prices: they live only in test/golden and are
   used only by the checks (the demo company has its own example prices).

   Re-run it only on purpose (for instance after Barnwright changes); the file
   it writes carries the SHA-256 so a check can tell when it has gone stale. */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openBarnwright } from "./lib/barnwright-page.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "test/golden/barnwright-catalogue.json");

const bw = await openBarnwright();
try {
  const live = await bw.evaluate(() => {
    const copy = (v) => JSON.parse(JSON.stringify(v));
    return {
      P: copy(P),
      TYPES: copy(TYPES),
      CATS: copy(CATS),
      CAT: copy(CAT),
      COLORS: copy(COLORS),
      DORMERS: copy(DORMERS),
      RAMPS: copy(RAMPS),
      ELECPK: copy(ELECPK),
      MISC: copy(MISC),
      RATES: copy(RATES),
      OPTX: copy(OPTX),
      ELECDESC: copy(ELECDESC),
      defaultState: copy(state),
      constants: { GROOVE, RIB, y0, SKIRT, CASING, OCT_WIN, OCT_TRIM, ROOF_TH, RAKE_STEP },
      brand: { name: BRAND.name, short: BRAND.short, initials: BRAND.initials, tagline: BRAND.tagline },
    };
  });
  if (bw.errors.length) throw new Error("Barnwright's page reported errors while loading: " + bw.errors.join(" | "));
  const out = {
    _about: "Barnwright's exact tables, read live from its 3ddesign.html by tools/extract-barnwright-catalogue.mjs. Real prices: used only by the checks, never by a company.",
    source: "boisterous-lokum-a737e0/public/3ddesign.html",
    sha256: bw.sha256,
    ...live,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  const nSizes = Object.values(out.P).reduce((a, s) => a + Object.keys(s).length, 0);
  console.log(`Recorded Barnwright's tables: ${Object.keys(out.TYPES).length} styles, ${nSizes} priced sizes, ` +
    `${Object.keys(out.CAT).length} items, ${out.COLORS.paint.length}/${out.COLORS.trim.length}/${out.COLORS.metal.length} paint/trim/metal colours.`);
  console.log(`From 3ddesign.html with SHA-256 ${out.sha256}.`);
  console.log(`Wrote ${OUT}`);
} finally {
  await bw.close();
}
