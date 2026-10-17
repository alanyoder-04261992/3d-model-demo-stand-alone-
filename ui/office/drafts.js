/* Unsaved customer and Help writing belongs to this browser tab, this
   business and this person. Keep it across screen changes and a sign-in
   that ends; never put it in the shared device's localStorage. */
const PREFIX = "dealer-center:draft:";
const MAX_AGE = 7 * 24 * 3600_000;
const memory = new Map();

function keyFor(app, page) {
  const business = app.business?.id;
  const person = app.person?.userId;
  return business && person ? `${PREFIX}${business}:${person}:${page}` : null;
}

export function readDraft(app, page) {
  const key = keyFor(app, page);
  if (!key) return {};
  let record = memory.get(key);
  if (!record) {
    try { record = JSON.parse(sessionStorage.getItem(key) || "null"); } catch { /* storage unavailable */ }
  }
  if (record?.v !== 1 || !Number.isFinite(record.at) || Date.now() - record.at > MAX_AGE
    || record.at > Date.now() || !record.data || typeof record.data !== "object" || Array.isArray(record.data)) {
    clearDraft(app, page);
    return {};
  }
  memory.set(key, record);
  return record.data;
}

export function writeDraft(app, page, data) {
  const key = keyFor(app, page);
  if (!key) return;
  const record = { v: 1, at: Date.now(), data };
  memory.set(key, record);
  try { sessionStorage.setItem(key, JSON.stringify(record)); } catch { /* keep it while this page is open */ }
}

export function clearDraft(app, page) {
  const key = keyFor(app, page);
  if (!key) return;
  memory.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
}
