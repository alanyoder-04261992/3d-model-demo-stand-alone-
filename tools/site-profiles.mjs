// Hosting identities are public build metadata, not credentials. Keep the
// existing lesson site working without changing the default client package.
export const learningSiteId = "4cdee4d5-1a46-4c3c-bcc8-2b1887f71fb4";

export function includeLearningPreview({ client = false, env = process.env } = {}) {
  if (client) return false;
  if (env.INCLUDE_LEARNING_PREVIEW === "false") return false;
  return env.INCLUDE_LEARNING_PREVIEW === "true" || env.SITE_ID === learningSiteId;
}
