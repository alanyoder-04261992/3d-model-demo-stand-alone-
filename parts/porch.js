/* THE PORCH: the open porch on a cabin -- its posts, the header band over the
   opening, the white ceiling, the railing round the open sides and, on a side
   porch, the wooden step up to it. Node-safe.

   In real life a cabin's porch is part of the building's own floor: the floor
   runs out past a wall that stands back from the edge, and the roof carries on
   over it. At the open corners stand 4x4 posts of natural pressure-treated
   wood. Across the opening, under the roof, runs a painted 1x4 header band
   (the trim colour, white on the real cabins), and the underside of the roof
   over the porch is a white ceiling. A wooden railing -- a flat cap board, a
   top rail, a bottom rail and 2x2 balusters -- closes the open sides, except
   one gap left open as the way in. A side porch also gets a two-riser wooden
   step at that gap. The customer can add extra posts ("Porch Post" items);
   the railing then runs post to post.

   THREE KINDS OF PORCH (the style's `porch` trait, docs/ARCHITECTURE.md):
   * "F" FRONT PORCH (Cabin, Lofted Barn Cabin): a 4 ft deep porch across the
     whole front end, inside the building's length -- the front wall stands
     4 ft back (plan.ws.F.at = L/2 - 4). Header band across the end, a 4 ft
     wrap band down each side, the ceiling, two corner posts, railing across
     the front and down both sides.
   * "S" SIDE PORCH (Side Cabin, Loft Side Cabin): a 4 ft deep notch in the
     door side (+x), 8 or 12 ft long (plan.span: 8 on a building under 20 ft),
     at the back end, flipped to the front end, or centred. Bands, ceiling, a
     fixed post at the wrap corner, railing along the edge with the bay in
     front of the porch door left open, a railing across the porch end, and a
     wood step at the entry.
   * "C" CORNER (WRAP) PORCH (Deluxe Side Cabin, Deluxe Loft Side Cabin): a
     4 ft deck across the front end (the style adds 4 ft to L for it, a kept
     Barnwright quirk) plus a 12 ft run down the door side, walled in behind by
     the P1/P2/P3 porch walls (plan.ws). Bands, the ceiling, two corner posts,
     railing across the end and down the side, a rail stub on the -x side.
   (Barnwright also had a full-length side porch, porchSide, for porch "R".
   No style ever used it and buildShed never called it: it is dead code and is
   NOT ported. wallDefs still knows porch "R".)

   The trim boards where the porch walls meet the main walls on a side or
   corner porch are drawn earlier, at Barnwright's own place in buildShed:
   parts/porch-junction.js (attributed to this part, "porch").

   STAGES (parts/stages.js), which change no triangle:
   * "porch-frame" (kind "both", Finished AND Framing views): the posts and
     the header / wrap bands over the openings -- the porch's posts and beam;
   * "porch" (kind "finish"): the ceiling, the railings and the entry step.
   There is no separate porch deck here: the building's floor slab
   (parts/floor.js) runs under the porch, as in Barnwright.

   Ported from Barnwright's 3ddesign.html (pinned SHA-256 0bdcf663...),
   numbers byte for byte:
   * railX, railZ, railAnchors, porchFront, porchSideCorner, porchCorner
     (lines 2443-2560: railX 2444, railZ 2451, railAnchors 2458, porchFront
     2465, porchSideCorner 2488, porchCorner 2525; porchSide at 2476-2486 is
     dead and left out);
   * buildShed's porch block (lines 4020-4034): the front porch's header band,
     wrap bands and ceiling, then the call of the porch function.
   Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
   * rule 1: state -> plan.state, CAT -> plan.CAT, pSpan() -> plan.span; y0
     from engine/constants.js, texFlat from engine/tex-names.js; box, gq2,
     pushQuad and mat are the kit's (bound to Barnwright's names); mT is
     core.mT, topY is plan.topY (= y0 + wallH, as buildShed computes it);
   * the porch functions are FUNCTION DECLARATIONS inside porchDrawing(plan,
     kit), so their bodies read exactly as Barnwright wrote them while drawing
     into this build's kit; railAnchors (pure) is also exported;
   * rule 7: kit.setStage("porch-frame") / kit.setStage("porch") added before
     each block.
   The porch functions' unused mT parameter (porchFront) is kept, as is
   porchCorner's inline copy of the widest-gap loop (Barnwright did not call
   railAnchors there; the result is the same, and the code stays Barnwright's).

   MATERIALS, FIRST CALL WINS (parts/README.md): "pwood" (natural
   pressure-treated wood, #96682F) is made here -- the porch-post items
   (parts/openings) ask for the same key with the same paint later; "ceil"
   (#F2F1EA) is made here; "trim" is core.mT. */

import { y0 } from "../engine/constants.js";
import { texFlat } from "../engine/tex-names.js";

/* THE WAY IN. The two corner anchors (-C and +C) and the post positions,
   sorted; gi is the index of the WIDEST gap between neighbours. The railing
   runs every gap except that one, which is left open as the porch entry.
   Barnwright's railAnchors, byte for byte (pure). */
export function railAnchors(C,posts){
  var a=[-C].concat(posts).concat([C]);
  a.sort(function(x,y){return x-y;});
  var gi=0,gw2=-1;
  for(var i=0;i<a.length-1;i++){var g=a[i+1]-a[i];if(g>gw2){gw2=g;gi=i;}}
  return {a:a,gi:gi};
}

/* Barnwright's porch functions, drawing into this build's kit. */
export function porchDrawing(plan, kit){
  var box=kit.box, gq2=kit.gq2, pushQuad=kit.pushQuad, mat=kit.mat;

  /* ---------- porches (natural pressure-treated wood, like the real cabins) ----------
     ONE RUN OF RAILING, parallel to x from x0 to x1 at depth z (railZ: along
     z at x). Skipped if shorter than 0.4 ft. From the deck up: the bottom
     rail (0.14 tall x 0.13 deep) at y0+0.24; 2x2 balusters (0.12 square,
     2.18 tall) from y0+0.38, the first 0.26 in from the start, then every
     0.44 ft (5.3 in on centre) while short of the end by 0.10; the top rail
     at y0+2.56; the flat cap board (0.10 thick, 0.30 deep) at y0+2.78, so
     the top of the railing is 2.88 ft (about 34 1/2 in) above the deck. */
  function railX(mW,x0,x1,z){
    kit.setStage("porch");
    if(x1-x0<0.4)return;
    box(mW,(x0+x1)/2,y0+2.78,z,x1-x0,0.10,0.30);
    box(mW,(x0+x1)/2,y0+2.56,z,x1-x0,0.14,0.13);
    box(mW,(x0+x1)/2,y0+0.24,z,x1-x0,0.14,0.13);
    for(var x=x0+0.26;x<x1-0.10;x+=0.44) box(mW,x,y0+0.38,z,0.12,2.18,0.12);
  }
  function railZ(mW,z0,z1,x){
    kit.setStage("porch");
    if(z1-z0<0.4)return;
    box(mW,x,y0+2.78,(z0+z1)/2,0.30,0.10,z1-z0);
    box(mW,x,y0+2.56,(z0+z1)/2,0.13,0.14,z1-z0);
    box(mW,x,y0+0.24,(z0+z1)/2,0.13,0.14,z1-z0);
    for(var z=z0+0.26;z<z1-0.10;z+=0.44) box(mW,x,y0+0.38,z,0.12,2.18,0.12);
  }

  /* FRONT PORCH (porch "F"): two 4x4 corner posts (drawn 0.34 square, 0.28
     in from the corner) from the deck to the wall top at the porch edge
     z = L/2-0.2; the railing across the front between the corners and any
     porch posts on the F wall, 0.16 clear of each post, widest gap open;
     and a side rail each side from L/2-3.75 to the corner post. The header
     band, wrap bands and ceiling are buildShed's (build() below). */
  function porchFront(W,L,topY,mT){
    var mW=mat("pwood",texFlat,"#96682F",0.05,12);
    var zE=L/2-0.2, C=W/2-0.28;
    kit.setStage("porch-frame");
    [-C,C].forEach(function(px){ box(mW,px,y0,zE,0.34,topY-y0,0.34); });
    var posts=[];
    plan.state.items.forEach(function(o){ if(plan.CAT[o.cat].k==="post" && o.wall==="F") posts.push(o.pos); });
    var r=railAnchors(C,posts);
    for(var j=0;j<r.a.length-1;j++){ if(j!==r.gi) railX(mW,r.a[j]+0.16,r.a[j+1]-0.16,zE); }
    railZ(mW,L/2-3.75,zE-0.16,-(W/2-0.2));
    railZ(mW,L/2-3.75,zE-0.16,(W/2-0.2));
  }

  /* SIDE PORCH (porch "S"), notched 4 ft into the door side (+x). yH is the
     bottom of the 1x4 header band (0.29 under the wall top). */
  function porchSideCorner(W,L,topY,mT){
    var sp=plan.span, f=sp.f, mid=sp.mid, ze=f?-L/2:L/2, sg=f?-1:1;
    var mW=mat("pwood",texFlat,"#96682F",0.05,12);
    var yH=topY-0.29;
    kit.setStage("porch-frame");
    /* header band across the open porch end */
    if(!mid) gq2(mT,[[W/2-4,yH],[W/2,yH],[W/2,topY],[W/2-4,topY]],ze,sg,0.02);
    /* band along the front opening */
    var zLo=mid? sp.z0-0.12 : (f? -L/2 : sp.z0-0.12), zHi=mid? sp.z1+0.12 : (f? sp.z1+0.12 : L/2);
    pushQuad(mT,[W/2+0.02,yH,zHi],[W/2+0.02,yH,zLo],[W/2+0.02,topY,zLo],[W/2+0.02,topY,zHi],
      [0,0],[(zHi-zLo)*1.25,0],[(zHi-zLo)*1.25,0.38],[0,0.38]);
    /* white porch ceiling */
    kit.setStage("porch");
    var mCeil=mat("ceil",texFlat,"#F2F1EA",0.05,12);
    pushQuad(mCeil,[W/2-4,yH+0.01,sp.z0],[W/2,yH+0.01,sp.z0],[W/2,yH+0.01,sp.z1],[W/2-4,yH+0.01,sp.z1],
      [0,0],[5,0],[5,sp.P*1.25],[0,sp.P*1.25]);
    /* fixed post at the wrap corner */
    kit.setStage("porch-frame");
    if(!mid) box(mW,W/2-0.28,y0,ze-sg*0.28,0.34,topY-y0,0.34);
    /* rails along the front edge; the bay in front of the door stays open */
    var a= mid? [sp.z0+0.28, sp.z1-0.28] : [ (f? sp.z1-0.28 : sp.z0+0.28), ze-sg*0.28 ];
    plan.state.items.forEach(function(o){ if(plan.CAT[o.cat].k==="post"&&o.wall==="R") a.push(-o.pos); });
    a.sort(function(x,y){return x-y;});
    var entryZ=null;
    plan.state.items.forEach(function(o){
      if(entryZ===null && o.wall==="S1" && plan.CAT[o.cat].k==="door") entryZ=(sp.z0+sp.z1)/2 - o.pos;
    });
    if(entryZ===null){ var gi=0,gw=-1;
      for(var g=0;g<a.length-1;g++){ if(a[g+1]-a[g]>gw){gw=a[g+1]-a[g];gi=g;} }
      entryZ=(a[gi]+a[gi+1])/2; }
    for(var j=0;j<a.length-1;j++){
      var open=(entryZ>=a[j] && (j===a.length-2? entryZ<=a[j+1] : entryZ<a[j+1]));
      if(!open) railZ(mW,a[j]+0.16,a[j+1]-0.16,W/2-0.2);
    }
    /* railing across the porch end, wall to corner post */
    if(!mid) railX(mW, W/2-3.84, W/2-0.44, ze-sg*0.2);
    /* wood step at the front entry */
    kit.setStage("porch");
    box(mW,W/2+0.78,0,entryZ,1.42,0.30,2.6);
    box(mW,W/2+0.42,0.30,entryZ,0.72,0.34,2.6);
  }

  /* CORNER (WRAP) PORCH (porch "C"): the 4 ft deck across the end plus a
     12 ft run down the door side. */
  function porchCorner(W,L,topY,mT){
    var mW=mat("pwood",texFlat,"#96682F",0.05,12);
    var yH=topY-0.29;
    kit.setStage("porch-frame");
    /* header band across the porch end */
    gq2(mT,[[-W/2,yH],[W/2,yH],[W/2,topY],[-W/2,topY]],L/2,1,0.02);
    /* band along the long-side opening */
    pushQuad(mT,[W/2+0.02,yH,L/2],[W/2+0.02,yH,L/2-12.12],[W/2+0.02,topY,L/2-12.12],[W/2+0.02,topY,L/2],
      [0,0],[15,0],[15,0.38],[0,0.38]);
    /* band along the back-side porch stub */
    pushQuad(mT,[-W/2-0.02,yH,L/2-4.12],[-W/2-0.02,yH,L/2],[-W/2-0.02,topY,L/2],[-W/2-0.02,topY,L/2-4.12],
      [0,0],[5.2,0],[5.2,0.38],[0,0.38]);
    /* white porch ceiling */
    kit.setStage("porch");
    var mCeil=mat("ceil",texFlat,"#F2F1EA",0.05,12);
    pushQuad(mCeil,[-W/2,yH+0.01,L/2-12],[W/2,yH+0.01,L/2-12],[W/2,yH+0.01,L/2],[-W/2,yH+0.01,L/2],
      [0,0],[W/0.8,0],[W/0.8,15],[0,15]);
    /* fixed corner posts at both deck-end corners */
    kit.setStage("porch-frame");
    box(mW,W/2-0.28,y0,L/2-0.28,0.34,topY-y0,0.34);
    box(mW,-W/2+0.28,y0,L/2-0.28,0.34,topY-y0,0.34);
    var zE=L/2-0.2, xE=W/2-0.2;
    /* end-edge rails: corner .. posts .. corner, widest gap open */
    var aF=[-W/2+0.28];
    plan.state.items.forEach(function(o){ if(plan.CAT[o.cat].k==="post"&&o.wall==="F") aF.push(o.pos); });
    aF.push(W/2-0.28); aF.sort(function(a,b){return a-b;});
    var gi=0,gw2=-1;
    for(var i=0;i<aF.length-1;i++){var g=aF[i+1]-aF[i];if(g>gw2){gw2=g;gi=i;}}
    for(var j=0;j<aF.length-1;j++){ if(j!==gi) railX(mW,aF[j]+0.16,aF[j+1]-0.16,zE); }
    /* long-edge rails: corner .. posts .. door-wall junction, widest gap open */
    var aR=[L/2-11.80];
    plan.state.items.forEach(function(o){ if(plan.CAT[o.cat].k==="post"&&o.wall==="R") aR.push(-o.pos); });
    aR.push(L/2-0.28); aR.sort(function(a,b){return a-b;});
    var gi2=0,gw3=-1;
    for(var i2=0;i2<aR.length-1;i2++){var g2=aR[i2+1]-aR[i2];if(g2>gw3){gw3=g2;gi2=i2;}}
    for(var j2=0;j2<aR.length-1;j2++){ if(j2!==gi2) railZ(mW,aR[j2]+0.16,aR[j2+1]-0.16,xE); }
    /* rail stub along the back-side porch edge */
    railZ(mW,L/2-3.84,L/2-0.44,-(W/2-0.2));
  }

  return { railX: railX, railZ: railZ, railAnchors: railAnchors,
           porchFront: porchFront, porchSideCorner: porchSideCorner, porchCorner: porchCorner };
}

export default {
  id: "porch",
  name: "Porch",
  stage: ["porch", "porch-frame"],
  realLife: "The cabin's open porch: {porch.post} posts of natural pressure-treated wood at the open corners, a painted header band over the opening, a white ceiling under the roof, and a wooden railing round the open sides (a flat cap, top and bottom rails and 2x2 balusters) with the widest gap left open as the way in -- and on a side porch a two-riser wooden step at the entry.",
  appliesTo(plan) { return plan.t.porch === "F" || plan.t.porch === "C" || plan.t.porch === "S"; },
  build(plan, kit, core) {
    var W=plan.W, L=plan.L, t=plan.t, topY=plan.topY;
    var mT=core.mT;
    var gq2=kit.gq2, pushQuad=kit.pushQuad, mat=kit.mat;
    var P=porchDrawing(plan, kit);
    /* porches: white header band, white ceiling, wrap bands (like the real cabins) */
    if(t.porch==="F"){
      var yH=topY-0.29;
      kit.setStage("porch-frame");
      gq2(mT,[[-W/2,yH],[W/2,yH],[W/2,topY],[-W/2,topY]],L/2,1,0.02);
      pushQuad(mT,[W/2+0.02,yH,L/2],[W/2+0.02,yH,L/2-4],[W/2+0.02,topY,L/2-4],[W/2+0.02,topY,L/2],
        [0,0],[5,0],[5,0.38],[0,0.38]);
      pushQuad(mT,[-W/2-0.02,yH,L/2-4],[-W/2-0.02,yH,L/2],[-W/2-0.02,topY,L/2],[-W/2-0.02,topY,L/2-4],
        [0,0],[5,0],[5,0.38],[0,0.38]);
      kit.setStage("porch");
      var mCeil=mat("ceil",texFlat,"#F2F1EA",0.05,12);
      pushQuad(mCeil,[-W/2,yH+0.01,L/2-4],[W/2,yH+0.01,L/2-4],[W/2,yH+0.01,L/2],[-W/2,yH+0.01,L/2],
        [0,0],[W/0.8,0],[W/0.8,5],[0,5]);
      P.porchFront(W,L,topY,mT);
    }
    if(t.porch==="C"){ P.porchCorner(W,L,topY,mT); }
    if(t.porch==="S"){ P.porchSideCorner(W,L,topY,mT); }
  },
};
