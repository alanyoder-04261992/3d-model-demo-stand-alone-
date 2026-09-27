/* THE SKIDS: the treated runners the whole building sits on. Node-safe.

   A portable building is built on skids -- heavy treated timbers laid on edge
   along the length, so the building can be dragged onto a trailer and set on
   blocks. The floor joists sit on them. They are shown in the Finished view
   AND the Framing view (stage "skids", kind "both").

   Ported from Barnwright's 3ddesign.html: skidXs (lines 3826-3851) and the
   skid boxes in buildShed's floor loop (lines 3868-3875), numbers byte for
   byte:

     var SKX=skidXs(W);
     for(var fi=0;fi<NF;fi++){ ...segment fz0 fz1 fzc fl (parts/floor.js)...
       var fend=fl+(fi===0||fi===NF-1?0.2:0);
       for(var sx=0;sx<SKX.length;sx++) box(mSk,SKX[sx],0,fzc,0.5,0.5,fend);
       ...floor slab (parts/floor.js)...
     }

   Porting edits (docs/ARCHITECTURE.md, Porting rules):
   * rule 4, a shop literal becomes a construction read with Barnwright's value
     as the default: skidXs's SHEET is plan.construction.skids.table and its
     60 in fallback is skids.bunkSpacingIn (library/construction.json holds
     Alan's exact sheet and 60, so every building is drawn as before);
   * the floor segments come from parts/floor.js floorSegments() -- the same
     arithmetic, so the skids and the slab can never disagree;
   * mSk is core.mSk (made by assemble); setStage added.

   The drawn skid is 0.5 x 0.5 ft (6 in square), from the ground to y 0.5,
   and the end segments run 0.2 ft longer so the skids poke about 0.1 ft past
   each end of the floor. The real skid is a 4x6 on edge (the caption names
   it); the drawing keeps Barnwright's box because the finished picture is
   Barnwright's. */

import { floorSegments } from "./floor.js";
import { floorFrameMembers, floorPlanOf, prismMember, cleanPoly, drawPrism } from "./floor-frame.js";

/* WHERE THE SKIDS SIT UNDER THE BUILDING. Alan's build sheet, Sep 2026,
   measured from each side edge of the building in to the CENTRE of a skid:

     6 wide  ..  6"              8 wide .. 18"           10 wide .. 30"
     12 wide ..  8" and 37"      14 wide ..  8" and 54"      (four skids)

   Six, eight and ten wide are two skids and all three land on exactly 60"
   between centres -- one trailer's bunk spacing, which is the number that
   makes the rest of the sheet read straight, and it is what an unlisted
   width falls back to. Twelve and fourteen carry four: a pair tucked right
   under the walls and a pair on the bunks.

   It was ONE rule before this, +/- 0.30 x width, which put two skids on
   every building however wide and sat them nowhere in particular -- on a
   12 wide that is 28.8" in from the edge, and there should be four.

   (Barnwright's comment, kept word for word. The sheet itself now lives in
   library/construction.json skids.table, and a company can change it.)

   skidXs(w, skids) -> the x of every skid centre, in feet, in pairs
   (-x then +x) from the outside in. `skids` is plan.construction.skids;
   without it Barnwright's own sheet and 60 in are used. */
export function skidXs(w, skids){
  var IN=1/12;
  var SHEET=(skids&&skids.table)||{6:[6],8:[18],10:[30],12:[8,37],14:[8,54]};
  var BUNK=(skids&&skids.bunkSpacingIn!=null)?skids.bunkSpacingIn:60;
  var ins=SHEET[Math.round(w)] || [Math.max(6,(w*12-BUNK)/2)];
  var xs=[];
  for(var si=0;si<ins.length;si++){
    xs.push(-w/2+ins[si]*IN);
    xs.push( w/2-ins[si]*IN);
  }
  return xs;
}

/* A single notched timber for the opt-in teaching plan. Its side profile is
   extruded across the measured width: no overlapping boxes or segment seams.
   Notch widths, layout origin, end joints and support positions retain their
   separate confirmation status in plan.floorStudy.status. */
export function skidStudyMembers(plan) {
  const study = plan.floorStudy;
  if (!study) return [];
  const W = study.skids.widthFt, H = study.skids.heightFt;
  const z0 = -study.skids.lengthFt/2, z1 = study.skids.lengthFt/2;
  const seat = study.joistBottomFt, half = study.notches.widthFt/2;
  const F = floorPlanOf(plan);
  const cross = floorFrameMembers(plan).filter((m) => ["joist", "end-joist", "wall-joist"].includes(m.kind));
  // This explicit two-skid lesson datum is from the outside wall to the
  // timber's INSIDE face, not its centre. Ordinary plans still use skidXs.
  const inset = study.skids.insetToInsideIn;
  const centreX = inset == null ? null : plan.W/2-(inset-study.skids.widthIn/2)/12;
  const xs = centreX == null ? skidXs(plan.W,plan.construction.skids) : [-centreX,centreX];
  return xs.map((xFt) => {
    const candidates = [];
    function add(center, source) {
      const lo = Math.max(z0,center-half), hi = Math.min(z1,center+half);
      if (hi > lo+1e-9) candidates.push({z0Ft:lo,z1Ft:hi,sources:[source]});
    }
    for (const m of cross) {
      const lo = Math.min(m.p0[0],m.p1[0]), hi = Math.max(m.p0[0],m.p1[0]);
      if (xFt+W/2 > lo && xFt-W/2 < hi) add((m.p0[2]+m.p1[2])/2,m.kind === "joist" ? "standard" : m.kind);
    }
    const alt = study.notches.alternateSpacingFt;
    if (alt != null) {
      // Same still-provisional back datum as the regular cross members.
      for (let k=1; ; k++) {
        const center=F.roomRect.z0+k*alt;
        if (center+half > F.roomRect.z1-F.joist.t+1e-9) break;
        add(center,"alternate");
      }
    }
    candidates.sort((a,b)=>a.z0Ft-b.z0Ft);
    const merged=[];
    for (const cut of candidates) {
      const previous=merged[merged.length-1];
      if (previous && cut.z0Ft <= previous.z1Ft+1e-9) {
        previous.z1Ft=Math.max(previous.z1Ft,cut.z1Ft);
        previous.sources=[...new Set(previous.sources.concat(cut.sources))];
      } else merged.push({...cut});
    }
    const notches=merged.map((cut)=>({ ...cut,xFt,centerZFt:(cut.z0Ft+cut.z1Ft)/2,
      widthFt:cut.z1Ft-cut.z0Ft,depthFt:H-seat,seatYFt:seat,topYFt:H }));
    const profile=[[z0,0],[z1,0],[z1,H]];
    for (const cut of notches.slice().reverse()) profile.push([cut.z1Ft,H],[cut.z1Ft,seat],[cut.z0Ft,seat],[cut.z0Ft,H]);
    profile.push([z0,H]);
    const member=prismMember("notched-skid","treated",cleanPoly(profile),[xFt-W/2,0,0],
      [0,0,1],[0,1,0],[1,0,0],W,{xFt,nominal:study.skids.nominal,notches});
    member.stage="skids";
    return member;
  });
}

export default {
  id: "skids",
  name: "Skids",
  stage: "skids",
  realLife: "Treated {skids.size} runners laid on edge along the length of the building, placed from the build sheet (inches in from each side edge to a skid's centre), with the floor joists sitting on them.",
  appliesTo() { return true; },
  build(plan, kit, core) {
    var W = plan.W;
    var mSk = core.mSk;
    kit.setStage("skids");
    if (plan.floorStudy) {
      skidStudyMembers(plan).forEach(function(member) { drawPrism(kit,mSk,member); });
      return;
    }
    var SKX=skidXs(W,plan.construction&&plan.construction.skids);
    floorSegments(plan).forEach(function (s) {
      var fend=s.fl+(s.fi===0||s.fi===s.NF-1?0.2:0);
      for(var sx=0;sx<SKX.length;sx++) kit.box(mSk,SKX[sx],0,s.fzc,0.5,0.5,fend);
    });
  },
};
