import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const browser = await chromium.launch({
  channel: process.env.BILLING_MEMO_BROWSER_CHANNEL || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1040 }, locale: 'en-US' });
  const base = server.resolvedUrls.local[0];
  await page.goto(base);
  await page.locator('.welcome-empty').waitFor();
  await page.screenshot({ path: 'assets/empty.png', fullPage: true });
  await page.goto(base + '?demo=1');
  await page.locator('.bill-row').first().waitFor();
  await page.screenshot({ path: 'assets/overview.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.selectOption('#language', 'ko');
  await page.screenshot({ path: 'assets/mobile-ko.png', fullPage: true });
  await copyFile('test-results/period-report.png', 'assets/period-report.png');
  console.log('Current ledger screenshots generated using fictional data only.');
} finally {
  await browser.close();
  await server.httpServer.close();
}
