# Where this designer deliberately behaves differently from Barnwright's

The finished building is drawn exactly like Barnwright's (the golden test proves
it triangle for triangle). This list is everything ELSE that behaves
differently on purpose, with the reason. Each change is either a real bug in
Barnwright's designer that this product should not inherit, or something a
standalone product needs. None of them changes how a finished building looks.

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
    onto the new walls, as Barnwright does.

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
    them on the customer. Alan's own "Copy link to this building" button is
    not copied: Share my design already makes a link that reopens the exact
    building, every door and window where it was put.
