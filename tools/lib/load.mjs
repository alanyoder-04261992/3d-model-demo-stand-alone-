/* READ A COMPANY'S SETTINGS FROM DISK (for the checks and the tools). Node only.

   The browser twin is ui/load.js; both follow the same steps:
     1. companies/<id>/company.json          (the company)
     2. library/manufacturers/<m>.json       (the builder it sells; a manufacturer
                                              file may "extends" another one, and
                                              the chain may not loop)
     3. library/construction.json            (the real-life construction defaults)
   then check everything (model/company.js validate) and turn it into one
   catalogue (resolve).

   Ids must be 2 to 40 lower-case letters, digits or dashes, so a file name
   can never climb out of its folder.

   loadCompany(id)          -> { company, manufacturer, library, catalogue, problems }
                               (catalogue is null when there are problems)
   loadCatalogue(id)        -> the catalogue, or throws listing the problems
   readManufacturer(id)     -> the manufacturer file, with any "extends" merged in
   readJSON(relativePath)   -> a parsed JSON file from the repo */

import { readFileSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, validateManufacturer, resolve, ID_RE } from "../../model/company.js";

export const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "../..");

export function readJSON(rel) {
  const file = resolvePath(ROOT, rel);
  let text;
  try { text = readFileSync(file, "utf8"); }
  catch (e) { throw new Error(`Could not read ${rel}: ${e.code === "ENOENT" ? "the file is not there" : e.message}.`); }
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`${rel} is not valid JSON (${e.message}).`); }
}

function checkId(id, what) {
  if (!ID_RE.test(String(id || ""))) throw new Error(`${what} id ${JSON.stringify(id)} is not allowed: use 2 to 40 lower-case letters, digits or dashes.`);
}

/* Merge a manufacturer onto the one it extends: the child's styles, items,
   options and palettes replace the parent's entry by entry. */
export function mergeManufacturer(parent, child) {
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

export function readManufacturer(id, reader = readJSON) {
  const seen = [];
  function load(mid) {
    checkId(mid, "The manufacturer");
    if (seen.indexOf(mid) >= 0) throw new Error(`The manufacturer files loop: ${seen.concat(mid).join(" extends ")}.`);
    seen.push(mid);
    const m = reader(`library/manufacturers/${mid}.json`);
    if (m.id !== mid) throw new Error(`library/manufacturers/${mid}.json says its id is ${JSON.stringify(m.id)}; it must be "${mid}".`);
    return m.extends ? mergeManufacturer(load(m.extends), m) : m;
  }
  return load(id);
}

export function loadCompany(id, opts = {}) {
  const reader = opts.reader || readJSON;
  const path = opts.path || null;
  let company;
  if (path) company = reader(path);
  else {
    checkId(id, "The company");
    company = reader(`companies/${id}/company.json`);
    if (company.id !== id) {
      return { company, manufacturer: null, library: null, catalogue: null,
        problems: [`companies/${id}/company.json says its id is ${JSON.stringify(company.id)}; it must be "${id}" (the folder name).`] };
    }
  }
  const manufacturer = readManufacturer(company.manufacturer, reader);
  const library = reader("library/construction.json");
  const problems = validateManufacturer(manufacturer).map((e) => "manufacturer file: " + e).concat(validate(company, manufacturer));
  const catalogue = problems.length ? null : resolve(company, manufacturer, library);
  return { company, manufacturer, library, catalogue, problems };
}

export function loadCatalogue(id, opts) {
  const r = loadCompany(id, opts);
  if (r.problems.length) throw new Error(`The settings for "${id}" have ${r.problems.length} problem(s):\n - ` + r.problems.join("\n - "));
  return r.catalogue;
}
