import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import events from '../fixtures/events.js';
import snapshot from '../fixtures/snapshot.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const source = read('../fixtures/events.js');
const notes = read('../ATTRIBUTION-events.md');
const { generated, datasets, cells, latest, timeline, companies } = events;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const count = (n) => Number.isInteger(n) && n >= 0;
const onMap = (lon, lat) => Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
const sum = (list) => list.reduce((a, b) => a + b, 0);
const keys = (object, expected) => assert.deepEqual(Object.keys(object).sort(), expected.split(' ').sort());

test('file is small, headed by the comment and free of URLs', () => {
  assert.ok(Buffer.byteLength(source) < 2_500_000);
  assert.ok(source.startsWith('// Generated aggregate of public event data. See ATTRIBUTION-events.md.\nexport default {'));
  assert.doesNotMatch(source, /(https?|ftp):\/\/|\bwww\./i);
  keys(events, 'generated datasets cells latest timeline companies');
  assert.ok(isDay(generated));
});

test('datasets follow the contract', () => {
  assert.equal(new Set(datasets.map((d) => d.id)).size, datasets.length);
  for (const d of datasets) {
    keys(d, 'id label group color total from to geo');
    assert.match(d.label, /[а-яё]/i);
    assert.ok(['markets', 'conflict', 'nature', 'politics'].includes(d.group));
    assert.match(d.color, /^#[0-9a-f]{6}$/i);
    assert.ok(['exact', 'country'].includes(d.geo));
    assert.ok(count(d.total) && d.total > 0);
    assert.ok(isDay(d.from) && isDay(d.to) && d.from <= d.to && d.to <= generated);
  }
  assert.ok(sum(datasets.map((d) => d.total)) >= 300_000);
});

test('cells are valid and match the documented unlocated counts', () => {
  const placed = datasets.map(() => 0);
  const seen = new Set();
  for (const cell of cells) {
    assert.equal(cell.length, 6);
    const [lon, lat, ds, week, month, all] = cell;
    assert.ok(onMap(lon, lat) && datasets[ds]);
    assert.ok([week, month, all].every(count) && week <= month && month <= all && all > 0);
    seen.add(`${lon},${lat},${ds}`);
    placed[ds] += all;
  }
  assert.equal(seen.size, cells.length);
  datasets.forEach((d, i) => {
    const row = notes.split('\n').find((line) => line.startsWith(`| ${d.id} |`));
    assert.ok(row, `no attribution row for ${d.id}`);
    const [, , total, unlocated] = row.split('|').map((v) => v.trim());
    assert.equal(Number(total), d.total, d.id);
    assert.equal(d.total - placed[i], Number(unlocated), d.id);
  });
});

test('timeline adds up to the totals and the cell periods', () => {
  const dates = timeline.map((t) => t.date);
  assert.deepEqual(dates, [...new Set(dates)].sort());
  for (const t of timeline) {
    assert.ok(isDay(t.date));
    assert.equal(t.counts.length, datasets.length);
    assert.ok(t.counts.every(count));
  }
  datasets.forEach((d, i) => {
    assert.equal(sum(timeline.map((t) => t.counts[i])), d.total, d.id);
    const active = timeline.filter((t) => t.counts[i]);
    assert.equal(active[0].date, d.from);
    assert.equal(active.at(-1).date, d.to);
    // located events of a period can never exceed all events of that period
    for (const [days, column] of [[7, 3], [30, 4]]) {
      const inPeriod = timeline.filter((t) => (Date.parse(generated) - Date.parse(t.date)) / 864e5 < days);
      const located = sum(cells.filter((c) => c[2] === i).map((c) => c[column]));
      assert.ok(located <= sum(inPeriod.map((t) => t.counts[i])), `${d.id} ${days}d`);
    }
  });
});

test('latest events are short, located and capped', () => {
  datasets.forEach((d, i) => {
    const own = latest.filter((e) => e.ds === i);
    assert.ok(own.length <= 150, d.id);
    if (d.id.startsWith('gdelt_')) assert.ok(own.every((e) => e.title.startsWith('По СМИ (авто-кодирование): ')));
  });
  for (const e of latest) {
    keys(e, 'd ds title lon lat country weight');
    assert.ok(datasets[e.ds] && isDay(e.d) && e.d <= generated);
    assert.ok(e.title.length > 0 && e.title.length <= 120);
    assert.doesNotMatch(e.title, /[<>\u0000-\u001f]/);
    assert.ok(onMap(e.lon, e.lat) && Number.isFinite(e.weight));
    assert.ok(e.country === null || /^[A-Z]{2}$/.test(e.country));
  }
});

test('companies refer to stock nodes of the snapshot', () => {
  const stocks = new Set(snapshot.nodes.filter((n) => n.group === 'stock').map((n) => n.name));
  if (!datasets.some((d) => d.group === 'markets')) assert.deepEqual(companies, {});
  for (const [name, c] of Object.entries(companies)) {
    assert.ok(stocks.has(name), name);
    keys(c, 'total form4 current last');
    assert.ok(count(c.total) && c.form4 + c.current <= c.total && isDay(c.last));
  }
});
