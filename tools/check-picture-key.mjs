/* CHECK: THE PICTURE KEY OF "YOUR BUILDINGS" (model/picture-key.js).
   Run: node tools/check-picture-key.mjs
   check-all: node

   WHY. The Buildings tab shows each building as the business's own 3D
   designer opens on it. The owner's browser draws those pictures and keeps
   them under a key, so a picture is drawn again only when what it shows
   changed: typing a price must never draw anything, a roof pitch must draw
   that one building again, a color the 3D designer opens on draws every
   building again. This proves the key follows those rules on the sample
   price list (companies/demo), the table in the build plan:

     change                          Utility Shed   Lofted Barn
     Utility Shed price +$100        same           same
     Lofted Barn price +$100         same           same
     a door's price +$5              same           same
     Utility Shed renamed            same           same
     Utility Shed roof 8/12          changes        same
     business-wide gable roof 6/12   changes        same
     opens on Barn Red siding        changes        changes

   and that the key is 16 hex characters, changes with the drawing code and
   with the picture's size, and that the picture shows the size the 3D
   designer lands on (the opening size when the style sells it, else the
   5th size). */

import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(resolvePath(ROOT, rel), "utf8"));

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ok   " + name); }
  else { fail++; failures.push(name + (extra ? " -- " + extra : "")); console.log("  FAIL " + name + (extra ? " -- " + extra : "")); }
}

let PK;
try {
  PK = await import("../model/picture-key.js");
} catch (e) {
  console.log(`FAIL: model/picture-key.js could not be loaded (${e.code || e.message}). The Buildings tab has no picture key yet.`);
  process.exit(1);
}
const { resolve } = await import("../model/company.js");
const M = read("library/manufacturers/standard.json");
const L = read("library/construction.json");
const S0 = read("companies/demo/company.json");
const RECIPE = { w: 400, h: 300, dpr: 2, cam: PK.PICTURE_CAMERA, bg: PK.PICTURE_BACKDROP };
const ENGINE = "0123456789abcdef";

const keyOf = (settings, k, recipe = RECIPE, engine = ENGINE) => PK.pictureKey(resolve(settings, M, L), k, recipe, engine);
const sizes = (s) => Object.keys(s).filter((z) => !z.startsWith("_"));
const base = { UT: keyOf(S0, "UT"), LB: keyOf(S0, "LB") };
ok(`a key is 16 hex characters (${base.UT})`, /^[0-9a-f]{16}$/.test(base.UT) && /^[0-9a-f]{16}$/.test(base.LB));
ok("the same price list gives the same keys", keyOf(structuredClone(S0), "UT") === base.UT && keyOf(structuredClone(S0), "LB") === base.LB);
ok("two buildings have different keys", base.UT !== base.LB);

const paint = resolve(S0, M, L).COLORS.paint.map((c) => c[0]);
const red = paint.find((n) => /barn red/i.test(n)) || paint.find((n) => /red/i.test(n));
const rows = [
  ["Utility Shed price +$100", (s) => { for (const z of sizes(s.offer.UT.sizes)) s.offer.UT.sizes[z] += 100; }, false, false],
  ["Lofted Barn price +$100", (s) => { for (const z of sizes(s.offer.LB.sizes)) s.offer.LB.sizes[z] += 100; }, false, false],
  ["a door's price +$5", (s) => { s.items.w23 += 5; s.items.w48 += 5; }, false, false],
  ["Utility Shed renamed", (s) => { s.offer.UT.name = "Shop Shed"; }, false, false],
  ["Utility Shed roof 8/12", (s) => { s.offer.UT.built = { ...(s.offer.UT.built || {}), roofPitch: 8 }; }, true, false],
  ["business-wide gable roof 6/12", (s) => { s.built = { ...(s.built || {}), roofPitch: { gable: 6 } }; }, true, false],
  [`opens on ${red} siding`, (s) => { s.defaults = { ...s.defaults, colors: { ...s.defaults.colors, body: red } }; }, true, true],
  ["changes to warm light", (s) => { s.look = { ...(s.look || {}), trueColour: false }; }, true, true],
];
for (const [name, change, utChanges, lbChanges] of rows) {
  const s = structuredClone(S0);
  change(s);
  let ut, lb;
  try { ut = keyOf(s, "UT"); lb = keyOf(s, "LB"); } catch (e) { ok(`${name}: the price list resolves`, false, e.message); continue; }
  const say = (c) => (c ? "changes" : "stays the same");
  ok(`${name}: the Utility Shed's key ${say(utChanges)}, the Lofted Barn's ${say(lbChanges)}`,
    (ut !== base.UT) === utChanges && (lb !== base.LB) === lbChanges, `UT ${ut} (was ${base.UT}), LB ${lb} (was ${base.LB})`);
}

ok("new drawing code changes every key", keyOf(S0, "UT", RECIPE, "fedcba9876543210") !== base.UT);
ok("a bigger picture has its own key", keyOf(S0, "UT", { ...RECIPE, w: 640, h: 480 }) !== base.UT);

const cat = resolve(S0, M, L);
ok(`the Lofted Barn is drawn at the opening size, ${S0.defaults.size}`, PK.pictureSize(cat, "LB") === S0.defaults.size);
const noOpening = sizes(S0.offer.BU.sizes);
const want = noOpening.includes(S0.defaults.size) ? S0.defaults.size : noOpening[Math.min(4, noOpening.length - 1)];
ok(`the Backyard Utility is drawn at the size the 3D designer lands on, ${want}`, PK.pictureSize(cat, "BU") === want);

/* a price list with no How it's built at all, and a style of its own */
const own = structuredClone(S0);
delete own.built;
for (const k of Object.keys(own.offer)) delete own.offer[k].built;
own.offer.LB1 = { base: "LB", name: "Tall Wall Lofted Barn", sizes: { "10x16": 5985, "12x24": 7400 }, built: { wallHeight: 84 } };
for (const g of own.categories) if (g[1].includes("LB")) g[1].push("LB1");
let ownKey = null;
try { ownKey = keyOf(own, "LB1"); } catch (e) { ok("a style of the business's own has a key", false, e.message); }
if (ownKey) ok("a style of the business's own has a key of its own", ownKey !== keyOf(own, "LB"));

let threw = null;
try { PK.pictureKey(cat, "ZZ", RECIPE, ENGINE); } catch (e) { threw = e.message; }
ok("a style the price list doesn't sell is said in words", /isn't|not a building style/.test(threw || ""), threw);

/* The screen's memo must follow the same picture inputs before the key is
   calculated. A stale catalogue would make the correct hash hide a change. */
const { S } = await import("../ui/office/views/price-list/state.js");
const { catOf } = await import("../ui/office/views/price-list/built.js");
S.M = M; S.L = L; S.saved = { version: "picture-key-check", settings: S0 };
const drawing = catOf(S0);
const changedPrice = structuredClone(S0);
changedPrice.offer.UT.sizes["10x20"] += 100;
ok("typing a price reuses the screen's drawing catalogue", catOf(changedPrice) === drawing);
const changedColor = structuredClone(S0);
changedColor.defaults.colors.body = red;
const colorCat = catOf(changedColor);
ok("opening color changes reach the screen's drawing catalogue", !!colorCat && PK.pictureKey(colorCat, "UT", RECIPE, ENGINE) !== PK.pictureKey(drawing, "UT", RECIPE, ENGINE));
const changedLight = structuredClone(S0);
changedLight.look = { ...(changedLight.look || {}), trueColour: false };
const lightCat = catOf(changedLight);
ok("the business's lighting changes reach the screen's drawing catalogue and cache key", !!lightCat && lightCat.look.trueColour === false && PK.pictureKey(lightCat, "UT", RECIPE, ENGINE) !== PK.pictureKey(drawing, "UT", RECIPE, ENGINE));
const missingPrice = structuredClone(S0);
missingPrice.offer.UT.sizes["10x18"] = "";
const before = JSON.stringify(missingPrice);
const newSizeCat = catOf(missingPrice);
ok("a new size gets a picture before its price is typed, and the draft price stays untouched", newSizeCat?.P?.UT?.["10x18"] === 1 && JSON.stringify(missingPrice) === before);
const changedLayout = structuredClone(S0);
changedLayout.offer.UT.layout = [{ cat: "w48", wall: "F", at: "center" }];
const layoutCat = catOf(changedLayout);
ok("a saved standard layout reaches the screen's drawing catalogue", !!layoutCat && PK.pictureKey(layoutCat, "UT", RECIPE, ENGINE) !== PK.pictureKey(drawing, "UT", RECIPE, ENGINE));

console.log("");
if (fail) {
  console.log(`FAIL: ${fail} of ${pass + fail} picture key checks failed:\n - ` + failures.join("\n - "));
  process.exit(1);
}
console.log(`PROVED: the picture key follows the rules (${pass} checks): prices and names never draw a picture again; a building's own numbers draw that building again; the colors the 3D designer opens on draw them all again.`);
