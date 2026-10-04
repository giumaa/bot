// Single source of truth for the Rico promo: timing (beat-aligned), on-screen text, typing/streaming
// schedules and the sound cue sheet. The browser animation and the audio synth (via cues.json, see
// render/export-cues.mjs) both read this file, so picture and sound cannot drift apart.

import { rng } from './lib.js';

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const BAR = 4 * BEAT; // 2 s
export const DURATION = 64; // 32 bars
export const bar = (n, beat = 0) => n * BAR + beat * BEAT;

// ---- scenes (seconds) — every boundary sits on a bar line ----------------------------------------
export const SCENES = {
  hook: [0, 8], // caret types the question on black
  logo: [8, 12], // caret traces the kaf → bloom → wordmark
  reveal: [12, 14], // parchment light opens from the logo, the app boots
  chat: [14, 26], // Libyan-dialect chat demo
  dialect: [26, 30], // "speaks Libyan" + glossary
  offline: [30, 40], // Wi-Fi off, Rico still answers
  privacy: [40, 48], // the four promises
  features: [48, 56], // bento grid
  outro: [56, 64], // logo, credits, download
};

// ---- copy (Libyan dialect first, English as a quiet second line) -------------------------------------
export const TXT = {
  hook1: 'تخيّل مساعد ذكي يحكي بلهجتك…',
  hook1en: 'Imagine an AI assistant that speaks your dialect…',
  hook2: 'ويخدم على جهازك، بدون إنترنت.',
  hook2en: '…and runs on your own device. No internet.',
  word: 'ريكو',
  latin: 'Rico',
  tagline: 'مساعدك الذكي اللي يخدم على جهازك بدون إنترنت',
  taglineEn: 'Your AI assistant — right on your device, offline.',

  q1: 'شن أحسن أماكن نزوروها في ليبيا؟',
  q2: 'فسرلي كيف تخدم الطاقة الشمسية',

  dialectTitle: 'يحكي <b>ليبي</b>',
  dialectEn: 'Speaks Libyan Arabic — naturally.',
  glossary: [
    ['شن', 'ماذا'],
    ['توا', 'الآن'],
    ['باهي', 'جيد'],
    ['يعطيك الصحة', 'شكراً'],
  ],

  offline1: 'ما فيش إنترنت؟',
  offline1en: 'No internet?',
  offline2: 'ريكو يجاوبك <b>عادي.</b>',
  offline2en: 'Rico still answers.',
  zeroBytes: 'ولا بايت طلع من جهازك',

  privacyTitle: 'محمي <b>وخاص</b>',
  privacySub: 'محادثاتك تبقى على جهازك، وما تطلع لحد.',
  privacyEn: 'Private by design — your chats never leave your device.',
  promises: [
    ['wifi-off', 'لا إنترنت بعد تحميل النموذج', 'No internet after the model download'],
    ['user-x', 'لا تسجيل دخول', 'No account, no login'],
    ['eye-off', 'لا تتبع ولا إحصائيات', 'No tracking, no analytics'],
    ['hard-drive', 'محادثاتك على جهازك فقط', 'Your chats stay on your device'],
  ],

  featuresTitle: 'كل اللي تحتاجه، <b>على جهازك</b>',
  featuresEn: 'Everything you need — right on your device.',

  outroTag: 'ذكاء اصطناعي ليبي — على جهازك، بدون إنترنت.',
  outroTagEn: 'Libyan AI. On your device. Offline.',
  credit: 'تطوير وتدريب جمعة أبوراس',
  creditEn: 'Developed & trained by Juma Abouras',
  cta: 'حمّله توا',
  url: 'github.com/giumaa/rico-ai',
  platforms: 'Windows · macOS · Linux',
};

// Rico's answers — taken from the app's own canned replies (app/src/renderer/dev/mockRico.ts), trimmed.
export const REPLY_LIBYA = [
  { type: 'p', parts: [{ t: 'ليبيا فيها أماكن' }, { t: ' تهبل،', mark: 'tahbel' }, { t: ' وهذي أحسن اللي' }, { t: ' تستاهل', mark: 'testahel' }, { t: ' الزيارة:' }] },
  { type: 'li', parts: [{ t: 'لبدة الكبرى', b: true }, { t: ' (الخمس): مدينة رومانية على البحر، من أحسن المواقع الأثرية في العالم.' }] },
  { type: 'li', parts: [{ t: 'صبراتة:', b: true }, { t: ' مسرحها الروماني الضخم مطل على المتوسط.' }] },
  { type: 'li', parts: [{ t: 'غدامس:', b: true }, { t: ' «لؤلؤة الصحراء»، مدينة قديمة بيوتها بيضاء وأزقتها مسقوفة.' }] },
  { type: 'li', parts: [{ t: 'أكاكوس:', b: true }, { t: ' جبال في الجنوب فيها رسوم صخرية عمرها آلاف السنين.' }] },
  { type: 'p', parts: [{ t: 'نصيحة:', b: true }, { t: ' الربيع والخريف أحسن وقت للسفر، وفي الصحراء خذ ماء كافي وبلّش بدري.' }] },
];
export const MARKS = { tahbel: 'رائعة', testahel: 'تستحق' };

export const REPLY_SOLAR = [
  { type: 'p', parts: [{ t: 'الطاقة الشمسية فكرتها بسيطة:' }, { t: ' الشمس تعطينا ضوء، والألواح تحوّلو لكهرباء.', b: true }] },
  { type: 'oli', parts: [{ t: 'الألواح', b: true }, { t: ' فيها خلايا سيليكون، لما يطيح عليها الضوء تولّد تيار كهربائي.' }] },
  { type: 'oli', parts: [{ t: 'الإنفرتر', b: true }, { t: ' يحوّل التيار هذا لتيار تخدم بيه أجهزة الحوش.' }] },
  { type: 'oli', parts: [{ t: 'البطاريات', b: true }, { t: ' تخزّن الزيادة باش تستعملها بالليل.' }] },
];

// ---- key moments -------------------------------------------------------------------------------------
export const K = {
  // hook
  caretIn: 0.3,
  l1: [1.0, 2.95],
  l2: [3.4, 5.3],
  dissolve: 6.25,
  glide: [6.35, 6.9],
  trace: [6.9, 7.96],
  // logo
  bloom: 8.0,
  logoUp: [8.55, 9.45],
  wordmark: [8.95, 9.8],
  latin: [9.35, 10.0],
  shine: [9.15, 10.05],
  tagline: [10.05, 10.75],
  logoTextOut: [11.45, 11.95],
  // reveal
  reveal: [12.0, 13.3],
  // chat
  cursorIn: 14.0,
  focusClick: 14.75,
  q1: [15.0, 16.95],
  sendClick: 17.5,
  think: [17.85, 18.5],
  stream1: [18.5, 24.15],
  marks: [24.55, 25.15],
  // dialect
  slideRight: [25.95, 26.9],
  dialectTitle: 26.45,
  glossary: [27.3, 27.75, 28.2, 28.65],
  dialectOut: [29.45, 29.95],
  // offline
  wifiCard: [30.0, 30.55],
  wifiCursor: [30.75, 31.85],
  wifiOff: 32.0,
  offline1: 32.3,
  newChatClick: 33.0,
  chipClick: 33.65,
  stream2: [34.0, 37.55],
  offline2: 34.2,
  zeroBytes: 34.9,
  pillGlow: 38.3,
  dive: [38.7, 39.75],
  // privacy
  shieldDraw: [39.55, 40.4],
  shieldLock: 40.4,
  privacyTitle: 40.55,
  promises: [41.0, 42.0, 43.0, 44.0],
  privacyOut: [46.4, 47.1],
  wipe: [47.0, 47.9],
  // features
  featuresTitle: 47.55,
  cards: [48.0, 48.25, 48.5, 48.75, 49.0, 49.25],
  scan: [49.4, 50.55],
  visionText: [50.6, 51.9],
  dialectSwitch: [50.5, 52.0, 53.5],
  tiers: [49.35, 49.55, 49.75],
  ramFill: [49.6, 50.7],
  recommended: 50.85,
  gauge: [49.6, 50.7],
  themeFlip: [51.0, 53.0, 55.0],
  platforms: [49.8, 50.0, 50.2],
  featuresOut: [55.15, 55.95],
  // outro
  pickup: [55.625, 55.75, 55.875],
  outroBloom: 56.0,
  outroWord: [56.45, 57.2],
  outroTag: [57.25, 57.9],
  credit: [58.55, 59.15],
  cta: [59.35, 60.0],
  fadeOut: [62.4, 63.85],
};

// ---- schedules ---------------------------------------------------------------------------------------
/**
 * Human-like typing: one time per code point, jittered, a little longer after spaces and punctuation,
 * then rescaled to land exactly inside [t0, t1].
 */
export function typeSchedule(text, t0, t1, seed = 1) {
  const r = rng(seed);
  const chars = Array.from(text);
  const gaps = chars.map((c, i) => {
    let g = 1 + 0.55 * (r() * 2 - 1);
    if (c === ' ') g += 0.5;
    if ('،,.؟?!…:'.includes(chars[i - 1] ?? '')) g += 1.4;
    return Math.max(0.25, g);
  });
  gaps[0] = 0;
  const total = gaps.reduce((a, b) => a + b, 0);
  const times = [];
  let acc = 0;
  for (let i = 0; i < chars.length; i++) {
    acc += gaps[i];
    times.push(t0 + (acc / total) * (t1 - t0));
  }
  return { chars, times, t0, t1 };
}

/** how many characters are visible at time t */
export const typedCount = (s, t) => {
  let n = 0;
  while (n < s.times.length && s.times[n] <= t) n++;
  return n;
};

/** split reply blocks into word tokens (leading space kept on the token, like an LLM stream).
 *  Parts must not end with whitespace: put the space at the start of the next part. */
export function tokenize(blocks) {
  const tokens = [];
  blocks.forEach((blk, bi) => {
    blk.parts.forEach((part, pi) => {
      const words = part.t.match(/\s*\S+/g) ?? [];
      words.forEach((w) => tokens.push({ block: bi, part: pi, text: w }));
    });
  });
  return tokens;
}

/** token arrival times inside [t0, t1]; a short beat of silence at each new block (newline) */
export function streamSchedule(tokens, t0, t1, seed = 7) {
  const r = rng(seed);
  const gaps = tokens.map((tk, i) => {
    let g = 0.7 + 0.6 * r();
    if (i > 0 && tk.block !== tokens[i - 1].block) g += 1.6;
    return g;
  });
  gaps[0] = 0;
  const total = gaps.reduce((a, b) => a + b, 0);
  let acc = 0;
  return tokens.map((tk, i) => {
    acc += gaps[i];
    return t0 + (acc / total) * (t1 - t0);
  });
}

export const TYPE = {
  hook1: typeSchedule(TXT.hook1, ...K.l1, 11),
  hook2: typeSchedule(TXT.hook2, ...K.l2, 23),
  q1: typeSchedule(TXT.q1, ...K.q1, 5),
};
export const TOK = {
  libya: tokenize(REPLY_LIBYA),
  solar: tokenize(REPLY_SOLAR),
};
export const STREAM = {
  libya: streamSchedule(TOK.libya, ...K.stream1, 31),
  solar: streamSchedule(TOK.solar, ...K.stream2, 47),
};

// ---- music plan (read by audio/synth.py) ------------------------------------------------------------
// D minor; the sonic logo is the harmonic-minor pickup A–B♭–C♯ landing on D (the augmented second
// gives it a North-African colour). Chords per bar:
const LOOP = ['Dm', 'Bb', 'F', 'C'];
export const MUSIC = {
  bpm: BPM,
  bars: DURATION / BAR,
  chords: [
    'Dm', 'Dm', 'Dm', 'A', // 0-3   intro; A (dominant) under the trace, the pickup resolves on the bloom
    ...LOOP, // 4-7    logo + app boot
    ...LOOP, ...LOOP, // 8-15   chat + dialect
    ...LOOP, // 16-19  16 = the "internet off" drop, 17 the beat returns
    ...LOOP, // 20-23  privacy
    'Dm', 'Bb', 'F', 'A', // 24-27  features, A leads into the outro bloom
    'Dm', 'Bb', 'Dm', 'Dm', // 28-31  outro, final chord rings out
  ],
  // drum intensity per bar: 0 none, 1 light (no kick), 2 groove, 3 full
  drums: [
    0, 0, 0, 0,
    0, 0, 0, 1,
    2, 2, 2, 2, 2, 2, 2, 2,
    0, 2, 2, 2,
    1, 1, 1, 1,
    3, 3, 3, 3,
    0, 0, 0, 0,
  ],
  drop: { start: K.wifiOff, end: K.stream2[0] },
  motif: [
    [K.bloom - 0.375, 'A4'], [K.bloom - 0.25, 'Bb4'], [K.bloom - 0.125, 'C#5'], [K.bloom, 'D5'],
    [K.pickup[0], 'A4'], [K.pickup[1], 'Bb4'], [K.pickup[2], 'C#5'], [K.outroBloom, 'D5'],
  ],
  end: DURATION,
};

// ---- sound cue sheet --------------------------------------------------------------------------------
// gain in dB relative to the SFX bus, pan -1 (left) … +1 (right). Notes are scientific pitch names.
export function buildCues() {
  const c = [];
  const add = (t, id, o = {}) => c.push({ t: +t.toFixed(4), id, ...o });

  // hook: soft "ink" ticks for each typed glyph
  for (const s of [TYPE.hook1, TYPE.hook2]) {
    s.times.forEach((t, i) => {
      if (s.chars[i] !== ' ') add(t, 'ink_tick', { seed: i, gain: -7 });
    });
  }
  add(K.dissolve, 'whoosh', { dur: 0.9, size: 'soft', from: -0.2, to: 0.3, gain: -6 });
  add(K.glide[0], 'riser', { dur: K.bloom - K.glide[0], gain: -3 });
  add(K.trace[0], 'trace', { dur: K.trace[1] - K.trace[0], gain: -9 });
  add(K.bloom, 'bloom', { gain: 0 });
  add(K.wordmark[0], 'swish', { dur: 0.8, gain: -10, from: 0.4, to: -0.4 });
  add(K.shine[0], 'shine', { dur: 0.9, gain: -12 });
  add(K.tagline[0], 'swish', { dur: 0.6, gain: -15, from: -0.2, to: 0.2 });
  add(K.logoTextOut[0], 'whoosh', { dur: 0.6, size: 'soft', from: 0.2, to: -0.2, gain: -12 });

  // reveal
  add(K.reveal[0] - 0.05, 'whoosh', { dur: 1.4, size: 'big', from: 0, to: 0, gain: -3 });
  add(K.reveal[1] - 0.05, 'settle', { gain: -6 });
  [13.0, 13.08, 13.16, 13.24].forEach((t, i) => add(t, 'ui_pop', { note: ['D6', 'F6', 'A6', 'D7'][i], gain: -20, pan: i % 2 ? -0.25 : 0.25 }));

  // chat
  add(K.focusClick, 'click', { gain: -10 });
  TYPE.q1.times.forEach((t, i) => add(t, 'key', { seed: 100 + i, kind: TYPE.q1.chars[i] === ' ' ? 'space' : 'char', gain: -6 }));
  add(K.sendClick, 'click', { gain: -9 });
  add(K.sendClick + 0.02, 'send', { gain: -8 });
  add(17.8, 'tick', { gain: -18, pan: 0.2 }); // sidebar row arrives
  add(K.stream1[0], 'chime', { notes: ['A5', 'D6'], gain: -14 });
  add(K.stream1[0], 'stream', { times: STREAM.libya, gain: -20 });
  newBlockPops(STREAM.libya, TOK.libya, add);
  add(K.marks[0], 'marker', { gain: -12, pan: 0.15 });
  add(K.marks[0] + 0.2, 'ui_pop', { note: 'F6', gain: -16 });
  add(K.marks[1], 'marker', { gain: -12, pan: -0.15 });
  add(K.marks[1] + 0.2, 'ui_pop', { note: 'A6', gain: -16 });

  // dialect
  add(K.slideRight[0], 'whoosh', { dur: 1.0, size: 'soft', from: -0.4, to: 0.5, gain: -8 });
  add(K.dialectTitle, 'swish', { dur: 0.7, gain: -12, from: -0.5, to: -0.2 });
  K.glossary.forEach((t, i) => add(t, 'ui_pop', { note: ['D6', 'F6', 'A6', 'C7'][i], gain: -12, pan: -0.45 }));
  add(K.dialectOut[0], 'whoosh', { dur: 0.6, size: 'soft', from: -0.4, to: -0.6, gain: -14 });

  // offline
  add(K.wifiCard[0], 'ui_pop', { note: 'A5', gain: -12, pan: -0.45 });
  add(K.wifiOff, 'toggle', { gain: -6, pan: -0.4 });
  add(K.wifiOff + 0.03, 'powerdown', { gain: -6 });
  add(K.offline1, 'swish', { dur: 0.7, gain: -12, from: -0.6, to: -0.3 });
  add(K.newChatClick, 'click', { gain: -10, pan: 0.5 });
  add(K.chipClick, 'click', { gain: -10, pan: 0.2 });
  add(K.chipClick + 0.02, 'send', { gain: -10 });
  add(K.stream2[0], 'chime', { notes: ['A5', 'D6', 'F6'], gain: -12 });
  add(K.stream2[0], 'stream', { times: STREAM.solar, gain: -20 });
  newBlockPops(STREAM.solar, TOK.solar, add);
  add(K.offline2, 'swish', { dur: 0.7, gain: -12, from: -0.6, to: -0.3 });
  add(K.zeroBytes, 'ui_pop', { note: 'D6', gain: -14, pan: -0.45 });
  add(K.pillGlow, 'chime', { notes: ['D6', 'A6'], gain: -13, pan: 0.4 });
  add(K.dive[0], 'dive', { dur: K.dive[1] - K.dive[0] + 0.3, gain: -3 });

  // privacy
  add(K.shieldDraw[0], 'trace', { dur: K.shieldDraw[1] - K.shieldDraw[0], gain: -14 });
  add(K.shieldLock, 'lock', { gain: -4 });
  add(K.privacyTitle, 'swish', { dur: 0.7, gain: -12, from: 0.2, to: -0.2 });
  K.promises.forEach((t, i) => add(t, 'check', { note: ['D5', 'F5', 'A5', 'D6'][i], gain: -9, pan: i % 2 ? -0.3 : 0.3 }));
  add(K.privacyOut[0], 'whoosh', { dur: 0.8, size: 'soft', from: 0.3, to: -0.3, gain: -12 });
  add(K.wipe[0], 'whoosh', { dur: 1.0, size: 'soft', from: 0.8, to: -0.8, gain: -6 });

  // features
  add(K.featuresTitle, 'swish', { dur: 0.6, gain: -14, from: 0, to: 0 });
  K.cards.forEach((t, i) => add(t, 'ui_pop', { note: ['D6', 'F6', 'A6', 'C7', 'D7', 'F7'][i], gain: -10, pan: [0.5, 0, -0.5, 0.5, 0, -0.5][i] }));
  add(K.scan[0], 'scan', { dur: K.scan[1] - K.scan[0], gain: -16, pan: 0.45 });
  [0, 1, 2].forEach((i) => add(K.scan[0] + 0.55 + i * 0.25, 'ui_pop', { note: ['A6', 'D7', 'F7'][i], gain: -19, pan: 0.5 }));
  add(K.visionText[0], 'stream', { times: Array.from({ length: 12 }, (_, i) => K.visionText[0] + i * 0.1), gain: -24, pan: 0.45 });
  K.dialectSwitch.forEach((t) => add(t, 'slide', { gain: -12, pan: -0.1 }));
  add(K.ramFill[0], 'fill', { dur: K.ramFill[1] - K.ramFill[0], gain: -18, pan: -0.5 });
  add(K.recommended, 'chime', { notes: ['F6', 'C7'], gain: -16, pan: -0.5 });
  K.themeFlip.forEach((t) => add(t, 'toggle', { gain: -14, pan: 0.0 }));
  K.platforms.forEach((t, i) => add(t, 'tick', { gain: -18, pan: -0.1 + i * 0.1 }));
  add(K.featuresOut[0], 'whoosh', { dur: 1.0, size: 'big', from: 0, to: 0, gain: -8 });

  // outro
  add(K.outroBloom, 'bloom', { gain: -2, small: true });
  add(K.outroWord[0], 'swish', { dur: 0.8, gain: -11, from: 0.4, to: -0.4 });
  add(K.outroTag[0], 'swish', { dur: 0.6, gain: -16, from: -0.2, to: 0.2 });
  add(K.cta[0], 'chime', { notes: ['D6', 'F6', 'A6'], gain: -14 });

  return c.sort((a, b) => a.t - b.t);
}

function newBlockPops(times, tokens, add) {
  tokens.forEach((tk, i) => {
    if (i > 0 && tk.block !== tokens[i - 1].block) add(times[i], 'tick', { gain: -17 });
  });
}
