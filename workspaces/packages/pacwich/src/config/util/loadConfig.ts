import fs from "fs";
import { createRequire } from "node:module";
import path from "path";
import {
  CONFIG_LOCATION_TYPES,
  createConfigLocationPath,
  type ConfigLocation,
  type ConfigLocationType,
} from "@pacwich/common/config";
import { createJiti, type Jiti } from "../../internal/bundledDeps/jiti";
import { transform as sucraseTransform } from "../../internal/bundledDeps/sucrase";
import {
  defineErrors,
  IS_BUN,
  isPacwichError,
  parseJSONC,
  prefixPacwichErrorMessage,
  type AnyFunction,
} from "../../internal/core";
import { logger } from "../../internal/logger";

const require = createRequire(import.meta.url);

let cachedJiti: Jiti | undefined;

/**
 * Lazy jiti instance used to load `.ts`/`.js` config files under Node.
 * Bun has native TS support via `require`, so we skip jiti there.
 *
 * jiti's default transformer (`dist/babel.cjs`) is a separate file it
 * loads via `createRequire(...)("../dist/babel.cjs")` at runtime. That
 * path doesn't resolve once jiti is inlined into pacwich's bundle, so
 * we supply our own transform (sucrase) to short-circuit jiti's
 * lazy-load entirely.
 */
const getJiti = (): Jiti => {
  if (!cachedJiti) {
    cachedJiti = createJiti(import.meta.url, {
      interopDefault: false,
      moduleCache: true,
      fsCache: false,
      transform: (opts) => {
        const result = sucraseTransform(opts.source, {
          transforms: ["typescript", "imports"],
          filePath: opts.filename,
          preserveDynamicImport: true,
        });
        return { code: result.code };
      },
    });
  }
  return cachedJiti;
};

const loadConfigModule = (configFilePath: string): unknown => {
  if (IS_BUN) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-dynamic-require
    return require(configFilePath);
  }
  return getJiti()(configFilePath);
};

/** Errors thrown while reading and evaluating a project or workspace
 * config file from disk (JSON parse failures, missing default export,
 * TS/JS module load failures). Subclasses of {@link PacwichError}. */
export const LOAD_CONFIG_ERRORS = defineErrors(
  "InvalidJSON",
  "NoExportError",
  "ModuleLoadFailure",
);

/** cwd-relative when the config is under the cwd, absolute otherwise
 * (avoids long "../.." chains when running with --cwd elsewhere) */
export const createConfigErrorPathPrefix = (absolutePath: string) => {
  const relativePath = path.relative(process.cwd(), absolutePath);
  return relativePath.startsWith("..") ? absolutePath : relativePath;
};

const parseJSON = (jsonString: string, path: string) => {
  try {
    return parseJSONC(jsonString);
  } catch (error) {
    throw new LOAD_CONFIG_ERRORS.InvalidJSON(
      `Invalid JSON at ${path}: ${(error as Error).message}`,
    );
  }
};

const parseModule = (
  locationType: "tsFile" | "jsFile",
  directory: string,
  fileName: string,
) => {
  const configFilePath = path.join(
    directory,
    createConfigLocationPath(locationType, fileName, ""),
  );
  if (fs.existsSync(configFilePath)) {
    let content: unknown;
    try {
      const module = loadConfigModule(configFilePath) as {
        default?: unknown;
      };
      content = module.default;
    } catch (error) {
      // Domain errors (PacwichError subclasses) thrown from within
      // the evaluated config file (e.g. validation failures from
      // `defineProjectConfig`) carry the right message already, so
      // re-throw them with only the file path prefixed rather than
      // wrapping them in a generic "Failed to load module" envelope
      // that obscures the cause and changes the error class.
      // `isPacwichError` uses a Symbol.for marker so it matches even
      // when jiti loads the error class in a separate module realm.
      if (isPacwichError(error)) {
        throw prefixPacwichErrorMessage(
          error,
          createConfigErrorPathPrefix(configFilePath),
        );
      }
      throw new LOAD_CONFIG_ERRORS.ModuleLoadFailure(
        `Failed to load module at ${configFilePath}: ${(error as Error).message}`,
      );
    }

    if (!content) {
      throw new LOAD_CONFIG_ERRORS.NoExportError(
        `No default export found in ${configFilePath}. Expected config object.`,
      );
    }

    return {
      type: locationType,
      content,
      path: path.relative(process.cwd(), configFilePath),
    };
  }
  return null;
};

const LOCATION_FINDERS: Record<
  ConfigLocationType,
  (
    directory: string,
    fileName: string,
    packageJsonKey: string,
  ) => ConfigLocation | null
> = {
  tsFile: (directory: string, fileName: string) =>
    parseModule("tsFile", directory, fileName),
  jsFile: (directory: string, fileName: string) =>
    parseModule("jsFile", directory, fileName),
  jsoncFile: (directory: string, fileName: string) => {
    const configFilePath = path.join(
      directory,
      createConfigLocationPath("jsoncFile", fileName, ""),
    );
    if (fs.existsSync(configFilePath)) {
      return {
        type: "jsoncFile",
        content: parseJSON(
          fs.readFileSync(configFilePath, "utf8"),
          configFilePath,
        ),
        path: path.relative(process.cwd(), configFilePath),
      };
    }
    return null;
  },
  jsonFile: (directory: string, fileName: string) => {
    const configFilePath = path.join(
      directory,
      createConfigLocationPath("jsonFile", fileName, ""),
    );
    if (fs.existsSync(configFilePath)) {
      return {
        type: "jsonFile",
        content: parseJSON(
          fs.readFileSync(configFilePath, "utf8"),
          configFilePath,
        ),
        path: path.relative(process.cwd(), configFilePath),
      };
    }
    return null;
  },
  packageJson: (
    directory: string,
    _fileName: string,
    packageJsonKey: string,
  ) => {
    const packageJsonPath = path.join(directory, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = parseJSON(
        fs.readFileSync(packageJsonPath, "utf8"),
        packageJsonPath,
      );
      if (packageJson[packageJsonKey]) {
        return {
          type: "packageJson",
          path: path.relative(
            process.cwd(),
            path.join(
              directory,
              createConfigLocationPath("packageJson", "", packageJsonKey),
            ),
          ),
          content: packageJson[packageJsonKey],
        };
      }
    }
    return null;
  },
};

/**
 * When true, skip discovery of `.ts`/`.js` config locations so that no
 * executable code is loaded via `require()`. Plain `.jsonc`/`.json` and
 * the `package.json` `pacwich` key still resolve. For untrusted contexts,
 * set via the `--disable-executable-configs` flag or the factory option.
 */
export type LoadConfigOptions = {
  disableExecutableConfigs?: boolean;
};

const isExecutableLocationType = (locationType: ConfigLocationType): boolean =>
  locationType === "tsFile" || locationType === "jsFile";

export const getConfigLocation = (
  name: string,
  directory: string,
  fileName: string,
  packageJsonKey: string,
  loadOptions: LoadConfigOptions = {},
): ConfigLocation | null => {
  const locations: ConfigLocation[] = [];
  for (const locationType of CONFIG_LOCATION_TYPES) {
    if (
      loadOptions.disableExecutableConfigs &&
      isExecutableLocationType(locationType)
    ) {
      continue;
    }
    const location = LOCATION_FINDERS[locationType](
      directory,
      fileName,
      packageJsonKey,
    );
    if (location) {
      locations.push(location);
    }
  }

  if (locations.length > 1) {
    logger.warn("MultipleConfigsFound", {
      configName: name,
      details: `${locations
        .map((location) => "  " + location.path)
        .join("\n")}\nUsing config at ${locations[0]?.path}`,
    });
  }

  return locations[0] ?? null;
};

export const loadConfig = <ProcessContent extends AnyFunction>(
  name: string,
  directory: string,
  fileName: string,
  packageJsonKey: string,
  processContent: ProcessContent,
  loadOptions: LoadConfigOptions = {},
): ReturnType<ProcessContent> | null => {
  const location = getConfigLocation(
    name,
    directory,
    fileName,
    packageJsonKey,
    loadOptions,
  );
  if (!location) {
    return null;
  }
  logger.debug(
    `Config loaded for ${name} at ${
      location.type === "packageJson"
        ? `${path.join(directory, "package.json")}["${packageJsonKey}"]`
        : location.path
    }`,
  );
  try {
    return processContent(location.content, location);
  } catch (error) {
    // Validation errors thrown while resolving the loaded content don't
    // know their source, so name the config location here.
    throw prefixPacwichErrorMessage(
      error,
      createConfigErrorPathPrefix(path.resolve(location.path)),
    );
  }
};
