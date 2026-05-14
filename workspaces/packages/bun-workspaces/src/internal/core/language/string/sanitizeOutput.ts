/**
 * Strip ANSI escape sequences and other terminal-disruptive control
 * characters from a string before rendering it. Use this for values
 * sourced from package.json, config files, or other untrusted inputs to
 * prevent terminal-escape injection in bw's CLI output (e.g., a workspace
 * name containing `\x1b[2J` clearing the user's screen during `bw info`).
 *
 * Preserves `\n` and `\t`. Strips ANSI sequences plus C0/C1 controls
 * other than newline and tab.
 */
// eslint-disable-next-line no-control-regex
const DISRUPTIVE_CONTROLS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

export const sanitizeOutput = (value: string): string =>
  Bun.stripANSI(value).replace(DISRUPTIVE_CONTROLS_REGEX, "");
