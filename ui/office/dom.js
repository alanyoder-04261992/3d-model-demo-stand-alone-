/* SMALL HELPERS FOR BUILDING THE DEALER CENTER'S SCREENS.

   h("div", {class: "card"}, child, child...) makes an element. Text is
   always set as text (never as HTML), so a customer's name can never
   become part of the page's code. The page's security policy also forbids
   inline styles and inline scripts: style through classes, or through
   element.style in code (which is allowed).

   Everything here is plain DOM; no framework. */

import { ICONS } from "./icons.js";

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : value;
    else if (key === "text") el.textContent = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
    else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(key, "");
    else if (key in el && !key.startsWith("aria-") && key !== "list" && key !== "form") el[key] = value;
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false || child === "") continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

let uid = 0;
export const nextId = (prefix = "f") => `${prefix}-${++uid}`;

/* An icon from the small set in icons.js (inline SVG, drawn with currentColor). */
export function icon(name, cls = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", `icon ${cls}`.trim());
  for (const d of [].concat(ICONS[name] || ICONS.dot)) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.append(p);
  }
  return svg;
}

/* A button. kind: primary | accent | ghost | danger | link | quiet */
export function button(label, onClick, { kind = "ghost", icon: iconName, type = "button", small = false, title, disabled } = {}) {
  return h("button", {
    type, class: ["btn", `btn-${kind}`, small && "btn-small"], title, disabled,
    onclick: onClick,
  }, iconName ? icon(iconName) : null, label ? h("span", {}, label) : null);
}

/* A link that looks like a button. */
export function linkButton(label, href, { kind = "ghost", icon: iconName, small = false, newTab = false } = {}) {
  return h("a", {
    href, class: ["btn", `btn-${kind}`, small && "btn-small"],
    target: newTab ? "_blank" : null, rel: newTab ? "noopener" : null,
  }, iconName ? icon(iconName) : null, label ? h("span", {}, label) : null);
}

/* A labelled form field. Returns {wrap, input}.
   opts: type (text, email, tel, number, date, textarea, select, money),
   value, hint, required, placeholder, options [[value, label]], wide, min, max, step, autocomplete */
export function field(label, opts = {}) {
  const id = nextId();
  const { type = "text", value = "", hint, required, placeholder, options, wide, rows = 3, autocomplete, inputmode, ...rest } = opts;
  let input;
  if (type === "textarea") input = h("textarea", { id, rows, placeholder, required, ...rest });
  else if (type === "select") input = h("select", { id, required, ...rest }, (options || []).map(([v, t]) => h("option", { value: v }, t)));
  else if (type === "money") {
    input = h("input", { id, type: "number", inputmode: "decimal", min: 0, step: "any", placeholder, required, ...rest });
  } else input = h("input", { id, type, placeholder, required, autocomplete, inputmode, ...rest });
  if (value != null) input.value = value;
  const help = hint ? h("p", { class: "hint", id: id + "-hint" }, hint) : null;
  if (help) input.setAttribute("aria-describedby", help.id);
  const control = type === "money" ? h("span", { class: "money-input" }, h("span", { class: "money-sign", "aria-hidden": "true" }, "$"), input) : input;
  const wrap = h("div", { class: ["field", wide && "wide"] }, h("label", { htmlFor: id }, label, required ? null : null), control, help);
  return { wrap, input };
}

export function checkbox(label, checked = false, { hint } = {}) {
  const input = h("input", { type: "checkbox", checked });
  const wrap = h("label", { class: "check" }, input, h("span", {}, label, hint ? h("small", { class: "hint" }, hint) : null));
  return { wrap, input };
}

/* A whole form: runs work(form) when submitted, shows its own busy state and
   the error sentence under the buttons. work may return a message to show. */
export function form(children, work, { class: cls } = {}) {
  const status = h("p", { class: "form-status", role: "status", "aria-live": "polite" });
  const el = h("form", { class: ["form", cls], novalidate: true }, children, status);
  el.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (el.dataset.busy) return;
    status.textContent = "";
    status.classList.remove("error");
    if (!el.checkValidity()) {
      const bad = el.querySelector(":invalid");
      bad?.focus();
      status.textContent = bad?.validationMessage ? `${labelOf(bad)}: ${bad.validationMessage}` : "Check the highlighted box.";
      status.classList.add("error");
      return;
    }
    el.dataset.busy = "1";
    const buttons = [...el.querySelectorAll("button")];
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const said = await work(el);
      if (typeof said === "string") status.textContent = said;
    } catch (e) {
      status.textContent = e.message || "Something went wrong. Try again.";
      status.classList.add("error");
    } finally {
      delete el.dataset.busy;
      buttons.forEach((b) => { b.disabled = false; });
    }
  });
  return el;
}

function labelOf(input) {
  const label = input.id && input.ownerDocument.querySelector(`label[for="${input.id}"]`);
  return label ? label.textContent.trim() : "This box";
}

export function card(title, ...children) {
  return h("section", { class: "card" }, title ? h("h2", { class: "card-title" }, title) : null, children);
}

export function emptyState(title, words, ...actions) {
  return h("div", { class: "empty" }, icon("shed", "empty-icon"), h("h2", {}, title), words ? h("p", {}, words) : null,
    actions.length ? h("div", { class: "actions" }, actions) : null);
}

export function loading(words = "Loading…") {
  return h("div", { class: "loading", role: "status" }, h("span", { class: "spinner", "aria-hidden": "true" }), words);
}

export function pageHead(title, subtitle, ...actions) {
  return h("header", { class: "page-head" },
    h("div", { class: "page-titles" }, h("h1", {}, title), subtitle ? h("p", {}, subtitle) : null),
    actions.length ? h("div", { class: "actions" }, actions) : null);
}

/* A pop-up box (<dialog>). Returns {el, close}. onClose runs once. */
export function dialog(title, body, { wide = false, onClose } = {}) {
  const closeBtn = h("button", { type: "button", class: "dialog-x", "aria-label": "Close" }, icon("x"));
  const el = h("dialog", { class: ["dialog", wide && "wide"] },
    h("header", { class: "dialog-head" }, h("h2", {}, title), closeBtn),
    h("div", { class: "dialog-body" }, body));
  let done = false;
  const close = () => { if (!done) { done = true; el.close(); el.remove(); onClose?.(); } };
  closeBtn.addEventListener("click", close);
  el.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  document.body.append(el);
  el.showModal();
  el.querySelector("input, select, textarea")?.focus();
  return { el, close };
}

/* "Are you sure?" -> Promise<boolean> */
export function confirmBox(title, words, { yes = "Yes", no = "Cancel", danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const yesBtn = button(yes, () => { answered = true; box.close(); resolve(true); }, { kind: danger ? "danger" : "primary" });
    const noBtn = button(no, () => box.close());
    const box = dialog(title, [h("p", {}, words), h("div", { class: "actions end" }, noBtn, yesBtn)], {
      onClose: () => { if (!answered) resolve(false); },
    });
    yesBtn.focus();
  });
}

/* A short message at the bottom of the screen. */
export function toast(words, { error = false, ms = 4000 } = {}) {
  let region = document.querySelector(".toasts");
  if (!region) {
    region = h("div", { class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(region);
  }
  const t = h("div", { class: ["toast", error && "error"] }, icon(error ? "alert" : "check"), h("span", {}, words));
  region.append(t);
  setTimeout(() => { t.classList.add("leaving"); setTimeout(() => t.remove(), 300); }, ms);
}

/* Tabs: [[key, label], ...] -> {el, set(key)} */
export function tabs(items, current, onPick) {
  const el = h("div", { class: "tabs", role: "tablist" });
  const set = (key) => {
    for (const b of el.children) b.setAttribute("aria-selected", String(b.dataset.key === key));
  };
  for (const [key, label, count] of items) {
    el.append(h("button", { type: "button", role: "tab", class: "tab", dataset: { key }, onclick: () => { set(key); onPick(key); } },
      label, count != null ? h("span", { class: "count" }, String(count)) : null));
  }
  set(current);
  return { el, set };
}

/* Chips you can pick one of (filters). [[key, label, count]] */
export function chips(items, current, onPick, { label = "Filter" } = {}) {
  const el = h("div", { class: "chips", role: "group", "aria-label": label });
  for (const [key, text, count, tone] of items) {
    el.append(h("button", {
      type: "button", class: ["chip", tone && `tone-${tone}`], "aria-pressed": String(key === current),
      onclick: (e) => { for (const c of el.children) c.setAttribute("aria-pressed", String(c === e.currentTarget)); onPick(key); },
    }, text, count != null ? h("span", { class: "count" }, String(count)) : null));
  }
  return el;
}

/* Wait for the next frame (so a screen paints before slow work). */
export const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

/* Copy words to the clipboard (a link, website code, a message to send).
   -> Promise<boolean>. Falls back to the older copy command where the
   clipboard is not allowed. Added by the Lots and Team screens. */
export async function copyText(words) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(words);
      return true;
    }
  } catch { /* try the older way */ }
  const box = h("textarea", { readonly: true, class: "sr-only", "aria-hidden": "true" });
  box.value = words;
  document.body.append(box);
  box.select();
  let done = false;
  try { done = document.execCommand("copy"); } catch { done = false; }
  box.remove();
  return done;
}
