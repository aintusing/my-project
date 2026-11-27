// Extracts static geographic datasets from a local clone of koala73/worldmonitor
// (AGPL-3.0-only) into fixtures/layers.js. See ../ATTRIBUTION.md.
//
//   node tools/build_layers.mjs <worldmonitor dir>
//
// Read-only on the source, no network, no dependencies. Only the array literals
// are evaluated, each in an empty node:vm context; no repository module is imported.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const COMMIT = '055a1fd';
const MAX_BYTES = 1_500_000;
const MAX_STRING = 140;
const OUTPUT = path.join(import.meta.dirname, '..', 'fixtures', 'layers.js');

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('usage: node tools/build_layers.mjs <worldmonitor dir>');
  process.exit(2);
}

const read = (file) => fs.readFileSync(path.join(sourceDir, file), 'utf8');

// The output header names a commit, so refuse to build from any other checkout.
function assertCommit() {
  const head = read('.git/HEAD').trim();
  let sha = head;
  if (head.startsWith('ref: ')) {
    const ref = head.slice(5);
    if (fs.existsSync(path.join(sourceDir, '.git', ref))) {
      sha = read(`.git/${ref}`).trim();
    } else {
      const line = read('.git/packed-refs').split('\n').find((l) => l.trim().endsWith(` ${ref}`));
      sha = line ? line.split(' ')[0] : '';
    }
  }
  if (!sha.startsWith(COMMIT)) {
    throw new Error(`source is at "${sha.slice(0, 12)}", expected ${COMMIT}`);
  }
}

/** Returns the array literal assigned to `const <name>` in a TypeScript file. */
function extractArray(file, name) {
  const source = read(file);
  const declaration = new RegExp(String.raw`\bconst ${name}\b[^=;]*=\s*(?=\[)`).exec(source);
  if (!declaration) throw new Error(`${file}: array literal "${name}" not found`);
  const start = declaration.index + declaration[0].length;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (c === '/' && source[i + 1] === '/') {
      i = source.indexOf('\n', i);
      if (i < 0) break;
    } else if (c === '/' && source[i + 1] === '*') {
      i = source.indexOf('*/', i + 2) + 1;
      if (i < 1) break;
    } else if (c === "'" || c === '"' || c === '`') {
      for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
    } else if (c === '[' || c === '{' || c === '(') {
      depth++;
    } else if (c === ']' || c === '}' || c === ')') {
      if (--depth === 0) {
        const literal = source.slice(start, i + 1);
        const value = vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 5000 });
        const plain = JSON.parse(JSON.stringify(value));
        if (!plain.length) throw new Error(`${file}: "${name}" is empty`);
        return plain;
      }
    }
  }
  throw new Error(`${file}: unterminated literal "${name}"`);
}

const URL_PATTERN = /\b(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:)[^\s"'<>)\]]*/gi;

function clean(value) {
  if (value === undefined || value === null) return '';
  const text = (Array.isArray(value) ? value.join(', ') : String(value))
    .replace(URL_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > MAX_STRING ? `${text.slice(0, MAX_STRING - 1).trimEnd()}…` : text;
}

/** Keeps only present values, at most four rows. */
function info(...rows) {
  return rows
    .map(([label, value]) => [label, clean(value)])
    .filter(([, value]) => value !== '')
    .slice(0, 4);
}

const join = (separator, ...parts) => parts.filter((p) => p !== undefined && p !== '').join(separator);

function checkCoordinate(lon, lat, where) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error(`${where}: invalid coordinate lon=${lon} lat=${lat}`);
  }
}

function itemName(record, where) {
  const name = clean(record.name);
  if (!name) throw new Error(`${where}: record without a name (id=${record.id})`);
  return name;
}

function points(meta, records, describe) {
  const items = records.map((r) => {
    const where = `${meta.id}/${r.id}`;
    checkCoordinate(r.lon, r.lat, where);
    return { name: itemName(r, where), lon: r.lon, lat: r.lat, info: describe(r) };
  });
  return { ...meta, kind: 'points', items };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** `pathOf` must return source vertices in [lon, lat] order. */
function lines(meta, records, pathOf, describe) {
  const items = records.map((r) => {
    const where = `${meta.id}/${r.id}`;
    const vertices = [];
    for (const [lon, lat] of pathOf(r) ?? []) {
      checkCoordinate(lon, lat, where);
      const next = [round2(lon), round2(lat)];
      const previous = vertices.at(-1);
      if (!previous || previous[0] !== next[0] || previous[1] !== next[1]) vertices.push(next);
    }
    if (vertices.length < 2) throw new Error(`${where}: path has fewer than 2 distinct vertices`);
    return { name: itemName(r, where), path: vertices, info: describe(r) };
  });
  return { ...meta, kind: 'lines', items };
}

// Same merge as mergeAndDeduplicateBases() in src/config/military-bases.ts:
// every expanded base, then domestic bases whose 0.1-degree cell is still free.
function militaryBases() {
  const expanded = extractArray('shared/military-bases-data.ts', 'MILITARY_BASES_EXPANDED');
  const domestic = extractArray('src/config/military-bases.ts', 'US_DOMESTIC_BASES');
  const cell = (b) => `${Math.round(b.lat * 10)}_${Math.round(b.lon * 10)}`;
  const used = new Set(expanded.map(cell));
  const merged = [...expanded];
  for (const base of domestic) {
    if (used.has(cell(base))) continue;
    used.add(cell(base));
    merged.push(base);
  }
  return merged;
}

function buildLayers() {
  const finance = 'src/config/finance-geo.ts';
  const geo = 'shared/geo-data.ts';
  const geoMap = 'src/config/geo-map.ts';

  return [
    points(
      { id: 'stock-exchanges', label: 'Фондовые биржи', group: 'finance', color: '#2ecc71' },
      extractArray(finance, 'STOCK_EXCHANGES'),
      (r) => info(
        ['Город', join(', ', r.city, r.country)],
        ['Сокращение', r.shortName],
        ['Капитализация', r.marketCap === undefined ? '' : `${r.marketCap} трлн USD`],
        ['Часы торгов', r.tradingHours],
      ),
    ),
    points(
      { id: 'financial-centers', label: 'Финансовые центры', group: 'finance', color: '#1abc9c' },
      extractArray(finance, 'FINANCIAL_CENTERS'),
      (r) => info(
        ['Страна', r.country],
        ['Тип', r.type],
        ['Рейтинг GFCI', r.gfciRank],
        ['Специализация', r.specialties],
      ),
    ),
    points(
      { id: 'central-banks', label: 'Центральные банки', group: 'finance', color: '#f1c40f' },
      extractArray(finance, 'CENTRAL_BANKS'),
      (r) => info(
        ['Город', join(', ', r.city, r.country)],
        ['Тип', r.type],
        ['Валюта', r.currency],
        ['Описание', r.description],
      ),
    ),
    points(
      { id: 'commodity-hubs', label: 'Сырьевые хабы', group: 'finance', color: '#e67e22' },
      extractArray(finance, 'COMMODITY_HUBS'),
      (r) => info(
        ['Город', join(', ', r.city, r.country)],
        ['Тип', r.type],
        ['Товары', r.commodities],
        ['Описание', r.description],
      ),
    ),
    points(
      { id: 'economic-centers', label: 'Экономические центры', group: 'finance', color: '#9b59b6' },
      extractArray(geoMap, 'ECONOMIC_CENTERS'),
      (r) => info(
        ['Страна', r.country],
        ['Тип', r.type],
        ['Часы работы', r.marketHours
          ? join(' ', join('-', r.marketHours.open, r.marketHours.close), r.marketHours.timezone)
          : ''],
        ['Описание', r.description],
      ),
    ),
    points(
      { id: 'ports', label: 'Порты', group: 'infra', color: '#3498db' },
      extractArray('shared/ports-data.ts', 'PORTS'),
      (r) => info(['Страна', r.country], ['Тип', r.type], ['Ранг', r.rank], ['Примечание', r.note]),
    ),
    lines(
      { id: 'pipelines', label: 'Трубопроводы', group: 'infra', color: '#ff6b35' },
      extractArray('shared/pipelines-data.ts', 'PIPELINES'),
      (r) => r.points,
      (r) => info(['Тип', r.type], ['Статус', r.status], ['Мощность', r.capacity], ['Оператор', r.operator]),
    ),
    points(
      { id: 'ai-datacenters', label: 'ИИ-дата-центры', group: 'infra', color: '#8e7dff' },
      extractArray('src/config/ai-datacenters.ts', 'AI_DATA_CENTERS'),
      (r) => info(
        ['Владелец', r.owner],
        ['Статус', r.status],
        ['Чипы', join(' × ', r.chipType, r.chipCount)],
        ['Мощность', r.powerMW ? `${r.powerMW} МВт` : ''],
      ),
    ),
    points(
      { id: 'strategic-waterways', label: 'Стратегические проливы и каналы', group: 'infra', color: '#00cec9' },
      extractArray(geo, 'STRATEGIC_WATERWAYS'),
      (r) => info(['Описание', r.description]),
    ),
    points(
      { id: 'critical-minerals', label: 'Критические минералы', group: 'infra', color: '#e84393' },
      extractArray(geoMap, 'CRITICAL_MINERALS'),
      (r) => info(
        ['Минерал', r.mineral],
        ['Страна', r.country],
        ['Оператор', r.operator],
        ['Значение', r.significance],
      ),
    ),
    points(
      { id: 'mines', label: 'Месторождения и шахты', group: 'infra', color: '#b08d57' },
      extractArray('src/config/commodity-geo.ts', 'MINING_SITES'),
      (r) => info(['Минерал', r.mineral], ['Страна', r.country], ['Оператор', r.operator], ['Статус', r.status]),
    ),
    points(
      { id: 'spaceports', label: 'Космодромы', group: 'infra', color: '#a29bfe' },
      extractArray(geoMap, 'SPACEPORTS'),
      (r) => info(['Страна', r.country], ['Оператор', r.operator], ['Статус', r.status], ['Частота пусков', r.launches]),
    ),
    points(
      { id: 'nuclear-facilities', label: 'Ядерные объекты', group: 'security', color: '#fdcb00' },
      extractArray('shared/nuclear-facilities-data.ts', 'NUCLEAR_FACILITIES'),
      (r) => info(
        ['Тип', r.type],
        ['Статус', r.status],
        ['Страна-оператор', r.operator],
        ['Работает с', r.operationalSince],
      ),
    ),
    points(
      { id: 'military-bases', label: 'Военные базы', group: 'security', color: '#6c8ebf' },
      militaryBases(),
      (r) => info(['Принадлежность', r.type], ['Страна размещения', r.country], ['Род войск', r.arm], ['Статус', r.status]),
    ),
    lines(
      { id: 'conflict-zones', label: 'Зоны конфликтов', group: 'security', color: '#e74c3c' },
      extractArray(geo, 'CONFLICT_ZONES'),
      (r) => r.coords,
      (r) => info(['Интенсивность', r.intensity], ['Стороны', r.parties], ['Начало', r.startDate], ['Район', r.location]),
    ),
    points(
      { id: 'hotspots', label: 'Горячие точки', group: 'security', color: '#ff7675' },
      extractArray(geo, 'INTEL_HOTSPOTS'),
      (r) => info(
        ['Тема', r.subtext],
        ['Район', r.location],
        ['Эскалация (1–5)', r.escalationScore],
        ['Тенденция', r.escalationTrend],
      ),
    ),
  ];
}

// One item per line keeps regenerated diffs readable.
function render(layers) {
  const body = layers.map(({ items, ...meta }) => {
    const head = JSON.stringify(meta).slice(0, -1);
    return `${head},"items":[\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n]}`;
  });
  return [
    `// Derived from koala73/worldmonitor at ${COMMIT}, AGPL-3.0-only. Generated.`,
    '// Do not edit: run tools/build_layers.mjs. Sources and licences: ../ATTRIBUTION.md.',
    `export default { commit: '${COMMIT}', layers: [`,
    body.join(',\n'),
    '] };',
    '',
  ].join('\n');
}

assertCommit();
const layers = buildLayers();
const output = render(layers);
const bytes = Buffer.byteLength(output);
if (bytes >= MAX_BYTES) throw new Error(`output is ${bytes} bytes, limit ${MAX_BYTES}`);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, output);
for (const layer of layers) console.log(`${layer.id}\t${layer.kind}\t${layer.items.length}`);
console.log(`${OUTPUT}: ${bytes} bytes`);
