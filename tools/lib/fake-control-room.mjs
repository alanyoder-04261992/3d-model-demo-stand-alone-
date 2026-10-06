/* A PRETEND BARNWRIGHT CONTROL ROOM, for tools/check-control-room.mjs,
   tools/check-help.mjs and the local Dealer Center (--control-room).

   It answers the four calls a business's Dealer Center makes, the way the
   real one does (alanyoder-04261992/control-room, commit be6b56e,
   netlify/functions/control-room.ts and _shared/support.ts; the help pass
   from the help pass spec v1, Oct 6 2026):
     POST /api/license          the activation key and business must match;
                                answers a signed seven-day lease, active or
                                read-only, with how many lots may be open,
                                and remembers the reported lot count
     POST /api/support-consent  the owner's "help from Barnwright" switch
     POST /api/support-verify   checks a support pass it issued
     POST /api/help-pass        a help pass good for 10 minutes for the
                                Sales Inbox ("question", "thread" or
                                "problem"), for every business whose key
                                matches, switched off or not; a question is
                                written in the business's audit list
   plus what Alan does in the real control room: switch a business on or
   off, change its lot limit, and start a support check (issueSupport).

   Signing uses a throwaway P-256 key made at start. That the real control
   room's signatures read the same way is proved separately, with leases it
   signed itself (test/control-room/leases.json). */

import { generateKeyPairSync, sign, verify, createPublicKey, randomBytes } from "node:crypto";
import { canonicalLease, LEASE_DURATION_MS } from "../../server/office/license-core.js";

export function fakeControlRoom({ clock, customerId = "cust_yoder", siteId = "site-yoder-1", activationKey = "bwk_" + "x".repeat(40), dealerLimit = 2 } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const business = {
    id: customerId, siteId, key: activationKey, status: "active", dealerLimit, addons: [],
    support: null, lastSeenAt: null, dealerCount: null, appVersion: null,
    name: "Sample Storage Barns", contact: "Chris Walker", email: "chris@samplebarns.example", siteUrl: "https://samplebarns.barnwrightsoftware.com", audit: [],
  };
  /* helpPasses: every help pass asked for ({kind, subject}), for the checks */
  const room = { down: false, calls: [], helpPasses: [], business, publicKeyPem, origin: "https://control-room.test" };
  const now = () => clock.t;

  const answer = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  function machine(request, body) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${business.key}` || body.customerId !== business.id || body.siteId !== business.siteId) return null;
    return business;
  }
  function signLease(payload) {
    const bytes = Buffer.from(canonicalLease(payload));
    return { payload: JSON.parse(bytes.toString()), signature: sign("sha256", bytes, { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url") };
  }
  const supportAllowed = (c, t) => !!c.support?.enabled && Date.parse(c.support.expiresAt) > t;

  /* Alan starts a support check in the control room: a pass good for at most 15 minutes */
  room.issueSupport = (actor = "alan@barnwright.test") => {
    const t = now();
    if (!supportAllowed(business, t)) throw new Error("The customer must turn on help first.");
    const claims = { purpose: "support-diagnostics", customerId: business.id, siteId: business.siteId, actor, grantAt: business.support.grantedAt, issuedAt: t, expiresAt: Math.min(t + 15 * 60_000, Date.parse(business.support.expiresAt)) };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${body}.${sign("sha256", Buffer.from(body), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  function verifySupport(token, c, t) {
    const [body, sig] = String(token).split(".");
    const signature = Buffer.from(sig || "", "base64url");
    if (signature.length !== 64 || !verify("sha256", Buffer.from(body), { key: createPublicKey(privateKey), dsaEncoding: "ieee-p1363" }, signature)) throw new Error("bad signature");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!supportAllowed(c, t) || claims.customerId !== c.id || claims.siteId !== c.siteId || claims.grantAt !== c.support.grantedAt || claims.expiresAt <= t) throw new Error("not allowed");
    return claims;
  }

  /* A help pass: base64url(claims) + "." + the signature over
     "barnwright-help-pass/v1." + that, so it never reads as a lease or a
     support pass. */
  function helpPass(c, kind, t) {
    const claims = {
      v: 1, purpose: "help-pass", kind, id: randomBytes(16).toString("base64url"),
      customerId: c.id, siteId: c.siteId, issuedAt: t, expiresAt: t + 10 * 60_000,
      account: {
        name: c.name, contact: c.contact, email: c.email, siteUrl: c.siteUrl,
        status: c.status === "active" ? "active" : "deactivated", billingStatus: "active", licensed: c.status === "active",
        dealerLimit: c.dealerLimit, dealerCount: c.dealerCount ?? 0, appVersion: c.appVersion || "",
        lastSeenAt: c.lastSeenAt || "", plan: "", supportUntil: "", lastCheck: null,
      },
    };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const sig = sign("sha256", Buffer.from("barnwright-help-pass/v1." + body), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    return { ok: true, pass: `${body}.${sig}`, expiresAt: new Date(claims.expiresAt).toISOString() };
  }

  room.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    room.calls.push(path);
    if (room.down) throw new TypeError("fetch failed");
    const request = new Request(url, init);
    const body = JSON.parse(init.body || "{}");
    const c = machine(request, body);
    if (!c) return answer({ error: "The activation key is not valid for this business." }, 401);
    const t = now();
    if (path === "/api/license") {
      c.lastSeenAt = new Date(t).toISOString();
      if (body.appVersion !== undefined) c.appVersion = body.appVersion;
      if (body.dealerCount !== undefined) c.dealerCount = body.dealerCount;
      return answer(signLease({ version: 1, customerId: c.id, siteId: c.siteId, status: c.status === "active" ? "active" : "read_only", issuedAt: t, expiresAt: t + LEASE_DURATION_MS, dealerLimit: c.dealerLimit, addons: c.addons }));
    }
    if (path === "/api/support-consent") {
      const hours = body.enabled ? Number(body.hours ?? 1) : 0;
      const previous = Date.parse(c.support?.grantedAt || "") || 0;
      const at = Math.max(t, previous + 1);
      c.support = { enabled: body.enabled, access: "diagnostics", expiresAt: new Date(at + hours * 3600_000).toISOString(), approvedBy: body.approvedBy, reason: body.reason, grantedAt: new Date(at).toISOString() };
      return answer({ ok: true, support: c.support });
    }
    if (path === "/api/support-verify") {
      try { return answer({ ok: true, claims: verifySupport(body.token, c, t) }); }
      catch { return answer({ error: "Support access is not valid." }, 403); }
    }
    if (path === "/api/help-pass") {
      const kinds = ["question", "thread", "problem"];
      if (!kinds.includes(body.kind) || (body.subject !== undefined && (body.kind !== "question" || typeof body.subject !== "string" || body.subject.length > 120))) {
        return answer({ error: "That help pass request isn't valid." }, 400);
      }
      room.helpPasses.push({ kind: body.kind, subject: body.subject ?? null });
      if (body.kind === "question") c.audit.push({ at: new Date(t).toISOString(), what: "Help question from the Dealer Center", detail: body.subject || "" });
      return answer(helpPass(c, body.kind, t));
    }
    return answer({ error: "Endpoint not found." }, 404);
  };
  return room;
}

/* The control room's own test of a diagnostics answer
   (control-room netlify/functions/_shared/diagnostics.ts diagnosticReport):
   -> null when it would accept it, else what it would reject. */
export function controlRoomRejects(value) {
  const record = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  const reasons = ["active", "deactivated", "expired", "unactivated", "invalid_license"];
  if (!record(value) || value.ok !== true || !record(value.license) || !record(value.checks)) return "shape";
  const v = value, license = value.license, checks = value.checks;
  if (typeof v.checkedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.checkedAt) || !Number.isFinite(Date.parse(v.checkedAt))) return "checkedAt";
  if (typeof v.appVersion !== "string" || !v.appVersion || v.appVersion.length > 100 || /[\u0000-\u001f\u007f]/.test(v.appVersion)) return "appVersion";
  if (typeof license.mode !== "string" || !["active", "read_only"].includes(license.mode) || typeof license.reason !== "string" || !reasons.includes(license.reason)) return "license";
  if ((license.mode === "active") !== (license.reason === "active")) return "license mode";
  if (!(license.expiresAt === null || (Number.isSafeInteger(license.expiresAt) && Number(license.expiresAt) > 0))) return "expiresAt";
  if (!(license.dealerLimit === null || (Number.isSafeInteger(license.dealerLimit) && Number(license.dealerLimit) >= 0 && Number(license.dealerLimit) <= 100000))) return "dealerLimit";
  if (!["database", "licensingConfigured", "stripeConfigured"].every((k) => typeof checks[k] === "boolean")) return "checks";
  if (JSON.stringify(value).length > 16000) return "too large";
  return null;
}
