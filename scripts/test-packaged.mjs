import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { getCurrentFuseWire, FuseState, FuseV1Options } from '@electron/fuses';
const executable = path.resolve(
  process.env.BILLING_MEMO_PACKAGED_EXE || 'release/win-unpacked/Billing Memo.exe',
);
const profile = path.resolve('test-results', 'packaged-profile-' + Date.now());
await mkdir(profile, { recursive: true });
const wire = await getCurrentFuseWire(executable);
for (const key of [
  FuseV1Options.RunAsNode,
  FuseV1Options.EnableNodeOptionsEnvironmentVariable,
  FuseV1Options.EnableNodeCliInspectArguments,
  FuseV1Options.GrantFileProtocolExtraPrivileges,
])
  assert.equal(wire[key], FuseState.DISABLE);
for (const key of [
  FuseV1Options.EnableEmbeddedAsarIntegrityValidation,
  FuseV1Options.OnlyLoadAppFromAsar,
])
  assert.equal(wire[key], FuseState.ENABLE);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_OPTIONS;
async function launch() {
  const child = spawn(executable, [`--user-data-dir=${profile}`, '--remote-debugging-port=0'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  let output = '';
  child.stderr.on('data', (data) => {
    output += data.toString();
  });
  child.on('error', (error) => {
    output += String(error);
  });
  let endpoint;
  for (let i = 0; i < 150; i++) {
    endpoint = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
    if (endpoint) break;
    if (child.exitCode !== null) throw Error('Packaged launch exited: ' + output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!endpoint) {
    child.kill();
    throw Error('No test-only CDP endpoint: ' + output);
  }
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0];
  let page = context.pages()[0];
  if (!page) page = await context.waitForEvent('page');
  await page.locator('.page-nav').waitFor();
  return { browser, page, child };
}
let running = await launch();
const close = async () => {
  const exited = once(running.child, 'exit');
  await running.page.close();
  await Promise.race([
    exited,
    new Promise((_, reject) =>
      setTimeout(() => reject(Error('App failed to quit')), 10000).unref(),
    ),
  ]);
  await running.browser.close();
};
try {
  let page = running.page;
  assert.equal(new URL(page.url()).origin, 'null'); // Custom URL schemes do not have a Node WHATWG origin.
  assert.equal(await page.evaluate(() => isSecureContext), true);
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await page.click('#switch-mode');
  await page.click('#add');
  await page.fill('[name="name"]', 'Packaged QA');
  await page.fill('[name="amount"]', '8.25');
  await page.fill('[name="anchor"]', new Date().toISOString().slice(0, 7) + '-01');
  await page.click('dialog button[type="submit"]');
  await page.click('a[href="#/calendar"]');
  await page.click('[data-pay]');
  await page.click('dialog button[type="submit"]');
  await page.click('a[href="#/reports"]');
  await page.locator('#period-total').waitFor();
  assert.match(await page.locator('#period-total').innerText(), /8\.25/);
  await page.screenshot({ path: 'test-results/packaged-app.png', fullPage: true });
  await close();
  running = await launch();
  page = running.page;
  await page.click('a[href="#/reports"]');
  await page.locator('#period-total').waitFor();
  assert.match(await page.locator('#period-total').innerText(), /8\.25/);
  await writeFile(
    'test-results/packaged-verification.json',
    JSON.stringify(
      {
        executable,
        version: JSON.parse(await readFile('package.json', 'utf8')).version,
        fuses: wire,
        checks: [
          'Actual packaged executable starts with ASAR integrity enabled',
          'Secure custom origin, no Node renderer, all four routes',
          'Payment report correct and retained after full process restart',
        ],
      },
      null,
      2,
    ),
  );
  console.log('Packaged executable, security fuses, payment report and restart persistence passed');
} finally {
  if (running.child.exitCode === null) await close();
}
