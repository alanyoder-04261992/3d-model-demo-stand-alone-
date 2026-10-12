/* PROVE A DESIGN SURVIVES BEING SAVED, SHARED AND OPENED AGAIN.

   node tools/check-design.mjs

   1. Round trip: for sampled designs on the Barnwright and demo catalogues
      (every style; standard, and with dormers, packages, ramps, upgrades,
      double windows, shutters, door windows, swapped doors, benches and
      shelves, gable windows moved up, side porches flipped and centred,
      door and shutter colours, company extras):
        live state -> fromState -> encode -> decode -> toState
      gives the same items (same kinds, walls and flags; positions to the
      thousandth of a foot the link keeps) and EXACTLY the same priceParts, with
      no warnings; and the saved design itself comes back identical, both
      compressed ("z...") and plain.
   2. A 30-item design's link is under 1,800 characters.
   3. Colour and option names in any alphabet survive (UTF-8 + base64url;
      never btoa on text), and the link uses only URL-safe characters.
   4. Anything that no longer exists -- a style, a size, an item, a wall, a
      colour, an upgrade, an extra -- comes back as a plain-English warning,
      never a silent drop; a company's renames map old names to new ones.
   5. A damaged link is refused in plain words; a hand-edited one (a position
      that is not a number, an item, style, size, wall or colour called
      "constructor" or "__proto__", an item that is not a list) is read with a
      warning -- never a crash, a NaN position or a NaN price; a link with no
      item list gets the standard doors and windows; and a quote never adds a
      price the company does not have (no NaN total).
   6. normalize switches off what a company does not offer (and makes a short
      side porch 4x8), and changes nothing on a Barnwright design.
   8. Side porch lengths (How it's built): a 10 ft porch on a style selling
      10 and 14 ft survives a link round trip; an old link with a 12 ft porch
      opens on that style as 14 ft with one plain line; a 12 ft porch saved
      before the owner cut the lengths to 8 ft reopens as 8 ft, its porch
      walls laid out again, and is priced on the server, while the stale
      design itself is "no longer offered" (409), never "could not be read".
   7. toState lays a saved building out at ITS size (size, then style, then
      size), a new visitor starts exactly where Barnwright's page starts, and a
      style change keeps the electrical package's fixtures. */

import { barnwrightCatalogue, golden } from "./lib/barnwright-company.mjs";
import { readJSON, readManufacturer, loadCatalogue } from "./lib/load.mjs";
import { resolve, validate } from "../model/company.js";
import { frameOf } from "../model/frame.js";
import { resetItems, pkFixtures, clampPos, freeSpot } from "../model/layout.js";
import * as LAYOUT from "../model/layout.js";
import * as S from "../ui/state.js";
import { priceParts, optxList } from "../model/pricing.js";
import { defaults, fromState, toState, normalize, encode, encodeSync, decode, decodeSync, setType, flipPorch } from "../model/design.js";
import { mulberry32 } from "../engine/seeded.js";
import { priceDesign } from "../server/office/pricing.js";
import { makePlan } from "../model/plan.js";
import { checkBuilding } from "../model/style-check.js";

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
const BW = barnwrightCatalogue();
const DEMO = loadCatalogue("demo");
const EXTRAS = [
  { key: "ex1", name: "Loft ladder", input: "check", price: 250 },
  { key: "ex2", name: "Vents", input: "qty", price: 35 },
  { key: "ex3", name: "Trim run", input: "lf", price: 4.5 },
  { key: "ex4", name: "Spray foam", input: "sqftF", price: 1.1 },
];
const BWX = barnwrightCatalogue((c) => { c.options.extras = EXTRAS; });

/* ---------------------------------------------------------------- sample states */
function sampleStates(cat, rnd) {
  const out = [];
  for (const t of Object.keys(cat.P)) {
    const sizes = Object.keys(cat.P[t]);
    for (const z of [sizes[0], sizes[sizes.length - 1]]) {
      const std = () => { const s = defaults(cat); setType(s, t, cat); s.size = z; resetItems(s, frameOf(s, cat), cat); return s; };
      out.push(["standard", std()]);
      const s = std();
      const fr = frameOf(s, cat);
      if (cat.TYPES[t].dormer) s.dormer = ["none", "6", "12"][Math.floor(rnd() * 3)];
      s.elec = { pkg: 1 + Math.floor(rnd() * 3), ext: rnd() < 0.5 };
      pkFixtures(s, fr, cat);
      s.ramp = ["r4", "r6", "kit"][Math.floor(rnd() * 3)];
      for (const k of Object.keys(s.opts)) s.opts[k] = rnd() < 0.5;
      s.doorC = cat.COLORS.paint[3][1]; s.shutC = cat.COLORS.paint[8 % cat.COLORS.paint.length][1];
      const siding = cat.TYPES[t].metal ? cat.COLORS.metal : cat.COLORS.paint;
      s.body = siding[1][1];
      /* each change is followed by clampPos on the changed item, as the item
         sheet does */
      const wins = s.items.filter((i) => cat.CAT[i.cat].k === "win" && !cat.CAT[i.cat].gable);
      if (wins[0]) { wins[0].dbl = true; wins[0].shut = true; clampPos(wins[0], s, fr); }
      if (wins[1]) { wins[1].cat = "w33"; clampPos(wins[1], s, fr); }
      const doors = s.items.filter((i) => cat.CAT[i.cat].draw === "shop-door");
      if (doors[0]) { doors[0].lite = true; if (doors[0].cat === "w48") { doors[0].cat = "w72"; clampPos(doors[0], s, fr); } }
      const add = (it) => { it.id = "i" + (s.seq++); clampPos(it, s, fr); s.items.push(it); };
      add({ cat: "w23", wall: "L", pos: freeSpot("L", 2.1, s, fr), inc: false, shut: true });
      add({ cat: "tr", wall: "B", pos: freeSpot("B", 1, s, fr), inc: false, shut: false, rot: true });
      /* on the back gable where the designer offers it there, else high on
         the left side (a gable too low for it: model/layout.js gableItemFits) */
      add(LAYOUT.fitsOnWall(cat.CAT.g1824, "B", fr) ? { cat: "g1824", wall: "B", pos: 0, inc: false, shut: false, vy: 0.4 } : { cat: "g1824", wall: "L", pos: freeSpot("L", 1.6, s, fr), inc: false, shut: false, vy: 0.4 });
      add({ cat: "bench", wall: "IN", px: 0.7, pz: -1.3, ln: 6, rot: rnd() < 0.5, inc: false, shut: false });
      add({ cat: "shelf", wall: "IN", px: -1, pz: 2.25, ln: 9, rot: false, inc: false, shut: false });
      add({ cat: "light", wall: "R", pos: 1.37, vy: 1.3, inc: false, shut: false });
      if (cat.TYPES[t].porch === "S") { if (rnd() < 0.5) flipPorch(s, cat); else { s.pMid = true; resetItems(s, frameOf(s, cat), cat); } }
      if (cat === BWX) s.xopt = { ex1: 1, ex2: 3, ex3: 12, ex4: 1 };
      out.push(["with options", s]);
    }
  }
  return out;
}

function sameItems(a, b) {
  if (a.length !== b.length) return `${a.length} items came back as ${b.length}`;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    for (const f of ["cat", "wall"]) if (x[f] !== y[f]) return `item ${i}: ${f} ${x[f]} came back as ${y[f]}`;
    for (const f of ["inc", "shut", "dbl", "lite", "rot", "pk"]) if (!!x[f] !== !!y[f]) return `item ${i} (${x.cat}): ${f} changed`;
    if ((x.origCat || (x.inc ? x.cat : null)) !== (y.origCat || (y.inc ? y.cat : null))) return `item ${i} (${x.cat}): origCat ${x.origCat} came back as ${y.origCat}`;
    for (const f of ["pos", "px", "pz", "vy"]) {
      const p = x[f] || 0, q = y[f] || 0;
      if (Math.abs(p - q) > 0.002) return `item ${i} (${x.cat}): ${f} ${p} came back as ${q}`;
    }
    if ((x.ln || null) !== (y.ln || null)) return `item ${i} (${x.cat}): ln ${x.ln} came back as ${y.ln}`;
  }
  return null;
}

/* ---------------------------------------------------------------- 1 round trip */
const rnd = mulberry32(7);
let rounds = 0, zShorter = 0;
for (const [name, cat] of [["Barnwright", BW], ["demo", DEMO], ["Barnwright + extras", BWX]]) {
  for (const [kind, s] of sampleStates(cat, rnd)) {
    const label = `${name} ${s.type} ${s.size} ${kind}`;
    const design = fromState(s, cat);
    const zText = await encode(design), plain = encodeSync(design);
    if (zText[0] === "z") zShorter++;
    for (const [how, text] of [["compressed", zText], ["plain", plain]]) {
      const back = await decode(text);
      check("round trip: saved design comes back identical", J(back) === J(design), `${label} (${how}): ${J(back).slice(0, 160)} vs ${J(design).slice(0, 160)}`);
    }
    const { state: s2, warnings } = toState(await decode(zText), cat);
    check("round trip: no warnings on a good design", warnings.length === 0, `${label}: ${warnings.join(" | ")}`);
    const di = sameItems(s.items, s2.items);
    check("round trip: same items", !di, `${label}: ${di}`);
    check("round trip: same priceParts", J(priceParts(s, cat)) === J(priceParts(s2, cat)), `${label}: ${J(priceParts(s, cat))} vs ${J(priceParts(s2, cat))}`);
    const keep = ["type", "size", "body", "trim", "roof", "doorC", "shutC", "dormer", "pFlip", "pMid", "opts", "elec", "ramp", "xopt"];
    const pick = (o) => Object.fromEntries(keep.map((k) => [k, o[k]]));
    check("round trip: same colours and options", J(pick(s)) === J(pick(s2)), `${label}: ${J(pick(s))} vs ${J(pick(s2))}`);
    check("round trip: saved design is a fixed point", J(fromState(s2, cat)) === J(design), `${label}: saving the reopened design changed it`);
    rounds++;
  }
}

/* ---------------------------------------------------------------- 2 30 items */
{
  const s = defaults(DEMO); setType(s, "LB", DEMO); s.size = "14x40";
  const fr = frameOf(s, DEMO); resetItems(s, fr, DEMO);
  const walls = ["L", "R", "B", "F"], cats = ["w23", "w33", "tr", "w36", "light", "outlet"];
  let n = 0;
  while (s.items.length < 30) {
    const w = walls[n % 4], c = cats[n % cats.length];
    const it = { id: "i" + (s.seq++), cat: c, wall: w, pos: -18.123 + (n * 1.37) % 36, inc: false, shut: n % 3 === 0 && c.startsWith("w"), dbl: c === "w23" && n % 2 === 0, vy: c === "light" ? 1.234 : undefined };
    clampPos(it, s, fr); s.items.push(it); n++;
  }
  s.items.push({ id: "b", cat: "bench", wall: "IN", px: 1.234, pz: -5.678, ln: 12, rot: true, inc: false, shut: false });
  s.items.splice(29);
  s.elec = { pkg: 2, ext: true }; s.ramp = "r6"; for (const k of Object.keys(s.opts)) s.opts[k] = true;
  const design = fromState(s, DEMO, { priced: true, at: "2026-09-26" });
  s.items.push({ id: "b2", cat: "bench", wall: "IN", px: 1.234, pz: -5.678, ln: 12, rot: true, inc: false, shut: false });
  const d30 = fromState(s, DEMO, { priced: true, at: "2026-09-26" });
  const plain = encodeSync(d30), z = await encode(d30);
  check("a 30-item design's link is under 1,800 characters", d30.items.length === 30, `the test design has ${d30.items.length} items`);
  check("a 30-item design's link is under 1,800 characters", plain.length < 1800, `the plain link is ${plain.length} characters`);
  check("a 30-item design's link is under 1,800 characters", z.length < 1800, `the compressed link is ${z.length} characters`);
  counts["a 30-item design's link is under 1,800 characters"].note = `plain ${plain.length}, compressed ${z.length} characters`;
  check("a 30-item design's link is under 1,800 characters", J(await decode(z)) === J(d30) && d30.priced.total === priceParts(s, DEMO).total, "the 30-item link did not decode to the same design");
  void design;
}

/* ---------------------------------------------------------------- 3 any alphabet */
{
  const d = copy(readJSON("companies/demo/company.json"));
  const names = [["Océan Bleu", "#2E5E8C"], ["Grün", "#3E6B3A"], ["青い屋根", "#35507A"], ["Кирпич", "#8A3A2E"], ["🌲 Forest", "#2F4A3B"], ["Crème brûlée", "#EFE3C8"]];
  d.palettes = { paint: ["White"].concat(names), trim: ["Black", names[1], names[4]], metal: ["Black", names[2], names[3]] };
  d.options.extras = [{ key: "etagere", name: "Étagère — 棚", input: "check", price: 90 }];
  const cat = resolve(d, M, LIB);
  const s = defaults(cat);
  s.body = "#2E5E8C"; s.trim = "#2F4A3B"; s.roof = "#35507A"; s.doorC = "#EFE3C8"; s.shutC = "#8A3A2E"; s.xopt = { etagere: 1 };
  const design = fromState(s, cat);
  check("names in any alphabet survive", design.colors.body === "Océan Bleu" && design.colors.trim === "🌲 Forest" && design.colors.roof === "青い屋根", `names in the saved design: ${J(design.colors)}`);
  for (const text of [encodeSync(design), await encode(design)]) {
    check("names in any alphabet survive", /^[A-Za-z0-9_-]+$/.test(text), `the link has characters a URL would mangle: ${text.slice(0, 60)}`);
    const back = await decode(text);
    check("names in any alphabet survive", J(back.colors) === J(design.colors), `colour names came back as ${J(back.colors)}`);
    const { state: s2, warnings } = toState(back, cat);
    check("names in any alphabet survive", warnings.length === 0 && s2.body === s.body && s2.roof === s.roof && s2.doorC === s.doorC && s2.shutC === s.shutC && s2.xopt.etagere === 1,
      `reopened: ${J({ body: s2.body, roof: s2.roof, doorC: s2.doorC, shutC: s2.shutC, xopt: s2.xopt })} ${warnings.join(" | ")}`);
    check("names in any alphabet survive", priceParts(s2, cat).lines.some((l) => l[0] === "Étagère — 棚"), "the extra's name was lost from the quote");
  }
}

/* ---------------------------------------------------------------- 4 warnings, never silent drops */
{
  const base = fromState(defaults(DEMO), DEMO);
  const cases = [
    ["a style no longer offered", (d) => { d.type = "ZZ"; }, "ZZ"],
    ["a size no longer sold", (d) => { d.size = "99x99"; }, "99×99"],
    ["an item no longer offered", (d) => { d.items.push({ cat: "zz9", wall: "F", pos: 1 }); }, "zz9"],
    ["an item on a wall the building lacks", (d) => { d.items.push({ cat: "w23", wall: "S1", pos: 1 }); }, "\"S1\""],
    ["a colour no longer offered", (d) => { d.colors.body = "Nope Blue"; }, "Nope Blue"],
    ["a door colour no longer offered", (d) => { d.colors.door = "Plaid"; }, "Plaid"],
    ["an upgrade no longer offered", (d) => { d.opts = ["bogus"]; }, "bogus"],
    ["an extra no longer offered", (d) => { d.xopt = { nope: 1 }; }, "nope"],
    ["a swapped item whose original is gone", (d) => { d.items[0].origCat = "zz8"; }, "zz8"],
    ["another company's design", (d) => { d.company = "acme"; }, "acme"],
    ["an older price list", (d) => { d.cfg = 99; }, "changed since"],
  ];
  /* a size a person reads is written 10×16, the way the Dealer Center's
     change lines and History write it; the design keeps "10x16" */
  {
    const d = copy(base); d.size = "99x99";
    const { state, warnings } = toState(d, DEMO);
    check("a size in the words is written 99×99 and 10×20, never 99x99", warnings.includes(`The 99×99 size of the ${DEMO.TYPES[state.type].name} is no longer sold; showing the ${state.size.replace("x", "×")} instead.`) && /^\d+x\d+$/.test(state.size), J(warnings));
  }
  for (const [what, mutate, word] of cases) {
    const d = copy(base); mutate(d);
    const { state, warnings } = toState(d, DEMO);
    check("anything missing is a warning, never a silent drop", warnings.some((w) => w.indexOf(word) >= 0), `${what}: no warning naming ${word} (${J(warnings)})`);
    check("anything missing is a warning, never a silent drop", !!state && Array.isArray(state.items), `${what}: no usable state`);
  }
  const d = copy(base);
  d.items = d.items.concat([{ cat: "zz1", wall: "F", pos: 0 }, { cat: "zz2", wall: "B", pos: 0 }, { cat: "w23", wall: "P3", pos: 0 }]);
  const r = toState(d, DEMO);
  const dropped = d.items.length - r.state.items.length;
  const told = r.warnings.filter((w) => /left off/.test(w)).length;
  check("anything missing is a warning, never a silent drop", dropped === 3 && told === 3, `${dropped} items dropped, ${told} warnings about it`);
  const ren = copy(readJSON("companies/demo/company.json"));
  ren.renames = { items: { w36old: "w36" }, sizes: { "10x21": "10x20" }, colors: { "Snow": "White" } };
  const catR = resolve(ren, M, LIB);
  const dr = copy(base); dr.items.push({ cat: "w36old", wall: "B", pos: 0 }); dr.colors.body = "Snow"; dr.size = "10x21";
  const rr = toState(dr, catR);
  check("anything missing is a warning, never a silent drop", rr.warnings.length === 0 && rr.state.items.some((i) => i.cat === "w36") && rr.state.body === "#FAF9F3" && rr.state.size === "10x20",
    `renames did not map old names to new: ${J(rr.warnings)}`);
  const noItems = copy(base); delete noItems.items;
  check("anything missing is a warning, never a silent drop", toState(noItems, DEMO).state.items.length === 2, "a design with no items saved did not get the standard doors and windows");
}

/* ---------------------------------------------------------------- 5 damaged links */
for (const bad of ["", "!!!!", "eyJ2Ijox", "z" + "A".repeat(40), "e" + "Q".repeat(7), "#d=%%%"]) {
  let err = null; try { await decode(bad); } catch (e) { err = e; }
  check("a damaged link is refused in plain words", !!err && /design link/.test(err.message), `${J(bad)}: ${err ? err.message : "was accepted"}`);
}
{
  const t = encodeSync(fromState(defaults(DEMO), DEMO));
  check("a damaged link is refused in plain words", J(await decode("https://acme.example/design#d=" + t)) === J(await decode(t)), "a whole link (…#d=…) did not decode like the bare text");
  let err = null; try { decodeSync("zAAAA"); } catch (e) { err = e; }
  check("a damaged link is refused in plain words", !!err && /compressed/.test(err.message), "decodeSync did not say it cannot unpack a compressed link");
}

{
  const G5 = "a hand-edited link is read safely";
  const base5 = fromState(defaults(DEMO), DEMO);
  const b64 = (o) => Buffer.from(J(o)).toString("base64url");
  const EDITS = [
    ["a position written as text", (d) => { d.items.push({ cat: "w23", wall: "L", pos: "abc" }); }],
    ["a position written as an object", (d) => { d.items.push({ cat: "w23", wall: "L", pos: { x: 1 } }); }],
    ["a shelf's px and length as text", (d) => { d.items.push({ cat: "shelf", wall: "IN", px: "abc", pz: 0, ln: "long" }); }],
    ["a light's height as text", (d) => { d.items.push({ cat: "light", wall: "R", pos: 0, vy: "high" }); }],
    ["an item called __proto__", (d) => { d.items.push({ cat: "__proto__", wall: "L", pos: 1 }); }],
    ["an item called constructor", (d) => { d.items.push({ cat: "constructor", wall: "L", pos: 1 }); }],
    ["a style called constructor", (d) => { d.type = "constructor"; }],
    ["a style called toString", (d) => { d.type = "toString"; }],
    ["a size called constructor", (d) => { d.size = "constructor"; }],
    ["a wall called constructor", (d) => { d.items.push({ cat: "w23", wall: "constructor", pos: 1 }); }],
    ["a swap from constructor", (d) => { d.items.push({ cat: "w23", wall: "L", pos: 1, inc: true, origCat: "constructor" }); }],
    ["a colour called constructor", (d) => { d.colors.body = "constructor"; }],
  ];
  for (const cfg of [DEMO.cfg, 99]) for (const [what, edit] of EDITS) {
    const d = copy(base5); d.cfg = cfg; edit(d);
    let r = null, err = null;
    try { r = toState(await decode(encodeSync(d)), DEMO); } catch (e) { err = e; }
    const label = what + (cfg === 99 ? " (older price list: the full clamp)" : "");
    if (!check(G5, !err, `${label}: toState threw ${err && err.message}`)) continue;
    const nums = r.state.items.flatMap((i) => ["pos", "vy", "px", "pz", "ln"].filter((f) => i[f] !== undefined).map((f) => i[f]));
    check(G5, nums.every((v) => typeof v === "number" && isFinite(v)), `${label}: an item came back with a position that is not a number: ${J(r.state.items)}`);
    check(G5, isFinite(priceParts(r.state, DEMO).total), `${label}: the quote total is not a number`);
    check(G5, r.warnings.length >= (cfg === 99 ? 2 : 1), `${label}: nothing was said about it (${J(r.warnings)})`);
  }
  for (const o of [{ v: 1, t: "UT", s: "10x20", i: [null] }, { v: 1, t: "UT", s: "10x20", i: ["w23"] }, { v: 1, t: "UT", s: "10x20", i: [[]] }]) {
    let r = null, err = null;
    try { r = toState(await decode(b64(o)), DEMO); } catch (e) { err = e; }
    check(G5, !err && r.warnings.length >= 1, `${J(o)}: ${err ? "threw " + err.message : "no warning"}`);
  }
  {
    const r = toState(await decode(b64({ v: 1, t: "UT", s: "10x16" })), DEMO);
    const want = defaults(DEMO); setType(want, "UT", DEMO); want.size = "10x16"; resetItems(want, frameOf(want, DEMO), DEMO);
    check(G5, J(r.state.items) === J(want.items) && r.state.items.length > 0, `a link with no item list did not get the standard doors and windows: ${J(r.state.items)}`);
  }
  {
    const nd = copy(readJSON("companies/demo/company.json")); delete nd.options.misc.shutter; delete nd.options.misc.lite; delete nd.options.misc.ext;
    const catM = resolve(nd, M, LIB);
    const s = defaults(catM); setType(s, "UT", catM);
    s.items.push({ id: "w", cat: "w48", wall: "B", pos: 0, inc: false, shut: true, lite: true });
    s.elec = { pkg: 1, ext: true }; pkFixtures(s, frameOf(s, catM), catM);
    const pp = priceParts(s, catM);
    check(G5, isFinite(pp.total) && !pp.lines.some((l) => /Shutters|Door window|Exterior light/.test(l[0])), `shutters, a door window and the outside light were priced by a company that sells none of them: ${J(pp)}`);
  }
}

/* ---------------------------------------------------------------- 6 normalize */
{
  const ST = loadCatalogue("starter");
  const s = defaults(ST);
  s.elec = { pkg: 3, ext: true }; s.ramp = "kit"; s.opts.mbW = true; s.opts.jo12 = true; s.xopt = { "ridge-vent": 1, nope: 1 };
  s.items.push({ id: "p1", cat: "outlet", wall: "L", pos: 0, pk: true, inc: false, shut: false });
  const changed = normalize(s, frameOf(s, ST), ST);
  check("normalize switches off what is not offered", s.elec.pkg === 0 && !s.items.some((i) => i.pk), "a package the company does not sell stayed on");
  check("normalize switches off what is not offered", s.ramp === "none" && s.opts.mbW === false && s.opts.jo12 === true, "an unsold ramp or upgrade stayed on (or a sold one went off)");
  check("normalize switches off what is not offered", !("nope" in s.xopt) && s.xopt["ridge-vent"] === 1, "an unknown extra stayed, or a real one went");
  check("normalize switches off what is not offered", changed.length >= 4 && changed.every((c) => typeof c === "string" && c.length > 10), "normalize did not say what it changed");
  const nd = copy(readJSON("companies/demo/company.json")); delete nd.options.misc.shutter; delete nd.options.dormers["9"]; nd.defaults.dormer = "6";
  const catN = resolve(nd, M, LIB);
  const s2 = defaults(catN); setType(s2, "DS", catN); s2.dormer = "9"; s2.items[1].shut = true;
  normalize(s2, frameOf(s2, catN), catN);
  check("normalize switches off what is not offered", s2.dormer === "6" && !s2.items.some((i) => i.shut), `dormer ${s2.dormer}, shutters ${s2.items.some((i) => i.shut)}`);
  let porch = 0, untouched = 0;
  for (const t of Object.keys(BW.P)) for (const z of Object.keys(BW.P[t])) {
    const s3 = defaults(BW); setType(s3, t, BW); s3.size = z; resetItems(s3, frameOf(s3, BW), BW);
    const before = J(s3);
    const ch = normalize(s3, frameOf(s3, BW), BW);
    const L = +z.split("x")[1];
    if (BW.TYPES[t].porch === "S" && L < 20) { porch++; check("normalize switches off what is not offered", s3.pLen === 8 && ch.length === 1, `${t} ${z}: a short side porch was not made 4x8`); }
    else { untouched++; check("normalize switches off what is not offered", J(s3) === before && ch.length === 0, `${t} ${z}: normalize changed a Barnwright design`); }
  }
  /* no Barnwright side cabin is under 20 ft, so sell one that is */
  const sp = copy(readJSON("companies/demo/company.json")); sp.offer.SC.sizes = Object.assign({ "10x16": 7000 }, sp.offer.SC.sizes);
  const catS = resolve(sp, M, LIB);
  const s4 = defaults(catS); setType(s4, "SC", catS); s4.size = "10x16"; s4.pLen = 12; resetItems(s4, frameOf(s4, catS), catS);
  const ch4 = normalize(s4, frameOf(s4, catS), catS);
  if (check("normalize switches off what is not offered", s4.pLen === 8 && ch4.some((c) => c === "The side porch is 4 ft × 8 ft on a building under 20 ft long."), `a 10x16 side cabin kept a ${s4.pLen} ft porch: ${J(ch4)}`)) porch++;
  const s5 = defaults(catS); setType(s5, "SC", catS); s5.size = "10x20"; s5.pLen = 12;
  check("normalize switches off what is not offered", normalize(s5, frameOf(s5, catS), catS).length === 0 && s5.pLen === 12, "a 20 ft side cabin lost its 12 ft porch");
  counts["normalize switches off what is not offered"].note = `${untouched} Barnwright designs untouched, ${porch} short side porch made 4x8`;
}

/* ---------------------------------------------------------------- 7 order and start */
{
  const G = golden();
  check("toState order, the starting design, fixtures kept", J(defaults(BW)) === J(G.defaultState), "the design a new visitor starts on is not Barnwright's");
  const d = fromState(defaults(BW), BW); delete d.items; d.type = "CS"; d.size = "12x16";
  const { state } = toState(d, BW);
  const want = defaults(BW); setType(want, "CS", BW); want.size = "12x16"; resetItems(want, frameOf(want, BW), BW);
  check("toState order, the starting design, fixtures kept", J(state.items) === J(want.items) && state.items[0].cat === "w72",
    `a saved 12x16 cottage was laid out for another size: ${J(state.items.map((i) => [i.cat, i.pos]))}`);
  const s = defaults(DEMO); s.elec = { pkg: 2, ext: false }; pkFixtures(s, frameOf(s, DEMO), DEMO);
  setType(s, "UT", DEMO);
  check("toState order, the starting design, fixtures kept", s.items.filter((i) => i.pk).length === 5, `after a style change the package has ${s.items.filter((i) => i.pk).length} fixtures, not 5`);
}

/* ---------------------------------------------------------------- 8 side porch lengths */
{
  const G8 = "side porch lengths (How it's built)";
  const mk = (lengths) => { const c = copy(readJSON("companies/demo/company.json")); c.offer.SC.built = { sidePorchLengths: lengths }; return resolve(c, M, LIB); };
  const c1014 = mk([10, 14]);
  const s = defaults(c1014); setType(s, "SC", c1014); s.size = "12x24"; s.pLen = 10; resetItems(s, frameOf(s, c1014), c1014);
  const link = encodeSync(fromState(s, c1014));
  const back = toState(decodeSync(link), c1014);
  check(G8, back.state.pLen === 10 && frameOf(back.state, c1014).span.P === 10 && back.warnings.length === 0, `a 10 ft porch came back as ${back.state.pLen}: ${J(back.warnings)}`);
  /* an old link: 12 ft, the porch lengths now 10 and 14 */
  const s12 = defaults(DEMO); setType(s12, "SC", DEMO); s12.size = "12x24"; s12.pLen = 12; resetItems(s12, frameOf(s12, DEMO), DEMO);
  const old = fromState(s12, DEMO); old.cfg = c1014.cfg;
  const r = toState(old, c1014);
  check(G8, r.state.pLen === 14 && frameOf(r.state, c1014).span.P === 14 && r.warnings.length === 1 && /^The side porch is now 4 ft × 14 ft; its windows were set back to the standard ones\.$/.test(r.warnings[0]),
    `an old 12 ft link on a 10/14 style: ${r.state.pLen}, ${J(r.warnings)}`);
  /* the porch-snap case: a 12x24 Side Cabin saved at 12 ft, the porch now 8 ft only */
  const c8 = mk([8]);
  const fixed = fromState(s12, DEMO); fixed.cfg = c8.cfg; fixed.company = c8.id;
  const re = toState(fixed, c8);
  check(G8, re.state.pLen === 8 && re.warnings.length === 1 && /4 ft × 8 ft/.test(re.warnings[0]), `reopened: ${re.state.pLen} ${J(re.warnings)}`);
  const resaved = fromState(re.state, c8);
  let priced = null, err = null;
  try { priced = priceDesign(resaved, c8); } catch (e) { err = e; }
  check(G8, priced && priced.design.porch.pLen === 8 && priced.price.total === priceParts(re.state, c8).total, `the re-saved design could not be priced: ${err && err.message}`);
  let staleErr = null;
  try { priceDesign(fixed, c8); } catch (e) { staleErr = e; }
  check(G8, staleErr && staleErr.status === 409 && /no longer offered/.test(staleErr.message), `the stale design got ${staleErr ? staleErr.status + " " + staleErr.message : "a price"}`);
  /* the server takes any whole length from 4 to 20 ft and nothing else */
  const odd = copy(resaved); odd.porch.pLen = 21;
  let oddErr = null; try { priceDesign(odd, c8); } catch (e) { oddErr = e; }
  check(G8, oddErr && oddErr.status === 422, "a 21 ft porch was read");
}

/* ---------------------------------------------------------------- 9 gable windows that do not fit */
{
  /* BUILDFAST-SPEC E.4: a gable window whose glass would poke through the
     roof even at its lowest, under the peak, is not offered on a gable end;
     the server refuses a new one; a saved design holding one opens with it
     taken off and one plain line. A 12 ft Utility Shed at 5/12 (the shop's
     pitch). */
  const G9 = "gable windows that do not fit are not offered";
  const fiveTwelve = barnwrightCatalogue((c) => { c.offer.UT.built = { roofPitch: 5 }; });
  const st = (cat, size) => { const s = defaults(cat); setType(s, "UT", cat); s.size = size; resetItems(s, frameOf(s, cat), cat); return s; };
  const s12 = st(fiveTwelve, "12x16"), fr12 = frameOf(s12, fiveTwelve);
  const fits = (cat, size, id) => typeof LAYOUT.gableItemFits === "function" && LAYOUT.gableItemFits(cat.CAT[id], frameOf(st(cat, size), cat));
  check(G9, !fits(fiveTwelve, "12x16", "g1824") && fits(fiveTwelve, "12x16", "oct"), "on a 12 ft Utility Shed at 5/12 the 18x24 should not fit and the octagon should");
  check(G9, fits(BW, "12x16", "g1824") && !fits(BW, "8x12", "g1824") && !fits(BW, "10x16", "g1824"), "at Barnwright's pitch the 18x24 fits a 12 ft Utility Shed and not an 8 or 10 ft one");
  check(G9, fits(fiveTwelve, "12x16", "faux") || !fiveTwelve.CAT.faux, "a faux loft window (no glass) always fits");
  /* the designer: not offered on a gable end, fine high on a side wall */
  const sA = st(fiveTwelve, "12x16");
  check(G9, S.addItem(sA, "g1824", fiveTwelve, 0) == null && !sA.items.some((i) => i.cat === "g1824"), "the 18x24 was added to the front gable of a 12 ft Utility Shed at 5/12");
  const sB = st(fiveTwelve, "12x16"); const oct = S.addItem(sB, "oct", fiveTwelve, 0);
  S.setItemType(sB, oct.id, "g1824", fiveTwelve);
  check(G9, oct.cat === "oct", "an octagon on the gable was changed into the 18x24 that does not fit");
  const sC = st(fiveTwelve, "12x16"); const w = S.addItem(sC, "w23", fiveTwelve, -Math.PI / 2);   /* a window on the left side */
  S.setItemType(sC, w.id, "g1824", fiveTwelve);
  check(G9, w.cat === "g1824" && (w.wall === "L" || w.wall === "R"), "high on a side wall the 18x24 should still be offered");
  check(G9, S.setItemWall(sC, w.id, "F", fiveTwelve) === null && w.wall !== "F", "the 18x24 was moved from a side wall onto the gable it is too tall for");
  /* the server: a new one is refused with today's words; the same on a side wall is priced */
  const onGable = st(fiveTwelve, "12x16"); onGable.items.push({ id: "g9", cat: "g1824", wall: "F", pos: 0, vy: 0, inc: false, shut: false });
  let err9 = null; try { priceDesign(fromState(onGable, fiveTwelve), fiveTwelve); } catch (e) { err9 = e; }
  check(G9, err9 && err9.status === 409 && /no longer offered/.test(err9.message), `the server took an 18x24 on a 5/12 gable: ${err9 ? err9.status + " " + err9.message : "priced"}`);
  let ok9 = null; try { ok9 = priceDesign(fromState(sC, fiveTwelve), fiveTwelve); } catch (e) { ok9 = e; }
  check(G9, ok9 && ok9.price && ok9.price.total > 0, `the 18x24 high on a side wall was refused: ${ok9 && ok9.message}`);
  /* A DESIGN SAVED WHEN IT FITTED (Barnwright's 6 1/2/12, before the shop's
     5/12; review GL-2, F2): the designer and the server must agree. It
     opens with the window taken off and one plain line; the design the
     designer sends next is priced; only the stale design is refused, with
     the refresh words (a refresh opens it again, without the window). */
  const sOld = st(BW, "12x16"); const gOld = S.addItem(sOld, "g1824", BW, 0);
  check(G9, gOld && gOld.wall === "F", "at Barnwright's pitch the 18x24 should go on the front gable of a 12 ft Utility Shed");
  const saved = fromState(sOld, BW);
  const back = toState(saved, fiveTwelve);
  check(G9, !back.state.items.some((i) => i.cat === "g1824" && (i.wall === "F" || i.wall === "B")) && back.warnings.includes(`The ${fiveTwelve.CAT.g1824.n} is too tall for this gable, so it was taken off.`),
    `the saved design kept the window, or said nothing: ${J(back.warnings)}`);
  let sent = null; try { sent = priceDesign(fromState(back.state, fiveTwelve), fiveTwelve); } catch (e) { sent = e; }
  check(G9, sent && sent.price && sent.price.total > 0, `the design the designer sends after opening it was refused: ${sent && (sent.status + " " + sent.message)}`);
  let stale = null; try { priceDesign(saved, fiveTwelve); } catch (e) { stale = e; }
  check(G9, stale && stale.status === 409 && /Refresh the page/.test(stale.message), `the stale design (still holding the window) was not asked to refresh: ${stale ? stale.status + " " + stale.message : "priced"}`);
  /* the same when the Steep roof that made it fit is taken off again */
  const steepCat = barnwrightCatalogue((c) => { c.offer.UT.built = { roofPitch: 5 }; c.options.extras = [{ key: "steep", name: "Steep roof", input: "check", price: 350, styles: ["UT"], built: { roofPitch: 7 } }]; });
  const sS = st(steepCat, "12x16"); sS.xopt = { steep: 1 };
  const gS = S.addItem(sS, "g1824", steepCat, 0);
  check(G9, gS && gS.wall === "F", "with the Steep roof on, the 18x24 should go on the gable of a 12 ft Utility Shed");
  let withSteep = null; try { withSteep = priceDesign(fromState(sS, steepCat), steepCat); } catch (e) { withSteep = e; }
  check(G9, withSteep && withSteep.price, `the 18x24 under the Steep roof was refused: ${withSteep && withSteep.message}`);
  S.setExtra(sS, steepCat.OPTX.extras[0]);
  const said = normalize(sS, null, steepCat);
  check(G9, !sS.xopt.steep && !sS.items.some((i) => i.cat === "g1824") && said.includes(`The ${steepCat.CAT.g1824.n} is too tall for this gable, so it was taken off.`), `with the Steep roof off the window stayed, or nothing was said: ${J(said)}`);
  let noSteep = null; try { noSteep = priceDesign(fromState(sS, steepCat), steepCat); } catch (e) { noSteep = e; }
  check(G9, noSteep && noSteep.price, `the design without the Steep roof was refused: ${noSteep && (noSteep.status + " " + noSteep.message)}`);
  /* a gable window that still fits is kept, with nothing said */
  const sK = st(fiveTwelve, "12x16"); S.addItem(sK, "oct", fiveTwelve, 0);
  const kept = toState(fromState(sK, fiveTwelve), fiveTwelve);
  check(G9, kept.warnings.length === 0 && kept.state.items.some((i) => i.cat === "oct" && i.wall === "F"), `an octagon that fits came off: ${J(kept.warnings)}`);
}

/* ---------------------------------------------------------------- 10 an option on some buildings only */
{
  /* Alan's steep roof (7/12, utility-framing skill). No sample price list
     has it (Alan, Oct 11 2026: take it out); an owner makes one of their
     own, "Steep roof" at 7/12 on the Utility Shed and Side Utility only
     (options.extras[].styles). It is offered there and nowhere else, comes
     off when the building changes to one it is not on, and the server
     refuses it on another building. */
  const G10 = "an option offered on some buildings only (an owner's own Steep roof)";
  check(G10, !(DEMO.OPTX.extras || []).some((x) => x.key === "steep-roof" || x.built), `the sample price list still has an option that changes the roof: ${J(DEMO.OPTX.extras)}`);
  const ownSteep = { key: "steep-roof", name: "Steep roof", input: "check", price: 350, built: { roofPitch: 7 }, styles: ["UT", "SU"] };
  const withSteep = copy(readJSON("companies/demo/company.json")); withSteep.options.extras.push(copy(ownSteep));
  const OWN = resolve(withSteep, M, LIB);
  const steep = (OWN.OPTX.extras || []).find((x) => x.key === "steep-roof");
  check(G10, !!steep && J(steep.styles) === J(["UT", "SU"]), `the owner's Steep roof is not on the Utility Shed and Side Utility: ${J(steep)}`);
  const st = (t, z) => { const s = defaults(OWN); setType(s, t, OWN); s.size = z; resetItems(s, frameOf(s, OWN), OWN); return s; };
  const ut = st("UT", "10x16"), lb = st("LB", "10x16");
  check(G10, optxList(OWN, ut).some((x) => x.key === "steep-roof") && optxList(OWN, st("SU", "10x16")).some((x) => x.key === "steep-roof"), "the Steep roof is not offered on the Utility Shed and Side Utility");
  check(G10, !optxList(OWN, lb).some((x) => x.key === "steep-roof") && !optxList(OWN, st("G", "12x24")).some((x) => x.key === "steep-roof"), "the Steep roof is offered on the Lofted Barn or the Garage");
  ut.xopt = { "steep-roof": 1 };
  const fr = frameOf(ut, OWN), peak = (Math.max(...fr.prof.map((p) => p[1])) - fr.topY) * 12;
  const parts = priceParts(ut, OWN);
  check(G10, Math.abs(peak - 35) < 1e-9 && parts.lines.some((l) => /Steep roof/.test(l[0] || l.label || l.name || "") || J(l).includes("Steep roof")) && parts.total === priceParts(st("UT", "10x16"), OWN).total + 350,
    `picked on a 10x16 Utility Shed: roof ${peak} in above the wall (7/12 is 35 in), total ${parts.total}`);
  /* the building changes to a Lofted Barn: it comes off, said once */
  const moved = JSON.parse(JSON.stringify(ut)); setType(moved, "LB", OWN);
  const said = normalize(moved, frameOf(moved, OWN), OWN);
  check(G10, !moved.xopt["steep-roof"] && said.includes("Steep roof is not offered on the Lofted Barn, so it was taken off."), `after changing to a Lofted Barn: ${J(moved.xopt)} ${J(said)}`);
  /* the server: priced on the Utility Shed, refused on the Lofted Barn */
  let ok10 = null; try { ok10 = priceDesign(fromState(ut, OWN), OWN); } catch (e) { ok10 = e; }
  check(G10, ok10 && ok10.price && ok10.price.total === parts.total, `the server would not price the Steep roof on a Utility Shed: ${ok10 && ok10.message}`);
  const onBarn = fromState(lb, OWN); onBarn.xopt = { "steep-roof": 1 };
  let err10 = null; try { priceDesign(onBarn, OWN); } catch (e) { err10 = e; }
  check(G10, err10 && err10.status === 409 && /no longer offered/.test(err10.message), `the server took a Steep roof on a Lofted Barn: ${err10 ? err10.status + " " + err10.message : "priced"}`);
  /* a style of the business's own built like the Utility Shed gets it too */
  const own = copy(withSteep);
  own.offer.UTX1 = { base: "UT", name: "Premium Utility", sizes: { "10x16": 6000 } }; own.categories[0][1].push("UTX1");
  const catOwn = resolve(own, M, LIB);
  const sOwn = defaults(catOwn); setType(sOwn, "UTX1", catOwn);
  check(G10, optxList(catOwn, sOwn).some((x) => x.key === "steep-roof"), "a Premium Utility built like the Utility Shed did not get the Steep roof");
  /* a code that is no building style is named */
  const typo = copy(readJSON("companies/demo/company.json"));
  typo.options.extras = [{ key: "steep-roof", name: "Steep roof (7/12)", input: "check", price: 350, built: { roofPitch: 7 }, styles: ["UT", "SUU"] }];
  const errs = validate(typo, M);
  check(G10, errs.some((e) => /^options\.extras\[0\]\.styles lists "SUU", which is not a building style\. Did you mean SU\?/.test(e)), J(errs));
}

/* ---------------------------------------------------------------- 11 the shop standard's own door at some sizes */
{
  /* The 8x12 and 10x12 Side Utility come with the 48 in Wooden Door (Alan,
     Oct 11 2026: "replace 6 foot to 4 foot"), and so do the 8x12 and 10x12
     Dormer Shed and Side Lofted Barn (Oct 12 2026, "yes"); their other
     sizes, and each of them before, with the 72 in Wooden Double Doors.
     A design can hold the other door of that pair as the one it came with:
     - saved before the change: the doubles the customer never swapped
       become the 48 in door, in their place, at the price the customer
       saw, said in one line; a door the customer swapped them for is kept
       in the 48 in door's place (priced as that swap) and said;
     - the size changed after the customer touched the doors and windows
       (the size chip keeps them, DIFFERENCES #12): the door follows the
       new size's, with nothing said -- 10x16 made 10x12 is the 48 in door
       at the 10x12's price plus the extras, and back is the doubles.
     The server prices the design the designer sends next; only the stale
     design itself is "no longer offered" (409). Nothing else changes: the
     Cottage (its own door changes with size on Barnwright's recipe) and
     Barnwright's own Side Utility, Dormer Shed and Side Lofted Barn keep
     their doors exactly as Barnwright does, at Barnwright's price. */
  const G11 = "the shop standard's own door at some sizes";
  /* the demo price list on the library without its door swaps: the
     buildings had the double doors at every size */
  const DEMO_DOUBLES = (() => {
    const demo = readJSON("companies/demo/company.json"), m = JSON.parse(JSON.stringify(readManufacturer(demo.manufacturer)));
    for (const k of Object.keys(m.styles)) if (m.styles[k].built) delete m.styles[k].built.standardSwaps;
    return resolve(demo, m, readJSON("library/construction.json"));
  })();
  const st = (cat, t, z) => { const s = defaults(cat); setType(s, t, cat); s.size = z; resetItems(s, frameOf(s, cat), cat); return s; };
  const send = (design, cat) => { try { return priceDesign(design, cat); } catch (e) { return e; } };
  const doors = (s, cat) => s.items.filter((i) => ["door", "ru"].includes((cat || DEMO).CAT[i.cat].k)).map((i) => [i.cat, i.origCat, !!i.inc]);
  const extras = (s, cat) => priceParts(s, cat).total - cat.P[s.type][s.size];
  /* a Side Utility, Dormer Shed or Side Lofted Barn 8x12 or 10x12 saved
     with the double doors, untouched, and one whose customer swapped them
     for the 36 in steel door (the Dormer Shed opens with its dormer, so its
     price is more than the size's) */
  const STYLES48 = [["SU", "Side Utility"], ["DS", "Dormer Shed"], ["SLB", "Side Lofted Barn"]];
  const up = Math.max(0, DEMO.CAT.d36in.p - DEMO.CAT.w48.p);
  const times = (z) => z.replace("x", "×");
  for (const [k, name] of STYLES48) for (const z of ["8x12", "10x12"]) {
    const old = st(DEMO, k, z); old.items[0].cat = old.items[0].origCat = "w72";
    const savedPrice = priceParts(old, DEMO).total;
    const saved = fromState(old, DEMO);
    const back = toState(saved, DEMO);
    const said = `The ${times(z)} ${name} comes with the 48″ Wooden Door, so it takes the place of the 72″ Wooden Double Doors.`;
    const oldSw = st(DEMO, k, z); oldSw.items[0].cat = "d36in"; oldSw.items[0].origCat = "w72";
    const backSw = toState(fromState(oldSw, DEMO), DEMO);
    check(G11, J(doors(back.state)) === J([["w48", "w48", true]]) && back.state.items[0].wall === old.items[0].wall && Math.abs(back.state.items[0].pos - old.items[0].pos) < 1e-3
      && back.warnings.includes(said) && priceParts(back.state, DEMO).total === savedPrice && (k !== "SU" || savedPrice === DEMO.P.SU[z])
      && J(doors(backSw.state)) === J([["d36in", "w48", true]]) && backSw.warnings.includes(`The ${times(z)} ${name} comes with the 48″ Wooden Door, so the 36″ In-Swing Door is kept in its place as an upgrade.`)
      && priceParts(backSw.state, DEMO).total === savedPrice + up,
      `a saved ${name} ${z} with the doubles reopened: ${J(doors(back.state))} ${J(back.warnings)} ${priceParts(back.state, DEMO).total} (saved at ${savedPrice}); swapped for the steel door: ${J(doors(backSw.state))} ${J(backSw.warnings)} ${priceParts(backSw.state, DEMO).total}`);
    const next = send(fromState(back.state, DEMO), DEMO), nextSw = send(fromState(backSw.state, DEMO), DEMO);
    check(G11, next && next.price && next.price.total === savedPrice && nextSw && nextSw.price && nextSw.price.total === priceParts(backSw.state, DEMO).total,
      `${name} ${z}: the designs the designer sends after opening them: ${next && (next.status + " " + next.message)} / ${nextSw && (nextSw.status + " " + nextSw.message)}`);
    const stale = send(saved, DEMO);
    check(G11, stale && stale.status === 409 && /no longer offered/.test(stale.message), `${name} ${z}: the stale design itself: ${stale ? stale.status + " " + stale.message : "priced"}`);
  }
  /* the customer touches a window on a 10x16, then picks 10x12, and the
     other way: the door follows the size's, nothing is said, the price is
     the building's at that size plus the shutters (the Dormer Shed's
     dormer too), and the server agrees */
  const withShutter = (k, z) => { const f = st(DEMO, k, z); f.items[1].shut = true; return priceParts(f, DEMO).total; };
  for (const [k, name] of STYLES48) {
    const s = st(DEMO, k, "10x16"); s.items[1].shut = true;
    const shut16 = extras(s, DEMO);
    S.chooseSize(s, "10x12", DEMO);
    const said12 = normalize(s, null, DEMO);
    check(G11, J(doors(s)) === J([["w48", "w48", true]]) && said12.length === 0 && priceParts(s, DEMO).total === withShutter(k, "10x12") && shut16 > 0 && (k !== "SU" || priceParts(s, DEMO).total === DEMO.P.SU["10x12"] + shut16),
      `${name} 10x16 touched, then 10x12: ${J(doors(s))} ${J(said12)} ${J(priceParts(s, DEMO))}`);
    const sent12 = send(fromState(s, DEMO), DEMO);
    check(G11, sent12 && sent12.price && sent12.price.total === withShutter(k, "10x12"), `${name} sent at 10x12: ${sent12 && (sent12.status + " " + sent12.message)}`);
    const s2 = st(DEMO, k, "10x12"); s2.items[1].shut = true;
    S.chooseSize(s2, "10x16", DEMO);
    const said16 = normalize(s2, null, DEMO);
    check(G11, J(doors(s2)) === J([["w72", "w72", true]]) && said16.length === 0 && priceParts(s2, DEMO).total === withShutter(k, "10x16"),
      `${name} 10x12 touched, then 10x16: ${J(doors(s2))} ${J(said16)} ${J(priceParts(s2, DEMO))}`);
    const sent16 = send(fromState(s2, DEMO), DEMO);
    check(G11, sent16 && sent16.price && sent16.price.total === withShutter(k, "10x16"), `${name} sent at 10x16: ${sent16 && (sent16.status + " " + sent16.message)}`);
    /* a door the customer swapped the doubles for stays theirs when the size changes */
    const s3 = st(DEMO, k, "10x16"); S.setItemType(s3, s3.items[0].id, "d36in", DEMO);
    S.chooseSize(s3, "10x12", DEMO);
    const said3 = normalize(s3, null, DEMO);
    const sent3 = send(fromState(s3, DEMO), DEMO);
    check(G11, J(doors(s3)) === J([["d36in", "w48", true]]) && said3.length === 0 && sent3 && sent3.price && sent3.price.total === priceParts(st(DEMO, k, "10x12"), DEMO).total + up,
      `${name}: a steel door in place of the doubles, 10x16 then 10x12: ${J(doors(s3))} ${J(said3)} ${sent3 && (sent3.status + " " + sent3.message)}`);
  }
  /* the double doors come back wider than the 48 in door they take the
     place of: the wall is settled again with them, the way the size change
     settles it, so no window runs into them (review DOORS-1: they ran 3 in
     into the right window), and every door and window stands where
     Barnwright's setSize puts it when the building had the double doors all
     along */
  const overlaps = (s, cat) => checkBuilding(makePlan(s, cat || DEMO), { framing: false, gableItems: false }).problems.filter((f) => f.code === "overlap").map((f) => f.words);
  const at = (s) => s.items.filter((i) => !i.pk).map((i) => [i.cat, i.wall, Math.round(i.pos * 1000) / 1000]);
  let settled = 0;
  for (const [k, name] of STYLES48) {
    for (const path of [["10x12", "10x14"], ["10x12", "10x16"], ["8x12", "8x16"], ["10x14", "10x12", "10x14"], ["10x12", "10x14", "10x12"], ["8x12", "10x12", "10x16"]]) {
      if (!path.every((z) => DEMO.P[k][z])) continue;
      const s = st(DEMO, k, path[0]); s.items[1].shut = true;
      for (const z of path.slice(1)) S.chooseSize(s, z, DEMO);
      /* the same customer on a price list whose building had the double doors at every size */
      const was = st(DEMO_DOUBLES, k, path[0]); was.items[1].shut = true;
      for (const z of path.slice(1)) S.chooseSize(was, z, DEMO_DOUBLES);
      const last = path[path.length - 1], o = overlaps(s);
      const doubles = !["8x12", "10x12"].includes(last);
      check(G11, o.length === 0 && doors(s)[0][0] === (doubles ? "w72" : "w48") && (!doubles || J(at(s)) === J(at(was))),
        `${name} ${path.join(" -> ")} with shutters on a window: ${J(o)} ${J(at(s))}${doubles ? " (with the double doors all along: " + J(at(was)) + ")" : ""}`);
      settled++;
    }
  }
  counts[G11].note = `${settled} size changes after a window was changed, no door or window running into another`;
  /* a price list that sells the style only at 8x12 and 10x12, with the 48 in
     door and without the double doors (the Dealer Center lets the owner stop
     selling them there): a design saved with the double doors opens with the
     48 in door in their place, never with no door at all, and one whose
     customer swapped them keeps that door, priced from the 48 in door
     (review DOORS-5); the server prices what the designer sends */
  for (const [k, name] of STYLES48) {
    const only = readJSON("companies/demo/company.json");
    only.offer = { [k]: { sizes: { "8x12": 3780, "10x12": 4500 } } }; only.categories = [["Utility & Storage", [k]]];
    only.defaults = { style: k, size: "8x12", colors: only.defaults.colors }; delete only.items.w72;
    const ONLY = resolve(only, readManufacturer(only.manufacturer), readJSON("library/construction.json"));
    for (const z of ["8x12", "10x12"]) {
      const old = st(DEMO_DOUBLES, k, z);
      const back = toState(fromState(old, DEMO_DOUBLES), ONLY);
      const oldSw = st(DEMO_DOUBLES, k, z); oldSw.items[0].cat = "d36in"; oldSw.items[0].origCat = "w72";
      const backSw = toState(fromState(oldSw, DEMO_DOUBLES), ONLY);
      const said = `The ${times(z)} ${name} comes with the 48″ Wooden Door, so it takes the place of the 72″ Wooden Double Doors.`;
      const sent = send(fromState(back.state, ONLY), ONLY), sentSw = send(fromState(backSw.state, ONLY), ONLY);
      check(G11, J(doors(back.state, ONLY)) === J([["w48", "w48", true]]) && back.state.items[0].wall === old.items[0].wall && Math.abs(back.state.items[0].pos - old.items[0].pos) < 1e-3
        && back.warnings.includes(said) && !back.warnings.some((w) => /no longer offers/.test(w))
        && J(doors(backSw.state, ONLY)) === J([["d36in", "w48", true]]) && !backSw.warnings.some((w) => /no longer offers/.test(w))
        && sent && sent.price && sent.price.total === priceParts(back.state, ONLY).total && sentSw && sentSw.price && sentSw.price.total === priceParts(backSw.state, ONLY).total,
        `${name} ${z} saved with the double doors, opened on a price list that no longer sells them: ${J(doors(back.state, ONLY))} ${J(back.warnings)}; swapped for the steel door: ${J(doors(backSw.state, ONLY))} ${J(backSw.warnings)}; server ${sent && (sent.status + " " + sent.message)} / ${sentSw && (sentSw.status + " " + sentSw.message)}`);
    }
  }
  /* the Cottage, and Barnwright's own Side Utility, Dormer Shed and Side Lofted Barn: as Barnwright, door kept, nothing said, no upgrade */
  for (const cat of [DEMO, BW]) {
    for (const [a, b] of [["10x16", "10x12"], ["10x12", "10x16"]]) {
      const c = st(cat, "CS", a); c.items[1].shut = true;
      const was = doors(c, cat), plus = extras(c, cat);
      S.chooseSize(c, b, cat);
      const w = normalize(c, null, cat);
      check(G11, J(doors(c, cat)) === J(was) && w.length === 0 && priceParts(c, cat).total === cat.P.CS[b] + plus,
        `${cat.id} Cottage ${a} touched, then ${b}: ${J(doors(c, cat))} (was ${J(was)}) ${J(w)} ${priceParts(c, cat).total} (Barnwright: ${cat.P.CS[b] + plus})`);
    }
  }
  for (const [k, name] of STYLES48) for (const z of ["8x12", "10x12"]) {
    const bw = st(BW, k, z);
    const bwBack = toState(fromState(bw, BW), BW);
    check(G11, J(doors(bwBack.state, BW)) === J([["w72", "w72", true]]) && bwBack.warnings.length === 0, `Barnwright's own ${z} ${name}: ${J(doors(bwBack.state, BW))} ${J(bwBack.warnings)}`);
  }
  /* a swap the customer made on today's 8x12 is left alone */
  const sw = st(DEMO, "SU", "8x12"); S.setItemType(sw, sw.items[0].id, "w72", DEMO);
  const swBack = toState(fromState(sw, DEMO), DEMO);
  check(G11, swBack.warnings.length === 0 && J(doors(swBack.state)) === J([["w72", "w48", true]]), `a swap the customer made: ${J(swBack.warnings)}`);
}

/* ---------------------------------------------------------------- report */
let total = 0, bad = 0;
console.log("Saved and shared designs:");
for (const [g, c] of Object.entries(counts)) {
  total += c.pass + c.fail; bad += c.fail;
  console.log(`  ${c.fail ? "FAIL" : "ok  "} ${g}: ${c.pass} passed${c.fail ? `, ${c.fail} failed` : ""}${c.note ? " (" + c.note + ")" : ""}`);
}
if (failures.length) { console.log("\nProblems:"); for (const f of failures.slice(0, 40)) console.log("  " + f); }
console.log(`\n${total - bad} of ${total} checks passed (${rounds} designs round-tripped; the compressed link was the shorter for ${zShorter}).`);
if (bad) process.exit(1);
console.log("Proved: a design saved, shared as a link and opened again is the same building at the same price; nothing that has gone missing is dropped without saying so.");
