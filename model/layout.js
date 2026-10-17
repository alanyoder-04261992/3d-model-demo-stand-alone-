/* WHERE DOORS, WINDOWS AND FIXTURES MAY GO, AND WHERE THE STANDARD ONES START.
   Node-safe. These functions CHANGE THE LIVE STATE they are given (like
   Barnwright's), because dragging an item, changing size and laying out a new
   style all work on the one live design. They read the other items from
   state.items, so the order items are clamped in matters, as it does in
   Barnwright.

   Lifted from Barnwright's 3ddesign.html with its numbers byte for byte:
     itemW         746-751    how much wall an item takes
     clampPos      2293-2397  keep one item legal: inside its wall, clear of
                              its neighbours by two casings, out of the porch
                              notches and the kennel run, gable windows under
                              the roof
     neighborGaps  2399-2416  the tape-measure gaps either side while dragging
     snapCenter    2417-2425  ease an item onto the middle of its free span
     freeSpot      5046-5056  the first free spot on a wall for a new item
     resetItems    1275       the style's standard doors and windows, clamped
     pkFixtures    4651-4673  the fixtures an electrical package places
   What changed: a building is described by a FRAME (model/frame.js frameOf)
   instead of globals; item-code tests became item traits (a transom is
   draw "transom", a shop door draw "shop-door"); the Dog Kennel is the
   "kennel" trait; the electrical fixtures come from the catalogue (their
   defaults are Barnwright's table, in Barnwright's order).

   openingRect(it, plan) is the one new function: the rectangle an opening's
   trim covers on its wall, worked out from renderItem (3122-3236) and
   renderGableWin (3575-3705), so the framing, the drawing and the picking all
   agree on where an opening is. See its own note below.

   gableItemFits(c, frame) (Oct 2026) says whether a gable window's glass
   can stay under the roof anywhere in that building's gable; the designer
   offers only the ones that fit and the server refuses a new one that does
   not. It never moves anything already drawn. */

import { y0, OCT_WIN } from "../engine/constants.js";
import { profileYat, gableClip, gableBandY } from "./roof-shapes.js";
import { standardItems, evalFormula } from "./loadouts.js";
import { doorHeightFt, windowTopFt } from "./construction.js";
import { openingTrim } from "./opening-trim.js";
import { frameOf, porchDepthOf } from "./frame.js";

/* Shared placement remains available from the original public module. */
export { itemW, clampPos } from "./item-placement.js";
import { itemW, clampPos } from "./item-placement.js";

/* KEEP AN ITEM ON ITS WALL WITHOUT PUSHING IT AWAY FROM ITS NEIGHBOURS: the
   bounds half of clampPos (gable windows, benches, shelves and inside lights
   have no neighbour rule, so they get clampPos itself). model/design.js uses
   it when a design is reopened on the same price list it was saved with, so a
   shared link shows every item exactly where it was put. Barnwright's
   applyDesign re-clamped every item in order, which is not a fixed point even
   for a standard layout: on the 12x32 Single Slope the transom row moved
   0.24 ft each time a saved design was opened. */
export function keepOnWall(it, state, frame) {
  var CAT = frame.CAT, c0 = CAT[it.cat], T = frame.t;
  if (c0.free || c0.stretch || c0.gable) { clampPos(it, state, frame); return; }
  if (c0.draw === "transom" && it.rot && T.roof === "slope" && it.wall === "R") it.rot = false;
  var w = frame.ws[it.wall], lim = w.len / 2 - itemW(it, CAT, frame) / 2 - 0.50;
  if (lim < 0) lim = 0;
  if (c0.k === "light") it.vy = Math.max(-4.2, Math.min(3.2, it.vy || 0));
  if (typeof it.pos !== "number" || !isFinite(it.pos)) it.pos = 0;
  it.pos = Math.max(-lim, Math.min(lim, it.pos));
}

export function itemById(state, id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; return null; }

/* nearest solid neighbours left and right of a wall item: the edges the tape
   measure would land on. Electrical never counts as a neighbour. (It measures
   with the catalogue width, not itemW -- a double window's full width is not
   used here, as in Barnwright.) */
export function neighborGaps(it, state, frame) {
  /* DELIBERATE DIFFERENCE (docs/DIFFERENCES.md): Barnwright measured every
     opening here by its catalogue width (c.w), so a DOUBLE window -- two
     windows and a shared middle board, itemW = 2w + CASING -- was measured
     as a single one: the floor plan said 6'-11" where the real gap was
     5'-9", and "ease onto the middle" landed off-centre. Both the item and
     its neighbours are now measured with itemW, the width clampPos already
     spaces them by. Every other opening measures exactly as before. */
  var CAT = frame.CAT;
  var c = CAT[it.cat];
  if (it.rot && c.draw === "transom") c = { k: c.k, w: c.h, h: c.w };
  if (c.gable || c.free || c.stretch || c.k === "post") return null;
  var w = frame.ws[it.wall]; if (!w) return null;
  var cw = itemW(it, CAT, frame);
  var half = w.len / 2, lo = -half, hi = half;
  state.items.forEach(function (o) {
    if (o.id === it.id || o.wall !== it.wall) return;
    var oc = CAT[o.cat];
    if (oc.gable || oc.k === "post" || oc.k === "light" || oc.k === "out" || oc.k === "ilt" || oc.free || oc.stretch) return;
    var ow = itemW(o, CAT, frame);
    if (o.pos <= it.pos) lo = Math.max(lo, o.pos + ow / 2);
    else hi = Math.min(hi, o.pos - ow / 2);
  });
  return { lo: lo, hi: hi, cw: cw, gL: it.pos - cw / 2 - lo, gR: hi - (it.pos + cw / 2) };
}

/* while dragging: ease the item onto the midpoint of its free span */
export function snapCenter(it, state, frame) {
  var g = neighborGaps(it, state, frame); if (!g) return null;
  var mid = (g.lo + g.hi) / 2;
  if (g.hi - g.lo > g.cw + 0.2 && Math.abs(it.pos - mid) < 0.22) { it.pos = mid; g.centered = true; }
  else g.centered = Math.abs(g.gL - g.gR) < 0.045;
  g.gL = Math.max(0, it.pos - g.cw / 2 - g.lo); g.gR = Math.max(0, g.hi - (it.pos + g.cw / 2));
  return g;
}

/* the first spot on a wall, working out from the middle, where an item w wide
   keeps 0.4 ft clear of every other opening (catalogue widths, as Barnwright) */
export function freeSpot(wall, w, state, frame) {
  var CAT = frame.CAT;
  var wd = frame.ws[wall], lim = wd.len / 2 - w / 2 - 0.5;
  for (var p = 0; p <= lim; p += 0.5) {
    var cand = [p, -p];
    for (var ci = 0; ci < 2; ci++) {
      var ok = true;
      state.items.forEach(function (o) { if (o.wall === wall && !CAT[o.cat].gable && Math.abs(cand[ci] - o.pos) < (w + CAT[o.cat].w) / 2 + 0.4) ok = false; });
      if (ok) return cand[ci];
    }
  }
  return 0;
}

/* The style's standard doors and windows for the size in hand, clamped. Like
   Barnwright's resetItems it replaces state.items, clears the selection and
   sets seq. frame must describe the state as it now is (frameOf(state, cat));
   pass null to have it worked out. */
export function resetItems(state, frame, cat) {
  var fr = frame || frameOf(state, cat);
  var d = fr.d;
  state.items = standardItems(fr.t, d.W, d.L, { CAT: fr.CAT, span: fr.span, ws: fr.ws, frame: fr }, state.type);
  state.sel = null;
  state.seq = state.items.length;
  /* The size and porch these included doors and windows came with. A later
     size or porch-length change keeps the items (ui/state.js chooseSize,
     choosePorchLength), so the saved design names this as orig and the
     server allows the included items of that size and porch as well as the
     current one's (server/office/pricing.js), never any other size's. */
  state.laidFor = { size: state.size, pLen: +state.pLen, pMid: !!state.pMid, pFlip: !!state.pFlip };
  /* Owner recipes already settled their untouched builder items before fit
     decisions. A second push-apart pass would undo those decisions. */
  if (fr.t.builderLoadout === undefined) state.items.forEach(function (it) { clampPos(it, state, fr); });
  return state.items;
}

/* The electrical package's fixtures, laid fresh (package pieces are always
   removed and put back, as in Barnwright). The switch + GFCI goes beside the
   biggest door; the rest come from the catalogue's fixture list for that
   package (px/pz/pos are formulas over W and L). The exterior light, when
   chosen, goes 1.2 ft past the switch. */
export function pkFixtures(state, frame, cat) {
  var CAT = frame.CAT;
  state.items = state.items.filter(function (i) { return !i.pk; });
  var p = (state.elec && state.elec.pkg) || 0;
  if (!p) return state.items;
  var d = frame.d;
  function mk(catId, wall, pos, px, pz) {
    var c = CAT[catId];
    if (!c) return;
    var it = { id: "i" + (state.seq++), cat: catId, inc: false, shut: false, pk: true };
    if (c.free) { it.wall = "IN"; it.px = px || 0; it.pz = pz || 0; }
    else { it.wall = wall || "F"; it.pos = pos || 0; }
    clampPos(it, state, frame); state.items.push(it);
  }
  /* switch + GFCI right beside the biggest door */
  var door = state.items.filter(function (i) { var k = CAT[i.cat].k; return k === "door" || k === "ru"; })
    .sort(function (a, b) { return CAT[b.cat].w - CAT[a.cat].w; })[0];
  var dw = door ? door.wall : "F", dp = door ? (door.pos + CAT[door.cat].w / 2 + 1.0) : 1.5;
  if ("FBRL".indexOf(dw) < 0) { dw = "F"; dp = 1.5; }
  var list = (cat && cat.ELECFX && cat.ELECFX[String(p)]) || [];
  var vars = { W: d.W, L: d.L, q: d.L / 4, len: 0, CASING: openingTrim(frame).width, CAT: CAT };
  list.forEach(function (fx) {
    if (fx.at === "besideBiggestDoor") { mk(fx.cat, dw, dp); return; }
    var c = CAT[fx.cat];
    if (!c) return;
    if (c.free) mk(fx.cat, null, null, fx.px == null ? 0 : evalFormula(fx.px, vars), fx.pz == null ? 0 : evalFormula(fx.pz, vars));
    else mk(fx.cat, fx.wall, fx.pos == null ? 0 : evalFormula(fx.pos, vars));
  });
  if (state.elec.ext) mk("light", dw, dp + 1.2);                  /* the exterior light */
  return state.items;
}

/* ----------------------------------------------------------------------------
   openingRect(it, plan): WHERE AN OPENING'S TRIM IS, on its wall.

   Derived line by line from renderItem (3122-3236) and renderGableWin
   (3575-3705). For a door, window, transom or roll-up on a wall it returns
     { wall, plane: "wall", kind, draw,
       u, hw, yb, ch,          centre, half the whole opening (a double window
                               is two sashes and the shared board), bottom and
                               height of the opening
       clear: {u0, u1, y0, y1} the opening itself (what the door or sash fills)
       u0, u1, y0, y1          the outer edges of ALL the trim drawn for it: the
                               side casings, the head board with its 22.5-degree
                               ears, the window sill, and on porch buildings the
                               header band over every non-roll-up opening
       casing: {u0, u1, y0, y1}  the side casings (inner edges 0.02 into the
                               opening), up to the reveal under the head
       head: {u0, u1, y0, y1}  the head board, u0 u1 at its ears (its top)
       sill: {u0, u1, y0, y1} | null   (u0 u1 at its ears, its bottom)
       porchBand: {u0, u1, y0, y1} | null }
   in wall coordinates (u along the wall, y absolute height).

   The height rules are Barnwright's shop rules, now read from the construction
   settings (with Barnwright's numbers as the defaults): shop doors 71 1/2 in on
   gambrel builds and 76 1/2 in otherwise; a window's top 5 in under the wall top
   on gambrel builds, else level with the door head; nothing over the eave on a
   side wall; end-wall doors rise into the gable but finish under the gable
   band; a cottage keeps a full foot between door top and roof.

   For a gable window it returns the same shape with plane "gable" (on the F or
   B gable end, drawn at z = +-L/2 even on a front-porch building) and x0, x1
   in WORLD x, the trim pieces clipped at the roof line exactly as they are
   drawn (clipped: true when the roof cut any of it). u, clear, u0 and u1 are in
   the END WALL's own coordinates like everything else here -- which on the
   back (B) run the other way from world x: Barnwright draws a gable window on
   B at world x = its pos, NOT mirrored as a wall item on B is, so there u is
   -pos. The world-x twins are x (the centre), x0, x1 and clearX. On an R or L
   wall it is a plain wall rectangle. Lights, porch posts and interior items are not
   openings: null. */
export function openingRect(it, plan) {
  var CAT = plan.CAT, t = plan.t, d = plan.d, ws = plan.ws, prof = plan.prof, con = plan.construction;
  var items = plan.state ? plan.state.items : [];
  var c = CAT[it.cat];
  if (!c || c.int) return null;                                        /* interior items live in the floor plan */
  if (it.rot && c.draw === "transom") { c = { k: c.k, n: c.n, w: c.h, h: c.w, p: c.p, sill: c.sill, draw: c.draw }; }   /* transom turned 90 degrees */
  if (c.draw === "shop-door") {
    /* shop door openings: 71 1/2" tall on loft (short-wall) builds, 76 1/2" on tall walls */
    c = { k: c.k, n: c.n, w: c.w, h: doorHeightFt(con, t.roof), p: c.p, sill: c.sill, draw: c.draw };
  }
  if (c.gable) return gableRect(it, c, plan);
  if (c.k === "light" || c.k === "post") return null;
  var w = ws[it.wall];
  if (!w) return null;
  var ch = Math.min(c.h, t.wallH - 0.05);
  if (c.k !== "win" && t.roof === "salt") ch = Math.min(ch, t.wallH - 1.0);            /* cottage: full foot between door top and roof */
  if (c.k !== "win" && it.wall !== "F" && it.wall !== "B") {
    var topHere = (t.roof === "slope" && it.wall === "R") ? y0 + t.wallH : w.top;      /* slope: doors stay under the belt band */
    ch = Math.min(ch, topHere - y0 - 0.42);                                             /* header trim never pokes above the eave */
  }
  if ((it.wall === "F" || it.wall === "B") && c.k !== "win" && t.roof !== "salt") {
    /* doors on the end walls rise into the gable up to the roofline */
    var xc9 = w.cx + w.ax[0] * it.pos;
    var xe9 = Math.min(d.W / 2, Math.max(Math.abs(xc9 - c.w / 2), Math.abs(xc9 + c.w / 2)) + 0.14);
    var cap9 = profileYat(prof, xe9) - y0 - 0.14;
    ch = Math.min(c.h, Math.max(t.wallH - 0.05, cap9));
    /* the header casing (0.30 above the leaf) must finish under the gable band */
    var bY9 = gableBandY(it.wall, plan, items);
    if (bY9 != null) ch = Math.min(ch, bY9 - y0 - 0.34);
  }
  var yb;
  if (c.k === "win") {
    /* shop rule: on loft builds a window top sits 5" under the wall top and
       never higher; on tall walls the window top matches the shop-door
       opening (76 1/2"), so both trims run level around the building */
    var wTop = windowTopFt(con, t.roof, t.wallH);
    yb = Math.max(y0 + 0.25, y0 + wTop - c.h);
  } else yb = y0;
  if (c.k === "win" && t.roof === "slope" && it.wall === "R" && c.draw === "transom") yb = w.top - c.h - 0.50;
  var trim = openingTrim(plan);
  var u = it.pos, fr = trim.width, HW2 = itemW(it, CAT, plan) / 2;   /* HW2 is half the WHOLE opening */
  var isWn = (c.k === "win");
  var revealY = isWn || trim.continuous ? (yb + ch + 0.02) : (yb + ch - 0.06);
  var hE = trim.headFlare, hxl = u - HW2 - fr, hxr = u + HW2 + fr, hyb = yb + ch - 0.02, hyt = hyb + trim.headHeight;
  var u0 = hxl - hE, u1 = hxr + hE, yLo = yb, yHi = hyt;
  var sill = null, band = null;
  if (t.porch && c.k !== "ru" && trim.porchBand) {
    var hby = yb + ch + fr - 0.04, hbh = trim.headHeight, hbe = trim.headFlare;
    band = { u0: u - HW2 - fr - hbe, u1: u + HW2 + fr + hbe, y0: hby, y1: hby + hbh };
    u0 = Math.min(u0, u - HW2 - fr - hbe); u1 = Math.max(u1, u + HW2 + fr + hbe);
    yHi = Math.max(yHi, hby + hbh);
  }
  if (isWn) {
    var syt = yb - 0.02, syb = syt - trim.sillHeight, sE = trim.sillFlare;
    sill = { u0: hxl - sE, u1: hxr + sE, y0: syb, y1: syt };
    u0 = Math.min(u0, hxl - sE); u1 = Math.max(u1, hxr + sE);
    yLo = Math.min(yLo, syb);
  }
  return {
    wall: it.wall, plane: "wall", kind: c.k, draw: c.draw,
    u: u, hw: HW2, yb: yb, ch: ch,
    clear: { u0: u - HW2, u1: u + HW2, y0: yb, y1: yb + ch },
    casing: { u0: hxl, u1: hxr, y0: yb, y1: revealY },
    head: { u0: hxl - hE, u1: hxr + hE, y0: hyb, y1: hyt },
    sill: sill, porchBand: band,
    u0: u0, u1: u1, y0: yLo, y1: yHi,
  };
}

/* A gable window's trim, as renderGableWin draws it. */
function gableRect(it, c, plan) {
  var trim = openingTrim(plan);
  var t = plan.t, d = plan.d, L = d.L, prof = plan.prof;
  var onSide = (it.wall === "R" || it.wall === "L");
  var u = it.pos, yc, gz = 0, sgn = 1, wD = null;
  /* THE 18x24 WEARS ITS TRIM OUTSIDE ITS OWN OPENING -- a head board above and
     a sill below, like every window on a wall. */
  var isG18 = (c.draw === "gable-1824");
  var padX = isG18 ? trim.width + trim.headFlare : 0, padT = isG18 ? trim.headHeight : 0, padB = isG18 ? (trim.measured ? 0.02 + trim.sillHeight : 0.27) : 0;
  if (onSide) {
    wD = plan.ws[it.wall];
    var base = y0 + Math.min(4.6, t.wallH - 1.0);
    yc = base + (it.vy || 0);
    var loS = y0 + 1.0 + c.h / 2 + padB;
    yc = Math.max(loS, Math.min(Math.max(loS, wD.top - 0.30 - c.h / 2 - padT), yc));
  } else {
    gz = (it.wall === "B" ? -L / 2 : L / 2);
    sgn = (it.wall === "B" ? -1 : 1);
    var topY = y0 + t.wallH, peak = profileYat(prof, 0);
    /* an octagon far too big for its gable shrinks to what the gable can take,
       never below about half */
    if (c.draw === "octagon") {
      var room = (peak - topY) - 0.92;
      if (room > 0 && room < c.h) {
        var shrink = Math.max(0.55, room / c.h);
        c = { k: c.k, n: c.n, w: c.w * shrink, h: c.h * shrink, p: c.p, gable: c.gable, draw: c.draw };
      }
    }
    yc = topY + Math.max(0.62 + c.h / 2, (peak - topY) * 0.34) + (it.vy || 0);
    var capG = Math.min(peak - 0.35, profileYat(prof, Math.min(d.W / 2, Math.abs(u) + c.w / 2 + padX)) - 0.22) - c.h / 2 - padT;
    /* THE FLOOR WINS THE ARGUMENT, and the roof line is handled by CUTTING */
    var floorG = topY + 0.14 + c.h / 2 + padB;
    yc = Math.max(floorG, Math.min(Math.max(floorG, capG), yc));
  }
  function gp(du, dy) { return [u + du, yc + dy]; }
  var pieces = [];
  if (c.draw === "faux-loft") {
    var FT = 0.3, hw = c.w / 2, hh = c.h / 2;
    pieces.push([gp(-hw, hh - FT), gp(hw, hh - FT), gp(hw, hh), gp(-hw, hh)]);
    pieces.push([gp(-hw, -hh), gp(hw, -hh), gp(hw, -hh + FT), gp(-hw, -hh + FT)]);
    pieces.push([gp(-hw, -hh + FT), gp(-hw + FT, -hh + FT), gp(-hw + FT, hh - FT), gp(-hw, hh - FT)]);
    pieces.push([gp(hw - FT, -hh + FT), gp(hw, -hh + FT), gp(hw, hh - FT), gp(hw - FT, hh - FT)]);
    var xi = hw - FT, yi = hh - FT, gB = Math.min(0.5, xi * 0.55, yi * 0.75);
    pieces.push([[u - xi, yc + yi - gB], [u - xi + gB, yc + yi], [u - xi, yc + yi]]);
    pieces.push([[u + xi - gB, yc + yi], [u + xi, yc + yi - gB], [u + xi, yc + yi]]);
    pieces.push([[u - xi, yc - yi + gB], [u - xi, yc - yi], [u - xi + gB, yc - yi]]);
    pieces.push([[u + xi, yc - yi + gB], [u + xi - gB, yc - yi], [u + xi, yc - yi]]);
  } else if (c.draw === "octagon") {
    /* the octagonal trim boards go ROUND the 18 inch window, in the trim colour */
    var R = c.w / 2, oct = [];
    for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; oct.push(gp(Math.cos(a) * R, Math.sin(a) * R)); }
    pieces.push(oct);
  } else {
    /* the 18x24: the same casing, head and sill as every other window */
    var HW = c.w / 2, HH = c.h / 2, fr = trim.width, hE = trim.headFlare, sE = trim.sillFlare;
    var headTop = HH - 0.02 + trim.headHeight, sillBottom = -HH - (trim.measured ? 0.02 + trim.sillHeight : 0.25);
    pieces.push([gp(-HW - fr, -HH), gp(-HW + trim.overlap, -HH), gp(-HW + trim.overlap, HH + 0.02), gp(-HW - fr, HH + 0.02)]);
    pieces.push([gp(HW - trim.overlap, -HH), gp(HW + fr, -HH), gp(HW + fr, HH + 0.02), gp(HW - trim.overlap, HH + 0.02)]);
    pieces.push([gp(-HW - fr, HH - 0.02), gp(HW + fr, HH - 0.02), gp(HW + fr + hE, headTop), gp(-HW - fr - hE, headTop)]);
    pieces.push([gp(-HW - fr - sE, sillBottom), gp(HW + fr + sE, sillBottom), gp(HW + fr, -HH - 0.02), gp(-HW - fr, -HH - 0.02)]);
  }
  var full = bbox(pieces);
  var drawn = full, clipped = false;
  if (!onSide) {
    var cutPieces = pieces.map(function (pp) { return gableClip(pp, prof, 0.10); });
    var cut = cutPieces.filter(function (pp) { return pp.length > 2; });
    drawn = bbox(cut);
    clipped = !drawn || Math.abs(drawn.x0 - full.x0) > 1e-12 || Math.abs(drawn.x1 - full.x1) > 1e-12 ||
      Math.abs(drawn.y0 - full.y0) > 1e-12 || Math.abs(drawn.y1 - full.y1) > 1e-12;
    // Equal head/sill flares can keep the same bounding box even after the
    // roof cuts a head corner. Compare the actual polygons for measured trim.
    if (trim.measured && isG18) clipped = clipped || pieces.some(function (pp, i) {
      var cp = cutPieces[i];
      return cp.length !== pp.length || pp.some(function (p, j) { return Math.abs(p[0] - cp[j][0]) > 1e-12 || Math.abs(p[1] - cp[j][1]) > 1e-12; });
    });
  }
  /* the opening itself: the catalogue box, except the octagon, whose 2.3 ft
     catalogue size INCLUDES its trim ring -- the window inside it is OCT_WIN
     (18 in) across, as renderGableWin draws it (Rw = OCT_WIN/2, not scaled
     when a small gable shrinks the ring) */
  var ow = c.draw === "octagon" ? OCT_WIN : c.w, oh = c.draw === "octagon" ? OCT_WIN : c.h;
  var out = {
    wall: it.wall, plane: onSide ? "wall" : "gable", kind: c.k, draw: c.draw,
    u: u, yc: yc, w: c.w, h: c.h,
    clear: { u0: u - ow / 2, u1: u + ow / 2, y0: yc - oh / 2, y1: yc + oh / 2 },
    unclipped: { x0: full.x0, x1: full.x1, y0: full.y0, y1: full.y1 },
    clipped: clipped,
  };
  if (!drawn) { out.u0 = out.u1 = out.y0 = out.y1 = null; return out; }
  out.y0 = drawn.y0; out.y1 = drawn.y1;
  if (onSide) { out.u0 = drawn.x0; out.u1 = drawn.x1; }
  else {
    /* on the gable plane the drawing uses world x; in the end wall's own
       coordinates the back (B) runs the other way */
    out.end = it.wall === "B" ? "B" : "F"; out.z = gz; out.sgn = sgn;
    out.x = u; out.clearX = { x0: out.clear.u0, x1: out.clear.u1 };
    out.x0 = drawn.x0; out.x1 = drawn.x1;
    if (it.wall === "B") {
      out.u = -u; out.clear = { u0: -out.clearX.x1, u1: -out.clearX.x0, y0: out.clear.y0, y1: out.clear.y1 };
      out.u0 = -drawn.x1; out.u1 = -drawn.x0;
    } else { out.u0 = drawn.x0; out.u1 = drawn.x1; }
  }
  return out;
}

/* DOES A GABLE ITEM FIT THIS BUILDING'S GABLE? (Oct 2026, BUILDFAST-SPEC
   E.4.) Put it where the gable is tallest -- under the peak, as far over as
   the designer lets it go -- and as low as the designer lets it go (0.14 ft
   over the wall top, THE FLOOR WINS): it fits when its glass stays under the
   line the drawing cuts at (GABLE_CUT_FT inside the roof). A window that
   does not fit there fits nowhere in that gable, so the designer does not
   offer it ("Too tall for this gable") and the server refuses a new one.
   The faux loft window has no glass (it is trim, cut at the roof line like
   any trim), so it always fits. `fr` is a frame (model/frame.js frameOf) or
   a plan: it needs W, prof, t, d. A building already holding one is drawn
   exactly as before (Barnwright's cut). */
export const GABLE_CUT_FT = 0.10;
export function gableItemFits(c, fr) {
  if (!c || !c.gable || c.draw === "faux-loft") return true;
  var P = fr.prof, apexX = P[0][0], apexY = -Infinity;
  for (var i = 0; i < P.length; i++) if (P[i][1] > apexY + 1e-6) { apexY = P[i][1]; apexX = P[i][0]; }
  var W = fr.W != null ? fr.W : fr.d.W, lim = Math.max(0, W / 2 - c.w / 2 - 0.6);   /* clampPos, a gable end */
  var it = { id: "gable-fit", cat: "", wall: "B", pos: Math.max(-lim, Math.min(lim, apexX)), vy: -1000, inc: false };
  var r = gableRect(it, c, fr);
  return gableGlassOver(r, fr) <= 1e-6;
}
/* May this item go on this wall of this building? Only a gable window that
   does not fit is kept off a gable end (F or B); high on a side wall it
   always fits. -> true, or false ("Too tall for this gable"). */
export function fitsOnWall(c, wall, fr) {
  if (!c || !c.gable || (wall !== "F" && wall !== "B")) return true;
  return gableItemFits(c, fr);
}
/* How far a gable-end item's glass reaches above the line the drawing cuts
   at (feet; below it is negative). Its glass: the clear opening, or the
   18 in octagon window inside the octagon's trim ring. */
export function gableGlassOver(r, fr) {
  if (!r || r.plane !== "gable" || r.draw === "faux-loft") return -Infinity;
  var pts = [];
  if (r.draw === "octagon") {
    var R = OCT_WIN / 2;
    for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4; pts.push([r.x + Math.cos(a) * R, r.yc + Math.sin(a) * R]); }
  } else pts = [[r.clearX.x0, r.clear.y0], [r.clearX.x1, r.clear.y0], [r.clearX.x1, r.clear.y1], [r.clearX.x0, r.clear.y1]];
  var W = fr.W != null ? fr.W : fr.d.W, half = W / 2, over = -Infinity;
  for (var j = 0; j < pts.length; j++) over = Math.max(over, pts[j][1] - (profileYat(fr.prof, Math.max(-half, Math.min(half, pts[j][0]))) - GABLE_CUT_FT));
  return over;
}

function bbox(polys) {
  var b = null;
  polys.forEach(function (pp) {
    pp.forEach(function (p) {
      if (!b) b = { x0: p[0], x1: p[0], y0: p[1], y1: p[1] };
      else { b.x0 = Math.min(b.x0, p[0]); b.x1 = Math.max(b.x1, p[0]); b.y0 = Math.min(b.y0, p[1]); b.y1 = Math.max(b.y1, p[1]); }
    });
  });
  return b;
}
