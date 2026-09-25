# Checkmate (كش ملك) — first-person short, 9:16

A ~30 s vertical short: you stand on an endless marble chessboard in fog and a storm. Giant
pieces fall from the clouds around you (impact, dust, cracking tiles). You kneel to look at a crack
creeping under your feet. A shadow sweeps over you. You turn around: a colossal black king is
rising behind you into the clouds, lit by lightning. It topples onto the camera. Cut to black.
One small click of a chess piece. «كش ملك.»

Captions frame it like a lesson: *Rule I: The board has no edge. Rule II: Every piece falls.
Rule III: Never turn your back on the King.*

## Pipeline
| Step | Tool | Files |
|---|---|---|
| Scene, animation, lighting, camera | Blender 4.5 (Cycles), fully procedural | `blender/build_scene.py` |
| Rendering | Blender headless | `blender/render_frames.py` |
| Captions / end title | Pillow (Cinzel, Aref Ruqaa — OFL) | `graphics/make_titles.py` |
| Sound effects (backup pack) | numpy/scipy synthesis | `audio/synth_sfx.py`, `audio/mix.py` |
| Edit, sound design, export | ChatCut (MCP) | `../tools/chatcut_mcp.py` |
| Local fallback edit | ffmpeg | `assemble_local.sh` |

## Rebuild
```bash
blender -b -y --python blender/build_scene.py -- blender/checkmate.blend
blender -b -y blender/checkmate.blend --python blender/render_frames.py -- render/frames 90 8 0-590
python3 audio/synth_sfx.py audio/sfx && python3 audio/mix.py audio/sfx audio/soundtrack_fallback.wav
python3 graphics/make_titles.py
./assemble_local.sh render/frames audio/soundtrack_fallback.wav out/checkmate_local.mp4
```
