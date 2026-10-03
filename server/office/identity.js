/* WHO IS SIGNED IN, ASKED OF NETLIFY IDENTITY DIRECTLY.

   The browser keeps the person's sign-in in the nf_jwt cookie (and the
   Dealer Center also sends it as "Authorization: Bearer"). We hand that
   token to Identity's own /user address: only a real, unexpired sign-in
   gets a 200 back. We do not use @netlify/identity's server getUser(): on a
   deployed site it can send the site's own admin token instead of the
   person's and answer with a user that has no confirmed email.

   Identity can be set to "autoconfirm" (no email check). Then anybody could
   make a login with the owner's or an invited person's email, so invites
   and the first-owner claim are refused while autoconfirm is on (people
   who already have access keep it). */

const USER_CACHE_MS = 60 * 1000;
const SETTINGS_CACHE_MS = 5 * 60 * 1000;

function tokenOf(request) {
  const auth = request.headers.get("authorization") || "";
  const m = /^Bearer\s+([A-Za-z0-9._-]{20,4096})$/.exec(auth.trim());
  if (m) return m[1];
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "nf_jwt") {
      const value = decodeURIComponent(rest.join("="));
      if (/^[A-Za-z0-9._-]{20,4096}$/.test(value)) return value;
    }
  }
  return null;
}

export function netlifyIdentity({ fetchImpl = fetch, now = () => Date.now() } = {}) {
  const users = new Map();
  let settings = { at: 0, autoconfirm: true };

  async function autoconfirm(base) {
    if (now() - settings.at < SETTINGS_CACHE_MS) return settings.autoconfirm;
    try {
      const r = await fetchImpl(`${base}/settings`, { signal: AbortSignal.timeout(5000) });
      const data = r.ok ? await r.json() : null;
      settings = { at: now(), autoconfirm: data ? data.autoconfirm === true : true };
    } catch {
      settings = { at: now() - SETTINGS_CACHE_MS + 30000, autoconfirm: true };
    }
    return settings.autoconfirm;
  }

  return async function identityUser(request) {
    const token = tokenOf(request);
    if (!token) return null;
    const base = `${new URL(request.url).origin}/.netlify/identity`;
    const hit = users.get(token);
    let user = hit && now() - hit.at < USER_CACHE_MS ? hit.user : null;
    if (!user) {
      let r;
      try {
        r = await fetchImpl(`${base}/user`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
      } catch {
        return null;
      }
      if (r.status !== 200) return null;
      const u = await r.json();
      if (!u || typeof u.id !== "string" || typeof u.email !== "string") return null;
      user = {
        id: u.id, email: u.email, confirmedAt: u.confirmed_at || u.email_confirmed_at || null,
        name: u.user_metadata?.full_name || "",
      };
      if (users.size > 500) users.clear();
      users.set(token, { user, at: now() });
    }
    return { ...user, emailVerified: !(await autoconfirm(base)) };
  };
}

/* Send Netlify Identity's own invite email (works when registration is
   "Invite only"). Needs the site's admin token, which only a deployed
   function has. -> true when Identity accepted it. */
export async function identityInvite({ url, token }, email, fetchImpl = fetch) {
  if (!url || !token) return false;
  try {
    const r = await fetchImpl(`${url}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}
