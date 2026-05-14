import {
  type ResolvedRootConfig,
  getUserEnvVarName,
  type UserEnvVarName,
} from "bw-common/config";
import { type ReactNode } from "react";
import { Link } from "rspress/theme";

type DefaultsKey = keyof Pick<ResolvedRootConfig, "defaults">;

type RootConfigDefaultsPrefix = `config.${DefaultsKey}`;

export const CONFIG_DEFAULTS_KEY: RootConfigDefaultsPrefix = "config.defaults";

export const ENV_VARS_METADATA: Record<
  UserEnvVarName,
  {
    envVarName: string;
    rootConfigDefaultsKey?: `${RootConfigDefaultsPrefix}.${keyof ResolvedRootConfig["defaults"]}`;
    description: ReactNode;
  }
> = {
  parallelMaxDefault: {
    envVarName: getUserEnvVarName("parallelMaxDefault"),
    rootConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.parallelMax`,
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
    rootConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.shell`,
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
    rootConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.includeRootWorkspace`,
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
    rootConfigDefaultsKey: `${CONFIG_DEFAULTS_KEY}.affectedBaseRef`,
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
        Whether to disable executable configs (TS/JS) for the CLI. This is{" "}
        <code>false</code> when not overridden.
      </span>
    ),
  },
} as const;
