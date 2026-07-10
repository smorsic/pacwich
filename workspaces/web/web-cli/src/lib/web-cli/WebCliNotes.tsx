export const WebCliNotes = () => {
  return (
    <div className="web-cli-notes">
      <h6 className="web-cli-notes-title">Notes:</h6>
      <ul>
        <li>
          See the full CLI documentation on the{" "}
          <a
            href="https://pacwich.dev/cli"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs site
          </a>
          .
        </li>
        <li>
          This isn't a full bash shell, so shell operations beyond providing
          args to <code>pacwich</code> aren't supported.
        </li>
        <li>
          Inline scripts, the <code>doctor</code> command, changing the working
          directory via <code>--cwd</code>, and git-based affected diffs (
          <code>--base</code>/<code>--head</code>) aren't supported here — use{" "}
          <code>--files</code> instead for affected resolution.
        </li>
      </ul>
    </div>
  );
};
