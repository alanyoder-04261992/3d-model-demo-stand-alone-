/* THE WALL FRAMING: studs, plates, and the framing round every door and
   window. Node-safe. NEW geometry -- Barnwright drew none (its walls are one
   flat face of siding each, parts/siding.js).

   In real life every wall is studs standing on a bottom plate nailed to the
   floor, with (usually) two top plates on them, the studs walls.spacingIn on
   centre measured from the corner so the 4 ft siding sheets land on studs.
   The shop's note (Barnwright 2150-2152, kept word for word): "Walls: studs on
   a bottom plate with two top plates; loft ("short wall") studs are 75" for
   about a 6.63 ft wall, tall-wall (UTX) studs are 89" for about 7.79 ft. A 2x4
   really measures 1 1/2" x 3 1/2"."

   AT A CORNER one wall runs through and the other butts into it. The walls
   across the width (F, B, and the porch walls S2, S3, P3) run through; the
   long walls (R, L, S1, P2) butt between them; the angled corner-porch wall
   P1 always butts. A "3-stud" corner (walls.corner) is the through wall's last
   two studs side by side and the butting wall's end stud against them. At an
   inside corner (a porch notch) the through wall runs on past the corner to
   the far face of the butting wall's frame.

   AT EVERY DOOR AND WINDOW (the rectangle model/layout.js openingRect gives,
   the same one the finished trim is drawn round -- its clear opening IS the
   shop's rough opening: the 36 in door opens 37 1/4 in, the 48 in opens
   48 1/4 in, the double opens 76 in): a JACK stud each side carrying a HEADER
   over the opening, a full-height KING stud outside each jack, CRIPPLES
   between the header and the top plates, and under a window a flat rough SILL
   on cripples. The header is sized by the walls.header rule for the opening's
   width. The bottom plate is cut out across a door. A double window gets a
   doubled mullion under its shared middle board. Where the header the rule
   asks for does not fit under the top plates (a door on a short loft wall),
   the next size that fits is used, down to a flat 2x, and where not even that
   fits the top plates themselves span the opening; a header that would leave
   less than a cripple's worth under the plates goes up tight under them
   (CRIPPLE_MIN). An opening wider than its wall's frame is framed only as
   wide as the wall allows. A door that reaches up
   THROUGH the top plates -- on a gable end, as Barnwright draws it: "doors on
   the end walls rise into the gable up to the roofline" (the Standard Barn's
   4.2 ft walls) -- has the top plates cut across it and its jacks and kings
   stop under them; its header is in the gable, framed by the gable framing
   (parts/gable-frame.js, from parts/roof-frame.js gableOpenings), which
   stands its kings on this wall's top plate.

   Studs never cross a door or window: a layout stud that falls in one
   becomes cripples above the header and below the sill; a king or stud that
   would cross another opening (a transom row over a door on the single
   slope) is cut short round it.

   WHICH WALLS: every wall in plan.ws that carries siding, cut the way the
   siding is cut round a porch (parts/siding.js): F B R L, the side porch's
   S1 S2 (S3), the corner porch's P1 P2 P3. The high side wall of a lean-to
   or single slope is taller (w.top), and its top plates stop under the roof
   line at the wall's inside face. THE DOG KENNEL: the enclosed back half is
   framed (B, the back halves of R and L, and the partition facing the run,
   with a framed opening for each doggie door); the open run is framed as a
   post-and-beam: 4x4 posts at the front corners and the middle, a header
   over the front and down each side, and top plates on them, carried at the
   back by a post against the partition.

   WHERE IT SITS (docs/ARCHITECTURE.md Framing datums 2): the bottom plate on
   y0; the top of the upper top plate at the wall top; the studs inside the
   siding plane, o from -0.02 to -0.02 - the stud's depth.

   Barnwright source: new -- Barnwright drew none. It fits behind the siding
   (parts/siding.js, Barnwright 3878-3905), round the openings renderItem draws
   (3122-3236; the door and window heights are the shop rules in
   plan.construction.openings), and under the roof profile (roofProfile
   2159-2175). */

import { y0, CASING } from "../engine/constants.js";
import { openingRect } from "../model/layout.js";
import { profileYat } from "../model/roof-shapes.js";
import { pickRule } from "../model/construction.js";
import { sidingWalls } from "./siding.js";
import { gableOpenings } from "./roof-frame.js";
import { lumberSize, WALL_INSET, PARTITION_INSET, wallMember, drawMembers, framePt } from "./floor-frame.js";

/* The header sizes tried, deepest first, when the rule's size does not fit. */
export const HEADER_FALLBACK = Object.freeze(["2x12", "2x10", "2x8", "2x6", "2x4"]);
/* The shortest cripple worth cutting (0.6 in). A header that would leave a
   gap smaller than this under the top plates (or under a window framed above
   it) is set tight up against them instead, the way a framer nails a header
   up under the plate and shims the opening -- never left hanging a fraction
   of an inch below what it carries. */
export const CRIPPLE_MIN = 0.05;

/* The wall construction settings, in feet. */
export function wallSpec(plan) {
  var w = (plan.construction && plan.construction.walls) || {};
  var stud = lumberSize(w.stud || "2x4");
  var corner = parseInt(String(w.corner == null ? "3-stud" : w.corner), 10);
  return {
    stud: stud, sw: stud.t, D: stud.d,
    spacing: (w.spacingIn != null ? +w.spacingIn : 16) / 12,
    nb: Math.max(0, Math.round(w.bottomPlates != null ? +w.bottomPlates : 1)),
    nt: Math.max(0, Math.round(w.topPlates != null ? +w.topPlates : 2)),
    plateT: stud.t,
    cornerStuds: isFinite(corner) && corner >= 2 ? corner : 3,
    header: w.header || [{ value: "2x6 doubled" }],
  };
}

/* The kennel's partition between the room and the run, as a wall (it is
   drawn by parts/kennel.js kennelExtras at z = L/2 - RD = 0). */
export function kennelPartition(plan) {
  return { ax: [1, 0, 0], n: [0, 0, 1], at: 0, cx: 0, top: plan.topY, len: plan.W };
}

/* Every framed run of wall: { key, w, a, b (the siding span in u), inset }.
   The spans are the siding's own (parts/siding.js), so a frame never stands
   where Barnwright draws no wall. */
export function wallRuns(plan) {
  var t = plan.t, ws = plan.ws, sp = plan.span, runs = [];
  function add(key, w, a, b, inset) { if (b - a > 1e-9) runs.push({ key: key, w: w, a: a, b: b, inset: inset || WALL_INSET }); }
  if (t.kennel) {
    add("B", ws.B, -ws.B.len / 2, ws.B.len / 2);
    add("R", ws.R, 0, ws.R.len / 2);
    add("L", ws.L, -ws.L.len / 2, 0);
    add("KP", kennelPartition(plan), -plan.W / 2, plan.W / 2, PARTITION_INSET);
  } else {
    sidingWalls(plan).forEach(function (k) {
      var w = ws[k], half = w.len / 2;
      if (t.porch === "S" && k === "R") {
        if (sp.mid) { add("R", w, -half, -sp.z1); add("R", w, -sp.z0, half); return; }
        if (sp.f) add("R", w, -half, half - sp.P); else add("R", w, -half + sp.P, half);
        return;
      }
      if (t.porch === "S" && k === "F" && !sp.f && !sp.mid) { add("F", w, -half, half - 4); return; }
      if (t.porch === "S" && k === "B" && sp.f) { add("B", w, -half + 4, half); return; }
      if (t.porch === "C" && k === "F") { add("F", w, -half, -half + 4); return; }
      if (t.porch === "C" && k === "R") { add("R", w, -half + 12, half); return; }
      if (t.porch === "C" && k === "L") { add("L", w, -half, half - 4); return; }
      add(k, w, -half, half);
    });
  }
  var sp2 = wallSpec(plan);
  runs.forEach(function (r, i) { r.index = i; r.D = sp2.D; });
  runs.forEach(function (r) { r.ends = [endOf(r, 0, runs), endOf(r, 1, runs)]; r.fu0 = r.a + r.ends[0].s; r.fu1 = r.b - r.ends[1].s; });
  return runs;
}

function v2(a) { return [a[0], a[2]]; }
function endPt(r, e) { var p = framePt(r.w, e ? r.b : r.a, 0, 0); return [p[0], p[2]]; }
function awayDir(r, e) { var ax = v2(r.w.ax); return e ? [-ax[0], -ax[1]] : ax; }
function axisAligned(r) { return Math.abs(r.w.ax[0]) < 1e-9 || Math.abs(r.w.ax[2]) < 1e-9; }
function acrossWidth(r) { return Math.abs(r.w.ax[2]) < 1e-9; }
/* How a run's frame ends at one end: s is how far the frame end stands in
   from the siding end (negative: it runs on past it, at an inside corner). */
function endOf(r, e, runs) {
  var P = endPt(r, e);
  for (var i = 0; i < runs.length; i++) {
    var q = runs[i];
    if (q === r) continue;
    for (var f = 0; f < 2; f++) {
      var Q = endPt(q, f);
      if (Math.hypot(P[0] - Q[0], P[1] - Q[1]) > 1e-6) continue;
      var through = !axisAligned(r) ? false : !axisAligned(q) ? true : (acrossWidth(r) && !acrossWidth(q));
      var dr = awayDir(r, e), dq = awayDir(q, f), nr = v2(r.w.n), nq = v2(q.w.n);
      var convex = ((dr[0] + dq[0]) * -nr[0] + (dr[1] + dq[1]) * -nr[1]) > 0;
      var target = convex ? (through ? q.inset : q.inset + q.D) : (through ? q.inset + q.D : q.inset);
      var den = -(dr[0] * nq[0] + dr[1] * nq[1]), nn = nr[0] * nq[0] + nr[1] * nq[1];
      var s = -1e9;
      [r.inset, r.inset + r.D].forEach(function (qq) { s = Math.max(s, (target - qq * nn) / den); });
      return { s: s, corner: true, through: through, convex: convex, other: q.key, otherIndex: q.index };
    }
  }
  return { s: r.inset, corner: false };
}

/* The top of a run's upper top plate: the wall top, except that the high side
   wall of a lean-to or single slope stops under the roof line at its inside
   face (the roof slopes down across the plate). */
export function runTop(plan, run) {
  var top = run.w.top;
  if (top > plan.topY + 1e-9) {
    var xa = framePt(run.w, 0, 0, -run.inset)[0], xb = framePt(run.w, 0, 0, -run.inset - run.D)[0];
    top = Math.min(top, profileYat(plan.prof, xa), profileYat(plan.prof, xb));
  }
  return top;
}

/* The openings framed in one run: { it, rect } for every door, window and
   wall-hung gable window whose centre is on this run. The kennel partition's
   doggie doors are openings of the partition. */
export function runOpenings(plan, run) {
  if (run.key === "KP") {
    return [-plan.W / 4, plan.W / 4].map(function (dx, i) {
      return { it: { id: "doggie-" + i }, rect: { kind: "door", clear: { u0: dx - 0.68, u1: dx + 0.68, y0: y0, y1: y0 + 2.18 }, u: dx }, doggie: true };
    });
  }
  var out = [];
  plan.state.items.forEach(function (it) {
    if (it.wall !== run.key) return;
    var r = openingRect(it, plan);
    if (!r || r.plane !== "wall" || !r.clear) return;
    if (r.u < run.a - 1e-9 || r.u > run.b + 1e-9) return;
    out.push({ it: it, rect: r });
  });
  return out;
}

/* Which header fits: the rule's size, else the deepest smaller one that fits
   under `limit`, else a flat 2x, else none (the top plate carries it). */
function fitHeader(spec, span, openTop, limit) {
  var want = lumberSize(pickRule(spec.header, { spanFt: span }));
  var tries = [want];
  HEADER_FALLBACK.forEach(function (n) {
    var z = lumberSize(n + (want.plies === 3 ? " tripled" : want.plies === 2 ? " doubled" : ""));
    if (z.d < want.d - 1e-9) tries.push(z);
  });
  for (var i = 0; i < tries.length; i++) if (openTop + tries[i].d <= limit + 1e-9) return { size: tries[i], asked: want, flat: false, fits: i === 0 };
  if (openTop + spec.plateT <= limit + 1e-9) return { size: { name: "flat", nominal: spec.stud.nominal + " flat", t: spec.D, d: spec.plateT, plies: 1 }, asked: want, flat: true, fits: false };
  return { size: null, asked: want, flat: false, fits: false };
}

/* THE OPENINGS OF ONE RUN, as a framer would group them. Barnwright lets a
   crowded wall put openings closer than framing can go -- "on a wall with no
   room the wall clamp still wins and the trim laps a little", and on an 8 ft
   side porch its standard door and two windows even overlap. So:
   * two openings side by side with room for ONE stud between them (less than
     two jacks' worth) share that stud as the jack of both;
   * two with not even that much room (or overlapping) are framed as ONE wide
     rough opening: one header over both at the higher top, jacks at its outer
     ends, the bottom plate cut across it if either is a door, and a single
     rough sill at the lower window bottom if both are windows.
   Openings one above the other (the single slope's transom row over a door)
   are framed separately; the studs between are cut round both, and the lower
   one's header is sized to fit under the upper one's sill (framed as one when
   not even a flat 2x fits between them).

   An opening wider than the wall's frame (an 8 ft roll-up on an 8 ft end
   wall, double doors picked for a 4 ft porch wall -- Barnwright draws the
   door past the corners) is framed only as wide as the wall allows: a jack
   against each end of the wall's frame, the corner doing the king's job.

   Two neighbours share a stud only when their headers sit at the same
   height (one stud can carry one header line); otherwise they are framed as
   one opening. */
function frameOpenings(plan, run, spec, yPT, yTB, topPlate) {
  var sw = spec.sw, sillT = spec.plateT;
  function low(f) { return f.win ? Math.max(yPT, f.ro.y0 - sillT) : yPT; }
  function yOver(A, B) { return Math.min(A.ro.y1, B.ro.y1) > Math.max(low(A), low(B)) + 1e-9; }
  function gapOf(A, B) { return Math.max(B.ro.u0 - A.ro.u1, A.ro.u0 - B.ro.u1); }
  function uOver(A, B) { return Math.min(A.ro.u1, B.ro.u1) + sw > Math.max(A.ro.u0, B.ro.u0) - sw + 1e-9; }
  /* the only walls whose openings the gable framing carries past the plates
     (parts/roof-frame.js gableOpenings frames an end-wall door whose top is
     more than 0.01 ft over the wall top) */
  var gableEnd = (run.key === "F" || run.key === "B") && Math.abs(Math.abs(run.w.at) - plan.L / 2) < 1e-9;
  /* ...and only those the gable framing actually takes: it refuses one whose
     framing would run past the gable's own (a door near the corner, where
     the roof comes down), so the one list both parts read decides */
  var carriedOps = gableEnd ? gableOpenings(plan, run.key).filter(function (o) { return o.kind === "door"; }) : [];
  function carried(p) {
    if (!(p.ro.y1 > topPlate + 0.01)) return false;
    var xa = run.w.cx + run.w.ax[0] * p.ro.u0, xb = run.w.cx + run.w.ax[0] * p.ro.u1, x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    return carriedOps.some(function (o) { return o.x0 <= x0 + 0.01 && o.x1 >= x1 - 0.01; });
  }
  var groups = [];
  runOpenings(plan, run).forEach(function (o) {
    var r = o.rect, ro = r.clear, it = o.it, c = plan.CAT[it.cat];
    var win = r.kind === "win";
    var u0 = Math.max(ro.u0, run.fu0 + sw), u1 = Math.min(ro.u1, run.fu1 - sw);
    if (u1 - u0 < 0.05) return;                      /* nothing of it on this wall's frame */
    groups.push({ ids: [it.id], parts: [{ id: it.id, ro: ro, win: win }], rect: r, ro: { u0: u0, u1: u1, y0: ro.y0, y1: ro.y1 }, win: win,
      clipped: u0 > ro.u0 + 1e-9 || u1 < ro.u1 - 1e-9,
      dbl: !!(c && it.dbl && c.k === "win" && !c.gable), doggie: !!o.doggie });
  });
  function merge(A, B) {
    A.ids = A.ids.concat(B.ids); A.parts = A.parts.concat(B.parts);
    A.win = A.win && B.win; A.dbl = false; A.clipped = A.clipped || B.clipped;
    A.ro = { u0: Math.min(A.ro.u0, B.ro.u0), u1: Math.max(A.ro.u1, B.ro.u1), y0: Math.min(A.ro.y0, B.ro.y0), y1: Math.max(A.ro.y1, B.ro.y1) };
    if (!A.win) A.ro.y0 = y0;
    groups.splice(groups.indexOf(B), 1);
  }
  function mergeClose() {
    for (var merged = true; merged;) {
      merged = false;
      for (var i = 0; i < groups.length && !merged; i++) for (var j = i + 1; j < groups.length && !merged; j++) {
        var A = groups[i], B = groups[j];
        if (!yOver(A, B) || gapOf(A, B) >= sw - 1e-9) continue;
        merge(A, B); merged = true;
      }
    }
  }
  function build() {
    groups.sort(function (a, b) { return a.ro.u0 - b.ro.u0; });
    var frames = groups.map(function (g) {
      var ro = g.ro, span = ro.u1 - ro.u0;
      /* what the header must fit under: the top plates, or the sill of an
         opening framed right above this one */
      var limit = yTB, above = null;
      groups.forEach(function (o) {
        if (o === g || yOver(g, o) || !uOver(g, o) || low(o) < ro.y1 - 1e-9) return;
        if (low(o) < limit) { limit = low(o); above = o; }
      });
      var fh = fitHeader(spec, span, ro.y1, limit);
      /* an opening that reaches up past the wall top into the gable (a door
         rising into the gable of a Standard Barn): the plates are cut across
         it, the jacks and kings stop under them, and the gable framing
         (parts/gable-frame.js, with roof-frame's gableOpenings) carries its
         header above the wall */
      g.parts.forEach(function (p) { p.carried = carried(p); });
      var through = g.parts.some(function (p) { return p.carried; });
      if (through) fh = { size: null, asked: fh.asked, flat: false, fits: false, byGable: true };
      var hBot = ro.y1, hTop = fh.size ? ro.y1 + fh.size.d : ro.y1;
      /* a header that would leave less than a cripple's worth under what it
         carries goes up tight against it (CRIPPLE_MIN) */
      if (fh.size && limit - hTop > 1e-9 && limit - hTop < CRIPPLE_MIN) { hBot = limit - fh.size.d; hTop = limit; }
      /* no header fits at all under the plates: the plates span the opening
         and the jacks run straight up to them (a door whose top is up in the
         plates themselves is held to them the same way) */
      var plateHead = !fh.size && !through && !above;
      if (plateHead) { hBot = yTB; hTop = yTB; }
      var sillBot = g.win ? Math.max(yPT, ro.y0 - sillT) : null;
      return {
        id: g.ids.join("+"), ids: g.ids, parts: g.parts, combined: g.ids.length > 1, rect: g.rect, ro: ro, win: g.win, dbl: g.dbl && g.ids.length === 1,
        span: span, header: fh, through: through, plateHead: plateHead, hBot: hBot, hTop: hTop, limit: limit, sillBot: sillBot, zoneLow: g.win ? sillBot : yPT,
        kingTop: yTB, doggie: g.doggie, shareL: null, shareR: null, kingByEnd: { L: false, R: false }, clipped: !!g.clipped,
        group: g, under: above, stuck: !fh.size && !through && !!above,
      };
    });
    return frames;
  }
  mergeClose();
  var frames;
  for (var guard = 0; guard < 50; guard++) {
    frames = build();
    var redo = false;
    /* stacked openings with not even a flat 2x between them: one opening */
    for (var s = 0; s < frames.length && !redo; s++) if (frames[s].stuck) { merge(frames[s].group, frames[s].under); redo = true; }
    /* one stud's room between two neighbours: they share it -- when their
       headers sit at the same height; else they are framed as one */
    /* (every pair, not just neighbours in the list: a transom row framed
       above can sit between a door and a window in it) */
    for (var k = 0; k < frames.length && !redo; k++) for (var k2 = 0; k2 < frames.length && !redo; k2++) {
      var P = frames[k], Q = frames[k2];
      if (P === Q) continue;
      var g2 = Q.ro.u0 - P.ro.u1;
      if (g2 >= sw - 1e-9 && g2 < 2 * sw - 1e-9 && yOver(P, Q)) {
        if (Math.abs(P.hBot - Q.hBot) > 1e-6 || P.through !== Q.through || P.shareR || Q.shareL) { merge(P.group, Q.group); mergeClose(); redo = true; break; }
        var sh = { mid: (P.ro.u1 + Q.ro.u0) / 2, top: Math.min(P.hBot, Q.hBot), left: P.id, right: Q.id };
        P.shareR = sh; Q.shareL = sh;
      }
    }
    if (!redo) break;
  }
  frames.forEach(function (f) {
    f.edgeL = f.shareL ? f.shareL.mid : f.ro.u0 - sw;
    f.edgeR = f.shareR ? f.shareR.mid : f.ro.u1 + sw;
    f.zone = { u0: f.edgeL, u1: f.edgeR, y0: f.zoneLow, y1: Math.max(f.hTop, f.ro.y1) };
    delete f.group; delete f.under;
  });
  return frames;
}

/* The free parts of [ya, yb] at u-range [u0, u1] once the zones (other than
   the candidate's own) are taken out. */
function freeSpans(u0, u1, ya, yb, zones, own) {
  var spans = [[ya, yb]];
  zones.forEach(function (z) {
    if (own && own.indexOf(z) >= 0) return;
    if (u1 <= z.u0 + 1e-9 || u0 >= z.u1 - 1e-9) return;
    var next = [];
    spans.forEach(function (s) {
      if (s[1] <= z.y0 + 1e-9 || s[0] >= z.y1 - 1e-9) { next.push(s); return; }
      if (s[0] < z.y0) next.push([s[0], z.y0]);
      if (s[1] > z.y1) next.push([z.y1, s[1]]);
    });
    spans = next;
  });
  return spans;
}

/* Frame one run of wall. */
export function frameRun(plan, run, spec) {
  spec = spec || wallSpec(plan);
  var w = run.w, sw = spec.sw, D = spec.D, s = spec.spacing;
  var o0 = -run.inset - D, o1 = -run.inset;
  var topPlate = runTop(plan, run);
  var yPT = y0 + spec.nb * spec.plateT, yTB = topPlate - spec.nt * spec.plateT;
  var fu0 = run.fu0, fu1 = run.fu1;
  var frames = frameOpenings(plan, run, spec, yPT, yTB, topPlate);
  var zones = frames.map(function (f) { return f.zone; });
  var out = [];
  var base = { wall: run.key, run: run.index };
  function meta(extra) { return Object.assign({}, base, extra); }

  /* ---- plates: the bottom plate is cut out across a door, the top plates
     round an opening that rises into the gable ---- */
  var doorCuts = frames.filter(function (f) { return !f.win; }).map(function (f) { return [f.ro.u0, f.ro.u1]; });
  /* the plates are cut only where a door really rises past the wall top
     into the gable -- the part the gable framing carries (a crowded opening
     framed as one keeps its plates over a door that stops under them) */
  var riseCuts = [];
  frames.forEach(function (f) {
    if (!f.through) return;
    f.parts.forEach(function (p) {
      if (!p.carried) return;
      var a = Math.max(p.ro.u0, f.ro.u0), b = Math.min(p.ro.u1, f.ro.u1);
      if (b > a) riseCuts.push([a, b]);
    });
  });
  function pieces(cuts) {
    var ps = [[fu0, fu1]];
    cuts.forEach(function (c) {
      var nx = [];
      ps.forEach(function (p) {
        if (p[1] <= c[0] + 1e-9 || p[0] >= c[1] - 1e-9) { nx.push(p); return; }
        if (p[0] < c[0]) nx.push([p[0], c[0]]);
        if (p[1] > c[1]) nx.push([c[1], p[1]]);
      });
      ps = nx;
    });
    return ps.filter(function (p) { return p[1] - p[0] > 0.01; });
  }
  pieces(doorCuts).forEach(function (p) {
    for (var i = 0; i < spec.nb; i++) out.push(wallMember("bottom-plate", "lumber", w, p[0], p[1], y0 + i * spec.plateT, y0 + (i + 1) * spec.plateT, o0, o1, meta({ layer: i + 1, support: "bear" })));
  });
  pieces(riseCuts).forEach(function (p) {
    for (var i = 0; i < spec.nt; i++) out.push(wallMember("top-plate", "lumber", w, p[0], p[1], yTB + i * spec.plateT, yTB + (i + 1) * spec.plateT, o0, o1, meta({ layer: i + 1, support: "bear" })));
  });

  /* ---- headers, sills, mullions (fixed) and the verticals round each opening ---- */
  var cand = [];      /* vertical candidates: { kind, prio, u0, u1, ya, yb, own: [zones], extra } */
  frames.forEach(function (f) {
    var ro = f.ro, id = f.id, h = f.header, own = [f.zone];
    var hu0 = f.edgeL, hu1 = f.edgeR;
    var fm = { item: id, items: f.ids, combined: f.combined };
    if (h.size) {
      var n = Math.max(1, Math.min(h.size.plies, Math.floor(D / h.size.t + 1e-9)));
      var t = Math.min(h.size.t, D);
      var gap = n > 1 ? (D - n * t) / (n - 1) : 0;
      for (var p = 0; p < n; p++) {
        var oa, ob;
        if (n === 1) { oa = -run.inset - (D + t) / 2; ob = oa + t; }
        else { ob = -run.inset - p * (t + gap); oa = ob - t; }
        out.push(wallMember("header", "lumber", w, hu0, hu1, f.hBot, f.hTop, oa, ob,
          meta(Object.assign({ ply: p + 1, plies: n, size: h.size.nominal || h.size.name, asked: h.asked.name, flat: h.flat, fitted: !h.fits, support: "bear" }, fm))));
      }
    }
    if (f.win) {
      if (ro.y0 - f.sillBot > 0.01) out.push(wallMember("sill", "lumber", w, ro.u0, ro.u1, f.sillBot, ro.y0, o0, o1, meta(Object.assign({ support: "bearOrFasten" }, fm))));
      if (f.dbl && f.rect.u - sw >= ro.u0 + sw - 1e-9 && f.rect.u + sw <= ro.u1 - sw + 1e-9) {
        var uc = f.rect.u;
        out.push(wallMember("mullion", "lumber", w, uc - sw, uc, ro.y0, ro.y1, o0, o1, meta(Object.assign({ support: "bear" }, fm))));
        out.push(wallMember("mullion", "lumber", w, uc, uc + sw, ro.y0, ro.y1, o0, o1, meta(Object.assign({ support: "bear" }, fm))));
      }
      /* cripples under the sill's ends */
      cand.push({ kind: "cripple", prio: 4, u0: ro.u0, u1: ro.u0 + sw, ya: yPT, yb: f.sillBot, own: own, extra: Object.assign({ place: "sill" }, fm) });
      cand.push({ kind: "cripple", prio: 4, u0: ro.u1 - sw, u1: ro.u1, ya: yPT, yb: f.sillBot, own: own, extra: Object.assign({ place: "sill" }, fm) });
    }
    /* cripples over the jacks, between the header and the top plates */
    if (!f.through && !f.plateHead) {
      if (!f.shareL) cand.push({ kind: "cripple", prio: 4, u0: hu0, u1: ro.u0, ya: f.hTop, yb: yTB, own: own, extra: Object.assign({ place: "header" }, fm) });
      if (!f.shareR) cand.push({ kind: "cripple", prio: 4, u0: ro.u1, u1: hu1, ya: f.hTop, yb: yTB, own: own, extra: Object.assign({ place: "header" }, fm) });
    }
    if (!f.shareL) {
      cand.push({ kind: "jack", prio: 10, u0: hu0, u1: ro.u0, ya: yPT, yb: Math.min(f.hBot, yTB), own: own, extra: Object.assign({ side: "L" }, fm) });
      cand.push({ kind: "king", prio: 6, u0: hu0 - sw, u1: hu0, ya: yPT, yb: f.kingTop, own: null, extra: Object.assign({ side: "L" }, fm), frame: f });
    }
    if (!f.shareR) {
      cand.push({ kind: "jack", prio: 10, u0: ro.u1, u1: hu1, ya: yPT, yb: Math.min(f.hBot, yTB), own: own, extra: Object.assign({ side: "R" }, fm) });
      cand.push({ kind: "king", prio: 6, u0: hu1, u1: hu1 + sw, ya: yPT, yb: f.kingTop, own: null, extra: Object.assign({ side: "R" }, fm), frame: f });
    } else {
      /* the stud two neighbours share, under both their headers */
      var sh = f.shareR, nb = frames.filter(function (q) { return q.id === sh.right; })[0];
      cand.push({ kind: "jack", prio: 10, u0: sh.mid - sw / 2, u1: sh.mid + sw / 2, ya: yPT, yb: (f.plateHead && nb.plateHead) ? yTB : Math.min(sh.top, yTB), own: [f.zone, nb.zone],
        extra: Object.assign({ side: "R", sharedWith: sh.right, shared: true }, fm) });
    }
  });

  /* ---- the ends and the corners ---- */
  cand.push({ kind: "end-stud", prio: 8, u0: fu0, u1: fu0 + sw, ya: yPT, yb: yTB, own: null, extra: { end: 0 } });
  cand.push({ kind: "end-stud", prio: 8, u0: fu1 - sw, u1: fu1, ya: yPT, yb: yTB, own: null, extra: { end: 1 } });
  [0, 1].forEach(function (e) {
    var en = run.ends[e];
    if (!en.corner || !en.through) return;
    for (var k = 1; k < spec.cornerStuds - 1; k++) {
      var a = e ? fu1 - (k + 1) * sw : fu0 + k * sw;
      cand.push({ kind: "corner-stud", prio: 5, u0: a, u1: a + sw, ya: yPT, yb: yTB, own: null, extra: { end: e } });
    }
  });

  /* ---- studs at the layout, from the siding's start ---- */
  var origin = run.a;
  for (var k = Math.ceil((fu0 - origin) / s - 1e-9); origin + k * s <= fu1 + 1e-9; k++) {
    var m = origin + k * s;
    if (m - sw / 2 < fu0 - 1e-9 || m + sw / 2 > fu1 + 1e-9) continue;
    cand.push({ kind: "stud", prio: 1, u0: m - sw / 2, u1: m + sw / 2, ya: yPT, yb: yTB, own: null, extra: { layout: k, origin: origin, spacing: s } });
  }

  /* nothing stands outside the run (past the corner is the other wall's
     frame, which then does a king's job); cut every vertical round the other
     openings -- a stud cut becomes cripples */
  var pieces2 = [];
  cand.forEach(function (c) {
    if (c.u0 < fu0 - 1e-9 || c.u1 > fu1 + 1e-9) {
      if (c.kind === "king" && c.frame) c.frame.kingByEnd[c.extra.side] = true;
      return;
    }
    freeSpans(c.u0, c.u1, c.ya, c.yb, zones, c.own).forEach(function (sp) {
      if (sp[1] - sp[0] < 0.05) return;
      var cut = sp[0] > c.ya + 1e-9 || sp[1] < c.yb - 1e-9;
      /* a stud cut round an opening is cripples; so is the part of a jack
         that does not reach its own header (it carries nothing) */
      var filler = cut && (c.kind === "stud" || (c.kind === "jack" && sp[1] < c.yb - 1e-9));
      pieces2.push({ kind: filler ? "cripple" : c.kind, prio: filler ? 2 : c.prio, u0: c.u0, u1: c.u1, ya: sp[0], yb: sp[1], extra: filler ? {} : c.extra, cut: cut });
    });
  });
  /* where two would stand in the same place, the more important one stays
     (and a king that gives way to a jack or an end stud has its job done by it) */
  pieces2.sort(function (a, b) { return b.prio - a.prio || a.u0 - b.u0; });
  var kept = [];
  pieces2.forEach(function (c) {
    for (var i = 0; i < kept.length; i++) {
      var k2 = kept[i];
      var du = Math.min(c.u1, k2.u1) - Math.max(c.u0, k2.u0), dy = Math.min(c.yb, k2.yb) - Math.max(c.ya, k2.ya);
      if (du > 1e-6 && dy > 1e-6) {
        if (c.kind === "king" && c.extra.item) { k2.servesAsKing = (k2.servesAsKing || []).concat([c.extra.item + ":" + c.extra.side]); }
        return;
      }
    }
    kept.push(c);
  });
  kept.sort(function (a, b) { return a.u0 - b.u0 || a.ya - b.ya; });
  kept.forEach(function (c) {
    out.push(wallMember(c.kind, "lumber", w, c.u0, c.u1, c.ya, c.yb, o0, o1,
      meta(Object.assign({ support: "bear", full: !c.cut && c.ya <= yPT + 1e-9 && c.yb >= yTB - 1e-9, servesAsKing: c.servesAsKing || null }, c.extra))));
  });
  out.forEach(function (m) { m.stage = "wall-frame"; });
  return { run: run, members: out, frames: frames, yPT: yPT, yTB: yTB, topPlate: topPlate, o0: o0, o1: o1 };
}

/* The kennel's open run, framed post and beam: 4x4 posts at the two front
   corners and the middle of the front (where Barnwright draws its three wood
   posts), a post at the back of each side against the partition, a header
   over the front and down each side (sized by walls.header for the span
   between posts) and the top plates on the headers, at the wall top. */
export function kennelRunMembers(plan, spec) {
  spec = spec || wallSpec(plan);
  var ws = plan.ws, W = plan.W, L = plan.L, out = [];
  var D = spec.D, post = lumberSize((plan.construction.porch && plan.construction.porch.post) || "4x4");
  var pw = post.d, sw = spec.sw, ins = WALL_INSET;
  var o0 = -ins - D, o1 = -ins;
  var yTB = plan.topY - spec.nt * spec.plateT;
  function plates(w, a, b, key) {
    for (var i = 0; i < spec.nt; i++) out.push(wallMember("top-plate", "lumber", w, a, b, yTB + i * spec.plateT, yTB + (i + 1) * spec.plateT, o0, o1, { wall: key, run: "kennel-run", layer: i + 1, support: "bear" }));
  }
  function header(w, a, b, span, key) {
    var h = fitHeader(spec, span, 0, 1e9).size, hb = yTB - h.d;
    var n = Math.max(1, Math.min(h.plies, Math.floor(D / h.t + 1e-9))), gap = n > 1 ? (D - n * h.t) / (n - 1) : 0;
    for (var p = 0; p < n; p++) {
      var ob = n === 1 ? -ins - (D - h.t) / 2 : -ins - p * (h.t + gap);
      out.push(wallMember("run-header", "lumber", w, a, b, hb, yTB, ob - h.t, ob, { wall: key, run: "kennel-run", ply: p + 1, size: h.nominal, span: span, support: "bearOrFasten" }));
    }
    return hb;
  }
  function postAt(w, a, key, top, where) {
    out.push(wallMember("run-post", "lumber", w, a, a + pw, y0, top, -ins - pw, -ins, { wall: key, run: "kennel-run", place: where, size: post.nominal, support: "bear" }));
  }
  /* the front: through the whole width */
  var F = ws.F, fa = -W / 2 + ins, fb = W / 2 - ins;
  var hbF = header(F, fa, fb, (fb - fa - 3 * pw) / 2, "F");
  postAt(F, fa, "F", hbF, "corner"); postAt(F, -pw / 2, "F", hbF, "middle"); postAt(F, fb - pw, "F", hbF, "corner");
  plates(F, fa, fb, "F");
  /* each side: from the partition's frame to the front's */
  /* R runs z = -u, L runs z = +u: both from the partition's frame (z = -0.05)
     to the front's frame (z = L/2 - 0.02 - the stud depth) */
  [["R", ws.R, -L / 2 + ins + D, PARTITION_INSET], ["L", ws.L, -PARTITION_INSET, L / 2 - ins - D]].forEach(function (s) {
    var key = s[0], w = s[1], a = s[2], b = s[3];
    var span = (b - a) - pw;
    var hb = header(w, a, b, span, key);
    postAt(w, key === "R" ? b - pw : a, key, hb, "back");
    plates(w, a, b, key);
  });
  out.forEach(function (m) { m.stage = "wall-frame"; });
  return out;
}

/* Every member of the wall framing, and what was framed where. */
export function wallFrame(plan) {
  var spec = wallSpec(plan);
  var runs = wallRuns(plan);
  var framed = runs.map(function (r) { return frameRun(plan, r, spec); });
  var members = [];
  framed.forEach(function (f) { members.push.apply(members, f.members); });
  if (plan.t.kennel) members.push.apply(members, kennelRunMembers(plan, spec));
  return { spec: spec, runs: runs, framed: framed, members: members };
}
export function wallFrameMembers(plan) { return wallFrame(plan).members; }

/* For the gable framing and the checks: every opening's framing box on its
   wall (u, y) -- kings' outer faces, bottom of the zone to the top of the
   header -- and whether it rises past the top plates into the gable. */
export function openingFrames(plan) {
  var out = [], sw = wallSpec(plan).sw;
  wallFrame(plan).framed.forEach(function (fr) {
    fr.frames.forEach(function (f) {
      out.push({ wall: fr.run.key, item: f.id, u0: f.edgeL - (f.shareL ? 0 : sw), u1: f.edgeR + (f.shareR ? 0 : sw), y0: f.zone.y0, y1: f.kingTop, headerTop: f.hTop, throughPlates: f.through });
    });
  });
  return out;
}

export default {
  id: "wall-frame",
  name: "Wall framing",
  stage: "wall-frame",
  realLife: "{walls.stud} studs at {walls.spacingIn} in on centre from the corners, on {walls.bottomPlates} bottom plate under {walls.topPlates} top plates, with {walls.corner} corners; at every door and window king and jack studs, a header sized to the opening and cripples over it, and under a window a rough sill on cripples.",
  appliesTo(plan) { return true; },
  members: wallFrameMembers,
  build(plan, kit) {
    drawMembers(kit, wallFrameMembers(plan), "wall-frame");
  },
};
