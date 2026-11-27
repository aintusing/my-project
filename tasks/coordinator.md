# Radar coordination notes

Bootstrap: [PR #12](https://github.com/aintusing/my-project/pull/12), branch task/radar-wave-1. Wait for merge before starting implementation.

## Authority and baseline
- Inspected 2026-11-27: fetched origin/master is `3ca10744faaec7468d39b01bb593d5ee6c781a42`,
  Radar adoption PR #8. Verified AGENTS.md, architecture, accepted decisions 0001/0002,
  Python prototype, catalog scripts and the Agent task template are present in master.
- Codex coordinates and writes no feature code. The owner explicitly authorized
  closing counter Issues #2/#3/#4/#6 and PR #7 with comments while preserving branches.
- All five are now closed; #7 is unmerged. Its complete diff was inspected with
  `gh pr diff 7`; findings were posted with `gh pr review 7 --comment`.
  Rules/template/bootstrap are already incorporated by #8; merging #7 would restore
  obsolete counter architecture and instructions contrary to accepted decision 0002.
- Existing `tasks/task-001.md` through `task-003.md` are retained as retired history.
  The previous HTML recovery/replacement PR instructions are cancelled.
  Keep every branch and commit `4453b2c`; no branch deletion was requested or performed.
- Work is on separate coordinator branch `task/radar-wave-1` based on fetched master.
  Another worktree holds master; it was not switched. Existing untracked `my-project/`
  is unrelated and excluded from this change.

## Assignments and ownership
- R01 [#9](https://github.com/aintusing/my-project/issues/9), claude-1:
  `app/`, `ATTRIBUTION.md`, `tasks/task-r01.md`.
- R02 [#10](https://github.com/aintusing/my-project/issues/10), claude-2:
  `catalog/db/`, `radar/api/`, `docs/API.md`, `tests/test_catalog_db.py`,
  `tests/test_api.py`, `tasks/task-r02.md`.
- R03 [#11](https://github.com/aintusing/my-project/issues/11), claude-3:
  `graph/`, `tasks/task-r03.md`. No dependency on R01/R02.
- Issues use exactly one agent role label each; account mappings are unconfirmed.
  Implementation paths and task-file ownership are disjoint. No active developer
  was writing a new task file during bootstrap.
- All three are blocked only until this bootstrap PR merges into master.
  After that merge Codex removes `blocked`; members launch their Claude sessions in
  parallel and comment Starting. Codex does not launch substitute Codex developers.
- Bootstrap ownership ends on merge: developers then edit only their own task file
  and Issue scope. Codex reconciles shared notes without concurrent task-file edits.

## Review, dependencies and merge order
1. A human reviews and merges the wave-one bootstrap PR; its author does not merge it.
2. Start R01/R02/R03 concurrently. Each goes through a draft PR, actual checks,
   rebase on current origin/master, Codex review and human merge.
   They may merge in any order because their write scopes are disjoint.
3. R01 unlocks R04; R02 unlocks R05. Merge documented API/data contracts before
   consumer work. Significant shared technical choices need a decision PR merged first.
4. Later: R06 after R04/R02, R07 after R02/R05, R08 after R03/R04;
   R09 after R06/R08. Later Issues are not yet assigned. Serialize shared app files.
- R01 is an exact import exception to 300 lines; compare tracked paths/counts and
  contents at full upstream SHA resolved from 055a1fd. Preserve AGPL notices.
  Upstream instructions are reference only; R04 audits startup and branding before presentation.
- R02 owns API documentation and its tests; do not modify catalog source scripts or
  scoring here. R03 owns a standalone local graph interface and performance evidence;
  R08 later integrates it. Clearly label synthetic benchmark inputs.
- Review every open feature PR with `gh pr diff` for scope, tests, decisions,
  duplication, master conflicts and active assignments; record via `gh pr review`.
  Do not merge uncertain work. Update architecture after actual feature merges.
- Free sources only; unknown data stays unknown; no keys/trading/advice.
  Never open or link threat-indicator addresses. Retain source license and provenance.

## Planning and validation
- Hackathon name/deadline/rules/jury criteria were requested once; awaiting details.
  Use a provisional 48-hour plan. At 70% elapsed (33 h 36 min) stop new feature
  assignments and focus on stability/demo. Actual deadline supersedes this assumption.
  If supplied rules prohibit prewritten code, stop and report.
- This bootstrap changes coordination documents only. No feature/UI/startup/offline/FPS
  checks were run; those are assigned explicitly to the relevant developers.
- `python -m unittest discover -s tests -t .` could not execute: sandbox access to
  python.exe failed; an approved retry outside the sandbox returned exit 1 with
  "Python". Get-Command resolves Python to the WindowsApps execution alias.
  No passing test claim is made; rerun with a working interpreter before feature merges.
- Whitespace, task/Issue metadata, disjoint scopes and remote-state validation are
  recorded in the bootstrap PR. No feature has been merged during this first move.
