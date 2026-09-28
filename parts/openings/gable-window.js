/* THE GABLE WINDOWS: the windows that go up in the triangle of a gable end
   (or high on a side wall) -- the faux loft window, the 18x24 window and the
   octagon window. Node-safe.

   * FAUX LOFT WINDOW (2.6 x 1.9 ft): a trim-colour frame 0.3 ft wide with a
     triangle in each inside corner and NO glass -- the siding shows through.
     Standard on a lofted barn, and $0.
   * 18x24 WINDOW: the same trim as every wall window -- side casings, a
     drip-cap head widest at its top, a sloped sill widest at its bottom --
     drawn flat, round a white sash with two glass sashes, double-hung, four
     panes to a sash.
   * OCTAGON WINDOW (2.3 ft across): an 18 in white octagon window with glass
     and a cross of white muntins, and trim-colour octagonal boards 0.4 ft wide
     ROUND it.

   WHERE IT GOES. On a side wall (R or L): at y0 + min(4.6, wall height - 1)
   plus the customer's drag, kept between the floor and the wall top. On a
   gable end (F or B): drawn on the plane of the gable, z = +-L/2 -- even on a
   front-porch building, where the wall itself is set back 4 ft: the window
   belongs to the porch gable there -- at topY + max(0.62 + h/2, 0.34 of the
   gable's height) plus the drag, never lower than just above the wall top
   (THE FLOOR WINS) and, where it fits, under the roof; whatever still rises
   past the roof line is CUT OFF at it (gableClip, 0.10 ft inside the roof),
   the way the roof trim covers it on a real building. An octagon too big for
   its gable shrinks to what the gable can take, never below 0.55 of its size.

   STAGE "windows" (set by parts/openings/index.js before it hands over).

   Ported from Barnwright's 3ddesign.html, renderGableWin (lines 3575-3705),
   called from renderItem (3141). Porting edits, and nothing else:
   * rule 1: dims() -> plan.d, T() -> plan.t, wallDefs() -> plan.ws;
     roofProfile(d.W, y0+t.wallH) -> roofProfile(d.W, y0+t.wallH, t,
     plan.construction) (model/roof-shapes.js, the same maths, now told which
     style and settings); gq2 pushQuad wallPt are the kit's; gableClip and
     profileYat come from model/roof-shapes.js, y0 and OCT_WIN from
     engine/constants.js;
   * rule 3: it.cat==="g1824" -> the "gable-1824" draw trait, "fake" ->
     "faux-loft", "oct" -> "octagon". The octagon's shrink copies the
     catalogue entry, and that copy now also carries `draw`, because the draw
     trait is what the later "which window" tests read;
   * rule 6: hitQuads.push -> kit.hit. (The caller clears the current item,
     as renderItem did after it.)
   Kept: the dead `u_` variable; the octagon shrink scaling the trim ring but
   not the white window or the glass (see the skill, Kept quirks). */

import { texFlat } from "../../engine/tex-names.js";
import { y0, OCT_WIN } from "../../engine/constants.js";
import { profileYat, roofProfile, gableClip } from "../../model/roof-shapes.js";
import { hasDraw, drawOwn } from "./common.js";

const DRAWS = Object.freeze(["faux-loft", "gable-1824", "octagon"]);

/* one gable window, after the renderItem preamble (common.js eachItem) */
function drawGableWindow(plan, kit, it, c, mats) {
  renderGableWin(plan, kit, it, c, plan.prof, mats.mT, mats.mG);
}

function renderGableWin(plan,kit,it,c,prof,mT,mG){
  var mat=kit.mat, gq2=kit.gq2, pushQuad=kit.pushQuad, wallPt=kit.wallPt;
  var d=plan.d, L=d.L, t=plan.t;
  var onSide=(it.wall==="R"||it.wall==="L");
  var u=it.pos, yc, gz=0, sgn=1, wD=null;
  /* THE 18x24 WEARS ITS TRIM OUTSIDE ITS OWN OPENING -- a head board above and
     a sill below, like every window on a wall (see the casing further down).
     So the room it needs in the gable is bigger than c.w/c.h, and clamping on
     the window alone would push the head board through the roof line. */
  var isG18=(c.draw==="gable-1824");
  var padX=isG18?0.39:0, padT=isG18?0.29:0, padB=isG18?0.27:0;
  if(onSide){
    wD=plan.ws[it.wall];
    var base=y0+Math.min(4.6, t.wallH-1.0);
    yc=base+(it.vy||0);
    /* same shape as the gable clamp: a lower bound that cannot be overruled,
       so a window taller than the wall does not end up under the floor */
    var loS=y0+1.0+c.h/2+padB;
    yc=Math.max(loS, Math.min(Math.max(loS, wD.top-0.30-c.h/2-padT), yc));
  } else {
    gz=(it.wall==="B"? -L/2 : L/2);
    sgn=(it.wall==="B"? -1 : 1);
    var topY=y0+t.wallH, peak=profileYat(prof,0);
    /* The octagon gable window is 2.3 ft across, which is right on a barn and far
       too big on a six foot garden shed: the roof cuts it into a pointed arch
       with the trim ring left hanging below, which is not a window anybody sells.
       Clipping is the right answer for a window that ALMOST fits. A window that
       was never going to fit should be a smaller window, so it shrinks to what
       the gable can take - never below about half, because past that it is a
       porthole and the customer should pick something else. */
    if(c.draw==="octagon"){
      var room=(peak-topY)-0.92;
      if(room>0&&room<c.h){
        var shrink=Math.max(0.55,room/c.h);
        c={k:c.k,n:c.n,w:c.w*shrink,h:c.h*shrink,p:c.p,gable:c.gable,draw:c.draw};
      }
    }
    yc=topY+Math.max(0.62+c.h/2,(peak-topY)*0.34)+(it.vy||0);
    var capG=Math.min(peak-0.35, profileYat(prof,Math.min(d.W/2,Math.abs(u)+c.w/2+padX))-0.22)-c.h/2-padT;
    /* THE FLOOR WINS THE ARGUMENT, and the roof line is handled by CUTTING
       rather than by shoving. On a small gable the window is taller than the
       triangle -- the 18x24 does not fit any 8 ft wide shed and never has. If
       the ROOF wins that argument the window's centre drops below the eave and
       it is drawn on the wall over the door, which is worse than the problem:
       an 8x12 utility put the octagon straight through its gable trim band and
       a 6x8 garden utility put it on the door head. So the bottom edge stays
       where a window belongs, and gableClip below removes whatever rises past
       the roof instead of moving the window to avoid it. */
    var floorG=topY+0.14+c.h/2+padB;
    yc=Math.max(floorG, Math.min(Math.max(floorG,capG), yc));
  }
  var clipProf=onSide? null : roofProfile(d.W, y0+t.wallH, t, plan.construction);
  function G(m2,pts,off,uvm){
    if(!onSide){
      /* nothing on a gable end may be drawn above the roof. On the buildings
         with room to spare this changes nothing at all; on the ones without,
         it is the difference between a window tucked under the eave and a
         window floating in the sky. */
      var cp=gableClip(pts, clipProf, 0.10);
      if(cp.length>2) gq2(m2,cp,gz,sgn,off,uvm);
      return;
    }
    var P3=pts.map(function(p){ return wallPt(wD,p[0],p[1],off); });
    var uvg=(uvm==="glass");
    for(var fi=1;fi<P3.length-1;fi++){
      pushQuad(m2,P3[0],P3[fi],P3[fi+1],P3[fi+1],
        uvg?[0.06,0.06]:[0,0], uvg?[0.94,0.06]:[1,0], uvg?[0.94,0.94]:[1,1], uvg?[0.06,0.94]:[0,1]);
    }
  }
  var u_=u;
  function gp(du,dy){return [u+du,yc+dy];}
  if(c.draw==="faux-loft"){
    var FT=0.3, hw=c.w/2, hh=c.h/2;
    G(mT,[gp(-hw,hh-FT),gp(hw,hh-FT),gp(hw,hh),gp(-hw,hh)],0.06);
    G(mT,[gp(-hw,-hh),gp(hw,-hh),gp(hw,-hh+FT),gp(-hw,-hh+FT)],0.06);
    G(mT,[gp(-hw,-hh+FT),gp(-hw+FT,-hh+FT),gp(-hw+FT,hh-FT),gp(-hw,hh-FT)],0.06);
    G(mT,[gp(hw-FT,-hh+FT),gp(hw,-hh+FT),gp(hw,hh-FT),gp(hw-FT,hh-FT)],0.06);
    var xi=hw-FT, yi=hh-FT, gB=Math.min(0.5,xi*0.55,yi*0.75);
    G(mT,[[u-xi,yc+yi-gB],[u-xi+gB,yc+yi],[u-xi,yc+yi]],0.065);
    G(mT,[[u+xi-gB,yc+yi],[u+xi,yc+yi-gB],[u+xi,yc+yi]],0.065);
    G(mT,[[u-xi,yc-yi+gB],[u-xi,yc-yi],[u-xi+gB,yc-yi]],0.065);
    G(mT,[[u+xi,yc-yi+gB],[u+xi-gB,yc-yi],[u+xi,yc-yi]],0.065);
  } else if(c.draw==="octagon"){
    var mWht2=mat("white",texFlat,"#FBFBF8",0.12,22);
    /* THREE RINGS, and the outer one is the whole point. The octagonal trim
       boards go ROUND the 18 inch window, they are not cut out of it, and they
       wear the TRIM colour -- so picking a trim colour changes this window.
       It used to be one white octagon 18 inches across all in, which is why
       Alan said it was too small AND that it never changed. */
    var R=c.w/2, Rw=OCT_WIN/2, r=Rw-0.15, pts=[], wpts=[], gpts=[];
    for(var i=0;i<8;i++){var a=Math.PI/8+i*Math.PI/4;
      pts.push(gp(Math.cos(a)*R,Math.sin(a)*R));
      wpts.push(gp(Math.cos(a)*Rw,Math.sin(a)*Rw));
      gpts.push(gp(Math.cos(a)*r,Math.sin(a)*r));}
    G(mT,pts,0.055);
    G(mWht2,wpts,0.066);
    G(mG,gpts,0.075,"glass");
    var mm=r*0.33, ex=r*0.94, mw=0.032;
    [-mm,mm].forEach(function(d){
      G(mWht2,[[u-ex,yc+d-mw],[u+ex,yc+d-mw],[u+ex,yc+d+mw],[u-ex,yc+d+mw]],0.08);
      G(mWht2,[[u+d-mw,yc-ex],[u+d+mw,yc-ex],[u+d+mw,yc+ex],[u+d-mw,yc+ex]],0.08);
    });
  } else {
    /* THE SAME TRIM AS EVERY OTHER WINDOW (Alan, Aug 2026: "the trim looks
       different then other window trim and it should be the same"). It was one
       flat rectangle behind a blank pane -- no head board, no sill, no bars.
       A window on a WALL gets a drip-cap head widest at its TOP with the ends
       cut back, side casings between, and a sloped sill widest at its BOTTOM.
       These are that code's own numbers (fr / hE / sE and the 0.29 head),
       drawn flat because a gable end is drawn flat. */
    var mWht3=mat("white",texFlat,"#FBFBF8",0.12,22);
    var HW=c.w/2, HH=c.h/2, fr=0.27, hE=0.12, sE=0.10;
    G(mT,[gp(-HW-fr,-HH),gp(-HW+0.02,-HH),gp(-HW+0.02,HH+0.02),gp(-HW-fr,HH+0.02)],0.058);
    G(mT,[gp(HW-0.02,-HH),gp(HW+fr,-HH),gp(HW+fr,HH+0.02),gp(HW-0.02,HH+0.02)],0.058);
    G(mT,[gp(-HW-fr,HH-0.02),gp(HW+fr,HH-0.02),gp(HW+fr+hE,HH+0.27),gp(-HW-fr-hE,HH+0.27)],0.062);
    G(mT,[gp(-HW-fr-sE,-HH-0.25),gp(HW+fr+sE,-HH-0.25),gp(HW+fr,-HH-0.02),gp(-HW-fr,-HH-0.02)],0.062);
    G(mWht3,[gp(-HW,-HH),gp(HW,-HH),gp(HW,HH),gp(-HW,HH)],0.068);
    /* double-hung, four panes to a sash, the way the real one is glazed */
    var gx=HW-0.12, gy=HH-0.12;
    G(mG,[gp(-gx,-gy),gp(gx,-gy),gp(gx,-0.04),gp(-gx,-0.04)],0.074,"glass");
    G(mG,[gp(-gx,0.04),gp(gx,0.04),gp(gx,gy),gp(-gx,gy)],0.074,"glass");
    [[-gy,-0.04],[0.04,gy]].forEach(function(sash){
      var my=(sash[0]+sash[1])/2;
      G(mWht3,[gp(-0.026,sash[0]),gp(0.026,sash[0]),gp(0.026,sash[1]),gp(-0.026,sash[1])],0.078);
      G(mWht3,[gp(-gx,my-0.024),gp(gx,my-0.024),gp(gx,my+0.024),gp(-gx,my+0.024)],0.078);
    });
    G(mWht3,[gp(-gx-0.02,-0.10),gp(gx+0.02,-0.10),gp(gx+0.02,0.06),gp(-gx-0.02,0.06)],0.082);
  }
  var hpx=c.w/2+0.25+padX, hpy=c.h/2+0.25;
  var hp=[[u-hpx,yc-hpy-padB],[u+hpx,yc-hpy-padB],[u+hpx,yc+hpy+padT],[u-hpx,yc+hpy+padT]];
  kit.hit(it.id, onSide? wD.n : [0,0,sgn], onSide? hp.map(function(p){return wallPt(wD,p[0],p[1],0.3);}) : hp.map(function(p){return [p[0],p[1],gz+sgn*0.3];}));
}

const part = {
  id: "gable-window",
  name: "Gable window",
  stage: "windows",
  draws: DRAWS,
  realLife: "A window up in the gable: the faux loft window (a trim frame with no glass), the 18x24 double-hung with the same casings, head and sill as a wall window, or the octagon -- an 18 in window with octagonal trim boards round it -- cut off at the roof line where the gable is too small for it.",
  appliesTo(plan) { return hasDraw(plan, DRAWS); },
  /* every gable window on the building on its own; the whole building draws
     them through parts/openings/index.js, in the order the items were added */
  build(plan, kit) { drawOwn(plan, kit, part); },
  drawItem: drawGableWindow,
};
export default part;
