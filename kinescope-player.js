// Kinescope player download buttons — runs (ISOLATED world) inside the
// kinescope.io/embed/<id> iframe. Overlays a small toolbar with two universal
// buttons: "⬇ Видео" (mp4 with sound) and "⬇ Аудио" (m4a).
//
// This script reads the fresh signed master.m3u8 straight out of its own embed
// document (loaded by the browser with the correct referer) and hands it to the
// service worker → native-messaging host, which runs yt-dlp to do the heavy part
// (HLS byte-range fetch + video/audio mux) and stream to disk. See native-host/.
//
// The embed page has an aggressive global CSS reset that stretches any plain
// div/button to fill the player. So the UI lives in a Shadow DOM (page CSS can't
// reach inside it) mounted on a host whose geometry is locked with `all:initial`.
(() => {
  const HOST_ID = 'kn-dl-host';
  const LABELS = { video: '⬇ Видео', audio: '⬇ Аудио' };
  let buttons = null; // { video: <button>, audio: <button> }

  function ensurePanel() {
    if (document.getElementById(HOST_ID) || !document.body) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    // Lock the host against the page's reset; the buttons themselves are safe
    // inside the shadow root regardless.
    host.style.cssText = [
      'all: initial', 'position: fixed', 'top: 8px', 'right: 8px',
      'left: auto', 'bottom: auto', 'width: auto', 'height: auto',
      'margin: 0', 'padding: 0', 'z-index: 2147483647',
    ].map(r => r + ' !important').join('; ');

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        .panel { display: flex; gap: 6px; }
        button {
          padding: 6px 11px; white-space: nowrap; cursor: pointer;
          color: #fff; background: rgba(18,18,20,.72);
          border: 1px solid rgba(255,255,255,.22); border-radius: 8px;
          font: 600 12px/1.15 system-ui, -apple-system, sans-serif;
          -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
          transition: background .15s;
        }
        button:hover:not(:disabled) { background: rgba(42,42,46,.92); }
        button:disabled { cursor: default; opacity: .85; }
      </style>
      <div class="panel">
        <button data-mode="video">${LABELS.video}</button>
        <button data-mode="audio">${LABELS.audio}</button>
      </div>`;

    const btnEls = [...shadow.querySelectorAll('button')];
    buttons = {};
    for (const b of btnEls) {
      buttons[b.dataset.mode] = b;
      b.addEventListener('click', () => download(b.dataset.mode));
    }
    document.body.appendChild(host);
  }

  // The embed frame was loaded by the browser with the correct (whitelisted)
  // referer, so its own document already holds the signed master.m3u8 — no need
  // for the SW to re-fetch it (that loses the referer → "Access forbidden").
  function extractSource() {
    const html = document.documentElement.outerHTML;
    // The signed master.m3u8 sits in the inline playerOptions JSON as a quoted
    // string (with & written as &, / sometimes as \/). Match the quoted
    // value whole, then unescape.
    const m = html.match(/"(https:\/\/kinescope\.io\/[a-f0-9-]+\/master\.m3u8\?[^"]+)"/i);
    const masterUrl = m
      ? m[1].replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&')
      : '';
    return { masterUrl, title: (document.title || 'kinescope-video').trim() };
  }

  // Long-lived port to the service worker → native host. Streams progress back.
  function download(mode) {
    const btn = buttons[mode];
    const all = Object.values(buttons);
    all.forEach(b => (b.disabled = true));
    btn.title = '';

    const { masterUrl, title } = extractSource();
    if (!masterUrl) {
      fail(btn, mode, all, 'master.m3u8 не найден на странице плеера');
      return;
    }
    btn.textContent = '… старт';

    const port = chrome.runtime.connect({ name: 'kn-download' });
    port.postMessage({ masterUrl, title, mode });

    port.onMessage.addListener((msg) => {
      if (msg.type === 'progress') {
        btn.textContent = `… ${Math.round(msg.pct)}%`;
      } else if (msg.type === 'done') {
        btn.textContent = '✓ Готово';
        reset(all, btn, mode);
      } else if (msg.type === 'error') {
        fail(btn, mode, all, msg.msg);
      }
    });
    // If the SW/host dies without a final message, don't leave buttons stuck.
    port.onDisconnect.addListener(() => {
      if (btn.textContent.startsWith('…')) fail(btn, mode, all, 'соединение прервано');
    });
  }

  function fail(btn, mode, all, msg) {
    btn.textContent = '✗ Ошибка';
    // Common case: the native host isn't registered yet — hint at the fix.
    btn.title = /native messaging host|not found|Specified/i.test(msg || '')
      ? 'Native host не установлен: запусти native-host/install.sh <EXTENSION_ID> и перезапусти Chrome'
      : (msg || '');
    console.error('[kn-dl]', msg);
    reset(all, btn, mode);
  }

  function reset(all, btn, mode) {
    setTimeout(() => {
      btn.textContent = LABELS[mode];
      all.forEach(b => (b.disabled = false));
    }, 3000);
  }

  // ponytail: 1s poll (same as telegram.js) — the panel just needs to exist once
  // the player frame is up; a MutationObserver is more code for no real gain.
  setInterval(ensurePanel, 1000);
})();
