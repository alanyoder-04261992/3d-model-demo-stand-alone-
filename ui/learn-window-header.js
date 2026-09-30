/* Isolated, manually rotated lofted-wall window details. Never create a fictitious
   complete window opening or changes the ordinary designer's wall frame. */
import {loadCatalogue} from "./load.js";
import {defaults} from "../model/design.js";
import {makePlan} from "../model/plan.js";
import {floorStudyPlan} from "../model/floor-study.js";
import {wallStudyPlan} from "../model/wall-study.js";
import {windowHeaderStudyPlan,windowHeaderMeasurements} from "../model/window-header-study.js";
import {windowPlateStudyPlan,windowPlateMeasurements,windowFramingDrawing,windowFramingRecords} from "../model/window-plate-study.js";
import {woodFinish,installFloorWood} from "./learn-wood.js";
import {createRenderer} from "../engine/renderer.js";
import {distToFit} from "./parts-gallery.js";

const get=id=>document.getElementById(id),canvas=get("header-canvas"),status=get("header-status");
async function start() {
  const cat=await loadCatalogue("learning-side-loft");
  const wall=wallStudyPlan(floorStudyPlan(makePlan(defaults(cat),cat)),{wall:"end"});
  const renderer=createRenderer(canvas,{trueColour:true,scene:"studio",note:" "});
  if(renderer.off)throw new Error("3D is unavailable on this device. Use the pictures above.");
  installFloorWood(renderer);
  let box,zoom=1,plan,view="plate";
  const cam=renderer.cam;cam.autoSpin=false;cam.interacted=true;cam.yaw=3.02;cam.pitch=.20;
  const size=()=>({w:canvas.clientWidth,h:canvas.clientHeight});
  function draw() {
    if(!box || !canvas.clientWidth || !canvas.clientHeight)return;
    const toward=[Math.cos(cam.pitch)*Math.sin(cam.yaw),Math.sin(cam.pitch),Math.cos(cam.pitch)*Math.cos(cam.yaw)];
    const closestDepth=["x","y","z"].reduce((sum,a,i)=>sum+(box[a+"1"]-box[a+"0"])*Math.abs(toward[i])/2,0);
    cam.dist=Math.max(closestDepth+1.05,distToFit(box,cam.yaw,cam.pitch,size())*zoom);
    cam.fitDist=cam.dist;renderer.draw();
  }
  function rebuild(length,clearHeight) {
    const candidate=windowPlateStudyPlan(windowHeaderStudyPlan(wall,{lengthIn:length}),
      {lengthIn:length,clearHeightIn:clearHeight});
    const m={header:windowHeaderMeasurements(candidate),windowPlate:windowPlateMeasurements(candidate)};
    const options={view,plates:get("plates").checked};
    const records=windowFramingRecords(m,options).flatMap(group=>group.records);
    const next=Object.fromEntries(["x","y","z"].flatMap(a=>[
      [a+"0",Math.min(...records.map(r=>r.bounds[a+"0Ft"]))],
      [a+"1",Math.max(...records.map(r=>r.bounds[a+"1Ft"]))]]));
    const build=woodFinish(windowFramingDrawing(candidate,m,options),m);
    // This detail stays at its real wall coordinates. Keep scene fog beyond
    // those coordinates rather than treating a small detail as a whole shed.
    const sceneRadius=2*Math.hypot(Math.max(Math.abs(next.x0),Math.abs(next.x1)),next.y1,
      Math.max(Math.abs(next.z0),Math.abs(next.z1)));
    renderer.show({build,bounds:{W:next.x1-next.x0,L:next.z1-next.z0,H:next.y1},gr:sceneRadius,
      fitDist:distToFit(next,cam.yaw,cam.pitch,size())});
    plan=candidate;box=next;
    cam.target=[(box.x0+box.x1)/2,(box.y0+box.y1)/2,(box.z0+box.z1)/2];
    cam.autoSpin=false;cam.interacted=true;renderer.setStages(null);draw();
    const number=value=>Number(value.toFixed(3));
    status.textContent=`${length}-inch sample board cuts · ${clearHeight}-inch clear window height · ${number(m.windowPlate.studLengthIn)}-inch studs under the plate.`;
    get("plate-top").textContent=number(m.windowPlate.plateTopAboveFloorIn)+" in above flooring";
    get("stud-cut").textContent=number(m.windowPlate.studLengthIn)+" in";
    get("cut-formula").textContent=`${number(m.header.headerBottomAboveFloorIn)} − ${clearHeight} − ${candidate.construction.windowPlateLesson.thicknessIn} − ${wall.wallStudy.plates.thicknessIn} = ${number(m.windowPlate.studLengthIn)} inches`;
    for(const [id,key] of [["plate-view","plate"],["all-view","all"],["angle","header"],["end","end"]])
      get(id).setAttribute("aria-pressed",String(key===view));
  }
  function rebuildCurrent(){rebuild(plan.windowHeaderStudy.lengthIn,plan.windowPlateStudy.clearHeightIn);}
  function preset(next) {
    view=next;
    cam.yaw=next==="end"?Math.PI/2:next==="header"?2.30:3.02;
    cam.pitch=next==="end"?0:next==="header"?.40:.20;zoom=1;
    get("plates").checked=next!=="end";rebuildCurrent();
  }
  get("length").value=cat.construction.windowHeader.exampleLengthIn;
  get("window-height").value=cat.construction.windowPlateLesson.exampleClearHeightIn;
  rebuild(cat.construction.windowHeader.exampleLengthIn,cat.construction.windowPlateLesson.exampleClearHeightIn);
  get("header-controls").hidden=false;
  get("length-form").addEventListener("submit",event=>{
    event.preventDefault();
    try{rebuild(get("length").valueAsNumber,get("window-height").valueAsNumber);}catch(error){status.textContent=error.message+" Previous drawing retained.";}
  });
  get("plates").addEventListener("change",rebuildCurrent);
  get("plate-view").addEventListener("click",()=>preset("plate"));
  get("all-view").addEventListener("click",()=>preset("all"));
  get("angle").addEventListener("click",()=>preset("header"));get("end").addEventListener("click",()=>preset("end"));
  function scale(factor){zoom=Math.max(.25,Math.min(3,zoom*factor));draw();}
  get("zoom-in").addEventListener("click",()=>scale(.8));get("zoom-out").addEventListener("click",()=>scale(1.25));
  const pointers=new Map();
  canvas.addEventListener("pointerdown",event=>{pointers.set(event.pointerId,[event.clientX,event.clientY]);canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener("pointermove",event=>{
    if(!pointers.has(event.pointerId))return;
    const old=pointers.get(event.pointerId),point=[event.clientX,event.clientY];
    if(pointers.size===2) {
      const other=[...pointers].find(([id])=>id!==event.pointerId)[1];
      const a=Math.hypot(old[0]-other[0],old[1]-other[1]),b=Math.hypot(point[0]-other[0],point[1]-other[1]);
      if(a>2 && b>2)scale(a/b);
    } else {cam.yaw-=(point[0]-old[0])*.008;cam.pitch=Math.max(-.5,Math.min(1.5,cam.pitch+(point[1]-old[1])*.006));draw();}
    pointers.set(event.pointerId,point);
  });
  for(const type of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(type,event=>pointers.delete(event.pointerId));
  canvas.addEventListener("wheel",event=>{event.preventDefault();scale(Math.exp(event.deltaY*.001));},{passive:false});
  canvas.addEventListener("keydown",event=>{
    if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-"].includes(event.key))return;
    event.preventDefault();
    if(event.key==="+"||event.key==="=")scale(.8);else if(event.key==="-")scale(1.25);
    else {cam.yaw+=event.key==="ArrowLeft"?-.12:event.key==="ArrowRight"?.12:0;
      cam.pitch=Math.max(-.5,Math.min(1.5,cam.pitch+(event.key==="ArrowUp"?.1:event.key==="ArrowDown"?-.1:0)));draw();}
  });
  const observer=new ResizeObserver(draw);observer.observe(canvas);
  addEventListener("pagehide",()=>observer.disconnect(),{once:true});
}
start().catch(error=>{status.textContent=error.message+" The measured pictures above are still available.";});
