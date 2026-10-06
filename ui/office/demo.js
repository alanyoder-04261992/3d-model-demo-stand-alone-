/* "TRY IT": THE DEALER CENTER WITH MADE-UP DATA, ENTIRELY IN THIS BROWSER.

   /dealer?demo runs the Dealer Center's real server code (server/office/)
   inside the page, on a sample business (Sample Storage Barns: three lots,
   five people, thirty customers), so anybody -- Alan, a shed company
   thinking of buying -- can click through everything without a login.

   * Nothing is sent anywhere: every /api/office/... call is answered by the
     copy of the server running in this page. The data lives in this tab
     (sessionStorage) so signing in as somebody else keeps it; closing the
     tab, or "Start over", throws it away. Like a business that is not
     connected to Barnwright, Help shows its answers and the email to write
     to instead of sending a question.
   * There are no passwords: pick who you are, like the local Dealer Center.
   * A lot's 3D designer link (/d/<lot>/) does not exist in the demo, so
     "See it in 3D" and "Design a building" use the example designer
     (/c/demo/), whose business id the demo business shares. */

import { createOffice } from "../../server/office/index.js";
import { MemoryBlobs } from "../../server/office/store.js";
import { seedSample, SAMPLE_PEOPLE } from "../../server/office/sample.js";

const DATA_KEY = "dealer-center-demo:data";
const WHO_KEY = "dealer-center-demo:who";
export const DEMO_DESIGNER = "/c/demo/";

class SavedBlobs extends MemoryBlobs {
  save() {
    try { sessionStorage.setItem(DATA_KEY, JSON.stringify([...this.values])); } catch { /* full: carry on in memory */ }
  }
  load() {
    try {
      const raw = sessionStorage.getItem(DATA_KEY);
      if (raw) { this.values = new Map(JSON.parse(raw)); this.seq = this.values.size + 1000; return true; }
    } catch { /* start fresh */ }
    return false;
  }
  async setJSON(key, data, options) {
    const r = await super.setJSON(key, data, options);
    if (r.modified) this.save();
    return r;
  }
  async delete(key) {
    await super.delete(key);
    this.save();
  }
}

const json = async (path) => (await fetch(path, { cache: "no-store" })).json();

function whoFrom(email) {
  if (!email) return null;
  const p = SAMPLE_PEOPLE.find((x) => x.email === email);
  return { id: p ? p.id : "demo-" + email.replace(/[^a-z0-9]/gi, "").slice(0, 40), email, name: p?.name || "", confirmedAt: "2026-01-01T00:00:00Z", emailVerified: true };
}

export function demoStartOver() {
  try { sessionStorage.removeItem(DATA_KEY); sessionStorage.removeItem(WHO_KEY); } catch { /* fine */ }
  location.reload();
}

/* Start the in-page server and answer the Dealer Center's calls with it. */
export async function startDemo() {
  const [manufacturer, library, full, small] = await Promise.all([
    json("/library/manufacturers/standard.json"), json("/library/construction.json"),
    json("/companies/demo/company.json"), json("/companies/starter/company.json"),
  ]);
  const blobs = new SavedBlobs();
  const had = blobs.load();
  const clock = { at: null };
  let acting = null;
  const office = createOffice({
    blobs,
    identityUser: async () => (acting ? acting.user : whoFrom(sessionStorage.getItem(WHO_KEY))),
    ownerEmail: SAMPLE_PEOPLE[0].email,
    manufacturer, library, templates: { full, small },
    now: () => clock.at || new Date(),
    siteUrl: location.origin,
    signIn: "local",
    checkOrigin: false,   /* every call is made inside this page */
    log: () => {},
    /* not connected to Barnwright: Help shows its answers and the email to
       write to, and browser problems go nowhere */
    license: null,
    help: null,
  });
  if (!had) {
    await seedSample({
      office, clock, manufacturer, library, businessId: "demo",
      act: (person) => { acting = { user: whoFrom(person?.email) }; },
    });
    acting = null;
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);
    if (url.origin !== location.origin) return realFetch(input, init);
    const path = url.pathname;
    if (path === "/__local/people") {
      const people = (await office.parts.store.all("people/")).filter((p) => p.active !== false)
        .map((p) => ({ email: p.email, name: p.name, role: p.role, lots: p.lots }));
      const invites = (await office.parts.store.all("invites/")).map((i) => ({ ...i, invited: true }));
      return Response.json({ people: [...people, ...invites], ownerEmail: SAMPLE_PEOPLE[0].email });
    }
    if (path === "/__local/sign-in") {
      const { email } = JSON.parse(init.body || "{}");
      if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Response.json({ error: "Type an email address." }, { status: 422 });
      sessionStorage.setItem(WHO_KEY, email.trim().toLowerCase());
      return new Response(null, { status: 204 });
    }
    if (path === "/__local/sign-out") {
      sessionStorage.removeItem(WHO_KEY);
      return new Response(null, { status: 204 });
    }
    if (path.startsWith("/api/office/") || path.startsWith("/api/lots/")) {
      const headers = new Headers(init.headers || {});
      const request = new Request(url.href, { method: init.method || "GET", headers, body: init.body });
      return office.handle(request, { clientIp: "demo" });
    }
    return realFetch(input, init);
  };
  return { office };
}
