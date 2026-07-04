# ADR 0003 — Ship a small set of built-in reference sources

- **Status:** Accepted
- **Date:** 2026-07-05
- **Supersedes:** ADR 0001 (the "ships no Source list" clause)

## Context

ADR 0001 chose to ship **no Source list** so that Koma would own only generic scraping plumbing and leave the choice of specific sites entirely to the user. In practice, that left the app without any working examples on first launch. Users had to find a compatible site, paste its URL, and hope the fingerprinter recognized the CMS before they could read anything.

We also found that the generic engine is hard to evaluate and maintain without at least a few known-good targets. A small set of reference sources gives us real-world test cases for the CMS presets, the driver abstraction, and health ranking.

## Decision

Koma ships a **small, removable set of built-in reference sources** alongside the generic engine. As of this ADR, those sources are:

- **ComicK** (`https://comickz.co.uk/`)
- **ComicK API** (`https://api.comick.io/`)

Users can disable, remove, or reorder these sources in Settings. Add-by-URL and `sources.json` import remain the primary way to add custom sources. The engine stays generic; the built-ins are convenience defaults, not a curated catalog.

## Rationale

The legal concern in ADR 0001 was about *curating and distributing a list of infringing sources*, not about providing a few removable starting points. A small, well-known reference set demonstrates the engine, gives users immediate value, and still leaves the user in control of which sources are enabled. It also creates a realistic maintenance target for the preset and driver code.

The "user-declared" path is preserved and remains the recommended way to add long-tail sites.

## Consequences

- **Built-ins can break.** Reference sources may change domains, add anti-bot protection, or shut down. They are defaults, not guarantees.
- **Seeding is per-source.** New installs receive the current built-in set. Existing installs receive any newly added built-ins individually, without overwriting user-added sources.
- **UI must make removal obvious.** Settings should show built-ins as editable entries so users can remove them just like custom sources.
- **Harder to reverse than pure generic.** Reverting to "no sources" requires removing the seed list and any UI that depends on it.
