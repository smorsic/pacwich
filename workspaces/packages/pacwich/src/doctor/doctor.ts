import fs from "fs";
import os from "os";
import path from "path";
import { PACWICH_VERSION } from "@pacwich/common/version";
import {
  CURRENT_RUNTIME_INFO,
  validateRuntime,
  type Simplify,
} from "../internal/core";
import {
  detectPackageManagerVersion,
  PACKAGE_MANAGER_NAMES,
  type PackageManagerName,
} from "../packageManager";

const getBinaryInfo = () => {
  const argv = process.argv.slice(0);

  let binaryPath: string | null = argv[1] ?? null;
  try {
    binaryPath = path.relative(process.cwd(), fs.realpathSync(binaryPath));
  } catch {
    binaryPath = null;
  }

  return {
    binary: {
      exec: process.execPath,
      path: binaryPath,
    },
  };
};

const getShellInfo = () => ({
  shell: {
    binary: process.env.SHELL ?? null,
    terminal: process.env.TERM ?? null,
  },
});

const getSystemInfo = () => ({
  os: {
    type: os.type(),
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    version: os.version(),
    cpuCount: os.cpus().length,
  },
});

const getVersionInfo = () => ({
  version: PACWICH_VERSION,
});

const getRuntimeInfo = () => ({
  runtime: {
    ...CURRENT_RUNTIME_INFO,
    valid: !validateRuntime(),
  },
});

/**
 * Probe every supported package manager backend in parallel. Each
 * detector returns `""` on failure (binary missing, timeout, etc.),
 * so the resulting record is always shaped
 * `Record<PackageManagerName, string>` with no partial state.
 *
 * Intentionally project-agnostic: the doctor command reports what is
 * installed on the host, not what the current project resolves to.
 * Project-specific resolution lives in
 * {@link resolvePackageManagerValue} on the createFileSystemProject
 * path.
 */
const getPackageManagersInfo = async (): Promise<{
  packageManagers: Record<PackageManagerName, string>;
}> => {
  const entries = await Promise.all(
    PACKAGE_MANAGER_NAMES.map(
      async (name) => [name, await detectPackageManagerVersion(name)] as const,
    ),
  );
  return {
    packageManagers: Object.fromEntries(entries) as Record<
      PackageManagerName,
      string
    >,
  };
};

export type DoctorInfo = Simplify<
  ReturnType<typeof getVersionInfo> &
    ReturnType<typeof getBinaryInfo> &
    ReturnType<typeof getRuntimeInfo> &
    ReturnType<typeof getSystemInfo> &
    ReturnType<typeof getShellInfo> &
    Awaited<ReturnType<typeof getPackageManagersInfo>>
>;

export const getDoctorInfo = async (): Promise<DoctorInfo> => ({
  ...getVersionInfo(),
  ...getRuntimeInfo(),
  ...getBinaryInfo(),
  ...getSystemInfo(),
  ...getShellInfo(),
  ...(await getPackageManagersInfo()),
});
