#!/usr/bin/env bash
# Join candidate sounds into one file with 1.2 s silence between them, for a single listening pass.
# usage: concat_candidates.sh out.mp3 a.mp3 b.wav ...   (needs ffmpeg; free, offline)
set -euo pipefail
out=$1; shift; n=$#; i=0; inp=(); fc=""; cat=""
for f in "$@"; do inp+=(-i "$f"); fc+="[$i]aformat=channel_layouts=mono,aresample=44100,apad=pad_dur=1.2[a$i];"; cat+="[a$i]"; echo "$((i+1)). $f"; i=$((i+1)); done
ffmpeg -v error -y "${inp[@]}" -filter_complex "${fc}${cat}concat=n=$n:v=0:a=1" -b:a 128k "$out"
echo "wrote $out"
