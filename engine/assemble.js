/* PUT A WHOLE BUILDING TOGETHER. Node-safe: no DOM, no WebGL.

   assemble(plan, opts) is Barnwright's buildShed (3ddesign.html lines
   3854-4078) with the drawing taken out and handed to the parts: it makes an
   empty drawing, works out the camera fit, makes the five core materials
   exactly as Barnwright does, and then runs every part in PIPELINE order
   (parts/index.js). Only the orchestration lives here -- every triangle is
   drawn by a part.

     const r = assemble(plan, {
       viewport: { w, h },     // the 3D picture's size in CSS pixels (the camera fit needs it)
       fit: "fitref",          // "fitref" (the product) or "barnwright" (the golden and look checks)
       scene: "studio",        // studio | yard | paper (default: the company's look.scene, else studio)
       trueColour: false,      // the true-colour scene (default: the company's look.trueColour)
       frames: false,          // also draw the NEW framing parts (Framing view, Watch-it-build)
       only: null,             // a part id, or a list of them: keep only their triangles
     });
     r = { build, ORDER, gr, fitDist, bounds: { W, L, H } }

   * build   -- the drawing (engine/buckets.js createBuild): buckets, ORDER,
                hitQuads, tags (which part each triangle came from).
   * fitDist -- how far back the camera stands (engine/camera.js fitDistFor).
   * gr      -- the lawn's radius, returned by the ground part (Barnwright's
                window.__GR); the renderer's haze is sized from it.
   * bounds  -- W and L of the building (L includes the corner porch's 4 ft, as
                Barnwright's dims() does) and H = y0 + wallH + roofRise(W),
                added in THAT order: the renderer aims the camera at H x 0.42
                and sizes the shadow box from H, and adding in another order
                changes the last digit.

   ONE KIT PER BUILD. The kit (the drawing toolbox) is made here, once, and
   every part draws with it; a part never makes its own.

   THE CORE MATERIALS are made before any part runs, in Barnwright's order and
   with Barnwright's settings (3862-3867), and handed to every part as the
   third argument of build(plan, kit, core) under Barnwright's own names:
   core.mB (body), core.mT (trim), core.mWd (wood), core.mSk (skid) and
   core.mFlr ("kfloor" on a kennel, else the wood bucket). They are made
   first because materials are drawn in the order they are first made, and
   the first call for a key decides its paint (parts/README.md).

   EACH ENTRY RUNS INSIDE kit.part(<its part id>), so every triangle it draws
   is attributed to that part unless the part wraps some in another
   kit.part(...), and each entry starts with no building step set (kit.part
   puts the step back when it ends): a part must call kit.setStage first.

   `frames: true` runs the frame entries (NEW framing) after all the finished
   ones, so the finished part of the drawing is identical either way.

   `only` is NOT a smaller build: the whole building is drawn and then every
   triangle not attributed to one of those parts is left out. A part shown on
   its own therefore keeps exactly the materials (paint, order) it has on the
   whole building. The tap targets are left out of such a build (a part on
   its own is for looking at). */

import { createBuild, makeKit } from "./buckets.js";
import { fitDistFor } from "./camera.js";
import { sceneFor, DEFAULT_SCENE } from "./scene-data.js";
import { y0 } from "./constants.js";
import { texSiding, texMetal, texTrim, texFlat } from "./tex-names.js";
import { roofRise } from "../model/roof-shapes.js";
import { PIPELINE } from "../parts/index.js";

export function assemble(plan, opts) {
  opts = opts || {};
  var viewport = opts.viewport || { w: 0, h: 0 };
  var look = plan.look || {};
  var trueColour = (opts.trueColour != null) ? !!opts.trueColour : !!look.trueColour;
  var sceneName = opts.scene || look.scene || DEFAULT_SCENE;
  var scene = sceneFor(sceneName, trueColour);

  /* reset (Barnwright: buckets={}; ORDER=[]; hitQuads=[]) */
  var build = createBuild({ sel: plan.state.sel });
  var W = plan.W, L = plan.L, t = plan.t, state = plan.state;

  /* fitCamera(W,L) -- before the lawn, whose radius uses the fit */
  var fitDist = fitDistFor(W, L, viewport, opts.fit || "fitref");
  var kit = makeKit(build, { STEP: plan.STEP, view: { fitDist: fitDist, scene: scene } });

  /* the core materials, Barnwright 3862-3867 */
  var mB=kit.mat("body",t.metal?texMetal:texSiding,state.body,t.metal?0.5:0.06,t.metal?40:14,t.metal?1.1:0.6);
  mB.age=t.metal?3:4;
  var mT=kit.mat("trim",texTrim,state.trim,0.10,20,0.12);
  var mWd=kit.mat("wood",texFlat,"#6f5c42",0.04,10);
  var mSk=kit.mat("skid",texFlat,"#6d5f49",0.04,10);
  var mFlr=t.kennel? kit.mat("kfloor",texFlat,"#8f9599",0.18,20) : mWd;
  var core = Object.freeze({ mB: mB, mT: mT, mWd: mWd, mSk: mSk, mFlr: mFlr });

  var gr;
  function run(en) {
    var m = en.module;
    if (!m || typeof m.build !== "function") return;
    if (typeof m.appliesTo === "function" && !m.appliesTo(plan)) return;
    var out = kit.part(en.part, function () { return m.build(plan, kit, core); });
    if (out && out.gr !== undefined) gr = out.gr;
  }
  PIPELINE.forEach(function (en) { if (!en.frame) run(en); });
  if (opts.frames) PIPELINE.forEach(function (en) { if (en.frame) run(en); });

  var bounds = { W: W, L: L, H: y0 + t.wallH + roofRise(W, t, plan.construction) };
  var result = { build: build, ORDER: build.ORDER, gr: gr, fitDist: fitDist, bounds: bounds };
  if (opts.only != null) {
    result.build = onlyParts(build, opts.only);
    result.ORDER = result.build.ORDER;
  }
  return result;
}

/* The same drawing with only the triangles of these parts. Every material is
   kept (same key, same paint, same place in ORDER), even when it ends up
   empty, so a part drawn alone is drawn exactly as on the whole building. */
export function onlyParts(build, only) {
  var keep = new Set(Array.isArray(only) ? only : [only]);
  var out = createBuild({ sel: build.sel });
  build.ORDER.forEach(function (k) {
    var b = build.buckets[k];
    var nb = {};
    Object.keys(b).forEach(function (p) { if (p !== "v" && p !== "n") nb[p] = b[p]; });
    nb.v = []; nb.n = 0;
    var segs = [];
    (build.tags[k] || []).forEach(function (s) {
      if (!keep.has(s.part)) return;
      for (var i = s.from * 27; i < (s.from + s.count) * 27; i++) nb.v.push(b.v[i]);
      var last = segs[segs.length - 1], from = nb.n / 3;
      if (last && last.part === s.part && last.from + last.count === from) last.count += s.count;
      else segs.push({ part: s.part, from: from, count: s.count });
      nb.n += s.count * 3;
    });
    out.buckets[k] = nb;
    out.ORDER.push(k);
    out.tags[k] = segs;
  });
  return out;
}
