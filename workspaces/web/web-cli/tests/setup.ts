/**
 * Shared bun:test bootstrap (see bunfig.toml's `preload`), run once before
 * any test file loads. `mock.module` is process-global, not per-file — doing
 * this fs/subprocess mocking independently in each test file broke depending
 * on which file bun happened to import first, since a later file's top-level
 * code (e.g. resolving a real path via `realpathSync`) would already see the
 * earlier file's mocked `fs`.
 *
 * Mirrors the browser build's wiring: `fs`/`node:fs` redirect to memfs (see
 * rspress.config.ts's `resolve.alias`), and pacwich's subprocess chokepoint
 * is replaced with the mock (see rspress.config.ts's `NormalModuleReplacementPlugin`).
 */
import { realpathSync } from "node:fs";
import path from "node:path";
import { mock } from "bun:test";
// `memfs`'s version here must satisfy the same range @pacwich/web-common
// declares, so bun dedupes both to one physical install — otherwise this
// file's `vol` and web-common's fsShim.ts/demoProject.ts's `vol` are
// different, disconnected instances, and seeded files silently "don't exist".
import { fs as memfsFs, vol } from "memfs";

// Resolved via Bun's real module resolution (not a hardcoded relative path
// into this workspace's own node_modules) since web-cli no longer declares
// `pacwich_local` as a direct dependency — only @pacwich/web-common does
// now. The pacwich workspace's package.json is named "pacwich_local" (not
// "pacwich", which is reserved for the real published package) to avoid
// clashing with its own built dist.
const pacwichPackageJsonPath = Bun.resolveSync(
  "pacwich_local/package.json",
  import.meta.dir,
);
const SUBPROCESS_PATH = realpathSync(
  path.join(
    path.dirname(pacwichPackageJsonPath),
    "src/runScript/subprocesses.ts",
  ),
);

vol.reset();
mock.module("fs", () => ({ ...memfsFs, default: memfsFs }));
mock.module("node:fs", () => ({ ...memfsFs, default: memfsFs }));

const mockSubprocess =
  await import("@pacwich/web-common/web-cli-runtime/mockSubprocess");
mock.module(SUBPROCESS_PATH, () => mockSubprocess);
