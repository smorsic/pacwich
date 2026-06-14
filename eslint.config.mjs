import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const ALLOW_UNUSED_VARNAME_PATTERN = "^_";

export default defineConfig([
  globalIgnores([
    "**/*.js",
    "**/*.d.ts",
    "**/*.mjs",
    "**/dist/**/*",
    ".github/**/*",
  ]),
  {
    name: "rootJs",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  {
    name: "baseConfig",
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        allowDefaultProject: ["*.js", "*.mjs", "*.ts", "*.tsx"],
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "import/no-unresolved": "off",
      "prefer-const": "error",
      "@typescript-eslint/no-empty-interface": "warn",
      "@typescript-eslint/no-empty-function": "warn",
      "no-empty": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],
      "@typescript-eslint/no-extra-semi": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: ALLOW_UNUSED_VARNAME_PATTERN,
          argsIgnorePattern: ALLOW_UNUSED_VARNAME_PATTERN,
          destructuredArrayIgnorePattern: ALLOW_UNUSED_VARNAME_PATTERN,
          caughtErrorsIgnorePattern: ALLOW_UNUSED_VARNAME_PATTERN,
        },
      ],
      eqeqeq: "error",
      "import/no-dynamic-require": "warn",
      "import/order": [
        "warn",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [
            {
              pattern: "@/**",
              group: "external",
              position: "after",
            },
          ],
        },
      ],
    },
  },
  {
    name: "pacwichPackageConfig",
    files: [
      "workspaces/libraries/pacwich-common/**/*.{js,mjs,cjs,ts,mts,cts,tsx}",
      "workspaces/packages/pacwich/**/*.{js,mjs,cjs,ts,mts,cts,tsx}",
    ],
    rules: {
      "no-console": "error",
    },
  },
  {
    name: "docWebsitePackageConfig",
    files: [
      "workspaces/web/documentation-website/**/*.{js,mjs,cjs,ts,mts,cts,tsx}",
    ],
    ...reactPlugin.configs.flat.recommended,
    ...reactHooksPlugin.configs.flat.recommended,
  },
  {
    name: "scripts",
    files: ["**/scripts/**/*.{js,mjs,cjs,ts,mts,cts,tsx}"],
    rules: {
      "no-console": "warn",
    },
  },
  {
    name: "testConfig",
    files: [
      "**/tests/**/*.{js,mjs,cjs,ts,mts,cts,tsx}",
      "**/*.test.{js,mjs,cjs,ts,mts,cts,tsx}",
    ],
    rules: {
      "no-console": "warn",
    },
  },
]);
