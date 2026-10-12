/* The owner's standard layout, using the customer's real designer. The
   server authorizes this mode before its price list is ever drawn. */
import { esc } from "./esc.js";
import * as S from "./state.js";
import { defaults } from "../model/design.js";
import { frameOf, porchDepthOf } from "../model/frame.js";
import { clampPos, itemById, itemW, fitsOnWall } from "../model/layout.js";
import { evalDataRecipe, layoutVariants, clampStandardPost } from "../model/loadouts.js";
import { builderRecipe, isBuilderEntry } from "../model/loadout-twins.js";
import { inferRecipe, ruleWords } from "../model/layout-recipe.js";
import { checkLayout } from "../model/layout-check.js";
import { stageTableFor } from "../engine/renderer.js";
import { makePlan } from "../model/plan.js";
import { assemble } from "../engine/assemble.js";
import { snapshot as renderSnapshot } from "../engine/snapshot.js";
import { y0 } from "../engine/constants.js";

const copy = (value) => JSON.parse(JSON.stringify(value));
const el = (id) => document.getElementById(id);
const WALLS = { F: "Front", R: "Right side", B: "Back", L: "Left side", S1: "Inside the porch", S2: "Porch side wall", S3: "Porch side wall", P1: "Angled porch wall", P2: "Porch front wall", P3: "Porch door wall" };
const YAW = { F: 0, R: Math.PI / 2, B: Math.PI, L: -Math.PI / 2, PF: 0, PR: Math.PI / 2, "34": .62 };
const sizeWords = (size) => String(size).replace("x", " × ");
const keyOf = (variant) => `${variant.pLen || 0}:${!!variant.pFlip}:${!!variant.pMid}`;
const apiPrefix = () => new URLSearchParams(location.search).get("preview") === "barnwright"
  || new URLSearchParams(location.search).get("layoutVisit") === "1" ? "/api/office/barnwright/" : "/api/office/";

async function request(path, body) {
  let response;
  try { response = await fetch(apiPrefix() + path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new Error("Can't reach the Dealer Center. Check your internet connection and try again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "That didn't save. Try again."), { status: response.status, data });
  return data;
}

export const fetchLayoutSettings = (style) => request(`layout-mode?style=${encodeURIComponent(style)}`);

function snapshot(items) {
  return items.map((item) => {
    const out = { ...item };
    for (const key of ["entryIndex", "recipeIndex", "_layoutEntry", "_layoutOccurrence"]) if (item[key] != null) Object.defineProperty(out, key, { value: item[key], configurable: true });
    return out;
  });
}

/* A layout-return address can never send an owner to another website. */
export function returnAddress(style, asked, origin = location.origin) {
  try { const url = new URL(asked || "", origin); if (url.origin === origin && /^\/dealer\/?$/.test(url.pathname)) return url.pathname + url.search + `#/price-list/building/${encodeURIComponent(style)}`; }
  catch { /* use the Dealer Center below */ }
  return `/dealer#/price-list/building/${encodeURIComponent(style)}`;
}

export async function install(api) {
  if (!api.layoutStart) {
    if (api.layoutError) { el("stagenote").textContent = api.layoutError; el("stagenote").hidden = false; }
    return null;
  }
  const data = api.layoutStart, cat = api.getCatalogue(), query = new URLSearchParams(location.search);
  const style = data.style || query.get("layout"), name = data.name || cat.TYPES[style]?.name;
  if (!cat.TYPES[style]) return null;
  let recipe = copy(data.layout || builderRecipe(cat, style)), originalRecipe = copy(recipe), originalItems = [];
  let version = data.version, rules = {}, touched = new Set(), view = "F", busy = false, dirty = false, laying = false, newest = "", retainedNotice = "", blockedRecipe = null;
  const back = returnAddress(style, query.get("returnTo"));
  const storageKey = `dealer-center:layout-draft:${cat.id || cat.managed?.companyId || "company"}:${style}`;
  try {
    const kept = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if ((kept?.version === version || kept?.pendingUnpriced) && Date.now() - kept.at < 8 * 3600000 && Array.isArray(kept.layout)) { recipe = kept.layout; retainedNotice = kept.pendingUnpriced ? "Your unsaved layout is here. Check it, then tap Save as standard." : kept.notice || ""; dirty = true; }
  } catch { /* storage is optional */ }
  document.body.classList.add("layout-mode");
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = new URL("./layout-mode.css", import.meta.url).href; document.head.append(css);

  const heading = document.createElement("section"); heading.className = "layout-heading";
  heading.innerHTML = `<h1>Setting the standard layout for ${esc(name)}. Every lot uses it.</h1><p>Move, add or remove doors and windows${cat.TYPES[style].porch ? " and porch posts" : ""}, then tap Save as standard. Customers start from it and can still move things on their own building.</p>`;
  el("hdr").after(heading);
  const foot = document.createElement("div"); foot.id = "layout-savebar";
  foot.innerHTML = '<span id="layout-savewords" role="status">Every size is checked before it saves.</span><div><button type="button" id="layout-cancel">Cancel</button><button type="button" id="layout-save">Save as standard</button></div>';
  document.body.append(foot);
  el("layout-cancel").onclick = () => { if (!dirty || confirm("Leave these layout changes?")) { dirty = false; forgetDraft(); location.assign(back); } };
  el("layout-save").onclick = save;

  const viewChoices = document.createElement("div"); viewChoices.className = "layout-wallchoices"; viewChoices.setAttribute("role", "group"); viewChoices.setAttribute("aria-label", "Pick a wall or the porch");
  const choices = [["F", "Front"], ["R", "Right"], ["B", "Back"], ["L", "Left"]];
  const porch = cat.TYPES[style].porch;
  if (porch) choices.push(...(porch === "C" ? [["PF", "Porch front"], ["PR", "Porch side"]] : [[porch === "S" ? "PR" : "PF", "Porch"]]));
  for (const [key, label] of choices) {
    const button = document.createElement("button"); button.type = "button"; button.dataset.layoutView = key; button.textContent = label; button.onclick = () => setView(key); viewChoices.append(button);
    if (key.startsWith("P")) { const menu = button.cloneNode(true); menu.dataset.v = key; menu.onclick = () => { setView(key); el("views").classList.remove("open"); }; el("viewmenu").append(menu); }
  }
  api.stage.before(viewChoices);
  const caption = document.createElement("div"); caption.id = "layout-caption"; caption.setAttribute("aria-live", "polite"); api.stage.after(caption);
  const ghosts = document.createElement("div"); ghosts.className = "layout-postlayer"; api.stage.append(ghosts);
  const notice = document.createElement("p"); notice.id = "layout-notice"; notice.setAttribute("role", "status"); el("sheet").before(notice);
  const moves = document.createElement("div"); moves.id = "layout-moves";
  moves.innerHTML = '<div class="layout-movebuttons"><span>Move</span><button type="button" id="layout-left" aria-label="Move left 3 inches">‹</button><button type="button" id="layout-right" aria-label="Move right 3 inches">›</button><small>3 in each tap</small></div><p id="layout-limit" role="status"></p>';
  el("sheet").querySelector(".srow").after(moves);
  moves.after(el("sheet").querySelector(".sbtns"));
  const carries = document.createElement("div"); carries.id = "layout-carries"; el("sheet").append(carries);
  el("layout-left").onclick = () => move(-.25); el("layout-right").onclick = () => move(.25);
  const selector = document.createElement("div"); selector.id = "layout-porchchoice"; el("card-size").append(selector);
  const addCard = document.createElement("section"); addCard.id = "layout-add"; addCard.className = "card";
  addCard.innerHTML = '<h3>Add a door or window' + (porch ? ' or porch post' : '') + '</h3><div id="layout-addchoices"></div><p>What you add here comes with the building. Raise the prices on the Edit page if you need to.</p><button type="button" id="layout-builder">Start again from the builder’s layout</button>';
  el("wrap").append(addCard);
  el("layout-builder").onclick = () => { if (confirm("Start again from the builder's doors, windows and posts?")) { blockedRecipe = null; document.body.classList.remove("layout-mode-blocked"); recipe = builderRecipe(cat, style); lay({}); dirty = true; rememberDraft(); } };
  const result = document.createElement("section"); result.id = "layout-result"; result.hidden = true; result.setAttribute("role", "dialog"); result.setAttribute("aria-modal", "true"); result.setAttribute("aria-label", "Every size checked"); document.body.append(result);

  function isPorch() { return view === "PF" || view === "PR"; }
  function edge() { return view === "PR" ? "R" : "F"; }
  function frame() { return frameOf(api.getState(), cat); }
  function savedEntry(item) { return originalRecipe[item.entryIndex ?? item.recipeIndex]; }
  function picked() { return itemById(api.getState(), api.getState().sel); }
  function rememberDraft(notice = "") { try { sessionStorage.setItem(storageKey, JSON.stringify({ version, layout: blockedRecipe || recipe, at: Date.now(), notice, pendingUnpriced: !!blockedRecipe })); } catch { /* changes still stay on screen */ } }
  function forgetDraft() { try { sessionStorage.removeItem(storageKey); } catch { /* optional */ } }
  function say(words) { newest = words || ""; notice.textContent = newest; }

  /* Keep entries which are conditional on another size or porch. Looking at
     a smaller building must never erase a window from the larger ones. */
  function inferCurrent() {
    if (blockedRecipe) return copy(blockedRecipe);
    return inferRecipe(api.getState().items, frame(), { originalItems, originalRecipe, rules, touched, sizes: data.sizes });
  }

  function lay(changes = {}) {
    laying = true;
    api.setState((state) => {
      Object.assign(state, changes, { type: style, sel: null });
      if (!data.sizes.includes(state.size)) state.size = data.openingSize || data.sizes[Math.min(4, data.sizes.length - 1)];
      const fr = frameOf(state, cat);
      state.items = evalDataRecipe(recipe, fr.d.W, fr.d.L, { CAT: cat.CAT, ws: fr.ws, span: fr.span, t: fr.t, frame: fr, porchDepth: porchDepthOf(fr.t) });
      state.seq = state.items.length;
    }, { reason: "layout-look" });
    originalItems = snapshot(api.getState().items); originalRecipe = copy(recipe); rules = {}; touched = new Set(); laying = false;
    refresh(); setView(view); updateLayers();
  }

  function setView(key, keepSelection = false) {
    if (!(key in YAW)) return false;
    view = key; api.setMode("out");
    api.camera.anim = null; api.camera.yaw = YAW[key]; api.camera.pitch = key === "34" ? .215 : 0; api.camera.autoSpin = false; api.camera.interacted = true;
    const table = stageTableFor("finished");
    if (!isPorch() && key !== "34") { table.porch = { hidden: true }; table["porch-frame"] = { hidden: true }; }
    api.renderer.setStages(table); api.renderer.needsDraw = true;
    api.stage.classList.toggle("layout-porch-view", isPorch());
    for (const button of viewChoices.children) button.setAttribute("aria-pressed", String(button.dataset.layoutView === key));
    if (!keepSelection && api.getState().sel) api.select(null);
    refreshCaption(); refreshAdd(); updateLayers(); return true;
  }

  function porchWords(state = api.getState()) {
    return `${porchDepthOf(cat.TYPES[style])} × ${state.pLen || frame().span?.P || 12} porch ${state.pMid ? "in the middle (Middle porch)" : state.pFlip ? "at the back end (Flip porch)" : "at the front end"}`;
  }
  function refreshCaption() {
    const state = api.getState(); let words = isPorch() ? `The ${view === "PR" ? "side" : "front"} of the porch on the ${sizeWords(state.size)}. Brown posts move. The striped corner posts hold up the porch roof, so they stay.` : `The ${WALLS[view]?.toLowerCase() || "building"} of the ${sizeWords(state.size)}.`;
    if (porch === "S") words += ` With the ${porchWords()}.`;
    if (isPorch()) words += " The pale drawing is the wall behind the porch, with its door and windows.";
    if (picked()) words = isPorch() ? "Brown posts move. Striped corner posts stay." : `The ${WALLS[view]?.toLowerCase() || "building"} of the ${sizeWords(state.size)}.`;
    const fr = frame(); const duplicates = state.items.filter((item) => cat.CAT[item.cat].k === "post").some((item, index, list) => list.some((other, j) => j < index && other.wall === item.wall && Math.abs(other.pos - item.pos) < .34));
    if (duplicates) words += " Two porch posts stand in the same spot. Move one, or remove it.";
    caption.replaceChildren(document.createTextNode(words));
    if (porch && !isPorch()) {
      const link = document.createElement("button"); link.type = "button";
      link.textContent = picked() ? "Move the dashed posts on the porch" : porch === "C" ? "The dashed posts stand on the front edge of the porch. Move them on the porch" : porch === "F" ? `The dashed posts stand on the porch, ${porchDepthOf(fr.t)} ft in front of this wall. Move them on the porch` : "The porch posts are on the side of the porch. Go to the porch";
      link.onclick = () => setView(porch === "S" || (porch === "C" && view === "R") ? "PR" : "PF"); caption.append(link);
    }
  }

  function refresh() {
    el("plateprice").textContent = "Standard layout"; el("platesample").textContent = ""; el("platerto").textContent = "";
    el("card-size").querySelector("h3").textContent = "Size you're looking at";
    for (const chip of el("sizechips").children) {
      const size = chip.dataset.size;
      if (size) chip.onclick = () => { if (blockedRecipe) return; recipe = inferCurrent(); lay({ size }); };
    }
    if (porch === "S") {
      const state = api.getState(), variants = layoutVariants(cat.TYPES[style], state.size);
      selector.innerHTML = '<label for="layout-porch-select">Porch the customer picks</label><select id="layout-porch-select"></select><p>Customers can change the porch in the 3D designer. Pick one here to see your layout with it.</p>';
      const select = el("layout-porch-select");
      for (const variant of variants) { const option = document.createElement("option"); option.value = keyOf(variant); option.textContent = porchWords(variant) + (!variant.pMid && !variant.pFlip && variant.pLen === Math.max(...variants.map((v) => +v.pLen)) ? " (opens first)" : ""); option.selected = keyOf(variant) === keyOf(state); select.append(option); }
      select.onchange = () => { if (blockedRecipe) return; recipe = inferCurrent(); lay(variants.find((variant) => keyOf(variant) === select.value)); };
    } else selector.hidden = true;
    refreshCaption(); refreshAdd();
  }

  function refreshAdd() {
    const host = el("layout-addchoices"); host.replaceChildren();
    const codes = isPorch() ? (cat.CAT.ppost ? ["ppost"] : []) : [...S.listOf(cat, "addDoor"), ...S.listOf(cat, "addRollup"), ...S.listOf(cat, "addWindow")];
    for (const code of [...new Set(codes)]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = code === "ppost" ? "+ Porch post" : "+ " + cat.CAT[code].n;
      if (cat.CAT[code].gable && !fitsOnWall(cat.CAT[code], "F", frame())) { button.disabled = true; button.title = "Too tall for this gable"; }
      button.onclick = () => add(code); host.append(button);
    }
  }

  function postLimit(item, requested) {
    const fr = frame();
    if (Math.abs(item.pos - requested) < .00001) return "";
    if (item.wall === "F") return "It's as close to the corner post as it can go.";
    const front = fr.t.porch === "S" ? !fr.span.f ? item.pos > requested : item.pos < requested : item.pos > requested;
    if (front && !fr.span?.mid) return "It's as close to the corner post as it can go: a post stays 10 3/16 in from the front of the porch.";
    return fr.t.porch === "C" && !front ? "It's at the end of the porch: a post stays 7 3/16 in from the end." : "It's at the end of the porch: a post stays 10 3/16 in from the end.";
  }
  function overlap(item, distance = .34, state = api.getState()) { return state.items.some((other) => other.id !== item.id && other.wall === item.wall && cat.CAT[other.cat]?.k === "post" && Math.abs(other.pos - item.pos) < distance - 1e-8); }
  function move(amount) {
    if (blockedRecipe) return;
    const item = picked(); if (!item) return;
    const wanted = item.pos + amount; newest = "";
    api.setState((state) => { S.moveItem(state, item.id, { pos: wanted }, cat); if (cat.CAT[item.cat].k === "post") clampStandardPost(item, frame()); carryMovedItem(item); }, { reason: "layout-move" });
    el("layout-limit").textContent = cat.CAT[item.cat].k === "post" ? overlap(item) ? "It's standing on another porch post. Move it along, or tap Remove." : postLimit(item, wanted) : Math.abs(item.pos - wanted) > .001 ? "It needs room beside the next opening and the corner." : "";
    api.select(item.id); rememberDraft();
  }

  /* A chosen anchor describes the new position after Move or drag. Keeping
     its old distance would visibly move an opening and then save it back
     where it started. */
  function carryMovedItem(item) {
    let rule = rules[item.id];
    if (!rule && savedEntry(item)?.when) rule = rules[item.id] = { when: copy(savedEntry(item).when) };
    if (!rule) return;
    const fr = frame(), len = fr.ws[item.wall]?.len || fr.d.W, width = itemW(item, cat.CAT), post = cat.CAT[item.cat].k === "post", at = rule.at;
    let next;
    if (at === "center") next = { pos: `len*${item.pos / len}` };
    else if (at?.fromStart != null) next = { fromStart: item.pos + len / 2 - width / 2 };
    else if (at?.fromEnd != null) next = { fromEnd: len / 2 - item.pos - width / 2 };
    else if (at?.porchStart != null) next = { porchStart: fr.span.f ? -item.pos - fr.span.z0 : fr.span.z1 + item.pos };
    else if (at?.porchDoor != null) { const door = api.getState().items.find((part) => part.wall === "S1" && cat.CAT[part.cat]?.k === "door"); next = door ? { porchDoor: item.pos - door.pos + (fr.span.z0 + fr.span.z1) / 2 } : at; }
    else if (at?.sym != null) next = { sym: `len*${Math.abs(item.pos) / len}` };
    else if (at?.pos != null) {
      const value = String(at.pos);
      next = post && value.startsWith("-W/2+") ? { pos: `-W/2+${item.pos + fr.d.W / 2}` }
        : post && value.startsWith("W/2-") ? { pos: `W/2-${fr.d.W / 2 - item.pos}` }
        : post && item.wall === "R" && fr.t.porch === "C" ? { pos: `${item.pos + fr.d.L / 2}-L/2` }
        : /^len\*/.test(value) ? { pos: `len*${item.pos / len}` } : { pos: item.pos };
    }
    if (next) rules[item.id] = { ...rule, at: next };
  }

  function setRule(item, at) {
    const when = rules[item.id]?.when || savedEntry(item)?.when;
    rules[item.id] = { at, ...(when ? { when: copy(when) } : {}) };
  }

  /* Try the requested spot, then 3-inch steps each way. A new post is
     checked on every size and every allowed porch, including where a short
     porch holds it at the end. */
  function clearNewPost(item, start, direction = 1) {
    const state = api.getState(), fr = frame(), candidates = [], seen = new Set();
    for (const sign of [direction, -direction]) for (let i = 0; i <= 320; i++) {
      item.pos = start + sign * i * .25; clampPos(item, state, fr); clampStandardPost(item, fr);
      const pos = item.pos.toFixed(6); if (!seen.has(pos)) { candidates.push(item.pos); seen.add(pos); }
    }
    let shown = null;
    for (const pos of candidates) {
      item.pos = pos; if (overlap(item, .67)) continue;
      shown ??= pos;
      const candidate = inferCurrent(), made = inferRecipe([item], fr, { originalRecipe: [], originalItems: [], rules })[0];
      const newIndex = candidate.findLastIndex((entry) => JSON.stringify(entry) === JSON.stringify(made));
      const checked = checkLayout(candidate, cat, style);
      if (!checked.checks.some((check) => {
        const posts = check.items.filter((part) => cat.CAT[part.cat]?.k === "post");
        const added = posts.filter((part) => part.entryIndex === newIndex);
        return added.some((part) => posts.some((other) => other !== part && part.wall === other.wall && Math.abs(part.pos - other.pos) < .67 - 1e-8));
      })) { recipe = candidate; return ""; }
    }
    item.pos = shown ?? candidates[0] ?? start;
    return shown == null ? "It's right beside another post. Drag it where you want it." : "With some sizes, or a porch a customer can pick, it stands on another post. Save as standard says where.";
  }
  function add(code, duplicate = null) {
    if (blockedRecipe) return;
    let item;
    api.setState((state) => {
      if (duplicate) item = S.duplicateItem(state, duplicate.id, cat);
      else item = S.addItem(state, code, cat, YAW[view]);
      if (!item) return;
      if (duplicate && cat.CAT[item.cat].k !== "post" && !cat.CAT[item.cat].gable) {
        touched.add(duplicate.id); delete rules[duplicate.id]; item.pos = -duplicate.pos; clampPos(item, state, frameOf(state, cat));
      }
      if (cat.CAT[item.cat].k === "post") {
        if (isPorch()) item.wall = edge();
        const desired = duplicate ? duplicate.pos + 1.5 : item.pos; item.pos = desired; clampPos(item, state, frameOf(state, cat)); clampStandardPost(item, frameOf(state, cat));
        let direction = 1; if (duplicate && Math.abs(item.pos - desired) > .001) { item.pos = duplicate.pos - 1.5; direction = -1; }
        const extra = clearNewPost(item, item.pos, direction);
        const door = state.items.some((other) => cat.CAT[other.cat]?.k === "door" && (other.wall === item.wall || other.wall === "S1") && Math.abs(other.pos - item.pos) < cat.CAT[other.cat].w / 2);
        const words = ruleWords(inferRecipe([item], frameOf(state, cat), { originalRecipe: [], originalItems: [] })[0], frameOf(state, cat));
        say(`Added another porch post, ${words.toLowerCase()}${door ? ", in front of the door" : ""}.${extra ? " " + extra : ""}`);
      }
      item.inc = true;
    }, { reason: "layout-add" });
    if (item) { api.select(item.id); dirty = true; recipe = inferCurrent(); rememberDraft(); }
  }

  function sheet(item) {
    el("sh-price").textContent = "comes with the building";
    el("sh-dup").textContent = cat.CAT[item.cat].k === "post" ? "Add another post" : "Add a matching one";
    el("sh-dup").onclick = () => add(item.cat, picked());
    const before = originalItems.find((part) => part.id === item.id), untouched = before && before.cat === item.cat && before.wall === item.wall && Math.abs(before.pos - item.pos) < 1 / 192 && !!before.dbl === !!item.dbl;
    const current = rules[item.id] || (untouched ? savedEntry(item) : null), inferred = inferRecipe([item], frame(), { originalRecipe: [], originalItems: [], rules });
    const entry = current ? { ...inferred[0], ...current } : inferred[0], c = cat.CAT[item.cat], isPost = c.k === "post";
    const builderSource = before && savedEntry(item) && isBuilderEntry(savedEntry(item), frame().t);
    const builderNow = untouched && builderSource;
    const options = isPost ? item.wall === "R" ? [["porch", frame().span?.f ? "From the back of the porch" : frame().span?.mid ? "From the front end of the porch" : "From the front of the porch"]] : [["middle", "Same distance from the middle"], ["left", "From the left corner"], ["right", "From the right corner"]]
      : [["center", "In the middle"], ["left", "From the left end"], ["right", "From the right end"], ["share", "Same share of the wall"], ["pair", "A matched pair"]];
    carries.innerHTML = `<p class="layout-rule">${esc(ruleWords(entry, frame()))}</p>${isPost ? `<p>The railing stays open ${porch === "S" ? "in front of the porch door" : "in the widest gap"}: that’s the way in, and where a ramp goes.</p>` : ''}<label for="layout-rule-select">How it carries over to other sizes</label><select id="layout-rule-select"><option value="${builderSource ? "builder" : ""}"${builderSource ? "" : " disabled"}>${builderSource ? "Where the builder puts it" : "Pick a rule"}</option>${options.map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><div id="layout-gaprow" hidden><label for="layout-gap">Distance in inches</label><input id="layout-gap" type="number" step="0.0625"><button type="button" id="layout-gapapply">Use this distance</button></div><p id="layout-now">${builderNow ? "Now: where the builder puts it. Pick one to change it." : "Your rule is kept on every size."}</p><div id="layout-closeposts"></div>`;
    const choose = el("layout-rule-select");
    choose.onchange = () => {
      const kind = choose.value, fr = frame(), len = fr.ws[item.wall]?.len || fr.d.W, width = itemW(item, cat.CAT);
      if (kind === "builder" && builderSource) {
        delete rules[item.id]; touched.delete(item.id);
        api.setState(() => Object.assign(item, before), { reason: "layout-rule" }); api.select(item.id); return;
      }
      el("layout-gaprow").hidden = ["builder", "center", "share", "pair"].includes(kind);
      el("layout-gap").value = ((kind === "left" ? isPost ? item.pos + fr.d.W / 2 : item.pos + len / 2 - width / 2 : kind === "right" ? isPost ? fr.d.W / 2 - item.pos : len / 2 - item.pos - width / 2 : kind === "porch" ? fr.t.porch === "S" ? fr.span.f ? -fr.span.z0 - item.pos : fr.span.z1 + item.pos : item.pos + fr.d.L / 2 : item.pos) * 12).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
      if (kind === "center") { setRule(item, "center"); api.setState((state) => S.moveItem(state, item.id, { pos: 0 }, cat), { reason: "layout-rule" }); }
      if (kind === "share" || kind === "pair") {
        setRule(item, { [kind === "pair" ? "sym" : "pos"]: `len*${((kind === "pair" ? Math.abs(item.pos) : item.pos) / len).toFixed(6)}` });
        if (kind === "pair" && savedEntry(item)?.at?.sym != null) api.setState((state) => { state.items = state.items.filter((part) => part.id === item.id || part.entryIndex !== item.entryIndex); }, { reason: "layout-pair", refresh: false });
        recipe = inferCurrent(); dirty = true; rememberDraft();
        if (kind === "pair") { const where = { cat: item.cat, wall: item.wall, pos: item.pos }; lay({}); const match = api.getState().items.filter((part) => part.cat === where.cat && part.wall === where.wall).sort((a, b) => Math.abs(a.pos - where.pos) - Math.abs(b.pos - where.pos))[0]; if (match) api.select(match.id); }
      }
      el("layout-gapapply").onclick = () => {
        const gap = +el("layout-gap").value / 12; if (!Number.isFinite(gap)) return;
        let at;
        if (isPost) at = kind === "porch" ? fr.t.porch === "S" ? { porchStart: gap } : { pos: `${gap}-L/2` } : { pos: kind === "left" ? `-W/2+${gap}` : kind === "right" ? `W/2-${gap}` : gap };
        else at = { [kind === "left" ? "fromStart" : "fromEnd"]: gap };
        setRule(item, at); const placed = evalDataRecipe([{ cat: item.cat, wall: item.wall, at, ...(item.dbl ? { dbl: true } : {}) }], fr.d.W, fr.d.L, { CAT: cat.CAT, ws: fr.ws, span: fr.span, t: fr.t });
        api.setState((state) => S.moveItem(state, item.id, { pos: placed[0].pos }, cat), { reason: "layout-rule" }); api.select(item.id);
      };
    };
    const near = api.getState().items.filter((other) => other.id !== item.id && other.wall === item.wall && cat.CAT[other.cat]?.k === "post" && Math.abs(other.pos - item.pos) < .75).sort((a, b) => a.pos - b.pos);
    for (const other of near) { const button = document.createElement("button"); button.type = "button"; button.textContent = other.pos <= item.pos ? "The one to the left" : "The one to the right"; button.onclick = () => api.select(other.id); el("layout-closeposts").append(button); }
    if (isPost && overlap(item)) el("layout-limit").textContent = "It's standing on another porch post. Move it along, or tap Remove.";
  }

  let allowReflowReveal = true, revealQueued = false;
  function queueSheetReveal() {
    if (revealQueued) return;
    revealQueued = true;
    requestAnimationFrame(() => {
      revealQueued = false;
      const item = picked();
      if (!item || !el("sheet").classList.contains("open")) return;
      const title = el("sheet").querySelector(".srow").getBoundingClientRect(), buttons = el("sheet").querySelector(".sbtns").getBoundingClientRect();
      const safeTop = 100, safeBottom = foot.getBoundingClientRect().top - 12;
      let by = buttons.bottom > safeBottom ? buttons.bottom - safeBottom : title.top < safeTop ? title.top - safeTop : 0;
      /* The action buttons must be reachable even when the screen cannot
         also hold the picture. Compact phone captions keep both in view
         on normal walls; never undo the scroll needed by the buttons. */
      if (Math.abs(by) > 1) window.scrollBy({ top: by, behavior: "instant" });
    });
  }
  function revealSheet() { allowReflowReveal = true; queueSheetReveal(); }
  function revealAfterReflow() {
    if (!allowReflowReveal || !document.body.classList.contains("layout-mode") || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
    if (picked()) queueSheetReveal();
  }
  /* A late font or stylesheet can move the entire sheet after the first
     selection frame. Re-check real layout changes, while respecting a
     person's own scrolling away from the picked item. */
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(revealAfterReflow);
    for (const node of [heading, viewChoices, api.stage, caption, foot, el("sheet").querySelector(".srow"), moves, el("sheet").querySelector(".sbtns")]) observer.observe(node);
  }
  css.addEventListener("load", revealAfterReflow);
  document.fonts?.ready.then(revealAfterReflow);
  document.fonts?.addEventListener("loadingdone", revealAfterReflow);
  window.addEventListener("wheel", (event) => { if (!api.stage.contains(event.target)) allowReflowReveal = false; }, { passive: true });
  window.addEventListener("touchmove", (event) => { if (!api.stage.contains(event.target)) allowReflowReveal = false; }, { passive: true });
  window.addEventListener("keydown", (event) => { if (["PageUp", "PageDown", "Home", "End"].includes(event.key)) allowReflowReveal = false; });

  /* Screen targets are placed from the same world coordinates as the part,
     while ordinary walls use the renderer's existing item hit quads. */
  let layerKeys = "", layerButtons = [];
  function layerParts() {
    const fr = frame(), state = api.getState(); if (!porch || api.getMode() === "in" || view === "34") return [];
    const face = isPorch() ? edge() : view === "F" ? "F" : view === "R" ? "R" : null;
    if (!face || (porch === "S" && face !== "R") || (porch === "F" && face !== "F")) return [];
    const postPoint = (pos, y) => face === "F" ? [pos, y, fr.d.L / 2 - .2] : [fr.d.W / 2 - .2, y, -pos];
    const parts = state.items.filter((item) => item.wall === face && cat.CAT[item.cat]?.k === "post").map((item) => ({ id: item.id, pos: item.pos, item, fixed: false, p0: postPoint(item.pos, y0), p1: postPoint(item.pos, y0 + fr.t.wallH) }));
    if (isPorch()) {
      const positions = face === "F" ? [-fr.d.W / 2 + .28, fr.d.W / 2 - .28] : porch === "S" && !fr.span.mid ? [fr.span.f ? -fr.span.z0 - .28 : -fr.span.z1 + .28] : [];
      for (const pos of positions) parts.push({ id: `fixed-${pos}`, pos, fixed: true, p0: postPoint(pos, y0), p1: postPoint(pos, y0 + fr.t.wallH) });
    }
    return parts.sort((a, b) => a.pos - b.pos);
  }
  function updateLayers() {
    const parts = layerParts(), pc = api.renderer.projCache; if (!pc.proj) return;
    const keys = parts.map((part) => part.id).join(",") + view;
    if (keys !== layerKeys) {
      layerKeys = keys; ghosts.replaceChildren(); layerButtons = parts.map((part) => {
        const button = document.createElement("button"); button.type = "button"; button.dataset.item = part.id; button.className = "layout-posthit" + (isPorch() ? " solid" : " ghost") + (part.fixed ? " fixed" : "");
        button.setAttribute("aria-label", part.fixed ? "Corner post holds up the porch roof" : isPorch() ? "Move this porch post" : "Dashed porch post. Move it on the porch");
        button.onclick = (event) => { if (event.detail || blockedRecipe) return; if (part.fixed) say("The corner posts hold up the porch roof, so they stay."); else { if (!isPorch()) setView(part.item.wall === "R" ? "PR" : "PF", true); api.select(part.id); } };
        button.onpointerdown = (event) => {
          if (event.button > 0 || blockedRecipe) return;
          const bounds = api.canvas.getBoundingClientRect(), point = [event.clientX - bounds.left, event.clientY - bounds.top];
          const nearest = layerParts().reduce((best, candidate) => { const at = api.renderer.projCache.proj(candidate.p0); const gap = at ? Math.abs(at[0] - point[0]) : Infinity; return !best || gap < best.gap ? { candidate, gap } : best; }, null)?.candidate || part;
          if (nearest.fixed) { event.preventDefault(); event.stopPropagation(); say("The corner posts hold up the porch roof, so they stay."); return; }
          event.preventDefault(); event.stopPropagation(); if (!isPorch()) setView(nearest.item.wall === "R" ? "PR" : "PF", true); api.renderer.draw(); api.startItemDrag(event, nearest.id);
        };
        ghosts.append(button); return button;
      });
    }
    const positions = parts.map((part) => ({ low: pc.proj(part.p0), high: pc.proj(part.p1) }));
    parts.forEach((part, index) => {
      const button = layerButtons[index], pos = positions[index]; if (!button || !pos.low || !pos.high) return;
      const x = (pos.low[0] + pos.high[0]) / 2, y = Math.min(pos.low[1], pos.high[1]), h = Math.max(44, Math.abs(pos.low[1] - pos.high[1]));
      let left = x - 22, right = x + 22;
      const before = positions[index - 1]?.low, after = positions[index + 1]?.low;
      if (before && Math.abs(before[0] - x) < 44) left = (before[0] + x) / 2;
      if (after && Math.abs(after[0] - x) < 44) right = (after[0] + x) / 2;
      if (right - left < 44 && !before) left = right - 44; if (right - left < 44 && !after) right = left + 44;
      const width = Math.max(44, right - left); left = x - width / 2;
      button.style.cssText = `left:${left}px;top:${y}px;width:${width}px;height:${h}px;--post-center:${x - left}px`;
      button.classList.toggle("selected", api.getState().sel === part.id);
    });
  }
  function loop() { if (!document.body.classList.contains("layout-mode")) return; updateLayers(); requestAnimationFrame(loop); }

  function openPorchAt(px, py) {
    if (!porch || isPorch() || !(view in WALLS)) return false;
    const fr = frame(), { W, L } = fr.d, depth = porchDepthOf(fr.t), patches = [];
    const rectangle = (a, b) => [a, [a[0], y0 + fr.t.wallH, a[2]], [b[0], y0 + fr.t.wallH, b[2]], b];
    if (porch === "F" && ["R", "L"].includes(view)) patches.push(rectangle([view === "R" ? W / 2 : -W / 2, y0, L / 2 - depth], [view === "R" ? W / 2 : -W / 2, y0, L / 2]));
    if (porch === "S") {
      if (view === "R") patches.push(rectangle([W / 2, y0, fr.span.z0], [W / 2, y0, fr.span.z1]));
      if ((view === "F" && !fr.span.f || view === "B" && fr.span.f) && !fr.span.mid) patches.push(rectangle([W / 2 - depth, y0, view === "F" ? L / 2 : -L / 2], [W / 2, y0, view === "F" ? L / 2 : -L / 2]));
    }
    if (porch === "C") {
      if (view === "F") patches.push(rectangle([-W / 2 + 4, y0, L / 2], [W / 2, y0, L / 2]));
      if (view === "R") patches.push(rectangle([W / 2, y0, L / 2 - 12], [W / 2, y0, L / 2]));
      if (view === "L") patches.push(rectangle([-W / 2, y0, L / 2 - depth], [-W / 2, y0, L / 2]));
    }
    for (const patch of patches) {
      const points = patch.map((point) => api.renderer.projCache.proj(point)); if (points.some((point) => !point)) continue;
      let inside = false;
      for (let a = 0, b = points.length - 1; a < points.length; b = a++) if ((points[a][1] > py) !== (points[b][1] > py) && px < (points[b][0] - points[a][0]) * (py - points[a][1]) / (points[b][1] - points[a][1]) + points[a][0]) inside = !inside;
      if (inside) { setView(porch === "S" || porch === "C" && view === "R" ? "PR" : "PF"); return true; }
    }
    return false;
  }

  function drawing(check) {
    const problem = check.problems?.find((item) => item.kind === "posts") || check.problems?.[0];
    const wall = problem?.wall || (view === "PR" ? "R" : view === "PF" || view === "34" ? "F" : view);
    const onPorch = problem?.kind === "posts" || isPorch();
    const tables = api.renderer.stageTable;
    let picture = "";
    try {
      const state = Object.assign(defaults(cat), copy(check.state), { sel: null });
      const plan = makePlan(state, cat), drawn = assemble(plan, { viewport: { w: 400, h: 300 }, fit: "fitref", frames: false });
      const stages = stageTableFor("finished");
      if (!onPorch) { stages.porch = { hidden: true }; stages["porch-frame"] = { hidden: true }; }
      api.renderer.setStages(stages);
      picture = renderSnapshot(api.renderer, { result: drawn, size: { w: 400, h: 300 }, dpr: 1,
        cam: { yaw: YAW[wall] ?? Math.PI / 2, pitch: 0 }, background: "#E9E9E5", restore: false });
    } catch { /* The checked positions and words still show without WebGL. */ }
    finally {
      const restored = [];
      for (let index = 0; index < (tables?.length || 0) / 4; index++) restored.push({ hidden: tables[index * 4] > .5, lift: tables[index * 4 + 1] });
      api.renderer.setStages(restored); api.renderer.draw();
    }
    const label = `${sizeWords(check.size)} · ${onPorch ? "Porch" : WALLS[wall] || "Wall"}`;
    return `<figure><svg viewBox="0 0 400 300" aria-label="${esc(label)}" role="img">${picture ? `<image href="${picture}" width="400" height="300"/>` : '<text x="20" y="150" font-size="18">The drawing could not open</text>'}</svg><figcaption>${esc(label)}${porch === "S" ? " · " + esc(porchWords(check.variant)) : ""}<br>${esc(check.caption || "Every size checked")}</figcaption></figure>`;
  }

  function showResult(check, saved = false, extra = "") {
    result.hidden = false; result.className = check.errors.length ? "bad" : check.warnings.length ? "warning" : "good";
    const hasPosts = check.problems?.some((problem) => problem.kind === "posts");
    result.innerHTML = `<div class="layout-resultcard"><button id="layout-resultclose" type="button" aria-label="Close results">×</button><h2>${saved ? check.warnings.length ? "Saved. One thing to look at" : "Saved as standard" : check.errors.length ? "One thing to change before it saves" : "Every size checked"}</h2><p>${esc(extra || check.summary || `Checked ${data.sizes.length} sizes.`)}</p>${check.messages.map((words) => `<p>${esc(typeof words === "string" ? words : words.message)}</p>`).join("")}<div class="layout-examples">${(check.examples || []).map(drawing).join("")}</div><div id="layout-fixes"></div><div class="layout-resultbuttons">${hasPosts ? '<button type="button" id="layout-showposts">Show me the two posts</button>' : ''}${saved ? '<button type="button" id="layout-return">Back to Edit building</button>' : '<button type="button" id="layout-keep">Keep changing it</button>'}</div></div>`;
    el("layout-resultclose").onclick = () => { result.hidden = true; if (hasPosts) showPosts(check); };
    el("layout-keep")?.addEventListener("click", () => { result.hidden = true; });
    el("layout-return")?.addEventListener("click", () => { forgetDraft(); location.assign(back); });
    el("layout-showposts")?.addEventListener("click", () => { result.hidden = true; showPosts(check); });
    for (const fix of check.fixes || []) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = fix.message || fix.label || `Only put it on sizes ${fix.when?.minL} ft long and up`;
      button.onclick = () => { recipe[fix.entryIndex].when = copy(fix.when); lay({}); dirty = true; result.hidden = true; say("That door is kept on the sizes you picked. Tap Save as standard."); }; el("layout-fixes").append(button);
    }
    el("layout-resultclose").focus();
  }
  function showPosts(check) {
    const problem = (check.problems || []).find((item) => /post/.test(item.kind) || /porch posts/.test(item.message));
    const first = check.checks.find((item) => item.problems?.some((problem) => problem.kind === "posts")) || check.checks[0]; if (!first) return;
    lay({ size: first.size, ...first.variant }); setView(problem?.wall === "R" || porch === "S" ? "PR" : "PF");
    const state = api.getState(), post = state.items.find((item) => cat.CAT[item.cat]?.k === "post" && overlap(item));
    if (post) { api.select(post.id); el("layout-limit").textContent = "It's standing on another porch post. Move it along, or tap Remove."; }
  }
  async function save() {
    if (busy) return;
    recipe = inferCurrent(); const checked = checkLayout(recipe, cat, style);
    if (!checked.ok) { showResult(checked); return; }
    busy = true; el("layout-save").disabled = true; el("layout-savewords").textContent = "Every size checked. Saving for all lots…";
    try {
      const saved = await request("price-list/layout", { style, layout: recipe, version }); version = saved.version; dirty = false; forgetDraft();
      lay({}); showResult(checked, true); el("layout-savewords").textContent = "Saved for every lot.";
    } catch (error) {
      if (error.status === 409) {
        const words = "Someone saved the price list first. Your layout is still here. Look it over, then tap Save as standard again.";
        try {
          const current = await fetchLayoutSettings(style); version = current.version;
          rememberDraft(words); dirty = false; location.reload(); return;
        } catch { rememberDraft(words); say(words); }
      } else { say(error.message); if (error.data?.problems) showResult({ ...checked, ok: false, errors: error.data.problems.map((problem) => typeof problem === "string" ? problem : problem.message), messages: error.data.problems }, false, error.message); }
      el("layout-savewords").textContent = "Your changes are still here.";
    } finally { busy = false; el("layout-save").disabled = false; }
  }

  api.setInteractionHooks({
    setView,
    faceItem(item) { setView(cat.CAT[item.cat].k === "post" ? item.wall === "R" ? "PR" : "PF" : item.wall in YAW ? item.wall : "R", true); return true; },
    revealSheet,
    allowPick(id) { if (blockedRecipe) return false; const item = itemById(api.getState(), id); return !!item && (!isPorch() || cat.CAT[item.cat]?.k === "post"); },
    onBlank(px, py) { if (isPorch()) { say(`That's the wall behind the porch. To move its door or windows, tap ${view === "PF" ? "Front" : "Right"}.`); return true; } return openPorchAt(px, py); },
    wallChoices() { return isPorch() ? [["+ Porch post", "ppost"]] : [["+ Door", S.firstOf(cat, "addDoor")], ["+ Window", S.firstOf(cat, "addWindow")]].filter((pair) => pair[1]); },
    afterDrag(item, wanted) { if (cat.CAT[item.cat].k === "post") { clampStandardPost(item, frame()); el("layout-limit").textContent = overlap(item) ? "It's standing on another porch post. Move it along, or tap Remove." : postLimit(item, wanted); } else { if (Math.abs(item.pos) < 1 / 3) item.pos = 0; const other = api.getState().items.find((part) => part.id !== item.id && part.cat === item.cat && part.wall === item.wall && Math.abs(item.pos + part.pos) < 1 / 3); if (other) item.pos = -other.pos; } carryMovedItem(item); },
    finishDrag: carryMovedItem,
  });
  api.on("sheet", ({ item }) => sheet(item));
  api.on("select", ({ item }) => { if (!item) { newest = ""; notice.textContent = ""; el("layout-limit").textContent = ""; } refreshCaption(); });
  api.on("change", ({ reason }) => { if (laying || reason === "layout-look") return; dirty = true; recipe = inferCurrent(); rememberDraft(); refresh(); });
  api.on("rebuild", () => { if (!laying) refresh(); });
  window.addEventListener("keydown", (event) => {
    if (result.hidden === false && event.key === "Escape") { result.hidden = true; return; }
    if (!picked() || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault(); move(event.key === "ArrowLeft" ? -.25 : .25);
  });
  window.addEventListener("beforeunload", (event) => { if (dirty) { rememberDraft(); event.preventDefault(); event.returnValue = ""; } });
  const state = defaults(cat); Object.assign(state, data.colors || {});
  api.setState((current) => Object.assign(current, state), { reason: "layout-look", refresh: false });
  const opening = { type: style, size: data.openingSize || data.sizes[Math.min(4, data.sizes.length - 1)], pMid: false, pFlip: false };
  try { lay(opening); if (retainedNotice) say(retainedNotice); }
  catch (error) {
    blockedRecipe = copy(recipe); recipe = copy(data.layout || builderRecipe(cat, style)); lay(opening);
    document.body.classList.add("layout-mode-blocked"); dirty = true;
    const words = "The price list changed, and an item in your unsaved layout cannot open. Your changes are kept. Go back to Edit building to check its doors and windows.";
    say(words); rememberDraft(words);
    const returnButton = document.createElement("button"); returnButton.type = "button"; returnButton.textContent = "Back to Edit building";
    returnButton.onclick = () => { rememberDraft(words); dirty = false; location.assign(back); }; notice.append(returnButton);
  }
  loop();
  const controller = { getRecipe: () => inferCurrent(), check: () => checkLayout(inferCurrent(), cat, style), setView, save, add, move, get view() { return view; }, get version() { return version; } };
  api.layoutMode = controller;
  return controller;
}

export default install;
