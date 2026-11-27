// Source registry and headline snapshot (fixtures/sources.js): panel part.
import { el } from './panel.js';

const full = new Intl.NumberFormat('ru');

export function headlinesFor(news, { category = '', query = '', sort = 'new' } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  const found = (news?.headlines ?? []).filter(h => {
    const source = news.sources[h.s];
    return source && (!category || source.category === category)
      && (!needle || `${h.title} ${source.name}`.toLocaleLowerCase().includes(needle));
  });
  const newest = (a, b) => b.t.localeCompare(a.t);
  if (sort === 'source') return found.sort((a, b) => news.sources[a.s].name.localeCompare(news.sources[b.s].name) || newest(a, b));
  // Lower tier numbers mark more authoritative sources; unknown tiers go last.
  if (sort === 'tier') return found.sort((a, b) => (news.sources[a.s].tier ?? 9) - (news.sources[b.s].tier ?? 9) || newest(a, b));
  return found.sort(newest);
}

export function newsSection(news, state, onState) {
  if (!news) return [el('p', { textContent: 'Реестр источников не загружен.' })];
  const about = el('details', {}, el('summary', { textContent: 'О данных' }), el('p', { className: 'rg-note', textContent:
    'Активы: DefiLlama, CoinGecko, SEC EDGAR, Nasdaq. Границы: Natural Earth. Слои мира: worldmonitor (AGPL-3.0). Это снимок, а не живые котировки.' }));
  const control = (node, key) => {
    node.className = `rg-news-${key}`;
    node.onchange = () => onState({ [key]: node.value, limit: 30 }, `.rg-news-${key}`);
    return node;
  };
  const select = (label, entries, key) => control(el('select', { ariaLabel: label },
    ...entries.map(([value, text]) => new Option(text, value, false, value === state[key]))), key);
  const found = headlinesFor(news, state);
  const counts = Map.groupBy(news.sources, s => s.category);
  const search = control(el('input', { type: 'search', ariaLabel: 'Поиск по заголовкам и источникам', placeholder: 'Поиск по новостям и Enter', value: state.query }), 'query');
  const sources = news.sources.filter(s => !state.category || s.category === state.category)
    .sort((a, b) => b.items - a.items || a.name.localeCompare(b.name));
  return [el('section', { className: 'rg-news' },
    el('h3', { textContent: 'Мировые источники' }),
    el('p', { className: 'rg-big', textContent: full.format(news.total) }),
    el('p', { textContent: `Ответили ${full.format(news.ok)}, заголовков в снимке ${full.format(news.headlines.length)}. Снимок ${news.generated}.` }),
    search,
    select('Категория', [['', 'Все категории'], ...news.categories.filter(c => counts.has(c.id)).map(c => [c.id, `${c.label} (${counts.get(c.id).length})`])], 'category'),
    select('Порядок новостей', [['new', 'Сначала новые'], ['tier', 'Сначала авторитетные'], ['source', 'По источнику']], 'sort'),
    el('h3', { textContent: `Заголовки: ${full.format(found.length)}` }),
    el('ul', { className: 'rg-headlines' }, ...found.slice(0, state.limit).map(h => el('li', {},
      el('small', { textContent: `${h.t.replace('T', ' ')} UTC · ${news.sources[h.s].name}` }), el('span', { textContent: h.title })))),
    found.length > state.limit ? el('button', { type: 'button', className: 'rg-news-more', textContent: 'Показать ещё',
      onclick: () => onState({ limit: state.limit + 60 }, '.rg-news-more') }) : null,
    about,
    el('details', {}, el('summary', { textContent: `Список источников: ${full.format(sources.length)}` }),
      el('ul', { className: 'rg-sources' }, ...sources.map(s => el('li', { className: s.status === 'ok' ? '' : 'rg-off' },
        el('span', { textContent: s.name }), el('small', { textContent: s.status === 'ok' ? `${s.items} · ${s.latest ?? '—'}` : 'не ответил' }))))))];
}
