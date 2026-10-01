/* EVERY CHANGE A CUSTOMER CAN MAKE TO THE BUILDING, in one place.
   Node-safe: no page, no drawing -- tools/check-ui.mjs runs these in Node as
   well as through the real page.

   The live design is Barnwright's `state` (model/design.js explains its
   fields). The screens in ui/ never change it themselves: every chip, swatch,
   switch, button and drag calls one of these, and then the page is refreshed
   and the building redrawn (ui/app.js). Each function takes (state, ...) and
   the company catalogue `cat` (model/company.js resolve), changes the state in
   place exactly as Barnwright's page did, and returns what the screen needs
   to know (usually the item it touched).

   Ported from Barnwright's 3ddesign.html:
     addAt              4267-4282  add an item where the finger was held
     setItemType ...    4919-4990  the selection sheet's controls
     duplicateItem      5032-5037  Duplicate on the sheet
     removeItem         5028-5031  Remove on the sheet
     facingWall         5040-5045  the wall the camera is looking at
     addItem            5058-5064  the "+ Add door / window / roll-up / post / light" buttons
     addInterior        4675-4681  "+ Work bench" / "+ Shelf"
     the chips          5114-5283  style, dormer, size, porch, colours,
                                   electric package, ramp, upgrades, extras
   with Barnwright's porting rules: item codes became item traits
   (a "shop-door", a "transom", a door with a `liteSwap` twin), the Dog Kennel
   became the `kennel` style trait, and every list of items comes from the
   catalogue (cat.LISTS) instead of being typed out.

   DELIBERATE DIFFERENCES FROM BARNWRIGHT (docs/DIFFERENCES.md):
   * #12 chooseSize: changing size re-lays the standard doors and windows for
     the new size, but ONLY while the doors and windows are still exactly the
     standard ones for the old size (isStandardLayout). Barnwright never
     re-laid them, so a 10x12 Cottage (one 46 in door) made 10x16 kept the
     46 in door although a 10x16 comes with 70 in doubles, and a 6x8 Backyard
     Utility made 6x12 never got its two windows. Once the customer has moved,
     added, removed, swapped or dressed up anything, their items are kept and
     only moved onto the new walls, exactly as Barnwright does.
   * #8 the electrical package's fixtures are laid AFTER the standard doors
     and windows whenever those are laid out again (style change, the size
     re-lay above, and the side-cabin porch moved to the middle), so the
     package is never charged without being drawn.
   * A duplicated inside item (a bench, a shelf, an overhead light) gets no
     wall position: Barnwright gave it pos = NaN, which meant nothing but is
     not a number anybody should save. (Same kind of fix as #7.)
   * normalize (model/design.js) runs after every change (ui/app.js), so the
     rules Barnwright applied while drawing its buttons -- a side porch is 4x8
     under 20 ft, an option the company does not sell is switched off -- hold
     whether or not the screen was drawn. */

import { frameOf } from "../model/frame.js";
import { resetItems, clampPos, pkFixtures, freeSpot, itemById } from "../model/layout.js";
import { setType as modelSetType, setSize as modelSetSize, flipPorch as modelFlipPorch } from "../model/design.js";
import { pPrice } from "../model/pricing.js";
import { wallPt } from "../engine/wall.js";

function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
function frame(state, cat) { return frameOf(state, cat); }

/* ------------------------------------------------------------------------
   Lists and small lookups */

/* The index of the category tab (cat.CATS) a style belongs to. */
export function catOfType(t, cat) {
  const C = cat.CATS || [];
  for (let i = 0; i < C.length; i++) if (String(C[i][1]).split(",").indexOf(t) >= 0) return i;
  return 0;
}

/* The styles in one category tab, in the company's order. */
export function stylesIn(i, cat) {
  const C = (cat.CATS || [])[i];
  return C ? String(C[1]).split(",").filter((t) => has(cat.TYPES, t)) : [];
}

/* The items one of the add buttons or sheet lists offers (cat.LISTS already
   holds only what the company sells, in the manufacturer's order). */
export function listOf(cat, name) {
  return ((cat.LISTS && cat.LISTS[name]) || []).filter((k) => has(cat.CAT, k));
}
export function firstOf(cat, name) { const l = listOf(cat, name); return l.length ? l[0] : null; }

/* The wall the camera looks at: the one whose outward normal is closest to
   the direction from the building to the eye (F +z, B -z, R +x, L -x). */
export function facingWall(yaw) {
  const dirs = { F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
  const cd = [Math.sin(yaw), 0, Math.cos(yaw)];
  let best = "F", bd = -2;
  for (const k in dirs) { const d = dirs[k][0] * cd[0] + dirs[k][1] * cd[1] + dirs[k][2] * cd[2]; if (d > bd) { bd = d; best = k; } }
  return best;
}

/* The plain wall nearest a point on the floor (world x, z), and how far along
   it the point is. Only the four main walls: Barnwright never picks a porch
   wall this way (clampPos then keeps the item legal). */
function nearestWall(px, pz, fr) {
  const d = fr.d;
  const ex = d.W / 2 - Math.abs(px), ez = d.L / 2 - Math.abs(pz);
  const wl = (ex < ez) ? ((px > 0) ? "R" : "L") : ((pz > 0) ? "F" : "B");
  const w = fr.ws[wl], b = wallPt(w, 0, 0, 0);
  return { wall: wl, pos: (px - b[0]) * w.ax[0] + (pz - b[2]) * w.ax[2] };
}

/* ------------------------------------------------------------------------
   DIFFERENCES #12: are the doors and windows still the standard ones? */

function near(a, b) { return Math.abs((+a || 0) - (+b || 0)) < 1e-6; }
function sameItem(a, b) {
  return a.cat === b.cat && a.wall === b.wall && near(a.pos, b.pos) && near(a.vy, b.vy) &&
    !!a.inc === !!b.inc && (a.origCat == null ? null : a.origCat) === (b.origCat == null ? null : b.origCat) &&
    !!a.dbl === !!b.dbl && !!a.shut === !!b.shut && !!a.lite === !!b.lite && !!a.rot === !!b.rot &&
    a.px == null && a.pz == null && a.ln == null;
}

/* The standard doors and windows for the building as it stands (its style,
   size and porch), laid out and clamped exactly as a style change lays them
   (model/layout.js resetItems on a scratch copy -- the live state is not
   touched). */
export function standardLayout(state, cat) {
  const probe = Object.assign({}, state, { items: [], sel: null, seq: 0 });
  resetItems(probe, frame(probe, cat), cat);
  return probe.items;
}

/* True when every door, window and other item on the building (the electric
   package's own fixtures aside -- the package lays those itself) is exactly
   the standard layout for its style and size, in order: nothing moved,
   added, removed, swapped, doubled, turned or given shutters or a window. */
export function isStandardLayout(state, cat) {
  let std;
  try { std = standardLayout(state, cat); } catch (e) { return false; }
  const mine = state.items.filter((it) => !it.pk);
  if (mine.length !== std.length) return false;
  for (let i = 0; i < std.length; i++) if (!sameItem(mine[i], std[i])) return false;
  return true;
}

/* ------------------------------------------------------------------------
   The building card: category, style, dormer */

/* A style chip. Barnwright's setType (5244-5252), with the package fixtures
   laid after the standard items (model/design.js setType, DIFFERENCES #8). */
export function chooseType(state, t, cat) {
  modelSetType(state, t, cat);
  state.sel = null;
  return state;
}

/* The category drop-down: the first style of that category. */
export function chooseCategory(state, i, cat) {
  const list = stylesIn(i, cat);
  if (list.length) chooseType(state, list[0], cat);
  return state;
}

export function chooseDormer(state, id) { state.dormer = String(id); return state; }

/* ------------------------------------------------------------------------
   The size card: size and the side porch */

/* A size chip (DIFFERENCES #12, see the top of this file).
   -> { relaid }: true when the standard doors and windows were laid out
   again for the new size. */
export function chooseSize(state, sz, cat) {
  if (!pPrice(state.type, sz, cat)) throw new Error(`"${sz}" is not a size of the ${cat.TYPES[state.type].name} this company sells.`);
  const untouched = isStandardLayout(state, cat);
  if (!untouched) { modelSetSize(state, sz, cat); return { relaid: false }; }
  state.size = sz;
  const fr = frame(state, cat);
  resetItems(state, fr, cat);
  if (state.elec && state.elec.pkg > 0) pkFixtures(state, fr, cat);
  state.sel = null;
  return { relaid: true };
}

/* "4 x 8 porch" / "4 x 12 porch" (Barnwright 5160): the items are kept and
   moved clear of the new porch. */
export function choosePorchLength(state, len, cat) {
  state.pLen = +len;
  const fr = frame(state, cat);
  state.items.forEach((it) => clampPos(it, state, fr));
  return state;
}

/* "Corner porch" / "Middle porch" (Barnwright 5169): the standard doors and
   windows are laid out again for the new porch, then the package fixtures. */
export function choosePorchPlace(state, mid, cat) {
  state.pMid = !!mid;
  const fr = frame(state, cat);
  resetItems(state, fr, cat);
  if (state.elec && state.elec.pkg > 0) pkFixtures(state, fr, cat);
  return state;
}

/* "Flip porch" (Barnwright flipPorch 5254-5264, model/design.js). */
export function flipPorch(state, cat) { return modelFlipPorch(state, cat); }

/* ------------------------------------------------------------------------
   Colours. body, trim, roof are hex from the company's palettes; doorC and
   shutC are "" for "the same as the siding / the trim". Door and shutter
   colours are for the WHOLE building, even when picked on one item's sheet. */
export const COLOUR_KEYS = Object.freeze(["body", "trim", "roof", "doorC", "shutC"]);
export function setColour(state, key, hex) {
  if (COLOUR_KEYS.indexOf(key) < 0) throw new Error(`"${key}" is not a colour of the building.`);
  state[key] = hex;
  return state;
}

/* ------------------------------------------------------------------------
   Adding things */

/* "+ Add door / window / roll-up / post / light" (Barnwright addItem
   5058-5064): on the wall the camera faces, at the first free spot working
   out from the middle; a gable window on the front gable. Porch posts go on
   the porch; nothing goes on a kennel's open front. */
export function addItem(state, catId, cat, yaw) {
  const fr = frame(state, cat), c = cat.CAT[catId], t = fr.t;
  if (!c) throw new Error(`"${catId}" is not an item this company sells.`);
  let wall = c.gable ? "F" : facingWall(yaw || 0);
  if (c.k === "post") wall = (t.porch === "C") ? ((facingWall(yaw || 0) === "F") ? "F" : "R") : ((t.porch === "R" || t.porch === "S") ? "R" : "F");
  if (t.kennel && wall === "F") wall = "B";                  /* the kennel's front is its open run */
  const it = { id: "i" + (state.seq++), cat: catId, wall: wall, pos: c.gable ? 0 : freeSpot(wall, c.w, state, fr), inc: false, shut: false };
  clampPos(it, state, fr); state.items.push(it);
  return it;
}

/* "+ Work bench" / "+ Shelf" (Barnwright addInterior 4675-4681): a bench or
   shelf 4 ft long in the middle of the floor; anything else on the wall the
   camera faces. */
export function addInterior(state, catId, cat, yaw) {
  const fr = frame(state, cat), c = cat.CAT[catId];
  if (!c) throw new Error(`"${catId}" is not an item this company sells.`);
  const it = { id: "i" + (state.seq++), cat: catId, inc: false, shut: false };
  if (c.stretch) { it.wall = "IN"; it.ln = 4; it.rot = false; it.px = 0; it.pz = 0; }
  else if (c.free) { it.wall = "IN"; it.px = 0; it.pz = 0; }
  else { it.wall = facingWall(yaw || 0); it.pos = freeSpot(it.wall, c.w, state, fr); }
  clampPos(it, state, fr); state.items.push(it);
  return it;
}

/* The "Add here" menu (Barnwright addAt 4267-4282). spot is where the finger
   was held: {wall, u} on a wall (u along it), or {px, pz, rot} on the floor.
   A wall item picked from open floor goes on the nearest wall. */
export function addAt(state, catId, spot, cat) {
  const fr = frame(state, cat), cc = cat.CAT[catId];
  if (!cc) throw new Error(`"${catId}" is not an item this company sells.`);
  spot = spot || {};
  const it = { id: "i" + (state.seq++), cat: catId, inc: false, shut: false };
  if (cc.free || cc.stretch) { it.wall = "IN"; it.px = spot.px || 0; it.pz = spot.pz || 0; if (cc.stretch) { it.ln = 4; it.rot = !!spot.rot; } }
  else if (spot.wall !== undefined) { it.wall = spot.wall; it.pos = spot.u; }
  else { const nw = nearestWall(spot.px || 0, spot.pz || 0, fr); it.wall = nw.wall; it.pos = nw.pos; }
  clampPos(it, state, fr); state.items.push(it);
  return it;
}

/* ------------------------------------------------------------------------
   The selection sheet */

export function removeItem(state, id) {
  for (let i = 0; i < state.items.length; i++) if (state.items[i].id === id) { state.items.splice(i, 1); break; }
  if (state.sel === id) state.sel = null;
  return state;
}

/* Duplicate (Barnwright 5032-5037): a copy one opening-width and 0.9 ft
   along, never included (a copy of an included door is a door you pay for),
   never part of the package; interior pieces a foot over each way. */
export function duplicateItem(state, id, cat) {
  const it = itemById(state, id);
  if (!it) return null;
  const CAT = cat.CAT;
  const nw = { id: "i" + (state.seq++), cat: it.cat, wall: it.wall, inc: false, shut: it.shut, lite: !!it.lite, rot: !!it.rot, dbl: !!it.dbl, vy: it.vy || 0 };
  if (typeof it.pos === "number") nw.pos = it.pos + CAT[it.cat].w + 0.9;
  if (CAT[it.cat].int) { nw.px = (it.px || 0) + 1; nw.pz = (it.pz || 0) + 1; nw.ln = it.ln; }
  clampPos(nw, state, frame(state, cat)); state.items.push(nw);
  return nw;
}

/* The type drop-down (Barnwright 4919-4945). v is an item code, or "PKG1" ..
   "PKG3" for a whole electric package. -> { pkg } when a package was picked
   (the screen then selects its switch), else { item }. */
export function setItemType(state, id, v, cat) {
  const it = itemById(state, id);
  if (!it) return {};
  const CAT = cat.CAT;
  const m = /^PKG(\d+)$/.exec(v);
  if (m) {
    const n = +m[1];
    if (!it.pk) state.items = state.items.filter((i) => i.id !== it.id);      /* the loose piece becomes part of the package */
    state.elec.pkg = n;
    pkFixtures(state, frame(state, cat), cat);
    const g = state.items.filter((i) => i.pk && CAT[i.cat] && CAT[i.cat].switch)[0];
    return { pkg: n, select: g ? g.id : null };
  }
  if (!CAT[v]) throw new Error(`"${v}" is not an item this company sells.`);
  const fr = frame(state, cat);
  const was = it.cat; it.cat = v;
  const wasC = CAT[was], nowC = CAT[it.cat];
  if (nowC.free && !wasC.free) {                                /* outlet -> overhead light: lift it off the wall */
    const wv = fr.ws[it.wall];
    if (wv) { const pw = wallPt(wv, it.pos, 0, -1.4); it.px = pw[0]; it.pz = pw[2]; } else { it.px = 0; it.pz = 0; }
    it.wall = "IN";
  }
  if (!nowC.free && wasC.free && nowC.int) {                    /* light -> outlet: snap to the nearest wall */
    const nw = nearestWall(it.px || 0, it.pz || 0, fr); it.wall = nw.wall; it.pos = nw.pos;
  }
  if (nowC.gable && !wasC.gable) {
    if ("FBRL".indexOf(it.wall) < 0) it.wall = "F";
    it.pos = 0; it.vy = 0;
  }
  if (!nowC.gable && wasC.gable) { it.pos = 0; it.vy = 0; if ("FBRL".indexOf(it.wall) < 0) it.wall = "F"; }
  clampPos(it, state, fr);
  return { item: it };
}

/* The Front / Back / Left / Right chips: jump the item to another wall. */
export function setItemWall(state, id, wall, cat) {
  const it = itemById(state, id);
  if (!it || it.wall === wall) return null;
  it.wall = wall; it.pos = 0; it.vy = 0;
  clampPos(it, state, frame(state, cat));
  return it;
}

/* Turn 90 degrees: a transom stood on end, or a bench/shelf along the length. */
export function toggleRot(state, id, cat) {
  const it = itemById(state, id); if (!it) return null;
  it.rot = !it.rot; clampPos(it, state, frame(state, cat));
  return it;
}

export function toggleShutters(state, id) {
  const it = itemById(state, id); if (!it) return null;
  it.shut = !it.shut;
  return it;
}

/* Window in door. On a wooden shop door it is a window put in the door; on a
   door with a `liteSwap` twin (the 36 in steel door and its 11-lite version)
   it swaps to the twin. */
export function toggleLite(state, id, cat) {
  const it = itemById(state, id); if (!it) return null;
  const c = cat.CAT[it.cat];
  if (c.liteSwap && cat.CAT[c.liteSwap]) { it.cat = c.liteSwap; clampPos(it, state, frame(state, cat)); }
  else it.lite = !it.lite;
  return it;
}

/* Double window: two windows sharing one trim board down the middle. The
   opening just changed width, so it may no longer fit where it sits. */
export function toggleDouble(state, id, cat) {
  const it = itemById(state, id); if (!it) return null;
  it.dbl = !it.dbl; clampPos(it, state, frame(state, cat));
  return it;
}

/* Length -/+ of a bench or shelf, a foot at a time (2 ft at least). */
export function changeLength(state, id, delta, cat) {
  const it = itemById(state, id); if (!it) return null;
  it.ln = delta < 0 ? Math.max(2, (it.ln || 4) - 1) : (it.ln || 4) + 1;
  clampPos(it, state, frame(state, cat));
  return it;
}

/* Moving an item (a drag): its new position, then clampPos. */
export function moveItem(state, id, to, cat) {
  const it = itemById(state, id); if (!it) return null;
  for (const k of ["pos", "vy", "px", "pz"]) if (typeof to[k] === "number" && isFinite(to[k])) it[k] = to[k];
  clampPos(it, state, frame(state, cat));
  return it;
}

/* ------------------------------------------------------------------------
   Inside and upgrades */

/* An electric package chip: its fixtures are laid out afresh. */
export function setElec(state, pkg, cat) {
  state.elec.pkg = +pkg;
  if (state.elec.pkg === 0) state.elec.ext = false;
  pkFixtures(state, frame(state, cat), cat);
  return state;
}
/* Exterior light + dual switch (only with a package). */
export function toggleExt(state, cat) {
  state.elec.ext = !state.elec.ext;
  pkFixtures(state, frame(state, cat), cat);
  return state;
}
export function setRamp(state, id) { state.ramp = id; return state; }
export function toggleOpt(state, k) { state.opts[k] = !state.opts[k]; return state; }

/* One of the company's own extras (no 3D shape): a switch, or a count or
   feet typed in (Barnwright updateXopts 860-913). */
export function setExtra(state, x, value) {
  if (!state.xopt) state.xopt = {};
  if (x.input === "qty" || x.input === "lf") {
    const ft = x.input === "lf";
    state.xopt[x.key] = Math.max(0, Math.min(ft ? 200 : 99, Math.round(+value || 0)));
    if (!state.xopt[x.key]) delete state.xopt[x.key];
  } else {
    if (value === undefined ? state.xopt[x.key] : !value) delete state.xopt[x.key]; else state.xopt[x.key] = 1;
  }
  return state;
}
