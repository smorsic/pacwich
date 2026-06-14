import { describe as vitestDescribe, test as vitestTest } from "vitest";
import { getActivePms, type PmFilter, type RegisteredPm } from "./pms";

export type PmMatrixContext = { pm: RegisteredPm };
export type PmMatrixBody = (context: PmMatrixContext) => void;

const runPmMatrix = (
  kind: "describe" | "test",
  name: string,
  filter: PmFilter,
  body: PmMatrixBody,
): void => {
  const pms = getActivePms(filter);
  if (pms.length === 0) {
    vitestDescribe.skip(`${name} [no matching pms]`, () => {
      // Capability filter excluded every registered pm — surface
      // as a skipped describe so the matrix is visible in test output.
    });
    return;
  }
  for (const pm of pms) {
    const labelled = `${name} [pm:${pm.id}]`;
    if (kind === "describe") {
      vitestDescribe(labelled, () => body({ pm }));
    } else {
      vitestTest(labelled, () => body({ pm }));
    }
  }
};

/**
 * Run a `describe` block once per active pm (after capability and
 * `PACWICH_TEST_PM` filtering). Use for adapter conformance and any
 * test surface that should run against every shipped pm.
 *
 * @example
 * describeEachPm("adapter loads root metadata", ({ pm }) => {
 *   test("returns workspace globs", () => { ... });
 * });
 *
 * @example
 * describeEachPm(
 *   "catalog resolution",
 *   { requires: ["catalogs"] },
 *   ({ pm }) => { ... },
 * );
 */
export function describeEachPm(name: string, body: PmMatrixBody): void;
export function describeEachPm(
  name: string,
  filter: PmFilter,
  body: PmMatrixBody,
): void;
export function describeEachPm(
  name: string,
  filterOrBody: PmFilter | PmMatrixBody,
  bodyMaybe?: PmMatrixBody,
): void {
  const [filter, body]: [PmFilter, PmMatrixBody] =
    typeof filterOrBody === "function"
      ? [{}, filterOrBody]
      : [filterOrBody, bodyMaybe as PmMatrixBody];
  runPmMatrix("describe", name, filter, body);
}
