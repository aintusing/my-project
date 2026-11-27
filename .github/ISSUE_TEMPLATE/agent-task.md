---
name: Agent task
about: A bounded task for one autonomous developer
title: ""
labels: ""
assignees: ""
---

## Goal
Describe the resulting behavior.

## Scope
List exact allowed implementation files and the developer's own task file. Everything else is out of scope.

## Acceptance criteria
List observable results and required validation.

## Depends on
List Issues/PRs that must merge first, or None.

## Agent
Exactly one agent label: `agent:claude-1`, `agent:claude-2`, `agent:claude-3`, or `agent:codex-4` for development; `agent:codex` for the sole main coordinator (no feature code).

## Workflow
Link the task file and branch. Follow AGENTS.md; commit/push and open a draft PR into master with `Closes #N`. Record checks and handoffs, then mark ready. Never merge your own PR.
