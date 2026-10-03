/* LOTS: the places that sell the buildings.

   A lot is lots/<slug>: its name, address, phone, email, hours, website and
   the websites allowed to show its 3D designer. Prices are NOT here -- every
   lot uses the one price list -- so a lot record never needs to change when
   prices do. The slug is the lot's part of its designer link
   (/d/port-charlotte/) and never changes; renaming a lot keeps its link.

   A lot is never deleted, only closed: its link stops working and its
   customers and orders stay. */

import { fail, text, email, phone, bool, onlyKeys } from "./http.js";

const LOT_FIELDS = ["name", "slug", "address", "city", "state", "zip", "phone", "email", "hours", "website", "embedOrigins", "active"];
const SLUG_RE = /^[a-z0-9-]{2,40}$/;

export function slugFrom(name) {
  return String(name).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

/* "mysite.com", "https://www.mysite.com/page" -> "https://mysite.com",
   "https://www.mysite.com". Only the site itself, never a path or "*". */
export function websiteOrigin(value) {
  let s = String(value || "").trim();
  if (!s) return "";
  if (s.includes("*")) fail(422, `"${s}" has a * in it. List each website in full, like https://mysite.com.`);
  if (!/^[a-z]+:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch { fail(422, `"${value}" is not a website address.`); }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(local && u.protocol === "http:")) fail(422, `"${value}" must start with https://.`);
  if (u.username || u.password || !/^[a-z0-9.-]+$/i.test(u.hostname) || !u.hostname.includes(".") && !local) {
    fail(422, `"${value}" is not a website address.`);
  }
  return u.origin.toLowerCase();
}

/* A lot's (or the business's) own website: "mysite.com" -> "https://mysite.com/". */
export function website(value) {
  const s = text(value, 300, "Website");
  if (!s) return "";
  const withScheme = /^[a-z]+:\/\//i.test(s) ? s : "https://" + s;
  let u;
  try { u = new URL(withScheme); } catch { fail(422, "Website is not a web address."); }
  if (u.protocol !== "https:" || u.username || u.password) fail(422, "Website must be an https:// address.");
  return u.href;
}

function lotFields(data, old = null) {
  onlyKeys(data, LOT_FIELDS, "The lot");
  const out = old ? { ...old } : {};
  const has = (k) => k in data || !old;
  if (has("name")) out.name = text(data.name, 80, "Lot name", { required: true });
  if (has("address")) out.address = text(data.address, 200, "Street address");
  if (has("city")) out.city = text(data.city, 80, "City");
  if (has("state")) out.state = text(data.state, 40, "State");
  if (has("zip")) out.zip = text(data.zip, 12, "ZIP");
  if (has("phone")) out.phone = phone(data.phone);
  if (has("email")) out.email = email(data.email);
  if (has("hours")) out.hours = text(data.hours, 300, "Hours", { multiline: true });
  if (has("website")) out.website = website(data.website);
  if (has("embedOrigins")) {
    const list = data.embedOrigins ?? [];
    if (!Array.isArray(list) || list.length > 10) fail(422, "List up to 10 websites.");
    out.embedOrigins = [...new Set(list.map((v) => websiteOrigin(text(v, 300, "Website"))).filter(Boolean))];
  }
  if (has("active")) out.active = data.active == null ? true : bool(data.active, "Open");
  return out;
}

/* What anybody on the internet may see about a lot (its designer reads it). */
export function publicLotFields(lot) {
  return {
    slug: lot.slug, id: lot.slug, name: lot.name, address: lot.address || "", city: lot.city || "",
    state: lot.state || "", zip: lot.zip || "", phone: lot.phone || "", email: lot.email || "",
    hours: lot.hours || "", website: lot.website || "", embedOrigins: lot.embedOrigins || [],
  };
}

export function createLots({ store, now }) {
  const iso = () => now().toISOString();

  async function all() {
    const lots = await store.all("lots/", 500);
    return lots.sort((a, b) => (b.active !== false) - (a.active !== false) || a.name.localeCompare(b.name));
  }

  async function get(slug) {
    if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
    return store.get(`lots/${slug}`);
  }

  async function create(by, data) {
    const fields = lotFields(data);
    let base = data.slug != null && data.slug !== "" ? text(data.slug, 40, "Link name") : slugFrom(fields.name);
    if (!SLUG_RE.test(base)) {
      if (data.slug) fail(422, "The link name can use only lowercase letters, numbers and dashes (2 to 40).");
      base = "lot";
    }
    const at = iso();
    for (let n = 1; n <= 20; n++) {
      const slug = n === 1 ? base : `${base.slice(0, 37)}-${n}`;
      const lot = { ...fields, slug, createdAt: at, updatedAt: at, createdBy: by.userId };
      if (await store.create(`lots/${slug}`, lot)) return lot;
      if (data.slug) fail(409, `The link name "${slug}" is taken by another lot. Pick another.`);
    }
    fail(409, "Pick a different lot name.");
  }

  async function update(by, slug, data) {
    if (!(await get(slug))) fail(404, "That lot does not exist.");
    if ("slug" in data && data.slug !== slug) fail(422, "A lot's link name cannot change (its link is already on websites).");
    const { slug: _ignored, ...rest } = data;
    return store.change(`lots/${slug}`, (lot) => {
      if (!lot) fail(404, "That lot does not exist.");
      return { ...lotFields(rest, lot), slug, updatedAt: iso(), updatedBy: by.userId };
    });
  }

  return { all, get, create, update };
}
