chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getVideoData') {
    fetchVideoData(message.embedUrl).then(sendResponse);
    return true;
  }

  if (message.action === 'downloadSubtitle') {
    downloadSubtitle(message.url, message.filename);
    sendResponse({ ok: true });
    return true;
  }
});

async function fetchVideoData(embedUrl) {
  try {
    const response = await fetch(embedUrl, { credentials: 'include' });
    const html = await response.text();
    return parsePlayerOptions(html, embedUrl);
  } catch (error) {
    return { error: `Failed to fetch embed page: ${error.message}` };
  }
}

function parsePlayerOptions(html, embedUrl) {
  // Extract playerOptions JSON from inline script
  const match = html.match(/var\s+playerOptions\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:var|const|let|<\/script>)/);
  if (!match) {
    return { error: 'Could not find playerOptions in embed page' };
  }

  let options;
  try {
    options = JSON.parse(match[1]);
  } catch {
    // playerOptions may use single quotes or trailing commas — try eval-safe cleanup
    try {
      options = JSON.parse(
        match[1]
          .replace(/'/g, '"')
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/(\w+)\s*:/g, '"$1":')
      );
    } catch {
      return { error: 'Could not parse playerOptions JSON' };
    }
  }

  const playlist = options.playlist?.[0];
  if (!playlist) {
    return { error: 'No playlist found in playerOptions' };
  }

  const embedId = embedUrl.split('/embed/')[1]?.split(/[?#]/)[0] || '';

  const m3u8Url = playlist.sources?.hls?.src || '';

  // Build audio URL from the same base — Kinescope always uses this pattern
  const qualityMap = playlist.sources?.hls?.selector?.qualityMap || {};
  const firstQuality = Object.keys(qualityMap)[0] || '720';
  const audioUrl = m3u8Url
    ? m3u8Url.replace('/master.m3u8', `/media.m3u8?quality=${firstQuality}&type=audio&lang=und`)
    : '';

  return {
    title: playlist.title || 'Untitled',
    videoId: playlist.id || '',
    embedId,
    m3u8Url,
    audioUrl,
    qualities: playlist.sources?.hls?.selector?.qualityMap || {},
    subtitles: (playlist.vtt || []).map(s => ({
      label: s.label || s.srcLang || 'Unknown',
      src: s.src,
      srcLang: s.srcLang || '',
    })),
    posterUrl: playlist.poster?.src?.src || '',
  };
}

async function downloadSubtitle(url, filename) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const blob = new Blob([text], { type: 'text/vtt' });
    const reader = new FileReader();
    reader.onloadend = () => {
      chrome.downloads.download({
        url: reader.result,
        filename: sanitizeFilename(filename),
        saveAs: true,
      });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Failed to download subtitle:', error);
  }
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
}
