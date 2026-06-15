import { Link } from "@rspress/core/theme-original";
import { type PackageManagerName } from "pacwich";
import { PmTabs } from "../components/PmTabs";

export const PM_COMMANDS: Record<
  PackageManagerName,
  {
    globalInstall: string;
    localInstall: string;
    localCall: string;
  }
> = {
  npm: {
    globalInstall: "npm install -g pacwich",
    localInstall: "npm install -D pacwich",
    localCall: "npx pacwich",
  },
  pnpm: {
    globalInstall: "pnpm add -g pacwich",
    localInstall: "pnpm add -D pacwich",
    localCall: "pnpm exec pacwich",
  },
  bun: {
    globalInstall: "bun add -g pacwich",
    localInstall: "bun add -d pacwich",
    localCall: "bunx pacwich",
  },
};

export interface CliInstallProps {
  docLinks?: boolean;
}

export const CliInstall = ({ docLinks }: CliInstallProps) => {
  const globalInstallDescription = (
    <>
      <b>CLI global install:</b> Your <code>pacwich</code> command will still
      resolve to a local install when available.
    </>
  );

  const localInstallDescription = (
    <>
      <b>Local install:</b> Note the <code>pacwich</code> command works in your
      package.json scripts even without a global install.
    </>
  );

  const createGlobalInstallCode = (pm: PackageManagerName) => {
    return PM_COMMANDS[pm].globalInstall;
  };

  const createLocalInstallCode = (pm: PackageManagerName) => {
    return `# Install to your devDependencies
${PM_COMMANDS[pm].localInstall}

# Call the local install
${PM_COMMANDS[pm].localCall}
`;
  };

  return (
    <PmTabs
      links={
        docLinks && (
          <div className="pm-tabs-links">
            <Link href="/cli">CLI Docs</Link>
            <Link href="/api">API Docs</Link>
          </div>
        )
      }
      title="Install"
      sections={{
        npm: [
          {
            description: globalInstallDescription,
            code: createGlobalInstallCode("npm"),
          },
          {
            description: localInstallDescription,
            code: createLocalInstallCode("npm"),
          },
        ],
        pnpm: [
          {
            description: globalInstallDescription,
            code: createGlobalInstallCode("pnpm"),
          },
          {
            description: localInstallDescription,
            code: createLocalInstallCode("pnpm"),
          },
        ],
        bun: [
          {
            description: globalInstallDescription,
            code: createGlobalInstallCode("bun"),
          },
          {
            description: localInstallDescription,
            code: createLocalInstallCode("bun"),
          },
        ],
      }}
    />
  );
};

/** Separate from CliInstall to provide hidden text used for markdown generation in place of dynamic display component */
export const CliInstallAlt = () => {
  return (
    <div
      style={{
        visibility: "hidden",
        position: "absolute",
        left: "-9999px",
      }}
    >
      <div>
        Alt install instructions for .md page in place of {`<CliInstall />`}{" "}
        above:
      </div>
      <div>Installing:</div>
      {Object.entries(PM_COMMANDS).map(([pm, commands]) => (
        <div key={`cli-install-${pm}`}>
          <h3>{pm}:</h3>
          <div>
            Global install: <code>{commands.globalInstall}</code>
            <br />
            Local install: <code>{commands.localInstall}</code>
            <br />
            Local/one-off execution: <code>{commands.localCall}</code>
          </div>
        </div>
      ))}
      <div>
        Note that the global install will delegate to the local install when
        available.
      </div>
    </div>
  );
};
