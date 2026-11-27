# Attribution: static map layers

`fixtures/layers.js` is derived from
[koala73/worldmonitor](https://github.com/koala73/worldmonitor) at commit `055a1fd`,
licensed AGPL-3.0-only (see its `LICENSE` and `docs/license.mdx`). The generated file
stays AGPL-3.0-only. The upstream name is used here only to credit the source.

Regenerate from the `graph` folder: `node tools/build_layers.mjs <worldmonitor dir>`.

## Changes made to the source data

- Array literals only are evaluated; no upstream module is imported or run.
- Each record keeps its name, coordinates and at most four fields. Field labels are
  Russian; names and values are as in the source, except for the formatting below.
- Formatting: lists joined with commas; city and country joined; market cap suffixed
  `трлн USD`; opening hours and time zone joined; chip type and count joined with `×`;
  power suffixed `МВт`. Missing values are omitted.
- URLs are removed, whitespace is collapsed, strings are cut to 140 characters.
- Line vertices are rounded to 2 decimals; consecutive duplicates are dropped.
- Conflict zones are drawn as their source polygon outlines (`lines`).
- Layer ids, labels, groups and colours are defined by `tools/build_layers.mjs`.
- No layer is capped: every record of each listed export is included.

## Layers

All paths are relative to the upstream repository; all rows are from commit `055a1fd`.

| Layer id | Source file | Export | Items |
| --- | --- | --- | --- |
| `stock-exchanges` | `src/config/finance-geo.ts` | `STOCK_EXCHANGES` | 29 |
| `financial-centers` | `src/config/finance-geo.ts` | `FINANCIAL_CENTERS` | 19 |
| `central-banks` | `src/config/finance-geo.ts` | `CENTRAL_BANKS` | 14 |
| `commodity-hubs` | `src/config/finance-geo.ts` | `COMMODITY_HUBS` | 10 |
| `economic-centers` | `src/config/geo-map.ts` | `ECONOMIC_CENTERS` | 41 |
| `ports` | `shared/ports-data.ts` (re-exported by `src/config/ports.ts`) | `PORTS` | 62 |
| `pipelines` | `shared/pipelines-data.ts` (re-exported by `src/config/pipelines.ts`) | `PIPELINES` | 88 |
| `ai-datacenters` | `src/config/ai-datacenters.ts` | `AI_DATA_CENTERS` | 313 |
| `strategic-waterways` | `shared/geo-data.ts` (re-exported by `src/config/geo.ts`) | `STRATEGIC_WATERWAYS` | 13 |
| `critical-minerals` | `src/config/geo-map.ts` | `CRITICAL_MINERALS` | 11 |
| `mines` | `src/config/commodity-geo.ts` | `MINING_SITES` | 71 |
| `spaceports` | `src/config/geo-map.ts` | `SPACEPORTS` | 12 |
| `nuclear-facilities` | `shared/nuclear-facilities-data.ts` (re-exported by `src/config/geo-map.ts`) | `NUCLEAR_FACILITIES` | 367 |
| `military-bases` | `shared/military-bases-data.ts` and `src/config/military-bases.ts` | `MILITARY_BASES` (`MILITARY_BASES_EXPANDED` merged with `US_DOMESTIC_BASES`) | 226 |
| `conflict-zones` | `shared/geo-data.ts` (re-exported by `src/config/geo.ts`) | `CONFLICT_ZONES` | 10 |
| `hotspots` | `shared/geo-data.ts` (re-exported by `src/config/geo.ts`) | `INTEL_HOTSPOTS` | 29 |

## Upstream sources and licence notes

"None stated" means that no upstream source or licence note was found in the source
file comments or the licence and data-source documents searched. It does not confirm
that no third-party rights apply.

### Third-party sources named by the repository

- **`pipelines`**: the file comment says "Global Energy Monitor, EIA, public domain
  geographic data". `docs/methodology/pipelines.mdx` gives Global Energy Monitor data
  as CC BY 4.0 (written about the separate registry in `scripts/data/`, which is not
  extracted here). Credit: Global Energy Monitor
  (https://globalenergymonitor.org), EIA. Licence:
  https://creativecommons.org/licenses/by/4.0/
- **`ai-datacenters`**: the file comment says "Data from Epoch AI GPU Clusters
  dataset" (https://epoch.ai/data/gpu-clusters), "Licensed under Creative Commons
  Attribution" (no version stated), filtered for clusters with more than 1000 GPUs,
  Existing/Planned status and Confirmed/Likely certainty. Credit: Epoch AI. A comment
  on at least one record says stored coordinates are not verified site coordinates:
  treat positions as approximate.
- **`military-bases`**: the file comment says the table was generated from "Overseas
  Military Bases.xlsx", source Asian Religious Connections (ASIAR), HKU, last updated
  November 2020, with 2024-25 status changes. The domestic additions in
  `src/config/military-bases.ts` name no source. **No licence is stated.** No
  prohibition on redistribution was found, so the layer is included; the ASIAR terms
  have not been verified and should be checked before public redistribution.
- **`financial-centers`**: a comment says "GFCI-ranked" (Global Financial Centres
  Index) and each record carries `gfciRank`. No licence is stated for the ranking.

### No source or licence stated

`stock-exchanges`, `central-banks`, `commodity-hubs`, `economic-centers`, `ports`,
`strategic-waterways`, `critical-minerals`, `mines`, `spaceports`,
`nuclear-facilities`, `conflict-zones`, `hotspots`: none stated.

`conflict-zones` and `hotspots` are curated editorial snapshots (parties, intensity,
escalation scores) as of the commit; they are not live or independently verified.

## Skipped datasets

- **Undersea cables** (`UNDERSEA_CABLES` in `src/config/geo-map.ts`, 98 cables):
  skipped. The file calls it a static baseline for data seeded from the TeleGeography
  Submarine Cable Map. `scripts/source-attribution.mjs` and
  `shared/source-attribution-manifest.json` record that provider as "TeleGeography
  proprietary/provider terms" with status `terms-review`. Nothing found shows that the
  static table has an independent, redistributable origin.
- **Gamma irradiators** (`GAMMA_IRRADIATORS` in `src/config/irradiators.ts`):
  not included. It is outside the requested layer list; the file credits the IAEA
  Database on Industrial Irradiation Facilities and states no redistribution licence.

Other upstream tables (for example processing plants, commodity ports, mining
companies, technology sites, Gulf investments, airports and the pipeline registry in
`scripts/data/`) are outside the requested layers and were not extracted.

## Other data in this module

| Output | Origin | Terms |
| --- | --- | --- |
| `fixtures/world.js` | Natural Earth outlines via `world-atlas` 2.0.2 | Natural Earth: public domain; world-atlas: ISC (`lib/LICENSE.world-atlas`) |
| `fixtures/snapshot.js` | DefiLlama protocols and hacks, CoinGecko markets and exchanges, SEC EDGAR company list and XBRL frame locations, Nasdaq Trader symbol directory; dated snapshot built by `tools/build_snapshot.mjs` | Redistribution terms of DefiLlama, CoinGecko and Nasdaq data are **not verified**; check before publishing a product |
| `fixtures/events*.js` | See `ATTRIBUTION-events.md` and `ATTRIBUTION-events-extra.md` | As listed there |
| `fixtures/sources.js` | See `ATTRIBUTION-sources.md` | Headlines belong to their publishers |
| `analytics.js` | See `METHODOLOGY.md` | Adapted from worldmonitor, AGPL-3.0-only |
