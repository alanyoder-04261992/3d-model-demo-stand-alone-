/* Alan's real-window rule is independent of one window size. Coordinates
   here are inches relative to the truss center and upper-plate top.
   The UI's example dimensions and auto placement are preview choices. */
export function trussWindowOpening(study, input) {
  if (input == null) return null;
  if (input.kind === "fake") return { kind: "fake" };
  if (input.kind !== "window") throw new Error("Choose a real window opening or a fake window.");
  const { widthIn, heightIn } = input, centerIn = input.centerIn ?? 0;
  if (![widthIn,heightIn].every(v => Number.isFinite(v) && v > 0) || !Number.isFinite(centerIn))
    throw new Error("Window opening width and height must be positive measurements.");
  const face = study.studs.widthIn, x0 = centerIn - widthIn / 2, x1 = centerIn + widthIn / 2;
  const outside = Math.max(Math.abs(x0 - face), Math.abs(x1 + face));
  if (outside > study.bearingHalfSpanFt * 12 + 1e-8)
    throw new Error("This window box is too wide or too far sideways to fit on the gable board.");
  const p = study.profile;
  const roofAt = x => Math.min(study.peakRiseIn - p.upperSlope * Math.abs(x),
    p.tipY + p.lowerSlope * (p.tip[0] - Math.abs(x)));
  const minBottom = study.studBaseIn + face;
  const maxBottom = roofAt(outside) - face - heightIn;
  if (maxBottom < minBottom - 1e-8)
    throw new Error("This window box is too tall for this position beneath the truss. Reduce its size or move it toward the center.");
  const bottomIn = input.bottomIn == null ? (minBottom + maxBottom) / 2 : input.bottomIn;
  if (!Number.isFinite(bottomIn) || bottomIn < minBottom - 1e-8 || bottomIn > maxBottom + 1e-8)
    throw new Error("The window box must fit above the gable board and below the truss. Adjust its bottom height.");
  return { kind: "window", widthIn, heightIn, centerIn, bottomIn, topIn: bottomIn + heightIn,
    x0In: x0, x1In: x1, faceIn: face, thicknessIn: study.studs.thicknessIn,
    autoHeight: input.bottomIn == null, joint: "between-side-studs-preview" };
}

export function windowStudCenters(study) {
  const opening = study.windowOpening;
  if (opening?.kind !== "window") return study.studs.centersIn.slice();
  const half = study.studs.widthIn / 2;
  const left = opening.x0In - half, right = opening.x1In + half;
  const regular = study.studs.centersIn.slice().sort((a,b) => a-b);
  // Move the nearest distinct pair, and remove any regular stud that would
  // cross the box. Unaffected outer studs retain their original marks.
  let pair = [], cost = Infinity;
  for (let i=0;i<regular.length;i++) for(let j=i+1;j<regular.length;j++) {
    const next = Math.abs(regular[i]-left) + Math.abs(regular[j]-right);
    if (next < cost) { cost=next; pair=[i,j]; }
  }
  return [...regular.filter((x,i) => !pair.includes(i) &&
    (x + half <= left - half + 1e-8 || x - half >= right + half - 1e-8)), left, right].sort((a,b)=>a-b);
}
