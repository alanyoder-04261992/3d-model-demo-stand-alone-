/* Names and dimensions follow the existing geometry and the camera.
   These are model measurements and proposed names for discussion. */
import { floorFrameMembers } from "../parts/floor-frame.js";
import { floorMeasurements, formatFeetInches as feetText, formatInches as inchesText } from "../model/floor-measurements.js";

const formatFeetInches=feet=>feetText(feet).replaceAll(" ft","′").replaceAll(" in","″");
const formatInches=feet=>inchesText(feet).replaceAll(" in","″");

const NS = "http://www.w3.org/2000/svg";
function svgNode(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, String(value));
  if (text) node.textContent = text;
  return node;
}
function beamPoint(member, top) {
  return member.p0.map((v, i) => (v + member.p1[i]) / 2 + (i === 1 && top ? member.d / 2 : 0));
}
function sheetPoint(member) {
  const uv = member.poly.reduce((s,p) => [s[0]+p[0]/member.poly.length,s[1]+p[1]/member.poly.length],[0,0]);
  return member.origin.map((v,i) => v + member.e1[i]*uv[0] + member.e2[i]*uv[1] + member.e3[i]*member.t);
}

export function createFloorLabels(viewport, renderer, plan) {
  const overlay = svgNode("svg", {role:"img", "aria-label":"Names and measurements pointing to floor pieces"});
  overlay.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden";
  viewport.appendChild(overlay);
  const measures=floorMeasurements(plan), supports=measures.supports, members=floorFrameMembers(plan);
  const joist=measures.frame.joist, sheet=measures.deck.representative;
  function line(a,b,color,dash) {
    if(!a || !b || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return;
    overlay.appendChild(svgNode("line",{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,"stroke-width":1.25,...(dash?{"stroke-dasharray":dash}:{})}));
  }
  function dimension(project,a,b,text,offset,color,width,height,dashed=false) {
    const p=project(a), q=project(b);
    if(!p || !q || !p.every(Number.isFinite) || !q.every(Number.isFinite)) return;
    const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
    if(length<30) return;
    let nx=-dy/length,ny=dx/length;
    if(nx*((p[0]+q[0])/2-width/2)+ny*((p[1]+q[1])/2-height/2)<0) {nx=-nx;ny=-ny;}
    const A=[p[0]+nx*offset,p[1]+ny*offset],B=[q[0]+nx*offset,q[1]+ny*offset];
    line(p,[A[0]+nx*5,A[1]+ny*5],color); line(q,[B[0]+nx*5,B[1]+ny*5],color);
    line(A,B,color,dashed?"4 3":null);
    for(const end of [A,B]) line([end[0]-nx*4,end[1]-ny*4],[end[0]+nx*4,end[1]+ny*4],color);
    const boxW=text.length*6.1+14, midX=(A[0]+B[0])/2, midY=(A[1]+B[1])/2;
    const x=Math.max(boxW/2+5,Math.min(width-boxW/2-5,midX));
    // On phones the top name cards share the drawing's width. Keep dimension
    // text below their 72px band and inside the canvas at every camera angle.
    const y=Math.max(width<500?86:12,Math.min(height-12,midY));
    if(Math.hypot(x-midX,y-midY)>2) line([midX,midY],[x,y],color);
    overlay.appendChild(svgNode("rect",{x:x-boxW/2,y:y-10,width:boxW,height:20,rx:3,fill:"#f8fbfd","fill-opacity":.97}));
    overlay.appendChild(svgNode("text",{x,y:y+4,"text-anchor":"middle",fill:color,"font-family":"IBM Plex Sans, sans-serif","font-size":11,"font-weight":600},text));
  }
  function update(selection) {
    overlay.replaceChildren();
    const width=viewport.clientWidth,height=viewport.clientHeight;
    overlay.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const project=renderer.projCache && renderer.projCache.proj;
    if(!project || !width || !height || !selection.length) return;
    const selected=new Set(selection), small=width<500;
    const nearEnd=Math.cos(renderer.cam.yaw)>=0?1:-1,side=Math.sin(renderer.cam.yaw)>=0?1:-1;
    const nearZ=nearEnd>0?supports.z1Ft:supports.z0Ft;
    const labels=[];
    // Nominal outline differs from the inset frame and extended supports.
    const corners=[[-plan.W/2,0,-plan.L/2],[plan.W/2,0,-plan.L/2],[plan.W/2,0,plan.L/2],[-plan.W/2,0,plan.L/2]];
    for(let i=0;i<4;i++) line(project(corners[i]),project(corners[(i+1)%4]),"#8198a8","5 5");
    dimension(project,[-plan.W/2,0,-nearEnd*plan.L/2],[plan.W/2,0,-nearEnd*plan.L/2],`${formatFeetInches(plan.W)} wide · nominal`,23,"#526b7d",width,height,true);
    dimension(project,[-side*plan.W/2,0,-plan.L/2],[-side*plan.W/2,0,plan.L/2],`${formatFeetInches(plan.L)} long · nominal`,23,"#526b7d",width,height,true);
    if(selected.has("supports")) labels.push({
      text:"Skids / runners",detail:`${formatInches(supports.widthFt)} × ${formatInches(supports.depthFt)} drawn`,
      x:14,y:selection.length>1?height-72:16,w:small?157:174,
      points:supports.xsFt.map(x=>[x,supports.depthFt/2,nearZ])
    });
    if(selected.has("deck") && sheet) {
      labels.push({text:"Floor decking",detail:`${formatFeetInches(sheet.acrossFt)} × ${formatFeetInches(sheet.alongFt)}`,x:width-(small?190:210)-14,y:16,w:small?190:210,points:[sheetPoint(sheet.member)]});
      const p=sheet.member, xs=p.poly.map(v=>v[0]),zs=p.poly.map(v=>v[1]);
      const y=sheetPoint(p)[1],x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
      dimension(project,[x1,y,z0],[x1,y,z1],formatFeetInches(sheet.alongFt),17,"#135872",width,height);
      dimension(project,[x0,y,z1],[x1,y,z1],formatFeetInches(sheet.acrossFt),17,"#135872",width,height);
    } else if(selected.has("frame")) {
      if(joist) labels.push({text:"Floor joist",detail:`${formatFeetInches(joist.lengthFt)} long`,x:14,y:16,w:small?150:170,points:[beamPoint(joist.member,true)]});
      const rim=members.find(m=>m.kind==="rim" && m.meta.side===(side>0?"R":"L"));
      if(rim) {
        const p=beamPoint(rim,false); p[0]+=side*rim.w/2;
        labels.push({text:"Rim joist",detail:`${formatFeetInches(measures.frame.rim.lengthFt)} long`,x:width-(small?158:177)-14,y:16,w:small?158:177,points:[p]});
        dimension(project,rim.p0,rim.p1,formatFeetInches(measures.frame.rim.lengthFt),20,"#135872",width,height);
      }
      if(joist) dimension(project,joist.p0,joist.p1,formatFeetInches(joist.lengthFt),15,"#135872",width,height);
    } else if(selected.has("supports")) {
      const x=side>0?Math.max(...supports.xsFt):Math.min(...supports.xsFt);
      dimension(project,[x,supports.depthFt,supports.z0Ft],[x,supports.depthFt,supports.z1Ft],`${formatFeetInches(supports.lengthFt)} support`,23,"#135872",width,height);
      if(supports.xsFt.length===2) dimension(project,[supports.xsFt[0],supports.depthFt,nearZ],[supports.xsFt[1],supports.depthFt,nearZ],`${formatInches(supports.centerSpacingsFt[0])} center to center`,27,"#135872",width,height);
    }
    overlay.setAttribute("aria-label","Proposed names and model measurements: "+labels.map(l=>`${l.text}, ${l.detail}`).join("; "));
    for(const label of labels) {
      const points=label.points.map(project).filter(p=>p&&p[0]>=0&&p[0]<=width&&p[1]>=0&&p[1]<=height);
      if(!points.length) continue;
      const x=Math.max(8,label.x),y=Math.max(8,label.y),center=x+label.w/2;
      for(const p of points) {
        const path=`M ${center} ${p[1]>y+28?y+56:y} L ${p[0]} ${p[1]}`;
        overlay.appendChild(svgNode("path",{d:path,fill:"none",stroke:"#fff","stroke-width":4,opacity:.9}));
        overlay.appendChild(svgNode("path",{d:path,fill:"none",stroke:"#173b56","stroke-width":1.5}));
        overlay.appendChild(svgNode("circle",{cx:p[0],cy:p[1],r:4,fill:"#173b56",stroke:"white","stroke-width":1.5}));
      }
      overlay.appendChild(svgNode("rect",{x,y,width:label.w,height:56,rx:5,fill:"white","fill-opacity":.97,stroke:"#bacbd7"}));
      overlay.appendChild(svgNode("text",{x:x+10,y:y+16,fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":small?13:14,"font-weight":600},label.text));
      overlay.appendChild(svgNode("text",{x:x+10,y:y+32,fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":12},label.detail));
      overlay.appendChild(svgNode("text",{x:x+10,y:y+47,fill:"#526879","font-family":"IBM Plex Sans, sans-serif","font-size":10},"proposed name · model size"));
    }
  }
  return {update};
}
