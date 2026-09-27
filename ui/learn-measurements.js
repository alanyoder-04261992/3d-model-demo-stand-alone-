import { floorMeasurements, formatFeetInches as length, formatInches as inches } from "../model/floor-measurements.js";

/* Readouts follow visibility and the same member data as the drawing.
   Confirmed shop facts are separate from remaining layout assumptions. */
export function createMeasurementReadout(list,note,plan) {
  const m=floorMeasurements(plan);
  function update(selection) {
    list.replaceChildren();
    const selected=new Set(selection),rows=[],notes=[];
    if(selected.has("supports")) {
      rows.push(["Each skid · confirmed length",length(m.supports.lengthFt)],
        ["Skid · nominal → actual",`${m.supports.nominalLumber} → ${inches(m.supports.widthFt)} × ${inches(m.supports.depthFt)}`],
        ["Notch depth · confirmed",inches(m.supports.notchDepthFt)],
        ["Spacing · confirmed options",`${m.frame.nominalSpacingIn} in on center standard / ${plan.floorStudy.notches.alternateSpacingIn} in option`],
        ["Skids shown · count still to confirm",`${m.supports.count} pieces`],
        ["Outside wall → inside skid face · confirmed",inches(m.supports.insetCentersFt[0].nearestInsideFaceFt)],
        ["Outside wall → skid center · calculated",inches(m.supports.insetCentersFt[0].nearestSideFt)]);
      notes.push("Inside face means the side of the skid facing the middle of the floor. Notch width is drawn to fit the 1½-inch member; cutting clearance and the first notch position still need confirmation.");
    }
    if(selected.has("frame")) {
      rows.push(["Crosswise member · nominal → actual",`${m.frame.nominalJoist} → ${inches(m.frame.joist.widthFt)} × ${inches(m.frame.joist.depthFt)}`],
        ["Seated below the skid top · confirmed",inches(m.supports.notchDepthFt)],
        ["Crosswise member · provisional length",length(m.frame.joist.lengthFt)],
        ["Long rim · provisional length",length(m.frame.rim.lengthFt)],
        ["Regular centers · confirmed",`${m.frame.nominalSpacingIn} in on center`]);
      notes.push("Crosswise cut lengths, end offsets and rim details are still model assumptions. “Floor joist” and “rim joist” are proposed names.");
    }
    if(selected.has("deck")) {
      const sheet=m.deck.representative;
      rows.push(["Labeled sheet · drawn size",`${length(sheet.acrossFt)} × ${length(sheet.alongFt)}`],
        ["Sheet thickness",Math.abs(sheet.thicknessFt*12-.625)<1e-8?"5/8 in":inches(sheet.thicknessFt)],
        ["Sheet stock in settings",m.deck.nominalSheet],
        ["Visible sheet pieces",`${m.deck.sheets.length} pieces · ${m.deck.layers} layer`]);
      notes.push("Sheet specification and layout are model defaults to check later. Edge pieces are trimmed; narrow display gaps make drawn sheets slightly smaller than the stock size.");
    }
    for(const [title,value] of rows) {
      const item=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");
      dt.textContent=title; dd.textContent=value; item.append(dt,dd); list.appendChild(item);
    }
    note.textContent=selection.length?notes.join(" "):"Select a piece to see its measurements.";
  }
  return {update};
}
