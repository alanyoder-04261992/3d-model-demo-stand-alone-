/* THE SUN AND THE BACKDROP, for the page. Browser file (paintBackdrop writes
   to the page); the numbers themselves live in engine/scene-data.js.

   sunFromCam(cam) -- where the sun is for the camera as it stands right now.
     It sits 66 degrees over the viewer's left shoulder and 33 degrees up and
     follows the camera round (Barnwright 1447-1450). Returns the direction
     TOWARD the sun as [x, y, z]; the renderer calls it at every frame.

   paintBackdrop(el, scene) -- the 3D canvas is see-through, so the gradient
     behind it IS the sky/backdrop. This paints the setting's gradient on the
     element behind the canvas (Barnwright paints `.stage`). The haze colour
     in the same setting was chosen to match this gradient's flat bottom
     exactly, so change them together or a line appears where the floor
     meets the wall. */

import { SUN_OFF, SUN_EL } from "./scene-data.js";

export { SUN_OFF, SUN_EL };

export function sunFromCam(cam){
  var az=cam.yaw+SUN_OFF, ce=Math.cos(SUN_EL);
  return [Math.sin(az)*ce, Math.sin(SUN_EL), Math.cos(az)*ce];
}

export function paintBackdrop(el, scene){
  try{ el.style.background=scene.stage; }catch(e){}
}
