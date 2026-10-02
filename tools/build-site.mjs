/* Explicit shipping boundary: default client output contains no lessons,
   skills, reference photos, tests, source tools or server code. Only Alan's
   learning preview opts into the extra public lesson pages. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { resolve, dirname, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { buildHeaders, readCompanies, inlineScriptHashes } from "./build-headers.mjs";
import { includeLearningPreview } from "./site-profiles.mjs";

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
copy("index.html"); copy("embed.js"); copy("portal.html");
moduleGraph("ui/app.js");
// app.js intentionally lazy-loads these by name after the first model render.
for (const name of ["views", "blueprint", "quote", "share", "embed-mode"]) moduleGraph(`ui/${name}.js`);
for (const name of ["styles", "views", "blueprint", "quote", "share", "embed-mode", "portal"]) copy(`ui/${name}.css`);
tree("fonts"); tree("library");
const { companies, problems } = await readCompanies();
if (problems.length) throw new Error(problems.join("\n"));
const selected = companies.filter(c => learning || !c.id.startsWith("learning-"));
for (const c of selected) tree(`companies/${c.id}`);
if (learning) {
  for (const file of readdirSync(root).filter(f => /\.html$/.test(f) && !["index.html", "portal.html", "embed-demo.html"].includes(f))) copy(file);
  for (const file of readdirSync(resolve(root, "ui")).filter(f => /^(learn.*|setup|parts-gallery|part-details)\.js$/.test(f))) moduleGraph(`ui/${file}`);
  copy("ui/learn.css"); tree("images");
}
await build({ entryPoints: [resolve(root, "ui/portal.js")], outfile: resolve(out, "ui/portal.js"),
  bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, logLevel: "warning",
  define: { __PORTAL_DEMO__: JSON.stringify(learning) } });
const html = readFileSync(resolve(root, "index.html"), "utf8");
let headers = buildHeaders({ companies: selected, indexHtml: html });
headers += "\n/portal*\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\n  Cache-Control: no-store\n";
writeFileSync(resolve(out, "_headers"), headers);
writeFileSync(resolve(out, "404.html"), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found</title><h1>Page not found</h1><p><a href="/">Open the designer</a></p></html>');
// A function serves dealer pages with the lot's current embedding permissions.
const generated = resolve(root, "server/generated"); mkdirSync(generated, { recursive: true });
writeFileSync(resolve(generated, "designer.js"), `export const html = ${JSON.stringify(html)};\nexport const hashes = ${JSON.stringify(inlineScriptHashes(html))};\n`);
console.log(`Built ${relative(root, out)}: ${learning ? "Alan's learning preview + client portal" : "customer designer + client portal; no learning assets or skills"}`);
