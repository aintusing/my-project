# Team tasks

GitHub Issues define scope and acceptance; these files hold durable handoffs. Read [coordinator notes](coordinator.md), architecture, and decisions first. Base branch: **master**.

| Task | Agent | Issue | Allowed implementation file | Status | Branch | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [001: HTML contract](task-001.md) | claude-1 | [#2](https://github.com/aintusing/my-project/issues/2) | `index.html` | Existing implementation; recovery/validation pending | `agent/claude-1/2-counter-html` | [#5 closed, unmerged](https://github.com/aintusing/my-project/pull/5) |
| [002: Responsive styling](task-002.md) | claude-2 | [#3](https://github.com/aintusing/my-project/issues/3) | `style.css` | Waiting for coordination and #2 | `task/002-counter-css` | None |
| [003: Counter behavior](task-003.md) | claude-3 | [#4](https://github.com/aintusing/my-project/issues/4) | `script.js` | Waiting for coordination and #2 | `task/003-counter-js` | None |

Each developer may also edit its own task file. The coordinator owns this overview/shared notes; developers report changes on their Issues for reconciliation. Task files travel with task PRs; check the Issue/PR for live status before claiming work.

GitHub username mappings are unconfirmed; agent labels assign roles. `fckmeaning` has repository access, but no role is inferred. A third account has not been confirmed; repository access and task assignment are separate.

Merge coordination setup first, HTML second, then CSS/JS in either order. CSS and JS can run concurrently; #4 no longer waits for #3. Codex reviews all PRs and performs final integration validation without implementing feature code.
