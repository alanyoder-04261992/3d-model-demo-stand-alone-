/* CONNECT THE OFFICE TO NETLIFY.

   Data: the Blobs store "office-v2". The live site keeps one store for
   good; every preview deploy gets its own empty store, so trying things on
   a preview never touches real customers.

   Sign-in: Netlify Identity, asked directly about the person's own sign-in
   (identity.js). Only a confirmed email counts; nothing a person can edit
   on their own profile is trusted, and invites and the first-owner claim
   are refused while Identity "autoconfirm" is on.

   Settings (Netlify > Site configuration > Environment variables):
     OWNER_EMAIL       the first owner's email (needed once, at setup)
     RESEND_API_KEY    optional: lets the Office send emails
     EMAIL_FROM        optional: who the emails come from, e.g.
                       "Yoder Storage Barns <office@yoder-storage-barns.com>"

   A business that buys the Dealer Center from Barnwright is connected to
   Barnwright's control room (account.js says what that changes). The
   control room shows these when Alan makes the business's activation key:
     CONTROL_ROOM_URL             https://barnwright-control-room.netlify.app
     CONTROL_ROOM_CUSTOMER_ID     the business in the control room
     CONTROL_ROOM_ACTIVATION_KEY  secret: Functions scope only, never in a
                                  page or a file
     CONTROL_ROOM_PUBLIC_KEY      the control room's public key (PEM)
     CONTROL_ROOM_SITE_ID         optional: this site's Netlify site ID
                                  (Netlify's own is used when left out)
   None of them set: not connected, nothing is limited (Alan's own site).
   Some but not all: nothing can be changed until they are all there.

   The Help screen's questions go to Barnwright's Sales Inbox (help.js),
   only for a business connected to the control room:
     BARNWRIGHT_HELP_URL          optional: the Sales Inbox's address,
                                  https://inbox.barnwrightsoftware.com when
                                  left out. https only (plain http only for
                                  localhost while running netlify dev on a
                                  computer). Anything else: Help says to
                                  email support@barnwrightsoftware.com. */

import { getStore, getDeployStore } from "@netlify/blobs";
import manufacturer from "../../library/manufacturers/standard.json" with { type: "json" };
import library from "../../library/construction.json" with { type: "json" };
import full from "../../companies/demo/company.json" with { type: "json" };
import small from "../../companies/starter/company.json" with { type: "json" };
import { createOffice } from "./index.js";
import { resendSender } from "./email.js";
import { netlifyIdentity } from "./identity.js";
import { TenantLicenseClient, createLeaseStore, misconfiguredLicense } from "./control-room.js";
import { HELP_INBOX, inboxOrigin } from "./help.js";

const env = (name) => (globalThis.Netlify?.env.get(name) ?? process.env[name] ?? "").trim();

/* Barnwright's Sales Inbox for the Help screen, or null when
   BARNWRIGHT_HELP_URL is set wrong (written in the function log). */
function helpInbox(context) {
  const url = env("BARNWRIGHT_HELP_URL") || HELP_INBOX;
  const allowLocal = context.deploy?.context === "dev" || env("NETLIFY_DEV") === "true";
  try {
    inboxOrigin(url, { allowLocal });
  } catch (error) {
    console.error(`${error.message}. Help questions can't reach Barnwright until it is fixed.`);
    return null;
  }
  return { url, allowLocal, timeoutMs: 6000 };
}

/* The control room check-in, or null when this site is not connected. */
function controlRoom(context) {
  const url = env("CONTROL_ROOM_URL"), customerId = env("CONTROL_ROOM_CUSTOMER_ID");
  const activationKey = env("CONTROL_ROOM_ACTIVATION_KEY");
  const publicKeyPem = env("CONTROL_ROOM_PUBLIC_KEY").replace(/\\n/g, "\n");
  const siteId = env("CONTROL_ROOM_SITE_ID") || context.site?.id || env("SITE_ID");
  if (!url && !customerId && !activationKey && !publicKeyPem) return null;
  try {
    return new TenantLicenseClient({
      controlRoomUrl: url, customerId, siteId, activationKey, publicKeyPem,
      store: createLeaseStore(customerId, siteId, getStore({ name: "barnwright-tenant-license-v1", consistency: "strong" })),
      timeoutMs: 6000,   /* opening the Dealer Center waits for a due check-in at most this long */
    });
  } catch (error) {
    console.error("The control room settings are incomplete:", error?.message);
    return misconfiguredLicense();
  }
}

let office = null;
let officeContext = null;
const identityUser = netlifyIdentity();   /* one per function instance: it remembers sign-ins for a minute */

export function officeFor(context) {
  const key = context.deploy?.context || "production";
  if (office && officeContext === key) return office;
  const options = { name: "office-v2", consistency: "strong" };
  const blobs = key === "production" ? getStore(options) : getDeployStore(options);
  const apiKey = env("RESEND_API_KEY"), from = env("EMAIL_FROM");
  office = createOffice({
    blobs,
    identityUser,
    ownerEmail: env("OWNER_EMAIL") || env("OWNER_BOOTSTRAP_EMAIL"),
    manufacturer, library,
    templates: { full, small },
    sendEmail: apiKey && from ? resendSender({ apiKey, from }) : null,
    siteUrl: (context.site?.url || env("URL") || "").replace(/\/+$/, ""),
    signIn: "netlify",
    license: controlRoom(context),
    help: helpInbox(context),
    appVersion: `dealer-center ${String(context.deploy?.id || "dev").slice(0, 24)}`,
  });
  officeContext = key;
  return office;
}
