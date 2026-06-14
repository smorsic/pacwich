import {
  readFileSync,
  writeFileSync,
  rmSync,
  renameSync,
  copyFileSync,
  readdirSync,
  mkdirSync,
  cpSync,
  chmodSync,
  symlinkSync,
} from "fs";
import path from "path";
import { getToolEndUserVersion } from "@pacwich/common";
import { createScriptLogger } from "@pacwich/meta/util";
import { createRslib, mergeRslibConfig, type RslibConfig } from "@rslib/core";
import { $ } from "bun";
import { generateDtsBundle } from "dts-bundle-generator";
import { createFileSystemProject } from "pacwich";

import rsLibConfigRaw, { IS_TEST_BUILD, DIST_PATH } from "../rslib.config.ts";

const PACKAGE_JSON_PATH = path.resolve(__dirname, "../package.json");

const ROOT_PACKAGE_JSON_PATH = path.resolve(
  process.env.PACWICH_PROJECT_PATH as string,
  "package.json",
);

const logger = createScriptLogger({ name: "Build" });

const processPackageJson = () => {
  const {
    name,
    version,
    description,
    exports,
    homepage,
    repository,
    bin,
    type,
    dependencies,
    keywords,
    scripts,
  } = JSON.parse(readFileSync(path.resolve(PACKAGE_JSON_PATH)).toString());

  const { license } = JSON.parse(
    readFileSync(ROOT_PACKAGE_JSON_PATH).toString(),
  );

  return {
    dependencies,
    inputPackageJson: {
      name,
      version,
      description,
      type,
      exports,
      homepage,
      repository,
      bin,
      dependencies,
      keywords,
      scripts,
    },
    outputPackageJson: {
      name,
      version,
      description,
      type,
      license,
      exports: Object.fromEntries(
        Object.entries(exports).map(
          ([key, value]) =>
            [
              key,
              {
                types: (value as string).replace(".ts", ".d.ts"),
                default: (value as string).replace(".ts", ".js"),
              },
            ] as const,
        ),
      ),
      types: exports["."].replace(".ts", ".d.ts"),
      homepage,
      repository,
      keywords,
      engines: {
        bun: getToolEndUserVersion("bun"),
        node: getToolEndUserVersion("node"),
      },
      bin: {
        pacwich: bin["pacwich"].replace("Dev", ""),
      },
      ...(IS_TEST_BUILD ? { scripts } : {}),
    },
  };
};

export const runBuild = async () => {
  await $`bun run ajv`;
  await $`bun run create-public-agent-docs`;

  const { outputPackageJson, inputPackageJson, dependencies } =
    processPackageJson();

  logger.debug(`inputPackageJson: ${JSON.stringify(inputPackageJson)}`);
  logger.debug(`outputPackageJson: ${JSON.stringify(outputPackageJson)}`);
  logger.debug(`dependencies: ${JSON.stringify(dependencies)}`);

  logger.info("Creating rslib build...");

  const project = createFileSystemProject({
    rootDirectory: process.env.PACWICH_PROJECT_PATH as string,
  });

  const bundledDependencies = Object.entries(dependencies).reduce(
    (acc, [key, value]) => {
      acc.push(key);
      if (value === "workspace:*") {
        const workspace = project.findWorkspaceByName(key);
        if (workspace) {
          // push all subpaths of the workspace
          for (const subpath of readdirSync(
            path.resolve(project.rootDirectory, workspace.path),
            {
              withFileTypes: true,
            },
          )) {
            if (subpath.isDirectory()) {
              // Module specifiers always use forward slashes. `path.join`
              // would produce backslashes on Windows, so the resulting
              // key wouldn't match the import specifier in rslib's
              // externals map and the dep would leak to runtime.
              acc.push(`${workspace.name}/${subpath.name}`);
            }
          }
        }
      }
      return acc;
    },
    [] as string[],
  );

  logger.debug(`bundledDependencies: ${JSON.stringify(bundledDependencies)}`);

  const rsLibConfig = mergeRslibConfig(rsLibConfigRaw, {
    output: {
      externals: Object.fromEntries(
        bundledDependencies.map((dependency) => [dependency, false]),
      ),
    },
  }) as RslibConfig;

  logger.debug(`rsLibConfig: ${JSON.stringify(rsLibConfig)}`);

  const rslib = await createRslib({
    config: rsLibConfig,
  });

  await rslib.build();

  // Strip stale `//# sourceMappingURL=...` comments left over from
  // bundled vendor sources (e.g. sucrase's @jridgewell/* deps). The
  // referenced .map files aren't emitted, so the comments only
  // produce noisy "Failed to load source map" warnings under vite/
  // vitest when running the dist build.
  const bundledDepsDir = path.resolve(DIST_PATH, "src/internal/bundledDeps");
  for (const entry of readdirSync(bundledDepsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const filePath = path.join(bundledDepsDir, entry.name);
    const original = readFileSync(filePath, "utf8");
    const stripped = original.replace(
      /^\/\/# sourceMappingURL=.*$\r?\n?/gm,
      "",
    );
    if (stripped !== original) {
      writeFileSync(filePath, stripped);
    }
  }

  if (!IS_TEST_BUILD && process.env.NO_DTS !== "true") {
    logger.info("DTS: Bundling DTS...");

    const dtsEntries = Object.values(inputPackageJson.exports) as string[];

    const fileContents = await generateDtsBundle(
      dtsEntries.map((exp) => ({
        inlinedLibraries: bundledDependencies,
        filePath: path.resolve(__dirname, "..", exp as string),
      })),
      {
        preferredConfigPath: path.resolve(__dirname, "../tsconfig.json"),
      },
    );

    for (let i = 0; i < fileContents.length; i++) {
      const fileContent = fileContents[i];
      const filePath = path.resolve(
        DIST_PATH,
        dtsEntries[i].replace(".ts", ".d.ts"),
      );
      logger.debug(`DTS: Writing ${filePath}`);
      writeFileSync(filePath, fileContent);
    }
  }

  logger.info("Writing package.json...");
  writeFileSync(
    path.resolve(DIST_PATH, "package.json"),
    JSON.stringify(outputPackageJson, null, 2),
  );

  logger.info("Writing .prettierignore...");
  writeFileSync(
    path.resolve(DIST_PATH, ".prettierignore"),
    ["**/tests/**/*.json", "bin/cli.js"].join("\n") + "\n",
  );

  // await $`cd ${path.resolve(__dirname, IS_TEST_BUILD ? "../dist.test" : "../dist")} && bunx prettier --write . > /dev/null`;

  logger.debug("Cleaning up...");
  rmSync(path.resolve(DIST_PATH, ".prettierignore"));
  rmSync(path.resolve(DIST_PATH, "node_modules"), {
    recursive: true,
    force: true,
  });
  rmSync(path.resolve(DIST_PATH, "src/internal/generated/ajv"), {
    recursive: true,
    force: true,
  });

  const ajvDir = path.resolve(DIST_PATH, "src/internal/generated/ajv");
  logger.debug(`Creating ${ajvDir}...`);
  mkdirSync(ajvDir, { recursive: true });

  for (const file of new Bun.Glob(
    path.resolve(__dirname, "../src/internal/generated/ajv/*"),
  ).scanSync()) {
    logger.debug(`Copying ${file} to ${ajvDir}...`);

    copyFileSync(
      file,
      path.resolve(
        DIST_PATH,
        "src/internal/generated/ajv/",
        path.basename(file),
      ),
    );

    renameSync(
      path.resolve(
        DIST_PATH,
        "src/internal/generated/ajv/",
        path.basename(file),
      ),

      path.resolve(
        DIST_PATH,
        "src/internal/generated/ajv/",
        path.basename(file).replace(".js", ".js"),
      ),
    );
  }

  copyFileSync(
    path.resolve(__dirname, "../AGENTS.md"),
    path.resolve(DIST_PATH, "AGENTS.md"),
  );

  cpSync(
    path.resolve(__dirname, "../agents"),
    path.resolve(DIST_PATH, "agents"),
    { recursive: true },
  );

  if (IS_TEST_BUILD) {
    logger.debug(`Copying tests to ${DIST_PATH}/tests...`);

    cpSync(
      path.resolve(__dirname, "../tests"),
      path.resolve(DIST_PATH, "tests"),
      { recursive: true },
    );
    cpSync(
      path.resolve(__dirname, "../scripts"),
      path.resolve(DIST_PATH, "scripts"),
      { recursive: true },
    );
    copyFileSync(
      path.resolve(__dirname, "../bunfig.toml"),
      path.resolve(DIST_PATH, "bunfig.toml"),
    );
    copyFileSync(
      path.resolve(__dirname, "../setupTests.ts"),
      path.resolve(DIST_PATH, "setupTests.ts"),
    );

    // Mark the CLI entrypoint executable (no-op on Windows) and link
    // the built package back into its own node_modules so test code can
    // resolve `pacwich` against the build. `junction` works on Windows
    // without elevated privileges; on POSIX the type argument is
    // ignored and a regular symlink is created.
    chmodSync(path.resolve(DIST_PATH, "bin/cli.js"), 0o755);
    const nodeModulesDir = path.resolve(DIST_PATH, "node_modules");
    mkdirSync(nodeModulesDir, { recursive: true });
    const pacwichLink = path.resolve(nodeModulesDir, "pacwich");
    rmSync(pacwichLink, { recursive: true, force: true });
    symlinkSync(DIST_PATH, pacwichLink, "junction");

    logger.info("Installing test build dependencies...");
    await $`cd ${DIST_PATH} && bun install`;
  }
};

if (import.meta.main) {
  await runBuild();
}
