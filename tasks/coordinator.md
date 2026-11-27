# Coordination notes

## Baseline and authority
- Inspected 2026-11-27: origin/master `cb6772a`, default branch master, Issues #2/#3/#4 open, no open PRs. PR #5 is closed/unmerged with no explanation in its comments/reviews.
- The user's latest instructions authorize tasks/ and replace the old prohibition on status files. This setup aligns AGENTS.md and Claude commands.
- Coordination Issue: [#6](https://github.com/aintusing/my-project/issues/6), branch `task/000-team-coordination`. Merge its PR before developers update task files or rely on revised assignments.
- The inspected checkout held claude-1's clean pushed commit `4453b2c`; master was in another worktree. Coordination uses a separate branch from fetched origin/master. Do not switch another agent's worktree.

## Ownership and handoffs
- claude-1: HTML and task-001.md; claude-2: CSS and task-002.md; claude-3: JS and task-003.md.
- Codex owns shared coordination docs, Issue scope/labels, PR review, merge planning, and integration validation. No feature code.
- No overlapping developer write scopes. No package setup, dependencies, backend, persistence, or extra features are assigned.
- Developers update only their task file; report cross-task effects on their Issue for coordinator reconciliation.
- Remote Claude sessions are not launched or monitored by this checkout. Each member starts its session with the assigned identity and reads the published tasks.

## HTML recovery and contract
- Preserve branch `agent/claude-1/2-counter-html` and commit `4453b2c`; do not duplicate existing HTML.
- claude-1 creates a replacement PR from the existing branch after rebasing, referencing closed #5 and closing #2. Leave #5 closed as historical context; this assignment authorizes publishing the replacement.
- Existing HTML satisfies the markup contract. Author reported headless Edge DOM validation; visual rendering and Tab focus are unverified. Missing CSS/JS is expected until those tasks merge.
- Pending contract: `main`, `#counter` initially `0` with `aria-live="polite"`, native `#increment-button`, `./style.css`, deferred `./script.js`. Merge #2 before dependent implementation.

## Review and integration
- No open PRs at inspection. Inspected #5 diff/review: no blocking code finding, incomplete browser validation. Closed PR remains closed.
- Merge coordination, then HTML closing #2; #3/#4 may then run concurrently and merge in either order.
- Review every PR for scope, tests, decisions, duplicate work, master conflicts, and effects on active tasks. Do not merge uncertain work.
- No configured test runner/linter/CI. Follow AGENTS.md browser checks, JS syntax validation, and whitespace checks; report unavailable checks honestly.
- After both assets merge, check clicks, keyboard, reload, responsive layout, focus, asset loading, and console errors together; update architecture to reflect merged code.
