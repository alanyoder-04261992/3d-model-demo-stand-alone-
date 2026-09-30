/* WINDOW PLATE: Alan's lofted-wall window plate is a flat nominal 2x4,
   actual 1.5 inches tall and 3.5 inches deep through the wall. Studs
   underneath sit on the bottom plate and retain the wall's 16-inch
   layout, including its learned double studs. Their tops touch the
   window plate's underside; window height determines their cut length.
   Sample plate cuts do not establish its side joints or opening width. */
import {prismMember,drawMembers} from "./floor-frame.js";

export function windowPlateMembers(plan) {
  const s=plan.windowPlateStudy;
  if(!s)return [];
  function board(kind,x0,x1,y0,y1,name,extra={}) {
    const m=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],s.depthFt,
      {name,size:s.nominal,lesson:true,...extra});
    m.stage="wall-frame";return m;
  }
  return [board("window-plate",s.x0Ft,s.x1Ft,s.bottomYFt,s.topYFt,"Window plate"),
    ...s.studs.map(stud=>board("under-window-stud",stud.x0Ft,stud.x1Ft,
      s.studBottomYFt,s.bottomYFt,"Stud under window plate",{...stud,grainAxis:"vertical"}))];
}

export default {
  id:"window-plate",name:"Window plate and studs",stage:"wall-frame",
  realLife:"Flat window plate below a lofted-wall window, with supporting studs on the bottom plate following the wall layout.",
  appliesTo(plan){return Boolean(plan.windowPlateStudy);},
  members:windowPlateMembers,
  build(plan,kit){drawMembers(kit,windowPlateMembers(plan),"wall-frame");}
};
