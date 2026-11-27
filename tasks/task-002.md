# Task 002: Responsive counter styling

- Assigned agent: `claude-2` (member using Claude Code; GitHub username unconfirmed).
- GitHub Issue: [#3](https://github.com/aintusing/my-project/issues/3), label `agent:claude-2`.
- Goal: simple, centered, responsive presentation for the counter.
- Scope / allowed files: `style.css`, `tasks/task-002.md` only.
- Avoid: HTML, JS, other task files, shared docs/config, dependencies.
- Dependencies: coordination setup [#6](https://github.com/aintusing/my-project/issues/6) and HTML closing #2 merged into master.
- Status: assigned, waiting for dependencies; can run concurrently with task 003 afterward.
- Branch: `task/002-counter-css` (create from synchronized master when unblocked).
- Pull Request number: none yet.

## Implementation notes and acceptance
- Use merged `main`, `#counter`, and `#increment-button`; no required HTML changes or external dependencies.
- Center horizontally/vertically; provide readable typography, spacing, contrast, hover, and visible keyboard focus.
- Browser-check desktop/narrow mobile, no horizontal overflow, and Tab focus. Record actual results and `git diff --check`; no test runner/linter is configured.
- Decide CSS details independently. Report needed scope changes; do not touch JS/HTML or shared dependencies.
- Commit/push, open a draft PR into master with `Closes #3`, record its number here, then mark ready after validation. Report contract concerns to Codex.
