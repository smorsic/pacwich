import { getUserEnvVarName } from "@pacwich/common/config";
import { type LogLevel, type LogLevelSetting } from "@pacwich/common/logging";
import { createLogger } from "../../src/internal/logger";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "../util/testFramework";

// The PACWICH_LOG_LEVEL env var seeds the default print level a logger starts
// with, resolved at construction. The CLI --log-level flag or setLogLevel
// override it afterward. In the test env the built-in fallback is "error".
describe("PACWICH_LOG_LEVEL env var default", () => {
  const ENV_VAR = getUserEnvVarName("logLevel");
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env[ENV_VAR];
    delete process.env[ENV_VAR];
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = originalEnv;
  });

  const levels: LogLevelSetting[] = [
    "debug",
    "info",
    "warn",
    "error",
    "silent",
  ];
  for (const level of levels) {
    test(`a valid value "${level}" becomes the default print level`, () => {
      process.env[ENV_VAR] = level;
      expect(createLogger("pacwich").printLevel).toBe(level);
    });
  }

  test("an unset env var falls back to the built-in default", () => {
    expect(createLogger("pacwich").printLevel).toBe("error");
  });

  test("an invalid value is ignored and falls back (does not throw)", () => {
    process.env[ENV_VAR] = "oops";
    let logger!: ReturnType<typeof createLogger>;
    expect(() => (logger = createLogger("pacwich"))).not.toThrow();
    expect(logger.printLevel).toBe("error");
  });

  test("an empty-string env var falls back to the built-in default", () => {
    process.env[ENV_VAR] = "";
    expect(createLogger("pacwich").printLevel).toBe("error");
  });

  test("setLogLevel-style assignment overrides the env var default", () => {
    process.env[ENV_VAR] = "warn";
    const logger = createLogger("pacwich");
    expect(logger.printLevel).toBe("warn");
    logger.printLevel = "debug" as LogLevel;
    expect(logger.printLevel).toBe("debug");
  });
});
