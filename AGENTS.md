# Agent Operating Rules (all agents)
## Team- codex: coordinator. Plans, assigns, reviews. Writes no feature code.- claude-1 ... claude-4: developers. Each works ONLY on issues labeled with 
its own `agent:claude-N`.
## Source of truth- Tasks and status live in GitHub Issues (`gh issue list`). Never create 
status or progress files in the repo.- Architecture: docs/ARCHITECTURE.md. Decisions: docs/decisions/NNNN-*.md.- Read both before any task. Never contradict an accepted decision. If one 
seems wrong,
comment on the issue, add the label `needs-decision`, and stop.
## Developer workflow
1. `git checkout master && git pull`
2. Take only an issue labeled with your agent name. Comment "Starting" on it.
3. Create a branch: `agent/claude-N/<issue number>-<short-name>`
4. After the first commit, open a DRAFT pull request: `gh pr create --draft --fill`. Its description contains `Closes #<issue number>`.
5. Change ONLY files listed under "Scope" in the issue. Need another file? 
Comment on the issue first and wait.
6. Commit small and often. Update from main at least daily: `git fetch && git 
rebase origin/master`.
7. Before finishing: run the tests and lint, update docs if behavior changed.
8. Mark the PR ready: `gh pr ready`. Comment a short summary on the issue. 
NEVER merge your own PR.
9. Blocked? Add the label `blocked`, explain why in a comment, and move to 
your next issue.
## Coordinator workflow (codex)- Split features into issues of at most about one day of work (about 300 
changed lines), using the Agent task form.- Every issue lists: Goal, Scope (files/folders), Acceptance criteria, 
Depends on, and one agent label.- Never give two open issues overlapping Scope. Shared contracts (API shapes, 
data schemas)
get their own decision file or issue that is merged FIRST.- Review PRs with `gh pr diff <number>`: check scope, tests, decisions. 
Comment with `gh pr review`.- Tell the humans the safe merge order. After merges, update 
docs/ARCHITECTURE.md if needed.
## Code standards- Test command: <fill in, e.g. npm test or pytest>- Lint command: <fill in, or "none">- New behavior needs tests. No unrelated refactors or reformatting.- Never put passwords, keys or tokens in code or commits.