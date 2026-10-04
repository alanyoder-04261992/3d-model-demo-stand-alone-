/* THE DEALER CENTER'S WORDS AND NUMBERS, in one place.

   Every screen names things with these words (docs/OFFICE.md, "The words we
   use") and writes money, dates, sizes and phone numbers with these
   helpers, so the whole Dealer Center reads the same. The server has the
   same lists in server/office/customers.js. */

export const ROLES = [["owner", "Owner"], ["manager", "Manager"], ["dealer", "Dealer"]];
export const ROLE_WORDS = Object.fromEntries(ROLES);
export const ROLE_HINTS = {
  owner: "Sets prices, lots and team. Sees every lot.",
  manager: "Works every lot's customers and orders. Can't change prices or people.",
  dealer: "Works the customers and orders of their own lots.",
};

export const STAGES = [
  ["new", "New"], ["contacted", "Contacted"], ["quoted", "Quoted"],
  ["sold", "Sold"], ["delivered", "Delivered"], ["lost", "Lost"],
];
export const STAGE_WORDS = Object.fromEntries(STAGES);
export const STAGE_HINTS = {
  new: "Nobody has talked to them yet",
  contacted: "Someone talked to them",
  quoted: "They have a price for a building",
  sold: "They bought — an order exists",
  delivered: "Their building is set",
  lost: "Not buying from us",
};

export const SOURCES = [
  ["website", "3D designer"], ["walk-in", "Walk-in"], ["phone", "Phone call"], ["text", "Text"],
  ["facebook", "Facebook"], ["referral", "Referral"], ["repeat", "Repeat customer"], ["other", "Other"],
];
export const SOURCE_WORDS = Object.fromEntries(SOURCES);

export const LOST_REASONS = ["Bought somewhere else", "Price", "Not ready yet", "No answer", "Didn't qualify for rent-to-own", "Other"];

export const ORDER_STATUSES = [
  ["sold", "Sold"], ["sent", "Sent to builder"], ["ready", "Ready"], ["delivered", "Delivered"], ["cancelled", "Cancelled"],
];
export const ORDER_WORDS = Object.fromEntries(ORDER_STATUSES);

export const PAYMENTS = [["cash", "Cash"], ["rto", "Rent-to-own"], ["financing", "Financing"], ["other", "Other"]];
export const PAYMENT_WORDS = Object.fromEntries(PAYMENTS);

export const NOTE_KINDS = [
  ["note", "Note", "note"], ["call", "Call", "phone"], ["text", "Text", "text"],
  ["email", "Email", "mail"], ["visit", "Visit", "visit"],
];

/* ---- numbers --------------------------------------------------------- */

/* $5,540 -- cents only when there are any */
export function money(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2,
  });
}

/* "10x16" -> "10×16" */
export const size = (s) => String(s || "").replace("x", "×");

export const plural = (n, one, many = one + "s") => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/* (941) 555-0140 for a 10-digit US number; anything else as typed */
export function phone(p) {
  const d = String(p || "").replace(/\D/g, "");
  const ten = d.length === 11 && d[0] === "1" ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : String(p || "");
}
export const telHref = (p) => "tel:" + String(p || "").replace(/[^\d+]/g, "");
export const smsHref = (p) => "sms:" + String(p || "").replace(/[^\d+]/g, "");

/* ---- dates ------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, "0");

/* today in the person's own time zone, as "2026-10-03" */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function addDays(key, days) {
  const d = new Date(key + "T12:00:00");
  d.setDate(d.getDate() + days);
  return todayKey(d);
}
export function daysBetween(fromKey, toKey) {
  return Math.round((new Date(toKey + "T12:00:00") - new Date(fromKey + "T12:00:00")) / 86400000);
}

/* "Oct 3" this year, "Oct 3, 2025" otherwise -- for a "2026-10-03" day */
export function dayWords(key) {
  if (!key) return "";
  const d = new Date(key.length === 10 ? key + "T12:00:00" : key);
  if (Number.isNaN(d.valueOf())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/* "Today", "Tomorrow", "Yesterday", "Fri", "Oct 9" -- for follow-ups */
export function followUpWords(key) {
  const diff = daysBetween(todayKey(), key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1) return `${-diff} days late`;
  if (diff < 7) return new Date(key + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
  return dayWords(key);
}

/* "just now", "5 min ago", "3 hours ago", "Yesterday", "Oct 3" -- for activity */
export function ago(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400 && new Date(t).getDate() === new Date().getDate()) return `${Math.floor(s / 3600)} hour${s < 7200 ? "" : "s"} ago`;
  const key = todayKey(new Date(t));
  if (daysBetween(key, todayKey()) === 1) return "Yesterday";
  return dayWords(key);
}

/* "Oct 3 at 2:15 PM" */
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "";
  return `${dayWords(todayKey(d))} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export function greeting(name) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = String(name || "").trim().split(/\s+/)[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}
