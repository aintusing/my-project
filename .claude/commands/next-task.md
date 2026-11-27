Find and start my next task. My agent name is $ARGUMENTS.
1. Read AGENTS.md and tasks/README.md. In my own clean clone/worktree fetch origin. Synchronize available master with `git pull --ff-only origin master`; if master belongs to another worktree, start the assigned branch from fetched origin/master without switching that worktree.
2. Run `gh issue list --state open --label "agent:$ARGUMENTS"`. Read the matching Issue, task file, coordinator notes, architecture, and decisions.
3. Skip blocked tasks or unmerged dependencies. Never claim another agent's task. If none are available, report the dependency.
4. Comment `Starting` only after dependencies merge and use the branch recorded in the task file. Do not resume retired counter tasks. Use your own clean clone/worktree; if master is held elsewhere, branch from fetched origin/master without switching another worktree.
5. Implement independently within scope; update only my task file and allowed files.
6. Commit/push and open a draft PR into master after the first commit with `Closes #N`. Record the PR number in my task file and push the update.
