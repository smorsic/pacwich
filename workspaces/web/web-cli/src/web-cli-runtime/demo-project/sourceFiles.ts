export const FRONTEND_UTILS_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import { useEffect, useState } from "react";

export const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
};
`,
};

export const BACKEND_UTILS_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import type { NextFunction, Request, Response } from "express";

export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  console.log(\`\${req.method} \${req.path}\`);
  next();
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: "Not found" });
};
`,
};

export const SHARED_UTILS_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;

export const isValidUser = (value: unknown): value is User =>
  UserSchema.safeParse(value).success;
`,
};

export const SHARED_A_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import { UserSchema } from "@demo/shared-utils";
import { z } from "zod";

export const AppBConfigSchema = z.object({
  featureFlags: z.object({
    betaSearch: z.boolean(),
  }),
});

export type AppBConfig = z.infer<typeof AppBConfigSchema>;

export const DEFAULT_APP_B_CONFIG: AppBConfig = {
  featureFlags: { betaSearch: false },
};

export { UserSchema };
`,
};

export const BACKEND_A_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import { notFoundHandler, requestLogger } from "@demo/backend-utils";
import { UserSchema } from "@demo/shared-utils";
import express from "express";

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.post("/users", (req, res) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  res.status(201).json(result.data);
});

app.use(notFoundHandler);
`,
};

export const BACKEND_B_SOURCE_FILES: Record<string, string> = {
  "src/index.ts": `import { notFoundHandler, requestLogger } from "@demo/backend-utils";
import { DEFAULT_APP_B_CONFIG } from "@demo/shared-a";
import { UserSchema } from "@demo/shared-utils";
import express from "express";

export const app = express();

app.use(express.json());
app.use(requestLogger);

app.get("/config", (_req, res) => {
  res.json(DEFAULT_APP_B_CONFIG);
});

app.post("/users", (req, res) => {
  const result = UserSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  res.status(201).json(result.data);
});

app.use(notFoundHandler);
`,
};

const FRONTEND_RSBUILD_CONFIG = `import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
  plugins: [pluginReact()],
});
`;

const frontendIndexHtml = (title: string): string => `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const FRONTEND_INDEX_TSX = `import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
`;

export const FRONTEND_A_SOURCE_FILES: Record<string, string> = {
  "rsbuild.config.ts": FRONTEND_RSBUILD_CONFIG,
  "index.html": frontendIndexHtml("My App A"),
  "src/index.tsx": FRONTEND_INDEX_TSX,
  "src/App.tsx": `import { useDebouncedValue } from "@demo/frontend-utils";
import { isValidUser } from "@demo/shared-utils";
import { useState } from "react";

export const App = () => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  return (
    <main>
      <h1>My App A</h1>
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      <p>Searching for: {debouncedQuery}</p>
      <p>Valid empty user: {String(isValidUser({}))}</p>
    </main>
  );
};
`,
};

export const FRONTEND_B_SOURCE_FILES: Record<string, string> = {
  "rsbuild.config.ts": FRONTEND_RSBUILD_CONFIG,
  "index.html": frontendIndexHtml("My App B"),
  "src/index.tsx": FRONTEND_INDEX_TSX,
  "src/App.tsx": `import { useDebouncedValue } from "@demo/frontend-utils";
import { DEFAULT_APP_B_CONFIG } from "@demo/shared-a";
import { isValidUser } from "@demo/shared-utils";
import { useState } from "react";

export const App = () => {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  return (
    <main>
      <h1>My App B</h1>
      {DEFAULT_APP_B_CONFIG.featureFlags.betaSearch && (
        <p>Beta search enabled</p>
      )}
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
      <p>Searching for: {debouncedQuery}</p>
      <p>Valid empty user: {String(isValidUser({}))}</p>
    </main>
  );
};
`,
};
