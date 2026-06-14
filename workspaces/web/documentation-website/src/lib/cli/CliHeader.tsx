import { Link } from "@/theme";
import { CliInstall } from "../components/CliInstall";

export interface CliHeaderProps {
  fullInstallDoc?: boolean;
}

export const CliHeader = ({ fullInstallDoc = false }: CliHeaderProps) => {
  return (
    <div className="sub-header">
      {fullInstallDoc && (
        <>
          <CliInstall />
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
