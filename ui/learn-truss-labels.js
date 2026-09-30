/* Dimensions share the measured truss endpoints, never a second roof sketch. */
import { formatInches } from "../model/floor-measurements.js";

const NS="http://www.w3.org/2000/svg";
const inches=ft=>formatInches(ft).replaceAll(" in","″");
function node(tag,attrs={},text) {
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
  if(text) el.textContent=text;
  return el;
}
const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);

export function createTrussLabels(viewport,renderer) {
  const svg=node("svg",{role:"img","aria-label":"Truss fit preview and gable stud measurements"});
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  viewport.appendChild(svg);
  function update(t,g,{detail=false,front=false}={}) {
    svg.replaceChildren();
    const w=viewport.clientWidth,h=viewport.clientHeight,project=renderer.projCache?.proj;
    svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
    if(!project || !w || !h) return;
    const cardW=Math.min(182,(w-42)/2),small=cardW<160,boxes=[];
    const a=t.anchors;
    function line(p,q,attrs={}) {
      if(!p || !q || ![...p,...q].every(Number.isFinite)) return;
      svg.appendChild(node("line",{x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:"#173b56","stroke-width":1.25,...attrs}));
    }
    function dimension(start,end,text,offset) {
      const p=project(start),q=project(end);if(!p || !q) return;
      const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<.5) return;
      const nx=-dy/length,ny=dx/length,A=[p[0]+nx*offset,p[1]+ny*offset],B=[q[0]+nx*offset,q[1]+ny*offset];
      line(p,A);line(q,B);line(A,B,{"data-dimension":text});
      for(const endPoint of [A,B]) line([endPoint[0]-nx*4,endPoint[1]-ny*4],[endPoint[0]+nx*4,endPoint[1]+ny*4]);
      const width=Math.min(w-24,text.length*5.8+14),raw=mid(A,B),x=clamp(raw[0],width/2+8,w-width/2-8);
      let y=clamp(raw[1],90,h-88);
      for(const shift of [0,-25,25,-50,50,-75,75,-100,100]) {
        const candidate=clamp(raw[1]+shift,90,h-88);
        if(!boxes.some(b=>Math.abs(x-b.x)<(width+b.width)/2+4 && Math.abs(candidate-b.y)<24)) {y=candidate;break;}
      }
      boxes.push({x,y,width});
      if(Math.hypot(x-raw[0],y-raw[1])>11) line(raw,[x,y+(y<raw[1]?10:-10)],{stroke:"#526879","stroke-width":1});
      svg.appendChild(node("rect",{x:x-width/2,y:y-10,width,height:20,rx:3,fill:"#f8fbfd","fill-opacity":.97}));
      svg.appendChild(node("text",{x,y:y+4,"text-anchor":"middle",fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":11,"font-weight":600},text));
    }
    function card(title,sub,footer,point,x,y) {
      const p=project(point);if(!p || p[0]<0 || p[0]>w || p[1]<0 || p[1]>h) return;
      const start=[x+cardW/2,p[1]>y+28?y+56:y];
      line(start,p,{stroke:"white","stroke-width":4,opacity:.92});line(start,p);
      svg.appendChild(node("circle",{cx:p[0],cy:p[1],r:4,fill:"#173b56",stroke:"white","stroke-width":1.5}));
      svg.appendChild(node("rect",{x,y,width:cardW,height:56,rx:5,fill:"white","fill-opacity":.97,stroke:"#bacbd7"}));
      for(const [text,dy,size,color,weight] of [[title,16,small?11:14,"#173b56",600],[sub,32,small?10:12,"#173b56",400],[footer,47,small?8.5:10,"#526879",400]])
        svg.appendChild(node("text",{x:x+9,y:y+dy,fill:color,"font-family":"IBM Plex Sans, sans-serif","font-size":size,"font-weight":weight},text));
    }
    if(detail) {
      // The extension lines retain the differing endpoint heights. The span
      // itself is horizontal: it is not the sloping distance between points.
      const y=g.upperPlate.bounds.y0Ft-.13,z=a.leftTip[2];
      const tip=[a.leftTip[0],y,z],cut=[a.leftPlateCut[0],y,z];
      line(project(a.leftTip),project(tip),{"stroke-dasharray":"3 3"});
      line(project(a.leftPlateCut),project(cut),{"stroke-dasharray":"3 3"});
      dimension(tip,cut,`${inches(t.projectionFt.start)} · tip to plate cut`,26);
      card("Truss tip","2×4 · 1½″ × 3½″","lowest point at plate top",a.leftLowestTip,14,16);
      card("Upper plate","6¼″ ends at this cut","gable board is above it",a.leftPlateCut,w-cardW-14,h-72);
    } else {
      dimension(a.upperLeftStart,a.upperLeftEnd,`${inches(t.upperLengthFt)} upper`,-18);
      dimension(a.lowerLeftStart,a.lowerLeftEnd,`${inches(t.lowerLengthFt)} lower`,-20);
      const riseX=a.rightTip[0]+.25,z=a.peak[2];
      line(project(a.peak),project([riseX,a.peak[1],z]),{"stroke-dasharray":"3 3"});
      line(project(a.upperPlateTop),project([riseX,a.upperPlateTop[1],z]),{"stroke-dasharray":"3 3"});
      dimension([riseX,a.upperPlateTop[1],z],[riseX,a.peak[1],z],`${inches(t.peakRiseFt)} rise`,20);
      if(front && a.studCenters.length>1) {
        const centers=a.studCenters.slice().sort((p,q)=>p[0]-q[0]);
        const i=Math.max(0,Math.floor(centers.length/2)-1),p=centers[i],q=centers[i+1];
        dimension([p[0],a.gableTop[1]+.3,p[2]],[q[0],a.gableTop[1]+.3,q[2]],"24″ on center",20);
      }
      const stud=t.studMembers[Math.floor(t.studMembers.length/2)];
      card("Truss","2×4 · 1½″ × 3½″","longest edges measured",mid(a.upperLeftStart,a.upperLeftEnd),14,16);
      card("Gable studs","24″ on center","turned outward · fit preview",stud?.center||a.gableTop,w-cardW-14,h-72);
    }
    svg.setAttribute("aria-label",detail
      ? `Truss connection: ${inches(t.projectionFt.start)} measured horizontally from the farthest truss tip to the cut end of the upper plate.`
      : `Truss fit preview: upper pieces ${inches(t.upperLengthFt)}, lower pieces ${inches(t.lowerLengthFt)}, peak ${inches(t.peakRiseFt)} above the top of the upper plate. Gable studs 24 inches on center. Mirrored ends and center-stud layout are preview assumptions.`);
  }
  return {update};
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
