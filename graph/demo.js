// Demo page. URL: ?mode=earth|3d|2d, ?data=synthetic&nodes=5000, ?links=all
import { mergeEvents } from './activity.js';
import { syntheticGraph } from './fixture.js';
import { createRadarGraph } from './radar-graph.js';
import snapshot from './fixtures/snapshot.js';
import world from './fixtures/world.js';

const params = new URLSearchParams(location.search);
const synthetic = params.get('data') === 'synthetic';
const count = Math.min(20000, Math.max(50, Number(params.get('nodes')) || 5000));
const data = synthetic ? syntheticGraph(count) : snapshot;
// Optional world layers derived from worldmonitor.
const geo = synthetic ? null : await import('./fixtures/layers.js').then(m => m.default, () => null);
// Every event file is optional; the ones present are joined.
const load = path => import(path).then(m => m.default, () => null);
const events = synthetic ? null : mergeEvents(await Promise.all(['./fixtures/events.js', './fixtures/events-extra.js'].map(load)));
const news = synthetic ? null : await load('./fixtures/sources.js');
const analysis = synthetic ? null : await import('./analytics.js').then(m => m.analyticsSection, () => null);
const radar = createRadarGraph(document.getElementById('graph'), data, {
  analytics: analysis,
  news,
  geo,
  events,
  world: synthetic ? null : world,
  date: synthetic ? null : snapshot.date,
  force2d: params.get('mode') === '2d',
  view: params.get('mode') ?? undefined,
  simplifyAbove: params.get('links') === 'all' ? Infinity : 2000,
});
window.radar = radar;

// Counts animation frames while the camera moves. Capped by the display refresh rate.
window.benchmark = (seconds = 10) => new Promise(resolve => {
  const step = radar.spin(), frames = [];
  let start, last;
  requestAnimationFrame(function tick(now) {
    start ??= now;
    if (last !== undefined) frames.push(now - last);
    last = now;
    step();
    if (now - start < seconds * 1000) return requestAnimationFrame(tick);
    frames.sort((a, b) => a - b);
    resolve({
      mode: radar.mode, ...radar.counts(), data: synthetic ? 'synthetic' : 'snapshot',
      seconds: (now - start) / 1000, frames: frames.length,
      average_fps: +(frames.length / ((now - start) / 1000)).toFixed(1),
      p95_frame_ms: +frames[Math.floor(frames.length * 0.95)]?.toFixed(1),
      viewport: `${innerWidth}x${innerHeight}`, pixel_ratio: devicePixelRatio,
      hidden: document.hidden, browser: navigator.userAgent,
    });
  });
});
