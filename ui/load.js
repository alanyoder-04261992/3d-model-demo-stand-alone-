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

/* A LOT'S 3D DESIGNER (/d/<lot>/). The Dealer Center's server answers
   GET api/lots/<lot> with the business's price list as it is right now (the
   one every lot shares) and the lot's own public details. The page never
   reads a company file for a lot, so a shared design cannot pick another
   business, another lot or other prices.

   What changes for a lot, compared with the price list on its own:
     brand.name    "<Business> — <Lot>" (the header and the page title)
     brand.phone / email / website   the lot's own, when it has them
     leads         mode "managed": the quote goes to the Dealer Center; the
                   form always asks for a name and a phone or an email
     embed         the lot's link (for shared designs) and its websites
     managed       what the quote form and the page need:
                     slug, lotId, lotName, lotPhone, businessName,
                     companyId, version, quoteUrl
                   Sentences that say who will answer ("Thanks, Bob! Yoder
                   Storage Barns has your design") use businessName, never
                   "<Business> — <Lot>" in the middle of a sentence.

   When the lot cannot be loaded, the Error says why for the console and
   carries .status (the server's answer, e.g. 404 for a closed lot; 0 when
   there was no answer at all). With settings problems, `lot` is returned
   too, so the page can still show the lot's phone number. */
export async function loadLot(slug, opts = {}) {
  checkId(slug, "The lot");
  const base = opts.base || ROOT;
  const data = await fetchLot(`api/lots/${slug}`, base);
  const company = data.company;
  const lot = data.lot || {};
  const [manufacturer, library] = await Promise.all([
    loadManufacturer(company.manufacturer, base), fetchJSON("library/construction.json", base),
  ]);
  const problems = validateManufacturer(manufacturer).concat(validate(company, manufacturer));
  if (problems.length) return { company, manufacturer, library, lot, catalogue: null, problems };
  const cat = resolve(company, manufacturer, library);
  const lotUrl = new URL(`d/${slug}/`, base).href;
  const fields = { ...cat.leads.fields, name: "required" };
  if (fields.phone === "off" && fields.email === "off") fields.email = "required";
  const lotName = String(lot.name || "");
  const catalogue = Object.freeze({ ...cat,
    brand: Object.freeze({ ...cat.brand, name: lotName ? `${cat.brand.name} — ${lotName}` : cat.brand.name,
      phone: lot.phone || cat.brand.phone, email: lot.email || cat.brand.email,
      website: lot.website || cat.brand.website }),
    leads: Object.freeze({ ...cat.leads, fields: Object.freeze(fields), mode: "managed", images: false }),
    embed: Object.freeze({ ...cat.embed, shareUrl: lotUrl, origins: lot.embedOrigins || [] }),
    managed: Object.freeze({
      slug, lotId: lot.id || slug, lotName, lotPhone: lot.phone || "",
      businessName: cat.brand.name || "", companyId: company.id, version: data.version,
      quoteUrl: new URL(`api/lots/${slug}/quote-requests`, base).href,
    }),
  });
  return { company, manufacturer, library, lot, catalogue, problems: [] };
}

/* GET api/lots/<lot>, keeping the server's answer code on the Error (a
   closed lot is 404) so the page can tell "closed" from "no connection". */
async function fetchLot(rel, base) {
  let r;
  try { r = await fetch(new URL(rel, base), { cache: "no-cache" }); }
  catch (e) { throw Object.assign(new Error(`Could not load ${rel} (no connection?).`), { status: 0 }); }
  if (!r.ok) throw Object.assign(new Error(`Could not load ${rel} (the server said ${r.status}).`), { status: r.status });
  let data;
  try { data = await r.json(); }
  catch (e) { throw Object.assign(new Error(`${rel} is not valid JSON.`), { status: r.status }); }
  if (!data || typeof data !== "object" || !data.company || typeof data.company !== "object") {
    throw Object.assign(new Error(`${rel} did not include the price list.`), { status: r.status });
  }
  return data;
}
