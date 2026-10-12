/* THE DRAWING HALF OF "YOUR BUILDINGS": its own file, loaded only when a
   picture is missing (ui/office/views/price-list/pictures.js imports it by
   a name kept in a variable, so the Dealer Center's main file never carries
   the 3D engine). tools/build-site.mjs builds it on its own and stamps its
   hash into the main file as __PICTURES_ID__.

   startPictures() -> {
     off      true when this browser has no WebGL (the cards keep the
              standard pictures)
     draw(cat, key, {w, h, dpr}) -> a JPEG Blob of that building as the
              business's 3D designer opens on it (model/picture-key.js
              pictureState), from the opening view on the studio backdrop
     lost     true once the browser took the graphics away (an iPhone does
              that in the background); start a new one then
     close()  gives the graphics back and removes the hidden canvas
   }

   One hidden renderer for the whole page. Each picture is drawn and copied
   in the same step (engine/snapshot.js). */

import { createRenderer, stageTableFor } from "../../engine/renderer.js";
import { assemble } from "../../engine/assemble.js";
import { snapshotCanvas } from "../../engine/snapshot.js";
import { makePlan } from "../../model/plan.js";
import { pictureState, PICTURE_CAMERA, PICTURE_BACKDROP } from "../../model/picture-key.js";

export function startPictures() {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.pictureRenderer = "";
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:2px;height:2px;pointer-events:none;opacity:0";
  document.body.appendChild(host);
  let cv = null, renderer = null, currentLook = null, closed = false;
  const api = { off: false, lost: false };

  function dropRenderer() {
    try { renderer?.stopLoop(); renderer?.gl?.getExtension("WEBGL_lose_context")?.loseContext(); } catch { /* already gone */ }
    renderer = null;
    cv = null;
    host.replaceChildren();
  }

  function rendererFor(cat) {
    const trueColour = !!(cat.look && cat.look.trueColour);
    const key = trueColour ? "true" : "warm";
    if (renderer && currentLook === key) return renderer;
    dropRenderer();
    cv = document.createElement("canvas");
    cv.width = 2; cv.height = 2;
    cv.addEventListener("webglcontextlost", (e) => { e.preventDefault(); if (!closed && e.target === cv) api.lost = true; });
    host.appendChild(cv);
    renderer = createRenderer(cv, { trueColour, scene: "studio", note: " " });
    renderer.test.freezeWatchdog = true;
    renderer.cam.autoSpin = false;
    renderer.cam.interacted = true;
    currentLook = key;
    if (renderer.off) api.off = true;
    return renderer;
  }

  api.draw = async function draw(cat, key, { w, h, dpr = 1 }) {
    if (closed) throw new Error("The pictures have been closed.");
    if (api.lost) throw new Error("The browser took the graphics away. Start again.");
    const r = rendererFor(cat);
    if (r.off) { api.off = true; throw new Error("This browser has no WebGL."); }
    const plan = makePlan(pictureState(cat, key), cat);
    const size = { w, h };
    const result = assemble(plan, { viewport: size, fit: PICTURE_CAMERA.fit, scene: "studio", trueColour: !!(cat.look && cat.look.trueColour), frames: false });
    r.setScene("studio");
    r.setStages(stageTableFor("finished"));
    const pic = snapshotCanvas(r, { result, size, dpr, cam: { yaw: PICTURE_CAMERA.yaw, pitch: PICTURE_CAMERA.pitch }, background: PICTURE_BACKDROP, restore: false });
    return await new Promise((done, fail) => pic.toBlob((b) => (!closed && !api.lost && b ? done(b) : fail(new Error("The picture could not be made."))), "image/jpeg", 0.85));
  };

  api.close = function close() {
    closed = true;
    dropRenderer();
    host.remove();
  };
  return api;
}
