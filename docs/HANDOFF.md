 # Koma Handoff

Date: 2026-07-05

This document is the current handoff for the next agent. It summarizes the app state after the recent review and cleanup slices. For older roadmap context, see:

- [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md)
- [QOL_PLAN.md](./QOL_PLAN.md)
- [COMICK_DESKTOP_FIX.md](./COMICK_DESKTOP_FIX.md)
- [STAGES.md](./STAGES.md)
- [adr/0005-source-feed-boundary.md](./adr/0005-source-feed-boundary.md)

## Current Goal

Keep reducing complexity without changing user-facing behavior. The app is already functional; the current work is making the codebase easier for future agents to safely improve.

## Completed In This Cleanup Pass

### Codebase Polish

**Unused imports removed (3):**
- `formatDateTime` from `src/routes/Activity.svelte`
- `go` from `src/routes/Library.svelte`
- `ReadingList` from `src/lib/components/library/LibraryTitleCard.svelte`

**`as any` type assertions fixed (2):**
- `src/routes/Library.svelte` — both `resolveChapters()` calls now use a properly typed partial `Title` object instead of `as any`.

**Empty catch blocks documented (4):**
- `src/routes/Media.svelte` — `loadReadingList`, `loadProgress`, `loadReadChapters` now have comments explaining why failures are silently handled.
- `src/routes/Activity.svelte` — title name fetch catch block documented.

**Redundant `as Element` casts removed (4):**
- `src/lib/scraper/engine.ts` — `pickLink()`, `extractSeriesLinks()`, `extractChapters()`, `extractPages()` no longer use unnecessary `as Element` casts since `querySelectorAll` already yields `Element`.

**Missing EOF newlines fixed (4):**
- `src/main.ts`, `src/vite-env.d.ts`, `src/lib/scraper/fingerprint.ts`, `src/lib/router.ts`

### Phase 2 — Premium Reader Experience

**Zoom In/Out Controls:**
- Added `zoom` field (50–200 range) to `ReaderSettings` in `src/lib/reader/settings.ts`.
- Added zoom range slider to `ReaderChrome.svelte` toolbar with percentage label.
- Added `setZoom()` function in `Reader.svelte` that persists to Dexie.
- Added keyboard shortcuts: `+`/`=` to zoom in, `-` to zoom out, `0` to reset.
- Applied zoom via CSS `transform: scale()` using `--reader-zoom` custom property on all page images.
- Updated shortcuts panel with zoom and fullscreen entries.

**Better Loading Feedback:**
- Added `pulse` animation to page placeholders in all three view components (paged, spread, vertical) — subtle opacity pulse at 1.8s interval makes loading feel alive.
- Added `transition: opacity .25s ease, filter .2s ease` to page images for smooth appearance when blobs load.

**Mobile Tap Zone Improvements:**
- Larger nav buttons (52px min-height, 14px font) on screens ≤560px for both paged and spread views.

**Brightness/Contrast Filters:**
- Added `brightness` and `contrast` fields (50–150 range) to `ReaderSettings`.
- Range sliders in `ReaderChrome.svelte` toolbar with persistence to Dexie.
- CSS filter applied via CSS custom properties on all page images.

**Pan Support for Original-Size Mode:**
- `.pan-mode` CSS class removes constraints and sets `cursor: grab`/`grabbing` when `imageFit === 'original'`.

**Fullscreen Toggle:**
- Fullscreen toggle button in toolbar, `F11` keyboard shortcut, state syncs with browser UI.

### Phase 3 — Home Experience

**Quick Entry Points:**
- Added quick-links section below Continue Reading with pill-shaped buttons for Search, Library, Categories, Genres, Activity, and Settings.

### Phase 4 — Library Personalization

**New Chapter Indicators:**
- Added `newChapters` prop to `LibraryTitleCard.svelte` — shows a green `+N` badge when a title has unread chapters.
- Added `newChapterCount` field to `UnreadUpdate` interface in `chapterSnapshots.ts`.
- `computeUnreadUpdates` now counts how many new chapters exist since the user's progress.
- `Library.svelte` computes `newChaptersByMedia` from updates and passes it to each `LibraryTitleCard`.

### Phase 5 — Polish and Empty States

**New Empty States:**
- Added `reader-loading`, `tracker`, and `backup` empty state IDs to `src/lib/ui/emptyState.ts` with appropriate titles, bodies, and action links.

**Visual Polish:**
- Added `transition: opacity .25s ease` to page images in all reader views for smooth loading appearance.
- Added `pulse` animation to page placeholders.

### Component-Level Tests

- Added `tests/reader-settings.test.ts` — 14 tests covering reader settings persistence: defaults, save/reload, overwrite, and backward compatibility with partial saves (missing brightness/contrast).
- Test suite now has 30 test files (up from 29).

### Reader: Brightness/Contrast Filters (Phase 2)

- Added `brightness` and `contrast` fields to `ReaderSettings` in `src/lib/reader/settings.ts` (range 50–150, defaults 100).
- Added brightness/contrast range sliders to `ReaderChrome.svelte` toolbar.
- Added `setBrightness()` and `setContrast()` functions in `Reader.svelte` that persist to Dexie.
- Applied CSS `filter` via CSS custom properties (`--reader-brightness`, `--reader-contrast`) on the reader shell, inherited by page images in all three view components (paged, spread, vertical).
- Settings are restored on chapter load with proper precedence.

### Reader: Pan Support for Original-Size Mode (Phase 2)

- Added `.pan-mode` CSS class to `ReaderPagedView.svelte` that removes `max-width`/`max-height` constraints and sets `cursor: grab`/`grabbing` when `imageFit === 'original'`.
- Added `imageFit` prop to `ReaderPagedView` to enable the pan mode class.
- Vertical view already had `strip-original` with auto width; added grab cursor.

### Reader: Mobile Tap Zone Improvements (Phase 2)

- Added `@media (max-width: 560px)` breakpoint to `ReaderPagedView.svelte` and `ReaderSpreadView.svelte` with larger nav buttons (52px min-height, 14px font-size) for easier tapping on mobile.

### Home: Quick Entry Points (Phase 3)

- Added a quick-links section below Continue Reading on the home page with buttons for Search, Library, Categories, Genres, Activity, and Settings.
- Each button has an icon and label, styled as pill-shaped chips with hover effects.

### Fullscreen Toggle (Phase 2 Reader Improvement)

- Added fullscreen toggle button to `ReaderChrome.svelte` toolbar (⛶/⊟ icon).
- Added `F11` keyboard shortcut to toggle fullscreen.
- Added `toggleFullscreen()` and `isFullscreen` state tracking in `Reader.svelte`.
- Fullscreen state syncs with browser UI (Esc key exits tracked via `fullscreenchange` event).

### Media Section Extraction

- Added `src/lib/components/media/MediaHeader.svelte` — Title detail header with cover, metadata, genres, description, and action buttons (Continue Reading/Start Over/Follow/AniList).
- Added `src/lib/components/media/MediaPreferences.svelte` — Reading list, source, and group preference controls with source status line.
- Added `src/lib/components/media/MediaChapterTable.svelte` — Chapter table with header, grouped rows, pagination, goto-chapter form, and loading/error/empty states.
- Added `src/lib/components/media/MediaChapterRow.svelte` — Individual chapter row with chapter link, upload time, group selector (with alternatives), and read/unread actions.

`Media.svelte` reduced from 572 to 371 lines. The header, preferences, and chapter table are now isolated components.

### Library Section Extraction

- Added `src/lib/components/library/LibraryTabBar.svelte` — Tab navigation (updates/all/reading/plan/completed/history).
- Added `src/lib/components/library/LibraryTitleCard.svelte` — Individual library title card with cover, progress, list badge, and actions.
- Added `src/lib/components/library/LibraryHistoryList.svelte` — History list with source/media actions.
- Added `src/lib/components/library/LibraryUpdatesList.svelte` — Unread updates list with refresh per title.

`Library.svelte` reduced from 344 to 254 lines. Tab bar, title cards, history list, and updates list are now isolated components.

### Home Section Extraction

- Added `src/lib/components/home/HomeContinueSection.svelte` — Continue Reading hero card + secondary grid with empty/welcome state.
- Added `src/lib/components/home/HomeFollowedUpdates.svelte` — Followed titles grid section.
- Added `src/lib/components/home/HomeComickSection.svelte` — Reusable ComicK-style section with loading/error/data/fallback states and `grid`/`strip` layout variants.
- Added `src/lib/components/home/HomeComickCard.svelte` — Individual grid card for ComicK items.
- Added `src/lib/components/home/HomeComickStripCard.svelte` — Individual horizontal-scroll strip card for ComicK items.

`Home.svelte` reduced from 439 to 210 lines. The 4 near-identical section patterns (Latest Updates, Trending, Popular Ongoing, Top New) now reuse `HomeComickSection` with different props.

### Reader Render State Extraction

- Added `src/lib/components/reader/ReaderLoadingState.svelte` — loading title/subtitle + page progress bar.
- Added `src/lib/components/reader/ReaderErrorState.svelte` — error card with EmptyState + Retry/Fallback/Back actions.
- Added `src/lib/components/reader/ReaderWarningBox.svelte` — warning banner with retry-failed-pages button + group hint.

### Reader Page View Extraction

- Added `src/lib/components/reader/ReaderPagedView.svelte` — single-page paged mode with prev/next nav buttons.
- Added `src/lib/components/reader/ReaderSpreadView.svelte` — double-page spread mode with paired page rendering.
- Added `src/lib/components/reader/ReaderVerticalView.svelte` — vertical webtoon scroll mode with intersection observer anchors.
- Added `src/lib/components/reader/ReaderChapterEndNav.svelte` — end-of-chapter navigation with prev/next/back actions.
- Added `src/lib/components/reader/ReaderResumeNotice.svelte` — fixed-position "Resumed from page N" notice.

`Reader.svelte` reduced from 826 to 720 lines. All page rendering markup and scoped CSS moved to the new components.

### Browse/Search Opening

- Added `src/lib/media/openTitleCandidate.ts`.
- Search and ComicK/source-feed cards now resolve a source-feed title to the AniList media route instead of looping back into Search.
- Added `tests/open-title-candidate.test.ts`.

### Media Source Resolution

- Added `src/lib/media/titleChapterSource.ts`.
- `Media.svelte` now uses a tested resolver for preferred/healthy/fallback source selection.
- Added `tests/title-chapter-source.test.ts`.

### Reader Session Resolution

- Added `src/lib/reader/chapterSession.ts`.
- `Reader.svelte` delegates source/title/chapter/session resolution to this helper.
- Added `tests/reader-chapter-session.test.ts`.

### Settings Split

- Split `Settings.svelte` into focused components under `src/lib/components/settings/`.
- Settings state and handlers remain in the route; UI sections are now separate components.

### Source Feed Boundary

- Added `src/lib/sourceFeeds/types.ts`.
- Added `src/lib/sourceFeeds/comick.ts`.
- Kept `src/lib/scraper/comickBrowse.ts` as a compatibility shim.
- Added `src/lib/components/SourceFeedCard.svelte`.
- Search and Genres now depend on `comickSourceFeed`, not direct `CKTitle`/`searchCK` names.
- Added `tests/source-feed.test.ts`.

### Search Split

- Split Search UI into:
  - `src/lib/components/search/SearchFilters.svelte`
  - `src/lib/components/search/SearchResults.svelte`
  - `src/lib/components/search/SearchSortTabs.svelte`
- Added `src/lib/search/searchRouteState.ts` for testable search URL parsing/building.
- Added `tests/search-route-state.test.ts`.

### Reader Chrome Split

- Added `src/lib/components/reader/ReaderChrome.svelte`.
- `Reader.svelte` now keeps loading, persistence, and page rendering while the chrome/header/toolbar/shortcut UI is isolated.

## Verification Already Run

Latest verified commands:

```sh
pnpm run typecheck
pnpm test
```

Both passed (2026-07-05). Typecheck: 0 errors, 0 warnings (threshold=error). Tests: all 30 test files pass (new: `tests/reader-settings.test.ts`).

Browser smoke checks were also run against Vite on `127.0.0.1:5177` for:

- Search page, sort tabs, genre modal, Genres route handoff.
- Search URL hydration and submit URL building.
- Settings route after the split.
- Reader controls toggle and shortcuts panel after the reader chrome extraction.

Temporary Vite servers were stopped after the checks.

## Route Size Progress

| Route | Before | After | Δ |
|---|---|---|---|
| `Reader.svelte` | 826 | 720 | -106 |
| `Home.svelte` | 439 | 210 | -229 |
| `Library.svelte` | 344 | 254 | -90 |
| `Media.svelte` | 572 | 371 | -201 |
| `Settings.svelte` | 483 | 483 | 0 (already split) |
| `Search.svelte` | 195 | 195 | 0 (already split) |
| `Activity.svelte` | 116 | 116 | — |
| `Categories.svelte` | 45 | 45 | — |
| `Genres.svelte` | 34 | 34 | — |
| **Total** | **3054** | **2428** | **-626** |

## Current Working Tree Notes

The worktree is intentionally dirty with multiple completed but uncommitted slices. Do not reset or revert these files unless the user explicitly asks.

Expected modified/untracked areas include:

- `package.json`
- `src/routes/Home.svelte`
- `src/routes/Search.svelte`
- `src/routes/Media.svelte`
- `src/routes/Reader.svelte`
- `src/routes/Settings.svelte`
- `src/routes/Categories.svelte`
- `src/routes/Genres.svelte`
- `src/lib/components/`
- `src/lib/components/home/`
- `src/lib/components/reader/`
- `src/lib/components/media/`
- `src/lib/components/library/`
- `src/lib/media/`
- `src/lib/reader/`
- `src/lib/search/`
- `src/lib/sourceFeeds/`
- `src/lib/scraper/comickBrowse.ts`
- new tests listed above

Some route changes predated the latest cleanup pass. Treat all uncommitted changes as user/work-in-progress state.

## Recommended Next Slice

All four improvement phases are now implemented. The app has:

- **Phase 1** (Reliable Reading): Source health, retry/recovery, fallback, failure categorization ✅
- **Phase 2** (Premium Reader): Fullscreen, brightness/contrast, zoom, pan, mobile tap zones, loading feedback ✅
- **Phase 3** (Home Experience): Continue Reading, followed updates, quick entry points, ComicK sections ✅
- **Phase 4** (Library): Tab navigation, title cards with new chapter badges, history, updates ✅
- **Phase 5** (Polish): Empty states, transitions, visual consistency ✅

Future work could focus on:

1. **Offline chapter cache** — Download chapters for offline reading (the cache infrastructure exists in `chapterCache.ts`).
2. **Desktop Tauri features** — Native window controls, tray, notifications for followed updates.
3. **Source-agnostic chapter resolution** — Currently relies on ComicK for browse/search; adding more source feeds would reduce dependency.
4. **Performance** — Virtual scrolling for long chapter lists, image preloading strategies.

## Suggested Skills

- `handoff` when preparing another continuation handoff.
- `diagnose` if reader/search behavior regresses.
- `playwright` for UI smoke checks after route/component changes.
- `improve-codebase-architecture` if continuing the cleanup roadmap.

## Watchouts

- `Reader.svelte` still has sensitive side effects: route sync, abort controllers, persistence debounce, blob URL revocation, and intersection observer state.
- Search route syncing previously hit a Svelte `effect_update_depth_exceeded` loop. Keep URL-driven state application inside `untrack`.
- `comickBrowse.ts` is now a compatibility shim. Prefer new imports from `src/lib/sourceFeeds/comick.ts`.
- Keep source reliability orchestration outside scraper drivers. Drivers should fetch/parse; ranking, fallback, and health belong in media/reader orchestration.
- `Home.svelte` now delegates all section rendering to components under `src/lib/components/home/`. The route keeps data loading, `goToMedia`, `chapterLabel`, and `resumeUrl` helpers. If a section needs new behavior, add props to the component rather than inlining markup back into the route.
- `Library.svelte` now delegates tab bar, title cards, history, and updates to components under `src/lib/components/library/`. The route keeps data loading, filtering, and helper functions (`titleFor`, `listBadge`, `filterTitlesForTab`).
- `Media.svelte` now delegates header, preferences, and chapter table to components under `src/lib/components/media/`. The route keeps data loading, chapter resolution, follow/preference handlers, and pagination state. The `MediaChapterTable` component receives `onBindGotoChapter` instead of `bind:value` since Svelte 5 runes don't support two-way binding across component boundaries.
