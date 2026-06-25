// Instagram video downloader — runs in MAIN world on instagram.com.
// Reels play via MSE (blob: src), so the <video> element exposes no real URL.
// But every reel's progressive MP4 ships inside the page JSON — SSR
// <script type="application/json"> blobs on first load, and GraphQL fetch
// responses while scrolling — under each media node's `video_versions`.
// We harvest those keyed by shortcode and blob-download the one matching the
// current /reels/<code>/ URL. Quality = top entry (IG lists highest first).
(() => {
  // --- pure, testable bits ---------------------------------------------------
  const bestVideoUrl = (versions) =>
    Array.isArray(versions) && versions.length ? versions[0].url : null; // [0] = highest

  const shortcodeFromPath = (path) =>
    (path.match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || null;

  // Walk any parsed JSON; record code -> best mp4 url for every media node
  // carrying both `code` and `video_versions` (they sit on the same object).
  function collectVideos(node, out = {}) {
    if (Array.isArray(node)) {
      for (const v of node) collectVideos(v, out);
    } else if (node && typeof node === 'object') {
      if (node.code && Array.isArray(node.video_versions)) {
        const url = bestVideoUrl(node.video_versions);
        if (url) out[node.code] = url;
      }
      for (const k in node) collectVideos(node[k], out);
    }
    return out;
  }

  // Node export for test_instagram.js; bail before touching the DOM.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { collectVideos, bestVideoUrl, shortcodeFromPath };
    return;
  }

  // --- live extension --------------------------------------------------------
  const VIDEOS = {}; // shortcode -> mp4 url
  const add = (obj) => { try { collectVideos(obj, VIDEOS); } catch {} };

  // Harvest from GraphQL/api fetch responses as you browse. Installed first
  // (document_start) so it's in place before IG fires its own requests.
  // ponytail: fetch only — if some reels never resolve, also wrap XMLHttpRequest.
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args);
    p.then((r) => r.clone().text())
      .then((t) => { try { add(JSON.parse(t)); } catch {} })
      .catch(() => {});
    return p;
  };

  // Seed from SSR JSON in the DOM — deferred since at document_start it's empty.
  const seedSSR = () => {
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      try { add(JSON.parse(s.textContent)); } catch {}
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', seedSSR);
  else seedSSR();

  const BTN_ID = 'ig-video-dl-btn';

  function ensureButton() {
    const code = shortcodeFromPath(location.pathname);
    const url = code ? VIDEOS[code] : null;
    const existing = document.getElementById(BTN_ID);
    if (!url) { existing && existing.remove(); return; }
    if (existing) { existing.dataset.url = url; return; }

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.dataset.url = url;
    btn.textContent = '⬇ Скачать видео';
    Object.assign(btn.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: 999999,
      padding: '8px 14px', background: '#d6249f', color: '#fff', border: 'none',
      borderRadius: '8px', font: '600 14px/1 system-ui, sans-serif', cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,.35)',
    });
    btn.addEventListener('click', () => download(btn));
    document.body.appendChild(btn);
  }

  async function download(btn) {
    const url = btn.dataset.url;
    const code = shortcodeFromPath(location.pathname) || 'video';
    const label = '⬇ Скачать видео';
    btn.disabled = true;
    try {
      // ponytail: reels are short (a few MB) so whole file in RAM is fine. If a
      // CDN URL ever blocks cross-origin fetch (CORS), route it through the
      // service worker's chrome.downloads.download({url}) via a postMessage bridge.
      const resp = await fetch(url);
      const total = +resp.headers.get('content-length') || 0;
      const reader = resp.body.getReader();
      const chunks = []; let pos = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); pos += value.length;
        if (total) btn.textContent = `${(pos / total * 100).toFixed(0)}%`;
      }
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `instagram-${code}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      btn.textContent = '✓ Готово';
    } catch (e) {
      btn.textContent = '✗ Ошибка';
      console.error('[ig-video-dl]', e);
    } finally {
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2500);
    }
  }

  // ponytail: 1s poll, same as telegram.js — button tracks the active reel
  // without a MutationObserver/history hook.
  setInterval(ensureButton, 1000);
})();
