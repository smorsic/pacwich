#!/bin/sh
":" //# ; case "$npm_lifecycle_event" in bunx) exec bun "$0" "$@" ;; *) exec node "$0" "$@" ;; esac
// POSIX-sh/Node polyglot. The line above is a sh dispatcher: `:` no-ops with `//#` as an arg, then `case` exec's bun (when invoked via bunx) or node. exec replaces the shell process, so sh never reads beyond it. On Windows the npm/bun-generated .cmd shim invokes node directly, bypassing sh entirely.
// Node strips the shebang and parses that line as `":"` (a string-literal expression statement, ASI'd) followed by a `//` line comment.
// DO NOT add a semicolon after `":"` — sh would then try to execute `//#` as a command. prettier wants to add one; the build keeps this file out of prettier's path via .prettierignore.
import { delegateToLocalPacwichIfPresent } from "../src/cli/localDelegation.js";
delegateToLocalPacwichIfPresent();
const { createCli } = await import("../src/cli/index.js");
createCli().run();
