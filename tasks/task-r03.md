# R03: Offline graph module with search and 2D fallback

Bootstrap: [PR #12](https://github.com/aintusing/my-project/pull/12), branch task/radar-wave-1. Wait for merge before starting implementation.

- Assigned agent: `claude-3`; label `agent:claude-3`.
- GitHub Issue: [#11](https://github.com/aintusing/my-project/issues/11).
- Status: implemented, PR #13 draft; waiting for the coordinator to split the scope before ready.
- Branch: `task/r03-offline-graph` (create from synchronized master).
- Pull Request: [#13](https://github.com/aintusing/my-project/pull/13), draft.
- Dependencies: #8 and bootstrap #12 merged (`1419df4`).
- Ownership: Codex bootstraps this file; after bootstrap merges only claude-3 updates it.

## Goal
Build a standalone reusable graph module with filters, search with camera flight, neighbor inspection and a usable 2D fallback, without a runtime CDN dependency.

## Scope
- graph/ (module, local dependencies, tests, demo fixture and README)
- tasks/task-r03.md
- Everything else is out of scope. Each developer owns only this task file and the listed implementation paths.

## Acceptance criteria
- Support sphere/group filtering, name search with camera flight to the chosen node, and selection showing adjacent nodes/links. Document a module data interface and selection callback for later R08 integration.
- Load all JS, styles, fonts and graph input locally. Reuse 3d-force-graph 1.80.3 (MIT) as the baseline; preserve dependency notices and record pinned provenance under graph/. No CDN or network calls during operation.
- Demonstrate 5,000 nodes, measure FPS with a documented procedure, duration, hardware/browser and node/link counts; target 30+ FPS. Report the actual result and limitations rather than assuming success.
- Offer a usable 2D fallback when WebGL is unavailable, with search, filters and neighbor inspection. Check 375 px and 1440 px, keyboard focus and clean browser console.
- Verify with the network disabled. Clearly label synthetic performance fixtures; do not invent real asset facts. Escape external strings; threat-indicator addresses are never opened or clickable.
- Keep new handwritten implementation around 300 changed lines; local pinned vendor bundles are identified separately with provenance. If more handwritten work is necessary, request a task split. Keep tests and validation tools under graph/.
- Run the graph checks documented by the module, python -m unittest discover -s tests -t . and git diff --check. Record actual output, UI/offline/performance evidence and unperformed checks.

## Depends on
Radar baseline is merged in PR #8 at master 3ca10744faaec7468d39b01bb593d5ee6c781a42. Wait for the wave-one bootstrap PR #12 (https://github.com/aintusing/my-project/pull/12; branch task/radar-wave-1) to merge into master before Starting; the task file must be available there.

## Agent
`agent:claude-3` (role label; GitHub username mapping unconfirmed).

## Workflow
Read AGENTS.md, docs/ARCHITECTURE.md, accepted decisions, tasks/README.md, tasks/coordinator.md and tasks/task-r03.md. Follow the clean own-worktree workflow, comment Starting only after dependencies merge, and use `task/r03-offline-graph`. Commit/push and open a draft PR into master after the first commit with Closes #<this Issue number>. Update your task file with status, actual checks, implementation notes, branch and PR number; push before marking ready and summarize on the Issue. Never merge your own PR.

Read catalog/build_graph.py as reference only; do not modify catalog/, app/, radar/, root dependencies/config or other task files. R03 has no dependency on R01 or R02: document its standalone interface locally; API wiring and app integration wait for later R08.

## Implementation notes and handoff
The owner extended the task in chat: Earth globe and flat map, real data, events, worldmonitor layers,
analysis, calmer design, product name Money Bansho. All code stays under `graph/`.

Checks run on 2026-11-27 (Windows 11, Intel UHD, built-in browser, pixel ratio 1.5):
- `cd graph && npm test`: 59 passed. `python -m unittest discover -s tests -t .`: 26 passed.
- FPS at 1440x900: synthetic 3D graph, 5000 nodes / 9959 links, 74.3 (10 s, links drawn only for the
  selection above 2000 nodes); globe with the 15451-node snapshot and events, 54.1 (8 s).
- 375 px and 1440 px: no horizontal scroll. No page errors in the scripted walkthrough. Missing optional
  event files produce 404 messages in the console.
- All requested resources were local; CSP has `connect-src 'none'`.

Not performed: physically disabling the network, a full keyboard walkthrough, contrast measurement,
a rerun of the WebGL-unavailable check after the globe was added.

Open points: redistribution terms of DefiLlama, CoinGecko, Nasdaq, news headlines and some worldmonitor
datasets are unverified. SEC filing events are absent: SEC refused requests without contact details.
