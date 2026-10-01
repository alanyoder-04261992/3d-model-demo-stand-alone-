/* THE PRIVATE DEALER OFFICE AND PUBLIC LOT ORDERS. All permissions are
   checked here, on the server. Storage and verified Identity lookups are
   injected so isolation, failed writes, and races can be checked locally. */
import { createHash } from "node:crypto";
import { ID_RE, validate, validateManufacturer, resolve } from "../model/company.js";
import { priceOrder } from "./order-pricing.js";

export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function fail(status, message) { throw new HttpError(status, message); }
function id(value, label = "ID") { if (typeof value !== "string" || !ID_RE.test(value)) fail(422, `${label} must have 2–40 lowercase letters, numbers, or dashes.`); return value; }
function str(value, max, label, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(422, `${label} is invalid or too long.`);
  const out = value.trim(); if (required && !out) fail(422, `${label} is required.`); return out;
}
function email(value, required = false) {
  const out = str(value, 200, "Email", required).toLowerCase();
  if (out && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(out)) fail(422, "Email is invalid."); return out;
}
function safeTree(value, depth = 0, count = { n: 0 }) {
  if (++count.n > 20000 || depth > 24) fail(413, "This request is too complex.");
  if (value && typeof value === "object") for (const key of Object.keys(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) fail(422, "This request contains a reserved field.");
    safeTree(value[key], depth + 1, count);
  }
}
async function body(req) {
  if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) fail(415, "Send JSON data.");
  if (+req.headers.get("content-length") > 262144) fail(413, "This request is too large.");
  const reader = req.body?.getReader(); if (!reader) fail(400, "Request data is missing.");
  let bytes = 0; const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 262144) { await reader.cancel(); fail(413, "This request is too large."); } chunks.push(value); }
  let data; try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { fail(400, "Request data is not valid JSON."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(422, "Request data must be an object."); safeTree(data); return data;
}
function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function sameOrigin(req) {
  const origin = req.headers.get("origin"), expected = new URL(req.url).origin;
  if (origin !== expected || req.headers.get("sec-fetch-site") === "cross-site") fail(403, "Open the designer or office on its own site before saving.");
}
function response(data, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Netlify-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
function verified(user) { return !!(user && typeof user.id === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(user.id) && user.email && user.confirmedAt && Number.isFinite(Date.parse(user.confirmedAt))); }
function companySummary(record) { return { id: record.company.id, name: record.company.brand.name, status: record.company.status || "active", version: record.version }; }
function receipt(record) { return { id: record.id, total: record.price.total, price: record.price, version: record.catalogueVersion, receivedAt: record.receivedAt }; }

export function createBackend({ store, loadCatalogue, identityUser = async () => null, lookupUser = async () => null, bootstrapEmail = "", now = () => new Date(), clientIp = "unknown" }) {
  const read = (key) => store.getWithMetadata(key, { type: "json", consistency: "strong" });
  async function create(key, data) { const r = await store.setJSON(key, data, { onlyIfNew: true }); return r.modified; }
  async function update(key, previous, data) {
    if (!previous?.etag) fail(503, "Storage did not return a version; please retry.");
    const r = await store.setJSON(key, data, { onlyIfMatch: previous.etag });
    if (!r.modified) fail(409, "Someone saved a newer version. Reload and try again.");
  }
  async function entries(prefix) {
    const out = []; for await (const page of store.list({ prefix, paginate: true })) {
      for (const item of page.blobs) { const r = await read(item.key); if (r) out.push(r.data); }
      if (out.length > 10000) fail(503, "This office needs a larger order database. Contact support.");
    } return out;
  }
  async function auth() {
    const user = await identityUser(); if (!verified(user)) fail(401, "Sign in with a confirmed email address.");
    let member = (await read(`members/${user.id}`))?.data || null;
    if (!member && bootstrapEmail && email(user.email) === email(bootstrapEmail)) {
      const key = "setup/first-owner", existing = await read(key);
      if (!existing) await create(key, { userId: user.id, createdAt: now().toISOString() });
      const claim = (await read(key))?.data;
      if (claim?.userId === user.id) {
        await create(`members/${user.id}`, { userId: user.id, email: email(user.email), role: "admin", platformAdmin: false, companyIds: [], lotIds: [], createdAt: now().toISOString() });
        member = (await read(`members/${user.id}`))?.data || null;
      }
    }
    if (member?.active === false) fail(403, "This office account is inactive.");
    return { user, member };
  }
  function requireMember(a) { if (!a.member) fail(403, "The owner/admin has not assigned this account to an office yet."); }
  function adminOnly(a) { requireMember(a); if (a.member.role !== "admin") fail(403, "Only the owner/admin may change company settings or accounts."); }
  function canCompany(a, record) { return !!(a.member && (a.member.platformAdmin || record.ownerId === a.user.id || a.member.companyIds.includes(record.company.id))); }
  async function companyFor(a, companyId) {
    id(companyId, "Company ID"); const r = await read(`companies/${companyId}`); if (!r || !canCompany(a, r.data)) fail(404, "Company not found."); return r;
  }
  async function companiesFor(a) { if (!a.member) return []; return (await entries("companies/")).filter((record) => canCompany(a, record)); }
  async function lotsFor(a, companyId) {
    requireMember(a); const companies = await companiesFor(a), allowed = new Set(companies.map((r) => r.company.id));
    return (await entries("lots/")).filter((lot) => allowed.has(lot.companyId) && (!companyId || lot.companyId === companyId) && (a.member.role === "admin" || a.member.lotIds.includes(lot.id)));
  }
  async function checkedCatalogue(company) {
    if (!company || typeof company !== "object" || Array.isArray(company)) fail(422, "Company settings are required.");
    id(company.id, "Company ID");
    let files; try { files = await loadCatalogue(company.manufacturer); } catch { fail(422, "This manufacturer is not installed."); }
    const problems = validateManufacturer(files.manufacturer).concat(validate(company, files.manufacturer));
    if (problems.length) fail(422, problems.slice(0, 12).join(" "));
    return resolve(company, files.manufacturer, files.library);
  }
  async function publicLot(slug) {
    id(slug, "Lot address"); const lr = await read(`lots/${slug}`);
    if (!lr || !lr.data.active) fail(404, "This dealer lot is unavailable.");
    const cr = await read(`companies/${lr.data.companyId}`);
    if (!cr || cr.data.company.status === "suspended") fail(404, "This company is unavailable.");
    return { company: cr.data.company, lot: lr.data, version: cr.data.version };
  }
  function lotInput(data, old = {}) {
    const out = { ...old };
    for (const [key, max] of [["name", 120], ["phone", 40], ["website", 500]]) if (key in data || !old.id) out[key] = str(data[key], max, key, key === "name");
    if (out.website) { let u; try { u = new URL(out.website); } catch { fail(422, "Website must be a full HTTPS address."); } if (u.protocol !== "https:" || u.username || u.password) fail(422, "Website must be a full HTTPS address."); }
    if ("email" in data || !old.id) out.email = email(data.email);
    if ("embedOrigins" in data || !old.id) {
      const origins = data.embedOrigins || []; if (!Array.isArray(origins) || origins.length > 10) fail(422, "List up to ten website origins.");
      out.embedOrigins = [...new Set(origins.map((v) => { let u; try { u = new URL(v); } catch { fail(422, "An embedding website is invalid."); } if (u.protocol !== "https:" || u.origin !== v || !/^https:\/\/[a-z0-9.-]+(:\d+)?$/.test(v)) fail(422, "Embedding websites must be exact HTTPS origins without paths."); return v; }))];
    }
    if ("active" in data && typeof data.active !== "boolean") fail(422, "Active must be true or false.");
    out.active = "active" in data ? data.active : old.active ?? true; return out;
  }
  async function rateLimit(key, limit, windowMs) {
    const time = now().getTime(), bucket = Math.floor(time / windowMs);
    for (let n = 0; n < 5; n++) {
      const current = await read(key), count = current?.data.bucket === bucket ? current.data.count : 0;
      if (count >= limit) fail(429, "Too many requests. Please try again later.");
      if (current && !current.etag) fail(503, "Storage did not return a version; please retry.");
      const options = current ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
      if ((await store.setJSON(key, { bucket, count: count + 1 }, options)).modified) return;
    } fail(429, "The office is busy. Please try again shortly.");
  }
  function contactInput(data, cat) {
    if (!data || typeof data !== "object" || Array.isArray(data)) fail(422, "Contact details are required.");
    const result = {};
    for (const [key, max] of [["name", 100], ["phone", 40], ["zip", 12], ["address", 300], ["note", 1000]]) result[key] = str(data[key], max, key, key === "name" || cat.leads.fields[key] === "required");
    result.email = email(data.email, cat.leads.fields.email === "required");
    if (!result.phone && !result.email) fail(422, "A phone number or email address is required.");
    if (data.smsOk != null) { if (typeof data.smsOk !== "boolean") fail(422, "Text consent is invalid."); result.smsOk = data.smsOk; }
    return result;
  }
  async function submitOrder(req, slug, data) {
    const context = await publicLot(slug), { company, lot, version } = context;
    const token = str(data.idempotencyKey, 128, "Submission key", true);
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) fail(422, "The submission key is invalid. Please reload the designer.");
    const orderId = `${company.id}.${lot.id}.${hash(token).slice(0, 32)}`, key = `orders/${company.id}/${lot.id}/${orderId}`;
    const fingerprint = hash(JSON.stringify({ version: data.version, design: data.design, contact: data.contact }));
    const existing = await read(key);
    if (existing) { if (existing.data.fingerprint !== fingerprint) fail(409, "This submission key was already used for another request."); return response(receipt(existing.data)); }
    if (data.version !== version || data.design?.cfg !== company.cfg) fail(409, "The owner/admin updated the options or prices. Reload your design before sending.");
    await rateLimit(`rate/${slug}/${hash(clientIp).slice(0, 32)}`, 20, 600000);
    await rateLimit(`rate-lot/${slug}`, 300, 3600000);
    const cat = await checkedCatalogue(company), priced = priceOrder(data.design, cat), contact = contactInput(data.contact, cat);
    const timestamp = now().toISOString();
    const record = { id: orderId, companyId: company.id, companyName: company.brand.name, lotId: lot.id, lotName: lot.name, status: "new", version: 1, catalogueVersion: version, design: priced.design, price: priced.price, contact, receivedAt: timestamp, updatedAt: timestamp, fingerprint, link: `${new URL(req.url).origin}/d/${lot.slug}/`, history: [{ status: "new", at: timestamp }] };
    if (!await create(key, record)) { const raced = await read(key); if (!raced || raced.data.fingerprint !== fingerprint) fail(409, "This submission key was already used."); return response(receipt(raced.data)); }
    return response(receipt(record), 201);
  }
  async function visibleOrder(a, orderId) {
    const parts = orderId.split("."); if (parts.length !== 3 || !/^[a-f0-9]{32}$/.test(parts[2])) fail(404, "Order not found.");
    const [companyId, lotId] = parts; await companyFor(a, companyId);
    if (a.member.role !== "admin" && !a.member.lotIds.includes(lotId)) fail(404, "Order not found.");
    const key = `orders/${companyId}/${id(lotId)}/${orderId}`, r = await read(key); if (!r || r.data.companyId !== companyId || r.data.lotId !== lotId) fail(404, "Order not found."); return { key, r };
  }
  function privateOrder(record) { const out = { ...record }; delete out.fingerprint; return out; }
  async function route(req) {
    const url = new URL(req.url), path = url.pathname.replace(/\/$/, ""), method = req.method;
    if (!["GET", "POST", "PUT", "PATCH"].includes(method)) fail(405, "Method not allowed.");
    if (method !== "GET") sameOrigin(req);
    let match = /^\/api\/lots\/([^/]+)(\/orders)?$/.exec(path);
    if (match) { if (!match[2] && method === "GET") return response(await publicLot(match[1])); if (match[2] && method === "POST") return submitOrder(req, match[1], await body(req)); fail(405, "Method not allowed."); }
    if (!path.startsWith("/api/dealer/")) fail(404, "Route not found.");
    const a = await auth();
    if (path === "/api/dealer/me" && method === "GET") return response({ user: { id: a.user.id, email: a.user.email, name: a.user.name || "" }, membership: a.member, companies: (await companiesFor(a)).map(companySummary), lots: a.member ? await lotsFor(a) : [] });
    requireMember(a);
    if (path === "/api/dealer/companies") {
      if (method === "GET") return response({ companies: (await companiesFor(a)).map(companySummary) });
      if (method === "POST") { adminOnly(a); const data = await body(req), company = structuredClone(data.company); if (!company || typeof company !== "object" || Array.isArray(company)) fail(422, "Company settings are required."); company.cfg = 1; await checkedCatalogue(company); const record = { company, ownerId: a.user.id, version: 1, updatedAt: now().toISOString() }; if (!await create(`companies/${company.id}`, record)) fail(409, "That company ID already exists."); return response({ company, version: 1 }, 201); }
    }
    match = /^\/api\/dealer\/companies\/([^/]+)\/catalogue$/.exec(path);
    if (match) {
      const current = await companyFor(a, match[1]);
      if (method === "GET") return response({ company: current.data.company, version: current.data.version });
      if (method === "PUT") { adminOnly(a); const data = await body(req); if (data.version !== current.data.version) fail(409, "Company settings changed. Reload before saving."); const company = structuredClone(data.company); if (!company || company.id !== match[1]) fail(422, "The company ID cannot change."); company.cfg = current.data.company.cfg + 1; await checkedCatalogue(company); const version = current.data.version + 1; await update(`companies/${match[1]}`, current, { ...current.data, company, version, updatedAt: now().toISOString() }); return response({ company, version }); }
    }
    match = /^\/api\/dealer\/companies\/([^/]+)\/lots(?:\/([^/]+))?$/.exec(path);
    if (match) {
      await companyFor(a, match[1]);
      if (!match[2] && method === "GET") return response({ lots: await lotsFor(a, match[1]) });
      adminOnly(a);
      if (!match[2] && method === "POST") { const data = await body(req), slug = id(data.slug, "Lot address"); if (data.id && data.id !== slug) fail(422, "The lot ID must match its address."); const lot = { ...lotInput(data), id: slug, slug, companyId: match[1], version: 1 }; if (!await create(`lots/${slug}`, lot)) fail(409, "That lot address is already used."); return response({ lot }, 201); }
      if (match[2] && method === "PUT") { const current = await read(`lots/${id(match[2])}`); if (!current || current.data.companyId !== match[1]) fail(404, "Lot not found."); const data = await body(req); if (data.version !== current.data.version) fail(409, "Lot details changed. Reload before saving."); const lot = { ...lotInput(data, current.data), version: current.data.version + 1 }; await update(`lots/${lot.id}`, current, lot); return response({ lot }); }
    }
    if (path === "/api/dealer/orders" && method === "GET") {
      const companyId = url.searchParams.get("companyId"), lotId = url.searchParams.get("lotId");
      if (companyId) await companyFor(a, companyId);
      const lots = (await lotsFor(a, companyId)).filter((lot) => !lotId || lot.id === lotId);
      if (lotId && !lots.length) fail(404, "Lot not found.");
      const orders = []; for (const lot of lots) orders.push(...await entries(`orders/${lot.companyId}/${lot.id}/`));
      orders.sort((x, y) => y.receivedAt.localeCompare(x.receivedAt)); return response({ orders: orders.slice(0, 500).map(privateOrder), truncated: orders.length > 500 });
    }
    match = /^\/api\/dealer\/orders\/([^/]+)$/.exec(path);
    if (match) {
      const { key, r } = await visibleOrder(a, match[1]);
      if (method === "GET") return response({ order: privateOrder(r.data) });
      if (method === "PATCH") { const data = await body(req); if (data.version !== r.data.version) fail(409, "This order changed. Reload before saving."); if (!["new", "contacted", "quoted", "ordered", "closed"].includes(data.status)) fail(422, "That order status is invalid."); const at = now().toISOString(), order = { ...r.data, status: data.status, version: r.data.version + 1, updatedAt: at, history: [...r.data.history.slice(-99), { status: data.status, at, userId: a.user.id }] }; await update(key, r, order); return response({ order: privateOrder(order) }); }
    }
    if (path === "/api/dealer/memberships" && method === "POST") {
      adminOnly(a); const data = await body(req); await companyFor(a, data.companyId);
      if (!["admin", "dealer"].includes(data.role)) fail(422, "Choose owner/admin or dealer access.");
      const userId = str(data.userId, 128, "Account ID", true); if (!/^[A-Za-z0-9_-]+$/.test(userId)) fail(422, "Account ID is invalid.");
      let target; try { target = await lookupUser(userId); } catch { fail(422, "That confirmed Identity account could not be found."); }
      if (!verified(target) || target.id !== userId || email(target.email) !== email(data.email, true)) fail(422, "The account ID and confirmed email must match.");
      let lotIds = []; if (data.role === "dealer") { const lot = (await read(`lots/${id(data.lotId, "Lot ID")}`))?.data; if (!lot || lot.companyId !== data.companyId) fail(404, "Lot not found."); lotIds = [lot.id]; }
      const membership = { userId, email: email(target.email), role: data.role, companyIds: [data.companyId], lotIds, platformAdmin: false, createdAt: now().toISOString(), createdBy: a.user.id };
      if (!await create(`members/${userId}`, membership)) fail(409, "This account already has office access. Existing memberships cannot be replaced here."); return response({ membership }, 201);
    }
    fail(404, "Route or method not found.");
  }
  async function handle(req) { try { return await route(req); } catch (error) { return response({ error: error.status ? error.message : "The office is temporarily unavailable. Please try again." }, error.status || 503); } }
  return { handle, publicLot };
}
