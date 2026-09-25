#!/usr/bin/env bash
# Encode a frame range of the Blender render to a graded 1080x1920 mp4 part (no audio).
# Usage: ./encode_part.sh <first_frame> <last_frame> <out.mp4>
set -euo pipefail
A=$1; B=$2; OUT=$3
N=$((B - A + 1))
FR=$(dirname "$0")/render/frames
nice -n 15 ffmpeg -y -loglevel error -framerate 24 -start_number "$A" -i "$FR/f%04d.png" -frames:v "$N" \
  -vf "scale=1080:1920:flags=lanczos,eq=contrast=1.06:saturation=0.92,curves=r='0/0.015 0.5/0.48 1/0.97':g='0/0.015 0.5/0.5 1/0.98':b='0/0.035 0.5/0.53 1/1',unsharp=5:5:0.35,noise=alls=2:allf=t,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -maxrate 8800k -bufsize 17600k -r 24 -pix_fmt yuv420p -movflags +faststart -threads 4 "$OUT"
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,width,height,r_frame_rate -of csv=p=0 "$OUT"
