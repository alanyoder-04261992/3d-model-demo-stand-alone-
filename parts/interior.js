/* SHELVES, BENCHES AND ELECTRICAL -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: The work bench, shelving, outlets, switches and lights inside the building.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "interior",
  name: "Shelves, benches and electrical",
  stage: "interior",
  realLife: "The work bench, shelving, outlets, switches and lights inside the building.",
  pending: true,
  appliesTo(plan) { return plan.state.items.some(function (it) { return plan.CAT[it.cat] && plan.CAT[it.cat].int; }); },
  build() {},
};
