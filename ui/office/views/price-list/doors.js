/* PRICE LIST, DOORS & WINDOWS TAB: every door, window, light and fixture
   the builder makes, grouped the way a shed is talked about. The owner sets
   each one's price, the name customers see, and whether it is sold. One
   that comes standard on a building the business sells (or that an option
   puts in) is always sold: it shows why, and $0 is fine. */

import { h, icon } from "../../dom.js";
import { money } from "../../words.js";
import { S, edited, repaint } from "./state.js";
import { keysOf, priceOf, ownName, styleName } from "./model.js";
import { priceInput, sellBox, renameable, msgs } from "./bits.js";

export const ITEM_GROUPS = [
  ["Wood doors", ["w36", "w48", "w72"], "Shop doors built from the building's own siding."],
  ["Steel and glass doors", ["d36in", "d36lite", "dfr"], null],
  ["Roll-up doors", ["ru6", "ru8"], null],
  ["Windows", ["w23", "w33", "tr"], null],
  ["Gable windows", ["fake", "g1824", "oct"], "High in the end walls, under the roof."],
  ["Inside the building", ["bench", "shelf", "outlet", "gfci", "ilight"], "Benches and shelves are priced by the foot."],
  ["Outside", ["light", "ppost"], null],
];

export function doorsTab() {
  const all = Object.keys(S.M.items || {}).filter((k) => !k.startsWith("_"));
  const listed = new Set(ITEM_GROUPS.flatMap((g) => g[1]));
  const groups = ITEM_GROUPS.map(([label, ids, sub]) => [label, ids.filter((id) => all.includes(id)), sub]);
  const rest = all.filter((id) => !listed.has(id));
  if (rest.length) groups.push(["More", rest, null]);
  if (!S.draft) return sheet(groups);
  return h("div", { class: "pl-tab stack" },
    h("p", { class: "pl-intro" }, "Each price is what a customer pays to add one. Doors and windows that come with a building you sell are in its price, so they're always on here."),
    h("div", { class: "pl-cards" }, groups.filter((g) => g[1].length).map(([label, ids, sub]) => h("section", { class: "card pl-list-card" },
      h("h2", { class: "card-title" }, label),
      sub ? h("p", { class: "pl-card-sub" }, sub) : null,
      h("div", { class: "pl-rows" }, ids.map(itemRow))))));
}

function listWords(names, max = 2) {
  if (names.length <= max + 1) return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  return `${names.slice(0, max).join(", ")} and ${names.length - max} more`;
}

export function lockWords(lock) {
  const names = (lock.styles || []).map((k) => styleName(S.M, k, S.draft?.offer[k] || S.saved.settings.offer?.[k]));
  const why = [];
  if (names.length) why.push(`Comes with the ${listWords(names)}.`);
  if (lock.elec) why.push("Your electrical packages put it in.");
  if (lock.ext) why.push("Your exterior light option puts it up.");
  return { words: `${why.join(" ")} Customers pay this for each one they add. $0 is fine.`, all: names.join(", ") };
}

function itemRow(id) {
  const d = S.draft;
  const lib = S.M.items[id];
  const sold = Object.prototype.hasOwnProperty.call(d.items, id);
  const value = sold ? d.items[id] : S.parked.items[id];
  const lock = S.locks[id];
  const libName = lib.name;
  const suffix = lib.perFt ? "a foot" : null;
  const row = h("div", { class: ["pl-row", !sold && !lock && "off"], dataset: { item: id } });
  const draw = () => {
    const isSold = Object.prototype.hasOwnProperty.call(d.items, id);
    const v = isSold ? d.items[id] : S.parked.items[id];
    const price = priceInput({
      value: priceOf(v), label: `Price of the ${ownName(v) || libName}`, field: `item:${id}`, suffix,
      disabled: !isSold && !lock,
      onChange: (p) => {
        const name = ownName(d.items[id] ?? S.parked.items[id]);
        d.items[id] = name ? { price: p, name } : p;
        delete S.parked.items[id];
        edited();
      },
    });
    const name = renameable({
      name: ownName(v), libraryName: libName, label: `Name customers see for the ${libName}`, field: `item:${id}:name`,
      canEdit: isSold || !!lock,
      onChange: (n) => {
        const p = priceOf(d.items[id] ?? S.parked.items[id]) ?? null;
        d.items[id] = n ? { price: p, name: n } : p;
        edited();
      },
    });
    let control;
    if (lock) {
      const { words, all } = lockWords(lock);
      control = h("span", { class: "pl-std", title: all ? `Comes with: ${all}` : null }, icon("check"), h("span", {}, "Always sold"));
      name.append(h("p", { class: "pl-lock-words", title: all ? `Comes with: ${all}` : null }, words));
    } else {
      control = sellBox(isSold, (on) => {
        if (on) {
          d.items[id] = Object.prototype.hasOwnProperty.call(S.parked.items, id) ? S.parked.items[id] : null;
          delete S.parked.items[id];
        } else {
          S.parked.items[id] = d.items[id];
          delete d.items[id];
        }
        edited();
        draw();
        if (on && priceOf(d.items[id]) == null) row.querySelector(`[data-field="item:${id}"]`)?.focus();
      }, `Sell the ${ownName(v) || libName}`);
    }
    row.className = ["pl-row", !isSold && !lock && "off"].filter(Boolean).join(" ");
    row.replaceChildren(
      h("div", { class: "pl-row-main" }, name),
      h("div", { class: "pl-row-side" }, control, price.wrap),
      msgs(`item:${id}`));
    repaint();
  };
  draw();
  return row;
}

/* ---- read only ---------------------------------------------------------- */

function sheet(groups) {
  const items = S.saved.settings.items || {};
  const cards = groups.map(([label, ids]) => {
    const sold = ids.filter((id) => Object.prototype.hasOwnProperty.call(items, id));
    if (!sold.length) return null;
    return h("section", { class: "card pl-list-card" },
      h("h2", { class: "card-title" }, label),
      h("ul", { class: "pl-sheet-rows wide" }, sold.map((id) => {
        const v = items[id];
        return h("li", {}, h("span", { class: "pl-sheet-size" }, ownName(v) || S.M.items[id].name), h("span", { class: "pl-sheet-dots", "aria-hidden": "true" }),
          h("span", { class: "pl-sheet-price" }, money(priceOf(v)) + (S.M.items[id].perFt ? " a foot" : "")));
      })));
  }).filter(Boolean);
  return h("div", { class: "pl-tab stack" },
    h("p", { class: "pl-intro" }, "The price of one of each. Doors and windows that come with a building are already in the building's price."),
    keysOf(items).length ? h("div", { class: "pl-cards" }, cards) : h("p", { class: "pl-intro" }, "No doors or windows are on the price list yet."));
}
