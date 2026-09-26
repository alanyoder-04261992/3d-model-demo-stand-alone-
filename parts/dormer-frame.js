/* DORMER FRAMING: the frame of the Dormer Shed's dormer. Node-safe.

   NEW -- Barnwright drew none. The dormer part (parts/dormer.js, Barnwright's
   dormer()) draws a shed dormer standing up out of the main roof on the door
   (+x) side: an upright front wall just in from the eave with its windows,
   two triangular cheeks down to the main roof, and a shallow single-slope
   roof rising back to tie in just under the ridge. This part frames exactly
   that box, from the same numbers (roof-frame dormerGeom), the way a shed
   dormer is built:
   * the MAIN TRUSSES ARE CUT where the dormer opens (parts/roof-frame.js
     takes their +x top chords out between the two headers; the trusses
     either side, the trimmers, stay whole and carry the headers);
   * an UPPER HEADER -- a doubled {roof.chord} -- across the opening near the
     ridge, where the cut chords end and the dormer rafters bear;
   * the FRONT WALL: a doubled sill header across the opening on the main
     wall's line, a bottom plate, {walls.stud} studs every {walls.spacingIn}
     in on centre, a doubled top plate, and each window framed with king
     studs, a sill and -- where there is room under the plates -- a header
     (otherwise the doubled top plate spans it);
   * a CHEEK WALL each side: a bottom plate lying on the main roof deck along
     the slope, a top plate under the outermost dormer rafter, and studs
     between, from the front wall back as far as the cheek has height;
   * DORMER RAFTERS ({roof.chord}, every {roof.spacingIn} in on centre, the
     outer ones flush inside the cheeks) from the upper header down over the
     front wall with a seat cut, their tails run out under the front overhang
     and cut off level with the soffit;
   * the dormer's own ROOF DECK (stage "roof-deck"), the same kind as the main
     roof's (roofDeck.type), over the dormer and out over its overhangs where
     they clear the main roof's steel.
   The main roof deck is left open under the dormer (roof-frame dormerHoles).

   HOW IT FITS THE DRAWN DORMER: everything stays inside the dormer as drawn
   -- under the dormer roof's underside, inside its front siding and between
   its cheek siding -- or inside the main roof's own volume. The drawn dormer
   roof meets the top of the drawn face in a corner (as the main roof meets a
   wall), so the rafters sit on the front wall with a seat cut and their tails
   are only as deep as the space between the soffit and the roof.

   STAGES "dormer-frame" (the framing) and "roof-deck" (its sheathing or
   purlins): hidden in the Finished view, shown in the Framing view; in
   Watch-it-build the framing lands after the roof framing, and the roofing
   covers both. PIPELINE entry "dormer-frame" (parts/index.js), among the
   framing entries. Only on a style with the dormer trait, with a dormer
   chosen. */

import { pickRule } from "../model/construction.js";
import { ROOF_TH } from "../model/roof-shapes.js";
import {
  trussLayout, band, offY, above, below, clipAll, clipHalf, cleanPoly, rectPoly, lumberFt, drawMembers,
} from "./roof-frame.js";
import { deckOnSection } from "./roof-deck.js";

/* The dormer roof as a one-slope roof section (for band / offY), from the tie
   in at xI to the tip of its front overhang. */
export function dormerSection(dg, sec) {
  var A = [dg.xI, dg.roofY(dg.xI)], B = [dg.xF + dg.ovF, dg.roofY(dg.xF + dg.ovF)];
  var dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy), tx = dx / len, ty = dy / len;
  return {
    W: sec.W, L: sec.L, P: [A, B], ov: 0,
    segs: [{ i: 0, A: A, B: B, len: len, t: [tx, ty], n: [ty, -tx], upper: false }],
  };
}

/* Which main-roof slope the dormer stands on (the one under the middle of it). */
function slopeUnder(sec, dg) {
  var xm = (dg.xI + dg.xF) / 2;
  for (var i = 0; i < sec.segs.length; i++) if (xm >= sec.segs[i].A[0] && xm <= sec.segs[i].B[0]) return i;
  return sec.segs.length - 1;
}

export function dormerFrameMembers(plan) {
  var lay = trussLayout(plan), dg = lay.dormer;
  if (!dg) return [];
  var sec = lay.sec, topY = plan.topY, con = plan.construction || {};
  var st = sec.stud.t, sd = sec.stud.d, ct = sec.chord.t, cd = sec.chord.d, dT = sec.deckT;
  var sw = ((con.walls && con.walls.spacingIn != null) ? +con.walls.spacingIn : 16) / 12;
  var dsec = dormerSection(dg, sec), iR = slopeUnder(sec, dg);
  var hw = dg.hw, zw = hw - 0.02, zi = hw - 0.02 - sd;
  var out = [];
  function add(poly, z0, z1, kind, mat, stage) {
    var p = cleanPoly(poly);
    if (!p) return;
    out.push({ poly: p, z0: Math.min(z0, z1), z1: Math.max(z0, z1), kind: kind, mat: mat || "lumber", stage: stage || "dormer-frame" });
  }
  function height(p) { var a = Infinity, b = -Infinity; (p || []).forEach(function (q) { a = Math.min(a, q[1]); b = Math.max(b, q[1]); }); return b - a; }

  /* ---- the upper header, between the trimmers ---- */
  var yh1 = offY(dsec, 0, dT + cd, dg.hx1), yh0 = yh1 - cd;
  add(rectPoly(dg.hx0, yh0, dg.hx1, yh1), lay.trimFace.minus, lay.trimFace.plus, "dormer-header");

  /* ---- the front wall ---- */
  /* each window's rough opening: the glass and its white frame (0.10 all
     round, as parts/dormer.js draws it); a dormer too small for its windows
     (never offered) gets none framed */
  var ros = dg.wins.map(function (w) {
    return { z0: w.zc - w.ww / 2 - 0.10, z1: w.zc + w.ww / 2 + 0.10, y0: w.yw - 0.10, y1: w.yw + w.wh + 0.10 };
  });
  var roomy = ros.every(function (r, i) {
    var next = ros[i + 1];
    return r.z1 - r.z0 > 0.3 && r.y1 - r.y0 > 0.3 && r.z0 - st > -zw + st && r.z1 + st < zw - st && (!next || next.z1 + st < r.z0 - st - 0.005 || r.z1 + st < next.z0 - st - 0.005);
  });
  if (!roomy) ros = [];
  var roTop = ros.reduce(function (m, r) { return Math.max(m, r.y1); }, -Infinity);
  var yfw = Math.min(dg.yT - 0.02, Math.max(offY(dsec, 0, dT + cd, dg.xFi), roTop + 2 * st));
  var yb = topY + 3 * st, yt = yfw - 2 * st;
  var xa = dg.xFi, xb = dg.xFw;
  add(rectPoly(xa, topY, xb, topY + 2 * st), -zw, zw, "dormer-sill-header");
  add(rectPoly(xa, topY + 2 * st, xb, yb), -zw, zw, "bottom-plate");
  add(rectPoly(xa, yt, xb, yt + st), -zw, zw, "top-plate");
  add(rectPoly(xa, yt + st, xb, yfw), -zw, zw, "top-plate");
  var frames = ros.map(function (r) { return { z0: r.z0 - st, z1: r.z1 + st }; });
  function inFrame(z) { return frames.some(function (f) { return z + st / 2 > f.z0 - 1e-6 && z - st / 2 < f.z1 + 1e-6; }); }
  var grid = [];
  for (var z = -zw + st / 2; z <= zw - st / 2 + 1e-9; z += sw) grid.push(z);
  if (zw - st / 2 - grid[grid.length - 1] > st + 0.01) grid.push(zw - st / 2);
  grid.forEach(function (z) { if (!inFrame(z)) add(rectPoly(xa, yb, xb, yt), z - st / 2, z + st / 2, "stud"); });
  ros.forEach(function (r) {
    add(rectPoly(xa, yb, xb, yt), r.z0 - st, r.z0, "king");
    add(rectPoly(xa, yb, xb, yt), r.z1, r.z1 + st, "king");
    var hdName = pickRule((con.walls && con.walls.header) || "2x6 doubled", { spanFt: r.z1 - r.z0 });
    var hd = lumberFt(hdName).d;
    var hTop = r.y1 + hd;
    if (hTop <= yt - 1e-6) {
      add(rectPoly(xa, r.y1, xb, hTop), r.z0, r.z1, "header");
      grid.forEach(function (z) { if (z - st / 2 > r.z0 + 1e-6 && z + st / 2 < r.z1 - 1e-6 && yt - hTop >= 0.05) add(rectPoly(xa, hTop, xb, yt), z - st / 2, z + st / 2, "cripple"); });
    } else if (yt - r.y1 >= 0.05) {
      /* no room for a header: the doubled top plate spans the window, with a
         short cripple over it where there is room */
      grid.forEach(function (z) { if (z - st / 2 > r.z0 + 1e-6 && z + st / 2 < r.z1 - 1e-6) add(rectPoly(xa, r.y1, xb, yt), z - st / 2, z + st / 2, "cripple"); });
    }
    if (r.y0 - st >= yb + 1e-6) {
      add(rectPoly(xa, r.y0 - st, xb, r.y0), r.z0, r.z1, "sill");
      grid.forEach(function (z) { if (z - st / 2 > r.z0 + 1e-6 && z + st / 2 < r.z1 - 1e-6 && r.y0 - st - yb >= 0.05) add(rectPoly(xa, yb, xb, r.y0 - st), z - st / 2, z + st / 2, "cripple"); });
    }
  });

  /* ---- the cheek walls ---- */
  /* the cheek has room where the top plate's underside is 0.1 ft or more
     above the bottom plate's top; both lines are straight, so solve it */
  function gap(x) { return offY(dsec, 0, dT + cd + st, x) - offY(sec, iR, -st, x); }
  var g0 = gap(0), g1 = gap(1), xc0 = g1 !== g0 ? (0.1 - g0) / (g1 - g0) : Infinity;
  xc0 = Math.max(xc0, dg.hx1 + 0.001);
  var cheekTop = below(dsec, 0, dT + cd + st), cheekBot = above(sec, iR, -st);
  if (xc0 < xa - st - 0.05) {
    [-1, 1].forEach(function (sg) {
      var c0 = sg > 0 ? zi : -zw, c1 = sg > 0 ? zw : -zi;
      var span = [[-1, 0, -xc0], [1, 0, xa]];
      add(clipAll(band(sec, iR, -st, 0), span), c0, c1, "cheek-bottom-plate");
      add(clipAll(band(dsec, 0, dT + cd, dT + cd + st), span), c0, c1, "cheek-top-plate");
      for (var x = xa - st / 2; x - st / 2 >= xc0 - 1e-9; x -= sw) {
        var p = cleanPoly(clipAll(rectPoly(x - st / 2, topY, x + st / 2, dg.yI + 5), [cheekTop, cheekBot]));
        if (p && height(p) >= 0.1) add(p, c0, c1, "cheek-stud");
      }
    });
  }

  /* ---- the dormer rafters ---- */
  var rz = [], zr0 = -zw + ct / 2, zr1 = zw - ct / 2;
  for (var q = 0; zr0 + q * sec.spacing <= zr1 + 1e-9; q++) rz.push(zr0 + q * sec.spacing);
  if (zr1 - rz[rz.length - 1] > ct + 0.01) rz.push(zr1);
  var soffitAbove = (function () {
    var a = [dg.xF, dg.yT - 0.02], b = [dg.xF + dg.ovF, dg.yF - 0.15];
    var nx = -(b[1] - a[1]), ny = b[0] - a[0];                  /* up and outward */
    if (ny < 0) { nx = -nx; ny = -ny; }
    return [-nx, -ny, -(nx * a[0] + ny * a[1])];                 /* keep the side above the soffit */
  })();
  rz.forEach(function (zc) {
    var r = band(dsec, 0, dT, dT + cd);
    var outer = zc + ct / 2 > zi + 1e-9 || zc - ct / 2 < -zi - 1e-9;   /* over a cheek wall */
    var extra = outer ? [cheekBot] : [];
    var pieces = [
      clipAll(r, [[-1, 0, -dg.hx0], [1, 0, dg.hx1], [0, -1, -yh1]].concat(extra)),
      clipAll(r, [[-1, 0, -dg.hx1], [1, 0, xa]].concat(extra)),
      clipAll(r, [[-1, 0, -xa], [1, 0, dg.xF], [0, -1, -yfw]].concat(extra)),
      clipAll(r, [[-1, 0, -dg.xF], [1, 0, dg.xF + dg.ovF], soffitAbove].concat(extra)),
    ];
    pieces.forEach(function (p) { add(p, zc - ct / 2, zc + ct / 2, "dormer-rafter"); });
  });

  /* ---- the dormer's roof deck (stage roof-deck) ---- */
  var purl = lumberFt(((con.roofDeck || {}).purlins || {}).size || "2x4");
  var pSp = ((((con.roofDeck || {}).purlins || {}).spacingIn) || 24) / 12;
  function deck(zr, fit) {
    deckOnSection(dsec, { type: sec.deckType, d: dT, pw: purl.d, spacing: pSp, zRange: function () { return zr; }, fit: fit })
      .forEach(function (m) { add(m.poly, m.z0, m.z1, m.kind, m.mat, "roof-deck"); });
  }
  /* never down into the main roof's own deck (a dormer purlin at the tie-in
     would otherwise reach under the main roof line) */
  var overMain = above(sec, iR, 0);
  deck([-hw, hw], function (p) { var c = cleanPoly(clipHalf(p, overMain)); return c ? [c] : []; });
  /* over the side overhangs only where the deck's underside clears the top of
     the main roof's steel (ROOF_TH above its underside); both lines are
     straight, so solve for where that starts */
  function h(x) { return offY(dsec, 0, dT, x) - (offY(sec, iR, 0, x) + ROOF_TH + 0.005); }
  var a0 = h(0), a1 = h(1), xs = a1 !== a0 ? -a0 / (a1 - a0) : Infinity;
  xs = Math.max(xs, dg.xI);
  if (xs < dg.xF + dg.ovF - 0.05) {
    var fitSide = function (p) { var c = cleanPoly(clipAll(p, [[-1, 0, -xs], overMain])); return c ? [c] : []; };
    deck([hw, hw + dg.ovS], fitSide);
    deck([-hw - dg.ovS, -hw], fitSide);
  }
  return out;
}

export default {
  id: "dormer-frame",
  name: "Dormer framing",
  stage: ["dormer-frame", "roof-deck"],
  realLife: "The dormer's framing: the main roof trusses cut where the dormer opens and headed off with a doubled {roof.chord} header near the ridge; a {walls.stud} front wall on a sill header with its windows framed, {walls.stud} cheek walls down to the main roof, and {roof.chord} dormer rafters every {roof.spacingIn} in on centre with their tails cut level for the soffit, under the dormer's own roof deck.",
  appliesTo(plan) { return !!plan.t.dormer && plan.state.dormer !== "none"; },
  members(plan) { return dormerFrameMembers(plan); },
  build(plan, kit) {
    var list = dormerFrameMembers(plan);
    kit.setStage("dormer-frame");
    drawMembers(kit, list.filter(function (m) { return m.stage === "dormer-frame"; }));
    kit.setStage("roof-deck");
    drawMembers(kit, list.filter(function (m) { return m.stage === "roof-deck"; }));
  },
};
