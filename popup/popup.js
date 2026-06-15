document.addEventListener('DOMContentLoaded', async () => {
  const content = document.getElementById('content');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showEmpty(content, 'No active tab found');
      return;
    }

    const embedUrls = await chrome.tabs.sendMessage(tab.id, { action: 'getEmbedUrls' });
    if (!embedUrls || embedUrls.length === 0) {
      showEmpty(content, 'No Kinescope videos found on this page');
      return;
    }

    content.innerHTML = '';

    for (const embedUrl of embedUrls) {
      const videoData = await chrome.runtime.sendMessage({
        action: 'getVideoData',
        embedUrl,
      });

      if (videoData.error) {
        content.innerHTML += `<div class="error-msg">${videoData.error}</div>`;
        continue;
      }

      content.appendChild(createVideoCard(videoData));
    }
  } catch (error) {
    showEmpty(content, `Error: ${error.message}`);
  }
});

function showEmpty(container, message) {
  container.innerHTML = `<div class="empty">${message}</div>`;
}

function createVideoCard(data) {
  const card = document.createElement('div');
  card.className = 'video-card';

  const qualityEntries = Object.entries(data.qualities);
  const defaultQuality = qualityEntries.length > 0
    ? qualityEntries[qualityEntries.length - 1][0]
    : '';

  let posterHtml = '';
  if (data.posterUrl) {
    posterHtml = `<img class="video-poster" src="${escapeHtml(data.posterUrl)}" alt="">`;
  }

  let qualityOptions = '';
  for (const [value, label] of qualityEntries) {
    const selected = value === defaultQuality ? ' selected' : '';
    qualityOptions += `<option value="${value}"${selected}>${label}</option>`;
  }

  const qualitySelect = qualityEntries.length > 0
    ? `<select class="quality-select" data-video-id="${escapeHtml(data.videoId)}">${qualityOptions}</select>`
    : '';

  let subtitlesHtml = '';
  if (data.subtitles.length > 0) {
    const rows = data.subtitles.map(s => `
      <div class="subtitle-row">
        <span class="subtitle-lang">${escapeHtml(s.label)} (${escapeHtml(s.srcLang)})</span>
        <button class="btn btn-download btn-sub"
          data-url="${escapeHtml(s.src)}"
          data-filename="${escapeHtml(sanitize(data.title))}_${escapeHtml(s.srcLang)}.vtt">
          Download .vtt
        </button>
      </div>
    `).join('');
    subtitlesHtml = `
      <div class="section-label">Subtitles</div>
      <div class="subtitle-list">${rows}</div>
    `;
  }

  card.innerHTML = `
    ${posterHtml}
    <div class="video-info">
      <div class="video-title">${escapeHtml(data.title)}</div>

      <div class="section-label">Video (HLS)</div>
      <div class="url-row">
        <input type="text" class="url-input" value="${escapeHtml(data.m3u8Url)}" readonly>
        ${qualitySelect}
        <button class="btn btn-copy btn-copy-url" data-url="${escapeHtml(data.m3u8Url)}">Copy</button>
      </div>
      <div class="cmd-hint">
        <span class="cmd-label">yt-dlp</span>
        <span class="cmd-text">-f "bestvideo+bestaudio" -o "${escapeHtml(sanitize(data.title))}.%(ext)s" "${escapeHtml(data.m3u8Url)}"</span>
      </div>

      <div class="section-label">Audio</div>
      <div class="url-row">
        <input type="text" class="url-input url-input-audio" value="${escapeHtml(data.audioUrl)}" readonly>
        <button class="btn btn-copy btn-copy-audio" data-url="${escapeHtml(data.audioUrl)}">Copy</button>
      </div>
      <div class="cmd-hint cmd-hint-audio" data-url="${escapeHtml(data.audioUrl)}">
        <span class="cmd-label">yt-dlp</span>
        <span class="cmd-text">-x --audio-format mp3 -o "${escapeHtml(sanitize(data.title))}.%(ext)s" "${escapeHtml(data.audioUrl)}"</span>
      </div>

      ${subtitlesHtml}
    </div>
  `;

  // Copy URL button
  card.querySelector('.btn-copy-url').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const url = btn.dataset.url;
    navigator.clipboard.writeText(url).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1500);
    });
  });

  // Copy yt-dlp command on click
  const cmdHint = card.querySelector('.cmd-hint');
  cmdHint.style.cursor = 'pointer';
  cmdHint.title = 'Click to copy full command';
  cmdHint.addEventListener('click', () => {
    const url = data.m3u8Url;
    const title = sanitize(data.title);
    navigator.clipboard.writeText(`yt-dlp -f "bestvideo+bestaudio" -o "${title}.%(ext)s" "${url}"`).then(() => {
      cmdHint.querySelector('.cmd-label').textContent = 'Copied!';
      setTimeout(() => {
        cmdHint.querySelector('.cmd-label').textContent = 'yt-dlp';
      }, 1500);
    });
  });

  // Copy audio URL button
  card.querySelector('.btn-copy-audio').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText(btn.dataset.url).then(() => {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 1500);
    });
  });

  // Copy yt-dlp audio command on click
  const audioCmdHint = card.querySelector('.cmd-hint-audio');
  audioCmdHint.style.cursor = 'pointer';
  audioCmdHint.title = 'Click to copy full command';
  audioCmdHint.addEventListener('click', () => {
    const url = audioCmdHint.dataset.url;
    const title = sanitize(data.title);
    navigator.clipboard.writeText(`yt-dlp -x --audio-format mp3 -o "${title}.%(ext)s" "${url}"`).then(() => {
      audioCmdHint.querySelector('.cmd-label').textContent = 'Copied!';
      setTimeout(() => {
        audioCmdHint.querySelector('.cmd-label').textContent = 'yt-dlp';
      }, 1500);
    });
  });

  // Quality selector updates URL
  const select = card.querySelector('.quality-select');
  if (select) {
    select.addEventListener('change', () => {
      const baseUrl = data.m3u8Url;
      const quality = select.value;
      const qualityUrl = baseUrl.replace('/master.m3u8', `/media.m3u8?quality=${quality}&type=video`);
      const urlInput = card.querySelector('.url-input');
      const copyBtn = card.querySelector('.btn-copy-url');
      urlInput.value = qualityUrl;
      copyBtn.dataset.url = qualityUrl;
      card.querySelector('.cmd-text').textContent = `"${qualityUrl}"`;
    });
  }

  // Subtitle download buttons
  for (const btn of card.querySelectorAll('.btn-sub')) {
    btn.addEventListener('click', (e) => {
      const { url, filename } = e.currentTarget.dataset;
      chrome.runtime.sendMessage({
        action: 'downloadSubtitle',
        url,
        filename,
      });
      e.currentTarget.textContent = 'Downloading...';
      setTimeout(() => {
        e.currentTarget.textContent = 'Download .vtt';
      }, 2000);
    });
  }

  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitize(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}
