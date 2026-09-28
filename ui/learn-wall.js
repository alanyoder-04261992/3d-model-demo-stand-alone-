/* Manual wall study: complete floor plus one plain wall, with no playback. */
import { loadCatalogue } from "./load.js";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements, formatInches, formatFeetInches } from "../model/floor-measurements.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { wallStudyMeasurements } from "../model/wall-measurements.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { createRenderer } from "../engine/renderer.js";
import { distToFit } from "./parts-gallery.js";
import { installFloorWood, woodFinish } from "./learn-wood.js";
import { installFlooringTexture, flooringFinish } from "./learn-flooring.js";
import { createWallLabels, wallFocusPair } from "./learn-wall-labels.js";

const PARTS=["skids","floor-frame","floor-deck","wall-frame"];
const VIEWS=["angle","wall-front","wall-plates"];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const $=id=>document.getElementById(id);
function drawingBox(build) {
  const box={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity,z0:Infinity,z1:-Infinity};
  for(const key of build.ORDER) {
    const v=build.buckets[key].v;
    for(let i=0;i<v.length;i+=9) for(const [j,axis] of ["x","y","z"].entries()) {
      box[axis+"0"]=Math.min(box[axis+"0"],v[i+j]);box[axis+"1"]=Math.max(box[axis+"1"],v[i+j]);
    }
  }
  return box;
}
function plainBounds(b) {
  return Object.fromEntries(["x","y","z"].flatMap(a=>[[a+"0",b[a+"0Ft"]],[a+"1",b[a+"1Ft"]]]));
}
export async function startWallLesson() {
  const api={ready:false,error:null,wall:"side",selection:["supports","frame","deck","wall"],parts:PARTS.slice(),renderer:null,plan:null,setWall:null,setCamera:null};
  window.floorLesson=api;window.wallLesson=api;
  const canvas=$("lesson-canvas"),viewport=$("lesson-viewport"),controls=$("lesson-wall-controls");
  const buttons=[...document.querySelectorAll("[data-camera]")],radios=[...document.querySelectorAll('input[name="wall-kind"]')];
  $("lesson-reload").addEventListener("click",()=>location.reload());
  function fail(error) {
    api.error=error instanceof Error?error.message:String(error);api.ready=true;
    $("lesson-loading").hidden=true;$("lesson-error").hidden=false;$("lesson-error-text").textContent=api.error;
    viewport.setAttribute("aria-busy","false");if(controls) controls.disabled=true;
    for(const button of buttons) button.disabled=true;
  }
  try {
    const pictureLink=$("lesson-picture-link") || $("lesson-error")?.querySelector("a");
    if(pictureLink) {pictureLink.href="walls.html";pictureLink.textContent="Open the wall pictures";}
    if(!controls || radios.length!==2) throw new Error("Reload this page to load the side wall and end wall controls.");
    document.title="Walls — 10 × 16 side loft";
    $("lesson-pieces").hidden=true;controls.hidden=false;
    if($("lesson-pieces-section")) $("lesson-pieces-section").setAttribute("aria-label","Wall study");
    if($("lesson-heading")) $("lesson-heading").textContent="Walls";
    if($("measurement-explanation")) $("measurement-explanation").textContent="Measurements and names follow the single wall shown. Use Plates close-up to see the two top boards.";
    if($("lesson-reference")) $("lesson-reference").textContent="Side wall, end wall, stud, bottom plate, top plate and upper plate are confirmed names. This view studies one plain wall on the completed floor.";
    const stepLink=$("lesson-step-link");if(stepLink) {stepLink.href="learn.html?step=deck";stepLink.textContent="Earlier: flooring";}
    for(const button of buttons) button.hidden=![...VIEWS,"in","out","reset"].includes(button.dataset.camera);
    const cat=await loadCatalogue("learning-side-loft"),state=defaults(cat);
    if(state.type!=="SLB" || state.size!=="10x16") throw new Error("This lesson needs the 10 × 16 side loft example.");
    const basePlan=floorStudyPlan(makePlan(state,cat)),cache=new Map();
    const renderer=createRenderer(canvas,{trueColour:true,scene:"studio",note:" "});api.renderer=renderer;
    if(renderer.off) throw new Error("3D is not available in this browser. Open the wall pictures below, or reload in a browser with graphics enabled.");
    installFloorWood(renderer);installFlooringTexture(renderer);
    renderer.cam.autoSpin=false;renderer.cam.interacted=true;renderer.setStages(null);
    const labels=createWallLabels(viewport,renderer);
    let current=null,view="angle",zoom=1.18,raf=0;
    const size=()=>({w:Math.max(1,canvas.clientWidth),h:Math.max(1,canvas.clientHeight)});
    function cameraBox() {
      if(view==="wall-front") return plainBounds(current.measures.wall.bounds);
      if(view!=="wall-plates") return current.box;
      const target=renderer.cam.target,along=current.measures.wall.wall==="side"?2:0;
      return {x0:target[0]-(along===0?1.3:.45),x1:target[0]+(along===0?1.3:.45),
        y0:target[1]-.65,y1:target[1]+.65,z0:target[2]-(along===2?1.3:.45),z1:target[2]+(along===2?1.3:.45)};
    }
    function draw() {
      raf=0;if(api.error || !current || !renderer.mesh) return;
      const fit=distToFit(cameraBox(),renderer.cam.yaw,renderer.cam.pitch,size());
      renderer.cam.fitDist=fit;renderer.cam.dist=Math.max(2.5,fit*zoom);renderer.draw();
      labels.update(current.measures.wall,{detail:view==="wall-plates"});
    }
    function requestDraw() {if(!raf) raf=requestAnimationFrame(draw);}
    function markManual() {for(const button of buttons) if(VIEWS.includes(button.dataset.camera)) button.setAttribute("aria-pressed","false");}
    function setCamera(name) {
      if(!current) return;
      if(name==="in") zoom=clamp(zoom/1.15,.5,2.1);
      else if(name==="out") zoom=clamp(zoom*1.15,.5,2.1);
      else {
        view=VIEWS.includes(name)?name:"angle";zoom=view==="angle"?1.18:1.16;
        const m=current.measures.wall,b=m.bounds,side=m.wall==="side";
        if(view==="wall-front") {
          renderer.cam.target=[(b.x0Ft+b.x1Ft)/2,(b.y0Ft+b.y1Ft)/2,(b.z0Ft+b.z1Ft)/2];
          renderer.cam.yaw=side?Math.PI/2:Math.PI;renderer.cam.pitch=0;
        } else if(view==="wall-plates") {
          const pair=wallFocusPair(m),u=pair?.markFt ?? m.lengthFt/2;
          renderer.cam.target=side?[(b.x0Ft+b.x1Ft)/2,m.plates.top.center[1]-.2,b.z0Ft+u]:[b.x0Ft+u,m.plates.top.center[1]-.2,(b.z0Ft+b.z1Ft)/2];
          renderer.cam.yaw=side?Math.PI/2-.25:Math.PI-.25;renderer.cam.pitch=.25;
        } else {
          renderer.cam.target=null;renderer.cam.yaw=side?1.2:Math.PI-.55;renderer.cam.pitch=.32;
        }
        for(const button of buttons) if(VIEWS.includes(button.dataset.camera)) button.setAttribute("aria-pressed",String(button.dataset.camera===view));
      }
      requestDraw();
    }
    function caption(m) {
      const wallName=m.wall==="side"?"Side wall":"End wall";
      $("piece-title").textContent=`${wallName} — ${formatFeetInches(m.lengthFt)}`;
      $("piece-description").textContent="Studs stand on the bottom plate. The lower board across their tops is the top plate; the board above it is the upper plate. Two studs touch at each 4-foot mark.";
      $("piece-draft").textContent="First layout datum and final corner connections are still to confirm. One plain wall is shown at a time.";
      const list=$("piece-measurements");list.replaceChildren();
      const rows=[[`${wallName} span`,formatFeetInches(m.lengthFt)],
        ["Stud cut length · confirmed",`${formatInches(m.studLengthFt)} (${formatFeetInches(m.studLengthFt)})`],
        ["Studs and all three plates · confirmed","2×4 nominal · 1½ × 3½ in actual"],
        ["Regular layout · confirmed",`${formatInches(m.spacingFt)} on center`],
        ["Doubled studs · confirmed",`Every ${formatFeetInches(m.doubleEveryFt)} · mark at their joint`],
        ["Wall height · calculated",`${formatInches(m.heightFt)} (${formatFeetInches(m.heightFt)})`]];
      for(const [title,value] of rows) {const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=title;dd.textContent=value;row.append(dt,dd);list.appendChild(row);}
      $("measurement-note").textContent="The bottom plate rests on the flooring. Total wall height adds the 75-inch stud to three 1½-inch plate thicknesses. Plate cut lengths and corner fit will be checked when the walls are joined.";
      canvas.setAttribute("aria-label",`Rotatable 3D ${wallName.toLowerCase()} on the completed floor. Stud, bottom plate, top plate and upper plate.`);
    }
    function setWall(kind) {
      if(!["side","end"].includes(kind)) return;
      if(!cache.has(kind)) {
        const plan=wallStudyPlan(basePlan,{wall:kind}),wall=wallStudyMeasurements(plan);
        if(!wall) throw new Error("The confirmed wall measurements are missing. Reload the current lesson.");
        const measures={...floorMeasurements(plan),wall},full=assemble(plan,{frames:true,scene:"studio",trueColour:true});
        const plain=onlyParts(full.build,PARTS),build=flooringFinish(woodFinish(plain,measures),measures),box=drawingBox(build);
        const bounds={W:box.x1-box.x0,L:box.z1-box.z0,H:Math.max(.25,(box.y0+box.y1)/2)/.42};
        cache.set(kind,{plan,measures,build,box,bounds,gr:full.gr});
      }
      current=cache.get(kind);api.wall=kind;api.plan=current.plan;
      for(const radio of radios) radio.checked=radio.value===kind;
      renderer.show({build:current.build,bounds:current.bounds,gr:current.gr,fitDist:distToFit(current.box,renderer.cam.yaw||1.2,renderer.cam.pitch||.32,size())});
      renderer.setStages(null);caption(current.measures.wall);setCamera(view);return kind;
    }
    api.setWall=kind=>{try{return setWall(kind);}catch(error){fail(error);return null;}};api.setCamera=setCamera;
    for(const button of buttons) {button.disabled=false;button.addEventListener("click",()=>setCamera(button.dataset.camera));}
    for(const radio of radios) radio.addEventListener("change",()=>{if(radio.checked) api.setWall(radio.value);});
    controls.disabled=false;
    const pointers=new Map();
    const pinchDistance=()=>{const p=[...pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;};
    canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"&&e.button!==0)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});});
    canvas.addEventListener("pointermove",e=>{
      const last=pointers.get(e.pointerId);if(!last)return;const before=pinchDistance();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===1) {renderer.cam.yaw+=(e.clientX-last.x)*.008;renderer.cam.pitch=clamp(renderer.cam.pitch+(e.clientY-last.y)*.006,.04,Math.PI/2-.01);markManual();}
      else if(pointers.size===2) {const after=pinchDistance();if(before>0&&after>0)zoom=clamp(zoom*before/after,.5,2.1);}
      requestDraw();
    });
    for(const name of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(name,e=>pointers.delete(e.pointerId));
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=clamp(zoom*Math.exp(clamp(e.deltaY,-200,200)*.0015),.5,2.1);requestDraw();},{passive:false});
    canvas.addEventListener("keydown",e=>{
      if(["+","=","-","Home"].includes(e.key)){e.preventDefault();setCamera(e.key==="Home"?"reset":e.key==="-"?"out":"in");return;}
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;e.preventDefault();
      if(e.key==="ArrowLeft")renderer.cam.yaw-=.12;if(e.key==="ArrowRight")renderer.cam.yaw+=.12;
      if(e.key==="ArrowUp")renderer.cam.pitch=clamp(renderer.cam.pitch+.08,.04,Math.PI/2-.01);
      if(e.key==="ArrowDown")renderer.cam.pitch=clamp(renderer.cam.pitch-.08,.04,Math.PI/2-.01);markManual();requestDraw();
    });
    canvas.addEventListener("webglcontextlost",e=>{e.preventDefault();fail("The 3D view was interrupted. Reload this page to restore the wall view.");});
    const observer=new ResizeObserver(requestDraw);observer.observe(viewport);
    window.addEventListener("pagehide",()=>{observer.disconnect();if(raf)cancelAnimationFrame(raf);},{once:true});
    setWall("side");draw();$("lesson-loading").hidden=true;$("lesson-empty").hidden=true;viewport.setAttribute("aria-busy","false");api.ready=true;return api;
  }catch(error){fail(error);return api;}
}
