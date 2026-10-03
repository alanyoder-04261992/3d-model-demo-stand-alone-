/* SMALL PIECES THE CUSTOMER SCREENS SHARE (Today, Customers, a customer,
   Orders, the order sheet): stage and status pills, the follow-up words,
   "why did we lose them?", moving a customer to another stage, and a
   customer's quick-dial button.

   Only the everyday screens use this file; the frame's own helpers are in
   ../dom.js and the words in ../words.js. */

import { h, icon, dialog, form, field, button, toast } from "../dom.js";
import { patch } from "../api.js";
import {
  STAGE_WORDS, ORDER_WORDS, LOST_REASONS, followUpWords, dayWords, todayKey, daysBetween, telHref, phone as phoneWords,
} from "../words.js";

export function stagePill(stage) {
  return h("span", { class: ["pill", `stage-${stage}`] }, STAGE_WORDS[stage] || stage);
}

export function statusPill(status) {
  return h("span", { class: ["pill", `status-${status}`] }, ORDER_WORDS[status] || status);
}

/* "Today" (due), "3 days late" (red), "Tomorrow", "Friday", "Oct 9" */
export function followUpTone(date) {
  if (!date) return "";
  const diff = daysBetween(todayKey(), date);
  return diff < 0 ? "late" : diff === 0 ? "due" : "";
}

export function followUpBadge(followUp, { withIcon = true } = {}) {
  if (!followUp?.date) return null;
  const tone = followUpTone(followUp.date);
  return h("span", { class: ["crm-follow", tone], title: `Follow up ${dayWords(followUp.date)}` },
    withIcon ? icon("clock") : null, followUpWords(followUp.date));
}

/* A round "call" button beside a row (a link inside a link is not allowed,
   so the row and the button are siblings). */
export function callButton(number, name) {
  if (!number) return null;
  return h("a", { class: "crm-call", href: telHref(number), "aria-label": `Call ${name} at ${phoneWords(number)}`, title: `Call ${phoneWords(number)}` },
    icon("phone"));
}

/* Ask why a customer was lost. -> Promise<string|null> (null: they backed out) */
export function askLostReason(name) {
  return new Promise((resolve) => {
    let answered = false;
    const group = `lost-${Math.random().toString(36).slice(2, 8)}`;
    const radios = LOST_REASONS.map((reason, i) => {
      const input = h("input", { type: "radio", name: group, value: reason, checked: i === 0 });
      return { input, wrap: h("label", { class: "crm-radio" }, input, h("span", {}, reason)) };
    });
    const more = field("A few words (if you like)", { placeholder: "Went with a metal building in Sarasota", maxLength: 200 });
    const box = dialog(`Why was ${name} lost?`, form([
      h("fieldset", { class: "crm-radios" }, h("legend", { class: "sr-only" }, "Reason"), radios.map((r) => r.wrap)),
      more.wrap,
      h("div", { class: "actions end" },
        button("Keep them", () => box.close()),
        h("button", { type: "submit", class: "btn btn-danger" }, h("span", {}, "Mark lost"))),
    ], async () => {
      const picked = radios.find((r) => r.input.checked)?.input.value || "Other";
      const words = more.input.value.trim();
      answered = true;
      box.close();
      resolve(words ? `${picked} — ${words}` : picked);
    }), { onClose: () => { if (!answered) resolve(null); } });
  });
}

/* Move a customer to another stage (asks the reason for Lost).
   -> the changed customer, or null when nothing changed. */
export async function changeStage(customer, stage) {
  if (stage === customer.stage) return null;
  const body = { stage };
  if (stage === "lost") {
    const reason = await askLostReason(customer.name);
    if (reason == null) return null;
    body.lostReason = reason;
  }
  const out = await patch(`customers/${customer.id}`, body);
  toast(stage === "lost" ? `${customer.name} is marked Lost.` : `${customer.name} moved to ${STAGE_WORDS[stage]}.`);
  return out.customer;
}

/* What a list shows for "the building they're looking at" */
export function buildingWords(row) {
  return row.building || "No building yet";
}

/* How a customer came to us, as a short sentence. */
const CAME = {
  website: "Sent a quote from the 3D designer", "walk-in": "Walked in", phone: "Called the lot", text: "Texted the lot",
  facebook: "Found us on Facebook", referral: "Someone sent them", repeat: "Bought from us before", other: "Added by hand",
};
export const sourceWords = (source) => CAME[source] || "Added by hand";

/* the whole month a "2026-10-03" key falls in, as "2026-10" */
export const monthOf = (iso) => String(iso || "").slice(0, 7);
export const thisMonth = () => todayKey().slice(0, 7);

/* An ISO time -> the person's own day key */
export function dayKeyOf(iso) {
  const t = new Date(iso);
  return Number.isNaN(t.valueOf()) ? "" : todayKey(t);
}

/* Remembered screen choices (per person, per screen). Private windows and
   blocked storage just forget. */
export function remember(key, value) {
  try { localStorage.setItem(`dealer-center:${key}`, JSON.stringify(value)); } catch { /* fine */ }
}
export function recall(key, fallback) {
  try {
    const raw = localStorage.getItem(`dealer-center:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}

/* Digits only, for searching phone numbers however they were typed. */
export const digitsOf = (s) => String(s || "").replace(/\D/g, "");

/* A question with a few answers. choices: [[key, label, kind]].
   -> Promise<key|null> (null: closed without answering) */
export function confirmChoice(title, words, choices) {
  return new Promise((resolve) => {
    let answered = false;
    const pick = (key) => { answered = true; box.close(); resolve(key); };
    const box = dialog(title, [h("p", {}, words),
      h("div", { class: "actions end crm-choice" }, choices.slice().reverse().map(([key, label, kind]) => button(label, () => pick(key), { kind: kind || "ghost" })))],
    { onClose: () => { if (!answered) resolve(null); } });
  });
}
