/* THE FLOOR, as the finished building shows it: the deck slab the walls
   stand on. Node-safe.

   In real life the floor is joists across the width on the skids, a rim joist
   along both long sides, then tongue-and-groove decking; its top is y0 = 0.92
   ft (11 in) above the ground, and every wall, door and roof height is
   measured up from there. The finished view draws it as one solid slab from
   the top of the skids (y 0.5) to the deck top (0.5 + 0.42 = y0). The real
   joists and decking are separate NEW parts for the Framing view
   (parts/floor-frame.js and parts/floor-deck.js).

   Ported from Barnwright's 3ddesign.html buildShed, the floor loop
   (lines 3868-3877), numbers byte for byte:

     var NF=Math.max(3,Math.ceil(L/2.5)), FIN=(state.type==="DK")?0:0.03;
     for(var fi=0;fi<NF;fi++){
       var fz0=-L/2+(L-FIN*2)*fi/NF+FIN, fz1=-L/2+(L-FIN*2)*(fi+1)/NF+FIN, fzc=(fz0+fz1)/2, fl=fz1-fz0;
       ...skid boxes (parts/skids.js)...
       box(mFlr,0,0.5,fzc,W-FIN*2,0.42,fl);
     }

   Porting edits (docs/ARCHITECTURE.md, Porting rules): state.type==="DK" ->
   the style's kennel trait (plan.t.kennel); the loop's arithmetic moved into
   floorSegments() so the skids (which Barnwright draws in the same loop, one
   set per segment) use the very same segments; mFlr comes from the core
   materials assemble made (core.mFlr: "kfloor" on a kennel, else "wood");
   setStage added. The skid boxes and the slab go into different materials,
   so drawing all the skids first and then all the slabs gives each material
   exactly Barnwright's triangles in Barnwright's order.

   KEPT QUIRKS (look-defining, docs/ARCHITECTURE.md): the slab is SEGMENTED
   (NF pieces, at least 3, one per 2.5 ft) and INSET 0.03 ft from the walls.

   THE SHOP'S FLOOR (Barnwright's note on the real construction, 2147-2150,
   kept word for word): "Floor: 2x6 joists on skids with 5/8" decking
   (8-ft-wide and smaller use 2x4 joists) -- that assembly is the 0.92 ft base
   line y0." Those numbers now live in library/construction.json (floor.joist,
   floor.deck.thicknessIn) and engine/constants.js (y0). */

export const FLOOR_TOP_OF_SKIDS = 0.5;

/* The floor deck is tucked 0.03 inside the walls so the siding skirt that
   hangs past the wall bottom never fights it for a plane (Barnwright's
   comment). The kennel's floor runs right out to the edge. */
export function floorInset(plan) {
  return plan.t.kennel ? 0 : 0.03;
}

/* The floor segments along the length, Barnwright's arithmetic exactly:
   [{ fi, fz0, fz1, fzc, fl }] from the back (-z) to the front (+z). */
export function floorSegments(plan) {
  var L = plan.L;
  var NF=Math.max(3,Math.ceil(L/2.5)), FIN=floorInset(plan);
  var out=[];
  for(var fi=0;fi<NF;fi++){
    var fz0=-L/2+(L-FIN*2)*fi/NF+FIN, fz1=-L/2+(L-FIN*2)*(fi+1)/NF+FIN, fzc=(fz0+fz1)/2, fl=fz1-fz0;
    out.push({ fi: fi, NF: NF, fz0: fz0, fz1: fz1, fzc: fzc, fl: fl });
  }
  return out;
}

export default {
  id: "floor",
  name: "Floor",
  stage: "floor",
  realLife: "The floor the walls stand on: {floor.joist} joists at {floor.spacingIn} in on centre across the width on the skids, a {floor.rim} rim joist along both long sides, and {floor.deck.sheet} decking {floor.deck.thicknessIn} in thick on top.",
  appliesTo() { return true; },
  build(plan, kit, core) {
    var W = plan.W, FIN = floorInset(plan);
    var mFlr = core.mFlr;
    kit.setStage("floor");
    floorSegments(plan).forEach(function (s) {
      kit.box(mFlr,0,0.5,s.fzc,W-FIN*2,0.42,s.fl);
    });
  },
};
