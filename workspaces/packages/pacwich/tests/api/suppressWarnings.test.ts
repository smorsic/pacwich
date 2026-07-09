import { getUserEnvVarName } from "@pacwich/common/config";
import type { WarningId } from "@pacwich/common/warnings";
import { logger, setSuppressWarnings } from "../../src/internal/logger";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "../util/testFramework";

// Registered ids that take no interpolation options, so they can be
// emitted directly here.
const WARNING_ID = "DeprecatedNoPrefixFlag" as WarningId;
const OTHER_ID = "PnpmWorkspacesFieldIgnored" as WarningId;

// The two remaining suppression sources: the PACWICH_SUPPRESS_WARNINGS env
// var (read live by the logger) and the programmatic set fed by the CLI
// --suppress-warnings flag. Project config and the API option were removed
// since warnings are a process-level concern, not a project setting.
describe("warning suppression", () => {
  const ENV_VAR = getUserEnvVarName("suppressWarnings");
  let originalEnv: string | undefined;
  let originalPrintLevel: (typeof logger)["printLevel"];
  let stderrSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    originalEnv = process.env[ENV_VAR];
    delete process.env[ENV_VAR];
    originalPrintLevel = logger.printLevel;
    logger.printLevel = "warn";
    setSuppressWarnings([]);
    stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      (() => true) as typeof process.stderr.write,
    );
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setSuppressWarnings([]);
    logger.printLevel = originalPrintLevel;
    if (originalEnv === undefined) delete process.env[ENV_VAR];
    else process.env[ENV_VAR] = originalEnv;
  });

  const wasPrinted = (id: WarningId): boolean => {
    stderrSpy.mockClear();
    // WARNING_ID and OTHER_ID take no interpolation options at runtime; the
    // cast satisfies the broad WarnOptions<WarningId> the id variable implies.
    logger.warn(id, {} as unknown as Parameters<typeof logger.warn>[1]);
    return stderrSpy.mock.calls.some(([chunk]: [unknown]) =>
      String(chunk).includes(id),
    );
  };

  test("prints the warning when nothing suppresses it", () => {
    expect(wasPrinted(WARNING_ID)).toBe(true);
  });

  test("the env var suppresses a matching warning", () => {
    process.env[ENV_VAR] = WARNING_ID;
    expect(wasPrinted(WARNING_ID)).toBe(false);
  });

  // The logger is a long-lived singleton imported at module load, so the env
  // var must be read at emit time, not cached, or warnings that fire before
  // any setup (e.g. during config resolution) could never be suppressed.
  test("the env var is read live, set after the logger already exists", () => {
    expect(wasPrinted(WARNING_ID)).toBe(true);
    process.env[ENV_VAR] = WARNING_ID;
    expect(wasPrinted(WARNING_ID)).toBe(false);
  });

  test("a comma-separated env var suppresses each listed id", () => {
    process.env[ENV_VAR] = `${OTHER_ID}, ${WARNING_ID}`;
    expect(wasPrinted(WARNING_ID)).toBe(false);
    expect(wasPrinted(OTHER_ID)).toBe(false);
  });

  test("an unrelated env var id does not suppress the warning", () => {
    process.env[ENV_VAR] = OTHER_ID;
    expect(wasPrinted(WARNING_ID)).toBe(true);
  });

  test("the --suppress-warnings flag set unions with the env var", () => {
    process.env[ENV_VAR] = OTHER_ID;
    setSuppressWarnings([WARNING_ID]);
    expect(wasPrinted(WARNING_ID)).toBe(false);
    expect(wasPrinted(OTHER_ID)).toBe(false);
  });
});
