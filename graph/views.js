// Two renderers with one interface: show, mark, focus, spin (benchmark), destroy.
import { escapeHtml, globe, layout } from './model.js';

const COLORS = { sphere: '#ffffff', chain: '#58a6ff', warning: '#e3b341', hacked: '#ff4d4f' };
const color = (node, mark) => node.id === mark.selected ? '#ff7bf0'
  : mark.near.has(node.id) ? '#39d3e0' : COLORS[node.group] ?? '#3fb950';
const end = value => typeof value === 'object' ? value.id : value;
const touches = (link, id) => end(link.source) === id || end(link.target) === id;

export function view3d(stage, ForceGraph3D, onPick, onRotate, simplifyAbove) {
  let mark = { selected: null, near: new Set() }, large = false;
  const graph = ForceGraph3D({ controlType: 'orbit' })(stage)
    .backgroundColor('#000011').showNavInfo(false).enableNodeDrag(false)
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

export function view2d(stage, onPick, simplifyAbove) {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '2D-граф. Стрелки двигают, плюс и минус меняют масштаб. Узлы выбираются поиском и списком соседей.');
  stage.replaceChildren(canvas);
  const ctx = canvas.getContext('2d');
  let nodes = [], links = [], at = new Map(), mark = { selected: null, near: new Set() };
  let x = 0, y = 0, k = 1, drag = null;
  const draw = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(k, 0, 0, k, w / 2 + x, h / 2 + y);
    ctx.beginPath();
    for (const l of links) {
      if (nodes.length > simplifyAbove && !touches(l, mark.selected)) continue;
      const a = at.get(l.source), b = at.get(l.target);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = '#8b949e66'; ctx.lineWidth = 1 / k; ctx.stroke();
    for (const n of nodes) {
      const p = at.get(n.id);
      ctx.fillStyle = color(n, mark);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2.5 / k, 3 * Math.cbrt(n.size)), 0, Math.PI * 2); ctx.fill();
    }
  };
  const zoom = factor => {
    const next = Math.min(8, Math.max(0.02, k * factor));
    x *= next / k; y *= next / k; k = next; draw();
  };
  canvas.onwheel = e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); };
  canvas.onkeydown = e => {
    const move = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (move) { e.preventDefault(); x += move[0]; y += move[1]; draw(); }
    else if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1 / 1.2);
  };
  canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
  canvas.onpointerdown = e => { if (!e.isPrimary || e.button !== 0) return; drag = { sx: e.clientX, sy: e.clientY, x, y, moved: false }; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = e => {
    if (!drag || !e.isPrimary) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    drag.moved ||= Math.hypot(dx, dy) > 4;
    x = drag.x + dx; y = drag.y + dy; draw();
  };
  canvas.onpointerup = e => {
    if (!e.isPrimary) return;
    if (drag && !drag.moved) {
      const box = canvas.getBoundingClientRect();
      const px = (e.clientX - box.left - box.width / 2 - x) / k, py = (e.clientY - box.top - box.height / 2 - y) / k;
      let best = null, limit = 12 / k;
      for (const n of nodes) {
        const d = Math.hypot(at.get(n.id).x - px, at.get(n.id).y - py);
        if (d < limit) { best = n; limit = d; }
      }
      if (best) onPick(best.id);
    }
    drag = null;
  };
  const resize = new ResizeObserver(draw);
  resize.observe(stage);
  return {
    show(nextNodes, nextLinks) {
      nodes = nextNodes; links = nextLinks; at = layout(nodes);
      const reach = Math.max(100, ...[...at.values()].map(p => Math.hypot(p.x, p.y)));
      k = Math.min(stage.clientWidth, stage.clientHeight) / (2.2 * reach) || 1; x = 0; y = 0; draw();
    },
    mark(next) { mark = next; draw(); },
    zoom,
    focus(id) { const p = at.get(id); if (!p) return; k = Math.max(k, 1.5); x = -p.x * k; y = -p.y * k; draw(); },
    spin() { let t = 0; return () => { t += 0.05; x += Math.cos(t) * 4; y += Math.sin(t) * 4; draw(); }; },
    destroy() { resize.disconnect(); stage.replaceChildren(); },
  };
}
