import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
await mkdir('assets', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const browser = await chromium.launch({
  channel: process.env.BILLING_MEMO_BROWSER_CHANNEL || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(server.resolvedUrls.local[0]);
  await page.locator('#circuit').waitFor();
  // Capture the product's own canvas; everything is fictional sample data.
  const gif = GIFEncoder();
  let palette;
  for (let frame = 0; frame < 48; frame++) {
    const rgba = await page.locator('#circuit').evaluate((canvas) => {
      const copy = document.createElement('canvas');
      copy.width = 600;
      copy.height = 280;
      const ctx = copy.getContext('2d');
      ctx.fillStyle = '#f4f3ec';
      ctx.fillRect(0, 0, 600, 280);
      ctx.drawImage(canvas, 0, 0, 600, 280);
      return Array.from(ctx.getImageData(0, 0, 600, 280).data);
    });
    const bytes = new Uint8Array(rgba);
    palette ??= quantize(bytes, 128);
    gif.writeFrame(applyPalette(bytes, palette), 600, 280, { palette, delay: 85, repeat: 0 });
    await new Promise((resolve) => setTimeout(resolve, 65));
  }
  gif.finish();
  await writeFile('assets/cost-circuit.gif', gif.bytes());
  await page.click('#motion');
  await page.screenshot({ path: 'assets/overview.png', fullPage: false });
  await page.locator('#circuit').screenshot({ path: 'assets/cost-circuit.png' });
  await copyFile('test-results/mobile-ko.png', 'assets/mobile-ko.png');
  console.log('README screenshots and 48-frame circuit GIF written to assets/.');
} finally {
  await browser.close();
  await server.httpServer.close();
}
