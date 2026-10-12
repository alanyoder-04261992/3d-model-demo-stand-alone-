/* PRICE LIST, HOW IT'S BUILT: the building numbers of the business's own.

   Alan (Oct 2026, "lets all 5"): each business can build a style its own
   way -- taller walls, another roof pitch, a deeper porch -- typed the way
   a shed builder says it (5/12, 7 ft 9 1/2 in), checked as it is typed,
   saved in the price list like a price, and drawn at every size before it
   reaches a lot. The rules are model/build-settings.js; the every-size
   check is model/built-check.js (the server runs the same one on save,
   server/office/built-check.js).

   The owner sees:
   * builtSection(key, entry)  in each style's editor: one box per number
     that applies to it, the number it has with the box empty as the
     placeholder, and where that number comes from ("Standard: 6 1/2/12",
     "Built like the Utility Shed: 6/12"). Dormer side and side porch
     lengths are chips. "Check every size" draws the style at every size
     with the numbers on the screen.
   * builtCard()  at the end of the Buildings tab: "How your buildings are
     built", the same numbers for every building with one kind of roof,
     each saying which styles it reaches and which keep their own. In a
     Barnwright visit these are the owner's alone (server/office/
     setup-lock.js), so the card only says them; each style's own numbers
     can still be changed in its editor.
   * builtNotes()  at the top of the Buildings tab, a yellow note: numbers
     the 3D designer could not use, and what a quiet check of the styles
     with numbers of their own found when the price list opened (it
     catches a change to the standard under the business's numbers).
   * builtSaved(sizeCheck)  in the "Saved" box: what the save's check said,
     and a link to see the style in the 3D designer.
   Managers and dealers see builtLines(key): the numbers, read only.

   Problems show next to their box through the screen's usual way
   (views/price-list.js paintProblems): model.js builtProblemsOf gives each
   one the box's data-field and data-msgs names used here. A box that
   cannot be read keeps the words typed in the draft, so the problem shows
   and Save waits until it is fixed. */

import { h, clear, button, icon, nextId, frame } from "../../dom.js";
import { plural } from "../../words.js";
import { resolve } from "../../../../model/company.js";
import * as BUILT from "../../../../model/build-settings.js";
import { defaults, fromState, toState, encodeSync } from "../../../../model/design.js";
import { S, edited } from "./state.js";
import { keysOf, isObj, styleName, baseOf, prepare, sortSizes, sizeParts } from "./model.js";
import { msgs } from "./bits.js";

const KNOB = Object.fromEntries(BUILT.KNOBS.map((k) => [k.id, k]));

/* What each box is, in a builder's words, with its unit. */
const HINTS = {
  roofPitch: "Rise for every 12 in of run, like 5/12.",
  barnPeak: "From the top of the wall to the top of the trusses, for each width. Like 4 ft 3 in.",
  eaveOverhang: "Inches the roof reaches past the long walls, measured level.",
  gableEndOverhang: "Inches the roof reaches past the gable ends.",
  wallHeight: "Floor to the top of the wall plate, like 7 ft 9 1/2 in.",
  doorHeight: "The opening of the wooden shop doors, like 76 1/2 in.",
  porchDepth: "Feet from the front of the porch to the wall behind it.",
  sidePorchLengths: "The lengths customers can pick, up to 4.",
  dormerSide: "The long wall the dormer sits on.",
};
const BARN_END = "On a barn roof this is the lower panels; the upper panels stand 1 5/8 in further out.";
const PORCH_CHIPS = [4, 6, 8, 10, 12, 14, 16, 18, 20];

const roofOf = (key, entry) => S.M.styles[baseOf(key, entry)] || {};
const kindOf = (key, entry) => BUILT.roofKindOf(roofOf(key, entry));

/* ---- price lists worked out for the screen (memo) ------------------------------ */

const cache = new Map();
function memo(key, make) {
  if (cache.has(key)) return cache.get(key);
  let v = null;
  try { v = make(); } catch { v = null; }
  cache.set(key, v);
  if (cache.size > 12) cache.delete(cache.keys().next().value);
  return v;
}
/* Only what How it's built reads: two drafts that differ in prices alone
   give the same catalogue for these screens. */
function builtKey(s) {
  return JSON.stringify([S.saved?.version, s.built ?? null, s.construction ?? null, s.defaults ?? null, s.palettes ?? null, s.look ?? null,
    keysOf(s.offer).map((k) => [k, s.offer[k]?.base ?? null, s.offer[k]?.name ?? null, s.offer[k]?.built ?? null, s.offer[k]?.layout ?? null, keysOf(s.offer[k]?.sizes)]),
    (Array.isArray(s.options?.extras) ? s.options.extras : []).map((x) => [x?.key, x?.built ?? null])]);
}
/* The saved price list with the draft's How it's built numbers: always
   valid, so it resolves even while a new size still has no price. */
function builtView(draft) {
  const s = structuredClone(S.saved.settings);
  for (const k of ["defaults", "palettes", "look"]) if (draft[k] !== undefined) s[k] = structuredClone(draft[k]);
  if (draft.built !== undefined) s.built = structuredClone(draft.built); else delete s.built;
  for (const k of keysOf(s.offer)) {
    const d = draft.offer?.[k];
    if (isObj(d) && d.built !== undefined) s.offer[k].built = structuredClone(d.built); else delete s.offer[k].built;
  }
  const dx = Array.isArray(draft.options?.extras) ? draft.options.extras : [];
  for (const x of Array.isArray(s.options?.extras) ? s.options.extras : []) {
    const d = dx.find((y) => y?.key === x.key);
    if (isObj(d) && d.built !== undefined) x.built = structuredClone(d.built); else delete x.built;
  }
  return s;
}
/* A new size needs a picture before its price is typed. These placeholder
   prices are only used to draw; prepare() still saves exactly the draft. */
function drawingDraft(draft) {
  const s = prepare(draft);
  for (const k of keysOf(s.offer)) for (const z of keysOf(s.offer[k]?.sizes)) {
    const p = s.offer[k].sizes[z];
    if (!(typeof p === "number" && Number.isFinite(p) && p > 0)) s.offer[k].sizes[z] = 1;
  }
  return s;
}
/* The catalogue (model/company.js resolve) for a draft, or null. */
export function catOf(draft) {
  return memo("cat|" + builtKey(draft), () => {
    try { return resolve(drawingDraft(draft), S.M, S.L); } catch { return resolve(builtView(draft), S.M, S.L); }
  });
}
/* The same with no How it's built number of the business's own. */
function stdOf(draft, BC) {
  return memo("std|" + builtKey(draft), () => {
    try { return resolve(BC.withoutOwnNumbers(prepare(draft)), S.M, S.L); } catch { return resolve(BC.withoutOwnNumbers(builtView(draft)), S.M, S.L); }
  });
}
/* The draft with nothing set on this style itself: what an empty box gives. */
function withoutStyle(draft, key) {
  const d = { ...draft, offer: { ...draft.offer } };
  if (isObj(d.offer[key])) { d.offer[key] = { ...d.offer[key] }; delete d.offer[key].built; }
  return d;
}
const checker = () => import("../../../../model/built-check.js");

/* "Standard: 6 1/2/12", "Built like the Utility Shed: 6/12" */
function sourceWords(e) {
  if (!e) return "";
  const f = e.from || "library";
  const v = e.words ? `: ${e.words}` : "";
  if (f === "style feature") return `This style's own (${e.feature})${v}`;
  if (f === "business-wide") return `Business-wide${v}`;
  if (/^built like /.test(f)) return `Built like the ${f.slice(11)}${v}`;
  if (f === "your construction settings") return `Your construction settings${v}`;
  if (f === "this style") return `This style's own${v}`;
  return `Standard${v}`;
}
const shown = (id, v) => (v === undefined ? "" : typeof v === "string" ? v : BUILT.format(id, v));
/* a barn roof height: "4 ft 3 in" */
function inWords(inches) { return BUILT.format("wallHeight", inches); }

function names(keys, offer) {
  const list = keys.map((k) => styleName(S.M, k, offer[k]));
  if (list.length <= 4) return list.length < 2 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return `${list.slice(0, 3).join(", ")} and ${list.length - 3} more`;
}

/* ---- the pieces ------------------------------------------------------------------- */

/* A box a number is typed in. onSet(number | words that cannot be read |
   undefined for an empty box). */
function textBox({ id, kind, label, value, placeholder, caption, hint, field, where, onSet }) {
  const iid = nextId("pl"), hid = nextId("pl");
  const box = h("input", { id: iid, type: "text", autocomplete: "off", spellcheck: false, placeholder: placeholder || "Standard",
    dataset: { field }, "aria-describedby": hid, class: "pl-built-input" });
  box.value = shown(id, value);
  box.addEventListener("input", () => {
    const t = box.value.trim();
    if (!t) return onSet(undefined);
    const r = BUILT.parse(id, t, { kind });
    onSet(r.problem ? t : r.value);
  });
  /* a number that reads well is written back the way a builder says it */
  box.addEventListener("change", () => {
    const t = box.value.trim();
    if (!t) return;
    const r = BUILT.parse(id, t, { kind });
    if (!r.problem && typeof r.value !== "object") box.value = BUILT.format(id, r.value);
  });
  return h("div", { class: "field pl-built-field" },
    h("label", { htmlFor: iid }, label), box,
    h("p", { class: "hint", id: hid }, hint, caption ? h("span", { class: "pl-built-from" }, caption) : null),
    msgs(where));
}

/* One box per width (the barn roof height). value: {"10": 48} or words. */
function widthBoxes({ label, widths, value, placeholderOf, caption, hint, field, where, onSet }) {
  const own = isObj(value) ? value : {};
  const hid = nextId("pl");
  const boxes = widths.map((w, i) => {
    const iid = nextId("pl");
    const box = h("input", { id: iid, type: "text", autocomplete: "off", spellcheck: false, placeholder: placeholderOf(w) || "Standard",
      dataset: { field: i === 0 ? field : `${field}:${w}` }, "aria-describedby": hid, class: "pl-built-input" });
    box.value = own[w] === undefined ? "" : typeof own[w] === "number" ? inWords(own[w]) : String(own[w]);
    box.addEventListener("input", () => {
      const map = { ...(isObj(value) ? value : {}) };
      const t = box.value.trim();
      if (!t) delete map[w];
      else {
        const r = BUILT.parse("barnPeak", { [w]: t });
        map[w] = r.problem ? t : r.value[w];
      }
      value = keysOf(map).length ? map : undefined;
      onSet(value);
    });
    box.addEventListener("change", () => {
      const t = box.value.trim();
      const r = t ? BUILT.parse("barnPeak", { [w]: t }) : null;
      if (r && !r.problem) box.value = inWords(r.value[w]);
    });
    return h("label", { class: "pl-built-width", htmlFor: iid }, h("span", {}, `${w} ft wide`), box);
  });
  return h("div", { class: "field pl-built-field pl-built-wide", role: "group", "aria-label": label },
    h("span", { class: "pl-label" }, label),
    h("div", { class: "pl-built-widths" }, boxes),
    h("p", { class: "hint", id: hid }, hint, caption ? h("span", { class: "pl-built-from" }, caption) : null),
    msgs(where));
}

/* Chips: [[value, words]], one pressed. */
function chipRow(label, items, pressed, onPick, { multi = false, fromStandard = false } = {}) {
  return h("div", { class: "pl-built-chips", role: "group", "aria-label": label },
    items.map(([v, words]) => h("button", {
      type: "button", class: ["pl-built-chip", fromStandard && v !== "std" && v !== "" && "std"], "aria-pressed": String(multi ? pressed.includes(v) : pressed === v),
      onclick: () => onPick(v),
    }, words)));
}

function dormerField({ value, caption, field, where, onSet }) {
  const items = [["", "Standard"], ["door", "Door side"], ["back", "Back side"]];
  const cur = value === "door" || value === "back" ? value : "";
  return h("div", { class: "field pl-built-field", dataset: { field } },
    h("span", { class: "pl-label" }, KNOB.dormerSide.Words),
    chipRow(KNOB.dormerSide.Words, items, cur, (v) => onSet(v || undefined)),
    h("p", { class: "hint" }, HINTS.dormerSide, caption ? h("span", { class: "pl-built-from" }, caption) : null),
    msgs(where));
}

/* Side porch lengths: the chips pressed are what customers get; tapping
   one starts this style's own list from them. */
function porchLengthsField({ value, fallback, caption, field, where, onSet }) {
  const own = Array.isArray(value) ? value : null;
  const list = own || fallback || [8, 12];
  const all = [...new Set([...PORCH_CHIPS, ...list.filter((n) => Number.isInteger(n))])].sort((a, b) => a - b);
  const items = [["std", "Standard"], ...all.map((n) => [n, `${n} ft`])];
  const pick = (v) => {
    if (v === "std") return onSet(undefined);
    const next = list.includes(v) ? list.filter((n) => n !== v) : [...list, v].sort((a, b) => a - b);
    onSet(fallback && JSON.stringify(next) === JSON.stringify(fallback) ? undefined : next);
  };
  const pressed = own ? own : ["std", ...list];
  return h("div", { class: "field pl-built-field pl-built-wide", dataset: { field } },
    h("span", { class: "pl-label" }, KNOB.sidePorchLengths.Words),
    chipRow(KNOB.sidePorchLengths.Words, items, pressed, pick, { multi: true, fromStandard: !own }),
    h("p", { class: "hint" }, HINTS.sidePorchLengths, caption ? h("span", { class: "pl-built-from" }, caption) : null),
    msgs(where));
}

/* ---- one style's own numbers (owner) ---------------------------------------- */

function setOwn(key, id, value) {
  const entry = S.draft.offer[key];
  if (!entry) return;
  if (value === undefined) {
    if (isObj(entry.built)) { delete entry.built[id]; if (!keysOf(entry.built).length) delete entry.built; }
  } else {
    if (!isObj(entry.built)) entry.built = {};
    entry.built[id] = value;
  }
  edited();
  staleChecks(key);
}

/* A check's answer is about the numbers it was run with: a new number
   clears it (one style, or every style for a business-wide number). */
function staleChecks(key) {
  const sel = key ? `[data-built="${CSS.escape(key)}"] .pl-built-result` : ".pl-built-result";
  for (const el of document.querySelectorAll(sel)) el.replaceChildren();
}

export function builtSection(key, entry) {
  const lib = roofOf(key, entry);
  const ids = BUILT.knobsFor(lib);
  if (!ids.length) return null;
  const kind = kindOf(key, entry);
  const fbCat = catOf(withoutStyle(S.draft, key));
  const fb = Object.fromEntries((fbCat ? BUILT.effective(fbCat, key) : []).map((e) => [e.id, e]));
  const own = isObj(entry.built) ? entry.built : {};
  const widths = [...new Set(sortSizes(keysOf(entry.sizes)).map((z) => sizeParts(z)[0]))].sort((a, b) => a - b);
  const field = (id) => `built:${key}:${id}`;
  const set = (id) => (v) => setOwn(key, id, v);
  const parts = [];
  for (const id of ids) {
    const K = KNOB[id], e = fb[id];
    if (id === "barnPeak") {
      const fbMap = isObj(e?.value) ? e.value : {};
      parts.push(widthBoxes({ label: K.Words, widths, value: own.barnPeak, placeholderOf: (w) => (fbMap[w] != null ? inWords(fbMap[w]) : ""),
        caption: e ? `${sourceWords({ ...e, words: "" })} in the empty boxes.` : "", hint: HINTS.barnPeak, field: field(id), where: field(id), onSet: set(id) }));
    } else if (id === "dormerSide") {
      parts.push(dormerField({ value: own.dormerSide, caption: sourceWords(e), field: field(id), where: field(id), onSet: set(id) }));
    } else if (id === "sidePorchLengths") {
      parts.push(porchLengthsField({ value: own.sidePorchLengths, fallback: Array.isArray(e?.value) ? e.value : null, caption: sourceWords(e), field: field(id), where: field(id), onSet: set(id) }));
    } else {
      const hint = id === "gableEndOverhang" && kind === "barn" ? `${HINTS[id]} ${BARN_END}` : HINTS[id];
      /* a barn's eave differs by width: the box says "1 3/4 to 2 1/8 in",
         the line under it each width */
      parts.push(textBox({ id, kind, label: K.Words, value: own[id], placeholder: e ? BUILT.shortWords(id, e.value) : "", caption: sourceWords(e), hint, field: field(id), where: field(id), onSet: set(id) }));
    }
  }
  const base = isObj(entry) && entry.base ? styleName(S.M, entry.base, S.draft.offer[entry.base]) : null;
  return h("section", { class: "pl-built", dataset: { built: key } },
    h("h3", { class: "pl-sub" }, "How it's built"),
    h("p", { class: "pl-built-intro" }, base
      ? `Leave a box empty to build it like the ${base}. A number typed here is for this style only.`
      : "Leave a box empty to build it the standard way. A number typed here is for this style only."),
    h("div", { class: "pl-built-grid" }, parts),
    msgs(`built:${key}`),
    checkRow(key));
}

/* "Check every size": the style drawn at every size it is sold in, with the
   numbers on the screen (saved or not), in this browser. */
function checkRow(key) {
  const out = h("div", { class: "pl-built-result", "aria-live": "polite" });
  const btn = button("Check every size", null, { icon: "check" });
  btn.addEventListener("click", async () => {
    const mine = S.problems.filter((p) => p.style === key && /^built:/.test(p.where || ""));
    if (mine.length) {
      clear(out, resultBox("bad", "Fix the boxes in red first, then check.", []));
      return;
    }
    btn.disabled = true;
    clear(out, h("p", { class: "pl-built-checking", role: "status" }, h("span", { class: "spinner", "aria-hidden": "true" }), "Drawing every size…"));
    await frame();
    try {
      const BC = await checker();
      const cat = catOf(S.draft), std = stdOf(S.draft, BC);
      if (!cat || !std || !cat.TYPES[key]) throw new Error("not ready");
      /* a size at a time, giving the page back between sizes: a style with
         many sizes never freezes the page */
      const r = await BC.checkInSteps(cat, std, key, { pause: frame });
      clear(out, resultOf(BC.summarize([r]), r));
    } catch {
      clear(out, resultBox("bad", "The check could not run. Reload the page and try again.", []));
    } finally {
      btn.disabled = false;
    }
  });
  return h("div", { class: "pl-built-check" },
    h("div", { class: "pl-built-check-row" }, btn,
      h("p", { class: "hint" }, "Draws this style at every size it is sold in, with the numbers above, and says what does not fit.")),
    out);
}

/* "the Utility Shed, Side Utility and Cabin" */
function andWords(names) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function resultBox(tone, title, lines) {
  return h("div", { class: ["pl-built-box", tone] },
    h("p", { class: "pl-built-box-title" }, icon(tone === "good" || tone === "note" ? "check" : "alert"), h("span", {}, title)),
    lines.length ? h("ul", {}, lines.map((l) => h("li", {}, l))) : null);
}

function resultOf(sum, r) {
  const out = [];
  if (sum.problems.length) out.push(resultBox("bad", "Change these numbers before you save. They do not fit at every size:", sum.problems));
  if (sum.warnings.length) out.push(resultBox("warn", "Worth a look:", sum.warnings));
  if (!sum.problems.length && !sum.warnings.length && sum.buildings) {
    out.push(resultBox("good", `Everything fits: ${plural(sum.buildings, "building")} drawn.`, []));
  }
  /* what the standard building has too, no worse: said, not hidden (review W10) */
  if (sum.alreadyWords && sum.alreadyWords.length) out.push(resultBox("note", "Already so in the standard building:", sum.alreadyWords));
  if (sum.unchecked.length) out.push(resultBox("warn", "Not checked:", sum.unchecked));
  return out;
}

/* ---- business-wide (owner) --------------------------------------------------------- */

const GROUPS = [
  ["Gable roofs", [["roofPitch", "gable"], ["eaveOverhang", "gable"], ["gableEndOverhang", "gable"]]],
  ["Barn roofs", [["barnPeak", null], ["eaveOverhang", "barn"], ["gableEndOverhang", "barn"]]],
  ["Lean-to roofs", [["roofPitch", "lean"], ["gableEndOverhang", "lean"]]],
  ["Single slope roofs", [["roofPitch", "slope"], ["gableEndOverhang", "slope"]]],
  ["Saltbox roofs", [["gableEndOverhang", "salt"]]],
  ["Wooden shop doors", [["doorHeight", "barn"], ["doorHeight", "other"]]],
  ["Porches", [["porchDepth", null], ["sidePorchLengths", null]]],
  ["Dormers", [["dormerSide", null]]],
];

function bizValue(id, kind) {
  const b = isObj(S.draft.built) ? S.draft.built : {};
  if (kind && Array.isArray(KNOB[id].business)) return isObj(b[id]) ? b[id][kind] : undefined;
  return b[id];
}
function setBiz(id, kind, value) {
  const d = S.draft;
  const byKind = kind && Array.isArray(KNOB[id].business);
  if (value === undefined) {
    if (isObj(d.built)) {
      if (byKind && isObj(d.built[id])) { delete d.built[id][kind]; if (!keysOf(d.built[id]).length) delete d.built[id]; }
      else if (!byKind) delete d.built[id];
      if (!keysOf(d.built).length) delete d.built;
    }
  } else {
    if (!isObj(d.built)) d.built = {};
    if (byKind) { if (!isObj(d.built[id])) d.built[id] = {}; d.built[id][kind] = value; }
    else d.built[id] = value;
  }
  edited();
  staleChecks(null);
}

function reachWords(reach, offer) {
  const out = [];
  if (reach.reaches.length) out.push(`Reaches the ${names(reach.reaches, offer)}.`);
  else out.push("Reaches no style right now.");
  if (reach.own.length) out.push(`${reach.own.length === 1 ? `The ${names(reach.own, offer)} has its` : `The ${names(reach.own, offer)} have their`} own.`);
  for (const k of reach.kept) out.push(`The ${styleName(S.M, k.key, offer[k.key])} keeps ${k.feature}.`);
  return out.join(" ");
}

/* "Built now: 5/12 on the Utility Shed, Side Utility and 3 more; about
   6 1/2/12 on the Cabin, Side Cabin and 3 more." -- "standard" is not one
   number (review W4) */
function nowWords(id, keys, offer) {
  if (id === "barnPeak" || !keys.length) return "";
  const cat = catOf(S.draft);
  if (!cat) return "";
  const list = [];
  for (const k of keys) {
    const e = BUILT.effective(cat, k).find((x) => x.id === id);
    if (e && e.words) list.push({ name: styleName(S.M, k, offer[k]), words: BUILT.shortWords(id, e.value) || e.words });
  }
  const groups = BUILT.groupByWords(list);
  return groups.length ? `Built now: ${groups.map((g) => `${g.words} on the ${BUILT.namesWords(g.names)}`).join("; ")}.` : "";
}

/* What a Barnwright visit sees in place of the business-wide boxes. */
export const VISIT_BIZ_WORDS = "Only the owner can change the numbers for every building. Each style's own numbers can be changed in that style, under How it's built.";

export function builtCard() {
  const d = S.draft;
  if (!keysOf(d.offer).length) return null;
  if (S.ctx?.app?.barnwright) return visitCard();
  const ready = prepare(d);
  const sections = [];
  for (const [title, list] of GROUPS) {
    const fields = [];
    for (const [id, kind] of list) {
      const reach = BUILT.businessReach(ready, S.M, id, kind || undefined);
      if (!reach.reaches.length && !reach.own.length) continue;
      const K = KNOB[id];
      const field = `built:biz:${id}${kind && Array.isArray(K.business) ? ":" + kind : ""}`;
      const label = id === "doorHeight" ? (kind === "barn" ? "On barn roofs" : "On every other roof") : K.Words;
      const caption = [reachWords(reach, d.offer), nowWords(id, reach.reaches, d.offer)].filter(Boolean).join(" ");
      const onSet = (v) => setBiz(id, kind, v);
      if (id === "barnPeak") {
        const keys = [...reach.reaches, ...reach.own];
        const widths = [...new Set(keys.flatMap((k) => keysOf(d.offer[k]?.sizes).map((z) => sizeParts(z)[0])))].sort((a, b) => a - b);
        fields.push(widthBoxes({ label, widths, value: bizValue(id), placeholderOf: () => "", caption, hint: HINTS.barnPeak, field, where: field, onSet }));
      } else if (id === "dormerSide") {
        fields.push(dormerField({ value: bizValue(id), caption, field, where: field, onSet }));
      } else if (id === "sidePorchLengths") {
        fields.push(porchLengthsField({ value: bizValue(id), fallback: null, caption, field, where: field, onSet }));
      } else {
        const hint = id === "gableEndOverhang" && kind === "barn" ? `${HINTS[id]} ${BARN_END}` : HINTS[id];
        fields.push(textBox({ id, kind: id === "doorHeight" ? undefined : kind || undefined, label, value: bizValue(id, kind), placeholder: "Standard", caption, hint, field, where: field, onSet }));
      }
    }
    if (fields.length) sections.push(h("div", { class: "pl-built-group" }, h("h3", { class: "pl-sub" }, title), h("div", { class: "pl-built-grid" }, fields)));
  }
  if (!sections.length) return null;
  return h("section", { class: "card pl-built-card", dataset: { flag: "built:biz" } },
    h("h2", { class: "card-title" }, "How your buildings are built"),
    h("p", { class: "pl-card-sub" }, "Numbers for every building you sell with that kind of roof. Leave a box empty for the standard. A number set on a style itself wins over these."),
    msgs("built:biz"),
    sections);
}

/* A Barnwright visit: the numbers for every building, said, never boxes
   (the lock refuses a change to them). */
function visitCard() {
  const lines = [];
  for (const [title, list] of GROUPS) {
    for (const [id, kind] of list) {
      const v = bizValue(id, kind);
      if (v === undefined || v === null || v === "") continue;
      const r = BUILT.parse(id, v, { kind: id === "doorHeight" ? undefined : kind || undefined });
      const words = r.value !== undefined ? BUILT.format(id, r.value) : String(v);
      const label = id === "doorHeight" ? (kind === "barn" ? "on barn roofs" : "on every other roof") : KNOB[id].words;
      lines.push(`${title}, ${label}: ${words}`);
    }
  }
  return h("section", { class: "card pl-built-card", dataset: { flag: "built:biz" } },
    h("h2", { class: "card-title" }, "How your buildings are built"),
    h("p", { class: "pl-card-sub", dataset: { visitBiz: "" } }, VISIT_BIZ_WORDS),
    lines.length ? h("ul", { class: "pl-built-lines" }, lines.map((l) => h("li", {}, l))) : h("p", { class: "pl-card-sub" }, "Every building is built to the standard."));
}

/* ---- notes at the top of the tab (owner) ------------------------------------------------ */

/* Numbers the 3D designer could not use, and what the quiet check found. */
export function builtNotes() {
  const box = h("div", { class: "pl-built-notes", dataset: { builtNotes: "" } });
  paintNotes(box);
  quietCheck();
  return box;
}

function paintNotes(box) {
  const cat = memo("saved|" + S.saved.version, () => resolve(S.saved.settings, S.M, S.L));
  const warnings = cat ? [...cat.settingsWarnings] : [];
  /* a door the shop standard puts in at some sizes that is not sold (the
     48 in Wooden Door of the 8x12 and 10x12 Side Utility, Dormer Shed and
     Side Lofted Barn): about a door, not a number, so it has its own
     heading */
  const doors = cat ? [...(cat.swapWarnings || [])] : [];
  /* an option's roof pitch a customer would pay for and get nothing (review W2) */
  let noChange = [];
  try { noChange = BUILT.extrasThatChangeNothing(S.saved.settings, S.M).map((m) => m.words); } catch { noChange = []; }
  const q = S.quiet && S.quiet.version === S.saved.version ? S.quiet : null;
  const lines = q ? q.lines : [];
  clear(box,
    warnings.length ? resultBox("warn", "These numbers cannot be used yet, so the 3D designer builds with another:", warnings) : null,
    doors.length ? resultBox("warn", "A door these buildings come with is not on your price list yet, so the 3D designer puts in another:", doors) : null,
    noChange.length ? resultBox("warn", "Options that change nothing on some buildings they are offered on. Take those buildings off the option on the Options tab:", noChange) : null,
    lines.length ? resultBox("warn", "Since the last update, your own building numbers do not fit everywhere. Change them in How it's built:", lines) : null,
    q && q.unchecked.length ? resultBox("warn", "Not checked yet. Open the style and press Check every size:", q.unchecked) : null);
}

/* When the price list opens: each style with numbers of the business's own
   is drawn at its sizes for up to about 1 1/2 s, a style at a time, so a
   change to the standard under those numbers is seen. Once per saved
   version. */
async function quietCheck() {
  if (!S.owner || !S.saved) return;
  const version = S.saved.version;
  if (S.quiet && S.quiet.version === version) return;
  S.quiet = { version, lines: [], unchecked: [], running: true };
  const q = S.quiet;
  try {
    const BC = await checker();
    const mine = keysOf(BC.ownNumbersOf(S.saved.settings, S.M));
    if (!mine.length) return;
    const cat = memo("saved|" + version, () => resolve(S.saved.settings, S.M, S.L));
    const std = memo("savedstd|" + version, () => resolve(BC.withoutOwnNumbers(S.saved.settings), S.M, S.L));
    if (!cat || !std) return;
    const t0 = performance.now(), budget = 1500, results = [];
    for (const key of mine) {
      await frame();
      if (S.quiet !== q) return;
      const left = Math.max(0, budget - (performance.now() - t0));
      results.push(BC.checkAgainstStandard(cat, std, key, { budgetMs: left }));
    }
    const sum = BC.summarize(results);
    q.lines = sum.problems;
    q.unchecked = sum.unchecked;
  } catch {
    /* the check is a help, never a reason the price list cannot open */
  } finally {
    q.running = false;
    const box = document.querySelector("[data-built-notes]");
    if (box && S.quiet === q) paintNotes(box);
  }
}

/* ---- after a save ----------------------------------------------------------------------- */

/* What the save's check said, and the 3D designer with the first style it
   checked (a lot's own designer shows the business's numbers). */
export function builtSaved(sizeCheck) {
  if (!sizeCheck || !(sizeCheck.checked?.length || sizeCheck.unchecked?.length || sizeCheck.problems?.length)) return null;
  const app = S.ctx?.app;
  const out = [];
  if (sizeCheck.checked?.length && !sizeCheck.unchecked?.length && !sizeCheck.problems?.length) {
    out.push(h("p", { class: "pl-built-saved-line" }, icon("check"), h("span", {}, `Every size of the ${andWords(sizeCheck.checked)} was drawn with your numbers and fits.`)));
  }
  if (sizeCheck.problems?.length) out.push(resultBox("warn", "These do not fit with the numbers you put back:", sizeCheck.problems));
  if (sizeCheck.warnings?.length) out.push(resultBox("warn", "Worth a look:", sizeCheck.warnings));
  if (sizeCheck.unchecked?.length) out.push(resultBox("warn", "Not checked yet:", sizeCheck.unchecked));
  const first = sizeCheck.styles?.[0];
  /* While the 3D designer is closed to customers (before it opens, a lot
     that is closed) or in a Barnwright visit, the link is the preview, as
     the closed banner's, the visit bar's and Lots' are: the closed page
     customers get would show nothing (review M1). The preview opens the
     design too. */
  const closed = !!app && (!!app.barnwright || app.business?.open === false);
  const lot = app && !app.demo ? app.openLots()[0] || (closed ? app.lots[0] : null) : null;
  if (first && lot) {
    const href = designLink(first.key, lot.slug, closed || lot.active === false);
    if (href) out.push(h("p", { class: "pl-built-saved-line" }, h("a", { class: "btn btn-ghost", href, target: "_blank", rel: "noopener" }, icon("cube"), h("span", {}, `See the ${first.name} in the 3D designer`))));
  }
  return out.length ? h("div", { class: "pl-built-saved" }, out) : null;
}

/* A link to a lot's 3D designer showing the style at the size the designer
   opens on for it; preview: the lot's preview instead (closed to
   customers). */
function designLink(key, slug, preview = false) {
  try {
    const cat = resolve(S.saved.settings, S.M, S.L);
    const sizes = keysOf(cat.P[key]);
    if (!sizes.length) return null;
    const d = fromState(defaults(cat), cat);
    d.type = key;
    d.size = sizes[Math.min(4, sizes.length - 1)];
    delete d.items;
    const design = fromState(toState(d, cat).state, cat);
    return `${preview ? S.ctx.app.previewUrl(slug) : S.ctx.app.designerUrl(slug)}#d=${encodeSync(design)}`;
  } catch {
    return null;
  }
}

/* ---- read only (managers and dealers) ------------------------------------------------------ */

export function builtLines(key) {
  const cat = memo("saved|" + S.saved.version, () => resolve(S.saved.settings, S.M, S.L));
  if (!cat || !cat.TYPES[key]) return null;
  const rows = [];
  for (const e of BUILT.effective(cat, key)) {
    if (!e.words) continue;
    /* the barn roof height, and a barn's eave, one line for each width */
    if (isObj(e.value) && (e.id === "barnPeak" || e.id === "eaveOverhang")) {
      for (const w of Object.keys(e.value).map(Number).sort((a, b) => a - b)) rows.push([`${KNOB[e.id].Words}, ${w} ft wide`, BUILT.format(e.id === "barnPeak" ? "wallHeight" : e.id, e.value[w])]);
    } else rows.push([KNOB[e.id].Words, e.words]);
  }
  if (!rows.length) return null;
  return h("details", { class: "pl-built-ro" },
    h("summary", {}, "How it's built"),
    h("ul", {}, rows.map(([what, value]) => h("li", {},
      h("span", { class: "pl-built-ro-what" }, what),
      h("span", { class: "pl-built-ro-value" }, value)))));
}
