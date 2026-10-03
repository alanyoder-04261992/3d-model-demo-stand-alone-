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
   strings (paths, CSS classes, keys) have no spaces and are skipped. */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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

const files = [
  resolve(ROOT, "dealer.html"),
  ...walk(resolve(ROOT, "ui/office")),
  ...walk(resolve(ROOT, "server/office")),
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

for (const p of problems) console.log("  FAIL " + p);
if (problems.length) {
  console.log(`FAIL: ${problems.length} place(s) use words the Dealer Center doesn't use (docs/OFFICE.md, "The words we use").`);
  process.exit(1);
}
console.log(`PROVED: ${checked} sentences on the Dealer Center's screens, its server answers and emails, and the lot designer's quote messages use none of the ${BANNED.length} old words (portal, workspace, admin, catalogue, submission, embed, origin, suspended...).`);
