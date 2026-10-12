/* check-all: node
   The real Dealer Center keeps the same tab's unfinished price changes
   when standard layout saves separately. Invalid kept drafts are dropped;
   a different save stays stale, and a late reply cannot roll the base back. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* These event-only stand-ins permit importing the actual screen without
   making a browser. The tests call its shared-state hooks, not a copy of
   the restoring or rebasing code. No DOM rendering is involved. */
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {} };
globalThis.location = { hash: "#/price-list/building/LB" };
const stored = new Map();
const storage = { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, String(value)), removeItem: (key) => stored.delete(key) };
globalThis.sessionStorage = storage;
await import("../ui/office/views/price-list.js");
const { S, freshParked } = await import("../ui/office/views/price-list/state.js");
assert.equal(typeof S.hooks.restoreLayout, "function", "the Dealer Center restores its standard-layout return draft");
assert.equal(typeof S.hooks.rebase, "function", "the Dealer Center rebases a separate standard-layout save");
const { LAYOUT_RETURN } = await import("../ui/office/views/price-list/building-page.js");

const read = (path) => JSON.parse(readFileSync(new URL("../" + path, import.meta.url), "utf8"));
const original = read("companies/demo/company.json");
S.M = read("library/manufacturers/standard.json");
S.L = read("library/construction.json");
const copy = (value) => structuredClone(value);
const record = (settings, version) => ({ settings: copy(settings), version, cfg: settings.cfg, savedAt: "2026-10-12T10:00:00Z", savedBy: { id: "owner-test", name: "Test Owner" } });
const base = record(original, 1);
const layout = [{ cat: "w72", wall: "F", at: "center" }, { cat: "w23", wall: "R", at: "center", ifFits: true }];
const layoutRecord = copy(base);
layoutRecord.version = 2;
layoutRecord.settings.cfg = (base.settings.cfg || 1) + 1;
layoutRecord.cfg = layoutRecord.settings.cfg;
layoutRecord.settings.offer.LB.layout = copy(layout);
const size = Object.keys(base.settings.offer.LB.sizes)[0], price = base.settings.offer.LB.sizes[size];
let passed = 0;
const check = (name, run) => { run(); passed++; console.log("PASS " + name); };

function reset(current = layoutRecord, { owner = true, visit = null } = {}) {
  stored.clear();
  globalThis.sessionStorage = storage;
  S.owner = owner;
  S.saved = copy(current); S.latest = S.saved;
  S.draft = owner ? copy(current.settings) : null;
  S.parked = freshParked(); S.changes = []; S.problems = []; S.locks = {};
  S.layoutGoing = false;
  S.ctx = { app: { person: visit ? null : { userId: "owner-test" }, barnwright: visit, lots: [], openLots: () => [] } };
}
function kept({ visit = null } = {}) {
  const draft = copy(base.settings), parked = freshParked();
  draft.offer.LB.sizes[size] = price + 123;
  parked.offer.UT = draft.offer.UT; delete draft.offer.UT;
  return { id: base.settings.id, actor: visit ? `visit:${visit.actor}` : "person:owner-test", version: base.version,
    at: Date.now(), saved: copy(base.settings), draft, parked };
}
function putKept(value) { storage.setItem(LAYOUT_RETURN, typeof value === "string" ? value : JSON.stringify(value)); }
function ignores(name, mutate, options = {}) {
  check(name, () => {
    reset(layoutRecord, options);
    const payload = kept(options), before = { saved: S.saved, latest: S.latest, draft: S.draft, parked: S.parked };
    const raw = mutate(payload);
    putKept(typeof raw === "string" ? raw : payload);
    S.hooks.restoreLayout(layoutRecord);
    assert.strictEqual(S.saved, before.saved); assert.strictEqual(S.latest, before.latest);
    assert.strictEqual(S.draft, before.draft); assert.strictEqual(S.parked, before.parked);
    assert.equal(storage.getItem(LAYOUT_RETURN), null, "the return draft is consumed once");
  });
}

ignores("malformed JSON is ignored and cleared", () => "{unfinished");
ignores("an oversized return draft is ignored", () => " ".repeat(2000000));
ignores("a different business cannot restore the draft", (p) => { p.id = "another-business"; });
ignores("a draft carrying another business id is ignored", (p) => { p.draft.id = "another-business"; });
ignores("a saved copy carrying another business id is ignored", (p) => { p.saved.id = "another-business"; });
ignores("another builder's library cannot be restored", (p) => { p.draft.manufacturer = "another-builder"; });
ignores("another owner's kept changes are ignored", (p) => { p.actor = "person:another-owner"; });
ignores("a draft older than eight hours is ignored", (p) => { p.at = Date.now() - 8 * 3600000 - 1000; });
ignores("a future return time is ignored", (p) => { p.at = Date.now() + 60000; });
ignores("a missing time marker is ignored", (p) => { delete p.at; });
ignores("a draft from a later version is ignored", (p) => { p.version = layoutRecord.version + 1; });
ignores("a version without a number is ignored", (p) => { p.version = "1"; });
ignores("a missing building list is ignored", (p) => { delete p.draft.offer; });
ignores("a malformed draft building is ignored", (p) => { p.draft.offer.LB = { sizes: [] }; });
ignores("a malformed saved building is ignored", (p) => { p.saved.offer.LB = 12; });
ignores("malformed stopped buildings are ignored", (p) => { p.parked.offer.UT = { sizes: null }; });
ignores("a manager cannot restore an owner's changes", () => {}, { owner: false });
ignores("an owner draft cannot restore into a Barnwright visit", (p) => { p.actor = "person:owner-test"; }, { visit: { actor: "Alan" } });

check("same-tab return keeps prices and stopped buildings and forwards the layout base", () => {
  reset(); const payload = kept(); putKept(payload);
  S.hooks.restoreLayout(layoutRecord);
  assert.equal(S.saved.version, 2); assert.equal(S.latest.version, 2);
  assert.equal(S.draft.cfg, layoutRecord.settings.cfg);
  assert.equal(S.draft.offer.LB.sizes[size], price + 123);
  assert.deepEqual(S.draft.offer.LB.layout, layout);
  assert.deepEqual(S.parked.offer.UT, payload.parked.offer.UT); assert.equal(S.draft.offer.UT, undefined);
  assert.ok(S.changes.some((line) => line.includes("Stop selling")), "the parked style still counts as an unfinished change");
  assert.equal(storage.getItem(LAYOUT_RETURN), null);
});
check("Cancel returns to the same version with unfinished prices kept", () => {
  reset(base); putKept(kept()); S.hooks.restoreLayout(base);
  assert.equal(S.saved.version, 1); assert.equal(S.draft.offer.LB.sizes[size], price + 123); assert.ok(S.parked.offer.UT);
});
check("a Barnwright visit restores only its own kept draft", () => {
  const visit = { actor: "Alan" }; reset(layoutRecord, { visit }); putKept(kept({ visit }));
  S.hooks.restoreLayout(layoutRecord);
  assert.equal(S.saved.version, 2); assert.equal(S.draft.offer.LB.sizes[size], price + 123); assert.deepEqual(S.draft.offer.LB.layout, layout);
});
check("an unrelated server price change stays stale and keeps the owner's unfinished prices", () => {
  const current = copy(layoutRecord); current.settings.offer.LB.sizes[size] = price + 25;
  reset(current); const payload = kept(); putKept(payload); S.hooks.restoreLayout(current);
  assert.equal(S.saved.version, 1); assert.equal(S.latest.version, 2);
  assert.equal(S.saved.settings.offer.LB.sizes[size], price); assert.equal(S.latest.settings.offer.LB.sizes[size], price + 25);
  assert.equal(S.draft.offer.LB.sizes[size], price + 123); assert.equal(S.draft.offer.LB.layout, undefined); assert.ok(S.parked.offer.UT);
});
check("an unrelated server building-number change stays stale", () => {
  const current = copy(layoutRecord); current.settings.offer.UT.built = { wallHeight: 96 };
  reset(current); putKept(kept()); S.hooks.restoreLayout(current);
  assert.equal(S.saved.version, 1); assert.equal(S.latest.version, 2); assert.equal(S.draft.offer.LB.sizes[size], price + 123);
});
check("a later layout-only save removes the layout without dropping price changes", () => {
  reset(layoutRecord); S.draft.offer.LB.sizes[size] = price + 123;
  const removed = copy(layoutRecord); removed.version = 3; removed.settings.cfg++; delete removed.settings.offer.LB.layout;
  assert.equal(S.hooks.rebase(removed), true);
  assert.equal(S.saved.version, 3); assert.equal(S.draft.cfg, removed.settings.cfg);
  assert.equal(S.draft.offer.LB.layout, undefined); assert.equal(S.draft.offer.LB.sizes[size], price + 123);
});
check("a late layout response cannot roll the saved base or latest revision backward", () => {
  reset(layoutRecord); S.draft.offer.LB.sizes[size] = price + 123;
  assert.equal(S.hooks.rebase(base), false);
  assert.equal(S.saved.version, 2); assert.equal(S.latest.version, 2); assert.equal(S.draft.offer.LB.sizes[size], price + 123);
  const latest = copy(layoutRecord); latest.version = 4; latest.settings.offer.LB.sizes[size] += 25; S.latest = latest;
  const late = copy(base); late.version = 3;
  assert.equal(S.hooks.rebase(late), false); assert.equal(S.latest.version, 4); assert.equal(S.saved.version, 2);
});
check("a cfg-only revision cannot pretend to be a standard-layout save", () => {
  reset(base); S.draft.offer.LB.sizes[size] = price + 123;
  const current = copy(base); current.version = 2; current.settings.cfg++;
  assert.equal(S.hooks.rebase(current), false);
  assert.equal(S.saved.version, 1); assert.equal(S.latest.version, 2); assert.equal(S.draft.cfg, base.settings.cfg);
  assert.equal(S.draft.offer.LB.sizes[size], price + 123);
});
check("blocked browser storage leaves the loaded price list intact", () => {
  reset(); const before = S.draft;
  globalThis.sessionStorage = { getItem() { throw new Error("Storage unavailable"); }, removeItem() {} };
  try { S.hooks.restoreLayout(layoutRecord); assert.strictEqual(S.draft, before); assert.equal(S.saved.version, 2); }
  finally { globalThis.sessionStorage = storage; }
});
console.log(`PROVED: ${passed} standard-layout return checks preserve unfinished prices, bind the draft to its business and person, rebase only a newer layout save, and keep unrelated saves stale.`);
