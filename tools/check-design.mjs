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
   7. toState lays a saved building out at ITS size (size, then style, then
      size), a new visitor starts exactly where Barnwright's page starts, and a
      style change keeps the electrical package's fixtures. */

import { barnwrightCatalogue, barnwrightCompany, golden } from "./lib/barnwright-company.mjs";
import { readJSON, readManufacturer, loadCatalogue } from "./lib/load.mjs";
import { resolve } from "../model/company.js";
import { frameOf } from "../model/frame.js";
import { resetItems, pkFixtures, clampPos, freeSpot } from "../model/layout.js";
import { priceParts } from "../model/pricing.js";
import { defaults, fromState, toState, normalize, encode, encodeSync, decode, decodeSync, setType, flipPorch } from "../model/design.js";
import { mulberry32 } from "../engine/seeded.js";

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
const bx = barnwrightCompany(); bx.options.extras = EXTRAS;
const BWX = resolve(bx, M, LIB);

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
      add({ cat: "g1824", wall: "B", pos: 0, inc: false, shut: false, vy: 0.4 });
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
    ["a size no longer sold", (d) => { d.size = "99x99"; }, "99x99"],
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
  if (check("normalize switches off what is not offered", s4.pLen === 8 && ch4.some((c) => /4 x 8/.test(c)), `a 10x16 side cabin kept a ${s4.pLen} ft porch`)) porch++;
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
