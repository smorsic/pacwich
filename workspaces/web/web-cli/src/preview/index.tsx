import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Shared app theme tokens, then the standalone `--rp-*` fallbacks + layout.
import "@pacwich/web-common/theme.css";
import "./preview.css";

// The preview runs a dark terminal; the shared theme keys its dark values on
// `.dark` (the same class the docs site toggles on <html>).
document.documentElement.classList.add("dark");

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
