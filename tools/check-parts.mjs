/* CHECK: every part of the shed is a proper part, and every part has its skill.
   Run: node tools/check-parts.mjs

   WHY. Alan asked for "a 3D model of each part of a shed" and "a skill for
   each part". A part is a module in parts/ (parts/README.md); its skill is
   .claude/skills/part-<id>/SKILL.md (docs/SKILL-TEMPLATE.md), which a Claude
   session reads before changing the part. This check keeps the two in step.

   WHAT IT PROVES:
   1. every module in parts/ that exports a part is a VALID part: an id that
      is its file name, a name, one or more stage keys that exist
      (parts/stages.js), a real-life caption, appliesTo and build functions,
      and "pending" (a stub) only as true or a list of part labels;
   2. every PIPELINE entry (parts/index.js) is one of those parts, under its
      own name, and a framing entry draws only framing stages;
   3. every caption FILLS IN: each {a.b} placeholder leads to a plain value in
      plan.construction, for every recorded building the part applies to
      (the 148 golden buildings, Barnwright's catalogue); and a FRAMING part's
      caption has no digit outside a placeholder, so it can never contradict
      a company's own construction numbers;
   4. appliesTo never throws on any of those buildings;
   5. every part that is no longer a stub has its skill, and every skill has
      frontmatter (name: part-<id>, description) and the eight required
      sections; every part-* skill belongs to a part that exists. */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative, basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STAGES } from "../parts/stages.js";
import { PIPELINE, fillRealLife } from "../parts/index.js";
import { readGoldenCases } from "./lib/golden-cases.mjs";
import { readFixture, catalogue } from "./lib/headless.mjs";
import { makePlan } from "../model/plan.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PARTS = join(ROOT, "parts");
const SKILLS = join(ROOT, ".claude/skills");

export const REQUIRED_SECTIONS = Object.freeze([
  "What it is in real life", "Stage", "Construction settings", "Where it came from in Barnwright",
  "The owner's facts", "Kept quirks", "How to change it safely", "Checks that guard it",
]);

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return true; }
  fail++; failures.push(name + (extra ? " -- " + extra : ""));
  return false;
}

function walk(dir) {
  const out = [];
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.m?js$/.test(n)) out.push(p);
  }
  return out;
}

const STAGE_BY_KEY = new Map(STAGES.map((s) => [s.key, s]));
const stagesOf = (m) => (Array.isArray(m.stage) ? m.stage : [m.stage]);

/* ---- sample buildings: every recorded golden building ---- */
const cat = catalogue();
const plans = readGoldenCases().cases.map((c) => ({ id: c.id, plan: makePlan(readFixture(c.id).state, cat) }));

/* ---- 1. find and validate every part module ---- */
const parts = new Map();          /* id -> { file, m } */
const helpers = [];
for (const file of walk(PARTS)) {
  const rel = relative(ROOT, file);
  if (rel === "parts/index.js" || rel === "parts/stages.js") continue;
  let mod;
  try { mod = await import(pathToFileURL(file).href); }
  catch (e) { ok(`${rel} loads`, false, String(e && e.message || e)); continue; }
  const m = mod.default;
  const looksLikePart = m && typeof m === "object" && ["id", "stage", "realLife", "build"].some((k) => k in m);
  if (!looksLikePart) { helpers.push(rel); continue; }
  const want = basename(file) === "index.js" ? basename(dirname(file)) : basename(file).replace(/\.m?js$/, "");
  /* a module in a sub-folder (a draw module of parts/openings/) may instead be
     named for the part label it draws (door-wood, window ...), which its
     folder's PIPELINE entry lists in `tags` */
  const sub = dirname(rel) !== "parts" && basename(file) !== "index.js";
  const folderTags = sub ? PIPELINE.filter((en) => dirname(en.file) === dirname(rel)).flatMap((en) => en.tags) : [];
  ok(`${rel}: its id is its file name ("${want}")` + (sub ? " or a part label its folder's entry draws" : ""),
    m.id === want || folderTags.includes(m.id), `id is ${JSON.stringify(m.id)}`);
  if (parts.has(m.id)) { ok(`part id "${m.id}" is used once`, false, `${parts.get(m.id).rel} and ${rel}`); continue; }
  parts.set(m.id, { rel, m });
  ok(`${rel}: has a name`, typeof m.name === "string" && m.name.trim().length > 0);
  const st = stagesOf(m);
  ok(`${rel}: stage is one or more stage keys`, st.length > 0 && st.every((k) => STAGE_BY_KEY.has(k)), `stage ${JSON.stringify(m.stage)}; the keys are ${STAGES.map((s) => s.key).join(" ")}`);
  ok(`${rel}: has a real-life caption`, typeof m.realLife === "string" && m.realLife.trim().length > 0);
  ok(`${rel}: appliesTo is a function`, typeof m.appliesTo === "function");
  ok(`${rel}: build is a function`, typeof m.build === "function");
  ok(`${rel}: "pending" is absent, true, or a list of part labels`,
    m.pending === undefined || m.pending === true || (Array.isArray(m.pending) && m.pending.every((x) => typeof x === "string")),
    `pending is ${JSON.stringify(m.pending)}`);
}

/* ---- 2. the PIPELINE ---- */
const inPipeline = new Set();
for (const en of PIPELINE) {
  const p = en.module && parts.get(en.module.id);
  ok(`PIPELINE entry "${en.entry}" is a part module`, !!p && p.m === en.module, en.module ? `module id ${en.module.id}` : "no module");
  if (!p) continue;
  inPipeline.add(en.module.id);
  ok(`PIPELINE entry "${en.entry}" is the part of the same name`, en.module.id === en.entry, `module id ${en.module.id}`);
  ok(`PIPELINE entry "${en.entry}" names its own file (${en.file})`, en.file === p.rel, `the module is ${p.rel}`);
  if (en.frame) ok(`framing entry "${en.entry}" draws only framing stages`, stagesOf(en.module).every((k) => STAGE_BY_KEY.get(k)?.kind === "frame"),
    `stages ${stagesOf(en.module).join(" ")}`);
}
for (const [id, p] of parts) {
  if (dirname(p.rel) === "parts") ok(`part "${id}" (${p.rel}) is in the PIPELINE`, inPipeline.has(id), "a top-level part that no entry runs is never drawn");
}

/* ---- 3 and 4. captions and appliesTo on every recorded building ---- */
let captionsFilled = 0;
for (const [id, p] of parts) {
  const m = p.m;
  if (typeof m.realLife !== "string") continue;
  let applies = [];
  let threw = null;
  if (typeof m.appliesTo === "function") {
    for (const s of plans) {
      try { if (m.appliesTo(s.plan)) applies.push(s); }
      catch (e) { threw = `${s.id}: ${e && e.message || e}`; break; }
    }
  }
  ok(`part "${id}": appliesTo runs on all ${plans.length} recorded buildings`, !threw, threw);
  const against = applies.length ? applies : plans;
  let missing = null;
  for (const s of against) {
    const r = fillRealLife(m.realLife, s.plan.construction);
    if (r.missing.length) { missing = `on ${s.id}: {${r.missing.join("}, {")}} is not a plain value in plan.construction`; break; }
    captionsFilled++;
  }
  ok(`part "${id}": every {placeholder} in its caption fills in (${against.length} buildings)`, !missing, missing);
  const frame = stagesOf(m).some((k) => STAGE_BY_KEY.get(k)?.kind === "frame");
  if (frame) {
    const bare = m.realLife.replace(/\{[^{}]*\}/g, "");
    ok(`framing part "${id}": no digit outside a placeholder in its caption`, !/[0-9]/.test(bare),
      `"${bare.match(/.{0,20}[0-9].{0,20}/)?.[0]}" -- put the number in library/construction.json and use a {placeholder}`);
  }
}

/* ---- 5. skills ---- */
function readSkill(dir) {
  const f = join(SKILLS, dir, "SKILL.md");
  if (!existsSync(f)) return null;
  return readFileSync(f, "utf8");
}
function skillProblems(id, text) {
  const out = [];
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!fm) return ["it does not start with a --- frontmatter block ---"];
  const name = /^name:\s*(.+?)\s*$/m.exec(fm[1]), desc = /^description:\s*(.+?)\s*$/m.exec(fm[1]);
  if (!name) out.push("the frontmatter has no name");
  else if (name[1] !== "part-" + id) out.push(`the frontmatter name is "${name[1]}", it must be "part-${id}"`);
  if (!desc || desc[1].length < 10) out.push("the frontmatter has no one-line description");
  const heads = new Set([...text.matchAll(/^##\s+(.+?)\s*$/gm)].map((h) => h[1].toLowerCase()));
  for (const s of REQUIRED_SECTIONS) if (!heads.has(s.toLowerCase())) out.push(`no "## ${s}" section`);
  return out;
}
let skillsOk = 0, stubs = [];
for (const [id, p] of parts) {
  const text = readSkill("part-" + id);
  if (p.m.pending === true) {
    stubs.push(id);
    if (text == null) continue;         /* a stub may have its skill already; then it must be well formed */
  }
  if (!ok(`part "${id}" has its skill .claude/skills/part-${id}/SKILL.md`, text != null, "write it from docs/SKILL-TEMPLATE.md")) continue;
  const probs = skillProblems(id, text);
  if (ok(`skill part-${id} is well formed`, probs.length === 0, probs.join("; "))) skillsOk++;
}
const skillDirs = existsSync(SKILLS) ? readdirSync(SKILLS).filter((d) => d.startsWith("part-") && statSync(join(SKILLS, d)).isDirectory()) : [];
/* a skill may also be for a part LABEL an entry draws without a module of
   its own name (the openings entry draws door-wood, window, ...) */
const allTags = new Set(PIPELINE.flatMap((en) => en.tags));
for (const d of skillDirs) {
  ok(`skill ${d} belongs to a part that exists`, parts.has(d.slice(5)) || allTags.has(d.slice(5)),
    `there is no parts/ module with id "${d.slice(5)}" and no PIPELINE entry draws a part labelled "${d.slice(5)}"`);
  if (!parts.has(d.slice(5)) && allTags.has(d.slice(5))) {
    const text = readSkill(d);
    if (text != null) { const probs = skillProblems(d.slice(5), text); ok(`skill ${d} is well formed`, probs.length === 0, probs.join("; ")); }
  }
  ok(`skill ${d} has a SKILL.md`, existsSync(join(SKILLS, d, "SKILL.md")));
}

/* ---- report ---- */
const finished = [...parts.keys()].filter((id) => !stubs.includes(id));
if (failures.length) {
  console.log(`FAIL: ${fail} of ${pass + fail} part checks failed:`);
  for (const f of failures) console.log("  - " + f);
  process.exitCode = 1;
} else {
  console.log(`PROVED (${pass} checks): all ${parts.size} part modules in parts/ are valid parts -- id = file name, real stage keys, ` +
    `a caption, appliesTo and build -- and all ${PIPELINE.length} PIPELINE entries are those parts under their own names.`);
  console.log(`  Every caption fills in from plan.construction on every recorded building it applies to (${captionsFilled} captions filled), ` +
    `and no framing caption states a number of its own.`);
  console.log(`  ${finished.length} finished part(s) each have a well-formed skill: ${finished.join(", ") || "none yet"}.`);
  console.log(`  Every one of the ${skillDirs.length} part-* skill(s) belongs to a part that exists.`);
  if (stubs.length) console.log(`  ${stubs.length} stub(s) still waiting to be ported (no skill asked for yet): ${stubs.join(", ")}.`);
  if (helpers.length) console.log(`  Helper modules (no part of their own): ${helpers.join(", ")}.`);
}
