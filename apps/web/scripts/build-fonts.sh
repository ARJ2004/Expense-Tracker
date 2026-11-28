#!/usr/bin/env bash
# Subsets the exact font files the app ships into small woff2 files for the website.
# Dev-only (needs: pip install fonttools brotli). The output in public/fonts is committed.
# The version suffix in each name lets the files be cached forever; bump it when the fonts change.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=../mobile/android/app/src/main/assets/fonts
OUT=public/fonts
V=v1
mkdir -p "$OUT"
# Latin, Latin-1, general punctuation, ₹, arrows, multiplication/division signs.
TEXT_RANGES="U+0020-007E,U+00A0-00FF,U+2010-2027,U+2030-203A,U+20B9,U+2190-2193,U+2212,U+00D7,U+00F7"
for face in Regular Medium SemiBold Bold; do
  pyftsubset "$SRC/PlusJakartaSans-$face.ttf" --unicodes="$TEXT_RANGES" --layout-features='kern,liga,tnum,lnum' \
    --flavor=woff2 --output-file="$OUT/plus-jakarta-sans-${face,,}.$V.woff2"
done
for face in Medium SemiBold; do
  pyftsubset "$SRC/IBMPlexMono-$face.ttf" --unicodes="$TEXT_RANGES" --layout-features='kern' \
    --flavor=woff2 --output-file="$OUT/ibm-plex-mono-${face,,}.$V.woff2"
done
# The wordmark only needs the letters of "Altus".
pyftsubset "$SRC/Montserrat-ExtraBold.ttf" --text="Altus" --flavor=woff2 --output-file="$OUT/montserrat-extrabold.$V.woff2"
ls -la "$OUT"
