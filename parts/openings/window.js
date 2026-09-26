/* THE WALL WINDOW: the 2x3 and 3x3 double-hung windows, the 36x12 transom
   (lying flat or stood on end), a DOUBLE window (two sharing one middle
   board), and the board-and-batten SHUTTERS that can go either side.
   Node-safe.

   Drawn in the wall's own coordinates, in front of the unbroken siding: the
   shared opening frame first (common.js openingFrame: tap target, soft
   shadow, side casings running right up into the head, the 22.5-degree head,
   the porch header band on a porch building), then:
   * the sloped SILL (common.js windowSill), widest at its bottom;
   * on a double window, the one casing board the pair share, standing on end
     between them;
   * per pane: a white frame ring with the glass set back behind a reveal, and
     the glazing --
       - a transom stood on end: one tall pane, its two bars turned with it;
       - over 2 ft tall: double-hung, the lower sash proud of the upper, an
         insect SCREEN in the lower sash, a meeting rail, a cross bar in each
         sash;
       - otherwise (the transom lying flat): three lites, two upright bars;
   * SHUTTERS (it.shut), one each side of the whole opening: board and batten,
     three boards with a daylight gap and three battens across them. Their
     colour is the shutter colour, else the trim colour -- darkened when the
     trim is the same colour as the siding, so they still show.
   The glazing is chosen by HEIGHT (over 2.0 ft is double-hung), not by which
   window it is, and the stood-on-end transom is tested FIRST, because turning
   it swaps its height to 3 ft.

   STAGES: "windows" for the window (set by parts/openings/index.js before it
   hands over); "extras" for the shutters. The shutters' triangles still
   belong to this part ("window"), as they do in Barnwright's recording.

   Ported from Barnwright's 3ddesign.html, renderItem's window branch (lines
   3468-3571; the sill, 3469-3481, is common.js windowSill). Porting edits:
   rule 1 (state -> plan.state; mat wq quadUV wallPt are the kit's, wslab wret
   wrev the item primitives), rule 3 (it.cat==="tr" -> the "transom" draw
   trait; the window reaches this module by the "window" and "transom" draw
   traits, where Barnwright's else-branch took everything that was not a door),
   rule 7 (kit.setStage("extras") before the shutters). Every number is
   Barnwright's.

   KEPT AS BARNWRIGHT WROTE IT: the long note below about the shared middle
   board "not drawn yet" is STALE -- the board IS drawn (the wq on the line
   `if(panes.length>1)`), as a flat board at 0.125 from yb-0.01 to
   yb+c.h+0.01. Do not "add it back" as that note says: it would be drawn
   twice and the look would change. */

import { texTrim, texFlat } from "../../engine/tex-names.js";
import { hexRGB, srgbLin, tintShade } from "../../engine/math.js";
import { itemTools, openingFrame, windowSill, hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["window", "transom"]);

/* one wall window, after the renderItem preamble (common.js eachItem) */
function drawWindow(plan, kit, it, c, mats) {
  var mT=mats.mT, mWht=mats.mWht, mG=mats.mG;
  var op=openingFrame(plan, kit, it, c, mT);
  if(!op) return;
  var P=itemTools(kit), wslab=P.wslab, wret=P.wret, wrev=P.wrev;
  var mat=kit.mat, wq=kit.wq;
  var w=op.w, yb=op.yb, u=op.u, fr=op.fr, HW2=op.HW2;
  var state=plan.state;
  windowSill(plan, kit, op, mT);
  /* ONE SASH SET PER PANE. A double window is two windows in one opening
     sharing a single board down the middle -- the photograph Alan sent of a
     real pair -- so the casing, head and sill above already span both and
     only the glazing repeats. */
  var panes=(HW2>c.w/2) ? [u-(c.w+fr)/2, u+(c.w+fr)/2] : [u];
  /* The board the pair share. It is the same 3 1/2 in casing that runs round
     the outside, standing on end between the two sashes - without it the two
     windows read as one long hole with a gap of siding showing through. */
  if(panes.length>1) wq(mT,w,u-fr/2,yb-0.01,u+fr/2,yb+c.h+0.01,0.125);
  panes.forEach(function(pu){
    /* white frame ring with recessed glass behind a jamb reveal */
    var gx0=pu-c.w/2+0.12, gx1=pu+c.w/2-0.12, gyb=yb+0.12, gyt=yb+c.h-0.12;
    wq(mWht,w,pu-c.w/2,yb,gx0,yb+c.h,0.10);
    wq(mWht,w,gx1,yb,pu+c.w/2,yb+c.h,0.10);
    wq(mWht,w,gx0,yb,gx1,gyb,0.10);
    wq(mWht,w,gx0,gyt,gx1,yb+c.h,0.10);
    wret(mWht,w,pu-c.w/2,yb,pu+c.w/2,yb+c.h,0.05,0.10);
    wrev(mWht,w,gx0,gyb,gx1,gyt,0.045,0.10);
    var mGsh=mat("glShade",texFlat,"#242c33",0.2,20);
    var trRot=(plan.CAT[it.cat].draw==="transom"&&it.rot);
    if(trRot){
      /* a transom stood on end stays one tall pane — its divider bars turn with it */
      wq(mG,w,gx0,gyb,gx1,gyt,0.048,"glass");
      wq(mGsh,w,gx0,gyt-0.08,gx1,gyt,0.054);
      [gyb+(gyt-gyb)/3,gyb+2*(gyt-gyb)/3].forEach(function(my2){ wq(mWht,w,gx0,my2-0.026,gx1,my2+0.026,0.06); });
    } else if(c.h>2.0){
      /* double-hung: recessed glass, lower sash sits proud */
      var gmy=yb+c.h*0.52;
      /* THE LOWER SASH HAS A SCREEN IN IT. In Alan's photo the bottom half of
         the window is visibly flatter and greyer than the top -- that is the
         insect screen, and drawing both halves as clear glass is one of the
         things that made the window look drawn rather than photographed. */
      wq(mG,w,gx0,gyb,gx1,gmy-0.04,0.048,"glass");
      wq(mG,w,gx0,gmy+0.04,gx1,gyt,0.046,"glass");
      wq(mat("screen",texFlat,"#5A6064",0.05,10),w,gx0+0.02,gyb+0.02,gx1-0.02,gmy-0.06,0.056);
      wq(mGsh,w,gx0,gyt-0.09,gx1,gyt,0.052);
      wq(mGsh,w,gx0,gmy-0.13,gx1,gmy-0.04,0.054);
      wslab(mWht,w,gx0-0.02,gmy-0.10,gx1+0.02,gmy+0.02,0.048,0.088);
      wq(mWht,w,gx0-0.01,gmy+0.02,gx1+0.01,gmy+0.08,0.062);
      wq(mWht,w,pu-0.03,gyb,pu+0.03,gmy-0.04,0.062);
      wq(mWht,w,pu-0.03,gmy+0.04,pu+0.03,gyt,0.058);
      var lmy=(gyb+gmy-0.04)/2, umy=(gmy+0.04+gyt)/2;
      wq(mWht,w,gx0,lmy-0.026,gx1,lmy+0.026,0.062);
      wq(mWht,w,gx0,umy-0.026,gx1,umy+0.026,0.058);
    } else {
      wq(mG,w,gx0,gyb,gx1,gyt,0.048,"glass");
      wq(mGsh,w,gx0,gyt-0.08,gx1,gyt,0.054);
      [pu-(gx1-gx0)/6,pu+(gx1-gx0)/6].forEach(function(mx2){ wq(mWht,w,mx2-0.026,gyb,mx2+0.026,gyt,0.06); });
    }
  });
  /* THE SHARED MIDDLE BOARD IS NOT DRAWN YET, and that is deliberate.
     A double window is two sashes in one opening with a single casing down
     the middle instead of two with siding between, so the board belongs
     here - but nothing in this file can set it.dbl on an item, so panes is
     always one long and the board would never appear.
     When double windows are turned on, add it back as
       a wslab one casing wide, centred on u, from yb up to revealY,
     at the same 0.02 / 0.12 depths as the outer two - NOT up to the
     yb+ch+0.02 the website uses, because it meets the same head board
     the outer casings do and running it through is the thing the reveal
     above was added to stop. That third casing also needs
     tools/login-and-trim-check.js taught to expect three boards at the
     reveal rather than two, which is why it is not in already. */
  /* (STALE, kept word for word from Barnwright: the board IS drawn, above,
     and it.dbl IS set -- see this file's opening note.) */
  if(it.shut){
    kit.setStage("extras");
    var sc=state.shutC? hexRGB(state.shutC).map(srgbLin) : ((state.trim===state.body)? tintShade(state.trim,0.72) : hexRGB(state.trim).map(srgbLin));
    var mSh=mat("shut",texTrim,sc,0.08,16);
    var mShD=mat("shutD",texFlat,tintShade(state.shutC||state.trim,0.60),0.08,14);
    /* BOARD AND BATTEN, built the way the shop builds it: three boards with
       a gap you can see daylight in, and two battens laid ACROSS them,
       standing proud. It used to be one flat sheet with two hairlines
       scratched down it and two bands so faint you could not find them. */
    /* THREE battens, not two, and the top and bottom ones sit flush with the
       ends -- that is what the photograph shows, and it is the difference
       between a shutter and a bit of fence. The boards are set in a little
       from the batten ends, the same way. */
    var sTop=yb+c.h+0.06, sBot=yb-0.02, sH=sTop-sBot, SWD=0.86, GAP=0.026, BIN=0.045, BTH=sH*0.112;
    [[u-HW2-fr-0.09-SWD,u-HW2-fr-0.09],[u+HW2+fr+0.09,u+HW2+fr+0.09+SWD]].forEach(function(sx){
      wq(mShD,w,sx[0]-0.035,sBot-0.035,sx[1]+0.05,sTop+0.035,0.016);           /* its shadow on the wall */
      var bl=sx[0]+BIN, br=sx[1]-BIN, bw3=(br-bl-2*GAP)/3;
      wq(mat("shutBack",texFlat,tintShade(state.shutC||state.trim,0.26),0.05,10),
         w,bl,sBot,br,sTop,0.050);                                             /* the dark you see down the gaps */
      for(var bi=0;bi<3;bi++){
        var bx0=bl+bi*(bw3+GAP);
        wslab(mSh,w,bx0,sBot+0.01,bx0+bw3,sTop-0.01,0.050,0.082);
      }
      [sBot,sBot+sH*0.474,sTop-BTH].forEach(function(byy){
        wslab(mSh,w,sx[0],byy,sx[1],byy+BTH,0.082,0.116);
      });
    });
  }
}

const part = {
  id: "window",
  name: "Window and shutters",
  stage: ["windows", "extras"],
  draws: DRAWS,
  realLife: "A wall window: a white frame with the glass set back in it -- double-hung with an insect screen in the lower sash, or a three-lite transom -- trimmed with side casings, a head board and a sloped sill; two can share one opening and a single middle board, and board-and-batten shutters can go either side.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every wall window on the building on its own; the whole building draws
     them through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawWindow,
};
export default part;
