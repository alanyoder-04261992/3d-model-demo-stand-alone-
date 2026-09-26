/* LOAD A COMPANY'S SETTINGS IN THE BROWSER.

   The designer page calls loadCatalogue("acme") and gets back one catalogue
   (model/company.js resolve) built from three files it fetches from the same
   site:
     companies/<id>/company.json          the company
     library/manufacturers/<m>.json       the builder it sells (a manufacturer
                                          file may "extends" another; the chain
                                          may not loop)
     library/construction.json            the real-life construction defaults
   Everything is checked first; a problem comes back as a plain-English list,
   never as a half-working designer.

   Ids must be 2 to 40 lower-case letters, digits or dashes, so an address can
   never be steered to another folder. The files are found relative to this
   script's own address, so the designer works under /c/<id>/ as well.

   The Node twin used by the checks is tools/lib/load.mjs. */

import { validate, validateManufacturer, resolve, ID_RE } from "../model/company.js";

const ROOT = new URL("../", import.meta.url);

async function fetchJSON(rel, base) {
  const url = new URL(rel, base || ROOT);
  let r;
  try { r = await fetch(url, { cache: "no-cache" }); }
  catch (e) { throw new Error(`Could not load ${rel} (no connection?).`); }
  if (!r.ok) throw new Error(`Could not load ${rel} (the server said ${r.status}).`);
  try { return await r.json(); }
  catch (e) { throw new Error(`${rel} is not valid JSON.`); }
}

function checkId(id, what) {
  if (!ID_RE.test(String(id || ""))) throw new Error(`${what} id ${JSON.stringify(id)} is not allowed: use 2 to 40 lower-case letters, digits or dashes.`);
}

function mergeManufacturer(parent, child) {
  const out = Object.assign({}, parent, child);
  for (const k of ["styles", "items", "lists"]) out[k] = Object.assign({}, parent[k] || {}, child[k] || {});
  out.palettes = Object.assign({}, parent.palettes || {}, child.palettes || {});
  out.options = Object.assign({}, parent.options || {});
  for (const g of Object.keys(child.options || {})) {
    const a = (parent.options || {})[g], b = child.options[g];
    out.options[g] = (a && typeof a === "object" && !Array.isArray(a) && b && typeof b === "object" && !Array.isArray(b)) ? Object.assign({}, a, b) : b;
  }
  out.construction = Object.assign({}, parent.construction || {}, child.construction || {});
  delete out.extends;
  return out;
}

export async function loadManufacturer(id, base) {
  const seen = [];
  async function load(mid) {
    checkId(mid, "The manufacturer");
    if (seen.indexOf(mid) >= 0) throw new Error(`The manufacturer files loop: ${seen.concat(mid).join(" extends ")}.`);
    seen.push(mid);
    const m = await fetchJSON(`library/manufacturers/${mid}.json`, base);
    if (m.id !== mid) throw new Error(`library/manufacturers/${mid}.json says its id is ${JSON.stringify(m.id)}; it must be "${mid}".`);
    return m.extends ? mergeManufacturer(await load(m.extends), m) : m;
  }
  return load(id);
}

/* -> { company, manufacturer, library, catalogue, problems } */
export async function loadCompany(id, opts = {}) {
  checkId(id, "The company");
  const base = opts.base || ROOT;
  const company = await fetchJSON(`companies/${id}/company.json`, base);
  if (company.id !== id) {
    return { company, manufacturer: null, library: null, catalogue: null,
      problems: [`companies/${id}/company.json says its id is ${JSON.stringify(company.id)}; it must be "${id}".`] };
  }
  const [manufacturer, library] = await Promise.all([loadManufacturer(company.manufacturer, base), fetchJSON("library/construction.json", base)]);
  const problems = validateManufacturer(manufacturer).map((e) => "manufacturer file: " + e).concat(validate(company, manufacturer));
  const catalogue = problems.length ? null : resolve(company, manufacturer, library);
  return { company, manufacturer, library, catalogue, problems };
}

/* The catalogue, or an Error whose message lists every problem. */
export async function loadCatalogue(id, opts) {
  const r = await loadCompany(id, opts);
  if (r.problems.length) {
    const e = new Error(`The settings for "${id}" have ${r.problems.length} problem(s):\n - ` + r.problems.join("\n - "));
    e.problems = r.problems;
    throw e;
  }
  return r.catalogue;
}
