// Static world layers (derived from worldmonitor, see ATTRIBUTION.md): search and panel parts.
import { search } from './model.js';
import { el } from './panel.js';

export const GEO_GROUPS = { finance: 'Финансы мира', infra: 'Инфраструктура', security: 'Безопасность' };

// A representative point for flying to an item; lines use their middle vertex.
export function anchor(item) {
  if (item.path) { const [lon, lat] = item.path[Math.floor(item.path.length / 2)]; return { lon, lat }; }
  return { lon: item.lon, lat: item.lat };
}

export function searchGeo(layers, query) {
  const entries = layers.flatMap(layer => layer.items.map(item => ({ name: item.name, item, layer })));
  return search(entries, query);
}

export function geoCard({ item, layer }, { onBack }) {
  const facts = item.info ?? [];
  return [
    el('button', { type: 'button', className: 'rg-back', textContent: '← Обзор', onclick: onBack }),
    el('h2', { textContent: item.name, tabIndex: -1 }),
    el('p', { textContent: layer.label }),
    facts.length ? el('dl', {}, ...facts.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })])) : null,
    el('p', { className: 'rg-note', textContent: 'Статичный набор из репозитория worldmonitor: не живые данные, мог устареть.' }),
  ];
}

export function geoOverview(layers, onPick) {
  if (!layers.length) return null;
  return el('section', {}, el('h3', { textContent: 'Включённые слои мира' }),
    ...layers.map(layer => el('details', { className: 'rg-geo' },
      el('summary', { textContent: `${layer.label} · ${layer.items.length}` }),
      el('ul', {}, ...layer.items.slice(0, 40).map(item =>
        el('li', {}, el('button', { type: 'button', onclick: () => onPick(item, layer) },
          el('span', { textContent: item.name }), el('small', { textContent: item.info?.[0]?.[1] ?? '' }))))))));
}
