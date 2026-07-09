const TEMPLATES = {
  DeprecatedBunWorkspacesFlag:
    "The {flag} flag from bun-workspaces is deprecated and will be removed in a future version. This is now pacwich's default behavior.",
  BashLoginShellHint: "{hint}",
  VerifyIssue: "{message}",
  DeprecatedNoPrefixFlag:
    "--no-prefix is deprecated and will be removed in a future version. Use --output-style=plain instead.",
  MultipleConfigsFound: "Found multiple {configName} configs:\n{details}",
  InvalidCliScriptOutputStyleEnvVar:
    "Ignoring invalid PACWICH_CLI_SCRIPT_OUTPUT_STYLE_DEFAULT value {envValue} (expected one of: {values}).",
  InvalidPackageManagerEnvVar:
    'Ignoring invalid PACWICH_PACKAGE_MANAGER value {envValue} (expected one of: {values}). Falling back to "auto".',
  InputPatternOutsideProject:
    'Input pattern {pattern} for workspace "{workspaceName}" resolves outside the project root and will be ignored.',
  MultiplePackageManagerLockfiles:
    'Multiple package manager lockfiles detected ({lockfiles}). Picking "{winner}". Set "packageManager" explicitly (project config, --pm, or PACWICH_PACKAGE_MANAGER) to silence this. See https://pacwich.dev/intro/getting-started#package-manager-selection.',
  BunLockParseFailed: "Could not parse {context}: {detail}. {fallback}",
  BunLockNewerVersion:
    "Bun lockfile{atPath} reports version {version}, newer than the latest supported ({maxVersion}). Parsing anyway; results may be incomplete.",
  NpmLockParseFailed: "Could not parse {context}: {detail}. {fallback}",
  NpmLockNewerVersion:
    "npm lockfile{atPath} reports version {version}, newer than the latest supported ({maxVersion}). Parsing anyway; results may be incomplete.",
  PnpmLockParseFailed: "Could not parse {context}: {detail}. {fallback}",
  PnpmLockNewerVersion:
    "pnpm lockfile{atPath} reports version {version}, newer than the latest supported ({maxVersion}.x). Parsing anyway; results may be incomplete.",
  PnpmWorkspacesFieldIgnored:
    'The "workspaces" field in package.json is not used by pnpm. Define workspace packages in "pnpm-workspace.yaml" instead.',
  DeprecatedProjectMapMethod:
    "Project.{oldName}() is deprecated and will be removed in a future version. Use Project.{newName} instead.",
  UnsupportedRuntime: "{message}",
  UnsupportedPackageManagerVersion: "{message}",
  DependencyCycleDetected:
    "Dependency cycle detected: {dependency} -> {dependent} (ignoring)",
  MissingWorkspacesHint: "{hint}",
  IgnoreInputFilesNegationNotHonored:
    'verify.workspaceDependencies.ignoreInputFiles entry {pattern} starts with "!". Re-include negations are not honored here. Treating it as an ignore pattern.',
  ParallelExceedsAvailableCpus:
    "Number of scripts to run in parallel ({batchSize}) is greater than the available CPUs ({recommendedMax})",
} as const;

/** Id of a pacwich warning. Appears in a warning's printed `[pacwich WARN: <id>]` prefix and is what `suppressWarnings` matches against. */
export type WarningId = keyof typeof TEMPLATES;

export const WARNING_IDS = Object.keys(TEMPLATES) as WarningId[];

type ExtractPlaceholder<Message extends string> =
  Message extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractPlaceholder<Rest>
    : never;

/** Named args a warning id's template requires, derived from its `{placeholder}` tokens. Empty object when the template has none. */
export type WarningInterpolation<Id extends WarningId> = [
  ExtractPlaceholder<(typeof TEMPLATES)[Id]>,
] extends [never]
  ? Record<never, never>
  : { [Key in ExtractPlaceholder<(typeof TEMPLATES)[Id]>]: string };

/** Renders a warning id's template with the given interpolation. */
export const formatWarningMessage = <Id extends WarningId>(
  id: Id,
  interpolation: WarningInterpolation<Id>,
): string =>
  TEMPLATES[id].replace(
    /\{(\w+)\}/g,
    (match, key) => (interpolation as Record<string, string>)[key] ?? match,
  );
