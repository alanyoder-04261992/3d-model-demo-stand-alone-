/* A BARNWRIGHT VISIT'S UNSAVED WORK, KEPT IN THIS TAB.

   When a visit ends while Alan is working (the owner's switch ran out, the
   8 hours passed), the page never reloads and never shows a sign-in: the
   work stays on screen, and it is kept here, in this tab's sessionStorage,
   so it comes back when the page opens again in this tab. Once he has
   opened their price list again from his Control Room, tapping Save in
   this tab works (the new visit's cookie is shared by the whole browser).

   kind: "price-list" or "settings". A kept draft comes back only onto the
   same version of the price list it was made from. */

const KEY = (kind) => `dealer-center:barnwright-draft:${kind}`;
const VISIT = "dealer-center:barnwright-visit";

export function keepDraft(kind, version, draft) {
  try { sessionStorage.setItem(KEY(kind), JSON.stringify({ version, draft, at: Date.now() })); } catch { /* storage full or blocked: it stays on screen */ }
}

/* -> {draft} when one was kept for this version, {older: true} when the
   one kept was made from another version (it is let go), or null. A draft
   comes back once: it leaves this tab's storage as it goes back on screen
   (the screen keeps it again if the visit ends or the page goes away with
   changes still on it), so Undo changes, Reload or leaving the screen
   really let it go. */
export function takeDraft(kind, version) {
  let kept = null;
  try { kept = JSON.parse(sessionStorage.getItem(KEY(kind)) || "null"); } catch { kept = null; }
  if (!kept || typeof kept !== "object" || !kept.draft) return null;
  dropDraft(kind);
  if (kept.version !== version) return { older: true };
  return { draft: kept.draft };
}

export function dropDraft(kind) {
  try { sessionStorage.removeItem(KEY(kind)); } catch { /* fine */ }
}

/* This tab is on a Barnwright visit (so a reload goes back to it, not to
   the sign-in). Done lets the drafts go too; leaving an ended visit for
   the Dealer Center's sign-in keeps them (keepDrafts) for a new visit. */
export function visitMark(on, { keepDrafts = false } = {}) {
  try {
    if (on) sessionStorage.setItem(VISIT, "1");
    else {
      sessionStorage.removeItem(VISIT);
      if (!keepDrafts) { dropDraft("price-list"); dropDraft("settings"); }
    }
  } catch { /* fine */ }
}
export function visitMarked() {
  try { return sessionStorage.getItem(VISIT) === "1"; } catch { return false; }
}
