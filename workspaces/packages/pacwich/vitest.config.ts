import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./setupTests.ts"],
    testTimeout: 10_000,
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
