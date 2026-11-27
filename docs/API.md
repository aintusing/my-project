# Radar catalog API (R02)

Read-only local JSON API over a SQLite index of the catalog. Listens on `127.0.0.1` only by
default. No network access is needed to search. This file is the contract for API consumers.

## Build the index and run the server

```
python catalog/build_catalog.py          # generates catalog/out/*.csv (needs network, free sources)
python -m catalog.db.build               # catalog/out/all_sources.csv -> data/catalog.sqlite
python -m radar.api                      # http://127.0.0.1:8765
```

- Options: `python -m catalog.db.build --csv PATH --db PATH`, `python -m radar.api --db PATH --host H --port N`.
- Missing input: if the CSV does not exist the importer prints the reason to stderr and exits with
  code 2; an existing database is left untouched.
- Rebuild: run the importer again. It writes `<db>.tmp` and atomically replaces the database, so a
  failed import never damages the old one. Stop the server first on Windows if it holds the file.
- `data/` is gitignored; the database is never committed. Source scripts and `catalog/out/` are not modified.
- If the database file is missing the server answers `503 database_unavailable`.

## Endpoints (GET only; other methods return 405)

### `GET /search`
| Parameter | Meaning |
| --- | --- |
| `q` | Full-text query over name and symbol, up to 100 chars. Words are matched as whole words; the last word is a prefix. Needs at least one letter or digit. Omit to list everything. |
| `kind`, `sphere`, `tier`, `origin` | Exact-match filters. Valid values come from `/facets`. |
| `min_significance` | Integer 0..100. |
| `flagged` | `1` only records with danger flags, `0` only records without. |
| `limit` | 1..100, default 20. |
| `offset` | 0..1000000, default 0. |

Order: text relevance (bm25) then significance when `q` is given, otherwise significance descending.
Unknown or repeated parameters give `400`.

Response `200`:
```
{"total": 2, "limit": 20, "offset": 0, "results": [
  {"id": 1, "kind": "coin", "name": "Bitcoin", "symbol": "BTC", "category": null, "sphere": "...",
   "tier": "S", "significance": 99, "interest": null, "classes": ["значимые"],
   "danger_flags": [], "url": null, "x_handle": null, "feed_url": null, "extra": null, "origin": "..."}]}
```
- `total` counts all matches before pagination; no match gives `"results": []`.
- Unknown values are `null` (empty CSV cell); `classes` and `danger_flags` are arrays, empty when none.
- `significance` and `interest` are heuristic 0..100 scores from `catalog/build_catalog.py`, not validated
  against outcomes; `danger_flags` are signs, not a verdict. This is not investment advice.

### `GET /facets`
Returns the distinct non-null values: `{"kind": [...], "sphere": [...], "tier": [...], "origin": [...]}`.

### `GET /health`
`{"status": "ok"}`.

## Errors
JSON `{"error": code, "detail": text}`: `400 bad_request` (invalid input), `404 not_found`,
`405 method_not_allowed`, `503 database_unavailable`.

## Safety
All values are bound as SQL parameters; the user query is reduced to quoted words before it reaches
FTS5. The database is opened read-only per request. Search never uses the network.
