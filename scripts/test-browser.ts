import { chromium } from 'playwright';
import { preview } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { blankLedger, STORAGE_KEY, today, validateLedger } from '../src/model.ts';
import { sampleLedger } from '../src/sample.ts';
const external = process.env.BILLING_MEMO_TEST_URL;
const server = external
  ? null
  : await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const base = external ?? server!.resolvedUrls!.local[0];
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.BILLING_MEMO_BROWSER_CHANNEL || undefined,
});
const passed: string[] = [],
  errors: string[] = [],
  requests: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } }),
    page = await context.newPage();
  context.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(base);
  await page.locator('.bill-row').first().waitFor();
  assert.equal(await page.locator('.bill-row').count(), 8);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), null);
  assert.match(await page.locator('.stat-value').first().innerText(), /187\.25/);
  passed.push('Fictional demo, exact monthly total, no automatic local ledger write');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.screenshot({ path: 'test-results/overview.png', fullPage: false });
  for (const lang of ['en', 'ko', 'zh-CN', 'ja', 'es']) {
    await page.selectOption('#language', lang);
    assert.equal(await page.locator('html').getAttribute('lang'), lang);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `mobile ${lang}`,
    );
    if (lang === 'ko')
      await page.screenshot({ path: 'test-results/mobile-ko.png', fullPage: true });
  }
  await page.selectOption('#language', 'en');
  await page.setViewportSize({ width: 1440, height: 1100 });
  passed.push('Five localized interfaces without mobile overflow');
  await page.click('[data-day$="-20"]');
  assert.equal(await page.locator('.bill-row').count(), 1);
  await page.click('#clear-day');
  await page.fill('#search', 'supabase');
  assert.equal(await page.locator('.bill-row').count(), 1);
  await page.fill('#search', '');
  await page.selectOption('#project', 'Orbit');
  assert.equal(await page.locator('.bill-row').count(), 4);
  await page.selectOption('#project', '');
  await page.selectOption('#category', 'cloud');
  assert.equal(await page.locator('.bill-row').count(), 3);
  await page.selectOption('#category', '');
  passed.push('Day, project, category and search filters');
  let event = page.waitForEvent('download');
  await page.click('#csv');
  await (await event).saveAs('test-results/month.csv');
  assert.ok((await readFile('test-results/month.csv', 'utf8')).includes('187.25') === false);
  assert.ok((await readFile('test-results/month.csv', 'utf8')).includes('Cloudflare'));
  event = page.waitForEvent('download');
  await page.click('#ics');
  await (await event).saveAs('test-results/month.ics');
  assert.equal(
    ((await readFile('test-results/month.ics', 'utf8')).match(/BEGIN:VEVENT/g) || []).length,
    6,
  );
  event = page.waitForEvent('download');
  await page.click('#backup');
  await (await event).saveAs('test-results/demo.json');
  assert.equal(
    validateLedger(JSON.parse(await readFile('test-results/demo.json', 'utf8'))).services.length,
    8,
  );
  passed.push('JSON, CSV and unpaid ICS downloads');
  await page.click('#motion');
  assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true');
  await page.click('#switch-mode');
  assert.equal(await page.locator('.bill-row').count(), 0);
  await page.locator('#add').focus();
  await page.keyboard.press('Enter');
  await page.locator('dialog[open]').waitFor();
  await page.selectOption('#provider', '1');
  assert.equal(await page.inputValue('[name="name"]'), 'Cloudflare');
  await page.fill('[name="amount"]', '0.29');
  await page.fill('[name="anchor"]', today().slice(0, 7) + '-01');
  await page.fill('[name="project"]', 'Tiny lab');
  await page.fill('[name="notes"]', 'A real editable memo');
  await page.click('dialog button[type="submit"]');
  assert.equal(await page.locator('.bill-row').count(), 1);
  assert.match(await page.locator('.stat-value').first().innerText(), /0\.29/);
  await page.reload();
  assert.equal(await page.locator('.bill-row').count(), 1);
  assert.match(await page.locator('.row-extra').innerText(), /editable memo/);
  passed.push('Keyboard add, provider shortcut, precise cents and persistence after reload');
  await page.click('[data-pay]');
  await page.fill('[name="actual"]', '0.37');
  await page.click('dialog button[type="submit"]');
  assert.match(await page.locator('.stat-value').nth(1).innerText(), /0\.37/);
  await page.click('[data-edit]');
  await page.fill('[name="name"]', 'Changed name');
  await page.fill('[name="amount"]', '5.00');
  await page.click('dialog button[type="submit"]');
  assert.equal(await page.locator('.service-name h3').innerText(), 'Cloudflare');
  await page.click('#next-month');
  assert.equal(await page.locator('.service-name h3').innerText(), 'Changed name');
  assert.match(await page.locator('.stat-value').first().innerText(), /5\.00/);
  await page.click('#prev-month');
  passed.push('Actual settlement replaces estimate, paid snapshot persists through edits');
  await page.click('#add');
  await page.fill('[name="name"]', 'JPY API');
  await page.selectOption('[name="currency"]', 'JPY');
  await page.fill('[name="amount"]', '1000');
  await page.fill('[name="anchor"]', today().slice(0, 7) + '-10');
  await page.selectOption('[name="kind"]', 'usage');
  await page.click('dialog button[type="submit"]');
  assert.equal(await page.locator('.rate-warning').isVisible(), true);
  await page.click('#preferences');
  await page.fill('[name="rate-JPY"]', '0.01');
  await page.fill('[name="budget"]', '20');
  await page.click('dialog button[type="submit"]');
  assert.equal(await page.locator('.rate-warning').count(), 0);
  assert.match(await page.locator('.stat-value').first().innerText(), /10\.37/);
  passed.push('Missing currency warnings, manual FX and budget');
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await page.locator('#import-file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2}'),
  });
  await page.locator('#toast').filter({ hasText: 'Invalid backup' }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), before);
  const malicious = sampleLedger(today().slice(0, 7));
  malicious.services[2].name = '<img src=x onerror=alert(1)>';
  malicious.services[2].notes = '=SUM(1,2)';
  await page.locator('#import-file').setInputFiles({
    name: 'test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(malicious)),
  });
  assert.equal(await page.locator('dialog[open]').isVisible(), true);
  assert.equal(await page.locator('.bill-row').count(), 2);
  await page.click('dialog button[type="submit"]');
  assert.equal(await page.locator('.bill-row').count(), 8);
  assert.equal(await page.locator('.bill-row img').count(), 0);
  assert.equal(
    await page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }).count(),
    1,
  );
  const restoreBefore = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  const badUrl = structuredClone(malicious);
  badUrl.services[2].url = 'javascript:alert(1)';
  await page.locator('#import-file').setInputFiles({
    name: 'bad-url.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(badUrl)),
  });
  await page.locator('#toast').filter({ hasText: 'Invalid backup' }).waitFor();
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY), restoreBefore);
  passed.push('Confirmed restore, malformed backup protection, escaped XSS, rejected unsafe URL');
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('[data-edit]').last().click();
  await page.click('#remove-service');
  assert.equal(await page.locator('.bill-row').count(), 7);
  await page.click('[data-action="undo"]');
  assert.equal(await page.locator('.bill-row').count(), 8);
  passed.push('Removal and undo');
  const other = await context.newPage();
  await other.goto(base);
  await other.click('#add');
  await other.fill('[name="name"]', 'Other tab');
  await other.click('dialog button[type="submit"]');
  await page.locator('.storage-error').filter({ hasText: 'another tab' }).waitFor();
  await page.click('#add');
  await page.fill('[name="name"]', 'Stale edit');
  await page.click('dialog button[type="submit"]');
  const final = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))!);
  assert.ok(final.services.some((s: { name: string }) => s.name === 'Other tab'));
  assert.ok(!final.services.some((s: { name: string }) => s.name === 'Stale edit'));
  passed.push('Concurrent tab writes do not overwrite newer data');
  await context.close();
  const corruptContext = await browser.newContext({ reducedMotion: 'reduce' });
  await corruptContext.addInitScript((key) => {
    localStorage.setItem(key, 'broken-original');
  }, STORAGE_KEY);
  const broken = await corruptContext.newPage();
  await broken.goto(base);
  await broken.locator('#raw-backup').waitFor();
  assert.equal(await broken.locator('#motion').getAttribute('aria-pressed'), 'true');
  event = broken.waitForEvent('download');
  await broken.click('#raw-backup');
  await (await event).saveAs('test-results/corrupt.json');
  assert.equal(await readFile('test-results/corrupt.json', 'utf8'), 'broken-original');
  await broken.click('#switch-mode');
  await broken.locator('#import-file').setInputFiles({
    name: 'restore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(blankLedger())),
  });
  await broken.click('dialog button[type="submit"]');
  assert.deepEqual(
    JSON.parse((await broken.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))!),
    blankLedger(),
  );
  await corruptContext.close();
  passed.push(
    'Corrupt storage preserved, exported and explicitly recovered; reduced motion honored',
  );
  const quotaContext = await browser.newContext();
  await quotaContext.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === key) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, k, v);
    };
  }, STORAGE_KEY);
  const quota = await quotaContext.newPage();
  await quota.goto(base);
  await quota.click('#switch-mode');
  await quota.click('#add');
  await quota.fill('[name="name"]', 'Unsaved');
  await quota.click('dialog button[type="submit"]');
  await quota.locator('.storage-error').filter({ hasText: 'Could not save' }).waitFor();
  event = quota.waitForEvent('download');
  await quota.click('#backup');
  await (await event).saveAs('test-results/unsaved.json');
  assert.equal(
    JSON.parse(await readFile('test-results/unsaved.json', 'utf8')).services[0].name,
    'Unsaved',
  );
  await quotaContext.close();
  passed.push('Storage write failures clearly reported and unsaved view remains exportable');
  assert.deepEqual(errors, []);
  assert.ok(
    requests.every((url) => url.startsWith(base)),
    requests.filter((url) => !url.startsWith(base)).join('\n'),
  );
  passed.push('No console errors, CSP violations or external automatic requests');
  await writeFile(
    'test-results/verification.json',
    JSON.stringify({ base, passed, errors, requests: requests.length }, null, 2),
  );
  console.log(JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
} finally {
  await browser.close();
  await server?.httpServer.close();
}
