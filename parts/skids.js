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
    var SKX=skidXs(W,plan.construction&&plan.construction.skids);
    floorSegments(plan).forEach(function (s) {
      var fend=s.fl+(s.fi===0||s.fi===s.NF-1?0.2:0);
      for(var sx=0;sx<SKX.length;sx++) kit.box(mSk,SKX[sx],0,s.fzc,0.5,0.5,fend);
    });
  },
};
