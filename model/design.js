/* THE DESIGN: the live one on screen, the saved one, and the share link.
   Node-safe, no I/O.

   Two shapes of the same building:
   - state: the live, Barnwright-shaped object the screen changes (hex colours,
     items with ids, sel, seq, porch fields...). Only model/layout.js, this file
     and the UI change it.
   - design: what is saved and shared. Colours by NAME, items with Barnwright's
     field names and their defaults left out, no ids, no selection:
       { v: 1, company, cfg, type, size,
         colors: {body, trim, roof, door, shutters},     ("" = match siding / trim)
         items: [{cat, wall, pos, vy, px, pz, rot, ln, inc, pk, dbl, shut, lite, origCat}],
         dormer, porch: {pLen, pFlip, pMid}, opts: ["jo12", ...], elec: {pkg, ext},
         ramp, xopt: {key: n}, priced?: {total, at} }

   defaults(cat)             the design a new visitor starts on, laid out
   setType / setSize / flipPorch   the three building chips, as in Barnwright
                             (one deliberate difference: an electrical
                             package's fixtures are laid AFTER the new style's
                             standard doors, so they survive a style change)
   toState(design, cat)      -> {state, warnings}. Applies size, then style,
                             then size, like Barnwright's applyDesign, and
                             restores colours by name. Anything that no longer
                             exists (a size no longer sold, an item or colour
                             dropped or renamed) is REPORTED in warnings in
                             plain words -- never silently dropped. Reopened on
                             the same price list (company and cfg) at the same
                             style and size, every item stays exactly where it
                             was saved (only kept on its wall); otherwise every
                             item is re-clamped in order, as Barnwright does.
   fromState(state, cat)     -> design (its inverse)
   normalize(state, frame, cat)  Barnwright's render-time rules, so pricing never
                             depends on whether the screen was drawn: a side
                             porch is 4x8 under 20 ft, and anything the company
                             does not offer (a package, ramp, upgrade, extra,
                             dormer size, shutters, door window) is switched off.
   encode(design) / decode(text)   the share link: short keys, defaults left
                             out, items as tuples, UTF-8, optional deflate-raw
                             (a "z" in front), base64url. encodeSync / decodeSync
                             do the same without compression. */

import { frameOf } from "./frame.js";
import { resetItems, clampPos, keepOnWall, pkFixtures } from "./layout.js";
import { pPrice, pSizes, priceParts } from "./pricing.js";
import { colorName, hexOfName, pickByName, sidingPalette } from "./company.js";

/* own keys only: a link naming "constructor" or "__proto__" is not a style,
   an item, a wall or a size */
function has(o, k) { return o != null && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k); }
function isNum(v) { return typeof v === "number" && isFinite(v); }

function round(v, places) {
  if (typeof v !== "number" || !isFinite(v)) return v;
  const f = Math.pow(10, places);
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;          /* never -0 */
}

/* ------------------------------------------------------------------------ */

export function defaults(cat) {
  const D = cat.defaults;
  const state = {
    type: D.type, size: D.size, body: D.body, trim: D.trim, roof: D.roof,
    items: [], dormer: D.dormer, pLen: D.pLen, pFlip: false, pMid: false, doorC: "", shutC: "", sel: null, seq: 0,
    opts: {}, xopt: {}, elec: { pkg: 0, ext: false }, ramp: "none",
  };
  for (const k of Object.keys(cat.RATES || {})) state.opts[k] = false;
  resetItems(state, frameOf(state, cat), cat);
  return state;
}

/* Barnwright's setType, with the fixtures laid after the standard items. */
export function setType(state, t, cat) {
  if (!has(cat.TYPES, t)) throw new Error(`"${t}" is not a building style this company offers.`);
  state.type = t;
  if (!pPrice(t, state.size, cat)) { const zz = pSizes(t, cat); state.size = zz[Math.min(4, zz.length - 1)]; }
  const T = cat.TYPES[t];
  if (T.metal && cat.COLORS.metal.map((c) => c[1]).indexOf(state.body) < 0) state.body = pickByName(cat.COLORS.metal, ["white"]);
  if (!T.metal && cat.COLORS.paint.map((c) => c[1]).indexOf(state.body) < 0) state.body = pickByName(cat.COLORS.paint, ["white"]);
  const fr = frameOf(state, cat);
  resetItems(state, fr, cat);
  if (state.elec && state.elec.pkg > 0) pkFixtures(state, fr, cat);
  return state;
}

/* Barnwright's setSize: the doors and windows are NOT laid out again, only
   kept inside the walls. */
export function setSize(state, sz, cat) {
  state.size = sz;
  const fr = frameOf(state, cat);
  state.items.forEach((it) => clampPos(it, state, fr));
  state.sel = null;
  return state;
}

/* Barnwright's flipPorch: the side porch to the other end, items mirrored. */
export function flipPorch(state, cat) {
  if (state.pMid) return state;
  state.pFlip = !state.pFlip;
  state.items.forEach((it) => {
    const g = cat.CAT[it.cat] && cat.CAT[it.cat].gable;
    /* (an inside item has no pos; Barnwright made it NaN, which meant nothing) */
    const flip = !g && typeof it.pos === "number";
    if (it.wall === "F") { it.wall = "B"; if (flip) it.pos = -it.pos; }
    else if (it.wall === "B") { it.wall = "F"; if (flip) it.pos = -it.pos; }
    else if (flip) it.pos = -it.pos;
  });
  const fr = frameOf(state, cat);
  state.items.forEach((it) => clampPos(it, state, fr));
  return state;
}

/* ------------------------------------------------------------------------ */

export function normalize(state, frame, cat) {
  const fr = frame || frameOf(state, cat);
  const t = fr.t;
  const changed = [];
  if (t.porch === "S") {
    const Lnow = +String(state.size).split("x")[1];
    if (Lnow < 20 && state.pLen !== 8) { state.pLen = 8; changed.push("The side porch is 4 x 8 on a building under 20 ft long."); }
  }
  if (state.elec && state.elec.pkg > 0 && !(cat.ELECPK || []).some((e) => +e[0] === +state.elec.pkg)) {
    changed.push(`Electric package ${state.elec.pkg} is not offered, so it was switched off.`);
    state.elec.pkg = 0;
    pkFixtures(state, fr, cat);
  }
  if (state.elec && state.elec.ext && (cat.MISC || {}).ext == null) { state.elec.ext = false; changed.push("The exterior light is not offered, so it was switched off."); }
  if (state.elec && state.elec.ext && state.elec.pkg === 0) {
    state.elec.ext = false;
    changed.push("The exterior electrical light needs an electrical package, so it was switched off.");
  }
  if (state.ramp && state.ramp !== "none" && !(cat.RAMPS || []).some((r) => r[0] === state.ramp)) { changed.push(`The ramp "${state.ramp}" is not offered, so it was switched off.`); state.ramp = "none"; }
  const O = state.opts || {};
  for (const k of Object.keys(O)) if (O[k] && !Object.prototype.hasOwnProperty.call(cat.RATES || {}, k)) { O[k] = false; changed.push(`The upgrade "${k}" is not offered, so it was switched off.`); }
  const X = state.xopt || {};
  const keys = new Set(((cat.OPTX && cat.OPTX.extras) || []).map((x) => x.key));
  for (const k of Object.keys(X)) if (!keys.has(k)) { delete X[k]; changed.push(`The extra "${k}" is not offered, so it was taken off.`); }
  if (t.dormer && state.dormer !== "none" && !(cat.DORMERS || []).some((d) => d[0] === state.dormer)) {
    const fallback = (cat.DORMERS || []).some((d) => d[0] === cat.defaults.dormer) ? cat.defaults.dormer : "none";
    changed.push(`The ${state.dormer} ft dormer is not offered; it is now ${fallback === "none" ? "no dormer" : fallback + " ft"}.`);
    state.dormer = fallback;
  }
  if ((cat.MISC || {}).shutter == null) state.items.forEach((it) => { if (it.shut) { it.shut = false; changed.push("Shutters are not offered, so they were taken off."); } });
  if ((cat.MISC || {}).lite == null) state.items.forEach((it) => { if (it.lite) { it.lite = false; changed.push("A window in a wooden door is not offered, so it was taken off."); } });
  return changed;
}

/* ------------------------------------------------------------------------ */

function itemOut(it) {
  const o = { cat: it.cat, wall: it.wall };
  if (typeof it.pos === "number" && isFinite(it.pos)) o.pos = round(it.pos, 3);
  if (it.vy) o.vy = round(it.vy, 3);
  if (it.px != null) o.px = round(it.px, 3);
  if (it.pz != null) o.pz = round(it.pz, 3);
  if (it.rot) o.rot = true;
  if (it.ln != null) o.ln = it.ln;
  if (it.inc) o.inc = true;
  if (it.pk) o.pk = true;
  if (it.dbl) o.dbl = true;
  if (it.shut) o.shut = true;
  if (it.lite) o.lite = true;
  /* an included item starts as itself; only a swap is worth writing down */
  if (it.origCat != null && !(it.inc && it.origCat === it.cat)) o.origCat = it.origCat;
  return o;
}

export function fromState(state, cat, opts) {
  const t = cat.TYPES[state.type] || {};
  const siding = sidingPalette(t, cat.COLORS);
  const d = {
    v: 1,
    company: cat.id,
    cfg: cat.cfg,
    type: state.type,
    size: state.size,
    colors: {
      body: colorName(siding, state.body),
      trim: colorName(cat.COLORS.trim, state.trim),
      roof: colorName(cat.COLORS.metal, state.roof),
      door: state.doorC ? colorName(cat.COLORS.paint, state.doorC) : "",
      shutters: state.shutC ? colorName(cat.COLORS.paint, state.shutC) : "",
    },
    items: state.items.map(itemOut),
    dormer: state.dormer,
    porch: { pLen: +state.pLen === 8 ? 8 : 12, pFlip: !!state.pFlip, pMid: !!state.pMid },
    opts: Object.keys(state.opts || {}).filter((k) => state.opts[k]),
    elec: { pkg: +((state.elec && state.elec.pkg) || 0), ext: !!(state.elec && state.elec.ext) },
    ramp: state.ramp || "none",
    xopt: Object.assign({}, state.xopt || {}),
  };
  if (opts && opts.priced) d.priced = { total: priceParts(state, cat).total, at: opts.at || new Date().toISOString().slice(0, 10) };
  return d;
}

/* A colour name back to its hex, through the company's renames. */
function colourBack(name, list, cat, what, warnings, fallback) {
  if (name == null) return fallback;
  if (name === "") return "";
  const renamed = (cat.renames && has(cat.renames.colors, name) && cat.renames.colors[name]) || name;
  const hex = hexOfName(list, renamed);
  if (hex) return hex;
  if (/^#[0-9a-fA-F]{6}$/.test(renamed)) {
    const hit = list.find((c) => c[1].toLowerCase() === renamed.toLowerCase());
    if (hit) return hit[1];
    warnings.push(`The ${what} colour ${renamed} is not on this company's colour card; it is shown as saved.`);
    return renamed;
  }
  warnings.push(`The ${what} colour "${name}" is no longer offered, so the ${what} is shown in ${colorName(list, fallback) || "the standard colour"}.`);
  return fallback;
}

export function toState(design, cat) {
  const warnings = [];
  const d = design || {};
  const s = defaults(cat);
  if (d.v != null && d.v !== 1) warnings.push(`This design was saved by a newer version of the designer (version ${d.v}); some of it may not show.`);
  if (d.company && d.company !== cat.id) warnings.push(`This design was made in "${d.company}"'s designer; it is shown with this company's buildings and prices.`);
  if (d.cfg != null && cat.cfg != null && d.cfg !== cat.cfg) warnings.push("This company's prices or items have changed since the design was saved.");

  /* THE SIZE FIRST, THEN THE STYLE, THEN THE SIZE (Barnwright's applyDesign):
     laying a style out uses the size in hand. */
  const ren = cat.renames || {};
  let type = d.type;
  if (type != null && !has(cat.TYPES, type)) { warnings.push(`The style "${type}" is no longer offered; showing the ${cat.TYPES[s.type].name} instead.`); type = s.type; }
  if (type == null) type = s.type;
  let size = d.size != null ? String((has(ren.sizes, d.size) && ren.sizes[d.size]) || d.size) : null;
  if (size) s.size = size;
  setType(s, type, cat);
  let asSaved = type === d.type && size === d.size && d.company === cat.id && d.cfg === cat.cfg;
  if (size && s.size !== size) { warnings.push(`The ${size} size of the ${cat.TYPES[type].name} is no longer sold; showing the ${s.size} instead.`); asSaved = false; }
  else if (size) setSize(s, size, cat);

  const C = d.colors || {};
  const t = cat.TYPES[s.type];
  s.body = colourBack(C.body, sidingPalette(t, cat.COLORS), cat, "siding", warnings, s.body);
  s.trim = colourBack(C.trim, cat.COLORS.trim, cat, "trim", warnings, s.trim);
  s.roof = colourBack(C.roof, cat.COLORS.metal, cat, "roof", warnings, s.roof);
  s.doorC = colourBack(C.door, cat.COLORS.paint, cat, "door", warnings, "");
  s.shutC = colourBack(C.shutters, cat.COLORS.paint, cat, "shutter", warnings, "");
  if (d.dormer != null) s.dormer = String(d.dormer);
  if (d.porch) {
    if (d.porch.pLen != null) s.pLen = +d.porch.pLen === 8 ? 8 : 12;
    s.pFlip = !!d.porch.pFlip; s.pMid = !!d.porch.pMid;
  }
  for (const k of Object.keys(s.opts)) s.opts[k] = false;
  for (const k of (Array.isArray(d.opts) ? d.opts : [])) {
    if (Object.prototype.hasOwnProperty.call(cat.RATES || {}, k)) s.opts[k] = true;
    else warnings.push(`The upgrade "${k}" is no longer offered, so it was left off.`);
  }
  s.xopt = {};
  const extraKeys = new Set(((cat.OPTX && cat.OPTX.extras) || []).map((x) => x.key));
  for (const k of Object.keys(d.xopt || {})) {
    const v = +d.xopt[k] || 0;
    if (!(v > 0)) continue;
    if (extraKeys.has(k)) s.xopt[k] = v; else warnings.push(`The extra "${k}" is no longer offered, so it was left off.`);
  }
  if (d.elec) s.elec = { pkg: +d.elec.pkg || 0, ext: !!d.elec.ext };
  if (d.ramp != null) s.ramp = d.ramp;

  const fr = frameOf(s, cat);
  if (Array.isArray(d.items)) {
    const kept = [];
    d.items.forEach((x) => {
      if (!x || typeof x !== "object") { warnings.push("One item in the design could not be read and was left off."); asSaved = false; return; }
      const catId = (has(ren.items, x.cat) && ren.items[x.cat]) || x.cat;
      if (catId !== x.cat) asSaved = false;
      if (!has(cat.CAT, catId)) { warnings.push(`The design had a "${x.cat}" item, which this company no longer offers; it was left off.`); asSaved = false; return; }
      const wall = x.wall || "F";
      const c = cat.CAT[catId];
      const wallOk = (c.free || c.stretch) ? true : has(fr.ws, wall);
      if (!wallOk) { warnings.push(`The ${c.n} was on a wall ("${wall}") this building does not have; it was left off.`); asSaved = false; return; }
      const it = { id: "e" + kept.length, cat: catId, inc: !!x.inc, shut: !!x.shut, lite: !!x.lite, dbl: !!x.dbl, pk: !!x.pk, wall, rot: !!x.rot };
      /* a position that is not a number (a damaged or hand-edited link) is
         said out loud and left for the clamp to place, never drawn as NaN */
      const bad = ["pos", "vy", "px", "pz", "ln"].filter((f) => x[f] != null && !isNum(x[f]));
      if (bad.length) { warnings.push(`The ${c.n}'s saved ${bad.join(" and ")} could not be read, so it was put in a standard place.`); asSaved = false; }
      if (isNum(x.pos)) it.pos = x.pos; if (isNum(x.vy) && x.vy) it.vy = x.vy;
      if (isNum(x.px)) it.px = x.px; if (isNum(x.pz)) it.pz = x.pz;
      if (isNum(x.ln) && x.ln) it.ln = x.ln;
      const orig = x.origCat != null ? ((has(ren.items, x.origCat) && ren.items[x.origCat]) || x.origCat) : (x.inc ? catId : null);
      if (orig != null) {
        if (has(cat.CAT, orig)) it.origCat = orig;
        else warnings.push(`The ${c.n} started as a "${x.origCat}", which this company no longer offers; it is priced as it stands.`);
      }
      if (it.pos == null && !(c.free || c.stretch)) it.pos = 0;
      kept.push(it);
    });
    s.items = kept;
    s.seq = s.items.length + 1; s.sel = null;
    /* Reopened on the same price list, at the same style and size, with every
       item still offered: each item stays EXACTLY where it was saved, only kept
       on its wall (a deliberate difference from Barnwright, whose applyDesign
       re-clamped everything and could shift a crowded wall on every opening).
       Anything changed since: Barnwright's full clamp, in order. */
    if (asSaved) s.items.forEach((it) => keepOnWall(it, s, fr));
    else s.items.forEach((it) => clampPos(it, s, fr));
  } else {
    /* no items saved: the style's standard layout, laid for the porch as saved */
    resetItems(s, fr, cat);
    if (s.elec.pkg > 0) pkFixtures(s, fr, cat);
  }
  warnings.push(...normalize(s, frameOf(s, cat), cat));
  return { state: s, warnings };
}

/* ------------------------------------------------------------------------
   THE SHARE LINK. encode(design) -> text safe for a URL (#d=...). */

const FLAG = { inc: 1, shut: 2, dbl: 4, lite: 8, rot: 16, pk: 32 };

function compact(design) {
  const d = design;
  const o = { v: d.v || 1 };
  if (d.company) o.c = d.company;
  if (d.cfg != null) o.g = d.cfg;
  o.t = d.type; o.s = d.size;
  const C = d.colors || {};
  const k = [C.body || "", C.trim || "", C.roof || "", C.door || "", C.shutters || ""];
  while (k.length && k[k.length - 1] === "") k.pop();
  if (k.length) o.k = k;
  o.i = (d.items || []).map((it) => {
    let f = 0;
    for (const n of Object.keys(FLAG)) if (it[n]) f |= FLAG[n];
    const tup = [it.cat, it.wall, it.pos == null ? null : it.pos, f, it.vy || null, it.px == null ? null : it.px, it.pz == null ? null : it.pz, it.ln == null ? null : it.ln, it.origCat == null ? null : it.origCat];
    while (tup.length > 3 && (tup[tup.length - 1] === null || (tup.length === 4 && tup[3] === 0))) tup.pop();
    return tup;
  });
  if (d.dormer != null && d.dormer !== "none") o.d = d.dormer;
  const P = d.porch || {};
  if ((P.pLen != null && +P.pLen !== 12) || P.pFlip || P.pMid) o.p = [+P.pLen === 8 ? 8 : 12, P.pFlip ? 1 : 0, P.pMid ? 1 : 0];
  if (d.opts && d.opts.length) o.o = d.opts.slice();
  if (d.elec && (d.elec.pkg || d.elec.ext)) o.e = [+d.elec.pkg || 0, d.elec.ext ? 1 : 0];
  if (d.ramp && d.ramp !== "none") o.r = d.ramp;
  if (d.xopt && Object.keys(d.xopt).length) o.x = d.xopt;
  if (d.priced) o.$ = [d.priced.total, d.priced.at];
  return o;
}

function expand(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("This design link could not be read.");
  const k = Array.isArray(o.k) ? o.k : [];
  const d = {
    v: o.v || 1,
    company: o.c || "",
    cfg: o.g != null ? o.g : null,
    type: o.t,
    size: o.s,
    colors: { body: k[0] || "", trim: k[1] || "", roof: k[2] || "", door: k[3] || "", shutters: k[4] || "" },
    /* a tuple that is not a list becomes null, which toState reports as an
       item it could not read (never a crash, never a silent drop); a link
       with no item list at all gets the style's standard doors and windows */
    items: !Array.isArray(o.i) ? undefined : o.i.map((tup) => {
      if (!Array.isArray(tup)) return null;
      /* the same field order fromState writes */
      const it = { cat: tup[0], wall: tup[1] };
      const f = tup[3] || 0;
      if (tup[2] != null) it.pos = tup[2];
      if (tup[4] != null) it.vy = tup[4];
      if (tup[5] != null) it.px = tup[5];
      if (tup[6] != null) it.pz = tup[6];
      if (f & FLAG.rot) it.rot = true;
      if (tup[7] != null) it.ln = tup[7];
      for (const n of ["inc", "pk", "dbl", "shut", "lite"]) if (f & FLAG[n]) it[n] = true;
      if (tup[8] != null) it.origCat = tup[8];
      return it;
    }),
    dormer: o.d != null ? o.d : "none",
    porch: { pLen: o.p ? o.p[0] : 12, pFlip: !!(o.p && o.p[1]), pMid: !!(o.p && o.p[2]) },
    opts: Array.isArray(o.o) ? o.o.slice() : [],
    elec: { pkg: o.e ? +o.e[0] || 0 : 0, ext: !!(o.e && o.e[1]) },
    ramp: o.r || "none",
    xopt: o.x && typeof o.x === "object" ? o.x : {},
  };
  if (!d.colors.body && !d.colors.trim && !d.colors.roof) delete d.colors;
  if (d.items === undefined) delete d.items;
  if (Array.isArray(o.$)) d.priced = { total: o.$[0], at: o.$[1] };
  return d;
}

/* base64url over bytes -- never btoa on text */
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function bytesToB64url(bytes) {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8);
    out += B64[n >> 18] + B64[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63];
  }
  return out;
}
export function b64urlToBytes(s) {
  const clean = String(s).replace(/=+$/, "");
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let o = 0, buf = 0, bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error("This design link has been cut short or changed (it has a character a link never uses).");
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, o);
}

function linkBody(s) {
  let t = String(s || "").trim();
  const m = /[#&?]d=([^&#]*)/.exec(t);
  if (m) t = m[1];
  return t;
}

export function encodeSync(design) {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(compact(design))));
}

export function decodeSync(text) {
  const t = linkBody(text);
  if (t[0] === "z") throw new Error("This design link is compressed; use decode(), which can unpack it.");
  let json;
  try { json = new TextDecoder("utf-8", { fatal: true }).decode(b64urlToBytes(t)); }
  catch (e) { throw new Error("This design link could not be read: " + e.message); }
  let o;
  try { o = JSON.parse(json); } catch (e) { throw new Error("This design link could not be read (it has been cut short or changed)."); }
  return expand(o);
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/* The share link text. With compression available (and shorter) it is "z" +
   deflate-raw; otherwise the plain form. Both decode with decode(). */
export async function encode(design, opts) {
  const plain = encodeSync(design);
  const want = !(opts && opts.compress === false);
  if (!want || typeof CompressionStream !== "function") return plain;
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(compact(design)));
    const z = "z" + bytesToB64url(await pipe(bytes, new CompressionStream("deflate-raw")));
    return z.length < plain.length ? z : plain;
  } catch (e) {
    return plain;
  }
}

export async function decode(text) {
  const t = linkBody(text);
  if (t[0] !== "z") return decodeSync(t);
  if (typeof DecompressionStream !== "function") throw new Error("This browser cannot unpack this design link.");
  let json;
  try {
    const bytes = await pipe(b64urlToBytes(t.slice(1)), new DecompressionStream("deflate-raw"));
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (e) { throw new Error("This design link could not be read (it has been cut short or changed)."); }
  let o;
  try { o = JSON.parse(json); } catch (e) { throw new Error("This design link could not be read (it has been cut short or changed)."); }
  return expand(o);
}
