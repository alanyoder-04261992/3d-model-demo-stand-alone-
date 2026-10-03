/* PRICE LIST, OPTIONS TAB: dormers, ramps, electrical packages, shutters,
   the door window and the exterior light, the upgrades priced by the square
   foot, and the business's own options (options.extras).

   Every builder option can be sold or not, priced and renamed (the name
   customers see on the 3D designer's button and the quote). The business's
   own options have a name, a way of pricing and a price; their key is made
   from the name once, when first saved, and never shown. */

import { h, icon, button, linkButton } from "../../dom.js";
import { money } from "../../words.js";
import { S, edited, repaint, focusLater } from "./state.js";
import { keysOf, priceOf, ownName, styleName, baseOf, optionName, EXTRA_KINDS, NAME_MAX } from "./model.js";
import { priceInput, sellBox, renameable, msgs } from "./bits.js";

const BASIS = { floor: "floor", wall: "walls", roof: "roof" };
const sentence = (s) => (s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : "");

/* Each builder option group: [group, title, sub(settings) -> words, row extras(id) -> {desc, suffix, step}] */
function groupsFor(settings) {
  const M = S.M;
  const dormerStyles = keysOf(settings.offer).filter((k) => M.styles[baseOf(k, settings.offer[k])]?.dormer);
  const dormerNames = dormerStyles.map((k) => styleName(M, k, settings.offer[k]));
  return [
    ["dormers", "Dormers",
      dormerStyles.length ? `Customers pick one of these on the ${dormerNames.join(" and ")}.` : "Only a Dormer Shed has a dormer. These show when you sell one.",
      () => ({})],
    ["ramps", "Ramps", "A wooden ramp up to the biggest door.", (id) => ({ desc: M.options.ramps[id]?.lengthFt === 0 ? "The customer builds it from the kit." : null })],
    ["elec", "Electrical packages",
      "The lights and outlets a package puts in are priced on Doors & windows. The package price covers them, so $0 is fine there.",
      (id) => ({ desc: M.options.elec[id]?.desc || null })],
    ["misc", "Shutters, door window and outside light", null,
      (id) => ({ desc: sentence(M.options.misc[id]?.note), suffix: M.options.misc[id]?.per === "set" ? "a set" : null })],
    ["rates", "Upgrades priced by the square foot", `Charged on the building's size, rounded to the nearest ${money(settings.pricing?.roundTo ?? 5)}.`,
      (id) => ({ desc: `Priced per sq ft of ${BASIS[M.options.rates[id]?.basis] || "floor"}.`, suffix: "a sq ft", step: "0.01" })],
  ];
}

export function optionsTab() {
  const settings = S.draft || S.saved.settings;
  const groups = groupsFor(settings);
  if (!S.draft) return sheet(groups);
  const d = S.draft;
  d.options = d.options || {};
  return h("div", { class: "pl-tab stack" },
    h("p", { class: "pl-intro" }, "Options customers can add in the 3D designer. Switch off the ones you don't sell. Rename any of them to the words your customers know."),
    h("div", { class: "pl-cards" },
      groups.map(([g, title, sub, extra]) => {
        const ids = keysOf(S.M.options?.[g]);
        if (!ids.length) return null;
        return h("section", { class: "card pl-list-card", dataset: { opts: g } },
          h("h2", { class: "card-title" }, title),
          sub ? h("p", { class: "pl-card-sub" }, sub) : null,
          g === "elec" ? h("p", { class: "pl-card-link" }, linkButton("Prices of lights and outlets", "#/price-list/doors", { kind: "link", icon: "arrowRight" })) : null,
          msgs(`opts:${g}`),
          h("div", { class: "pl-rows" }, ids.map((id) => optionRow(g, id, extra(id)))));
      })),
    extrasCard());
}

function optionRow(g, id, { desc, suffix, step }) {
  const d = S.draft;
  const libName = S.M.options[g][id].name;
  const row = h("div", { class: "pl-row" });
  const draw = () => {
    const group = d.options[g] || {};
    const sold = Object.prototype.hasOwnProperty.call(group, id);
    const v = sold ? group[id] : S.parked.options[g]?.[id];
    const shown = ownName(v) || libName;
    const name = renameable({
      name: ownName(v), libraryName: libName, label: `Name customers see for ${libName}`, field: `opt:${g}:${id}:name`, canEdit: sold,
      onChange: (n) => {
        const p = priceOf(d.options[g][id]) ?? null;
        d.options[g][id] = n ? { price: p, name: n } : p;
        edited();
      },
    });
    if (desc) name.append(h("p", { class: "pl-row-desc" }, desc));
    const price = priceInput({
      value: priceOf(v), label: `Price of ${shown}`, field: `opt:${g}:${id}`, suffix, step: step || "any", disabled: !sold,
      onChange: (p) => {
        const n = ownName(d.options[g][id]);
        d.options[g][id] = n ? { price: p, name: n } : p;
        edited();
      },
    });
    const sell = sellBox(sold, (on) => {
      d.options[g] = d.options[g] || {};
      S.parked.options[g] = S.parked.options[g] || {};
      if (on) {
        d.options[g][id] = Object.prototype.hasOwnProperty.call(S.parked.options[g], id) ? S.parked.options[g][id] : null;
        delete S.parked.options[g][id];
      } else {
        S.parked.options[g][id] = d.options[g][id];
        delete d.options[g][id];
      }
      edited();
      draw();
      if (on && priceOf(d.options[g][id]) == null) row.querySelector(`[data-field="opt:${g}:${id}"]`)?.focus();
    }, `Sell ${shown}`);
    row.className = ["pl-row", !sold && "off"].filter(Boolean).join(" ");
    row.replaceChildren(h("div", { class: "pl-row-main" }, name), h("div", { class: "pl-row-side" }, sell, price.wrap), msgs(`opt:${g}:${id}`));
    repaint();
  };
  draw();
  return row;
}

/* ---- the business's own options -------------------------------------------- */

function extrasCard() {
  const d = S.draft;
  if (!Array.isArray(d.options.extras)) d.options.extras = [];
  const list = d.options.extras;
  const add = button("Add an option", () => {
    list.push({ name: "", input: "check", price: null });
    edited({ tab: true });
    focusLater({ tab: "options", field: `extra:${list.length - 1}:name` });
  }, { icon: "plus" });
  return h("section", { class: "card pl-list-card pl-extras" },
    h("div", { class: "pl-card-head" },
      h("div", {}, h("h2", { class: "card-title" }, "Your own options"),
        h("p", { class: "pl-card-sub" }, "Anything else you sell, like a ridge vent or extra anchors. Customers pick these in the 3D designer and they print on the quote.")),
      add),
    list.length
      ? h("div", { class: "pl-rows" }, list.map((x, i) => extraRow(x, i)))
      : h("p", { class: "pl-empty-line" }, "None yet. Tap Add an option to put one on your price list."));
}

function extraRow(x, i) {
  const ids = { name: `pl-x-${i}-name`, kind: `pl-x-${i}-kind`, price: `pl-x-${i}-price` };
  const nameBox = h("input", { id: ids.name, type: "text", maxlength: NAME_MAX, autocomplete: "off", placeholder: "Like Ridge vent", dataset: { field: `extra:${i}:name` } });
  nameBox.value = x.name || "";
  nameBox.addEventListener("input", () => { x.name = nameBox.value.replace(/\s+/g, " ").trimStart(); edited(); });
  nameBox.addEventListener("change", () => { x.name = nameBox.value.trim().replace(/\s+/g, " "); nameBox.value = x.name; edited(); });
  const kind = h("select", { id: ids.kind, dataset: { field: `extra:${i}:input` } }, EXTRA_KINDS.map(([v, label]) => h("option", { value: v }, label)));
  kind.value = EXTRA_KINDS.some((e) => e[0] === x.input) ? x.input : "check";
  const priceSlot = h("div", { class: "field" });
  const drawPrice = () => {
    const pct = x.input === "pct";
    const words = EXTRA_KINDS.find((e) => e[0] === x.input)?.[2];
    const p = priceInput({
      value: x.price, label: `Price of ${x.name || "this option"}`, field: `extra:${i}:price`, unit: pct ? "%" : "$",
      suffix: pct ? null : x.input === "check" ? null : words, max: pct ? 100 : 1000000,
      onChange: (v) => { x.price = v; edited(); },
    });
    p.input.id = ids.price;
    priceSlot.replaceChildren(h("label", { htmlFor: ids.price }, pct ? "Percent" : "Price"), p.wrap);
  };
  kind.addEventListener("change", () => { x.input = kind.value; drawPrice(); edited(); });
  drawPrice();
  const rm = h("button", { type: "button", class: "pl-icon-btn", "aria-label": `Remove ${x.name || "this option"}`, title: "Remove" }, icon("trash"));
  rm.addEventListener("click", () => {
    S.draft.options.extras.splice(i, 1);
    edited({ tab: true });
  });
  return h("div", { class: "pl-extra" },
    h("div", { class: "pl-extra-fields" },
      h("div", { class: "field" }, h("label", { htmlFor: ids.name }, "Name"), nameBox),
      h("div", { class: "field" }, h("label", { htmlFor: ids.kind }, "How it's priced"), kind),
      priceSlot,
      h("div", { class: "pl-extra-rm" }, rm)),
    msgs(`extra:${i}`));
}

/* ---- read only ---------------------------------------------------------------- */

function sheet(groups) {
  const O = S.saved.settings.options || {};
  const cards = groups.map(([g, title, , extra]) => {
    const ids = keysOf(S.M.options?.[g]).filter((id) => Object.prototype.hasOwnProperty.call(O[g] || {}, id));
    if (!ids.length) return null;
    return h("section", { class: "card pl-list-card" },
      h("h2", { class: "card-title" }, title),
      h("ul", { class: "pl-sheet-rows wide" }, ids.map((id) => {
        const v = O[g][id];
        const { desc, suffix } = extra(id);
        return h("li", {},
          h("span", { class: "pl-sheet-size" }, ownName(v) || S.M.options[g][id].name, g === "elec" && desc ? h("small", {}, desc) : null),
          h("span", { class: "pl-sheet-dots", "aria-hidden": "true" }),
          h("span", { class: "pl-sheet-price" }, g === "rates" ? `${money(priceOf(v))} per sq ft of ${BASIS[S.M.options.rates[id]?.basis] || "floor"}` : money(priceOf(v)) + (suffix ? ` ${suffix}` : "")));
      })));
  }).filter(Boolean);
  const extras = Array.isArray(O.extras) ? O.extras : [];
  if (extras.length) {
    cards.push(h("section", { class: "card pl-list-card" },
      h("h2", { class: "card-title" }, "More options"),
      h("ul", { class: "pl-sheet-rows wide" }, extras.map((x) => {
        const kind = EXTRA_KINDS.find((e) => e[0] === x.input);
        const price = x.input === "pct" ? `${x.price}% of the building` : `${money(x.price)}${x.input === "check" ? "" : ` ${kind?.[2] || ""}`}`;
        return h("li", {}, h("span", { class: "pl-sheet-size" }, x.name), h("span", { class: "pl-sheet-dots", "aria-hidden": "true" }), h("span", { class: "pl-sheet-price" }, price));
      }))));
  }
  return h("div", { class: "pl-tab stack" },
    cards.length ? h("div", { class: "pl-cards" }, cards) : h("p", { class: "pl-intro" }, "No options are on the price list yet."));
}
