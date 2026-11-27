# Analysis methodology

Adapted from koala73/worldmonitor, commit `055a1fd`, AGPL-3.0-only. Code: `analytics.js`; keyword lists, coefficients and hotspot settings are copied as data from the files below.

Inputs differ from the original. **No number here is an official worldmonitor index.** The scores rank items inside one snapshot. They are not probabilities, have no error intervals and were not validated against outcomes on our data.

Common input limits: GDELT events are machine-coded from media, so volume follows coverage; points can be country or region centroids; events are counted on a 1-degree grid.

## Applied methods

| Method | Source in worldmonitor | Formula | Our inputs | Adaptation and limits |
|---|---|---|---|---|
| Temporal anomaly | `server/worldmonitor/infrastructure/v1/list-temporal-anomalies.ts`, `shared/analysis-temporal-severity.ts` | Welford mean and M2; `sd = sqrt(M2/(n-1))`; `z = abs(x-mean)/sd`; at least 10 samples; 1.5 medium, 2 high, 3 critical | `events.timeline` summed by month; GDELT and USGS sets only, global | Original baselines are per region, weekday and month. Ours: per-day rate per month, no seasonality; leading empty months and the first partial month of each set are dropped. Additional event sets are not tested: their coverage over time is uneven or a feed tail. The current month is divided by completed days (events of the snapshot day stay in the numerator). Two-sided: a drop, including late or missing data, also triggers. Several datasets are tested with no multiple-comparison correction. |
| Geographic convergence | `shared/analysis-geo-convergence.ts` | 1-degree cell, at least 3 distinct types; `min(100, 25*types + min(25, 2*events))` | 7-day counts: protest, conflict (GDELT), earthquake (USGS, tsunami), volcano (`eruptions`, `gvp`), natural (`eonet`); `eonet` may repeat other types | 7 days instead of 24 hours; media-coded force events replace military flights and vessels. All other sets are excluded. The score reaches 100 at 13 events with 3 types, so ties are ordered by volume. Large media cities in seismic zones match by base rate; this is not evidence of a link. |
| Related assets | `src/services/related-assets.ts` | Nearest assets within 300 km, 3 per type, line = middle vertex | Layers: pipelines, data centres, military bases, nuclear facilities | Applied to convergence cells (original: news events). No cables in our layers. `docs/algorithms.mdx` says 600 km; the code value is used. A long line can pass close while its middle vertex is far. |
| Instability by country (our adaptation of CII) | `server/worldmonitor/intelligence/v1/get-risk-scores.ts`, `_risk-config.ts`, `shared/cii-weights.ts` | `0.4*baseline + 0.6*(0.25 unrest + 0.30 conflict + 0.20 security + 0.25 information)` + news urgency (3 at 50, 5 at 70) + quake boost (M5.5: 2, M6.5: 5, M7.5: 10, cap 25), cap 100 | Grid cells assigned to countries by outline; headlines; USGS latest list (7 days) | See below. |
| GDELT unrest and conflict terms | same, curve notes in `_risk-config.ts` | `max(escalation, level)`. Escalation: `r=(current+20)/(base+20)`; 0 if `r<=1.25`, else `min(70, ln(r/1.25)/ln(2.4)*70)`. Level: share of coded events, 0 under 200; conflict floor 0.14 / top 0.40, protest 0.02 / 0.08, cap 70 | `gdelt_protest`, `gdelt_conflict`, all GDELT sets as the denominator | Original: last 24 h against a 28-day **median**, and distinct **articles**. Ours: 7-day daily mean against the **mean** of the previous 23 days, and **events**. Our conflict set includes CAMEO 15 and 17, broader than the original 18-20. The thresholds were calibrated upstream on other units and are not recalibrated; protest shares rarely pass the floor. The smoothing of 20 per day mutes small countries. |
| Information term | same, `shared/threat-keyword-classifier.ts` | Top stories: critical 4, high 2, medium 1, low 0.5; plus `min(20, sum of the same weights over headlines)`; cap 100 | Newest 1000 headlines, top 8 clusters | English keyword rules, not an LLM. Country attribution by keywords exists for 31 countries only; others show "no data". Other-language headlines mostly stay unclassified. |
| Strategic risk roll-up | `computeStrategicRisks` in `get-risk-scores.ts` | Top 5 scores, weights 1, .85, .70, .55, .40; `min(100, round(avg*0.7+15))`; high 70, medium 40 | Our country scores | Inherits every limit of the country score. |
| Hotspot escalation | `shared/analysis-hotspot-escalation.ts`, `shared/hotspot-country-map.ts`, `shared/geo-data.ts`, `src/components/DeckGLMap.ts` | news `min(100, 15m + 30 breaking + 5v)`; geo `min(100, score+10 types)`; raw `.35 news + .25 country + .25 geo + .15 military`; `0.3*static + 0.7*(1+raw/25)` | Layer `hotspots` (matched by name), headlines of the last 2 h, our country scores and cells with 2+ types within 150 km | Military is 0 (no data). Unknown country score is 30, as upstream, and labelled. Static level and keywords come from `geo-data.ts`. No history, so no trend or alerts. |
| News clustering | `shared/news-clustering-core.js`, `shared/text-analysis-core.js` | Jaccard >= 0.5, or >= 1/3 with 4 shared distinctive words and another outlet; newest 1000; primary = best tier then newest | `sources.headlines`, source tier | Any-script tokenizer; outlet = feed, no publisher families or syndication detection. Greedy, order dependent. Missing tier = 4. |
| Headline importance and source tier | `scripts/_clustering.mjs` | Tier +35/+20/+8, `12*min(sources,6)`, keyword groups, x1.25 flashpoint, x0.35 business, recency `max(0.5, 1-hours/16)` | Clusters | No LLM threat score and no entity corroboration, so those terms are absent. Age is counted from the newest headline. |
| Velocity and sentiment | `src/services/velocity.ts` | `articles / max(hours, 0.25)`; 3 elevated, 6 spike; trend by halves (x1.5); word-list sentiment | Clusters | English sentiment lists. The panel shows velocity only. |
| Keyword spikes | `shared/keyword-spike-core.js` | 2 h window; count >= 5, > 3x baseline (any count >= 5 if baseline is 0), 2+ sources | Headlines up to 7 days back | Window ends at the newest headline; source = feed. Feed snapshots keep little history, which lowers the baseline and favours false spikes. Many terms are tested without correction. No cooldown. |
| Cross-signal correlation | `src/services/correlation-engine/engine.ts`, `adapters/disaster.ts`, `adapters/economic.ts` | Sum of weight x maximum severity per type + `min(30, 12*(types-2))`; threshold 20 | Disaster: largest quakes of 4 days (about M4.9+), 500 km chains, severity `(M-1.5)*17`. Economic: coin moves of 1.5%+ and sanctions headlines of 24 h grouped by keyword | Disaster has one type only (no outage data): it is a quake cluster, not a cross-domain link. Coin moves are **7-day**, not session changes. Groups need a keyword in the label. Co-occurrence is not causation. Pairwise search replaces the spatial grid. |

### Country score: how to read it

- Unknown parts are shown as "no data" and add 0. Security is always unknown, so the maximum is lower than upstream and levels are not comparable with it.
- Baseline risk is an editorial coefficient (31 countries; default 15). With few event terms it dominates the ranking.
- Countries without news keywords cannot get the information term: ranking is biased towards the 31 listed.
- Cells whose centre and four corners fall outside every outline are not counted. Border cells go to one country. Countries absent from the outlines get no events.
- No floors or advisory boosts. The event multiplier applies upstream only to verified (ACLED) events and is unused.

## Not applied

| Method | Reason |
|---|---|
| ACLED/UCDP conflict, unrest, fatality, severity terms and floors; strike pressure | No verified events, fatalities or strike coding |
| Security term (flights, vessels, aviation, GPS jamming); military surge, theater posture, USNI, aircraft enrichment, military correlation adapter | No military or aviation data |
| Advisory, displacement, climate, wildfire, outage, sanctions-list, AIS, OREF, arrivals boosts | Inputs absent |
| CII trend delta, alert fusion, convergence trend, hotspot history | Only one snapshot of scores |
| Strategic risk browser fallback (infrastructure, theater, breaking, radiation terms) | Inputs absent; the server roll-up is used |
| Escalation correlation adapter | Per-event severity and outages absent; news alone is a single type |
| Infrastructure cascade, cable health | No dependency weights, redundancy, navigation warnings or AIS |
| Population exposure | Snapshot has no population density |
| Fear and greed, market breadth, stock analysis, stablecoin peg, market-news and prediction signals, market correlation series | No price series, daily moves, volatility, sentiment or prediction inputs |
| Resilience index and the other `docs/methodology` indices (energy, food, finance and others) | Indicator inputs absent |
| GDELT bilateral tension, PizzINT, thermal escalation | No series or sensors |
| LLM and ML classification, summaries | No model at runtime |
| Focal points, news geolocation, entity corroboration (+45), publisher families, syndication detection | **Not ported yet**; part of the inputs exists |
