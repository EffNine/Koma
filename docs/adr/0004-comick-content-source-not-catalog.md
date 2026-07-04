# ADR 0004 — COMICK as a content source, not the catalog backbone

- **Status:** Accepted
- **Date:** 2026-07-05
- **Amends:** ADR 0002

## Context

ADR 0002 correctly decided to drop COMICK as Koma's **catalog backbone** because `api.comick.*` is bot-walled behind a Cloudflare JS challenge that a non-browser client cannot reliably pass. That decision stands: AniList remains the canonical catalog for titles, covers, genres, status, and browse filters.

However, COMICK is still a useful **content source** for chapter lists and page images when it is reachable. Separating the catalog from the content source lets Koma keep stable AniList IDs for identity, tracking, and sync while still allowing users to read chapters from COMICK.

## Decision

- **AniList remains the catalog backbone.** A `Title` is identified by its AniList media `id`. Progress, follows, history, and tracker sync continue to use that ID.
- **COMICK may be shipped as a built-in content source only.** It provides chapters and page images through its website (`comickz.co.uk`) and its API (`api.comick.io`). It does not provide catalog metadata, canonical IDs, or tracking data.
- **COMICK is optional and removable.** Users can disable or delete the COMICK source entries in Settings and rely on other sources.

## Rationale

The Cloudflare problem affects unattended, non-browser API calls. It does not make COMICK unusable in every context:

- On **desktop**, Cloudflare Unlock can harvest a clearance cookie from an embedded webview and pass it to `fetchRaw`.
- On **PWA/browser**, the user may already have a trusted session in their browser, or the site may be reachable from the proxy.
- When COMICK fails, health ranking and fallback sources can route the request elsewhere.

Keeping COMICK as one of several content sources is therefore acceptable, provided it is never treated as the source of truth for identity or metadata.

## Consequences

- **COMICK reliability is not guaranteed.** It may be blocked by Cloudflare, change endpoints, or shut down. Koma must surface these failures clearly and fall back to other enabled sources.
- **Source health matters more.** Because COMICK can fail unpredictably, the health-ranking and fallback logic becomes critical for a good reading experience.
- **No catalog dependency on COMICK.** If COMICK disappears, only its content source breaks; search, browse, follows, progress, and tracker sync remain intact.
- **Driver maintenance.** COMICK drivers must be updated when the site changes domains or API shape. They are reverse-engineered, not officially supported.
