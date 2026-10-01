/* Keep short uprights on the existing wall layout; do not restart the grid
   at an opening. Only full-width studs supported by the horizontal fit. */
import {wallStudyFrame} from "../parts/wall-frame.js";

export function openingStudLayout(plan,x0Ft,x1Ft) {
  if(plan.wallStudy?.wall!=="end")throw new Error("This isolated opening detail needs an end-wall coordinate frame.");
  return wallStudyFrame(plan).members
    .filter(m=>m.kind==="stud" && m.meta.role!=="end")
    .filter(m=>m.meta.at.u0>=x0Ft-1e-8 && m.meta.at.u1<=x1Ft+1e-8)
    .map(m=>({x0Ft:m.meta.at.u0,x1Ft:m.meta.at.u1,role:m.meta.role,
      markFt:m.meta.markFt,pairIndex:m.meta.pairIndex??null}));
}
