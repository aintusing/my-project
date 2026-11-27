// Candlestick view with explanations of unusual days. All facts are computed from the data.
import { el } from './panel.js';

const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const deviation = list => { const m = mean(list); return Math.sqrt(mean(list.map(v => (v - m) ** 2))); };
const pct = v => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
const compact = new Intl.NumberFormat('ru', { notation: 'compact', maximumFractionDigits: 1 });
const price = v => (v >= 1000 ? compact.format(v) : Number(v.toPrecision(4)).toString());

// Daily return, how unusual it is against the previous 30 days, and volume against its own average.
export function analyze(candles) {
  return candles.map((c, i) => {
    const before = candles.slice(Math.max(0, i - 30), i);
    const change = i ? c[4] / candles[i - 1][4] - 1 : 0;
    if (before.length < 15) return { i, date: c[0], change, z: 0, volume: 1, marked: false, high30: false, low30: false };
    const returns = before.slice(1).map((d, k) => d[4] / before[k][4] - 1);
    const sigma = deviation(returns), average = mean(before.map(d => d[5]));
    const z = sigma ? change / sigma : 0, volume = average ? c[5] / average : 1;
    return {
      i, date: c[0], change, z, volume, marked: Math.abs(z) >= 2.5 || volume >= 3,
      high30: c[4] > Math.max(...before.map(d => d[4])), low30: c[4] < Math.min(...before.map(d => d[4])),
    };
  });
}

// Facts about one day. `context` holds the market reference (BTC), dated hacks and headlines.
export function explainDay(series, days, index, context) {
  const day = days[index], c = series.candles[index], facts = [];
  if (Math.abs(day.z) >= 1.5) facts.push(`Цена ${pct(day.change)}: это в ${Math.abs(day.z).toFixed(1)} раза сильнее обычного дневного колебания за прошлые 30 дней.`);
  else facts.push(`Цена ${pct(day.change)}: в пределах обычного колебания.`);
  if (day.volume >= 1.8) facts.push(`Объём торгов в ${day.volume.toFixed(1)} раза выше среднего: в сделках участвовало необычно много денег.`);
  else if (day.volume <= 0.5) facts.push('Объём вдвое ниже среднего: движение подтверждено слабо.');
  const range = (c[2] - c[3]) / c[1], body = Math.abs(c[4] - c[1]) / c[1];
  if (range > 0.08 && body < range * 0.3) facts.push(`Внутри дня цена ходила на ${(range * 100).toFixed(0)}% и почти вернулась: покупатели и продавцы боролись.`);
  if (day.high30) facts.push('Закрытие выше всех за прошлые 30 дней.');
  if (day.low30) facts.push('Закрытие ниже всех за прошлые 30 дней.');
  const market = context.market?.get(day.date);
  if (market && series.symbol !== 'BTC' && Math.abs(day.change) > 0.02) {
    if (Math.sign(market.change) === Math.sign(day.change) && Math.abs(market.z) >= 1.5) facts.push(`Весь рынок двигался так же: BTC ${pct(market.change)}.`);
    else if (Math.abs(day.change) > Math.abs(market.change) * 3) facts.push(`Движение отдельно от рынка: BTC в этот день ${pct(market.change)}.`);
  }
  const near = date => Math.abs(Date.parse(date) - Date.parse(day.date)) <= 2 * 864e5;
  for (const hack of context.hacks.filter(h => near(h.date))) facts.push(`Рядом по дате взлом: ${hack.name}, ${hack.date}${hack.usd ? `, $${compact.format(hack.usd)}` : ''}.`);
  for (const item of context.headlines.filter(h => h.date === day.date).slice(0, 4)) facts.push(`Заголовок дня (${item.source}): ${item.title}`);
  return facts;
}

export function seriesContext(series, candles, nodes, news) {
  const btc = candles.series.find(s => s.symbol === 'BTC');
  const market = btc ? new Map(analyze(btc.candles).map(d => [d.date, d])) : null;
  const name = series.name.toLocaleLowerCase();
  const hacks = nodes.filter(n => n.meta?.hack && n.name.toLocaleLowerCase().split(' ')[0] === name.split(' ')[0])
    .map(n => ({ ...n.meta.hack, name: n.name }));
  const escaped = series.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Whole words only: short tickers are matched with a dollar sign to avoid false hits.
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped}|\\$${series.symbol})(?![\\p{L}\\p{N}])`, 'iu');
  const headlines = (news?.headlines ?? []).filter(h => pattern.test(h.title))
    .map(h => ({ date: h.t.slice(0, 10), title: h.title, source: news.sources[h.s]?.name ?? '' }));
  return { market, hacks, headlines };
}

export function viewChart(stage, { candles, nodes, news, onChange }) {
  let series = candles.series[0], days = [], context = null, span = 120, end = 0, picked = null, hover = null, drag = null;
  const names = el('select', { ariaLabel: 'Актив' }, ...candles.series.map(s => new Option(`${s.symbol} · ${s.name}`, s.symbol)));
  const ranges = el('div', { className: 'rg-ranges', role: 'group', ariaLabel: 'Период' },
    ...[['1 мес', 30], ['3 мес', 90], ['6 мес', 180], ['1 год', 365]].map(([label, n]) =>
      el('button', { type: 'button', textContent: label, onclick: () => { span = n; end = series.candles.length; draw(); } })));
  const canvas = el('canvas', { tabIndex: 0, ariaLabel: 'Свечной график. Стрелки выбирают день.' });
  const readout = el('p', { className: 'rg-ohlc' });
  stage.replaceChildren(el('div', { className: 'rg-chart' }, el('div', { className: 'rg-chart-bar' }, names, ranges, readout), el('div', { className: 'rg-chart-area' }, canvas)));
  const area = canvas.parentElement, ctx = canvas.getContext('2d');
  let geometry = null;

  function load(symbol) {
    series = candles.series.find(s => s.symbol === symbol) ?? candles.series[0];
    names.value = series.symbol; days = analyze(series.candles); context = seriesContext(series, candles, nodes, news);
    end = series.candles.length;
    const marked = days.filter(d => d.marked);
    picked = (marked.at(-1) ?? days.at(-1)).i;
    report(); draw();
  }
  function report() {
    onChange({
      series, picked, day: days[picked], facts: explainDay(series, days, picked, context),
      notable: days.filter(d => d.marked).reverse(), pick: select,
    });
  }
  function select(i) {
    picked = Math.max(0, Math.min(series.candles.length - 1, i));
    if (picked >= end || picked < end - span) end = Math.min(series.candles.length, picked + Math.ceil(span / 2));
    report(); draw();
  }

  function draw() {
    const w = area.clientWidth, h = area.clientHeight, ratio = Math.min(2, devicePixelRatio || 1);
    if (!w || !h) return;
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const css = getComputedStyle(stage), color = key => css.getPropertyValue(key).trim();
    ctx.fillStyle = color('--bg'); ctx.fillRect(0, 0, w, h);
    const count = Math.min(span, series.candles.length);
    end = Math.max(count, Math.min(series.candles.length, end));
    const from = end - count, view = series.candles.slice(from, end);
    const right = 62, bottom = 20, volumeH = Math.max(40, h * 0.18), priceH = h - volumeH - bottom - 18;
    const high = Math.max(...view.map(c => c[2])), low = Math.min(...view.map(c => c[3])), pad = (high - low) * 0.06 || high * 0.02;
    const y = v => 14 + (high + pad - v) / (high - low + pad * 2) * (priceH - 14);
    const step = (w - right) / count, x = i => (i - from) * step + step / 2, most = Math.max(...view.map(c => c[5])) || 1;
    ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = low + (high - low) * k / 4;
      ctx.strokeStyle = color('--edge'); ctx.beginPath(); ctx.moveTo(0, y(v)); ctx.lineTo(w - right, y(v)); ctx.stroke();
      ctx.fillStyle = color('--dim'); ctx.fillText(price(v), w - right + 6, y(v) + 4);
    }
    ctx.textAlign = 'center';
    for (let i = from; i < end; i += Math.max(1, Math.round(count / Math.max(2, Math.floor((w - right) / 90))))) {
      ctx.fillStyle = color('--dim'); ctx.fillText(series.candles[i][0].slice(5).split('-').reverse().join('.'), x(i), h - 6);
    }
    const body = Math.max(1, step * 0.66);
    view.forEach((c, k) => {
      const i = from + k, up = c[4] >= c[1];
      ctx.strokeStyle = ctx.fillStyle = color(up ? '--good' : '--bad');
      ctx.beginPath(); ctx.moveTo(x(i), y(c[2])); ctx.lineTo(x(i), y(c[3])); ctx.stroke();
      ctx.fillRect(x(i) - body / 2, y(Math.max(c[1], c[4])), body, Math.max(1, Math.abs(y(c[1]) - y(c[4]))));
      ctx.globalAlpha = 0.45; const vh = c[5] / most * volumeH; ctx.fillRect(x(i) - body / 2, h - bottom - vh, body, vh); ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = color('--accent'); ctx.lineWidth = 1.5; ctx.beginPath();
    let pen = false;
    for (let i = Math.max(from, 19); i < end; i++) {
      const average = mean(series.candles.slice(i - 19, i + 1).map(c => c[4]));
      ctx[pen ? 'lineTo' : 'moveTo'](x(i), y(Math.min(high + pad, Math.max(low - pad, average)))); pen = true;
    }
    ctx.stroke();
    for (const i of [picked, hover]) {
      if (i === null || i < from || i >= end) continue;
      ctx.strokeStyle = color(i === picked ? '--text' : '--dim'); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(x(i), 0); ctx.lineTo(x(i), h - bottom); ctx.stroke(); ctx.setLineDash([]);
    }
    // Markers for unusual days; large ones carry a short label inside the chart.
    const labelled = [];
    for (const day of days.slice(from, end).filter(d => d.marked)) {
      const c = series.candles[day.i], mx = x(day.i), my = Math.max(9, y(c[2]) - 9);
      ctx.fillStyle = color('--accent'); ctx.beginPath(); ctx.arc(mx, my, day.i === picked ? 6 : 4, 0, Math.PI * 2); ctx.fill();
      if (Math.abs(day.z) >= 3 && !labelled.some(p => Math.abs(p - mx) < 64)) {
        labelled.push(mx); ctx.fillStyle = color('--text'); ctx.textAlign = 'center';
        ctx.fillText(pct(day.change), mx, Math.max(10, my - 9));
      }
    }
    const shown = series.candles[hover ?? picked];
    readout.textContent = `${shown[0]}  О ${price(shown[1])}  В ${price(shown[2])}  Н ${price(shown[3])}  З ${price(shown[4])}  Объём ${compact.format(shown[5])} ${series.quote}`;
    geometry = { from, step, right, w };
  }

  const indexAt = e => {
    const px = e.clientX - canvas.getBoundingClientRect().left;
    return Math.max(geometry.from, Math.min(end - 1, geometry.from + Math.floor(px / geometry.step)));
  };
  names.onchange = () => load(names.value);
  canvas.onpointerdown = e => { drag = { x: e.clientX, end, moved: false }; canvas.setPointerCapture(e.pointerId); };
  canvas.onpointermove = e => {
    if (drag) {
      const shift = Math.round((drag.x - e.clientX) / geometry.step);
      drag.moved ||= shift !== 0; end = drag.end + shift; draw(); return;
    }
    const next = indexAt(e);
    if (next !== hover) { hover = next; draw(); }
  };
  canvas.onpointerleave = () => { hover = null; draw(); };
  canvas.onpointercancel = () => { drag = null; };
  canvas.onpointerup = e => { const moved = drag?.moved; drag = null; if (!moved) select(indexAt(e)); };
  const zoom = factor => { span = Math.max(20, Math.min(series.candles.length, Math.round(span / factor))); draw(); };
  canvas.onwheel = e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); };
  canvas.onkeydown = e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); select(picked + (e.key === 'ArrowLeft' ? -1 : 1)); }
    else if (e.key === '+' || e.key === '=') zoom(1.2);
    else if (e.key === '-') zoom(1 / 1.2);
  };
  const resize = new ResizeObserver(draw);
  resize.observe(area);
  load(series.symbol);

  return {
    show() {}, mark() { draw(); }, zoom,
    focus(id) {
      const name = nodes.find(n => n.id === id)?.name;
      const found = candles.series.find(s => s.name === name);
      if (found && found !== series) load(found.symbol);
    },
    spin() { return draw; },
    destroy() { resize.disconnect(); stage.replaceChildren(); },
  };
}

export function chartPanel(state) {
  if (!state) return [el('p', { textContent: 'Нет данных графика.' })];
  const { series, day, facts, notable, pick } = state;
  return [
    el('h2', { textContent: `${series.symbol} · ${series.name}`, tabIndex: -1 }),
    el('section', {}, el('h3', { textContent: `Что произошло ${day.date}` }),
      el('ul', { className: 'rg-facts' }, ...facts.map(text => el('li', { textContent: text })))),
    el('section', {}, el('h3', { textContent: `Необычные дни: ${notable.length}` }),
      el('ul', {}, ...notable.slice(0, 20).map(d => el('li', {}, el('button', { type: 'button', onclick: () => pick(d.i) },
        el('span', { textContent: d.date }), el('small', { textContent: `${pct(d.change)} · объём ×${d.volume.toFixed(1)}` })))))),
    el('p', { className: 'rg-note', textContent: 'Факты посчитаны по свечам, взломам и заголовкам снимка. Совпадение по дате не доказывает причину. Это не совет покупать или продавать.' }),
  ];
}
