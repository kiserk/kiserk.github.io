import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../.preview-shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

for (const [w, h, tag] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
  page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message));
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + `home-${tag}.png` });
  console.log('captured home-' + tag);
  await page.close();
}

await browser.close();
console.log('done');
