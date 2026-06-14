import fs from "fs";
import os from "os";
import path from "path";
import { PACWICH_VERSION } from "@pacwich/common/version";
import { logger } from "../../logger";
import { createShortId } from "../language/string/id";
import { runOnExit } from "./onExit";

/**
 * Per-user suffix on the temp base dir prevents a different local user from
 * pre-creating or symlink-squatting `/tmp/pacwich` to steer our writes.
 * On platforms without a numeric uid (Windows), `os.tmpdir()` is already
 * per-user so the suffix becomes inert.
 */
const getUserSuffix = (): string => {
  try {
    const { uid } = os.userInfo();
    return uid >= 0 ? `-${uid}` : "";
  } catch {
    return "";
  }
};

const getTempBasePackageDir = () =>
  path.join(os.tmpdir(), `pacwich${getUserSuffix()}`);

const getTempParentDir = () =>
  path.join(getTempBasePackageDir(), PACWICH_VERSION);

export type CreateTempFileOptions = {
  name: string;
  content: string;
  mode?: fs.Mode;
};

class TempDir {
  public readonly id = createShortId(6);
  public readonly dir: string;

  constructor() {
    this.dir = path.join(getTempParentDir(), this.id);
  }

  initialize(clean = false) {
    if (fs.existsSync(this.dir)) return;

    // Pass mode at creation time so the dir is never briefly readable by
    // other local users between mkdir and a subsequent chmod (closes the
    // TOCTOU window where another process could enter the dir before the
    // mode is tightened).
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });

    if (clean) {
      for (const dir of fs.readdirSync(path.resolve(getTempBasePackageDir()))) {
        if (dir !== PACWICH_VERSION) {
          logger.debug(
            `Removing temp dir: ${path.join(getTempBasePackageDir(), dir)}`,
          );
          fs.rmSync(path.join(getTempBasePackageDir(), dir), {
            force: true,
            recursive: true,
          });
        }
      }
    }

    runOnExit(() => {
      logger.debug(`Removing temp dir: ${this.dir}`);
      fs.rmSync(this.dir, { force: true, recursive: true });
    });

    logger.debug(`Created temp dir: ${this.dir}`);
  }

  createFilePath(fileName: string) {
    return path.join(this.dir, fileName);
  }

  createFile({ name, content, mode }: CreateTempFileOptions) {
    this.initialize();
    const filePath = this.createFilePath(name);
    fs.writeFileSync(filePath, content, {
      encoding: "utf8",
      mode,
    });
    return {
      filePath,
      cleanup: () => fs.rmSync(filePath, { force: true }),
    };
  }

  cleanup() {
    fs.rmSync(this.dir, { force: true, recursive: true });
  }
}

export const DEFAULT_TEMP_DIR: TempDir = new TempDir();
