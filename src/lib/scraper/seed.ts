import { db } from '../db';
import { checkSourceUrl } from './sourceCheck';
import type { AddedSource, Source } from './sources';
import { friendlySourceName } from './sources';

const BUILTIN_SOURCE_URLS: string[] = [];

const INITIAL_SOURCES_KEY = 'koma.sources.seeded.v6';
const OLD_SOURCE_KEYS = ['koma.sources.seeded.v5', 'koma.sources.seeded.v4'];
let ensureInitialSourcesPromise: Promise<void> | null = null;

export async function ensureInitialSources(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(INITIAL_SOURCES_KEY) === '1') return;
  if (ensureInitialSourcesPromise) return ensureInitialSourcesPromise;
  ensureInitialSourcesPromise = (async () => {
    // One-time migration: if v4 was seeded, clear it so we re-seed with new sources
    for (const oldKey of OLD_SOURCE_KEYS) {
      if (window.localStorage.getItem(oldKey) === '1') {
        window.localStorage.removeItem(oldKey);
      }
    }

    // Remove old sources that are no longer built-in (Asura Scans, MangaFire)
    const oldIds = ['asurascans.com', 'mangafire.to'];
    for (const id of oldIds) {
      try { await db.sources.delete(id); } catch { /* ignore */ }
    }

    for (const url of BUILTIN_SOURCE_URLS) {
      const host = new URL(url).host;
      const existing = await db.sources.get(host);
      if (!existing) {
        await addBuiltInSource(url);
      }
    }
    window.localStorage.setItem(INITIAL_SOURCES_KEY, '1');
  })();
  try {
    await ensureInitialSourcesPromise;
  } finally {
    ensureInitialSourcesPromise = null;
  }
}

async function addBuiltInSource(rawUrl: string): Promise<AddedSource> {
  const check = await checkSourceUrl(rawUrl);
  const count = await db.sources.count();
  const host = new URL(check.base).host;
  const source: Source = {
    id: host,
    name: friendlySourceName(check.base),
    url: check.base,
    preset: check.preset,
    enabled: true,
    priority: count,
    addedAt: Date.now(),
    status: check.status,
    statusNote: check.statusNote,
    checkedAt: check.checkedAt,
  };
  await db.sources.put(source);
  return { source, check };
}
