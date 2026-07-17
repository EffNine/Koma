# AGENTS.md

## Cursor Cloud specific instructions

Koma is a single product (a local-first manga/comic reader + tracker) with two shells: a browser **PWA** and a **Tauri 2 desktop** app. It is a `pnpm` package. Standard commands live in `package.json` scripts and `README.md`; prefer those over duplicating here.

### Services / how to run

- **Dev server (browser/PWA):** `pnpm dev` serves the Svelte SPA on **http://localhost:5174** (port is `strictPort`, hard-coded in `vite.config.ts`). This is the primary development target for cloud agents — GUI testing happens here in Chrome. The Vite dev server embeds the scrape proxy at `/__koma_scrape`, so no separate proxy process is needed for `pnpm dev`.
- **Desktop (Tauri):** `pnpm tauri dev` requires system webview libraries (webkit2gtk/GTK) that are NOT installed by the update script and are heavy to provision on a headless VM. Prefer the browser PWA for development/testing unless a change is specifically desktop/Rust-only.
- **Standalone proxy:** `node proxy/dev.mjs` (default port 8788) is only needed for the production PWA build or `tests/source-health.ts`; not needed for `pnpm dev`.

### External dependencies (network required at runtime)

- Catalog search/browse hits **AniList GraphQL** (`https://graphql.anilist.co`) directly from the browser. Chapter reading scrapes external manga sites (e.g. ComicK). These require outbound internet; if search returns nothing or chapters fail to resolve, suspect network/egress before app bugs.
- All reading state (follows, progress, history) is stored **locally in IndexedDB** — there is no backend/database service and no login/account.

### Lint / test / build

- **Lint gate is `pnpm typecheck`** (`svelte-check`) — there is no ESLint/Prettier. Warnings are allowed; the gate only fails on errors.
- **Tests:** `pnpm test` runs the full `tsx` suite sequentially. `bash scripts/run-tests.sh` runs the same set with per-file timeouts and clearer pass/fail reporting. Unit tests need no running services (they use `fake-indexeddb` + `linkedom` fixtures). Note `tests/pwa.test.ts` does a full `vite build` and is the slowest test.
- **Build:** `pnpm build` (Vite → `dist/`). `pnpm preview` serves the built output.
