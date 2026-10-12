# Windows desktop

## Download and run

[Latest release](https://github.com/jeffrog-256k1/billing-memo/releases/latest):

- Billing-Memo-0.3.0-windows-x64-setup.exe: per-user installer.
- Billing-Memo-0.3.0-windows-x64.zip: extract, then run Billing Memo.exe.
- SHA256SUMS.txt: check with Get-FileHash -Algorithm SHA256 in PowerShell.

Windows 10/11 x64 and Microsoft Edge WebView2 Runtime are required. Version 0.3 uses Tauri 2 and the installed WebView2 engine. The UI is still a local web interface; the package no longer bundles Chromium/Node. If WebView2 is missing or below the configured minimum, the installer downloads it separately. That runtime download and its system footprint are not included in the app package size. The ZIP cannot install a missing runtime; use the installer instead. See [Tauri's Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/).

The application works offline after the runtime is available. The installer is unsigned; Windows may show an unknown-publisher/SmartScreen notice. Checksums establish file equality, not publisher identity. No auto-updater, macOS/Linux build or native ARM64 package is included.

## Clean start and saved data

Fresh desktop installations start with an empty ledger. The desktop app contains no demo switch. The web app also starts empty; only the explicit demo link or menu loads fictional examples in memory.

Current desktop storage: **%APPDATA%\app.leejungjae.billingmemo\ledger.json**. Language preferences and WebView2 cache live in the same profile's webview subdirectory. Installer and ZIP share the same ledger. ZIP storage is not self-contained on removable media.

Each save writes and syncs a temporary file, then atomically replaces ledger.json. The expected previous content is checked before replacing it, so stale saves fail. Invalid stored data is reported and preserved; a raw export is available for readable but malformed JSON. The profile and exports are unencrypted. Export JSON regularly; there is no cloud backup.

## Upgrading from Electron 0.2

1. Close the old app and keep a JSON backup from it.
2. Install or run 0.3. On first launch, when no new ledger.json exists, it looks for **%APPDATA%\Billing Memo\Local Storage\leveldb**.
3. It reads a bounded, disposable copy of that database and extracts only the saved Billing Memo ledger key. After full ledger validation, it saves native JSON. The original Electron profile remains unchanged.
4. In-memory demo examples have no saved ledger key and are not imported. If the old profile cannot be read, an on-screen message directs you to restore JSON. Custom old data directories require manual JSON transfer.
5. Verify your services and payments before removing an old installation. The migration is one-time; later edits in 0.2 do not sync to 0.3.

Existing 0.1/0.2 JSON backups remain compatible. Web and desktop storage are separate. Use **Ledger tools → Backup JSON** in the source and **Restore backup** in the destination. Restoring replaces the destination after confirmation, with a backup button offered first.

## Daily workflow

**My ledger** is the default: add/edit services, select a month, view total bills, paid amounts and unpaid estimates, and record actual payment amounts without switching pages. Project/category/notes and end/pause fields are optional. Filters change the service list, not the monthly totals. Settings provide currency, manual rates and budget; additional forecasts are collapsed.

**Calendar** adds due dates, day filtering, monthly CSV and unpaid ICS exports. **Reports** supports inclusive start/end dates, actual payment dates or scheduled due dates, project/category filters, total, monthly amounts/average and CSV exports. Ranges cover at most 120 calendar months; the average includes empty and partial months. Details paginate at 50 rows, but CSV includes all matching records. Missing exchange rates mark totals partial. See the README for calculation rules.

## Build and verify

Install Node.js 22.12+, current stable Rust, MSVC C++ Build Tools and WebView2. On Windows:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run build:desktop
npm run test:rust
npm run desktop:build
npm run test:packaged
npm run desktop:package
```

Tauri output is in ignored src-tauri/target/release; release-ready EXE, ZIP and hashes go to ignored release/. The native test launches the actual compiled EXE with its own --data-dir and a temporary CDP port only in that child process. Normal launches open no debugging port. On elevated GitHub-hosted Windows runners, the test temporarily sets an executable-scoped HKLM WebView2 debugging policy and removes that value after each test process. This CI-only step is needed because WebView2 150+ ignores environment overrides under elevation; it does not alter the production executable. Tests use fictional profiles and a synthetic Electron fixture; never point tests at personal data. The installer is built, while runtime tests exercise its compiled application rather than installing over a user's existing installation.

The native bridge exposes only ledger load/save, validated HTTPS link opening and native file-dialog import/export. There is no general filesystem or shell API. Popups, permission requests, direct webview downloads and remote navigation are denied. Provider URLs open in the system browser on user action. CSP allows packaged resources and local Tauri IPC only. Third-party notices accompany both packages.

npm run desktop runs a development build. npm run icon regenerates the original icon; npm run render:assets refreshes documentation screenshots. scripts/generate-notices.mjs collects dependency notices from Cargo's locked packages, including exact upstream source links.
