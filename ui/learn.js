/* A manual, one-piece-at-a-time floor study. Geometry comes unchanged from
   the existing assembly. Only floor parts are uploaded; no playback or spin.
   Browser verification API: window.floorLesson.{ready,error,selection,parts,
   renderer,plan,select(keys,focus),setCamera(name)}. */
import { loadCatalogue } from "./load.js";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { FLOOR_PIECES, initialFloorSelection, floorParts, floorPiece } from "../model/floor-lesson.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { createRenderer } from "../engine/renderer.js";
import { distToFit } from "./parts-gallery.js";
import { createFloorLabels } from "./learn-labels.js";
import { createMeasurementReadout } from "./learn-measurements.js";

const COMPANY = "learning-side-loft";
const ANGLE = { yaw:0.7, pitch:0.65 };
const BASE_ZOOM = 1.15; // Leave room for dimension lines beyond the footprint.
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const $ = (id) => document.getElementById(id);

function drawingBox(build) {
  const b = { x0:Infinity,y0:Infinity,z0:Infinity,x1:-Infinity,y1:-Infinity,z1:-Infinity };
  for (const key of build.ORDER) {
    const v = build.buckets[key].v;
    for (let i=0;i<v.length;i+=9) {
      b.x0=Math.min(b.x0,v[i]); b.x1=Math.max(b.x1,v[i]);
      b.y0=Math.min(b.y0,v[i+1]); b.y1=Math.max(b.y1,v[i+1]);
      b.z0=Math.min(b.z0,v[i+2]); b.z1=Math.max(b.z1,v[i+2]);
    }
  }
  if (!Number.isFinite(b.x0)) throw new Error("The selected floor has no pieces to show.");
  return b;
}

export async function startFloorLesson() {
  const api = { ready:false,error:null,selection:[],parts:[],renderer:null,plan:null,select:null,setCamera:null };
  window.floorLesson=api;
  const canvas=$("lesson-canvas"), viewport=$("lesson-viewport");
  const boxes=[...document.querySelectorAll('input[name="piece"]')];
  const cameraButtons=[...document.querySelectorAll("[data-camera]")];
  $("lesson-reload").addEventListener("click",()=>location.reload());
  function fail(error) {
    api.error=error instanceof Error ? error.message : String(error);
    api.ready=true;
    $("lesson-loading").hidden=true;
    $("lesson-error").hidden=false;
    $("lesson-error-text").textContent=api.error;
    viewport.setAttribute("aria-busy","false");
    $("lesson-pieces").disabled=true;
    for(const button of cameraButtons) button.disabled=true;
  }
  try {
    const cat=await loadCatalogue(COMPANY);
    const state=defaults(cat);
    if(state.type!=="SLB" || state.size!=="10x16") throw new Error("This lesson needs the 10 × 16 side loft example. Check its starting building settings, then reload.");
    const plan=makePlan(state,cat);
    const full=assemble(plan,{frames:true,scene:"studio",trueColour:true});
    // Fit the complete floor footprint once so adding a piece does not move
    // the camera. No wall, roof, ground or finished-floor slab can be shown.
    const allFloor=onlyParts(full.build,FLOOR_PIECES.map((p)=>p.part));
    const box=drawingBox(allFloor);
    const bounds={ W:box.x1-box.x0,L:box.z1-box.z0,H:Math.max(.25,(box.y0+box.y1)/2)/.42 };
    const renderer=createRenderer(canvas,{trueColour:true,scene:"studio",note:" "});
    api.renderer=renderer; api.plan=plan;
    if(renderer.off) throw new Error("3D is not available in this browser. Try another browser or enable graphics acceleration, then reload. The first piece is described below.");
    renderer.cam.autoSpin=false; renderer.cam.interacted=true;
    renderer.setStages(null); // Frame and deck stages must be visible here.
    Object.assign(renderer.cam,ANGLE);
    const labels=createFloorLabels(viewport,renderer,plan);
    const measurements=createMeasurementReadout($("piece-measurements"),$("measurement-note"),plan);
    let zoom=BASE_ZOOM, raf=0, focus="supports";
    const size=()=>({w:Math.max(1,canvas.clientWidth),h:Math.max(1,canvas.clientHeight)});
    const markManual=()=>{
      for(const button of cameraButtons) if(["angle","top"].includes(button.dataset.camera)) button.setAttribute("aria-pressed","false");
    };
    function draw() {
      raf=0;
      if(api.error || !renderer.mesh) return;
      const fitted=distToFit(box,renderer.cam.yaw,renderer.cam.pitch,size());
      renderer.cam.fitDist=fitted;
      renderer.cam.dist=fitted*zoom;
      renderer.draw();
      labels.update(api.selection);
    }
    function requestDraw() { if(!raf) raf=requestAnimationFrame(draw); }
    function select(keys,nextFocus) {
      api.selection=FLOOR_PIECES.filter((p)=>Array.isArray(keys)&&keys.includes(p.key)).map((p)=>p.key);
      api.parts=floorParts(api.selection);
      if(nextFocus) focus=nextFocus;
      for(const input of boxes) input.checked=api.selection.includes(input.value);
      const build=onlyParts(full.build,api.parts);
      renderer.show({build,bounds,gr:full.gr,fitDist:distToFit(box,renderer.cam.yaw,renderer.cam.pitch,size())});
      renderer.setStages(null);
      const piece=floorPiece(api.selection,focus);
      $("piece-title").textContent=piece ? (piece.key==="supports" ? "The long supports underneath" : piece.label) : "Choose a floor piece";
      $("piece-description").textContent=piece ? piece.description : "Use the boxes to add a piece back into the view.";
      $("piece-draft").textContent=piece ? piece.draft : "We will work through the pieces together.";
      canvas.setAttribute("aria-label",piece ? "Rotatable 3D floor view. Showing: "+FLOOR_PIECES.filter((p)=>api.selection.includes(p.key)).map((p)=>p.label).join(", ")+"." : "3D floor view with all pieces hidden.");
      $("lesson-empty").hidden=api.parts.length>0;
      measurements.update(api.selection);
      requestDraw();
      return api.parts.slice();
    }
    function setCamera(name) {
      if(name==="in") zoom=clamp(zoom/1.15,.5,2.1);
      else if(name==="out") zoom=clamp(zoom*1.15,.5,2.1);
      else if(name==="top") { renderer.cam.yaw=0; renderer.cam.pitch=Math.PI/2-.01; zoom=BASE_ZOOM; }
      else { Object.assign(renderer.cam,ANGLE); zoom=BASE_ZOOM; }
      if(!["in","out"].includes(name)) {
        for(const button of cameraButtons) if(["angle","top"].includes(button.dataset.camera)) button.setAttribute("aria-pressed",String(button.dataset.camera===(name==="top"?"top":"angle")));
      }
      requestDraw();
    }
    api.select=select; api.setCamera=setCamera;
    for(const button of cameraButtons) {
      button.disabled=false;
      button.addEventListener("click",()=>setCamera(button.dataset.camera));
    }
    for(const input of boxes) input.addEventListener("change",()=>select(boxes.filter((b)=>b.checked).map((b)=>b.value),input.checked?input.value:null));
    $("lesson-pieces").disabled=false;
    const pointers=new Map();
    const pinchDistance=()=>{const points=[...pointers.values()];return points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0;};
    canvas.addEventListener("pointerdown",(event)=>{
      if(event.pointerType==="mouse" && event.button!==0) return;
      canvas.focus({preventScroll:true});
      canvas.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    });
    canvas.addEventListener("pointermove",(event)=>{
      const previous=pointers.get(event.pointerId); if(!previous) return;
      const before=pinchDistance();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===1) {
        renderer.cam.yaw+=(event.clientX-previous.x)*.008;
        renderer.cam.pitch=clamp(renderer.cam.pitch+(event.clientY-previous.y)*.006,.08,Math.PI/2-.01);
        markManual();
      } else if(pointers.size===2) {
        const after=pinchDistance(); if(before>0 && after>0) zoom=clamp(zoom*before/after,.5,2.1);
      }
      requestDraw();
    });
    for(const name of ["pointerup","pointercancel","lostpointercapture"]) canvas.addEventListener(name,(event)=>pointers.delete(event.pointerId));
    canvas.addEventListener("wheel",(event)=>{
      event.preventDefault();
      zoom=clamp(zoom*Math.exp(clamp(event.deltaY,-200,200)*.0015),.5,2.1);
      requestDraw();
    },{passive:false});
    canvas.addEventListener("keydown",(event)=>{
      const key=event.key;
      if(["+","=","-","Home"].includes(key)) {event.preventDefault();setCamera(key==="Home"?"reset":key==="-"?"out":"in");return;}
      if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(key)) return;
      event.preventDefault();
      if(key==="ArrowLeft") renderer.cam.yaw-=.12;
      if(key==="ArrowRight") renderer.cam.yaw+=.12;
      if(key==="ArrowUp") renderer.cam.pitch=clamp(renderer.cam.pitch+.08,.08,Math.PI/2-.01);
      if(key==="ArrowDown") renderer.cam.pitch=clamp(renderer.cam.pitch-.08,.08,Math.PI/2-.01);
      markManual();requestDraw();
    });
    canvas.addEventListener("webglcontextlost",(event)=>{event.preventDefault();fail("The 3D view was interrupted. Reload this page to restore the floor view.");});
    const observer=new ResizeObserver(requestDraw); observer.observe(viewport);
    window.addEventListener("pagehide",()=>{observer.disconnect();if(raf)cancelAnimationFrame(raf);},{once:true});
    const selection=initialFloorSelection(new URLSearchParams(location.search).get("step"));
    select(selection,selection[0]);
    setCamera("angle");
    draw();
    $("lesson-loading").hidden=true;
    viewport.setAttribute("aria-busy","false");
    api.ready=true;
    return api;
  } catch(error) { fail(error); return api; }
}

startFloorLesson();
