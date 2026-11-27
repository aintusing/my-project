# R02: SQLite catalog search and loopback API

Bootstrap: [PR #12](https://github.com/aintusing/my-project/pull/12) merged at `1419df4`.

- Assigned agent: `claude-2`; label `agent:claude-2`.
- GitHub Issue: [#10](https://github.com/aintusing/my-project/issues/10).
- Status: implementation, tests, docs/API.md and benchmark done; branch pushed, draft PR #22 open; rebased onto origin/master f77cd29 (no conflicts, backup branch `backup/r02-catalog-api-pre-rebase`), checks re-run (Ran 38 tests, OK; `git diff --check` clean), PR marked ready for review; do not self-merge.
- Branch: `task/r02-catalog-api` (create from synchronized master).
- Pull Request: [#22](https://github.com/aintusing/my-project/pull/22) (draft).
- Dependencies: Radar baseline PR #8 merged at `3ca1074`; wave-one bootstrap PR #12 merged; `blocked` removed by Codex.
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
Radar baseline is merged in PR #8 at master 3ca10744faaec7468d39b01bb593d5ee6c781a42. Wait for the wave-one bootstrap PR #12 (https://github.com/aintusing/my-project/pull/12; branch task/radar-wave-1) to merge into master before Starting; the task file must be available there.

## Agent
`agent:claude-2` (role label; GitHub username mapping unconfirmed).

## Workflow
Read AGENTS.md, docs/ARCHITECTURE.md, accepted decisions, tasks/README.md, tasks/coordinator.md and tasks/task-r02.md. Follow the clean own-worktree workflow, comment Starting only after dependencies merge, and use `task/r02-catalog-api`. Commit/push and open a draft PR into master after the first commit with Closes #<this Issue number>. Update your task file with status, actual checks, implementation notes, branch and PR number; push before marking ready and summarize on the Issue. Never merge your own PR.

Own the API contract in docs/API.md; merge it before R05/R06/R07 or other API consumers begin. A significant shared technical decision requires a decision PR merged first per 0001; comment needs-decision and pause affected work if necessary. Generated databases stay untracked; do not alter root .gitignore.

## Implementation notes and handoff
- `catalog/db/build.py`: imports `catalog/out/all_sources.csv` into SQLite (table `assets` + FTS5 `assets_fts` over name/symbol, prefix indexes). Empty cell -> NULL. Atomic rebuild via temp file; missing CSV -> exit code 2.
- `radar/api/search.py`: parameterized queries, user text reduced to quoted FTS words, input validation (`BadRequest`). `radar/api/server.py`: stdlib `http.server`, GET only, default host 127.0.0.1, DB opened read-only per request.
- Contract: `docs/API.md`. Consumers (R05/R06/R07) should rely on it once merged.
- Tests: `tests/test_catalog_db.py`, `tests/test_api.py` (12 new). `python -m unittest discover -s tests -t .` -> Ran 38 tests, OK. `git diff --check` clean.
- Environment: no Python was installed; installed Python 3.13 via winget (user scope) to run the suite.
- Windows note: the importer cannot replace a database file another process holds open; stop the server before rebuilding.
- Push was blocked by a pending collaborator invitation; after it was accepted the branch was pushed and draft PR #22 opened.
- Benchmark (target < 200 ms per search): measured the in-process `search()` call (no HTTP), 5 repetitions of each query after one warm-up, `time.perf_counter`. Query set: random first words of names and random symbols from the data, plus `bit`, `a`, `token`, `bitcoin`+kind filter, `usd`+flagged+limit 100, and a no-match query. Hardware: AMD64 Family 25 (12 logical CPUs), Windows 11, Python 3.13.17.
  - Real data: 12,274 records from `python catalog/build_catalog.py` run on 2026-11-27 (free public sources). 69 queries x 5: median 0.18 ms, p95 0.51 ms, max 4.78 ms.
  - Limitation: this is below the required 20,000 real records. In this run `catalog/out/stocks.csv` contained only the header (the earlier committed SUMMARY.md reported 20,264 records with 7,988 stocks); cause per the build log: the SEC company list request returned `HTTP Error 403: Forbidden` (the SEC list is the stocks source; the final run totalled 12,273 records, one fewer than benchmarked). Catalog scripts are out of R02 scope and were not changed; a catalog owner may need to fix the SEC request to reach 20,000+ real records.
  - Synthetic scale check: 20,500 records made by repeating the real rows with a numbered name suffix (generated fixture, NOT real assets, not committed). 76 queries x 5: median 0.22 ms, p95 0.81 ms, max 9.66 ms.
  - Both are far below 200 ms. Benchmark script lived in the scratchpad (outside allowed scope) and is not committed.
