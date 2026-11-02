// Renders one preview film to an MP4 on this machine: node render.mjs <film-dir> <out.mp4> [--fps 60] [--stills 0,1.5,3]
//
// <film-dir> is a film's `modules` collection saved with ArtifactData `list` and `out_dir`, so it holds
// modules/scenes.json.json, modules/base.css.json and modules/scene-<id>.js.json. The scene code runs in headless
// Chromium against a stand-in for the Motion kit (only what the scenes use: scene, h, stage, seg, lerp, eo, ei, eio,
// breathe), one screenshot per frame, piped to ffmpeg (libx264). Fonts load from Google Fonts. The picture matches the
// film page closely but not pixel for pixel (the easing curves are the standard cubic ones), so look at --stills first.
//
// Needs: ffmpeg on PATH, and playwright-core 1.63.0 (its Chromium revision is the one in ~/Library/Caches/ms-playwright).
// Point PLAYWRIGHT_CORE_DIR at a folder whose node_modules holds playwright-core, e.g. one made with
// `npm install --prefix <scratch dir> playwright-core@1.63.0`.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';

const [dir, out, ...rest] = process.argv.slice(2);
if (!dir || !out) {
  console.error('usage: node render.mjs <film-dir> <out.mp4> [--fps 60] [--stills 0,1.5,3]');
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};
const fps = Number(opt('fps', 60));
const stills = opt('stills', null);

const doc = (name) => JSON.parse(readFileSync(path.join(dir, 'modules', `${name}.json`), 'utf8')).text;
const cut = JSON.parse(doc('scenes.json'));
if (cut.scenes.length !== 1) throw new Error('render.mjs plays single-scene films only');
const scene = cut.scenes[0];
const baseCss = doc('base.css');
const sceneCode = doc(`scene-${scene.id}.js`);

// The ten faces the player ships, by id, mapped to their Google Fonts names.
const SHIPPED = { 'instrument-sans': 'Instrument Sans', 'plus-jakarta-sans': 'Plus Jakarta Sans', manrope: 'Manrope', 'space-grotesk': 'Space Grotesk', fraunces: 'Fraunces', 'fraunces-display': 'Fraunces', 'dm-mono': 'DM Mono', 'inter-display': 'Inter', 'shantell-sans': 'Shantell Sans' };
const slot = (f) => {
  if (!f) return null;
  if (typeof f === 'string') return { family: SHIPPED[f] ?? f, weights: [400, 600, 700] };
  return { family: f.family, weights: f.weights ?? [400, 700], fallback: SHIPPED[f.or] };
};
const fonts = { display: slot(cut.fonts?.display), sans: slot(cut.fonts?.sans) };
const families = Object.values(fonts).filter(Boolean);
const fontLinks = families
  .map((f) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f.family.replace(/ /g, '+')}:wght@${f.weights.join(';')}&display=block">`)
  .join('');
const stack = (f, generic) => (f ? `"${f.family}", ${f.fallback ? `"${f.fallback}", ` : ''}${generic}` : generic);

const html = `<!doctype html><html><head><meta charset="utf-8">${fontLinks}
<style>html,body{margin:0;background:${cut.background}}
#stage{position:relative;width:${cut.width}px;height:${cut.height}px;overflow:hidden;background:${cut.background};--display:${stack(fonts.display, 'serif')};--sans:${stack(fonts.sans, 'system-ui, sans-serif')}}</style>
<style>${baseCss}</style></head><body><div id="stage"></div></body></html>`;

const kitSource = `
window.__scene = null;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
window.kit = {
  stage: document.getElementById('stage'),
  seg: (t, a, b) => clamp01((t - a) / (b - a)),
  lerp: (a, b, x) => a + (b - a) * x,
  eo: (x) => 1 - Math.pow(1 - x, 3),
  ei: (x) => x * x * x,
  eio: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  breathe: (t, amt = 0.012, period = 3.2) => 1 + amt * Math.sin((2 * Math.PI * t) / period),
  h: (markup) => { const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild; },
  scene: (id, def) => { window.__scene = def; },
};
`;

const require = createRequire(path.join(process.env.PLAYWRIGHT_CORE_DIR ?? process.cwd(), 'noop.js'));
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: cut.width, height: cut.height }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console error:', m.text()));
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(kitSource);
await page.evaluate(`(function (kit) { ${sceneCode}\n })(window.kit);`);
await page.evaluate(async () => {
  const s = window.__scene;
  if (!s) throw new Error('the scene file did not call kit.scene');
  await s.init(window.kit);
  window.renderAt = (t) => s.render(t, window.kit);
  window.renderAt(0);
  await document.fonts.ready;
});
for (const f of families) {
  const ok = await page.evaluate((fam) => document.fonts.check(`700 20px "${fam}"`), f.family);
  if (!ok) console.error(`warning: font "${f.family}" did not load, so the fallback shows`);
}

const frame = async (t) => {
  await page.evaluate((x) => window.renderAt(x), t);
  return page.screenshot({ type: 'png' });
};

if (stills) {
  const folder = `${out.replace(/\.mp4$/, '')}-stills`;
  mkdirSync(folder, { recursive: true });
  for (const s of stills.split(',').map(Number)) writeFileSync(path.join(folder, `t_${s.toFixed(2)}.png`), await frame(s));
  console.log(`stills in ${folder}`);
  await browser.close();
  process.exit(0);
}

const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.round(scene.dur * fps);
for (let i = 0; i < frames; i++) {
  if (!ffmpeg.stdin.write(await frame(i / fps))) await once(ffmpeg.stdin, 'drain');
}
ffmpeg.stdin.end();
const [code] = await once(ffmpeg, 'close');
await browser.close();
if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
console.log(`${out}: ${frames} frames at ${fps} fps, ${scene.dur} s`);
