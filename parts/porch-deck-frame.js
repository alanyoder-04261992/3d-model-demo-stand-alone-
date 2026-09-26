/* PORCH DECK FRAMING -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: {porch.joist} joists under the porch deck and {porch.post} porch posts.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "porch-deck-frame",
  name: "Porch deck framing",
  stage: "floor-frame",
  realLife: "{porch.joist} joists under the porch deck and {porch.post} porch posts.",
  pending: true,
  appliesTo(plan) { return plan.t.porch === "F" || plan.t.porch === "C" || plan.t.porch === "S"; },
  build() {},
};
