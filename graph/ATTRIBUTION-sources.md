# Attribution: source registry and headline snapshot

Output: `fixtures/sources.js`. Builder: `tools/build_sources.py`.

## Registry origin

| Origin | Registered |
| --- | --- |
| worldmonitor, commit `055a1fd` (AGPL-3.0-only): `shared/news-catalog.json`, the catalog behind `src/config/feeds.ts` | 1347 |
| worldmonitor, same commit: literal feed lists in `scripts/seed-*.mjs` (advisories, regulators, climate, energy, aviation, health, research) and the server aviation and service-status lists | 55 |
| This project, `radar/sources.json`, `feeds` | 30 |
| Total after URL deduplication | 1432 |

Source tiers come from worldmonitor `shared/source-tiers.json` by exact name; otherwise `tier` is `null`.
The vendor repository was read as text and JSON only; none of its code was run.
Reuse of the registry was requested by the project owner. It remains under AGPL-3.0-only.

## Snapshot

Fetch date: 2026-11-27 (finished 15:10 UTC), one attempt per feed, User-Agent `radar-prototype/0.1`.

- Responded with items: 1271. Failed: 161.
- Headlines kept: 4000 of 9396 eligible, from 1245 sources.
- Google News search feeds: 556 of 596 responded.

| Failure reason | Feeds |
| --- | --- |
| HTTP 403 | 48 |
| Timeout (15 s) | 45 |
| Valid feed without items | 23 |
| HTTP 429 | 23 |
| DNS | 6 |
| HTTP 404 | 5 |
| TLS | 4 |
| HTML page instead of a feed | 3 |
| HTTP 304, over 5 MB, protocol error, connection error | 1 each |

A failure describes this machine at that moment, not the publisher in general.

## Rights

Headlines and source names belong to their publishers. Redistribution terms were not
verified for any feed; check them before publishing or shipping this snapshot.
The registry's AGPL licence does not license publisher content.

## Limitations

- The 4000 cap is filled newest-per-source first, so sources get at most 4 headlines here (contract maximum: 8).
- `items` counts titled entries in the one response; it is not a publication rate.
- Dates without a time zone are read as UTC. Undated and future-dated entries are left out of headlines.
- Titles are stripped of markup and URLs and cut to 160 characters. They are untrusted third-party text: render as text, never as HTML.
- Titles stay in the publisher's language; Google News titles may carry a publisher suffix.
- Not included: `depthUrl` fallback queries, queries generated at run time, Telegram and X accounts, JSON, CSV and HTML sources.

## Rebuild

Run from `graph/`. The raw folder must be new or empty; add `--offline` to rebuild from a saved one without fetching.

```
py -3.12 -I tools/build_sources.py --raw <folder>
node --test test/sources.test.js
```
