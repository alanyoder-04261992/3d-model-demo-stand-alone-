/* Wall terms point to member faces. The close-up separates the two top boards. */
import { formatFeetInches, formatInches } from "../model/floor-measurements.js";

const NS="http://www.w3.org/2000/svg";
const inches=ft=>formatInches(ft).replaceAll(" in","″");
const feet=ft=>formatFeetInches(ft).replaceAll(" ft","′").replaceAll(" in","″");
function node(tag,attrs={},text) {
  const el=document.createElementNS(NS,tag);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
  if(text) el.textContent=text;
  return el;
}
export function wallFocusPair(m) {
  return m.doubles.slice().sort((a,b)=>Math.abs(a.markFt-m.lengthFt/2)-Math.abs(b.markFt-m.lengthFt/2))[0];
}
export function createWallLabels(viewport,renderer) {
  const svg=node("svg",{role:"img","aria-label":"Wall names and measurements"});
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  viewport.appendChild(svg);
  function update(m,{detail=false}={}) {
    svg.replaceChildren();
    const width=viewport.clientWidth,height=viewport.clientHeight,project=renderer.projCache?.proj;
    svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
    if(!project || !width || !height) return;
    const small=width<500,cardWidth=small?Math.min(157,(width-42)/2):174;
    const wallName=m.wall==="side"?"Side wall":"End wall";
    const along=m.wall==="side"?2:0;
    const front=m.wall==="side"?Math.sin(renderer.cam.yaw)>=0:Math.cos(renderer.cam.yaw)<=0;
    function face(record,y=record.center[1],u=null) {
      const p=record.center.slice(),b=record.bounds;
      p[1]=y;
      if(u!==null) p[along]=(m.wall==="side"?m.bounds.z0Ft:m.bounds.x0Ft)+u;
      if(m.wall==="side") p[0]=front?b.x1Ft:b.x0Ft;
      else p[2]=front?b.z0Ft:b.z1Ft;
      return p;
    }
    function line(a,b,attrs={}) {
      if(!a || !b || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return;
      svg.appendChild(node("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:"#173b56","stroke-width":1.25,...attrs}));
    }
    function dimension(a,b,text,offset=18) {
      const p=project(a),q=project(b);if(!p || !q) return;
      const dx=q[0]-p[0],dy=q[1]-p[1],len=Math.hypot(dx,dy);if(len<1) return;
      const nx=-dy/len,ny=dx/len,A=[p[0]+nx*offset,p[1]+ny*offset],B=[q[0]+nx*offset,q[1]+ny*offset];
      line(p,A);line(q,B);line(A,B);
      for(const end of [A,B]) line([end[0]-nx*4,end[1]-ny*4],[end[0]+nx*4,end[1]+ny*4]);
      const boxW=text.length*6+14,x=Math.max(boxW/2+6,Math.min(width-boxW/2-6,(A[0]+B[0])/2));
      const y=Math.max(87,Math.min(height-88,(A[1]+B[1])/2));
      svg.appendChild(node("rect",{x:x-boxW/2,y:y-10,width:boxW,height:20,rx:3,fill:"#f8fbfd","fill-opacity":.97}));
      svg.appendChild(node("text",{x,y:y+4,"text-anchor":"middle",fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":11,"font-weight":600},text));
    }
    const pair=wallFocusPair(m),mark=pair?.markFt ?? m.lengthFt/2;
    const regular=m.gridStuds.slice().sort((a,b)=>Math.abs(a.center[along]-(m.wall==="side"?m.bounds.z0Ft:m.bounds.x0Ft)-m.lengthFt*.3)-Math.abs(b.center[along]-(m.wall==="side"?m.bounds.z0Ft:m.bounds.x0Ft)-m.lengthFt*.3))[0] || m.studs[0];
    const cards=[];
    if(detail) {
      const screenDirection=Math.sign(m.wall==="side"?-Math.sin(renderer.cam.yaw):Math.cos(renderer.cam.yaw)) || 1;
      cards.push({title:"Top plate",detail:"lower top board",footer:"2×4 · confirmed",x:14,y:16,
        points:[face(m.plates.top,m.plates.top.center[1],Math.max(.25,Math.min(m.lengthFt-.25,mark-screenDirection*.65)))]},
      {title:"Upper plate",detail:"upper top board",footer:"2×4 · confirmed",x:width-cardWidth-14,y:16,
        points:[face(m.plates.upper,m.plates.upper.center[1],Math.max(.25,Math.min(m.lengthFt-.25,mark+screenDirection*.65)))]});
      if(pair) cards.push({title:"Two studs",detail:"touching at the mark",footer:"every 4 ft",x:14,y:height-72,
        points:pair.members.map(s=>face(s,s.bounds.y1Ft-.55))});
      const u=Math.min(m.lengthFt-.2,mark+.9),top=m.plates.top;
      dimension(face(top,top.bounds.y0Ft,u),face(top,top.bounds.y1Ft,u),`${inches(top.bounds.y1Ft-top.bounds.y0Ft)} thick`,20);
    } else {
      cards.push({title:"Stud",detail:`${inches(m.studLengthFt)} long`,footer:"2×4 · confirmed",x:14,y:16,points:[face(regular)]},
        {title:"Bottom plate",detail:"rests on flooring",footer:"2×4 · confirmed",x:14,y:height-72,
          points:[face(m.plates.bottom,m.plates.bottom.center[1],m.lengthFt*.35)]});
      if(pair) cards.push({title:"Doubled studs",detail:`every ${feet(m.doubleEveryFt)}`,footer:"mark between the pair",x:width-cardWidth-14,y:16,
        points:pair.members.map(s=>face(s,s.bounds.y0Ft+(s.bounds.y1Ft-s.bounds.y0Ft)*.6))});
      dimension(face(m.plates.bottom,m.plates.bottom.center[1],0),face(m.plates.bottom,m.plates.bottom.center[1],m.lengthFt),`${wallName} · ${feet(m.lengthFt)}`,20);
    }
    svg.setAttribute("aria-label",`${wallName}. `+cards.map(c=>`${c.title}: ${c.detail}. ${c.footer}`).join(" "));
    for(const c of cards) {
      const points=c.points.map(project).filter(p=>p&&p[0]>=0&&p[0]<=width&&p[1]>=0&&p[1]<=height);
      if(!points.length) continue;
      for(const p of points) {
        const a=[c.x+cardWidth/2,p[1]>c.y+28?c.y+56:c.y];
        line(a,p,{stroke:"white","stroke-width":4,opacity:.9});line(a,p);
        svg.appendChild(node("circle",{cx:p[0],cy:p[1],r:4,fill:"#173b56",stroke:"white","stroke-width":1.5}));
      }
      svg.appendChild(node("rect",{x:c.x,y:c.y,width:cardWidth,height:56,rx:5,fill:"white","fill-opacity":.97,stroke:"#bacbd7"}));
      const narrow=cardWidth<145;
      for(const [text,y,size,color,weight] of [[c.title,c.y+16,narrow?11:small?13:14,"#173b56",600],[c.detail,c.y+32,narrow?10:12,"#173b56",400],[c.footer,c.y+47,narrow?8.5:10,"#526879",400]])
        svg.appendChild(node("text",{x:c.x+10,y,fill:color,"font-family":"IBM Plex Sans, sans-serif","font-size":size,"font-weight":weight},text));
    }
  }
  return {update};
}
