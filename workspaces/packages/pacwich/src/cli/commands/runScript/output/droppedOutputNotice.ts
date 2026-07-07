/** Human-readable byte size for output notices (1024-based). */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * A one-line notice that `bytes` of a script's earlier output were dropped to
 * stay within the in-memory output buffer cap. Rendered inline at the gap so
 * readers know output is missing (the most recent output is always kept).
 */
export const formatDroppedOutputNotice = (bytes: number): string =>
  `… ${formatBytes(bytes)} of earlier output dropped (output buffer limit reached) …`;
