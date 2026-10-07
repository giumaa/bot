// Rico for Android — 32 s Reel (1080×1920). Single source of truth for picture and sound, like timeline.js.
// Hook in the first two seconds: text («طفّي الإنترنت…»), picture (a phone slams in, airplane mode glitches the
// screen) and sound (a hit, a glitch, then the beat drops on «…وريكو يجاوبك عادي.»). No links anywhere.

import { rng } from './lib.js';
import { MARKS, tokenize, streamSchedule, typeSchedule } from './timeline.js';

export { MARKS };
export const FPS = 60;
export const W = 1080;
export const H = 1920;
export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = 4 * BEAT;
export const DURATION = 32;

export const TXT = {
  hook1: ['طفّي', 'الإنترنت…'],
  hook2: ['…وريكو', 'يجاوبك', 'عادي.'],
  hookEn: 'Turn the internet off. Rico still answers.',
  airplane: 'وضع الطيران',
  q0: 'شن نطيبوا اليوم للعشاء؟',
  now: 'الآن على الأندرويد',
  nowEn: 'Now on Android',
  libyan: 'يحكي <b>ليبي</b>',
  libyanEn: 'Speaks Libyan Arabic',
  q1: 'شن أحسن أماكن نزوروها في ليبيا؟',
  glossary: [
    ['شن', 'ماذا'],
    ['توا', 'الآن'],
    ['باهي', 'جيد'],
    ['يعطيك الصحة', 'شكراً'],
  ],
  snap: 'صوّر <b>واسأل</b>',
  snapEn: 'Snap a photo, ask about it',
  q2: 'شن تشوف في الصورة؟',
  privacy: 'محمي <b>وخاص</b>',
  privacySub: 'محادثاتك تبقى على تلفونك، وما تطلع لحد.',
  promises: [
    ['wifi-off', 'لا إنترنت بعد تحميل النموذج'],
    ['user-x', 'لا تسجيل دخول'],
    ['eye-off', 'لا تتبع ولا إحصائيات'],
    ['hard-drive', 'محادثاتك على تلفونك فقط'],
  ],
  tiersTitle: 'يخدم على <b>تلفونك</b>',
  tiersEn: 'Built for your phone',
  // from mobile/android/.../Catalog.kt (phone wording of the model cards)
  tiers: [
    ['ريكو ميني', 'صغير وخفيف وسريع، مصمم للتلفونات', 'إذا تلفونك فيه 4 أو 6 جيجا رام — هذا ليك', 0.45],
    ['ريكو لايت', 'أذكى وأحسن في الكتابة والفهم', 'إذا تلفونك فيه 8 جيجا رام أو أكثر — هذا ليك', 0.9],
  ],
  once: 'تحميل مرة وحدة… وبعدها بدون إنترنت',
  word: 'ريكو',
  tag: 'ذكاء ليبي في جيبك — بدون إنترنت',
  tagEn: 'Libyan AI in your pocket. Offline.',
  android: 'متوفر على الأندرويد',
  credit: 'تطوير وتدريب جمعة أبوراس',
};

// Rico's answers (from the app's own canned replies, shortened for a phone screen)
export const REPLY_DINNER = [
  { type: 'p', parts: [{ t: 'بالصحة والهناء! هاني نقترحولك:' }] },
  { type: 'li', parts: [{ t: 'شكشوكة بالبيض', b: true }, { t: ' — سريعة ولذيذة.' }] },
  { type: 'li', parts: [{ t: 'بازين', b: true }, { t: ' بالصلصة واللحم.' }] },
  { type: 'li', parts: [{ t: 'شربة ليبية', b: true }, { t: ' سخونة للشتا.' }] },
];
export const REPLY_LIBYA = [
  { type: 'p', parts: [{ t: 'ليبيا فيها أماكن' }, { t: ' تهبل،', mark: 'tahbel' }, { t: ' وهذي أحسن اللي' }, { t: ' تستاهل', mark: 'testahel' }, { t: ' الزيارة:' }] },
  { type: 'li', parts: [{ t: 'لبدة الكبرى:', b: true }, { t: ' مدينة رومانية على البحر.' }] },
  { type: 'li', parts: [{ t: 'غدامس:', b: true }, { t: ' «لؤلؤة الصحراء».' }] },
  { type: 'li', parts: [{ t: 'أكاكوس:', b: true }, { t: ' رسوم صخرية عمرها آلاف السنين.' }] },
];
export const REPLY_PHOTO = [
  { type: 'p', parts: [{ t: 'شفت الصورة:' }, { t: ' غروب في الصحراء،', b: true }, { t: ' نخلة وكثبان رملية، والسما برتقالية دافية.' }] },
];

export const K = {
  // hook
  word1: [0.0, 0.25],
  phoneIn: [0.0, 0.5],
  tileIn: 0.62,
  airplane: 1.0,
  glitch: [1.0, 1.32],
  word2: [1.5, 1.75, 2.0],
  drop: 2.0,
  stream0: [2.05, 3.3],
  // logo sting
  zoomOut: [3.3, 3.85],
  bloom: 4.0,
  word: [4.2, 4.85],
  now: 4.65,
  stingOut: [5.25, 5.6],
  // chat
  light: [5.45, 6.05],
  libyan: 6.0,
  tap1: 6.12,
  q1: [6.25, 7.35],
  send1: 7.55,
  think1: [7.7, 8.0],
  stream1: [8.0, 10.55],
  mark: [10.75, 11.25],
  // glossary
  slideDown: [11.9, 12.5],
  gloss: [12.5, 13.0, 13.5, 14.0],
  glossOut: [15.55, 15.95],
  // vision
  snap: 16.0,
  tapCam: 16.15,
  shutter: 16.45,
  send2: 16.95,
  think2: [17.1, 17.4],
  stream2: [17.4, 19.35],
  // privacy
  privacy: 20.0,
  lock: 20.15,
  privTitle: 20.3,
  promises: [21.0, 21.5, 22.0, 22.5],
  privOut: [23.6, 24.0],
  // phone tiers
  tiers: 24.0,
  tierCards: [24.5, 25.0],
  ramFill: [24.7, 25.8],
  once: 26.0,
  tiersOut: [27.3, 27.75],
  // outro
  pickup: [27.625, 27.75, 27.875],
  outro: 28.0,
  outWord: [28.3, 28.95],
  outTag: [28.85, 29.45],
  outAndroid: 29.4,
  outCredit: [29.95, 30.5],
  fadeOut: [31.3, 31.97],
};

const toks = (r) => tokenize(r);
export const TYPE = { q1: typeSchedule(TXT.q1, ...K.q1, 77) };
export const TOK = { dinner: toks(REPLY_DINNER), libya: toks(REPLY_LIBYA), photo: toks(REPLY_PHOTO) };
export const STREAM = {
  dinner: streamSchedule(TOK.dinner, ...K.stream0, 12),
  libya: streamSchedule(TOK.libya, ...K.stream1, 13),
  photo: streamSchedule(TOK.photo, ...K.stream2, 14),
};

export const MUSIC = {
  bpm: BPM,
  bars: 16,
  chords: ['A', 'Dm', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'A', 'Dm', 'Dm'],
  drums: [1, 3, 1, 2, 2, 2, 3, 3, 2, 2, 1, 1, 3, 3, 0, 0],
  drop: { start: -0.3, end: K.drop }, // the hook is muffled ("no signal"), the beat drops at 2.0 s
  introEnd: 0,
  introBars: 1,
  dropBar: -1,
  arpEndBar: 15,
  outroBar: 14,
  quietBars: [2, 10, 11, 14, 15],
  padSplit: [1, 2, 14],
  padAttack0: 0.15,
  lightClapFrom: 10,
  accents: [[6.0, ['D6']], [12.0, ['A5', 'D6']], [16.0, ['D6', 'F6']], [20.0, ['D6']], [24.0, ['D6', 'A6']]],
  motif: [
    [K.bloom - 0.375, 'A4'], [K.bloom - 0.25, 'Bb4'], [K.bloom - 0.125, 'C#5'], [K.bloom, 'D5'],
    [K.pickup[0], 'A4'], [K.pickup[1], 'Bb4'], [K.pickup[2], 'C#5'], [K.outro, 'D5'],
  ],
  end: DURATION,
};

export function buildCues() {
  const c = [];
  const add = (t, id, o = {}) => c.push({ t: +t.toFixed(4), id, ...o });
  // hook
  add(K.word1[0], 'slam', { gain: -1 });
  add(K.word1[1], 'ui_pop', { note: 'D6', gain: -10 });
  add(K.phoneIn[1] - 0.12, 'settle', { gain: -6 });
  add(K.tileIn, 'swish', { dur: 0.4, gain: -14, from: 0, to: 0 });
  add(K.airplane, 'toggle', { gain: -5 });
  add(K.airplane + 0.02, 'glitch', { dur: K.glitch[1] - K.glitch[0], gain: -7 });
  add(K.airplane + 0.05, 'powerdown', { gain: -9 });
  add(1.1, 'riser', { dur: K.drop - 1.1, gain: -6 });
  K.word2.forEach((t, i) => add(t, i < 2 ? 'ui_pop' : 'bloom', i < 2 ? { note: ['F6', 'A6'][i], gain: -11 } : { gain: -4, small: true }));
  add(K.stream0[0], 'stream', { times: STREAM.dinner, gain: -22 });
  // logo sting
  add(K.zoomOut[0], 'whoosh', { dur: 0.7, size: 'big', from: 0, to: 0, gain: -6 });
  add(K.bloom, 'bloom', { gain: -2 });
  add(K.word[0], 'swish', { dur: 0.7, gain: -11, from: 0.4, to: -0.4 });
  add(K.now, 'chime', { notes: ['A5', 'D6'], gain: -14 });
  add(K.stingOut[0], 'whoosh', { dur: 0.7, size: 'soft', from: -0.3, to: 0.3, gain: -9 });
  // chat
  add(K.libyan, 'swish', { dur: 0.6, gain: -12, from: 0.2, to: -0.2 });
  add(K.tap1, 'click', { gain: -12 });
  TYPE.q1.times.forEach((t, i) => TYPE.q1.chars[i] !== ' ' && add(t, 'ink_tick', { seed: 300 + i, gain: -10 }));
  add(K.send1, 'click', { gain: -11 });
  add(K.send1 + 0.02, 'send', { gain: -9 });
  add(K.stream1[0], 'chime', { notes: ['A5', 'D6'], gain: -15 });
  add(K.stream1[0], 'stream', { times: STREAM.libya, gain: -21 });
  add(K.mark[0], 'marker', { gain: -12 });
  add(K.mark[0] + 0.2, 'ui_pop', { note: 'F6', gain: -14 });
  add(K.mark[1], 'marker', { gain: -12 });
  add(K.mark[1] + 0.2, 'ui_pop', { note: 'A6', gain: -14 });
  // glossary
  add(K.slideDown[0], 'whoosh', { dur: 0.7, size: 'soft', from: 0, to: 0, gain: -11 });
  K.gloss.forEach((t, i) => add(t, 'ui_pop', { note: ['D6', 'F6', 'A6', 'C7'][i], gain: -9, pan: i % 2 ? -0.3 : 0.3 }));
  add(K.glossOut[0], 'whoosh', { dur: 0.6, size: 'soft', from: 0.3, to: -0.3, gain: -12 });
  // vision
  add(K.snap, 'swish', { dur: 0.6, gain: -12, from: -0.2, to: 0.2 });
  add(K.tapCam, 'click', { gain: -12 });
  add(K.shutter, 'shutter', { gain: -4 });
  add(K.send2, 'send', { gain: -9 });
  add(K.stream2[0], 'scan', { dur: 1.0, gain: -18 });
  add(K.stream2[0], 'stream', { times: STREAM.photo, gain: -21 });
  // privacy
  add(K.privacy - 0.35, 'dive', { dur: 0.45, gain: -6 });
  add(K.lock, 'lock', { gain: -3 });
  add(K.privTitle, 'swish', { dur: 0.6, gain: -12, from: 0.2, to: -0.2 });
  K.promises.forEach((t, i) => add(t, 'check', { note: ['D5', 'F5', 'A5', 'D6'][i], gain: -8, pan: i % 2 ? -0.25 : 0.25 }));
  add(K.privOut[0], 'whoosh', { dur: 0.7, size: 'soft', from: -0.4, to: 0.4, gain: -8 });
  // tiers
  add(K.tiers + 0.05, 'swish', { dur: 0.6, gain: -12, from: 0, to: 0 });
  K.tierCards.forEach((t, i) => add(t, 'ui_pop', { note: ['A5', 'D6'][i], gain: -10 }));
  add(K.ramFill[0], 'fill', { dur: K.ramFill[1] - K.ramFill[0], gain: -16 });
  add(K.once, 'chime', { notes: ['D6', 'F6'], gain: -14 });
  add(K.tiersOut[0], 'whoosh', { dur: 0.7, size: 'big', from: 0, to: 0, gain: -8 });
  // outro
  add(K.outro, 'bloom', { gain: -2 });
  add(K.outWord[0], 'swish', { dur: 0.7, gain: -11, from: 0.4, to: -0.4 });
  add(K.outAndroid, 'ui_pop', { note: 'D6', gain: -12 });
  add(K.outCredit[0], 'chime', { notes: ['D6', 'F6', 'A6'], gain: -15 });
  return c.sort((a, b) => a.t - b.t);
}

export const seeded = rng;
