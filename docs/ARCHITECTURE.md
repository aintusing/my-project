# Architecture
## What the system does
The project is building a single-page click counter using plain HTML, CSS, and JavaScript, without runtime dependencies or a backend. At the coordination baseline, master has workflow documentation only; HTML exists on an unmerged branch.
## Main parts
| Folder | What it does | Notes |
| --- | --- | --- |
| `index.html` (pending #2) | Semantic page and DOM contract | Merge before CSS/JS work |
| `style.css` (pending #3) | Responsive presentation | claude-2 |
| `script.js` (pending #4) | Session-only counter behavior | claude-3 |
| `tasks/` | Assignments, dependencies, durable handoffs | Paired with GitHub Issues |
| `docs/decisions/` | Accepted technical decisions | Read before implementation |
## How the parts talk to each other
Issue #2 establishes `#counter` (initial `0`, `aria-live="polite"`), native `#increment-button`, `./style.css`, and deferred `./script.js`. This contract remains pending until HTML merges. CSS and JS then develop independently; JS uses `textContent` and reload resets the count. No persistence, external services, or package setup is assigned.

Decision 0001 requires significant technical decisions to be recorded through PRs. The coordinator updates this document after feature merges to reflect actual implementation.
