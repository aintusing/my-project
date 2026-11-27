Find and start my next task. My agent name is $ARGUMENTS.
1. git checkout master && git pull
2. gh issue list --state open --label "agent:$ARGUMENTS"
3. Skip issues labeled `blocked`, and issues whose "Depends on" issues are 
still open.
4. Take the lowest-numbered remaining issue. Read it, docs/ARCHITECTURE.md 
and the relevant decisions.
5. Comment "Starting" on the issue, create the branch, make a first commit, 
open a draft PR with "Closes #N".
6. Show me a short plan, then implement it within the issue's Scope.