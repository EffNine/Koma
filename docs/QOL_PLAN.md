# Koma QoL Implementation Plan

Date: 2026-07-02

This plan turns the QoL wishlist into implementation slices that can be built and verified independently. The goal is to make Koma feel smarter during everyday reading without changing the core architecture: AniList remains the catalog, Sources provide chapters/pages, and local Dexie state remains the app's source of truth for preferences and progress.

## Goals

- Prefer the user's chosen scanlation group consistently across chapters, sessions, and title pages.
- Reduce duplicate chapter noise when multiple groups upload the same chapter number.
- Make reader failures recoverable without making the user back out of the reader.
- Give followed titles a useful "what changed since I last read?" surface.
- Keep all changes testable with the current lightweight TypeScript self-check pattern.

## Non-Goals

- No new external catalog provider.
- No extension/plugin system for Sources.
- No background daemon or server-side account.
- No full rewrite of reader routing, tracker sync, or the scraper.
- No automatic downloading from sites that block access; failure states should be clear and recoverable, not hidden.

## Recommended Build Order

1. Persistent preferred group per title.
2. Deduplicated chapter rows on Media.
3. Reader group/source switcher and retry failed pages.
4. Per-title reader settings.
5. Unread updates view.
6. Larger follow-ups: offline cache, backup/export/import, double-page mode.

The first three are the highest leverage because they directly address same-chapter/group friction and image failure recovery.

## Current Status - 2026-07-05 Handoff

Most QoL phases in this plan have been implemented:

- Preferred group per title is persisted through `src/lib/media/titlePreferences.ts`.
- Duplicate chapter rows are grouped through `src/lib/media/chapterGroups.ts`.
- Reader recovery controls include failed-page retry, same-number group alternatives, fallback handling, and clearer failure categories.
- Per-title reader direction/image-fit settings are saved and applied with the correct precedence.
- Continue Reading and followed updates are derived through `src/lib/media/continueReading.ts`.
- Backup/export/import, cache controls, reader defaults, tracker controls, and source settings are now split into Settings subcomponents.
- Double-page spread mode is implemented and covered by `tests/spread.test.ts`.

Recent cleanup work also extracted:

- Search UI components under `src/lib/components/search/`.
- Search route parsing into `src/lib/search/searchRouteState.ts`.
- Reader chrome UI into `src/lib/components/reader/ReaderChrome.svelte`.

The remaining QoL work is mostly polish and decomposition, not core behavior.

## Phase 1 - Persistent Preferred Group Per Title

### User Story

When a user starts reading from Asura, Koma remembers Asura for that title. Next/previous chapter navigation uses Asura when available, temporarily falls back to another group for missing chapters, then returns to Asura when it has the chapter again.

### Current State

- `src/lib/reader/chapterNavigation.ts` already chooses adjacent chapters by chapter number and preferred group.
- `src/routes/Reader.svelte` currently remembers the preferred group in component state only.
- `ScrapedChapter.group` exists for ComicK chapters and group-aware sources.

### Data Model

Add a Dexie table, probably in `src/lib/db.ts` version 8:

```ts
titlePreferences: 'mediaId, updatedAt, preferredGroup'
```

Suggested type:

```ts
export interface TitlePreference {
  mediaId: number;
  preferredGroup?: string;
  readerDirection?: ReaderDirection;
  imageFit?: ImageFit;
  updatedAt: number;
}
```

This can later absorb per-title reader settings, so avoid creating separate tiny tables.

### Implementation

- Create `src/lib/media/titlePreferences.ts`.
- Add:
  - `getTitlePreference(mediaId)`
  - `savePreferredGroup(mediaId, group)`
  - `clearPreferredGroup(mediaId)`
  - later: `saveTitleReaderSettings(mediaId, settings)`
- In `Media.svelte`, when `readChapter(c)` is called and `c.group` exists, save it as the preferred group for that title.
- In `Reader.svelte`, load the title preference before computing `prevChapter` and `nextChapter`.
- When a user manually opens a chapter from a different group, update the preferred group to that group.
- If a chapter has no group, keep the existing preference unchanged.

### UI

- Media page chapter header: show `Preferred group: Asura` when known.
- Chapter row action: a small pin button or "Prefer group" action beside group names.
- Reader meta: show group next to source, for example `ComicK - Asura`.

### Tests

- Add `tests/title-preferences.test.ts` for preference persistence.
- Extend `tests/reader.test.ts` to assert saved preferred group drives selection.
- Run:
  - `pnpm exec tsx tests/reader.test.ts`
  - `pnpm test`
  - `pnpm run typecheck`

### Estimate

Half day.

## Phase 2 - Deduplicated Chapter Rows

### User Story

The chapter table should show one row per chapter number, not one row per group upload. Same-number uploads are grouped together, and the preferred group is selected by default.

### Current State

- `Media.svelte` renders `visibleChapters` directly.
- `compareChapterDesc()` sorts by chapter number but does not group duplicates.
- Group metadata is already displayed.

### Data Shape

Add a pure helper:

```ts
export interface ChapterGroup {
  number: string | null;
  title: string;
  preferred: ScrapedChapter;
  alternatives: ScrapedChapter[];
}
```

Suggested file:

```text
src/lib/media/chapterGroups.ts
```

Selection rules:

1. Group by normalized chapter number.
2. If preferred group exists in that number, choose it.
3. Else choose the current source order's first chapter for that number.
4. Keep all other group uploads as alternatives.
5. Put unknown-number chapters in their own rows by URL.

### Implementation

- Create pure grouping helper.
- Replace `visibleChapters` with grouped rows in `Media.svelte`.
- Chapter row primary read action opens `row.preferred`.
- Add a compact group selector in each row when alternatives exist.
- Preserve read status by chapter number, not group URL.
- Keep "Uploaded" as the preferred chapter's upload time; optionally show count like `3 groups`.

### UI

- Row:
  - `Ch. 30`
  - `Asura` or dropdown showing `Asura +2`
  - upload time
  - read action
- If preferred group is missing for that chapter, mark the selected group subtly: `Flame (fallback)`.
- Add a group filter later if the table gets crowded.

### Tests

- Add `tests/chapter-groups.test.ts`.
- Cases:
  - duplicate chapter numbers collapse into one row
  - preferred group wins
  - fallback group is selected when preferred missing
  - unknown-number chapters remain distinct

### Estimate

Half day to 1 day, depending on UI polish.

## Phase 3 - Reader Recovery Controls

### User Story

If images fail, the reader should help the user recover: retry failed pages, switch group for the same chapter, or open the source image/chapter link.

### Current State

- `chapterLoader.ts` returns `failedPages`.
- `Reader.svelte` shows a warning for failed page numbers.
- `getChapters()` is available in Reader for the current series.
- `selectAdjacentChapter()` already handles preferred group navigation, but same-number alternatives are not surfaced in the reader UI.

### Implementation

#### Retry Failed Pages

- Add `retryFailedPages()` in `Reader.svelte`.
- Re-fetch only failed page URLs.
- Revoke any replaced blob URL before overwriting.
- Keep page index stable.
- Add button in warning box: `Retry failed pages`.

#### Same Chapter Group Switcher

- Derive `sameNumberChapters` from `chapters` and current chapter number.
- Show a small dropdown/select in reader meta when more than one group exists for the current chapter.
- On selection:
  - save selected group as preferred group
  - navigate to same chapter number for that group
  - preserve page if possible, clamped to new page count after load

#### Better Failure Copy

Surface the first useful failure category:

- proxy unavailable
- source returned no image URLs
- CDN image fetch timed out
- HTTP status from source/proxy if available

Do not expose long stack traces in the UI.

### Tests

- Unit test pure same-number selection helper if extracted.
- Existing `chapterLoader` can stay integration-tested through reader checks unless we add a fetch mock.
- Manual verification:
  - force one page URL invalid in a fixture/harness
  - retry failed page succeeds after restoring URL

### Estimate

1 day.

## Phase 4 - Per-Title Reader Settings

### User Story

Some titles need different reader behavior. A manhwa should stay vertical, a manga can use RTL, and a particular title can keep a different image fit without changing the global default.

### Current State

- Global defaults live in `src/lib/reader/settings.ts`.
- Per-chapter state stores direction and page in `readerState`.
- Phase 1's `TitlePreference` table can store title-level direction and image fit.

### Implementation

- Extend `TitlePreference` with `readerDirection` and `imageFit`.
- Reader load order:
  1. saved per-chapter state
  2. per-title reader settings
  3. global reader settings
  4. country-derived default
- Add "Save for this title" affordance near direction/image fit controls.
- Keep global Settings page behavior unchanged.

### Tests

- Add tests for precedence logic as a pure function:
  - chapter state wins
  - title preference wins over global
  - country default is final fallback

### Estimate

Half day.

## Phase 5 - Unread Updates View

### User Story

The Library should show followed titles with available chapters beyond the user's current progress.

### Current State

- Followed titles live in `trackedTitles`.
- Progress lives in `progress`, keyed by media and source.
- Sources can resolve chapters for a title, but this can be network-heavy.
- Home already has latest/trending feeds, but not personalized unread updates.

### Data Model

Add a cache table or reuse `catalog` with typed keys. A dedicated table is clearer:

```ts
titleChapterSnapshots: 'key, mediaId, sourceId, checkedAt'
```

Suggested type:

```ts
export interface TitleChapterSnapshot {
  key: string;
  mediaId: number;
  sourceId: string;
  seriesUrl: string;
  chapters: Array<{
    url: string;
    number: string | null;
    title: string | null;
    group?: string;
    createdAt?: string;
  }>;
  checkedAt: number;
}
```

### Implementation

- Add `src/lib/media/chapterSnapshots.ts`.
- Add `refreshFollowedTitleChapters(title)`:
  - use enabled source order
  - use preferred group where available
  - cache result with timestamp
  - avoid refreshing all followed titles at once on startup
- Library route:
  - Add `Updates` tab before Followed/History.
  - Show rows where latest chapter number is greater than local progress.
  - Show `Refresh` per title and `Refresh visible`.
- Do not auto-hit every source on every app launch.

### UI

- `Updates` list:
  - cover thumbnail
  - title
  - current progress
  - latest available chapter
  - preferred/fallback group
  - `Continue` button
  - `Refresh` button
- Staleness label: `checked 2h ago`.

### Tests

- Pure test for "snapshot + progress -> unread update".
- Pure test for dedupe/latest chapter choice by preferred group.
- Manual verification with two followed titles.

### Estimate

1 to 3 days.

## Phase 6 - Backup, Export, And Import

### User Story

The user can move Koma state to another install or recover after clearing browser/app data.

### Scope

Export/import:

- sources
- title preferences
- followed titles
- chapter reads
- progress
- reader settings
- tracker connection metadata, but not secrets/tokens by default

### Implementation

- Add `src/lib/backup/export.ts`.
- Add versioned JSON format:

```ts
{
  version: 1,
  exportedAt: number,
  sources: Source[],
  titlePreferences: TitlePreference[],
  trackedTitles: TrackedTitle[],
  chapterReads: ChapterRead[],
  progress: ProgressEntry[],
  readerSettings: ReaderSettings[]
}
```

- Settings -> Cache/Data section:
  - `Export data`
  - `Import data`
  - import preview before applying
- On import, merge by primary key and keep newest `updatedAt` where available.

### Tests

- Export JSON contains expected tables.
- Import is idempotent.
- Newer local row is not overwritten by older import row.

### Estimate

1 day.

## Phase 7 - Offline Chapter Cache

### User Story

The user can download a chapter, or the next few chapters, for reliable reading.

### Risks

- Image-heavy IndexedDB usage can grow quickly.
- Source/CDN policies may block repeated downloads.
- Cache eviction needs to be explicit and visible.

### Implementation Sketch

- Store image blobs by `chapterUrl + pageIndex`.
- Add cache metadata table:

```ts
chapterCache: 'key, mediaId, sourceId, chapterUrl, createdAt, sizeBytes'
chapterCachePages: 'key, chapterKey, pageIndex'
```

- Reader load order:
  1. cached page blob
  2. network fetch
  3. failed state
- Settings cache page shows total size and per-title clear.

### Estimate

2 to 3 days.

## Phase 8 - Double-Page Mode

### User Story

On desktop/tablet, manga readers can read two pages side by side, respecting RTL/LTR order.

### Implementation Sketch

- Add `readerSpreadMode: 'single' | 'double'`.
- Only apply in paged modes.
- Pair pages according to direction:
  - RTL displays page N on the right and N+1 on the left.
  - LTR displays page N on the left and N+1 on the right.
- Keep single-page mode on narrow screens.

### Tests

- Pure pairing helper tests for RTL/LTR.
- Visual/manual check on desktop width and mobile width.

### Estimate

1 to 2 days.

## Verification Matrix

Every phase should pass:

```bash
pnpm run typecheck
pnpm test
pnpm build
```

When a phase touches Tauri or packaged behavior:

```bash
pnpm tauri build
```

Manual checks to repeat after reader-related phases:

- Open a title with multiple scanlation groups.
- Start from a preferred group.
- Navigate across a missing chapter range.
- Confirm fallback group is used.
- Confirm navigation returns to preferred group when available.
- Trigger an image failure and retry.
- Switch same chapter to another group.

## Suggested Milestones

### Milestone A - Group-Smart Reading

Includes:

- Phase 1 persistent preferred group.
- Phase 2 deduplicated chapter rows.
- Phase 3 same-chapter group switcher.

Expected result: chapter lists stop feeling duplicated, reader navigation feels intentional, and fallback behavior matches user expectation.

### Milestone B - Reader Comfort

Includes:

- Retry failed pages.
- Per-title reader settings.
- Better failure messages.
- Optional double-page mode if desktop reading is a priority.

Expected result: fewer hard stops while reading and fewer repeated setting changes.

### Milestone C - Library Intelligence

Includes:

- Unread updates.
- Refresh chapter snapshots.
- Backup/export/import.

Expected result: Koma becomes a daily library manager, not just a reader.

## Open Questions

- Should preferred group be global by group name, per title, or both? Recommendation: per title first.
- Should choosing a fallback chapter change the preferred group? Recommendation: no, unless the user explicitly selects/pins that group.
- Should Media auto-refresh chapter snapshots on every visit? Recommendation: yes for the current title only, with cached results displayed immediately.
- Should production PWA support require a configured proxy before showing source features? Recommendation: show source features, but make proxy-missing failures explicit.
- Should tracker sync use deduplicated chapter numbers only? Recommendation: yes; tracker progress should remain chapter-number based, not group-upload based.

## First Implementation Ticket

Build Phase 1:

1. Add `titlePreferences` Dexie table and type.
2. Add `src/lib/media/titlePreferences.ts`.
3. Load preference in `Reader.svelte`.
4. Save group when opening a chapter from `Media.svelte`.
5. Keep fallback navigation behavior from `chapterNavigation.ts`.
6. Add tests for persistence and navigation with saved preference.
7. Run typecheck, tests, and build.

This is the smallest vertical slice that makes the existing group-aware navigation survive route changes and app restarts.
