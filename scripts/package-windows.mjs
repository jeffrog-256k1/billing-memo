import { copyFile, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (process.platform !== 'win32' || !/^\d+\.\d+\.\d+$/.test(version))
  throw Error('Windows release required');
const directory = path.resolve('release', `windows-${version}`);
await mkdir(directory, { recursive: true });
await copyFile(
  'src-tauri/target/release/billing-memo.exe',
  path.join(directory, 'Billing Memo.exe'),
);
for (const name of ['LICENSE', 'THIRD_PARTY_LICENSES.txt'])
  await copyFile(name, path.join(directory, name));
await writeFile(
  path.join(directory, 'README.txt'),
  `Billing Memo ${version}\r\n\r\nRun Billing Memo.exe on Windows 10/11 x64 with Microsoft Edge WebView2 Runtime.\r\nThe installer can download WebView2 if missing; this ZIP does not bundle it.\r\nData: %APPDATA%\\app.leejungjae.billingmemo\\ledger.json\r\nExisting 0.2 default-profile data is copied on first launch, without changing the original.\r\nNo automatic update or cloud sync. Use Ledger tools to back up and restore JSON.\r\nhttps://github.com/jeffrog-256k1/billing-memo/blob/main/docs/DESKTOP.md\r\n`,
);
const names = [
  `Billing-Memo-${version}-windows-x64-setup.exe`,
  `Billing-Memo-${version}-windows-x64.zip`,
];
await copyFile(
  `src-tauri/target/release/bundle/nsis/Billing Memo_${version}_x64-setup.exe`,
  path.join('release', names[0]),
);
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Compress-Archive -LiteralPath ${['Billing Memo.exe', 'LICENSE', 'THIRD_PARTY_LICENSES.txt', 'README.txt'].map((name) => quote(path.join(directory, name))).join(',')} -DestinationPath ${quote(path.resolve('release', names[1]))} -CompressionLevel Optimal -Force`,
  ],
  { windowsHide: true, stdio: 'inherit' },
);
const sums = [];
for (const name of names) {
  const file = path.join('release', name);
  const sha = createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
  sums.push(`${sha}  ${name}`);
  console.log(JSON.stringify({ name, bytes: (await stat(file)).size, sha256: sha }));
}
await writeFile('release/SHA256SUMS.txt', sums.join('\n') + '\n');
