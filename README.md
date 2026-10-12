# Billing Memo

[English](README.md) · [한국어](README.ko.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [Español](README.es.md)

**Every tool. One clear ledger.** A small, local expense notebook for cloud services, hosting, databases, email, APIs and subscriptions.

[Download Windows v0.3.0](https://github.com/jeffrog-256k1/billing-memo/releases/latest) · [Open web app](https://jeffrog-256k1.github.io/billing-memo/) · [Try sample data](https://jeffrog-256k1.github.io/billing-memo/?demo=1) · [MIT](LICENSE)

![Your new, empty ledger](assets/empty.png)

## Start clean. Manage everything on one screen.

1. First launch opens an **empty ledger**, with no sample subscriptions or demo mode in the desktop app.
2. Add a name, amount, currency, billing cycle and first billing date. Add a billing link if useful; project, category and notes are optional.
3. **My ledger** combines service editing, monthly bills, paid amounts and remaining estimates. Change the month without leaving your services.
4. Record the actual amount when paid. Export JSON from **Ledger tools** for backups or transfer between web and desktop.

![Ledger with explicitly selected fictional demo data](assets/overview.png)

The web app also starts empty. Sample data is available only through **Ledger tools → View demo** or the sample-data link above. Demo edits are temporary and never overwrite your saved ledger; **Open my ledger** returns to your own entries. All sample amounts are invented, not provider prices.

## Smaller Windows app

Version 0.3 replaces Electron with **Tauri + the system WebView2 runtime**. It still renders a local web interface, but no longer ships another Chromium/Node runtime. The app works offline after WebView2 is installed. The installer downloads WebView2 only if it is missing or too old; that separate download is not included in the small installer size.

Windows 10/11 x64: use the installer, or extract the ZIP and run **Billing Memo.exe**. The ZIP also requires WebView2. Both save to **%APPDATA%/app.leejungjae.billingmemo/ledger.json**; ZIP storage is not USB-contained. The release is unsigned; Windows may show an unknown-publisher/SmartScreen notice. Check SHA256SUMS.txt for file integrity. There is no automatic updater.

**Upgrading from 0.2:** close the old app and export a JSON backup first. On first launch, the new app tries to copy the saved ledger from the old default profile. The original Electron files stay unchanged; sample/demo data is not imported. If migration cannot read the old profile, a warning offers JSON restore. Existing 0.1/0.2 JSON backups remain compatible. [Desktop guide](docs/DESKTOP.md)

## Three focused pages

- **My ledger:** add/edit services, billing links, monthly totals, payment status, search, project/category/status filters, optional budget and collapsed six-month outlook. Monthly totals always include all services, regardless of list filters.
- **Calendar:** due dates, day filtering, payments, monthly CSV and unpaid-bill ICS reminders.
- **Reports:** inclusive start/end dates, period total, monthly amounts and average. Choose actual payment dates or scheduled due dates; filter by project/category and export details or monthly totals as CSV. Up to 120 calendar months, with empty and partial months included in the average.

![Period report with fictional entries](assets/period-report.png)

Full interface and documentation: English, Korean, Simplified Chinese, Japanese and Spanish.

## How totals work

Monthly, annual, usage-based and one-time entries are supported. Usage is a **manually entered monthly total**, not automatic API metering. Recurrence starts at the first billing date; January 31 becomes the last day of February, then returns to March 31. Annual fees count in full in their due month; only the separate recurring monthly equivalent divides them by 12. One-time items do not enter that equivalent.

Monthly bills = recorded payments + unpaid estimates, grouped by billing month. **Reports → Actual payments** instead groups by payment date. A January 31 bill paid on February 1 therefore belongs to January in My ledger and February in actual-payment reports. Payment snapshots survive service edits, pauses and deletion. Service edits affect all unpaid estimates, including past months. One invoice per service per month; use separate one-time services for extra transactions.

Amounts use integer minor units. USD, KRW, EUR, JPY, CNY and GBP are supported; KRW/JPY have no decimal places. Currencies stay separate until you enter manual rates. Missing rates mark converted totals as partial. Conversion rounds per item; changing display currency resets rates and budget. Rates are not automatically updated or historical exchange rates.

## Storage and boundaries

No login, backend, billing API integration, automatic tracking or device sync. Desktop stores native JSON atomically with conflict detection. Web stores data in this browser's localStorage; browser/site-data deletion removes it. Web and desktop storage are separate: transfer with JSON backup/restore. Restore replaces the destination after confirmation.

Data and exports are not encrypted. Do not store passwords, API keys or card details. The web app shares its origin with other pages hosted on that origin; self-host on a dedicated origin for separation. Unreadable data and failed saves are shown rather than silently reset.

Limits: 500 services, 5,000 payment snapshots, 2 MiB workspace/import, dates 2000–2199, names 80 characters and notes 2,000. Amounts are nonnegative, up to 100 billion minor units per entry. Links must be HTTPS without credentials. The app does not charge cards, reconcile invoices or send background reminders. ICS reminders run in your calendar app.

## Development

Node.js 22.12+ and npm:

```sh
git clone https://github.com/jeffrog-256k1/billing-memo.git
cd billing-memo
npm ci
npm run dev
```

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run test:reports
npm run format:check
```

The local dev command builds and previews the production CSP; rerun after source changes. Windows builds also require stable Rust, MSVC C++ Build Tools and WebView2. See [desktop build instructions](docs/DESKTOP.md). No provider keys are needed.

[Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Dependencies](THIRD_PARTY_NOTICES.md)

Built by [jeffrog-256k1](https://github.com/jeffrog-256k1) · [leejungjae.app](https://leejungjae.app)
