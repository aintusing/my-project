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
    .nodeLabel(n => escapeHtml(n.name)).nodeVal(n => n.size).nodeRelSize(3).linkOpacity(0.18)
    .cooldownTicks(0) // positions are fixed on the globe, no physics
    .onNodeClick(n => onPick(n.id));
  // Rotation stops on selection or any pointer interaction and stays off until resumed.
  let spinning = !matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  return {
    show(nodes, links) {
      large = nodes.length > simplifyAbove;
      const { radius, positions } = globe(nodes);
      // Large graphs get lower detail and links only around the selection.
      const pinned = nodes.map(n => {
        const p = positions.get(n.id);
        return { ...n, ...p, fx: p.x, fy: p.y, fz: p.z };
      });
      graph.nodeResolution(large ? 5 : 10);
      paint();
      graph.graphData({ nodes: pinned, links: links.map(l => ({ ...l })) });
      graph.cameraPosition({ x: 0, y: 0, z: radius * 3 }, { x: 0, y: 0, z: 0 });
      rotate(spinning);
    },
    toggleRotation() { rotate(!spinning); },
    mark(next) { mark = next; paint(); },
    focus(id) {
      const node = graph.graphData().nodes.find(n => n.id === id);
      if (!node || node.x === undefined) return;
      rotate(false);
      // Fly above the node and keep the planet center in view.
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
      const renderer = graph.renderer();
      graph._destructor();
      renderer.forceContextLoss();
      stage.replaceChildren();
    },
  };
}
