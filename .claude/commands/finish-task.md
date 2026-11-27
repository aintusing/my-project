Finish the current task.
1. Fetch origin and rebase onto origin/master. Resolve conflicts only within scope; otherwise stop and report.
2. Run AGENTS.md and Issue checks; fix in-scope failures. Record actual browser results, commands, and limitations. Never claim unperformed checks passed.
3. Commit/push and create/update the PR into master with `Closes #N`, scope summary, tests, and handoff notes.
4. Record status, implementation notes, branch, and PR number in my task file; commit/push that update before marking ready.
5. Run `gh pr ready`, summarize on the Issue, and report cross-task effects for coordinator notes. Never merge my own PR.
