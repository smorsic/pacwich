import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    watch: false,
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "tests/mocks/vscode.ts"),
    },
  },
});
