/* LIST EVERY COMPANY, AND WHAT STATE EACH ONE IS IN. Node 22, no dependencies.

     node tools/list-companies.mjs          a plain list, one block per company
     node tools/list-companies.mjs --json   the same, for another program

   For each companies/<id>/company.json (the template is left out):
     * its name, and whether its settings file loads (and if not, why)
     * status: active, or SUSPENDED (the designer says it is not available)
     * the licence: hosted or self-hosted, and when it renews -- with how
       many days are left, or "OVERDUE"
     * the styles it sells (and how many sizes of each)
     * where its quote requests go (leads mode)
     * which websites may show its designer inside their pages (embed.origins)
   Exit code 1 when any company's file does not load, so this can be used to
   spot a broken company before it is deployed. */

import { readdirSync, existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT, loadCompany, readJSON } from "./lib/load.mjs";

export function daysUntil(date, today) {
  const t = today || new Date();
  const a = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - a) / 86400000);
}

export function describeCompanies(today) {
  const dir = resolvePath(ROOT, "companies");
  const out = [];
  for (const id of readdirSync(dir).sort()) {
    if (id.startsWith("_") || id.startsWith(".")) continue;
    if (!existsSync(resolvePath(dir, id, "company.json"))) continue;
    let r = null, file = null, err = null;
    try { r = loadCompany(id); file = r.company; } catch (e) { err = e.message; try { file = readJSON(`companies/${id}/company.json`); } catch (e2) { file = null; } }
    const c = file || {};
    const m = (r && r.manufacturer) || {};
    const styles = Object.keys(c.offer || {}).filter((k) => !k.startsWith("_")).map((k) => {
      const o = c.offer[k] || {};
      return { code: k, name: o.name || ((m.styles || {})[k] || {}).name || k, sizes: Object.keys(o.sizes || {}).length };
    });
    const lic = c.license || {};
    const days = daysUntil(lic.renews, today);
    const L = c.leads || {};
    let leadsTo = "";
    try { leadsTo = L.url ? new URL(L.url).host : ""; } catch (e) { leadsTo = ""; }
    out.push({
      id,
      name: (c.brand && c.brand.name) || "",
      loads: !!(r && !r.problems.length),
      problems: err ? [err] : (r ? r.problems : []),
      status: c.status || "active",
      license: { plan: lic.plan || "", renews: lic.renews || "", daysLeft: days },
      styles,
      leads: { mode: L.mode || "none", to: L.mode === "mailto" ? (L.email || (c.brand && c.brand.email) || "") : leadsTo },
      embed: ((c.embed && c.embed.origins) || []).slice(),
      shareUrl: (c.embed && c.embed.shareUrl) || "",
    });
  }
  return out;
}

function licenceWords(l) {
  const plan = l.plan ? l.plan : "no plan set";
  if (!l.renews) return `${plan}, no renewal date set`;
  if (l.daysLeft < 0) return `${plan}, renewal was due ${l.renews} -- OVERDUE by ${-l.daysLeft} day${l.daysLeft === -1 ? "" : "s"}`;
  if (l.daysLeft === 0) return `${plan}, renews TODAY (${l.renews})`;
  return `${plan}, renews ${l.renews} (in ${l.daysLeft} day${l.daysLeft === 1 ? "" : "s"}${l.daysLeft <= 30 ? " -- SOON" : ""})`;
}

function leadWords(L) {
  return { none: "none -- a showroom, no quote button", form: "a form service", mailto: "the customer's own e-mail app", webhook: "a webhook", postMessage: "the company's own web page (postMessage)" }[L.mode] + (L.to ? ` (${L.to})` : "");
}

function main() {
  const json = process.argv.includes("--json");
  const list = describeCompanies();
  if (json) { process.stdout.write(JSON.stringify(list, null, 2) + "\n"); if (list.some((c) => !c.loads)) process.exitCode = 1; return; }
  console.log(`${list.length} compan${list.length === 1 ? "y" : "ies"} in companies/ (the template is not counted):\n`);
  for (const c of list) {
    console.log(`${c.id}  --  ${c.name || "(no name)"}`);
    console.log(`  settings file:  ${c.loads ? "loads" : "DOES NOT LOAD (" + c.problems.length + " problem" + (c.problems.length === 1 ? "" : "s") + "): " + c.problems.slice(0, 3).join(" / ") + (c.problems.length > 3 ? " ..." : "")}`);
    console.log(`  status:         ${c.status === "suspended" ? "SUSPENDED -- the designer says it is not available" : c.status}`);
    console.log(`  licence:        ${licenceWords(c.license)}`);
    console.log(`  styles (${c.styles.length}):     ${c.styles.map((s) => `${s.code} ${s.name} (${s.sizes})`).join(", ")}`);
    console.log(`  quote requests: ${leadWords(c.leads)}`);
    console.log(`  shown on:       ${c.embed.length ? c.embed.join(", ") : "no other website yet (embed.origins is empty)"}`);
    console.log("");
  }
  const bad = list.filter((c) => !c.loads);
  if (bad.length) { console.log(`FAIL: ${bad.length} company file(s) do not load: ${bad.map((c) => c.id).join(", ")}.`); process.exitCode = 1; }
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
