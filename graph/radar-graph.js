// Public module: createRadarGraph(root, data, options). See README.md.
import { PERIODS, activityOverview, cellCard, cellsFor, companySection } from './activity.js';
import { browser } from './browse.js';
import { viewEarth } from './earth.js';
import { GEO_GROUPS, anchor, geoCard, geoOverview, searchGeo } from './geo.js';
import { buildModel, filterBySphere, search, spheres } from './model.js';
import { assetCard, countryCard, el, overview } from './panel.js';
import { newsSection } from './newsroom.js';
import { RISK, TYPES, colorer, riskOf, sphereColors } from './palette.js';
import { viewScheme } from './scheme.js';
import { view3d } from './views.js';

const GRAPH_LIMIT = 6000; // more spheres than this make the 3D graph too slow
const THEMES = [['night', 'Тушь'], ['aurora', 'Мох'], ['day', 'Бумага']];
const ASSET_LAYERS = [['project', 'Крипто-проекты'], ['meme', 'Мемкоины'], ['coin', 'Монеты'], ['exchange', 'Биржи'], ['stock', 'Акции']];
const MAP_LAYERS = [['orbit', 'Орбита: без страны'], ['labels', 'Подписи стран'], ['alerts', 'Сигналы взломов']];
// [label, longitude, latitude, zoom]
const REGIONS = [['Мир', 10, 24, 1], ['Америка', -90, 28, 1.5], ['Европа', 14, 50, 2.6], ['Азия', 104, 28, 1.7],
  ['Ближний Восток', 46, 28, 2.6], ['Африка', 20, 4, 1.7]];

function hasWebGL() {
  const gl = document.createElement('canvas').getContext('webgl2');
  gl?.getExtension('WEBGL_lose_context')?.loseContext(); // release the probe context
  return Boolean(gl);
}

const picker = (label, entries, onchange) => {
  const node = el('select', { ariaLabel: label }, ...entries.map(([value, text]) => new Option(text, value)));
  node.onchange = () => onchange(node.value);
  return node;
};

export function createRadarGraph(root, data, options = {}) {
  const { onSelect = () => {}, force2d = false, forceGraph = globalThis.ForceGraph3D, simplifyAbove = 2000,
    world = null, geo = null, events = null, news = null, analytics = null, date = data?.date ?? null } = options;
  const model = buildModel(data);
  const names = spheres(model), colors = sphereColors(names);
  const can3d = Boolean(!force2d && forceGraph && hasWebGL());
  const modes = [world && ['earth', 'Глобус'], world && ['map', 'Карта'], can3d && ['3d', 'Граф'], ['2d', 'Схема']].filter(Boolean);
  const hidden = new Set(), shows = { orbit: true, labels: true, alerts: true };
  let shown = { nodes: [], links: [] }, selected = null, country = null, colorMode = 'sphere', view = null, mode = null;
  let riskOnly = false, period = '365', geoPick = null;
  // World layers only make sense on a map; finance layers start switched on.
  const geoAll = world ? geo?.layers ?? [] : [];
  const geoOn = new Set(geoAll.filter(l => l.group === 'finance').map(l => l.id)), geoBoxes = new Map();
  const activeGeo = () => geoAll.filter(l => geoOn.has(l.id));
  const feed = world ? events : null, feedOn = new Set(feed?.datasets.map(d => d.id) ?? []);
  let span = '30', cellPick = null;
  let feedState = { sort: 'new', only: '', limit: 20 }, browseState = { sort: 'score', type: '', limit: 25 };
  let newsState = { category: '', query: '', sort: 'new', limit: 30 }, tab = 'overview';
  const TABS = [['overview', 'Обзор'], feed && ['events', 'События'], analytics && world && ['analysis', 'Анализ'],
    ['assets', 'Объекты'], news && ['news', 'Источники']].filter(Boolean);
  // One context object, so the analysis module can cache its computations.
  const context = { events: feed, news, layers: geoAll, nodes: [...model.nodes.values()], countries: world?.countries, date };
  const activeCells = () => (feed ? cellsFor(feed, feedOn, span) : []);

  const button = (textContent, onclick, label = textContent) => el('button', { type: 'button', textContent, ariaLabel: label, onclick });
  const tabs = el('div', { className: 'rg-tabs', role: 'group', ariaLabel: 'Вид' },
    ...modes.map(([value, text]) => Object.assign(button(text, () => setView(value)), { value })));
  const filter = picker('Сфера', [['', 'Все сферы'], ...names.map(s => [s, s])], value => setSphere(value));
  const countries = world ? [...Map.groupBy([...model.nodes.values()].filter(n => n.country), n => n.country)]
    .sort((a, b) => b[1].length - a[1].length).map(([code, list]) => [code, `${world.countries[code]?.name ?? code} (${list.length})`]) : [];
  const countryPicker = countries.length ? picker('Страна', [['', 'Все страны'], ...countries], value => setCountry(value || null)) : null;
  const colorPicker = picker('Раскраска', [['sphere', 'Цвет: сферы'], ['type', 'Цвет: тип'], ['risk', 'Цвет: риск']], value => setColor(value));
  const themePicker = picker('Тема', THEMES, value => { root.dataset.theme = value; paint(); });
  const input = el('input', { type: 'search', placeholder: 'Найти: Bitcoin, Apple… и Enter', ariaLabel: 'Поиск' });
  const tools = el('div', { className: 'rg-tools' });
  const regions = el('div', { className: 'rg-regions', role: 'group', ariaLabel: 'Регион' },
    ...REGIONS.map(([label, lon, lat, zoom]) => button(label, () => view.flyTo?.(lon, lat, zoom))));
  const status = el('p', { className: 'rg-status', role: 'status' });
  const legend = el('div', { className: 'rg-legend' });
  const stage = el('div', { className: 'rg-stage' });
  const panel = el('aside', { className: 'rg-panel', ariaLabel: 'Сведения' });

  const check = (label, checked, onchange) => {
    const box = el('input', { type: 'checkbox', checked });
    box.onchange = () => onchange(box.checked);
    return el('label', {}, box, el('span', { textContent: label }));
  };
  const counts = Map.groupBy([...model.nodes.values()], n => n.group);
  const assetBoxes = ASSET_LAYERS.filter(([key]) => counts.has(key)).map(([key, label]) =>
    check(`${label} · ${counts.get(key).length}`, true, on => { if (on) hidden.delete(key); else hidden.add(key); apply(); }));
  const riskBox = check('Только с флагами и взломами', false, on => { riskOnly = on; apply(); });
  const layers = el('details', { className: 'rg-layers', open: matchMedia('(min-width: 761px)').matches },
    el('summary', { textContent: 'Слои' }), ...assetBoxes, el('hr'), riskBox,
    ...(world ? MAP_LAYERS.map(([key, label]) => check(label, true, on => { shows[key] = on; view.layers?.(shows); })) : []));
  for (const [group, title] of Object.entries(GEO_GROUPS)) {
    const members = geoAll.filter(l => l.group === group);
    if (!members.length) continue;
    layers.append(el('fieldset', {}, el('legend', { textContent: title }), ...members.map(layer => {
      const row = check(`${layer.label} · ${layer.items.length}`, geoOn.has(layer.id), on => toggleGeo(layer.id, on));
      const swatch = el('i'); swatch.style.background = layer.color;
      row.querySelector('input').after(swatch);
      geoBoxes.set(layer.id, row.querySelector('input'));
      return row;
    })));
  }
  if (feed) {
    const choice = picker('Период событий', PERIODS, value => { span = value; updateEvents(); });
    choice.value = span;
    layers.querySelector('summary').after(el('fieldset', {}, el('legend', { textContent: 'События' }), choice,
      ...feed.datasets.map(d => {
        const row = check(`${d.label} · ${d.total.toLocaleString('ru')}`, true, on => { if (on) feedOn.add(d.id); else feedOn.delete(d.id); updateEvents(); });
        const swatch = el('i'); swatch.style.background = d.color;
        row.querySelector('input').after(swatch);
        return row;
      })));
  }
  const canvasHost = el('div', { className: 'rg-canvas' });
  stage.append(canvasHost, layers, regions, tools);

  root.classList.add('rg');
  root.dataset.theme ||= 'night';
  root.replaceChildren(el('div', { className: 'rg-bar' }, tabs, el('form', {}, input), filter, countryPicker,
    colorPicker, themePicker), legend, stage, panel, status);

  const pause = button('', () => view.toggleRotation());
  const onRotate = on => { pause.textContent = pause.ariaLabel = on ? 'Пауза' : 'Вращать'; };

  // The sphere filter and the layer switches decide what every view and the panel see.
  function visible() {
    const base = filterBySphere(model, filter.value);
    if (!hidden.size && !riskOnly) return base;
    const keep = base.nodes.filter(n => !hidden.has(n.group) && (!riskOnly || ['hacked', 'flagged'].includes(riskOf(n))));
    const ids = new Set(keep.map(n => n.id));
    return { nodes: keep, links: base.links.filter(l => ids.has(l.source) && ids.has(l.target)) };
  }

  const describe = text => {
    const label = modes.find(([value]) => value === mode)[1];
    const simplified = mode !== '3d' || shown.nodes.length <= simplifyAbove ? ''
      : shown.nodes.length > GRAPH_LIMIT ? ` · показаны ${GRAPH_LIMIT} крупнейших, связи только у выбранного` : ' · связи только у выбранного';
    const note = mode === 'earth' ? ' · без страны — на орбите' : mode === 'map' ? ' · только с известной страной' : '';
    status.textContent = text ?? `${label}: ${shown.nodes.length.toLocaleString('ru')}${note}${simplified}`;
  };

  function paint() {
    view.mark({ selected, country, geo: geoPick?.item ?? null, near: new Set(model.adjacency.get(selected)), colorOf: colorer(colorMode, colors) });
  }

  function renderLegend() {
    const dot = color => { const i = el('i'); i.style.background = color; i.style.color = color; return i; };
    if (colorMode === 'sphere') {
      legend.replaceChildren(...names.map(name => el('button', {
        type: 'button', ariaPressed: String(filter.value === name), onclick: () => setSphere(filter.value === name ? '' : name),
      }, dot(colors.get(name)), el('span', { textContent: name }))));
    } else {
      legend.replaceChildren(...Object.values(colorMode === 'risk' ? RISK : TYPES)
        .map(([label, color]) => el('span', {}, dot(color), el('span', { textContent: label }))));
    }
  }

  function renderPanel() {
    const handlers = {
      countries: world?.countries, date, period,
      onPeriod: value => { period = value; renderPanel(); panel.querySelector('.rg-period')?.focus(); },
      onSelect: id => { select(id); focusHeading(); },
      onCountry: code => { setCountry(code); focusHeading(); },
      onBack: () => { selected = null; setCountry(null); focusHeading(); },
    };
    const onMap = ['earth', 'map'].includes(mode);
    const onEvent = item => { selectEvent(item); focusHeading(); };
    // Sorting and paging rebuild the panel but keep the scroll position and the focused control.
    const rerender = target => {
      const top = panel.scrollTop;
      renderPanel();
      panel.scrollTop = top;
      panel.querySelector(target)?.focus({ preventScroll: true });
    };
    const onFeed = (change, target) => { feedState = { ...feedState, ...change }; rerender(target); };
    const onState = (change, target) => { browseState = { ...browseState, ...change }; rerender(target); };
    const onNews = (change, target) => { newsState = { ...newsState, ...change }; rerender(target); };
    const onGeoPick = (item, layer) => { selectGeo(item, layer); focusHeading(); };
    const start = () => {
      const [title, ...rest] = overview(shown.nodes, handlers);
      const tabBar = el('div', { className: 'rg-panel-tabs', role: 'group', ariaLabel: 'Разделы' },
        ...TABS.map(([key, label]) => el('button', { type: 'button', textContent: label, ariaPressed: String(tab === key),
          className: `rg-tab-${key}`, onclick: () => { tab = key; renderPanel(); panel.querySelector(`.rg-tab-${key}`)?.focus(); } })));
      const place = at => { if (!onMap) setView('earth'); view.focusGeo(at); };
      const body = {
        overview: () => rest,
        analysis: () => analytics(context, {}, { onCountry: handlers.onCountry, onPlace: place }),
        events: () => [...activityOverview(feed, feedOn, span, { onEvent, onFeed }, feedState), onMap ? geoOverview(activeGeo(), onGeoPick) : null],
        assets: () => [browser(shown.nodes, browseState, { ...handlers, onState })],
        news: () => newsSection(news, newsState, onNews),
      }[tab];
      const heading = tab === 'overview' ? title : el('h2', { textContent: TABS.find(t => t[0] === tab)[1], tabIndex: -1 });
      return [tabBar, heading, ...body()];
    };
    panel.replaceChildren(...(cellPick ? cellCard(feed, feedOn, span, cellPick, { ...handlers, onEvent })
      : geoPick ? geoCard(geoPick, handlers)
        : selected ? [...assetCard(model, selected, handlers), companySection(events, model.nodes.get(selected))]
          : country ? countryCard(country, shown.nodes, handlers) : start()).filter(Boolean));
    panel.scrollTop = 0;
  }
  // Panel buttons are rebuilt on every change, so keyboard focus moves to the new heading.
  const focusHeading = () => panel.querySelector('h2')?.focus({ preventScroll: true });

  function refresh() { paint(); renderPanel(); describe(); }

  function draw() {
    if (mode !== '3d' || shown.nodes.length <= GRAPH_LIMIT) return view.show(shown.nodes, shown.links);
    const keep = [...shown.nodes].sort((a, b) => b.size - a.size).slice(0, GRAPH_LIMIT);
    const chosen = model.nodes.get(selected);
    if (chosen && !keep.includes(chosen)) keep.push(chosen);
    const ids = new Set(keep.map(n => n.id));
    view.show(keep, shown.links.filter(l => ids.has(l.source) && ids.has(l.target)));
  }

  function setView(next) {
    view?.destroy();
    mode = modes.some(([value]) => value === next) ? next : modes[0][0];
    if (mode === '3d') {
      try { view = view3d(canvasHost, forceGraph, id => select(id), onRotate, simplifyAbove); }
      catch (error) { console.warn('3D недоступен', error); mode = '2d'; }
    }
    if (mode === 'earth' || mode === 'map') {
      view = viewEarth(canvasHost, { world, flat: mode === 'map', onPick: id => select(id), onCountry: setCountry, onGeo: selectGeo, onCell: selectCell, onRotate });
      view.layers(shows);
      view.geo(activeGeo());
      view.events(activeCells());
    }
    if (mode === '2d') view = viewScheme(canvasHost, { onPick: id => select(id), onCluster: name => setSphere(filter.value === name ? '' : name) });
    for (const tab of tabs.children) tab.setAttribute('aria-pressed', String(tab.value === mode));
    regions.hidden = !view.flyTo;
    tools.replaceChildren(...[(mode === 'earth' || mode === '3d') && pause,
      mode !== '3d' && button('+', () => view.zoom(1.4), 'Приблизить'),
      mode !== '3d' && button('−', () => view.zoom(1 / 1.4), 'Отдалить')].filter(Boolean));
    draw();
    if (selected) view.focus(selected);
    else if (geoPick) view.focusGeo?.(anchor(geoPick.item));
    refresh();
  }

  function updateEvents() {
    view.events?.(activeCells());
    refresh();
  }

  function selectCell(cell) {
    if (feed) tab = 'events';
    cellPick = { lon: cell.lon, lat: cell.lat };
    geoPick = null;
    selected = null;
    country = null;
    if (countryPicker) countryPicker.value = '';
    refresh();
  }

  function selectEvent(item) {
    const dataset = feed.datasets[item.ds];
    if (!Number.isFinite(item.lon)) {
      selectCell(item);
      cellPick = { lon: null, lat: null, title: item.title, date: item.d, label: dataset.label };
      refresh();
      return;
    }
    selectCell(item);
    cellPick = { lon: item.lon, lat: item.lat, title: item.title, date: item.d, label: dataset.label };
    // The card shows the grid cell the event belongs to.
    const cell = activeCells().filter(c => c.dataset.id === dataset.id)
      .sort((a, b) => Math.hypot(a.lon - item.lon, a.lat - item.lat) - Math.hypot(b.lon - item.lon, b.lat - item.lat))[0];
    if (cell) Object.assign(cellPick, { lon: cell.lon, lat: cell.lat });
    if (!['earth', 'map'].includes(mode)) setView('earth');
    view.focusGeo({ lon: item.lon, lat: item.lat });
    refresh();
  }

  function toggleGeo(id, on) {
    if (on) geoOn.add(id); else geoOn.delete(id);
    if (!on && geoPick?.layer.id === id) geoPick = null;
    view.geo?.(activeGeo());
    refresh();
  }

  function selectGeo(item, layer) {
    geoPick = { item, layer };
    cellPick = null;
    selected = null;
    country = null;
    if (countryPicker) countryPicker.value = '';
    geoOn.add(layer.id);
    geoBoxes.get(layer.id).checked = true;
    if (!['earth', 'map'].includes(mode)) { setView('earth'); return; }
    view.geo(activeGeo());
    view.focusGeo(anchor(item));
    refresh();
  }

  function apply() {
    shown = visible();
    if (selected && !shown.nodes.some(n => n.id === selected)) selected = null;
    draw();
    if (selected) view.focus(selected);
    renderLegend();
    refresh();
  }

  function setSphere(sphere) {
    filter.value = sphere;
    apply();
  }

  function setCountry(code) {
    country = code;
    selected = null;
    geoPick = null;
    cellPick = null;
    if (countryPicker) countryPicker.value = code ?? '';
    if (code) view.focusCountry?.(code);
    refresh();
  }

  function setColor(next) {
    colorMode = colorPicker.value = next;
    renderLegend();
    paint();
  }

  function select(id) {
    const node = model.nodes.get(id);
    if (!node) return false;
    // A target outside the current filter or layers clears them so it can be shown.
    if (!shown.nodes.some(n => n.id === id)) {
      filter.value = '';
      hidden.clear();
      riskOnly = false;
      assetBoxes.forEach(box => { box.querySelector('input').checked = true; });
      riskBox.querySelector('input').checked = false;
      apply();
    }
    selected = id;
    geoPick = null;
    cellPick = null;
    // Hubs have no place on the map, so show them in a graph view.
    if (['earth', 'map'].includes(mode) && ['sphere', 'chain'].includes(node.group)) setView(can3d ? '3d' : '2d');
    paint();
    view.focus(id);
    renderPanel();
    describe();
    onSelect(node, [...model.adjacency.get(id)].map(n => model.nodes.get(n)));
    return true;
  }

  function find(query) {
    // Shown nodes come first, so they win ties without hiding a better match elsewhere.
    const hit = search([...shown.nodes, ...model.nodes.values()], query);
    if (hit) { select(hit.id); return hit; }
    const place = searchGeo(geoAll, query);
    if (place) selectGeo(place.item, place.layer);
    else describe('Не найдено.');
    return place;
  }

  input.form.onsubmit = event => { event.preventDefault(); find(input.value); };
  shown = visible();
  renderLegend();
  setView(options.view ?? modes[0][0]);

  return {
    get mode() { return mode; },
    select, search: find, setSphere, setCountry, setView, setColor, selectGeo,
    counts: () => ({ nodes: shown.nodes.length, links: shown.links.length }),
    spin: () => view.spin(),
    destroy() { view.destroy(); root.replaceChildren(); root.classList.remove('rg'); delete root.dataset.theme; },
  };
}
