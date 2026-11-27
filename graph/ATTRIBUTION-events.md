# Event data attribution (`fixtures/events.js`)

Fetched 2026-11-27 with the User-Agent `radar-prototype/0.1`. `generated` = 2026-11-27.
Rebuild: `python -I tools/build_events.py <raw_folder>`. Raw files are not stored in the repository.

## Sources

### GDELT 1.0 daily event export
- URL: `https://data.gdeltproject.org/events/YYYYMMDD.export.CSV.zip`
- Files: 30, `20261028` to `20261126`. `20261127` returned 404 (not published at fetch time).
- Rows: 3087622 parsed; 2 without a CAMEO root code are excluded; 0 malformed, 0 duplicate event IDs; 3087620 counted.
- Terms: the GDELT Project allows unrestricted use with citation. Credit: "The GDELT Project, https://www.gdeltproject.org/".

### USGS earthquake catalog
- URL: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&minmagnitude=2.5&orderby=time&starttime=...&endtime=...`
- Files: 12 consecutive windows, 2025-11-27 to 2026-11-28 (end exclusive).
- Rows: 29680; 182 rows of other event types (not `earthquake`) are excluded; 29498 counted.
- Terms: U.S. Geological Survey data are in the public domain. Credit: "U.S. Geological Survey".

### SEC EDGAR full index: NOT included
- URL tried: `https://www.sec.gov/Archives/edgar/full-index/<year>/QTR<n>/master.gz`
- Result: HTTP 403, "Your Request Originates from an Undeclared Automated Tool". SEC asks automated
  clients to identify themselves in the User-Agent; no contact details were sent and the block was not bypassed.
- Consequence: 0 filings, no `markets` dataset, `companies` is empty.
- The script reads `<raw_folder>/sec/*.gz` (with `--sec-loc`) if the files are supplied later. This path was
  checked only with a small synthetic file, never with real SEC data. Update this document and rerun the tests then.

## Counts

`unlocated` events are counted in `total` and `timeline` but are not in `cells`.

| dataset | total | unlocated | from | to | CAMEO root codes |
|---|---|---|---|---|---|
| gdelt_diplomacy | 1967327 | 46188 | 2026-10-28 | 2026-11-26 | 01-05 |
| gdelt_aid | 268078 | 9575 | 2026-10-28 | 2026-11-26 | 06-08 |
| gdelt_pressure | 459204 | 13587 | 2026-10-28 | 2026-11-26 | 09-13 |
| gdelt_sanctions | 23638 | 646 | 2026-10-28 | 2026-11-26 | 16 |
| gdelt_protest | 23118 | 941 | 2026-10-28 | 2026-11-26 | 14 |
| gdelt_conflict | 346255 | 12404 | 2026-10-28 | 2026-11-26 | 15, 17-20 |
| usgs_quakes | 29498 | 0 | 2025-11-27 | 2026-11-27 | - |

Total: 3117118 events, 83341 unlocated.

## Method
- Cells: 1-degree squares (centre point). Periods: event age in days from `generated` below 7 or below 30.
- GDELT date = `DATEADDED` (when GDELT recorded the event), not the date the event is said to have happened.
- GDELT location = `ActionGeo` latitude and longitude. Country codes are converted from FIPS 10-4 to ISO 3166-1.
- `latest`, at most 150 per dataset: GDELT from the last 7 days, one per place, ranked by mentions
  (`weight` = `NumMentions`); earthquakes from the last 30 days, ranked by magnitude (`weight` = magnitude).
- GDELT titles use only the category, place and mention count. Actor names are never used.

## Limitations
- GDELT events are coded automatically from news reports. They are not verified facts: expect misclassification,
  wrong places, repeated reports of one incident under several IDs, and a bias toward English-language and
  heavily covered places. A category (for example "боевые действия") can come from sport or figurative wording.
- Of 3004279 located GDELT events, 679188 (23%) are only country centroids and 491696 (16%) only state or
  region centroids, so some cells are artificially dense although the dataset is marked `exact`.
- CAMEO has no separate "economic sanctions" root: code 16 is "reduce relations" (includes sanctions and
  embargoes); codes 06-08 mix aid, material cooperation and concessions.
- `NumMentions` is the value in the daily export, not a final count.
- GDELT covers only 30 days. Zeros in `timeline` before 2026-10-28 mean "not fetched", not "no events".
  The 7-day period holds 6 GDELT days (2026-11-21 to 2026-11-26); the first fetched day is outside the 30-day period.
- Earthquakes: magnitude 2.5 and above; global completeness at small magnitudes is uneven; USGS may revise
  recent entries; 2026-11-27 is a partial day. `country` is derived from the place text and is often `null`
  (offshore or unmatched names).
