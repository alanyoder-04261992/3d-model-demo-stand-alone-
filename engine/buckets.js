/* THE TOOLBOX EVERY PART DRAWS WITH. Node-safe: no DOM, no WebGL.

   A building is drawn as thousands of flat triangles. Triangles that wear the
   same paint and the same surface picture are collected in one "bucket" (one
   per material: "body" for the siding, "trim", "glass" ...), and the renderer
   later sends each bucket to the graphics card in one go.

     const build = createBuild({ sel });   // an empty drawing
     const kit = makeKit(build, { constants, view: { fitDist, scene }, STEP });

   `build` is a plain value: { buckets, ORDER, hitQuads, tags, stage, part,
   item, sel }. Two builds never share anything, so the parts gallery, the
   thumbnails and the checks can each draw their own. `kit` is a frozen object
   of drawing functions that all write into that one build.

   WHAT THE KIT CARRIES (Barnwright's names and Barnwright's arithmetic, lifted
   from 3ddesign.html lines 2071-2144 and 2428-2433):
     MAT DECAL mat            make or reuse a material bucket
     pushTri pushQuad quadUV  raw triangles
     box                      an upright box (skids, slabs, hardware)
     wq wbrace wtri3          a rectangle / slanted board / triangle on a WALL
     gq2 gbrace2              a polygon / slanted board on a GABLE end
     wallPt                   wall coordinates -> world (engine/wall.js)
   and, new here:
     beam(b,p0,p1,w,d,up)     one piece of lumber, for the framing view
     setStage(key)            which building step the next triangles belong to
     setItem(id)              which door or window is being drawn (glow on the selected one)
     hit(id,n,pts)            a tap target for picking that item
     part(id,fn)              which real part the triangles inside fn belong to
     STEP constants view      the groove/rib spacing, the shared numbers, the camera fit

   THREE RULES THAT DECIDE WHAT THE PICTURE LOOKS LIKE, kept from Barnwright:
   1. MAT is FIRST CALL WINS. A second MAT (or mat) with the same key hands
      back the first bucket and ignores the new paint -- and ORDER, the order
      buckets were first made, is the order they are drawn in. Barnwright has
      duplicate keys with different paints, so the order parts run in decides
      which paint shows. Do not "fix" this.
   2. A triangle faces the side it is wound anticlockwise from; the back of it
      is invisible. wq faces OUTWARD when u0<u1 and y0<y1.
   3. wtri3 swaps two entries of the caller's own uvs array when it flips a
      triangle's winding. Callers rely on it; keep it.

   WHAT IS DIFFERENT FROM BARNWRIGHT, and changes no picture:
   * Each corner of a triangle is 9 numbers, not 8: x y z, the normal, u v,
     and the building STEP it belongs to (parts/stages.js). The shaders use
     that last number to hide a step or lower it into place during the
     Watch-it-build playback. A triangle drawn before any setStage() is an
     error -- every triangle must say which step of the build it is.
   * Which real PART each triangle came from is kept beside the bucket, in
     build.tags[bucketKey] = [{ part, from, count }] (triangle numbers, runs
     of the same part merged). The innermost part() wins. Triangles drawn
     outside any part() are recorded with part null. When part() ends it
     also puts back the step that was current when it began, so one part can
     never leave its step switched on for whatever is drawn next.
   * build.item / build.sel replace Barnwright's CURIT / state.sel. */

import * as CONSTANTS from "./constants.js";
import { wallPt } from "./wall.js";
import { norm3, sub3, cross3, dot3, hexRGB, srgbLin } from "./math.js";
import { stageId } from "../parts/stages.js";

/* An empty drawing. `sel` is the id of the selected door/window (it glows). */
export function createBuild(opts) {
  var sel = opts && opts.sel !== undefined ? opts.sel : null;
  return { buckets: {}, ORDER: [], hitQuads: [], tags: {}, stage: null, part: null, item: null, sel: sel };
}

export function makeKit(build, opts) {
  opts = opts || {};
  var C = opts.constants || CONSTANTS;
  var GROOVE = C.GROOVE;
  var STEP = opts.STEP !== undefined ? opts.STEP : GROOVE;
  var view = Object.freeze(Object.assign({}, opts.view || {}));
  var buckets = build.buckets, ORDER = build.ORDER;
  var keyOf = new WeakMap();          /* bucket object -> its key, for the part tags */
  var STG = null;                     /* the current stage id (the 9th number) */
  var parts = [];                     /* part() nesting; the last one is the innermost */

  /* ---------- materials (Barnwright 2071-2081, 2430-2433) ---------- */
  function MAT(key,tex,tint,spec,gloss,glow,bump){
    if(!buckets[key]){buckets[key]={tex:tex,tint:tint,spec:spec||0,gloss:gloss||24,glow:glow||0,bump:bump||0,v:[],n:0};ORDER.push(key);keyOf.set(buckets[key],key);build.tags[key]=[];}
    return buckets[key];
  }
  /* unlit multiply decal bucket: darkens whatever is behind it (contact shadows, AO) */
  function DECAL(key,tex){
    var m=MAT(key,tex,[1,1,1],0,8,0,0);
    m.noCast=true; m.unlit=true;
    return m;
  }
  /* hex paint -> linear tint; the selected item's parts get their own glowing bucket */
  function mat(base,tex,tint,spec,gloss,bump){
    var g=(build.item&&build.item===build.sel)?1:0;
    var t=(typeof tint==="string")?[srgbLin(hexRGB(tint)[0]),srgbLin(hexRGB(tint)[1]),srgbLin(hexRGB(tint)[2])]:tint;
    return MAT(base+(g?"!==g":""),tex,t,spec||0,gloss||24,g,bump||0);
  }

  /* ---------- triangles (Barnwright 2082-2092, plus the stage and part tag) ---------- */
  function pushTri(b,p0,p1,p2,uv0,uv1,uv2){
    if(STG===null) throw new Error("Drawing before setStage(): every triangle must say which building step it belongs to.");
    var n=norm3(cross3(sub3(p1,p0),sub3(p2,p0)));
    [[p0,uv0],[p1,uv1],[p2,uv2]].forEach(function(q){
      b.v.push(q[0][0],q[0][1],q[0][2], n[0],n[1],n[2], q[1][0],q[1][1], STG);
    });
    tagTri(b,b.n/3);
    b.n+=3;
  }
  function pushQuad(b,p0,p1,p2,p3,u0,u1,u2,u3){
    pushTri(b,p0,p1,p2,u0,u1,u2); pushTri(b,p0,p2,p3,u0,u2,u3);
  }
  function quadUV(b,pts,us){ pushQuad(b,pts[0],pts[1],pts[2],pts[3],us[0],us[1],us[2],us[3]); }

  /* ---------- solids and wall/gable helpers (Barnwright 2093-2144, unchanged) ---------- */
  function box(b,cx,y0b,cz,w,h,d,uvs){
    var x0=cx-w/2,x1=cx+w/2,y1=y0b+h,z0=cz-d/2,z1=cz+d/2,s=uvs||0.8;
    pushQuad(b,[x0,y0b,z1],[x1,y0b,z1],[x1,y1,z1],[x0,y1,z1],[0,0],[w/s,0],[w/s,h/s],[0,h/s]);
    pushQuad(b,[x1,y0b,z0],[x0,y0b,z0],[x0,y1,z0],[x1,y1,z0],[0,0],[w/s,0],[w/s,h/s],[0,h/s]);
    pushQuad(b,[x1,y0b,z1],[x1,y0b,z0],[x1,y1,z0],[x1,y1,z1],[0,0],[d/s,0],[d/s,h/s],[0,h/s]);
    pushQuad(b,[x0,y0b,z0],[x0,y0b,z1],[x0,y1,z1],[x0,y1,z0],[0,0],[d/s,0],[d/s,h/s],[0,h/s]);
    pushQuad(b,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,0],[w/s,0],[w/s,d/s],[0,d/s]);
    pushQuad(b,[x0,y0b,z0],[x1,y0b,z0],[x1,y0b,z1],[x0,y0b,z1],[0,0],[w/s,0],[w/s,d/s],[0,d/s]);
  }
  /* quad on a wall in (u,y) coords at offset o */
  function wq(b,w,u0,y0_,u1,y1_,o,uvMode){
    var p=[wallPt(w,u0,y0_,o),wallPt(w,u1,y0_,o),wallPt(w,u1,y1_,o),wallPt(w,u0,y1_,o)];
    var us = uvMode==="sid"? [[u0/GROOVE,y0_/2.6],[u1/GROOVE,y0_/2.6],[u1/GROOVE,y1_/2.6],[u0/GROOVE,y1_/2.6]]
           : uvMode==="glass"? [[0.03,0.03],[0.97,0.03],[0.97,0.97],[0.03,0.97]]
           : [[0,0],[(u1-u0)/0.8,0],[(u1-u0)/0.8,(y1_-y0_)/0.8],[0,(y1_-y0_)/0.8]];
    quadUV(b,p,us);
  }
  /* slanted board on a wall between two (u,y) points */
  function wbrace(b,w,u1,y1_,u2,y2_,th,o){
    var du=u2-u1,dy=y2_-y1_,l=Math.sqrt(du*du+dy*dy)||1;
    var px=-dy/l*th/2, py=du/l*th/2;
    quadUV(b,[wallPt(w,u1-px,y1_-py,o),wallPt(w,u2-px,y2_-py,o),wallPt(w,u2+px,y2_+py,o),wallPt(w,u1+px,y1_+py,o)],
      [[0,0],[l/0.8,0],[l/0.8,th/0.8],[0,th/0.8]]);
  }
  /* filled triangle on a wall in (u,y) coords at offset o */
  function wtri3(b,w,p0,p1,p2,o,uvs){
    var cr=(p1[0]-p0[0])*(p2[1]-p0[1])-(p1[1]-p0[1])*(p2[0]-p0[0]);
    if(cr<0){var tmp=p1;p1=p2;p2=tmp;if(uvs){var tu=uvs[1];uvs[1]=uvs[2];uvs[2]=tu;}}
    var us=uvs||[[p0[0]/0.8,p0[1]/0.8],[p1[0]/0.8,p1[1]/0.8],[p2[0]/0.8,p2[1]/0.8]];
    pushTri(b,wallPt(w,p0[0],p0[1],o),wallPt(w,p1[0],p1[1],o),wallPt(w,p2[0],p2[1],o),us[0],us[1],us[2]);
  }
  /* quad on a gable plane */
  function gq2(b,pts,gz,sgn,o,uvMode){
    var q=pts.map(function(p){return [p[0],p[1],gz+sgn*o];});
    if(sgn<0)q=q.slice().reverse();
    var us;
    if(uvMode==="sid")us=q.map(function(p){return [p[0]/GROOVE,p[1]/2.6];});
    else if(uvMode==="glass"){
      if(q.length===4)us=[[0.03,0.03],[0.97,0.03],[0.97,0.97],[0.03,0.97]];
      else{var mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
        q.forEach(function(p){mnx=Math.min(mnx,p[0]);mxx=Math.max(mxx,p[0]);mny=Math.min(mny,p[1]);mxy=Math.max(mxy,p[1]);});
        us=q.map(function(p){return [0.03+0.94*(p[0]-mnx)/((mxx-mnx)||1),0.03+0.94*(p[1]-mny)/((mxy-mny)||1)];});}
    }
    else us=q.map(function(p){return [p[0]/0.8,p[1]/0.8];});
    if(q.length===4)quadUV(b,q,us);
    else{for(var i=1;i<q.length-1;i++)pushTri(b,q[0],q[i],q[i+1],us[0],us[i],us[i+1]);}
  }
  function gbrace2(b,x1,y1_,x2,y2_,th,gz,sgn,o){
    var du=x2-x1,dy=y2_-y1_,l=Math.sqrt(du*du+dy*dy)||1;
    var px=-dy/l*th/2, py=du/l*th/2;
    gq2(b,[[x1-px,y1_-py],[x2-px,y2_-py],[x2+px,y2_+py],[x1+px,y1_+py]],gz,sgn,o);
  }

  /* ---------- NEW: one piece of lumber, for the framing view ----------
     A closed six-sided board from p0 to p1 (the ends of its length).
     `d` is measured along `up` and `w` across it: for a floor joist with
     up = [0,1,0], d is the 5 1/2 in you see from the side and w the 1 1/2 in
     you see from above; for a stud, up = the wall's outward normal. `up` only
     has to be roughly right -- it is squared up against the board's length.
     Every face is wound to face OUTWARD, so it shades and casts shadows like
     any other solid. UVs run 0.8 ft per tile along the board, like box(). */
  function beam(b,p0,p1,w,d,up){
    var ax=norm3(sub3(p1,p0)), len=Math.sqrt(dot3(sub3(p1,p0),sub3(p1,p0)));
    var u=up||[0,1,0], k=dot3(u,ax);
    u=[u[0]-ax[0]*k,u[1]-ax[1]*k,u[2]-ax[2]*k];
    if(dot3(u,u)<1e-12){ u=Math.abs(ax[1])<0.9?[0,1,0]:[1,0,0]; k=dot3(u,ax); u=[u[0]-ax[0]*k,u[1]-ax[1]*k,u[2]-ax[2]*k]; }
    u=norm3(u);
    var s=norm3(cross3(ax,u));
    function at(p,i,j){ return [p[0]+s[0]*w/2*i+u[0]*d/2*j, p[1]+s[1]*w/2*i+u[1]*d/2*j, p[2]+s[2]*w/2*i+u[2]*d/2*j]; }
    var mid=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2];
    /* each face: its four corners and its size across (for the UVs) */
    var faces=[
      [at(p0,-1,1),at(p1,-1,1),at(p1,1,1),at(p0,1,1),len,w],       /* top    (+up)   */
      [at(p0,1,-1),at(p1,1,-1),at(p1,-1,-1),at(p0,-1,-1),len,w],   /* bottom (-up)   */
      [at(p0,1,1),at(p1,1,1),at(p1,1,-1),at(p0,1,-1),len,d],       /* side   (+s)    */
      [at(p0,-1,-1),at(p1,-1,-1),at(p1,-1,1),at(p0,-1,1),len,d],   /* side   (-s)    */
      [at(p1,-1,-1),at(p1,1,-1),at(p1,1,1),at(p1,-1,1),w,d],       /* end at p1      */
      [at(p0,1,-1),at(p0,-1,-1),at(p0,-1,1),at(p0,1,1),w,d]        /* end at p0      */
    ];
    faces.forEach(function(f){
      var q=[f[0],f[1],f[2],f[3]];
      var c=[(q[0][0]+q[2][0])/2,(q[0][1]+q[2][1])/2,(q[0][2]+q[2][2])/2];
      if(dot3(cross3(sub3(q[1],q[0]),sub3(q[2],q[0])),sub3(c,mid))<0) q.reverse();
      var a=f[4]/0.8, e=f[5]/0.8;
      quadUV(b,q,[[0,0],[a,0],[a,e],[0,e]]);
    });
  }

  /* ---------- stage, item, picking and part tags ---------- */
  function setStage(key){ STG=stageId(key); build.stage=key; }
  function setItem(id){ build.item=(id===undefined)?null:id; }
  function hit(id,n,pts){ build.hitQuads.push({id:id,n:n,pts:pts,stage:build.stage}); }
  function part(id,fn){
    var st=build.stage, sid=STG;
    parts.push(id); build.part=id;
    try{ return fn(); }
    finally{
      parts.pop(); build.part=parts.length?parts[parts.length-1]:null;
      build.stage=st; STG=sid;      /* a part cannot leak its stage into what runs after it */
    }
  }
  function tagTri(b,tri){
    var key=keyOf.get(b);
    if(key===undefined) throw new Error("pushTri on a bucket this build did not make (use MAT/mat/DECAL of the same kit).");
    var segs=build.tags[key], p=parts.length?parts[parts.length-1]:null, last=segs[segs.length-1];
    if(last&&last.part===p&&last.from+last.count===tri) last.count++;
    else segs.push({part:p,from:tri,count:1});
  }

  return Object.freeze({
    MAT: MAT, DECAL: DECAL, mat: mat,
    pushTri: pushTri, pushQuad: pushQuad, quadUV: quadUV, box: box,
    wq: wq, wbrace: wbrace, wtri3: wtri3, gq2: gq2, gbrace2: gbrace2, wallPt: wallPt,
    beam: beam,
    setStage: setStage, setItem: setItem, hit: hit, part: part,
    STEP: STEP, constants: C, view: view,
    get item(){ return build.item; },
    get sel(){ return build.sel; },
    get stage(){ return build.stage; },
    get currentPart(){ return build.part; }
  });
}
