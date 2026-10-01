/* Dealer-routed submissions. Routing and price are determined by the server. */
const pendingRequests = new Map();
export async function submitManagedOrder(managed, design, contact, timeoutMs = 20000) {
  const content = JSON.stringify({ design, contact, version: managed.version });
  // A lost response/retry must not create two orders. Save only a digest + random
  // request ID in this tab's storage; never save the contact details here.
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(content))), b => b.toString(16).padStart(2, "0")).join("");
  const key = `shed-order:${managed.slug}:${digest}`;
  let idempotencyKey = pendingRequests.get(key);
  try { idempotencyKey ||= sessionStorage.getItem(key); } catch { /* storage denied in an iframe */ }
  idempotencyKey ||= crypto.randomUUID();
  pendingRequests.set(key, idempotencyKey);
  try { sessionStorage.setItem(key, idempotencyKey); } catch { /* still submit */ }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(managed.orderUrl, {
      method: "POST", credentials: "omit", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ design, contact, version: managed.version, idempotencyKey }),
    });
    const receipt = await response.json();
    if (!response.ok) return { ok: false, why: receipt.error || "Your dealer could not receive this request." };
    return { ok: true, how: "managed", receipt };
  } catch (e) {
    return { ok: false, why: e.name === "AbortError" ? "The response timed out. Try again; your request will only be saved once."
      : "Check your connection and try again." };
  } finally { clearTimeout(timer); }
}
