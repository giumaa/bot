#!/usr/bin/env bash
# Local fallback edit: frames + captions + end title + soundtrack -> 1080x1920 mp4.
# Usage: ./assemble_local.sh <frames_dir> <soundtrack.wav> <out.mp4>
set -euo pipefail
FR=${1:-render/frames}; SND=${2:-audio/soundtrack_fallback.wav}; OUT=${3:-out/checkmate_local.mp4}
G=graphics/png
mkdir -p "$(dirname "$OUT")"
CUT_FRAME=586          # last rendered frame used (24.42s)
CUT=$(python3 -c "print(${CUT_FRAME}/24)")
ffmpeg -y -loglevel error -stats \
  -framerate 24 -start_number 0 -i "$FR/f%04d.png" \
  -loop 1 -framerate 24 -i $G/rule1.png -loop 1 -framerate 24 -i $G/rule2.png -loop 1 -framerate 24 -i $G/rule3.png \
  -loop 1 -framerate 24 -i $G/checkmate_ar.png \
  -i "$SND" \
  -filter_complex "
  [0:v]trim=end_frame=${CUT_FRAME},setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,
       eq=contrast=1.08:saturation=0.9:gamma=0.97,
       curves=r='0/0.02 0.5/0.47 1/0.96':g='0/0.02 0.5/0.5 1/0.98':b='0/0.05 0.5/0.54 1/1',
       noise=alls=7:allf=t,unsharp=5:5:0.4,format=yuv420p,
       tpad=stop_mode=add:stop_duration=$(python3 -c "print(29.5-${CUT})"):color=black[base];
  [1:v]format=rgba,fade=in:st=0.6:d=0.5:alpha=1,fade=out:st=3.6:d=0.5:alpha=1,trim=end=4.2[r1];
  [2:v]format=rgba,fade=in:st=5.4:d=0.4:alpha=1,fade=out:st=9.3:d=0.4:alpha=1,trim=end=9.8[r2];
  [3:v]format=rgba,fade=in:st=11.4:d=0.5:alpha=1,fade=out:st=14.7:d=0.4:alpha=1,trim=end=15.2[r3];
  [4:v]format=rgba,fade=in:st=25.8:d=0.35:alpha=1,fade=out:st=28.9:d=0.6:alpha=1,trim=end=29.5[t];
  [base][r1]overlay=0:0:eof_action=pass[a];[a][r2]overlay=0:0:eof_action=pass[b];
  [b][r3]overlay=0:0:eof_action=pass[c];[c][t]overlay=0:0:eof_action=pass,format=yuv420p[v]" \
  -map "[v]" -map 5:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -r 24 \
  -c:a aac -b:a 256k -t 29.5 -movflags +faststart "$OUT"
echo "done: $OUT"
