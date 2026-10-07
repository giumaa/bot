// Rico for Android — 32 s Reel. Every frame is renderAt(t) (pure), like promo.js.
import { DURATION, FPS, K, MARKS, REPLY_DINNER, REPLY_LIBYA, REPLY_PHOTO, STREAM, TOK, TXT, TYPE } from './reel-timeline.js';
import { typedCount } from './timeline.js';
import { clamp, css, ease, env, ep, h, lerp, prog, rise, rng, setHTML, setText, springStep, vis } from './lib.js';
import { icon } from './assets/icons.js';
import { logoTile, replyHTML } from './app-replica.js';
import { bigLogo, bloomFx, drawDust, drawSparks, makeDust, placeLogo } from './fx.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const stage = document.getElementById('stage');
const $ = (root, sel) => root.querySelector(sel);
const px = (v) => `${v.toFixed(2)}px`;
const SW = 1080;
const SH = 1920;
let stageScale = 1;

function layer(id, html = '', parent = stage) {
  const d = h('div', { id, class: 'layer' }, html);
  parent.appendChild(d);
  return d;
}
function show(el, on) {
  css(el, { display: on ? '' : 'none' });
  return on;
}
function canvas(parent) {
  const c = h('canvas', { class: 'fx', width: SW, height: SH });
  c.style.width = `${SW}px`;
  c.style.height = `${SH}px`;
  parent.appendChild(c);
  return c;
}
const DUST = makeDust(1920);
/** slam-in for a caption word: big → settle, blur → sharp */
function slam(el, t, t0, { from = 1.7, y = 0 } = {}) {
  const k = prog(t, t0, t0 + 0.34);
  const s = lerp(from, 1, ease.outBack(k, 1.4));
  const o = ep(t, t0, t0 + 0.08);
  css(el, {
    opacity: o.toFixed(3),
    visibility: o > 0 ? 'visible' : 'hidden',
    transform: `translate3d(0, ${((1 - ease.outCubic(k)) * y).toFixed(2)}px, 0) scale(${s.toFixed(4)})`,
    filter: k < 1 ? `blur(${((1 - k) * 14).toFixed(2)}px)` : 'none',
  });
}
const PHOTO = `<svg viewBox="0 0 360 214" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2340"/><stop offset="0.38" stop-color="#c8573a"/><stop offset="0.72" stop-color="#f29a45"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
  <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4c9"/><stop offset="0.55" stop-color="#ffd66e"/><stop offset="1" stop-color="#ffd66e" stop-opacity="0"/></radialGradient></defs>
  <rect width="360" height="214" fill="url(#sky)"/><circle cx="242" cy="128" r="60" fill="url(#sun)" opacity="0.65"/><circle cx="242" cy="128" r="26" fill="#fff0bd"/>
  <path d="M0 150 Q60 120 130 142 T260 136 T360 128 V214 H0Z" fill="#b8562c"/><path d="M0 176 Q80 150 170 170 T360 160 V214 H0Z" fill="#8a3e1f"/><path d="M0 196 Q110 178 220 194 T360 188 V214 H0Z" fill="#5e2a16"/>
  <g fill="#2a140c"><path d="M92 186 C96 150 100 112 112 82 L116 84 C106 114 102 150 100 186 Z"/><path d="M114 82 C96 70 74 72 58 84 C78 78 96 80 112 88Z"/><path d="M114 82 C102 62 84 54 66 56 C84 64 100 72 112 86Z"/><path d="M114 82 C124 62 142 54 162 58 C142 64 128 72 116 86Z"/><path d="M114 82 C132 72 154 74 168 88 C150 82 132 82 116 88Z"/><path d="M114 82 C112 66 116 52 126 44 C122 58 120 70 116 84Z"/></g></svg>`;
const PHOTO_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PHOTO)}`;

// =====================================================================================================
// backgrounds
// =====================================================================================================
const night = layer('night', '<div class="night-bg"></div>');
const dust = canvas(night);
const light = layer('light', '<div class="parch-bg"></div>');

// =====================================================================================================
// the phone (Android, the app's real markup + android.css)
// =====================================================================================================
const phoneLayer = layer('phoneLayer');
const phone = h('div', { class: 'phone' }, `
  <div class="btn-side" style="top:170px;height:70px"></div><div class="btn-side" style="top:270px;height:110px"></div>
  <div class="scr">
    <div class="sbar"><span>10:24</span><span class="ics">
      <span class="ic-wrap" data-k="plane">${icon('plane')}</span>
      <span class="ic-wrap" data-k="sig">${icon('signal')}</span>
      <span class="ic-wrap" data-k="wifi">${icon('wifi')}</span>
      <span class="ic-wrap">${icon('battery-full')}</span></span></div>
    <div class="punch"></div>
    <div class="app-host">
      <div class="app" data-sidebar="closed">
        <div class="app-bg"></div>
        <aside class="sidebar"></aside>
        <main class="main">
          <header class="main-header">
            <div style="display:flex;align-items:center;gap:2px">
              <button type="button" class="icon-btn">${icon('panel-left-open', 'flip-rtl')}</button>
              <div class="header-brand" data-k="brand">${logoTile(28)}</div>
            </div>
            <div style="display:flex;align-items:center;gap:2px">
              <button type="button" class="model-pill"><span class="status-dot" data-state="ready"></span><span class="model-pill-label">ريكو ميني</span></button>
              <button type="button" class="icon-btn">${icon('moon')}</button>
            </div>
          </header>
          <div class="chat-wrap"><div class="chat-scroll">
            <div class="hero" data-k="hero">
              <div class="hero-mark">${logoTile(84)}</div>
              <h1 class="hero-title">أهلاً، أنا <b>ريكو</b></h1>
              <p class="hero-sub">شن نقدر نعاونك فيه اليوم؟</p>
              <div class="hero-chips">
                ${['شن نطيبوا اليوم للعشاء؟', 'فسرلي كيف تخدم الطاقة الشمسية', 'عاوني نكتب رسالة لخدمتي', 'شن أحسن أماكن نزوروها في ليبيا؟'].map((c) => `<button type="button" class="chip">${icon('sparkles')}<span>${c}</span></button>`).join('')}
              </div>
            </div>
            <div class="chat-col" data-k="col">
              <article class="msg msg-user" data-script="ar" data-k="mUser">
                <div class="msg-images" data-count="1" data-k="mImg"><span class="msg-image"><img src="${PHOTO_URL}" alt=""></span></div>
                <div class="msg-bubble" dir="auto" data-k="mUserText"></div>
              </article>
              <article class="msg msg-assistant" data-script="ar" data-k="mBot">
                <div class="msg-avatar">${logoTile(32)}</div>
                <div class="msg-body" style="position:relative">
                  <div class="typing" data-k="typing"><span class="typing-dots"><i></i><i></i><i></i></span><span>ريكو يفكّر…</span></div>
                  <div class="md" dir="auto" data-k="md"></div>
                  <div class="tip" data-k="tip">${MARKS.tahbel}<small>بالفصحى</small></div>
                </div>
              </article>
            </div>
          </div></div>
          <div class="composer-wrap">
            <div class="composer" data-k="composer">
              <ul class="attach-strip" data-k="strip"><li class="attach-thumb"><img src="${PHOTO_URL}" alt=""></li></ul>
              <div class="composer-row">
                <button type="button" class="attach-btn" data-k="attach">${icon('image-plus')}</button>
                <div class="composer-input" dir="rtl" data-k="input"></div>
                <button type="button" class="send-btn" data-k="send" disabled>${icon('arrow-up')}</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
    <div class="qs" data-k="qs"><div class="qs-ic"><i class="on" data-k="qsOn"></i>${icon('plane')}</div>
      <div style="flex:1"><div class="qs-t">${TXT.airplane}</div><div class="qs-s"><span data-k="qsOff">مطفي</span><span data-k="qsOnTxt">شغّال · ما فيش إنترنت</span></div></div>
      <div class="switch" style="width:74px;height:42px"><div class="on-track" data-k="qsTrack"></div><div class="knob" data-k="qsKnob" style="width:34px;height:34px;top:4px"></div></div></div>
    <div class="viewfinder" data-k="vf"><svg class="photo-live" viewBox="0 0 360 214" preserveAspectRatio="xMidYMid slice">${PHOTO.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg><div class="vf-corners"></div><div class="vf-btn"><i></i></div></div>
    <div class="glitch" data-k="glitch"></div>
    <div class="scr-flash" data-k="flash"></div>
    <div class="tap" data-k="tap"></div>
  </div>`);
phoneLayer.appendChild(phone);
const P = {};
phone.querySelectorAll('[data-k]').forEach((n) => (P[n.getAttribute('data-k')] = n));
P.dots = [...P.typing.querySelectorAll('i')];
P.planeIc = P.plane;
P.glitchBars = Array.from({ length: 7 }, () => {
  const b = document.createElement('i');
  P.glitch.appendChild(b);
  return b;
});
// offsets inside the phone (layout coords; ignores the phone's transform)
function ppos(el, fx = 0.5, fy = 0.5) {
  let x = 0;
  let y = 0;
  let n = el;
  while (n && n !== phone) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent;
  }
  return { x: x + el.offsetWidth * fx, y: y + el.offsetHeight * fy };
}
// inside .scr coordinates for the tap ripple
function spos(el, fx = 0.5, fy = 0.5) {
  const p = ppos(el, fx, fy);
  return { x: p.x - 11, y: p.y - 11 };
}

// ---- phone camera: point o (phone coords) placed at stage (x, y), scale s, rotation r ---------------
const MID = () => ({ x: 220, y: 460 });
const BRAND = () => ppos(P.brand.firstElementChild);
const CHAT = (y) => () => ({ x: 220, y });
const PK = [
  { t: 0.0, x: 540, y: 1720, s: 0.92, r: -16, o: MID, a: 1 },
  { t: 0.5, x: 540, y: 1150, s: 1.22, r: -3, o: MID, a: 1, e: (k) => springStep(k, { damping: 0.5, freq: 1.4 }) },
  { t: 2.0, x: 540, y: 1135, s: 1.24, r: 0, o: MID, a: 1, e: ease.inOutCubic },
  { t: K.zoomOut[0], x: 540, y: 1130, s: 1.26, r: 0, o: MID, a: 1, e: ease.inOutQuad },
  { t: K.zoomOut[1], x: 540, y: 800, s: 11, r: 0, o: BRAND, a: 1, e: ease.inExpo, log: true },
  { t: K.light[0] - 0.01, x: 540, y: 1620, s: 1.05, r: 6, o: MID, a: 0, cut: true },
  { t: 6.05, x: 540, y: 1200, s: 1.2, r: 0, o: MID, a: 1, e: ease.outCubic },
  { t: 7.6, x: 540, y: 1185, s: 1.22, r: 0, o: MID, a: 1, e: ease.inOutQuad },
  { t: 8.3, x: 540, y: 980, s: 1.85, r: 0, o: CHAT(250), a: 1, e: ease.inOutQuart, log: true },
  { t: 10.6, x: 540, y: 990, s: 1.9, r: 0, o: CHAT(250), a: 1, e: ease.inOutQuad, log: true },
  { t: 11.0, x: 540, y: 1000, s: 2.0, r: 0, o: CHAT(230), a: 1, e: ease.inOutCubic, log: true },
  { t: K.slideDown[0], x: 540, y: 1000, s: 2.0, r: 0, o: CHAT(230), a: 1 },
  { t: K.slideDown[1], x: 540, y: 1480, s: 1.0, r: -2, o: MID, a: 1, e: ease.inOutQuart, log: true },
  { t: 15.6, x: 540, y: 1470, s: 1.02, r: 2, o: MID, a: 1, e: ease.inOutQuad },
  { t: 16.05, x: 540, y: 1190, s: 1.2, r: 0, o: MID, a: 1, e: ease.inOutCubic },
  { t: 17.1, x: 540, y: 1190, s: 1.22, r: 0, o: MID, a: 1, e: ease.inOutQuad },
  { t: 17.6, x: 540, y: 1000, s: 1.8, r: 0, o: CHAT(300), a: 1, e: ease.inOutQuart, log: true },
  { t: 19.4, x: 540, y: 990, s: 1.85, r: 0, o: CHAT(300), a: 1, e: ease.inOutQuad },
  { t: 19.95, x: 540, y: 820, s: 3.6, r: 0, o: CHAT(300), a: 0, e: ease.inCubic, log: true },
];
function phoneCam(t) {
  let i = 1;
  while (i < PK.length - 1 && t > PK[i].t) i++;
  const a = PK[i - 1];
  const b = PK[i];
  if (b.cut && t < b.t) return { ...a, o: a.o(), hidden: t > K.zoomOut[1] };
  const k = (b.e ?? ease.inOutCubic)(prog(t, a.t, b.t));
  const oa = a.o();
  const ob = b.o();
  const s = b.log ? Math.exp(lerp(Math.log(a.s), Math.log(b.s), k)) : lerp(a.s, b.s, k);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s, r: lerp(a.r, b.r, k), o: { x: lerp(oa.x, ob.x, k), y: lerp(oa.y, ob.y, k) }, a: lerp(a.a, b.a, clamp(k)) };
}

// ---- conversations on the phone -------------------------------------------------------------------
const CONV = [
  { t0: -1, t1: K.zoomOut[1], q: TXT.q0, img: false, blocks: REPLY_DINNER, tokens: TOK.dinner, times: STREAM.dinner, userIn: -1, botIn: -1, think: [-1, K.stream0[0]] },
  { t0: K.send1, t1: K.snap, q: TXT.q1, img: false, blocks: REPLY_LIBYA, tokens: TOK.libya, times: STREAM.libya, userIn: K.send1 + 0.05, botIn: K.think1[0], think: K.think1 },
  { t0: K.send2, t1: 99, q: TXT.q2, img: true, blocks: REPLY_PHOTO, tokens: TOK.photo, times: STREAM.photo, userIn: K.send2 + 0.05, botIn: K.think2[0], think: K.think2 },
];
const msgIn = (t, t0, d = 0.3) => (t0 < 0 ? 1 : ease.app(prog(t, t0, t0 + d)));
const TAPS = [
  { t: 0.95, at: () => spos(P.qs, 0.85, 0.5) },
  { t: K.tap1, at: () => spos(P.input, 0.4, 0.5) },
  { t: K.send1 - 0.05, at: () => spos(P.send) },
  { t: K.tapCam, at: () => spos(P.attach) },
  { t: K.shutter - 0.05, at: () => spos($(P.vf, '.vf-btn')) },
  { t: K.send2 - 0.05, at: () => spos(P.send) },
];

function renderPhone(t) {
  const cam = phoneCam(t);
  const on = show(phoneLayer, t < 20.0 && !cam.hidden && cam.a > 0.001);
  if (!on) return;
  // beat punch on the drop
  const punch = 1 + 0.035 * Math.exp(-Math.max(0, t - K.drop) * 7) * (t >= K.drop ? 1 : 0);
  css(phone, {
    transform: `translate(${px(cam.x)}, ${px(cam.y)}) rotate(${cam.r.toFixed(3)}deg) scale(${(cam.s * punch).toFixed(4)}) translate(${px(-cam.o.x)}, ${px(-cam.o.y)})`,
    opacity: cam.a.toFixed(3),
  });
  // light reveal mask follows the scene's circle
  const rk = ep(t, ...K.light, ease.inOutCubic);
  const lm = t >= K.light[0] && rk < 1 ? `radial-gradient(circle at 540px 800px, #000 ${(rk * 2200).toFixed(1)}px, transparent ${(rk * 2200 + 1.5).toFixed(1)}px)` : 'none';
  css(phoneLayer, { maskImage: lm, webkitMaskImage: lm });

  // ---- status bar + airplane tile
  const air = t >= K.airplane;
  const ak = ep(t, K.airplane, K.airplane + 0.25, ease.outBack);
  css(P.wifi, { opacity: (1 - ep(t, K.airplane, K.airplane + 0.15)).toFixed(3), width: px(16 * (1 - ep(t, K.airplane, K.airplane + 0.25))) });
  css(P.sig, { opacity: (1 - ep(t, K.airplane, K.airplane + 0.15)).toFixed(3), width: px(16 * (1 - ep(t, K.airplane, K.airplane + 0.25))) });
  css(P.planeIc, { opacity: ep(t, K.airplane, K.airplane + 0.1).toFixed(3), width: px(16 * ak), transform: `scale(${(0.4 + 0.6 * ak).toFixed(3)})`, color: '#c2541a' });
  const qk = env(t, K.tileIn, K.tileIn + 0.3, 2.45, 2.75, ease.outBack, ease.inCubic);
  if (show(P.qs, qk > 0)) {
    css(P.qs, { opacity: clamp(qk * 1.5).toFixed(3), transform: `translate3d(0, ${((1 - qk) * -110).toFixed(2)}px, 0)` });
    css(P.qsOn, { opacity: ak.toFixed(3), transform: `scale(${(0.4 + 0.6 * ak).toFixed(3)})` });
    css(P.qsTrack, { opacity: clamp(ak).toFixed(3) });
    css(P.qsKnob, { left: px(lerp(4, 36, clamp(ak))) });
    css(P.qsOff, { opacity: (air ? 0 : 1).toFixed(0) });
    css(P.qsOnTxt, { opacity: (air ? 1 : 0).toFixed(0) });
  }
  // glitch when the signal drops
  const gOn = t >= K.glitch[0] && t < K.glitch[1];
  show(P.glitch, gOn);
  const host = $(phone, '.app-host');
  if (gOn) {
    const r = rng(Math.round(t * FPS) * 13 + 1);
    P.glitchBars.forEach((b) => {
      const y = r() * 898;
      css(b, { top: px(y), height: px(2 + r() * 9), background: `rgb(${r() < 0.5 ? '242 179 61' : '28 23 20'} / ${(0.15 + 0.35 * r()).toFixed(2)})`, transform: `translateX(${((r() - 0.5) * 60).toFixed(1)}px)` });
    });
    css(host, { transform: `translateX(${((r() - 0.5) * 14).toFixed(1)}px)`, filter: `contrast(1.35) saturate(1.5) hue-rotate(${((r() - 0.5) * 40).toFixed(0)}deg)` });
  } else css(host, { transform: 'none', filter: 'none' });

  // ---- which conversation is on screen
  const heroA = clamp(ep(t, K.light[0], K.light[0] + 0.3) - ep(t, K.send1, K.send1 + 0.2) + ep(t, K.snap, K.snap + 0.2) - ep(t, K.send2, K.send2 + 0.2));
  vis(P.hero, t < K.light[0] ? 0 : heroA);
  const c = t < K.zoomOut[1] ? CONV[0] : CONV.find((cv) => cv.t0 >= 0 && t >= cv.t0 && t < cv.t1);
  if (show(P.col, !!c)) {
    setText(P.mUserText, c.q);
    show(P.mImg, c.img);
    const u = msgIn(t, c.userIn);
    css(P.mUser, { opacity: u.toFixed(3), transform: `translate3d(0, ${((1 - u) * 8).toFixed(2)}px, 0)` });
    const b = msgIn(t, c.botIn);
    css(P.mBot, { opacity: b.toFixed(3), transform: `translate3d(0, ${((1 - b) * 8).toFixed(2)}px, 0)` });
    const thinking = t < c.think[1];
    show(P.typing, thinking);
    if (thinking) {
      P.dots.forEach((d, i) => {
        const ph = (((t - i * 0.14) / 1.1) % 1 + 1) % 1;
        const bump = ph < 0.7 ? Math.sin((Math.PI * ph) / 0.7) : 0;
        css(d, { transform: `translateY(${(-5 * bump).toFixed(2)}px)`, opacity: (0.45 + 0.55 * bump).toFixed(3) });
      });
    }
    let n = 0;
    while (n < c.times.length && c.times[n] <= t) n++;
    const caretOn = !thinking && n < c.tokens.length;
    setHTML(P.md, replyHTML(c.blocks, c.tokens, n, { caret: caretOn && n > 0 }));
    // Libyan word mark + tooltip (Libya chat)
    const w = $(P.md, '.lw[data-mark="tahbel"]');
    if (c === CONV[1] && w) {
      css(w, { backgroundSize: `${(ep(t, K.mark[0], K.mark[0] + 0.3) * 100).toFixed(1)}% 82%` });
      const w2 = $(P.md, '.lw[data-mark="testahel"]');
      if (w2) css(w2, { backgroundSize: `${(ep(t, K.mark[1], K.mark[1] + 0.3) * 100).toFixed(1)}% 82%` });
      const pk = springStep(prog(t, K.mark[0] + 0.18, K.mark[0] + 0.75), { damping: 0.45, freq: 1.6 });
      vis(P.tip, clamp(ep(t, K.mark[0] + 0.18, K.mark[0] + 0.35) - ep(t, K.slideDown[0], K.slideDown[0] + 0.3)));
      css(P.tip, { left: px(w.offsetLeft + w.offsetWidth / 2 - P.tip.offsetWidth / 2), top: px(w.offsetTop - P.tip.offsetHeight - 8), transform: `scale(${lerp(0.6, 1, pk).toFixed(4)})` });
    } else vis(P.tip, 0);
  }

  // ---- composer: typing, attachment, send
  const focused = t >= K.tap1 && t < K.snap;
  P.composer.classList.toggle('is-focus', focused || (t >= K.tapCam + 0.4 && t < K.send2));
  let text = '';
  if (t >= K.q1[0] && t < K.send1) text = TYPE.q1.chars.slice(0, typedCount(TYPE.q1, t)).join('');
  const photoIn = t >= K.shutter + 0.12 && t < K.send2;
  if (photoIn) text = TXT.q2.slice(0, Math.round(TXT.q2.length * ep(t, K.shutter + 0.15, K.send2 - 0.15, ease.linear)));
  show(P.strip, photoIn);
  if (photoIn) css(P.strip.firstElementChild, { transform: `scale(${lerp(0.5, 1, springStep(prog(t, K.shutter + 0.12, K.shutter + 0.6))).toFixed(4)})` });
  const blink = Math.cos(t * 2 * Math.PI) > -0.3;
  const tc = (focused || photoIn) && blink ? '<span class="tcaret"></span>' : '';
  setHTML(P.input, text ? `<span>${text}</span>${tc}` : `${tc}<span class="ph">اسأل ريكو أي شي…</span>`);
  if (text) P.send.removeAttribute('disabled');
  else P.send.setAttribute('disabled', '');

  // ---- camera viewfinder + shutter flash
  const vfK = env(t, K.tapCam + 0.05, K.tapCam + 0.2, K.shutter + 0.02, K.shutter + 0.15);
  if (show(P.vf, vfK > 0)) css(P.vf, { opacity: vfK.toFixed(3), transform: `scale(${lerp(1.06, 1, vfK).toFixed(4)})` });
  vis(P.flash, env(t, K.shutter, K.shutter + 0.03, K.shutter + 0.06, K.shutter + 0.3) * 0.95);

  // ---- touch ripple
  const tap = TAPS.filter((x) => x.t <= t).pop();
  const tk = tap ? prog(t, tap.t, tap.t + 0.4) : 1;
  if (show(P.tap, tap && tk < 1)) {
    const p = tap.at();
    css(P.tap, { left: px(p.x), top: px(p.y), opacity: (1 - tk).toFixed(3), transform: `scale(${lerp(0.4, 1.3, ease.outCubic(tk)).toFixed(4)})` });
  }
}

// =====================================================================================================
// captions
// =====================================================================================================
const caps = layer('caps');
const words = (arr, cls = '') => arr.map((w, i) => `<span class="w ${cls}${i === arr.length - 1 && cls === '' ? '' : ''}">${w}</span>`).join(' ');
const hook1 = h('div', { class: 'cap cap-dark', style: 'top:210px;font-size:128px' }, words(TXT.hook1));
const hook2 = h('div', { class: 'cap cap-dark', style: 'top:390px;font-size:104px' }, TXT.hook2.map((w, i) => `<span class="w${i === 2 ? ' gold' : ''}">${w}</span>`).join(' '));
const capLib = h('div', { class: 'cap cap-light', style: 'top:250px;font-size:132px' }, TXT.libyan);
const gloss = h('div', { class: 'reel-gloss', style: 'top:520px' }, TXT.glossary.map(([lib, msa]) => `<div class="gloss-chip"><span class="lib">${lib}</span><span class="msa">${msa}<small>فصحى</small></span></div>`).join(''));
const capSnap = h('div', { class: 'cap cap-light', style: 'top:250px;font-size:132px' }, TXT.snap);
caps.append(hook1, hook2, capLib, gloss, capSnap);
const hookW1 = [...hook1.querySelectorAll('.w')];
const hookW2 = [...hook2.querySelectorAll('.w')];
const glossChips = [...gloss.children];

function out(el, k, y = -40) {
  if (k <= 0) return;
  css(el, { opacity: (1 - k).toFixed(3), transform: `translate3d(0, ${(y * k).toFixed(2)}px, 0)`, filter: `blur(${(k * 12).toFixed(2)}px)` });
}
function renderCaps(t) {
  // hook
  const hOut = ep(t, K.zoomOut[0], K.zoomOut[0] + 0.35, ease.inCubic);
  if (show(hook1, t < K.zoomOut[1])) {
    css(hook1, { opacity: (1 - hOut).toFixed(3), transform: `translate3d(0, ${(-80 * hOut).toFixed(2)}px, 0) scale(${(1 - 0.1 * ep(t, K.word2[0], K.word2[0] + 0.3)).toFixed(4)})` });
    // the first word is already mid-slam on frame 0 (the thumbnail / first frame must carry the hook)
    hookW1.forEach((w, i) => slam(w, t, K.word1[i] - (i === 0 ? 0.12 : 0), { from: 1.9 }));
  }
  if (show(hook2, t >= K.word2[0] && t < K.zoomOut[1])) {
    css(hook2, { opacity: (1 - hOut).toFixed(3), transform: `translate3d(0, ${(-80 * hOut).toFixed(2)}px, 0)` });
    hookW2.forEach((w, i) => slam(w, t, K.word2[i], { from: i === 2 ? 2.3 : 1.6, y: 30 }));
  }
  // Libyan caption + glossary
  const libOut = ep(t, ...K.glossOut, ease.inCubic);
  if (show(capLib, t >= K.libyan && t < K.glossOut[1])) {
    slam(capLib, t, K.libyan, { from: 1.4, y: 20 });
    out(capLib, libOut);
  }
  if (show(gloss, t >= K.gloss[0] && t < K.glossOut[1])) {
    css(gloss, { opacity: (1 - libOut).toFixed(3), filter: libOut > 0 ? `blur(${(libOut * 10).toFixed(2)}px)` : 'none' });
    glossChips.forEach((c, i) => {
      const k = springStep(prog(t, K.gloss[i], K.gloss[i] + 0.7), { damping: 0.45, freq: 1.7 });
      css(c, { opacity: ep(t, K.gloss[i], K.gloss[i] + 0.12).toFixed(3), transform: `translate3d(0, ${((1 - k) * 40).toFixed(2)}px, 0) scale(${lerp(0.6, 1, k).toFixed(4)}) rotate(${((1 - k) * (i % 2 ? -6 : 6)).toFixed(2)}deg)` });
    });
  }
  // vision caption
  if (show(capSnap, t >= K.snap && t < 20)) {
    slam(capSnap, t, K.snap, { from: 1.4, y: 20 });
    out(capSnap, ep(t, 19.45, 19.85, ease.inCubic));
  }
}

// =====================================================================================================
// logo sting (3.8–5.6)
// =====================================================================================================
const sting = layer('sting');
const sparksA = canvas(sting);
const L1 = bigLogo(sting);
const sWord = h('div', { class: 'wordmark', style: 'top:1010px;font-size:190px' }, `<span class="gold" style="display:inline-block">${TXT.word}</span>`);
const sNow = h('div', { class: 'now-pill', style: 'top:1290px' }, `${icon('smartphone')}<span>${TXT.now}</span>`);
sting.append(sWord, sNow);
const STING = { cx: 540, cy: 800, S: 320 };

function renderSting(t) {
  if (!show(sting, t >= K.zoomOut[1] - 0.06 && t < K.stingOut[1] + 0.02)) return;
  const o = 1 - ep(t, ...K.stingOut, ease.inCubic);
  css(sting, { opacity: o.toFixed(3) });
  const shrink = ep(t, ...K.stingOut, ease.inCubic);
  const S = STING.S * (1 - 0.35 * shrink);
  placeLogo(L1, STING.cx, STING.cy, S);
  css(L1.trace, { opacity: '0' });
  const hot = 1 - ep(t, K.bloom, K.bloom + 0.8, ease.outCubic);
  css(L1.fill, { filter: hot > 0.01 ? `brightness(${(1 + 1.6 * hot).toFixed(3)})` : 'none' });
  const ts = lerp(0.88, 1, springStep(prog(t, K.zoomOut[1], K.bloom + 0.7), { damping: 0.5, freq: 1.8 }));
  css(L1.svg, { transform: `scale(${ts.toFixed(4)})` });
  L1.shine.setAttribute('x', lerp(-420, 1300, ep(t, 4.35, 5.05, ease.inOutCubic)).toFixed(1));
  bloomFx(L1, t, K.bloom, STING.cx, STING.cy, S);
  drawSparks(sparksA, t - K.bloom, STING.cx, STING.cy, 0.75, true, S * 0.36);
  const wk = ep(t, ...K.word, ease.outCubic);
  css(sWord.firstElementChild, { clipPath: `inset(-30% 0 -30% ${((1 - wk) * 100).toFixed(2)}%)`, filter: wk < 1 ? `blur(${((1 - wk) * 10).toFixed(2)}px)` : 'none', opacity: wk > 0 ? '1' : '0' });
  const nk = springStep(prog(t, K.now, K.now + 0.7), { damping: 0.5, freq: 1.7 });
  css(sNow, { opacity: ep(t, K.now, K.now + 0.15).toFixed(3), transform: `translateX(-50%) scale(${lerp(0.6, 1, nk).toFixed(4)})` });
}

// =====================================================================================================
// privacy (20–24)
// =====================================================================================================
const SHIELD_PATH = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';
const priv = layer('priv');
const pvAura = h('div', { class: 'aura' });
const pvRing = h('div', { class: 'ring' });
const pvShield = h('div', { class: 'abs' }, `<svg class="shield-big" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" style="left:425px;top:350px;width:230px;height:230px">
  <defs><linearGradient id="rshg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD66E"/><stop offset="0.55" stop-color="#F2B33D"/><stop offset="1" stop-color="#E8742C"/></linearGradient></defs>
  <path d="${SHIELD_PATH}" fill="rgb(242 179 61 / 0.08)"/>
  <path class="s1" d="${SHIELD_PATH}" stroke="url(#rshg)" stroke-width="1.4" pathLength="1" stroke-dasharray="1"/>
  <path class="s2" d="m9 12 2 2 4-4" stroke="#9cc56c" stroke-width="1.7" pathLength="1" stroke-dasharray="1"/></svg>`);
const pvTitle = h('div', { class: 'cap cap-dark', style: 'top:640px;font-size:132px' }, TXT.privacy);
const pvSub = h('div', { class: 'cap', style: 'top:840px;font-size:40px;font-weight:400;color:#d3c8b8' }, TXT.privacySub);
const rows = TXT.promises.map(([ic, txt], i) => h('div', { class: 'prow', style: `top:${960 + i * 130}px` }, `<div class="pr-ico">${icon(ic)}</div><div class="t">${txt}</div>
  <svg class="pr-check" viewBox="0 0 34 34"><circle cx="17" cy="17" r="15" fill="rgb(127 166 80 / 0.16)" stroke="#9cc56c" stroke-width="2" pathLength="1" stroke-dasharray="1" class="cc"/><path d="M10.5 17.5l4.5 4.5 8.5-9" fill="none" stroke="#9cc56c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" class="ck"/></svg>`));
priv.append(pvAura, pvRing, pvShield, pvTitle, pvSub, ...rows);
const shSvg = $(pvShield, 'svg');

function renderPrivacy(t) {
  if (!show(priv, t >= K.privacy - 0.05 && t < K.privOut[1] + 0.05)) return;
  const o = 1 - ep(t, ...K.privOut, ease.inCubic);
  css(priv, { opacity: o.toFixed(3) });
  const cx = 540;
  const cy = 465;
  const S = 230;
  const sk = springStep(prog(t, K.privacy, K.privacy + 0.7), { damping: 0.5, freq: 1.6 });
  css(shSvg, { transform: `scale(${lerp(0.5, 1, sk).toFixed(4)})`, filter: `drop-shadow(0 0 ${(18 + 30 * env(t, K.lock, K.lock + 0.08, K.lock + 0.12, K.lock + 0.6)).toFixed(1)}px rgb(242 179 61 / 0.6))` });
  css($(shSvg, '.s1'), { strokeDashoffset: (1 - ep(t, K.privacy - 0.05, K.lock, ease.inOutCubic)).toFixed(4) });
  css($(shSvg, '.s2'), { strokeDashoffset: (1 - ep(t, K.lock - 0.05, K.lock + 0.15, ease.inOutCubic)).toFixed(4) });
  const AS = S * (2.6 + 0.08 * Math.sin(t * 1.7));
  css(pvAura, { left: px(cx - AS / 2), top: px(cy - AS / 2), width: px(AS), height: px(AS), opacity: (0.8 * ep(t, K.privacy, K.privacy + 0.5)).toFixed(3) });
  const rk = prog(t, K.lock, K.lock + 0.9);
  const RS = S * (0.9 + 1.6 * ease.outCubic(rk));
  css(pvRing, { left: px(cx - RS / 2), top: px(cy - RS / 2), width: px(RS), height: px(RS), opacity: (rk > 0 && rk < 1 ? (1 - rk) * 0.85 : 0).toFixed(3) });
  slam(pvTitle, t, K.privTitle, { from: 1.4, y: 20 });
  rise(pvSub, ep(t, K.privTitle + 0.2, K.privTitle + 0.7, ease.outCubic), { y: 16, blur: 10 });
  rows.forEach((r, i) => {
    const a = K.promises[i];
    const k = springStep(prog(t, a, a + 0.7), { damping: 0.5, freq: 1.7 });
    css(r, { opacity: ep(t, a, a + 0.12).toFixed(3), transform: `translate3d(${((1 - k) * (i % 2 ? -160 : 160)).toFixed(2)}px, 0, 0) scale(${lerp(0.85, 1, k).toFixed(4)})` });
    css($(r, '.cc'), { strokeDashoffset: (1 - ep(t, a + 0.05, a + 0.3, ease.inOutCubic)).toFixed(4) });
    css($(r, '.ck'), { strokeDashoffset: (1 - ep(t, a + 0.15, a + 0.38, ease.inOutCubic)).toFixed(4) });
  });
}

// =====================================================================================================
// phone tiers (24–27.75)
// =====================================================================================================
const tiers = layer('tiers', '<div class="parch-bg"></div>');
const tTitle = h('div', { class: 'cap cap-light', style: 'top:260px;font-size:118px' }, TXT.tiersTitle);
const tCards = TXT.tiers.map(([nm, ds, ram], i) => h('div', { class: 'ptier', style: `top:${520 + i * 330}px` }, `<div class="ph-ic">${icon('smartphone')}</div><div class="nm">${nm}</div><div class="ds">${ds}</div><div class="ram">${icon('memory-stick')}<span>${ram}</span></div><div class="bar"><i></i></div>`));
const tOnce = h('div', { class: 'once-chip', style: 'top:1210px' }, `${icon('shield-check')}<span>${TXT.once}</span>`);
tiers.append(tTitle, ...tCards, tOnce);
const wipe = h('div', { class: 'wipe-edge', style: 'z-index:60' });
stage.appendChild(wipe);

function renderTiers(t) {
  const on = show(tiers, t >= 23.7 && t < K.tiersOut[1] + 0.05);
  const wk = ep(t, 23.7, 24.15, ease.inOutCubic);
  if (show(wipe, on && wk > 0 && wk < 1)) css(wipe, { left: px(SW * (1 - wk)) });
  if (!on) return;
  css(tiers, { clipPath: wk < 1 ? `inset(0 0 0 ${(SW * (1 - wk)).toFixed(1)}px)` : 'none', opacity: (1 - ep(t, ...K.tiersOut, ease.inCubic)).toFixed(3) });
  slam(tTitle, t, K.tiers + 0.05, { from: 1.35, y: 20 });
  tCards.forEach((c, i) => {
    const a = K.tierCards[i];
    const k = springStep(prog(t, a, a + 0.75), { damping: 0.5, freq: 1.6 });
    css(c, { opacity: ep(t, a, a + 0.15).toFixed(3), transform: `translate3d(0, ${((1 - k) * 70).toFixed(2)}px, 0) scale(${lerp(0.9, 1, k).toFixed(4)})` });
    css($(c, '.bar i'), { width: `${(ep(t, K.ramFill[0] + i * 0.3, K.ramFill[1] + i * 0.3, ease.inOutCubic) * TXT.tiers[i][3] * 100).toFixed(2)}%` });
  });
  const ok = springStep(prog(t, K.once, K.once + 0.7), { damping: 0.5, freq: 1.7 });
  css(tOnce, { opacity: ep(t, K.once, K.once + 0.15).toFixed(3), transform: `translateX(-50%) scale(${lerp(0.6, 1, ok).toFixed(4)})` });
}

// =====================================================================================================
// outro (27.75–32)
// =====================================================================================================
const outro = layer('outro', '<div class="night-bg"></div>');
const dustO = canvas(outro);
const sparksB = canvas(outro);
const L2 = bigLogo(outro);
const oWord = h('div', { class: 'wordmark', style: 'top:820px;font-size:190px' }, `<span class="gold" style="display:inline-block">${TXT.word}</span>`);
const oTag = h('div', { class: 'cap cap-dark', style: 'top:1080px;font-size:50px;font-weight:400;color:#d3c8b8' }, TXT.tag);
const oAndroid = h('div', { class: 'now-pill', style: 'top:1190px' }, `${icon('smartphone')}<span>${TXT.android}</span>`);
const oCredit = h('div', { class: 'cap cap-dark', style: 'top:1340px;font-size:38px' }, TXT.credit);
outro.append(oWord, oTag, oAndroid, oCredit);
const OL = { cx: 540, cy: 620, S: 300 };

function renderOutro(t) {
  if (!show(outro, t >= 27.45)) return;
  css(outro, { opacity: ep(t, 27.45, 27.9).toFixed(3) });
  drawDust(DUST, dustO, t, 1, t > K.outro - 0.1 && t < K.outro + 2 ? { x: OL.cx, y: OL.cy, k: ep(t, K.outro, K.outro + 1, ease.outCubic) * (1 - ep(t, K.outro + 0.6, K.outro + 2.4)) } : null);
  placeLogo(L2, OL.cx, OL.cy, OL.S);
  css(L2.trace, { opacity: '0' });
  const ts = lerp(0.5, 1, springStep(prog(t, K.outro - 0.04, K.outro + 0.9), { damping: 0.48, freq: 1.8 }));
  css(L2.svg, { opacity: ep(t, K.outro - 0.04, K.outro + 0.08).toFixed(3), transform: `scale(${ts.toFixed(4)})` });
  const hot = 1 - ep(t, K.outro, K.outro + 0.8, ease.outCubic);
  css(L2.fill, { filter: hot > 0.01 ? `brightness(${(1 + 1.5 * hot).toFixed(3)})` : 'none' });
  L2.shine.setAttribute('x', lerp(-420, 1300, ep(t, 29.6, 30.4, ease.inOutCubic)).toFixed(1));
  bloomFx(L2, t, K.outro, OL.cx, OL.cy, OL.S, { big: false });
  drawSparks(sparksB, t - K.outro, OL.cx, OL.cy, 0.7, true, OL.S * 0.36);
  const wk = ep(t, ...K.outWord, ease.outCubic);
  css(oWord.firstElementChild, { clipPath: `inset(-30% 0 -30% ${((1 - wk) * 100).toFixed(2)}%)`, filter: wk < 1 ? `blur(${((1 - wk) * 10).toFixed(2)}px)` : 'none', opacity: wk > 0 ? '1' : '0' });
  rise(oTag, ep(t, ...K.outTag, ease.outCubic), { y: 18, blur: 10 });
  const ak = springStep(prog(t, K.outAndroid, K.outAndroid + 0.7), { damping: 0.5, freq: 1.7 });
  css(oAndroid, { opacity: ep(t, K.outAndroid, K.outAndroid + 0.15).toFixed(3), transform: `translateX(-50%) scale(${lerp(0.6, 1, ak).toFixed(4)})` });
  rise(oCredit, ep(t, ...K.outCredit, ease.outCubic), { y: 14, blur: 8 });
}

// =====================================================================================================
// global: light background, dust, flash cuts, grain, fade
// =====================================================================================================
const flash = h('div', { class: 'layer', style: 'background:#fff7e6;z-index:90;pointer-events:none' });
const grain = h('div', { id: 'grain' });
const fadeEl = h('div', { id: 'fade' });
stage.append(flash, grain, fadeEl);
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
  drawDust(DUST, dust, t, 1, t > K.bloom - 0.1 && t < K.bloom + 1.6 ? { x: 540, y: 800, k: ep(t, K.bloom, K.bloom + 1, ease.outCubic) * (1 - ep(t, K.bloom + 0.6, K.bloom + 2.2)) } : null);
  // light scenes: 5.45–20 (circle from the logo), then dark for privacy
  const lk = ep(t, ...K.light, ease.inOutCubic);
  const lightOn = t >= K.light[0] && t < 20.0;
  if (show(light, lightOn)) {
    const R = lk * 2200;
    const m = lk < 1 ? `radial-gradient(circle at 540px 800px, #000 ${R.toFixed(1)}px, transparent ${(R + 1.5).toFixed(1)}px)` : 'none';
    css(light, { maskImage: m, webkitMaskImage: m, opacity: (1 - ep(t, 19.55, 19.98, ease.inCubic)).toFixed(3) });
  }
  // white-gold flash on the zoom-into-logo cut and the privacy cut
  vis(flash, Math.max(env(t, K.zoomOut[1] - 0.12, K.zoomOut[1], K.zoomOut[1] + 0.02, K.zoomOut[1] + 0.3) * 0.9, env(t, 19.9, 19.98, 20.0, 20.25) * 0.35));
  const f = Math.round(t * FPS);
  const r = rng(f * 7 + 3);
  css(grain, { backgroundPosition: `${Math.floor(r() * 256)}px ${Math.floor(r() * 256)}px` });
  vis(fadeEl, ep(t, ...K.fadeOut, ease.inOutCubic));
}

function renderAt(t) {
  t = clamp(t, 0, DURATION - 1e-6);
  renderGlobal(t);
  renderPhone(t);
  renderCaps(t);
  renderSting(t);
  renderPrivacy(t);
  renderTiers(t);
  renderOutro(t);
}

async function loadFonts() {
  const faces = ['400 40px "Aref Ruqaa"', '700 40px "Aref Ruqaa"', '400 20px Merienda', '700 20px Merienda', '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, f.includes('Aref') ? 'ريكو' : 'Rico')));
  await document.fonts.ready;
}
function fit() {
  if (CAPTURE) return;
  stageScale = Math.min(window.innerWidth / SW, window.innerHeight / SH);
  stage.style.transform = `scale(${stageScale})`;
}
const ready = (async () => {
  await loadFonts();
  fit();
  renderAt(0);
})();
window.__promo = { ready, renderAt, DURATION, FPS };

if (!CAPTURE) {
  window.addEventListener('resize', fit);
  ready.then(() => {
    const audio = new Audio('reel_soundtrack.m4a');
    let playing = false;
    let clock = Number(params.get('t') ?? 0);
    let last = performance.now();
    const toggle = () => {
      playing = !playing;
      if (playing) {
        if (clock >= DURATION - 0.05) clock = 0;
        audio.currentTime = clock;
        audio.play().catch(() => {});
      } else audio.pause();
    };
    window.addEventListener('click', toggle);
    window.addEventListener('keydown', (e) => e.code === 'Space' && toggle());
    const loop = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playing) {
        clock = !audio.paused && audio.readyState >= 2 ? audio.currentTime : clock + dt;
        if (clock >= DURATION) {
          clock = DURATION;
          playing = false;
        }
      }
      renderAt(clock);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
