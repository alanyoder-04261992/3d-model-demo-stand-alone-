/* CHECK: A STYLE BUILT LIKE ANOTHER IS THAT STYLE, AND OPTIONS CAN CARRY THE
   OWNER'S OWN NAMES.
   Run: node tools/check-style-variants.mjs
   check-all: node

   WHY. An owner can add a building style of their own in the price list --
   "Premium Lofted Barn", built like the Lofted Barn, with its own sizes and
   prices -- and can rename an option ("Basic electric" for electrical
   package 1). Neither may change how any building looks, is framed or is
   priced: only the name and the prices are the owner's. (model/company.js:
   an offer entry with "base"; options written as {"price", "name"}.)

   WHAT IT PROVES
   1. THE SAME BUILDING. A company that sells, next to every style the demo
      sells, a style of its own built like it ("V" + the style's code, called
      "Premium ..."), at the same sizes and prices. For EVERY style at EVERY
      size: the two come with the same standard doors and windows (every
      field), settle the same construction, draw exactly the same building --
      the finished building AND its framing, hashed: every material, its
      settings, every triangle's numbers, which part drew it, the tap targets,
      the camera fit and the lawn -- and price to the same lines and total.
      Side porches are also flipped, centred and 8 ft. Each style is also
      dressed with a dormer, an electrical package with the outside light, a
      ramp, every per-square-foot upgrade, shutters and door windows: the same
      drawing, the same price lines, and the server's own pricing
      (server/office/pricing.js) gives the same price for the two.
   2. THE PRICE LIST'S ENTRY. The new style is a copy of its base's traits
      with its own name and "base"; it sits in its base's group; a company
      with no styles of its own and no option names resolves with none of the
      new fields (no "base", no fourth ELECPK entry, no MISCNAMES).
   3. CONSTRUCTION RULES that test a style ("styles": ["LB"]) frame the new
      style exactly as the base -- and the rule really changes the base, so
      the test is not empty; a rule naming the new style's own code is refused.
   4. MISTAKES IN PLAIN WORDS: a base that is not a style, a style built like
      another of the company's own, a missing or blank name, two styles with
      one name (case and spacing ignored, renamed styles included), a code
      that is the manufacturer's own (exactly or in other letters), a bad
      code, a name too long. A good one may be the style the designer opens on.
   5. OPTION NAMES. dormers, ramps, electrical packages, shutters, the door
      window, the outside light and the per-square-foot upgrades may be
      {"price", "name"}: the name is on the buttons and the quote, the amounts
      never move; written {"price"} with no name, and in the demo (plain
      prices), every quote line keeps today's exact words. Bad names and
      prices are refused in plain words.
   6. THE SPREADSHEET (tools/import-prices.mjs) keeps a style of the company's
      own and an option's name: out to a spreadsheet and back changes nothing,
      and a row naming "Premium Lofted Barn" prices that style, never the
      Lofted Barn. */

import { createHash } from "node:crypto";
import { readJSON, readManufacturer } from "./lib/load.mjs";
import { validate, resolve } from "../model/company.js";
import { makePlan } from "../model/plan.js";
import { frameOf } from "../model/frame.js";
import { defaults, setType, fromState, toState } from "../model/design.js";
import { resetItems, pkFixtures } from "../model/layout.js";
import { priceParts } from "../model/pricing.js";
import { assemble } from "../engine/assemble.js";
import { priceDesign } from "../server/office/pricing.js";
import { readPriceRows, applyPrices, exportCsv } from "./import-prices.mjs";

const t0 = Date.now();
const J = (v) => JSON.stringify(v);
const copy = (v) => JSON.parse(JSON.stringify(v));

const counts = new Map();
const failures = [];
function ok(group, cond, msg) {
  const c = counts.get(group) || { pass: 0, fail: 0 };
  counts.set(group, c);
  if (cond) c.pass++;
  else { c.fail++; if (failures.length < 60) failures.push(`[${group}] ${msg}`); }
  return cond;
}

const M = readManufacturer("standard");
const LIB = readJSON("library/construction.json");
const demoFile = readJSON("companies/demo/company.json");
const DEMO = resolve(demoFile, M, LIB);
const STYLES = Object.keys(DEMO.P);                     /* every style the demo sells (every standard style) */
const V = (k) => "V" + k;                               /* the code of the style built like k */
const premium = (k) => "Premium " + M.styles[k].name;

/* The rule that proves style-keyed construction reaches a style built like
   another: 12 in floor joists on five styles only. */
const RULE_STYLES = ["LB", "SC", "MU", "DK", "SS"];
const JOISTS = LIB.floor.spacingIn;
const RULE = { floor: { spacingIn: [{ when: { styles: RULE_STYLES }, value: 12 }, { value: JOISTS }] } };

/* The demo, plus a style of its own built like every style it sells, in the
   same group, at the same sizes and prices; and the joist rule. */
function variantCompany() {
  const c = copy(demoFile);
  for (const k of STYLES) {
    c.offer[V(k)] = { base: k, name: premium(k), sizes: copy(c.offer[k].sizes) };
    const group = c.categories.find((g) => g[1].includes(k));
    group[1].push(V(k));
  }
  c.construction = copy(RULE);
  return c;
}
const VFILE = variantCompany();
const VP = validate(VFILE, M);
ok("1. a style built like another draws, frames and prices as its base", VP.length === 0, `the company with a style of its own for every style does not validate: ${VP.slice(0, 5).join(" | ")}`);
const VCAT = resolve(VFILE, M, LIB);

/* ------------------------------------------------------------ helpers */

function standardState(cat, t, z, porch) {
  const st = defaults(cat);
  setType(st, t, cat);
  st.size = z;
  if (porch) Object.assign(st, porch);
  resetItems(st, frameOf(st, cat), cat);
  return st;
}

/* Everything the 3D designer draws for this design -- the finished building
   and its framing -- as one fingerprint. */
const VIEW = { w: 960, h: 640 };
function drawing(state, cat) {
  const plan = makePlan(state, cat);
  const r = assemble(plan, { viewport: VIEW, fit: "fitref", scene: "studio", trueColour: false, frames: true });
  const h = createHash("sha256");
  h.update(J([r.ORDER, r.gr, r.fitDist, r.bounds]));
  let triangles = 0;
  for (const key of r.build.ORDER) {
    const b = r.build.buckets[key];
    const settings = {};
    for (const f of Object.keys(b).sort()) if (f !== "v") settings[f] = b[f];
    h.update(J([key, settings, r.build.tags[key]]));
    h.update(Buffer.from(Float64Array.from(b.v).buffer));
    triangles += b.n / 3;
  }
  h.update(J(r.build.hitQuads));
  return { hash: h.digest("hex"), triangles, construction: plan.construction };
}

/* The two designs, side by side: same doors and windows, construction,
   drawing and price. */
let compared = 0, triangles = 0;
function sameBuilding(group, label, a, b, cat) {
  ok(group, J(a.items) === J(b.items), `${label}: the standard doors and windows differ\n      ${J(a.items).slice(0, 200)}\n      ${J(b.items).slice(0, 200)}`);
  const da = drawing(a, cat), db = drawing(b, cat);
  ok(group, J(da.construction) === J(db.construction), `${label}: the construction settles differently`);
  ok(group, da.hash === db.hash && da.triangles === db.triangles && da.triangles > 0,
    `${label}: the drawing differs (${da.triangles} triangles, ${da.hash.slice(0, 12)} against ${db.triangles}, ${db.hash.slice(0, 12)})`);
  const pa = priceParts(a, cat), pb = priceParts(b, cat);
  ok(group, J(pa) === J(pb) && pa.base > 0, `${label}: the price differs\n      ${J(pa)}\n      ${J(pb)}`);
  compared++; triangles += da.triangles;
  return { da, pa };
}

/* A style dressed with every option the demo sells. */
function dressed(cat, t, z) {
  const st = standardState(cat, t, z);
  if (cat.TYPES[t].dormer) st.dormer = "9";
  st.elec = { pkg: 2, ext: true };
  pkFixtures(st, frameOf(st, cat), cat);
  st.ramp = "r4";
  for (const k of Object.keys(st.opts)) st.opts[k] = true;
  for (const it of st.items) {
    const c = cat.CAT[it.cat];
    if (c.k === "win" && !c.gable) it.shut = true;
    if (c.draw === "shop-door" && !cat.TYPES[t].metal) it.lite = true;
  }
  return st;
}

/* ------------------------------------------------- 1. the same building */
const G1 = "1. a style built like another draws, frames and prices as its base";
let sizes = 0;
for (const k of STYLES) {
  const zs = Object.keys(DEMO.P[k]);
  for (const z of zs) {
    sizes++;
    sameBuilding(G1, `${k} ${z}`, standardState(VCAT, k, z), standardState(VCAT, V(k), z), VCAT);
    if (VCAT.TYPES[k].porch === "S") {
      for (const p of [{ pFlip: true }, { pMid: true }, { pLen: 8 }, { pMid: true, pLen: 8 }]) {
        sameBuilding(G1, `${k} ${z} ${J(p)}`, standardState(VCAT, k, z, p), standardState(VCAT, V(k), z, p), VCAT);
      }
    }
  }
  /* dressed with every option, at the size a new visitor sees first */
  const z = zs[Math.min(4, zs.length - 1)];
  const a = dressed(VCAT, k, z), b = dressed(VCAT, V(k), z);
  const { pa } = sameBuilding(G1, `${k} ${z} with every option`, a, b, VCAT);
  ok(G1, pa.lines.length >= 6, `${k} ${z}: the dressed building has only ${pa.lines.length} price lines, so the options were not all on`);
  /* the server prices what a lot's designer sends the same way */
  const sa = priceDesign(fromState(a, VCAT), VCAT), sb = priceDesign(fromState(b, VCAT), VCAT);
  ok(G1, J(sa.price) === J(sb.price) && sb.design.type === V(k), `${k} ${z}: the server prices the two differently (${sa.price.total} against ${sb.price.total})`);
  /* saved and reopened, it is still itself, laid out as the base is */
  const backA = toState(fromState(a, VCAT), VCAT), backB = toState(fromState(b, VCAT), VCAT);
  ok(G1, backB.warnings.length === 0 && backB.state.type === V(k) && J(backB.state.items) === J(backA.state.items),
    `${k} ${z}: a saved design of the new style does not reopen as itself (${J(backB.warnings)})`);
}

/* ---------------------------------------------- 2. the price list's entry */
const G2 = "2. the new style's entry is its base's, renamed";
for (const k of STYLES) {
  const a = VCAT.TYPES[k], b = VCAT.TYPES[V(k)];
  const rest = Object.assign({}, b), baseRest = Object.assign({}, a);
  delete rest.name; delete rest.base; delete baseRest.name;
  ok(G2, J(rest) === J(baseRest), `${V(k)} is not a copy of ${k}: ${J(rest).slice(0, 160)} against ${J(baseRest).slice(0, 160)}`);
  ok(G2, b.name === premium(k) && b.base === k && a.base === undefined, `${V(k)}: name ${J(b.name)}, base ${J(b.base)}`);
  ok(G2, J(VCAT.P[V(k)]) === J(VCAT.P[k]), `${V(k)}: its sizes and prices are not the ones it was given`);
  const group = VCAT.CATS.find((g) => g[1].split(",").includes(k));
  ok(G2, !!group && group[1].split(",").includes(V(k)), `${V(k)} is not in the ${k} group`);
}
{
  const noBase = Object.keys(DEMO.TYPES).filter((k) => "base" in DEMO.TYPES[k]);
  ok(G2, noBase.length === 0, `the demo's styles carry "base": ${noBase.join(", ")}`);
  ok(G2, DEMO.ELECPK.every((e) => e.length === 3) && J(DEMO.MISCNAMES) === "{}", `the demo has option names it never gave: ${J(DEMO.ELECPK)} ${J(DEMO.MISCNAMES)}`);
  /* a style of its own taking the variant's group from its base when the
     company does not group its styles itself */
  const ng = copy(VFILE); delete ng.categories;
  const NG = resolve(ng, M, LIB);
  const lb = NG.CATS.find((g) => g[1].split(",").includes("LB"));
  ok(G2, !!lb && lb[1].split(",").includes("VLB") && NG.TYPES.VLB.category === NG.TYPES.LB.category, `with no groups of its own, the Premium Lofted Barn is not in the Lofted Barn's group: ${J(NG.CATS)}`);
}

/* -------------------------------------------------- 3. construction rules */
const G3 = "3. a construction rule by style frames the new style as its base";
for (const k of STYLES) {
  const z = Object.keys(DEMO.P[k])[0];
  const want = RULE_STYLES.includes(k) ? 12 : JOISTS;
  const ca = frameOf(standardState(VCAT, k, z), VCAT).construction.floor.spacingIn;
  const cb = frameOf(standardState(VCAT, V(k), z), VCAT).construction.floor.spacingIn;
  ok(G3, ca === want && cb === want, `${k} / ${V(k)} ${z}: floor joists ${ca} and ${cb} in apart, the rule says ${want}`);
}
{
  const before = frameOf(standardState(DEMO, "LB", "10x16"), DEMO).construction.floor.spacingIn;
  ok(G3, before === JOISTS && JOISTS !== 12, `the rule would change nothing: the Lofted Barn already has ${before} in joists`);
  const lbA = drawing(standardState(DEMO, "LB", "10x16"), DEMO), lbB = drawing(standardState(VCAT, "VLB", "10x16"), VCAT);
  ok(G3, lbA.hash !== lbB.hash, "12 in joists drew the same Premium Lofted Barn as 16 in joists: the drawing comparison would not notice a change");
  const bad = copy(VFILE);
  bad.construction = { floor: { spacingIn: [{ when: { styles: ["VLB"] }, value: 12 }, { value: JOISTS }] } };
  const errs = validate(bad, M);
  ok(G3, errs.some((e) => e.includes('when.styles names "VLB", which is built like "LB" and framed exactly like it: test "LB" instead')), `a rule naming the new style's code was not refused: ${J(errs)}`);
}

/* --------------------------------------------- 4. mistakes in plain words */
const G4 = "4. mistakes with a style of the company's own are named in plain words";
const SIZES = { "10x16": 6290 };
const MISTAKES = [
  ["a base that is not a style", (c) => { c.offer.QX1 = { base: "QQ", name: "Mystery Barn", sizes: SIZES }; c.categories[1][1].push("QX1"); },
    'offer.QX1 ("Mystery Barn") is built like "QQ", but the standard manufacturer file has no style "QQ"'],
  ["a base that is not text", (c) => { c.offer.QX1 = { base: 5, name: "Mystery Barn", sizes: SIZES }; c.categories[1][1].push("QX1"); },
    'offer.QX1 ("Mystery Barn") is built like "5", but the standard manufacturer file has no style "5"'],
  ["built like another style of the company's own", (c) => { c.offer.VLB = { base: "LB", name: "Premium Lofted Barn", sizes: SIZES }; c.offer.VLB2 = { base: "VLB", name: "Super Lofted Barn", sizes: SIZES }; c.categories[1][1].push("VLB", "VLB2"); },
    'offer.VLB2 ("Super Lofted Barn") is built like "VLB", which is itself built like "LB" (Lofted Barn): a style can only be built like one of the manufacturer\'s own styles, so write "base": "LB"'],
  ["no name", (c) => { c.offer.VLB = { base: "LB", sizes: SIZES }; c.categories[1][1].push("VLB"); },
    'offer.VLB is built like the Lofted Barn, so it needs a name of its own that customers see on its button, like "Premium Lofted Barn"'],
  ["a blank name", (c) => { c.offer.VLB = { base: "LB", name: "   ", sizes: SIZES }; c.categories[1][1].push("VLB"); },
    "offer.VLB is built like the Lofted Barn, so it needs a name of its own"],
  ["the base's own name", (c) => { c.offer.VLB = { base: "LB", name: "Lofted Barn", sizes: SIZES }; c.categories[1][1].push("VLB"); },
    'offer.VLB is called "Lofted Barn", the same name as offer.LB: customers would see two "Lofted Barn" buttons'],
  ["another style's name in other letters and spacing", (c) => { c.offer.VLB = { base: "LB", name: "  garage ", sizes: SIZES }; c.categories[1][1].push("VLB"); },
    'offer.VLB is called "garage", the same name as offer.G'],
  ["two manufacturer styles renamed alike", (c) => { c.offer.SB.name = "Lofted Barn"; },
    'is called "Lofted Barn", the same name as offer.'],
  ["the manufacturer's own code with a base", (c) => { c.offer.LB = { base: "SB", name: "Big Barn", sizes: SIZES }; },
    "offer.LB is the standard manufacturer's own Lofted Barn, so it cannot also be built like another style"],
  ["the manufacturer's code in other letters", (c) => { c.offer.lb = { base: "LB", name: "Low Barn", sizes: SIZES }; c.categories[1][1].push("lb"); },
    'offer.lb: the code "lb" is the manufacturer\'s "LB" (Lofted Barn) in other letters'],
  ["a code with a dash", (c) => { c.offer["LB-X"] = { base: "LB", name: "Low Barn", sizes: SIZES }; c.categories[1][1].push("LB-X"); },
    "offer.LB-X: a style's code is 1 to 8 letters or digits"],
  ["a code too long", (c) => { c.offer.LOFTEDBARN2 = { base: "LB", name: "Low Barn", sizes: SIZES }; c.categories[1][1].push("LOFTEDBARN2"); },
    "offer.LOFTEDBARN2: a style's code is 1 to 8 letters or digits"],
  ["a name too long", (c) => { c.offer.VLB = { base: "LB", name: "P".repeat(61), sizes: SIZES }; c.categories[1][1].push("VLB"); },
    "offer.VLB.name \"" + "P".repeat(61) + "\" is too long: a style's name is at most 60 letters"],
  ["a code with no base that is not a style", (c) => { c.offer.VLB = { name: "Premium Lofted Barn", sizes: SIZES }; c.categories[1][1].push("VLB"); },
    'there is no style "VLB" in the standard manufacturer file'],
  ["a style of its own in no group", (c) => { c.offer.VLB = { base: "LB", name: "Premium Lofted Barn", sizes: SIZES }; },
    "Premium Lofted Barn (VLB) is offered but in no category"],
];
for (const [what, mutate, want] of MISTAKES) {
  const c = copy(demoFile);
  mutate(c);
  const errs = validate(c, M);
  ok(G4, errs.some((e) => e.includes(want)), `${what}: expected a problem containing ${J(want)}, got ${J(errs.slice(0, 4))}`);
  let threw = null;
  try { resolve(c, M, LIB); } catch (e) { threw = e; }
  ok(G4, !!threw && threw.message.includes(want), `${what}: the price list still loaded`);
}
{
  /* good ones: the designer may open on one, a name 60 letters long fits */
  const c = copy(demoFile);
  c.offer.VLB = { base: "LB", name: "P".repeat(60), sizes: SIZES };
  c.categories[1][1].push("VLB");
  c.defaults.style = "VLB"; c.defaults.size = "10x16";
  const errs = validate(c, M);
  ok(G4, errs.length === 0, `a good style of its own was refused: ${J(errs)}`);
  if (!errs.length) {
    const cat = resolve(c, M, LIB);
    const st = defaults(cat);
    ok(G4, cat.defaults.type === "VLB" && st.type === "VLB" && st.items.length > 0, `the designer does not open on the style of its own: ${J(cat.defaults)}`);
  }
}

/* ------------------------------------------------------- 5. option names */
const G5 = "5. options can carry the owner's own names";
const NAMES = {
  dormers: { 9: "9 ft shed dormer" }, ramps: { r4: "Short ramp", kit: "Ramp kit" }, elec: { 1: "Basic electric", 2: "Shop electric" },
  misc: { shutter: "Board shutters", lite: "Window in a shop door", ext: "Porch light" }, rates: { dbl: "Two-layer floor", jo12: "Stronger floor" },
};
function named(file, withNames) {
  const c = copy(file);
  for (const g of Object.keys(NAMES)) for (const id of Object.keys(NAMES[g])) {
    c.options[g][id] = withNames ? { price: file.options[g][id], name: NAMES[g][id] } : { price: file.options[g][id] };
  }
  return c;
}
const NFILE = named(demoFile, true), PFILE = named(demoFile, false);
ok(G5, validate(NFILE, M).length === 0 && validate(PFILE, M).length === 0, `{"price", "name"} options were refused: ${J(validate(NFILE, M).concat(validate(PFILE, M)).slice(0, 4))}`);
const NCAT = resolve(NFILE, M, LIB), PCAT = resolve(PFILE, M, LIB);
ok(G5, J(NCAT.DORMERS.find((d) => d[0] === "9")) === J(["9", "9 ft shed dormer", 1550]), `the dormer button: ${J(NCAT.DORMERS)}`);
ok(G5, J(NCAT.RAMPS.find((r) => r[0] === "r4")) === J(["r4", "Short ramp", demoFile.options.ramps.r4]) && J(NCAT.RAMPS.find((r) => r[0] === "kit")) === J(["kit", "Ramp kit", demoFile.options.ramps.kit]),
  `the ramp buttons: ${J(NCAT.RAMPS)}`);
ok(G5, J(NCAT.ELECPK.find((e) => e[0] === "1")) === J(["1", "Basic electric", demoFile.options.elec["1"], "Basic electric"]) && J(NCAT.ELECPK.find((e) => e[0] === "3")) === J(DEMO.ELECPK.find((e) => e[0] === "3")),
  `the electrical buttons: ${J(NCAT.ELECPK)}`);
ok(G5, J(NCAT.MISCNAMES) === J(NAMES.misc) && J(NCAT.MISC) === J(DEMO.MISC), `shutters, door window, outside light: ${J(NCAT.MISCNAMES)} ${J(NCAT.MISC)}`);
ok(G5, NCAT.RATEDEF.dbl.name === "Two-layer floor" && NCAT.RATEDEF.dbl.quoteName === "Two-layer floor" && J(NCAT.RATEDEF.mbF) === J(DEMO.RATEDEF.mbF) && J(NCAT.RATES) === J(DEMO.RATES),
  `the upgrades: ${J(NCAT.RATEDEF)}`);
ok(G5, J(PCAT.DORMERS) === J(DEMO.DORMERS) && J(PCAT.RAMPS) === J(DEMO.RAMPS) && J(PCAT.ELECPK) === J(DEMO.ELECPK) && J(PCAT.MISC) === J(DEMO.MISC) && J(PCAT.MISCNAMES) === "{}" && J(PCAT.RATEDEF) === J(DEMO.RATEDEF) && J(PCAT.RATES) === J(DEMO.RATES),
  "options written {\"price\"} with no name do not resolve exactly like plain prices");
{
  const quote = (cat, pkg) => {
    const st = dressed(cat, "DS", "10x16");
    st.elec = { pkg, ext: true }; st.items = st.items.filter((i) => !i.pk); pkFixtures(st, frameOf(st, cat), cat);
    return priceParts(st, cat);
  };
  for (const pkg of [1, 2]) {
    const plain = quote(DEMO, pkg), bare = quote(PCAT, pkg), mine = quote(NCAT, pkg);
    const words = (p) => p.lines.map((l) => l[0]);
    const amounts = (p) => p.lines.map((l) => [l[1], l[2]]);
    ok(G5, J(bare) === J(plain), `package ${pkg}: options written {"price"} changed the quote\n      ${J(words(bare))}\n      ${J(words(plain))}`);
    ok(G5, J(amounts(mine)) === J(amounts(plain)) && mine.total === plain.total, `package ${pkg}: an option's name moved an amount\n      ${J(mine)}\n      ${J(plain)}`);
    const plainWords = words(plain), mineWords = words(mine);
    const today = ["9 ft dormer", `Electric package ${pkg}`, "Exterior light + dual switch", "4′ ramp", "Double floor", 'Floor joists 12" on center'];
    ok(G5, today.every((w) => plainWords.includes(w)) && plainWords.some((w) => /^Shutters × \d+ sets?$/.test(w)) && plainWords.some((w) => /^Door window × \d+$/.test(w)),
      `package ${pkg}: the demo's quote lost today's words: ${J(plainWords)}`);
    const mineWant = ["9 ft shed dormer", pkg === 1 ? "Basic electric" : "Shop electric", "Porch light", "Short ramp", "Two-layer floor", "Stronger floor"];
    ok(G5, mineWant.every((w) => mineWords.includes(w)) && mineWords.some((w) => /^Board shutters × \d+ sets?$/.test(w)) && mineWords.some((w) => /^Window in a shop door × \d+$/.test(w)),
      `package ${pkg}: the quote does not use the owner's names: ${J(mineWords)}`);
  }
  /* the ramp kit: its usual quote words, or the owner's name */
  const kit = (cat) => { const st = standardState(cat, "UT", "10x16"); st.ramp = "kit"; return priceParts(st, cat).lines.map((l) => l[0]); };
  ok(G5, kit(DEMO).includes("Ramp DIY kit (no wood)") && kit(NCAT).includes("Ramp kit"), `the ramp kit's quote words: ${J(kit(DEMO))} ${J(kit(NCAT))}`);
}
const OPTION_MISTAKES = [
  ["a price below 0", (o) => { o.elec["1"] = { price: -5, name: "Basic electric" }; }, "options.elec.1: the price must be a number of dollars, 0 or more"],
  ["a name with no price", (o) => { o.elec["1"] = { name: "Basic electric" }; }, "options.elec.1 has no price"],
  ["a price written as text", (o) => { o.ramps.r4 = { price: "240", name: "Short ramp" }; }, "options.ramps.r4: the price must be a number of dollars"],
  ["a blank name", (o) => { o.misc.shutter = { price: 70, name: " " }; }, "options.misc.shutter.name must be text"],
  ["a name that is not text", (o) => { o.rates.dbl = { price: 1.9, name: 7 }; }, "options.rates.dbl.name must be text"],
  ["a name too long", (o) => { o.dormers["6"] = { price: 1250, name: "D".repeat(61) }; }, "is too long: an option's name is at most 60 letters"],
  ["a misspelt field", (o) => { o.elec["2"] = { price: 775, nmae: "Shop electric" }; }, "options.elec.2.nmae is not part of an option"],
];
for (const [what, mutate, want] of OPTION_MISTAKES) {
  const c = copy(demoFile);
  mutate(c.options);
  const errs = validate(c, M);
  ok(G5, errs.some((e) => e.includes(want)), `${what}: expected a problem containing ${J(want)}, got ${J(errs.slice(0, 4))}`);
}
{
  const c = copy(demoFile); c.options.elec["1"] = { price: 675, name: "E".repeat(60) };
  ok(G5, validate(c, M).length === 0, `a 60-letter option name was refused: ${J(validate(c, M))}`);
}

/* --------------------------------------------------- 6. the spreadsheet */
const G6 = "6. the spreadsheet keeps a style of its own and an option's name";
{
  const both = copy(NFILE);
  both.offer.VLB = { base: "LB", name: "Premium Lofted Barn", sizes: { "10x16": 6290, "12x24": 9990 } };
  both.categories[1][1].push("VLB");
  ok(G6, validate(both, M).length === 0, `the spreadsheet's company does not validate: ${J(validate(both, M).slice(0, 3))}`);
  const csv = exportCsv(both, M);
  ok(G6, /^VLB,10x16,6290,Premium Lofted Barn$/m.test(csv) && /^elec\.1,675,Basic electric$/m.test(csv), "the spreadsheet does not list the style of its own and the named option by price and name");
  const back = readPriceRows(csv, M, both);
  const again = applyPrices(both, back, M);
  ok(G6, back.problems.length === 0 && again.changes.length === 0 && J(again.company) === J(both), `out and back in changed something: ${J(back.problems.concat(again.changes)).slice(0, 300)}`);
  const edited = "style,size,price\nPremium Lofted Barn,10x16,6400\noption,price\nelec.1,700\n";
  const rows = readPriceRows(edited, M, both);
  const next = applyPrices(both, rows, M).company;
  ok(G6, rows.problems.length === 0 && J(next.offer.VLB.sizes) === J({ "10x16": 6400 }) && next.offer.VLB.base === "LB" && next.offer.VLB.name === "Premium Lofted Barn" && J(next.offer.LB) === J(both.offer.LB),
    `a row for the Premium Lofted Barn did not price it (and only it): ${J(next.offer.VLB)} ${J(rows.problems)}`);
  ok(G6, J(next.options.elec["1"]) === J({ price: 700, name: "Basic electric" }), `a new price lost the option's name: ${J(next.options.elec["1"])}`);
}

/* ------------------------------------------------------------- report */
let pass = 0, fail = 0;
console.log("Styles built like another, and options with the owner's own names:");
for (const [g, c] of counts) {
  pass += c.pass; fail += c.fail;
  console.log(`  ${c.fail ? "FAIL" : "ok  "} ${g}: ${c.pass} passed${c.fail ? `, ${c.fail} failed` : ""}`);
}
if (failures.length) { console.log("\nProblems:"); for (const f of failures) console.log("  " + f); }
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`\n${pass} of ${pass + fail} checks passed: ${compared} pairs of buildings drawn and priced (${STYLES.length} styles at ${sizes} sizes, side porches turned, every style with every option), ${(triangles / 1e6).toFixed(1)} million triangles each side, in ${secs} s.`);
if (fail) {
  console.log(`FAIL: ${fail} check(s) failed -- a style built like another is not exactly its base, or an option name is not handled (see Problems above).`);
  process.exit(1);
}
console.log("PROVED: a style of the owner's own, built like a library style, comes with the same doors and windows, settles the same construction, draws the same finished building and framing triangle for triangle and prices the same as its base at every size; option names change only the words on the buttons and the quote; every mistake is named in plain words.");
