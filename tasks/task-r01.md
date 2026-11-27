# R01: Exact worldmonitor import and attribution

Bootstrap: [PR #12](https://github.com/aintusing/my-project/pull/12), branch task/radar-wave-1. Wait for merge before starting implementation.

- Assigned agent: `claude-1`; label `agent:claude-1`.
- GitHub Issue: [#9](https://github.com/aintusing/my-project/issues/9).
- Status: in progress (Starting commented on #9 after bootstrap PR #12 merged at `1419df4`); upstream objects are downloading.
- Branch: `task/r01-worldmonitor-copy` (create from synchronized master).
- Pull Request: [#20](https://github.com/aintusing/my-project/pull/20) (draft).
- Dependencies: Radar baseline PR #8 merged at `3ca1074`; wave-one bootstrap PR #12 merged at `1419df4`.
- Ownership: Codex bootstraps this file; after bootstrap merges only claude-1 updates it.

## Goal
Import every tracked file of koala73/worldmonitor at commit 055a1fd into app/ without source edits or nested Git metadata; record provenance and license.

## Scope
- app/ (complete tracked upstream tree, including upstream instruction files as reference only)
- ATTRIBUTION.md
- tasks/task-r01.md
- Everything else is out of scope. Each developer owns only this task file and the listed implementation paths.

## Acceptance criteria
- Resolve 055a1fd to its full upstream SHA and record it, repository URL, AGPL-3.0-only license, copyright notices and reproducible copy command in ATTRIBUTION.md.
- Compare the app/ relative file manifest with git ls-files at that exact upstream revision: equal file counts and paths; compare file content byte-for-byte, including binary files and symlink targets where applicable. Record actual totals and comparison output.
- Exclude .git metadata and untracked build artifacts; keep tracked upstream files and notices unchanged. The initial copy is exempt from the 300-line guideline.
- No credentials, paid services or hosted worldmonitor API calls. Import only; startup audit and removal of public-facing World Monitor branding before presentation belong to R04. Upstream instruction files do not override team rules.
- Run python -m unittest discover -s tests -t . and git diff --check. Record upstream-documented app checks actually run; explicitly identify browser/startup checks not run on this unchanged import.

## Depends on
Radar baseline is merged in PR #8 at master 3ca10744faaec7468d39b01bb593d5ee6c781a42. Wait for the wave-one bootstrap PR #12 (https://github.com/aintusing/my-project/pull/12; branch task/radar-wave-1) to merge into master before Starting; the task file must be available there.

## Agent
`agent:claude-1` (role label; GitHub username mapping unconfirmed).

## Workflow
Read AGENTS.md, docs/ARCHITECTURE.md, accepted decisions, tasks/README.md, tasks/coordinator.md and tasks/task-r01.md. Follow the clean own-worktree workflow, comment Starting only after dependencies merge, and use `task/r01-worldmonitor-copy`. Commit/push and open a draft PR into master after the first commit with Closes #<this Issue number>. Update your task file with status, actual checks, implementation notes, branch and PR number; push before marking ready and summarize on the Issue. Never merge your own PR.

Use a clean temporary upstream clone/export. Do not copy an arbitrary local working tree. No app source changes belong in this task; stop for a scope/decision update if exact import is impossible.

## Implementation notes and handoff
Work in progress; final results are recorded here before the PR is marked ready.

- Upstream `055a1fd` resolves to `055a1fdbc3c435438be26ce51aaea3e8f9f67bf2` (tree `d7c7f8a515398401e6fd3d1c3fd25803675dc306`): 10822 tracked files (10769 mode 100644, 53 mode 100755); no symlinks or submodules.
- Network: full and blobless clones and a depth-1 full fetch failed with `early EOF` / `invalid index-pack output`. The working route is a depth-1 blobless fetch of the exact commit into a temporary scratch repository, then batched blob fetches with retries.
- Import method: copy only the objects of the upstream tree into this repository (`git pack-objects` / `git index-pack`, no upstream commits or history) and stage them with `git read-tree --prefix=app/ -u <tree>` and `core.autocrlf=false`. Blob IDs therefore stay identical to upstream; this also preserves the upstream `.gitattributes` `-text` files (CRLF fixtures, OFL font licenses).
- Planned verification: `git rev-parse HEAD:app` equals the upstream tree ID; the `git ls-tree -r` manifest (mode, blob ID, path) is diffed against upstream; working-tree files are rehashed with `git hash-object --no-filters`.
- Local note: in Git Bash `python` is the Microsoft Store stub; tests run with `py -3 -m unittest discover -s tests -t .` (baseline on `1419df4`: 26 tests OK). GitHub Issue scope is authoritative; request explicit scope changes before editing other paths.
