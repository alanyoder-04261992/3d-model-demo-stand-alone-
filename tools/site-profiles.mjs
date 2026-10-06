// Hosting identities are public build metadata, not credentials. Keep the
// existing lesson site working without changing the default client package.
export const learningSiteId = "4cdee4d5-1a46-4c3c-bcc8-2b1887f71fb4";

export function includeLearningPreview({ client = false, env = process.env } = {}) {
  if (client) return false;
  if (env.INCLUDE_LEARNING_PREVIEW === "false") return false;
  return env.INCLUDE_LEARNING_PREVIEW === "true" || env.SITE_ID === learningSiteId;
}

// The Dealer Center's "try it" demo (/dealer?demo: made-up data that stays in
// the visitor's own browser tab). The learning preview has it, and so does the
// site Alan shows to shed companies, which says DEALER_DEMO=true in its
// Netlify settings and gets no lesson pages. A client build never has it.
export function includeDealerDemo({ client = false, env = process.env } = {}) {
  if (client) return false;
  return env.DEALER_DEMO === "true" || includeLearningPreview({ client, env });
}
