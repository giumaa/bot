# Checkmate (كش ملك) — first-person short, 9:16

A ~30 s vertical short: you stand on an endless marble chessboard in fog and a storm. Giant
pieces fall from the clouds around you (impact, dust, cracking tiles). You kneel to look at a crack
creeping under your feet. A shadow sweeps over you. You turn around: a colossal black king is
rising behind you into the clouds, lit by lightning. It topples onto the camera. Cut to black.
One small click of a chess piece. «كش ملك.»

Captions frame it like a lesson: *Rule I: The board has no edge. Rule II: Every piece falls.
Rule III: Never turn your back on the King.*

## Final edit (ChatCut)
Project: https://app.chatcut.io/editor/761d376d-21e7-4dc8-8e2d-9731fb371c45 (1080x1920, 24 fps, 29.5 s)
- V1 `Blender scenes`: the rendered first-person oner (frames 0-585), hard cut to black at 24.42 s.
- V2 `Titles`: three `Rule Caption` motion graphics + `Checkmate End Title` (Aref Ruqaa «كش ملك.» / CHECKMATE).
- A1-A13: storm bed, drone, 40+ timed SFX (whistles, impacts, debris, thunder, cracking, rumble, heartbeat,
  braam, stone groans, riser) incl. ChatCut library Taiko Hit / Deep Short Whoosh / Dramatic Thunder Roll.
- A14-A15 `Breathing`: shaky -> fast scared -> gasp -> panic -> gasp -> panic, silenced by the cut.
- Silence on black, then the chess-piece click at 25.65 s and the title.

## Pipeline
| Step | Tool | Files |
|---|---|---|
| Scene, animation, lighting, camera | Blender 4.5 (Cycles), fully procedural | `blender/build_scene.py` |
| Rendering | Blender headless | `blender/render_frames.py` |
| Captions / end title | Pillow (Cinzel, Aref Ruqaa — OFL) | `graphics/make_titles.py` |
| Sound effects + breathing | numpy/scipy synthesis | `audio/synth_sfx.py`, `audio/synth_breath.py`, `audio/cues_chatcut.py` |
| Edit, sound design, export | ChatCut (MCP) | `../tools/chatcut_mcp.py` |
| Segment encode for upload | ffmpeg | `encode_part.sh` |
| Local fallback edit | ffmpeg | `assemble_local.sh` |

## Rebuild
```bash
blender -b -y --python blender/build_scene.py -- blender/checkmate.blend
blender -b -y blender/checkmate.blend --python blender/render_frames.py -- render/frames 90 8 0-590
python3 audio/synth_sfx.py audio/sfx && python3 audio/mix.py audio/sfx audio/soundtrack_fallback.wav
python3 graphics/make_titles.py
./assemble_local.sh render/frames audio/soundtrack_fallback.wav out/checkmate_local.mp4
```
