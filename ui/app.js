/* THE DESIGNER PAGE'S ENGINE ROOM. Browser file (index.html loads it).

   What it does, in order:
   1. Works out which company this is: /d/<lot>/ in the address is a lot of
      a business on the Dealer Center (its price list comes from the
      server); else /c/<id>/, else ?company=<id>, else "demo". ?embed=1
      means the page is inside a company's own web page (embed.js): no
      header bar.
   2. Loads that company's settings BEFORE anything is drawn (ui/load.js:
      the company file, its manufacturer, the construction defaults, all
      checked). A settings problem shows the list of problems in plain words
      instead of a half-working designer; a company whose status is
      "suspended" shows "This designer is not available -- call <phone>".
      ON A LOT'S LINK the customer never sees a settings problem, a code or
      "demo": a closed lot (or a business not open yet) says "Our 3D
      designer isn't open right now. Call us at <phone>." and anything else
      that stops it says "Our 3D designer couldn't open just now"; the
      reason goes to the browser's console for whoever looks after it.
   3. Paints the company's colours and name on the page (Barnwright's
      wk-theme.js rules: five colours in, the rest worked out and kept
      readable).
   4. Starts the design: the company's default building (model/design.js
      defaults), or the design in a shared link's #d=... (decode + toState),
      then normalize.
   5. Draws it: model/plan.js makePlan -> engine/assemble.js assemble (camera
      fit "fitref", the Finished view) -> engine/renderer.js, and starts the
      render loop (the 10 second opening turn, which a visitor who prefers
      reduced motion does not get).
   6. Wires the cards (ui/panels.js), the selection sheet (ui/sheet.js) and
      the pointer (ui/interaction.js), then loads the PLUGINS.

   Barnwright's rhythm is kept: every change to the design goes
   "change the state -> refresh the cards -> rebuild the building" (its
   refreshUI -> buildShed), and selecting an item rebuilds too (the glow is
   baked in).

   -------------------------------------------------------------------------
   THE PAGE'S API: window.shedUI. Other files plug in through this object and
   never need to edit this one.

     getState()            the live design (Barnwright's `state`). Read it
                           freely; change it only through setState.
     setState(fn, opts)    fn(state) changes the design in place; then the
                           rules are applied (normalize), the cards redrawn and
                           the building rebuilt, and "change" fires. opts:
                           {reason: "why", refresh: false (skip the cards)}.
                           Returns what fn returned.
     rebuild()             rebuild the building from the state as it is.
     refresh()             redraw the cards and rebuild.
     getCatalogue()        the company's catalogue (model/company.js resolve),
                           frozen: prices, styles, items, colours, brand, leads...
     getPlan() / getResult()   the last frozen plan and assemble() result.
     price()               priceParts for the design now {base, lines, total}.
     getDesign(opts)       the design as saved/shared (model/design.js
                           fromState; opts.priced adds the price and date).
     applyDesign(design)   replace the live design with a saved one (toState);
                           returns the warnings (anything that no longer exists).
     select(id)            select an item (null: none), as a tap does.
     on(event, fn)         -> a function that unhooks it. fn(detail, api).
                             "change"  {reason, state}   the design changed
                             "select"  {id, item}        an item was picked / put down
                             "rebuild" {plan, result}    the building was rebuilt
                             "mode"    {mode}            Outside / Inside switched
                             "rebuild-error" {message, frames}  a rebuild threw; the
                                                   last good picture is still on screen
     getMode() / setMode("out" | "in")   the 3D picture or the floor plan:
                           setMode puts .bpmode on the stage (which shows
                           canvas#bp and hides the hint and camera menu),
                           relabels the Inside button and fires "mode". It
                           does not draw the plan -- ui/blueprint.js does.
     onInside              null until a plugin sets it: a function called by
                           the Inside button with {want: "toggle", reason:
                           "button"}, and when something was added that only
                           shows on the floor plan (an electric package, a
                           bench, a shelf, an outlet) with {want: "in",
                           reason}. With no plugin the button does nothing.
     setBuildOptions({scene}) / getBuildOptions()   update the scene and rebuild.
                           Customer builds always use frames: false.
     setReadOnly(bool)     a look-only page (a shared link): nothing can be
                           selected, dragged or added; body.viewonly hides the
                           cards (ui/styles.css).
     showAddPop(px, py, spot, choices) / hideAddPop() / addAt(itemCode, spot)
                           the "Add here" menu (the floor plan uses it too):
                           px, py in CSS pixels in the stage; spot {wall, u}
                           or {px, pz, rot}; choices [[label, itemCode], ...].
     ftIn(feet)            5′-3″, as the tape measure writes it.
     camera, animYaw(yaw, pitch)   the camera and its glide.
     renderer, canvas, stage   the engine's renderer (setStages, setScene,
                           draw, projCache, test hooks), canvas#c3d, #stage.
     mounts                {view, quote, share, bp}: the empty elements left
                           for the plugins (#view-mount, #quote-mount,
                           #share-mount, canvas#bp).
     embedded              true inside a company's page (?embed=1).
     startDesign / startWarnings / startError   the shared link the page opened
                           with (#d=...), what no longer exists in it, or why it
                           could not be read. The link is already applied.
     plugins               which plugins loaded ({"views": true, ...}).
     ready                 true once the first picture is drawn and every
                           plugin has had its turn; window fires "shedui:ready"
                           (detail: the api) at that moment.

   PLUGINS: after the first picture, this page imports, in order,
   ui/views.js, ui/blueprint.js, ui/quote.js and ui/share.js -- and, only when
   the page runs inside a company's own web page (?embed=1), ui/embed-mode.js
   (the messages to that page, the "Tap to design" and Ctrl-to-zoom rules). Each exports
   install(api) (or a default function): it is called once with the api and
   may be async. A plugin file that does not exist yet is skipped (the
   browser notes the missing file in its console; nothing else happens); a
   plugin that throws is reported with console.error and the page carries on.
   ------------------------------------------------------------------------- */

import { loadCompany, loadLot } from "./load.js";
import { esc, safeUrl, telHref } from "./esc.js";
import { defaults, normalize, toState, fromState, decode } from "../model/design.js";
import { makePlan } from "../model/plan.js";
import { frameOf } from "../model/frame.js";
import { itemById } from "../model/layout.js";
import { priceParts } from "../model/pricing.js";
import { assemble } from "../engine/assemble.js";
import { createRenderer, stageTableFor } from "../engine/renderer.js";
import { createCamera, animYaw } from "../engine/camera.js";
import { paintBackdrop } from "../engine/scene.js";
import { createPanels } from "./panels.js";
import { createSheet } from "./sheet.js";
import { createInteraction, ftIn } from "./interaction.js";

export const PLUGINS = Object.freeze(["views", "blueprint", "quote", "share"]);

const el = (id) => document.getElementById(id);

/* ------------------------------------------------------------------------
   The company's colours (Barnwright's wk-theme.js, lines 60-190): five
   colours in, ten out, every worked-out one moved until it is readable
   against what it sits on. No colours set: nothing changes (the standard
   black and gold in ui/styles.css). Two more than Barnwright
   (docs/DIFFERENCES.md): the words on the button colour are white when
   white reads on it and dark when it does not (a gold or orange button),
   and the see-through panels over the building (--glass) follow the
   company's colour instead of staying navy. */
function rgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function hex(a) { return "#" + a.map((v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
function lum(a) { const f = a.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; }
function ratio(x, y) { const a = lum(rgb(x)), b = lum(rgb(y)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
function mix(x, y, t) { const a = rgb(x), b = rgb(y); return hex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t)); }
function readable(colour, against, need) {
  if (ratio(colour, against) >= need) return colour;
  const away = lum(rgb(against)) > 0.5 ? "#000000" : "#ffffff";
  for (let i = 1; i <= 20; i++) { const tryIt = mix(colour, away, i / 20); if (ratio(tryIt, against) >= need) return tryIt; }
  return away;
}
/* words on a button: white when white reads on it, else a dark colour that does */
export function onColour(fill, dark) {
  const white = ratio("#ffffff", fill);
  if (white >= 4.5) return "#ffffff";
  const start = cleanHex(dark) || "#16130e";
  let c = start;
  for (let i = 1; i <= 20 && ratio(c, fill) < 4.5; i++) c = mix(start, "#000000", i / 20);
  return ratio(c, fill) > white ? c : "#ffffff";
}
function cleanHex(v) {
  if (typeof v !== "string") return null;
  v = v.trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return null;
  if (v.length === 4) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return v.toLowerCase();
}
export function themeTokens(C) {
  if (!C || typeof C !== "object") return {};
  const header = cleanHex(C.header), primary = cleanHex(C.primary) || header, accent = cleanHex(C.accent);
  const page = cleanHex(C.page), ink = cleanHex(C.ink);
  const out = {};
  const set = (k, v) => { if (v) out[k] = v; };
  if (!header && !accent && !page && !ink) return out;
  set("--navy-deep", header); set("--navy", primary); set("--red", accent); set("--paper", page); set("--ink", ink);
  if (page && ink) set("--sub", cleanHex(C.sub) || readable(mix(ink, page, 0.42), page, 4.5));
  if (page) set("--line", cleanHex(C.line) || mix(page, "#000000", 0.10));
  if (page) set("--card-line", cleanHex(C.cardLine) || mix(page, "#000000", 0.14));
  if (header) set("--cream", cleanHex(C.cream) || readable(mix(header, "#ffffff", 0.94), header, 7));
  if (header && accent) set("--cyan", cleanHex(C.cyan) || readable(mix(accent, "#ffffff", 0.45), header, 4.5));
  if (header) set("--hdr-sub", cleanHex(C.hdrSub) || readable(mix(header, "#ffffff", 0.66), header, 4.5));
  if (accent) { set("--on-red", onColour(accent, header)); set("--red-rgb", rgb(accent).join(",")); }
  if (primary) set("--glass", rgb(primary).join(","));
  return out;
}
function applyTheme(colors) {
  const out = themeTokens(colors);
  const css = Object.keys(out).map((k) => k + ":" + out[k] + ";").join("");
  if (!css) return out;
  const st = document.createElement("style");
  st.id = "company-theme";
  st.textContent = ":root:root{" + css + "}";
  document.head.appendChild(st);
  if (out["--navy-deep"]) Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), (m) => m.setAttribute("content", out["--navy-deep"]));
  return out;
}

/* ------------------------------------------------------------------------
   When the designer cannot start: a plain card in place of the page. */
function bootMessage(title, html) {
  const lay = el("layout"); if (lay) lay.style.display = "none";
  const box = document.createElement("div");
  box.className = "bootmsg"; box.id = "bootmsg";
  box.innerHTML = '<section class="card"><h3>' + esc(title) + "</h3>" + html + "</section>";
  document.body.appendChild(box);
}

function brandHeader(cat) {
  const b = cat.brand;
  document.title = (b.name ? b.name + " — " : "") + "3D Shed Designer";
  const badge = el("brand-badge");
  const logo = safeUrl(b.logo, { image: true, mail: false });
  if (logo) { const img = document.createElement("img"); img.alt = ""; img.src = logo; badge.appendChild(img); }
  else badge.textContent = (b.initials || String(b.name || "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 3)).toUpperCase();
  el("brand-name").textContent = b.name;
  el("plate-brand").textContent = b.short || b.name;
  const cr = b.credit || {};
  const credit = el("credit");
  if (cr.show !== false && cr.text) {
    const url = safeUrl(cr.url, { mail: false });
    credit.innerHTML = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(cr.text) + "</a>" : esc(cr.text);
  }
  el("fineprint").textContent = (cat.notes && cat.notes.finePrint) || "";
}

/* A lot's link that cannot open: words for the customer, never the reason.
   closed: the lot is closed or the business is not open yet (the server
   said 404, or the price list says suspended). phone: the lot's (or the
   business's) number when it is known. */
function lotClosedMessage(closed, phone) {
  const tel = telHref(phone);
  const call = phone ? "Call us at " + (tel ? '<a href="' + esc(tel) + '">' + esc(phone) + "</a>" : esc(phone)) + "." : "";
  if (closed) bootMessage("Our 3D designer isn't open right now", "<p>" + (call || "Please check back soon.") + "</p>");
  else bootMessage("Our 3D designer couldn't open just now", "<p>Please try again in a minute." + (call ? " " + call : "") + "</p>");
}

/* ------------------------------------------------------------------------ */

async function boot() {
  const q = new URLSearchParams(location.search);
  const pm = /\/c\/([a-z0-9-]{2,40})\/?$/.exec(location.pathname);
  const lotMatch = /\/d\/([a-z0-9-]{2,40})\/?$/.exec(location.pathname);
  /* a lot's link never falls back to a company file ("demo" or ?company=) */
  const companyId = lotMatch ? null : (pm && pm[1]) || q.get("company") || "demo";
  const embedded = q.get("embed") === "1";
  if (embedded) document.body.classList.add("embedded");

  /* 2. the company, before anything is drawn */
  let loaded;
  try { loaded = lotMatch ? await loadLot(lotMatch[1]) : await loadCompany(companyId); }
  catch (e) {
    console.error("The designer could not load its settings:", e.message);
    if (lotMatch) lotClosedMessage(e.status === 404, "");
    else bootMessage("This designer could not start", "<p>" + esc(e.message) + "</p>");
    return null;
  }
  if (lotMatch && loaded.problems.length) {
    console.error(`The price list for the lot "${lotMatch[1]}" has ${loaded.problems.length} problem(s):\n - ` + loaded.problems.join("\n - "));
    const lot = loaded.lot || {}, brand = (loaded.company && loaded.company.brand) || {};
    lotClosedMessage(false, lot.phone || brand.phone || "");
    return null;
  }
  if (loaded.problems.length) {
    console.error(`The settings for "${companyId}" have ${loaded.problems.length} problem(s):\n - ` + loaded.problems.join("\n - "));
    bootMessage("This designer's settings need fixing",
      "<p>The settings for <b>" + esc(companyId) + "</b> have " + loaded.problems.length + " problem" + (loaded.problems.length > 1 ? "s" : "") + ":</p><div class=\"errbox\"><ul>" +
      loaded.problems.map((p) => "<li>" + esc(p) + "</li>").join("") + "</ul></div>");
    return null;
  }
  const cat = loaded.catalogue;

  /* 3. the company's colours and name */
  applyTheme(cat.brand.colors);
  brandHeader(cat);
  if (cat.status === "suspended" && cat.managed) {
    lotClosedMessage(true, cat.brand.phone);
    return null;
  }
  if (cat.status === "suspended") {
    const ph = cat.brand.phone, tel = telHref(ph);
    bootMessage("This designer is not available",
      "<p>" + (ph ? "Please call " + (tel ? '<a href="' + esc(tel) + '">' + esc(ph) + "</a>" : esc(ph)) + "." : "Please contact " + esc(cat.brand.name) + ".") + "</p>");
    return null;
  }

  /* 4. the design */
  let state = defaults(cat);
  let startDesign = null, startWarnings = [], startError = null;
  if (/[#&]d=/.test(location.hash || "")) {
    try {
      startDesign = await decode(location.hash);
      const t = toState(startDesign, cat);
      state = t.state; startWarnings = t.warnings;
    } catch (e) { startError = e.message; state = defaults(cat); }
  }
  normalize(state, null, cat);

  /* 5. the renderer */
  const canvas = el("c3d"), stage = el("stage");
  let renderer;
  try {
    renderer = createRenderer(canvas, { trueColour: !!cat.look.trueColour, scene: cat.look.scene || "studio" });
    paintBackdrop(stage, renderer.scene);
    renderer.setStages(stageTableFor("finished"));
  } catch (e) {
    console.error("The 3D picture could not start:", e);
    renderer = { off: true, cam: createCamera(), projCache: {}, needsDraw: false, stageTable: null, test: {}, frame: null, mesh: null,
      show() {}, setStages() {}, setScene() {}, draw() { return false; }, startLoop() {}, stopLoop() {} };
    note("The 3D picture could not start on this browser — you can still choose everything below.");
  }

  const listeners = {};
  let buildOpts = { frames: false, scene: null };

  const ctx = {
    cat: cat, get state() { return state; }, canvas: canvas, stage: stage, renderer: renderer, cam: renderer.cam,
    embedded: embedded, mode: "out", readOnly: false, plan: null, result: null,
    frame() { return frameOf(state, cat); },
    rebuild: rebuild, refreshUI: refreshUI, refreshLists: () => panels.refreshLists(), select: select, act: act, emit: emit,
    goInside(reason) { callInside({ want: "in", reason: reason || "" }); },
  };

  function note(text) {
    const n = el("stagenote"); if (!n) return;
    if (text) { n.textContent = text; n.hidden = false; } else { n.textContent = ""; n.hidden = true; }
  }

  function emit(ev, detail) {
    (listeners[ev] || []).slice().forEach((fn) => {
      try { fn(detail, api); } catch (e) { console.error(`A "${ev}" listener failed:`, e); }
    });
  }
  function on(ev, fn) {
    if (typeof fn !== "function") throw new Error("on(event, fn): fn must be a function.");
    (listeners[ev] = listeners[ev] || []).push(fn);
    return function off() { const l = listeners[ev] || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  }

  /* Rebuild the building from the state (Barnwright buildShed). A part that
     fails does not take the page down: the last good picture stays, a note
     says so, and every card, price and button keeps working. */
  let lastBuildError = null;
  function rebuild() {
    let plan = null;
    try {
      plan = makePlan(state, cat);
      const vp = { w: canvas.clientWidth, h: canvas.clientHeight };
      const opts = { viewport: vp, fit: "fitref", frames: false };
      if (buildOpts.scene) opts.scene = buildOpts.scene;
      const res = assemble(plan, opts);
      renderer.show(res);
      ctx.plan = plan; ctx.result = res;
      if (lastBuildError) { lastBuildError = null; note(null); }
      emit("rebuild", { plan: plan, result: res });
      return res;
    } catch (e) {
      if (plan) ctx.plan = plan;
      const msg = String(e && e.message || e);
      if (msg !== lastBuildError) console.error("Part of the 3D building could not be drawn:", e);
      lastBuildError = msg;
      note("Part of the 3D picture could not be drawn just now — everything below still works.");
      emit("rebuild-error", { message: msg, frames: !!buildOpts.frames });
      return null;
    }
  }

  function refreshUI() { panels.refreshUI(); rebuild(); }

  /* Every change: do it, apply the rules, redraw, tell the listeners. */
  function act(reason, fn, opts) {
    opts = opts || {};
    const out = fn ? fn(state) : undefined;
    normalize(state, null, cat);
    if (state.sel && !itemById(state, state.sel)) state.sel = null;
    if (opts.refresh !== false) {
      refreshUI();
      if (state.sel) sheet.sync(); else el("sheet").classList.remove("open");
    }
    emit("change", { reason: reason || "", state: state });
    return out;
  }

  function select(id) {
    if (ctx.readOnly && id) return;                /* the customer is looking, not building */
    sheet.select(id || null);
  }

  function callInside(req) {
    if (typeof api.onInside !== "function") return false;
    try { api.onInside(req, api); return true; } catch (e) { console.error("The Inside view failed:", e); return false; }
  }

  function setMode(m) {
    const mode = m === "in" ? "in" : "out";
    ctx.mode = mode;
    const st = el("stage"), mb = el("modebar");
    interaction.hideAddPop();
    if (mode === "in") { st.classList.add("bpmode"); mb.innerHTML = "&#9666; <b>Outside</b> &mdash; 3D view"; }
    else { st.classList.remove("bpmode"); mb.innerHTML = "<b>Inside</b> &mdash; floor plan &#9656;"; renderer.needsDraw = true; }
    emit("mode", { mode: mode });
    return mode;
  }

  const panels = createPanels(ctx);
  const sheet = createSheet(ctx);
  const interaction = createInteraction(ctx);
  el("modebar").onclick = () => callInside({ want: "toggle", reason: "button" });

  const api = {
    version: 1,
    getState: () => state,
    setState(fn, opts) { opts = opts || {}; return act(opts.reason || "api", fn, { refresh: opts.refresh !== false }); },
    rebuild: rebuild,
    refresh() { normalize(state, null, cat); refreshUI(); if (state.sel) sheet.sync(); },
    getCatalogue: () => cat,
    getPlan: () => ctx.plan,
    getResult: () => ctx.result,
    price: () => priceParts(state, cat),
    getDesign: (opts) => fromState(state, cat, opts),
    applyDesign(design) {
      const t = toState(design, cat);
      state = t.state;
      normalize(state, null, cat);
      state.sel = null; el("sheet").classList.remove("open"); sheet.forgetFaced();
      refreshUI();
      emit("change", { reason: "design", state: state });
      return t.warnings;
    },
    select: select,
    on: on,
    getMode: () => ctx.mode,
    setMode: setMode,
    onInside: null,
    setBuildOptions(o) { buildOpts = { frames: false, scene: o && o.scene !== undefined ? o.scene : buildOpts.scene }; return rebuild(); },
    getBuildOptions: () => Object.assign({}, buildOpts),
    setReadOnly(v) {
      ctx.readOnly = !!v;
      document.body.classList.toggle("viewonly", ctx.readOnly);
      if (ctx.readOnly && state.sel) sheet.select(null);
      interaction.hideAddPop();
      return ctx.readOnly;
    },
    get readOnly() { return ctx.readOnly; },
    showAddPop: (px, py, spot, choices) => interaction.showAddPop(px, py, spot, choices),
    hideAddPop: () => interaction.hideAddPop(),
    addAt: (itemCode, spot) => interaction.addAt(itemCode, spot || {}),
    ftIn: ftIn,
    get camera() { return renderer.cam; },
    animYaw: (yaw, pitch) => { animYaw(renderer.cam, yaw, pitch); renderer.needsDraw = true; },
    renderer: renderer, canvas: canvas, stage: stage,
    mounts: { view: el("view-mount"), quote: el("quote-mount"), share: el("share-mount"), bp: el("bp") },
    embedded: embedded,
    startDesign: startDesign, startWarnings: startWarnings, startError: startError,
    plugins: {},
    ready: false,
  };
  window.shedUI = api;

  /* 5 (cont.): the first picture, then the loop */
  refreshUI();
  renderer.startLoop({ fit: "fitref" });

  /* 6. the plugins (embed-mode only inside a company's own page) */
  for (const name of embedded ? PLUGINS.concat(["embed-mode"]) : PLUGINS) {
    try {
      const mod = await import("./" + name + ".js");
      const install = typeof mod.install === "function" ? mod.install : (typeof mod.default === "function" ? mod.default : null);
      if (install) await install(api);
      api.plugins[name] = true;
    } catch (e) {
      const missing = e && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Cannot find module/i.test(String(e.message || e));
      api.plugins[name] = false;
      if (!missing) console.error(`The ${name} plugin (ui/${name}.js) failed to start:`, e);
    }
  }
  api.ready = true;
  try { window.dispatchEvent(new CustomEvent("shedui:ready", { detail: api })); } catch (e) { /* very old browsers */ }
  return api;
}

export const started = boot();
