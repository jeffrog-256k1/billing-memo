# Windows desktop and period reports

## Download

[Latest release](https://github.com/jeffrog-256k1/billing-memo/releases/latest) contains:

- `Billing-Memo-0.2.0-windows-x64-setup.exe`: per-user Windows installer, with selectable directory and optional desktop shortcut. Administrator elevation is not requested.
- `Billing-Memo-0.2.0-windows-x64.zip`: extract the **entire archive**, then run `Billing Memo.exe`. Keep its supporting files together. No installation is required.
- `SHA256SUMS.txt`: hashes for checking downloaded files with `Get-FileHash -Algorithm SHA256` in PowerShell.

This release targets Windows 10/11 x64. macOS, Linux and native Windows ARM64 packages are not included. The installer is unsigned; Windows may display an unknown-publisher or SmartScreen warning. A checksum verifies file equality, not publisher identity. Obtain files from this repository's release page. There is no background updater; download future releases from the same page.

The desktop app starts offline and bundles its own runtime. It uses the same interface, calculations and five languages as the web version. Service links open in the default browser after confirmation.

## Your data

Desktop data lives under `%APPDATA%\Billing Memo`, including the app's localStorage. Both installer and ZIP use this location. The ZIP is installation-free, **not** a self-contained USB data folder. App updates and normal uninstall preserve the profile. Removing the profile removes the ledger. Export JSON before upgrades or moving computers.

Web and desktop storage are separate. **Backup JSON** in the source app, then **Restore backup** in the destination. Restore replaces that destination ledger after confirmation. Version 0.1 JSON backups work without conversion. There is no automatic sync, account or server backup. Local data and exported files are not encrypted; do not enter credentials, API keys or payment-card details.

## Pages and reports

- **Overview:** selected month's expected costs, recorded amounts, remaining estimates and six-month outlook.
- **Services:** all editable services, including paused plans; project/category/search filters.
- **Calendar:** monthly due dates, payment records, budget/category breakdown and CSV/ICS exports.
- **Reports:** inclusive start/end dates, actual or scheduled date basis, project/category filters, total, monthly average, month-by-month chart and detail records.

**Actual payments** uses each recorded payment's actual payment date. For example, a January 31 invoice paid on February 1 counts in February. Unrecorded estimates do not count as actual spending. **Scheduled bills** uses due dates and combines recorded amounts with unpaid estimates. Service edits affect unpaid forecasts, including past months; paid snapshots remain unchanged.

Ranges may cover up to 120 calendar months. The average divides the total by all calendar months touched by the range, including empty and partial months; it is not a prorated daily average. Details paginate at 50 rows; exports include all matching records. Period CSV includes both due date and payment date. Monthly CSV has one row per month, original-currency columns, base currency, converted total and a conversion-completeness flag. Missing manual exchange rates produce clearly marked partial totals. Rates are the workspace's current manual rates, not historical market rates.

## Build and verify

On Windows with Node.js 22.12+:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run test:desktop
npm run desktop:build
npm run test:packaged
```

Outputs go to ignored `release/`. Tests use isolated fictional profiles in ignored `test-results/`. Packaged tests start a temporary local debugging port explicitly for that test process; normal launches open no listening port. Keep the test results private because a manually chosen profile may contain local data. `npm run desktop` runs the desktop app from source. `npm run icon` regenerates the original app icon with Playwright. Neither build nor app requires provider keys.

The app uses a secure standard custom protocol to load only bundled assets, renderer sandboxing and context isolation. Node integration, webviews, renderer network requests, permission grants and remote navigation are disabled. Electron fuses disable RunAsNode, NODE_OPTIONS and Node inspector switches, and enforce ASAR loading/integrity validation. There is no preload API or renderer IPC bridge. See [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [custom protocols](https://www.electronjs.org/docs/latest/api/protocol) and [fuses](https://www.electronjs.org/docs/latest/tutorial/fuses).
