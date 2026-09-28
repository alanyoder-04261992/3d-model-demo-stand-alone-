/* THE FLOOR DECKING: the tongue-and-groove sheets nailed down over the floor
   joists. Node-safe. NEW geometry -- Barnwright drew none (its floor is one
   solid slab, parts/floor.js).

   In real life the floor is decked with 4x8 tongue-and-groove sheets laid
   with their long edge ACROSS the joists (the joists run across the width, so
   the sheets run along the length), started at the back end, with every other
   row started on a half sheet so the end joints are staggered -- and because
   the joists are laid out from the same back end, every end joint lands on a
   joist (8 ft is six 16 in bays, or eight 12 in ones). The joints are drawn as
   hairline gaps so each sheet can be seen. A DOUBLE FLOOR (the "double floor"
   option, floor.deck.layers 2) is a second full layer of the same sheets over
   the first, with its joints moved half a sheet both ways, as a floor layer
   would lay it -- Alan, Aug 2026: "Double floors is the 4x8 tongue and groove
   flooring that goes on top of the 2x6. And double means they is another
   layer of flooring."

   WHERE: over the enclosed room only, to the outside face of the walls (the
   walls stand on the decking). The open porch decks get deck boards instead
   (parts/porch-deck-frame.js). On the Dog Kennel the whole floor is decked,
   run and room alike (the finished drawing shows it as one grey floor).
   Heights: the decking's top is y0, the finished floor line; it is
   floor.deck.thicknessIn thick per layer, and the joists under it are drawn
   that much shallower (parts/floor-frame.js).

   Barnwright source: new -- Barnwright drew none. It fits the top of the
   floor slab's envelope (parts/floor.js, Barnwright 3868-3877) and the shop's
   floor note (2147-2150: "2x6 joists on skids with 5/8" decking"). */

import { floorPlanOf, floorFrameMembers, slabMember, clipRect, drawMembers } from "./floor-frame.js";

/* A hairline between sheets so every joint shows (half each side). */
export const SEAM = 0.01;

/* "4x8 T&G" -> { across, along } in feet: the long side along the length. */
export function sheetSize(name) {
  var m = /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/.exec(String(name || ""));
  var a = m ? +m[1] : 4, b = m ? +m[2] : 8;
  return { across: Math.min(a, b), along: Math.max(a, b) };
}

/* The lesson's confirmed flooring uses exact cut rectangles. Surface lines
   identify seams without taking wood out of the floor. Tongue-and-groove is
   a product fact; no unknown manufacturer's edge profile is invented here. */
function studyDeckMembers(plan,F) {
  var spec=plan.floorStudy.deck,frame=floorFrameMembers(plan);
  var boxes=frame.map(function(m) {
    var alongX=Math.abs(m.p1[0]-m.p0[0])>Math.abs(m.p1[2]-m.p0[2]);
    return {x0:Math.min(m.p0[0],m.p1[0])-(alongX?0:m.w/2),x1:Math.max(m.p0[0],m.p1[0])+(alongX?0:m.w/2),
      z0:Math.min(m.p0[2],m.p1[2])-(alongX?m.w/2:0),z1:Math.max(m.p0[2],m.p1[2])+(alongX?m.w/2:0)};
  });
  var bounds={x0:Math.min.apply(null,boxes.map(function(b){return b.x0;})),x1:Math.max.apply(null,boxes.map(function(b){return b.x1;})),
    z0:Math.min.apply(null,boxes.map(function(b){return b.z0;})),z1:Math.max.apply(null,boxes.map(function(b){return b.z1;}))};
  var out=[],row=0;
  for(var x=bounds.x0;x<bounds.x1-1e-9;x+=spec.sheetWidthFt,row++) {
    var xa=x,xb=Math.min(x+spec.sheetWidthFt,bounds.x1),piece=0;
    var stagger=row%2 ? spec.staggerFt : 0;
    var start=bounds.z0-(stagger ? spec.sheetLengthFt-stagger : 0);
    for(var z=start;z<bounds.z1-1e-9;z+=spec.sheetLengthFt) {
      var za=Math.max(z,bounds.z0),zb=Math.min(z+spec.sheetLengthFt,bounds.z1);
      if(zb<=za+1e-9) continue;
      var P=[[xa,za],[xb,za],[xb,zb],[xa,zb]];
      var m=slabMember("sheet","sheet",P,F.joistTop,F.joistTop+spec.thicknessFt,
        {layer:1,col:row,row:row,pieceInRow:piece++,x0:x,z0:z,support:"bear",staggerFt:stagger,
          stockAcrossFt:spec.sheetWidthFt,stockAlongFt:spec.sheetLengthFt,
          cutAcrossFt:xb-xa,cutAlongFt:zb-za,tongueAndGroove:spec.tongueAndGroove,
          edgeProfile:"unspecified",visualGapFt:0});
      m.stage="floor-deck";out.push(m);
    }
  }
  return out;
}

/* Every sheet (or cut piece of one), per layer, clipped to the decked area. */
export function floorDeckMembers(plan) {
  var F = floorPlanOf(plan), fp = F.fp, out = [];
  if (plan.floorStudy && plan.floorStudy.deck) return studyDeckMembers(plan,F);
  var dk = (plan.construction.floor && plan.construction.floor.deck) || {};
  var S = sheetSize(dk.sheet || "4x8");
  for (var layer = 0; layer < F.layers; layer++) {
    var ya = F.joistTop + layer * F.deckT1, yb = ya + F.deckT1;
    var xShift = layer % 2 ? S.across / 2 : 0;           /* the second layer's joints move half a sheet */
    var col = 0;
    for (var x = fp.x0 - xShift; x < fp.x1 - 1e-9; x += S.across, col++) {
      var zShift = ((col + layer) % 2) ? S.along / 2 : 0;
      for (var z = fp.z0 - zShift; z < fp.z1 - 1e-9; z += S.along) {
        var P = clipRect(F.deckArea, x + SEAM / 2, x + S.across - SEAM / 2, z + SEAM / 2, z + S.along - SEAM / 2);
        if (!P.length) continue;
        out.push(slabMember("sheet", "sheet", P, ya, yb, { layer: layer + 1, col: col, x0: x, z0: z, support: "bear" }));
      }
    }
  }
  out.forEach(function (m) { m.stage = "floor-deck"; });
  return out;
}

export default {
  id: "floor-deck",
  name: "Floor decking",
  stage: "floor-deck",
  realLife: "{floor.deck.sheet} floor decking, {floor.deck.thicknessIn} in thick, nailed over the joists with the long edges across them and the end joints staggered on the joists ({floor.deck.layers} layer); the walls stand on it.",
  appliesTo(plan) { return true; },
  members: floorDeckMembers,
  build(plan, kit) {
    drawMembers(kit, floorDeckMembers(plan), "floor-deck");
  },
};
