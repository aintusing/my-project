import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import data from '../fixtures/events-cn-eu.js';
import world from '../fixtures/world.js';

const file = new URL('../fixtures/events-cn-eu.js', import.meta.url);
const n = data.datasets.length;
const isDate = (s) => /^\d{4}-\d\d-\d\d$/.test(s) && s <= data.generated;
const isLon = (v) => Number.isFinite(v) && Math.abs(v) <= 180;
const isLat = (v) => Number.isFinite(v) && Math.abs(v) <= 90;
const isCount = (v) => Number.isInteger(v) && v >= 0;

test('file is under 1.5 MB, has the header and no URLs', () => {
  const text = readFileSync(file, 'utf8');
  assert.ok(statSync(file).size < 1.5 * 1024 * 1024);
  assert.ok(text.startsWith('// Generated aggregate of public event data. See ATTRIBUTION-events-cn-eu.md.\n'));
  assert.doesNotMatch(text, /https?:|ftp:\/\/|www\./i);
});

test('top level shape and datasets', () => {
  assert.deepEqual(Object.keys(data), ['generated', 'datasets', 'cells', 'latest', 'timeline', 'companies']);
  assert.equal(data.generated, '2026-11-27');
  assert.deepEqual(data.companies, {});
  assert.ok(n > 0);
  assert.equal(new Set(data.datasets.map((d) => d.id)).size, n);
  for (const d of data.datasets) {
    assert.deepEqual(Object.keys(d), ['id', 'label', 'group', 'color', 'total', 'from', 'to', 'geo']);
    assert.match(d.id, /^cneu_[a-z0-9_]+$/);
    assert.match(d.label, /[а-яА-Я]/);
    assert.ok(['markets', 'conflict', 'nature', 'politics', 'security'].includes(d.group));
    assert.match(d.color, /^#[0-9a-f]{6}$/);
    assert.ok(['exact', 'country', 'none'].includes(d.geo));
    assert.ok(isCount(d.total) && d.total > 0);
    assert.ok(isDate(d.from) && isDate(d.to) && d.from <= d.to);
  }
});

test('cells are unique, valid and consistent with totals', () => {
  const seen = new Set();
  const sums = Array(n).fill(0);
  const points = new Set(Object.values(world.countries).map((c) => c.at.join()));
  for (const cell of data.cells) {
    assert.equal(cell.length, 6);
    const [lon, lat, ds, c7, c30, all] = cell;
    assert.ok(isLon(lon) && isLat(lat));
    assert.ok(Number.isInteger(ds) && ds >= 0 && ds < n);
    const { geo } = data.datasets[ds];
    assert.notEqual(geo, 'none');
    if (geo === 'country') assert.ok(points.has(`${lon},${lat}`));
    if (geo === 'exact') assert.ok(Math.abs(lon % 1) === 0.5 && Math.abs(lat % 1) === 0.5);
    assert.ok([c7, c30, all].every(isCount) && c7 <= c30 && c30 <= all && all > 0);
    const key = `${lon},${lat},${ds}`;
    assert.ok(!seen.has(key));
    seen.add(key);
    sums[ds] += all;
  }
  data.datasets.forEach((d, i) => assert.ok(sums[i] <= d.total, d.id));
});

test('latest entries are bounded, plain and located consistently', () => {
  const per = Array(n).fill(0);
  for (const e of data.latest) {
    assert.deepEqual(Object.keys(e), ['d', 'ds', 'title', 'lon', 'lat', 'country', 'weight']);
    assert.ok(isDate(e.d));
    assert.ok(Number.isInteger(e.ds) && e.ds >= 0 && e.ds < n);
    const d = data.datasets[e.ds];
    assert.ok(e.d >= d.from && e.d <= d.to);
    assert.ok(typeof e.title === 'string' && e.title.length > 0 && e.title.length <= 120);
    assert.doesNotMatch(e.title, /[<>\u0000-\u001f]|\S@\S+\.\S/);
    assert.ok((e.lon === null && e.lat === null) || (isLon(e.lon) && isLat(e.lat)));
    if (d.geo === 'none') assert.equal(e.lon, null);
    assert.ok(e.country === null || e.country in world.countries);
    assert.ok(Number.isFinite(e.weight));
    per[e.ds] += 1;
  }
  assert.ok(per.every((c) => c <= 150));
});

test('timeline months are contiguous and add up to totals', () => {
  const sums = Array(n).fill(0);
  let previous = null;
  for (const row of data.timeline) {
    assert.match(row.date, /^\d{4}-(0[1-9]|1[0-2])$/);
    const [y, m] = row.date.split('-').map(Number);
    const index = y * 12 + m;
    if (previous !== null) assert.equal(index, previous + 1);
    previous = index;
    assert.equal(row.counts.length, n);
    assert.ok(row.counts.every(isCount));
    row.counts.forEach((c, i) => { sums[i] += c; });
  }
  assert.deepEqual(sums, data.datasets.map((d) => d.total));
});
