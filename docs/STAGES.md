# Koma — Build Stages (E2E with per-stage verification)

Each stage is a vertical slice: implement -> verify -> commit. Verification is a runnable check (build/typecheck/self-check/playwright) that fails loudly if the stage broke. Subagents are used for parallelizable work within a stage; an agentic loop re-runs fixes until the stage's checks pass before moving on.

Ponytail (full) governs every stage: stdlib/native first, fewest files, no speculative abstraction. Every non-trivial module leaves one runnable self-check.

## Current snapshot (2026-06-29)

- Overall status: Stage 1 is committed and healthy. Stage 2 is active WIP with green self-check/build/typecheck, the desktop Rust fetch path compiling cleanly, Media pages able to resolve a Source into scraped chapters and page URLs, and Source support now widened beyond Madara/MangaReader: `mangadex.org` is API-backed, `asurascans.com` is now HTML-scrapable end to end, and `mangafire.to` now has a recognized preset plus direct series/chapter extraction support with known search/reader caveats. Stage 3 is active WIP too: the first real reader route exists, it can fetch chapter images into blob URLs, supports RTL/LTR/vertical modes with persistence, is reachable directly from the Media chapter list, and now hands local page/history updates to the built-in tracker. Stage 4 local tracking is implemented and verified: Media can follow titles, reading a chapter records local progress/history, Library has Followed and History tabs, and the local tracker self-check covers progress advance/rollback/completion. Stage 5 tracker sync is now implemented and verified: AniList/MAL OAuth adapters, MangaUpdates username/password adapter, a local-first `sync.ts` orchestrator that auto-pushes on chapter reads, and a real Trackers section in Settings. Stages 6-7 remain not started.
- Branch state: `main` with 2 commits:
  - `1107c78` — `stage0: scaffold Tauri 2 + Svelte 5 SPA, dark shell, hash router`
  - `a0fc795` — `stage1: AniList catalog (pivot from Cloudflare-walled COMICK) + Home/Search/Media routes + fetch_raw Rust cmd + ADRs`
- Working tree state during this snapshot:
  - Modified: `docs/STAGES.md`, `package.json`, `pnpm-lock.yaml`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`, `src/App.svelte`, `src/lib/catalog/types.ts`, `src/lib/components/TitleCard.svelte`, `src/lib/db.ts`, `src/lib/net.ts`, `src/lib/scraper/presets.ts`, `src/lib/scraper/sources.ts`, `src/lib/tracker/local.ts`, `src/routes/Home.svelte`, `src/routes/Library.svelte`, `src/routes/Media.svelte`, `src/routes/Search.svelte`, `src/routes/Settings.svelte`
  - Untracked WIP: `proxy/`, `src/lib/reader/`, `src/lib/scraper/`, `src/lib/tracker/adapters/`, `src/lib/tracker/oauth.ts`, `src/lib/tracker/sync.ts`, `src/routes/Reader.svelte`, `tests/`
- Verification run for this snapshot:
  - `pnpm build` — passed
  - `pnpm typecheck` — passed with 0 warnings
  - `pnpm test` — passed (`tests/scraper.test.ts`, `tests/reader.test.ts`, `tests/sources.test.ts`, `tests/tracker.test.ts`, `tests/tracker-sync.test.ts`)
  - `cargo check` in `src-tauri/` — passed
  - Browser smoke: `pnpm dev -- --host 127.0.0.1` then Playwright snapshot of `http://localhost:5173/#/library` — passed
- Important architecture note: this document originally described a COMICK-backed Stage 1. That is no longer current. ADR 0002 accepted the pivot to AniList as the catalog backbone, and the stage notes below now reflect that decision.

---

## Stage 0 — Scaffold & dark shell
**Build:** Tauri 2 + Vite + Svelte 5 (runes) SPA. Single `koma` package. `src/` (app), `src-tauri/` (Rust core), `proxy/` (PWA scraping proxy, stubbed). Deps: `dexie`, `@tauri-apps/api`, `@tauri-apps/cli`. A tiny hash router (no router lib). A global dark theme via plain CSS variables — humanly designed (real spacing scale, one accent, no generic "AI" gradient).
**Verify:**
- `pnpm tauri dev` launches a window showing the Home placeholder (dark).
- `pnpm build` exits 0; `pnpm typecheck` exits 0.
- Screenshot via Playwright shows the dark shell.
**Loop:** fix until all three pass.

**Progress (2026-06-28):**
- Status: complete and committed.
- Evidence:
  - Commit `1107c78` is the Stage 0 scaffold commit.
  - Repo structure exists as planned: `src/`, `src-tauri/`, `index.html`, `vite.config.ts`, `svelte.config.js`, `package.json`.
  - The app shell, router, and dark theme are present and used by current routes.
- Verified in this snapshot:
  - `pnpm build` passes.
  - `pnpm typecheck` passes.
- Not re-verified in this snapshot:
  - `pnpm tauri dev` manual window check.
  - Playwright screenshot gate.
- Remaining follow-up:
  - None required for Stage 0 itself. Any later shell/layout cleanup belongs to later stages.

## Stage 1 — Catalog (AniList GraphQL)
**Build:** `src/lib/catalog/anilist.ts` — `search(q)`, `browse(country, sort)`, `media(id)`. Types live in `src/lib/catalog/types.ts`. Catalog cache in Dexie (`catalog` table, TTL-based). Routes: Home (browse by country + sort), Search, Media detail (cover, synopsis, tags, metadata). The visual direction stays COMICK-inspired, but the data source is AniList per ADR 0002.
**Verify:**
- Dev: Home loads browse results from AniList; Search returns titles; Media detail loads a title record.
- Catalog cache works without using the scraping fetch path.
- Playwright: Home renders at least one title card; search "one piece" returns results.
- `pnpm typecheck` + `pnpm build` green.
- ADR 0002 records the catalog pivot and the identity-model change.
- There is no catalog chapter-list verification because AniList does not provide chapters; chapter lists belong to Stage 2 Sources.
- `src/lib/catalog/anilist.ts` has no standalone self-check yet; current confidence comes from app integration plus build/typecheck.
**Loop:** fix until app + self-check pass.

**Progress (2026-06-28):**
- Status: complete and committed, with one documentation/testing caveat.
- Evidence:
  - Commit `a0fc795` is the Stage 1 commit.
  - `src/lib/catalog/anilist.ts` and `src/lib/catalog/types.ts` exist and are wired into Home/Search/Media routes.
  - ADR 0002 is accepted and matches the codebase.
- Verified in this snapshot:
  - `pnpm build` passes with the catalog routes included.
  - `pnpm typecheck` passes with warnings only.
- Known caveats:
  - The original plan expected a catalog self-check; that does not exist yet for AniList.
  - Media now has Source-resolution UI, but reading and follow/tracking are still later-stage work.
- Remaining follow-up:
  - Optional: add a small AniList mapper self-check if the project wants strict parity with the "every non-trivial module leaves one runnable self-check" rule.

## Stage 2 — Scraper engine
**Build:** `src/lib/scraper/` — `engine.ts` (chapter/page extraction), `presets.ts` (theme presets + named site presets), `fingerprint.ts` (detect CMS from HTML), `scraper.ts` (networked scraper calls + special adapters like MangaDex), `sources.ts` (Dexie `sources` table; add-by-URL; import `sources.json`). `src/lib/net.ts` exposes the shared `fetchRaw` path: desktop uses the Tauri `fetch_raw` command, browser/PWA uses a small proxy. `src-tauri/src/fetch.rs` provides reqwest GET with spoofed `User-Agent` + `Referer`, returning bytes for TS-side parsing. Title->Source matching is a simple normalized contains check via `matchSeries(...)`.
**Verify:**
- `engine.ts` self-check on saved HTML fixtures (a Madara chapter-list page + a chapter page) -> extracted chapter URLs + image URLs match expected set.
- Dev (desktop, no proxy): add a real Madara site by URL -> chapter list resolves -> page image URLs extracted. (Manual confirm of one site from the user's later PRD list; for now validate against fixtures + one public Madara demo site if reachable.)
- `pnpm typecheck` + `pnpm build` green.
**Loop:** fix until self-check passes and one real chapter lists in-app.

**Progress (2026-06-28):**
- Status: in progress, healthy WIP.
- Implemented so far:
  - `src/lib/net.ts` routes fetches through Tauri on desktop and through `proxy/dev.mjs` on web/PWA dev.
  - `src/lib/scraper/presets.ts` now defines:
    - `madara`
    - `mangareader`
    - `mangadex` (API-backed adapter preset)
    - `asura`
    - `mangafire`
  - `src/lib/scraper/fingerprint.ts` detects the CMS from HTML markers.
  - `src/lib/scraper/engine.ts` extracts search results, chapters, pages, and does naive title matching.
  - `src/lib/scraper/scraper.ts` now has two scrape modes:
    - selector-driven HTML scraping for theme/site presets
    - a MangaDex adapter that searches titles via the official API, fetches chapter feeds, and resolves image URLs through the at-home server endpoint
  - `src/lib/scraper/sources.ts` persists Sources in Dexie and supports add-by-URL, import, remove, toggle, source health checks, re-checking saved sources, hostname-based preset fallback for known sites, and friendly English source names for recognized hosts.
  - On first run, `src/lib/scraper/sources.ts` now auto-seeds the three built-in supported sources into Dexie:
    - `https://mangadex.org/`
    - `https://asurascans.com/`
    - `https://mangafire.to/`
    This removes the confusing "0 saved sources" empty state for a fresh app install while still allowing the user to remove them later without the app force-recreating them on every launch.
  - `src/lib/db.ts` now upgrades the `sources` table to include an `addedAt` index, fixing the regression where sources were saved successfully but the app could not list them back out because `listSources()` ordered by a non-indexed field.
  - `src/lib/scraper/engine.ts` now returns `null` when a title query does not genuinely match any scraped result, including non-empty native-script aliases that normalize down to an empty ASCII key. This avoids false-positive chapter matches like resolving an unrelated homepage card as if it were the requested series.
  - `src/routes/Media.svelte` now clears previous match/chapter/page state when the media item or selected source changes, so old chapter results do not leak into a newly opened title view.
  - `src/routes/Settings.svelte` exposes a live Sources UI with add/import/toggle/remove, visible save/check messages, explicit "Saved to app" feedback, per-source saved timestamps, and working-state badges.
  - `src/routes/Media.svelte` can now resolve the current AniList title against an enabled Source, list scraped chapters in-app, and inspect extracted page image URLs for a chosen chapter.
  - `src/lib/catalog/types.ts` now exposes title aliases so Source resolution can try romaji/english/native names in order.
  - `tests/scraper.test.ts` and HTML fixtures cover Madara extraction behavior.
  - `tests/scraper.test.ts` now also covers selector behavior for Asura and MangaFire snippets.
- Verified in this snapshot:
  - `pnpm test` passes:
    - search extraction
    - chapter extraction and ordering
    - page image extraction
    - chapter-number parsing
    - title matching
  - `pnpm build` passes.
  - `pnpm typecheck` passes with 0 warnings.
  - `cargo check` in `src-tauri/` passes, so the Rust fetch path currently compiles cleanly.
  - Real-site probe against `https://madarascans.org/`:
    - search extraction works with the new `mangareader` preset
    - chapter extraction works and returned 60 chapters for a known series page
    - page-image extraction on a locked chapter page returned 0 images, so chapter-page support for this site is not proven end to end yet
  - Real-site probe against `https://asurascans.com/`:
    - `/browse?search=...` is SSR enough for selector scraping
    - series pages expose chapter links in HTML
    - chapter pages expose image URLs in SSR HTML / serialized props
  - Real-site probe against `https://mangadex.org/`:
    - homepage may return an "Unsupported Browser" HTML gate
    - the official API responds when the client sends browser-like headers
    - chapter pages may still legitimately resolve to no images for external-only MangaDex entries
  - Real-site probe against `https://mangafire.to/`:
    - home and series pages are SSR enough for preset detection and chapter extraction
    - direct filter/search requests still return `403 Request is invalid` to scraper-like requests
    - chapter image extraction is not yet proven from the raw HTML path
- Not yet verified:
  - Real end-to-end desktop scrape against a live supported site from the app UI.
- What changed in this pass:
  - The app now has the missing "title -> Source -> chapters -> page URLs" bridge on the Media route, which closes the biggest in-app gap in Stage 2.
  - Adding a Source by URL now performs a visible site check, saves the detected working state, and highlights the just-saved row in Settings instead of leaving the save action easy to miss.
  - Known hosts now save into the app with recognizable English names (`MangaDex`, `Asura Scans`, `MangaFire`) instead of raw hostnames.
  - A fresh app session now seeds the three supported built-in sources automatically, so Settings immediately shows saved/ready sources instead of an empty list.
  - After a schema upgrade, existing saved sources now render correctly in Settings and become available to Media chapter resolution again.
  - The Media chapter finder is now more honest: unsupported/no-match searches report "No series match found" instead of silently attaching the first scraped series result from a source homepage.
- Remaining work to declare Stage 2 complete:
  - Prove one live desktop scrape end to end, including actual page-image extraction from an accessible chapter.
  - Decide whether MangaFire needs a stronger title-search path before being considered fully complete, or whether current preset detection + direct series/chapter extraction is enough for this stage.
  - Decide whether the current chapter/page inspection UI is sufficient for Stage 2, or whether a dedicated source-match chooser belongs here before moving on to the Reader.

## Stage 3 — Reader
**Build:** `src/lib/reader/MangaReader.svelte` — one component, modes: paged (RTL/LTR) + vertical-webtoon scroll. Direction from Title country/lang (D13) with in-reader override. Pages rendered from blob URLs (fetched via `fetchRaw` with Source Referer). Preload next chapter. Persist last page + mode in Dexie.
**Verify:**
- Dev: open a chapter -> pages render -> next-chapter preload fires (network tab shows N+1 fetch) -> RTL/vertical/LTR toggle works.
- Reader self-check: direction-derivation function `deriveDirection(country)` returns expected for jp/kr/cn/`null`.
- Playwright: reader renders >=1 `<img>` from blob; vertical-scroll mode present.
**Loop:** fix until reader renders a real chapter end-to-end.

**Progress (2026-06-28):**
- Status: started, healthy WIP.
- Implemented so far:
  - `src/lib/reader/state.ts` now defines the Stage 3 direction model:
    - `KR -> vertical`
    - `CN -> ltr`
    - `JP/default -> rtl`
  - Reader state is persisted per `(mediaId, sourceId, chapterUrl)` in Dexie via the new `readerState` table.
  - `src/routes/Reader.svelte` now exists as the first real reading surface:
    - loads the AniList title and saved Source
    - extracts chapter page URLs through the existing Stage 2 scraper flow
    - fetches each image via `fetchRaw`/`fetchBytes` with the chapter `Referer`
    - converts bytes into blob URLs for in-app rendering
    - supports paged RTL, paged LTR, and vertical scroll from one route
    - restores the last saved page + direction for the current chapter
    - updates saved progress as the user flips pages or scrolls
    - avoids a Svelte effect self-subscription loop by untracking the route-triggered chapter load/reset path, fixing the `effect_update_depth_exceeded` crash that could previously fire while clearing old reader state before a new chapter load
  - `src/routes/Media.svelte` chapter rows now expose a `Read` action that opens the new reader route directly.
  - `tests/reader.test.ts` adds the missing runnable self-check for direction derivation.
- Verified in this snapshot:
  - `pnpm test` passes, including the new reader self-check.
  - `pnpm typecheck` passes with 0 warnings.
  - `pnpm build` passes with the reader route included.
- Not yet verified:
  - Real chapter rendering through the full UI against a live accessible chapter from the running app.
  - Next-chapter preloading.
  - Tracker handoff from chapter completion into Stage 4 local progress.
- Remaining work to declare Stage 3 complete:
  - Prove one live chapter end to end in the app, not only at build/test level.
  - Add next-chapter discovery/preload.
  - Decide whether to keep the current single-image paged view or add a denser page rail/gesture layer before freezing the reader UX.

## Stage 4 — Built-in tracker (local)
**Build:** Dexie schema finalized (`titles`, `chapters`, `progress`, `history`, `sources`, `catalog`, `cache`). `src/lib/tracker/local.ts` — follow/unfollow, mark read/unread, last-read chapter, reading history, last-read page. Library route (Followed + History tabs). Progress keyed on AniList media `id` plus the Source-reported chapter number, per ADR 0002 and `CONTEXT.md`.
**Verify:**
- Dev: follow a title -> appears in Library; read chapter 5 -> reload -> still on chapter 5; mark chapter 3 unread -> progress back to 2.
- Local-tracker self-check: progress transitions (read 5 -> progress=5; mark 3 unread -> progress=2; advance past last -> COMPLETED).
- `pnpm typecheck` + `pnpm build` green.
**Loop:** fix until persistence survives reload + self-check passes.

**Progress (2026-06-29):**
- Status: complete.
- Implemented:
  - `src/lib/db.ts` now has Stage 4 Dexie tables for `trackedTitles`, `chapterReads`, `progress`, and `history`.
  - `src/lib/tracker/local.ts` implements follow/unfollow, followed-state lookup, progress recording, reading history, and unread rollback.
  - `src/routes/Media.svelte` now has a working Follow/Following button, records local chapter progress before opening Reader, and exposes chapter-level Mark Unread rollback.
  - `src/routes/Reader.svelte` records debounced page/history updates while the user reads.
  - `src/routes/Library.svelte` is now a real Library surface with Followed and History tabs.
  - `tests/tracker.test.ts` covers the local tracker gate: follow/unfollow, read chapter 5 -> progress 5, mark chapter 3 unread -> progress 2, advance past total -> COMPLETED, and newest-first history.
- Verified:
  - `pnpm test` passes, including `tests/tracker.test.ts`.
  - `pnpm typecheck` passes with 0 warnings.
  - `pnpm build` passes.
  - Browser smoke of `#/library` passes via Playwright snapshot against the Vite dev server.
- Remaining follow-up:
  - The Stage 5 tracker-sync adapters still need to be built on top of this local tracker.

## Stage 5 — Tracker sync (AniList -> MAL -> MangaUpdates)
**Build:** `src/lib/tracker/{anilist,mal,mangaupdates}.ts` adapters + `sync.ts` (local-first: push on chapter transition; manual pull). OAuth2 for AniList/MAL (PKCE/implicit in a Tauri webview window). MangaUpdates via unofficial API. Settings -> Trackers: connect/disconnect per tracker, per-tracker enable toggle. Progress mapped from AniList media `id` plus local chapter progress to the integer chapter counts each tracker expects.
**Verify:**
- Dev: connect AniList (real OAuth) -> read a chapter -> progress pushed (verify in AniList list); "Pull" imports AniList progress into local. (MAL + MangaUpdates verified the same way; if a tracker's OAuth is blocked in this env, fall back to adapter self-check with a mocked token + mark manual-verify as the gate.)
- `sync.ts` self-check: mapping local progress -> AniList/MAL integer progress (floor) is correct; "advance past last chapter" sets COMPLETED.
- Playwright: Settings -> Trackers shows connected state after auth.
**Loop:** fix until AniList round-trips; MAL + MangaUpdates pass adapter self-check at minimum.

**Progress (2026-06-29):**
- Status: implemented and verified (code + self-checks).
- Evidence:
  - `src/lib/tracker/adapters/{base,anilist,mal,mangaupdates}.ts` implement a uniform adapter interface with push/pull per tracker.
  - `src/lib/tracker/oauth.ts` provides PKCE helpers and a Tauri webview OAuth flow via `@fabianlars/tauri-plugin-oauth`.
  - `src/lib/tracker/sync.ts` orchestrates push/pull and auto-pushes on local chapter transitions via a hook in `src/lib/tracker/local.ts`.
  - `src/routes/Settings.svelte` now has a real Trackers section with per-tracker connect/disconnect/enable controls and adapter-specific credential inputs.
  - Dexie schema bumped to v6 with a `trackerConnections` table.
  - Tauri side loads `tauri_plugin_oauth` and the web build passes.
- Verified:
  - `pnpm typecheck` 0 errors.
  - `pnpm build` exits 0.
  - `pnpm test` passes including `tests/tracker-sync.test.ts`.
  - `cargo check` in `src-tauri/` passes.
- Remaining work:
  - Real live OAuth round-trip with AniList/MAL and MangaUpdates login are manual-verify gates (requires registered app credentials and a running Tauri desktop build).
  - Browser/PWA OAuth support belongs to Stage 7.

## Stage 6 — Settings, Sources UI, polish
**Build:** Settings routes: Trackers, Sources (list + add-by-URL + import JSON + enable toggle + drag priority), Reader (defaults + dir override), Cache (clear per-series/global + size readout). Drag-to-reorder sources. Visual polish pass: spacing, type scale, focus rings, empty states, loading skeletons, error toasts — all dark, humanly designed.
**Verify:**
- Dev: add source by URL; reorder sources; clear cache frees IDB; dir override persists.
- Lighthouse (PWA build): accessibility >=90, no console errors.
- Visual: Playwright screenshots of Home/Search/Detail/Reader/Library/Settings — review for "humanly designed" (no generic AI look).
**Loop:** fix until all settings work + visual review passes.

**Progress (2026-06-28):**
- Status: partially started early, but Stage 6 is not complete.
- Evidence:
  - `src/routes/Settings.svelte` already has a functional Sources section with add/import/toggle/remove, automatic source checking, saved-state feedback, and re-check controls.
  - Trackers, Reader, and Cache are still placeholders.
- What this means:
  - Some Stage 6 UI work has been pulled forward because it unblocks Stage 2 Sources work.
  - That does not make Stage 6 complete; it only means the Sources sub-area is in progress ahead of schedule.
- Remaining work:
  - Add source priority ordering.
  - Add reader defaults and overrides.
  - Add cache controls and size reporting.
  - Do the full polish and visual verification pass.

## Stage 7 — PWA + Desktop builds + publish
**Build:** PWA manifest + service worker (vite-plugin-pwa), installable; `proxy/` implemented as a minimal Cloudflare-Worker/Deno script (dumb Referer-forwarding fetcher) for browser scraping. Tauri builds for mac (universal), windows, linux. GitHub Actions release workflow (tag-triggered, mirrors Hayase-lite's `v*` flow).
**Verify:**
- `pnpm build` (web) installable as PWA (manifest + SW registered; offline shell loads).
- `pnpm tauri build` produces a macOS `.app`/`.dmg` that launches.
- `proxy/` self-check: forward a request with spoofed Referer, returns bytes + correct Content-Type.
- Release workflow dry-run (workflow_dispatch or act) green.
- Smoke: fresh install -> Home -> search -> open title -> read a scraped chapter -> progress syncs to AniList.
**Loop:** fix until PWA installs, desktop builds, and the end-to-end smoke passes. Then tag `v0.1.0`.

**Progress (2026-06-28):**
- Status: not started, except for one dev-only building block.
- Evidence:
  - `proxy/dev.mjs` exists as a local development proxy for browser-mode scraping.
  - No manifest/service worker/release workflow work is present yet.
- Remaining work:
  - Replace the dev proxy with the intended production worker story.
  - Add installable PWA support.
  - Verify `pnpm tauri build` outputs and release automation.

---

## Agentic loop (cross-stage)
After each stage's checks pass, commit (`feat(stageN): ...`). If a check fails, the same turn re-runs fixes (subagent or inline) until green or a user-blocking error surfaces. Stages run sequentially (each unblocks the next); within a stage, independent modules (e.g., the three tracker adapters in Stage 5, presets+fingerprint+engine in Stage 2) are built by parallel subagents.

## Subagent policy
- Parallel subagents only for genuinely independent files (no shared import they'd both edit).
- One subagent per independent module; results merged by the main loop.
- Verification always run by the main loop, not the subagent, to avoid self-grading.
