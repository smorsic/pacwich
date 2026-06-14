import { Link } from "@rspress/core/theme-original";
import { PmTabs } from "../components/PmTabs";

export interface ApiHeaderProps {
  fullInstallDoc?: boolean;
  divider?: boolean;
}

export const ApiHeader = ({ fullInstallDoc = false }: ApiHeaderProps) => {
  const installDescription =
    "Install the package in your project's devDependencies";
  return (
    <div className="sub-header">
      {fullInstallDoc && (
        <>
          <PmTabs
            title="Install"
            sections={{
              bun: [
                {
                  description: installDescription,
                  code: "bun add -d pacwich",
                },
              ],
              pnpm: [
                {
                  description: installDescription,
                  code: "pnpm add -D pacwich",
                },
              ],
              npm: [
                {
                  description: installDescription,
                  code: "npm install -D pacwich",
                },
              ],
            }}
          />
          <br />
        </>
      )}
      See the <Link href="/intro/getting-started">Getting Started</Link> or{" "}
      <Link href="/concepts/glossary">Glossary</Link> pages for more starting
      info.
      <p className="note">
        <b>Stale workspace data:</b> Note that you need to run your package
        manager's install for <code>pacwich</code> to have current workspace
        data available, e.g. via <code>bun install</code>,{" "}
        <code>pnpm install</code>, or <code>npm install</code>. If you've
        added/removed/updated any workspace package.json, you'll likely need to
        run this again.
      </p>
    </div>
  );
};
