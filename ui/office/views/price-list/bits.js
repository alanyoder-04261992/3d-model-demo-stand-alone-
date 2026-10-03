/* SMALL PIECES THE PRICE LIST TABS SHARE: a price box, a Sold switch, a
   name that can be renamed, and the place a problem's sentence shows.

   Inputs carry data-field="..." and message boxes data-msgs="..." so the
   screen can turn the right box red and put the sentence next to it
   (views/price-list.js paintProblems). */

import { h, icon } from "../../dom.js";
import { readPrice, NAME_MAX } from "./model.js";

/* A dollar (or percent) box. onChange(number|null) on every keystroke. */
export function priceInput({ value, label, field, onChange, unit = "$", suffix, disabled = false, step = "any", max = 1000000, placeholder }) {
  const attrs = {
    type: "number", inputmode: "decimal", min: 0, max, step, "aria-label": label, disabled,
    class: "pl-price-input", autocomplete: "off", placeholder,
  };
  if (field) attrs.dataset = { field };
  const input = h("input", attrs);
  input.value = value == null ? "" : String(value);
  input.addEventListener("input", () => onChange(readPrice(input.value), input));
  const wrap = h("span", { class: ["pl-price", unit === "%" && "pct", disabled && "off"] },
    unit === "$" ? h("span", { class: "pl-price-sign", "aria-hidden": "true" }, "$") : null,
    input,
    unit === "%" ? h("span", { class: "pl-price-pct", "aria-hidden": "true" }, "%") : null,
    suffix ? h("span", { class: "pl-price-suffix" }, suffix) : null);
  return { wrap, input };
}

/* An on/off switch with its words ("Sold" / "Not sold"). */
export function switchInput(on, onChange, { label, onText = "Sold", offText = "Not sold" } = {}) {
  const input = h("input", { type: "checkbox", role: "switch", checked: on, "aria-label": label });
  const text = h("span", { class: "pl-switch-text" }, on ? onText : offText);
  input.addEventListener("change", () => {
    text.textContent = input.checked ? onText : offText;
    onChange(input.checked, input);
  });
  return h("label", { class: ["pl-switch", on && "on"] }, input, h("span", { class: "pl-switch-track", "aria-hidden": "true" }), text);
}

/* A "Sell this" check box. */
export function sellBox(on, onChange, label) {
  const input = h("input", { type: "checkbox", checked: on, "aria-label": label });
  input.addEventListener("change", () => onChange(input.checked, input));
  return h("label", { class: "pl-sell" }, input, h("span", {}, "Sell this"));
}

/* A name customers see, shown as words with a Rename button; the button
   swaps in a box. onChange(text) when the box is left or Enter is pressed;
   an empty box goes back to the builder's name. */
export function renameable({ name, libraryName, label, field, onChange, canEdit = true }) {
  let current = name && name !== libraryName ? name : "";
  const shown = h("span", { class: "pl-name-text" }, current || libraryName);
  const was = h("span", { class: "pl-name-was" }, `Builder's name: ${libraryName}`);
  was.hidden = !current;
  const line = h("div", { class: "pl-name-line" }, shown);
  const wrap = h("div", { class: "pl-name" }, line, was);
  if (!canEdit) return wrap;
  const edit = h("button", { type: "button", class: "pl-rename", "aria-label": `Rename the ${current || libraryName}`, title: "Rename" }, icon("edit"));
  line.append(edit);
  edit.addEventListener("click", () => {
    const attrs = { type: "text", maxlength: NAME_MAX, "aria-label": label, class: "pl-name-input", autocomplete: "off" };
    if (field) attrs.dataset = { field };
    const box = h("input", attrs);
    box.value = current || libraryName;
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      const text = box.value.trim().replace(/\s+/g, " ");
      const next = text && text !== libraryName ? text : "";
      box.replaceWith(shown);
      edit.hidden = false;
      if (keep && next !== current) {
        current = next;
        shown.textContent = current || libraryName;
        was.hidden = !current;
        edit.setAttribute("aria-label", `Rename the ${current || libraryName}`);
        onChange(current);
      }
    };
    box.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); finish(true); edit.focus(); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); edit.focus(); }
    });
    box.addEventListener("blur", () => finish(true));
    shown.replaceWith(box);
    edit.hidden = true;
    box.focus();
    box.select();
  });
  return wrap;
}

/* Where a problem's sentence shows. */
export function msgs(where) {
  return h("ul", { class: "pl-msgs", dataset: { msgs: where }, "aria-live": "polite" });
}

/* A card's title row with an optional count and tools. */
export function cardHead(title, sub, ...tools) {
  return h("div", { class: "pl-card-head" },
    h("div", { class: "pl-card-titles" }, h("h2", { class: "card-title" }, title), sub ? h("p", { class: "pl-card-sub" }, sub) : null),
    tools.length ? h("div", { class: "actions" }, tools) : null);
}
