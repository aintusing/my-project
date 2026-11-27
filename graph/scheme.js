// Scheme view: every sphere is a "galaxy". The biggest assets sit in its core, links between
// spheres are bundled into arcs, and the selected asset shows its own connections.
const GOLDEN = 2.39996323;
const SPACING = 5.2;

// Packs one circle per sphere around the largest one, then places members on a sunflower spiral.
export function packClusters(nodes) {
  const clusters = [...Map.groupBy(nodes, n => n.sphere)]
    .map(([name, members]) => ({ name, members: members.sort((a, b) => b.size - a.size), r: SPACING * Math.sqrt(members.length) + 22 }))
    .sort((a, b) => b.r - a.r || a.name.localeCompare(b.name));
  const placed = [], at = new Map();
  for (const cluster of clusters) {
    let x = 0, y = 0;
    // Walk an outward spiral (wider than tall, like a screen) until the circle fits.
    for (let step = 0; placed.some(p => Math.hypot(p.x - x, p.y - y) < p.r + cluster.r + 26); step++) {
      const angle = step * 0.23, reach = 3.5 * angle;
      x = Math.cos(angle) * reach * 1.55; y = Math.sin(angle) * reach;
    }
    Object.assign(cluster, { x, y });
    placed.push(cluster);
    cluster.members.forEach((node, i) => {
      const reach = SPACING * Math.sqrt(i), turn = i * GOLDEN;
      at.set(node.id, { x: x + Math.cos(turn) * reach, y: y + Math.sin(turn) * reach, cluster });
    });
  }
  return { clusters, at };
}

export function viewScheme(stage, { onPick, onCluster }) {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Схема сфер. Стрелки двигают, плюс и минус меняют масштаб. Объекты выбираются поиском и списками.');
  const tip = Object.assign(document.createElement('div'), { className: 'rg-tip', hidden: true });
  stage.replaceChildren(canvas, tip);
  const ctx = canvas.getContext('2d');
  let nodes = [], clusters = [], at = new Map(), bundles = [], linksOf = new Map();
  let mark = { selected: null, near: new Set(), colorOf: () => '#8b949e' };
  let x = 0, y = 0, k = 1, drag = null, theme = {}, fitted = false;

  const readTheme = () => {
    const css = getComputedStyle(stage);
    for (const key of ['space', 'deep', 'glow', 'ink', 'line']) theme[key] = css.getPropertyValue(`--earth-${key}`).trim();
  };
  const size = n => Math.min(11, 1.25 + Math.sqrt(n.size) * 0.62);
  const toWorld = (sx, sy) => [(sx - stage.clientWidth / 2 - x) / k, (sy - stage.clientHeight / 2 - y) / k];

  // A cluster takes the most common color of its leading members.
  function tint() {
    for (const c of clusters) {
      const tally = Map.groupBy(c.members.slice(0, 60), n => mark.colorOf(n));
      c.color = [...tally].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? '#8b949e';
    }
  }

  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h || !clusters.length) return;
    const box = clusters.reduce((b, c) => [Math.min(b[0], c.x - c.r), Math.min(b[1], c.y - c.r - 30), Math.max(b[2], c.x + c.r), Math.max(b[3], c.y + c.r)], [1e9, 1e9, -1e9, -1e9]);
    const inset = w > 760 ? 300 : 0; // room for the layer panel
    k = Math.min((w - inset) / (box[2] - box[0] + 40), h / (box[3] - box[1] + 40));
    x = inset / 2 - (box[0] + box[2]) / 2 * k; y = -(box[1] + box[3]) / 2 * k; fitted = true;
  }

  function draw() {
    const w = stage.clientWidth, h = stage.clientHeight, ratio = Math.min(2, devicePixelRatio || 1);
    if (!w || !h) return;
    if (!fitted) fit();
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const sky = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
    sky.addColorStop(0, theme.deep); sky.addColorStop(1, theme.space);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(ratio * k, 0, 0, ratio * k, ratio * (w / 2 + x), ratio * (h / 2 + y));
    const [left, top] = toWorld(0, 0), [right, bottom] = toWorld(w, h);
    const inside = (px, py, pad) => px > left - pad && px < right + pad && py > top - pad && py < bottom + pad;

    // Arcs between spheres: thicker means more shared connections.
    ctx.lineCap = 'round';
    for (const bundle of bundles) {
      const { a, b, count, strength } = bundle;
      const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      gradient.addColorStop(0, a.color); gradient.addColorStop(1, b.color);
      ctx.strokeStyle = gradient; ctx.globalAlpha = 0.1 + strength * 0.28; ctx.lineWidth = 1 + Math.log2(count + 1) * 1.6;
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2 - (b.y - a.y) * 0.18, (a.y + b.y) / 2 + (b.x - a.x) * 0.18, b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const c of clusters) {
      if (!inside(c.x, c.y, c.r * 1.3)) continue;
      const halo = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * 1.18);
      halo.addColorStop(0, c.color); halo.addColorStop(0.45, c.color); halo.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.13; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.18, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.45; ctx.strokeStyle = c.color; ctx.lineWidth = 1 / k;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }

    const groups = new Map(), bright = [];
    for (const n of nodes) {
      const p = at.get(n.id);
      if (!inside(p.x, p.y, 14)) continue;
      const chosen = n.id === mark.selected, near = mark.near.has(n.id);
      const color = chosen || near ? '#ffffff' : mark.colorOf(n), r = size(n) * (chosen ? 1.8 : 1);
      (groups.get(color) ?? groups.set(color, []).get(color)).push(p.x, p.y, r);
      if (n.meta?.score >= 75 || chosen) bright.push(p.x, p.y, r, color);
    }
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < bright.length; i += 4) { ctx.fillStyle = bright[i + 3]; ctx.beginPath(); ctx.arc(bright[i], bright[i + 1], bright[i + 2] * 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = mark.selected ? 0.55 : 0.95;
    for (const [color, list] of groups) {
      ctx.globalAlpha = mark.selected && color !== '#ffffff' ? 0.4 : 0.95;
      ctx.fillStyle = color; ctx.beginPath();
      for (let i = 0; i < list.length; i += 3) {
        // Dots smaller than two screen pixels are squares: much cheaper.
        if (list[i + 2] * k < 2) ctx.rect(list[i] - list[i + 2], list[i + 1] - list[i + 2], list[i + 2] * 2, list[i + 2] * 2);
        else { ctx.moveTo(list[i] + list[i + 2], list[i + 1]); ctx.arc(list[i], list[i + 1], list[i + 2], 0, Math.PI * 2); }
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const from = mark.selected && at.get(mark.selected);
    if (from) {
      ctx.strokeStyle = theme.glow; ctx.lineWidth = 1.4 / k; ctx.globalAlpha = 0.8; ctx.beginPath();
      for (const id of linksOf.get(mark.selected) ?? []) {
        const to = at.get(id);
        if (!to) continue;
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo((from.x + to.x) / 2 - (to.y - from.y) * 0.15, (from.y + to.y) / 2 + (to.x - from.x) * 0.15, to.x, to.y);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Labels are drawn in screen pixels so they stay readable at any zoom.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const screen = p => [w / 2 + x + p.x * k, h / 2 + y + p.y * k];
    const taken = [];
    const label = (text, sx, sy, font, color) => {
      ctx.font = font;
      const half = ctx.measureText(text).width / 2 + 4;
      if (sx < -half || sx > w + half || sy < 8 || sy > h) return;
      if (taken.some(t => Math.abs(t[0] - sx) < t[2] + half && Math.abs(t[1] - sy) < 15)) return;
      taken.push([sx, sy, half]);
      ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = theme.space; ctx.strokeText(text, sx, sy);
      ctx.fillStyle = color; ctx.fillText(text, sx, sy);
    };
    if (from) { const n = nodes.find(m => m.id === mark.selected); const [sx, sy] = screen(from); label(n.name, sx, sy - 16, '700 14px system-ui, sans-serif', theme.ink); }
    for (const c of clusters) {
      const [sx, sy] = screen({ x: c.x, y: c.y - c.r });
      label(`${c.name} · ${c.members.length.toLocaleString('ru')}`, sx, sy - 6, '700 12px system-ui, sans-serif', theme.ink);
    }
    for (const c of clusters) {
      // The more a galaxy fills the screen, the more of its leading assets get names.
      for (const n of c.members.filter(m => m.group !== 'sphere').slice(0, Math.min(40, Math.floor(c.r * k / 45)))) {
        const [sx, sy] = screen(at.get(n.id));
        label(n.name, sx, sy - 8, '500 11px system-ui, sans-serif', theme.ink);
      }
    }
  }

  let queued = 0;
  const redraw = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; draw(); }); };
  const zoomAt = (factor, sx, sy) => {
    const next = Math.min(12, Math.max(0.04, k * factor)), px = sx - stage.clientWidth / 2, py = sy - stage.clientHeight / 2;
    x = px - (px - x) * next / k; y = py - (py - y) * next / k; k = next; redraw();
  };
  const point = e => { const box = canvas.getBoundingClientRect(); return [e.clientX - box.left, e.clientY - box.top]; };
  const hit = (sx, sy) => {
    const [px, py] = toWorld(sx, sy);
    const cluster = clusters.find(c => Math.hypot(c.x - px, c.y - py) <= c.r);
    let node = null, limit = 7 / k;
    for (const n of cluster?.members ?? []) { const p = at.get(n.id), d = Math.hypot(p.x - px, p.y - py) - size(n) / 2; if (d < limit) { node = n; limit = d; } }
    return { node, cluster };
  };

  canvas.onwheel = e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, ...point(e)); };
  canvas.onkeydown = e => {
    const move = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
    if (move) { e.preventDefault(); x += move[0]; y += move[1]; redraw(); }
    else if (e.key === '+' || e.key === '=') zoomAt(1.25, stage.clientWidth / 2, stage.clientHeight / 2);
    else if (e.key === '-') zoomAt(0.8, stage.clientWidth / 2, stage.clientHeight / 2);
  };
  canvas.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = { sx: e.clientX, sy: e.clientY, x, y, moved: false }; canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
  canvas.onpointermove = e => {
    if (!e.isPrimary) return;
    if (drag) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      drag.moved ||= Math.hypot(dx, dy) > 4; x = drag.x + dx; y = drag.y + dy; tip.hidden = true; redraw(); return;
    }
    const [sx, sy] = point(e), { node, cluster } = hit(sx, sy);
    tip.hidden = !node && !cluster;
    tip.textContent = node ? node.name : cluster ? `${cluster.name} · ${cluster.members.length}` : '';
    tip.style.transform = `translate(${sx + 14}px, ${sy + 12}px)`;
    canvas.style.cursor = node || cluster ? 'pointer' : 'grab';
  };
  canvas.onpointerleave = () => { tip.hidden = true; };
  canvas.onpointerup = e => {
    if (!e.isPrimary || !drag || drag.moved) { drag = null; return; }
    drag = null;
    const { node, cluster } = hit(...point(e));
    if (node) onPick(node.id); else if (cluster) onCluster?.(cluster.name);
  };
  const resize = new ResizeObserver(() => { fitted = false; draw(); });
  resize.observe(stage);
  readTheme();

  return {
    show(nextNodes, links) {
      nodes = [...nextNodes];
      ({ clusters, at } = packClusters(nodes));
      linksOf = new Map();
      const between = new Map();
      for (const l of links) {
        for (const [a, b] of [[l.source, l.target], [l.target, l.source]]) (linksOf.get(a) ?? linksOf.set(a, []).get(a)).push(b);
        const a = at.get(l.source)?.cluster, b = at.get(l.target)?.cluster;
        if (!a || !b || a === b) continue;
        const key = a.name < b.name ? `${a.name}\n${b.name}` : `${b.name}\n${a.name}`;
        const entry = between.get(key) ?? between.set(key, { a, b, count: 0 }).get(key);
        entry.count++;
      }
      const most = Math.max(1, ...[...between.values()].map(e => e.count));
      bundles = [...between.values()].sort((a, b) => b.count - a.count).slice(0, 60).map(e => ({ ...e, strength: e.count / most }));
      tint(); fitted = false; draw();
    },
    mark(next) {
      mark = next; readTheme(); tint(); redraw();
    },
    focus(id) { const p = at.get(id); if (!p) return; k = Math.max(k, 2.2); x = -p.x * k; y = -p.y * k; redraw(); },
    zoom(factor) { zoomAt(factor, stage.clientWidth / 2, stage.clientHeight / 2); },
    spin() { let t = 0; return () => { t += 0.05; x += Math.cos(t) * 4; y += Math.sin(t) * 4; draw(); }; },
    destroy() { cancelAnimationFrame(queued); resize.disconnect(); stage.replaceChildren(); },
  };
}
