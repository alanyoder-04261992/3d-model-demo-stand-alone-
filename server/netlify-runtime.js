/* CONNECT THE OFFICE TO NETLIFY. Production data survives deploys; previews
   have separate temporary stores. Identity verifies users; editable profile
   metadata never grants access. Manufacturer JSON is bundled server-side. */
import { getStore, getDeployStore } from "@netlify/blobs";
import { getUser, admin } from "@netlify/identity";
import manufacturer from "../library/manufacturers/standard.json" with { type: "json" };
import library from "../library/construction.json" with { type: "json" };
import { createBackend } from "./dealer-backend.js";

export function backendFor(context) {
  const options = { name: "dealer-office-v1", consistency: "strong" };
  const store = context.deploy.context === "production" ? getStore(options) : getDeployStore(options);
  return createBackend({
    store,
    loadCatalogue: async (id) => { if (id !== manufacturer.id) throw new Error("Manufacturer is not installed."); return { manufacturer, library }; },
    identityUser: getUser,
    lookupUser: (id) => admin.getUser(id),
    bootstrapEmail: Netlify.env.get("OWNER_BOOTSTRAP_EMAIL") || "",
    clientIp: context.ip || "unknown",
  });
}
