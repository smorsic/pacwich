export const GLOSSARY_FILE_TREE = `
my-project/
├── package.json
└── packages/
    ├── my-workspace-a/
    │   └── package.json
    └── my-workspace-b/
        └── package.json
`.trim();

export const GLOSSARY_ROOT_PACKAGE_JSON = `
{
  "name": "my-project",
  "workspaces": [
    "packages/*"
  ]
}
`.trim();

export const GLOSSARY_WORKSPACE_A_PACKAGE_JSON = `
{
  "name": "my-workspace-a",
  "scripts": {
    "my-script": "echo 'My script for workspace A'"
  }
}
`.trim();

export const GLOSSARY_WORKSPACE_B_PACKAGE_JSON = `
{
  "name": "my-workspace-b",
  "scripts": {
    "my-script": "echo 'My script for workspace B'"
  }
}`.trim();

export const PNPM_WORKSPACE_YAML = `
# pnpm-workspace.yaml
packages:
  - 'packages/*'
`.trim();
