import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import data from '../fixtures/layers.js';

const text = readFileSync(new URL('../fixtures/layers.js', import.meta.url), 'utf8');
const attribution = readFileSync(new URL('../ATTRIBUTION.md', import.meta.url), 'utf8');

const EXPECTED = {
  'stock-exchanges': ['finance', 'points'],
  'financial-centers': ['finance', 'points'],
  'central-banks': ['finance', 'points'],
  'commodity-hubs': ['finance', 'points'],
  'economic-centers': ['finance', 'points'],
  ports: ['infra', 'points'],
  pipelines: ['infra', 'lines'],
  'ai-datacenters': ['infra', 'points'],
  'strategic-waterways': ['infra', 'points'],
  'critical-minerals': ['infra', 'points'],
  mines: ['infra', 'points'],
  spaceports: ['infra', 'points'],
  'nuclear-facilities': ['security', 'points'],
  'military-bases': ['security', 'points'],
  'conflict-zones': ['security', 'lines'],
  hotspots: ['security', 'points'],
};

const items = data.layers.flatMap((layer) => layer.items.map((item) => ({ layer, item })));
const isText = (s) => typeof s === 'string' && s.length > 0 && s.length <= 140 && s === s.trim();
const isCoordinate = (lon, lat) => Number.isFinite(lon) && Number.isFinite(lat)
  && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;

test('header names the source, commit and licence', () => {
  assert.match(text, /^\/\/ Derived from koala73\/worldmonitor at 055a1fd, AGPL-3\.0-only\. Generated\./);
  assert.equal(data.commit, '055a1fd');
});

test('file stays under 1.5 MB', () => {
  assert.ok(Buffer.byteLength(text) < 1_500_000);
});

test('layers match the expected ids, groups and kinds', () => {
  assert.deepEqual(
    Object.fromEntries(data.layers.map((l) => [l.id, [l.group, l.kind]])),
    EXPECTED,
  );
  assert.equal(data.layers.length, Object.keys(EXPECTED).length, 'duplicate layer id');
});

test('every layer has the contract fields, a Russian label and a hex colour', () => {
  for (const layer of data.layers) {
    assert.deepEqual(Object.keys(layer).sort(), ['color', 'group', 'id', 'items', 'kind', 'label'], layer.id);
    assert.match(layer.label, /[а-яё]/i, layer.id);
    assert.match(layer.color, /^#[0-9a-f]{6}$/, layer.id);
    assert.ok(layer.items.length > 0, layer.id);
  }
  assert.equal(new Set(data.layers.map((l) => l.color)).size, data.layers.length, 'duplicate colour');
});

test('items have only the contract keys and a bounded name', () => {
  for (const { layer, item } of items) {
    const keys = layer.kind === 'points' ? ['info', 'lat', 'lon', 'name'] : ['info', 'name', 'path'];
    assert.deepEqual(Object.keys(item).sort(), keys, `${layer.id}: ${item.name}`);
    assert.ok(isText(item.name), `${layer.id}: ${item.name}`);
  }
});

test('point coordinates are valid', () => {
  for (const { layer, item } of items.filter((x) => x.layer.kind === 'points')) {
    assert.ok(isCoordinate(item.lon, item.lat), `${layer.id}: ${item.name}`);
  }
});

test('line paths have valid [lon, lat] vertices rounded to 2 decimals', () => {
  for (const { layer, item } of items.filter((x) => x.layer.kind === 'lines')) {
    const where = `${layer.id}: ${item.name}`;
    assert.ok(item.path.length >= 2, where);
    for (const vertex of item.path) {
      assert.equal(vertex.length, 2, where);
      assert.ok(isCoordinate(...vertex), where);
      for (const n of vertex) assert.equal(n, Math.round(n * 100) / 100, where);
    }
  }
});

test('info holds at most four Russian-labelled non-empty strings', () => {
  for (const { layer, item } of items) {
    const where = `${layer.id}: ${item.name}`;
    assert.ok(Array.isArray(item.info) && item.info.length <= 4, where);
    for (const row of item.info) {
      assert.equal(row.length, 2, where);
      assert.match(row[0], /[а-яё]/i, where);
      assert.ok(isText(row[1]), `${where}: ${row[0]}`);
    }
  }
});

test('the output contains no URLs', () => {
  assert.doesNotMatch(text, /:\/\/|\bwww\.|\bmailto:/i);
  assert.doesNotMatch(JSON.stringify(data), /\b[a-z0-9-]+\.(com|org|net|io|ai|gov|edu)\b\//i);
});

test('ATTRIBUTION.md lists every layer with its current item count', () => {
  const rows = [...attribution.matchAll(/^\| `([a-z-]+)` \|.*\| (\d+) \|\r?$/gm)];
  assert.deepEqual(
    Object.fromEntries(rows.map(([, id, count]) => [id, Number(count)])),
    Object.fromEntries(data.layers.map((l) => [l.id, l.items.length])),
  );
});

test('the skipped undersea cable dataset is absent and documented', () => {
  assert.ok(data.layers.every((l) => !l.id.includes('cable')));
  assert.match(attribution, /UNDERSEA_CABLES/);
});
