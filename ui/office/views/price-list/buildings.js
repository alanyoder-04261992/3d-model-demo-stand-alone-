/* YOUR BUILDINGS: the owner's picture cards. Managers and dealers keep
   the price sheet below. Every edit uses the price list's shared draft. */

import { h, clear, button, icon, dialog, toast, nextId } from "../../dom.js";
import { money, size, plural } from "../../words.js";
import { S, edited } from "./state.js";
import { keysOf, sortSizes, fromPrice, missingPrices, styleName, displayGroups, groupsOf, nameKey, baseOf, openingStyle } from "./model.js";
import { msgs } from "./bits.js";
import { builtNotes, builtLines, catOf } from "./built.js";
import { picture } from "./pictures.js";
import { buildingPage, setSold } from "./building-page.js";
import { addBuildingPage } from "./add-building.js";
import { builtCard } from "./built.js";

export async function buildingsTab() {
  if (!S.draft) return priceSheet();
  if (S.sub.page === "building") return buildingPage(S.sub.key);
  if (S.sub.page === "add") return addBuildingPage();
  if (S.sub.page === "built") return h("div", { class: "pl-tab stack" },
    backToBuildings(), h("div", {}, h("h2", { class: "pl-page-title" }, "How all your buildings are built"),
      h("p", { class: "muted" }, "Set a number once for every building with that kind of roof. A building's own numbers still come first.")), builtNotes(), builtCard());
  return cardsView();
}

export function backToBuildings() {
  return button("Your buildings", () => S.ctx.go("/price-list"), { kind: "link", icon: "arrowLeft" });
}

function cardsView() {
  const d = S.draft;
  const groups = displayGroups(d, S.saved.settings, S.M, S.parked.offer);
  const sold = keysOf(d.offer);
  const count = sold.reduce((n, k) => n + keysOf(d.offer[k].sizes).length, 0);
  const cat = catOf(d);
  return h("div", { class: "pl-tab stack pl-building-list" },
    h("div", { class: "pl-toolbar" },
      h("div", {}, h("h2", { class: "pl-page-title" }, "Your buildings"),
        h("p", { class: "pl-toolbar-words" }, h("strong", {}, plural(sold.length, "building")), ` in ${plural(count, "size")}. Tap Edit to change one.`)),
      h("div", { class: "actions" }, button("Change prices", openChangePrices, { icon: "dollar" }),
        button("Add a building", () => S.ctx.go("/price-list/add-building"), { kind: "primary", icon: "plus" }))),
    h("p", { class: "pl-picture-note" }, "Pictures show each building as your 3D designer opens it, with your colors and your building numbers. Change colors on the Colors tab."),
    msgs("buildings"), builtNotes(),
    groups.map(([label, keys]) => h("section", { class: "pl-building-group", dataset: { group: label } },
      h("h3", { class: "pl-group-title" }, label),
      h("div", { class: "pl-building-cards" }, keys.map((key) => buildingCard(key, cat))))),
    h("section", { class: "card pl-all-built" },
      h("div", {}, h("h2", { class: "card-title" }, "How all your buildings are built"),
        h("p", { class: "muted" }, "Set a roof pitch, wall height or overhang once for every building with that kind of roof.")),
      button("Set numbers for all", () => S.ctx.go("/price-list/how-its-built"))));
}

function buildingCard(key, cat) {
  const sold = key in S.draft.offer;
  const entry = sold ? S.draft.offer[key] : S.parked.offer[key];
  const name = styleName(S.M, key, entry);
  const n = keysOf(entry.sizes).length, from = fromPrice(entry.sizes), missing = missingPrices(entry.sizes);
  const changed = JSON.stringify(entry) !== JSON.stringify(S.saved.settings.offer?.[key]);
  const contents = [picture(key, { cat: sold ? cat : null, M: S.M, base: baseOf(key, entry), name }),
    h("div", { class: "pl-card-info" },
      h("h4", { class: "pl-card-name" }, name, h("span", { class: "pl-flag-dot", title: "Something to fix" })),
      entry.base ? h("p", { class: "pl-card-version" }, `Your version of the ${S.M.styles[entry.base]?.name || entry.base}`) : null,
      h("p", { class: "pl-card-meta" }, plural(n, "size"), from != null ? ` · from ${money(from)}` : ""),
      missing ? h("p", { class: "pl-miss" }, `${missing} missing a price`) : null,
      h("div", { class: "pl-card-chips" },
        sold && openingStyle(S.draft) === key ? h("span", { class: "pl-card-chip" }, "Opens first") : null,
        sold && changed ? h("span", { class: "pl-card-chip pending" }, "Not saved yet") : null),
      !sold ? h("p", { class: "pl-card-meta" }, "Stopped, not saved yet.", entry.base ? " It goes away when you save." : "") : null,
      sold ? h("span", { class: "btn btn-ghost pl-card-edit" }, icon("edit"), "Edit")
        : button("Sell it again", () => setSold(key, true), { icon: "undo" }))];
  const card = h(sold ? "a" : "article", { class: ["pl-card", !sold && "off"],
    href: sold ? `#/price-list/building/${key}` : null,
    dataset: { flag: `style:${key}`, style: key }, "aria-label": sold ? `Edit the ${name}` : null }, contents);
  if (sold) card.addEventListener("click", () => { S.listScroll = window.scrollY; });
  return card;
}

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
        h("ul", { class: "pl-sheet-rows" }, rows),
        builtLines(k));
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
