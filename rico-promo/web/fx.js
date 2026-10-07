// Shared effects for the films: drifting gold dust, bloom sparks, the big kaf logo with trace/bloom.
import { css, ease, ep, env, h, lerp, prog, rng } from './lib.js';
import { GLYPH_H, GLYPH_PATH, GLYPH_W } from './assets/logo.js';

const $ = (root, sel) => root.querySelector(sel);
const px = (v) => `${v.toFixed(2)}px`;

// =====================================================================================================
// particles: drifting gold dust + bloom sparks (deterministic)
// =====================================================================================================
export function makeDust(yRange) {
  const r = rng(4242);
  return Array.from({ length: 120 }, () => ({
    x: r() * 1920,
    y: r() * yRange,
    z: 0.3 + r() * 0.7,
    vx: (r() - 0.5) * 9,
    vy: -4 - r() * 10,
    ph: r() * 6.28,
    sz: 0.6 + r() * 1.8,
  }));
}
export function drawDust(DUST, cv, t, alpha = 1, push = null) {
  const SW = cv.width;
  const SH = cv.height;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, SW, SH);
  if (alpha <= 0) return;
  for (const p of DUST) {
    let x = (((p.x + p.vx * t * p.z) % SW) + SW) % SW;
    let y = (((p.y + p.vy * t * p.z) % SH) + SH) % SH;
    if (push) {
      const dx = x - push.x;
      const dy = y - push.y;
      const d = Math.hypot(dx, dy) + 1;
      const f = push.k * 260 * Math.exp(-d / 520);
      x += (dx / d) * f;
      y += (dy / d) * f;
    }
    const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + p.z) + p.ph);
    g.globalAlpha = alpha * tw * (0.25 + 0.55 * p.z);
    g.fillStyle = p.z > 0.75 ? '#ffd66e' : '#f2b33d';
    g.beginPath();
    g.arc(x, y, p.sz * p.z, 0, 6.283);
    g.fill();
  }
  g.globalAlpha = 1;
}
export const SPARKS = (() => {
  const r = rng(99);
  return Array.from({ length: 90 }, () => ({
    a: r() * Math.PI * 2,
    v: 380 + r() * 900,
    life: 0.55 + r() * 1.0,
    w: 1 + r() * 2.2,
    hot: r() < 0.4,
  }));
})();
export function drawSparks(cv, dt, cx, cy, scale = 1, clear = true, r0 = 0) {
  const g = cv.getContext('2d');
  if (clear) g.clearRect(0, 0, cv.width, cv.height);
  if (dt < 0 || dt > 1.8) return;
  const drag = 3.2;
  for (const s of SPARKS) {
    if (dt > s.life) continue;
    const d = r0 + (s.v / drag) * (1 - Math.exp(-drag * dt)) * scale;
    const d0 = r0 + (s.v / drag) * (1 - Math.exp(-drag * Math.max(0, dt - 0.045))) * scale;
    const k = 1 - dt / s.life;
    const x = cx + Math.cos(s.a) * d;
    const y = cy + Math.sin(s.a) * d;
    const x0 = cx + Math.cos(s.a) * d0;
    const y0 = cy + Math.sin(s.a) * d0;
    g.globalAlpha = k * k;
    g.strokeStyle = s.hot ? '#fff1c4' : '#f2b33d';
    g.lineWidth = s.w * (0.4 + 0.6 * k);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x, y);
    g.stroke();
  }
  g.globalAlpha = 1;
}

// =====================================================================================================
// big logo (shared by the intro and the outro)
// =====================================================================================================
const G_SCALE = 600 / GLYPH_H;
const G_OX = (1024 - GLYPH_W * G_SCALE) / 2;
const G_OY = (1024 - GLYPH_H * G_SCALE) / 2;
let bigUid = 0;
export function bigLogo(parent) {
  const id = `big${bigUid++}`;
  const wrap = h('div', { class: 'logo-wrap' });
  const aura = h('div', { class: 'aura' });
  const ring = h('div', { class: 'ring' });
  const flash = h('div', { class: 'flash' });
  wrap.innerHTML = `
  <svg class="logo-svg" viewBox="0 0 1024 1024" aria-hidden="true">
    <defs>
      <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#221C17"/><stop offset="1" stop-color="#0F0D0B"/></linearGradient>
      <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B33D" stop-opacity="0.7"/><stop offset="0.5" stop-color="#F2B33D" stop-opacity="0.1"/><stop offset="1" stop-color="#E8742C" stop-opacity="0.55"/></linearGradient>
      <linearGradient id="${id}i" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${GLYPH_H}"><stop offset="0" stop-color="#FFD66E"/><stop offset="0.5" stop-color="#F2B33D"/><stop offset="1" stop-color="#E8742C"/></linearGradient>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff6dc" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}c"><rect width="1024" height="1024" rx="236"/></clipPath>
      <filter id="${id}g" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <g data-k="tile">
      <rect width="1024" height="1024" rx="236" fill="url(#${id}t)"/>
      <rect x="6" y="6" width="1012" height="1012" rx="230" fill="none" stroke="url(#${id}r)" stroke-width="10"/>
    </g>
    <g transform="translate(${G_OX} ${G_OY}) scale(${G_SCALE})">
      <path data-k="fill" d="${GLYPH_PATH}" fill="url(#${id}i)"/>
      <path data-k="trace" d="${GLYPH_PATH}" fill="none" stroke="#FFD66E" stroke-width="3.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" filter="url(#${id}g)"/>
    </g>
    <g clip-path="url(#${id}c)"><rect data-k="shine" x="-300" y="-200" width="260" height="1424" fill="url(#${id}s)" transform="rotate(18 512 512)"/></g>
  </svg>`;
  wrap.prepend(aura);
  wrap.append(ring, flash);
  parent.appendChild(wrap);
  const svg = $(wrap, 'svg');
  const k = (n) => $(wrap, `[data-k="${n}"]`);
  const trace = k('trace');
  return { wrap, svg, aura, ring, flash, tile: k('tile'), fill: k('fill'), trace, shine: k('shine'), len: 0 };
}
/** glyph-space point → stage coords for a logo of size S centred on (cx, cy) */
export function glyphToStage(p, cx, cy, S) {
  const vx = G_OX + p.x * G_SCALE;
  const vy = G_OY + p.y * G_SCALE;
  return { x: cx - S / 2 + (vx * S) / 1024, y: cy - S / 2 + (vy * S) / 1024 };
}
export function placeLogo(L, cx, cy, S) {
  css(L.svg, { left: px(cx - S / 2), top: px(cy - S / 2), width: px(S), height: px(S) });
}
export function bloomFx(L, t, tb, cx, cy, S, { big = true } = {}) {
  const dt = t - tb;
  // aura (breathing after the bloom)
  const auraK = ep(t, tb - 0.1, tb + 0.7, ease.outCubic);
  const AS = S * (2.3 + 0.06 * Math.sin(t * 1.6));
  css(L.aura, { left: px(cx - AS / 2), top: px(cy - AS / 2), width: px(AS), height: px(AS), opacity: (auraK * 0.9).toFixed(3) });
  // flash
  const fk = env(t, tb - 0.02, tb + 0.05, tb + 0.08, tb + (big ? 0.75 : 0.55), ease.outQuad, ease.outCubic);
  const FS = S * (big ? 2.6 : 2.0) * (0.55 + 0.6 * ep(t, tb - 0.02, tb + 0.6, ease.outCubic));
  css(L.flash, { left: px(cx - FS / 2), top: px(cy - FS / 2), width: px(FS), height: px(FS), opacity: fk.toFixed(3), visibility: fk > 0 ? 'visible' : 'hidden' });
  // shock ring
  const rk = prog(t, tb, tb + (big ? 1.0 : 0.8));
  const RS = S * (0.95 + ease.outCubic(rk) * (big ? 1.9 : 1.5));
  const ro = rk > 0 && rk < 1 ? (1 - rk) * 0.9 : 0;
  css(L.ring, { left: px(cx - RS / 2), top: px(cy - RS / 2), width: px(RS), height: px(RS), opacity: ro.toFixed(3), visibility: ro > 0 ? 'visible' : 'hidden' });
  return dt;
}

