// Full asset browser: type filter, sort order and paging over the shown nodes.
import { el } from './panel.js';
import { typeLabel } from './palette.js';

const compact = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 });
const money = value => (Number.isFinite(value) ? `$${compact.format(value)}` : '');
const percent = value => (Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value.toFixed(1)}%` : '');
const cap = meta => meta.mcap ?? meta.tvl;

// [key, label, value used for ordering (higher first), text shown beside the name]
export const SORTS = [
  ['score', 'По значимости', m => m.score, m => `${m.score}`],
  ['interest', 'По интересу', m => m.interest, m => `${m.interest ?? ''}`],
  ['up', 'Рост за 7 дней', m => m.change7d, m => percent(m.change7d)],
  ['down', 'Падение за 7 дней', m => (Number.isFinite(m.change7d) ? -m.change7d : null), m => percent(m.change7d)],
  ['cap', 'Капитализация или TVL', cap, m => money(cap(m))],
  ['volume', 'Объём за 24 часа', m => m.volume, m => money(m.volume)],
  ['hack', 'Сумма взлома', m => m.hack?.usd, m => money(m.hack?.usd)],
  ['flags', 'Число флагов', m => m.flags?.length || null, m => `${m.flags?.length ?? 0}`],
  ['name', 'По имени', null, m => `${m.score}`],
];

// Assets without the sorted value are left out rather than treated as zero.
export function sortAssets(nodes, sort = 'score', type = '') {
  const [, , value] = SORTS.find(s => s[0] === sort) ?? SORTS[0];
  const assets = nodes.filter(n => n.meta && (!type || n.group === type));
  if (!value) return assets.sort((a, b) => a.name.localeCompare(b.name));
  return assets.filter(n => Number.isFinite(value(n.meta)))
    .sort((a, b) => value(b.meta) - value(a.meta) || a.name.localeCompare(b.name));
}

export function browser(nodes, state, { onSelect, onState }) {
  const types = [...new Set(nodes.filter(n => n.meta).map(n => n.group))];
  const select = (label, entries, current, key) => {
    const node = el('select', { ariaLabel: label, className: `rg-browse-${key}` },
      ...entries.map(([value, text]) => new Option(text, value, false, value === current)));
    node.onchange = () => onState({ [key]: node.value, limit: 25 }, `.rg-browse-${key}`);
    return node;
  };
  const found = sortAssets(nodes, state.sort, state.type);
  const [, , , text] = SORTS.find(s => s[0] === state.sort) ?? SORTS[0];
  return el('section', { className: 'rg-browse' },
    el('h3', { textContent: `Все объекты: ${found.length.toLocaleString('ru')}` }),
    select('Тип', [['', 'Все типы'], ...types.map(t => [t, typeLabel(t)])], state.type, 'type'),
    select('Сортировка', SORTS.map(([key, label]) => [key, label]), state.sort, 'sort'),
    el('ol', {}, ...found.slice(0, state.limit).map(node => el('li', {},
      el('button', { type: 'button', onclick: () => onSelect(node.id) },
        el('span', { textContent: node.name }), el('small', { textContent: text(node.meta) }))))),
    found.length > state.limit ? el('button', {
      type: 'button', className: 'rg-browse-more', textContent: `Показать ещё (${found.length - state.limit})`,
      onclick: () => onState({ limit: state.limit + 50 }, '.rg-browse-more'),
    }) : null);
}
