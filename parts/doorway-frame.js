/* DOORWAY FRAMING: Alan calls the shorter support beneath the header the
   KING STUD, beside a full-height stud. It stands on the bottom plate;
   its cut is the requested door height measured from that plate's top.
   The header extends 1.5 inches past the opening at EACH end, bearing on
   both king studs. Usually use the learned loft header: two touching
   nominal 2x4s on edge on a flat 2x4, with the half-inch ledge outside.
   For taller doors, two flat 2x4s stack to a 3-inch header. For garage
   doors the king studs can reach the top-plate underside directly, with
   no separate header below it. These are Alan's shop terms and fits. */
import {prismMember,drawMembers} from "./floor-frame.js";

export function doorwayMembers(plan) {
  const s=plan.doorwayStudy;
  if(!s)return [];
  const {x0Ft,x1Ft,thicknessFt:t,depthFt:d,outsideZFt:z,studBottomYFt:b,headerBottomYFt:h,studTopYFt:top}=s;
  function board(kind,x0,x1,y0,y1,z0,depth,name,vertical=false) {
    const member=prismMember(kind,"lumber",[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],
      [0,0,z0],[1,0,0],[0,1,0],[0,0,1],depth,
      {name,size:s.nominal,lesson:true,shopTerminology:"Alan",...(vertical?{grainAxis:"vertical"}:{})});
    member.stage="wall-frame";return member;
  }
  const members=[
    board("door-stud",x0Ft-2*t,x0Ft-t,b,top,z,d,"Stud · left",true),
    board("king-stud",x0Ft-t,x0Ft,b,h,z,d,"King stud · left",true),
    board("king-stud",x1Ft,x1Ft+t,b,h,z,d,"King stud · right",true),
    board("door-stud",x1Ft+t,x1Ft+2*t,b,top,z,d,"Stud · right",true)];
  const left=x0Ft-t,right=x1Ft+t;
  if(s.headerMode==="loft") {
    members.push(board("door-header-flat",left,right,h,h+t,z,d,"Header · flat base"),
      board("door-header-edge",left,right,h+t,h+t+d,z+s.ledgeFt,t,"Header · first board on edge"),
      board("door-header-edge",left,right,h+t,h+t+d,z+s.ledgeFt+t,t,"Header · second board on edge"));
  } else if(s.headerMode==="flat") {
    members.push(board("door-header-flat",left,right,h,h+t,z,d,"Header · lower flat board"),
      board("door-header-flat",left,right,h+t,h+2*t,z,d,"Header · upper flat board"));
  }
  for(const stud of s.aboveHeaderStuds || [])
    members.push(board("door-above-stud",stud.x0Ft,stud.x1Ft,s.headerTopYFt,top,z,d,"Stud above doorway header",true));
  return members;
}

export default {
  id:"doorway-frame",name:"Doorway framing",stage:"wall-frame",
  realLife:"A full-height stud beside each king stud. The king studs stand on the bottom plate and support the selected header, or meet the top plate directly.",
  appliesTo(plan){return Boolean(plan.doorwayStudy);},
  members:doorwayMembers,
  build(plan,kit){drawMembers(kit,doorwayMembers(plan),"wall-frame");}
};
