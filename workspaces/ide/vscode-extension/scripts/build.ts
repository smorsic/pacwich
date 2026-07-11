import { copyFileSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { context } from "esbuild";

const ROOT = path.resolve(__dirname, "..");
const DIST_PATH = path.resolve(ROOT, "dist");
const PROJECT_ROOT =
  process.env.PACWICH_PROJECT_PATH ?? path.resolve(ROOT, "../../..");

const isWatch = process.argv.includes("--watch");

// The extension is developed as workspace "@pacwich/vscode-extension" for
// bun/pacwich workspace resolution, but vsce/ovsx reject a scoped `name`
// (it becomes the marketplace id `<publisher>.<name>`). dist/package.json
// is the one actually packaged/published, so it gets the unscoped name.
const buildOutputPackageJson = () => {
  const {
    displayName,
    description,
    version,
    publisher,
    license,
    homepage,
    repository,
    engines,
    categories,
    keywords,
    activationEvents,
    contributes,
  } = JSON.parse(readFileSync(path.resolve(ROOT, "package.json")).toString());

  return {
    name: "pacwich",
    displayName,
    description,
    version,
    publisher,
    license,
    homepage,
    repository,
    engines,
    categories,
    keywords,
    main: "./extension.js",
    activationEvents,
    contributes,
  };
};

export const runBuild = async () => {
  const buildContext = await context({
    entryPoints: [path.resolve(ROOT, "src/extension.ts")],
    bundle: true,
    outfile: path.resolve(DIST_PATH, "extension.js"),
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node22",
    sourcemap: true,
    minify: !isWatch,
  });

  if (isWatch) {
    await buildContext.watch();
    return;
  }

  await buildContext.rebuild();
  await buildContext.dispose();

  writeFileSync(
    path.resolve(DIST_PATH, "package.json"),
    JSON.stringify(buildOutputPackageJson(), null, 2) + "\n",
  );
  copyFileSync(
    path.resolve(ROOT, "README.md"),
    path.resolve(DIST_PATH, "README.md"),
  );
  copyFileSync(
    path.resolve(ROOT, "CHANGELOG.md"),
    path.resolve(DIST_PATH, "CHANGELOG.md"),
  );
  copyFileSync(
    path.resolve(PROJECT_ROOT, "LICENSE.md"),
    path.resolve(DIST_PATH, "LICENSE.md"),
  );
};

if (import.meta.main) {
  await runBuild();
}
