// 3D graph renderer. Interface shared by all views: show, mark, focus, spin (benchmark), destroy.
import { escapeHtml, globe, layout } from './model.js';

const color = (node, mark) => node.id === mark.selected ? '#ff7bf0'
  : mark.near.has(node.id) ? '#ffffff' : mark.colorOf(node);
const end = value => typeof value === 'object' ? value.id : value;
const touches = (link, id) => end(link.source) === id || end(link.target) === id;

export function view3d(stage, ForceGraph3D, onPick, onRotate, simplifyAbove) {
  let mark = { selected: null, near: new Set(), colorOf: () => '#8b949e' }, large = false;
  const graph = ForceGraph3D({ controlType: 'orbit' })(stage)
    .backgroundColor('#03050f').showNavInfo(false).enableNodeDrag(false)
    .nodeLabel(n => escapeHtml(n.name)).nodeVal(n => n.size).nodeRelSize(3).linkOpacity(0.4)
    .onNodeClick(n => onPick(n.id));
  // Rotation stops on selection or any pointer interaction and stays off until resumed.
  let spinning = false;
  const rotate = on => {
    spinning = on;
    Object.assign(graph.controls(), { autoRotate: on, autoRotateSpeed: 0.6 });
    onRotate(on);
  };
  graph.controls().addEventListener('start', () => rotate(false));
  stage.addEventListener('pointerdown', () => rotate(false));
  const paint = () => graph.nodeColor(n => color(n, mark))
    .linkVisibility(l => !large || touches(l, mark.selected));
  const resize = new ResizeObserver(() => graph.width(stage.clientWidth).height(stage.clientHeight));
  resize.observe(stage);
  // Names of the hubs (and the selection) float over the 3D picture.
  const layer = Object.assign(document.createElement('div'), { className: 'rg-names' });
  stage.append(layer);
  let named = [], frame = 0;
  const place = () => {
    const taken = [];
    for (const { node, tag } of named) {
      if (node.x === undefined) { tag.hidden = true; continue; }
      const { x, y } = graph.graph2ScreenCoords(node.x, node.y, node.z);
      const hidden = x < 0 || y < 0 || x > stage.clientWidth || y > stage.clientHeight || taken.some(([tx, ty]) => Math.abs(tx - x) < 90 && Math.abs(ty - y) < 18);
      tag.hidden = hidden;
      if (!hidden) { taken.push([x, y]); tag.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`; }
    }
    frame = requestAnimationFrame(place);
  };
  frame = requestAnimationFrame(place);
  const name = () => {
    const nodes = graph.graphData().nodes;
    const rank = n => (n.id === mark.selected ? 3 : n.group === 'sphere' ? 2 : n.group === 'chain' ? 1 : 0);
    named = nodes.filter(n => rank(n) > 0).sort((a, b) => rank(b) - rank(a) || b.size - a.size).slice(0, 36)
      .map(node => ({ node, tag: Object.assign(document.createElement('span'), { textContent: node.name }) }));
    layer.replaceChildren(...named.map(n => n.tag));
  };
  return {
    show(nodes, links) {
      large = nodes.length > simplifyAbove;
      const { radius, positions } = globe(nodes);
      // Large graphs get lower detail and links only around the selection.
      // Up to 1500 nodes are arranged by their links; larger sets are pinned to a globe without physics.
      const free = nodes.length <= 1500;
      graph.cooldownTicks(free ? 110 : 0);
      let fitted = false;
      graph.onEngineStop(() => { if (free && !fitted) { fitted = true; graph.zoomToFit(500, 30); } });
      const pinned = nodes.map(n => {
        if (free) return { ...n };
        const p = positions.get(n.id);
        return { ...n, ...p, fx: p.x, fy: p.y, fz: p.z };
      });
      graph.nodeResolution(large ? 5 : 10);
      paint();
      graph.nodeRelSize(free ? 2.6 : 3);
      graph.graphData({ nodes: pinned, links: links.map(l => ({ ...l })) });
      name();
      graph.cameraPosition({ x: 0, y: 0, z: free ? 90 * Math.cbrt(nodes.length) : radius * 3 }, { x: 0, y: 0, z: 0 });
      rotate(spinning);
    },
    toggleRotation() { rotate(!spinning); },
    mark(next) { mark = next; paint(); name(); },
    focus(id) {
      const node = graph.graphData().nodes.find(n => n.id === id);
      if (!node || node.x === undefined) return;
      rotate(false);
      // Fly above the node and keep the planet center in view.
      if (node.fx === undefined) return graph.cameraPosition({ x: node.x, y: node.y, z: node.z + 260 }, node, 700);
      const r = Math.hypot(node.x, node.y, node.z) || 1, k = 1 + Math.max(300, r * 1.1) / r;
      graph.cameraPosition({ x: node.x * k, y: node.y * k, z: node.z * k }, { x: 0, y: 0, z: 0 }, 900);
    },
    spin() {
      rotate(false);
      const { x, y, z } = graph.cameraPosition(), r = Math.hypot(x, z) || 500;
      let a = Math.atan2(x, z);
      return () => { a += 0.01; graph.cameraPosition({ x: r * Math.sin(a), y, z: r * Math.cos(a) }); };
    },
    destroy() {
      resize.disconnect();
      cancelAnimationFrame(frame);
      const renderer = graph.renderer();
      graph._destructor();
      renderer.forceContextLoss();
      stage.replaceChildren();
    },
  };
}
