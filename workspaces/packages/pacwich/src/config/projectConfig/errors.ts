import { defineErrors } from "../../internal/core";

/** Errors thrown when a project config (`pacwich.project.*` or the
 * `pacwich-project` package.json key) fails schema validation.
 * Subclass of {@link PacwichError}. */
export const PROJECT_CONFIG_ERRORS = defineErrors("InvalidProjectConfig");
