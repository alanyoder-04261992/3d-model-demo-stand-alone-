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
      part-skids, "the add-a-style skill" in plain words ...) has its
      SKILL.md -- except a name in a SENTENCE that says it is "not written
      yet" AND that the contract (docs/ARCHITECTURE.md) promises (then it is
      listed as promised; any other missing name fails).
   3. COMMANDS. Every "node tools/<x>.mjs" names a real tool, and every
      --option given to it is one that tool's own source names as a whole
      word (--nam is not --name); an --option written in backticks on its own
      (`--dry-run`) is one some tool reads; every "npm run <x>" is a script
      in package.json.
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
      need to decide" in docs/FOR-ALAN.md with its current values; a settings
      note that says ASSUMPTION without that mark fails (Alan would never be
      asked); and every number FOR-ALAN.md states about how the sheds are
      built (the light, OSB, purlins, blocks, trusses, studs, headers,
      plates, stud lengths, floor joists, decking, rim, door openings, bench
      and shelf, loft joists, porch, the width notes and the Watch it build
      order, step by step) is READ from its sentence and compared with the
      files -- a changed number fails; only a sentence that is gone is a note.
   8. THE COUNTS: every "N recorded buildings" is test/golden's count, every
      "N finished pictures" test/golden/look's, and README's "browser?"
      column says what tools/check-all.mjs decides for each check.
   Printed as NOTES (they never fail the check, so another person's new check
   or a fix elsewhere cannot turn this red): a tools/check-*.mjs the README's
   table does not list yet, and a document that still calls something "not
   written yet" or "not loaded yet" after it has been done. */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join, relative, basename, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { PIPELINE } from "../parts/index.js";
import { INTERIOR_DEFAULTS } from "../parts/interior.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BARNWRIGHT_ROOT = "/home/user/boisterous-lokum-a737e0";   /* read only, never written */

export const WORKFLOW_SKILLS = Object.freeze(["new-company", "add-a-style", "add-a-part", "check-the-look", "change-construction", "shed-customer-setup"]);
export const DOCS = Object.freeze(["README.md", "docs/FOR-ALAN.md", "docs/SELLING.md",
  "docs/BUILDING-TERMS.md", "docs/examples/10x16-side-loft.md", ".agents/skills/shed-customer-setup/SKILL.md",
  ...WORKFLOW_SKILLS.map((s) => `.claude/skills/${s}/SKILL.md`)]);

/* Names that are examples on purpose, never real files. */
const EXAMPLE_SEGMENTS = new Set(["acme"]);
const EXAMPLE_FILES = new Set(["prices.csv", "acme-prices.csv"]);
/* Folders at the top of the repo a path may start with. */
const TOP_DIRS = [".agents", ".claude", "tools", "model", "engine", "parts", "ui", "library", "companies", "docs", "test", "fonts"];
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

const FILE_RE = /(^|[^A-Za-z0-9_.\/<>*~-])(\/?(?:[A-Za-z0-9_.<>*-]+\/)*[A-Za-z0-9_<>*-][A-Za-z0-9_.<>*-]*\.(?:mjs|js|json|md|html|css|toml|csv|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|txt|pdf|sh|py|ya?ml|xml))(?![A-Za-z0-9_])/g;
const DIR_RE = new RegExp("(^|[\\s`(\"'])((?:" + TOP_DIRS.map((d) => d.replace(".", "\\.")).join("|") + ")\\/(?:[A-Za-z0-9_.<>*-]+\\/)*)(?=[\\s`),;:!?\"']|\\.(?:\\s|$)|$)", "gm");
const NODE_RE = /\bnode\s+(tools\/[A-Za-z0-9_.-]+\.mjs)([^\n`|]*)/g;
const NPM_RE = /\bnpm\s+run\s+([a-z0-9:_-]+)/g;
const BARE_RE = new RegExp("(^|[^A-Za-z0-9_\\/.-])((?:check-[a-z0-9-]+)|" + BARE_TOOLS.join("|") + ")(?![A-Za-z0-9_-])(?!\\.mjs)", "g");
/* a skill named in backticks, a part-<id> name, or a hyphenated name followed by
   the word "skill" in plain words ("use the add-a-style skill") */
const SKILL_RE = /`([a-z0-9][a-z0-9-]*)`\s+skill|skills?\s+`([a-z0-9][a-z0-9-]*)`|(?<![A-Za-z0-9_-])(part-[a-z0-9<>-]*[a-z0-9>])(?![A-Za-z0-9_-])|(?<=\bthe\s+)([a-z0-9]+(?:-[a-z0-9]+)+)\s+skill\b/g;
/* an --option written in backticks anywhere (`--dry-run`, `--part skids,floor`) */
const FLAG_TICK_RE = /`(--[a-z][a-z0-9-]*)(?=[\s=`])/g;
/* does a tool's source mention --flag as a whole word (not --name for --nam)? */
function readsFlag(src, flag) { return new RegExp("--" + flag.replace(/[-]/g, "\\-") + "(?![A-Za-z0-9-])").test(src); }
/* every source under tools/ (the checks, the setup tools and tools/lib) */
const ALL_TOOL_SRC = readdirSync(resolve(ROOT, "tools")).filter((n) => n.endsWith(".mjs")).map((n) => "tools/" + n)
  .concat(existsSync(resolve(ROOT, "tools/lib")) ? readdirSync(resolve(ROOT, "tools/lib")).filter((n) => n.endsWith(".mjs")).map((n) => "tools/lib/" + n) : []);
/* A name excused as "not written yet" must be something the contract really
   promises (docs/ARCHITECTURE.md names it) -- otherwise the phrase would let
   any misspelt tool name through. */
const CONTRACT = existsSync(resolve(ROOT, "docs/ARCHITECTURE.md")) ? readFileSync(resolve(ROOT, "docs/ARCHITECTURE.md"), "utf8") : "";
function promisedByContract(name) { return !!name && CONTRACT.includes(name); }
/* Is the text at index i in a sentence that says "not written yet"? */
function inPromise(text, i) {
  const before = text.slice(0, i), after = text.slice(i);
  const s0 = Math.max(before.lastIndexOf(". "), before.lastIndexOf("! "), before.lastIndexOf("? "), before.lastIndexOf("\n\n"));
  const e = after.search(/[.!?](\s|$)/);
  return /not written yet/i.test(text.slice(s0 + 1, e < 0 ? text.length : i + e + 1));
}
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

  /* 3b. an --option written in backticks away from its command (`--part
     skids,floor`, `--dry-run`): some tool in tools/ reads it (a misspelt or
     invented option is read by none). */
  for (const m of raw.replace(/\\\r?\n/g, " ").matchAll(FLAG_TICK_RE)) {
    const flag = m[1].slice(2);
    tally.flags++;
    ok(`${doc}: the option --${flag} is one a tool in tools/ reads`, ALL_TOOL_SRC.some((t) => readsFlag(toolSource(t) || "", flag)), "no tool in tools/ mentions --" + flag);
  }

  for (const para of paragraphs(raw)) {
    const text = scanText(para);
    /* a name is excused as "not written yet" only in a sentence that says so,
       and only when the contract (docs/ARCHITECTURE.md) promises that name */
    const excused = (i, name) => inPromise(text, i) && promisedByContract(name);
    /* a sentence that calls a tool "not written yet" when the tool is there now */
    if (/not written yet/i.test(para)) for (const sentence of text.split(/(?<=[.!?])\s+/)) {
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
      if (!r.ok && excused(m.index, base)) { tally.promised.add(base); continue; }
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
      if (!src && excused(m.index, basename(tool, ".mjs"))) { tally.promised.add(basename(tool, ".mjs")); continue; }
      if (!ok(`${doc}: "node ${tool}" names a tool that exists`, !!src)) continue;
      const args = m[2].replace(/\s#.*$/, "");
      for (const f of args.matchAll(/(?:^|\s)--([a-z][a-z0-9-]*)/g)) {
        tally.flags++;
        ok(`${doc}: "node ${tool} --${f[1]}" -- the tool reads --${f[1]}`, readsFlag(src, f[1]), `${tool} never mentions "--${f[1]}"`);
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
      if (!there && inPromise(bare, m.index) && promisedByContract(name)) { tally.promised.add(name); continue; }
      ok(`${doc}: names ${name}, which is a tool in tools/ (or a skill)`, there, `there is no tools/${name}.mjs`);
    }
    for (const m of text.matchAll(SKILL_RE)) {
      const name = m[1] || m[2] || m[3] || m[4];
      if (!name || /^part-$/.test(name)) continue;
      if (/</.test(name)) { tally.skills++; ok(`${doc}: the skill pattern ${name} matches a skill`, DIRS.some((d) => patternRe(".claude/skills/" + name).test(d))); continue; }
      if ((m[3] || m[4]) && !skillExists(name) && existsSync(resolve(ROOT, "tools", name + ".mjs"))) continue;
      tally.skills++;
      if (!skillExists(name) && excused(m.index, name)) { tally.promised.add(name); continue; }
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
  // A Claude entry point may forward to the same named Codex skill; check
  // its actual workflow instead of requiring duplicate instructions.
  const canonical = `.agents/skills/${s}/SKILL.md`;
  const forwards = text.includes(`](../../../${canonical})`) && existsSync(resolve(ROOT, canonical));
  const workflow = forwards ? read(canonical) : text;
  ok(`${rel}: workflow has a # title and at least three ## sections${forwards ? " in " + canonical : ""}`,
    /^# \S/m.test(workflow) && (workflow.match(/^## /gm) || []).length >= 3);
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

  /* the numbers FOR-ALAN.md states -- settled or chosen -- against the files.
     Each sentence is found by its SHAPE ("<lumber> studs <n> in on centre"),
     so a changed number is read and compared, never skipped; only a sentence
     that is gone altogether is a note. */
  const tpl = JSON.parse(read("companies/_template/company.json"));
  const demo = JSON.parse(read("companies/demo/company.json"));
  const std = JSON.parse(read("library/manufacturers/standard.json"));
  const flatAlan = alan.replace(/\s+/g, " ");
  const FRAC = { 0.4375: "7/16", 0.625: "5/8", 0.5: "1/2", 0.75: "3/4", 0.375: "3/8", 0.25: "1/4" };
  const frac = (x) => FRAC[x] || String(x);
  const half = (x) => (x % 1 === 0.5 ? Math.floor(x) + "½" : String(x));
  const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const num = (w) => (w in WORDNUM ? WORDNUM[w] : Number(w));
  const rule = (v) => (Array.isArray(v) ? v : [{ value: v }]);
  const hdr = rule(con.walls.header);
  const joist = rule(con.floor.joist);
  const FACTS = [
    ["the light the demo and new companies start with", /start with \*\*([^*]+)\*\*/g,
      (m) => [tpl.look.trueColour === true && demo.look.trueColour === true ? "true colour" : "Barnwright's warm light", m[1]], "companies/_template/company.json and companies/demo/company.json look.trueColour"],
    ["the OSB roof deck", /(\d+\/\d+) in OSB/g, (m) => [frac(con.roofDeck.sheathingIn), m[1]], "library/construction.json roofDeck.sheathingIn"],
    ["the purlins", /(\d+x\d+) purlins laid flat, (\d+) in apart/g,
      (m) => [con.roofDeck.purlins.size + " / " + con.roofDeck.purlins.spacingIn, m[1] + " / " + m[2]], "library/construction.json roofDeck.purlins"],
    ["the blocks", /(\d+x\d+x\d+) concrete blocks, one per (\d+) ft/g,
      (m) => [con.site.blocks + " / " + con.site.perimeterFtPerBlock, m[1] + " / " + m[2]], "library/construction.json site"],
    ["the roof framing", /\*\*Roof framing: (\w+)\*\* \(not \w+\) \*\*(\d+) in on centre\*\*, (\d+x\d+) chords, (\w+) gussets/g,
      (m) => [con.roof.framing + " / " + con.roof.spacingIn + " / " + con.roof.chord + " / " + con.roof.gussets, (/sses$/.test(m[1]) ? m[1].slice(0, -2) : m[1].replace(/s$/, "")) + " / " + m[2] + " / " + m[3] + " / " + m[4]], "library/construction.json roof"],
    ["the studs", /(\d+x\d+) studs (\d+) in on centre, (\w+)-stud corners/g,
      (m) => [con.walls.stud + " / " + con.walls.spacingIn + " / " + con.walls.corner, m[1] + " / " + m[2] + " / " + num(m[3]) + "-stud"], "library/construction.json walls"],
    ["the headers", /headers (\d+x\d+ \w+) over openings up to ([\d½.]+) ft, (\d+x\d+ \w+) up to ([\d½.]+) ft, (\d+x\d+ \w+) wider/g,
      (m) => [hdr.map((r) => r.value + (r.when ? " <= " + half(r.when.maxSpanFt) : "")).join(", "), m[1] + " <= " + m[2] + ", " + m[3] + " <= " + m[4] + ", " + m[5]], "library/construction.json walls.header"],
    ["the plates", /(\w+) bottom plate and (\w+) top plates/g,
      (m) => [con.walls.bottomPlates + " / " + con.walls.topPlates, num(m[1]) + " / " + num(m[2])], "library/construction.json walls plates"],
    ["the stud lengths", /(\d+) in studs on loft walls and (\d+) in on tall walls/g,
      (m) => [con.walls.studLengthIn.loft + " / " + con.walls.studLengthIn.tall, m[1] + " / " + m[2]], "library/construction.json walls.studLengthIn"],
    ["the floor joists", /(\d+x\d+) floor joists on the skids \((\d+x\d+) on (\d+) ft wide and narrower\), (\d+) in on centre/g,
      (m) => [joist.map((r) => r.value + (r.when ? " <=" + r.when.maxW : "")).join(", ") + " @ " + con.floor.spacingIn, m[2] + " <=" + m[3] + ", " + m[1] + " @ " + m[4]], "library/construction.json floor"],
    ["the decking", /(\d+\/\d+) in decking in (\S+) tongue-and-groove sheets/g,
      (m) => [frac(con.floor.deck.thicknessIn) + " / " + String(con.floor.deck.sheet).split(" ")[0], m[1] + " / " + m[2]], "library/construction.json floor.deck"],
    ["the rim joists", /\*\*Rim joists: (\d+x\d+)\*\*/g, (m) => [con.floor.rim, m[1]], "library/construction.json floor.rim"],
    ["the door openings", /door openings (\d+½?) in on barns and (\d+½?) in on tall walls/g,
      (m) => [half(con.openings.doorHeightIn.gambrel) + " / " + half(con.openings.doorHeightIn.other), m[1] + " / " + m[2]], "library/construction.json openings.doorHeightIn"],
    ["the bench and shelf", /work bench (\d+) ft deep and (\d+) ft high, the shelf (\d+) ft deep and (\d+) ft high/g,
      (m) => [[std.items.bench.dep, INTERIOR_DEFAULTS.benchHeightIn / 12, std.items.shelf.dep, INTERIOR_DEFAULTS.shelfHeightIn / 12].join(" / "), [m[1], m[2], m[3], m[4]].join(" / ")], "the bench and shelf items (standard.json) and parts/interior.js INTERIOR_DEFAULTS"],
    ["the loft joists", /loft joists (\d+x\d+) at (\d+) in, a (\d+\/\d+) in loft floor/g,
      (m) => [con.loft.joist + " / " + con.loft.spacingIn + " / " + frac(con.loft.deck.thicknessIn), m[1] + " / " + m[2] + " / " + m[3]], "library/construction.json loft"],
    ["the porch", /(\d+x\d+) posts, (\d+x\d+) deck joists, railing (\d+) in/g,
      (m) => [con.porch.post + " / " + con.porch.joist + " / " + con.porch.railHeightIn, m[1] + " / " + m[2] + " / " + m[3]], "library/construction.json porch"],
  ];
  for (const [what, re, cmp, where] of FACTS) {
    const ms = [...flatAlan.matchAll(re)];
    if (!ms.length) { notes.push(`docs/FOR-ALAN.md no longer states ${what} in the words this check reads (${String(re).slice(1, 60)}...) -- that fact was not compared`); continue; }
    for (const m of ms) {
      const [want, got] = cmp(m);
      ok(`docs/FOR-ALAN.md states ${what} as the files say`, String(want) === String(got), `it says "${got}", ${where} says "${want}"`);
    }
  }
  /* the width notes, word for word */
  {
    const it = itemsAbout("width notes")[0] || "";
    const quoted = [...it.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace(/\.$/, ""));
    const files = Object.values(con.notes || {}).filter((v) => typeof v === "string").map((v) => v.replace(/\.$/, ""));
    if (!it) notes.push("docs/FOR-ALAN.md has no item about the width notes -- they were not compared");
    else ok("docs/FOR-ALAN.md quotes the width notes exactly as library/construction.json has them", J(quoted.slice().sort()) === J(files.slice().sort()), `it quotes ${J(quoted)}, the file has ${J(files)}`);
  }
  /* the internal construction sequence, step by step and in order */
  {
    const WORDS = { foundation: "blocks", "floor-frame": "floor frame", "floor-deck": "decking", "wall-frame": "walls", "porch-frame": "porch posts",
      "roof-frame": "trusses", "dormer-frame": "dormer framing", "gable-end": "gable ends", "roof-deck": "roof deck", interior: "inside" };
    const want = (con.buildOrder || []).map((k) => WORDS[k] || k);
    const list = (/\*\*The internal construction sequence\*\* \(([^)]*)\)/.exec(flatAlan) || [, ""])[1];
    const got = list.split(",").map((x) => x.trim()).filter(Boolean);
    ok(`docs/FOR-ALAN.md lists the internal construction sequence as library/construction.json buildOrder has it (${want.length} steps, in order)`, J(got) === J(want),
      `it lists ${J(got)}; buildOrder reads ${J(want)}`);
  }

  /* a settings note that says ASSUMPTION must also carry the mark this check
     reads (a key ending in Assumed, or "assumed": true), or Alan would never
     be asked about it */
  function helpAssumptions(file, root) {
    (function walk(v, path, holder) {
      if (Array.isArray(v)) { v.forEach((x, i) => walk(x, path + "[" + i + "]", holder)); return; }
      if (!v || typeof v !== "object") return;
      for (const k of Object.keys(v)) {
        if (/^_help/.test(k) && /ASSUMPTION/.test(J(v[k]))) {
          let marked = false;
          (function look(x) { if (!x || typeof x !== "object" || marked) return; for (const kk of Object.keys(x)) { if ((/Assumed$/.test(kk) || kk === "assumed") && x[kk] === true) { marked = true; return; } look(x[kk]); } })(v);
          ok(`${file}${path ? " " + path : ""}: its note says ASSUMPTION and the settings mark it (a key ending in Assumed, or "assumed": true), so Alan is asked about it`, marked,
            "add the mark next to the number (like site.anchorsAssumed) and list it under What you still need to decide in docs/FOR-ALAN.md");
        } else if (!/^_help/.test(k)) walk(v[k], path ? path + "." + k : k, v);
      }
    })(root, "", null);
  }
  helpAssumptions("library/construction.json", con);
  for (const f of readdirSync(resolve(ROOT, "library/manufacturers")).filter((n) => n.endsWith(".json"))) helpAssumptions("library/manufacturers/" + f, JSON.parse(read("library/manufacturers/" + f)));
}

/* ------------------------------------------------------------------ 8 */
/* The counts the documents quote: the recorded buildings and pictures, and
   whether each check in README's table opens a browser (the same test
   tools/check-all.mjs uses). */
{
  const cases = JSON.parse(read("test/golden/cases.json"));
  const nCases = cases.count || (cases.cases || []).length;
  const nLook = existsSync(resolve(ROOT, "test/golden/look")) ? readdirSync(resolve(ROOT, "test/golden/look")).filter((n) => n.endsWith(".png")).length : 0;
  for (const doc of DOCS) {
    if (!existsSync(resolve(ROOT, doc))) continue;
    const t = read(doc).replace(/\s+/g, " ");
    for (const m of t.matchAll(/(?<![\d,.])(\d+) (?:recorded (?:Barnwright )?|golden |Barnwright )?buildings\b/g)) {
      if (/more than $|over $/.test(t.slice(Math.max(0, m.index - 10), m.index))) continue;   /* "more than 1,000 buildings" is another count */
      /* only a count of the RECORDED buildings: said so, or said beside Barnwright, golden or triangles */
      if (!/recorded|golden|Barnwright/.test(m[0]) && !/Barnwright|golden|recorded|triangle/i.test(t.slice(Math.max(0, m.index - 80), m.index + m[0].length + 40))) continue;
      ok(`${doc}: "${m[0]}" is the number of recorded buildings in test/golden/cases.json`, Number(m[1]) === nCases, `test/golden has ${nCases}`);
    }
    for (const m of t.matchAll(/(?<![\d,.])(\d+) finished pictures/g)) ok(`${doc}: "${m[0]}" is the number of pictures in test/golden/look/`, Number(m[1]) === nLook, `test/golden/look has ${nLook}`);
  }
  const readme = existsSync(resolve(ROOT, "README.md")) ? read("README.md") : "";
  const isBrowser = (src) => {
    const head = src.slice(0, 6000);
    if (/check-all:\s*node/.test(head)) return false;
    if (/check-all:\s*browser/.test(head)) return true;
    return /chromium\.launch|launchBrowser\(|loadPlaywright\(|openBarnwright\(/.test(src);
  };
  for (const m of readme.matchAll(/^\|\s*`(check-[a-z0-9-]+\.mjs)`\s*\|\s*(yes|no)\s*\|/gm)) {
    const src = toolSource("tools/" + m[1]);
    if (!src) continue;   /* a missing file is reported above */
    ok(`README.md says ${m[1]} ${m[2] === "yes" ? "opens" : "does not open"} a browser, as tools/check-all.mjs decides it`, isBrowser(src) === (m[2] === "yes"), `check-all treats it as ${isBrowser(src) ? "a browser check" : "a node check"}`);
  }
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
  const views = existsSync(resolve(ROOT, "ui/views.js")) ? read("ui/views.js") : "";
  if (views && !/\} trusses \{/.test(views) && /still reads\s+the word "trusses"/.test(alan)) notes.push("ui/views.js no longer writes \"trusses\" whatever the roof framing, but docs/FOR-ALAN.md still says it does -- update \"Not finished yet\"");
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
  console.log(`  Every number the settings still mark as an ASSUMPTION is listed for Alan in docs/FOR-ALAN.md with its current values, and every building number it states was read and compared with the files.`);
  console.log(`  The counts quoted (recorded buildings, finished pictures) are test/golden's, and README's browser column matches tools/check-all.mjs.`);
  if (promised.length) console.log(`  Named as promised but not written yet: ${promised.join(", ")}.`);
  for (const n of notes) console.log("  note: " + n);
}
