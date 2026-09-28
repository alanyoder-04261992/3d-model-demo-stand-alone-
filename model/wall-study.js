/* A separate plain wall for the manual lesson. Company data alone never
   changes the normal designer. Plate laps are dimensioned without adding
   an unconfirmed corner-stud pack or opening layout. */
import { deepFreeze } from "./company.js";
import { floorDeckMembers } from "../parts/floor-deck.js";

function positive(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new Error(`wallStudy.${name} must be a positive measurement.`);
  return value;
}

function setback(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`wallStudy.endSetbacksIn.${name} must be a nonnegative measurement.`);
  return value;
}

export function wallStudyPlan(plan, { wall = "side" } = {}) {
  const raw = plan.construction?.wallStudy;
  if (!raw) return plan;
  if (!["side", "end"].includes(wall)) throw new Error("Choose a sidewall or endwall for the wall lesson.");
  if (!plan.floorStudy) throw new Error("The wall lesson needs the existing floor study first.");
  const stud = raw.stud || {}, plates = raw.plates || {};
  const widthIn = positive(stud.widthIn, "stud.widthIn");
  const depthIn = positive(stud.depthIn, "stud.depthIn");
  const lengthIn = positive(stud.lengthIn, "stud.lengthIn");
  const thicknessIn = positive(plates.thicknessIn, "plates.thicknessIn");
  const plateDepthIn = positive(plates.depthIn, "plates.depthIn");
  const spacingIn = positive(raw.spacingIn, "spacingIn");
  const doubleEveryIn = positive(raw.doubleEveryIn, "doubleEveryIn");
  const layoutOriginIn = raw.layoutOriginIn;
  if (typeof layoutOriginIn !== "number" || !Number.isFinite(layoutOriginIn) || layoutOriginIn < 0 || layoutOriginIn >= spacingIn)
    throw new Error("wallStudy.layoutOriginIn must be a measured offset from zero up to one stud spacing.");
  if (spacingIn <= widthIn * 2 || Math.abs(doubleEveryIn / spacingIn - Math.round(doubleEveryIn / spacingIn)) > 1e-9)
    throw new Error("wallStudy double intervals must fall on the layout marks, with space between members.");
  if (raw.pairReference !== "joint") throw new Error("wallStudy.pairReference must locate each mark at the touching stud joint.");
  if (Math.abs(depthIn - plateDepthIn) > 1e-9)
    throw new Error("The plain wall lesson currently needs matching stud and plate depths.");
  const sheets = floorDeckMembers(plan);
  if (!sheets.length) throw new Error("The wall lesson needs flooring to stand on.");
  const top = Math.max(...sheets.map(sheet => sheet.origin[1] + sheet.t));
  const points = sheets.filter(sheet => Math.abs(sheet.origin[1] + sheet.t - top) < 1e-9)
    .flatMap(sheet => sheet.poly.map(p => sheet.origin.map((value, i) =>
      value + sheet.e1[i] * p[0] + sheet.e2[i] * p[1] + sheet.e3[i] * sheet.t)));
  const floorBounds = {
    x0Ft: Math.min(...points.map(p => p[0])), x1Ft: Math.max(...points.map(p => p[0])),
    z0Ft: Math.min(...points.map(p => p[2])), z1Ft: Math.max(...points.map(p => p[2])),
    y1Ft: top,
  };
  const wallLengthFt = wall === "side" ? floorBounds.z1Ft - floorBounds.z0Ft : floorBounds.x1Ft - floorBounds.x0Ft;
  if (wallLengthFt * 12 <= widthIn * 4 || lengthIn <= thicknessIn || depthIn >= Math.min(plan.W, plan.L) * 12)
    throw new Error("The wall study dimensions must leave separate studs and fit on the floor.");
  const allSetbacks = {};
  for (const name of ["side", "end"]) {
    const entry = raw.endSetbacksIn?.[name] || {};
    const frameIn = setback(entry.frame ?? 0, name + ".frame");
    const upperPlateIn = setback(entry.upperPlate ?? 0, name + ".upperPlate");
    const spanFt = name === "side" ? floorBounds.z1Ft - floorBounds.z0Ft : floorBounds.x1Ft - floorBounds.x0Ft;
    if (spanFt * 12 - frameIn * 2 <= widthIn * 4 || spanFt * 12 - upperPlateIn * 2 <= 1e-4)
      throw new Error("wallStudy end setbacks must leave a positive upper plate and space for separate end studs.");
    allSetbacks[name] = { frameIn, frameFt: frameIn / 12, upperPlateIn, upperPlateFt: upperPlateIn / 12 };
  }
  const setbacks = allSetbacks[wall];
  const frameRange = { u0: -wallLengthFt / 2 + setbacks.frameFt, u1: wallLengthFt / 2 - setbacks.frameFt,
    lengthFt: wallLengthFt - setbacks.frameFt * 2 };
  const upperPlateRange = { u0: -wallLengthFt / 2 + setbacks.upperPlateFt, u1: wallLengthFt / 2 - setbacks.upperPlateFt,
    lengthFt: wallLengthFt - setbacks.upperPlateFt * 2 };
  const plateThicknessFt = thicknessIn / 12, studLengthFt = lengthIn / 12;
  const heightFt = studLengthFt + plateThicknessFt * 3;
  const status = {};
  for (const key of ["studSection", "plateSection", "studLength", "spacing", "doubleInterval", "wallNames",
    "layoutDatum", "pairPlacement", "plateLengths", "wallPlacement", "treatment",
    "frameSetbacks", "upperPlateSetbacks", "cornerLap"])
    status[key] = ["confirmed", "derived"].includes(raw.status?.[key]) ? raw.status[key] : "provisional";
  status.height = "derived"; status.baseHeight = "derived";
  const study = {
    enabled: true, wall, name: wall === "side" ? "Side wall" : "End wall", lengthFt: wallLengthFt,
    stud: { nominal: stud.nominal || "2x4", widthIn, depthIn, lengthIn,
      widthFt: widthIn / 12, depthFt: depthIn / 12, lengthFt: studLengthFt },
    plates: { nominal: plates.nominal || "2x4", thicknessIn, depthIn: plateDepthIn,
      thicknessFt: plateThicknessFt, depthFt: plateDepthIn / 12, bottomCount: 1, topCount: 1, upperCount: 1 },
    spacingIn, spacingFt: spacingIn / 12, doubleEveryIn, doubleEveryFt: doubleEveryIn / 12,
    layoutOriginIn, layoutOriginFt: layoutOriginIn / 12, pairReference: "joint", setbacks, frameRange, upperPlateRange,
    floorBounds, baseYFt: top, heightFt, topYFt: top + heightFt,
    bottomPlateTopYFt: top + plateThicknessFt,
    studTopYFt: top + plateThicknessFt + studLengthFt,
    topPlateTopYFt: top + plateThicknessFt * 2 + studLengthFt,
    openings: "omitted-for-lesson", corners: "separate-wall-study", status,
  };
  const copy = structuredClone(plan);
  copy.wallStudy = study;
  return deepFreeze(copy);
}
