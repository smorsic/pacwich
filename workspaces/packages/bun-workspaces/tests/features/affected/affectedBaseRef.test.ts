import { afterEach, describe, expect, test } from "bun:test";
import { getUserEnvVarName } from "bw-common/config";
import { resolveDefaultAffectedBaseRef } from "../../../src/affected/affectedBaseRef";

const ENV_VAR = getUserEnvVarName("affectedBaseRefDefault");

describe("resolveDefaultAffectedBaseRef", () => {
  afterEach(() => {
    delete process.env[ENV_VAR];
  });

  test("returns the explicit value when provided", () => {
    expect(resolveDefaultAffectedBaseRef("develop")).toBe("develop");
  });

  test("explicit value takes precedence over env var", () => {
    process.env[ENV_VAR] = "from-env";
    expect(resolveDefaultAffectedBaseRef("develop")).toBe("develop");
  });

  test("falls back to env var when no value is provided", () => {
    process.env[ENV_VAR] = "from-env";
    expect(resolveDefaultAffectedBaseRef()).toBe("from-env");
  });

  test("falls back to env var when value is undefined", () => {
    process.env[ENV_VAR] = "from-env";
    expect(resolveDefaultAffectedBaseRef(undefined)).toBe("from-env");
  });

  test("falls back to 'main' when no value or env var is provided", () => {
    expect(resolveDefaultAffectedBaseRef()).toBe("main");
  });

  test("falls back to 'main' when value is empty string", () => {
    expect(resolveDefaultAffectedBaseRef("")).toBe("main");
  });

  test("falls back to 'main' when env var is empty string", () => {
    process.env[ENV_VAR] = "";
    expect(resolveDefaultAffectedBaseRef()).toBe("main");
  });
});
