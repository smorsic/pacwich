/**
 * URL-like or protocol-prefixed specifier: `node:fs`, `http://...`, etc.
 * Workspace package names can't take this form, so any such specifier is
 * unambiguously not a workspace reference.
 */
const PROTOCOL_PREFIX_REGEX = /^[a-z][a-z0-9+\-.]*:/i;

/**
 * Normalize an import specifier string to the bare package name it would
 * resolve to via Node-style module resolution. Returns `null` for any
 * specifier that can't refer to a workspace package by name:
 *   - relative imports (`./foo`, `../foo`)
 *   - absolute imports (`/foo`)
 *   - URL/protocol imports (`node:fs`, `https://...`)
 *   - the empty string
 *   - malformed scoped names (`@scope` with no `/name` segment)
 *
 * Strips subpaths so a finding can be matched against a workspace's
 * package.json `name`:
 *   - `lodash`                → `lodash`
 *   - `lodash/fp`             → `lodash`
 *   - `@scope/pkg`            → `@scope/pkg`
 *   - `@scope/pkg/sub/path`   → `@scope/pkg`
 */
export const normalizeImportSpecifierToPackageName = (
  specifier: string,
): string | null => {
  if (!specifier) return null;
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (PROTOCOL_PREFIX_REGEX.test(specifier)) return null;

  if (specifier.startsWith("@")) {
    const firstSlash = specifier.indexOf("/");
    if (firstSlash === -1) return null;
    const secondSlash = specifier.indexOf("/", firstSlash + 1);
    return secondSlash === -1 ? specifier : specifier.slice(0, secondSlash);
  }

  const firstSlash = specifier.indexOf("/");
  return firstSlash === -1 ? specifier : specifier.slice(0, firstSlash);
};
