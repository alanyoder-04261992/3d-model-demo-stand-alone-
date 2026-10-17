/* READING REQUESTS AND WRITING ANSWERS for the Office API.

   Every answer is JSON and never cached. Every mistake is an OfficeError
   with an HTTP status and one plain sentence a dealer can act on; anything
   else that goes wrong is logged and answered "Something went wrong on our
   end. Try again in a minute." (503), so no internal detail ever reaches a
   browser.

   A change (POST, PUT, PATCH, DELETE) must come from a page on this same
   site: its Origin header must equal the site's own, which stops another
   website from making a signed-in person's browser change anything. */

const MAX_BODY = 256 * 1024;
const MAX_DEPTH = 24;
const MAX_NODES = 20000;
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);

/* extra: more fields for the answer, next to `error` (a refusal's `code`,
   or the time a save happened, for the browser to show in its own time). */
export class OfficeError extends Error {
  constructor(status, message, extra = null) {
    super(message);
    this.status = status;
    if (extra) this.extra = extra;
  }
}

export function fail(status, message, extra = null) {
  throw new OfficeError(status, message, extra);
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Netlify-CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

/* Turn any thrown thing into an answer. */
export function errorAnswer(error, log = console.error, { requestId } = {}) {
  const reference = typeof requestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(requestId) ? requestId : null;
  const trace = reference ? { requestId: reference } : {};
  const headers = reference ? { "X-Request-Id": reference } : {};
  if (error instanceof OfficeError) {
    if (error.status >= 500 && reference) log("Dealer Center request failed:", reference, error.status, error.extra?.code || "service-unavailable");
    return json({ ...(error.extra || {}), ...(error.status >= 500 ? trace : {}), error: error.message, ...(error.problems ? { problems: error.problems } : {}) }, error.status, error.status >= 500 ? headers : {});
  }
  log("Dealer Center error:", ...(reference ? [reference] : []), error);
  return json({ ...trace, error: "Something went wrong on our end. Try again in a minute." }, 503, headers);
}

export function requireSameSite(request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url).origin;
  if (origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    fail(403, "Something went wrong. Reload the page and try again.");
  }
}

/* Walk the parsed body once: refuse very deep or very large shapes and the
   three keys that could change how plain objects behave. */
function checkShape(value, depth = 0, count = { n: 0 }) {
  if (++count.n > MAX_NODES || depth > MAX_DEPTH) fail(413, "That is too much to save at once.");
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (RESERVED.has(key)) fail(422, "Something went wrong. Reload the page and try again.");
      checkShape(value[key], depth + 1, count);
    }
  }
}

export async function readBody(request) {
  return (await readJsonRaw(request)).data;
}

/* A body over the size allowed: the error says so (tooBig), apart from a
   body too deep or too large in values (the door answers them differently). */
function tooBig() {
  const error = new OfficeError(413, "That is too much to save at once.");
  error.tooBig = true;
  throw error;
}

/* The same, keeping the exact bytes that came (a Barnwright pass is made
   for the SHA-256 of them): -> {data, raw (a Uint8Array)}. maxBytes is at
   most the usual 256 KB. */
export async function readJsonRaw(request, { maxBytes = MAX_BODY } = {}) {
  const most = Math.min(maxBytes, MAX_BODY);
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (!type.startsWith("application/json")) fail(415, "Something went wrong. Reload the page and try again.");
  if (Number(request.headers.get("content-length")) > most) tooBig();
  const reader = request.body?.getReader();
  if (!reader) fail(400, "Something went wrong. Reload the page and try again.");
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > most) {
      await reader.cancel();
      tooBig();
    }
    chunks.push(value);
  }
  const raw = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { raw.set(c, at); at += c.byteLength; }
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    fail(400, "Something went wrong. Reload the page and try again.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(422, "Something went wrong. Reload the page and try again.");
  checkShape(data);
  return { data, raw };
}

/* One cookie's value from the request, or null. */
export function cookieOf(request, name) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return null;
}

/* ---------------------------------------------------------------------- */
/* Small checks for incoming fields. Each takes the field's name as a      */
/* person would say it ("Phone"), for the error sentence.                  */

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function text(value, max, label, { required = false, multiline = false } = {}) {
  if (value == null || value === "") {
    if (required) fail(422, `${label} is needed.`);
    return "";
  }
  if (typeof value !== "string") fail(422, `${label} must be written as text.`);
  if (value.length > max) fail(422, `${label} is too long (at most ${max} characters).`);
  if (CONTROL.test(value) || (!multiline && /[\r\n]/.test(value))) fail(422, `${label} has characters we can't save.`);
  const out = value.trim();
  if (required && !out) fail(422, `${label} is needed.`);
  return out;
}

const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;

export function email(value, label = "Email", required = false) {
  const out = text(value, 200, label, { required }).toLowerCase();
  if (out && !EMAIL_RE.test(out)) fail(422, `${label} does not look like an email address.`);
  return out;
}

export function phone(value, label = "Phone") {
  const out = text(value, 40, label);
  if (out && !/^[0-9+().\-\s x#]+$/i.test(out)) fail(422, `${label} can only have numbers, spaces and ( ) - +.`);
  if (out && out.replace(/\D/g, "").length < 7) fail(422, `${label} is too short to be a phone number.`);
  return out;
}

/* "2026-10-05" only, and a real day. */
export function day(value, label) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(422, `${label} must be a date.`);
  const d = new Date(value + "T12:00:00Z");
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== value) fail(422, `${label} must be a real date.`);
  return value;
}

export function money(value, label, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) fail(422, `${label} is needed.`);
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10000000) {
    fail(422, `${label} must be a dollar amount.`);
  }
  return Math.round(value * 100) / 100;
}

/* One of a short list of choices. The choices are codes ("rto",
   "walk-in"), so the sentence never lists them: `ask` is what the person
   should do, like "Pick how they are paying." */
export function oneOf(value, allowed, ask) {
  if (!allowed.includes(value)) fail(422, ask);
  return value;
}

export function bool(value, label) {
  if (typeof value !== "boolean") fail(422, `${label} must be yes or no.`);
  return value;
}

/* Only these keys may be sent. */
export function onlyKeys(data, allowed, what) {
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) fail(422, "Something went wrong. Reload the page and try again.");
  }
}
