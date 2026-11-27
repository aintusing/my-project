// Earth view: orthographic globe on a 2D canvas. Assets with a known country sit on the map,
// assets without one fly on an orbit ring. Works without WebGL.
const RAD = Math.PI / 180;
const GOLDEN = 2.39996323;

export function project(lon, lat, lon0, lat0) {
  const l = (lon - lon0) * RAD, f = lat * RAD, f0 = lat0 * RAD;
  return [
    Math.cos(f) * Math.sin(l),
    Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l),
    Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l),
  ];
}

export function unproject(x, y, lon0, lat0) {
  if (x * x + y * y > 1) return null;
  const z = Math.sqrt(1 - x * x - y * y), f0 = lat0 * RAD;
  const lat = Math.asin(z * Math.sin(f0) + y * Math.cos(f0)) / RAD;
  const lon = lon0 + Math.atan2(x, z * Math.cos(f0) - y * Math.sin(f0)) / RAD;
  return [((lon + 540) % 360) - 180, lat];
}

export function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Positions inside a country are a spiral around its label point: country-level accuracy only.
export function place(nodes, countries) {
  const used = new Map(), ground = [], orbit = [];
  for (const node of [...nodes].sort((a, b) => b.size - a.size)) {
    if (node.group === 'sphere' || node.group === 'chain') continue;
    const at = countries[node.country]?.at;
    if (!at) { orbit.push(node); continue; }
    const i = used.get(node.country) ?? 0;
    used.set(node.country, i + 1);
    const r = Math.min(17, 0.24 * Math.sqrt(i)), turn = i * GOLDEN;
    ground.push({ node, lon: at[0] + Math.cos(turn) * r / Math.max(0.3, Math.cos(at[1] * RAD)), lat: at[1] + Math.sin(turn) * r * 0.7 });
  }
  return { ground, orbit: orbit.map((node, i) => ({ node, angle: i * GOLDEN, band: 1.2 + ((i * 7919) % 997) / 997 * 0.32 })), counts: used };
}

// Sums cells into a coarser grid; the busiest cell of a block lends it its position.
export function coarsen(cells, step) {
  const blocks = new Map();
  for (const cell of cells) {
    const key = `${Math.floor(cell.lon / step)}|${Math.floor(cell.lat / step)}|${cell.dataset.id}`;
    const block = blocks.get(key);
    if (!block) blocks.set(key, { ...cell, peak: cell.count });
    else {
      block.count += cell.count;
      if (cell.count > block.peak) Object.assign(block, { lon: cell.lon, lat: cell.lat, peak: cell.count });
    }
  }
  return [...blocks.values()];
}

// Trigonometry, radius and opacity level are computed once per cell, not per frame.
function shade(cells) {
  const busiest = Math.log1p(cells.reduce((max, c) => Math.max(max, c.count), 1));
  return cells.map(c => {
    const t = Math.log1p(c.count) / busiest;
    return { ...c, sin: Math.sin(c.lat * RAD), cos: Math.cos(c.lat * RAD), radius: 0.5 + t * t * t * 6.5, level: t < 0.45 ? 0 : t < 0.7 ? 1 : 2 };
  });
}

export function viewEarth(stage, { world, flat = false, onPick, onCountry, onGeo, onCell, onRotate }) {
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${flat ? 'Карта' : 'Глобус'}. Стрелки двигают, плюс и минус меняют масштаб. Объекты и страны выбираются поиском и списками.`);
  const tip = Object.assign(document.createElement('div'), { className: 'rg-tip', hidden: true });
  stage.replaceChildren(canvas, tip);
  const ctx = canvas.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let layout = place([], world.countries), mark = { selected: null, near: new Set(), colorOf: () => '#fff', country: null };
  let lon0 = 10, lat0 = 24, zoom = 1, phase = 0, spinning = !calm && !flat, target = null, drag = null, hover = null;
  let shows = { orbit: true, labels: true, alerts: true }, S = 1, geoLayers = [], geoHits = [];
  let eventCells = [], coarseCells = [], eventHits = [], skipped = 0;
  let hits = [], frame = 0, theme = {}, cx = 0, cy = 0, R = 1;

  const readTheme = () => {
    const css = getComputedStyle(stage);
    for (const key of ['space', 'ocean', 'deep', 'land', 'line', 'glow', 'ink']) theme[key] = css.getPropertyValue(`--earth-${key}`).trim();
  };
  const screen = (x, y) => [cx + x * R, cy - y * R];
  const wrap = lon => ((lon % 360) + 540) % 360 - 180;
  // Screen position of a coordinate in either projection; depth <= 0 means hidden.
  const to = (lon, lat) => {
    if (flat) return [cx + wrap(lon - lon0) * S, cy - (lat - lat0) * S, 1];
    const [x, y, z] = project(lon, lat, lon0, lat0);
    return [...screen(x, y), z];
  };

  function drawFlatLand() {
    const max = Math.max(1, ...layout.counts.values());
    for (const shape of world.shapes) {
      ctx.beginPath();
      for (const ring of shape.rings) {
        let previous = null;
        ring.forEach(([lon, lat]) => {
          const x = wrap(lon - lon0);
          // A jump across the map edge starts a new outline.
          ctx[previous === null || Math.abs(x - previous) > 180 ? 'moveTo' : 'lineTo'](cx + x * S, cy - (lat - lat0) * S);
          previous = x;
        });
      }
      fillCountry(shape, max);
    }
  }

  function fillCountry(shape, max) {
    ctx.fillStyle = theme.land; ctx.fill();
    const count = layout.counts.get(shape.code);
    if (count) { ctx.globalAlpha = 0.12 + 0.4 * Math.log1p(count) / Math.log1p(max); ctx.fillStyle = theme.glow; ctx.fill(); ctx.globalAlpha = 1; }
    const active = shape.code && (shape.code === mark.country || shape.code === hover);
    ctx.strokeStyle = active ? theme.glow : theme.line; ctx.lineWidth = active ? 2 : 0.6; ctx.stroke();
  }

  // Located assets that had a hack get a pulsing ring.
  function drawAlerts() {
    const wave = calm ? 0.5 : (performance.now() / 1600) % 1;
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - wave * 0.85;
    ctx.beginPath();
    for (const [x, y, node, r] of hits) if (node.meta?.hack && node.country) dot(x, y, r + 3 + wave * 12);
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  const dot = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); };
  // Thousands of tiny points are drawn as squares: much cheaper and looks the same.
  const speck = (x, y, r) => { if (r < 1.9) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); else dot(x, y, r); };

  function drawLand() {
    const max = Math.max(1, ...layout.counts.values());
    for (const shape of world.shapes) {
      ctx.beginPath();
      let seen = false;
      for (const ring of shape.rings) {
        const points = ring.map(([lon, lat]) => project(lon, lat, lon0, lat0));
        if (!points.some(p => p[2] > 0)) continue;
        seen = true;
        points.forEach(([x, y, z], i) => {
          // Hidden vertices are pushed to the limb so partly visible countries close cleanly.
          const k = z > 0 ? 1 : 1 / (Math.hypot(x, y) || 1);
          ctx[i ? 'lineTo' : 'moveTo'](...screen(x * k, y * k));
        });
        ctx.closePath();
      }
      if (!seen) continue;
      fillCountry(shape, max);
    }
  }

  // Event cells show density: size and opacity grow with the logarithm of the count,
  // relative to the busiest visible cell. Quiet places stay faint, so hot spots stand out.
  function drawEvents() {
    const groups = new Map(), f0 = lat0 * RAD, sin0 = Math.sin(f0), cos0 = Math.cos(f0), w = stage.clientWidth, h = stage.clientHeight;
    const scale = Math.sqrt(zoom) * Math.min(1.15, Math.max(0.55, Math.min(w, h) / 700));
    for (const cell of zoom < 2.2 ? coarseCells : eventCells) {
      let x, y, depth = 1;
      if (flat) { x = cx + wrap(cell.lon - lon0) * S; y = cy - (cell.lat - lat0) * S; }
      else {
        const l = (cell.lon - lon0) * RAD, cos = Math.cos(l);
        depth = sin0 * cell.sin + cos0 * cell.cos * cos;
        if (depth <= 0.03) continue;
        x = cx + cell.cos * Math.sin(l) * R; y = cy - (cos0 * cell.sin - sin0 * cell.cos * cos) * R;
      }
      if (x < -8 || y < -8 || x > w + 8 || y > h + 8) continue;
      const r = cell.radius * scale * (0.55 + depth * 0.45), key = `${cell.level}|${cell.dataset.color}`;
      (groups.get(key) ?? groups.set(key, []).get(key)).push(x, y, r);
      eventHits.push([x, y, cell, r]);
    }
    for (const [key, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const [level, color] = key.split('|');
      ctx.beginPath();
      for (let i = 0; i < list.length; i += 3) {
        // Tiny discs are drawn as squares: much cheaper and indistinguishable.
        if (list[i + 2] < 1.8) ctx.rect(list[i] - list[i + 2], list[i + 1] - list[i + 2], list[i + 2] * 2, list[i + 2] * 2);
        else dot(list[i], list[i + 1], list[i + 2]);
      }
      ctx.fillStyle = color; ctx.globalAlpha = [0.2, 0.42, 0.75][level]; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // World layers: lines under the assets, markers above them. Shape tells the group apart.
  function drawGeoLines() {
    for (const layer of geoLayers.filter(l => l.kind === 'lines')) {
      ctx.beginPath();
      for (const item of layer.items) {
        let previous = null;
        for (const [lon, lat] of item.path) {
          const [x, y, z] = to(lon, lat);
          const visible = z > 0;
          // Lift the pen behind the globe and when a flat line wraps around the map edge.
          if (visible) {
            ctx[previous === null || Math.abs(x - previous) > 180 * S ? 'moveTo' : 'lineTo'](x, y);
            geoHits.push([x, y, item, layer]);
          }
          previous = visible ? x : null;
        }
      }
      ctx.strokeStyle = layer.color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawGeoPoints() {
    const size = 3.2 * Math.min(1.8, Math.sqrt(zoom));
    for (const layer of geoLayers.filter(l => l.kind === 'points')) {
      ctx.beginPath();
      for (const item of layer.items) {
        const [x, y, z] = to(item.lon, item.lat);
        if (z <= 0.05) continue;
        if (layer.group === 'finance') { ctx.moveTo(x, y - size * 1.4); ctx.lineTo(x + size * 1.4, y); ctx.lineTo(x, y + size * 1.4); ctx.lineTo(x - size * 1.4, y); ctx.closePath(); }
        else if (layer.group === 'security') { ctx.moveTo(x, y - size * 1.3); ctx.lineTo(x + size * 1.2, y + size); ctx.lineTo(x - size * 1.2, y + size); ctx.closePath(); }
        else ctx.rect(x - size, y - size, size * 2, size * 2);
        geoHits.push([x, y, item, layer]);
      }
      ctx.fillStyle = layer.color; ctx.fill(); ctx.strokeStyle = theme.deep; ctx.lineWidth = 1; ctx.stroke();
    }
    const chosen = mark.geo && geoHits.find(h => h[2] === mark.geo);
    if (!chosen) return;
    const [x, y, item] = chosen;
    ctx.beginPath(); dot(x, y, size + 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.lineWidth = 4; ctx.strokeStyle = theme.deep; ctx.strokeText(item.name, x + 14, y + 4);
    ctx.fillStyle = theme.ink; ctx.fillText(item.name, x + 14, y + 4);
  }

  function drawOrbit(front) {
    const tilt = 24 * RAD, groups = new Map();
    for (const item of layout.orbit) {
      const a = item.angle + phase + lon0 * RAD * 0.4;
      const x = Math.cos(a) * item.band, d = Math.sin(a) * item.band;
      const y = -d * Math.sin(tilt) - lat0 * 0.001 * d, z = d * Math.cos(tilt);
      if ((z >= 0) !== front || (!front && Math.hypot(x, y) < 1)) continue;
      const [sx, sy] = screen(x, y), r = Math.max(0.7, Math.sqrt(item.node.size) * 0.62 * Math.sqrt(zoom)) * (front ? 1 : 0.75);
      const color = mark.near.has(item.node.id) ? '#fff' : mark.colorOf(item.node);
      (groups.get(color) ?? groups.set(color, []).get(color)).push([sx, sy, r]);
      hits.push([sx, sy, item.node, r]);
    }
    ctx.globalAlpha = front ? 0.92 : 0.38;
    for (const [color, list] of groups) { ctx.beginPath(); list.forEach(p => speck(...p)); ctx.fillStyle = color; ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const groups = new Map(), big = [];
    for (const { node, lon, lat } of layout.ground) {
      const [sx, sy, z] = to(lon, lat);
      if (z <= 0.02) continue;
      const r = Math.max(0.7, Math.sqrt(node.size) * 0.68 * Math.sqrt(zoom)) * (0.5 + z / 2);
      const color = mark.near.has(node.id) ? '#fff' : mark.colorOf(node);
      (groups.get(color) ?? groups.set(color, []).get(color)).push([sx, sy, r]);
      if (node.meta?.score >= 70) big.push([sx, sy, r, color]);
      hits.push([sx, sy, node, r]);
    }
    ctx.globalAlpha = 0.12;
    for (const [x, y, r, color] of big) { ctx.beginPath(); dot(x, y, r * 2.6); ctx.fillStyle = color; ctx.fill(); }
    ctx.globalAlpha = 0.95;
    for (const [color, list] of groups) { ctx.beginPath(); list.forEach(p => speck(...p)); ctx.fillStyle = color; ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center';
    const taken = [];
    for (const [code, count] of [...layout.counts].sort((a, b) => b[1] - a[1])) {
      const country = world.countries[code], [sx, sy, z] = to(...country.at);
      if (z < 0.35 || taken.length >= 14) continue;
      if (taken.some(([tx, ty]) => Math.abs(tx - sx) < 90 && Math.abs(ty - sy) < 22)) continue;
      taken.push([sx, sy]);
      const text = `${country.name} · ${count}`;
      ctx.lineWidth = 4; ctx.strokeStyle = theme.deep; ctx.strokeText(text, sx, sy - 12);
      ctx.fillStyle = theme.ink; ctx.fillText(text, sx, sy - 12);
    }
  }

  function drawSelection() {
    const chosen = hits.find(h => h[2].id === mark.selected);
    if (!chosen) return;
    const [x, y, node, r] = chosen;
    for (const other of hits.filter(h => mark.near.has(h[2].id)).slice(0, 60)) {
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + other[0]) / 2 + (other[1] - y) * 0.2, (y + other[1]) / 2 - (other[0] - x) * 0.2, other[0], other[1]);
      ctx.strokeStyle = theme.glow; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
    }
    const pulse = calm ? 4 : 4 + 3 * Math.sin(performance.now() / 220);
    ctx.beginPath(); dot(x, y, r + pulse); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.lineWidth = 4; ctx.strokeStyle = theme.deep; ctx.strokeText(node.name, x + 14, y + 4);
    ctx.fillStyle = theme.ink; ctx.fillText(node.name, x + 14, y + 4);
  }

  function draw() {
    const w = stage.clientWidth, h = stage.clientHeight, ratio = Math.min(1.5, devicePixelRatio || 1);
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cx = w / 2; cy = h / 2; R = Math.min(w, h) * 0.32 * zoom; S = Math.max(w / 360, h / 175) * zoom; hits = []; geoHits = []; eventHits = [];
    ctx.fillStyle = flat ? theme.deep : theme.space; ctx.fillRect(0, 0, w, h);
    if (flat) {
      ctx.beginPath();
      for (let line = -180; line < 180; line += 30) { const x = cx + wrap(line - lon0) * S; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (let line = -60; line <= 60; line += 30) { const y = cy - (line - lat0) * S; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.strokeStyle = theme.line; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      drawFlatLand(); drawEvents(); drawGeoLines(); drawGround(); finish();
      return;
    }
    ctx.fillStyle = theme.ink;
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.12 + (i % 7) / 14;
      ctx.fillRect((i * 7919) % 1009 / 1009 * w, (i * 3571) % 997 / 997 * h, i % 11 ? 1 : 2, i % 11 ? 1 : 2);
    }
    ctx.globalAlpha = 1;
    if (shows.orbit) drawOrbit(false);
    const halo = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.22);
    halo.addColorStop(0, theme.glow); halo.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.14; ctx.fillStyle = halo; ctx.beginPath(); dot(cx, cy, R * 1.22); ctx.fill(); ctx.globalAlpha = 1;
    const sea = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, R * 0.1, cx, cy, R);
    sea.addColorStop(0, theme.ocean); sea.addColorStop(1, theme.deep);
    ctx.fillStyle = sea; ctx.beginPath(); dot(cx, cy, R); ctx.fill();
    ctx.save(); ctx.beginPath(); dot(cx, cy, R); ctx.clip();
    ctx.beginPath();
    for (let line = -150; line <= 180; line += 30) {
      for (const meridian of [true, false]) {
        if (!meridian && Math.abs(line) > 60) continue;
        let pen = false;
        for (let t = meridian ? -90 : -180; t <= (meridian ? 90 : 180); t += 5) {
          const [x, y, z] = project(meridian ? line : t, meridian ? t : line, lon0, lat0);
          if (z > 0) ctx[pen ? 'lineTo' : 'moveTo'](...screen(x, y));
          pen = z > 0;
        }
      }
    }
    ctx.strokeStyle = theme.line; ctx.globalAlpha = 0.35; ctx.lineWidth = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
    drawLand();
    const shade = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.4, cx, cy, R * 1.02);
    shade.addColorStop(0, 'transparent'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = shade; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    drawEvents();
    drawGeoLines();
    drawGround();
    if (shows.orbit) drawOrbit(true);
    finish();
  }

  function finish() {
    drawGeoPoints();
    if (shows.alerts) drawAlerts();
    if (shows.labels) drawLabels();
    drawSelection();
  }

  // One animation loop; it idles when nothing moves.
  function tick() {
    if (target) {
      const turn = ((target.lon - lon0 + 540) % 360) - 180;
      lon0 += turn * 0.12; lat0 += (target.lat - lat0) * 0.12; zoom += (target.zoom - zoom) * 0.12;
      if (Math.abs(turn) < 0.2 && Math.abs(target.lat - lat0) < 0.2) target = null;
    } else if (spinning) { lon0 += 0.05; phase += 0.0006; }
    // When only markers pulse, a third of the frames is enough.
    if (target || spinning || (skipped = (skipped + 1) % 3) === 0) draw();
    const pulsing = !calm && (mark.selected || (shows.alerts && layout.ground.some(i => i.node.meta?.hack)));
    frame = target || spinning || pulsing ? requestAnimationFrame(tick) : 0;
  }
  const wake = () => { if (!frame) frame = requestAnimationFrame(tick); };
  const redraw = () => { draw(); wake(); };
  const rotate = on => { spinning = on && !flat; onRotate(spinning); wake(); };
  const zoomBy = factor => { zoom = Math.min(7, Math.max(0.6, zoom * factor)); target = null; redraw(); };
  const flyTo = (lon, lat, level) => {
    rotate(false);
    target = { lon, lat: Math.max(-70, Math.min(70, lat)), zoom: level };
    if (calm) { lon0 = target.lon; lat0 = target.lat; zoom = target.zoom; target = null; }
    redraw();
  };

  const at = event => { const box = canvas.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
  const nodeAt = (x, y) => {
    let best = null, limit = 9;
    for (const [hx, hy, node, r] of hits) { const d = Math.hypot(hx - x, hy - y) - r / 2; if (d < limit) { best = node; limit = d; } }
    return best;
  };
  const geoAt = (x, y) => {
    let best = null, limit = 8;
    for (const [hx, hy, item, layer] of geoHits) { const d = Math.hypot(hx - x, hy - y); if (d < limit) { best = { item, layer }; limit = d; } }
    return best;
  };
  const cellAt = (x, y) => {
    let best = null, weight = 0;
    for (const [hx, hy, cell, r] of eventHits) if (Math.hypot(hx - x, hy - y) <= Math.max(4, r) && cell.count > weight) { best = cell; weight = cell.count; }
    return best;
  };
  const countryAt = (x, y) => {
    const point = flat ? [wrap((x - cx) / S + lon0), (cy - y) / S + lat0] : unproject((x - cx) / R, (cy - y) / R, lon0, lat0);
    return point && world.shapes.find(s => s.code && s.rings.some(ring => inRing(point, ring)))?.code;
  };
  canvas.onwheel = e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15); };
  canvas.onkeydown = e => {
    const move = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (move) { e.preventDefault(); rotate(false); target = null; lon0 += move[0]; lat0 = Math.max(-80, Math.min(80, lat0 + move[1])); redraw(); }
    else if (e.key === '+' || e.key === '=') zoomBy(1.2);
    else if (e.key === '-') zoomBy(1 / 1.2);
  };
  canvas.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    rotate(false); target = null; drag = { x: e.clientX, y: e.clientY, lon0, lat0, moved: false }; canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
  canvas.onpointermove = e => {
    if (!e.isPrimary) return;
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved ||= Math.hypot(dx, dy) > 4;
      const step = flat ? 1 / S : 57 / R;
      lon0 = drag.lon0 - dx * step; lat0 = Math.max(-80, Math.min(80, drag.lat0 + dy * step));
      tip.hidden = true; redraw(); return;
    }
    const [x, y] = at(e), geo = geoAt(x, y), node = geo ? null : nodeAt(x, y), cell = geo || node ? null : cellAt(x, y);
    const code = geo || node || cell ? null : countryAt(x, y);
    hover = code ?? null;
    tip.hidden = !geo && !node && !cell && !code;
    tip.textContent = geo ? `${geo.item.name} · ${geo.layer.label}` : node ? node.name
      : cell ? `${cell.dataset.label}: ${cell.count.toLocaleString('ru')}`
        : code ? `${world.countries[code]?.name ?? code} · ${layout.counts.get(code) ?? 0}` : '';
    tip.style.transform = `translate(${x + 14}px, ${y + 12}px)`;
    canvas.style.cursor = geo || node || cell || code ? 'pointer' : 'grab';
    redraw();
  };
  canvas.onpointerleave = () => { tip.hidden = true; hover = null; redraw(); };
  canvas.onpointerup = e => {
    if (!e.isPrimary || !drag || drag.moved) { drag = null; return; }
    drag = null;
    const [x, y] = at(e), geo = geoAt(x, y), node = geo ? null : nodeAt(x, y), cell = geo || node ? null : cellAt(x, y);
    const code = geo || node || cell ? null : countryAt(x, y);
    if (geo) onGeo?.(geo.item, geo.layer); else if (node) onPick(node.id); else if (cell) onCell?.(cell); else if (code) onCountry(code);
  };
  const resize = new ResizeObserver(redraw);
  resize.observe(stage);
  readTheme();
  onRotate(spinning);

  return {
    show(nodes) { layout = place(nodes, world.countries); redraw(); },
    mark(next) { mark = next; readTheme(); redraw(); },
    focus(id) { const item = layout.ground.find(i => i.node.id === id); if (item) flyTo(item.lon, item.lat, Math.max(zoom, flat ? 2.5 : 1.5)); else { rotate(false); redraw(); } },
    focusCountry(code) { const country = world.countries[code]; if (country) flyTo(...country.at, Math.max(zoom, flat ? 2.5 : 1.7)); },
    toggleRotation() { target = null; rotate(!spinning); },
    layers(next) { shows = { ...next }; redraw(); },
    geo(next) { geoLayers = next; redraw(); },
    events(next) {
      eventCells = shade(next);
      coarseCells = shade(coarsen(next, 3));
      redraw();
    },
    focusGeo({ lon, lat }) { flyTo(lon, lat, Math.max(zoom, flat ? 2.8 : 1.8)); },
    flyTo,
    zoom: zoomBy,
    spin() { rotate(false); return () => { lon0 += 0.6; phase += 0.004; draw(); }; },
    destroy() { cancelAnimationFrame(frame); frame = -1; resize.disconnect(); stage.replaceChildren(); },
  };
}
