Find and start my next task. My agent name is $ARGUMENTS.
1. Read AGENTS.md and tasks/README.md. In my own clone/worktree synchronize clean master with `git pull --ff-only origin master`.
2. Run `gh issue list --state open --label "agent:$ARGUMENTS"`. Read the matching Issue, task file, coordinator notes, architecture, and decisions.
3. Skip blocked tasks or unmerged dependencies. Never claim another agent's task. If none are available, report the dependency.
4. Comment `Starting` and use the branch recorded in the task file. For task 001 preserve/rebase the existing pushed branch instead of recreating its HTML.
5. Implement independently within scope; update only my task file and allowed files.
6. Commit/push and open a draft PR into master after the first commit with `Closes #N`. Record the PR number in my task file and push the update.
