/* THE BARNWRIGHT TERMS: the owner of a business Barnwright sells to agrees
   to them in the Dealer Center (Alan, Oct 2026: "Add the I agree box").

   The terms are a PDF on every business's own site (legal/, published by
   tools/build-site.mjs; made by tools/legal/make-legal-pdfs.py, which also
   makes Alan's Sign-Up Form and setup steps). The owner ticks "I agree"
   in first setup, before the business is made; an owner who set up before
   the box existed, or before a newer version, is asked at the top of every
   screen until they agree. Each agreement is kept: which version, when, and
   who (their login email and name), in one record:

     barnwright-terms   { current: {version, agreedAt, by}, history: [...] }

   Only a business connected to Barnwright's control room is asked (Alan's
   own business, the local copy and the demo are not: there is nobody to
   agree with). status() is null then, and setup asks nothing.

   Node-safe and browser-safe. */

import { fail } from "./http.js";
import { KEEP } from "./store.js";

/* Change VERSION (and the PDF) when the terms change: every owner is asked again. */
export const TERMS = Object.freeze({
  version: "1.1",
  date: "October 2026",
  url: "/legal/barnwright-terms.pdf",
  title: "Barnwright Software Terms and Conditions",
});

const RECORD = "barnwright-terms";
const HISTORY = 20;

export function createTerms({ store, account, now }) {
  const asks = () => !!account?.connected;

  /* What the screens show: null when nobody is asked. agreed is this
     version's agreement, or null when the owner still has to agree. */
  async function status() {
    if (!asks()) return null;
    const doc = await store.get(RECORD);
    const current = doc?.current || null;
    return {
      version: TERMS.version, date: TERMS.date, url: TERMS.url, title: TERMS.title,
      agreed: current && current.version === TERMS.version ? current : null,
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
      if (doc?.current?.version === TERMS.version) return KEEP;
      return { current: entry, history: [entry, ...(doc?.history || [])].slice(0, HISTORY) };
    });
    return status();
  }

  /* first setup: when the owner is asked, they must have ticked the box */
  function mustHaveAgreed(data) {
    if (asks() && data?.agreeTerms !== true) fail(422, "Tick the box to agree to the Barnwright terms.");
  }

  return { asks, status, agree, mustHaveAgreed };
}
