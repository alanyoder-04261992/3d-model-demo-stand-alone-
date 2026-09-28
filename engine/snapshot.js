/* PICTURES OF A BUILDING, for thumbnails, the quote e-mail and the parts
   gallery. Browser file.

   The 3D canvas does not keep its picture after the browser shows it
   (preserveDrawingBuffer is off, for speed -- Barnwright's choice), so a
   picture has to be DRAWN AND COPIED IN THE SAME STEP. That is all this file
   does, and it is why nothing here waits or uses a timer.

   snapshotCanvas(renderer, opts) -> a new 2D <canvas> holding the picture
   snapshot(renderer, opts)       -> the same picture as a data URL (PNG by default)

   opts (all optional except what is needed to know what to draw):
     result      assemble()'s answer { build, bounds, gr, fitDist } -- or give
                 build / bounds / gr / fitDist separately. Without a build the
                 renderer's current building is used.
     size        { w, h } of the picture in CSS pixels (default: the canvas's
                 own size, or 600 x 420 like Barnwright when it has none)
     dpr         pixels per CSS pixel in the picture (default 1)
     cam         { yaw, pitch, dist } for this picture only; anything left out
                 comes from the renderer's camera, and dist defaults to the
                 fit distance (so the building fills the picture the usual way)
     background  null (see-through, the default), "fog" (the scene's haze
                 colour, which is what Barnwright filled its thumbnails with)
                 or any CSS colour
     type, quality  for the data URL (default "image/png")
     restore     redraw the live picture afterwards (default true), so the
                 on-screen canvas never flashes the snapshot

   Without WebGL (the renderer's `off`) there is no picture to take, and it
   says so by throwing a plain error rather than handing back a blank image.

   The building drawn for a snapshot gets its own buffers on the card and they
   are deleted at the end, so the building on screen is not disturbed. The
   camera on screen is not moved. A 2x2 of front / right / back / left (the
   quote thumbnail) is four snapshotCanvas calls drawn onto one canvas --
   the UI does that. */

import { createCamera } from "./camera.js";

export function snapshotCanvas(renderer, opts){
  opts=opts||{};
  if(renderer.off) throw new Error("snapshot: this browser has no WebGL, so there is no 3D picture to take");
  var res=opts.result||{};
  var build=opts.build||res.build||null;
  var bounds=opts.bounds||res.bounds||(renderer.frame&&renderer.frame.bounds);
  var gr=(opts.gr!==undefined)?opts.gr:(res.gr!==undefined?res.gr:(renderer.frame&&renderer.frame.gr));
  var fitDist=(opts.fitDist!=null)?opts.fitDist:(res.fitDist!=null?res.fitDist:renderer.cam.fitDist);
  var cv=renderer.canvas;
  var size=opts.size||{ w:cv.clientWidth||600, h:cv.clientHeight||420 };
  var dpr=(opts.dpr!=null)?opts.dpr:1;
  var c=opts.cam||{};
  var cam=createCamera();
  cam.yaw=(c.yaw!=null)?c.yaw:renderer.cam.yaw;
  cam.pitch=(c.pitch!=null)?c.pitch:renderer.cam.pitch;
  cam.fitDist=fitDist;
  cam.dist=(c.dist!=null)?c.dist:fitDist;
  var mesh=build?renderer.createMesh(build):renderer.mesh;
  var out=document.createElement("canvas");
  try{
    if(!mesh||!bounds) throw new Error("snapshot: nothing to draw (give a result/build and its bounds)");
    var ok=renderer.draw({ mesh:mesh, bounds:bounds, gr:gr, fitDist:fitDist, cam:cam, size:size, dpr:dpr, offscreen:true });
    if(!ok) throw new Error("snapshot: the renderer could not draw (no WebGL?)");
    /* same task as the draw: the picture is still in the canvas */
    out.width=cv.width; out.height=cv.height;
    var x=out.getContext("2d");
    var bg=opts.background;
    if(bg){
      if(bg==="fog"){ var f=renderer.scene.fogC; bg="rgb("+Math.round(f[0]*255)+","+Math.round(f[1]*255)+","+Math.round(f[2]*255)+")"; }
      x.fillStyle=bg; x.fillRect(0,0,out.width,out.height);
    }
    x.drawImage(cv,0,0);
  }finally{
    if(build&&mesh) renderer.deleteMesh(mesh);
    renderer.needsDraw=true;
    if(opts.restore!==false&&renderer.mesh&&renderer.frame){ try{ renderer.draw(); }catch(e){} }
  }
  return out;
}

export function snapshot(renderer, opts){
  opts=opts||{};
  var c=snapshotCanvas(renderer,opts);
  return c.toDataURL(opts.type||"image/png",opts.quality);
}
