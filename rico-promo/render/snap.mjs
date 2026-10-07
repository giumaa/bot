// Render a few stills for review: node render/snap.mjs out_dir t1 t2 ...  (or --sheet for a contact sheet)
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { serve } from './serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? '/opt/node22/lib/node_modules/playwright');

const VERT = process.env.FORMAT === 'vertical' || (process.env.PAGE ?? '').startsWith('reel');
const [outDir, ...rest] = process.argv.slice(2);
const times = rest.map(Number);
await mkdir(outDir, { recursive: true });
const { server, url } = await serve();
const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: VERT ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${url}${process.env.PAGE ?? 'index.html'}?capture=1${VERT ? '&format=vertical' : ''}`);
await page.waitForFunction(() => window.__promo);
await page.evaluate(() => window.__promo.ready);
for (const t of times) {
  const t0 = Date.now();
  await page.evaluate((tt) => window.__promo.renderAt(tt), t);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const file = join(outDir, `t${t.toFixed(2).padStart(6, '0')}.png`);
  await page.screenshot({ path: file, type: 'png' });
  console.log(file, `${Date.now() - t0}ms`);
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
server.close();
