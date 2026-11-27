# R02: SQLite catalog search and loopback API

- Assigned agent: `claude-2`; label `agent:claude-2`.
- GitHub Issue: [#10](https://github.com/aintusing/my-project/issues/10).
- Status: blocked until the wave-one bootstrap PR is merged; not started.
- Branch: `task/r02-catalog-api` (create from synchronized master).
- Pull Request: none yet.
- Dependencies: Radar baseline PR #8 merged at `3ca1074`; wave-one bootstrap PR pending.
- Ownership: Codex bootstraps this file; after bootstrap merges only claude-2 updates it.

## Goal
Index the existing crypto and stock catalog in SQLite with full-text search and expose a documented read-only local API bound to 127.0.0.1.

## Scope
- catalog/db/
- radar/api/
- docs/API.md
- tests/test_catalog_db.py
- tests/test_api.py
- tasks/task-r02.md
- Everything else is out of scope. Each developer owns only this task file and the listed implementation paths.

## Acceptance criteria
- Provide a reproducible import command consuming the existing catalog CSV files, without modifying catalog/build_catalog.py, catalog/spheres.py or generated catalog/out/ data. Document missing-input handling and rebuilding the database.
- Search by name and symbol using SQLite full-text search; preserve available asset kind, sphere, source and score/flag fields. Unknown values remain unknown. No scoring-v2 redesign or token-scan endpoints.
- Bind only to 127.0.0.1 by default; parameterize SQL queries and validate user input. Document launch/import commands, request parameters, response fields, empty/error responses, pagination and available filters in docs/API.md.
- Measure search latency on at least 20,000 records: report actual count, input provenance, hardware, query set, measurement method and results; target below 200 ms per measured search. Do not present generated benchmark fixtures as real assets. If source data is unavailable, report that limitation explicitly.
- Add meaningful tests in the two allowed test files for import/search, empty and invalid input, SQL-injection handling and HTTP contract. Run python -m unittest discover -s tests -t . and git diff --check; record actual output.
- Keep the implementation around 300 changed lines; report a necessary split before exceeding scope. No new paid dependency, shared root config, UI edits or external network requirement during search.

## Depends on
Radar baseline is merged in PR #8 at master 3ca10744faaec7468d39b01bb593d5ee6c781a42. Wait for the wave-one bootstrap PR (branch task/radar-wave-1) to merge into master before Starting; the task file must be available there.

## Agent
`agent:claude-2` (role label; GitHub username mapping unconfirmed).

## Workflow
Read AGENTS.md, docs/ARCHITECTURE.md, accepted decisions, tasks/README.md, tasks/coordinator.md and tasks/task-r02.md. Follow the clean own-worktree workflow, comment Starting only after dependencies merge, and use `task/r02-catalog-api`. Commit/push and open a draft PR into master after the first commit with Closes #<this Issue number>. Update your task file with status, actual checks, implementation notes, branch and PR number; push before marking ready and summarize on the Issue. Never merge your own PR.

Own the API contract in docs/API.md; merge it before R05/R06/R07 or other API consumers begin. A significant shared technical decision requires a decision PR merged first per 0001; comment needs-decision and pause affected work if necessary. Generated databases stay untracked; do not alter root .gitignore.

## Implementation notes and handoff
Not started. Record actual commands/results, limitations, implementation choices and downstream handoff here when working. GitHub Issue scope is authoritative; request explicit scope changes before editing other paths.
