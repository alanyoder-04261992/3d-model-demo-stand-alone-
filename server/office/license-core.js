/* THE BARNWRIGHT ACCOUNT RULES, WITH NO CRYPTOGRAPHY AND NO STORAGE.

   A plain-JavaScript copy of the control room's sdk/core.ts
   (alanyoder-04261992/control-room, commit be6b56e). The control room signs
   a "lease" every time a business's Dealer Center checks in: active or
   read-only, good for exactly seven days, with how many lots it may open.
   These functions read and judge a lease; control-room.js checks its
   signature. Keep this file in step with sdk/core.ts:
   tools/check-control-room.mjs proves leases signed by the control room's
   own code are read the same way here.

   Node-safe and browser-safe (no imports). */

export const LEASE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_FUTURE_SKEW_MS = 60_000;

const leaseKeys = ["version", "customerId", "siteId", "status", "issuedAt", "expiresAt", "dealerLimit", "addons"];
const record = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const identifier = (value) => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

/* Schema validation is not signature verification. Never grant access from this alone. */
export function parseLease(value) {
  if (!record(value) || Object.keys(value).length !== leaseKeys.length || !leaseKeys.every((key) => Object.hasOwn(value, key))) return null;
  if (value.version !== 1 || !identifier(value.customerId) || !identifier(value.siteId)) return null;
  if (value.status !== "active" && value.status !== "read_only") return null;
  if (!Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)) return null;
  if (value.issuedAt <= 0 || value.expiresAt - value.issuedAt !== LEASE_DURATION_MS) return null;
  if (!Number.isSafeInteger(value.dealerLimit) || value.dealerLimit < 0 || value.dealerLimit > 100_000) return null;
  if (!Array.isArray(value.addons) || value.addons.length > 100 || !value.addons.every((item) => typeof item === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(item))) return null;
  if (new Set(value.addons).size !== value.addons.length) return null;
  return {
    version: 1, customerId: value.customerId, siteId: value.siteId, status: value.status,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt,
    dealerLimit: value.dealerLimit, addons: [...value.addons],
  };
}

/* Fixed property order is the wire format; the control room signs these bytes. */
export function canonicalLease(payload) {
  const valid = parseLease(payload);
  if (!valid) throw new Error("Invalid license payload");
  return JSON.stringify(valid);
}

export function parseEnvelope(value) {
  if (!record(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value, "payload") || !Object.hasOwn(value, "signature")) return null;
  const payload = parseLease(value.payload);
  /* P-256 IEEE-P1363 signatures are exactly 64 bytes (86 unpadded base64url characters). */
  if (!payload || typeof value.signature !== "string" || !/^[A-Za-z0-9_-]{85}[AQgw]$/.test(value.signature)) return null;
  return { payload, signature: value.signature };
}

export function validLeaseContext(payload, expected, now, allowExpired = false) {
  return Number.isSafeInteger(now) && now > 0 && payload.customerId === expected.customerId && payload.siteId === expected.siteId
    && payload.issuedAt <= now + MAX_FUTURE_SKEW_MS && (allowExpired || now < payload.expiresAt);
}

export function parseCache(value) {
  if (!record(value) || value.version !== 1 || !Number.isSafeInteger(value.lastObservedAt) || value.lastObservedAt <= 0) return null;
  const envelope = parseEnvelope(value.envelope);
  return envelope ? { version: 1, envelope, lastObservedAt: value.lastObservedAt } : null;
}

/* Only pass a cryptographically verified lease. Expiry is exclusive, with no grace beyond seven days.
   -> { mode, canWrite, canDownload, reason, dealerLimit, addons, expiresAt }
   reason: active | deactivated | expired | unactivated | invalid_license */
export function evaluateVerifiedLease(lease, now, missingReason = "unactivated") {
  const reason = !Number.isSafeInteger(now) || now <= 0 ? "invalid_license" : !lease ? missingReason : lease.status === "read_only" ? "deactivated" : now >= lease.expiresAt ? "expired" : "active";
  return {
    mode: reason === "active" ? "active" : "read_only", canWrite: reason === "active", canDownload: true,
    reason, dealerLimit: lease?.dealerLimit ?? 0, addons: lease ? [...lease.addons] : [], expiresAt: lease?.expiresAt ?? null,
  };
}

export function canUseAddon(access, addon) {
  return access.canWrite && access.addons.includes(addon);
}

/* "Dealership" in the control room is a lot here: dealerLimit is how many lots may be open. */
export function canAddDealership(access, currentCount) {
  return access.canWrite && Number.isSafeInteger(currentCount) && currentCount >= 0 && currentCount < access.dealerLimit;
}

/* Never replace a newer cached lease with a replay. Revocation wins equal-timestamp races. */
export function selectNewestLease(current, incoming) {
  if (!current || incoming.payload.issuedAt > current.payload.issuedAt) return incoming;
  if (incoming.payload.issuedAt < current.payload.issuedAt) return current;
  if (incoming.payload.status === "read_only") return incoming;
  return current;
}
