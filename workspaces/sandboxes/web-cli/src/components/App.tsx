import { WebCliTerminal } from "./WebCliTerminal";

export const App = () => (
  <div className="app">
    <header className="app__header">
      <h1>pacwich web-cli</h1>
      <p>
        The real <code>pacwich</code> CLI, bundled for the browser and reading a
        mock monorepo from an in-memory filesystem. No backend.
      </p>
    </header>
    <WebCliTerminal />
  </div>
);
