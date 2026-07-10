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
import { mock } from "bun:test";
import { fs as memfsFs, vol } from "memfs";

const SUBPROCESS_PATH = realpathSync(
  new URL(
    "../node_modules/pacwich/src/runScript/subprocesses.ts",
    import.meta.url,
  ),
);

vol.reset();
mock.module("fs", () => ({ ...memfsFs, default: memfsFs }));
mock.module("node:fs", () => ({ ...memfsFs, default: memfsFs }));

const mockSubprocess = await import("../src/cli/mockSubprocess");
mock.module(SUBPROCESS_PATH, () => mockSubprocess);
