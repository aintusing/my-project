# R03: Offline graph module with search and 2D fallback

Bootstrap: [PR #12](https://github.com/aintusing/my-project/pull/12), branch task/radar-wave-1. Wait for merge before starting implementation.

- Assigned agent: `claude-3`; label `agent:claude-3`.
- GitHub Issue: [#11](https://github.com/aintusing/my-project/issues/11).
- Status: one PR #13 reviewed in four blocks (coordinator decision); draft until the merge gates close.
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
Coordinator decision (2026-11-27): one PR #13, sequential review of A core, B Earth/data,
C events/sources, D analysis; merge only as a whole. The earlier split #18/#19 is cancelled and is
not a dependency. Full scope is `graph/` (blocks listed in the claude-3 comment on head `00b0ca5`)
plus this file. The owner's chat requests behind it: globe and flat map, real data, events,
worldmonitor layers, analysis, calmer design, product name Money Bansho.

Checks (Windows 11, Intel UHD, built-in browser, pixel ratio 1.5):
- `cd graph && node --test` on the committed test files: 59 passed.
- `python -m unittest discover -s tests -t .`: 26 passed. Fresh clone with `core.autocrlf=true`: 59 passed.
- FPS at 1440x900: synthetic 3D graph 5000 nodes / 9959 links 74.3 (10 s, links only for the selection
  above 2000 nodes); globe with 15451 nodes and events 54.1 (8 s).
- Console and CSP: fresh tab, all four views, five panel tabs, three color modes: no console messages,
  no page errors, no CSP violations, all requests local.
- Contrast (computed text/background ratio, 1084 text elements per theme): night min 5.24, paper min 5.2,
  no failures. Moss reported one pressed view button at 2.71 during a color transition; its settled
  colors are dark text on ivory.
- Keyboard (real key presses): 70 Tab stops all visible with a focus outline; view switch, map pan and
  zoom, opening a card, back button and layer panel toggle work. Map markers are selected through search
  and lists, not directly.
- WebGL disabled (stubbed `getContext`): globe, map and scheme work, the 3D graph tab is absent.
- 375 px and 1440 px: no horizontal scroll.

Open merge gates:
- Physical network disconnect test (not performed: would change system settings).
- Redistribution rights for DefiLlama, CoinGecko, Nasdaq, publisher headlines, military base and other
  worldmonitor datasets. Needs a coordinator/owner decision: confirm, or drop them from the snapshot.
- Rebase on `origin/master` before marking ready.
- China/Europe sources requested by the owner are outside the approved scope; not committed.

### Owner requests after head 66dbde1
Relayed by the owner: the coordinator allowed these. Please record it in Issue #11.
Added: candle charts with explanations, readable 3D graph and scheme, lighter globe redraws,
China/Europe events. `node --test` on graph files: 72 passed. Globe benchmark while moving at
1440x900: 30.9 FPS; no redraws while idle. Redistribution rights for Binance candles and the new
China/Europe sources are unverified (same open merge gate).
