import { Link } from "rspress/theme";
import { RequiredBunVersion } from "../components/RequiredBunVersion";

export const CliHeader = () => {
  return (
    <div className="sub-header">
      <p className="note" style={{ marginTop: "1rem" }}>
        Try the{" "}
        <Link className="inline-link" href="/web-cli">
          Web CLI demo
        </Link>{" "}
        right here in your browser!
      </p>
      <h4 style={{ marginTop: "1rem" }}>Running the CLI</h4>
      <p className="note" style={{ marginTop: "1rem" }}>
        Run the CLI via <code>bunx bun-workspaces</code> or alias it to{" "}
        <code>bw</code>, such as via <code>alias bw="bunx bun-workspaces"</code>
        , which can be placed in your shell configuration file, like{" "}
        <code>.bashrc</code>, <code>.zshrc</code>, or similar.
      </p>
      <p className="note" style={{ marginTop: "1rem" }}>
        You can also invoke <code>bw</code> in your root{" "}
        <code>package.json</code> scripts directly even without an alias set up.
      </p>
      <p className="note" style={{ marginTop: "1rem" }}>
        Examples use an implied <code>bw</code> alias for brevity instead of{" "}
        <code>bunx bun-workspaces</code>.
      </p>
      <p className="note" style={{ marginTop: "1rem" }}>
        Using <code>bunx</code> is preferred over a global install, because it
        ensures version consistency within projects that have installed it.
      </p>
      <h4 style={{ marginTop: "1rem" }}>Stale Workspace Data</h4>
      <p className="note" style={{ marginTop: "1rem" }}>
        Note that you need to run <code>bun install</code> in your project for
        <code>bun-workspaces</code> to find your project's workspaces, and you
        likely must run this again after you've updated your workspaces, such as
        changing a name or adding/removing one. This is because{" "}
        <code>bun.lock</code> lists workspaces and is used as the source of
        truth.
      </p>
      <RequiredBunVersion className="bun-version sub-header-bun-version" />
    </div>
  );
};
