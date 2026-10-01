/* Alan's utility top window plate: one flat 2x4 with short studs above it.
   This isolated detail does not invent the window's side-support joints. */
import {prismMember,drawMembers} from "./floor-frame.js";

export function utilityWindowMembers(plan) {
  const s=plan.utilityWindowStudy;
  if(!s)return [];
  function board(kind,x0,x1,y0,y1,name,vertical=false) {
    const member=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,s.outsideZFt],[1,0,0],[0,1,0],[0,0,1],s.depthFt,
      {name,size:s.nominal,lesson:true,...(vertical?{grainAxis:"vertical"}:{})});
    member.stage="wall-frame";return member;
  }
  return [board("utility-window-top-plate",s.x0Ft,s.x1Ft,s.bottomYFt,s.topYFt,"Top window plate · flat 2x4"),
    ...s.studs.map(stud=>board("utility-window-above-stud",stud.x0Ft,stud.x1Ft,s.topYFt,s.studTopYFt,"Stud above top window plate",true))];
}

export default {
  id:"utility-window-frame",name:"Utility top window plate",stage:"wall-frame",
  realLife:"A flat top window plate crosses a utility window, with studs filling the space above it to the wall's top plate.",
  appliesTo(plan){return Boolean(plan.utilityWindowStudy);},
  members:utilityWindowMembers,
  build(plan,kit){drawMembers(kit,utilityWindowMembers(plan),"wall-frame");}
};
