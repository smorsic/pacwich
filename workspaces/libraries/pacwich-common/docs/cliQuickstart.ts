export const CLI_QUICKSTART = `
##########
# Global #
##########

# Show usage (you can pass --help to any command)
pacwich --help

# Show version
pacwich --version

# Pass --cwd to any command
pacwich --cwd=/path/to/your/project ls
pacwich --cwd=/path/to/your/project run my-script

# Specify package manager, if you have multiple lockfiles
pacwich --pm=pnpm ls

# Pass --log-level to any command (debug, info, warn, error, or silent)
# A default can also be set with the PACWICH_LOG_LEVEL env var (the flag overrides it)
pacwich --log-level=debug ls

# Suppress specific warning messages (can also be set by project config)
# Warning IDs can be seen in warning log prefixes (full list: https://pacwich.dev/config/warnings)
pacwich --suppress-warnings=MultiplePackageManagerLockfiles ls
pacwich --suppress-warnings=MultiplePackageManagerLockfiles,ParallelExceedsAvailableCpus run lint

####################
# Getting metadata #
####################

# List all workspaces in your project
pacwich list-workspaces

# ls is an alias for list-workspaces
pacwich ls --json --pretty # Output as formatted JSON

# Get info about a workspace
pacwich workspace-info my-workspace
pacwich info my-workspace --json --pretty # info is alias for workspace-info

# Get info about a script, such as the workspaces that have it
pacwich script-info my-script

##########
# Verify #
##########

# Check for issues with your project
# Can be useful as your root package.json "prepare" script
# or as a pre-commit hook
pacwich verify

# Fails if workspaces detected that import/export from each other
# without explicit dependency declared in package.json
pacwich verify --strict

###################
# Running scripts #
###################

# Run the lint script for all workspaces in parallel
# that have it in their package.json "scripts" field
pacwich run lint
pacwich run lint my-workspace # Run for a single workspace
pacwich run lint my-workspace-a my-workspace-b # Run for multiple workspaces
pacwich run lint my-alias-a my-alias-b # Run by alias (set by optional config)

# A workspace's script will wait until
# any workspaces it depends on have completed
pacwich run lint --dep-order
pacwich run lint --dep-order --ignore-dep-failure

# Workspace patterns
pacwich run lint "my-workspace-*" # Run for matching workspace names
pacwich run lint "alias:my-alias-*" "path:my-glob/**/*" "tag:my-tag"
pacwich run lint "re:my-name-regex.*" "path:re:my-path-regex.*"
pacwich run lint "*" "not:path:my-path/*" # Run for all workspaces not in my-path/

pacwich run lint --args="--my-appended-args" # Add args to each script call
pacwich run lint --args="--my-arg=<workspaceName>" # Use the workspace name in args

pacwich run "cat package.json" --inline # Run an inline shell command

# Inline scripts can use the Bun shell if Bun is available,
# which is a cross-platform Bash-like shell
# This can be helpful for multi-OS support
pacwich run "cat package.json" --inline --shell=bun

# Scripts run in parallel by default
pacwich run lint --parallel=auto # Default, based on available logical CPUs
pacwich run lint --parallel=false # Run sequentially
pacwich run lint --parallel=2 # 2 max scripts run concurrently
pacwich run lint --parallel=50% # half of available logical CPUs

# Set the max preview lines for script output
# when "grouped" output style is used (the default on TTY)
pacwich run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
pacwich run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
pacwich run my-script --output-style=plain

# Run an interactive script with full stdio, for user input etc.
# Requires a script and one workspace name or alias
# A script only gets a TTY if the caller is a TTY (i.e. not piped or redirected)
pacwich run-interactive my-interactive-script my-workspace-name-or-alias

# ri is an alias for run-interactive
pacwich ri my-interactive-script my-workspace-name-or-alias

# Silence all output
pacwich --log-level=silent run my-script --output-style=none

#####################
# Affected Features #
#####################

# List affected workspaces based on git diff (main vs. HEAD by default)
pacwich affected list

# Set the git base and head for comparison
pacwich affected list --base=my-branch-a --head=my-branch-b

# See detailed reasons for affected workspaces
pacwich affected list --explain --detailed

# Run a script across the workspaces affected by a change
pacwich affected run my-script
pacwich affected run my-script --base=my-branch-a --head=my-branch-b

# Aliases
pacwich affected ls
pacwich af ls
pacwich af run

##########
# Config #
##########

# Commands for pacwich's optional configuration

# Print project and all workspace configs as JSON
pacwich config debug
pacwich config debug --pretty # pretty print JSON

# Print just the project config as JSON
pacwich config debug --project

# Print a single workspace config as JSON
pacwich config debug --workspace=name-or-alias

# Print workspace configs matching a pattern as JSON
pacwich config debug --workspace-patterns="my-pattern-*"
`.trim();

export const INLINE_SCRIPT_EXAMPLE = `
# Run an inline shell command from the workspace directory
pacwich run "cat package.json'" --inline
`.trim();
