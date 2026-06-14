import { execFile } from "child_process";
import { promisify } from "util";
import { IS_BUN } from "../internal/core";
import type { PackageManagerName } from "./adapter";

const execFileAsync = promisify(execFile);

/**
 * Cap the version probe so a hung binary can't stall callers.
 */
const DETECTION_TIMEOUT_MS = 5_000;

/**
 * Shell out to `<binary> --version` and return the trimmed stdout, or
 * `""` on any error (binary missing, non-zero exit, timeout, etc.).
 * Never throws.
 */
export const detectViaShell = async (binary: string): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(binary, ["--version"], {
      timeout: DETECTION_TIMEOUT_MS,
      shell: false,
    });
    return stdout.toString().trim();
  } catch {
    return "";
  }
};

type Detector = () => Promise<string>;

const DETECTORS: Record<PackageManagerName, Detector> = {
  bun: async () => (IS_BUN ? Bun.version : detectViaShell("bun")),
  pnpm: () => detectViaShell("pnpm"),
  npm: () => detectViaShell("npm"),
};

/**
 * Resolve the installed version of a package manager backend.
 *
 * Returns `""` when the version can't be discovered for any reason
 * (binary missing, non-zero exit, timeout, runtime exception).
 */
export const detectPackageManagerVersion = async (
  name: PackageManagerName,
): Promise<string> => DETECTORS[name]();
