// Public module: createRadarGraph(root, data, options). See README.md.
import { buildModel, filterBySphere, neighbors, search, spheres } from './model.js';
import { view2d, view3d } from './views.js';

const LIST_LIMIT = 100;
function hasWebGL() {
  const gl = document.createElement('canvas').getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe context
  return Boolean(gl);
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export function createRadarGraph(root, data, options = {}) {
  const { onSelect = () => {}, force2d = false, forceGraph = globalThis.ForceGraph3D, simplifyAbove = 2000 } = options;
  const model = buildModel(data);
  const filter = el('select', { ariaLabel: 'Сфера' }, new Option('Все сферы', ''),
    ...spheres(model).map(s => new Option(s, s)));
  const input = el('input', { type: 'search', placeholder: 'Имя узла и Enter', ariaLabel: 'Поиск узла' });
  const status = el('p', { className: 'rg-status', role: 'status' });
  const stage = el('div', { className: 'rg-stage' });
  const panel = el('aside', { className: 'rg-panel', ariaLabel: 'Выбранный узел' });
  const tools = el('span', { className: 'rg-tools' });
  root.classList.add('rg');
  root.replaceChildren(el('div', { className: 'rg-bar' }, filter, el('form', {}, input), tools, status), stage, panel);
  const button = (textContent, onclick, label = textContent) =>
    el('button', { type: 'button', textContent, ariaLabel: label, onclick });
  const pause = button('', () => view.toggleRotation());
  const onRotate = on => { pause.textContent = pause.ariaLabel = on ? 'Остановить вращение' : 'Вращать планету'; };

  let shown = { nodes: [], links: [] }, selected = null, mode = '2d', view;
  if (!force2d && forceGraph && hasWebGL()) {
    try { view = view3d(stage, forceGraph, id => select(id), onRotate, simplifyAbove); mode = '3d'; } catch (error) { console.warn('3D недоступен', error); }
  }
  view ??= view2d(stage, id => select(id), simplifyAbove);
  if (mode === '3d') tools.append(pause);
  else tools.append(button('+', () => view.zoom(1.4), 'Приблизить'), button('−', () => view.zoom(1 / 1.4), 'Отдалить'));

  const describe = text => {
    const simplified = shown.nodes.length > simplifyAbove ? ' · связи только у выбранного узла' : '';
    status.textContent = text ?? `${mode.toUpperCase()} · узлов ${shown.nodes.length}, связей ${shown.links.length}${simplified}`;
  };

  function renderPanel() {
    if (!selected) return panel.replaceChildren(el('p', { textContent: 'Выберите узел щелчком или поиском.' }));
    const node = model.nodes.get(selected), near = neighbors(model, selected);
    const list = near.slice(0, LIST_LIMIT).map(n =>
      el('li', {}, el('button', {
        type: 'button', textContent: n.name,
        // The list is rebuilt on selection, so keyboard focus moves to the new heading.
        onclick: () => { select(n.id); panel.querySelector('h2').focus(); },
      })));
    const rest = near.length > LIST_LIMIT ? `Показаны ${LIST_LIMIT} из ${near.length}.` : '';
    panel.replaceChildren(el('h2', { textContent: node.name, tabIndex: -1 }),
      el('p', { textContent: `${node.sphere} · ${node.group} · соседей ${near.length}` }),
      el('ul', {}, ...list), el('p', { textContent: rest }));
  }

  function setSphere(sphere) {
    filter.value = sphere;
    shown = filterBySphere(model, filter.value);
    if (selected && !shown.nodes.some(n => n.id === selected)) selected = null;
    view.show(shown.nodes, shown.links);
    view.mark({ selected, near: new Set(model.adjacency.get(selected)) });
    if (selected) view.focus(selected);
    renderPanel();
    describe();
  }

  function select(id) {
    if (!model.nodes.has(id)) return false;
    // A neighbor outside the current filter switches back to the full graph.
    if (!shown.nodes.some(n => n.id === id)) setSphere('');
    selected = id;
    view.mark({ selected, near: new Set(model.adjacency.get(id)) });
    view.focus(id);
    renderPanel();
    describe();
    onSelect(model.nodes.get(id), neighbors(model, id));
    return true;
  }

  function find(query) {
    // Shown nodes come first, so they win ties without hiding a better match elsewhere.
    const hit = search([...shown.nodes, ...model.nodes.values()], query);
    if (hit) select(hit.id);
    else describe('Не найдено.');
    return hit;
  }

  filter.onchange = () => setSphere(filter.value);
  input.form.onsubmit = event => { event.preventDefault(); find(input.value); };
  setSphere('');

  return {
    get mode() { return mode; },
    select, search: find, setSphere,
    counts: () => ({ nodes: shown.nodes.length, links: shown.links.length }),
    spin: () => view.spin(),
    destroy() { view.destroy(); root.replaceChildren(); root.classList.remove('rg'); },
  };
}
