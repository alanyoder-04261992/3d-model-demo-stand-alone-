/* THE BARNWRIGHT TERMS: the owner of a business Barnwright sells to agrees
   to them in the Dealer Center (Alan, Oct 2026: "Add the I agree box").

   The terms are a PDF on every business's own site (legal/, published by
   tools/build-site.mjs; made by tools/legal/make-legal-pdfs.py, which also
   writes docs/legal/terms.json for the sign-up page Alan texts to a new
   owner). The owner agrees on that sign-up page, and again here: "I have
   read and agree to the Barnwright Terms and Conditions" in first setup,
   before the business is made; an owner who set up before the box existed,
   or before a newer version, is asked at the top of every screen until they
   agree. Each agreement is kept: which version, when, and
   who (their login email and name), in one record:

     barnwright-terms   { current: {version, agreedAt, by}, history: [...] }

   Only a business connected to Barnwright's control room is asked (Alan's
   own business, the local copy and the demo are not: there is nobody to
   agree with). status() is null then, and setup asks nothing.

   Before the owner first signs in, the agreement they gave on the Control
   Room's sign-up page can let Barnwright start their price list
   (signupCounts below, setup-access.js), but it is never kept here as
   theirs: First setup still asks them to tick the box.

   Node-safe and browser-safe. */

import { fail } from "./http.js";
import { KEEP } from "./store.js";
/* The SHA-256 of every docs/legal/terms.json written for terms 2.2 or later,
   by version (tools/legal/make-legal-pdfs.py adds, never removes): the
   terms this Dealer Center has, so it can tell whether an owner's sign-up
   agreement is to terms it knows. */
import TERMS_COPIES from "../../docs/legal/terms-sha256.json" with { type: "json" };

/* Change the version and date (with TERMS_VERSION and TERMS_DATE in
   tools/legal/make-legal-pdfs.py, and run it) when the terms change: every
   owner is asked again. 2.2 is the first version that lets Barnwright change
   a price list (sections 2.4 and 10.4): Barnwright setup access works only
   for an owner who agreed to 2.2 or later. tools/check-docs.mjs proves the
   version is the same everywhere, and tools/check-wording.mjs that the words
   say what setup access does and no more. */
export const TERMS = Object.freeze({
  version: "2.2",
  date: "November 11, 2026",
  url: "/legal/barnwright-terms.pdf",
  title: "Barnwright Terms and Conditions",
});

/* What an owner who hasn't ticked the box is told (first setup on the
   screen says the same, with the title status() sends). */
export const AGREE_FIRST = `Tick the box to agree to the ${TERMS.title}.`;

const RECORD = "barnwright-terms";
const HISTORY = 20;

/* "2.2" or later: version numbers compared as numbers ("2.10" is later
   than "2.9"). An owner who agreed to a later version than this copy knows
   has agreed (a copy that went back to older terms never asks again). */
export function versionAtLeast(version, need) {
  if (typeof version !== "string" || !/^\d{1,4}(\.\d{1,4}){0,3}$/.test(version)) return false;
  const a = version.split(".").map(Number), b = String(need).split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

/* ---- the owner's sign-up agreement (docs/OFFICE.md, "Before the owner
   first signs in") ----------------------------------------------------------

   On the Control Room's sign-up page the owner reads the terms, ticks "I
   agree" and types their name. Until they first sign in here, that
   agreement lets Barnwright start their price list, and nothing else: it
   is never their own tick in the Dealer Center (barnwright-terms). */

/* the first terms a sign-up agreement can count for */
export const SIGNUP_MIN_TERMS = "2.2";

/* This Dealer Center's own copies of the terms, by version: {"2.2": [sha, ...]}. */
export function termsCopies() {
  const v = TERMS_COPIES?.versions;
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

/* Does a sign-up agreement count as the owner's agreement for setup
   access? ships: this Dealer Center's TERMS.version; ownCopies: its own
   copies (termsCopies()); ownerSignedIn: the first owner's claim exists.
   -> {counts, why}: why is the access why when it doesn't count and no
   owner has signed in ("terms": this Dealer Center's own terms are older
   than 2.2; "signup-terms": they signed up under older terms;
   "signup-unknown": terms 2.2 or later this Dealer Center doesn't have),
   else null. tools/lib/make-setup-fixtures.mjs signupCounts is the same
   rule, and the checks hold the two together. */
export function signupCounts(signup, { ships = TERMS.version, ownCopies = termsCopies(), ownerSignedIn = false } = {}) {
  if (ownerSignedIn || !signup || typeof signup !== "object") return { counts: false, why: null };
  if (!versionAtLeast(ships, SIGNUP_MIN_TERMS)) return { counts: false, why: "terms" };
  if (!versionAtLeast(signup.termsVersion, SIGNUP_MIN_TERMS)) return { counts: false, why: "signup-terms" };
  const copies = Object.prototype.hasOwnProperty.call(ownCopies || {}, signup.termsVersion) ? ownCopies[signup.termsVersion] : [];
  if (signup.termsVersion === ships || (Array.isArray(copies) && copies.includes(signup.termsSha256))) return { counts: true, why: null };
  return { counts: false, why: "signup-unknown" };
}

/* terms: what this copy ships (TERMS; the checks and the local copy may
   pretend to ship newer terms before they are out). */
export function createTerms({ store, account, now, terms: shipped = TERMS }) {
  const TERMS = shipped;
  const asks = () => !!account?.connected;

  /* What the screens show: null when nobody is asked. agreed is this
     version's agreement, or null when the owner still has to agree. */
  async function status() {
    if (!asks()) return null;
    const doc = await store.get(RECORD);
    const current = doc?.current || null;
    return {
      version: TERMS.version, date: TERMS.date, url: TERMS.url, title: TERMS.title,
      agreed: current && versionAtLeast(current.version, TERMS.version) ? current : null,
    };
  }

  /* person: the owner (index.js checks). Agreeing again to the same version
     changes nothing. */
  async function agree(person) {
    if (!asks()) fail(404, "This Dealer Center isn't connected to Barnwright.");
    const entry = {
      version: TERMS.version,
      agreedAt: now().toISOString(),
      by: { userId: person.userId, email: person.email, name: person.name || "" },
    };
    await store.change(RECORD, (doc) => {
      if (versionAtLeast(doc?.current?.version, TERMS.version)) return KEEP;
      return { current: entry, history: [entry, ...(doc?.history || [])].slice(0, HISTORY) };
    });
    return status();
  }

  /* first setup: when the owner is asked, they must have ticked the box */
  function mustHaveAgreed(data) {
    if (asks() && data?.agreeTerms !== true) fail(422, AGREE_FIRST);
  }

  /* The owner has never agreed to any terms in the Dealer Center (no
     agreement kept, now or ever). */
  async function neverAgreed() {
    const doc = await store.get(RECORD);
    return !doc?.current && !(doc?.history || []).length;
  }

  return { asks, status, agree, mustHaveAgreed, neverAgreed, version: TERMS.version };
}
