/**
 * Split a comma-separated string into trimmed, non-empty entries. Used
 * for list-shaped CLI flags and env vars (e.g. `--suppress-warnings`,
 * `PACWICH_SUPPRESS_WARNINGS_DEFAULT`).
 *
 * @example
 * splitCsvList("a, b,,c") // ["a", "b", "c"]
 */
export const splitCsvList = (value: string): string[] =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
