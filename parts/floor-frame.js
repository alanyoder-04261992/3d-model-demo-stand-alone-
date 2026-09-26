/* FLOOR FRAME -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: {floor.joist} floor joists at {floor.spacingIn} in on centre across the width, sitting on the skids, with a {floor.rim} rim joist along both long sides.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "floor-frame",
  name: "Floor frame",
  stage: "floor-frame",
  realLife: "{floor.joist} floor joists at {floor.spacingIn} in on centre across the width, sitting on the skids, with a {floor.rim} rim joist along both long sides.",
  pending: true,
  appliesTo(plan) { return true; },
  build() {},
};
