// Writes audio/reel_cues.json from web/reel-timeline.js (same format as export-cues.mjs).
import { writeFile } from 'node:fs/promises';
import { BAR, BEAT, BPM, DURATION, FPS, K, MUSIC, buildCues } from '../web/reel-timeline.js';

const out = { fps: FPS, duration: DURATION, bpm: BPM, beat: BEAT, bar: BAR, music: MUSIC, keys: K, cues: buildCues() };
await writeFile(new URL('../audio/reel_cues.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`wrote ${out.cues.length} cues → audio/reel_cues.json`);
