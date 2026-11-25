/** Pages not useful to agents, excluded from llms.txt and the copy-markdown UI */
export const LLMS_EXCLUDED_ROUTE_PATHS = new Set([
  "/lore",
  "/how",
  "/web-cli",
  "/roadmap",
]);

export const isLlmsExcludedRoutePath = (routePath: string): boolean =>
  LLMS_EXCLUDED_ROUTE_PATHS.has(routePath.replace(/\/$/, ""));
