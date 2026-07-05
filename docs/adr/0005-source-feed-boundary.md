# ADR 0005 - Source feeds are distinct from catalog and chapter sources

- **Status:** Accepted
- **Date:** 2026-07-05
- **Amends:** ADR 0004

## Context

Koma now has three related but different concepts:

1. **Catalog** - AniList-backed title identity, metadata, covers, and tracker mapping.
2. **Chapter sources** - user-configurable scraper sources that resolve a catalog title into chapters and page images.
3. **Browse/search feeds** - source-provided discovery lists such as ComicK search, popular manga, webtoon shortcuts, and genre browsing.

Before this ADR, ComicK browse/search code leaked ComicK-specific names (`CKTitle`, `searchCK`, `CK_GENRES`) directly into Search, Genres, and card UI. That made the UI look coupled to one provider even though the product direction is multi-source and AniList remains the catalog.

## Decision

Introduce a **Source Feed** boundary for provider-specific discovery data.

The source-feed layer lives in `src/lib/sourceFeeds/`:

- `types.ts` defines provider-neutral `SourceFeed`, `SourceFeedTitle`, and `SourceFeedSearchParams`.
- `comick.ts` implements ComicK as one source feed.

UI routes should depend on `SourceFeedTitle` and a chosen source-feed implementation, not provider-specific scraper names.

`src/lib/scraper/comickBrowse.ts` remains as a compatibility shim for older imports, but new code should import from `src/lib/sourceFeeds/comick.ts`.

## Rationale

Source feeds are not the same thing as the catalog:

- A feed result can be useful for discovery without being canonical identity.
- Opening a feed title should resolve into an AniList media route before normal reading flow begins.
- Feed filters and genre names are provider-shaped and should not pollute catalog or reader code.

Source feeds are also not the same thing as chapter sources:

- A feed may list titles but not provide page images.
- A chapter source may provide pages but not useful browse/search ranking.
- Keeping the boundary separate lets Koma add or remove discovery providers without rewriting reader/source orchestration.

## Consequences

- Search and Genres can evolve toward multiple feed providers.
- ComicK browse/search remains useful without becoming the identity backbone.
- Feed-to-catalog opening stays explicit through `openTitleCandidate` / `titleCandidateRoute`.
- The app can later add a feed selector, command-search overlay, or ranked feed strips without coupling those surfaces to scraper drivers.

## Verification

- `tests/source-feed.test.ts` covers ComicK URL building and feed-result mapping.
- Search and Genres browser smoke tests passed after the extraction.
