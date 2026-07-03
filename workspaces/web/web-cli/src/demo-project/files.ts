/**
 * The demo monorepo the browser CLI operates on, as a flat list of files with
 * inlined string contents.
 *
 * Contents are inlined (rather than imported from static files) so the exact
 * same array works in three places without a bundler-specific raw-text loader:
 *
 *   1. seeding the in-memory filesystem (memfs) the CLI reads from,
 *   2. the docs site's file-tree view (syntax-highlighted), and
 *   3. the bun test that exercises the same path the browser runs.
 *
 * The project is a small npm monorepo — pacwich's npm adapter discovers the
 * workspaces from `package-lock.json`'s `packages` map, and each workspace's
 * alias/tags come from its `pacwich.workspace.jsonc` (JSONC, because the
 * browser can't load executable `.ts` configs). Edit freely to change what the
 * CLI (and the tree) sees.
 */

export type DemoProjectFile = { relativePath: string; content: string };

const ROOT_PACKAGE_JSON = `{
  "name": "demo-monorepo",
  "private": true,
  "version": "1.0.0",
  "workspaces": ["packages/*"],
  "scripts": {
    "build-all": "pacwich run build --dep-order",
    "type-check-all": "pacwich run type-check"
  }
}
`;

const PACKAGE_LOCK_JSON = `{
  "name": "demo-monorepo",
  "version": "1.0.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "demo-monorepo",
      "version": "1.0.0",
      "workspaces": ["packages/*"]
    },
    "packages/shared": { "name": "shared", "version": "1.0.0" },
    "packages/backend": { "name": "backend", "version": "1.0.0" },
    "packages/frontend": { "name": "frontend", "version": "0.1.0" },
    "node_modules/shared": { "resolved": "packages/shared", "link": true },
    "node_modules/backend": { "resolved": "packages/backend", "link": true },
    "node_modules/frontend": { "resolved": "packages/frontend", "link": true }
  }
}
`;

const SHARED_PACKAGE_JSON = `{
  "name": "shared",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "build": "example-build-command",
    "type-check": "tsc --noEmit"
  }
}
`;

const SHARED_WORKSPACE_CONFIG = `{
  // Config for the \`shared\` workspace. Executable \`.ts\` configs can't load in
  // the browser (no jiti), so the demo uses JSONC — read straight from memfs.
  "alias": "shr",
  "tags": ["library"]
}
`;

const SHARED_INDEX_TS = `export * from "./contract";
`;

const SHARED_CONTRACT_TS = `export type ExampleEndpointRequestBody = {
  data: string;
};

export type ExampleEndpointResponse = {
  message: string;
};

export const EXAMPLE_ENDPOINT_PATH = "/example";
`;

const BACKEND_PACKAGE_JSON = `{
  "name": "backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "example-build-command",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "shared": "workspace:*"
  }
}
`;

const BACKEND_WORKSPACE_CONFIG = `{
  // Config for the \`backend\` workspace.
  "alias": "be",
  "tags": ["application"]
}
`;

const BACKEND_INDEX_TS = `import {
  EXAMPLE_ENDPOINT_PATH,
  type ExampleEndpointRequestBody,
  type ExampleEndpointResponse,
} from "shared";

export const exampleServer = (port: number) => {
  console.log("Starting example server...");
  return Bun.serve({
    port: process.env.PORT ?? port,
    fetch: async (req) => {
      if (req.url === EXAMPLE_ENDPOINT_PATH) {
        const body = (await req.json()) as ExampleEndpointRequestBody;

        return new Response(
          JSON.stringify({
            message: \`Hello, received \${body.data}!\`,
          } satisfies ExampleEndpointResponse),
        );
      }
      return new Response("Not found", { status: 404 });
    },
  });
};
`;

const FRONTEND_PACKAGE_JSON = `{
  "name": "frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "example-build-command",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "shared": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
`;

const FRONTEND_WORKSPACE_CONFIG = `{
  // Config for the \`frontend\` workspace.
  "alias": "fe",
  "tags": ["application"]
}
`;

const FRONTEND_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./index.tsx"></script>
  </body>
</html>
`;

const FRONTEND_INDEX_TSX = `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const FRONTEND_APP_TSX = `import { useCallback, useState } from "react";
import {
  EXAMPLE_ENDPOINT_PATH,
  type ExampleEndpointRequestBody,
  type ExampleEndpointResponse,
} from "shared";

export function App() {
  const [message, setMessage] = useState<string | null>(null);

  const callEndpoint = useCallback(async () => {
    const response = await fetch(EXAMPLE_ENDPOINT_PATH, {
      method: "POST",
      body: JSON.stringify({
        data: "test",
      } satisfies ExampleEndpointRequestBody),
    });
    const data = (await response.json()) as ExampleEndpointResponse;
    setMessage(data.message);
  }, []);

  return (
    <div className="app">
      <button onClick={callEndpoint}>Call Endpoint</button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default App;
`;

export const demoProjectFiles: DemoProjectFile[] = [
  { relativePath: "package.json", content: ROOT_PACKAGE_JSON },
  { relativePath: "package-lock.json", content: PACKAGE_LOCK_JSON },
  { relativePath: "packages/shared/package.json", content: SHARED_PACKAGE_JSON },
  {
    relativePath: "packages/shared/pacwich.workspace.jsonc",
    content: SHARED_WORKSPACE_CONFIG,
  },
  { relativePath: "packages/shared/src/index.ts", content: SHARED_INDEX_TS },
  {
    relativePath: "packages/shared/src/contract.ts",
    content: SHARED_CONTRACT_TS,
  },
  {
    relativePath: "packages/backend/package.json",
    content: BACKEND_PACKAGE_JSON,
  },
  {
    relativePath: "packages/backend/pacwich.workspace.jsonc",
    content: BACKEND_WORKSPACE_CONFIG,
  },
  { relativePath: "packages/backend/src/index.ts", content: BACKEND_INDEX_TS },
  {
    relativePath: "packages/frontend/package.json",
    content: FRONTEND_PACKAGE_JSON,
  },
  {
    relativePath: "packages/frontend/pacwich.workspace.jsonc",
    content: FRONTEND_WORKSPACE_CONFIG,
  },
  {
    relativePath: "packages/frontend/src/index.html",
    content: FRONTEND_INDEX_HTML,
  },
  {
    relativePath: "packages/frontend/src/index.tsx",
    content: FRONTEND_INDEX_TSX,
  },
  { relativePath: "packages/frontend/src/App.tsx", content: FRONTEND_APP_TSX },
];
