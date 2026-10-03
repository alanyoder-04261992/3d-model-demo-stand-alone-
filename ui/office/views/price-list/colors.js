/* PRICE LIST, COLORS TAB: which siding, trim and roof colors customers can
   pick on the 3D designer. Every builder color is a swatch the owner
   switches on or off; the business can add colors of its own (a name and
   a color). Each group keeps at least one color. The colors the 3D designer
   opens on are picked here too, from the colors that are on. */

import { h, icon, button, toast } from "../../dom.js";
import { S, edited } from "./state.js";
import { isObj, paletteList, setPalette, COLOR_GROUPS, openingStyle, baseOf, nameKey } from "./model.js";
import { msgs } from "./bits.js";

const WORD = { paint: "siding", trim: "trim", metal: "roof" };

export function colorsTab() {
  if (!S.draft) return sheet();
  return h("div", { class: "pl-tab stack" },
    h("p", { class: "pl-intro" }, "Tap a color to switch it on or off for customers. Colors that are on show in the 3D designer on every lot."),
    opensOnCard(),
    COLOR_GROUPS.map(([g, title, sub]) => groupCard(g, title, sub)));
}

function swatch(hex) {
  const el = h("span", { class: "pl-swatch", "aria-hidden": "true" });
  el.style.backgroundColor = hex;
  return el;
}

function groupCard(g, title, sub) {
  const d = S.draft;
  const lib = S.M.palettes?.[g] || [];
  const list = paletteList(d, S.M, g);
  const on = new Set(list.map((c) => c[0]));
  const own = list.filter((c) => c[2]);
  const write = (next) => { setPalette(d, S.saved.settings, S.M, g, next); edited({ tab: true }); };
  const ordered = (onNames) => [
    ...lib.filter((c) => onNames.has(c[0])).map((c) => [c[0], c[1], false]),
    ...paletteList(d, S.M, g).filter((c) => c[2] && onNames.has(c[0])),
  ];
  const toggle = (name, button) => {
    const names = new Set(paletteList(d, S.M, g).map((c) => c[0]));
    if (names.has(name)) {
      if (names.size <= 1) {
        toast(`Keep at least one ${WORD[g]} color on. Customers need one to pick.`, { error: true });
        button.setAttribute("aria-pressed", "true");
        return;
      }
      names.delete(name);
    } else names.add(name);
    write(ordered(names));
  };
  const chips = h("div", { class: "pl-colors", role: "group", "aria-label": `${title} colors` },
    lib.map(([name, hex]) => {
      const b = h("button", { type: "button", class: "pl-color", "aria-pressed": String(on.has(name)), title: on.has(name) ? `${name}: on. Tap to switch off.` : `${name}: off. Tap to switch on.` },
        swatch(hex), h("span", { class: "pl-color-name" }, name), icon("check", "pl-color-check"));
      b.addEventListener("click", () => toggle(name, b));
      return b;
    }),
    own.map(([name, hex]) => {
      const rm = h("button", { type: "button", class: "pl-color-x", "aria-label": `Remove ${name}`, title: `Remove ${name}` }, icon("x"));
      rm.addEventListener("click", () => {
        const names = new Set(paletteList(d, S.M, g).map((c) => c[0]));
        if (names.size <= 1) { toast(`Keep at least one ${WORD[g]} color on. Customers need one to pick.`, { error: true }); return; }
        names.delete(name);
        write(ordered(names));
      });
      return h("span", { class: "pl-color pl-color-own", "aria-pressed": "true" }, swatch(hex), h("span", { class: "pl-color-name" }, name), h("span", { class: "pl-own" }, "Yours"), rm);
    }));

  /* add a color of the business's own */
  const nameId = `pl-c-${g}-name`, hexId = `pl-c-${g}-hex`;
  const nameBox = h("input", { id: nameId, type: "text", maxlength: 40, autocomplete: "off", placeholder: "Like Sage" });
  const hexBox = h("input", { id: hexId, type: "color", value: "#7a8b6f", class: "pl-hex" });
  const status = h("p", { class: "form-status error", role: "status" });
  const form = h("form", { class: "pl-add-color", novalidate: true },
    h("div", { class: "field" }, h("label", { htmlFor: nameId }, "Color name"), nameBox),
    h("div", { class: "field" }, h("label", { htmlFor: hexId }, "Color"), hexBox),
    button("Add color", null, { type: "submit", icon: "plus" }),
    status);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameBox.value.trim().replace(/\s+/g, " ");
    const hex = String(hexBox.value || "").toLowerCase();
    if (!name) { status.textContent = "Type a name for the color."; nameBox.focus(); return; }
    if (!/^#[0-9a-f]{6}$/.test(hex)) { status.textContent = "Pick the color."; hexBox.focus(); return; }
    const libHit = lib.find((c) => nameKey(c[0]) === nameKey(name));
    if (libHit) { status.textContent = on.has(libHit[0]) ? `${libHit[0]} is already on.` : `${libHit[0]} is one of the builder's colors. Tap it above to switch it on.`; return; }
    if (list.some((c) => nameKey(c[0]) === nameKey(name))) { status.textContent = `You already have a color called ${name}.`; return; }
    write([...paletteList(d, S.M, g), [name, hex, true]]);
    toast(`Added ${name} to the ${WORD[g]} colors.`);
  });

  return h("section", { class: "card pl-list-card", dataset: { colors: g } },
    h("div", { class: "pl-card-head" },
      h("div", {}, h("h2", { class: "card-title" }, title), h("p", { class: "pl-card-sub" }, sub)),
      h("span", { class: "pl-count" }, `${list.length} of ${lib.length + own.length} on`)),
    msgs(`colors:${g}`),
    chips,
    h("details", { class: "pl-add-details" }, h("summary", {}, icon("plus"), h("span", {}, `Add your own ${WORD[g]} color`)), form));
}

/* The colors a customer sees first. */
function opensOnCard() {
  const d = S.draft;
  const st = openingStyle(d);
  if (!st) return null;
  const metal = !!S.M.styles[baseOf(st, d.offer[st])]?.metal;
  const D = isObj(d.defaults) ? d.defaults : {};
  const C = isObj(D.colors) ? D.colors : {};
  const fields = [
    ["body", metal ? "metal" : "paint", metal ? "Walls" : "Siding", ["white"]],
    ["trim", "trim", "Trim", ["black", "charcoal"]],
    ["roof", "metal", "Roof", ["black", "charcoal"]],
  ];
  const pick = (names, wanted) => { for (const w of wanted) { const hit = names.find((n) => n.toLowerCase().includes(w)); if (hit) return hit; } return names[0]; };
  const current = {};
  const selects = fields.map(([f, g, label, wanted]) => {
    const list = paletteList(d, S.M, g);
    const names = list.map((c) => c[0]);
    current[f] = C[f] && names.includes(C[f]) ? C[f] : pick(names, wanted);
    const id = `pl-open-${f}`;
    const sel = h("select", { id }, list.map(([n]) => h("option", { value: n }, n)));
    sel.value = current[f];
    const dot = swatch(list.find((c) => c[0] === current[f])?.[1] || "#ccc");
    sel.addEventListener("change", () => {
      d.defaults = { ...(isObj(d.defaults) ? d.defaults : {}), colors: { ...current, [f]: sel.value } };
      current[f] = sel.value;
      dot.style.backgroundColor = list.find((c) => c[0] === sel.value)?.[1] || "#ccc";
      edited();
    });
    return h("div", { class: "field" }, h("label", { htmlFor: id }, label), h("span", { class: "pl-select-swatch" }, dot, sel));
  });
  return h("section", { class: "card pl-opens" },
    h("h2", { class: "card-title" }, "The 3D designer opens on"),
    h("p", { class: "pl-card-sub" }, "The colors a customer sees first. Pick from the colors that are on."),
    h("div", { class: "pl-opens-fields three" }, selects));
}

/* ---- read only ------------------------------------------------------------------ */

function sheet() {
  const s = S.saved.settings;
  return h("div", { class: "pl-tab stack" },
    h("p", { class: "pl-intro" }, "The colors customers can pick on the 3D designer."),
    COLOR_GROUPS.map(([g, title, sub]) => h("section", { class: "card pl-list-card" },
      h("h2", { class: "card-title" }, title), h("p", { class: "pl-card-sub" }, sub),
      h("div", { class: "pl-colors" }, paletteList(s, S.M, g).map(([name, hex]) => h("span", { class: "pl-color static" }, swatch(hex), h("span", { class: "pl-color-name" }, name)))))));
}
