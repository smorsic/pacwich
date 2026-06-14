/**
 * Strip ANSI escape sequences and terminal-disruptive control characters
 * from a string before rendering it. Use this for values sourced from
 * package.json, config files, or other untrusted inputs to prevent
 * terminal-escape injection in pacwich's CLI output (e.g., a workspace
 * name containing `\x1b[2J` clearing the user's screen during `pacwich
 * info`).
 *
 * Strips ANSI sequences (CSI, OSC terminated by BEL or ST, and common
 * single-character escapes) plus C0/C1 controls and DEL. Preserves `\n`
 * and `\t` so multi-line / tab-separated payloads stay intact.
 *
 * Goes a step beyond `Bun.stripANSI`, which only handles the ANSI
 * sequences themselves. Pacwich folds the additional control-char
 * sanitation in so every call site is safe by default.
 */
const ANSI_REGEX = new RegExp(
  [
    // OSC sequences. Match first so the prefix doesn't get consumed by
    // the CSI alternative. OSC = ESC ] (or single-byte CSI U+009B), any
    // payload, terminated by BEL or ESC \.
    "(?:[\\u001B\\u009B]\\][\\s\\S]*?(?:\\u0007|\\u001B\\u005C))",
    "|",
    // Other ANSI introducers and the rest of the pattern (CSI etc.).
    "[\\u001B\\u009B][[\\]()#;?]*",
    "(?:",
    "(?:(?:(?:;[-a-zA-Z\\d/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d/#&.:=?%@~_]*)*)?\\u0007)",
    "|",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~])",
    ")",
  ].join(""),
  "g",
);

// eslint-disable-next-line no-control-regex
const DISRUPTIVE_CONTROLS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

export const stripANSI = (value: string): string =>
  value.replace(ANSI_REGEX, "").replace(DISRUPTIVE_CONTROLS_REGEX, "");
