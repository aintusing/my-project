// Pure graph logic: no DOM, no network.

export function buildModel(data) {
  const nodes = new Map();
  for (const raw of data?.nodes ?? []) {
    if (raw?.id === undefined || raw.id === null) continue;
    const id = String(raw.id);
    nodes.set(id, {
      id, name: String(raw.name ?? id), group: String(raw.group ?? 'unknown'),
      sphere: String(raw.sphere ?? raw.group ?? 'unknown'), size: Number(raw.size) > 0 ? Number(raw.size) : 1,
    });
  }
  const adjacency = new Map([...nodes.keys()].map(id => [id, new Set()]));
  const links = [];
  for (const raw of data?.links ?? []) {
    const source = String(raw?.source), target = String(raw?.target);
    if (!nodes.has(source) || !nodes.has(target) || source === target || adjacency.get(source).has(target)) continue;
    adjacency.get(source).add(target);
    adjacency.get(target).add(source);
    links.push({ source, target });
  }
  return { nodes, links, adjacency };
}

export const spheres = model => [...new Set([...model.nodes.values()].map(n => n.sphere))].sort();

// A filtered view keeps the sphere members and their direct neighbors (shared hubs).
export function filterBySphere(model, sphere) {
  if (!sphere) return { nodes: [...model.nodes.values()], links: model.links };
  const members = new Set([...model.nodes.values()].filter(n => n.sphere === sphere).map(n => n.id));
  const links = model.links.filter(l => members.has(l.source) || members.has(l.target));
  const keep = new Set([...members, ...links.flatMap(l => [l.source, l.target])]);
  return { nodes: [...keep].map(id => model.nodes.get(id)), links };
}

// Exact name first, then prefix, then substring.
export function search(nodes, query) {
  const q = String(query ?? '').trim().toLocaleLowerCase();
  if (!q) return null;
  let best = null, rank = 3;
  for (const node of nodes) {
    const name = node.name.toLocaleLowerCase();
    const score = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3;
    if (score < rank) { best = node; rank = score; }
  }
  return best;
}

export function neighbors(model, id) {
  return [...(model.adjacency.get(id) ?? [])].map(n => model.nodes.get(n))
    .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
}

// Flat layout for the 2D view: spheres on a ring, members on a spiral.
export function layout(nodes) {
  const bySphere = Map.groupBy(nodes, n => n.sphere);
  const positions = new Map();
  // The ring is just long enough for the largest cluster, so clusters stay visible.
  const cluster = 14 * Math.sqrt(Math.max(1, ...[...bySphere.values()].map(g => g.length)));
  const ring = Math.max(100, 1.15 * cluster * bySphere.size / Math.PI);
  [...bySphere.keys()].sort().forEach((sphere, index) => {
    const angle = index / bySphere.size * Math.PI * 2;
    const cx = bySphere.size > 1 ? Math.cos(angle) * ring : 0;
    const cy = bySphere.size > 1 ? Math.sin(angle) * ring : 0;
    bySphere.get(sphere).forEach((node, i) => {
      const radius = 14 * Math.sqrt(i), turn = i * 2.39996;
      positions.set(node.id, { x: cx + Math.cos(turn) * radius, y: cy + Math.sin(turn) * radius });
    });
  });
  return positions;
}

// Evenly spaced unit vectors (Fibonacci sphere).
function fibonacci(count) {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - 2 * (i + 0.5) / count, r = Math.sqrt(1 - y * y), turn = i * 2.39996323;
    return [Math.cos(turn) * r, y, Math.sin(turn) * r];
  });
}

// Planet layout: every node sits on one globe and each sphere forms its own "continent".
export function globe(nodes) {
  const radius = Math.max(120, 14 * Math.sqrt(nodes.length / (4 * Math.PI)));
  const bySphere = [...Map.groupBy(nodes, n => n.sphere).values()];
  const slots = fibonacci(nodes.length), centers = fibonacci(bySphere.length), positions = new Map();
  if (bySphere.length > 60) {
    bySphere.flat().forEach((node, i) => {
      const [x, y, z] = slots[i];
      positions.set(node.id, { x: x * radius, y: y * radius, z: z * radius });
    });
    return { radius, positions };
  }
  const pairs = [];
  slots.forEach((p, slot) => centers.forEach((c, g) => pairs.push([p[0] * c[0] + p[1] * c[1] + p[2] * c[2], slot, g])));
  pairs.sort((a, b) => b[0] - a[0]);
  const taken = new Set(), filled = bySphere.map(() => 0);
  for (const [, slot, g] of pairs) {
    if (taken.has(slot) || filled[g] === bySphere[g].length) continue;
    const [x, y, z] = slots[slot];
    positions.set(bySphere[g][filled[g]++].id, { x: x * radius, y: y * radius, z: z * radius });
    taken.add(slot);
  }
  return { radius, positions };
}

export const escapeHtml = text => String(text).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
