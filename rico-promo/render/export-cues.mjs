// Writes audio/cues.json (sound cue sheet + music plan) from web/timeline.js — the single source of
// truth shared with the animation.
import { writeFile } from 'node:fs/promises';
import { BAR, BEAT, BPM, DURATION, FPS, K, MUSIC, buildCues } from '../web/timeline.js';

const out = { fps: FPS, duration: DURATION, bpm: BPM, beat: BEAT, bar: BAR, music: MUSIC, keys: K, cues: buildCues() };
const file = new URL('../audio/cues.json', import.meta.url);
await writeFile(file, JSON.stringify(out, null, 1));
console.log(`wrote ${out.cues.length} cues → audio/cues.json`);
