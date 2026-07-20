import { copyFileSync, mkdirSync, rmSync, symlinkSync } from "fs";
import path from "path";
import { createScriptLogger } from "@pacwich/meta/util";

const logger = createScriptLogger({ name: "Dev Package Link" });

const WORKSPACE_DIR = path.resolve(__dirname, "..");
const PACKAGE_DIR = path.resolve(WORKSPACE_DIR, "node_modules/pacwich");

/**
 * Make bare "pacwich" imports resolve within this workspace for dev
 * (vitest, and fixture configs evaluated by jiti outside the vitest
 * sandbox). A plain node_modules/pacwich -> .. self-link (previously a
 * "pacwich": "file:." dep) forms a directory cycle that symlink-following
 * walkers traverse for minutes, so build a real dir with a src link
 * whose target contains no node_modules. `junction` works on Windows
 * without elevated privileges and is ignored on POSIX.
 */
const createDevPackageLink = () => {
  rmSync(PACKAGE_DIR, { recursive: true, force: true });
  mkdirSync(PACKAGE_DIR, { recursive: true });
  copyFileSync(
    path.resolve(WORKSPACE_DIR, "package.json"),
    path.resolve(PACKAGE_DIR, "package.json"),
  );
  symlinkSync(
    path.resolve(WORKSPACE_DIR, "src"),
    path.resolve(PACKAGE_DIR, "src"),
    "junction",
  );
  logger.info(`Created ${PACKAGE_DIR}`);
};

createDevPackageLink();
