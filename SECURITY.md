# Security

Use [GitHub private vulnerability reporting](https://github.com/jeffrog-256k1/billing-memo/security/advisories/new) with fictional reproduction data. Do not post real spending records, billing documents or credentials in public issues. The 0.2 release line is supported on a best-effort basis.

The app operates on manually entered data. It does not connect to providers, read accounts, fetch billing URLs, execute payments, or transmit ledger data. Provider links open only after a user action, with `noopener noreferrer`. HTTPS links containing embedded credentials are rejected. Text is HTML-escaped, imported structures are validated, and spreadsheet formula prefixes are neutralized in CSV output. Dates, counts, amounts and input sizes are bounded.

The static build uses a meta Content Security Policy with `default-src 'none'`, same-origin scripts/styles/images, `connect-src 'none'`, and no inline scripts or inline style blocks. GitHub Pages does not let this app configure all response headers; a meta CSP is not equivalent to an edge header policy and cannot supply `frame-ancestors`. On a dedicated host, set suitable response headers as well. The app does not claim an Observatory score.

localStorage is not encrypted and is scoped to an origin, not a URL path. Other scripts on the same origin may access it. Use a dedicated origin for stronger separation; do not put secrets in notes or URLs. Clearing browser data removes saved entries. JSON, CSV and ICS exports contain user content. There is no server backup, authentication or multi-device synchronization. Budget/conversion numbers are user-entered planning estimates, not provider invoices.

Writes compare the stored payload before overwriting it to detect another tab's changes. This is best-effort conflict protection, not an atomic database transaction across tabs. Unreadable stored data is preserved until an explicit valid restore. A quota/permission failure keeps the current in-memory view exportable and displays a warning. Supported imports and serialized data are at most 2 MiB; 500 services and 5,000 payment snapshots are allowed within that size.

Browser tests run with isolated fictional data, including invalid JSON, unsafe URL schemes, HTML-like strings, storage failure and concurrent-tab cases. They do not inspect user browser profiles or personal billing data.

## Desktop boundary

The Windows edition bundles Electron, not a web server. Its secure custom protocol serves only allowlisted packaged assets. The renderer is sandboxed with context isolation and no Node integration, preload bridge, webviews or permission grants. Remote navigation and automatic renderer network requests are denied. HTTPS links require a native confirmation before opening in the operating system browser. ASAR integrity and loading fuses are enabled; RunAsNode, NODE_OPTIONS and Node inspector switches are disabled in distributed executables. See [desktop storage, build and download details](docs/DESKTOP.md).

The local profile and exports are not encrypted, and this release is unsigned. No automatic update service is present. Install updates from the official releases page. Backups from 0.1 remain compatible.

## Build dependency audit (2026-10-12)

The packaged app contains no third-party npm runtime dependencies; Electron and its bundled Chromium/Node runtime remain security-sensitive and must be updated. The Windows build toolchain currently reports eight moderate audit entries deriving from one transitive sprintf-js denial-of-service advisory, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), through electron-builder's download/proxy logger. No patched sprintf-js release is available in the registry at this audit. These build-only packages are excluded from the application ASAR. Builds use trusted configuration; ledger text is not passed to this logger. Do not treat this as a zero-vulnerability dependency audit. Recheck when updating packaging tools; automatic forced downgrades are not used.
