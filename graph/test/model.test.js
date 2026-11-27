import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { syntheticGraph } from '../fixture.js';
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
