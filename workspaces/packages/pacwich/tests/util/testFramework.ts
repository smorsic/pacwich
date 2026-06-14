import { expect, test as vitestTest, vi, type TestAPI } from "vitest";

export {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

type BunTestOptions = {
  retry?: number;
  timeout?: number;
  repeats?: number;
};

type BunStyleTestCall = (
  name: string,
  fn: () => void | Promise<void>,
  options: BunTestOptions,
) => void;

type PatchedTest = TestAPI &
  BunStyleTestCall & {
    /** Bun `test.serial` — vitest already runs tests serially within a file, so alias to plain test. */
    serial: TestAPI;
    /** Bun `test.if(cond)` — runs the test only when cond is truthy. Vitest equivalent is runIf. */
    if: TestAPI["runIf"];
  };

const isBunStyleOptions = (value: unknown): value is BunTestOptions =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Function);

const patchedTest = ((...args: unknown[]) => {
  if (
    args.length === 3 &&
    typeof args[1] === "function" &&
    isBunStyleOptions(args[2])
  ) {
    return (vitestTest as (...a: unknown[]) => unknown)(
      args[0],
      args[2],
      args[1],
    );
  }
  return (vitestTest as (...a: unknown[]) => unknown)(...args);
}) as PatchedTest;

Object.setPrototypeOf(patchedTest, vitestTest);
for (const key of Reflect.ownKeys(vitestTest)) {
  if (key === "length" || key === "name" || key === "prototype") continue;
  Object.defineProperty(
    patchedTest,
    key,
    Object.getOwnPropertyDescriptor(vitestTest, key)!,
  );
}
patchedTest.serial = vitestTest;
patchedTest.if = vitestTest.runIf;

// Patch test.each to also accept the Bun-style (name, fn, opts) call signature.
const originalEach = vitestTest.each.bind(vitestTest) as TestAPI["each"];
patchedTest.each = ((table: unknown) => {
  const eachFn = (originalEach as (t: unknown) => (...a: unknown[]) => unknown)(
    table,
  );
  return ((...args: unknown[]) => {
    if (
      args.length === 3 &&
      typeof args[1] === "function" &&
      isBunStyleOptions(args[2])
    ) {
      return eachFn(args[0], args[2], args[1]);
    }
    return eachFn(...args);
  }) as never;
}) as TestAPI["each"];

export const test = patchedTest;

export const spyOn: typeof vi.spyOn = ((...args: Parameters<typeof vi.spyOn>) =>
  (vi.spyOn as (...a: unknown[]) => unknown)(...args)) as typeof vi.spyOn;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEmpty = (value: unknown): boolean => {
  if (typeof value === "string") return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Set || value instanceof Map) return value.size === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
};

expect.extend({
  toBeEmpty(received: unknown) {
    return {
      pass: isEmpty(received),
      message: () =>
        `expected ${JSON.stringify(received)} ${
          this.isNot ? "not " : ""
        }to be empty`,
    };
  },
  toBeArray(received: unknown) {
    return {
      pass: Array.isArray(received),
      message: () => `expected value ${this.isNot ? "not " : ""}to be an array`,
    };
  },
  toBeObject(received: unknown) {
    return {
      pass: isPlainObject(received),
      message: () =>
        `expected value ${this.isNot ? "not " : ""}to be a plain object`,
    };
  },
  toInclude(received: string, substring: string) {
    return {
      pass: typeof received === "string" && received.includes(substring),
      message: () =>
        `expected ${JSON.stringify(received)} ${
          this.isNot ? "not " : ""
        }to include ${JSON.stringify(substring)}`,
    };
  },
  toStartWith(received: string, prefix: string) {
    return {
      pass: typeof received === "string" && received.startsWith(prefix),
      message: () =>
        `expected ${JSON.stringify(received)} ${
          this.isNot ? "not " : ""
        }to start with ${JSON.stringify(prefix)}`,
    };
  },
});

interface BunStyleMatchers<R> {
  toBeEmpty(): R;
  toBeArray(): R;
  toBeObject(): R;
  toInclude(substring: string): R;
  toStartWith(prefix: string): R;
}

declare module "vitest" {
  // Merge into vitest's existing `Assertion<T>` declaration. Must be an
  // interface (declaration merging), not a type alias — vitest's own
  // `Assertion` is an interface and an alias here conflicts with it and
  // silently breaks the augmentation. Signature must match vitest's
  // own (no default for `T`). The eslint-disable below keeps the empty
  // interface form intact through `eslint --fix`, which would otherwise
  // collapse it back to a type alias and re-break the merge.
  // eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Assertion<T> extends BunStyleMatchers<void> {}
}
