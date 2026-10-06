/* CHECKING IN WITH BARNWRIGHT'S CONTROL ROOM (server only, Node).

   A plain-JavaScript copy of the control room's tenant SDK
   (alanyoder-04261992/control-room, commit be6b56e: sdk/server.ts,
   sdk/netlify-store.ts and verifyLease from shared/license.ts). The rules
   themselves are in license-core.js. Keep both in step with the control
   room; tools/check-control-room.mjs proves leases signed by its own code
   verify here, and runs every rule below against a pretend control room.

   What it does for a business's Dealer Center:
     refresh()        checks in (POST /api/license with the activation key)
                      and keeps the signed seven-day lease in durable storage
     getAccess()      what the lease allows right now (and remembers the
                      latest time seen, so turning a clock back gains nothing)
     peekAccess()     the same answer without writing anything -- added here
                      for the busy public 3D designer pages; every change
                      still goes through getAccess()/assertWritable()
     assertWritable() throws LicenseAccessError (423) when changes are not allowed
     forwardSupportConsent() / verifySupportAccess()
                      "help from Barnwright": the owner's on/off sent to the
                      control room, and each support visit checked online
     helpPass()       the Help screen (added here, not in the SDK): a pass
                      good for 10 minutes that lets help.js ask Barnwright's
                      Sales Inbox a question, read the answers or report a
                      browser problem

   Never import this file into the browser (it uses node:crypto), and never
   into server/office/index.js (the in-browser demo runs that file). */

import { createHash, createPublicKey, verify } from "node:crypto";
import {
  canAddDealership, canUseAddon, canonicalLease, evaluateVerifiedLease, parseCache, parseEnvelope,
  selectNewestLease, validLeaseContext,
} from "./license-core.js";

export { LEASE_DURATION_MS } from "./license-core.js";

function checkP256(key) {
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("License signing requires an ECDSA P-256 key");
  }
}

/* shared/license.ts verifyLease */
export function verifyLease(envelope, publicKeyPem, expected, now = Date.now(), options = {}) {
  const parsed = parseEnvelope(envelope);
  if (!parsed || !validLeaseContext(parsed.payload, expected, now, options.allowExpired)) return null;
  try {
    const key = createPublicKey(publicKeyPem);
    checkP256(key);
    return verify("sha256", Buffer.from(canonicalLease(parsed.payload)), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(parsed.signature, "base64url")) ? parsed.payload : null;
  } catch {
    return null;
  }
}

export class LicenseAccessError extends Error {
  constructor(code) {
    super(code);
    this.name = "LicenseAccessError";
    this.status = 423;
    this.code = code;
  }
}

export class TenantLicenseClient {
  /* options: { customerId, siteId, controlRoomUrl, activationKey, publicKeyPem, store,
                fetch?, now?, timeoutMs?, allowLocalDevelopment? } */
  constructor(options) {
    const url = new URL(options.controlRoomUrl);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw new Error("controlRoomUrl must be an origin");
    const local = options.allowLocalDevelopment && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) throw new Error("Control Room requires HTTPS");
    if (!options.activationKey || !options.customerId || !options.siteId || !options.publicKeyPem) throw new Error("Missing server license configuration");
    this.options = options;
    this.origin = url.origin;
    this.request = options.fetch ?? fetch;
    this.lastObservedAt = 0;
    this.pendingRefresh = null;
  }

  clock(cache = null) {
    const now = this.options.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now) || now <= 0) throw new Error("Invalid server clock");
    this.lastObservedAt = Math.max(now, this.lastObservedAt, cache?.lastObservedAt ?? 0);
    return this.lastObservedAt;
  }

  verifiedCache(value) {
    const parsed = parseCache(value);
    if (!parsed) return null;
    return verifyLease(parsed.envelope, this.options.publicKeyPem, this.options, this.clock(parsed), { allowExpired: true }) ? parsed : null;
  }

  /* Recheck at every change. Reads and downloads keep using normal sign-in rules. */
  async getAccess() {
    let raw;
    try { raw = await this.options.store.read(); }
    catch { return evaluateVerifiedLease(null, this.clock(), "invalid_license"); }
    const cached = this.verifiedCache(raw);
    if (!cached) return evaluateVerifiedLease(null, this.clock(), raw == null ? "unactivated" : "invalid_license");
    try {
      const saved = await this.options.store.update((current) => {
        const latest = this.verifiedCache(current);
        if (!latest) throw new Error("Invalid durable license cache");
        return { ...latest, lastObservedAt: this.clock(latest) };
      });
      const checked = this.verifiedCache(saved);
      return evaluateVerifiedLease(checked?.envelope.payload ?? null, this.clock(checked), "invalid_license");
    } catch {
      return evaluateVerifiedLease(null, this.clock(), "invalid_license");
    }
  }

  /* Added in the Dealer Center (not in the SDK): getAccess() without the
     write, plus when the lease was signed (its last successful check-in). */
  async peekAccess() {
    let raw;
    try { raw = await this.options.store.read(); }
    catch { return { ...evaluateVerifiedLease(null, this.clock(), "invalid_license"), checkedAt: null }; }
    const cached = this.verifiedCache(raw);
    if (!cached) return { ...evaluateVerifiedLease(null, this.clock(), raw == null ? "unactivated" : "invalid_license"), checkedAt: null };
    return { ...evaluateVerifiedLease(cached.envelope.payload, this.clock(cached), "invalid_license"), checkedAt: cached.envelope.payload.issuedAt };
  }

  /* Network failures keep the existing signed expiry. Only a valid new signed lease renews it. */
  refresh(metadata = {}) {
    if (!this.pendingRefresh) this.pendingRefresh = this.performRefresh(metadata).finally(() => { this.pendingRefresh = null; });
    return this.pendingRefresh;
  }

  async performRefresh(metadata) {
    let refreshed = false;
    try {
      const response = await this.request(`${this.origin}/api/license`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.activationKey}` },
        body: JSON.stringify({ customerId: this.options.customerId, siteId: this.options.siteId, ...metadata }),
      });
      if (!response.ok) throw new Error("License renewal unavailable");
      const incoming = parseEnvelope(await response.json());
      if (!incoming || !verifyLease(incoming, this.options.publicKeyPem, this.options, this.clock())) throw new Error("Invalid renewal");
      const saved = await this.options.store.update((raw) => {
        const current = this.verifiedCache(raw);
        const now = this.clock(current);
        if (!verifyLease(incoming, this.options.publicKeyPem, this.options, now)) throw new Error("Renewal is not current");
        return { version: 1, envelope: selectNewestLease(current?.envelope ?? null, incoming), lastObservedAt: now };
      });
      refreshed = saved.envelope.signature === incoming.signature;
    } catch { /* Transport, invalid responses and storage failures never make a new lease. */ }
    return { refreshed, access: await this.getAccess() };
  }

  /* The signed public envelope only (the SDK's browser helper reads it; the
     Dealer Center's screens ask the server instead). */
  async getEnvelope() {
    try { return this.verifiedCache(await this.options.store.read())?.envelope ?? null; }
    catch { return null; }
  }

  async assertWritable(requirements = {}) {
    const access = await this.getAccess();
    if (!access.canWrite) throw new LicenseAccessError(access.reason);
    if (requirements.addon && !canUseAddon(access, requirements.addon)) throw new LicenseAccessError("addon_not_enabled");
    if (requirements.addingDealershipWithCurrentCount !== undefined && !canAddDealership(access, requirements.addingDealershipWithCurrentCount)) throw new LicenseAccessError("dealership_limit_reached");
    return access;
  }

  /* verifyOwner must check the owner's own sign-in before returning {ownerId}. */
  async forwardSupportConsent(request, verifyOwner, consent) {
    const owner = await verifyOwner(request);
    if (!owner?.ownerId) throw new Error("HQ owner authorization required");
    if (typeof consent.enabled !== "boolean" || typeof consent.reason !== "string" || consent.reason.length > 1_000) throw new Error("Invalid support consent");
    if (consent.enabled && (!consent.reason.trim() || !Number.isInteger(consent.hours ?? 1) || (consent.hours ?? 1) < 1 || (consent.hours ?? 1) > 24)) throw new Error("Support consent must expire within 24 hours");
    const response = await this.request(`${this.origin}/api/support-consent`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.activationKey}` },
      body: JSON.stringify({ customerId: this.options.customerId, siteId: this.options.siteId, enabled: consent.enabled,
        approvedBy: owner.ownerId, reason: consent.reason.trim(), hours: consent.hours ?? 1 }),
    });
    if (!response.ok) throw new Error("Support consent could not be updated");
    const result = await response.json();
    const support = result.support;
    if (result.ok !== true || !support || support.enabled !== consent.enabled || support.approvedBy !== owner.ownerId
      || !Number.isFinite(Date.parse(support.grantedAt)) || !Number.isFinite(Date.parse(support.expiresAt))) throw new Error("Invalid support consent response");
    return support;
  }

  /* Support never uses the seven-day grace: every visit needs current local consent and an online check. */
  async verifySupportAccess(token, getLocalConsent) {
    if (typeof token !== "string" || token.length > 8_000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error("Invalid support token");
    const initial = await getLocalConsent();
    if (!initial?.enabled || !Number.isFinite(Date.parse(initial.expiresAt)) || Date.parse(initial.expiresAt) <= this.clock()) throw new Error("Support consent is not active");
    const response = await this.request(`${this.origin}/api/support-verify`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.activationKey}` },
      body: JSON.stringify({ customerId: this.options.customerId, siteId: this.options.siteId, token }),
    });
    if (!response.ok) throw new Error("Support access could not be verified");
    const result = await response.json();
    const claims = result.claims;
    const local = await getLocalConsent();
    const now = this.clock();
    if (result.ok !== true || !claims || claims.purpose !== "support-diagnostics"
      || claims.customerId !== this.options.customerId || claims.siteId !== this.options.siteId
      || typeof claims.actor !== "string" || !claims.actor || claims.actor.length > 200
      || !Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt)
      || claims.issuedAt > now + 60_000 || claims.expiresAt <= now || claims.expiresAt <= claims.issuedAt
      || claims.expiresAt - claims.issuedAt > 15 * 60_000
      || !local?.enabled || !Number.isFinite(Date.parse(local.expiresAt)) || Date.parse(local.expiresAt) <= now
      || claims.grantAt !== local.grantedAt || claims.grantAt !== initial.grantedAt
      || claims.expiresAt > Date.parse(local.expiresAt)) throw new Error("Support scope or consent is invalid");
    return claims;
  }

  /* Added in the Dealer Center (not in the SDK): the control room's POST
     /api/help-pass, signed in like /api/license with the activation key.
     kind: "question" (someone asks; subject is the question's first words,
     at most 120 characters, and only for a question), "thread" (read the
     business's questions and Barnwright's answers) or "problem" (a browser
     error). The control room answers every business whose key and site
     match, switched off or not -- a business whose changes stopped needs
     help most. The pass is signed for Barnwright's Sales Inbox, which
     checks it with the control room's public key; here it is only checked
     for its shape and handed on (server/office/help.js). timeoutMs: how
     long to wait this time (help.js gives what its request has left). A
     refusal carries the control room's status (401: the key or site isn't
     this business's). */
  async helpPass(kind, subject, { timeoutMs } = {}) {
    if (!["question", "thread", "problem"].includes(kind)) throw new Error("Invalid help pass kind");
    if (subject !== undefined && (kind !== "question" || typeof subject !== "string" || subject.length > 120
      || /[\u0000-\u001f\u007f]/.test(subject))) throw new Error("Invalid help pass subject");
    const wait = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : this.options.timeoutMs ?? 10_000;
    const response = await this.request(`${this.origin}/api/help-pass`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(wait),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.options.activationKey}` },
      body: JSON.stringify({ customerId: this.options.customerId, siteId: this.options.siteId, kind, ...(subject ? { subject } : {}) }),
    });
    if (!response.ok) throw Object.assign(new Error("Help pass unavailable"), { status: response.status });
    const result = await response.json();
    if (!result || result.ok !== true || typeof result.pass !== "string" || result.pass.length > 8_000
      || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.pass)) throw new Error("Invalid help pass response");
    return result.pass;
  }
}

/* sdk/netlify-store.ts, with the blob store passed in (Netlify Blobs on the
   live site, MemoryBlobs in the checks). Conditional writes keep a newer
   lease safe from a late, older one. */
export function createLeaseStore(customerId, siteId, blobs) {
  if (!customerId || !siteId) throw new Error("Tenant binding is required for the durable cache");
  const key = createHash("sha256").update(JSON.stringify([customerId, siteId])).digest("hex");
  return {
    async read() { return (await blobs.getWithMetadata(key, { type: "json", consistency: "strong" }))?.data ?? null; },
    async update(updater) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const current = await blobs.getWithMetadata(key, { type: "json", consistency: "strong" });
        if (current && !current.etag) throw new Error("Durable license cache has no concurrency token");
        const next = updater(current?.data ?? null);
        const result = await blobs.setJSON(key, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
        if (result.modified) return next;
      }
      throw new Error("Durable license cache is busy; retry the request");
    },
  };
}

/* A Dealer Center with some but not all of the control room settings:
   nothing can be changed, the support checks say it is not configured,
   and no help pass can be had (the Help screen says to email instead). */
export function misconfiguredLicense() {
  const access = () => ({ ...evaluateVerifiedLease(null, Date.now(), "invalid_license"), checkedAt: null });
  const refuse = () => { throw new Error("The control room settings are incomplete"); };
  return {
    misconfigured: true,
    getAccess: async () => access(),
    peekAccess: async () => access(),
    refresh: async () => ({ refreshed: false, access: access() }),
    getEnvelope: async () => null,
    assertWritable: async () => { throw new LicenseAccessError("invalid_license"); },
    forwardSupportConsent: async () => refuse(),
    verifySupportAccess: async () => refuse(),
    helpPass: async () => refuse(),
  };
}
