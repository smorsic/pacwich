import path from "path";
import rootPackageJson from "../../../package.json";
import { formatPnpmWorkspaceYaml } from "../util";

if (import.meta.main) {
  const content = formatPnpmWorkspaceYaml({
    packages: rootPackageJson.workspaces.packages.concat(
      "!workspaces/sandboxes/**/*",
    ),
    catalog: rootPackageJson.workspaces.catalog,
    catalogs: rootPackageJson.workspaces.catalogs,
    header:
      "# pnpm is used at time of writing only to create lockfile due to lack of Bun dependabot support",
  });

  await Bun.write(
    path.join(__dirname, "../../..", "pnpm-workspace.yaml"),
    content,
  );
}
