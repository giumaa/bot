// Rico promo — every frame is renderAt(t): a pure function of time, so frames can be captured in
// parallel (render/render.mjs) and the live preview shows exactly the same picture.

import { DURATION, FPS, K, MARKS, REPLY_LIBYA, REPLY_SOLAR, STREAM, TOK, TXT, TYPE, typedCount } from './timeline.js';
import { clamp, css, ease, env, ep, h, lerp, prog, rise, rng, setHTML, setText, springStep, vis, wobble } from './lib.js';
import { icon } from './assets/icons.js';
import { bigLogo, bloomFx, drawDust, drawSparks, glyphToStage, makeDust, placeLogo } from './fx.js';
import { buildApp, logoTile, replyHTML } from './app-replica.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const stage = document.getElementById('stage');
const $ = (root, sel) => root.querySelector(sel);

// ---- format: 16:9 (default) or 9:16 for Reels (?format=vertical) -------------------------------
const VERT = params.get('format') === 'vertical';
const SW = VERT ? 1080 : 1920;
const SH = VERT ? 1920 : 1080;
document.documentElement.dataset.format = VERT ? 'vertical' : 'landscape';
stage.style.width = `${SW}px`;
stage.style.height = `${SH}px`;
/** every position that depends on the frame shape (vertical keeps key text inside the Reels safe zone) */
const LY = VERT
  ? {
      trace: { cx: 540, cy: 900, S: 560 },
      up: { cx: 540, cy: 700, S: 300 },
      caretH: 74,
      word: { top: 880, size: 180 },
      latin: { top: 1132, size: 44 },
      tagTop: 1218,
      dive: { x: 540, y: 520 },
      shield: { cx: 540, cy: 470, S: 230 },
      pv: { title: 640, sub: 822, grid: 980 },
      lp: { dTitle: 250, dGloss: 540, wifi: [470, 560], oTitle: 250, zero: 760 },
      outLogo: { cx: 540, cy: 560, S: 280 },
      out: { word: 740, wordSize: 180, tag: 1012, credit: 1182, cta: 1330 },
    }
  : {
      trace: { cx: 960, cy: 540, S: 500 },
      up: { cx: 960, cy: 352, S: 252 },
      caretH: 84,
      word: { top: 492, size: 150 },
      latin: { top: 690, size: 38 },
      tagTop: 768,
      dive: { x: 960, y: 268 },
      shield: { cx: 960, cy: 222, S: 190 },
      pv: { title: 392, sub: 548, grid: 706 },
      lp: { dTitle: 200, dGloss: 452, wifi: [470, 548], oTitle: 250, zero: 744 },
      outLogo: { cx: 960, cy: 300, S: 210 },
      out: { word: 438, wordSize: 140, tag: 640, credit: 782, cta: 900 },
    };

// =====================================================================================================
// helpers
// =====================================================================================================
let stageScale = 1;
/** element rect in stage pixels (works while the stage is CSS-scaled in the live preview) */
function srect(el) {
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return {
    x: (r.left - s.left) / stageScale,
    y: (r.top - s.top) / stageScale,
    w: r.width / stageScale,
    h: r.height / stageScale,
    cx: (r.left - s.left + r.width / 2) / stageScale,
    cy: (r.top - s.top + r.height / 2) / stageScale,
  };
}
/** layout position of el inside #win (ignores transforms) */
function wpos(el, fx = 0.5, fy = 0.5) {
  let x = 0;
  let y = 0;
  let n = el;
  while (n && n.id !== 'win') {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return { x: x + el.offsetWidth * fx, y: y + el.offsetHeight * fy };
}
const px = (v) => `${v.toFixed(2)}px`;
function canvasLayer(parent) {
  const c = h('canvas', { class: 'fx', width: SW, height: SH });
  c.style.width = `${SW}px`;
  c.style.height = `${SH}px`;
  parent.appendChild(c);
  return c;
}
function layer(id, cls = 'layer') {
  const d = h('div', { id, class: cls });
  stage.appendChild(d);
  return d;
}
function show(el, on) {
  css(el, { display: on ? '' : 'none' });
  return on;
}

const DUST = makeDust(VERT ? 1920 : 1080);

// =====================================================================================================
// scene: NIGHT (hook + logo) 0–14 s
// =====================================================================================================
const night = layer('night');
night.innerHTML = '<div class="night-bg"></div>';
const dustA = canvasLayer(night);
const hook = h('div', { class: 'hook' });
night.appendChild(hook);
const HOOK_HL = [[4], [3, 4]];
function hookRow(en) {
  const row = h('div', { class: 'hook-row' });
  const line = h('div', { class: 'hook-line' });
  const enEl = h('div', { class: 'hook-en' }, en);
  row.append(line, enEl);
  hook.appendChild(row);
  return { row, line, en: enEl };
}
const R1 = hookRow(TXT.hook1en);
const R2 = hookRow(TXT.hook2en);
function hookHTML(text, hl) {
  const words = text.split(' ');
  return words.map((w, i) => `<span class="w${hl.includes(i) ? ' gold' : ''}">${w}</span>`).join(' ') + '<span class="endm"></span>';
}
const caret = h('div', { class: 'caret' });
night.appendChild(caret);
const sparksA = canvasLayer(night);
const L1 = bigLogo(night);
const wordmark = h('div', { class: 'wordmark' }, `<span class="gold" style="display:inline-block">${TXT.word}</span>`);
const latin = h('div', { class: 'latin-mark' }, TXT.latin.toUpperCase());
const tagline = h('div', { class: 'tagline' }, `<span class="ar">${TXT.tagline}</span><span class="la">${TXT.taglineEn}</span>`);
night.append(wordmark, latin, tagline);
const wordSpan = wordmark.firstElementChild;
const tagAr = $(tagline, '.ar');
const tagLa = $(tagline, '.la');

function hookLine(R, sched, hl, t) {
  const n = typedCount(sched, t);
  const s = sched.chars.slice(0, n).join('');
  setHTML(R.line, hookHTML(s, hl));
  return n;
}

function logoLayout(t) {
  // centre + size of the intro logo
  const k = ep(t, ...K.logoUp, ease.inOutCubic);
  return { cx: lerp(LY.trace.cx, LY.up.cx, k), cy: lerp(LY.trace.cy, LY.up.cy, k), S: lerp(LY.trace.S, LY.up.S, k) };
}

function renderNight(t) {
  if (!show(night, t < K.reveal[1] + 0.05)) return;
  drawDust(DUST, dustA, t, ep(t, 0, 1.2), t > K.bloom - 0.1 && t < K.bloom + 1.5 ? { x: LY.trace.cx, y: LY.trace.cy, k: ep(t, K.bloom, K.bloom + 1.2, ease.outCubic) * (1 - ep(t, K.bloom + 0.6, K.bloom + 2.5)) } : null);

  // ---- hook text (with a slow push-in)
  const hookOn = show(hook, t < K.glide[1] + 0.3);
  css(hook, { transform: `scale(${(1 + 0.03 * ep(t, 0, K.dissolve + 0.6, ease.inOutQuad)).toFixed(4)})` });
  let caretPos = null;
  if (hookOn) {
    hookLine(R1, TYPE.hook1, HOOK_HL[0], t);
    hookLine(R2, TYPE.hook2, HOOK_HL[1], t);
    rise(R1.en, ep(t, lerp(TYPE.hook1.t0, TYPE.hook1.t1, 0.55), lerp(TYPE.hook1.t0, TYPE.hook1.t1, 0.55) + 0.8, ease.outCubic) * (1 - ep(t, K.dissolve, K.dissolve + 0.5)), { y: 14, blur: 8 });
    rise(R2.en, ep(t, lerp(TYPE.hook2.t0, TYPE.hook2.t1, 0.55), lerp(TYPE.hook2.t0, TYPE.hook2.t1, 0.55) + 0.8, ease.outCubic) * (1 - ep(t, K.dissolve + 0.05, K.dissolve + 0.55)), { y: 14, blur: 8 });
    // dissolve word by word, in reading order (right → left), line 1 then line 2
    let wi = 0;
    for (const R of [R1, R2]) {
      R.line.querySelectorAll('.w').forEach((w) => {
        const a = K.dissolve + wi * 0.045;
        const k = ep(t, a, a + 0.5, ease.inCubic);
        css(w, {
          opacity: (1 - k).toFixed(3),
          filter: k > 0 ? `blur(${(k * 12).toFixed(2)}px)` : 'none',
          transform: k > 0 ? `translate3d(0, ${(-26 * k).toFixed(2)}px, 0) scale(${(1 + 0.06 * k).toFixed(3)})` : 'none',
        });
        wi++;
      });
    }
    // caret sits after the last typed glyph of the active line
    const onL2 = t >= TYPE.hook2.t0 - 0.25;
    const m1 = srect($(R1.line, '.endm'));
    const m2 = srect($(R2.line, '.endm'));
    const lr1 = srect(R1.line);
    const lr2 = srect(R2.line);
    const p1 = { x: m1.x - 10, y: lr1.cy + 6 };
    const p2 = { x: m2.x - 10, y: lr2.cy + 6 };
    if (!onL2) caretPos = p1;
    else {
      const k = ep(t, TYPE.hook2.t0 - 0.25, TYPE.hook2.t0, ease.inOutCubic);
      // line 2 starts at its right edge: the end marker is there while empty
      caretPos = { x: lerp(p1.x, p2.x, k), y: lerp(p1.y, p2.y, k) };
    }
  }

  // ---- caret: blink when idle, glide to the glyph and become the tracing pen
  const lastType = Math.max(...TYPE.hook1.times.filter((x) => x <= t), ...TYPE.hook2.times.filter((x) => x <= t), -9);
  const idle = t - lastType > 0.35;
  let cOp = ep(t, K.caretIn, K.caretIn + 0.4);
  if (idle) cOp *= 0.6 + 0.4 * Math.cos((2 * Math.PI * (t - lastType)) / 1.05);
  const { cx, cy, S } = logoLayout(t);
  if (!L1.len) L1.len = L1.trace.getTotalLength();
  const start = glyphToStage(L1.trace.getPointAtLength(0), cx, cy, S);
  let cw = 11;
  let ch = LY.caretH;
  let cpos = caretPos;
  if (t >= K.glide[0]) {
    const k = ep(t, ...K.glide, ease.inOutCubic);
    const from = caretPos ?? start;
    cpos = { x: lerp(from.x, start.x, k), y: lerp(from.y, start.y, k) };
    cw = lerp(11, 16, k);
    ch = lerp(LY.caretH, 16, k);
    cOp = lerp(cOp, 1, k);
  }
  const tp = ep(t, ...K.trace, ease.inOutCubic);
  if (t >= K.trace[0]) cpos = glyphToStage(L1.trace.getPointAtLength(L1.len * tp), cx, cy, S);
  const caretOn = t < K.trace[1] + 0.06 && cpos;
  if (show(caret, !!caretOn)) {
    css(caret, {
      left: px(cpos.x),
      top: px(cpos.y),
      width: px(cw),
      height: px(ch),
      marginLeft: px(-cw / 2),
      marginTop: px(-ch / 2),
      borderRadius: px(Math.min(cw, ch) / 2),
      opacity: (cOp * (1 - ep(t, K.trace[1] - 0.04, K.trace[1] + 0.06))).toFixed(3),
    });
  }

  // ---- logo
  const logoOn = show(L1.wrap, t >= K.trace[0] - 0.05 && t < K.reveal[0] + 0.02);
  if (logoOn) {
    placeLogo(L1, cx, cy, S);
    css(L1.trace, {
      strokeDasharray: `${L1.len.toFixed(1)}`,
      strokeDashoffset: `${(L1.len * (1 - tp)).toFixed(2)}`,
      opacity: (1 - ep(t, K.bloom, K.bloom + 0.45)).toFixed(3),
    });
    const fk = ep(t, K.bloom - 0.02, K.bloom + 0.16, ease.outQuad);
    const hot = 1 - ep(t, K.bloom, K.bloom + 0.9, ease.outCubic);
    css(L1.fill, { opacity: fk.toFixed(3), filter: hot > 0.01 ? `brightness(${(1 + 1.8 * hot).toFixed(3)})` : 'none' });
    const tk = ep(t, K.bloom, K.bloom + 0.14);
    const ts = lerp(0.82, 1, springStep(prog(t, K.bloom, K.bloom + 1.0), { damping: 0.5, freq: 1.8 }));
    css(L1.tile, { opacity: tk.toFixed(3), transform: `translate(512px, 512px) scale(${ts.toFixed(4)}) translate(-512px, -512px)` });
    const sk = ep(t, ...K.shine, ease.inOutCubic);
    css(L1.shine, { transform: `rotate(18 512 512)`, x: `${lerp(-420, 1300, sk).toFixed(1)}` });
    L1.shine.setAttribute('x', lerp(-420, 1300, sk).toFixed(1));
    bloomFx(L1, t, K.bloom, cx, cy, S);
    // gentle float once settled
    const fl = ep(t, K.logoUp[1], K.logoUp[1] + 0.6) * Math.sin((t - K.logoUp[1]) * 1.9) * 4;
    css(L1.svg, { transform: `translate3d(0, ${fl.toFixed(2)}px, 0)` });
  }
  drawSparks(sparksA, t - K.bloom, cx, cy, S / 500, true, S * 0.36);

  // ---- wordmark, latin, tagline
  const out = ep(t, ...K.logoTextOut, ease.inCubic);
  const wk = ep(t, ...K.wordmark, ease.outCubic);
  if (show(wordmark, wk > 0 && t < K.reveal[0] + 0.1)) {
    css(wordmark, { top: px(LY.word.top), fontSize: px(LY.word.size), opacity: (1 - out).toFixed(3), filter: out > 0 ? `blur(${(out * 10).toFixed(2)}px)` : 'none', transform: `translate3d(0, ${(-16 * out).toFixed(2)}px, 0)` });
    css(wordSpan, {
      clipPath: `inset(-30% 0 -30% ${((1 - wk) * 100).toFixed(2)}%)`,
      filter: wk < 1 ? `blur(${((1 - wk) * 10).toFixed(2)}px)` : 'none',
      transform: `scale(${lerp(0.94, 1, wk).toFixed(4)})`,
    });
  }
  const lk = ep(t, ...K.latin, ease.outCubic) * (1 - out);
  if (show(latin, lk > 0)) {
    css(latin, { top: px(LY.latin.top), fontSize: px(LY.latin.size), letterSpacing: `${lerp(0.7, 0.32, ep(t, ...K.latin, ease.outCubic)).toFixed(3)}em` });
    rise(latin, lk, { y: 10, blur: 8 });
  }
  const gk = ep(t, ...K.tagline, ease.outCubic) * (1 - out);
  if (show(tagline, gk > 0)) {
    css(tagline, { top: px(LY.tagTop) });
    rise(tagAr, gk, { y: 18, blur: 10 });
    rise(tagLa, ep(t, K.tagline[0] + 0.22, K.tagline[1] + 0.22, ease.outCubic) * (1 - out), { y: 12, blur: 8 });
  }
}

// =====================================================================================================
// scene: APP (reveal, chat, dialect, offline) 12–40 s
// =====================================================================================================
const appScene = layer('appScene');
appScene.innerHTML = '<div class="parch-bg"></div>';
const world = h('div', { id: 'world' });
const win = h('div', { id: 'win' });
world.appendChild(win);
appScene.appendChild(world);
const A = buildApp(win);
// tooltips for the Libyan words live inside the answer body so they move with the window
const msgBody = $(A.mBot, '.msg-body');
msgBody.style.position = 'relative';
const tips = Object.fromEntries(Object.entries(MARKS).map(([k, msa]) => {
  const tip = h('div', { class: 'tip' }, `${msa}<small>بالفصحى</small>`);
  msgBody.appendChild(tip);
  return [k, tip];
}));

// left panel (stage coords)
const lp = h('div', { class: 'layer', style: 'pointer-events:none' });
appScene.appendChild(lp);
const dTitle = h('div', { class: 'lp' }, `<div class="lp-title">${TXT.dialectTitle}</div><div class="lp-en">${TXT.dialectEn}</div>`);
const dGloss = h('div', { class: 'lp gloss' }, TXT.glossary.map(([lib, msa]) => `<div class="gloss-chip"><span class="lib">${lib}</span><span class="msa">${msa}<small>فصحى</small></span></div>`).join(''));
const oTitle1 = h('div', { class: 'lp' }, `<div class="lp-title">${TXT.offline1}</div><div class="lp-en">${TXT.offline1en}</div>`);
const oTitle2 = h('div', { class: 'lp' }, `<div class="lp-title">${TXT.offline2}</div><div class="lp-en">${TXT.offline2en}</div>`);
const wifi = h('div', { class: 'wifi-card' }, `
  <div class="wifi-ico">${icon('wifi', 'on')}${icon('wifi-off', 'off')}</div>
  <div class="wifi-txt"><div class="t1">Wi‑Fi</div><div class="t2"><span class="s-on">متصل</span><span class="s-off">غير متصل · ما فيش إنترنت</span></div></div>
  <div class="switch"><div class="on-track"></div><div class="knob"></div></div>`);
const zero = h('div', { class: 'zero-chip' }, `${icon('shield-check')}<span>${TXT.zeroBytes}</span><span class="num">0 B</span>`);
lp.append(dTitle, dGloss, oTitle1, oTitle2, wifi, zero);
const glossChips = [...dGloss.children];
const wifiOnIc = $(wifi, 'svg.on');
const wifiOffIc = $(wifi, 'svg.off');
const wifiIco = $(wifi, '.wifi-ico');
const sOn = $(wifi, '.s-on');
const sOff = $(wifi, '.s-off');
const swTrack = $(wifi, '.on-track');
const swKnob = $(wifi, '.knob');

// ---- camera keyframes: focus point (window coords) → stage point, with scale and 3D tilt ------------
const mdFirst = () => A.md.querySelector('p') ?? A.md;
const C0 = () => ({ x: 680, y: 430 });
const CAM_V = [
  { t: K.reveal[0], s: 1.1, f: () => ({ x: 534, y: 430 }), X: 540, Y: 960, ry: 0, rx: 0 },
  { t: 13.7, s: 1.0, f: () => ({ x: 534, y: 430 }), X: 540, Y: 960, ry: 0, rx: 0 },
  { t: 14.15, s: 1.0, f: () => ({ x: 534, y: 430 }), X: 540, Y: 960, ry: 0, rx: 0 },
  { t: 15.4, s: 1.32, f: () => wpos(A.composer, 0.5, 0.0), X: 540, Y: 1160, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 17.4, s: 1.36, f: () => wpos(A.composer, 0.5, 0.0), X: 540, Y: 1166, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 18.45, s: 1.32, f: () => ({ x: 534, y: 330 }), X: 540, Y: 760, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 24.0, s: 1.32, f: () => ({ x: 534, y: 420 }), X: 540, Y: 760, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 24.6, s: 1.42, f: () => wpos(mdFirst(), 0.7, 0.5), X: 540, Y: 860, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 25.9, s: 1.46, f: () => wpos(mdFirst(), 0.7, 0.5), X: 540, Y: 860, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 26.9, s: 0.77, f: C0, X: 540, Y: 1370, ry: 0, rx: 9, e: ease.inOutQuart },
  { t: 33.4, s: 0.79, f: C0, X: 540, Y: 1360, ry: 0, rx: 8, e: ease.inOutQuad },
  { t: 34.6, s: 0.84, f: () => ({ x: 680, y: 400 }), X: 540, Y: 1330, ry: 0, rx: 7, e: ease.inOutCubic },
  { t: 37.65, s: 0.85, f: () => ({ x: 680, y: 405 }), X: 540, Y: 1330, ry: 0, rx: 7, e: ease.inOutQuad },
  { t: 38.55, s: 0.79, f: C0, X: 540, Y: 960, ry: 0, rx: 0, e: ease.inOutCubic },
  { t: K.dive[0], s: 0.79, f: C0, X: 540, Y: 960, ry: 0, rx: 0 },
  { t: K.dive[1], s: 7.5, f: C0, X: 540, Y: 960, ry: 0, rx: 0, dive: true },
];
const CAM_H = [
  { t: K.reveal[0], s: 1.07, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0 },
  { t: 13.7, s: 1.0, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0 },
  { t: 14.15, s: 1.0, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0 },
  { t: 15.4, s: 1.38, f: () => wpos(A.composer, 0.5, 0.0), X: 960, Y: 705, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 17.4, s: 1.43, f: () => wpos(A.composer, 0.5, 0.0), X: 960, Y: 712, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 18.45, s: 1.17, f: () => ({ x: 534, y: 300 }), X: 960, Y: 470, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 24.0, s: 1.17, f: () => ({ x: 534, y: 400 }), X: 960, Y: 470, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 24.6, s: 1.55, f: () => wpos(mdFirst(), 0.5, 0.5), X: 960, Y: 520, ry: 0, rx: 0, e: ease.inOutQuart },
  { t: 25.9, s: 1.6, f: () => wpos(mdFirst(), 0.5, 0.5), X: 960, Y: 520, ry: 0, rx: 0, e: ease.inOutQuad },
  { t: 26.9, s: 0.74, f: () => ({ x: 680, y: 430 }), X: 1335, Y: 548, ry: -16, rx: 1.5, e: ease.inOutQuart },
  { t: 33.4, s: 0.76, f: () => ({ x: 680, y: 430 }), X: 1335, Y: 548, ry: -15, rx: 1.5, e: ease.inOutQuad },
  { t: 34.6, s: 0.79, f: () => ({ x: 680, y: 410 }), X: 1335, Y: 540, ry: -13, rx: 1.0, e: ease.inOutCubic },
  { t: 37.65, s: 0.8, f: () => ({ x: 680, y: 415 }), X: 1335, Y: 540, ry: -13, rx: 1.0, e: ease.inOutQuad },
  { t: 38.55, s: 0.92, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0, e: ease.inOutCubic },
  { t: K.dive[0], s: 0.92, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0 },
  { t: K.dive[1], s: 7.5, f: () => ({ x: 680, y: 430 }), X: 960, Y: 540, ry: 0, rx: 0, dive: true },
];
const CAM = VERT ? CAM_V : CAM_H;
function camAt(t) {
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i].t) i++;
  const a = CAM[i - 1];
  const b = CAM[i];
  const k = (b.e ?? ease.inOutCubic)(prog(t, a.t, b.t));
  // zoom in log space so speed feels constant at any scale
  const s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), k));
  if (b.dive) {
    // dive into the sidebar's offline pill: the pill moves in a straight line on screen while we zoom
    const P = wpos(A.pillIcon, 0.5, 0.5);
    const f0 = a.f();
    const x0 = a.X + a.s * (P.x - f0.x);
    const y0 = a.Y + a.s * (P.y - f0.y);
    return { s, fx: P.x, fy: P.y, X: lerp(x0, LY.dive.x, k), Y: lerp(y0, LY.dive.y, k), ry: 0, rx: 0 };
  }
  const fa = a.f();
  const fb = b.f();
  return {
    s,
    fx: lerp(fa.x, fb.x, k),
    fy: lerp(fa.y, fb.y, k),
    X: lerp(a.X, b.X, k),
    Y: lerp(a.Y, b.Y, k),
    ry: lerp(a.ry, b.ry, k),
    rx: lerp(a.rx, b.rx, k),
  };
}

// ---- chat state --------------------------------------------------------------------------------
const CONV = [
  { t0: K.sendClick, t1: K.newChatClick, q: TXT.q1, blocks: REPLY_LIBYA, tokens: TOK.libya, times: STREAM.libya, userIn: K.sendClick + 0.05, botIn: K.think[0], think: K.think, row: 1 },
  { t0: K.chipClick, t1: Infinity, q: TXT.q2, blocks: REPLY_SOLAR, tokens: TOK.solar, times: STREAM.solar, userIn: K.chipClick + 0.05, botIn: K.chipClick + 0.2, think: [K.chipClick + 0.2, K.stream2[0]], row: 0 },
];
const msgIn = (t, t0, d = 0.32) => ease.app(prog(t, t0, t0 + d));

function heroAlpha(t) {
  return (
    1 - ep(t, K.sendClick, K.sendClick + 0.25) + ep(t, K.newChatClick + 0.05, K.newChatClick + 0.35) - ep(t, K.chipClick, K.chipClick + 0.25)
  );
}

function renderChat(t) {
  // hero
  const ha = clamp(heroAlpha(t));
  vis(A.hero, ha);
  css(A.hero, { transform: `scale(${lerp(0.985, 1, ha).toFixed(4)})` });
  const boot = (el, a, d = 0.5, y = 10) => {
    const k = ease.app(prog(t, a, a + d));
    css(el, { opacity: k.toFixed(3), transform: `translate3d(0, ${((1 - k) * y).toFixed(2)}px, 0)` });
  };
  boot(A.heroTitle, 12.75, 0.55, 14);
  boot(A.heroSub, 12.9, 0.55, 12);
  A.chipEls.forEach((c, i) => boot(c, 13.0 + i * 0.08, 0.5, 8));
  boot(A.heroPrivacy, 13.45, 0.5, 6);
  css(A.heroMark, { opacity: t >= K.reveal[1] ? '1' : '0', transform: `translate3d(0, ${(Math.sin(t * 1.05) * -3).toFixed(2)}px, 0)` });

  // conversation
  const c = CONV.find((cv) => t >= cv.t0 && t < cv.t1);
  if (show(A.col, !!c)) {
    setText(A.mUserText, c.q);
    const u = msgIn(t, c.userIn);
    css(A.mUser, { opacity: u.toFixed(3), transform: `translate3d(0, ${((1 - u) * 8).toFixed(2)}px, 0)` });
    const b = msgIn(t, c.botIn);
    css(A.mBot, { opacity: b.toFixed(3), transform: `translate3d(0, ${((1 - b) * 8).toFixed(2)}px, 0)` });
    const thinking = t < c.think[1];
    show(A.typing, thinking);
    if (thinking) {
      A.dots.forEach((d, i) => {
        const ph = (((t - c.think[0] - i * 0.14) / 1.1) % 1 + 1) % 1;
        const bump = ph < 0.7 ? Math.sin((Math.PI * ph) / 0.7) : 0;
        css(d, { transform: `translateY(${(-5 * bump).toFixed(2)}px)`, opacity: (0.45 + 0.55 * bump).toFixed(3) });
      });
    }
    let n = 0;
    while (n < c.times.length && c.times[n] <= t) n++;
    const streaming = n > 0 && n < c.tokens.length;
    const done = n >= c.tokens.length;
    const caretOn = !thinking && !done;
    setHTML(A.md, replyHTML(c.blocks, c.tokens, Math.max(n, 0), { caret: caretOn && n > 0 }));
    A.mBot.setAttribute('data-streaming', String(streaming || caretOn));
    const caretEl = $(A.md, '.stream-caret');
    if (caretEl) css(caretEl, { opacity: (0.6 + 0.4 * Math.cos(t * 6)).toFixed(3) });
    const endT = c.times[c.times.length - 1];
    css(A.actions, { opacity: ep(t, endT + 0.25, endT + 0.6).toFixed(3) });
    // Libyan-word marks + tooltips (first conversation only)
    if (c === CONV[0]) {
      [['tahbel', K.marks[0]], ['testahel', K.marks[1]]].forEach(([key, tm]) => {
        const w = $(A.md, `.lw[data-mark="${key}"]`);
        const tip = tips[key];
        if (!w) return vis(tip, 0);
        const mk = ep(t, tm, tm + 0.32, ease.inOutCubic);
        css(w, { backgroundSize: `${(mk * 100).toFixed(1)}% 82%` });
        const pk = springStep(prog(t, tm + 0.18, tm + 0.75), { damping: 0.45, freq: 1.6 });
        const outK = ep(t, K.slideRight[0] + 0.1, K.slideRight[0] + 0.5);
        const o = clamp(ep(t, tm + 0.18, tm + 0.36) - outK);
        vis(tip, o);
        const tw = tip.offsetWidth;
        const p = { x: w.offsetLeft + w.offsetWidth / 2, y: w.offsetTop };
        css(tip, { left: px(p.x - tw / 2), top: px(p.y - tip.offsetHeight - 10), transform: `scale(${lerp(0.6, 1, pk).toFixed(4)})` });
      });
    } else Object.values(tips).forEach((tip) => vis(tip, 0));
  } else Object.values(tips).forEach((tip) => vis(tip, 0));

  // header title
  const titleNow = c ? c.q : '';
  setText(A.title, titleNow);
  css(A.title, { opacity: c ? ep(t, c.t0 + 0.35, c.t0 + 0.7).toFixed(3) : '0' });

  // sidebar: new rows grow in at the top of "today"
  CONV.forEach((cv) => {
    const row = A.newRows[cv.row];
    const k = ease.app(prog(t, cv.t0 + 0.2, cv.t0 + 0.55));
    setHTML($(row, '.sb-item-title'), cv.q);
    css(row, { height: px(44 * k), marginBottom: px(2 * k), opacity: k.toFixed(3) });
    row.setAttribute('data-active', String(c === cv));
  });

  // composer: focus, typed text, caret, send button
  const focused = t >= K.focusClick;
  A.composer.classList.toggle('is-focus', focused);
  const typingQ1 = t >= K.q1[0] && t < K.sendClick;
  let text = '';
  if (typingQ1) text = TYPE.q1.chars.slice(0, typedCount(TYPE.q1, t)).join('');
  const lastKey = Math.max(-9, ...TYPE.q1.times.filter((x) => x <= t));
  const blinkOn = t - lastKey < 0.45 || Math.cos(((t - lastKey) * 2 * Math.PI) / 1.0) > -0.2;
  const tc = focused && blinkOn ? '<span class="tcaret"></span>' : '';
  setHTML(A.input, text ? `<span>${text}</span>${tc}` : `${tc}<span class="ph">اسأل ريكو أي شي…</span>`);
  if (text) A.send.removeAttribute('disabled');
  else A.send.setAttribute('disabled', '');
  const press = env(t, K.sendClick - 0.02, K.sendClick + 0.05, K.sendClick + 0.08, K.sendClick + 0.3);
  css(A.send, { transform: `scale(${(1 - 0.08 * press).toFixed(4)})` });

  // new-chat button press + sidebar "offline" pill glow
  const np = env(t, K.newChatClick - 0.02, K.newChatClick + 0.05, K.newChatClick + 0.08, K.newChatClick + 0.3);
  css(A.newChat, { transform: `scale(${(1 - 0.03 * np).toFixed(4)})` });
  const g = env(t, K.pillGlow, K.pillGlow + 0.25, K.pillGlow + 0.6, K.dive[0] + 0.5);
  css(A.pillGlow, { opacity: (g * (0.75 + 0.25 * Math.sin((t - K.pillGlow) * 9))).toFixed(3) });
}

function renderApp(t) {
  if (!show(appScene, t >= K.reveal[0] && t < K.dive[1] + 0.15)) return;
  // reveal: parchment light opens from the logo
  const rk = ep(t, ...K.reveal, ease.inOutCubic);
  const R = rk * 2300;
  const mask = rk < 1 ? `radial-gradient(circle at ${LY.up.cx}px ${LY.up.cy}px, #000 ${R.toFixed(1)}px, transparent ${(R + 1.5).toFixed(1)}px)` : 'none';
  css(appScene, { maskImage: mask, webkitMaskImage: mask });

  const cam = camAt(t);
  // only enter a 3D context while the window is actually tilted: clip-path + 3D layers misrender
  // (black/noisy fill outside the circle) in software compositing
  const tilted = Math.abs(cam.ry) > 0.001 || Math.abs(cam.rx) > 0.001;
  css(world, { perspective: tilted ? '2400px' : 'none', perspectiveOrigin: `${SW / 2}px ${SH / 2}px` });
  css(win, {
    transform: tilted
      ? `translate(${px(cam.X)}, ${px(cam.Y)}) rotateY(${cam.ry.toFixed(3)}deg) rotateX(${cam.rx.toFixed(3)}deg) scale(${cam.s.toFixed(4)}) translate(${px(-cam.fx)}, ${px(-cam.fy)})`
      : `translate(${px(cam.X)}, ${px(cam.Y)}) scale(${cam.s.toFixed(4)}) translate(${px(-cam.fx)}, ${px(-cam.fy)})`,
  });
  renderChat(t);
  renderLeftPanel(t);
}

function renderLeftPanel(t) {
  // dialect
  const dOut = ep(t, ...K.dialectOut, ease.inCubic);
  const dOn = t > K.dialectTitle - 0.05 && t < K.dialectOut[1] + 0.05;
  if (show(dTitle, dOn)) {
    css(dTitle, { top: px(LY.lp.dTitle) });
    rise(dTitle, ep(t, K.dialectTitle, K.dialectTitle + 0.65, ease.outCubic) * (1 - dOut), { y: 30, blur: 12 });
  }
  if (show(dGloss, dOn)) {
    css(dGloss, { top: px(LY.lp.dGloss), opacity: (1 - dOut).toFixed(3), filter: dOut > 0 ? `blur(${(dOut * 10).toFixed(2)}px)` : 'none' });
    glossChips.forEach((chip, i) => {
      const a = K.glossary[i];
      const k = springStep(prog(t, a, a + 0.7), { damping: 0.5, freq: 1.7 });
      const o = ep(t, a, a + 0.18);
      css(chip, { opacity: o.toFixed(3), transform: `translate3d(0, ${((1 - k) * 22).toFixed(2)}px, 0) scale(${lerp(0.82, 1, k).toFixed(4)})` });
    });
  }

  // offline
  const oOut = ep(t, 37.7, 38.15, ease.inCubic);
  const oOn = t >= K.wifiCard[0] - 0.05 && t < 38.2;
  if (show(wifi, oOn)) {
    const k = springStep(prog(t, K.wifiCard[0], K.wifiCard[0] + 0.8), { damping: 0.55, freq: 1.6 });
    const lift = ep(t, K.offline1 - 0.1, K.offline1 + 0.5, ease.inOutCubic);
    css(wifi, {
      top: px(lerp(LY.lp.wifi[0], LY.lp.wifi[1], lift)),
      opacity: (ep(t, ...K.wifiCard) * (1 - oOut)).toFixed(3),
      transform: `translate3d(0, ${((1 - k) * 30).toFixed(2)}px, 0) scale(${lerp(0.9, 1, k).toFixed(4)})`,
      filter: oOut > 0 ? `blur(${(oOut * 10).toFixed(2)}px)` : 'none',
    });
    const off = ep(t, K.wifiOff, K.wifiOff + 0.22, ease.outBack);
    const offL = ep(t, K.wifiOff, K.wifiOff + 0.2);
    css(swKnob, { left: px(lerp(45, 5, off)) });
    css(swTrack, { opacity: (1 - offL).toFixed(3) });
    css(wifiOnIc, { opacity: (1 - offL).toFixed(3), transform: `scale(${lerp(1, 0.7, offL).toFixed(3)})` });
    css(wifiOffIc, { opacity: offL.toFixed(3), transform: `scale(${lerp(1.25, 1, offL).toFixed(3)})` });
    css(wifiIco, { background: offL > 0.5 ? '#efe6d6' : 'rgb(201 130 31 / 0.14)', color: offL > 0.5 ? '#6e6254' : '#c2541a' });
    const sk = ep(t, K.wifiOff + 0.05, K.wifiOff + 0.3);
    css(sOn, { opacity: (1 - sk).toFixed(3), transform: `translate3d(0, ${(-10 * sk).toFixed(2)}px, 0)` });
    css(sOff, { opacity: sk.toFixed(3), transform: `translate3d(0, ${(10 * (1 - sk)).toFixed(2)}px, 0)` });
  }
  const swap = ep(t, K.offline2, K.offline2 + 0.35, ease.inCubic);
  if (show(oTitle1, oOn && t >= K.offline1 - 0.05 && swap < 1)) {
    css(oTitle1, { top: px(LY.lp.oTitle) });
    rise(oTitle1, ep(t, K.offline1, K.offline1 + 0.6, ease.outCubic) * (1 - swap), { y: 30, blur: 12 });
  }
  if (show(oTitle2, oOn && t >= K.offline2 + 0.1)) {
    css(oTitle2, { top: px(LY.lp.oTitle) });
    rise(oTitle2, ep(t, K.offline2 + 0.15, K.offline2 + 0.75, ease.outCubic) * (1 - oOut), { y: 30, blur: 12 });
  }
  if (show(zero, oOn && t >= K.zeroBytes - 0.05)) {
    const k = springStep(prog(t, K.zeroBytes, K.zeroBytes + 0.7), { damping: 0.55, freq: 1.7 });
    if (VERT) css(zero, { right: 'auto', left: px((SW - zero.offsetWidth) / 2) });
    css(zero, { top: px(LY.lp.zero), opacity: (ep(t, K.zeroBytes, K.zeroBytes + 0.2) * (1 - oOut)).toFixed(3), transform: `translate3d(0, ${((1 - k) * 16).toFixed(2)}px, 0) scale(${lerp(0.85, 1, k).toFixed(4)})` });
  }
}

// =====================================================================================================
// scene: PRIVACY 39.4–48 s
// =====================================================================================================
const SHIELD_PATH = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';
const CHECK_PATH = 'm9 12 2 2 4-4';
const privacy = layer('privacy');
privacy.innerHTML = '<div class="night-bg"></div>';
const dustB = canvasLayer(privacy);
const pvAura = h('div', { class: 'aura' });
const pvRing = h('div', { class: 'ring' });
const pvTitle = h('div', { class: 'pv-title' }, TXT.privacyTitle);
const pvSub = h('div', { class: 'pv-sub' }, `<span class="ar">${TXT.privacySub}</span><span class="la">${TXT.privacyEn}</span>`);
const pvGrid = h('div', { class: 'promises4' }, TXT.promises.map(([ic, ar, en]) => `
  <div class="pr"><div class="pr-top"><div class="pr-ico">${icon(ic)}</div>
  <svg class="pr-check" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="rgb(127 166 80 / 0.16)" stroke="#9cc56c" stroke-width="2" pathLength="1" stroke-dasharray="1" class="cc"/><path d="M10.5 17.5l4.5 4.5 8.5-9" fill="none" stroke="#9cc56c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" class="ck"/></svg></div>
  <div class="ar">${ar}</div><div class="la">${en}</div></div>`).join(''));
privacy.append(pvAura, pvRing, pvTitle, pvSub, pvGrid);
const prCards = [...pvGrid.children];
const pvSubAr = $(pvSub, '.ar');
const pvSubLa = $(pvSub, '.la');

// flying shield (from the sidebar pill to the privacy hero)
const flyShield = layer('flyShield', 'abs');
flyShield.style.zIndex = 70;
flyShield.innerHTML = `<svg class="shield-big" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
  <defs><linearGradient id="shg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD66E"/><stop offset="0.55" stop-color="#F2B33D"/><stop offset="1" stop-color="#E8742C"/></linearGradient>
  <filter id="shf" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="0.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <path class="sh-fill" d="${SHIELD_PATH}" fill="rgb(242 179 61 / 0.08)" stroke="none"/>
  <path class="sh-green" d="${SHIELD_PATH}" stroke="#4f6b2f" stroke-width="2"/>
  <path class="sh-gold" d="${SHIELD_PATH}" stroke="url(#shg)" stroke-width="1.4" filter="url(#shf)"/>
  <path class="ck-green" d="${CHECK_PATH}" stroke="#4f6b2f" stroke-width="2"/>
  <path class="ck-gold" d="${CHECK_PATH}" stroke="#9cc56c" stroke-width="1.6" pathLength="1" stroke-dasharray="1" filter="url(#shf)"/>
</svg>`;
const shSvg = $(flyShield, 'svg');
const shGreen = $(flyShield, '.sh-green');
const shGold = $(flyShield, '.sh-gold');
const shFill = $(flyShield, '.sh-fill');
const ckGreen = $(flyShield, '.ck-green');
const ckGold = $(flyShield, '.ck-gold');
const SHIELD_FINAL = LY.shield;

function renderPrivacy(t) {
  const on = show(privacy, t >= K.dive[1] - 0.32 && t < K.wipe[1] + 0.1);
  const fs = t >= K.dive[0] + 0.6 && t < K.privacyOut[1] + 0.1;
  show(flyShield, fs);
  if (fs) {
    // lock onto the pill icon while the camera dives, then fly to the hero position
    const pr = srect(A.pillIcon);
    const k = ep(t, K.dive[0] + 0.6, K.dive[1] + 0.2, ease.inOutCubic);
    const S = lerp(pr.w, SHIELD_FINAL.S, k);
    const cx = lerp(pr.cx, SHIELD_FINAL.cx, k);
    const cy = lerp(pr.cy, SHIELD_FINAL.cy, k);
    const out = ep(t, ...K.privacyOut, ease.inCubic);
    css(shSvg, { left: px(cx - S / 2), top: px(cy - S / 2), width: px(S), height: px(S), opacity: (1 - out).toFixed(3), transform: `translate3d(0, ${(-20 * out).toFixed(2)}px, 0)` });
    const gold = ep(t, K.dive[1] - 0.45, K.dive[1] + 0.05);
    css(shGreen, { opacity: (1 - gold).toFixed(3) });
    css(ckGreen, { opacity: (1 - gold).toFixed(3) });
    css(shGold, { opacity: gold.toFixed(3) });
    css(shFill, { opacity: gold.toFixed(3) });
    const ck = ep(t, K.shieldLock - 0.3, K.shieldLock, ease.inOutCubic);
    css(ckGold, { strokeDashoffset: (1 - ck).toFixed(4), opacity: gold.toFixed(3) });
    // lock pulse
    const pulse = env(t, K.shieldLock, K.shieldLock + 0.08, K.shieldLock + 0.12, K.shieldLock + 0.6);
    css(shSvg, { filter: pulse > 0 ? `drop-shadow(0 0 ${(30 * pulse).toFixed(1)}px rgb(242 179 61 / ${(0.8 * pulse).toFixed(3)}))` : 'none' });
  }
  if (!on) return;
  css(privacy, { opacity: ep(t, K.dive[1] - 0.3, K.dive[1] + 0.1).toFixed(3) });
  css(pvGrid, { transform: `scale(${(1 + 0.015 * ep(t, 41, 46.4, ease.inOutQuad)).toFixed(4)})` });
  const out = ep(t, ...K.privacyOut, ease.inCubic);
  drawDust(DUST, dustB, t, 1 - out * 0.5);
  // aura + ring around the shield
  const { cx, cy, S } = SHIELD_FINAL;
  const ak = ep(t, K.dive[1] - 0.2, K.dive[1] + 0.6) * (1 - out);
  const AS = S * (2.6 + 0.08 * Math.sin(t * 1.7));
  css(pvAura, { left: px(cx - AS / 2), top: px(cy - AS / 2), width: px(AS), height: px(AS), opacity: (ak * 0.75).toFixed(3) });
  const rk = prog(t, K.shieldLock, K.shieldLock + 0.9);
  const RS = S * (0.9 + 1.5 * ease.outCubic(rk));
  const ro = rk > 0 && rk < 1 ? (1 - rk) * 0.8 : 0;
  css(pvRing, { left: px(cx - RS / 2), top: px(cy - RS / 2), width: px(RS), height: px(RS), opacity: ro.toFixed(3), visibility: ro > 0 ? 'visible' : 'hidden' });

  css(pvTitle, { top: px(LY.pv.title) });
  rise(pvTitle, ep(t, K.privacyTitle, K.privacyTitle + 0.65, ease.outCubic) * (1 - out), { y: 30, blur: 12 });
  css(pvSub, { top: px(LY.pv.sub) });
  rise(pvSubAr, ep(t, K.privacyTitle + 0.2, K.privacyTitle + 0.85, ease.outCubic) * (1 - out), { y: 20, blur: 10 });
  rise(pvSubLa, ep(t, K.privacyTitle + 0.38, K.privacyTitle + 1.0, ease.outCubic) * (1 - out), { y: 14, blur: 8 });
  css(pvGrid, { top: px(LY.pv.grid) });
  prCards.forEach((card, i) => {
    const a = K.promises[i];
    const k = springStep(prog(t, a, a + 0.8), { damping: 0.55, freq: 1.6 });
    const o = ep(t, a, a + 0.2) * (1 - out);
    css(card, { opacity: o.toFixed(3), transform: `translate3d(0, ${((1 - k) * 34).toFixed(2)}px, 0) scale(${lerp(0.9, 1, k).toFixed(4)})`, filter: out > 0 ? `blur(${(out * 8).toFixed(2)}px)` : 'none' });
    css($(card, '.cc'), { strokeDashoffset: (1 - ep(t, a + 0.05, a + 0.35, ease.inOutCubic)).toFixed(4) });
    css($(card, '.ck'), { strokeDashoffset: (1 - ep(t, a + 0.18, a + 0.42, ease.inOutCubic)).toFixed(4) });
  });
}

// =====================================================================================================
// scene: FEATURES (bento) 47–56 s
// =====================================================================================================
const features = layer('features');
features.innerHTML = '<div class="parch-bg"></div>';
const fHead = h('div', { class: 'f-head' }, `<span class="ar">${TXT.featuresTitle}</span><span class="la">${TXT.featuresEn}</span>`);
const PHOTO_SVG = `<svg viewBox="0 0 360 214" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2340"/><stop offset="0.38" stop-color="#c8573a"/><stop offset="0.72" stop-color="#f29a45"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4c9"/><stop offset="0.55" stop-color="#ffd66e"/><stop offset="1" stop-color="#ffd66e" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="360" height="214" fill="url(#sky)"/>
  <circle cx="242" cy="128" r="60" fill="url(#sun)" opacity="0.65"/>
  <circle cx="242" cy="128" r="26" fill="#fff0bd"/>
  <path d="M0 150 Q60 120 130 142 T260 136 T360 128 V214 H0Z" fill="#b8562c"/>
  <path d="M0 176 Q80 150 170 170 T360 160 V214 H0Z" fill="#8a3e1f"/>
  <path d="M0 196 Q110 178 220 194 T360 188 V214 H0Z" fill="#5e2a16"/>
  <g fill="#2a140c">
    <path d="M92 186 C96 150 100 112 112 82 L116 84 C106 114 102 150 100 186 Z"/>
    <path d="M114 82 C96 70 74 72 58 84 C78 78 96 80 112 88Z"/>
    <path d="M114 82 C102 62 84 54 66 56 C84 64 100 72 112 86Z"/>
    <path d="M114 82 C124 62 142 54 162 58 C142 64 128 72 116 86Z"/>
    <path d="M114 82 C132 72 154 74 168 88 C150 82 132 82 116 88Z"/>
    <path d="M114 82 C112 66 116 52 126 44 C122 58 120 70 116 84Z"/>
  </g>
</svg>`;
const bento = h('div', { class: 'bento' }, `
  <div class="card c-img"><div class="ico-badge">${icon('scan-eye')}</div><h4>يشوف الصور</h4><div class="sub">Understands the photos you attach</div>
    <div class="photo">${PHOTO_SVG}<div class="scanglow"></div><div class="scanline"></div>
      <div class="det d1" style="left:52px;top:40px;width:122px;height:150px"><span>نخلة</span></div>
      <div class="det d2" style="left:206px;top:94px;width:72px;height:68px"><span>غروب</span></div>
      <div class="det d3" style="left:190px;top:150px;width:160px;height:56px"><span>كثبان</span></div>
    </div>
    <div class="vbubble"><div class="av">${logoTile(34)}</div><div class="vtext" data-k="vtext"></div></div>
  </div>
  <div class="card c-dia"><div class="ico-badge">${icon('languages')}</div><h4>ليبي، فصحى، أو English</h4><div class="sub">Libyan · Modern Standard · English</div>
    <div class="seg-wrap"><div class="seg" role="radiogroup"><div class="seg-thumb"></div>
      <button class="seg-item" aria-checked="true">ليبي</button><button class="seg-item">فصحى</button><button class="seg-item">English</button></div></div>
    <div class="dia-lines">
      <div class="ar l0"><span class="av">${logoTile(34)}</span>شن نقدر نعاونك فيه اليوم؟</div>
      <div class="ar l1"><span class="av">${logoTile(34)}</span>بماذا يمكنني مساعدتك اليوم؟</div>
      <div class="la l2"><span class="av">${logoTile(34)}</span>How can I help you today?</div>
    </div>
  </div>
  <div class="card c-mdl"><div class="ico-badge">${icon('memory-stick')}</div><h4>نموذج على قد جهازك</h4><div class="sub">A model for every machine</div>
    <div class="tiers">
      <div class="tier"><div class="tier-top"><span class="tier-name">ريكو لايت</span><span class="tier-ram">8 GB RAM</span></div><div class="tier-desc">خفيف وسريع، لأغلب الأجهزة</div><div class="tier-bar"><i></i></div></div>
      <div class="tier"><span class="rec-badge">★ موصى به لجهازك</span><div class="tier-top"><span class="tier-name">ريكو</span><span class="tier-ram">16 GB RAM</span></div><div class="tier-desc">التوازن الأفضل بين الجودة والسرعة</div><div class="tier-bar"><i></i></div></div>
      <div class="tier"><div class="tier-top"><span class="tier-name">ريكو ماكس</span><span class="tier-ram">32 GB+ RAM</span></div><div class="tier-desc">أقوى نسخة، للأجهزة القوية</div><div class="tier-bar"><i></i></div></div>
    </div>
    <div class="mdl-foot">${icon('eye')}<span>الثلاثة يشوفوا الصور · تحميل مرة وحدة بس</span></div>
  </div>
  <div class="card c-eco"><div class="ico-badge">${icon('gauge')}</div><h4>خفيف على جهازك</h4><div class="sub">Eco mode keeps your PC smooth</div>
    <div class="gauge"><svg viewBox="0 0 250 140"><path d="M20 128 A105 105 0 0 1 230 128" fill="none" stroke="#e6dbc6" stroke-width="18" stroke-linecap="round"/>
      <path class="g-arc" d="M20 128 A105 105 0 0 1 230 128" fill="none" stroke="url(#gg)" stroke-width="18" stroke-linecap="round" pathLength="1" stroke-dasharray="1"/>
      <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fa650"/><stop offset="1" stop-color="#f2b33d"/></linearGradient></defs></svg>
      <div class="gauge-val">اقتصادي<small data-k="cpu">CPU 0%</small></div></div>
  </div>
  <div class="card c-thm"><div class="thm-toggle">${icon('sun', 'sun')}${icon('moon', 'moon')}</div><h4>داكن وفاتح</h4><div class="sub">Dark &amp; light themes</div>
    <div class="mini theme-light"><div class="mini-main"><div class="ub"></div><div class="ln m"></div><div class="ln s"></div><div class="comp"></div></div><div class="mini-side"><i class="p"></i><i></i><i></i><i></i></div></div>
    <div class="mini theme-dark"><div class="mini-main"><div class="ub"></div><div class="ln m"></div><div class="ln s"></div><div class="comp"></div></div><div class="mini-side"><i class="p"></i><i></i><i></i><i></i></div></div>
  </div>
  <div class="card c-os"><div class="ico-badge">${icon('laptop')}</div><h4>على كل الأجهزة</h4><div class="sub">Windows · macOS · Linux</div>
    <div class="os-row"><div class="os-pill"><span>Windows</span>${icon('circle-check')}</div><div class="os-pill"><span>macOS</span>${icon('circle-check')}</div><div class="os-pill"><span>Linux</span>${icon('circle-check')}</div></div>
  </div>`);
features.append(fHead, bento);
const wipeEdge = h('div', { class: 'wipe-edge' });
stage.appendChild(wipeEdge);
const cards = [...bento.children];
const F = {
  scanline: $(bento, '.scanline'),
  scanglow: $(bento, '.scanglow'),
  dets: [...bento.querySelectorAll('.det')],
  vtext: $(bento, '[data-k="vtext"]'),
  segThumb: $(bento, '.seg-thumb'),
  segItems: [...bento.querySelectorAll('.seg-item')],
  diaLines: [...bento.querySelectorAll('.dia-lines > div')],
  tiers: [...bento.querySelectorAll('.tier')],
  bars: [...bento.querySelectorAll('.tier-bar i')],
  rec: $(bento, '.rec-badge'),
  arc: $(bento, '.g-arc'),
  cpu: $(bento, '[data-k="cpu"]'),
  minis: [...bento.querySelectorAll('.mini')],
  sun: $(bento, '.thm-toggle .sun'),
  moon: $(bento, '.thm-toggle .moon'),
  osPills: [...bento.querySelectorAll('.os-pill')],
  fHeadAr: $(fHead, '.ar'),
  fHeadLa: $(fHead, '.la'),
};
const VISION_TEXT = 'صورة غروب في الصحراء: نخلة وكثبان رملية، والسما برتقالية.';
const VISION_TOK = VISION_TEXT.match(/\s*\S+/g);

function renderFeatures(t) {
  const on = t >= K.wipe[0] && t < 56.1;
  if (!show(features, on)) {
    show(wipeEdge, false);
    return;
  }
  const wk = ep(t, ...K.wipe, ease.inOutCubic);
  const X = SW * (1 - wk);
  css(features, { clipPath: wk < 1 ? `inset(0 0 0 ${X.toFixed(1)}px)` : 'none' });
  if (show(wipeEdge, wk > 0 && wk < 1)) css(wipeEdge, { left: px(X) });

  const out = ep(t, ...K.featuresOut, ease.inCubic);
  rise(F.fHeadAr, ep(t, K.featuresTitle, K.featuresTitle + 0.6, ease.outCubic) * (1 - out), { y: 24, blur: 10 });
  rise(F.fHeadLa, ep(t, K.featuresTitle + 0.2, K.featuresTitle + 0.8, ease.outCubic) * (1 - out), { y: 12, blur: 8 });
  cards.forEach((card, i) => {
    const a = K.cards[i];
    const k = springStep(prog(t, a, a + 0.85), { damping: 0.55, freq: 1.5 });
    const o = ep(t, a, a + 0.22);
    // exit: everything is pulled toward the centre where the outro logo blooms
    const r = card.__home ?? (card.__home = { x: card.offsetLeft + card.offsetWidth / 2 + bento.offsetLeft, y: card.offsetTop + card.offsetHeight / 2 + bento.offsetTop });
    const dx = (SW / 2 - r.x) * out * 0.85;
    const dy = (SH / 2 - r.y) * out * 0.85;
    css(card, {
      opacity: (o * (1 - out)).toFixed(3),
      transform: `translate3d(${dx.toFixed(2)}px, ${((1 - k) * 46 + dy).toFixed(2)}px, 0) scale(${(lerp(0.88, 1, k) * (1 - 0.5 * out)).toFixed(4)})`,
      filter: out > 0 ? `blur(${(out * 6).toFixed(2)}px)` : 'none',
    });
  });

  // vision: scan, detections, Rico's description
  const sk = prog(t, ...K.scan);
  const scanOn = sk > 0 && sk < 1;
  vis(F.scanline, scanOn ? 1 : 0);
  vis(F.scanglow, scanOn ? 1 : 0);
  css(F.scanline, { top: px(lerp(-4, 214, ease.inOutQuad(sk))) });
  css(F.scanglow, { top: px(lerp(-64, 154, ease.inOutQuad(sk))) });
  F.dets.forEach((d, i) => {
    const a = K.scan[0] + 0.55 + i * 0.25;
    const k = springStep(prog(t, a, a + 0.6), { damping: 0.5, freq: 1.8 });
    css(d, { opacity: ep(t, a, a + 0.15).toFixed(3), transform: `scale(${lerp(1.25, 1, k).toFixed(4)})` });
  });
  let vn = 0;
  const vt0 = K.visionText[0];
  const vdt = (K.visionText[1] - vt0) / VISION_TOK.length;
  while (vn < VISION_TOK.length && vt0 + vn * vdt <= t) vn++;
  setHTML(F.vtext, VISION_TOK.slice(0, vn).join('') + (vn > 0 && vn < VISION_TOK.length ? '<span class="stream-caret"></span>' : ''));

  // dialect segmented control
  const idx = (tt) => (tt < K.dialectSwitch[0] ? 0 : tt < K.dialectSwitch[1] ? 1 : tt < K.dialectSwitch[2] ? 2 : 0);
  const cur = idx(t);
  const lastSw = [...K.dialectSwitch].reverse().find((x) => x <= t) ?? -1;
  const prev = lastSw > 0 ? idx(lastSw - 0.01) : cur;
  const sk2 = lastSw > 0 ? ep(t, lastSw, lastSw + 0.38, ease.outBack) : 1;
  const segR = F.segItems.map((b) => ({ x: b.offsetLeft, w: b.offsetWidth }));
  const ra = segR[prev];
  const rb = segR[cur];
  css(F.segThumb, { left: px(lerp(ra.x, rb.x, sk2)), width: px(lerp(ra.w, rb.w, clamp(sk2))) });
  F.segItems.forEach((b, i) => css(b, { color: i === cur ? 'var(--text)' : 'var(--muted)' }));
  const lk = lastSw > 0 ? ep(t, lastSw, lastSw + 0.42, ease.inOutCubic) : 1;
  F.diaLines.forEach((ln, i) => {
    let o = 0;
    if (i === cur) o = lk;
    else if (i === prev && cur !== prev) o = 1 - lk;
    css(ln, { opacity: o.toFixed(3), filter: o < 1 && o > 0 ? `blur(${((1 - o) * 8).toFixed(2)}px)` : 'none', transform: `translate3d(0, ${(i === cur ? (1 - lk) * 14 : -(1 - o) * 14).toFixed(2)}px, 0)` });
  });

  // model tiers + RAM bars + recommendation
  F.tiers.forEach((tr, i) => {
    const a = K.tiers[i];
    const k = ease.app(prog(t, a, a + 0.45));
    css(tr, { opacity: k.toFixed(3), transform: `translate3d(0, ${((1 - k) * 18).toFixed(2)}px, 0)` });
    const fill = ep(t, K.ramFill[0] + i * 0.15, K.ramFill[1] + i * 0.15, ease.inOutCubic) * [0.25, 0.5, 1][i];
    css(F.bars[i], { width: `${(fill * 100).toFixed(2)}%` });
  });
  const rec = t >= K.recommended;
  F.tiers[1].setAttribute('data-rec', String(rec));
  const rk = springStep(prog(t, K.recommended, K.recommended + 0.6), { damping: 0.45, freq: 1.8 });
  css(F.rec, { opacity: ep(t, K.recommended, K.recommended + 0.15).toFixed(3), transform: `scale(${lerp(0.6, 1, rk).toFixed(4)})` });

  // eco gauge
  const gk = ep(t, ...K.gauge, ease.inOutCubic);
  const cpu = 0.34 * gk + 0.015 * Math.sin(t * 3.1) * gk;
  css(F.arc, { strokeDashoffset: (1 - cpu).toFixed(4) });
  setText(F.cpu, `CPU ${Math.round(cpu * 100)}%`);

  // theme flip
  const flips = K.themeFlip.filter((x) => x <= t).length;
  const lastFlip = [...K.themeFlip].reverse().find((x) => x <= t);
  const fk = lastFlip !== undefined ? ep(t, lastFlip, lastFlip + 0.35, ease.inOutCubic) : 1;
  const darkNow = flips % 2 === 1;
  const darkO = darkNow ? fk : flips === 0 ? 0 : 1 - fk;
  // the dark mini-window wipes across like the app's theme switch (no muddy cross-fade)
  css(F.minis[1], { opacity: '1', clipPath: `inset(0 ${((1 - darkO) * 100).toFixed(2)}% 0 0 round 18px)` });
  css(F.sun, { opacity: (1 - darkO).toFixed(3), transform: `rotate(${(darkO * 90).toFixed(1)}deg) scale(${(1 - 0.4 * darkO).toFixed(3)})` });
  css(F.moon, { opacity: darkO.toFixed(3), transform: `rotate(${((1 - darkO) * -90).toFixed(1)}deg) scale(${(0.6 + 0.4 * darkO).toFixed(3)})` });

  // platforms
  F.osPills.forEach((p, i) => {
    const a = K.platforms[i];
    const k = springStep(prog(t, a, a + 0.6), { damping: 0.5, freq: 1.7 });
    css(p, { opacity: ep(t, a, a + 0.15).toFixed(3), transform: `translate3d(${((1 - k) * -24).toFixed(2)}px, 0, 0)` });
  });
}

// =====================================================================================================
// scene: OUTRO 55.3–64 s
// =====================================================================================================
const outro = layer('outro');
outro.innerHTML = '<div class="night-bg"></div>';
const dustC = canvasLayer(outro);
const sparksB = canvasLayer(outro);
const L2 = bigLogo(outro);
const oWord = h('div', { class: 'wordmark' }, `<span class="gold" style="display:inline-block">${TXT.word}</span>`);
const oTag = h('div', { class: 'tagline' }, `<span class="ar">${TXT.outroTag}</span><span class="la">${TXT.outroTagEn}</span>`);
const oCredit = h('div', { class: 'credit' }, `<span class="ar">${TXT.credit}</span><span class="la">${TXT.creditEn}</span>`);
const oCta = h('div', { class: 'cta' }, `<span class="btn-like">${icon('download')}${TXT.cta}</span><span class="url">${TXT.url}</span><span class="os">${TXT.platforms}</span>`);
outro.append(oWord, oTag, oCredit, oCta);
const oWordSpan = oWord.firstElementChild;
const OUT_LOGO = LY.outLogo;

function renderOutro(t) {
  if (!show(outro, t >= 55.25)) return;
  css(outro, { opacity: ep(t, 55.3, 55.95).toFixed(3), transform: `scale(${(1.04 - 0.04 * ep(t, 55.3, 64, ease.outQuad)).toFixed(4)})` });
  drawDust(DUST, dustC, t, 1, t > K.outroBloom - 0.1 && t < K.outroBloom + 2 ? { x: OUT_LOGO.cx, y: OUT_LOGO.cy, k: ep(t, K.outroBloom, K.outroBloom + 1, ease.outCubic) * (1 - ep(t, K.outroBloom + 0.6, K.outroBloom + 2.4)) } : null);
  const { cx, cy, S } = OUT_LOGO;
  placeLogo(L2, cx, cy, S);
  css(L2.trace, { opacity: '0' });
  const tk = ep(t, K.outroBloom - 0.04, K.outroBloom + 0.1);
  const ts = lerp(0.55, 1, springStep(prog(t, K.outroBloom - 0.04, K.outroBloom + 0.95), { damping: 0.48, freq: 1.8 }));
  css(L2.svg, { opacity: tk.toFixed(3), transform: `translate3d(0, ${(Math.sin((t - 56) * 1.9) * 3 * ep(t, 57, 57.6)).toFixed(2)}px, 0) scale(${ts.toFixed(4)})` });
  const hot = 1 - ep(t, K.outroBloom, K.outroBloom + 0.8, ease.outCubic);
  css(L2.fill, { filter: hot > 0.01 ? `brightness(${(1 + 1.4 * hot).toFixed(3)})` : 'none' });
  const sk = ep(t, 57.4, 58.3, ease.inOutCubic);
  L2.shine.setAttribute('x', lerp(-420, 1300, sk).toFixed(1));
  bloomFx(L2, t, K.outroBloom, cx, cy, S, { big: false });
  drawSparks(sparksB, t - K.outroBloom, cx, cy, 0.62, true, S * 0.36);

  const wk = ep(t, ...K.outroWord, ease.outCubic);
  css(oWord, { top: px(LY.out.word), fontSize: px(LY.out.wordSize) });
  css(oWordSpan, {
    clipPath: `inset(-30% 0 -30% ${((1 - wk) * 100).toFixed(2)}%)`,
    filter: wk < 1 ? `blur(${((1 - wk) * 10).toFixed(2)}px)` : 'none',
    transform: `scale(${lerp(0.94, 1, wk).toFixed(4)})`,
    opacity: wk > 0 ? '1' : '0',
  });
  css(oTag, { top: px(LY.out.tag) });
  rise($(oTag, '.ar'), ep(t, ...K.outroTag, ease.outCubic), { y: 18, blur: 10 });
  rise($(oTag, '.la'), ep(t, K.outroTag[0] + 0.22, K.outroTag[1] + 0.22, ease.outCubic), { y: 12, blur: 8 });
  css(oCredit, { top: px(LY.out.credit) });
  rise($(oCredit, '.ar'), ep(t, ...K.credit, ease.outCubic), { y: 14, blur: 8 });
  rise($(oCredit, '.la'), ep(t, K.credit[0] + 0.18, K.credit[1] + 0.18, ease.outCubic), { y: 10, blur: 6 });
  const ck = springStep(prog(t, K.cta[0], K.cta[0] + 0.8), { damping: 0.55, freq: 1.6 });
  css(oCta, { top: px(LY.out.cta), opacity: ep(t, K.cta[0], K.cta[0] + 0.25).toFixed(3), transform: `translate(-50%, ${((1 - ck) * 24).toFixed(2)}px) scale(${lerp(0.9, 1, ck).toFixed(4)})` });
}

// =====================================================================================================
// overlays: flying logo (night → app), reveal ring, cursor, grain, fade
// =====================================================================================================
const flyLogo = layer('flyLogo', 'abs');
flyLogo.style.zIndex = 70;
flyLogo.innerHTML = logoTile(100);
const flySvg = flyLogo.firstElementChild;
flySvg.style.position = 'absolute';
const flyAura = h('div', { class: 'aura' });
flyLogo.prepend(flyAura);
const revealRing = layer('revealRing', 'abs');
revealRing.innerHTML = '<div class="ring"></div>';
const rr = revealRing.firstElementChild;

function renderFly(t) {
  const on = show(flyLogo, t >= K.reveal[0] && t < K.reveal[1] + 0.02);
  if (on) {
    const k = ep(t, ...K.reveal, ease.inOutCubic);
    const target = srect($(A.heroMark, 'svg'));
    const S = lerp(LY.up.S, target.w, k);
    const cx = lerp(LY.up.cx, target.cx, k);
    const cy = lerp(LY.up.cy, target.cy, k);
    css(flySvg, { left: px(cx - S / 2), top: px(cy - S / 2), width: px(S), height: px(S) });
    const AS = S * 2.3;
    css(flyAura, { left: px(cx - AS / 2), top: px(cy - AS / 2), width: px(AS), height: px(AS), opacity: (0.9 * (1 - k * 0.6)).toFixed(3) });
  }
  const rk = ep(t, ...K.reveal, ease.inOutCubic);
  if (show(revealRing, rk > 0 && rk < 1)) {
    const R = rk * 2300;
    css(rr, { left: px(LY.up.cx - R), top: px(LY.up.cy - R), width: px(2 * R), height: px(2 * R), opacity: (0.85 * (1 - ep(t, K.reveal[0] + 0.5, K.reveal[1]))).toFixed(3) });
  }
}

// cursor -------------------------------------------------------------------------------------------
const cursor = h('div', { id: 'cursor' }, `<svg viewBox="0 0 30 30" width="30" height="30"><path d="M4 2.5 L4 24 L9.6 18.8 L13.4 27.2 L17.2 25.6 L13.5 17.4 L21 17.4 Z" fill="#fff" stroke="#1c1714" stroke-width="1.7" stroke-linejoin="round"/></svg>`);
const clickRing = h('div', { class: 'click-ring' });
stage.append(clickRing, cursor);
const at = (el, fx = 0.5, fy = 0.5) => () => {
  const r = srect(el);
  return { x: r.x + r.w * fx, y: r.y + r.h * fy };
};
const fixed = (x, y) => () => ({ x, y });
const offset = (fn, dx, dy) => () => {
  const p = fn();
  return { x: p.x + dx, y: p.y + dy };
};
// waypoints: { t, p: () => {x, y}, o: opacity } ; clicks listed separately
const PATH = [
  { t: K.cursorIn, p: offset(at(A.composer, 0.15, 0.5), -40, 170), o: 0 },
  { t: K.cursorIn + 0.2, p: offset(at(A.composer, 0.15, 0.5), -40, 150), o: 1 },
  { t: K.focusClick - 0.05, p: at(A.input, 0.45, 0.5), o: 1, e: ease.inOutCubic },
  { t: K.focusClick + 0.5, p: offset(at(A.input, 0.45, 0.5), -60, 70), o: 1, e: ease.inOutCubic },
  { t: K.sendClick - 0.5, p: offset(at(A.input, 0.45, 0.5), -60, 70), o: 1 },
  { t: K.sendClick - 0.05, p: at(A.send, 0.5, 0.5), o: 1, e: ease.inOutCubic },
  { t: K.sendClick + 0.6, p: offset(at(A.send, 0.5, 0.5), -90, 120), o: 1, e: ease.inOutCubic },
  { t: K.sendClick + 0.9, p: offset(at(A.send, 0.5, 0.5), -110, 150), o: 0 },
  // offline: toggle the Wi-Fi, open a new chat, pick the solar suggestion
  { t: K.wifiCursor[0], p: offset(at(wifi, 0.35, 1), 0, 120), o: 0 },
  { t: K.wifiCursor[0] + 0.2, p: offset(at(wifi, 0.35, 1), 0, 100), o: 1 },
  { t: K.wifiOff - 0.05, p: at(swKnob, 0.5, 0.5), o: 1, e: ease.inOutCubic },
  { t: K.wifiOff + 0.25, p: at(swKnob, 0.5, 0.5), o: 1 },
  { t: K.newChatClick - 0.05, p: at(A.newChat, 0.62, 0.5), o: 1, e: ease.inOutQuart },
  { t: K.chipClick - 0.05, p: at(A.chipEls[1], 0.5, 0.5), o: 1, e: ease.inOutQuart },
  { t: K.chipClick + 0.55, p: offset(at(A.chipEls[1], 0.5, 0.5), -60, 140), o: 1, e: ease.inOutCubic },
  { t: K.chipClick + 0.85, p: offset(at(A.chipEls[1], 0.5, 0.5), -70, 160), o: 0 },
];
const CLICKS = [K.focusClick, K.sendClick, K.wifiOff, K.newChatClick, K.chipClick];

function renderCursor(t) {
  const on = t >= PATH[0].t && t <= PATH[PATH.length - 1].t && !(t > PATH[7].t && t < PATH[8].t);
  if (!show(cursor, on)) {
    show(clickRing, false);
    return;
  }
  let i = 1;
  while (i < PATH.length - 1 && t > PATH[i].t) i++;
  const a = PATH[i - 1];
  const b = PATH[i];
  const k = (b.e ?? ease.inOutCubic)(prog(t, a.t, b.t));
  const pa = a.p();
  const pb = b.p();
  const x = lerp(pa.x, pb.x, k);
  const y = lerp(pa.y, pb.y, k);
  const o = lerp(a.o, b.o, prog(t, a.t, b.t));
  const cam = t < 30 ? camAt(t).s : 1;
  const cs = 1.15 * Math.max(1, cam * 0.95);
  const lastClick = CLICKS.filter((c) => c <= t + 0.03).pop();
  const press = lastClick !== undefined ? env(t, lastClick - 0.03, lastClick, lastClick + 0.05, lastClick + 0.18) : 0;
  css(cursor, { transform: `translate(${px(x - 4)}, ${px(y - 3)}) scale(${(cs * (1 - 0.14 * press)).toFixed(4)})`, opacity: o.toFixed(3) });
  const rk = lastClick !== undefined ? prog(t, lastClick, lastClick + 0.45) : 1;
  if (show(clickRing, rk > 0 && rk < 1)) {
    css(clickRing, { left: px(x), top: px(y), transform: `scale(${lerp(0.3, 1.25, ease.outCubic(rk)).toFixed(4)})`, opacity: ((1 - rk) * 0.9).toFixed(3) });
  }
}

// grain + fade -------------------------------------------------------------------------------------
const grain = h('div', { id: 'grain' });
const fadeEl = h('div', { id: 'fade' });
stage.append(grain, fadeEl);
(function makeGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grain.style.backgroundImage = `url(${c.toDataURL()})`;
})();
function renderGlobal(t) {
  const f = Math.round(t * FPS);
  const r = rng(f * 7 + 3);
  css(grain, { backgroundPosition: `${Math.floor(r() * 256)}px ${Math.floor(r() * 256)}px` });
  const fo = Math.max(1 - ep(t, 0, 0.6), ep(t, ...K.fadeOut, ease.inOutCubic));
  vis(fadeEl, fo);
}

// =====================================================================================================
// frame
// =====================================================================================================
function renderAt(t) {
  t = clamp(t, 0, DURATION - 1e-6);
  renderNight(t);
  renderApp(t);
  renderPrivacy(t);
  renderFeatures(t);
  renderOutro(t);
  renderFly(t);
  renderCursor(t);
  renderGlobal(t);
}

// =====================================================================================================
// boot: fonts, live preview loop / capture API
// =====================================================================================================
async function loadFonts() {
  const faces = ['400 40px "Aref Ruqaa"', '700 40px "Aref Ruqaa"', '400 20px Merienda', '700 20px Merienda', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, f.includes('Aref') ? 'ريكو' : 'Rico')));
  await document.fonts.ready;
}
function sizeHookLines() {
  // fix each hook line to its final width so the text types from a fixed right edge, centred overall
  for (const [R, s, hl] of [[R1, TXT.hook1, HOOK_HL[0]], [R2, TXT.hook2, HOOK_HL[1]]]) {
    R.line.style.width = 'auto';
    R.line.innerHTML = hookHTML(s, hl);
    const w = R.line.getBoundingClientRect().width / stageScale;
    R.line.style.width = `${Math.ceil(w + 4)}px`;
    R.line.innerHTML = '';
  }
}
function fit() {
  if (CAPTURE) return;
  stageScale = Math.min(window.innerWidth / SW, window.innerHeight / SH);
  stage.style.transform = `scale(${stageScale})`;
}

const ready = (async () => {
  await loadFonts();
  fit();
  sizeHookLines();
  renderAt(0);
})();

window.__promo = { ready, renderAt, DURATION, FPS };

if (!CAPTURE) {
  window.addEventListener('resize', () => {
    fit();
  });
  ready.then(() => {
    const audio = new Audio('soundtrack.m4a');
    audio.preload = 'auto';
    let playing = false;
    let clock = Number(params.get('t') ?? 0);
    let last = performance.now();
    const hint = h('div', { style: 'position:fixed;left:16px;bottom:14px;color:#a89c8c;font:14px Merienda,sans-serif;z-index:9;opacity:.85' }, 'Click / Space: play · ← →: seek');
    document.body.appendChild(hint);
    const toggle = () => {
      playing = !playing;
      if (playing) {
        if (clock >= DURATION - 0.05) clock = 0;
        audio.currentTime = clock;
        audio.play().catch(() => {});
      } else audio.pause();
      hint.style.opacity = playing ? '0' : '.85';
    };
    window.addEventListener('click', toggle);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') toggle();
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        clock = clamp(clock + (e.code === 'ArrowRight' ? 2 : -2), 0, DURATION);
        audio.currentTime = clock;
      }
    });
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playing) {
        clock = !audio.paused && audio.readyState >= 2 && Math.abs(audio.currentTime - clock) < 0.25 ? audio.currentTime : clock + dt;
        if (clock >= DURATION) {
          clock = DURATION;
          playing = false;
          audio.pause();
        }
      }
      renderAt(clock);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
