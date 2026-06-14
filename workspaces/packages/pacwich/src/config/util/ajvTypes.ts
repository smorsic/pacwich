// Types for AJV-generated JSON schema validators

export type AjvJsonSchemaErrorObject = {
  instancePath?: string;
  schemaPath?: string;
  keyword?: string;
  params?: Record<string, unknown>;
  message?: string;
};

export type AjvSchemaValidator<T = unknown> = ((data: unknown) => data is T) & {
  errors?: AjvJsonSchemaErrorObject[] | null;
};
