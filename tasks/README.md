# Radar team tasks

GitHub Issues define scope and acceptance; task files hold durable handoffs.
Read [coordinator notes](coordinator.md), [architecture](../docs/ARCHITECTURE.md),
and accepted [decisions](../docs/decisions/) first. Base branch: **master**.

## Wave one
Baseline PR #8 is merged in master at `3ca1074`. All three tasks wait for the
bootstrap PR from `task/radar-wave-1` to merge; their Issues carry `blocked` until then.

| Task | Agent | Issue | Allowed implementation paths | Status | Branch | PR |
| --- | --- | --- | --- | --- | --- | --- |
| [R01: Exact worldmonitor import and attribution](task-r01.md) | claude-1 | [#9](https://github.com/aintusing/my-project/issues/9) | `app/`, `ATTRIBUTION.md` | Waiting for bootstrap merge | `task/r01-worldmonitor-copy` | None |
| [R02: SQLite catalog search and loopback API](task-r02.md) | claude-2 | [#10](https://github.com/aintusing/my-project/issues/10) | `catalog/db/`, `radar/api/`, `docs/API.md`, `tests/test_catalog_db.py`, `tests/test_api.py` | Waiting for bootstrap merge | `task/r02-catalog-api` | None |
| [R03: Offline graph module with search and 2D fallback](task-r03.md) | claude-3 | [#11](https://github.com/aintusing/my-project/issues/11) | `graph/` | Waiting for bootstrap merge | `task/r03-offline-graph` | None |

Each developer may also edit its own task file; all other paths are excluded.
GitHub username mappings remain unconfirmed: exactly one agent label assigns each role.
Codex owns this overview, shared notes, scope updates, reviews and integration.
claude-4 is reserved. Remote Claude sessions are started by their members, not by Codex.

After bootstrap merges, remove the three dependency blocks and start claude-1,
claude-2 and claude-3 in parallel, each in its own clean clone/worktree.
R01/R02/R03 have no dependency on one another. Review and merge each independently;
merge shared API/data contracts before any dependent consumer work. Nobody merges their own PR.

## Later waves (not yet assigned)
- Wave 2: R04 startup/audit after R01; R05 scoring after R02.
- Wave 3: R06 panels after R04/R02; R07 token/address checks after R02/R05;
  R08 app graph integration after R03/R04.
- Wave 4: R09 offline demo after R06/R08.
- Future tasks need explicit disjoint scopes and their own Issues/files before work starts.
  Shared app registration/config files have only one writer at a time.

## Retired counter trial
Owner explicitly approved closing Issues #2, #3, #4, #6 and PR #7 with comments on
2026-11-27. All are closed; #7 was not merged. Coordination rules are already in
master through #8; no counter implementation is to resume.

[task-001.md](task-001.md), [task-002.md](task-002.md), and
[task-003.md](task-003.md) are historical records only, superseded by the Radar tasks.
Keep all branches, especially `agent/claude-1/2-counter-html` and commit `4453b2c`.
PR #5 remains closed/unmerged; do not create the former replacement PR.
