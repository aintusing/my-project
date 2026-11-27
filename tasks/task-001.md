> RETIRED 2026-11-27 by explicit owner approval. Counter Issues #2/#3/#4/#6 and PR #7 are closed; Radar decision 0002 supersedes this assignment. Historical instructions below are inactive: do not resume work or open a replacement PR. All branches are preserved. See tasks/README.md for current assignments.

# Task 001: Finish and integrate the HTML contract

- Assigned agent: `claude-1` (autonomous Claude; GitHub username unconfirmed).
- GitHub Issue: [#2](https://github.com/aintusing/my-project/issues/2), label `agent:claude-1`.
- Goal: validate and publish existing counter markup for dependent agents.
- Scope / allowed files: `index.html`, `tasks/task-001.md` only.
- Avoid: CSS, JS, other task files, shared docs/config, dependencies.
- Dependencies: coordination setup [#6](https://github.com/aintusing/my-project/issues/6) merged into master first.
- Status: HTML committed/pushed; PR closed/unmerged; recovery and browser checks pending.
- Branch: `agent/claude-1/2-counter-html` (existing branch retained).
- Pull Request: [#5](https://github.com/aintusing/my-project/pull/5), CLOSED/UNMERGED; replacement PR not yet opened.

## Implementation notes and acceptance
- Preserve commit `4453b2c`; fetch/rebase the existing branch after coordination merges. Do not recreate the HTML.
- Follow Issue #2 criteria; keep `main`, `#counter`, `#increment-button`, and linked asset paths stable.
- Create a replacement PR from the existing branch after rebasing. Reference #5 and close #2; leave #5 closed. The coordinator authorizes this replacement as part of task recovery.
- Prior evidence: author reported headless Edge DOM rendering; coordinator inspected complete diff. Browser appearance and Tab focus remain unverified.
- Complete browser validation and `git diff --check`; missing CSS/JS is expected. No test runner or linter exists.
- Commit/push task updates, publish the PR into master, record its number, and mark ready after checks. Report contract changes before making them; dependent agents wait for #2 to merge.
