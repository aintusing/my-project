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
| `tasks/` | Assignments, dependencies, durable handoffs | Still describes the old counter until Codex updates it |
## How the parts talk to each other
Planned: catalog scripts produce files, SQLite indexes them, a local API on 127.0.0.1
serves the app. The API contract is written in `docs/API.md` and merged before UI work
depends on it.

Decision 0001 requires significant technical decisions to be recorded through PRs; the
product itself is described in decision 0002. The coordinator updates this document after
feature merges to reflect actual implementation.
