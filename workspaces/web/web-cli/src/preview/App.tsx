import { WebCli } from "../ui";

export const App = () => (
  <div className="preview">
    <header className="preview__header">
      <h1>pacwich web CLI</h1>
      <p>
        The real <code>pacwich</code> CLI, bundled for the browser and reading a
        mock monorepo from an in-memory filesystem. No backend.
      </p>
    </header>
    <WebCli />
  </div>
);
