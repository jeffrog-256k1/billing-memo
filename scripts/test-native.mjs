import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir, readFile, writeFile, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';

const executable = path.resolve(
  process.env.BILLING_MEMO_PACKAGED_EXE || 'src-tauri/target/release/billing-memo.exe',
);
const root = path.resolve('test-results/native-' + Date.now());
await mkdir(root, { recursive: true });
const checks = [],
  errors = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function ciDebugPolicy(port) {
  // WebView2 150+ ignores environment overrides in elevated hosted Windows runners.
  // Scope the temporary HKLM policy to this executable, only in disposable CI.
  // https://github.com/MicrosoftEdge/WebView2Feedback/issues/5645
  if (process.env.GITHUB_ACTIONS !== 'true') return () => {};
  const key = 'HKLM\\SOFTWARE\\Policies\\Microsoft\\Edge\\WebView2\\AdditionalBrowserArguments';
  const name = path.basename(executable);
  const run = (args) => execFileSync('reg.exe', args, { windowsHide: true, stdio: 'ignore' });
  let exists = true;
  try {
    run(['query', key, '/v', name]);
  } catch {
    exists = false;
  }
  if (exists) throw Error('Refusing to overwrite an existing WebView2 test policy');
  run([
    'add',
    key,
    '/v',
    name,
    '/t',
    'REG_SZ',
    '/d',
    `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
    '/f',
  ]);
  return () => run(['delete', key, '/v', name, '/f']);
}
async function launch(profile) {
  await mkdir(profile, { recursive: true });
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const clearPolicy = ciDebugPolicy(port);
  const child = spawn(executable, ['--data-dir', profile], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
  });
  let browser;
  try {
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw Error(`App exited: ${child.exitCode}`);
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        break;
      } catch {
        await delay(200);
      }
    }
    if (!browser) throw Error('WebView2 debugging endpoint did not start');
    const page = browser.contexts()[0].pages()[0];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.locator('.page-nav').waitFor();
    await page.selectOption('#language', 'en');
    return {
      page,
      browser,
      async close() {
        await browser.close();
        const exited = child.exitCode !== null ? Promise.resolve() : once(child, 'exit');
        child.kill();
        await exited;
        clearPolicy();
        await delay(400);
      },
    };
  } catch (error) {
    await browser?.close();
    child.kill();
    clearPolicy();
    throw error;
  }
}
const submit = async (page) => {
  await page.click('dialog button[type="submit"]');
  await page.locator('dialog[open]').waitFor({ state: 'hidden' });
};
let running;
try {
  const profile = path.join(root, 'fresh');
  running = await launch(profile);
  let { page } = running;
  assert.equal(await page.locator('.bill-row').count(), 0);
  assert.equal(await page.locator('#switch-mode').count(), 0);
  assert.equal(await page.locator('.demo-ribbon').count(), 0);
  assert.match(await page.locator('#month-total').innerText(), /0\.00/);
  await page.screenshot({ path: 'test-results/native-empty.png', fullPage: true });
  checks.push('Packaged Windows app starts empty, without demo controls');
  await page.click('[data-action="add"]');
  assert.equal(await page.locator('dialog .form-optional[open]').count(), 0);
  await page.fill('[name="name"]', 'Native ledger QA');
  await page.fill('[name="amount"]', '12.50');
  await submit(page);
  assert.match(await page.locator('#month-total').innerText(), /12\.50/);
  await page.click('[data-edit]');
  await page.fill('[name="amount"]', '14.90');
  await submit(page);
  assert.match(await page.locator('#month-total').innerText(), /14\.90/);
  await page.click('[data-pay]');
  await page.fill('[name="actual"]', '13.75');
  await submit(page);
  assert.match(await page.locator('#paid-total').innerText(), /13\.75/);
  assert.match(await page.locator('#unpaid-total').innerText(), /0\.00/);
  const persisted = JSON.parse(await readFile(path.join(profile, 'ledger.json'), 'utf8'));
  assert.equal(persisted.services[0].amount, 1490);
  assert.equal(persisted.payments[0].amount, 1375);
  await page.screenshot({ path: 'test-results/native-ledger.png', fullPage: true });
  checks.push('Add, edit and settle on one screen; atomic native JSON matches displayed totals');
  await page.click('a[href="#/reports"]');
  await page.locator('#report-form').waitFor();
  await page.click('#report-form button[type="submit"]');
  assert.match(await page.locator('#period-total').innerText(), /13\.75/);
  await running.close();
  running = undefined;
  running = await launch(profile);
  page = running.page;
  assert.equal(await page.locator('.bill-row').count(), 1);
  assert.match(await page.locator('#paid-total').innerText(), /13\.75/);
  checks.push('Period report uses recorded payments; records persist across a full app restart');
  const security = await page.evaluate(async () => {
    const invoke = window.__TAURI_INTERNALS__.invoke;
    const rejected = async (name, args) => {
      try {
        await invoke(name, args);
        return false;
      } catch {
        return true;
      }
    };
    return {
      noNode: typeof process === 'undefined' && typeof require === 'undefined',
      noFs: await rejected('plugin:fs|read_text_file', { path: 'C:\\Windows\\win.ini' }),
      noArbitrarySave: await rejected('export_file', { content: 'x', filename: '../escape.exe' }),
      noUnsafeLinks: await rejected('open_link', { url: 'file:///C:/Windows/win.ini' }),
      noMalformedLedger: await rejected('save_workspace', { content: '{}', expected: null }),
      staleWritesRejected: await rejected('save_workspace', {
        content: JSON.stringify({ version: 1, services: [], payments: [] }),
        expected: null,
      }),
      notification: await Notification.requestPermission(),
    };
  });
  for (const [name, value] of Object.entries(security))
    assert.equal(value, name === 'notification' ? 'denied' : true, name);
  const appUrl = page.url();
  await page.evaluate(() => {
    window.open('https://example.com', '_blank');
    location.href = 'https://example.com';
  });
  await delay(300);
  assert.equal(page.url(), appUrl);
  assert.equal(running.browser.contexts()[0].pages().length, 1);
  checks.push(
    'No Node or generic filesystem bridge; unsafe links, filenames, stale writes, permissions and remote navigation denied',
  );
  await running.close();
  running = undefined;

  const fixture = path.resolve('tests/fixtures/electron-v02');
  const legacyProfile = path.join(root, 'migration'),
    legacy = path.join(legacyProfile, 'legacy/Local Storage/leveldb');
  await mkdir(legacy, { recursive: true });
  const hashes = new Map();
  for (const name of await readdir(fixture)) {
    if (name === 'CURRENT' || name.startsWith('MANIFEST-') || /\.(ldb|log)$/.test(name)) {
      await copyFile(path.join(fixture, name), path.join(legacy, name));
      hashes.set(
        name,
        createHash('sha256')
          .update(await readFile(path.join(legacy, name)))
          .digest('hex'),
      );
    }
  }
  running = await launch(legacyProfile);
  page = running.page;
  assert.equal(await page.locator('.service-name h3').innerText(), 'Migration QA 테스트');
  assert.deepEqual(
    JSON.parse(await readFile(path.join(legacyProfile, 'ledger.json'), 'utf8')),
    JSON.parse(await readFile(path.join(fixture, 'expected.json'), 'utf8')),
  );
  for (const [name, hash] of hashes)
    assert.equal(
      createHash('sha256')
        .update(await readFile(path.join(legacy, name)))
        .digest('hex'),
      hash,
    );
  checks.push(
    'Actual v0.2 Electron LevelDB fixture migrates Unicode services and payment snapshots; original bytes unchanged',
  );
  await running.close();
  running = undefined;
  const corruptProfile = path.join(root, 'corrupt');
  await mkdir(corruptProfile);
  await writeFile(path.join(corruptProfile, 'ledger.json'), 'broken-original');
  running = await launch(corruptProfile);
  await running.page.locator('#raw-backup').waitFor();
  assert.equal(await readFile(path.join(corruptProfile, 'ledger.json'), 'utf8'), 'broken-original');
  checks.push('Corrupt existing native ledger is reported and preserved');
  assert.deepEqual(errors, []);
  await writeFile(
    'test-results/native-verification.json',
    JSON.stringify({ executable, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await running?.close();
}
