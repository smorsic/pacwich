/**
 * The demo project's structure with no pacwich config files at all:
 * package.json/tsconfig.json/source files for the root and every workspace.
 * Split out from `demoProject.ts` so `scripts/generateDemoConfig.ts` (which
 * writes this same structure to a real temp directory to actually resolve
 * `pacwich.project.ts` for real) never has to depend on that generation's
 * own output, which wouldn't exist yet on a first run.
 */
import backendAPkg from "./demo-project/apps/my-app-a/backend-a/package.json";
import backendATsconfig from "./demo-project/apps/my-app-a/backend-a/tsconfig.json";
import frontendAPkg from "./demo-project/apps/my-app-a/frontend-a/package.json";
import frontendATsconfig from "./demo-project/apps/my-app-a/frontend-a/tsconfig.json";
import backendBPkg from "./demo-project/apps/my-app-b/backend-b/package.json";
import backendBTsconfig from "./demo-project/apps/my-app-b/backend-b/tsconfig.json";
import frontendBPkg from "./demo-project/apps/my-app-b/frontend-b/package.json";
import frontendBTsconfig from "./demo-project/apps/my-app-b/frontend-b/tsconfig.json";
import sharedAPkg from "./demo-project/apps/my-app-b/shared-a/package.json";
import sharedATsconfig from "./demo-project/apps/my-app-b/shared-a/tsconfig.json";
import backendUtilsPkg from "./demo-project/libraries/backend-utils/package.json";
import backendUtilsTsconfig from "./demo-project/libraries/backend-utils/tsconfig.json";
import frontendUtilsPkg from "./demo-project/libraries/frontend-utils/package.json";
import frontendUtilsTsconfig from "./demo-project/libraries/frontend-utils/tsconfig.json";
import sharedUtilsPkg from "./demo-project/libraries/shared-utils/package.json";
import sharedUtilsTsconfig from "./demo-project/libraries/shared-utils/tsconfig.json";
import rootPackageJson from "./demo-project/package.json";
import { PNPM_LOCK_YAML, PNPM_WORKSPACE_YAML } from "./demo-project/pnpmFiles";
import {
  BACKEND_A_SOURCE_FILES,
  BACKEND_B_SOURCE_FILES,
  BACKEND_UTILS_SOURCE_FILES,
  FRONTEND_A_SOURCE_FILES,
  FRONTEND_B_SOURCE_FILES,
  FRONTEND_UTILS_SOURCE_FILES,
  SHARED_A_SOURCE_FILES,
  SHARED_UTILS_SOURCE_FILES,
} from "./demo-project/sourceFiles";

export const PROJECT_ROOT = "/project";

/** Each workspace directory paired with its package.json, tsconfig, and source files. */
export const WORKSPACE_DIRS = [
  {
    dir: "apps/my-app-a/frontend-a",
    pkg: frontendAPkg,
    tsconfig: frontendATsconfig,
    sourceFiles: FRONTEND_A_SOURCE_FILES,
  },
  {
    dir: "apps/my-app-a/backend-a",
    pkg: backendAPkg,
    tsconfig: backendATsconfig,
    sourceFiles: BACKEND_A_SOURCE_FILES,
  },
  {
    dir: "apps/my-app-b/shared-a",
    pkg: sharedAPkg,
    tsconfig: sharedATsconfig,
    sourceFiles: SHARED_A_SOURCE_FILES,
  },
  {
    dir: "apps/my-app-b/frontend-b",
    pkg: frontendBPkg,
    tsconfig: frontendBTsconfig,
    sourceFiles: FRONTEND_B_SOURCE_FILES,
  },
  {
    dir: "apps/my-app-b/backend-b",
    pkg: backendBPkg,
    tsconfig: backendBTsconfig,
    sourceFiles: BACKEND_B_SOURCE_FILES,
  },
  {
    dir: "libraries/frontend-utils",
    pkg: frontendUtilsPkg,
    tsconfig: frontendUtilsTsconfig,
    sourceFiles: FRONTEND_UTILS_SOURCE_FILES,
  },
  {
    dir: "libraries/backend-utils",
    pkg: backendUtilsPkg,
    tsconfig: backendUtilsTsconfig,
    sourceFiles: BACKEND_UTILS_SOURCE_FILES,
  },
  {
    dir: "libraries/shared-utils",
    pkg: sharedUtilsPkg,
    tsconfig: sharedUtilsTsconfig,
    sourceFiles: SHARED_UTILS_SOURCE_FILES,
  },
] as const;

export const json = (value: unknown) => JSON.stringify(value, null, 2);

/**
 * The project structure alone (package.json/tsconfig.json/source files for
 * the root and every workspace), with no pacwich config files at all.
 */
export const buildBaseFileMap = (): Record<string, string> => {
  const files: Record<string, string> = {
    [`${PROJECT_ROOT}/package.json`]: json(rootPackageJson),
    [`${PROJECT_ROOT}/pnpm-workspace.yaml`]: PNPM_WORKSPACE_YAML,
    [`${PROJECT_ROOT}/pnpm-lock.yaml`]: PNPM_LOCK_YAML,
  };
  for (const { dir, pkg, tsconfig, sourceFiles } of WORKSPACE_DIRS) {
    files[`${PROJECT_ROOT}/${dir}/package.json`] = json(pkg);
    files[`${PROJECT_ROOT}/${dir}/tsconfig.json`] = json(tsconfig);
    for (const [sourceFile, content] of Object.entries(sourceFiles)) {
      files[`${PROJECT_ROOT}/${dir}/${sourceFile}`] = content;
    }
  }
  return files;
};
