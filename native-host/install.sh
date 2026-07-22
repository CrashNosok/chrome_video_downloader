#!/usr/bin/env bash
# One-time setup for the Kinescope download buttons.
# Registers the native-messaging host so the extension can drive yt-dlp.
#
# Usage:  ./install.sh <EXTENSION_ID>
# Find <EXTENSION_ID> at chrome://extensions (enable Developer mode) — it's the
# long id under this extension after you Load unpacked.
set -euo pipefail

EXT_ID="${1:-}"
if [[ -z "$EXT_ID" ]]; then
  echo "Usage: $0 <EXTENSION_ID>"
  echo "  Get the id from chrome://extensions (Developer mode → this extension)."
  exit 1
fi

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PY="$DIR/kinescope_dl.py"
HOST_NAME="com.kinescope.downloader"

chmod +x "$HOST_PY"

# Native-messaging host dir for Chrome on macOS.
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$TARGET_DIR"

sed -e "s|__HOST_PATH__|$HOST_PY|" -e "s|__EXTENSION_ID__|$EXT_ID|" \
  "$DIR/$HOST_NAME.json" > "$TARGET_DIR/$HOST_NAME.json"

echo "✓ Installed $TARGET_DIR/$HOST_NAME.json"
echo "  host: $HOST_PY"
echo "  extension: $EXT_ID"
echo "Restart Chrome, open a lesson, and use the ⬇ Видео / ⬇ Аудио buttons on the player."

# Sanity: yt-dlp reachable with the same PATH the host uses?
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if command -v yt-dlp >/dev/null && command -v ffmpeg >/dev/null; then
  echo "✓ yt-dlp: $(command -v yt-dlp)   ffmpeg: $(command -v ffmpeg)"
else
  echo "⚠ yt-dlp or ffmpeg not found on PATH — install them (brew install yt-dlp ffmpeg)."
fi
