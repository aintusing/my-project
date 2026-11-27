import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import data from '../fixtures/sources.js';

const text = readFileSync(new URL('../fixtures/sources.js', import.meta.url), 'utf8');
const keys = (value) => Object.keys(value).sort();

test('file has the header, stays under 1.5 MB and carries no URLs', () => {
  assert.ok(text.startsWith('// Generated source registry and headline snapshot. See ATTRIBUTION-sources.md.\nexport default {'));
  assert.ok(Buffer.byteLength(text, 'utf8') < 1_500_000);
  assert.doesNotMatch(text, /:\/\/|\bwww\.|rss-proxy/i);
  assert.ok(!text.includes('����'));
});

test('top level matches the contract and counts are consistent', () => {
  assert.deepEqual(keys(data), ['categories', 'generated', 'headlines', 'ok', 'sources', 'total']);
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(data.total, data.sources.length);
  assert.equal(data.ok, data.sources.filter((s) => s.status === 'ok').length);
  assert.ok(data.total >= 500, 'hundreds of sources registered');
});

test('categories are unique, labelled in Russian and all used', () => {
  const ids = data.categories.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of data.categories) {
    assert.deepEqual(keys(c), ['id', 'label']);
    assert.match(c.label, /[А-Яа-яЁё]|^IPO$/);
  }
  assert.deepEqual([...new Set(data.sources.map((s) => s.category))].sort(), [...ids].sort());
});

test('sources follow the schema', () => {
  for (const s of data.sources) {
    assert.deepEqual(keys(s), ['category', 'items', 'latest', 'name', 'status', 'tier']);
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.ok(s.tier === null || Number.isInteger(s.tier));
    assert.ok(s.status === 'ok' || s.status === 'failed');
    assert.ok(Number.isInteger(s.items));
    assert.equal(s.items > 0, s.status === 'ok');
    assert.ok(s.latest === null || /^\d{4}-\d{2}-\d{2}$/.test(s.latest));
    if (s.status === 'failed') assert.equal(s.latest, null);
  }
});

test('headlines are bounded, recent, plain text and newest first', () => {
  assert.ok(data.headlines.length > 0 && data.headlines.length <= 4000);
  const end = Date.parse(`${data.generated}T23:59:59Z`) + 10 * 60_000;
  const start = Date.parse(`${data.generated}T00:00:00Z`) - 30 * 86_400_000;
  const counts = new Map();
  let previous = '9999';
  for (const h of data.headlines) {
    assert.deepEqual(keys(h), ['s', 't', 'title']);
    assert.match(h.t, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    assert.ok(h.t <= previous, 'sorted newest first');
    previous = h.t;
    const at = Date.parse(`${h.t}Z`);
    assert.ok(at >= start && at <= end, `date in window: ${h.t}`);
    const source = data.sources[h.s];
    assert.equal(source?.status, 'ok');
    assert.ok(h.t.slice(0, 10) <= source.latest);
    assert.ok(h.title.length > 0 && h.title.length <= 160);
    assert.doesNotMatch(h.title, /<\/?[a-z][^<>]*>|[\u0000-\u001f]/i);
    counts.set(h.s, (counts.get(h.s) ?? 0) + 1);
  }
  assert.ok(Math.max(...counts.values()) <= 8);
});
