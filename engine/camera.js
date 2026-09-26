/* THE CAMERA: how far back it stands so the whole building fits, which way
   it faces, and the smooth turn when the designer swings round to face a
   door or window. Node-safe: plain numbers, nothing touches the page -- the
   one thing Barnwright's camera did to the page (hiding the "drag to turn"
   hint when the camera glides) is a callback here, cam.onInteract.

   fitDistFor(W, L, {w, h}, mode) -- how far back the camera stands for a W x L
     building on a picture w x h CSS pixels. Pure.
     mode "barnwright": Barnwright's fitCamera (3ddesign.html 3818-3824):
       max(W, 0.85 L) x 1.85 + 14 feet, times 1.16 when the picture is more
       than 5% taller than it is wide. Used by the golden and look tests.
     mode "fitref" (the default): the Yoder site's fix (design.html
       4103-4140, Sep 2026, Alan on an iPad: "the building is zoom in to
       far"). The 1.16 is one fixed step -- a CLIFF: 5% taller gets it, 4%
       gets nothing -- and an iPad's 4:3 picture is far taller for its width
       than a desktop's, so a 10x20 went off both edges. Now a picture
       narrower for its height than the 1440x900 desktop's (742 x 803) is
       backed off until it leaves exactly the desktop's room across. The two
       modes give the same number at 1440x900, where the look tests run.

   createCamera()  -- Barnwright's opening view: yaw 0.62 (about 35 degrees
     round from the front), pitch 0.215 (about 12 degrees down -- standing in
     the yard, not a drone shot), 46 ft back until the first fit.
   fitCamera(cam, W, L, view, mode) -- set cam.fitDist; reset the distance to
     it until the customer has touched the camera (cam.interacted), and keep
     the distance between 0.55 and 1.9 times it either way.
   setFitDist(cam, fitDist) -- the same, for a fit already worked out (the
     renderer's show() uses the one assemble() returns).
   animYaw(cam, yaw, pitch, clock) + stepCamera(cam) -- the 420 ms ease-out
     glide round to a wall (shortest way round; pitch kept between 0.08 and
     1.05). The render loop calls stepCamera every frame; `clock` is only for
     tests (default Date.now).
   wallYaw(it, plan, cam) -- the camera yaw that faces an item's wall.
   norm2pi(a) -- an angle wrapped into (-pi, pi]. */

/* The picture on a 1440x900 desktop is 742 wide by 803 tall and gets the 1.16;
   their product is how much room a desktop leaves across the barn. */
export const FIT_REF = 1.16*742/803;

export function fitDistFor(W, L, view, mode) {
  var cw = view ? view.w : 0, ch = view ? view.h : 0;
  if ((mode || "fitref") === "barnwright") {
    var span=Math.max(W,L*0.85);
    var fitDist=span*1.85+14;
    if(ch>cw*1.05) fitDist*=1.16;
    return fitDist;
  }
  if (mode && mode !== "fitref") throw new Error("fitDistFor: unknown mode " + mode);
  var span2=Math.max(W,L*0.85), base=span2*1.85+14;
  var fd=base;
  if(ch>cw*1.05) fd*=1.16;
  /* NO SCREEN SHOWS THE BARN WIDER THAN A DESKTOP DOES. The 0.1% is so a
     picture ALREADY at the yardstick keeps its old number to the last digit. */
  if(cw>0&&ch>0){
    var need=base*FIT_REF*ch/cw;
    if(need>fd*1.001) fd=need;
  }
  return fd;
}

export function createCamera() {
  return {
    yaw:0.62, pitch:0.215, dist:46, fitDist:46,
    interacted:false,    /* the customer has turned or zoomed: stop auto-fit and auto-spin */
    autoSpin:true,       /* the opening 10 s turntable (the render loop turns it off for reduced motion) */
    anim:null,           /* the glide in progress, if any */
    onInteract:null      /* called when a glide starts (Barnwright hid the #hint here) */
  };
}

export function fitCamera(cam, W, L, view, mode) {
  return setFitDist(cam, fitDistFor(W, L, view, mode));
}

/* The second half of Barnwright's fitCamera, for a fit distance already worked
   out (assemble() returns one): reset the distance to it until the customer
   has touched the camera, and keep it between 0.55 and 1.9 times it. */
export function setFitDist(cam, fitDist) {
  cam.fitDist=fitDist;
  if(!cam.interacted) cam.dist=cam.fitDist;
  cam.dist=Math.max(cam.fitDist*0.55,Math.min(cam.fitDist*1.9,cam.dist));
  return cam.fitDist;
}

export function norm2pi(a){ while(a>Math.PI)a-=2*Math.PI; while(a<-Math.PI)a+=2*Math.PI; return a; }

/* Glide to targetYaw (the short way round) and targetPitch (null keeps the
   pitch). `clock` returns milliseconds (Date.now unless a test hands one in). */
export function animYaw(cam,targetYaw,targetPitch,clock){
  var now=clock||Date.now;
  cam.interacted=true; cam.autoSpin=false; if(cam.onInteract) cam.onInteract();
  var ya=cam.yaw, pa=cam.pitch, dy=norm2pi(targetYaw-ya), dp=(targetPitch==null?pa:targetPitch)-pa, t0=now();
  if(Math.abs(dy)<0.02&&Math.abs(dp)<0.02){cam.anim=null;return;}
  cam.anim={step:function(){
    var k=Math.min(1,(now()-t0)/420), e=1-Math.pow(1-k,3);   /* ease-out glide */
    cam.yaw=ya+dy*e; cam.pitch=Math.max(0.08,Math.min(1.05,pa+dp*e));
    if(k>=1)cam.anim=null;
  }};
}

/* One frame of the glide. True when the camera moved (so draw again). */
export function stepCamera(cam){
  if(!cam.anim) return false;
  cam.anim.step();
  return true;
}

/* The yaw that faces an item: its wall's outward normal; porch posts face
   across a side porch. (Barnwright 4238-4243; T() -> plan.t, wallDefs() ->
   plan.ws, CAT -> plan.CAT.) An eye at yaw atan2(nx, nz) is on the +n side. */
export function wallYaw(it, plan, cam){
  var c=plan.CAT[it.cat];
  if(c.k==="post"){ return (plan.t.porch==="R"||plan.t.porch==="S"||(plan.t.porch==="C"&&it.wall==="R"))? Math.PI/2 : 0; }
  var w=plan.ws[it.wall];
  if(w&&w.n) return Math.atan2(w.n[0],w.n[2]);
  return cam.yaw;
}
