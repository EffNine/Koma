# ADR 0002 — AniList as catalog, not COMICK

- **Status:** Accepted
- **Date:** 2026-06-28
- **Supersedes:** the COMICK-catalog decision from the initial grilling (recorded in the original plan as D6).

## Context

The grilling chose COMICK's API as the catalog backbone (D6) because it is manga/manhwa/manhua-specific and matches the COMICK UI directly. During Stage 1 verification we discovered:

- COMICK has rebranded to **comick.dev**; `api.comick.fun` is dead DNS, `api.comick.cc` is a "domain for sale" placeholder.
- The live API (`api.comick.dev` / `comick.dev/v1.0/*`) is behind a **Cloudflare JS challenge** (`cf-mitigated: challenge`, "Just a moment…"). A non-browser client — which is exactly what our Rust `fetchRaw` and the PWA scraping proxy are — cannot pass it without a Cloudflare-bypass layer (cf-clearance cookie harvesting from an embedded browser session).
- MangaDex's API (`api.mangadex.org`) is similarly bot-walled here (returns a 400 + HTML captcha page to non-browser clients).
- **AniList's GraphQL API** (`graphql.anilist.co`) is cleanly reachable from both a non-browser client and a browser (CORS allowed), returns JSON, and supports manga browse by `countryOfOrigin` (JP/KR/CN) with `sort` (TRENDING/POPULARITY), plus covers, tags, status, and chapter counts.

## Decision

Use **AniList GraphQL as the catalog backbone**. Drop COMICK and MangaDex as data sources. The COMICK *UI design* (look/feel/layout) is retained — it was always a design reference, not a data dependency.

Consequences for the model:

- A **Title** is identified by its AniList media `id`, not a COMICK `hid`.
- **Chapters** are not provided by the catalog (AniList carries no chapter list/contents). They come from a Source (the scraper). A chapter is identified by its number as the Source reports it.
- **Progress** is keyed on AniList media `id` + Source chapter number; on sync it maps to the integer chapter AniList/MAL expect. (This replaces the earlier COMICK-`hid`-keyed progress model.)
- **Reading direction** is derived from AniList `countryOfOrigin` (KR → vertical-webtoon, CN → LTR, JP → RTL), not from COMICK fields.
- The catalog needs **no proxy or Rust fetch** — AniList is browser-CORS-callable, so the web core fetches it directly on every platform. `fetchRaw` is reserved for the scraper (Sources) only.

AniList is already one of the three trackers, so catalog and tracking now share one API.

## Rationale

Reachability is non-negotiable: a catalog the app's fetch primitive cannot reach is unusable. Only AniList cleared that bar without a fragile, anti-ponytail Cloudflare-bypass layer that would also be PWA-hostile (no embedded browser to harvest a clearance cookie). AniList's manga coverage — including `countryOfOrigin` filtering for manhwa/manhua — covers the browse needs for v1. The cost is COMICK's richer manhwa-specific "latest updates" feed; we accept that for v1 and can revisit a CF-bypassed source later behind the same Source interface if warranted.

This was a real trade-off (rich COMICK browse vs reliable AniList reachability), surfaced by verification rather than guessed.

## Consequences

- AniList anonymous queries are rate-limited (~90 req/min); catalog responses are cached in IndexedDB to stay within limits.
- AniList is anime-weighted in spirit; manhwa/manhua browse uses the `countryOfOrigin` filter, which works but is not as curated as a dedicated manhwa aggregator.
- Hard to reverse only insofar as the Title/Chapter/Progress identity model is now AniList-shaped; switching back to a COMICK-like `hid` model later would re-touch those types and the sync mapping.