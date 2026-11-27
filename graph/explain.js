// Plain-language help for every view, sphere descriptions and the readable subgraph for the 3D view.

export const HELP = {
  earth: ['Точки на суше — компании и биржи по странам (место внутри страны условное).',
    'Кольцо вокруг Земли — крупнейшие объекты, чья страна неизвестна.',
    'Пятна — события. Крупное пятно в середине страны часто означает новости без точного места, а не происшествие в этой точке.',
    'Ромбы, квадраты, треугольники — слои из списка слева.'],
  map: ['То же, что на глобусе, на плоской карте. Объекты без страны здесь не показаны.',
    'Щёлкните страну, чтобы увидеть её объекты.'],
  '3d': ['Белые узлы — сферы, синие — блокчейн-сети, цветные — крупнейшие объекты каждой сферы.',
    'Линия значит «объект относится к сфере» или «проект работает в сети».',
    'Щёлкните узел: добавятся все его прямые связи.'],
  '2d': ['Круг — сфера. Чем он больше, тем больше в нём объектов; внутри названы крупнейшие.',
    'Дуга между кругами — общие связи (например, проекты сферы работают в сетях). Число на дуге — сколько их.',
    'Приблизьте круг, чтобы увидеть отдельные объекты. Щелчок по кругу оставляет только эту сферу.'],
  chart: ['Свеча — один день: тело от открытия до закрытия, тени — максимум и минимум. Зелёная — рост, красная — падение.',
    'Линия — средняя цена за 20 дней. Столбики снизу — объём торгов.',
    'Метка над свечой — необычный день. Щёлкните её: справа факты об этом дне. Совпадение по дате не доказывает причину.'],
};

export const SPHERE_TEXT = {
  'Биржи и обмен': 'Площадки, где покупают и меняют активы: централизованные и децентрализованные.',
  'Кредитование и долг': 'Протоколы, где берут и дают в долг под залог.',
  'Доходность и стейкинг': 'Сервисы, где активы блокируют ради дохода.',
  'Деривативы и прогнозы': 'Фьючерсы, опционы и рынки предсказаний.',
  'Стейблкоины': 'Токены, привязанные к цене обычной валюты, и их эмитенты.',
  'Мосты и инфраструктура': 'Перенос активов между сетями, кошельки, оракулы и инструменты.',
  'Реальные активы и платежи': 'Токенизированные реальные активы, карты и платежи.',
  'Запуск токенов и мемы': 'Площадки запуска и мемкоины. Самая рискованная часть рынка.',
  'Монеты': 'Крупные криптовалюты и токены по капитализации.',
};

const HUBS = new Set(['sphere', 'chain']);

// A graph small enough to read: sphere hubs, the busiest chains, the leading assets of each sphere,
// plus the selected node with its direct neighbors.
export function connectedSubgraph(model, nodes, links, selected, { perSphere = 11, chains = 16 } = {}) {
  const available = new Set(nodes.map(n => n.id));
  const keep = new Set();
  for (const members of Map.groupBy(nodes.filter(n => !HUBS.has(n.group)), n => n.sphere).values()) {
    [...members].sort((a, b) => b.size - a.size).slice(0, perSphere).forEach(n => keep.add(n.id));
  }
  nodes.filter(n => n.group === 'chain')
    .sort((a, b) => model.adjacency.get(b.id).size - model.adjacency.get(a.id).size).slice(0, chains).forEach(n => keep.add(n.id));
  nodes.filter(n => n.group === 'sphere').forEach(n => keep.add(n.id));
  if (selected && model.nodes.has(selected)) {
    keep.add(selected);
    [...model.adjacency.get(selected)].filter(id => available.has(id)).slice(0, 60).forEach(id => keep.add(id));
  }
  let kept = links.filter(l => keep.has(l.source) && keep.has(l.target));
  // Show the main connected network; isolated stars say nothing about connections.
  const parent = new Map([...keep].map(id => [id, id]));
  const root = id => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
  for (const l of kept) parent.set(root(l.source), root(l.target));
  const groups = Map.groupBy(new Set(kept.flatMap(l => [l.source, l.target])), root);
  const main = [...groups].sort((a, b) => b[1].length - a[1].length)[0]?.[0];
  const shownGroups = new Set([main, selected && keep.has(selected) ? root(selected) : main]);
  kept = kept.filter(l => shownGroups.has(root(l.source)));
  // Nodes without any visible link are only noise in a connection graph.
  const linked = new Set(kept.flatMap(l => [l.source, l.target]));
  return { nodes: [...keep].filter(id => linked.has(id) || id === selected).map(id => model.nodes.get(id)), links: kept };
}
