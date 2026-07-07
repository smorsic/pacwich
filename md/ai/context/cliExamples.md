### pacwich npm package: CLI examples

```bash
pacwich list-workspaces # human-readable output
pacwich ls --json --pretty # ls is alias for list-workspaces
pacwich ls "name:my-workspace-*" "alias:my-alias-*" "path:packages/**/*" # accepts workspace patterns

# info includes the name, aliases, path, etc.
pacwich workspace-info my-workspace
pacwich info my-workspace --json --pretty # info is alias for workspace-info

# list scripts available across the project, grouped by workspaces that have them
pacwich list-scripts
pacwich ls-scripts --name-only # ls-scripts is alias for list-scripts

# info includes the script name and workspaces that have it in their package.json "scripts" field
pacwich script-info my-script --json --pretty

# list tags defined across workspaces with the workspaces that carry them
pacwich list-tags
pacwich ls-tags --json --pretty # ls-tags is alias for list-tags

# info about a single tag (lists workspaces tagged with it)
pacwich tag-info my-tag --json --pretty

# run the package.json "lint" script for all workspaces that have it
pacwich run-script lint

# run is alias for run-script
# run the package.json "lint" script for workspaces using matching specifiers
pacwich run lint my-workspace-name "alias:my-alias-pattern-*" "path:my-glob/**/*" # accepts workspace patterns

# A workspace's script will wait until any workspaces it depends on have completed
# Similar to Bun's --filter behavior
pacwich run lint --dep-order

# Continue running scripts even if a dependency fails
pacwich run lint --dep-order --ignore-dep-failure

# special root workspace selector (works even if root workspace is not included)
pacwich run lint @root

# Scripts run in parallel by default
pacwich run lint --parallel=false # Run in series

# Default can be overridden by config or env var PACWICH_PARALLEL_MAX_DEFAULT
pacwich run lint --parallel # default "auto", os.availableParallelism()
pacwich run lint --parallel=2 # Run in parallel with a max of 2 concurrent scripts
pacwich run lint --parallel=50% # 50% of os.availableParallelism()
pacwich run lint --parallel=unbounded # run all in one batch

# add args to the script command
pacwich run lint --args="--my-arg=value"
pacwich run lint --args="--my-arg=<workspaceName>" # use the workspace name in args

# run the script as an inline command from the workspace directory
pacwich run "bun build" --inline
pacwich run "bun build" --inline --inline-name="my-script"
# The default shell is "system" (sh -c on POSIX, cmd /d /s /c on Windows).
# Opt into the Bun shell explicitly when desired:
pacwich run "bun build" --inline --shell=bun

# Use the grouped output style (default when on a TTY)
pacwich run my-script --output-style=grouped

# Set the max preview lines for script output in grouped output style
pacwich run my-script --output-style=grouped --grouped-lines=auto
pacwich run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
pacwich run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
pacwich run my-script --output-style=plain

# Write the full structured run result to a JSON file
pacwich run my-script --json-outfile=./run-result.json

# The script and workspace pattern positional args can be passed as flags instead
pacwich run --script="my-script" --workspace-patterns="my-pattern-*"

# Run a script interactively (with access to stdin, stdout, and stderr)
# Only for one script and workspace. Output isn't captured, so output-related flags aren't available
pacwich run-interactive my-interactive-script my-workspace-name-or-alias
pacwich ri "sudo my-interactive-script" my-workspace-name-or-alias --inline -- my args
# Flag options for positional script and workspace
pacwich ri --script="my-interactive-script" --workspace="my-workspace-name-or-alias"

# List affected workspaces (default: git diff HEAD vs the configured base ref, "main" by default)
pacwich list-affected
pacwich ls-affected # alias

# Compare specific git refs
pacwich ls-affected --base=my-branch-a --head=my-branch-b
pacwich ls-affected -B my-branch-a -H my-branch-b # short forms

# Resolve inputs for a specific script (uses scripts[name].inputs when configured)
pacwich ls-affected --script=build

# Ignore some uncommitted changes (uncommitted included by default)
pacwich ls-affected --ignore-uncommitted # all of: staged, unstaged, untracked
pacwich ls-affected --ignore-untracked
pacwich ls-affected --ignore-unstaged
pacwich ls-affected --ignore-staged

# Skip workspace dep cascade (only direct file/external-dep changes flag a workspace)
pacwich ls-affected --ignore-workspace-deps

# Skip lockfile-based external dep version tracking
pacwich ls-affected --ignore-external-deps

# Bypass git entirely with an explicit list of changed files
# (paths, dirs, globs; '!' to exclude; whitespace-separated)
pacwich ls-affected --files="packages/example/**/*.ts packages/example/my-file.json"
pacwich ls-affected -F "packages/a/**/*.ts !packages/a/**/*.test.ts"

# Per-workspace summary of why each workspace is affected
pacwich ls-affected --explain
pacwich ls-affected -e

# Full per-file changes and dep cascade chain for each affected workspace
pacwich ls-affected --explain --detailed
pacwich ls-affected -e -D

# JSON output (with --explain produces the full result object)
pacwich ls-affected --json --pretty
pacwich ls-affected --explain --json --pretty

# Run a script across affected workspaces (accepts the same affected options
# as ls-affected, plus the same script-execution options as run-script:
# --parallel, --dep-order, --args, --output-style, --inline, etc.)
pacwich run-affected build
pacwich run-affected build --base=my-branch --ignore-uncommitted --dep-order
pacwich run-affected build --files="packages/a/src/**/*.ts" --parallel=2
pacwich run-affected "bun build" --inline --inline-name=build # inline command form

# Detect implicit workspace dependencies (imports of other workspaces'
# package names that aren't declared in the importing workspace's package.json).
# Scans each workspace's inputs (defaultInputs.files, default ["."]);
# only git-trackable files are considered.
pacwich verify
pacwich verify my-workspace-name "tag:my-tag" # limit to a subset via workspace patterns
pacwich verify --strict # exit non-zero on any finding (default warns and exits 0)
pacwich verify -s # short form
pacwich verify --json --pretty # emit the full structured VerifyResult

# Print diagnostic info (runtime, OS, shell, installed package manager versions, etc.)
pacwich doctor
pacwich doctor --json --pretty

### Global Options ###
# Root directory of project (walks up from cwd by default to find the
# nearest ancestor package.json with a "workspaces" field, or, for pnpm,
# a package.json next to a pnpm-workspace.yaml):
pacwich --cwd=/path/to/project ls
pacwich -d /path/to/project ls

# Include root workspace as a normal workspace (default false):
pacwich --include-root ls
pacwich -r ls
pacwich --no-include-root ls # override config/env var setting

# Log level (debug|info|warn|error|silent, default info)
pacwich --log-level=silent ls
pacwich -l silent ls

# Pin the package manager backend explicitly (overrides the project config
# "packageManager" field and the PACWICH_PACKAGE_MANAGER env var).
# "auto" picks from the lockfiles present in the project root.
pacwich --pm=bun ls
pacwich --pm=pnpm ls
pacwich --pm=npm ls
pacwich --pm=auto ls

# Skip evaluating executable config files (pacwich.project.{ts,js},
# pacwich.workspace.{ts,js}) for untrusted contexts. Only jsonc/json
# and package.json configs are read. Also settable via env var
# PACWICH_DISABLE_EXECUTABLE_CONFIGS_DEFAULT=true.
pacwich --disable-executable-configs ls
pacwich --no-disable-executable-configs ls # override config/env var setting
```

<!--End pacwich CLI examples-->
