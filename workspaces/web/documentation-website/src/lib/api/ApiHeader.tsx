import { Link } from "rspress/theme";
import { RequiredBunVersion } from "../components/RequiredBunVersion";

export interface ApiHeaderProps {
  divider?: boolean;
}

export const ApiHeader = ({ divider }: ApiHeaderProps) => {
  return (
    <div className="sub-header">
      <p className="note" style={{ marginTop: "1rem" }}>
        Install the package via <code>bun add --dev bun-workspaces</code> to use
        the TypeScript/JavaScript API.
      </p>

      <p className="note" style={{ marginTop: "1rem" }}>
        See the{" "}
        <Link href="/concepts/glossary" style={{ color: "var(--rp-c-link)" }}>
          Glossary
        </Link>{" "}
        for more fundamental concepts.
      </p>
      <h4 style={{ marginTop: "1rem" }}>Ensuring Workspace Data is Current</h4>
      <p className="note" style={{ marginTop: "1rem" }}>
        Note that you need to run <code>bun install</code> in your project for
        <code>bun-workspaces</code> to find your project's workspaces, and you
        likely must run this again after you've updated your workspaces, such as
        changing a name or adding/removing one. This is because{" "}
        <code>bun.lock</code> lists workspaces and is used as the source of
        truth.
      </p>
      <h4 style={{ marginTop: "1rem" }}>TypeScript</h4>
      <p className="note" style={{ marginTop: "1rem" }}>
        Ensure you have <code>@types/bun</code> installed for accurate types.
      </p>
      <RequiredBunVersion className="bun-version sub-header-bun-version" />
      {divider && <hr />}
    </div>
  );
};
