# Changelog

## 0.3.0

- Fresh desktop and web workspaces start empty; web sample mode is explicit and temporary.
- Combined service editing, monthly totals and payment recording in My ledger; Calendar and Reports remain separate.
- Compact forms, optional details, status filtering, responsive five-language layout and quieter visuals.
- Replaced Electron with Tauri 2 and system WebView2, without shipping a browser runtime.
- Native atomic JSON storage, file-dialog backup/restore and safe one-time migration from the old saved ledger. Original Electron files remain unchanged.
- Restricted native bridge, remote navigation/popup/permission denial and actual packaged-app regression checks.
- Windows installer, ZIP and checksums, with included third-party license notices.

## 0.2.0 — 2026-10-12

- Windows x64 desktop app with installer, installation-free ZIP and SHA-256 checksums.
- Separate Overview, Services, Calendar and Reports pages, shared by web and desktop.
- Inclusive date-range reports by actual payment date or scheduled due date, monthly totals and averages, project/category filters, and paginated details.
- Period and monthly-total CSV exports with original currencies and explicit partial-conversion flags.
- Existing JSON/local ledger compatibility; no schema migration or automatic data replacement.
- Sandboxed desktop renderer, packaged custom protocol, restricted navigation/links and hardened Electron fuses.
- Five-language documentation, expanded web/report tests, Windows app and packaged-executable checks in CI.

## 0.1.0 — 2026-10-12

- First public version of Billing Memo, a browser-local developer expense notebook.
- Monthly, annual, usage-estimate and one-time plans with anchored recurrence and end dates.
- Monthly forecast, paid snapshots, recurring monthly equivalent, manual exchange rates and budget.
- Search, category/project filters, day calendar, six-month outlook and direct billing links.
- Validated JSON backup/restore, formula-safe CSV and unpaid ICS with three-day reminders.
- Five-language interface and READMEs, responsive schematic graphics, Canvas circuit animation and reduced-motion support.
- Fictional demo isolated from saved data, storage error recovery and multi-tab conflict detection.
