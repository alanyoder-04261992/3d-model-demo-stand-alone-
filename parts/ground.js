/* THE GROUND THE BUILDING STANDS ON: the lawn (or the studio floor), the soft
   contact shadow under the skids, and the shadow tucked under a barn roof's
   eaves. Node-safe.

   In real life this is the customer's yard. In the picture it is:
   * the LAWN DISC (stage "site", kind "always": shown in every view) -- a
     72-sided disc just above y 0, in the scene's ground paint (studio floor,
     yard grass, paper sweep: engine/scene-data.js). Its radius is also where
     the haze starts and ends (the renderer's fog), so assemble hands it back
     as `gr` (Barnwright's window.__GR);
   * the CONTACT SHADOW (stage "shading") -- a darkening decal 0.85 ft wider
     than the building on every side, just above the lawn;
   * the EAVE SHADOW (stage "shading") on gambrel (barn) roofs -- a decal down
     the top 1.05 ft of each long wall, where the deep eave shades it.

   Ported from Barnwright's 3ddesign.html buildShed, lines 4044-4074, numbers
   byte for byte. Porting edits (docs/ARCHITECTURE.md, Porting rules):
   SC() -> kit.view.scene; cam.fitDist -> kit.view.fitDist; window.__GR = GR
   -> returned as { gr } for assemble; texGrass/texFlat/texAO/texAOv are the
   texture NAMES (engine/tex-names.js); W, L, ws are plan.W, plan.L, plan.ws
   (L includes the corner porch's 4 ft, as Barnwright's dims() does);
   setStage added. The lawn uses MAT (not mat): it never glows. */

import { texGrass, texFlat, texAO, texAOv } from "../engine/tex-names.js";

/* The lawn's radius: at least 1.28 x the camera distance and 3 x the longer
   side of the building (Barnwright 4054). */
export function groundRadius(fitDist, W, L) {
  return Math.max(fitDist*1.28,Math.max(W,L)*3.0);
}

export default {
  id: "ground",
  name: "Ground",
  stage: ["site", "shading"],
  realLife: "The yard the building is set down in, with the soft shadow the building casts on the ground around its skids (and, under a barn roof, the shade the deep eaves throw on the top of the walls).",
  appliesTo() { return true; },
  build(plan, kit) {
    var W = plan.W, L = plan.L, t = plan.t, ws = plan.ws;
    kit.setStage("site");
    /* ground disc — lawn fading into the horizon haze */
    /* the lawn was painted at nearly full brightness, and full sun on top of that
       took it to a pale mint no grass has ever been. Held down to roughly what a
       mown St Augustine yard actually reflects, it reads as grass again. */
    var g9=kit.view.scene.ground;
    var mGr=kit.MAT("ground",g9.tex==="grass"?texGrass:texFlat,g9.tint,g9.spec,g9.gloss,0,g9.bump);
    mGr.noCast=true; mGr.turf=g9.turf;
    /* THE LAWN. It used to be a disc half the camera distance across, which put
       the haze about a barn-and-a-half out and left the building sitting on a
       green doormat. A real yard runs off past the fence, so this one does too --
       the grass stays grass out to arm's length and only then goes soft. */
    var GR=groundRadius(kit.view.fitDist,W,L), SEG=72;
    for(var s2=0;s2<SEG;s2++){
      var a0=s2/SEG*Math.PI*2, a1=(s2+1)/SEG*Math.PI*2;
      kit.pushTri(mGr,[0,0.004,0],[Math.cos(a1)*GR,0.004,Math.sin(a1)*GR],[Math.cos(a0)*GR,0.004,Math.sin(a0)*GR],
        [0,0],[Math.cos(a1)*GR/3.0,Math.sin(a1)*GR/3.0],[Math.cos(a0)*GR/3.0,Math.sin(a0)*GR/3.0]);
    }
    kit.setStage("shading");
    /* soft contact shadow hugging the ground around the skids */
    var mCS=kit.DECAL("ctshadow",texAO), exd=0.85;
    kit.pushQuad(mCS,[-W/2-exd,0.012,L/2+exd],[W/2+exd,0.012,L/2+exd],[W/2+exd,0.012,-L/2-exd],[-W/2-exd,0.012,-L/2-exd],
      [0,0],[1,0],[1,1],[0,1]);
    /* ambient occlusion tucked under the eaves of barn roofs */
    if(t.roof==="gambrel"){
      var mEA=kit.DECAL("eaveAO",texAOv);
      ["R","L"].forEach(function(k9){
        var w9=ws[k9], h9=w9.len/2;
        kit.quadUV(mEA,[kit.wallPt(w9,-h9,w9.top-1.05,0.02),kit.wallPt(w9,h9,w9.top-1.05,0.02),kit.wallPt(w9,h9,w9.top,0.02),kit.wallPt(w9,-h9,w9.top,0.02)],
          [[0,1],[1,1],[1,0],[0,0]]);
      });
    }
    return { gr: GR };
  },
};
