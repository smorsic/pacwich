import {
  isTypeof,
  validateNumber,
  validateJSType,
  validateJSTypes,
  validateJSArray,
  InvalidJSTypeError,
  InvalidJSNumberError,
} from "../../../src/internal/core/language/types/typeof";
import { describe, test, expect } from "../../util/testFramework";

describe("isTypeof", () => {
  test("matches each JS typeof value", () => {
    expect(isTypeof("hello", "string")).toBe(true);
    expect(isTypeof(42, "number")).toBe(true);
    expect(isTypeof(true, "boolean")).toBe(true);
    expect(isTypeof(undefined, "undefined")).toBe(true);
    expect(isTypeof(42n, "bigint")).toBe(true);
    expect(isTypeof(() => {}, "function")).toBe(true);
    expect(isTypeof({}, "object")).toBe(true);
    expect(isTypeof(null, "object")).toBe(true);
    expect(isTypeof(Symbol(), "symbol")).toBe(true);
  });

  test("returns false for non-matching type", () => {
    expect(isTypeof("hello", "number")).toBe(false);
    expect(isTypeof(42, "string")).toBe(false);
    expect(isTypeof(null, "string")).toBe(false);
    expect(isTypeof(undefined, "object")).toBe(false);
  });

  test("accepts an array of types and returns true if any match", () => {
    expect(isTypeof("hello", "string", "number")).toBe(true);
    expect(isTypeof(42, "string", "number")).toBe(true);
    expect(isTypeof(true, "string", "number")).toBe(false);
    expect(isTypeof("hello", "string", "object")).toBe(true);
    expect(isTypeof(null, "string", "object")).toBe(true);
  });
});

describe("validateNumber", () => {
  test("returns null for a plain valid number", () => {
    expect(validateNumber(42, {})).toBeNull();
    expect(validateNumber(0, {})).toBeNull();
    expect(validateNumber(-1, {})).toBeNull();
    expect(validateNumber(3.14, {})).toBeNull();
  });

  test("noNaN: returns error for NaN, null for valid", () => {
    const error = validateNumber(NaN, { noNaN: true });
    expect(error).toBeInstanceOf(InvalidJSNumberError);
    expect(error?.message).toBe("Invalid number: Number cannot be NaN");
    expect(validateNumber(42, { noNaN: true })).toBeNull();
  });

  test("noNonFinite: returns error for NaN, Infinity, and -Infinity", () => {
    expect(validateNumber(NaN, { noNonFinite: true })).toBeInstanceOf(
      InvalidJSNumberError,
    );
    expect(validateNumber(NaN, { noNonFinite: true })?.message).toBe(
      "Invalid number: Number cannot be non-finite",
    );
    expect(validateNumber(Infinity, { noNonFinite: true })).toBeInstanceOf(
      InvalidJSNumberError,
    );
    expect(validateNumber(Infinity, { noNonFinite: true })?.message).toBe(
      "Invalid number: Number cannot be non-finite",
    );
    expect(validateNumber(-Infinity, { noNonFinite: true })).toBeInstanceOf(
      InvalidJSNumberError,
    );
    expect(validateNumber(-Infinity, { noNonFinite: true })?.message).toBe(
      "Invalid number: Number cannot be non-finite",
    );
    expect(validateNumber(42, { noNonFinite: true })).toBeNull();
  });

  test("noInfinity: returns error only for positive Infinity", () => {
    const error = validateNumber(Infinity, { noInfinity: true });
    expect(error).toBeInstanceOf(InvalidJSNumberError);
    expect(error?.message).toBe("Invalid number: Number cannot be Infinity");
    expect(validateNumber(-Infinity, { noInfinity: true })).toBeNull();
    expect(validateNumber(42, { noInfinity: true })).toBeNull();
  });

  test("noNegInfinity: returns error only for -Infinity", () => {
    const error = validateNumber(-Infinity, { noNegInfinity: true });
    expect(error).toBeInstanceOf(InvalidJSNumberError);
    expect(error?.message).toBe("Invalid number: Number cannot be -Infinity");
    expect(validateNumber(Infinity, { noNegInfinity: true })).toBeNull();
    expect(validateNumber(42, { noNegInfinity: true })).toBeNull();
  });

  test("noNaN takes precedence over noNonFinite for NaN", () => {
    const error = validateNumber(NaN, { noNaN: true, noNonFinite: true });
    expect(error).toBeInstanceOf(InvalidJSNumberError);
    expect(error?.message).toBe("Invalid number: Number cannot be NaN");
  });

  test("valueLabel is used in error message", () => {
    expect(validateNumber(NaN, { noNaN: true }, "myParam")?.message).toBe(
      "Invalid number: myParam cannot be NaN",
    );
    expect(
      validateNumber(Infinity, { noInfinity: true }, "myParam")?.message,
    ).toBe("Invalid number: myParam cannot be Infinity");
  });

  test("default valueLabel is 'Number'", () => {
    expect(validateNumber(NaN, { noNaN: true })?.message).toBe(
      "Invalid number: Number cannot be NaN",
    );
  });
});

describe("validateJSType", () => {
  test("returns null for each valid JS type", () => {
    expect(validateJSType({ value: "hello", typeofName: "string" })).toBeNull();
    expect(validateJSType({ value: 42, typeofName: "number" })).toBeNull();
    expect(validateJSType({ value: true, typeofName: "boolean" })).toBeNull();
    expect(
      validateJSType({ value: undefined, typeofName: "undefined" }),
    ).toBeNull();
    expect(validateJSType({ value: 42n, typeofName: "bigint" })).toBeNull();
    expect(
      validateJSType({ value: () => {}, typeofName: "function" }),
    ).toBeNull();
    expect(validateJSType({ value: {}, typeofName: "object" })).toBeNull();
    expect(
      validateJSType({ value: Symbol(), typeofName: "symbol" }),
    ).toBeNull();
  });

  test("returns InvalidJSTypeError for wrong type", () => {
    const error = validateJSType({ value: "hello", typeofName: "number" });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: Value expects type number, received string",
    );
  });

  test("returns InvalidJSTypeError for null even when type is 'object'", () => {
    const error = validateJSType({ value: null, typeofName: "object" });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe("Type error: Value cannot be null");
  });

  test("accepts an array of types", () => {
    expect(
      validateJSType({ value: "hello", typeofName: ["string", "number"] }),
    ).toBeNull();
    expect(
      validateJSType({ value: 42, typeofName: ["string", "number"] }),
    ).toBeNull();
    const error = validateJSType({
      value: true,
      typeofName: ["string", "number"],
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: Value expects type string | number, received boolean",
    );
  });

  test("applies numberRules when type is number", () => {
    const error = validateJSType({
      value: NaN,
      typeofName: "number",
      numberRules: { noNaN: true },
    });
    expect(error).toBeInstanceOf(InvalidJSNumberError);
    expect(error?.message).toBe("Invalid number: Number cannot be NaN");
    expect(
      validateJSType({
        value: 42,
        typeofName: "number",
        numberRules: { noNaN: true },
      }),
    ).toBeNull();
  });

  test("does not apply numberRules for non-number values that match type", () => {
    expect(
      validateJSType({
        value: "hello",
        typeofName: ["string", "number"],
        numberRules: { noNaN: true },
      }),
    ).toBeNull();
    expect(
      validateJSType({
        value: 42,
        typeofName: ["string", "number"],
        numberRules: { noNaN: true },
      }),
    ).toBeNull();
  });

  test("valueLabel is used in type mismatch error message", () => {
    const error = validateJSType({
      value: 42,
      typeofName: "string",
      valueLabel: "myOption",
    });
    expect(error?.message).toBe(
      "Type error: myOption expects type string, received number",
    );
  });

  test("valueLabel is used in null error message", () => {
    const error = validateJSType({
      value: null,
      typeofName: "object",
      valueLabel: "myOption",
    });
    expect(error?.message).toBe("Type error: myOption cannot be null");
  });

  test("valueLabel is used in number rules error message", () => {
    const error = validateJSType({
      value: NaN,
      typeofName: "number",
      numberRules: { noNaN: true },
      valueLabel: "myOption",
    });
    expect(error?.message).toBe("Invalid number: myOption cannot be NaN");
  });

  test("default valueLabel is 'Value'", () => {
    expect(validateJSType({ value: null, typeofName: "object" })?.message).toBe(
      "Type error: Value cannot be null",
    );
    expect(validateJSType({ value: 42, typeofName: "string" })?.message).toBe(
      "Type error: Value expects type string, received number",
    );
  });

  test("error name is 'InvalidJSType'", () => {
    expect(validateJSType({ value: 42, typeofName: "string" })?.name).toBe(
      "InvalidJSType",
    );
  });

  test("optional: true returns null for undefined", () => {
    expect(
      validateJSType({
        value: undefined,
        typeofName: "string",
        optional: true,
      }),
    ).toBeNull();
  });

  test("optional: true returns null for null", () => {
    expect(
      validateJSType({ value: null, typeofName: "string", optional: true }),
    ).toBeNull();
  });

  test("optional: true still validates present valid values", () => {
    expect(
      validateJSType({ value: "hello", typeofName: "string", optional: true }),
    ).toBeNull();
  });

  test("optional: true still validates present invalid values", () => {
    const error = validateJSType({
      value: 42,
      typeofName: "string",
      optional: true,
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: Value expects type string, received number",
    );
  });

  test("optional absent returns error for undefined", () => {
    const error = validateJSType({ value: undefined, typeofName: "string" });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
  });

  test("optional absent returns error for null", () => {
    const error = validateJSType({ value: null, typeofName: "object" });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
  });
});

describe("validateJSTypes", () => {
  test("returns null when all values are valid", () => {
    expect(
      validateJSTypes({
        myString: { value: "hello", typeofName: "string" },
        myNumber: { value: 42, typeofName: "number" },
        myBool: { value: true, typeofName: "boolean" },
      }),
    ).toBeNull();
  });

  test("returns a single error when one value is invalid", () => {
    const error = validateJSTypes({
      myParam: { value: 42, typeofName: "string" },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: myParam expects type string, received number",
    );
  });

  test("uses the config key as the valueLabel in error messages", () => {
    const error = validateJSTypes({
      mySpecificParam: { value: null, typeofName: "object" },
    });
    expect(error?.message).toBe("Type error: mySpecificParam cannot be null");
  });

  test("returns a combined error message when multiple values are invalid", () => {
    const error = validateJSTypes({
      firstName: { value: 42, typeofName: "string" },
      age: { value: null, typeofName: "object" },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type errors:\n - Type error: firstName expects type string, received number\n - Type error: age cannot be null",
    );
  });

  test("combined error name is 'InvalidJSType'", () => {
    const error = validateJSTypes({
      a: { value: 1, typeofName: "string" },
      b: { value: 2, typeofName: "boolean" },
    });
    expect(error?.name).toBe("InvalidJSType");
  });

  test("dispatches to validateJSArray when array: true", () => {
    expect(
      validateJSTypes({
        myList: { value: ["a", "b"], array: true },
      }),
    ).toBeNull();

    const error = validateJSTypes({
      myList: { value: "oops", array: true },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: myList expects an array, received string",
    );
  });

  test("array: true with itemOptions validates each item", () => {
    const error = validateJSTypes({
      myList: {
        value: ["a", 2],
        array: true,
        itemOptions: { typeofName: "string" },
      },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: myList[1] expects type string, received number",
    );
  });

  test("collects array and type errors into combined message", () => {
    const error = validateJSTypes({
      myString: { value: 42, typeofName: "string" },
      myList: { value: "oops", array: true },
    });
    expect(error?.message).toBe(
      "Type errors:\n - Type error: myString expects type string, received number\n - Type error: myList expects an array, received string",
    );
  });

  test("array: true with optional skips null/undefined", () => {
    expect(
      validateJSTypes({
        myList: { value: undefined, array: true, optional: true },
      }),
    ).toBeNull();
    expect(
      validateJSTypes({
        myList: { value: null, array: true, optional: true },
      }),
    ).toBeNull();
  });

  test("passes numberRules through to validateJSType", () => {
    const error = validateJSTypes({
      count: { value: NaN, typeofName: "number", numberRules: { noNaN: true } },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe("Invalid number: count cannot be NaN");
  });

  test("collects number rule errors alongside type errors in combined message", () => {
    const error = validateJSTypes({
      label: { value: 99, typeofName: "string" },
      count: { value: NaN, typeofName: "number", numberRules: { noNaN: true } },
    });
    expect(error?.message).toBe(
      "Type errors:\n - Type error: label expects type string, received number\n - Invalid number: count cannot be NaN",
    );
  });

  test("accepts an array of types per entry", () => {
    expect(
      validateJSTypes({
        myParam: { value: "hello", typeofName: ["string", "number"] },
        otherParam: { value: 42, typeofName: ["string", "number"] },
      }),
    ).toBeNull();
    const error = validateJSTypes({
      myParam: { value: true, typeofName: ["string", "number"] },
    });
    expect(error?.message).toBe(
      "Type error: myParam expects type string | number, received boolean",
    );
  });

  test("passes optional through to validateJSType", () => {
    expect(
      validateJSTypes({
        myParam: { value: undefined, typeofName: "string", optional: true },
      }),
    ).toBeNull();
    const error = validateJSTypes({
      myParam: { value: undefined, typeofName: "string" },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
  });

  test("{ throw: true } throws the error instead of returning it", () => {
    expect(() =>
      validateJSTypes(
        { myParam: { value: 42, typeofName: "string" } },
        { throw: true },
      ),
    ).toThrow(InvalidJSTypeError);
  });

  test("{ throw: true } returns null when there are no errors", () => {
    expect(
      validateJSTypes(
        { myParam: { value: "hello", typeofName: "string" } },
        { throw: true },
      ),
    ).toBeNull();
  });

  test("without throw option returns the error as before", () => {
    const error = validateJSTypes({
      myParam: { value: 42, typeofName: "string" },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
  });
});

describe("validateJSArray", () => {
  test("returns null for a valid array", () => {
    expect(validateJSArray({ value: ["a", "b"] })).toBeNull();
    expect(validateJSArray({ value: [] })).toBeNull();
    expect(validateJSArray({ value: [1, 2, 3] })).toBeNull();
  });

  test("returns error for non-array values", () => {
    expect(validateJSArray({ value: "hello" })).toBeInstanceOf(
      InvalidJSTypeError,
    );
    expect(validateJSArray({ value: 42 })).toBeInstanceOf(InvalidJSTypeError);
    expect(validateJSArray({ value: {} })).toBeInstanceOf(InvalidJSTypeError);
    expect(validateJSArray({ value: null })).toBeInstanceOf(InvalidJSTypeError);
    expect(validateJSArray({ value: undefined })).toBeInstanceOf(
      InvalidJSTypeError,
    );
  });

  test("error message includes received type", () => {
    expect(validateJSArray({ value: "hello" })?.message).toBe(
      "Type error: Value expects an array, received string",
    );
    expect(validateJSArray({ value: null })?.message).toBe(
      "Type error: Value expects an array, received null",
    );
    expect(validateJSArray({ value: 42 })?.message).toBe(
      "Type error: Value expects an array, received number",
    );
  });

  test("valueLabel is used in error message", () => {
    expect(
      validateJSArray({ value: "oops", valueLabel: "myParam" })?.message,
    ).toBe("Type error: myParam expects an array, received string");
  });

  test("optional: true returns null for undefined", () => {
    expect(validateJSArray({ value: undefined, optional: true })).toBeNull();
  });

  test("optional: true returns null for null", () => {
    expect(validateJSArray({ value: null, optional: true })).toBeNull();
  });

  test("optional: true still validates non-null non-array values", () => {
    expect(validateJSArray({ value: "hello", optional: true })).toBeInstanceOf(
      InvalidJSTypeError,
    );
  });

  test("validates item types when itemOptions provided", () => {
    expect(
      validateJSArray({
        value: ["a", "b", "c"],
        itemOptions: { typeofName: "string" },
      }),
    ).toBeNull();
    expect(
      validateJSArray({
        value: [1, 2, 3],
        itemOptions: { typeofName: "number" },
      }),
    ).toBeNull();
  });

  test("returns error for item type mismatch", () => {
    const error = validateJSArray({
      value: ["a", 2, "c"],
      itemOptions: { typeofName: "string" },
    });
    expect(error).toBeInstanceOf(InvalidJSTypeError);
    expect(error?.message).toBe(
      "Type error: Value[1] expects type string, received number",
    );
  });

  test("item error message uses valueLabel with index", () => {
    const error = validateJSArray({
      value: ["a", 2],
      valueLabel: "myList",
      itemOptions: { typeofName: "string" },
    });
    expect(error?.message).toBe(
      "Type error: myList[1] expects type string, received number",
    );
  });

  test("no itemOptions skips item validation", () => {
    expect(validateJSArray({ value: ["a", 2, true, null] })).toBeNull();
  });

  test("returns null for empty array regardless of itemOptions", () => {
    expect(
      validateJSArray({ value: [], itemOptions: { typeofName: "string" } }),
    ).toBeNull();
  });
});
