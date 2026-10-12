import { _electron as electron } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const profile = path.resolve('test-results', 'desktop-profile-' + Date.now());
await mkdir(profile, { recursive: true });
const checks = [];
const cleanEnv = { ...process.env };
delete cleanEnv.ELECTRON_RUN_AS_NODE;
const launch = () =>
  electron.launch({ env: cleanEnv, args: ['.', `--user-data-dir=${profile}`], timeout: 30000 });
let application = await launch();
try {
  let page = await application.firstWindow();
  await page.locator('.page-nav').waitFor();
  assert.equal(new URL(page.url()).protocol, 'billing-memo:');
  assert.deepEqual(
    await page.evaluate(() => [typeof window.require, typeof window.process, typeof window.Buffer]),
    ['undefined', 'undefined', 'undefined'],
  );
  const prefs = await application.evaluate(({ BrowserWindow }) => {
    const p = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return {
      sandbox: p.sandbox,
      contextIsolation: p.contextIsolation,
      nodeIntegration: p.nodeIntegration,
      webSecurity: p.webSecurity,
    };
  });
  assert.deepEqual(prefs, {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
  });
  checks.push('Packaged-file protocol with sandbox, context isolation and no renderer Node access');
  await page.click('#switch-mode');
  await page.click('a[href="#/services"]');
  await page.click('#add');
  await page.fill('[name="name"]', 'Desktop test');
  await page.fill('[name="url"]', 'https://example.com/billing');
  await page.fill('[name="amount"]', '12.50');
  await page.fill('[name="anchor"]', new Date().toISOString().slice(0, 7) + '-01');
  await page.click('dialog button[type="submit"]');
  await page.click('a[href="#/calendar"]');
  await page.click('[data-pay]');
  await page.fill('[name="actual"]', '13.75');
  await page.click('dialog button[type="submit"]');
  await page.click('a[href="#/reports"]');
  assert.match(await page.locator('#period-total').innerText(), /13\.75/);
  await application.close();
  application = await launch();
  page = await application.firstWindow();
  await page.locator('.page-nav').waitFor();
  await page.click('a[href="#/reports"]');
  assert.match(await page.locator('#period-total').innerText(), /13\.75/);
  checks.push(
    'Service edit, actual payment, period report and persistence after a full app restart',
  );
  const exported = path.resolve('test-results', 'desktop-export.json');
  await application.evaluate(({ session }, filename) => {
    session.defaultSession.once('will-download', (_event, item) => item.setSavePath(filename));
  }, exported);
  await page.click('#backup');
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      JSON.parse(await readFile(exported, 'utf8'));
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const backup = JSON.parse(await readFile(exported, 'utf8'));
  assert.equal(backup.services[0].name, 'Desktop test');
  assert.equal(backup.payments[0].amount, 1375);
  await page.locator('#import-file').setInputFiles({
    name: 'roundtrip.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.click('dialog button[type="submit"]');
  assert.match(await page.locator('#period-total').innerText(), /13\.75/);
  checks.push('Native export pipeline and web-compatible JSON restore');
  await application.evaluate(({ dialog, shell }) => {
    globalThis.__opened = [];
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    shell.openExternal = async (url) => {
      globalThis.__opened.push(url);
    };
  });
  await page.click('a[href="#/services"]');
  await page.locator('.row-extra a').click();
  for (let i = 0; i < 30; i++) {
    if ((await application.evaluate(() => globalThis.__opened)).length) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.deepEqual(await application.evaluate(() => globalThis.__opened), [
    'https://example.com/billing',
  ]);
  assert.equal(application.windows().length, 1);
  assert.equal(new URL(page.url()).protocol, 'billing-memo:');
  checks.push('External HTTPS links leave the app only through a confirmed OS browser action');
  await page.click('a[href="#/reports"]');
  await page.screenshot({ path: 'test-results/desktop-app.png', fullPage: true });
  await writeFile(
    'test-results/desktop-verification.json',
    JSON.stringify({ checks, profile }, null, 2),
  );
  console.log(checks);
} finally {
  await application.close();
}
