# Dependencies and credits

The deployed web application has no runtime npm dependencies. The desktop edition bundles Electron and its Chromium/Node runtime; their LICENSE and LICENSES.chromium.html accompany the Windows distribution. It uses browser APIs, system fonts and original Canvas/SVG/CSS graphics. No provider logos, remote font services, tracking libraries or external data feeds are included.

Development dependencies are pinned in `package-lock.json`:

- Electron — MIT, with bundled third-party notices. Desktop runtime.
- electron-builder — MIT. Installer/archive packaging, not shipped as application code.
- @electron/fuses — MIT. Build-time executable hardening.
- Vite — MIT. Static build and local preview.
- TypeScript — Apache-2.0. Type checking.
- Playwright — Apache-2.0. Isolated browser tests and media rendering.
- Prettier — MIT. Source formatting.
- gifenc — MIT. README animation encoding only; not shipped in the app.
- @types/node — MIT. Node.js type definitions.

Each package contains its own license and notices, including notices for transitive dependencies. Service names such as AWS, Cloudflare, Google Cloud, Resend, Vercel, Supabase and Brave are used to identify optional billing links. No affiliation or endorsement is implied. Sample prices are invented.
