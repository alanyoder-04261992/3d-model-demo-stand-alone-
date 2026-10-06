/* THE DOG KENNEL: its open front with chain-link and pipe gates, the side
   walls along the run, the partition with the doggie doors, the divider down
   the middle of the run, the run's ceiling and the diamond-plate rims round
   the run floor. Node-safe.

   On the real Dog Kennel the BACK half of the building is an ordinary
   enclosed room (siding outside, an inside face you can see through the
   run), and the FRONT half is an open run for the dogs: chain-link fence
   fabric on galvanized line posts along both sides, a cream header board
   across the front with two full-width galvanized pipe gates under it, a
   partition wall between the room and the run with one doggie door into each
   side of the run, a chain-link divider splitting the run in two, a light
   ceiling over it, and diamond-plate kick rims round the run floor.

   THIS FILE DRAWS FROM TWO PLACES, because Barnwright does:
   * kennelFront (the F wall) and kennelSide (the R and L walls) are called
     from INSIDE the siding part's walls loop (parts/siding.js), at the moment
     Barnwright's buildShed reaches those walls. The siding part wraps each
     call in kit.part("kennel", ...), and `front` / `side` below wrap
     themselves too, so every one of those triangles belongs to the kennel.
   * kennelExtras is the kennel's own PIPELINE entry (parts/index.js, entry 6,
     Barnwright line 3961), run after the corner trim and the porch junctions.
   The kennel's inner BACK face (bodyIn on the B wall) is drawn by the siding
   loop itself and belongs to the siding (test/golden/README.md).

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 85c4b022...):
   meshWall 3707-3717, kennelFront 3718-3755, kennelSide 3756-3780,
   kennelExtras 3782-3816. Numbers byte for byte. Porting edits
   (docs/ARCHITECTURE.md, Porting rules):
   * each function takes the plan and the kit first (the drawing toolbox of
     this one build replaces Barnwright's globals): mat wq box wallPt quadUV
     pushQuad wbrace are the kit's, bound to local names so the bodies read as
     Barnwright's (rule 1);
   * dims() -> plan.d, state -> plan.state, STEP -> kit.STEP, y0 from
     engine/constants.js, the texture names from engine/tex-names.js (rule 1);
   * kit.setStage calls added (rule 7): the siding faces and the pieces that
     CARRY THE ROOF over the open run -- the front header board, the three
     wood front posts, the band along the top of each run wall and the
     galvanized line posts under it -- are "siding" (the siding step hides the
     wall framing, so anything later leaves the roof floating in
     Watch-it-build); the junction board is "trim"; the doggie doors are
     "doors"; the chain-link, gates, divider rails, ceiling and rims are
     "extras" -- the order a kennel is really finished in.
   Unused parameters are kept as Barnwright has them (kennelFront's mB,
   kennelExtras's prof). */

import { y0 } from "../engine/constants.js";
import { texFlat, texSiding, texTrim } from "../engine/tex-names.js";
import { tintShade } from "../engine/math.js";

/* chain-link diamond mesh: two families of 45-degree wires on a wall frame,
   `sp` apart, each wire 0.017 ft thick, `o` out from the wall plane */
export function meshWall(kit,b,w,x0,ym0,x1,ym1,sp,o){ /* chain-link diamond mesh */
  var wbrace=kit.wbrace;
  var H=ym1-ym0;
  for(var cc=x0-H;cc<x1;cc+=sp){
    var ax=Math.max(x0,cc), bx=Math.min(x1,cc+H);
    if(bx>ax+0.04) wbrace(b,w,ax,ym0+(ax-cc),bx,ym0+(bx-cc),0.017,o);
  }
  for(var c2=x0;c2<x1+H;c2+=sp){
    var ax2=Math.max(x0,c2-H), bx2=Math.min(x1,c2);
    if(bx2>ax2+0.04) wbrace(b,w,ax2,ym0+(c2-ax2),bx2,ym0+(c2-bx2),0.017,o);
  }
}

/* The open FRONT (the F wall) of the kennel: header board, chain-link both
   faces, three wood posts and two pipe gates. */
export function kennelFront(plan,kit,w,half,topY,mB,mT){
  var mat=kit.mat, wq=kit.wq, box=kit.box;
  var mWd2=mat("pwood",texFlat,"#96682F",0.05,12);
  var mGalv=mat("galv",texFlat,"#cfd4d8",0.5,44);
  var mGalvD=mat("galvD",texFlat,"#a6adb3",0.4,36);
  var hy=topY-0.15, zF=w.at;
  /* one cream header board across the front */
  /* The header and the three posts carry the front of the roof over the open
     run, so they go up WITH the siding ("siding"): the siding step hides the
     wall framing (parts/stages.js COVERS), and anything later would leave the
     front of the roof standing on nothing in Watch-it-build. */
  kit.setStage("siding");
  wq(mT,w,-half,hy,half,topY+0.21,0.05);
  /* chain-link, both faces */
  kit.setStage("extras");
  meshWall(kit,mGalvD,w,-half+0.14,y0+0.10,half-0.14,hy-0.03,0.46,0.03);
  var wIn={ax:[-1,0,0],n:[0,0,-1],at:zF,cx:0};
  meshWall(kit,mGalvD,wIn,-half+0.14,y0+0.10,half-0.14,hy-0.03,0.46,0.01);
  /* three chunky wood posts */
  kit.setStage("siding");
  [-(half-0.17),0,half-0.17].forEach(function(u){ box(mWd2,u,y0,zF-0.17,0.34,hy-y0+0.04,0.34); });
  /* two full-width galvanized pipe gates */
  kit.setStage("extras");
  [[-half+0.44,-0.25,-1],[0.25,half-0.44,1]].forEach(function(g){
    var a=g[0],b2=g[1],hs=g[2],gt=hy-0.12,gb=y0+0.12,fw=0.07;
    /* fixed frame posts + header */
    wq(mGalv,w,a-0.11,gb-0.05,a-0.11+fw,gt+0.10,0.058);
    wq(mGalv,w,b2+0.11-fw,gb-0.05,b2+0.11,gt+0.10,0.058);
    wq(mGalv,w,a-0.11,gt+0.03,b2+0.11,gt+0.10,0.058);
    /* gate frame */
    wq(mGalv,w,a,gb,a+fw,gt,0.068);
    wq(mGalv,w,b2-fw,gb,b2,gt,0.068);
    wq(mGalv,w,a,gt-fw,b2,gt,0.068);
    wq(mGalv,w,a,gb,b2,gb+fw,0.068);
    wq(mGalv,w,a,(gb+gt)*0.5-fw/2,b2,(gb+gt)*0.5+fw/2,0.068);
    /* inner vertical near the latch side */
    var lx=(hs<0)? b2-0.50 : a+0.50;
    wq(mGalv,w,lx-fw/2,gb,lx+fw/2,gt,0.068);
    /* hinge collars on the outer post side */
    var hxu=(hs<0)? a+fw/2 : b2-fw/2;
    [0.24,0.74].forEach(function(f){ var yy=gb+(gt-gb)*f;
      wq(mGalvD,w,hxu-0.085,yy-0.10,hxu+0.085,yy+0.10,0.076); });
    /* latch rod */
    var lxx=(hs<0)? b2+0.03 : a-0.03;
    wq(mGalv,w,lxx-0.033,gb+(gt-gb)*0.42,lxx+0.033,gb+(gt-gb)*0.42+0.90,0.076);
  });
}

/* A SIDE wall (R or L) of the kennel: the back half is the enclosed room
   (siding outside, the shaded inside face), the front half is the run
   (cream band, chain-link both faces, two galvanized line posts). */
export function kennelSide(plan,kit,w,k,half,topY,mB,mT){
  var mat=kit.mat, wq=kit.wq, box=kit.box, wallPt=kit.wallPt, quadUV=kit.quadUV, STEP=kit.STEP, state=plan.state;
  var mWd2=mat("pwood",texFlat,"#96682F",0.05,12);
  var mGalvD=mat("galvD",texFlat,"#a6adb3",0.4,36);
  var mIn=mat("bodyIn",texSiding,tintShade(state.body,0.72),0.04,10);
  var hy=topY-0.34, d2=plan.d, Lk=d2.L;
  var run0=(k==="R")?-half:0, run1=(k==="R")?0:half;
  var enc0=(k==="R")?0:-half, enc1=(k==="R")?half:0;
  /* solid siding on the enclosed half (both faces) */
  kit.setStage("siding");
  wq(mB,w,enc0,y0,enc1,w.top,0,"sid");
  var pI=[wallPt(w,enc1,y0,-0.05),wallPt(w,enc0,y0,-0.05),wallPt(w,enc0,w.top,-0.05),wallPt(w,enc1,w.top,-0.05)];
  quadUV(mIn,pI,[[enc1/STEP,y0/2.6],[enc0/STEP,y0/2.6],[enc0/STEP,w.top/2.6],[enc1/STEP,w.top/2.6]]);
  /* white trim board at the junction */
  kit.setStage("trim");
  wq(mT,w,-0.16,y0,0.16,topY-0.02,0.045);
  /* cream band over the run */
  /* The band along the top of the run and the line posts under it carry the
     side of the roof over the run: "siding", like the front header and posts
     in kennelFront, so the roof never floats in Watch-it-build. */
  kit.setStage("siding");
  wq(mT,w,Math.min(run0,run1),hy,Math.max(run0,run1)+0.02,topY+0.01,0.05);
  /* chain-link over the run, both faces */
  kit.setStage("extras");
  meshWall(kit,mGalvD,w,run0+0.12,y0+0.10,run1-0.12,hy-0.03,0.46,0.03);
  var wIn2={ax:[-w.ax[0],0,-w.ax[2]],n:[-w.n[0],0,-w.n[2]],at:w.at,cx:0};
  meshWall(kit,mGalvD,wIn2,-run1+0.12,y0+0.10,-run0-0.12,hy-0.03,0.46,0.01);
  /* galvanized line posts along the run (thin metal, like the real one) */
  kit.setStage("siding");
  var mGalvP=mat("galv",texFlat,"#cfd4d8",0.5,44);
  var pxm=w.at - w.n[0]*0.10;
  box(mGalvP,pxm,y0+0.04,0.22,0.10,hy-y0-0.05,0.10);
  box(mGalvP,pxm,y0+0.04,Lk/4,0.10,hy-y0-0.05,0.10);
}

/* Everything inside the kennel that is not on an outside wall: the
   partition facing the run, the doggie doors, the chain-link divider and
   its rails, the run ceiling and the diamond-plate rims. */
export function kennelExtras(plan,kit,W,L,topY,prof){
  var mat=kit.mat, wq=kit.wq, box=kit.box, wallPt=kit.wallPt, quadUV=kit.quadUV, pushQuad=kit.pushQuad, STEP=kit.STEP, state=plan.state;
  var mB=mat("body",texSiding,state.body,0.06,14);
  var mT=mat("trim",texTrim,state.trim,0.10,20);
  var mGalv=mat("galv",texFlat,"#cfd4d8",0.5,44);
  var mGalvD=mat("galvD",texFlat,"#a6adb3",0.4,36);
  var mWhtK=mat("white",texFlat,"#FBFBF8",0.12,22);
  var mIn=mat("bodyIn",texSiding,tintShade(state.body,0.72),0.04,10);
  var hy=topY-0.34, RD=L/2, zP=L/2-RD;
  /* interior partition facing the run */
  kit.setStage("siding");
  var wP={ax:[1,0,0],n:[0,0,1],at:zP,cx:0,top:topY,len:W};
  wq(mB,wP,-W/2+0.03,y0,W/2-0.03,topY,0.02,"sid");
  var pB=[wallPt(wP,W/2-0.03,y0,-0.03),wallPt(wP,-W/2+0.03,y0,-0.03),wallPt(wP,-W/2+0.03,topY,-0.03),wallPt(wP,W/2-0.03,topY,-0.03)];
  quadUV(mIn,pB,[[(W/2)/STEP,y0/2.6],[(-W/2)/STEP,y0/2.6],[(-W/2)/STEP,topY/2.6],[(W/2)/STEP,topY/2.6]]);
  /* doggie doors, one per run */
  kit.setStage("doors");
  [-W/4,W/4].forEach(function(dx){
    wq(mT,wP,dx-0.85,y0,dx+0.85,y0+2.35,0.05);
    wq(mWhtK,wP,dx-0.68,y0,dx+0.68,y0+2.18,0.07);
    wq(mGalvD,wP,dx-0.55,y0+0.10,dx+0.55,y0+1.82,0.085);
  });
  /* chain-link divider between the two runs */
  kit.setStage("extras");
  var wDa={ax:[0,0,-1],n:[1,0,0],at:0,cx:0}, wDb={ax:[0,0,1],n:[-1,0,0],at:0,cx:0};
  meshWall(kit,mGalvD,wDa,-(L/2)+0.15,y0+0.10,-zP-0.15,hy-0.08,0.46,0.02);
  meshWall(kit,mGalvD,wDb,zP+0.15,y0+0.10,L/2-0.15,hy-0.08,0.46,0.02);
  box(mGalv,0,hy-0.12,zP+RD/2,0.08,0.08,RD-0.25);
  box(mGalv,0,y0+0.06,zP+RD/2,0.08,0.08,RD-0.25);
  /* light ceiling over the run */
  var mCeilK=mat("ceil",texFlat,"#F2F1EA",0.05,12);
  pushQuad(mCeilK,[-W/2,topY-0.03,zP],[W/2,topY-0.03,zP],[W/2,topY-0.03,L/2+0.10],[-W/2,topY-0.03,L/2+0.10],
    [0,0],[W/0.8,0],[W/0.8,RD/0.8],[0,RD/0.8]);
  /* diamond-plate rims around the run floor */
  var mPlate=mat("plate",texFlat,"#c6cbd0",0.55,50);
  box(mPlate,0,0.48,L/2-0.05,W-0.02,0.46,0.14);
  box(mPlate,W/2-0.06,0.48,zP+RD/2,0.12,0.46,RD);
  box(mPlate,-(W/2-0.06),0.48,zP+RD/2,0.12,0.46,RD);
}

/* What the siding loop calls at the kennel's F wall and at its R/L walls
   (Barnwright: kennelFront(w,half,topY,mB,mT) / kennelSide(w,k,half,topY,mB,mT)).
   Each wraps itself in kit.part("kennel") so its triangles belong to the
   kennel whoever calls it; kit.part also puts the caller's building step back
   afterwards, so the siding loop carries on in "siding". */
export function front(plan,kit,core,w,half,topY){
  return kit.part("kennel",function(){ kennelFront(plan,kit,w,half,topY,core.mB,core.mT); });
}
export function side(plan,kit,core,w,k,half,topY){
  return kit.part("kennel",function(){ kennelSide(plan,kit,w,k,half,topY,core.mB,core.mT); });
}

export default {
  id: "kennel",
  name: "Dog kennel run and gates",
  stage: ["siding", "trim", "doors", "extras"],
  realLife: "The kennel's open run: chain-link fence fabric on galvanized line posts along both sides, a cream header over two full-width galvanized pipe gates across the front, a partition wall with a doggie door into each half of the run, a chain-link divider down the middle, a light ceiling over the run and diamond-plate rims round the run floor.",
  appliesTo(plan) { return !!plan.t.kennel; },
  /* PIPELINE entry "kennel" (Barnwright line 3961): kennelExtras only. The
     front and side walls are drawn from the siding loop (front / side). */
  build(plan, kit) {
    kennelExtras(plan,kit,plan.W,plan.L,plan.topY,plan.prof);
  },
  front: front,
  side: side,
};
