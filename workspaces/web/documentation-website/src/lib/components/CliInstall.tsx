import { Link } from "@rspress/core/theme-original";
import { type PackageManagerName } from "pacwich";
import { PmTabs } from "./PmTabs";

const PM_COMMANDS: Record<
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
    localCall: "npx pacwich",
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
