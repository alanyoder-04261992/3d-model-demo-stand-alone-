/* ONE BUILDING'S EDIT PAGE. These are the same draft sizes, prices and
   selling controls that used to open inside the Buildings list. */
import { h, clear, button, icon, confirmBox, dialog, toast, nextId } from "../../dom.js";
import { post } from "../../api.js";
import { money, size, plural } from "../../words.js";
import { S, edited, repaint } from "./state.js";
import {
  keysOf, isObj, sortSizes, fromPrice, missingPrices, styleName, baseOf, openingStyle, readPrice,
  WIDTH_MIN, WIDTH_MAX, LENGTH_MIN, LENGTH_MAX, COMMON_WIDTHS, PRICE_CAP, NAME_MAX,
} from "./model.js";
import { priceInput, msgs } from "./bits.js";
import { builtSection, catOf } from "./built.js";
import { picture, keyFor } from "./pictures.js";
import { pictureState } from "../../../../model/picture-key.js";
import { frameOf } from "../../../../model/frame.js";
import { recipeEntries } from "../../../../model/loadouts.js";
import { builderRecipe } from "../../../../model/loadout-twins.js";
import { ruleWords } from "../../../../model/layout-recipe.js";
import { checkLayout } from "../../../../model/layout-check.js";
import { fromState, encodeSync } from "../../../../model/design.js";

export const LAYOUT_RETURN = "dealer-center:layout-return";
const nameOf = (key) => styleName(S.M, key, S.draft?.offer[key] || S.parked.offer[key] || S.saved.settings.offer?.[key]);

export function buildingPage(key) {
  const entry = S.draft.offer[key];
  const back = button("Your buildings", () => S.ctx.go("/price-list"), { kind: "link", icon: "arrowLeft" });
  if (!entry) return h("div", { class: "pl-tab stack" }, back,
    h("section", { class: "card" }, h("h2", { class: "card-title" }, "This building isn't on your price list"),
      S.parked.offer[key] ? button("Sell it again", () => setSold(key, true)) : button("Add a building", () => S.ctx.go("/price-list/add-building"), { kind: "primary", icon: "plus" })));
  const lib = S.M.styles[baseOf(key, entry)] || {};
  const nameEl = h("h2", { class: "pl-page-title" }, nameOf(key));
  const meta = h("p", { class: "pl-card-meta" }, metaParts(entry));
  const figure = editPicture(key, entry);
  const stop = button("Stop selling", async () => {
    const ok = await confirmBox(`Stop selling the ${nameOf(key)}?`, "Every lot stops offering it when you save. Its sizes, prices and building numbers stay here until then, so you can sell it again.", { yes: "Stop selling", danger: true });
    if (ok) setSold(key, false);
  }, { kind: "danger", icon: "trash" });
  return h("div", { class: "pl-tab stack pl-building-page", dataset: { style: key } }, back,
    h("div", { class: "pl-edit-head" }, figure, h("div", { class: "pl-edit-title" }, nameEl, meta,
      h("p", { class: "muted" }, "Changes reach every lot when you tap the gold Save button."))),
    styleEditor(key, entry, lib, { nameEl, meta, own: !!entry.base }),
    opensOnRow(key, entry), layoutCard(key, entry),
    h("section", { class: "card pl-stop" }, h("div", {}, h("h2", { class: "card-title" }, "Stop selling this building"),
      h("p", { class: "muted" }, "It leaves every lot's 3D designer when you save. Quotes and orders already made keep it.")), stop));
}

function metaParts(entry) {
  const from = fromPrice(entry.sizes), missing = missingPrices(entry.sizes);
  return [plural(keysOf(entry.sizes).length, "size"), from != null ? ` · from ${money(from)}` : "", missing ? ` · ${missing} missing a price` : ""];
}

function redrawStyle(key, focusField) {
  const old = document.querySelector(".pl-building-page");
  if (old) old.replaceWith(buildingPage(key));
  repaint();
  if (focusField) document.querySelector(`[data-field="${CSS.escape(focusField)}"]`)?.focus();
}

/* Only redraw after the last relevant edit. A red building-number box
   keeps the last usable picture on screen while the owner fixes it. */
function editPicture(key, entry) {
  let cat = catOf(S.draft);
  let pic = picture(key, { size: "page", cat, M: S.M, base: baseOf(key, entry), name: nameOf(key) });
  const caption = h("figcaption", { class: "pl-pic-caption" });
  const figure = h("figure", { class: "pl-edit-picture" }, pic, caption);
  const say = () => {
    const bad = S.problems.some((p) => p.style === key && /^built:/.test(p.field || p.where || ""));
    const state = cat && cat.TYPES[key] ? pictureState(cat, key) : null;
    caption.textContent = bad ? "The picture waits until the red boxes are fixed." : state ? `Drawn at ${size(state.size)}. Your colors and building numbers.` : "The standard building picture.";
    return bad;
  };
  say();
  let timer;
  S.hooks.pictures = () => {
    clearTimeout(timer);
    if (say()) return;
    timer = setTimeout(() => {
      if (!figure.isConnected || S.sub.key !== key) return;
      const next = catOf(S.draft), oldKey = pic.querySelector("img")?.dataset.pictureKey;
      if (next && keyFor(next, key, "page") !== oldKey) {
        cat = next;
        const nextPic = picture(key, { size: "page", cat, M: S.M, base: baseOf(key, entry), name: nameOf(key) });
        pic.replaceWith(nextPic); pic = nextPic;
        const card = document.querySelector(`.pl-layout-card[data-layout="${CSS.escape(key)}"]`);
        if (card) card.replaceWith(layoutCard(key, entry));
      }
      const img = pic.querySelector("img");
      if (img?.dataset.picture === "drawn") img.alt = `${nameOf(key)} as your 3D designer shows it`;
      say();
    }, 500);
  };
  return figure;
}

function opensOnRow(key, entry) {
  const d = S.draft, chosen = openingStyle(d) === key;
  const check = h("input", { type: "checkbox", checked: chosen });
  const sizes = sortSizes(keysOf(entry.sizes));
  const select = h("select", { "aria-label": "The size it opens on", disabled: !chosen }, sizes.map((z) => h("option", { value: z }, size(z))));
  select.value = sizes.includes(d.defaults?.size) ? d.defaults.size : sizes[Math.min(4, sizes.length - 1)] || "";
  check.addEventListener("change", () => {
    if (check.checked) d.defaults = { ...(isObj(d.defaults) ? d.defaults : {}), style: key, size: select.value };
    else {
      const other = keysOf(d.offer).find((k) => k !== key);
      if (!other) { check.checked = true; toast("The 3D designer needs a building to open on."); return; }
      d.defaults = { ...(isObj(d.defaults) ? d.defaults : {}), style: other }; delete d.defaults.size;
    }
    select.disabled = !check.checked;
    edited();
  });
  select.addEventListener("change", () => { d.defaults.size = select.value; edited(); });
  let designer = null;
  try {
    const savedCat = catOf(S.saved.settings), lot = S.ctx.app.openLots()[0] || S.ctx.app.lots[0];
    if (lot && savedCat?.TYPES[key]) {
      const state = pictureState(savedCat, key), url = S.ctx.app.previewUrl(lot.slug);
      designer = h("p", { class: "pl-card-link" }, h("a", { class: "btn btn-link", href: `${url}#d=${encodeSync(fromState(state, savedCat))}`, target: "_blank", rel: "noopener" },
        icon("cube"), "See this building in the 3D designer"));
    }
  } catch { /* a newly added building is available after its first Save */ }
  return h("section", { class: "card pl-opens" },
    h("label", { class: "check" }, check, h("span", {}, "Open the 3D designer on this building", h("small", { class: "hint" }, "Customers see it first when they open a lot's 3D designer."))),
    h("div", { class: "field pl-opening-size" }, h("label", {}, "The size it opens on"), select), designer);
}

/* The saved layout has its own save. Keep the Dealer Center's draft in
   this tab while its 3D designer is open, tied to the same business and
   version. Returning consumes it and rebases a layout-only save. */
function openLayout(key) {
  const app = S.ctx.app;
  if (!S.saved.settings.offer?.[key]) { toast("Save this building first, then set its standard layout."); return; }
  const lot = app.openLots()[0] || app.lots[0];
  if (!lot) { toast("Add a lot first, then set its standard layout."); return; }
  try {
    sessionStorage.setItem(LAYOUT_RETURN, JSON.stringify({ id: S.saved.settings.id, actor: app.barnwright ? `visit:${app.barnwright.actor}` : `person:${app.person?.userId}`, version: S.saved.version, at: Date.now(), saved: S.saved.settings, draft: S.draft, parked: S.parked }));
  } catch { toast("This browser couldn't keep your changes. Save them first, then set the standard layout.", { error: true }); return; }
  const url = new URL(app.previewUrl(lot.slug), location.origin);
  url.searchParams.set("layout", key);
  if (app.demo) url.searchParams.set("dealerDemo", "1");
  url.searchParams.set("returnTo", `${location.pathname}${location.search}#/price-list/building/${key}`);
  S.layoutGoing = true;
  location.assign(url.href);
}

function layoutCard(key, entry) {
  const cat = catOf(S.draft), list = h("ul", { class: "pl-layout-list" });
  let report = null;
  if (cat?.TYPES[key]) {
    try {
      const state = pictureState(cat, key), frame = frameOf(state, cat);
      const recipe = entry.layout || builderRecipe(cat, key);
      report = checkLayout(recipe, cat, key);
      const placed = recipeEntries(recipe, frame.W, frame.L, { ...frame, frame });
      const walls = { F: "Front", B: "Back", R: "Right side", L: "Left side", S1: "Inside the porch", S2: "Porch end", S3: "Other porch end", P1: "Angled porch wall", P2: "Side porch wall", P3: "Back porch wall" };
      const groups = new Map();
      recipe.forEach((item, entryIndex) => {
        const c = cat.CAT[item.cat];
        if (!c) return;
        const wall = c.k === "post" ? "Porch" : c.gable ? `Gable on the ${walls[item.wall]?.toLowerCase() || "front"}` : walls[item.wall] || item.wall;
        if (!groups.has(wall)) groups.set(wall, []);
        /* A porch post is a plain thing, written in small letters mid-list. */
        const name = c.k === "post" ? (c.n || "Porch post").toLowerCase() : c.n || "Item";
        const pair = item.at?.sym !== undefined;
        const rule = c.k === "post" ? postWords(item, entryIndex, placed, frame) : ruleWords(item, frame);
        const details = h("span", {}, item.repeat ? `A row of ${name.toLowerCase()}s` : pair ? `Two ${name.toLowerCase()}s` : item.dbl ? `Double ${name.toLowerCase()}` : name,
          `, ${rule.charAt(0).toLowerCase() + rule.slice(1)}`, sizeRuleWords(item.when));
        for (const off of report.leftOff.filter((p) => p.entryIndex === entryIndex)) {
          const porch = off.variants?.some((v) => v.pMid || v.pFlip || v.pLen !== state.pLen);
          details.append(h("span", { class: "pl-layout-left-off" }, ` (left off the ${listWords(off.sizes.map(size))}${porch ? " when the customer changes the porch" : ""})`));
        }
        groups.get(wall).push(details);
      });
      for (const [wall, items] of groups) list.append(h("li", {}, h("strong", {}, `${wall}: `), items.flatMap((item, i) => i ? [" · ", item] : [item])));
    } catch { /* unfinished numbers keep the last picture and controls */ }
  }
  const out = h("section", { class: "card pl-layout-card", dataset: { layout: key } },
    h("h2", { class: "card-title" }, "Doors and windows that come with it"),
    h("p", { class: "pl-card-sub" }, entry.layout ? "Your standard layout. Every lot starts customers from it. Customers can still move things on their own building." : "The builder's layout. Every lot starts customers from it. Set your own and every lot uses it."), list,
    report?.warnings?.length ? h("div", { class: "pl-layout-warnings" }, report.warnings.map((words) => h("p", {}, words))) : null,
    h("div", { class: "actions" }, button(entry.layout ? "Change the standard layout" : "Set the standard layout", () => openLayout(key), { kind: "primary", icon: "cube" }),
      entry.layout ? button("Go back to the builder's layout", () => resetLayout(key)) : null),
    !S.saved.settings.offer?.[key] ? h("p", { class: "hint" }, "Save this building first, then set its standard layout.") : null,
    h("p", { class: "hint" }, "Doors, windows and posts in the standard layout come with the building. Customers can add more; their prices are on the Doors & windows tab."));
  return out;
}

function listWords(list) {
  return list.length < 3 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
function sizeRuleWords(when) {
  if (!when) return "";
  const rules = [];
  if (when.minL != null) rules.push(`sizes ${Math.ceil(when.minL)} ft long and up`);
  if (when.maxL != null) rules.push(`sizes up to ${Math.floor(when.maxL)} ft long`);
  if (when.minW != null) rules.push(`sizes ${Math.ceil(when.minW)} ft wide and up`);
  if (when.maxW != null) rules.push(`sizes up to ${Math.floor(when.maxW)} ft wide`);
  if (when.minP != null) rules.push(`porches ${when.minP} ft long and up`);
  if (when.maxP != null) rules.push(`porches up to ${when.maxP} ft long`);
  if (when.porch != null) {
    const places = [].concat(when.porch).map((p) => p === "back" ? "after Flip porch" : p === "middle" ? "with Middle porch" : "with Corner porch");
    rules.push(listWords(places));
  }
  return rules.length ? `, only on ${listWords(rules)}` : "";
}
function inchesWords(feet) {
  const total = Math.round(Math.abs(feet) * 192), ft = Math.floor(total / 192), whole = Math.floor((total % 192) / 16), fraction = total % 16;
  let denominator = 16, numerator = fraction;
  while (numerator && numerator % 2 === 0) { numerator /= 2; denominator /= 2; }
  const inch = whole || numerator ? `${whole || ""}${whole && numerator ? " " : ""}${numerator ? `${numerator}/${denominator}` : ""} in` : "";
  return [ft ? `${ft} ft` : "", inch].filter(Boolean).join(" ") || "0 in";
}
function postWords(entry, entryIndex, placed, frame) {
  const rule = ruleWords(entry, frame);
  const at = entry.at;
  if (at && typeof at === "object") {
    if (at.porchStart != null) return `${inchesWords(at.porchStart)} from the ${frame.span.f ? "back" : frame.span.mid ? "front end" : "front"} of the porch`;
    if (at.pos != null) {
      const pos = String(at.pos).replace(/\s+/g, "");
      if (/^-?\d+(\.\d+)?$/.test(pos)) return +pos === 0 ? "In the middle" : `${inchesWords(pos)} ${+pos < 0 ? "left" : "right"} of the middle`;
      const left = /^-W\/2\+(-?\d+(?:\.\d+)?)$/.exec(pos), right = /^W\/2-(-?\d+(?:\.\d+)?)$/.exec(pos);
      if (left || right) return `${inchesWords((left || right)[1])} from the ${left ? "left" : "right"} corner`;
      const side = /^(-?\d+(?:\.\d+)?)-L\/2$/.exec(pos);
      if (side && frame.t.porch === "C") return `${inchesWords(side[1])} from the front of the porch`;
    }
  }
  if (entry.at?.porchDoor != null) return `${inchesWords(entry.at.porchDoor)} from the porch door, toward the ${entry.at.porchDoor >= 0 ? "back" : "front"} end`;
  if (rule !== "Where the builder puts it" && rule !== "A matched pair stays matched") return rule;
  const posts = placed.filter((p) => p.entryIndex === entryIndex);
  if (!posts.length) return rule;
  if (entry.wall === "F") {
    if (entry.at?.sym !== undefined) return `Where the builder puts them, ${inchesWords(posts[0].pos)} each side of the middle`;
    return `Where the builder puts it, ${inchesWords(posts[0].pos)} ${posts[0].pos < 0 ? "left" : "right"} of the middle`;
  }
  if (frame.t.porch === "C") return `Where the builder puts it, ${inchesWords(posts[0].pos + frame.L / 2)} from the front of the porch`;
  return rule;
}

function layoutResetConfirm() {
  return new Promise((resolve) => {
    let answered = false;
    const yes = button("Go back to the builder's", () => { answered = true; box.close(); resolve(true); }, { kind: "primary" });
    const no = button("Keep yours", () => box.close());
    const box = dialog("Go back to the builder's layout for every lot?", [
      h("p", {}, "Every lot's 3D designer starts customers from the builder's doors, windows and porch posts again."),
      h("div", { class: "actions end" }, no, yes),
    ], { onClose: () => { if (!answered) resolve(false); } });
    box.el.classList.add("pl-layout-confirm");
    no.focus({ preventScroll: true });
  });
}

async function resetLayout(key) {
  const ok = await layoutResetConfirm();
  if (!ok) return;
  try {
    await post("price-list/layout", { style: key, layout: null, version: S.saved.version });
    const record = await S.ctx.app.loadPriceList(true);
    S.hooks.rebase?.(record);
    edited({ tab: true });
    toast("Saved. Every lot uses the builder's layout again.");
  } catch (e) { toast(e.message, { error: true, ms: 6000 }); }
}

function styleEditor(key, entry, lib, { nameEl, meta, own }) {
  const updateMeta = () => clear(meta, metaParts(entry, true, own));
  /* the name customers see */
  const id = nextId("pl");
  const nameBox = h("input", { id, type: "text", maxlength: NAME_MAX, autocomplete: "off", dataset: { field: `name:${key}` },
    placeholder: own ? `Like Premium ${lib.name}` : lib.name });
  nameBox.value = own ? entry.name || "" : entry.name || lib.name;
  nameBox.addEventListener("input", () => {
    const v = nameBox.value.trim().replace(/\s+/g, " ");
    if (own) entry.name = v;
    else if (!v || v === lib.name) delete entry.name;
    else entry.name = v;
    nameEl.textContent = styleName(S.M, key, entry);
    edited();
  });
  const nameHint = own
    ? `Built like the ${lib.name}: it starts with the same shape, with its own name, sizes, prices and building numbers.`
    : `The builder calls it the ${lib.name}. Rename it if your customers know it by another name.`;
  const nameField = h("div", { class: "field pl-style-namefield" },
    h("label", { htmlFor: id }, "Name customers see"), nameBox, h("p", { class: "hint" }, nameHint));

  /* sizes and prices */
  const list = h("ul", { class: "pl-sizes", "aria-label": `Sizes and prices of the ${styleName(S.M, key, entry)}` });
  for (const z of sortSizes(keysOf(entry.sizes))) {
    const price = priceInput({
      value: entry.sizes[z], label: `Price of the ${size(z)}`, field: `size:${key}:${z}`,
      onChange: (v) => { entry.sizes[z] = v; updateMeta(); edited(); },
    });
    const rm = h("button", { type: "button", class: "pl-icon-btn", "aria-label": `Remove ${size(z)}`, title: `Remove ${size(z)}` }, icon("trash"));
    rm.addEventListener("click", () => removeSize(key, z));
    list.append(h("li", { class: ["pl-size-row", S.justAdded === `${key}:${z}` && "pl-new"] },
      h("span", { class: "pl-size" }, size(z)), price.wrap, rm));
  }
  if (!keysOf(entry.sizes).length) list.append(h("li", { class: "pl-sizes-empty" }, "No sizes yet. Add the first one below."));
  S.justAdded = null;
  return h("div", { class: "pl-style-body" },
    nameField,
    h("h3", { class: "pl-sub" }, "Sizes and prices"),
    list,
    addSizeForm(key, entry),
    msgs(`style:${key}`),
    builtSection(key, entry));
}

function addSizeForm(key, entry) {
  const others = [];
  for (let w = WIDTH_MIN; w <= WIDTH_MAX; w++) if (!COMMON_WIDTHS.includes(w)) others.push(w);
  const width = h("select", { "aria-label": "Width in feet", dataset: { field: `newsize:${key}` } },
    h("optgroup", { label: "Common widths" }, COMMON_WIDTHS.map((w) => h("option", { value: String(w) }, `${w} ft wide`))),
    h("optgroup", { label: "Other widths" }, others.map((w) => h("option", { value: String(w) }, `${w} ft wide`))));
  const usual = sortSizes(keysOf(entry.sizes)).map((z) => z.split("x")[0]);
  width.value = String(S.lastWidth[key] || usual[usual.length - 1] || 10);
  const length = h("input", { type: "number", inputmode: "numeric", min: LENGTH_MIN, max: LENGTH_MAX, step: 1, placeholder: "Length", "aria-label": "Length in feet", dataset: { field: `newlength:${key}` } });
  const price = priceInput({ value: null, label: "Price of the new size", placeholder: "Price", onChange: () => { msg.textContent = ""; } });
  const msg = h("p", { class: "pl-add-msg", role: "status" });
  const form = h("form", { class: "pl-add-size", novalidate: true },
    h("p", { class: "pl-add-title" }, "Add a size"),
    h("div", { class: "pl-add-fields" },
      h("span", { class: "pl-add-w" }, width),
      h("span", { class: "pl-times", "aria-hidden": "true" }, "×"),
      h("span", { class: "pl-add-l" }, length, h("span", { class: "pl-unit", "aria-hidden": "true" }, "ft")),
      h("span", { class: "pl-add-p" }, price.wrap),
      button("Add size", null, { type: "submit", icon: "plus", kind: "ghost" })),
    msg);
  length.addEventListener("input", () => { msg.textContent = ""; });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const w = Number(width.value), l = Number(length.value);
    const say = (words, el) => { msg.textContent = words; el.focus(); };
    if (!length.value.trim() || !Number.isInteger(l) || l < LENGTH_MIN || l > LENGTH_MAX) return say(`Type the length in whole feet, from ${LENGTH_MIN} to ${LENGTH_MAX}.`, length);
    const z = `${w}x${l}`;
    if (Object.prototype.hasOwnProperty.call(entry.sizes, z)) return say(`${size(z)} is already on the list. Change its price above.`, length);
    const v = readPrice(price.input.value);
    if (v == null || v <= 0) return say(`Type the price of the ${size(z)}.`, price.input);
    if (v > PRICE_CAP) return say("That's more than $1,000,000. Check the price.", price.input);
    entry.sizes[z] = v;
    S.lastWidth[key] = w;
    S.justAdded = `${key}:${z}`;
    edited();
    redrawStyle(key, `newlength:${key}`);
    toast(`Added ${size(z)} at ${money(v)}.`);
  });
  return form;
}

function removeSize(key, z) {
  const entry = S.draft.offer[key];
  if (keysOf(entry.sizes).length <= 1) {
    const name = nameOf(key);
    confirmBox(`Stop selling the ${name}?`,
      `${size(z)} is its only size. Removing it stops selling the ${name} on every lot when you save. Its size stays here until then, in case you change your mind.`,
      { yes: "Stop selling it", danger: true }).then((ok) => { if (ok) setSold(key, false); });
    return;
  }
  delete entry.sizes[z];
  edited();
  redrawStyle(key);
}

/* Stopping a building keeps its draft sizes until Save. Selling it
   again brings them back. */
export function setSold(key, on) {
  const d = S.draft;
  if (on && S.parked.offer[key]) {
    const order = [...keysOf(S.saved.settings.offer), ...keysOf(d.offer), key];
    const next = {};
    const all = { ...d.offer, [key]: S.parked.offer[key] };
    for (const k of order) if (all[k] && !(k in next)) next[k] = all[k];
    for (const k of Object.keys(d.offer)) if (!(k in next)) next[k] = d.offer[k];
    d.offer = next;
    delete S.parked.offer[key];
  } else if (!on && d.offer[key]) {
    S.parked.offer[key] = d.offer[key];
    delete d.offer[key];
  }
  edited({ tab: true });
  if (!on && S.sub.page === "building") S.ctx.go("/price-list");
}

