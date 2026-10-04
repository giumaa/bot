// Renders the film: N parallel headless-Chromium workers each capture a contiguous range of frames
// (renderAt(t) is pure, so ranges are independent) and pipe them into their own ffmpeg; the segments
// are then concatenated and muxed with the mastered soundtrack.
//
//   node render/render.mjs [--workers 4] [--fps 60] [--from 0] [--to 64] [--scale 1] [--out out/rico_promo.mp4]
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';
import { DURATION, FPS as BASE_FPS } from '../web/timeline.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright');
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const WORKERS = Number(arg('workers', 4));
const FPS = Number(arg('fps', BASE_FPS));
const FROM = Number(arg('from', 0));
const TO = Number(arg('to', DURATION));
const SCALE = Number(arg('scale', 1));
const OUT = arg('out', join(ROOT, 'out', 'rico_promo.mp4'));
const AUDIO = arg('audio', join(ROOT, 'audio', 'soundtrack_master.m4a'));
const CRF = arg('crf', SCALE < 1 ? '23' : '16');
const TMP = join(ROOT, 'render', 'tmp');

const f0 = Math.round(FROM * FPS);
const f1 = Math.round(TO * FPS);
const total = f1 - f0;
await rm(TMP, { recursive: true, force: true });
await mkdir(TMP, { recursive: true });
await mkdir(join(ROOT, 'out'), { recursive: true });

const { server, url } = await serve();
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--force-color-profile=srgb', '--disable-lcd-text'] });
const W = Math.round(1920 * SCALE);
const H = Math.round(1080 * SCALE);

let done = 0;
const t0 = Date.now();
function progress() {
  done++;
  if (done % 60 === 0 || done === total) {
    const el = (Date.now() - t0) / 1000;
    const eta = (el / done) * (total - done);
    process.stdout.write(`\r  ${done}/${total} frames  ${(done / el).toFixed(1)} fps  eta ${eta.toFixed(0)}s   `);
  }
}

async function worker(k, a, b) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}index.html?capture=1`);
  await page.waitForFunction(() => window.__promo);
  await page.evaluate(() => window.__promo.ready);
  const seg = join(TMP, `seg_${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', String(CRF), '-tune', 'film',
    '-x264-params', 'keyint=120:min-keyint=1', '-r', String(FPS), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  const cdp = await page.context().newCDPSession(page);
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.__promo.renderAt(t), f / FPS);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, optimizeForSpeed: true, captureBeyondViewport: false });
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    progress();
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${k} exit ${c}`)))));
  if (errors.length) console.log(`\nworker ${k} page errors:\n` + errors.join('\n'));
  await page.close();
  return seg;
}

console.log(`rendering ${total} frames (${FROM}-${TO}s @ ${FPS} fps, ${W}x${H}) with ${WORKERS} workers`);
const per = Math.ceil(total / WORKERS);
const jobs = [];
for (let k = 0; k < WORKERS; k++) {
  const a = f0 + k * per;
  const b = Math.min(f1, a + per);
  if (a < b) jobs.push(worker(k, a, b));
}
const segs = await Promise.all(jobs);
console.log(`\ncaptured in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await browser.close();
server.close();

const list = join(TMP, 'list.txt');
await writeFile(list, segs.map((s) => `file '${s}'`).join('\n'));
const hasAudio = await stat(AUDIO).then(() => true, () => false);
const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list];
if (hasAudio) args.push('-ss', String(FROM), '-t', String(TO - FROM), '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:a', 'copy');
args.push('-c:v', 'copy', '-movflags', '+faststart', '-shortest', OUT);
await new Promise((r, j) => spawn('ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c === 0 ? r() : j(new Error('mux failed')))));
console.log(`wrote ${OUT}${hasAudio ? '' : ' (no audio found)'}`);
