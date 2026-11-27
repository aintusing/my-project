// Builds fixtures/snapshot.js and fixtures/world.js from public data already on disk.
// Usage: node tools/build_snapshot.mjs <catalog/out> <protocols.json> <sec_loc.json> <node_modules> <YYYY-MM-DD>
//   protocols.json: https://api.llama.fi/protocols
//   sec_loc.json:   {cik: "US-CA"} collected from SEC XBRL frames
//   node_modules:   contains world-atlas@2.0.2 and topojson-client@3.1.0
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const [catalog, protocolsPath, locPath, modules, date] = process.argv.slice(2);
if (!date) throw new Error('see usage at the top of the file');
const require = createRequire(join(resolve(modules), 'x.js'));
const { feature } = require('topojson-client');
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));

function csv(name) {
  const text = readFileSync(join(catalog, name), 'utf8').replace(/^﻿/, '');
  const rows = [[]];
  let cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ',') { rows.at(-1).push(cell); cell = ''; }
    else if (c === '\n') { rows.at(-1).push(cell.replace(/\r$/, '')); cell = ''; rows.push([]); }
    else cell += c;
  }
  const [head, ...body] = rows.filter(r => r.length > 1);
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

// Countries: names come from Intl, aliases cover spelling differences between sources.
const english = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
const russian = new Intl.DisplayNames(['ru'], { type: 'region', fallback: 'none' });
const norm = s => s.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
const codes = new Map();
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const skip = new Set(['AN', 'BU', 'CS', 'DD', 'FX', 'NT', 'SU', 'TP', 'UK', 'YD', 'YU', 'ZR', 'QO', 'EU', 'EZ', 'UN', 'ZZ']);
for (const a of letters) for (const b of letters) {
  const code = a + b, name = english.of(code);
  if (name && !skip.has(code) && !codes.has(norm(name))) codes.set(norm(name), code);
}
const aliases = {
  'United States of America': 'US', Turkey: 'TR', 'Hong Kong': 'HK', Macao: 'MO', 'British Virgin Is.': 'VG',
  'British Virgin Islands': 'VG', 'Cayman Is.': 'KY', 'Saint Vincent and the Grenadines': 'VC', 'St. Vin. and Gren.': 'VC',
  Czechia: 'CZ', 'Marshall Is.': 'MH', 'St. Kitts and Nevis': 'KN', 'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC',
  'Antigua and Barb.': 'AG', 'Antigua and Barbuda': 'AG', 'Dominican Rep.': 'DO', 'Bosnia and Herz.': 'BA', Myanmar: 'MM',
};
for (const [name, code] of Object.entries(aliases)) codes.set(norm(name), code);
const codeOf = name => codes.get(norm(name || '')) ?? null;

const round = n => Math.round(n * 100) / 100;
function polygons(geometry) {
  const list = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return list.map(p => p[0].map(([x, y]) => [round(x), round(y)]));
}
function center(rings) {
  // Mean of the largest outline: a label point, not an exact geographic centroid.
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
  let x = 0, y = 0, z = 0;
  for (const [lon, lat] of ring) {
    const l = lon * Math.PI / 180, f = lat * Math.PI / 180;
    x += Math.cos(f) * Math.cos(l); y += Math.cos(f) * Math.sin(l); z += Math.sin(f);
  }
  return [round(Math.atan2(y, x) * 180 / Math.PI), round(Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI)];
}
function atlas(file) {
  const topology = readJson(join(modules, 'world-atlas', file));
  return feature(topology, topology.objects.countries).features;
}
const points = new Map(atlas('countries-50m.json').flatMap(f => {
  const code = codeOf(f.properties.name);
  return code ? [[code, center(polygons(f.geometry))]] : [];
}));
const shapes = atlas('countries-110m.json').map(f => ({ code: codeOf(f.properties.name), rings: polygons(f.geometry) }));

// Assets.
const number = v => (v !== undefined && v !== '' && v !== 'None' && Number.isFinite(Number(v)) ? Number(v) : null);
const extra = row => Object.fromEntries((row.extra || '').split('; ').map(p => p.split('=')));
const clean = s => String(s ?? '').replace(/^'/, '').slice(0, 80);
const top = (rows, n) => [...rows].sort((a, b) => b.significance - a.significance || b.interest - a.interest).slice(0, n);
const chainsOf = new Map(readJson(protocolsPath).map(p => [`${p.name}|${p.category}`, p.chains ?? []]));
const hacks = new Map();
for (const h of csv('hacks.csv')) if (!hacks.has(h.name)) hacks.set(h.name, { date: h.date, usd: number(h.amount_usd), how: clean(h.technique) });
const locations = readJson(locPath);

const nodes = [], links = [], hubs = new Map(), missing = new Set();
function hub(kind, name, sphere) {
  const id = `${kind}:${name}`;
  if (!hubs.has(id)) { hubs.set(id, { id, name, group: kind, sphere, count: 0 }); }
  hubs.get(id).count++;
  return id;
}
function add(row, group, details, country) {
  const id = `${group}:${nodes.length}`;
  if (country && !points.has(country)) { missing.add(country); country = null; }
  const score = number(row.significance) ?? 0;
  nodes.push({
    id, name: clean(row.name), group, sphere: row.sphere, size: round(1 + (score / 28) ** 2), country,
    meta: { symbol: clean(row.symbol) || null, category: clean(row.category) || null, score, interest: number(row.interest),
      flags: row.danger_flags ? row.danger_flags.split('|') : [], ...details },
  });
  links.push({ source: id, target: hub('sphere', row.sphere, row.sphere) });
  return id;
}
for (const row of top(csv('projects.csv'), 7000)) {
  const e = extra(row);
  const id = add(row, 'project', { tvl: number(e.tvl), change7d: number(e['7d']), hack: hacks.get(row.name) ?? null }, null);
  for (const chain of (chainsOf.get(`${row.name}|${row.category}`) ?? []).slice(0, 3)) links.push({ source: id, target: hub('chain', chain, 'Сети') });
}
const coins = csv('coins.csv');
for (const row of top(coins, coins.length)) {
  const e = extra(row);
  add(row, row.category === 'мемкоин' ? 'meme' : 'coin', { mcap: number(e.mcap), volume: number(e.vol24h), change7d: number(e['7d']) }, null);
}
for (const row of csv('exchanges.csv')) {
  const e = extra(row);
  add({ ...row, category: 'биржа' }, 'exchange', { trust: number(e.trust), volumeBtc: number(e.vol_btc) }, codeOf(row.category));
}
for (const row of top(csv('stocks.csv'), 5000)) {
  const cik = Number(/CIK=(\d+)/.exec(row.url)?.[1]);
  const code = (locations[cik] ?? '').split('-')[0];
  add(row, 'stock', { exchange: clean(row.category) }, /^[A-Z]{2}$/.test(code) ? code : null);
}
for (const h of hubs.values()) nodes.push({ id: h.id, name: h.name, group: h.group, sphere: h.sphere, size: round(Math.min(24, 4 + Math.sqrt(h.count) / 2)), country: null, meta: null });

const countries = {};
for (const code of new Set([...nodes.map(n => n.country), ...shapes.map(s => s.code)].filter(Boolean))) {
  if (points.has(code)) countries[code] = { name: russian.of(code) ?? english.of(code) ?? code, at: points.get(code) };
}

const out = new URL('../fixtures/', import.meta.url);
mkdirSync(out, { recursive: true });
const write = (name, header, data) => writeFileSync(new URL(name, out), `${header}\nexport default ${JSON.stringify(data)};\n`);
write('world.js', '// Country outlines: Natural Earth (public domain) via world-atlas 2.0.2 (ISC). Generated.', { shapes, countries });
// Rows keep the file small: repeated strings become indices and empty facts are left out.
const groups = [...new Set(nodes.map(n => n.group))], spheres = [...new Set(nodes.map(n => n.sphere))];
const position = new Map(nodes.map((n, i) => [n.id, i]));
const rows = nodes.map(n => [groups.indexOf(n.group), spheres.indexOf(n.sphere), n.size, n.name, n.country ?? 0,
  n.meta ? Object.fromEntries(Object.entries(n.meta).filter(([, v]) => v !== null && v !== '')) : 0]);
const pairs = links.map(l => [position.get(l.source), position.get(l.target)]);
writeFileSync(new URL('snapshot.js', out), `// Generated snapshot. Sources: DefiLlama, CoinGecko, SEC EDGAR, Nasdaq Trader. Scores are heuristics.
const G = ${JSON.stringify(groups)};
const S = ${JSON.stringify(spheres)};
const R = ${JSON.stringify(rows)};
const L = ${JSON.stringify(pairs)};
const nodes = R.map(([g, s, size, name, country, meta], i) => ({ id: G[g] + ':' + i, name, group: G[g], sphere: S[s], size, country: country || null, meta: meta || null }));
export default { date: ${JSON.stringify(date)}, nodes, links: L.map(([a, b]) => ({ source: nodes[a].id, target: nodes[b].id })) };
`);
const by = key => nodes.reduce((m, n) => m.set(n[key], (m.get(n[key]) ?? 0) + 1), new Map());
console.log({ nodes: nodes.length, links: links.length, groups: Object.fromEntries(by('group')),
  withCountry: nodes.filter(n => n.country).length, countries: new Set(nodes.map(n => n.country).filter(Boolean)).size,
  noCoordinates: [...missing], unnamedShapes: shapes.filter(s => !s.code).length });
