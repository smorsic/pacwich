export const SCRIPT_SHELL_OPTIONS = ["bun", "system"] as const;

/** The shell that runs inline scripts: Bun's shell (`"bun"`) or the system shell (`"system"`). */
export type ScriptShellOption = (typeof SCRIPT_SHELL_OPTIONS)[number];

/** A {@link ScriptShellOption}, or `"default"` to defer to the project config's `defaults.shell`. */
export type ShellOption = ScriptShellOption | "default";

export const OUTPUT_STYLE_VALUES = [
  "grouped",
  "prefixed",
  "plain",
  "none",
] as const;

/** CLI output style for `run-script` / `run-affected`: a live `"grouped"` TUI, `"prefixed"` lines, unprefixed `"plain"`, or `"none"` to suppress script output. */
export type OutputStyleName = (typeof OUTPUT_STYLE_VALUES)[number];

export const PARALLEL_MAX_VALUES = ["auto", "unbounded", "default"] as const;

/**
 * Package manager backends pacwich ships an adapter for.
 *
 * Lives here (not in the pacwich package itself) so the project config
 * type, the AJV schema, and the CLI global option can reference it
 * without pulling in the pacwich package. pacwich depends on
 * pacwich-common, not the other way around.
 *
 * Order is significant: it sets deterministic auto-detect precedence
 * when multiple lockfiles are present (bun → pnpm → npm). pnpm is
 * preferred over npm since it's the more explicit pm choice and has
 * first-class workspaces.
 */
export const PACKAGE_MANAGER_NAMES = ["bun", "pnpm", "npm"] as const;

/** Identifier of a supported package manager backend. */
export type PackageManagerName = (typeof PACKAGE_MANAGER_NAMES)[number];

/**
 * User-facing package manager selector. Accepted by the project config
 * `packageManager` field, the `PACWICH_PACKAGE_MANAGER` env
 * var, the CLI `--pm` flag, and the `packageManager` option on
 * project factories. `"auto"` resolves to a concrete
 * {@link PackageManagerName} at project-creation time via lockfile
 * detection.
 */
export const PACKAGE_MANAGER_VALUES = [
  "auto",
  ...PACKAGE_MANAGER_NAMES,
] as const;

export type PackageManagerValue = (typeof PACKAGE_MANAGER_VALUES)[number];

export type PercentageValue = `${number}%`;

/**
 * The maximum number of scripts that can run in parallel.
 *
 * - `number`: The exact number of scripts that can run in parallel.
 * - `"auto"`: The number of available logical CPU threads.
 * - `"unbounded"`: No limit.
 * - `"default"`: The default value, either "auto" or the value of the project config's "parallelMax" option.
 * - `"${number}%"`: A percentage of the available logical CPU threads (e.g. "50%").
 */
export type ParallelMaxValue =
  | number
  | (typeof PARALLEL_MAX_VALUES)[number]
  | PercentageValue;
