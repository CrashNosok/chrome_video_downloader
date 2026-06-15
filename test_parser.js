// Test the playerOptions parsing logic against the live embed page

async function fetchAndParse(embedUrl) {
  const response = await fetch(embedUrl);
  const html = await response.text();

  // Same regex as service-worker.js
  const match = html.match(/var\s+playerOptions\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:var|const|let|<\/script>)/);
  if (!match) {
    console.error('Could not find playerOptions');
    console.log('First 2000 chars of HTML:', html.substring(0, 2000));
    return;
  }

  let options;
  try {
    options = JSON.parse(match[1]);
  } catch (e) {
    console.error('JSON parse failed:', e.message);
    console.log('Extracted text (first 500):', match[1].substring(0, 500));
    return;
  }

  const playlist = options.playlist?.[0];
  if (!playlist) {
    console.error('No playlist found');
    return;
  }

  console.log('SUCCESS! Parsed video data:');
  console.log(JSON.stringify({
    title: playlist.title,
    videoId: playlist.id,
    m3u8Url: playlist.sources?.hls?.src,
    qualities: playlist.sources?.hls?.selector?.qualityMap,
    subtitles: (playlist.vtt || []).map(s => ({
      label: s.label,
      src: s.src,
      srcLang: s.srcLang,
    })),
  }, null, 2));
}

fetchAndParse('https://kinescope.io/embed/offbNLaqvZcbb4Qh4NekLd');
