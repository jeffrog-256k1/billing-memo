# Dependencies and credits

The desktop application uses Tauri 2, Rust and the separately installed Microsoft WebView2 runtime. It does not bundle Chromium or Node. The shared web frontend includes the small @tauri-apps/api bridge, which is inactive in a normal browser. Fonts, SVG/CSS visuals and the app icon are local/original. No provider logos, remote fonts, tracking libraries or data feeds are loaded automatically.

[Full notices](THIRD_PARTY_LICENSES.txt) include the Windows dependencies and build dependencies, with source archive links for exact crate versions. Unmodified MPL components' sources are available at those links. Identical license texts are referenced once. Notices and the project license accompany the installer and ZIP. Regenerate with scripts/generate-notices.mjs after dependency changes.

- Tauri, its API/CLI, opener and single-instance plugins — MIT or Apache-2.0.
- serde, serde_json, tempfile, url and rfd — licenses recorded in full notices.
- rusty-leveldb — MIT; used to read a disposable copy of legacy Electron storage.
- Vite, Prettier and @types/node — MIT; development tools.
- TypeScript and Playwright — Apache-2.0; development tools.

Versions are locked in package-lock.json and src-tauri/Cargo.lock. Service names identify optional billing links; there is no affiliation or endorsement. Sample prices are invented.
