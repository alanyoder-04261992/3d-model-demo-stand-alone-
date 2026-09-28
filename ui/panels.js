/* THE CARDS DOWN THE SIDE OF THE DESIGNER, and the price plate on the picture.
   Browser file.

     1 Pick your building   category drop-down, style chips ("from $X"), dormer chips
     2 Size                 size chips with their prices, the size note, the side-cabin porch
     3 Colors               siding, trim, doors, shutters, roof: swatches with the NAME
     4 Doors & windows      the add buttons and the list of every item on the building
     5 Inside & upgrades    bench, shelf, electric package, exterior light, ramp,
                            the per-square-foot upgrades, the company's own extras
     6 Your quote           the price summary (ui/quote.js adds the form below it)
   and the plate: "10 x 20 Lofted Barn  $6,100.00 plus tax".

   Ported from Barnwright's 3ddesign.html: refreshUI (5114-5198), updateElec
   (5201-5225), updateOpts (5226-5243), updateXopts (860-913), swRow
   (5272-5282) and refreshLists (5079-5113); the colour names from the Yoder
   site (swName, Aug 2026). What changed:
   * everything is drawn from the company's catalogue: the categories, styles,
     sizes and prices, the dormers, the packages and their descriptions, the
     ramps, the upgrades (Barnwright typed six upgrade rows into the page), the
     add buttons (an item the company does not sell has no button), the size
     notes (Barnwright typed two sentences in), the fine print;
   * every word from the company goes through esc() (ui/esc.js);
   * the per-square-foot upgrade price on each button comes from the same
     function as the charge on the quote (model/pricing.js rateCharges,
     DIFFERENCES #9);
   * a dormer the company does not sell is not offered (DIFFERENCES #10);
   * money is always "$1,234.00" (DIFFERENCES #11);
   * pricing.show: "price" (default) shows every price; "from" shows the
     style and size prices but the plate says "from" the building's price
     instead of the running total; "none" shows no money anywhere.
   Every button changes the design through ui/state.js and then asks ui/app.js
   to refresh (ctx.act), which is Barnwright's "change it, then refreshUI". */

import { esc } from "./esc.js";
import * as S from "./state.js";
import { money, pPrice, pSizes, minPrice, priceParts, itemCharge, rateCharges, optxList, optxQty, optxOn, optxCharge, optxChargeIfOn } from "../model/pricing.js";
import { colorName, sidingPalette } from "../model/company.js";

/* where an item is, in words (Barnwright refreshLists 5084-5086; S3, the
   far wall of a middle porch, was missing and printed "undefined") */
const WALL_WORDS = { F: "front", B: "back", L: "left side", R: "right side", P1: "porch — angled wall", P2: "porch — front wall", P3: "porch — door wall", S1: "porch — back wall", S2: "porch — side wall", S3: "porch — side wall" };

export function wallWords(it, c) {
  let wn = WALL_WORDS[it.wall] || "";
  if (c.gable) wn = (it.wall === "R" ? "right side" : it.wall === "L" ? "left side" : (it.wall === "B" ? "back" : "front") + " gable");
  if (c.int) wn = (c.k === "out") ? ({ F: "front wall", B: "back wall", L: "left wall", R: "right wall" }[it.wall] || "wall") : "inside";
  return wn;
}

/* "Floor joists 12" on center (16" standard)" -> the part in brackets small,
   as Barnwright's hand-written row had it */
function nameWithNote(name) {
  const m = /^(.*\S)\s*(\([^()]*\))$/.exec(String(name));
  return m ? esc(m[1]) + " <small>" + esc(m[2]) + "</small>" : esc(name);
}

/* how an extra is charged, in words (Barnwright optxLabel 851-858) */
function optxLabel(x) {
  if (x.input === "sqftF") return "by the square foot of floor";
  if (x.input === "sqftW") return "by the square foot of wall";
  if (x.input === "sqftR") return "by the square foot of roof";
  if (x.input === "pct") return (+x.price || 0) + "% of the building";
  if (x.input === "lf") return "by the foot";
  return "";
}

export function createPanels(ctx) {
  const cat = ctx.cat;
  const el = (id) => document.getElementById(id);
  const showMoney = () => cat.pricing.show !== "none";
  const M = (n) => money(n);

  function chip(on, html, onClick, disabled) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (on ? " on" : "");
    b.innerHTML = html;
    if (disabled) b.disabled = true;
    b.onclick = onClick;
    return b;
  }
  function small(text) { return "<small>" + text + "</small>"; }

  /* ---------- colour rows (Barnwright swRow + the Yoder site's swName) ---------- */
  function swName(id, list, key, fallback) {
    const n = el(id); if (!n) return;
    const st = ctx.state;
    n.textContent = st[key] ? colorName(list, st[key]) : (fallback || "");
    n.classList.toggle("none", !st[key]);
  }
  function swRow(host, list, key, nameId, fallback) {
    host.innerHTML = "";
    list.forEach((cc) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw" + (ctx.state[key] === cc[1] ? " on" : "");
      b.style.background = cc[1]; b.title = cc[0]; b.setAttribute("aria-label", cc[0]);
      b.onclick = () => ctx.act("colour", (s) => S.setColour(s, key, cc[1]), { keepSheet: true });
      host.appendChild(b);
    });
    swName(nameId, list, key, fallback);
  }

  /* ---------- 5: electric packages and ramps (Barnwright updateElec) ---------- */
  function updateElec() {
    const state = ctx.state;
    const ec = el("elecchips"); ec.innerHTML = "";
    const pks = cat.ELECPK || [];
    el("elecrow").style.display = pks.length > 1 ? "" : "none";
    pks.forEach((pk) => {
      ec.appendChild(chip(state.elec.pkg === +pk[0], esc(pk[1]) + (showMoney() && pk[2] ? small("+ " + M(pk[2])) : small("—")), () => {
        ctx.act("elec", (s) => S.setElec(s, pk[0], cat));
        if (ctx.state.elec.pkg > 0) ctx.goInside("elec");
      }));
    });
    const MISC = cat.MISC || {};
    el("extlrow").style.display = (state.elec.pkg > 0 && MISC.ext != null) ? "flex" : "none";
    el("opr-ext").textContent = showMoney() && MISC.ext != null ? "+ " + M(MISC.ext) : "";
    const tg = el("opt-ext"); tg.className = "tgl" + (state.elec.ext ? " on" : "");
    tg.setAttribute("aria-checked", state.elec.ext ? "true" : "false");
    tg.onclick = () => ctx.act("elec", (s) => S.toggleExt(s, cat));
    el("elecnote").textContent = state.elec.pkg > 0
      ? ((cat.ELECDESC && cat.ELECDESC[state.elec.pkg]) || "") + " — everything shows on the floor plan; drag each piece where you want it."
      : "Includes lights, a switch with a GFCI outlet, and outlets — all placed on the floor plan where you can move them.";
    const rc = el("rampchips"); rc.innerHTML = "";
    const ramps = cat.RAMPS || [];
    el("ramprow").style.display = ramps.length > 1 ? "" : "none";
    ramps.forEach((rp) => {
      rc.appendChild(chip(state.ramp === rp[0], esc(rp[1]) + (showMoney() && rp[2] ? small("+ " + M(rp[2])) : small("—")), () => ctx.act("ramp", (s) => S.setRamp(s, rp[0]))));
    });
  }

  /* ---------- 5: the per-square-foot upgrades (Barnwright updateOpts) ---------- */
  function updateOpts() {
    updateElec();
    const state = ctx.state;
    const box = el("optrows"); box.innerHTML = "";
    const pz = rateCharges(state, cat, ctx.frame());
    Object.keys(cat.RATES || {}).forEach((k) => {
      const def = cat.RATEDEF[k];
      const row = document.createElement("div"); row.className = "optrow"; row.id = "optrow-" + k;
      const nm = document.createElement("span"); nm.innerHTML = nameWithNote(def.name);
      const pr = document.createElement("span"); pr.className = "opr"; pr.id = "opr-" + k;
      pr.textContent = showMoney() ? "+ " + M(pz[k]) : "";
      const tg = document.createElement("button"); tg.type = "button"; tg.id = "opt-" + k;
      tg.className = "tgl" + (state.opts[k] ? " on" : "");
      tg.setAttribute("role", "switch"); tg.setAttribute("aria-label", def.name);
      tg.setAttribute("aria-checked", state.opts[k] ? "true" : "false");
      tg.onclick = () => ctx.act("upgrade", (s) => S.toggleOpt(s, k));
      row.appendChild(nm); row.appendChild(pr); row.appendChild(tg);
      box.appendChild(row);
    });
    updateXopts();
  }

  /* ---------- 5: the company's own extras (Barnwright updateXopts 860-913) ---------- */
  function updateXopts() {
    const box = el("xoptrows"); box.innerHTML = "";
    const state = ctx.state, fr = ctx.frame();
    optxList(cat).forEach((x) => {
      const row = document.createElement("div"); row.className = "optrow";
      const nm = document.createElement("span");
      nm.innerHTML = esc(x.name) + (optxLabel(x) ? (" <small>(" + esc(optxLabel(x)) + ")</small>") : "");
      row.appendChild(nm);
      if (x.input === "qty" || x.input === "lf") {
        const ft = (x.input === "lf"), pr = document.createElement("span");
        pr.className = "xpr";
        pr.textContent = !showMoney() ? "" : optxOn(x, state) ? ("+ " + M(optxCharge(x, state, cat, fr))) : ("+ " + M(+x.price || 0) + (ft ? " a foot" : " each"));
        const inp = document.createElement("input");
        inp.type = "number"; inp.min = "0"; inp.max = ft ? "200" : "99"; inp.step = "1";
        inp.className = "xqty"; inp.inputMode = "numeric";
        inp.value = optxQty(x, state) || "";
        inp.placeholder = ft ? "ft" : "0";
        inp.setAttribute("aria-label", (ft ? "How many feet of " : "How many ") + x.name);
        inp.onchange = () => ctx.act("extra", (s) => S.setExtra(s, x, inp.value));
        row.appendChild(inp); row.appendChild(pr);
      } else {
        const pr2 = document.createElement("span");
        pr2.className = "opr";
        pr2.textContent = showMoney() ? "+ " + M(x.input === "check" ? (+x.price || 0) : optxChargeIfOn(x, state, cat, fr)) : "";
        const tg = document.createElement("button");
        tg.className = "tgl" + (optxOn(x, state) ? " on" : "");
        tg.type = "button"; tg.setAttribute("role", "switch");
        tg.setAttribute("aria-label", x.name);
        tg.setAttribute("aria-checked", optxOn(x, state) ? "true" : "false");
        tg.onclick = () => ctx.act("extra", (s) => S.setExtra(s, x));
        row.appendChild(pr2); row.appendChild(tg);
      }
      box.appendChild(row);
    });
  }

  /* ---------- the whole side panel (Barnwright refreshUI 5114-5198) ---------- */
  function refreshUI() {
    const state = ctx.state, T = cat.TYPES[state.type];
    const curCat = S.catOfType(state.type, cat);
    /* 1: category + style chips */
    const cs = el("catsel");
    if (cs.options.length === 0) {
      (cat.CATS || []).forEach((c, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = c[0]; cs.appendChild(o); });
      cs.onchange = () => ctx.act("style", (s) => S.chooseCategory(s, +cs.value, cat));
    }
    cs.value = String(curCat);
    cs.style.display = (cat.CATS || []).length > 1 ? "" : "none";
    const tc = el("typechips"); tc.innerHTML = "";
    S.stylesIn(curCat, cat).forEach((t) => {
      tc.appendChild(chip(state.type === t, esc(cat.TYPES[t].name) + (showMoney() ? small("from " + M(minPrice(t, cat))) : ""), () => ctx.act("style", (s) => S.chooseType(s, t, cat))));
    });
    el("dormerrow").style.display = T.dormer && (cat.DORMERS || []).length > 1 ? "block" : "none";
    if (T.dormer) {
      const dc = el("dormerchips"); dc.innerHTML = "";
      (cat.DORMERS || []).forEach((dd) => {
        dc.appendChild(chip(state.dormer === dd[0], esc(dd[1]) + (dd[2] ? (showMoney() ? small("+" + M(dd[2])) : "") : small("included look")), () => ctx.act("dormer", (s) => S.chooseDormer(s, dd[0]))));
      });
    }
    /* 2: sizes, the size note, the side porch */
    const sc = el("sizechips"); sc.innerHTML = "";
    pSizes(state.type, cat).forEach((sz) => {
      const b = chip(state.size === sz, esc(sz.replace("x", " × ")) + (showMoney() ? small(M(pPrice(state.type, sz, cat))) : ""), () => ctx.act("size", (s) => S.chooseSize(s, sz, cat)));
      b.setAttribute("data-size", sz);
      sc.appendChild(b);
    });
    el("sizenote").textContent = sizeNote(+String(state.size).split("x")[0]);
    const pr = el("porchrow");
    if (T.porch === "S") {
      pr.style.display = "block";
      const Lnow = +String(state.size).split("x")[1];
      const pc = el("porchchips"); pc.innerHTML = "";
      [["8", "4 × 8 porch"], ["12", "4 × 12 porch"]].forEach((pp2) => {
        const dis = (pp2[0] === "12" && Lnow < 20);
        pc.appendChild(chip(("" + state.pLen) === pp2[0], pp2[1] + small(dis ? "20 ft &amp; up" : "included"), () => ctx.act("porch", (s) => S.choosePorchLength(s, pp2[0], cat)), dis));
      });
      [["end", "Corner porch"], ["mid", "Middle porch"]].forEach((pm) => {
        const on = (pm[0] === "mid") === (!!state.pMid);
        pc.appendChild(chip(on, pm[1] + small(pm[0] === "mid" ? "centered" : "at one end"), () => ctx.act("porch", (s) => S.choosePorchPlace(s, pm[0] === "mid", cat))));
      });
      if (!state.pMid) {
        pc.appendChild(chip(false, "⇄ Flip porch" + small("now: " + (state.pFlip ? "right" : "left") + " end"), () => ctx.act("porch", (s) => S.flipPorch(s, cat))));
      }
      el("porchnote").textContent = state.pMid
        ? "Porch is set into the middle of the long side, with the building enclosed on both ends."
        : "Porch is set into the corner — as you face it, it’s on the " + (state.pFlip ? "right" : "left") + " end.";
    } else pr.style.display = "none";
    /* 3: colours */
    el("sidlbl").textContent = T.metal ? "Metal" : "Siding";
    swRow(el("sw-body"), sidingPalette(T, cat.COLORS), "body", "nm-body");
    swRow(el("sw-trim"), cat.COLORS.trim, "trim", "nm-trim");
    swRow(el("sw-door"), cat.COLORS.paint, "doorC", "nm-doorC", "Same as the siding");
    swRow(el("sw-shut"), cat.COLORS.paint, "shutC", "nm-shutC", "Same as the trim");
    swRow(el("sw-roof"), cat.COLORS.metal, "roof", "nm-roof");
    /* 4 and 5: the add buttons -- an item the company does not sell has none */
    const CAT = cat.CAT;
    el("add-door").style.display = S.firstOf(cat, "addDoor") ? "" : "none";
    el("add-win").style.display = S.firstOf(cat, "addWindow") ? "" : "none";
    el("add-ru").style.display = S.firstOf(cat, "addRollup") ? "" : "none";
    el("add-post").style.display = (T.porch && CAT.ppost) ? "" : "none";
    el("add-light").style.display = CAT.light ? "" : "none";
    el("add-bench").style.display = CAT.bench ? "" : "none";
    el("add-shelf").style.display = CAT.shelf ? "" : "none";
    el("insidebtns").style.display = (CAT.bench || CAT.shelf) ? "" : "none";
    el("insidehint").style.display = (CAT.bench || CAT.shelf) ? "" : "none";
    updateOpts();
    el("insidecard").style.display = (CAT.bench || CAT.shelf || (cat.ELECPK || []).length > 1 || (cat.RAMPS || []).length > 1 ||
      Object.keys(cat.RATES || {}).length || optxList(cat).length) ? "" : "none";
    refreshLists();
  }

  /* The size note for a width: the company's note for that width, else for
     the widest width it has a note for that is narrower. */
  function sizeNote(W) {
    const N = (cat.notes && cat.notes.sizeNotes) || {};
    if (Object.prototype.hasOwnProperty.call(N, String(W))) return N[String(W)];
    let best = null;
    Object.keys(N).forEach((k) => { const w = +k; if (w <= W && (best === null || w > best)) best = w; });
    return best === null ? "" : N[String(best)];
  }

  /* ---------- the item list, the summary, the plate (Barnwright refreshLists) ---------- */
  function refreshLists() {
    const state = ctx.state, CAT = cat.CAT, T = cat.TYPES[state.type];
    const fr = ctx.frame();
    const il = el("itemlist"); il.innerHTML = "";
    state.items.forEach((it) => {
      const c = CAT[it.cat]; if (!c) return;
      const row = document.createElement("div"); row.className = "itemrow" + (state.sel === it.id ? " sel" : "");
      row.setAttribute("data-id", it.id);
      const chg = itemCharge(it, state, cat, fr);
      row.innerHTML = '<span class="dot"></span><span>' + esc(c.n) + (c.stretch ? (" " + esc(it.ln || 4) + " ft") : "") + (it.dbl ? " (double)" : "") + (it.shut ? " + shutters" : "") + (it.lite ? " + window" : "") +
        ' <span class="wl">— ' + esc(wallWords(it, c)) + '</span></span>' +
        '<span class="pr' + (chg > 0 ? "" : " inc") + '">' + (chg > 0 ? (showMoney() ? "+ " + M(chg) : "extra") : (it.pk ? "package" : "included")) + "</span>";
      row.onclick = () => ctx.select(it.id);
      il.appendChild(row);
    });
    /* the summary, then the plate */
    const pp = priceParts(state, cat, fr);
    const title = String(state.size).replace("x", " × ") + " " + T.name;
    const amt = (n) => showMoney() ? "<b>" + M(n) + "</b>" : "<b></b>";
    let h = '<div class="sumline"><span>' + esc(title) + "</span>" + amt(pp.base) + "</div>";
    pp.lines.forEach((l) => { h += '<div class="sumline"><span>' + esc(l[0]) + "</span>" + amt(l[1]) + "</div>"; });
    h += '<div class="sumline"><span>' + (T.metal ? "Metal" : "Siding") + " " + esc(colorName(sidingPalette(T, cat.COLORS), state.body)) +
      " · Trim " + esc(colorName(cat.COLORS.trim, state.trim)) + " · Roof " + esc(colorName(cat.COLORS.metal, state.roof)) + "</span><b>—</b></div>";
    if (showMoney()) h += '<div class="sumline tot"><span class="disp" style="letter-spacing:.08em;text-transform:uppercase;font-size:13px">Estimated total</span><b>' + M(pp.total) + "</b></div>";
    el("sum").innerHTML = h;
    el("platename").textContent = title;
    const show = cat.pricing.show;
    el("plateprice").textContent = show === "none" ? "Ask us" : show === "from" ? "from " + M(pp.base) : M(pp.total);
    el("platesample").textContent = show === "none" ? "for a price" : "plus tax";
    el("platerto").textContent = show === "none" ? "" : rtoText(show === "from" ? pp.base : pp.total);
    return pp;
  }

  /* "or $226/mo" when the company shows a rent-to-own term: price / factor /
     months (the arithmetic rent-to-own companies use; the Yoder site's rto60) */
  function rtoText(total) {
    const r = cat.pricing.rto;
    if (!r || r.showTerm == null || !r.factors) return "";
    const f = r.factors[String(r.showTerm)];
    if (!(f > 0)) return "";
    return " · or $" + Math.ceil(total / f / +r.showTerm).toLocaleString("en-US") + "/mo";
  }

  /* ---------- the add buttons (Barnwright 5065-5072) ----------
     Each adds the first item of its list the company sells, on the wall the
     camera faces, and selects it (the camera then turns to face it). A bench
     or a shelf only shows on the floor plan, so those also ask for the
     Inside view. Like Barnwright, adding does not redraw the side panels --
     select() redraws the building and the list. */
  function wireButtons() {
    const yaw = () => ctx.cam.yaw;
    function addWith(fn) {
      const it = ctx.act("add", fn, { refresh: false });
      if (it && it.id) ctx.select(it.id);
      return it;
    }
    const fromList = (name) => () => { const id = S.firstOf(cat, name); if (id) addWith((s) => S.addItem(s, id, cat, yaw())); };
    el("add-door").onclick = fromList("addDoor");
    el("add-win").onclick = fromList("addWindow");
    el("add-ru").onclick = fromList("addRollup");
    el("add-post").onclick = () => { if (cat.CAT.ppost) addWith((s) => S.addItem(s, "ppost", cat, yaw())); };
    el("add-light").onclick = () => { if (cat.CAT.light) addWith((s) => S.addItem(s, "light", cat, yaw())); };
    const inside = (id) => () => {
      if (!cat.CAT[id]) return;
      const it = ctx.act("add", (s) => S.addInterior(s, id, cat, yaw()), { refresh: false });
      ctx.goInside("add");
      if (it && it.id) ctx.select(it.id);
    };
    el("add-bench").onclick = inside("bench");
    el("add-shelf").onclick = inside("shelf");
  }
  wireButtons();

  return { refreshUI, refreshLists, wallWords };
}
