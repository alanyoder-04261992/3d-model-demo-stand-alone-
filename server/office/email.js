/* THE OPTIONAL EMAILS.

   When RESEND_API_KEY and EMAIL_FROM are set on the site, the Dealer Center sends:
     * the lot an email when a website quote request arrives;
     * a person the owner adds to the team an invite, when the owner ticks
       "Email them the invite".
   Without those settings nothing is emailed and everything else works the
   same. A failed email never stops the quote from being saved. */

const dollars = (n) => "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* send({to, subject, text, html, replyTo}) through Resend's API. */
export function resendSender({ apiKey, from, fetchImpl = fetch, timeoutMs = 8000 }) {
  return async function send({ to, subject, text, html, replyTo }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      if (!r.ok) throw new Error(`Resend answered ${r.status}`);
      return true;
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createEmail({ send = null, siteUrl = "" }) {
  const on = typeof send === "function";

  /* A website quote request: tell the lot. */
  async function websiteQuote({ lot, customer, quote, settings }) {
    if (!on || !lot.email) return false;
    const link = `${siteUrl}/dealer#/customers/${customer.id}`;
    const business = settings.brand?.name || "Your business";
    const reach = [customer.phone, customer.email].filter(Boolean).join(" · ");
    const subject = `New quote request: ${quote.building} — ${customer.name}`;
    const text = [
      `${customer.name} designed a ${quote.building} on the ${lot.name} designer.`,
      `Price: ${dollars(quote.total)} (quote #${quote.number})`,
      reach ? `Reach them: ${reach}` : "",
      customer.zip ? `ZIP: ${customer.zip}` : "",
      "",
      `Open them in the Dealer Center: ${link}`,
      "",
      `— ${business} Dealer Center`,
    ].filter((l) => l !== null).join("\n");
    const html = `<p><b>${escapeHtml(customer.name)}</b> designed a <b>${escapeHtml(quote.building)}</b> on the ${escapeHtml(lot.name)} designer.</p>
<p>Price: <b>${dollars(quote.total)}</b> (quote #${quote.number})<br>${reach ? `Reach them: ${escapeHtml(reach)}<br>` : ""}${customer.zip ? `ZIP: ${escapeHtml(customer.zip)}` : ""}</p>
<p><a href="${escapeHtml(link)}">Open them in the Dealer Center</a></p>
<p style="color:#667">— ${escapeHtml(business)} Dealer Center</p>`;
    await send({ to: lot.email, subject, text, html, replyTo: customer.email || undefined });
    return true;
  }

  /* An invite to the team. */
  async function invite({ email, name, role, invitedByName, business }) {
    if (!on) return false;
    const link = `${siteUrl}/dealer`;
    const roleWords = { owner: "an owner", manager: "a manager", dealer: "a dealer" }[role] || "a member";
    const subject = `${invitedByName} added you to the ${business} Dealer Center`;
    const text = [
      `Hi ${name},`,
      "",
      `${invitedByName} added you to the ${business} Dealer Center as ${roleWords}.`,
      `Go to ${link}, choose "Make your login" and use this email address: ${email}`,
      "",
      `— ${business}`,
    ].join("\n");
    const html = `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(invitedByName)} added you to the ${escapeHtml(business)} Dealer Center as ${roleWords}.</p>
<p><a href="${escapeHtml(link)}">Open the Dealer Center</a>, choose <b>Make your login</b> and use this email address: <b>${escapeHtml(email)}</b></p><p>— ${escapeHtml(business)}</p>`;
    await send({ to: email, subject, text, html });
    return true;
  }

  return { on, websiteQuote, invite };
}
