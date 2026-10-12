import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.env.BILLING_MEMO_BROWSER_CHANNEL || undefined,
});
try {
  const page = await browser.newPage({
    viewport: { width: 256, height: 256 },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>html,body{margin:0;width:256px;height:256px}svg{width:256px;height:256px}</style>${await readFile('public/favicon.svg', 'utf8')}`,
  );
  const png = await page.screenshot({ type: 'png', omitBackground: true });
  await writeFile('desktop/icon.png', png);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  await writeFile('desktop/icon.ico', Buffer.concat([header, png]));
} finally {
  await browser.close();
}
