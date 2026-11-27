// Aggregated events (filings, quakes, media-coded world events): filtering and panel parts.
import { el } from './panel.js';

export const PERIODS = [['7', '7 дней'], ['30', '30 дней'], ['all', 'Весь период']];
const COLUMN = { 7: 3, 30: 4, all: 5 };
const full = new Intl.NumberFormat('ru');

// Map cells of the enabled datasets that have events in the period.
export function cellsFor(events, active, period) {
  const column = COLUMN[period] ?? 5;
  const cells = [];
  for (const row of events?.cells ?? []) {
    const dataset = events.datasets[row[2]];
    if (dataset && active.has(dataset.id) && row[column] > 0) cells.push({ lon: row[0], lat: row[1], dataset, count: row[column] });
  }
  return cells;
}

export const totalOf = cells => cells.reduce((sum, cell) => sum + cell.count, 0);

// sort 'new': by date; 'big': by weight inside each dataset, mixed in turn so no dataset hides the rest.
export function sortEvents(events, active, sort = 'new', only = '') {
  const items = (events?.latest ?? []).filter(e => {
    const id = events.datasets[e.ds]?.id;
    return active.has(id) && (!only || id === only);
  });
  const newest = (a, b) => b.d.localeCompare(a.d) || (b.weight ?? 0) - (a.weight ?? 0);
  if (sort !== 'big') return items.sort(newest);
  const groups = [...Map.groupBy(items, e => e.ds).values()]
    .map(list => list.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || newest(a, b)));
  const mixed = [];
  for (let i = 0; groups.some(g => i < g.length); i++) for (const g of groups) if (i < g.length) mixed.push(g[i]);
  return mixed;
}

export const latestFor = (events, active, limit = 30) => sortEvents(events, active).slice(0, limit);

// Joins several event files: dataset indices are shifted and the timeline is summed by month.
export function mergeEvents(files) {
  const parts = files.filter(Boolean);
  if (!parts.length) return null;
  const merged = { generated: parts.map(p => p.generated).sort().at(-1), datasets: [], cells: [], latest: [], companies: {} };
  const months = new Map(), width = parts.reduce((sum, p) => sum + p.datasets.length, 0);
  let offset = 0;
  for (const part of parts) {
    merged.datasets.push(...part.datasets);
    for (const cell of part.cells) merged.cells.push([cell[0], cell[1], cell[2] + offset, cell[3], cell[4], cell[5]]);
    for (const item of part.latest) merged.latest.push({ ...item, ds: item.ds + offset });
    for (const point of part.timeline ?? []) {
      const month = point.date.slice(0, 7);
      const counts = months.get(month) ?? months.set(month, Array(width).fill(0)).get(month);
      point.counts.forEach((value, i) => { counts[i + offset] += value; });
    }
    Object.assign(merged.companies, part.companies);
    offset += part.datasets.length;
  }
  merged.timeline = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({ date, counts }));
  return merged;
}

function list(events, items, onEvent) {
  return el('ul', { className: 'rg-feed' }, ...items.map(item => {
    const dataset = events.datasets[item.ds];
    const swatch = el('i'); swatch.style.background = dataset.color;
    return el('li', {}, el('button', { type: 'button', onclick: () => onEvent(item) },
      swatch, el('span', { textContent: item.title }), el('small', { textContent: item.d })));
  }));
}

function bars(events, active) {
  const rows = (events.timeline ?? []).slice(-40).map(point => ({
    date: point.date, value: events.datasets.reduce((sum, d, i) => sum + (active.has(d.id) ? point.counts[i] ?? 0 : 0), 0),
  }));
  const max = Math.max(1, ...rows.map(r => r.value));
  return el('div', { className: 'rg-spark', role: 'img', ariaLabel: `Динамика событий, максимум ${full.format(max)} за интервал` },
    ...rows.map(r => { const bar = el('i', { title: `${r.date}: ${full.format(r.value)}` }); bar.style.height = `${Math.max(3, r.value / max * 100)}%`; return bar; }));
}

function feed(events, active, state, { onEvent, onFeed }) {
  const select = (label, entries, current, key) => {
    const node = el('select', { ariaLabel: label, className: `rg-feed-${key}` },
      ...entries.map(([value, text]) => new Option(text, value, false, value === current)));
    node.onchange = () => onFeed({ [key]: node.value, limit: 20 }, `.rg-feed-${key}`);
    return node;
  };
  const items = sortEvents(events, active, state.sort, state.only);
  return el('div', {},
    el('h3', { textContent: `Лента событий: ${full.format(items.length)}` }),
    select('Порядок событий', [['new', 'Сначала новые'], ['big', 'Сначала крупные']], state.sort, 'sort'),
    select('Набор событий', [['', 'Все наборы'], ...events.datasets.filter(d => active.has(d.id)).map(d => [d.id, d.label])], state.only, 'only'),
    list(events, items.slice(0, state.limit), onEvent),
    items.length > state.limit ? el('button', {
      type: 'button', className: 'rg-feed-more', textContent: 'Показать ещё',
      onclick: () => onFeed({ limit: state.limit + 40 }, '.rg-feed-more'),
    }) : null);
}

export function activityOverview(events, active, period, handlers, state) {
  if (!events) return [];
  const cells = cellsFor(events, active, period);
  const byDataset = Map.groupBy(cells, c => c.dataset.id);
  const everything = events.datasets.reduce((sum, d) => sum + d.total, 0);
  return [el('section', { className: 'rg-activity' },
    el('h3', { textContent: `События на карте · ${PERIODS.find(p => p[0] === period)[1].toLowerCase()}` }),
    el('p', { className: 'rg-big', textContent: full.format(totalOf(cells)) }),
    el('p', { textContent: `Всего в наборах: ${full.format(everything)}. Снимок ${events.generated}, не прямой эфир.` }),
    el('ul', { className: 'rg-datasets' }, ...events.datasets.filter(d => active.has(d.id))
      .sort((a, b) => totalOf(byDataset.get(b.id) ?? []) - totalOf(byDataset.get(a.id) ?? [])).map(d => {
      const swatch = el('i'); swatch.style.background = d.color;
      return el('li', {}, swatch, el('span', { textContent: `${d.label}${d.geo === 'country' ? ' (по стране)' : ''}` }),
        el('strong', { textContent: d.geo === 'none' ? `${full.format(d.total)} всего` : full.format(totalOf(byDataset.get(d.id) ?? [])) }));
    })),
    bars(events, active),
    feed(events, active, state, handlers))];
}

// Everything known about one place: all enabled datasets at that point.
export function cellCard(events, active, period, picked, { onBack, onEvent }) {
  const located = Number.isFinite(picked.lon);
  const here = located ? cellsFor(events, active, period).filter(c => c.lon === picked.lon && c.lat === picked.lat) : [];
  const near = located ? (events.latest ?? []).filter(e => active.has(events.datasets[e.ds]?.id) && Number.isFinite(e.lon)
    && Math.abs(e.lon - picked.lon) <= 1.5 && Math.abs(e.lat - picked.lat) <= 1.5).slice(0, 30) : [];
  return [
    el('button', { type: 'button', className: 'rg-back', textContent: '← Обзор', onclick: onBack }),
    el('h2', { textContent: picked.title ?? `${picked.lat.toFixed(1)}°, ${picked.lon.toFixed(1)}°`, tabIndex: -1 }),
    picked.title ? el('p', { textContent: `${picked.date} · ${picked.label}` }) : null,
    located ? el('p', { className: 'rg-big', textContent: full.format(totalOf(here)) })
      : el('p', { textContent: 'У этого события нет координат.' }),
    el('ul', { className: 'rg-datasets' }, ...here.map(c => {
      const swatch = el('i'); swatch.style.background = c.dataset.color;
      return el('li', {}, swatch, el('span', { textContent: c.dataset.label }), el('strong', { textContent: full.format(c.count) }));
    })),
    near.length ? el('h3', { textContent: 'Заметные события рядом' }) : null,
    near.length ? list(events, near, onEvent) : null,
    el('p', { className: 'rg-note', textContent: 'Координаты сгруппированы по сетке. События по стране показаны в одной условной точке. Новостные события закодированы автоматически и не являются проверенными фактами.' }),
  ];
}

export function companySection(events, node) {
  const record = node && node.group === 'stock' ? events?.companies?.[node.name] : null;
  if (!record) return null;
  return el('section', {}, el('h3', { textContent: 'Подачи в SEC за период снимка' }), el('dl', {},
    ...[['Всего', record.total], ['Формы 4 (инсайдеры)', record.form4], ['8-K (события)', record.current], ['Последняя', record.last]]
      .flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: typeof v === 'number' ? full.format(v) : v ?? '—' })])));
}
