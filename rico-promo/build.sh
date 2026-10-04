#!/usr/bin/env bash
# Full rebuild of the Rico promo film: cue sheet → soundtrack → master → frames → MP4.
set -euo pipefail
cd "$(dirname "$0")"
node render/export-cues.mjs                # web/timeline.js → audio/cues.json
python3 audio/synth.py                      # → audio/soundtrack.wav (+ stems/)
./audio/master.sh                           # → audio/soundtrack_master.m4a (-14 LUFS, -1 dBTP)
cp audio/soundtrack_master.m4a web/soundtrack.m4a   # live preview plays it in sync
node render/render.mjs --workers "${WORKERS:-4}" --out out/rico_promo_master.mp4
# delivery encode (≈40 MB, SSIM ≈ 0.996 vs the master)
ffmpeg -hide_banner -loglevel error -y -i out/rico_promo_master.mp4 -c:v libx264 -preset slow -crf 19 -tune film \
  -pix_fmt yuv420p -c:a copy -movflags +faststart out/rico_promo.mp4
rm out/rico_promo_master.mp4

# 9:16 Reels / Shorts version (same timeline and soundtrack, re-laid-out for a phone screen)
node render/render.mjs --workers "${WORKERS:-4}" --format vertical --out out/rico_promo_reels_master.mp4
ffmpeg -hide_banner -loglevel error -y -i out/rico_promo_reels_master.mp4 -c:v libx264 -preset slow -crf 19 -tune film \
  -pix_fmt yuv420p -c:a copy -movflags +faststart out/rico_promo_reels.mp4
rm out/rico_promo_reels_master.mp4
