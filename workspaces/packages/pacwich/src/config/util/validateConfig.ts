import type { PacwichError } from "../../internal/core";
import type { AjvJsonSchemaErrorObject, AjvSchemaValidator } from "./ajvTypes";

const suffixAdditionalPropertyName = (error: AjvJsonSchemaErrorObject) => {
  return error.params?.additionalProperty
    ? ` (found "${error.params.additionalProperty}")`
    : "";
};

export const executeValidator = <Config extends object>(
  validator: AjvSchemaValidator<Config>,
  name: string,
  config: Config,
  ErrorType: typeof PacwichError,
) => {
  const isValid = validator(config);
  if (!isValid) {
    const multipleErrors = (validator.errors?.length ?? 0) > 1;
    throw new ErrorType(
      `${name.replace("Config", "")} config is invalid:${multipleErrors ? "\n" : ""}${validator.errors
        ?.map(
          (error) =>
            `${multipleErrors ? "  " : " "}${`config${
              error.instancePath
                ?.replace(/[/|\\](\d+)/g, "[$1]")
                .replaceAll(/[/|\\]/g, ".") ?? ""
            }`.replace(
              /^config[^.]/,
              "config.",
            )} ${error.message?.replace(/NOT/g, "not")}${suffixAdditionalPropertyName(error)}`,
        )
        .join("\n")}`,
    );
  }
};
