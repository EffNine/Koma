# Koma

A cozy manga and comic reader for desktop and browser.

Koma helps you track what you're reading, discover new titles through AniList, and read chapters from manga sites you add yourself. It's a reader and tracker in one — no account needed, no cloud dependency, just your local library.

## Features

- **Browse & discover** — Search and filter manga/manhwa/manhua through AniList's catalog
- **Read** — Clean reader with RTL (manga), LTR (manhua), and vertical scroll (manhwa) modes
- **Track** — Follow titles, mark chapters read, keep reading history locally
- **Sync** — Connect AniList, MyAnimeList, or MangaUpdates to sync progress
- **Your own sources** — Add any manga site by URL; Koma auto-detects CMS platforms
- **Offline cache** — Chapter pages cached for offline reading
- **Desktop + PWA** — Runs as Tauri desktop app or installable PWA

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

Open `http://localhost:5174` and install as PWA from browser.

### Adding a source
1. Go to **Settings** → **Sources**
2. Paste a manga site URL and click **Add & Check**
3. If Koma recognizes the CMS, the source is ready
4. Search for a title and chapters resolve from your enabled sources

## How it works

Koma is a **reader and tracker**, not a content host. It uses:
- **AniList** for catalog (search, browse, metadata, covers)
- **Your sources** for chapter content (you add sites, Koma scrapes pages)
- **Local storage** (IndexedDB) for reading state (follows, progress, history)

No accounts, no servers, no ads. Everything lives on your device.

## Tech

- **Frontend**: Svelte 5, TypeScript, Vite
- **Desktop**: Tauri 2 (Rust + system webview)
- **Scraping**: Generic CSS-selector engine with CMS presets
- **Database**: Dexie.js (IndexedDB wrapper)
- **Catalog**: AniList GraphQL API

MIT
