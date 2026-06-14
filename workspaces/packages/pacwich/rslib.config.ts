import path from "path";
import { createScriptLogger } from "@pacwich/meta/util";
import { defineConfig } from "@rslib/core";
import { validateRuntime } from "./src/internal/core/runtime/currentRuntime";

export const IS_TEST_BUILD = process.env.IS_TEST_BUILD === "true";

const OUTDIR = process.env.OUTDIR;

export const DIST_PATH = path.join(
  OUTDIR
    ? path.resolve(process.env.PACWICH_PROJECT_PATH as string, OUTDIR)
    : __dirname,
  IS_TEST_BUILD ? "dist.test" : "dist",
);

const runtimeError = validateRuntime();

const logger = createScriptLogger({ name: "rslib.config" });

if (runtimeError) {
  logger.error(runtimeError.message);
}

export default defineConfig({
  lib: [
    {
      format: "esm",
      bundle: false,
      // Bundleless entries come from `source.entry` (default `src/**`, which
      // would sweep up co-located `*.review.md` code-review notes and hand
      // them to Rspack as JS). Globbing `*.ts` restricts entries to real
      // source and excludes the review docs (and `.gitkeep`) by extension.
      // `source.include`/`exclude` do NOT control bundleless entries.
      source: { entry: { index: "src/**/*.ts" } },
    },
  ],
  output: {
    minify: {
      js: false,
      jsOptions: {
        extractComments: true,
      },
    },
    distPath: {
      root: path.join(DIST_PATH, "src"),
    },
    cleanDistPath: true,
    copy: [
      {
        from: path.resolve(
          process.env.PACWICH_PROJECT_PATH as string,
          "README.md",
        ),
        to: "../README.md",
      },
      {
        from: path.resolve(
          process.env.PACWICH_PROJECT_PATH as string,
          "LICENSE.md",
        ),
        to: "../LICENSE.md",
      },
      {
        from: path.resolve(__dirname, "bin/cli.js"),
        to: "../bin/cli.js",
      },
    ],
  },
});
