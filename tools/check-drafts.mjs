/* CHECK: unsaved writing remains private to its person, business and tab,
   and saving one draft leaves another intact. (check-all: node) */
import assert from "node:assert/strict";
import { readDraft, writeDraft, clearDraft } from "../ui/office/drafts.js";

const data = new Map();
globalThis.sessionStorage = {
  getItem: (key) => data.get(key) || null,
  setItem: (key, value) => data.set(key, value),
  removeItem: (key) => data.delete(key),
};
globalThis.localStorage = { setItem: () => { throw new Error("A draft reached storage shared across tabs"); } };
const owner = { business: { id: "first-business" }, person: { userId: "first-owner" } };
const dealer = { ...owner, person: { userId: "another-person" } };
const anotherBusiness = { ...owner, business: { id: "another-business" } };
writeDraft(owner, "customer:one", { text: "A private customer note", followNote: "Call tomorrow" });
writeDraft(owner, "help", { text: "A support question" });
assert.equal(readDraft(owner, "customer:one").text, "A private customer note");
assert.deepEqual(readDraft(dealer, "customer:one"), {});
assert.deepEqual(readDraft(anotherBusiness, "customer:one"), {});
assert.deepEqual(readDraft(owner, "customer:two"), {});
assert.deepEqual(readDraft({ business: owner.business }, "customer:one"), {});
clearDraft(owner, "customer:one");
assert.deepEqual(readDraft(owner, "customer:one"), {});
assert.equal(readDraft(owner, "help").text, "A support question");
const realNow = Date.now;
try {
  Date.now = () => realNow() + 8 * 86400000;
  assert.deepEqual(readDraft(owner, "help"), {});
  assert.equal(data.size, 0);
} finally { Date.now = realNow; }
globalThis.sessionStorage = {
  getItem: () => { throw new Error("Storage blocked"); },
  setItem: () => { throw new Error("Storage blocked"); },
  removeItem: () => { throw new Error("Storage blocked"); },
};
writeDraft(owner, "help", { text: "A question while storage is blocked" });
assert.equal(readDraft(owner, "help").text, "A question while storage is blocked");
clearDraft(owner, "help");
assert.deepEqual(readDraft(owner, "help"), {});
delete globalThis.sessionStorage;
delete globalThis.localStorage;
console.log("PROVED: drafts are scoped to a person, business and customer, clearing one preserves another, older drafts expire, and blocked session storage keeps writing in memory.");
