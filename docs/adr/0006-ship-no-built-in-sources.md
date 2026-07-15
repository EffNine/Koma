# ADR 0006 — Ship no built-in sources

- **Status:** Accepted
- **Date:** 2026-07-15
- **Supersedes:** ADR 0003 (Ship a small set of built-in reference sources)

## Context

ADR 0003 introduced a small set of built-in reference sources (ComicK, ComicK API, MangaDex, WeebCentral, MangaPill) to give users immediate working examples on first launch. However, distributing even a small curated list of manga sources carries legal and maintenance risk:

- Sources may be targeted by takedowns or legal action
- Maintaining a "known good" list requires ongoing verification
- Users in different jurisdictions may have different legal exposure
- The project's goal is a generic engine, not a source aggregator

## Decision

Koma **ships with zero built-in sources**. The `BUILTIN_SOURCE_URLS` array in `src/lib/scraper/seed.ts` is empty. The seeding logic remains but will not add any sources on first launch.

Users must add sources manually via:
1. **Add by URL** in Settings → Sources (auto-fingerprints CMS preset)
2. **Import `sources.json`** exported from another Koma install
3. **Manual entry** via IndexedDB (advanced)

The seed version key is incremented to `v6` (`koma.sources.seeded.v6`) with `v5` and `v4` in `OLD_SOURCE_KEYS` to prevent re-seeding old sources on existing installs.

## Rationale

- **Legal safety:** No curated source list is distributed with the app
- **User sovereignty:** Users choose exactly which sources they trust and use
- **Maintenance burden:** No need to monitor, update, or remove broken built-ins
- **Generic engine focus:** Reinforces that Koma is a scraping framework, not a source catalog

## Consequences

- **Empty first launch:** New users see an empty source list and must add at least one source to read anything
- **Documentation needed:** README and onboarding should explain how to add sources
- **Testing impact:** CI/E2E tests must seed their own test sources
- **Reversible:** The seed infrastructure remains; adding sources back only requires populating `BUILTIN_SOURCE_URLS` and bumping the version key