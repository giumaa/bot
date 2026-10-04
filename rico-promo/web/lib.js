// Small deterministic animation toolkit: every value is a pure function of time t (seconds),
// so any frame can be rendered in any order (parallel capture) and the live preview matches it.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
/** 0→1 progress of t through [t0, t1] (clamped) */
export const prog = (t, t0, t1) => (t1 === t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0)));

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
  /** the app's --ease: cubic-bezier(0.2, 0.7, 0.2, 1) */
  app: (x) => bezier(0.2, 0.7, 0.2, 1)(x),
  /** soft overshoot like the app's --ease-spring: cubic-bezier(0.34, 1.4, 0.5, 1) */
  spring: (x) => bezier(0.34, 1.4, 0.5, 1)(x),
};

/** damped spring response, 0→1 (overshoots once or twice and settles) */
export function springStep(x, { damping = 0.42, freq = 2.2 } = {}) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const w = freq * 2 * Math.PI;
  const tt = x * 1.6;
  const v = 1 - Math.exp(-damping * w * tt) * Math.cos(w * Math.sqrt(1 - damping * damping) * tt);
  // pin the end exactly to 1
  return lerp(v, 1, ease.inCubic(x));
}

const bezierCache = new Map();
/** CSS cubic-bezier as a function of x */
export function bezier(x1, y1, x2, y2) {
  const key = `${x1},${y1},${x2},${y2}`;
  if (bezierCache.has(key)) return bezierCache.get(key);
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dsx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  const f = (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-6) break;
      const d = dsx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    u = clamp(u);
    return sy(u);
  };
  bezierCache.set(key, f);
  return f;
}

/** eased 0→1 between t0 and t1 */
export const ep = (t, t0, t1, fn = ease.inOutCubic) => fn(prog(t, t0, t1));

/** in/out envelope: 0 before a, ramps to 1 by b, holds, ramps down from c to 0 at d */
export function env(t, a, b, c = Infinity, d = Infinity, fnIn = ease.outCubic, fnOut = ease.inCubic) {
  if (t < a || t > d) return 0;
  if (t < b) return fnIn(prog(t, a, b));
  if (t <= c) return 1;
  return 1 - fnOut(prog(t, c, d));
}

/**
 * Keyframe track. keys: [[t, value, easeIntoThisKey?], ...] sorted by t; value may be a number or an
 * object of numbers (interpolated per key). Before the first key → first value; after last → last.
 */
export function track(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, fn = ease.inOutCubic] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const k = fn(prog(t, t0, t1));
        if (typeof v0 === 'number') return lerp(v0, v1, k);
        const out = {};
        for (const key of Object.keys(v0)) out[key] = lerp(v0[key], v1[key] ?? v0[key], k);
        return out;
      }
    }
    return keys[keys.length - 1][1];
  };
}

/** seeded PRNG (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** smooth deterministic noise in [-1, 1] (sum of sines) — for gentle floats / drifts */
export function wobble(t, seed = 0, speed = 1) {
  const s = seed * 12.9898;
  return (
    0.55 * Math.sin(t * 0.73 * speed + s) +
    0.3 * Math.sin(t * 1.37 * speed + s * 1.7) +
    0.15 * Math.sin(t * 2.71 * speed + s * 2.3)
  );
}

// ---- DOM helpers -------------------------------------------------------------
export function h(tag, attrs = {}, html = '') {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  if (html) el.innerHTML = html;
  return el;
}

/** cache-aware style setter: only touches the DOM when the value changes */
export function css(el, props) {
  const cache = (el.__css ||= {});
  for (const [k, v] of Object.entries(props)) {
    if (cache[k] === v) continue;
    cache[k] = v;
    if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.style[k] = v;
  }
}

export function setHTML(el, html) {
  if (el.__html === html) return;
  el.__html = html;
  el.innerHTML = html;
}

export function setText(el, text) {
  if (el.__text === text) return;
  el.__text = text;
  el.textContent = text;
}

/** show/hide with opacity + visibility (keeps layout) */
export function vis(el, o) {
  css(el, { opacity: o <= 0 ? '0' : o >= 1 ? '1' : o.toFixed(4), visibility: o <= 0 ? 'hidden' : 'visible' });
}

/** standard "blur-rise" reveal used for text: opacity, blur and a small rise */
export function rise(el, k, { y = 26, blur = 12, scale = 0 } = {}) {
  const kk = clamp(k);
  css(el, {
    opacity: kk.toFixed(4),
    visibility: kk <= 0 ? 'hidden' : 'visible',
    transform: `translate3d(0, ${((1 - kk) * y).toFixed(2)}px, 0)${scale ? ` scale(${(1 - (1 - kk) * scale).toFixed(4)})` : ''}`,
    filter: kk >= 1 ? 'none' : `blur(${((1 - kk) * blur).toFixed(2)}px)`,
  });
}

export const fmt = (x, d = 3) => Number(x.toFixed(d));
