import { defineConfig } from "vitest/config";

/**
 * @todo Bun 1.4 can stall some tests past 10s under CI load (possibly related
 * to https://github.com/oven-sh/bun/issues/39876), so the timeout is raised
 * there. Check back if Bun 1.4.x latest has the same issue and remove this
 * logic if tests pass without it
 */
const IS_BUN_1_4 =
  typeof Bun !== "undefined" && Bun.semver.satisfies(Bun.version, "1.4.x");

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./setupTests.ts"],
    testTimeout: IS_BUN_1_4 ? 30_000 : 10_000,
    isolate: false,
    watch: false,
    env: {
      PACWICH_PARALLEL_MAX_DEFAULT: "16",
      PACWICH_SHELL_DEFAULT: "bun", // Tests historically rely on Bun-shell semantics for cross-platform compatibility
      PACWICH_DISABLE_LOCAL_DELEGATION: "false",
      _PACWICH_IS_INTERNAL_TEST: "true",
    },
  },
});
