/* Names and dimensions follow the geometry and camera. Skids and notches
   are agreed names; the other floor-piece names remain proposals. */
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
  function dimension(project,a,b,text,offset,color,width,height,dashed=false,minLength=30,maxY=height-12) {
    const p=project(a), q=project(b);
    if(!p || !q || !p.every(Number.isFinite) || !q.every(Number.isFinite)) return;
    const dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);
    if(length<minLength) return;
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
    const y=Math.max(width<500?86:12,Math.min(maxY,midY));
    if(Math.hypot(x-midX,y-midY)>2) line([midX,midY],[x,y],color);
    overlay.appendChild(svgNode("rect",{x:x-boxW/2,y:y-10,width:boxW,height:20,rx:3,fill:"#f8fbfd","fill-opacity":.97}));
    overlay.appendChild(svgNode("text",{x,y:y+4,"text-anchor":"middle",fill:color,"font-family":"IBM Plex Sans, sans-serif","font-size":11,"font-weight":600},text));
  }
  function update(selection, detailNotch=null) {
    overlay.replaceChildren();
    const width=viewport.clientWidth,height=viewport.clientHeight;
    overlay.setAttribute("viewBox",`0 0 ${width} ${height}`);
    const project=renderer.projCache && renderer.projCache.proj;
    if(!project || !width || !height || !selection.length) return;
    const selected=new Set(selection), small=width<500;
    const cardWidth=small?Math.min(157,(width-42)/2):174;
    const nearEnd=Math.cos(renderer.cam.yaw)>=0?1:-1,side=Math.sin(renderer.cam.yaw)>=0?1:-1;
    const nearZ=nearEnd>0?supports.z1Ft:supports.z0Ft;
    const labels=[], detail=!!detailNotch, actual=!!measures.study;
    const section=`${formatInches(supports.widthFt)} × ${formatInches(supports.depthFt)} ${actual?"actual":"drawn"}`;
    const nearX=side>0?Math.max(...supports.xsFt):Math.min(...supports.xsFt);
    const notch=detailNotch || supports.notches.filter(n=>n.xFt===nearX && n.sources.includes("alternate") && !n.sources.includes("standard"))
      .sort((a,b)=>Math.abs(a.centerZFt)-Math.abs(b.centerZFt))[0];
    const bottomCut=detailNotch?.end ? supports.bottomCuts?.find(c=>c.xFt===notch.xFt && c.end===notch.end) : null;
    if(!detail) {
      // The dashed footprint is nominal; member measurements use the mesh.
      const corners=[[-plan.W/2,0,-plan.L/2],[plan.W/2,0,-plan.L/2],[plan.W/2,0,plan.L/2],[-plan.W/2,0,plan.L/2]];
      for(let i=0;i<4;i++) line(project(corners[i]),project(corners[(i+1)%4]),"#8198a8","5 5");
      dimension(project,[-plan.W/2,0,-nearEnd*plan.L/2],[plan.W/2,0,-nearEnd*plan.L/2],`${formatFeetInches(plan.W)} wide · nominal`,23,"#526b7d",width,height,true);
      dimension(project,[-side*plan.W/2,0,-plan.L/2],[-side*plan.W/2,0,plan.L/2],`${formatFeetInches(plan.L)} long · nominal`,23,"#526b7d",width,height,true);
    }
    // An opaque deck can hide the timber. Do not attach a skid name to the
    // deck surface that happens to cover its projected anchor.
    if(selected.has("supports") && !selected.has("deck")) {
      // Keep name anchors on the remaining timber above the sloped underside.
      const detailBottom=bottomCut ? bottomCut.bottomYFt+bottomCut.riseFt*Math.max(0,1-Math.abs(notch.centerZFt-bottomCut.tipZFt)/bottomCut.reachFt) : 0;
      const points=detail ? [[notch.xFt+side*supports.widthFt/2,(detailBottom+notch.seatYFt)/2,notch.centerZFt]]
        : supports.xsFt.map(x=>{
          const end=nearEnd>0?"positive":"negative";
          const cut=supports.bottomCuts?.find(c=>c.xFt===x && c.end===end);
          const top=supports.notches.find(n=>n.xFt===x && n.end===end)?.seatYFt ?? supports.depthFt;
          return [x,((cut?.tipYFt ?? 0)+top)/2,nearZ];
        });
      labels.push({text:"Skids",detail:section,footer:plan.floorStudy?.skids.treated?"treated wood · confirmed":"confirmed name",x:14,
        y:selection.length>1?height-72:16,w:cardWidth,points});
      if(notch && !selected.has("deck") && (detail || !selected.has("frame"))) {
        const end=notch.end || (notch.sources.includes("end-negative")?"negative":notch.sources.includes("end-positive")?"positive":null);
        labels.push({text:"Notches · confirmed",detail:end?`${formatInches(notch.z1Ft-notch.z0Ft)} long × ${formatInches(notch.depthFt)} deep`:`${formatInches(notch.depthFt)} down from top`,
          footer:end?"length / depth confirmed":"width / grid start pending",x:width-cardWidth-14,y:16,w:cardWidth,
          points:[[notch.xFt,notch.seatYFt,notch.centerZFt]]});
        if(detail) {
          // An open end has no raised tip. Measure depth at the shoulder
          // where the full-height timber resumes, and length along the seat.
          const x=notch.xFt+side*supports.widthFt/2;
          const z=end==="negative"?notch.z1Ft:end==="positive"?notch.z0Ft:nearEnd>0?notch.z0Ft:notch.z1Ft;
          dimension(project,[x,notch.seatYFt,z],[x,notch.topYFt,z],`${formatInches(notch.depthFt)} deep`,28,"#135872",width,height,false,1);
          if(end) dimension(project,[x,notch.seatYFt,notch.z0Ft],[x,notch.seatYFt,notch.z1Ft],`${formatInches(notch.z1Ft-notch.z0Ft)} notch`,-32,"#135872",width,height,false,1);
        }
      }
      if(bottomCut) {
        const x=bottomCut.xFt+side*supports.widthFt/2;
        labels.push({text:`${bottomCut.angleDeg}° bottom cut`,detail:`${formatInches(bottomCut.reachFt)} back · ${formatInches(bottomCut.riseFt)} up`,
          footer:"rise calculated",x:width-cardWidth-14,y:height-72,w:cardWidth,
          points:[[x,(bottomCut.bottomYFt+bottomCut.tipYFt)/2,(bottomCut.startZFt+bottomCut.tipZFt)/2]]});
        // The reach is parallel to the skid, not the length of the sloping face.
        // Extend the raised tip down to the bottom datum for this dimension.
        line(project([x,bottomCut.tipYFt,bottomCut.tipZFt]),project([x,bottomCut.bottomYFt,bottomCut.tipZFt]),"#7a5b30","3 3");
        dimension(project,[x,bottomCut.bottomYFt,bottomCut.startZFt],[x,bottomCut.bottomYFt,bottomCut.tipZFt],`${formatInches(bottomCut.reachFt)} back`,24,"#7a5b30",width,height,false,1,height-90);
      }
    }
    if(selected.has("deck") && sheet) {
      labels.push({text:"Floor decking",detail:`${formatFeetInches(sheet.acrossFt)} × ${formatFeetInches(sheet.alongFt)}`,x:width-(small?190:210)-14,y:16,w:small?190:210,points:[sheetPoint(sheet.member)]});
      const p=sheet.member, xs=p.poly.map(v=>v[0]),zs=p.poly.map(v=>v[1]);
      const y=sheetPoint(p)[1],x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs);
      if(!detail) {
        dimension(project,[x1,y,z0],[x1,y,z1],formatFeetInches(sheet.alongFt),17,"#135872",width,height);
        dimension(project,[x0,y,z1],[x1,y,z1],formatFeetInches(sheet.acrossFt),17,"#135872",width,height);
      }
    } else if(selected.has("frame")) {
      const crossMembers=measures.frame.members.filter(m=>["joist","end-joist","wall-joist"].includes(m.member.kind));
      const visibleJoist=detail ? crossMembers.sort((a,b)=>Math.abs(a.center[2]-notch.centerZFt)-Math.abs(b.center[2]-notch.centerZFt))[0] : joist;
      if(visibleJoist) labels.push({text:visibleJoist.member.kind==="end-joist"?"End joist":"Floor joist",detail:detail?`${formatInches(visibleJoist.widthFt)} × ${formatInches(visibleJoist.depthFt)} actual`:`${formatFeetInches(visibleJoist.lengthFt)} long`,
        x:14,y:16,w:small?cardWidth:170,points:[detail ? [notch.xFt,visibleJoist.bounds.y1Ft,visibleJoist.center[2]] : beamPoint(visibleJoist.member,true)]});
      const rim=members.find(m=>m.kind==="rim" && m.meta.side===(side>0?"R":"L"));
      if(rim && !detail) {
        const p=beamPoint(rim,false); p[0]+=side*rim.w/2;
        labels.push({text:"Rim joist",detail:`${formatFeetInches(measures.frame.rim.lengthFt)} long`,x:width-(small?158:177)-14,y:16,w:small?158:177,points:[p]});
        dimension(project,rim.p0,rim.p1,formatFeetInches(measures.frame.rim.lengthFt),20,"#135872",width,height);
      }
      if(joist && !detail) dimension(project,joist.p0,joist.p1,formatFeetInches(joist.lengthFt),15,"#135872",width,height);
    } else if(selected.has("supports") && !detail) {
      const x=nearX;
      const endHeight=end=>supports.notches.find(n=>n.xFt===x && n.end===end)?.seatYFt ?? supports.depthFt;
      dimension(project,[x,endHeight("negative"),supports.z0Ft],[x,endHeight("positive"),supports.z1Ft],`${formatFeetInches(supports.lengthFt)} support`,23,"#135872",width,height);
      const run=supports.runs.find(r=>r.xFt===x), inset=supports.insetCentersFt.find(r=>r.xFt===x);
      if(run) {
        // Inside means the face toward the building's centre. On the right
        // skid that is x0; on the left it is x1, never the centreline.
        const innerX=x>=0?run.x0Ft:run.x1Ft, wallX=(x>=0?1:-1)*plan.W/2;
        const distance=inset?.nearestInsideFaceFt ?? Math.abs(wallX-innerX);
        const end=nearEnd>0?"positive":"negative", cut=run.bottomCuts?.find(c=>c.end===end);
        const faceY=cut ? (cut.tipYFt+endHeight(end))/2 : 0;
        dimension(project,[wallX,faceY,nearZ],[innerX,faceY,nearZ],`${formatInches(distance)} wall to inside face`,27,"#135872",width,height);
      }
    }
    overlay.setAttribute("aria-label","Floor names and measurements: "+labels.map(l=>`${l.text}, ${l.detail}, ${l.footer || "proposed name"}`).join("; "));
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
      const narrow=label.w<145;
      overlay.appendChild(svgNode("text",{x:x+10,y:y+16,fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":narrow?11:small?13:14,"font-weight":600},label.text));
      overlay.appendChild(svgNode("text",{x:x+10,y:y+32,fill:"#173b56","font-family":"IBM Plex Sans, sans-serif","font-size":narrow?10:12},label.detail));
      overlay.appendChild(svgNode("text",{x:x+10,y:y+47,fill:"#526879","font-family":"IBM Plex Sans, sans-serif","font-size":narrow?8.5:10},label.footer || "proposed name · model size"));
    }
  }
  return {update};
}
