/* CHECK: THE DEALER CENTER SPEAKS PLAIN SHED-LOT ENGLISH.
   Run: node tools/check-wording.mjs
   check-all: node

   WHY. Alan did not like the old dealer software's words ("Owner/Admin",
   "workspace", "catalogue", "customer sales request", "membership"...). The
   new words are in docs/OFFICE.md ("The words we use"). This check keeps the
   old ones from coming back: it reads every sentence a person can see --
   the Dealer Center's screens (dealer.html, ui/office/), the server's
   answers (server/office/: every fail(...) sentence and every email), and
   the customer's quote messages on a lot's designer (ui/quote.js,
   ui/managed-order.js) -- and fails on any banned word.

   HOW it finds "sentences a person can see": a small reader skips the
   comments and regular expressions, then every string literal (and the
   plain parts of template literals) that has a space in it or starts with
   a capital letter is read as words. Code-like
   strings (paths, CSS classes, keys) have no spaces and are skipped.

   THE TERMS. Every owner reads and agrees to the Barnwright Terms and
   Conditions (docs/legal/terms.json, the sign-up page's copy, made with the
   PDF by tools/legal/make-legal-pdfs.py). Their words are held to the same
   list, and to what Barnwright setup access really does, so they never
   promise more than the code enforces (SPEC-FIXES F14):
     * they are the version the Dealer Center asks for, 2.2 or later;
     * 2.3 shows the owner the preview before opening (F2);
     * 2.4 says setup access lasts until the 3D designer is first open or
       the first quote or order is saved, the owner can stop it, and only
       the owner opens the 3D designer (D1, D2, F1) -- and it never says a
       person approves each change, because before the 3D designer is open
       a change can be saved after the Claude app's Allow, which can be
       skipped (F3);
     * 10.4 names the owner's one choice, "Run checks and change my price
       list and settings", for 1 to 24 hours, and a Barnwright person making
       each change by hand or approving it in the Control Room first (F3,
       F11, F14); 10.6 names what setup access never touches (D7);
     * nothing says "Help from Barnwright", the card that became Barnwright
       (F11); and once the Dealer Center has setup access
       (server/office/setup-access.js), the owner's screens show both
       choices the terms name. */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { TERMS } from "../server/office/terms.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* word (as a regular expression) -> what to say instead */
const BANNED = [
  [/\bwork ?space/i, "say Dealer Center"],
  [/\bportal\b/i, "say Dealer Center"],
  [/\bthe office\b|\boffice (account|staff)\b/i, "say Dealer Center"],
  [/\badmin(istrator)?s?\b/i, "say owner or manager"],
  [/owner\s*\/\s*admin/i, "say owner"],
  [/\bmembers?(hip)?s?\b/i, "say the team, a person"],
  [/\btenants?\b/i, "say business"],
  [/\bcatalogu?e?s?\b/i, "say price list"],
  [/\bsubmission/i, "say quote request or send"],
  [/\bcustomer (sales )?requests?\b/i, "say customer or quote"],
  [/\bembed(ding|ded)?\b/i, "say website code / show on your website"],
  [/\borigins?\b/i, "say website"],
  [/\brevision\b/i, "say when it was saved"],
  [/\bsuspended\b/i, "say Closed"],
  [/\binactive\b/i, "say Closed / Removed"],
  [/\bverified account\b|\baccount id\b/i, "never ask a person for an account ID"],
  [/\bidempoten/i, "never show this to a person"],
  [/\bJSON\b/, "never show this to a person"],
  [/\bUSD\b/, "say $"],
  [/\bcolour/i, "American spelling: color"],
  [/\bE-mail\b/, "write email"],
  [/\bslug\b/i, "say link name"],
  [/\bscope\b/i, "say lots"],
  [/\bgrant(ed|s)? access\b/i, "say add to the team"],
];

/* A small JavaScript reader: walks the code once, skipping comments and
   regular expressions, and collects every string literal's text (for a
   template literal, its plain parts) with its line number. */
function strings(src) {
  const out = [];
  let i = 0, line = 1, prev = "";
  const n = src.length;
  const regexCan = () => prev === "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(prev) || /\b(return|typeof|case|of|in)$/.test(prev);
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (c === "/" && d === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; line += (src.slice(i, end).match(/\n/g) || []).length; i = end; continue; }
    if (c === "/" && regexCan()) {
      i++;
      let inClass = false;
      while (i < n && src[i] !== "\n") {
        if (src[i] === "\\") { i += 2; continue; }
        if (src[i] === "[") inClass = true;
        else if (src[i] === "]") inClass = false;
        else if (src[i] === "/" && !inClass) break;
        i++;
      }
      i++;
      while (/[a-z]/i.test(src[i] || "")) i++;
      prev = "regex";
      continue;
    }
    if (c === '"' || c === "'") {
      const start = line;
      let text = "";
      i++;
      while (i < n && src[i] !== c && src[i] !== "\n") {
        if (src[i] === "\\") { text += src[i + 1] === "n" ? " " : src[i + 1]; i += 2; continue; }
        text += src[i++];
      }
      i++;
      out.push({ text, line: start });
      prev = "string";
      continue;
    }
    if (c === "`") {
      const start = line;
      let text = "";
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") { text += src[i + 1]; i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; else if (src[i] === "\n") line++; i++; }
          text += " ";
          continue;
        }
        if (src[i] === "\n") line++;
        text += src[i++];
      }
      i++;
      out.push({ text, line: start });
      prev = "string";
      continue;
    }
    let j = i;
    if (/[A-Za-z0-9_$]/.test(c)) { while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++; prev = src.slice(i, j); i = j; continue; }
    prev = c;
    i++;
  }
  return out;
}

/* an address (/d/port-charlotte/?embed=1, https://...) is not a sentence */
const address = (t) => /^\s*(\/|https?:\/\/|#\/|\?)/.test(t) && !/\s[a-z]{3,}\s[a-z]{3,}\s/i.test(t.replace(/\$\{[^}]*\}/g, ""));
const visible = (t) => /\s/.test(t.trim()) || /^[A-Z][a-z]/.test(t.trim());
const codeLike = (t) => /^[\w./:#?=&%-]+$/.test(t.trim()) || /^\s*[.#]?[a-z-]+(\s+[.#]?[a-z-]+)*\s*$/.test(t) && !/\s[a-z]{3,}\s[a-z]{3,}/.test(t);

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(m?js|html)$/.test(n)) out.push(p);
  }
  return out;
}

/* server/office/control-room.js is the control room's own check-in code,
   copied as it is (its error sentences are for programmers and never reach
   a person: server/office/account.js catches every one and says it in plain
   words, and that file is checked like the rest). */
const COPIED = new Set([resolve(ROOT, "server/office/control-room.js")]);
const files = [
  resolve(ROOT, "dealer.html"),
  ...walk(resolve(ROOT, "ui/office")),
  ...walk(resolve(ROOT, "server/office")).filter((f) => !COPIED.has(f)),
  resolve(ROOT, "ui/managed-order.js"),
].filter(existsSync);

let checked = 0;
const problems = [];
for (const file of files) {
  const rel = relative(ROOT, file);
  let src = readFileSync(file, "utf8");
  let items;
  if (file.endsWith(".html")) {
    items = [{ text: src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " "), line: 1 }];
  } else {
    items = strings(src).filter((s) => visible(s.text) && !codeLike(s.text) && !address(s.text));
  }
  for (const { text, line } of items) {
    checked++;
    for (const [re, instead] of BANNED) {
      const hit = re.exec(text);
      if (hit) problems.push(`${rel}:${line}: "${hit[0]}" in "${text.trim().slice(0, 90)}" -- ${instead}`);
    }
  }
}

/* the customer's quote messages in ui/quote.js: only the managed (lot) words */
const quote = resolve(ROOT, "ui/quote.js");
if (existsSync(quote)) {
  for (const { text, line } of strings(readFileSync(quote, "utf8"))) {
    if (!visible(text)) continue;
    checked++;
    for (const re of [/dealer'?s inbox/i, /\bsubmission/i, /owner\s*\/\s*admin/i, /\bJSON\b/]) {
      const hit = re.exec(text);
      if (hit) problems.push(`ui/quote.js:${line}: "${hit[0]}" in "${text.trim().slice(0, 90)}"`);
    }
  }
}

/* the Barnwright Terms and Conditions (see THE TERMS above) */
const TERMS_SETUP_ACCESS = "2.2";
const notes = [];
let termsFacts = 0;
{
  const rel = "docs/legal/terms.json";
  const t = JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
  const lines = [...t.intro.map((x, i) => ({ where: `intro ${i + 1}`, text: x })),
    ...t.summary.flatMap((s) => [{ where: `short version "${s.title}"`, text: s.title }, { where: `short version "${s.title}"`, text: s.text }]),
    ...t.sections.flatMap((s) => [{ where: s.heading, text: s.heading }, ...s.items.map((it) => ({ where: it.n || s.heading, text: it.text }))])];
  for (const { where, text } of lines) {
    checked++;
    for (const [re, instead] of BANNED) {
      const hit = re.exec(text);
      if (hit) problems.push(`${rel} ${where}: "${hit[0]}" in "${text.trim().slice(0, 90)}" -- ${instead}`);
    }
    if (/Help from Barnwright/.test(text)) problems.push(`${rel} ${where}: says "Help from Barnwright" -- the owner's card is called Barnwright now, with Run checks and Run checks and change my price list and settings`);
  }
  const at = (v) => v.split(".").map(Number);
  const atLeast = (v, need) => { const a = at(v), b = at(need); for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); return true; };
  const fact = (what, cond) => { termsFacts++; if (!cond) problems.push(`${rel}: ${what}`); };
  fact(`is version ${TERMS.version}, the version the Dealer Center asks the owner to agree to (server/office/terms.js), and that is ${TERMS_SETUP_ACCESS} or later (it says ${t.version})`,
    /^\d+(\.\d+)*$/.test(t.version) && t.version === TERMS.version && atLeast(t.version, TERMS_SETUP_ACCESS));
  const item = (n) => t.sections.flatMap((s) => s.items).find((it) => it.n === n)?.text || "";
  const says = (n, ...words) => { const x = item(n).replace(/\s+/g, " "); return words.every((w) => x.includes(w)); };
  fact("2.3 lets the owner and team look at the 3D designer as a preview before it opens, which customers can't see",
    says("2.3", "preview before you open it", "Your customers can't see the preview"));
  fact("2.4 says Barnwright can change the price list and settings only until the 3D designer is first open to customers or the first quote or order is saved, even if it is closed again",
    says("2.4", "Until you first open your 3D designer to customers, we can change your price list and settings", "first quote or order is saved", "even if you close it again later"));
  fact("2.4 says the owner can stop it in Settings, Barnwright, and only the owner opens the 3D designer to customers",
    says("2.4", "Your owner can stop it sooner in Settings, Barnwright", "Only your owner can open your 3D designer to customers"));
  fact("2.4 says setup can start as soon as the Dealer Center is made, before the owner first signs in, on the terms agreed on the sign-up page, from the business name, phone and email given there (docs/OFFICE.md, \"Before the owner first signs in\")",
    says("2.4", "This can start as soon as we make your Dealer Center, before your owner first signs in", "the terms you agree to on your sign-up page allow it", "business name, phone and email you give us there"));
  fact("the short version's \"Changes we make\" says it can start before the owner first signs in",
    (t.summary.find((x) => x.title === "Changes we make")?.text || "").includes("starting before you first sign in"));
  fact("2.4 never promises that a person approves each change before the 3D designer is open (the Claude app's Allow can be skipped, so nothing enforces it)",
    !!item("2.4") && !/approv/i.test(item("2.4")));
  fact("10.4 says after setup access ends Barnwright changes things only while the owner turns on Run checks and change my price list and settings, for 1 to 24 hours",
    says("10.4", "After our setup access ends", "only while your owner turns on Run checks and change my price list and settings in Settings, Barnwright, for 1 to 24 hours"));
  fact("10.4 says a Barnwright person makes each change by hand or approves it in the Control Room before it is saved, even when software prepares it",
    says("10.4", "A Barnwright person makes each change by hand in your Dealer Center, or approves it in our Control Room before it is saved", "AI assistants"));
  fact("10.5 says what the Dealer Center tells Barnwright, and that it never includes prices",
    says("10.5", "Your Dealer Center tells us whether your 3D designer is open", "This never includes your prices"));
  fact("10.6 says every change is listed for the owner, and setup access never reaches customers, quotes, orders, the team, lots, where quote requests go, which websites show the 3D designer, or opening and closing it",
    says("10.6", "every change we make is listed for your owner", "never lets us see or change your customers, quotes, orders or team", "change your lots", "where quote requests go", "which websites show your 3D designer", "open or close your 3D designer"));
  /* the owner's screens show the choices the terms name -- once the Dealer
     Center has setup access (lane A's server/office/setup-access.js) */
  const choices = ["Run checks and change my price list and settings", "Run checks"];
  const named = choices.filter((c) => lines.some((l) => l.text.includes(c)));
  if (existsSync(resolve(ROOT, "server/office/setup-access.js"))) {
    const screens = walk(resolve(ROOT, "ui/office")).map((f) => readFileSync(f, "utf8")).join("\n");
    for (const c of named) fact(`names "${c}", which the owner's Settings, Barnwright card shows (ui/office/)`, screens.includes(`"${c}"`) || screens.includes(`'${c}'`) || screens.includes("`" + c + "`"));
  } else {
    notes.push(`the terms name ${named.map((c) => `"${c}"`).join(" and ")}; this Dealer Center has no setup access yet (server/office/setup-access.js), so the owner's card wasn't compared. Merge setup access before these terms.`);
  }
}

for (const p of problems) console.log("  FAIL " + p);
for (const n of notes) console.log("  note: " + n);
if (problems.length) {
  console.log(`FAIL: ${problems.length} place(s) use words the Dealer Center doesn't use (docs/OFFICE.md, "The words we use"), or the terms don't say what Barnwright setup access really does (tools/legal/make-legal-pdfs.py).`);
  process.exit(1);
}
console.log(`PROVED: ${checked} sentences on the Dealer Center's screens, its server answers and emails, the lot designer's quote messages and the Barnwright Terms and Conditions use none of the ${BANNED.length} old words (portal, workspace, admin, catalogue, submission, embed, origin, suspended...).`);
console.log(`  The terms are version ${TERMS.version} (${TERMS_SETUP_ACCESS} or later) and say the ${termsFacts - 1} things Barnwright setup access really does, and no more: the preview before opening, setup access from before the owner first signs in (on the sign-up page's agreement) only until first open or the first quote or order, the owner's stop and the owner alone opening, no promise of a person approving each change before opening, the owner's Run checks and change my price list and settings for 1 to 24 hours after, a Barnwright person making or approving each change then, what the Dealer Center tells Barnwright, and what setup access never touches.`);
