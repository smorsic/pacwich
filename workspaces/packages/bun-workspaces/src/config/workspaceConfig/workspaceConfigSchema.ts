import type { WorkspaceConfig } from "bw-common/config";
import type { JSONSchema, FromSchema } from "json-schema-to-ts";

const WORKSPACE_INPUTS_CONFIG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    files: {
      type: "array",
      items: { type: "string" },
    },
    workspacePatterns: {
      type: "array",
      items: { type: "string" },
    },
    externalDependencies: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const satisfies JSONSchema;

export const WORKSPACE_CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    alias: {
      type: ["string", "array"],
      items: { type: "string" },
      uniqueItems: true,
    },
    tags: {
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
    },
    scripts: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          order: {
            type: "number",
          },
          inputs: WORKSPACE_INPUTS_CONFIG_SCHEMA,
        },
        additionalProperties: false,
      },
    },
    rules: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceDependencies: {
          type: "object",
          properties: {
            allowPatterns: {
              type: "array",
              items: { type: "string" },
            },
            denyPatterns: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      },
    },
    defaultInputs: WORKSPACE_INPUTS_CONFIG_SCHEMA,
  },
} as const satisfies JSONSchema;

type _ValidateWorkspaceConfig<
  T extends FromSchema<typeof WORKSPACE_CONFIG_JSON_SCHEMA>,
> = T extends FromSchema<typeof WORKSPACE_CONFIG_JSON_SCHEMA> ? T : never;

let _validateSchemaType: _ValidateWorkspaceConfig<WorkspaceConfig>;
