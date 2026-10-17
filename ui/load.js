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
   too, so the page can still show the lot's phone number.

   opts.preview: "team" or "barnwright" -- the lot's 3D designer while it
   is closed, for the team signed in to the Dealer Center or a Barnwright
   visit (/d/<lot>/?preview=1 or ?preview=barnwright). The server checks who
   asks (GET api/office/lots/<lot>/preview, or .../barnwright/lots/...);
   the catalogue is marked managed.preview, and has no address to send a
   quote to: a preview never takes a quote. */
export async function loadLot(slug, opts = {}) {
  checkId(slug, "The lot");
  const base = opts.base || ROOT;
  if (opts.savedQuote) {
    if (!/^[A-Za-z0-9]{8,24}\/[A-Za-z0-9]{8,24}$/.test(opts.savedQuote)) throw new Error("Open the original building from its quote or order in the Dealer Center.");
    let response;
    try { response = await fetch(new URL(`api/office/customers/${opts.savedQuote.replace("/", "/quotes/")}/designer`, base), { cache: "no-store", credentials: "same-origin" }); }
    catch { throw Object.assign(new Error("The original building couldn't load. Check your connection and try again."), { status: 0 }); }
    const data = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(data?.error || "The original building couldn't load. Open it again from the Dealer Center."), { status: response.status });
    if (!data?.historical || data.lot?.slug !== slug || !data.catalogue?.TYPES?.[data.design?.type]
      || data.catalogue.cfg !== data.design?.cfg) throw Object.assign(new Error("The original building details could not be read. Ask Barnwright to check this quote."), { status: 409 });
    const cat = data.catalogue;
    return { catalogue: Object.freeze({ ...cat, status: "active",
      leads: Object.freeze({ ...cat.leads, mode: "none", url: "" }),
      managed: Object.freeze({ slug, lotName: data.lot.name || "", businessName: cat.brand.name || "", companyId: cat.id, quoteUrl: null, historical: true, savedQuote: opts.savedQuote,
        /* the price the quote was saved with (ui/panels.js savedPriceOf) */
        savedPrice: savedPriceFrom(data) }),
    }), lot: data.lot, savedDesign: data.design, problems: [] };
  }
  const preview = opts.preview === "team" || opts.preview === "barnwright" ? opts.preview : null;
  const data = await fetchLot(preview === "barnwright" ? `api/office/barnwright/lots/${slug}/preview`
    : preview ? `api/office/lots/${slug}/preview` : `api/lots/${slug}`, base);
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
      quoteUrl: preview ? null : new URL(`api/lots/${slug}/quote-requests`, base).href,
      /* previewer: who is looking, "team" or "barnwright" (the bar's words) */
      ...(preview ? { preview: true, previewer: preview, closed: data.closed === "lot" ? "lot" : "business" } : {}),
    }),
  });
  return { company, manufacturer, library, lot, catalogue, problems: [] };
}

/* AN OLDER DESIGN'S OWN PRICE LIST (review 17 FREE-2). A design link made
   before the owner changed a standard layout is compared by the server
   with that older price list's standard (server/office/pricing.js,
   model/pricing.js includedAllowance). So the
   page shows the same total, it asks the lot for that version
   (GET api/lots/<lot>?cfg=<the design's version>); the server answers with
   its own kept copy, or nothing. -> the catalogue with olderIncluded (that
   copy, resolved the way the server resolves it), or the catalogue as it
   was. Never throws: without the copy the page and the server both use
   today's counts (model/design.js fromState then saves today's version). */
export async function withOlderList(loaded, slug, design, opts = {}) {
  const cat = loaded && loaded.catalogue;
  const cfg = design && design.cfg;
  if (!cat || !cat.managed || cat.managed.historical || cat.managed.preview || !loaded.manufacturer || !loaded.library) return cat;
  if (!Number.isSafeInteger(cfg) || cfg < 1 || !(cfg < cat.cfg) || design.company !== cat.id) return cat;
  try {
    const data = await fetchLot(`api/lots/${slug}?cfg=${cfg}`, opts.base || ROOT);
    const inc = data && data.included;
    if (!inc || inc.cfg !== cfg || !inc.company || typeof inc.company !== "object") return cat;
    const older = resolve(inc.company, loaded.manufacturer, loaded.library);
    if (older.id !== cat.id || older.cfg !== cfg) return cat;
    return Object.freeze({ ...cat, olderIncluded: older });
  } catch (e) {
    console.error("The older price list for this design could not be read:", e.message);
    return cat;
  }
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

/* A saved quote's price from the Dealer Center: {base, lines, total} with
   the stored total, or null (an older answer without it). */
function savedPriceFrom(data) {
  const p = data && data.price;
  if (!p || typeof p !== "object" || typeof p.total !== "number" || !isFinite(p.total) || !Array.isArray(p.lines)) return null;
  if (typeof data.total === "number" && data.total !== p.total) return null;
  return Object.freeze({ base: +p.base || 0, lines: p.lines.filter((l) => Array.isArray(l) && typeof l[0] === "string" && typeof l[1] === "number"), total: p.total });
}
