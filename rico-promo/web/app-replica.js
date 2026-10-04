// Static replica of the Rico desktop window (RTL, light theme), built with the app's own class names
// and strings (giumaa/rico-ai app/src/renderer) so app-styles/*.css renders it like the real app.
// promo.js drives its state per frame (typing, sending, streaming, sidebar rows).

import { icon } from './assets/icons.js';
import { GLYPH_H, GLYPH_PATH, GLYPH_W } from './assets/logo.js';

let uid = 0;

/** the app's Logo component, variant "tile" (rounded ink-black icon with the saffron→ember kaf) */
export function logoTile(size, cls = '') {
  const id = `lg${uid++}`;
  const scale = 600 / GLYPH_H;
  const ox = (1024 - GLYPH_W * scale) / 2;
  const oy = (1024 - GLYPH_H * scale) / 2;
  return `<svg class="${cls}" viewBox="0 0 1024 1024" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#221C17"/><stop offset="1" stop-color="#0F0D0B"/></linearGradient>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2B33D" stop-opacity="0.55"/><stop offset="0.5" stop-color="#F2B33D" stop-opacity="0.08"/><stop offset="1" stop-color="#E8742C" stop-opacity="0.4"/></linearGradient>
    <linearGradient id="${id}i" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${GLYPH_H}"><stop offset="0" stop-color="#FFD66E"/><stop offset="0.5" stop-color="#F2B33D"/><stop offset="1" stop-color="#E8742C"/></linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="236" fill="url(#${id}t)"/>
  <rect x="6" y="6" width="1012" height="1012" rx="230" fill="none" stroke="url(#${id}r)" stroke-width="10"/>
  <g transform="translate(${ox} ${oy}) scale(${scale})"><path d="${GLYPH_PATH}" fill="url(#${id}i)"/></g>
</svg>`;
}

export const SIDEBAR_TODAY = ['عاوني نكتب رسالة لخدمتي', 'ترجملي الإيميل هذا للإنجليزي'];
export const SIDEBAR_YESTERDAY = ['شن نطيبوا اليوم للعشاء؟', 'نصايح للمذاكرة قبل الامتحان', 'كيف نعدّل السيرة الذاتية متاعي؟'];

const CHIPS = ['شن نطيبوا اليوم للعشاء؟', 'فسرلي كيف تخدم الطاقة الشمسية', 'عاوني نكتب رسالة لخدمتي', 'شن أحسن أماكن نزوروها في ليبيا؟'];

const winCtl = `
  <span><svg viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" stroke-width="1"/></svg></span>
  <span><svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg></span>
  <span><svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1"/></svg></span>`;

const sbItem = (title, cls = '') =>
  `<li class="sb-item ${cls}" data-active="false"><button type="button" class="sb-item-btn"><span class="sb-item-title" dir="auto">${title}</span></button></li>`;

export function buildApp(host) {
  host.innerHTML = `
<div class="app" data-sidebar="open">
  <div class="app-bg"></div>
  <aside class="sidebar">
    <div class="sidebar-inner">
      <div class="sb-top">
        <div class="sb-brand">${logoTile(30)}<span class="sb-brand-name">ريكو</span></div>
        <button type="button" class="icon-btn">${icon('panel-left-close', 'flip-rtl')}</button>
      </div>
      <div class="sb-actions">
        <button type="button" class="btn btn-primary sb-new" data-k="newChat">${icon('plus')}<span>محادثة جديدة</span><kbd>Ctrl N</kbd></button>
        <div class="sb-search">${icon('search')}<div class="input" style="display:flex;align-items:center;color:var(--muted)">دوّر في المحادثات…</div></div>
      </div>
      <nav class="sb-list">
        <section>
          <h3 class="sb-group-label">اليوم</h3>
          <ul data-k="today">
            ${sbItem('', 'sb-new-row')}
            ${sbItem('', 'sb-new-row')}
            ${SIDEBAR_TODAY.map((t) => sbItem(t)).join('')}
          </ul>
        </section>
        <section>
          <h3 class="sb-group-label">أمس</h3>
          <ul>${SIDEBAR_YESTERDAY.map((t) => sbItem(t)).join('')}</ul>
        </section>
      </nav>
      <div class="sb-foot">
        <div class="sb-offline" data-k="pill"><div class="pill-glow" data-k="pillGlow"></div><span data-k="pillIcon" style="display:inline-grid;place-items:center;width:15px;height:15px">${icon('shield-check')}</span><span>يعمل بدون إنترنت</span></div>
        <button type="button" class="icon-btn">${icon('settings')}</button>
      </div>
    </div>
  </aside>
  <main class="main">
    <header class="main-header">
      <div class="main-title" dir="auto" data-k="title"></div>
      <button type="button" class="model-pill"><span class="status-dot" data-state="ready"></span><span class="model-pill-label">ريكو لايت</span></button>
      <button type="button" class="icon-btn">${icon('moon')}</button>
      <button type="button" class="icon-btn">${icon('settings')}</button>
    </header>
    <div class="chat-wrap">
      <div class="chat-scroll" data-k="scroll">
        <div class="hero" data-k="hero">
          <div class="hero-mark" data-k="heroMark">${logoTile(92)}</div>
          <h1 class="hero-title" data-k="heroTitle">أهلاً، أنا <b>ريكو</b></h1>
          <p class="hero-sub" data-k="heroSub">شن نقدر نعاونك فيه اليوم؟</p>
          <div class="hero-chips" data-k="chips">
            ${CHIPS.map((c) => `<button type="button" class="chip" dir="auto">${icon('sparkles')}<span>${c}</span></button>`).join('')}
          </div>
          <div class="hero-privacy" data-k="heroPrivacy">
            <span>${icon('wifi-off')}لا إنترنت بعد تحميل النموذج</span>
            <span>${icon('lock')}لا تسجيل دخول</span>
            <span>${icon('eye-off')}لا تتبع ولا إحصائيات</span>
          </div>
        </div>
        <div class="chat-col" data-k="col">
          <article class="msg msg-user" data-script="ar" data-k="mUser">
            <div class="msg-bubble" dir="auto" data-k="mUserText"></div>
          </article>
          <article class="msg msg-assistant" data-script="ar" data-k="mBot">
            <div class="msg-avatar">${logoTile(32)}</div>
            <div class="msg-body">
              <div class="typing" data-k="typing">
                <span class="typing-dots"><i></i><i></i><i></i></span>
                <span>ريكو يفكّر…</span>
              </div>
              <div class="md" dir="auto" data-k="md"></div>
              <div class="msg-actions" data-k="actions">
                <button type="button" class="act-btn">${icon('copy')}<span>نسخ</span></button>
                <button type="button" class="act-btn">${icon('refresh-cw')}<span>إعادة التوليد</span></button>
              </div>
            </div>
          </article>
        </div>
      </div>
    </div>
    <div class="composer-wrap">
      <div class="composer" data-k="composer">
        <div class="composer-row">
          <button type="button" class="attach-btn">${icon('image-plus')}</button>
          <div class="composer-input" dir="rtl" data-k="input"></div>
          <button type="button" class="send-btn" data-k="send" disabled>${icon('arrow-up')}</button>
        </div>
      </div>
      <div class="composer-hint">
        <span><kbd class="kbd">Enter</kbd> للإرسال</span>
        <span><kbd class="kbd">Shift</kbd>+<kbd class="kbd">Enter</kbd> لسطر جديد</span>
        <span>ريكو يخدم على جهازك — راجع المعلومات المهمة قبل ما تعتمد عليها</span>
      </div>
    </div>
  </main>
</div>
<div class="win-controls">${winCtl}</div>`;

  const el = {};
  host.querySelectorAll('[data-k]').forEach((n) => (el[n.getAttribute('data-k')] = n));
  el.chipEls = [...el.chips.querySelectorAll('.chip')];
  el.newRows = [...el.today.querySelectorAll('.sb-new-row')];
  el.oldToday = [...el.today.querySelectorAll('.sb-item:not(.sb-new-row)')];
  el.sbItems = [...host.querySelectorAll('.sb-item')];
  el.sbLabels = [...host.querySelectorAll('.sb-group-label')];
  el.dots = [...el.typing.querySelectorAll('i')];
  return el;
}

/**
 * Markdown-ish HTML for the first n tokens of a reply (paragraphs, bullet/numbered lists, bold,
 * Libyan-word marks) with the app's streaming caret after the last character.
 */
export function replyHTML(blocks, tokens, n, { caret = false } = {}) {
  if (n <= 0) return '';
  const lastTok = tokens[Math.min(n, tokens.length) - 1];
  let html = '';
  let list = null;
  for (let bi = 0; bi <= lastTok.block; bi++) {
    const blk = blocks[bi];
    const want = blk.type === 'li' ? 'ul' : blk.type === 'oli' ? 'ol' : null;
    if (list !== want) {
      if (list) html += `</${list}>`;
      if (want) html += `<${want}>`;
      list = want;
    }
    let inner = '';
    blk.parts.forEach((part, pi) => {
      const toks = [];
      for (let i = 0; i < n && i < tokens.length; i++) {
        if (tokens[i].block === bi && tokens[i].part === pi) toks.push(tokens[i].text);
      }
      if (!toks.length) return;
      let s = toks.join('');
      const lead = s.match(/^\s*/)[0];
      s = s.slice(lead.length);
      if (part.b) s = `<strong>${s}</strong>`;
      if (part.mark) s = `<span class="lw" data-mark="${part.mark}">${s}</span>`;
      inner += lead + s;
    });
    if (caret && bi === lastTok.block) inner += '<span class="stream-caret" aria-hidden="true"></span>';
    html += want ? `<li>${inner}</li>` : `<p>${inner}</p>`;
  }
  if (list) html += `</${list}>`;
  return html;
}
