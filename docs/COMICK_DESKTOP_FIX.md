# ComicK-Style Desktop Fix Notes

Date: 2026-07-05

These notes capture the ComicK reference investigation without changing the active improvement plan.

## Reference Findings

- `comickz.co.uk/` is mostly a landing page, but its header shows the useful product grammar: logo, command-style search trigger, categories dropdown, Search, My List, filter shortcuts, language, account, and theme controls.
- `comickz.co.uk/home` is the more relevant app surface: a dense dashboard with followed-title prompts, ranked horizontal sections, segmented time ranges like `7d`, `1m`, and `3m`, compact title cards, and right-side recent activity.
- The best pattern to copy is the global search overlay: top-centered, page-dimming, focused input, `Cmd/Ctrl+K`, instant results with covers, highlighted matches, alternate titles, and an advanced-search action.
- Categories is a compact shortcut menu, not the deep filter page. It links to high-value entry points such as popular webtoon, popular manga, genre browsing, publishers, and groups.
- `comick.dev` currently shows Cloudflare security verification in an automated desktop browser, so Koma needs source fallback, source health, and desktop Cloudflare Unlock to feel reliable.

## Fix Direction

1. Reliable source recovery
   - Finish source health, fallback, and actionable source failure states.
   - Verify against `comickz.co.uk`, `comick.dev` blocking, and at least one non-ComicK source.

2. Command search overlay
   - Trigger from the top search control and `Cmd/Ctrl+K`.
   - Show instant AniList results first, with cover thumbnails, title matches, and alternate names.
   - Include a clear advanced-search path into Search or Categories.
   - Keep the current page visible behind a dim overlay.

3. Home dashboard polish
   - Keep Continue Reading as the first priority.
   - Add compact ranked strips with time filters for trending, popular, and new updates.
   - Add followed-title updates instead of public community activity.

4. Categories shortcut menu
   - Keep the existing full Categories route for deep filtering.
   - Add a topbar dropdown for common shortcuts: popular manga, popular manhwa/webtoon, genres, groups, and source/publisher-like collections if available.

5. Reader trust states
   - Add page placeholders, loaded count, failed-page retry, source fallback messaging, and resume notice.
   - Surface whether Koma is resolving, retrying, switching sources, or blocked by Cloudflare.

## Avoid

- Do not copy ads, public notices, login pressure, or public comment/follow feeds.
- Do not rely on a single ComicK domain.
- Do not make Koma feel like a browser wrapper. The desktop value is local-first resume, library, source health, cache, and reader comfort.
