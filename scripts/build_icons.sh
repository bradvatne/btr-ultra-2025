#!/usr/bin/env bash
# Generate PWA icons from favicon.svg.
# Idempotent — re-run after swapping favicon.svg to regenerate all sizes.
#
# Usage: bash scripts/build_icons.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/favicon.svg"
ICONS_DIR="$ROOT/icons"

if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found" >&2
  exit 1
fi

mkdir -p "$ICONS_DIR"

# ImageMagick can't render <text> without a registered font on macOS.
# Strip the <text> element from a render copy — at icon sizes the text is
# unreadable anyway, the mountain silhouette is the recognizable shape.
RENDER_SRC="$(mktemp -t btr-icon-XXXXXX).svg"
trap 'rm -f "$RENDER_SRC" /tmp/btr-icon-inner.png' EXIT
sed -E '/<text[^>]*>.*<\/text>/d' "$SRC" > "$RENDER_SRC"

# Pick a rasterizer.
RASTER=""
if command -v rsvg-convert >/dev/null 2>&1; then
  RASTER="rsvg"
elif command -v magick >/dev/null 2>&1; then
  RASTER="magick"
elif command -v convert >/dev/null 2>&1; then
  RASTER="convert"
else
  echo "ERROR: need rsvg-convert or imagemagick (magick/convert)" >&2
  exit 1
fi

echo "==> Using $RASTER"

render() {
  local size=$1 out=$2 bg=$3
  case "$RASTER" in
    rsvg)
      rsvg-convert -w "$size" -h "$size" -b "$bg" "$RENDER_SRC" -o "$out"
      ;;
    magick)
      magick -background "$bg" -density 512 "$RENDER_SRC" -resize "${size}x${size}" "$out"
      ;;
    convert)
      convert -background "$bg" -density 512 "$RENDER_SRC" -resize "${size}x${size}" "$out"
      ;;
  esac
  echo "    wrote $(basename "$out") (${size}x${size})"
}

# Standard icons — transparent background; favicon.svg has its own rounded
# black tile so we keep the source design intact.
render 192 "$ICONS_DIR/icon-192.png"   none
render 512 "$ICONS_DIR/icon-512.png"   none
# Maskable icon: needs solid background that fills the entire square so iOS/Android
# can clip it to any shape without showing transparent corners. We render the
# 64-viewBox SVG at 80% of the canvas so there's safe-zone padding around the art.
case "$RASTER" in
  rsvg)
    rsvg-convert -w 410 -h 410 "$RENDER_SRC" -o /tmp/btr-icon-inner.png
    magick -size 512x512 xc:'#0a0a0a' /tmp/btr-icon-inner.png -gravity center -composite "$ICONS_DIR/icon-maskable-512.png"
    ;;
  magick|convert)
    magick -background none -density 512 "$RENDER_SRC" -resize 410x410 /tmp/btr-icon-inner.png
    magick -size 512x512 xc:'#0a0a0a' /tmp/btr-icon-inner.png -gravity center -composite "$ICONS_DIR/icon-maskable-512.png"
    ;;
esac
echo "    wrote icon-maskable-512.png (512x512, padded for maskable)"

# Apple touch icon: 180×180, solid background (no transparency, iOS ignores transparency anyway).
render 180 "$ROOT/apple-touch-icon.png" '#0a0a0a'

echo "==> Done"
ls -la "$ICONS_DIR" "$ROOT/apple-touch-icon.png"
