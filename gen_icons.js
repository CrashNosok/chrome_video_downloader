const { chromium } = require('playwright');
const path = require('path');

const sizes = [16, 32, 48, 128];

const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#1a1a2e"/>
  <polygon points="48,32 48,96 96,64" fill="#e94560"/>
  <rect x="40" y="88" width="48" height="6" rx="3" fill="#e94560" opacity="0.5"/>
  <path d="M64 78 L64 96 M56 88 L64 96 L72 88" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const size of sizes) {
    await page.setContent(`
      <html><body style="margin:0;padding:0;background:transparent;">
        <div style="width:${size}px;height:${size}px;">
          ${svgIcon.replace('viewBox="0 0 128 128"', `width="${size}" height="${size}" viewBox="0 0 128 128"`)}
        </div>
      </body></html>
    `);
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({
      path: path.join(__dirname, 'icons', `icon${size}.png`),
      omitBackground: true,
    });
    console.log(`Generated icon${size}.png`);
  }

  await browser.close();
})();
