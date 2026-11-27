import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { cellsFor, latestFor, mergeEvents, sortEvents, totalOf } from '../activity.js';
import { sortAssets } from '../browse.js';
import { headlinesFor } from '../newsroom.js';
import { packClusters } from '../scheme.js';
import { coarsen, inRing, place, project, unproject } from '../earth.js';
import { syntheticGraph } from '../fixture.js';
import snapshot from '../fixtures/snapshot.js';
import world from '../fixtures/world.js';
import { colorer, riskOf, sphereColors } from '../palette.js';
import { recentHacks, summarize } from '../panel.js';
import { buildModel, escapeHtml, filterBySphere, globe, layout, neighbors, search, spheres } from '../model.js';

const data = {
  nodes: [
    { id: 'a', name: 'Alpha', sphere: 'X' }, { id: 'b', name: 'Alphabet', sphere: 'Y' },
    { id: 'c', name: 'Gamma', sphere: 'Y' }, { name: 'no id' },
  ],
  links: [
    { source: 'a', target: 'b' }, { source: 'b', target: 'a' }, { source: 'b', target: 'c' },
    { source: 'a', target: 'missing' }, { source: 'a', target: 'a' },
  ],
};
const model = buildModel(data);

test('invalid nodes, dangling, duplicate and self links are dropped', () => {
  assert.equal(model.nodes.size, 3);
  assert.equal(model.links.length, 2);
});

test('sphere filter keeps members and direct neighbors', () => {
  const view = filterBySphere(model, 'X');
  assert.deepEqual(view.nodes.map(n => n.id).sort(), ['a', 'b']);
  assert.equal(view.links.length, 1);
  assert.deepEqual(spheres(model), ['X', 'Y']);
});

test('search prefers exact, then prefix, then substring', () => {
  const all = [...model.nodes.values()];
  assert.equal(search(all, 'alpha').id, 'a');
  assert.equal(search(all, 'alphab').id, 'b');
  assert.equal(search(all, 'amm').id, 'c');
  assert.equal(search(all, 'zzz'), null);
  assert.equal(search(all, '  '), null);
});

test('neighbors are listed for the selected node', () => {
  assert.deepEqual(neighbors(model, 'b').map(n => n.id).sort(), ['a', 'c']);
  assert.deepEqual(neighbors(model, 'missing'), []);
});

test('external strings are escaped for labels', () => {
  assert.ok(!escapeHtml('<img src=x onerror=1>').includes('<'));
});

test('fixture has 5000 labeled synthetic nodes with a finite layout', () => {
  const graph = buildModel(syntheticGraph(5000));
  assert.equal(graph.nodes.size, 5000);
  assert.ok([...graph.nodes.values()].every(n => n.name.startsWith('Синтетическ')));
  const at = layout([...graph.nodes.values()]);
  assert.equal(at.size, 5000);
  assert.ok([...at.values()].every(p => [p.x, p.y].every(Number.isFinite)));
});

test('globe puts every node on one planet with compact spheres', () => {
  const nodes = [...buildModel(syntheticGraph(2000)).nodes.values()];
  const { radius, positions } = globe(nodes);
  assert.equal(positions.size, 2000);
  assert.ok([...positions.values()].every(p => Math.abs(Math.hypot(p.x, p.y, p.z) - radius) < 1e-6));
  assert.equal(new Set([...positions.values()].map(p => `${p.x},${p.y},${p.z}`)).size, 2000);
  // Members of a sphere stay together: their mean direction is far from the planet center.
  const spread = [...Map.groupBy(nodes, n => n.sphere).values()].map(group => Math.hypot(
    ...['x', 'y', 'z'].map(k => group.reduce((sum, n) => sum + positions.get(n.id)[k], 0) / group.length)) / radius);
  assert.ok(spread.reduce((a, b) => a + b) / spread.length > 0.75);
});

test('vendored bundle matches the recorded hash', () => {
  const bundle = readFileSync(new URL('../lib/3d-force-graph.min.js', import.meta.url));
  const record = readFileSync(new URL('../lib/PROVENANCE.md', import.meta.url), 'utf8');
  assert.ok(record.includes(createHash('sha256').update(bundle).digest('hex')));
});

test('module sources contain no remote URLs', () => {
  const root = new URL('../', import.meta.url);
  for (const name of readdirSync(root).filter(f => /\.(js|css|html)$/.test(f))) {
    assert.doesNotMatch(readFileSync(new URL(name, root), 'utf8'), /https?:\/\//, name);
  }
});

test('globe projection round-trips and hides the far side', () => {
  const [x, y, z] = project(30, 40, 10, 24);
  assert.ok(z > 0);
  const [lon, lat] = unproject(x, y, 10, 24);
  assert.ok(Math.abs(lon - 30) < 1e-6 && Math.abs(lat - 40) < 1e-6);
  assert.ok(project(-170, -40, 10, 24)[2] < 0);
  assert.equal(unproject(1, 1, 0, 0), null);
  assert.ok(inRing([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  assert.ok(!inRing([3, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
});

test('snapshot is consistent: known countries, valid links, no URLs', () => {
  const real = buildModel(snapshot);
  assert.equal(real.nodes.size, snapshot.nodes.length);
  assert.equal(real.links.length, snapshot.links.length);
  assert.match(snapshot.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(snapshot.nodes.every(n => !n.country || world.countries[n.country]));
  assert.doesNotMatch(JSON.stringify(snapshot), /https?:\/\//);
});

test('assets without a country go to orbit instead of a guessed place', () => {
  const nodes = [...buildModel(snapshot).nodes.values()];
  const { ground, orbit } = place(nodes, world.countries);
  assert.ok(ground.length > 1000 && orbit.length > 1000);
  assert.ok(ground.every(i => i.node.country));
  assert.ok(orbit.every(i => !i.node.country));
  assert.equal(ground.length + orbit.length, nodes.filter(n => !['sphere', 'chain'].includes(n.group)).length);
});

test('risk and summaries come from the data', () => {
  assert.equal(riskOf({ meta: null }), 'unknown');
  assert.equal(riskOf({ meta: { flags: [] } }), 'clear');
  assert.equal(riskOf({ meta: { flags: ['был взлом'] } }), 'hacked');
  const s = summarize([...buildModel(snapshot).nodes.values()]);
  assert.ok(s.assets > 4000 && s.countries[0][0] === 'US');
  assert.ok(s.significant[0].meta.score >= s.significant.at(-1).meta.score);
  const colors = sphereColors(['b', 'a']);
  assert.notEqual(colorer('sphere', colors)({ sphere: 'a' }), colorer('sphere', colors)({ sphere: 'b' }));
});

test('hack feed respects the period and is newest first', () => {
  const nodes = [
    { meta: { hack: { date: '2026-11-20' } } }, { meta: { hack: { date: '2026-01-05' } } },
    { meta: { hack: { date: '2020-01-01' } } }, { meta: {} },
  ];
  assert.equal(recentHacks(nodes, '2026-11-27', '30').length, 1);
  assert.equal(recentHacks(nodes, '2026-11-27', '365').length, 2);
  assert.deepEqual(recentHacks(nodes, '2026-11-27', '0').map(n => n.meta.hack.date), ['2026-11-20', '2026-01-05', '2020-01-01']);
});

test('event cells follow the period and the enabled datasets', () => {
  const events = {
    datasets: [{ id: 'a' }, { id: 'b' }],
    cells: [[0, 0, 0, 0, 2, 5], [1, 1, 1, 3, 4, 9]],
    latest: [{ d: '2026-01-02', ds: 0 }, { d: '2026-03-04', ds: 1 }],
  };
  assert.equal(totalOf(cellsFor(events, new Set(['a', 'b']), 'all')), 14);
  assert.equal(totalOf(cellsFor(events, new Set(['a', 'b']), '7')), 3);
  assert.equal(totalOf(cellsFor(events, new Set(['a']), '30')), 2);
  assert.deepEqual(latestFor(events, new Set(['a', 'b'])).map(e => e.d), ['2026-03-04', '2026-01-02']);
});

test('event files merge with shifted datasets and a monthly timeline', () => {
  const part = id => ({ generated: '2026-11-27', datasets: [{ id }], cells: [[1, 2, 0, 1, 1, 1]],
    latest: [{ d: '2026-11-01', ds: 0, weight: id === 'a' ? 1 : 9 }], timeline: [{ date: '2026-11-02', counts: [4] }], companies: {} });
  const all = mergeEvents([part('a'), null, part('b')]);
  assert.deepEqual(all.datasets.map(d => d.id), ['a', 'b']);
  assert.equal(all.cells[1][2], 1);
  assert.deepEqual(all.timeline, [{ date: '2026-11', counts: [4, 4] }]);
  assert.equal(sortEvents(all, new Set(['a', 'b']), 'big', 'b').length, 1);
  assert.equal(mergeEvents([null]), null);
});

test('asset sorting skips missing values and respects the type filter', () => {
  const nodes = [
    { name: 'b', group: 'coin', meta: { score: 10, change7d: -5 } }, { name: 'a', group: 'coin', meta: { score: 50, change7d: 3 } },
    { name: 'c', group: 'stock', meta: { score: 90 } }, { name: 'hub', group: 'sphere', meta: null },
  ];
  assert.deepEqual(sortAssets(nodes, 'score').map(n => n.name), ['c', 'a', 'b']);
  assert.deepEqual(sortAssets(nodes, 'down').map(n => n.name), ['b', 'a']);
  assert.deepEqual(sortAssets(nodes, 'name', 'coin').map(n => n.name), ['a', 'b']);
});

test('headlines filter by category and text and sort by time or tier', () => {
  const news = {
    sources: [{ name: 'Alpha', category: 'x', tier: 2 }, { name: 'Beta', category: 'y', tier: 1 }],
    headlines: [{ t: '2026-11-02T10:00', s: 0, title: 'one' }, { t: '2026-11-01T10:00', s: 1, title: 'two' }],
  };
  assert.deepEqual(headlinesFor(news).map(h => h.title), ['one', 'two']);
  assert.deepEqual(headlinesFor(news, { sort: 'tier' }).map(h => h.title), ['two', 'one']);
  assert.deepEqual(headlinesFor(news, { category: 'y' }).map(h => h.title), ['two']);
  assert.deepEqual(headlinesFor(news, { query: 'ALPHA' }).map(h => h.title), ['one']);
});

test('scheme packs sphere clusters without overlap and puts the biggest in the core', () => {
  const { clusters, at } = packClusters([...buildModel(snapshot).nodes.values()]);
  assert.equal(at.size, snapshot.nodes.length);
  for (const a of clusters) for (const b of clusters) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r);
  const first = clusters[0];
  assert.ok(first.members[0].size >= first.members.at(-1).size);
  assert.ok(Math.hypot(at.get(first.members[0].id).x - first.x, at.get(first.members[0].id).y - first.y) < 1);
});

test('coarse event cells keep every event', () => {
  const d = { id: 'a' }, cells = [{ lon: 0.5, lat: 0.5, count: 2, dataset: d }, { lon: 1.5, lat: 1.5, count: 5, dataset: d }, { lon: 40, lat: 0, count: 1, dataset: d }];
  const out = coarsen(cells, 3);
  assert.equal(out.length, 2);
  assert.equal(out.reduce((n, c) => n + c.count, 0), 8);
  assert.equal(out[0].lon, 1.5);
});
