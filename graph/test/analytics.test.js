// Formula-level checks with hand-computed expectations.
import assert from 'node:assert/strict';
import test from 'node:test';
import * as A from '../analytics.js';

const near = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) < eps, `${actual} != ${expected}`);

test('Welford mean, sample deviation and z-score', () => {
  const history = [2, 4, 4, 4, 5, 5, 7, 9, 5, 5]; // mean 5, sum of squares 32
  const r = A.temporalAnomaly(history, 11);
  near(r.mean, 5);
  near(r.stdDev, Math.sqrt(32 / 9));
  near(r.zScore, 6 / Math.sqrt(32 / 9));
  assert.equal(r.severity, 'critical');
  assert.equal(A.temporalAnomaly(history.slice(1), 11), null);
  assert.deepEqual([1.49, 1.5, 2, 3].map(A.baselineSeverity), ['normal', 'medium', 'high', 'critical']);
});

test('monthly timeline: first month skipped, current month divided by completed days', () => {
  const timeline = [{ date: '2025-10', counts: [999] }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(2025, 10 + i, 1)), days = new Date(Date.UTC(2025, 11 + i, 0)).getUTCDate();
    timeline.push({ date: d.toISOString().slice(0, 7), counts: [days * (i % 2 ? 11 : 9)] });
  }
  timeline.push({ date: '2026-11', counts: [300] });
  const [a] = A.timelineAnomalies({ generated: '2026-11-11', datasets: [{ id: 'usgs_quakes', label: 'X' }], timeline });
  assert.equal(a.samples, 12);
  near(a.mean, 10);
  near(a.current, 30);
  near(a.zScore, 20 / Math.sqrt(12 / 11));
});

test('convergence: 25 per type plus capped volume, three types in one cell', () => {
  assert.equal(A.scoreGeoCell(3, 4), 83);
  assert.equal(A.scoreGeoCell(3, 500), 100);
  const datasets = ['gdelt_protest', 'gdelt_conflict', 'usgs_quakes', 'gdelt_aid'].map(id => ({ id, geo: 'exact' }));
  const cells = [[10.5, 20.5, 0, 1, 1, 1], [10.5, 20.5, 1, 2, 2, 2], [10.5, 20.5, 2, 1, 1, 1], [10.5, 20.5, 3, 9, 9, 9], [0.5, 0.5, 0, 5, 5, 5]];
  const found = A.convergenceCells({ datasets, cells });
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].score, found[0].total, found[0].types.length], [83, 4, 3]);
});

test('Jaccard, clustering with tier choice, velocity', () => {
  near(A.jaccardSimilarity(new Set(['a', 'b', 'c']), new Set(['b', 'c', 'd'])), 0.5);
  const t = Date.UTC(2026, 10, 27, 10);
  const item = (title, source, tier, minutes) => ({ title, source, tier, time: t + minutes * 60000 });
  const clusters = A.clusterNews([item('Explosion rocks harbor district overnight', 'a', 3, 0),
    item('Explosion rocks harbor district', 'b', 1, 30), item('Parliament passes budget', 'c', 2, 5)]);
  const big = clusters.find(c => c.items.length === 2);
  assert.equal(clusters.length, 2);
  assert.deepEqual([big.tier, big.sources, big.title], [1, 2, 'Explosion rocks harbor district']);
  const v = A.calculateVelocity(big);
  assert.deepEqual([v.sourcesPerHour, v.level], [4, 'elevated']);
});

test('keyword spike thresholds and source diversity', () => {
  assert.equal(A.evaluateSpike(4, 0).isSpike, false);
  assert.equal(A.evaluateSpike(5, 0).isSpike, true);
  assert.equal(A.evaluateSpike(6, 2).isSpike, false);
  assert.equal(A.evaluateSpike(7, 2).multiplier, 3.5);
  const now = Date.UTC(2026, 10, 27);
  const items = [{ title: 'Quiet older story', source: 'a', time: now - 10 * 3600000 },
    ...Array.from({ length: 5 }, (_, i) => ({ title: `Volcano alert ${i}`, source: String(i % 2), time: now - i * 60000 }))];
  assert.ok(A.keywordSpikes(items).some(s => s.term === 'volcano' && s.count === 5 && s.sources === 2));
  assert.ok(!A.keywordSpikes(items.map(i => ({ ...i, source: 'a' }))).length);
});

test('keyword threat classes and headline importance', () => {
  assert.equal(A.classifyByKeyword('Country declares war'), 'critical');
  assert.equal(A.classifyByKeyword('A quiet afternoon'), 'info');
  // tier 1 (35) + 2 sources (24)
  assert.equal(A.scoreImportance({ title: 'A quiet afternoon', tier: 1, sources: 2 }), 59);
  assert.equal(A.recencyWeight(0 + 1, 1 + 4 * 3600000), 0.75);
  assert.equal(A.recencyWeight(1, 1 + 40 * 3600000), 0.5);
});

test('country instability terms and blend', () => {
  assert.equal(A.gdeltEscalation(25, 20), 0); // ratio 1.125, inside the deadband
  assert.equal(A.gdeltEscalation(100, 20), 70); // ratio 3
  assert.equal(A.gdeltEscalation(55, 20), Math.round(Math.log(1.5) / Math.log(2.4) * 70));
  assert.equal(A.gdeltLevel(54, 200, 'conflict'), 35);
  assert.equal(A.gdeltLevel(54, 199, 'conflict'), 0);
  assert.equal(A.gdeltLevel(10, 200, 'protest'), 35);
  assert.equal(A.earthquakeBoost([5.4, 5.5, 6.5, 7.5]), 17);
  // 50*.4 + (40*.25 + 60*.3 + 50*.25)*.6 + urgency 3 + quake 2 = 49.3
  assert.equal(A.instabilityScore({ baseline: 50, unrest: 40, conflict: 60, information: 50, quake: 2 }), 49);
  assert.equal(A.instabilityScore({ baseline: 50, unrest: null, conflict: null, information: null, quake: null }), 20);
});

test('strategic risk roll-up', () => {
  // weighted mean of equal values is the value: 50*0.7+15
  assert.deepEqual(A.strategicRisk([50, 50, 50, 50, 50, 1]), { score: 50, level: 'medium' });
  // (100*1 + 0*0.85) / 1.85 * 0.7 + 15 = 52.8
  assert.equal(A.strategicRisk([0, 100]).score, 53);
  assert.equal(A.strategicRisk([]), null);
});

test('hotspot escalation', () => {
  const r = A.escalationScore({ matches: 2, breaking: true, velocity: 1, cii: 40, geoScore: 75, geoTypes: 2, baseline: 4 });
  assert.deepEqual([r.news, r.geo, r.military], [65, 95, 0]);
  // raw = 22.75 + 10 + 23.75 = 56.5; 4*0.3 + (1 + 2.26)*0.7
  near(r.score, 3.482);
});

test('correlation score, proximity and country locator', () => {
  near(A.correlationScore([{ type: 'a', severity: 50 }, { type: 'a', severity: 80 }, { type: 'b', severity: 40 }, { type: 'c', severity: 20 }],
    { a: 0.5, b: 0.25, c: 0.25 }), 67);
  near(A.haversineKm(0, 0, 0, 1), 111.195, 0.01);
  assert.equal(A.proximityClusters([{ lat: 0, lon: 0 }, { lat: 0, lon: 4 }, { lat: 0, lon: 8 }, { lat: 40, lon: 40 }], 500)[0].length, 3);
  const locate = A.countryLocator([{ code: 'XX', rings: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] }]);
  assert.deepEqual([locate(5, 5), locate(10.3, 5), locate(30, 30)], ['XX', 'XX', null]);
});

test('related assets: 300 km, three per layer, middle vertex of a line', () => {
  const point = i => ({ name: `p${i}`, lon: i, lat: 0 });
  const layers = [{ id: 'nuclear-facilities', items: [1, 2, 3, 0.5, 9].map(point) },
    { id: 'pipelines', items: [{ name: 'line', path: [[50, 0], [0.2, 0], [60, 0]] }] }, { id: 'mines', items: [point(0)] }];
  const found = A.relatedAssets({ lat: 0, lon: 0 }, layers);
  assert.deepEqual(found.map(x => x.name), ['line', 'p0.5', 'p1', 'p2']);
});

test('null inputs and speed on synthetic maximum load', () => {
  const empty = A.analyze({ events: null, news: null, layers: [], nodes: [], countries: {} });
  assert.deepEqual([empty.index.length, empty.risk, empty.spikes.length], [0, null, 0]);
  const words = ['iran', 'strike', 'market', 'protest', 'harbor', 'budget', 'storm', 'talks', 'bitcoin', 'sanctions', 'london', 'quake'];
  const headlines = Array.from({ length: 4000 }, (_, i) => ({ s: i % 40, t: new Date(Date.UTC(2026, 10, 27) - i * 60000).toISOString(),
    title: `${words[i % 12]} ${words[(i * 5 + 1) % 11]} item${i % 700} region${i % 97}` }));
  const datasets = ['gdelt_protest', 'gdelt_conflict', 'usgs_quakes'].map(id => ({ id, geo: 'exact' }));
  const cells = Array.from({ length: 30000 }, (_, i) => [(i % 360) - 179.5, (Math.floor(i / 360) % 140) - 69.5, i % 3, 2, 5, 9]);
  const ctx = { events: { generated: '2026-11-27', datasets, cells, latest: [], timeline: [] }, layers: [], nodes: [], countries: {},
    news: { sources: Array.from({ length: 40 }, (_, i) => ({ name: `s${i}`, tier: 1 + i % 4 })), headlines } };
  const start = performance.now();
  const first = A.analyze(ctx);
  const ms = performance.now() - start;
  assert.equal(A.analyze(ctx), first);
  console.log(`analyze: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 1500, `${ms} ms`);
});
