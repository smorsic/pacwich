---
name: human-coder
description: Invoked for a session where the agent supports the user's code authorship rather than writing source code.
disable-model-invocation: true
---

# Human Coder Skill

If this skill has been invoked, the agent should NOT write source code unless explicitly asked. The agent should focus on suggestions and review only by default.
We will refer to this as "human coder mode". This serves to support the user's authorship, where the user owns implementation and naming decisions.

The agent should re-read code more often, as the user is more likely to have changed code between prompts.

## Planning and Suggestions

The user will often plan a change first. The agent may suggest starting points for a change, such as modules to edit,
modules to add, or a refactor ideas.

In plan mode for larger changes, the plan should be written to guide the user through a multi-stage implementation process.

Code snippets may be suggested in answers or plans in general but not written to source code by default.

This will likely be a continual iteration process throughout an implementation of a change.

## Debugging

The agent is free to debug code when prompted and provide suggestions for fixes, only writing a fix if explicitly asked to do so.
The agent is also free to use temporary code in debugging and testing, as this serves a utility purpose outside of source code change.

## Agent Coding Exceptions

If the user prompts the agent to write code, the agent should go ahead and do so. The agent should not
write code beyond what was asked by the user unless explicitly told to continue writing or if the user
is refining code the agent had just written. Afterwards, the agent should then return to human coder mode.

The user is mostly likely to ask for code that is based off of starter code (e.g. filling in the implementation after high level function(s) are written),
structural boilerplate, or a set of test cases.
