/**
 * `instanceof PacwichError` is unreliable in some circumstances: jiti+sucrase loads
 * `pacwich.project.ts`/`pacwich.workspace.ts` files in their own
 * module realm, so an `InvalidProjectConfig` thrown from inside a
 * user config is a *different* class than the one held by the
 * runtime that's catching it. Tag-based detection via this
 * `Symbol.for` symbol survives the realm split.
 */
export const PACWICH_ERROR_SYMBOL = Symbol.for("pacwich.error");

/** Type guard for {@link PacwichError} that works across realms. */
export const isPacwichError = (value: unknown): value is PacwichError =>
  typeof value === "object" &&
  value !== null &&
  (value as { [PACWICH_ERROR_SYMBOL]?: boolean })[PACWICH_ERROR_SYMBOL] ===
    true;

/**
 * Prefix a {@link PacwichError}'s message
 */
export const prefixPacwichErrorMessage = (
  error: unknown,
  prefix: string,
): unknown => {
  if (isPacwichError(error)) {
    error.message = `${prefix}: ${error.message}`;
  }
  return error;
};

/**
 * Base class for every error pacwich throws that is a subclass of Error.
 * Each feature's error classes (collected in `PACWICH_ERRORS`) extend this,
 * so a single `instanceof PacwichError` catch handles all of them.
 */
export class PacwichError extends Error {
  name = "PacwichError";
  // Realm-stable marker. See PACWICH_ERROR_MARKER docstring.
  readonly [PACWICH_ERROR_SYMBOL] = true as const;
}

/**
 * A registry of named error classes: a map of error-class name to its
 * constructor, every value extending {@link PacwichError}. Each grouped
 * entry of `PACWICH_ERRORS` is an `ErrorMap`.
 */
export type ErrorMap<ErrorName extends string = string> = {
  [name in ErrorName]: typeof PacwichError;
};

export function defineErrors<ErrorName extends string>(
  parentError: typeof PacwichError,
  ...errorNames: ErrorName[]
): ErrorMap<ErrorName>;
export function defineErrors<ErrorName extends string>(
  ...errorNames: ErrorName[]
): ErrorMap<ErrorName>;
export function defineErrors<ErrorName extends string>(
  ...[parentError, ...errorNames]: [
    typeof PacwichError | ErrorName,
    ...ErrorName[],
  ]
): ErrorMap<ErrorName> {
  let Parent = PacwichError;
  if (typeof parentError === "function") {
    Parent = parentError;
  } else {
    errorNames.unshift(parentError);
  }
  return errorNames.reduce((acc, error) => {
    acc[error] = class extends Parent {
      name = error;
    };

    // Override the class's display name (used in V8 stack frames and
    // `class.name`) so it reports the user's chosen error name rather
    // than "_class". Writable+configurable so downstream code that
    // re-tags errors (jiti, source-map libraries, etc.) doesn't blow
    // up trying to reassign `.name`.
    Object.defineProperty(acc[error], "name", {
      value: error,
      writable: true,
      configurable: true,
    });

    return acc;
  }, {} as ErrorMap<ErrorName>);
}
