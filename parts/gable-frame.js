/* GABLE-END FRAMING -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: {walls.stud} studs filling each gable end under the roof line.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "gable-frame",
  name: "Gable-end framing",
  stage: "roof-frame",
  realLife: "{walls.stud} studs filling each gable end under the roof line.",
  pending: true,
  appliesTo(plan) { return true; },
  build() {},
};
