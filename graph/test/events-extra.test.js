import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import data from '../fixtures/events-extra.js';

const file = new URL('../fixtures/events-extra.js', import.meta.url);
const n = data.datasets.length;
const isDate = (s) => /^\d{4}-\d\d-\d\d$/.test(s) && s <= data.generated;
const isLon = (v) => Number.isFinite(v) && Math.abs(v) <= 180;
const isLat = (v) => Number.isFinite(v) && Math.abs(v) <= 90;
const isCount = (v) => Number.isInteger(v) && v >= 0;

test('file is small, has a header and no URLs', () => {
  const text = readFileSync(file, 'utf8');
  assert.ok(statSync(file).size < 1.5 * 1024 * 1024);
  assert.ok(text.startsWith('// Generated aggregate of public event data. See ATTRIBUTION-events-extra.md.\n'));
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
    assert.match(d.label, /[а-яА-Я]/);
    assert.ok(['markets', 'conflict', 'nature', 'politics', 'security'].includes(d.group));
    assert.match(d.color, /^#[0-9a-f]{6}$/);
    assert.ok(['exact', 'country', 'none'].includes(d.geo));
    assert.ok(isCount(d.total) && d.total > 0);
    assert.ok(isDate(d.from) && isDate(d.to) && d.from <= d.to);
  }
});

test('cells are unique 1 degree grid points with consistent counts', () => {
  const seen = new Set();
  const sums = Array(n).fill(0);
  for (const [lon, lat, ds, c7, c30, all, ...rest] of data.cells) {
    assert.equal(rest.length, 0);
    assert.ok(isLon(lon) && isLat(lat));
    assert.ok(ds >= 0 && ds < n && data.datasets[ds].geo !== 'none');
    assert.ok([c7, c30, all].every(isCount) && c7 <= c30 && c30 <= all && all > 0);
    const key = `${lon},${lat},${ds}`;
    assert.ok(!seen.has(key));
    seen.add(key);
    sums[ds] += all;
  }
  data.datasets.forEach((d, i) => assert.ok(sums[i] <= d.total, d.id));
});

test('latest entries are valid and capped', () => {
  const per = Array(n).fill(0);
  for (const e of data.latest) {
    assert.deepEqual(Object.keys(e), ['d', 'ds', 'title', 'lon', 'lat', 'country', 'weight']);
    assert.ok(isDate(e.d));
    assert.ok(e.ds >= 0 && e.ds < n);
    per[e.ds] += 1;
    assert.ok(e.title.length > 0 && e.title.length <= 120);
    assert.ok((e.lon === null && e.lat === null) || (isLon(e.lon) && isLat(e.lat)));
    assert.ok(e.country === null || /^[A-Z]{2}$/.test(e.country));
    assert.ok(Number.isFinite(e.weight));
  }
  assert.ok(per.every((c) => c > 0 && c <= 150));
});

test('timeline is sorted and sums to dataset totals (snapshots excluded)', () => {
  const sums = Array(n).fill(0);
  data.timeline.forEach((row, i) => {
    assert.match(row.date, /^\d{4}-\d\d$/);
    if (i) assert.ok(data.timeline[i - 1].date < row.date);
    assert.equal(row.counts.length, n);
    row.counts.forEach((c, j) => { assert.ok(isCount(c)); sums[j] += c; });
  });
  data.datasets.forEach((d, i) => { if (d.id !== 'ofac') assert.equal(sums[i], d.total, d.id); });
});
