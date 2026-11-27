# 0002: The product is Radar, built on a full copy of worldmonitor
Status: Proposed (accepted when merged into master)
## Context
The click counter was a trial of the team workflow. The owner wants a hackathon product
covering crypto, memecoins and stocks.
## Decision
- Replace the click counter with Radar. Keep the team workflow in AGENTS.md.
- Copy koala73/worldmonitor at commit 055a1fd completely into `app/`. Change as little as
  possible; add new behavior in new files.
- The combined product is licensed AGPL-3.0-only. The owner reports full permission from
  the author; until written text is in PERMISSIONS.md, AGPL applies and the World Monitor
  name and logo are not used.
- No paid services. Python code in `radar/` and `catalog/` stays Python.
## Consequences
Counter tasks #2-#4 become obsolete once a human confirms closing them. The initial copy
is exempt from the 300 changed lines guideline. The repository grows by about 295 MB.
