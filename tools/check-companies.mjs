/* PROVE A COMPANY IS ONE SETTINGS FILE, CHECKED, AND NEVER GIVEN A PRICE IT DID NOT SET.

   node tools/check-companies.mjs

   1. Every companies/<id>/company.json (demo, starter, the template) passes
      validation and turns into a catalogue; each folder's id matches its file.
   2. The manufacturer file passes, and carries no price anywhere.
   3. Barnwright written as a company (tools/lib/barnwright-company.mjs) turns
      into Barnwright's EXACT tables (test/golden/barnwright-catalogue.json):
      prices, styles, categories, items, options, colours, package texts.
   4. The demo: every standard style at every standard size, in Barnwright's
      order, with the documented example formula -- and not one of Barnwright's
      real prices; its standard doors and windows are Barnwright's.
   5. The starter: three styles, its own name and colours, true colour on,
      leads to a form.
   6. Broken copies give the RIGHT plain-English error (about 35 mistakes a
      person could make), and resolve refuses them.
   7. A company inherits NO price: blank out any single price in the demo and
      validation names it; every price in a resolved catalogue is found at the
      same place in the company's own file; a manufacturer file with a price in
      it is refused.
   8. Data loadouts (the no-code way to describe a new style) reproduce the
      named Barnwright recipes at every size, and the formula reader refuses
      anything that is not arithmetic.
   9. The loaders refuse bad ids and looping manufacturer files, and the
      browser loader (ui/load.js, served on port 8312) builds the same
      catalogue as the Node one. */

import { readdirSync, existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { ROOT, readJSON, readManufacturer, loadCompany, loadCatalogue } from "./lib/load.mjs";
import { barnwrightCompany, barnwrightCatalogue, golden } from "./lib/barnwright-company.mjs";
import { validate, validateManufacturer, resolve } from "../model/company.js";
import { includedItems, evalDataRecipe, evalFormula } from "../model/loadouts.js";
import { frameOf } from "../model/frame.js";
import { resetItems } from "../model/layout.js";
import { serveFolder, loadPlaywright, CHROMIUM_ARGS } from "./lib/barnwright-page.mjs";

const counts = {};
const failures = [];
function check(group, ok, msg) {
  counts[group] = counts[group] || { pass: 0, fail: 0 };
  if (ok) counts[group].pass++; else { counts[group].fail++; failures.push(`[${group}] ${msg}`); }
  return ok;
}
const J = (v) => JSON.stringify(v);
const copy = (v) => JSON.parse(JSON.stringify(v));
const M = readManufacturer("standard");
const LIB = readJSON("library/construction.json");
const G = golden();

/* ---------------------------------------------------------------- 1 */
const dirs = readdirSync(resolvePath(ROOT, "companies"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
for (const dir of dirs) {
  const path = `companies/${dir}/company.json`;
  if (!check("every company file validates and resolves", existsSync(resolvePath(ROOT, path)), `${path} is missing`)) continue;
  const r = dir.startsWith("_") ? loadCompany(null, { path }) : loadCompany(dir);
  check("every company file validates and resolves", r.problems.length === 0, `${path}: ${r.problems.join(" | ")}`);
  check("every company file validates and resolves", !!r.catalogue && Object.isFrozen(r.catalogue), `${path} did not resolve to a frozen catalogue`);
}
check("every company file validates and resolves", ["demo", "starter", "_template"].every((d) => dirs.indexOf(d) >= 0), `expected demo, starter and _template, found ${dirs.join(", ")}`);

/* ---------------------------------------------------------------- 2 */
check("the manufacturer file", validateManufacturer(M).length === 0, validateManufacturer(M).join(" | "));
(function scan(v, path) {
  if (Array.isArray(v)) return v.forEach((x, i) => scan(x, path + "[" + i + "]"));
  if (v && typeof v === "object") for (const k of Object.keys(v)) {
    check("the manufacturer file", k !== "p" && k !== "price" && k !== "prices", `${path}.${k} looks like a price`);
    scan(v[k], path + "." + k);
  }
})(M, "standard");
{
  const bad = copy(M); bad.items.w48.price = 150;
  check("the manufacturer file", validateManufacturer(bad).some((e) => /carries NO prices/.test(e)), "a manufacturer file with a price was not refused");
}

/* ---------------------------------------------------------------- 3 */
const BW = barnwrightCatalogue();
function sameAs(label, ours, theirs) { check("Barnwright as a company = Barnwright's exact tables", J(ours) === J(theirs), `${label}: ${J(ours).slice(0, 200)} vs ${J(theirs).slice(0, 200)}`); }
sameAs("P", BW.P, G.P);
sameAs("CATS", BW.CATS, G.CATS);
for (const k of Object.keys(G.TYPES)) { const o = {}; for (const f of Object.keys(G.TYPES[k])) o[f] = BW.TYPES[k][f]; sameAs("TYPES." + k, o, G.TYPES[k]); }
for (const k of Object.keys(G.CAT)) {
  const o = {}; for (const f of Object.keys(G.CAT[k])) o[f] = BW.CAT[k][f];
  sameAs("CAT." + k, o, G.CAT[k]);
  const extra = ["gable", "int", "stretch", "free", "perFt", "dep", "sill"].filter((f) => BW.CAT[k][f] !== undefined && G.CAT[k][f] === undefined);
  sameAs("CAT." + k + " extra Barnwright flags", extra, []);
}
sameAs("CAT order", Object.keys(BW.CAT), Object.keys(G.CAT));
for (const k of ["DORMERS", "RAMPS", "ELECPK", "MISC", "RATES", "OPTX", "COLORS", "ELECDESC"]) sameAs(k, BW[k], G[k]);

/* ---------------------------------------------------------------- 4 demo */
const demoFile = readJSON("companies/demo/company.json");
const DEMO = loadCatalogue("demo");
check("the demo company", J(Object.keys(DEMO.P)) === J(Object.keys(G.P)), "the demo does not offer every standard style in order");
const RATE = { "Utility & Storage": 26, "Barns": 29, "Cabins": 36, "Garages": 34, "Metal Buildings": 31, "Dog Kennels": 52 };
let realPriceHits = 0;
for (const k of Object.keys(G.P)) {
  check("the demo company", J(Object.keys(DEMO.P[k] || {})) === J(Object.keys(G.P[k])), `${k}: the demo's sizes are not Barnwright's sizes in order`);
  for (const z of Object.keys(G.P[k])) {
    const [W, L] = z.split("x").map(Number);
    const want = Math.round((900 + RATE[M.styles[k].category] * W * L) / 5) * 5;
    check("the demo company", DEMO.P[k][z] === want, `${k} ${z}: ${DEMO.P[k][z]} is not the documented example formula (${want})`);
    if (DEMO.P[k][z] === G.P[k][z]) realPriceHits++;
  }
}
for (const k of Object.keys(G.CAT)) if (G.CAT[k].p && DEMO.CAT[k] && DEMO.CAT[k].p === G.CAT[k].p) realPriceHits++;
check("the demo company", realPriceHits === 0, `${realPriceHits} demo prices are Barnwright's real prices`);
check("the demo company", DEMO.brand.name === "Portable Buildings" && DEMO.brand.initials === "PB", "the demo's brand is not Barnwright's default 'Portable Buildings'");
check("the demo company", DEMO.look.trueColour === false && DEMO.leads.mode === "none", "the demo must have look.trueColour false and leads mode none");
check("the demo company", J(DEMO.COLORS) === J(G.COLORS), "the demo's colours are not Barnwright's (the golden test draws with them)");
for (const k of Object.keys(G.P)) for (const z of Object.keys(G.P[k])) {
  const a = { type: k, size: z, pLen: 12, pFlip: false, pMid: false, items: [], opts: {}, elec: { pkg: 0 } };
  const b = copy(a);
  resetItems(a, frameOf(a, DEMO), DEMO); resetItems(b, frameOf(b, BW), BW);
  check("the demo company", J(a.items) === J(b.items), `${k} ${z}: the demo's standard doors and windows differ from Barnwright's`);
}

/* ---------------------------------------------------------------- 5 starter */
const stFile = readJSON("companies/starter/company.json");
const ST = loadCatalogue("starter");
check("the starter company", J(Object.keys(ST.P)) === J(["UT", "LB", "G"]), `starter offers ${Object.keys(ST.P)}`);
check("the starter company", ST.brand.name === "Cedar Ridge Sheds", "the starter is not Cedar Ridge Sheds");
check("the starter company", ST.look.trueColour === true, "the starter should use true colour");
check("the starter company", ST.leads.mode === "form" && /^https:\/\//.test(ST.leads.url), "the starter should send leads to a form");
const ownColours = ST.COLORS.paint.filter((c) => !M.palettes.paint.some((m) => m[0] === c[0] && m[1] === c[1]));
check("the starter company", ownColours.length > 0, "the starter has no colours of its own");
check("the starter company", ST.TYPES.LB.name === "Loft Barn", "a style rename in offer did not take");
check("the starter company", !ST.CAT.dfr && ST.OPTX.hide.indexOf("cat.dfr") >= 0, "an item the starter does not price is still offered");

/* ---------------------------------------------------------------- 6 broken copies */
const BROKEN = [
  ["a company id with a space", (c) => { c.id = "Acme Sheds"; }, "is not allowed"],
  ["an unknown status", (c) => { c.status = "paused"; }, "status must be \"active\" or \"suspended\""],
  ["the wrong manufacturer", (c) => { c.manufacturer = "acme"; }, "manufacturer is \"acme\""],
  ["no brand name", (c) => { c.brand.name = ""; }, "brand.name is missing"],
  ["a bad brand colour", (c) => { c.brand.colors.header = "#12345"; }, "is not a colour"],
  ["an unknown style", (c) => { c.offer.ZZ = { sizes: { "10x20": 5000 } }; }, "there is no style \"ZZ\""],
  ["a size written wrong", (c) => { c.offer.UT.sizes["10-20"] = 5000; }, "a size must be written width x length"],
  ["a size with no price", (c) => { c.offer.UT.sizes["10x20"] = null; }, "has no price"],
  ["a size priced 0", (c) => { c.offer.UT.sizes["10x20"] = 0; }, "must be more than 0"],
  ["a price written as text", (c) => { c.offer.UT.sizes["10x20"] = "6095"; }, "must be a number of dollars"],
  ["a standard door not priced", (c) => { delete c.items.w72; }, "items.w72 needs a price: the 72″ Wooden Double Doors (w72) comes as standard on the Utility Shed (UT)"],
  ["an unknown item", (c) => { c.items.zz = 50; }, "there is no item \"zz\""],
  ["an item priced below 0", (c) => { c.items.w48 = -5; }, "0 or more"],
  ["a dormer style with no dormers", (c) => { c.options.dormers = {}; }, "needs at least one dormer size with a price"],
  ["packages without the switch priced", (c) => { delete c.items.gfci; }, "items.gfci needs a price"],
  ["the exterior light without the light priced", (c) => { delete c.items.light; }, "items.light needs a price"],
  ["an unknown ramp", (c) => { c.options.ramps.r9 = 400; }, "the manufacturer has no ramps option \"r9\""],
  ["a rate with no price", (c) => { c.options.rates.dbl = null; }, "options.rates.dbl has no price"],
  ["an unknown option group", (c) => { c.options.paint = {}; }, "is not an option group"],
  ["an extra of an unknown kind", (c) => { c.options.extras = [{ key: "x1", name: "Thing", input: "bogus", price: 5 }]; }, "is not a kind of extra"],
  ["two extras with one key", (c) => { c.options.extras = [{ key: "x1", name: "A", input: "check", price: 5 }, { key: "x1", name: "B", input: "check", price: 5 }]; }, "is used twice"],
  ["a style in no category", (c) => { c.categories = c.categories.filter((g) => g[0] !== "Dog Kennels"); }, "in no category"],
  ["a category listing an unoffered style", (c) => { c.categories[0][1].push("QQ"); }, "which is not in offer"],
  ["an unknown colour name", (c) => { c.palettes = { paint: ["White", "Nope"] }; }, "has no colour called \"Nope\""],
  ["a colour pair with a bad hex", (c) => { c.palettes = { paint: [["Sky", "blue"]] }; }, "must be [name, \"#rrggbb\"]"],
  ["a default style not offered", (c) => { c.defaults.style = "QQ"; }, "is not an offered style"],
  ["a default size not sold", (c) => { c.defaults.size = "99x99"; }, "is not a size of"],
  ["a default colour not on the card", (c) => { c.defaults.colors.body = "Nope"; }, "is not on the paint palette"],
  ["a misspelt setting", (c) => { c.offers = {}; }, "is not a setting a company file can have"],
  ["a construction rule testing something unknown", (c) => { c.construction = { floor: { joist: [{ when: { maxWidth: 8 }, value: "2x4" }, { value: "2x6" }] } }; }, "tests \"maxWidth\""],
  ["a rule list with no fallback", (c) => { c.construction = { floor: { joist: [{ when: { maxW: 8 }, value: "2x4" }] } }; }, "the last rule should have no \"when\""],
  ["an unknown lead mode", (c) => { c.leads = { mode: "fax" }; }, "is not a way to receive leads"],
  ["a form with no address", (c) => { c.leads = { mode: "form" }; }, "leads.url is missing"],
  ["a form on plain http", (c) => { c.leads = { mode: "form", url: "http://forms.example.com/x" }; }, "must start with https://"],
  ["mailto with no e-mail", (c) => { c.leads = { mode: "mailto" }; c.brand.email = ""; }, "needs an e-mail address"],
  ["postMessage with no embedding site", (c) => { c.leads = { mode: "postMessage" }; c.embed = { origins: [] }; }, "embed.origins must list that site"],
  ["a lead field with a bad setting", (c) => { c.leads = { mode: "none", fields: { phone: "maybe" } }; }, "must be \"required\", \"optional\" or \"off\""],
  ["an embed origin of *", (c) => { c.embed = { origins: ["*"] }; }, "which would let ANY website embed"],
  ["an embed origin of https://*", (c) => { c.embed = { origins: ["https://*"] }; }, "has a \"*\" in it"],
  ["an embed origin of https://*.com", (c) => { c.embed = { origins: ["https://*.com"] }; }, "has a \"*\" in it"],
  ["an embed origin of every subdomain", (c) => { c.embed = { origins: ["https://*.acme.com"] }; }, "has a \"*\" in it"],
  ["an embed origin on http", (c) => { c.embed = { origins: ["http://acme.com"] }; }, "must start with https://"],
  ["an embed origin with a path", (c) => { c.embed = { origins: ["https://acme.com/sheds"] }; }, "with no path"],
  ["a bad share address", (c) => { c.embed = { origins: [], shareUrl: "ftp://acme.com/x" }; }, "must start with https://"],
  ["an unknown scene", (c) => { c.look.scene = "beach"; }, "look.scene must be one of"],
  ["a bad rent-to-own factor", (c) => { c.pricing.rto.factors["36"] = 2; }, "a factor between 0 and 1"],
  ["cfg of 0", (c) => { c.cfg = 0; }, "cfg must be a whole number"],
];
for (const [what, mutate, want] of BROKEN) {
  const c = copy(demoFile);
  mutate(c);
  const errs = validate(c, M);
  const hit = errs.find((e) => e.indexOf(want) >= 0);
  check("broken copies give the right plain-English error", !!hit, `${what}: expected an error containing ${J(want)}, got ${J(errs)}`);
  let threw = null;
  try { resolve(c, M, LIB); } catch (e) { threw = e; }
  check("broken copies give the right plain-English error", !!threw && threw.message.indexOf(want) >= 0, `${what}: resolve did not refuse it`);
}
{
  const c = copy(demoFile); c.embed = { origins: ["http://localhost:8080", "http://127.0.0.1:8312", "https://acme.com"] };
  check("broken copies give the right plain-English error", validate(c, M).length === 0, "localhost / 127.0.0.1 on http should be allowed as embed origins: " + validate(c, M).join(" | "));
  /* the embedding page's origin never ends in "/", and it is compared letter
     for letter, so a trailing slash in the file must not survive into the catalogue */
  const c2 = copy(demoFile); c2.embed = { origins: ["https://acme.com/", "http://localhost:8080/"] };
  check("broken copies give the right plain-English error", J(resolve(c2, M, LIB).embed.origins) === J(["https://acme.com", "http://localhost:8080"]), "an origin written with a trailing slash was not stored as the bare origin");
}
{
  /* a package fixture nobody priced would be left out of a package the
     customer pays for: validation reads the fixtures from the manufacturer */
  const m2 = copy(M); m2.items.dimmer = { name: "Dimmer Switch", kind: "out", draw: "outlet", w: 0.7, h: 1, int: true };
  m2.options.elec["2"].fixtures.push({ cat: "dimmer", wall: "R", pos: "1" });
  const errs = validate(copy(demoFile), m2);
  check("broken copies give the right plain-English error", errs.some((e) => e.indexOf("items.dimmer needs a price") >= 0), `a package fixture with no price was not named: ${J(errs)}`);
  const only1 = copy(demoFile); delete only1.options.elec["2"]; delete only1.options.elec["3"]; delete only1.items.outlet;
  check("broken copies give the right plain-English error", !validate(only1, m2).some((e) => /items\.(outlet|dimmer) needs a price/.test(e)), "a fixture of a package the company does not sell was demanded a price");
}

/* ---------------------------------------------------------------- 7 no inherited price */
function pricePaths(c) {
  const out = [];
  for (const k of Object.keys(c.offer)) for (const z of Object.keys(c.offer[k].sizes)) out.push([["offer", k, "sizes", z], `offer.${k}.sizes[${J(z)}]`]);
  for (const k of Object.keys(c.items)) out.push([["items", k], `items.${k}`]);
  for (const g of ["dormers", "ramps", "elec", "misc", "rates"]) for (const k of Object.keys((c.options || {})[g] || {})) out.push([["options", g, k], `options.${g}.${k}`]);
  return out;
}
for (const [path, name] of pricePaths(demoFile)) {
  const c = copy(demoFile);
  let o = c; for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
  o[path[path.length - 1]] = null;
  const errs = validate(c, M);
  check("a company inherits NO price", errs.some((e) => e.indexOf(name) >= 0 && /no price/.test(e)), `blanking ${name} did not give a "no price" error naming it: ${J(errs)}`);
}
for (const [id, file] of [["demo", demoFile], ["starter", stFile]]) {
  const cat = loadCatalogue(id);
  for (const k of Object.keys(cat.P)) for (const z of Object.keys(cat.P[k])) check("a company inherits NO price", cat.P[k][z] === file.offer[k].sizes[z], `${id} ${k} ${z}`);
  for (const k of Object.keys(cat.CAT)) { const v = file.items[k]; check("a company inherits NO price", cat.CAT[k].p === (typeof v === "object" ? v.price : v), `${id} item ${k}`); }
  for (const [list, g] of [[cat.DORMERS, "dormers"], [cat.RAMPS, "ramps"], [cat.ELECPK, "elec"]]) {
    for (const row of list.slice(1)) check("a company inherits NO price", row[2] === file.options[g][row[0]], `${id} ${g}.${row[0]}`);
  }
  for (const k of Object.keys(cat.MISC)) check("a company inherits NO price", cat.MISC[k] === file.options.misc[k], `${id} misc.${k}`);
  for (const k of Object.keys(cat.RATES)) check("a company inherits NO price", cat.RATES[k] === file.options.rates[k], `${id} rate.${k}`);
}

/* ---------------------------------------------------------------- 8 data loadouts + formulas */
const DATA = {
  UT: [{ cat: "w72", wall: "F", at: "center" }],
  MU: [{ cat: "w72", wall: "F" }],
  SU: [{ cat: "w72", wall: "R" }, { cat: "w23", wall: "R", at: { sym: "q+1.4" } }],
  SLB: [{ cat: "w72", wall: "R" }, { cat: "w23", wall: "R", at: { sym: "q+1.4" } }],
  GU: [{ cat: "w48", wall: "F" }],
  SB: [{ cat: "w48", wall: "F" }],
  LB: [{ cat: "w72", wall: "F" }, { cat: "fake", wall: "F" }],
  MLB: [{ cat: "w72", wall: "F" }],
  SS: [{ cat: "d36lite", wall: "R" }, { cat: "w23", wall: "R", at: { sym: "min(q+1.6, L/2-2.4)" } },
    { cat: "tr", wall: "R", repeat: { count: "L<12 ? 2 : 3+floor((L-12)/4)", spread: "min(L-3.5, L*0.74)" } }],
  G: [{ cat: "ru8", wall: "F" }, { cat: "d36in", wall: "R", at: { pos: "q+1.6" } }, { cat: "w23", wall: "R", at: { pos: "-q-1.6" } }],
  MG: [{ cat: "ru8", wall: "F" }, { cat: "d36in", wall: "R", at: { pos: "q+1.6" } }, { cat: "w23", wall: "R", at: { pos: "-q-1.6" } }],
  LBG: [{ cat: "ru8", wall: "F" }, { cat: "d36in", wall: "R", at: { pos: "q+1.6" } }, { cat: "w23", wall: "R", at: { pos: "-q-1.6" } }, { cat: "fake", wall: "F" }],
  DK: [{ cat: "w48", wall: "B" }, { cat: "w23", wall: "R", at: { pos: "q" } }, { cat: "w23", wall: "L", at: { pos: "-q" } }],
};
for (const k of Object.keys(DATA)) for (const z of Object.keys(G.P[k])) {
  const s = { type: k, size: z, pLen: 12, pFlip: false, pMid: false, items: [] };
  const fr = frameOf(s, BW);
  const ctx = { CAT: BW.CAT, span: fr.span, ws: fr.ws };
  const named = includedItems(k, fr.d.W, fr.d.L, ctx), data = evalDataRecipe(DATA[k], fr.d.W, fr.d.L, ctx);
  check("data loadouts = the named Barnwright recipes", J(named) === J(data), `${k} ${z}: ${J(data)} vs ${J(named)}`);
}
{
  /* fromStart / fromEnd / when / ifFits / dbl on a 10x16 Utility's R wall (len 16) */
  const s = { type: "UT", size: "10x16", pLen: 12, items: [] };
  const fr = frameOf(s, BW);
  const got = evalDataRecipe([
    { cat: "w48", wall: "R", at: { fromStart: "0.9" } },
    { cat: "w23", wall: "R", at: { fromEnd: "1" }, dbl: true },
    { cat: "w33", wall: "R", when: { minL: 20 } },
    { cat: "w23", wall: "R", at: { pos: "-5" }, ifFits: true },
    { cat: "w23", wall: "R", at: { pos: "7.5" }, ifFits: true },
  ], fr.d.W, fr.d.L, { CAT: BW.CAT, span: fr.span, ws: fr.ws });
  const want = [["w48", -8 + 0.9 + 4.021 / 2], ["w23", 8 - 1 - (2 * 2.1 + 0.27) / 2]];
  check("data loadouts = the named Barnwright recipes", got.length === 2 && got.every((it, i) => it.cat === want[i][0] && Math.abs(it.pos - want[i][1]) < 1e-12) && got[1].dbl === true,
    `fromStart/fromEnd/when/ifFits gave ${J(got)}`);
}
const GOOD = [["L/4+1.4", { L: 20 }, 6.4], ["min(L-3.5, L*0.74)", { L: 30 }, 22.2], ["L<12 ? 2 : 3+floor((L-12)/4)", { L: 30 }, 7],
  ["-L/4", { L: 16 }, -4], ["CAT.w48.w/2", { CAT: { w48: { w: 4 } } }, 2], ["(W+L)*2", { W: 10, L: 20 }, 60], ["abs(-3)+round(2.4)", {}, 5]];
for (const [src, vars, want] of GOOD) {
  let v; try { v = evalFormula(src, vars); } catch (e) { v = e.message; }
  check("the formula reader", Math.abs(v - want) < 1e-12, `${src} gave ${v}, not ${want}`);
}
const EVIL = ["constructor", "__proto__", "process.exit()", "a=1", "CAT.w48.constructor", "this", "globalThis", "W;L", "'x'", "L/4+", "eval(1)",
  "toString", "CAT.__proto__.w", "W.constructor", "x".repeat(201), "[1]", "{}", "L`", "require('fs')"];
for (const src of EVIL) {
  let err = null; try { evalFormula(src, { W: 10, L: 20, q: 5, len: 20, CASING: 0.27, CAT: { w48: { w: 4, h: 6 } } }); } catch (e) { err = e; }
  check("the formula reader", !!err && /formula/.test(err.message), `${J(src.slice(0, 30))} was not refused in plain words (${err ? err.message : "no error"})`);
}

/* ---------------------------------------------------------------- 9 loaders */
for (const bad of ["Bad Id", "../x", "a", "x".repeat(41), "demo/../starter", ""]) {
  let err = null; try { loadCompany(bad); } catch (e) { err = e; }
  check("the loaders", !!err && /is not allowed/.test(err.message), `the company id ${J(bad)} was not refused (${err && err.message})`);
}
{
  const files = {
    "library/manufacturers/aa.json": { id: "aa", extends: "bb" },
    "library/manufacturers/bb.json": { id: "bb", extends: "aa" },
    "library/manufacturers/kid.json": { id: "kid", extends: "standard", name: "Kid", styles: { XX: { name: "Tiny Shed", category: "Tiny", roof: "gable", wallH: 6, loadout: "barnwright:UT" } } },
  };
  const reader = (rel) => files[rel] ? copy(files[rel]) : readJSON(rel);
  let err = null; try { readManufacturer("aa", reader); } catch (e) { err = e; }
  check("the loaders", !!err && /loop/.test(err.message), "a manufacturer that extends itself in a circle was not refused");
  const kid = readManufacturer("kid", reader);
  check("the loaders", !!kid.styles.XX && !!kid.styles.UT && !!kid.items.w48 && kid.id === "kid" && validateManufacturer(kid).length === 0,
    "a manufacturer extending the standard one did not keep both its own and the standard styles");
}
{
  const r = loadCompany("demo", { reader: (rel) => { const v = readJSON(rel); if (rel.startsWith("companies/")) v.id = "other"; return v; } });
  check("the loaders", r.problems.length === 1 && /must be "demo"/.test(r.problems[0]), "a company file whose id does not match its folder was not refused");
}
/* the browser loader, for real */
{
  const server = await serveFolder(ROOT, 8312, "ui/load.js");
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: CHROMIUM_ARGS });
  try {
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:8312/companies/demo/company.json");
    const got = await page.evaluate(async () => {
      const L = await import("/ui/load.js");
      const out = {};
      for (const id of ["demo", "starter"]) out[id] = JSON.parse(JSON.stringify(await L.loadCatalogue(id)));
      try { await L.loadCatalogue("../demo"); out.bad = "loaded"; } catch (e) { out.bad = e.message; }
      try { await L.loadCatalogue("no-such-company"); out.missing = "loaded"; } catch (e) { out.missing = e.message; }
      return out;
    });
    for (const id of ["demo", "starter"]) check("the loaders", J(got[id]) === J(loadCatalogue(id)), `the browser loader built a different ${id} catalogue from the Node one`);
    check("the loaders", /is not allowed/.test(got.bad), "the browser loader did not refuse a bad id: " + got.bad);
    check("the loaders", /Could not load companies\/no-such-company\/company.json/.test(got.missing), "a missing company did not say so in plain words: " + got.missing);
  } finally { await browser.close(); await server.stop(); }
}

/* ---------------------------------------------------------------- report */
let total = 0, bad = 0;
console.log("Company settings:");
for (const [g, c] of Object.entries(counts)) {
  total += c.pass + c.fail; bad += c.fail;
  console.log(`  ${c.fail ? "FAIL" : "ok  "} ${g}: ${c.pass} passed${c.fail ? `, ${c.fail} failed` : ""}`);
}
if (failures.length) { console.log("\nProblems:"); for (const f of failures.slice(0, 40)) console.log("  " + f); }
console.log(`\n${total - bad} of ${total} checks passed.`);
if (bad) process.exit(1);
console.log("Proved: every company is one settings file that validates and resolves; Barnwright as a company gives Barnwright's exact tables; mistakes are named in plain words; no company ever gets a price it did not set.");
