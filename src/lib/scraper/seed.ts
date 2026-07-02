import { db } from '../db';
import { checkSourceUrl } from './sourceCheck';
import type { AddedSource, Source } from './sources';
import { friendlySourceName } from './sources';

const BUILTIN_SOURCE_URLS = [
  'https://comickz.co.uk/',
  'https://mangapill.com/',
  'https://comick-source-api.notaspider.dev/',
];

const INITIAL_SOURCES_KEY = 'koma.sources.seeded.v3';
let ensureInitialSourcesPromise: Promise<void> | null = null;

export async function ensureInitialSources(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(INITIAL_SOURCES_KEY) === '1') return;
  if (ensureInitialSourcesPromise) return ensureInitialSourcesPromise;
  ensureInitialSourcesPromise = (async () => {
    // Remove old sources that are no longer built-in (MangaDex, Asura Scans, MangaFire)
    const oldIds = ['mangadex.org', 'asurascans.com', 'mangafire.to'];
    for (const id of oldIds) {
      try { await db.sources.delete(id); } catch { /* ignore */ }
    }

    // Ensure MangaPill is added for existing users who upgraded
    const mangapillExists = await db.sources.get('mangapill.com');
    if (!mangapillExists) {
      await addBuiltInSource('https://mangapill.com/');
    }

    // Only seed if no ComicK source exists yet
    const existing = await db.sources.count();
    if (existing > 0) {
      window.localStorage.setItem(INITIAL_SOURCES_KEY, '1');
      return;
    }
    for (const url of BUILTIN_SOURCE_URLS) {
      await addBuiltInSource(url);
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
    // The Comick Source API needs a default upstream source to query.
    config: host === 'comick-source-api.notaspider.dev'
      ? { apiSourceId: 'atsumoe' }
      : undefined,
  };
  await db.sources.put(source);
  return { source, check };
}
