/**
 * pacwich calls `path.matchesGlob(...)`, a newer Node API that
 * `path-browserify` (and thus the node polyfill) doesn't implement. Rather
 * than alias `path` wholesale (which risks interop breakage for other
 * consumers), we add `matchesGlob` to the shared `path-browserify` exports.
 * rspack dedupes the module, so pacwich's `import path from "path"` (resolved
 * to path-browserify by the polyfill) sees the patched method — as long as
 * this module is imported before pacwich evaluates.
 */
import pathBrowserify from "path-browserify";

/** Translate a glob to a RegExp with Node-ish semantics (`*` stays within a
 * segment, `**` crosses separators), plus brace alternation and char classes. */
const globToRegExp = (glob: string): RegExp => {
  let re = "";
  let braceDepth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "{") {
      braceDepth++;
      re += "(?:";
    } else if (c === "}" && braceDepth > 0) {
      braceDepth--;
      re += ")";
    } else if (c === "," && braceDepth > 0) {
      re += "|";
    } else if (c === "[") {
      let cls = "[";
      i++;
      if (glob[i] === "!" || glob[i] === "^") {
        cls += "^";
        i++;
      }
      while (i < glob.length && glob[i] !== "]") {
        const ch = glob[i];
        cls += "\\^$.|?*+()[]{}".includes(ch) ? "\\" + ch : ch;
        i++;
      }
      cls += "]";
      re += cls;
    } else if ("\\^$.|+()".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp("^" + re + "$");
};

export const matchesGlob = (p: string, pattern: string): boolean =>
  globToRegExp(pattern).test(p);

const target = pathBrowserify as unknown as {
  matchesGlob?: typeof matchesGlob;
  posix?: { matchesGlob?: typeof matchesGlob };
};

if (!target.matchesGlob) {
  target.matchesGlob = matchesGlob;
  // path-browserify's `posix` points back at itself, but guard just in case.
  if (target.posix && !target.posix.matchesGlob) {
    target.posix.matchesGlob = matchesGlob;
  }
}

export {};
