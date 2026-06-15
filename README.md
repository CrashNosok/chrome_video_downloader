# Kinescope Video Downloader

> A Chrome extension that extracts video, audio, and subtitle URLs from [Kinescope](https://kinescope.io) player embeds — so you can download your own content with `yt-dlp`.

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
├── service-worker.js      # Background: fetches embed pages, extracts playerOptions
├── content-script.js      # Injected into every tab: scans for Kinescope iframes
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

- **Kinescope only.** This extension specifically targets `kinescope.io` embeds. It will not work with Vimeo, YouTube, or other video platforms.
- **No DRM.** Videos protected with DRM cannot be downloaded.
- **Requires page access.** The content script runs when you open the popup; if the embed is inside a deeply nested cross-origin frame, detection may not work.
- **HLS streams only.** The extension extracts HLS (`.m3u8`) URLs. `yt-dlp` handles reassembly into a standard video file.

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
