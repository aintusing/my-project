# Attribution: fixtures/events-cn-eu.js

Fetched 2026-11-27, keyless public sources, User-Agent `radar-prototype/0.1`, no accounts, no contact data.
Rebuild: `python -I tools/build_events_cn_eu.py <raw_folder> [--fetch]`. Raw files are not in the repository.
The fixture comes from several successive fetch runs into one raw folder.

Terms notes are a short orientation from general knowledge, not checked against current terms pages.
Verify them before any publication.

## Sources

| dataset (`cneu_`) | Source and address | Rows | Range | Terms note |
|---|---|---|---|---|
| quakes_eu25 / eu20 | EMSC `www.seismicportal.eu/fdsnws/event/1/query`, box lat 34..72, lon -25..45 | 114139 / 112025 | 2015-01-01 to 2026-11-27 | Credit EMSC and contributing networks |
| quakes_cn25 / cn20 | Same, box lat 18..54, lon 73..135 | 22684 / 306 | 2015-01-01 (cn20: 2017-09-21) to 2026-11-27 | Same |
| ems | Copernicus EMS `rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/` | 207 | 2023-03-24 to 2026-11-26 | Credit Copernicus Emergency Management Service, European Union |
| ted | TED search API v3 `api.ted.europa.eu/v3/notices/search` | 35302 | 2026-11-16 to 2026-11-27 | EU open reuse with attribution |
| esef | `filings.xbrl.org/api/filings` (newest 2000 by date added) | 2000 | 2026-09-08 to 2026-11-25 | Credit XBRL International; filings belong to issuers |
| eurostat | Eurostat catalogue table of contents `ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt` | 7616 | 2009-03-26 to 2026-11-27 | Reuse with attribution to Eurostat |
| govuk | `www.gov.uk/api/search.json`, press releases and news stories | 97740 | 2001-05-23 to 2026-11-27 | Open Government Licence v3.0 |
| eu_inst | RSS: Commission press corner, Council, European Parliament (3), EFSA, ECDC | 103 | 2022-03-15 to 2026-11-27 | Each publisher's terms; titles and dates only |
| regulators | RSS: ECB (4), ESMA, EBA, EIOPA, Bank of England (3), AMF, SNB, Riksbank, Norges Bank, HKMA, SFC | 799 | 2025-09-15 to 2026-11-27 | Same |
| hkgov | RSS: Hong Kong government news, English and Chinese | 190 | 2026-11-25 to 2026-11-27 | Same |
| news_cn | RSS: Xinhua, People's Daily (English, Chinese), Global Times, CGTN, SCMP, Sixth Tone, TechNode, HKFP | 2849 | 2017-03-30 to 2026-11-27 | Headlines belong to publishers; prototype use only |
| news_eu | RSS: DW, France24, BBC, Le Monde, Euronews, Politico Europe, ANSA, El Pais, Handelsblatt, Tagesschau, NOS, SVT, Yle, NRK, Kyiv Independent, RTE, Notes from Poland, Balkan Insight | 1154 | 2025-11-27 to 2026-11-27 | Same |

Total: 397114 events.

## Skipped or incomplete

| Source | Reason |
|---|---|
| HKEXnews listings | HKEX Terms of Use prohibit web scraping (seen in web search excerpts; HKEXnews-specific text not read) |
| CNInfo, SSE, SZSE announcements | No documented public keyless API or reuse licence found; internal website endpoints were not called. Terms pages were not found or read; `robots.txt` was 404 (CNInfo, SSE) or empty (SZSE) |
| Caixin Global, National Bank of Poland RSS | HTTP 403 |
| China Daily (3 feeds), Czech National Bank RSS | HTTP 404 |
| Swissinfo RSS | HTTP 410 |
| UK FCA, Meduza RSS | TLS connection closed by the other side (`UNEXPECTED_EOF`); not retried by other means |
| BaFin, Bundesbank, Banca d'Italia, ECB Banking Supervision RSS | TLS chain not verified by Python; a retry with system curl (OS verifier, verification on) gave no file |
| 36kr RSS | Malformed XML |
| EEA RSS | Response was not XML |
| Copernicus `public-activations/` | Needs an activation code; the `public-activations-info/` list was used instead |
| filings.xbrl.org older pages | HTTP 429 after 10 pages; the source reports 27839 filings, 2000 are included |
| TED before 2026-11-16 | Time budget; incomplete days are not saved |
| Eurostat / ECB release history | Only the last update date of each Eurostat dataset is available from the catalogue |

## Overlap with other fixtures

- `quakes_eu25` and `quakes_cn25` (M2.5+) describe largely the same earthquakes as `usgs_quakes` in
  `events.js` for 2025-11-27 to 2026-11-27. Do not add these totals together.
- `quakes_eu20` and `quakes_cn20` (M2.0 to 2.4) are below the USGS threshold used there and do not overlap.
- GDELT and USGS data are not fetched here. Regulator and news feeds partly repeat items in `events-extra.js`
  (for example Bank of England, ESMA, EBA).

## Method

- Dates: EMSC origin time; Copernicus activation time; TED publication date; ESEF date added to the index;
  Eurostat last data update; GOV.UK last public timestamp (an update date, not always first publication); RSS item date.
- Cells: 1-degree squares for `exact` datasets; the country label point from `world.js` for `country` datasets
  (TED buyer country, ESEF filing country, GB for GOV.UK, HK for the Hong Kong government).
- `latest`, at most 150 per dataset: earthquakes of the last 30 days by magnitude; others newest first
  (TED, ESEF and GOV.UK are capped per country and day).
- News and regulator datasets have `geo: 'none'`: the publisher's country is not the event's place.
- TED titles keep only country and category. ESEF titles are shown only when the name looks like a legal entity.
- Titles matching crime, death or enforcement words, or honorifics, are counted but not listed
  (GOV.UK, regulators, Hong Kong government, news).

## Limitations

- The name filter is a keyword heuristic in a few languages. It cannot guarantee that no private individual is
  named; review `latest` before publication. EU institution titles are not filtered.
- Counts are not comparable across datasets or months: each source covers a different period, and RSS holds only
  the current items of each feed. Zero in `timeline` often means "not fetched".
- Some feeds are stale (Xinhua English items date from 2017-2018, People's Daily from 2025).
- EMSC recent solutions are preliminary; its small-magnitude coverage in China is very sparse. The boxes include
  neighbouring countries, North Africa and western Turkey; `country` is derived from the region name and often `null`.
- Copernicus activations outside the two boxes are excluded.
- News counts are deduplicated by exact title only.
