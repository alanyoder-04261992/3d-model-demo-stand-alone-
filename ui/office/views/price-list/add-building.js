/* THE STANDARD BUILDING GALLERY. Each tile says whether it is already on
   the draft, or stopped and waiting for Save. */
import { h, button, dialog, nextId, toast } from "../../dom.js";
import { plural } from "../../words.js";
import { S, edited, focusLater } from "./state.js";
import { keysOf, sortSizes, styleName, newStyleKey, nameKey, NAME_MAX } from "./model.js";
import { catOf } from "./built.js";
import { picture } from "./pictures.js";
import { setSold } from "./building-page.js";

async function loadExample() {
  if (S.example !== undefined) return S.example;
  try {
    const r = await fetch("/companies/demo/company.json", { credentials: "same-origin" });
    S.example = r.ok ? await r.json() : null;
  } catch { S.example = null; }
  return S.example;
}
const exampleSizes = (key) => sortSizes(keysOf(S.example?.offer?.[key]?.sizes));

function libraryGroups(keys) {
  const groups = [];
  for (const k of keys) {
    const name = S.M.styles[k].category || "Buildings";
    let group = groups.find((x) => x[0] === name);
    if (!group) groups.push(group = [name, []]);
    group[1].push(k);
  }
  return groups;
}

export async function addBuildingPage() {
  await loadExample();
  const d = S.draft;
  const keys = Object.keys(S.M.styles).filter((k) => !k.startsWith("_"));
  const augmented = structuredClone(d);
  for (const k of keys) if (!augmented.offer[k]) augmented.offer[k] = structuredClone(S.parked.offer[k] || S.example?.offer?.[k] || { sizes: { "10x20": 1 } });
  /* Unsold styles need their normal standard layout, without changing
     the actual draft. catOf softens unfinished prices for these pictures. */
  const cat = catOf(augmented);
  return h("div", { class: "pl-tab stack pl-gallery" },
    button("Your buildings", () => S.ctx.go("/price-list"), { kind: "link", icon: "arrowLeft" }),
    h("div", {}, h("h2", { class: "pl-page-title" }, "Add a building"),
      h("p", { class: "muted" }, `Pick one of the ${keys.length} standard buildings. Add it as it is, or make your own from it with its own name, sizes and prices.`)),
    libraryGroups(keys).map(([label, list]) => h("section", { class: "pl-building-group" },
      h("h3", { class: "pl-group-title" }, label),
      h("div", { class: "pl-building-cards" }, list.map((key) => galleryCard(key, cat))))));
}

function galleryCard(key, cat) {
  const name = S.M.styles[key].name;
  const sold = key in S.draft.offer, parked = key in S.parked.offer;
  const n = exampleSizes(key).length;
  return h("article", { class: "pl-card pl-gallery-card", dataset: { style: key } },
    picture(key, { cat, M: S.M, base: key, name }),
    h("div", { class: "pl-card-info" }, h("h4", { class: "pl-card-name" }, name),
      h("p", { class: "pl-card-meta" }, n ? plural(n, "standard size") : "Add your sizes and prices"),
      sold ? h("p", { class: "pl-card-status good" }, "You sell this") : parked ? h("p", { class: "pl-card-status" }, "Stopped, not saved yet") : null),
    h("div", { class: "pl-gallery-actions" },
      sold ? button("Edit yours", () => S.ctx.go(`/price-list/building/${key}`), { icon: "edit" })
        : parked ? button("Sell it again", () => { setSold(key, true); S.ctx.go(`/price-list/building/${key}`); }, { kind: "primary", icon: "undo" })
        : button("Add it", () => addIt(key), { kind: "primary", icon: "plus" }),
      button("Make my own from it", () => makeOwn(key))));
}

function finish(key, words) {
  edited();
  const sizes = sortSizes(keysOf(S.draft.offer[key].sizes));
  const first = sizes.find((z) => S.draft.offer[key].sizes[z] == null);
  focusLater({ tab: "buildings", style: key, field: first ? `size:${key}:${first}` : `name:${key}` });
  S.ctx.go(`/price-list/building/${key}`);
  toast(words, { ms: 6000 });
}

function addIt(key) {
  const sizes = exampleSizes(key);
  S.draft.offer[key] = { sizes: Object.fromEntries(sizes.map((z) => [z, null])) };
  finish(key, sizes.length ? `The ${S.M.styles[key].name} is on your list. Type a price for each size, then save.` : `The ${S.M.styles[key].name} is on your list. Add its sizes and prices, then save.`);
}

function makeOwn(base) {
  const d = S.draft, sold = d.offer[base];
  const nameId = nextId("pl"), name = h("input", { id: nameId, type: "text", maxlength: NAME_MAX, autocomplete: "off", placeholder: `Like Premium ${S.M.styles[base].name}` });
  const copy = h("input", { type: "checkbox", checked: true });
  const status = h("p", { class: "form-status error", role: "status" });
  const add = button("Add my building", () => {
    status.textContent = "";
    const value = name.value.trim().replace(/\s+/g, " ");
    if (!value) { status.textContent = "Type the name customers will see."; name.focus(); return; }
    const all = { ...S.parked.offer, ...d.offer };
    const clash = keysOf(all).find((k) => nameKey(styleName(S.M, k, all[k])) === nameKey(value));
    if (clash) { status.textContent = `You already have a building called ${styleName(S.M, clash, all[clash])}. Pick another name.`; name.focus(); return; }
    const key = newStyleKey(base, new Set([...keysOf(all), ...keysOf(S.M.styles)]), S.M);
    if (!key) { status.textContent = "There are too many buildings built like this one. Remove one first."; return; }
    const sizes = sold && copy.checked ? structuredClone(sold.sizes) : Object.fromEntries((sold ? sortSizes(keysOf(sold.sizes)) : exampleSizes(base)).map((z) => [z, null]));
    d.offer[key] = { base, name: value, sizes };
    box.close();
    finish(key, sold && copy.checked ? `${value} is on your list with the ${styleName(S.M, base, sold)}'s prices. Change them, then save.` : `${value} is on your list. Type a price for each size, then save.`);
  }, { kind: "primary", icon: "plus" });
  const box = dialog(`Make my own from the ${S.M.styles[base].name}`, [
    h("p", { class: "muted" }, `Built like the ${S.M.styles[base].name}, with its own name, sizes and prices. You can change how it is built on its Edit page.`),
    h("div", { class: "field" }, h("label", { htmlFor: nameId }, "Name customers see"), name),
    sold ? h("label", { class: "check" }, copy, h("span", {}, `Start with the ${styleName(S.M, base, sold)}'s sizes and prices`)) : null,
    status, h("div", { class: "actions end" }, button("Cancel", () => box.close()), add),
  ]);
  box.el.classList.add("pl-own-building-dialog");
}
