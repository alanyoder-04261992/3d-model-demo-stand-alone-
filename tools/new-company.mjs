/* SET UP A NEW COMPANY IN ONE COMMAND. Node 22, no dependencies.

     node tools/new-company.mjs --id acme --name "Acme Sheds" \
          --phone "(555) 010-0100" --email sales@acme.example \
          --styles UT,LB,G --from-csv acme-prices.csv

   It writes companies/acme/company.json -- the ONLY file a company needs --
   from the template (companies/_template/company.json), checks it the way
   the designer will, and then prints, in plain words, what is still to do.

   WHAT EACH OPTION DOES
     --id          the company's id: 2 to 40 lower-case letters, digits or
                   dashes. It is the folder name and the designer's address
                   (/c/acme/). Required.
     --name        the company's name, as the customer sees it. Required.
     --phone --email --website --tagline      shown on the designer and quotes
     --short       the name on the price plate (default: the name)
     --initials    the letters in the badge (default: from the name)
     --header --accent   the company's two colours, like "#2F4A3B"
     --styles      the building styles sold, by code (UT,LB,G) or name. May
                   be left out when --from-csv lists the styles.
     --from-csv    a spreadsheet of prices (see tools/import-prices.mjs:
                   style,size,price and item,price rows). Without one, every
                   style gets its standard sizes at a $1 PLACEHOLDER price, so
                   nothing looks believable until the real prices go in.
     --origins     the company's own websites allowed to show the designer
                   (https://acme.example,https://www.acme.example)
     --leads       where quote requests go: none, form, mailto, webhook,
                   postMessage (default: none -- a showroom)
     --leads-url   the form service's or webhook's address (form, webhook)
     --renews      the licence renewal date, 2027-09-01
     --force       replace a company that already exists

   It never guesses a price: anything the spreadsheet does not give stays at
   $1 and is listed under "still to do". Doors and windows a style comes with
   as standard are added to the list (they must have a price, even 0).
   Nothing is written when the result would not load; the problems are
   listed instead. */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, readJSON, readManufacturer } from "./lib/load.mjs";
import { validate, ID_RE, HEX_RE, LEAD_MODES, originProblem } from "../model/company.js";
import { readPriceRows, applyPrices, formatJson } from "./import-prices.mjs";

/* ------------------------------------------------------------------------ */

export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const eq = a.indexOf("=");
    const k = (eq > 0 ? a.slice(2, eq) : a.slice(2));
    if (eq > 0) o[k] = a.slice(eq + 1);
    else if (argv[i + 1] != null && !argv[i + 1].startsWith("--")) o[k] = argv[++i];
    else o[k] = true;
  }
  return o;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/* 2027-09-01 yes; 2027-13-45 no (it has the right shape, but no such day --
   list-companies would count the days to a date that does not exist) */
function realDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function initialsOf(name) {
  const w = String(name).split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x));
  const skip = /^(and|of|the|&)$/i;
  return w.filter((x) => !skip.test(x)).map((x) => x.replace(/[^A-Za-z0-9]/g, "")[0] || "").join("").slice(0, 3).toUpperCase() || "CO";
}

/* the standard sizes of a style: the demo company offers every standard
   style at every standard size (the sizes only -- never its prices) */
function standardSizes(k) {
  try { const d = readJSON("companies/demo/company.json"); return Object.keys(((d.offer || {})[k] || {}).sizes || {}); } catch (e) { return []; }
}

/* everything priced at the $1 placeholder, in plain words */
export function placeholders(c, manufacturer) {
  const out = [];
  const styles = manufacturer.styles || {}, items = manufacturer.items || {};
  for (const k of Object.keys(c.offer || {})) {
    if (k.startsWith("_")) continue;
    const zs = Object.keys((c.offer[k] || {}).sizes || {}).filter((z) => c.offer[k].sizes[z] === 1);
    if (zs.length) out.push(`${(styles[k] && styles[k].name) || k} (${k}): ${zs.length === Object.keys(c.offer[k].sizes).length ? "every size" : zs.length + " size" + (zs.length > 1 ? "s" : "")} -- ${zs.join(", ")}`);
  }
  const its = Object.keys(c.items || {}).filter((k) => !k.startsWith("_") && (c.items[k] === 1 || (c.items[k] && c.items[k].price === 1)));
  if (its.length) out.push("doors, windows and fixtures: " + its.map((k) => `${k} (${items[k] ? items[k].name : k})`).join(", "));
  const opts = [];
  for (const g of ["dormers", "ramps", "elec", "misc", "rates"]) {
    const grp = (c.options || {})[g];
    if (grp && typeof grp === "object") for (const id of Object.keys(grp)) if (!id.startsWith("_") && grp[id] === 1) opts.push(g + "." + id);
  }
  if (opts.length) out.push("upgrades: " + opts.join(", "));
  return out;
}

/* what else a person still has to decide, in plain words */
export function stillToDo(c, manufacturer) {
  const todo = [];
  const ph = placeholders(c, manufacturer);
  if (ph.length) todo.push("PRICES still at the $1 placeholder (they show as $1.00 until you set them -- put them in a spreadsheet and run node tools/import-prices.mjs companies/" + c.id + " prices.csv):\n      " + ph.join("\n      "));
  const b = c.brand || {};
  if (!b.phone) todo.push("No phone number (brand.phone): a customer whose quote does not go through is shown it.");
  if (!b.email) todo.push("No e-mail address (brand.email).");
  if (!b.website) todo.push("No website (brand.website).");
  if (!b.logo) todo.push("No logo (brand.logo): the badge shows the initials \"" + (b.initials || "") + "\" instead. Optional.");
  const L = c.leads || {};
  if (!L.mode || L.mode === "none") todo.push("Quote requests are switched OFF (leads.mode \"none\"): the designer is a showroom. To receive them set leads.mode to \"form\" (a form service like Formspree, with leads.url), \"mailto\", \"webhook\" or \"postMessage\".");
  else if ((L.mode === "form" || L.mode === "webhook") && /your-form-id|example/.test(String(L.url || ""))) todo.push(`leads.url "${L.url}" looks like a placeholder: paste the real address the form service gave the company.`);
  const E = c.embed || {};
  if (!(E.origins || []).length) todo.push("No website may show the designer inside its pages yet (embed.origins is empty). Add the company's site, like \"https://" + c.id + ".com\", then run node tools/build-headers.mjs.");
  else todo.push("After any change to embed.origins, run node tools/build-headers.mjs (it writes which websites may show the designer).");
  if (!((c.license || {}).renews)) todo.push("No licence renewal date (license.renews, like 2027-09-01).");
  todo.push(`Look at every building and its price: open setup.html?company=${c.id} (the contact sheet) and send it to the company to sign off.`);
  return todo;
}

/* ------------------------------------------------------------------------
   Make the company. -> { company, problems, notes } (nothing written) */
export function makeCompany(o, csvText) {
  const notes = [];
  const problems = [];
  const template = readJSON("companies/_template/company.json");
  const manufacturer = readManufacturer(template.manufacturer || "standard");
  const styles = manufacturer.styles || {};
  const id = String(o.id || "").trim();
  if (!ID_RE.test(id)) problems.push(`--id "${id}" is not allowed: use 2 to 40 lower-case letters, digits or dashes, like "acme-sheds".`);
  if (id.startsWith("_")) problems.push("--id may not start with _ (that is kept for the template).");
  const name = String(o.name || "").trim();
  if (!name) problems.push("--name is missing: the company's name, like --name \"Acme Sheds\".");
  for (const k of ["header", "accent"]) if (o[k] && !HEX_RE.test(String(o[k]))) problems.push(`--${k} "${o[k]}" is not a colour: write it like "#2F4A3B".`);
  if (o.leads && LEAD_MODES.indexOf(o.leads) < 0) problems.push(`--leads "${o.leads}" is not a way to receive quotes (use ${LEAD_MODES.join(", ")}).`);
  if (o.renews && !realDate(String(o.renews))) problems.push(`--renews "${o.renews}" must be a real date like 2027-09-01.`);
  const origins = o.origins ? String(o.origins).split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean) : [];
  for (const x of origins) { const p = originProblem(x); if (p) problems.push(`--origins: "${x}" ${p}.`); }

  /* the styles */
  const wanted = [];
  if (o.styles && o.styles !== true) {
    for (const w of String(o.styles).split(",").map((s) => s.trim()).filter(Boolean)) {
      let k = Object.prototype.hasOwnProperty.call(styles, w) ? w : Object.prototype.hasOwnProperty.call(styles, w.toUpperCase()) ? w.toUpperCase() : null;
      if (!k) for (const s of Object.keys(styles)) if (norm(styles[s].name) === norm(w)) k = s;
      if (!k) problems.push(`--styles: there is no style "${w}" (the styles are ${Object.keys(styles).map((s) => s + " " + styles[s].name).join(", ")}).`);
      else if (wanted.indexOf(k) < 0) wanted.push(k);
    }
  }
  let parsed = null;
  if (csvText != null) {
    parsed = readPriceRows(csvText, manufacturer, null);
    if (parsed.problems.length) problems.push(...parsed.problems.map((p) => "the spreadsheet, " + p));
    else for (const k of Object.keys(parsed.styles)) if (wanted.indexOf(k) < 0) { if (o.styles && o.styles !== true) notes.push(`the spreadsheet also prices the ${styles[k].name} (${k}), so it is offered too`); wanted.push(k); }
  }
  if (!wanted.length && !problems.length) problems.push("No building styles: give --styles UT,LB,G (or a spreadsheet with --from-csv).");
  if (problems.length) return { company: null, problems, notes, manufacturer };

  /* in the manufacturer's order, so the buttons come out in the usual order */
  const order = Object.keys(styles).filter((k) => wanted.indexOf(k) >= 0);

  const c = JSON.parse(JSON.stringify(template));
  c.id = id;
  c.status = "active";
  const b = c.brand;
  b.name = name;
  b.short = o.short ? String(o.short) : name.length <= 22 ? name : name.split(/\s+/).slice(0, 2).join(" ");
  b.initials = o.initials ? String(o.initials).toUpperCase().slice(0, 3) : initialsOf(name);
  b.tagline = o.tagline ? String(o.tagline) : b.tagline;
  b.phone = o.phone && o.phone !== true ? String(o.phone) : "";
  b.email = o.email && o.email !== true ? String(o.email) : "";
  b.website = o.website && o.website !== true ? String(o.website) : "";
  if (o.header || o.accent) b.colors = Object.assign({}, b.colors, o.header ? { header: String(o.header) } : {}, o.accent ? { accent: String(o.accent) } : {});

  const help = c.offer._help;
  c.offer = { _help: help };
  for (const k of order) {
    const zs = standardSizes(k);
    const sizes = {};
    for (const z of zs.length ? zs : ["10x16"]) sizes[z] = 1;
    c.offer[k] = { sizes };
  }
  const groups = [];
  for (const k of order) {
    const label = styles[k].category || "Buildings";
    let g = groups.find((x) => x[0] === label);
    if (!g) { g = [label, []]; groups.push(g); }
    g[1].push(k);
  }
  c.categories = groups;

  /* a dormer style needs a priced dormer */
  if (order.some((k) => styles[k].dormer)) {
    c.options.dormers = {};
    for (const d of Object.keys((manufacturer.options || {}).dormers || {})) c.options.dormers[d] = 1;
  }

  /* the prices from the spreadsheet */
  if (parsed) {
    const r = applyPrices(c, parsed, manufacturer, { bumpCfg: false });
    Object.assign(c, r.company);
  }

  /* where a new visitor starts */
  const st = order.indexOf("LB") >= 0 ? "LB" : order[0];
  const zs = Object.keys(c.offer[st].sizes);
  c.defaults.style = st;
  c.defaults.size = zs[Math.floor((zs.length - 1) / 2)];
  const pal = (g) => (c.palettes && Array.isArray(c.palettes[g]) ? c.palettes[g] : []).map((e) => (Array.isArray(e) ? e[0] : e));
  const body = styles[st].metal ? pal("metal") : pal("paint");
  c.defaults.colors = {
    body: body.indexOf("White") >= 0 ? "White" : body[0],
    trim: pal("trim").indexOf("Black") >= 0 ? "Black" : pal("trim")[0],
    roof: pal("metal").indexOf("Black") >= 0 ? "Black" : pal("metal")[0],
  };
  delete c.defaults.dormer;

  if (o.leads) c.leads.mode = o.leads;
  if (o["leads-url"] && o["leads-url"] !== true) c.leads.url = String(o["leads-url"]);
  if (origins.length) c.embed.origins = origins.map((x) => new URL(x).origin);
  if (o.renews) c.license.renews = String(o.renews);
  c.cfg = 1;

  /* every door and window a style comes with as standard needs a price: the
     check names each one it is missing, and each is added at the $1
     placeholder (listed under "still to do"), never at a guessed price */
  for (let round = 0; round < 3; round++) {
    const errs = validate(c, manufacturer);
    let added = 0;
    for (const e of errs) {
      const m = /^items\.([A-Za-z0-9_-]+) needs a price/.exec(e) || /so items\.([A-Za-z0-9_-]+) needs a price/.exec(e);
      if (m && !Object.prototype.hasOwnProperty.call(c.items, m[1])) { c.items[m[1]] = 1; added++; notes.push(`added ${m[1]} (${manufacturer.items[m[1]] ? manufacturer.items[m[1]].name : m[1]}) to the items: it comes as standard on one of the styles`); }
    }
    if (!added) break;
  }
  const left = validate(c, manufacturer);
  return { company: c, problems: left, notes, manufacturer };
}

/* ------------------------------------------------------------------------ */

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.id && !o.name) {
    console.log("Usage: node tools/new-company.mjs --id acme --name \"Acme Sheds\" --phone \"(555) 010-0100\" --email sales@acme.example --styles UT,LB,G [--from-csv prices.csv]");
    console.log("       (see the note at the top of tools/new-company.mjs for every option)");
    process.exitCode = 1; return;
  }
  const file = o.id ? resolvePath(ROOT, "companies", String(o.id), "company.json") : null;
  if (file && existsSync(file) && !o.force) {
    console.log(`FAIL: companies/${o.id}/company.json already exists. Pick another --id, or add --force to replace it.`);
    process.exitCode = 1; return;
  }
  let csvText = null;
  if (o["from-csv"]) {
    const p = resolvePath(process.cwd(), String(o["from-csv"]));
    if (!existsSync(p)) { console.log(`FAIL: there is no spreadsheet ${o["from-csv"]}.`); process.exitCode = 1; return; }
    csvText = readFileSync(p, "utf8");
  }
  const { company, problems, notes, manufacturer } = makeCompany(o, csvText);
  if (!company || problems.length) {
    console.log(`FAIL: companies/${o.id || "?"}/company.json was NOT written:`);
    for (const p of problems) console.log("  - " + p);
    process.exitCode = 1; return;
  }
  mkdirSync(resolvePath(ROOT, "companies", company.id), { recursive: true });
  writeFileSync(file, formatJson(company));
  const styles = manufacturer.styles;
  const offered = Object.keys(company.offer).filter((k) => !k.startsWith("_"));
  console.log(`Wrote companies/${company.id}/company.json for ${company.brand.name}.`);
  console.log(`  It checks out: the designer will load it (open index.html?company=${company.id}, or /c/${company.id}/ when hosted).`);
  console.log(`  Styles (${offered.length}): ${offered.map((k) => `${styles[k].name} (${k}, ${Object.keys(company.offer[k].sizes).length} sizes)`).join(", ")}`);
  for (const n of notes) console.log("  Note: " + n);
  const todo = stillToDo(company, manufacturer);
  console.log(`\nSTILL TO DO (${todo.length}):`);
  todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
