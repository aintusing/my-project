// Demo page and FPS benchmark. URL: ?nodes=5000&mode=2d&links=all
import { syntheticGraph } from './fixture.js';
import { createRadarGraph } from './radar-graph.js';

const params = new URLSearchParams(location.search);
const count = Math.min(20000, Math.max(50, Number(params.get('nodes')) || 5000));
const radar = createRadarGraph(document.getElementById('graph'), syntheticGraph(count), {
  force2d: params.get('mode') === '2d',
  simplifyAbove: params.get('links') === 'all' ? Infinity : 2000,
});
window.radar = radar;

// Counts animation frames while the camera moves. Capped by the display refresh rate.
export function benchmark(seconds = 10) {
  return new Promise(resolve => {
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
        mode: radar.mode, ...radar.counts(), links_drawn: params.get('links') === 'all' ? 'all' : 'selection only above 2000 nodes',
        seconds: (now - start) / 1000, frames: frames.length,
        average_fps: +(frames.length / ((now - start) / 1000)).toFixed(1),
        p95_frame_ms: +frames[Math.floor(frames.length * 0.95)]?.toFixed(1),
        viewport: `${innerWidth}x${innerHeight}`, pixel_ratio: devicePixelRatio,
        hidden: document.hidden, browser: navigator.userAgent,
      });
    });
  });
}
window.benchmark = benchmark;

document.getElementById('bench').onclick = async event => {
  event.target.disabled = true;
  const result = document.getElementById('result');
  result.textContent = 'Измеряю…';
  const r = await benchmark();
  result.textContent = `${r.average_fps} FPS · p95 кадра ${r.p95_frame_ms} мс · узлов ${r.nodes}`;
  event.target.disabled = false;
};
