# Koma

A cozy manga and comic reader for your desktop and browser.

Koma helps you keep track of what you're reading, discover new titles through AniList, and read chapters from manga sites you add yourself. It's a reader and tracker in one — no account needed, no cloud dependency, just your local library.

## Features

- **Browse & discover** — Search and filter manga/manhwa/manhua through AniList's catalog. Trending, popular, by genre, by country.
- **Read** — A clean reader with RTL (manga), LTR (manhua), and vertical scroll (manhwa) modes. Keyboard shortcuts, click-to-advance, next-chapter preloading.
- **Track** — Follow titles, mark chapters read, keep reading history. All stored locally in your browser's database.
- **Sync** — Connect AniList, MyAnimeList, or MangaUpdates to sync your reading progress.
- **Your own sources** — Add any manga site by URL. Koma auto-detects common CMS platforms (Madara, MangaStream, Genkan, and others) so you don't need to configure selectors manually.
- **Offline cache** — Chapter pages are cached for offline reading. Clear caches when you need space.
- **Desktop + PWA** — Runs as a Tauri desktop app (macOS/Windows/Linux) or as a installable PWA in your browser.

## Getting Started

### Desktop

```bash
pnpm install
pnpm tauri dev
```

### Browser (PWA)

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:5174`. You can also install it as a PWA from your browser.

### Adding a source

1. Go to **Settings** → **Sources**
2. Paste a manga site URL (e.g. `https://example.com`) and click **Add & Check**
3. If Koma recognizes the CMS, the source is ready to use
4. Search for a title, open it, and chapters will resolve from your enabled sources

## How it works

Koma is a **reader and tracker**, not a content host. It uses:

- **AniList** for the catalog — search, browse, title metadata, covers
- **Your sources** for chapter content — you add the sites, Koma scrapes the chapter pages and extracts images
- **Local storage** (IndexedDB) for your reading state — follows, progress, history, settings

No accounts, no servers, no ads. Everything lives on your device.

## Tech

- **Frontend**: Svelte 5, TypeScript, Vite
- **Desktop**: Tauri 2 (Rust + system webview)
- **Scraping**: Generic CSS-selector-based engine with CMS presets
- **Database**: Dexie.js (IndexedDB wrapper)
- **Catalog**: AniList GraphQL API

## License

MIT
