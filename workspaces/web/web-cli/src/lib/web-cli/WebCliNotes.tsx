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
          Inline scripts and changing the working directory via{" "}
          <code>--cwd</code> aren't supported here.
        </li>
        <li>
          Git-based affected diffs, which <code>affected list</code>/
          <code>affected run</code> use by default (with or without{" "}
          <code>--base</code>/<code>--head</code>), aren't supported here — pass{" "}
          <code>--files</code> instead to provide a list of changed files
          manually.
        </li>
      </ul>
    </div>
  );
};
