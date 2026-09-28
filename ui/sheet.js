/* THE SELECTION SHEET: the little panel that opens when a door, window,
   light, post, bench, shelf or outlet is picked. Browser file.

   It shows what the item is and what it adds to the price, and offers:
     Type          swap it for another of its kind (a 36 in door for a 72 in
                   pair, a window for a transom...), or turn a loose outlet
                   into a whole electric package
     Wall          Front / Back / Left / Right -- jump it to another wall (the
                   camera glides round after it)
     Turn 90       a transom stood on end; a bench or shelf along the length
     Length        a bench or shelf, a foot at a time
     Shutters      on a window, with the shutter colour
     Double window two windows sharing one trim board down the middle
     Window in door  a window put into a wooden shop door, or the steel
                   door swapped for its 11-lite twin
     Door colour   on a wooden shop door
     Duplicate / Remove / Done

   Ported from Barnwright's 3ddesign.html select() and sheetSwatches
   (4874-5026) and the Done / Remove / Duplicate buttons (5027-5037). What
   changed:
   * the type lists come from the catalogue (cat.LISTS sheetWindow and
     sheetDoor, the company's electric packages) instead of typed-out codes,
     and only what the company sells is offered -- but an item already on the
     building is always offered, so an old design never loses a piece;
   * item-code tests are item traits: a "shop-door" takes a window and a door
     colour; a door with a `liteSwap` twin swaps to it (Barnwright's
     d36in / d36lite); a "transom" turns; a `switch` fixture is the package's
     switch + GFCI;
   * every change goes through ui/state.js, and every name through esc();
   * the door and shutter colour rows also say the colour's NAME (the Yoder
     site, Aug 2026).
   Like Barnwright, selecting REBUILDS the building: the selected item's
   glow is baked into its materials (engine/buckets.js mat()), so a shader
   highlight would look different and skipping the rebuild shows none. The
   first time an item is picked in the 3D view the camera glides round to
   face its wall. */

import { esc } from "./esc.js";
import * as S from "./state.js";
import { itemById } from "../model/layout.js";
import { itemCharge, money } from "../model/pricing.js";
import { colorName } from "../model/company.js";
import { animYaw, wallYaw } from "../engine/camera.js";

const TITLES = { win: "Window", ru: "Roll-up door", post: "Porch post", light: "Outside light", bench: "Work bench", shelf: "Shelf", out: "Electric outlet", ilt: "Inside light" };

export function createSheet(ctx) {
  const cat = ctx.cat;
  const el = (id) => document.getElementById(id);
  const showMoney = () => cat.pricing.show !== "none";
  let lastFaced = null;

  function reduced() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }

  /* a change made on the sheet: the design changes, then the item is
     selected again (Barnwright: "refreshLists(); select(it.id)") */
  function change(reason, fn, id) { ctx.act(reason, fn, { refresh: false }); select(id); }

  /* the door / shutter colour swatches: first "match", then the palette.
     These colours are for the WHOLE building (state.doorC / state.shutC). */
  function sheetSwatches(host, nameEl, list, key, matchLabel, selId) {
    host.innerHTML = "";
    const st = ctx.state;
    function mk(name, val, bg, extra) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw" + (extra || "") + (((st[key] || "") === val) ? " on" : "");
      if (bg) b.style.background = bg;
      b.title = name; b.setAttribute("aria-label", name);
      b.onclick = () => { ctx.act("colour", (s) => S.setColour(s, key, val), { keepSheet: true }); select(selId); };
      host.appendChild(b);
    }
    mk(matchLabel, "", null, " match");
    list.forEach((cc) => mk(cc[0], cc[1], cc[1], ""));
    if (nameEl) { nameEl.textContent = st[key] ? colorName(list, st[key]) : matchLabel; nameEl.classList.toggle("none", !st[key]); }
  }

  function toggle(tg, on) { tg.className = "tgl" + (on ? " on" : ""); tg.setAttribute("aria-checked", on ? "true" : "false"); }

  /* the type drop-down's list for this item */
  function kindsFor(it, c) {
    const CAT = cat.CAT;
    const pkgs = (cat.ELECPK || []).filter((e) => e[0] !== "0").map((e) => "PKG" + e[0]);
    let kinds = c.k === "win" ? S.listOf(cat, "sheetWindow") : c.k === "post" ? ["ppost"] : c.k === "light" ? ["light"] : c.k === "bench" ? ["bench"] : c.k === "shelf" ? ["shelf"]
      : (c.k === "out" || c.k === "ilt") ? (it.pk ? pkgs.concat([it.cat]) : pkgs.concat(["outlet", "ilight"])) : S.listOf(cat, "sheetDoor");
    kinds = kinds.filter((k) => /^PKG/.test(k) || CAT[k] || k === it.cat);
    if (kinds.indexOf(it.cat) < 0) kinds.push(it.cat);
    return kinds;
  }

  function render(it) {
    const state = ctx.state, CAT = cat.CAT, T = cat.TYPES[state.type], MISC = cat.MISC || {};
    const c = CAT[it.cat];
    const fr = ctx.frame();
    el("sh-title").textContent = TITLES[c.k] || "Door";
    const chg = itemCharge(it, state, cat, fr);
    el("sh-price").textContent = chg > 0 ? (showMoney() ? "+ " + money(chg) : "extra") : (it.pk ? "in package" : "included");

    /* Type (built from the price tables, so the labels follow the company's prices) */
    const selEl = el("sh-type"); selEl.innerHTML = "";
    const epP = (n) => { const e = (cat.ELECPK || []).filter((x) => x[0] === String(n))[0]; return e ? e[2] : 0; };
    const elecCtx = (c.k === "out" || c.k === "ilt");
    const pr = (p, perFt) => showMoney() ? "  (+$" + p + (perFt ? "/ft)" : ")") : "";
    kindsFor(it, c).forEach((kk) => {
      const o = document.createElement("option"); o.value = kk;
      const pm = /^PKG(\d+)$/.exec(kk);
      const ck = CAT[kk];
      let label;
      if (pm) label = "Electric package — Option " + pm[1] + pr(epP(pm[1]));
      else if (elecCtx && ck && ck.k === "out" && ck.switch) label = ck.n + " — in package";
      else if (elecCtx && ck && ck.k === "out") label = "Additional outlet" + pr(ck.p);
      else if (elecCtx && ck && ck.k === "ilt") label = "Additional overhead light" + pr(ck.p);
      else label = (ck ? ck.n : kk) + (ck ? pr(ck.p, ck.perFt) : "");
      if (elecCtx && it.pk && kk === it.cat && !(ck && ck.switch)) label = ck.n + " — in package";
      o.textContent = label;
      if (kk === it.cat) o.selected = true;
      selEl.appendChild(o);
    });
    selEl.onchange = () => {
      const v = selEl.value;
      if (/^PKG\d+$/.test(v)) {                      /* picked a whole electric package */
        const r = ctx.act("elec", (s) => S.setItemType(s, it.id, v, cat));
        ctx.goInside("elec");
        select(r && r.select ? r.select : null);
        return;
      }
      change("item", (s) => S.setItemType(s, it.id, v, cat), it.id);
    };

    /* Wall: Front / Back / Left / Right */
    const wr = el("sh-wallrow"), wc = el("sh-walls");
    if (c.k !== "post" && (!c.int || c.k === "out")) {
      wr.style.display = "flex"; wc.innerHTML = "";
      [["F", "Front"], ["B", "Back"], ["L", "Left"], ["R", "Right"]].forEach((pair) => {
        const wb = document.createElement("button"); wb.type = "button"; wb.textContent = pair[1];
        if (it.wall === pair[0]) wb.className = "on";
        wb.onclick = () => {
          if (it.wall === pair[0]) return;
          ctx.act("item", (s) => S.setItemWall(s, it.id, pair[0], cat), { refresh: false });
          lastFaced = it.id;
          /* jump the item, glide the camera after it (the walls themselves
             did not change, so the last plan still knows where they face) */
          if (ctx.mode === "out" && !CAT[it.cat].int && ctx.plan) animYaw(ctx.cam, wallYaw(it, ctx.plan, ctx.cam), 0.26);
          select(it.id);
        };
        wc.appendChild(wb);
      });
    } else wr.style.display = "none";

    /* Turn 90 degrees -- the high transom row of a single slope has no room for a turned one */
    const rr = el("sh-rotrow");
    const trBand = (c.draw === "transom" && T.roof === "slope" && it.wall === "R");
    if ((c.draw === "transom" && !trBand) || c.stretch) {
      rr.style.display = "flex";
      const tr9 = el("sh-rot"); toggle(tr9, it.rot);
      tr9.onclick = () => change("item", (s) => S.toggleRot(s, it.id, cat), it.id);
    } else rr.style.display = "none";

    /* Shutters */
    const sr = el("sh-shutrow");
    if (c.k === "win" && !c.gable && MISC.shutter != null) {
      sr.style.display = "flex";
      el("sh-shutpr").textContent = showMoney() ? "+ $" + MISC.shutter + " / set" : "";
      const tg = el("sh-shut"); toggle(tg, it.shut);
      tg.onclick = () => change("item", (s) => S.toggleShutters(s, it.id), it.id);
    } else sr.style.display = "none";

    /* Window in door: a window in a wooden door, or the steel door's 11-lite twin
       (on the twin the "window" is a swap, so it costs the difference between
       the two doors, not the wooden-door price) */
    const lr = el("sh-literow");
    const isSteel = !!(c.liteSwap && CAT[c.liteSwap]);
    if ((c.draw === "shop-door" && !T.metal && MISC.lite != null) || isSteel) {
      lr.style.display = "flex";
      const liteCat = isSteel ? (c.draw === "lite-door" ? CAT[it.cat] : CAT[c.liteSwap]) : null;
      const plainCat = isSteel ? (c.draw === "lite-door" ? CAT[c.liteSwap] : CAT[it.cat]) : null;
      el("sh-litepr").textContent = !showMoney() ? "" : "+ $" + (isSteel ? Math.max(0, liteCat.p - plainCat.p) : MISC.lite);
      const tl = el("sh-lite"); toggle(tl, isSteel ? c.draw === "lite-door" : it.lite);
      tl.onclick = () => change("item", (s) => S.toggleLite(s, it.id, cat), it.id);
    } else lr.style.display = "none";

    /* Door colour, on a wooden shop door */
    const dcr = el("sh-doorcrow");
    if (c.draw === "shop-door") {
      dcr.style.display = "flex";
      sheetSwatches(el("sh-doorc"), el("nm-sh-doorc"), cat.COLORS.paint, "doorC", "Match siding", it.id);
    } else dcr.style.display = "none";
    /* Shutter colour, once it has shutters */
    const scr = el("sh-shutcrow");
    if (c.k === "win" && !c.gable && it.shut) {
      scr.style.display = "flex";
      sheetSwatches(el("sh-shutc"), el("nm-sh-shutc"), cat.COLORS.paint, "shutC", "Match trim", it.id);
    } else scr.style.display = "none";

    /* TWO WINDOWS SHARING ONE BOARD DOWN THE MIDDLE (a turned transom is left
       out: itemW measures that one on its end, so doubling it means nothing) */
    const dbr = el("sh-dblrow");
    if (c.k === "win" && !c.gable && !(it.rot && c.draw === "transom")) {
      dbr.style.display = "flex";
      el("sh-dblpr").textContent = showMoney() ? "+ $" + c.p : "";
      const td = el("sh-dbl"); toggle(td, it.dbl);
      td.onclick = () => change("item", (s) => S.toggleDouble(s, it.id, cat), it.id);
    } else dbr.style.display = "none";

    /* Length of a bench or shelf */
    const lnr = el("sh-lenrow");
    if (c.stretch) {
      lnr.style.display = "flex";
      el("sh-lenv").textContent = (it.ln || 4) + " ft";
      el("sh-len-m").onclick = () => change("item", (s) => S.changeLength(s, it.id, -1, cat), it.id);
      el("sh-len-p").onclick = () => change("item", (s) => S.changeLength(s, it.id, 1, cat), it.id);
    } else lnr.style.display = "none";
  }

  /* select(id): pick an item (null: put it down) -- Barnwright select(). */
  function select(id) {
    const state = ctx.state;
    const sheet = el("sheet");
    state.sel = id || null;
    ctx.rebuild();
    if (!id) {
      sheet.classList.remove("open"); ctx.refreshLists(); lastFaced = null;
      ctx.emit("select", { id: null, item: null });
      return;
    }
    const it = itemById(state, id);
    if (!it || !cat.CAT[it.cat]) { state.sel = null; sheet.classList.remove("open"); ctx.refreshLists(); ctx.emit("select", { id: null, item: null }); return; }
    const c = cat.CAT[it.cat];
    if (id !== lastFaced) { lastFaced = id; if (ctx.mode === "out" && !c.int && ctx.plan) animYaw(ctx.cam, wallYaw(it, ctx.plan, ctx.cam)); }   /* glide round to face what was tapped */
    render(it);
    sheet.classList.add("open");
    if (sheet.scrollIntoView) { try { sheet.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "nearest" }); } catch (e) { /* old browsers */ } }
    ctx.refreshLists();
    ctx.emit("select", { id: id, item: it });
  }

  /* the open sheet drawn again without selecting (after a colour picked on
     the Colors card: doorC and shutC are the same state as the sheet's rows) */
  function sync() {
    const id = ctx.state.sel;
    const it = id ? itemById(ctx.state, id) : null;
    if (it && cat.CAT[it.cat] && el("sheet").classList.contains("open")) render(it);
    else if (!id) el("sheet").classList.remove("open");
  }

  el("sh-done").onclick = () => select(null);
  el("sh-del").onclick = () => {
    const id = ctx.state.sel; if (!id) return;
    ctx.act("remove", (s) => S.removeItem(s, id), { refresh: false });
    select(null);
  };
  el("sh-dup").onclick = () => {
    const id = ctx.state.sel; if (!id) return;
    const nw = ctx.act("add", (s) => S.duplicateItem(s, id, cat), { refresh: false });
    if (nw) select(nw.id);
  };

  return { select, sync, forgetFaced() { lastFaced = null; } };
}
