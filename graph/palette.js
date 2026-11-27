// Color modes shared by every view and the legend.
export const TYPES = {
  project: ['Крипто-проект', '#7fa7b8'], meme: ['Мемкоин', '#c27a8e'], coin: ['Монета', '#d3a54a'],
  exchange: ['Биржа', '#a294bd'], stock: ['Акция', '#8fb573'], sphere: ['Сфера', '#ece8df'], chain: ['Сеть', '#6f8fb0'],
};
export const RISK = {
  hacked: ['Был взлом', '#d96c5f'], flagged: ['Есть флаги', '#d9a441'], clear: ['Флагов нет', '#8fb573'], unknown: ['Нет данных', '#8b887f'],
};
// Groups used by older fixtures keep a stable color too.
const PLAIN = { warning: '#d9a441', hacked: '#d96c5f' };

export const typeLabel = group => TYPES[group]?.[0] ?? group;

export function riskOf(node) {
  if (!node.meta?.flags) return 'unknown';
  if (node.meta.flags.includes('был взлом')) return 'hacked';
  return node.meta.flags.length ? 'flagged' : 'clear';
}

export function sphereColors(names) {
  return new Map([...names].sort().map((name, i) => [name, `hsl(${Math.round(i * 137.508 + 30) % 360} 40% 62%)`]));
}

export function colorer(mode, spheres) {
  if (mode === 'risk') return node => RISK[riskOf(node)][1];
  if (mode === 'type') return node => TYPES[node.group]?.[1] ?? PLAIN[node.group] ?? '#3ddc97';
  return node => spheres.get(node.sphere) ?? '#8b949e';
}
