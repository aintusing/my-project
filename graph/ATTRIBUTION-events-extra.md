# Attribution: fixtures/events-extra.js

Fetch date: 2026-11-27. Keyless public sources, User-Agent `radar-prototype/0.1`, no accounts.
Build: `tools/build_events_extra.py` (source URLs are listed in its header). The committed fixture was
built with `--offline` from files saved on 2026-11-27: one probe run (EONET, NCEI, GVP, CNEOS, CISA KEV)
and one build run (all other sources), copied into one raw folder. Raw files are not part of the project.

Terms notes are a short orientation from general knowledge, not checked against the current terms pages.
Verify them before any publication.

| id | Source | Rows | On map | Date range | Terms note |
|---|---|---|---|---|---|
| eonet | NASA EONET v3, status=all, days=365 | 10611 | 10562 | 2011-08-30 to 2026-11-23 | NASA open data; credit NASA EONET and upstream providers |
| tsunami | NOAA NCEI Hazards, tsunami events since 2024 | 53 | 53 | 2024-01-01 to 2026-11-18 | US government data; cite NOAA NCEI |
| eruptions | NOAA NCEI significant volcanic eruptions since 2024 | 12 | 12 | 2024-04-16 to 2026-05-07 | Same |
| gvp | Smithsonian GVP / USGS weekly volcanic activity RSS | 24 | 24 | 2026-11-19 | Cite Smithsonian GVP; reuse terms apply |
| fireballs | NASA/JPL CNEOS fireball API, last 365 days | 25 | 25 | 2025-12-16 to 2026-10-04 | Credit NASA/JPL CNEOS |
| who | WHO Disease Outbreak News, newest 300 | 300 | 180 | 2021-02-12 to 2026-11-24 | WHO terms (often non-commercial licence); titles only |
| kev | CISA Known Exploited Vulnerabilities | 1805 | 0 | 2021-11-03 to 2026-11-25 | CC0 / US government |
| fedreg | Federal Register API: SEC, CFTC, Treasury, 12 months | 3295 | 0 | 2025-11-28 to 2026-11-27 | US government publication |
| launches | Launch Library 2 (The Space Devs), previous launches, 12 months | 328 | 328 | 2025-11-27 to 2026-11-27 | Free tier, 15 requests/hour; credit The Space Devs |
| un | UN News RSS | 30 | 0 | 2026-11-20 to 2026-11-27 | UN terms; titles only |
| banks | RSS: Federal Reserve, Bank of England, BIS, Bank of Japan, Bank of Canada, EBA, ESMA, SEC (2 feeds), CFTC, US DOJ | 218 | 218 | 2026-06-25 to 2026-11-27 | Each publisher's terms; titles and dates only |
| worldbank | World Bank news search API, up to 500 newest English items | 499 | 259 | 2026-03-02 to 2026-09-28 | World Bank terms; titles only |
| cryptonews | RSS feeds from `radar/sources.json` that downloaded | 561 | 0 | 2025-12-02 to 2026-11-27 | Headlines belong to publishers; personal/prototype use, verify before redistribution |

"On map" is the number of rows with coordinates.

## Skipped sources

| Source | Reason |
|---|---|
| GDACS alerts | Host name did not resolve (DNS failure, Python and curl) |
| DefiLlama hacks | Host name did not resolve |
| OFAC SDN (country counts) | Both hosts failed to resolve. The code for it reads only entry number and country, never names |
| NOAA/NWS active alerts | DNS failure in Python; curl failed the TLS certificate revocation check. Verification was not disabled |
| ECB RSS | TLS certificate verification failed, then DNS failure |
| SNB RSS | TLS certificate verification failed, then DNS failure |
| UK FCA RSS | TLS connection closed unexpectedly |
| RBA RSS | HTTP 403 |
| IMF RSS, NOAA SWPC alerts | DNS failure (probe) |
| ReliefWeb | DNS failure (probe); its API also expects a registered application name |
| Crypto feeds: Cointelegraph, The Block, Decrypt, Blockworks, DL News, The Defiant, Bitcoin Magazine, CryptoSlate, CoinJournal, Wu Blockchain, Incrypted, Chainalysis, TRM Labs | No file downloaded in the build run; the run was cut by a time limit before per-feed errors were saved |
| USGS elevated volcanoes, NOAA NHC, ECDC, CDC, UK FCDO, UN press RSS | Probed, not included (no coordinates, overlap, or out of scope) |
| SEC EDGAR, USGS earthquakes, GDELT | Handled by the other dataset |

## Processing and limitations

- `cells`: 1-degree grid (cell centre). 7 and 30 day counts are relative to 2026-11-27.
- Country-level points use label points from `fixtures/world.js`; English names for matching come from Unicode CLDR.
- `who`, `worldbank`: placed on the map only when a single country is recognised; multi-country and regional items have no point.
- `banks`: the point is the publisher's seat (US, GB, CH, JP, CA, FR), not where something happened.
- `eonet`: date is the first observation, position is the latest one. Long-running events therefore start before the 12-month window.
- `latest`: up to 150 per dataset, chosen by weight among the 600 newest rows. Weight is a ranking heuristic and is not comparable across datasets.
- RSS datasets contain only what each feed currently exposes, so older months are incomplete and trends must not be read from them.
- The same eruption can appear in `eonet`, `eruptions` and `gvp`; datasets are not deduplicated against each other.
- NCEI data is a curated catalogue and can lag by weeks or months.
- `companies` is empty.
