import fs from "fs";
import path from "path";
import { IS_BUN, IS_WINDOWS } from "../internal/core";

const checkBunOnPath = (): boolean => {
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter);
  const candidates = IS_WINDOWS ? ["bun.exe", "bun.cmd", "bun"] : ["bun"];
  for (const entry of pathEntries) {
    if (!entry) continue;
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(entry, candidate))) return true;
    }
  }
  return false;
};

let cached: boolean | undefined;

/**
 * Wrapped in an object so tests can override the lookup via `vi.spyOn`
 * without having to scrub `PATH` or run under a forked Node process.
 */
export const shellAvailability = {
  isBunAvailable: (): boolean => {
    if (cached !== undefined) return cached;
    cached = IS_BUN || checkBunOnPath();
    return cached;
  },
  /** Test-only: drop the cached lookup result. */
  resetCache: (): void => {
    cached = undefined;
  },
};
