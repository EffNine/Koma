# ADR 0003 — Ship a small set of built-in reference sources

- **Status:** Superseded
- **Date:** 2026-07-05
- **Superseded by:** ADR 0006 (Ship no built-in sources)
- **Supersedes:** ADR 0001 (the "ships no Source list" clause)

## Context

ADR 0001 chose to ship **no Source list** so that Koma would own only generic scraping plumbing and leave the choice of specific sites entirely to the user. In practice, that left the app without any working examples on first launch. Users had to find a compatible site, paste its URL, and hope the fingerprinter recognized the CMS before they could read anything.

We also found that the generic engine is hard to evaluate and maintain without at least a few known-good targets. A small set of reference sources gives us real-world test cases for the CMS presets, the driver abstraction, and health ranking.

## Decision (Superseded)

Koma shipped a **small, removable set of built-in reference sources** alongside the generic engine. As of this ADR, those sources were:

- **ComicK** (`https://comickz.co.uk/`)
- **ComicK API** (`https://api.comick.io/`)
- **MangaDex** (`https://mangadex.org/`)
- **WeebCentral** (`https://weebcentral.com/`)
- **MangaPill** (`https://mangapill.com/`)

Users could disable, remove, or reorder these sources in Settings. Add-by-URL and `sources.json` import remained the primary way to add custom sources. The engine stayed generic; the built-ins were convenience defaults, not a curated catalog.

## Rationale

The legal concern in ADR 0001 was about *curating and distributing a list of infringing sources*, not about providing a few removable starting points. A small, well-known reference set demonstrated the engine, gave users immediate value, and still left the user in control of which sources are enabled. It also created a realistic maintenance target for the preset and driver code.

The "user-declared" path is preserved and remains the recommended way to add long-tail sites.

## Consequences

- **Built-ins can break.** Reference sources may change domains, add anti-bot protection, or shut down. They are defaults, not guarantees.
- **Seeding is per-source.** New installs receive the current built-in set. Existing installs receive any newly added built-ins individually, without overwriting user-added sources.
- **UI must make removal obvious.** Settings should show built-ins as editable entries so users can remove them just like custom sources.
- **Harder to reverse than pure generic.** Reverting to "no sources" requires removing the seed list and any UI that depends on it.

---

## Supersession Note (2026-07-15)

This ADR is superseded by **ADR 0006 — Ship no built-in sources**. The project now ships with zero built-in sources. Users must add sources manually via URL or import. The seed logic remains but with an empty `BUILTIN_SOURCE_URLS` array and incremented version key (`v6`) to prevent re-seeding old sources on existing installs.
