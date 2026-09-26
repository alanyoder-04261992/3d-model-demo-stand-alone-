/* CHECK: THE DOCUMENTS AND THE WORKFLOW SKILLS TELL THE TRUTH ABOUT THIS REPO.
   Run: node tools/check-docs.mjs            (check-all: node)

   WHY. Alan does not read code: README.md, docs/FOR-ALAN.md and
   docs/SELLING.md are how he (and whoever he sells to) knows what this is,
   and the workflow skills (.claude/skills/new-company, add-a-style,
   add-a-part, check-the-look, change-construction) are how the next Claude
   session knows what to do. A document that names a tool that is not there,
   a command flag the tool does not read, a skill nobody wrote or a page that
   does not exist sends somebody the wrong way -- and nobody notices until
   they are stuck. This check reads those documents and holds every name in
   them to the files on disk.

   WHAT IT PROVES, for each document:
   1. FILES AND FOLDERS. Every path it names exists: in the repo (models/,
      tools/ ...), at the top of the repo (index.html, embed.js ...), anywhere
      in the repo for a bare file name (company.json), or -- for Barnwright's
      files, which live outside this repo -- in Barnwright's folder (skipped,
      with a note, on a machine that has no copy of it). A path with a
      placeholder (companies/<id>/company.json, part-<id>) must match at least
      one real file. Deliberate examples are allowed and counted: the example
      company "acme", the example spreadsheet prices.csv, and pictures under
      test/out/ (the checks make those as they run).
   2. TOOLS AND SKILLS. Every tool named bare (check-golden, import-prices
      ...) is a file in tools/, and every skill named (`new-company` skill,
      part-skids ...) has its SKILL.md -- except a name in a paragraph that
      says it is "not written yet" (then it is listed as promised).
   3. COMMANDS. Every "node tools/<x>.mjs" names a real tool, and every
      --option given to it is one that tool's own source reads; every
      "npm run <x>" is a script in package.json.
   4. LINKS. Every relative link [text](target) leads to a file that exists,
      and a #section on a Markdown file to a heading that exists.
   5. THE WORKFLOW SKILLS each start with frontmatter whose name is their
      folder's and whose description says WHEN to use them.
   6. EVERY PART HAS ITS SKILL: every PIPELINE entry and every part label it
      draws (parts/index.js) has .claude/skills/part-<id>/SKILL.md -- and
      tools/check-parts.mjs, which checks each skill's sections, passes.
   7. THE FACTS ALAN IS TOLD ARE THE FILES' FACTS: every number the settings
      files still mark as an ASSUMPTION (library/construction.json
      "...Assumed", a style's "assumed": true) is listed under "What you still
      need to decide" in docs/FOR-ALAN.md with its current values; and the
      things FOR-ALAN.md states as settled numbers (the template's true
      colour, the demo's warm light, 7/16 in OSB, 4x8x16 blocks one per 4 ft,
      24 in trusses, 16 in studs and joists) are what the files say.
   Printed as NOTES (they never fail the check, so another person's new check
   or a fix elsewhere cannot turn this red): a tools/check-*.mjs the README's
   table does not list yet, and a document that still calls something "not
   written yet" or "not loaded yet" after it has been done. */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, relative, basename, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PIPELINE } from "../parts/index.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BARNWRIGHT_ROOT = "/home/user/boisterous-lokum-a737e0";   /* read only, never written */

export const WORKFLOW_SKILLS = Object.freeze(["new-company", "add-a-style", "add-a-part", "check-the-look", "change-construction"]);
export const DOCS = Object.freeze(["README.md", "docs/FOR-ALAN.md", "docs/SELLING.md",
  ...WORKFLOW_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`)]);

/* Names that are examples on purpose, never real files. */
const EXAMPLE_SEGMENTS = new Set(["acme"]);
const EXAMPLE_FILES = new Set(["prices.csv", "acme-prices.csv"]);
/* Folders at the top of the repo a path may start with. */
const TOP_DIRS = [".claude", "tools", "model", "engine", "parts", "ui", "library", "companies", "docs", "test", "fonts"];
/* Tools named bare, without tools/ in front (besides every check-*). */
const BARE_TOOLS = ["new-company", "import-prices", "list-companies", "build-headers", "capture-golden", "extract-barnwright-catalogue"];

let pass = 0;
const failures = [], notes = [];
function ok(what, cond, why) {
  if (cond) { pass++; return true; }
  failures.push(what + (why ? " -- " + why : ""));
  return false;
}
const J = JSON.stringify;
const read = (rel) => readFileSync(resolve(ROOT, rel), "utf8");

/* ---- every file and folder in the repo (the big recorded folders left out) ---- */
const SKIP_WALK = new Set([".git", "node_modules", "test/out", "test/golden/geometry", "test/golden/geometry-full"]);
const FILES = [], DIRS = [];
(function walk(rel) {
  for (const n of readdirSync(resolve(ROOT, rel || "."))) {
    const r = rel ? rel + "/" + n : n;
    if (SKIP_WALK.has(r)) { DIRS.push(r); continue; }
    if (statSync(resolve(ROOT, r)).isDirectory()) { DIRS.push(r); walk(r); } else FILES.push(r);
  }
})("");
const FILESET = new Set(FILES), DIRSET = new Set(DIRS);
const BASENAMES = new Set(FILES.map((f) => basename(f)));

function isPlaceholder(p) { return /<[^>]*>|\*/.test(p); }
function patternRe(p) {
  const esc = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + esc.replace(/<[^>]*>/g, "[^/]+").replace(/\*/g, "[^/]*") + "$");
}
function exampleOf(p) { return p.split("/").some((s) => EXAMPLE_SEGMENTS.has(s)) || EXAMPLE_FILES.has(basename(p)); }

/* Does a path named in a document exist? -> {ok, how} */
function pathExists(raw, isDir) {
  let p = raw.replace(/\/+$/, "");
  if (p.startsWith("/")) {                                    /* an absolute path: outside the repo ... */
    if (p.startsWith(BARNWRIGHT_ROOT) && !existsSync(BARNWRIGHT_ROOT)) return { ok: true, how: "barnwright-absent" };
    if (existsSync(p)) return { ok: true, how: "absolute" };
    const site = p.slice(1);                                  /* ... or an address on the designer's own site */
    if (FILESET.has(site) || DIRSET.has(site)) return { ok: true, how: "file" };
    return { ok: false, how: "absolute" };
  }
  if (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("test/out")) return { ok: true, how: "made-by-checks" };
  if (exampleOf(p)) return { ok: true, how: "example" };
  if (isPlaceholder(p)) {
    const re = patternRe(p), list = isDir ? DIRS : FILES.concat(DIRS);
    return { ok: list.some((f) => re.test(f)), how: "pattern" };
  }
  if (!p.includes("/")) {
    if (isDir) return { ok: DIRSET.has(p), how: "folder" };
    if (FILESET.has(p) || BASENAMES.has(p)) return { ok: true, how: "file" };
    if (existsSync(join(BARNWRIGHT_ROOT, "public", p))) return { ok: true, how: "barnwright" };
    if (!existsSync(BARNWRIGHT_ROOT) && /^3ddesign\.html$/.test(p)) return { ok: true, how: "barnwright-absent" };
    return { ok: false, how: "file" };
  }
  if (isDir) return { ok: DIRSET.has(p) || existsSync(resolve(ROOT, p)), how: "folder" };
  if (FILESET.has(p) || existsSync(resolve(ROOT, p))) return { ok: true, how: "file" };
  if (FILES.some((f) => f.endsWith("/" + p))) return { ok: true, how: "file" };   /* named from inside its folder */
  const first = p.split("/")[0];
  if (TOP_DIRS.indexOf(first) < 0) {                          /* not a repo path: Barnwright's? */
    if (existsSync(join(BARNWRIGHT_ROOT, p)) || existsSync(join(dirname(BARNWRIGHT_ROOT), p))) return { ok: true, how: "barnwright" };
    if (!existsSync(BARNWRIGHT_ROOT) && /3ddesign\.html$/.test(p)) return { ok: true, how: "barnwright-absent" };
  }
  return { ok: false, how: "file" };
}

/* ---- the text of a document, made ready to scan ---- */
const URL_RE = /\b(?:https?|mailto):\/?\/?(?:<[^>\n]*>|[^\s)\]`'"<>])+/g;
function scanText(src) {
  return src
    .replace(/\\\r?\n/g, " ")                     /* a command continued with \ is one line */
    .replace(/\]\((?!https?:|mailto:|#)[^)\s]*\)/g, "]()")   /* link targets are checked as links (4) */
    .replace(URL_RE, " ");
}
function paragraphs(src) { return src.split(/\r?\n\s*\r?\n/); }

const FILE_RE = /(^|[^A-Za-z0-9_.\/<>*~-])(\/?(?:[A-Za-z0-9_.<>*-]+\/)*[A-Za-z0-9_<>*-][A-Za-z0-9_.<>*-]*\.(?:mjs|js|json|md|html|css|toml|csv|png|jpg|woff2|txt))(?![A-Za-z0-9_])/g;
const DIR_RE = new RegExp("(^|[\\s`(\"'])((?:" + TOP_DIRS.map((d) => d.replace(".", "\\.")).join("|") + ")\\/(?:[A-Za-z0-9_.<>*-]+\\/)*)(?=[\\s`),;:!?\"']|\\.(?:\\s|$)|$)", "gm");
const NODE_RE = /\bnode\s+(tools\/[A-Za-z0-9_.-]+\.mjs)([^\n`|]*)/g;
const NPM_RE = /\bnpm\s+run\s+([a-z0-9:_-]+)/g;
const BARE_RE = new RegExp("(^|[^A-Za-z0-9_\\/.-])((?:check-[a-z0-9-]+)|" + BARE_TOOLS.join("|") + ")(?![A-Za-z0-9_-])(?!\\.mjs)", "g");
const SKILL_RE = /`([a-z0-9][a-z0-9-]*)`\s+skill|skills?\s+`([a-z0-9][a-z0-9-]*)`|(?<![A-Za-z0-9_-])(part-[a-z0-9<>-]*[a-z0-9>])(?![A-Za-z0-9_-])/g;
const LINK_RE = /\[([^\]\n]*)\]\(([^)\s]+)\)/g;

const pkg = JSON.parse(read("package.json"));
const toolSrc = new Map();
function toolSource(rel) {
  if (!toolSrc.has(rel)) toolSrc.set(rel, existsSync(resolve(ROOT, rel)) ? read(rel) : null);
  return toolSrc.get(rel);
}
function skillExists(name) { return existsSync(resolve(ROOT, ".claude/skills", name, "SKILL.md")); }

const tally = { paths: 0, examples: 0, outside: 0, barnwrightAbsent: 0, tools: 0, flags: 0, npm: 0, skills: 0, links: 0, promised: new Set() };

function slug(h) {
  return h.trim().toLowerCase().replace(/[`*_]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s/g, "-");
}
function headingsOf(rel) { return new Set([...read(rel).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map((m) => slug(m[1]))); }

/* ------------------------------------------------------------------ 1-4 */
for (const doc of DOCS) {
  if (!ok(`${doc} exists`, existsSync(resolve(ROOT, doc)))) continue;
  const raw = read(doc);
  const docDir = dirname(doc);

  /* 4. relative links, from the raw text */
  for (const m of raw.matchAll(LINK_RE)) {
    const target = m[2];
    if (/^(https?:|mailto:|tel:)/.test(target)) continue;
    tally.links++;
    const [file, frag] = target.split("#");
    const rel = file ? posix.normalize(posix.join(docDir.split("\\").join("/"), file)) : doc;
    const there = file ? existsSync(resolve(ROOT, rel)) : true;
    if (!ok(`${doc}: the link [${m[1]}](${target}) leads to a file that exists`, there, `there is no ${rel}`)) continue;
    if (frag && /\.md$/.test(rel)) ok(`${doc}: the link [${m[1]}](${target}) leads to a section that exists`, headingsOf(rel).has(frag), `${rel} has no heading "#${frag}"`);
  }

  for (const para of paragraphs(raw)) {
    const text = scanText(para);
    const promises = /not written yet/i.test(para);
    /* a sentence that calls a tool "not written yet" when the tool is there now */
    if (promises) for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      if (!/not written yet/i.test(sentence)) continue;
      for (const m of sentence.matchAll(/(?:tools\/)?(check-[a-z0-9-]+)(?:\.mjs)?/g)) {
        if (existsSync(resolve(ROOT, "tools", m[1] + ".mjs"))) notes.push(`${doc} still calls ${m[1]} "not written yet", but tools/${m[1]}.mjs exists now -- update it`);
      }
    }

    /* 1. files */
    const fileSpans = [];
    for (const m of text.matchAll(FILE_RE)) {
      const p = m[2];
      fileSpans.push(p);
      const r = pathExists(p, false);
      tally.paths++;
      if (r.how === "example" || r.how === "made-by-checks") { tally.examples++; continue; }
      if (r.how === "barnwright" || r.how === "absolute") tally.outside++;
      if (r.how === "barnwright-absent") { tally.barnwrightAbsent++; continue; }
      const base = basename(p).replace(/\.mjs$/, "");
      if (!r.ok && promises && /^tools\//.test(p) || (!r.ok && promises && !p.includes("/"))) { tally.promised.add(base); continue; }
      ok(`${doc}: names ${p}, which exists`, r.ok, r.how === "pattern" ? "no file matches that pattern" : "not found");
    }
    /* 1. folders (with the file paths taken out first) */
    let rest = text;
    for (const p of fileSpans) rest = rest.split(p).join(" ");
    for (const m of rest.matchAll(DIR_RE)) {
      const r = pathExists(m[2], true);
      tally.paths++;
      if (r.how === "example" || r.how === "made-by-checks") { tally.examples++; continue; }
      ok(`${doc}: names the folder ${m[2]}, which exists`, r.ok);
    }

    /* 3. commands */
    for (const m of text.matchAll(NODE_RE)) {
      const tool = m[1];
      const src = toolSource(tool);
      tally.tools++;
      if (!src && promises) { tally.promised.add(basename(tool, ".mjs")); continue; }
      if (!ok(`${doc}: "node ${tool}" names a tool that exists`, !!src)) continue;
      const args = m[2].replace(/\s#.*$/, "");
      for (const f of args.matchAll(/(?:^|\s)--([a-z][a-z0-9-]*)/g)) {
        tally.flags++;
        ok(`${doc}: "node ${tool} --${f[1]}" -- the tool reads --${f[1]}`, src.includes(f[1]), `${tool} never mentions "${f[1]}"`);
      }
    }
    for (const m of text.matchAll(NPM_RE)) {
      tally.npm++;
      ok(`${doc}: "npm run ${m[1]}" is a script in package.json`, !!(pkg.scripts && pkg.scripts[m[1]]));
    }

    /* 2. tools named bare, and skills */
    let bare = text;
    for (const p of fileSpans) bare = bare.split(p).join(" ");
    for (const m of bare.matchAll(BARE_RE)) {
      const name = m[2];
      if (WORKFLOW_SKILLS.includes(name) && !existsSync(resolve(ROOT, "tools", name + ".mjs"))) continue;   /* a skill, checked below */
      tally.tools++;
      const there = existsSync(resolve(ROOT, "tools", name + ".mjs")) || skillExists(name);
      if (!there && promises) { tally.promised.add(name); continue; }
      ok(`${doc}: names ${name}, which is a tool in tools/ (or a skill)`, there, `there is no tools/${name}.mjs`);
    }
    for (const m of text.matchAll(SKILL_RE)) {
      const name = m[1] || m[2] || m[3];
      if (!name || /^part-$/.test(name)) continue;
      if (/</.test(name)) { tally.skills++; ok(`${doc}: the skill pattern ${name} matches a skill`, DIRS.some((d) => patternRe(".claude/skills/" + name).test(d))); continue; }
      if (m[3] && !skillExists(name) && existsSync(resolve(ROOT, "tools", name + ".mjs"))) continue;
      tally.skills++;
      if (!skillExists(name) && promises) { tally.promised.add(name); continue; }
      ok(`${doc}: names the skill ${name}, which has .claude/skills/${name}/SKILL.md`, skillExists(name));
    }
  }
}

/* ------------------------------------------------------------------ 5 */
for (const s of WORKFLOW_SKILLS) {
  const rel = `.claude/skills/${s}/SKILL.md`;
  if (!existsSync(resolve(ROOT, rel))) continue;   /* reported above */
  const text = read(rel);
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!ok(`${rel} starts with a --- frontmatter block ---`, !!fm)) continue;
  const name = /^name:\s*(.+?)\s*$/m.exec(fm[1]), desc = /^description:\s*(.+?)\s*$/m.exec(fm[1]);
  ok(`${rel}: frontmatter name is "${s}"`, !!name && name[1] === s, name ? `it is "${name[1]}"` : "no name");
  ok(`${rel}: frontmatter description says when to use it`, !!desc && desc[1].length > 40 && /\b(use|read) (it )?when\b|\bwhen\b/i.test(desc[1]), desc ? desc[1] : "no description");
  ok(`${rel}: has a # title and at least three ## sections`, /^# \S/m.test(text) && (text.match(/^## /gm) || []).length >= 3);
}

/* ------------------------------------------------------------------ 6 */
const partIds = new Set();
for (const en of PIPELINE) {
  if (en.module && en.module.pending === true) continue;
  if (en.module && en.module.id) partIds.add(en.module.id);
  for (const t of en.tags) partIds.add(t);
}
for (const id of [...partIds].sort()) ok(`part "${id}" has its skill .claude/skills/part-${id}/SKILL.md`, skillExists("part-" + id), "write it from docs/SKILL-TEMPLATE.md (the add-a-part skill)");
const cp = spawnSync(process.execPath, [resolve(ROOT, "tools/check-parts.mjs")], { cwd: ROOT, encoding: "utf8", timeout: 5 * 60 * 1000 });
const cpLines = ((cp.stdout || "") + (cp.stderr || "")).split("\n").map((l) => l.trim()).filter(Boolean);
ok("tools/check-parts.mjs passes (every part valid, every skill well formed, no skill without a part)", cp.status === 0,
  cpLines.filter((l) => /^(FAIL|-)/.test(l)).slice(0, 12).join(" | ") || cpLines.slice(-3).join(" | "));

/* ------------------------------------------------------------------ 7 */
{
  const alan = existsSync(resolve(ROOT, "docs/FOR-ALAN.md")) ? read("docs/FOR-ALAN.md") : "";
  const decide = (/## What you still need to decide([\s\S]*?)(?=\n## |$)/.exec(alan) || [, ""])[1];
  const con = JSON.parse(read("library/construction.json"));
  const flat = decide.replace(/\s+/g, " ").toLowerCase();       /* a name may wrap onto the next line */
  const has = (s) => flat.includes(String(s).replace(/\s+/g, " ").toLowerCase());
  /* the numbered items of that section ("1. **Loft depth: ...") -- a number
     must be in the item about its own subject, not just anywhere */
  const items = decide.split(/\n(?=\d+\.\s)/).map((t) => t.replace(/\s+/g, " "));
  const itemsAbout = (word) => items.filter((t) => t.toLowerCase().includes(String(word).toLowerCase()));
  const numIn = (n, list) => list.some((t) => new RegExp("(^|[^0-9.])" + String(n).replace(".", "\\.") + "(?![0-9])").test(t.replace(/^\d+\.\s/, "")));
  ok("docs/FOR-ALAN.md has a \"What you still need to decide\" section that speaks of ASSUMPTIONS", decide.length > 200 && /assumption/i.test(decide));

  /* every "...Assumed": true in library/construction.json, e.g. site.anchorsAssumed */
  (function walk(v, path) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    for (const k of Object.keys(v)) {
      if (/Assumed$/.test(k) && v[k] === true) {
        const what = k.replace(/Assumed$/, "");
        const word = what.replace(/s$/, "");
        ok(`the assumption ${path}${k} (library/construction.json) is listed for Alan in docs/FOR-ALAN.md`, has(word), `"${word}" is not mentioned under What you still need to decide`);
        const vals = [];
        (function nums(x) { if (typeof x === "number") vals.push(x); else if (x && typeof x === "object") for (const y of Object.values(x)) nums(y); })(v[what]);
        const missing = vals.filter((n) => !numIn(n, itemsAbout(word)));
        ok(`docs/FOR-ALAN.md gives the current numbers of ${path}${what}`, missing.length === 0, `these numbers of ${path}${what} are not in its list: ${missing.join(", ")}`);
      } else walk(v[k], path + k + ".");
    }
  })(con, "");

  /* every style whose trait carries "assumed": true in a manufacturer file */
  for (const f of readdirSync(resolve(ROOT, "library/manufacturers")).filter((n) => n.endsWith(".json"))) {
    const m = JSON.parse(read("library/manufacturers/" + f));
    const byTrait = new Map();
    for (const [k, s] of Object.entries(m.styles || {})) for (const [t, v] of Object.entries(s || {})) {
      if (v && typeof v === "object" && v.assumed === true) { if (!byTrait.has(t)) byTrait.set(t, []); byTrait.get(t).push([k, v]); }
    }
    for (const [t, list] of byTrait) {
      ok(`the assumed "${t}" of ${list.length} style(s) in library/manufacturers/${f} is listed for Alan in docs/FOR-ALAN.md`, has(t), `"${t}" is not mentioned under What you still need to decide`);
      const depths = [...new Set(list.map(([, v]) => v.depthFt).filter((n) => typeof n === "number"))];
      for (const d of depths) ok(`docs/FOR-ALAN.md gives the assumed ${t} depth (${d} ft)`, itemsAbout(t + " depth").some((x) => new RegExp("(^|[^0-9.])" + d + " ft").test(x)),
        `the item about "${t} depth" under What you still need to decide does not say ${d} ft`);
      const names = list.map(([k]) => (m.styles[k].name || k));
      const unnamed = names.filter((n) => !has(n));
      ok(`docs/FOR-ALAN.md names every style with the assumed ${t} (${names.length})`, unnamed.length === 0, `not named: ${unnamed.join(", ")}`);
    }
  }

  /* the settled numbers FOR-ALAN.md states, against the files */
  const tpl = JSON.parse(read("companies/_template/company.json"));
  const demo = JSON.parse(read("companies/demo/company.json"));
  const CLAIMS = [
    [/New companies start with \*\*true colour\*\*/, () => tpl.look && tpl.look.trueColour === true, "companies/_template/company.json look.trueColour is not true"],
    [/demo keeps \*\*Barnwright's warm/, () => demo.look && demo.look.trueColour === false, "companies/demo/company.json look.trueColour is not false"],
    [/7\/16 in OSB/, () => con.roofDeck && con.roofDeck.sheathingIn === 0.4375, "library/construction.json roofDeck.sheathingIn is not 0.4375 (7/16 in)"],
    [/4x8x16 concrete blocks, one per 4 ft/, () => con.site.blocks === "4x8x16" && con.site.perimeterFtPerBlock === 4, "library/construction.json site is not 4x8x16 one per 4 ft"],
    [/trusses\*\* \(not rafters\) \*\*24 in on centre/, () => con.roof.framing === "truss" && con.roof.spacingIn === 24 && con.roof.chord === "2x4", "library/construction.json roof is not 2x4 trusses at 24 in"],
    [/2x4 studs 16 in on centre, three-stud corners/, () => con.walls.stud === "2x4" && con.walls.spacingIn === 16 && con.walls.corner === "3-stud", "library/construction.json walls are not 2x4 at 16 in with 3-stud corners"],
    [/Floor joists 16 in on centre/, () => con.floor.spacingIn === 16 && con.floor.rim === "2x6", "library/construction.json floor is not 16 in with a 2x6 rim"],
    [/4x4 posts, 2x6 deck joists, railing 34 in/, () => con.porch.post === "4x4" && con.porch.joist === "2x6" && con.porch.railHeightIn === 34, "library/construction.json porch is not 4x4 / 2x6 / 34 in"],
    [/2x4 purlins laid flat,\s+24 in apart/, () => con.roofDeck.purlins.size === "2x4" && con.roofDeck.purlins.spacingIn === 24, "library/construction.json purlins are not 2x4 at 24 in"],
  ];
  for (const [re, test, why] of CLAIMS) {
    if (!re.test(alan)) { notes.push(`docs/FOR-ALAN.md no longer says ${re} -- the fact check for it was skipped`); continue; }
    ok(`docs/FOR-ALAN.md states what the files say (${String(re).slice(1, 50)}...)`, test(), why);
  }
  const order = (con.buildOrder || []).length;
  ok(`docs/FOR-ALAN.md lists the Watch it build order with all ${order} steps`, (/\*\*The Watch it build order\*\* \(([^)]*)\)/.exec(alan) || [, ""])[1].split(",").length === order,
    "the list in 'What you still need to decide' does not have one entry per step of library/construction.json buildOrder");
}

/* ------------------------------------------------------------------ notes */
{
  const readme = existsSync(resolve(ROOT, "README.md")) ? read("README.md") : "";
  for (const f of readdirSync(resolve(ROOT, "tools")).filter((n) => /^check-.*\.mjs$/.test(n) && n !== "check-all.mjs")) {
    if (!readme.includes("`" + f + "`")) notes.push(`README.md's table of checks does not list tools/${f} yet -- add a line saying what it proves`);
  }
  const app = existsSync(resolve(ROOT, "ui/app.js")) ? read("ui/app.js") : "";
  const alan = existsSync(resolve(ROOT, "docs/FOR-ALAN.md")) ? read("docs/FOR-ALAN.md") : "";
  if (/embed-mode/.test(app.replace(/\/\*[\s\S]*?\*\//g, "")) && /does not\s+load it yet/.test(alan)) notes.push("ui/app.js loads ui/embed-mode.js now, but docs/FOR-ALAN.md still says it does not -- update \"Not finished yet\"");
}

/* ------------------------------------------------------------------ report */
const promised = [...tally.promised];
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${pass + failures.length} documentation checks failed:`);
  for (const f of failures) console.log("  - " + f);
  for (const n of notes) console.log("  note: " + n);
  process.exitCode = 1;
} else {
  console.log(`PROVED (${pass} checks): the ${DOCS.length} documents (${DOCS.join(", ")}) name only things that exist.`);
  console.log(`  ${tally.paths} file and folder names found on disk (${tally.examples} deliberate examples or pictures the checks make; ${tally.outside} outside this repo, in Barnwright or the system` +
    `${tally.barnwrightAbsent ? `; ${tally.barnwrightAbsent} in Barnwright skipped -- no copy on this machine` : ""}); ${tally.tools} tool names and commands, ${tally.flags} --options each read by its tool, ${tally.npm} npm scripts, ${tally.skills} skill names and ${tally.links} relative links all real.`);
  console.log(`  The ${WORKFLOW_SKILLS.length} workflow skills have frontmatter that names them and says when to use them.`);
  console.log(`  Every one of the ${partIds.size} parts and part labels in the PIPELINE has its skill, and tools/check-parts.mjs passes.`);
  console.log(`  Every number the settings still mark as an ASSUMPTION is listed for Alan in docs/FOR-ALAN.md with its current values, and the settled numbers it states are the files' numbers.`);
  if (promised.length) console.log(`  Named as promised but not written yet: ${promised.join(", ")}.`);
  for (const n of notes) console.log("  note: " + n);
}
