/* ROOF DECK: what the steel roof is screwed to. Node-safe.

   NEW -- Barnwright drew none. On top of the roof framing, directly under the
   steel, real buildings carry one of two decks, per the construction setting
   roofDeck.type (library/construction.json: purlins on a metal building, OSB
   otherwise):
   * PURLINS -- {roofDeck.purlins.size} boards laid FLAT across the trusses,
     running the whole length of the roof (out over the gable-end overhangs),
     every roofDeck.purlins.spacingIn inches up each slope: the first flush
     with the eave (or a gambrel's knee), then on the spacing, and one flush
     at the top of the slope under the ridge (or the knee). The rows of
     screws the roofing part draws "about every two feet of slope where the
     purlins are" are these.
   * OSB -- sheets roofDeck.sheathingIn thick, 4 ft up the slope by 8 ft
     along the building (the standard sheet), laid from each eave (or knee)
     upward and from the back gable end forward, with the usual 1/8 in gap
     between sheets; the top row and the last sheet are cut to fit, and the
     two slopes meet in a mitre at the ridge.
   Either deck fills the space between the underside of the drawn roof slab
   and the tops of the rafters/trusses (parts/roof-frame.js puts the framing
   exactly one deck-thickness down), runs out over the eave to the tip of the
   drawn roof and over the gable-end (rake) overhang, and, where it crosses a
   wall, is cut off at the wall top like everything else (the drawn roof meets
   the wall top in a sharp corner). On a Dormer Shed it is left open where the
   dormer stands (roof-frame dormerHoles): the dormer's inside and the strip
   its front wall stands in; the dormer's own deck is in parts/dormer-frame.js.

   STAGE "roof-deck" (kind frame): hidden in the Finished view, shown in the
   Framing view, lands just before the roofing in Watch-it-build and is
   covered when the roofing lands. PIPELINE entry "roof-deck" (parts/index.js),
   among the framing entries. */

import {
  roofSection, dormerHoles, band, fitRoof, zRange, clipHalf, cleanPoly, splitX, drawMembers,
} from "./roof-frame.js";

/* The standard OSB sheet and the gap the maker asks for between sheets. */
export const SHEET_UP = 4, SHEET_ALONG = 8, SHEET_GAP = 0.125 / 12;

/* Cut a member's length (z) around boxes in x and z where it must not be:
   returns the pieces that are left. */
export function subtractBoxes(m, boxes) {
  var cuts = [m.z0, m.z1];
  boxes.forEach(function (b) {
    if (b.z0 > m.z0 && b.z0 < m.z1) cuts.push(b.z0);
    if (b.z1 > m.z0 && b.z1 < m.z1) cuts.push(b.z1);
  });
  cuts.sort(function (a, b) { return a - b; });
  var out = [];
  for (var i = 0; i + 1 < cuts.length; i++) {
    var za = cuts[i], zb = cuts[i + 1];
    if (zb - za < 1e-6) continue;
    var zm = (za + zb) / 2;
    var polys = [m.poly];
    boxes.forEach(function (b) {
      if (zm <= b.z0 || zm >= b.z1) return;
      polys = [].concat.apply([], polys.map(function (p) { return splitX(p, b.x0, b.x1); }));
    });
    polys.forEach(function (p) {
      var n = Object.assign({}, m, { poly: p, z0: za, z1: zb });
      /* join onto the piece just before it when it is the same board */
      var prev = out[out.length - 1];
      if (prev && Math.abs(prev.z1 - za) < 1e-9 && samePoly(prev.poly, p)) prev.z1 = zb;
      else out.push(n);
    });
  }
  return out;
}
function samePoly(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (Math.abs(a[i][0] - b[i][0]) > 1e-9 || Math.abs(a[i][1] - b[i][1]) > 1e-9) return false;
  return true;
}

/* The pieces of one deck layer (thickness d, as data) laid on a section's
   slopes. sec: a roof section (roof-frame roofSection, or the dormer's own
   one-slope section). Returns members {poly, z0, z1, kind, mat}. */
/* PURLIN POSITIONS up one slope (distances from its low end to each
   purlin's lower edge): the first flush on the low end, then one every
   spacing, and the last flush at the top (sHi). Over a stretch they cannot
   lie on (dead: a tall wall's framing), one goes just before it and the next
   just after it. No gap is ever wider than the spacing except across such a
   stretch; where the top one would crowd the last regular one, the regular
   one steps down just clear of it (or is left out, if the gap below still
   holds). */
export function layPurlins(sLo, sHi, dead, sp, pw) {
  var pos = [];
  if (sHi - sLo <= pw + 0.02) return [sLo];
  function room(a) { return !pos.length || a >= pos[pos.length - 1] + pw + 0.02 - 1e-9; }
  var s = sLo;
  while (s <= sHi - pw + 1e-9) {
    var d = null;
    for (var k = 0; k < dead.length; k++) if (s + pw > dead[k][0] + 1e-9 && s < dead[k][1] - 1e-9) { d = dead[k]; break; }
    if (d) {
      var before = d[0] - pw;
      if (before >= sLo - 1e-9 && room(before)) pos.push(before);
      s = d[1];
      continue;
    }
    pos.push(s);
    s += sp;
  }
  var fin = sHi - pw;
  var last = pos[pos.length - 1];
  if (last != null && fin - last < pw + 0.02 - 1e-9) {
    if (pos.length >= 2 && fin - pos[pos.length - 2] <= sp + 1e-9) pos.pop();
    else {
      pos[pos.length - 1] = fin - pw - 0.02;
      if (pos.length >= 2 && pos[pos.length - 1] < pos[pos.length - 2] + pw + 0.02) pos.pop();
    }
  }
  pos.push(fin);
  return pos;
}

export function deckOnSection(sec, opts) {
  var out = [], type = opts.type, d = opts.d, fit = opts.fit || function (p) { var c = cleanPoly(p); return c ? [c] : []; };
  sec.segs.forEach(function (s, i) {
    var zr = opts.zRange ? opts.zRange(i) : zRange(sec, i);
    var rising = s.B[1] >= s.A[1];                /* rows start at the LOW end */
    /* distance along the slope from the low end */
    function hp(sFrom, keepFar) {
      /* half-plane "at least sFrom from the low end" (keepFar) or "at most" */
      var t = s.t, o = rising ? s.A : s.B, dir = rising ? 1 : -1;
      var a = -dir * t[0], b = -dir * t[1], c = -(dir * (t[0] * o[0] + t[1] * o[1]) + sFrom);
      return keepFar ? [a, b, c] : [-a, -b, -c];
    }
    var full = band(sec, i, 0, d);
    var rows = [];
    if (type === "osb") {
      for (var k = 0; k * (SHEET_UP + SHEET_GAP) < s.len; k++) {
        var s0 = k * (SHEET_UP + SHEET_GAP), s1 = s0 + SHEET_UP;
        var p = full;
        if (k > 0) p = clipHalf(p, hp(s0, true));
        if (s1 < s.len - 1e-6) p = clipHalf(p, hp(s1, false));
        rows.push(p);
        if (s1 >= s.len - 1e-6) break;
      }
    } else {
      var pw = opts.pw, sp = opts.spacing;
      /* along the slope, from the low end: a tall wall's framing (lean-to,
         single slope) rises to the roof line, so no purlin can lie over it;
         where it closes the top of the slope (a lean-to's high side) the
         last purlin sits flush against it instead of at the roof's end */
      var sAt = function (x) { return rising ? (x - s.A[0]) / s.t[0] : (s.B[0] - x) / s.t[0]; };
      var dead = (opts.dead || []).map(function (z) { var a = sAt(z.x0), b = sAt(z.x1); return [Math.max(0, Math.min(a, b)), Math.min(s.len, Math.max(a, b))]; })
        .filter(function (iv) { return iv[1] - iv[0] > 1e-9; }).sort(function (a, b) { return a[0] - b[0]; });
      /* merge touching stretches, then any at either end of the slope trims it */
      var md = [];
      dead.forEach(function (iv) { var l = md[md.length - 1]; if (l && iv[0] <= l[1] + 1e-9) l[1] = Math.max(l[1], iv[1]); else md.push(iv.slice()); });
      var sLo = 0, sHi = s.len;
      if (md.length && md[0][0] <= 1e-6) sLo = md.shift()[1];
      if (md.length && md[md.length - 1][1] >= s.len - 1e-6) sHi = md.pop()[0];
      var pos = layPurlins(sLo, sHi, md, sp, pw);
      pos.forEach(function (a0) {
        var p = full;
        if (a0 > 1e-9) p = clipHalf(p, hp(a0, true));
        if (a0 + pw < s.len - 1e-9) p = clipHalf(p, hp(a0 + pw, false));
        p.at = a0; p.top = sHi; p.bottom = sLo;
        rows.push(p);
      });
    }
    rows.forEach(function (p) {
      fit(p).forEach(function (piece) {
        if (type === "osb") {
          /* as many sheets as the length needs, cut to equal lengths (so no
             sliver is left hanging out over a gable-end overhang) */
          var run = zr[1] - zr[0], nSh = Math.max(1, Math.ceil((run + SHEET_GAP) / (SHEET_ALONG + SHEET_GAP) - 1e-9));
          var shL = (run - (nSh - 1) * SHEET_GAP) / nSh;
          for (var k2 = 0; k2 < nSh; k2++) {
            var za = zr[0] + k2 * (shL + SHEET_GAP);
            out.push({ poly: piece, z0: za, z1: k2 === nSh - 1 ? zr[1] : za + shL, kind: "osb-sheet", mat: "osb", seg: i });
          }
        } else {
          out.push({ poly: piece, z0: zr[0], z1: zr[1], kind: "purlin", mat: "lumber", seg: i, at: p.at, top: p.top, bottom: p.bottom, len: s.len });
        }
      });
    });
  });
  return out;
}

export function roofDeckMembers(plan) {
  var sec = roofSection(plan);
  var list = deckOnSection(sec, {
    type: sec.deckType, d: sec.deckT, pw: sec.purlin.d,
    dead: sec.inner.filter(function (r) { return r.floor > sec.topY + 1e-9; })
      .concat([sec.left, sec.right].filter(function (sd) { return sd.eave && !sd.tails; })
        .map(function (sd) { return sd.left ? { x0: sd.x, x1: -sec.W / 2 } : { x0: sec.W / 2, x1: sd.x }; })),
    spacing: (((plan.construction || {}).roofDeck || {}).purlins || {}).spacingIn / 12 || 2,
    fit: function (p) { return fitRoof(sec, p); },
  });
  var holes = dormerHoles(plan);
  if (!holes.length) return list;
  return [].concat.apply([], list.map(function (m) { return subtractBoxes(m, holes); }));
}

export default {
  id: "roof-deck",
  name: "Roof deck",
  stage: "roof-deck",
  realLife: "The deck the steel roof is screwed to ({roofDeck.type} on this building): on a metal building {roofDeck.purlins.size} purlins laid flat every {roofDeck.purlins.spacingIn} in up each slope, otherwise OSB sheathing {roofDeck.sheathingIn} in thick, run out over the eaves and the gable-end overhangs.",
  appliesTo() { return true; },
  members(plan) { return roofDeckMembers(plan); },
  build(plan, kit) {
    kit.setStage("roof-deck");
    drawMembers(kit, roofDeckMembers(plan));
  },
};
