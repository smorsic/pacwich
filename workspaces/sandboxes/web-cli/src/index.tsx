import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Env shims first (self-install on import), before anything CLI-related.
import "./cli/bufferShim";
import "./cli/pathShim";
import { installProcessShim } from "./cli/processShim";
import { App } from "./components/App";
import "./index.css";

// Install the browser `process` shim before any CLI module is imported/run.
installProcessShim();

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
