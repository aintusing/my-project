# Money Bansho: graph and world map

A standalone browser module: an Earth globe and a flat world map with market assets by country,
a 3D "planet" graph (vendored `3d-force-graph`) and a 2D scheme. UI strings are in Russian.

## Run the demo
From the repository root:

```bash
python graph/tools/serve.py 8767
```

Open <http://127.0.0.1:8767/>. URL parameters:

| Parameter | Effect |
| --- | --- |
| `mode=earth\|map\|3d\|2d` | Starting view. `mode=2d` also disables 3D. |
| `data=synthetic&nodes=5000` | Synthetic data for performance tests (50-20000 nodes, no map views). |
| `links=all` | Draws all links in the graph views and turns off large-graph simplification. |

## What is on screen
- **Globe / map.** Assets with a known country sit near that country's label point (country-level
  accuracy only). Assets without a country fly on an orbit ring on the globe and are absent from
  the flat map. No country is guessed. A pulsing ring marks a located asset with a recorded hack.
- **World layers** (optional `fixtures/layers.js`): static datasets derived from worldmonitor,
  shown as diamonds (finance), squares (infrastructure), triangles (security) and lines.
- **Controls.** Layer switches, region buttons, sphere and country filters, coloring by sphere,
  type or risk, three themes, search, pause, zoom buttons, arrow keys.
- **Side panel.** Overview with counts, most significant assets, weekly movers, a dated hack feed,
  countries and active world layers; cards for an asset, a country or a layer item.

## Data
```js
{ date, nodes: [{ id, name, group, sphere, size, country, meta }], links: [{ source, target }] }
```
`country` is an ISO alpha-2 code. `meta` may hold `symbol, category, score, interest, flags, tvl,
mcap, volume, change7d, trust, exchange, hack: { date, usd, how }`. Invalid nodes and dangling,
duplicate or self links are dropped; missing values are not shown.

World data (`options.world`): `{ shapes: [{ code, rings }], countries: { CODE: { name, at } } }`.
World layers (`options.geo`): `{ commit, layers: [{ id, label, group, color, kind, items }] }`.

### Rebuild the snapshot
`tools/build_snapshot.mjs` reads the catalog CSV files, DefiLlama protocols, SEC XBRL company
locations and `world-atlas` 2.0.2; the exact arguments are at the top of the file.
`tools/build_layers.mjs` regenerates the world layers from a worldmonitor checkout.
The snapshot is dated and is not live data. Scores and flags are heuristics, not advice.

## API
```js
import { createRadarGraph } from './radar-graph.js';
const radar = createRadarGraph(container, data, {
  world, geo, onSelect: (node, neighbors) => console.log(node.id, neighbors.length),
});
```

| Option | Default | Description |
| --- | --- | --- |
| `world` | `null` | Enables the globe and map views. |
| `geo` | `null` | World layers; finance layers start enabled. |
| `view` | first available | `earth`, `map`, `3d` or `2d`. |
| `date` | `data.date` | Reference date for the hack feed periods. |
| `onSelect` | no-op | `(node, neighbors)` on asset selection from any view, search or list. |
| `force2d` | `false` | Disables 3D. |
| `forceGraph` | `globalThis.ForceGraph3D` | The 3D library factory. |
| `simplifyAbove` | `2000` | Graph views draw only the selected node's links above this size. |

Returned: `mode`, `select(id)`, `search(text)`, `setSphere(name)`, `setCountry(code)`,
`setView(mode)`, `setColor('sphere'|'type'|'risk')`, `selectGeo(item, layer)`, `counts()`,
`spin()` (benchmark step), `destroy()`.

## App integration (task R08)
- Ship the `.js` files in this folder plus `fixtures/` as needed; load
  `lib/3d-force-graph.min.js` as a classic script only if the 3D graph is wanted.
- The container needs a height. The module replaces its children.
- `style.css` also styles `body`, `header` and `h1`; extract the `.rg*` rules for an app.
- Opening an app card: use `onSelect`. There is no data update call: `destroy()` and recreate.

## Limitations
- Country outlines are 1:110m, so very small states have markers but no outline.
- The globe is drawn on a 2D canvas; lines crossing the map edge may clip.
- The 2D scheme has no pinch zoom. `Map.groupBy` needs a recent browser (Node.js 21+ for tests).

## Measure FPS
Keep the tab visible and run `await benchmark(10)` in the console. The camera or map moves while
animation frames are counted. Record mode, nodes, seconds, average FPS, p95 frame time, viewport,
pixel ratio, browser and hardware. Frames are capped by the display refresh rate.

## Tests
`cd graph`, then `npm test`. No dependencies to install. Tests do not exercise the DOM or rendering.

## Offline use, security and licenses
All code, styles and data load locally. The demo CSP is `default-src 'self'; connect-src 'none';
style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:`. External strings are inserted only
as text. No threat-indicator addresses are included.

The module is `AGPL-3.0-only`. See `ATTRIBUTION.md` (data sources), `lib/PROVENANCE.md`,
`lib/THIRD_PARTY_LICENSES.txt`, `lib/LICENSE.3d-force-graph` and `lib/LICENSE.world-atlas`.
Redistribution terms of the DefiLlama and CoinGecko snapshot data have not been verified.
