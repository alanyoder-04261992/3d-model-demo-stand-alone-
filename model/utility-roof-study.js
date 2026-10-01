/* Two utility roof slopes over the learned end wall. This isolated preview
   keeps an explicit level-tail assumption, never a fabrication cut list. */
import {deepFreeze} from "./company.js";
import {utilityRoofPitch,utilityRoofRule} from "./utility-study.js";
import {prismMember} from "../parts/floor-frame.js";

export function utilityRoofStudyPlan(plan,{mode="standard"}={}) {
  const wall=plan.wallStudy;
  if(wall?.style!=="utility" || wall.wall!=="end")throw new Error("Use the utility end-wall lesson first.");
  const rule=utilityRoofRule(plan),pitch=utilityRoofPitch(plan,mode),slope=pitch.rise/pitch.run;
  const widthIn=(wall.floorBounds.x1Ft-wall.floorBounds.x0Ft)*12;
  const halfRunIn=widthIn/2+rule.overhangEachSideIn;
  const peakRiseIn=rule.tipHeightIn+halfRunIn*slope;
  const verticalDepthIn=rule.stock.depthIn/Math.cos(pitch.angleDeg*Math.PI/180);
  const innerPeakIn=peakRiseIn-verticalDepthIn;
  const levelCutRunIn=(verticalDepthIn-rule.tipHeightIn)/slope;
  if(!Number.isFinite(widthIn)||widthIn<=0||innerPeakIn<=0||levelCutRunIn<=0||levelCutRunIn>=halfRunIn)
    throw new Error("Those inputs do not leave a valid utility roof board in the level-tail preview.");
  // A clipped stock strip can only bear on the plate while its natural
  // lower edge is below that plate. Never add timber to force another fit.
  if(levelCutRunIn<=rule.overhangEachSideIn)
    throw new Error("This pitch needs a different seat fit; the level-tail preview would not touch the upper plate.");
  const copy=structuredClone(plan);
  copy.utilityRoofStudy={...rule,mode,pitch,widthIn,halfRunIn,peakRiseIn,innerPeakIn,levelCutRunIn,
    centerXFt:(wall.floorBounds.x0Ft+wall.floorBounds.x1Ft)/2,baseYFt:wall.topYFt,
    outsideZFt:wall.floorBounds.z0Ft+(wall.plates.depthFt-rule.stock.thicknessIn/12)/2,
    status:{stock:"confirmed",pitch:"confirmed",overhang:"confirmed",tipHeight:"confirmed",
      bottomDatum:"confirmed",tailShape:"provisional-level-tail",peak:"derived-from-preview-fit",
     depthPlacement:"provisional-centered",ridgeCut:"provisional-mirrored-mitre",gableInfill:"not-yet-taught"}};
  return deepFreeze(copy);
}

export function utilityRoofStudyMembers(plan) {
  const s=plan.utilityRoofStudy;if(!s)return [];
  const left=[[-s.halfRunIn,0],[-s.halfRunIn+s.levelCutRunIn,0],
    [0,s.innerPeakIn],[0,s.peakRiseIn],[-s.halfRunIn,s.tipHeightIn]];
  return ["left","right"].map(side=>{
    const sign=side==="left"?1:-1;
    const local=sign===1?left:left.map(([x,y])=>[-x,y]).reverse();
    const poly=local.map(([x,y])=>[s.centerXFt+x/12,s.baseYFt+y/12]);
    const member=prismMember("utility-roof-slope","lumber",poly,[0,0,s.outsideZFt],
      [1,0,0],[0,1,0],[0,0,1],s.stock.thicknessIn/12,
      {name:"Utility truss slope",side,size:s.stock.nominal,faceWidthFt:s.stock.depthIn/12,
        grainEdge:[[s.centerXFt+sign*-s.halfRunIn/12,s.baseYFt+s.tipHeightIn/12],
          [s.centerXFt,s.baseYFt+s.peakRiseIn/12]],preview:true});
    member.stage="roof-frame";return member;
  });
}
