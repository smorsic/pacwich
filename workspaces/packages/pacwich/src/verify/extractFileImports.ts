/**
 * One occurrence of an import/require/export-from specifier extracted from a
 * source file.
 */
export type ExtractedImport = {
  /** The literal string passed to the import/require/export-from. */
  specifier: string;
  /** 1-based line in the original source where the import keyword appeared. */
  line: number;
};

/**
 * Produce a same-length copy of `source` with comment contents and string
 * contents replaced with spaces. Newlines are preserved everywhere so byte
 * offsets continue to map to the original line numbers. Opening/closing
 * quote characters are left intact so structural import regexes can still
 * locate them.
 *
 * Why blank string contents: a string literal that contains import-like
 * text (e.g. `const s = \`import x from "y"\``) must not produce a false
 * positive. By emptying string contents, the import regex only matches
 * structural imports.
 *
 * Escape sequences (`\X`) inside strings are passed through without ending
 * the string. Template-literal interpolations (`${...}`) are treated as
 * opaque string content. Imports inside them are not detected, which we
 * accept as a v1 limitation.
 */
const blankCommentsAndStringContents = (source: string): string => {
  const len = source.length;
  const result: string[] = new Array(len);
  let i = 0;
  let mode: "normal" | "single" | "double" | "template" | "line" | "block" =
    "normal";

  while (i < len) {
    const char = source[i];
    const nextChar = i + 1 < len ? source[i + 1] : "";

    if (mode === "normal") {
      if (char === "/" && nextChar === "/") {
        result[i] = " ";
        result[i + 1] = " ";
        mode = "line";
        i += 2;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        result[i] = " ";
        result[i + 1] = " ";
        mode = "block";
        i += 2;
        continue;
      }
      if (char === "'") {
        result[i] = char;
        mode = "single";
        i += 1;
        continue;
      }
      if (char === '"') {
        result[i] = char;
        mode = "double";
        i += 1;
        continue;
      }
      if (char === "`") {
        result[i] = char;
        mode = "template";
        i += 1;
        continue;
      }
      result[i] = char;
      i += 1;
      continue;
    }

    if (mode === "line") {
      if (char === "\n") {
        result[i] = char;
        mode = "normal";
      } else {
        result[i] = " ";
      }
      i += 1;
      continue;
    }

    if (mode === "block") {
      if (char === "*" && nextChar === "/") {
        result[i] = " ";
        result[i + 1] = " ";
        mode = "normal";
        i += 2;
        continue;
      }
      result[i] = char === "\n" ? "\n" : " ";
      i += 1;
      continue;
    }

    // string / template modes: blank inner characters but preserve newlines
    // and handle backslash escapes (don't let an escaped quote end the
    // literal early).
    if (char === "\\" && i + 1 < len) {
      result[i] = " ";
      result[i + 1] = source[i + 1] === "\n" ? "\n" : " ";
      i += 2;
      continue;
    }
    const closer = mode === "single" ? "'" : mode === "double" ? '"' : "`";
    if (char === closer) {
      result[i] = char;
      mode = "normal";
      i += 1;
      continue;
    }
    result[i] = char === "\n" ? "\n" : " ";
    i += 1;
  }

  return result.join("");
};

const buildLineOffsetIndex = (source: string): number[] => {
  const offsets: number[] = [];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") offsets.push(i);
  }
  return offsets;
};

/**
 * Binary search the precomputed `offsets` of newline positions to return
 * the 1-based line number containing `offset`.
 */
const offsetToLine = (offsets: number[], offset: number): number => {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (offsets[mid] < offset) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
};

/**
 * Static import / `export ... from` pattern run against the blanked source.
 *
 * - `(?<![\w$.])` ensures the keyword isn't a suffix of a longer
 *   identifier (`xexport`) or a member-access call (`obj.import`).
 * - The optional `(?:[^;]*?\bfrom\s+)?` clause covers `import x from`,
 *   `import { a, b } from` (including multi-line braced forms), and
 *   re-export bindings. The lazy `*?` plus the `\bfrom\s+` anchor keeps
 *   the match scoped to a single statement; `[^;]` prevents the engine
 *   from racing across statement boundaries.
 * - `(["'])( *)\1` matches the specifier's quote pair. Because the source
 *   was blanked, the specifier's inner content is always one or more
 *   spaces (or zero, for the empty specifier). The actual text is
 *   recovered from the original source via the match indices.
 */
const STATIC_IMPORT_PATTERN =
  /(?<![\w$.])(?:import|export)(?:\s+type)?\s+(?:[^;]*?\bfrom\s+)?(["'])( *)\1/g;

const DYNAMIC_IMPORT_PATTERN = /(?<![\w$.])import\s*\(\s*(["'])( *)\1\s*\)/g;

const REQUIRE_PATTERN = /(?<![\w$.])require\s*\(\s*(["'])( *)\1\s*\)/g;

const PATTERNS = [
  STATIC_IMPORT_PATTERN,
  DYNAMIC_IMPORT_PATTERN,
  REQUIRE_PATTERN,
];

/**
 * Extract every import/require/export-from specifier from a JS/TS source
 * file along with the 1-based line number where each statement starts.
 *
 * Results are sorted by line, then specifier. Specifiers can repeat (e.g.
 * several `import` statements referencing the same module).
 *
 * Known v1 limitations:
 *   - Specifiers inside template-literal interpolations (`${...}`) are not
 *     matched.
 *   - Dynamic require/import with non-string-literal arguments cannot be
 *     statically resolved and are skipped.
 */
export const extractFileImports = (source: string): ExtractedImport[] => {
  if (!source) return [];
  const blanked = blankCommentsAndStringContents(source);
  const lineOffsets = buildLineOffsetIndex(blanked);
  const results: ExtractedImport[] = [];

  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(blanked)) !== null) {
      const blankedSpecifier = match[2];
      const openQuoteOffsetWithinMatch = match[0].indexOf(match[1]);
      const specifierStart = match.index + openQuoteOffsetWithinMatch + 1;
      const specifierLength = blankedSpecifier.length;
      const specifier = source.slice(
        specifierStart,
        specifierStart + specifierLength,
      );
      if (!specifier) continue;
      results.push({
        specifier,
        line: offsetToLine(lineOffsets, match.index),
      });
    }
  }

  results.sort(
    (a, b) => a.line - b.line || a.specifier.localeCompare(b.specifier),
  );
  return results;
};
