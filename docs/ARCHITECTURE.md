# Architecture
## What the system does
Radar shows crypto, memecoin and stock assets by sphere, marks what is significant,
interesting or dangerous with the reasons, and draws their links as a 3D graph.
## Main parts
| Folder | What it does | State |
| --- | --- | --- |
| `radar/`, `tests/` | Token checks, news, Telegram, SEC filings | Prototype exists |
| `catalog/` | Builds the source catalog, scores, spheres, graph page | Scripts exist; data is generated |
| `app/` | Full copy of worldmonitor (UI base) | Planned, R01 |
| `radar/api/`, `catalog/db/` | Local search and data API | Planned, R02 |
| `graph/` | Offline 3D graph module | Planned, R03 |
| `tasks/` | Assignments, dependencies, durable handoffs | Bootstrap #12 merged; R01/R02/R03 in progress; next audit/decision/demo-plan tasks prepared |
## How the parts talk to each other
Planned: catalog scripts produce files, SQLite indexes them, a local API on 127.0.0.1
serves the app. The API contract is written in `docs/API.md` and merged before UI work
depends on it.

Decision 0001 requires significant technical decisions to be recorded through PRs; the
product itself is described in decision 0002. The coordinator updates this document after
feature merges to reflect actual implementation.

## Team ownership
Main Codex (`agent:codex`) is the sole coordinator. Claude-1/2/3 and codex-4 are developers
with independent task branches and clone/worktrees. The roster and disjoint scopes live
in `tasks/README.md`; codex-4 is registered in `tasks/agents/codex-4.md`.
Its initial stock-source recovery changes the collector only, preserving CSV fields and
the proposed R02 API contract. No unfinished app, API, graph or scoring component is
declared integrated merely by registering an agent or running a trial integration.
