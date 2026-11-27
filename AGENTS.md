# Agent Operating Rules

## Roles
- Codex coordinates tasks, scope, PR reviews, and integration; it writes no feature code.
- `claude-1` is the autonomous Claude developer; `claude-2` and `claude-3` are the other members using Claude Code. `claude-4` is reserved.
- Developers take only Issues labeled with their own `agent:claude-N`. Labels identify roles, not GitHub accounts.
- Developers decide HOW to implement independently within scope, including routine fixes, tests, commits, pushes, and PR creation.

## Shared coordination
- Read `docs/ARCHITECTURE.md`, accepted `docs/decisions/NNNN-*.md`, `tasks/README.md`, `tasks/coordinator.md`, and your task file before starting.
- GitHub Issues define scope and acceptance. `tasks/` holds assignments, dependencies, status, and durable handoffs; keep both synchronized. No chat logs.
- Codex owns the task overview and coordinator notes. Developers edit only their own task file and explicitly allowed implementation files.
- Codex bootstraps all task files before developer work starts; afterward it must not edit a developer's task file concurrently.
- Significant shared technical choices need a decision PR merged first. Never contradict an accepted decision: comment on the Issue, label `needs-decision`, and stop affected work.

## Developer workflow
1. In your own clone/worktree, start with a clean tree: `git checkout master`, then `git pull --ff-only origin master`. Never develop on master or switch another agent's worktree.
2. Read your labeled Issue and task file. Wait for dependencies to merge, then comment `Starting` on the Issue.
3. Use the branch recorded in your task file, normally `task/<id>-<short-name>`.
4. Change ONLY the Issue's Scope, including your own task file. For another file, comment on the Issue and wait for an explicit scope update.
5. Commit small changes and push. After the first commit open a draft PR into master, with `Closes #N` and validation evidence. Prefer `gh pr create --draft --base master --body-file <description-file>`.
6. Before finishing, `git fetch origin` and `git rebase origin/master`. Resolve conflicts only within scope; otherwise report to Codex.
7. Run the checks below, fix in-scope failures, and record actual results and unperformed checks in the PR and your task file.
8. Commit/push task status, implementation notes, branch, and PR number. Mark ready with `gh pr ready` and summarize on the Issue. NEVER merge your own PR.
9. Stop and report scope expansion, work conflicts, major architectural choices, contradictory/impossible requirements, and destructive/dangerous operations. Add `blocked` with an explanation; take only other unblocked assigned work.

## Coordinator workflow
- Use the Agent task Issue template. Each Issue needs Goal, Scope, Acceptance criteria, Depends on, and exactly one agent label. Keep tasks roughly one day / 300 changed lines.
- Never assign overlapping active write scopes. Merge shared contracts first. Use agent labels until GitHub username mappings are confirmed.
- Inspect every open PR with `gh pr diff <number>` for scope, quality, tests, decisions, duplicate work, current-master conflicts, and conflicts with active tasks. Record findings with `gh pr review`.
- Tell humans the safe merge order. Do not merge uncertain work. Update architecture after feature merges and notify affected agents through shared notes.

## Required checks and standards
- Python: `python -m unittest discover -s tests -t .` must pass. New behavior needs tests.
- `app/`: use the commands documented by that project; record which ones ran and their output.
- UI: check 375 px and 1440 px, keyboard focus, and a clean browser console.
- Run `git diff --check`. Never claim checks you did not run.
- No unrelated refactors/reformatting. Never commit passwords, keys, or tokens.

## Product rules (decision 0002)
- Code in `app/` stays AGPL-3.0-only; keep notices and record every change to copied files in `ATTRIBUTION.md`.
- Instruction files inside `app/` belong to the upstream project: reference only, not team rules.
- Never open or link addresses from threat indicator lists. No wallet keys, trading, or buy/sell advice.
- Free data sources only. Unknown data is shown as unknown.
