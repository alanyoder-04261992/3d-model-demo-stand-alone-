/* THE RAMP: a wooden ramp up to the door, when the customer picks one.
   Node-safe. NEW geometry -- Barnwright drew no ramp in 3D (only on its floor
   plan, as a dashed outline).

   WHERE AND HOW LONG, from Barnwright's own floor plan (bpDraw, 3ddesign.html
   4440-4456): "ramp at the biggest door" -- the widest door or roll-up on the
   building -- straight out from that door's wall, 4 ft for the 4 ft ramp and
   6 ft for the 6 ft one; the DIY ramp kit comes with no wood, so nothing is
   drawn for it (Barnwright's RAMPS table, line 768, calls it "DIY kit (no
   wood)"). The
   length is construction.ramp.lengthFt when a ramp option sets it; otherwise
   Barnwright's rule (r4 -> 4, r6 -> 6; any other ramp id with a number in it,
   that number).

   What is drawn is how a shop builds one: pressure-treated stringers (the
   porch joist size, porch.joist) cut to the slope, standing on their edges at
   most floor.spacingIn apart across the width, their top ends against the
   building at the floor line and their toes on the ground, with boards
   across them from the door sill down to the grass -- as wide as the door
   opening. It starts just clear of the door: past the diamond-plate
   threshold the shop screws across every roll-up opening (0.34 ft out,
   parts/openings/roll-up.js), a hair off the siding for any other door.

   A DOOR THAT OPENS ONTO A PORCH (a porch wall, or the front wall of a front
   or corner porch) cannot have a ramp at its sill -- the porch floor is at
   the same height -- so the ramp goes where the porch is entered instead:
   the open gap Barnwright leaves in the railing (the widest gap across the
   front of a front or corner porch; on a side porch, in front of the door,
   where Barnwright draws its wooden step -- the step is still drawn under
   the ramp there, as Barnwright draws it, and the ramp's stringers are
   notched to sit on it (SIDE_STEP); a 4 ft ramp is steep enough that its
   boards touch the step's top corner, about 0.05 ft). Over the ends of the
   skids, which run a little past an end wall, the stringers are notched the
   same way.

   STAGE "ramp" (a finish step): drawn in the finished building only when a
   ramp is chosen, and never by Barnwright, so the golden check leaves it
   out. It uses the porch's natural pressure-treated wood colour ("pwood",
   #96682F, the same paint parts/porch.js makes).

   Barnwright source: new -- Barnwright drew none in 3D. The placement is its
   blueprint's (bpDraw 4440-4456); the ramp option ids and lengths are its
   RAMPS table ("4′ ramp", "6′ ramp", "DIY kit (no wood)"). */

import { y0 } from "../engine/constants.js";
import { texFlat } from "../engine/tex-names.js";
import { railAnchors } from "./porch.js";
import { skidRuns } from "./foundation.js";
import { lumberSize, prismMember, beamMember, framePt, solidEnough, drawPrism, clipRect } from "./floor-frame.js";

/* how far out the ramp starts: past a roll-up's threshold, else a hair off */
export const RAMP_START = Object.freeze({ rollUp: 0.34, other: 0.02 });
/* the boards across the ramp (drawn sizes) */
export const RAMP_BOARD = Object.freeze({ widthIn: 5.5, gapIn: 0.25 });
/* BARNWRIGHT'S SIDE-PORCH STEP, where a side porch's ramp lands (the two
   boxes parts/porch.js porchSideCorner draws at the entry, Barnwright's
   numbers): out from the porch edge x = W/2, up from the ground, 2.6 ft
   along the edge, centred on the entry. The ramp's stringers are notched
   to sit on it, as a shop would set a ramp over a step that is already
   there -- the finished step is Barnwright's and stays. */
export const SIDE_STEP = Object.freeze([
  Object.freeze({ o0: 0.07, o1: 1.49, y0: 0, y1: 0.30, along: 2.6 }),
  Object.freeze({ o0: 0.06, o1: 0.78, y0: 0.30, y1: 0.64, along: 2.6 }),
]);

export function rampLength(plan) {
  var r = plan.state.ramp;
  if (!r || r === "none") return 0;
  var c = plan.construction && plan.construction.ramp;
  if (c && c.lengthFt != null) return +c.lengthFt;
  if (r === "r4") return 4;
  if (r === "r6") return 6;
  var m = /(\d+(?:\.\d+)?)/.exec(String(r));
  return m ? +m[1] : 0;
}

/* The biggest door (Barnwright's blueprint: widest door or roll-up). */
export function rampDoor(plan) {
  var CAT = plan.CAT;
  return plan.state.items.filter(function (i) { var c = CAT[i.cat]; return c && (c.k === "door" || c.k === "ru"); })
    .sort(function (a, b) { return CAT[b.cat].w - CAT[a.cat].w; })[0] || null;
}

/* Where the ramp starts: { w (a wall-like line the ramp runs out from), u
   (its centre along that line), width, start (o of its top end) }. */
export function rampSite(plan) {
  var len = rampLength(plan), door = rampDoor(plan);
  if (!(len > 0) || !door) return null;
  var t = plan.t, W = plan.W, L = plan.L, ws = plan.ws, c = plan.CAT[door.cat];
  var width = c.w;
  var onPorch = /^[SP]\d$/.test(door.wall) || (door.wall === "F" && (t.porch === "F" || t.porch === "C"));
  if (!onPorch) {
    var w = ws[door.wall];
    if (!w) return null;
    return { w: w, u: door.pos, width: width, start: c.k === "ru" ? RAMP_START.rollUp : RAMP_START.other, len: len, door: door.id, porch: false };
  }
  if (t.porch === "S") {
    /* in front of the porch door (Barnwright's porchSideCorner entryZ) */
    var sp = plan.span, a = sp.mid ? [sp.z0 + 0.28, sp.z1 - 0.28] : [(sp.f ? sp.z1 - 0.28 : sp.z0 + 0.28), (sp.f ? -L / 2 : L / 2) - (sp.f ? -1 : 1) * 0.28];
    plan.state.items.forEach(function (o) { if (plan.CAT[o.cat].k === "post" && o.wall === "R") a.push(-o.pos); });
    a.sort(function (x, y) { return x - y; });
    var entryZ = null;
    plan.state.items.forEach(function (o) { if (entryZ === null && o.wall === "S1" && plan.CAT[o.cat].k === "door") entryZ = (sp.z0 + sp.z1) / 2 - o.pos; });
    if (entryZ === null) { var gi = 0, gw = -1; for (var g = 0; g < a.length - 1; g++) if (a[g + 1] - a[g] > gw) { gw = a[g + 1] - a[g]; gi = g; } entryZ = (a[gi] + a[gi + 1]) / 2; }
    var wS = { ax: [0, 0, -1], n: [1, 0, 0], at: W / 2, cx: 0 };
    return { w: wS, u: -entryZ, width: width, start: RAMP_START.other, len: len, door: door.id, porch: true, step: true };
  }
  /* front or corner porch: the widest gap across the front edge */
  var C = W / 2 - 0.28, posts = [];
  plan.state.items.forEach(function (o) { if (plan.CAT[o.cat].k === "post" && o.wall === "F") posts.push(o.pos); });
  var r = railAnchors(C, posts), mid = (r.a[r.gi] + r.a[r.gi + 1]) / 2;
  width = Math.min(width, (r.a[r.gi + 1] - r.a[r.gi]) - 0.34 - 0.32);
  var wF = { ax: [1, 0, 0], n: [0, 0, 1], at: L / 2, cx: 0 };
  return { w: wF, u: mid, width: width, start: RAMP_START.other, len: len, door: door.id, porch: true };
}

export function rampMembers(plan) {
  var S = rampSite(plan);
  if (!S || !(S.width > 0.5)) return [];
  var out = [], w = S.w;
  var con = plan.construction || {};
  var str = lumberSize((con.porch && con.porch.joist) || "2x6");
  var board = lumberSize("2x6");
  var s = ((con.floor && con.floor.spacingIn) || 16) / 12;
  var bt = board.t, sd = str.d, st = str.t;
  var o0 = S.start, run = S.len, rise = y0;                 /* the deck top falls from y0 at the building to the ground */
  var slope = rise / run, cl = Math.hypot(run, rise);
  var dn = [-rise / cl, run / cl];                          /* (o, y) unit normal to the deck, pointing up */
  var sdv = sd * cl / run;                                  /* the stringer's depth measured plumb */
  var ax = [w.ax[0], w.ax[1], w.ax[2]], n = [w.n[0], w.n[1], w.n[2]];
  /* stringers: the deck's underside line from the building down to the
     ground, and a line one stringer deep below it cut off level at the ground */
  var topU = y0 - bt * cl / run;                            /* the boards' underside, measured plumb at the building */
  var toeO = topU / slope;                                  /* where the underside meets the ground */
  var cutO = Math.max(0, (topU - sdv) / slope);
  var poly = [[0, topU], [toeO, 0], [cutO, 0], [0, Math.max(0, topU - sdv)]];
  if (topU - sdv <= 0) poly = [[0, topU], [toeO, 0], [0, 0]];
  var nS = Math.max(2, Math.ceil((S.width - st) / s) + 1);
  /* what the stringers sit over, notched to it: on a side porch
     Barnwright's step; at an end wall the ends of the skids, which run a
     little past the wall (parts/skids.js). A stringer is kept only above
     them. (u0 u1 along the ramp's wall line, a0 a1 out from its start.) */
  var step = S.step ? SIDE_STEP.map(function (b) { return { a0: b.o0 - o0, a1: b.o1 - o0, y1: b.y1, u0: S.u - b.along / 2, u1: S.u + b.along / 2 }; }) : [];
  if (Math.abs(w.n[2]) > 0.5 && Math.abs(Math.abs(w.at) - plan.L / 2) < 1e-9) {
    skidRuns(plan).forEach(function (sk) {
      var out2 = w.n[2] > 0 ? sk.z1 - plan.L / 2 : -plan.L / 2 - sk.z0;     /* how far the skid runs past the wall */
      if (!(out2 - o0 > 1e-9)) return;
      var ua = (sk.x0 - (w.cx || 0)) / w.ax[0], ub = (sk.x1 - (w.cx || 0)) / w.ax[0];
      step.push({ a0: -1, a1: out2 - o0, y1: sk.y1, u0: Math.min(ua, ub), u1: Math.max(ua, ub) });
    });
  }
  for (var i = 0; i < nS; i++) {
    var uc = S.u - S.width / 2 + st / 2 + (S.width - st) * i / (nS - 1);
    var org = framePt(w, uc - st / 2, 0, o0);
    var over = step.filter(function (b) { return uc + st / 2 > b.u0 + 1e-9 && uc - st / 2 < b.u1 - 1e-9; });
    var pieces = [poly];
    if (over.length) {
      /* cut along the step's edges, keep each strip above the step there */
      var cuts = [0, toeO + 1];
      over.forEach(function (b) { cuts.push(b.a0, b.a1); });
      cuts = cuts.filter(function (c, k) { return cuts.indexOf(c) === k; }).sort(function (x, y) { return x - y; });
      pieces = [];
      for (var c = 0; c + 1 < cuts.length; c++) {
        var ma = (cuts[c] + cuts[c + 1]) / 2, floorY = 0;
        over.forEach(function (b) { if (ma > b.a0 && ma < b.a1) floorY = Math.max(floorY, b.y1); });
        var P = clipRect(poly, cuts[c], cuts[c + 1], floorY, y0 + 1);
        if (P.length) pieces.push(P);
      }
    }
    pieces.forEach(function (P, k) {
      out.push(prismMember("stringer", "pwood", P.map(function (p) { return p.slice(); }), org, n, [0, 1, 0], ax, st, { n: i, piece: k, notched: over.length > 0, size: str.nominal }));
    });
  }
  /* boards across the stringers, from the top down */
  var bw = RAMP_BOARD.widthIn / 12, gap = RAMP_BOARD.gapIn / 12;
  for (var sAlong = 0, k = 0; sAlong < cl - 0.05; sAlong += bw + gap, k++) {
    var wid = Math.min(bw, cl - sAlong);
    var mid = sAlong + wid / 2;
    /* the board's centre: on the top line at `mid` down the slope, then half a board in along the deck's normal */
    var oc = o0 + mid * run / cl - dn[0] * bt / 2, yc = y0 - mid * rise / cl - dn[1] * bt / 2;
    var up = [n[0] * dn[0], dn[1], n[2] * dn[0]];
    var p0 = framePt(w, S.u - S.width / 2, 0, 0), p1 = framePt(w, S.u + S.width / 2, 0, 0);
    var off = [n[0] * oc, yc, n[2] * oc];
    out.push(beamMember("ramp-board", "pwood", [p0[0] + off[0], off[1], p0[2] + off[2]], [p1[0] + off[0], off[1], p1[2] + off[2]], wid, bt, up, { n: k }));
  }
  out.forEach(function (m) { m.stage = "ramp"; });
  return out;
}

export default {
  id: "ramp",
  name: "Ramp",
  stage: "ramp",
  realLife: "A pressure-treated wood ramp up to the biggest door, as long as the ramp chosen: {porch.joist} stringers cut to the slope from the floor line down to the ground, at most {floor.spacingIn} in apart, with boards across them as wide as the door (at the porch entry when that door opens onto the porch). The DIY kit comes with no wood and is not drawn.",
  appliesTo(plan) { return rampLength(plan) > 0 && !!rampDoor(plan); },
  members: rampMembers,
  build(plan, kit) {
    kit.setStage("ramp");
    var mW = kit.mat("pwood", texFlat, "#96682F", 0.05, 12);
    rampMembers(plan).forEach(function (m) {
      if (!solidEnough(m)) return;
      if (m.shape === "beam") kit.beam(mW, m.p0, m.p1, m.w, m.d, m.up);
      else drawPrism(kit, mW, m);
    });
  },
};
