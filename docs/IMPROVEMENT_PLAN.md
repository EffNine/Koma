# Koma Improvement Plan

Date: 2026-07-04

This plan turns the current app review into a practical implementation roadmap. The goal is to make Koma feel like a dependable, premium reading app: fast to resume, forgiving when sources fail, comfortable for long sessions, and polished enough to use daily.

## Product Goal

Koma should feel better than browsing manga sites directly:

- chapters load reliably,
- the reader is fast, comfortable, and predictable,
- progress is remembered without fuss,
- the home and library views make continuation obvious,
- and failures are explained with useful recovery actions.

## Success Signals

Use these as lightweight product checks while shipping:

- A user can open a title, start a chapter, leave, and resume without confusion.
- A source failure does not produce a silent blank reader.
- The reader shows visible progress while pages load.
- The home screen answers "what should I read next?" within the first viewport.
- Library and history data survive reloads and app restarts.
- New reliability logic is covered by small deterministic tests.

## Guiding Principles

1. Reliability before polish.
   - If content cannot load, Koma should say what happened and offer a next step.
2. Keep scraper drivers simple.
   - Scrapers should fetch and parse. Ranking, retries, fallback, and recovery belong in orchestration layers.
3. Ship vertical slices.
   - Each phase should end in a user-visible improvement, not just infrastructure.
4. Local-first by default.
   - Reading state, preferences, health signals, and history should work without account sync.
5. Prefer concrete habit loops over vague personalization.
   - "Continue chapter 24" is more valuable than a speculative recommendation feed.

## Current Strengths

Koma already has a useful base:

- AniList catalog integration,
- source-based series/chapter/page resolution,
- multiple reader modes,
- local tracking and history,
- per-title reader preferences,
- chapter image cache,
- source checking,
- and PWA support.

The next improvements should build on those systems rather than replace them.

## Current Gaps

The largest product gaps are:

- source failures are not yet handled like first-class states,
- fallback behavior is limited and not visible enough,
- reader loading can still feel blank or uncertain,
- the home screen could do more to encourage continuation,
- library organization is useful but not yet personal enough.

## Roadmap Overview

1. Reliable reading foundation
2. Reader comfort and loading quality
3. Continue Reading and home experience
4. Library organization and personalization
5. Polish, empty states, and app-wide refinement

This order is deliberate. Trust comes first, then comfort, then retention.

---

## Phase 1 - Reliable Reading Foundation

### Objective

Make chapter loading recoverable, observable, and testable.

### Why This Matters

Readers forgive a missing chapter more easily than a confusing failure. The app should distinguish between "the source is down," "the chapter has no pages," "the image CDN failed," and "another source may work."

### Phase 1A - Source Health and Ranking

Build the reliability primitives first, without changing too much UI.

#### Planned Work

1. Add a source health model.
   - Track source ID.
   - Track last success and last failure timestamps.
   - Track success and failure counts.
   - Track chapter resolution failures separately from image load failures.
   - Store a short last error category for debugging and UI hints.

2. Add source health persistence.
   - Add a Dexie table, for example `sourceHealth`.
   - Keep schema additive and migration-safe.
   - Do not overload the existing `sources.status`; that status is about source configuration/reachability, not recent runtime health.

3. Add pure ranking helpers.
   - Prefer enabled sources.
   - Prefer the currently selected source when its recent health is acceptable.
   - Prefer sources with better recent success rates.
   - Use configured source priority as a tiebreaker.
   - Keep unknown/new sources viable so they are not permanently buried.

4. Add health recording calls.
   - Record success after chapters resolve.
   - Record success after pages are extracted.
   - Record failure when chapter resolution, page extraction, or image loading fails.

#### Likely Files

- [src/lib/db.ts](../src/lib/db.ts)
- [src/lib/media/chapterResolver.ts](../src/lib/media/chapterResolver.ts)
- [src/lib/reader/chapterLoader.ts](../src/lib/reader/chapterLoader.ts)
- `src/lib/scraper/sources.ts`
- new `src/lib/scraper/sourceHealth.ts` or `src/lib/media/sourceHealth.ts`
- new `tests/source-health.test.ts`

#### Acceptance Criteria

- Source health is persisted locally.
- Ranking logic is deterministic and covered by tests.
- A failing source is deprioritized without being permanently disabled.
- Existing source configuration behavior still works.

#### Verification

- Add tests for ranking with healthy, unhealthy, unknown, disabled, and manually prioritized sources.
- Add tests for health updates after success and failure.
- Run `npm test` and `npm run typecheck`.

### Phase 1B - Retry and Recovery States

Use the new health primitives to make failures understandable in the reader and media page.

#### Planned Work

1. Add controlled retry behavior.
   - Retry chapter/page resolution once for transient failures.
   - Retry image loading for failed pages without reloading the entire chapter.
   - Use short backoff only where it improves real recovery; avoid making the UI feel stuck.

2. Improve visible loading states.
   - Show "Resolving chapter..."
   - Show "Loading pages..."
   - Show "Retrying..."
   - Show "Trying another source..."
   - Show "Unable to load chapter" with actions.

3. Add recovery actions.
   - Retry chapter.
   - Retry failed pages.
   - Switch source.
   - Try another chapter group/version when available.
   - Open the source chapter link.

4. Add automatic fallback carefully.
   - First fall back when the requested source is missing or clearly fails.
   - Preserve the selected source when it works.
   - Show the user when Koma switched sources.
   - Save the new preferred source only after a successful read, not merely after a fallback attempt.

#### Likely Files

- [src/routes/Reader.svelte](../src/routes/Reader.svelte)
- [src/routes/Media.svelte](../src/routes/Media.svelte)
- [src/lib/media/chapterResolver.ts](../src/lib/media/chapterResolver.ts)
- [src/lib/reader/chapterLoader.ts](../src/lib/reader/chapterLoader.ts)
- [src/lib/media/titlePreferences.ts](../src/lib/media/titlePreferences.ts)

#### Acceptance Criteria

- A failed source never leaves a blank reader with no explanation.
- If another enabled source can resolve the same title/chapter, the user can continue reading.
- The UI shows whether Koma is retrying, switching sources, or giving up.
- Recovery actions are available from the failure state.

#### Verification

- Add tests for fallback source selection.
- Manually test with one disabled/missing/broken source and one working source.
- Manually test failed page retry inside an otherwise loaded chapter.

### Phase 1 Non-Goals

- Do not rewrite scraper drivers.
- Do not add cloud sync.
- Do not try to guarantee every source has every chapter.
- Do not auto-disable sources solely because of a few runtime failures.

---

## Phase 2 - Premium Reader Experience

### Objective

Make reading feel smooth, comfortable, and intentional on desktop and mobile.

### Planned Work

1. Improve loading feedback.
   - Show page placeholders while images load.
   - Show loaded page count and total page count.
   - Keep already loaded pages visible while failed pages retry.
   - Avoid sudden layout shifts as pages load.

2. Improve reading controls.
   - Keep fit-to-width, fit-to-screen, and original-size controls prominent.
   - Add zoom in/out only if it fits the current reader model cleanly.
   - Add pan support for oversized images if original-size reading is awkward.
   - Make controls easy to reach on mobile.

3. Improve navigation.
   - Add a chapter jump control.
   - Make previous/next chapter actions obvious.
   - Improve scroll-to-top and return-to-current-page behavior.
   - Make resume-from-last-page visually clear.

4. Improve reader memory.
   - Persist current chapter, source, page, direction, and image fit.
   - Keep per-title settings distinct from global defaults.
   - Show "You left off here" where it helps continuation.

5. Improve long-session comfort.
   - Add edge-to-edge reading mode.
   - Add brightness/contrast filters only if they perform well.
   - Keep tap zones predictable and documented through discoverable UI, not instructional clutter.

### Likely Files

- [src/routes/Reader.svelte](../src/routes/Reader.svelte)
- [src/lib/reader/settings.ts](../src/lib/reader/settings.ts)
- [src/lib/reader/state.ts](../src/lib/reader/state.ts)
- [src/lib/reader/spread.ts](../src/lib/reader/spread.ts)
- [src/lib/components](../src/lib/components)

### Acceptance Criteria

- Reading works comfortably in vertical, RTL, and LTR modes.
- The reader visibly communicates loading progress.
- Resume behavior is reliable after route changes, reloads, and app restarts.
- Controls fit on mobile without overlapping content.

### Verification

- Add tests for settings/state persistence.
- Manually test a long chapter on desktop and mobile viewport widths.
- Run typecheck and full tests.

---

## Phase 3 - Continue Reading and Home Experience

### Objective

Make the app feel like a daily reading home base.

### Planned Work

1. Add a prominent Continue Reading section.
   - Show the last opened title.
   - Show chapter title/number and page progress.
   - Provide one primary Resume action.
   - Provide a secondary title/details action.

2. Improve home feed usefulness.
   - Recently read.
   - Followed titles with new chapters.
   - Recently updated followed titles.
   - Favorites or pinned titles if those exist.

3. Add fast entry points.
   - Reopen last chapter.
   - Open library.
   - Open search.
   - Open latest known chapter for a followed title.

4. Defer vague recommendations.
   - Do not start with a generic "For You" feed.
   - Start with explainable recommendations only, such as "new chapters from followed titles" or "similar tags from titles you read."

### Likely Files

- [src/routes/Home.svelte](../src/routes/Home.svelte)
- [src/routes/Library.svelte](../src/routes/Library.svelte)
- [src/lib/tracker/local.ts](../src/lib/tracker/local.ts)
- [src/lib/media/chapterSnapshots.ts](../src/lib/media/chapterSnapshots.ts)

### Acceptance Criteria

- After reading a chapter, the home screen clearly offers a resume action.
- Continue Reading appears only when useful data exists.
- Empty states guide the user toward search or library actions.

### Verification

- Add tests for deriving continue-reading data from history/progress.
- Manually test first-run, has-history, and has-followed-titles states.

---

## Phase 4 - Library and Personalization

### Objective

Make the library feel personal, organized, and useful for ongoing reading.

### Planned Work

1. Improve followed title organization.
   - Group by reading status.
   - Group by recently updated.
   - Highlight unread/new chapters.
   - Preserve a simple all-titles view.

2. Add reading lists carefully.
   - Start with built-in lists: Reading, Plan to Read, Completed.
   - Add custom lists only after the built-ins feel solid.
   - Avoid turning the library into a heavy management UI too early.

3. Expand title-level preferences.
   - Preferred source.
   - Preferred chapter group.
   - Preferred reading mode.
   - Preferred image fit.

4. Make history more useful.
   - Show what changed since the last read.
   - Show new chapter indicators.
   - Make it easy to clear or correct incorrect progress.

### Likely Files

- [src/routes/Library.svelte](../src/routes/Library.svelte)
- [src/lib/tracker/local.ts](../src/lib/tracker/local.ts)
- [src/lib/media/titlePreferences.ts](../src/lib/media/titlePreferences.ts)
- [src/lib/media/chapterSnapshots.ts](../src/lib/media/chapterSnapshots.ts)

### Acceptance Criteria

- Users can quickly find ongoing, unread, and completed titles.
- Per-title preferences are saved and applied consistently.
- Library grouping logic is tested.

### Verification

- Add tests for grouping, sorting, and preference persistence.
- Manually test library states with no titles, a few titles, and many titles.

---

## Phase 5 - Polish, Empty States, and App-Wide Refinement

### Objective

Make Koma feel finished rather than merely functional.

### Planned Work

1. Improve empty states.
   - No sources.
   - No library entries.
   - No search results.
   - No history.
   - No chapters available.
   - Failed chapter load.

2. Improve feedback.
   - Success toasts for saved preferences and follow/unfollow actions.
   - Confirmation for destructive actions.
   - Clear loading feedback for network-heavy flows.
   - Subtle transitions where they clarify state changes.

3. Improve visual consistency.
   - Spacing.
   - Typography scale.
   - Button hierarchy.
   - Card density.
   - Navigation rhythm.
   - Mobile tap targets.

4. Add app-level quality of life.
   - Quick search from anywhere.
   - Keyboard shortcut help.
   - Clearer navigation labels.
   - Better responsive layouts.

### Likely Files

- [src/app.css](../src/app.css)
- [src/routes](../src/routes)
- [src/lib/components](../src/lib/components)

### Acceptance Criteria

- Core routes have useful first-run and empty states.
- Common actions provide clear feedback.
- Mobile and desktop layouts are visually coherent.
- Text and controls do not overlap at common viewport sizes.

### Verification

- Manual UI review across Home, Search, Media, Reader, Library, Activity, and Settings.
- Responsive checks for narrow mobile, tablet, and desktop widths.
- Typecheck and full test run.

---

## Suggested Milestones

### Milestone A - Reliable Reading

The app can resolve chapters, recover from common source failures, and keep the user informed.

Shippable when:

- source health is tracked,
- source ranking is tested,
- retry and fallback states are visible,
- the reader never fails silently.

### Milestone B - Comfortable Reading

The reader feels good enough for long sessions.

Shippable when:

- page loading progress is visible,
- resume is dependable,
- controls work on desktop and mobile,
- failed page retry works.

### Milestone C - Habit-Forming Home

The app makes returning obvious.

Shippable when:

- Continue Reading is prominent,
- recent activity and followed-title updates are useful,
- first-run and empty states guide the next action.

### Milestone D - Personal Library

The library helps users manage ongoing reading.

Shippable when:

- grouping and unread indicators work,
- title preferences are reliable,
- history is useful and correctable.

### Milestone E - Premium Feel

The app feels coherent and intentional across routes.

Shippable when:

- empty states are polished,
- feedback is consistent,
- responsive layouts are checked,
- the UI feels complete rather than experimental.

---

## Implementation Notes

- Keep scraper drivers focused on fetching/parsing.
- Put reliability orchestration near chapter resolution and reader loading.
- Use pure functions for ranking, grouping, and state derivation so tests stay simple.
- Prefer additive Dexie schema changes.
- Keep manual source priority as an explicit user preference, not something health ranking silently overwrites.
- Save fallback-derived preferences only after successful loading.
- Keep UI copy short and action-oriented.

## Recommended Next Slice

Start with Phase 1A:

1. Create the source health model and Dexie table.
2. Add pure source ranking helpers.
3. Add tests for ranking and health updates.
4. Wire health recording into chapter resolution and page loading.

After that, ship Phase 1B as a user-visible recovery slice in the reader and media pages.

---

## Phase 5 Completion Notes

Completed 2026-07-05.

### Empty states
- Added a shared `EmptyState` component and `emptyState()` helper covering no sources, no library entries, no search results, no history/activity, no chapters, no updates, and generic empty states. Each provides a primary action where appropriate.
- Replaced inline empty markup in `Search`, `Library`, `Activity`, `Categories`, `Media`, and `Reader` with the shared component.
- Fixed `Home.svelte` ComicK sections so failures show a retry-able error state instead of infinite skeletons.

### Feedback
- Added `Toast` component and used it for follow/unfollow, reading-list changes, preferred-source changes, reader direction/fit saves, library refresh, and AniList sync results.
- Added `ConfirmDialog` component and wired confirmations for removing sources, clearing catalog/chapter cache, clearing Cloudflare cookies, disconnecting trackers, and importing backup data.
- Added `messageClass`/`toneLabel` helpers in `src/lib/ui/feedback.ts` for consistent inline message styling.

### Visual consistency
- Added shared `.h2`, `.btn-danger`, and `.msg` tokens to `app.css`.
- Normalized spacing to use `--gap-lg` in `Home.svelte`.
- Removed redundant inner `tcard-btn` click handlers from `TitleCard` and `Home` cards.
- Removed the unused `.primary-link` nav distinction.
- Replaced emoji icons in `Activity` with text badges.
- Fixed `Media` back button to use `history.back()` when available.
- Removed unused `media` import from `Home.svelte`.

### App-level quality of life
- Added a reader chrome toggle (`☰`) so touch users can show/hide reader controls.
- Added an unobtrusive keyboard shortcut help panel (`?`) in the reader.
- Renamed nav label "Browse" to "Categories" to match the `/categories` route.
- Added shared formatting helpers (`chapterLabel`, `historyLabel`, `progressLabel`, `chapterSummary`, `groupLabel`) and time helpers (`clamp`, `timeAgo`, `relativeTime`, `formatDateTime`) in `src/lib/util.ts` and `src/lib/ui/formatting.ts`.

### Responsive layout
- Fixed `Settings` source rows on narrow screens: they now stack vertically and URLs wrap normally instead of breaking character-by-character.
- Improved reader toolbar mobile breakpoint: nav buttons span full width, shortcut kbd hints hide, and chapter nav buttons flex.
- Verified mobile (375px), tablet (768px), and desktop (1280px+) viewports across Home, Search, Library, Activity, Settings, Categories, Media, and Reader.

### Tests
- Added `tests/util.test.ts`, `tests/router.test.ts`, `tests/empty-state.test.ts`, `tests/feedback.test.ts`, `tests/confirmation.test.ts`, and `tests/formatting.test.ts`.
- Updated `package.json` test script to include the new tests.

### Verification
- `npm run typecheck`: 0 errors, 0 warnings.
- `npm test`: all checks pass.
- `npm run build`: succeeds. Remaining warnings are pre-existing Vite dynamic-import chunking warnings unrelated to Phase 5.
