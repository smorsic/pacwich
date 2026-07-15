import { defineErrors } from "../../error";
import {
  resolveOptionalArray,
  type OptionalArray,
} from "../array/optionalArray";
import { type AnyFunction } from "./types";

/** Base class for invalid-JS-type errors thrown by pacwich's runtime
 * type validators. Subclass of {@link PacwichError}. */
export const InvalidJSTypeError = defineErrors("InvalidJSType").InvalidJSType;

/** Base class for invalid-JS-number errors thrown by pacwich's
 * runtime number validators. Subclass of {@link PacwichError}. */
export const InvalidJSNumberError =
  defineErrors("InvalidJSNumber").InvalidJSNumber;

/** Errors thrown by pacwich's runtime number validators (NaN, ±Infinity,
 * non-finite). All extend {@link InvalidJSNumberError}. */
export const VALIDATE_NUMBER_ERRORS = defineErrors(
  InvalidJSNumberError,
  "NoNaN",
  "NoNonFinite",
  "NoInfinity",
  "NoNegInfinity",
);

/** Errors thrown by pacwich's runtime `typeof` validators when an API
 * argument fails its expected shape. All extend
 * {@link InvalidJSTypeError}. */
export const VALIDATE_TYPEOF_ERRORS = defineErrors(
  InvalidJSTypeError,
  "NoNull",
  "InvalidType",
);

interface JSTypeofToTypeMap {
  string: string;
  number: number;
  boolean: boolean;
  undefined: undefined;
  bigint: bigint;
  function: (...args: unknown[]) => unknown;
  object: null | object;
  symbol: symbol;
}

export type JSDataTypeofName = keyof JSTypeofToTypeMap;

export type TypeToJSTypeofName<T> = {
  [K in keyof JSTypeofToTypeMap]: T extends AnyFunction
    ? "function"
    : T extends JSTypeofToTypeMap[K]
      ? K
      : never;
}[keyof JSTypeofToTypeMap];

export type JSTypeofNameToType<Name extends JSDataTypeofName> =
  JSTypeofToTypeMap[Name];

export type TypeToJSTypeof<T> = JSTypeofNameToType<TypeToJSTypeofName<T>>;

export const isTypeof = <T, D extends JSDataTypeofName>(
  value: T,
  ...types: D[]
): value is Extract<T, JSTypeofNameToType<D>> =>
  types.includes(typeof value as D);

export const isPlainObject = (value: unknown): value is object =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export type ValidateNumberRules = {
  noNaN?: boolean;
  noNonFinite?: boolean;
  noInfinity?: boolean;
  noNegInfinity?: boolean;
};

export type ValidateJSTypeOptions = {
  value: unknown;
  typeofName: OptionalArray<JSDataTypeofName>;
  /** For use in error message */
  valueLabel?: string;
  numberRules?: ValidateNumberRules;
  optional?: boolean;
};

export type ValidateJSTypesTypeEntry = Omit<
  ValidateJSTypeOptions,
  "valueLabel"
> & {
  array?: false;
};

export type ValidateJSTypesArrayEntry = Omit<
  ValidateJSArrayOptions,
  "valueLabel"
> & {
  array: true;
};

export type ValidateJSTypesConfigEntry =
  ValidateJSTypesTypeEntry | ValidateJSTypesArrayEntry;

export type ValidateJSTypesConfig = {
  [valueLabel: string]: ValidateJSTypesConfigEntry;
};

export const validateNumber = (
  value: number,
  rules: ValidateNumberRules,
  valueLabel = "Number",
): InstanceType<typeof InvalidJSNumberError> | null => {
  if (Number.isNaN(value) && rules?.noNaN) {
    return new InvalidJSNumberError(
      `Invalid number: ${valueLabel} cannot be NaN`,
    );
  } else if (!Number.isFinite(value) && rules?.noNonFinite) {
    return new InvalidJSNumberError(
      `Invalid number: ${valueLabel} cannot be non-finite`,
    );
  } else if (value === Infinity && rules?.noInfinity) {
    return new InvalidJSNumberError(
      `Invalid number: ${valueLabel} cannot be Infinity`,
    );
  } else if (value === -Infinity && rules?.noNegInfinity) {
    return new InvalidJSNumberError(
      `Invalid number: ${valueLabel} cannot be -Infinity`,
    );
  }
  return null;
};

export const validateJSType = ({
  value,
  typeofName,
  numberRules,
  valueLabel,
  optional,
}: ValidateJSTypeOptions): InstanceType<typeof InvalidJSTypeError> | null => {
  if (optional && (value === null || value === undefined)) return null;
  const typeofNames = resolveOptionalArray(typeofName);

  const isValid = isTypeof(value, ...typeofNames);
  if (isValid && typeof value === "number" && numberRules) {
    return validateNumber(value, numberRules, valueLabel);
  } else if (isValid && typeof value === "object" && value === null) {
    return new InvalidJSTypeError(
      `Type error: ${valueLabel ?? "Value"} cannot be null`,
    );
  } else if (!isValid) {
    return new InvalidJSTypeError(
      `Type error: ${valueLabel ?? "Value"} expects type ${typeofNames.join(" | ")}, received ${
        value === null ? "null" : typeof value
      }`,
    );
  }

  return null;
};

export type ValidateJSArrayOptions = {
  value: unknown;
  /** For use in error messages */
  valueLabel?: string;
  optional?: boolean;
  /** Options to validate each item in the array */
  itemOptions?: Omit<ValidateJSTypeOptions, "value" | "valueLabel">;
};

export const validateJSArray = ({
  value,
  valueLabel,
  optional,
  itemOptions,
}: ValidateJSArrayOptions): InstanceType<typeof InvalidJSTypeError> | null => {
  if (optional && (value === null || value === undefined)) return null;
  if (!Array.isArray(value)) {
    return new InvalidJSTypeError(
      `Type error: ${valueLabel ?? "Value"} expects an array, received ${value === null ? "null" : typeof value}`,
    );
  }
  if (itemOptions) {
    for (let i = 0; i < value.length; i++) {
      const itemError = validateJSType({
        ...itemOptions,
        value: value[i],
        valueLabel: `${valueLabel ?? "Value"}[${i}]`,
      });
      if (itemError) return itemError;
    }
  }
  return null;
};

export type ValidateJSTypesOptions = {
  throw?: boolean;
};

export const validateJSTypes = (
  config: ValidateJSTypesConfig,
  options?: ValidateJSTypesOptions,
): InstanceType<typeof InvalidJSTypeError> | null => {
  const errors: string[] = [];
  for (const [valueLabel, entry] of Object.entries(config)) {
    const error = entry.array
      ? validateJSArray({ ...entry, valueLabel })
      : validateJSType({ ...entry, valueLabel });
    if (error) {
      errors.push(error.message);
    }
  }
  if (errors.length === 0) return null;
  const result =
    errors.length === 1
      ? new InvalidJSTypeError(errors[0])
      : new InvalidJSTypeError(
          `Type errors:\n${errors.map((e) => ` - ${e}`).join("\n")}`,
        );
  if (options?.throw) throw result;
  return result;
};
