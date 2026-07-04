---
name: release
description: Use when user is ready to release a new version of pacwich. Use
this to help track tasks for the user to complete.
---

# Release

This is a skill that is performed after changes have are ready to be released.
Keep track of the listed tasks below as a checklist for the user. At this point,
source code changes and documentation have been completed, the `doc-updates`
skill already providing similar tasks for documentation performed before this.

Many of these tasks are simply for the user to confirm completion,
since there aren't necessarily repo changes to review.

The user may specify that some of these tasks were already completed
before using the skill. Simply mark these tasks as already done.

## Tasks

- Ensure CI is passing on the `main` branch
- Ensure version is bumped in pacwich's `package.json`
  - `bun install` must be ran to ensure `bun.lock` and generated docs (README.md etc.) are updated (should be committed + pushed)
- Run and approve the publish workflow
- After successful publish, use `bun install` again and push to ensure updated `bun.lock` for CI
- Create a release tag with change notes (pre-made URL present in publish workflow summary)
- Deploy documentation website to production
- Maybe: deploy blog post for noteworthy release
  - User will generally note upfront if this is needed, so assume it is unnecessary (usually not for most releases)
