# Radar graph

A browser module that shows a node-link graph in 3D (vendored `3d-force-graph`) or on a 2D canvas, with a sphere filter, name search and a neighbor panel. UI strings are in Russian. The demo uses synthetic data only.

## Run the demo
From the repository root:

```bash
python -m http.server 8767 --bind 127.0.0.1 --directory graph
```

Open <http://127.0.0.1:8767/>. URL parameters, for example `?nodes=5000&mode=2d&links=all`:

| Parameter | Effect |
| --- | --- |
| `nodes` | Synthetic node count, clamped to 50-20000. Default (also for `0` or non-numbers): 5000. |
| `mode=2d` | Forces the 2D view. Otherwise 3D is used when available. |
| `links=all` | Sets `simplifyAbove` to `Infinity`: draws all links and turns off all large-graph simplification. |

## Data
```js
{ nodes: [{ id, name, group, sphere, size }], links: [{ source, target }] }
```

Invalid input is dropped or defaulted without a warning:

- A node without `id` (`undefined` or `null`) is skipped. IDs become strings; for a repeated ID, the last node wins.
- Defaults: `name` is the ID, `group` is `unknown`, `sphere` is `group` or else `unknown`. A `size` that is not a positive number becomes 1.
- A link is dropped if an end is unknown, if it connects a node to itself, or if the pair is already linked (in either direction). `source` and `target` are IDs, not node objects.
- Missing `data`, `nodes` or `links` gives an empty collection. A non-iterable value such as a number throws.

Groups `sphere`, `chain`, `warning` and `hacked` have their own colors; other groups share one color.

## API
```js
import { createRadarGraph } from './radar-graph.js';

const radar = createRadarGraph(container, data, {
  onSelect: (node, neighbors) => console.log(node.id, neighbors.length),
});
```

| Option | Default | Description |
| --- | --- | --- |
| `onSelect` | no-op | `(node, neighbors)`: normalized `{id, name, group, sphere, size}` objects; neighbors are sorted by size (largest first), then name. |
| `force2d` | `false` | Skips 3D. |
| `forceGraph` | `globalThis.ForceGraph3D` | The 3D library factory. |
| `simplifyAbove` | `2000` | Simplifies when the shown node count exceeds this value. |

| Returned member | Behavior |
| --- | --- |
| `mode` | `'3d'` or `'2d'`. |
| `select(id)` | Selects, focuses and calls `onSelect`. Pass a string ID. Returns `false` if unknown; switches to all spheres if the node is filtered out. |
| `search(query)` | Case-insensitive; exact, then prefix, then substring match. Searches the shown nodes first, then all. Selects and returns the match, or returns `null`. |
| `setSphere(sphere)` | Shows sphere members, their direct neighbors and the members' links. `''` or an unknown value shows everything. Clears a hidden selection without calling `onSelect`. |
| `counts()` | `{nodes, links}` in the current view, including links not drawn. |
| `spin()` | Returns a function that moves the camera one step per call (used by the benchmark). |
| `destroy()` | Releases the view, empties the container and removes its `rg` class. |

## App integration (task R08)
- Load `lib/3d-force-graph.min.js` as a classic script before calling `createRadarGraph`, or pass `forceGraph`. Without it you get the 2D view.
- Ship `radar-graph.js` with `model.js` and `views.js`.
- The container needs a height. `.rg` sets `flex: 1; min-height: 0`, so use a sized flex column parent or set the height yourself. The module replaces the container's children.
- Import the `.rg*` styles from `style.css`. That file also styles `*`, `body`, `h1`, `p`, `header`, `button` and `:focus-visible` globally, so scope or extract rules to avoid changing the app.
- `onSelect` fires from a node click (3D and 2D), search, the neighbor list and `select(id)`.
- There is no data update method. Call `destroy()` and create a new instance.

## Large graphs and limitations
- 3D shows a planet: every node sits on one globe and each sphere forms its own region. There is no physics. The globe rotates until a node is selected or the pointer touches it; a toolbar button pauses and resumes it. It does not start rotating when reduced motion is preferred.
- Above `simplifyAbove`, both views draw only the selected node's links; 3D also lowers node detail.
- In 3D, links are straight chords through the globe.
- 2D is used if forced, if the library or WebGL2 is missing, or if creating the 3D view throws. There is no fallback for later rendering errors.
- The neighbor panel lists at most 100 neighbors.
- 2D controls: drag or arrow keys to pan, wheel, `+`/`-` keys or toolbar buttons to zoom (no pinch gesture), click to select. 3D: drag to rotate, wheel to zoom; node dragging is disabled.
- The code uses `Map.groupBy`, so it needs a recent browser (and Node.js 21 or later for tests).

## Measure FPS
1. Open the demo with the parameters you want and keep the tab visible. Wait until the graph is drawn.
2. Click the FPS button (10 seconds), or run `await benchmark(30)` in the console (default: 10).
3. The camera rotates (3D) or the canvas pans in a circle (2D) while animation frames are counted.

The button shows average FPS, 95th-percentile frame time and node count. Record the full console result: `mode`, `nodes`, `links`, `links_drawn`, `seconds`, `frames`, `average_fps`, `p95_frame_ms`, `viewport`, `pixel_ratio`, `hidden` and `browser`. Also note the URL, hardware, GPU and display refresh rate. `requestAnimationFrame` is capped by the refresh rate, so the result is not uncapped rendering speed.

## Tests
From the repository root, run `cd graph`, then `npm test`. There are no dependencies to install. Tests cover graph logic, the synthetic fixture and layout, the vendored bundle hash, and the absence of remote URLs in top-level `.js`, `.css` and `.html` files. They do not exercise the DOM or rendering.

## Offline use and CSP
The demo loads local files and needs no CDN. Its CSP is `default-src 'self'; connect-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:`. The library injects a style tag, hence `'unsafe-inline'` for styles. The minified bundle contains `new Function` calls and the policy does not allow `'unsafe-eval'`, so check the browser console under your app's policy.

## Licenses
The module is `AGPL-3.0-only` (`package.json`). `3d-force-graph` 1.80.3 is MIT; see `lib/LICENSE.3d-force-graph`, `lib/THIRD_PARTY_LICENSES.txt` (bundled dependencies) and `lib/PROVENANCE.md` (source, hashes, versions). Keep these files when you redistribute the bundle.
