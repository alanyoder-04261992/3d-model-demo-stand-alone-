/* WALL FRAMING -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: {walls.stud} studs at {walls.spacingIn} in on centre on a bottom plate, a doubled top plate, and king studs, jack studs and a header at every opening.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "wall-frame",
  name: "Wall framing",
  stage: "wall-frame",
  realLife: "{walls.stud} studs at {walls.spacingIn} in on centre on a bottom plate, a doubled top plate, and king studs, jack studs and a header at every opening.",
  pending: true,
  appliesTo(plan) { return true; },
  build() {},
};
