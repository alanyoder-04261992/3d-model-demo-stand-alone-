/* The unchanged customer item placement rules, shared by runtime layouts and
   the standard-layout checker. Node-safe. Default building geometry stays exact. */
import { y0 } from "../engine/constants.js";
import { openingTrim } from "./opening-trim.js";
import { profileYat } from "./roof-shapes.js";
import { porchDepthOf } from "./frame.js";

/* THE DOUBLE WINDOW: two windows butted together in ONE opening, sharing a
   single trim board down the middle. CASING is the 3 1/2 in board that runs
   round every opening, and the shared middle board is one of them. */
export function itemW(it, CAT, frame) {
  var c = CAT[it.cat];
  if (it.rot && c.draw === "transom") return c.h;                     /* a transom stood on end */
  if (it.dbl && c.k === "win" && !c.gable) return 2 * c.w + openingTrim(frame).width;
  return c.w;
}

export function clampPos(it, state, frame) {
  var CAT = frame.CAT, T = frame.t, ws = frame.ws;
  var c0 = CAT[it.cat], c = c0;
  if (it.rot && c0.draw === "transom") { c = { k: c.k, n: c.n, w: c.h, h: c.w, p: c.p, sill: c.sill }; }
  if (c.free || c.stretch) {                                      /* benches, shelves, inside lights */
    var dI = frame.d, hw = dI.W / 2 - 0.35, hl = dI.L / 2 - 0.35;
    if (c.stretch) {
      /* benches and shelves may run the full nominal length of the build —
         the shop calls a 20-ft shelf 20 ft even though the studs eat 7 in */
      var mx = (it.rot ? dI.L : dI.W);
      it.ln = Math.max(2, Math.min(Math.round(it.ln || 4), Math.round(mx)));
      var ex = (it.rot ? c.dep : it.ln) / 2, ez = (it.rot ? it.ln : c.dep) / 2;
      var lox = -hw + ex, hix = hw - ex, loz = -hl + ez, hiz = hl - ez;
      it.px = (lox > hix) ? 0 : Math.max(lox, Math.min(hix, it.px || 0));
      it.pz = (loz > hiz) ? 0 : Math.max(loz, Math.min(hiz, it.pz || 0));
    } else {
      it.px = Math.max(-hw + 0.4, Math.min(hw - 0.4, it.px || 0));
      it.pz = Math.max(-hl + 0.4, Math.min(hl - 0.4, it.pz || 0));
    }
    return;
  }
  if (c.gable) {
    var d = frame.d;
    if (it.wall === "R" || it.wall === "L") {
      var wG = ws[it.wall], limG = Math.max(0, wG.len / 2 - c.w / 2 - 0.5);
      it.pos = Math.max(-limG, Math.min(limG, it.pos));
      var baseG = y0 + Math.min(4.6, T.wallH - 1.0);
      it.vy = Math.max((y0 + 1.0 + c.h / 2) - baseG, Math.min((wG.top - 0.30 - c.h / 2) - baseG, it.vy || 0));
    } else {
      var lim0 = d.W / 2 - c.w / 2 - 0.6; it.pos = Math.max(-lim0, Math.min(lim0, it.pos));
      var profC = frame.prof, topC = y0 + T.wallH, peakC = profileYat(profC, 0);
      var baseC = topC + Math.max(0.62 + c.h / 2, (peakC - topC) * 0.34);
      var capC = Math.min(peakC - 0.35, profileYat(profC, Math.min(d.W / 2, Math.abs(it.pos) + c.w / 2)) - 0.22) - c.h / 2;
      it.vy = Math.max((topC + 0.14 + c.h / 2) - baseC, Math.min(Math.max(topC + 0.14 + c.h / 2, capC) - baseC, it.vy || 0));
    }
    return;
  }
  if (c0.draw === "transom" && it.rot && T.roof === "slope" && it.wall === "R") it.rot = false;  /* the high transom row has no room for a turned one */
  /* c.w is the clear opening — the 3 1/2" casing lives OUTSIDE it, so keep
     enough room that trim never laps the corner post */
  var w = ws[it.wall], lim = w.len / 2 - itemW(it, CAT, frame) / 2 - 0.50;
  if (lim < 0) lim = 0;
  if (c.k === "light") it.vy = Math.max(-4.2, Math.min(3.2, it.vy || 0));
  it.pos = Math.max(-lim, Math.min(lim, it.pos));
  /* MAKING ROOM TAKES MORE THAN ONE PASS on a crowded wall: pushing clear of
     the door can walk an item straight into the window on the far side, and by
     then the door has been dealt with. So settle it. */
  for (var pass9 = 0; pass9 < 4; pass9++) {
    var was9 = it.pos;
    state.items.forEach(function (o) {
      if (o === it || o.wall !== it.wall || CAT[o.cat].gable || CAT[o.cat].k === "post" || c.k === "post" || o.id === it.id) return;
      /* electrical mounts beside or above anything, so outlets, switches and
         lights may slide across doors, windows, benches and shelves freely */
      var ke = c.k, ko = CAT[o.cat].k;
      if (ke === "light" || ke === "out" || ke === "ilt" || ko === "light" || ko === "out" || ko === "ilt") return;
      var band1 = (T.roof === "slope" && it.wall === "R" && c0.draw === "transom"), band2 = (T.roof === "slope" && o.wall === "R" && CAT[o.cat].draw === "transom");
      if (band1 !== band2) return;
      var need = (itemW(it, CAT, frame) + itemW(o, CAT, frame)) / 2 + 0.62, dv = it.pos - o.pos;   /* two 3 1/2" casings plus a hair of siding */
      if (Math.abs(dv) < need) it.pos = o.pos + (dv < 0 ? -need : need);
    });
    it.pos = Math.max(-lim, Math.min(lim, it.pos));
    if (Math.abs(it.pos - was9) < 1e-9) break;
  }
  if (T.kennel && (it.wall === "R" || it.wall === "L")) {
    var lo = c.w / 2 + 0.55;
    if (it.wall === "R") it.pos = Math.max(lo, it.pos);
    else it.pos = Math.min(-lo, it.pos);
  }
  if (T.porch === "S") {
    var spS = frame.span, dS = frame.d;
    if (c.k === "post") {
      if (it.wall === "R") it.pos = Math.max(-spS.z1 + 0.85, Math.min(-spS.z0 - 0.85, it.pos));
    } else if (!c.gable) {
      if (it.wall === "R") {
        if (spS.mid) {
          var cwm = c.w / 2 + 0.45;
          var aLo = spS.P / 2 + cwm, aHi = dS.L / 2 - cwm, bLo = -dS.L / 2 + cwm, bHi = -spS.P / 2 - cwm;
          if (it.pos >= 0) it.pos = (aHi < aLo) ? Math.max(bLo, Math.min(bHi, it.pos)) : Math.max(aLo, Math.min(aHi, it.pos));
          else it.pos = (bHi < bLo) ? Math.max(aLo, Math.min(aHi, it.pos)) : Math.max(bLo, Math.min(bHi, it.pos));
        } else {
          var rl = spS.f ? -dS.L / 2 + c.w / 2 + 0.45 : spS.P - dS.L / 2 + c.w / 2 + 0.45;
          var rh = spS.f ? dS.L / 2 - spS.P - c.w / 2 - 0.45 : dS.L / 2 - c.w / 2 - 0.45;
          it.pos = (rh < rl) ? (rl + rh) / 2 : Math.max(rl, Math.min(rh, it.pos));
        }
      }
      /* clear of the porch notch (the porch depth, 4 ft standard) */
      var pdS = porchDepthOf(T);
      if (!spS.mid && it.wall === "F" && !spS.f) it.pos = Math.min(dS.W / 2 - pdS - c.w / 2 - 0.35, it.pos);
      if (!spS.mid && it.wall === "B" && spS.f) it.pos = Math.max(pdS - dS.W / 2 + c.w / 2 + 0.35, it.pos);
    }
  }
  if (T.porch === "C") {
    var dC = frame.d;
    if (c.k === "post") {
      if (it.wall === "F") it.pos = Math.max(-dC.W / 2 + 0.85, Math.min(dC.W / 2 - 0.85, it.pos));
      else if (it.wall === "R") it.pos = Math.max(0.85 - dC.L / 2, Math.min(11.4 - dC.L / 2, it.pos));
    } else if (!c.gable) {
      if (it.wall === "F") {
        var f0 = -dC.W / 2 + c.w / 2 + 0.35, f1 = -dC.W / 2 + 4 - c.w / 2 - 0.35;
        it.pos = (f1 < f0) ? -dC.W / 2 + 2 : Math.max(f0, Math.min(f1, it.pos));
      }
      if (it.wall === "R") it.pos = Math.max(12 - dC.L / 2 + c.w / 2 + 0.45, it.pos);
      if (it.wall === "L") it.pos = Math.min(dC.L / 2 - porchDepthOf(T) - c.w / 2 - 0.45, it.pos);   /* clear of the porch deck */
    }
  }
}

