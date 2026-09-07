# Verification environment

Node.js 22.23.1, TypeScript transpiler 5.6.3, esbuild 0.27.2.
42 built-in Node unit tests passed (see unit-tests.tap).
74 TS/TSX source modules parsed and transpiled; local imports/exports resolved with npm packages external.
Six additional schema assertions were checked using the preinstalled Zod 3.25.76: upper-only salary, reversed range, invalid calendar date, unsafe photo URL, Telegram normalization, preserved login redirect.

No network package installation was available. npm, Next.js, Supabase packages and PostgreSQL executable were unavailable in the build environment.
An attempt to launch Playwright for the standalone START-HERE guide could not proceed because no Chromium executable was installed. No browser checks passed or are claimed.
The guide is a local checklist, not a deployment dashboard. Its checkmarks do not prove external setup.

Full TypeScript semantic check, next build, database migrations, integration/E2E, SMTP, Telegram ingestion, Web Push and deployed payment HTTP flow require the user's test environment.
