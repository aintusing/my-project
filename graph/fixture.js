// SYNTHETIC data for demos and performance tests. Not real assets.
export function syntheticGraph(count = 5000) {
  const spheres = 20;
  const nodes = [], links = [];
  for (let s = 0; s < spheres; s++) {
    nodes.push({ id: `s${s}`, name: `Синтетическая сфера ${s + 1}`, group: 'sphere', sphere: `Сфера ${s + 1}`, size: 12 });
  }
  const groups = ['project', 'warning', 'hacked', 'chain'];
  for (let i = 0; i < count - spheres; i++) {
    const s = i % spheres;
    nodes.push({ id: `n${i}`, name: `Синтетический узел ${i + 1}`, group: groups[(i * 7) % 4], sphere: `Сфера ${s + 1}`, size: 1 + (i % 5) });
    links.push({ source: `n${i}`, target: `s${s}` });
    if (i > 0) links.push({ source: `n${i}`, target: `n${(i * 31) % i}` });
  }
  return { nodes, links };
}
