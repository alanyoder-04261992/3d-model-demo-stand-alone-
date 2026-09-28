/* WHAT EVERY DOOR, WINDOW AND LIGHT SHARES. Node-safe: no DOM, no WebGL.

   Not a part of its own (it draws nothing by itself): the helpers the draw
   modules in this folder use, so the trim round a door and the trim round a
   window are the same code and cannot drift apart.

   1. eachItem(plan, kit, want, fn) -- Barnwright's renderItem PREAMBLE
      (3ddesign.html 3122-3140), run for every item on the building in the
      order the customer added them (plan.state.items):
        * an item that lives INSIDE the building (bench, shelf, outlets, the
          overhead light: the `int` trait) draws nothing in 3D and is skipped
          BEFORE anything else, so it never makes a material;
        * a transom turned on end swaps its width and height;
        * a wooden shop door takes the shop's door height for this roof
          (71 1/2 in on loft builds, 76 1/2 in on tall walls --
          plan.construction openings.doorHeightIn, model/construction.js);
        * the item is made the one being drawn (kit.setItem: the selected one
          glows) and the five materials Barnwright makes for EVERY item are
          made, in its order: trim, body (with its weathering), dark, white,
          glass. The body one is never drawn with here -- but when the item
          is the selected one it makes the glowing twin "body!==g", and the
          draw order of the materials depends on it, so it stays;
        * fn(it, c, mats) draws it; kit.setItem(null) on every way out.
   2. itemTools(kit) -- Barnwright's item primitives (3062-3121), word for
      word: wret wrev wslab wbevel wdisc wdrum wslant and the unit UV set RUV.
      They take the kit as an argument (through this factory) instead of
      reading globals; their bodies are Barnwright's, winding and all.
   3. openingFrame(plan, kit, it, c, mT) -- the part of renderItem every door,
      roll-up and wall window goes through (3172-3236): where the opening is
      (its bottom yb and height ch, from model/layout.js openingRect, which is
      proven to give Barnwright's numbers -- tools/check-model-live.mjs), its
      tap target, the soft shadow round it, the side casings, the 22.5-degree
      head board, and on a porch building the header band.
   4. windowSill(plan, kit, f, mT) -- the sloped sill under a wall window
      (3469-3481).

   WHERE THE OPENING SITS -- the shop's rules, as Barnwright wrote them beside
   the arithmetic (now in model/layout.js openingRect, which reads the two
   heights from plan.construction with Barnwright's numbers as defaults):
     * shop door openings: 71 1/2" tall on loft (short-wall) builds, 76 1/2" on
       tall walls;
     * cottage: full foot between door top and roof;
     * slope: doors stay under the belt band; header trim never pokes above
       the eave;
     * doors on the end walls rise into the gable up to the roofline; the
       header casing (0.30 above the leaf) must finish under the gable band;
     * shop rule: on loft builds a window top sits 5" under the wall top and
       never higher; on tall walls the window top matches the shop-door
       opening (76 1/2"), so both trims run level around the building.

   NO HOLE IS EVER CUT IN THE WALL. The siding is one unbroken sheet, and
   every opening is layered in front of it a few hundredths of a foot out: the
   door or curtain at 0.03-0.05, the casings 0.02 -> 0.12 proud, the head face
   at 0.13, the porch band at 0.14, the sill face at 0.17, the tap target at
   0.3. The depth ORDER of those offsets is the whole illusion of a recessed
   opening -- never round or reorder one.

   Porting edits (docs/ARCHITECTURE.md, Porting rules), and nothing else:
   * rule 1: T() -> plan.t, state -> plan.state, CAT -> plan.CAT,
     wallDefs() -> plan.ws; mat quadUV wallPt wq wtri3 are the kit's;
   * rule 3: it.cat==="tr" -> the "transom" draw trait; it.cat==="w36"|"w48"|
     "w72" -> the "shop-door" draw trait. Barnwright's override copies of the
     catalogue entry dropped every field it did not list; they now also carry
     `draw` and `leaves`, because those traits are what the item-code tests
     became (rule 3) and must survive the copy;
   * rule 4: the shop door heights 5.9583 / 6.375 are
     openings.doorHeightIn (71.5 / 76.5 in, drawn to four decimals of a foot
     -- exactly Barnwright's numbers); the window-top rule is
     openings.windowTop;
   * rule 5: the opening's bottom and height (3172-3197) come from
     openingRect(it, plan) -- the same arithmetic, moved into model/layout.js
     so the framing and the picking use the same rectangle;
   * rule 6: CURIT -> kit.setItem; hitQuads.push -> kit.hit. */

import { texTrim, texSiding, texMetal, texFlat, texGlass } from "../../engine/tex-names.js";
import { CASING } from "../../engine/constants.js";
import { tintShade } from "../../engine/math.js";
import { openingRect, itemW } from "../../model/layout.js";
import { doorHeightFt } from "../../model/construction.js";

/* ---------- 1. the renderItem preamble, for every item in order ---------- */
/* want(c) (optional) picks which items to draw -- a draw module drawing only
   its own kind; the whole building passes null. */
export function eachItem(plan, kit, want, fn) {
  plan.state.items.forEach(function (it) {
    var c=plan.CAT[it.cat];
    if(!c) return;                                              /* an item this catalogue does not have: nothing to draw */
    if(c.int){ return; }                                        /* interior items live in the floor plan */
    if(it.rot&&c.draw==="transom"){ c={k:c.k,n:c.n,w:c.h,h:c.w,p:c.p,sill:c.sill,draw:c.draw,leaves:c.leaves}; }   /* transom turned 90 degrees */
    if(c.draw==="shop-door"){
      /* shop door openings: 71 1/2" tall on loft (short-wall) builds, 76 1/2" on tall walls */
      c={k:c.k,n:c.n,w:c.w,h:doorHeightFt(plan.construction,plan.t.roof),p:c.p,sill:c.sill,draw:c.draw,leaves:c.leaves};
    }
    if(want && !want(c)) return;
    kit.setItem(it.id);
    try{
      var mT=kit.mat("trim",texTrim,plan.state.trim,0.10,20,0.12);
      /* T().metal, not state.metal. Whether a building is steel is a fact about its
         TYPE - Metal Utility, Metal Lofted Barn - and state has no such field, so
         this read undefined and every metal building was given wooden siding while
         the three settings beside it correctly said steel. */
      var mB=kit.mat("body",plan.t.metal?texMetal:texSiding,plan.state.body,plan.t.metal?0.5:0.06,plan.t.metal?40:14,plan.t.metal?1.1:0.6);
      mB.age=plan.t.metal?3:4;
      var mDark=kit.mat("dark",texFlat,"#2E3134",0.3,30);
      var mWht=kit.mat("white",texFlat,"#FBFBF8",0.12,22);
      var mG=kit.mat("glass",texGlass,[1,1,1],1.2,80); mG.glassM=1;
      fn(it,c,{mT:mT,mB:mB,mDark:mDark,mWht:mWht,mG:mG});
    } finally {
      kit.setItem(null);
    }
  });
}

/* ---------- 2. the item primitives (Barnwright 3062-3121, word for word) ---------- */
var RUV=[[0,0],[1,0],[1,1],[0,1]];
var TOOLS=new WeakMap();

export function itemTools(kit) {
  var got=TOOLS.get(kit);
  if(got) return got;
  var quadUV=kit.quadUV, wallPt=kit.wallPt, wq=kit.wq, wtri3=kit.wtri3;
  function wret(m,w,u0,ya,u1,yb2,o0,o1){ /* perimeter returns of a protruding slab */
    quadUV(m,[wallPt(w,u0,ya,o0),wallPt(w,u0,ya,o1),wallPt(w,u0,yb2,o1),wallPt(w,u0,yb2,o0)],RUV);
    quadUV(m,[wallPt(w,u1,ya,o1),wallPt(w,u1,ya,o0),wallPt(w,u1,yb2,o0),wallPt(w,u1,yb2,o1)],RUV);
    quadUV(m,[wallPt(w,u0,yb2,o1),wallPt(w,u1,yb2,o1),wallPt(w,u1,yb2,o0),wallPt(w,u0,yb2,o0)],RUV);
    quadUV(m,[wallPt(w,u0,ya,o0),wallPt(w,u1,ya,o0),wallPt(w,u1,ya,o1),wallPt(w,u0,ya,o1)],RUV);
  }
  function wrev(m,w,u0,ya,u1,yb2,oIn,oOut){ /* jamb reveal walls of a recess */
    quadUV(m,[wallPt(w,u0,ya,oIn),wallPt(w,u0,ya,oOut),wallPt(w,u0,yb2,oOut),wallPt(w,u0,yb2,oIn)],RUV);
    quadUV(m,[wallPt(w,u1,ya,oOut),wallPt(w,u1,ya,oIn),wallPt(w,u1,yb2,oIn),wallPt(w,u1,yb2,oOut)],RUV);
    quadUV(m,[wallPt(w,u0,yb2,oOut),wallPt(w,u1,yb2,oOut),wallPt(w,u1,yb2,oIn),wallPt(w,u0,yb2,oIn)],RUV);
    quadUV(m,[wallPt(w,u0,ya,oIn),wallPt(w,u1,ya,oIn),wallPt(w,u1,ya,oOut),wallPt(w,u0,ya,oOut)],RUV);
  }
  function wslab(m,w,u0,ya,u1,yb2,o0,o1,uvm){ wq(m,w,u0,ya,u1,yb2,o1,uvm); wret(m,w,u0,ya,u1,yb2,o0,o1); }
  /* A RAISED PANEL. The field stands proud of the slab on four slanted bevels, so
     the top one catches sun and the bottom one falls into shade. That is the whole
     reason a six-panel door reads as a six-panel door instead of six rectangles
     drawn on a flat sheet -- which is what it was. */
  function wbevel(m,w,u0,ya,u1,yb2,ins,o0,o1){
    var i0=u0+ins,i1=u1-ins,j0=ya+ins,j1=yb2-ins;
    if(i1<=i0||j1<=j0) return;
    quadUV(m,[wallPt(w,u0,ya,o0),wallPt(w,u1,ya,o0),wallPt(w,i1,j0,o1),wallPt(w,i0,j0,o1)],RUV);
    quadUV(m,[wallPt(w,i0,j1,o1),wallPt(w,i1,j1,o1),wallPt(w,u1,yb2,o0),wallPt(w,u0,yb2,o0)],RUV);
    quadUV(m,[wallPt(w,u0,ya,o0),wallPt(w,i0,j0,o1),wallPt(w,i0,j1,o1),wallPt(w,u0,yb2,o0)],RUV);
    quadUV(m,[wallPt(w,i1,j0,o1),wallPt(w,u1,ya,o0),wallPt(w,u1,yb2,o0),wallPt(w,i1,j1,o1)],RUV);
  }
  /* a round thing on a wall -- a knob, a rose. Stacked boxes made a doorknob look
     like a little staircase; twelve sides read as round at any size it is ever
     drawn. */
  function wdisc(m,w,cu,cy,r,o,rot){
    var N=12, prev=null, first=null;
    for(var i=0;i<=N;i++){
      var a=rot+i/N*Math.PI*2, pt=[cu+Math.cos(a)*r, cy+Math.sin(a)*r];
      if(prev) wtri3(m,w,[cu,cy],prev,pt,o);
      prev=pt; if(i===0) first=pt;
    }
  }
  /* the side wall of a disc that stands proud, so it has a rim you can see */
  function wdrum(m,w,cu,cy,r,o0,o1,rot){
    var N=12;
    for(var i=0;i<N;i++){
      var a0=rot+i/N*Math.PI*2, a1=rot+(i+1)/N*Math.PI*2;
      var p0=[cu+Math.cos(a0)*r, cy+Math.sin(a0)*r], p1=[cu+Math.cos(a1)*r, cy+Math.sin(a1)*r];
      quadUV(m,[wallPt(w,p0[0],p0[1],o0),wallPt(w,p1[0],p1[1],o0),wallPt(w,p1[0],p1[1],o1),wallPt(w,p0[0],p0[1],o1)],RUV);
    }
  }
  /* a band that leans out of the wall as it rises -- one half of a crown. Two of
     these back to back make a rolled slat that shades like a real one. */
  function wslant(m,w,u0,u1,ya,oa,yb2,ob){
    /* The corners have to come out anticlockwise seen from outside, or the face is
       turned inside out and back-face culling throws the whole quad away - it does
       not draw wrong, it does not draw at all.
       Two of the six calls here name their HIGH edge first: the door threshold and
       the roll-up's floor plate both slope down and outwards, which is the natural
       way to describe them. Both were invisible on every building because of it.
       Rather than make each caller remember, the pair is put in order here. */
    if(ya>yb2){ var ty=ya, to=oa; ya=yb2; oa=ob; yb2=ty; ob=to; }
    quadUV(m,[wallPt(w,u0,ya,oa),wallPt(w,u1,ya,oa),wallPt(w,u1,yb2,ob),wallPt(w,u0,yb2,ob)],
      [[0,0],[(u1-u0)/0.8,0],[(u1-u0)/0.8,0.12],[0,0.12]]);
  }
  got=Object.freeze({ RUV: RUV, wret: wret, wrev: wrev, wslab: wslab, wbevel: wbevel, wdisc: wdisc, wdrum: wdrum, wslant: wslant });
  TOOLS.set(kit,got);
  return got;
}

/* ---------- 3. the opening frame: tap target, casings, head, porch band (3172-3236) ----------
   Returns what the leaf drawing needs: { w, ch, yb, u, fr, HW2, isWn, revealY },
   or null when the item's wall does not exist on this building (Barnwright
   would stop with an error there; nothing is drawn instead). */
export function openingFrame(plan, kit, it, c, mT) {
  var P=itemTools(kit), wslab=P.wslab;
  var mat=kit.mat, wq=kit.wq, quadUV=kit.quadUV, wallPt=kit.wallPt, wtri3=kit.wtri3;
  var w=plan.ws[it.wall];
  var r=openingRect(it, plan);                /* rule 5: Barnwright 3172-3197, the same numbers */
  if(!w || !r) return null;
  var ch=r.ch, yb=r.yb;
  var u=it.pos, fr=CASING, HW2=itemW(it,plan.CAT)/2;   /* HW2 is half the WHOLE opening -- a double window is two, sharing a board */
  kit.hit(it.id, w.n, [wallPt(w,u-HW2-fr,yb-fr,0.3),wallPt(w,u+HW2+fr,yb-fr,0.3),wallPt(w,u+HW2+fr,yb+ch+fr,0.3),wallPt(w,u-HW2-fr,yb+ch+fr,0.3)]);
  /* casing: protruding jamb frame with a soft wall shadow behind it */
  var isWn=(c.k==="win");
  var mAO=mat("aoWall",texFlat,tintShade(plan.state.body,0.60),0.04,8);
  wq(mAO,w,u-HW2-fr-0.05,yb-(isWn?fr:0)-0.05,u+HW2+fr+0.07,yb+ch+fr+0.05,0.015);
  /* casings the way the shop cuts them (see the lot photos): side casings run
     between sill and head; the head board is WIDEST AT ITS TOP, the ends cut
     at 22.5 degrees sloping back down to land flush on the side casings */
  /* THE REVEAL IS A DOOR DETAIL, and only a door gets it.
     On a door the side casings stop just below the head board rather than
     running through it, so the three boards read as three cut boards with a
     joint between them instead of one poured white slab. That was asked for and
     it is what the lot photographs show.
     A window is not trimmed that way. Its casing runs right up into the head,
     and giving it the door's gap and the shadow that fills it made the trim
     round every window look broken - a white line across the top corners of
     something that should be one continuous frame. */
  var revealY=isWn? (yb+ch+0.02) : (yb+ch-0.06);
  wslab(mT,w,u-HW2-fr,yb,u-HW2+0.02,revealY,0.02,0.12);
  wslab(mT,w,u+HW2-0.02,yb,u+HW2+fr,revealY,0.02,0.12);
  var hE=0.12, hxl=u-HW2-fr, hxr=u+HW2+fr, hyb=yb+ch-0.02, hyt=yb+ch-0.02+0.29;
  /* the shadow the head board drops into that gap. Sits in front of the side
     casings (0.12) and behind the head board's face (0.13), so it fills the
     reveal without poking through either. There is no gap on a window, so there
     is nothing for it to fill. */
  if(!isWn) wq(mAO,w,hxl,revealY,hxr,hyb,0.125);
  quadUV(mT,[wallPt(w,hxl,hyb,0.13),wallPt(w,hxr,hyb,0.13),wallPt(w,hxr+hE,hyt,0.13),wallPt(w,hxl-hE,hyt,0.13)],
    [[0,0],[(hxr-hxl)/0.8,0],[(hxr-hxl)/0.8,0.36],[0,0.36]]);
  quadUV(mT,[wallPt(w,hxl,hyb,0.02),wallPt(w,hxr,hyb,0.02),wallPt(w,hxr,hyb,0.13),wallPt(w,hxl,hyb,0.13)],RUV);
  quadUV(mT,[wallPt(w,hxl-hE,hyt,0.13),wallPt(w,hxr+hE,hyt,0.13),wallPt(w,hxr+hE,hyt,0.02),wallPt(w,hxl-hE,hyt,0.02)],RUV);
  quadUV(mT,[wallPt(w,hxl,hyb,0.02),wallPt(w,hxl,hyb,0.13),wallPt(w,hxl-hE,hyt,0.13),wallPt(w,hxl-hE,hyt,0.02)],RUV);
  quadUV(mT,[wallPt(w,hxr,hyb,0.13),wallPt(w,hxr,hyb,0.02),wallPt(w,hxr+hE,hyt,0.02),wallPt(w,hxr+hE,hyt,0.13)],RUV);
  if(plan.t.porch && c.k!=="ru"){
    var hby=yb+ch+fr-0.04, hbh=0.29, hbe=0.12;
    wq(mT,w,u-HW2-fr,hby,u+HW2+fr,hby+hbh,0.14);
    wtri3(mT,w,[u-HW2-fr-hbe,hby],[u-HW2-fr,hby],[u-HW2-fr,hby+hbh],0.14);
    wtri3(mT,w,[u+HW2+fr+hbe,hby],[u+HW2+fr,hby],[u+HW2+fr,hby+hbh],0.14);
  }
  return { w: w, ch: ch, yb: yb, u: u, fr: fr, HW2: HW2, isWn: isWn, revealY: revealY };
}

/* ---------- 4. the window sill (3468-3481) ---------- */
export function windowSill(plan, kit, f, mT) {
  var mat=kit.mat, wq=kit.wq, quadUV=kit.quadUV, wallPt=kit.wallPt;
  var w=f.w, u=f.u, HW2=f.HW2, fr=f.fr, yb=f.yb;
  /* sloped sill with returns and shadow beneath */
  /* the sill mirrors the head: widest at its BOTTOM, ends cut at 22.5
     degrees flaring down and out from the side casings, face sitting a
     little prouder than the casings the way a real sill does */
  var sx0=u-HW2-fr, sx1=u+HW2+fr, syt=yb-0.02, syb=yb-0.27, sE=0.10;
  var mAO2=mat("aoWall",texFlat,tintShade(plan.state.body,0.60),0.04,8);
  wq(mAO2,w,sx0-0.05,syb-0.13,sx1+0.05,syb,0.018);
  quadUV(mT,[wallPt(w,sx0-sE,syb,0.17),wallPt(w,sx1+sE,syb,0.17),wallPt(w,sx1,syt,0.17),wallPt(w,sx0,syt,0.17)],
    [[0,0],[(sx1-sx0)/0.8,0],[(sx1-sx0)/0.8,0.31],[0,0.31]]);
  quadUV(mT,[wallPt(w,sx0,syt,0.17),wallPt(w,sx1,syt,0.17),wallPt(w,sx1,syt,0.02),wallPt(w,sx0,syt,0.02)],RUV);
  quadUV(mT,[wallPt(w,sx0-sE,syb,0.02),wallPt(w,sx1+sE,syb,0.02),wallPt(w,sx1+sE,syb,0.17),wallPt(w,sx0-sE,syb,0.17)],RUV);
  quadUV(mT,[wallPt(w,sx0-sE,syb,0.02),wallPt(w,sx0-sE,syb,0.17),wallPt(w,sx0,syt,0.17),wallPt(w,sx0,syt,0.02)],RUV);
  quadUV(mT,[wallPt(w,sx1+sE,syb,0.17),wallPt(w,sx1+sE,syb,0.02),wallPt(w,sx1,syt,0.02),wallPt(w,sx1,syt,0.17)],RUV);
}

/* ---------- 5. handing one item to its draw module ----------
   A draw module (door-wood.js, window.js ...) exports { id, stage, draws,
   drawItem(plan, kit, it, c, mats) }. drawWith runs drawItem with every
   triangle attributed to the module's part (its id, a golden part label) and
   on the module's main building step (the first of its stages); kit.part
   puts the step back afterwards. */
export function drawWith(plan, kit, m, it, c, mats) {
  kit.part(m.id, function () {
    kit.setStage(Array.isArray(m.stage) ? m.stage[0] : m.stage);
    m.drawItem(plan, kit, it, c, mats);
  });
}

/* Every item of ONE draw module's kind, on its own -- that module's
   build(plan, kit). The whole building does not use this: it goes through
   parts/openings/index.js, which walks every item once, in order. */
export function drawOwn(plan, kit, m) {
  eachItem(plan, kit, function (c) { return m.draws.indexOf(c.draw) >= 0; }, function (it, c, mats) {
    drawWith(plan, kit, m, it, c, mats);
  });
}

/* Does this building carry an item drawn by one of these draw traits? (a draw
   module's appliesTo) */
export function hasDraw(plan, draws) {
  return plan.state.items.some(function (it) {
    var c = plan.CAT[it.cat];
    return !!c && !c.int && draws.indexOf(c.draw) >= 0;
  });
}
