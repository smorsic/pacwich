import { availableParallelism } from "os";
import { determineParallelMax } from "../../../../src/runScript/parallel";
import { expect, test, describe } from "../../../util/testFramework";

describe("Parallelism core logic", () => {
  test("determineParallelMax", () => {
    expect(determineParallelMax("auto")).toBe(availableParallelism());
    expect(determineParallelMax("unbounded")).toBe(Infinity);
    expect(determineParallelMax("25%")).toBe(
      Math.max(1, Math.floor((availableParallelism() * 25) / 100)),
    );
    expect(determineParallelMax("50%")).toBe(
      Math.max(1, Math.floor((availableParallelism() * 50) / 100)),
    );
    expect(determineParallelMax("100%")).toBe(availableParallelism());
    expect(determineParallelMax("0.0001%")).toBe(1);
    expect(determineParallelMax(10)).toBe(10);
    expect(() => determineParallelMax(0)).toThrow();
    expect(() => determineParallelMax(NaN)).toThrow();
    expect(() => determineParallelMax(-1)).toThrow();
    expect(() => determineParallelMax(-2)).toThrow();
    expect(() => determineParallelMax("101%")).toThrow();
    expect(() => determineParallelMax("0%")).toThrow();
    expect(() => determineParallelMax("-1%")).toThrow();
    // @ts-expect-error - Invalid parallel max value
    expect(() => determineParallelMax("wrong")).toThrow();
  });
});
