import { spawnSync } from "child_process";
import { existsSync, realpathSync } from "fs";
import path from "path";

const LOCAL_PACWICH_BIN_REL = path.join(
  "node_modules",
  "pacwich",
  "bin",
  "cli.js",
);

const findLocalPacwichBin = (startDir: string): string | null => {
  let dir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(dir, LOCAL_PACWICH_BIN_REL);
    if (existsSync(candidate)) {
      try {
        return realpathSync(candidate);
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
};

/**
 * Re-exec the project-local `node_modules/pacwich/bin/cli.js` (found by walking
 * up from `process.cwd()`) when the current process is running a different
 * pacwich install (a global install, or `bunx`/`npx pacwich` from a
 * directory tree that has its own pinned pacwich). When the local resolution
 * matches the current entry script, or no local install is found, this is a
 * no-op and the current process continues.
 *
 * Set `PACWICH_DISABLE_LOCAL_DELEGATION=true` to skip the delegation entirely
 * (intended for developing pacwich itself, where the local resolution may
 * point at a TS-only source tree that can't be re-exec'd under node).
 *
 * Called at the top of `bin/cli.js` (built) and `bin/cliDev.js` (dev) so a
 * global install effectively delegates to the project-local version the way
 * `npx`/`bunx` do.
 *
 * @example
 * ```ts
 * delegateToLocalPacwichIfPresent();
 * // ...rest of bin entry only runs when no local delegation happened
 * ```
 */
export const delegateToLocalPacwichIfPresent = (): void => {
  if (process.env.PACWICH_DISABLE_LOCAL_DELEGATION === "true") return;

  const entry = process.argv[1];
  if (!entry) return;

  let resolvedEntry: string;
  try {
    resolvedEntry = realpathSync(entry);
  } catch {
    return;
  }

  const localBin = findLocalPacwichBin(process.cwd());
  if (!localBin || localBin === resolvedEntry) return;

  const result = spawnSync(
    process.execPath,
    [localBin, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.signal) process.exit(128);
  process.exit(result.status ?? 1);
};
