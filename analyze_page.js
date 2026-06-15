/**
 * Development utility: Navigate to a page with a Kinescope embed and capture
 * network requests + playerOptions data for debugging purposes.
 *
 * Usage:
 *   1. Install dependencies: npm install
 *   2. If the target page requires authentication, export cookies from your
 *      browser (e.g. using a cookie exporter extension) and save them to
 *      cookies.json in the same directory.
 *   3. Set TARGET_URL below to the page you want to analyze.
 *   4. Run: node analyze_page.js
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

  // Intercept network requests to capture kinescope URLs
  const kinescapeUrls = [];
  const page = await context.newPage();

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('kinescope')) {
      kinescapeUrls.push({ url, method: req.method(), resourceType: req.resourceType() });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('kinescope') && url.includes('.m3u8')) {
      console.log(`\n=== M3U8 RESPONSE: ${url} ===`);
      try {
        const body = await res.text();
        console.log(body.substring(0, 2000));
      } catch (e) {
        console.log('(could not read body)');
      }
    }
  });

  console.log('Navigating to page...');
  await page.goto(TARGET_URL, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  console.log('\n=== PAGE TITLE ===');
  console.log(await page.title());

  // Find all iframes
  console.log('\n=== ALL IFRAMES ===');
  const iframes = await page.$$eval('iframe', frames =>
    frames.map(f => ({ src: f.src, width: f.width, height: f.height }))
  );
  console.log(JSON.stringify(iframes, null, 2));

  // Find kinescope iframes specifically
  console.log('\n=== KINESCOPE IFRAMES ===');
  const kinescopeIframes = iframes.filter(f => f.src.includes('kinescope'));
  console.log(JSON.stringify(kinescopeIframes, null, 2));

  // Try to access iframe content
  for (const frame of page.frames()) {
    const url = frame.url();
    if (url.includes('kinescope')) {
      console.log(`\n=== KINESCOPE FRAME: ${url} ===`);
      try {
        const playerData = await frame.evaluate(() => {
          if (typeof playerOptions !== 'undefined') {
            return JSON.stringify(playerOptions, null, 2).substring(0, 5000);
          }
          const scripts = document.querySelectorAll('script');
          for (const s of scripts) {
            if (s.textContent.includes('playerOptions')) {
              const match = s.textContent.match(/var\s+playerOptions\s*=\s*(\{[\s\S]*?\});/);
              if (match) return match[1].substring(0, 5000);
            }
          }
          return 'playerOptions not found';
        });
        console.log('playerOptions:', playerData.substring(0, 3000));
      } catch (e) {
        console.log('Cannot access frame content:', e.message);
      }

      try {
        const videoInfo = await frame.evaluate(() => {
          const video = document.querySelector('video');
          if (!video) return 'no video element';
          return JSON.stringify({
            src: video.src,
            currentSrc: video.currentSrc,
            duration: video.duration,
            sources: Array.from(video.querySelectorAll('source')).map(s => ({
              src: s.src,
              type: s.type,
            })),
          });
        });
        console.log('Video element:', videoInfo);
      } catch (e) {
        console.log('Cannot get video info:', e.message);
      }
    }
  }

  console.log('\n=== KINESCOPE NETWORK REQUESTS ===');
  for (const r of kinescapeUrls) {
    console.log(`${r.method} [${r.resourceType}] ${r.url}`);
  }

  await browser.close();
})();
