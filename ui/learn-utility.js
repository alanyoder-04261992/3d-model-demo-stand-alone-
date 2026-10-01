/* Utility opening detail and pitch diagram. Invalid inputs retain the last
   drawing and measurements. Roof diagram controls work without WebGL. */
import {loadCatalogue} from "./load.js";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {utilityWallStudyPlan,utilityWindowStudyPlan,utilityWindowMeasurements,utilityWindowDrawing,utilityRoofPitch} from "../model/utility-study.js";
import {woodFinish,installFloorWood} from "./learn-wood.js";
import {createRenderer} from "../engine/renderer.js";
import {distToFit} from "./parts-gallery.js";

const get=id=>document.getElementById(id),status=get("utility-status"),canvas=get("utility-canvas");
const api={ready:false,error:null,measurements:null};window.utilityLesson=api;
async function start() {
  const cat=await loadCatalogue("learning-side-loft"),base=makePlan(defaults(cat),cat),wall=utilityWallStudyPlan(base);
  const raw=cat.construction.utilityStudy;
  function pitch() {
    const p=utilityRoofPitch(base,get("roof-pitch").value),peak=210-280*p.rise/p.run;
    get("roof-outline").setAttribute("points",`40,210 320,${peak} 600,210`);
    get("roof-rise").setAttribute("y2",peak);
    get("pitch-rise-label").textContent=`${p.rise} in rise`;
    get("pitch-description").textContent=`${p.mode==="standard"?"Standard":"Steep"} ${p.rise}/${p.run}: ${p.rise} inches up for every ${p.run} inches horizontally.`;
    get("roof-diagram").setAttribute("aria-label",get("pitch-description").textContent);
  }
  get("roof-pitch").addEventListener("change",pitch);pitch();
  const renderer=createRenderer(canvas,{trueColour:true,scene:"studio",note:" "});
  if(renderer.off)throw new Error("3D is unavailable on this device. The pictures and pitch diagram are still available.");
  installFloorWood(renderer);
  const cam=renderer.cam;cam.autoSpin=false;cam.interacted=true;cam.yaw=2.9;cam.pitch=.2;
  let box,zoom=1;
  const size=()=>({w:canvas.clientWidth,h:canvas.clientHeight});
  function draw() {
    if(!box || !canvas.clientWidth || !canvas.clientHeight)return;
    cam.dist=Math.max(1.1,distToFit(box,cam.yaw,cam.pitch,size())*zoom);cam.fitDist=cam.dist;renderer.draw();
  }
  function rebuild() {
    const plan=utilityWindowStudyPlan(wall,{lengthIn:get("plate-cut").valueAsNumber,openingTopAboveFloorIn:get("window-top").valueAsNumber});
    const m=utilityWindowMeasurements(plan),records=m.members;
    const next=Object.fromEntries(["x","y","z"].flatMap(a=>[
      [a+"0",Math.min(...records.map(r=>r.bounds[a+"0Ft"]))],
      [a+"1",Math.max(...records.map(r=>r.bounds[a+"1Ft"]))]]));
    const build=woodFinish(utilityWindowDrawing(plan,m),{utilityWindow:m});
    renderer.show({build,bounds:{W:next.x1-next.x0,L:next.z1-next.z0,H:next.y1},
      gr:2*Math.hypot(next.x1,next.y1,next.z1),fitDist:distToFit(next,cam.yaw,cam.pitch,size())});
    box=next;cam.target=[(next.x0+next.x1)/2,(next.y0+next.y1)/2,(next.z0+next.z1)/2];
    renderer.setStages(null);draw();api.measurements=m;
    status.textContent=`Top window plate: ${m.study.lengthIn} in cut, flat 1½ × 3½ in. ${m.studMembers.length} studs above, ${Number(m.studLengthIn.toFixed(3))} in long. Wall studs: 89 in.`;
    get("above-cut").textContent=Number(m.studLengthIn.toFixed(3))+" in";
  }
  get("plate-cut").value=raw.examplePlateCutIn;get("window-top").value=raw.exampleWindowTopAboveFloorIn;rebuild();
  get("utility-controls").hidden=false;
  get("utility-form").addEventListener("submit",event=>{event.preventDefault();try{rebuild();}catch(error){status.textContent=error.message+" Previous drawing retained.";}});
  get("utility-front").addEventListener("click",()=>{cam.yaw=Math.PI;cam.pitch=0;zoom=1;draw();});
  get("utility-angle").addEventListener("click",()=>{cam.yaw=2.9;cam.pitch=.2;zoom=1;draw();});
  const scale=factor=>{zoom=Math.max(.3,Math.min(3,zoom*factor));draw();};
  get("utility-in").addEventListener("click",()=>scale(.8));get("utility-out").addEventListener("click",()=>scale(1.25));
  const pointers=new Map();
  canvas.addEventListener("pointerdown",event=>{pointers.set(event.pointerId,[event.clientX,event.clientY]);canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener("pointermove",event=>{
    if(!pointers.has(event.pointerId))return;
    const old=pointers.get(event.pointerId),point=[event.clientX,event.clientY];
    if(pointers.size===2){const other=[...pointers].find(([id])=>id!==event.pointerId)[1];
      const a=Math.hypot(old[0]-other[0],old[1]-other[1]),b=Math.hypot(point[0]-other[0],point[1]-other[1]);if(a>2&&b>2)scale(a/b);
    }else{cam.yaw-=(point[0]-old[0])*.008;cam.pitch=Math.max(-.5,Math.min(1.5,cam.pitch+(point[1]-old[1])*.006));draw();}
    pointers.set(event.pointerId,point);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(type,event=>pointers.delete(event.pointerId));
  canvas.addEventListener("wheel",event=>{event.preventDefault();scale(Math.exp(event.deltaY*.001));},{passive:false});
  canvas.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-"].includes(event.key))return;
    event.preventDefault();if(event.key==="+"||event.key==="=")scale(.8);else if(event.key==="-")scale(1.25);
    else{cam.yaw+=event.key==="ArrowLeft"?-.12:event.key==="ArrowRight"?.12:0;cam.pitch=Math.max(-.5,Math.min(1.5,cam.pitch+(event.key==="ArrowUp"?.1:event.key==="ArrowDown"?-.1:0)));draw();}
  });
  const observer=new ResizeObserver(draw);observer.observe(canvas);addEventListener("pagehide",()=>observer.disconnect(),{once:true});
  api.ready=true;
}
start().catch(error=>{api.error=error.message;api.ready=true;status.textContent=error.message;});
