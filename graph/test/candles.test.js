import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import data from '../fixtures/candles.js';
import snapshot from '../fixtures/snapshot.js';

const text = readFileSync(new URL('../fixtures/candles.js', import.meta.url), 'utf8');
const keys = (value) => Object.keys(value).sort();
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

test('file has the header, stays under 2.5 MB and carries no URLs', () => {
  assert.ok(text.startsWith('// Generated daily candles. See ATTRIBUTION-candles.md.\nexport default {'));
  assert.ok(Buffer.byteLength(text, 'utf8') < 2_500_000);
  assert.doesNotMatch(text, /:\/\/|\bwww\./i);
  assert.ok(!text.includes('�'));
});

test('top level and series follow the contract', () => {
  assert.deepEqual(keys(data), ['generated', 'series', 'source']);
  assert.ok(isDay(data.generated));
  assert.equal(data.source, 'Binance');
  assert.ok(data.series.length > 0 && data.series.length <= 120);
  for (const s of data.series) {
    assert.deepEqual(keys(s), ['candles', 'name', 'quote', 'symbol']);
    assert.equal(s.quote, 'USDT');
    assert.ok(s.candles.length >= 30 && s.candles.length <= 365, s.symbol);
  }
});

test('symbols are unique', () => {
  const symbols = data.series.map((s) => s.symbol);
  assert.equal(new Set(symbols).size, symbols.length);
});

test('series match snapshot coin or meme nodes, most significant first', () => {
  const score = data.series.map((s) => {
    const node = snapshot.nodes.find((n) => (n.group === 'coin' || n.group === 'meme')
      && n.name === s.name && n.meta?.symbol === s.symbol);
    assert.ok(node, `${s.symbol} is in the snapshot`);
    return node.meta.score;
  });
  for (let i = 1; i < score.length; i++) assert.ok(score[i - 1] >= score[i], data.series[i].symbol);
});

test('candles are real days, oldest first, ending before the generation date', () => {
  for (const { symbol, candles } of data.series) {
    let previous = '';
    for (const row of candles) {
      assert.equal(row.length, 6, symbol);
      assert.ok(isDay(row[0]) && row[0] > previous, `${symbol} ${row[0]}`);
      assert.ok(row[0] < data.generated, `${symbol} ${row[0]} is a completed day`);
      previous = row[0];
    }
  }
});

test('low <= open, close <= high with positive prices and non-negative volume', () => {
  for (const { symbol, candles } of data.series) {
    for (const [day, open, high, low, close, volume] of candles) {
      const at = `${symbol} ${day}`;
      assert.ok([open, high, low, close, volume].every(Number.isFinite), at);
      assert.ok(low > 0 && volume >= 0, at);
      assert.ok(low <= open && open <= high, at);
      assert.ok(low <= close && close <= high, at);
    }
  }
});
