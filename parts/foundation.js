/* BLOCKS AND ANCHORS -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: Concrete {site.blocks} blocks under the skids, one per {site.perimeterFtPerBlock} ft of outside wall, and {site.anchors} ground anchors.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "foundation",
  name: "Blocks and anchors",
  stage: "foundation",
  realLife: "Concrete {site.blocks} blocks under the skids, one per {site.perimeterFtPerBlock} ft of outside wall, and {site.anchors} ground anchors.",
  pending: true,
  appliesTo(plan) { return true; },
  build() {},
};
