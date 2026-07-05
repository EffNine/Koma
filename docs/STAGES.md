# Koma — Build Stages (E2E with per-stage verification)

Each stage is a vertical slice: implement -> verify -> commit. Verification is a runnable check (build/typecheck/self-check/playwright) that fails loudly if the stage broke. Subagents are used for parallelizable work within a stage; an agentic loop re-runs fixes until the stage's checks pass before moving on.

Ponytail (full) governs every stage: stdlib/native first, fewest files, no speculative abstraction. Every non-trivial module leaves one runnable self-check.

## Current snapshot (2026-07-05 handoff)

- Overall status: the app has moved beyond the original staged build plan into cleanup and reliability-hardening.
- Latest verified commands:
  - `pnpm run typecheck` - passed with 0 errors and 0 warnings.
  - `pnpm test` - passed.
- Recent cleanup:
  - Search, Settings, and Reader chrome were split into focused components.
  - Search route parsing/building is now tested in `src/lib/search/searchRouteState.ts`.
  - ComicK browse/search is now a provider-neutral source feed through `src/lib/sourceFeeds/`.
  - `src/lib/scraper/comickBrowse.ts` remains as a compatibility shim.
  - Reader chapter session resolution is in `src/lib/reader/chapterSession.ts`.
  - Media title/source resolution is in `src/lib/media/titleChapterSource.ts`.
- Browser smoke checks were run for Search, Genres, Settings, and Reader chrome after the extractions.
- Recommended next stage of cleanup: extract reader loading/error/warning render states from `Reader.svelte`.

---

## Previous snapshot (2026-07-03)

- Overall status: Stages 0–6 are complete. Stage 7 (PWA + Desktop builds + publish) is the only remaining stage. Multiple post-Stage-7 additions have been built.
- **Recent additions (2026-07-02 → 2026-07-03):**
  - **MangaPill** added as a third built-in source — fully static HTML manga reader site (no JS rendering). Uses the HTML driver with the `mangapill` preset. Search at `/search?q=...`, chapters in `#chapters` grid, page images in `<img class="js-page" data-src="...">` from `cdn.readdetectiveconan.com`. Verified: 50 search results, 1,202 chapters, 17 page images per chapter.
  - **Comick Source API default** changed from `mangaloom` (broken chapters) to `atsumoe` (401 chapters working).
  - **3 new CMS presets** added: `mangastream` (custom PHP theme), `genkan` (React-based CMS), `wpmanga` (WordPress manga theme). Total presets: 11.
  - **Cloudflare bypass** (desktop only) — opens a native webview to pass Cloudflare JS challenges, extracts cookies (including httpOnly `cf_clearance`) via reqwest follow-up request, stores them in a global `CookieStore` for all subsequent `fetch_raw` calls. UI in Settings → Cloudflare Unlock. Implemented in `src-tauri/src/cloudflare.rs`.
  - **Source health check** — `tests/source-health.ts` tests all presets against real sites via the dev proxy. 22 tests covering ComicK, Comick Source API, MangaPill, Madara sites, MangaStream, Genkan, and fingerprint detection.
  - **Seed migration** — existing users get MangaPill added automatically on next launch (checks if `mangapill.com` exists, adds if missing).
- **Built-in sources:** ComicK, MangaPill, Comick Source API (50+ sources via atsumoe). MangaDex, Asura Scans, and MangaFire were removed (Cloudflare walls).
- **Branch state:** `main` with 2 commits:
  - `1107c78` — `stage0: scaffold Tauri 2 + Svelte 5 SPA, dark shell, hash router`
  - `a0fc795` — `stage1: AniList catalog (pivot from Cloudflare-walled COMICK) + Home/Search/Media routes + fetch_raw Rust cmd + ADRs`
- **Verification:**
  - `pnpm build` — passed
  - `pnpm typecheck` — 0 errors
  - `pnpm test` — all 165+ tests pass
  - `cargo check` in `src-tauri/` — passed
  - `cargo build` in `src-tauri/` — passed (full binary links)
  - `tests/source-health.ts` — 22/22 passed

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
  - On first run, `src/lib/scraper/sources.ts` now auto-seeds the built-in supported sources into Dexie:
    - `https://mangadex.org/`
    - `https://asurascans.com/`
    - `https://mangafire.to/`
    - `https://comickz.co.uk/`
    - `https://comick-source-api.notaspider.dev/`
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

**Progress (2026-06-29):**
- Status: complete.
- Evidence:
  - `src/routes/Settings.svelte` now has all four sections live: Sources (add/import/toggle/remove/reorder/re-check), Trackers (connect/disconnect/enable per tracker), Reader (default direction override persisted in Dexie), and Cache (size readout + clear button).
  - `src/lib/reader/settings.ts` provides the ReaderSettings type and load/save persistence in the new `readerSettings` Dexie table.
  - `src/lib/scraper/sources.ts` now has a `priority` field on Source, `updateSourcePriority()`, and `listSources()` sorts by priority. `addByUrl()` and `importSources()` assign sequential priority. The Sources list in Settings has up/down reorder buttons.
  - `src/lib/db.ts` schema bumped to v7 with `priority` index on `sources` and the new `readerSettings` table.
  - `src/routes/Reader.svelte` now falls back to the saved default direction from settings when no per-chapter state exists.
  - Visual polish: all routes have empty states, loading skeletons, inline error messages, and consistent dark styling. Focus rings are in app.css. The `muted-card` placeholders for Reader and Cache are replaced with live sections.
- Verified:
  - `pnpm typecheck` — 0 errors, 0 warnings.
  - `pnpm build` — exits 0.
  - `pnpm test` — all 30 tests pass (scraper, reader, sources, tracker, tracker-sync).
  - `cargo check` in `src-tauri/` — passes.
- Remaining follow-up:
  - None for Stage 6. Stage 7 (PWA + Desktop builds + publish) is next.

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

## Post-Stage 7 additions (2026-07-02)

The following features were built after the original stage plan was completed. They are not part of any numbered stage but extend the app with ComicK-inspired UI and source integration.

### ComicK source driver
**Files:** `src/lib/scraper/comickDriver.ts`, `src/lib/scraper/presets.ts` (comick preset)
- New `comick` driver that scrapes ComicK's SSR HTML pages and REST API.
- **Search:** scrapes ComicK's `/search?q=...` page which embeds JSON with slug, title, ID, thumbnail, chapter count.
- **Chapters:** fetches ComicK's REST API at `/api/comics/{slug}/chapter-list?lang=en` — returns structured JSON with `chap`, `hid`, `lang`, `group_name`, `created_at`.
- **Pages:** extracts image URLs from embedded JSON on chapter pages (`chapter.images[].url`).
- ComicK is auto-seeded as a built-in source alongside MangaDex, Asura Scans, and MangaFire.
- `ScrapedChapter` now carries optional `group` and `createdAt` fields for richer display.

### Comick Source API driver
**Files:** `src/lib/scraper/comickApiDriver.ts`, `src/lib/scraper/presets.ts` (comick-api preset)
- A unified REST API (https://comick-source-api.notaspider.dev) that proxies 50+ manga sources.
- **Search:** `POST /api/search` — works with any upstream source (mangaloom, weebcentral, bato, etc.).
- **Chapters:** `POST /api/chapters` — returns structured chapter data with numbers, titles, and URLs.
- **Pages:** falls back to the HTML driver since the API is metadata-only.
- Uses native `fetch` (CORS-friendly) — no proxy or Tauri command needed.
- The `apiSourceId` config field lets users switch which upstream source to query.
- Auto-seeded as a built-in source with default upstream `mangaloom`.
- Open-source project by GooglyBlox (MIT): https://github.com/GooglyBlox/comick-source-api

### ComicK-inspired chapter list UI
**Files:** `src/routes/Media.svelte`
- Redesigned the chapter list as a clean grid table matching ComicK's layout:
  - **Chap** column — clickable chapter number, clicking reads the chapter
  - **Uploaded** column — relative time ("30m ago", "2d ago", "1mo ago") from ComicK's `created_at` field
  - **Group** column — scanlation group name (UTOON, Mangakakalot, etc.), clickable when mapped
  - **Actions** column — compact ▶ Read, ↩ Mark Unread buttons
- **Pagination** — "Showing chapters 1–60 of 214 — page 1/4" with Prev/Next buttons
- **Go to chap** — type a chapter number and jump directly to it (scrolls into view)
- **Read status badges** — already-read chapters show a ✓ badge and dimmed row
- **Responsive** — on mobile, collapses to 2-column layout hiding the group column
- Hover highlight on rows, no card borders (less clutter)

### Auto-resolve chapters (no source picker)
**Files:** `src/routes/Media.svelte`
- Chapters load **automatically** on page load — no source dropdown, no "Find Chapters" button.
- Tries each enabled source in priority order until one returns chapters.
- Removed the entire source-panel UI (source selector, match info, inspect-pages, status messages).
- Removed ~100 lines of state management for source selection.

### Start Reading / Continue Reading button
**Files:** `src/routes/Media.svelte`
- **First visit** — shows "Start Reading" and opens the first chapter (lowest number).
- **Returning reader** — shows "Continue Reading" and resumes from the last-read chapter via Dexie progress lookup.
- Only appears after chapters are resolved, so it's never a dead link.

### Scanlation group mapping
**Files:** `src/lib/scraper/groupMapping.ts`
- Community-maintained dataset (https://github.com/GooglyBlox/comick-group-mapping) mapping 761 scanlation group names to their actual websites.
- Loaded on demand in the Media page to turn group names into clickable links.
- 741 of 761 groups are mapped. Falls back to plain text for unmapped groups.
- 5-second timeout on fetch to avoid hanging on slow GitHub responses.

### Source cleanup (removed 3 old sources)
**Files:** `src/lib/scraper/seed.ts`, `src/lib/scraper/sources.ts`
- Removed MangaDex, Asura Scans, and MangaFire from built-in seed sources (Cloudflare walls, unreliable HTML scraping).
- Only ComicK and Comick Source API remain as built-in sources.
- Seed key bumped to `v2` so existing installs get the new source list.
- Old source entries are cleaned up from Dexie on next load.

### JSON parse error hardening
**Files:** `src/lib/catalog/anilist.ts`, `src/lib/scraper/comickApiDriver.ts`, `src/lib/scraper/groupMapping.ts`
- All `response.json()` calls now read as text first and validate the response starts with `{` or `[` before parsing.
- Prevents `SyntaxError: Unexpected token '<'` errors when APIs return HTML (rate limits, error pages, redirects).
- AniList error messages now include the response body snippet for debugging.

### Reader fallback for missing sources
**Files:** `src/routes/Reader.svelte`
- If the saved source no longer exists (e.g. old reader links with `mangadex.org`), the reader auto-resolves chapters from any enabled source.
- Matches by chapter number and updates the URL on the fly.
- `seriesUrl`/`chapterUrl` are now mutable state instead of read-only derived values.

### Categories route (original genre grid)
**Files:** `src/routes/Categories.svelte`, `src/lib/catalog/anilist.ts` (browseByGenre, GENRE_COLLECTION)
- Grid of 18 genre cards with emoji icons (Action ⚔️, Romance 💕, Fantasy 🧙, etc.)
- Click a genre to browse titles sorted by Trending/Popular/Latest
- Back button to return to genre grid
- Uses AniList's `genre` GraphQL filter

### Activity route
**Files:** `src/routes/Activity.svelte`
- Reading history timeline grouped by day
- Relative timestamps ("Just now", "5m ago", "2h ago")
- Each entry shows title name, chapter, page number, and link to open media page
- Empty state with guidance when no history exists

### Enhanced Home sections
**Files:** `src/routes/Home.svelte`
- **Trending Now** section — loads `TRENDING_DESC` from AniList
- **Popular New Comics** section — loads `POPULARITY_DESC` from AniList
- Original Browse section preserved below

### ComicK Latest Updates feed (2026-07-02)
**Files:** `src/lib/scraper/comickLatest.ts`, `src/routes/Home.svelte`
- New `comickLatest.ts` module scrapes ComicK's home page SSR JSON (`#sv-data`) to extract:
  - **Latest Updates** — recently added comics with chapter count (horizontal scroll strip)
  - **Popular Ongoing** — currently popular series
  - **Trending Now** — 7-day trending (ComicK-sourced)
  - **Top New** — new series gaining follows
- Home page now shows ComicK-sourced sections first, with AniList as fallback if ComicK is unreachable
- Cards link to search so you can find and read them
- ComicK-style horizontal scroll strips for Latest Updates and Popular Ongoing

### Reader polish (2026-07-02)
**Files:** `src/routes/Reader.svelte`
- **Keyboard shortcuts:**
  - `←`/`→` — page navigation (respects RTL direction)
  - `↑`/`↓` / `Space` — scroll in vertical mode
  - `F` — cycle image fit (width → screen → original)
  - `D` — cycle direction (RTL → vertical → LTR)
  - `G` — go to page prompt
- **Click-to-advance** — tap left/right third of the page to go prev/next (paged mode)
- **Next-chapter preloading** — fetches first 3 images of the next chapter to warm CDN caches
- **Chapter-end nav for paged mode** — now shows prev/next chapter buttons at the bottom of paged readers too
- **Shortcut hints** displayed in the toolbar

### ComicK-style UI polish (2026-07-02)
**Files:** `src/App.svelte`, `src/app.css`
- **Top search bar** — quick search input in the nav bar (ComicK-style), navigates to search on submit
- **Read status indicators** — chapter rows in Media show a ✓ badge and dimmed opacity for already-read chapters
- **ComicK-style horizontal scroll strips** — Latest Updates and Popular Ongoing use a horizontal scrollable strip like ComicK's home page

### ComicK-style filter page (2026-07-02)
**Files:** `src/routes/Categories.svelte`, `src/lib/catalog/anilist.ts` (browseFiltered)
- Replaced the simple genre grid with a full ComicK-style filter/browse page:
- **Filter panel** (collapsible, with active filter badge count):
  - **Origin** — All / Manga (JP) / Manhwa (KR) / Manhua (CN) — pill buttons
  - **Sort** — Trending / Popular / Latest — pill buttons
  - **Status** — All / Ongoing / Completed / Hiatus / Cancelled
  - **Year range** — From / To number inputs
  - **Min Chapters** — number input
  - **Genres** — ComicK-style: click to include (highlighted purple), right-click to exclude (red strikethrough). Shows ✓ and ✕ marks
  - **Apply Filters** button
- **Results** — shows result count, grid of TitleCards, or empty state
- **Backend** — new `browseFiltered()` function builds a dynamic AniList GraphQL query from filter state (genre include/exclude, country, status, year range, min chapters). Results cached in IndexedDB.

### Verification
- `pnpm typecheck` — 0 errors
- `pnpm build` — passes
- `pnpm test` — all 70+ tests pass (scraper, reader, sources, tracker, tracker-sync, progress, driver, pwa)
- New tests: ComicK preset/driver seam checks, ComicK search JSON extraction, ComicK chapter JSON extraction, Comick API driver seam checks

---

## Agentic loop (cross-stage)
After each stage's checks pass, commit (`feat(stageN): ...`). If a check fails, the same turn re-runs fixes (subagent or inline) until green or a user-blocking error surfaces. Stages run sequentially (each unblocks the next); within a stage, independent modules (e.g., the three tracker adapters in Stage 5, presets+fingerprint+engine in Stage 2) are built by parallel subagents.

## Subagent policy
- Parallel subagents only for genuinely independent files (no shared import they'd both edit).
- One subagent per independent module; results merged by the main loop.
- Verification always run by the main loop, not the subagent, to avoid self-grading.
