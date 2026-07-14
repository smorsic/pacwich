---
name: agent-qa
description: Instructions for agentic validation of pacwich by interacting with real monorepos against documentation.
---

# Agent QA

This is a guide for performing manual QA of pacwich.

The user may specify scopes for the validation:

- Features to cover
  - "All" or freeform input
  - Features may be scoped by layers (CLI/API/config/AI doc features/etc.) or named features
- Documentation to read
  - AGENTS.md (should already be in context from CLAUDE.md link)
  - Documentation website
  - TSDoc for the API (not read if API not in scope)
  - README.md (purposefully not full reference)
- Runtimes to test with
  - Only use one: Node or Bun
  - To use Bun: use the Bun global install for the CLI or run `bunx pacwich` and run API scripts via `bun` directly
- Package managers to test with
  - Bun, npm, or pnpm
- Installation source
  - Only use one: local build or published npm package (see sandbox.sh below)

If the user doesn't provide adequate scope in the initial prompt, give them a question set to get their input
in a way that must allow for their freeform notes added to selected answers. "Only test the CLI and use full
scope otherwise with the local build" should be sufficient without further input, since it covers all cases.

## Rules

### Act as an end user only

Do **NOT** read source code or code from `node_modules`, including documentation source files. You are an end user only. Report bugs or issues
**without** diagnosing in the source. Documentation should be accessed like an end user.

Other agents will have the build version of the package only, not this source monorepo. Reading source code
is a **failure** to perform this skill. We have documentation precisely because do not want users (including agents)
to need to read GitHub source code or node_modules to have a successful development experience.

#### Referencing documentation

The existing AGENTS.md in context suffices, as this is how it would be provided to an end user's agent.

The documentation website is accessed by reading from https://pacwich.dev/llms.txt
and looking up pages from its manifest.

The README.md file found here can simply be read directly as an exception to the source code rules.

TSDoc instructions found below.

### Use only sandboxed shells via `scripts/sandbox.sh`

We want to use some kind of sandbox to run changes. For this, the local `scripts/sandbox.sh` is included in this shell.

Go ahead and read this file to understand the mechanisms.

Usage:

```bash
sandbox.sh — isolated global-install sandbox for pacwich spec verification.
Usage:
  sandbox.sh setup [npm|bun|pnpm] [npm|local|<other>]  # build sandbox + global install
  sandbox.sh run  <cmd...>                          # run any command inside it
  sandbox.sh install [project-dir]                  # local-install pacwich for the API
  sandbox.sh tsdoc [project-dir]                    # dump installed pacwich TSDoc
  sandbox.sh env                                    # print sandbox paths
  sandbox.sh teardown                               # remove it
```

The first `setup` arg is the package manager under test. The second is the install source
from the scope: `local` (the local build at `workspaces/packages/pacwich/dist`, requires
`bun pw build` first) or `npm` (the published package). Whichever you pick is used for both
the global install and any later `install` (local), so all installs test the same artifact.
Use exactly one source per run, matching the chosen scope.

Use the `teardown` command to clean up the sandbox, and always do this when you're done.

## Scaffolding

You will need to scaffold test monorepos. You should make real frontend and backend apps with:

- straightforward stacks/frameworks
- minimal deps as possible but still some real ones, sticking to major ones like `react`, `eslint`, etc., since having them is good for features involving external dep versions like inputs

### Passes

Make at least a brief pass at these types of setups (basic conformance with core features from each layer, not entire spec for each)

- A nested monorepo (two lockfile and native workspace config levels), where behavior is expected to work within the scope of the closest root
- A messy multi-pm setup (multiple lockfiles, multiple pacwich config file types (e.g. typescript + json + package.json),
  strange config choices)
- A very large monorepo (many workspaces)
- A monorepo more geared to include its root package as a workspace
- A monorepo that's been mock poisoned in some way. Only test for injection surfaces for security review. You **must** only use benign code.
  E.g. confirming shell injection with a simple "echo hello" script. Scripts still run with full user permissions.

## Full Verification

The full verification is ran against a standard test monorepo that you should feel free to mutate to see the effects of having 0, 1, 2+ workspaces
and so on, using a sane variety.

This is not necessarily an exhaustive list of checks, as the true exhaustive list is the documentation source itself,
but a guide of notes major sections of the verification.

### CLI

#### Installation

Ensure the global CLI behaves as expected. Confirm it works without a local installation and delegates
to a local installation (it's okay to mutate node_modules to force a version diff here).

It's also okay to verify the runtime being used by console logging the `Bun` global in the entrypoint in
node_modules/pacwich/src/index.js. Simply append to the file so that you don't need to read it and remove
the line confirming. Besides these two exceptions, still do not touch or read node_modules directly.

Note: `PACWICH_DISABLE_LOCAL_DELEGATION` may be set to `true` by default in this repo. Ensure
this is unset or set to `false` to test the global CLI delegation behavior.

#### Commands

Verify each command as it appears in the doc. Then cross-verify that the CLI usage is covered
and is also sane.

Commands that only have subcommands may not be included as commands in the documentation,
since they generally just exit with code 1 and help text.

### API

The API needs a local install. Run `sandbox.sh install [project-dir]` to install pacwich
(the source chosen at setup) into a project, then exercise the API from there.

Similarly verify API similarly to CLI, following what is documented first and then
inspecting real objects and the like (including modules) for undocumented methods or properties that
don't seem simply weakly private (e.g. no leading underscore).

#### TSDoc

Access TSDoc via `sandbox.sh tsdoc <project-dir>`, where `<project-dir>` is a project with
pacwich installed locally (defaults to the sandbox work dir). This dumps the installed build's
TSDoc so you get it like an end user's editor would, without reading source.

### Configuration

Use every kind of available configuration file (ts/js/json/jsonc) and option, using each form each option accepts.

### Errors

Go with the grain and against the grain of all interfaces, using features in a variety of incorrect
or unconventional/unexpected ways.

If an error or warning message seems potentially misleading or unhelpful to users (e.g. workspaces or
files causing some issue not being clearly listed in the error message or a seemingly
inaccurate message), report this.

## Summary output

Create a markdown report of the verification results, including any issues found and recommendations for improvement.

This is essentially a full QA breakdown. Group by severity first. Bugs should read as full bug reports with steps
to reproduce, expected behavior, and actual behavior, etc.

Findings that aren't neatly categorized as bugs can be included in a general loosely structured findings section
after bug reports.
