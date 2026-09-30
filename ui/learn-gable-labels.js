/* The new end-wall board and its fit, with anchors on measured faces. */
import { formatInches, formatFeetInches } from "../model/floor-measurements.js";

const NS="http://www.w3.org/2000/svg";
const inches=ft=>formatInches(ft).replaceAll(" in","″");
const feet=ft=>formatFeetInches(ft).replaceAll(" ft","′").replaceAll(" in","″");
function node(tag,attrs={},text) {
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
  if(text) el.textContent=text;
  return el;
}
export function createGableLabels(viewport,renderer) {
  const svg=node("svg",{role:"img","aria-label":"Gable board and upper plate measurements"});
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  viewport.appendChild(svg);
  function update(m,{detail=false}={}) {
    svg.replaceChildren();
    const width=viewport.clientWidth,height=viewport.clientHeight,project=renderer.projCache?.proj;
    svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
    if(!project || !width || !height) return;
    const small=width<500,cardWidth=small?Math.min(157,(width-42)/2):182;
    const board=m.board.bounds,plate=m.upperPlate.bounds;
    const dimensionBoxes=[];
    const inside=Math.cos(renderer.cam.yaw)>=0;
    const faceZ=inside?board.z1Ft:board.z0Ft,plateFaceZ=inside?plate.z1Ft:plate.z0Ft;
    function line(a,b,attrs={}) {
      if(!a || !b || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return;
      svg.appendChild(node("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"#173b56","stroke-width":1.25,...attrs}));
    }
    function dimension(a,b,text,offset=18) {
      const p=project(a),q=project(b);if(!p || !q) return;
      const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);if(length<1) return;
      const nx=-dy/length,ny=dx/length,A=[p[0]+nx*offset,p[1]+ny*offset],B=[q[0]+nx*offset,q[1]+ny*offset];
      line(p,A);line(q,B);line(A,B,{"data-dimension":text});
      for(const end of [A,B]) line([end[0]-nx*4,end[1]-ny*4],[end[0]+nx*4,end[1]+ny*4]);
      const boxW=Math.min(width-20,text.length*6+14),x=Math.max(boxW/2+6,Math.min(width-boxW/2-6,(A[0]+B[0])/2));
      const rawY=(A[1]+B[1])/2,baseY=Math.max(88,Math.min(height-84,rawY));
      let y=baseY;
      for(const shift of [0,-26,26,-52,52,-78,78]) {
        const candidate=Math.max(88,Math.min(height-84,baseY+shift));
        if(!dimensionBoxes.some(box=>Math.abs(x-box.x)<(boxW+box.width)/2+5 && Math.abs(candidate-box.y)<25)) {y=candidate;break;}
      }
      dimensionBoxes.push({x,y,width:boxW});
      if(Math.abs(y-rawY)>11) line([(A[0]+B[0])/2,rawY],[x,y+(y<rawY?10:-10)],{stroke:"#526879","stroke-width":1});
      svg.appendChild(node("rect",{x:x-boxW/2,y:y-10,width:boxW,height:20,rx:3,fill:"#f8fbfd","fill-opacity":.97}));
      svg.appendChild(node("text",{x,y:y+4,"text-anchor":"middle",fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":11,"font-weight":600},text));
    }
    const cards=[];
    if(detail) {
      const projectionY=board.y0Ft;
      dimension([board.x0Ft,projectionY,faceZ],[plate.x0Ft,projectionY,faceZ],`${inches(m.endProjectionFt.start)} past cut`,-29);
      // Measure the configured ledge between the matching plate and board faces.
      const ledgeX=plate.x0Ft+.28;
      const ledgeStart=m.ledgeStart.slice(),ledgeEnd=m.ledgeEnd.slice();
      ledgeStart[0]=ledgeEnd[0]=ledgeX;
      dimension(ledgeStart,ledgeEnd,`${inches(m.ledgeFt)} ${m.ledgeSide} ledge`,29);
      const sectionX=board.x0Ft+.07;
      dimension([sectionX,board.y0Ft,faceZ],[sectionX,board.y1Ft,faceZ],`${inches(m.heightFt)} high`,-26);
      cards.push({title:m.name,detail:`${inches(m.thicknessFt)} × ${inches(m.heightFt)} actual`,footer:"2×6 on the upper plate",x:width-cardWidth-14,y:16,
        point:[plate.x0Ft+.46,(board.y0Ft+board.y1Ft)/2,faceZ]},
      {title:"Upper plate",detail:`${feet(m.upperPlate.lengthFt)} long`,footer:"same fit at both ends",x:14,y:height-72,
        point:[plate.x0Ft+.12,(plate.y0Ft+plate.y1Ft)/2,plateFaceZ]});
    } else {
      dimension([board.x0Ft,board.y1Ft,faceZ],[board.x1Ft,board.y1Ft,faceZ],`${inches(m.lengthFt)} · ${feet(m.lengthFt)}`,-23);
      cards.push({title:m.name,detail:`${inches(m.thicknessFt)} × ${inches(m.heightFt)} actual`,footer:"2×6 · length calculated",x:14,y:16,
        point:[board.x0Ft+(board.x1Ft-board.x0Ft)*.3,(board.y0Ft+board.y1Ft)/2,faceZ]},
      {title:"Upper plate",detail:`${inches(m.upperPlate.lengthFt)} long`,footer:"2½″ past each cut end",x:width-cardWidth-14,y:height-72,
        point:[plate.x0Ft+(plate.x1Ft-plate.x0Ft)*.7,(plate.y0Ft+plate.y1Ft)/2,plateFaceZ]});
    }
    svg.setAttribute("aria-label",`${m.name}: 2×6 on edge, ${inches(m.lengthFt)} long, ${inches(m.thicknessFt)} thick and ${inches(m.heightFt)} high. Outside ledge ${inches(m.outerLedgeFt)}; inside ledge ${inches(m.innerLedgeFt)}. Projection past each upper-plate end ${inches(m.endProjectionFt.start)} and ${inches(m.endProjectionFt.end)}.`);
    for(const c of cards) {
      const p=project(c.point);if(!p || p[0]<0 || p[0]>width || p[1]<0 || p[1]>height) continue;
      const a=[c.x+cardWidth/2,p[1]>c.y+28?c.y+56:c.y];
      line(a,p,{stroke:"white","stroke-width":4,opacity:.9});line(a,p);
      svg.appendChild(node("circle",{cx:p[0],cy:p[1],r:4,fill:"#173b56",stroke:"white","stroke-width":1.5}));
      svg.appendChild(node("rect",{x:c.x,y:c.y,width:cardWidth,height:56,rx:5,fill:"white","fill-opacity":.97,stroke:"#bacbd7"}));
      const narrow=cardWidth<145;
      for(const [text,y,size,color,weight] of [[c.title,c.y+16,narrow?11:small?13:14,"#173b56",600],[c.detail,c.y+32,narrow?10:12,"#173b56",400],[c.footer,c.y+47,narrow?8.5:10,"#526879",400]])
        svg.appendChild(node("text",{x:c.x+10,y,fill:color,"font-family":"IBM Plex Sans, sans-serif","font-size":size,"font-weight":weight},text));
    }
  }
  return {update};
}
