# ريكو · Rico — promo film (64 s, 1920×1080, 60 fps)

A launch-style film for [Rico](https://github.com/giumaa/rico-ai), the offline Libyan-Arabic AI assistant:
the hook types itself, the caret traces the kaf of the logo, the app boots and answers in Libyan dialect,
the Wi‑Fi goes off and Rico keeps answering, then privacy, features and the download card.

Final file: [`out/rico_promo.mp4`](out/rico_promo.mp4) (H.264 + AAC, −14 LUFS).

## Storyboard
| Time | Scene | Sound |
|---|---|---|
| 0–8 s | Black. The saffron caret types «تخيّل مساعد ذكي يحكي بلهجتك… ويخدم على جهازك، بدون إنترنت.» then glides to the centre and traces the kaf | a soft A6 tick per glyph, riser, sparkle trail |
| 8–12 s | Bloom: the glyph ignites, the tile springs in, sparks, shockwave, «ريكو / RICO», tagline | sub boom + chime cluster; the sonic logo A–B♭–C♯→D lands on the bloom |
| 12–14 s | Parchment light opens from the logo; the logo flies into the app's welcome screen | big whoosh, settle, UI pops |
| 14–26 s | Click, type «شن أحسن أماكن نزوروها في ليبيا؟», send; Rico streams a Libyan-dialect answer; «تهبل» and «تستاهل» get marked with their فصحى meaning | keyboard, click, send, stream ticks, marker |
| 26–30 s | The window slides right: «يحكي ليبي» + glossary شن/توا/باهي/يعطيك الصحة | pops on the beat |
| 30–40 s | Wi‑Fi switched off → «ما فيش إنترنت؟» — new chat, solar question, Rico answers anyway, «ولا بايت طلع من جهازك»; dive into the sidebar's offline shield | toggle + power‑down; the music goes muffled and comes back when Rico answers |
| 40–48 s | «محمي وخاص» and the app's four promises, one per beat | lock, ascending checks D–F–A–D |
| 48–56 s | Bento: vision, ليبي/فصحى/English, model tiers by RAM, eco mode, dark & light, Windows · macOS · Linux | full groove with a darbuka (maqsum) layer |
| 56–64 s | Logo bloom, tagline, «تطوير وتدريب جمعة أبوراس», download card | sonic logo again, final chord |

All copy and both chat answers come from the app itself (`app/src/renderer/i18n/ar.ts`,
`dev/mockRico.ts`, the persona glossary) so nothing on screen promises more than Rico does.

## How it is built
| Step | Files |
|---|---|
| Single timeline (beats at 120 BPM, text, typing/streaming schedules, sound cues) | `web/timeline.js` |
| Animation — every frame is a pure `renderAt(t)` | `web/promo.js`, `web/promo.css`, `web/lib.js` |
| App replica — same class names + the app's own CSS, logo outline and fonts | `web/app-replica.js`, `web/app-styles/`, `web/assets/` |
| Cue sheet for the audio | `render/export-cues.mjs` → `audio/cues.json` |
| Music + all sound effects, synthesized (numpy/scipy, no samples) | `audio/synth.py` |
| Loudness master (EBU R128, −14 LUFS / −1 dBTP) | `audio/master.sh` |
| Parallel frame capture (Playwright/Chromium) → ffmpeg segments → MP4 | `render/render.mjs` |

Because picture and sound read the same `timeline.js`, moving a moment there moves its sound with it.

## Rebuild
```bash
cd rico-promo
./build.sh                       # ≈10 min on 4 cores
node render/snap.mjs /tmp/stills 8.1 25.6 45   # stills for review
node render/serve.mjs 8080       # live preview at http://127.0.0.1:8080 (click to play, ← → to seek)
```
Needs Node 18+, Python 3 with numpy/scipy, ffmpeg and Playwright's Chromium.

## Credits
Fonts: Aref Ruqaa, Merienda, JetBrains Mono (SIL OFL 1.1, `web/assets/fonts/`). Icons: Lucide (ISC,
`web/assets/LICENSE-lucide.txt`). App styles, strings and logo outline: [giumaa/rico-ai](https://github.com/giumaa/rico-ai) (MIT).
