## pacwich Contributing development

Most work happens in the workspace at `workspaces/packages/pacwich`, the main npm package source. This is the assumed default location for development. `workspaces/libraries/pacwich-common` is the shared library for common utilities/data, e.g. between the main package
and documentation website.

The next most commonly developed workspace is `workspaces/web/documentation-website`, the documentation website.

Useful development commands (all from root dir, no need to cd into workspaces, generally
are using pacwich themselves under the hood):

- Format via prettier: `bun format`
- Run all lint scripts: `bun lint`
- `bun pw [script] -- [...args]` runs one of pacwich's workspace scripts (other commands similarly available)
  - Run tests against src directly via Bun: `bun pw test`
  - Run a test that matches a pattern (vitest args accepted): `bun pw test -- myFilePattern`
  - Build with rslib: `bun pw build`
  - Build the test-friendly dist (`dist.test/`): `bun pw build-for-tests`
  - Run tests against the dist.test build via Node: `bun pw test:build:node`
- `bun docs [script]` runs one of the documentation website's scripts
  - Build the documentation website: `bun docs build` (or `bun docs build:dev` for development build)
- Try to lean on root-based scripts like above instead of cd'ing into workspaces (unless necessary) and use the pacwich CLI itself for this repo (can help test the CLI itself)

## Coding style

TypeScript is written in a generally functional/procedural style. Patterns in general in this project should remain fairly consistent but are not dogmatic, as will be explained below.

Class-based patterns are seen but are not the default, such as the `Project` class, which encapsulates composable operations, since context of most of pacwich's functionality depends on the state of a given project. Classes are still abstracted away, such as how `Project`s are usually instantiated via `createFileSystemProject()`.

The `Workspace` objects are a plain JSON-serializable objects to prevent complex class structures and maintain a functional-like style that generally separates process from data within the project context. Many generic utilities on top of workspaces are written as plain functions and then incorporated into a `Project`'s implementation details.

### Packaging

Feature packaging is preferred over layer packaging. The `src/internal/` directory leans more towards layer packaging for generic utilities.

Module directories often contain an `index.ts` that simply uses `export *` for all files and subdirectories. However, `src/index.ts` defines the public-facing API, so this is where exports must be defined only explicitly.

Do not import from `@pacwich/common` without a subpath like `@pacwich/common/cli` within pacwich's src/.

### Naming and language features

Variable names are camelCase and longer descriptive names are preferred over abbreviations. Functions should generally use a verb. Booleans read as a question, often using `is` or `has` prefix etc. SCREAMING_SNAKE_CASE is used for top-level constants and environment variables.

Arrow functions are preferred, and a single object parameter is generally preferred over multiple parameters. Inline types are not encouraged, with a preference of a named type for object parameters and return types, so that these types can be reused and potentially exported.

Object destructuring is encouraged.

Don't use TypeScript `enum`s but prefer plain objects.

### Style example:

This example shows some common patterns used when a set of accepted values is needed. The main idea here is that the structure of this code is DRY and self-validating, since the `MyValue` type is inferred directly from the concrete `MY_VALUES` array, which is the one source of truth for both the type and runtime values. The `MY_BEHAVIOR_MAP` ensures each value has a handler when this type of branched logic is needed instead of using `switch`. Other modules importing from this can use the parameter and return types for `handleMyValue` as needed when composing logic.

```typescript
export const MY_VALUES = ["a", "b", "c"] as const;

export type MyValue = (typeof MY_VALUES)[number];

/** Description of the purpose of the options */
export type MyFunctionOptions = {
  /** The value to handle */
  value: MyValue;
  /** An optional flag */
  isSomething?: boolean;
};

/** Description of the purpose of the result */
export type MyFunctionResult = {
  /** Whether the operation was successful */
  success: boolean;
};

const MY_BEHAVIOR_MAP: Record<
  MyValue,
  (options: MyFunctionOptions) => MyFunctionResult
> = {
  a: ({ isSomething }) => {
    console.log("a", isSomething);
    return { success: true };
  },
  b: ({ isSomething }) => {
    console.log("b", isSomething);
    return { success: true };
  },
  c: ({ isSomething }) => {
    console.log("c", isSomething);
    return { success: true };
  },
};

/** Description of the purpose of the function */
export const handleSomething = (options: MyFunctionOptions): MyFunctionResult =>
  MY_BEHAVIOR_MAP[options.value](options);

// Example usage
const { success } = handleSomething({ value: "a", isSomething: true });
```

### Comments

#### Public Exports

Any public export is encouraged to have TSDoc for about every possible target (types, properties of types, functions, etc.).

Don't use TSDoc tags that are already inferred by TS (e.g. params, which should generally be in a parameter object that has
its own TSDoc for itself and its properties).

Functions and methods should have at least a minimal `@example` that covers parameters, and types used as parameters and return types
may benefit from a brief example too, like an example object of values.

#### Internal Code

Prefer descriptive code with minimal comments, but they are still encouraged to add clarity,
explain reasoning (especially for something unconventional, hacky, or otherwise surprising),
and provide light structure.

Comments should be kept brief and add context that isn't immediately
inferrable by the code naming underneath it (e.g. no "// This runs a script across workspaces"
over `function runScriptAcrossWorkspaces`.) Structural comments (e.g headings for grouping etc.)
should also be minimal, more useful in grouping meaningful chunks of lengthy repetition and
especially long flat spans of code, but are not as encouraged if the code's nesting/naming would
provide the same structure/meaning already.

Avoid em dashes and prose semicolons in general.

VSCode settings encourage the "Better Comments" extension for highlighted comments.
However, prefer TSDoc `@todo` over `TODO`.

### Security Considerations

- External strings (e.g. from package.json, pacwich config files, cli/api input, etc.)
  - If added to a shell command string such as via interpolation, use available shell-quote library to sanitize (note that pacwich often uses temp script files instead of plain argv to execute subprocesses)
  - If used in CLI output, strip ANSI/control codes to prevent terminal display manipulation (minor exceptions for allowed ANSI in workspace script output etc.)
  - If used in subprocess argv like how affected feature git commands are constructed, prevent injections like CLI flags (e.g. how the `--base` option is processed)
- Temp files and similar: prevent TOCTOU vulnerabilities by using atomic file operations or proper locking mechanisms.
- Executable config files (`pacwich.project.{ts,js}`, `pacwich.workspace.{ts,js}`) are evaluated via jiti by default. The `--disable-executable-configs` CLI flag and `disableExecutableConfigs` factory option (defaulting on for the `mcp-server` command) restrict loading to `.jsonc`/`.json` and the `package.json` `pacwich-*` keys for untrusted contexts.
- GitHub actions
  - External actions versions must be SHA-pinned (dev should likely look up latest version)
  - Install dependencies with `--frozen-lockfile` and `--ignore-scripts` if possible
  - Publish/deploy workflows should use the `pacwich--prod` environment
  - Workflows should generally simply avoid instances where a fork's code is checked out in the base repo's security context, especially on trigger (e.g. `pull_request_target`)
- Note that this is not an exhaustive list. Since this is a public package that has supply chain exposure, security considerations should be high priority.

### Testing practices

Except when unreasonably complex to test, generally speaking, all feature additions and fixes should include tests. This means that all CLI commands and their options that can be passed should be verified.

Testing both and API feature and the CLI version of it is necessary to ensure that arguments etc. are handled correctly in both places. It may often make sense to do the most exhaustive behavior testing on the API and then ensure the CLI passes all options correctly to this API more simply, but without making too much assumption that the CLI "must be fine" just because the API does.

Sometimes important internals (like the generic `runScripts` function) are tested to ensure the core logic driving features work, even if they aren't exposed publicly, which can help with diagnosing issues and making more focused logic tests that require less boilerplate/setup.

#### Test cases

Test cases should be written at the very minimum for the following:

- CLI feature:
  - At least one case per form of command (e.g. if short form is provided)
  - At least one case per positional or flag option, again with at least one per arg/option form
  - If option takes specific values, one case per value, and at least one case of an unsupported value error
  - If option takes multiple types (e.g. number or freeform string), one per type, and at least one for an invalid type
  - Any command strings that would result in a CLI-specific error for the feature
  - When many options/args possible, the different combinations of how these could be passed together

- API feature:
  - Similar to CLI: at least one case per arg/option, cases per arg value and/or type, cases per invalid arg, and cases for combinations of args/options
  - Cases for errors thrown when args/options are passed that violate a TS type are only needed for public APIs (internal utilities can rely on source TS compile check, while public surface could be used by JS package user)

- Other (general):
  - Array-like arguments/options: cases for empty array, single item array, multi-item array (2 and more). When items can be multiple types, similar cases for different types and combinations of different types
  - Cases using real test projects that change behavior or surface potential edge cases
  - There don't need to necessarily be combinations/permutations of every single case requirement described here, just enough for confidence in each situation.
  - Since most features are developed in the API followed by the CLI acting as a wrapper over the API, the API surface can be used to put a feature through the wringer the most, while the CLI should be as complete as described above but can be tested just to the point of confirmation of successful API passthrough of all options.

tests/packageManagers/pmMatrix should likely be added to regularly to help ensure conformance across adapters. The project/ tests inside here
should hit all Project properties/methods across the matrix of pms, and the adapter/ tests help ensure the internal adapter is consistent.

### Change Workflow

- General implementation precedence for each applicable surface: core utilities (if needed) -> config changes (if needed) -> public API -> CLI wrapper around API
- Each above stage should include tests before moving on
- Whether the above stages are planned or implemented separately, in combination, or in smaller chunks of each will be case-by-case depending on complexity
- When implementing a plan that involves multiple concerns, pause for a commit between each if not instructed to commit yourself
- If a new set of errors is defined via `defineErrors`, include this in the public exports (`src/errorExports.ts`)

<!--End pacwich development-->
