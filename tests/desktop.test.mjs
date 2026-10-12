import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetKey, externalUrl, internalUrl } from '../desktop/security.mjs';
test('desktop only resolves bundled asset filenames', () => {
  assert.equal(assetKey('billing-memo://app/'), 'index.html');
  assert.equal(assetKey('billing-memo://app/assets/index-A_bc-1.js'), 'assets/index-A_bc-1.js');
  for (const url of [
    'file:///etc/passwd',
    'billing-memo://other/index.html',
    'billing-memo://app/package.json',
    'billing-memo://app/desktop/main.mjs',
    'billing-memo://app/assets/%2e%2e/desktop/main.mjs',
    'billing-memo://app/assets/%2fsecret.js',
    'billing-memo://user@app/',
  ])
    assert.equal(assetKey(url), null, url);
});
test('OS browser links accept HTTPS only without embedded credentials', () => {
  assert.equal(externalUrl('https://example.com/billing'), 'https://example.com/billing');
  for (const url of [
    'file:///C:/',
    'javascript:alert(1)',
    'ms-settings:',
    'http://example.com',
    'https://user:pass@example.com',
    'not a URL',
  ])
    assert.equal(externalUrl(url), null);
  assert.equal(internalUrl('https://example.com'), false);
});
