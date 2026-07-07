import {
  type ResolvedProjectConfig,
  getUserEnvVarName,
  type UserEnvVarName,
} from "@pacwich/common/config";
import { Link } from "@rspress/core/theme-original";
import { type ReactNode } from "react";

type DefaultsKey = keyof Pick<ResolvedProjectConfig, "defaults">;

type ProjectConfigDefaultsPrefix = `config.${DefaultsKey}`;

export const CONFIG_DEFAULTS_KEY: ProjectConfigDefaultsPrefix =
  "config.defaults";

export const ENV_VARS_METADATA: Record<
  UserEnvVarName,
  {
    envVarName: string;
    projectConfigDefaultsKey?: `${ProjectConfigDefaultsPrefix}.${keyof ResolvedProjectConfig["defaults"]}`;
    description: ReactNode;
  }
> = {
  packageManager: {
    envVarName: getUserEnvVarName("packageManager"),
    description: (
      <span>
        The package manager to use. This overrides config and environment
        variable settings.
      </span>
    ),
  },
  cliScriptOutputStyleDefault: {
    envVarName: getUserEnvVarName("cliScriptOutputStyleDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.cliScriptOutputStyle`,
    description: (
      <span>
        The default output style for running scripts via the CLI, when no value
        is provided to the{" "}
        <Link href="/cli/commands#run-script" className="inline-link">
          CLI
        </Link>{" "}
        arguments. The "grouped" output is only available on a TTY and otherwise
        falls back to "prefixed". Otherwise "plain" and "none" are accepted.
      </span>
    ),
  },
  parallelMaxDefault: {
    envVarName: getUserEnvVarName("parallelMaxDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.parallelMax`,
    description: (
      <span>
        The default{" "}
        <Link
          href="/concepts/parallel-scripts#parallel-max-value"
          className="inline-link"
        >
          parallel max
        </Link>{" "}
        for running scripts, when no value is provided to the{" "}
        <Link href="/cli/commands#run-script" className="inline-link">
          CLI
        </Link>{" "}
        or{" "}
        <Link
          href="/api/reference#runscriptacrossworkspaces"
          className="inline-link"
        >
          API
        </Link>{" "}
        arguments.
      </span>
    ),
  },
  scriptShellDefault: {
    envVarName: getUserEnvVarName("scriptShellDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.shell`,
    description: (
      <span>
        The default shell for running{" "}
        <Link href="/concepts/inline-scripts" className="inline-link">
          inline scripts
        </Link>
        , when no value is provided to the{" "}
        <Link href="/cli/commands#run-script" className="inline-link">
          CLI
        </Link>{" "}
        or{" "}
        <Link
          href="/api/reference#runscriptacrossworkspaces"
          className="inline-link"
        >
          API
        </Link>{" "}
        arguments.
      </span>
    ),
  },
  includeRootWorkspaceDefault: {
    envVarName: getUserEnvVarName("includeRootWorkspaceDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.includeRootWorkspace`,
    description: (
      <span>
        Whether to include the{" "}
        <Link href="/concepts/root-workspace" className="inline-link">
          root workspace
        </Link>{" "}
        as a normal workspace.
      </span>
    ),
  },
  affectedBaseRefDefault: {
    envVarName: getUserEnvVarName("affectedBaseRefDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.affectedBaseRef`,
    description: (
      <span>
        The default git base ref for affected workspace resolution. This is{" "}
        <code>main</code> when not overridden.
      </span>
    ),
  },
  disableExecutableConfigsDefault: {
    envVarName: getUserEnvVarName("disableExecutableConfigsDefault"),
    description: (
      <span>
        Whether to disable loading executable configs (TS/JS), mainly for
        untrusted contexts. This is <code>false</code> when not overridden.
      </span>
    ),
  },
  outputBufferBytesDefault: {
    envVarName: getUserEnvVarName("outputBufferBytesDefault"),
    projectConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.maxOutputBufferBytes`,
    description: (
      <span>
        The default maximum bytes of script output buffered in memory per stream
        (stdout/stderr) when running scripts. Accepts a byte count, a human size
        like <code>16MB</code>, or <code>unbounded</code> to disable the cap.
        This is <code>16MB</code> when not overridden.
      </span>
    ),
  },
} as const;
