# Contributing

Describe the problem and a small fictional example in an issue before a large change. Never attach real invoices, personal spending, credentials, payment card data or private billing links.

Use Node.js 22.12+ and `npm ci`. Run `npm test`, `npm run build`, `npm run test:browser` (after installing Playwright Chromium), and `npm run format:check`. Format changes with `npm run format`.

Keep monetary calculations in `src/model.ts`, localized UI copy in `src/i18n.ts`, and fictional examples in `src/sample.ts`. Update all five READMEs when behavior changes. Add focused tests for recurrence, rounding, persistence and import/export fixes. Preserve the distinction between scheduled billing month and actual payment date, and between sample data and the saved workspace.

Do not add provider credentials, automatic analytics, remote fonts, tracking pixels or billing API calls. New integrations require a separate privacy and permissions design. Keep generated builds, user backups and browser test data out of commits.

`npm run render:assets` creates the screenshot and animation from fictional demo data after a build and browser tests. These media are documentation assets, not required by the app.
