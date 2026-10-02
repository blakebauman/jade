#!/bin/sh
# Rebuilds the favicon and every PNG icon from the authored mark (scripts/icon-mark.mjs). Needs rsvg-convert (brew install librsvg).
set -e
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
node scripts/icon-mark.mjs public/favicon.svg small
node scripts/icon-mark.mjs "$tmp/rounded.svg" rounded
node scripts/icon-mark.mjs "$tmp/bleed.svg" bleed
node scripts/icon-mark.mjs "$tmp/maskable.svg" maskable
rsvg-convert -w 192 -h 192 "$tmp/rounded.svg" -o public/icon-192.png
rsvg-convert -w 512 -h 512 "$tmp/rounded.svg" -o public/icon-512.png
rsvg-convert -w 512 -h 512 "$tmp/maskable.svg" -o public/icon-maskable-512.png
# iOS rounds the corners itself and fills transparency with black, so the touch icon is full bleed.
rsvg-convert -w 180 -h 180 --background-color "#0e4f43" "$tmp/bleed.svg" -o public/apple-touch-icon.png
rm -r "$tmp"
