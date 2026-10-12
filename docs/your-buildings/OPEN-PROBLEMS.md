## Checker: alan-iphone

I walked through Alan's steps on build aabbbd3724d6. I checked first that index.html matches a fresh build from src/. I used an iPhone (390x844, scale 3, touch) and an iPad (820x1180), both with a 100 px app header laid over the top, in light and dark. Buildings walked: Cabin (sold in the sample), Side Cabin (added from Add a building), and also Lofted Barn Cabin, Wrap Porch Cabin and Loft Side Cabin. Scripts, logs and 243 screenshots are in /tmp/claude-0/-home-user/e3a7a9d0-6452-5b02-ade1-e66669b51e23/scratchpad/buildings-mockup/run/verify-alan-iphone/r4/ (walk.mjs, probe*.mjs, labels.mjs, lib.mjs, shots/).

Alan's three original problems are fixed. (1) On the Front wall the posts are now dashed outlines, with a line under the drawing: "Dashed: porch posts on the porch, 4 ft in front of this wall. Move them on the porch". Tapping a dashed post, low or high, opens the Porch view with that post picked. A tap on the door beside a post still picks the door. (2) Right after that tap, Move left/right, Add another post, Remove and Done are all fully in view and tappable on every device and theme. None are under the black bar or the app header, and the message never covers them. (3) The labels under the drawing never touch or run off. I checked every size, every view and every picked item of all six porch cabins on phone and iPad.

The rest of the walk works too:
- A finger drag along the porch moves the post, and the page does not scroll.
- Move is 3 in a tap, and 60 taps on one spot never miss the button.
- At the end it says "It's as close to the corner post as it can go."
- Remove, Porch post in the add list and Add another post all work.
- Cancel asks "Leave without saving the layout?" and both buttons are reachable.
- There were no page errors and no sideways scroll.
- On the Cabin, Save says "Everything fits on every size".

What is still wrong is the Side Cabin (and Loft Side Cabin) save result. Adding one porch post gives a warning about an 8 ft porch that Alan can never see on this screen, while the drawings right below say "Everything fits". Also, when the save result asks him to fix something, it gives him no way to stay on the layout screen.

My checker flagged three things that are not problems. "Doors and windows" looked partly covered only because of its rounded corners. The picked post's selection box looked covered only by its own tap area. And the top of a tall post sits under the app header on the phone, which the design allows (59 to 94% of the post shows).

I stopped my server on 13331 (pid 32284). Nothing is listening on 13330-13339.

### [should] Side Cabin and Loft Side Cabin: the result after Save as standard (src/layout.js checkLayout, checkWords, openLayoutResult; postSpot, clearOfPosts and the lay-dup case in layoutAct)
- Problem: Tapping Porch post once in the add list and then Save as standard gives a green "Saved as the standard layout" box. It says, twice (three times if Add another post was also tapped): "On the 10×20, 12×20, 12×24, 12×30 and 12×32 with the 8 ft porch, two porch posts stand in the same spot at the end of the porch. Move one, or remove it." Both drawings right under it say "Everything fits". Nowhere on the layout screen can the 8 ft porch be shown: no view, size or button draws it, and the plan keeps the porch length choices hidden there. The Edit page card says nothing about it either. Alan would say "what does that mean" and could not find or fix it. The fixer said a new post "never lands on another post". That is true only for the porch being drawn. Here the new post lands 10 ft from the front, and on the 8 ft porch it is held at the end in the same spot as the builder's post. BUILD-PLAN says that in this case the result "never says Everything fits", but here the drawings do.
- Steps: iPhone 390x844 with the 100 px header: Your buildings, Add a building, Side Cabin, Add as it is, Edit on the Side Cabin card, Doors and windows, Set the standard layout. Scroll to Add a door or window or a porch post and tap Porch post (message: "Added a porch post 10 ft from the front of the porch."). Tap Done, then Save as standard. Read the result. Script: run/verify-alan-iphone/r4/probe5.mjs; pictures shots/SC-phone-light-19-result.png and SC-ipad-dark-19-result.png.
- Fix: 1) postSpot, clearOfPosts and Add another post: pick a spot that stays at least 0.67 ft from every other post on every porch place the size allows (run the clear test inside withPorch for each place from porchPlaces). Fall back to the current rule only when no such spot exists, and then say so in the message. 2) In the Porch view and the Right side view of SC and LSC, add a "Porch the customer picks" select under "Size you're looking at". Its choices are each length and place, e.g. "12 ft at the front (opens first)", "8 ft at the front", "8 ft at the back end", "8 ft in the middle". It sets PVAR for drawing, so Alan can see the posts that stand together. 3) In the result, write one line for all porch places that share the same sizes, e.g. "If a customer picks the 8 ft porch, two porch posts end up in the same spot at the end of the porch, on every size. Pick the 8 ft porch above the drawing to see it, then move one post nearer the front of the porch." Add a drawing for that porch place marked "Two posts in one spot", and never show "Everything fits" on a drawing while a line above it reports a problem.

### [should] The every-size result when the layout is saved but a line asks for a change (src/layout.js openLayoutResult and the sheet close handler / finishSaved)
- Problem: When two posts stand in one spot, the result is a green check box headed "Saved as the standard layout" that also says "Move one, or remove it." The only button is "Back to Edit building", and the X also goes back to the Edit page. To do what it asks, Alan has to find Doors and windows again, tap Change the standard layout, then find the porch and the post. He would say "I couldn't": the screen tells him to move a post and then sends him away from it.
- Steps: iPhone with the header, open #layout-C. Tap the Porch tab, tap the left brown post, then tap Move right 16 times ("It's standing on another porch post. Move it along, or tap Remove."). Tap Done, then Save as standard. The green box says "Two porch posts stand in the same spot on the front of the porch. Move one, or remove it." and the only way out is Back to Edit building. Script: r4/probe4.mjs; picture shots/probe4-C-02-stacked-result.png.
- Fix: When checkWords returns lines for a saved layout, head the sheet "Saved. One thing to look at" and show the lines in an amber box (the .lres.bad style with an info mark), not the green one. In the sheet foot, add a "Keep working" button (data-act lay-result-x) before "Back to Edit building". It keeps the layout screen open, goes to the Porch view at the first size the line names (and the porch place, once the fix above exists), and picks one of the two posts. Make the X do the same as Keep working while such a line is shown.

### [nice] Porch view right after tapping a dashed post (src/page.js placeToasts; src/layout.js openGhost)
- Problem: The message "This is the porch. Drag the post along the porch edge, or tap the Move arrows." sits right on top of the line that explains the drawing ("Brown posts move. The hatched corner posts hold up the porch roof, so they stay. The pale drawing is...") for 4 seconds. That is on the phone and the iPad, light and dark, exactly when Alan first lands on this view and most needs that line.
- Steps: iPhone 390, open #layout-C, Front, 10×20, tap a dashed post beside the door. See shots/C-phone-light-06-tapped-post.png and C-ipad-light-06-tapped-post.png.
- Fix: In placeToasts, on the layout screen, also keep the message off #lay-links and #lay-cap. Put it just above the sheet only when that leaves both lines clear; otherwise put it at the top, below the 116 px line. Or leave the message out of openGhost and start the caption, for that one draw, with "This is the porch. ".

### [nice] Taps that do nothing: the pale door and windows in the Porch view, the drawn PORCH on the Side Cabin's front, and the porch end on the Cabin's side walls (src/layout.js bindLayout click handler)
- Problem: Each of these taps gives no answer at all: the pale door behind the porch in the Porch view, the PORCH part of the Side Cabin's Front wall, and the porch end on the Cabin's Right or Left side. Coming from the Front wall, Alan sees the Porch view, which looks like the front with its door, and taps the door to move it. Nothing happens, so he would say "I couldn't move the door". The Side Cabin's Front wall shows the porch but has no hint about where its posts are, unlike the Cabin's line "Dashed: porch posts... Move them on the porch".
- Steps: iPhone with the header: open #layout-C, tap Porch, then tap the pale door (no message, nothing picked; r4/probe3.mjs). Side Cabin added, Set the standard layout, Front: tap PORCH in the drawing (nothing; r4/probe2.mjs, shots/probe2-SC-F-01-porch-zone-tap.png).
- Fix: In the drawing's click handler: a tap inside .wv-behind shows "That's the front wall behind the porch. To move its door or windows, tap Front." and the Front tab gets focus. A tap on .wv-zone.porch, or on the porch end of a side wall, opens the Porch view (lay-wall with postView or P). In linksHTML, when a wall has a porch part but no posts, add the link "The porch posts are on the side of the porch. Go to the porch".

### [nice] A finger drag that starts on a dashed post on the wall (src/layout.js bindLayout pointerup for ghostDown and openGhost)
- Problem: Dragging the dashed post on the Front wall opens the Porch view with that post picked, but the post does not move with the finger. Alan has to drag a second time. The message explains it, but the first drag reads as "it didn't move", which is what Alan reported.
- Steps: iPhone, open #layout-C, Front, 10×20. Touch the dashed post beside the door and drag 60 px right. The post stays at 2 ft left of the middle, and the Porch view opens with it picked (r4/probe.mjs part A).
- Fix: When a drag starts on a dashed post and the finger moves more than 8 px, call openGhost and then start LAY.drag on that post with the same pointer (x0 from svgX in the new drawing, p0 = its position), keeping pointer capture on #lay-wall. The rest of the same finger movement then moves the post along the porch edge.

### [nice] Words in the line under the drawing (src/layout.js linksHTML)
- Problem: "hatched" is not a word most people use, and "Dashed: porch posts on the porch..." reads like a map key rather than a sentence.
- Steps: Open #layout-C. Read the line under the Front wall drawing, then tap Porch and read the line under the porch drawing.
- Fix: Say "The striped corner posts hold up the porch roof, so they stay." and "The dashed posts stand on the porch, 4 ft in front of this wall. Move them on the porch". Change the matching words in the corner post message and in BUILD-PLAN section 10.

## Checker: regression

I tested the final build (index.html aabbbd3724d6) without rebuilding anything. Two "should" problems are left, so this does not pass. Both are buttons hidden under the black bottom bar on a 390 px phone, and both predate this round: the same code is in run/before-porch.

All three things Alan reported are fixed:
- On the Front wall the porch posts are drawn as dashed outlines, with a note under the wall pointing to the porch.
- Tapping a dashed post opens the Porch view with that post picked. Move, Add another post, Remove and Done all show above the black bar at 390 (with the 100 px app header), 820 and 1280. The post shows 97% at 390.
- The labels under the wall sit on two lines ("10 ft long" above "Left corner" and "Right corner"). The sweep found no labels running together anywhere.

Check results:
- check-files: 33 pictures used, 33 in thumbs/, none missing or unused.
- Page rules: title first, no doctype, html, head or body tags, no localStorage, sessionStorage, alert, confirm, prompt or fetch, only Google Fonts addresses. Both dark blocks are present in page.css and layout.css. One colour literal sits outside the tokens, as a var() fallback (a "nice" item below).
- smoke: no errors and no sideways scroll at 390 and 1280 on the list, Edit, Add a building, empty start and 8 layout screens.
- flows: 44 of 44 pass. layout-flow: 148 of 148 pass. I ran copies in run/verify-regression/r6/ so their output stayed in my folder.
- Sweep: my copy ran on port 13342 and found 218 records in the same 5 groups the fixer reported. Those are the two known small-tap groups (Single Slope transoms, dashed posts on long side walls) and 3 notes. There were no console errors, no crashes and no "sheet not in view" records.

My own walk covered 40 screen states at 390 (iPhone with the 100 px header), 820 and 1280, light and dark (240 runs). It found:
- no console errors, no failed or 404 loads, and no sideways scroll;
- no overlapping, run-together or cut-off text, and no taps under 44 px in those states;
- one control that cannot be tapped: a porch post standing on top of another. The page says so ("It's standing on another porch post. Move it along, or tap Remove."), so I counted it as expected.

The keyboard walk (Tab through 10 screens at 820 and 1280, light and dark) showed a focus mark on every stop, and no focused control sat under the black bar. Picture requests stay at 0 while switching every wall and size on the Cabin, Lofted Barn Cabin and Side Utility and adding 30 windows.

Every slash-free, word-list scan of 650 page strings came back clean.

Servers: I stopped mine (13341 pid 32188, 13343 pid 11264, and the sweep's own on 13342, pid 2011). One server is still running in my port range, on 13340 (pid 5981), started Oct 11 by an earlier round. I did not start it and did not stop it.

Files are in /tmp/claude-0/-home-user/e3a7a9d0-6452-5b02-ade1-e66669b51e23/scratchpad/buildings-mockup/run/verify-regression/r6/:
- logs: check-files.log, smoke.log, flows.log, layout-flow.log, sweep.log
- reports: sweep-out/results.json, walk-report.json, focus-report.json
- screenshots: walk/*.png
- repeatable checks: walk.mjs, focus.mjs, tokens.mjs, words.mjs, probe-refusal.mjs, repro-reset.mjs

### [should] Edit page, refused save, phone 390 (src/page.js around line 1166, in the refused branch of the save: window.scrollTo(0, 0))
- Problem: After a refused save on a phone, the refusal's own fix buttons sit under the black save bar. The first is "Make the walls 6 ft 10 1/2 in", the second "Put the walls back to standard". The refusal box runs from y 453 to 835, but the black bar starts at y 722, so both buttons show as "under the bottom bar". This happens with or without the 100 px app header. At 820 and 1280 both buttons show. The same code was there before the porch work.
- Steps: Phone 390x844, touch on, 100 px fixed overlay at the top. Open index.html#edit-SU, type 6 ft 6 in into Wall height (#k-wallHeight), tap Save for all lots and wait 1.7 s. Measured with run/verify-regression/r6/probe-refusal.mjs. Picture: run/verify-regression/r6/walk/b-edit-refused-390-light.png.
- Fix: Replace window.scrollTo(0, 0) with box.scrollIntoView({ block: "nearest" }) and keep box.focus({ preventScroll: true }). The page already sets scroll-padding-bottom to the bar height and 116 px at the top on phones, so the whole 382 px box lands between the app header and the bar. Add a flows.mjs check: at 390 after this refusal, every [data-act=fix] button is in view above #savebar.

### [should] Edit page after a saved standard layout, the "Go back to the builder's layout" confirm, phone 390 (src/layout.js line 2020, case "lay-reset")
- Problem: On a phone, tapping "Go back to the builder's layout" opens the confirm. "Go back to the builder's" shows, but the safe choice, "Keep yours", is fully under the black bar: its top is at y 730 and the bar starts at y 722. The code only focuses #lay-reset-yes and never brings the whole confirm into view. At 820 and 1280 both buttons show. The sweep's flow 5 only checks #lay-reset-yes, so no check caught this. It predates the porch work (same line in run/before-porch/layout.js:944).
- Steps: Phone 390x844 with touch, with or without the 100 px header. Open #layout-LB and tap the Right tab. Add 36" 11-Lite Door, tap From the front corner, type 1 ft 6 in and tap Set. Add a 2x3 Window twice, tap From the back corner, type 2 ft and tap Set. Tap Save as standard, then Back to Edit building, then Go back to the builder's layout where it shows. Script: run/verify-regression/r6/repro-reset.mjs (picture repro-reset-390-hdr100.png).
- Fix: In case "lay-reset", after redrawDoorsCard(), call main.querySelector("#sec-doors .confirm").scrollIntoView({ block: "nearest" }), then $("#lay-reset-yes").focus({ preventScroll: true }). scroll-padding-bottom already equals the bar height. In run/sweep/sweep.mjs flow 5 (the cv check) and in layout-flow, also require [data-act=lay-reset-no] to be in view.

### [nice] src/page.css line 422: dialog.sheet::backdrop { background: var(--scrim, rgba(10, 9, 7, .55)); }
- Problem: This colour literal sits outside the :root token blocks, as the var() fallback. The fixer's report said there were 0 literals outside the tokens.
- Steps: node run/verify-regression/r6/tokens.mjs index.html
- Fix: Also set --scrim on ::backdrop in the three token blocks (":root, ::backdrop { --scrim: ... }" and the same under both dark blocks), then drop the literal fallback.

### [nice] Layout screen tap areas: Single Slope tall wall at 390, and dashed posts on long side walls of the side-porch cabins at 390
- Problem: These are the known groups, unchanged this round. 36x12 transoms on the SS 12x24 Right wall have tap areas 37 to 43 px wide (156 records). Dashed posts on the Right wall of the DSC, SC, LSC and SLC are 43 px wide (56 records).
- Steps: run/verify-regression/r6/sweep-out/results.json, groups tap-under-44.
- Fix: Grow the transom tap areas into the gaps between them, as the Porch view already does for posts. Alternatively, offer the same "The one to the left" and "The one to the right" buttons in the transom sheet. Widen the dashed post band by 1 px.

### [nice] Porch view, three posts 1 ft apart (shots e-porch-no-stack)
- Problem: The middle post's tap area is 22 px at 390 and 27 px at 820. The sheet offers "The one to the left" and "The one to the right", so it can still be picked.
- Steps: run/shots-report.json, e-porch-no-stack 390 and 820.
- Fix: Leave as is, or let a tap on a 22 px middle post also pick the nearest post and show the step buttons.

### [nice] Edit page "Doors and windows that come with it" card after one cabin porch post was moved
- Problem: The post still at the builder's spot is described as "Porch post, where the builder puts it, 2 ft each side of the middle". Next to the moved post on the same line, that reads like two posts.
- Steps: At 390, open #layout-C and tap the Porch tab. Tap the left post, tap the left Move arrow 6 times, tap Done, tap Save as standard, then Back to Edit building. Picture: walk/e-porch-edit-390-light.png.
- Fix: For a single post at the builder's spot, say which side it is on: "Porch post, where the builder puts it, 2 ft right of the middle".

### [nice] Layout screen, gap box ("Gap from the back corner" then Set), 390 and 1280
- Problem: After Set, the wall drawing is off screen, so the picked window shows 0%. The result is only said in words ("On every size: 2 ft from the back corner") and on the floor plan.
- Steps: Do the layoutDemo steps on #layout-LB (as in repro-reset.mjs) and stop after the second Set. Pictures: walk/e-layout-editing-390-light.png and walk/e-layout-editing-1280-dark.png.
- Fix: After lay-gap-set, call revealPick() only when the drawing is fully out of view. Or add a short "See it on the wall" link next to the result line.

### [nice] 1280 Edit and Add a building pages: the back link above the heading
- Problem: The heading's line box takes the bottom 3 to 5 px of the 44 px "Your buildings" or "Add a building" button. A click on its lowest edge lands on the heading and does nothing. It looks fine.
- Steps: At 1280x900 open #edit-UT. elementFromPoint at y = button bottom - 2 returns h1#h1. Script: run/verify-regression/r6/probe-crumb.mjs.
- Fix: Give the back link a 4 px bottom margin, or set line-height: 1.1 on the heading at desktop width.

## Checker: true-to-designer

The mockup's porch posts match the real 3D designer on the points you asked about. Four problems need fixing in BUILD-PLAN.md section 10 before it is right, and four more should be fixed. All were checked against the real code in /home/user/wt-dc-fast, read only.

**What matches the real designer (checked in the code and on screen):**
- **Which styles have posts:** the six porch cabins: Cabin, Lofted Barn Cabin, Side Cabin, Loft Side Cabin, Deluxe Side Cabin and Deluxe Loft Side Cabin.
- **Where the builder's posts stand:** Cabin ±2 ft. Side Cabin 3.8 and 8.2 ft from the front of a 12 ft porch, and the mirror of that with the porch at the back. Deluxe Side Cabin ±W/6 across the front and 6 and 10 ft down the side. With an 8 ft porch, one builder post is held at the end.
- **How far a post can move:** front porch W/2 - 0.8 ft, so ±3.2, ±4.2 and ±5.2 ft. Side porch 0.85 ft from each end, front, back or middle. Wrap porch 0.85 ft in from the corners across the front, and 0.85 to 11.4 ft down the side. The limit words (10 3/16 in and 7 3/16 in) are right.
- **Railing way in:** widest gap on front and wrap porches, the bay in front of the porch door on a side porch.
- **Adding a post:** matches the designer's first free spot from the middle. On the 10×20 Cabin that is the middle, in front of the door, and the way in then moves.
- **Add another post and Remove:** Add another post is the designer's Duplicate (1.5 ft along). Remove works on every post. Layout mode's own changes (turning back at the end, never landing on another post) are written down in the plan.
- **Price:** posts in the standard layout come with the building ($0 in the demo and starter price lists).
- **Carry-over words** are right.
- **The plan's twins** for Cabin, Lofted Barn Cabin, Deluxe Side Cabin and Deluxe Loft Side Cabin equal the real layout at all 68 sizes. The porchStart numbers (-9, 9 and -3) are right. Every line number the plan cites is right. No banned words.

**The problems:**
- **The every-size check uses rules the real fit check doesn't have.** The plan's check knows the Single Slope's transom row, the open porch and the dog run. The real fit check that every customer's 3D designer runs has none of them.
  - On the Single Slope, an owner's window is left off on every size, while the check says it is kept on 4 sizes.
  - Where the check says a window is "left off", the real designer moves it out of the porch instead. In the plan's own Side Cabin test, the moved window overlaps the builder's window by 10.8 in.
- **The server refuses some quotes.** It rejects a design that has more of an item marked included than the standard layout has for its size or porch. On today's code, picking the 4 x 8 porch on a 12×24 Side Cabin gets "This design could not be read". So does resizing a moved Cabin from 10×20 to 8×12. Owner layouts will make this happen more often, and the plan doesn't mention it.
- **Two of the plan's tests are wrong.** Test 19's Cabin right-side window case expects the wrong result. Test 18's "within 4 in is center" would undo a single 3 in Move tap.
- **Smaller points (nice to fix):**
  - The porchDoor anchor is not fully defined (which door it counts from, and which way is plus).
  - The 250-item cap leaves a customer no room to add anything.
  - A tie between railing gaps on the wrap porch's side opens a different bay than the real designer does.
  - Porch-place words don't match the designer's Flip porch and Middle porch.
  - Four small wording points.

Scripts and pictures are in /tmp/claude-0/-home-user/e3a7a9d0-6452-5b02-ade1-e66669b51e23/scratchpad/buildings-mockup/run/verify-true-to-designer/. They are probe-designer.mjs, ss-compare.mjs, sc-porch-compare.mjs, sc-middle.mjs, server-inc.mjs, server-porch.mjs, cabin-side.mjs, tie.mjs, walk-porch.mjs, walk-side.mjs and mock-check.mjs, plus shots/. The browser scripts need the mockup served on port 13353 (node src/serve.mjs 13353). The real-code scripts only import /home/user/wt-dc-fast. I served only on 13353 (pid 9141) and stopped it by pid. Nothing is listening on 13350-13359. I changed nothing outside that folder.

### [must] BUILD-PLAN.md section 10, "The every-size check" (the "Three rules fitsWall does not have" bullet: The Single Slope's transom row) and "Windows get ifFits: true"
- Problem: The check and every customer's 3D designer disagree on the Single Slope's tall wall. The plan adds the transom-row rule only to the new layout-check.js. The real runtime that every lot's 3D designer uses is evalDataRecipe's ifFits -> fitsWall (model/loadouts.js :279-291), and the plan does not change it. fitsWall measures an owner's window against the builder's transoms, which come first in the recipe, so it drops the window. Example: an owner's 2×3 window between the door and the right window, under the transoms (3 ft 6 in right of the middle on the 10×20, saved as the same share of the wall). The real recipe leaves it off on all 9 Single Slope sizes. The mockup check (and the plan's check) says it fits on the 10×20, 12×20, 12×24 and 12×32. The owner is told it is kept, but no customer ever gets it.
- Steps: Serve the mockup: node src/serve.mjs 13353. Run node run/verify-true-to-designer/ss-compare.mjs. The "real 3D designer" column says LEFT OFF for all 9 sizes; the "mockup's check" column says kept on 10x20, 12x20, 12x24 and 12x32. probe-designer.mjs section 1 shows the same with a window at pos 3.5 on the 10×20.
- Fix: In section 10, move the three rules into the real fit check instead of a second copy. model/loadouts.js fitsWall takes the style (roof, porch, kennel) and ctx.span, and applies the clampPos band rule (model/layout.js :106-107): on a single slope's R wall a transom keeps clear only of transoms, and a door or window only of doors and windows. layout-check.js calls the same function, so the check and every customer's 3D designer give one answer. Add to test 17 or 19: evalDataRecipe of the SS twin plus {cat:"w23",wall:"R",at:{pos:"len*0.175"},ifFits:true} keeps the window on the 10×20, 12×20, 12×24 and 12×32 and leaves it off on the five smaller sizes, exactly as layout-check.js says.

### [must] BUILD-PLAN.md section 10, "The open porch and the dog run are not wall", "Every place a customer can put a side porch", test 19 ("a window set 2 ft right of the middle of the Side Cabin's right side on the 12×24 is left off 'with the porch in the middle' (the 3D designer would push it to 7 ft 6 in)"); mockup src/layout.js placeAt/rangeWhy and the Edit card's "(left off the … when the customer moves the porch)"
- Problem: When a door or window would stand in the open porch or on the dog run, the check says "so it's left off there". The real 3D designer does not leave it off. evalDataRecipe's ifFits knows no porch or run, so it places the window, then resetItems -> clampPos moves it out of the porch. clampPos's porch rule runs after the push-apart passes, so the moved window can land on another one. The plan's own test 19 case on the real code: SC 12×24, Middle porch puts the owner's window at 7.5 ft and the builder's at 8.7 ft, overlapping by 10 3/4 in. With the porch at the back (a re-lay), on the 10×20 and 12×20 the window is kept at -3.5 ft, 4.8 in from the builder's window. The check says left off in every one of these cases. Also, the plan never says that the real Flip porch mirrors the items (model/design.js flipPorch) and that 4 x 8 porch only clamps them (ui/state.js choosePorchLength). The recipe is laid out again with the porch at the back or 8 ft long only on a re-lay: Middle porch then Corner porch, setType, or a size change on an untouched layout.
- Steps: Run node run/verify-true-to-designer/sc-middle.mjs. The pMid line shows right-side windows at 8.70, -8.70 and 7.50, smallest gap -10.8 in. Run node run/verify-true-to-designer/sc-porch-compare.mjs with the server on 13353. Every "back" row shows the real designer keeping the window, moved (on 10x20 and 12x20, 4.8 in from the next window), while the mockup column says "left off (porch)".
- Fix: Give the real fit check the porch and run rules: fitsWall (model/loadouts.js) gets ctx.span and the style, and refuses a door or window whose middle is inside the side porch notch, the wrap porch deck or the dog run plus clampPos's margins (model/layout.js :114-153: 0.45 ft beside the porch on R and L, 0.35 ft on F and B, 0.55 ft from the run). Then ifFits really leaves the window off where the check says so, and layout-check.js uses the same function. Add a test: evalDataRecipe + clampPos for SC 12×24 with pMid and the owner's window at len*0.0833 leaves it off, and on every size and porch place no two right-side windows end up closer than 7 1/2 in. In the porch-place bullet, add one sentence: "Flip porch mirrors the items and 4 x 8 porch only moves them along (design.js flipPorch, state.js choosePorchLength); the mirror of a layout that fits always fits, so the check works out the re-laid places."

### [must] BUILD-PLAN.md section 10, "What is saved": "Beyond those, nothing else changes: resetItems, stdDouble and the porch walls in design.js :362 all go through standardItems"; "What customers see"
- Problem: The list of standardItems users leaves out server/office/pricing.js :134-160. There the server counts how many of each item the standard layout has for the design's current size and porch, and refuses the whole quote (unreadable: "This design could not be read. Refresh the page and try again.") when the design has more included items than that. The real code fails today: a 12×24 Side Cabin where the customer taps "4 x 8 porch" is refused. So is a Cabin 10×20 whose door was nudged, then made 8×12 (the front windows stay included, but the 8 ft wide recipe has none). The same goes for the Backyard Utility from 6×12 to 6×8. The plan's owner layouts make this much more common: every owner window with ifFits or a when that drops on some sizes or porch places gives a refused quote once a customer has moved anything and then changes size or porch.
- Steps: node run/verify-true-to-designer/server-porch.mjs: "tap 4 x 8 porch" and "Middle porch, then 4 x 8 porch" give REFUSED, and marking the second porch window not included makes it price ($12040). node run/verify-true-to-designer/server-inc.mjs: C 10x20 -> 8x12 and BU 6x12 -> 6x8 are REFUSED.
- Fix: Add server/office/pricing.js to the standardItems list in section 10, and fix the count. comesWith counts, for each item, the most the style's standard layout has at any size and porch place the price list sells (loop over the same variants as company.js loadoutCats). Or chooseSize, setSize and choosePorchLength clear inc on included items that the new standard layout no longer has, so they are charged. Pick one and say which; the first keeps today's prices. Add tests that must fail today: Cabin 10×20 with the door moved 3 in, then 8×12, quotes; Side Cabin 12×24 then "4 x 8 porch" quotes; an owner layout with a window left off the 8×12 quotes after the same steps.

### [must] BUILD-PLAN.md section 10, test 19, the bullet "a window set 6 in from the front corner of the Cabin's right side is refused on every size ('it would stand in the open porch')"
- Problem: This expectation is wrong for both the real designer and the mockup. A Cabin's right side is the wall behind the front porch (L minus the porch depth, frame.js wallDefs). It ends where the porch starts, and clampPos has no front-porch rule. A window 6 in from that corner is on the wall. The mockup keeps it on the 10×20 (at -6.45 ft) and leaves it off only the 8×12, for crowding the builder's window. A window is never "refused", only left off; only doors are refused. A builder who writes this test will either fail or add a porch rule the real designer doesn't have.
- Steps: node run/verify-true-to-designer/cabin-side.mjs with the server on 13353. For w23 it prints ok:true at pos -6.45 on the 10×20, and the only words are "On the 8×12 … doesn't fit, so it's left off there". zonesR is [].
- Fix: Replace the bullet with a wrap porch case: "a 2×3 window set 6 in from the front corner of the Deluxe Side Cabin's right side is left off every size (it would stand in the open porch), and a 36″ in-swing door there is refused". Keep the Side Cabin case already in the list.

### [should] BUILD-PLAN.md section 10, "Anchors worked out from where each item sits": "within 4 in of the middle of its wall: at: \"center\""; test 18 "an item at 0.2 ft from the middle gives center"
- Problem: This misstates the mockup's rule, and it would undo the owner's moves. The mockup's infer saves "center" only when the item is exactly in the middle (src/layout.js infer: |pos| < 0.01 ft). The 4 in (0.34 ft) snap belongs only to dragging. Layout mode's Move ‹ › moves 3 in a tap. Under the plan's rule, a door or window moved one tap off the middle is saved as "center" and goes back to the middle on every size, including the size the owner was looking at.
- Steps: Open #layout-LB, pick the door in the middle of the front, tap Move › once and tap Save as standard. The mockup keeps it 3 in right of the middle (infer gives k "share"). The plan's inferRecipe rule would give "center".
- Fix: Change the bullet to "exactly in the middle (within 1/16 in): center; dragging snaps to the middle within 4 in". Change test 18 to "an item 0.25 ft (one Move tap) right of the middle gives pos len*share, and evalDataRecipe puts it back 3 in right of the middle".

### [nice] BUILD-PLAN.md section 10, the porch anchor {porchDoor: d} ("d ft from the porch door, either side") and the SC twin's two post entries
- Problem: The plan does not say how evalDataRecipe finds the porch door, or which way +d goes. In the real recipe the door is the S1 door at P>=12 ? 0 : 1.4, and its right-wall position is doorPos - (z0+z1)/2. The first post is at door + 2.2 (toward the back) and the second at door - 2.2 (model/loadouts.js SC: -(dz-2.2), -(dz+2.2)).
- Steps: Compare BUILD-PLAN.md "the posts {cat:\"ppost\",wall:\"R\",at:{porchDoor:2.2}} and {porchDoor:-2.2}" with model/loadouts.js lines 152-154 in /home/user/wt-dc-fast.
- Fix: Write it out: "porchDoor: R pos = (pos of the first door entry on S1 already placed) - (span.z0+span.z1)/2 + d; +d is toward the back end; it is refused in words if no S1 door comes before it". List the SC posts in that order: porchDoor 2.2, then porchDoor -2.2.

### [nice] BUILD-PLAN.md section 10, "validate() checks offer[k].layout's shape: a list of entries with only the keys a recipe knows (cat, wall, at, when, dbl, ifFits, repeat)"
- Problem: Only the top-level keys are checked. The new at kinds (porchStart, porchDoor) and the new when keys (porch, minP, maxP) are not. A misspelt when key (for example "minp") is silently ignored by evalDataRecipe, so the entry is used on every size.
- Steps: Read model/loadouts.js evalDataRecipe lines 305-309: an unknown when key is never read.
- Fix: Have validate() check at against center or one of pos, fromStart, fromEnd, sym, porchStart, porchDoor, and when against minL, maxL, minW, maxW, minP, maxP, porch. Refuse others in words: "The standard layout of the Side Cabin has \"minp\", which is not a size rule (use minP)."

### [nice] BUILD-PLAN.md section 10, "How many. validate() caps offer[K].layout at 250 items"
- Problem: The server refuses any design with more than 250 items (server/office/pricing.js :111). A standard layout of 250 leaves the customer no room to add anything, and the electric package's fixtures push it over as well.
- Steps: server/office/pricing.js line 111: design.items.length > 250 -> unreadable.
- Fix: Cap the layout well under the server's limit, for example 100 ("The standard layout can have at most 100 doors, windows and posts."), and say why: the customer's own additions and the electric package must still fit under 250.

### [nice] src/layout.js railRuns (the wrap porch's side face, porchFace for porch "C")
- Problem: When two railing gaps on the Deluxe Side Cabin's porch side are equally wide, the mockup leaves a different one open than the real designer does. The mockup scans from the front of the porch. The real porchCorner scans from the back of the 12 ft run (z ascending) and keeps the first widest. Example: posts at 1 ft, 5 ft 6 in and 10 ft from the front of the porch. The mockup opens 1 to 5 ft 6 in (WAY IN there); the real designer opens 5 ft 6 in to 10 ft.
- Steps: node run/verify-true-to-designer/tie.mjs (server on 13353): "mockup [ 1, 5.5 ]  real 3D designer [ 5.5, 10 ]".
- Fix: In railRuns, for a side face (f.railEnd set and no f.entry), choose the widest gap scanning from the back end: iterate from a.length-2 down to 0 with ">". The front faces already match (both scan from the left).

### [nice] src/layout.js porchWords / checkWords ("with the porch at the back end", "with the 8 ft porch in the middle"), and the same words in BUILD-PLAN.md section 10
- Problem: These words don't match what the 3D designer shows. The customer's chips are "Corner porch", "Middle porch" and "Flip porch" (now: left end or right end, ui/panels.js :265-274). The quote says "Porch 4 ft x 12 ft — left end" (ui/quote.js :168). An owner reading "with the porch at the back end" can't tell which designer setting that is.
- Steps: Add a Side Cabin with a post moved to the far end of the porch (walk-side.mjs does this) and tap Save as standard. The result lines say "with the 8 ft porch at the back end".
- Fix: Say it with the 3D designer's names: "…when the customer taps Flip porch" and "…when the customer taps Middle porch". For the length, say "with the 4 x 8 porch" (the designer's "4 x 8 porch" wording).

### [nice] src/layout.js postRuleWords (builder post on a front porch) and the Edit page's "Doors and windows that come with it" card
- Problem: After the owner moves one of the Cabin's two builder posts, the card still describes the one left as "Porch post, where the builder puts it, 2 ft each side of the middle". That one post stands only 2 ft left of the middle.
- Steps: Open #layout-C, pick Porch, pick the right post, move it to the end and tap Save as standard, then Back to Edit building. The card says "Porch: Porch post, where the builder puts it, 2 ft each side of the middle · Porch post, 9 5/8 in from the right corner".
- Fix: For a single builder post key (post1 or post2), say "where the builder puts it, 2 ft left of the middle" or "… 2 ft right of the middle". Keep "2 ft each side of the middle" only while both builder posts remain.

### [nice] src/layout.js linksHTML and the dashed-post aria-label on the Deluxe Side Cabin and Deluxe Loft Side Cabin front wall
- Problem: "Dashed: porch posts on the porch, 4 ft in front of this wall" is true only for the 4 ft stub of front wall on the left. The post 2 ft right of the middle stands in front of the angled porch wall P1, about 7 ft 10 in from it (model/frame.js wallDefs P1).
- Steps: Add the Deluxe Side Cabin (#new-DSC) and open Set the standard layout, then Front. The line under the drawing says "… 4 ft in front of this wall".
- Fix: On a wrap porch say "Dashed: porch posts on the front edge of the porch." Keep the "4 ft in front of this wall" wording for the Cabin and Lofted Barn Cabin.

### [nice] src/layout.js sheetHTML (post sheet words) and BUILD-PLAN.md "The Porch view"
- Problem: Moving posts also moves where a customer's ramp goes, and nothing says so. When the biggest door opens onto the porch, the real designer puts a chosen ramp in the porch's open gap (the widest gap on a front or wrap porch). See parts/ramp.js and parts/porch SKILL.md "OTHER PARTS COPY THIS PART'S RULES".
- Steps: Read parts/ramp.js lines 21-29 in /home/user/wt-dc-fast, then the post sheet in #layout-C, Porch.
- Fix: Add four words to the post sheet line: "The railing stays open in the widest gap: that's the way in, and where a ramp goes." In the plan's Porch view bullet, note that parts/ramp.js follows the same gap, so test 21's "the railing's way in follows them" also checks the ramp.
