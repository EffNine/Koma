# Koma — Build Stages (E2E with per-stage verification)

Each stage is a vertical slice: implement → verify → commit. Verification is a runnable check (build/typecheck/self-check/playwright) that fails loudly if the stage broke. Subagents are used for parallelizable work within a stage; an agentic loop re-runs fixes until the stage's checks pass before moving on.

Ponytail (full) governs every stage: stdlib/native first, fewest files, no speculative abstraction. Every non-trivial module leaves one runnable self-check.

---

## Stage 0 — Scaffold & dark shell
**Build:** Tauri 2 + Vite + Svelte 5 (runes) SPA. Single `koma` package. `src/` (app), `src-tauri/` (Rust core), `proxy/` (PWA scraping proxy, stubbed). Deps: `dexie`, `@tauri-apps/api`, `@tauri-apps/cli`. A tiny hash router (no router lib). A global dark theme via plain CSS variables — humanly designed (real spacing scale, one accent, no generic "AI" gradient).
**Verify:**
- `pnpm tauri dev` launches a window showing the Home placeholder (dark).
- `pnpm build` exits 0; `pnpm typecheck` exits 0.
- Screenshot via Playwright shows the dark shell.
**Loop:** fix until all three pass.

## Stage 1 — Catalog (COMICK API)
**Build:** `src/lib/catalog/comick.ts` — `search(q)`, `trending()`, `latest()`, `top()`, `comic(hid)`, `chapters(hid, lang)`. Types: `Title`, `Chapter`. Catalog cache in Dexie (`catalog` table, TTL by mtime). Routes: Home (trending/latest/top carousels + grid), Search modal, Title detail (cover, synopsis, tags, chapter list by lang/scanlator). All wired to COMICK; dark, card-based, COMICK-like.
**Verify:**
- Dev: Home loads trending from `api.comick.fun`; Search returns titles; Detail shows chapter list.
- `comick.ts` self-check (`pnpm test:catalog` or `node --test` on a fixtures-based extractor): given saved JSON fixtures, mapping to `Title`/`Chapter` is correct.
- Playwright: Home renders ≥1 title card; search "one piece" returns results.
**Loop:** fix until app + self-check pass.

## Stage 2 — Scraper engine
**Build:** `src/lib/scraper/` — `fetchRaw.ts` (Tauri command on desktop, proxy fetch on web), `presets.ts` (Madara/MangaStream selector templates), `fingerprint.ts` (detect CMS from HTML), `engine.ts` (chapter list + page image extraction), `sources.ts` (Dexie `sources` table; add-by-URL; import `sources.json`). `src-tauri/src/fetch.rs` — reqwest GET with spoofed `User-Agent` + `Referer`, returns bytes; one `fetch_raw` command. Title→Source matching by slug/title fuzzy match (ponytail: simple normalized-string contains, upgrade to Levenshtein if needed).
**Verify:**
- `engine.ts` self-check on saved HTML fixtures (a Madara chapter-list page + a chapter page) → extracted chapter URLs + image URLs match expected set.
- Dev (desktop, no proxy): add a real Madara site by URL → chapter list resolves → page image URLs extracted. (Manual confirm of one site from the user's later PRD list; for now validate against fixtures + one public Madara demo site if reachable.)
- `pnpm typecheck` + `pnpm build` green.
**Loop:** fix until self-check passes and one real chapter lists in-app.

## Stage 3 — Reader
**Build:** `src/lib/reader/MangaReader.svelte` — one component, modes: paged (RTL/LTR) + vertical-webtoon scroll. Direction from Title country/lang (D13) with in-reader override. Pages rendered from blob URLs (fetched via `fetchRaw` with Source Referer). Preload next chapter. Persist last page + mode in Dexie.
**Verify:**
- Dev: open a chapter → pages render → next-chapter preload fires (network tab shows N+1 fetch) → RTL/vertical/LTR toggle works.
- Reader self-check: direction-derivation function `deriveDirection(country)` returns expected for jp/kr/cn/`null`.
- Playwright: reader renders ≥1 `<img>` from blob; vertical-scroll mode present.
**Loop:** fix until reader renders a real chapter end-to-end.

## Stage 4 — Built-in tracker (local)
**Build:** Dexie schema finalized (`titles`, `chapters`, `progress`, `history`, `sources`, `catalog`, `cache`). `src/lib/tracker/local.ts` — follow/unfollow, mark read/unread, last-read chapter, reading history, last-read page. Library route (Followed + History tabs). Progress keyed on COMICK chapter `hid`.
**Verify:**
- Dev: follow a title → appears in Library; read chapter 5 → reload → still on chapter 5; mark chapter 3 unread → progress back to 2.
- Local-tracker self-check: progress transitions (read 5 → progress=5; mark 3 unread → progress=2; advance past last → COMPLETED).
- `pnpm typecheck` + `pnpm build` green.
**Loop:** fix until persistence survives reload + self-check passes.

## Stage 5 — Tracker sync (AniList → MAL → MangaUpdates)
**Build:** `src/lib/tracker/{anilist,mal,mangaupdates}.ts` adapters + `sync.ts` (local-first: push on chapter transition; manual pull). OAuth2 for AniList/MAL (PKCE/implicit in a Tauri webview window). MangaUpdates via unofficial API. Settings → Trackers: connect/disconnect per tracker, per-tracker enable toggle. Progress mapped COMICK `hid` → integer chapter per tracker.
**Verify:**
- Dev: connect AniList (real OAuth) → read a chapter → progress pushed (verify in AniList list); "Pull" imports AniList progress into local. (MAL + MangaUpdates verified the same way; if a tracker's OAuth is blocked in this env, fall back to adapter self-check with a mocked token + mark manual-verify as the gate.)
- `sync.ts` self-check: mapping COMICK `hid`/`chap` → AniList integer progress (floor) is correct; "advance past last chapter" sets COMPLETED.
- Playwright: Settings → Trackers shows connected state after auth.
**Loop:** fix until AniList round-trips; MAL + MangaUpdates pass adapter self-check at minimum.

## Stage 6 — Settings, Sources UI, polish
**Build:** Settings routes: Trackers, Sources (list + add-by-URL + import JSON + enable toggle + drag priority), Reader (defaults + dir override), Cache (clear per-series/global + size readout). Drag-to-reorder sources. Visual polish pass: spacing, type scale, focus rings, empty states, loading skeletons, error toasts — all dark, humanly designed.
**Verify:**
- Dev: add source by URL; reorder sources; clear cache frees IDB; dir override persists.
- Lighthouse (PWA build): accessibility ≥90, no console errors.
- Visual: Playwright screenshots of Home/Search/Detail/Reader/Library/Settings — review for "humanly designed" (no generic AI look).
**Loop:** fix until all settings work + visual review passes.

## Stage 7 — PWA + Desktop builds + publish
**Build:** PWA manifest + service worker (vite-plugin-pwa), installable; `proxy/` implemented as a minimal Cloudflare-Worker/Deno script (dumb Referer-forwarding fetcher) for browser scraping. Tauri builds for mac (universal), windows, linux. GitHub Actions release workflow (tag-triggered, mirrors Hayase-lite's `v*` flow).
**Verify:**
- `pnpm build` (web) installable as PWA (manifest + SW registered; offline shell loads).
- `pnpm tauri build` produces a macOS `.app`/`.dmg` that launches.
- `proxy/` self-check: forward a request with spoofed Referer, returns bytes + correct Content-Type.
- Release workflow dry-run (workflow_dispatch or act) green.
- Smoke: fresh install → COMICK home → search → open title → read a scraped chapter → progress syncs to AniList.
**Loop:** fix until PWA installs, desktop builds, and the end-to-end smoke passes. Then tag `v0.1.0`.

---

## Agentic loop (cross-stage)
After each stage's checks pass, commit (`feat(stageN): …`). If a check fails, the same turn re-runs fixes (subagent or inline) until green or a user-blocking error surfaces. Stages run sequentially (each unblocks the next); within a stage, independent modules (e.g., the three tracker adapters in Stage 5, presets+fingerprint+engine in Stage 2) are built by parallel subagents.

## Subagent policy
- Parallel subagents only for genuinely independent files (no shared import they'd both edit).
- One subagent per independent module; results merged by the main loop.
- Verification always run by the main loop, not the subagent, to avoid self-grading.