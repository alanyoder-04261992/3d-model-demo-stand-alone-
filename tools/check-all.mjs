/* RUN EVERY CHECK AND SAY, IN ONE TABLE, WHAT PASSED.
   Run: node tools/check-all.mjs [--fast] [--only name,name]

   Every file tools/check-*.mjs (except this one) is run on its own, one after
   another, as `node tools/<name>.mjs` from the repo root. Each check prints in
   plain words what it proved and exits non-zero when something is wrong; this
   collects the answers into a table and exits non-zero if ANY check failed.

   --fast       skip the checks that open a browser (Chromium with software
                graphics: slower, and they need the installed Playwright).
                A check is a browser check when its source launches Chromium
                (chromium.launch, launchBrowser, loadPlaywright,
                openBarnwright); a check can say so itself with a comment
                "check-all: browser" or "check-all: node".
   --only a,b   just these checks (names with or without "check-" / ".mjs").

   On a failure the last lines of that check's output are printed under the
   table. Checks run one at a time (browser checks each use their own port,
   but one browser at a time keeps them quick and repeatable). */

import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = resolve(ROOT, "tools");
const args = process.argv.slice(2);
const FAST = args.includes("--fast");
const onlyArg = (() => {
  const i = args.indexOf("--only");
  const v = i >= 0 ? args[i + 1] : (args.find((a) => a.startsWith("--only=")) || "").slice(7);
  return v ? v.split(",").map((s) => s.trim().replace(/^check-/, "").replace(/\.mjs$/, "")).filter(Boolean) : null;
})();
const TIMEOUT_MS = 30 * 60 * 1000;

function isBrowserCheck(src) {
  const head = src.slice(0, 6000);
  if (/check-all:\s*node/.test(head)) return false;
  if (/check-all:\s*browser/.test(head)) return true;
  return /chromium\.launch|launchBrowser\(|loadPlaywright\(|openBarnwright\(/.test(src);
}

const me = basename(fileURLToPath(import.meta.url));
const checks = readdirSync(TOOLS).filter((f) => /^check-.*\.mjs$/.test(f) && f !== me).sort().map((f) => {
  const src = readFileSync(resolve(TOOLS, f), "utf8");
  return { file: f, name: f.replace(/^check-/, "").replace(/\.mjs$/, ""), browser: isBrowserCheck(src) };
});
if (onlyArg) for (const n of onlyArg) if (!checks.some((c) => c.name === n)) { console.log(`FAIL: there is no tools/check-${n}.mjs`); process.exit(1); }

const rows = [];
const t0 = Date.now();
for (const c of checks) {
  if (onlyArg && !onlyArg.includes(c.name)) continue;
  if (FAST && c.browser) { rows.push({ c, status: "SKIPPED", secs: 0, line: "opens a browser (--fast)" }); continue; }
  process.stdout.write(`running ${c.file}${c.browser ? " (browser)" : ""} ... `);
  const s = Date.now();
  const r = spawnSync(process.execPath, [resolve(TOOLS, c.file)], { cwd: ROOT, encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
  const secs = (Date.now() - s) / 1000;
  const out = (r.stdout || "") + (r.stderr ? "\n" + r.stderr : "");
  const lines = out.split("\n").map((l) => l.trimEnd()).filter(Boolean);
  const verdict = lines.find((l) => /^(PROVED|PASSED|PASS|FAIL|FAILED)\b/.test(l.trim())) || lines[lines.length - 1] || "(no output)";
  let status = r.status === 0 ? "PASS" : "FAIL";
  if (r.error && r.error.code === "ETIMEDOUT") status = "FAIL";
  const why = r.error ? (r.error.code === "ETIMEDOUT" ? `timed out after ${TIMEOUT_MS / 60000} min` : String(r.error.message)) : r.signal ? `killed by ${r.signal}` : null;
  console.log(`${status} (${secs.toFixed(1)} s)`);
  rows.push({ c, status, secs, line: why || verdict.trim(), tail: status === "FAIL" ? lines.slice(-30) : null });
}

const w = Math.max(...rows.map((r) => r.c.file.length), 10);
console.log("\n" + "check".padEnd(w) + "  result   seconds  what it said");
for (const r of rows) {
  const said = r.line.length > 150 ? r.line.slice(0, 147) + "..." : r.line;
  console.log(`${r.c.file.padEnd(w)}  ${r.status.padEnd(7)}  ${r.secs.toFixed(1).padStart(7)}  ${said}`);
}
const failed = rows.filter((r) => r.status === "FAIL");
const passed = rows.filter((r) => r.status === "PASS");
const skipped = rows.filter((r) => r.status === "SKIPPED");
for (const r of failed) {
  console.log(`\n---- ${r.c.file} failed; its last lines: ----`);
  for (const l of r.tail || []) console.log("  " + l);
}
const total = ((Date.now() - t0) / 1000).toFixed(0);
if (failed.length) {
  console.log(`\nFAIL: ${failed.length} of ${passed.length + failed.length} checks failed (${failed.map((r) => r.c.name).join(", ")}); ` +
    `${passed.length} passed${skipped.length ? `, ${skipped.length} browser check(s) skipped (--fast)` : ""}. ${total} s.`);
  process.exitCode = 1;
} else {
  console.log(`\nPROVED: all ${passed.length} checks passed${skipped.length ? ` (${skipped.length} browser check(s) skipped with --fast: ${skipped.map((r) => r.c.name).join(", ")})` : ""}. ${total} s.`);
}
