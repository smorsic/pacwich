import type { RootConfig } from "bw-common/config";
import type { FromSchema, JSONSchema } from "json-schema-to-ts";

export const ROOT_CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    defaults: {
      type: "object",
      additionalProperties: false,
      properties: {
        parallelMax: {
          type: ["number", "string"],
        },
        shell: {
          type: "string",
        },
        includeRootWorkspace: {
          type: "boolean",
        },
        affectedBaseRef: {
          type: "string",
        },
      },
    },
    workspacePatternConfigs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["patterns", "config"],
        properties: {
          patterns: {
            type: "array",
            items: { type: "string" },
          },
          // config may be a WorkspaceConfig object or a factory function (TS/JS configs only).
          // Object form is validated separately via validateWorkspaceConfig after AJV.
          config: {},
        },
      },
    },
  },
} as const satisfies JSONSchema;

type _ValidateRootConfig<T extends FromSchema<typeof ROOT_CONFIG_JSON_SCHEMA>> =
  T extends FromSchema<typeof ROOT_CONFIG_JSON_SCHEMA> ? T : never;

let _validateSchemaType: _ValidateRootConfig<RootConfig>;
