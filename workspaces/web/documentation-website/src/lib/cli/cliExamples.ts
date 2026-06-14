import { ENV_VARS_METADATA } from "../config/envVars";
export { CLI_QUICKSTART } from "@pacwich/common/docs";

export const CLI_PARALLEL_SCRIPTS_EXAMPLE = `
# Scripts run in parallel by default
# This is the same as passing --parallel=default
pacwich run my-script

# Normally "auto" or the value set by configuration 
# or environment variable (see Default Limit above)
pacwich run my-script --parallel=default

# Explicitly run in parallel, limiting the max 
# concurrent scripts to the available logical CPUs.
#
# This is the default unless the project ${ENV_VARS_METADATA.parallelMaxDefault.projectConfigDefaultsKey}
# or process.env.${ENV_VARS_METADATA.parallelMaxDefault.envVarName} is set to a different value.
pacwich run my-script --parallel=auto

# Run in series
pacwich run my-script --parallel=false

# Run in parallel with a max of the available logical CPUs
pacwich run my-script --parallel=auto

# Run in parallel with a max of 2 concurrent scripts
pacwich run my-script --parallel=2

# Run in parallel with a max of 50% of the available logical CPUs
pacwich run my-script --parallel=50%

# Run every script in parallel (use with caution)
pacwich run my-script --parallel=unbounded 
`.trim();

export const CLI_INLINE_SHELL_EXAMPLE = `
# This will use the system shell, 
# unless the project ${ENV_VARS_METADATA.scriptShellDefault.projectConfigDefaultsKey}
# or process.env.${ENV_VARS_METADATA.scriptShellDefault.envVarName} is set to "bun"
pacwich run "echo 'hello'" --inline

# Same as the above command
pacwich run "echo 'hello'" --inline --shell=default

# Explicitly run the Bun shell
pacwich run "echo 'hello'" --inline --shell=bun

# Explicitly run the system shell
pacwich run "echo 'hello'" --inline --shell=system
`.trim();

export const CLI_INLINE_NAME_EXAMPLE = `
# Pass a name for an inline script
pacwich run "echo 'my script: <scriptName>'" --inline --inline-name=my-inline-script
`.trim();

export const CLI_RUN_SCRIPT_ROOT_SELECTOR_EXAMPLE = `
# Run the lint script from the root package.json
pacwich run lint @root

# Get workspace information for the root workspace
pacwich workspace-info @root
`.trim();
