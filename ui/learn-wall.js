/* Manual wall study: complete floor plus one plain wall, with no playback. */
import { loadCatalogue } from "./load.js";
import { defaults } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { floorStudyPlan } from "../model/floor-study.js";
import { floorMeasurements, formatInches, formatFeetInches } from "../model/floor-measurements.js";
import { wallStudyPlan } from "../model/wall-study.js";
import { wallStudyMeasurements } from "../model/wall-measurements.js";
import { gableStudyPlan } from "../model/gable-study.js";
import { gableStudyMeasurements } from "../model/gable-measurements.js";
import { trussStudyPlan } from "../model/truss-study.js";
import { trussStudyMeasurements } from "../model/truss-measurements.js";
import { assemble, onlyParts } from "../engine/assemble.js";
import { createRenderer } from "../engine/renderer.js";
import { distToFit } from "./parts-gallery.js";
import { installFloorWood, woodFinish } from "./learn-wood.js";
import { installFlooringTexture, flooringFinish } from "./learn-flooring.js";
import { createWallLabels, wallFocusPair } from "./learn-wall-labels.js";
import { createGableLabels } from "./learn-gable-labels.js";
import { createTrussLabels } from "./learn-truss-labels.js";

const PARTS=["skids","floor-frame","floor-deck","wall-frame"];
const VIEWS=["angle","wall-front","wall-plates","wall-end"];
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
export async function startWallLesson({gable=false,truss=false}={}) {
  gable=gable||truss;
  const parts=gable?[...PARTS,"gable-frame",...(truss?["roof-frame","gable-backing"]:[])]:PARTS.slice();
  const views=truss?["angle","wall-front","wall-plates","wall-end"]:gable?["angle","wall-front","wall-end"]:VIEWS;
  const api={ready:false,error:null,wall:gable?"end":"side",selection:["supports","frame","deck","wall",...(gable?["gable"]:[])],parts,renderer:null,plan:null,setWall:null,setCamera:null};
  window.floorLesson=api;window.wallLesson=api;
  if(gable) window.gableLesson=api;
  if(truss) window.trussLesson=api;
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
    if(pictureLink) {pictureLink.href=truss?"truss.html":gable?"gable.html":"walls.html";pictureLink.textContent=truss?"Open the truss pictures":gable?"Open the gable-board pictures":"Open the wall pictures";}
    if(!controls || radios.length!==2) throw new Error("Reload this page to load the side wall and end wall controls.");
    document.title=(truss?"Truss fit preview":gable?"Gable framing":"Walls")+" — 10 × 16 side loft";
    $("lesson-pieces").hidden=true;controls.hidden=gable;
    if($("lesson-pieces-section")) $("lesson-pieces-section").setAttribute("aria-label",truss?"Truss fit preview":gable?"Gable board study":"Wall study");
    if($("lesson-heading")) $("lesson-heading").textContent=truss?"Truss fit preview":gable?"Gable framing":"Walls";
    if($("measurement-explanation")) $("measurement-explanation").textContent=truss
      ? "The truss lengths follow the longest edges. Gable backing view measures 11 inches from upper-plate top to backing bottom. Front view shows the 4-foot rise; Connection close-up shows 6¼ inches from the truss tip to the upper-plate cut."
      : gable
      ? "The gable board is a 2×6 on edge in its new position across the upper plate. Connection close-up measures the 2½-inch projection and the ½-inch inside ledge."
      : "Measurements follow the actual boards. Plates close-up shows their names; Wall end close-up shows the 3½-inch step.";
    if($("lesson-reference")) $("lesson-reference").textContent=truss
      ? "Truss: 2×4, with 54-inch upper pieces and 37¾-inch lower pieces. The gable studs stand on the gable board, turned outward, 24 inches on center."
      : gable
      ? "Gable board is the confirmed name. It is nailed to the upper plate; the truss goes against its front face. Its 118-inch length is calculated from the plate and both end projections."
      : "Side wall, end wall, stud, bottom plate, top plate and upper plate are confirmed names. This view studies one plain wall on the completed floor.";
    const stepLink=$("lesson-step-link");if(stepLink) {stepLink.href=truss?"learn.html?step=gable":gable?"learn.html?step=truss":"learn.html?step=gable";stepLink.textContent=truss?"Earlier: gable board":gable?"Next: truss fit preview":"Next: gable framing";}
    for(const button of buttons) {
      button.hidden=![...views,"in","out","reset"].includes(button.dataset.camera);
      if(gable && button.dataset.camera==="wall-end") button.textContent="Connection close-up";
      if(truss && button.dataset.camera==="wall-plates") button.textContent="Gable backing";
    }
    const cat=await loadCatalogue("learning-side-loft"),state=defaults(cat);
    if(state.type!=="SLB" || state.size!=="10x16") throw new Error("This lesson needs the 10 × 16 side loft example.");
    const basePlan=floorStudyPlan(makePlan(state,cat)),cache=new Map();
    const renderer=createRenderer(canvas,{trueColour:true,scene:"studio",note:" "});api.renderer=renderer;
    if(renderer.off) throw new Error(`3D is not available in this browser. Open the ${gable?"gable-board":"wall"} pictures below, or reload in a browser with graphics enabled.`);
    installFloorWood(renderer);installFlooringTexture(renderer);
    renderer.cam.autoSpin=false;renderer.cam.interacted=true;renderer.setStages(null);
    const labels=truss?createTrussLabels(viewport,renderer):gable?createGableLabels(viewport,renderer):createWallLabels(viewport,renderer);
    let current=null,view="angle",zoom=1.18,raf=0;
    const size=()=>({w:Math.max(1,canvas.clientWidth),h:Math.max(1,canvas.clientHeight)});
    function cameraBox() {
      if(truss && view==="wall-plates" && current.measures.truss.backingMembers.length) {
        const t=current.measures.truss,bs=t.backingMembers.map(m=>m.bounds);
        return {x0:Math.min(...bs.map(b=>b.x0Ft))-.5,x1:Math.max(...bs.map(b=>b.x1Ft))+.5,
          y0:current.measures.gable.upperPlate.bounds.y0Ft-.3,y1:t.backingRule.topYFt+.6,
          z0:bs[0].z0Ft-.2,z1:bs[0].z1Ft+.2};
      }
      if(truss && view!=="wall-end") {
        const b=plainBounds(current.measures.truss.bounds);
        b.y0=current.measures.gable.upperPlate.bounds.y0Ft-.1;
        return b;
      }
      if(view==="wall-front") {
        const b=plainBounds(current.measures.wall.bounds);
        if(gable) b.y1=current.measures.gable.board.bounds.y1Ft;
        return b;
      }
      if(!["wall-plates","wall-end"].includes(view)) return current.box;
      const target=renderer.cam.target,along=current.measures.wall.wall==="side"?2:0;
      const radius=view==="wall-end"?(truss?1:gable?.6:.9):1.3;
      return {x0:target[0]-(along===0?radius:.45),x1:target[0]+(along===0?radius:.45),
        y0:target[1]-.65,y1:target[1]+.65,z0:target[2]-(along===2?radius:.45),z1:target[2]+(along===2?radius:.45)};
    }
    function draw() {
      raf=0;if(api.error || !current || !renderer.mesh) return;
      const fit=distToFit(cameraBox(),renderer.cam.yaw,renderer.cam.pitch,size());
      renderer.cam.fitDist=fit;renderer.cam.dist=Math.max(2.5,fit*zoom);renderer.draw();
      if(truss) labels.update(current.measures.truss,current.measures.gable,{detail:view==="wall-end",front:view==="wall-front",backing:view==="wall-plates"});
      else if(gable) labels.update(current.measures.gable,{detail:view==="wall-end"});
      else labels.update(current.measures.wall,{detail:view==="wall-plates",endDetail:view==="wall-end"});
    }
    function requestDraw() {if(!raf) raf=requestAnimationFrame(draw);}
    function markManual() {for(const button of buttons) if(views.includes(button.dataset.camera)) button.setAttribute("aria-pressed","false");}
    function setCamera(name) {
      if(!current) return;
      if(name==="in") zoom=clamp(zoom/1.15,.5,2.1);
      else if(name==="out") zoom=clamp(zoom*1.15,.5,2.1);
      else {
        view=views.includes(name)?name:"angle";zoom=view==="angle"?1.18:1.16;
        const m=current.measures.wall,b=m.bounds,side=m.wall==="side";
        if(view==="wall-front") {
          renderer.cam.target=[(b.x0Ft+b.x1Ft)/2,(b.y0Ft+b.y1Ft)/2,(b.z0Ft+b.z1Ft)/2];
          if(gable) renderer.cam.target[1]=(b.y0Ft+current.measures.gable.board.bounds.y1Ft)/2;
          if(truss) renderer.cam.target[1]=(current.measures.gable.upperPlate.bounds.y0Ft+current.measures.truss.bounds.y1Ft)/2;
          renderer.cam.yaw=side?Math.PI/2:Math.PI;renderer.cam.pitch=0;
        } else if(view==="wall-plates" && truss) {
          const t=current.measures.truss;
          renderer.cam.target=[(t.bounds.x0Ft+t.bounds.x1Ft)/2,
            (current.measures.gable.upperPlate.bounds.y1Ft+(t.backingRule?.topYFt||t.baseYFt))/2,
            current.measures.gable.board.bounds.z1Ft];
          renderer.cam.yaw=.06;renderer.cam.pitch=.14;zoom=1.12;
        } else if(view==="wall-plates") {
          const pair=wallFocusPair(m),u=pair?.markFt ?? m.lengthFt/2;
          renderer.cam.target=side?[(b.x0Ft+b.x1Ft)/2,m.plates.top.center[1]-.2,b.z0Ft+u]:[b.x0Ft+u,m.plates.top.center[1]-.2,(b.z0Ft+b.z1Ft)/2];
          renderer.cam.yaw=side?Math.PI/2-.25:Math.PI-.25;renderer.cam.pitch=.25;
        } else if(view==="wall-end" && truss) {
          const t=current.measures.truss,g=current.measures.gable;
          renderer.cam.target=[(t.anchors.leftTip[0]+t.anchors.leftPlateCut[0])/2,g.board.bounds.y0Ft+.25,g.board.center[2]];
          renderer.cam.yaw=-.55;renderer.cam.pitch=.22;zoom=1.16;
        } else if(view==="wall-end" && gable) {
          const g=current.measures.gable,board=g.board.bounds;
          renderer.cam.target=[g.plateStart[0]+.3,g.upperPlate.bounds.y1Ft+.12,(board.z0Ft+board.z1Ft)/2];
          renderer.cam.yaw=g.ledgeEdge==="wall-line"?-Math.PI+.7:-.7;renderer.cam.pitch=.42;zoom=1.05;
        } else if(view==="wall-end") {
          const axis=side?"z":"x",start=Math.min(m.plates.top.bounds[axis+"0Ft"],m.plates.upper.bounds[axis+"0Ft"]);
          renderer.cam.target=side?[(b.x0Ft+b.x1Ft)/2,m.plates.top.center[1]-.25,start+.45]:[start+.45,m.plates.top.center[1]-.25,(b.z0Ft+b.z1Ft)/2];
          renderer.cam.yaw=side?Math.PI/2+.4:Math.PI+.4;renderer.cam.pitch=.22;
        } else {
          renderer.cam.target=null;renderer.cam.yaw=gable?.55:side?1.2:Math.PI-.55;renderer.cam.pitch=.32;
          if(truss) {
            const t=current.measures.truss;
            renderer.cam.target=[0,(current.measures.gable.upperPlate.bounds.y0Ft+t.bounds.y1Ft)/2,(t.bounds.z0Ft+t.bounds.z1Ft)/2];
            renderer.cam.yaw=.28;renderer.cam.pitch=.18;
          }
        }
        for(const button of buttons) if(views.includes(button.dataset.camera)) button.setAttribute("aria-pressed",String(button.dataset.camera===view));
      }
      requestDraw();
    }
    function caption(m) {
      if(truss) {trussCaption(current.measures.truss);return;}
      if(gable) {gableCaption(current.measures.gable);return;}
      const wallName=m.wall==="side"?"Side wall":"End wall";
      $("piece-title").textContent=`${wallName} — ${formatFeetInches(m.lengthFt)} overall span`;
      $("piece-description").textContent=m.wall==="side"
        ? "The bottom plate, top plate and end studs sit 3½ inches back at both ends. The upper plate spans the full 16 feet, extending beyond the shorter frame."
        : "The bottom plate, top plate and end studs span the full 10 feet. The upper plate stops 3½ inches short at both ends.";
      $("piece-draft").textContent="The first stud-layout datum is still to confirm. One separate wall is shown at a time.";
      const list=$("piece-measurements");list.replaceChildren();
      const rows=[[`${wallName} · nominal overall span`,formatFeetInches(m.lengthFt)],
        ["Bottom plate cut · calculated",`${formatInches(m.plates.bottom.lengthFt)} (${formatFeetInches(m.plates.bottom.lengthFt)})`],
        ["Top plate cut · calculated",`${formatInches(m.plates.top.lengthFt)} (${formatFeetInches(m.plates.top.lengthFt)})`],
        ["Upper plate cut · calculated",`${formatInches(m.plates.upper.lengthFt)} (${formatFeetInches(m.plates.upper.lengthFt)})`],
        ["Both ends · confirmed offset",m.wall==="side"?"Frame 3½ in back; upper plate full span":"Frame full span; upper plate 3½ in back"],
        ["Stud cut length · confirmed",`${formatInches(m.studLengthFt)} (${formatFeetInches(m.studLengthFt)})`],
        ["Studs and all three plates · confirmed","2×4 nominal · 1½ × 3½ in actual"],
        ["Regular layout · confirmed",`${formatInches(m.spacingFt)} on center`],
        ["Doubled studs · confirmed",`Every ${formatFeetInches(m.doubleEveryFt)} · mark at their joint`],
        ["Wall height · calculated",`${formatInches(m.heightFt)} (${formatFeetInches(m.heightFt)})`]];
      for(const [title,value] of rows) {const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=title;dd.textContent=value;row.append(dt,dd);list.appendChild(row);}
      $("measurement-note").textContent=(m.wall==="side"
        ? "Side-wall frame cuts: 192 − 3½ − 3½ = 185 inches. The upper plate remains 192 inches. "
        : "End-wall upper-plate cut: 120 − 3½ − 3½ = 113 inches. The bottom and top plates remain 120 inches. ")
        +"These lengths follow the confirmed end-offset rule. The bottom plate rests on the flooring; wall height adds the 75-inch stud to three 1½-inch plate thicknesses.";
      canvas.setAttribute("aria-label",`Rotatable 3D ${wallName.toLowerCase()} on the completed floor. Stud, bottom plate, top plate and upper plate.`);
    }
    function gableCaption(g) {
      $("piece-title").textContent=g.name+" — 2×6 along the end-wall upper plate";
      $("piece-description").textContent="The board stands on its narrow edge on top of the upper plate, in the new position across the plate. The ledge is ½ inch inside and 1½ inches outside. It projects 2½ inches past each cut end of the upper plate.";
      $("piece-draft").textContent="The gable board is nailed to the upper plate. Wood treatment and nail size or spacing remain unspecified. The next step shows the truss and gable studs as a fit preview.";
      const rows=[["Gable board length · calculated",`${formatInches(g.lengthFt)} (${formatFeetInches(g.lengthFt)})`],
        ["Actual section · on edge",`${formatInches(g.thicknessFt)} thick × ${formatInches(g.heightFt)} high`],
        ["Upper plate beneath · calculated",`${formatInches(g.upperPlate.lengthFt)} (${formatFeetInches(g.upperPlate.lengthFt)})`],
        ["Past first cut end · confirmed",formatInches(g.endProjectionFt.start)],
        ["Past opposite cut end · confirmed",formatInches(g.endProjectionFt.end)],
        ["Inside ledge",formatInches(g.innerLedgeFt)],
        ["Outside ledge · calculated",formatInches(g.outerLedgeFt)]];
      const list=$("piece-measurements");list.replaceChildren();
      for(const [title,value] of rows) {const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=title;dd.textContent=value;row.append(dt,dd);list.appendChild(row);}
      $("measurement-note").textContent=`Length: ${formatInches(g.upperPlate.lengthFt)} upper plate + ${formatInches(g.endProjectionFt.start)} at one end + ${formatInches(g.endProjectionFt.end)} at the other = ${formatInches(g.lengthFt)}. The ½-inch inside ledge measures across the plate to the gable-board face. The remaining outside ledge is 3½ − 1½ − ½ = 1½ inches.`;
      canvas.setAttribute("aria-label","Rotatable 3D end wall and gable board in its new position across the upper plate. The 2×6 gable board is on edge, with a half-inch inside ledge, a one-and-a-half-inch outside ledge, and two-and-a-half-inch projection past each upper-plate end.");
    }
    function trussCaption(t) {
      $("piece-title").textContent="Truss, gable studs and gable backing";
      $("piece-description").textContent="The 2×4 truss goes against the front face of the gable board, with the whole bottom cut level with the gable board’s bottom and the upper plate’s top. Its upper pieces lead to the peak; the lower pieces form the steeper sides. The gable studs remain on the board; their top fit behind the truss is a preview choice."
        +(t.backingMembers.length?" Gable backing fits horizontally between the studs, wide face outward. Its bottom is 11 inches above the upper-plate top. It is used when this gable has no window or fake window.":"");
      $("piece-draft").textContent="The 2×4 gable studs have their 3½-inch faces outward. Their layout is measured from the outside end-wall edge. This preview reads ‘centered’ as the first stud center at 24 inches; the knee/peak cuts and stud-top connection remain to check.";
      const rows=[
        ["Upper truss piece · longest edge",formatInches(t.upperLengthFt)],
        ["Lower truss piece · longest edge",formatInches(t.lowerLengthFt)],
        ["Peak above upper-plate top",`${formatInches(t.peakRiseFt)} (${formatFeetInches(t.peakRiseFt)})`],
        ["Truss tip to upper-plate cut",formatInches(t.projectionFt.start)],
        ["Truss lumber · confirmed","2×4 nominal · 1½ × 3½ in actual"],
        ["Gable studs · confirmed spacing","24 in on center"],
        ["Gable stud lumber · confirmed","2×4 · 1½ × 3½ in actual · wide face outward"],
        ["Gable-stud layout datum · confirmed","Outside edge of the end wall"],
        ["First center · preview interpretation",`${formatInches(t.studFirstCenterFt)} from the wall edge`],
        ["Centers from that wall edge",t.studWallDistancesFt.map(value=>formatInches(value)).join(" · ")],
        ["Opposite-end fit · preview","Same projection; mirror of the shown end"],
      ];
      if(t.backingMembers.length) rows.push(
        ["Gable backing · bottom above upper plate",formatInches(t.backingRule.bottomOffsetIn/12)],
        ["Gable backing · actual section",`${formatInches(t.backingRule.thicknessIn/12)} × ${formatInches(t.backingRule.heightIn/12)} · wide face outward`],
        ["Backing pieces · calculated clear lengths",t.backingMembers.map(b=>formatInches(b.lengthFt)).join(" · ")]);
      const list=$("piece-measurements");list.replaceChildren();
      for(const [title,value] of rows) {const row=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");dt.textContent=title;dd.textContent=value;row.append(dt,dd);list.appendChild(row);}
      $("measurement-note").textContent="The 6¼-inch measurement ends at the upper plate's cut, not at the end of the gable board. Sloping lengths and the vertical peak rise are separate dimensions. This preview lets us check the fit before agreeing on the remaining cuts and stud details.";
      canvas.setAttribute("aria-label","Rotatable truss fit preview. Upper truss pieces 54 inches, lower pieces 37¾ inches, peak 48 inches above the top of the upper plate. Outward-facing 2×4 gable studs are 24 inches on center, measured from the outside end-wall edge; this preview puts the first center at 24 inches. Connection view measures 6¼ inches from the truss tip to the upper plate's cut end.");
    }
    function setWall(kind) {
      if(!["side","end"].includes(kind) || (gable && kind!=="end")) return;
      if(!cache.has(kind)) {
        const wallPlan=wallStudyPlan(basePlan,{wall:kind}),gablePlan=gable?gableStudyPlan(wallPlan,{gable:true}):wallPlan,plan=truss?trussStudyPlan(gablePlan,{truss:true}):gablePlan,wall=wallStudyMeasurements(plan);
        if(!wall) throw new Error("The confirmed wall measurements are missing. Reload the current lesson.");
        const measures={...floorMeasurements(plan),wall,...(gable?{gable:gableStudyMeasurements(plan)}:{}),...(truss?{truss:trussStudyMeasurements(plan)}:{})},full=assemble(plan,{frames:true,scene:"studio",trueColour:true});
        if(gable && !measures.gable) throw new Error("The gable-board measurements are missing. Reload the current lesson.");
        const plain=onlyParts(full.build,parts),build=flooringFinish(woodFinish(plain,measures),measures),box=drawingBox(build);
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
    setWall(gable?"end":"side");draw();$("lesson-loading").hidden=true;$("lesson-empty").hidden=true;viewport.setAttribute("aria-busy","false");api.ready=true;return api;
  }catch(error){fail(error);return api;}
}
