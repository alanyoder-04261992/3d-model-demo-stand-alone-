/* THE ROLL-UP DOOR: a steel curtain of narrow slats that rolls up into a drum
   over the opening, the garage door of a portable building. Node-safe.

   Drawn in the wall's own coordinates, in front of the unbroken siding (no
   hole is cut): the shared opening frame first (common.js openingFrame: its
   tap target, the soft shadow, the side casings and the 22.5-degree head --
   a roll-up gets NO porch header band), then the door itself:
   * the dark track box behind everything;
   * the curtain, set a full inch back behind the casing, inset 0.075 ft each
     side, made of slats 0.1875 ft (2 1/4 in) tall, at least fourteen, each a
     groove, a crown that catches the sun and a groove back in under the next;
   * the reveal: the sides and head of the opening seen edge-on;
   * the bottom rail standing proud of the curtain;
   * the diamond-plate threshold the shop screws across every roll-up opening,
     and its front edge;
   * the guides the curtain runs in, the dark gap it disappears into at the
     top, the wood jamb boards outside the guides;
   * the black latch plate: an oval with the corners knocked off and a slot
     across it, 0.62 ft in from the right edge at 0.42 of the height.
   Every roll-up the catalogue offers draws the same way; they differ only in
   width and height (the item's w and h).

   STAGE "doors" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderItem's roll-up branch (lines
   3237-3291), picked there by c.k==="ru" and here by the "roll-up" draw
   trait (rule 3). Porting edits: rule 1 (the kit's mat/wq/wtri3, the item
   primitives from common.js), rule 3 (the draw trait), rule 7 (the stage is
   set by the caller). Every number is Barnwright's. */

import { texFlat } from "../../engine/tex-names.js";
import { itemTools, openingFrame, hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["roll-up"]);

/* one roll-up door, after the renderItem preamble (common.js eachItem) */
function drawRollUp(plan, kit, it, c, mats) {
  var mT=mats.mT;
  var op=openingFrame(plan, kit, it, c, mT);
  if(!op) return;
  var P=itemTools(kit), wslant=P.wslant, wrev=P.wrev, wslab=P.wslab, wret=P.wret;
  var mat=kit.mat, wq=kit.wq, wtri3=kit.wtri3;
  var w=op.w, ch=op.ch, yb=op.yb, u=op.u;
  /* A ROLL-UP DOOR IS A COIL OF NARROW SLATS. Alan photographed a real one:
     better than thirty slats across six feet, each about 2 1/4 inches. This
     was drawing thirteen wide flat bands, which is a sectional garage door,
     not a roll-up. And a flat band shaded flat -- so each slat is now two
     leaning faces, a crown that catches the sun and a groove under it that
     does not, the way rolled steel actually reads. */
  /* THE DOOR IS IN A HOLE IN A WALL. It was drawn as a sheet laid ON the
     siding, and with nothing to see the depth of it read as a sticker. The
     curtain now sits a full inch back behind the casing, and the sides and
     head of the opening are real returns you can see down -- that reveal,
     and the shade in it, is most of what makes a door look like a door. */
  var duL=u-c.w/2, duR=u+c.w/2, CFACE=0.12, CURT=0.032;
  var mChan=mat("ruChan",texFlat,"#202426",0.22,30);
  wq(mChan,w,duL-0.02,yb,duR+0.02,yb+ch+0.02,0.026);                  /* the dark track box behind everything */
  var mCurt=mat("ruCurt",texFlat,"#e9ebe8",0.30,38);
  var mRibD=mat("ruRib",texFlat,"#9aa09c",0.18,24);
  var mRibL=mat("ruRibL",texFlat,"#fcfdfb",0.44,52);
  var cL=duL+0.075, cR=duR-0.075;
  wq(mCurt,w,cL,yb+0.02,cR,yb+ch-0.02,CURT);
  var SLAT=0.1875, nR=Math.max(14,Math.floor((ch-0.40)/SLAT)), sp=(ch-0.40)/nR;
  for(var i2=0;i2<nR;i2++){
    var ry2=yb+0.22+i2*sp;
    wslant(mRibD,w,cL,cR, ry2,          CURT,        ry2+sp*0.30, CURT+0.020);  /* the groove, leaning up and out */
    wslant(mRibL,w,cL,cR, ry2+sp*0.30,  CURT+0.020,  ry2+sp*0.70, CURT+0.036);  /* the crown */
    wslant(mRibD,w,cL,cR, ry2+sp*0.70,  CURT+0.036,  ry2+sp,      CURT);  /* and back in under the next one */
  }
  /* the reveal: the sides and head of the opening, seen edge-on */
  wrev(mChan,w,duL+0.055,yb,duR-0.055,yb+ch+0.015,CURT,CFACE);
  /* bottom rail, standing proud of the curtain the way the real one does */
  wslab(mat("ruRail",texFlat,"#dfe3e0",0.34,40),w,cL-0.012,yb+0.055,cR+0.012,yb+0.225,CURT,CURT+0.050);
  /* the diamond-plate threshold the shop screws across every roll-up opening */
  var mDia=mat("diamond",texFlat,"#cdd2d6",0.62,54);
  wslant(mDia,w,duL-0.02,duR+0.02, yb+0.055,0.055, yb+0.005,0.34);     /* the plate, near enough level */
  wslant(mat("diaE",texFlat,"#9ea3a7",0.4,40),w,duL-0.02,duR+0.02, yb-0.055,0.34, yb+0.005,0.34);
  /* the guides the curtain runs in, and the wood casing outside them */
  wq(mChan,w,duL+0.055,yb,cL,yb+ch,CURT+0.010);
  wq(mChan,w,cR,yb,duR-0.055,yb+ch,CURT+0.010);
  /* the gap the curtain disappears into -- shadow, not a painted black bar */
  wq(mat("ruDrum",texFlat,"#3A4043",0.16,22),w,cL,yb+ch-0.075,cR,yb+ch,CURT+0.012);
  wslab(mT,w,duL-0.06,yb,duL+0.16,yb+ch,0.02,CFACE);
  wslab(mT,w,duR-0.16,yb,duR+0.06,yb+ch,0.02,CFACE);
  /* the black latch plate: an oval with the corners knocked off, a slot
     across it, and a keeper below -- it is the only dark thing on the door
     and it is what your eye lands on in the photograph */
  var mIronR=mat("iron",texFlat,"#17191b",0.18,26);
  var lx=duR-0.62, ly=yb+ch*0.42, LW=0.36, LH=0.19, LG=0.075, LO=CURT+0.048;
  wret(mIronR,w,lx-LW,ly-LH+LG,lx+LW,ly+LH-LG,CURT+0.020,LO);          /* it stands off the curtain */
  wq(mIronR,w,lx-LW,ly-LH+LG,lx+LW,ly+LH-LG,LO);
  wq(mIronR,w,lx-LW+LG,ly-LH,lx+LW-LG,ly+LH,LO);
  wtri3(mIronR,w,[lx-LW,ly-LH+LG],[lx-LW+LG,ly-LH],[lx-LW+LG,ly-LH+LG],LO);
  wtri3(mIronR,w,[lx+LW,ly-LH+LG],[lx+LW-LG,ly-LH+LG],[lx+LW-LG,ly-LH],LO);
  wtri3(mIronR,w,[lx-LW,ly+LH-LG],[lx-LW+LG,ly+LH-LG],[lx-LW+LG,ly+LH],LO);
  wtri3(mIronR,w,[lx+LW,ly+LH-LG],[lx+LW-LG,ly+LH],[lx+LW-LG,ly+LH-LG],LO);
  wq(mat("latchSlot",texFlat,"#3b4045",0.3,34),w,lx-0.16,ly-0.045,lx+0.16,ly+0.045,LO+0.006);
}

const part = {
  id: "roll-up",
  name: "Roll-up door",
  stage: "doors",
  draws: DRAWS,
  realLife: "A steel roll-up door: a curtain of 2 1/4 in slats set an inch back in the opening, rolling up into a drum at the top, with a bottom rail, a black latch plate and the diamond-plate threshold the shop screws across the opening, trimmed with side casings and a head board.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every roll-up on the building on its own; the whole building draws them
     through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawRollUp,
};
export default part;
