> RETIRED 2026-11-27 by explicit owner approval. Counter Issues #2/#3/#4/#6 and PR #7 are closed; Radar decision 0002 supersedes this assignment. Historical instructions below are inactive: do not resume work or open a replacement PR. All branches are preserved. See tasks/README.md for current assignments.

# Task 003: Counter increment behavior

- Assigned agent: `claude-3` (member using Claude Code; GitHub username unconfirmed).
- GitHub Issue: [#4](https://github.com/aintusing/my-project/issues/4), label `agent:claude-3`.
- Goal: increment once for each native button activation.
- Scope / allowed files: `script.js`, `tasks/task-003.md` only.
- Avoid: HTML, CSS, other task files, shared docs/config, dependencies.
- Dependencies: coordination setup [#6](https://github.com/aintusing/my-project/issues/6) and HTML closing #2 merged into master. No dependency on #3.
- Status: assigned, waiting for dependencies; can run concurrently with task 002 afterward.
- Branch: `task/003-counter-js` (create from synchronized master when unblocked).
- Pull Request number: none yet.

## Implementation notes and acceptance
- Use `#counter`, `#increment-button`, native click events, and `textContent`. Initial zero; reload resets. No persistence/dependencies.
- Browser tests: fresh `0`, one click `1`, ten total clicks `10`, Enter/Space each increment once per activation, reload `0`, no JS console errors.
- Run `node --check script.js` and `git diff --check`; record actual outputs and browser results. Syntax validation alone is not a behavior test.
- CSS may be absent while #3 proceeds; do not compensate with HTML/CSS edits or claim final integration passed. Codex checks both assets after #3/#4 merge.
- Commit/push, open a draft PR into master with `Closes #4`, record its number here, then mark ready after checks. Report contract concerns before changing scope.
