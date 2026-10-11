/* A PRETEND NETLIFY IDENTITY, for the checks and the local Dealer Center
   with --identity. Nothing real is called: it answers the same addresses
   Netlify Identity answers on a site (/.netlify/identity/...), the way
   Netlify's own Identity (GoTrue, github.com/netlify/gotrue) does:

     GET  /settings                 {autoconfirm: false, disable_signup: false}
     POST /token   password         an email and password -> an access token
                                    (an HS256 JWT that lasts `ttl` seconds,
                                    Netlify's default 3600) and a refresh token;
                                    a wrong one: 400 invalid_grant
     POST /token   refresh_token    a new pair; the old refresh token is spent
                                    (used again: 400 invalid_grant)
     GET  /user, PUT /user          the person for an access token (401 when it
                                    is wrong or ran out); PUT sets a password
     POST /logout                   every refresh token of that person goes
     POST /signup                   a login waiting for its confirmation link
     POST /verify                   a link's token: "signup" (confirm, or an
                                    invite with its password) or "recovery"
                                    -> a token pair
     POST /recover                  a reset link for an email (same answer
                                    whether it exists or not)

   fakeIdentity({clock}) -> {
     handle(request)         the answer to a browser's request (any origin)
     fetch(url, init)        the same for the Dealer Center server's own
                             calls (identity.js fetchImpl), which `trouble`
                             can break on purpose
     addUser({id, email, password, name, confirmed})
     linkToken(type, email)  the token an email link would carry: "invite"
                             (makes the invited login), "signup", "recovery"
     trouble                 {server: null | "down" | "slow" | 429 | 503,
                              browser: null | "slow" | 429 | 503,
                              logout: null | "hang"} -- "down" fails like
                             a network error, "slow" waits until the caller
                             gives up
     ttl                     seconds an access token lasts
     liveRefresh(userId?)    the refresh tokens still good (SHA-256 short)
     calls                   every request: {from, method, path, status, grant}
   }
   clock() is the time in ms (the checks move it). Tokens and passwords are
   never put in `calls`. */

import { createHmac, createHash, randomBytes, randomUUID } from "node:crypto";

const short = (t) => (t ? createHash("sha256").update(String(t)).digest("hex").slice(0, 8) : null);
const b64u = (x) => Buffer.from(x).toString("base64url");
const J = (data, status = 200, headers = {}) => new Response(data === null ? null : JSON.stringify(data), {
  status, headers: data === null ? headers : { "Content-Type": "application/json", ...headers },
});
/* netlify/gotrue clears its own nf_jwt cookie on logout and on a spent refresh token */
const CLEAR = { "Set-Cookie": "nf_jwt=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax" };

export function fakeIdentity({ clock = () => Date.now(), ttl = 3600 } = {}) {
  const secret = randomBytes(32);
  const users = [];
  const refresh = new Map();      /* token -> {userId, spent} */
  const links = new Map();        /* token -> {type, email} */
  const calls = [];
  const trouble = { server: null, browser: null, logout: null };
  const me = { users, calls, trouble, ttl, short };

  me.addUser = ({ id = randomUUID(), email, password = null, name = "", confirmed = true }) => {
    const u = { id, email, password, name, confirmed_at: confirmed ? "2026-09-01T12:00:00Z" : null, created_at: "2026-09-01T12:00:00Z" };
    users.push(u);
    return u;
  };
  const byEmail = (email) => users.find((u) => u.email.toLowerCase() === String(email || "").toLowerCase());
  me.linkToken = (type, email) => {
    if (type === "invite" && !byEmail(email)) me.addUser({ email, confirmed: false });
    const token = randomBytes(12).toString("base64url");
    links.set(token, { type: type === "recovery" ? "recovery" : "signup", email });
    return token;
  };
  me.liveRefresh = (userId) => [...refresh.entries()].filter(([, r]) => !r.spent && (!userId || r.userId === userId)).map(([k]) => short(k));

  const now = () => Math.floor(clock() / 1000);
  function sign(u) {
    const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = b64u(JSON.stringify({ exp: now() + me.ttl, sub: u.id, email: u.email, session_id: randomUUID(), app_metadata: { provider: "email" }, user_metadata: { full_name: u.name } }));
    return `${head}.${body}.${createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url")}`;
  }
  function verifyJwt(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return null;
    if (createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url") !== parts[2]) return null;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (claims.exp < now()) return null;
    return users.find((u) => u.id === claims.sub) || null;
  }
  function grant(u) {
    const rt = randomBytes(16).toString("base64url");
    refresh.set(rt, { userId: u.id, spent: false });
    return { access_token: sign(u), token_type: "bearer", expires_in: me.ttl, refresh_token: rt };
  }
  const userJson = (u) => ({
    id: u.id, aud: "", role: "", email: u.email, confirmed_at: u.confirmed_at, app_metadata: { provider: "email" },
    user_metadata: { full_name: u.name }, created_at: u.created_at, updated_at: u.created_at,
  });
  const bearer = (req) => (/^Bearer\s+(.+)$/.exec(req.headers.get("authorization") || "") || [])[1] || null;

  async function answer(req, path) {
    if (path === "/settings") return J({ external: { email: true }, disable_signup: false, autoconfirm: false });
    if (path === "/token" && req.method === "POST") {
      const form = new URLSearchParams(await req.text());
      const type = form.get("grant_type");
      if (type === "password") {
        const u = byEmail(form.get("username"));
        /* netlify/gotrue compares the email exactly; a wrong case is "no user" */
        if (!u || u.email !== form.get("username") || !u.password || u.password !== form.get("password")) return J({ error: "invalid_grant", error_description: "No user found with that email, or password invalid." }, 400);
        if (!u.confirmed_at) return J({ error: "invalid_grant", error_description: "Email not confirmed" }, 400);
        return J(grant(u));
      }
      if (type === "refresh_token") {
        const rec = refresh.get(form.get("refresh_token") || "");
        if (!rec) return J({ error: "invalid_grant", error_description: "Invalid Refresh Token" }, 400);
        if (rec.spent) return J({ error: "invalid_grant", error_description: "Invalid Refresh Token" }, 400, CLEAR);
        rec.spent = true;
        return J(grant(users.find((u) => u.id === rec.userId)));
      }
      return J({ error: "unsupported_grant_type", error_description: "" }, 400);
    }
    if (path === "/user") {
      const u = verifyJwt(bearer(req));
      if (!u) return J({ code: 401, msg: "Invalid token" }, 401, CLEAR);
      if (req.method === "PUT") {
        const body = await req.json().catch(() => ({}));
        if (typeof body.password === "string") u.password = body.password;
      }
      return J(userJson(u));
    }
    if (path === "/logout" && req.method === "POST") {
      const u = verifyJwt(bearer(req));
      if (!u) return J({ code: 401, msg: "Invalid token" }, 401, CLEAR);
      if (trouble.logout === "hang") await new Promise(() => {});
      for (const [k, r] of [...refresh.entries()]) if (r.userId === u.id) refresh.delete(k);
      return J(null, 204, CLEAR);
    }
    if (path === "/signup" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (byEmail(body.email)?.confirmed_at) return J({ code: 400, msg: "A user with this email address has already been registered" }, 400);
      const u = byEmail(body.email) || me.addUser({ email: body.email, confirmed: false });
      u.password = body.password;
      u.name = body.data?.full_name || "";
      me.lastSignup = me.linkToken("signup", u.email);
      return J(userJson(u));
    }
    if (path === "/verify" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const link = links.get(body.token);
      if (!link || link.type !== body.type) return J({ code: 404, msg: "User not found" }, 404);
      const u = byEmail(link.email);
      if (!u) return J({ code: 404, msg: "User not found" }, 404);
      if (link.type === "signup") {
        if (!u.password && !body.password) return J({ code: 422, msg: "A password is required" }, 422);
        if (body.password) u.password = body.password;
        u.confirmed_at = u.confirmed_at || "2026-10-01T12:00:00Z";
      }
      links.delete(body.token);
      return J(grant(u));
    }
    if (path === "/recover" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (byEmail(body.email)) me.lastRecovery = me.linkToken("recovery", body.email);
      return J({});
    }
    return J({ code: 404, msg: "Not found" }, 404);
  }

  const slow = (signal) => new Promise((_, no) => {
    const stop = () => no(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
    if (signal?.aborted) stop();
    signal?.addEventListener("abort", stop);
    setTimeout(stop, 60000);
  });
  const pathOf = (url) => new URL(url).pathname.replace(/^\/\.netlify\/identity/, "") || "/";
  const grantOf = async (req) => (req.method === "POST" && pathOf(req.url) === "/token" ? new URLSearchParams(await req.clone().text()).get("grant_type") : undefined);

  /* a browser's request */
  me.handle = async (req) => {
    const path = pathOf(req.url);
    const note = { from: "browser", method: req.method, path, grant: await grantOf(req) };
    let res;
    if (trouble.browser === "slow") res = await new Promise((done) => setTimeout(() => done(J({ code: 503, msg: "slow" }, 503)), 20000));
    else if (trouble.browser === 429 || trouble.browser === 503) res = J({ code: trouble.browser, msg: "Try later" }, trouble.browser);
    else res = await answer(req, path);
    calls.push({ ...note, status: res.status });
    return res;
  };
  /* the Dealer Center server's own request (identity.js) */
  me.fetch = async (url, init = {}) => {
    const req = new Request(url, init);
    const path = pathOf(url);
    const note = { from: "server", method: req.method, path, grant: await grantOf(req) };
    const t = trouble.server;
    if (t === "down") { calls.push({ ...note, status: "network error" }); throw new TypeError("fetch failed"); }
    if (t === "slow") { calls.push({ ...note, status: "too slow" }); return slow(init.signal); }
    if ((t === 429 || t === 503) && path !== "/settings") { calls.push({ ...note, status: t }); return J({ code: t, msg: "Try later" }, t); }
    const res = await answer(req, path);
    calls.push({ ...note, status: res.status });
    return res;
  };
  return me;
}
