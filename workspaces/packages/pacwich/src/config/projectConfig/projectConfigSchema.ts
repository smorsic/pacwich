import type { ProjectConfig } from "@pacwich/common/config";
import {
  OUTPUT_STYLE_VALUES,
  PACKAGE_MANAGER_VALUES,
} from "@pacwich/common/parameters";
import type { FromSchema, JSONSchema } from "json-schema-to-ts";

export const PROJECT_CONFIG_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    packageManager: {
      type: "string",
      enum: PACKAGE_MANAGER_VALUES,
    },
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
        cliScriptOutputStyle: {
          type: "string",
          enum: OUTPUT_STYLE_VALUES,
        },
        suppressWarnings: {
          type: "array",
          items: { type: "string" },
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
    verify: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceDependencies: {
          type: "object",
          additionalProperties: false,
          properties: {
            ignoreInputFiles: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const satisfies JSONSchema;

type _ValidateProjectConfig<
  T extends FromSchema<typeof PROJECT_CONFIG_JSON_SCHEMA>,
> = T extends FromSchema<typeof PROJECT_CONFIG_JSON_SCHEMA> ? T : never;

let _validateSchemaType: _ValidateProjectConfig<ProjectConfig>;
