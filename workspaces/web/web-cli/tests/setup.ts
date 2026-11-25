/**
 * Shared bun:test bootstrap (see bunfig.toml's `preload`), run once before
 * any test file loads. `mock.module` is process-global, not per-file — doing
 * this fs/subprocess mocking independently in each test file broke depending
 * on which file bun happened to import first, since a later file's top-level
 * code (e.g. resolving a real path via `realpathSync`) would already see the
 * earlier file's mocked `fs`.
 *
 * Mirrors the browser build's wiring: `fs`/`node:fs` redirect to memfs,
 * `os`/`node:os`, `child_process`, and `stream/consumers` to their respective
 * stubs (see rspress.config.ts's `resolve.alias`), and pacwich's subprocess
 * chokepoint is replaced with the mock (see rspress.config.ts's
 * `NormalModuleReplacementPlugin`). Without the `os` mock, `doctor`'s system
 * info would read the real *test host's* OS instead of the shimmed values a
 * real browser run would report. Without the `stream/consumers` mock,
 * `verify`/`affected`'s git-diff resolution would read the real Node
 * implementation instead of exercising `stubs.ts`'s `text()`, masking bugs
 * there that only show up in the actual browser build.
 */
import { realpathSync } from "node:fs";
import path from "node:path";
import { mock } from "bun:test";
// This file's `vol` and web-cli-runtime's fsShim.ts/demoProject.ts's `vol`
// must be the same physical `memfs` install (a single package.json
// declaration for this workspace guarantees that) — otherwise they're
// different, disconnected instances, and seeded files silently "don't exist".
import { fs as memfsFs, vol } from "memfs";

// Resolved via Bun's real module resolution (not a hardcoded relative path
// into this workspace's own node_modules). The pacwich workspace's
// package.json is named "pacwich_local" (not "pacwich", which is reserved
// for the real published package) to avoid clashing with its own built dist.
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

const stubs = await import("../src/web-cli-runtime/stubs");
mock.module("child_process", () => stubs);
mock.module("node:child_process", () => stubs);

const osShim = await import("../src/web-cli-runtime/osShim");
mock.module("os", () => osShim);
mock.module("node:os", () => osShim);

mock.module("stream/consumers", () => stubs);
mock.module("node:stream/consumers", () => stubs);

const mockSubprocess = await import("../src/web-cli-runtime/mockSubprocess");
mock.module(SUBPROCESS_PATH, () => mockSubprocess);
