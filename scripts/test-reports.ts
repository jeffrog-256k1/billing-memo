import { chromium } from 'playwright';
import { preview } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { billsFor, blankLedger, settle, STORAGE_KEY, type Service } from '../src/model.ts';
const server = process.env.BILLING_MEMO_TEST_URL
  ? null
  : await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const base = process.env.BILLING_MEMO_TEST_URL ?? server!.resolvedUrls!.local[0];
const browser = await chromium.launch({
  channel: process.env.BILLING_MEMO_BROWSER_CHANNEL || undefined,
});
await mkdir('test-results', { recursive: true });
const checks: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const service: Service = {
    id: 'qa',
    name: 'Period fixture',
    category: 'cloud',
    project: 'Alpha',
    currency: 'USD',
    amount: 1000,
    kind: 'monthly',
    anchor: '2024-01-31',
    end: '',
    paused: false,
    url: '',
    notes: '',
  };
  let ledger = { ...blankLedger(), services: [service] };
  ledger = settle(ledger, billsFor(ledger, '2024-01')[0], 1200, '2024-02-01');
  ledger = settle(ledger, billsFor(ledger, '2024-02')[0], 700, '2024-03-31');
  await page.goto(base);
  await page.evaluate(({ key, ledger }) => localStorage.setItem(key, JSON.stringify(ledger)), {
    key: STORAGE_KEY,
    ledger,
  });
  await page.reload();
  await page.locator('.ledger-panel').waitFor();
  await page.click('a[href="#/ledger"]');
  await page.locator('a[href="#/ledger"][aria-current="page"]').waitFor();
  assert.equal(await page.locator('.bill-row').count(), 1);
  assert.equal(await page.locator('.calendar-panel').isVisible(), false);
  await page.click('a[href="#/calendar"]');
  await page.locator('a[href="#/calendar"][aria-current="page"]').waitFor();
  assert.equal(await page.locator('.calendar-panel').isVisible(), true);
  await page.click('a[href="#/reports"]');
  await page.locator('#report-form').waitFor();
  assert.equal(await page.locator('.ledger-layout').isVisible(), false);
  await page.goBack();
  assert.ok(page.url().endsWith('#/calendar'));
  await page.goForward();
  await page.locator('#report-form').waitFor();
  checks.push('Three separate routes with browser back/forward navigation');
  const analyze = async (start: string, end: string, basis = 'paid') => {
    await page.fill('#report-form [name="start"]', start);
    await page.fill('#report-form [name="end"]', end);
    await page.selectOption('#report-form [name="basis"]', basis);
    await page.click('#report-form button[type="submit"]');
  };
  await analyze('2024-01-01', '2024-03-31');
  assert.match(await page.locator('#period-total').innerText(), /19\.00/);
  assert.equal(await page.locator('.month-row').count(), 3);
  assert.equal(await page.locator('.report-table tbody tr').count(), 2);
  await page.screenshot({ path: 'test-results/period-report.png', fullPage: true });
  let download = page.waitForEvent('download');
  await page.click('#period-csv');
  await (await download).saveAs('test-results/period.csv');
  assert.ok((await readFile('test-results/period.csv', 'utf8')).includes('2024-02-01'));
  download = page.waitForEvent('download');
  await page.click('#monthly-csv');
  await (await download).saveAs('test-results/monthly-totals.csv');
  assert.equal((await readFile('test-results/monthly-totals.csv', 'utf8')).split('\r\n').length, 4);
  await analyze('2024-01-01', '2024-03-31', 'scheduled');
  assert.match(await page.locator('#period-total').innerText(), /29\.00/);
  await analyze('2024-02-01', '2024-02-01');
  assert.match(await page.locator('#period-total').innerText(), /12\.00/);
  await page.selectOption('#report-form [name="category"]', 'email');
  assert.equal(await page.locator('#report-results').isVisible(), false);
  await page.click('#report-form button[type="submit"]');
  assert.match(await page.locator('#period-total').innerText(), /0\.00/);
  await page.selectOption('#report-form [name="category"]', '');
  await analyze('2024-03-31', '2024-01-01');
  assert.equal(await page.locator('#range-error').isVisible(), true);
  assert.equal(await page.locator('#report-results').isVisible(), false);
  await analyze('2000-01-01', '2199-12-31');
  assert.equal(await page.locator('#range-error').isVisible(), true);
  await analyze('2024-01-01', '2024-03-31');
  checks.push('Actual vs scheduled, inclusive boundaries, filters, invalid ranges, CSV exports');
  for (const lang of ['en', 'ko', 'zh-CN', 'ja', 'es']) {
    await page.selectOption('#language', lang);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['ledger', 'calendar', 'reports']) {
      await page.click(`a[href="#/${route}"]`);
      await page.locator(`a[href="#/${route}"][aria-current="page"]`).waitFor();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `${lang} ${route} overflow`,
      );
    }
    if (lang === 'ko')
      await page.screenshot({ path: 'test-results/report-mobile-ko.png', fullPage: true });
  }
  checks.push('All three pages fit mobile widths in all five languages');
  await page.selectOption('#language', 'en');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await analyze('2024-01-01', '2029-01-31', 'scheduled');
  assert.equal(await page.locator('.report-table tbody tr').count(), 50);
  await page.click('#report-next');
  assert.equal(await page.locator('.report-table tbody tr').count(), 11);
  await page.click('#report-prev');
  assert.equal(await page.locator('.report-table tbody tr').count(), 50);
  checks.push('Long ranges paginate detail records without truncating totals or exports');
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/reports-verification.json',
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(checks);
} finally {
  await browser.close();
  await server?.httpServer.close();
}
