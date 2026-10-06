/* WINDOW HEADER: Alan's loft-wall header has two touching 2x4s on edge
   on one flat 2x4. Actual stock is 1.5 x 3.5 inches, so the assembly is
   5 inches tall. The remaining half-inch ledge is OUTSIDE; inside faces
   are flush. Header top contacts the underside of the TOP PLATE.
   Header length and its relationship to opening/support widths are separate
   inputs; this detail does not invent the window's side framing.
   This is specifically the LOFTED-WALL rule. The separate window plate
   below the opening is a flat 2x4 with studs underneath; it is not the
   flat board in this header. That lower assembly lives in window-plate.js;
   its studs sit on the bottom plate and follow the wall layout.
   A LESSON part (`lesson`, parts/README.md): only window-framing.html builds
   the windowHeaderStudy it needs, so no building in the designer has one. */
import { prismMember, drawMembers } from "./floor-frame.js";

export function windowHeaderMembers(plan) {
  const s=plan.windowHeaderStudy;
  if(!s) return [];
  const {lengthFt,topYFt,bottomYFt,outsideZFt,thicknessFt,depthFt,ledgeFt}=s;
  const x0=s.centerXFt-lengthFt/2,x1=s.centerXFt+lengthFt/2;
  function board(kind,y0,y1,z0,z1,name) {
    const item=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,z0],[1,0,0],[0,1,0],[0,0,1],z1-z0,
      {name,size:s.nominal,lesson:true,grainEdgeIn:[[x0*12,y0*12],[x1*12,y0*12]],
        faceWidthFt:y1-y0,assembly:"loft-window-header"});
    item.stage="wall-frame";return item;
  }
  const y=bottomYFt+thicknessFt,z=outsideZFt+ledgeFt;
  return [board("header-flat",bottomYFt,y,outsideZFt,outsideZFt+depthFt,"Flat board under header"),
    board("header-edge",y,topYFt,z,z+thicknessFt,"First board on edge"),
    board("header-edge",y,topYFt,z+thicknessFt,z+2*thicknessFt,"Second board on edge")];
}

export default {
  id:"window-header",name:"Window header",stage:"wall-frame",lesson:"window-framing.html",
  realLife:"Loft window header: touching boards on edge rest on a flat board, flush inside with a ledge outside. The assembly meets the underside of the top plate.",
  appliesTo(plan) {return Boolean(plan.windowHeaderStudy);},
  members:windowHeaderMembers,
  build(plan,kit) {drawMembers(kit,windowHeaderMembers(plan),"wall-frame");},
};
