# Where this designer deliberately behaves differently from Barnwright's

The drawing engine draws a building exactly like Barnwright's (the golden test
proves it triangle for triangle, on Barnwright's own company with Barnwright's
numbers). This list is everything ELSE that behaves differently on purpose,
with the reason. Each change is either a real bug in Barnwright's designer
that this product should not inherit, or something a standalone product
needs, or Alan's own choice. #26 and #28 change the shape of a finished
building (Alan's shop numbers on ten standard styles); one (#25) changes its
light, because Alan chose the Yoder site's.

If you find a difference that is not on this list, it is a bug — or it belongs
on this list with a reason.

## Drawing

The separate `learn.html` floor lesson is an opt-in teaching view. It uses
Alan's confirmed actual timber sections, 16 ft skids, 1 in notched seating,
16/12 in spacing and the outside-wall-to-inside-skid-face offset recorded in
[the example](examples/10x16-side-loft.md). It starts with skids only and
adds layers by hand. Its close-up camera and anchored dimensions let Alan
check the connection. Remaining layout assumptions stay labeled; the normal
finished designer retains the golden geometry.

1. **The first picture after a change has its shadows.** Barnwright draws the
   first frame after every rebuild with NO cast shadow at all: its shadow pass
   left the normal and texture attribute slots switched on after the rebuild
   had deleted their buffers, so WebGL refused every shadow draw on that frame
   (the shadow map had already been cleared). Barnwright only redraws when
   something asks, so its customers see the building without its shadow after
   every colour tap or option change until the camera moves -- and on the FRONT
   picture of a quote's thumbnails. The fix switches those two slots off in the
   shadow pass; no number changed. Measured: about 150,000-190,000 pixels differ
   between Barnwright's first and second frame. *(The golden look pictures are
   Barnwright's settled second frame, which is what this engine draws first.)*
2. **The camera fits the building the Yoder-site way in the product**
   (`fit: "fitref"`): no sudden 16 % jump when the picture is a little taller
   than wide, so a 14x40 no longer runs off an iPad or phone screen. The golden
   and look checks use Barnwright's fit (`fit: "barnwright"`); the two agree at
   1440x900.

## Designs, prices and layout

3. **Reopening a design keeps its items where they were saved** — when the
   company, its price-list version (`cfg`), the style and the size all still
   match; items are only kept on their wall. Barnwright re-clamped every item
   on opening, which is not stable even for a standard layout (on a 12x32
   Single Slope the transoms moved 0.24 ft every time the design was opened).
   If anything has changed since the design was saved, it falls back to
   Barnwright's full clamp.
4. **Colours are saved and restored by NAME**, through the company's palette.
   Barnwright restored raw hexes, which could repaint a customer's building if
   the company's colour list changed.
5. **Nothing is silently dropped when a design is reopened.** An item, size or
   colour that no longer exists produces a plain warning on screen (and a
   company's `renames` map can point old names at new ones). Barnwright dropped
   unknown items without a word. A size no longer sold falls back to the
   company's fifth size, with a warning.
6. **A design saved with no items gets the standard doors and windows, laid out
   for its saved porch;** an explicitly empty item list stays empty; an item
   saved without a position is put at 0.
7. **Flipping the porch no longer turns an inside item's position into NaN.**
8. **The electrical package's fixtures are laid AFTER the standard doors and
   windows when the style changes.** Barnwright wiped them straight after
   laying them, so the package was charged but not drawn.
9. **One function prices a per-square-foot option**, for both the label on the
   button and the charge. Barnwright had two copies that could drift apart.
10. **A dormer the company does not sell cannot be picked** (Barnwright drew it
    and charged $0). `normalize` also takes off shutters, door windows and
    options a company does not sell.
11. **Money is always written in US format** (`$6,675.00`). Barnwright used the
    visitor's browser locale. Identical for every US browser.
12. **Changing size re-lays the standard doors and windows only when the
    customer has not touched them**; otherwise their items are kept and moved
    onto the new walls, as Barnwright does (one exception on the shop
    standard: the door of the Side Utility, Dormer Shed and Side Lofted
    Barn follows the size, #27).

## Standalone product

13. **No sign-in, no database, no Barnwright backend.** Staff modes (dealer,
    Small Shop, Headquarters), the price lock, the visit counters and the SMS
    consent call to Barnwright's server are not part of this product.
14. **A shared link carries no price anyone should trust.** A share page prices
    from the company's current list and says so when the link was priced
    differently. (Barnwright could freeze a price because the record lived on
    its server.)
15. **Every text from a company file, a link or a lead is fully HTML-escaped.**
    Barnwright's view page escaped only some characters.

## Added while building the product (Sep 26 2026)

16. **A double window is measured at its real width** (two windows and the
    shared board) in the gap readout and the "ease onto the middle" snap.
    Barnwright measured it as a single window, so the floor plan said 6'-11"
    where the real gap was 5'-9". `model/layout.js neighborGaps`;
    `tools/check-model-live.mjs` holds every other opening to Barnwright's
    numbers and double-window walls to Barnwright's own code re-run with the
    real width.
17. **An item the catalogue no longer has, or on a wall the building does not
    have, draws nothing** instead of stopping the whole drawing with an error.
    (The design loader already warns about it in plain words.)
18. **The ramp is drawn in 3D** when a 4 or 6 ft ramp is chosen (Barnwright
    only priced it and drew it on the floor plan). It is new geometry on its
    own building step, so every building without a ramp is unchanged.
19. **The floor plan** (ui/blueprint.js lists each one in its header):
    a double window drawn as wide as it is; the side porch outlined where it
    really is; the ramp drawn where the 3D ramp is; a plan that would run off
    the paper made a little smaller; the plan kept clear of the view buttons
    and, on phones, of the price plate; a lifted finger no longer "clicks" the
    Outside button underneath; a tap never slides the picked item; tapping
    empty paper does not rebuild the building.
20. **Customer views are Outside and Inside only**: Framing and Watch it
    build were removed at Alan's request. Customer rebuilds never construct
    framing, and no construction player, captions or timers load. The
    finished geometry is unchanged. Lessons and skills remain internal
    onboarding aids, separate from the client website.
21. **Construction settings are checked when a company is loaded**: a lumber
    size that is not one ("2y4"), a spacing of 0, an unknown build step and so
    on are refused in plain words, before they reach the model or internal previews.
22. **Managed dealer orders are verified on the server**: lot links retain
    their recipient, submitted prices and free-item flags are checked against
    the business catalogue, and duplicate submissions return one receipt.
    Turning off an electrical package clears its outside-light toggle, including
    dormant toggles in older saved links when opened in the customer designer.
23. **The standard colours are black and gold** (Alan, Oct 2026: "Have the 3d
    design same theme" as the Dealer Center), not Barnwright's navy and red:
    a black header, gold buttons, a warm light page (`ui/styles.css`), and
    the same for the sample company, a new business and the company
    template. A company that picks its own colours still gets exactly
    those. Three rules come with it (`ui/app.js themeTokens`): the words on
    a button turn dark when white would be hard to read on the button colour
    (a gold or orange button; a red, blue or green one keeps white words);
    the see-through panels over the building (the hint, the view buttons,
    "Tap to design") follow the company's colour instead of staying navy;
    and warnings and wrong boxes keep their own red instead of the button
    colour. Only colours change: the type, sizes, spacing and boxes are
    still Barnwright's (`tools/check-ui.mjs` section 14), and the building
    is untouched. The floor plan stays a blueprint on navy paper.
24. **"Your quote" has three things from the Yoder site** (Alan, Oct 2026,
    with a picture of his own quote card: "Add this to the 3d design"), not
    from Barnwright's 3D designer: a rent-to-own box under the total when the
    company shows a rent-to-own term (a chip for each term on its price list
    and "As low as $x.xx/mo", price / factor / months to the cent, the plate
    showing the same figure); the address asked as Street and City under an
    "Address" heading ("Can skip if you already sent it to us."); and "What
    do you want to do with this quote?" with four answers, none required
    (`leads.askPlan: false` leaves it out). The city, the answer and the term
    ride along with every way a quote is sent, and the Dealer Center keeps
    them on the customer. Alan's "Copy link to this building" button is on
    the Dealer Center's design page instead (he asked for it there, "not on
    the website link that customer would use"): it copies the lot's
    designer link with the exact building in it for the dealer to send.

## The building's look (Oct 2026)

25. **Buildings are lit the way the Yoder Storage Barns site lights them**
    (Alan, Oct 6 2026: "use the 3d configuration in yoder storage barns and
    update the rest of the repository", then "change the building looks
    only"). True colour (`look.trueColour`) is now the standard: the demo,
    the template, the starter and any company that leaves `look` out get it,
    and so does a new Dealer Center business started from the demo. It is
    the Yoder site's three look changes, each read against
    `yoder-storage-barns/design.html` by `tools/check-shaders.mjs`:
    * its fragment shader (`FSTRUE`): a white sun, glint and highlight at the
      same brightness as Barnwright's gold ones, and no per-sheet colour
      shift (each sheet of siding only a few percent lighter or darker);
    * its rooms (`TRUE_SCENES`): the studio's light, floor, haze and backdrop
      neutral grey;
    * its darker contact shadow under the building (`texAO` from `#3f3f3f`
      instead of Barnwright's `#565656`). Barnwright took the website's
      designer on Aug 6 2026 with the lighter one; the website darkened it
      after.
    Only colours change: every triangle, the camera, the draw order and the
    see-through outline are the same both ways (`tools/check-look.mjs`).
    Barnwright's warm light stays for the Barnwright company the golden and
    look checks draw, so they still prove every triangle and every pixel is
    Barnwright's. Since Oct 10 2026 Barnwright's own designer wears the same
    look (Alan: "yes change"), so the two agree; the checks open Barnwright
    at `3ddesign.html?light=warm`, where its warm light is untouched, and
    `tools/check-shaders.mjs` proves Barnwright's true-colour shader, rooms
    and contact shadow are the Yoder site's. A business set up on the Dealer Center before this keeps the
    light it was saved with.

    **Not taken from the Yoder site**, because Barnwright fixed them after it
    took the site's designer on Aug 6 2026 (the site never got the fixes) and
    the fix is the better building: the door
    threshold and the roll-up's floor plate are drawn facing out (the site
    draws them inside out, so they never show); the corner boards cast the
    gentle hairline shadow (`texAOcorner`), not the eave's dark band; a
    door's side casings stop under the head board with a shadow in the
    reveal; the octagon gable window shrinks to fit a small gable; a door
    made of a metal building's siding wears the steel texture; the roof
    underside reads the roof shape before using it; and the double window's
    shared middle board is Barnwright's. The site's paint colours (its exact
    Weather King chips, `designer-colors.js`) are a company's colour list, not
    the building's look, and are not changed; that question is with Alan
    (docs/FOR-ALAN.md, Choices about the product).

## Alan's shop numbers (Oct 2026)

26. **Standard buildings use Alan's shop numbers where he confirmed them**
    (Alan, Oct 11 2026: "yes match", for every dealer; then, after the
    before-and-after and proposal pictures, yes to six more styles, "not
    metal garage"). They are "How it's built" blocks on the library styles
    in `library/manufacturers/standard.json` (each with its `_source`), so
    every company on the standard line gets them, and a Dealer Center
    business can still set its own:

    | Style | Number | Barnwright | Now | Source |
    |---|---|---|---|---|
    | Utility Shed, Side Utility, Garage | roof pitch | about 6 1/2/12 (6.48/12) | 5/12 at every width | utility-framing skill: standard A-frame pitch |
    | Utility Shed, Side Utility, Garage | eave | about 4 7/16 in | 4 in, measured level | utility-framing skill: 4 in beyond each side wall |
    | Utility Shed, Side Utility, Garage | wall | 7 ft 9 in | 7 ft 9 1/2 in | 89 in studs + three 1 1/2 in plates (derived) |
    | Dog Kennel, Garden Utility | roof pitch | about 6 1/2/12 | 5/12 (walls as they were) | the same utility pitch, picked by Alan |
    | Dog Kennel, Garden Utility | eave | about 4 7/16 in | 4 in, measured level | the same utility eave |
    | Dormer Shed | main roof | about 7 1/4/12 (7.2/12) | 7/12 (eave, walls and dormer as they were) | utility-framing skill: Alan's steep pitch |
    | Lofted Barn, Side Lofted Barn, Metal Lofted Barn | wall | 6 ft 8 1/16 in (80.04 in) | 6 ft 7 1/2 in | 75 in studs + three 1 1/2 in plates (derived) |
    | Lofted Barn, Side Lofted Barn, Metal Lofted Barn, Lofted Barn Garage | barn roof height at 8, 10, 12 ft wide, to the top of the trusses | 3 ft 6 3/4 in, 4 ft 5 9/16 in, 5 ft 4 5/16 in (the Metal Lofted Barn 3 ft 5 5/8 in, 4 ft 4 7/16 in, 5 ft 3 3/16 in; the Lofted Barn Garage is sold 12 ft wide only) | 3 ft 7 3/4 in, 4 ft, 4 ft 3 in (the Lofted Barn Garage on its own 6 ft 10 13/16 in walls) | shed-measurements skill: loft truss peaks |
    | Side Utility, Dormer Shed, Side Lofted Barn 8x12, 10x12 | standard door | 72″ Wooden Double Doors, a 2x3 window 2 3/8 in into them (the designer pushes the doubles 5 1/4 in left of the middle and the left window 5/8 in further out to make room) | the 48″ Wooden Door in the middle of the door side, where the recipe puts the doubles; the two windows 4.4 ft either side of the middle (the left one 5/8 in closer than before, so both sides match), about 9 5/8 in of siding between the door's side trim and each window's | Alan, Oct 11 2026, the Side Utility: "replace 6 foot to 4 foot"; Oct 12 2026, asked whether the Dormer Shed and Side Lofted Barn should get the 48 in door too: "yes" |

    What "match" means and does not: the peak heights and wall heights match
    his shop. A barn roof's height is measured where he measured it, from
    the top of the wall to the top of the trusses; the roof line drawn over
    the roof deck stands about 1/2 in higher (44 1/4 in on an 8 ft barn).
    The utility eave's 4 in is out to the edge of the roof deck; the rafter
    tail under it stops about 3 3/4 in out. The barn roof's knee is drawn where Barnwright drew it, so the
    drawn slopes are not his truss pieces (at 8 ft wide the upper slope is
    about 38 5/8 in long against his 34 in piece), and the barn eave moves a
    little with the lower slope (1 3/4 in out before; now 1 11/16 to
    1 3/4 in at 8 ft wide, 1 7/8 to 1 15/16 in at 10 ft and 2 1/8 in at
    12 ft, measured level; the Dealer Center's How it's built box says it
    width by width). The utility eave is 4 in
    out but drawn sloping, not his level 2 in end. The Dormer Shed keeps its
    eave board, which on the 7/12 roof reaches 4 3/8 in out, measured level
    (4 5/16 in before); its dormer front stays 1 ft 11 3/8 in at 10 and
    12 ft wide and is 1 ft 7 13/16 in at 8 ft wide (1 ft 8 1/2 in before).
    The 6 ft Garden Utility's 5/12 roof rises only 1 ft 3 in above the wall
    (the every-size check shows it as a warning, never a fault). A 14 ft
    wide lofted barn, and every other width he did not give, keeps the
    library shape, held so a wider barn is never lower (Alan: the 14 ft
    barns keep today's height). Its walls are the shop's 6 ft 7 1/2 in like
    the other widths, so a 14 ft Lofted Barn stands 9/16 in lower overall
    than Barnwright's. The Metal Garage ("not metal garage"), the
    Metal Utility (not picked) and the other 11 styles (the cabins, Standard
    Barn, cottages, Backyard Utility and Single Slope) keep Barnwright's
    numbers until Alan says yes; a yes is one built block, no code. A
    business-wide roof pitch does not reach the Dormer Shed's main roof (a
    style feature): it stays at the shop's 7/12.

    Because those roofs are lower, a gable window whose glass would poke
    through the roof is not offered on that gable (`model/layout.js
    gableItemFits`; Barnwright offers it and cuts it off at the roof): the
    18x24 on 8, 10 and 12 ft Utility Sheds and Side Utilities (on 8 and
    10 ft it already poked through at Barnwright's pitch), 12 ft Garages and
    8 and 10 ft Dormer Sheds; the octagon on 8 ft Utility Sheds, Side
    Utilities and Dog Kennels. Neither ever fitted the 6 ft Garden Utility.
    A design saved with one there opens with it taken
    off and one line saying so ("The 18×24 Gable Window is too tall for this
    gable, so it was taken off."), so the design the customer sends next is
    priced; the same happens when an owner's Steep roof that made it fit is
    taken off. Wall upgrades priced by the square foot follow the new walls.

    No sample price list a new business starts with has a Steep roof (Alan,
    Oct 11 2026: take it out); an owner can still make an option of their own
    with "Roof pitch at least" (the Options tab).

    The 8x12 and 10x12 Side Utility come with the 48″ Wooden Door, not the
    72″ double doors (Alan, Oct 11 2026, asked how his shop builds them:
    "replace 6 foot to 4 foot"), and so do the 8x12 and 10x12 Dormer Shed
    and Side Lofted Barn, which have the same door side and the same
    2 3/8 in (Alan, Oct 12 2026, asked whether they should get the 48 in
    door too: "yes"). It is each
    style's `built.standardSwaps` in the library (no How it's built box):
    the door the recipe puts in the middle of the door side becomes the 48″
    door, and the two 2x3 windows stay 4.4 ft either side of the middle, so
    neither runs into it any more (on the Dormer Shed with each of its
    dormers; the dormer stays where it was). Every other size of the three
    and Barnwright's own Side Utility, Dormer Shed and Side Lofted Barn keep
    the doubles. The door comes with the building at no extra charge, and
    the prices are as they were (Alan, Oct 12 2026: "no" to a lower price
    for the 8x12 and 10x12 Side Utility; the other two keep theirs too). A
    price list must still list the 48″ door ($0 is fine; the Dealer Center
    keeps it sold, names the sizes once for the styles that share them,
    and shows the problem before Save); one stored without it keeps the
    doubles and the owner is told, one line for each style, under a heading
    about a door. Only a style and size that newly needs the 48″ door is a
    new problem: taking a style or size off, or renaming one, saves as
    before. Where the 48″ door is sold, the double doors are needed only by
    the sizes that still come with them. A design that holds the other door
    of the pair: #27.

    Barnwright's own company is the standard line without those blocks
    (`tools/lib/barnwright-company.mjs barnwrightManufacturer`), so
    `check-golden`, `check-look` and `check-model-live` still compare with
    Barnwright number for number; `tools/check-shop-numbers.mjs` holds the
    shop numbers (the recorded set `test/golden-shop/shop-standard.json`).

27. **The door of the Side Utility, Dormer Shed and Side Lofted Barn
    follows the size on the shop standard.** The 8x12 and 10x12 come with
    the 48″ Wooden Door, their other sizes with the 72″ double doors (#26).
    A design can hold the other door of that pair as the one it came with,
    and the server prices only what the building comes with:
    - the customer touched the doors and windows and then changed the size
      (the size chip keeps their items, #12): the door they never swapped
      becomes the one the new size comes with, in its place, and nothing is
      said. A 10x16 with shutters made 10x12 is the 10x12's price plus the
      shutters, with the 48″ door; back to 10x16, the double doors, and
      their wall is settled again so the windows stand clear of them, where
      they would be with the double doors all along. A door they swapped it
      for stays theirs, in the place of the new size's door, priced as that
      swap (`ui/state.js chooseSize`, `model/design.js followStandardDoor`);
    - a design saved with the double doors on an 8x12 or 10x12, before
      this change reached the dealer's 3D designer, opens to change with
      the 48″ door in their place, not moved to the middle, at the price
      the customer saw, with one line: "The 8×12 Side Utility comes with
      the 48″ Wooden Door, so it takes the place of the 72″ Wooden Double
      Doors." ("The 8×12 Dormer Shed ...", "The 10×12 Side Lofted Barn ..."
      the same way). If they had swapped the doubles for another door, it
      is kept in the 48″ door's place and priced from it, and the line
      says how much more: "... so the 36″ In-Swing Door is kept in its
      place and costs $150.00 more than before." (no amount where a company
      shows no prices). Whether that is right is still asked (FOR-ALAN
      question 12). On a price list that no longer sells the double doors
      at that size, the same: the 48″ door, never no door (`toState`);
    - only looked at (a look-only link, `&view=1`: an order or quote
      sheet's picture, See it in 3D, a quote's link), the design is drawn
      as it was saved and sold, with the double doors, and nothing is said;
      Change this design (or any change) lets the door follow the size and
      says so (`toState(design, cat, { asSaved: true })`, `ui/app.js
      followToday`). An order or quote sheet lists what was sold.
    The designer and the server match items the same way; the stale design
    itself is "no longer offered" (refresh), never "could not be read"
    (`model/design.js followStandardDoor`, `tools/check-design.mjs` part
    11). Only a style with a library swap does this. Barnwright's own
    buildings, the Cottage among them (its 10x12 comes with the 48″ door,
    its 10x16 with the doubles), keep a touched design's door exactly as
    Barnwright does, at Barnwright's price.


28. **Actual opening-trim width and Yoder joints** (Alan, Oct 12 2026).
    The shop standard uses actual 3 1/2 in boards around doors and windows,
    including the head, sill, paired-window middle board and rectangular
    gable-window trim. The legacy renderer's casing was 3.24 in, with another
    0.24 in overlapping the opening; the shop boards now measure 3 1/2 in
    edge to edge. Door casings meet the head continuously, matching the Yoder
    site's joint. Alan's cabin correction sets
    `construction.openings.trim.porchBand: false`, removing the extra stacked
    opening band on every wall of Cabin, Lofted Barn Cabin, Side Cabin, Loft
    Side Cabin, Deluxe Side Cabin and Deluxe Loft Side Cabin. Their doors and
    wall windows keep one existing 3 1/2 in tapered head matching ordinary
    windows and rectangular 18x24 loft-window trim. Decorative faux loft
    rectangles and octagonal frames retain their design; porch perimeter
    and beam trim stay as drawn. Shared measurements in
    `model/opening-trim.js` keep the mesh, placement, floor
    plan, saved layout formulas and selection target together. The shop
    standard sets `construction.openings.trim`; the recorded Barnwright
    catalogue omits it and retains its original door reveal, extra porch
    opening band and exact geometry. Existing approved
    shop roof and wall dimensions remain. `tools/check-opening-trim.mjs`
    checks the emitted board faces across all styles and sizes.
