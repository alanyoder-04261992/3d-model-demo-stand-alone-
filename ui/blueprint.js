/* THE INSIDE VIEW: THE FLOOR PLAN, drawn as a navy blueprint. Browser file
   (a plugin: ui/app.js loads it after the first picture and calls install).

   What the customer sees when they tap "Inside -- floor plan" under the 3D
   picture: the building from straight above, drawn like a builder's
   blueprint on navy paper --
     * a faint grid, and the whole deck (porch included) as a dashed outline;
     * every wall, from the same wall list the 3D building uses (so the porch
       walls step in exactly where they do in 3D);
     * the porch (dashed, labelled PORCH) and its posts (small squares);
     * every door and window in its place, with the symbol a builder uses:
       a window is three thin lines across the wall, a roll-up door a dashed
       line, a wooden or steel door a leaf with a dashed arc showing it swing
       OUTWARD (two leaves for double doors);
     * outlets (a dot with a bar; the switch + GFCI has an "S" beside it),
       outside lights (a gold ring just outside the wall), overhead lights (a
       gold ring with four rays), benches and shelves (labelled, and turned
       when they run along the length), and the ramp at the biggest door;
     * the width and length as dimension lines, and for the item that is
       picked, how far it sits from its neighbours (or, for a bench, shelf or
       light, from the left and back walls);
     * a title ("12′ × 24′ — FLOOR PLAN"), FRONT under the front wall and a
       footer with the company's name, the size and the style.
   When an electric package is chosen its switch, outlets and lights are
   ordinary items on the design (model/layout.js pkFixtures lays them), so
   they appear on the plan like any outlet or light.

   TOUCHING THE PLAN:
     tap an item              pick it (the item sheet opens); tap empty paper
                              to put it down
     drag the PICKED item     slide it -- a door or window along its wall, a
                              bench, shelf or light anywhere on the floor --
                              in feet, kept legal by the same rules as the 3D
                              drag (clampPos) and eased onto the middle of its
                              space (snapCenter); the 3D building is redrawn
                              when the finger lifts
     drag empty paper         move the plan around
     two fingers              pinch to zoom (1 to 5 times) and move the plan
     double-tap empty paper   back to the whole plan, nothing picked
     press and hold (half a second) on empty paper
                              "Add here": near a wall a door, a window or an
                              outlet on that wall; in the open floor a work
                              bench, a shelf or an overhead light there
   Only an ALREADY picked item drags, as in 3D, so moving the plan around can
   never shove a door by accident. A look-only page (a shared link) can be
   zoomed and moved but nothing can be picked, moved or added.

   PLUGGING IN (the page's API, window.shedUI -- see ui/app.js):
     * sets shedUI.onInside: the Inside button toggles between the 3D picture
       and this plan; adding something that only shows on the plan (a bench,
       a shelf, an electric package) brings the plan up;
     * redraws on "mode", "rebuild", "change" and "select", and when the
       canvas changes size;
     * draws into canvas#bp (shedUI.mounts.bp);
     * adds shedUI.blueprint = { draw, view, toScreen, toWorld, hit, reset }
       so a check (tools/check-blueprint.mjs) can find where things are drawn.
   A company with features.floorPlan false gets no Inside button.

   FOR THE QUOTE PICTURES (another file uses it):
     drawPlanPicture(state, catalogue, w, h, opts) -> a new <canvas>, w x h
       pixels, with the whole plan fitted in it (no zoom, no pan), exactly as
       the Inside view draws it -- except that its footer does not say
       "PINCH TO ZOOM", which nobody can do to a picture in an e-mail
       (Barnwright's quote picture said it). opts: { scale (default 1): how big the lines
       and letters are -- pass 2 for a sharp picture twice the size;
       selection (default true): false leaves out the picked item's
       highlight and its measurements }.

   PORTED FROM Barnwright's 3ddesign.html, the numbers and colours byte for
   byte: bpSize, setMode's drawing half, bpDraw and its leafArc, bpFtIn (now
   ui/interaction.js ftIn), bpDimLine (4303-4543), and the plan's touch code
   bpPt, bpWorld, bpHit and the pointer handlers (4544-4650). Barnwright's
   rules translated the usual way: item codes became item traits (a door with
   two leaves instead of w72 / dfr, a transom instead of tr, the package's
   switch instead of gfci, any ramp with a length instead of r4 / r6), the
   building comes from model/frame.js frameOf instead of globals, the "Add
   here" choices are the company's own items, and the footer carries the
   company's name (Barnwright fell back to "Portable Buildings").

   WHERE IT DELIBERATELY DRAWS DIFFERENTLY FROM BARNWRIGHT (none of it
   changes the 3D building):
     * a DOUBLE WINDOW is drawn as wide as it really is (two windows and the
       shared board, model/layout.js itemW), with a short line across it for
       the shared board; Barnwright drew it as a single window, and measured
       from a single window's edges;
     * a SIDE PORCH (Side Cabin, Loft Side Cabin) is outlined where it is --
       the 4 ft notch on the side -- instead of a dashed box across the whole
       width of the building with PORCH written in the middle of the room;
     * the RAMP is drawn where the 3D ramp is (parts/ramp.js rampSite): at
       the biggest door, or where the porch is stepped onto when that door
       opens onto the porch (Barnwright drew it straight out of the porch
       wall, across the porch floor);
     * letters fall back to Arial Narrow / a plain sans-serif when the Oswald
       font is not loaded (Barnwright's fell back to the browser's serif);
     * a door whose swing would run off the paper (the 4 ft door on a 6x8
       Garden Utility, the Dog Kennel's back door running up into the title)
       or a ramp that would, makes the whole plan a little smaller so all of
       it is on the paper; Barnwright let it run off the edge. Every other
       building is drawn at exactly Barnwright's size (drawPlan's option
       fit: "barnwright" draws Barnwright's size always -- the side-by-side
       check uses it);
     * when the view switcher (ui/views.js) sits over the top of the stage,
       the title and the plan move down below it instead of under it;
     * on a phone the price plate lies right across the foot of the stage,
       and Barnwright drew the front of the building -- the doors, their
       swings, the word FRONT -- underneath it; the plan now keeps clear of
       the plate whenever the plate covers its middle (a phone, a tablet
       held sideways). On a computer the plate sits in the corner, clear of
       the plan, and nothing moves;
     * a finger lifted off the plan does not also "click" what is under it
       a moment later (the touch's end is cancelled): picking an item opens
       the item sheet, which scrolls the page, and that click then landed on
       the "Outside" button and threw the customer back to the 3D picture;
     * a TAP on the picked item never slides it: the picked item only
       starts to follow the finger once the finger has moved more than
       3 px (Barnwright slid it by the finger's wobble, eased it up to
       0.22 ft onto the middle of its space, and never saved that move);
     * tapping empty paper with nothing picked does not rebuild the 3D
       building (Barnwright did, for nothing) -- which is also what keeps a
       quick double-tap quick.

   SAFETY: the company's name and the style's name are drawn with the
   canvas's fillText, which paints letters and never reads them as HTML (the
   same guarantee as .textContent, ui/esc.js); control characters are taken
   out and a very long name is cut short so it cannot run off the paper. */

import { wallPt } from "../engine/wall.js";
import { frameOf } from "../model/frame.js";
import { itemById, itemW, clampPos, snapCenter, neighborGaps } from "../model/layout.js";
import { rampLength, rampSite } from "../parts/ramp.js";
import { listOf } from "./state.js";
import { ftIn } from "./interaction.js";

/* Barnwright's blueprint colours (bpDraw). */
export const BP_COLORS = Object.freeze({
  paperTop: "#10406A", paperBottom: "#0A2C49",
  grid: "rgba(170,210,240,.07)",
  line: "#EAF4FB",                 /* walls, doors, windows, posts */
  core: "#0E3A5F",                 /* the inside of a wall, cleared openings */
  picked: "#7FD3FF",               /* the picked item, the porch, the dimensions */
  outlet: "#F4EFE4",
  outletBar: "#0A2C49",
  light: "#F2C86B",
  bench: "rgba(205,169,123,.92)",
  shelf: "rgba(232,220,192,.95)",
  wood: "#5B4426",
  title: "#CFE3F2",
});

/* Oswald first, as Barnwright; a narrow sans-serif when it is not there. */
export const BP_FONT = "Oswald, 'Arial Narrow', 'Roboto Condensed', Arial, sans-serif";
function font(weight, px) { return weight + " " + px + "px " + BP_FONT; }

/* A word from a settings file, fit to paint on the paper: no control
   characters (nor the invisible ones that turn the rest of a line round,
   right to left), not longer than `max`. (fillText never reads HTML.) */
export function paperText(v, max) {
  let s = String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  max = max || 60;
  if (s.length > max) s = s.slice(0, max - 1) + "…";
  return s;
}

/* The footer line: "ACME SHEDS · 12 × 24 SIDE CABIN · PINCH TO ZOOM".
   hint false leaves "PINCH TO ZOOM" off -- a picture for a quote cannot be
   pinched. */
export function footerText(state, cat, hint) {
  const t = cat.TYPES[state.type] || {};
  const brand = paperText((cat.brand && (cat.brand.name || cat.brand.short)) || "", 48).toUpperCase();
  const what = paperText(String(state.size).replace("x", " × ") + " " + (t.name || ""), 60).toUpperCase();
  return (brand ? brand + " · " : "") + what + (hint === false ? "" : " · PINCH TO ZOOM");
}

/* The title: "12′ × 24′ — FLOOR PLAN" (the corner porch counts its deck in
   the length, as Barnwright's dims() does). */
export function titleText(W, L) { return W + "′ × " + L + "′ — FLOOR PLAN"; }

/* The frame of the building for the plan: model/frame.js frameOf plus the
   state, so the ramp rules (parts/ramp.js) can read it like a plan. */
export function planFrame(state, cat) {
  return Object.assign({ state: state }, frameOf(state, cat));
}

/* ------------------------------------------------------------------------
   Barnwright's bpDimLine: a thin cyan line with arrowheads and end ticks,
   and its label on a navy box in the middle. */
function dimLine(x, d, ax, ay, bx, by, label) {
  x.strokeStyle = BP_COLORS.picked; x.fillStyle = BP_COLORS.picked; x.lineWidth = 1 * d;
  x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke();
  const ang = Math.atan2(by - ay, bx - ax);
  [[ax, ay, ang], [bx, by, ang + Math.PI]].forEach(function (t) {
    x.beginPath();
    x.moveTo(t[0], t[1]); x.lineTo(t[0] + Math.cos(t[2] + 0.42) * 7 * d, t[1] + Math.sin(t[2] + 0.42) * 7 * d);
    x.moveTo(t[0], t[1]); x.lineTo(t[0] + Math.cos(t[2] - 0.42) * 7 * d, t[1] + Math.sin(t[2] - 0.42) * 7 * d);
    x.stroke();
  });
  const qx = Math.cos(ang + Math.PI / 2) * 5 * d, qy = Math.sin(ang + Math.PI / 2) * 5 * d;
  x.beginPath(); x.moveTo(ax - qx, ay - qy); x.lineTo(ax + qx, ay + qy); x.moveTo(bx - qx, by - qy); x.lineTo(bx + qx, by + qy); x.stroke();
  const mx2 = (ax + bx) / 2, my2 = (ay + by) / 2;
  x.font = font(600, 9 * d); x.textAlign = "center"; x.textBaseline = "middle";
  const tw = (x.measureText(label).width || 30) + 8 * d;
  x.fillStyle = BP_COLORS.core; x.fillRect(mx2 - tw / 2, my2 - 7 * d, tw, 14 * d);
  x.fillStyle = BP_COLORS.picked; x.fillText(label, mx2, my2);
}

/* ------------------------------------------------------------------------
   THE DRAWING (Barnwright bpDraw). x: a 2D context on a Wc x Hc canvas; d:
   pixels per CSS pixel; view {zoom, ox, oy} (the pan is clamped IN PLACE,
   as Barnwright clamps bpOX / bpOY); opts {selection: false (leave the
   picked item's highlight and measurements out), topReserve (pixels kept
   free at the top), bottomReserve (pixels at the bottom the price plate
   covers: the building, its swings and FRONT stay above them), fit:
   "barnwright" (Barnwright's size even when a door swing runs off the
   paper)}. Returns where the plan landed:
   { s (pixels per foot), cx, cy (where x = 0, z = 0 is), d, fr, top, bot }. */
export function drawPlan(x, Wc, Hc, d, state, cat, view, opts) {
  opts = opts || {};
  view = view || { zoom: 1, ox: 0, oy: 0 };
  const CAT = cat.CAT;
  const fr = planFrame(state, cat);
  const t = fr.t, ws = fr.ws, W = fr.d.W, L = fr.d.L;
  const sel = opts.selection === false ? null : state.sel;
  /* room kept free at the top (the view switcher sits there on the page) */
  const top = Math.max(0, Math.min(Hc * 0.3, opts.topReserve || 0));
  /* ...and at the bottom (on a phone the price plate lies across the foot
     of the picture): the margin under the building is made big enough for
     the plate plus the FRONT label; with no plate there it is Barnwright's */
  const bot = Math.max(0, Math.min(Hc * 0.3, opts.bottomReserve || 0));
  const m = Math.round(Math.min(Wc, Hc) * 0.16);
  const mBot = bot > 0 ? Math.max(m, bot + 30 * d) : m;
  const fitB = Math.min((Wc - 2 * m) / W, (Hc - top - m - mBot) / L);   /* Barnwright's fit */
  const cy0 = (Hc + top + m - mBot) / 2;                                 /* Barnwright's: (Hc + top) / 2 */
  let fit = fitB;
  if (opts.fit !== "barnwright") {
    /* ...made a little smaller ONLY when a door's swing or the ramp would
       otherwise run off the paper (or, at the back, up into the title, or
       at the front under the price plate) */
    const r = planReach(state, fr, CAT);
    const side = 4 * d, below = 4 * d, above = 24 * d;
    if (r.x1 > W / 2 + 1e-6) fit = Math.min(fit, (Wc / 2 - side) / r.x1);
    if (-r.x0 > W / 2 + 1e-6) fit = Math.min(fit, (Wc / 2 - side) / -r.x0);
    if (r.z1 > L / 2 + 1e-6) fit = Math.min(fit, (Hc - bot - cy0 - below) / r.z1);
    if (-r.z0 > L / 2 + 1e-6) fit = Math.min(fit, (cy0 - top - above) / -r.z0);
    fit = Math.max(fit, fitB * 0.4);                                /* never shrink it to a speck */
  }
  const S = fit * (view.zoom || 1);
  view.ox = Math.max(-W / 2 * S, Math.min(W / 2 * S, view.ox || 0));
  view.oy = Math.max(-L / 2 * S, Math.min(L / 2 * S, view.oy || 0));
  const cx = Wc / 2 + view.ox, cy = cy0 + view.oy;
  const BPS = { s: S, cx: cx, cy: cy, d: d, fr: fr, Wc: Wc, Hc: Hc, top: top, bot: bot };
  function Pt(wx, wz) { return [cx + wx * S, cy + wz * S]; }
  const catOf = (it) => CAT[it.cat] || null;

  x.setTransform(1, 0, 0, 1, 0, 0);
  const g = x.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, BP_COLORS.paperTop); g.addColorStop(1, BP_COLORS.paperBottom);
  x.fillStyle = g; x.fillRect(0, 0, Wc, Hc);
  x.strokeStyle = BP_COLORS.grid; x.lineWidth = 1;
  for (let gx = 0.5; gx < Wc; gx += 22 * d) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, Hc); x.stroke(); }
  for (let gy = 0.5; gy < Hc; gy += 22 * d) { x.beginPath(); x.moveTo(0, gy); x.lineTo(Wc, gy); x.stroke(); }

  /* deck outline: the full building footprint, porch included */
  const TH = Math.max(4 * d, 0.42 * S);
  BPS.TH = TH;
  x.setLineDash([4 * d, 4 * d]); x.strokeStyle = "rgba(234,244,251,.45)"; x.lineWidth = 1.1 * d;
  x.strokeRect(cx - W / 2 * S, cy - L / 2 * S, W * S, L * S); x.setLineDash([]);

  /* real walls, straight from the same geometry the 3D uses (porch walls recess correctly) */
  Object.keys(ws).forEach(function (wk) {
    const w = ws[wk];
    const Aw = wallPt(w, -w.len / 2, 0, 0), Bw = wallPt(w, w.len / 2, 0, 0);
    const aw = Pt(Aw[0], Aw[2]), bw = Pt(Bw[0], Bw[2]);
    x.lineCap = "square";
    x.strokeStyle = BP_COLORS.line; x.lineWidth = TH;
    x.beginPath(); x.moveTo(aw[0], aw[1]); x.lineTo(bw[0], bw[1]); x.stroke();
    x.strokeStyle = BP_COLORS.core; x.lineWidth = Math.max(1.2 * d, TH - 2.8 * d);
    x.beginPath(); x.moveTo(aw[0], aw[1]); x.lineTo(bw[0], bw[1]); x.stroke();
    x.lineCap = "butt";
  });

  /* porch */
  const pr2 = porchRect(fr);
  if (pr2) {
    x.setLineDash([6 * d, 5 * d]); x.strokeStyle = BP_COLORS.picked; x.lineWidth = 1.3 * d;
    x.strokeRect(cx + pr2[0] * S, cy + pr2[1] * S, pr2[2] * S, pr2[3] * S);
    x.setLineDash([]);
    x.fillStyle = "rgba(127,211,255,.6)"; x.font = font(600, 9 * d); x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("PORCH", cx + (pr2[0] + pr2[2] / 2) * S, cy + (pr2[1] + pr2[3] / 2) * S);
  }

  /* porch posts */
  state.items.forEach(function (it) {
    const c = catOf(it); if (!c || c.k !== "post") return;
    const qp = postPoint(it, fr, Pt);
    x.fillStyle = (sel === it.id) ? BP_COLORS.picked : BP_COLORS.line;
    x.fillRect(qp[0] - 3.5 * d, qp[1] - 3.5 * d, 7 * d, 7 * d);
  });

  /* wall openings + wall-mounted symbols */
  state.items.forEach(function (it) {
    const c0 = catOf(it); if (!c0 || c0.gable || c0.k === "post") return;
    if (c0.int && c0.k !== "out") return;
    const w = ws[it.wall]; if (!w) return;
    const isSel = (sel === it.id);
    if (c0.k === "out") {
      const mo = wallPt(w, it.pos, 0, 0), qo = Pt(mo[0], mo[2]);
      x.fillStyle = isSel ? BP_COLORS.picked : BP_COLORS.outlet;
      x.beginPath(); x.arc(qo[0], qo[1], (c0.switch ? 5.4 : 4.6) * d, 0, 7); x.fill();
      x.strokeStyle = BP_COLORS.outletBar; x.lineWidth = 1.2 * d;
      x.beginPath(); x.moveTo(qo[0] - 6.5 * d, qo[1]); x.lineTo(qo[0] + 6.5 * d, qo[1]); x.stroke();
      if (c0.switch) {
        x.fillStyle = isSel ? BP_COLORS.picked : BP_COLORS.outlet;
        x.font = font(700, 7.5 * d); x.textAlign = "center"; x.textBaseline = "middle";
        x.fillText("S", qo[0] + w.n[0] * 11 * d, qo[1] + w.n[2] * 11 * d);
      }
      return;
    }
    if (c0.k === "light") {
      const ml = wallPt(w, it.pos, 0, 0.7), ql = Pt(ml[0], ml[2]);
      x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.light; x.lineWidth = 1.3 * d;
      x.beginPath(); x.arc(ql[0], ql[1], 3.6 * d, 0, 7); x.stroke();
      return;
    }
    const cw = itemW(it, CAT);
    const A = wallPt(w, it.pos - cw / 2, 0, 0), B = wallPt(w, it.pos + cw / 2, 0, 0);
    const a = Pt(A[0], A[2]), b = Pt(B[0], B[2]);
    /* clear the band across the opening */
    x.strokeStyle = BP_COLORS.core; x.lineWidth = TH + 2 * d; x.lineCap = "butt";
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
    if (c0.k === "win") {
      x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.line; x.lineWidth = 1.2 * d;
      [-0.13, 0, 0.13].forEach(function (off) {
        const A2 = wallPt(w, it.pos - cw / 2, 0, off), B2 = wallPt(w, it.pos + cw / 2, 0, off);
        const a2 = Pt(A2[0], A2[2]), b2 = Pt(B2[0], B2[2]);
        x.beginPath(); x.moveTo(a2[0], a2[1]); x.lineTo(b2[0], b2[1]); x.stroke();
      });
      if (it.dbl && !c0.gable) {
        /* the double window's shared middle board, across the three lines */
        const M1 = wallPt(w, it.pos, 0, -0.2), M2 = wallPt(w, it.pos, 0, 0.2);
        const m1 = Pt(M1[0], M1[2]), m2 = Pt(M2[0], M2[2]);
        x.beginPath(); x.moveTo(m1[0], m1[1]); x.lineTo(m2[0], m2[1]); x.stroke();
      }
    } else if (c0.k === "ru") {
      x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.line; x.lineWidth = 1.7 * d; x.setLineDash([5 * d, 4 * d]);
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); x.setLineDash([]);
    } else {
      /* a door: swings OUT; doors with two leaves (double doors) get two */
      const outw = [w.n[0], w.n[2]];
      x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.line;
      x.lineWidth = 1.0 * d; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
      const leafArc = function (hx, hz, tx, tz, r) {
        const hp = Pt(hx, hz), lfp = Pt(hx + outw[0] * r, hz + outw[1] * r), tp = Pt(tx, tz);
        x.lineWidth = 1.7 * d; x.beginPath(); x.moveTo(hp[0], hp[1]); x.lineTo(lfp[0], lfp[1]); x.stroke();
        const angT = Math.atan2(tp[1] - hp[1], tp[0] - hp[0]), angO = Math.atan2(lfp[1] - hp[1], lfp[0] - hp[0]);
        const rpx = Math.hypot(tp[0] - hp[0], tp[1] - hp[1]);
        const delta = ((angO - angT + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        x.lineWidth = 1.0 * d; x.setLineDash([3 * d, 3 * d]);
        x.beginPath(); x.arc(hp[0], hp[1], rpx, angT, angO, delta < 0); x.stroke(); x.setLineDash([]);
      };
      if (c0.leaves === 2) {
        const M = wallPt(w, it.pos, 0, 0);
        leafArc(A[0], A[2], M[0], M[2], cw / 2);
        leafArc(B[0], B[2], M[0], M[2], cw / 2);
      } else {
        leafArc(A[0], A[2], B[0], B[2], cw);
      }
    }
  });

  /* ramp at the biggest door (where the 3D ramp is: parts/ramp.js) */
  const rs = rampOf(fr);
  if (rs) {
    const rw = rs.w, rlen = rs.len, tap = rs.width * 0.10;
    const RA = wallPt(rw, rs.u - rs.width / 2, 0, 0.25), RB = wallPt(rw, rs.u + rs.width / 2, 0, 0.25);
    const RA2 = wallPt(rw, rs.u - rs.width / 2 + tap, 0, 0.25 + rlen), RB2 = wallPt(rw, rs.u + rs.width / 2 - tap, 0, 0.25 + rlen);
    const pa = Pt(RA[0], RA[2]), pb = Pt(RB[0], RB[2]), pa2 = Pt(RA2[0], RA2[2]), pb2 = Pt(RB2[0], RB2[2]);
    x.fillStyle = "rgba(234,244,251,.10)";
    x.beginPath(); x.moveTo(pa[0], pa[1]); x.lineTo(pb[0], pb[1]); x.lineTo(pb2[0], pb2[1]); x.lineTo(pa2[0], pa2[1]); x.closePath(); x.fill();
    x.setLineDash([5 * d, 4 * d]); x.strokeStyle = BP_COLORS.line; x.lineWidth = 1.3 * d; x.stroke(); x.setLineDash([]);
    x.fillStyle = "rgba(234,244,251,.8)"; x.font = font(600, 8.5 * d); x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText("RAMP " + rlen + "′", (pa[0] + pb2[0]) / 2, (pa[1] + pb2[1]) / 2);
  }

  /* benches first, then shelves on top */
  const furn = state.items.filter(function (i) { const c = catOf(i); return c && c.stretch; });
  furn.sort(function (p1, p2) { return (CAT[p1.cat].k === "shelf") - (CAT[p2.cat].k === "shelf"); });
  furn.forEach(function (it) {
    const cc = CAT[it.cat], ln = it.ln || 4, isSel = (sel === it.id);
    const exw = (it.rot ? cc.dep : ln), ezh = (it.rot ? ln : cc.dep);
    const p0 = Pt((it.px || 0) - exw / 2, (it.pz || 0) - ezh / 2);
    x.fillStyle = cc.k === "bench" ? BP_COLORS.bench : BP_COLORS.shelf;
    x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.wood; x.lineWidth = (isSel ? 2.2 : 1.2) * d;
    x.fillRect(p0[0], p0[1], exw * S, ezh * S);
    x.strokeRect(p0[0], p0[1], exw * S, ezh * S);
    x.fillStyle = BP_COLORS.wood; x.font = font(600, 8.5 * d); x.textAlign = "center"; x.textBaseline = "middle";
    x.save(); x.translate(p0[0] + exw * S / 2, p0[1] + ezh * S / 2);
    if (it.rot) x.rotate(-Math.PI / 2);
    x.fillText((cc.k === "bench" ? "BENCH " : "SHELF ") + ln + "′", 0, 0);
    x.restore();
  });

  /* inside lights */
  state.items.forEach(function (it) {
    const c = catOf(it); if (!c || c.k !== "ilt") return;
    const q = Pt(it.px || 0, it.pz || 0), isSel = (sel === it.id);
    x.strokeStyle = isSel ? BP_COLORS.picked : BP_COLORS.light; x.lineWidth = 1.4 * d;
    x.beginPath(); x.arc(q[0], q[1], 5.5 * d, 0, 7); x.stroke();
    for (let k2 = 0; k2 < 4; k2++) {
      const an = Math.PI / 4 + k2 * Math.PI / 2;
      x.beginPath(); x.moveTo(q[0] + Math.cos(an) * 7 * d, q[1] + Math.sin(an) * 7 * d); x.lineTo(q[0] + Math.cos(an) * 10.5 * d, q[1] + Math.sin(an) * 10.5 * d); x.stroke();
    }
  });

  /* overall dimensions, drawn like a blueprint */
  const dTop = Pt(0, -L / 2)[1] - 12 * d, dLeft = Pt(-W / 2, 0)[0] - 12 * d;
  dimLine(x, d, Pt(-W / 2, 0)[0], dTop, Pt(W / 2, 0)[0], dTop, ftIn(W));
  dimLine(x, d, dLeft, Pt(0, -L / 2)[1], dLeft, Pt(0, L / 2)[1], ftIn(L));

  /* live dimensions for whatever is picked */
  const selIt = sel ? itemById(state, sel) : null;
  const cs = selIt ? catOf(selIt) : null;
  if (selIt && cs) {
    if (cs.stretch || cs.free) {
      const exs = cs.stretch ? ((selIt.rot ? cs.dep : (selIt.ln || 4)) / 2) : 0;
      const ezs = cs.stretch ? ((selIt.rot ? (selIt.ln || 4) : cs.dep) / 2) : 0;
      const spx = selIt.px || 0, spz = selIt.pz || 0;
      const gy = Pt(0, spz)[1], gx2 = Pt(spx, 0)[0];
      dimLine(x, d, Pt(-W / 2, 0)[0], gy, Pt(spx - exs, 0)[0], gy, ftIn(spx - exs + W / 2));
      dimLine(x, d, gx2, Pt(0, -L / 2)[1], gx2, Pt(0, spz - ezs)[1], ftIn(spz - ezs + L / 2));
    } else if (!cs.gable && cs.k !== "post") {
      const w2 = ws[selIt.wall];
      if (w2) {
        const cw2 = itemW(selIt, CAT);
        const offp = function (u) { const pw = wallPt(w2, u, 0, 0); return Pt(pw[0] + w2.n[0] * 1.7, pw[2] + w2.n[2] * 1.7); };
        /* measure to the nearest neighbour on the wall, not just the corners */
        const gN = neighborGaps(selIt, state, fr);
        const uL = gN ? gN.lo : -w2.len / 2, uR = gN ? gN.hi : w2.len / 2;
        const e1 = offp(uL), a1 = offp(selIt.pos - cw2 / 2), b1 = offp(selIt.pos + cw2 / 2), e2 = offp(uR);
        const g1 = selIt.pos - cw2 / 2 - uL, g2 = uR - (selIt.pos + cw2 / 2);
        if (g1 > 0.15) dimLine(x, d, e1[0], e1[1], a1[0], a1[1], ftIn(g1));
        if (g2 > 0.15) dimLine(x, d, b1[0], b1[1], e2[0], e2[1], ftIn(g2));
      }
    }
  }

  /* labels + title strip */
  x.fillStyle = BP_COLORS.title; x.font = font(600, 11 * d); x.textAlign = "center"; x.textBaseline = "alphabetic";
  x.fillText(titleText(W, L), cx, 18 * d + top);
  x.fillStyle = "rgba(207,227,242,.55)"; x.font = font(600, 8.5 * d);
  x.fillText("FRONT", cx, Pt(0, L / 2)[1] + 26 * d);
  x.textAlign = "right"; x.fillStyle = "rgba(207,227,242,.6)";
  x.fillText(footerText(state, cat, opts.hint), Wc - 10 * d, Hc - 10 * d);
  return BPS;
}

/* The porch outline [x, z, width, length] in feet, or null. Barnwright's
   rules: a front porch is the 4 ft across the front, a right-side porch the
   3 1/2 ft down the side, the corner porch its span across the width. A side
   porch (the Side Cabins) is its 4 ft notch (Barnwright boxed the whole width
   here -- see the note at the top). */
export function porchRect(fr) {
  const t = fr.t, W = fr.d.W, L = fr.d.L;
  if (!t.porch) return null;
  if (t.porch === "F") return [-W / 2, L / 2 - 4, W, 4];
  if (t.porch === "R") return [W / 2 - 3.5, -L / 2, 3.5, L];
  const sp = fr.span;
  if (!sp) return null;
  if (t.porch === "S") return [W / 2 - 4, sp.z0, 4, sp.z1 - sp.z0];
  return [-W / 2, sp.z0, W, sp.z1 - sp.z0];
}

/* Where a porch post is drawn (Barnwright: on the front edge, else down the
   right-hand edge). */
export function postPoint(it, fr, Pt) {
  return (it.wall === "F") ? Pt(it.pos, fr.d.L / 2 - 0.2) : Pt(fr.d.W / 2 - 0.2, -it.pos);
}

/* How far the drawing reaches, in feet from the middle of the building:
   {x0, x1, z0, z1} -- the building's own outline, pushed out wherever a
   door's leaf swings past it or the ramp runs out from it. (The same items
   the drawing treats as doors: anything on a wall that is not a window, a
   roll-up, an outlet, an outside light, a gable window or a post.) */
export function planReach(state, fr, CAT) {
  const W = fr.d.W, L = fr.d.L, ws = fr.ws;
  let x0 = -W / 2, x1 = W / 2, z0 = -L / 2, z1 = L / 2;
  const take = function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); };
  (state.items || []).forEach(function (it) {
    const c = CAT[it.cat]; if (!c || c.gable || c.k === "post" || c.int) return;
    if (c.k === "out" || c.k === "light" || c.k === "win" || c.k === "ru") return;
    const w = ws[it.wall]; if (!w) return;
    const cw = itemW(it, CAT), r = c.leaves === 2 ? cw / 2 : cw;
    take(wallPt(w, it.pos - cw / 2, 0, r)); take(wallPt(w, it.pos + cw / 2, 0, r));
  });
  const rs = rampOf(fr);
  if (rs) { take(wallPt(rs.w, rs.u - rs.width / 2, 0, 0.25 + rs.len)); take(wallPt(rs.w, rs.u + rs.width / 2, 0, 0.25 + rs.len)); }
  return { x0: x0, x1: x1, z0: z0, z1: z1 };
}

/* The ramp on the plan: {w, u, width, len} or null. */
export function rampOf(fr) {
  let len = 0, site = null;
  try { len = rampLength(fr); site = len > 0 ? rampSite(fr) : null; } catch (e) { site = null; }
  if (!site || !(site.width > 0.5) || !(len > 0)) return null;
  return { w: site.w, u: site.u, width: site.width, len: len, porch: !!site.porch, door: site.door };
}

/* ------------------------------------------------------------------------
   What is under a point of the plan (Barnwright bpHit): an overhead light
   within 14 px, then a shelf, then a bench (the footprint and a hair), then
   the nearest door, window, outlet or outside light on a wall. Gable windows
   and porch posts are only picked in 3D, as in Barnwright. p is in the
   canvas's pixels; BPS is what drawPlan returned. */
export function hitAt(p, state, cat, BPS) {
  if (!BPS) return null;
  const d = BPS.d, CAT = cat.CAT, s = BPS.s;
  const wx = (p[0] - BPS.cx) / s, wz = (p[1] - BPS.cy) / s;
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i], c = CAT[it.cat];
    if (c && c.k === "ilt" && Math.hypot(((it.px || 0) - wx) * s, ((it.pz || 0) - wz) * s) < 14 * d) return it.id;
  }
  const furn = state.items.filter(function (i2) { const c = CAT[i2.cat]; return c && c.stretch; });
  furn.sort(function (p1, p2) { return (CAT[p2.cat].k === "shelf") - (CAT[p1.cat].k === "shelf"); });
  for (let j = 0; j < furn.length; j++) {
    const f = furn[j], cc = CAT[f.cat], ln = f.ln || 4;
    const ex = (f.rot ? cc.dep : ln) / 2, ez = (f.rot ? ln : cc.dep) / 2;
    if (Math.abs(wx - (f.px || 0)) <= ex + 0.15 && Math.abs(wz - (f.pz || 0)) <= ez + 0.15) return f.id;
  }
  const ws = BPS.fr.ws;
  let bd = 1e9, bid = null;
  state.items.forEach(function (it) {
    const c = CAT[it.cat]; if (!c || c.gable || c.k === "post") return;
    if (c.int && c.k !== "out") return;
    const w = ws[it.wall]; if (!w) return;
    const cw = itemW(it, CAT) || 1;
    const mid = wallPt(w, it.pos, 0, (c.k === "light") ? 0.7 : 0);
    const q = [BPS.cx + mid[0] * s, BPS.cy + mid[2] * s];
    const dd2 = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const lim = Math.max(12 * d, cw * s / 2 + 6 * d);
    if (dd2 < lim && dd2 < bd) { bd = dd2; bid = it.id; }
  });
  return bid;
}

/* The "Add here" choices on the plan. On a wall: the company's first door,
   first window that goes on a wall, and its plain outlet. On the floor: a
   work bench, a shelf and an overhead light. (Barnwright typed w48 / w23 /
   outlet and bench / shelf / ilight -- the same items in the standard
   catalogue.) */
function firstWith(cat, test) {
  const CAT = cat.CAT;
  const ks = Object.keys(CAT);
  for (let i = 0; i < ks.length; i++) if (test(CAT[ks[i]], ks[i])) return ks[i];
  return null;
}
export function wallChoices(cat) {
  const out = [];
  const door = listOf(cat, "addDoor")[0];
  const win = listOf(cat, "addWindow").filter((k) => !cat.CAT[k].gable)[0];
  const outlet = cat.CAT.outlet && cat.CAT.outlet.k === "out" && !cat.CAT.outlet.switch ? "outlet" : firstWith(cat, (c) => c.k === "out" && !c.switch);
  if (door) out.push(["+ Door", door]);
  if (win) out.push(["+ Window", win]);
  if (outlet) out.push(["+ Electrical", outlet]);
  return out;
}
export function floorChoices(cat) {
  const out = [];
  const bench = firstWith(cat, (c) => c.stretch && c.k === "bench");
  const shelf = firstWith(cat, (c) => c.stretch && c.k === "shelf");
  const light = firstWith(cat, (c) => c.free && c.k === "ilt");
  if (bench) out.push(["+ Work bench", bench]);
  if (shelf) out.push(["+ Shelf", shelf]);
  if (light) out.push(["+ Electrical", light]);
  return out;
}

/* ------------------------------------------------------------------------
   For the quote pictures: the whole plan on a new canvas, w x h pixels. */
export function drawPlanPicture(state, catalogue, w, h, opts) {
  opts = opts || {};
  const cv = document.createElement("canvas");
  cv.width = Math.max(2, Math.round(w || 600));
  cv.height = Math.max(2, Math.round(h || 420));
  const x = cv.getContext("2d");
  if (!x) throw new Error("drawPlanPicture: this browser cannot draw on a canvas.");
  drawPlan(x, cv.width, cv.height, opts.scale || 1, state, catalogue, { zoom: 1, ox: 0, oy: 0 }, { selection: opts.selection, hint: false });
  return cv;
}

/* ------------------------------------------------------------------------
   THE PLUGIN: plug the plan into the page (ui/app.js calls this once). */
let cssAdded = false;
function addCss() {
  if (cssAdded || typeof document === "undefined") return;
  cssAdded = true;
  if (document.querySelector('link[data-blueprint-css]')) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = new URL("./blueprint.css", import.meta.url).href;
  l.setAttribute("data-blueprint-css", "");
  document.head.appendChild(l);
}

export function install(api) {
  const canvas = (api.mounts && api.mounts.bp) || document.getElementById("bp");
  const cat = api.getCatalogue();
  const modebar = document.getElementById("modebar");
  if (cat.features && cat.features.floorPlan === false) {
    /* this company switched the Inside view off: no button for it */
    if (modebar) modebar.style.display = "none";
    return;
  }
  if (!canvas || !canvas.getContext) return;
  const x = canvas.getContext("2d");
  if (!x) { console.error("The floor plan could not start: this browser cannot draw on a canvas."); return; }
  addCss();

  const view = { zoom: 1, ox: 0, oy: 0 };
  let BPS = null;
  const dpr = () => window.devicePixelRatio || 1;

  /* Barnwright bpSize: the canvas's pixels match its size on screen */
  function size() {
    const d = dpr();
    const w = Math.max(2, Math.round((canvas.clientWidth || 600) * d));
    const h = Math.max(2, Math.round((canvas.clientHeight || 420) * d));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }
  /* The view switcher (ui/views.js) sits over the top of the stage; when
     it would cover the title, the title and the plan move down under it. */
  function topReserve() {
    const vm = api.mounts && api.mounts.view;
    if (!vm || !vm.children || !vm.children.length) return 0;
    const r = vm.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    if (!r.width || !r.height || !cr.width) return 0;
    if (r.right - cr.left < cr.width / 2 - 90) return 0;       /* clear of the title's middle */
    return Math.max(0, (r.bottom - cr.top) + 16 - 18) * dpr();
  }
  /* The price plate (#plate) lies over the foot of the stage. On a phone it
     runs the whole width, right across the front of the building -- the
     doors, their swings and the word FRONT were drawn underneath it. When
     it covers the middle of the plan, the plan keeps clear of it. (On a
     computer it sits in the corner, clear of the plan, and nothing moves.) */
  function bottomReserve() {
    const pl = document.getElementById("plate");
    if (!pl) return 0;
    const r = pl.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    if (!r.width || !r.height || !cr.width || r.top >= cr.bottom || r.bottom <= cr.top) return 0;
    const mid = cr.left + cr.width / 2;
    if (r.right < mid - 90 || r.left > mid + 90) return 0;       /* off to one side, clear of the plan's middle */
    return Math.max(0, cr.bottom - r.top + 4) * dpr();
  }
  function draw() {
    if (api.getMode() !== "in") return null;
    if (canvas.width < 3) size();
    try { BPS = drawPlan(x, canvas.width, canvas.height, dpr(), api.getState(), cat, view, { topReserve: topReserve(), bottomReserve: bottomReserve() }); }
    catch (e) { console.error("The floor plan could not be drawn:", e); }
    return BPS;
  }

  /* the Inside button, and "this only shows on the floor plan" */
  api.onInside = function (req) {
    const want = (req && req.want) || "toggle";
    if (want === "in") { if (api.getMode() !== "in") api.setMode("in"); else draw(); }
    else if (want === "out") { if (api.getMode() !== "out") api.setMode("out"); }
    else api.setMode(api.getMode() === "in" ? "out" : "in");
  };
  api.on("mode", function (e) {
    if (e && e.mode === "in") { size(); draw(); }
    else { cancelGestures(); canvas.classList.remove("bpdragging"); }
  });
  api.on("rebuild", draw);
  api.on("change", draw);
  api.on("select", draw);

  /* the plan follows the canvas's size (the window turning, the layout
     switching between one and two columns) */
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(function () { if (api.getMode() === "in") { size(); draw(); } }).observe(canvas);
  }
  window.addEventListener("resize", function () { if (api.getMode() === "in") { size(); draw(); } });
  /* when Oswald arrives, the letters are drawn again in it */
  try {
    if (document.fonts) {
      if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", draw);
      if (document.fonts.ready) document.fonts.ready.then(draw, function () {});
    }
  } catch (e) { /* old browsers */ }

  /* ---------- touch (Barnwright's plan touch code) ---------- */
  let down = null, last = null, moved = false, dragIt = null, dragFr = null, lp = null, lpf = false;
  let ptrs = {}, pinch = 0, mid = null, multi = false, lastTap = 0;

  function cancelGestures() {
    if (lp) { clearTimeout(lp); lp = null; }
    ptrs = {}; pinch = 0; mid = null; multi = false; down = null; dragIt = null; dragFr = null; lpf = false;
  }
  function ptOf(e) { const r = canvas.getBoundingClientRect(), d = dpr(); return [(e.clientX - r.left) * d, (e.clientY - r.top) * d]; }
  function world(p) { return [(p[0] - BPS.cx) / BPS.s, (p[1] - BPS.cy) / BPS.s]; }
  function hit(p) { if (!BPS) draw(); return hitAt(p, api.getState(), cat, BPS); }

  function longPress(pp) {
    lp = null;
    if (!BPS) return;
    const wp = world(pp), wx = wp[0], wz = wp[1], dm = BPS.fr.d, d1 = dpr();
    if (Math.abs(wx) > dm.W / 2 + 0.6 || Math.abs(wz) > dm.L / 2 + 0.6) return;
    const edgeX = dm.W / 2 - Math.abs(wx), edgeZ = dm.L / 2 - Math.abs(wz);
    lpf = true;
    if (Math.min(edgeX, edgeZ) < 1.6) {
      const wall = (edgeX < edgeZ) ? (wx > 0 ? "R" : "L") : (wz > 0 ? "F" : "B");
      const w = BPS.fr.ws[wall], b0 = wallPt(w, 0, 0, 0);
      const u = (wx - b0[0]) * w.ax[0] + (wz - b0[2]) * w.ax[2];
      api.showAddPop(pp[0] / d1, pp[1] / d1, { wall: wall, u: u }, wallChoices(cat));
    } else {
      api.showAddPop(pp[0] / d1, pp[1] / d1, { px: wx, pz: wz, rot: (edgeX < edgeZ) }, floorChoices(cat));
    }
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.cancelable) e.preventDefault();
    api.hideAddPop();
    if (api.camera) api.camera.interacted = true;
    if (!BPS) draw();
    const p = ptOf(e);
    if (e.isPrimary) { ptrs = {}; pinch = 0; mid = null; multi = false; }
    ptrs[e.pointerId] = p;
    if (Object.keys(ptrs).length === 2) {                  /* second finger: pinch, no tap/press */
      multi = true; dragIt = null; down = null;
      if (lp) { clearTimeout(lp); lp = null; }
      const ks = Object.keys(ptrs), Aq = ptrs[ks[0]], Bq = ptrs[ks[1]];
      pinch = Math.hypot(Aq[0] - Bq[0], Aq[1] - Bq[1]);
      mid = [(Aq[0] + Bq[0]) / 2, (Aq[1] + Bq[1]) / 2];
      return;
    }
    down = p; last = p; moved = false; lpf = false;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not every browser */ }
    const state = api.getState();
    const h = hit(p);
    dragIt = (h && h === state.sel && !api.readOnly) ? itemById(state, h) : null;   /* only the picked item drags */
    dragFr = dragIt ? frameOf(state, cat) : null;
    if (dragIt) canvas.classList.add("bpdragging");
    if (lp) { clearTimeout(lp); lp = null; }
    if (!h && !api.readOnly) { const pp = p; lp = setTimeout(function () { longPress(pp); }, 500); }
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!ptrs[e.pointerId] && !down) return;
    const d = dpr(), p = ptOf(e);
    if (ptrs[e.pointerId]) ptrs[e.pointerId] = p;
    const ks = Object.keys(ptrs);
    if (ks.length === 2) {                                 /* pinch to zoom + two-finger pan */
      const Aq = ptrs[ks[0]], Bq = ptrs[ks[1]];
      const dist = Math.hypot(Aq[0] - Bq[0], Aq[1] - Bq[1]);
      const mp = [(Aq[0] + Bq[0]) / 2, (Aq[1] + Bq[1]) / 2];
      if (pinch > 0) view.zoom = Math.max(1, Math.min(5, view.zoom * dist / pinch));
      if (mid) { view.ox += mp[0] - mid[0]; view.oy += mp[1] - mid[1]; }
      pinch = dist; mid = mp; draw(); return;
    }
    if (!down || lpf) return;
    if (Math.hypot(p[0] - down[0], p[1] - down[1]) > 3 * d) { moved = true; if (lp) { clearTimeout(lp); lp = null; } }
    if (dragIt && BPS) {
      /* nothing slides until the finger has really moved (more than 3 px):
         a tap on the picked item always wobbles a pixel or two, and even
         that used to slide it -- and ease it up to 0.22 ft onto the middle
         of its space -- without the move ever being saved as a change (a
         tap is not a drag). The first real move then carries the whole way
         from where the finger went down, so a drag loses nothing. */
      if (!moved) return;
      const dwx = (p[0] - last[0]) / BPS.s, dwz = (p[1] - last[1]) / BPS.s;
      const c = cat.CAT[dragIt.cat], state = api.getState(), fr = dragFr || frameOf(state, cat);
      if (c.free || c.stretch) { dragIt.px = (dragIt.px || 0) + dwx; dragIt.pz = (dragIt.pz || 0) + dwz; }
      else { const w = fr.ws[dragIt.wall]; if (w) dragIt.pos += dwx * w.ax[0] + dwz * w.ax[2]; }
      clampPos(dragIt, state, fr);
      if (snapCenter(dragIt, state, fr)) clampPos(dragIt, state, fr);   /* ease onto the midpoint between neighbours */
      draw();
    } else if (moved) { view.ox += p[0] - last[0]; view.oy += p[1] - last[1]; draw(); }   /* drag empty paper to pan */
    last = p;
  });

  function end(e) {
    delete ptrs[e.pointerId];
    if (Object.keys(ptrs).length < 2) { pinch = 0; mid = null; }
    if (lp) { clearTimeout(lp); lp = null; }
    canvas.classList.remove("bpdragging");
    if (lpf) { lpf = false; down = null; dragIt = null; dragFr = null; return; }
    if (multi) { if (Object.keys(ptrs).length === 0) multi = false; down = null; dragIt = null; dragFr = null; return; }
    if (down && !moved) {
      const h = hit(ptOf(e)), now = Date.now();
      if (!h && now - lastTap < 320) { view.zoom = 1; view.ox = 0; view.oy = 0; lastTap = 0; api.select(null); draw(); }   /* double-tap: fit again */
      else { lastTap = now; if (h || api.getState().sel) api.select(h || null); }   /* nothing picked and nothing hit: nothing to do */
    } else if (dragIt) {
      /* the move is finished: the rules run, the cards and the 3D building catch up */
      api.setState(function () { return null; }, { reason: "move" });
    }
    down = null; dragIt = null; dragFr = null;
  }
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  /* A finger lifted off the plan must not ALSO "click" whatever is under it
     a moment later. Picking an item opens the item sheet, which scrolls the
     page; the click the browser sends after a tap then landed on the
     "Outside -- 3D view" button now under the finger and threw the customer
     back to the 3D picture (found on a 390 x 844 phone: tap the doors on
     the plan, and the plan was gone). Cancelling the end of the touch stops
     that click; the plan works from the pointer events above and never
     needed it. */
  canvas.addEventListener("touchend", function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });

  /* ---------- for the checks, and for anybody plugging in after us ---------- */
  api.blueprint = {
    draw: draw,
    /* {zoom, ox, oy, s, cx, cy, d}: where the plan is on the canvas now */
    view: function () { return Object.assign({ zoom: view.zoom, ox: view.ox, oy: view.oy }, BPS ? { s: BPS.s, cx: BPS.cx, cy: BPS.cy, d: BPS.d, TH: BPS.TH, top: BPS.top, bot: BPS.bot } : {}); },
    /* feet on the floor (x across, z along, front +z) -> CSS pixels in the canvas */
    toScreen: function (wx, wz) { if (!BPS) draw(); if (!BPS) return null; return [(BPS.cx + wx * BPS.s) / BPS.d, (BPS.cy + wz * BPS.s) / BPS.d]; },
    toWorld: function (px, py) { if (!BPS) draw(); if (!BPS) return null; return [(px * BPS.d - BPS.cx) / BPS.s, (py * BPS.d - BPS.cy) / BPS.s]; },
    /* the item under CSS pixel (px, py) of the canvas, as a tap would find it */
    hit: function (px, py) { return hit([px * dpr(), py * dpr()]); },
    reset: function () { view.zoom = 1; view.ox = 0; view.oy = 0; draw(); },
  };
  if (api.getMode() === "in") { size(); draw(); }
}

export default install;
