/**
 * Convert a path that may contain backslashes (the OS-native separator
 * on Windows) to a POSIX-style path with forward slashes. Safe to call
 * on already-POSIX paths.
 */
export const toPosixPath = (filePath: string) => filePath.replaceAll("\\", "/");

export const stripTrailingSlashes = (filePath: string) =>
  filePath.replace(/\/+$/, "");

export const stripLeadingSlashes = (filePath: string) =>
  filePath.replace(/^\/+/, "");
