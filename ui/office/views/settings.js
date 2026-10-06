/* SETTINGS (#/settings, the owner): the business's details and how its 3D
   designer looks and works, for every lot at once.

     Your business   name, phone, email, website
     Logo            a picture, shrunk in the browser to fit 360×360
     Colors          the header color and the color of buttons
     3D designer     open to customers or closed; how prices show; a
                     monthly rent-to-own price; the line under the price;
                     notes for building widths; the building it opens on
     The quote form  what it asks for, and the texting permission box

   Everything here lives in the one price list record (its settings), so it
   saves the same way the price list does: the whole record with the
   version it started from (someone else saved first -> 409, reload). The
   page works on a draft; a bar at the bottom counts the changes and saves
   them all at once. Managers and dealers get a short note instead. */

import { h, clear, icon, button, field, checkbox, form, toast, pageHead, emptyState, linkButton, confirmBox, nextId } from "../dom.js";
import { get, put, post } from "../api.js";
import { money, size as sizeWords, plural, initials, when } from "../words.js";
import { tidyDefaults, sortSizes, styleName, keysOf, groupsOf } from "./price-list/model.js";
import { RTO_NOTE } from "../../../model/pricing.js";
import { QUOTE_PLANS } from "../../../model/quote-plan.js";

const LOGO_BOX = 360;
const LOGO_MAX = 150 * 1024;
/* the standard black and gold, the same as the Dealer Center (server/office/price-list.js gives it to a new business) */
const STANDARD_COLORS = { header: "#16130E", primary: "#2E2920", accent: "#C9A227" };
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;
const FORM_FIELDS = [
  ["phone", "Phone"], ["email", "Email"], ["zip", "ZIP"], ["address", "Street address"], ["note", "A note from them"],
];
const ASK = [["required", "Must give"], ["optional", "Can give"], ["off", "Don't ask"]];

let page = null;   /* this screen's state while it is showing */

/* the save bar lifts the toasts; put them back when leaving the screen */
window.addEventListener("hashchange", () => {
  if (!/^#\/settings(?:[/?]|$)/.test(location.hash)) document.body.classList.remove("set-bar-on");
});

export async function render(ctx) {
  const { app } = ctx;
  ctx.setTitle("Settings");
  if (!app.can("changeSettings")) {
    const owners = (app.me?.team || []).filter((p) => p.role === "owner" && p.active !== false).map((p) => p.name || p.email);
    return h("div", { class: "set" }, pageHead("Settings"),
      h("section", { class: "card" }, emptyState("Only the owner can change settings",
        `The business details and the 3D designer's look are set by ${owners.length ? owners.join(" or ") : "the owner"}. Ask them when something needs to change.`,
        linkButton("Go to Today", "#/", { kind: "primary" }))));
  }
  const [record, M, help] = await Promise.all([app.loadPriceList(true), loadLibrary(app),
    app.account ? get("barnwright-help").then((r) => r.help).catch(() => null) : null]);
  page = { ctx, M, saved: record, draft: normalized(record.settings), sections: {}, bar: null, problems: {}, help };
  app.leaveGuard = () => (page && changes().length ? "You have settings you haven't saved. Leave without saving them?" : null);
  return draw();
}

async function loadLibrary(app) {
  const id = /^[a-z0-9-]{2,40}$/.test(app.priceList?.settings?.manufacturer || "") ? app.priceList.settings.manufacturer : "standard";
  let r;
  try {
    r = await fetch(`/library/manufacturers/${id}.json`, { credentials: "same-origin" });
  } catch {
    throw new Error("The list of buildings is missing. Check your internet connection, then reload the page.");
  }
  if (!r.ok) throw new Error("The list of buildings is missing. Reload the page to try again.");
  return r.json();
}

/* a copy with every part this screen edits in place */
function normalized(settings) {
  const s = structuredClone(settings);
  s.brand ||= {};
  s.brand.colors ||= {};
  s.pricing ||= {};
  s.notes ||= {};
  s.notes.sizeNotes ||= {};
  s.leads ||= {};
  s.leads.fields = { name: "required", phone: "required", email: "optional", zip: "required", address: "optional", note: "optional", ...(s.leads.fields || {}) };
  s.defaults ||= {};
  return s;
}

/* ---- what changed ------------------------------------------------------------------- */

const WATCH = [
  ["Business name", (s) => s.brand?.name || ""],
  ["Phone", (s) => s.brand?.phone || ""],
  ["Email", (s) => s.brand?.email || ""],
  ["Website", (s) => plainAddress(s.brand?.website)],
  ["Tagline", (s) => s.brand?.tagline || ""],
  ["Logo", (s) => s.brand?.logo || ""],
  ["Colors", (s) => [s.brand?.colors?.header || "", s.brand?.colors?.accent || ""]],
  ["Open or closed", (s) => s.status || "active"],
  ["How prices show", (s) => s.pricing?.show || "price"],
  ["Rent-to-own price", (s) => s.pricing?.rto?.showTerm ?? null],
  ["Words under the rent-to-own price", (s) => (s.pricing?.rto?.note || "").trim()],
  ["Line under the price", (s) => s.notes?.finePrint || ""],
  ["Notes for widths", (s) => s.notes?.sizeNotes || {}],
  ["Building it opens on", (s) => [s.defaults?.style || "", s.defaults?.size || ""]],
  ["Quote form", (s) => FORM_FIELDS.map(([k]) => s.leads?.fields?.[k] || "")],
  ["Texting permission", (s) => (s.leads?.smsConsent || "").trim()],
  ["What they want to do", (s) => s.leads?.askPlan !== false],
];

function changes() {
  if (!page) return [];
  const before = page.saved.settings, after = page.draft;
  return WATCH.filter(([, get]) => JSON.stringify(get(before)) !== JSON.stringify(get(after))).map(([words]) => words);
}

function edited() {
  drawBar();
}

/* ---- the page ------------------------------------------------------------------------- */

function draw() {
  const { ctx } = page;
  const cards = [
    ["business", "Your business", businessCard()],
    ["logo", "Logo", logoCard()],
    ["colors", "Colors", colorsCard()],
    ["designer", "3D designer", designerCard()],
    ["form", "Quote form", quoteFormCard()],
    ...(page.help ? [["help", "Help from Barnwright", helpCard()]] : []),
  ];
  const jump = h("nav", { class: "set-jump", "aria-label": "Settings sections" },
    cards.map(([key, words, el]) => h("button", { type: "button", class: "chip", onclick: () => el.scrollIntoView({ behavior: "smooth", block: "start" }) }, words)));
  page.bar = h("div", { class: "set-bar", hidden: true, role: "region", "aria-label": "Save settings" });
  const el = h("div", { class: "set" },
    pageHead("Settings", "Your business and how your 3D designer looks and works. Saving changes every lot at once."),
    jump,
    h("div", { class: "set-cards" },
      cards[0][2],
      h("div", { class: "grid-2" }, cards[1][2], cards[2][2]),
      cards[3][2],
      cards[4][2],
      cards[5]?.[2] || null),
    page.bar);
  page.root = el;
  drawBar();
  return el;
}

function cardOf(iconName, title, intro, ...body) {
  return h("section", { class: "card set-card" },
    h("h2", { class: "card-title" }, icon(iconName), title),
    intro ? h("p", { class: "set-intro" }, intro) : null,
    body);
}

/* a message under a box (shown when saving finds a problem) */
function problemSpot(key) {
  const el = h("p", { class: "set-problem", role: "alert" });
  page.sections[key] = el;
  return el;
}
function showProblems(problems) {
  for (const [key, el] of Object.entries(page.sections)) {
    el.textContent = problems[key] || "";
    el.closest(".field")?.classList.toggle("set-bad", !!problems[key]);
  }
}

/* ---- Your business ---------------------------------------------------------------------- */

function businessCard() {
  const B = page.draft.brand;
  const box = (key, label, opts = {}) => {
    const f = field(label, { value: key === "website" ? plainAddress(B[key]) : B[key] || "", ...opts });
    f.input.addEventListener("input", () => {
      B[key] = f.input.value;
      if (key === "name") page.namePreview?.forEach((n) => { n.textContent = f.input.value || "Your business"; });
      edited();
    });
    f.wrap.append(problemSpot(key));
    return f.wrap;
  };
  return cardOf("lots", "Your business", "Customers see these on every lot's 3D designer and on their quotes.",
    h("div", { class: "form-grid" },
      box("name", "Business name", { required: true, maxLength: 80, autocomplete: "organization" }),
      box("phone", "Phone", { type: "tel", maxLength: 40, autocomplete: "tel", hint: "A lot's own phone number shows on that lot's designer instead." }),
      box("email", "Email", { type: "email", maxLength: 200, autocomplete: "email" }),
      box("website", "Website", { maxLength: 300, inputmode: "url", placeholder: "yourbusiness.com", autocomplete: "url" })));
  /* brand.tagline is kept as it is: the 3D designer's header line is fixed
     text (index.html), so a box for it here would change nothing a
     customer sees. */
}

/* ---- Logo ---------------------------------------------------------------------------------- */

function badgeFor(brand, cls) {
  if (brand.logo) return h("img", { class: [cls, "logo"], src: brand.logo, alt: "Your logo" });
  return h("span", { class: cls }, brand.initials || initials(brand.name || "Your business"));
}

function logoCard() {
  const B = page.draft.brand;
  const preview = h("div", { class: "set-logo-preview" });
  const status = h("p", { class: "set-problem", role: "alert" });
  const input = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", class: "set-file", id: nextId("logo") });
  const remove = button("Remove logo", () => { B.logo = ""; paint(); paintColors(); edited(); }, { kind: "quiet", icon: "trash" });
  const paint = () => {
    clear(preview, B.logo ? h("img", { src: B.logo, alt: "Your logo" })
      : h("div", { class: "set-logo-none" }, icon("upload"), h("span", {}, "No logo yet. Your initials show instead.")));
    remove.hidden = !B.logo;
  };
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    status.textContent = "";
    try {
      B.logo = await shrinkLogo(file);
      paint();
      paintColors();
      edited();
    } catch (e) {
      status.textContent = e.message;
    }
  });
  paint();
  return cardOf("upload", "Logo", "Shows at the top of the Dealer Center and every lot's 3D designer. A square logo looks best.",
    preview,
    h("div", { class: "actions" },
      h("label", { class: "btn btn-ghost", htmlFor: input.id }, icon("upload"), h("span", {}, B.logo ? "Upload a new logo" : "Upload a logo")),
      remove),
    input, status,
    h("p", { class: "hint" }, "PNG, JPG or SVG. We shrink it to fit 360 × 360 pixels."));
}

/* Read a picture, shrink it to fit 360×360 and keep the smaller of PNG and
   WebP. Refuses anything still over 150 KB. -> a data: address */
async function shrinkLogo(file) {
  if (!/^image\//.test(file.type)) throw new Error("That file isn't a picture. Pick a PNG or JPG of your logo.");
  if (file.size > 20 * 1024 * 1024) throw new Error("That picture is too big to use. Pick one under 20 MB.");
  const address = await new Promise((done, failed) => {
    const reader = new FileReader();
    reader.onload = () => done(reader.result);
    reader.onerror = () => failed(new Error("That picture couldn't be opened. Try another file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((done, failed) => {
    const i = new Image();
    i.onload = () => done(i);
    i.onerror = () => failed(new Error("That file isn't a picture we can use. Pick a PNG or JPG."));
    i.src = address;
  });
  const w = img.naturalWidth || LOGO_BOX, ht = img.naturalHeight || LOGO_BOX;
  const scale = Math.min(1, LOGO_BOX / w, LOGO_BOX / ht);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(ht * scale));
  const g = canvas.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  let best;
  try {
    best = canvas.toDataURL("image/png");
    const webp = canvas.toDataURL("image/webp", 0.9);
    if (webp.startsWith("data:image/webp") && webp.length < best.length) best = webp;
  } catch {
    throw new Error("That picture couldn't be used. Save it as a PNG or JPG and try again.");
  }
  if (best.length > LOGO_MAX) {
    throw new Error("That logo is still too big after shrinking it. Try a simpler picture, or a PNG with fewer colors.");
  }
  return best;
}

/* ---- Colors ---------------------------------------------------------------------------------- */

let paintColors = () => {};

function colorsCard() {
  const C = page.draft.brand.colors;
  const B = page.draft.brand;
  const pickers = [["header", "Header", "The bar across the top."], ["accent", "Buttons", "Buttons, prices and highlights."]];
  const warn = h("p", { class: "set-warn", role: "status" });
  const bar = h("div", { class: "set-preview-bar" });
  const sample = h("span", { class: "set-preview-btn" }, "Get my quote");
  const name = h("strong", {}, B.short || B.name || "Your business");
  page.namePreview = [name];
  const badge = h("span", { class: "set-preview-badge-wrap" });
  clear(bar, badge, h("span", { class: "set-preview-words" }, name, h("span", {}, "3D Shed Designer")));
  const rows = pickers.map(([key, label, hint]) => {
    const id = nextId("color");
    const input = h("input", { type: "color", id, value: hex6(C[key] || STANDARD_COLORS[key]) });
    const code = h("span", { class: "set-hex" }, hex6(C[key] || STANDARD_COLORS[key]).toUpperCase());
    input.addEventListener("input", () => { setColor(key, input.value); code.textContent = input.value.toUpperCase(); paintColors(); edited(); });
    return { key, input, code, el: h("div", { class: "set-color" }, input, h("label", { htmlFor: id }, h("strong", {}, label), h("small", {}, hint)), code) };
  });
  paintColors = () => {
    const head = hex6(C.header || STANDARD_COLORS.header), accent = hex6(C.accent || STANDARD_COLORS.accent);
    bar.style.backgroundColor = head;
    sample.style.backgroundColor = accent;
    sample.style.color = wordsOn(accent, head);
    clear(badge, badgeFor(B, "set-preview-badge"));
    const b = badge.firstChild;
    if (b && !B.logo) { b.style.backgroundColor = accent; b.style.color = wordsOn(accent, head); }
    warn.textContent = contrast(head, "#ffffff") < 4.5 ? "White words are hard to read on this header color. Pick a darker one." : "";
    for (const r of rows) {
      const v = hex6(C[r.key] || STANDARD_COLORS[r.key]);
      if (r.input.value !== v) r.input.value = v;
      r.code.textContent = v.toUpperCase();
    }
  };
  paintColors();
  return cardOf("star", "Colors", "Your customers see these on every lot's 3D designer. Pick colors that match your sign. The header needs a dark color. On a light button the words turn black so they stay easy to read.",
    h("div", { class: "set-preview" }, bar, h("div", { class: "set-preview-page" }, h("span", { class: "set-preview-line" }), h("span", { class: "set-preview-line short" }), sample)),
    h("div", { class: "set-colors" }, rows.map((r) => r.el)),
    warn,
    button("Use the standard black and gold", () => {
      setColor("header", STANDARD_COLORS.header);
      setColor("accent", STANDARD_COLORS.accent);
      page.draft.brand.colors.primary = STANDARD_COLORS.primary.toLowerCase();
      paintColors();
      edited();
    }, { kind: "link" }));
}

/* Header and accent are picked; the rest of the designer's colors are
   worked out from them (by the designer itself), and the darker blue used
   for links follows the header. */
function setColor(key, value) {
  const C = page.draft.brand.colors;
  C[key] = value.toLowerCase();
  for (const k of ["cream", "cyan", "hdrSub"]) delete C[k];
  if (key === "header") C.primary = linkColor(C.header);
}

function hex6(v) {
  const s = String(v || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase();
  return "#000000";
}
const rgbOf = (x) => [1, 3, 5].map((i) => parseInt(hex6(x).slice(i, i + 2), 16));
const hexOf = (a) => "#" + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
function luminance(x) {
  const f = rgbOf(x).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/* the words on a button, picked the way the 3D designer picks them
   (ui/app.js onColour): white when white reads on it, else the header
   color darkened until it does */
function wordsOn(fill, dark) {
  const white = contrast("#ffffff", fill);
  if (white >= 4.5) return "#ffffff";
  let c = hex6(dark);
  for (let i = 1; i <= 20 && contrast(c, fill) < 4.5; i++) c = hexOf(rgbOf(dark).map((v) => v * (1 - i / 20)));
  return contrast(c, fill) > white ? c : "#ffffff";
}
/* a little lighter than the header, but always readable on white */
function linkColor(header) {
  let c = hexOf(rgbOf(header).map((v) => v * 1.3));
  for (let i = 0; i < 20 && contrast(c, "#ffffff") < 4.5; i++) c = hexOf(rgbOf(c).map((v) => v * 0.85));
  return c;
}

/* ---- 3D designer ------------------------------------------------------------------------------ */

function radioCards(name, choices, current, onPick, cls = "") {
  const group = nextId(name);
  return h("div", { class: ["set-choices", cls], role: "radiogroup" }, choices.map(([value, title, words, extra]) => {
    const input = h("input", { type: "radio", name: group, value, checked: value === current, onchange: () => onPick(value) });
    return h("label", { class: ["set-choice", `is-${value}`] }, input,
      h("span", { class: "set-choice-words" }, h("strong", {}, title), words ? h("small", {}, words) : null, extra || null));
  }));
}

function openingPrice() {
  const s = page.draft;
  const offered = keysOf(s.offer);
  const st = s.defaults?.style && offered.includes(s.defaults.style) ? s.defaults.style : offered[0];
  const sizes = s.offer?.[st]?.sizes || {};
  const z = s.defaults?.size && sizes[s.defaults.size] != null ? s.defaults.size : sortSizes(keysOf(sizes))[0];
  const p = sizes[z];
  return typeof p === "number" && p > 0 ? p : 5000;
}

function designerCard() {
  const s = page.draft;
  const app = page.ctx.app;
  const lots = app.lots.filter((l) => l.active !== false).length;

  /* open or closed */
  const openPart = h("div", { class: "set-block" },
    h("h3", { class: "set-sub" }, "Can customers use it?"),
    radioCards("status", [
      ["active", "Open to customers", `Every lot's 3D designer link works and takes quotes${lots ? ` (${plural(lots, "lot")} open now)` : ""}.`],
      ["suspended", "Closed", "Every lot's link shows a short message with the lot's phone number instead of the designer. Use it while you get your prices ready."],
    ], s.status === "suspended" ? "suspended" : "active", (v) => { s.status = v; edited(); }, "two"));

  /* how prices show */
  const priceExamples = h("div");
  const showPart = h("div", { class: "set-block" }, h("h3", { class: "set-sub" }, "How prices show"), priceExamples);
  const drawShow = () => {
    const p = openingPrice();
    clear(priceExamples, radioCards("show", [
      ["price", "The full price", "Every price, and a running total as they add things.", h("span", { class: "set-eg" }, money(p))],
      ["from", "A starting price", "The building's price before options, said as “from”.", h("span", { class: "set-eg" }, `from ${money(p)}`)],
      ["none", "No price", "No money anywhere. Customers send their design and you call with a price.", h("span", { class: "set-eg" }, "Ask us for a price")],
    ], s.pricing.show || "price", (v) => { s.pricing.show = v; edited(); }, "three"));
  };
  drawShow();

  /* rent-to-own */
  const factors = s.pricing.rto?.factors || {};
  const terms = Object.keys(factors).filter((k) => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
  let rtoPart;
  if (!terms.length) {
    rtoPart = h("div", { class: "set-block" }, h("h3", { class: "set-sub" }, "Rent-to-own"),
      h("p", { class: "muted" }, "Your price list has no rent-to-own terms, so the designer shows no monthly price."));
  } else {
    const on = h("input", { type: "checkbox", checked: s.pricing.rto.showTerm != null });
    const term = h("select", { "aria-label": "Rent-to-own term" }, terms.map((m) => h("option", { value: String(m) }, `${m} months`)));
    term.value = String(s.pricing.rto.showTerm ?? terms[terms.length - 1]);
    const eg = h("p", { class: "set-eg-line" });
    const sync = () => {
      s.pricing.rto.showTerm = on.checked ? Number(term.value) : null;
      term.disabled = !on.checked;
      const m = Number(term.value), f = factors[String(m)];
      const p = openingPrice();
      eg.textContent = on.checked && f > 0
        ? `A ${money(p)} building shows “or ${money(Math.round((p / f / m) * 100) / 100)}/mo” over ${m} months.`
        : "No monthly price shows.";
      edited();
    };
    on.addEventListener("change", sync);
    term.addEventListener("change", sync);
    sync();
    /* the words under the monthly price in the customer's quote */
    const note = field("The words under the monthly price", { type: "textarea", rows: 2, value: s.pricing.rto.note || "", maxLength: 300, wide: true,
      placeholder: RTO_NOTE, hint: "Customers read this under “As low as” in their quote. Leave it empty to use the words shown here." });
    note.input.addEventListener("input", () => { s.pricing.rto.note = note.input.value; edited(); });
    rtoPart = h("div", { class: "set-block" }, h("h3", { class: "set-sub" }, "Rent-to-own"),
      h("div", { class: "set-rto" },
        h("label", { class: "check" }, on, h("span", {}, "Show a monthly rent-to-own price by the total, and a box in the quote to pick the months")),
        h("label", { class: "set-rto-term" }, h("span", {}, "Over"), term)),
      eg, note.wrap);
  }

  /* the line under the price */
  const fine = field("The line under the price", { type: "textarea", rows: 1, class: "set-grow", value: s.notes.finePrint || "", maxLength: 200, wide: true,
    placeholder: "Prices plus tax. Delivery and setup included within our area.", hint: "Short and plain, like what's included and what isn't." });
  fine.input.addEventListener("input", () => { fine.input.value = fine.input.value.replace(/[\r\n]+/g, " "); s.notes.finePrint = fine.input.value; edited(); });

  return cardOf("cube", "3D designer", "How every lot's 3D designer works for customers.",
    s.status === "suspended" ? h("p", { class: "set-callout" }, icon("alert"),
      h("span", {}, "Your 3D designer is closed to customers. When your prices are right, pick “Open to customers” and save.")) : null,
    openPart, showPart, rtoPart,
    h("div", { class: "set-block" }, fine.wrap),
    widthNotes(),
    openingBuilding());
}

/* notes for building widths: "12" -> "A 12 ft wide building's actual width is 11′2″." */
function widthNotes() {
  const s = page.draft;
  const N = s.notes.sizeNotes;
  const sold = new Set();
  for (const k of keysOf(s.offer)) for (const z of keysOf(s.offer[k]?.sizes)) { const w = /^(\d+)x/.exec(z); if (w) sold.add(Number(w[1])); }
  for (const k of Object.keys(N)) if (/^\d+$/.test(k)) sold.add(Number(k));
  const widths = [...sold].sort((a, b) => a - b);
  const list = h("div", { class: "set-notes" });
  const addRow = h("div", { class: "set-note-add" });
  const draw = () => {
    const used = Object.keys(N).filter((k) => !k.startsWith("_")).sort((a, b) => Number(a) - Number(b));
    clear(list, used.length ? used.map((w) => {
      const input = h("textarea", { rows: 1, maxLength: 200, class: "set-grow", "aria-label": `Note for ${w} ft wide buildings` });
      input.value = N[w];
      input.addEventListener("input", () => { input.value = input.value.replace(/[\r\n]+/g, " "); N[w] = input.value; edited(); });
      return h("div", { class: "set-note" }, h("span", { class: "set-note-w" }, `${w} ft wide`), input,
        h("button", { type: "button", class: "set-icon-btn", "aria-label": `Remove the note for ${w} ft wide buildings`, title: "Remove note",
          onclick: () => { delete N[w]; draw(); edited(); } }, icon("trash")));
    }) : h("p", { class: "muted small" }, "No notes yet. Add one when a width needs explaining, like a 12 ft building's actual width."));
    const free = widths.filter((w) => !(String(w) in N));
    if (!free.length) { clear(addRow); return; }
    const pick = h("select", { "aria-label": "Width" }, free.map((w) => h("option", { value: String(w) }, `${w} ft wide`)));
    clear(addRow, pick, button("Add a note", () => { N[pick.value] = ""; draw(); edited(); list.querySelector(`input[aria-label="Note for ${pick.value} ft wide buildings"]`)?.focus(); }, { icon: "plus", small: true }));
  };
  draw();
  return h("div", { class: "set-block" }, h("h3", { class: "set-sub" }, "Notes for building widths"),
    h("p", { class: "hint" }, "Shows under the size buttons when a customer picks that width. Empty notes aren't saved."),
    list, addRow);
}

/* the building the designer opens on */
function openingBuilding() {
  const s = page.draft, M = page.M;
  const D = s.defaults;
  const offered = keysOf(s.offer);
  const tidyWords = h("p", { class: "hint" });
  const style = h("select", { "aria-label": "Building style" }, groupsOf(s, M).map(([label, ks]) =>
    h("optgroup", { label }, ks.filter((k) => offered.includes(k)).map((k) => h("option", { value: k }, styleName(M, k, s.offer[k]))))));
  const sizeBox = h("select", { "aria-label": "Size" });
  const current = () => (D.style && offered.includes(D.style) ? D.style : offered[0]);
  const fillSizes = () => {
    const sizes = sortSizes(keysOf(s.offer[current()]?.sizes));
    clear(sizeBox, sizes.map((z) => h("option", { value: z }, sizeWords(z))));
    sizeBox.value = D.size && sizes.includes(D.size) ? D.size : sizes[0] || "";
  };
  style.value = current() || "";
  fillSizes();
  style.addEventListener("change", () => {
    D.style = style.value;
    const sizes = sortSizes(keysOf(s.offer[D.style]?.sizes));
    if (!sizes.includes(D.size)) D.size = sizes[Math.floor((sizes.length - 1) / 2)] || sizes[0];
    const notes = tidyDefaults(s, M, offered);
    tidyWords.textContent = notes.join(" ");
    fillSizes();
    edited();
  });
  sizeBox.addEventListener("change", () => { D.style = current(); D.size = sizeBox.value; edited(); });
  return h("div", { class: "set-block" }, h("h3", { class: "set-sub" }, "The building it opens on"),
    h("p", { class: "hint" }, "The first building customers see. They can change everything from there."),
    h("div", { class: "set-open-on" },
      h("label", { class: "field" }, h("span", { class: "set-label" }, "Building style"), style),
      h("label", { class: "field" }, h("span", { class: "set-label" }, "Size"), sizeBox)),
    tidyWords);
}

/* ---- The quote form ------------------------------------------------------------------------------ */

function quoteFormCard() {
  const L = page.draft.leads;
  const problem = problemSpot("form");
  const row = (label, control) => h("div", { class: "set-ask-row" }, h("span", { class: "set-ask-label" }, label), control);
  const segs = FORM_FIELDS.map(([key, label]) => {
    const group = nextId("ask");
    return row(label, h("div", { class: "set-seg", role: "radiogroup", "aria-label": label }, ASK.map(([value, words]) =>
      h("label", { class: "set-seg-item" },
        h("input", { type: "radio", name: group, value, checked: (L.fields[key] || "optional") === value,
          onchange: () => { L.fields[key] = value; checkForm(); edited(); } }),
        h("span", {}, words)))));
  });
  const checkForm = () => {
    problem.textContent = L.fields.phone === "off" && L.fields.email === "off"
      ? "Ask for a phone number or an email (or both), so you can reach the customer." : "";
  };
  const sms = field("Texting permission", { type: "textarea", rows: 2, value: L.smsConsent || "", maxLength: 300, wide: true,
    placeholder: "Yes, you may text me about this quote. Message and data rates may apply. Reply STOP to stop.",
    hint: "Customers tick a box with these words to say you may text them. Leave it empty to not ask." });
  sms.input.addEventListener("input", () => { L.smsConsent = sms.input.value; edited(); });
  /* "What do you want to do with this quote?" -- one tap, never required */
  const plan = checkbox("Ask what they want to do with the quote", L.askPlan !== false,
    { hint: `They can pick one: ${QUOTE_PLANS.map((p) => p[1]).join("; ")}. Nobody has to answer.` });
  plan.input.addEventListener("change", () => { L.askPlan = plan.input.checked; edited(); });
  checkForm();
  return cardOf("note", "The quote form", "What the form asks when a customer sends their design to a lot.",
    h("div", { class: "set-ask" },
      row("Name", h("span", { class: "set-always" }, icon("check"), "Always asked")),
      segs),
    problem,
    h("div", { class: "set-block" }, plan.wrap),
    h("div", { class: "set-block" }, sms.wrap));
}

/* ---- checking and saving ------------------------------------------------------------------------------ */

/* "https://yoursite.com/" -> "yoursite.com" (how people say it) */
function plainAddress(address) {
  return String(address || "").trim().replace(/^https:\/\//i, "").replace(/\/$/, "");
}

/* "yoursite.com" -> "https://yoursite.com/"; "" stays "". Throws on junk. */
function websiteAddress(value) {
  const t = String(value || "").trim();
  if (!t) return "";
  const u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
  if (u.protocol !== "https:" || !u.hostname.includes(".") || /\s/.test(t)) throw new Error("no");
  return u.href;
}

function problemsOf(s) {
  const out = {};
  const B = s.brand;
  if (!String(B.name || "").trim()) out.name = "Your business needs a name.";
  if (B.email && !EMAIL_RE.test(B.email.trim())) out.email = "That doesn't look like an email address.";
  const phone = String(B.phone || "").trim();
  if (phone && (!/^[0-9+().\-\s x#]+$/i.test(phone) || phone.replace(/\D/g, "").length < 7)) out.phone = "That doesn't look like a phone number.";
  try { websiteAddress(B.website); } catch { out.website = "That isn't a website address. Type it like yourbusiness.com."; }
  if (s.leads.fields.phone === "off" && s.leads.fields.email === "off") out.form = "Ask for a phone number or an email (or both), so you can reach the customer.";
  return out;
}

/* the copy that is saved: tidy text, short name and initials made from the name */
function prepared() {
  const s = structuredClone(page.draft);
  const B = s.brand;
  B.name = String(B.name || "").trim();
  const before = page.saved.settings.brand || {};
  if (B.name !== (before.name || "")) {
    const words = B.name.split(/\s+/).filter(Boolean);
    B.short = B.name.length > 24 ? words.slice(0, 2).join(" ") : B.name;
    B.initials = words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "SB";
  }
  for (const k of ["phone", "email", "tagline"]) B[k] = String(B[k] || "").trim();
  B.email = B.email.toLowerCase();
  B.website = plainAddress(B.website) === plainAddress(before.website) ? before.website || "" : websiteAddress(B.website);
  if (s.status !== "suspended") s.status = "active";
  s.notes.finePrint = String(s.notes.finePrint || "").trim();
  const notes = {};
  for (const [w, t] of Object.entries(s.notes.sizeNotes || {})) if (String(t || "").trim()) notes[w] = String(t).trim();
  s.notes.sizeNotes = notes;
  const sms = String(s.leads.smsConsent || "").trim();
  s.leads.smsConsent = sms || null;
  if (s.pricing.rto) {
    const rtoNote = String(s.pricing.rto.note || "").trim();
    if (rtoNote) s.pricing.rto.note = rtoNote; else delete s.pricing.rto.note;
  }
  s.leads.fields.name = "required";
  return s;
}

function drawBar() {
  const bar = page?.bar;
  if (!bar) return;
  const list = changes();
  const on = list.length > 0 || !!page.error;
  bar.hidden = !on;
  document.body.classList.toggle("set-bar-on", on);
  page.root?.classList.toggle("has-bar", on);
  if (!on) { clear(bar); return; }
  const shown = list.slice(0, 3).join(", ") + (list.length > 3 ? ` and ${list.length - 3} more` : "");
  clear(bar, h("div", { class: "set-bar-inner" },
    h("div", { class: "set-bar-words" },
      page.error ? h("p", { class: "set-bar-error" }, icon("alert"), h("span", {}, page.error))
        : [h("strong", {}, plural(list.length, "change")), h("span", {}, shown)]),
    h("div", { class: "set-bar-actions" },
      page.stale
        ? button("Reload settings", reload, { kind: "accent" })
        : [button("Undo changes", undo, { kind: "ghost" }),
          button("Save settings", save, { kind: "accent", icon: "check" })])));
}

/* someone else saved first: start again from what they saved */
async function reload() {
  const record = await page.ctx.app.loadPriceList(true);
  page.saved = record;
  page.draft = normalized(record.settings);
  page.stale = false;
  page.error = null;
  rerender();
  toast("Settings reloaded. Make your changes again.");
}

async function undo() {
  const yes = await confirmBox("Undo your changes?", "Your settings go back to how they were last saved.", { yes: "Undo changes" });
  if (!yes) return;
  page.draft = normalized(page.saved.settings);
  page.error = null;
  rerender();
}

function rerender() {
  const old = page.root;
  const fresh = draw();
  old.replaceWith(fresh);
}

async function save(e) {
  const btn = e?.currentTarget;
  const problems = problemsOf(page.draft);
  showProblems(problems);
  if (Object.keys(problems).length) {
    page.error = Object.keys(problems).length === 1 ? Object.values(problems)[0] : "Fix the boxes marked in red, then save.";
    drawBar();
    page.root.querySelector(".set-bad input, .set-problem:not(:empty)")?.scrollIntoView({ behavior: "smooth", block: "center" });
    page.error = null;
    return;
  }
  if (btn) btn.disabled = true;
  const { app } = page.ctx;
  const brandBefore = JSON.stringify([page.saved.settings.brand, page.saved.settings.status]);
  let out;
  try {
    out = await put("price-list", { settings: prepared(), version: page.saved.version });
  } catch (err) {
    if (btn) btn.disabled = false;
    page.error = err.problems?.length ? err.problems.join(" ") : err.message;
    page.stale = err.status === 409;
    drawBar();
    page.error = page.stale ? page.error : null;
    return;
  }
  const record = await app.loadPriceList(true);
  page.saved = record;
  page.draft = normalized(record.settings);
  await app.loadMe().catch(() => null);
  if (brandBefore !== JSON.stringify([record.settings.brand, record.settings.status])) window.dispatchEvent(new Event("dealer:brand"));
  const lots = out.lotCount;
  toast(!out.changes?.length ? "Nothing changed." : lots ? `Saved. ${lots === 1 ? "Your lot shows" : `All ${lots} lots show`} it now.` : "Saved.");
  rerender();
}

/* ---- Help from Barnwright (only with a Barnwright account) ------------------------------
   The owner lets Barnwright run checks for 1 to 24 hours. Not part of the
   settings saved with the bar at the bottom: it turns on and off at once. */

function helpCard() {
  const box = h("div", { class: "stack" });
  const show = (help) => {
    page.help = help;
    const log = help.log?.length
      ? h("div", { class: "stack" }, h("h3", { class: "set-sub" }, "What happened"),
        h("ul", { class: "help-log" }, help.log.map((e) => h("li", {}, h("time", { dateTime: e.at }, when(e.at)), e.words))))
      : null;
    if (help.on) {
      clear(box,
        h("div", { class: "help-state on" }, icon("check"), h("span", {},
          h("strong", {}, `Barnwright can run checks until ${when(help.until)}.`), " ", help.reason ? `You asked them to look at: ${help.reason}` : "")),
        h("div", { class: "actions" }, button("Turn off now", async (ev) => {
          ev.currentTarget.disabled = true;
          try {
            show((await post("barnwright-help", { on: false })).help);
            toast("Help from Barnwright is off.");
          } catch (e) {
            ev.currentTarget.disabled = false;
            toast(e.message, { error: true });
          }
        })),
        log);
      return;
    }
    const reason = field("What should Barnwright look at?", { required: true, maxLength: 300, wide: true, placeholder: "Quotes from the Riverside lot aren't showing up" });
    const hours = field("For how long", { type: "select", value: "4", options: [["1", "1 hour"], ["4", "4 hours"], ["8", "8 hours"], ["24", "24 hours"]] });
    clear(box,
      h("div", { class: "help-state" }, icon("alert"), h("span", {}, "Off. Barnwright can't run any checks on your Dealer Center.")),
      form([
        h("div", { class: "form-grid" }, reason.wrap, hours.wrap),
        h("div", { class: "actions" }, h("button", { type: "submit", class: "btn btn-primary" }, h("span", {}, "Let Barnwright help"))),
      ], async () => {
        const out = await post("barnwright-help", { on: true, reason: reason.input.value, hours: Number(hours.input.value) });
        show(out.help);
        toast("Barnwright can help now.");
      }),
      log);
  };
  show(page.help);
  /* who agreed to the Barnwright terms, and when */
  const t = page.ctx.app.me?.terms;
  const termsLine = t ? h("p", { class: "help-terms" }, icon("note"), h("span", {},
    t.agreed ? `${t.agreed.by.name || t.agreed.by.email} agreed to the Barnwright terms (version ${t.agreed.version}) on ${when(t.agreed.agreedAt)}. `
      : `Nobody has agreed to the Barnwright terms (version ${t.version}) yet. `,
    h("a", { href: t.url, target: "_blank", rel: "noopener" }, "Read the terms"))) : null;
  return cardOf("user", "Help from Barnwright",
    "When something isn't working, let Barnwright check how your Dealer Center is running. They can't see your customers or prices, and they can't change anything. It turns itself off when the time is up.",
    box, termsLine);
}
