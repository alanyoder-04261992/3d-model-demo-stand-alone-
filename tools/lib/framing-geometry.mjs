/* THE GEOMETRY THE FRAMING CHECKS SHARE, for the tools. Node only.

   Everything pure lives in model/framing-geometry.js (moved there unchanged
   in Oct 2026, so the every-size check, model/style-check.js, can use it in
   the browser and on the server too) and is re-exported here, so every
   check keeps importing it from this file. What stays here is what needs
   the headless canonical form (tools/lib/headless.mjs):

     finishedFingerprint(build)     the finished building's triangles, to prove
                                    the framing never changes them
     FINISHED_STAGE_IDS             the steps the Finished view shows */

import { canonical } from "./headless.mjs";
import { STAGES, visibleIn } from "../../parts/stages.js";

export * from "../../model/framing-geometry.js";

export const FINISHED_STAGE_IDS = Object.freeze(new Set(STAGES.filter(function (s) { return visibleIn("finished", s); }).map(function (s) { return s.id; })));
/* The finished building's materials and a hash of their triangles (only the
   steps the Finished view shows). Two builds with the same fingerprint draw
   the same finished building. */
export function finishedFingerprint(build) {
  var c = canonical(build, FINISHED_STAGE_IDS);
  return { order: c.order, buckets: c.order.map(function (k) { return { key: k, triangles: c.buckets[k].triangles, hash: c.buckets[k].hash, params: JSON.stringify(c.buckets[k].params) }; }) };
}
