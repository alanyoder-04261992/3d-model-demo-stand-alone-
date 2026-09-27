/* Measurements of the existing drawing, in feet. No construction settings
   or geometry are changed. Nominal settings are returned separately: the
   preserved drawing does not always have the lumber's physical section. */
import skids, { skidStudyMembers } from "../parts/skids.js";
import { floorFrameMembers, lumberSize } from "../parts/floor-frame.js";
import { floorDeckMembers } from "../parts/floor-deck.js";

function boundsOf(boxes) {
  if (!boxes.length) return null;
  return Object.fromEntries(["x", "y", "z"].flatMap((axis) => [
    [axis + "0Ft", Math.min(...boxes.map((box) => box[axis + "0Ft"]))],
    [axis + "1Ft", Math.max(...boxes.map((box) => box[axis + "1Ft"]))],
  ]));
}

function beamRecord(member) {
  const p0 = member.p0.slice(), p1 = member.p1.slice();
  const center = p0.map((v, i) => (v + p1[i]) / 2);
  // Floor members are horizontal, axis-aligned beams; .w is their board
  // thickness and .d their drawn vertical depth.
  const acrossX = Math.abs(p1[0] - p0[0]) > Math.abs(p1[2] - p0[2]);
  const bounds = {
    x0Ft: Math.min(p0[0], p1[0]) - (acrossX ? 0 : member.w / 2),
    x1Ft: Math.max(p0[0], p1[0]) + (acrossX ? 0 : member.w / 2),
    y0Ft: center[1] - member.d / 2, y1Ft: center[1] + member.d / 2,
    z0Ft: Math.min(p0[2], p1[2]) - (acrossX ? member.w / 2 : 0),
    z1Ft: Math.max(p0[2], p1[2]) + (acrossX ? member.w / 2 : 0),
  };
  return { member, p0, p1, center, bounds,
    lengthFt: Math.hypot(...p0.map((v, i) => p1[i] - v)),
    widthFt: member.w, depthFt: member.d, nominalLumber: member.meta.size };
}

function sheetRecord(member) {
  const xs = member.poly.map((p) => p[0]), zs = member.poly.map((p) => p[1]);
  const x0Ft = Math.min(...xs), x1Ft = Math.max(...xs);
  const z0Ft = Math.min(...zs), z1Ft = Math.max(...zs);
  const uv = member.poly.reduce((sum, p) => sum.map((v, i) => v + p[i] / member.poly.length), [0, 0]);
  const topPoint = member.origin.map((v, i) => v + member.e1[i] * uv[0] + member.e2[i] * uv[1] + member.e3[i] * member.t);
  return { member, x0Ft, x1Ft, z0Ft, z1Ft, topPoint,
    acrossFt: x1Ft - x0Ft, alongFt: z1Ft - z0Ft,
    thicknessFt: member.t, layer: member.meta.layer };
}

function settingsSection(name) {
  if (!name) return null;
  const section = lumberSize(name);
  return { nominal: name, widthFt: section.t, depthFt: section.d };
}

export function floorMeasurements(plan) {
  const boxes = [];
  const studyMembers = skidStudyMembers(plan);
  // Capture the existing part's box arguments. This reads its real segment
  // extents and cross-section, rather than guessing from nominal settings.
  if (plan.floorStudy) {
    for (const member of studyMembers) {
      const zs = member.poly.map((p)=>p[0]), ys = member.poly.map((p)=>p[1]);
      boxes.push({ xFt:member.meta.xFt,x0Ft:member.origin[0],x1Ft:member.origin[0]+member.t,
        y0Ft:Math.min(...ys),y1Ft:Math.max(...ys),z0Ft:Math.min(...zs),z1Ft:Math.max(...zs) });
    }
  } else skids.build(plan, {
    setStage() {},
    box(_material, x, y, z, width, depth, length) {
      boxes.push({ xFt: x, x0Ft: x - width / 2, x1Ft: x + width / 2,
        y0Ft: y, y1Ft: y + depth, z0Ft: z - length / 2, z1Ft: z + length / 2 });
    },
  }, { mSk: null });
  const xsFt = [...new Set(boxes.map((box) => box.xFt))].sort((a, b) => a - b);
  const runs = xsFt.map((xFt) => {
    const bounds = boundsOf(boxes.filter((box) => box.xFt === xFt));
    const insideFaceXFt = xFt < 0 ? bounds.x1Ft : bounds.x0Ft;
    return { xFt, ...bounds,insideFaceXFt,
      nearestInsideFaceFt:plan.W/2-Math.abs(insideFaceXFt),
      notches:studyMembers.find((member)=>member.meta.xFt===xFt)?.meta.notches || [],
      lengthFt: bounds.z1Ft - bounds.z0Ft,
      widthFt: bounds.x1Ft - bounds.x0Ft, depthFt: bounds.y1Ft - bounds.y0Ft };
  });
  const supportBounds = boundsOf(boxes);
  const frameMembers = floorFrameMembers(plan).map(beamRecord);
  const joists = frameMembers.filter((record) => record.member.kind === "joist")
    .sort((a, b) => a.center[2] - b.center[2]);
  const rims = frameMembers.filter((record) => record.member.kind === "rim");
  const joist = joists.slice().sort((a, b) => Math.abs(a.center[2]) - Math.abs(b.center[2]))[0] || null;
  const rim = rims.find((record) => record.member.meta.side === "R") || rims[0] || null;
  const spacingPairs = joists.slice(1).map((record, index) => ({
    from: joists[index].center.slice(), to: record.center.slice(),
    spacingFt: record.center[2] - joists[index].center[2],
  }));
  const sheets = floorDeckMembers(plan).map(sheetRecord);
  const highestLayer = sheets.length ? Math.max(...sheets.map((sheet) => sheet.layer)) : 0;
  const representative = sheets.filter((sheet) => sheet.layer === highestLayer)
    .sort((a, b) => Math.hypot(a.topPoint[0], a.topPoint[2]) - Math.hypot(b.topPoint[0], b.topPoint[2]))[0] || null;
  const construction = plan.construction || {}, floor = construction.floor || {}, deck = floor.deck || {};
  const skidLumber = construction.skids?.size || null;
  return {
    study: plan.floorStudy ? { enabled:true,status:plan.floorStudy.status,
      joistSeatHeightFt:plan.floorStudy.joistBottomFt,joistTopFt:plan.floorStudy.joistTopFt,
      skidTopFt:plan.floorStudy.skids.heightFt,notchPlacement:plan.floorStudy.notches.placement } : null,
    nominal: { widthFt: plan.W, lengthFt: plan.L },
    supports: { ...supportBounds, xsFt, runs, count: runs.length,
      lengthFt: supportBounds ? supportBounds.z1Ft - supportBounds.z0Ft : 0,
      widthFt: runs[0]?.widthFt || 0, depthFt: runs[0]?.depthFt || 0,
      centerSpacingsFt: xsFt.slice(1).map((x, index) => x - xsFt[index]),
      insetCentersFt: runs.map((run) => ({ xFt:run.xFt, fromLeftFt:run.xFt + plan.W / 2,
        fromRightFt:plan.W / 2-run.xFt,nearestSideFt:plan.W / 2-Math.abs(run.xFt),
        insideFaceXFt:run.insideFaceXFt,nearestInsideFaceFt:run.nearestInsideFaceFt })),
      nominalLumber: plan.floorStudy?.skids.nominal || skidLumber, settingsSection: settingsSection(skidLumber),
      notches:studyMembers.flatMap((member)=>member.meta.notches),
      notchWidthFt:plan.floorStudy?.notches.widthFt || 0,
      notchDepthFt:plan.floorStudy?.notches.depthFt || 0,
      notchSeatYFt:plan.floorStudy?.joistBottomFt ?? null },
    frame: { members: frameMembers, joists, rims, joist, rim, spacingPairs,
      spacingFt: spacingPairs[0]?.spacingFt ?? null, bounds: boundsOf(frameMembers.map((record) => record.bounds)),
      nominalJoist: plan.floorStudy?.joists.nominal || floor.joist, nominalRim: floor.rim,
      settingsJoistSection: settingsSection(plan.floorStudy?.joists.nominal || floor.joist), settingsRimSection: settingsSection(floor.rim),
      nominalSpacingIn: plan.floorStudy?.joists.spacingIn ?? floor.spacingIn },
    deck: { sheets, representative, thicknessFt: representative?.thicknessFt || 0,
      nominalSheet: deck.sheet, nominalThicknessIn: deck.thicknessIn, layers: highestLayer },
  };
}

function decimal(value) { return String(Number(value.toFixed(2))); }

/** Display a feet-based drawing length rounded to a hundredth of an inch. */
export function formatInches(feet) {
  return Number.isFinite(feet) ? decimal(feet * 12) + " in" : "—";
}

/** Round before splitting feet/inches, so 11.999 in carries into 1 ft. */
export function formatFeetInches(feet) {
  if (!Number.isFinite(feet)) return "—";
  const hundredths = Math.round(Math.abs(feet) * 1200);
  const wholeFeet = Math.floor(hundredths / 1200), inches = (hundredths % 1200) / 100;
  const sign = feet < 0 && hundredths > 0 ? "−" : "";
  return sign + (wholeFeet ? wholeFeet + " ft" + (inches ? " " + decimal(inches) + " in" : "") : decimal(inches) + " in");
}
