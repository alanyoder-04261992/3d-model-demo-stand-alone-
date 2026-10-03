/* PRICE LIST, BUILDINGS TAB: every building style the business sells, in
   the groups the 3D designer shows, with its sizes and prices.

   The owner: rename a style, switch it Sold / Not sold, change, add and
   remove sizes, "Change prices" for many at once (with a preview), "Add a
   building style" (one from the builder's library, or the business's own
   built like one of them), and pick the building the 3D designer opens on.
   Everyone else: a clean price sheet with a search box. */

import { h, clear, button, icon, dialog, confirmBox, toast, nextId } from "../../dom.js";
import { money, size, plural } from "../../words.js";
import { S, edited, repaint, focusLater } from "./state.js";
import {
  keysOf, isObj, sortSizes, fromPrice, missingPrices, styleName, displayGroups, groupsOf, newStyleKey,
  nameKey, baseOf, openingStyle, readPrice, libraryCategory,
  WIDTH_MIN, WIDTH_MAX, LENGTH_MIN, LENGTH_MAX, COMMON_WIDTHS, PRICE_CAP, NAME_MAX,
} from "./model.js";
import { priceInput, switchInput, msgs } from "./bits.js";

export function buildingsTab() {
  return S.draft ? ownerView() : priceSheet();
}

const nameOf = (key) => styleName(S.M, key, S.draft?.offer[key] || S.parked.offer[key] || S.saved.settings.offer?.[key]);

/* ---- the owner's view ------------------------------------------------------- */

function ownerView() {
  const d = S.draft;
  const groups = displayGroups(d, S.saved.settings, S.M, S.parked.offer);
  const sold = keysOf(d.offer);
  const sizeCount = sold.reduce((n, k) => n + keysOf(d.offer[k].sizes).length, 0);
  return h("div", { class: "pl-tab stack" },
    h("div", { class: "pl-toolbar" },
      h("p", { class: "pl-toolbar-words" }, h("strong", {}, plural(sold.length, "building style")), ` sold in ${plural(sizeCount, "size")}. Tap a building to change its sizes and prices.`),
      h("div", { class: "actions" },
        button("Change prices", openChangePrices, { icon: "dollar" }),
        button("Add a building style", openAddStyle, { kind: "primary", icon: "plus" }))),
    msgs("buildings"),
    groups.map(([label, keys]) => groupCard(label, keys)),
    opensOnCard());
}

function groupCard(label, keys) {
  const open = !S.closedGroups.has(label);
  const soldHere = keys.filter((k) => k in S.draft.offer).length;
  const body = h("div", { class: "pl-group-body" }, keys.map(styleBlock));
  body.hidden = !open;
  const head = h("button", { type: "button", class: "pl-group-head", "aria-expanded": String(open) },
    h("span", { class: "pl-group-title" }, label),
    h("span", { class: "pl-group-count" }, soldHere === keys.length ? plural(keys.length, "style") : `${soldHere} of ${keys.length} sold`),
    icon("chevronDown", "pl-chev"));
  head.addEventListener("click", () => {
    const opening = body.hidden;
    body.hidden = !opening;
    head.setAttribute("aria-expanded", String(opening));
    if (opening) S.closedGroups.delete(label); else S.closedGroups.add(label);
  });
  return h("section", { class: "card pl-group", dataset: { group: label } }, head, body);
}

function metaParts(entry, sold, own) {
  if (!sold) return [h("span", {}, own ? "Not sold. It goes away when you save." : "Not sold. Switch it on to sell it again.")];
  const n = keysOf(entry.sizes).length;
  const from = fromPrice(entry.sizes);
  const miss = missingPrices(entry.sizes);
  return [
    h("span", {}, plural(n, "size")),
    from != null ? h("span", {}, `from ${money(from)}`) : null,
    miss ? h("span", { class: "pl-miss" }, `${miss} missing a price`) : null,
  ];
}

function styleBlock(key) {
  const d = S.draft;
  const sold = key in d.offer;
  const entry = sold ? d.offer[key] : S.parked.offer[key];
  const lib = S.M.styles[baseOf(key, entry)] || {};
  const own = !!entry.base;
  const open = sold && S.openStyles.has(key);
  const nameEl = h("span", { class: "pl-style-name" }, styleName(S.M, key, entry));
  const meta = h("span", { class: "pl-style-meta" }, metaParts(entry, sold, own));
  const toggle = h("button", { type: "button", class: "pl-style-open", "aria-expanded": String(open), disabled: !sold },
    icon("chevronDown", "pl-chev"),
    h("span", { class: "pl-style-words" },
      h("span", { class: "pl-style-line" }, nameEl, own ? h("span", { class: "pl-own" }, "Your own") : null),
      meta),
    h("span", { class: "pl-flag-dot", title: "Something to fix" }));
  const sw = switchInput(sold, (on) => setSold(key, on), { label: `Sell the ${styleName(S.M, key, entry)}` });
  const block = h("div", { class: ["pl-style", !sold && "off", open && "open"], dataset: { flag: `style:${key}`, style: key } },
    h("div", { class: "pl-style-head" }, toggle, sw));
  if (open) block.append(styleEditor(key, entry, lib, { nameEl, meta, own }));
  toggle.addEventListener("click", () => {
    if (S.openStyles.has(key)) S.openStyles.delete(key); else S.openStyles.add(key);
    redrawStyle(key);
  });
  return block;
}

function redrawStyle(key, focusField) {
  const old = document.querySelector(`.pl-style[data-style="${CSS.escape(key)}"]`);
  if (old) old.replaceWith(styleBlock(key));
  repaint();
  if (focusField) document.querySelector(`[data-field="${CSS.escape(focusField)}"]`)?.focus();
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
    ? `Built like the ${lib.name}: it looks and is built exactly like it, with its own name, sizes and prices.`
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
    msgs(`style:${key}`));
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

/* Sold / Not sold. A style switched off keeps its sizes here until the
   owner saves, so switching it back on brings them back. */
function setSold(key, on) {
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
    S.openStyles.delete(key);
  }
  edited({ tab: true });
}

/* ---- which building the 3D designer opens on ---------------------------------- */

function opensOnCard() {
  const d = S.draft;
  const offered = keysOf(d.offer);
  if (!offered.length) return null;
  const st = openingStyle(d);
  const D = isObj(d.defaults) ? d.defaults : {};
  const sizesInOrder = keysOf(d.offer[st].sizes);
  const current = D.size && sizesInOrder.includes(D.size) ? D.size : sizesInOrder[Math.min(4, sizesInOrder.length - 1)];
  const styleId = nextId("pl"), sizeId = nextId("pl");
  const styleSel = h("select", { id: styleId },
    groupsOf(d, S.M).map(([label, ks]) => h("optgroup", { label }, ks.map((k) => h("option", { value: k }, styleName(S.M, k, d.offer[k]))))));
  styleSel.value = st;
  const sizeSel = h("select", { id: sizeId }, sortSizes(sizesInOrder).map((z) => h("option", { value: z }, size(z))));
  if (current) sizeSel.value = current;
  const set = (style, z) => {
    d.defaults = { ...(isObj(d.defaults) ? d.defaults : {}), style };
    const sizes = sortSizes(keysOf(d.offer[style].sizes));
    d.defaults.size = sizes.includes(z) ? z : sizes[Math.min(Math.floor(sizes.length / 2), sizes.length - 1)];
    edited();
    card.replaceWith(opensOnCard());
  };
  styleSel.addEventListener("change", () => set(styleSel.value, sizeSel.value));
  sizeSel.addEventListener("change", () => set(styleSel.value, sizeSel.value));
  const card = h("section", { class: "card pl-opens" },
    h("h2", { class: "card-title" }, "The 3D designer opens on"),
    h("p", { class: "pl-card-sub" }, "The building a customer sees first on every lot's 3D designer."),
    h("div", { class: "pl-opens-fields" },
      h("div", { class: "field" }, h("label", { htmlFor: styleId }, "Building"), styleSel),
      h("div", { class: "field" }, h("label", { htmlFor: sizeId }, "Size"), sizeSel)));
  return card;
}

/* ---- Change prices: many at once, with a preview -------------------------------- */

function segmented(name, items, value) {
  const el = h("div", { class: "pl-seg", role: "radiogroup" });
  for (const [v, label] of items) {
    el.append(h("label", { class: "pl-seg-item" },
      h("input", { type: "radio", name, value: v, checked: v === value }), h("span", {}, label)));
  }
  return el;
}
const segValue = (el) => el.querySelector("input:checked")?.value;

function openChangePrices() {
  const d = S.draft;
  const groups = groupsOf(d, S.M);
  const nStyles = keysOf(d.offer).length;
  const ids = { scope: nextId("pl"), amount: nextId("pl"), round: nextId("pl") };
  const scope = h("select", { id: ids.scope },
    h("option", { value: "all" }, `Every building (${plural(nStyles, "style")})`),
    groups.map(([label, ks]) => h("optgroup", { label },
      ks.length > 1 ? h("option", { value: `group:${label}` }, `All ${label} (${plural(ks.length, "style")})`) : null,
      ks.map((k) => h("option", { value: `style:${k}` }, styleName(S.M, k, d.offer[k]))))));
  const dir = segmented("pl-dir", [["up", "Raise"], ["down", "Lower"]], "up");
  const unit = segmented("pl-unit", [["pct", "By percent"], ["usd", "By dollars"]], "pct");
  const amount = h("input", { id: ids.amount, type: "number", inputmode: "decimal", min: 0, step: "any", value: "5" });
  const amountSign = h("span", { class: "pl-amount-sign", "aria-hidden": "true" });
  const round = h("select", { id: ids.round }, [1, 5, 10, 25].map((r) => h("option", { value: String(r) }, `The nearest ${money(r)}`)));
  round.value = "5";
  const preview = h("div", { class: "pl-preview", "aria-live": "polite" });
  let list = [];
  const apply = button("Apply to my changes", () => {
    if (!list.length) return;
    for (const c of list) d.offer[c.key].sizes[c.z] = c.next;
    box.close();
    toast(`${plural(list.length, "price")} changed. Press Save to send them to every lot.`, { ms: 5000 });
    edited({ tab: true });
  }, { kind: "primary" });

  const keysIn = (v) => {
    if (v === "all") return keysOf(d.offer);
    if (v.startsWith("group:")) return groups.find((g) => g[0] === v.slice(6))?.[1] || [];
    return [v.slice(6)];
  };
  function compute() {
    const amt = Number(amount.value);
    const pct = segValue(unit) === "pct";
    amountSign.textContent = pct ? "%" : "$";
    amountSign.parentElement?.classList.toggle("pct", pct);
    const out = [];
    if (!amount.value.trim() || !Number.isFinite(amt) || amt < 0) return { out, bad: "Type how much to change the prices." };
    if (pct && amt >= 100 && segValue(dir) === "down") return { out, bad: "Lowering by 100% or more would make the buildings free. Type a smaller percent." };
    const sign = segValue(dir) === "down" ? -1 : 1;
    const r = Number(round.value);
    let low = Infinity, high = 0, held = 0;
    for (const key of keysIn(scope.value)) {
      const sizes = d.offer[key]?.sizes || {};
      for (const z of sortSizes(keysOf(sizes))) {
        const old = sizes[z];
        if (!(typeof old === "number" && old > 0)) continue;
        let next = pct ? old * (1 + (sign * amt) / 100) : old + sign * amt;
        next = Math.round(next / r) * r;
        if (next < r) { next = r; held++; }
        low = Math.min(low, next);
        high = Math.max(high, next);
        if (next !== old) out.push({ key, z, old, next });
      }
    }
    return { out, low, high, held };
  }
  function show() {
    const { out, low, high, held, bad } = compute();
    list = out;
    apply.disabled = !out.length;
    if (bad) return clear(preview, h("p", { class: "pl-preview-none" }, bad));
    if (!out.length) return clear(preview, h("p", { class: "pl-preview-none" }, "No prices change with these numbers."));
    const picks = [...new Set([0, Math.floor(out.length / 3), Math.floor((2 * out.length) / 3), out.length - 1])].map((i) => out[i]);
    const styles = new Set(out.map((c) => c.key)).size;
    clear(preview,
      h("p", { class: "pl-preview-head" }, h("strong", {}, plural(out.length, "price")), ` change, in ${plural(styles, "building style")}.`),
      h("ul", { class: "pl-preview-list" }, picks.map((c) => h("li", {},
        h("span", { class: "pl-preview-what" }, `${styleName(S.M, c.key, d.offer[c.key])} ${size(c.z)}`),
        h("span", { class: "pl-preview-nums" }, h("span", { class: "pl-preview-was" }, money(c.old)), icon("arrowRight"), h("strong", {}, money(c.next)))))),
      h("p", { class: "pl-preview-range" }, `Afterwards the lowest price is ${money(low)} and the highest is ${money(high)}.`),
      held ? h("p", { class: "pl-preview-held" }, `${plural(held, "price")} would drop below ${money(Number(round.value))}, so ${held === 1 ? "it stays" : "they stay"} at ${money(Number(round.value))}.`) : null);
  }
  for (const el of [scope, amount, round]) el.addEventListener("input", show);
  for (const el of [dir, unit]) el.addEventListener("change", show);

  const box = dialog("Change prices", [
    h("p", { class: "muted" }, "Raise or lower many building prices at once. Check the preview, then apply. Nothing reaches your lots until you save."),
    h("div", { class: "field" }, h("label", { htmlFor: ids.scope }, "Which buildings"), scope),
    h("div", { class: "pl-change-row" },
      h("div", { class: "field" }, h("span", { class: "pl-label" }, "Raise or lower"), dir),
      h("div", { class: "field" }, h("span", { class: "pl-label" }, "How"), unit)),
    h("div", { class: "pl-change-row" },
      h("div", { class: "field" }, h("label", { htmlFor: ids.amount }, "How much"), h("span", { class: "pl-amount" }, amount, amountSign)),
      h("div", { class: "field" }, h("label", { htmlFor: ids.round }, "Round each price to"), round)),
    h("h3", { class: "pl-sub" }, "Preview"),
    preview,
    h("div", { class: "actions end" }, button("Cancel", () => box.close()), apply),
  ], { wide: true });
  show();
}

/* ---- Add a building style ------------------------------------------------------ */

async function loadExample() {
  if (S.example !== undefined) return S.example;
  try {
    const r = await fetch("/companies/demo/company.json", { credentials: "same-origin" });
    S.example = r.ok ? await r.json() : null;
  } catch {
    S.example = null;
  }
  return S.example;
}
const exampleSizes = (key) => sortSizes(keysOf(S.example?.offer?.[key]?.sizes));

function libraryGroups(keys) {
  const out = [];
  for (const k of keys) {
    const label = S.M.styles[k].category || "Buildings";
    let g = out.find((x) => x[0] === label);
    if (!g) out.push((g = [label, []]));
    g[1].push(k);
  }
  return out;
}

async function openAddStyle() {
  await loadExample();
  const d = S.draft;
  const taken = new Set([...keysOf(d.offer), ...keysOf(S.parked.offer)]);
  const libraryKeys = Object.keys(S.M.styles).filter((k) => !k.startsWith("_"));
  const available = libraryKeys.filter((k) => !taken.has(k));
  const parkedLib = libraryKeys.filter((k) => k in S.parked.offer);
  let mode = available.length ? "library" : "own";

  const modeSeg = segmented("pl-add-mode", [["library", "From the builder's list"], ["own", "Make your own"]], mode);
  const panel = h("div", { class: "pl-add-panel" });
  const status = h("p", { class: "form-status error", role: "status" });
  const go = button("Add this building", null, { kind: "primary", icon: "plus" });
  const goLabel = go.querySelector("span");
  let pick = null;

  /* one of the builder's styles the business does not sell yet */
  function libraryPanel() {
    if (!available.length) {
      return h("p", { class: "pl-note" }, "You sell every building in the builder's list. Make your own style instead: tap Make your own.");
    }
    pick = pick && available.includes(pick) ? pick : null;
    const sizesNote = h("p", { class: "pl-pick-sizes" });
    const choose = (k) => {
      pick = k;
      const sizes = exampleSizes(k);
      sizesNote.textContent = sizes.length
        ? `Starts with ${plural(sizes.length, "size")} from the example price list: ${sizes.map(size).join(", ")}. You type a price for each, and you can add or remove sizes.`
        : "Add its sizes and prices after you add it.";
      goLabel.textContent = `Add the ${S.M.styles[k].name}`;
      go.disabled = false;
    };
    const groups = libraryGroups(available).map(([label, ks]) => h("fieldset", { class: "pl-pick-group" },
      h("legend", {}, label),
      h("div", { class: "pl-pick-list" }, ks.map((k) => {
        const input = h("input", { type: "radio", name: "pl-pick", value: k, checked: k === pick });
        input.addEventListener("change", () => { status.textContent = ""; choose(k); });
        const n = exampleSizes(k).length;
        return h("label", { class: "pl-pick" }, input, h("span", { class: "pl-pick-words" },
          h("strong", {}, S.M.styles[k].name), h("small", {}, n ? `${plural(n, "example size")}` : "No example sizes")));
      }))));
    if (pick) choose(pick); else { goLabel.textContent = "Add this building"; go.disabled = true; sizesNote.textContent = "Pick a building above."; }
    return h("div", { class: "stack pl-gap-s" },
      parkedLib.length ? h("p", { class: "pl-note" }, `Switched off just now: ${parkedLib.map((k) => S.M.styles[k].name).join(", ")}. Switch ${parkedLib.length === 1 ? "it" : "them"} back on in the list instead.`) : null,
      h("div", { class: "pl-pick-groups" }, groups), sizesNote);
  }

  /* the business's own style, built like one of the builder's */
  const ownIds = { name: nextId("pl"), base: nextId("pl") };
  const ownName = h("input", { id: ownIds.name, type: "text", maxlength: NAME_MAX, autocomplete: "off", placeholder: "Like Premium Lofted Barn" });
  const ownBase = h("select", { id: ownIds.base },
    libraryGroups(libraryKeys).map(([label, ks]) => h("optgroup", { label }, ks.map((k) => h("option", { value: k }, S.M.styles[k].name)))));
  ownBase.value = libraryKeys.includes("LB") ? "LB" : libraryKeys[0];
  const copyPrices = h("input", { type: "checkbox", checked: true });
  const copyLine = h("label", { class: "check" }, copyPrices, h("span", {}));
  const explain = h("p", { class: "pl-note" });
  function ownPanel() {
    const refresh = () => {
      const base = ownBase.value, baseName = S.M.styles[base].name;
      explain.textContent = `It looks and is built exactly like the ${baseName}, but it has its own name, sizes and prices, and sits next to it in the 3D designer.`;
      const sold = d.offer[base];
      copyLine.hidden = !sold;
      copyLine.lastChild.textContent = sold ? `Start with the ${styleName(S.M, base, sold)}'s ${plural(keysOf(sold.sizes).length, "size")} and prices (change them after)` : "";
      goLabel.textContent = ownName.value.trim() ? `Add ${ownName.value.trim()}` : "Add this style";
      go.disabled = false;
    };
    ownBase.addEventListener("change", refresh);
    ownName.addEventListener("input", () => { status.textContent = ""; refresh(); });
    refresh();
    return h("div", { class: "stack pl-gap-s" },
      h("div", { class: "field" }, h("label", { htmlFor: ownIds.name }, "Name customers see"), ownName),
      h("div", { class: "field" }, h("label", { htmlFor: ownIds.base }, "Built like"), ownBase),
      explain, copyLine);
  }

  const drawPanel = () => { status.textContent = ""; clear(panel, mode === "library" ? libraryPanel() : ownPanel()); };
  modeSeg.addEventListener("change", () => { mode = segValue(modeSeg); drawPanel(); });

  go.addEventListener("click", () => {
    status.textContent = "";
    if (mode === "library") {
      if (!pick) { status.textContent = "Pick a building first."; return; }
      const sizes = exampleSizes(pick);
      d.offer[pick] = { sizes: Object.fromEntries(sizes.map((z) => [z, null])) };
      finish(pick, sizes.length
        ? `The ${S.M.styles[pick].name} is on your list. Type a price for each size, then save.`
        : `The ${S.M.styles[pick].name} is on your list. Add its sizes and prices, then save.`);
      return;
    }
    const name = ownName.value.trim().replace(/\s+/g, " ");
    if (!name) { status.textContent = "Type the name customers will see."; ownName.focus(); return; }
    const clash = keysOf(d.offer).find((k) => nameKey(styleName(S.M, k, d.offer[k])) === nameKey(name));
    if (clash) { status.textContent = `You already sell a building called ${styleName(S.M, clash, d.offer[clash])}. Pick another name.`; ownName.focus(); return; }
    const base = ownBase.value;
    const key = newStyleKey(base, new Set([...taken, ...libraryKeys]), S.M);
    if (!key) { status.textContent = "There are too many styles built like this one. Remove one first."; return; }
    let sizes;
    if (d.offer[base] && copyPrices.checked) sizes = structuredClone(d.offer[base].sizes);
    else {
      const list = d.offer[base] ? sortSizes(keysOf(d.offer[base].sizes)) : exampleSizes(base);
      sizes = Object.fromEntries(list.map((z) => [z, null]));
    }
    d.offer[key] = { base, name, sizes };
    finish(key, d.offer[base] && copyPrices.checked
      ? `${name} is on your list with the ${styleName(S.M, base, d.offer[base])}'s prices. Change them, then save.`
      : `${name} is on your list. Type a price for each size, then save.`);
  });

  function finish(key, words) {
    box.close();
    S.openStyles.add(key);
    S.closedGroups.delete(libraryCategory(S.M, key, d.offer[key]));
    edited({ tab: true });
    const first = sortSizes(keysOf(d.offer[key].sizes)).find((z) => d.offer[key].sizes[z] == null);
    focusLater({ tab: "buildings", style: key, field: first ? `size:${key}:${first}` : `name:${key}` });
    toast(words, { ms: 6000 });
  }

  const box = dialog("Add a building style", [
    modeSeg, panel, status,
    h("div", { class: "actions end" }, button("Cancel", () => box.close()), go),
  ], { wide: true });
  drawPanel();
}

/* ---- the price sheet (everyone who cannot change prices) ------------------------ */

function priceSheet() {
  const s = S.saved.settings;
  const groups = groupsOf(s, S.M);
  const search = h("input", { type: "search", placeholder: "Find a building or a size, like 12x24", "aria-label": "Find a building or a size", autocomplete: "off" });
  const none = h("p", { class: "pl-sheet-none", hidden: true }, "Nothing on the price list matches that. Try a building name, or a size like 12x24.");
  const cards = [];
  const sections = groups.map(([label, ks]) => {
    const grid = h("div", { class: "pl-sheet-grid" }, ks.map((k) => {
      const entry = s.offer[k];
      const name = styleName(S.M, k, entry);
      const sizes = sortSizes(keysOf(entry.sizes));
      const rows = sizes.map((z) => h("li", { dataset: { size: z } }, h("span", { class: "pl-sheet-size" }, size(z)), h("span", { class: "pl-sheet-dots", "aria-hidden": "true" }), h("span", { class: "pl-sheet-price" }, money(entry.sizes[z]))));
      const card = h("article", { class: "card pl-sheet-card" },
        h("h3", {}, name),
        h("p", { class: "pl-sheet-meta" }, `${plural(sizes.length, "size")} · from ${money(fromPrice(entry.sizes))}`),
        h("ul", { class: "pl-sheet-rows" }, rows));
      cards.push({ card, name: nameKey(name), rows, sizes });
      return card;
    }));
    return h("section", { class: "pl-sheet-group" }, h("h2", { class: "pl-sheet-title" }, label), grid);
  });
  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const m = /(\d{1,2})\s*(?:x|×|by|\*|\s)\s*(\d{1,2})/.exec(q);
    const wanted = m ? `${Number(m[1])}x${Number(m[2])}` : null;
    const words = nameKey(q.replace(/(\d{1,2})\s*(?:x|×|by|\*|\s)\s*(\d{1,2})/, "")).trim();
    let shown = 0;
    for (const c of cards) {
      const nameOk = !words || c.name.includes(words);
      const sizeOk = !wanted || c.sizes.includes(wanted);
      c.card.hidden = !(nameOk && sizeOk);
      for (const li of c.rows) li.classList.toggle("pl-hit", !!wanted && li.dataset.size === wanted);
      if (!c.card.hidden) shown++;
    }
    for (const sec of sections) sec.hidden = ![...sec.querySelectorAll(".pl-sheet-card")].some((c) => !c.hidden);
    none.hidden = shown > 0;
  });
  return h("div", { class: "pl-tab stack" },
    h("div", { class: "pl-sheet-tools search" }, icon("search"), search),
    none, sections);
}
