### CLI examples:

```bash
alias bw="bunx bun-workspaces"

bw list-workspaces # human-readable output
bw ls --json --pretty # ls is alias for list-workspaces
bw ls "name:my-workspace-*" "alias:my-alias-*" "path:packages/**/*" # accepts workspace patterns

# info includes the name, aliases, path, etc.
bw workspace-info my-workspace
bw info my-workspace --json --pretty # info is alias for workspace-info

# info includes the script name and workspaces that have it in their package.json "scripts" field
bw script-info my-script --json --pretty

# run the package.json "lint" script for all workspaces that have it
bw run-script lint

# run is alias for run-script
# run the package.json "lint" script for workspaces using matching specifiers
bw run lint my-workspace-name "alias:my-alias-pattern-*" "path:my-glob/**/*" # accepts workspace patterns

# A workspace's script will wait until any workspaces it depends on have completed
# Similar to Bun's --filter behavior
bw run lint --dep-order

# Continue running scripts even if a dependency fails
bw run lint --dep-order --ignore-dep-failure

# special root workspace selector (works even if root workspace is not included)
bw run lint @root

# Scripts run in parallel by default
bw run lint --parallel=false # Run in series

# Default can be overridden by config or env var BW_PARALLEL_MAX_DEFAULT
bw run lint --parallel # default "auto", os.availableParallelism()
bw run lint --parallel=2 # Run in parallel with a max of 2 concurrent scripts
bw run lint --parallel=50% # 50% of os.availableParallelism()
bw run lint --parallel=unbounded # run all in one batch

# add args to the script command
bw run lint --args="--my-arg=value"
bw run lint --args="--my-arg=<workspaceName>" # use the workspace name in args

# run the script as an inline command from the workspace directory
bw run "bun build" --inline
bw run "bun build" --inline --inline-name="my-script"
bw run "bun build" --inline --shell=system # use the system shell

# Use the grouped output style (default when on a TTY)
bw run my-script --output-style=grouped

# Set the max preview lines for script output in grouped output style
bw run my-script --output-style=grouped --grouped-lines=auto
bw run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
bw run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
bw run my-script --output-style=plain

# List affected workspaces (default: git diff HEAD vs the configured base ref, "main" by default)
bw list-affected
bw ls-affected # alias

# Compare specific git refs
bw ls-affected --base=my-branch-a --head=my-branch-b
bw ls-affected -B my-branch-a -H my-branch-b # short forms

# Resolve inputs for a specific script (uses scripts[name].inputs when configured)
bw ls-affected --script=build

# Ignore some uncommitted changes (uncommitted included by default)
bw ls-affected --ignore-uncommitted # all of: staged, unstaged, untracked
bw ls-affected --ignore-untracked
bw ls-affected --ignore-unstaged
bw ls-affected --ignore-staged

# Skip workspace dep cascade (only direct file/external-dep changes flag a workspace)
bw ls-affected --ignore-workspace-deps

# Skip lockfile-based external dep version tracking
bw ls-affected --ignore-external-deps

# Bypass git entirely with an explicit list of changed files
# (paths, dirs, globs; '!' to exclude; whitespace-separated)
bw ls-affected --files="packages/example/**/*.ts packages/example/my-file.json"
bw ls-affected -F "packages/a/**/*.ts !packages/a/**/*.test.ts"

# Per-workspace summary of why each workspace is affected
bw ls-affected --explain
bw ls-affected -e

# Full per-file changes and dep cascade chain for each affected workspace
bw ls-affected --explain --detailed
bw ls-affected -e -D

# JSON output (with --explain produces the full result object)
bw ls-affected --json --pretty
bw ls-affected --explain --json --pretty

# Run a script across affected workspaces (accepts the same affected options
# as ls-affected, plus the same script-execution options as run-script:
# --parallel, --dep-order, --args, --output-style, --inline, etc.)
bw run-affected build
bw run-affected build --base=my-branch --ignore-uncommitted --dep-order
bw run-affected build --files="packages/a/src/**/*.ts" --parallel=2
bw run-affected "bun build" --inline --inline-name=build # inline command form

### Global Options ###
# Root directory of project:
bw --cwd=/path/to/project ls
bw -d /path/to/project ls

# Include root workspace as a normal workspace (default false):
bw --include-root ls
bw -r ls
bw --no-include-root ls # override config/env var setting

# Log level (debug|info|warn|error|silent, default info)
bw --log-level=silent ls
bw -l silent ls
```
