# Kinescope + Telegram + Instagram Video Downloader

> A Chrome extension that (1) extracts video, audio, and subtitle URLs from [Kinescope](https://kinescope.io) player embeds for use with `yt-dlp`, (2) downloads videos directly from [Telegram Web (WebK)](https://web.telegram.org/k/) with a one-click on-page button, and (3) downloads [Instagram](https://www.instagram.com) reels and video posts the same way.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?logo=googlechrome)
![License: MIT](https://img.shields.io/badge/License-MIT-green)

---

## What it does

When you visit a page with a Kinescope video embed, this extension detects it, fetches the player configuration, and shows you:

- **Direct HLS video URLs** for every available quality (360p, 720p, 1080p, etc.)
- **Audio-only stream** URL
- **Ready-to-run `yt-dlp` commands** — just paste into your terminal
- **Subtitle download buttons** for every available language (`.vtt` files)

Works on pages with multiple embeds — each video gets its own card in the popup.

On **Telegram Web (WebK)** and **Instagram**, it adds a separate **⬇ Download video** button while a video is open, and saves the file straight to disk.

On the **Kinescope player** itself it also overlays two one-click buttons — **⬇ Видео** (mp4 with sound) and **⬇ Аудио** (m4a) — for when you don't want to touch the terminal (see below).

---

## Kinescope: one-click player buttons

Besides the copy-command popup, the extension overlays a small toolbar on the Kinescope player with two universal buttons that download straight to `~/Downloads`:

- **⬇ Видео** — best video + audio, muxed into a single `.mp4`
- **⬇ Аудио** — audio-only `.m4a`

Kinescope serves video and audio as **separate** HLS tracks (and a 1080p lecture can be ~1 GB), so muxing in the browser would be fragile and memory-heavy. Instead the button hands the fresh signed `master.m3u8` to a tiny **native-messaging host** that runs your local **`yt-dlp`** — it streams to disk, does the mux, and reports live progress back onto the button (`… 42%` → `✓ Готово`).

### One-time setup

Requires `yt-dlp` and `ffmpeg` on your machine (`brew install yt-dlp ffmpeg`), then register the native host:

1. Load the extension (Developer Mode → **Load unpacked**), then copy its **ID** from `chrome://extensions`.
2. Run the installer with that ID and restart Chrome:
   ```bash
   ./native-host/install.sh <EXTENSION_ID>
   ```

The installer writes `com.kinescope.downloader.json` into Chrome's `NativeMessagingHosts` folder (macOS) pointing at `native-host/kinescope_dl.py`. Change the download folder by editing the `DOWNLOAD_DIR` line in that script; adjust `PATH` there if your `yt-dlp`/`ffmpeg` live outside `/opt/homebrew/bin` or `/usr/local/bin`.

The signed URL is re-extracted on every click, so it never goes stale. macOS only for now (the host path is Chrome-on-macOS); other OSes need their platform's `NativeMessagingHosts` location.

---

## Instagram

Instagram plays reels via MSE, so the `<video>` element only has a `blob:` URL — there's nothing to grab from it directly. But every reel's **progressive MP4 URL** ships inside the page's own JSON: the server-rendered `<script type="application/json">` blobs on first load, and the GraphQL `fetch` responses while you scroll the feed.

This extension injects `instagram.js` into `www.instagram.com` in the **MAIN world**. It:

1. Wraps `window.fetch` (installed at `document_start`) and parses the SSR JSON, harvesting a `shortcode → MP4 URL` map from every media node's `video_versions`
2. Shows a fixed **⬇ Download video** button (top-right) whenever the current `/reels/<code>/` (or `/reel/`, `/p/`, `/tv/`) URL has a known video
3. Fetches that MP4 and saves it as `instagram-<code>.mp4`, with a live progress percentage

**Quality** is the top `video_versions` entry (Instagram lists highest first). The button tracks the active reel as you scroll, since Instagram updates the URL per reel.

---

## Telegram Web (WebK)

Telegram streams video through a service worker that serves the file as `stream/{...}` URLs in 1 MiB `206` range chunks — there is no plain blob to grab, and the browser's own "Save Video As" is often unavailable (e.g. content-protected channels).

This extension injects `telegram.js` into `web.telegram.org` in the **MAIN world** (same context as the page, so its `fetch` goes through Telegram's service worker). While a video is open in the player it shows a fixed **⬇ Download video** button (top-right) that:

1. Reads the playing `video.ckin__video` element's stream URL
2. Re-fetches the whole file sequentially via `Range: bytes=<pos>-` requests and assembles a `Blob`
3. Saves it with the original filename embedded in the stream URL

**Quality** follows whatever variant is selected in Telegram's own ⚙ player menu — set it there before downloading. The full file is assembled in memory, so very large videos (multi-GB) may exceed available RAM.

Requires Chrome 111+ (for MAIN-world content scripts).

---

## Screenshot

<!-- Add a screenshot or GIF here once the extension is loaded -->
> _Open the extension popup on any page containing a Kinescope embed to see the interface._

---

## Features

- Automatically scans the active tab for `kinescope.io/embed/` iframes
- Fetches `playerOptions` from the embed page via the background service worker (no page scraping required)
- Displays video poster thumbnail for easy identification
- Quality selector dropdown — copy the URL for the resolution you want
- One-click **Copy URL** buttons for video and audio streams
- One-click **Copy yt-dlp command** — the command includes the correct `--referer` header
- Individual **Download** buttons for each subtitle track
- Clean dark-themed popup UI

---

## Installation

The extension is not published to the Chrome Web Store. Install it in **Developer Mode**:

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/kinescope-video-downloader.git
   ```

2. Open Chrome and go to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the root folder of this repository

5. The extension icon will appear in your toolbar. Pin it for easy access.

---

## Usage

1. Navigate to any webpage that embeds a Kinescope video player
2. Click the extension icon in the Chrome toolbar
3. The popup will list all detected videos on the page

For each video you can:

| Action | How |
|--------|-----|
| Download with yt-dlp | Click **Copy yt-dlp command**, then paste in terminal |
| Get raw video URL | Select quality from the dropdown → click **Copy video URL** |
| Get audio-only URL | Click **Copy audio URL** |
| Download subtitles | Click the **↓** button next to any subtitle language |

### Downloading with yt-dlp

Install [yt-dlp](https://github.com/yt-dlp/yt-dlp) if you haven't already:

```bash
# macOS
brew install yt-dlp

# Windows (via pip)
pip install yt-dlp

# Linux
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

Then paste the copied command — it will look like this:

```bash
yt-dlp "https://kinescope.io/hls/video-id/master.m3u8" \
  --referer "https://kinescope.io/embed/video-id" \
  -o "%(title)s.%(ext)s"
```

---

## How it works

```
Page with Kinescope embed
         │
         ▼
  content-script.js          ← scans DOM for kinescope.io/embed/ iframes,
         │                     sends iframe URLs to the popup
         ▼
  service-worker.js          ← receives iframe URLs, fetches embed page HTML,
         │                     extracts playerOptions JSON via regex
         ▼
  popup/popup.js             ← receives playerOptions, builds the UI:
                               thumbnails, quality selectors, copy buttons, subtitle links
```

No data is sent to any external server. All processing happens locally in the browser.

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/your-username/kinescope-video-downloader.git
cd kinescope-video-downloader
npm install
```

### Regenerate icons

Icons are generated from an SVG template using Playwright:

```bash
node gen_icons.js
```

This outputs `icons/icon16.png`, `icon32.png`, `icon48.png`, and `icon128.png`.

### Debug utilities

Two Playwright scripts are included to help inspect Kinescope embeds without loading the full Chrome extension:

```bash
# Capture all network requests and playerOptions from a page
node analyze_page.js

# Extract subtitle data from playerOptions
node analyze_subs.js
```

Edit the `TARGET_URL` constant at the top of each script before running.

If the target page requires authentication, export your cookies using a browser extension (e.g. [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg)) and save them to `cookies.json` in the project root. This file is excluded from git via `.gitignore`.

### Project structure

```
kinescope-video-downloader/
├── manifest.json          # Extension manifest (v3)
├── service-worker.js      # Background: fetches embed pages, extracts playerOptions, bridges the native host
├── content-script.js      # Injected into every tab: scans for Kinescope iframes
├── kinescope-player.js    # Injected into the kinescope.io/embed frame: ⬇ Видео / ⬇ Аудио player buttons
├── native-host/
│   ├── kinescope_dl.py    # Native-messaging host: runs yt-dlp, streams progress
│   ├── com.kinescope.downloader.json  # Host manifest template
│   └── install.sh         # Registers the host for a given extension ID (macOS)
├── telegram.js            # MAIN-world script for web.telegram.org: download button + chunked fetch
├── test_telegram.js       # Test: verifies the chunked range-assembly loop
├── instagram.js           # MAIN-world script for instagram.com: harvests MP4 URLs from page JSON + download button
├── test_instagram.js      # Test: verifies JSON walking and shortcode extraction
├── popup/
│   ├── popup.html         # Extension popup markup
│   ├── popup.js           # Popup logic: renders videos, handles user interactions
│   └── popup.css          # Dark theme styling
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── gen_icons.js           # Icon generation utility (uses Playwright)
├── analyze_page.js        # Dev utility: inspect page iframes & network
└── analyze_subs.js        # Dev utility: inspect subtitle data
```

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Google Chrome | 88+ (Manifest V3 support) |
| yt-dlp | Any recent version (for downloading) |
| Node.js | 18+ (for development only) |

---

## Limitations

- **Three platforms only.** The popup targets `kinescope.io` embeds; the download button targets `web.telegram.org` (WebK, the `/k/` client) and `www.instagram.com`. Other platforms are not supported.
- **No DRM.** Videos protected with DRM cannot be downloaded.
- **Kinescope: requires page access.** The content script runs when you open the popup; if the embed is inside a deeply nested cross-origin frame, detection may not work. The popup only works on Kinescope pages — opening it elsewhere shows a harmless "Receiving end does not exist" error.
- **Kinescope: HLS streams only.** The extension extracts HLS (`.m3u8`) URLs. `yt-dlp` handles reassembly into a standard video file.
- **Telegram: quality is whatever the player has selected**, and the whole file is buffered in memory before saving (heavy for multi-GB videos).
- **Instagram: video only,** from page JSON. Reels and video posts work; the button only appears once that reel's data has loaded. Whole file is buffered in memory (fine for short reels). If a CDN URL ever blocks cross-origin fetch, the fix is to route it through the service worker's `chrome.downloads`.

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

[MIT](LICENSE)
