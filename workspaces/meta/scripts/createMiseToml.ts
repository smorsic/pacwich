import { getToolDevLockVersion } from "@pacwich/common";

if (import.meta.main) {
  const root = process.env.PACWICH_PROJECT_PATH || process.cwd();

  Bun.write(
    `${root}/mise.toml`,
    `
[tools]
node = '${getToolDevLockVersion("node")}'
bun = '${getToolDevLockVersion("bun")}'
pnpm = '${getToolDevLockVersion("pnpm")}'

[env]
# Allow pacwich global install to work within this repo
PACWICH_DISABLE_LOCAL_DELEGATION = true
`.trim() + "\n",
  );
}
