import { Link } from "@/theme";
import { PmTabs } from "../components/PmTabs";

export const WorkspaceDependencyExample = () => {
  return (
    <PmTabs
      sections={{
        bun: [
          {
            description: (
              <>
                Root <code>package.json</code>
              </>
            ),
            code: `
{
  "name": "my-project-root",
  "workspaces": [
    "packages/*"
  ]
}
            `,
            language: "json",
          },
          {
            description: (
              <>
                <code>packages/workspace-a/package.json</code>, where
                <code>workspace-a</code> exports some code from its{" "}
                <code>index.ts</code>
              </>
            ),
            code: `
{
  "name": "workspace-a",
  "type": "module",
  "main": "index.ts"
}
            `,
            language: "json",
          },
          {
            description: (
              <>
                <code>packages/workspace-b/package.json</code>: JS/TS files in
                this workspace can import from <code>"workspace-a"</code>.
              </>
            ),
            code: `
{
  "name": "workspace-b",
  "dependencies": {
    "workspace-a": "workspace:*"
  }
}
            `,
            language: "json",
          },
        ],
        pnpm: [
          {
            description: (
              <>
                Root <code>pnpm-workspace.yaml</code>
              </>
            ),
            code: `
packages:
  - "packages/*"
            `,
            language: "yaml",
          },

          {
            description: (
              <>
                <code>packages/workspace-a/package.json</code>, where
                <code>workspace-a</code> exports some code from its{" "}
                <code>index.ts</code>.
              </>
            ),
            code: `
{
  "name": "workspace-a",
  "type": "module",
  "main": "index.ts"
}
            `,
            language: "json",
          },
          {
            description: (
              <>
                <code>packages/workspace-b/package.json</code>: JS/TS files in
                this workspace can import from <code>"workspace-a"</code>.
              </>
            ),
            code: `
{
  "name": "workspace-b",
  "type": "module",
  "dependencies": {
    "workspace-a": "workspace:*"
  }
}
            `,
            language: "json",
          },
        ],
        npm: [
          {
            description: (
              <>
                Root <code>package.json</code>
              </>
            ),
            code: `
{
  "name": "my-project-root",
  "workspaces": [
    "packages/*"
  ]
}
            `,
            language: "json",
          },
          {
            description: (
              <>
                <code>packages/workspace-a/package.json</code>, where
                <code>workspace-a</code> exports some code from its{" "}
                <code>index.ts</code>
              </>
            ),
            code: `
{
  "name": "workspace-a",
  "type": "module",
  "main": "index.ts"
}
            `,
            language: "json",
          },
          {
            description: (
              <>
                <code>packages/workspace-b/package.json</code>: JS/TS files in
                this workspace can import from <code>"workspace-a"</code>.{" "}
                <br />
                <br />
                When using npm, placing <code>{`{ "workspace-a": "*" }`}</code>{" "}
                in dependencies is not necessary, but this is how{" "}
                <code>pacwich</code> determines dependencies. Use the{" "}
                <Link href="/concepts/verify">
                  <code>verify</code>
                </Link>{" "}
                feature to detect dependencies not declared in workspace's
                package.json.
              </>
            ),
            code: `
{
  "name": "workspace-b",
  "type": "module",
  "dependencies": {
    "workspace-a": "*"
  }
}
            `,
            language: "json",
          },
        ],
      }}
    />
  );
};
