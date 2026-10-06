// Hosting identities are public build metadata, not credentials. Keep the
// existing lesson site working without changing the default client package.
export const learningSiteId = "4cdee4d5-1a46-4c3c-bcc8-2b1887f71fb4";

export function includeLearningPreview({ client = false, env = process.env } = {}) {
  if (client) return false;
  if (env.INCLUDE_LEARNING_PREVIEW === "false") return false;
  return env.INCLUDE_LEARNING_PREVIEW === "true" || env.SITE_ID === learningSiteId;
}

// Alan's demo site for shed companies (barnwright-demo on Netlify).
export const demoSiteId = "27229ef6-91ad-4173-87b3-b35dfbe6546f";

// The Dealer Center's "try it" demo (/dealer?demo: made-up data that stays in
// the visitor's own browser tab). The learning preview has it, and so does
// the demo site, which gets no lesson pages; a build run with DEALER_DEMO=true
// does the same anywhere else. A client build never has it.
export function includeDealerDemo({ client = false, env = process.env } = {}) {
  if (client) return false;
  return env.DEALER_DEMO === "true" || env.SITE_ID === demoSiteId || includeLearningPreview({ client, env });
}
