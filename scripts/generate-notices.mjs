// Regenerate after dependency changes, with Cargo sources fetched locally.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const metadata = JSON.parse(
  execFileSync(
    'cargo',
    [
      'metadata',
      '--manifest-path',
      'src-tauri/Cargo.toml',
      '--format-version',
      '1',
      '--filter-platform',
      'x86_64-pc-windows-msvc',
      '--offline',
    ],
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  ),
);
const texts = new Map(),
  entries = [];
function add(text) {
  text = text.replaceAll('\r\n', '\n').trim();
  const hash = createHash('sha256').update(text).digest('hex');
  if (!texts.has(hash)) texts.set(hash, { id: texts.size + 1, text });
  return texts.get(hash).id;
}
for (const p of metadata.packages
  .filter((p) => p.source)
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const directory = path.dirname(p.manifest_path);
  const files = fs
    .readdirSync(directory)
    .filter(
      (n) =>
        /^(licen[sc]e|copying|notice)([-_.].*)?$/i.test(n) &&
        fs.statSync(path.join(directory, n)).isFile(),
    );
  if (p.license_file && fs.existsSync(path.resolve(directory, p.license_file)))
    files.push(p.license_file);
  const licenses = files.map((f) => add(fs.readFileSync(path.resolve(directory, f), 'utf8')));
  // crc32c declares Apache-2.0/MIT but publishes no license file. Select Apache-2.0.
  if (!licenses.length && p.name === 'crc32c') {
    const serde = metadata.packages.find((p) => p.name === 'serde');
    licenses.push(
      add(fs.readFileSync(path.join(path.dirname(serde.manifest_path), 'LICENSE-APACHE'), 'utf8')),
    );
  }
  if (!licenses.length && p.name === 'selectors') {
    const css = metadata.packages.find((p) => p.name === 'cssparser');
    licenses.push(
      add(fs.readFileSync(path.join(path.dirname(css.manifest_path), 'LICENSE'), 'utf8')),
    );
  }
  if (!licenses.length) {
    const vcs = JSON.parse(fs.readFileSync(path.join(directory, '.cargo_vcs_info.json'), 'utf8'));
    const repo = p.repository?.match(/^https:\/\/github.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/)?.[1];
    if (!repo || !/^[a-f0-9]{40}$/.test(vcs.git.sha1)) throw Error('Unresolved license: ' + p.name);
    for (const filename of [
      'LICENSE',
      'LICENSE-MIT',
      'LICENSE.txt',
      'LICENSE-BSD',
      'LICENSE-MPL-2.0',
      'LICENSE-APACHE',
    ]) {
      const response = await fetch(
        `https://raw.githubusercontent.com/${repo}/${vcs.git.sha1}/${filename}`,
      );
      if (response.status === 404) continue;
      if (!response.ok) throw Error('License download: ' + response.status);
      const text = await response.text();
      if (text.length < 100 || text.length > 200000) throw Error('Unexpected license');
      licenses.push(add(text));
      break;
    }
    if (!licenses.length) throw Error('Missing license: ' + p.name);
  }
  entries.push(
    `${p.name} ${p.version}\nAuthors: ${p.authors.join(', ')}\nLicense: ${p.license}\nSource: ${p.repository || p.homepage || 'https://crates.io/crates/' + p.name}\nSource archive: https://static.crates.io/crates/${p.name}/${p.name}-${p.version}.crate\nLicense texts: ${[...new Set(licenses)].join(', ')}`,
  );
}
const api = 'node_modules/@tauri-apps/api';
const apiPackage = JSON.parse(fs.readFileSync(path.join(api, 'package.json'), 'utf8'));
entries.push(
  `@tauri-apps/api ${apiPackage.version}\nLicense: MIT OR Apache-2.0\nSource: https://github.com/tauri-apps/tauri\nLicense texts: ${fs
    .readdirSync(api)
    .filter((n) => n.startsWith('LICENSE'))
    .map((f) => add(fs.readFileSync(path.join(api, f), 'utf8')))
    .join(', ')}`,
);
const output =
  'Billing Memo — third-party notices\n\nIncludes Windows runtime and build dependency notices. Identical license texts are listed once and referenced by number. Microsoft WebView2 is installed and serviced separately.\n\n' +
  entries.join('\n\n') +
  '\n\n' +
  [...texts.values()]
    .map(({ id, text }) => '='.repeat(70) + '\nLICENSE TEXT ' + id + '\n\n' + text)
    .join('\n\n') +
  '\n';
fs.writeFileSync('THIRD_PARTY_LICENSES.txt', output);
console.log({
  packages: entries.length,
  distinctTexts: texts.size,
  bytes: Buffer.byteLength(output),
});
