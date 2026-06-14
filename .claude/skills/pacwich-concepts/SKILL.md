---
name: pacwich-concepts
description: "Workspace patterns, workspace script metadata, and how to run scripts via the CLI."
when_to_use: "When selecting workspaces by pattern (name/alias/path/tag) or reasoning about scripts and affected resolution."
---

## pacwich npm package: Concepts

### Workspace patterns

Many features accept a list of workspace patterns to match a subset of workspaces:

`[not:][(name|alias|path|tag):][re:]<value>`

By default, a pattern matches the workspace name or alias: `my-workspace-name` or `my-alias-name`. Aliases are defined in config explained below.

Patterns can include a wildcard to match only by workspace name: `my-workspace-*`.

- Alias pattern specifier: `alias:my-alias-*`.
- Path pattern specifier (supports glob): `path:packages/**/*`.
- Name pattern specifier: `name:my-workspace-*`.
- Tag pattern specifier: `tag:my-tag`.
- Any pattern can start with `not:` to negate the pattern. (e.g. "not:my-workspace-name", "not:tag:my-tag-\*") This excludes workspaces that match any other present patterns from a result.
- Regex pattern modifier can be applied before the pattern value: `re:` (e.g. "re:^my-workspace-.+" or "not:alias:re:^my-alias-.+")

> Patterns are always resolved as a list against the full workspace set. `not:` patterns only exclude — they need a positive pattern to subtract from. A list containing only `not:` patterns matches nothing. To express "all workspaces except X," pair the negation with an explicit positive like `*`: `pacwich run lint "*" "not:tag:legacy"`.

#### Special selectors

- Special root workspace selector: `@root`. This is a reference to the root workspace, whether it's included in a Project's workspace list or not.

### Workspace Script Metadata

Scripts ran via pacwich can access metadata about the workspace, script, and project
via env vars. This same metadata can also be interpolated into inline scripts and appended args.

```typescript
// in a workspace's script invoked by pacwich using a metadata function
import { getWorkspaceScriptMetadata } from "pacwich/script";

// Use the helper within a script that was invoked via pacwich
const projectPath = getWorkspaceScriptMetadata("projectPath");
const projectName = getWorkspaceScriptMetadata("projectName");
const workspaceName = getWorkspaceScriptMetadata("workspaceName");
const workspacePath = getWorkspaceScriptMetadata("workspacePath");
const workspaceRelativePath = getWorkspaceScriptMetadata(
  "workspaceRelativePath",
);
const scriptName = getWorkspaceScriptMetadata("scriptName");
```

```typescript
// In a script, but accessing the same data via plain environment variables (same values as previous example)
const projectPath = process.env.PACWICH_PROJECT_PATH;
const workspaceName = process.env.PACWICH_WORKSPACE_NAME;
const workspacePath = process.env.PACWICH_WORKSPACE_PATH;
const workspaceRelativePath = process.env.PACWICH_WORKSPACE_RELATIVE_PATH;
const scriptName = process.env.PACWICH_SCRIPT_NAME;
```

```bash
# interpolated
pacwich run "bun <projectPath>/my-script.ts" --inline \
  --inline-name="my-script-name" \
  --args="<workspaceName> <workspacePath>"
```

### Affected workspaces

A workspace is "affected" when something in its set of **inputs** has changed. Inputs default to:

- Files in the workspace's directory (only git-trackable files; the default file pattern is `"."`)
- Workspace dependencies. If a workspace dep is affected for any reason, dependents cascade as affected.
- All non-workspace dependencies declared in its `package.json` (across all four maps: `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`). Version changes are detected by diffing resolved versions in the active package manager's lockfile (`bun.lock`, `pnpm-lock.yaml`, or `package-lock.json`). For `peerDependencies`/`optionalDependencies`, lockfile presence is the gate. An unresolved optional (e.g. a platform-skipped native binding) emits no change.

Inputs are configurable per workspace (`defaultInputs`) and per script (`scripts[name].inputs`):

- `files`: file/dir/glob patterns relative to the workspace. Leading `/` makes a pattern relative to the project root. Prefix `!` to exclude. Only git-trackable files match.
- `workspacePatterns`: workspace patterns whose matched workspaces are treated as inputs (like dependencies, but without needing a real `package.json` dep).
- `externalDependencies`: an allowlist of package names. Omitted = all external deps participate; `[]` = none participate; non-empty = only listed names participate (intersected with the workspace's actual external deps).

There are two diff sources:

- **git** (default): diff `HEAD` against the configured base ref (default `main`, configurable via `defaults.affectedBaseRef` in the project config or `PACWICH_AFFECTED_BASE_REF_DEFAULT` env var). Uncommitted changes (staged, unstaged, untracked) are included by default. Gitignored files never participate.
- **fileList**: pass changed files explicitly (paths, dirs, or globs). Bypasses git entirely.

Use `--explain` for a per-workspace summary of changed inputs and dep cascade reasons, and `--explain --detailed` for full per-file/edge breakdowns including the affected-dep chain.

---

See also: pacwich-overview, pacwich-cli, pacwich-api, pacwich-config.
For orientation, see the pacwich-overview skill.

<!-- Generated by pacwich v0.1.0-test.2. Re-run `pacwich add-skills` to update. -->
