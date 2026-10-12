# Security

Report a reproducible issue privately through the repository's GitHub security advisory flow. Use fictional data; never publish real bills, backups or credentials in an issue.

## Data and web boundary

No provider credentials, accounts, analytics, backend or automatic billing integrations. Web data uses localStorage; other scripts on the same origin share its storage. Host on a dedicated origin for isolation. Desktop data is local JSON. Neither data nor exports are encrypted; do not store secrets or card information. Back up regularly.

Imports are limited to 2 MiB, strictly validated and confirmed before replacement. Text is escaped before rendering, URLs are restricted to HTTPS without credentials, and spreadsheet-formula prefixes are neutralized in CSV exports. Stored amounts and dates are validated. Web writes detect stale tabs; desktop saves compare prior content and use atomic replacement. Unreadable data is preserved and reported.

## Desktop boundary

Tauri 2 uses the system WebView2 engine to render bundled HTML/CSS/JS. No Node runtime, local HTTP server or general-purpose filesystem/shell bridge is included. Native commands are limited to ledger persistence, validated link opening and file-dialog import/export. No plugin capabilities are granted to the renderer. Remote navigation, popups, direct downloads and new permission requests are denied. Links deliberately opened by the user go to the default browser.

CSP denies unspecified resource types and allows only packaged assets and local IPC. Tests explicitly start a debugging endpoint in their own isolated child process; normal launches do not. The legacy Electron migration operates on a bounded disposable database copy and imports only a validated saved ledger, leaving original files untouched.

The build is unsigned and has no automatic updater. Keep Windows/WebView2 current and download app updates from this repository. JSON backups remain compatible. See [desktop guide](docs/DESKTOP.md).

## Dependencies

Electron and its packaging dependencies were removed in 0.3. package-lock.json and src-tauri/Cargo.lock pin the toolchain/application dependencies. npm audit reports no advisories at the 0.3 release check; this covers npm packages, not a proof that the Rust or system runtime is vulnerability-free. Review [dependency notices](THIRD_PARTY_NOTICES.md) when updating packages.
