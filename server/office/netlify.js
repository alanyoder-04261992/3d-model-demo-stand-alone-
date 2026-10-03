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
                       "Yoder Storage Barns <office@yoder-storage-barns.com>" */

import { getStore, getDeployStore } from "@netlify/blobs";
import manufacturer from "../../library/manufacturers/standard.json" with { type: "json" };
import library from "../../library/construction.json" with { type: "json" };
import full from "../../companies/demo/company.json" with { type: "json" };
import small from "../../companies/starter/company.json" with { type: "json" };
import { createOffice } from "./index.js";
import { resendSender } from "./email.js";
import { netlifyIdentity } from "./identity.js";

const env = (name) => (globalThis.Netlify?.env.get(name) ?? process.env[name] ?? "").trim();

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
  });
  officeContext = key;
  return office;
}
