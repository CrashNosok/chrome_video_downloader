/**
 * Development utility: Navigate to a page with a Kinescope embed and extract
 * subtitle (VTT) data from playerOptions for debugging purposes.
 *
 * Usage:
 *   1. Install dependencies: npm install
 *   2. If the target page requires authentication, export cookies from your
 *      browser (e.g. using a cookie exporter extension) and save them to
 *      cookies.json in the same directory.
 *   3. Set TARGET_URL below to the page you want to analyze.
 *   4. Run: node analyze_subs.js
 */

const { chromium } = require('playwright');
const fs = require('fs');

// Replace with the URL of a page that contains a Kinescope embed
const TARGET_URL = 'https://your-site.com/page-with-kinescope-embed';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Optional: load cookies for authenticated pages.
  // Export cookies from your browser and save to cookies.json (not committed to git).
  if (fs.existsSync('cookies.json')) {
    const rawCookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
    const cookies = rawCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax'),
      ...(c.expirationDate ? { expires: c.expirationDate } : {}),
    }));
    await context.addCookies(cookies);
    console.log('Loaded cookies from cookies.json');
  }

  const page = await context.newPage();
  await page.goto(TARGET_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  for (const frame of page.frames()) {
    if (!frame.url().includes('kinescope')) continue;

    const data = await frame.evaluate(() => {
      if (typeof playerOptions === 'undefined') return null;
      const p = playerOptions.playlist[0];
      return {
        title: p.title,
        m3u8: p.sources?.hls?.src,
        qualities: p.sources?.hls?.selector?.qualityMap,
        subtitles: p.vtt,
        duration: p.duration,
        id: p.id,
      };
    });
    console.log(JSON.stringify(data, null, 2));
  }

  await browser.close();
})();
