export const CLI_QUICKSTART = `
# You can add this to .bashrc, .zshrc, or similar.
# You can also invoke "bw" in your root package.json scripts.
alias bw="bunx bun-workspaces"

# List all workspaces in your project
bw list-workspaces

# ls is an alias for list-workspaces
bw ls --json --pretty # Output as formatted JSON

# Get info about a workspace
bw workspace-info my-workspace
bw info my-workspace --json --pretty # info is alias for workspace-info

# Get info about a script, such as the workspaces that have it
bw script-info my-script

# Run the lint script for all workspaces
# that have it in their package.json "scripts" field
bw run-script lint

# run is an alias for run-script
bw run lint my-workspace # Run for a single workspace
bw run lint my-workspace-a my-workspace-b # Run for multiple workspaces
bw run lint my-alias-a my-alias-b # Run by alias (set by optional config)

# A workspace's script will wait until any workspaces it depends on have completed
# Similar to Bun's --filter behavior
bw run lint --dep-order

# Continue running scripts even if a dependency fails
bw run lint --dep-order --ignore-dep-failure

bw run lint "my-workspace-*" # Run for matching workspace names
bw run lint "alias:my-alias-*" "path:my-glob/**/*" "tag:my-tag" # Use matching specifiers
bw run lint "*" "not:path:my-path/*" # Run for all workspaces not in my-path/

bw run lint --args="--my-appended-args" # Add args to each script call
bw run lint --args="--my-arg=<workspaceName>" # Use the workspace name in args

bw run "bun build" --inline # Run an inline command via the Bun shell

# Scripts run in parallel by default
bw run lint --parallel=false # Run in series
bw run lint --parallel=2 # Run in parallel with a max of 2 concurrent scripts
bw run lint --parallel=auto # Default, based on number of available logical CPUs
bw run lint --parallel=50% # Run in parallel with a max of 50% of the "auto" limit

# Use the grouped output style (default when on a TTY)
bw run my-script --output-style=grouped

# Set the max preview lines for script output in grouped output style
bw run my-script --output-style=grouped --grouped-lines=auto
bw run my-script --output-style=grouped --grouped-lines=10

# Use simple script output with workspace prefixes (default when not on a TTY)
bw run my-script --output-style=prefixed

# Use the plain output style (no workspace prefixes)
bw run my-script --output-style=plain

# List affected workspaces based on git diff (main vs. HEAD when not configured)
bw list-affected

# Set the git base and head for comparison
bw list-affected --base=my-branch-a --head=my-branch-b

# See detailed reasons for affected workspaces
bw list-affected --explain --detailed

# Run a script across the workspaces affected by a change
bw run-affected my-script

# Silence all output of the run command
bw --log-level=silent run my-script --output-style=none

# Show usage (you can pass --help to any command)
bw help
bw --help

# Show version
bw --version

# Pass --cwd to any command
bw --cwd=/path/to/your/project ls
bw --cwd=/path/to/your/project run my-script

# Pass --log-level to any command (debug, info, warn, error, or silent)
bw --log-level=debug ls
`.trim();

export const INLINE_SCRIPT_EXAMPLE = `
# Run an inline command from the workspace directory
bw run "bun run build" --inline
`.trim();
