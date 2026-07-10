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
          <code>pacwich</code> is an alias for <code>bunx pacwich</code>.
          However, you can use <code>pacwich</code> in your root{" "}
          <code>package.json</code> scripts without setting up a shell alias
          when <code>pacwich</code> is installed.
        </li>
        <li>
          This isn't a full bash shell, so shell operations beyond providing
          args to <code>pacwich</code> aren't supported.
        </li>
        <li>
          Inline scripts, the <code>doctor</code> command, appending args to
          scripts, and changing the working directory via <code>--cwd</code>{" "}
          aren't supported here.
        </li>
      </ul>
    </div>
  );
};
