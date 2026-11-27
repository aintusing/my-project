// Side panel: overview, asset card and country card. Text only goes through textContent.
import { neighbors } from './model.js';
import { RISK, TYPES, riskOf, typeLabel } from './palette.js';

export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter(Boolean));
  return node;
}

const compact = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat('ru');
const money = value => (value === null || value === undefined ? null : `$${compact.format(value)}`);
const percent = value => (value === null || value === undefined ? null
  : `${value > 0 ? '+' : ''}${Math.abs(value) < 10000 ? value.toFixed(1) : compact.format(value)}%`);
const share = (part, total) => (total ? part / total : 0);
const shareText = (part, total) => {
  const value = share(part, total) * 100;
  return `${value > 0 && value < 1 ? '<1' : Math.round(value)}%`;
};
const trend = value => (value > 0 ? 'rg-up' : value < 0 ? 'rg-down' : '');
const isAsset = node => node.group !== 'sphere' && node.group !== 'chain';
// Theme tokens, so risk colors keep their contrast in every theme.
const RISK_TONE = { hacked: 'var(--bad)', flagged: 'var(--warn)', clear: 'var(--good)', unknown: 'var(--dim)' };

function tint(node, color) {
  if (color) node.style.setProperty('--c', color);
  return node;
}
const dot = color => tint(el('i', { className: 'rg-dot', ariaHidden: 'true' }), color);
const typeDot = group => dot(TYPES[group]?.[1]);

// Decorative bar from 0 to 1. The number it stands for is always printed next to it.
function mag(fraction, color) {
  if (!Number.isFinite(fraction)) return null;
  const bar = el('i', { className: 'rg-mag', ariaHidden: 'true' });
  bar.style.setProperty('--v', Math.min(1, Math.max(0, fraction)).toFixed(4));
  return tint(bar, color);
}

function section(title, hint, ...children) {
  return el('section', {}, el('div', { className: 'rg-head' }, el('h3', { textContent: title }),
    hint ? el('span', { textContent: hint }) : null), ...children);
}

// One selectable line: name, value, optional second line and magnitude bar.
function row(label, value, { sub, bar, color, tone, onclick }) {
  return el('li', {}, el('button', { type: 'button', onclick },
    el('span', { className: 'rg-name' }, color ? dot(color) : null, label),
    el('small', { className: tone ?? '', textContent: value ?? '' }),
    sub ? el('span', { className: 'rg-sub', textContent: sub }) : null,
    mag(bar)));
}

function assetList(title, nodes, aside, onSelect, { hint, sub, bar, tone, ranked = false, color = true } = {}) {
  if (!nodes.length) return null;
  return section(title, hint, el('ul', { className: ranked ? 'rg-ranked' : '' }, ...nodes.map(node =>
    row(node.name, aside(node), {
      sub: sub?.(node), bar: bar?.(node), tone: tone?.(node),
      color: color ? TYPES[node.group]?.[1] : null, onclick: () => onSelect(node.id),
    }))));
}

// items: [label, value, color, total]. A total adds the share line and its bar.
function tiles(items) {
  return el('div', { className: 'rg-tiles' }, ...items.map(([label, value, color, total]) => tint(el('div', {},
    el('strong', { textContent: whole.format(value) }), el('span', { textContent: label }),
    total ? el('em', { textContent: shareText(value, total) }) : null,
    total ? mag(share(value, total)) : null), color)));
}

// rows: [label, count, color]. Bars show the share of the total.
function distribution(title, rows, total, { hint, stacked = false } = {}) {
  if (!total || !rows.length) return null;
  const stack = stacked ? el('div', { className: 'rg-stack', ariaHidden: 'true' }, ...rows.map(([, count, color]) => {
    const part = tint(el('i'), color);
    part.style.flexGrow = String(count);
    return part;
  })) : null;
  return section(title, hint, stack, el('ul', { className: 'rg-dist' }, ...rows.map(([label, count, color]) =>
    el('li', {}, el('span', { className: 'rg-name' }, color ? dot(color) : null, label),
      el('b', { textContent: whole.format(count) }), el('em', { textContent: shareText(count, total) }),
      stacked ? null : mag(share(count, total), color)))));
}

function riskDistribution(assets) {
  const groups = Map.groupBy(assets, riskOf);
  return distribution('Риски', Object.entries(RISK).filter(([key]) => groups.has(key))
    .map(([key, [label]]) => [label, groups.get(key).length, RISK_TONE[key]]), assets.length,
  { hint: 'по флагам снимка', stacked: true });
}

const counted = (list, key) => [...Map.groupBy(list, key)].map(([name, items]) => [name, items.length])
  .sort((a, b) => b[1] - a[1]);

function typeDistribution(assets) {
  return distribution('Типы объектов', counted(assets, n => n.group)
    .map(([type, count]) => [typeLabel(type), count, TYPES[type]?.[1]]), assets.length);
}

function sphereDistribution(assets, limit = 8) {
  const all = counted(assets, n => n.sphere);
  const rows = all.slice(0, limit), rest = all.slice(limit);
  if (rest.length) rows.push([`Остальные сферы: ${rest.length}`, rest.reduce((sum, [, count]) => sum + count, 0), 'var(--dim)']);
  return distribution('Сферы', rows, assets.length);
}

export function summarize(nodes) {
  const assets = nodes.filter(isAsset);
  const by = (list, score) => [...list].sort((a, b) => score(b) - score(a));
  return {
    assets: assets.length,
    located: assets.filter(n => n.country).length,
    flagged: assets.filter(n => riskOf(n) === 'flagged').length,
    hacked: assets.filter(n => riskOf(n) === 'hacked').length,
    significant: by(assets.filter(n => n.meta), n => n.meta.score).slice(0, 8),
    // Small assets are excluded: their swings are mostly noise.
    movers: by(assets.filter(n => n.meta?.score >= 25 && Number.isFinite(n.meta.change7d)), n => Math.abs(n.meta.change7d)).slice(0, 8),
    hacks: by(assets.filter(n => n.meta?.hack?.usd), n => n.meta.hack.usd).slice(0, 6),
    countries: [...Map.groupBy(assets.filter(n => n.country), n => n.country)].sort((a, b) => b[1].length - a[1].length),
  };
}

// Hacks no older than `days` before the snapshot date, newest first. days = 0 means all.
export function recentHacks(nodes, date, days) {
  const from = Number(days) && date ? new Date(Date.parse(date) - Number(days) * 864e5).toISOString().slice(0, 10) : '';
  return nodes.filter(n => n.meta?.hack && n.meta.hack.date >= from).sort((a, b) => b.meta.hack.date.localeCompare(a.meta.hack.date));
}

function hackFeed(nodes, { date, period, onPeriod, onSelect }) {
  if (!date) return null;
  const list = recentHacks(nodes, date, period), shown = list.slice(0, 10);
  const choice = el('select', { className: 'rg-period', ariaLabel: 'Период взломов' },
    ...[['30', '30 дней'], ['365', 'Год'], ['0', 'Всё время']].map(([v, text]) => new Option(text, v, false, v === period)));
  choice.onchange = () => onPeriod(choice.value);
  const top = Math.max(0, ...shown.map(n => n.meta.hack.usd || 0));
  const timeline = el('ul', { className: 'rg-timeline' }, ...shown.map(node => {
    const { date: day, usd, how } = node.meta.hack;
    return el('li', {}, el('button', { type: 'button', onclick: () => onSelect(node.id) },
      el('time', { dateTime: day, textContent: day }),
      el('small', { textContent: money(usd) ?? '?' }),
      el('span', { className: 'rg-name', textContent: node.name }),
      how ? el('span', { className: 'rg-sub', textContent: how }) : null,
      usd && top ? mag(usd / top) : null));
  }));
  return el('section', { className: 'rg-hacks' },
    el('div', { className: 'rg-head' }, el('h3', { textContent: `Лента взломов: ${list.length}` }), choice),
    shown.length ? timeline : el('p', { textContent: 'За период взломов нет.' }),
    list.length > shown.length ? el('p', { className: 'rg-note', textContent: `Показаны ${shown.length} последних.` }) : null);
}

function countryList(entries, countries, onCountry) {
  const top = entries.slice(0, 15), most = top[0]?.[1].length;
  return section('Страны', `${top.length} из ${entries.length}`, el('ul', { className: 'rg-ranked' }, ...top.map(([code, list]) => {
    const hacked = list.filter(n => riskOf(n) === 'hacked').length, flagged = list.filter(n => riskOf(n) === 'flagged').length;
    return row(countries[code]?.name ?? code, whole.format(list.length), {
      sub: [flagged && `с флагами: ${flagged}`, hacked && `со взломом: ${hacked}`].filter(Boolean).join(' · '),
      bar: list.length / most, onclick: () => onCountry(code),
    });
  })));
}

const describe = node => [typeLabel(node.group), node.sphere].filter(Boolean).join(' · ');

export function overview(nodes, handlers) {
  const { countries, date, onSelect, onCountry } = handlers;
  const s = summarize(nodes), assets = nodes.filter(isAsset);
  const swing = Math.max(0, ...s.movers.map(n => Math.abs(n.meta.change7d)));
  const loss = s.hacks[0]?.meta.hack.usd;
  return [
    el('h2', { textContent: 'Обзор', tabIndex: -1 }),
    date ? el('p', { className: 'rg-lead', textContent: `Снимок ${date}` }) : null,
    tiles([['объектов', s.assets], ['со страной', s.located, null, s.assets],
      ['с флагами', s.flagged, 'var(--warn)', s.assets], ['со взломом', s.hacked, 'var(--bad)', s.assets]]),
    riskDistribution(assets),
    assetList('Самые значимые', s.significant, n => `${n.meta.score}`, onSelect,
      { hint: 'из 100', ranked: true, sub: describe, bar: n => n.meta.score / 100 }),
    // Weekly swings differ by orders of magnitude, so these bars are logarithmic and say so.
    assetList('Сильнее всего движутся за 7 дней', s.movers, n => percent(n.meta.change7d), onSelect,
      { hint: 'лог. шкала', ranked: true, sub: describe, tone: n => trend(n.meta.change7d),
        bar: n => share(Math.log1p(Math.abs(n.meta.change7d)), Math.log1p(swing)) }),
    hackFeed(nodes, handlers),
    assetList('Крупнейшие взломы (последний по объекту)', s.hacks, n => money(n.meta.hack.usd), onSelect,
      { ranked: true, tone: () => 'rg-down', sub: n => [n.meta.hack.date, n.meta.hack.how].filter(Boolean).join(' · '),
        bar: n => n.meta.hack.usd / loss }),
    typeDistribution(assets),
    sphereDistribution(assets),
    countries && s.countries.length ? countryList(s.countries, countries, onCountry) : null,
  ];
}

const back = onclick => el('button', { type: 'button', className: 'rg-back', textContent: '← Обзор', onclick });

export function countryCard(code, nodes, { countries, onSelect, onBack }) {
  const list = nodes.filter(n => n.country === code).sort((a, b) => b.size - a.size);
  const types = [...Map.groupBy(list, n => n.group)];
  return [
    back(onBack),
    el('p', { className: 'rg-kicker', textContent: 'Страна' }),
    el('h2', { textContent: countries?.[code]?.name ?? code, tabIndex: -1 }),
    list.length ? el('p', { className: 'rg-lead', textContent: `Объектов в выборке: ${whole.format(list.length)}` }) : null,
    list.length ? tiles(types.map(([type, items]) => [typeLabel(type).toLowerCase(), items.length, null, list.length]))
      : el('p', { textContent: 'В снимке нет объектов с этой страной.' }),
    riskDistribution(list),
    sphereDistribution(list, 5),
    assetList('Объекты страны', list.slice(0, 60), n => (n.meta ? `${n.meta.score}` : ''), onSelect,
      { hint: list.length > 60 ? `60 из ${list.length}` : 'значимость', ranked: true, sub: n => typeLabel(n.group),
        bar: n => (n.meta ? n.meta.score / 100 : NaN) }),
  ];
}

function meter(label, value) {
  if (value === null || value === undefined) return null;
  // The native meter carries the semantics; the bar next to it is what is seen.
  return el('label', { className: 'rg-meter' },
    el('span', { textContent: label }), el('b', { textContent: `${value}` }), el('em', { textContent: ' из 100' }),
    el('meter', { min: 0, max: 100, value }), mag(value / 100));
}

export function assetCard(model, id, { countries, onSelect, onCountry, onBack }) {
  const node = model.nodes.get(id), meta = node.meta ?? {}, near = neighbors(model, id);
  // [label, value, value class, full width]
  const facts = [
    ['Капитализация', money(meta.mcap)], ['Объём за 24 ч', money(meta.volume)], ['TVL', money(meta.tvl)],
    ['Изменение за 7 дней', percent(meta.change7d), trend(meta.change7d)], ['Доверие биржи', meta.trust ?? null], ['Площадка', meta.exchange],
    ['Взлом', meta.hack ? `${meta.hack.date}, ${money(meta.hack.usd) ?? 'сумма неизвестна'}, ${meta.hack.how}` : null, 'rg-down', true],
    ['Страна', node.country ? countries?.[node.country]?.name ?? node.country : node.meta ? 'неизвестна' : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const risk = riskOf(node);
  const subtitle = [meta.symbol === '-' ? null : meta.symbol, node.sphere].filter(Boolean).join(' · ');
  const meters = [meter('Значимость', meta.score), meter('Интерес', meta.interest)].filter(Boolean);
  return [
    back(onBack),
    el('p', { className: 'rg-kicker' }, typeDot(node.group), typeLabel(node.group)),
    el('h2', { textContent: node.name, tabIndex: -1 }),
    subtitle ? el('p', { className: 'rg-lead', textContent: subtitle }) : null,
    node.meta ? el('p', { className: `rg-risk rg-${risk}`, textContent: RISK[risk][0] }) : null,
    meta.flags?.length ? el('div', { className: 'rg-flags' }, ...meta.flags.map(f => el('span', { textContent: f }))) : null,
    meters.length ? el('div', { className: 'rg-meters' }, ...meters) : null,
    facts.length ? el('dl', { className: 'rg-facts' }, ...facts.map(([label, value, tone, wide]) => el('div', { className: wide ? 'rg-wide' : '' },
      el('dt', { textContent: label }), el('dd', { className: tone ?? '', textContent: String(value) })))) : null,
    node.country ? el('button', { type: 'button', className: 'rg-more', textContent: 'Все объекты страны', onclick: () => onCountry(node.country) }) : null,
    assetList(`Связи: ${near.length}`, near.slice(0, 60), n => typeLabel(n.group), onSelect,
      { hint: near.length > 60 ? 'первые 60' : null }),
    node.meta ? el('p', { className: 'rg-note', textContent: 'Оценки и флаги — эвристики по снимку, не инвестиционный совет. Отсутствие флагов не означает безопасность.' }) : null,
  ];
}
