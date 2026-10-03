/* BUILDS THE WEBSITE (npm run build -> dist/, npm run build:client ->
   dist-client/). Only what is listed here ships: the 3D designer (index.html,
   embed.js and the browser files ui/app.js reaches), the Dealer Center
   (dealer.html, its screens bundled into one file, ui/office/main.js, and
   its stylesheets, including ui/office/closed.css for a closed lot's link),
   the fonts, the builder's library and the example companies. Never shipped:
   lesson pages, skills, reference photos, tests, tools, docs, server code or
   source maps. Only Alan's learning preview adds the lesson pages.

   It also writes:
     <out>/_headers          the designer's rules (tools/build-headers.mjs)
                             plus the Dealer Center's: its security policy
                             (OFFICE_POLICY, server/office/pages.js -- the
                             same one the local Dealer Center sends) and
                             "never keep a copy" (Cache-Control: no-store)
     <out>/404.html          a plain "Page not found"
     server/generated/designer.js   index.html and the fingerprints of its
                             inline scripts, for the function that serves a
                             lot's designer (netlify/functions/lot-designer.mts);
                             written every build, so an edit to index.html
                             reaches the lot links on the next deploy */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildHeaders, readCompanies, inlineScriptHashes } from "./build-headers.mjs";
import { includeLearningPreview } from "./site-profiles.mjs";
import { OFFICE_POLICY } from "../server/office/pages.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = process.argv.includes("--client");
const learning = includeLearningPreview({ client });
const out = resolve(root, client ? "dist-client" : "dist");
if (dirname(out) !== root || !["dist", "dist-client"].includes(relative(root, out))) throw new Error("Unexpected build directory");
if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
const copied = new Set();
function copy(path) {
  const source = resolve(root, path), dest = resolve(out, path);
  if (!source.startsWith(root + "/") && !source.startsWith(root + "\\")) throw new Error("Source outside project");
  if (copied.has(path)) return;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(source, dest); copied.add(path);
}
function tree(path) {
  for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) tree(child); else copy(child);
  }
}
function moduleGraph(path) {
  path = relative(root, resolve(root, path)).replaceAll("\\", "/");
  if (copied.has(path)) return;
  if (!/^(ui|model|engine|parts)\/.+\.js$/.test(path)) throw new Error(`Unexpected browser module ${path}`);
  if (!learning && /^ui\/(learn|setup|parts-gallery|part-details)/.test(path)) throw new Error(`Internal tool entered client graph: ${path}`);
  copy(path);
  const code = readFileSync(resolve(root, path), "utf8");
  for (const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+\.js)["']/g)) {
    moduleGraph(relative(root, resolve(root, dirname(path), match[1])));
  }
}
copy("index.html"); copy("embed.js"); copy("dealer.html");
moduleGraph("ui/app.js");
// app.js intentionally lazy-loads these by name after the first model render.
for (const name of ["views", "blueprint", "quote", "share", "embed-mode"]) moduleGraph(`ui/${name}.js`);
for (const name of ["styles", "views", "blueprint", "quote", "share", "embed-mode"]) copy(`ui/${name}.css`);
// The Dealer Center's stylesheets (its script is bundled below), and
// closed.css, the page a closed lot's designer link shows.
if (!existsSync(resolve(root, "ui/office/closed.css"))) throw new Error("ui/office/closed.css is missing: a closed lot's link needs it");
for (const file of readdirSync(resolve(root, "ui/office")).filter(f => f.endsWith(".css")).sort()) copy(`ui/office/${file}`);
tree("fonts"); tree("library");
const { companies, problems } = await readCompanies();
if (problems.length) throw new Error(problems.join("\n"));
const selected = companies.filter(c => learning || !c.id.startsWith("learning-"));
for (const c of selected) tree(`companies/${c.id}`);
if (learning) {
  for (const file of readdirSync(root).filter(f => /\.html$/.test(f) && !["index.html", "dealer.html", "embed-demo.html"].includes(f))) copy(file);
  for (const file of readdirSync(resolve(root, "ui")).filter(f => /^(learn.*|setup|parts-gallery|part-details)\.js$/.test(f))) moduleGraph(`ui/${file}`);
  copy("ui/learn.css"); tree("images");
}
// The Dealer Center's screens: one minified file, no source map (the
// local Dealer Center, tools/office-local.mjs, bundles the same entry on the fly).
await build({ entryPoints: [resolve(root, "ui/office/main.js")], outfile: resolve(out, "ui/office/main.js"),
  bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, sourcemap: false,
  legalComments: "none", logLevel: "warning" });
const html = readFileSync(resolve(root, "index.html"), "utf8");
let headers = buildHeaders({ companies: selected, indexHtml: html });
// /dealer is rewritten to dealer.html (netlify.toml); Netlify matches these
// rules on the address asked for, so both addresses carry the same policy.
headers += "\n# the Dealer Center: this site's own files only, never shown in another website's frame, never kept\n";
for (const path of ["/dealer", "/dealer.html"]) {
  headers += `${path}\n  Content-Security-Policy: ${OFFICE_POLICY}\n  Cache-Control: no-store\n\n`;
}
writeFileSync(resolve(out, "_headers"), headers);
writeFileSync(resolve(out, "404.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found</title><h1>Page not found</h1><p><a href="/">Open the designer</a></p></html>');
// The function that serves a lot's designer (/d/<lot>/) sends this page with
// that lot's own list of websites allowed to show it.
const generated = resolve(root, "server/generated"); mkdirSync(generated, { recursive: true });
writeFileSync(resolve(generated, "designer.js"), `export const html = ${JSON.stringify(html)};\nexport const hashes = ${JSON.stringify(inlineScriptHashes(html))};\n`);
console.log(`Built ${relative(root, out)}: ${learning ? "Alan's learning preview + the Dealer Center" : "the customer's 3D designer + the Dealer Center; no lessons or skills"}`);
