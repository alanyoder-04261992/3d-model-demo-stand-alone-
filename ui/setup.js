/* THE CONTACT SHEET (setup.html?company=<id>): every building a company
   offers, on one page, for Alan to screenshot or print and send to the
   company for sign-off before their designer goes live. Browser file.

   One tile per style and size the company's settings offer, in the order its
   categories list them. Each tile shows:
     * the building drawn with its STANDARD doors and windows (the ones the
       designer puts on it before the customer changes anything), in the
       company's default colours;
     * the size and the price the designer will show for it (model/pricing.js
       priceParts -- the same sum the price plate does);
     * what comes standard on it (the doors and windows, by the company's own
       names);
     * the size notes: the note the company's settings give a customer for
       that width (notes.sizeNotes), and the shop's construction note for it
       (library/construction.json notes), when there is one.
   The pictures are drawn only as the tiles come near the screen (a company
   with 160 sizes would otherwise keep a phone busy for a minute), one at a
   time, with ONE renderer for the whole page. "Draw every picture" draws the
   rest, and printing (the Print button, or the browser's own Print) draws
   anything still missing first.

   Every word from the company file goes through ui/esc.js. */

import { loadCompany } from "./load.js";
import { esc } from "./esc.js";
import { makePlan } from "../model/plan.js";
import { pSizes, priceParts, money } from "../model/pricing.js";
import { assemble } from "../engine/assemble.js";
import { snapshotCanvas } from "../engine/snapshot.js";
import { companyFromAddress, themePage, brandBadge, showProblems, makeRenderer, stateFor } from "./parts-gallery.js";

export const TILE_PIC = Object.freeze({ w: 360, h: 250 });

/* The styles in the company's category order; any style no category lists
   comes after, so nothing offered is ever left off the sheet. */
export function stylesInOrder(cat) {
  const out = [], seen = new Set();
  for (const c of cat.CATS || []) {
    const list = Array.isArray(c[1]) ? c[1] : String(c[1] || "").split(",");
    for (const raw of list) {
      const t = String(raw).trim();
      if (!t || seen.has(t) || !Object.prototype.hasOwnProperty.call(cat.TYPES, t)) continue;
      seen.add(t); out.push({ style: t, category: c[0] });
    }
  }
  for (const t of Object.keys(cat.TYPES)) if (!seen.has(t)) { seen.add(t); out.push({ style: t, category: "" }); }
  return out;
}

/* What the tile says about one style and size (no picture). */
export function tileFacts(cat, style, size) {
  const s = stateFor(cat, style, size);
  const plan = makePlan(s, cat);
  const pp = priceParts(s, cat);
  const counts = new Map();
  for (const it of s.items) {
    if (it.pk) continue;
    const c = cat.CAT[it.cat];
    const name = (c && (c.n || c.name)) || it.cat;
    counts.set(name, (counts.get(name) || 0) + (it.dbl ? 2 : 1));
  }
  const W = String(size).split("x")[0];
  const cn = plan.construction && plan.construction.notes;
  return {
    style, size, state: s, plan,
    name: cat.TYPES[style].name,
    total: pp.total,
    price: money(pp.total),
    standard: [...counts].map(([n, c]) => (c > 1 ? c + " × " : "") + n),
    note: (cat.notes && cat.notes.sizeNotes && cat.notes.sizeNotes[W]) || "",
    shopNote: (cn && typeof cn[W] === "string") ? cn[W] : "",
  };
}

const frameNow = () => new Promise((r) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

export async function startSetup() {
  const $ = (id) => document.getElementById(id);
  const out = { ready: false, tiles: [], drawn: 0, error: null, drawAll: null };
  window.contactSheet = out;
  const id = companyFromAddress();
  let loaded;
  try { loaded = await loadCompany(id); }
  catch (e) { showProblems($("cs-main"), "The contact sheet could not start", [e.message]); out.error = e.message; out.ready = true; return out; }
  if (loaded.problems.length) {
    showProblems($("cs-main"), `The settings for "${id}" need fixing before they can be signed off`, loaded.problems);
    out.error = loaded.problems.join("; "); out.ready = true; return out;
  }
  const cat = loaded.catalogue;
  themePage(cat);
  brandBadge($("cs-badge"), cat);
  const b = cat.brand || {};
  $("cs-company").textContent = b.name || id;
  document.title = "Contact sheet — " + (b.name || id);

  /* ---- the facts at the top ---- */
  const order = stylesInOrder(cat);
  let nSizes = 0;
  for (const o of order) nSizes += pSizes(o.style, cat).length;
  const today = new Date();
  const showWord = { price: "the price", from: "\"from\" the price", none: "no prices" }[(cat.pricing && cat.pricing.show) || "price"] || "the price";
  $("cs-facts").innerHTML =
    "<div><b>Company</b> " + esc(b.name || id) + " <span class=\"cs-code\">" + esc(id) + "</span></div>" +
    "<div><b>Builder</b> " + esc(cat.manufacturer || "") + "</div>" +
    "<div><b>Offers</b> " + order.length + " style" + (order.length === 1 ? "" : "s") + ", " + nSizes + " size" + (nSizes === 1 ? "" : "s") + "</div>" +
    "<div><b>Price list</b> version " + esc(cat.cfg) + " · the designer shows customers " + esc(showWord) + "</div>" +
    "<div><b>Phone</b> " + esc(b.phone || "—") + " · <b>E-mail</b> " + esc(b.email || "—") + "</div>" +
    "<div><b>Status</b> " + esc(cat.status || "active") + " · <b>Printed</b> " + esc(today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })) + "</div>";

  /* ---- the tiles ---- */
  const main = $("cs-sheet");
  let lastCat = null;
  for (const o of order) {
    if (o.category && o.category !== lastCat) {
      const h = document.createElement("h2"); h.className = "cs-cat"; h.textContent = o.category; main.appendChild(h);
      lastCat = o.category;
    }
    const sec = document.createElement("section");
    sec.className = "cs-style"; sec.setAttribute("data-style", o.style);
    sec.innerHTML = "<h3>" + esc(cat.TYPES[o.style].name) + ' <span class="cs-code">' + esc(o.style) + "</span></h3>";
    const grid = document.createElement("div"); grid.className = "cs-grid";
    sec.appendChild(grid);
    main.appendChild(sec);
    for (const size of pSizes(o.style, cat)) {
      let f;
      try { f = tileFacts(cat, o.style, size); }
      catch (e) {
        const bad = document.createElement("article"); bad.className = "cs-tile cs-failed";
        bad.innerHTML = "<div class=\"cs-body\"><h4>" + esc(size) + "</h4><p>This size could not be laid out: " + esc(e.message) + "</p></div>";
        grid.appendChild(bad);
        out.tiles.push({ style: o.style, size, price: null, drawn: false, failed: true, el: bad });
        continue;
      }
      const tile = document.createElement("article");
      tile.className = "cs-tile"; tile.setAttribute("data-style", o.style); tile.setAttribute("data-size", size);
      tile.innerHTML =
        '<div class="cs-pic"><img alt="' + esc(size.replace("x", " × ") + " " + f.name) + '" width="' + TILE_PIC.w + '" height="' + TILE_PIC.h + '"></div>' +
        '<div class="cs-body"><div class="cs-row"><h4>' + esc(size.replace("x", " × ")) + '</h4><span class="cs-price">' + esc(f.price) + "</span></div>" +
        '<p class="cs-std"><b>Standard:</b> ' + (f.standard.length ? f.standard.map(esc).join(", ") : "no doors or windows") + "</p>" +
        (f.note ? '<p class="cs-note"><b>Note:</b> ' + esc(f.note) + "</p>" : "") +
        (f.shopNote && f.shopNote !== f.note ? '<p class="cs-note"><b>Shop:</b> ' + esc(f.shopNote) + "</p>" : "") +
        "</div>";
      grid.appendChild(tile);
      out.tiles.push({ style: o.style, size, price: f.price, total: f.total, standard: f.standard, note: f.note, drawn: false, el: tile, facts: f });
    }
  }
  $("cs-count").textContent = out.tiles.length + " buildings";

  /* ---- drawing, as the tiles come into view ---- */
  let renderer = null;
  try { renderer = makeRenderer(cat); } catch (e) { renderer = null; }
  if (!renderer || renderer.off) {
    $("cs-status").textContent = "This browser cannot draw 3D pictures; everything else on the sheet is right.";
    out.error = "no WebGL"; out.ready = true; return out;
  }
  const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  function drawTile(t) {
    if (t.drawn || t.failed || !t.facts) return;
    t.drawn = true;
    try {
      const res = assemble(t.facts.plan, { viewport: TILE_PIC, fit: "fitref", frames: false });
      const c = snapshotCanvas(renderer, { result: res, size: TILE_PIC, dpr: dpr, cam: { yaw: 0.62, pitch: 0.215 }, background: "fog", restore: false });
      const img = t.el.querySelector("img");
      img.src = c.toDataURL("image/jpeg", 0.88);
      out.drawn++;
    } catch (e) {
      console.error(`${t.style} ${t.size} could not be drawn:`, e);
      t.el.classList.add("cs-failed");
      t.el.querySelector(".cs-pic").textContent = "This building could not be drawn.";
    }
    status();
  }
  function status() { $("cs-status").textContent = out.drawn + " of " + out.tiles.filter((t) => !t.failed).length + " pictures drawn"; }
  const queue = [];
  let pumping = false;
  async function pump() {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      const t = queue.shift();
      drawTile(t);
      await frameNow();
    }
    pumping = false;
  }
  function want(t) { if (!t.drawn && queue.indexOf(t) < 0) { queue.push(t); pump(); } }
  const byEl = new Map(out.tiles.map((t) => [t.el, t]));
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { const t = byEl.get(e.target); if (t) { want(t); io.unobserve(e.target); } }
    }, { rootMargin: "300px 0px" });
    out.tiles.forEach((t) => io.observe(t.el));
  } else out.tiles.forEach(want);

  /* everything, now (the button, printing) */
  async function drawAll() {
    let n = 0;
    for (const t of out.tiles) {
      if (t.drawn || t.failed) continue;
      const qi = queue.indexOf(t);
      if (qi >= 0) queue.splice(qi, 1);
      drawTile(t);
      if (++n % 3 === 0) await frameNow();          /* let the page breathe */
    }
    status();
    return out.drawn;
  }
  out.drawAll = drawAll;
  $("cs-drawall").onclick = async () => { $("cs-drawall").disabled = true; await drawAll(); $("cs-drawall").disabled = false; };
  $("cs-print").onclick = async () => { await drawAll(); window.print(); };
  /* the browser's own Print: whatever is left is drawn straight away */
  window.addEventListener("beforeprint", () => { for (const t of out.tiles) drawTile(t); });

  status();
  out.ready = true;
  document.body.setAttribute("data-ready", "1");
  return out;
}
