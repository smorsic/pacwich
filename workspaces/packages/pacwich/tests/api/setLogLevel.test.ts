import { type LogLevelSetting } from "@pacwich/common/logging";
import { logger, LOGGER_ERRORS, setLogLevel } from "../../src/internal/logger";
import { stripANSI } from "../util/runtime";
import { test, describe, expect, spyOn, afterAll } from "../util/testFramework";

const DEPRECATED_NO_PREFIX_MESSAGE =
  "--no-prefix is deprecated and will be removed in a future version. Use --output-style=plain instead.";

describe("setLogLevel", () => {
  afterAll(() => {
    setLogLevel("silent");
  });

  test("should set the log level", () => {
    const stderrSpy = spyOn(process.stderr, "write");
    const stdoutSpy = spyOn(process.stdout, "write");

    setLogLevel("debug");
    expect(logger.printLevel).toBe("debug");

    logger.debug("test debug 1");
    logger.info("test info 1");
    logger.warn("DeprecatedNoPrefixFlag", {});
    logger.error("test error 1");
    expect(stderrSpy).toHaveBeenCalledTimes(3);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(
      stderrSpy.mock.calls.map((call) => stripANSI(call[0] as string)),
    ).toEqual([
      "[pacwich DEBUG]: test debug 1\n",
      `[pacwich WARN: DeprecatedNoPrefixFlag]: ${DEPRECATED_NO_PREFIX_MESSAGE}\n`,
      "test error 1\n",
    ]);
    expect(stdoutSpy).toHaveBeenCalledWith("test info 1\n");

    setLogLevel("info");
    expect(logger.printLevel).toBe("info");

    stderrSpy.mockClear();
    stdoutSpy.mockClear();

    logger.debug("test debug 2");
    logger.info("test info 2");
    logger.warn("DeprecatedNoPrefixFlag", {});
    logger.error("test error 2");

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(
      stderrSpy.mock.calls.map((call) => stripANSI(call[0] as string)),
    ).toEqual([
      `[pacwich WARN: DeprecatedNoPrefixFlag]: ${DEPRECATED_NO_PREFIX_MESSAGE}\n`,
      "test error 2\n",
    ]);
    expect(stdoutSpy).toHaveBeenCalledWith("test info 2\n");

    setLogLevel("warn");
    expect(logger.printLevel).toBe("warn");

    stderrSpy.mockClear();
    stdoutSpy.mockClear();

    logger.debug("test debug 3");
    logger.info("test info 3");
    logger.warn("DeprecatedNoPrefixFlag", {});
    logger.error("test error 3");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(
      stderrSpy.mock.calls.map((call) => stripANSI(call[0] as string)),
    ).toEqual([
      `[pacwich WARN: DeprecatedNoPrefixFlag]: ${DEPRECATED_NO_PREFIX_MESSAGE}\n`,
      "test error 3\n",
    ]);

    setLogLevel("error");
    expect(logger.printLevel).toBe("error");

    stderrSpy.mockClear();
    stdoutSpy.mockClear();

    logger.debug("test debug 4");
    logger.info("test info 4");
    logger.warn("DeprecatedNoPrefixFlag", {});
    logger.error("test error 4");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(
      stderrSpy.mock.calls.map((call) => stripANSI(call[0] as string)),
    ).toEqual(["test error 4\n"]);
  });

  test("should throw an error for an invalid log level", () => {
    expect(() => setLogLevel("oops" as unknown as LogLevelSetting)).toThrow(
      LOGGER_ERRORS.InvalidLogLevel,
    );
    expect(() => setLogLevel("oops" as unknown as LogLevelSetting)).toThrow(
      'Invalid log level: "oops". Accepted values: debug, info, warn, error, silent',
    );
    expect(() => setLogLevel(null as unknown as LogLevelSetting)).toThrow(
      LOGGER_ERRORS.InvalidLogLevel,
    );
  });
});
