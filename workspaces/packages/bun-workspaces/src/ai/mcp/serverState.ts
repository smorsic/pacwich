import {
  createFileSystemProject,
  type FileSystemProject,
} from "../../project/implementations/fileSystemProject";

interface ServerState {
  workingDirectory: string | null;
  /**
   * When true, allow `.ts`/`.js` config files to be evaluated for every
   * project the server resolves. Defaults to false so that the server,
   * which can be redirected to arbitrary directories at runtime via
   * `set_working_directory`, never executes untrusted config code.
   */
  enableExecutableConfigs: boolean;
}

const SERVER_STATE: ServerState = {
  workingDirectory: null,
  enableExecutableConfigs: false,
};

export const setServerWorkingDirectory = (directory: string | null): void => {
  SERVER_STATE.workingDirectory = directory;
};

export const setServerEnableExecutableConfigs = (enabled: boolean): void => {
  SERVER_STATE.enableExecutableConfigs = enabled;
};

export const getServerProject = (): FileSystemProject | null => {
  if (!SERVER_STATE.workingDirectory) return null;
  try {
    return createFileSystemProject({
      rootDirectory: SERVER_STATE.workingDirectory,
      disableExecutableConfigs: !SERVER_STATE.enableExecutableConfigs,
    });
  } catch {
    return null;
  }
};
