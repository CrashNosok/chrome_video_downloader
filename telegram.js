// Telegram Web (WebK) video downloader — runs in MAIN world on web.telegram.org.
// WebK plays video via a service-worker `stream/{...}` URL that serves 206 range
// chunks (~1 MiB). We re-fetch the whole range sequentially and assemble a Blob.
// Quality = whatever variant is selected in Telegram's own ⚙ player menu.
(() => {
  // Pure assembly loop, isolated so it's testable. fetchImpl(url, {headers}) -> Response-like.
  async function fetchRanges(url, fetchImpl, onProgress) {
    const chunks = [];
    let pos = 0, total = Infinity;
    while (pos < total) {
      const resp = await fetchImpl(url, { headers: { Range: `bytes=${pos}-` } });
      const cr = resp.headers.get('content-range'); // "bytes start-end/TOTAL"
      total = cr ? +cr.split('/')[1] : (+resp.headers.get('content-length') || 0);
      if (!total) break;
      const buf = await resp.arrayBuffer();
      if (!buf.byteLength) break;
      chunks.push(buf);
      pos += buf.byteLength;
      onProgress && onProgress(pos, total);
    }
    return chunks;
  }

  // Node export for test_telegram.js; bail before touching the DOM.
  if (typeof module !== 'undefined' && module.exports) { module.exports = { fetchRanges }; return; }

  const BTN_ID = 'tg-video-dl-btn';

  function ensureButton() {
    const video = document.querySelector('video.ckin__video');
    const existing = document.getElementById(BTN_ID);
    if (!video) { existing && existing.remove(); return; }
    if (existing) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '⬇ Скачать видео';
    Object.assign(btn.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: 999999,
      padding: '8px 14px', background: '#3390ec', color: '#fff', border: 'none',
      borderRadius: '8px', font: '600 14px/1 system-ui, sans-serif', cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,.35)',
    });
    btn.addEventListener('click', () => download(btn));
    document.body.appendChild(btn);
  }

  async function download(btn) {
    const video = document.querySelector('video.ckin__video');
    if (!video) return;
    const url = new URL(video.getAttribute('src') || video.src, location.href).href;
    // The WebK stream URL embeds the original fileName — use it if present.
    let name = 'telegram-video.mp4';
    try { name = JSON.parse(decodeURIComponent(url.replace(/^.*stream\//, ''))).fileName || name; } catch {}
    const label = '⬇ Скачать видео';
    btn.disabled = true;
    try {
      // ponytail: whole file held in RAM, then saved as a Blob. Fine for ≲1–2 GB;
      // for bigger files this OOMs — upgrade path is streaming to disk via the
      // File System Access API (showSaveFilePicker + WritableStream).
      const chunks = await fetchRanges(url, fetch, (pos, total) => {
        btn.textContent = `${(pos / total * 100).toFixed(0)}%  (${(pos / 1e6).toFixed(0)} MB)`;
      });
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      btn.textContent = '✓ Готово';
    } catch (e) {
      btn.textContent = '✗ Ошибка';
      console.error('[tg-video-dl]', e);
    } finally {
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2500);
    }
  }

  // ponytail: 1s poll instead of a MutationObserver — the button only needs to
  // appear/disappear with the player; a watcher is more code for no real gain.
  setInterval(ensureButton, 1000);
})();
