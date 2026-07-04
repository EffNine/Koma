# ADR 0001 — Ship a generic scraping engine; sources stay user-declared

- **Status:** Superseded by ADR 0003
- **Date:** 2026-06-28

## Context

Koma's explicit requirement is to scrape manga/manhwa/manhua sites directly for chapter pages, using "our own method to scrap all manhwa manga sources." This inverts the documented stance of the related Hayase-lite project, whose `CONTEXT.md` holds that *"the app ships no sources… for legal cleanliness"* and that sources are user-supplied code extensions.

Koma is a clean break from Hayase (no shared code or lineage), so there is no direct contradiction to resolve — but the same legal question reappears here: does shipping a scraping engine create the liability that "ships no sources" was meant to avoid?

## Decision

Koma ships a **generic scraping engine** (fetch + parse + CMS presets) and an **image proxy**, but ships **no Source list**. Sources are user-declared data, supplied two ways:

1. Add-by-URL — the engine fingerprints the site's CMS and works with no manual config.
2. Import a declarative `sources.json` bundle (the form the PRD's site list will take).

The engine is general-purpose; the specific sites it targets are chosen entirely by the user.

## Rationale

The legal exposure of a manga reader concentrates on *curating and distributing a list of infringing sources*, not on owning a generic fetch-and-parse tool. A generic HTML scraper with CMS presets is dual-use plumbing; the infringing act is the user's selection of which sites to point it at. Keeping the engine generic and the source list user-supplied preserves the substance of the "ships no sources" principle while satisfying the auto-scraping requirement.

This was a real trade-off: pure legal cleanliness (no engine at all) vs the requested auto-scraping capability. We chose the middle — engine built in, sources user-declared.

## Consequences

- **Engine maintenance:** CMSes change markup; presets and the fingerprinter drift and need periodic fixing.
- **Anti-bot / Cloudflare:** some sites block non-browser clients; fetchRaw must send a realistic User-Agent and Referer, and some sites may still need manual selector overrides or be unusable.
- **PWA bandwidth:** the browser-mode image proxy passes all page images through a host the user runs.
- **No liability shield for shared bundles:** if users publish and share `sources.json` lists of infringing sites, that sharing is outside the app's control and posture.
- **Hard to reverse:** this sets the product's posture and core architecture; unwinding it means removing the scraper and reverting to an extension model.