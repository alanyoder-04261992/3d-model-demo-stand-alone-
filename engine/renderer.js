/* THE RENDERER: turns a finished drawing (a build from engine/buckets.js)
   into the picture on the screen -- sunlight, soft shadows, the textures, the
   haze -- and keeps it moving. Browser file (WebGL).

   Ported from Barnwright's 3ddesign.html: the shader setup (1688-1693), the
   shadow map (1695-1710), uploadBuffers (4081-4089), draw() with its shadow
   pass and frame-cost watchdog (4092-4222) and the animation loop with its
   second watchdog (4682-4721). The arithmetic is Barnwright's; what changed is
   only where the numbers come from -- Barnwright read the shed's size from
   page-wide variables, this is handed them.

     const r = createRenderer(canvas, { trueColour: false, scene: "studio" });
     r.show(result);            // result = assemble(...): { build, bounds, gr, fitDist }
     r.startLoop({ fit: "fitref" });

   THE PIECES
   * upload(build) / show(result) -- send a build to the graphics card (one
     buffer per material) and make it the one drawn. show() also takes the
     frame from assemble -- bounds {W, L, H}, the ground radius gr and the
     camera fit -- and applies the fit to the camera the way Barnwright's
     buildShed did (reset the distance until the customer touches it).
     IMPORTANT for whoever builds `bounds`: H must be worked out exactly as
     Barnwright wrote it, y0 + wallH + roofRise(W), in that order -- the
     camera aims at H * 0.42 and the shadow box is sized from H, and a
     different order of adding changes the last digit.
   * draw(opts) -- one frame, now. Returns false (and draws nothing) while the
     canvas has no size (a closed tab, a collapsed embed) or nothing is shown.
   * setStages(table) -- which building steps are hidden or lifted (the
     Framing view and Watch-it-build). See setStages below.
     stageTableFor("finished" | "framing") and stageTableFromBuild(
     buildVisibility(order, k), liftFeet) make the tables for the views.
   * setScene(name) -- studio / yard / paper (true-colour when the renderer
     was made with trueColour).
   * startLoop() / stopLoop() -- Barnwright's loop: draws only when something
     changed (r.needsDraw = true), turns the building slowly for its first 10
     seconds unless the customer prefers reduced motion or has touched it,
     plays the camera glide, and stops entirely while the page is hidden or
     the canvas is off screen. When the canvas changes size it re-fits the
     camera but KEEPS the ground radius from the last build (as Barnwright's
     resize did -- a kept quirk).
   * projCache -- { proj(p) -> [x, y, depth] in CSS pixels or null behind the
     camera, cp: the eye } from the last frame, for tapping on doors/windows.
   * cam -- the camera (engine/camera.js). The UI turns and zooms it.
   * test = { freezeWatchdog, forceShadow, dprCap } -- set by checks so a
     picture comes out the same every time: no watchdog, shadows on, a fixed
     pixel density. test.readPixels() reads the picture just drawn (call it
     in the same task as draw()).

   KEPT QUIRKS (they are part of the look or were measured on real devices):
   * The picture is drawn at least 1.5x the screen's pixels and shrunk --
     free anti-aliasing ("stair-stepped roof line read as computer drawing").
   * `canvas.width = cssWidth * dpr` is assigned as is and the browser
     TRUNCATES a fraction (1.5 x an odd width); Barnwright did the same.
   * Two watchdogs: if frames take too long (the median of 15 over 110 ms of
     work, or of 12 rAF gaps over 70 ms) the shadows go off, then the extra
     pixels; shadows get ONE retry when things calm down. Never on a check.
   * The canvas is see-through (alpha); the backdrop is CSS (engine/scene.js).
   * Decals (soft shadows) are drawn multiplied over what is behind them,
     without writing depth, in the order they were made.
   * The sun follows the camera (engine/scene.js sunFromCam).

   NEW HERE (none of it changes the finished picture):
   * Each corner is 36 bytes: Barnwright's 32 + the building-step number at
     byte 32, read by both passes (aStage).
   * The step table uStg is sent to BOTH programs whenever it changes.
   * The GL buffers live in the renderer, not in the build, so a build stays
     a value (the same build can be shown by two renderers, or snapshotted).
   * Several meshes can exist at once (createMesh / draw({mesh})), so a
     snapshot of a different building does not disturb the one on screen.

   ONE DELIBERATE DIFFERENCE FROM BARNWRIGHT (for docs/DIFFERENCES.md): the
   shadow pass switches off the normal and UV slots it does not read. In
   Barnwright the first frame after every rebuild is drawn with NO shadows
   (WebGL rejects each shadow draw because those slots still point at the
   buffers the rebuild just deleted); the next frame is correct. Here every
   frame has its shadows. The settled picture is identical; only that one
   glitched frame differs. A look test that draws Barnwright once right after
   buildShed() must draw it twice. */

import { createContext, mkProg } from "./gl.js";
import { VS, FS, FSTRUE, VSD, FSD, ATTRIBS, STRIDE, U_NAMES } from "./shaders.js";
import { createTextures } from "./textures.js";
import { sunFromCam } from "./scene.js";
import { sceneFor, DEFAULT_SCENE, SUN_EL, ENV_UP_BUILT_IN, ENV_DN_BUILT_IN } from "./scene-data.js";
import { matMul, matPersp, matOrtho, matLook } from "./math.js";
import { createCamera, fitCamera, setFitDist, stepCamera } from "./camera.js";
import { STAGES, STAGE_ID, MAX_STAGES, visibleIn } from "../parts/stages.js";

function fcMedian(a){ var s=a.slice().sort(function(x,y){return x-y;}); return s[s.length>>1]; }

/* A step table for the Finished or Framing view: { stageKey: {hidden} }. */
export function stageTableFor(view){
  var t={};
  STAGES.forEach(function(s){ t[s.key]={ hidden: !visibleIn(view, s), lift: 0 }; });
  return t;
}

/* A step table for Watch-it-build from parts/stages.js buildVisibility():
   shown steps visible, the step being placed lifted by `lift` feet. */
export function stageTableFromBuild(vis, lift){
  var t={};
  Object.keys(vis).forEach(function(k){ t[k]={ hidden: !vis[k].shown, lift: vis[k].lifting ? (lift||0) : 0 }; });
  return t;
}

export function createRenderer(canvas, opts){
  opts=opts||{};
  var ctx=createContext(canvas,{note:opts.note});
  var gl=ctx.gl;
  var trueColour=!!opts.trueColour;
  var SCN=sceneFor(opts.scene||DEFAULT_SCENE, trueColour);

  /* ---------- programs (Barnwright 1688-1693; the derivatives extension BEFORE the FS compiles) ---------- */
  var extDeriv=gl.getExtension("OES_standard_derivatives");
  var progMain=mkProg(gl,VS,trueColour?FSTRUE:FS,ATTRIBS), progDepth=mkProg(gl,VSD,FSD,ATTRIBS);
  var U={}; U_NAMES.forEach(function(n){U[n]=gl.getUniformLocation(progMain,n);});
  var U_STG=gl.getUniformLocation(progMain,"uStg");
  var UD_LVP=gl.getUniformLocation(progDepth,"uLVP"), UD_STG=gl.getUniformLocation(progDepth,"uStg");
  var A_P=ATTRIBS.aP, A_N=ATTRIBS.aN, A_UV=ATTRIBS.aUV, A_ST=ATTRIBS.aStage;

  /* ---------- shadow framebuffer (Barnwright 1695-1710) ---------- */
  var SHSZ=2048, extDepth=gl.getExtension("WEBGL_depth_texture");
  var shadowTex=gl.createTexture(), shadowFB=gl.createFramebuffer(), hasShadow=!!extDepth;
  if(hasShadow){
    gl.bindTexture(gl.TEXTURE_2D,shadowTex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,SHSZ,SHSZ,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);
    var fbok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    if(!fbok)hasShadow=false;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  var shadowCan=hasShadow;   /* whether this device can draw shadows at all */

  /* ---------- the eleven textures, all at once, in Barnwright's order ---------- */
  var TEX=createTextures(gl,{randFor:opts.randFor||opts.rand,seeded:opts.seededTextures});
  var texFlat=TEX.flat;

  /* ---------- watchdog state (Barnwright 4092-4104) ---------- */
  var DPRCAP=2, FCOST=[];
  var FRAMES=0, WARMUP=20, SAMPLES=15, SLOWMS=110, shadowDropped=false, shadowRetry=0, calm=0;

  /* ---------- the building-step table ---------- */
  var STG=new Float32Array(MAX_STAGES*4), stgDirty=true;

  var r={
    canvas:canvas, gl:gl, off:ctx.off, trueColour:trueColour,
    textures:TEX, cam:createCamera(),
    projCache:{}, light:null, needsDraw:true,
    mesh:null, frame:null,
    test:{ freezeWatchdog:false, forceShadow:false, dprCap:null, readPixels:readPixels },
    get scene(){ return SCN; },
    get hasShadow(){ return r.test.forceShadow ? shadowCan : hasShadow; },
    get extDeriv(){ return !!extDeriv; },
    get stageTable(){ return STG.slice(); },
    createMesh:createMesh, deleteMesh:deleteMesh, upload:upload, setFrame:setFrame, show:show,
    draw:draw, setStages:setStages, setScene:setScene,
    startLoop:startLoop, stopLoop:function(){ if(loopStop) loopStop(); }
  };

  /* ---------- buffers (Barnwright uploadBuffers 4081-4089) ----------
     One STATIC buffer per material, in ORDER (the draw order). The drawing
     parameters are copied here, so the build itself is not changed. */
  function createMesh(build){
    var list=[];
    for(var i=0;i<build.ORDER.length;i++){
      var key=build.ORDER[i], b=build.buckets[key];
      if(!b) continue;
      var t=TEX[b.tex];
      if(!t) throw new Error("Material \""+key+"\" wears an unknown texture \""+b.tex+"\" -- use a name from engine/tex-names.js");
      if(!b.v||b.v.length!==b.n*9) throw new Error("Material \""+key+"\" has "+(b.v?b.v.length:"no")+" numbers for "+b.n+" corners -- builds must come from engine/buckets.js (9 numbers a corner)");
      var buf=null;
      if(b.n){ buf=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buf); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.v),gl.STATIC_DRAW); }
      list.push({ key:key, tex:t, tint:b.tint, spec:b.spec, gloss:b.gloss, glow:b.glow, bump:b.bump,
        unlit:b.unlit, noCast:b.noCast, age:b.age, glassM:b.glassM, turf:b.turf, buf:buf, count:b.n });
    }
    return { list:list };
  }
  function deleteMesh(mesh){
    if(!mesh||!mesh.list) return;
    mesh.list.forEach(function(e){ if(e.buf) gl.deleteBuffer(e.buf); e.buf=null; e.count=0; });
    mesh.list=[];
  }
  function upload(build){
    var m=createMesh(build);
    if(r.mesh) deleteMesh(r.mesh);
    r.mesh=m; r.needsDraw=true;
    return m;
  }
  function setFrame(frame){
    r.frame={ bounds:frame.bounds, gr:frame.gr, fitDist:frame.fitDist };
    r.needsDraw=true;
  }
  /* show(result): upload assemble()'s build and take its frame; the camera fit
     it worked out is applied exactly as Barnwright's buildShed -> fitCamera did. */
  function show(result){
    upload(result.build);
    setFrame(result);
    if(result.fitDist!=null) setFitDist(r.cam,result.fitDist);
    return r.mesh;
  }
  function setScene(name){ SCN=sceneFor(name,trueColour); r.needsDraw=true; return SCN; }

  /* ---------- the building-step table ----------
     setStages(table): null = everything shown, nothing lifted (Barnwright).
     table may be { stageKey: { hidden: true|false, lift: feet } } (or
     { shown: false }), or an array indexed by stage id of {hidden, lift} or
     [hidden, lift]. Steps not named are shown and not lifted. An unknown
     step name is an error. Sent to both programs at the next draw. */
  function setStages(table){
    var a=new Float32Array(MAX_STAGES*4);
    function put(i,e){
      if(!e) return;
      if(i<0||i>=MAX_STAGES) throw new Error("setStages: stage id "+i+" out of range");
      var hid=Array.isArray(e)?!!e[0]:(e.hidden===true||e.shown===false);
      var lift=Array.isArray(e)?+e[1]:+(e.lift||0);
      a[i*4]=hid?1:0; a[i*4+1]=lift||0;
    }
    if(table){
      if(Array.isArray(table)) table.forEach(function(e,i){ put(i,e); });
      else Object.keys(table).forEach(function(k){
        var id=STAGE_ID[k];
        if(id===undefined) throw new Error("setStages: unknown stage \""+k+"\" (see parts/stages.js)");
        put(id,table[k]);
      });
    }
    STG=a; stgDirty=true; r.needsDraw=true;
  }

  /* ---------- one frame (Barnwright draw 4105-4222) ----------
     opts (all optional): mesh, frame / bounds / gr / fitDist, cam, size {w,h}
     in CSS pixels, dpr, offscreen (a snapshot: no watchdog, projCache and
     needsDraw left alone). */
  function draw(o){
    o=o||{};
    var cam=o.cam||r.cam, mesh=o.mesh||r.mesh, fr=o.frame||r.frame||{};
    var bd=o.bounds||fr.bounds, GR=(o.gr!==undefined)?o.gr:fr.gr;
    if(!mesh||!bd) return false;
    var fitDist=(o.fitDist!=null)?o.fitDist:cam.fitDist;
    var _t0=(!o.offscreen&&window.performance&&performance.now)?performance.now():0;
    /* 1x desktop screens were drawing the barn at one pixel per pixel, and the
       stair-stepped roof line is a large part of what read as "computer drawing".
       Draw half again bigger and let the browser shrink it -- free anti-aliasing.
       The frame-cost guard below still drops this to 1 on a slow device. */
    var cap=(r.test.dprCap!=null)?r.test.dprCap:DPRCAP;
    var dpr=(o.dpr!=null)?o.dpr:Math.min(cap,Math.max(window.devicePixelRatio||1,1.5));
    var cwc=o.size?o.size.w:canvas.clientWidth, chc=o.size?o.size.h:canvas.clientHeight;
    if(!(cwc>0&&chc>0)) return false;          /* no size (hidden, collapsed): nothing to draw */
    if(canvas.width!==cwc*dpr||canvas.height!==chc*dpr){canvas.width=cwc*dpr;canvas.height=chc*dpr;}
    var H=bd.H;
    var targetY=H*0.42;
    var cp=[cam.dist*Math.cos(cam.pitch)*Math.sin(cam.yaw), targetY+cam.dist*Math.sin(cam.pitch), cam.dist*Math.cos(cam.pitch)*Math.cos(cam.yaw)];
    var view=matLook(cp,[0,targetY,0],[0,1,0]);
    var pers=matPersp(0.55,cwc/chc,1,fitDist*5);
    var vp=matMul(pers,view);
    var LIGHT=sunFromCam(cam); r.light=LIGHT;
    /* The shadow map has to hold the SHADOW, not just the building -- a 12 ft barn
       with the sun 33 degrees up lays down about 18 ft of shade, and a box drawn
       around the building alone chops it off in a straight line halfway across the
       grass. So aim the box at the middle of building-plus-shadow and size it to
       cover both, which also keeps the depth texture tight enough to stay crisp. */
    var shLen=H/Math.max(0.35,Math.tan(SUN_EL));
    var hlen=Math.sqrt(LIGHT[0]*LIGHT[0]+LIGHT[2]*LIGHT[2])||1;
    var ctr=[-LIGHT[0]/hlen*shLen*0.5, targetY, -LIGHT[2]/hlen*shLen*0.5];
    var ext=Math.max(bd.W,bd.L)*0.60+2.5+shLen*0.58;
    var lp=[ctr[0]+LIGHT[0]*62,ctr[1]+LIGHT[1]*62,ctr[2]+LIGHT[2]*62];
    var lvp=matMul(matOrtho(-ext,ext,-ext,ext,8,132),matLook(lp,ctr,[0,1,0]));
    var shadowOn=r.hasShadow;
    var ORDER=mesh.list;

    if(stgDirty){
      gl.useProgram(progDepth); gl.uniform4fv(UD_STG,STG);
      gl.useProgram(progMain); gl.uniform4fv(U_STG,STG);
      stgDirty=false;
    }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    if(shadowOn){
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFB);
      gl.viewport(0,0,SHSZ,SHSZ);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(progDepth);
      gl.uniformMatrix4fv(UD_LVP,false,lvp);
      gl.cullFace(gl.FRONT);
      /* FIX (not in Barnwright): the shadow program reads no normal and no UV,
         but the last frame left those two slots switched on, pointing at the
         last building's buffers. After a rebuild deletes those buffers, WebGL
         refuses EVERY shadow draw ("no buffer is bound to enabled attribute")
         and that frame comes out with no shadows at all -- in Barnwright the
         picture after every colour tap, and the FRONT quote thumbnail, until
         the camera next moves (measured: 11% of the pixels differ from the
         settled frame). Switching them off here costs nothing; the picture
         pass switches them back on for every material. */
      gl.disableVertexAttribArray(A_N); gl.disableVertexAttribArray(A_UV);
      for(var i=0;i<ORDER.length;i++){
        var b=ORDER[i];
        if(!b||b.noCast||!b.count)continue;
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buf);
        gl.enableVertexAttribArray(A_P);
        gl.vertexAttribPointer(A_P,3,gl.FLOAT,false,STRIDE,0);
        gl.enableVertexAttribArray(A_ST);
        gl.vertexAttribPointer(A_ST,1,gl.FLOAT,false,STRIDE,32);
        gl.drawArrays(gl.TRIANGLES,0,b.count);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.useProgram(progMain);
    gl.cullFace(gl.BACK);
    gl.uniformMatrix4fv(U.uVP,false,vp);
    gl.uniformMatrix4fv(U.uLVP,false,lvp);
    gl.uniform3fv(U.uSun,LIGHT);
    gl.uniform3fv(U.uEye,cp);
    gl.uniform1f(U.uShadStr,shadowOn?0.93:0.0);
    var sc9=SCN;
    var fogR=(GR||fitDist*0.5);
    gl.uniform2f(U.uFog,fogR*sc9.fogN,fogR*sc9.fogF);
    gl.uniform3f(U.uFogC,sc9.fogC[0],sc9.fogC[1],sc9.fogC[2]);
    gl.uniform3fv(U.uSky,sc9.sky);
    gl.uniform3fv(U.uAmbLo,sc9.ambLo);
    gl.uniform3fv(U.uAmbHi,sc9.ambHi);
    gl.uniform3fv(U.uBounce,sc9.bounce);
    gl.uniform3fv(U.uSkyG,sc9.skyG||sc9.sky);
    /* only the true-colour shader has these two (the Yoder site's fallbacks) */
    if(U.uEnvUp) gl.uniform3fv(U.uEnvUp,sc9.envUp||ENV_UP_BUILT_IN);
    if(U.uEnvDn) gl.uniform3fv(U.uEnvDn,sc9.envDn||ENV_DN_BUILT_IN);
    gl.uniform1i(U.uTex,0);
    gl.uniform1i(U.uShadow,1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,shadowOn?shadowTex:texFlat);
    gl.activeTexture(gl.TEXTURE0);
    for(var j=0;j<ORDER.length;j++){
      var bb=ORDER[j];
      if(!bb||!bb.count)continue;
      if(bb.unlit){ gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO,gl.SRC_COLOR); gl.depthMask(false); gl.uniform1f(U.uUnlit,1); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); gl.uniform1f(U.uUnlit,0); }
      gl.bindTexture(gl.TEXTURE_2D,bb.tex);
      gl.uniform3fv(U.uTint,bb.tint);
      gl.uniform1f(U.uSpec,bb.spec);
      gl.uniform1f(U.uGloss,bb.gloss);
      gl.uniform1f(U.uGlow,bb.glow||0);
      gl.uniform1f(U.uBump,extDeriv?(bb.bump||0):0);
      gl.uniform1f(U.uAge,bb.age||0);
      gl.uniform1f(U.uGlassM,bb.glassM||0);
      gl.uniform1f(U.uTurf,bb.turf||0);
      gl.bindBuffer(gl.ARRAY_BUFFER,bb.buf);
      gl.enableVertexAttribArray(A_P); gl.vertexAttribPointer(A_P,3,gl.FLOAT,false,STRIDE,0);
      gl.enableVertexAttribArray(A_N); gl.vertexAttribPointer(A_N,3,gl.FLOAT,false,STRIDE,12);
      gl.enableVertexAttribArray(A_UV);gl.vertexAttribPointer(A_UV,2,gl.FLOAT,false,STRIDE,24);
      gl.enableVertexAttribArray(A_ST);gl.vertexAttribPointer(A_ST,1,gl.FLOAT,false,STRIDE,32);
      gl.drawArrays(gl.TRIANGLES,0,bb.count);
    }
    gl.disable(gl.BLEND); gl.depthMask(true);
    if(o.offscreen) return true;
    r.projCache={proj:function(p){
      var x=p[0],y=p[1],z=p[2];
      var c0=vp[0]*x+vp[4]*y+vp[8]*z+vp[12];
      var c1=vp[1]*x+vp[5]*y+vp[9]*z+vp[13];
      var c3=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
      if(c3<=0.001)return null;
      return [(c0/c3*0.5+0.5)*cwc,(1-(c1/c3*0.5+0.5))*chc,c3];
    },cp:cp};
    r.needsDraw=false;
    if(_t0&&!r.test.freezeWatchdog){
      FRAMES++;
      if(FRAMES>WARMUP){                                   /* skip the noisy load frames */
        FCOST.push(performance.now()-_t0);
        if(FCOST.length>SAMPLES)FCOST.shift();
        if(FCOST.length>=SAMPLES){
          var mid=fcMedian(FCOST);
          if(mid>SLOWMS){                                  /* genuinely, steadily slow */
            calm=0;
            if(hasShadow){ hasShadow=false; shadowDropped=true; FCOST.length=0; r.needsDraw=true; }
            else if(DPRCAP>1){ DPRCAP=1; FCOST.length=0; r.needsDraw=true; }
          }else if(mid<SLOWMS*0.45){                       /* running comfortably again */
            calm++;
            if(shadowDropped && !hasShadow && shadowRetry<1 && calm>=SAMPLES){
              hasShadow=true; shadowRetry=1; FCOST.length=0; calm=0; r.needsDraw=true;
            }
          }
        }
      }
    }
    return true;
  }

  /* The picture just drawn, as {w, h, data} (RGBA, bottom row first). Must be
     called in the same task as draw() -- the canvas does not keep its picture. */
  function readPixels(){
    var w=canvas.width, h=canvas.height, data=new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);
    return { w:w, h:h, data:data };
  }

  /* ---------- the animation loop (Barnwright 4682-4721) ---------- */
  var loopStop=null;
  function startLoop(lo){
    if(loopStop) loopStop();
    lo=lo||{};
    var fit=lo.fit||"fitref";
    var reduced=false;
    try{ reduced=matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}
    if(reduced) r.cam.autoSpin=false;
    var SPIN_T0=Date.now();
    /* Wall-clock frame pacing. draw() only times CPU submission, which a busy GPU
       never shows; on phones the real cost lands between rAF ticks. So whenever we
       draw on consecutive ticks (the opening auto-spin guarantees a stretch of
       them), measure the tick-to-tick gap and walk the same degrade ladder the
       CPU watchdog uses: shadows off first, then full-res off. */
    var RAFDT=[],RAF_LAST=0,RAF_DREW=false,running=true,queued=false,onScreen=true;
    function schedule(){ if(running&&!queued){ queued=true; requestAnimationFrame(loop); } }
    function wake(){ RAFDT.length=0; RAF_LAST=0; RAF_DREW=false; r.needsDraw=true; schedule(); }
    /* When this page can't be seen -- a background tab, or the designer's frame
       scrolled out of sight -- there is nothing to animate FOR. The loop stops
       dead and starts again the moment it can be seen. */
    function onVis(){ if(!document.hidden) wake(); }
    document.addEventListener("visibilitychange",onVis);
    var io=null, ro=null;
    if(typeof IntersectionObserver!=="undefined"){
      io=new IntersectionObserver(function(es){ var e=es[es.length-1]; onScreen=!!(e&&e.isIntersecting); if(onScreen) wake(); });
      io.observe(canvas);
    }
    /* A new size re-fits the camera and KEEPS the ground radius of the last
       build (Barnwright's resize handler, 4856). A 0x0 canvas just waits. */
    function onResize(){
      var f=r.frame, w=canvas.clientWidth, h=canvas.clientHeight;
      if(f&&f.bounds&&w>0&&h>0) fitCamera(r.cam,f.bounds.W,f.bounds.L,{w:w,h:h},fit);
      r.needsDraw=true; schedule();
    }
    if(typeof ResizeObserver!=="undefined"){ ro=new ResizeObserver(onResize); ro.observe(canvas); }
    else window.addEventListener("resize",onResize);
    function loop(ts){
      queued=false;
      if(!running) return;
      if(document.hidden||!onScreen){ RAF_DREW=false; RAF_LAST=0; return; }
      var cam=r.cam;
      if(cam.autoSpin&&!cam.interacted){
        if(Date.now()-SPIN_T0>10000) cam.autoSpin=false;
        else {cam.yaw+=0.0035;r.needsDraw=true;}
      }
      if(stepCamera(cam)) r.needsDraw=true;
      if(r.needsDraw){
        if(!r.test.freezeWatchdog&&RAF_DREW&&ts&&RAF_LAST&&ts-RAF_LAST<1000){
          RAFDT.push(ts-RAF_LAST);
          if(RAFDT.length>12)RAFDT.shift();
          if(RAFDT.length>=12&&FRAMES>WARMUP){
            var rm=fcMedian(RAFDT);
            if(rm>70){
              if(hasShadow){ hasShadow=false; shadowDropped=true; RAFDT.length=0; r.needsDraw=true; }
              else if(DPRCAP>1){ DPRCAP=1; RAFDT.length=0; r.needsDraw=true; }
            }
          }
        }
        RAF_DREW=draw()===true;
      } else RAF_DREW=false;
      RAF_LAST=ts||0;
      schedule();
    }
    schedule();
    loopStop=function(){
      running=false; loopStop=null;
      document.removeEventListener("visibilitychange",onVis);
      if(io) io.disconnect();
      if(ro) ro.disconnect(); else window.removeEventListener("resize",onResize);
    };
    return loopStop;
  }

  return r;
}
