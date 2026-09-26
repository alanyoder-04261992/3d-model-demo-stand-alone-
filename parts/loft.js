/* LOFT -- A STUB, waiting to be ported. Node-safe.

   This file only exists so parts/index.js (the PIPELINE) can load while the
   real part is being written. It draws nothing and says so ("pending: true"):
   tools/check-golden.mjs reports its triangles as PENDING, not failed, and
   tools/check-parts.mjs does not ask it for a skill yet.

   What it will be: {loft.joist} loft joists at {loft.spacingIn} in on centre at the wall top, at the ends of a lofted building.
   Barnwright source: new -- Barnwright drew none.
   Replace this whole file with the real part (see parts/README.md and
   docs/SKILL-TEMPLATE.md). */

export default {
  id: "loft",
  name: "Loft",
  stage: "loft",
  realLife: "{loft.joist} loft joists at {loft.spacingIn} in on centre at the wall top, at the ends of a lofted building.",
  pending: true,
  appliesTo(plan) { return !!plan.t.loft; },
  build() {},
};
