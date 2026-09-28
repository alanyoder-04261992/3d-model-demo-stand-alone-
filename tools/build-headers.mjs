/* WRITES THE FILE THAT SAYS WHICH WEBSITES MAY SHOW EACH COMPANY'S DESIGNER.
   Node 22, no dependencies.

     node tools/build-headers.mjs            write _headers (at the top of the repo)
     node tools/build-headers.mjs --check    only say whether _headers is up to date
                                             (exit 1, in plain words, when it is not)
     node tools/build-headers.mjs --print    print what would be written

   WHAT _headers IS. When the designer is hosted on Netlify (netlify.toml),
   Netlify reads _headers and adds those lines to every answer it sends. Two
   of them matter here:

   1. WHO MAY SHOW THE DESIGNER INSIDE THEIR PAGE ("frame-ancestors"). A
      company pastes embed.js on its own website, which shows the designer at
      /c/<company>/ in a frame. The browser only allows that frame on the
      websites listed for that company -- its company.json "embed.origins" --
      and on this site itself ('self'). Any other website that tries to show
      Acme's designer (to pass it off as its own, or without a licence) gets
      an empty box. The plain designer address (/, /index.html, /index) may be
      framed by this site only, so /c/<company>/ is the one way in.
   2. WHAT THE DESIGNER PAGE MAY LOAD AND RUN ("Content-Security-Policy"): only
      its own files; the two small scripts written inside index.html (by their
      fingerprints, worked out from index.html every time this runs -- so
      RE-RUN THIS AFTER EDITING index.html's <script> lines, or the page will
      not start on Netlify); styles written in the page (index.html uses
      style="..." and ui/app.js writes the company's colours as a <style>, so
      inline styles are allowed; inline SCRIPT is not); pictures from any
      https address (a company's logo); and, for the quote form, the one
      address each company's leads go to (a form service or a webhook). While
      index.html still links Google Fonts, Google's two font addresses are
      allowed too; the fonts themselves now come from this site (fonts/).

   Also on every file: X-Content-Type-Options: nosniff (a file is only ever
   treated as what it says it is) and a Referrer-Policy.

   HOW NETLIFY COMBINES RULES, AND WHY THEY ARE WRITTEN THIS WAY. A path can
   match more than one rule; Netlify then sends the headers of ALL of them,
   and two Content-Security-Policy headers are BOTH enforced (the stricter
   wins). So no path here matches two different policies: "/*" carries only
   nosniff and the referrer rule, and each company has its own two rules
   (/c/<id> and /c/<id>/*) with the SAME policy, so even if Netlify matched
   both, nothing changes. Rules are matched on the address the visitor asked
   for (/c/acme/), not on index.html, which the rewrite in netlify.toml
   quietly serves.

   A company whose settings file has problems stops this script: a designer
   that cannot load should be fixed, not deployed. The template
   (companies/_template) is not a company and is skipped.

   The functions below are also used by tools/check-embed.mjs, which acts out
   what Netlify would do (the rewrites in netlify.toml and the rules in
   _headers) so the frame rules are tested in a real browser. */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve as resolvePath, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..");
export const HEADERS_FILE = resolvePath(ROOT, "_headers");

/* ------------------------------------------------------------------------
   The pieces of the policy. */

/* the fingerprints of every <script> written inside a page (not <script src>) */
export function inlineScriptHashes(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    if (/\bsrc\s*=/i.test(m[1])) continue;
    out.push("'sha256-" + createHash("sha256").update(m[2], "utf8").digest("base64") + "'");
  }
  return out;
}

/* a website's origin, or null. Only letters, digits, dots and dashes in the
   name (and a port number): a web address may legally carry a ";" in its
   name ("https://acme.com;frame-ancestors"), and one of those written into
   the policy below would start a new rule of its own -- one stray paste
   could switch a company's designer off on every website. */
function originOf(u) {
  try {
    const x = new URL(u);
    if (!/^https?:$/.test(x.protocol) || !/^https?:\/\/[a-z0-9.-]+(:\d+)?$/.test(x.origin)) return null;
    return x.origin;
  } catch (e) { return null; }
}

/* where a company's quote requests go, for the policy */
export function leadTargets(company) {
  const L = (company && company.leads) || {};
  const o = originOf(L.url || "");
  return {
    form: L.mode === "form" && o ? [o] : [],        /* the form posts there, into a hidden frame that shows the answer */
    connect: L.mode === "webhook" && o ? [o] : [],  /* the webhook is fetched */
  };
}

export function frameOrigins(company) {
  const list = ((company && company.embed && company.embed.origins) || []).map(originOf).filter(Boolean);
  return Array.from(new Set(list));
}

const uniq = (a) => Array.from(new Set(a));

/* the designer's Content-Security-Policy */
export function designerCsp(o) {
  const gf = !!o.googleFonts;
  const parts = [
    ["default-src", ["'self'"]],
    ["script-src", ["'self'"].concat(o.hashes || [])],
    ["style-src", ["'self'", "'unsafe-inline'"].concat(gf ? ["https://fonts.googleapis.com"] : [])],
    ["font-src", ["'self'"].concat(gf ? ["https://fonts.gstatic.com"] : [])],
    ["img-src", ["'self'", "data:", "blob:", "https:"]],
    ["connect-src", ["'self'", "data:", "blob:"].concat(o.connect || [])],
    ["form-action", ["'self'"].concat(o.form || [])],
    ["frame-src", ["'self'"].concat(o.form || [])],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["frame-ancestors", ["'self'"].concat(o.ancestors || [])],
  ];
  return parts.map(([k, v]) => k + " " + uniq(v).join(" ")).join("; ");
}

/* ------------------------------------------------------------------------
   Reading the companies. */

export async function readCompanies() {
  const { loadCompany } = await import("./lib/load.mjs");
  const dir = resolvePath(ROOT, "companies");
  const out = [], problems = [];
  for (const id of readdirSync(dir).sort()) {
    if (id.startsWith("_") || id.startsWith(".")) continue;
    if (!existsSync(resolvePath(dir, id, "company.json"))) continue;
    let r;
    try { r = loadCompany(id); } catch (e) { problems.push(`${id}: ${e.message}`); continue; }
    if (r.problems.length) { problems.push(`${id}: its settings file has ${r.problems.length} problem(s): ${r.problems.join(" / ")}`); continue; }
    out.push({ id, company: r.company });
  }
  return { companies: out, problems };
}

/* ------------------------------------------------------------------------
   The file. */

export function buildHeaders({ companies, indexHtml }) {
  const hashes = inlineScriptHashes(indexHtml);
  const googleFonts = /fonts\.googleapis\.com/.test(indexHtml);
  const allForm = [], allConnect = [];
  for (const c of companies) { const t = leadTargets(c.company); allForm.push(...t.form); allConnect.push(...t.connect); }
  const L = [];
  const rule = (path, headers) => { L.push(path); for (const [k, v] of headers) L.push("  " + k + ": " + v); L.push(""); };
  L.push("# GENERATED by tools/build-headers.mjs from companies/*/company.json and index.html.");
  L.push("# Do not edit by hand: change a company's embed.origins (or index.html) and run");
  L.push("#   node tools/build-headers.mjs");
  L.push("# Netlify adds these lines to its answers. frame-ancestors = the websites allowed to");
  L.push("# show that company's designer inside their own page (plus this site, 'self').");
  L.push("");
  rule("/*", [["X-Content-Type-Options", "nosniff"], ["Referrer-Policy", "strict-origin-when-cross-origin"]]);
  L.push("# the plain designer address: shown in a frame by this site only (embedding goes through /c/<company>/)");
  const plain = designerCsp({ hashes, googleFonts, form: allForm, connect: allConnect, ancestors: [] });
  /* "/index" too: Netlify also answers the address without ".html" */
  for (const p of ["/", "/index.html", "/index"]) rule(p, [["Content-Security-Policy", plain]]);
  L.push("# the staff pages: this site only");
  for (const p of ["/setup.html", "/setup", "/parts.html", "/parts"]) rule(p, [["Content-Security-Policy", "frame-ancestors 'self'"]]);
  L.push("# the one script a company pastes on its website; may be loaded from any site");
  rule("/embed.js", [["Cross-Origin-Resource-Policy", "cross-origin"]]);
  for (const c of companies) {
    const t = leadTargets(c.company);
    const anc = frameOrigins(c.company);
    const status = c.company.status === "suspended" ? " (suspended: the designer says it is not available)" : "";
    L.push(`# ${c.id}: ${anc.length ? "may be shown on " + anc.join(", ") : "not embedded on any other website yet"}${status}`);
    const csp = designerCsp({ hashes, googleFonts, form: t.form, connect: t.connect, ancestors: anc });
    rule(`/c/${c.id}`, [["Content-Security-Policy", csp]]);
    rule(`/c/${c.id}/*`, [["Content-Security-Policy", csp]]);
  }
  return L.join("\n");
}

/* ------------------------------------------------------------------------
   Reading _headers and netlify.toml back, and acting them out -- what Netlify
   does with them, for tools/check-embed.mjs. */

/* a Netlify path pattern -> a test: "*" is "anything from here on" (a
   "splat"), ":name" is one part of the address */
export function patternRegex(pattern) {
  let src = "";
  const parts = pattern.split(/(\*|:[A-Za-z_][A-Za-z0-9_]*)/);
  const names = [];
  for (const p of parts) {
    if (p === "*") { src += "(.*)"; names.push("splat"); }
    else if (/^:[A-Za-z_]/.test(p)) { src += "([^/]+)"; names.push(p.slice(1)); }
    else src += p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return { re: new RegExp("^" + src + "$"), names };
}

export function parseHeaders(text) {
  const rules = [];
  let cur = null;
  for (const raw of String(text).split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    if (!/^\s/.test(raw)) { cur = { path: raw.trim(), headers: [] }; rules.push(cur); continue; }
    const i = raw.indexOf(":");
    if (cur && i > 0) cur.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
  }
  return rules;
}

/* every header of every rule that matches the path, as Netlify combines them */
export function headersFor(rules, path) {
  const out = {};
  for (const r of rules) {
    if (!patternRegex(r.path).re.test(path)) continue;
    for (const [k, v] of r.headers) (out[k.toLowerCase()] = out[k.toLowerCase()] || []).push(v);
  }
  return out;
}

/* just enough TOML for netlify.toml: [[redirects]] and [[headers]] tables of
   key = "string" | number | true/false, and [headers.values] */
export function parseNetlifyToml(text) {
  const redirects = [], headers = [];
  let cur = null, sub = null;
  for (let raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "").trim();
    if (!line || line.startsWith("#")) continue;
    if (line === "[[redirects]]") { cur = {}; sub = null; redirects.push(cur); continue; }
    if (line === "[[headers]]") { cur = { values: {} }; sub = null; headers.push(cur); continue; }
    if (line === "[headers.values]") { sub = cur && cur.values; continue; }
    if (/^\[/.test(line)) { cur = null; sub = null; continue; }
    const m = /^([A-Za-z0-9_.-]+|"[^"]+")\s*=\s*(.+)$/.exec(line);
    if (!m || !cur) continue;
    const key = m[1].replace(/^"|"$/g, "");
    let v = m[2].trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    else if (v === "true" || v === "false") v = v === "true";
    else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
    (sub || cur)[key] = v;
  }
  return { redirects, headers };
}

/* the first redirect/rewrite that applies to a path, as Netlify picks it:
   a rule only applies when no real file answers the address, unless it says
   force = true. -> { to, status } or null */
export function applyRedirects(redirects, path, fileExists) {
  for (const r of redirects) {
    const { re, names } = patternRegex(String(r.from));
    const m = re.exec(path);
    if (!m) continue;
    if (!r.force && fileExists && fileExists(path)) return null;
    let to = String(r.to);
    names.forEach((n, i) => { to = to.split(":" + n).join(m[i + 1]); });
    return { to, status: r.status || 301, force: !!r.force };
  }
  return null;
}

/* the Cache-Control and other [[headers]] from netlify.toml for a path */
export function tomlHeadersFor(tomlHeaders, path) {
  const out = {};
  for (const h of tomlHeaders) {
    if (!patternRegex(String(h.for)).re.test(path)) continue;
    for (const k of Object.keys(h.values || {})) (out[k.toLowerCase()] = out[k.toLowerCase()] || []).push(String(h.values[k]));
  }
  return out;
}

/* ------------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const { companies, problems } = await readCompanies();
  if (problems.length) {
    console.log("FAIL: _headers was not written, because a company's settings need fixing first:");
    for (const p of problems) console.log("  - " + p);
    process.exitCode = 1;
    return;
  }
  const text = buildHeaders({ companies, indexHtml: readFileSync(resolvePath(ROOT, "index.html"), "utf8") });
  if (args.includes("--print")) { process.stdout.write(text); return; }
  const now = existsSync(HEADERS_FILE) ? readFileSync(HEADERS_FILE, "utf8") : null;
  if (args.includes("--check")) {
    if (now === text) console.log(`PASSED: _headers is up to date (${companies.length} companies: ${companies.map((c) => c.id).join(", ")}).`);
    else {
      console.log(now == null ? "FAIL: there is no _headers file yet." : "FAIL: _headers is out of date: a company's allowed websites, its quote address or index.html's scripts changed since it was written.");
      console.log("  Run: node tools/build-headers.mjs");
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(HEADERS_FILE, text);
  console.log(`Wrote _headers for ${companies.length} companies:`);
  for (const c of companies) {
    const anc = frameOrigins(c.company);
    console.log(`  ${c.id.padEnd(16)} may be shown on this site${anc.length ? " and on " + anc.join(", ") : " only"}${c.company.status === "suspended" ? "  (suspended)" : ""}`);
  }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
