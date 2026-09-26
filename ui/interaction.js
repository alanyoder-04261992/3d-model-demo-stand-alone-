/* TOUCHING THE 3D BUILDING. Browser file.

   Everything a finger or a mouse does on the picture:
     drag empty space      turn the building (and tip it up or down)
     pinch / mouse wheel   come closer or stand back (0.55 to 1.9 times the fit)
     tap an item           select it (the sheet opens, the camera faces it)
     tap empty space       put it down again
     drag the SELECTED item  slide it along its wall (a gable window or an
                           outside light also moves up and down); a tape
                           measure shows the gap to its neighbours and snaps
                           it to the middle of the space
     press and hold a wall the "Add here" menu: a door, a window or an outlet
                           right where the finger is
     View menu             the camera glides to the 3/4 view, front, right,
                           back or left
     a card's heading      folds the card up
   Only the ALREADY selected item drags, so spinning the camera can never
   move a door by accident (tap it once to pick it, then drag).

   Ported from Barnwright's 3ddesign.html: wallAtScreen, hideAddPop, addAt,
   showAddPop (4245-4302), bpFtIn (4520-4525, for the tape), the pointer,
   pick, drag, wheel, views, cards and context-menu code (4723-4872). The
   numbers are Barnwright's: 500 ms hold, 58 px reach, 37 x 3 wall samples,
   0.008 / 0.006 radians a pixel to turn and tip, 1.2 thousandths per wheel
   unit, a rebuild at most every 45 ms while dragging, a 2 px slop before a
   press counts as a drag. What changed:
   * the building's walls come from the plan (model/frame.js), items are
     moved through ui/state.js and model/layout.js, the camera is the
     engine's (engine/camera.js);
   * the tap targets are the build's hitQuads, and one on a building step the
     current view hides (a door in the Framing view) cannot be picked;
   * the "Add here" choices are the company's first door, first window and
     its outlet (Barnwright typed w48 / w23 / outlet) -- the same three on
     the standard catalogue;
   * the window-resize handler lives in the renderer (engine/renderer.js
     startLoop: it re-fits the camera and keeps the ground radius, as
     Barnwright's did); the floor plan re-sizes itself (ui/blueprint.js);
   * a read-only page (api.setReadOnly, a shared link) has no "Add here";
   * EMBEDDED on a company's page (?embed=1): on a touch screen a "Tap to
     design" cover lets a finger scroll the page past the designer until the
     customer taps it, and the mouse wheel zooms only with Ctrl held or after
     a click on the picture (docs/ARCHITECTURE.md, Embedding and phones), so
     scrolling down a company's page never gets stuck in the designer. */

import { y0 } from "../engine/constants.js";
import { wallPt } from "../engine/wall.js";
import { animYaw } from "../engine/camera.js";
import { itemById, clampPos, snapCenter } from "../model/layout.js";
import { STAGE_ID } from "../parts/stages.js";
import * as S from "./state.js";

/* The two-column layout's question, word for word the one in ui/styles.css. */
export const TWO_COLUMNS = "(min-width:940px) and (min-aspect-ratio:1/1)";

/* feet -> 5′-3″ (Barnwright bpFtIn: floor the feet, round the inches, and
   carry 12 inches into a foot; nothing below zero) */
export function ftIn(v) {
  v = Math.max(0, v);
  let ft = Math.floor(v + 1e-6), inch = Math.round((v - ft) * 12);
  if (inch === 12) { ft++; inch = 0; }
  return ft + "′-" + inch + "″";
}

/* the camera presets of the View menu: [yaw, pitch] */
export const VIEWS = Object.freeze({ "34": [0.62, 0.30], F: [0, 0.26], R: [Math.PI / 2, 0.26], B: [Math.PI, 0.26], L: [-Math.PI / 2, 0.26] });

export function createInteraction(ctx) {
  const cat = ctx.cat, canvas = ctx.canvas, stage = ctx.stage;
  const el = (id) => document.getElementById(id);
  const cam = ctx.cam;
  let ptrs = {}, lastPinch = 0, dragItem = null, dragFr = null, dragMoved = false, downPt = null, lastBuild = 0, lpTimer = null, lpFired = false;
  let ADDSPOT = null;
  let wheelArmed = !ctx.embedded;

  function hideHint() { const h = el("hint"); if (h) h.classList.add("gone"); }
  cam.onInteract = hideHint;             /* a camera glide hides the hint too (Barnwright animYaw) */

  /* ---------- the tape measure that follows a dragged item ---------- */
  const measEl = document.createElement("div");
  measEl.className = "meas";
  measEl.style.cssText = "position:absolute;display:none;transform:translate(-50%,-135%);background:rgba(14,58,95,.92);color:var(--cyan);font-family:'Oswald','Arial Narrow',system-ui,sans-serif;font-size:12px;font-weight:600;letter-spacing:.05em;padding:4px 11px;border-radius:999px;pointer-events:none;white-space:nowrap;z-index:6";
  stage.appendChild(measEl);
  function measShow(g, sp) {
    if (!g || !sp) { measEl.style.display = "none"; return; }
    measEl.textContent = ftIn(g.gL) + "  ⟷  " + ftIn(g.gR) + (g.centered ? "  ·  CENTERED" : "");
    measEl.style.background = g.centered ? "rgba(31,116,66,.92)" : "rgba(23,48,31,.92)";
    measEl.style.color = g.centered ? "#B8F5CE" : "#7FD3FF";
    measEl.style.left = Math.max(70, Math.min(canvas.clientWidth - 70, sp[0])) + "px";
    measEl.style.top = Math.max(34, sp[1]) + "px";
    measEl.style.display = "block";
  }

  /* ---------- which wall is under a point on the screen (for press-and-hold) ---------- */
  function wallAtScreen(px, py) {
    const pc = ctx.renderer.projCache, plan = ctx.plan;
    if (!pc || !pc.proj || !pc.cp || !plan) return null;
    const ws = plan.ws, cp = pc.cp;
    let best = null;
    Object.keys(ws).forEach((k) => {
      const w = ws[k];
      const mid = wallPt(w, 0, y0 + 2, 0);
      if (w.n[0] * (cp[0] - mid[0]) + w.n[1] * (cp[1] - mid[1]) + w.n[2] * (cp[2] - mid[2]) <= 0.1) return;   /* facing away */
      for (let i = 0; i <= 36; i++) {
        const u = -w.len / 2 + (i / 36) * w.len;
        for (let yy = 1.4; yy <= 5.4; yy += 2.0) {
          const p = pc.proj(wallPt(w, u, y0 + yy, 0.12));
          if (!p) continue;
          const d = (p[0] - px) * (p[0] - px) + (p[1] - py) * (p[1] - py);
          if (!best || d < best.d) best = { d: d, wall: k, u: u };
        }
      }
    });
    return (best && best.d < 58 * 58) ? best : null;
  }

  /* ---------- the "Add here" menu ---------- */
  function hideAddPop() { el("addpop").classList.remove("open"); ADDSPOT = null; }
  /* the default choices on a wall: the company's first door and first window, and its outlet */
  function wallChoices() {
    const out = [];
    const d = S.firstOf(cat, "addDoor"), w = S.firstOf(cat, "addWindow");
    if (d) out.push(["+ Door", d]);
    if (w) out.push(["+ Window", w]);
    if (cat.CAT.outlet) out.push(["+ Electrical", "outlet"]);
    return out;
  }
  /* spot: the place to add at (default: where the menu was opened) */
  function addAt(catId, spotIn) {
    const spot = spotIn || ADDSPOT;
    if (!spot || !cat.CAT[catId] || ctx.readOnly) return null;
    const cc = cat.CAT[catId];
    hideAddPop();
    const it = ctx.act("add", (s) => S.addAt(s, catId, spot, cat), { refresh: false });
    if (cc.int && ctx.mode === "out") ctx.goInside("add");      /* electric shows on the floor plan */
    if (it) ctx.select(it.id);
    return it;
  }
  /* px, py in CSS pixels inside the stage; spot {wall, u} or {px, pz, rot};
     choices [[label, item code], ...] (default: wallChoices()) */
  function showAddPop(px, py, spot, choices) {
    if (ctx.readOnly) return false;                              /* the customer is looking, not building */
    const list = (choices || wallChoices()).filter((pr) => cat.CAT[pr[1]]);
    if (!list.length) return false;
    ADDSPOT = spot;
    const ap = el("addpop");
    ap.innerHTML = "";
    const t = document.createElement("div"); t.className = "ttl"; t.textContent = "Add here"; ap.appendChild(t);
    list.forEach((pr) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = pr[0];
      b.setAttribute("data-cat", pr[1]);
      b.onclick = () => addAt(pr[1]);
      ap.appendChild(b);
    });
    const cx = document.createElement("button"); cx.type = "button"; cx.className = "cxl"; cx.textContent = "Cancel";
    cx.onclick = hideAddPop; ap.appendChild(cx);
    const stW = stage.clientWidth || 320, stH = stage.clientHeight || 300;
    const eh = 30 + (ap.children.length - 1) * 44;               /* real height estimate so it never runs off the screen */
    const top = (py > stH - eh - 24) ? Math.max(8, py - eh - 16) : Math.max(8, Math.min(py - 12, stH - eh - 8));
    ap.style.left = Math.max(8, Math.min(px - 12, stW - 150)) + "px";
    ap.style.top = top + "px";
    ap.classList.add("open");
    return true;
  }

  /* ---------- tapping an item: the nearest tap target under the finger ---------- */
  function hiddenStages() {
    let t = null;
    try { t = ctx.renderer.stageTable; } catch (e) { t = null; }
    return function (stageKey) {
      if (!t || stageKey == null) return false;
      const id = STAGE_ID[stageKey];
      return id !== undefined && t[id * 4] > 0.5;
    };
  }
  function pickItem(px, py) {
    const pc = ctx.renderer.projCache, res = ctx.result;
    if (!pc || !pc.proj || !res || !res.build) return null;
    const hitQuads = res.build.hitQuads || [];
    const hidden = hiddenStages();
    let best = null, bestD = 1e9;
    for (let i = 0; i < hitQuads.length; i++) {
      const q = hitQuads[i], pj = []; let ok = true, dep = 0;
      if (hidden(q.stage)) continue;                            /* a step this view does not show */
      if (q.n && pc.cp) {                                        /* skip quads facing away: no grabbing items through the building */
        const qc = [(q.pts[0][0] + q.pts[2][0]) / 2, (q.pts[0][1] + q.pts[2][1]) / 2, (q.pts[0][2] + q.pts[2][2]) / 2];
        if (q.n[0] * (pc.cp[0] - qc[0]) + q.n[1] * (pc.cp[1] - qc[1]) + q.n[2] * (pc.cp[2] - qc[2]) <= 0.1) continue;
      }
      for (let j = 0; j < 4; j++) { const pr = pc.proj(q.pts[j]); if (!pr) { ok = false; break; } pj.push(pr); dep += pr[2]; }
      if (!ok) continue; dep /= 4;
      let inside = false;
      for (let a = 0, b = 3; a < 4; b = a++) {
        if ((pj[a][1] > py) !== (pj[b][1] > py) && px < (pj[b][0] - pj[a][0]) * (py - pj[a][1]) / (pj[b][1] - pj[a][1]) + pj[a][0]) inside = !inside;
      }
      if (inside && dep < bestD) { bestD = dep; best = q.id; }
    }
    return best;
  }

  /* ---------- the pointer on the 3D picture ---------- */
  window.addEventListener("blur", () => { ptrs = {}; lastPinch = 0; dragItem = null; canvas.classList.remove("dragging"); });
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
    if (e.isPrimary) { ptrs = {}; lastPinch = 0; dragItem = null; }  /* a fresh first finger clears any stale pointer */
    cam.anim = null;                                                  /* touching the canvas stops any camera glide */
    hideAddPop(); el("views").classList.remove("open");
    const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    ptrs[e.pointerId] = [e.clientX, e.clientY];
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* not every browser */ }
    cam.interacted = true; hideHint(); wheelArmed = true;
    downPt = [px, py]; dragMoved = false;
    const state = ctx.state;
    const hit = pickItem(px, py);
    if (hit && hit === state.sel && Object.keys(ptrs).length === 1 && !ctx.readOnly) { dragItem = itemById(state, hit); dragFr = ctx.frame(); }   /* only the selected item drags */
    else { dragItem = null; canvas.classList.add("dragging"); }
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    lpFired = false;
    if (!hit && e.isPrimary && Object.keys(ptrs).length === 1 && !ctx.readOnly) {
      lpTimer = setTimeout(() => {
        lpTimer = null;
        const spot = wallAtScreen(px, py);
        if (spot && showAddPop(px, py, spot)) lpFired = true;
      }, 500);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!ptrs[e.pointerId]) return;
    if (lpFired) { ptrs[e.pointerId] = [e.clientX, e.clientY]; return; }   /* the menu is up: hold the camera still */
    const ids = Object.keys(ptrs);
    if (ids.length === 2) {
      if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
      ptrs[e.pointerId] = [e.clientX, e.clientY];
      const A = ptrs[ids[0]], B = ptrs[ids[1]];
      const dist = Math.hypot(A[0] - B[0], A[1] - B[1]);
      if (lastPinch > 0) { cam.dist = Math.max(cam.fitDist * 0.55, Math.min(cam.fitDist * 1.9, cam.dist * (lastPinch / dist))); ctx.renderer.needsDraw = true; }
      lastPinch = dist; return;
    }
    const dx = e.clientX - ptrs[e.pointerId][0], dy = e.clientY - ptrs[e.pointerId][1];
    if (Math.abs(dx) + Math.abs(dy) > 2) { dragMoved = true; if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } }
    if (dragItem) {
      const c = ctx.renderer.projCache, fr = dragFr || ctx.frame(), CAT = cat.CAT, T = fr.t, state = ctx.state;
      if (c.proj) {
        const isGable = CAT[dragItem.cat].gable;
        const sideG = isGable && (dragItem.wall === "R" || dragItem.wall === "L");     /* gable window living on a side wall */
        const w = (!isGable || sideG) ? fr.ws[dragItem.wall] : null;
        const refY = sideG ? y0 + Math.min(4.6, T.wallH - 1.0) : y0 + 2;
        const p0 = (isGable && !sideG) ? [dragItem.pos, y0 + T.wallH + 1, (dragItem.wall === "B" ? -1 : 1) * fr.d.L / 2] : wallPt(w, dragItem.pos, refY, 0);
        const p1 = (isGable && !sideG) ? [dragItem.pos + 1, y0 + T.wallH + 1, (dragItem.wall === "B" ? -1 : 1) * fr.d.L / 2] : wallPt(w, dragItem.pos + 1, refY, 0);
        const s0 = c.proj(p0), s1 = c.proj(p1);
        if (s0 && s1) {
          const vx = s1[0] - s0[0], vy = s1[1] - s0[1], len2 = vx * vx + vy * vy;
          if (len2 > 1) {
            dragItem.pos += (dx * vx + dy * vy) / len2;
            if (CAT[dragItem.cat].gable || CAT[dragItem.cat].k === "light") {
              const s2 = c.proj([p0[0], p0[1] + 1, p0[2]]);
              if (s2) {
                const wx = s2[0] - s0[0], wy = s2[1] - s0[1], len3 = wx * wx + wy * wy;
                if (len3 > 1) dragItem.vy = (dragItem.vy || 0) + (dx * wx + dy * wy) / len3;
              }
            }
            clampPos(dragItem, state, fr);
            /* settle onto the midpoint between neighbours, then read the tape */
            const g9 = snapCenter(dragItem, state, fr);
            if (g9) {
              clampPos(dragItem, state, fr);
              const wm = fr.ws[dragItem.wall];
              const sp9 = wm ? c.proj(wallPt(wm, dragItem.pos, (CAT[dragItem.cat].k === "light" ? y0 + 6.6 : y0 + CAT[dragItem.cat].h || y0 + 5) + 0.6, 0.5)) : null;
              measShow(g9, sp9);
            } else measEl.style.display = "none";
            const nowB = Date.now();
            if (nowB - lastBuild > 45) { ctx.rebuild(); lastBuild = nowB; }
          }
        }
      }
    } else {
      cam.yaw -= dx * 0.008;
      cam.pitch = Math.max(0.08, Math.min(1.05, cam.pitch + dy * 0.006));
      ctx.renderer.needsDraw = true;
    }
    ptrs[e.pointerId] = [e.clientX, e.clientY];
  });
  function endPtr(e) {
    if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; }
    if (lpFired) { lpFired = false; delete ptrs[e.pointerId]; lastPinch = 0; dragItem = null; if (Object.keys(ptrs).length === 0) canvas.classList.remove("dragging"); return; }
    if (ptrs[e.pointerId] && downPt && !dragMoved) {
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      const hit = pickItem(px, py);
      ctx.select(hit || null);
    } else if (dragItem) {
      ctx.act("move", () => null);                               /* Barnwright: buildShed(); refreshUI(); */
    }
    measEl.style.display = "none";
    delete ptrs[e.pointerId]; lastPinch = 0; dragItem = null; dragFr = null;
    if (Object.keys(ptrs).length === 0) canvas.classList.remove("dragging");
  }
  canvas.addEventListener("pointerup", endPtr);
  canvas.addEventListener("pointercancel", endPtr);
  canvas.addEventListener("wheel", (e) => {
    /* embedded: the page scrolls past unless Ctrl is held or the picture was clicked */
    if (ctx.embedded && !wheelArmed && !e.ctrlKey) return;
    e.preventDefault(); cam.interacted = true; hideHint();
    cam.dist = Math.max(cam.fitDist * 0.55, Math.min(cam.fitDist * 1.9, cam.dist * (1 + e.deltaY * 0.0012))); ctx.renderer.needsDraw = true;
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); });

  /* ---------- the View menu ---------- */
  const vroot = el("views");
  el("viewtoggle").onclick = () => { vroot.classList.toggle("open"); };
  Array.prototype.forEach.call(document.querySelectorAll("#viewmenu button"), (b) => {
    b.onclick = () => { const v = VIEWS[b.getAttribute("data-v")]; if (v) animYaw(cam, v[0], v[1]); ctx.renderer.needsDraw = true; vroot.classList.remove("open"); };
  });

  /* ---------- a card's heading folds it ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".card h3"), (h) => {
    h.onclick = () => { h.parentNode.classList.toggle("closed"); };
  });

  /* ---------- embedded on a touch screen: "Tap to design" ---------- */
  let coarse = false;
  try { coarse = matchMedia("(pointer: coarse)").matches; } catch (e) { coarse = false; }
  if (ctx.embedded && coarse) {
    const cover = document.createElement("button");
    cover.type = "button"; cover.className = "tapcover"; cover.id = "tapcover";
    cover.innerHTML = "<span>Tap to design</span>";
    cover.onclick = () => { cover.remove(); wheelArmed = true; };
    stage.appendChild(cover);
  }

  return { pickItem, wallAtScreen, showAddPop, hideAddPop, addAt, measShow, ftIn };
}
