/* PUT A COMPANY'S PRICES IN FROM A SPREADSHEET, AND WRITE THEM BACK OUT.
   Node 22, no dependencies.

     node tools/import-prices.mjs companies/acme prices.csv
     node tools/import-prices.mjs companies/acme prices.csv --dry-run   (show, write nothing)
     node tools/import-prices.mjs companies/acme --export [out.csv]     (the prices, as a spreadsheet)

   A company's prices live in its settings file (companies/<id>/company.json).
   A dealer keeps them in a spreadsheet, so this reads a spreadsheet saved as
   CSV ("comma separated values" -- every spreadsheet program can save one).
   One price per row, in any order:

     style,size,price           a building:  UT,10x16,5190   or  Utility Shed,10 x 16,"$5,190"
     item,price                 a door, window or fixture:  w48,160   or  48 in Door,160
     option,price               an upgrade, as group.id:  ramps.r4,260  dormers.6,1250
                                elec.1,720  misc.shutter,80  rates.dbl,2.10 (per sq ft)

   A style can be written as its code (UT, LB, G ...) or its name; a size as
   10x16, 10 x 16 or 10'x16'; a price with or without $ and commas. Header
   rows ("style,size,price"), empty rows and rows starting with # are
   skipped, and anything in a column after the price (a note, a name) is
   ignored.

   WHAT HAPPENS
   * A style in the spreadsheet: its sizes are REPLACED by the spreadsheet's,
     in the spreadsheet's order (that is the order of the size buttons). A
     style not offered yet is added (and put in its group of buttons). A
     style offered but not in the spreadsheet is left exactly as it was.
   * An item or option: its price is set (it is offered from then on).
   * The file is checked before it is written. If the result would not load,
     nothing is written and the problems are listed in plain words.
   * cfg (the price-list number saved designs remember) goes up by one, so a
     design saved under the old prices can say its prices may have changed.
   --export writes every price in the same layout, with the style and item
   names in a column after the price, for the dealer to check.

   Also used by tools/new-company.mjs (--from-csv) and the checks, which
   import the functions below. */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve as resolvePath, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readManufacturer } from "./lib/load.mjs";
import { validate, SIZE_RE } from "../model/company.js";

export const OPTION_GROUPS = ["dormers", "ramps", "elec", "misc", "rates"];

/* ------------------------------------------------------------------------
   CSV: quoted cells, doubled quotes inside them, commas or semicolons. */
export function parseCsv(text) {
  const rows = [];
  const src = String(text).replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith("#")) || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  let row = [], cell = "", q = false, line = 1, rowLine = 1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else { if (ch === "\n") line++; cell += ch; }
      continue;
    }
    if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push({ line: rowLine, cells: row }); row = []; cell = ""; line++; rowLine = line;
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push({ line: rowLine, cells: row }); }
  return rows.map((r) => ({ line: r.line, cells: r.cells.map((c) => c.trim()) }));
}

function csvCell(v) {
  const s = String(v == null ? "" : v);
  return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function readPrice(s) {
  const t = String(s == null ? "" : s).replace(/[$\s]/g, "").replace(/,(?=\d{3}(\D|$))/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
export function readSize(s) {
  const t = String(s == null ? "" : s).toLowerCase().replace(/['′"″]|ft|feet/g, "").replace(/\s+/g, "").replace(/×/g, "x");
  return SIZE_RE.test(t) ? t.replace(/^0+(\d)/, "$1") : null;
}
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* ------------------------------------------------------------------------
   Turn the rows into prices, naming every row it cannot read. */
export function readPriceRows(text, manufacturer, company) {
  const styles = manufacturer.styles || {}, items = manufacturer.items || {};
  const offer = (company && company.offer) || {};
  const out = { styles: {}, items: {}, options: {}, problems: [], rows: 0 };
  const styleOf = (w) => {
    if (Object.prototype.hasOwnProperty.call(styles, w)) return w;
    const up = String(w).toUpperCase();
    if (Object.prototype.hasOwnProperty.call(styles, up)) return up;
    const n = norm(w);
    for (const k of Object.keys(styles)) if (norm(styles[k].name) === n || norm(k) === n) return k;
    for (const k of Object.keys(offer)) if (offer[k] && offer[k].name && norm(offer[k].name) === n) return k;
    return null;
  };
  const itemOf = (w) => {
    if (Object.prototype.hasOwnProperty.call(items, w)) return w;
    const n = norm(w);
    for (const k of Object.keys(items)) if (norm(k) === n || norm(items[k].name) === n) return k;
    return null;
  };
  for (const r of parseCsv(text)) {
    const c = r.cells.slice();
    if (!c.some((x) => x)) continue;
    if (c[0].startsWith("#")) continue;
    if (c.some((x) => /^price$/i.test(x)) && readPrice(c[1]) == null && readPrice(c[2]) == null) continue;   /* a header row */
    const at = `line ${r.line}`;
    const size = readSize(c[1]);
    if (size) {
      const k = styleOf(c[0]);
      const p = readPrice(c[2]);
      if (!k) { out.problems.push(`${at}: there is no building style called "${c[0]}" (the styles are ${Object.keys(styles).map((s) => s + " " + styles[s].name).join(", ")}).`); continue; }
      if (p == null || p <= 0) { out.problems.push(`${at}: the price of the ${styles[k].name} ${size} ("${c[2] || ""}") is not a number of dollars above 0.`); continue; }
      const list = (out.styles[k] = out.styles[k] || []);
      if (list.some((e) => e[0] === size)) { out.problems.push(`${at}: the ${styles[k].name} ${size} is in the spreadsheet twice.`); continue; }
      list.push([size, p]); out.rows++;
      continue;
    }
    const p = readPrice(c[1]);
    if (p == null) {
      out.problems.push(`${at}: could not read "${r.cells.join(",")}" -- a row is style,size,price or item,price (and "${c[1] || ""}" is not a size or a price).`);
      continue;
    }
    const dot = /^([a-z]+)\.([A-Za-z0-9_-]+)$/.exec(c[0]);
    if (dot && OPTION_GROUPS.indexOf(dot[1]) >= 0) {
      const g = dot[1], id = dot[2];
      const mo = (manufacturer.options || {})[g] || {};
      if (!Object.prototype.hasOwnProperty.call(mo, id)) { out.problems.push(`${at}: there is no ${g} option "${id}" (there are ${Object.keys(mo).join(", ") || "none"}).`); continue; }
      (out.options[g] = out.options[g] || {})[id] = p; out.rows++;
      continue;
    }
    const k = itemOf(c[0]);
    if (!k) { out.problems.push(`${at}: there is no item called "${c[0]}" (the items are ${Object.keys(items).join(", ")}; an upgrade is written like ramps.r4).`); continue; }
    out.items[k] = p; out.rows++;
  }
  return out;
}

/* ------------------------------------------------------------------------
   Put them into a company (a copy); say what changed. */
export function applyPrices(company, parsed, manufacturer, opts) {
  opts = opts || {};
  const c = JSON.parse(JSON.stringify(company));
  const styles = manufacturer.styles || {};
  const changes = [];
  c.offer = c.offer || {};
  for (const k of Object.keys(parsed.styles)) {
    const sizes = {};
    for (const [z, p] of parsed.styles[k]) sizes[z] = p;
    const before = c.offer[k] ? JSON.stringify(c.offer[k].sizes) : null;
    if (!c.offer[k]) {
      c.offer[k] = { sizes: sizes };
      changes.push(`added the ${styles[k].name} (${k}) with ${Object.keys(sizes).length} sizes`);
      if (Array.isArray(c.categories)) {
        const label = styles[k].category || "Buildings";
        let g = c.categories.find((x) => Array.isArray(x) && x[0] === label);
        if (!g) { g = [label, []]; c.categories.push(g); }
        if (g[1].indexOf(k) < 0) g[1].push(k);
      }
    } else {
      c.offer[k].sizes = sizes;
      if (before !== JSON.stringify(sizes)) changes.push(`${styles[k].name} (${k}): ${Object.keys(sizes).length} sizes, prices from the spreadsheet`);
    }
  }
  c.items = c.items || {};
  for (const k of Object.keys(parsed.items)) {
    const p = parsed.items[k];
    const cur = c.items[k];
    const old = cur && typeof cur === "object" ? cur.price : cur;
    if (old === p) continue;
    if (cur && typeof cur === "object" && !Array.isArray(cur)) cur.price = p; else c.items[k] = p;
    changes.push(`item ${k}: ${old == null ? "now offered at" : "$" + old + " ->"} $${p}`);
  }
  c.options = c.options || {};
  for (const g of Object.keys(parsed.options)) {
    c.options[g] = c.options[g] && typeof c.options[g] === "object" ? c.options[g] : {};
    for (const id of Object.keys(parsed.options[g])) {
      const old = c.options[g][id], p = parsed.options[g][id];
      if (old === p) continue;
      c.options[g][id] = p;
      changes.push(`option ${g}.${id}: ${old == null ? "now offered at" : "$" + old + " ->"} $${p}`);
    }
  }
  /* the building a new visitor starts on must still exist */
  if (c.defaults && c.defaults.style && c.offer[c.defaults.style]) {
    const zs = Object.keys(c.offer[c.defaults.style].sizes || {});
    if (c.defaults.size && zs.indexOf(c.defaults.size) < 0 && zs.length) {
      const nz = zs[Math.floor((zs.length - 1) / 2)];
      changes.push(`the starting building's size ${c.defaults.size} is no longer sold, so a new visitor now starts on ${nz}`);
      c.defaults.size = nz;
    }
  }
  if (changes.length && opts.bumpCfg !== false) c.cfg = (Number(c.cfg) || 0) + 1;
  return { company: c, changes };
}

/* ------------------------------------------------------------------------
   The prices as a spreadsheet. */
export function exportCsv(company, manufacturer) {
  const styles = manufacturer.styles || {}, items = manufacturer.items || {};
  const L = [];
  L.push(`# Prices for ${company.brand && company.brand.name || company.id} (companies/${company.id}/company.json)`);
  L.push("# Edit the price column and read it back with: node tools/import-prices.mjs companies/" + company.id + " <this file>");
  L.push("style,size,price,name");
  for (const k of Object.keys(company.offer || {})) {
    const o = company.offer[k] || {};
    const name = o.name || (styles[k] && styles[k].name) || k;
    for (const z of Object.keys(o.sizes || {})) L.push([k, z, o.sizes[z], name].map(csvCell).join(","));
  }
  L.push("item,price,name");
  for (const k of Object.keys(company.items || {})) {
    if (k.startsWith("_")) continue;
    const v = company.items[k];
    const p = v && typeof v === "object" ? v.price : v;
    L.push([k, p, (v && typeof v === "object" && v.name) || (items[k] && items[k].name) || k].map(csvCell).join(","));
  }
  L.push("option,price,name");
  const mo = manufacturer.options || {};
  for (const g of OPTION_GROUPS) {
    const grp = (company.options || {})[g];
    if (!grp || typeof grp !== "object") continue;
    for (const id of Object.keys(grp)) {
      if (id.startsWith("_")) continue;
      const m = mo[g] && mo[g][id];
      const name = (m && (m.name || m.label)) || (g === "rates" ? id + " (per sq ft)" : id);
      L.push([g + "." + id, grp[id], name].map(csvCell).join(","));
    }
  }
  return L.join("\n") + "\n";
}

/* ------------------------------------------------------------------------
   Writing a settings file the way the others are written: two-space
   indents, and anything short kept on one line. */
export function formatJson(value) {
  const WIDTH = 120;
  function inline(v) {
    if (Array.isArray(v)) return "[" + v.map(inline).join(", ") + "]";
    if (v && typeof v === "object") { const ks = Object.keys(v); return ks.length ? "{" + ks.map((k) => JSON.stringify(k) + ": " + inline(v[k])).join(", ") + "}" : "{}"; }
    return JSON.stringify(v);
  }
  function out(v, ind, prefixLen) {
    if (!v || typeof v !== "object") return JSON.stringify(v);
    const one = inline(v);
    if (ind > 0 && ind + prefixLen + one.length <= WIDTH && !/"_help/.test(one)) return one;
    const pad = "  ".repeat(ind + 1), end = "  ".repeat(ind);
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[\n" + v.map((x) => pad + out(x, ind + 1, 0)).join(",\n") + "\n" + end + "]";
    }
    const ks = Object.keys(v);
    if (!ks.length) return "{}";
    return "{\n" + ks.map((k) => { const kk = JSON.stringify(k) + ": "; return pad + kk + out(v[k], ind + 1, kk.length); }).join(",\n") + "\n" + end + "}";
  }
  return out(value, 0, 0) + "\n";
}

/* ------------------------------------------------------------------------ */

function folderOf(arg) {
  const s = String(arg || "").replace(/\/+$/, "");
  const id = /^companies\//.test(s) ? s.split("/")[1] : basename(s);
  return id;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const pos = args.filter((a) => !a.startsWith("--"));
  if (!pos.length) {
    console.log("Usage: node tools/import-prices.mjs companies/<id> prices.csv [--dry-run]");
    console.log("       node tools/import-prices.mjs companies/<id> --export [out.csv]");
    process.exitCode = 1; return;
  }
  const id = folderOf(pos[0]);
  const file = resolvePath(ROOT, "companies", id, "company.json");
  if (!/^[a-z0-9-]{2,40}$/.test(id) || !existsSync(file)) { console.log(`FAIL: there is no company "${id}" (no companies/${id}/company.json).`); process.exitCode = 1; return; }
  const company = JSON.parse(readFileSync(file, "utf8"));
  const manufacturer = readManufacturer(company.manufacturer || "standard");

  if (flags.has("--export")) {
    const text = exportCsv(company, manufacturer);
    if (pos[1]) { writeFileSync(resolvePath(process.cwd(), pos[1]), text); console.log(`Wrote the prices of ${id} to ${pos[1]} (${text.split("\n").length - 1} lines).`); }
    else process.stdout.write(text);
    return;
  }
  if (!pos[1]) { console.log("FAIL: which spreadsheet? node tools/import-prices.mjs companies/" + id + " prices.csv"); process.exitCode = 1; return; }
  const csvPath = resolvePath(process.cwd(), pos[1]);
  if (!existsSync(csvPath)) { console.log(`FAIL: there is no file ${pos[1]}.`); process.exitCode = 1; return; }
  const parsed = readPriceRows(readFileSync(csvPath, "utf8"), manufacturer, company);
  if (parsed.problems.length) {
    console.log(`FAIL: ${parsed.problems.length} row(s) of ${pos[1]} could not be read, so nothing was changed:`);
    for (const p of parsed.problems) console.log("  - " + p);
    process.exitCode = 1; return;
  }
  const { company: next, changes } = applyPrices(company, parsed, manufacturer);
  if (!changes.length) { console.log(`Nothing to change: the ${parsed.rows} prices in ${pos[1]} are already in companies/${id}/company.json.`); return; }
  const problems = validate(next, manufacturer);
  if (problems.length) {
    console.log(`FAIL: with these prices companies/${id}/company.json would not load, so it was NOT changed:`);
    for (const p of problems) console.log("  - " + p);
    process.exitCode = 1; return;
  }
  console.log(`${flags.has("--dry-run") ? "Would change" : "Changed"} companies/${id}/company.json (${parsed.rows} prices read):`);
  for (const ch of changes) console.log("  - " + ch);
  if (flags.has("--dry-run")) { console.log("(--dry-run: nothing was written)"); return; }
  writeFileSync(file, formatJson(next));
  console.log(`Saved. The price-list number (cfg) is now ${next.cfg}, so a design saved before today will say its prices may have changed.`);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
