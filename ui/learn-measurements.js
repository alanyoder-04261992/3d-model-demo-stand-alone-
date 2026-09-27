import { floorMeasurements, formatFeetInches as length, formatInches as inches } from "../model/floor-measurements.js";

/* Readouts follow visibility; every number comes from the same existing
   part data as the drawing. Settings are labeled separately. */
export function createMeasurementReadout(list,note,plan) {
  const m=floorMeasurements(plan);
  function update(selection) {
    list.replaceChildren();
    const selected=new Set(selection),rows=[],notes=[];
    if(selected.has("supports")) {
      rows.push(["Each long support · drawn length",length(m.supports.lengthFt)],
        ["Support count and drawn section",`${m.supports.count} pieces · ${inches(m.supports.widthFt)} × ${inches(m.supports.depthFt)}`],
        ["Between support centers",m.supports.centerSpacingsFt.map(inches).join(" / ")],
        ["Side edge to nearest support center",inches(m.supports.insetCentersFt[0].nearestSideFt)]);
      notes.push(`Support settings say ${m.supports.nominalLumber}; this drawing uses ${inches(m.supports.widthFt)} × ${inches(m.supports.depthFt)} and extends ${inches((m.supports.lengthFt-plan.L)/2)} beyond each nominal end.`);
    }
    if(selected.has("frame")) {
      rows.push(["Crosswise floor joist · drawn length",length(m.frame.joist.lengthFt)],
        ["Long rim joist · drawn length",length(m.frame.rim.lengthFt)],
        ["Between regular joist centers",inches(m.frame.spacingFt)],
        ["Joist / rim · drawn section",`${inches(m.frame.joist.widthFt)} × ${inches(m.frame.joist.depthFt)}`]);
      notes.push(`Frame settings say ${m.frame.nominalJoist}; its drawn depth is ${inches(m.frame.joist.depthFt)} to fit the existing floor height. End spacing differs from the regular spacing.`);
    }
    if(selected.has("deck")) {
      const sheet=m.deck.representative;
      rows.push(["Labeled sheet · drawn size",`${length(sheet.acrossFt)} × ${length(sheet.alongFt)}`],
        ["Sheet thickness",Math.abs(sheet.thicknessFt*12-.625)<1e-8?"5/8 in":inches(sheet.thicknessFt)],
        ["Sheet stock in settings",m.deck.nominalSheet],
        ["Visible sheet pieces",`${m.deck.sheets.length} pieces · ${m.deck.layers} layer`]);
      notes.push("The labeled sheet is one example. Edge pieces are trimmed; narrow display gaps make drawn sheets slightly smaller than the stock size.");
    }
    for(const [title,value] of rows) {
      const item=document.createElement("div"),dt=document.createElement("dt"),dd=document.createElement("dd");
      dt.textContent=title; dd.textContent=value; item.append(dt,dd); list.appendChild(item);
    }
    note.textContent=selection.length?notes.join(" ")+" These are model measurements to check together, not confirmed cutting lengths.":"Select a piece to see its measurements.";
  }
  return {update};
}
